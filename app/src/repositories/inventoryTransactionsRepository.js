/**
 * inventoryTransactionsRepository.js
 * Repositorio para `inventory_transactions` (Movimientos de Pañol y Retiros) sobre `_baseRepository.js`.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { InventoryTransactionSchema } from '../schemas/panol.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createInventoryTransactionsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'inventory_transactions',
    primaryKey: 'id',
    schema: InventoryTransactionSchema,
    client,
  })

  return {
    ...base,

    async listTransactions({
      select = '*',
      orderBy = [{ column: 'transaction_date', ascending: false }],
      filters = {},
      gteFilters = {},
      lteFilters = {},
      limit,
    } = {}) {
      return base.findAll({ select, orderBy, filters, gteFilters, lteFilters, limit })
    },

    async insertBlankRow(payload) {
      return base.insertOne(payload, { validate: false, select: '*' })
    },

    async deleteByIds(ids = []) {
      if (!Array.isArray(ids) || ids.length === 0) return { data: { deleted: true }, error: null }
      return base.deleteWhere({ inFilters: { id: ids } })
    },

    async reassignWorkOrder(sourceWoId, targetWoId, { sealWorkItemId = null } = {}) {
      const patch = sealWorkItemId
        ? { work_order_id: targetWoId, work_item_id: sealWorkItemId }
        : { work_order_id: targetWoId }
      return base.updateWhere({ filters: { work_order_id: sourceWoId } }, patch)
    },

    async reassignByWorkItemId(workItemId, targetWoId) {
      return base.updateWhere({ filters: { work_item_id: workItemId } }, { work_order_id: targetWoId })
    },
  }
}

export const inventoryTransactionsRepository = createInventoryTransactionsRepository()
export default inventoryTransactionsRepository
