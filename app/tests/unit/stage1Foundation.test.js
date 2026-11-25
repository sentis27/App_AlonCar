import { describe, it, expect } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createBaseRepository } from '../../src/repositories/_baseRepository.js'
import {
  resolveHistoryRangeCutoff,
  buildDateRangeOption,
  buildLookupMap,
  buildGroupedMap,
  buildSearchCorpusMap,
  createCachedNumberFormatter,
  computeGridSelectionBounds,
  DEFAULT_PROGRESSIVE_BATCH,
} from '../../src/lib/gridPerformanceHelpers.js'
import CanonicalProgressiveTableFooter from '../../src/components/canonical/CanonicalProgressiveTableFooter.jsx'
import CanonicalHistoryRangeSelect from '../../src/components/canonical/CanonicalHistoryRangeSelect.jsx'

function createBatchedMockClient(allRows = [], { failAtRangeFrom = null } = {}) {
  const rangesRequested = []
  const ordersRequested = []
  const gteFilters = []
  const lteFilters = []

  const client = {
    from: () => {
      let rangeStart = 0
      let rangeEnd = allRows.length - 1
      const currentOrders = []
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        neq: () => builder,
        gte: (col, val) => {
          gteFilters.push([col, val])
          return builder
        },
        lte: (col, val) => {
          lteFilters.push([col, val])
          return builder
        },
        ilike: () => builder,
        is: () => builder,
        or: () => builder,
        order: (col, opts) => {
          currentOrders.push([col, opts])
          return builder
        },
        range: (from, to) => {
          rangeStart = from
          rangeEnd = to
          rangesRequested.push([from, to])
          return builder
        },
        then: (resolve) => {
          ordersRequested.push(currentOrders)
          if (failAtRangeFrom !== null && rangeStart >= failAtRangeFrom) {
            return resolve({ data: null, error: { message: 'timeout simulado' }, count: null })
          }
          const slice = allRows.slice(rangeStart, rangeEnd + 1)
          return resolve({ data: slice, error: null, count: allRows.length })
        },
      }
      return builder
    },
  }

  return { client, rangesRequested, ordersRequested, gteFilters, lteFilters }
}

describe('Etapa 1 — findAllBatched() sin techo de 1.000 filas (FL-025)', () => {
  it('lee 2.750 filas en 3 bloques de 1.000 con desempate determinístico por PK y dateRange', async () => {
    const rows = Array.from({ length: 2750 }, (_, i) => ({
      id: `row-${i + 1}`,
      date_logged: '2026-11-20',
      hours_worked: 8,
    }))
    const { client, rangesRequested, ordersRequested, gteFilters } = createBatchedMockClient(rows)
    const repo = createBaseRepository({ table: 'labor_logs', client })

    const res = await repo.findAllBatched({
      orderBy: [{ column: 'date_logged', ascending: false }],
      dateRange: { column: 'date_logged', from: '2026-08-27' },
    })

    expect(res.error).toBe(null)
    expect(res.data).toHaveLength(2750)
    expect(res.count).toBe(2750)
    expect(res.truncated).toBe(false)
    expect(rangesRequested).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
    // Debe agregar `id` ascendente como desempate determinístico en cada página
    expect(ordersRequested[0]).toEqual([
      ['date_logged', { ascending: false }],
      ['id', { ascending: true }],
    ])
    expect(gteFilters[0]).toEqual(['date_logged', '2026-08-27'])
  })

  it('deduplica filas repetidas entre páginas y respeta el límite de seguridad maxRows', async () => {
    const rows = Array.from({ length: 2500 }, (_, i) => ({ id: `id-${i}` }))
    // Simular duplicado en la frontera de página
    rows[1000] = { id: 'id-999' }
    const { client } = createBatchedMockClient(rows)
    const repo = createBaseRepository({ table: 'purchase_orders', client })

    const resFull = await repo.findAllBatched({ batchSize: 1000 })
    expect(resFull.error).toBe(null)
    expect(resFull.data).toHaveLength(2499)

    const { client: capClient } = createBatchedMockClient(
      Array.from({ length: 2500 }, (_, i) => ({ id: `cap-${i}` }))
    )
    const capRepo = createBaseRepository({ table: 'purchase_orders', client: capClient })
    const resCapped = await capRepo.findAllBatched({ batchSize: 1000, maxRows: 1500 })
    expect(resCapped.data).toHaveLength(1500)
    expect(resCapped.truncated).toBe(true)
  })

  it('propaga errores del segundo bloque sin devolver datos parciales corruptos', async () => {
    const rows = Array.from({ length: 1500 }, (_, i) => ({ id: `err-${i}` }))
    const { client } = createBatchedMockClient(rows, { failAtRangeFrom: 1000 })
    const repo = createBaseRepository({ table: 'labor_logs', client })

    const res = await repo.findAllBatched({ batchSize: 1000 })
    expect(res.error).toContain('timeout simulado')
    expect(res.data).toEqual([])
  })
})

describe('Etapa 1 — gridPerformanceHelpers (Opción A + Mapas O(1) + Caché)', () => {
  it('calcula cortes 90d / year / all anclados a Argentina UTC-3 (22:30 ART = día anterior UTC)', () => {
    // 2026-11-25T01:30:00Z corresponde al 24/11/2026 22:30 en Argentina (UTC-3)
    const lateNightAr = new Date('2026-11-25T01:30:00Z')
    expect(resolveHistoryRangeCutoff('90d', { now: lateNightAr })).toBe('2026-08-26')
    expect(resolveHistoryRangeCutoff('90d', { asTimestamp: true, now: lateNightAr })).toBe('2026-08-26T00:00:00-03:00')
    expect(resolveHistoryRangeCutoff('year', { now: lateNightAr })).toBe('2026-01-01')
    expect(resolveHistoryRangeCutoff('all', { now: lateNightAr })).toBe(null)
    expect(buildDateRangeOption('date_logged', '90d', { now: lateNightAr })).toEqual({
      column: 'date_logged',
      from: '2026-08-26',
    })
    expect(buildDateRangeOption('date_logged', 'all', { now: lateNightAr })).toBe(null)
  })

  it('indexa lookup/agrupación/corpus en O(1), cachea números y calcula cotas de selección', () => {
    const items = [
      { id: '1', ship_id: 's1', name: 'Cañería Naval' },
      { id: '2', ship_id: 's1', name: 'Soldadura Tig' },
      { id: '3', ship_id: 's2', name: 'Chapa 6mm' },
    ]
    const byId = buildLookupMap(items)
    expect(byId.get('2')?.name).toBe('Soldadura Tig')

    const byShip = buildGroupedMap(items, 'ship_id')
    expect(byShip.get('s1')).toHaveLength(2)
    expect(byShip.get('s2')).toHaveLength(1)

    const corpus = buildSearchCorpusMap(items, (x) => x.name)
    expect(corpus.get('1')).toBe('caneria naval')

    const fmt = createCachedNumberFormatter('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    expect(fmt(1234.5)).toBe('1,234.50')
    expect(fmt(1234.5)).toBe('1,234.50')

    const bounds = computeGridSelectionBounds({
      activeCell: { rowIndex: 2, colIndex: 1 },
      selectionRange: { startRow: 5, endRow: 2, startCol: 3, endCol: 1 },
      fillRange: { fromRow: 5, toRow: 9, colIndex: 3 },
      columns: [{ readOnly: true }, { readOnly: false }, { readOnly: false }, { readOnly: false }],
    })
    expect(bounds).toEqual({
      selMinR: 2,
      selMaxR: 5,
      selMinC: 1,
      selMaxC: 3,
      fillFromR: 5,
      fillMaxR: 9,
      fillCol: 3,
      handleRow: 5,
      handleCol: 3,
    })
  })
})

describe('Etapa 1 — CanonicalProgressiveTableFooter y CanonicalHistoryRangeSelect', () => {
  it('renderiza pie de tabla y pie bloque con ritmo de tandas de 60 y se oculta si no hay más filas', () => {
    const emptyHtml = renderToStaticMarkup(
      React.createElement(CanonicalProgressiveTableFooter, {
        visibleCount: 40,
        totalCount: 40,
        hasMore: false,
      })
    )
    expect(emptyHtml).toBe('')

    const trHtml = renderToStaticMarkup(
      React.createElement(
        'table',
        null,
        React.createElement(
          'tbody',
          null,
          React.createElement(CanonicalProgressiveTableFooter, {
            visibleCount: 60,
            totalCount: 402,
            hasMore: true,
            remainingCount: 342,
            colSpan: 12,
            batchSize: DEFAULT_PROGRESSIVE_BATCH,
            entityLabel: 'partes',
          })
        )
      )
    )
    expect(trHtml).toContain('colSpan="12"')
    expect(trHtml).toContain('Cargar +60')
    expect(trHtml).toContain('Mostrar todos (402)')
    expect(trHtml).toContain('partes')

    const divHtml = renderToStaticMarkup(
      React.createElement(CanonicalProgressiveTableFooter, {
        visibleCount: 60,
        totalCount: 95,
        hasMore: true,
        remainingCount: 35,
        asDiv: true,
        entityLabel: 'fichas',
      })
    )
    expect(divHtml).toContain('<div')
    expect(divHtml).toContain('Cargar +35')
  })

  it('CanonicalHistoryRangeSelect expone las 3 ventanas de Opción A', () => {
    const html = renderToStaticMarkup(
      React.createElement(CanonicalHistoryRangeSelect, { value: '90d', onChange: () => {} })
    )
    expect(html).toContain('Últimos 90 días')
    expect(html).toContain('Este año')
    expect(html).toContain('Todo el historial')
  })
})
