/**
 * materialPricingPolicy.js
 * Reglas puras (sin Supabase) de Política de Precios y Congelamiento Quincenal de Materiales.
 */
import { computeMaterialCostUsd } from './unitMeasureUtils.js'
import { getDollarRateForDate } from './comprasPedidosHelpers.js'
import { getTodayArIso, toArIsoDate } from './dateTimeCanonical.js'

export const MATERIAL_PRICING_POLICY_KEY = 'material_pricing_policy'

export const DEFAULT_MATERIAL_PRICING_POLICY = {
  mode: 'FORTNIGHT_LOCKED',
  propagatePriceToCurrentFortnight: true,
  fillHistoricalZeroCostOnCatalogUpdate: true,
  respectLockedFortnights: true,
  defaultSecurityFactor: 1.06,
  highValueThresholdUsd: 4000,
  highValueSecurityFactor: 1.02,
  ruleSummaryText:
    'Los precios y el dólar quedan congelados por quincena. Si cambia el dólar o subís el precio de un material en el Catálogo, el nuevo valor aplica únicamente desde la quincena en curso en adelante, sin alterar costos históricos ni obras ya facturadas.'
}

export function normalizeMaterialPricingPolicy(raw = null) {
  const src = raw && typeof raw === 'object' ? raw : {}
  const defSec = Number(src.defaultSecurityFactor)
  const hiSec = Number(src.highValueSecurityFactor)
  const hiThr = Number(src.highValueThresholdUsd)
  const text = String(src.ruleSummaryText || '').trim()
  return {
    mode: src.mode === 'LIVE_CATALOG' ? 'LIVE_CATALOG' : 'FORTNIGHT_LOCKED',
    propagatePriceToCurrentFortnight: src.propagatePriceToCurrentFortnight !== false,
    fillHistoricalZeroCostOnCatalogUpdate: src.fillHistoricalZeroCostOnCatalogUpdate !== false,
    respectLockedFortnights: src.respectLockedFortnights !== false,
    defaultSecurityFactor: Number.isFinite(defSec) && defSec >= 1 ? defSec : DEFAULT_MATERIAL_PRICING_POLICY.defaultSecurityFactor,
    highValueThresholdUsd: Number.isFinite(hiThr) && hiThr > 0 ? hiThr : DEFAULT_MATERIAL_PRICING_POLICY.highValueThresholdUsd,
    highValueSecurityFactor: Number.isFinite(hiSec) && hiSec >= 1 ? hiSec : DEFAULT_MATERIAL_PRICING_POLICY.highValueSecurityFactor,
    ruleSummaryText: text || DEFAULT_MATERIAL_PRICING_POLICY.ruleSummaryText
  }
}

export function getFortnightPeriodKey(dateInput) {
  const iso = toArIsoDate(dateInput)
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  return `${iso.slice(0, 7)}-${Number(iso.slice(8, 10)) <= 15 ? '1Q' : '2Q'}`
}

export function compareFortnightKeys(periodA, periodB) {
  if (!periodA && !periodB) return 0
  if (!periodA) return -1
  if (!periodB) return 1
  return String(periodA).localeCompare(String(periodB))
}

export function isFortnightLockedInMacro(periodKey, macroVariables = []) {
  if (!periodKey || !Array.isArray(macroVariables) || macroVariables.length === 0) return false
  const m = String(periodKey).match(/^(\d{4})-(\d{2})-(1Q|2Q)$/)
  if (!m) return false
  const row = macroVariables.find((v) => Number(v.year) === Number(m[1]) && Number(v.month) === Number(m[2]))
  return row ? (m[3] === '1Q' ? Boolean(row.is_locked_1q) : Boolean(row.is_locked_2q)) : false
}

export function resolveDollarRateForFortnight(dateInput, macroVariables = [], fallbackRate = 1500) {
  const iso = toArIsoDate(dateInput) || getTodayArIso()
  if (Array.isArray(macroVariables) && macroVariables.length > 0) {
    const rate = getDollarRateForDate(iso, macroVariables)
    if (Number.isFinite(rate) && rate > 0) return rate
  }
  return Number(fallbackRate) > 0 ? Number(fallbackRate) : 1500
}

export function computeFortnightUnitSnapshot({
  material,
  transactionDate,
  macroVariables = [],
  policy = DEFAULT_MATERIAL_PRICING_POLICY,
  fallbackRate = 1500
}) {
  const periodKey = getFortnightPeriodKey(transactionDate || getTodayArIso())
  const dollarRate = resolveDollarRateForFortnight(transactionDate || getTodayArIso(), macroVariables, fallbackRate)
  if (!material) return { unit_cost_ars_snapshot: 0, unit_cost_usd_snapshot: 0, dollarRate, periodKey }
  const norm = normalizeMaterialPricingPolicy(policy)
  const costArs = Math.max(0, Number(material.cost_ars) || 0)
  const secFactor = Number(material.security_factor) > 0 ? Number(material.security_factor) : norm.defaultSecurityFactor
  const unitUsd = costArs > 0
    ? computeMaterialCostUsd(costArs, secFactor, dollarRate)
    : Math.max(0, Number(material.cost_usd) || 0)
  return { unit_cost_ars_snapshot: costArs, unit_cost_usd_snapshot: unitUsd, dollarRate, periodKey }
}

/**
 * Calcula el parche consistente `{ cost_ars, cost_usd, last_price_update }` al editar precio o % seguridad inline.
 */
export function buildInlineMaterialPricePatch({ field, parsedValue, material, dollarRate = 1500, policy = DEFAULT_MATERIAL_PRICING_POLICY }) {
  const fx = Number(dollarRate) > 0 ? Number(dollarRate) : 1500
  const norm = normalizeMaterialPricingPolicy(policy)
  const sec = field === 'security_factor'
    ? (Number(parsedValue) || norm.defaultSecurityFactor)
    : (Number(material?.security_factor) || norm.defaultSecurityFactor)

  const patch = { [field]: parsedValue, last_price_update: new Date().toISOString() }
  if (field === 'cost_ars' || field === 'security_factor') {
    const ars = field === 'cost_ars' ? parsedValue : Math.max(0, Number(material?.cost_ars) || 0)
    patch.cost_usd = computeMaterialCostUsd(ars, sec, fx)
  } else if (field === 'cost_usd') {
    patch.cost_ars = fx > 0 && sec > 0 ? Math.round((parsedValue * fx) / sec) : Math.max(0, Number(material?.cost_ars) || 0)
  }
  const effectiveUsd = Number(patch.cost_usd ?? material?.cost_usd ?? 0)
  const highValueWarning = effectiveUsd > norm.highValueThresholdUsd && Math.abs(sec - norm.highValueSecurityFactor) > 0.005
  return { patch, highValueWarning }
}

/**
 * Decide si un retiro histórico/actual debe actualizarse al cambiar el precio en Catálogo.
 */
export function shouldPropagateCatalogPriceToTx({ tx, currentPeriod, macroVariables = [], policy = DEFAULT_MATERIAL_PRICING_POLICY }) {
  if (!tx?.id || tx.is_deletion_requested) return { eligible: false, reason: 'SKIP' }
  const active = normalizeMaterialPricingPolicy(policy)
  const txPeriod = getFortnightPeriodKey(tx.transaction_date)
  if (active.respectLockedFortnights && isFortnightLockedInMacro(txPeriod, macroVariables)) {
    return { eligible: false, reason: 'LOCKED_FORTNIGHT' }
  }
  if (active.mode === 'LIVE_CATALOG') return { eligible: true, reason: 'LIVE_CATALOG' }

  const isCurrentOrFuture = !txPeriod || !currentPeriod || compareFortnightKeys(txPeriod, currentPeriod) >= 0
  if (isCurrentOrFuture) {
    return { eligible: Boolean(active.propagatePriceToCurrentFortnight), reason: 'CURRENT_OR_FUTURE' }
  }
  const isHistoricalZero = Number(tx.unit_cost_usd_snapshot || 0) <= 0
  if (isHistoricalZero && active.fillHistoricalZeroCostOnCatalogUpdate) {
    return { eligible: true, reason: 'HISTORICAL_ZERO' }
  }
  return { eligible: false, reason: 'HISTORICAL_LOCKED' }
}
