import { supabase } from './supabase.js'
import { auditService } from './auditService.js'
import { duplicateRecord } from './gridRowActions.js'
import { WORK_ITEM_CLONE_FIELDS } from './workOrdersConstants.js'

const CLOSED_OR_MERGED_SKIP = new Set(['Unificada', 'Cancelada'])
const NON_OPERATIONAL_ITEM_STATUSES = new Set([
  'Facturado',
  'Finalizado',
  'Finalizado costo final de obra'
])

/**
 * Sincroniza la cabecera `work_orders` (y hermanas por ship_id + ot_number)
 * con el estado agregado real de sus `work_items` activos (`status !== 'Desestimado'`).
 *
 * Garantiza que:
 * 1) Facturar tareas 1 a 1 hasta cerrar la última selle `work_orders` igual que el candado (`Facturada` + `closed_at`).
 * 2) Pasar al menos una tarea a un estado operativo/abierto (ej. desde Lápiz o grilla) destrabe la cabecera
 *    (`En Progreso` / `Pendiente`, `closed_at: null`, `allow_post_billing_costs: false`), reactivando acciones
 *    y visibilidad en módulos de costos (Horas, Pañol, Compras, Terceros).
 */
export async function syncWorkOrderHeaderStatusService({
  workOrderId,
  user = null,
  reason = ''
}) {
  if (!workOrderId || typeof workOrderId !== 'string') {
    return { synced: false, reason: 'missing_work_order_id' }
  }

  const { data: woList, error: woLookupErr } = await supabase
    .from('work_orders')
    .select('id, ship_id, ot_number, title, status, closed_at, allow_post_billing_costs, merged_into_wo_id')
    .eq('id', workOrderId)
    .limit(1)

  if (woLookupErr) throw woLookupErr
  const wo = woList?.[0]
  if (!wo || wo.merged_into_wo_id || CLOSED_OR_MERGED_SKIP.has(wo.status)) {
    return { synced: false, reason: 'skipped_merged_or_cancelled' }
  }

  // Identificar cabeceras hermanas activas del mismo barco y número de OT
  const targetWoIds = [wo.id]
  if (wo.ship_id && wo.ot_number) {
    const { data: siblings, error: sibErr } = await supabase
      .from('work_orders')
      .select('id, status, merged_into_wo_id')
      .eq('ship_id', wo.ship_id)
      .eq('ot_number', wo.ot_number)

    if (sibErr) throw sibErr
    ;(siblings || []).forEach((s) => {
      if (
        s?.id &&
        !s.merged_into_wo_id &&
        !CLOSED_OR_MERGED_SKIP.has(s.status) &&
        !targetWoIds.includes(s.id)
      ) {
        targetWoIds.push(s.id)
      }
    })
  }

  const { data: allItems, error: itemsErr } = await supabase
    .from('work_items')
    .select('id, status')
    .in('work_order_id', targetWoIds)

  if (itemsErr) throw itemsErr

  const activeItems = (allItems || []).filter((it) => it.status !== 'Desestimado')
  if (activeItems.length === 0) {
    return { synced: false, reason: 'no_active_items' }
  }

  const nowIso = new Date().toISOString()
  const allBilled = activeItems.every((it) => it.status === 'Facturado')
  const allPendingStart = activeItems.every((it) => it.status === 'Pendiente de inicio')
  const hasOperationalItem = activeItems.some((it) => !NON_OPERATIONAL_ITEM_STATUSES.has(it.status))

  // Caso 1: Todas las subtareas activas están Facturadas -> Sellar OT (idéntico al candado)
  if (allBilled) {
    if (wo.status === 'Facturada' && Boolean(wo.closed_at)) {
      return { synced: false, state: 'already_facturada' }
    }

    const { error: updErr } = await supabase
      .from('work_orders')
      .update({
        status: 'Facturada',
        closed_at: wo.closed_at || nowIso,
        allow_post_billing_costs: Boolean(wo.allow_post_billing_costs)
      })
      .in('id', targetWoIds)

    if (updErr) throw updErr

    await auditService.logRowAction({
      action: 'AUTO_CLOSE_FACTURADA',
      entityType: 'work_orders',
      entityId: wo.id,
      entityName: `Cierre Automático por Facturación · ${wo.ot_number || 'OT'} - ${wo.title}`,
      details: {
        previousStatus: wo.status,
        nextStatus: 'Facturada',
        activeItemsCount: activeItems.length,
        reason: reason || 'Todas las subtareas activas quedaron en estado Facturado'
      },
      sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
      user: user?.email || 'Supervisor'
    })

    return { synced: true, nextStatus: 'Facturada', closed: true }
  }

  // Caso 2: Al menos una subtarea NO está facturada y la cabecera estaba Facturada/Completada/Cerrada -> Destrabar
  const wasClosedHeader =
    wo.status === 'Facturada' ||
    wo.status === 'Completada' ||
    Boolean(wo.closed_at)

  if (wasClosedHeader) {
    const nextWoStatus = allPendingStart ? 'Pendiente' : 'En Progreso'
    const { error: reopenErr } = await supabase
      .from('work_orders')
      .update({
        status: nextWoStatus,
        closed_at: null,
        allow_post_billing_costs: false
      })
      .in('id', targetWoIds)

    if (reopenErr) throw reopenErr

    await auditService.logRowAction({
      action: 'AUTO_REOPEN_FROM_ITEM',
      entityType: 'work_orders',
      entityId: wo.id,
      entityName: `Reapertura Automática · ${wo.ot_number || 'OT'} - ${wo.title}`,
      details: {
        previousStatus: wo.status,
        previousClosedAt: wo.closed_at || null,
        nextStatus: nextWoStatus,
        activeItemsCount: activeItems.length,
        reason: reason || 'Subtarea editada/reactivada a estado no facturado'
      },
      sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
      user: user?.email || 'Supervisor'
    })

    return { synced: true, nextStatus: nextWoStatus, closed: false }
  }

  // Caso 3: Cabecera estaba en 'Pendiente' pero ya tiene tareas operativas en marcha
  if (wo.status === 'Pendiente' && !allPendingStart && hasOperationalItem) {
    const { error: progErr } = await supabase
      .from('work_orders')
      .update({ status: 'En Progreso' })
      .in('id', targetWoIds)
    if (progErr) throw progErr
    return { synced: true, nextStatus: 'En Progreso', closed: false }
  }

  return { synced: false, state: 'already_consistent' }
}

/**
 * Duplica una fila de trabajo y sincroniza inmediatamente la cabecera de su OT.
 */
export async function duplicateWorkItemWithSyncService(row, user) {
  await duplicateRecord({
    table: 'work_items',
    entityType: 'work_orders',
    source: row,
    fields: WORK_ITEM_CLONE_FIELDS,
    overrides: { updated_at: new Date().toISOString() },
    nameOf: (r) => `${row.wo?.ot_number || 'OT'} · ${r.description || ''}`,
    user: user?.email
  })
  const woId = row.work_order_id || row.wo?.id
  if (woId) {
    await syncWorkOrderHeaderStatusService({
      workOrderId: woId,
      user,
      reason: 'Duplicación de trabajo en OT'
    })
  }
}
