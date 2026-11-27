import { describe, it, expect } from 'vitest'
import {
  getQuincenaKeyFromDate,
  getPreviousQuincenaKey,
  getQuincenaRangeAr,
  listRecentQuincenaOptions,
  resolveContractorEntity,
  buildCostControlSnapshot,
  computeDailyHoursSplitSummary,
} from '../../src/lib/costControlEngine.js'
import {
  buildMaterialExceptionReviewKey,
  buildLaborOnlyApprovalReviewKey,
} from '../../src/schemas/costControl.schema.js'
import { getVisibleNavigationModules } from '../../src/lib/navigationCatalog.js'
import { isRouteAllowed } from '../../src/lib/permissionsEngine.js'

const SHIP_A = '11111111-1111-4111-8111-111111111111'
const SHIP_B = '22222222-2222-4222-8222-222222222222'
const WO_A_SALA = '33333333-3333-4333-8333-333333333331'
const WO_B_SALA = '33333333-3333-4333-8333-333333333332'
const WO_A_CUBIERTA = '33333333-3333-4333-8333-333333333333'
const WO_A_CHAPA = '33333333-3333-4333-8333-333333333334'
const WO_OFICINA = '33333333-3333-4333-8333-333333333335'
const W_RAMON = '44444444-4444-4444-8444-444444444441'
const W_PROPIO = '44444444-4444-4444-8444-444444444442'
const W_CORMETAL = '44444444-4444-4444-8444-444444444443'
const MAT_1 = '55555555-5555-4555-8555-555555555551'

describe('costControlEngine — Quincenas Argentina y entidad contratista (Etapa 2)', () => {
  it('calcula quincenas y rangos en UTC-3 incluyendo salto enero -> diciembre', () => {
    expect(getQuincenaKeyFromDate('2026-11-15')).toBe('2026-11-1Q')
    expect(getQuincenaKeyFromDate('2026-11-16T22:30:00-03:00')).toBe('2026-11-2Q')
    // 2026-12-01 01:30 UTC corresponde al 30/11 22:30 en Argentina
    expect(getQuincenaKeyFromDate('2026-12-01T01:30:00Z')).toBe('2026-11-2Q')

    expect(getPreviousQuincenaKey('2026-11-2Q')).toBe('2026-11-1Q')
    expect(getPreviousQuincenaKey('2026-01-1Q')).toBe('2025-12-2Q')

    expect(getQuincenaRangeAr('2026-11-2Q')).toEqual({
      periodKey: '2026-11-2Q',
      label: '2DA nov 2026',
      year: 2026,
      month: 11,
      quincena: 2,
      startDate: '2026-11-16',
      endDate: '2026-11-30',
      startIsoAr: '2026-11-16T00:00:00-03:00',
      endIsoAr: '2026-11-30T23:59:59-03:00',
    })
    expect(listRecentQuincenaOptions(3, new Date('2026-11-20T12:00:00-03:00')).map((o) => o.key)).toEqual([
      '2026-11-2Q',
      '2026-11-1Q',
      '2026-10-2Q',
    ])
  })

  it('agrupa personal propio como ASTILLERO y detecta can_impute_hours=false', () => {
    const workers = [
      { id: W_PROPIO, name: 'Toledo, Luciano', work_group: 'ASTILLERO', can_impute_hours: true },
      { id: W_RAMON, name: 'RAMON ARANDA', work_group: 'RAMON ARANDA', can_impute_hours: false },
      { id: '44444444-4444-4444-8444-444444444444', name: 'JULIO ARANDA', work_group: 'RAMON ARANDA', can_impute_hours: true },
      { id: W_CORMETAL, name: 'CORMETAL', work_group: 'CORMETAL', can_impute_hours: false, can_charge_third_party: true },
    ]
    expect(resolveContractorEntity({ workerId: W_PROPIO }, workers)).toMatchObject({ entity: 'ASTILLERO', canImputeHours: true })
    expect(resolveContractorEntity({ workerName: 'RAMON ARANDA' }, workers)).toMatchObject({ entity: 'RAMON ARANDA', canImputeHours: true })
    expect(resolveContractorEntity({ workerName: 'JULIO ARANDA' }, workers)).toMatchObject({ entity: 'RAMON ARANDA', canImputeHours: true })
    expect(resolveContractorEntity({ workerId: W_CORMETAL }, workers)).toMatchObject({ entity: 'CORMETAL', canImputeHours: false })
  })

  it('unifica por work_group real (ej. TANO cabecera hrs=false + operario hrs=true concilia OK; taller puro pasa a terceros)', () => {
    const W_TANO_HEAD = '44444444-4444-4444-8444-444444444451'
    const W_TANO_OPER = '44444444-4444-4444-8444-444444444452'
    const W_TANO_WORKERS = [
      { id: W_TANO_HEAD, name: 'TANO', work_group: 'TANO', admin_center: 'CONTRATISTA', can_impute_hours: false },
      { id: W_TANO_OPER, name: 'SAMUEL DANGIOLO', work_group: 'TANO', admin_center: 'CONTRATISTA', can_impute_hours: true },
      { id: W_CORMETAL, name: 'CORMETAL', work_group: 'CORMETAL', admin_center: 'TALLER', can_impute_hours: false, can_charge_third_party: true },
    ]
    const snap = buildCostControlSnapshot({
      periodKey: '2026-11-2Q',
      ships: [{ id: SHIP_A, name: 'NONO PASCUAL' }],
      workOrders: [{ id: WO_A_CHAPA, ship_id: SHIP_A, ot_number: 'OT-3', title: 'CAMBIO CHAPA' }],
      materials: [{ id: MAT_1, name: 'Disco 7', unit_measure: 'u' }],
      workers: W_TANO_WORKERS,
      transactions: [
        { id: '66666666-6666-4666-8666-666666666691', material_id: MAT_1, ship_id: SHIP_A, work_order_id: WO_A_CHAPA, worker_id: W_TANO_HEAD, worker_name: 'TANO', quantity_withdrawn: 2, transaction_date: '2026-11-18T12:00:00Z' },
        { id: '66666666-6666-4666-8666-666666666692', material_id: MAT_1, ship_id: SHIP_A, work_order_id: WO_A_CHAPA, worker_id: W_CORMETAL, worker_name: 'CORMETAL', quantity_withdrawn: 1, transaction_date: '2026-11-18T12:00:00Z' },
      ],
      laborLogs: [
        { id: '77777777-7777-4777-8777-777777777791', worker_id: W_TANO_OPER, worker_name: 'SAMUEL DANGIOLO', ship_id: SHIP_A, work_order_id: WO_A_CHAPA, date_logged: '2026-11-18', hours_worked: 8 },
      ],
    })
    expect(snap.materialRows).toHaveLength(1)
    expect(snap.materialRows[0]).toMatchObject({ entity: 'TANO', status: 'OK' })
    expect(snap.thirdPartyMaterialRows).toHaveLength(1)
    expect(snap.thirdPartyMaterialRows[0].entity).toBe('CORMETAL')
  })
})

describe('costControlEngine — Cruce línea por línea, pistas y desdoble (Etapa 2)', () => {
  const ships = [
    { id: SHIP_A, name: 'LA SANTA MARIA I' },
    { id: SHIP_B, name: 'DON ANTONIO' },
  ]
  const workOrders = [
    { id: WO_A_SALA, ship_id: SHIP_A, ot_number: '101', title: 'SALA DE MAQUINAS' },
    { id: WO_B_SALA, ship_id: SHIP_B, ot_number: '201', title: 'SALA DE MAQUINAS' },
    { id: WO_A_CUBIERTA, ship_id: SHIP_A, ot_number: '102', title: 'CUBIERTA' },
    { id: WO_A_CHAPA, ship_id: SHIP_A, ot_number: '103', title: 'CAMBIOS DE CHAPA' },
    { id: WO_OFICINA, ship_id: SHIP_A, ot_number: '999', title: 'OFICINA' },
  ]
  const workers = [
    { id: W_RAMON, name: 'RAMON ARANDA', work_group: 'CONTRATISTA', can_impute_hours: true },
    { id: W_PROPIO, name: 'Toledo, Luciano', work_group: 'ASTILLERO', can_impute_hours: true },
    { id: W_CORMETAL, name: 'CORMETAL', work_group: 'TERCEROS', can_impute_hours: false, can_charge_third_party: true },
  ]
  const materials = [{ id: MAT_1, name: 'Electrodo E7018', unit_measure: 'kg' }]

  it('mantiene granularidad línea por línea, detecta error de barco, quincena anterior, excepciones y terceros', () => {
    const txNo1 = '66666666-6666-4666-8666-666666666601'
    const txNo2 = '66666666-6666-4666-8666-666666666602'
    const txPrev = '66666666-6666-4666-8666-666666666603'
    const txExc = '66666666-6666-4666-8666-666666666604'
    const txOk = '66666666-6666-4666-8666-666666666605'
    const txOfic = '66666666-6666-4666-8666-666666666606'
    const txTp = '66666666-6666-4666-8666-666666666607'

    const transactions = [
      { id: txNo1, material_id: MAT_1, ship_id: SHIP_A, work_order_id: WO_A_SALA, worker_id: W_RAMON, quantity_withdrawn: 5, transaction_date: '2026-11-19T14:00:00Z', voucher_number: 'V-1' },
      { id: txNo2, material_id: MAT_1, ship_id: SHIP_A, work_order_id: WO_A_SALA, worker_id: W_RAMON, quantity_withdrawn: 3, transaction_date: '2026-11-19T15:00:00Z', voucher_number: 'V-2' },
      { id: txPrev, material_id: MAT_1, ship_id: SHIP_A, work_order_id: WO_A_CUBIERTA, worker_id: W_RAMON, quantity_withdrawn: 2, transaction_date: '2026-11-16T12:00:00Z', voucher_number: 'V-3' },
      { id: txExc, material_id: MAT_1, ship_id: SHIP_A, work_order_id: WO_A_CUBIERTA, worker_id: W_PROPIO, quantity_withdrawn: 1, transaction_date: '2026-11-18T12:00:00Z', voucher_number: 'V-4' },
      { id: txOk, material_id: MAT_1, ship_id: SHIP_B, work_order_id: WO_B_SALA, worker_id: W_RAMON, quantity_withdrawn: 4, transaction_date: '2026-11-19T13:00:00Z', voucher_number: 'V-5' },
      { id: txOfic, material_id: MAT_1, ship_id: SHIP_A, work_order_id: WO_OFICINA, worker_id: W_PROPIO, quantity_withdrawn: 1, transaction_date: '2026-11-19T13:00:00Z', voucher_number: 'V-6' },
      { id: txTp, material_id: MAT_1, ship_id: SHIP_A, work_order_id: WO_A_SALA, worker_id: W_CORMETAL, quantity_withdrawn: 2, transaction_date: '2026-11-19T13:00:00Z', voucher_number: 'V-7' },
    ]
    const laborLogs = [
      // Ramon en 2Q hizo SALA DE MAQUINAS en SHIP_B (genera match OK para V-5 y pista de barco para V-1/V-2)
      { id: '77777777-7777-4777-8777-777777777701', worker_id: W_RAMON, worker_name: 'RAMON ARANDA', ship_id: SHIP_B, work_order_id: WO_B_SALA, date_logged: '2026-11-19', hours_worked: 8 },
      // Ramon en 1Q hizo CUBIERTA en SHIP_A (genera pista quincena anterior para V-3)
      { id: '77777777-7777-4777-8777-777777777702', worker_id: W_RAMON, worker_name: 'RAMON ARANDA', ship_id: SHIP_A, work_order_id: WO_A_CUBIERTA, date_logged: '2026-11-15', hours_worked: 6 },
      // Horas sin materiales en 2Q (ASTILLERO en CAMBIOS DE CHAPA)
      { id: '77777777-7777-4777-8777-777777777703', worker_id: W_PROPIO, worker_name: 'Toledo, Luciano', ship_id: SHIP_A, work_order_id: WO_A_CHAPA, date_logged: '2026-11-20', hours_worked: 9 },
    ]
    const reviews = [
      {
        review_type: 'MATERIAL_EXCEPTION',
        period_key: '2026-11-2Q',
        inventory_transaction_id: txExc,
        contractor_entity: 'ASTILLERO',
        review_key: buildMaterialExceptionReviewKey(txExc),
      },
      {
        review_type: 'LABOR_ONLY_APPROVED',
        period_key: '2026-11-2Q',
        ship_id: SHIP_A,
        work_order_id: WO_A_CHAPA,
        contractor_entity: 'ASTILLERO',
        review_key: buildLaborOnlyApprovalReviewKey({ periodKey: '2026-11-2Q', shipId: SHIP_A, workOrderId: WO_A_CHAPA, contractorEntity: 'ASTILLERO' }),
      },
    ]

    const snap = buildCostControlSnapshot({
      periodKey: '2026-11-2Q',
      transactions,
      laborLogs,
      thirdPartyServices: [{ ship_id: SHIP_A, work_order_id: WO_A_SALA, contractor_id: W_CORMETAL, contractor_name: 'CORMETAL' }],
      workers,
      ships,
      workOrders,
      materials,
      reviews,
    })

    // 5 líneas auditables (V-6 OFICINA excluida, V-7 CORMETAL separada a terceros)
    expect(snap.kpis).toMatchObject({
      totalMaterialLines: 5,
      pendingLines: 3, // V-1, V-2 y V-3 sin deduplicar
      okLines: 1,
      validatedExceptions: 1,
      possibleShipErrorLines: 2,
      prevQuincenaMatchLines: 1,
      laborOnlyTotal: 1,
      laborOnlyApproved: 1,
      thirdPartyLines: 1,
    })
    expect(snap.contractorQueue).toEqual([
      { entity: 'RAMON ARANDA', pendingCount: 3, possibleShipErrors: 2, prevQuincenaMatches: 1 },
    ])
    const v1 = snap.materialRows.find((r) => r.id === txNo1)
    expect(v1.possibleShipMatches[0].shipName).toBe('DON ANTONIO')
    const v3 = snap.materialRows.find((r) => r.id === txPrev)
    expect(v3.prevQuincenaMatch).toMatchObject({ periodKey: '2026-11-1Q', lastDateIso: '2026-11-15', lastDateAr: '15/11/2026' })
    expect(snap.thirdPartyMaterialRows[0].hasThirdPartyMatch).toBe(true)
    expect(snap.laborOnlyRows[0].isApproved).toBe(true)
  })

  it('controla la suma diaria de horas al desdoblar una fila', () => {
    const dayLogs = [
      { id: 'l1', hours_worked: 8 },
      { id: 'l2', hours_worked: 2 },
    ]
    expect(computeDailyHoursSplitSummary(dayLogs, 'l1', 6.5, 1.5)).toEqual({
      originalDayTotal: 10,
      nextDayTotal: 10,
      delta: 0,
      matchesOriginal: true,
    })
    expect(computeDailyHoursSplitSummary(dayLogs, 'l1', 7, 2)).toEqual({
      originalDayTotal: 10,
      nextDayTotal: 11,
      delta: 1,
      matchesOriginal: false,
    })
  })

  it('ordena pendientes primero en Horas sin Materiales y marca talleres sin respaldo en Terceros (Etapa 5)', () => {
    const snap = buildCostControlSnapshot({
      periodKey: '2026-11-2Q',
      ships,
      workOrders,
      workers,
      materials,
      transactions: [
        { id: '66666666-6666-4666-8666-666666666688', material_id: MAT_1, ship_id: SHIP_A, work_order_id: WO_A_CUBIERTA, worker_id: W_CORMETAL, quantity_withdrawn: 2, transaction_date: '2026-11-20T12:00:00Z' },
      ],
      laborLogs: [
        { id: '77777777-7777-4777-8777-777777777781', worker_id: W_PROPIO, worker_name: 'Toledo, Luciano', ship_id: SHIP_A, work_order_id: WO_A_CHAPA, date_logged: '2026-11-18', hours_worked: 12 },
        { id: '77777777-7777-4777-8777-777777777782', worker_id: W_RAMON, worker_name: 'RAMON ARANDA', ship_id: SHIP_B, work_order_id: WO_B_SALA, date_logged: '2026-11-19', hours_worked: 4 },
        { id: '77777777-7777-4777-8777-777777777783', worker_id: W_RAMON, worker_name: 'RAMON ARANDA', ship_id: SHIP_B, work_order_id: WO_B_SALA, date_logged: '2026-11-20', hours_worked: 5 },
      ],
      thirdPartyServices: [],
      reviews: [
        {
          review_type: 'LABOR_ONLY_APPROVED',
          period_key: '2026-11-2Q',
          ship_id: SHIP_A,
          work_order_id: WO_A_CHAPA,
          contractor_entity: 'ASTILLERO',
          review_key: buildLaborOnlyApprovalReviewKey({ periodKey: '2026-11-2Q', shipId: SHIP_A, workOrderId: WO_A_CHAPA, contractorEntity: 'ASTILLERO' }),
        },
      ],
    })

    expect(snap.kpis).toMatchObject({ laborOnlyTotal: 2, laborOnlyPending: 1, laborOnlyApproved: 1, thirdPartyLines: 1 })
    expect(snap.laborOnlyRows.map((r) => ({ entity: r.entity, isApproved: r.isApproved, daysCount: r.daysCount, totalHours: r.totalHours, lastDateAr: r.lastDateAr }))).toEqual([
      { entity: 'RAMON ARANDA', isApproved: false, daysCount: 2, totalHours: 9, lastDateAr: '20/11/2026' },
      { entity: 'ASTILLERO', isApproved: true, daysCount: 1, totalHours: 12, lastDateAr: '18/11/2026' },
    ])
    expect(snap.thirdPartyMaterialRows[0].hasThirdPartyMatch).toBe(false)
  })
})

describe('Control de Gastos — Visibilidad y permisos Admin-only por defecto (Etapa 2)', () => {
  it('permite acceso al Administrador, oculta por defecto a otros roles y respeta habilitación explícita', () => {
    const adminRole = { role_key: 'ADMIN_GENERAL', security_level: 'ADMINISTRADOR', allowed_sections: [] }
    expect(isRouteAllowed('/control-gastos', 'conciliacion', { orgRole: adminRole }).allowed).toBe(true)
    expect(getVisibleNavigationModules({ allowedSections: null }).some((m) => m.id === 'control-gastos')).toBe(true)

    const supervisorRole = { role_key: 'SUPERVISION', security_level: 'SUPERVISOR', allowed_sections: ['dashboard', 'horas', 'panol'] }
    expect(isRouteAllowed('/control-gastos', 'conciliacion', { orgRole: supervisorRole }).allowed).toBe(false)
    expect(getVisibleNavigationModules({ allowedSections: supervisorRole.allowed_sections }).some((m) => m.id === 'control-gastos')).toBe(false)

    // Sin allowedSections explícitos, un Operario no ve Control de Gastos
    expect(getVisibleNavigationModules({ profile: { role: 'Operario' } }).some((m) => m.id === 'control-gastos')).toBe(false)

    // Si el Admin habilita parcialmente solo conciliacion
    const enabledRole = { role_key: 'AUDITOR_TEST', security_level: 'AUDITOR', allowed_sections: ['dashboard', 'control-gastos.conciliacion'] }
    expect(isRouteAllowed('/control-gastos', 'conciliacion', { orgRole: enabledRole }).allowed).toBe(true)
    expect(isRouteAllowed('/control-gastos', 'horas_sin_mat', { orgRole: enabledRole })).toMatchObject({
      allowed: false,
      redirectTo: '/control-gastos?tab=conciliacion',
    })
  })
})
