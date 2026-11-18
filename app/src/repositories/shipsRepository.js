/**
 * shipsRepository.js
 * Repositorios para `ships` y `ship_documents` (incluye bucket Storage `ship-documents`).
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { ShipSchema, ShipDocumentSchema } from '../schemas/ships.schema.js'
import { createBaseRepository, handleSupabaseError } from './_baseRepository.js'

export function createShipsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'ships',
    primaryKey: 'id',
    schema: ShipSchema,
    client,
  })

  return {
    ...base,

    async listShips({ select = '*', orderBy = [{ column: 'name', ascending: true }], filters = {} } = {}) {
      return base.findAll({ select, orderBy, filters })
    },

    async countShips() {
      return base.findAll({ select: 'id', head: true })
    },

    async updateByIds(ids = [], patch, opts = {}) {
      if (!Array.isArray(ids) || ids.length === 0) return { data: [], error: null }
      return base.updateWhere({ inFilters: { id: ids } }, patch, opts)
    },
  }
}

export function createShipDocumentsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'ship_documents',
    primaryKey: 'id',
    schema: ShipDocumentSchema,
    client,
  })

  return {
    ...base,

    async uploadToStorage(filePath, file) {
      const { error } = await client.storage.from('ship-documents').upload(filePath, file, { upsert: true })
      if (error) return { data: null, error: handleSupabaseError(error) }
      const { data: urlData } = client.storage.from('ship-documents').getPublicUrl(filePath)
      return { data: { publicUrl: urlData?.publicUrl || null }, error: null }
    },
  }
}

export const shipsRepository = createShipsRepository()
export const shipDocumentsRepository = createShipDocumentsRepository()
export default shipsRepository
