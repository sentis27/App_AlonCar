/**
 * laborLogsRepository.js
 * Repositorio para `labor_logs` sobre `_baseRepository.js` + `LaborLogSchema`.
 * Usa lectura por bloques `findAllBatched` por defecto para romper el techo de 1.000 filas (FL-025).
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { LaborLogSchema } from '../schemas/laborLogs.schema.js'
import { createBaseRepository } from './_baseRepository.js'

const DEFAULT_ORDER = [
  { column: 'date_logged', ascending: false },
  { column: 'created_at', ascending: false },
]

export function createLaborLogsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'labor_logs',
    primaryKey: 'id',
    schema: LaborLogSchema,
    client,
  })

  return {
    ...base,

    async listLaborLogs({
      select = '*, ships(id, name), work_orders(id, ot_number, title, ship_id, work_type)',
      orderBy = DEFAULT_ORDER,
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

    async countLaborLogs() {
      return base.findAll({ select: 'id', head: true })
    },

    async insertBlankRow(newPayload) {
      return base.insertOne(newPayload, {
        validate: false,
        select: '*, ships(id, name), work_orders(id, ot_number, title, ship_id, work_type)',
      })
    },

    async updateByIds(ids = [], patch, opts = {}) {
      if (!Array.isArray(ids) || ids.length === 0) return { data: [], error: null }
      return base.updateWhere({ inFilters: { id: ids } }, patch, opts)
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

export const laborLogsRepository = createLaborLogsRepository()
export default laborLogsRepository
