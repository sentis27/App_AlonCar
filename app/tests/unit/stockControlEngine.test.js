import { describe, it, expect } from 'vitest'
import { StockAdjustmentSchema, StockAuditSchema } from '../../src/schemas/panol.schema.js'
import {
  computeStockAuditMetrics,
  computeVirtualStockByMaterial,
  resolveTxStockCellState,
  buildMaterialKardex
} from '../../src/lib/stockControlService.js'
import { fetchMaterialKardexDataService } from '../../src/lib/panolKardexService.js'
import { computeMaterialVitality, computeMaterial6MonthConsumption } from '../../src/lib/materialConsumptionEngine.js'
import { BUSINESS_HELP_REGISTRY, PANOL_STOCK_ADJUST_STEP_HELP, PANOL_STOCK_AUDIT_STEP_HELP } from '../../src/lib/businessHelpRegistry.js'
import { NAVIGATION_MODULES, resolveModuleTab } from '../../src/lib/navigationCatalog.js'

const MAT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const OTHER_MAT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('Pañol Etapa 3 — Schemas y Motor de Control de Stock (GS-007)', () => {
  it('valida StockAdjustmentSchema (permite decimales +/- y rechaza cantidad 0) y StockAuditSchema', () => {
    expect(StockAdjustmentSchema.safeParse({
      material_id: MAT_ID,
      quantity: 12.5,
      reason_type: 'MANUAL_ENTRY'
    }).success).toBe(true)

    expect(StockAdjustmentSchema.safeParse({
      material_id: MAT_ID,
      quantity: -3.25,
      reason_type: 'DAMAGE',
      material_condition: 'DANADO'
    }).success).toBe(true)

    expect(StockAdjustmentSchema.safeParse({
      material_id: MAT_ID,
      quantity: 0,
      reason_type: 'MANUAL_ENTRY'
    }).success).toBe(false)

    expect(StockAuditSchema.safeParse({
      material_id: MAT_ID,
      system_quantity: 10,
      counted_quantity: 8.5,
      status: 'DISCREPANCY'
    }).success).toBe(true)
  })

  it('calcula % Datos Correctos y % Con Error en computeStockAuditMetrics', () => {
    const metrics = computeStockAuditMetrics([
      { status: 'OK', calculated_delta: 0 },
      { status: 'OK', calculated_delta: 0 },
      { status: 'OK', calculated_delta: 0 },
      { status: 'DISCREPANCY', calculated_delta: -2 }
    ])
    expect(metrics).toEqual({
      total: 4,
      okCount: 3,
      discrepancyCount: 1,
      okPct: 75,
      errorPct: 25
    })
  })

  it('computeVirtualStockByMaterial solo suma pedidos VIA_PANOL en PEDIDO o PEDIDO INCOMPLETO', () => {
    const map = computeVirtualStockByMaterial([
      { material_id: MAT_ID, charge_type: 'VIA_PANOL', status: 'PEDIDO', quantity: 5 },
      { material_id: MAT_ID, charge_type: 'VIA_PANOL', status: 'PEDIDO INCOMPLETO', quantity: 2.5 },
      { material_id: MAT_ID, charge_type: 'VIA_PANOL', status: 'RECIBIDO', quantity: 10 },
      { material_id: MAT_ID, charge_type: 'VIA_PANOL', status: 'PEDIR', quantity: 20 },
      { material_id: MAT_ID, charge_type: 'DIRECT', status: 'PEDIDO', quantity: 50 },
      { material_id: OTHER_MAT_ID, charge_type: 'VIA_PANOL', status: 'PEDIDO', quantity: 4 }
    ])
    expect(map.get(MAT_ID)?.virtualQty).toBe(7.5)
    expect(map.get(MAT_ID)?.pendingOrdersCount).toBe(2)
    expect(map.get(OTHER_MAT_ID)?.virtualQty).toBe(4)
  })

  it('resolveTxStockCellState distingue S/C, PRE_ACTIVATION, LIVE hoy y FROZEN tras las 21:00 ART', () => {
    const freezeCfg = { activated_date_ar: '2026-11-25', freeze_hour_ar: 21 }
    const matCtrl = { id: MAT_ID, requires_stock_control: true, current_stock: 4 }
    const matNoCtrl = { id: MAT_ID, requires_stock_control: false, current_stock: 0 }

    expect(resolveTxStockCellState({ tx: {}, material: null, freezeConfig: freezeCfg }).mode).toBe('NO_MATERIAL')
    expect(resolveTxStockCellState({ tx: {}, material: matNoCtrl, freezeConfig: freezeCfg }).mode).toBe('NO_CONTROL')

    const pre = resolveTxStockCellState({
      tx: { transaction_date: '2026-11-20T14:00:00Z', stock_frozen_at: null, stock_snapshot: null },
      material: matCtrl,
      freezeConfig: freezeCfg
    })
    expect(pre.mode).toBe('PRE_ACTIVATION')
    expect(pre.value).toBeNull()

    const live = resolveTxStockCellState({
      tx: { transaction_date: '2026-11-25T14:00:00Z', stock_frozen_at: null, stock_snapshot: null },
      material: matCtrl,
      freezeConfig: freezeCfg
    })
    expect(live.mode).toBe('LIVE')
    expect(live.value).toBe(4)

    const frozen = resolveTxStockCellState({
      tx: {
        transaction_date: '2026-11-25T14:00:00Z',
        stock_frozen_at: '2026-11-26T00:00:00Z',
        stock_snapshot: 11.5
      },
      material: matCtrl,
      freezeConfig: freezeCfg
    })
    expect(frozen.mode).toBe('FROZEN')
    expect(frozen.value).toBe(11.5)
  })

  it('buildMaterialKardex ordena cronológicamente y calcula saldo acumulado exacto', () => {
    const kardex = buildMaterialKardex({
      materialId: MAT_ID,
      purchaseOrders: [
        { id: 'po1', material_id: MAT_ID, charge_type: 'VIA_PANOL', status: 'RECIBIDO', quantity: 10, received_at: '2026-11-25T11:00:00Z', remito_number: '100' },
        { id: 'po2', material_id: MAT_ID, charge_type: 'DIRECT', status: 'RECIB.COMP.DIRECT', quantity: 99, received_at: '2026-11-25T12:00:00Z' }
      ],
      transactions: [
        { id: 'tx1', material_id: MAT_ID, quantity_withdrawn: 2.5, transaction_date: '2026-11-25T15:00:00Z', contractor_name: 'TANO' }
      ],
      adjustments: [
        { id: 'adj1', material_id: MAT_ID, quantity: -0.5, reason_type: 'DAMAGE', effective_at: '2026-11-25T17:00:00Z' }
      ]
    })
    expect(kardex.map((k) => ({ type: k.sourceType, delta: k.delta, bal: k.runningBalance }))).toEqual([
      { type: 'COMPRA', delta: 10, bal: 10 },
      { type: 'RETIRO', delta: -2.5, bal: 7.5 },
      { type: 'AJUSTE', delta: -0.5, bal: 7 }
    ])
  })

  it('Etapa 4 + 5: orden definitivo acordeón 1-3-2-4-5-6, ayudas Stepper, Kárdex vacío y Vitalidad 6M', async () => {
    const panolMod = NAVIGATION_MODULES.find((m) => m.id === 'panol')
    expect(panolMod?.children.map((c) => c.id)).toEqual([
      'planillas',
      'control_stock',
      'entradas',
      'catalogo',
      'gases',
      'epp'
    ])
    expect(resolveModuleTab('panol', 'entradas')).toBe('entradas')
    expect(resolveModuleTab('panol', 'control_stock')).toBe('control_stock')

    expect(PANOL_STOCK_ADJUST_STEP_HELP[1].id).toBe('panol_stock_adjust_step_1')
    expect(PANOL_STOCK_AUDIT_STEP_HELP[1].id).toBe('panol_stock_audit_step_1')
    expect(BUSINESS_HELP_REGISTRY.panol_stock_adjust).toBe(PANOL_STOCK_ADJUST_STEP_HELP)
    expect(BUSINESS_HELP_REGISTRY.panol_stock_audit).toBe(PANOL_STOCK_AUDIT_STEP_HELP)

    const empty = await fetchMaterialKardexDataService(null)
    expect(empty.entries).toEqual([])
    expect(empty.currentStockDb).toBe(0)

    const healthy = computeMaterialVitality({ currentStock: 60, virtualQty: 30, monthlyAverage: 30 })
    expect(healthy.physical).toMatchObject({ days: 60, months: 2, status: 'SALUDABLE' })
    expect(healthy.withVirtual).toMatchObject({ days: 90, months: 3, status: 'SALUDABLE' })
    expect(healthy.hasVirtual).toBe(true)

    const crit = computeMaterialVitality({ currentStock: 10, virtualQty: 0, monthlyAverage: 30 })
    expect(crit.physical).toMatchObject({ days: 10, status: 'CRITICO' })

    expect(computeMaterialVitality({ currentStock: -2, monthlyAverage: 0 }).physical.status).toBe('NEGATIVO')
    expect(computeMaterialVitality({ currentStock: 5, monthlyAverage: 0 }).physical.status).toBe('SIN_CONSUMO')
    expect(computeMaterialVitality({ currentStock: 0, monthlyAverage: 12 }).physical.status).toBe('AGOTADO')

    const summary = computeMaterial6MonthConsumption({
      material: { id: MAT_ID, name: 'CHAPA', unit_measure: 'm²', current_stock: 15 },
      transactions: [{ material_id: MAT_ID, quantity_withdrawn: 180, transaction_date: new Date().toISOString() }],
      virtualQty: 15
    })
    expect(summary.vitality.physical.days).toBe(15)
    expect(summary.vitality.withVirtual.days).toBe(30)
  })
})
