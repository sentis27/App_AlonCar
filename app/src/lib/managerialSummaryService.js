/**
 * managerialSummaryService.js
 * Motor de datos, consolidación contable (GS-004 RESUMEN / RESUMEN 2), Comparador de Obras
 * y persistencia/autoalimentación del Remito Comercial Nivel Alfa.
 *
 * Reglas de Oro cumplidas:
 * - Cero SQL directo en JSX (SKL-009 P1 / Candado #3).
 * - Fuente única contable vía `computeManagerialCostSummary` y `classifyWithdrawalCost` (`workCostRules.js`).
 * - Excluye `work_type = 'PRESUPUESTO'` del costo financiero en Horas (**DEC-013**).
 * - Mantiene `ELEM. SEGURIDAD (REF. ASTILLERO)` separado e informativo (nunca suma al Total US$).
 * - Toda mutación del Remito Comercial o parámetros audita en `audit_logs` via `auditService.js`.
 */

import { computeManagerialCostSummary, classifyWithdrawalCost } from './workCostRules.js'
import { getStoredCellFormula, describeFormula } from './formulaEngine.js'
import { matchTransactionWorker } from './contractorDeductionsService.js'
import { getDollarRateForDate } from './tercerosConstants.js'
import { shipsRepository } from '../repositories/shipsRepository.js'
import { shipStaysRepository } from '../repositories/shipStaysRepository.js'
import { ownersRepository } from '../repositories/ownersRepository.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { workItemsRepository } from '../repositories/workItemsRepository.js'
import { laborLogsRepository } from '../repositories/laborLogsRepository.js'
import { rateCardsRepository } from '../repositories/rateCardsRepository.js'
import { inventoryTransactionsRepository } from '../repositories/inventoryTransactionsRepository.js'
import { materialsRepository } from '../repositories/materialsRepository.js'
import { purchaseOrdersRepository } from '../repositories/purchaseOrdersRepository.js'
import { thirdPartyServicesRepository } from '../repositories/thirdPartyServicesRepository.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { macroVariablesRepository } from '../repositories/macroVariablesRepository.js'
import { systemSettingsRepository } from '../repositories/systemSettingsRepository.js'
import { otTemplatesRepository } from '../repositories/otTemplatesRepository.js'
import {
  isThirdPartyZeroCost,
  isPanolTxZeroCost,
  isDirectPurchaseZeroCost,
  buildZeroCostAlertsSummary
} from './zeroCostAlertsRules.js'
import { isInvalidEventOrObjectScalar, logBatchPaste, logCellChange, logRowAction } from './auditService.js'
import { isMergedWorkOrder, isEliminatedWorkOrder } from './workOrderUnificationEngine.js'
import { formatWorkOrderTooltipCanonical } from './workOrdersConstants.js'
import {
  ADHOC_METRICS_SETTINGS_KEY,
  ALFA_RATES_SETTINGS_KEY,
  COMPARATOR_VIEWS_SETTINGS_KEY,
  DEFAULT_DRYDOCK_RATE_CARD_ALFA,
  REMITO_SETTINGS_KEY,
  formatOtAnalysisLabel,
  getQuincenaPeriodFromDate
} from './drydockCatalogConstants.js'
import {
  buildEquipmentHoverSummary,
  buildHoursHoverSummary,
  buildMaterialsHoverSummary,
  buildThirdPartyHoverSummary,
  mapWorkTypeToHoverCode
} from './resumenCostHoverHelpers.js'
import { buildRemitoRowsFromOtCatalog } from './otAbcRemitoAdapter.js'
import { computeOtUnvaluedBreakdown, extractWoBillingMeta } from './billingSheetMath.js'

export const RESUMEN_REALTIME_TABLES = [
  'ships', 'ship_stays', 'owners', 'work_orders', 'work_items', 'ot_templates', 'labor_logs',
  'rate_cards', 'inventory_transactions', 'materials', 'purchase_orders', 'third_party_services',
  'workers', 'macro_variables', 'system_settings'
]

const HISTORICAL_SHIP_STATUSES = new Set(['TERMINADO', 'CERRADO', 'FACTURADO', 'FINALIZADO', 'INACTIVO'])

function normKey(v) {
  return String(v || '').trim().toUpperCase()
}

function round2(n) {
  return Number((Number(n) || 0).toFixed(2))
}

function extractYear(dateStr) {
  if (!dateStr) return null
  const m = String(dateStr).match(/^(\d{4})/)
  return m ? m[1] : null
}

function normAscii(v) {
  return String(v || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

/**
 * Clasificador único de horas de maquinaria en Planilla de Horas (`labor_logs`):
 * retorna 'PALA' | 'GRUA_CHICA' | 'GRUA_GRANDE' | null.
 */
export function classifyEquipmentLogType(r = {}) {
  const structured = normAscii(
    `${r.rubro || ''} ${r.workerName || r.worker_name || ''} ${r.workerCategory || ''} ${r.workerTrade || ''}`
  )
  const notesUpper = normAscii(r.notes || '')
  const combined = `${structured} ${notesUpper}`

  if (structured.includes('PALA') || /\bPALA\b/.test(notesUpper)) return 'PALA'
  if (
    combined.includes('GRUA CHICA') ||
    combined.includes('GRUA CH') ||
    combined.includes('GRUA PEQ') ||
    combined.includes('HIDROGRUA') ||
    /\b8\s*TON\b|\b8T\b/.test(notesUpper)
  ) {
    return 'GRUA_CHICA'
  }
  if (
    combined.includes('GRUA GRANDE') ||
    combined.includes('GRUA GRD') ||
    combined.includes('GRUA G') ||
    /\b60\s*TON\b|\b60T\b/.test(notesUpper)
  ) {
    return 'GRUA_GRANDE'
  }
  return null
}

/**
 * Carga inicial sincronizada desde Supabase de todas las tablas alimentadoras de GS-004.
 */
export async function fetchManagerialData() {
  const [
    shipsRes,
    staysRes,
    ownersRes,
    woRes,
    wiRes,
    logsRes,
    rateCardsRes,
    invTxRes,
    materialsRes,
    poRes,
    tpsRes,
    workersRes,
    macroRes,
    settingsRes,
    otTemplatesRes,
  ] = await Promise.all([
    shipsRepository.listShips({ select: 'id, name, client_name, status, owner_id, matricula, vessel_type, eslora_mts, manga_mts, puntal_mts, superficie_casco_m2, technical_specs, current_location, is_active, billing_workspace_status, billing_opened_at, billing_sent_at, billing_sent_by, billing_budget_number, billing_total_snapshot_usd, billing_layout_meta, created_at' }),
    shipStaysRepository.listStays(),
    ownersRepository.listOwners({ select: 'id, name, cuit, armador_name, email_principal', orderBy: [] }),
    workOrdersRepository.listWorkOrders({ select: 'id, ship_id, ot_number, title, description, work_type, assignment_type, budget_code, foreman_name, contractor_name, start_date, estimated_end_date, closed_at, status, is_tabulated, created_at, merged_into_wo_id, notes, billing_description, billing_notes, is_in_billing, billing_sort_order, billing_rubro_group, billing_pricing_mode, billing_mo_usd, billing_mat_usd, billing_unit_price_usd, billing_qty_override, billing_mo_tax, billing_mat_tax, foreman_review_status, foreman_review_note, foreman_review_requested_at, foreman_review_requested_by, foreman_review_resolved_at, foreman_review_resolved_by', orderBy: [{ column: 'ot_number', ascending: true }] }),
    workItemsRepository.listWorkItems({
      select: 'id, work_order_id, description, contractors, trade, foreman_name, work_type, assignment_type, specific_budget_id, status, voucher_type, voucher_number, created_at',
      orderBy: [],
    }),
    laborLogsRepository.listLaborLogs({
      select: 'id, ship_id, work_order_id, work_item_id, worker_id, worker_name, worker_type, rubro, work_type, cost_center, hours_worked, hours_normal, hours_extra_50, hours_extra_100, approval_status, review_reason, notes, date_logged, created_at',
      orderBy: [{ column: 'date_logged', ascending: false }],
      limit: 4000,
    }),
    rateCardsRepository.listRateCards({
      select: 'id, period, year, month, quincena, admin_center, entity_name, rate_oficial_ars, rate_oficial_usd, has_ayudante, rate_ayudante_ars, rate_ayudante_usd, dollar_rate',
    }),
    inventoryTransactionsRepository.listTransactions({
      select: 'id, material_id, work_order_id, work_item_id, ship_id, worker_id, worker_name, contractor_name, movement_type, quantity_withdrawn, unit_cost_ars_snapshot, unit_cost_usd_snapshot, weight_total, cost_center, voucher_number, notes, transaction_date, created_at, cell_formulas, is_deletion_requested',
      limit: 3000,
    }),
    materialsRepository.listMaterials({
      select: 'id, name, category, rubro, cost_ars, cost_usd, weight_kg, current_stock, minimum_stock, unit_measure, requires_stock_control',
      orderBy: [],
    }),
    purchaseOrdersRepository.listOrders({
      select: 'id, ship_id, work_order_id, charge_type, status, material_id, material_name_raw, quantity, received_quantity, unit_measure, supplier_quoted_price, system_unit_price, currency, order_date, delivery_date, created_at, cell_formulas, invoice_number, remito_number, requested_by_name, observations',
      orderBy: [{ column: 'order_date', ascending: false }],
      limit: 2000,
    }),
    thirdPartyServicesRepository.listServices({
      select: 'id, ship_id, work_order_id, work_item_id, contractor_name, trade, voucher_type, voucher_number, invoice_number, supplier_remito_number, budget_number, internal_remito_number, amount_ars, usd_rate, amount_usd, cell_formulas, service_date, entry_date, voucher_date, direct_observations, specific_observations, is_active, audit_status, created_at',
      orderBy: [{ column: 'service_date', ascending: false }],
    }),
    workersRepository.listWorkers({
      select: 'id, name, work_group, trade, admin_center, category, hourly_rate_ars, hourly_rate_usd, consumables, consumables_discount_pct, safety_items, status',
      orderBy: [],
    }),
    macroVariablesRepository.listMacroVariables(),
    systemSettingsRepository.listSettings(),
    otTemplatesRepository.listTemplates(),
  ])

  const warnings = []
  const check = (res, name) => {
    if (res?.error) warnings.push(`${name}: ${res.error}`)
    return res?.data || []
  }

  const ships = check(shipsRes, 'ships')
  const shipStays = check(staysRes, 'ship_stays')
  const owners = check(ownersRes, 'owners')
  const workOrders = check(woRes, 'work_orders')
  const workItems = check(wiRes, 'work_items')
  const laborLogs = check(logsRes, 'labor_logs')
  const rateCards = check(rateCardsRes, 'rate_cards')
  const inventoryTx = check(invTxRes, 'inventory_transactions')
  const materials = check(materialsRes, 'materials')
  const purchaseOrders = check(poRes, 'purchase_orders')
  const thirdPartyServices = check(tpsRes, 'third_party_services')
  const workers = check(workersRes, 'workers')
  const macroVariables = check(macroRes, 'macro_variables')
  const settingsRows = check(settingsRes, 'system_settings')
  const otTemplates = check(otTemplatesRes, 'ot_templates')

  const settingsMap = {}
  settingsRows.forEach((row) => {
    if (row?.key) settingsMap[row.key] = row.value
  })

  return {
    ships,
    shipStays,
    owners,
    workOrders,
    workItems,
    laborLogs,
    rateCards,
    inventoryTx,
    materials,
    purchaseOrders,
    thirdPartyServices,
    workers,
    macroVariables,
    settingsMap,
    otTemplates,
    alfaRateCard:
      Array.isArray(settingsMap[ALFA_RATES_SETTINGS_KEY]) && settingsMap[ALFA_RATES_SETTINGS_KEY].length > 0
        ? settingsMap[ALFA_RATES_SETTINGS_KEY]
        : DEFAULT_DRYDOCK_RATE_CARD_ALFA,
    remitosByShip: settingsMap[REMITO_SETTINGS_KEY] || {},
    comparatorSavedViews: Array.isArray(settingsMap[COMPARATOR_VIEWS_SETTINGS_KEY])
      ? settingsMap[COMPARATOR_VIEWS_SETTINGS_KEY]
      : [],
    adhocMetricsByShip: settingsMap[ADHOC_METRICS_SETTINGS_KEY] || {},
    warnings
  }
}

/**
 * Resuelve el dólar de referencia actual desde `macro_variables` o `rate_cards`.
 */
export function resolveDollarReference(macroVariables = [], rateCards = [], overrideRate = null) {
  const custom = Number(overrideRate)
  if (Number.isFinite(custom) && custom > 0) return custom

  if (macroVariables.length > 0) {
    const latest = [...macroVariables].sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month))[0]
    const rate = Number(latest?.dollar_rate_2q || latest?.dollar_rate_1q || latest?.dollar_rate)
    if (rate > 0) return rate
  }
  if (rateCards.length > 0 && Number(rateCards[0].dollar_rate) > 0) {
    return Number(rateCards[0].dollar_rate)
  }
  return 1500
}

/**
 * Enriquece movimientos de Materiales + Consumibles + Compras Directas y EPP de referencia.
 */
export function enrichMaterialMovements({
  inventoryTx = [],
  purchaseOrders = [],
  materials = [],
  workers = [],
  ships = [],
  workOrders = [],
  macroVariables = [],
  defaultDollarRate = 1500
}) {
  const matMap = new Map(materials.map((m) => [m.id, m]))
  const shipMap = new Map(ships.map((s) => [s.id, s]))
  const woMap = new Map(workOrders.map((w) => [w.id, w]))

  const rows = []

  // 1. Retiros de Pañol (inventory_transactions)
  for (const tx of inventoryTx) {
    if (!tx || tx.is_deletion_requested) continue
    if (!tx.material_id && Number(tx.quantity_withdrawn || 0) <= 0) continue

    const mat = matMap.get(tx.material_id) || null
    const worker = matchTransactionWorker(tx, workers)
    const classification = classifyWithdrawalCost({ material: mat, transaction: tx, worker })

    const resolvedWo = tx.work_order_id ? woMap.get(tx.work_order_id) || null : null
    const resolvedShipId = tx.ship_id || resolvedWo?.ship_id || null
    const resolvedShip = resolvedShipId ? shipMap.get(resolvedShipId) || null : null

    const qty = Number(tx.quantity_withdrawn || 0)
    const unitKg = Number(mat?.weight_kg || 0)
    const weightKg = Number(tx.weight_total) > 0 ? Number(tx.weight_total) : Number((qty * unitKg).toFixed(2))
    const unitUsd = Number(tx.unit_cost_usd_snapshot || mat?.cost_usd || 0)

    const rawCat = normKey(mat?.category)
    const movementType = normKey(tx.movement_type)
    const logicalCategory =
      rawCat === 'ELEM.SEGURIDAD' || movementType === 'ENTREGA_EPP'
        ? 'ELEM.SEGURIDAD'
        : rawCat === 'CONSUMIBLES'
          ? 'CONSUMIBLES'
          : 'MATERIALES'

    // Retiros 100% a cargo de contratista (EPP o Consumibles Tesorería) no computan gasto ni volumen de obra
    if (classification.bucket === 'SAFETY_CONTRACTOR_DEDUCTION') continue
    if (logicalCategory === 'CONSUMIBLES' && classification.deductibleToContractor && classification.shipDirectPct === 0) {
      continue
    }

    const qtyFormula = getStoredCellFormula(tx, 'quantity_withdrawn')
    const formulaMeta = describeFormula(qtyFormula)

    rows.push({
      id: `tx_${tx.id}`,
      rawId: tx.id,
      sourceType: 'PANOL_TX',
      date: tx.transaction_date ? String(tx.transaction_date).slice(0, 10) : '',
      createdAt: tx.created_at ? String(tx.created_at).slice(0, 10) : (tx.transaction_date ? String(tx.transaction_date).slice(0, 10) : ''),
      year: extractYear(tx.transaction_date),
      shipId: resolvedShipId,
      shipName: resolvedShip?.name || 'SIN BUQUE',
      workOrderId: tx.work_order_id || null,
      otNumber: resolvedWo?.ot_number || 'Sin OT',
      otTitle: resolvedWo?.title || '',
      otLabel: formatOtAnalysisLabel({
        id: tx.work_order_id || 'SIN_OT',
        otNumber: resolvedWo?.ot_number || 'Sin OT',
        title: resolvedWo?.title || '',
        description: resolvedWo?.description || ''
      }),
      materialId: tx.material_id || null,
      materialName: mat?.name || tx.notes || 'Insumo sin asignar',
      rubro: normKey(mat?.rubro) || 'GENERAL',
      category: logicalCategory,
      isSafetyReference: classification.referenceOnly,
      isSafetyContractorDeduction: classification.bucket === 'SAFETY_CONTRACTOR_DEDUCTION',
      qty,
      qtyFormula: qtyFormula || '',
      cutDimensionsLabel: formulaMeta?.dimensionsLabel || '',
      unitMeasure: mat?.unit_measure || 'un.',
      weightKg: round2(weightKg),
      unitUsd: round2(unitUsd),
      totalUsdRaw: round2(classification.totalUsd),
      shipDirectUsd: round2(classification.shipDirectUsd),
      referenceUsd: round2(classification.referenceUsd),
      deductUsd: round2(classification.deductUsd),
      contractorLabel:
        worker?.work_group || tx.contractor_name || tx.worker_name || worker?.name || 'ASTILLERO',
      workerName: worker?.name || tx.worker_name || tx.contractor_name || 'Sin asignar',
      costCenterLabel: classification.referenceOnly
        ? 'ASTILLERO (ZONA GRIS REF.)'
        : classification.deductUsd > 0 && classification.shipDirectUsd === 0
          ? 'CONTRATISTA (100% DESC.)'
          : classification.deductUsd > 0
            ? `MIXTO (${classification.shipDirectPct}% Obra)`
            : tx.cost_center || 'CLIENTE',
      voucherNumber: tx.voucher_number || '',
      notes: tx.notes || '',
      isDeletionRequested: Boolean(tx.is_deletion_requested),
      hasMissingOt: !tx.work_order_id,
      hasZeroPrice: isPanolTxZeroCost({ ...tx, unitUsd, category: logicalCategory }, mat),
      classification
    })
  }

  // 2. Compras Directas a Buque/OT (`charge_type = 'DIRECT'` recepcionadas)
  for (const po of purchaseOrders) {
    if (!po) continue
    if (normKey(po.charge_type) !== 'DIRECT') continue
    const statusUpper = normKey(po.status)
    if (statusUpper !== 'RECIB.COMP.DIRECT') continue

    const resolvedWo = po.work_order_id ? woMap.get(po.work_order_id) || null : null
    const resolvedShipId = po.ship_id || resolvedWo?.ship_id || null
    const resolvedShip = resolvedShipId ? shipMap.get(resolvedShipId) || null : null
    const mat = po.material_id ? matMap.get(po.material_id) || null : null

    const qty = Number(po.received_quantity || po.quantity || 0)
    const unitPriceRaw = Number(po.supplier_quoted_price || po.system_unit_price || 0)
    const poDate = po.delivery_date || po.order_date || po.created_at
    const dateStr = poDate ? String(poDate).slice(0, 10) : ''
    const tc = getDollarRateForDate(dateStr, macroVariables) || defaultDollarRate || 1500
    const isUsd = normKey(po.currency) === 'USD'
    const unitUsd = isUsd ? unitPriceRaw : tc > 0 ? unitPriceRaw / tc : 0
    const totalUsd = round2(qty * unitUsd)
    const weightKg = round2(qty * Number(mat?.weight_kg || 0))
    const rawCat = normKey(mat?.category)
    const logicalCategory = rawCat === 'CONSUMIBLES' ? 'CONSUMIBLES' : 'MATERIALES'

    const poQtyFormula = getStoredCellFormula(po, 'quantity')
    const poFormulaMeta = describeFormula(poQtyFormula)

    rows.push({
      id: `po_${po.id}`,
      rawId: po.id,
      sourceType: 'COMPRA_DIRECTA',
      date: dateStr,
      createdAt: po.created_at ? String(po.created_at).slice(0, 10) : dateStr,
      year: extractYear(poDate),
      shipId: resolvedShipId,
      shipName: resolvedShip?.name || 'SIN BUQUE',
      workOrderId: po.work_order_id || null,
      otNumber: resolvedWo?.ot_number || 'Sin OT',
      otTitle: resolvedWo?.title || '',
      otLabel: formatOtAnalysisLabel({
        id: po.work_order_id || 'SIN_OT',
        otNumber: resolvedWo?.ot_number || 'Sin OT',
        title: resolvedWo?.title || '',
        description: resolvedWo?.description || ''
      }),
      materialId: po.material_id || null,
      materialName: mat?.name || po.material_name_raw || 'Compra Directa',
      rubro: normKey(mat?.rubro) || 'COMPRAS DIRECTAS',
      category: logicalCategory,
      isSafetyReference: false,
      isSafetyContractorDeduction: false,
      qty,
      qtyFormula: poQtyFormula || '',
      cutDimensionsLabel: poFormulaMeta?.dimensionsLabel || '',
      unitMeasure: po.unit_measure || mat?.unit_measure || 'un.',
      weightKg,
      unitUsd: round2(unitUsd),
      totalUsdRaw: totalUsd,
      shipDirectUsd: totalUsd,
      referenceUsd: 0,
      deductUsd: 0,
      contractorLabel: po.requested_by_name || 'Compra Directa',
      workerName: po.requested_by_name || 'Compras',
      costCenterLabel: 'COMPRA DIRECTA OBRA',
      voucherNumber: po.remito_number || po.invoice_number || '',
      notes: po.observations || `OC Directa (${po.status})`,
      isDeletionRequested: false,
      hasMissingOt: !po.work_order_id,
      hasZeroPrice: isDirectPurchaseZeroCost(po) || unitUsd <= 0,
      classification: { bucket: 'COMPRA_DIRECTA_OBRA' }
    })
  }

  return rows.sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}

/**
 * Resuelve la tarifa horaria USD de un operario/contratista usando `rate_cards` quincenal y `workers`.
 */
function resolveHourlyRateForLog({ log, worker, rateCards = [], defaultDollarRate = 1500 }) {
  const period = getQuincenaPeriodFromDate(log.date_logged)
  const isContractor =
    normKey(log.worker_type) === 'CONTRATISTA' ||
    normKey(worker?.admin_center) === 'CONTRATISTA' ||
    normKey(worker?.admin_center) === 'TALLER'

  const centerTarget = isContractor ? 'CONTRATISTA' : 'ASTILLERO'
  let entityTarget = ''
  let isAyudante = false

  if (isContractor) {
    const rawGroup = normKey(worker?.work_group || log.worker_name)
    isAyudante = rawGroup.endsWith(' AYUDANTE')
    entityTarget = isAyudante ? rawGroup.replace(/\s+AYUDANTE$/, '').trim() : rawGroup
  } else {
    entityTarget = normKey(worker?.category) || 'OFICIAL'
  }

  const pickRateFromCard = (card) => {
    if (!card) return 0
    if (isContractor && isAyudante && card.has_ayudante) {
      const aUsd = Number(card.rate_ayudante_usd) || 0
      if (aUsd > 0) return aUsd
      const aArs = Number(card.rate_ayudante_ars) || 0
      const dr = Number(card.dollar_rate) || defaultDollarRate
      if (aArs > 0 && dr > 0) return aArs / dr
    }
    const oUsd = Number(card.rate_oficial_usd) || 0
    if (oUsd > 0) return oUsd
    const oArs = Number(card.rate_oficial_ars) || 0
    const dr = Number(card.dollar_rate) || defaultDollarRate
    if (oArs > 0 && dr > 0) return oArs / dr
    return 0
  }

  // 1. Coincidencia exacta de quincena + entidad
  if (period && entityTarget) {
    const exactCard = rateCards.find(
      (c) =>
        c.period === period &&
        normKey(c.admin_center) === centerTarget &&
        normKey(c.entity_name) === entityTarget
    )
    const rate = pickRateFromCard(exactCard)
    if (rate > 0) return { rateUsd: round2(rate), source: period }
  }

  // 2. Última quincena conocida para esa entidad
  if (entityTarget) {
    const latestCard = rateCards.find(
      (c) => normKey(c.admin_center) === centerTarget && normKey(c.entity_name) === entityTarget
    )
    const rate = pickRateFromCard(latestCard)
    if (rate > 0) return { rateUsd: round2(rate), source: latestCard.period || 'TARIFARIO' }
  }

  // 3. Fallback ficha del trabajador
  const workerUsd = Number(worker?.hourly_rate_usd) || 0
  if (workerUsd > 0) return { rateUsd: round2(workerUsd), source: 'FICHA_WORKER' }
  const workerArs = Number(worker?.hourly_rate_ars) || 0
  if (workerArs > 0 && defaultDollarRate > 0) {
    return { rateUsd: round2(workerArs / defaultDollarRate), source: 'FICHA_ARS' }
  }

  return { rateUsd: 0, source: 'SIN_TARIFA' }
}

/**
 * Enriquece imputaciones de Mano de Obra (`labor_logs`) aplicando DEC-013 y tarifario quincenal.
 */
export function enrichLaborLogs({
  laborLogs = [],
  workers = [],
  rateCards = [],
  ships = [],
  workOrders = [],
  workItems = [],
  defaultDollarRate = 1500
}) {
  const shipMap = new Map(ships.map((s) => [s.id, s]))
  const woMap = new Map(workOrders.map((w) => [w.id, w]))
  const wiMap = new Map(workItems.map((wi) => [wi.id, wi]))
  const workerById = new Map(workers.map((w) => [w.id, w]))
  const workerByName = new Map(workers.map((w) => [normKey(w.name), w]))
  const VALID_WORK_TYPES = new Set(['HORA', 'PRESUPUESTO', 'CONTROL'])

  return laborLogs.map((log) => {
    const worker =
      (log.worker_id && workerById.get(log.worker_id)) ||
      workerByName.get(normKey(log.worker_name)) ||
      null

    const resolvedWo = log.work_order_id ? woMap.get(log.work_order_id) || null : null
    const resolvedWi = log.work_item_id ? wiMap.get(log.work_item_id) || null : null
    const resolvedShipId = log.ship_id || resolvedWo?.ship_id || null
    const resolvedShip = resolvedShipId ? shipMap.get(resolvedShipId) || null : null

    const hNorm = Number(log.hours_normal ?? log.hours_worked ?? 0) || 0
    const h50 = Number(log.hours_extra_50 || 0) || 0
    const h100 = Number(log.hours_extra_100 || 0) || 0
    const hoursPhysical = round2(Number(log.hours_worked) || hNorm + h50 + h100)

    const isContractor =
      normKey(log.worker_type) === 'CONTRATISTA' ||
      normKey(log.worker_type) === 'TALLER' ||
      normKey(worker?.admin_center) === 'CONTRATISTA' ||
      normKey(worker?.admin_center) === 'TALLER'

    const hoursEquiv = isContractor
      ? hoursPhysical
      : round2(hNorm + h50 * 1.5 + h100 * 2.0)

    const rawLogWt = normKey(log.work_type)
    const wiWt = normKey(resolvedWi?.work_type)
    const woWt = normKey(resolvedWo?.work_type)
    const workTypeUpper = VALID_WORK_TYPES.has(rawLogWt)
      ? rawLogWt
      : VALID_WORK_TYPES.has(wiWt)
        ? wiWt
        : VALID_WORK_TYPES.has(woWt)
          ? woWt
          : 'HORA'

    const isPresupuesto =
      workTypeUpper === 'PRESUPUESTO' || normKey(log.cost_center) === 'PRESUPUESTO'
    const workTypeCode = isPresupuesto ? 'PRC' : mapWorkTypeToHoverCode(workTypeUpper)
    const contractorGroup = isContractor
      ? normKey(worker?.work_group || log.worker_name || 'CONTRATISTA')
      : 'ASTILLERO'

    const { rateUsd, source: rateSource } = resolveHourlyRateForLog({
      log,
      worker,
      rateCards,
      defaultDollarRate
    })

    const costUsd = isPresupuesto ? 0 : round2(hoursEquiv * rateUsd)
    const approvalRaw = normKey(log.approval_status || 'APROBADO')
    const isPendingR = approvalRaw === 'R' || approvalRaw === 'RR'
    const approvedUsd = isPendingR ? 0 : costUsd
    const pendingRUsd = isPendingR ? costUsd : 0
    const prcNumber = String(log.notes || '').match(/PRC[-_\s#]*(\d+)/i)?.[1] || ''
    const workerName = log.worker_name || worker?.name || 'Operario'
    const workerCategory = normKey(worker?.category || '')
    const workerTrade = normKey(worker?.trade || '')
    const rubro = normKey(log.rubro || worker?.trade || 'GENERAL')
    const notes = log.notes || log.review_reason || ''
    const equipmentType = classifyEquipmentLogType({
      rubro,
      workerName,
      workerCategory,
      workerTrade,
      notes
    })

    return {
      id: log.id,
      date: log.date_logged ? String(log.date_logged).slice(0, 10) : '',
      year: extractYear(log.date_logged),
      shipId: resolvedShipId,
      shipName: resolvedShip?.name || 'SIN BUQUE',
      workOrderId: log.work_order_id || null,
      otNumber: resolvedWo?.ot_number || 'Sin OT',
      otTitle: resolvedWo?.title || '',
      otLabel: formatOtAnalysisLabel({
        id: log.work_order_id || 'SIN_OT',
        otNumber: resolvedWo?.ot_number || 'Sin OT',
        title: resolvedWo?.title || '',
        description: resolvedWo?.description || ''
      }),
      workerName,
      contractorGroup,
      workerType: isContractor ? 'Contratista' : 'Astillero',
      workerCategory,
      workerTrade,
      rubro,
      equipmentType,
      workType: workTypeUpper || 'HORA',
      workTypeCode,
      isPresupuesto,
      prcNumber,
      hoursNormal: round2(hNorm),
      hours50: round2(h50),
      hours100: round2(h100),
      hoursPhysical,
      hoursEquiv,
      hourlyRateUsd: rateUsd,
      rateSource,
      costUsd,
      approvedUsd,
      pendingRUsd,
      approvalStatus: log.approval_status || 'Aprobado',
      isPendingR,
      isCorrectedRR: approvalRaw === 'RR',
      hasMissingOt: !log.work_order_id,
      hasMissingPrc: isPresupuesto && !prcNumber,
      notes
    }
  })
}

/**
 * Enriquece comprobantes de Terceros y Talleres (`third_party_services`).
 */
export function enrichThirdPartyServices({
  thirdPartyServices = [],
  ships = [],
  workOrders = [],
  macroVariables = [],
  defaultDollarRate = 1500
}) {
  const shipMap = new Map(ships.map((s) => [s.id, s]))
  const woMap = new Map(workOrders.map((w) => [w.id, w]))

  return thirdPartyServices
    .filter((s) => s && s.is_active !== false)
    .map((s) => {
      const resolvedWo = s.work_order_id ? woMap.get(s.work_order_id) || null : null
      const resolvedShipId = s.ship_id || resolvedWo?.ship_id || null
      const resolvedShip = resolvedShipId ? shipMap.get(resolvedShipId) || null : null
      const dateStr = String(s.service_date || s.entry_date || s.created_at || '').slice(0, 10)
      const ars = Number(s.amount_ars) || 0
      const rate = Number(s.usd_rate) || getDollarRateForDate(dateStr, macroVariables) || defaultDollarRate || 1500
      const usd =
        Number(s.amount_usd) > 0
          ? Number(s.amount_usd)
          : rate > 0
            ? round2(ars / rate)
            : 0

      return {
        id: s.id,
        date: dateStr,
        year: extractYear(dateStr),
        shipId: resolvedShipId,
        shipName: resolvedShip?.name || 'SIN BUQUE',
        workOrderId: s.work_order_id || null,
        otNumber: resolvedWo?.ot_number || 'Sin OT',
        otTitle: resolvedWo?.title || '',
        otLabel: formatOtAnalysisLabel({
          id: s.work_order_id || 'SIN_OT',
          otNumber: resolvedWo?.ot_number || 'Sin OT',
          title: resolvedWo?.title || '',
          description: resolvedWo?.description || ''
        }),
        contractorName: s.contractor_name || 'Contratista',
        rubro: normKey(s.trade || 'VARIOS'),
        amountArs: round2(ars),
        usdRate: round2(rate),
        amountUsd: round2(usd),
        voucherType: normKey(s.voucher_type || s.status || 'PRC'),
        voucherNumber: s.invoice_number || s.supplier_remito_number || s.budget_number || s.voucher_number || '',
        budgetNumber: s.budget_number || '',
        internalRemitoNumber: s.internal_remito_number || '',
        observations: [s.direct_observations, s.specific_observations].filter(Boolean).join(' · '),
        auditStatus: s.audit_status || 'PENDIENTE',
        hasMissingOt: !s.work_order_id,
        hasZeroCost: isThirdPartyZeroCost({ amount_ars: ars, amount_usd: usd, is_active: s.is_active })
      }
    })
}

function isHistoricalOrderStatus(status) {
  return HISTORICAL_SHIP_STATUSES.has(normKey(status))
}

function matchesScopeFilter(ship, ot, scope) {
  if (scope === 'mixto' || !scope) return true
  const shipHist = ship ? isHistoricalOrderStatus(ship.status) || ship.is_active === false : false
  const otHist = ot ? isHistoricalOrderStatus(ot.status) : false
  const isHist = ot ? otHist || shipHist : shipHist
  return scope === 'historico' ? isHist : !isHist
}

/**
 * Filtra los buques visibles en Zona 1 según alcance (`activas` por defecto, `historico` o `mixto`).
 */
export function filterSelectableShipsByScope(ships = [], scope = 'activas') {
  const nonAstillero = (ships || []).filter((s) => normKey(s.name) !== 'ASTILLERO')
  if (scope === 'mixto' || !scope) return nonAstillero
  return nonAstillero.filter((s) => {
    const isHist = isHistoricalOrderStatus(s.status) || s.is_active === false
    return scope === 'historico' ? isHist : !isHist
  })
}

/**
 * Suma horas físicas desde `labor_logs` para Pala, Grúa Grande y Grúa Chica (100% solo lectura).
 */
export function sumEquipmentHoursFromLogs(rows = []) {
  let gruaGrande = 0
  let gruaChica = 0
  let hrsPala = 0

  for (const r of rows) {
    const hrs = Number(r.hoursPhysical ?? r.hours_worked) || 0
    if (hrs <= 0) continue

    const eqType = r.equipmentType || classifyEquipmentLogType(r)
    if (eqType === 'PALA') hrsPala += hrs
    else if (eqType === 'GRUA_CHICA') gruaChica += hrs
    else if (eqType === 'GRUA_GRANDE') gruaGrande += hrs
  }

  return {
    gruaGrande: round2(gruaGrande),
    gruaChica: round2(gruaChica),
    hrsPala: round2(hrsPala)
  }
}

function buildTopDonutSegments(entries = [], maxSlices = 12) {
  const valid = entries
    .filter((e) => Number(e.value) > 0)
    .sort((a, b) => b.value - a.value)
  const total = valid.reduce((acc, e) => acc + e.value, 0)
  if (total <= 0) return []

  const top = valid.slice(0, maxSlices)
  const restVal = valid.slice(maxSlices).reduce((acc, e) => acc + e.value, 0)
  const list = restVal > 0 ? [...top, { label: 'Otros', value: round2(restVal) }] : top

  return list.map((item) => ({
    label: item.label,
    value: round2(item.value),
    pct: Number(((item.value / total) * 100).toFixed(1))
  }))
}

/**
 * Calcula el tablero ejecutivo completo del Submódulo 1 (`RESUMEN` + `RESUMEN 2` + Donuts + Grúas).
 */
export function computeShipManagerialSummary({
  shipId,
  activeOtId = 'ALL',
  ships = [],
  workOrders = [],
  workItems = [],
  materialRows = [],
  laborRows = [],
  thirdPartyRows = [],
  scope = 'activas',
  yearFilter = 'TODOS'
}) {
  const ship = ships.find((s) => s.id === shipId) || null
  const allShipWos = workOrders.filter((w) => w.ship_id === shipId && !isMergedWorkOrder(w))

  const passesCommonFilter = (row) => {
    if (row.shipId !== shipId) return false
    if (yearFilter !== 'TODOS' && row.year && row.year !== String(yearFilter)) return false
    const wo = row.workOrderId ? allShipWos.find((w) => w.id === row.workOrderId) : null
    return matchesScopeFilter(ship, wo, scope)
  }

  const shipMats = materialRows.filter(passesCommonFilter)
  const shipLabor = laborRows.filter(passesCommonFilter)
  const shipTps = thirdPartyRows.filter(passesCommonFilter)

  // Sumar totales del Buque vía motor único `computeManagerialCostSummary`
  const sumBucket = (mats, labs, tps) => {
    let materialesUsd = 0
    let consumiblesObraUsd = 0
    let seguridadReferenciaUsd = 0
    let weightKg = 0

    for (const m of mats) {
      if (m.category === 'MATERIALES') materialesUsd += m.shipDirectUsd
      else if (m.category === 'CONSUMIBLES') consumiblesObraUsd += m.shipDirectUsd
      if (m.isSafetyReference) seguridadReferenciaUsd += m.referenceUsd
      weightKg += m.weightKg
    }

    let horasUsd = 0
    let horasPendAprobarUsd = 0
    let physicalHours = 0
    for (const l of labs) {
      horasUsd += l.approvedUsd
      horasPendAprobarUsd += l.pendingRUsd
      physicalHours += l.hoursPhysical
    }

    const tercerosUsd = tps.reduce((acc, t) => acc + t.amountUsd, 0)
    const summary = computeManagerialCostSummary({
      materialesUsd,
      consumiblesObraUsd,
      tercerosUsd,
      horasUsd,
      horasPendAprobarUsd,
      seguridadReferenciaUsd
    })

    return {
      ...summary,
      horasTotalUsd: round2(summary.horasUsd + summary.horasPendAprobarUsd),
      matPlusConsUsd: round2(summary.materialesUsd + summary.consumiblesObraUsd),
      manoObraTotalUsd: round2(summary.tercerosUsd + summary.horasUsd + summary.horasPendAprobarUsd),
      weightKg: round2(weightKg),
      physicalHours: round2(physicalHours)
    }
  }

  const totals = sumBucket(shipMats, shipLabor, shipTps)

  // Agrupar filas RESUMEN 2 por cada Orden de Trabajo + eventual fila "Sin OT"
  const wiByWo = new Map()
  workItems.forEach((wi) => {
    if (!wiByWo.has(wi.work_order_id)) wiByWo.set(wi.work_order_id, [])
    wiByWo.get(wi.work_order_id).push(wi)
  })

  const filteredWos = allShipWos.filter((w) => matchesScopeFilter(ship, w, scope))
  const otRows = filteredWos
    .map((wo) => {
      const mats = shipMats.filter((r) => r.workOrderId === wo.id)
      const labs = shipLabor.filter((r) => r.workOrderId === wo.id)
      const tps = shipTps.filter((r) => r.workOrderId === wo.id)
      const woItems = wiByWo.get(wo.id) || []
      const hasLinkedMovements = mats.length > 0 || labs.length > 0 || tps.length > 0
      if (!hasLinkedMovements && isEliminatedWorkOrder(wo, woItems)) return null
      const bucket = sumBucket(mats, labs, tps)
      const itemsDesc = woItems.map((i) => i.description).filter(Boolean).join(' · ')

      const otNum = wo.ot_number || 'OT'
      const otTitle = wo.title || 'Sin título'
      const otDesc = wo.description || itemsDesc || 'Sin descripción registrada'
      const unvaluedByOt = computeOtUnvaluedBreakdown({ otId: wo.id, laborRows: labs, materialRows: mats, thirdPartyRows: tps })

      return {
        id: wo.id,
        wo,
        canonicalTooltip: formatWorkOrderTooltipCanonical(wo, ship, workItems, workOrders),
        otNumber: otNum,
        title: otTitle,
        otLabel: formatOtAnalysisLabel({ id: wo.id, otNumber: otNum, title: otTitle, description: otDesc }),
        description: otDesc,
        workType: wo.work_type || 'HORA',
        status: wo.status || 'En Progreso',
        ...extractWoBillingMeta(wo, woItems),
        unvaluedByOt,
        ...bucket,
        matsCount: mats.length,
        labsCount: labs.length,
        tpsCount: tps.length
      }
    })
    .filter(Boolean)

  // Costos cargados al buque sin OT asignada (en Facturación solo se notifican)
  const orphanMats = shipMats.filter((r) => !r.workOrderId)
  const orphanLabs = shipLabor.filter((r) => !r.workOrderId)
  const orphanTps = shipTps.filter((r) => !r.workOrderId)
  let orphanSummary = null
  if (orphanMats.length > 0 || orphanLabs.length > 0 || orphanTps.length > 0) {
    orphanSummary = {
      id: 'SIN_OT', wo: null, canonicalTooltip: '(⚠️ Sin OT asignada)', otNumber: 'S/OT', title: 'MOVIMIENTOS SIN OT ASIGNADA',
      otLabel: formatOtAnalysisLabel({ id: 'SIN_OT', otNumber: 'S/OT', title: 'MOVIMIENTOS SIN OT ASIGNADA' }),
      description: 'Imputaciones cargadas al buque pendientes de vinculación a una OT', workType: 'HORA', status: 'Pendiente OT',
      unvaluedByOt: computeOtUnvaluedBreakdown({ otId: 'SIN_OT', laborRows: orphanLabs, materialRows: orphanMats, thirdPartyRows: orphanTps }),
      ...sumBucket(orphanMats, orphanLabs, orphanTps), matsCount: orphanMats.length, labsCount: orphanLabs.length, tpsCount: orphanTps.length
    }
    otRows.push(orphanSummary)
  }

  // Resolver OT activa para el bloque inferior
  const resolvedOt =
    otRows.find((r) => r.id === activeOtId) ||
    otRows.find((r) => r.directTotalUsd > 0) ||
    otRows[0] ||
    null

  const otMats = resolvedOt
    ? shipMats.filter((r) => (resolvedOt.id === 'SIN_OT' ? !r.workOrderId : r.workOrderId === resolvedOt.id))
    : []
  const otLabor = resolvedOt
    ? shipLabor.filter((r) => (resolvedOt.id === 'SIN_OT' ? !r.workOrderId : r.workOrderId === resolvedOt.id))
    : []
  const otTps = resolvedOt
    ? shipTps.filter((r) => (resolvedOt.id === 'SIN_OT' ? !r.workOrderId : r.workOrderId === resolvedOt.id))
    : []

  // Horas de Grúa Grande, Grúa Chica y Pala (100% solo lectura desde Planilla de Horas `labor_logs`)
  const shipEq = sumEquipmentHoursFromLogs(shipLabor)
  const otEq = sumEquipmentHoursFromLogs(otLabor)
  const craneHours = {
    shipGruaGrande: shipEq.gruaGrande,
    shipGruaChica: shipEq.gruaChica,
    shipHrsPala: shipEq.hrsPala,
    otGruaGrande: otEq.gruaGrande,
    otGruaChica: otEq.gruaChica,
    otHrsPala: otEq.hrsPala
  }

  const groupSum = (items, keyFn, valFn) => {
    const m = new Map()
    items.forEach((it) => {
      const k = keyFn(it) || 'Otros'
      m.set(k, (m.get(k) || 0) + (Number(valFn(it)) || 0))
    })
    return buildTopDonutSegments(Array.from(m.entries()).map(([label, value]) => ({ label, value })))
  }

  // Donuts Buque (4) — Documentación GS-004 + Imagen 3:
  // Total por O.T (con nombre obligatorio), Distribución Peso por Rubro material,
  // Total de Horas por Rubro/Oficio y Terceros Total por Taller/Contratista.
  const donutsShip = {
    totalPorOt: buildTopDonutSegments(
      otRows.map((o) => ({ label: o.otLabel || formatOtAnalysisLabel(o), value: o.directTotalUsd }))
    ),
    pesosPorOt: groupSum(shipMats, (m) => m.rubro, (m) => m.weightKg),
    horasPorOt: groupSum(shipLabor, (l) => l.rubro, (l) => l.hoursPhysical),
    tercerosPorOt: groupSum(shipTps, (t) => `${t.contractorName} (${t.voucherType})`, (t) => t.amountUsd)
  }

  const donutsOt = {
    kilosPorRubro: groupSum(otMats, (m) => m.rubro, (m) => m.weightKg),
    horasPorOficio: groupSum(otLabor, (l) => l.rubro, (l) => l.hoursPhysical),
    tercerosOt: groupSum(otTps, (t) => `${t.contractorName} (${t.voucherType})`, (t) => t.amountUsd)
  }

  const zeroCostAlerts = buildZeroCostAlertsSummary({
    materialRows: shipMats,
    thirdPartyRows: shipTps,
    ships: ship ? [ship] : []
  })

  const hoverSummaries = {
    ship: {
      materiales: buildMaterialsHoverSummary(shipMats, { category: 'MATERIALES' }),
      consumibles: buildMaterialsHoverSummary(shipMats, { category: 'CONSUMIBLES' }),
      terceros: buildThirdPartyHoverSummary(shipTps),
      horasAprobadas: buildHoursHoverSummary(shipLabor, { filterMode: 'APPROVED' }),
      horasPendR: buildHoursHoverSummary(shipLabor, { filterMode: 'PENDING_R' }),
      gruaGrande: buildEquipmentHoverSummary(shipLabor, 'GRUA_GRANDE'),
      gruaChica: buildEquipmentHoverSummary(shipLabor, 'GRUA_CHICA')
    },
    ot: resolvedOt
      ? {
          materiales: buildMaterialsHoverSummary(otMats, { category: 'MATERIALES' }),
          consumibles: buildMaterialsHoverSummary(otMats, { category: 'CONSUMIBLES' }),
          terceros: buildThirdPartyHoverSummary(otTps),
          horasTotal: buildHoursHoverSummary(otLabor, { filterMode: 'ALL' }),
          gruaGrande: buildEquipmentHoverSummary(otLabor, 'GRUA_GRANDE'),
          gruaChica: buildEquipmentHoverSummary(otLabor, 'GRUA_CHICA')
        }
      : null
  }

  return {
    ship,
    totals,
    otRows,
    orphanSummary,
    activeOt: resolvedOt,
    donutsShip,
    donutsOt,
    craneHours,
    zeroCostAlerts,
    hoverSummaries,
    filteredCounts: {
      materials: shipMats.length,
      labor: shipLabor.length,
      thirdParty: shipTps.length
    }
  }
}

/**
 * Construye el dataset consolidado para el Comparador Multidimensional de Obras (Submódulo 2 · Nivel 1 + Nivel 2).
 */
export function computeComparatorDataset({
  ships = [],
  workOrders = [],
  workItems = [],
  materialRows = [],
  laborRows = [],
  thirdPartyRows = [],
  adhocMetricsByShip = {},
  scope = 'mixto',
  yearFilter = 'TODOS'
}) {
  return ships
    .filter((s) => normKey(s.name) !== 'ASTILLERO')
    .filter((s) => matchesScopeFilter(s, null, scope))
    .map((ship) => {
      const summary = computeShipManagerialSummary({
        shipId: ship.id,
        ships,
        workOrders,
        workItems,
        materialRows,
        laborRows,
        thirdPartyRows,
        scope,
        yearFilter
      })

      const t = summary.totals
      const direct = t.directTotalUsd
      const adhoc = adhocMetricsByShip[ship.id] || {}
      const customAreaM2 = Number(adhoc.areaM2 ?? ship.superficie_casco_m2 ?? 0) || 0
      const pct = (part) => (direct > 0 ? Number(((part / direct) * 100).toFixed(1)) : 0)

      return {
        shipId: ship.id,
        shipName: ship.name,
        clientName: ship.client_name || 'Cliente / Armador',
        status: ship.status || 'Activo',
        esloraMts: Number(ship.eslora_mts) || 0,
        superficieM2: customAreaM2,
        directTotalUsd: direct,
        materialesUsd: t.materialesUsd,
        consumiblesObraUsd: t.consumiblesObraUsd,
        tercerosUsd: t.tercerosUsd,
        horasTotalUsd: t.horasTotalUsd,
        seguridadReferenciaUsd: t.seguridadReferenciaUsd,
        weightKg: t.weightKg,
        physicalHours: t.physicalHours,
        costPerKg: t.weightKg > 0 ? round2(direct / t.weightKg) : 0,
        kgPerHour: t.physicalHours > 0 ? Number((t.weightKg / t.physicalHours).toFixed(2)) : 0,
        costPerM2: customAreaM2 > 0 ? round2(direct / customAreaM2) : 0,
        kgPerM2: customAreaM2 > 0 ? Number((t.weightKg / customAreaM2).toFixed(2)) : 0,
        breakdownPct: {
          materiales: pct(t.materialesUsd),
          consumibles: pct(t.consumiblesObraUsd),
          terceros: pct(t.tercerosUsd),
          horas: pct(t.horasTotalUsd)
        },
        otRows: summary.otRows
      }
    })
}

/**
 * Construye o resincroniza las líneas autoalimentadas del Remito Comercial Nivel Alfa (Submódulo 3).
 */
export function buildRemitoAutoFeedRows({
  ship,
  shipStays = [],
  workOrders = [],
  shipSummary,
  materialRows = [],
  craneHours = {},
  alfaRateCard = DEFAULT_DRYDOCK_RATE_CARD_ALFA,
  otTemplates = [],
  templateId = 'PUESTA_SECO_30M',
  existingRows = []
}) {
  if (!ship) return []
  if (String(templateId || '').startsWith('OT_ABC_') && otTemplates.length > 0) {
    return buildRemitoRowsFromOtCatalog({ ship, shipStays, craneHours, otTemplates, templateId, existingRows })
  }

  const shipSpecificStays = shipStays.filter((st) => st.ship_id === ship.id)
  const varaderoDays = shipSpecificStays
    .filter((st) => normKey(st.location).includes('VARADERO'))
    .reduce((acc, st) => {
      const start = st.start_date ? new Date(`${String(st.start_date).slice(0, 10)}T00:00:00`) : null
      const end = st.end_date ? new Date(`${String(st.end_date).slice(0, 10)}T00:00:00`) : new Date()
      if (!start || Number.isNaN(start.getTime())) return acc
      const diff = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
      return acc + diff
    }, 0)

  const muelleDays = shipSpecificStays
    .filter((st) => normKey(st.location).includes('MUELLE'))
    .reduce((acc, st) => {
      const start = st.start_date ? new Date(`${String(st.start_date).slice(0, 10)}T00:00:00`) : null
      const end = st.end_date ? new Date(`${String(st.end_date).slice(0, 10)}T00:00:00`) : new Date()
      if (!start || Number.isNaN(start.getTime())) return acc
      const diff = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
      return acc + diff
    }, 0)

  // Ánodos (`GAL-001`) son provisión del armador: cantidad instalada informada por Jefe de Obra (no Pañol)
  const shipWos = workOrders.filter((w) => w.ship_id === ship.id)
  const hasValvulasOt = shipWos.some((w) => /valvul/i.test(`${w.title} ${w.description}`))
  const hasSondajeOt = shipWos.some((w) => /sondaj/i.test(`${w.title} ${w.description}`))

  const resolveAutoQty = (code) => {
    if (code === 'VAR-001') return varaderoDays > 0 ? 1 : 0
    if (code === 'VAR-003') return varaderoDays
    if (code === 'VAR-004') return muelleDays
    if (code === 'GRU-001') return craneHours.shipGruaChica || 0
    if (code === 'GRU-002') return craneHours.shipGruaGrande || 0
    if (code === 'GAL-001') return 0
    if (code === 'SON-001') return hasSondajeOt ? 1 : 0
    if (code === 'VAL-001') return hasValvulasOt ? 1 : 0
    if (code === 'OBR-OT') return 1
    return 0
  }

  const directCostFloor = round2(shipSummary?.totals?.directTotalUsd || 0)
  const existingByCode = new Map((existingRows || []).map((r) => [r.line_code, r]))

  const templateCards = alfaRateCard.filter(
    (c) => !Array.isArray(c.template_scopes) || c.template_scopes.includes(templateId)
  )

  const syncedRows = templateCards.map((card, idx) => {
    const prev = existingByCode.get(card.code)
    const isObrOt = card.code === 'OBR-OT'
    const autoQty = resolveAutoQty(card.code)
    const suggestedPrice = isObrOt ? round2(directCostFloor * 1.18) : Number(card.unit_price_usd || 0)

    return {
      id: prev?.id || `rem_${ship.id}_${card.code}_${idx}`,
      line_code: card.code,
      rubro: card.rubro,
      concept: prev?.concept || card.concept,
      source_module: card.source_module,
      unit: card.unit,
      quantity: prev?.manualQtyOverride ? Number(prev.quantity || 0) : prev?.quantity ?? autoQty,
      unit_price_usd: prev?.unit_price_usd !== undefined && prev?.unit_price_usd !== null ? Number(prev.unit_price_usd) : suggestedPrice,
      tax_type: prev?.tax_type || card.tax_type || 'GRAVADO_21',
      is_alfa_locked: !isObrOt && Number(card.unit_price_usd || 0) > 0,
      manualQtyOverride: Boolean(prev?.manualQtyOverride),
      internalCostRefUsd: isObrOt ? directCostFloor : 0,
      observations: prev?.observations || card.surchargeNote || ''
    }
  })

  // Conservar filas custom añadidas manualmente por el usuario que no están en plantilla base
  const templateCodes = new Set(templateCards.map((c) => c.code))
  const customRows = (existingRows || []).filter((r) => !templateCodes.has(r.line_code))

  return [...syncedRows, ...customRows]
}

export function computeRemitoFinancialTotals(rows = [], internalDirectCostUsd = 0) {
  let subtotalExento = 0
  let subtotalGravado = 0

  for (const r of rows) {
    const lineNet = (Number(r.quantity) || 0) * (Number(r.unit_price_usd) || 0)
    if (r.tax_type === 'EXENTO') subtotalExento += lineNet
    else subtotalGravado += lineNet
  }

  subtotalExento = round2(subtotalExento)
  subtotalGravado = round2(subtotalGravado)
  const subtotalNetoUsd = round2(subtotalExento + subtotalGravado)
  const iva21Usd = round2(subtotalGravado * 0.21)
  const totalRemitoUsd = round2(subtotalNetoUsd + iva21Usd)
  const margenRealUsd = round2(subtotalNetoUsd - Number(internalDirectCostUsd || 0))
  const margenPct =
    subtotalNetoUsd > 0 ? Number(((margenRealUsd / subtotalNetoUsd) * 100).toFixed(1)) : 0

  return {
    subtotalExento,
    subtotalGravado,
    subtotalNetoUsd,
    iva21Usd,
    totalRemitoUsd,
    margenRealUsd,
    margenPct
  }
}

/**
 * Persiste una clave JSON en `system_settings` usando `onConflict: 'key'` (nunca `id`).
 */
export async function saveSystemSettingJson(key, value, updatedBy = 'Dirección') {
  if (!key) throw new Error('Clave de configuración requerida.')
  if (isInvalidEventOrObjectScalar(key)) throw new Error('Clave inválida.')

  const { data, error } = await systemSettingsRepository.saveByKey(key, value, {
    updatedBy: String(updatedBy || 'Dirección'),
  })

  if (error) throw new Error(error)
  return data
}

/**
 * Guarda cambios de celda del Remito Comercial y registra trazabilidad obligatoria en `audit_logs`.
 */
export async function saveRemitoCellChangeWithAudit({
  shipId,
  shipName,
  allRemitosByShip,
  nextShipRemitoState,
  rowId,
  rowLabel,
  field,
  oldValue,
  newValue,
  cellCoordinates = null,
  user = null
}) {
  if (isInvalidEventOrObjectScalar(newValue)) {
    throw new Error('Valor inválido bloqueado antes de persistir (Event/Object).')
  }

  const updatedMap = {
    ...allRemitosByShip,
    [shipId]: nextShipRemitoState
  }

  await saveSystemSettingJson(REMITO_SETTINGS_KEY, updatedMap, user)

  await logCellChange({
    entityType: 'remito_comercial',
    entityId: `${shipId}::${rowId}`,
    entityName: `${shipName || 'Buque'} · ${rowLabel || rowId}`,
    field,
    fieldLabel: field,
    oldValue,
    newValue,
    sheetName: 'Resumen Gerencial · Remito Comercial Alfa',
    moduleRoute: '/resumen-gerencial',
    cellCoordinates,
    user
  })

  return updatedMap
}

/**
 * Registra altas, duplicaciones, bajas o pegado masivo del Remito Comercial y persiste en `system_settings`.
 */
export async function saveRemitoActionWithAudit({
  actionType = 'ROW_INSERT',
  shipId,
  shipName,
  allRemitosByShip,
  nextShipRemitoState,
  rowId,
  rowLabel,
  changes = {},
  batchUpdates = null,
  user = null
}) {
  const updatedMap = {
    ...allRemitosByShip,
    [shipId]: nextShipRemitoState
  }

  await saveSystemSettingJson(REMITO_SETTINGS_KEY, updatedMap, user)

  if (actionType === 'BATCH_PASTE' && Array.isArray(batchUpdates)) {
    await logBatchPaste({
      entityType: 'remito_comercial',
      entityLabel: `Remito ${shipName || shipId}`,
      updates: batchUpdates,
      sheetName: 'Resumen Gerencial · Remito Comercial Alfa',
      moduleRoute: '/resumen-gerencial',
      user
    })
  } else {
    await logRowAction({
      action: actionType,
      entityType: 'remito_comercial',
      entityId: `${shipId}::${rowId || 'remito'}`,
      entityName: `${shipName || 'Buque'} · ${rowLabel || 'Remito'}`,
      changes,
      sheetName: 'Resumen Gerencial · Remito Comercial Alfa',
      moduleRoute: '/resumen-gerencial',
      user
    })
  }

  return updatedMap
}

/**
 * Persiste tarifas maestras Nivel Alfa en `system_settings` con auditoría en `audit_logs`.
 */
export async function saveAlfaRateCardWithAudit({ nextRates, changedCode, oldPrice, newPrice, user = null }) {
  await saveSystemSettingJson(ALFA_RATES_SETTINGS_KEY, nextRates, user)
  await logCellChange({
    entityType: 'resumen_gerencial_config',
    entityId: `alfa::${changedCode}`,
    entityName: `Tarifario Nivel Alfa · ${changedCode}`,
    field: 'unit_price_usd',
    fieldLabel: 'Tarifa Base USD',
    oldValue: oldPrice,
    newValue: newPrice,
    sheetName: 'Resumen Gerencial · Tarifario Nivel Alfa',
    moduleRoute: '/resumen-gerencial',
    user
  })
}
