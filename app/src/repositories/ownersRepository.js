/**
 * ownersRepository.js
 * Repositorios para `owners` (Armadores / Razón Social) y `contacts`.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { OwnerSchema, ContactSchema } from '../schemas/ships.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createOwnersRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'owners',
    primaryKey: 'id',
    schema: OwnerSchema,
    client,
  })

  return {
    ...base,

    async listOwners({ select = '*', orderBy = [{ column: 'name', ascending: true }], filters = {} } = {}) {
      return base.findAll({ select, orderBy, filters })
    },

    async updateByIds(ids = [], patch, opts = {}) {
      if (!Array.isArray(ids) || ids.length === 0) return { data: [], error: null }
      return base.updateWhere({ inFilters: { id: ids } }, patch, opts)
    },
  }
}

export function createContactsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'contacts',
    primaryKey: 'id',
    schema: ContactSchema,
    client,
  })

  return {
    ...base,

    async listContacts({ select = '*, owners(id, name), ships(id, name)', orderBy = [{ column: 'name', ascending: true }] } = {}) {
      return base.findAll({ select, orderBy })
    },
  }
}

export const ownersRepository = createOwnersRepository()
export const contactsRepository = createContactsRepository()
export default ownersRepository
