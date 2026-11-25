import { describe, it, expect } from 'vitest'
import {
  computeFortnightUnitSnapshot,
  buildInlineMaterialPricePatch,
  shouldPropagateCatalogPriceToTx,
  getFortnightPeriodKey,
  DEFAULT_MATERIAL_PRICING_POLICY
} from '../../src/lib/materialPricingPolicy.js'
import {
  resolvePanolTxCost,
  isPanolWithdrawalUnvalued,
  calculatePanolTotalsWithCost,
  getPanolMovimientosColumns,
  getPanolPasteFields
} from '../../src/lib/panolCostHelpers.js'
import { getMaterialsColumns } from '../../src/lib/panolConstants.js'
import { isPanolTxZeroCost } from '../../src/lib/zeroCostAlertsRules.js'
import { filterPanolTransactions } from '../../src/lib/panolFilterHelpers.js'

const SAMPLE_MACROS = [
  { year: 2026, month: 11, dollar_rate: 1500, dollar_rate_1q: 1500, dollar_rate_2q: 1500, is_locked_1q: true, is_locked_2q: false },
  { year: 2026, month: 12, dollar_rate: 1600, dollar_rate_1q: 1600, dollar_rate_2q: 1600, is_locked_1q: false, is_locked_2q: false }
]

describe('Pañol — Política Quincenal de Precios, Costos por Rol y Filtro Sin Valor', () => {
  it('congela costos por quincena según dólar vigente sin alterar quincenas previas al cambiar el dólar', () => {
    const mat = { id: 'm1', name: 'PINTURA EPOXY', cost_ars: 15000, cost_usd: 10.6, security_factor: 1.06, category: 'MATERIALES' }
    const snapNov = computeFortnightUnitSnapshot({ material: mat, transactionDate: '2026-11-24', macroVariables: SAMPLE_MACROS })
    const snapDec = computeFortnightUnitSnapshot({ material: mat, transactionDate: '2026-12-03', macroVariables: SAMPLE_MACROS })

    expect(snapNov.periodKey).toBe('2026-11-2Q')
    expect(snapNov.dollarRate).toBe(1500)
    expect(snapNov.unit_cost_usd_snapshot).toBe(10.6)

    expect(snapDec.periodKey).toBe('2026-12-1Q')
    expect(snapDec.dollarRate).toBe(1600)
    expect(snapDec.unit_cost_usd_snapshot).toBe(9.94)

    // El retiro de noviembre ya sellado conserva su costo congelado aunque cambie el precio del catálogo en diciembre
    const txNov = { id: 'tx1', material_id: 'm1', quantity_withdrawn: 2, transaction_date: '2026-11-24', unit_cost_ars_snapshot: 15000, unit_cost_usd_snapshot: 10.6 }
    const matUpdated = { ...mat, cost_ars: 25000, cost_usd: 16.56 }
    const costNov = resolvePanolTxCost(txNov, matUpdated, { macroVariables: SAMPLE_MACROS, policy: DEFAULT_MATERIAL_PRICING_POLICY })
    expect(costNov.source).toBe('SNAPSHOT')
    expect(costNov.unitUsd).toBe(10.6)
    expect(costNov.totalUsd).toBe(21.2)
  })

  it('al actualizar precio en Catálogo solo propaga desde la quincena en curso en adelante y respeta candados', () => {
    const currentPeriod = getFortnightPeriodKey('2026-11-24') // 2026-11-2Q
    const lockedQ1 = shouldPropagateCatalogPriceToTx({
      tx: { id: 't1', transaction_date: '2026-11-10', unit_cost_usd_snapshot: 0 },
      currentPeriod,
      macroVariables: SAMPLE_MACROS
    })
    expect(lockedQ1).toEqual({ eligible: false, reason: 'LOCKED_FORTNIGHT' })

    const unlockedHistValued = shouldPropagateCatalogPriceToTx({
      tx: { id: 't2', transaction_date: '2026-10-10', unit_cost_usd_snapshot: 10.6 },
      currentPeriod,
      macroVariables: SAMPLE_MACROS
    })
    expect(unlockedHistValued).toEqual({ eligible: false, reason: 'HISTORICAL_LOCKED' })

    const currentQ2 = shouldPropagateCatalogPriceToTx({
      tx: { id: 't3', transaction_date: '2026-11-24', unit_cost_usd_snapshot: 10.6 },
      currentPeriod,
      macroVariables: SAMPLE_MACROS
    })
    expect(currentQ2).toEqual({ eligible: true, reason: 'CURRENT_OR_FUTURE' })
  })

  it('recalcula Costo US$ al editar Precio AR$ y avisa cuando supera US$ 4.000 sin 2% de seguridad', () => {
    const resNormal = buildInlineMaterialPricePatch({
      field: 'cost_ars',
      parsedValue: 15000,
      material: { cost_ars: 0, security_factor: 1.06 },
      dollarRate: 1500
    })
    expect(resNormal.patch.cost_usd).toBe(10.6)
    expect(resNormal.highValueWarning).toBe(false)

    const resHigh = buildInlineMaterialPricePatch({
      field: 'cost_ars',
      parsedValue: 6500000,
      material: { cost_ars: 0, security_factor: 1.06 },
      dollarRate: 1500
    })
    expect(resHigh.patch.cost_usd).toBe(4593.33)
    expect(resHigh.highValueWarning).toBe(true)
  })

  it('resuelve correctamente snapshot=0 cayendo al catálogo y filtra Sin Valor incluyendo EPP y excluyendo filas en blanco', () => {
    const mats = [
      { id: 'm-ok', name: 'DISCO', category: 'CONSUMIBLES', cost_ars: 6500, cost_usd: 4.33, security_factor: 1.06 },
      { id: 'm-zero', name: 'CHAPA SIN PRECIO', category: 'MATERIALES', cost_ars: 0, cost_usd: 0, security_factor: 1.06 },
      { id: 'm-epp-zero', name: 'GUANTES', category: 'ELEM.SEGURIDAD', cost_ars: 0, cost_usd: 0, security_factor: 1.06 }
    ]
    const txs = [
      { id: 'tx-ok', material_id: 'm-ok', quantity_withdrawn: 2, unit_cost_usd_snapshot: 0, transaction_date: '2026-11-24' },
      { id: 'tx-zero', material_id: 'm-zero', quantity_withdrawn: 1, unit_cost_usd_snapshot: 0, transaction_date: '2026-11-24' },
      { id: 'tx-epp-zero', material_id: 'm-epp-zero', quantity_withdrawn: 1, unit_cost_usd_snapshot: 0, movement_type: 'ENTREGA_EPP', transaction_date: '2026-11-24' },
      { id: 'tx-blank', material_id: null, quantity_withdrawn: null, unit_cost_usd_snapshot: 0, transaction_date: '2026-11-24' },
      { id: 'tx-del', material_id: 'm-zero', quantity_withdrawn: 1, unit_cost_usd_snapshot: 0, is_deletion_requested: true, transaction_date: '2026-11-24' }
    ]

    // Fix bug 0 ?? mat.cost_usd en zeroCostAlertsRules
    expect(isPanolTxZeroCost(txs[0], mats[0])).toBe(false)
    expect(isPanolTxZeroCost(txs[1], mats[1])).toBe(true)
    expect(isPanolTxZeroCost(txs[3], null)).toBe(false)

    // Filtro Sin Valor en Pañol Retiros: incluye material $0 + EPP $0, excluye valorizados, blancos y bajas
    expect(isPanolWithdrawalUnvalued(txs[0], mats[0])).toBe(false)
    expect(isPanolWithdrawalUnvalued(txs[1], mats[1])).toBe(true)
    expect(isPanolWithdrawalUnvalued(txs[2], mats[2])).toBe(true)
    expect(isPanolWithdrawalUnvalued(txs[3], null)).toBe(false)
    expect(isPanolWithdrawalUnvalued(txs[4], mats[1])).toBe(false)

    const filtered = filterPanolTransactions(txs, {
      onlyZeroCost: true,
      filterPeriod: 'TODOS',
      filterShip: 'TODOS',
      filterCategory: 'TODAS',
      materials: mats
    })
    expect(filtered.map((x) => x.id)).toEqual(['tx-zero', 'tx-epp-zero'])

    const totals = calculatePanolTotalsWithCost(txs, mats)
    expect(totals.unvaluedCount).toBe(2)
    expect(totals.totalUsd).toBeGreaterThan(0)
  })

  it('ordena columnas de Retiros (Contratista tras OT) y oculta Costo/Centro de Costo y Precios de Catálogo a no-admin', () => {
    const adminRetiros = getPanolMovimientosColumns(true).map((c) => c.key)
    const staffRetiros = getPanolMovimientosColumns(false).map((c) => c.key)

    expect(adminRetiros).toEqual([
      'transaction_date',
      'ship_id',
      'work_order_id',
      'contractor_name',
      'material_id',
      'quantity_withdrawn',
      'weight_total',
      'cost_total_usd',
      'cost_center',
      'voucher_number',
      'notes'
    ])
    expect(staffRetiros).toEqual([
      'transaction_date',
      'ship_id',
      'work_order_id',
      'contractor_name',
      'material_id',
      'quantity_withdrawn',
      'weight_total',
      'voucher_number',
      'notes'
    ])
    expect(getPanolPasteFields(false)).not.toContain('cost_center')
    expect(getPanolPasteFields(true)).toContain('cost_center')

    const adminCatalog = getMaterialsColumns(true).map((c) => c.key)
    const staffCatalog = getMaterialsColumns(false).map((c) => c.key)
    expect(adminCatalog).toContain('cost_ars')
    expect(adminCatalog).toContain('cost_usd')
    expect(staffCatalog).not.toContain('cost_ars')
    expect(staffCatalog).not.toContain('cost_usd')
  })
})
