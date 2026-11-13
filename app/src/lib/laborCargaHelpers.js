// ==============================================================================
// HELPERS PUROS Y CONSTANTES DEL PANEL DE CARGA DE HORAS (M3)
// Sin dependencias de React ni Supabase: 100% testeable en Node.
// ==============================================================================

import { TALLERES_FRECUENTES } from './laborConstants.js'
import { normalizeText, parseWorkerTrades } from './tradesCatalog.js'

export const LABOR_BATCH_STORAGE_KEY = 'aloncar_last_labor_batch_v2'

export const EXAMPLE_CREW_REPORT =
  'Luciano Tritón reguillas cuvierta protección de bacha y colocación de parrilla andres y diego soldadura parches trancalin don Antonio 9hr franco y enzo higinio subir portones y matafuego vuoso 2hr 2hr maniobra para prueba navegación  5 hr en don Antonio bodega sacar porurietano y comentando'

export const SAMPLE_CREW_FALLBACK = [
  { worker_name: 'Toledo, Luciano', worker_type: 'Astillero', default_rubro: 'Calderería', rubro: 'Calderería', hours_normal: 9, hours_extra_50: 0, hours_extra_100: 0, notes: 'Rejillas cubierta y colocación de parrilla' },
  { worker_name: 'Gari, Mario Andres', worker_type: 'Astillero', default_rubro: 'Calderería', rubro: 'Soldadura', hours_normal: 9, hours_extra_50: 0, hours_extra_100: 0, notes: 'Soldadura parches trancalín' },
  { worker_name: 'Rodriguez, Diego', worker_type: 'Astillero', default_rubro: 'Calderería', rubro: 'Soldadura', hours_normal: 9, hours_extra_50: 0, hours_extra_100: 0, notes: 'Soldadura parches trancalín' }
]

export function createEmptyOperarioRow(overrides = {}) {
  return {
    id: Date.now() + Math.random(),
    worker_name: '',
    worker_type: 'Astillero',
    default_rubro: '',
    rubro: '',
    hours_normal: 9,
    hours_extra_50: 0,
    hours_extra_100: 0,
    notes: '',
    ...overrides
  }
}

export function getEnabledContractorsForShip(selectedShipId, activeWorkItemsForShip = [], dbWorkers = []) {
  if (!selectedShipId) return []
  const set = new Set()
  activeWorkItemsForShip.forEach(item => {
    const list = item.contractors || []
    if (list.length === 0) {
      set.add('ASTILLERO.GENERAL')
    } else {
      list.forEach(c => { if (c) set.add(c) })
    }
  })
  if (set.size === 0) {
    set.add('ASTILLERO.GENERAL')
    dbWorkers
      .filter(w => (w.admin_center === 'CONTRATISTA' || w.admin_center === 'TALLER') && w.status !== 'INACTIVO' && w.can_impute_hours !== false)
      .forEach(w => { if (w.work_group) set.add(w.work_group) })
  }
  return Array.from(set).sort()
}

export function getAvailableWorkOrders(selectedShipId, selectedContractorGroup, activeWorkItemsForShip = [], workOrders = []) {
  if (!selectedShipId || !selectedContractorGroup) return []
  const matchingWoIds = new Set()
  const isSelectAst = selectedContractorGroup.toUpperCase().startsWith('ASTILLERO')
  activeWorkItemsForShip.forEach(item => {
    const list = item.contractors || []
    const isMatch = list.includes(selectedContractorGroup) || (isSelectAst && (list.length === 0 || list.some(c => String(c).toUpperCase().startsWith('ASTILLERO'))))
    if (isMatch) matchingWoIds.add(item.work_order_id)
  })
  return workOrders.filter(wo => wo.ship_id === selectedShipId && matchingWoIds.has(wo.id))
}

export function getActiveItemsForSelectedWo(activeWorkItemsForShip = [], selectedWorkOrderId, selectedContractorGroup) {
  if (!selectedWorkOrderId || !selectedContractorGroup) return []
  const isSelectAst = selectedContractorGroup.toUpperCase().startsWith('ASTILLERO')
  return activeWorkItemsForShip.filter(item => {
    if (item.work_order_id !== selectedWorkOrderId) return false
    const list = item.contractors || []
    return list.includes(selectedContractorGroup) || (isSelectAst && (list.length === 0 || list.some(c => String(c).toUpperCase().startsWith('ASTILLERO'))))
  })
}

export function buildCrewRowsForContractor(prevRows = [], newContractor, dbWorkers = []) {
  if (!newContractor) return prevRows
  const upper = newContractor.toUpperCase()
  if (upper.startsWith('ASTILLERO')) {
    const onlyAstillero = prevRows.filter(r => r.worker_type === 'Astillero')
    if (onlyAstillero.length === 0) {
      return [createEmptyOperarioRow({ id: Date.now() })]
    }
    return onlyAstillero.map(row => ({ ...row, worker_type: 'Astillero' }))
  }

  const isTaller = TALLERES_FRECUENTES.includes(newContractor) || dbWorkers.some(w => w.work_group === newContractor && w.admin_center === 'TALLER')
  const targetType = isTaller ? 'Taller' : 'Contratista'
  const matchedContractor = dbWorkers.find(w => w.work_group === newContractor || w.name === newContractor)
  const tradesInfo = parseWorkerTrades(matchedContractor?.trade || (isTaller ? 'Tornería' : 'Servicio Contratista'))
  return [{
    id: Date.now(),
    worker_name: newContractor,
    worker_type: targetType,
    default_rubro: tradesInfo.primaryLabel,
    allowed_trades: tradesInfo.labelList,
    rubro: tradesInfo.primaryLabel,
    hours_normal: 8,
    hours_extra_50: 0,
    hours_extra_100: 0,
    notes: ''
  }]
}

export function buildPresetOperarioRow(preset = {}, {
  isSelectedGroupAstillero,
  selectedContractorGroup,
  selectedShipId,
  selectedWorkOrderId,
  selectedWorkItemId,
  dbWorkers = []
}) {
  const isFeriado = (preset.rubro || '').toLowerCase().includes('feriado')
  const defaultNorm = isSelectedGroupAstillero ? (isFeriado ? 8 : 9) : 8
  const isTaller = !isSelectedGroupAstillero && (TALLERES_FRECUENTES.includes(selectedContractorGroup) || dbWorkers.some(w => w.work_group === selectedContractorGroup && w.admin_center === 'TALLER'))
  const forcedType = isSelectedGroupAstillero ? 'Astillero' : (isTaller ? 'Taller' : 'Contratista')

  let defaultRubro = preset.rubro || ''
  let allowedTrades = ['General']
  if (!isSelectedGroupAstillero) {
    const matchedContractor = dbWorkers.find(w => w.work_group === selectedContractorGroup || w.name === selectedContractorGroup)
    const tradesInfo = parseWorkerTrades(matchedContractor?.trade || (isTaller ? 'Tornería' : 'Servicio Contratista'))
    if (!defaultRubro) defaultRubro = tradesInfo.primaryLabel
    allowedTrades = tradesInfo.labelList
  }

  return createEmptyOperarioRow({
    worker_name: preset.worker_name || (isSelectedGroupAstillero ? '' : selectedContractorGroup),
    worker_type: forcedType,
    default_rubro: defaultRubro,
    allowed_trades: allowedTrades,
    rubro: defaultRubro,
    ship_id: preset.ship_id || selectedShipId || '',
    work_order_id: preset.work_order_id || selectedWorkOrderId || '',
    work_item_id: preset.work_item_id || selectedWorkItemId || '',
    hours_normal: preset.hours_normal ?? defaultNorm,
    hours_extra_50: preset.hours_extra_50 ?? 0,
    hours_extra_100: preset.hours_extra_100 ?? 0,
    notes: preset.notes || ''
  })
}

export function applyOperarioRowFieldUpdate(row, field, value) {
  const updated = { ...row, [field]: value }
  if (field === 'rubro' && updated.worker_type === 'Astillero') {
    if (value.toLowerCase().includes('feriado')) {
      updated.hours_normal = 8
    } else if ((row.rubro || '').toLowerCase().includes('feriado') && updated.hours_normal === 8) {
      updated.hours_normal = 9
    }
    updated.is_loaned_rubro = Boolean(
      updated.default_rubro &&
      updated.default_rubro !== 'General' &&
      normalizeText(value) !== normalizeText(updated.default_rubro)
    )
  }
  if (field === 'worker_type' && value === 'Astillero') {
    updated.hours_normal = (updated.rubro || '').toLowerCase().includes('feriado') ? 8 : 9
  }
  return updated
}

export function applyHomonymCandidateToRow(row, candidate) {
  const tInfo = parseWorkerTrades(candidate?.trade || 'General')
  return {
    ...row,
    worker_name: candidate.name,
    default_rubro: tInfo.primaryLabel,
    allowed_trades: tInfo.labelList,
    rubro: row.rubro || tInfo.primaryLabel,
    homonym_candidates: [],
    worker_match_status: 'exact',
    needs_review: false
  }
}

export function consolidateSameOtRows(rows = [], selectedShipId, selectedWorkOrderId) {
  const map = new Map()
  rows.forEach(r => {
    const effShip = r.ship_id || r.ship_name_raw || selectedShipId
    const effWo = r.work_order_id || selectedWorkOrderId
    const key = `${r.worker_name}__${effShip}__${effWo}__${r.rubro}`
    if (r.worker_name && effWo && map.has(key)) {
      const existing = map.get(key)
      existing.hours_normal = (parseFloat(existing.hours_normal) || 0) + (parseFloat(r.hours_normal) || 0)
      existing.hours_extra_50 = (parseFloat(existing.hours_extra_50) || 0) + (parseFloat(r.hours_extra_50) || 0)
      existing.hours_extra_100 = (parseFloat(existing.hours_extra_100) || 0) + (parseFloat(r.hours_extra_100) || 0)
      if (r.notes && !existing.notes.includes(r.notes)) {
        existing.notes = existing.notes ? `${existing.notes} + ${r.notes}` : r.notes
      }
    } else {
      map.set(key, { ...r })
    }
  })
  return Array.from(map.values())
}

export function computeDraftWorkerSummary(operariosRows = []) {
  const map = new Map()
  operariosRows.forEach(r => {
    const name = (r.worker_name || '').trim()
    if (!name) return
    if (!map.has(name)) map.set(name, { name, type: r.worker_type || 'Astillero', parts: [], total: 0 })
    const entry = map.get(name)
    const h = (parseFloat(r.hours_normal) || 0) + (parseFloat(r.hours_extra_50) || 0) + (parseFloat(r.hours_extra_100) || 0)
    entry.parts.push(h)
    entry.total += h
  })
  return Array.from(map.values())
}

export function buildLaborBatchPayload(operariosRows = [], {
  selectedShipId,
  selectedWorkOrderId,
  currentWorkItem,
  woByIdMap = {},
  dateLogged,
  workType
}) {
  const rowsMissingShip = operariosRows.filter(r => !(r.ship_id || selectedShipId || (r.work_order_id && woByIdMap[r.work_order_id]?.ship_id)))
  if (rowsMissingShip.length > 0) {
    return { errorMsg: `Hay ${rowsMissingShip.length} fila(s) sin Buque de destino asignado.`, payload: null }
  }
  const rowsWithErrors = operariosRows.filter(r => !(r.worker_name || '').trim() || !(r.rubro || '').trim())
  if (rowsWithErrors.length > 0) {
    return { errorMsg: 'Complete Operario y Rubro para todas las filas.', payload: null }
  }

  const payload = operariosRows.map(row => {
    const hNorm = parseFloat(row.hours_normal) || 0
    const h50 = parseFloat(row.hours_extra_50) || 0
    const h100 = parseFloat(row.hours_extra_100) || 0
    const targetWoId = row.work_order_id || selectedWorkOrderId || null
    const targetShipId = row.ship_id || selectedShipId || (targetWoId ? woByIdMap[targetWoId]?.ship_id : null) || null
    const targetItemId = row.work_item_id || currentWorkItem?.id || null
    const isMissingWo = !targetWoId
    const hasUnresolvedAlert = Boolean(row.needs_review) || isMissingWo
    return {
      ship_id: targetShipId,
      work_order_id: targetWoId,
      work_item_id: targetItemId,
      hours_worked: hNorm + h50 + h100,
      hours_normal: hNorm,
      hours_extra_50: h50,
      hours_extra_100: h100,
      date_logged: dateLogged,
      worker_name: row.worker_name,
      worker_type: row.worker_type,
      rubro: row.rubro,
      work_type: workType,
      cost_center: 'CLIENTE',
      notes: row.notes || null,
      approval_status: isMissingWo || hasUnresolvedAlert ? 'R' : 'Aprobado',
      review_reason: isMissingWo ? 'Falta Cargar OT (Pendiente de apertura)' : (hasUnresolvedAlert ? (row.review_warnings || []).join(' | ') : null)
    }
  })

  return { errorMsg: null, payload }
}
