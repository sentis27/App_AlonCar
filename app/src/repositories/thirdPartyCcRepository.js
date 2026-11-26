/**
 * thirdPartyCcRepository.js
 * Repositorios para Cuentas Corrientes de Talleres (`third_party_cc_accounts`,
 * `third_party_cc_rate_history`, `third_party_cc_entries` y `third_party_cc_payments`).
 * Todos usan `findAllBatched` por defecto para romper el techo de 1.000 filas (FL-025).
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import {
  ThirdPartyCcAccountSchema,
  ThirdPartyCcRateHistorySchema,
  ThirdPartyCcEntrySchema,
  ThirdPartyCcPaymentSchema,
} from '../schemas/thirdPartyCc.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createThirdPartyCcAccountsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'third_party_cc_accounts',
    primaryKey: 'id',
    schema: ThirdPartyCcAccountSchema,
    client,
  })
  return {
    ...base,
    async listAccounts({ filters = { is_active: true }, orderBy = [{ column: 'created_at', ascending: true }] } = {}) {
      return base.findAllBatched({ filters, orderBy })
    },
  }
}

export function createThirdPartyCcRateHistoryRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'third_party_cc_rate_history',
    primaryKey: 'id',
    schema: ThirdPartyCcRateHistorySchema,
    client,
  })
  return {
    ...base,
    async listByAccount(accountId = null) {
      const filters = accountId ? { account_id: accountId } : {}
      return base.findAllBatched({
        filters,
        orderBy: [
          { column: 'effective_from', ascending: false },
          { column: 'created_at', ascending: false },
        ],
      })
    },
  }
}

export function createThirdPartyCcEntriesRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'third_party_cc_entries',
    primaryKey: 'id',
    schema: ThirdPartyCcEntrySchema,
    client,
  })
  return {
    ...base,
    async listByAccount(accountId = null) {
      const filters = accountId ? { account_id: accountId } : {}
      return base.findAllBatched({
        filters,
        orderBy: [
          { column: 'entry_date', ascending: true },
          { column: 'created_at', ascending: true },
        ],
      })
    },
    async upsertBySourceKey(payload) {
      return base.upsertOne(payload, { onConflict: 'account_id,source_key' })
    },
  }
}

export function createThirdPartyCcPaymentsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'third_party_cc_payments',
    primaryKey: 'id',
    schema: ThirdPartyCcPaymentSchema,
    client,
  })
  return {
    ...base,
    async listByAccount(accountId = null) {
      const filters = accountId ? { account_id: accountId } : {}
      return base.findAllBatched({
        filters,
        orderBy: [
          { column: 'payment_date', ascending: false },
          { column: 'created_at', ascending: false },
        ],
      })
    },
  }
}

export const thirdPartyCcAccountsRepository = createThirdPartyCcAccountsRepository()
export const thirdPartyCcRateHistoryRepository = createThirdPartyCcRateHistoryRepository()
export const thirdPartyCcEntriesRepository = createThirdPartyCcEntriesRepository()
export const thirdPartyCcPaymentsRepository = createThirdPartyCcPaymentsRepository()
export default thirdPartyCcAccountsRepository
