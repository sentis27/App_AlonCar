import { describe, it, expect, vi } from 'vitest'
import {
  handleSupabaseError,
  paginate,
  createBaseRepository,
} from '../../src/repositories/_baseRepository.js'
import { createRateCardsRepository } from '../../src/repositories/rateCardsRepository.js'
import { WorkerSchema } from '../../src/schemas/index.js'

function createMockSupabaseClient({ rows = [], error = null } = {}) {
  const calls = {
    eq: [], inCalls: [], orCalls: [], order: [], range: null,
    inserted: null, upserted: null, updated: null, deletedId: null, deletedCalled: false,
  }
  const builder = {
    select: () => builder,
    eq: (col, val) => {
      calls.eq.push([col, val])
      return builder
    },
    in: (col, arr) => {
      calls.inCalls.push([col, arr])
      return builder
    },
    or: (expr) => {
      calls.orCalls.push(expr)
      return builder
    },
    order: (col, opts) => {
      calls.order.push([col, opts])
      return builder
    },
    limit: () => builder,
    range: (from, to) => {
      calls.range = [from, to]
      return builder
    },
    maybeSingle: async () => ({ data: rows[0] || null, error }),
    insert: (payload) => {
      calls.inserted = payload
      return {
        select: async () => ({ data: payload, error }),
        then: (resolve) => resolve({ data: payload, error }),
      }
    },
    upsert: (payload) => {
      calls.upserted = payload
      return {
        select: async () => ({ data: payload, error }),
      }
    },
    update: (payload) => {
      calls.updated = payload
      return builder
    },
    delete: () => ({
      eq: async (_pk, id) => {
        calls.deletedId = id
        return { error }
      },
      in: async (col, arr) => {
        calls.deletedCalled = true
        calls.inCalls.push([col, arr])
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

  it('updateById valida parcialmente sin inyectar defaults de columnas omitidas y bloquea trampas/eventos', async () => {
    const { client, calls } = createMockSupabaseClient({ rows: [{ id: 'w-1', status: 'INACTIVO' }] })
    const repo = createBaseRepository({ table: 'workers', schema: WorkerSchema, client })

    const ok = await repo.updateById('w-1', { status: 'INACTIVO' })
    expect(ok.error).toBe(null)
    expect(calls.updated).toEqual({ status: 'INACTIVO' })
    expect('hourly_rate_ars' in calls.updated).toBe(false)

    const trap = await repo.updateById('w-1', { status: 'ACTIVO', first_name: 'Juan' })
    expect(trap.error).toContain('first_name')

    const domEvt = await repo.updateById('w-1', { name: { nativeEvent: {}, target: {} } })
    expect(domEvt.error).toContain('Event')
  })

  it('updateWhere y deleteWhere exigen al menos un filtro (fail-fast) y soportan orFilter', async () => {
    const { client, calls } = createMockSupabaseClient()
    const repo = createBaseRepository({ table: 'workers', schema: WorkerSchema, client })

    const emptyUpd = await repo.updateWhere({}, { status: 'ACTIVO' })
    expect(emptyUpd.error).toContain('filtro')

    const emptyDel = await repo.deleteWhere({})
    expect(emptyDel.error).toContain('filtro')

    const withOr = await repo.updateWhere(
      { filters: { admin_center: 'CONTRATISTA' }, orFilter: 'work_group.eq.ALDO AYUDANTE,category.eq.ALDO AYUDANTE' },
      { hourly_rate_ars: 14000 }
    )
    expect(withOr.error).toBe(null)
    expect(calls.orCalls).toEqual(['work_group.eq.ALDO AYUDANTE,category.eq.ALDO AYUDANTE'])
  })
})
