/**
 * contractorLedgerHelpers.js
 * Helpers puros para `3. Contratados` (`/tesoreria?tab=contratados`).
 */
import { formatDateAr } from './dateTimeCanonical.js'
import { buildExcludedWorkshopSet, getBaseContractorGroup, normalizeUpper } from './contractorSettlementHelpers.js'
import { CC_CATEGORY_META, CC_PAYMENT_METHOD_LABELS } from './contractorCcRules.js'

export const RESUMEN_TAB_ID = '__RESUMEN__'
export const GENERAL_SHIP_TAB_ID = '__GENERAL__'

export function getFortnightEndDateIso(periodKey = '') {
  const m = String(periodKey || '').match(/^(\d{4})-(\d{2})-(1Q|2Q)$/i)
  if (!m) return ''
  const lastDay = m[3].toUpperCase() === '1Q' ? 15 : new Date(Number(m[1]), Number(m[2]), 0).getDate()
  return `${m[1]}-${m[2]}-${String(lastDay).padStart(2, '0')}`
}

export function getLedgerSheetColumns(currency = 'ARS') {
  const formatType = currency === 'USD' ? 'usd' : 'ars'
  return [
    { key: 'concept', label: 'CONCEPTO / DETALLE', isNumeric: false, getValue: (r) => r.concept || '' },
    { key: 'entryDate', label: 'FECHA', type: 'date', getValue: (r) => formatDateAr(r.entryDate) },
    { key: 'paidAmount', label: 'MONTO PAGADO', isNumeric: true, formatType, getValue: (r) => (Number(r.paidAmount) > 0 ? Number(r.paidAmount) : '') },
    { key: 'accruedAmount', label: 'QUINCENA / PRC', isNumeric: true, formatType, getValue: (r) => (Number(r.accruedAmount) > 0 ? Number(r.accruedAmount) : '') },
    { key: 'runningBalance', label: 'SALDO', isNumeric: true, formatType, getValue: (r) => (Number.isFinite(Number(r.activeRunningBalance)) ? Number(r.activeRunningBalance) : Number(r.runningBalance || 0)) },
    { key: 'refDisplay', label: 'PRC / OT / FACTURA', isNumeric: false, getValue: (r) => r.refDisplay || '' },
    { key: 'observations', label: 'NOTAS', isNumeric: false, getValue: (r) => r.observations || '' },
  ]
}

export const CONTRACTOR_LEDGER_SHEET_COLUMNS = getLedgerSheetColumns('ARS')

export function formatLedgerMoney(value = 0, currency = 'ARS', { showZeroAsDash = false } = {}) {
  const num = Number(value || 0)
  if (showZeroAsDash && Math.abs(num) < 0.005) return ''
  const prefix = currency === 'USD' ? 'US$ ' : '$ '
  const absFormatted = Math.abs(num).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return num < -0.005 ? `-${prefix}${absFormatted}` : `${prefix}${absFormatted}`
}

export function buildContractorEntitiesList({ workers = [], movements = [], prcs = [], laborLogs = [], ccAccounts = [] } = {}) {
  const excludedWorkshops = buildExcludedWorkshopSet(ccAccounts)
  const workerById = new Map((workers || []).map((w) => [w.id, w]))
  const workerByName = new Map((workers || []).map((w) => [normalizeUpper(w.name), w]))
  const activityByGroup = new Map()
  const addActivity = (rawGroup) => {
    const base = getBaseContractorGroup(rawGroup)
    if (base) activityByGroup.set(base, (activityByGroup.get(base) || 0) + 1)
  }

  for (const m of movements || []) addActivity(m?.contractor_group)
  for (const p of prcs || []) { if (p?.status !== 'ANULADO') addActivity(p?.contractor_name) }
  for (const l of laborLogs || []) {
    if (!l || normalizeUpper(l.work_type) === 'CONTROL') continue
    const w = (l.worker_id && workerById.get(l.worker_id)) || workerByName.get(normalizeUpper(l.worker_name)) || null
    if ((w && normalizeUpper(w.admin_center) === 'ASTILLERO') || (!w && normalizeUpper(l.worker_type) === 'ASTILLERO')) continue
    addActivity(w?.work_group || l.worker_name)
  }

  const groupMap = new Map()
  const ensureContractor = (rawName, worker = null) => {
    const baseGroup = getBaseContractorGroup(rawName)
    if (!baseGroup || excludedWorkshops.names.has(baseGroup) || excludedWorkshops.names.has(normalizeUpper(rawName))) return null
    if (worker?.id && excludedWorkshops.workerIds.has(String(worker.id))) return null
    if (!groupMap.has(baseGroup)) {
      groupMap.set(baseGroup, { id: `CONTR:${baseGroup}`, entityType: 'CONTRACTOR', baseGroup, label: baseGroup, currency: 'ARS', worker: null, ccAccount: null, hasActiveWorker: false })
    }
    const entry = groupMap.get(baseGroup)
    if (worker) {
      const wActive = normalizeUpper(worker.status || 'ACTIVO') === 'ACTIVO'
      if (wActive) entry.hasActiveWorker = true
      const isHead = normalizeUpper(worker.name) === baseGroup
      const prevHead = entry.worker && normalizeUpper(entry.worker.name) === baseGroup
      const prevActive = entry.worker && normalizeUpper(entry.worker.status || 'ACTIVO') === 'ACTIVO'
      if (!entry.worker || (wActive && !prevActive) || (wActive === prevActive && isHead && !prevHead)) entry.worker = worker
    }
    return entry
  }

  for (const w of workers || []) { if (w && normalizeUpper(w.admin_center) !== 'ASTILLERO') ensureContractor(w.work_group || w.name, w) }
  for (const m of movements || []) ensureContractor(m?.contractor_group, null)
  for (const p of prcs || []) { if (p?.status !== 'ANULADO') ensureContractor(p?.contractor_name, null) }

  const entities = []
  for (const acc of ccAccounts || []) {
    if (!acc || acc.is_active === false) continue
    const legal = String(acc.legal_name || '').trim()
    const op = String(acc.operational_name || '').trim()
    const label = legal && op && normalizeUpper(legal) !== normalizeUpper(op) ? `${legal} (${op})` : (legal || op)
    entities.push({
      id: `WORKSHOP:${acc.id}`, entityType: 'WORKSHOP_CC', baseGroup: getBaseContractorGroup(op || legal),
      label, currency: 'USD', worker: acc.worker_id ? workerById.get(acc.worker_id) || null : null,
      ccAccount: acc, activityCount: 1, hasActivity: true,
    })
  }
  for (const item of groupMap.values()) {
    const act = activityByGroup.get(item.baseGroup) || 0
    if (!item.hasActiveWorker && act === 0) continue
    entities.push({ ...item, activityCount: act, hasActivity: act > 0 })
  }
  return entities.sort((a, b) => (a.hasActivity !== b.hasActivity ? (a.hasActivity ? -1 : 1) : b.activityCount - a.activityCount || a.label.localeCompare(b.label, 'es')))
}

export function parseInlineConceptSmart(rawText = '') {
  const raw = String(rawText || '').trim()
  const upper = raw.toUpperCase()
  if (!raw) return { category: 'ADELANTO', payment_method: 'TRANSFERENCIA', payment_reference: '', panol_remito_number: '' }
  const remitoMatch = raw.match(/(?:remito|rto|pa[nñ]ol)\s*(?:n[°ºo.]*)?\s*(\d+)/i)
  if (remitoMatch || upper.includes('PANOL') || upper.includes('PAÑOL')) {
    return { category: 'RTO_PANOL', payment_method: 'COMPENSACION_PANOL', payment_reference: '', panol_remito_number: remitoMatch?.[1] || '' }
  }
  if (upper.includes('SEGURO') || upper.includes('POLIZA') || upper.includes('PÓLIZA') || upper.includes('AGUA') || upper.includes('GASTO')) {
    return { category: 'GASTO_A_CUENTA', payment_method: 'OTRO', payment_reference: raw, panol_remito_number: '' }
  }
  if (upper.includes('ECHEQ') || upper.includes('E-CHEQ')) return { category: 'ADELANTO', payment_method: 'ECHEQ', payment_reference: raw, panol_remito_number: '' }
  if (/\bCH(?:EQUE)?\b/i.test(raw)) return { category: 'ADELANTO', payment_method: 'CHEQUE', payment_reference: raw, panol_remito_number: '' }
  if (upper.includes('EFECTIVO') || upper.includes('USD') || upper.includes('DOLAR') || upper.includes('DÓLAR')) {
    const isUsd = upper.includes('USD') || upper.includes('DOLAR') || upper.includes('DÓLAR')
    return { category: 'ADELANTO', payment_method: isUsd ? 'EFECTIVO_USD' : 'EFECTIVO_ARS', payment_reference: raw, panol_remito_number: '' }
  }
  if (upper.includes('TRANSF')) return { category: 'ADELANTO', payment_method: 'TRANSFERENCIA', payment_reference: '', panol_remito_number: '' }
  if (upper.includes('BONIF') || upper.includes('RECONOC')) return { category: 'BONIFICACION', payment_method: 'OTRO', payment_reference: raw, panol_remito_number: '' }
  return { category: 'ADELANTO', payment_method: 'TRANSFERENCIA', payment_reference: raw, panol_remito_number: '' }
}

export function formatMovementConcept(mv = {}) {
  const catMeta = CC_CATEGORY_META[mv.category] || CC_CATEGORY_META.AJUSTE
  const methodLabel = mv.payment_method ? (CC_PAYMENT_METHOD_LABELS[mv.payment_method] || mv.payment_method) : ''
  if (mv.category === 'RTO_PANOL') {
    const remito = mv.panol_remito_number ? `REMITO PAÑOL ${mv.panol_remito_number}` : 'REMITO PAÑOL'
    return mv.observations ? `${remito} · ${mv.observations}` : remito
  }
  if (mv.payment_reference) {
    const ref = String(mv.payment_reference).trim()
    return !methodLabel || ref.toUpperCase().startsWith(methodLabel.toUpperCase().slice(0, 4)) ? ref : `${methodLabel} ${ref}`
  }
  return mv.observations || methodLabel || catMeta.label
}

export function buildContratadosKpiCards({
  tabKpis = {},
  activeTabLabel = 'RESUMEN',
  currency = 'ARS',
  onGoToResumen,
} = {}) {
  const bal = Number(tabKpis.currentBalance || 0)
  const debeInv = Number(tabKpis.debeFacturaCount || 0)
  return [
    { id: 'accrued', label: 'Presupuestos / Quincenas', count: formatLedgerMoney(tabKpis.totalAccrued, currency), colorTheme: 'amber', subtext: `Devengado · ${activeTabLabel}` },
    { id: 'paid', label: 'Pagado (Transf. / Ch.)', count: formatLedgerMoney(tabKpis.totalPaidDirect, currency), colorTheme: 'cyan', subtext: 'Adelantos y pagos directos' },
    { id: 'panol', label: 'Pañol & Gastos', count: formatLedgerMoney(tabKpis.totalPanolAndExpenses, currency), colorTheme: 'purple', subtext: 'Remitos y gastos a cuenta' },
    {
      id: 'todos',
      label: 'SALDO ACTUAL',
      count: formatLedgerMoney(bal, currency),
      colorTheme: bal < -0.005 ? 'rose' : bal > 0.005 ? 'blue' : 'emerald',
      subtext: bal < -0.005 ? 'Saldo a pagar' : bal > 0.005 ? 'Adelanto a favor' : 'Saldado en $ 0,00',
    },
    { id: 'debe_factura', label: 'DEBE FACTURA', count: debeInv, colorTheme: debeInv > 0 ? 'rose' : 'emerald', subtext: debeInv > 0 ? 'Clic para filtrar' : 'Al día' },
    { id: 'ships_summary', label: 'Barcos Abiertos', count: Number(tabKpis.openShipsCount || 0), colorTheme: 'blue', subtext: `${tabKpis.settledShipsCount || 0} saldado(s) en $0`, onClick: onGoToResumen },
  ]
}

export function buildLedgerExportPayload({ entity, activeTabLabel = 'RESUMEN', rows = [], currency = 'ARS' } = {}) {
  const slug = String(entity?.label || 'contratado').toLowerCase().replace(/[^a-z0-9]+/gi, '_')
  const tabSlug = String(activeTabLabel || 'resumen').toLowerCase().replace(/[^a-z0-9]+/gi, '_')
  return {
    filename: `cc_${slug}_${tabSlug}`,
    rows: (rows || []).map((r) => ({
      concepto: r.concept, barco: r.shipName, fecha: formatDateAr(r.entryDate),
      paidAmount: r.paidAmount || 0, accruedAmount: r.accruedAmount || 0,
      saldo: r.activeRunningBalance ?? r.runningBalance ?? 0,
      referencia: r.refDisplay || '', origen: r.originLabel || '', notas: r.observations || '',
    })),
    columns: [
      { key: 'concepto', label: 'CONCEPTO / DETALLE' },
      { key: 'barco', label: 'BARCO' },
      { key: 'fecha', label: 'FECHA' },
      { key: 'paidAmount', label: `MONTO PAGADO (${currency})` },
      { key: 'accruedAmount', label: `QUINCENA / PRC (${currency})` },
      { key: 'saldo', label: `SALDO (${currency})` },
      { key: 'referencia', label: 'PRC / OT / FACTURA' },
      { key: 'origen', label: 'ORIGEN' },
      { key: 'notas', label: 'NOTAS' },
    ],
  }
}
