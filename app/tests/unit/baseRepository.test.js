import { describe, it, expect, vi } from 'vitest'
import {
  handleSupabaseError,
  paginate,
  createBaseRepository,
} from '../../src/repositories/_baseRepository.js'
import { createRateCardsRepository } from '../../src/repositories/rateCardsRepository.js'

function createMockSupabaseClient({ rows = [], error = null } = {}) {
  const calls = { eq: [], order: [], range: null, upserted: null, deletedId: null }
  const builder = {
    select: () => builder,
    eq: (col, val) => {
      calls.eq.push([col, val])
      return builder
    },
    order: (col, opts) => {
      calls.order.push([col, opts])
      return builder
    },
    range: (from, to) => {
      calls.range = [from, to]
      return builder
    },
    maybeSingle: async () => ({ data: rows[0] || null, error }),
    upsert: (payload) => {
      calls.upserted = payload
      return {
        select: async () => ({ data: payload, error }),
      }
    },
    delete: () => ({
      eq: async (_pk, id) => {
        calls.deletedId = id
        return { error }
      },
    }),
    then: (resolve) => resolve({ data: rows, error, count: rows.length }),
  }

  return {
    calls,
    client: {
      from: () => builder,
    },
  }
}

describe('handleSupabaseError / paginate', () => {
  it('traduce códigos PostgreSQL 23505 y 23503 a mensajes legibles', () => {
    expect(handleSupabaseError({ code: '23505', message: 'duplicate key value' })).toContain(
      'Registro duplicado'
    )
    expect(handleSupabaseError({ code: '23503', message: 'foreign key violation' })).toContain(
      'integridad referencial'
    )
    expect(handleSupabaseError(null)).toBe('')
  })

  it('calcula offsets 0-based y limita pageSize al tope máximo', () => {
    expect(paginate({ page: 1, pageSize: 20 })).toEqual({
      page: 1,
      pageSize: 20,
      from: 0,
      to: 19,
      limit: 20,
    })
    expect(paginate({ page: 3, pageSize: 10 })).toEqual({
      page: 3,
      pageSize: 10,
      from: 20,
      to: 29,
      limit: 10,
    })
    expect(paginate({ page: 1, pageSize: 9999, maxPageSize: 200 }).pageSize).toBe(200)
  })
})

describe('createBaseRepository + createRateCardsRepository', () => {
  it('findAll filtra, ordena, pagina y devuelve { data, error: null, count }', async () => {
    const sample = [{ id: '1', period: '2026-11-1Q', entity_name: 'OFICIAL' }]
    const { client, calls } = createMockSupabaseClient({ rows: sample })
    const repo = createBaseRepository({ table: 'rate_cards', client })

    const res = await repo.findAll({
      filters: { period: '2026-11-1Q', admin_center: 'ALL' },
      orderBy: [{ column: 'year', ascending: false }],
      page: 2,
      pageSize: 25,
    })

    expect(res.error).toBe(null)
    expect(res.data).toEqual(sample)
    expect(res.count).toBe(1)
    expect(calls.eq).toEqual([['period', '2026-11-1Q']])
    expect(calls.range).toEqual([25, 49])
  })

  it('saveRateCard bloquea payloads inválidos con Zod antes de tocar Supabase', async () => {
    const { client, calls } = createMockSupabaseClient()
    const logRowAction = vi.fn()
    const repo = createRateCardsRepository({ client, audit: { logRowAction } })

    const bad = await repo.saveRateCard({
      period: 'INVALIDO',
      year: 2026,
      month: 11,
      quincena: 9,
      admin_center: 'ASTILLERO',
      entity_name: 'OFICIAL',
      rate_oficial_ars: -5,
      rate_oficial_usd: 10,
      dollar_rate: 0,
    })

    expect(bad.error).toBeTruthy()
    expect(bad.data).toBe(null)
    expect(calls.upserted).toBe(null)
    expect(logRowAction).not.toHaveBeenCalled()
  })

  it('saveRateCard guarda y registra auditoría cuando el payload cumple RateCardSchema', async () => {
    const { client, calls } = createMockSupabaseClient()
    const logRowAction = vi.fn()
    const repo = createRateCardsRepository({ client, audit: { logRowAction } })

    const good = await repo.saveRateCard(
      {
        period: '2026-11-1Q',
        year: 2026,
        month: 11,
        quincena: 1,
        admin_center: 'ASTILLERO',
        entity_name: 'OFICIAL',
        rate_oficial_ars: 16365.76,
        rate_oficial_usd: 10.91,
        has_ayudante: false,
        dollar_rate: 1500,
      },
      { isNew: false, changedBy: 'María José' }
    )

    expect(good.error).toBe(null)
    expect(calls.upserted).toHaveLength(1)
    expect(logRowAction).toHaveBeenCalledTimes(1)
  })
})
