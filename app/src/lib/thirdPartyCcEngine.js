/**
 * thirdPartyCcEngine.js
 * Motor puro (Capa 2 · SKL-019) para Cuentas Corrientes de Talleres Externos:
 * - Absorción automática de remitos de Pañol (POR_KILO, solo `category = MATERIALES`)
 *   o comprobantes de Terceros (`BY_VOUCHER`), más asientos manuales.
 * - Historial inmutable de tarifas US$/kg por fecha y ajuste especial por fila (azul).
 * - Cálculo de neto USD con o sin IVA y conciliación FIFO / Manual de cancelados.
 */
import { toArIsoDate, getTodayArIso, compareIsoDatesAsc, compareIsoDatesDesc } from './dateTimeCanonical.js'
import { normalizeRemitoNumber } from './tercerosRemitoMatcher.js'

const SHORT_MONTHS_ES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC']
const round2 = (n) => Number((Number(n) || 0).toFixed(2))
const round4 = (n) => Number((Number(n) || 0).toFixed(4))
const normName = (v) => String(v || '').trim().toUpperCase()

export function formatQuincenaLabelAr(isoDate) {
  const iso = toArIsoDate(isoDate)
  if (!iso) return 'Sin quincena'
  const [y, m, d] = iso.split('-').map(Number)
  return `${d <= 15 ? '1RA' : '2DA'} ${SHORT_MONTHS_ES[(m || 1) - 1] || 'MES'} ${y}`
}

export function resolveRateForDate(isoDate, rateHistory = [], fallbackRate = 0) {
  const target = toArIsoDate(isoDate) || getTodayArIso()
  const sorted = [...(rateHistory || [])]
    .filter((r) => r && toArIsoDate(r.effective_from))
    .sort((a, b) => compareIsoDatesDesc(a.effective_from, b.effective_from) || String(b.created_at || '').localeCompare(String(a.created_at || '')))

  if (sorted.length === 0) return { rate: Number(fallbackRate) || 0, effectiveFrom: null, isCurrentRate: true }
  const latest = sorted[0]
  const match = sorted.find((r) => toArIsoDate(r.effective_from) <= target) || sorted[sorted.length - 1]
  return {
    rate: Number(match.rate_usd_per_kg) || 0,
    effectiveFrom: toArIsoDate(match.effective_from),
    isCurrentRate: match.id ? match.id === latest.id : toArIsoDate(match.effective_from) === toArIsoDate(latest.effective_from),
  }
}

export function computePaymentNetUsd({ paymentType, amountUsd = 0, amountArs = 0, exchangeRate = null, hasIva = false, ivaPct = 21 } = {}) {
  if (paymentType === 'EFECTIVO_USD') {
    return { netUsd: round2(Math.max(0, Number(amountUsd) || 0)), grossUsdWithIva: null }
  }
  const ars = Number(amountArs) || 0
  const tc = Number(exchangeRate) || 0
  const grossUsd = ars > 0 && tc > 0 ? ars / tc : Math.max(0, Number(amountUsd) || 0)
  const ivaRate = hasIva && Number(ivaPct) > 0 ? Number(ivaPct) / 100 : 0
  const netUsd = ivaRate > 0 ? grossUsd / (1 + ivaRate) : grossUsd
  return { netUsd: round2(netUsd), grossUsdWithIva: hasIva ? round2(grossUsd) : null }
}

function doesRowMatchAccount(row, account) {
  if (!row || !account) return false
  if (account.worker_id && (row.worker_id === account.worker_id || row.contractor_id === account.worker_id)) return true
  const names = new Set([normName(account.operational_name), normName(account.legal_name)].filter(Boolean))
  return [row.worker_name, row.contractor_name].some((c) => names.has(normName(c)))
}

function buildDebeRowShape({
  accountId, entrySource, sourceKey = null, ov = null, remitoNumber, entryDate,
  weightKg = 0, rateUsdApplied = 0, baseRateUsd = 0, isCurrentRatePeriod = true,
  amountUsd = 0, shipId = null, workOrderId = null, items = [],
  tercerosLink = { hasTercerosVoucher: false, count: 0 }, description = '',
}) {
  return {
    id: ov?.id || sourceKey || remitoNumber,
    overrideId: ov?.id || null,
    accountId,
    entrySource,
    sourceKey,
    remitoNumber,
    entryDate,
    quincenaLabel: ov?.quincena_label || formatQuincenaLabelAr(entryDate),
    weightKg: round4(weightKg),
    rateUsdApplied: Number(rateUsdApplied) || 0,
    baseRateUsd: Number(baseRateUsd) || 0,
    isCurrentRatePeriod,
    isSpecialRate: Boolean(ov?.is_special_rate),
    specialRateReason: ov?.special_rate_reason || '',
    amountUsd: round2(amountUsd),
    manualCancelled: Boolean(ov?.is_cancelled),
    shipId: ov?.ship_id || shipId || null,
    workOrderId: ov?.work_order_id || workOrderId || null,
    items,
    tercerosLink,
    description: ov?.description || description || '',
  }
}

function buildTercerosLookup(thirdPartyServices = [], account) {
  const byRemito = new Map()
  for (const srv of thirdPartyServices || []) {
    if (!doesRowMatchAccount(srv, account)) continue
    const key = normalizeRemitoNumber(srv.internal_remito_number || srv.voucher_number)
    if (!key) continue
    if (!byRemito.has(key)) byRemito.set(key, [])
    byRemito.get(key).push(srv)
  }
  return byRemito
}

function buildPerKgEntries({ account, rateHistory, overrideMap, panolRemitoTx, matMap, shipMap, woMap, tercerosByRemito }) {
  const allowedCats = new Set((account.material_categories?.length ? account.material_categories : ['MATERIALES']).map(normName))
  const groups = new Map()

  for (const tx of panolRemitoTx || []) {
    if (!tx || tx.is_deletion_requested || !doesRowMatchAccount(tx, account)) continue
    const remitoKey = normalizeRemitoNumber(tx.voucher_number)
    const mat = matMap.get(tx.material_id)
    if (!remitoKey || !mat || !allowedCats.has(normName(mat.category))) continue

    const qty = Number(tx.quantity_withdrawn) || 0
    const weightKg = Number(tx.weight_total) > 0 ? Number(tx.weight_total) : (Number(mat.weight_kg) || 0) * qty
    const txDate = toArIsoDate(tx.transaction_date) || getTodayArIso()
    if (!groups.has(remitoKey)) {
      groups.set(remitoKey, { remitoKey, remitoNumber: String(tx.voucher_number).trim(), entryDate: txDate, weightKg: 0, shipIds: new Set(), workOrderIds: new Set(), items: [] })
    }
    const g = groups.get(remitoKey)
    if (txDate && (!g.entryDate || txDate < g.entryDate)) g.entryDate = txDate
    g.weightKg += weightKg
    if (tx.ship_id) g.shipIds.add(tx.ship_id)
    if (tx.work_order_id) g.workOrderIds.add(tx.work_order_id)
    g.items.push({
      id: tx.id, materialName: mat.name || 'Material', quantity: qty, unitMeasure: mat.unit_measure || 'un.',
      weightKg: round4(weightKg), shipId: tx.ship_id || null, shipName: shipMap.get(tx.ship_id)?.name || 'Sin Buque',
      workOrderId: tx.work_order_id || null, workOrder: woMap.get(tx.work_order_id) || null, notes: tx.notes || '', transactionDate: txDate,
    })
  }

  const out = []
  for (const g of groups.values()) {
    const sourceKey = `REMITO:${g.remitoKey}`
    const ov = overrideMap.get(sourceKey)
    if (ov?.is_excluded) continue
    const totalKg = round4(g.weightKg)
    const resolved = resolveRateForDate(g.entryDate, rateHistory, account.current_rate_usd)
    const isSpecial = Boolean(ov?.is_special_rate)
    const rate = isSpecial ? Number(ov.rate_usd_applied) : resolved.rate
    const amountUsd = isSpecial && Number(ov?.amount_usd) > 0 ? Number(ov.amount_usd) : totalKg * rate
    const linked = tercerosByRemito.get(g.remitoKey) || []
    out.push(buildDebeRowShape({
      accountId: account.id, entrySource: 'PANOL_REMITO', sourceKey, ov, remitoNumber: g.remitoNumber, entryDate: g.entryDate,
      weightKg: totalKg, rateUsdApplied: rate, baseRateUsd: resolved.rate, isCurrentRatePeriod: !isSpecial && resolved.isCurrentRate,
      amountUsd, shipId: Array.from(g.shipIds)[0], workOrderId: Array.from(g.workOrderIds)[0], items: g.items,
      tercerosLink: { hasTercerosVoucher: linked.length > 0, count: linked.length },
      description: g.items.map((i) => i.notes).filter(Boolean).join(' · '),
    }))
  }
  return out
}

function buildByVoucherEntries({ account, overrideMap, thirdPartyServices }) {
  const out = []
  for (const srv of thirdPartyServices || []) {
    if (!doesRowMatchAccount(srv, account)) continue
    const sourceKey = `SERVICE:${srv.id}`
    const ov = overrideMap.get(sourceKey)
    if (ov?.is_excluded) continue
    const entryDate = toArIsoDate(srv.service_date || srv.entry_date) || getTodayArIso()
    out.push(buildDebeRowShape({
      accountId: account.id, entrySource: 'TERCEROS_SERVICE', sourceKey, ov,
      remitoNumber: srv.internal_remito_number || srv.voucher_number || srv.invoice_number || srv.budget_number || 'S/N',
      entryDate, weightKg: ov?.weight_kg || 0, rateUsdApplied: ov?.rate_usd_applied || 0,
      amountUsd: ov?.is_special_rate ? ov.amount_usd : (srv.amount_usd || 0),
      shipId: srv.ship_id, workOrderId: srv.work_order_id,
      tercerosLink: { hasTercerosVoucher: true, count: 1 },
      description: srv.direct_observations || srv.trade || 'Comprobante Terceros',
    }))
  }
  return out
}

export function buildThirdPartyCcLedger({
  account = null, rateHistory = [], savedEntries = [], payments = [],
  panolRemitoTx = [], materials = [], thirdPartyServices = [], workOrders = [], ships = [],
} = {}) {
  if (!account) {
    return { debeRows: [], haberRows: [], totals: { totalKilos: 0, totalDebeUsd: 0, totalHaberUsd: 0, openingBalanceUsd: 0, balanceUsd: 0, pendingDebeUsd: 0, cancelledDebeUsd: 0, currentRateUsd: 0 } }
  }

  const matMap = new Map((materials || []).map((m) => [m.id, m]))
  const shipMap = new Map((ships || []).map((s) => [s.id, s]))
  const woMap = new Map((workOrders || []).map((w) => [w.id, w]))
  const tercerosByRemito = buildTercerosLookup(thirdPartyServices, account)
  const overrideMap = new Map((savedEntries || []).filter((e) => e.source_key).map((e) => [e.source_key, e]))

  const autoRows = account.pricing_mode === 'BY_VOUCHER'
    ? buildByVoucherEntries({ account, overrideMap, thirdPartyServices })
    : buildPerKgEntries({ account, rateHistory, overrideMap, panolRemitoTx, matMap, shipMap, woMap, tercerosByRemito })

  const manualRows = (savedEntries || [])
    .filter((e) => e.entry_source === 'MANUAL' && !e.is_excluded)
    .map((e) => buildDebeRowShape({
      accountId: account.id, entrySource: 'MANUAL', sourceKey: e.source_key || null, ov: e,
      remitoNumber: e.remito_number || 'AJUSTE', entryDate: toArIsoDate(e.entry_date),
      weightKg: e.weight_kg, rateUsdApplied: e.rate_usd_applied, baseRateUsd: e.rate_usd_applied,
      amountUsd: e.amount_usd, shipId: e.ship_id, workOrderId: e.work_order_id, description: e.description || '',
    }))

  const sortedDebe = [...autoRows, ...manualRows].sort((a, b) =>
    compareIsoDatesAsc(a.entryDate, b.entryDate) || String(a.remitoNumber || '').localeCompare(String(b.remitoNumber || ''), 'es', { numeric: true })
  )
  const haberRows = [...(payments || [])].sort((a, b) => compareIsoDatesDesc(a.payment_date, b.payment_date))
  const openingBalanceUsd = round2(account.opening_balance_usd)
  const totalHaberUsd = round2(haberRows.reduce((s, p) => s + (Number(p.amount_usd) || 0), 0))

  let fifoBudget = round2(openingBalanceUsd + totalHaberUsd)
  const mode = account.cancellation_mode === 'MANUAL' ? 'MANUAL' : 'FIFO'
  const debeRows = sortedDebe.map((row) => {
    const fifoCancelled = row.amountUsd > 0 && fifoBudget + 0.001 >= row.amountUsd
    if (fifoCancelled) fifoBudget = round2(fifoBudget - row.amountUsd)
    const isCancelled = mode === 'FIFO' ? fifoCancelled : row.manualCancelled
    const visualTier = row.isSpecialRate ? 'special' : isCancelled && row.isCurrentRatePeriod ? 'cancelled_current' : isCancelled ? 'cancelled_historical' : 'pending'
    return { ...row, fifoCancelled, isCancelled, visualTier }
  })

  const totalKilos = round4(debeRows.reduce((s, r) => s + (Number(r.weightKg) || 0), 0))
  const totalDebeUsd = round2(debeRows.reduce((s, r) => s + (Number(r.amountUsd) || 0), 0))
  const cancelledDebeUsd = round2(debeRows.filter((r) => r.isCancelled).reduce((s, r) => s + r.amountUsd, 0))
  return {
    debeRows,
    haberRows,
    totals: {
      totalKilos, totalDebeUsd, totalHaberUsd, openingBalanceUsd,
      balanceUsd: round2(openingBalanceUsd + totalHaberUsd - totalDebeUsd),
      pendingDebeUsd: round2(totalDebeUsd - cancelledDebeUsd), cancelledDebeUsd,
      currentRateUsd: resolveRateForDate(getTodayArIso(), rateHistory, account.current_rate_usd).rate,
    },
  }
}
