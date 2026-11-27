import { describe, it, expect } from 'vitest'
import { buildContractorHoursMirror } from '../../src/lib/costControlMirrorHelpers.js'
import { splitLaborLogForMaterialService } from '../../src/services/costControlService.js'

const SHIP_A = '11111111-1111-4111-8111-111111111111'
const SHIP_B = '22222222-2222-4222-8222-222222222222'
const WO_A_SALA = '33333333-3333-4333-8333-333333333331'
const WO_B_SALA = '33333333-3333-4333-8333-333333333332'
const WO_A_CUB = '33333333-3333-4333-8333-333333333333'
const W_TANO_HEAD = '44444444-4444-4444-8444-444444444451'
const W_TANO_OPER = '44444444-4444-4444-8444-444444444452'
const W_OTRO = '44444444-4444-4444-8444-444444444453'

describe('buildContractorHoursMirror (Etapa 4)', () => {
  const ships = [
    { id: SHIP_A, name: 'LA SANTA MARIA I' },
    { id: SHIP_B, name: 'DON ANTONIO' },
  ]
  const workOrders = [
    { id: WO_A_SALA, ship_id: SHIP_A, ot_number: '101', title: 'SALA DE MAQUINAS' },
    { id: WO_B_SALA, ship_id: SHIP_B, ot_number: '201', title: 'SALA DE MAQUINAS' },
    { id: WO_A_CUB, ship_id: SHIP_A, ot_number: '102', title: 'CUBIERTA' },
  ]
  const workers = [
    { id: W_TANO_HEAD, name: 'TANO', work_group: 'TANO', can_impute_hours: false },
    { id: W_TANO_OPER, name: 'SAMUEL DANGIOLO', work_group: 'TANO', can_impute_hours: true },
    { id: W_OTRO, name: 'TOBARES', work_group: 'TOBARES', can_impute_hours: true },
  ]
  const laborLogs = [
    { id: 'l1', worker_id: W_TANO_OPER, worker_name: 'SAMUEL DANGIOLO', ship_id: SHIP_B, work_order_id: WO_B_SALA, date_logged: '2026-11-19', hours_worked: 8 },
    { id: 'l2', worker_id: W_TANO_OPER, worker_name: 'SAMUEL DANGIOLO', ship_id: SHIP_A, work_order_id: WO_A_CUB, date_logged: '2026-11-19', hours_worked: 2 },
    { id: 'l3', worker_id: W_TANO_OPER, worker_name: 'SAMUEL DANGIOLO', ship_id: SHIP_B, work_order_id: WO_B_SALA, date_logged: '2026-11-20', hours_worked: 6 },
    { id: 'l4', worker_id: W_TANO_OPER, worker_name: 'SAMUEL DANGIOLO', ship_id: SHIP_A, work_order_id: WO_A_CUB, date_logged: '2026-11-15', hours_worked: 5 },
    { id: 'l5', worker_id: W_OTRO, worker_name: 'TOBARES', ship_id: SHIP_B, work_order_id: WO_B_SALA, date_logged: '2026-11-19', hours_worked: 9 },
  ]

  it('arma espejo del día, mapa completo de quincena con Coincide OT y quincena anterior por grupo', () => {
    const mirror = buildContractorHoursMirror({
      laborLogs,
      workers,
      ships,
      workOrders,
      entity: 'TANO',
      periodKey: '2026-11-2Q',
      prevPeriodKey: '2026-11-1Q',
      focusDateIso: '2026-11-19',
      focusShipId: SHIP_A,
      focusOtTitle: 'SALA DE MAQUINAS',
    })

    expect(mirror.dayLogs.map((d) => d.id)).toEqual(['l1', 'l2'])
    expect(mirror.dayTotalHours).toBe(10)
    expect(mirror.quincenaGroups).toHaveLength(2)
    expect(mirror.quincenaGroups[0]).toMatchObject({
      shipName: 'DON ANTONIO',
      otTitle: 'SALA DE MAQUINAS',
      totalHours: 14,
      matchesFocusOtOnOtherShip: true,
      datesShortLabel: '19/11, 20/11',
    })
    expect(mirror.prevQuincenaGroups).toHaveLength(1)
    expect(mirror.prevQuincenaGroups[0]).toMatchObject({
      shipName: 'LA SANTA MARIA I',
      lastDateIso: '2026-11-15',
      lastDateAr: '15/11/2026',
      totalHours: 5,
    })
  })
})

describe('splitLaborLogForMaterialService — validación defensiva (Etapa 4)', () => {
  it('rechaza fila sin id, horas nuevas <= 0 o horas restantes negativas', async () => {
    await expect(splitLaborLogForMaterialService({ sourceLog: null })).rejects.toThrow('Fila de horas origen requerida')
    await expect(
      splitLaborLogForMaterialService({ sourceLog: { id: 'l1' }, sourceNextHours: 7, newRowHours: 0 })
    ).rejects.toThrow('mayores a 0')
    await expect(
      splitLaborLogForMaterialService({ sourceLog: { id: 'l1' }, sourceNextHours: -1, newRowHours: 1 })
    ).rejects.toThrow('no pueden ser negativas')
  })
})
