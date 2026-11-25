/**
 * purchaseOrdersRepository.js
 * Repositorios para `purchase_orders` y `purchase_documents` (incluye Storage bucket `compras`).
 * Usa lectura por bloques `findAllBatched` por defecto para romper el techo de 1.000 filas (FL-025).
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { PurchaseOrderSchema, PurchaseDocumentSchema } from '../schemas/purchases.schema.js'
import { createBaseRepository, handleSupabaseError } from './_baseRepository.js'

const DEFAULT_ORDER = [
  { column: 'order_date', ascending: false },
  { column: 'created_at', ascending: false },
]

export function createPurchaseOrdersRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'purchase_orders',
    primaryKey: 'id',
    schema: PurchaseOrderSchema,
    client,
  })

  return {
    ...base,

    async listOrders({ select = '*', orderBy = DEFAULT_ORDER, filters = {}, isNull = [], dateRange = null, limit, page, pageSize, maxRows } = {}) {
      if (page !== undefined || pageSize !== undefined || (limit && limit <= 1000)) {
        return base.findAll({ select, orderBy, filters, isNull, dateRange, limit, page, pageSize })
      }
      return base.findAllBatched({ select, orderBy, filters, isNull, dateRange, maxRows })
    },

    async updateByIds(ids = [], patch, opts = {}) {
      if (!Array.isArray(ids) || ids.length === 0) return { data: [], error: null }
      return base.updateWhere({ inFilters: { id: ids } }, patch, opts)
    },

    async reassignWorkOrder(sourceWoId, targetWoId) {
      return base.updateWhere(
        { filters: { work_order_id: sourceWoId } },
        { work_order_id: targetWoId, updated_at: new Date().toISOString() }
      )
    },
  }
}

export function createPurchaseDocumentsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'purchase_documents',
    primaryKey: 'id',
    schema: PurchaseDocumentSchema,
    client,
  })

  return {
    ...base,

    async listDocuments({ select = '*', orderBy = [{ column: 'created_at', ascending: false }], filters = {}, dateRange = null, limit, page, pageSize, maxRows } = {}) {
      if (page !== undefined || pageSize !== undefined || (limit && limit <= 1000)) {
        return base.findAll({ select, orderBy, filters, dateRange, limit, page, pageSize })
      }
      return base.findAllBatched({ select, orderBy, filters, dateRange, maxRows })
    },

    async uploadToStorage(storagePath, file) {
      const { error } = await client.storage.from('compras').upload(storagePath, file)
      if (error) return { data: null, error: handleSupabaseError(error) }
      const { data: urlData } = client.storage.from('compras').getPublicUrl(storagePath)
      return { data: { publicUrl: urlData?.publicUrl || null }, error: null }
    },

    async reassignWorkOrder(sourceWoId, targetWoId) {
      return base.updateWhere({ filters: { work_order_id: sourceWoId } }, { work_order_id: targetWoId })
    },
  }
}

export const purchaseOrdersRepository = createPurchaseOrdersRepository()
export const purchaseDocumentsRepository = createPurchaseDocumentsRepository()
export default purchaseOrdersRepository
