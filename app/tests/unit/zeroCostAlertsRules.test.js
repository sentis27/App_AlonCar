import { describe, it, expect } from 'vitest'
import {
  isThirdPartyZeroCost,
  isPanolTxZeroCost,
  isDirectPurchaseZeroCost,
  isBillableShip,
  buildZeroCostAlertsSummary,
} from '../../src/lib/zeroCostAlertsRules.js'

describe('isThirdPartyZeroCost', () => {
  it('detecta servicio activo sin valorizar en ARS ni USD', () => {
    expect(isThirdPartyZeroCost({ amount_ars: 0, amount_usd: 0 })).toBe(true)
    expect(isThirdPartyZeroCost({ amount_ars: null, amount_usd: undefined })).toBe(true)
  })
  it('no alerta si tiene monto en alguna moneda o está inactivo', () => {
    expect(isThirdPartyZeroCost({ amount_ars: 1000, amount_usd: 0 })).toBe(false)
    expect(isThirdPartyZeroCost({ amount_ars: 0, amount_usd: 5 })).toBe(false)
    expect(isThirdPartyZeroCost({ amount_ars: 0, amount_usd: 0, is_active: false })).toBe(false)
    expect(isThirdPartyZeroCost(null)).toBe(false)
  })
})

describe('isPanolTxZeroCost', () => {
  it('detecta retiro sin precio', () => {
    expect(isPanolTxZeroCost({ unit_cost_usd_snapshot: 0 }, { category: 'MATERIALES' })).toBe(true)
  })
  it('excluye EPP (categoría o movimiento) y bajas solicitadas', () => {
    expect(isPanolTxZeroCost({ unit_cost_usd_snapshot: 0 }, { category: 'elem.seguridad' })).toBe(false)
    expect(isPanolTxZeroCost({ movement_type: 'ENTREGA_EPP', unit_cost_usd_snapshot: 0 })).toBe(false)
    expect(isPanolTxZeroCost({ is_deletion_requested: true, unit_cost_usd_snapshot: 0 })).toBe(false)
  })
  it('usa el costo del material como fallback', () => {
    expect(isPanolTxZeroCost({}, { category: 'MATERIALES', cost_usd: 12 })).toBe(false)
  })
})

describe('isDirectPurchaseZeroCost', () => {
  it('solo alerta compras DIRECT recibidas sin precio', () => {
    const base = { charge_type: 'direct', status: 'RECIB.COMP.DIRECT' }
    expect(isDirectPurchaseZeroCost({ ...base, supplier_quoted_price: 0 })).toBe(true)
    expect(isDirectPurchaseZeroCost({ ...base, system_unit_price: 50 })).toBe(false)
    expect(isDirectPurchaseZeroCost({ ...base, charge_type: 'STOCK' })).toBe(false)
    expect(isDirectPurchaseZeroCost({ ...base, status: 'PENDIENTE' })).toBe(false)
  })
})

describe('isBillableShip', () => {
  const shipMap = new Map([
    ['s1', { id: 's1', name: 'ASTILLERO', status: 'ACTIVO' }],
    ['s2', { id: 's2', name: 'DON PEPE', status: 'FACTURADO' }],
  ])
  it('sin shipId no es facturable; buque desconocido sí', () => {
    expect(isBillableShip(null, shipMap)).toBe(false)
    expect(isBillableShip('desconocido', shipMap)).toBe(true)
  })
  it('respeta excludeAstillero e includeInactiveShips', () => {
    expect(isBillableShip('s1', shipMap, { excludeAstillero: true })).toBe(false)
    expect(isBillableShip('s2', shipMap)).toBe(true)
    expect(isBillableShip('s2', shipMap, { includeInactiveShips: false })).toBe(false)
  })
})

describe('buildZeroCostAlertsSummary', () => {
  it('cuenta terceros y materiales por origen, filtrando por buque', () => {
    const summary = buildZeroCostAlertsSummary({
      thirdPartyRows: [
        { id: 't1', hasZeroCost: true, shipId: 's1', otNumber: '101' },
        { id: 't2', hasZeroCost: false, shipId: 's1' },
        { id: 't3', hasZeroCost: true, shipId: 's2' },
      ],
      materialRows: [
        { id: 'm1', hasZeroPrice: true, shipId: 's1', sourceType: 'PANOL_TX' },
        { id: 'm2', hasZeroPrice: true, shipId: 's1', sourceType: 'COMPRA_DIRECTA' },
        { id: 'm3', hasZeroPrice: true, shipId: 's1', isDeletionRequested: true },
      ],
      shipFilterId: 's1',
    })
    expect(summary.thirdPartyCount).toBe(1)
    expect(summary.materialsCount).toBe(2)
    expect(summary.panolCount).toBe(1)
    expect(summary.directPurchasesCount).toBe(1)
    expect(summary.totalCount).toBe(3)
    expect(summary.thirdPartyItems[0].otLabel).toBe('101')
  })

  it('con requireShip descarta filas sin buque', () => {
    const summary = buildZeroCostAlertsSummary({
      thirdPartyRows: [{ id: 't1', hasZeroCost: true, shipId: null }],
      requireShip: true,
    })
    expect(summary.totalCount).toBe(0)
  })
})
