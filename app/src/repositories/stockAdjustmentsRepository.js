/**
 * stockAdjustmentsRepository.js
 * Repositorio para `stock_adjustments` (Entradas manuales, Salidas, Inicialización y Ajustes de Stock)
 * sobre `_baseRepository.js` con lectura por lotes (`FL-025`).
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { StockAdjustmentSchema } from '../schemas/panol.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createStockAdjustmentsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'stock_adjustments',
    primaryKey: 'id',
    schema: StockAdjustmentSchema,
    client,
  })

  return {
    ...base,

    async listAdjustments({
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
        orderBy: [{ column: 'effective_at', ascending: true }],
        maxRows,
      })
    },
  }
}

export const stockAdjustmentsRepository = createStockAdjustmentsRepository()
export default stockAdjustmentsRepository
