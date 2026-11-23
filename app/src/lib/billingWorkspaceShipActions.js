/**
 * billingWorkspaceShipActions.js
 * Acciones de barco en la Mesa de Facturación + filtrado silencioso de OTs excluidas:
 * - Semáforo Amarillo / Verde por barco
 * - Quitar barco del panel izquierdo (sin borrar buque ni OTs)
 * - Sincronización silenciosa de OTs eliminadas/desestimadas + armado de bloques ordenados
 */
import { shipsRepository } from '../repositories/shipsRepository.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { logCellChange, logRowAction } from './auditService.js'
import { EXCLUDED_OT_STATUSES } from './billingMirrorEngine.js'
import { normalizeText } from './tradesCatalog.js'
import { isMergedWorkOrder, isEliminatedWorkOrder } from './workOrderUnificationEngine.js'
import { syncShipRemitoBudgetAlertForMariaService } from './billingRemitoBudgetAlertsService.js'

export function isWorkOrderExcludedFromBilling(wo, workItems = []) {
  if (!wo) return true
  if (isMergedWorkOrder(wo)) return true
  if (isEliminatedWorkOrder(wo, workItems)) return true
  const woStatusNorm = normalizeText(wo.status)
  if (EXCLUDED_OT_STATUSES.has(woStatusNorm)) return true

  const items = Array.isArray(workItems)
    ? workItems.filter((i) => String(i.work_order_id) === String(wo.id))
    : []
  if (items.length > 0 && items.every((i) => EXCLUDED_OT_STATUSES.has(normalizeText(i.status)))) {
    return true
  }
  return false
}

export async function setShipBillingColorService({ ship, color = 'AMARILLO', user = 'Gerencia' }) {
  if (!ship?.id) throw new Error('Buque requerido para cambiar color.')
  const normalizedColor = color === 'VERDE' ? 'VERDE' : 'AMARILLO'
  const nextMeta = { ...(ship.billing_layout_meta || {}), workspaceColor: normalizedColor }
  const { data, error } = await shipsRepository.updateById(
    ship.id,
    { billing_layout_meta: nextMeta },
    { select: '*' }
  )
  if (error) throw new Error(error)

  await logCellChange({
    entityType: 'ships',
    entityId: ship.id,
    entityName: `Mesa Facturación · ${ship.name}`,
    field: 'workspaceColor',
    fieldLabel: 'Estado Visual Remito',
    oldValue: ship.billing_layout_meta?.workspaceColor || 'AMARILLO',
    newValue: normalizedColor,
    sheetName: 'Resumen Gerencial · Mesa de Facturación',
    moduleRoute: '/resumen-gerencial?tab=remito',
    user,
  })
  return data
}

export async function removeShipFromBillingWorkspaceService({ ship, user = 'Gerencia' }) {
  if (!ship?.id) throw new Error('Buque requerido para quitar del panel.')
  const { data, error } = await shipsRepository.updateById(
    ship.id,
    { billing_workspace_status: 'NONE' },
    { select: '*' }
  )
  if (error) throw new Error(error)

  await syncShipRemitoBudgetAlertForMariaService({
    ship: { ...ship, billing_workspace_status: 'NONE' },
    user,
  })

  await logRowAction({
    action: 'BILLING_REMOVE_SHIP',
    entityType: 'ships',
    entityId: ship.id,
    entityName: `Quitar de Mesa Facturación · ${ship.name}`,
    changes: { billing_workspace_status: 'NONE' },
    sheetName: 'Resumen Gerencial · Mesa de Facturación',
    moduleRoute: '/resumen-gerencial?tab=remito',
    user,
  })
  return data
}

export async function syncShipBillingCostsAndOtsService({ ship, shipWos = [], workItems = [], user = 'Gerencia' }) {
  if (!ship?.id) return { cleanedCount: 0 }
  const staleIds = (shipWos || [])
    .filter((w) => w.is_in_billing && isWorkOrderExcludedFromBilling(w, workItems))
    .map((w) => w.id)

  if (staleIds.length > 0) {
    const { error } = await workOrdersRepository.updateByIds(
      staleIds,
      { is_in_billing: false },
      { select: null }
    )
    if (error) throw new Error(error)

    await logRowAction({
      action: 'BILLING_SYNC_CLEAN_EXCLUDED_OTS',
      entityType: 'work_orders',
      entityId: ship.id,
      entityName: `${ship.name} · Sincronización Remito`,
      changes: { removedIds: staleIds, count: staleIds.length },
      sheetName: 'Resumen Gerencial · Mesa de Facturación',
      moduleRoute: '/resumen-gerencial?tab=remito',
      user,
    })
  }
  return { cleanedCount: staleIds.length }
}

export function buildOrderedBillingBlocks({ activeShip, activeShipWos = [], workItems = [], newBlockAutoFocusId = null }) {
  if (!activeShip) return []
  const layoutMeta = activeShip.billing_layout_meta || {}
  const customBlocks = Array.isArray(layoutMeta.customBlocks) ? layoutMeta.customBlocks : []
  const fontSizes = layoutMeta.fontSizes || {}
  const woBlocks = activeShipWos
    .filter((w) => w.is_in_billing && !isWorkOrderExcludedFromBilling(w, workItems))
    .map((w) => ({
      id: `wo_${w.id}`,
      workOrderId: w.id,
      blockType: 'WORK_ORDER',
      sortOrder: Number(w.billing_sort_order) || 1000,
      billing_description: w.billing_description || '',
      billing_rubro_group: w.billing_rubro_group || '',
      billing_pricing_mode: w.billing_pricing_mode || 'MO_MAT',
      billing_mo_usd: Number(w.billing_mo_usd) || 0,
      billing_mat_usd: Number(w.billing_mat_usd) || 0,
      billing_unit_price_usd: Number(w.billing_unit_price_usd) || 0,
      billing_qty_override: w.billing_qty_override ?? null,
      billing_mo_tax: w.billing_mo_tax || 'EXENTO',
      billing_mat_tax: w.billing_mat_tax || 'EXENTO',
      fontSizePx: fontSizes[w.id] || 12,
    }))
  return [
    ...woBlocks,
    ...customBlocks.map((cb) => ({
      ...cb,
      sortOrder: Number(cb.sortOrder) || 1000,
      autoFocus: cb.id === newBlockAutoFocusId,
    })),
  ].sort((a, b) => a.sortOrder - b.sortOrder)
}
