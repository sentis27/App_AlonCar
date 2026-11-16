/**
 * zeroCostAlertsService.js
 * Cargador ligero desde Supabase para alertas pre-facturación ($0) del Dashboard (/) y Admin (/admin),
 * reutilizando la lógica única de enriquecimiento de `managerialSummaryService.js`.
 * Cumple Candado #3: Cero SQL directo en JSX.
 */

import { supabase } from './supabase.js'
import {
  resolveDollarReference,
  enrichMaterialMovements,
  enrichThirdPartyServices
} from './managerialSummaryService.js'
import { buildZeroCostAlertsSummary } from './zeroCostAlertsRules.js'

/**
 * Carga y consolida las alertas de Terceros $0 y Materiales imputados a obra $0
 * (Pañol + Compras Directas, excluyendo EPP ELEM.SEGURIDAD y catálogo).
 */
export async function fetchDashboardZeroCostAlerts() {
  const [
    shipsRes,
    woRes,
    invTxRes,
    materialsRes,
    poRes,
    tpsRes,
    workersRes,
    macroRes
  ] = await Promise.all([
    supabase.from('ships').select('id, name, status, is_active').order('name'),
    supabase.from('work_orders').select('id, ship_id, ot_number, title, status').order('ot_number'),
    supabase
      .from('inventory_transactions')
      .select('id, material_id, work_order_id, ship_id, worker_id, worker_name, contractor_name, movement_type, quantity_withdrawn, unit_cost_ars_snapshot, unit_cost_usd_snapshot, weight_total, cost_center, voucher_number, notes, transaction_date, is_deletion_requested')
      .order('transaction_date', { ascending: false })
      .limit(3000),
    supabase
      .from('materials')
      .select('id, name, category, rubro, cost_ars, cost_usd, weight_kg, unit_measure'),
    supabase
      .from('purchase_orders')
      .select('id, ship_id, work_order_id, charge_type, status, material_id, material_name_raw, quantity, received_quantity, supplier_quoted_price, system_unit_price, currency, order_date, delivery_date, invoice_number, remito_number, requested_by_name, observations')
      .eq('charge_type', 'DIRECT')
      .eq('status', 'RECIB.COMP.DIRECT')
      .order('order_date', { ascending: false })
      .limit(1500),
    supabase
      .from('third_party_services')
      .select('id, ship_id, work_order_id, contractor_name, trade, voucher_type, voucher_number, invoice_number, supplier_remito_number, budget_number, internal_remito_number, amount_ars, usd_rate, amount_usd, service_date, entry_date, direct_observations, specific_observations, is_active, audit_status, created_at')
      .order('service_date', { ascending: false }),
    supabase
      .from('workers')
      .select('id, name, work_group, admin_center, consumables, consumables_discount_pct, safety_items'),
    supabase
      .from('macro_variables')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
  ])

  const ships = shipsRes.data || []
  const workOrders = woRes.data || []
  const inventoryTx = invTxRes.data || []
  const materials = materialsRes.data || []
  const purchaseOrders = poRes.data || []
  const thirdPartyServices = tpsRes.data || []
  const workers = workersRes.data || []
  const macroVariables = macroRes.data || []

  const defaultDollarRate = resolveDollarReference(macroVariables, [])

  const materialRows = enrichMaterialMovements({
    inventoryTx,
    purchaseOrders,
    materials,
    workers,
    ships,
    workOrders,
    macroVariables,
    defaultDollarRate
  })

  const thirdPartyRows = enrichThirdPartyServices({
    thirdPartyServices,
    ships,
    workOrders,
    macroVariables,
    defaultDollarRate
  })

  return buildZeroCostAlertsSummary({
    materialRows,
    thirdPartyRows,
    ships,
    requireShip: true,
    includeInactiveShips: true,
    excludeAstillero: true
  })
}
