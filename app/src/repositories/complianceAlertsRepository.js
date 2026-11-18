/**
 * complianceAlertsRepository.js
 * Repositorios para `compliance_alerts`, `data_requirements` y `worker_permission_requests`.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import {
  ComplianceAlertSchema,
  DataRequirementSchema,
  WorkerPermissionRequestSchema,
} from '../schemas/complianceAlerts.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createDataRequirementsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'data_requirements',
    primaryKey: 'id',
    schema: DataRequirementSchema,
    client,
  })

  return {
    ...base,

    async ensureByCode(code, defaultDef) {
      const { data: existing, error } = await base.findOne({ select: 'id, default_notice_time, default_notice_frequency, max_attempts', filters: { code } })
      if (!error && existing?.id) return { data: existing, error: null }
      if (!defaultDef) return { data: null, error: error || `Requisito desconocido: ${code}` }
      return base.upsertOne(defaultDef, { onConflict: 'code' })
    },
  }
}

export function createComplianceAlertsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'compliance_alerts',
    primaryKey: 'id',
    schema: ComplianceAlertSchema,
    client,
  })

  return {
    ...base,

    async listPending({ select = '*', filters = {}, orderBy = [] } = {}) {
      return base.findAll({ select, filters: { status: 'PENDIENTE', ...filters }, orderBy })
    },

    async listPendingForMariaWithContractFallback() {
      const primary = await base.findAll({
        select: '*, workers(id, name, contract_type, contract_start_date)',
        filters: { entity_type: 'workers', responsible_role: 'maria_jose', status: 'PENDIENTE' },
        orderBy: [{ column: 'created_at', ascending: false }],
      })
      if (primary.error && (primary.code === '42703' || String(primary.error).includes('contract_'))) {
        return base.findAll({
          select: '*, workers(id, name)',
          filters: { entity_type: 'workers', responsible_role: 'maria_jose', status: 'PENDIENTE' },
          orderBy: [{ column: 'created_at', ascending: false }],
        })
      }
      return primary
    },

    async closeByIds(ids = [], patch = {}) {
      if (!Array.isArray(ids) || ids.length === 0) return { data: [], error: null }
      return base.updateWhere({ inFilters: { id: ids } }, patch, { select: null })
    },

    async closePendingForWorkItem(workItemId, patch = {}) {
      return base.updateWhere(
        { filters: { entity_type: 'work_items', entity_id: workItemId, status: 'PENDIENTE' } },
        patch,
        { select: null }
      )
    },
  }
}

export function createWorkerPermissionRequestsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'worker_permission_requests',
    primaryKey: 'id',
    schema: WorkerPermissionRequestSchema,
    client,
  })
  return base
}

export const dataRequirementsRepository = createDataRequirementsRepository()
export const complianceAlertsRepository = createComplianceAlertsRepository()
export const workerPermissionRequestsRepository = createWorkerPermissionRequestsRepository()
export default complianceAlertsRepository
