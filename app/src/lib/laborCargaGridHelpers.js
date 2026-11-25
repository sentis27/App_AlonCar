// ==============================================================================
// HELPERS PUROS PARA LA PLANILLA INTERACTIVA DE HORAS (ZONA 3 & 4)
// Sin dependencias de React ni Supabase: 100% testeable en Node.
// ==============================================================================

import { matchesUniversalSearch } from './searchEngine.js'
import { cleanShipName, buildLocalRelationsForLog } from './laborConstants.js'
import { normalizeText } from './tradesCatalog.js'
import { TIPOS_DE_TRABAJO } from './workOrdersConstants.js'
import { getTodayArIso } from './dateTimeCanonical.js'

const VALID_LABOR_WORK_TYPES = new Set(TIPOS_DE_TRABAJO.map(t => t.value))

export function normalizeLaborWorkType(rawVal, fallback = '') {
  const upper = String(rawVal || '').trim().toUpperCase()
  if (VALID_LABOR_WORK_TYPES.has(upper)) return upper
  if (upper === 'PRC') return 'PRESUPUESTO'
  if (upper === 'HH') return 'HORA'
  if (upper === 'CTRL') return 'CONTROL'
  return fallback
}

export function getWorkTypeBadgeMeta(workTypeRaw) {
  const norm = normalizeLaborWorkType(workTypeRaw, '')
  if (norm === 'PRESUPUESTO') {
    return { code: 'PRC', label: 'Presupuesto', cls: 'bg-purple-950/90 text-purple-200 border-purple-500/60' }
  }
  if (norm === 'CONTROL') {
    return { code: 'CTRL', label: 'Control', cls: 'bg-emerald-950/90 text-emerald-200 border-emerald-500/60' }
  }
  if (norm === 'HORA') {
    return { code: 'HH', label: 'Hora', cls: 'bg-cyan-950/70 text-cyan-200 border-cyan-700/60' }
  }
  return { code: '—', label: workTypeRaw || 'Sin definir', cls: 'bg-amber-950/70 text-amber-300 border-amber-600/60' }
}

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
    { key: 'work_type', label: 'Modalidad (Col. F)', readOnly: false },
    { key: 'hours_normal', label: 'Norm', readOnly: false },
    { key: 'hours_extra_50', label: '50%', readOnly: false },
    { key: 'hours_extra_100', label: '100%', readOnly: false },
    { key: 'approval_status', label: 'Estado', readOnly: false },
    { key: 'notes', label: 'Obs / Tarea', readOnly: false }
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
  filterOt = 'todas',
  filterContractor = 'todos',
  filterRubro = 'todos',
  filterModality = 'todas',
  activeKpiFilter = 'todos',
  incompleteWorkerDateKeys = new Set()
}) {
  return recentLogs.filter(log => {
    const resolvedShipId = log.ship_id || log.work_orders?.ship_id || ''
    const shipName = log.ships?.name || log.work_orders?.ships?.name || ''
    const matchWorker = !filterWorker || matchesUniversalSearch(log, filterWorker, ['worker_name', 'rubro', 'notes', 'work_orders.ot_number', 'ships.name'])
    const matchDate = !filterDate || log.date_logged === filterDate
    const matchShip = !filterShip || filterShip === 'todos' || (
      String(resolvedShipId) === String(filterShip) ||
      shipName.toLowerCase().includes(String(filterShip).toLowerCase())
    )
    if (!matchWorker || !matchDate || !matchShip) return false

    if (filterOt && filterOt !== 'todas') {
      if (filterOt === 'SIN_OT' ? log.work_order_id : String(log.work_order_id || '') !== String(filterOt)) return false
    }
    if (filterContractor && filterContractor !== 'todos' && normalizeText(log.worker_name) !== normalizeText(filterContractor)) return false
    if (filterRubro && filterRubro !== 'todos' && normalizeText(log.rubro) !== normalizeText(filterRubro)) return false
    if (filterModality && filterModality !== 'todas' && normalizeLaborWorkType(log.work_type, '') !== filterModality) return false

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
      const targetWo = workOrders.find(w => String(w.id) === String(newValue.work_order_id))
      const currentValidWt = normalizeLaborWorkType(l.work_type, '')
      const nextWt = currentValidWt || normalizeLaborWorkType(targetWo?.work_type, 'HORA')
      return {
        ...l,
        work_type: nextWt,
        ...buildLocalRelationsForLog(newValue.ship_id, newValue.work_order_id, ships, workOrders),
        ...(!newValue.work_order_id ? { approval_status: 'R', review_reason: 'Falta Cargar OT (Pendiente de apertura)' } : {})
      }
    }
    if (colKey === 'work_type') {
      return { ...l, work_type: normalizeLaborWorkType(newValue, l.work_type || 'HORA') }
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

export function prepareInlineLogPatch(targetLog, field, newValue, { eligibleCatalog = null } = {}) {
  if (!targetLog) return { shouldSkip: true }
  let cleanedVal = newValue
  if (HOUR_NUMERIC_FIELDS.includes(field)) {
    cleanedVal = Math.max(0, parseFloat(newValue) || 0)
  } else if (field === 'work_type') {
    cleanedVal = normalizeLaborWorkType(newValue, '')
    if (!cleanedVal) return { shouldSkip: true }
  } else if (field === 'notes') {
    cleanedVal = typeof newValue === 'string' ? (newValue.trim() || null) : null
    if ((targetLog.notes || null) === cleanedVal) return { shouldSkip: true }
  } else if (typeof newValue === 'string') {
    cleanedVal = newValue.trim()
    if (!cleanedVal && ['worker_name', 'rubro', 'date_logged'].includes(field)) {
      return { shouldSkip: true }
    }
  }
  if (field !== 'notes' && targetLog[field] === cleanedVal) return { shouldSkip: true }

  const extraPayload = {}
  if (HOUR_NUMERIC_FIELDS.includes(field)) {
    const n = field === 'hours_normal' ? cleanedVal : (parseFloat(targetLog.hours_normal ?? targetLog.hours_worked) || 0)
    const h50 = field === 'hours_extra_50' ? cleanedVal : (parseFloat(targetLog.hours_extra_50) || 0)
    const h100 = field === 'hours_extra_100' ? cleanedVal : (parseFloat(targetLog.hours_extra_100) || 0)
    extraPayload.hours_worked = n + h50 + h100
  }

  if (field === 'worker_name' && cleanedVal && eligibleCatalog?.byNameMap) {
    const entry = eligibleCatalog.byNameMap.get(normalizeText(cleanedVal))
    if (entry) {
      extraPayload.worker_type = entry.workerType
      if (!(targetLog.rubro || '').trim() && entry.defaultRubro) {
        extraPayload.rubro = entry.defaultRubro
      }
      const curN = parseFloat(targetLog.hours_normal) || 0
      const cur50 = parseFloat(targetLog.hours_extra_50) || 0
      const cur100 = parseFloat(targetLog.hours_extra_100) || 0
      if (curN === 0 && cur50 === 0 && cur100 === 0) {
        const effRubro = (extraPayload.rubro || targetLog.rubro || '').toLowerCase()
        const defH = entry.workerType === 'Astillero' ? (effRubro.includes('feriado') ? 8 : 9) : 8
        extraPayload.hours_normal = defH
        extraPayload.hours_worked = defH
      }
    }
  }

  return { shouldSkip: false, cleanedVal, extraPayload }
}

export function buildBlankLaborLogPayload(todayStr = getTodayArIso()) {
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

export function extractLaborFilterOptions(recentLogs = []) {
  const contractorMap = new Map()
  const rubroSet = new Set()
  recentLogs.forEach((l) => {
    const name = String(l.worker_name || '').trim()
    if (name && !contractorMap.has(name)) contractorMap.set(name, { name, workerType: l.worker_type || 'Astillero' })
    const rub = String(l.rubro || '').trim()
    if (rub) rubroSet.add(rub)
  })
  const contractorOptions = Array.from(contractorMap.values()).sort((a, b) => {
    const aIsC = a.workerType !== 'Astillero' ? 0 : 1
    const bIsC = b.workerType !== 'Astillero' ? 0 : 1
    return aIsC !== bIsC ? aIsC - bIsC : a.name.localeCompare(b.name)
  })
  const rubroOptions = Array.from(rubroSet).sort((a, b) => a.localeCompare(b))
  return { contractorOptions, rubroOptions }
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
