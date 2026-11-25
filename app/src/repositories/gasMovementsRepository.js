/**
 * gasMovementsRepository.js
 * Repositorio para `gas_cylinder_movements` (Control de Gases Industriales) sobre `_baseRepository.js`.
 * Usa lectura por bloques `findAllBatched` por defecto para no cortar saldos de tubos en 800/1.000 filas (FL-025).
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { GasCylinderMovementSchema } from '../schemas/panol.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createGasMovementsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'gas_cylinder_movements',
    primaryKey: 'id',
    schema: GasCylinderMovementSchema,
    client,
  })

  return {
    ...base,

    async listGasMovements({
      select = '*',
      orderBy = [{ column: 'movement_date', ascending: false }],
      filters = {},
      dateRange = null,
      limit,
      page,
      pageSize,
      maxRows,
    } = {}) {
      if (page !== undefined || pageSize !== undefined || (limit && limit <= 1000)) {
        return base.findAll({ select, orderBy, filters, dateRange, limit, page, pageSize })
      }
      return base.findAllBatched({ select, orderBy, filters, dateRange, maxRows })
    },

    async hasTxLinkColumn() {
      const { error } = await base.findAll({ select: 'inventory_transaction_id', limit: 1 })
      return !error
    },

    async reassignWorkOrder(sourceWoId, targetWoId) {
      return base.updateWhere({ filters: { work_order_id: sourceWoId } }, { work_order_id: targetWoId })
    },
  }
}

export const gasMovementsRepository = createGasMovementsRepository()
export default gasMovementsRepository
