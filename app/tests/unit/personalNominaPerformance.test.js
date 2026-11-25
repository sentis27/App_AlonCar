import { describe, it, expect } from 'vitest'
import { computeEffectiveVisibleCount } from '../../src/hooks/useProgressiveRows.js'
import {
  formatArsRate,
  buildNominaSearchCorpusMap,
  buildNominaContractMap,
  filterNominaWorkers
} from '../../src/lib/personalNominaHelpers.js'

function makeSyntheticWorkers(count = 403) {
  return Array.from({ length: count }, (_, i) => ({
    id: `w-${i + 1}`,
    name: i === 380 ? 'RAMÓN GÓMEZ SPECIAL' : `OPERARIO PRUEBA ${i + 1}`,
    category: i % 3 === 0 ? 'OFICIAL' : i % 3 === 1 ? '1/2 OFICIAL' : 'AYUDANTE',
    trade: i % 4 === 0 ? 'CALDERERIA' : 'SOLDADURA',
    hourly_rate_ars: 15000 + i * 10,
    hourly_rate_usd: 10,
    work_group: i % 2 === 0 ? 'ASTILLERO' : 'RAMON ARANDA',
    admin_center: i % 2 === 0 ? 'ASTILLERO' : 'CONTRATISTA',
    status: i % 10 === 0 ? 'INACTIVO' : 'ACTIVO',
    phone: i === 380 ? '223-555-9988' : '',
    contract_type: i % 2 === 0 ? 'PERMANENTE' : '',
    contract_start_date: null,
    created_at: '2026-10-01T12:00:00Z'
  }))
}

describe('Personal Nómina — Ventana progresiva y optimización de búsqueda (403 filas)', () => {
  it('computeEffectiveVisibleCount acota 403 filas a 60 y se expande con scroll o teclado', () => {
    expect(computeEffectiveVisibleCount({ totalCount: 0, requestedCount: 60, initialCount: 60 })).toBe(0)
    expect(computeEffectiveVisibleCount({ totalCount: 403, requestedCount: 60, initialCount: 60 })).toBe(60)
    expect(computeEffectiveVisibleCount({ totalCount: 403, requestedCount: 120, initialCount: 60 })).toBe(120)
    expect(computeEffectiveVisibleCount({ totalCount: 403, requestedCount: 60, initialCount: 60, activeIndex: 95 })).toBe(108)
    expect(computeEffectiveVisibleCount({ totalCount: 403, requestedCount: 500, initialCount: 60 })).toBe(403)
  })

  it('filterNominaWorkers con corpus precomputado mantiene paridad 1:1 con el crawler sobre 403 personas', () => {
    const workers = makeSyntheticWorkers(403)
    const corpusMap = buildNominaSearchCorpusMap(workers)
    expect(corpusMap.size).toBe(403)

    const queries = ['ramon gomez', '223-555-9988', 'caldereria astillero', '18800', 'inexistente_xyz']
    for (const q of queries) {
      const withoutMap = filterNominaWorkers(workers, { searchTerm: q })
      const withMap = filterNominaWorkers(workers, { searchTerm: q, searchCorpusMap: corpusMap })
      expect(withMap.map((w) => w.id)).toEqual(withoutMap.map((w) => w.id))
    }

    // Caso específico al final del padrón (#381, fuera de la ventana inicial de 60)
    const foundDeep = filterNominaWorkers(workers, { searchTerm: 'gomez special', searchCorpusMap: corpusMap })
    expect(foundDeep).toHaveLength(1)
    expect(foundDeep[0].id).toBe('w-381')
  })

  it('formatArsRate y buildNominaContractMap operan sin error y solo precomputan contratos de ASTILLERO', () => {
    expect(formatArsRate(16365.76)).toContain('16.365')
    expect(formatArsRate(null)).toBe('0')

    const workers = makeSyntheticWorkers(20)
    const contractMap = buildNominaContractMap(workers)
    expect(contractMap.size).toBe(10)
    expect(contractMap.get('w-1')?.isPermanent).toBe(true)
    expect(contractMap.has('w-2')).toBe(false)
  })
})
