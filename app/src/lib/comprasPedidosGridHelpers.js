// ==============================================================================
// HELPERS PUROS DE GRILLA Y PAYLOADS PARA PEDIDOS DE COMPRAS (M4)
// Sin dependencias de React ni Supabase: 100% testeable en Node.
// ==============================================================================

import { deduceUnitMeasure } from './comprasConstants.js'

export function buildPedidosSpreadsheetColumns(viewMode, ships = [], workOrders = []) {
  const cols = [
    { key: 'charge_type', label: 'Destino', readOnly: false },
    { key: 'order_date', label: 'Fecha / Quincena', readOnly: false },
    {
      key: 'ship_id',
      label: 'Buque / OT',
      readOnly: false,
      getValue: (r) => {
        const shpName = ships.find((s) => s.id === r.ship_id)?.name || 'ASTILLERO'
        const woObj = workOrders.find((w) => w.id === r.work_order_id)
        return {
          ship_id: r.ship_id || null,
          work_order_id: r.work_order_id || null,
          charge_type: r.charge_type || 'DIRECT',
          label: `${shpName} / ${woObj?.ot_number || 'Sin OT'}`
        }
      }
    },
    { key: 'requested_by_name', label: 'Solicita', readOnly: false },
    { key: 'material_name_raw', label: 'Material', readOnly: false },
    { key: 'quantity', label: 'Cant.', readOnly: false }
  ]
  if (viewMode === 'completa') {
    cols.push(
      { key: 'supplier_quoted_price', label: '$/U Prov.', readOnly: false },
      { key: 'system_unit_price', label: '$/U Sist.', readOnly: true }
    )
  }
  cols.push(
    { key: 'supplier_id', label: 'Proveedor', readOnly: false },
    { key: 'status', label: 'Estado', readOnly: false },
    { key: 'urgency', label: 'Urg.', readOnly: false },
    { key: 'delivery_date', label: 'F. Entrega', readOnly: false }
  )
  return cols
}

export function buildBatchOrderDbPayload(colKey, newValue, fortnightPeriod) {
  const dbPayload = { updated_at: new Date().toISOString() }
  if (colKey === 'ship_id' && newValue && typeof newValue === 'object') {
    dbPayload.ship_id = newValue.ship_id ?? null
    dbPayload.work_order_id = newValue.work_order_id ?? null
    if (newValue.charge_type) dbPayload.charge_type = newValue.charge_type
  } else if (colKey === 'reconciliation' && newValue && typeof newValue === 'object') {
    dbPayload.is_reconciled = Boolean(newValue.is_reconciled)
    dbPayload.invoice_number = newValue.invoice_number ?? null
    dbPayload.reconciled_at = newValue.reconciled_at ?? null
    dbPayload.reconciled_by = newValue.reconciled_by ?? null
  } else if (colKey === 'freight' && newValue && typeof newValue === 'object') {
    dbPayload.freight_transport_name = newValue.freight_transport_name ?? null
    dbPayload.freight_request_date = newValue.freight_request_date ?? null
    dbPayload.freight_estimated_date = newValue.freight_estimated_date ?? null
  } else if (colKey === 'order_date') {
    dbPayload.order_date = newValue
    dbPayload.fortnight_period = fortnightPeriod
  } else if (colKey === 'material_name_raw') {
    dbPayload.material_name_raw = newValue
    dbPayload.unit_measure = deduceUnitMeasure(String(newValue || ''))
  } else if (colKey === 'charge_type') {
    dbPayload.charge_type = newValue
    if (newValue !== 'DIRECT') dbPayload.work_order_id = null
  } else {
    dbPayload[colKey] = newValue
  }
  return dbPayload
}

export function computeAdjacentCreatedAt(referenceOrder, filteredOrders = [], rowIndex = 0, position = 'below') {
  const refTime = new Date(referenceOrder?.created_at || Date.now()).getTime()
  if (position === 'below') {
    const nextOrder = filteredOrders[rowIndex + 1]
    if (nextOrder?.created_at) {
      const nextTime = new Date(nextOrder.created_at).getTime()
      const mid = Math.round((refTime + nextTime) / 2)
      return mid < refTime && mid > nextTime ? mid : refTime - 1000
    }
    return refTime - 1000
  }
  const prevOrder = filteredOrders[rowIndex - 1]
  if (prevOrder?.created_at) {
    const prevTime = new Date(prevOrder.created_at).getTime()
    const mid = Math.round((refTime + prevTime) / 2)
    return mid > refTime && mid < prevTime ? mid : refTime + 1000
  }
  return refTime + 1000
}

export function buildBlankOrderPayload({ todayStr, fortnight, defaultUser, astShipId }) {
  return {
    order_date: todayStr,
    fortnight_period: fortnight,
    status: 'PEDIR',
    urgency: 'SIN_APURO',
    charge_type: 'VIA_PANOL',
    ship_id: astShipId || null,
    work_order_id: null,
    supplier_id: null,
    requested_by_name: defaultUser,
    material_name_raw: '',
    quantity: 1,
    unit_measure: 'unidad',
    supplier_quoted_price: null,
    system_unit_price: null,
    observations: null,
    is_new_material: true,
    no_catalog_required: false
  }
}

export function buildAdjacentOrderPayload(referenceOrder, { refDate, fortnight, createdAtMs }) {
  return {
    order_date: refDate,
    fortnight_period: fortnight,
    status: referenceOrder.status || 'PEDIR',
    urgency: referenceOrder.urgency || 'SIN_APURO',
    charge_type: referenceOrder.charge_type || 'VIA_PANOL',
    ship_id: referenceOrder.ship_id || null,
    work_order_id: referenceOrder.work_order_id || null,
    supplier_id: referenceOrder.supplier_id || null,
    requested_by_name: referenceOrder.requested_by_name || 'PAÑOL',
    material_name_raw: '',
    quantity: 1,
    unit_measure: 'unidad',
    supplier_quoted_price: null,
    system_unit_price: null,
    observations: null,
    is_new_material: true,
    no_catalog_required: false,
    created_at: new Date(createdAtMs).toISOString()
  }
}

export function buildDuplicateOrderPayload(order, { todayStr, fortnight }) {
  return {
    order_date: todayStr,
    fortnight_period: fortnight,
    status: 'PEDIR',
    urgency: order.urgency || 'SIN_APURO',
    charge_type: order.charge_type || 'DIRECT',
    ship_id: order.ship_id || null,
    work_order_id: order.work_order_id || null,
    supplier_id: order.supplier_id || null,
    requested_by_name: order.requested_by_name || 'PAÑOL',
    material_name_raw: order.material_name_raw || '',
    material_id: order.material_id || null,
    quantity: order.quantity || 1,
    unit_measure: order.unit_measure || 'unidad',
    supplier_quoted_price: order.supplier_quoted_price || null,
    system_unit_price: order.system_unit_price || null,
    observations: order.observations || null,
    is_new_material: Boolean(order.is_new_material),
    no_catalog_required: Boolean(order.no_catalog_required)
  }
}

export function buildBatchStatusMeta(ids, purchaseOrders, targetStatus) {
  const previousValues = {}
  const batchItems = []
  ids.forEach((id) => {
    const po = purchaseOrders.find((p) => p.id === id)
    if (po) {
      previousValues[id] = { status: po.status, charge_type: po.charge_type }
      batchItems.push({
        entityId: id,
        entityName: po.material_name_raw || `OC #${id}`,
        field: 'status',
        fieldLabel: 'Estado',
        oldValue: po.status,
        newValue: targetStatus
      })
    }
  })
  return { previousValues, batchItems }
}
