/**
 * comprasOcrSettingsService.js
 * Capa de servicio para Configuración Compras, Documentos OCR, Proveedores y Modales (Candado #3: Cero SQL en Vista).
 */

import { auditService } from '../lib/auditService.js'
import { systemSettingsRepository } from '../repositories/systemSettingsRepository.js'
import { purchaseOrdersRepository, purchaseDocumentsRepository } from '../repositories/purchaseOrdersRepository.js'
import { suppliersRepository } from '../repositories/suppliersRepository.js'
import { materialsRepository } from '../repositories/materialsRepository.js'

const COMPRAS_SETTINGS_KEYS = ['compras_whatsapp', 'se_compra_alertas', 'gases_p02_alerta']

export async function loadComprasSettingsService() {
  const { data, error } = await systemSettingsRepository.findAll({
    inFilters: { key: COMPRAS_SETTINGS_KEYS },
  })
  if (error) throw new Error(error)
  return data || []
}

export async function saveComprasSettingsService(entries = [], updatedBy = 'Administrador') {
  for (const item of entries) {
    if (!item?.key) continue
    const { error } = await systemSettingsRepository.saveByKey(item.key, item.value, { updatedBy })
    if (error) throw new Error(error)
  }
  return { ok: true }
}

export async function createPurchaseDocumentWithUploadService({ storagePath, file, buildPayload }) {
  const upRes = await purchaseDocumentsRepository.uploadToStorage(storagePath, file)
  if (upRes.error) throw new Error(upRes.error)
  const payload = buildPayload(upRes.data?.publicUrl || '')
  const { data, error } = await purchaseDocumentsRepository.insertOne(payload)
  if (error) throw new Error(error)
  return data
}

export async function updatePurchaseDocumentService(docId, updates) {
  const { data, error } = await purchaseDocumentsRepository.updateById(docId, updates)
  if (error) throw new Error(error)
  return data
}

export async function replacePurchaseDocumentFileService({ docId, storagePath, file, buildUpdates }) {
  const upRes = await purchaseDocumentsRepository.uploadToStorage(storagePath, file)
  if (upRes.error) throw new Error(upRes.error)
  const updates = buildUpdates(upRes.data?.publicUrl || '')
  const { data, error } = await purchaseDocumentsRepository.updateById(docId, updates)
  if (error) throw new Error(error)
  return data
}

export async function deletePurchaseDocumentService(docId) {
  const { error } = await purchaseDocumentsRepository.deleteById(docId)
  if (error) throw new Error(error)
  return { ok: true }
}

export async function saveSupplierFromModalService({ supplierId = null, payload }) {
  if (supplierId) {
    const { data, error } = await suppliersRepository.updateById(supplierId, payload)
    if (error) throw new Error(error)
    await auditService.logRowAction({
      action: 'MODAL_SAVE',
      entityType: 'suppliers',
      entityId: supplierId,
      entityName: payload.name,
      changes: payload,
      sheetName: 'Compras · Proveedores',
      moduleRoute: '/compras',
    })
    return data
  }
  const { data, error } = await suppliersRepository.insertOne(payload)
  if (error) throw new Error(error)
  await auditService.logRowAction({
    action: 'ROW_INSERT',
    entityType: 'suppliers',
    entityId: data.id,
    entityName: payload.name,
    rowData: payload,
    sheetName: 'Compras · Proveedores',
    moduleRoute: '/compras',
  })
  return data
}

export async function patchSupplierInlineService(supplierId, updates) {
  const { error } = await suppliersRepository.updateById(supplierId, updates, { select: null })
  if (error) throw new Error(error)
  return { ok: true }
}

export async function deleteSupplierRecordService(supplierId) {
  const { error } = await suppliersRepository.deleteById(supplierId)
  if (error) throw new Error(error)
  return { ok: true }
}

export async function dismissOrderCatalogRequirementService({ order }) {
  const { error } = await purchaseOrdersRepository.updateById(
    order.id,
    { no_catalog_required: true, updated_at: new Date().toISOString() },
    { select: null }
  )
  if (error) throw new Error(error)
  await auditService.logRowAction({
    action: 'UPDATE',
    entityType: 'purchase_orders',
    entityId: order.id,
    entityName: order.material_name_raw,
    sheetName: 'Compras · Pedidos',
    moduleRoute: '/compras',
    details: { no_catalog_required: true },
  })
  return { ok: true }
}

export async function createCatalogMaterialWithImageService({ storagePath = null, imageFile = null, buildPayload }) {
  let imageUrl = null
  if (imageFile && storagePath) {
    const upRes = await purchaseDocumentsRepository.uploadToStorage(storagePath, imageFile)
    if (upRes.error) throw new Error(upRes.error)
    imageUrl = upRes.data?.publicUrl || null
  }
  const payload = buildPayload(imageUrl)
  const { data, error } = await materialsRepository.insertOne(payload)
  if (error) throw new Error(error)
  await auditService.logRowAction({
    action: 'CREATE',
    entityType: 'materials',
    entityId: data.id,
    entityName: data.name,
    sheetName: 'Compras · Catálogo',
    moduleRoute: '/compras',
    details: { newMaterial: data },
  })
  return data
}

export async function savePurchaseOrdersFromModalService({ orderId = null, payloads = [] }) {
  if (orderId) {
    const { data, error } = await purchaseOrdersRepository.updateById(orderId, payloads[0])
    if (error) throw new Error(error)
    await auditService.logRowAction({
      action: 'UPDATE',
      entityType: 'purchase_orders',
      entityId: orderId,
      entityName: payloads[0].material_name_raw,
      sheetName: 'Compras · Pedidos',
      moduleRoute: '/compras',
      details: { updatedOrder: payloads[0] },
    })
    return [data]
  }
  const { data, error } = await purchaseOrdersRepository.insertMany(payloads)
  if (error) throw new Error(error)
  for (const inserted of (data || [])) {
    await auditService.logRowAction({
      action: 'CREATE',
      entityType: 'purchase_orders',
      entityId: inserted.id,
      entityName: inserted.material_name_raw,
      sheetName: 'Compras · Pedidos',
      moduleRoute: '/compras',
      details: { newOrder: inserted },
    })
  }
  return data || []
}
