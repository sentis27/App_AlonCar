/**
 * laborPerformanceHelpers.js
 * Pre-indexación O(1) y cálculo agregado en una sola pasada para Horas (Carga, Sábana y Control Diario).
 * Elimina bucles O(W×15×L) y O(N×M) al escalar a miles de partes diarios (FL-025).
 */
import { buildLookupMap, buildGroupedMap } from './gridPerformanceHelpers.js'

export const HORAS_COL_INDEX = {
  date_logged: 0,
  ship_wo: 1,
  worker_name: 2,
  rubro: 3,
  work_type: 4,
  hours_normal: 5,
  hours_extra_50: 6,
  hours_extra_100: 7,
  approval_status: 8,
  notes: 9,
}

/**
 * Construye visual props de celda en O(1) usando únicamente primitivos de selección.
 * Permite envolver `LaborLogsTableRow` en `React.memo` sin re-renders en cascada.
 */
export function buildMemoizedHorasCellProps({
  rowIndex,
  colKey,
  activeColIndex,
  selStartCol,
  selEndCol,
  fillColIndex,
  fillHandleColIndex,
  gridActions,
}) {
  const colIdx = HORAS_COL_INDEX[colKey]
  if (colIdx === undefined) return { className: '', renderHandle: false, domProps: {} }
  const isActive = activeColIndex === colIdx
  const isSelected = selStartCol >= 0 && colIdx >= selStartCol && colIdx <= selEndCol
  const isFillPreview = fillColIndex === colIdx
  const renderHandle = fillHandleColIndex === colIdx
  return {
    renderHandle,
    domProps: {
      onClick: (e) => gridActions.onCellClick(rowIndex, colIdx, e),
      onMouseDown: (e) => gridActions.onCellMouseDown(rowIndex, colIdx, e),
      onMouseEnter: () => gridActions.onCellMouseEnter(rowIndex, colIdx),
    },
    className: `relative select-none transition-colors ${
      isActive
        ? 'ring-2 ring-cyan-400 bg-cyan-950/40 z-20 outline-none'
        : isFillPreview
        ? 'bg-cyan-900/40 border-y border-dashed border-cyan-400'
        : isSelected
        ? 'bg-cyan-900/30'
        : ''
    }`,
  }
}

/**
 * Calcula todos los KPIs de la cabecera/radar de LaborLogs en UNA sola pasada O(L).
 */
export function computeLaborPageKpis(recentLogs = [], auditDate = '') {
  let countSinOt = 0
  let countR = 0
  let countRR = 0
  let countSinPrc = 0
  let dailyCount = 0
  const filteredReviewLogs = []
  const astilleroByWorkerDate = new Map()

  for (let i = 0; i < recentLogs.length; i++) {
    const l = recentLogs[i]
    if (!l.work_order_id) countSinOt++
    if (l.approval_status === 'R') {
      countR++
      filteredReviewLogs.push(l)
    } else if (l.approval_status === 'RR') {
      countRR++
      filteredReviewLogs.push(l)
    }
    if ((l.cost_center === 'PRESUPUESTO' || l.work_type === 'PRESUPUESTO') && !l.prc_number) {
      countSinPrc++
    }
    if (auditDate && l.date_logged === auditDate) dailyCount++
    if ((l.worker_type || 'Astillero') === 'Astillero' && l.worker_name && l.date_logged) {
      const k = `${l.worker_name}__${l.date_logged}`
      let entry = astilleroByWorkerDate.get(k)
      if (!entry) {
        entry = { sum: 0, feriado: false }
        astilleroByWorkerDate.set(k, entry)
      }
      entry.sum += parseFloat(l.hours_normal ?? l.hours_worked) || 0
      if ((l.rubro || '').toLowerCase().includes('feriado')) entry.feriado = true
    }
  }

  let incompleteCount = 0
  astilleroByWorkerDate.forEach((v) => {
    if (v.sum < (v.feriado ? 8 : 9)) incompleteCount++
  })

  return { countSinOt, countR, countRR, countSinPrc, incompleteCount, dailyCount, filteredReviewLogs }
}

/**
 * Pre-agrega en una sola pasada O(L) las celdas y totales de la Sábana Quincenal.
 * Reemplaza el bucle O(W × 15 × L) anterior por consultas O(1) por celda.
 */
export function buildSabanaMatrixIndex(recentLogs = [], daysInQuincena = []) {
  const validDates = new Set(daysInQuincena.map((d) => d.dateStr))
  const byWorkerDate = new Map()
  const totalsByWorker = new Map()

  for (let i = 0; i < recentLogs.length; i++) {
    const l = recentLogs[i]
    if (!l || !l.worker_name || !validDates.has(l.date_logged)) continue

    let workerDays = byWorkerDate.get(l.worker_name)
    if (!workerDays) {
      workerDays = new Map()
      byWorkerDate.set(l.worker_name, workerDays)
    }
    let cell = workerDays.get(l.date_logged)
    if (!cell) {
      cell = { logs: [], dayHours: 0, dayNorm: 0, day50: 0, day100: 0, hasFeriado: false, hasR: false, hasRR: false }
      workerDays.set(l.date_logged, cell)
    }
    const hrs = parseFloat(l.hours_worked) || 0
    const norm = parseFloat(l.hours_normal) || hrs
    const h50 = parseFloat(l.hours_extra_50) || 0
    const h100 = parseFloat(l.hours_extra_100) || 0

    cell.logs.push(l)
    cell.dayHours += hrs
    cell.dayNorm += norm
    cell.day50 += h50
    cell.day100 += h100
    if ((l.rubro || '').toLowerCase().includes('feriado')) cell.hasFeriado = true
    if (l.approval_status === 'R') cell.hasR = true
    if (l.approval_status === 'RR') cell.hasRR = true

    let tot = totalsByWorker.get(l.worker_name)
    if (!tot) {
      tot = { sumNorm: 0, sum50: 0, sum100: 0 }
      totalsByWorker.set(l.worker_name, tot)
    }
    tot.sumNorm += norm
    tot.sum50 += h50
    tot.sum100 += h100
  }

  return { byWorkerDate, totalsByWorker }
}

export function filterQuincenaLogs(recentLogs = [], { selectedYear, selectedMonth, selectedQuincena, selectedQuincenaWorker }) {
  const targetYear = parseInt(selectedYear, 10)
  const targetMonth = parseInt(selectedMonth, 10)
  return recentLogs.filter((log) => {
    if (!log.date_logged) return false
    const [year, month, day] = log.date_logged.split('-').map(Number)
    if (year !== targetYear || month !== targetMonth) return false
    const matchQuincena = selectedQuincena === '1' ? day >= 1 && day <= 15 : day >= 16
    if (!matchQuincena) return false
    return !selectedQuincenaWorker || log.worker_name === selectedQuincenaWorker
  })
}

/**
 * Construye la nómina unificada de Control Diario en O(W + L) usando mapas O(1)
 * (elimina `astilleroSource.find()` O(W²) y `logsForAuditDate.filter()` O(W×D)).
 */
export function buildDailyControlUnifiedList({
  astilleroSource = [],
  tallerSource = [],
  contratistaSource = [],
  recentLogs = [],
  logsForAuditDate = [],
}) {
  const astilleroByName = buildLookupMap(astilleroSource, 'name')
  const astilleroNames = new Set(astilleroSource.map((w) => w.name))
  const tallerNames = new Set(tallerSource)
  const contratistaNames = new Set(contratistaSource)

  for (let i = 0; i < recentLogs.length; i++) {
    const l = recentLogs[i]
    if (!l?.worker_name) continue
    if (l.worker_type === 'Astillero') astilleroNames.add(l.worker_name)
    else if (l.worker_type === 'Taller') tallerNames.add(l.worker_name)
    else if (l.worker_type === 'Contratista') contratistaNames.add(l.worker_name)
  }

  const allKnownWorkers = []
  astilleroNames.forEach((name) => {
    allKnownWorkers.push({ name, defaultRubro: astilleroByName.get(name)?.defaultRubro || 'General', type: 'Astillero' })
  })
  tallerNames.forEach((name) => {
    allKnownWorkers.push({ name, defaultRubro: 'Taller Externo', type: 'Taller' })
  })
  contratistaNames.forEach((name) => {
    allKnownWorkers.push({ name, defaultRubro: 'Servicio Contratista', type: 'Contratista' })
  })

  const logsByWorker = buildGroupedMap(logsForAuditDate, 'worker_name')

  return allKnownWorkers.map((w) => {
    const logs = logsByWorker.get(w.name) || []
    let totalNormal = 0
    let total50 = 0
    let total100 = 0
    let isFeriado = false
    for (let i = 0; i < logs.length; i++) {
      const b = logs[i]
      totalNormal += parseFloat(b.hours_normal) || parseFloat(b.hours_worked) || 0
      total50 += parseFloat(b.hours_extra_50) || 0
      total100 += parseFloat(b.hours_extra_100) || 0
      if ((b.rubro || '').toLowerCase().includes('feriado')) isFeriado = true
    }
    const totalDay = totalNormal + total50 + total100
    const targetHours = w.type === 'Astillero' ? (isFeriado ? 8 : 9) : null

    let status = 'sin_carga'
    if (w.type === 'Astillero') {
      if (totalDay === 0) status = 'sin_carga'
      else if (totalNormal < targetHours) status = 'incompleta'
      else status = total50 > 0 || total100 > 0 || totalDay > targetHours ? 'extras' : 'completa'
    } else {
      status = totalDay > 0 ? 'registrado' : 'sin_carga'
    }

    return { worker: w, type: w.type, defaultRubro: w.defaultRubro, isFeriado, targetHours, totalNormal, total50, total100, totalDay, status, logs }
  })
}
