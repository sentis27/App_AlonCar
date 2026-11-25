/**
 * thirdPartyServicesRepository.js
 * Repositorios para `third_party_services` y `third_party_voucher_history`.
 * Usa lectura por bloques `findAllBatched` por defecto para romper el techo de 1.000 filas (FL-025).
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { ThirdPartyServiceSchema, ThirdPartyVoucherHistorySchema } from '../schemas/thirdParty.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createThirdPartyServicesRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'third_party_services',
    primaryKey: 'id',
    schema: ThirdPartyServiceSchema,
    client,
  })

  return {
    ...base,

    async listServices({
      select = '*',
      orderBy = [{ column: 'created_at', ascending: false }],
      filters = {},
      isNull = [],
      dateRange = null,
      limit,
      page,
      pageSize,
      maxRows,
    } = {}) {
      if (page !== undefined || pageSize !== undefined || (limit && limit <= 1000)) {
        return base.findAll({ select, orderBy, filters, isNull, dateRange, limit, page, pageSize })
      }
      return base.findAllBatched({ select, orderBy, filters, isNull, dateRange, maxRows })
    },

    async insertBlankRow(payload) {
      return base.insertOne(payload, { validate: false, select: '*' })
    },

    async updateByIds(ids = [], patch, opts = {}) {
      if (!Array.isArray(ids) || ids.length === 0) return { data: [], error: null }
      return base.updateWhere({ inFilters: { id: ids } }, patch, opts)
    },

    async deleteByWorkItemId(workItemId) {
      if (!workItemId) return { data: null, error: 'work_item_id requerido' }
      return base.deleteWhere({ filters: { work_item_id: workItemId } })
    },

    async reassignWorkOrder(sourceWoId, targetWoId, { sealWorkItemId = null } = {}) {
      const patch = sealWorkItemId
        ? { work_order_id: targetWoId, work_item_id: sealWorkItemId, updated_at: new Date().toISOString() }
        : { work_order_id: targetWoId, updated_at: new Date().toISOString() }
      return base.updateWhere({ filters: { work_order_id: sourceWoId } }, patch)
    },

    async reassignByWorkItemId(workItemId, targetWoId) {
      return base.updateWhere(
        { filters: { work_item_id: workItemId } },
        { work_order_id: targetWoId, updated_at: new Date().toISOString() }
      )
    },
  }
}

export function createThirdPartyVoucherHistoryRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'third_party_voucher_history',
    primaryKey: 'id',
    schema: ThirdPartyVoucherHistorySchema,
    client,
  })

  return {
    ...base,

    async listHistory({ orderBy = [{ column: 'created_at', ascending: false }] } = {}) {
      return base.findAllBatched({ orderBy })
    },
  }
}

export const thirdPartyServicesRepository = createThirdPartyServicesRepository()
export const thirdPartyVoucherHistoryRepository = createThirdPartyVoucherHistoryRepository()
export default thirdPartyServicesRepository
