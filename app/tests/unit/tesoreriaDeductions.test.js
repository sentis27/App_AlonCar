import { describe, it, expect } from 'vitest'
import {
  getCurrentQuincenaKey,
  getQuincenaDateRange,
  matchTransactionWorker,
  evaluateContractorDeductions
} from '../../src/lib/contractorDeductionsService.js'
import { resolvePanolTxCost } from '../../src/lib/panolCostHelpers.js'
import {
  shouldSyncWorkerGroupField,
  buildWorkerGroupSyncPatch
} from '../../src/lib/personalNominaFormHelpers.js'

describe('getCurrentQuincenaKey y getQuincenaDateRange (UTC-3 Argentina)', () => {
  it('mantiene día argentino después de las 21:00 ART (01:30Z del día siguiente)', () => {
    // 2026-11-16T01:30:00Z corresponde a 2026-11-15 22:30 ART -> 1Q
    expect(getCurrentQuincenaKey(new Date('2026-11-16T01:30:00.000Z'))).toBe('2026-11-1Q')
    // 2026-11-16T03:00:00Z corresponde a 2026-11-16 00:00 ART -> 2Q
    expect(getCurrentQuincenaKey(new Date('2026-11-16T03:00:00.000Z'))).toBe('2026-11-2Q')
  })

  it('calcula límites startIso/endIso en UTC-3 exacto para 2026-11-2Q', () => {
    const range = getQuincenaDateRange('2026-11-2Q')
    expect(range).toMatchObject({
      periodKey: '2026-11-2Q',
      startDate: '2026-11-16',
      endDate: '2026-11-30',
      startIso: '2026-11-16T03:00:00.000Z',
      endIso: '2026-12-01T02:59:59.999Z'
    })
  })
})

describe('matchTransactionWorker y evaluateContractorDeductions', () => {
  it('prioriza worker ACTIVO sobre INACTIVO al matchear por nombre/grupo', () => {
    const workers = [
      { id: 'w-old', name: 'TANO', work_group: 'TANO', status: 'INACTIVO', consumables_discount_pct: 0 },
      { id: 'w-act', name: 'TANO', work_group: 'TANO', status: 'ACTIVO', consumables_discount_pct: 100 }
    ]
    const found = matchTransactionWorker({ contractor_name: 'TANO' }, workers)
    expect(found?.id).toBe('w-act')
  })

  it('filtra cantidad <= 0 y bajas pendientes, alinea USD con Pañol y cuenta consumibles 0% de contratista', () => {
    const macroVariables = [{ year: 2026, month: 11, dollar_rate: 1500, dollar_rate_1q: 1500, dollar_rate_2q: 1500 }]
    const materials = [
      { id: 'm-elec', name: 'Electrodo 7018', category: 'CONSUMIBLES', unit_measure: 'kg', cost_ars: 45000, security_factor: 1.06 },
      { id: 'm-disco', name: 'Disco Tyrolit', category: 'CONSUMIBLES', unit_measure: 'un', cost_ars: 6500, security_factor: 1.06 }
    ]
    const workers = [
      { id: 'w-tano', name: 'TANO', work_group: 'TANO', admin_center: 'CONTRATISTA', consumables_discount_pct: 100, safety_items: 'CONTRATISTA', status: 'ACTIVO' },
      { id: 'w-cero', name: 'OTRO', work_group: 'OTRO', admin_center: 'CONTRATISTA', consumables: 'CLIENTE', consumables_discount_pct: 0, safety_items: 'CONTRATISTA', status: 'ACTIVO' }
    ]
    const transactions = [
      { id: 't1', material_id: 'm-elec', contractor_name: 'TANO', quantity_withdrawn: 1, transaction_date: '2026-11-20T15:00:00Z' },
      { id: 't2', material_id: 'm-disco', contractor_name: 'TANO', quantity_withdrawn: 2, transaction_date: '2026-11-20T15:00:00Z' },
      { id: 't3', material_id: 'm-elec', contractor_name: 'TANO', quantity_withdrawn: 0, transaction_date: '2026-11-20T15:00:00Z' },
      { id: 't4', material_id: 'm-elec', contractor_name: 'TANO', quantity_withdrawn: null, transaction_date: '2026-11-20T15:00:00Z' },
      { id: 't5', material_id: 'm-elec', contractor_name: 'TANO', quantity_withdrawn: 5, is_deletion_requested: true, transaction_date: '2026-11-20T15:00:00Z' },
      { id: 't6', material_id: 'm-disco', contractor_name: 'OTRO', quantity_withdrawn: 1, transaction_date: '2026-11-20T15:00:00Z' }
    ]

    const res = evaluateContractorDeductions({
      transactions,
      materials,
      workers,
      macroVariables,
      fortnightDollarRate: 1500
    })

    expect(res.deductibleRows).toHaveLength(2)
    expect(res.totals.nonDeductibleConsumablesCount).toBe(1)

    const expectedT1 = resolvePanolTxCost(transactions[0], materials[0], { macroVariables })
    const expectedT2 = resolvePanolTxCost(transactions[1], materials[1], { macroVariables })
    const expectedUsd = Number((expectedT1.totalUsd + expectedT2.totalUsd).toFixed(2))
    expect(res.totals.totalDeductUsd).toBe(expectedUsd)
    expect(res.totals.totalDeductUsd).toBe(40.98)
    expect(res.totals.totalDeductArs).toBe(Number((expectedUsd * 1500).toFixed(2)))
  })
})

describe('Personal group sync helpers', () => {
  it('propaga reglas solo a grupos externos (nunca a ASTILLERO)', () => {
    expect(shouldSyncWorkerGroupField({ admin_center: 'CONTRATISTA', work_group: 'TANO' }, 'consumables_discount_pct')).toBe(true)
    expect(shouldSyncWorkerGroupField({ admin_center: 'CONTRATISTA', work_group: 'TANO' }, 'safety_items')).toBe(true)
    expect(shouldSyncWorkerGroupField({ admin_center: 'ASTILLERO', work_group: 'ASTILLERO' }, 'consumables_discount_pct')).toBe(false)
    expect(shouldSyncWorkerGroupField({ admin_center: 'CONTRATISTA', work_group: 'TANO' }, 'hourly_rate_ars')).toBe(false)

    expect(buildWorkerGroupSyncPatch({
      name: 'Operario X',
      can_charge_third_party: true,
      trade: 'CALDERERIA',
      consumables: 'CONTRATISTA',
      consumables_discount_pct: 100,
      safety_items: 'CONTRATISTA'
    })).toEqual({
      can_charge_third_party: true,
      trade: 'CALDERERIA',
      consumables: 'CONTRATISTA',
      consumables_discount_pct: 100,
      safety_items: 'CONTRATISTA'
    })
  })
})
