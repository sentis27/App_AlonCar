/**
 * gasMovementsRepository.js
 * Repositorio para `gas_cylinder_movements` (Control de Gases Industriales) sobre `_baseRepository.js`.
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
      limit = 800,
    } = {}) {
      return base.findAll({ select, orderBy, filters, limit })
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
