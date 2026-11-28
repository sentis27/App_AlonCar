/**
 * contractorLedgerSources.js
 * Adaptadores puros de orígenes (PRC #2000+, Movimientos CC, Horas/Quincenas y Talleres FL-026)
 * consumidos por `contractorLedgerEngine.js`.
 */
import { toArIsoDate } from './dateTimeCanonical.js'
import { formatCanonicalOtNumberLabel } from './canonicalHelpers.js'
import { getFortnightPeriodKey } from './materialPricingPolicy.js'
import { buildPrcLookupMaps, formatPrcNumberLabel } from './prcRegistryRules.js'
import { buildThirdPartyCcLedger } from './thirdPartyCcEngine.js'
import { CC_INVOICE_STATUS_META } from './contractorCcRules.js'
import { getBaseContractorGroup, normalizeUpper, resolveContractorHourlyRateArs } from './contractorSettlementHelpers.js'
import { formatMovementConcept, getFortnightEndDateIso } from './contractorLedgerHelpers.js'

const round2 = (n) => Number((Number(n) || 0).toFixed(2))

export function buildWorkshopLedgerRows({ entity, thirdPartyCcData, shipMap, woMap }) {
  const acc = entity.ccAccount
  const ledger = buildThirdPartyCcLedger({
    account: acc,
    rateHistory: (thirdPartyCcData?.rateHistory || []).filter((r) => r.account_id === acc.id),
    savedEntries: (thirdPartyCcData?.savedEntries || []).filter((e) => e.account_id === acc.id),
    payments: (thirdPartyCcData?.payments || []).filter((p) => p.account_id === acc.id),
    panolRemitoTx: thirdPartyCcData?.panolRemitoTx || [],
    materials: thirdPartyCcData?.materials || [],
    thirdPartyServices: thirdPartyCcData?.thirdPartyServices || [],
    workOrders: thirdPartyCcData?.workOrders || [],
    ships: thirdPartyCcData?.ships || [],
  })

  const rows = []
  const opening = round2(acc.opening_balance_usd)
  if (Math.abs(opening) > 0.005) {
    rows.push({
      id: `OPENING:${acc.id}`, shipId: null, shipRecord: null, shipName: 'GENERAL / CUENTA', workOrder: null,
      entryDate: toArIsoDate(acc.opening_balance_date) || '', concept: 'SALDO INICIAL DE APERTURA',
      paidAmount: opening > 0 ? opening : 0, accruedAmount: opening < 0 ? Math.abs(opening) : 0,
      isPanolOrExpense: false, invoiceStatus: 'NO_APLICA', invoiceNumber: '', refDisplay: 'Apertura',
      observations: acc.notes || '', origin: 'WORKSHOP_OPENING', originLabel: 'INICIAL',
      isEditable: false, prcRecord: null, prcAdditionals: [],
    })
  }

  for (const d of ledger.debeRows) {
    const wo = d.workOrderId ? woMap.get(d.workOrderId) || null : null
    const shipId = d.shipId || wo?.ship_id || null
    const ship = shipId ? shipMap.get(shipId) || null : null
    const kgInfo = d.weightKg > 0 ? ` (${Number(d.weightKg).toLocaleString('es-AR')} kg × US$ ${d.rateUsdApplied})` : ''
    rows.push({
      id: `WS_DEBE:${d.id}`, shipId, shipRecord: ship, shipName: ship?.name || 'GENERAL / SIN BARCO', workOrder: wo,
      entryDate: d.entryDate || '', concept: `Remito ${d.remitoNumber || 'S/N'}${kgInfo}`,
      paidAmount: 0, accruedAmount: round2(d.amountUsd), isPanolOrExpense: false,
      invoiceStatus: 'NO_APLICA', invoiceNumber: '', refDisplay: d.remitoNumber ? `Rto ${d.remitoNumber}` : '',
      observations: d.specialRateReason || d.description || '', origin: 'WORKSHOP_DEBE',
      originLabel: d.entrySource === 'TERCEROS_SERVICE' ? 'TERCEROS' : 'PAMPA KG',
      isEditable: false, prcRecord: null, prcAdditionals: [],
    })
  }

  for (const p of ledger.haberRows) {
    rows.push({
      id: `WS_PAY:${p.id}`, shipId: null, shipRecord: null, shipName: 'GENERAL / CUENTA', workOrder: null,
      entryDate: toArIsoDate(p.payment_date) || '',
      concept: `${String(p.payment_type || 'PAGO').replace(/_/g, ' ')}${p.panol_remito_number ? ` · Rto ${p.panol_remito_number}` : ''}`,
      paidAmount: round2(p.amount_usd), accruedAmount: 0, isPanolOrExpense: p.payment_type === 'COMPENSACION_PANOL',
      invoiceStatus: p.has_invoice ? 'CON_FACTURA' : 'NO_APLICA', invoiceNumber: p.invoice_number || '',
      refDisplay: p.invoice_number || (p.panol_remito_number ? `Rto ${p.panol_remito_number}` : ''),
      observations: p.observations || '', origin: 'WORKSHOP_PAYMENT',
      originLabel: p.source_module === 'TESORERIA' ? 'TESORERÍA' : 'PAMPA',
      isEditable: true, rawPayment: p, prcRecord: null, prcAdditionals: [], createdAt: p.created_at || '',
    })
  }
  return rows
}

export function buildContractorLedgerRows({ entity, movements, prcs, laborLogs, rateCards, closures, workers, shipMap, woMap }) {
  const baseGroup = entity.baseGroup
  const prcMaps = buildPrcLookupMaps(prcs)
  const workerById = new Map((workers || []).map((w) => [w.id, w]))
  const workerByName = new Map((workers || []).map((w) => [normalizeUpper(w.name), w]))
  const rows = []
  const closedPeriods = new Set()
  const closedSnapshotTotals = new Map()

  for (const c of closures || []) {
    if (c.row_key !== '__PERIOD_SNAPSHOT__' || c.status !== 'CERRADO' || !Array.isArray(c.snapshot_json?.rows)) continue
    closedPeriods.add(c.period_key)
    for (const r of c.snapshot_json.rows) {
      if (getBaseContractorGroup(r.baseGroup || r.contractorLabel) !== baseGroup || r.workType !== 'HORA') continue
      const k = `${c.period_key}|${r.shipId || ''}`
      const prev = closedSnapshotTotals.get(k) || { periodKey: c.period_key, shipId: r.shipId || null, hours: 0, grossArs: 0 }
      prev.hours = round2(prev.hours + (Number(r.hours) || 0))
      prev.grossArs = round2(prev.grossArs + (Number(r.grossArs) || 0))
      closedSnapshotTotals.set(k, prev)
    }
  }

  for (const p of prcs || []) {
    if (!p || p.status === 'ANULADO' || getBaseContractorGroup(p.contractor_name) !== baseGroup) continue
    const wo = p.work_order_id ? woMap.get(p.work_order_id) || null : null
    const shipId = p.ship_id || wo?.ship_id || null
    const ship = shipId ? shipMap.get(shipId) || null : null
    const prefix = p.parent_prc_id ? 'PRESUPUESTO ADICIONAL' : 'PRESUPUESTO'
    const desc = String(p.description || '').trim()
    rows.push({
      id: `PRC:${p.id}`, shipId, shipRecord: ship, shipName: ship?.name || 'GENERAL / SIN BARCO', workOrder: wo,
      entryDate: toArIsoDate(p.issue_date) || '', concept: desc ? `${prefix} ${desc}` : `${prefix} ${ship?.name || ''}`.trim(),
      paidAmount: 0, accruedAmount: round2(p.amount_ars), isPanolOrExpense: false,
      invoiceStatus: 'NO_APLICA', invoiceNumber: '', prcNumber: Number(p.prc_number || 0),
      isAdditional: Boolean(p.parent_prc_id), prcRecord: p, prcAdditionals: prcMaps.additionalsByParentId.get(p.id) || [],
      refDisplay: `${formatPrcNumberLabel(p.prc_number)}${wo ? ` · ${formatCanonicalOtNumberLabel(wo.ot_number, { compact: true })}` : ''}`,
      observations: p.observations || '', origin: 'PRC_REGISTRY', originLabel: 'PRC',
      isEditable: false, createdAt: p.created_at || '',
    })
  }

  const closedMovKeys = new Set()
  for (const m of movements || []) {
    if (!m || getBaseContractorGroup(m.contractor_group) !== baseGroup) continue
    if (m.category === 'DEVENGADO_QUINCENA' && m.period_key) {
      closedMovKeys.add(`${m.period_key}|${m.ship_id || ''}`)
      if (!m.ship_id) closedMovKeys.add(`${m.period_key}|*`)
    }
    const wo = m.work_order_id ? woMap.get(m.work_order_id) || null : null
    const shipId = m.ship_id || wo?.ship_id || null
    const ship = shipId ? shipMap.get(shipId) || null : null
    const prcRecord = (m.prc_id && prcMaps.byId.get(m.prc_id)) || (m.prc_number && prcMaps.byNumber.get(Number(m.prc_number))) || null
    const isHaber = m.direction === 'HABER'
    const amt = round2(m.amount_ars)
    const invMeta = CC_INVOICE_STATUS_META[m.invoice_status] || CC_INVOICE_STATUS_META.NO_APLICA
    const refParts = [prcRecord ? formatPrcNumberLabel(prcRecord.prc_number) : '', wo ? formatCanonicalOtNumberLabel(wo.ot_number, { compact: true }) : '', m.invoice_number || (m.invoice_status === 'DEBE_FACTURA' ? invMeta.label : '')].filter(Boolean)

    rows.push({
      id: `CC:${m.id}`, shipId, shipRecord: ship, shipName: ship?.name || 'GENERAL / CUENTA', workOrder: wo,
      entryDate: toArIsoDate(m.movement_date) || '', concept: formatMovementConcept(m),
      paidAmount: isHaber ? 0 : amt, accruedAmount: isHaber ? amt : 0,
      isPanolOrExpense: !isHaber && (m.category === 'RTO_PANOL' || m.category === 'GASTO_A_CUENTA'),
      invoiceStatus: m.invoice_status || 'NO_APLICA', invoiceNumber: m.invoice_number || '',
      prcNumber: Number(prcRecord?.prc_number || m.prc_number || 0), prcRecord,
      prcAdditionals: prcRecord ? (prcMaps.additionalsByParentId.get(prcRecord.id) || []) : [],
      refDisplay: refParts.join(' · '), observations: m.observations || '', origin: 'CC_MOVEMENT',
      originLabel: m.category === 'RTO_PANOL' ? 'PAÑOL' : (m.source_module === 'LIQUIDACION_CIERRE' ? 'CIERRE' : 'TESORERÍA'),
      isEditable: true, rawMovement: m, createdAt: m.created_at || '',
    })
  }

  const liveHoursMap = new Map()
  for (const l of laborLogs || []) {
    if (!l || normalizeUpper(l.work_type) === 'CONTROL' || normalizeUpper(l.work_type) === 'PRESUPUESTO') continue
    const w = (l.worker_id && workerById.get(l.worker_id)) || workerByName.get(normalizeUpper(l.worker_name)) || null
    const contractorLabel = String(w?.work_group || l.worker_name || '').trim()
    if (!contractorLabel || getBaseContractorGroup(contractorLabel) !== baseGroup) continue
    if (w && normalizeUpper(w.admin_center) === 'ASTILLERO') continue
    const periodKey = getFortnightPeriodKey(l.date_logged)
    if (!periodKey) continue
    const wo = l.work_order_id ? woMap.get(l.work_order_id) || null : null
    const shipId = l.ship_id || wo?.ship_id || null
    const key = `${periodKey}|${shipId || ''}`
    if (!liveHoursMap.has(key)) liveHoursMap.set(key, { periodKey, shipId, hours: 0, grossArs: 0 })
    const hrs = Number(l.hours_worked ?? ((Number(l.hours_normal) || 0) + (Number(l.hours_extra_50) || 0) + (Number(l.hours_extra_100) || 0))) || 0
    const rate = resolveContractorHourlyRateArs({ contractorLabel, worker: w, rateCards, periodKey })
    const bucket = liveHoursMap.get(key)
    bucket.hours = round2(bucket.hours + hrs)
    bucket.grossArs = round2(bucket.grossArs + hrs * rate)
  }

  for (const [key, snap] of closedSnapshotTotals.entries()) liveHoursMap.set(key, snap)

  for (const [key, b] of liveHoursMap.entries()) {
    if (closedMovKeys.has(key) || closedMovKeys.has(`${b.periodKey}|*`) || (b.hours <= 0 && b.grossArs <= 0)) continue
    const ship = b.shipId ? shipMap.get(b.shipId) || null : null
    const isClosed = closedPeriods.has(b.periodKey)
    rows.push({
      id: `HRS:${key}`, shipId: b.shipId, shipRecord: ship, shipName: ship?.name || 'GENERAL / ASTILLERO', workOrder: null,
      entryDate: getFortnightEndDateIso(b.periodKey), concept: `QUINCENA ${b.periodKey} · ${b.hours} hs${isClosed ? '' : ' (en vivo)'}`,
      paidAmount: 0, accruedAmount: round2(b.grossArs), isPanolOrExpense: false,
      invoiceStatus: 'NO_APLICA', invoiceNumber: '', refDisplay: `${b.periodKey} · ${b.hours} hs`,
      observations: isClosed ? 'Liquidación cerrada en Resumen Horas' : 'Calculado en vivo desde Carga de Horas y Tarifario',
      origin: 'HOURS_LIVE', originLabel: isClosed ? 'HS CERRADA' : 'HS VIVO',
      isEditable: false, prcRecord: null, prcAdditionals: [],
    })
  }
  return rows
}
