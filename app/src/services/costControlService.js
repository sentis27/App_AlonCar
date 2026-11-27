/**
 * costControlService.js
 * Capa de servicio y persistencia auditada para Control de Gastos (GS-010 / DEC-025).
 * Opera 100% vía repositorios y registra toda mutación en `audit_logs`.
 */
import { logRowAction } from '../lib/auditService.js'
import { buildArTimestampIso, toArIsoDate } from '../lib/dateTimeCanonical.js'
import {
  buildCostControlSnapshot, getCurrentQuincenaKeyAr, getPreviousQuincenaKey, getQuincenaRangeAr,
} from '../lib/costControlEngine.js'
import {
  COST_CONTROL_EXCLUDED_OTS_KEY, DEFAULT_EXCLUDED_COST_CONTROL_OTS,
  buildMaterialExceptionReviewKey, buildLaborOnlyApprovalReviewKey,
} from '../schemas/costControl.schema.js'
import { inventoryTransactionsRepository } from '../repositories/inventoryTransactionsRepository.js'
import { laborLogsRepository } from '../repositories/laborLogsRepository.js'
import { thirdPartyServicesRepository } from '../repositories/thirdPartyServicesRepository.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { shipsRepository } from '../repositories/shipsRepository.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { workItemsRepository } from '../repositories/workItemsRepository.js'
import { materialsRepository } from '../repositories/materialsRepository.js'
import { costControlReviewsRepository } from '../repositories/costControlReviewsRepository.js'
import { systemSettingsRepository } from '../repositories/systemSettingsRepository.js'

const ROUTE = '/control-gastos'

function isMissingTableError(errMsg) {
  const msg = String(errMsg || '').toLowerCase()
  return msg.includes('cost_control_reviews') && (msg.includes('does not exist') || msg.includes('could not find the table') || msg.includes('42p01'))
}

export async function fetchCostControlDataService(periodKey = getCurrentQuincenaKeyAr()) {
  const currentRange = getQuincenaRangeAr(periodKey)
  const prevPeriodKey = getPreviousQuincenaKey(currentRange.periodKey)
  const prevRange = getQuincenaRangeAr(prevPeriodKey)

  const [txRes, laborRes, tpRes, workersRes, shipsRes, woRes, wiRes, matsRes, reviewsRes, settingRes] = await Promise.all([
    inventoryTransactionsRepository.listTransactions({ dateRange: { column: 'transaction_date', from: currentRange.startDate, to: currentRange.endIsoAr } }),
    laborLogsRepository.listLaborLogs({ dateRange: { column: 'date_logged', from: prevRange.startDate, to: currentRange.endDate } }),
    thirdPartyServicesRepository.listServices(),
    workersRepository.listWorkers({ select: 'id, name, category, trade, work_group, admin_center, status, can_impute_hours, can_charge_third_party', orderBy: [{ column: 'name', ascending: true }] }),
    shipsRepository.listShips({ select: 'id, name, status, is_active' }),
    workOrdersRepository.listCanonicalWorkOrders(),
    workItemsRepository.listCanonicalWorkItems(),
    materialsRepository.listMaterials({ select: 'id, name, unit_measure, category, rubro' }),
    costControlReviewsRepository.listByPeriods([currentRange.periodKey, prevPeriodKey]),
    systemSettingsRepository.getByKey(COST_CONTROL_EXCLUDED_OTS_KEY),
  ])

  const criticalErr = [txRes, laborRes, workersRes, shipsRes, woRes].find((r) => r?.error)?.error
  if (criticalErr) throw new Error(criticalErr)
  const reviewsTableMissing = Boolean(reviewsRes?.error && isMissingTableError(reviewsRes.error))
  if (reviewsRes?.error && !reviewsTableMissing) throw new Error(reviewsRes.error)

  const excludedOtNames = Array.isArray(settingRes?.data?.value) && settingRes.data.value.length > 0
    ? settingRes.data.value
    : DEFAULT_EXCLUDED_COST_CONTROL_OTS

  const raw = {
    transactions: txRes.data || [],
    laborLogs: laborRes.data || [],
    thirdPartyServices: tpRes.data || [],
    workers: workersRes.data || [],
    ships: shipsRes.data || [],
    workOrders: woRes.data || [],
    workItems: wiRes.data || [],
    materials: matsRes.data || [],
    reviews: reviewsTableMissing ? [] : (reviewsRes.data || []),
    excludedOtNames,
  }
  const snapshot = buildCostControlSnapshot({ periodKey: currentRange.periodKey, ...raw })
  return {
    periodKey: currentRange.periodKey,
    prevPeriodKey,
    snapshot,
    raw,
    warnings: { reviewsTableMissing, thirdPartyError: tpRes?.error || null, materialsError: matsRes?.error || null },
  }
}

export async function batchUpdateMaterialsAllocationService({ txIds = [], patch = {}, previousRows = [], changedBy = 'Administrador' } = {}) {
  const cleanIds = [...new Set((txIds || []).filter(Boolean))]
  if (cleanIds.length === 0) return { ok: true, count: 0, updated: [] }

  const dbPatch = {}
  if ('ship_id' in patch) dbPatch.ship_id = patch.ship_id || null
  if ('work_order_id' in patch) dbPatch.work_order_id = patch.work_order_id || null
  if ('work_item_id' in patch) dbPatch.work_item_id = patch.work_item_id || null
  if (patch.dateArIso || patch.transaction_date) dbPatch.transaction_date = buildArTimestampIso(patch.dateArIso || patch.transaction_date)
  if (Object.keys(dbPatch).length === 0) throw new Error('No se indicaron campos válidos para actualizar en Materiales.')

  const prevById = new Map((previousRows || []).map((r) => [r.id, r]))
  const updated = []
  for (const id of cleanIds) {
    const { data, error } = await inventoryTransactionsRepository.updateById(id, dbPatch, { select: '*' })
    if (error) throw new Error(error)
    updated.push(data)
    const prev = prevById.get(id) || {}
    await logRowAction({
      action: 'MODAL_SAVE', entityType: 'inventory_transactions', entityId: id,
      entityName: `${prev.materialName || 'Material'} (${prev.voucherNumber || id})`,
      changes: dbPatch, sheetName: 'Control de Gastos · Materiales', moduleRoute: ROUTE,
      changeOrigin: cleanIds.length > 1 ? 'COST_CONTROL_BATCH' : 'COST_CONTROL_INLINE', user: changedBy,
    })
  }
  return { ok: true, count: updated.length, updated }
}

export async function updateLaborLogFromCostControlService({ logId, patch = {}, previousLog = null, changedBy = 'Administrador' } = {}) {
  if (!logId) throw new Error('ID de parte de horas requerido.')
  const dbPatch = {}
  for (const k of ['ship_id', 'work_order_id', 'work_item_id', 'hours_normal', 'hours_extra_50', 'hours_extra_100', 'notes']) {
    if (k in patch) dbPatch[k] = patch[k]
  }
  if (patch.date_logged) dbPatch.date_logged = toArIsoDate(patch.date_logged)
  if ('hours_normal' in dbPatch || 'hours_extra_50' in dbPatch || 'hours_extra_100' in dbPatch) {
    const hN = Number(dbPatch.hours_normal ?? previousLog?.hours_normal ?? 0) || 0
    const h50 = Number(dbPatch.hours_extra_50 ?? previousLog?.hours_extra_50 ?? 0) || 0
    const h100 = Number(dbPatch.hours_extra_100 ?? previousLog?.hours_extra_100 ?? 0) || 0
    dbPatch.hours_worked = Number((hN + h50 + h100).toFixed(2))
  } else if ('hours_worked' in patch) {
    dbPatch.hours_worked = Number(patch.hours_worked) || 0
  }

  const { data, error } = await laborLogsRepository.updateById(logId, dbPatch, { select: '*' })
  if (error) throw new Error(error)
  await logRowAction({
    action: 'MODAL_SAVE', entityType: 'daily_labor_logs', entityId: logId,
    entityName: `${previousLog?.worker_name || data?.worker_name || 'Operario'} · ${toArIsoDate(dbPatch.date_logged || previousLog?.date_logged)}`,
    changes: dbPatch, sheetName: 'Control de Gastos · Espejo de Horas', moduleRoute: ROUTE,
    changeOrigin: 'COST_CONTROL_HOURS_EDIT', user: changedBy,
  })
  return { ok: true, log: data }
}

export async function splitLaborLogForMaterialService({
  sourceLog, sourceNextHours, newRowHours, targetShipId, targetWorkOrderId, targetWorkItemId = null, notes = '', changedBy = 'Administrador',
} = {}) {
  if (!sourceLog?.id) throw new Error('Fila de horas origen requerida para desdoblar.')
  const cleanNewHours = Number(Number(newRowHours).toFixed(2))
  const cleanSourceTotal = Number(Number(sourceNextHours).toFixed(2))
  if (!Number.isFinite(cleanNewHours) || cleanNewHours <= 0) throw new Error('Las horas de la nueva línea desdoblada deben ser mayores a 0.')
  if (!Number.isFinite(cleanSourceTotal) || cleanSourceTotal < 0) throw new Error('Las horas restantes de la fila origen no pueden ser negativas.')

  const extraSum = Number(sourceLog.hours_extra_50 || 0) + Number(sourceLog.hours_extra_100 || 0)
  const sourcePatch = cleanSourceTotal >= extraSum
    ? { hours_normal: Number((cleanSourceTotal - extraSum).toFixed(2)), hours_worked: cleanSourceTotal }
    : { hours_normal: cleanSourceTotal, hours_extra_50: 0, hours_extra_100: 0, hours_worked: cleanSourceTotal }

  const { data: updatedSource, error: updErr } = await laborLogsRepository.updateById(sourceLog.id, sourcePatch, { select: '*' })
  if (updErr) throw new Error(updErr)

  const newPayload = {
    worker_id: sourceLog.worker_id || null, worker_name: sourceLog.worker_name,
    ship_id: targetShipId || null, work_order_id: targetWorkOrderId || null, work_item_id: targetWorkItemId || null,
    date_logged: toArIsoDate(sourceLog.date_logged), rubro: sourceLog.rubro || null,
    work_type: sourceLog.work_type || 'HORA', cost_center: sourceLog.cost_center || 'CLIENTE',
    approval_status: sourceLog.approval_status || 'Aprobado',
    hours_normal: cleanNewHours, hours_extra_50: 0, hours_extra_100: 0, hours_worked: cleanNewHours,
    notes: notes || sourceLog.notes || null,
  }
  const { data: createdLog, error: insErr } = await laborLogsRepository.insertOne(newPayload, { select: '*' })
  if (insErr) throw new Error(insErr)

  await logRowAction({
    action: 'ROW_DUPLICATE', entityType: 'daily_labor_logs', entityId: createdLog.id,
    entityName: `Desdoble ${sourceLog.worker_name} · ${newPayload.date_logged}`,
    changes: { source_log_id: sourceLog.id, source_next_hours: cleanSourceTotal, new_row_hours: cleanNewHours, target_ship_id: targetShipId, target_work_order_id: targetWorkOrderId },
    sheetName: 'Control de Gastos · Desdoble de Horas', moduleRoute: ROUTE,
    changeOrigin: 'COST_CONTROL_SPLIT', user: changedBy,
  })
  return { ok: true, updatedSource, createdLog }
}

export async function saveCostControlReviewService(payload = {}) {
  const reviewType = payload.review_type
  const reviewKey = payload.review_key || (
    reviewType === 'MATERIAL_EXCEPTION'
      ? buildMaterialExceptionReviewKey(payload.inventory_transaction_id)
      : buildLaborOnlyApprovalReviewKey({ periodKey: payload.period_key, shipId: payload.ship_id, workOrderId: payload.work_order_id, contractorEntity: payload.contractor_entity })
  )
  const { data, error } = await costControlReviewsRepository.upsertByReviewKey({ ...payload, review_key: reviewKey, reviewed_at: new Date().toISOString() })
  if (error) throw new Error(error)

  await logRowAction({
    action: 'ROW_INSERT', entityType: 'cost_control_reviews', entityId: data?.id || reviewKey,
    entityName: `${reviewType} · ${payload.contractor_entity}`,
    changes: { review_key: reviewKey, period_key: payload.period_key, reason: payload.reason || null },
    sheetName: 'Control de Gastos · Revisiones', moduleRoute: ROUTE,
    changeOrigin: 'COST_CONTROL_REVIEW', user: payload.reviewed_by || 'Administrador',
  })
  return { ok: true, review: data }
}

export async function revokeCostControlReviewService({ reviewKey, reviewedBy = 'Administrador' } = {}) {
  const { error } = await costControlReviewsRepository.deleteByReviewKey(reviewKey)
  if (error) throw new Error(error)
  await logRowAction({
    action: 'ROW_DELETE', entityType: 'cost_control_reviews', entityId: reviewKey,
    entityName: `Revocar ${reviewKey}`, changes: { review_key: reviewKey },
    sheetName: 'Control de Gastos · Revisiones', moduleRoute: ROUTE,
    changeOrigin: 'COST_CONTROL_REVIEW', user: reviewedBy,
  })
  return { ok: true }
}
