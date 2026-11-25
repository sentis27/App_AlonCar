import { describe, it, expect } from 'vitest'
import {
  evaluateFormulaInput,
  describeFormula,
  buildCellFormulasPatch,
  getStoredCellFormula,
  getEditableCellInitialValue,
  looksLikeFormula
} from '../../src/lib/formulaEngine.js'
import { InventoryTransactionSchema } from '../../src/schemas/panol.schema.js'
import { ThirdPartyServiceSchema } from '../../src/schemas/thirdParty.schema.js'
import { PurchaseOrderSchema } from '../../src/schemas/purchases.schema.js'
import { LaborLogSchema } from '../../src/schemas/laborLogs.schema.js'
import { buildPlateCutsReportRows } from '../../src/lib/plateCutsExport.js'
import { buildMaterialsHoverSummary } from '../../src/lib/resumenCostHoverHelpers.js'
import { computeEntryDateOrAmountChange } from '../../src/lib/tercerosConstants.js'

describe('formulaEngine — motor estilo Excel/Sheets (= y +)', () => {
  it('evalúa sumas con prefijo = y + de forma equivalente', () => {
    const a = evaluateFormulaInput('=42+45')
    const b = evaluateFormulaInput('+42+45')
    const c = evaluateFormulaInput('42+45')
    expect(a).toEqual({ ok: true, value: 87, isFormula: true, formula: '=42+45', error: null })
    expect(b).toEqual(a)
    expect(c).toEqual(a)
  })

  it('evalúa sumas acumulativas de 3+ partes para Terceros', () => {
    const res = evaluateFormulaInput('=42+45+30')
    expect(res.ok).toBe(true)
    expect(res.value).toBe(117)
    expect(res.formula).toBe('=42+45+30')
    const meta = describeFormula(res.formula)
    expect(meta.kind).toBe('SUM_PARTS')
    expect(meta.partsCount).toBe(3)
    expect(meta.tooltipText).toContain('3 partes')
  })

  it('evalúa multiplicaciones de área con punto, coma y signo x/×', () => {
    const r1 = evaluateFormulaInput('=1*0.5')
    const r2 = evaluateFormulaInput('+1*0,5')
    const r3 = evaluateFormulaInput('=1x0,5')
    const r4 = evaluateFormulaInput('1 × 0.5')
    expect(r1).toEqual({ ok: true, value: 0.5, isFormula: true, formula: '=1*0.5', error: null })
    expect(r2).toEqual(r1)
    expect(r3).toEqual(r1)
    expect(r4).toEqual(r1)

    const meta = describeFormula(r1.formula)
    expect(meta.kind).toBe('AREA_PRODUCT')
    expect(meta.dimensionsLabel).toBe('1 × 0,5')
  })

  it('evalúa múltiples cortes sumados con precisión decimal limpia', () => {
    const res = evaluateFormulaInput('=1.2*0.5+0.8*0.4')
    expect(res.ok).toBe(true)
    expect(res.value).toBe(0.92)
    const meta = describeFormula(res.formula)
    expect(meta.kind).toBe('AREA_SUM')
    expect(meta.partsCount).toBe(2)
  })

  it('limpia cell_formulas cuando se guarda un número simple sin operación', () => {
    expect(evaluateFormulaInput('500')).toEqual({ ok: true, value: 500, isFormula: false, formula: null, error: null })
    expect(evaluateFormulaInput('+500')).toEqual({ ok: true, value: 500, isFormula: false, formula: null, error: null })
    expect(evaluateFormulaInput('=500')).toEqual({ ok: true, value: 500, isFormula: false, formula: null, error: null })
    const patched = buildCellFormulasPatch({ amount_ars: '=42+45', other: '=1*2' }, 'amount_ars', null)
    expect(patched).toEqual({ other: '=1*2' })
  })

  it('rechaza expresiones inválidas, división por cero y negativos por defecto', () => {
    expect(evaluateFormulaInput('=42+').ok).toBe(false)
    expect(evaluateFormulaInput('=10/0').ok).toBe(false)
    expect(evaluateFormulaInput('=abc').ok).toBe(false)
    expect(evaluateFormulaInput('=10-50').ok).toBe(false)
    expect(evaluateFormulaInput('=10-50', { allowNegative: true }).value).toBe(-40)
  })

  it('restaura fórmula guardada al abrir edición con doble clic', () => {
    const row = { amount_ars: 117, cell_formulas: { amount_ars: '=42+45+30' } }
    expect(getStoredCellFormula(row, 'amount_ars')).toBe('=42+45+30')
    expect(getEditableCellInitialValue(row, 'amount_ars', 117)).toBe('=42+45+30')
    expect(getEditableCellInitialValue({ amount_ars: 117 }, 'amount_ars', 117)).toBe('117')
    expect(looksLikeFormula('+42+45')).toBe(true)
    expect(looksLikeFormula('42')).toBe(false)
  })

  it('valida cell_formulas en los 4 contratos Zod actualizados', () => {
    expect(InventoryTransactionSchema.safeParse({ quantity_withdrawn: 0.5, cell_formulas: { quantity_withdrawn: '=1*0.5' } }).success).toBe(true)
    expect(ThirdPartyServiceSchema.safeParse({ contractor_name: 'TALLER X', amount_ars: 87, cell_formulas: { amount_ars: '=42+45' } }).success).toBe(true)
    expect(PurchaseOrderSchema.safeParse({ quantity: 5, cell_formulas: { quantity: '=2+3' } }).success).toBe(true)
    expect(LaborLogSchema.safeParse({ worker_name: 'JUAN', hours_worked: 8.5, date_logged: '2026-11-20', cell_formulas: { hours_worked: '=4+4.5' } }).success).toBe(true)
  })

  it('construye reporte trazado de parches de chapa y resumen hover con cortes', () => {
    const reportRows = buildPlateCutsReportRows([
      {
        shipName: 'NONO PASCUAL',
        otLabel: 'OT-2 · Casco',
        date: '2026-11-18',
        createdAt: '2026-11-20',
        materialName: 'CHAPA NAVAL 1/4"',
        qty: 0.5,
        qtyFormula: '=1*0.5',
        cutDimensionsLabel: '1 × 0,5',
        unitMeasure: 'm²',
        weightKg: 25,
        notes: 'Parche para sala de máquinas',
        workerName: 'JUAN'
      }
    ])
    expect(reportRows).toHaveLength(2)
    expect(reportRows[0].medidas_corte).toBe('1 × 0,5')
    expect(reportRows[0].fecha_reporte).toBe('18/11/2026')
    expect(reportRows[0].fecha_carga).toBe('20/11/2026')
    expect(reportRows[0].ubicacion_observaciones).toBe('Parche para sala de máquinas')
    expect(reportRows[1].nro).toBe('TOTAL')
    expect(reportRows[1].area_cant).toBe(0.5)

    const hover = buildMaterialsHoverSummary([
      {
        materialName: 'CHAPA NAVAL 1/4"',
        rubro: 'CHAPAS',
        category: 'MATERIALES',
        unitMeasure: 'm²',
        qty: 0.5,
        shipDirectUsd: 120,
        weightKg: 25,
        qtyFormula: '=1*0.5',
        cutDimensionsLabel: '1 × 0,5',
        date: '2026-11-18',
        notes: 'Parche casco'
      }
    ])
    expect(hover.byRubro[0].rubro).toBe('CHAPAS')
    expect(hover.byRubro[0].items[0].cuts).toHaveLength(1)
    expect(hover.byRubro[0].items[0].cuts[0].dimensionsLabel).toBe('1 × 0,5')
  })

  it('calcula USD en vivo en Terceros desde fórmula AR$ (+100000+50000)', () => {
    const res = computeEntryDateOrAmountChange('2026-11-20', '+100000+50000', [{ year: 2026, month: 11, dollar_rate: 1500 }])
    expect(res.evaluated_ars).toBe(150000)
    expect(res.amount_usd).toBe(100)
  })
})
