/**
 * comprasService.js
 * Capa de servicio y persistencia desacoplada para Compras, Proveedores y OCR (M4).
 * Cumple Candado Mecánico #3 (Cero SQL en Vista) y #4 (Trazabilidad en audit_logs).
 */

import { supabase } from '../lib/supabase.js'
import { logCellChange, logRowAction } from '../lib/auditService.js'
import { assignMonotonicFolios, stampNewRecordWithFolio } from '../lib/monotonicFolioEngine.js'

/**
 * Carga completa de órdenes de compra, catálogo de proveedores, materiales y metadatos navales.
 */
export async function fetchComprasData() {
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
    whatsappSettingRes
  ] = await Promise.all([
    supabase
      .from('purchase_orders')
      .select('*')
      .order('order_date', { ascending: false })
      .order('created_at', { ascending: false }),
    supabase.from('suppliers').select('*').order('name'),
    supabase.from('materials').select('*').order('name'),
    supabase.from('ships').select('id, name, vessel_type').order('name'),
    supabase.from('work_orders').select('id, ot_number, title, description, ship_id, status').order('created_at', { ascending: false }),
    supabase.from('work_items').select('id, work_order_id, contractors, description'),
    supabase.from('workers').select('id, name, trade, can_withdraw_materials, phone').order('name'),
    supabase.from('macro_variables').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
    supabase.from('purchase_documents').select('*').order('created_at', { ascending: false }),
    supabase.from('system_settings').select('*').eq('key', 'compras_whatsapp').maybeSingle()
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
    whatsappSetting: whatsappSettingRes.data?.value || null
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

  const { data, error } = await supabase
    .from('purchase_orders')
    .upsert([payload], { onConflict: 'id' })
    .select()

  if (error) {
    console.error('[comprasService] Error guardando pedido de compra:', error)
    throw error
  }

  const savedRecord = data?.[0] || payload

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
      supplier_quoted_price: savedRecord.supplier_quoted_price
    }
  })

  return { ok: true, order: savedRecord }
}

/**
 * Elimina una orden de compra con registro en audit_logs.
 */
export async function deletePurchaseOrderService({ orderId, orderName = 'Orden de Compra', changedBy = 'Operador Web' }) {
  if (!orderId) throw new Error('ID de pedido requerido para eliminación.')

  const { error } = await supabase
    .from('purchase_orders')
    .delete()
    .eq('id', orderId)

  if (error) {
    console.error('[comprasService] Error eliminando pedido de compra:', error)
    throw error
  }

  logRowAction({
    action: 'DELETE',
    entityType: 'purchase_orders',
    entityId: orderId,
    entityName: orderName,
    performedBy: changedBy,
    details: { deletedAt: new Date().toISOString() }
  })

  return { ok: true }
}

/**
 * Guarda o actualiza un proveedor en el catálogo maestro.
 */
export async function saveSupplierService({ supplier, isNew = false, changedBy = 'Operador Web' }) {
  if (!supplier) throw new Error('Datos de proveedor requeridos.')

  const { data, error } = await supabase
    .from('suppliers')
    .upsert([supplier], { onConflict: 'id' })
    .select()

  if (error) {
    console.error('[comprasService] Error guardando proveedor:', error)
    throw error
  }

  const savedRecord = data?.[0] || supplier

  logRowAction({
    action: isNew ? 'CREATE' : 'UPDATE',
    entityType: 'suppliers',
    entityId: savedRecord.id,
    entityName: savedRecord.name || 'Proveedor',
    performedBy: changedBy,
    details: { cuit: savedRecord.cuit, rubro: savedRecord.rubro, phone: savedRecord.phone }
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
  changedBy = 'Operador Web'
}) {
  if (!colKey) throw new Error('colKey requerida para actualización batch.')

  if (isRevert && revertMap) {
    for (const [rId, val] of Object.entries(revertMap)) {
      await supabase.from('purchase_orders').update({ [colKey]: val }).eq('id', rId)
    }
    return { ok: true }
  }

  if (targetIds.length === 0) return { ok: true, count: 0 }

  const { error } = await supabase
    .from('purchase_orders')
    .update({ [colKey]: newValue })
    .in('id', targetIds)

  if (error) {
    console.error('[comprasService] Error en actualización batch:', error)
    throw error
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
      performedBy: changedBy
    })
  })

  return { ok: true, count: targetIds.length }
}

export * from './comprasPedidosService.js'
