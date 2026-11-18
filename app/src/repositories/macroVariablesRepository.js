/**
 * macroVariablesRepository.js
 * Repositorio para `macro_variables` sobre `_baseRepository.js` + `MacroVariableSchema`.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { MacroVariableSchema } from '../schemas/macroVariables.schema.js'
import { createBaseRepository } from './_baseRepository.js'

const DEFAULT_ORDER = [
  { column: 'year', ascending: false },
  { column: 'month', ascending: false },
]

export function createMacroVariablesRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'macro_variables',
    primaryKey: 'id',
    schema: MacroVariableSchema,
    client,
  })

  return {
    ...base,

    async listMacroVariables({ select = '*', orderBy = DEFAULT_ORDER } = {}) {
      return base.findAll({ select, orderBy })
    },

    async saveMonthlyVariables(payload, { validate = true } = {}) {
      return base.upsertOne(payload, { onConflict: 'year,month', validate })
    },
  }
}

export const macroVariablesRepository = createMacroVariablesRepository()
export default macroVariablesRepository
