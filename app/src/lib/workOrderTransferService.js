/**
 * workOrderTransferService.js
 * Capa de persistencia transaccional para:
 * - Unificar íntegramente una OT origen dentro de otra OT destino del mismo barco.
 * - Separar / independizar sublínea trasladando 100% de los costos vinculados con auditoría.
 */

import { auditService } from './auditService.js'
import { syncWorkOrderHeaderStatusService } from './workOrderHeaderSync.js'
import { normalizeOtTitleKey, resolveSingleWorkItemId } from './workOrderUnificationEngine.js'
import {
  fetchWorkOrderTransferSummaryService,
  assertNoDuplicateOtTitleInDb,
} from './workOrderSummaryService.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { workItemsRepository } from '../repositories/workItemsRepository.js'
import { inventoryTransactionsRepository } from '../repositories/inventoryTransactionsRepository.js'
import { thirdPartyServicesRepository } from '../repositories/thirdPartyServicesRepository.js'
import { purchaseOrdersRepository, purchaseDocumentsRepository } from '../repositories/purchaseOrdersRepository.js'
import { laborLogsRepository } from '../repositories/laborLogsRepository.js'
import { gasMovementsRepository } from '../repositories/gasMovementsRepository.js'

export { fetchWorkOrderTransferSummaryService, assertNoDuplicateOtTitleInDb }

const SHEET_NAME = 'Órdenes de Trabajo y Catálogo (OT.ABC)'

async function moveAllLinkedRecordsBetweenWos(sourceWoId, targetWoId, sealWorkItemId = null) {
  const results = await Promise.all([
    inventoryTransactionsRepository.reassignWorkOrder(sourceWoId, targetWoId, { sealWorkItemId }),
    thirdPartyServicesRepository.reassignWorkOrder(sourceWoId, targetWoId, { sealWorkItemId }),
    purchaseOrdersRepository.reassignWorkOrder(sourceWoId, targetWoId),
    laborLogsRepository.reassignWorkOrder(sourceWoId, targetWoId, { sealWorkItemId }),
    gasMovementsRepository.reassignWorkOrder(sourceWoId, targetWoId),
    purchaseDocumentsRepository.reassignWorkOrder(sourceWoId, targetWoId),
  ])
  const failed = results.find((r) => r.error)
  if (failed?.error) throw new Error(failed.error)
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
  const { error: wiErr } = await workItemsRepository.reassignWorkOrder(sourceWo.id, targetWo.id)
  if (wiErr) throw new Error(wiErr)

  await moveAllLinkedRecordsBetweenWos(sourceWo.id, targetWo.id, null)

  const mergeTag = `[UNIFICADA EN ${targetWo.ot_number}] Absorción completa hacia ${targetWo.ot_number} · ${targetWo.title}${reason?.trim() ? ` (${reason.trim()})` : ''}`
  const nextSourceNotes = [sourceWo.notes, mergeTag].filter(Boolean).join('\n')

  const { error: srcErr } = await workOrdersRepository.updateById(
    sourceWo.id,
    { status: 'Unificada', merged_into_wo_id: targetWo.id, notes: nextSourceNotes },
    { select: null }
  )
  if (srcErr) throw new Error(srcErr)

  await syncWorkOrderHeaderStatusService({
    workOrderId: targetWo.id,
    user,
    reason: 'Unificación de Órdenes de Trabajo',
  })

  await auditService.logRowAction({
    action: 'UNIFY_WORK_ORDERS',
    entityType: 'work_orders',
    entityId: targetWo.id,
    entityName: `${sourceWo.ot_number} (${sourceWo.title}) -> ${targetWo.ot_number} (${targetWo.title})`,
    details: { sourceWoId: sourceWo.id, targetWoId: targetWo.id, summary: summary.rows, reason },
    sheetName: SHEET_NAME,
    moduleRoute: '/ots',
    user: user?.email || 'Supervisor',
  })

  return { summary, targetLabel: `${targetWo.ot_number} · ${targetWo.title}` }
}

/**
 * Crea una nueva OT en el mismo barco y traslada íntegramente todas las sublíneas
 * y costos vinculados de `sourceWo` hacia esa nueva OT, archivando `sourceWo` como Unificada.
 */
export async function transferWorkOrderToNewOtService({
  sourceWo,
  newOtTitle,
  otCreationType = 'libre',
  reason = '',
  user,
  getNextOtNumberForShip,
}) {
  if (!sourceWo?.id || !sourceWo?.ship_id) throw new Error('Seleccioná la OT origen.')
  const normalizedTitle = normalizeOtTitleKey(newOtTitle)
  if (!normalizedTitle) throw new Error('Ingresá el nombre de la nueva OT.')

  await assertNoDuplicateOtTitleInDb({ shipId: sourceWo.ship_id, title: normalizedTitle })

  const summary = await fetchWorkOrderTransferSummaryService(sourceWo.id)
  const newOtNum = typeof getNextOtNumberForShip === 'function'
    ? getNextOtNumberForShip(sourceWo.ship_id)
    : `OT-${Date.now()}`
  const nowIso = new Date().toISOString()

  const { data: createdWo, error: createErr } = await workOrdersRepository.insertOne({
    ship_id: sourceWo.ship_id,
    ot_number: newOtNum,
    title: normalizedTitle,
    description: sourceWo.description || null,
    status: sourceWo.status === 'Unificada' ? 'En Progreso' : (sourceWo.status || 'En Progreso'),
    work_type: sourceWo.work_type || 'HORA',
    assignment_type: sourceWo.assignment_type || 'Presupuesto General',
    budget_code: sourceWo.budget_code || null,
    foreman_name: sourceWo.foreman_name || null,
    contractor_name: sourceWo.contractor_name || null,
    is_tabulated: otCreationType === 'tabulada',
    start_date: sourceWo.start_date || nowIso.split('T')[0],
    notes: `Creada por traslado completo desde ${sourceWo.ot_number} · ${sourceWo.title}${reason?.trim() ? ` (${reason.trim()})` : ''}`,
  })
  if (createErr) throw new Error(createErr)
  if (!createdWo?.id) throw new Error('No se pudo crear la nueva Orden de Trabajo destino.')

  const { error: wiErr } = await workItemsRepository.reassignWorkOrder(sourceWo.id, createdWo.id)
  if (wiErr) throw new Error(wiErr)

  await moveAllLinkedRecordsBetweenWos(sourceWo.id, createdWo.id, null)

  const mergeTag = `[TRASLADADA A ${createdWo.ot_number}] Absorción completa hacia nueva OT ${createdWo.ot_number} · ${createdWo.title}${reason?.trim() ? ` (${reason.trim()})` : ''}`
  const nextSourceNotes = [sourceWo.notes, mergeTag].filter(Boolean).join('\n')

  const { error: srcErr } = await workOrdersRepository.updateById(
    sourceWo.id,
    { status: 'Unificada', merged_into_wo_id: createdWo.id, notes: nextSourceNotes },
    { select: null }
  )
  if (srcErr) throw new Error(srcErr)

  await auditService.logRowAction({
    action: 'UNIFY_WORK_ORDERS',
    entityType: 'work_orders',
    entityId: createdWo.id,
    entityName: `${sourceWo.ot_number} (${sourceWo.title}) -> ${createdWo.ot_number} (${createdWo.title})`,
    details: { sourceWoId: sourceWo.id, targetWoId: createdWo.id, createdNewOt: true, summary: summary.rows, reason },
    sheetName: SHEET_NAME,
    moduleRoute: '/ots',
    user: user?.email || 'Supervisor',
  })

  return { summary, targetLabel: `${createdWo.ot_number} · ${createdWo.title}` }
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
  workOrders = [],
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
    const { data: createdWo, error: createWoErr } = await workOrdersRepository.insertOne({
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
      notes: originNote,
    })
    if (createWoErr) throw new Error(createWoErr)
    targetWoId = createdWo.id
    targetWoLabel = `${newOtNum} - ${newTitle}`
  } else {
    const destWo = workOrders.find((w) => w.id === targetWoId)
    if (!destWo) throw new Error('Seleccioná una OT destino válida.')
    targetWoLabel = `${destWo.ot_number} - ${destWo.title}`
  }

  const { error: moveItemErr } = await workItemsRepository.updateById(
    separatingRow.id,
    { work_order_id: targetWoId, updated_at: new Date().toISOString() },
    { select: null }
  )
  if (moveItemErr) throw new Error(moveItemErr)

  if (separateForm.migrate_all_wo_costs && sourceWo?.id) {
    const { data: destItems } = await workItemsRepository.listByWorkOrderIds([targetWoId], { select: 'id, status' })
    const singleTargetWi = resolveSingleWorkItemId(targetWoId, destItems || [])
    await moveAllLinkedRecordsBetweenWos(sourceWo.id, targetWoId, singleTargetWi)
  } else {
    await Promise.all([
      thirdPartyServicesRepository.reassignByWorkItemId(separatingRow.id, targetWoId),
      laborLogsRepository.reassignByWorkItemId(separatingRow.id, targetWoId),
      inventoryTransactionsRepository.reassignByWorkItemId(separatingRow.id, targetWoId),
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
      reason: separateForm.reason,
    },
    sheetName: SHEET_NAME,
    moduleRoute: '/ots',
    user: user?.email || 'Supervisor',
  })

  await syncWorkOrderHeaderStatusService({
    workOrderId: targetWoId,
    user,
    reason: 'Separación / traslado de trabajo hacia OT destino',
  })
  if (sourceWo?.id && sourceWo.id !== targetWoId) {
    await syncWorkOrderHeaderStatusService({
      workOrderId: sourceWo.id,
      user,
      reason: 'Separación / egreso de trabajo desde OT origen',
    })
  }

  return targetWoLabel
}
