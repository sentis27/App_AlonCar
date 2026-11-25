import { describe, it, expect } from 'vitest'
import { matchesUniversalSearch, tokenizeUniversalSearchQuery } from '../../src/lib/searchEngine.js'
import {
  compareResumenRowsByWorkOrder,
  filterResumenMaterialRows,
  filterResumenLaborRows,
  filterResumenThirdPartyRows,
  buildCleanSheetShortcutFilters
} from '../../src/lib/resumenHojaFilters.js'
import { computeReadOnlySelectionStats } from '../../src/hooks/grid/useReadOnlySheetSelection.js'
import { filterEligiblePersonnel } from '../../src/lib/allocationEngine.js'

describe('T1 — Buscador Crawler con combinador +', () => {
  const sampleRow = {
    shipName: 'NONO PASCUAL',
    otNumber: 'OT-3',
    otTitle: 'CAMBIO CHAPA',
    workerName: 'TANO',
    contractorLabel: 'TANO',
    materialName: 'CHAPA NAVAL 1/4"',
    cutDimensionsLabel: '2×25 + 3×1,5',
    sourceLabel: 'PAÑOL',
    notes: 'Bodega proa'
  }

  it('ignora + suelto o al final mientras se escribe (Tano + no borra resultados)', () => {
    expect(tokenizeUniversalSearchQuery('Tano +')).toEqual(['tano'])
    expect(tokenizeUniversalSearchQuery('Tano + ')).toEqual(['tano'])
    expect(tokenizeUniversalSearchQuery('+')).toEqual([])
    expect(matchesUniversalSearch(sampleRow, 'Tano +')).toBe(true)
    expect(matchesUniversalSearch(sampleRow, '+')).toBe(true)
  })

  it('combina términos con + o sin espacios como AND (Tano + chapa, Tano+OT-3)', () => {
    expect(tokenizeUniversalSearchQuery('Tano + chapa')).toEqual(['tano', 'chapa'])
    expect(tokenizeUniversalSearchQuery('Tano+OT-3')).toEqual(['tano', 'ot-3'])
    expect(matchesUniversalSearch(sampleRow, 'Tano + chapa')).toBe(true)
    expect(matchesUniversalSearch(sampleRow, 'Tano+chapa')).toBe(true)
    expect(matchesUniversalSearch(sampleRow, 'Tano + OT-3 + proa')).toBe(true)
    expect(matchesUniversalSearch(sampleRow, 'Tano + bronce')).toBe(false)
  })

  it('soporta variantes x/× y coma/punto en dimensiones de corte', () => {
    expect(matchesUniversalSearch(sampleRow, '2x25 + 3x1.5')).toBe(true)
  })
})

describe('T2 — Lanzamiento limpio desde botones-atajo del Resumen', () => {
  it('construye filtros limpios para Materiales, Horas y Terceros respetando el KPI pedido', () => {
    const matZero = buildCleanSheetShortcutFilters('resumen_materiales', 'PRECIO_0')
    expect(matZero).toEqual({
      searchQuery: '',
      kpiFilter: 'PRECIO_0',
      otFilter: 'ALL',
      contractorFilter: 'ALL',
      showMateriales: true,
      showConsumibles: true,
      materialQuick: '',
      onlyKgPositive: false
    })

    const tercAll = buildCleanSheetShortcutFilters('resumen_terceros', 'ALL')
    expect(tercAll.kpiFilter).toBe('ALL')
    expect(tercAll.searchQuery).toBe('')
    expect(tercAll.otFilter).toBe('ALL')

    const crane = buildCleanSheetShortcutFilters('resumen_horas', 'GRUA_GRANDE')
    expect(crane.kpiFilter).toBe('GRUA_GRANDE')
    expect(crane.workerFilter).toBe('ALL')
  })
})

describe('T3 — Ordenamiento natural por Orden de Trabajo en Zona 5', () => {
  it('ordena OT-1, OT-2, OT-3, OT-10 en orden natural y deja Sin OT al final', () => {
    const rows = [
      { id: 'r1', workOrderId: null, otNumber: 'Sin OT', otTitle: '', date: '2026-11-24', category: 'MATERIALES' },
      { id: 'r2', workOrderId: 'w10', otNumber: 'OT-10', otTitle: 'PINTURA', date: '2026-11-20', category: 'MATERIALES' },
      { id: 'r3', workOrderId: 'w2', otNumber: 'OT-2', otTitle: 'VALVULAS', date: '2026-11-18', category: 'MATERIALES' },
      { id: 'r4', workOrderId: 'w2', otNumber: 'OT-2', otTitle: 'VALVULAS', date: '2026-11-22', category: 'MATERIALES' },
      { id: 'r5', workOrderId: 'w1', otNumber: 'OT-1', otTitle: 'POCETES', date: '2026-11-10', category: 'MATERIALES' }
    ]

    const sortedMats = filterResumenMaterialRows(rows)
    expect(sortedMats.map((r) => r.id)).toEqual(['r5', 'r4', 'r3', 'r2', 'r1'])

    const sortedLabor = filterResumenLaborRows(rows.map((r) => ({ ...r, workType: 'HORA', isControl: false })))
    expect(sortedLabor.map((r) => r.id)).toEqual(['r5', 'r4', 'r3', 'r2', 'r1'])

    const sortedTerceros = filterResumenThirdPartyRows(rows.map((r) => ({ ...r, voucherType: 'PRC' })))
    expect(sortedTerceros.map((r) => r.id)).toEqual(['r5', 'r4', 'r3', 'r2', 'r1'])
    expect(compareResumenRowsByWorkOrder(rows[0], rows[4])).toBeGreaterThan(0)
  })
})

describe('T4 — Motor de selección de celdas tipo Excel/Sheets (Zona 5)', () => {
  const columns = [
    { key: 'otLabel', label: 'O.T', isNumeric: false, getValue: (r) => r.otLabel },
    { key: 'date', label: 'Fecha', isNumeric: false, getValue: (r) => r.date },
    { key: 'qty', label: 'Cant.', isNumeric: true, formatType: 'number', getValue: (r) => r.qty },
    { key: 'weightKg', label: 'KG', isNumeric: true, formatType: 'kg', getValue: (r) => (r.weightKg > 0 ? r.weightKg : null) },
    { key: 'shipDirectUsd', label: 'Total Obra US$', isNumeric: true, formatType: 'usd', getValue: (r) => r.shipDirectUsd },
    { key: 'notes', label: 'Notas', isNumeric: false, getValue: (r) => r.notes }
  ]
  const rows = [
    { id: '1', otLabel: 'OT-2 · VALVULAS', date: '24/11/2026', qty: 2, weightKg: 100.5, shipDirectUsd: 250, notes: 'Proa' },
    { id: '2', otLabel: 'OT-3 · CHAPA 1/4"', date: '23/11/2026', qty: 54.5, weightKg: 0, shipDirectUsd: 1500, notes: '' },
    { id: '3', otLabel: 'OT-3 · CHAPA 1/4"', date: '22/11/2026', qty: 3.5, weightKg: 49.5, shipDirectUsd: 0, notes: 'Popa' }
  ]

  it('suma columnas numéricas con su unidad exacta e ignora celdas vacías/guion en KG', () => {
    const qtyStats = computeReadOnlySelectionStats({ startRow: 0, endRow: 2, startCol: 2, endCol: 2 }, rows, columns)
    expect(qtyStats.sum).toBe(60)
    expect(qtyStats.count).toBe(3)
    expect(qtyStats.formatType).toBe('number')

    const kgStats = computeReadOnlySelectionStats({ startRow: 0, endRow: 2, startCol: 3, endCol: 3 }, rows, columns)
    expect(kgStats.sum).toBe(150)
    expect(kgStats.numericCount).toBe(2)
    expect(kgStats.count).toBe(2)
    expect(kgStats.formatType).toBe('kg')

    const usdStats = computeReadOnlySelectionStats({ startRow: 0, endRow: 2, startCol: 4, endCol: 4 }, rows, columns)
    expect(usdStats.sum).toBe(1750)
    expect(usdStats.numericCount).toBe(3)
    expect(usdStats.formatType).toBe('usd')
  })

  it('nunca suma columnas de texto con números (OT-3, fechas DD/MM/AAAA) y devuelve RECUENTO real', () => {
    const otStats = computeReadOnlySelectionStats({ startRow: 0, endRow: 2, startCol: 0, endCol: 0 }, rows, columns)
    expect(otStats.numericCount).toBe(0)
    expect(otStats.sum).toBeNull()
    expect(otStats.count).toBe(3)
    expect(otStats.formatType).toBe('text')

    const dateStats = computeReadOnlySelectionStats({ startRow: 0, endRow: 2, startCol: 1, endCol: 1 }, rows, columns)
    expect(dateStats.numericCount).toBe(0)
    expect(dateStats.count).toBe(3)

    const notesStats = computeReadOnlySelectionStats({ startRow: 0, endRow: 2, startCol: 5, endCol: 5 }, rows, columns)
    expect(notesStats.numericCount).toBe(0)
    expect(notesStats.totalCells).toBe(3)
    expect(notesStats.count).toBe(2)
  })
})

describe('T8 — Deduplicación de allEligibleNames en allocationEngine', () => {
  it('no devuelve nombres duplicados (evita warning de clave repetida en Pañol)', () => {
    const res = filterEligiblePersonnel([
      { id: '1', name: 'Alanis, Carlos', admin_center: 'ASTILLERO', status: 'ACTIVO', can_withdraw_materials: true },
      { id: '2', name: 'Alanis, Carlos', admin_center: 'ASTILLERO', status: 'ACTIVO', can_withdraw_materials: true },
      { id: '3', name: 'TANO', work_group: 'TANO', admin_center: 'CONTRATISTA', status: 'ACTIVO', can_withdraw_materials: true }
    ])
    expect(res.allEligibleNames.filter((n) => n === 'Alanis, Carlos')).toHaveLength(1)
  })
})
