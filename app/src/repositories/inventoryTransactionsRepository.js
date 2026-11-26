/**
 * inventoryTransactionsRepository.js
 * Repositorio para `inventory_transactions` (Movimientos de Pañol y Retiros) sobre `_baseRepository.js`.
 * Usa lectura por bloques `findAllBatched` por defecto para romper el techo de 1.000 filas (FL-025).
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { InventoryTransactionSchema } from '../schemas/panol.schema.js'
import { createBaseRepository, handleSupabaseError } from './_baseRepository.js'

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
      dateRange = null,
      limit,
      page,
      pageSize,
      maxRows,
    } = {}) {
      if (page !== undefined || pageSize !== undefined || (limit && limit <= 1000)) {
        return base.findAll({ select, orderBy, filters, gteFilters, lteFilters, dateRange, limit, page, pageSize })
      }
      return base.findAllBatched({ select, orderBy, filters, gteFilters, lteFilters, dateRange, maxRows })
    },

    async listWithVoucherNumber({
      select = 'id, material_id, work_order_id, ship_id, worker_id, quantity_withdrawn, weight_total, voucher_number, transaction_date, contractor_name, worker_name, notes',
    } = {}) {
      return base.findAllBatched({
        select,
        neqFilters: { voucher_number: '' },
        orFilter: 'voucher_number.not.is.null',
        orderBy: [{ column: 'transaction_date', ascending: false }],
      })
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

    async freezePendingStockDays(nowIso = null) {
      if (typeof client?.rpc !== 'function') return { data: null, error: null }
      const params = nowIso ? { p_now: nowIso } : {}
      const { data, error } = await client.rpc('freeze_pending_panol_stock_days', params)
      if (error) return { data: null, error: handleSupabaseError(error) }
      return { data, error: null }
    },
  }
}

export const inventoryTransactionsRepository = createInventoryTransactionsRepository()
export default inventoryTransactionsRepository
