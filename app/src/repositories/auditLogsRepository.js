/**
 * auditLogsRepository.js
 * Repositorio para `audit_logs` (GEMINI.md §3) sobre `_baseRepository.js` + `AuditLogSchema`.
 * Soporta lectura por bloques `findAllBatched` + `dateRange` para romper el tope de 300/1.000 eventos (FL-025).
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { AuditLogSchema } from '../schemas/auditLogs.schema.js'
import { validatePayload } from '../schemas/index.js'
import { createBaseRepository, handleSupabaseError } from './_baseRepository.js'

export function createAuditLogsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'audit_logs',
    primaryKey: 'id',
    schema: AuditLogSchema,
    client,
  })

  return {
    ...base,

    async insertLog(payload) {
      const check = validatePayload(AuditLogSchema, payload)
      if (!check.success) return { data: null, error: check.error, issues: check.issues }
      const { data, error } = await client.from('audit_logs').insert(check.data).select().single()
      if (error) return { data: null, error: handleSupabaseError(error) }
      return { data: data || check.data, error: null }
    },

    async insertLogsBatch(rows = []) {
      return base.insertMany(rows)
    },

    async listForEntity(entityId, { entityType = null, limit = 50 } = {}) {
      const filters = { entity_id: String(entityId) }
      if (entityType) filters.entity_type = String(entityType)
      return base.findAll({
        filters,
        orderBy: [{ column: 'created_at', ascending: false }],
        limit,
      })
    },

    async listGlobalLedger({
      entityType = 'ALL',
      actionFilter = 'ALL',
      userFilter = 'ALL',
      dateFrom = '',
      dateTo = '',
      dateRange = null,
      limit = null,
      maxRows = 10000,
    } = {}) {
      const queryOpts = {
        filters: { entity_type: entityType, action: actionFilter, performed_by: userFilter },
        gteFilters: dateFrom ? { created_at: `${dateFrom}T00:00:00` } : {},
        lteFilters: dateTo ? { created_at: `${dateTo}T23:59:59` } : {},
        dateRange: !dateFrom && !dateTo ? dateRange : null,
        orderBy: [{ column: 'created_at', ascending: false }],
      }
      if (limit && limit <= 1000) {
        return base.findAll({ ...queryOpts, limit })
      }
      return base.findAllBatched({ ...queryOpts, maxRows })
    },
  }
}

export const auditLogsRepository = createAuditLogsRepository()
export default auditLogsRepository
