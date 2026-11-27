import { describe, it, expect } from 'vitest'
import {
  buildResumenNovedadesGroups,
  getBaseContractorGroup,
  getContractorBandStyle,
  resolveContractorHourlyRateArs,
} from '../../src/lib/contractorSettlementHelpers.js'
import {
  buildContratadosSettlementRows,
  computePrcProgress,
  CONTRATADOS_SHEET_COLUMNS,
} from '../../src/lib/contractorSettlementEngine.js'
import { getVisibleNavigationModules } from '../../src/lib/navigationCatalog.js'
import { isRouteAllowed } from '../../src/lib/permissionsEngine.js'

const W_AST_1 = '11111111-1111-4111-8111-111111111111'
const W_RAMON_OF = '22222222-2222-4222-8222-222222222222'
const W_RAMON_AY = '33333333-3333-4333-8333-333333333333'
const W_TALLER_INA = '44444444-4444-4444-8444-444444444444'
const W_4RG = '55555555-5555-4555-8555-555555555555'
const SHIP_1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const WO_1 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const PRC_1 = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'
const PRC_1_ADIC = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd'
const TX_1 = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'

describe('Submódulo privado 4. Resumen Horas (Etapa 4)', () => {
  it('agrupa novedades Astillero (Resumen) por operario y día del mes excluyendo CONTROL', () => {
    const groups = buildResumenNovedadesGroups({
      periodKey: '2026-10-2Q',
      workers: [{ id: W_AST_1, name: 'Caballero, Daniel Emanuel', admin_center: 'ASTILLERO' }],
      laborLogs: [
        { id: 'l1', worker_id: W_AST_1, worker_name: 'Caballero, Daniel Emanuel', date_logged: '2026-10-20T03:00:00.000Z', rubro: 'ENFERMO', work_type: 'HORA', notes: 'Reposo médico' },
        { id: 'l2', worker_id: W_AST_1, worker_name: 'Caballero, Daniel Emanuel', date_logged: '2026-10-16T03:00:00.000Z', rubro: 'ENFERMO', work_type: 'HORA', notes: '' },
        { id: 'l3', worker_id: W_AST_1, worker_name: 'Caballero, Daniel Emanuel', date_logged: '2026-10-19T03:00:00.000Z', rubro: 'Calderería', work_type: 'HORA', notes: 'Trabajo normal' },
        { id: 'l4', worker_id: W_AST_1, worker_name: 'Caballero, Daniel Emanuel', date_logged: '2026-10-21T03:00:00.000Z', rubro: 'ENFERMO', work_type: 'CONTROL', notes: 'Ignorar control' },
      ],
    })
    expect(groups).toHaveLength(1)
    expect(groups[0].novedad).toBe('ENFERMO')
    expect(groups[0].entries.map((e) => e.dayNumber)).toEqual([16, 20])
  })

  it('comparte franja cromática entre Oficial/Ayudante y resuelve tarifas con fallback a rate_cards más reciente', () => {
    expect(getBaseContractorGroup('RAMON ARANDA AYUDANTE')).toBe('RAMON ARANDA')
    expect(getContractorBandStyle('RAMON ARANDA').chipBg).toBe(getContractorBandStyle('RAMON ARANDA AYUDANTE').chipBg)

    const rateCards = [
      { period: '2026-10-1Q', admin_center: 'CONTRATISTA', entity_name: 'RAMON ARANDA', rate_oficial_ars: 17500, has_ayudante: true, rate_ayudante_ars: 13500 },
      { period: '2026-09-2Q', admin_center: 'CONTRATISTA', entity_name: 'RAMON ARANDA', rate_oficial_ars: 16500, has_ayudante: true, rate_ayudante_ars: 12500 },
    ]
    expect(resolveContractorHourlyRateArs({ contractorLabel: 'RAMON ARANDA', rateCards, periodKey: '2026-11-2Q' })).toBe(17500)
    expect(resolveContractorHourlyRateArs({ contractorLabel: 'RAMON ARANDA AYUDANTE', rateCards, periodKey: '2026-11-2Q' })).toBe(13500)
  })

  it('calcula % AVANCE PRC con adicionales activos y controla división por cero', () => {
    expect(computePrcProgress({ prcTotalArs: 5000000, hourlyRateArs: 20000, cumulativeHours: 125 })).toEqual({
      estimatedHours: 250,
      progressPct: 50,
    })
    expect(computePrcProgress({ prcTotalArs: 5000000, hourlyRateArs: 0, cumulativeHours: 50 })).toEqual({
      estimatedHours: 0,
      progressPct: null,
    })
  })

  it('construye las 14 columnas de Contratados excluyendo CONTROL/ASTILLERO/INA PANTOGRAFO y sin doble conteo Pañol', () => {
    expect(CONTRATADOS_SHEET_COLUMNS.map((c) => c.label)).toEqual([
      'CONTRATISTA', 'CLIENTE', 'ORDEN TRABAJO', 'TIPO TRABAJO', 'Nº PRC',
      'HORAS', '$/h', 'Importe a pagar', 'MATERIALES', 'ANTICIPOS',
      'A PAGAR', 'AVANCE PRC', 'ESTADO PRC', 'OBSERVACIONES',
    ])

    const res = buildContratadosSettlementRows({
      periodKey: '2026-11-2Q',
      ships: [{ id: SHIP_1, name: 'NONO PASCUAL' }],
      workOrders: [{ id: WO_1, ship_id: SHIP_1, ot_number: 'OT-3', title: 'CAMBIO CHAPA' }],
      workers: [
        { id: W_AST_1, name: 'Alanis, Carlos', admin_center: 'ASTILLERO', hourly_rate_ars: 16000 },
        { id: W_RAMON_OF, name: 'RAMON ARANDA', work_group: 'RAMON ARANDA', admin_center: 'CONTRATISTA', hourly_rate_ars: 18000 },
        { id: W_RAMON_AY, name: 'RAMON ARANDA AYUDANTE', work_group: 'RAMON ARANDA AYUDANTE', admin_center: 'CONTRATISTA', category: 'AYUDANTE', hourly_rate_ars: 14000 },
        { id: W_TALLER_INA, name: 'INA PANTOGRAFO', work_group: 'INA PANTOGRAFO', admin_center: 'TALLER', hourly_rate_ars: 0 },
        { id: W_4RG, name: 'AGOUTBORDE OMAR', work_group: '4RG SERV. INDUSTRIALES', admin_center: 'CONTRATISTA', hourly_rate_ars: 18500 },
      ],
      rateCards: [
        { period: '2026-10-1Q', admin_center: 'CONTRATISTA', entity_name: '4RG SERV. INDUSTRIALES', rate_oficial_ars: 18500, has_ayudante: false },
      ],
      prcs: [
        { id: PRC_1, prc_number: 2000, contractor_name: '4RG SERV. INDUSTRIALES', ship_id: SHIP_1, work_order_id: WO_1, amount_ars: 3000000, status: 'ACTIVO' },
        { id: PRC_1_ADIC, prc_number: 2001, parent_prc_id: PRC_1, contractor_name: '4RG SERV. INDUSTRIALES', ship_id: SHIP_1, work_order_id: WO_1, amount_ars: 700000, status: 'ACTIVO' },
      ],
      ccAccounts: [
        { id: 'cc1', worker_id: W_TALLER_INA, operational_name: 'INA PANTOGRAFO', legal_name: 'PAMPA NAVAL', is_active: true },
      ],
      laborLogs: [
        { id: 'h1', worker_id: W_AST_1, worker_type: 'Astillero', date_logged: '2026-11-20', hours_worked: 9, work_type: 'HORA' },
        { id: 'h2', worker_id: W_RAMON_OF, worker_type: 'Contratista', ship_id: SHIP_1, work_order_id: WO_1, date_logged: '2026-11-20', hours_worked: 10, work_type: 'HORA' },
        { id: 'h3', worker_id: W_RAMON_OF, worker_type: 'Contratista', ship_id: SHIP_1, work_order_id: WO_1, date_logged: '2026-11-21', hours_worked: 99, work_type: 'CONTROL' },
        { id: 'h4', worker_id: W_TALLER_INA, worker_type: 'Taller', ship_id: SHIP_1, work_order_id: WO_1, date_logged: '2026-11-21', hours_worked: 20, work_type: 'HORA' },
        { id: 'h5', worker_id: W_4RG, worker_type: 'Contratista', ship_id: SHIP_1, work_order_id: WO_1, date_logged: '2026-11-22', hours_worked: 40, work_type: 'PRESUPUESTO' },
      ],
      ccMovements: [
        { id: 'm1', period_key: '2026-11-2Q', contractor_group: 'RAMON ARANDA', category: 'RTO_PANOL', direction: 'DEBE', amount_ars: 30000, inventory_transaction_ids: [TX_1] },
        { id: 'm2', period_key: '2026-11-2Q', contractor_group: 'RAMON ARANDA', category: 'ADELANTO', direction: 'DEBE', amount_ars: 50000 },
        { id: 'm3', period_key: '2026-11-2Q', contractor_group: '4RG SERV. INDUSTRIALES', prc_id: PRC_1, category: 'ADELANTO', direction: 'DEBE', amount_ars: 1000000 },
      ],
      deductionsData: {
        fortnightDollarRate: 1500,
        summaryByContractor: [
          {
            contractorLabel: 'RAMON ARANDA',
            items: [
              // TX_1 ya absorbido arriba -> NO debe duplicarse; queda TX_2 por 20.000
              { id: TX_1, classification: { bucket: 'CONSUMABLES_CONTRACTOR', deductArs: 30000, deductUsd: 20 } },
              { id: 'ffffffff-ffff-4fff-8fff-ffffffffffff', classification: { bucket: 'CONSUMABLES_CONTRACTOR', deductArs: 20000, deductUsd: 13.33 } },
            ],
          },
        ],
      },
      closures: [{ period_key: '2026-11-2Q', row_key: 'RAMON ARANDA|aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa|HORA', observations: 'Pagado jueves' }],
    })

    expect(res.rows).toHaveLength(2) // Excluyó ASTILLERO, CONTROL e INA PANTOGRAFO
    const r4rg = res.rows.find((r) => r.contractorLabel === '4RG SERV. INDUSTRIALES')
    const rRamon = res.rows.find((r) => r.contractorLabel === 'RAMON ARANDA')

    expect(r4rg.prcDisplay).toBe('PRC #2000')
    expect(r4rg.grossArs).toBe(3700000) // 3M + 700k adicional
    expect(r4rg.advancesArs).toBe(1000000)
    expect(r4rg.netPayableArs).toBe(2700000)
    expect(r4rg.progressPct).toBe(20) // 40 hs / (3.700.000 / 18.500 = 200 hs) = 20.0%

    expect(rRamon.hours).toBe(10) // Excluyó las 99hs de CONTROL
    expect(rRamon.grossArs).toBe(180000)
    expect(rRamon.materialsArs).toBe(50000) // 30k ya en CC + 20k pendiente Pañol (sin duplicar TX_1)
    expect(rRamon.advancesArs).toBe(50000)
    expect(rRamon.netPayableArs).toBe(80000)
    expect(rRamon.observations).toBe('Pagado jueves')
  })

  it('respeta snapshot inmutable CERRADO y oculta 4. Resumen Horas a puestos no autorizados', () => {
    const closed = buildContratadosSettlementRows({
      periodKey: '2026-11-2Q',
      closures: [{
        id: 'snap1',
        period_key: '2026-11-2Q',
        row_key: '__PERIOD_SNAPSHOT__',
        status: 'CERRADO',
        snapshot_json: { rows: [{ rowKey: 'k1', contractorLabel: 'TANO', netPayableArs: 500000 }], totals: { totalNetPayableArs: 500000 }, dollarRate: 1550 },
      }],
    })
    expect(closed.isClosed).toBe(true)
    expect(closed.rows[0].netPayableArs).toBe(500000)
    expect(closed.fortnightDollarRate).toBe(1550)

    const jefeHoras = getVisibleNavigationModules({ allowedSections: ['dashboard', 'horas'] }).find((m) => m.id === 'horas')
    expect(jefeHoras.children.some((c) => c.id === 'resumen_horas')).toBe(false)
    expect(isRouteAllowed('/horas', 'resumen_horas', { orgRole: { role_key: 'TESORERIA', security_level: 'AUDITOR', allowed_sections: ['horas.sabana_quincenal'] } }).allowed).toBe(false)
  })
})
