/**
 * workersRepository.js
 * Repositorio para `workers` (Nómina de Operarios, Contratistas y Talleres) sobre `_baseRepository.js` + `WorkerSchema`.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { WorkerSchema } from '../schemas/workers.schema.js'
import { createBaseRepository } from './_baseRepository.js'

const DEFAULT_ORDER = [
  { column: 'admin_center', ascending: true },
  { column: 'work_group', ascending: true },
  { column: 'name', ascending: true },
]

export function createWorkersRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'workers',
    primaryKey: 'id',
    schema: WorkerSchema,
    client,
  })

  return {
    ...base,

    async listWorkers({ select = '*', orderBy = DEFAULT_ORDER, filters = {}, page, pageSize } = {}) {
      return base.findAll({ select, orderBy, filters, page, pageSize })
    },

    async listLookup() {
      return base.findAll({ select: 'id, name', orderBy: [{ column: 'name', ascending: true }] })
    },

    async listThirdPartyEnabled() {
      return base.findAll({
        select: 'id, name, trade, work_group, admin_center, can_charge_third_party',
        filters: { can_charge_third_party: true },
        orderBy: [{ column: 'name', ascending: true }],
      })
    },

    async listActiveAstilleroContracts() {
      return base.findAll({
        select: 'id, name, admin_center, status, contract_type, contract_start_date',
        filters: { admin_center: 'ASTILLERO', status: 'ACTIVO' },
      })
    },

    async updateWorkersByIds(ids = [], patch, opts = {}) {
      if (!Array.isArray(ids) || ids.length === 0) return { data: [], error: null }
      return base.updateWhere({ inFilters: { id: ids } }, patch, opts)
    },

    async updateWorkersByWorkGroup(workGroup, patch, opts = {}) {
      if (!workGroup) return { data: null, error: 'work_group requerido' }
      return base.updateWhere({ filters: { work_group: workGroup } }, patch, opts)
    },

    async updateWorkersByTrade(trade, patch, opts = {}) {
      if (!trade) return { data: null, error: 'trade requerido' }
      return base.updateWhere({ filters: { trade } }, patch, opts)
    },

    async deleteWorkersByIds(ids = []) {
      if (!Array.isArray(ids) || ids.length === 0) return { data: { deleted: true }, error: null }
      return base.deleteWhere({ inFilters: { id: ids } })
    },
  }
}

export const workersRepository = createWorkersRepository()
export default workersRepository
