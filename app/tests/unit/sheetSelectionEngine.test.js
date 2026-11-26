import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import {
  parseSheetNumber,
  buildColumnRange,
  computeSheetStats,
  buildSelectionTsv,
  sortRowsByColumn,
  formatSheetMetric,
} from '../../src/lib/sheetSelectionEngine.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.resolve(__dirname, '../..')

describe('Motor General Excel/Sheets (sheetSelectionEngine · FL-027)', () => {
  it('parsea decimales y monedas argentinas sin tocar fechas ni códigos de texto', () => {
    expect(parseSheetNumber('1.250,50')).toBe(1250.5)
    expect(parseSheetNumber('917,575')).toBe(917.575)
    expect(parseSheetNumber('US$ 1.146,97')).toBe(1146.97)
    expect(parseSheetNumber('-US$ 101.531,77')).toBe(-101531.77)
    expect(parseSheetNumber('1.500')).toBe(1500)
    expect(parseSheetNumber('12,5 kg')).toBe(12.5)
    expect(parseSheetNumber('(250,25)')).toBe(-250.25)

    expect(parseSheetNumber('15/01/2025')).toBeNull()
    expect(parseSheetNumber('2025-01-15')).toBeNull()
    expect(parseSheetNumber('OT-105')).toBeNull()
    expect(parseSheetNumber('Remito 2251')).toBeNull()
    expect(parseSheetNumber('—')).toBeNull()
  })

  const columns = [
    { key: 'fecha', label: 'Fecha', type: 'date' },
    { key: 'remito', label: 'Remito', isNumeric: false },
    { key: 'kilos', label: 'Kilos', isNumeric: true, formatType: 'kg' },
    { key: 'monto', label: 'Monto US$', isNumeric: true, formatType: 'usd' },
    { key: 'horas', label: 'Horas', isNumeric: true, formatType: 'hours' },
    { key: 'ars', label: 'Importe AR$', isNumeric: true, formatType: 'ars' },
    { key: 'pct', label: 'Seg %', isNumeric: true, formatType: 'pct' },
  ]
  const rows = [
    { id: 'r1', fecha: '15/01/2025', remito: '2251', kilos: '917,575', monto: 'US$ 1.146,97', horas: 8, ars: 150000, pct: 6 },
    { id: 'r2', fecha: '02/05/2025', remito: '2252', kilos: '72,425', monto: 'US$ 90,03', horas: 4.5, ars: 75000, pct: 6 },
    { id: 'r3', fecha: '20/12/2024', remito: '2251', kilos: null, monto: 'US$ 100,00', horas: 7.5, ars: 120000, pct: 12 },
  ]

  it('calcula las 7 métricas en rango normal, rango salteado Ctrl+Clic y columna completa (incluso 1 fila)', () => {
    const singleRange = computeSheetStats({ startRow: 0, endRow: 2, startCol: 3, endCol: 3 }, rows, columns)
    expect(singleRange).toMatchObject({
      sum: 1337,
      avg: 445.6667,
      min: 90.03,
      max: 1146.97,
      count: 3,
      numericCount: 3,
      unique: 3,
      formatType: 'usd',
      scope: 'column',
    })

    // Ctrl+Clic: r0 col3 (1146.97) + r2 col3 (100.00)
    const multi = computeSheetStats([
      { startRow: 0, endRow: 0, startCol: 3, endCol: 3 },
      { startRow: 2, endRow: 2, startCol: 3, endCol: 3 },
    ], rows, columns)
    expect(multi).toMatchObject({
      sum: 1246.97,
      avg: 623.485,
      min: 100,
      max: 1146.97,
      count: 2,
      numericCount: 2,
      scope: 'multi',
      formatType: 'usd',
    })

    // Columna kilos (ignora null y mide kg + únicos)
    const kgCol = computeSheetStats(buildColumnRange(2, rows.length), rows, columns)
    expect(kgCol).toMatchObject({ sum: 990, avg: 495, count: 2, numericCount: 2, formatType: 'kg', columnLabel: 'Kilos' })

    // Columna mixta USD + AR$ -> mixed
    const mixed = computeSheetStats({ startRow: 0, endRow: 1, startCol: 3, endCol: 5 }, rows, columns)
    expect(mixed.formatType).toBe('mixed')

    // Columna de texto con duplicado ("2251" x2, "2252" x1) -> únicos = 2
    const txtCol = computeSheetStats(buildColumnRange(1, rows.length), rows, columns)
    expect(txtCol).toMatchObject({ numericCount: 0, count: 3, unique: 2, formatType: 'text', sum: null })

    // Tabla de 1 sola fila al hacer clic en encabezado muestra suma igual, pero 1 celda suelta devuelve null
    expect(computeSheetStats({ startRow: 0, endRow: 0, startCol: 3, endCol: 3 }, [rows[0]], columns)).toBeNull()
    expect(computeSheetStats(buildColumnRange(3, 1), [rows[0]], columns)).toMatchObject({
      scope: 'column',
      sum: 1146.97,
      count: 1,
    })
  })

  it('exporta bloque 2D y selección salteada en TSV con decimales argentinos para Excel/Sheets', () => {
    const tsv = buildSelectionTsv([
      { startRow: 0, endRow: 1, startCol: 1, endCol: 2 },
    ], rows, columns)
    expect(tsv).toBe('2251\t917,575\n2252\t72,425')
  })

  it('ordena fechas DD/MM/YYYY y YYYY-MM-DD cronológicamente, números y textos sin mutar', () => {
    const byDateAsc = sortRowsByColumn(rows, columns[0], 'asc')
    expect(byDateAsc.map((r) => r.id)).toEqual(['r3', 'r1', 'r2'])

    const isoRows = [
      { id: 'a', fecha: '2025-05-02' },
      { id: 'b', fecha: '2024-12-20' },
      { id: 'c', fecha: '2025-01-15' },
    ]
    expect(sortRowsByColumn(isoRows, columns[0], 'desc').map((r) => r.id)).toEqual(['a', 'c', 'b'])
    expect(sortRowsByColumn(rows, columns[3], 'desc').map((r) => r.id)).toEqual(['r1', 'r3', 'r2'])
  })

  it('formatea métricas por unidad exacta (usd, ars, kg, hours, pct, number)', () => {
    expect(formatSheetMetric(1250.5, 'usd')).toMatch(/^US\$ 1\.250,50$/)
    expect(formatSheetMetric(1500, 'ars')).toMatch(/^AR\$ 1\.500,00$/)
    expect(formatSheetMetric(990.5, 'kg')).toBe('990,5 kg')
    expect(formatSheetMetric(12.5, 'hours')).toBe('12,5 hs')
    expect(formatSheetMetric(6, 'pct')).toBe('6 %')
    expect(formatSheetMetric(1234.567, 'number')).toBe('1.234,567')
  })

  it('blinda FormulaNumericInput contra pérdida de foco al hacer clic dentro de la fórmula', () => {
    const src = fs.readFileSync(path.join(APP_DIR, 'src/components/canonical/FormulaNumericInput.jsx'), 'utf8')
    expect(src).toContain('onMouseDown={(e) => e.stopPropagation()}')
    expect(src).toContain('onDoubleClick={(e) => e.stopPropagation()}')
  })
})
