/**
 * stockAuditsRepository.js
 * Repositorio para `stock_audits` (Bitácora de Controles Físicos de Stock) sobre `_baseRepository.js`.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { StockAuditSchema } from '../schemas/panol.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createStockAuditsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'stock_audits',
    primaryKey: 'id',
    schema: StockAuditSchema,
    client,
  })

  return {
    ...base,

    async listAudits({
      select = '*',
      orderBy = [{ column: 'date', ascending: false }, { column: 'created_at', ascending: false }],
      filters = {},
      dateRange = null,
      maxRows,
    } = {}) {
      return base.findAllBatched({ select, orderBy, filters, dateRange, maxRows })
    },

    async listByMaterial(materialId, { select = '*', maxRows } = {}) {
      if (!materialId) return { data: [], error: null, count: 0 }
      return base.findAllBatched({
        select,
        filters: { material_id: materialId },
        orderBy: [{ column: 'date', ascending: false }, { column: 'created_at', ascending: false }],
        maxRows,
      })
    },
  }
}

export const stockAuditsRepository = createStockAuditsRepository()
export default stockAuditsRepository
