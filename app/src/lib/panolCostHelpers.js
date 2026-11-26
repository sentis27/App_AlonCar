/**
 * panolCostHelpers.js
 * Helpers puros de costo por retiro, detección de retiros sin valor ($0),
 * totales con costo USD y definición de columnas por rol para Planilla de Retiros (M4).
 */
import { computeMaterialCostUsd } from './unitMeasureUtils.js'
import {
  DEFAULT_MATERIAL_PRICING_POLICY,
  getFortnightPeriodKey,
  resolveDollarRateForFortnight
} from './materialPricingPolicy.js'

/**
 * Resuelve el costo efectivo (unitario y total en US$ / AR$) de un retiro de Pañol:
 * - Si la política es `FORTNIGHT_LOCKED` (default) y el retiro posee precio congelado (`unit_cost_usd_snapshot > 0`),
 *   respeta estrictamente ese valor congelado de su quincena.
 * - Si el retiro tiene `snapshot <= 0` o la política es `LIVE_CATALOG`, consulta la matriz maestra Catálogo (`materials`)
 *   aplicando el dólar vigente de la quincena de la fecha del retiro cuando `cost_ars > 0`.
 */
export function resolvePanolTxCost(
  tx,
  mat = null,
  { macroVariables = [], policy = DEFAULT_MATERIAL_PRICING_POLICY } = {}
) {
  const qty = Number(tx?.quantity_withdrawn) || 0
  const snapUsd = Number(tx?.unit_cost_usd_snapshot) || 0
  const snapArs = Number(tx?.unit_cost_ars_snapshot) || 0
  const periodKey = getFortnightPeriodKey(tx?.transaction_date)
  const useLiveOnly = policy?.mode === 'LIVE_CATALOG'

  let unitUsd = 0
  let unitArs = 0
  let source = 'ZERO'

  if (!useLiveOnly && snapUsd > 0) {
    unitUsd = snapUsd
    unitArs = snapArs > 0 ? snapArs : (Number(mat?.cost_ars) || 0)
    source = 'SNAPSHOT'
  } else if (mat) {
    const matArs = Number(mat.cost_ars) || 0
    const matUsd = Number(mat.cost_usd) || 0
    unitArs = matArs
    if (matArs > 0 && Array.isArray(macroVariables) && macroVariables.length > 0) {
      const fx = resolveDollarRateForFortnight(tx?.transaction_date, macroVariables)
      const sec = Number(mat.security_factor) > 0 ? Number(mat.security_factor) : (policy?.defaultSecurityFactor || 1.06)
      unitUsd = computeMaterialCostUsd(matArs, sec, fx)
    } else {
      unitUsd = matUsd
    }
    source = unitUsd > 0 ? 'CATALOG' : 'ZERO'
  } else if (snapUsd > 0) {
    unitUsd = snapUsd
    unitArs = snapArs
    source = 'SNAPSHOT'
  }

  const totalUsd = Number((qty * unitUsd).toFixed(2))
  const totalArs = Number((qty * unitArs).toFixed(2))

  return {
    qty,
    unitUsd: Number(unitUsd.toFixed(2)),
    unitArs: Number(unitArs.toFixed(2)),
    totalUsd,
    totalArs,
    source,
    periodKey,
    isZeroCost: unitUsd <= 0
  }
}

/**
 * Resuelve el peso efectivo (kg) de un retiro de Pañol con paridad 100% frente a Resumen Gerencial:
 * Si `tx.weight_total > 0` lo respeta; de lo contrario calcula `cantidad × mat.weight_kg` desde el Catálogo.
 */
export function resolvePanolTxWeight(tx, mat = null) {
  const stored = Number(tx?.weight_total) || 0
  if (stored > 0) return Number(stored.toFixed(2))
  const qty = Number(tx?.quantity_withdrawn) || 0
  const unitKg = Number(mat?.weight_kg) || 0
  if (qty <= 0 || unitKg <= 0) return 0
  return Number((qty * unitKg).toFixed(2))
}

/**
 * Predicado de filtro "Sin Valor ($0)" en Planilla de Retiros:
 * Incluye cualquier retiro con material asignado cuyo costo efectivo sea <= 0
 * (incluyendo EPP `ELEM.SEGURIDAD`), excluyendo filas en blanco sin material y bajas solicitadas.
 */
export function isPanolWithdrawalUnvalued(tx, mat = null, opts = {}) {
  if (!tx || tx.is_deletion_requested || !tx.material_id) return false
  return resolvePanolTxCost(tx, mat, opts).unitUsd <= 0
}

/**
 * Totales acumulados de Planilla de Retiros (Cantidad, Peso kg, Costo US$ y conteo Sin Valor).
 */
export function calculatePanolTotalsWithCost(filteredTransactions = [], materials = [], opts = {}) {
  const matMap = new Map((materials || []).map((m) => [m.id, m]))
  let totalQty = 0
  let totalKg = 0
  let totalUsd = 0
  let unvaluedCount = 0

  for (const tx of filteredTransactions || []) {
    const mat = matMap.get(tx.material_id) || null
    totalQty += Number(tx.quantity_withdrawn) || 0
    totalKg += resolvePanolTxWeight(tx, mat)
    const cost = resolvePanolTxCost(tx, mat, opts)
    totalUsd += cost.totalUsd
    if (isPanolWithdrawalUnvalued(tx, mat, opts)) unvaluedCount++
  }

  return {
    totalQty,
    totalKg: Number(totalKg.toFixed(2)),
    totalUsd: Number(totalUsd.toFixed(2)),
    unvaluedCount
  }
}

/**
 * Columnas dinámicas para useSpreadsheetGrid en Planilla de Retiros:
 * Orden confirmado: Fecha -> Barco -> OT -> Contratista -> Material -> Cant. -> Peso
 * + (solo Admin) Costo US$ y Centro de Costo + Nº Remito -> Observaciones.
 */
export function getPanolMovimientosColumns(
  isAdmin = false,
  { getCostTotalUsd = null, getWeightTotalKg = null, showCostCenter = true } = {}
) {
  const baseStart = [
    { key: 'transaction_date', label: 'Fecha', readOnly: false },
    { key: 'ship_id', label: 'Barco / Destino', readOnly: false },
    { key: 'work_order_id', label: 'Orden de Trabajo (OT)', readOnly: false },
    { key: 'contractor_name', label: 'Contratista / Grupo', readOnly: false },
    { key: 'material_id', label: 'Material Insumo', readOnly: false },
    { key: 'quantity_withdrawn', label: 'Cant.', isNumeric: true, type: 'number', formatType: 'number', allowFormula: true, readOnly: false },
    {
      key: 'weight_total',
      label: 'Peso (kg)',
      isNumeric: true,
      formatType: 'kg',
      readOnly: !isAdmin,
      ...(typeof getWeightTotalKg === 'function' ? { getValue: getWeightTotalKg } : {})
    }
  ]

  const adminCols = isAdmin
    ? [
        {
          key: 'cost_total_usd',
          label: 'Costo US$',
          isNumeric: true,
          formatType: 'usd',
          readOnly: true,
          ...(typeof getCostTotalUsd === 'function' ? { getValue: getCostTotalUsd } : {})
        },
        ...(showCostCenter ? [{ key: 'cost_center', label: 'Centro de Costo', readOnly: false }] : [])
      ]
    : []

  const baseEnd = [
    { key: 'voucher_number', label: 'Nº Remito', readOnly: false },
    { key: 'notes', label: 'Observaciones', readOnly: false }
  ]

  return [...baseStart, ...adminCols, ...baseEnd]
}

export function getPanolPasteFields(isAdmin = false) {
  const fields = [
    'ship_id',
    'work_order_id',
    'contractor_name',
    'worker_name',
    'worker_id',
    'material_id',
    'quantity_withdrawn',
    'voucher_number',
    'notes'
  ]
  if (isAdmin) fields.push('weight_total', 'cost_center')
  return fields
}
