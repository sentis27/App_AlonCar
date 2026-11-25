/**
 * shipStaysRepository.js
 * Repositorio para `ship_stays` (Estadías y Movimientos de Muelle) sobre `_baseRepository.js`.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { ShipStaySchema } from '../schemas/ships.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createShipStaysRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'ship_stays',
    primaryKey: 'id',
    schema: ShipStaySchema,
    client,
  })

  return {
    ...base,

    async listStays({ select = '*', orderBy = [{ column: 'start_date', ascending: false }], filters = {} } = {}) {
      return base.findAllBatched({ select, orderBy, filters })
    },

    async updateByIds(ids = [], patch, opts = {}) {
      if (!Array.isArray(ids) || ids.length === 0) return { data: [], error: null }
      return base.updateWhere({ inFilters: { id: ids } }, patch, opts)
    },
  }
}

export const shipStaysRepository = createShipStaysRepository()
export default shipStaysRepository
