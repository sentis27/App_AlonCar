/**
 * workOrdersRepository.js
 * Repositorio para `work_orders` sobre `_baseRepository.js` + `WorkOrderSchema`.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { WorkOrderSchema } from '../schemas/workOrders.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createWorkOrdersRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'work_orders',
    primaryKey: 'id',
    schema: WorkOrderSchema,
    client,
  })

  return {
    ...base,

    async listWorkOrders({ select = '*', orderBy = [{ column: 'created_at', ascending: false }], filters = {} } = {}) {
      return base.findAll({ select, orderBy, filters })
    },

    async countWorkOrders() {
      return base.findAll({ select: 'id', head: true })
    },

    async findByShipAndOtNumber(shipId, otNumber, { select = 'id, status, merged_into_wo_id' } = {}) {
      return base.findAll({ select, filters: { ship_id: shipId, ot_number: otNumber } })
    },

    async updateByIds(ids = [], patch, opts = {}) {
      if (!Array.isArray(ids) || ids.length === 0) return { data: [], error: null }
      return base.updateWhere({ inFilters: { id: ids } }, patch, opts)
    },
  }
}

export const workOrdersRepository = createWorkOrdersRepository()
export default workOrdersRepository
