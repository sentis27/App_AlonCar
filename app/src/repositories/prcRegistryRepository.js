/**
 * prcRegistryRepository.js
 * Repositorio para `contractor_prc_registry` (Base de datos única de PRC #2000+).
 * Usa `findAllBatched` por defecto para superar el techo de 1.000 filas (FL-025).
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { findInvalidEventField, validatePartialPayload } from '../schemas/index.js'
import { ContractorPrcRegistrySchema, PRC_MIN_NUMBER } from '../schemas/prcRegistry.schema.js'
import { createBaseRepository, handleSupabaseError } from './_baseRepository.js'

export const PRC_REGISTRY_CANONICAL_SELECT = '*'

export function createPrcRegistryRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'contractor_prc_registry',
    primaryKey: 'id',
    schema: ContractorPrcRegistrySchema,
    client,
  })

  return {
    ...base,

    async listCanonicalPrcs({
      filters = {},
      orderBy = [{ column: 'prc_number', ascending: false }],
    } = {}) {
      return base.findAllBatched({
        select: PRC_REGISTRY_CANONICAL_SELECT,
        filters,
        orderBy,
      })
    },

    async peekNextPrcNumber() {
      const { data, error } = await client.rpc('peek_next_contractor_prc_number')
      if (error) return { data: null, error: handleSupabaseError(error) }
      const num = Number(data)
      return {
        data: Number.isFinite(num) && num >= PRC_MIN_NUMBER ? num : PRC_MIN_NUMBER,
        error: null,
      }
    },

    async issuePrc(payload = {}) {
      const invalidKey = findInvalidEventField(payload)
      if (invalidKey) {
        return { data: null, error: `${invalidKey}: Valor inválido bloqueado (Event / [object Object])` }
      }
      const { prc_number: _ignored, id: _ignoredId, ...candidate } = payload || {}
      const check = validatePartialPayload(ContractorPrcRegistrySchema, candidate)
      if (!check.success) return { data: null, error: check.error }

      const v = check.data
      const rpcParams = {
        p_contractor_name: String(v.contractor_name || '').trim(),
        p_contractor_worker_id: v.contractor_worker_id || null,
        p_ship_id: v.ship_id || null,
        p_work_order_id: v.work_order_id || null,
        p_work_item_id: v.work_item_id || null,
        p_third_party_service_id: v.third_party_service_id || null,
        p_description: v.description || '',
        p_amount_ars: Number(v.amount_ars || 0),
        p_amount_usd: v.amount_usd !== undefined && v.amount_usd !== null ? Number(v.amount_usd) : 0,
        p_exchange_rate: v.exchange_rate ? Number(v.exchange_rate) : null,
        p_issue_date: v.issue_date || null,
        p_parent_prc_id: v.parent_prc_id || null,
        p_source_module: v.source_module || 'TERCEROS_PRC',
        p_observations: v.observations || null,
        p_created_by: v.created_by || null,
      }
      const { data, error } = await client.rpc('issue_contractor_prc', rpcParams)
      if (error) return { data: null, error: handleSupabaseError(error) }
      return { data: data || null, error: null }
    },

    async annulPrc(id, { annulled_reason, annulled_by = 'ADMIN' } = {}) {
      const reason = String(annulled_reason || '').trim()
      if (!reason) return { data: null, error: 'El motivo de anulación es obligatorio.' }
      return base.updateById(id, {
        status: 'ANULADO',
        annulled_reason: reason,
        annulled_by: annulled_by || 'ADMIN',
        annulled_at: new Date().toISOString(),
      })
    },

    async updatePrcDetails(id, patch = {}) {
      const safePatch = { ...(patch || {}) }
      delete safePatch.id
      delete safePatch.prc_number
      return base.updateById(id, safePatch)
    },
  }
}

export const prcRegistryRepository = createPrcRegistryRepository()
export default prcRegistryRepository
