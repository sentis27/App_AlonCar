/**
 * comprasPedidosService.js
 * Capa de persistencia desacoplada para la planilla operativa de Pedidos (M4).
 * Cumple Candado #3 (Cero SQL en Vista) y Candado #4 (Trazabilidad en audit_logs).
 */

import { auditService } from '../lib/auditService.js'
import { getWorkersLookupCached, resolveWorkerIdFromCatalog, stampWorkerIdOnRecord } from '../lib/workerIdentity.js'
import { purchaseOrdersRepository } from '../repositories/purchaseOrdersRepository.js'
import { materialsRepository } from '../repositories/materialsRepository.js'

const SHEET_NAME = 'Compras · Pedidos'
const MODULE_ROUTE = '/compras'

export async function updatePedidoFieldService({
  orderId,
  field,
  newValue,
  oldValue,
  extraFields = {},
  entityName = '',
  fieldLabel = field,
}) {
  const finalExtra = { ...extraFields }
  if (field === 'requested_by_name' && !finalExtra.requested_by) {
    const workersCatalog = await getWorkersLookupCached()
    finalExtra.requested_by = resolveWorkerIdFromCatalog(newValue, workersCatalog)
  }

  const { error } = await purchaseOrdersRepository.updateById(
    orderId,
    { [field]: newValue, ...finalExtra, updated_at: new Date().toISOString() },
    { select: null }
  )
  if (error) throw new Error(error)

  await auditService.logCellChange({
    entityType: 'purchase_orders',
    entityId: orderId,
    entityName: entityName || `OC #${orderId}`,
    field,
    fieldLabel,
    oldValue,
    newValue,
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
  })
}

export async function updatePedidoFieldsWithAuditService({
  orderId,
  updates,
  auditField,
  auditLabel,
  oldValue,
  newValue,
  entityName = '',
}) {
  const { error } = await purchaseOrdersRepository.updateById(
    orderId,
    { ...updates, updated_at: new Date().toISOString() },
    { select: null }
  )
  if (error) throw new Error(error)

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
      moduleRoute: MODULE_ROUTE,
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
      const { error } = await purchaseOrdersRepository.updateById(id, payload, { select: null })
      if (error) throw new Error(error)
    })
  )
}

export async function batchUpdatePedidosService({ targetIds, dbPayload, colKey, batchItems = [] }) {
  const { error } = await purchaseOrdersRepository.updateByIds(targetIds, dbPayload, { select: null })
  if (error) throw new Error(error)

  const items = batchItems.length > 0
    ? batchItems
    : targetIds.map((id) => ({
        entityId: id,
        entityName: `OC #${id}`,
        field: colKey,
        fieldLabel: colKey,
        oldValue: '—',
        newValue: dbPayload[colKey] ?? JSON.stringify(dbPayload),
      }))

  await auditService.logBatchPaste({
    entityType: 'purchase_orders',
    batchItems: items,
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
  })
}

export async function insertPedidoService({ payload, auditAction = 'ROW_INSERT', entityName = 'Pedido', details = {} }) {
  let safePayload = payload
  if (safePayload && !safePayload.requested_by && safePayload.requested_by_name) {
    const workersCatalog = await getWorkersLookupCached()
    safePayload = stampWorkerIdOnRecord(safePayload, workersCatalog, {
      nameFields: ['requested_by_name'],
      idField: 'requested_by',
    })
  }

  const { data, error } = await purchaseOrdersRepository.insertOne(safePayload)
  if (error) throw new Error(error)

  await auditService.logRowAction({
    action: auditAction,
    entityType: 'purchase_orders',
    entityId: data.id,
    entityName,
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
    changes: details,
  })

  return data
}

export async function restorePedidoRowService(row) {
  const { error } = await purchaseOrdersRepository.insertOne(row, { select: null })
  if (error) throw new Error(error)
}

export async function deletePedidoService({ orderId, entityName = 'Pedido', audit = true }) {
  const { error } = await purchaseOrdersRepository.deleteById(orderId)
  if (error) throw new Error(error)

  if (audit) {
    await auditService.logRowAction({
      action: 'ROW_DELETE',
      entityType: 'purchase_orders',
      entityId: orderId,
      entityName,
      sheetName: SHEET_NAME,
      moduleRoute: MODULE_ROUTE,
    })
  }
}

export async function pastePedidoRowService({ targetId, fieldsToCopy, entityName = '', sourceId }) {
  const { error } = await purchaseOrdersRepository.updateById(
    targetId,
    { ...fieldsToCopy, updated_at: new Date().toISOString() },
    { select: null }
  )
  if (error) throw new Error(error)

  await auditService.logRowAction({
    action: 'PASTE_ROW',
    entityType: 'purchase_orders',
    entityId: targetId,
    entityName: entityName || `OC #${targetId}`,
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
    changes: { sourceId },
  })
}

export async function silentUpdatePedidoService(orderId, payload) {
  const { error } = await purchaseOrdersRepository.updateById(orderId, payload, { select: null })
  if (error) throw new Error(error)
}

export async function fetchMaterialStockService(materialId) {
  if (!materialId) return null
  const { data, error } = await materialsRepository.findById(materialId, { select: 'id, current_stock' })
  if (error) return null
  return data ? { id: data.id, current_stock: Number(data.current_stock) || 0 } : null
}

export async function incrementMaterialStockService(materialId, newStock) {
  const { error } = await materialsRepository.updateStock(materialId, newStock)
  if (error) throw new Error(error)
}

export async function reconcilePedidosBatchService(orderIds, updates) {
  for (const id of orderIds) {
    const { error } = await purchaseOrdersRepository.updateById(id, updates, { select: null })
    if (error) throw new Error(error)
  }
}
