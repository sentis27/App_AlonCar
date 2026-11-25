import { describe, it, expect } from 'vitest'
import {
  buildSabanaMatrixIndex,
  buildDailyControlUnifiedList,
  computeLaborPageKpis,
  filterQuincenaLogs,
} from '../../src/lib/laborPerformanceHelpers.js'
import { buildQuincenaDays } from '../../src/lib/laborConstants.js'

function makeSyntheticLogs(count = 3000) {
  const days = buildQuincenaDays('2026', '11', '1')
  const logs = []
  for (let i = 0; i < count; i++) {
    const workerIdx = i % 200
    const day = days[Math.floor(i / 200) % days.length]
    const isFeriado = i % 50 === 0
    const isIncomplete = workerIdx % 17 === 0
    const hNorm = isIncomplete ? 6 : isFeriado ? 8 : 9
    const h50 = i % 9 === 0 ? 2 : 0
    const h100 = i % 23 === 0 ? 1 : 0
    logs.push({
      id: `log-${i}`,
      worker_name: `OPERARIO ${String(workerIdx).padStart(3, '0')}`,
      worker_type: workerIdx < 160 ? 'Astillero' : workerIdx < 180 ? 'Taller' : 'Contratista',
      date_logged: day.dateStr,
      rubro: isFeriado ? 'Feriado Soldadura' : 'Soldadura',
      hours_normal: hNorm,
      hours_extra_50: h50,
      hours_extra_100: h100,
      hours_worked: hNorm + h50 + h100,
      work_order_id: i % 10 === 0 ? null : `wo-${i % 20}`,
      approval_status: i % 15 === 0 ? 'R' : i % 25 === 0 ? 'RR' : 'S',
      cost_center: i % 12 === 0 ? 'PRESUPUESTO' : 'HORA',
      prc_number: i % 24 === 0 ? null : 'PRC-10',
    })
  }
  return { logs, days }
}

describe('Etapa 2 — Rendimiento y paridad de Horas (3.000 partes diarios)', () => {
  it('buildSabanaMatrixIndex procesa 3.000 partes × 15 días en < 15 ms con paridad exacta', () => {
    const { logs, days } = makeSyntheticLogs(3000)
    const t0 = performance.now()
    const { byWorkerDate, totalsByWorker } = buildSabanaMatrixIndex(logs, days)
    const elapsedMs = performance.now() - t0

    expect(elapsedMs).toBeLessThan(15)
    expect(byWorkerDate.size).toBe(200)

    const w0Logs = logs.filter((l) => l.worker_name === 'OPERARIO 000')
    const expectedNorm = w0Logs.reduce((a, l) => a + l.hours_normal, 0)
    const expected50 = w0Logs.reduce((a, l) => a + l.hours_extra_50, 0)
    const expected100 = w0Logs.reduce((a, l) => a + l.hours_extra_100, 0)

    expect(totalsByWorker.get('OPERARIO 000')).toEqual({
      sumNorm: expectedNorm,
      sum50: expected50,
      sum100: expected100,
    })
  })

  it('buildDailyControlUnifiedList construye nómina diaria O(W+L) respetando regla 9h / 8h feriado', () => {
    const { logs, days } = makeSyntheticLogs(3000)
    const auditDate = days[0].dateStr
    const logsForAuditDate = logs.filter((l) => l.date_logged === auditDate)
    const astilleroSource = Array.from({ length: 160 }, (_, i) => ({
      name: `OPERARIO ${String(i).padStart(3, '0')}`,
      defaultRubro: 'Soldadura',
    }))

    const t0 = performance.now()
    const list = buildDailyControlUnifiedList({
      astilleroSource,
      tallerSource: [],
      contratistaSource: [],
      recentLogs: logs,
      logsForAuditDate,
    })
    const elapsedMs = performance.now() - t0

    expect(elapsedMs).toBeLessThan(15)
    expect(list.length).toBeGreaterThanOrEqual(200)
    const w0 = list.find((item) => item.worker.name === 'OPERARIO 000')
    expect(w0).toBeTruthy()
    expect(w0.status).toBe('incompleta') // workerIdx 0 % 17 === 0 -> 6h < target
  })

  it('computeLaborPageKpis y filterQuincenaLogs calculan KPIs exactos en una pasada', () => {
    const { logs, days } = makeSyntheticLogs(3000)
    const kpis = computeLaborPageKpis(logs, days[0].dateStr)
    expect(kpis.countSinOt).toBe(300) // i % 10 === 0
    expect(kpis.countR).toBe(200) // i % 15 === 0
    expect(kpis.dailyCount).toBe(200) // 3000 / 15 days
    expect(kpis.filteredReviewLogs).toHaveLength(kpis.countR + kpis.countRR)

    const q1 = filterQuincenaLogs(logs, {
      selectedYear: '2026',
      selectedMonth: '11',
      selectedQuincena: '1',
      selectedQuincenaWorker: 'OPERARIO 001',
    })
    expect(q1.length).toBeGreaterThan(0)
    expect(q1.every((l) => l.worker_name === 'OPERARIO 001')).toBe(true)
  })
})
