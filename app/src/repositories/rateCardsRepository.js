/**
 * rateCardsRepository.js
 * Repositorio piloto para `rate_cards` (Tarifario Quincenal) sobre `_baseRepository.js` + `RateCardSchema`.
 * Cumple Candado #3 (Cero SQL en Vista) y #4 (Trazabilidad obligatoria en `audit_logs`).
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { logRowAction } from '../lib/auditService.js'
import { RateCardSchema } from '../schemas/rateCards.schema.js'
import { createBaseRepository } from './_baseRepository.js'

const DEFAULT_ORDER = [
  { column: 'year', ascending: false },
  { column: 'month', ascending: false },
  { column: 'quincena', ascending: false },
]

export function createRateCardsRepository({ client = defaultClient, audit = { logRowAction } } = {}) {
  const base = createBaseRepository({
    table: 'rate_cards',
    primaryKey: 'id',
    schema: RateCardSchema,
    client,
  })

  return {
    ...base,

    async listRateCards({ period, adminCenter, page, pageSize } = {}) {
      return base.findAll({
        orderBy: DEFAULT_ORDER,
        filters: {
          period,
          admin_center: adminCenter,
        },
        page,
        pageSize,
      })
    },

    async saveRateCard(rateCard, { isNew = false, changedBy = 'Operador Web', validate = true } = {}) {
      const res = await base.upsertOne(rateCard, {
        onConflict: 'period,admin_center,entity_name',
        validate,
      })

      if (res.error) {
        return res
      }

      const saved = res.data
      await audit.logRowAction({
        action: isNew ? 'CREATE' : 'UPDATE',
        entityType: 'rate_cards',
        entityId: saved.id || `${saved.period}_${saved.entity_name}`,
        entityName: `${saved.period} · ${saved.entity_name}`,
        user: changedBy,
        details: {
          rate_oficial_ars: saved.rate_oficial_ars,
          rate_oficial_usd: saved.rate_oficial_usd,
          dollar_rate: saved.dollar_rate,
        },
      })

      return res
    },
  }
}

export const rateCardsRepository = createRateCardsRepository()
export default rateCardsRepository
