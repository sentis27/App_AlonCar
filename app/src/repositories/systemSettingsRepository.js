/**
 * systemSettingsRepository.js
 * Repositorio para `system_settings` (PK `key`, GEMINI.md §3) sobre `_baseRepository.js` + `SystemSettingSchema`.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { SystemSettingSchema } from '../schemas/systemSettings.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createSystemSettingsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'system_settings',
    primaryKey: 'key',
    schema: SystemSettingSchema,
    client,
  })

  return {
    ...base,

    async listSettings({ select = 'key, value, updated_at, updated_by' } = {}) {
      return base.findAll({ select })
    },

    async getByKey(key, { select = '*' } = {}) {
      if (!key) return { data: null, error: 'Clave (key) de configuración requerida' }
      return base.findById(key, { select })
    },

    async saveByKey(key, value, { updatedBy = 'Sistema', validate = true } = {}) {
      return base.upsertOne(
        {
          key: String(key || ''),
          value,
          updated_at: new Date().toISOString(),
          updated_by: String(updatedBy || 'Sistema'),
        },
        { onConflict: 'key', validate }
      )
    },
  }
}

export const systemSettingsRepository = createSystemSettingsRepository()
export default systemSettingsRepository
