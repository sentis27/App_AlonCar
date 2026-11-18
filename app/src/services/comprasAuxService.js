/**
 * comprasAuxService.js
 * Capa de persistencia desacoplada para modales auxiliares de Compras (M4).
 * Cumple Candado #3 (Cero SQL en Vista) y Candado #4 (Trazabilidad en audit_logs).
 */

import { auditService } from '../lib/auditService.js'
import { purchaseOrdersRepository, purchaseDocumentsRepository } from '../repositories/purchaseOrdersRepository.js'
import { materialsRepository } from '../repositories/materialsRepository.js'

const SHEET_PEDIDOS = 'Compras · Pedidos'
const SHEET_DOCS = 'Compras · Documentos'
const MODULE_ROUTE = '/compras'

export async function emitWhatsAppOrdersService({ items = [], supplierName = '' }) {
  const ids = items.map((i) => i.id)
  const nowIso = new Date().toISOString()

  for (const id of ids) {
    const { error } = await purchaseOrdersRepository.updateById(
      id,
      { status: 'PEDIDO', updated_at: nowIso },
      { select: null }
    )
    if (error) throw new Error(error)

    await auditService.logRowAction({
      action: 'STATUS_CHANGE',
      entityType: 'purchase_orders',
      entityId: id,
      entityName: items.find((it) => it.id === id)?.material_name_raw,
      sheetName: SHEET_PEDIDOS,
      moduleRoute: MODULE_ROUTE,
      details: { newStatus: 'PEDIDO', channel: 'WhatsApp', supplier: supplierName },
    })
  }

  return ids
}

export async function uploadPurchaseAttachmentsService({
  order,
  supplierName = 'Proveedor',
  rows = [],
  extractPdfFn = null,
}) {
  const year = new Date().getFullYear()
  const rubro = order.work_type || 'General'
  const safeProv = (supplierName || 'Proveedor').replace(/[^a-zA-Z0-9_-]/g, '_')
  const uploadedDocs = []

  for (const row of rows) {
    const ext = row.file.name.split('.').pop()
    const safeDesc = (row.description || 'Doc').replace(/[^a-zA-Z0-9_-]/g, '_')
    const normalizedName = `${safeDesc}_${safeProv}.${ext}`
    const storagePath = `cotizaciones/${year}/${rubro}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${normalizedName}`

    const { data: urlData, error: uploadError } = await purchaseDocumentsRepository.uploadToStorage(storagePath, row.file)
    if (uploadError) throw new Error(uploadError)

    let extractedText = null
    if (
      extractPdfFn &&
      row.file &&
      (row.file.type === 'application/pdf' || row.file.name.toLowerCase().endsWith('.pdf'))
    ) {
      try {
        extractedText = await extractPdfFn(row.file)
      } catch (e) {
        console.warn('Extracción digital PDF falló:', e)
      }
    }

    const docPayload = {
      purchase_order_id: order.id,
      supplier_id: order.supplier_id || null,
      original_filename: row.file.name,
      normalized_filename: normalizedName,
      storage_path: urlData.publicUrl,
      category: rubro,
      description: row.description || 'Documento adjunto',
      year,
      file_size_bytes: row.file.size,
      doc_type: row.docType,
      is_confidential_labor: row.docType === 'COTIZACION_MANO_OBRA',
      extracted_text: extractedText,
    }

    const { data: newDoc, error: dbError } = await purchaseDocumentsRepository.insertOne(docPayload)
    if (dbError) throw new Error(dbError)

    await auditService.logRowAction({
      action: 'CREATE',
      entityType: 'purchase_documents',
      entityId: newDoc.id,
      entityName: newDoc.original_filename,
      sheetName: SHEET_DOCS,
      moduleRoute: MODULE_ROUTE,
      details: { orderId: order.id, docType: row.docType },
    })

    uploadedDocs.push(newDoc)
  }

  return uploadedDocs
}

export async function registerPartialDeliveryService({
  order,
  receivedQty,
  missingQty,
  remitoNumber,
  notes,
  evidenceFiles = [],
}) {
  const originalQty = Number(order.quantity) || 1
  const cleanRemito = remitoNumber.trim()
  const receivedStatus = order.charge_type === 'DIRECT' ? 'RECIB.COMP.DIRECT' : 'RECIBIDO'

  const originalUpdates = {
    quantity: Number(receivedQty),
    received_quantity: Number(receivedQty),
    missing_quantity: missingQty,
    remito_number: cleanRemito,
    status: receivedStatus,
    notes: `${order.notes ? `${order.notes} | ` : ''}Recepción parcial (${receivedQty}/${originalQty}) s/Remito ${cleanRemito}. ${notes}`,
    updated_at: new Date().toISOString(),
  }

  if (order.charge_type === 'VIA_PANOL' && order.material_id) {
    const { data: matData } = await materialsRepository.findById(order.material_id, { select: 'current_stock' })
    if (matData) {
      const newStock = (matData.current_stock || 0) + Number(receivedQty)
      await materialsRepository.updateStock(order.material_id, newStock)
    }
  }

  const { data: updatedOriginal, error: errOrig } = await purchaseOrdersRepository.updateById(
    order.id,
    originalUpdates,
    { select: '*' }
  )
  if (errOrig) throw new Error(errOrig)

  const childPayload = {
    charge_type: order.charge_type,
    order_date: order.order_date,
    ship_id: order.ship_id,
    work_order_id: order.work_order_id,
    requested_by: order.requested_by || null,
    requested_by_name: order.requested_by_name,
    work_type: order.work_type,
    material_id: order.material_id,
    material_name_raw: order.material_name_raw,
    is_new_material: order.is_new_material,
    quantity: missingQty,
    missing_quantity: missingQty,
    received_quantity: 0,
    unit_measure: order.unit_measure,
    supplier_id: order.supplier_id,
    supplier_quoted_price: order.supplier_quoted_price,
    system_unit_price: order.system_unit_price,
    currency: order.currency || 'ARS',
    status: 'PEDIDO INCOMPLETO',
    urgency: order.urgency || 'URGENTE',
    parent_order_id: order.id,
    remito_number: cleanRemito,
    fortnight_period: order.fortnight_period,
    notes: `Saldo faltante de orden anterior. Remito parcial: ${cleanRemito}. ${notes}`,
  }

  const { data: childOrder, error: errChild } = await purchaseOrdersRepository.insertOne(childPayload)
  if (errChild) throw new Error(errChild)

  const newDocs = []
  if (evidenceFiles.length > 0) {
    const year = new Date().getFullYear()
    for (const f of evidenceFiles) {
      const ext = f.name.split('.').pop()
      const storagePath = `cotizaciones/${year}/remitos/${Date.now()}_remito_${cleanRemito.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`
      const { data: urlData, error: upErr } = await purchaseDocumentsRepository.uploadToStorage(storagePath, f)
      if (!upErr && urlData?.publicUrl) {
        const { data: docRes } = await purchaseDocumentsRepository.insertOne({
          purchase_order_id: order.id,
          supplier_id: order.supplier_id || null,
          original_filename: f.name,
          normalized_filename: `Remito_${cleanRemito}.${ext}`,
          storage_path: urlData.publicUrl,
          category: 'REMITO',
          description: `Remito de entrega parcial ${cleanRemito} (${receivedQty}/${originalQty})`,
          year,
          file_size_bytes: f.size,
          doc_type: 'REMITO',
          is_confidential_labor: false,
        })
        if (docRes) newDocs.push(docRes)
      }
    }
  }

  await auditService.logRowAction({
    action: 'SPLIT',
    entityType: 'purchase_orders',
    entityId: order.id,
    entityName: order.material_name_raw,
    sheetName: SHEET_PEDIDOS,
    moduleRoute: MODULE_ROUTE,
    details: { receivedQty, missingQty, remitoNumber: cleanRemito, childId: childOrder.id },
  })

  return { originalOrder: updatedOriginal, childOrder, newDocs }
}

export async function assignSupplierBatchService({ orderIds = [], supplierId, supplierName = 'Proveedor' }) {
  const { error } = await purchaseOrdersRepository.updateByIds(
    orderIds,
    { supplier_id: supplierId, updated_at: new Date().toISOString() },
    { select: null }
  )
  if (error) throw new Error(error)

  for (const id of orderIds) {
    await auditService.logCellChange({
      sheetName: SHEET_PEDIDOS,
      rowId: id,
      colKey: 'supplier_id',
      colLabel: 'Proveedor',
      oldValue: null,
      newValue: supplierName,
      entityName: supplierName,
      moduleRoute: MODULE_ROUTE,
    })
  }
}

export async function dispatchMandadosService({ dispatchedIds = [], dispatchInfo, candidateOrders = [], workerName = '' }) {
  const { error } = await purchaseOrdersRepository.updateByIds(dispatchedIds, dispatchInfo, { select: null })
  if (error) throw new Error(error)

  for (const id of dispatchedIds) {
    await auditService.logRowAction({
      action: 'DISPATCH',
      entityType: 'purchase_orders',
      entityId: id,
      entityName: candidateOrders.find((it) => it.id === id)?.material_name_raw,
      sheetName: SHEET_PEDIDOS,
      moduleRoute: MODULE_ROUTE,
      details: { worker: workerName, dispatchedAt: dispatchInfo.courier_dispatched_at },
    })
  }
}
