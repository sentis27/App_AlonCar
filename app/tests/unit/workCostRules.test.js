import { describe, it, expect } from 'vitest'
import {
  resolveEffectiveSafetyCenter,
  resolveConsumablesDiscountPct,
  classifyWithdrawalCost,
  computeManagerialCostSummary,
  computeContractExpiration,
} from '../../src/lib/workCostRules.js'

describe('resolveEffectiveSafetyCenter', () => {
  it('nómina ASTILLERO siempre es ASTILLERO; default CONTRATISTA', () => {
    expect(resolveEffectiveSafetyCenter(null)).toBe('CONTRATISTA')
    expect(resolveEffectiveSafetyCenter({ admin_center: 'astillero' })).toBe('ASTILLERO')
    expect(resolveEffectiveSafetyCenter({ admin_center: 'CONTRATISTA' })).toBe('CONTRATISTA')
  })
  it('contratista en zona gris (safety_items = ASTILLERO)', () => {
    expect(resolveEffectiveSafetyCenter({ admin_center: 'TALLER', safety_items: 'astillero' })).toBe('ASTILLERO')
  })
})

describe('resolveConsumablesDiscountPct', () => {
  it('casos base', () => {
    expect(resolveConsumablesDiscountPct(null)).toBe(0)
    expect(resolveConsumablesDiscountPct({ admin_center: 'ASTILLERO' })).toBe(0)
    expect(resolveConsumablesDiscountPct({ consumables: 'CLIENTE' })).toBe(0)
    expect(resolveConsumablesDiscountPct({ consumables: 'CONTRATISTA' })).toBe(100)
  })
  it('el % explícito tiene prioridad y se acota a 0..100', () => {
    expect(resolveConsumablesDiscountPct({ consumables: 'CONTRATISTA', consumables_discount_pct: 30 })).toBe(30)
    expect(resolveConsumablesDiscountPct({ consumables_discount_pct: 150 })).toBe(100)
    expect(resolveConsumablesDiscountPct({ consumables_discount_pct: -5 })).toBe(0)
  })
  it('extrae el número de etiquetas tipo "50%"', () => {
    expect(resolveConsumablesDiscountPct({ consumables: '50%' })).toBe(50)
  })
})

describe('classifyWithdrawalCost', () => {
  const tx = { quantity_withdrawn: 2, unit_cost_ars_snapshot: 100, unit_cost_usd_snapshot: 1.5 }

  it('MATERIALES van 100% al barco', () => {
    const r = classifyWithdrawalCost({ material: { category: 'MATERIALES' }, transaction: tx, worker: null })
    expect(r.bucket).toBe('MATERIAL_SHIP_DIRECT')
    expect(r.shipDirectArs).toBe(200)
    expect(r.shipDirectUsd).toBe(3)
  })

  it('EPP de contratista se descuenta 100% al contratista', () => {
    const r = classifyWithdrawalCost({ material: { category: 'ELEM.SEGURIDAD' }, transaction: tx, worker: { admin_center: 'CONTRATISTA' } })
    expect(r.bucket).toBe('SAFETY_CONTRACTOR_DEDUCTION')
    expect(r.deductArs).toBe(200)
    expect(r.shipDirectArs).toBe(0)
  })

  it('EPP de astillero o zona gris queda solo como referencia', () => {
    const own = classifyWithdrawalCost({ material: { category: 'ELEM.SEGURIDAD' }, transaction: tx, worker: { admin_center: 'ASTILLERO' } })
    expect(own.referenceOnly).toBe(true)
    expect(own.isGrayZoneException).toBe(false)
    expect(own.referenceArs).toBe(200)
    const gray = classifyWithdrawalCost({ material: {}, transaction: { ...tx, movement_type: 'ENTREGA_EPP' }, worker: { admin_center: 'TALLER', safety_items: 'ASTILLERO' } })
    expect(gray.isGrayZoneException).toBe(true)
  })

  it('CONSUMIBLES se dividen según % del contratista', () => {
    const r = classifyWithdrawalCost({ material: { category: 'CONSUMIBLES' }, transaction: tx, worker: { consumables_discount_pct: 25 } })
    expect(r.bucket).toBe('CONSUMABLE_CONTRACTOR_SPLIT')
    expect(r.deductArs).toBe(50)
    expect(r.shipDirectArs).toBe(150)
  })

  it('CONSUMIBLES con 0% pero cost_center CONTRATISTA explícito fuerzan 100%', () => {
    const r = classifyWithdrawalCost({ material: { category: 'CONSUMIBLES' }, transaction: { ...tx, cost_center: 'contratista' }, worker: { admin_center: 'ASTILLERO' } })
    expect(r.contractorDeductPct).toBe(100)
  })
})

describe('computeManagerialCostSummary', () => {
  it('suma el directo y excluye la referencia de seguridad', () => {
    const r = computeManagerialCostSummary({ materialesUsd: 10.25, consumiblesObraUsd: 5, tercerosUsd: 20, horasUsd: 30, horasPendAprobarUsd: 1, seguridadReferenciaUsd: 99 })
    expect(r.directTotalUsd).toBe(66.25)
    expect(r.seguridadReferenciaUsd).toBe(99)
  })
  it('valores nulos cuentan como 0', () => {
    expect(computeManagerialCostSummary().directTotalUsd).toBe(0)
  })
})

describe('computeContractExpiration', () => {
  const ref = new Date(2026, 10, 18) // 18-nov-2026

  it('tipo desconocido o permanente', () => {
    expect(computeContractExpiration('XX', '2026-01-01', ref).hasContract).toBe(false)
    const p = computeContractExpiration('permanente', '2026-01-01', ref)
    expect(p.isPermanent).toBe(true)
    expect(p.expiresIso).toBe(null)
  })

  it('calcula vencimiento y alerta 7 días antes', () => {
    const r = computeContractExpiration('1 MES', '2026-10-22', ref)
    expect(r.expiresIso).toBe('2026-11-22')
    expect(r.daysRemaining).toBe(4)
    expect(r.isExpiringSoon).toBe(true)
    expect(r.vacationDays).toBe(1)
  })

  it('contrato vencido', () => {
    const r = computeContractExpiration('3 MESES', '2026-01-01', ref)
    expect(r.isExpired).toBe(true)
    expect(r.needsAttention).toBe(true)
  })

  it('sin fecha de inicio o fecha inválida', () => {
    expect(computeContractExpiration('6 MESES', '', ref).expiresIso).toBe(null)
    expect(computeContractExpiration('6 MESES', 'basura', ref).hasContract).toBe(false)
  })
})
