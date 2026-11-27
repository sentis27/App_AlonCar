/**
 * costControlPeriodHelpers.js
 * Helpers puros de quincenas en hora Argentina (UTC-3), resolución de contratista
 * y cálculo de suma diaria para desdoblamiento en Control de Gastos (FL-024).
 */
import { toArIsoDate, getTodayArIso } from './dateTimeCanonical.js'

const MONTH_SHORT_ES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
const PERIOD_KEY_RE = /^(\d{4})-(\d{2})-(1Q|2Q)$/i

export function normalizeControlText(val) {
  return String(val || '').trim().toUpperCase()
}

export function getQuincenaKeyFromDate(dateInput) {
  const iso = toArIsoDate(dateInput)
  if (!iso) return ''
  const [y, m, d] = iso.split('-').map(Number)
  if (!y || !m || !d) return ''
  return `${y}-${String(m).padStart(2, '0')}-${d <= 15 ? '1Q' : '2Q'}`
}

export function getCurrentQuincenaKeyAr(now = new Date()) {
  return getQuincenaKeyFromDate(getTodayArIso(now))
}

export function getPreviousQuincenaKey(periodKey) {
  const m = String(periodKey || '').trim().match(PERIOD_KEY_RE)
  if (!m) return getPreviousQuincenaKey(getCurrentQuincenaKeyAr())
  const year = Number(m[1])
  const month = Number(m[2])
  const q = m[3].toUpperCase()
  if (q === '2Q') return `${year}-${String(month).padStart(2, '0')}-1Q`
  const prevMonth = month === 1 ? 12 : month - 1
  const prevYear = month === 1 ? year - 1 : year
  return `${prevYear}-${String(prevMonth).padStart(2, '0')}-2Q`
}

export function getQuincenaRangeAr(periodKey) {
  const m = String(periodKey || '').trim().match(PERIOD_KEY_RE)
  if (!m) return getQuincenaRangeAr(getCurrentQuincenaKeyAr())
  const year = Number(m[1])
  const month = Number(m[2])
  const q = m[3].toUpperCase()
  const mm = String(month).padStart(2, '0')
  const lastDay = new Date(year, month, 0).getDate()
  const startDate = `${year}-${mm}-${q === '1Q' ? '01' : '16'}`
  const endDate = `${year}-${mm}-${q === '1Q' ? '15' : String(lastDay).padStart(2, '0')}`
  const label = `${q === '1Q' ? '1RA' : '2DA'} ${MONTH_SHORT_ES[month - 1]} ${year}`
  return {
    periodKey: `${year}-${mm}-${q}`,
    label,
    year,
    month,
    quincena: q === '1Q' ? 1 : 2,
    startDate,
    endDate,
    startIsoAr: `${startDate}T00:00:00-03:00`,
    endIsoAr: `${endDate}T23:59:59-03:00`,
  }
}

export function listRecentQuincenaOptions(count = 12, now = new Date()) {
  const options = []
  let cursor = getCurrentQuincenaKeyAr(now)
  for (let i = 0; i < count; i++) {
    const r = getQuincenaRangeAr(cursor)
    options.push({ key: r.periodKey, label: r.label, startDate: r.startDate, endDate: r.endDate })
    cursor = getPreviousQuincenaKey(cursor)
  }
  return options
}

const GENERIC_WORK_GROUPS = new Set(['', 'CONTRATISTA', 'TERCEROS', 'TALLER', 'SIN GRUPO', 'SIN ASIGNAR'])

export function resolveWorkerGroupEntity(worker) {
  const grp = normalizeControlText(worker?.work_group)
  if (grp && !GENERIC_WORK_GROUPS.has(grp)) return grp
  return normalizeControlText(worker?.name)
}

export function buildWorkersLookup(workers = []) {
  const byId = new Map()
  const byNormName = new Map()
  const groupStats = new Map()
  for (const w of workers || []) {
    if (!w) continue
    if (w.id) byId.set(w.id, w)
    const norm = normalizeControlText(w.name)
    if (norm && !byNormName.has(norm)) byNormName.set(norm, w)
    const entity = resolveWorkerGroupEntity(w)
    if (entity) {
      const prev = groupStats.get(entity) || { canImputeHours: false, canChargeThirdParty: false }
      groupStats.set(entity, {
        canImputeHours: prev.canImputeHours || (w.can_impute_hours !== false),
        canChargeThirdParty: prev.canChargeThirdParty || Boolean(w.can_charge_third_party),
      })
    }
  }
  return { byId, byNormName, groupStats }
}

export function resolveContractorEntity({ workerId = null, workerName = '', contractorName = '' } = {}, workerLookup) {
  const lookup = Array.isArray(workerLookup)
    ? buildWorkersLookup(workerLookup)
    : (workerLookup || { byId: new Map(), byNormName: new Map(), groupStats: new Map() })
  const rawName = normalizeControlText(workerName || contractorName)
  const worker = (workerId && lookup.byId.get(workerId)) || (rawName ? lookup.byNormName.get(rawName) : null) || null

  if (worker) {
    const entity = resolveWorkerGroupEntity(worker)
    const groupMeta = lookup.groupStats?.get(entity)
    return {
      entity,
      worker,
      canImputeHours: groupMeta ? groupMeta.canImputeHours : (worker.can_impute_hours !== false),
      canChargeThirdParty: groupMeta ? groupMeta.canChargeThirdParty : Boolean(worker.can_charge_third_party),
      unmapped: false,
    }
  }
  if (!rawName || rawName === 'SIN ASIGNAR') {
    return { entity: 'SIN_CONTRATISTA', worker: null, canImputeHours: true, canChargeThirdParty: false, unmapped: true }
  }
  const groupMeta = lookup.groupStats?.get(rawName)
  if (groupMeta) {
    return {
      entity: rawName,
      worker: null,
      canImputeHours: groupMeta.canImputeHours,
      canChargeThirdParty: groupMeta.canChargeThirdParty,
      unmapped: false,
    }
  }
  return { entity: rawName, worker: null, canImputeHours: true, canChargeThirdParty: false, unmapped: rawName !== 'ASTILLERO' }
}

export function extractLogTotalHours(log) {
  if (!log) return 0
  if (log.hours_worked !== null && log.hours_worked !== undefined) return Number(log.hours_worked) || 0
  return (Number(log.hours_normal || 0) + Number(log.hours_extra_50 || 0) + Number(log.hours_extra_100 || 0)) || 0
}

export function computeDailyHoursSplitSummary(dayLogs = [], sourceLogId, sourceNextHours, newRowHours) {
  const originalDayTotal = Number(
    (dayLogs || []).reduce((acc, l) => acc + extractLogTotalHours(l), 0).toFixed(2)
  )
  const otherLogsTotal = (dayLogs || []).reduce(
    (acc, l) => (l.id === sourceLogId ? acc : acc + extractLogTotalHours(l)),
    0
  )
  const nextDayTotal = Number((otherLogsTotal + (Number(sourceNextHours) || 0) + (Number(newRowHours) || 0)).toFixed(2))
  const delta = Number((nextDayTotal - originalDayTotal).toFixed(2))
  return { originalDayTotal, nextDayTotal, delta, matchesOriginal: Math.abs(delta) < 0.005 }
}
