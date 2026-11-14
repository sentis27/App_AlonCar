/**
 * comprasPedidosService.js
 * Capa de persistencia desacoplada para la planilla operativa de Pedidos (M4).
 * Cumple Candado #3 (Cero SQL en Vista) y Candado #4 (Trazabilidad en audit_logs).
 */

import { supabase } from '../lib/supabase.js'
import { auditService } from '../lib/auditService.js'

const SHEET_NAME = 'Compras · Pedidos'
const MODULE_ROUTE = '/compras'

export async function updatePedidoFieldService({
  orderId,
  field,
  newValue,
  oldValue,
  extraFields = {},
  entityName = '',
  fieldLabel = field
}) {
  const { error } = await supabase
    .from('purchase_orders')
    .update({ [field]: newValue, ...extraFields, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) throw error

  await auditService.logCellChange({
    entityType: 'purchase_orders',
    entityId: orderId,
    entityName: entityName || `OC #${orderId}`,
    field,
    fieldLabel,
    oldValue,
    newValue,
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE
  })
}

export async function updatePedidoFieldsWithAuditService({
  orderId,
  updates,
  auditField,
  auditLabel,
  oldValue,
  newValue,
  entityName = ''
}) {
  const { error } = await supabase
    .from('purchase_orders')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', orderId)

  if (error) throw error

  if (auditField) {
    await auditService.logCellChange({
      entityType: 'purchase_orders',
      entityId: orderId,
      entityName: entityName || `OC #${orderId}`,
      field: auditField,
      fieldLabel: auditLabel || auditField,
      oldValue,
      newValue,
      sheetName: SHEET_NAME,
      moduleRoute: MODULE_ROUTE
    })
  }
}

export async function batchRevertPedidosService({ colKey, revertMap, computeFortnight }) {
  await Promise.all(
    Object.entries(revertMap).map(async ([id, oldVal]) => {
      let payload = { updated_at: new Date().toISOString() }
      if (colKey === 'ship_id' && oldVal && typeof oldVal === 'object') {
        payload.ship_id = oldVal.ship_id ?? null
        payload.work_order_id = oldVal.work_order_id ?? null
        if (oldVal.charge_type) payload.charge_type = oldVal.charge_type
      } else if (colKey === 'reconciliation' && oldVal && typeof oldVal === 'object') {
        payload.is_reconciled = Boolean(oldVal.is_reconciled)
        payload.invoice_number = oldVal.invoice_number ?? null
        payload.reconciled_at = oldVal.reconciled_at ?? null
        payload.reconciled_by = oldVal.reconciled_by ?? null
      } else if (colKey === 'supplier_helper' && oldVal && typeof oldVal === 'object') {
        payload = { ...payload, ...oldVal }
      } else if (colKey === 'freight' && oldVal && typeof oldVal === 'object') {
        payload.freight_transport_name = oldVal.freight_transport_name ?? null
        payload.freight_request_date = oldVal.freight_request_date ?? null
        payload.freight_estimated_date = oldVal.freight_estimated_date ?? null
      } else if (colKey === 'order_date') {
        payload.order_date = oldVal
        payload.fortnight_period = computeFortnight(oldVal)
      } else {
        payload[colKey] = oldVal
      }
      const { error } = await supabase.from('purchase_orders').update(payload).eq('id', id)
      if (error) throw error
    })
  )
}

export async function batchUpdatePedidosService({ targetIds, dbPayload, colKey, batchItems = [] }) {
  const { error } = await supabase
    .from('purchase_orders')
    .update(dbPayload)
    .in('id', targetIds)

  if (error) throw error

  const items = batchItems.length > 0
    ? batchItems
    : targetIds.map((id) => ({
        entityId: id,
        entityName: `OC #${id}`,
        field: colKey,
        fieldLabel: colKey,
        oldValue: '—',
        newValue: dbPayload[colKey] ?? JSON.stringify(dbPayload)
      }))

  await auditService.logBatchPaste({
    entityType: 'purchase_orders',
    batchItems: items,
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE
  })
}

export async function insertPedidoService({ payload, auditAction = 'ROW_INSERT', entityName = 'Pedido', details = {} }) {
  const { data, error } = await supabase
    .from('purchase_orders')
    .insert([payload])
    .select()
    .single()

  if (error) throw error

  await auditService.logRowAction({
    action: auditAction,
    entityType: 'purchase_orders',
    entityId: data.id,
    entityName,
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
    changes: details
  })

  return data
}

export async function restorePedidoRowService(row) {
  const { error } = await supabase.from('purchase_orders').insert([row])
  if (error) throw error
}

export async function deletePedidoService({ orderId, entityName = 'Pedido', audit = true }) {
  const { error } = await supabase.from('purchase_orders').delete().eq('id', orderId)
  if (error) throw error

  if (audit) {
    await auditService.logRowAction({
      action: 'ROW_DELETE',
      entityType: 'purchase_orders',
      entityId: orderId,
      entityName,
      sheetName: SHEET_NAME,
      moduleRoute: MODULE_ROUTE
    })
  }
}

export async function pastePedidoRowService({ targetId, fieldsToCopy, entityName = '', sourceId }) {
  const { error } = await supabase
    .from('purchase_orders')
    .update({ ...fieldsToCopy, updated_at: new Date().toISOString() })
    .eq('id', targetId)

  if (error) throw error

  await auditService.logRowAction({
    action: 'PASTE_ROW',
    entityType: 'purchase_orders',
    entityId: targetId,
    entityName: entityName || `OC #${targetId}`,
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
    changes: { sourceId }
  })
}

export async function silentUpdatePedidoService(orderId, payload) {
  const { error } = await supabase.from('purchase_orders').update(payload).eq('id', orderId)
  if (error) throw error
}

export async function incrementMaterialStockService(materialId, newStock) {
  const { error } = await supabase.from('materials').update({ current_stock: newStock }).eq('id', materialId)
  if (error) throw error
}

export async function reconcilePedidosBatchService(orderIds, updates) {
  for (const id of orderIds) {
    const { error } = await supabase.from('purchase_orders').update(updates).eq('id', id)
    if (error) throw error
  }
}
