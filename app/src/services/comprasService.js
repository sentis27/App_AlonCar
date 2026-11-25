/**
 * comprasService.js
 * Capa de servicio y persistencia desacoplada para Compras, Proveedores y OCR (M4).
 * Cumple Candado Mecánico #3 (Cero SQL en Vista) y #4 (Trazabilidad en audit_logs).
 */

import { logCellChange, logRowAction } from '../lib/auditService.js'
import { assignMonotonicFolios, stampNewRecordWithFolio } from '../lib/monotonicFolioEngine.js'
import { purchaseOrdersRepository, purchaseDocumentsRepository } from '../repositories/purchaseOrdersRepository.js'
import { suppliersRepository } from '../repositories/suppliersRepository.js'
import { shipsRepository } from '../repositories/shipsRepository.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { macroVariablesRepository } from '../repositories/macroVariablesRepository.js'
import { systemSettingsRepository } from '../repositories/systemSettingsRepository.js'
import { materialsRepository } from '../repositories/materialsRepository.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { workItemsRepository } from '../repositories/workItemsRepository.js'
import { buildDateRangeOption, DEFAULT_HISTORY_RANGE } from '../lib/gridPerformanceHelpers.js'

/**
 * Carga completa de órdenes de compra, catálogo de proveedores, materiales y metadatos navales.
 * Aplica ventana temporal configurable (`90d` | `year` | `all`) sin techo de 1.000 filas (FL-025).
 */
export async function fetchComprasData({ historyRange = DEFAULT_HISTORY_RANGE } = {}) {
  const dateRange = buildDateRangeOption('order_date', historyRange)
  const [
    ordersRes,
    suppliersRes,
    materialsRes,
    shipsRes,
    workOrdersRes,
    workItemsRes,
    workersRes,
    macroRes,
    docsRes,
    whatsappSettingRes,
  ] = await Promise.all([
    purchaseOrdersRepository.listOrders({ dateRange }),
    suppliersRepository.listSuppliers(),
    materialsRepository.listMaterials(),
    shipsRepository.listShips({ select: 'id, name, vessel_type' }),
    workOrdersRepository.listCanonicalWorkOrders(),
    workItemsRepository.listCanonicalWorkItems(),
    workersRepository.listWorkers({ select: 'id, name, trade, can_withdraw_materials, phone', orderBy: [{ column: 'name', ascending: true }] }),
    macroVariablesRepository.listMacroVariables(),
    purchaseDocumentsRepository.listDocuments(),
    systemSettingsRepository.getByKey('compras_whatsapp'),
  ])

  if (ordersRes.error) {
    console.error('[comprasService] Error cargando purchase_orders:', ordersRes.error)
  }

  const purchaseOrders = ordersRes.data && ordersRes.data.length > 0
    ? assignMonotonicFolios(ordersRes.data, { dateField: 'order_date' })
    : []

  return {
    purchaseOrders,
    suppliers: suppliersRes.data || [],
    materials: materialsRes.data || [],
    ships: shipsRes.data || [],
    workOrders: workOrdersRes.data || [],
    workItems: workItemsRes.data || [],
    workers: workersRes.data || [],
    macroVariables: macroRes.data || [],
    purchaseDocuments: docsRes.data || [],
    whatsappSetting: whatsappSettingRes.data?.value || null,
  }
}

/**
 * Guarda o actualiza un pedido de compra en purchase_orders con trazabilidad en audit_logs.
 */
export async function savePurchaseOrderService({ order, isNew = false, changedBy = 'Operador Web' }) {
  if (!order) throw new Error('Datos de orden de compra requeridos.')

  let payload = { ...order }
  if (isNew) {
    payload = stampNewRecordWithFolio(payload, 'purchase_orders')
  }

  const { data: savedRecord, error } = await purchaseOrdersRepository.upsertOne(payload, { onConflict: 'id' })
  if (error) {
    console.error('[comprasService] Error guardando pedido de compra:', error)
    throw new Error(error)
  }

  logRowAction({
    action: isNew ? 'CREATE' : 'UPDATE',
    entityType: 'purchase_orders',
    entityId: savedRecord.id,
    entityName: savedRecord.material_name_raw || `OC #${savedRecord.id}`,
    performedBy: changedBy,
    details: {
      supplier_id: savedRecord.supplier_id,
      ship_id: savedRecord.ship_id,
      status: savedRecord.status,
      supplier_quoted_price: savedRecord.supplier_quoted_price,
    },
  })

  return { ok: true, order: savedRecord }
}

/**
 * Elimina una orden de compra con registro en audit_logs.
 */
export async function deletePurchaseOrderService({ orderId, orderName = 'Orden de Compra', changedBy = 'Operador Web' }) {
  if (!orderId) throw new Error('ID de pedido requerido para eliminación.')

  const { error } = await purchaseOrdersRepository.deleteById(orderId)
  if (error) {
    console.error('[comprasService] Error eliminando pedido de compra:', error)
    throw new Error(error)
  }

  logRowAction({
    action: 'DELETE',
    entityType: 'purchase_orders',
    entityId: orderId,
    entityName: orderName,
    performedBy: changedBy,
    details: { deletedAt: new Date().toISOString() },
  })

  return { ok: true }
}

/**
 * Guarda o actualiza un proveedor en el catálogo maestro.
 */
export async function saveSupplierService({ supplier, isNew = false, changedBy = 'Operador Web' }) {
  if (!supplier) throw new Error('Datos de proveedor requeridos.')

  const { data: savedRecord, error } = await suppliersRepository.upsertOne(supplier, { onConflict: 'id' })
  if (error) {
    console.error('[comprasService] Error guardando proveedor:', error)
    throw new Error(error)
  }

  logRowAction({
    action: isNew ? 'CREATE' : 'UPDATE',
    entityType: 'suppliers',
    entityId: savedRecord.id,
    entityName: savedRecord.name || 'Proveedor',
    performedBy: changedBy,
    details: { cuit: savedRecord.cuit, rubro: savedRecord.rubro, phone: savedRecord.phone },
  })

  return { ok: true, supplier: savedRecord }
}

/**
 * Actualiza en lote un campo sobre órdenes de compra seleccionadas.
 */
export async function batchUpdatePurchaseOrdersService({
  colKey,
  newValue,
  targetIds = [],
  revertMap = null,
  isRevert = false,
  changedBy = 'Operador Web',
}) {
  if (!colKey) throw new Error('colKey requerida para actualización batch.')

  if (isRevert && revertMap) {
    for (const [rId, val] of Object.entries(revertMap)) {
      await purchaseOrdersRepository.updateById(rId, { [colKey]: val }, { select: null })
    }
    return { ok: true }
  }

  if (targetIds.length === 0) return { ok: true, count: 0 }

  const { error } = await purchaseOrdersRepository.updateByIds(targetIds, { [colKey]: newValue }, { select: null })
  if (error) {
    console.error('[comprasService] Error en actualización batch:', error)
    throw new Error(error)
  }

  targetIds.forEach((tId) => {
    logCellChange({
      entityType: 'purchase_orders',
      entityId: tId,
      entityName: `OC #${tId}`,
      field: colKey,
      fieldLabel: colKey,
      oldValue: '—',
      newValue,
      changeOrigin: 'BATCH_ACTION',
      performedBy: changedBy,
    })
  })

  return { ok: true, count: targetIds.length }
}

export * from './comprasPedidosService.js'
export * from './comprasAuxService.js'
