/**
 * billingWorkflowService.js
 * Capa de servicio y persistencia (100% vía Repositorios + Zod + auditService) para:
 * - Mesa Independiente Multi-Barco (`ships.billing_workspace_status`: EN_PREPARACION -> ENVIADO_A_FACTURACION)
 * - Importación en Modo Fantasma hacia columnas comerciales de `work_orders`
 * - Re-exporta circuito de Ampliación (`billingExpansionService.js`).
 */

import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { shipsRepository } from '../repositories/shipsRepository.js'
import { isInvalidEventOrObjectScalar, logCellChange, logRowAction } from './auditService.js'
import { buildInitialGhostProse, inferOtChapterDeterministic } from './billingMirrorEngine.js'

export {
  requestBillingExpansionService,
  resolveBillingExpansionService,
  acknowledgeResolvedExpansionService,
  fetchBillingExpansionAlertsService
} from './billingExpansionService.js'

export async function openShipInBillingWorkspaceService({ ship, user = 'Gerencia' }) {
  if (!ship?.id) throw new Error('Buque requerido para abrir proyecto de facturación.')
  const nowIso = new Date().toISOString()
  const patch = {
    billing_workspace_status: 'EN_PREPARACION',
    billing_opened_at: ship.billing_opened_at || nowIso
  }
  const { data, error } = await shipsRepository.updateById(ship.id, patch, { select: '*' })
  if (error) throw new Error(error)

  await logRowAction({
    action: 'BILLING_OPEN_SHIP',
    entityType: 'ships',
    entityId: ship.id,
    entityName: `Mesa Facturación · ${ship.name}`,
    changes: patch,
    sheetName: 'Resumen Gerencial · Mesa de Facturación',
    moduleRoute: '/resumen-gerencial?tab=remito',
    user
  })
  return data
}

export async function sendShipToFinalBillingService({ ship, totalSnapshotUsd = 0, budgetNumber = '', user = 'Gerencia' }) {
  if (!ship?.id) throw new Error('Buque requerido para enviar a facturación.')
  const nowIso = new Date().toISOString()
  const patch = {
    billing_workspace_status: 'ENVIADO_A_FACTURACION',
    billing_sent_at: nowIso,
    billing_sent_by: String(user || 'Gerencia'),
    billing_total_snapshot_usd: Number(totalSnapshotUsd) || 0,
    ...(budgetNumber ? { billing_budget_number: String(budgetNumber).trim() } : {})
  }
  const { data, error } = await shipsRepository.updateById(ship.id, patch, { select: '*' })
  if (error) throw new Error(error)

  await logRowAction({
    action: 'BILLING_SEND_SHIP_READY',
    entityType: 'ships',
    entityId: ship.id,
    entityName: `Enviado a Facturación · ${ship.name}`,
    changes: patch,
    sheetName: 'Resumen Gerencial · Mesa de Facturación',
    moduleRoute: '/resumen-gerencial?tab=remito',
    user
  })
  return data
}

export async function saveShipBillingLayoutMetaService({ shipId, shipName, layoutMeta, budgetNumber, user = 'Gerencia' }) {
  if (!shipId) throw new Error('shipId requerido.')
  const patch = {
    billing_layout_meta: layoutMeta || {},
    ...(budgetNumber !== undefined ? { billing_budget_number: String(budgetNumber || '').trim() || null } : {})
  }
  const { data, error } = await shipsRepository.updateById(shipId, patch, { select: '*' })
  if (error) throw new Error(error)

  await logRowAction({
    action: 'BILLING_LAYOUT_UPDATE',
    entityType: 'ships',
    entityId: shipId,
    entityName: `Hoja Facturación · ${shipName || shipId}`,
    changes: { budgetNumber: patch.billing_budget_number, customBlocks: (layoutMeta?.customBlocks || []).length },
    sheetName: 'Resumen Gerencial · Mesa de Facturación',
    moduleRoute: '/resumen-gerencial?tab=remito',
    user
  })
  return data
}

export async function importShipWorkOrdersGhostService({ ship, readyToImport = [], user = 'Gerencia' }) {
  if (!ship?.id) throw new Error('Buque requerido.')
  if (ship.billing_workspace_status !== 'EN_PREPARACION') {
    await openShipInBillingWorkspaceService({ ship, user })
  }

  let importedCount = 0
  for (const item of readyToImport) {
    const { error } = await workOrdersRepository.updateById(item.workOrderId, item.patch, { select: null })
    if (error) throw new Error(`Error importando ${item.wo?.ot_number || item.workOrderId}: ${error}`)
    importedCount += 1
  }

  if (importedCount > 0) {
    await logRowAction({
      action: 'BILLING_GHOST_IMPORT_BATCH',
      entityType: 'work_orders',
      entityId: ship.id,
      entityName: `${ship.name} · Importación Fantasma (${importedCount} OTs)`,
      changes: { importedIds: readyToImport.map((r) => r.workOrderId), count: importedCount },
      sheetName: 'Resumen Gerencial · Mesa de Facturación',
      moduleRoute: '/resumen-gerencial?tab=remito',
      user
    })
  }
  return { importedCount }
}

export async function sendSingleOtToBillingService({
  ship, wo, woItems = [], laborRows = [], materialRows = [], thirdPartyRows = [], workers = [], otTemplates = [], nextSortOrder = 10, user = 'Gerencia'
}) {
  if (!ship?.id || !wo?.id) throw new Error('Buque y Orden de Trabajo requeridos.')
  if (ship.billing_workspace_status !== 'EN_PREPARACION') {
    await openShipInBillingWorkspaceService({ ship, user })
  }

  const alreadyHasBilling = Boolean(wo.is_in_billing) || (wo.billing_description != null && String(wo.billing_description).length > 0)
  if (alreadyHasBilling) {
    if (!wo.is_in_billing) await workOrdersRepository.updateById(wo.id, { is_in_billing: true }, { select: null })
    return { alreadyImported: true, woId: wo.id }
  }

  const ghost = buildInitialGhostProse(wo, woItems)
  const fallbackProse = `<b>${String(wo.title || 'TRABAJO').toUpperCase()}</b>`
  const classification = inferOtChapterDeterministic({
    wo, woItems, laborRows, materialRows, thirdPartyRows, workers, otTemplates
  })

  const patch = {
    is_in_billing: true,
    billing_description: ghost.hasEmpty ? fallbackProse : ghost.prose,
    billing_rubro_group: classification.chapterKey,
    billing_pricing_mode: classification.defaultPricingMode,
    billing_unit_price_usd: classification.defaultUnitPriceUsd,
    billing_mo_tax: classification.defaultTaxType,
    billing_mat_tax: classification.defaultTaxType,
    billing_sort_order: nextSortOrder
  }

  const { error } = await workOrdersRepository.updateById(wo.id, patch, { select: null })
  if (error) throw new Error(error)

  await logRowAction({
    action: 'BILLING_ADD_SINGLE_OT',
    entityType: 'work_orders',
    entityId: wo.id,
    entityName: `${ship.name} · ${wo.ot_number || 'OT'} ${wo.title || ''}`,
    changes: patch,
    sheetName: 'Resumen Gerencial · Mesa de Facturación',
    moduleRoute: '/resumen-gerencial?tab=remito',
    user
  })
  return { alreadyImported: false, woId: wo.id }
}

export async function saveWorkOrderBillingPatchService({
  woId, shipName, otLabel, patch, field, oldValue, newValue, user = 'Gerencia'
}) {
  if (!woId) throw new Error('woId requerido.')
  if (field && isInvalidEventOrObjectScalar(newValue)) {
    throw new Error('Valor inválido bloqueado antes de persistir (Event/Object).')
  }

  const { data, error } = await workOrdersRepository.updateById(woId, patch, { select: '*' })
  if (error) throw new Error(error)

  if (field) {
    await logCellChange({
      entityType: 'work_orders',
      entityId: woId,
      entityName: `${shipName || 'Buque'} · ${otLabel || woId}`,
      field,
      fieldLabel: field,
      oldValue,
      newValue,
      sheetName: 'Resumen Gerencial · Mesa de Facturación',
      moduleRoute: '/resumen-gerencial?tab=remito',
      user
    })
  }
  return data
}

export async function saveWorkOrderBillingOrderBatchService({ updates = [], shipName = '', user = 'Gerencia' }) {
  for (const upd of updates) {
    if (!upd?.id) continue
    const { error } = await workOrdersRepository.updateById(upd.id, upd.patch, { select: null })
    if (error) throw new Error(error)
  }
  if (updates.length > 0) {
    await logRowAction({
      action: 'BILLING_REORDER_BLOCKS',
      entityType: 'work_orders',
      entityId: updates[0].id,
      entityName: `${shipName || 'Buque'} · Reordenamiento (${updates.length} OTs)`,
      changes: { count: updates.length },
      sheetName: 'Resumen Gerencial · Mesa de Facturación',
      moduleRoute: '/resumen-gerencial?tab=remito',
      user
    })
  }
}
