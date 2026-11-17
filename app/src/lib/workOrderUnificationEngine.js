/**
 * workOrderUnificationEngine.js
 * Motor puro (sin Supabase ni React) para:
 * 1. Normalización y detección de OTs duplicadas o eliminadas por buque.
 * 2. Catálogo único estandarizado de Barco + OT (excluyendo OTs unificadas y consolidando sublíneas).
 * 3. Resolución automática de work_item_id cuando una OT tiene una única línea activa.
 */

import {
  isWorkItemEliminada,
  getWorkOrderConsolidatedScope,
  isWorkOrderActiveForImputation
} from './workOrdersConstants.js'

export function normalizeOtTitleKey(title = '') {
  return String(title ?? '').trim().toUpperCase()
}

export function isMergedWorkOrder(wo) {
  if (!wo) return false
  return Boolean(wo.merged_into_wo_id || String(wo.status || '').trim().toUpperCase() === 'UNIFICADA')
}

export function isEliminatedWorkOrder(wo, workItems = []) {
  if (!wo) return false
  if (isMergedWorkOrder(wo)) return false
  const notesUpper = String(wo.notes || '').toUpperCase()
  if (wo.status === 'Cancelada' || notesUpper.includes('[ELIMINADA]')) return true

  const items = Array.isArray(workItems)
    ? workItems.filter((i) => String(i.work_order_id) === String(wo.id))
    : []
  if (items.length === 0) return false
  return items.every((i) => i.status === 'Desestimado' && isWorkItemEliminada(i, wo))
}

/**
 * Detecta si existe conflicto de nombre exacto (sin importar mayúsculas/espacios)
 * en el mismo barco contra OTs activas o eliminadas.
 */
export function findDuplicateOtNameConflict(
  workOrders = [],
  workItems = [],
  shipId,
  rawTitle,
  excludeWoId = null
) {
  const normTarget = normalizeOtTitleKey(rawTitle)
  if (!shipId || !normTarget) return null

  const candidates = (workOrders || []).filter((wo) => {
    if (!wo || isMergedWorkOrder(wo)) return false
    if (excludeWoId && String(wo.id) === String(excludeWoId)) return false
    if (String(wo.ship_id) !== String(shipId)) return false
    return normalizeOtTitleKey(wo.title) === normTarget
  })

  if (candidates.length === 0) return null

  const activeMatch = candidates.find((wo) => !isEliminatedWorkOrder(wo, workItems))
  if (activeMatch) {
    return {
      kind: 'ACTIVE',
      existingWo: activeMatch,
      message: 'Esta orden ya existe'
    }
  }

  const eliminatedMatch = candidates[0]
  return {
    kind: 'ELIMINATED',
    existingWo: eliminatedMatch,
    message: 'Ya has eliminado una orden con este nombre para este barco'
  }
}

/**
 * Valida un lote de plantillas (OT.ABC) contra las OTs existentes del barco.
 */
export function findBatchOtNameConflicts(workOrders = [], workItems = [], shipId, batchTemplates = []) {
  const conflicts = []
  const seenTitles = new Set()

  for (const tpl of batchTemplates || []) {
    const title = normalizeOtTitleKey(tpl?.ot_title || tpl?.name)
    if (!title) continue
    if (seenTitles.has(title)) {
      conflicts.push({ title, kind: 'BATCH_DUPLICATE', message: 'Esta orden ya existe' })
      continue
    }
    seenTitles.add(title)
    const hit = findDuplicateOtNameConflict(workOrders, workItems, shipId, title)
    if (hit) conflicts.push({ title, ...hit })
  }

  return conflicts
}

/**
 * Fuente Única Estandarizada de Barco + OT para todo el ERP.
 * - Excluye OTs ya unificadas/absorbidas (`merged_into_wo_id` / `status === 'Unificada'`).
 * - Consolida por `(ship_id, título normalizado)` para que cada OT aparezca 1 sola vez con todas sus sublíneas.
 * - Permite ocultar OTs eliminadas (`includeEliminated = false`) y/o cerradas (`includeClosed = false`).
 */
export function buildStandardShipWorkOrdersCatalog(
  workOrders = [],
  workItems = [],
  { shipId = null, includeEliminated = false, includeClosed = true } = {}
) {
  const visibleWos = (workOrders || []).filter((wo) => {
    if (!wo || isMergedWorkOrder(wo)) return false
    if (shipId && String(wo.ship_id) !== String(shipId)) return false
    return true
  })

  const grouped = new Map()
  visibleWos.forEach((wo) => {
    const titleKey = normalizeOtTitleKey(wo.title)
    const fallbackKey = String(wo.ot_number || wo.id).trim().toUpperCase()
    const key = `${wo.ship_id || 'no_ship'}::${titleKey || fallbackKey}`

    if (!grouped.has(key)) {
      grouped.set(key, { master: { ...wo }, allWoIds: new Set([wo.id]) })
    } else {
      grouped.get(key).allWoIds.add(wo.id)
    }
  })

  const catalog = []
  grouped.forEach(({ master, allWoIds }) => {
    const allItemsForGroup = (workItems || []).filter((wi) => allWoIds.has(wi.work_order_id))
    const activeNonDismissed = allItemsForGroup.filter((wi) => wi.status !== 'Desestimado')
    const eliminated = isEliminatedWorkOrder(master, allItemsForGroup)
    if (!includeEliminated && eliminated) return

    const scope = getWorkOrderConsolidatedScope(master, activeNonDismissed, visibleWos)
    const isActiveForImputation = !eliminated && isWorkOrderActiveForImputation(master, activeNonDismissed, visibleWos)
    if (!includeClosed && !isActiveForImputation) return

    catalog.push({
      ...master,
      _allWoIds: Array.from(allWoIds),
      _allWorkItems: allItemsForGroup,
      _activeWorkItems: activeNonDismissed,
      isEliminated: eliminated,
      isActiveForImputation,
      scopeSummary: scope.tasksSummary,
      scopeLabel: scope.scopeLabel,
      consolidatedTasks: scope.tasks
    })
  })

  return catalog.sort((a, b) =>
    String(a.ot_number || '').localeCompare(String(b.ot_number || ''), undefined, { numeric: true })
  )
}

/**
 * Si una OT posee exactamente 1 sublínea (`work_items`) activa (o única en la OT),
 * devuelve su `work_item_id` para sellar automáticamente Pañol, Horas y Terceros.
 */
export function resolveSingleWorkItemId(workOrderId, workItems = []) {
  if (!workOrderId || !Array.isArray(workItems) || workItems.length === 0) return null
  const matching = workItems.filter((wi) => String(wi.work_order_id) === String(workOrderId))
  if (matching.length === 0) return null
  const active = matching.filter((wi) => wi.status !== 'Desestimado')
  if (active.length === 1) return active[0].id
  if (matching.length === 1) return matching[0].id
  return null
}

/**
 * Formatea una cifra USD redondeada sin decimales innecesarios para el cartel simple.
 */
export function formatNoticeUsd(amount = 0) {
  const num = Math.round(Number(amount) || 0)
  return `US$ ${num.toLocaleString('es-AR')}`
}
