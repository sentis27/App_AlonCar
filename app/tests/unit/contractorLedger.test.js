import { describe, it, expect } from 'vitest'
import {
  RESUMEN_TAB_ID,
  buildContractorEntitiesList,
  buildContratadosKpiCards,
  parseInlineConceptSmart,
} from '../../src/lib/contractorLedgerHelpers.js'
import { buildContractorBook, filterBookRowsAndCrossMatches } from '../../src/lib/contractorLedgerEngine.js'

describe('Libro de Cuenta Corriente por Contratista y Barcos (3. Contratados)', () => {
  const ships = [
    { id: 'ship-triton', name: 'TRITON' },
    { id: 'ship-caliz', name: 'CALIZ' },
    { id: 'ship-vuoso', name: 'DON VICENTE VUOSO' },
  ]

  it('arma padrón unificado separando talleres FL-026 en US$ de contratistas en AR$', () => {
    const workers = [
      { id: 'w-aldo', name: 'ALDO COBRANA', work_group: 'ALDO COBRANA', admin_center: 'CONTRATISTA', status: 'ACTIVO' },
      { id: 'w-pampa', name: 'INA PANTOGRAFO', work_group: 'INA PANTOGRAFO', admin_center: 'TALLER', status: 'ACTIVO' },
      { id: 'w-own', name: 'OPERARIO PROPIO', work_group: 'ASTILLERO', admin_center: 'ASTILLERO', status: 'ACTIVO' },
    ]
    const ccAccounts = [{ id: 'acc-pampa', worker_id: 'w-pampa', operational_name: 'INA PANTOGRAFO', legal_name: 'PAMPA NAVAL', is_active: true }]
    const entities = buildContractorEntitiesList({ workers, ccAccounts })
    expect(entities.some((e) => e.entityType === 'WORKSHOP_CC' && e.currency === 'USD')).toBe(true)
    expect(entities.some((e) => e.entityType === 'CONTRACTOR' && e.baseGroup === 'ALDO COBRANA')).toBe(true)
    expect(entities.some((e) => e.baseGroup === 'ASTILLERO' || (e.entityType === 'CONTRACTOR' && e.baseGroup === 'INA PANTOGRAFO'))).toBe(false)
  })

  it('replica paridad exacta de ALDO COBRANA en solapas por barco y RESUMEN agrupado/cronológico', () => {
    const entity = { id: 'CONTR:ALDO COBRANA', entityType: 'CONTRACTOR', baseGroup: 'ALDO COBRANA', label: 'ALDO COBRANA', currency: 'ARS' }
    const prcs = [
      { id: 'prc-1', prc_number: 2001, contractor_name: 'ALDO COBRANA', ship_id: 'ship-triton', issue_date: '2026-07-31', description: 'cubierta madera', amount_ars: 7000000, status: 'TERMINADO' },
      { id: 'prc-2', prc_number: 2002, contractor_name: 'ALDO COBRANA', ship_id: 'ship-caliz', issue_date: '2026-08-04', description: 'cubierta madera', amount_ars: 1000000, status: 'TERMINADO' },
      { id: 'prc-3', prc_number: 2003, contractor_name: 'ALDO COBRANA', ship_id: 'ship-caliz', issue_date: '2026-08-04', description: 'adicional', amount_ars: 200000, status: 'TERMINADO', parent_prc_id: 'prc-2' },
    ]
    const movements = [
      { id: 'm1', movement_date: '2026-08-26', period_key: '2026-08-2Q', contractor_group: 'ALDO COBRANA', ship_id: 'ship-triton', direction: 'DEBE', category: 'ADELANTO', payment_method: 'TRANSFERENCIA', amount_ars: 1000000 },
      { id: 'm2', movement_date: '2026-09-30', period_key: '2026-09-2Q', contractor_group: 'ALDO COBRANA', ship_id: 'ship-triton', direction: 'DEBE', category: 'RTO_PANOL', payment_method: 'COMPENSACION_PANOL', panol_remito_number: '1962', amount_ars: 29192.4 },
      { id: 'm3', movement_date: '2026-10-09', period_key: '2026-10-1Q', contractor_group: 'ALDO COBRANA', ship_id: 'ship-triton', direction: 'DEBE', category: 'PAGO_FINAL', payment_method: 'CHEQUE', payment_reference: 'CH 695/696', amount_ars: 5970807.6 },
      { id: 'm4', movement_date: '2026-08-20', period_key: '2026-08-2Q', contractor_group: 'ALDO COBRANA', ship_id: 'ship-caliz', direction: 'DEBE', category: 'PAGO_FINAL', payment_method: 'TRANSFERENCIA', amount_ars: 1200000, invoice_status: 'DEBE_FACTURA' },
    ]

    const grouped = buildContractorBook({ entity, movements, prcs, ships, resumenSortMode: 'grouped' })
    const chrono = buildContractorBook({ entity, movements, prcs, ships, resumenSortMode: 'chronological' })
    expect(grouped.globalKpis.totalAccrued).toBe(8200000)
    expect(grouped.globalKpis.currentBalance).toBe(0)
    expect(chrono.globalKpis.currentBalance).toBe(0)
    expect(grouped.shipTabs.every((t) => t.isSettled)).toBe(true)

    const cross = filterBookRowsAndCrossMatches({ activeTabId: 'ship-triton', rowsByTab: grouped.rowsByTab, shipTabs: grouped.shipTabs, searchTerm: 'caliz' })
    expect(cross.crossTabMatches.some((c) => c.tabId === 'ship-caliz')).toBe(true)
    const cards = buildContratadosKpiCards({ tabKpis: grouped.globalKpis, activeTabLabel: 'RESUMEN', currency: 'ARS' })
    expect(cards.find((c) => c.id === 'debe_factura')?.count).toBe(1)
  })

  it('evita duplicar horas en vivo cuando existe DEVENGADO_QUINCENA y conecta talleres FL-026 en US$', () => {
    const contr = { id: 'CONTR:TANO', entityType: 'CONTRACTOR', baseGroup: 'TANO', label: 'TANO', currency: 'ARS' }
    const workers = [{ id: 'w-tano', name: 'TANO', work_group: 'TANO', admin_center: 'CONTRATISTA', hourly_rate_ars: 10000, status: 'ACTIVO' }]
    const laborLogs = [{ id: 'l1', worker_id: 'w-tano', worker_name: 'TANO', work_type: 'HORA', ship_id: 'ship-vuoso', hours_worked: 10, date_logged: '2026-11-10' }]
    const movements = [{ id: 'cc-q', movement_date: '2026-11-15', period_key: '2026-11-1Q', contractor_group: 'TANO', ship_id: 'ship-vuoso', direction: 'HABER', category: 'DEVENGADO_QUINCENA', amount_ars: 100000 }]
    const book = buildContractorBook({ entity: contr, workers, laborLogs, movements, ships })
    expect(book.globalKpis.totalAccrued).toBe(100000)
    expect(book.rowsByTab[RESUMEN_TAB_ID].length).toBe(1)

    const wsEntity = {
      id: 'WORKSHOP:acc-1',
      entityType: 'WORKSHOP_CC',
      baseGroup: 'INA PANTOGRAFO',
      label: 'PAMPA NAVAL (INA PANTOGRAFO)',
      currency: 'USD',
      ccAccount: { id: 'acc-1', worker_id: 'w-pampa', operational_name: 'INA PANTOGRAFO', legal_name: 'PAMPA NAVAL', pricing_mode: 'PER_KG', current_rate_usd: 1.25, opening_balance_usd: 0, material_categories: ['MATERIALES'] },
    }
    const wsBook = buildContractorBook({
      entity: wsEntity,
      ships,
      thirdPartyCcData: {
        rateHistory: [{ id: 'rh-1', account_id: 'acc-1', effective_from: '2026-01-01', rate_usd_per_kg: 1.25 }],
        savedEntries: [],
        payments: [{ id: 'pay-1', account_id: 'acc-1', payment_date: '2026-11-10', payment_type: 'EFECTIVO_USD', amount_usd: 500, source_module: 'TESORERIA' }],
        panolRemitoTx: [{ id: 'tx-1', worker_id: 'w-pampa', material_id: 'mat-1', ship_id: 'ship-vuoso', voucher_number: '9001', quantity_withdrawn: 10, weight_total: 1000, transaction_date: '2026-11-05' }],
        materials: [{ id: 'mat-1', name: 'Chapa', category: 'MATERIALES', weight_kg: 100 }],
        thirdPartyServices: [],
        workOrders: [],
        ships,
      },
    })
    expect(wsBook.globalKpis.totalAccrued).toBe(1250)
    expect(wsBook.globalKpis.totalPaidAll).toBe(500)
    expect(wsBook.globalKpis.currentBalance).toBe(-750)
  })

  it('infiere método de pago y remito desde texto rápido inline (+ Fila en Blanco)', () => {
    expect(parseInlineConceptSmart('ch 0664')).toMatchObject({ category: 'ADELANTO', payment_method: 'CHEQUE' })
    expect(parseInlineConceptSmart('remito pañol 1962')).toMatchObject({ category: 'RTO_PANOL', payment_method: 'COMPENSACION_PANOL', panol_remito_number: '1962' })
    expect(parseInlineConceptSmart('transferencia')).toMatchObject({ category: 'ADELANTO', payment_method: 'TRANSFERENCIA' })
  })
})
