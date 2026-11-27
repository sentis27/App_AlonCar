import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { NOMINA_COLUMNS } from '../../src/lib/personalNominaHelpers.js'
import {
  parseConsumablesDiscountInput,
  buildConsumablesFields,
  buildWorkerFormFromRecord,
  buildWorkerSavePayload,
  buildWorkerPatchFromCell
} from '../../src/lib/personalNominaFormHelpers.js'
import { resolveConsumablesDiscountPct } from '../../src/lib/workCostRules.js'
import { PERSONAL_WORKER_STEP_HELP } from '../../src/lib/help/personalShipsHelp.js'
import { WorkerSchema } from '../../src/schemas/workers.schema.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '../../..')
const readRepoFile = (rel) => fs.readFileSync(path.join(REPO_ROOT, rel), 'utf8')

describe('Personal Nómina — Consumibles (%) en Modal y Planilla Inline', () => {
  it('parseConsumablesDiscountInput interpreta números, decimales y etiquetas conocidas', () => {
    expect(parseConsumablesDiscountInput(60)).toBe(60)
    expect(parseConsumablesDiscountInput('50%')).toBe(50)
    expect(parseConsumablesDiscountInput('60% C / 40% O')).toBe(60)
    expect(parseConsumablesDiscountInput('37,6')).toBe(38)
    expect(parseConsumablesDiscountInput(140)).toBe(100)
    expect(parseConsumablesDiscountInput(-10)).toBe(0)
    expect(parseConsumablesDiscountInput('100% OBRA')).toBe(0)
    expect(parseConsumablesDiscountInput('CLIENTE')).toBe(0)
    expect(parseConsumablesDiscountInput('CONTRATISTA')).toBe(100)
    expect(parseConsumablesDiscountInput('100% CONT.')).toBe(100)
    expect(parseConsumablesDiscountInput('')).toBe(null)
    expect(parseConsumablesDiscountInput(null)).toBe(null)
    expect(parseConsumablesDiscountInput('abc')).toBe(null)
  })

  it('buildConsumablesFields fija ASTILLERO en 100% Obra y sincroniza CONTRATISTA/TALLER', () => {
    expect(buildConsumablesFields(100, 'ASTILLERO')).toEqual({
      consumables_discount_pct: 0,
      consumables: 'CLIENTE'
    })
    expect(buildConsumablesFields(0, 'CONTRATISTA')).toEqual({
      consumables_discount_pct: 0,
      consumables: 'CLIENTE'
    })
    expect(buildConsumablesFields(60, 'CONTRATISTA')).toEqual({
      consumables_discount_pct: 60,
      consumables: 'DESC. 60%'
    })
    expect(buildConsumablesFields(100, 'TALLER')).toEqual({
      consumables_discount_pct: 100,
      consumables: 'CONTRATISTA'
    })
    expect(buildConsumablesFields('invalido', 'CONTRATISTA')).toBe(null)
  })

  it('buildWorkerFormFromRecord resuelve casos legacy (CLIENTE | 100) igual que workCostRules', () => {
    const legacyWorker = {
      id: 'w-legacy',
      name: 'CONTRATISTA LEGACY',
      admin_center: 'CONTRATISTA',
      work_group: 'AVALOS',
      trade: 'SOLDADURA',
      consumables: 'CLIENTE',
      consumables_discount_pct: 100
    }
    const mapped = buildWorkerFormFromRecord(legacyWorker)
    expect(mapped.formData.consumables_discount_pct).toBe(resolveConsumablesDiscountPct(legacyWorker))
    expect(mapped.formData.consumables_discount_pct).toBe(0)
  })

  it('buildWorkerSavePayload sincroniza ambos campos y pasa WorkerSchema para ASTILLERO y CONTRATISTA', () => {
    const astilleroRes = buildWorkerSavePayload({
      name: 'OPERARIO PROPIO',
      admin_center: 'ASTILLERO',
      trade: 'CALDERERIA',
      category: 'OFICIAL',
      status: 'ACTIVO',
      hourly_rate_ars: 16000,
      consumables_discount_pct: 100
    })
    expect(astilleroRes.payload.consumables_discount_pct).toBe(0)
    expect(astilleroRes.payload.consumables).toBe('CLIENTE')
    expect(WorkerSchema.safeParse(astilleroRes.payload).success).toBe(true)

    const contractorRes = buildWorkerSavePayload({
      name: 'CONTRATISTA MIXTO',
      admin_center: 'CONTRATISTA',
      work_group: 'AVALOS',
      trade: 'SOLDADURA',
      category: 'OFICIAL',
      status: 'ACTIVO',
      hourly_rate_ars: 17500,
      consumables_discount_pct: 60
    })
    expect(contractorRes.payload.consumables_discount_pct).toBe(60)
    expect(contractorRes.payload.consumables).toBe('DESC. 60%')
    expect(WorkerSchema.safeParse(contractorRes.payload).success).toBe(true)
  })

  it('buildWorkerPatchFromCell soporta edición inline, bloqueo ASTILLERO y cambio de centro', () => {
    const contractor = { id: 'w-1', admin_center: 'CONTRATISTA', safety_items: 'CONTRATISTA' }
    expect(buildWorkerPatchFromCell(contractor, 'consumables_discount_pct', 50)).toEqual({
      consumables_discount_pct: 50,
      consumables: 'DESC. 50%'
    })
    expect(buildWorkerPatchFromCell(contractor, 'consumables_discount_pct', 0)).toEqual({
      consumables_discount_pct: 0,
      consumables: 'CLIENTE'
    })
    expect(buildWorkerPatchFromCell(contractor, 'consumables_discount_pct', 'basura')).toBe(null)
    expect(buildWorkerPatchFromCell(contractor, 'admin_center', 'ASTILLERO')).toEqual({
      admin_center: 'ASTILLERO',
      safety_items: 'ASTILLERO',
      consumables_discount_pct: 0,
      consumables: 'CLIENTE'
    })

    const own = { id: 'w-2', admin_center: 'ASTILLERO', safety_items: 'ASTILLERO' }
    expect(buildWorkerPatchFromCell(own, 'consumables_discount_pct', 100)).toEqual({
      consumables_discount_pct: 0,
      consumables: 'CLIENTE'
    })
  })

  it('Contrato anti-regresión UI: modal, planilla, NOMINA_COLUMNS y ayuda incluyen el editor y eliminan "0% (OBRA)"', () => {
    const colKeys = NOMINA_COLUMNS.map((c) => c.key)
    expect(colKeys).toContain('consumables_discount_pct')
    expect(colKeys.indexOf('consumables_discount_pct')).toBe(6)
    expect(colKeys.indexOf('safety_items')).toBe(7)

    const modalSrc = readRepoFile('app/src/components/personal/PersonalWorkerFormModal.jsx')
    expect(modalSrc).toContain('PersonalWorkerConsumablesField')

    const fieldSrc = readRepoFile('app/src/components/personal/PersonalWorkerConsumablesField.jsx')
    expect(fieldSrc).toContain('100% OBRA')
    expect(fieldSrc).not.toContain('0% (OBRA)')

    const tableSrc = readRepoFile('app/src/components/personal/PersonalNominaTable.jsx')
    expect(tableSrc).toContain("getColumnHeaderProps('consumables_discount_pct'")
    expect(tableSrc).toContain('Consumibles ✎')

    const rowSrc = readRepoFile('app/src/components/personal/PersonalNominaRow.jsx')
    expect(rowSrc).toContain('PersonalNominaConsumablesCell')
    expect(rowSrc).toContain('colIndex={7}')
    expect(rowSrc).not.toContain('0% (OBRA)')

    const cellSrc = readRepoFile('app/src/components/personal/PersonalNominaConsumablesCell.jsx')
    expect(cellSrc).toContain('100% OBRA')
    expect(cellSrc).toContain('100% CONT.')
    expect(cellSrc).not.toContain('0% (OBRA)')

    expect(PERSONAL_WORKER_STEP_HELP[3].uiBullets.some((b) => b.label.includes('Consumibles'))).toBe(true)
  })
})
