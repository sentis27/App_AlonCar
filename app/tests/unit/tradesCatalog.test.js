import { describe, it, expect } from 'vitest'
import {
  normalizeText,
  canonicalizeRubroLabel,
  parseWorkerTrades,
  CANONICAL_BASE_TRADES,
} from '../../src/lib/tradesCatalog.js'

describe('normalizeText', () => {
  it('quita acentos, pasa a mayúsculas y recorta', () => {
    expect(normalizeText('  Calderería ')).toBe('CALDERERIA')
    expect(normalizeText(null)).toBe('')
  })
})

describe('canonicalizeRubroLabel', () => {
  it('mapea variantes informales del taller a la etiqueta oficial', () => {
    expect(canonicalizeRubroLabel('calderero')).toBe('Calderería')
    expect(canonicalizeRubroLabel('raschinaje')).toBe('Raschinear')
    expect(canonicalizeRubroLabel('pintor')).toBe('Pintura')
    expect(canonicalizeRubroLabel('Mecánico')).toBe('Mecánica')
    expect(canonicalizeRubroLabel('varada')).toBe('Maniobras y varada')
  })
  it('distingue grúa grande, chica y genérica', () => {
    expect(canonicalizeRubroLabel('grua 60')).toBe('Grúa Grande')
    expect(canonicalizeRubroLabel('grúa chica')).toBe('Grúa Chica')
    expect(canonicalizeRubroLabel('grua')).toBe('Maquinaria')
  })
  it('vacío devuelve General y desconocido se devuelve tal cual', () => {
    expect(canonicalizeRubroLabel('')).toBe('General')
    expect(canonicalizeRubroLabel('  Buzo ')).toBe('Buzo')
  })
})

describe('parseWorkerTrades', () => {
  it('soporta multi-rubro con distintos separadores y deduplica etiquetas', () => {
    const r = parseWorkerTrades('soldador, calderero / soldadura')
    expect(r.rawList).toEqual(['SOLDADOR', 'CALDERERO', 'SOLDADURA'])
    expect(r.labelList).toEqual(['Soldadura', 'Calderería'])
    expect(r.primaryLabel).toBe('Soldadura')
  })
  it('sin rubro devuelve GENERAL', () => {
    expect(parseWorkerTrades('').primaryRaw).toBe('GENERAL')
  })
})

describe('CANONICAL_BASE_TRADES', () => {
  it('no tiene códigos duplicados', () => {
    expect(new Set(CANONICAL_BASE_TRADES).size).toBe(CANONICAL_BASE_TRADES.length)
  })
})
