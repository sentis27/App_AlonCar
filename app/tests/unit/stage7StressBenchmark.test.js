/**
 * stage7StressBenchmark.test.js
 * Prueba de estrés (Etapa 7 · FL-025) simulando alto volumen operativo real:
 * ~100 líneas diarias por módulo => 3.600+ registros en memoria y 5.200+ en paginación por lotes.
 * Garantiza tiempo de cómputo lineal O(N) (< 150 ms) y cero truncamiento de datos.
 */
import { describe, it, expect } from 'vitest'
import { performance } from 'node:perf_hooks'
import { executeBatchedQuery } from '../../src/repositories/_baseRepositoryHelpers.js'
import {
  buildLookupMap,
  buildGroupedMap,
  buildSearchCorpusMap,
  formatArsCached,
  computeGridSelectionBounds,
  buildDateRangeOption,
} from '../../src/lib/gridPerformanceHelpers.js'
import {
  buildSabanaMatrixIndex,
  computeLaborPageKpis,
  buildDailyControlUnifiedList,
} from '../../src/lib/laborPerformanceHelpers.js'
import {
  getComprasColumnsMeta,
  getFastComprasMatchMap,
  buildMemoizedComprasCellProps,
} from '../../src/lib/comprasPerformanceHelpers.js'
import { computeEffectiveVisibleCount } from '../../src/hooks/useProgressiveRows.js'

describe('Stage 7 — Stress Benchmark FL-025 (3.600+ filas / 100 filas diarias)', () => {
  it('executeBatchedQuery pagina 5.200 registros sin perder ni duplicar filas en < 250 ms', async () => {
    const TOTAL = 5200
    const allRows = Array.from({ length: TOTAL }, (_, i) => ({
      id: `tx-${String(i + 1).padStart(5, '0')}`,
      date_logged: `2026-10-${String((i % 28) + 1).padStart(2, '0')}`,
      amount: (i + 1) * 100,
    }))

    let pageCalls = 0
    const mockClient = {
      from: () => {
        const builder = {
          select: () => builder,
          eq: () => builder,
          neq: () => builder,
          in: () => builder,
          is: () => builder,
          gte: () => builder,
          lte: () => builder,
          gt: () => builder,
          lt: () => builder,
          order: () => builder,
          range: (a, b) => {
            pageCalls++
            return Promise.resolve({ data: allRows.slice(a, b + 1), error: null, count: TOTAL })
          },
        }
        return builder
      },
    }

    const t0 = performance.now()
    const res = await executeBatchedQuery({ table: 'labor_logs', primaryKey: 'id', client: mockClient, batchSize: 1000 })
    const elapsed = performance.now() - t0

    expect(res.error).toBeNull()
    expect(res.data).toHaveLength(TOTAL)
    expect(pageCalls).toBe(6)
    expect(res.data[0].id).toBe('tx-00001')
    expect(res.data[TOTAL - 1].id).toBe('tx-05200')
    expect(elapsed).toBeLessThan(250)
  })

  it('Horas (3.600 imputaciones × 220 operarios): Sábana + Control Diario + KPIs en < 120 ms', () => {
    const days = Array.from({ length: 15 }, (_, d) => ({
      dayNumber: d + 1,
      dateStr: `2026-11-${String(d + 1).padStart(2, '0')}`,
    }))
    const workers = Array.from({ length: 220 }, (_, i) => ({
      name: `OPERARIO ${String(i + 1).padStart(3, '0')}`,
      defaultRubro: i % 2 === 0 ? 'Calderería' : 'Mecánica',
    }))
    const logs = Array.from({ length: 3600 }, (_, i) => {
      const worker = workers[i % workers.length]
      const day = days[Math.floor(i / workers.length) % days.length]
      return {
        id: `log-${i}`,
        date_logged: day.dateStr,
        worker_name: worker.name,
        worker_type: i % 3 === 0 ? 'Astillero' : i % 3 === 1 ? 'Taller' : 'Contratista',
        rubro: worker.defaultRubro,
        hours_normal: 9,
        hours_extra_50: i % 5 === 0 ? 2 : 0,
        hours_extra_100: i % 11 === 0 ? 1 : 0,
        hours_worked: 9 + (i % 5 === 0 ? 2 : 0) + (i % 11 === 0 ? 1 : 0),
        approval_status: i % 10 === 0 ? 'R' : 'S',
      }
    })

    const t0 = performance.now()
    const sabana = buildSabanaMatrixIndex(logs, days)
    const kpis = computeLaborPageKpis(logs, '2026-11-01')
    const daily = buildDailyControlUnifiedList({
      logsForAuditDate: logs.filter((l) => l.date_logged === '2026-11-01'),
      astilleroSource: workers,
      tallerSource: ['TALLER A', 'TALLER B'],
      contratistaSource: ['CONTRATISTA 1', 'CONTRATISTA 2'],
      dailySearch: '',
      dailyFilterType: 'todos',
    })
    const elapsed = performance.now() - t0

    expect(sabana.byWorkerDate.size).toBe(220)
    expect(kpis.countR).toBe(360)
    expect(kpis.dailyCount).toBeGreaterThan(0)
    expect(daily.length).toBeGreaterThanOrEqual(220)
    expect(elapsed).toBeLessThan(120)
  })

  it('Compras (3.600 pedidos): mapas O(1), corpus de búsqueda rápida y formateador cacheado en < 120 ms', () => {
    const ships = Array.from({ length: 40 }, (_, i) => ({ id: `ship-${i}`, name: `BP BUQUE ${i}` }))
    const suppliers = Array.from({ length: 80 }, (_, i) => ({ id: `sup-${i}`, name: `PROVEEDOR ${i}` }))
    const orders = Array.from({ length: 3600 }, (_, i) => ({
      id: `po-${i}`,
      order_date: `2026-11-${String((i % 28) + 1).padStart(2, '0')}`,
      material_name_raw: `BULON INOX M${(i % 24) + 6} LOTE ${i}`,
      ship_id: ships[i % ships.length].id,
      supplier_id: suppliers[i % suppliers.length].id,
      unit_price_ars: 1250.5 + (i % 50) * 10,
      status: i % 4 === 0 ? 'PEDIR' : 'PEDIDO',
    }))

    const t0 = performance.now()
    const shipMap = buildLookupMap(ships, 'id')
    const supMap = buildLookupMap(suppliers, 'id')
    const groupedByShip = buildGroupedMap(orders, 'ship_id')
    const corpus = buildSearchCorpusMap(orders, (o) => `${o.material_name_raw} ${shipMap.get(o.ship_id)?.name || ''} ${supMap.get(o.supplier_id)?.name || ''}`)
    let matches = 0
    for (let i = 0; i < orders.length; i++) {
      const po = orders[i]
      if (getFastComprasMatchMap(po, 'BULON INOX M12', { sup: supMap.get(po.supplier_id), shp: shipMap.get(po.ship_id) }).hasMatch) {
        matches++
      }
    }
    const formattedSample = orders.slice(0, 500).map((o) => formatArsCached(o.unit_price_ars))
    const { indexByKey } = getComprasColumnsMeta('completa')
    const bounds = computeGridSelectionBounds({ startRow: 10, endRow: 50, startCol: 1, endCol: 4 })
    const cellProps = buildMemoizedComprasCellProps({
      rowIndex: 12,
      colKey: 'material_name_raw',
      indexByKey,
      activeColIndex: indexByKey.material_name_raw,
      selStartCol: bounds.minC,
      selEndCol: bounds.maxC,
      fillColIndex: -1,
      fillHandleColIndex: indexByKey.material_name_raw,
      gridActions: { onCellClick: () => {}, onCellMouseDown: () => {}, onCellMouseEnter: () => {} },
    })
    const elapsed = performance.now() - t0

    expect(groupedByShip.size).toBe(40)
    expect(corpus.size).toBe(3600)
    expect(matches).toBe(150)
    expect(formattedSample[0]).toContain('1.250')
    expect(cellProps.renderHandle).toBe(true)
    expect(buildDateRangeOption('order_date', '90d')?.from).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(computeEffectiveVisibleCount({ totalCount: 3600, requestedCount: 60, initialCount: 60, activeIndex: -1 })).toBe(60)
    expect(elapsed).toBeLessThan(120)
  })
})
