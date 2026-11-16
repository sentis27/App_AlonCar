// ==============================================================================
// MOTOR DE CONCILIACIÓN, ESTADÍAS Y PAYLOADS PARA CARGA POR RELOJ FACIAL
// Sin dependencias de React ni Supabase: 100% testeable en Node.
// ==============================================================================

import { normalizeText } from './tradesCatalog.js'
import { cleanShipName, cleanLocation } from './shipsConstants.js'
export { parseFacialClockCsv, buildSampleClockCsvFromWorkers } from './laborFacialCsvParser.js'

/**
 * Clasifica barcos en ASTILLERO (Varadero / Muelle) vs PUERTO usando ship_stays activa o ships.current_location.
 */
export function classifyShipsByStayLocation(ships = [], shipStays = [], recentLogs = [], dateLogged = '') {
  const activeStayByShip = new Map()
  shipStays.forEach(st => {
    if (!st.ship_id) return
    if (!st.end_date && !activeStayByShip.has(st.ship_id)) {
      activeStayByShip.set(st.ship_id, st)
    }
  })

  const hoursTodayByShip = new Map()
  recentLogs.forEach(l => {
    if (l.date_logged !== dateLogged || !l.ship_id) return
    const h = parseFloat(l.hours_worked) || ((parseFloat(l.hours_normal) || 0) + (parseFloat(l.hours_extra_50) || 0) + (parseFloat(l.hours_extra_100) || 0))
    hoursTodayByShip.set(l.ship_id, (hoursTodayByShip.get(l.ship_id) || 0) + h)
  })

  return ships
    .filter(s => s.is_active !== false)
    .map(ship => {
      const activeStay = activeStayByShip.get(ship.id)
      const locLabel = cleanLocation(activeStay?.location || ship.current_location || 'VARADERO')
      const zone = locLabel.includes('PUERTO') ? 'PUERTO' : 'ASTILLERO'
      return {
        id: ship.id,
        name: cleanShipName(ship.name),
        rawName: ship.name,
        locationLabel: locLabel,
        zone,
        hoursToday: Math.round((hoursTodayByShip.get(ship.id) || 0) * 100) / 100
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * Cruza asistentes del reloj con imputaciones del día y reporte de cierre final.
 */
export function buildFacialClockDashboardState({
  attendees = [],
  closingRecords = [],
  recentLogs = [],
  dateLogged = ''
}) {
  const loggedByWorker = new Map()
  recentLogs.forEach(l => {
    if (l.date_logged !== dateLogged || !l.worker_name) return
    const key = normalizeText(l.worker_name)
    const h = parseFloat(l.hours_worked) || ((parseFloat(l.hours_normal) || 0) + (parseFloat(l.hours_extra_50) || 0) + (parseFloat(l.hours_extra_100) || 0))
    loggedByWorker.set(key, (loggedByWorker.get(key) || 0) + h)
  })

  const closingByWorker = new Map()
  closingRecords.forEach(c => closingByWorker.set(normalizeText(c.worker_name), c))

  const enriched = attendees.map(att => {
    const key = normalizeText(att.worker_name)
    const loggedHours = Math.round((loggedByWorker.get(key) || 0) * 100) / 100
    const pendingHours = Math.round(Math.max(0, att.estimated_hours - loggedHours) * 100) / 100
    const closing = closingByWorker.get(key) || null
    const actualHours = closing?.actual_hours ?? att.actual_hours ?? null
    const diffVsEstimated = actualHours !== null ? Math.round((actualHours - att.estimated_hours) * 100) / 100 : null
    const diffVsLogged = actualHours !== null ? Math.round((actualHours - loggedHours) * 100) / 100 : null

    return {
      ...att,
      loggedHours,
      pendingHours,
      clockOut: closing?.clock_out || att.clock_out || null,
      actualHours,
      diffVsEstimated,
      diffVsLogged,
      hasMismatch: diffVsLogged !== null && Math.abs(diffVsLogged) >= 0.25
    }
  })

  const groupMap = new Map()
  enriched.forEach(w => {
    if (!groupMap.has(w.group_name)) {
      groupMap.set(w.group_name, {
        groupName: w.group_name,
        workerType: w.worker_type,
        workers: [],
        totalEstimated: 0,
        totalLogged: 0,
        totalPending: 0,
        totalActual: 0,
        hasActual: false
      })
    }
    const g = groupMap.get(w.group_name)
    g.workers.push(w)
    g.totalEstimated = Math.round((g.totalEstimated + w.estimated_hours) * 100) / 100
    g.totalLogged = Math.round((g.totalLogged + w.loggedHours) * 100) / 100
    g.totalPending = Math.round((g.totalPending + w.pendingHours) * 100) / 100
    if (w.actualHours !== null) {
      g.hasActual = true
      g.totalActual = Math.round((g.totalActual + w.actualHours) * 100) / 100
    }
  })

  const groups = Array.from(groupMap.values())
    .map(g => ({ ...g, workers: g.workers.sort((a, b) => a.worker_name.localeCompare(b.worker_name)) }))
    .sort((a, b) => a.groupName.localeCompare(b.groupName))

  const totalEstimated = enriched.reduce((s, w) => s + w.estimated_hours, 0)
  const totalLogged = Math.round(enriched.reduce((s, w) => s + w.loggedHours, 0) * 100) / 100
  const totalPending = Math.round(enriched.reduce((s, w) => s + w.pendingHours, 0) * 100) / 100
  const hasClosingReport = closingRecords.length > 0 || enriched.some(w => w.actualHours !== null)
  const mismatchCount = enriched.filter(w => w.hasMismatch).length

  return {
    workers: enriched,
    groups,
    summary: {
      presentCount: enriched.length,
      totalEstimated,
      totalLogged,
      totalPending,
      hasClosingReport,
      mismatchCount
    }
  }
}

/**
 * Construye el payload de inserción en labor_logs para un grupo o operario asignado a un barco.
 */
export function buildClockAssignmentPayload({
  ship,
  targetWorkers = [],
  hoursMode = 'fixed',
  customHours = 4.5,
  workOrderId = '',
  rubro = '',
  notes = '',
  dateLogged = ''
}) {
  const cleanNotes = String(notes || '').trim()
  if (!ship?.id) return { errorMsg: 'Seleccioná un barco de destino.', payload: null, totalHours: 0 }
  if (!cleanNotes) return { errorMsg: 'Cargá o dictá una descripción breve de la tarea antes de guardar.', payload: null, totalHours: 0 }
  if (!targetWorkers.length) return { errorMsg: 'No hay operarios seleccionados para asignar.', payload: null, totalHours: 0 }

  const fixedH = Math.max(0, parseFloat(customHours) || 0)
  const payload = []
  let totalHours = 0

  for (const w of targetWorkers) {
    const h = hoursMode === 'pending' ? (w.pendingHours > 0 ? w.pendingHours : 0) : fixedH
    if (h <= 0) continue
    totalHours += h
    const targetWoId = workOrderId || null
    payload.push({
      ship_id: ship.id,
      work_order_id: targetWoId,
      work_item_id: null,
      hours_worked: h,
      hours_normal: h,
      hours_extra_50: 0,
      hours_extra_100: 0,
      date_logged: dateLogged,
      worker_name: w.worker_name,
      worker_type: w.worker_type || 'Astillero',
      rubro: rubro || w.default_rubro || 'General',
      work_type: 'HORA',
      cost_center: 'CLIENTE',
      notes: cleanNotes,
      approval_status: targetWoId ? 'Aprobado' : 'R',
      review_reason: targetWoId ? null : 'Falta Cargar OT (Carga Reloj Facial)'
    })
  }

  if (payload.length === 0) {
    return { errorMsg: 'Los operarios seleccionados ya tienen su jornada completa (0 hs faltantes). Elegí un valor fijo si querés sumar horas.', payload: null, totalHours: 0 }
  }

  return { errorMsg: null, payload, totalHours: Math.round(totalHours * 100) / 100 }
}
