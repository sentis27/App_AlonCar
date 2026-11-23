/**
 * billingWorkflowService.js
 * Persistencia (100% vía Repositorios + Zod + auditService) para Mesa Independiente Multi-Barco
 * e importación en Modo Fantasma en orden PDF con delimitadores automáticos y modo `ITEMS`.
 */
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { shipsRepository } from '../repositories/shipsRepository.js'
import { isInvalidEventOrObjectScalar, logCellChange, logRowAction } from './auditService.js'
import { buildInitialGhostProse, inferOtChapterDeterministic, matchOtToAbcTemplate } from './billingMirrorEngine.js'
import { buildOrderedImportWithDelimiters } from './billingImportOrderEngine.js'
import { syncShipRemitoBudgetAlertForMariaService } from './billingRemitoBudgetAlertsService.js'

export {
  requestBillingExpansionService, resolveBillingExpansionService,
  acknowledgeResolvedExpansionService, fetchBillingExpansionAlertsService
} from './billingExpansionService.js'
export {
  syncShipRemitoBudgetAlertForMariaService, fetchPendingShipRemitoBudgetAlertsForMariaService,
  resolveShipRemitoBudgetAlertService
} from './billingRemitoBudgetAlertsService.js'
export {
  isWorkOrderExcludedFromBilling, setShipBillingColorService, removeShipFromBillingWorkspaceService,
  syncShipBillingCostsAndOtsService, buildOrderedBillingBlocks
} from './billingWorkspaceShipActions.js'

const SHEET = 'Resumen Gerencial · Mesa de Facturación'
const ROUTE = '/resumen-gerencial?tab=remito'

export async function openShipInBillingWorkspaceService({ ship, user = 'Gerencia' }) {
  if (!ship?.id) throw new Error('Buque requerido para abrir proyecto de facturación.')
  const nowIso = new Date().toISOString()
  const existingMeta = ship.billing_layout_meta || {}
  const patch = {
    billing_workspace_status: 'EN_PREPARACION',
    billing_opened_at: ship.billing_opened_at || nowIso,
    billing_layout_meta: { ...existingMeta, workspaceColor: existingMeta.workspaceColor || 'AMARILLO' }
  }
  const { data, error } = await shipsRepository.updateById(ship.id, patch, { select: '*' })
  if (error) throw new Error(error)
  await syncShipRemitoBudgetAlertForMariaService({ ship: data || { ...ship, ...patch }, user })
  await logRowAction({
    action: 'BILLING_OPEN_SHIP', entityType: 'ships', entityId: ship.id,
    entityName: `Mesa Facturación · ${ship.name}`, changes: patch, sheetName: SHEET, moduleRoute: ROUTE, user
  })
  return data
}

export async function sendShipToFinalBillingService({ ship, totalSnapshotUsd = 0, budgetNumber = '', archivedPdfEntry = null, user = 'Gerencia' }) {
  if (!ship?.id) throw new Error('Buque requerido para enviar a facturación.')
  const nowIso = new Date().toISOString()
  const prevMeta = ship.billing_layout_meta || {}
  const prevArchived = Array.isArray(prevMeta.archivedPdfs) ? prevMeta.archivedPdfs : []
  const nextMeta = {
    ...prevMeta, workspaceColor: 'VERDE',
    ...(archivedPdfEntry ? { archivedPdfs: [archivedPdfEntry, ...prevArchived].slice(0, 30) } : {})
  }
  const patch = {
    billing_workspace_status: 'ENVIADO_A_FACTURACION', billing_sent_at: nowIso,
    billing_sent_by: String(user || 'Gerencia'), billing_total_snapshot_usd: Number(totalSnapshotUsd) || 0,
    billing_layout_meta: nextMeta,
    ...(budgetNumber ? { billing_budget_number: String(budgetNumber).trim() } : {})
  }
  const { data, error } = await shipsRepository.updateById(ship.id, patch, { select: '*' })
  if (error) throw new Error(error)
  await syncShipRemitoBudgetAlertForMariaService({ ship: data || { ...ship, ...patch }, user })
  await logRowAction({
    action: 'BILLING_SEND_SHIP_READY', entityType: 'ships', entityId: ship.id,
    entityName: `Enviado a Facturación · ${ship.name}`,
    changes: { totalSnapshotUsd: patch.billing_total_snapshot_usd, budgetNumber: patch.billing_budget_number || null, archivedPdf: archivedPdfEntry?.fileName || null },
    sheetName: SHEET, moduleRoute: ROUTE, user
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
  if (budgetNumber !== undefined && data) await syncShipRemitoBudgetAlertForMariaService({ ship: data, user })
  await logRowAction({
    action: 'BILLING_LAYOUT_UPDATE', entityType: 'ships', entityId: shipId,
    entityName: `Hoja Facturación · ${shipName || shipId}`,
    changes: { budgetNumber: patch.billing_budget_number, customBlocks: (layoutMeta?.customBlocks || []).length },
    sheetName: SHEET, moduleRoute: ROUTE, user
  })
  return data
}

export async function importShipWorkOrdersGhostService({
  ship, readyToImport = [], existingWoOrderUpdates = [], nextCustomBlocks = null, delimitersAdded = 0, user = 'Gerencia'
}) {
  if (!ship?.id) throw new Error('Buque requerido.')
  let currentShip = ship
  if (ship.billing_workspace_status !== 'EN_PREPARACION') {
    currentShip = (await openShipInBillingWorkspaceService({ ship, user })) || ship
  }

  let importedCount = 0
  for (const item of readyToImport) {
    const { error } = await workOrdersRepository.updateById(item.workOrderId, item.patch, { select: null })
    if (error) throw new Error(`Error importando ${item.wo?.ot_number || item.workOrderId}: ${error}`)
    importedCount += 1
  }
  for (const upd of existingWoOrderUpdates || []) {
    if (!upd?.id) continue
    const { error } = await workOrdersRepository.updateById(upd.id, upd.patch, { select: null })
    if (error) throw new Error(error)
  }
  if (Array.isArray(nextCustomBlocks) && (delimitersAdded > 0 || (existingWoOrderUpdates || []).length > 0)) {
    const prevMeta = currentShip.billing_layout_meta || {}
    const { error } = await shipsRepository.updateById(
      ship.id, { billing_layout_meta: { ...prevMeta, customBlocks: nextCustomBlocks } }, { select: null }
    )
    if (error) throw new Error(error)
  }

  if (importedCount > 0) {
    await logRowAction({
      action: 'BILLING_GHOST_IMPORT_BATCH', entityType: 'work_orders', entityId: ship.id,
      entityName: `${ship.name} · Importación Fantasma (${importedCount} OTs)`,
      changes: { importedIds: readyToImport.map((r) => r.workOrderId), count: importedCount, delimitersAdded },
      sheetName: SHEET, moduleRoute: ROUTE, user
    })
  }
  return { importedCount, delimitersAdded }
}

export async function sendSingleOtToBillingService({
  ship, wo, woItems = [], existingShipWos = [], laborRows = [], materialRows = [],
  thirdPartyRows = [], workers = [], otTemplates = [], nextSortOrder = 10, user = 'Gerencia'
}) {
  if (!ship?.id || !wo?.id) throw new Error('Buque y Orden de Trabajo requeridos.')
  let currentShip = ship
  if (ship.billing_workspace_status !== 'EN_PREPARACION') {
    currentShip = (await openShipInBillingWorkspaceService({ ship, user })) || ship
  }

  const alreadyHasBilling = Boolean(wo.is_in_billing) || (wo.billing_description != null && String(wo.billing_description).length > 0)
  if (alreadyHasBilling) {
    if (!wo.is_in_billing) await workOrdersRepository.updateById(wo.id, { is_in_billing: true }, { select: null })
    return { alreadyImported: true, woId: wo.id }
  }

  const classification = inferOtChapterDeterministic({
    wo, woItems, laborRows, materialRows, thirdPartyRows, workers, otTemplates
  })
  const ghost = buildInitialGhostProse(wo, woItems, classification.matchedTemplate)
  const fallbackProse = `<b>${String(wo.title || 'TRABAJO').toUpperCase()}</b>`

  const basePatch = {
    is_in_billing: true,
    billing_description: ghost.hasEmpty ? fallbackProse : ghost.prose,
    billing_rubro_group: classification.chapterKey,
    billing_pricing_mode: classification.defaultPricingMode,
    billing_unit_price_usd: classification.defaultUnitPriceUsd,
    ...(classification.defaultPricingMode === 'UNITARIO' ? { billing_qty_override: 1 } : {}),
    ...(classification.defaultPricingMode === 'ITEMS' ? { billing_line_items: classification.defaultLineItems } : {}),
    billing_mo_tax: classification.defaultTaxType,
    billing_mat_tax: classification.defaultTaxType
  }

  const alreadyInBilling = (existingShipWos || []).filter((w) => w.id !== wo.id && w.is_in_billing)
  const tplByWoId = new Map()
  for (const w of alreadyInBilling) {
    const t = matchOtToAbcTemplate(w, otTemplates)
    if (t) tplByWoId.set(w.id, t)
  }
  const existingCustomBlocks = Array.isArray(currentShip.billing_layout_meta?.customBlocks) ? currentShip.billing_layout_meta.customBlocks : []
  const plan = buildOrderedImportWithDelimiters({
    readyCandidates: [{ workOrderId: wo.id, wo, classification, patch: basePatch }],
    alreadyInBilling, existingCustomBlocks, matchedTemplateByWoId: tplByWoId
  })
  const plannedPatch = plan.readyToImport[0]?.patch || { ...basePatch, billing_sort_order: nextSortOrder }

  const { error } = await workOrdersRepository.updateById(wo.id, plannedPatch, { select: null })
  if (error) throw new Error(error)
  for (const upd of plan.existingWoOrderUpdates) {
    await workOrdersRepository.updateById(upd.id, upd.patch, { select: null })
  }
  if (plan.delimitersAdded > 0 || plan.existingWoOrderUpdates.length > 0) {
    const prevMeta = currentShip.billing_layout_meta || {}
    await shipsRepository.updateById(
      ship.id, { billing_layout_meta: { ...prevMeta, customBlocks: plan.nextCustomBlocks } }, { select: null }
    )
  }

  await logRowAction({
    action: 'BILLING_ADD_SINGLE_OT', entityType: 'work_orders', entityId: wo.id,
    entityName: `${ship.name} · ${wo.ot_number || 'OT'} ${wo.title || ''}`,
    changes: plannedPatch, sheetName: SHEET, moduleRoute: ROUTE, user
  })
  return { alreadyImported: false, woId: wo.id }
}

export async function saveWorkOrderBillingPatchService({
  woId, shipName, otLabel, patch, field, oldValue, newValue, user = 'Gerencia'
}) {
  if (!woId) throw new Error('woId requerido.')
  const allowStructured = field === 'billing_line_items'
  if (field && !allowStructured && isInvalidEventOrObjectScalar(newValue)) {
    throw new Error('Valor inválido bloqueado antes de persistir (Event/Object).')
  }
  const { data, error } = await workOrdersRepository.updateById(woId, patch, { select: '*' })
  if (error) throw new Error(error)
  if (field) {
    await logCellChange({
      entityType: 'work_orders', entityId: woId, entityName: `${shipName || 'Buque'} · ${otLabel || woId}`,
      field, fieldLabel: field, oldValue: allowStructured ? `${(oldValue || []).length} ítems` : oldValue,
      newValue: allowStructured ? `${(newValue || []).length} ítems` : newValue,
      sheetName: SHEET, moduleRoute: ROUTE, user
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
      action: 'BILLING_REORDER_BLOCKS', entityType: 'work_orders', entityId: updates[0].id,
      entityName: `${shipName || 'Buque'} · Reordenamiento (${updates.length} OTs)`,
      changes: { count: updates.length }, sheetName: SHEET, moduleRoute: ROUTE, user
    })
  }
}
