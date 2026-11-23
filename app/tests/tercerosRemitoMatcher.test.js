import { describe, it, expect } from 'vitest'
import {
  normalizeRemitoNumber,
  buildPanolRemitoIndex,
  evaluateRemitoMatch,
} from '../src/lib/tercerosRemitoMatcher.js'

describe('tercerosRemitoMatcher — Cruce Remito AlonCar (Pañol ↔ Terceros)', () => {
  const ships = [{ id: 's-1', name: 'MIS SUEÑOS' }]
  const workOrders = [
    { id: 'wo-chapa', ship_id: 's-1', ot_number: 'OT-2', title: 'CAMBIO DE CHAPA' },
    { id: 'wo-tub', ship_id: 's-1', ot_number: 'OT-1', title: 'TUBERIAS TERMOFUSION' },
  ]
  const materials = [
    { id: 'm-chapa', name: 'CHAPA NAVAL 8MM', unit_measure: 'm²', weight_kg: 62.8 },
    { id: 'm-electrodo', name: 'ELECTRODO 7018', unit_measure: 'kg', weight_kg: 1 },
    { id: 'm-codo', name: 'CODO TERMOFUSION 32MM', unit_measure: 'Unidad', weight_kg: 0 },
  ]
  const panolTx = [
    {
      id: 'tx-1',
      material_id: 'm-chapa',
      work_order_id: 'wo-chapa',
      ship_id: 's-1',
      quantity_withdrawn: 2,
      weight_total: 125.6,
      voucher_number: '002530',
      contractor_name: 'TANO',
    },
    {
      id: 'tx-2',
      material_id: 'm-electrodo',
      work_order_id: 'wo-chapa',
      ship_id: 's-1',
      quantity_withdrawn: 5,
      weight_total: 5,
      voucher_number: '#2530',
    },
    {
      id: 'tx-3',
      material_id: 'm-codo',
      work_order_id: 'wo-chapa',
      ship_id: 's-1',
      quantity_withdrawn: 4,
      weight_total: 0,
      voucher_number: '2530',
    },
    {
      id: 'tx-del',
      material_id: 'm-codo',
      work_order_id: 'wo-tub',
      ship_id: 's-1',
      quantity_withdrawn: 99,
      weight_total: 0,
      voucher_number: '2530',
      is_deletion_requested: true,
    },
  ]

  const otMap = new Map(workOrders.map((w) => [w.id, w]))

  it('normaliza números de remito con #, espacios y ceros a la izquierda', () => {
    expect(normalizeRemitoNumber('#002530')).toBe('2530')
    expect(normalizeRemitoNumber(' 2530 ')).toBe('2530')
    expect(normalizeRemitoNumber('rmt-42')).toBe('RMT-42')
    expect(normalizeRemitoNumber('')).toBe('')
  })

  it('agrupa materiales del remito mostrando cantidad, nombre y kilos solo si corresponde', () => {
    const index = buildPanolRemitoIndex(panolTx, materials, workOrders, ships)
    const match = evaluateRemitoMatch({
      remitoNumber: '2530',
      tercerosWorkOrderId: 'wo-chapa',
      remitoIndex: index,
      otMap,
    })

    expect(match.hasRemito).toBe(true)
    expect(match.hasMatches).toBe(true)
    expect(match.items).toHaveLength(3) // excluye tx-del con baja solicitada
    expect(match.hasOtMismatch).toBe(false)
    expect(match.panolContractorSummary).toBe('TANO')

    // Chapa en m² con peso total -> muestra kilos
    expect(match.items[0].materialName).toBe('CHAPA NAVAL 8MM')
    expect(match.items[0].quantityLabel).toContain('2')
    expect(match.items[0].weightLabel).toContain('kg')

    // Electrodo cuya unidad ya es kg -> no duplica weightLabel
    expect(match.items[1].materialName).toBe('ELECTRODO 7018')
    expect(match.items[1].isUnitKg).toBe(true)
    expect(match.items[1].weightLabel).toBe('')

    // Codo sin peso -> weightLabel vacío
    expect(match.items[2].materialName).toBe('CODO TERMOFUSION 32MM')
    expect(match.items[2].weightLabel).toBe('')
  })

  it('detecta incongruencia de OT cuando Pañol imputó a Cambio de Chapa y Terceros a Tuberías', () => {
    const index = buildPanolRemitoIndex(panolTx, materials, workOrders, ships)
    const match = evaluateRemitoMatch({
      remitoNumber: '2530',
      tercerosWorkOrderId: 'wo-tub',
      remitoIndex: index,
      otMap,
    })

    expect(match.hasOtMismatch).toBe(true)
    expect(match.mismatchMessage).toContain('CAMBIO DE CHAPA')
    expect(match.mismatchMessage).toContain('TUBERIAS TERMOFUSION')
  })
})
