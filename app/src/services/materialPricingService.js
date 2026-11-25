/**
 * materialPricingService.js
 * Capa de servicio y persistencia para Política Quincenal de Precios de Materiales:
 * lectura/guardado en `system_settings`, propagación desde quincena en curso y sellado histórico.
 */
import { logRowAction } from '../lib/auditService.js'
import { computeMaterialCostUsd } from '../lib/unitMeasureUtils.js'
import { getTodayArIso } from '../lib/dateTimeCanonical.js'
import {
  MATERIAL_PRICING_POLICY_KEY,
  DEFAULT_MATERIAL_PRICING_POLICY,
  normalizeMaterialPricingPolicy,
  getFortnightPeriodKey,
  compareFortnightKeys,
  resolveDollarRateForFortnight,
  computeFortnightUnitSnapshot,
  shouldPropagateCatalogPriceToTx
} from '../lib/materialPricingPolicy.js'
import { systemSettingsRepository } from '../repositories/systemSettingsRepository.js'
import { macroVariablesRepository } from '../repositories/macroVariablesRepository.js'
import { inventoryTransactionsRepository } from '../repositories/inventoryTransactionsRepository.js'
import { materialsRepository } from '../repositories/materialsRepository.js'

export async function fetchMaterialPricingPolicyService() {
  try {
    const { data, error } = await systemSettingsRepository.getByKey(MATERIAL_PRICING_POLICY_KEY)
    if (error || !data) {
      return { policy: { ...DEFAULT_MATERIAL_PRICING_POLICY }, updatedAt: null, updatedBy: null, isDefault: true }
    }
    return {
      policy: normalizeMaterialPricingPolicy(data.value),
      updatedAt: data.updated_at || null,
      updatedBy: data.updated_by || null,
      isDefault: false
    }
  } catch {
    return { policy: { ...DEFAULT_MATERIAL_PRICING_POLICY }, updatedAt: null, updatedBy: null, isDefault: true }
  }
}

export async function saveMaterialPricingPolicyService({ policy, updatedBy = 'Administrador', user = null }) {
  const normalized = normalizeMaterialPricingPolicy(policy)
  const actor = String(updatedBy || user?.email || 'Administrador')
  const { data, error } = await systemSettingsRepository.saveByKey(MATERIAL_PRICING_POLICY_KEY, normalized, { updatedBy: actor })
  if (error) throw new Error(error)

  logRowAction({
    action: 'MODAL_SAVE',
    entityType: 'system_settings',
    entityId: MATERIAL_PRICING_POLICY_KEY,
    entityName: 'Regla de Precios y Costos de Materiales',
    rowData: normalized,
    sheetName: 'Admin · Variables Macro & Cierre',
    moduleRoute: '/admin',
    changeOrigin: 'ADMIN_PRICING_POLICY',
    user: user?.email || actor
  })

  return {
    policy: normalized,
    updatedAt: data?.updated_at || new Date().toISOString(),
    updatedBy: data?.updated_by || actor,
    isDefault: false
  }
}

export async function propagateCatalogPriceUpdateToTransactions({
  materialId,
  costArs,
  securityFactor = 1.06,
  costUsdOverride = null,
  macroVariables = null,
  policy = null,
  todayIso = getTodayArIso()
}) {
  const currentPeriod = getFortnightPeriodKey(todayIso)
  if (!materialId) return { updatedCount: 0, skippedLockedCount: 0, skippedHistoricalCount: 0, currentPeriod }

  const [policyRes, macroRes, txRes] = await Promise.all([
    policy ? Promise.resolve({ policy: normalizeMaterialPricingPolicy(policy) }) : fetchMaterialPricingPolicyService(),
    Array.isArray(macroVariables) && macroVariables.length > 0
      ? Promise.resolve({ data: macroVariables })
      : macroVariablesRepository.listMacroVariables(),
    inventoryTransactionsRepository.listTransactions({ filters: { material_id: materialId }, limit: 1500 })
  ])

  const activePolicy = normalizeMaterialPricingPolicy(policyRes?.policy)
  const macroList = macroRes?.data || []
  let updatedCount = 0
  let skippedLockedCount = 0
  let skippedHistoricalCount = 0

  for (const tx of txRes?.data || []) {
    const decision = shouldPropagateCatalogPriceToTx({ tx, currentPeriod, macroVariables: macroList, policy: activePolicy })
    if (!decision.eligible) {
      if (decision.reason === 'LOCKED_FORTNIGHT') skippedLockedCount++
      else if (decision.reason === 'HISTORICAL_LOCKED') skippedHistoricalCount++
      continue
    }

    const fxRate = resolveDollarRateForFortnight(tx.transaction_date || todayIso, macroList)
    const nextArs = Math.max(0, Number(costArs) || 0)
    const nextUsd = nextArs > 0
      ? computeMaterialCostUsd(nextArs, Number(securityFactor) || activePolicy.defaultSecurityFactor, fxRate)
      : Math.max(0, Number(costUsdOverride) || 0)

    if (
      Math.abs((Number(tx.unit_cost_ars_snapshot) || 0) - nextArs) < 0.005 &&
      Math.abs((Number(tx.unit_cost_usd_snapshot) || 0) - nextUsd) < 0.005
    ) {
      continue
    }

    const { error } = await inventoryTransactionsRepository.updateById(
      tx.id,
      { unit_cost_ars_snapshot: nextArs, unit_cost_usd_snapshot: nextUsd },
      { select: null }
    )
    if (!error) updatedCount++
  }

  return { updatedCount, skippedLockedCount, skippedHistoricalCount, currentPeriod }
}

export async function countPendingHistoricalSnapshotsService({ todayIso = getTodayArIso() } = {}) {
  const [matsRes, txRes] = await Promise.all([
    materialsRepository.listMaterials({ select: 'id, cost_ars, cost_usd' }),
    inventoryTransactionsRepository.listTransactions({
      select: 'id, material_id, transaction_date, unit_cost_usd_snapshot, is_deletion_requested',
      limit: 3000
    })
  ])
  const matMap = new Map((matsRes?.data || []).map((m) => [m.id, m]))
  const currentPeriod = getFortnightPeriodKey(todayIso)
  let pendingCount = 0
  for (const tx of txRes?.data || []) {
    if (!tx?.material_id || tx.is_deletion_requested || Number(tx.unit_cost_usd_snapshot || 0) > 0) continue
    const txPeriod = getFortnightPeriodKey(tx.transaction_date)
    if (!txPeriod || !currentPeriod || compareFortnightKeys(txPeriod, currentPeriod) >= 0) continue
    const mat = matMap.get(tx.material_id)
    if (mat && ((Number(mat.cost_ars) || 0) > 0 || (Number(mat.cost_usd) || 0) > 0)) pendingCount++
  }
  return { pendingCount, currentPeriod }
}

export async function sealPendingHistoricalFortnightSnapshotsService({ todayIso = getTodayArIso(), user = null } = {}) {
  const [macroRes, matsRes, txRes] = await Promise.all([
    macroVariablesRepository.listMacroVariables(),
    materialsRepository.listMaterials(),
    inventoryTransactionsRepository.listTransactions({ limit: 3000 })
  ])
  if (macroRes.error) throw new Error(macroRes.error)
  if (matsRes.error) throw new Error(matsRes.error)
  if (txRes.error) throw new Error(txRes.error)

  const macroList = macroRes.data || []
  const matMap = new Map((matsRes.data || []).map((m) => [m.id, m]))
  const currentPeriod = getFortnightPeriodKey(todayIso)
  let sealedCount = 0
  let skippedZeroPrice = 0

  for (const tx of txRes.data || []) {
    if (!tx?.id || !tx.material_id || tx.is_deletion_requested || Number(tx.unit_cost_usd_snapshot || 0) > 0) continue
    const txPeriod = getFortnightPeriodKey(tx.transaction_date)
    if (!txPeriod || !currentPeriod || compareFortnightKeys(txPeriod, currentPeriod) >= 0) continue

    const mat = matMap.get(tx.material_id)
    if (!mat) continue
    const snap = computeFortnightUnitSnapshot({ material: mat, transactionDate: tx.transaction_date, macroVariables: macroList })
    if (snap.unit_cost_usd_snapshot <= 0) { skippedZeroPrice++; continue }

    const { error } = await inventoryTransactionsRepository.updateById(
      tx.id,
      { unit_cost_ars_snapshot: snap.unit_cost_ars_snapshot, unit_cost_usd_snapshot: snap.unit_cost_usd_snapshot },
      { select: null }
    )
    if (!error) sealedCount++
  }

  if (sealedCount > 0) {
    logRowAction({
      action: 'BATCH_UPDATE',
      entityType: 'inventory_transactions',
      entityId: `seal_before_${currentPeriod}`,
      entityName: `Sellado histórico quincenal (< ${currentPeriod}): ${sealedCount} retiros`,
      rowData: { sealedCount, skippedZeroPrice, currentPeriod },
      sheetName: 'Admin · Variables Macro & Cierre',
      moduleRoute: '/admin',
      changeOrigin: 'ADMIN_SEAL_FORTNIGHT_SNAPSHOTS',
      user: user?.email || 'Administrador'
    })
  }
  return { sealedCount, skippedZeroPrice, currentPeriod }
}
