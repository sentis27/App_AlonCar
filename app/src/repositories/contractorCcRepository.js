/**
 * contractorCcRepository.js
 * Repositorio para `contractor_cc_movements` (Cuenta Corriente & Pagos de Contratistas)
 * y `contractor_settlement_closures` (Cierres quincenales y observaciones por fila).
 * Usa `findAllBatched` por defecto para superar el techo de 1.000 filas (FL-025).
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import {
  ContractorCcMovementSchema,
  ContractorSettlementClosureSchema,
} from '../schemas/contractorCc.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createContractorCcRepository({ client = defaultClient } = {}) {
  const movementsBase = createBaseRepository({
    table: 'contractor_cc_movements',
    primaryKey: 'id',
    schema: ContractorCcMovementSchema,
    client,
  })

  const closuresBase = createBaseRepository({
    table: 'contractor_settlement_closures',
    primaryKey: 'id',
    schema: ContractorSettlementClosureSchema,
    client,
  })

  return {
    movementsTable: movementsBase,
    closuresTable: closuresBase,

    async listMovements({
      filters = {},
      orderBy = [
        { column: 'movement_date', ascending: false },
        { column: 'created_at', ascending: false },
      ],
    } = {}) {
      return movementsBase.findAllBatched({
        select: '*',
        filters,
        orderBy,
      })
    },

    async insertMovement(payload) {
      return movementsBase.insertOne(payload)
    },

    async updateMovement(id, patch) {
      return movementsBase.updateById(id, patch)
    },

    async deleteMovement(id) {
      return movementsBase.deleteById(id)
    },

    async listClosures({
      filters = {},
      orderBy = [{ column: 'period_key', ascending: false }],
    } = {}) {
      return closuresBase.findAllBatched({
        select: '*',
        filters,
        orderBy,
      })
    },

    async upsertClosure(payload) {
      return closuresBase.upsertOne(payload, { onConflict: 'period_key,row_key' })
    },

    async upsertClosuresBatch(rows = []) {
      return closuresBase.upsertMany(rows, { onConflict: 'period_key,row_key' })
    },

    async updateClosure(id, patch) {
      return closuresBase.updateById(id, patch)
    },
  }
}

export const contractorCcRepository = createContractorCcRepository()
export default contractorCcRepository
