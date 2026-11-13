// ==============================================================================
// HELPERS PUROS PARA LA PLANILLA INTERACTIVA DE HORAS (ZONA 3 & 4)
// Sin dependencias de React ni Supabase: 100% testeable en Node.
// ==============================================================================

import { matchesUniversalSearch } from './searchEngine.js'
import { cleanShipName, buildLocalRelationsForLog } from './laborConstants.js'

export const LOG_PASTE_FIELDS = [
  'ship_id',
  'work_order_id',
  'work_item_id',
  'rubro',
  'hours_worked',
  'hours_normal',
  'hours_extra_50',
  'hours_extra_100',
  'work_type',
  'notes'
]

export const HOUR_NUMERIC_FIELDS = ['hours_normal', 'hours_extra_50', 'hours_extra_100']

export function buildHorasSpreadsheetColumns() {
  return [
    { key: 'date_logged', label: 'Fecha', readOnly: false },
    {
      key: 'ship_wo',
      label: 'Barco / OT',
      readOnly: false,
      getValue: (row) => ({ ship_id: row.ship_id || row.work_orders?.ship_id || null, work_order_id: row.work_order_id || null }),
      formatDisplay: (_val, row) => {
        const sName = cleanShipName(row?.ships?.name || row?.work_orders?.ships?.name || '') || 'Sin Buque'
        const otLabel = row?.work_orders?.ot_number || row?.work_orders?.title || 'Sin OT'
        return `${sName} / ${otLabel}`
      }
    },
    { key: 'worker_name', label: 'Operario', readOnly: false },
    { key: 'rubro', label: 'Rubro', readOnly: false },
    { key: 'hours_normal', label: 'Norm', readOnly: false },
    { key: 'hours_extra_50', label: '50%', readOnly: false },
    { key: 'hours_extra_100', label: '100%', readOnly: false },
    { key: 'approval_status', label: 'Estado', readOnly: false }
  ]
}

export function computeIncompleteWorkerDateKeys(recentLogs = []) {
  const grouped = new Map()
  recentLogs.forEach(l => {
    if ((l.worker_type || 'Astillero') !== 'Astillero' || !l.worker_name || !l.date_logged) return
    const key = `${l.worker_name}__${l.date_logged}`
    if (!grouped.has(key)) grouped.set(key, { sumNormal: 0, isFeriado: false })
    const entry = grouped.get(key)
    entry.sumNormal += parseFloat(l.hours_normal ?? l.hours_worked) || 0
    if ((l.rubro || '').toLowerCase().includes('feriado')) entry.isFeriado = true
  })

  const incompleteKeys = new Set()
  grouped.forEach((data, key) => {
    const requiredHours = data.isFeriado ? 8 : 9
    if (data.sumNormal < requiredHours) incompleteKeys.add(key)
  })
  return incompleteKeys
}

export function filterLaborLogs(recentLogs = [], {
  filterWorker = '',
  filterDate = '',
  filterShip = '',
  activeKpiFilter = 'todos',
  incompleteWorkerDateKeys = new Set()
}) {
  return recentLogs.filter(log => {
    const shipName = log.ships?.name || log.work_orders?.ships?.name || ''
    const matchWorker = !filterWorker || matchesUniversalSearch(log, filterWorker, ['worker_name', 'rubro', 'notes', 'work_orders.ot_number', 'ships.name'])
    const matchDate = !filterDate || log.date_logged === filterDate
    const matchShip = !filterShip || shipName.toLowerCase().includes(filterShip.toLowerCase())
    if (!matchWorker || !matchDate || !matchShip) return false

    if (activeKpiFilter === 'sin_ot') return !log.work_order_id
    if (activeKpiFilter === 'revision_R') return log.approval_status === 'R'
    if (activeKpiFilter === 'corregidas_RR') return log.approval_status === 'RR'
    if (activeKpiFilter === 'incompleta') return incompleteWorkerDateKeys.has(`${log.worker_name}__${log.date_logged}`)
    if (activeKpiFilter === 'sin_prc') return (log.cost_center === 'PRESUPUESTO' || log.work_type === 'PRESUPUESTO') && !log.prc_number
    return true
  })
}

export function applyLocalHorasBatchUpdate(logs = [], {
  colKey,
  newValue,
  targetIds = [],
  revertMap = null,
  isRevert = false,
  ships = [],
  workOrders = []
}) {
  if (isRevert && revertMap) {
    return logs.map(l => {
      if (revertMap[l.id] === undefined) return l
      const oldVal = revertMap[l.id]
      if (colKey === 'ship_wo' && oldVal && typeof oldVal === 'object') {
        return { ...l, ...buildLocalRelationsForLog(oldVal.ship_id, oldVal.work_order_id, ships, workOrders) }
      }
      if (HOUR_NUMERIC_FIELDS.includes(colKey)) {
        const nextLog = { ...l, [colKey]: parseFloat(oldVal) || 0 }
        const total = (parseFloat(nextLog.hours_normal) || 0) + (parseFloat(nextLog.hours_extra_50) || 0) + (parseFloat(nextLog.hours_extra_100) || 0)
        return { ...nextLog, hours_worked: total }
      }
      return { ...l, [colKey]: oldVal }
    })
  }

  const targetSet = new Set(targetIds)
  return logs.map(l => {
    if (!targetSet.has(l.id)) return l
    if (colKey === 'ship_wo' && newValue && typeof newValue === 'object') {
      return {
        ...l,
        ...buildLocalRelationsForLog(newValue.ship_id, newValue.work_order_id, ships, workOrders),
        ...(!newValue.work_order_id ? { approval_status: 'R', review_reason: 'Falta Cargar OT (Pendiente de apertura)' } : {})
      }
    }
    if (HOUR_NUMERIC_FIELDS.includes(colKey)) {
      const num = parseFloat(newValue) || 0
      const nextLog = { ...l, [colKey]: num }
      const total = (parseFloat(nextLog.hours_normal) || 0) + (parseFloat(nextLog.hours_extra_50) || 0) + (parseFloat(nextLog.hours_extra_100) || 0)
      return { ...nextLog, hours_worked: total }
    }
    return { ...l, [colKey]: newValue }
  })
}

export function prepareInlineLogPatch(targetLog, field, newValue) {
  if (!targetLog) return { shouldSkip: true }
  let cleanedVal = newValue
  if (HOUR_NUMERIC_FIELDS.includes(field)) {
    cleanedVal = Math.max(0, parseFloat(newValue) || 0)
  } else if (typeof newValue === 'string') {
    cleanedVal = newValue.trim()
    if (!cleanedVal && ['worker_name', 'rubro', 'date_logged'].includes(field)) {
      return { shouldSkip: true }
    }
  }
  if (targetLog[field] === cleanedVal) return { shouldSkip: true }

  const extraPayload = {}
  if (HOUR_NUMERIC_FIELDS.includes(field)) {
    const n = field === 'hours_normal' ? cleanedVal : (parseFloat(targetLog.hours_normal ?? targetLog.hours_worked) || 0)
    const h50 = field === 'hours_extra_50' ? cleanedVal : (parseFloat(targetLog.hours_extra_50) || 0)
    const h100 = field === 'hours_extra_100' ? cleanedVal : (parseFloat(targetLog.hours_extra_100) || 0)
    extraPayload.hours_worked = n + h50 + h100
  }

  return { shouldSkip: false, cleanedVal, extraPayload }
}

export function buildBlankLaborLogPayload(todayStr = new Date().toISOString().split('T')[0]) {
  return {
    date_logged: todayStr,
    ship_id: null,
    work_order_id: null,
    worker_name: '',
    worker_type: '',
    rubro: '',
    hours_worked: 0,
    hours_normal: 0,
    hours_extra_50: 0,
    hours_extra_100: 0,
    approval_status: 'R',
    review_reason: 'Fila en blanco (Pendiente de carga)'
  }
}

export function buildHorasCellVisualProps(horasGrid, horasSpreadsheetColumns, rowIndex, colKey) {
  const colIdx = horasSpreadsheetColumns.findIndex(c => c.key === colKey)
  if (colIdx === -1) return { className: '', renderHandle: false, domProps: {} }
  const isActive = horasGrid.isCellActive(rowIndex, colIdx)
  const isSelected = horasGrid.isCellSelected(rowIndex, colIdx)
  const isFillPreview = horasGrid.isCellInFillPreview(rowIndex, colIdx)
  const renderHandle = horasGrid.shouldRenderFillHandle(rowIndex, colIdx)
  return {
    renderHandle,
    domProps: {
      onClick: (e) => horasGrid.handleCellClick(rowIndex, colIdx, e),
      onMouseDown: (e) => horasGrid.handleCellMouseDown(rowIndex, colIdx, e),
      onMouseEnter: () => horasGrid.handleCellMouseEnter(rowIndex, colIdx)
    },
    className: `relative select-none transition-colors ${
      isActive
        ? 'ring-2 ring-cyan-400 bg-cyan-950/40 z-20 outline-none'
        : isFillPreview
        ? 'bg-cyan-900/40 border-y border-dashed border-cyan-400'
        : isSelected
        ? 'bg-cyan-900/30'
        : ''
    }`
  }
}
