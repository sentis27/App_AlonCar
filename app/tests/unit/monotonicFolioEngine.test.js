import { describe, it, expect } from 'vitest'
import {
  assignMonotonicFolios,
  getNextMonotonicFolio,
  stampNewRecordWithFolio,
} from '../../src/lib/monotonicFolioEngine.js'

describe('assignMonotonicFolios', () => {
  it('devuelve el mismo array si está vacío o no es array', () => {
    expect(assignMonotonicFolios([])).toEqual([])
    expect(assignMonotonicFolios(null)).toBe(null)
  })

  it('asigna #1 al registro más antiguo y conserva el orden visual', () => {
    const items = [
      { id: 'c', created_at: '2026-03-01' },
      { id: 'a', created_at: '2026-01-01' },
      { id: 'b', created_at: '2026-02-01' },
    ]
    const out = assignMonotonicFolios(items)
    expect(out.map((r) => r.id)).toEqual(['c', 'a', 'b'])
    expect(out.map((r) => r._rowSeq)).toEqual([3, 1, 2])
  })

  it('preserva folios existentes y numera los nuevos desde max + 1', () => {
    const items = [
      { id: 'a', _rowSeq: 5, created_at: '2026-01-01' },
      { id: 'nuevo', created_at: '2026-05-01' },
    ]
    const out = assignMonotonicFolios(items)
    expect(out.find((r) => r.id === 'a')._rowSeq).toBe(5)
    expect(out.find((r) => r.id === 'nuevo')._rowSeq).toBe(6)
  })

  it('las filas _skipFolio quedan con _rowSeq null y no consumen número', () => {
    const items = [
      { id: 'a', created_at: '2026-01-01' },
      { id: 'placeholder', _skipFolio: true },
      { id: 'b', created_at: '2026-02-01' },
    ]
    const out = assignMonotonicFolios(items)
    expect(out[1]._rowSeq).toBe(null)
    expect(out[0]._rowSeq).toBe(1)
    expect(out[2]._rowSeq).toBe(2)
  })

  it('usa el id como desempate cuando las fechas coinciden', () => {
    const items = [
      { id: 'b', created_at: '2026-01-01' },
      { id: 'a', created_at: '2026-01-01' },
    ]
    const out = assignMonotonicFolios(items)
    expect(out.find((r) => r.id === 'a')._rowSeq).toBe(1)
    expect(out.find((r) => r.id === 'b')._rowSeq).toBe(2)
  })
})

describe('getNextMonotonicFolio / stampNewRecordWithFolio', () => {
  it('una nueva fila nunca nace como #1 si ya hay registros', () => {
    expect(getNextMonotonicFolio([])).toBe(1)
    expect(getNextMonotonicFolio([{ _rowSeq: 3 }, { _rowSeq: 7 }])).toBe(8)
    expect(getNextMonotonicFolio([{ folio: 4 }])).toBe(5)
  })

  it('sin folios numéricos usa la cantidad de items + 1', () => {
    expect(getNextMonotonicFolio([{ id: 'x' }, { id: 'y' }])).toBe(3)
  })

  it('stampNewRecordWithFolio inyecta el siguiente folio sin mutar el original', () => {
    const rec = { id: 'n' }
    const out = stampNewRecordWithFolio(rec, [{ _rowSeq: 10 }])
    expect(out._rowSeq).toBe(11)
    expect(rec._rowSeq).toBeUndefined()
  })
})
