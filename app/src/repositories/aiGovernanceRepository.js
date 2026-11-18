/**
 * aiGovernanceRepository.js
 * Repositorios para `system_prompts` (PK `slug`) y `ai_processing_logs` sobre `_baseRepository.js`.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { SystemPromptSchema, AiProcessingLogSchema } from '../schemas/aiGovernance.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createSystemPromptsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'system_prompts',
    primaryKey: 'slug',
    schema: SystemPromptSchema,
    client,
  })

  return {
    ...base,

    async listPrompts() {
      return base.findAll({ orderBy: [{ column: 'slug', ascending: true }] })
    },

    async upsertPrompt(payload) {
      return base.upsertOne(payload, { onConflict: 'slug' })
    },

    async seedDefaultPrompts(prompts = []) {
      return base.upsertMany(prompts, { onConflict: 'slug', select: null })
    },
  }
}

export function createAiProcessingLogsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'ai_processing_logs',
    primaryKey: 'id',
    schema: AiProcessingLogSchema,
    client,
  })

  return {
    ...base,

    async listRecentLogs(limit = 30) {
      return base.findAll({
        orderBy: [{ column: 'created_at', ascending: false }],
        limit,
      })
    },
  }
}

export const systemPromptsRepository = createSystemPromptsRepository()
export const aiProcessingLogsRepository = createAiProcessingLogsRepository()
