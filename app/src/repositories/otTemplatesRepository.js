/**
 * otTemplatesRepository.js
 * Repositorio para `ot_templates` (Catálogo OT.ABC) sobre `_baseRepository.js` + `OtTemplateSchema`.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { OtTemplateSchema } from '../schemas/otTemplates.schema.js'
import { createBaseRepository } from './_baseRepository.js'

const DEFAULT_ORDER = [
  { column: 'sort_order', ascending: true },
  { column: 'name', ascending: true },
]

export function createOtTemplatesRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'ot_templates',
    primaryKey: 'id',
    schema: OtTemplateSchema,
    client,
  })

  return {
    ...base,

    async listTemplates({ select = '*', orderBy = DEFAULT_ORDER } = {}) {
      return base.findAll({ select, orderBy })
    },
  }
}

export const otTemplatesRepository = createOtTemplatesRepository()
export default otTemplatesRepository
