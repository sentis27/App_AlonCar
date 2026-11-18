/**
 * zeroCostAlertsService.js
 * Cargador ligero desde Supabase para alertas pre-facturación ($0) del Dashboard (/) y Admin (/admin),
 * reutilizando la lógica única de enriquecimiento de `managerialSummaryService.js`.
 * Cumple Candado #3: Cero SQL directo en JSX.
 */

import {
  resolveDollarReference,
  enrichMaterialMovements,
  enrichThirdPartyServices,
} from './managerialSummaryService.js'
import { buildZeroCostAlertsSummary } from './zeroCostAlertsRules.js'
import { shipsRepository } from '../repositories/shipsRepository.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { inventoryTransactionsRepository } from '../repositories/inventoryTransactionsRepository.js'
import { materialsRepository } from '../repositories/materialsRepository.js'
import { purchaseOrdersRepository } from '../repositories/purchaseOrdersRepository.js'
import { thirdPartyServicesRepository } from '../repositories/thirdPartyServicesRepository.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { macroVariablesRepository } from '../repositories/macroVariablesRepository.js'

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
    macroRes,
  ] = await Promise.all([
    shipsRepository.listShips({ select: 'id, name, status, is_active' }),
    workOrdersRepository.listWorkOrders({
      select: 'id, ship_id, ot_number, title, status',
      orderBy: [{ column: 'ot_number', ascending: true }],
    }),
    inventoryTransactionsRepository.listTransactions({
      select: 'id, material_id, work_order_id, ship_id, worker_id, worker_name, contractor_name, movement_type, quantity_withdrawn, unit_cost_ars_snapshot, unit_cost_usd_snapshot, weight_total, cost_center, voucher_number, notes, transaction_date, is_deletion_requested',
      limit: 3000,
    }),
    materialsRepository.listMaterials({
      select: 'id, name, category, rubro, cost_ars, cost_usd, weight_kg, unit_measure',
      orderBy: [],
    }),
    purchaseOrdersRepository.listOrders({
      select: 'id, ship_id, work_order_id, charge_type, status, material_id, material_name_raw, quantity, received_quantity, supplier_quoted_price, system_unit_price, currency, order_date, delivery_date, invoice_number, remito_number, requested_by_name, observations',
      filters: { charge_type: 'DIRECT', status: 'RECIB.COMP.DIRECT' },
      orderBy: [{ column: 'order_date', ascending: false }],
      limit: 1500,
    }),
    thirdPartyServicesRepository.listServices({
      select: 'id, ship_id, work_order_id, contractor_name, trade, voucher_type, voucher_number, invoice_number, supplier_remito_number, budget_number, internal_remito_number, amount_ars, usd_rate, amount_usd, service_date, entry_date, direct_observations, specific_observations, is_active, audit_status, created_at',
      orderBy: [{ column: 'service_date', ascending: false }],
    }),
    workersRepository.listWorkers({
      select: 'id, name, work_group, admin_center, consumables, consumables_discount_pct, safety_items',
      orderBy: [],
    }),
    macroVariablesRepository.listMacroVariables(),
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
    defaultDollarRate,
  })

  const thirdPartyRows = enrichThirdPartyServices({
    thirdPartyServices,
    ships,
    workOrders,
    macroVariables,
    defaultDollarRate,
  })

  return buildZeroCostAlertsSummary({
    materialRows,
    thirdPartyRows,
    ships,
    requireShip: true,
    includeInactiveShips: true,
    excludeAstillero: true,
  })
}
