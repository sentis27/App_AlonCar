/**
 * contractorSettlementHelpers.js
 * Helpers puros de tarifas, franjas cromáticas, exclusión FL-026 y novedades Astillero (`Resumen`).
 */
import { formatDateAr, toArIsoDate } from './dateTimeCanonical.js'
import { compareFortnightKeys, getFortnightPeriodKey } from './materialPricingPolicy.js'

export function normalizeUpper(val = '') {
  return String(val || '').trim().toUpperCase()
}

export function getBaseContractorGroup(name = '') {
  return normalizeUpper(name).replace(/\s+AYUDANTE$/, '').trim()
}

const BAND_PALETTE = [
  { rowBg: 'bg-sky-950/25', chipBg: 'bg-sky-900/80 border-sky-400/60 text-sky-100', borderAccent: 'border-l-4 border-l-sky-400' },
  { rowBg: 'bg-amber-950/25', chipBg: 'bg-amber-800/75 border-amber-400/60 text-amber-100', borderAccent: 'border-l-4 border-l-amber-400' },
  { rowBg: 'bg-emerald-950/25', chipBg: 'bg-emerald-900/80 border-emerald-400/60 text-emerald-100', borderAccent: 'border-l-4 border-l-emerald-400' },
  { rowBg: 'bg-purple-950/25', chipBg: 'bg-purple-900/80 border-purple-400/60 text-purple-100', borderAccent: 'border-l-4 border-l-purple-400' },
  { rowBg: 'bg-orange-950/25', chipBg: 'bg-orange-900/80 border-orange-400/60 text-orange-100', borderAccent: 'border-l-4 border-l-orange-400' },
  { rowBg: 'bg-cyan-950/25', chipBg: 'bg-cyan-900/80 border-cyan-400/60 text-cyan-100', borderAccent: 'border-l-4 border-l-cyan-400' },
  { rowBg: 'bg-rose-950/25', chipBg: 'bg-rose-900/75 border-rose-400/60 text-rose-100', borderAccent: 'border-l-4 border-l-rose-400' },
  { rowBg: 'bg-lime-950/25', chipBg: 'bg-lime-900/75 border-lime-400/60 text-lime-100', borderAccent: 'border-l-4 border-l-lime-400' },
  { rowBg: 'bg-indigo-950/25', chipBg: 'bg-indigo-900/80 border-indigo-400/60 text-indigo-100', borderAccent: 'border-l-4 border-l-indigo-400' },
  { rowBg: 'bg-teal-950/25', chipBg: 'bg-teal-900/80 border-teal-400/60 text-teal-100', borderAccent: 'border-l-4 border-l-teal-400' },
  { rowBg: 'bg-fuchsia-950/25', chipBg: 'bg-fuchsia-900/75 border-fuchsia-400/60 text-fuchsia-100', borderAccent: 'border-l-4 border-l-fuchsia-400' },
  { rowBg: 'bg-slate-800/40', chipBg: 'bg-slate-700/90 border-slate-400/60 text-slate-100', borderAccent: 'border-l-4 border-l-slate-400' },
]

export function getContractorBandStyle(contractorLabel = '') {
  const base = getBaseContractorGroup(contractorLabel) || 'SIN_CONTRATISTA'
  let hash = 0
  for (let i = 0; i < base.length; i++) {
    hash = ((hash << 5) - hash + base.charCodeAt(i)) | 0
  }
  return BAND_PALETTE[Math.abs(hash) % BAND_PALETTE.length]
}

export function buildExcludedWorkshopSet(ccAccounts = []) {
  const names = new Set()
  const workerIds = new Set()
  for (const acc of ccAccounts || []) {
    if (acc?.is_active === false) continue
    if (acc?.worker_id) workerIds.add(String(acc.worker_id))
    for (const raw of [acc?.operational_name, acc?.legal_name]) {
      const k = normalizeUpper(raw)
      if (k) names.add(k)
    }
  }
  return { names, workerIds }
}

export function isExcludedWorkshopOrStaff({ contractorLabel = '', worker = null, workType = '', workerType = '', excludedWorkshops = null } = {}) {
  if (normalizeUpper(workType) === 'CONTROL') return true
  if (normalizeUpper(worker?.admin_center) === 'ASTILLERO') return true
  if (!worker && normalizeUpper(workerType) === 'ASTILLERO') return true
  if (worker?.id && excludedWorkshops?.workerIds?.has(String(worker.id))) return true
  const base = getBaseContractorGroup(contractorLabel)
  const full = normalizeUpper(contractorLabel)
  if (excludedWorkshops?.names?.has(full) || excludedWorkshops?.names?.has(base)) return true
  return false
}

export function resolveContractorHourlyRateArs({ contractorLabel = '', worker = null, rateCards = [], periodKey = '' } = {}) {
  const fullKey = normalizeUpper(contractorLabel)
  const baseEntity = getBaseContractorGroup(contractorLabel)
  const isAyudante = fullKey.endsWith(' AYUDANTE') || normalizeUpper(worker?.category).includes('AYUDANTE')

  const contractorCards = (rateCards || [])
    .filter((c) => normalizeUpper(c?.admin_center) !== 'ASTILLERO' && normalizeUpper(c?.entity_name) === baseEntity)
    .sort((a, b) => compareFortnightKeys(b.period || '', a.period || ''))

  const pickCardAmount = (card) => {
    if (!card) return 0
    if (isAyudante && card.has_ayudante && Number(card.rate_ayudante_ars) > 0) {
      return Number(card.rate_ayudante_ars)
    }
    return Number(card.rate_oficial_ars || 0)
  }

  const exact = contractorCards.find((c) => c.period === periodKey)
  const exactVal = pickCardAmount(exact)
  if (exactVal > 0) return exactVal

  const priorOrEqual = contractorCards.find((c) => !periodKey || compareFortnightKeys(c.period || '', periodKey) <= 0) || contractorCards[0]
  const cardVal = pickCardAmount(priorOrEqual)
  if (cardVal > 0) return cardVal

  return Number(worker?.hourly_rate_ars || 0)
}

const NOVEDAD_RULES = [
  { label: 'ENFERMO', re: /\bENFERM[AO]?S?\b|\bCARPETA\s+MEDICA\b/i },
  { label: 'AUSENTE', re: /\bAUSENTES?\b|\bAUSENCIA\b|\bINJUSTIFICAD[AO]\b|\bFALT[AO]\b/i },
  { label: 'ART', re: /\bART\b|\bACCIDENTE\s+LABORAL\b/i },
  { label: 'VACACIONES', re: /\bVACACIONES?\b/i },
  { label: 'LICENCIA', re: /\bLICENCIAS?\b|\bDUELO\b|\bPATERNIDAD\b|\bMATERNIDAD\b|\bESTUDIO\b/i },
  { label: 'PERMISO', re: /\bPERMISOS?\b|\bREPOSO\b|\bSUSPENDID[AO]\b/i },
]

export function detectAstilleroNovedadLabel(log = {}) {
  const fields = [log?.rubro, log?.work_type, log?.notes].filter(Boolean).join(' ')
  if (!fields) return null
  for (const rule of NOVEDAD_RULES) {
    if (rule.re.test(fields)) return rule.label
  }
  return null
}

export function buildResumenNovedadesGroups({ laborLogs = [], workers = [], periodKey = '' } = {}) {
  const workerById = new Map((workers || []).map((w) => [w.id, w]))
  const workerByName = new Map((workers || []).map((w) => [normalizeUpper(w.name), w]))
  const groupMap = new Map()

  for (const log of laborLogs || []) {
    if (!log || normalizeUpper(log.work_type) === 'CONTROL') continue
    const logPeriod = getFortnightPeriodKey(log.date_logged)
    if (periodKey && logPeriod !== periodKey) continue

    const w = (log.worker_id && workerById.get(log.worker_id)) || workerByName.get(normalizeUpper(log.worker_name)) || null
    const isAstillero = normalizeUpper(w?.admin_center || log.worker_type) === 'ASTILLERO'
    if (!isAstillero) continue

    const novedad = detectAstilleroNovedadLabel(log)
    if (!novedad) continue

    const iso = toArIsoDate(log.date_logged)
    const dayNumber = iso ? Number(iso.slice(8, 10)) : 0
    const workerName = w?.name || log.worker_name || 'Sin Nombre'
    const key = `${normalizeUpper(workerName)}|${novedad}`

    if (!groupMap.has(key)) {
      groupMap.set(key, { key, workerName, novedad, entries: [] })
    }
    groupMap.get(key).entries.push({
      id: log.id || `${key}|${iso}|${log.created_at || ''}`,
      dateIso: iso,
      dateAr: formatDateAr(iso),
      dayNumber,
      observations: String(log.notes || '').trim(),
    })
  }

  const groups = Array.from(groupMap.values()).sort((a, b) => a.workerName.localeCompare(b.workerName, 'es'))
  for (const g of groups) {
    g.entries.sort((a, b) => a.dayNumber - b.dayNumber || (a.dateIso || '').localeCompare(b.dateIso || ''))
  }
  return groups
}

export const RESUMEN_NOVEDADES_SHEET_COLUMNS = [
  { key: 'workerName', label: 'OPERARIO', isNumeric: false },
  { key: 'novedad', label: 'RUBRO', isNumeric: false },
  { key: 'dayNumber', label: 'DÍA DEL MES', isNumeric: true, formatType: 'integer', getValue: (r) => Number(r.dayNumber || 0) },
  { key: 'observations', label: 'OBSERVACIONES', isNumeric: false },
]

export const CONTRATADOS_SHEET_COLUMNS = [
  { key: 'contractorLabel', label: 'CONTRATISTA', isNumeric: false },
  { key: 'shipName', label: 'CLIENTE', isNumeric: false },
  { key: 'otLabel', label: 'ORDEN TRABAJO', isNumeric: false },
  { key: 'workType', label: 'TIPO TRABAJO', isNumeric: false },
  { key: 'prcDisplay', label: 'Nº PRC', isNumeric: false },
  { key: 'hours', label: 'HORAS', isNumeric: true, formatType: 'number', getValue: (r) => Number(r.hours || 0) },
  { key: 'hourlyRateArs', label: '$/h', isNumeric: true, formatType: 'ars', getValue: (r) => Number(r.hourlyRateArs || 0) },
  { key: 'grossArs', label: 'Importe a pagar', isNumeric: true, formatType: 'ars', getValue: (r) => Number(r.grossArs || 0) },
  { key: 'materialsArs', label: 'MATERIALES', isNumeric: true, formatType: 'ars', getValue: (r) => Number(r.materialsArs || 0) },
  { key: 'advancesArs', label: 'ANTICIPOS', isNumeric: true, formatType: 'ars', getValue: (r) => Number(r.advancesArs || 0) },
  { key: 'netPayableArs', label: 'A PAGAR', isNumeric: true, formatType: 'ars', getValue: (r) => Number(r.netPayableArs || 0) },
  { key: 'progressPct', label: 'AVANCE PRC', isNumeric: true, formatType: 'number', getValue: (r) => Number(r.progressPct ?? 0) },
  { key: 'prcStatus', label: 'ESTADO PRC', isNumeric: false },
  { key: 'observations', label: 'OBSERVACIONES', isNumeric: false },
]

export function buildContratadosExportPayload(rows = [], periodKey = '', dollarRate = 1500) {
  return {
    filename: `resumen_contratados_${periodKey}`,
    rows: rows.map((r) => ({
      contratista: r.contractorLabel, cliente: r.shipName, ot: r.otLabel, tipo: r.workType,
      prc: r.prcDisplay, horas: r.hours, valorHora: r.hourlyRateArs, importe: r.grossArs,
      materiales: r.materialsArs, anticipos: r.advancesArs, aPagar: r.netPayableArs,
      avancePrc: r.progressPct !== null && r.progressPct !== undefined ? `${r.progressPct}%` : '—',
      estadoPrc: r.prcStatus, observaciones: r.observations || `TC Mat: AR$ ${dollarRate} (${formatDateAr(new Date())})`,
    })),
    columns: CONTRATADOS_SHEET_COLUMNS.map((c, idx) => ({
      key: ['contratista', 'cliente', 'ot', 'tipo', 'prc', 'horas', 'valorHora', 'importe', 'materiales', 'anticipos', 'aPagar', 'avancePrc', 'estadoPrc', 'observaciones'][idx],
      label: c.label,
    })),
  }
}
