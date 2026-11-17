/**
 * workOrderSummaryService.js
 * Consultas de resumen de movimientos vinculados (PAÑOL, TERCEROS, COMPRAS, HORAS)
 * y validación servidor contra duplicados de título de OT por buque.
 */

import { supabase } from './supabase.js'
import { classifyWithdrawalCost } from './workCostRules.js'
import { matchTransactionWorker } from './contractorDeductionsService.js'
import { getDollarRateForDate } from './tercerosConstants.js'
import { resolveDollarReference, enrichLaborLogs, enrichThirdPartyServices } from './managerialSummaryService.js'
import { normalizeOtTitleKey, findDuplicateOtNameConflict } from './workOrderUnificationEngine.js'

const EMPTY_ROWS = [
  { key: 'panol', label: 'PAÑOL', count: 0, totalUsd: 0 },
  { key: 'terceros', label: 'TERCEROS', count: 0, totalUsd: 0 },
  { key: 'compras', label: 'COMPRAS', count: 0, totalUsd: 0 },
  { key: 'horas', label: 'HORAS', count: 0, totalUsd: 0 }
]

async function fetchWoScopedRecords(woId) {
  const [wiRes, invRes, tpRes, poRes, logRes, gasRes, docRes] = await Promise.all([
    supabase.from('work_items').select('id, work_order_id, description, status, work_type').eq('work_order_id', woId),
    supabase.from('inventory_transactions').select('id, material_id, work_order_id, work_item_id, ship_id, worker_id, worker_name, contractor_name, movement_type, quantity_withdrawn, unit_cost_ars_snapshot, unit_cost_usd_snapshot, cost_center, transaction_date, is_deletion_requested').eq('work_order_id', woId),
    supabase.from('third_party_services').select('id, ship_id, work_order_id, work_item_id, contractor_name, trade, voucher_type, voucher_number, invoice_number, supplier_remito_number, budget_number, internal_remito_number, amount_ars, usd_rate, amount_usd, service_date, entry_date, created_at, is_active').eq('work_order_id', woId),
    supabase.from('purchase_orders').select('id, ship_id, work_order_id, charge_type, status, material_id, quantity, received_quantity, supplier_quoted_price, system_unit_price, currency, order_date, delivery_date, created_at').eq('work_order_id', woId),
    supabase.from('labor_logs').select('id, ship_id, work_order_id, work_item_id, worker_id, worker_name, worker_type, rubro, work_type, cost_center, hours_worked, hours_normal, hours_extra_50, hours_extra_100, approval_status, date_logged, notes').eq('work_order_id', woId),
    supabase.from('gas_cylinder_movements').select('id').eq('work_order_id', woId),
    supabase.from('purchase_documents').select('id').eq('work_order_id', woId)
  ])
  const firstErr = [wiRes.error, invRes.error, tpRes.error, poRes.error, logRes.error].find(Boolean)
  if (firstErr) throw firstErr
  return {
    workItems: wiRes.data || [],
    inventoryTx: invRes.data || [],
    thirdPartyServices: tpRes.data || [],
    purchaseOrders: poRes.data || [],
    laborLogs: logRes.data || [],
    gasMovements: gasRes.data || [],
    purchaseDocuments: docRes.data || []
  }
}

/**
 * Calcula los 4 totales simples (cantidad + US$) de movimientos vinculados a una OT.
 */
export async function fetchWorkOrderTransferSummaryService(workOrderId) {
  if (!workOrderId) return { rows: EMPTY_ROWS, workItemsCount: 0, totalMovements: 0 }

  const [scoped, matRes, wkrRes, rcRes, mvRes, woRes] = await Promise.all([
    fetchWoScopedRecords(workOrderId),
    supabase.from('materials').select('id, name, category, cost_ars, cost_usd'),
    supabase.from('workers').select('id, name, work_group, trade, admin_center, category, hourly_rate_ars, hourly_rate_usd, consumables, consumables_discount_pct, safety_items'),
    supabase.from('rate_cards').select('id, period, year, month, quincena, admin_center, entity_name, rate_oficial_ars, rate_oficial_usd, has_ayudante, rate_ayudante_ars, rate_ayudante_usd, dollar_rate').order('year', { ascending: false }).order('month', { ascending: false }).order('quincena', { ascending: false }),
    supabase.from('macro_variables').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
    supabase.from('work_orders').select('id, ship_id, ot_number, title, description, work_type').eq('id', workOrderId)
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
    defaultDollarRate
  })
  const horasUsd = enrichedLogs.reduce((acc, l) => acc + (Number(l.costUsd) || 0), 0)

  const rows = [
    { key: 'panol', label: 'PAÑOL', count: activeInv.length, totalUsd: Math.round(panolUsd) },
    { key: 'terceros', label: 'TERCEROS', count: activeTps.length, totalUsd: Math.round(tercerosUsd) },
    { key: 'compras', label: 'COMPRAS', count: scoped.purchaseOrders.length, totalUsd: Math.round(comprasUsd) },
    { key: 'horas', label: 'HORAS', count: scoped.laborLogs.length, totalUsd: Math.round(horasUsd) }
  ]

  return {
    rows,
    workItemsCount: scoped.workItems.length,
    totalMovements: rows.reduce((s, r) => s + r.count, 0)
  }
}

/**
 * Validación en servidor contra Supabase antes de crear o renombrar una OT.
 */
export async function assertNoDuplicateOtTitleInDb({ shipId, title, excludeWoId = null }) {
  const norm = normalizeOtTitleKey(title)
  if (!shipId || !norm) return

  const { data: shipWos, error: woErr } = await supabase
    .from('work_orders')
    .select('id, ship_id, ot_number, title, status, notes, merged_into_wo_id')
    .eq('ship_id', shipId)
  if (woErr) throw woErr

  const woIds = (shipWos || []).map((w) => w.id)
  let items = []
  if (woIds.length > 0) {
    const { data: itemRows } = await supabase.from('work_items').select('id, work_order_id, status, comments').in('work_order_id', woIds)
    items = itemRows || []
  }

  const conflict = findDuplicateOtNameConflict(shipWos || [], items, shipId, norm, excludeWoId)
  if (conflict) throw new Error(conflict.message)
}
