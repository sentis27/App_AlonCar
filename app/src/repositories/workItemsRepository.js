/**
 * workItemsRepository.js
 * Repositorio para `work_items` sobre `_baseRepository.js` + `WorkItemSchema`.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { WorkItemSchema } from '../schemas/workItems.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export const WORK_ITEM_CANONICAL_SELECT =
  'id, work_order_id, description, contractors, foreman_name, status, work_type, trade, created_at'

export function createWorkItemsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'work_items',
    primaryKey: 'id',
    schema: WorkItemSchema,
    client,
  })

  return {
    ...base,

    async listWorkItems({ select = '*', orderBy = [{ column: 'created_at', ascending: true }], filters = {} } = {}) {
      return base.findAll({ select, orderBy, filters })
    },

    async listCanonicalWorkItems({ orderBy = [{ column: 'created_at', ascending: true }], filters = {} } = {}) {
      return base.findAll({ select: WORK_ITEM_CANONICAL_SELECT, orderBy, filters })
    },

    async listByWorkOrderIds(woIds = [], { select = 'id, work_order_id, status, comments' } = {}) {
      if (!Array.isArray(woIds) || woIds.length === 0) return { data: [], error: null, count: 0 }
      return base.findAll({ select, inFilters: { work_order_id: woIds } })
    },

    async listPendingBudgetAlerts() {
      return base.findAll({
        select: 'id, work_order_id, description, status, assignment_type, specific_budget_id, created_at, work_orders(id, ot_number, title, ship_id, ships(name))',
        filters: { assignment_type: 'Adicional / Específico' },
        neqFilters: { status: 'Desestimado' },
        orderBy: [{ column: 'created_at', ascending: false }],
      })
    },

    async updateNonDesestimadoByWoIds(woIds = [], patch, { select = 'id, description' } = {}) {
      if (!Array.isArray(woIds) || woIds.length === 0) return { data: [], error: null }
      return base.updateWhere(
        { inFilters: { work_order_id: woIds }, neqFilters: { status: 'Desestimado' } },
        patch,
        { select }
      )
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

export const workItemsRepository = createWorkItemsRepository()
export default workItemsRepository
