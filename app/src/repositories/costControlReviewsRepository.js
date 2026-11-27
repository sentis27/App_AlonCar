/**
 * costControlReviewsRepository.js
 * Repositorio para `cost_control_reviews` sobre `_baseRepository.js` + `CostControlReviewSchema`.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { CostControlReviewSchema } from '../schemas/costControl.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createCostControlReviewsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'cost_control_reviews',
    primaryKey: 'id',
    schema: CostControlReviewSchema,
    client,
  })

  return {
    ...base,

    async listByPeriod(periodKey, { reviewType = null, select = '*' } = {}) {
      const cleanPeriod = String(periodKey || '').trim()
      if (!cleanPeriod) return { data: [], error: null, count: 0 }
      const filters = { period_key: cleanPeriod }
      if (reviewType) filters.review_type = reviewType
      return base.findAllBatched({
        select,
        filters,
        orderBy: [{ column: 'reviewed_at', ascending: false }],
      })
    },

    async listByPeriods(periodKeys = [], { reviewType = null, select = '*' } = {}) {
      const cleanPeriods = [...new Set((periodKeys || []).map((k) => String(k || '').trim()).filter(Boolean))]
      if (cleanPeriods.length === 0) return { data: [], error: null, count: 0 }
      const filters = reviewType ? { review_type: reviewType } : {}
      return base.findAllBatched({
        select,
        inFilters: { period_key: cleanPeriods },
        filters,
        orderBy: [{ column: 'reviewed_at', ascending: false }],
      })
    },

    async upsertByReviewKey(payload) {
      return base.upsertOne(payload, { onConflict: 'review_key' })
    },

    async deleteByReviewKey(reviewKey) {
      const cleanKey = String(reviewKey || '').trim()
      if (!cleanKey) return { data: null, error: 'review_key requerido' }
      return base.deleteWhere({ filters: { review_key: cleanKey } })
    },
  }
}

export const costControlReviewsRepository = createCostControlReviewsRepository()
export default costControlReviewsRepository
