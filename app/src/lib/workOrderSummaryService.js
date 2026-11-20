/**
 * workOrderSummaryService.js
 * Consultas de resumen de movimientos vinculados (PAÑOL, TERCEROS, COMPRAS, HORAS)
 * y validación servidor contra duplicados de título de OT por buque.
 */

import { classifyWithdrawalCost } from './workCostRules.js'
import { matchTransactionWorker } from './contractorDeductionsService.js'
import { getDollarRateForDate } from './tercerosConstants.js'
import { resolveDollarReference, enrichLaborLogs, enrichThirdPartyServices } from './managerialSummaryService.js'
import { normalizeOtTitleKey, findDuplicateOtNameConflict } from './workOrderUnificationEngine.js'
import { workItemsRepository } from '../repositories/workItemsRepository.js'
import { inventoryTransactionsRepository } from '../repositories/inventoryTransactionsRepository.js'
import { thirdPartyServicesRepository } from '../repositories/thirdPartyServicesRepository.js'
import { purchaseOrdersRepository, purchaseDocumentsRepository } from '../repositories/purchaseOrdersRepository.js'
import { laborLogsRepository } from '../repositories/laborLogsRepository.js'
import { gasMovementsRepository } from '../repositories/gasMovementsRepository.js'
import { materialsRepository } from '../repositories/materialsRepository.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { rateCardsRepository } from '../repositories/rateCardsRepository.js'
import { macroVariablesRepository } from '../repositories/macroVariablesRepository.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'

const EMPTY_ROWS = [
  { key: 'panol', label: 'PAÑOL', count: 0, totalUsd: 0 },
  { key: 'terceros', label: 'TERCEROS', count: 0, totalUsd: 0 },
  { key: 'compras', label: 'COMPRAS', count: 0, totalUsd: 0 },
  { key: 'horas', label: 'HORAS', count: 0, totalUsd: 0 },
]

async function fetchWoScopedRecords(woId) {
  const [wiRes, invRes, tpRes, poRes, logRes, gasRes, docRes] = await Promise.all([
    workItemsRepository.listCanonicalWorkItems({
      filters: { work_order_id: woId },
    }),
    inventoryTransactionsRepository.listTransactions({
      select: 'id, material_id, work_order_id, work_item_id, ship_id, worker_id, worker_name, contractor_name, movement_type, quantity_withdrawn, unit_cost_ars_snapshot, unit_cost_usd_snapshot, cost_center, transaction_date, is_deletion_requested',
      filters: { work_order_id: woId },
      orderBy: [],
    }),
    thirdPartyServicesRepository.listServices({
      select: 'id, ship_id, work_order_id, work_item_id, contractor_name, trade, voucher_type, voucher_number, invoice_number, supplier_remito_number, budget_number, internal_remito_number, amount_ars, usd_rate, amount_usd, service_date, entry_date, created_at, is_active',
      filters: { work_order_id: woId },
      orderBy: [],
    }),
    purchaseOrdersRepository.listOrders({
      select: 'id, ship_id, work_order_id, charge_type, status, material_id, quantity, received_quantity, supplier_quoted_price, system_unit_price, currency, order_date, delivery_date, created_at',
      filters: { work_order_id: woId },
      orderBy: [],
    }),
    laborLogsRepository.listLaborLogs({
      select: 'id, ship_id, work_order_id, work_item_id, worker_id, worker_name, worker_type, rubro, work_type, cost_center, hours_worked, hours_normal, hours_extra_50, hours_extra_100, approval_status, date_logged, notes',
      filters: { work_order_id: woId },
      orderBy: [],
      limit: null,
    }),
    gasMovementsRepository.listGasMovements({ select: 'id', filters: { work_order_id: woId }, orderBy: [], limit: null }),
    purchaseDocumentsRepository.listDocuments({ select: 'id', filters: { work_order_id: woId }, orderBy: [] }),
  ])
  const firstErr = [wiRes.error, invRes.error, tpRes.error, poRes.error, logRes.error].find(Boolean)
  if (firstErr) throw new Error(firstErr)
  return {
    workItems: wiRes.data || [],
    inventoryTx: invRes.data || [],
    thirdPartyServices: tpRes.data || [],
    purchaseOrders: poRes.data || [],
    laborLogs: logRes.data || [],
    gasMovements: gasRes.data || [],
    purchaseDocuments: docRes.data || [],
  }
}

export async function fetchWorkOrderTransferSummaryService(workOrderId) {
  if (!workOrderId) return { rows: EMPTY_ROWS, workItemsCount: 0, totalMovements: 0 }

  const [scoped, matRes, wkrRes, rcRes, mvRes, woRes] = await Promise.all([
    fetchWoScopedRecords(workOrderId),
    materialsRepository.listMaterials({ select: 'id, name, category, cost_ars, cost_usd', orderBy: [] }),
    workersRepository.listWorkers({
      select: 'id, name, work_group, trade, admin_center, category, hourly_rate_ars, hourly_rate_usd, consumables, consumables_discount_pct, safety_items',
      orderBy: [],
    }),
    rateCardsRepository.listRateCards({
      select: 'id, period, year, month, quincena, admin_center, entity_name, rate_oficial_ars, rate_oficial_usd, has_ayudante, rate_ayudante_ars, rate_ayudante_usd, dollar_rate',
    }),
    macroVariablesRepository.listMacroVariables(),
    workOrdersRepository.listWorkOrders({
      select: 'id, ship_id, ot_number, title, description, work_type',
      filters: { id: workOrderId },
      orderBy: [],
    }),
  ])

  const materials = matRes.data || []
  const workers = wkrRes.data || []
  const rateCards = rcRes.data || []
  const macroVariables = mvRes.data || []
  const workOrders = woRes.data || []
  const defaultDollarRate = resolveDollarReference(macroVariables, rateCards)
  const matMap = new Map(materials.map((m) => [m.id, m]))

  const activeInv = scoped.inventoryTx.filter((t) => !t.is_deletion_requested)
  const panolUsd = activeInv.reduce((acc, tx) => {
    const mat = matMap.get(tx.material_id) || null
    const worker = matchTransactionWorker(tx, workers)
    const cls = classifyWithdrawalCost({ material: mat, transaction: tx, worker })
    if (cls.shipDirectUsd > 0) return acc + cls.shipDirectUsd
    if (cls.totalUsd > 0) return acc + cls.totalUsd
    const unitArs = Number(tx.unit_cost_ars_snapshot || mat?.cost_ars || 0)
    const dateStr = String(tx.transaction_date || '').slice(0, 10)
    const tc = getDollarRateForDate(dateStr, macroVariables) || defaultDollarRate || 1500
    const qty = Number(tx.quantity_withdrawn || 0)
    return acc + (tc > 0 && unitArs > 0 ? (qty * unitArs) / tc : 0)
  }, 0)

  const activeTps = scoped.thirdPartyServices.filter((s) => s.is_active !== false)
  const enrichedTps = enrichThirdPartyServices({ thirdPartyServices: activeTps, workOrders, macroVariables, defaultDollarRate })
  const tercerosUsd = enrichedTps.reduce((acc, t) => acc + (Number(t.amountUsd) || 0), 0)

  const comprasUsd = scoped.purchaseOrders.reduce((acc, po) => {
    const qty = Number(po.received_quantity || po.quantity || 0)
    const price = Number(po.supplier_quoted_price || po.system_unit_price || 0)
    if (qty <= 0 || price <= 0) return acc
    const isUsd = String(po.currency || '').trim().toUpperCase() === 'USD'
    const poDate = String(po.delivery_date || po.order_date || po.created_at || '').slice(0, 10)
    const tc = getDollarRateForDate(poDate, macroVariables) || defaultDollarRate || 1500
    return acc + (isUsd ? qty * price : tc > 0 ? (qty * price) / tc : 0)
  }, 0)

  const enrichedLogs = enrichLaborLogs({
    laborLogs: scoped.laborLogs,
    workers,
    rateCards,
    workOrders,
    workItems: scoped.workItems,
    defaultDollarRate,
  })
  const horasUsd = enrichedLogs.reduce((acc, l) => acc + (Number(l.costUsd) || 0), 0)

  const rows = [
    { key: 'panol', label: 'PAÑOL', count: activeInv.length, totalUsd: Math.round(panolUsd) },
    { key: 'terceros', label: 'TERCEROS', count: activeTps.length, totalUsd: Math.round(tercerosUsd) },
    { key: 'compras', label: 'COMPRAS', count: scoped.purchaseOrders.length, totalUsd: Math.round(comprasUsd) },
    { key: 'horas', label: 'HORAS', count: scoped.laborLogs.length, totalUsd: Math.round(horasUsd) },
  ]

  return {
    rows,
    workItemsCount: scoped.workItems.length,
    totalMovements: rows.reduce((s, r) => s + r.count, 0),
  }
}

export async function assertNoDuplicateOtTitleInDb({ shipId, title, excludeWoId = null }) {
  const norm = normalizeOtTitleKey(title)
  if (!shipId || !norm) return

  const { data: shipWos, error: woErr } = await workOrdersRepository.listWorkOrders({
    select: 'id, ship_id, ot_number, title, status, notes, merged_into_wo_id',
    filters: { ship_id: shipId },
    orderBy: [],
  })
  if (woErr) throw new Error(woErr)

  const woIds = (shipWos || []).map((w) => w.id)
  let items = []
  if (woIds.length > 0) {
    const { data: itemRows } = await workItemsRepository.listByWorkOrderIds(woIds)
    items = itemRows || []
  }

  const conflict = findDuplicateOtNameConflict(shipWos || [], items, shipId, norm, excludeWoId)
  if (conflict) throw new Error(conflict.message)
}
