/**
 * profilesRepository.js
 * Repositorio para la tabla `profiles` sobre `_baseRepository.js` + `ProfileSchema`.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { ProfileSchema } from '../schemas/profiles.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createProfilesRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'profiles',
    primaryKey: 'id',
    schema: ProfileSchema,
    client,
  })

  return {
    ...base,

    async getByUserId(userId, { select = '*' } = {}) {
      return base.findById(userId, { select })
    },

    async upsertProfile(payload, opts = {}) {
      return base.upsertOne(payload, { onConflict: 'id', ...opts })
    },
  }
}

export const profilesRepository = createProfilesRepository()
export default profilesRepository
