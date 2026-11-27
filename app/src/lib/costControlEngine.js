/**
 * costControlEngine.js
 * Motor puro de conciliación quincenal Materiales <-> Horas para Control de Gastos (GS-010 / DEC-025).
 * Usa exclusivamente `dateTimeCanonical.js` para fechas y períodos en Argentina (UTC-3).
 */
import { toArIsoDate, formatDateAr } from './dateTimeCanonical.js'
import {
  DEFAULT_EXCLUDED_COST_CONTROL_OTS,
  buildMaterialExceptionReviewKey,
  buildLaborOnlyApprovalReviewKey,
} from '../schemas/costControl.schema.js'
import {
  normalizeControlText,
  getQuincenaKeyFromDate,
  getCurrentQuincenaKeyAr,
  getPreviousQuincenaKey,
  getQuincenaRangeAr,
  listRecentQuincenaOptions,
  buildWorkersLookup,
  resolveContractorEntity,
  extractLogTotalHours,
  computeDailyHoursSplitSummary,
} from './costControlPeriodHelpers.js'

export {
  normalizeControlText,
  getQuincenaKeyFromDate,
  getCurrentQuincenaKeyAr,
  getPreviousQuincenaKey,
  getQuincenaRangeAr,
  listRecentQuincenaOptions,
  buildWorkersLookup,
  resolveContractorEntity,
  extractLogTotalHours,
  computeDailyHoursSplitSummary,
}

const NON_WITHDRAWAL_RE = /^(ENTRADA|INGRESO|AJUSTE|DEVOLUCION_INGRESO)/i

function buildOtLabel(wo) {
  if (!wo) return 'SIN OT'
  const num = String(wo.ot_number || '').trim()
  const title = String(wo.title || '').trim()
  if (num && title) return `${num} · ${title}`
  return title || num || 'SIN OT'
}

function indexLaborByPeriod(logs = [], periodKey, workerLookup, shipsById, wosById) {
  const byKey = new Map()
  const otTitleIndex = new Map()
  for (const log of logs || []) {
    const dateIso = toArIsoDate(log.date_logged)
    if (!dateIso || getQuincenaKeyFromDate(dateIso) !== periodKey) continue
    const { entity } = resolveContractorEntity({ workerId: log.worker_id, workerName: log.worker_name }, workerLookup)
    const shipId = log.ship_id || null
    const woId = log.work_order_id || null
    const wo = woId ? wosById.get(woId) : null
    const shipName = (shipId && shipsById.get(shipId)?.name) || log.ships?.name || 'SIN BARCO'
    const otLabel = wo ? buildOtLabel(wo) : buildOtLabel(log.work_orders)
    const hours = extractLogTotalHours(log)
    const key = `${shipId || 'NONE'}|${woId || 'NONE'}|${entity}`

    if (!byKey.has(key)) {
      byKey.set(key, {
        key, periodKey, shipId, shipName, workOrderId: woId, otLabel, entity,
        totalHours: 0, count: 0, lastDateIso: dateIso, datesSet: new Set(), logIds: [],
      })
    }
    const bucket = byKey.get(key)
    bucket.totalHours = Number((bucket.totalHours + hours).toFixed(2))
    bucket.count += 1
    if (dateIso > bucket.lastDateIso) bucket.lastDateIso = dateIso
    bucket.datesSet.add(dateIso)
    if (log.id) bucket.logIds.push(log.id)

    const otNorm = normalizeControlText(wo?.title || wo?.ot_number || log.work_orders?.title || log.work_orders?.ot_number)
    if (otNorm && shipId) {
      const idxKey = `${entity}|${otNorm}`
      if (!otTitleIndex.has(idxKey)) otTitleIndex.set(idxKey, new Map())
      otTitleIndex.get(idxKey).set(`${shipId}|${woId || 'NONE'}`, { shipId, shipName, workOrderId: woId, otLabel })
    }
  }
  return { byKey, otTitleIndex }
}

function buildMaterialRow(tx, dateIso, { wosById, shipsById, matsById, workerLookup }) {
  const wo = tx.work_order_id ? wosById.get(tx.work_order_id) : null
  const entityInfo = resolveContractorEntity(
    { workerId: tx.worker_id, workerName: tx.worker_name, contractorName: tx.contractor_name },
    workerLookup
  )
  const shipId = tx.ship_id || null
  const woId = tx.work_order_id || null
  const shipName = (shipId && shipsById.get(shipId)?.name) || 'SIN BARCO'
  const mat = tx.material_id ? matsById.get(tx.material_id) : null
  return {
    wo,
    entityInfo,
    row: {
      id: tx.id, dateIso, dateAr: formatDateAr(dateIso), voucherNumber: tx.voucher_number || '—',
      materialId: tx.material_id || null, materialName: mat?.name || tx.notes || 'Material sin nombre',
      unitMeasure: mat?.unit_measure || '', quantity: Number(tx.quantity_withdrawn ?? 0),
      shipId, shipName, workOrderId: woId, workItemId: tx.work_item_id || null,
      otNumber: wo?.ot_number || '', otTitle: wo?.title || '', otLabel: buildOtLabel(wo),
      entity: entityInfo.entity, workerName: tx.worker_name || tx.contractor_name || entityInfo.entity,
      unmapped: entityInfo.unmapped, canImputeHours: entityInfo.canImputeHours,
      reviewKey: buildMaterialExceptionReviewKey(tx.id),
      matchKey: `${shipId || 'NONE'}|${woId || 'NONE'}|${entityInfo.entity}`,
    },
  }
}

export function buildCostControlSnapshot({
  periodKey = getCurrentQuincenaKeyAr(),
  transactions = [],
  laborLogs = [],
  thirdPartyServices = [],
  workers = [],
  ships = [],
  workOrders = [],
  materials = [],
  reviews = [],
  excludedOtNames = DEFAULT_EXCLUDED_COST_CONTROL_OTS,
} = {}) {
  const range = getQuincenaRangeAr(periodKey)
  const prevPeriodKey = getPreviousQuincenaKey(range.periodKey)
  const prevRange = getQuincenaRangeAr(prevPeriodKey)
  const shipsById = new Map((ships || []).map((s) => [s.id, s]))
  const wosById = new Map((workOrders || []).map((w) => [w.id, w]))
  const matsById = new Map((materials || []).map((m) => [m.id, m]))
  const workerLookup = buildWorkersLookup(workers)
  const excludedSet = new Set((excludedOtNames || DEFAULT_EXCLUDED_COST_CONTROL_OTS).map(normalizeControlText).filter(Boolean))
  const reviewsByKey = new Map((reviews || []).map((r) => [r.review_key, r]))

  const tpKeySet = new Set((thirdPartyServices || []).map((s) => {
    const { entity } = resolveContractorEntity({ workerId: s.contractor_id, contractorName: s.contractor_name }, workerLookup)
    return `${s.ship_id || 'NONE'}|${s.work_order_id || 'NONE'}|${entity}`
  }))

  const currLabor = indexLaborByPeriod(laborLogs, range.periodKey, workerLookup, shipsById, wosById)
  const prevLabor = indexLaborByPeriod(laborLogs, prevPeriodKey, workerLookup, shipsById, wosById)

  const materialRows = []
  const thirdPartyMaterialRows = []
  const matPresentKeySet = new Set()

  for (const tx of transactions || []) {
    const dateIso = toArIsoDate(tx.transaction_date || tx.created_at)
    if (!dateIso || getQuincenaKeyFromDate(dateIso) !== range.periodKey) continue
    if (tx.movement_type && NON_WITHDRAWAL_RE.test(String(tx.movement_type).trim())) continue
    if (tx.quantity_withdrawn !== null && tx.quantity_withdrawn !== undefined && Number(tx.quantity_withdrawn) <= 0) continue

    const { wo, entityInfo, row } = buildMaterialRow(tx, dateIso, { wosById, shipsById, matsById, workerLookup })
    if (excludedSet.has(normalizeControlText(wo?.ot_number)) || excludedSet.has(normalizeControlText(wo?.title))) continue

    if (!entityInfo.canImputeHours) {
      thirdPartyMaterialRows.push({ ...row, hasThirdPartyMatch: Boolean(row.shipId && row.workOrderId && tpKeySet.has(row.matchKey)) })
      continue
    }
    if (row.shipId && row.workOrderId) matPresentKeySet.add(row.matchKey)

    const review = row.reviewKey ? reviewsByKey.get(row.reviewKey) : null
    if (review?.review_type === 'MATERIAL_EXCEPTION') {
      materialRows.push({ ...row, status: 'VALIDATED_EXCEPTION', review, incompleteData: false, possibleShipMatches: [], prevQuincenaMatch: null })
      continue
    }
    if (row.shipId && row.workOrderId && currLabor.byKey.has(row.matchKey)) {
      materialRows.push({ ...row, status: 'OK', review: null, incompleteData: false, possibleShipMatches: [], prevQuincenaMatch: null })
      continue
    }

    const otNorm = normalizeControlText(wo?.title || wo?.ot_number)
    const shipMap = otNorm ? currLabor.otTitleIndex.get(`${entityInfo.entity}|${otNorm}`) : null
    const possibleShipMatches = shipMap ? Array.from(shipMap.values()).filter((m) => m.shipId !== row.shipId) : []
    const prevHit = row.shipId && row.workOrderId ? prevLabor.byKey.get(row.matchKey) : null
    const prevQuincenaMatch = prevHit
      ? { periodKey: prevPeriodKey, lastDateIso: prevHit.lastDateIso, lastDateAr: formatDateAr(prevHit.lastDateIso), totalHours: prevHit.totalHours, count: prevHit.count }
      : null

    materialRows.push({
      ...row, status: 'NO', review: null, possibleShipMatches, prevQuincenaMatch,
      incompleteData: !row.shipId || !row.workOrderId || entityInfo.entity === 'SIN_CONTRATISTA',
    })
  }

  const queueMap = new Map()
  for (const r of materialRows) {
    if (r.status !== 'NO') continue
    if (!queueMap.has(r.entity)) queueMap.set(r.entity, { entity: r.entity, pendingCount: 0, possibleShipErrors: 0, prevQuincenaMatches: 0 })
    const q = queueMap.get(r.entity)
    q.pendingCount += 1
    if (r.possibleShipMatches.length > 0) q.possibleShipErrors += 1
    if (r.prevQuincenaMatch) q.prevQuincenaMatches += 1
  }
  const contractorQueue = Array.from(queueMap.values()).sort((a, b) => (b.pendingCount - a.pendingCount) || a.entity.localeCompare(b.entity))

  const laborOnlyRows = Array.from(currLabor.byKey.values())
    .filter((grp) => !matPresentKeySet.has(grp.key))
    .map((grp) => {
      const reviewKey = buildLaborOnlyApprovalReviewKey({ periodKey: range.periodKey, shipId: grp.shipId, workOrderId: grp.workOrderId, contractorEntity: grp.entity })
      const review = reviewsByKey.get(reviewKey) || null
      return {
        ...grp, dates: Array.from(grp.datesSet).sort(), daysCount: grp.datesSet.size,
        lastDateAr: formatDateAr(grp.lastDateIso), reviewKey, review,
        isApproved: review?.review_type === 'LABOR_ONLY_APPROVED',
      }
    })
    .sort((a, b) => (Number(a.isApproved) - Number(b.isApproved)) || b.totalHours - a.totalHours)

  const kpis = {
    totalMaterialLines: materialRows.length,
    pendingLines: materialRows.filter((r) => r.status === 'NO').length,
    okLines: materialRows.filter((r) => r.status === 'OK').length,
    validatedExceptions: materialRows.filter((r) => r.status === 'VALIDATED_EXCEPTION').length,
    possibleShipErrorLines: materialRows.filter((r) => r.status === 'NO' && r.possibleShipMatches.length > 0).length,
    prevQuincenaMatchLines: materialRows.filter((r) => r.status === 'NO' && r.prevQuincenaMatch).length,
    laborOnlyTotal: laborOnlyRows.length,
    laborOnlyPending: laborOnlyRows.filter((r) => !r.isApproved).length,
    laborOnlyApproved: laborOnlyRows.filter((r) => r.isApproved).length,
    thirdPartyLines: thirdPartyMaterialRows.length,
  }

  return { periodKey: range.periodKey, prevPeriodKey, range, prevRange, materialRows, thirdPartyMaterialRows, contractorQueue, laborOnlyRows, kpis }
}
