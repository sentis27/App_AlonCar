/**
 * contractorCcService.js
 * Capa de servicio para `Cuenta Corriente & Pagos de Contratistas` (`/tesoreria?tab=movimientos`).
 * Integra movimientos CC, Base de datos de PRC (#2000+), OTs/Barcos, retiros cobrables de Pañol y Auditoría.
 */
import { logRowAction } from '../lib/auditService.js'
import { getTodayArIso } from '../lib/dateTimeCanonical.js'
import { fetchContractorDeductionsForPeriod } from '../lib/contractorDeductionsService.js'
import {
  collectAbsorbedPanolTxIds,
  DEFAULT_DIRECTION_BY_CATEGORY,
  normalizeContractorKey,
} from '../lib/contractorCcRules.js'
import { getEligiblePrcContractors } from '../lib/prcRegistryRules.js'
import { contractorCcRepository } from '../repositories/contractorCcRepository.js'
import { prcRegistryRepository } from '../repositories/prcRegistryRepository.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { shipsRepository } from '../repositories/shipsRepository.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { workItemsRepository } from '../repositories/workItemsRepository.js'
import { macroVariablesRepository } from '../repositories/macroVariablesRepository.js'

const AUDIT_META = {
  entityType: 'contractor_cc_movements',
  sheetName: 'Tesorería · Cuenta Corriente & Pagos',
  moduleRoute: '/tesoreria?tab=movimientos',
}

export async function fetchContractorCcWorkspaceData(periodKey) {
  const [movRes, prcRes, workersRes, shipsRes, woRes, wiRes, mvRes, deductionsData] = await Promise.all([
    contractorCcRepository.listMovements(),
    prcRegistryRepository.listCanonicalPrcs(),
    workersRepository.listWorkers({
      select: 'id, name, admin_center, work_group, status, trade, category',
      orderBy: [],
    }),
    shipsRepository.listShips({ select: 'id, name', orderBy: [] }),
    workOrdersRepository.listCanonicalWorkOrders(),
    workItemsRepository.listCanonicalWorkItems(),
    macroVariablesRepository.listMacroVariables(),
    fetchContractorDeductionsForPeriod(periodKey),
  ])

  if (movRes.error) throw new Error(movRes.error)
  if (prcRes.error) throw new Error(prcRes.error)
  if (workersRes.error) throw new Error(workersRes.error)
  if (shipsRes.error) throw new Error(shipsRes.error)
  if (woRes.error) throw new Error(woRes.error)
  if (wiRes.error) throw new Error(wiRes.error)

  return {
    movements: movRes.data || [],
    prcs: prcRes.data || [],
    workers: workersRes.data || [],
    eligibleContractors: getEligiblePrcContractors(workersRes.data || []),
    ships: shipsRes.data || [],
    workOrders: woRes.data || [],
    workItems: wiRes.data || [],
    macroVariables: mvRes.data || [],
    deductionsData,
  }
}

export async function saveContractorCcMovementService({ id = null, payload = {}, prcs = [], actor = 'TESORERIA' }) {
  const selectedPrc = payload.prc_id ? (prcs || []).find((p) => p.id === payload.prc_id) : null
  const amountArs = Number(payload.amount_ars || 0)
  const exchangeRate = payload.exchange_rate ? Number(payload.exchange_rate) : null
  let amountUsd = payload.amount_usd !== '' && payload.amount_usd !== null && payload.amount_usd !== undefined
    ? Number(payload.amount_usd)
    : null
  if ((amountUsd === null || amountUsd === 0) && amountArs > 0 && exchangeRate && exchangeRate > 0) {
    amountUsd = Number((amountArs / exchangeRate).toFixed(2))
  }

  const normalized = {
    movement_date: payload.movement_date || getTodayArIso(),
    period_key: String(payload.period_key || '').trim(),
    contractor_worker_id: payload.contractor_worker_id || null,
    contractor_group: String(payload.contractor_group || '').trim(),
    ship_id: payload.ship_id || null,
    work_order_id: payload.work_order_id || null,
    prc_id: selectedPrc?.id || payload.prc_id || null,
    prc_number: selectedPrc?.prc_number || (payload.prc_number ? Number(payload.prc_number) : null),
    settlement_scope: payload.settlement_scope || (selectedPrc ? 'PRESUPUESTO' : 'HORA'),
    direction: payload.direction || DEFAULT_DIRECTION_BY_CATEGORY[payload.category] || 'DEBE',
    category: payload.category,
    payment_method: payload.payment_method || null,
    payment_reference: String(payload.payment_reference || '').trim() || null,
    invoice_status: payload.invoice_status || 'NO_APLICA',
    invoice_number: String(payload.invoice_number || '').trim() || null,
    panol_remito_number: String(payload.panol_remito_number || '').trim() || null,
    inventory_transaction_ids: Array.isArray(payload.inventory_transaction_ids) ? payload.inventory_transaction_ids : [],
    amount_ars: amountArs,
    amount_usd: amountUsd,
    exchange_rate: exchangeRate,
    observations: String(payload.observations || '').trim() || null,
    source_module: payload.source_module || 'TESORERIA',
    created_by: payload.created_by || actor || 'TESORERIA',
  }

  if (id) {
    const { data, error } = await contractorCcRepository.updateMovement(id, normalized)
    if (error) throw new Error(error)
    await logRowAction({
      ...AUDIT_META,
      action: 'MODAL_SAVE',
      entityId: id,
      entityName: `${normalized.contractor_group} · ${normalized.category}`,
      rowData: normalized,
      changeOrigin: 'TESORERIA_CC_EDIT',
      user: actor,
    })
    return data
  }

  const { data, error } = await contractorCcRepository.insertMovement(normalized)
  if (error) throw new Error(error)
  await logRowAction({
    ...AUDIT_META,
    action: 'ROW_INSERT',
    entityId: data?.id || null,
    entityName: `${normalized.contractor_group} · ${normalized.category}`,
    rowData: normalized,
    changeOrigin: 'TESORERIA_CC_INSERT',
    user: actor,
  })
  return data
}

export async function deleteContractorCcMovementService({ row, actor = 'TESORERIA' }) {
  if (!row?.id) throw new Error('Movimiento inválido para eliminar.')
  const { error } = await contractorCcRepository.deleteMovement(row.id)
  if (error) throw new Error(error)

  await logRowAction({
    ...AUDIT_META,
    action: 'ROW_DELETE',
    entityId: row.id,
    entityName: `${row.contractor_group} · ${row.category}`,
    rowData: {
      period_key: row.period_key,
      amount_ars: row.amount_ars,
      released_panol_tx_count: Array.isArray(row.inventory_transaction_ids) ? row.inventory_transaction_ids.length : 0,
    },
    changeOrigin: 'TESORERIA_CC_DELETE',
    user: actor,
  })
  return true
}

function matchWorkerIdByGroup(contractorGroup, workers = []) {
  const key = normalizeContractorKey(contractorGroup)
  const hit = (workers || []).find(
    (w) => normalizeContractorKey(w.work_group) === key || normalizeContractorKey(w.name) === key
  )
  return hit?.id || null
}

export async function absorbPanolBatchToCcService({
  pendingBatch,
  periodKey,
  periodEndDate,
  fortnightDollarRate,
  workers = [],
  existingMovements = [],
  actor = 'TESORERIA',
}) {
  const absorbedSet = collectAbsorbedPanolTxIds(existingMovements)
  const freshItems = (pendingBatch?.pendingItems || []).filter((item) => item?.id && !absorbedSet.has(String(item.id)))
  if (freshItems.length === 0) {
    throw new Error(`Todos los retiros de Pañol de ${pendingBatch?.contractorLabel || 'este contratista'} ya fueron imputados en CC.`)
  }

  const freshTxIds = freshItems.map((i) => i.id)
  const consumablesArs = freshItems
    .filter((i) => i?.classification?.bucket !== 'SAFETY_CONTRACTOR_DEDUCTION')
    .reduce((s, i) => s + Number(i?.classification?.deductArs || 0), 0)
  const safetyArs = freshItems
    .filter((i) => i?.classification?.bucket === 'SAFETY_CONTRACTOR_DEDUCTION')
    .reduce((s, i) => s + Number(i?.classification?.deductArs || 0), 0)
  const totalArs = Number((consumablesArs + safetyArs).toFixed(2))
  const totalUsd = Number(freshItems.reduce((s, i) => s + Number(i?.classification?.deductUsd || 0), 0).toFixed(2))
  const fx = Number(fortnightDollarRate) > 0 ? Number(fortnightDollarRate) : null

  const today = getTodayArIso()
  const movementDate = periodEndDate && periodEndDate <= today ? periodEndDate : today
  const workerId = matchWorkerIdByGroup(pendingBatch.contractorLabel, workers)
  const obs = [
    `Pase automático Pañol ${periodKey} (${freshItems.length} retiros)`,
    consumablesArs > 0 ? `Consumibles AR$ ${consumablesArs.toFixed(2)}` : null,
    safetyArs > 0 ? `EPP AR$ ${safetyArs.toFixed(2)}` : null,
    fx ? `TC Quincenal AR$ ${fx}` : null,
  ].filter(Boolean).join(' · ')

  const payload = {
    movement_date: movementDate,
    period_key: periodKey,
    contractor_worker_id: workerId,
    contractor_group: pendingBatch.contractorLabel,
    settlement_scope: 'HORA',
    direction: 'DEBE',
    category: 'RTO_PANOL',
    payment_method: 'COMPENSACION_PANOL',
    invoice_status: 'NO_APLICA',
    inventory_transaction_ids: freshTxIds,
    amount_ars: totalArs,
    amount_usd: totalUsd,
    exchange_rate: fx,
    observations: obs,
    source_module: 'PANOL_SYNC',
    created_by: actor || 'TESORERIA',
  }

  const { data, error } = await contractorCcRepository.insertMovement(payload)
  if (error) throw new Error(error)

  await logRowAction({
    ...AUDIT_META,
    action: 'ROW_INSERT',
    entityId: data?.id || null,
    entityName: `${pendingBatch.contractorLabel} · RTO_PANOL (${freshTxIds.length} ítems)`,
    rowData: payload,
    changeOrigin: 'TESORERIA_PANOL_ABSORB',
    user: actor,
  })

  return data
}
