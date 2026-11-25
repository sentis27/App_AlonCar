import { describe, it, expect } from 'vitest'
import {
  buildPanolContractorSelectModel,
  evaluateInlineContractorChange,
  isContractorEnabledForWorkOrder
} from '../../src/lib/panolContractorService.js'
import { getPanolMovimientosColumns } from '../../src/lib/panolCostHelpers.js'

const SHIP_ID = '11111111-1111-4111-8111-111111111111'
const WO_CALD_ID = '22222222-2222-4222-8222-222222222222'
const WO_EXT_ID = '33333333-3333-4333-8333-333333333333'
const WI_CALD_ID = '44444444-4444-4444-8444-444444444444'
const WI_EXT_ID = '55555555-5555-4555-8555-555555555555'
const WORKER_CABALLERO_ID = '66666666-6666-4666-8666-666666666666'
const WORKER_TANO_ID = '77777777-7777-4777-8777-777777777777'

const AST_WORKERS = [
  { id: WORKER_CABALLERO_ID, name: 'Caballero, Daniel Emanuel', trade: 'Calderería', admin_center: 'ASTILLERO' },
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Toledo, Luciano', trade: 'Calderería', admin_center: 'ASTILLERO' }
]
const CNT_GROUPS = ['4RG SERV. INDUSTRIALES', 'TANO']
const ALL_WORKERS = [
  ...AST_WORKERS,
  { id: WORKER_TANO_ID, name: 'TANO', work_group: 'TANO', admin_center: 'CONTRATISTA', status: 'ACTIVO' }
]

const WORK_ORDERS = [
  { id: WO_CALD_ID, ship_id: SHIP_ID, ot_number: '3', title: 'CAMBIO CHAPA', status: 'En ejecución' },
  { id: WO_EXT_ID, ship_id: SHIP_ID, ot_number: '5', title: 'PRUEBA', status: 'En ejecución' }
]

const WORK_ITEMS = [
  { id: WI_CALD_ID, work_order_id: WO_CALD_ID, contractors: ['ASTILLERO.CALDERERIA'], status: 'En ejecución' },
  { id: WI_EXT_ID, work_order_id: WO_EXT_ID, contractors: ['4RG SERV. INDUSTRIALES'], status: 'En ejecución' }
]

describe('Pañol Etapa 2 — Selector Unificado de Contratista, Borrado de OT y Columna Centro de Costo', () => {
  it('buildPanolContractorSelectModel restringe estrictamente por OT y al expandir muestra catálogo completo marcando los sin OT', () => {
    const strictExt = buildPanolContractorSelectModel({
      shipId: SHIP_ID,
      workOrderId: WO_EXT_ID,
      isExpanded: false,
      astilleroWorkers: AST_WORKERS,
      contractorGroups: CNT_GROUPS,
      workOrders: WORK_ORDERS,
      workItems: WORK_ITEMS
    })
    expect(strictExt.hasScope).toBe(true)
    expect(strictExt.scopeLabel).toBe('OT')
    expect(strictExt.displayed.astilleroWorkers).toEqual([])
    expect(strictExt.displayed.contractorGroups).toEqual(['4RG SERV. INDUSTRIALES'])

    const expandedExt = buildPanolContractorSelectModel({
      shipId: SHIP_ID,
      workOrderId: WO_EXT_ID,
      isExpanded: true,
      astilleroWorkers: AST_WORKERS,
      contractorGroups: CNT_GROUPS,
      workOrders: WORK_ORDERS,
      workItems: WORK_ITEMS
    })
    expect(expandedExt.displayed.astilleroWorkers).toHaveLength(2)
    expect(expandedExt.displayed.contractorGroups).toEqual(['4RG SERV. INDUSTRIALES', 'TANO'])
    expect(expandedExt.enabledCntSet.has('4RG SERV. INDUSTRIALES')).toBe(true)
    expect(expandedExt.enabledCntSet.has('TANO')).toBe(false)
    expect(expandedExt.enabledAstSet.has('CABALLERO, DANIEL EMANUEL')).toBe(false)

    const strictShipNoOt = buildPanolContractorSelectModel({
      shipId: '99999999-9999-4999-8999-999999999999',
      workOrderId: null,
      isExpanded: false,
      astilleroWorkers: AST_WORKERS,
      contractorGroups: CNT_GROUPS,
      workOrders: WORK_ORDERS,
      workItems: WORK_ITEMS
    })
    expect(strictShipNoOt.scopeLabel).toBe('Barco')
    expect(strictShipNoOt.displayed.astilleroWorkers).toEqual([])
    expect(strictShipNoOt.displayed.contractorGroups).toEqual([])
  })

  it('evaluateInlineContractorChange conserva OT si está habilitado y borra OT + work_item si elige contratista no habilitado desde Expandir', () => {
    // 1. Contratista habilitado en OT-5 -> mantiene OT y sincroniza contractor_name/worker_name
    const keepRes = evaluateInlineContractorChange({
      tx: { id: 'tx-1', ship_id: SHIP_ID, work_order_id: WO_EXT_ID, work_item_id: WI_EXT_ID },
      newName: '4RG SERV. INDUSTRIALES',
      astilleroWorkers: AST_WORKERS,
      contractorGroups: CNT_GROUPS,
      workOrders: WORK_ORDERS,
      workItems: WORK_ITEMS,
      workers: ALL_WORKERS
    })
    expect(keepRes.shouldClearOt).toBe(false)
    expect(keepRes.updates).toEqual({
      contractor_name: '4RG SERV. INDUSTRIALES',
      worker_name: '4RG SERV. INDUSTRIALES',
      worker_id: null
    })

    // 2. Contratista NO habilitado en OT-5 elegido vía Expandir -> borra work_order_id y work_item_id
    const clearExtRes = evaluateInlineContractorChange({
      tx: { id: 'tx-2', ship_id: SHIP_ID, work_order_id: WO_EXT_ID, work_item_id: WI_EXT_ID },
      newName: 'TANO',
      astilleroWorkers: AST_WORKERS,
      contractorGroups: CNT_GROUPS,
      workOrders: WORK_ORDERS,
      workItems: WORK_ITEMS,
      workers: ALL_WORKERS
    })
    expect(clearExtRes.shouldClearOt).toBe(true)
    expect(clearExtRes.updates).toEqual({
      contractor_name: 'TANO',
      worker_name: 'TANO',
      worker_id: WORKER_TANO_ID,
      work_order_id: null,
      work_item_id: null
    })

    // 3. Operario de Astillero mantiene OT con ASTILLERO.CALDERERIA y borra OT cuando OT es solo de contratista externo
    const astKeepRes = evaluateInlineContractorChange({
      tx: { id: 'tx-3', ship_id: SHIP_ID, work_order_id: WO_CALD_ID, work_item_id: WI_CALD_ID },
      newName: 'Caballero, Daniel Emanuel',
      astilleroWorkers: AST_WORKERS,
      contractorGroups: CNT_GROUPS,
      workOrders: WORK_ORDERS,
      workItems: WORK_ITEMS,
      workers: ALL_WORKERS
    })
    expect(astKeepRes.shouldClearOt).toBe(false)
    expect(astKeepRes.updates.worker_id).toBe(WORKER_CABALLERO_ID)

    const astClearRes = evaluateInlineContractorChange({
      tx: { id: 'tx-4', ship_id: SHIP_ID, work_order_id: WO_EXT_ID, work_item_id: WI_EXT_ID },
      newName: 'Caballero, Daniel Emanuel',
      astilleroWorkers: AST_WORKERS,
      contractorGroups: CNT_GROUPS,
      workOrders: WORK_ORDERS,
      workItems: WORK_ITEMS,
      workers: ALL_WORKERS
    })
    expect(astClearRes.shouldClearOt).toBe(true)
    expect(astClearRes.updates.work_order_id).toBeNull()
    expect(astClearRes.updates.work_item_id).toBeNull()

    // 4. Fila ya Sin OT -> no marca shouldClearOt ni toca work_order_id
    const noOtRes = evaluateInlineContractorChange({
      tx: { id: 'tx-5', ship_id: SHIP_ID, work_order_id: null, work_item_id: null },
      newName: 'TANO',
      astilleroWorkers: AST_WORKERS,
      contractorGroups: CNT_GROUPS,
      workOrders: WORK_ORDERS,
      workItems: WORK_ITEMS,
      workers: ALL_WORKERS
    })
    expect(noOtRes.shouldClearOt).toBe(false)
    expect('work_order_id' in noOtRes.updates).toBe(false)
    expect(isContractorEnabledForWorkOrder({
      shipId: SHIP_ID,
      workOrderId: WO_EXT_ID,
      contractorName: '4RG SERV. INDUSTRIALES',
      astilleroWorkers: AST_WORKERS,
      contractorGroups: CNT_GROUPS,
      workOrders: WORK_ORDERS,
      workItems: WORK_ITEMS
    })).toBe(true)
  })

  it('getPanolMovimientosColumns excluye cost_center cuando está contraída y la incluye por defecto', () => {
    const collapsedCols = getPanolMovimientosColumns(true, { showCostCenter: false }).map((c) => c.key)
    const expandedCols = getPanolMovimientosColumns(true).map((c) => c.key)
    expect(collapsedCols).toContain('cost_total_usd')
    expect(collapsedCols).not.toContain('cost_center')
    expect(expandedCols).toContain('cost_center')
  })
})
