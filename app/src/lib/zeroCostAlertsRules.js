/**
 * zeroCostAlertsRules.js
 * Reglas puras y Fuente Única de Verdad para alertas pre-facturación de ítems sin valorizar ($0):
 * - Terceros: `third_party_services` activos con `amount_ars <= 0 && amount_usd <= 0`.
 * - Materiales imputados a obra: retiros de Pañol y Compras Directas recibidas (`RECIB.COMP.DIRECT`)
 *   con costo unitario `<= 0`, EXCLUYENDO Elementos de Seguridad (`ELEM.SEGURIDAD` / `ENTREGA_EPP`)
 *   y bajas solicitadas (`is_deletion_requested`). Nunca incluye catálogo maestro `materials`.
 */

function normKey(v) {
  return String(v || '').trim().toUpperCase()
}

/**
 * Predicado único para identificar servicios de Terceros sin valorizar ($0).
 */
export function isThirdPartyZeroCost(service) {
  if (!service || service.is_active === false) return false
  const ars = Number(service.amount_ars ?? service.amountArs) || 0
  const usd = Number(service.amount_usd ?? service.amountUsd) || 0
  return ars <= 0 && usd <= 0
}

/**
 * Predicado único para identificar retiros de Pañol con precio $0 (excluyendo EPP y bajas pendientes).
 */
export function isPanolTxZeroCost(tx, mat = null) {
  if (!tx || tx.is_deletion_requested || tx.isDeletionRequested) return false
  const rawCat = normKey(mat?.category || tx.category)
  const movementType = normKey(tx.movement_type || tx.movementType)
  if (rawCat === 'ELEM.SEGURIDAD' || movementType === 'ENTREGA_EPP') return false

  const unitUsd = Number(tx.unit_cost_usd_snapshot ?? tx.unitUsd ?? mat?.cost_usd) || 0
  return unitUsd <= 0
}

/**
 * Predicado único para identificar Compras Directas recibidas imputadas a obra con precio $0.
 */
export function isDirectPurchaseZeroCost(po) {
  if (!po) return false
  if (normKey(po.charge_type) !== 'DIRECT') return false
  if (normKey(po.status) !== 'RECIB.COMP.DIRECT') return false
  const unitPrice = Number(po.supplier_quoted_price || po.system_unit_price) || 0
  return unitPrice <= 0
}

export function isBillableShip(shipId, shipMap, { includeInactiveShips = true, excludeAstillero = false } = {}) {
  if (!shipId) return false
  const ship = shipMap?.get(shipId)
  if (!ship) return true
  if (excludeAstillero && normKey(ship.name) === 'ASTILLERO') return false
  if (!includeInactiveShips) {
    const st = normKey(ship.status)
    if (ship.is_active === false || ['TERMINADO', 'CERRADO', 'FACTURADO', 'FINALIZADO', 'INACTIVO'].includes(st)) {
      return false
    }
  }
  return true
}

function isShipBillableAndActive(shipId, shipMap, opts = {}) {
  return isBillableShip(shipId, shipMap, opts)
}

/**
 * Construye el resumen unificado de alertas $0 para Resumen Gerencial (por buque)
 * y para el Dashboard (global de obras).
 */
export function buildZeroCostAlertsSummary({
  materialRows = [],
  thirdPartyRows = [],
  ships = [],
  shipFilterId = null,
  requireShip = false,
  includeInactiveShips = true,
  excludeAstillero = false
} = {}) {
  const shipMap = new Map((ships || []).map((s) => [s.id, s]))

  const passesScope = (row) => {
    if (shipFilterId && row.shipId !== shipFilterId) return false
    if (requireShip && !isShipBillableAndActive(row.shipId, shipMap, { includeInactiveShips, excludeAstillero })) {
      return false
    }
    return true
  }

  const thirdPartyItems = (thirdPartyRows || [])
    .filter((row) => Boolean(row?.hasZeroCost) && passesScope(row))
    .map((row) => ({
      id: row.id,
      kind: 'TERCEROS',
      sourceType: 'THIRD_PARTY',
      contractorName: row.contractorName || 'Contratista sin asignar',
      otNumber: row.otNumber || 'Sin OT',
      otTitle: row.otTitle || '',
      workOrderId: row.workOrderId || null,
      shipId: row.shipId || null,
      shipName: row.shipName || 'SIN BUQUE',
      budgetNumber: row.budgetNumber || '',
      voucherNumber: row.voucherNumber || '',
      date: row.date || '',
      observations: row.observations || row.voucherType || 'Pendiente de cotizar / valorizar',
      rubro: row.rubro || 'VARIOS'
    }))

  const materialItems = (materialRows || [])
    .filter((row) => Boolean(row?.hasZeroPrice) && !row?.isDeletionRequested && passesScope(row))
    .map((row) => ({
      id: row.id,
      rawId: row.rawId,
      kind: 'MATERIALES',
      sourceType: row.sourceType || 'PANOL_TX',
      materialName: row.materialName || 'Material sin nombre',
      contractorName: row.contractorLabel || row.workerName || 'ASTILLERO',
      otNumber: row.otNumber || 'Sin OT',
      otTitle: row.otTitle || '',
      workOrderId: row.workOrderId || null,
      shipId: row.shipId || null,
      shipName: row.shipName || 'SIN BUQUE',
      budgetNumber: '',
      voucherNumber: row.voucherNumber || '',
      qty: Number(row.qty) || 0,
      unitMeasure: row.unitMeasure || 'un.',
      date: row.date || '',
      observations: row.notes || `${row.category || 'MATERIALES'} · ${row.sourceType === 'COMPRA_DIRECTA' ? 'Compra Directa' : 'Retiro Pañol'} sin precio`,
      category: row.category || 'MATERIALES'
    }))

  const panolCount = materialItems.filter((i) => i.sourceType === 'PANOL_TX').length
  const directPurchasesCount = materialItems.filter((i) => i.sourceType === 'COMPRA_DIRECTA').length

  return {
    thirdPartyCount: thirdPartyItems.length,
    materialsCount: materialItems.length,
    panolCount,
    directPurchasesCount,
    totalCount: thirdPartyItems.length + materialItems.length,
    thirdPartyItems,
    materialItems
  }
}
