import { describe, it, expect } from 'vitest'
import {
  formatQuincenaLabelAr,
  resolveRateForDate,
  computePaymentNetUsd,
  buildThirdPartyCcLedger,
} from '../../src/lib/thirdPartyCcEngine.js'

describe('thirdPartyCcEngine (Motor Cuentas Corrientes de Talleres)', () => {
  it('formatea quincenas argentinas y resuelve tarifas históricas sin pisar el pasado', () => {
    expect(formatQuincenaLabelAr('2026-09-10')).toBe('1RA SEP 2026')
    expect(formatQuincenaLabelAr('2026-10-20')).toBe('2DA OCT 2026')

    const history = [
      { id: 'r1', effective_from: '2026-01-01', rate_usd_per_kg: 1.05 },
      { id: 'r2', effective_from: '2026-10-01', rate_usd_per_kg: 1.25 },
    ]
    expect(resolveRateForDate('2026-09-10', history, 1.25)).toMatchObject({
      rate: 1.05,
      isCurrentRate: false,
    })
    expect(resolveRateForDate('2026-10-20', history, 1.25)).toMatchObject({
      rate: 1.25,
      isCurrentRate: true,
    })
  })

  it('calcula neto USD descontando IVA 21% y mantiene efectivo USD directo', () => {
    expect(computePaymentNetUsd({ paymentType: 'EFECTIVO_USD', amountUsd: 1000 })).toEqual({
      netUsd: 1000,
      grossUsdWithIva: null,
    })
    expect(
      computePaymentNetUsd({
        paymentType: 'ECHEQ_ARS',
        amountArs: 1815000,
        exchangeRate: 1500,
        hasIva: true,
        ivaPct: 21,
      })
    ).toEqual({ netUsd: 1000, grossUsdWithIva: 1210 })
  })

  it('absorbe solo MATERIALES en modo PER_KG, agrupa remitos multi-línea, aplica ajuste azul y FIFO', () => {
    const workerId = 'w-ina'
    const account = {
      id: 'acc-1',
      worker_id: workerId,
      operational_name: 'INA PANTOGRAFO',
      legal_name: 'PAMPA NAVAL',
      pricing_mode: 'PER_KG',
      current_rate_usd: 1.25,
      opening_balance_usd: 0,
      material_categories: ['MATERIALES'],
      cancellation_mode: 'FIFO',
    }
    const materials = [
      { id: 'm-chapa', name: 'CHAPA NAVAL 1/4"', category: 'MATERIALES', unit_measure: 'Chapa', weight_kg: 52 },
      { id: 'm-disco', name: 'DISCO CORTE 7"', category: 'CONSUMIBLES', unit_measure: 'Unidad', weight_kg: 0.3 },
    ]
    const panolRemitoTx = [
      { id: 't1', material_id: 'm-chapa', worker_id: workerId, voucher_number: '9001', quantity_withdrawn: 10, weight_total: 520, transaction_date: '2026-09-10T15:00:00Z' },
      { id: 't2', material_id: 'm-chapa', worker_id: workerId, voucher_number: '9002', quantity_withdrawn: 18, weight_total: 936, transaction_date: '2026-10-08T15:00:00Z' },
      { id: 't3a', material_id: 'm-chapa', worker_id: workerId, voucher_number: '9003', quantity_withdrawn: 12, weight_total: 624, transaction_date: '2026-10-20T15:00:00Z' },
      { id: 't3b', material_id: 'm-chapa', worker_id: workerId, voucher_number: '9003', quantity_withdrawn: 8, weight_total: 416, transaction_date: '2026-10-20T15:00:00Z' },
      { id: 't4', material_id: 'm-chapa', worker_id: workerId, voucher_number: '9004', quantity_withdrawn: 4, weight_total: 208, transaction_date: '2026-11-05T15:00:00Z' },
      { id: 't5', material_id: 'm-chapa', worker_id: workerId, voucher_number: '9005', quantity_withdrawn: 25, weight_total: 1300, transaction_date: '2026-11-18T15:00:00Z' },
      // Consumible con peso: NO debe absorberse en DEBE
      { id: 't-cons', material_id: 'm-disco', worker_id: workerId, voucher_number: '9999', quantity_withdrawn: 20, weight_total: 6, transaction_date: '2026-11-18T15:00:00Z' },
    ]
    const rateHistory = [
      { id: 'rh1', effective_from: '2026-01-01', rate_usd_per_kg: 1.05 },
      { id: 'rh2', effective_from: '2026-10-01', rate_usd_per_kg: 1.25 },
    ]
    const savedEntries = [
      { id: 'ov-9004', source_key: 'REMITO:9004', entry_source: 'PANOL_REMITO', is_special_rate: true, rate_usd_applied: 1.625, amount_usd: 338 },
    ]
    const payments = [
      { id: 'p1', payment_date: '2026-10-15', payment_type: 'EFECTIVO_USD', amount_usd: 1000 },
      { id: 'p2', payment_date: '2026-10-28', payment_type: 'TRANSFERENCIA_ARS', amount_usd: 1200 },
      { id: 'p3', payment_date: '2026-11-10', payment_type: 'ECHEQ_ARS', amount_usd: 1000 },
      { id: 'p4', payment_date: '2026-11-15', payment_type: 'COMPENSACION_PANOL', amount_usd: 85 },
    ]

    const ledger = buildThirdPartyCcLedger({
      account,
      rateHistory,
      savedEntries,
      payments,
      panolRemitoTx,
      materials,
    })

    expect(ledger.debeRows).toHaveLength(5)
    expect(ledger.totals).toMatchObject({
      totalKilos: 4004,
      totalDebeUsd: 4979,
      totalHaberUsd: 3285,
      balanceUsd: -1694,
    })
    expect(ledger.debeRows.find((r) => r.remitoNumber === '9001').visualTier).toBe('cancelled_historical')
    expect(ledger.debeRows.find((r) => r.remitoNumber === '9003')).toMatchObject({
      weightKg: 1040,
      amountUsd: 1300,
      isCancelled: true,
      visualTier: 'cancelled_current',
    })
    expect(ledger.debeRows.find((r) => r.remitoNumber === '9004')).toMatchObject({
      isSpecialRate: true,
      visualTier: 'special',
    })
    expect(ledger.debeRows.find((r) => r.remitoNumber === '9005')).toMatchObject({
      isCancelled: false,
      visualTier: 'pending',
    })
  })

  it('soporta modo BY_VOUCHER para cuentas corrientes por comprobante de Terceros', () => {
    const ledger = buildThirdPartyCcLedger({
      account: { id: 'acc-2', worker_id: 'w-teco', operational_name: 'TECO TALLER', pricing_mode: 'BY_VOUCHER', cancellation_mode: 'FIFO' },
      thirdPartyServices: [
        { id: 's1', contractor_id: 'w-teco', contractor_name: 'TECO TALLER', service_date: '2026-11-01', voucher_type: 'FCR', internal_remito_number: '310', amount_usd: 850 },
      ],
      payments: [{ id: 'p1', payment_date: '2026-11-05', payment_type: 'EFECTIVO_USD', amount_usd: 850 }],
    })
    expect(ledger.debeRows).toHaveLength(1)
    expect(ledger.debeRows[0].isCancelled).toBe(true)
    expect(ledger.totals.balanceUsd).toBe(0)
  })
})
