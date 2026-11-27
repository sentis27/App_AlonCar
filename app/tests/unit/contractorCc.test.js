import { describe, it, expect } from 'vitest'
import { validatePayload } from '../../src/schemas/index.js'
import {
  ContractorCcMovementSchema,
  ContractorSettlementClosureSchema,
} from '../../src/schemas/contractorCc.schema.js'
import {
  buildPendingPanolBatches,
  collectAbsorbedPanolTxIds,
  enrichContractorCcMovements,
  filterContractorCcRows,
  summarizeContractorCcRows,
} from '../../src/lib/contractorCcRules.js'
import { buildPrcLookupMaps } from '../../src/lib/prcRegistryRules.js'
import { getVisibleNavigationModules, resolveModuleTab } from '../../src/lib/navigationCatalog.js'
import { isRouteAllowed, resolveUserCapabilities } from '../../src/lib/permissionsEngine.js'

const TX_1 = '11111111-1111-4111-8111-111111111111'
const TX_2 = '22222222-2222-4222-8222-222222222222'
const TX_3 = '33333333-3333-4333-8333-333333333333'
const PRC_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const MV_1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'

describe('Cuenta Corriente & Pagos de Contratistas (Etapa 3)', () => {
  it('valida esquemas Zod de movimientos CC y cierres, bloqueando columnas trampa', () => {
    const okMv = validatePayload(ContractorCcMovementSchema, {
      movement_date: '2026-11-27',
      period_key: '2026-11-2Q',
      contractor_group: 'TANO',
      category: 'ADELANTO',
      direction: 'DEBE',
      payment_method: 'ECHEQ',
      payment_reference: 'eCheq #1024',
      invoice_status: 'DEBE_FACTURA',
      amount_ars: 500000,
    })
    expect(okMv.success).toBe(true)

    const badPeriod = validatePayload(ContractorCcMovementSchema, {
      movement_date: '2026-11-27',
      period_key: 'NOV-2026',
      contractor_group: 'TANO',
      category: 'ADELANTO',
      amount_ars: 100,
    })
    expect(badPeriod.success).toBe(false)

    const trapMv = validatePayload(ContractorCcMovementSchema, {
      movement_date: '2026-11-27',
      period_key: '2026-11-2Q',
      contractor_group: 'TANO',
      category: 'ADELANTO',
      notes: 'trampa',
      monto: 500,
    })
    expect(trapMv.success).toBe(false)
    expect(trapMv.error).toContain('notes')

    const okClosure = validatePayload(ContractorSettlementClosureSchema, {
      period_key: '2026-11-2Q',
      contractor_group: '4RG SERV. INDUSTRIALES',
      row_key: '4RG|ASTILLERO|PRC-2000',
      hours_total: 42,
      gross_ars: 2500000,
      net_payable_ars: 2100000,
      status: 'CERRADO',
    })
    expect(okClosure.success).toBe(true)
  })

  it('calcula retiros de Pañol pendientes con bloqueo anti-duplicado 1-clic', () => {
    const deductionsData = {
      fortnightDollarRate: 1500,
      summaryByContractor: [
        {
          contractorLabel: 'TANO',
          items: [
            { id: TX_1, classification: { bucket: 'CONSUMABLES_CONTRACTOR', deductArs: 30000, deductUsd: 20 } },
            { id: TX_2, classification: { bucket: 'SAFETY_CONTRACTOR_DEDUCTION', deductArs: 45000, deductUsd: 30 } },
          ],
        },
        {
          contractorLabel: '4RG SERV. INDUSTRIALES',
          items: [
            { id: TX_3, classification: { bucket: 'CONSUMABLES_CONTRACTOR', deductArs: 15000, deductUsd: 10 } },
          ],
        },
      ],
    }

    // Antes de absorber nada: 2 contratistas pendientes (TANO AR$ 75.000, 4RG AR$ 15.000)
    const initial = buildPendingPanolBatches(deductionsData, [])
    expect(initial.pendingContractorsCount).toBe(2)
    expect(initial.pendingTotalArs).toBe(90000)
    expect(initial.pendingBatches[0].pendingTxIds).toEqual([TX_1, TX_2])

    // Se absorben TX_1 y TX_2 en un movimiento RTO_PANOL -> TANO queda 100% absorbido
    const movementsAfterTano = [
      { id: MV_1, category: 'RTO_PANOL', contractor_group: 'TANO', inventory_transaction_ids: [TX_1, TX_2] },
    ]
    expect(collectAbsorbedPanolTxIds(movementsAfterTano).has(TX_1)).toBe(true)
    const afterTano = buildPendingPanolBatches(deductionsData, movementsAfterTano)
    expect(afterTano.pendingContractorsCount).toBe(1)
    expect(afterTano.pendingBatches[0].contractorLabel).toBe('4RG SERV. INDUSTRIALES')
    expect(afterTano.totalAlreadyAbsorbedCount).toBe(2)
  })

  it('enriquece PRCs #2000+, resume DEBE/HABER y filtra DEBE_FACTURA', () => {
    const prcMaps = buildPrcLookupMaps([
      { id: PRC_1, prc_number: 2000, contractor_name: 'TANO', amount_ars: 3000000, status: 'ACTIVO' },
    ])
    const enriched = enrichContractorCcMovements(
      [
        {
          id: 'm1', movement_date: '2026-11-26', period_key: '2026-11-2Q', contractor_group: 'TANO',
          settlement_scope: 'PRESUPUESTO', prc_id: PRC_1, category: 'DEVENGADO_PRC', direction: 'HABER',
          invoice_status: 'CON_FACTURA', invoice_number: 'A-0001-00001234', amount_ars: 3000000,
        },
        {
          id: 'm2', movement_date: '2026-11-27', period_key: '2026-11-2Q', contractor_group: 'TANO',
          settlement_scope: 'PRESUPUESTO', prc_id: PRC_1, category: 'ADELANTO', direction: 'DEBE',
          payment_method: 'ECHEQ', payment_reference: 'eCheq #889', invoice_status: 'DEBE_FACTURA', amount_ars: 1000000,
        },
        {
          id: 'm3', movement_date: '2026-11-10', period_key: '2026-11-1Q', contractor_group: '4RG SERV. INDUSTRIALES',
          settlement_scope: 'HORA', category: 'RTO_PANOL', direction: 'DEBE', invoice_status: 'NO_APLICA', amount_ars: 250000,
        },
      ],
      { prcMaps }
    )

    expect(enriched[0].prcDisplay).toBe('PRC #2000')
    expect(enriched[0].haberArs).toBe(3000000)
    expect(enriched[1].debeArs).toBe(1000000)

    const q2Rows = filterContractorCcRows(enriched, { onlyCurrentPeriod: true, currentPeriod: '2026-11-2Q' })
    expect(q2Rows).toHaveLength(2)
    const sum = summarizeContractorCcRows(q2Rows)
    expect(sum.totalHaberArs).toBe(3000000)
    expect(sum.totalDebeArs).toBe(1000000)
    expect(sum.netBalanceArs).toBe(2000000)
    expect(sum.debeFacturaCount).toBe(1)

    const onlyDebtInv = filterContractorCcRows(enriched, { onlyCurrentPeriod: false, onlyDebeFactura: true })
    expect(onlyDebtInv.map((r) => r.id)).toEqual(['m2'])
  })

  it('habilita submódulos acordeón en /tesoreria exclusivamente para puestos autorizados', () => {
    const gracielaRole = {
      role_key: 'TESORERIA',
      security_level: 'AUDITOR',
      allowed_sections: ['dashboard', 'tesoreria', 'terceros', 'terceros.base_prc'],
    }
    const nav = getVisibleNavigationModules({ allowedSections: gracielaRole.allowed_sections })
    const tesMod = nav.find((m) => m.id === 'tesoreria')
    expect(tesMod.children.map((c) => c.id)).toEqual(['deducciones', 'movimientos'])
    expect(resolveModuleTab('tesoreria', null)).toBe('deducciones')
    expect(resolveModuleTab('tesoreria', 'pagos')).toBe('movimientos')
    expect(isRouteAllowed('/tesoreria', 'movimientos', { orgRole: gracielaRole }).allowed).toBe(true)
    expect(resolveUserCapabilities(null, gracielaRole).canManageContractorCc).toBe(true)
  })
})
