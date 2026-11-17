/**
 * workOrderTransferService.js
 * Capa de persistencia transaccional para:
 * - Unificar íntegramente una OT origen dentro de otra OT destino del mismo barco.
 * - Separar / independizar sublínea trasladando 100% de los costos vinculados con auditoría.
 */

import { supabase } from './supabase.js'
import { auditService } from './auditService.js'
import { normalizeOtTitleKey, resolveSingleWorkItemId } from './workOrderUnificationEngine.js'
import {
  fetchWorkOrderTransferSummaryService,
  assertNoDuplicateOtTitleInDb
} from './workOrderSummaryService.js'

export { fetchWorkOrderTransferSummaryService, assertNoDuplicateOtTitleInDb }

const SHEET_NAME = 'Órdenes de Trabajo y Catálogo (OT.ABC)'

async function moveAllLinkedRecordsBetweenWos(sourceWoId, targetWoId, sealWorkItemId = null) {
  const nowIso = new Date().toISOString()
  const ops = [
    supabase.from('inventory_transactions').update(
      sealWorkItemId ? { work_order_id: targetWoId, work_item_id: sealWorkItemId } : { work_order_id: targetWoId }
    ).eq('work_order_id', sourceWoId),
    supabase.from('third_party_services').update(
      sealWorkItemId
        ? { work_order_id: targetWoId, work_item_id: sealWorkItemId, updated_at: nowIso }
        : { work_order_id: targetWoId, updated_at: nowIso }
    ).eq('work_order_id', sourceWoId),
    supabase.from('purchase_orders').update({ work_order_id: targetWoId, updated_at: nowIso }).eq('work_order_id', sourceWoId),
    supabase.from('labor_logs').update(
      sealWorkItemId ? { work_order_id: targetWoId, work_item_id: sealWorkItemId } : { work_order_id: targetWoId }
    ).eq('work_order_id', sourceWoId),
    supabase.from('gas_cylinder_movements').update({ work_order_id: targetWoId }).eq('work_order_id', sourceWoId),
    supabase.from('purchase_documents').update({ work_order_id: targetWoId }).eq('work_order_id', sourceWoId)
  ]
  const results = await Promise.all(ops)
  const failed = results.find((r) => r.error)
  if (failed?.error) throw failed.error
}

/**
 * Unifica íntegramente una OT origen dentro de una OT destino del mismo buque.
 */
export async function unifyWorkOrdersService({ sourceWo, targetWo, reason = '', user }) {
  if (!sourceWo?.id || !targetWo?.id) throw new Error('Seleccioná la OT origen y la OT destino.')
  if (String(sourceWo.id) === String(targetWo.id)) throw new Error('La OT origen y destino no pueden ser la misma.')
  if (String(sourceWo.ship_id) !== String(targetWo.ship_id)) {
    throw new Error('Solo se pueden unificar órdenes de trabajo pertenecientes al mismo barco.')
  }

  const summary = await fetchWorkOrderTransferSummaryService(sourceWo.id)
  const nowIso = new Date().toISOString()

  const { error: wiErr } = await supabase
    .from('work_items')
    .update({ work_order_id: targetWo.id, updated_at: nowIso })
    .eq('work_order_id', sourceWo.id)
  if (wiErr) throw wiErr

  await moveAllLinkedRecordsBetweenWos(sourceWo.id, targetWo.id, null)

  const mergeTag = `[UNIFICADA EN ${targetWo.ot_number}] Absorción completa hacia ${targetWo.ot_number} · ${targetWo.title}${reason?.trim() ? ` (${reason.trim()})` : ''}`
  const nextSourceNotes = [sourceWo.notes, mergeTag].filter(Boolean).join('\n')

  const { error: srcErr } = await supabase
    .from('work_orders')
    .update({ status: 'Unificada', merged_into_wo_id: targetWo.id, notes: nextSourceNotes })
    .eq('id', sourceWo.id)
  if (srcErr) throw srcErr

  const { data: targetItems } = await supabase.from('work_items').select('id, status').eq('work_order_id', targetWo.id)
  if ((targetItems || []).some((it) => it.status === 'En ejecución')) {
    await supabase.from('work_orders').update({ status: 'En Progreso', closed_at: null }).eq('id', targetWo.id)
  }

  await auditService.logRowAction({
    action: 'UNIFY_WORK_ORDERS',
    entityType: 'work_orders',
    entityId: targetWo.id,
    entityName: `${sourceWo.ot_number} (${sourceWo.title}) -> ${targetWo.ot_number} (${targetWo.title})`,
    details: { sourceWoId: sourceWo.id, targetWoId: targetWo.id, summary: summary.rows, reason },
    sheetName: SHEET_NAME,
    moduleRoute: '/ots',
    user: user?.email || 'Supervisor'
  })

  return { summary, targetLabel: `${targetWo.ot_number} · ${targetWo.title}` }
}

/**
 * Separa/traslada una sublínea (`work_item`) hacia una nueva OT o una OT existente,
 * moviendo sus gastos vinculados (completo por OT cuando se confirma o por work_item_id).
 */
export async function separateWorkItemCompleteService({
  separateForm,
  separatingRow,
  user,
  getNextOtNumberForShip,
  workOrders = []
}) {
  const sourceWo = separatingRow.wo
  const shipId = sourceWo?.ship_id
  let targetWoId = separateForm.target_existing_wo_id
  let targetWoLabel = ''
  const timestamp = new Date().toLocaleString('es-AR')
  const author = user?.email?.split('@')[0] || 'Supervisor'

  if (separateForm.mode === 'new_ot') {
    const newTitle = normalizeOtTitleKey(separateForm.new_ot_title)
    if (!newTitle) throw new Error('Ingresá el nombre de la nueva OT.')
    await assertNoDuplicateOtTitleInDb({ shipId, title: newTitle })

    const newOtNum = getNextOtNumberForShip(shipId)
    const originNote = `[${timestamp} - Separación por ${author}]: Independizada desde ${sourceWo?.ot_number} (${sourceWo?.title}). Motivo: ${separateForm.reason.trim()}`
    const { data: createdWo, error: createWoErr } = await supabase
      .from('work_orders')
      .insert([{
        ship_id: shipId,
        ot_number: newOtNum,
        title: newTitle,
        description: separatingRow.description || null,
        status: separatingRow.status === 'En ejecución' ? 'En Progreso' : 'Pendiente',
        work_type: separatingRow.work_type || 'HORA',
        assignment_type: separatingRow.assignment_type || 'Presupuesto General',
        budget_code: separatingRow.specific_budget_id || null,
        foreman_name: separatingRow.foreman_name || sourceWo?.foreman_name,
        contractor_name: (separatingRow.contractors || []).join(', ') || null,
        is_tabulated: separateForm.ot_creation_type === 'tabulada',
        start_date: new Date().toISOString().split('T')[0],
        notes: originNote
      }])
      .select()
    if (createWoErr) throw createWoErr
    targetWoId = createdWo[0].id
    targetWoLabel = `${newOtNum} - ${newTitle}`
  } else {
    const destWo = workOrders.find((w) => w.id === targetWoId)
    if (!destWo) throw new Error('Seleccioná una OT destino válida.')
    targetWoLabel = `${destWo.ot_number} - ${destWo.title}`
  }

  const { error: moveItemErr } = await supabase
    .from('work_items')
    .update({ work_order_id: targetWoId, updated_at: new Date().toISOString() })
    .eq('id', separatingRow.id)
  if (moveItemErr) throw moveItemErr

  if (separateForm.migrate_all_wo_costs && sourceWo?.id) {
    const { data: destItems } = await supabase.from('work_items').select('id, status').eq('work_order_id', targetWoId)
    const singleTargetWi = resolveSingleWorkItemId(targetWoId, destItems || [])
    await moveAllLinkedRecordsBetweenWos(sourceWo.id, targetWoId, singleTargetWi)
  } else {
    await Promise.all([
      supabase.from('third_party_services').update({ work_order_id: targetWoId, updated_at: new Date().toISOString() }).eq('work_item_id', separatingRow.id),
      supabase.from('labor_logs').update({ work_order_id: targetWoId }).eq('work_item_id', separatingRow.id),
      supabase.from('inventory_transactions').update({ work_order_id: targetWoId }).eq('work_item_id', separatingRow.id)
    ])
  }

  await auditService.logRowAction({
    action: 'UPDATE',
    entityType: 'work_orders',
    entityId: targetWoId,
    entityName: `Separación · ${targetWoLabel}`,
    details: {
      workItemId: separatingRow.id,
      sourceWoId: sourceWo?.id,
      migrateAllWoCosts: Boolean(separateForm.migrate_all_wo_costs),
      reason: separateForm.reason
    },
    sheetName: SHEET_NAME,
    moduleRoute: '/ots',
    user: user?.email || 'Supervisor'
  })

  return targetWoLabel
}
