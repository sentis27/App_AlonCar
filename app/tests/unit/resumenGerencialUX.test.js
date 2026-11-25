import { describe, it, expect } from 'vitest'
import { matchesUniversalSearch, tokenizeUniversalSearchQuery } from '../../src/lib/searchEngine.js'
import {
  compareResumenRowsByWorkOrder,
  scopeResumenRows,
  matchesResumenRubroKpi,
  resolveHorasShortcutBadge,
  computeMaterialesKpis,
  computeHorasKpis,
  computeTercerosKpis,
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

describe('T9 — KPIs Zona Radar Resumen Gerencial (General y Por O.T.)', () => {
  it('Materiales: renombra Materiales de Obra y agrega Compras Directas para OC DIRECTA en GENERAL y OT', () => {
    const rows = [
      { id: 'm1', shipId: 's1', workOrderId: 'wo-1', otNumber: 'OT-1', sourceType: 'PANOL_TX', category: 'MATERIALES', shipDirectUsd: 500, weightKg: 10 },
      { id: 'm2', shipId: 's1', workOrderId: 'wo-1', otNumber: 'OT-1', sourceType: 'COMPRA_DIRECTA', category: 'MATERIALES', shipDirectUsd: 1000, weightKg: 20 },
      { id: 'm3', shipId: 's1', workOrderId: 'wo-2', otNumber: 'OT-2', sourceType: 'COMPRA_DIRECTA', category: 'CONSUMIBLES', shipDirectUsd: 500, weightKg: 0 },
      { id: 'm4', shipId: 's2', workOrderId: 'wo-9', otNumber: 'OT-9', sourceType: 'COMPRA_DIRECTA', category: 'MATERIALES', shipDirectUsd: 9999, weightKg: 0 }
    ]

    const generalRows = scopeResumenRows(rows, { shipId: 's1', costScope: 'GENERAL' })
    const kpisGeneral = computeMaterialesKpis(generalRows)
    expect(kpisGeneral.find((k) => k.id === 'MATERIALES')).toMatchObject({ label: 'Materiales de Obra', count: 'US$ 1.500' })
    expect(kpisGeneral.find((k) => k.id === 'COMPRA_DIRECTA')).toMatchObject({ label: 'Compras Directas', count: 'US$ 1.500', subtext: '2 OC directas' })
    expect(filterResumenMaterialRows(generalRows, { kpiFilter: 'COMPRA_DIRECTA' }).map((r) => r.id)).toEqual(['m2', 'm3'])

    const otRows = scopeResumenRows(rows, { shipId: 's1', costScope: 'OT', activeOtId: 'wo-1' })
    const kpisOt = computeMaterialesKpis(otRows)
    expect(kpisOt.find((k) => k.id === 'COMPRA_DIRECTA')).toMatchObject({ count: 'US$ 1.000', subtext: '1 OC directas' })
    expect(filterResumenMaterialRows(otRows, { kpiFilter: 'COMPRA_DIRECTA' }).map((r) => r.id)).toEqual(['m2'])
  })

  it('Horas: elimina APPROVED/CORRECTED_RR, agrega Calderería/Raschinaje/Mecánica (HH + costo) en GENERAL y OT y mantiene atajo APPROVED', () => {
    const rows = [
      { id: 'h1', shipId: 's1', workOrderId: 'wo-1', otNumber: 'OT-1', rubro: 'Calderería', workType: 'HORA', hoursPhysical: 8, costUsd: 120, approvedUsd: 120, isPendingR: false, isPresupuesto: false },
      { id: 'h2', shipId: 's1', workOrderId: 'wo-2', otNumber: 'OT-2', rubro: 'CALDERERIA', workType: 'HORA', hoursPhysical: 4, costUsd: 80, approvedUsd: 0, pendingRUsd: 80, isPendingR: true, isPresupuesto: false },
      { id: 'h3', shipId: 's1', workOrderId: 'wo-1', otNumber: 'OT-1', rubro: 'Raschinear', workType: 'HORA', hoursPhysical: 6, costUsd: 60, approvedUsd: 60, isPendingR: false, isPresupuesto: false },
      { id: 'h4', shipId: 's1', workOrderId: 'wo-2', otNumber: 'OT-2', rubro: 'RASCHINAJE', workType: 'HORA', hoursPhysical: 3, costUsd: 30, approvedUsd: 30, isPendingR: false, isPresupuesto: false },
      { id: 'h5', shipId: 's1', workOrderId: 'wo-1', otNumber: 'OT-1', rubro: 'Mecánica', workType: 'HORA', hoursPhysical: 5, costUsd: 100, approvedUsd: 100, isPendingR: false, isPresupuesto: false },
      { id: 'h6', shipId: 's1', workOrderId: 'wo-2', otNumber: 'OT-2', rubro: 'MECANICA', workType: 'HORA', hoursPhysical: 2.5, costUsd: 50, approvedUsd: 50, isPendingR: false, isPresupuesto: false },
      { id: 'h7', shipId: 's1', workOrderId: 'wo-1', otNumber: 'OT-1', rubro: 'CALDERERIA', workType: 'CONTROL', isControl: true, hoursPhysical: 9, costUsd: 999 },
      { id: 'h8', shipId: 's1', workOrderId: null, otNumber: 'Sin OT', rubro: 'CARPINTERIA', workType: 'PRESUPUESTO', hoursPhysical: 4, costUsd: 0, isPresupuesto: true, hasMissingOt: true }
    ]

    const generalRows = scopeResumenRows(rows, { shipId: 's1', costScope: 'GENERAL' })
    const kpisGeneral = computeHorasKpis(generalRows)
    expect(kpisGeneral.map((k) => k.id)).toEqual(['RUBRO_CALDERERIA', 'RUBRO_RASCHINAJE', 'RUBRO_MECANICA', 'PENDING_R', 'SIN_OT', 'DEC_013'])
    expect(kpisGeneral.find((k) => k.id === 'RUBRO_CALDERERIA')).toMatchObject({ label: 'Calderería', count: '12.0 hs', subtext: 'US$ 200 · 2 partes' })
    expect(kpisGeneral.find((k) => k.id === 'RUBRO_RASCHINAJE')).toMatchObject({ label: 'Raschinaje', count: '9.0 hs', subtext: 'US$ 90 · 2 partes' })
    expect(kpisGeneral.find((k) => k.id === 'RUBRO_MECANICA')).toMatchObject({ label: 'Mecánica', count: '7.5 hs', subtext: 'US$ 150 · 2 partes' })
    expect(filterResumenLaborRows(generalRows, { kpiFilter: 'RUBRO_RASCHINAJE' }).map((r) => r.id)).toEqual(['h3', 'h4'])
    expect(filterResumenLaborRows(generalRows, { kpiFilter: 'APPROVED' }).map((r) => r.id)).toEqual(['h1', 'h3', 'h5', 'h4', 'h6'])
    expect(resolveHorasShortcutBadge('APPROVED')).toMatchObject({ label: 'Estado: Horas Aprobadas', tone: 'emerald' })
    expect(resolveHorasShortcutBadge('GRUA_GRANDE')).toMatchObject({ label: 'Maquinaria: Grúa Grande', tone: 'amber' })

    const otRows = scopeResumenRows(rows, { shipId: 's1', costScope: 'OT', activeOtId: 'wo-1' })
    const kpisOt = computeHorasKpis(otRows)
    expect(kpisOt.find((k) => k.id === 'RUBRO_CALDERERIA')).toMatchObject({ count: '8.0 hs', subtext: 'US$ 120 · 1 partes' })
    expect(filterResumenLaborRows(otRows, { kpiFilter: 'RUBRO_MECANICA' }).map((r) => r.id)).toEqual(['h5'])
  })

  it('Terceros: deja solo Falta Cargar OT y Sin Costo + Tornería/Pintura/Electricidad (excluyendo ELECTRONICA) en GENERAL y OT', () => {
    const rows = [
      { id: 't1', shipId: 's1', workOrderId: 'wo-1', otNumber: 'OT-1', rubro: 'TORNERIA', amountUsd: 400, voucherType: 'FCR' },
      { id: 't2', shipId: 's1', workOrderId: 'wo-2', otNumber: 'OT-2', rubro: 'Pintura', amountUsd: 350, voucherType: 'PRC' },
      { id: 't3', shipId: 's1', workOrderId: 'wo-1', otNumber: 'OT-1', rubro: 'ELECTRICIDAD', amountUsd: 250, voucherType: 'RPF' },
      { id: 't4', shipId: 's1', workOrderId: 'wo-2', otNumber: 'OT-2', rubro: 'ENSAYOS ELECTRICOS', amountUsd: 100, voucherType: 'FCR' },
      { id: 't5', shipId: 's1', workOrderId: 'wo-1', otNumber: 'OT-1', rubro: 'ELECTRONICA', amountUsd: 900, voucherType: 'FCR' },
      { id: 't6', shipId: 's1', workOrderId: 'wo-1', otNumber: 'OT-1', rubro: 'ELECTROEROSION', amountUsd: 700, voucherType: 'FCR' },
      { id: 't7', shipId: 's1', workOrderId: null, otNumber: 'Sin OT', rubro: 'CALDERERIA', amountUsd: 0, voucherType: 'PRC', hasMissingOt: true, hasZeroCost: true }
    ]

    expect(matchesResumenRubroKpi('ELECTRONICA', 'RUBRO_ELECTRICIDAD')).toBe(false)
    expect(matchesResumenRubroKpi('ELECTROEROSION', 'RUBRO_ELECTRICIDAD')).toBe(false)
    expect(matchesResumenRubroKpi('ENSAYOS ELECTRICOS', 'RUBRO_ELECTRICIDAD')).toBe(true)

    const generalRows = scopeResumenRows(rows, { shipId: 's1', costScope: 'GENERAL' })
    const kpisGeneral = computeTercerosKpis(generalRows)
    expect(kpisGeneral.map((k) => k.id)).toEqual(['RUBRO_TORNERIA', 'RUBRO_PINTURA', 'RUBRO_ELECTRICIDAD', 'SIN_OT', 'SIN_COSTO'])
    expect(kpisGeneral.find((k) => k.id === 'RUBRO_TORNERIA')).toMatchObject({ label: 'Tornería', count: 'US$ 400', subtext: '1 comprobantes' })
    expect(kpisGeneral.find((k) => k.id === 'RUBRO_PINTURA')).toMatchObject({ label: 'Pintura', count: 'US$ 350', subtext: '1 comprobantes' })
    expect(kpisGeneral.find((k) => k.id === 'RUBRO_ELECTRICIDAD')).toMatchObject({ label: 'Electricidad', count: 'US$ 350', subtext: '2 comprobantes' })
    expect(filterResumenThirdPartyRows(generalRows, { kpiFilter: 'RUBRO_ELECTRICIDAD' }).map((r) => r.id)).toEqual(['t3', 't4'])

    const otRows = scopeResumenRows(rows, { shipId: 's1', costScope: 'OT', activeOtId: 'wo-1' })
    const kpisOt = computeTercerosKpis(otRows)
    expect(kpisOt.find((k) => k.id === 'RUBRO_ELECTRICIDAD')).toMatchObject({ count: 'US$ 250', subtext: '1 comprobantes' })
    expect(filterResumenThirdPartyRows(otRows, { kpiFilter: 'RUBRO_TORNERIA' }).map((r) => r.id)).toEqual(['t1'])
  })
})
