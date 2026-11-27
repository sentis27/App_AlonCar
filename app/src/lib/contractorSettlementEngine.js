/**
 * contractorSettlementEngine.js
 * Motor puro de liquidación `Contratados` (14 columnas exactas de `CONTRATADOS`,
 * franjas cromáticas, cálculo automático de `% AVANCE PRC` con adicionales,
 * exclusión de `CONTROL`/`ASTILLERO`/talleres `FL-026` y cruce sin duplicados con Pañol y CC).
 */
import { formatCanonicalOtNumberLabel } from './canonicalHelpers.js'
import { getFortnightPeriodKey } from './materialPricingPolicy.js'
import { buildPrcLookupMaps, formatPrcNumberLabel } from './prcRegistryRules.js'
import { buildPendingPanolBatches, normalizeContractorKey } from './contractorCcRules.js'
import {
  buildExcludedWorkshopSet,
  CONTRATADOS_SHEET_COLUMNS,
  buildContratadosExportPayload,
  getBaseContractorGroup,
  getContractorBandStyle,
  isExcludedWorkshopOrStaff,
  normalizeUpper,
  resolveContractorHourlyRateArs,
} from './contractorSettlementHelpers.js'

export { CONTRATADOS_SHEET_COLUMNS, buildContratadosExportPayload }

const round2 = (n) => Number((Number(n) || 0).toFixed(2))

export function computePrcProgress({ prcTotalArs = 0, hourlyRateArs = 0, cumulativeHours = 0 } = {}) {
  const total = Number(prcTotalArs || 0)
  const rate = Number(hourlyRateArs || 0)
  const hours = Number(cumulativeHours || 0)
  if (!(total > 0) || !(rate > 0)) return { estimatedHours: 0, progressPct: null }
  const estimatedHours = round2(total / rate)
  return { estimatedHours, progressPct: Number(((hours / estimatedHours) * 100).toFixed(1)) }
}

function matchWorkerForLog(log, workerById, workerByName) {
  return (log?.worker_id && workerById.get(log.worker_id)) || workerByName.get(normalizeUpper(log?.worker_name)) || null
}

function matchOfficialPrc({ contractorLabel, shipId, workOrderId, prcs = [] }) {
  const contrBase = getBaseContractorGroup(contractorLabel)
  const candidates = (prcs || []).filter(
    (p) => !p.parent_prc_id && p.status !== 'ANULADO' && getBaseContractorGroup(p.contractor_name) === contrBase
  )
  return candidates.find((p) => workOrderId && p.work_order_id === workOrderId)
    || candidates.find((p) => shipId && p.ship_id === shipId)
    || candidates[0]
    || null
}

function getPrcTotalWithAdditionals(prc, prcMaps) {
  if (!prc) return { totalArs: 0, additionals: [] }
  const activeAdics = (prcMaps?.additionalsByParentId?.get(prc.id) || []).filter((a) => a.status !== 'ANULADO')
  const totalArs = Number(prc.amount_ars || 0) + activeAdics.reduce((s, a) => s + Number(a.amount_ars || 0), 0)
  return { totalArs: round2(totalArs), additionals: activeAdics }
}

export function buildContratadosSettlementRows({
  periodKey = '', laborLogs = [], workers = [], rateCards = [], prcs = [],
  thirdPartyServices = [], ccMovements = [], deductionsData = null, closures = [],
  ccAccounts = [], ships = [], workOrders = [],
} = {}) {
  const shipById = new Map((ships || []).map((s) => [s.id, s]))
  const woById = new Map((workOrders || []).map((w) => [w.id, w]))
  const prcMaps = buildPrcLookupMaps(prcs)

  const snapshotRow = (closures || []).find(
    (c) => c.period_key === periodKey && c.row_key === '__PERIOD_SNAPSHOT__' && c.status === 'CERRADO' && Array.isArray(c.snapshot_json?.rows)
  )
  if (snapshotRow) {
    const hydratedRows = snapshotRow.snapshot_json.rows.map((r) => {
      const prcRecord = r.prcNumber ? prcMaps.byNumber.get(Number(r.prcNumber)) || null : null
      return {
        ...r,
        shipRecord: r.shipId ? shipById.get(r.shipId) || null : null,
        workOrder: r.workOrderId ? woById.get(r.workOrderId) || null : null,
        prcRecord,
        prcAdditionals: prcRecord ? (prcMaps.additionalsByParentId.get(prcRecord.id) || []) : [],
      }
    })
    return {
      isClosed: true,
      closureMeta: snapshotRow,
      rows: hydratedRows,
      totals: snapshotRow.snapshot_json.totals || { totalHours: 0, totalGrossArs: 0, totalMaterialsArs: 0, totalAdvancesArs: 0, totalNetPayableArs: 0 },
      fortnightDollarRate: Number(snapshotRow.snapshot_json.dollarRate || snapshotRow.dollar_rate_materials || deductionsData?.fortnightDollarRate || 1500),
    }
  }

  const excludedWorkshops = buildExcludedWorkshopSet(ccAccounts)
  const workerById = new Map((workers || []).map((w) => [w.id, w]))
  const workerByName = new Map((workers || []).map((w) => [normalizeUpper(w.name), w]))
  const obsByRowKey = new Map((closures || []).filter((c) => c.row_key !== '__PERIOD_SNAPSHOT__').map((c) => [c.row_key, c.observations || '']))
  const fortnightDollarRate = Number(deductionsData?.fortnightDollarRate) || 1500
  const rowMap = new Map()

  const ensureRow = ({ rowKey, contractorLabel, worker, shipId = null, workOrderId = null, workType = 'HORA', prcRecord = null }) => {
    if (!rowMap.has(rowKey)) {
      const ship = shipId ? shipById.get(shipId) || null : null
      const wo = workOrderId ? woById.get(workOrderId) || null : null
      rowMap.set(rowKey, {
        rowKey, contractorLabel, baseGroup: getBaseContractorGroup(contractorLabel), worker,
        shipId: shipId || wo?.ship_id || null, shipRecord: ship, shipName: ship?.name || 'GENERAL / ASTILLERO',
        workOrderId: workOrderId || null, workOrder: wo, otIds: new Set(workOrderId ? [workOrderId] : []),
        workType, prcRecord: prcRecord || null, prcNumber: prcRecord?.prc_number || null,
        hours: 0, hourlyRateArs: resolveContractorHourlyRateArs({ contractorLabel, worker, rateCards, periodKey }),
        grossArs: 0, materialsArs: 0, advancesArs: 0, netPayableArs: 0,
        prcTotalArs: 0, prcAdditionals: [], prcCumulativeHours: 0, progressPct: null, estimatedHours: 0,
        prcStatus: prcRecord?.status || (workType === 'PRESUPUESTO' ? 'PENDIENTE' : '—'),
        observations: obsByRowKey.get(rowKey) || '', bandStyle: getContractorBandStyle(contractorLabel),
      })
    }
    return rowMap.get(rowKey)
  }

  for (const log of laborLogs || []) {
    if (!log || getFortnightPeriodKey(log.date_logged) !== periodKey) continue
    const w = matchWorkerForLog(log, workerById, workerByName)
    const contractorLabel = String(w?.work_group || log.worker_name || '').trim()
    if (!contractorLabel || isExcludedWorkshopOrStaff({ contractorLabel, worker: w, workType: log.work_type, workerType: log.worker_type, excludedWorkshops })) continue

    const workType = normalizeUpper(log.work_type) === 'PRESUPUESTO' ? 'PRESUPUESTO' : 'HORA'
    const hrs = Number(log.hours_worked ?? ((Number(log.hours_normal) || 0) + (Number(log.hours_extra_50) || 0) + (Number(log.hours_extra_100) || 0))) || 0
    const wo = log.work_order_id ? woById.get(log.work_order_id) || null : null
    const shipId = log.ship_id || wo?.ship_id || null
    const prcRecord = workType === 'PRESUPUESTO' ? matchOfficialPrc({ contractorLabel, shipId, workOrderId: log.work_order_id, prcs }) : null
    const rowKey = workType === 'PRESUPUESTO'
      ? `${normalizeUpper(contractorLabel)}|${shipId || 'NONE'}|PRC|${prcRecord?.id || log.work_order_id || 'NONE'}`
      : `${normalizeUpper(contractorLabel)}|${shipId || 'NONE'}|HORA`

    const entry = ensureRow({ rowKey, contractorLabel, worker: w, shipId, workOrderId: log.work_order_id, workType, prcRecord })
    entry.hours = round2(entry.hours + hrs)
    if (log.work_order_id) {
      entry.otIds.add(log.work_order_id)
      if (!entry.workOrder) { entry.workOrderId = log.work_order_id; entry.workOrder = wo }
    }
  }

  const pendingPanol = buildPendingPanolBatches(deductionsData, ccMovements)
  const absorbedPanolByGroup = new Map()
  const advancesByPrcId = new Map()
  const periodAdvances = []

  for (const mv of ccMovements || []) {
    const sign = mv.direction === 'HABER' ? -1 : 1
    const amt = Number(mv.amount_ars || 0) * sign
    const gKey = normalizeContractorKey(mv.contractor_group)
    if (mv.category === 'RTO_PANOL') {
      if (mv.period_key === periodKey) absorbedPanolByGroup.set(gKey, round2((absorbedPanolByGroup.get(gKey) || 0) + Number(mv.amount_ars || 0)))
      continue
    }
    if (mv.category === 'DEVENGADO_QUINCENA' || mv.category === 'DEVENGADO_PRC') continue
    if (mv.prc_id) advancesByPrcId.set(mv.prc_id, round2((advancesByPrcId.get(mv.prc_id) || 0) + amt))
    else if (mv.period_key === periodKey) periodAdvances.push({ ...mv, signedAdvArs: amt })
  }

  const pickRowForContractor = (contractorLabel, shipId = null) => {
    const w = workerByName.get(normalizeUpper(contractorLabel)) || (workers || []).find((x) => normalizeUpper(x.work_group) === normalizeUpper(contractorLabel)) || null
    if (isExcludedWorkshopOrStaff({ contractorLabel, worker: w, excludedWorkshops })) return null
    const list = Array.from(rowMap.values()).filter((r) => normalizeUpper(r.contractorLabel) === normalizeUpper(contractorLabel))
    const hit = (shipId && list.find((r) => r.shipId === shipId)) || list.find((r) => r.workType === 'HORA') || list[0]
    if (hit) return hit
    return ensureRow({ rowKey: `${normalizeUpper(contractorLabel)}|${shipId || 'NONE'}|HORA`, contractorLabel, worker: w, shipId, workType: 'HORA' })
  }

  for (const b of pendingPanol.pendingBatches || []) {
    const row = pickRowForContractor(b.contractorLabel)
    if (row) row.materialsArs = round2(row.materialsArs + b.pendingTotalArs)
  }
  for (const [gKey, matArs] of absorbedPanolByGroup.entries()) {
    const row = pickRowForContractor(gKey)
    if (row) row.materialsArs = round2(row.materialsArs + matArs)
  }
  for (const mv of periodAdvances) {
    const row = pickRowForContractor(mv.contractor_group, mv.ship_id || null)
    if (row) row.advancesArs = round2(row.advancesArs + mv.signedAdvArs)
  }

  const rows = Array.from(rowMap.values()).map((row) => {
    const otList = Array.from(row.otIds).map((id) => woById.get(id)).filter(Boolean)
    if (row.workType === 'PRESUPUESTO' && row.prcRecord) {
      const { totalArs, additionals } = getPrcTotalWithAdditionals(row.prcRecord, prcMaps)
      const cumHours = round2(
        (laborLogs || [])
          .filter((l) => l && normalizeUpper(l.work_type) === 'PRESUPUESTO' && (l.work_order_id === row.prcRecord.work_order_id || l.work_item_id === row.prcRecord.work_item_id))
          .filter((l) => getBaseContractorGroup((matchWorkerForLog(l, workerById, workerByName)?.work_group) || l.worker_name) === row.baseGroup)
          .reduce((s, l) => s + Number(l.hours_worked || l.hours_normal || 0), 0)
      )
      const { estimatedHours, progressPct } = computePrcProgress({ prcTotalArs: totalArs, hourlyRateArs: row.hourlyRateArs, cumulativeHours: cumHours })
      Object.assign(row, {
        prcTotalArs: totalArs, prcAdditionals: additionals, prcCumulativeHours: cumHours,
        estimatedHours, progressPct, grossArs: totalArs,
        advancesArs: round2(row.advancesArs + (advancesByPrcId.get(row.prcRecord.id) || 0)),
      })
    } else {
      const legacyTp = row.workType === 'PRESUPUESTO'
        ? (thirdPartyServices || []).find((t) => normalizeUpper(t.contractor_name) === normalizeUpper(row.contractorLabel) && t.work_order_id === row.workOrderId && t.voucher_type === 'PRC')
        : null
      row.grossArs = legacyTp ? Number(legacyTp.amount_ars || 0) : round2(row.hours * row.hourlyRateArs)
    }
    row.otLabel = otList.length > 0 ? otList.map((o) => `${formatCanonicalOtNumberLabel(o.ot_number)} ${o.title || ''}`.trim()).join(' / ') : 'HORA GENERAL'
    row.prcDisplay = row.prcRecord ? formatPrcNumberLabel(row.prcRecord.prc_number) : (row.workType === 'PRESUPUESTO' ? 'Sin PRC' : '—')
    row.netPayableArs = round2(row.grossArs - row.materialsArs - row.advancesArs)
    return row
  })

  rows.sort((a, b) => a.baseGroup.localeCompare(b.baseGroup, 'es') || a.contractorLabel.localeCompare(b.contractorLabel, 'es') || a.shipName.localeCompare(b.shipName, 'es'))

  return {
    isClosed: false, closureMeta: null, rows, fortnightDollarRate,
    totals: {
      totalHours: round2(rows.reduce((s, r) => s + r.hours, 0)),
      totalGrossArs: round2(rows.reduce((s, r) => s + r.grossArs, 0)),
      totalMaterialsArs: round2(rows.reduce((s, r) => s + r.materialsArs, 0)),
      totalAdvancesArs: round2(rows.reduce((s, r) => s + r.advancesArs, 0)),
      totalNetPayableArs: round2(rows.reduce((s, r) => s + r.netPayableArs, 0)),
    },
  }
}
