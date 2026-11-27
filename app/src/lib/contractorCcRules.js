/**
 * contractorCcRules.js
 * Motor lógico puro para Cuenta Corriente & Pagos de Contratistas (Graciela · `/tesoreria?tab=movimientos`).
 * - Calcula saldos DEBE / HABER, pendientes `DEBE_FACTURA` y absorción 1-clic de Pañol sin duplicados.
 */
import { formatCanonicalOtNumberLabel } from './canonicalHelpers.js'
import { formatDateAr } from './dateTimeCanonical.js'
import { formatPrcNumberLabel } from './prcRegistryRules.js'
import { matchesUniversalSearch } from './searchEngine.js'

export const CC_SCOPE_LABELS = {
  HORA: 'Por Hora',
  PRESUPUESTO: 'PRC Presupuesto',
  GENERAL: 'General / Cuenta',
}

export const CC_CATEGORY_META = {
  ADELANTO: { label: 'Adelanto / Anticipo', defaultDirection: 'DEBE', badgeCls: 'bg-amber-950/80 text-amber-300 border-amber-500/50' },
  PAGO_FINAL: { label: 'Pago Final / Saldo', defaultDirection: 'DEBE', badgeCls: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50' },
  RTO_PANOL: { label: 'Retiro Pañol (Mat./EPP)', defaultDirection: 'DEBE', badgeCls: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/50' },
  GASTO_A_CUENTA: { label: 'Gasto a Cuenta (Prov.)', defaultDirection: 'DEBE', badgeCls: 'bg-sky-950/80 text-sky-300 border-sky-500/50' },
  RETENCION: { label: 'Retención / Garantía', defaultDirection: 'DEBE', badgeCls: 'bg-rose-950/80 text-rose-300 border-rose-500/50' },
  BONIFICACION: { label: 'Bonificación / Reconoc.', defaultDirection: 'HABER', badgeCls: 'bg-purple-950/80 text-purple-300 border-purple-500/50' },
  DEVENGADO_QUINCENA: { label: 'Liquidación Quincena', defaultDirection: 'HABER', badgeCls: 'bg-teal-950/80 text-teal-300 border-teal-500/50' },
  DEVENGADO_PRC: { label: 'Certificado PRC', defaultDirection: 'HABER', badgeCls: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/50' },
  AJUSTE: { label: 'Ajuste Contable', defaultDirection: 'DEBE', badgeCls: 'bg-slate-800 text-slate-300 border-slate-600' },
}

export const DEFAULT_DIRECTION_BY_CATEGORY = Object.fromEntries(
  Object.entries(CC_CATEGORY_META).map(([k, v]) => [k, v.defaultDirection])
)

export const CC_PAYMENT_METHOD_LABELS = {
  CHEQUE: 'Cheque',
  ECHEQ: 'eCheq',
  TRANSFERENCIA: 'Transferencia',
  EFECTIVO_ARS: 'Efectivo AR$',
  EFECTIVO_USD: 'Efectivo US$',
  COMPENSACION_PANOL: 'Compensación Pañol',
  OTRO: 'Otro medio',
}

export const CC_INVOICE_STATUS_META = {
  NO_APLICA: { label: 'No aplica', badgeCls: 'bg-slate-800/80 text-slate-400 border-slate-700' },
  DEBE_FACTURA: { label: 'DEBE FACTURA', badgeCls: 'bg-rose-950/90 text-rose-300 border-rose-500/70' },
  CON_FACTURA: { label: 'Con Factura', badgeCls: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/50' },
  SIN_FACTURA: { label: 'Sin Factura', badgeCls: 'bg-amber-950/80 text-amber-300 border-amber-500/50' },
}

export function normalizeContractorKey(value = '') {
  return String(value || '').trim().toUpperCase()
}

export function collectAbsorbedPanolTxIds(movements = []) {
  const absorbed = new Set()
  for (const mv of movements || []) {
    const ids = Array.isArray(mv?.inventory_transaction_ids) ? mv.inventory_transaction_ids : []
    for (const id of ids) {
      if (id) absorbed.add(String(id))
    }
  }
  return absorbed
}

export function buildPendingPanolBatches(deductionsData = null, movements = []) {
  const absorbedTxIds = collectAbsorbedPanolTxIds(movements)
  const summary = Array.isArray(deductionsData?.summaryByContractor) ? deductionsData.summaryByContractor : []
  const batches = []
  let totalPeriodTxCount = 0
  let totalAlreadyAbsorbedCount = 0

  for (const contractor of summary) {
    const allItems = Array.isArray(contractor?.items) ? contractor.items : []
    const pendingItems = []
    let alreadyAbsorbedCount = 0
    let pendingConsumablesArs = 0
    let pendingSafetyArs = 0
    let pendingTotalUsd = 0

    for (const item of allItems) {
      totalPeriodTxCount += 1
      if (item?.id && absorbedTxIds.has(String(item.id))) {
        alreadyAbsorbedCount += 1
        totalAlreadyAbsorbedCount += 1
        continue
      }
      pendingItems.push(item)
      const ars = Number(item?.classification?.deductArs || 0)
      const usd = Number(item?.classification?.deductUsd || 0)
      if (item?.classification?.bucket === 'SAFETY_CONTRACTOR_DEDUCTION') pendingSafetyArs += ars
      else pendingConsumablesArs += ars
      pendingTotalUsd += usd
    }

    batches.push({
      contractorLabel: contractor.contractorLabel,
      pendingItems,
      pendingCount: pendingItems.length,
      alreadyAbsorbedCount,
      totalItemsCount: allItems.length,
      pendingConsumablesArs: Number(pendingConsumablesArs.toFixed(2)),
      pendingSafetyArs: Number(pendingSafetyArs.toFixed(2)),
      pendingTotalArs: Number((pendingConsumablesArs + pendingSafetyArs).toFixed(2)),
      pendingTotalUsd: Number(pendingTotalUsd.toFixed(2)),
      pendingTxIds: pendingItems.map((i) => i.id).filter(Boolean),
      fullyAbsorbed: allItems.length > 0 && pendingItems.length === 0,
    })
  }

  const pendingBatches = batches.filter((b) => b.pendingCount > 0)
  return {
    absorbedTxIds,
    allBatches: batches,
    pendingBatches,
    totalPeriodTxCount,
    totalAlreadyAbsorbedCount,
    pendingContractorsCount: pendingBatches.length,
    pendingTotalArs: Number(pendingBatches.reduce((s, b) => s + b.pendingTotalArs, 0).toFixed(2)),
  }
}

export function enrichContractorCcMovements(movements = [], { ships = [], workOrders = [], prcMaps = null } = {}) {
  const shipMap = new Map((ships || []).map((s) => [s.id, s]))
  const woMap = new Map((workOrders || []).map((w) => [w.id, w]))

  return (movements || []).map((mv) => {
    const wo = mv.work_order_id ? woMap.get(mv.work_order_id) || null : null
    const ship = mv.ship_id ? shipMap.get(mv.ship_id) || null : (wo?.ship_id ? shipMap.get(wo.ship_id) || null : null)
    const prcById = mv.prc_id && prcMaps?.byId ? prcMaps.byId.get(mv.prc_id) : null
    const prcByNum = !prcById && mv.prc_number && prcMaps?.byNumber ? prcMaps.byNumber.get(Number(mv.prc_number)) : null
    const prcRecord = prcById || prcByNum || null
    const prcAdditionals = prcRecord && prcMaps?.additionalsByParentId
      ? (prcMaps.additionalsByParentId.get(prcRecord.id) || [])
      : []

    const amountArs = Number(mv.amount_ars || 0)
    const isHaber = mv.direction === 'HABER'
    const catMeta = CC_CATEGORY_META[mv.category] || CC_CATEGORY_META.AJUSTE
    const invMeta = CC_INVOICE_STATUS_META[mv.invoice_status] || CC_INVOICE_STATUS_META.NO_APLICA

    return {
      ...mv,
      amount_ars: amountArs,
      debeArs: isHaber ? 0 : amountArs,
      haberArs: isHaber ? amountArs : 0,
      signedAmountArs: isHaber ? amountArs : -amountArs,
      shipRecord: ship,
      shipName: ship?.name || (mv.settlement_scope === 'GENERAL' ? 'Cuenta General' : '—'),
      workOrder: wo,
      otLabel: wo ? `${formatCanonicalOtNumberLabel(wo.ot_number)} ${wo.title || ''}`.trim() : '—',
      prcRecord,
      prcAdditionals,
      prcDisplay: prcRecord ? formatPrcNumberLabel(prcRecord.prc_number) : (mv.prc_number ? `PRC #${mv.prc_number}` : '—'),
      categoryLabel: catMeta.label,
      categoryBadgeCls: catMeta.badgeCls,
      paymentMethodLabel: mv.payment_method ? (CC_PAYMENT_METHOD_LABELS[mv.payment_method] || mv.payment_method) : '—',
      invoiceLabel: invMeta.label,
      invoiceBadgeCls: invMeta.badgeCls,
    }
  })
}

export function filterContractorCcRows(rows = [], filters = {}) {
  const {
    searchTerm = '',
    onlyCurrentPeriod = true,
    currentPeriod = '',
    contractorFilter = 'todos',
    categoryFilter = 'todos',
    directionFilter = 'todos',
    onlyDebeFactura = false,
  } = filters

  return (rows || []).filter((row) => {
    if (onlyCurrentPeriod && currentPeriod && row.period_key !== currentPeriod) return false
    if (contractorFilter && contractorFilter !== 'todos' && row.contractor_group !== contractorFilter) return false
    if (categoryFilter && categoryFilter !== 'todos' && row.category !== categoryFilter) return false
    if (directionFilter && directionFilter !== 'todos' && row.direction !== directionFilter) return false
    if (onlyDebeFactura && row.invoice_status !== 'DEBE_FACTURA') return false
    if (!searchTerm) return true
    return matchesUniversalSearch(
      {
        ...row,
        movement_date_ar: formatDateAr(row.movement_date),
      },
      searchTerm
    )
  })
}

export function summarizeContractorCcRows(rows = []) {
  let totalDebeArs = 0
  let totalHaberArs = 0
  let debeFacturaCount = 0
  const byContractorMap = new Map()

  for (const row of rows || []) {
    const debe = row.direction === 'DEBE' ? Number(row.amount_ars || 0) : 0
    const haber = row.direction === 'HABER' ? Number(row.amount_ars || 0) : 0
    totalDebeArs += debe
    totalHaberArs += haber
    if (row.invoice_status === 'DEBE_FACTURA') debeFacturaCount += 1

    const key = normalizeContractorKey(row.contractor_group)
    if (!byContractorMap.has(key)) {
      byContractorMap.set(key, { contractorGroup: row.contractor_group, debeArs: 0, haberArs: 0, netBalanceArs: 0, debeFacturaCount: 0, count: 0 })
    }
    const agg = byContractorMap.get(key)
    agg.debeArs = Number((agg.debeArs + debe).toFixed(2))
    agg.haberArs = Number((agg.haberArs + haber).toFixed(2))
    agg.netBalanceArs = Number((agg.haberArs - agg.debeArs).toFixed(2))
    if (row.invoice_status === 'DEBE_FACTURA') agg.debeFacturaCount += 1
    agg.count += 1
  }

  return {
    totalRows: (rows || []).length,
    totalDebeArs: Number(totalDebeArs.toFixed(2)),
    totalHaberArs: Number(totalHaberArs.toFixed(2)),
    netBalanceArs: Number((totalHaberArs - totalDebeArs).toFixed(2)),
    debeFacturaCount,
    byContractor: Array.from(byContractorMap.values()).sort((a, b) => a.contractorGroup.localeCompare(b.contractorGroup, 'es')),
  }
}

export const CONTRACTOR_CC_SHEET_COLUMNS = [
  { key: 'movement_date', label: 'Fecha', type: 'date', getValue: (r) => formatDateAr(r.movement_date) },
  { key: 'period_key', label: 'Quincena', isNumeric: false },
  { key: 'contractor_group', label: 'Contratista', isNumeric: false },
  { key: 'categoryLabel', label: 'Categoría / Alcance', isNumeric: false },
  { key: 'prcDisplay', label: 'Nº PRC', isNumeric: false },
  { key: 'otLabel', label: 'Buque / OT', isNumeric: false },
  { key: 'paymentMethodLabel', label: 'Medio / Ref.', isNumeric: false },
  { key: 'invoiceLabel', label: 'Factura', isNumeric: false },
  { key: 'debeArs', label: 'DEBE AR$', isNumeric: true, formatType: 'ars', getValue: (r) => Number(r.debeArs || 0) },
  { key: 'haberArs', label: 'HABER AR$', isNumeric: true, formatType: 'ars', getValue: (r) => Number(r.haberArs || 0) },
  { key: 'observations', label: 'Observaciones', isNumeric: false },
]
