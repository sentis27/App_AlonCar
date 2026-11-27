/**
 * costControlMirrorHelpers.js
 * Motor puro para el panel derecho Espejo de Horas (día enfocado + mapa de quincena + quincena anterior).
 */
import { toArIsoDate, formatDateAr, formatDayMonthAr } from './dateTimeCanonical.js'
import {
  buildWorkersLookup,
  resolveContractorEntity,
  normalizeControlText,
  getQuincenaKeyFromDate,
  extractLogTotalHours,
} from './costControlPeriodHelpers.js'

function buildOtLabel(wo) {
  if (!wo) return 'SIN OT'
  const num = String(wo.ot_number || '').trim()
  const title = String(wo.title || '').trim()
  if (num && title) return `${num} · ${title}`
  return title || num || 'SIN OT'
}

function groupPeriodLogs(logs = [], periodKey, shipsById, wosById, focusOtNorm, focusShipId) {
  const byKey = new Map()
  for (const log of logs) {
    if (getQuincenaKeyFromDate(log.dateIso) !== periodKey) continue
    const shipId = log.ship_id || null
    const woId = log.work_order_id || null
    const wo = woId ? wosById.get(woId) : null
    const shipName = (shipId && shipsById.get(shipId)?.name) || log.ships?.name || 'SIN BARCO'
    const otNumber = wo?.ot_number || log.work_orders?.ot_number || ''
    const otTitle = wo?.title || log.work_orders?.title || ''
    const otLabel = wo ? buildOtLabel(wo) : buildOtLabel(log.work_orders)
    const key = `${shipId || 'NONE'}|${woId || 'NONE'}`

    if (!byKey.has(key)) {
      const otNorm = normalizeControlText(otTitle || otNumber)
      byKey.set(key, {
        key,
        shipId,
        shipName,
        workOrderId: woId,
        otNumber,
        otTitle,
        otLabel,
        totalHours: 0,
        count: 0,
        lastDateIso: log.dateIso,
        datesSet: new Set(),
        matchesFocusOtOnOtherShip: Boolean(focusOtNorm && otNorm === focusOtNorm && shipId && shipId !== focusShipId),
      })
    }
    const grp = byKey.get(key)
    grp.totalHours = Number((grp.totalHours + log.totalHours).toFixed(2))
    grp.count += 1
    if (log.dateIso > grp.lastDateIso) grp.lastDateIso = log.dateIso
    grp.datesSet.add(log.dateIso)
  }

  return Array.from(byKey.values()).map((grp) => {
    const dates = Array.from(grp.datesSet).sort()
    return {
      ...grp,
      dates,
      datesShortLabel: dates.map((d) => formatDayMonthAr(d)).join(', '),
      lastDateAr: formatDateAr(grp.lastDateIso),
    }
  })
}

export function buildContractorHoursMirror({
  laborLogs = [],
  workers = [],
  ships = [],
  workOrders = [],
  entity = '',
  periodKey = '',
  prevPeriodKey = '',
  focusDateIso = '',
  focusShipId = null,
  focusOtTitle = '',
} = {}) {
  const targetEntity = normalizeControlText(entity)
  if (!targetEntity) {
    return { dayLogs: [], dayTotalHours: 0, quincenaGroups: [], prevQuincenaGroups: [] }
  }

  const workerLookup = buildWorkersLookup(workers)
  const shipsById = new Map((ships || []).map((s) => [s.id, s]))
  const wosById = new Map((workOrders || []).map((w) => [w.id, w]))
  const focusOtNorm = normalizeControlText(focusOtTitle)

  const entityLogs = []
  for (const log of laborLogs || []) {
    const dateIso = toArIsoDate(log.date_logged)
    if (!dateIso) continue
    const resolved = resolveContractorEntity({ workerId: log.worker_id, workerName: log.worker_name }, workerLookup)
    if (resolved.entity !== targetEntity) continue

    const shipId = log.ship_id || null
    const woId = log.work_order_id || null
    const wo = woId ? wosById.get(woId) : null
    entityLogs.push({
      ...log,
      dateIso,
      dateAr: formatDateAr(dateIso),
      shipName: (shipId && shipsById.get(shipId)?.name) || log.ships?.name || 'SIN BARCO',
      otNumber: wo?.ot_number || log.work_orders?.ot_number || '',
      otTitle: wo?.title || log.work_orders?.title || '',
      otLabel: wo ? buildOtLabel(wo) : buildOtLabel(log.work_orders),
      totalHours: extractLogTotalHours(log),
    })
  }

  const dayLogs = entityLogs
    .filter((l) => focusDateIso && l.dateIso === focusDateIso)
    .sort((a, b) => String(a.created_at || a.id || '').localeCompare(String(b.created_at || b.id || '')))

  const dayTotalHours = Number(dayLogs.reduce((acc, l) => acc + l.totalHours, 0).toFixed(2))

  const quincenaGroups = periodKey
    ? groupPeriodLogs(entityLogs, periodKey, shipsById, wosById, focusOtNorm, focusShipId).sort(
        (a, b) => (Number(b.matchesFocusOtOnOtherShip) - Number(a.matchesFocusOtOnOtherShip)) || (b.totalHours - a.totalHours)
      )
    : []

  const prevQuincenaGroups = prevPeriodKey
    ? groupPeriodLogs(entityLogs, prevPeriodKey, shipsById, wosById, focusOtNorm, focusShipId).sort(
        (a, b) => b.lastDateIso.localeCompare(a.lastDateIso) || (b.totalHours - a.totalHours)
      )
    : []

  return { dayLogs, dayTotalHours, quincenaGroups, prevQuincenaGroups }
}
