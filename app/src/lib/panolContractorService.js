/**
 * panolContractorService.js
 * Motor unificado de selección de Operario / Contratista para Planilla de Retiros (M4):
 * - Lista agrupada estricta por OT / Barco y modo Expandir (paridad con modal de edición).
 * - Al elegir un operario/contratista expandido NO habilitado en la OT actual, borra automáticamente
 *   `work_order_id` y `work_item_id` (aviso ⚠️ Sin OT) y emite alerta de cumplimiento.
 */

import { getContractorEnabledWos, getShipEnabledContractors, normalizeText } from './allocationEngine.js'
import { deduplicateWorkOrdersWithScope } from './workOrdersConstants.js'
import { isValidUuid, resolveWorkerIdFromCatalog } from './workerIdentity.js'
import { resolveDefaultWithdrawalCostCenter } from './workCostRules.js'
import { matchTransactionWorker } from './contractorDeductionsService.js'
import { logCellChange } from './auditService.js'
import { ensurePanolRequirementId } from './panolService.js'
import { inventoryTransactionsRepository } from '../repositories/inventoryTransactionsRepository.js'
import { complianceAlertsRepository } from '../repositories/complianceAlertsRepository.js'

const isAstilleroTag = (raw = '') => {
  const norm = normalizeText(raw)
  return norm === 'ASTILLERO' || norm.startsWith('ASTILLERO.') || norm === 'ALON CAR'
}

const extractItemContractors = (wi) =>
  Array.isArray(wi?.contractors) ? wi.contractors : wi?.contractor_name ? [wi.contractor_name] : []

/** Indica si un operario o contratista está habilitado para imputar en una OT específica del buque. */
export function isContractorEnabledForWorkOrder({
  shipId, workOrderId, contractorName,
  astilleroWorkers = [], contractorGroups = [], workOrders = [], workItems = []
}) {
  if (!shipId || !workOrderId || !contractorName) return true
  const enabledWos = getContractorEnabledWos(
    shipId, contractorName, workOrders, workItems,
    { astilleroWorkers, contractorGroups }, { includeFinalized: true }
  )
  return enabledWos.some(
    (wo) => String(wo.id) === String(workOrderId) || (wo._allWoIds || []).some((id) => String(id) === String(workOrderId))
  )
}

/** Construye opciones (habilitados estrictos vs catálogo expandido) para PanolContractorSelect. */
export function buildPanolContractorSelectModel({
  shipId, workOrderId, isExpanded = false,
  astilleroWorkers = [], contractorGroups = [], workOrders = [], workItems = []
}) {
  let otOrShipEnabled = { astilleroWorkers, contractorGroups }

  if (shipId && workOrderId) {
    const shipWos = (workOrders || []).filter((w) => String(w.ship_id) === String(shipId))
    const deduped = deduplicateWorkOrdersWithScope(shipWos, workItems)
    const matched = deduped.find(
      (w) => String(w.id) === String(workOrderId) || (w._allWoIds || []).some((id) => String(id) === String(workOrderId))
    )
    const targetWoIds = new Set(matched?._allWoIds?.length ? matched._allWoIds : [workOrderId])
    const items = (workItems || []).filter((wi) => targetWoIds.has(wi.work_order_id) && wi.status !== 'Desestimado')
    if (items.length > 0) {
      const rawContractors = items.flatMap(extractItemContractors)
      const hasAstillero = rawContractors.length === 0 || rawContractors.some(isAstilleroTag)
      otOrShipEnabled = {
        astilleroWorkers: hasAstillero ? astilleroWorkers : [],
        contractorGroups: contractorGroups.filter((grp) => rawContractors.some((c) => normalizeText(c) === normalizeText(grp)))
      }
    }
  } else if (shipId) {
    otOrShipEnabled = getShipEnabledContractors(shipId, workOrders, workItems, { astilleroWorkers, contractorGroups }, { strict: true })
  }

  return {
    displayed: isExpanded ? { astilleroWorkers, contractorGroups } : otOrShipEnabled,
    enabledAstSet: new Set(otOrShipEnabled.astilleroWorkers.map((w) => normalizeText(w.name))),
    enabledCntSet: new Set(otOrShipEnabled.contractorGroups.map((g) => normalizeText(g))),
    hasScope: Boolean(shipId),
    scopeLabel: workOrderId ? 'OT' : 'Barco'
  }
}

/** Regla pura de mutación: sincroniza contractor_name/worker_name/worker_id y limpia OT si no habilitado. */
export function evaluateInlineContractorChange({
  tx, newName, astilleroWorkers = [], contractorGroups = [], workOrders = [], workItems = [], workers = [], materials = null
}) {
  const trimmed = String(newName || '').trim()
  const matchedAst = astilleroWorkers.find((w) => normalizeText(w.name) === normalizeText(trimmed))
  const resolvedName = matchedAst ? matchedAst.name : trimmed
  const resolvedWorkerId = matchedAst && isValidUuid(matchedAst.id) ? matchedAst.id : resolveWorkerIdFromCatalog(resolvedName, workers)
  const hasExistingOt = Boolean(tx?.ship_id && tx?.work_order_id)
  const isEnabled = hasExistingOt && resolvedName
    ? isContractorEnabledForWorkOrder({
        shipId: tx.ship_id, workOrderId: tx.work_order_id, contractorName: resolvedName,
        astilleroWorkers, contractorGroups, workOrders, workItems
      })
    : true
  const shouldClearOt = Boolean(hasExistingOt && resolvedName && !isEnabled)
  let nextCostCenter
  if (Array.isArray(materials) && materials.length > 0 && tx?.material_id) {
    const mat = materials.find((m) => m.id === tx.material_id) || null
    const resolvedWorker = matchedAst || matchTransactionWorker({ worker_id: resolvedWorkerId, worker_name: resolvedName, contractor_name: resolvedName }, workers)
    if (mat) nextCostCenter = resolveDefaultWithdrawalCostCenter({ material: mat, worker: resolvedWorker, movementType: tx.movement_type })
  }
  const updates = {
    contractor_name: resolvedName,
    worker_name: resolvedName,
    worker_id: resolvedWorkerId,
    ...(nextCostCenter ? { cost_center: nextCostCenter } : {}),
    ...(shouldClearOt ? { work_order_id: null, work_item_id: null } : {})
  }
  return { resolvedName, resolvedWorkerId, shouldClearOt, updates }
}

/** Resuelve operario/contratista real y su UUID para retiros de Pañol (alta y edición). */
export function resolveWithdrawalWorkerMeta({ contractorGroup, astilleroWorkers = [], workers = [] }) {
  const cleanGroup = String(contractorGroup || '').trim()
  const matchedAst = astilleroWorkers.find((w) => normalizeText(w.name) === normalizeText(cleanGroup)) || null
  const matchedWorker =
    (matchedAst && isValidUuid(matchedAst.id) ? workers.find((w) => w.id === matchedAst.id) : null) ||
    matchTransactionWorker({ worker_id: matchedAst?.id || null, worker_name: cleanGroup, contractor_name: cleanGroup }, workers) ||
    matchedAst
  const workerName = matchedAst ? matchedAst.name : (cleanGroup || 'Sin asignar')
  const workerId = matchedAst && isValidUuid(matchedAst.id)
    ? matchedAst.id
    : (isValidUuid(matchedWorker?.id) ? matchedWorker.id : null)
  return { workerName, workerId, resolvedWorker: matchedWorker || null }
}

/** Resuelve movement_type y cost_center por defecto según GS-002 / DEC-009 respetando override manual de Admin. */
export function resolveWithdrawalCostCenterForSave({ material, worker, customCostCenter = '', originalTx = null, workerName = '' }) {
  const movementType = material?.category === 'ELEM.SEGURIDAD' ? 'ENTREGA_EPP' : 'CONSUMO_OBRA'
  const autoCenter = resolveDefaultWithdrawalCostCenter({ material, worker, movementType })
  const cleanCustom = String(customCostCenter || '').trim().toUpperCase()
  if (!originalTx) return { movementType, costCenter: cleanCustom || autoCenter }
  const matChanged = originalTx.material_id !== material?.id
  const workerChanged = normalizeText(originalTx.worker_name || originalTx.contractor_name) !== normalizeText(workerName)
  const keptOriginalCustom = !cleanCustom || cleanCustom === String(originalTx.cost_center || '').trim().toUpperCase()
  return { movementType, costCenter: (matChanged || workerChanged) && keptOriginalCustom ? autoCenter : (cleanCustom || autoCenter) }
}

/** Deriva movement_type y cost_center al cambiar el material inline en un retiro existente. */
export function evaluateInlineMaterialCostCenter({ tx, targetMat, workers = [] }) {
  const movementType = targetMat?.category === 'ELEM.SEGURIDAD' ? 'ENTREGA_EPP' : 'CONSUMO_OBRA'
  if (!Array.isArray(workers) || workers.length === 0) return { movement_type: movementType }
  const worker = matchTransactionWorker(tx, workers)
  return {
    movement_type: movementType,
    cost_center: resolveDefaultWithdrawalCostCenter({ material: targetMat, worker, movementType })
  }
}

/** Persiste cambio de Operario/Contratista inline, borra OT no habilitada, alerta y audita. */
export async function saveInlineContractorService({
  tx, newName, ships = [], workOrders = [], workItems = [],
  astilleroWorkers = [], contractorGroups = [], workers = [], materials = [], user = null
}) {
  if (!tx?.id) throw new Error('Movimiento inválido para actualizar contratista.')
  const { resolvedName, shouldClearOt, updates } = evaluateInlineContractorChange({
    tx, newName, astilleroWorkers, contractorGroups, workOrders, workItems, workers, materials
  })
  const { error } = await inventoryTransactionsRepository.updateById(tx.id, updates, { select: null })
  if (error) throw new Error(error)

  const prevWo = tx.work_order_id ? workOrders.find((w) => String(w.id) === String(tx.work_order_id)) : null
  const prevWoLabel = prevWo ? `${prevWo.ot_number ? `#${prevWo.ot_number} ` : ''}${prevWo.title || ''}`.trim() : (tx.work_order_id || '')

  if (shouldClearOt && tx.ship_id) {
    const reqId = await ensurePanolRequirementId('REQ_PANOL_RETIRO_SIN_OT')
    const shipName = ships.find((s) => String(s.id) === String(tx.ship_id))?.name || tx.ship_id
    const { error: alertErr } = await complianceAlertsRepository.insertOne({
      requirement_id: reqId, entity_type: 'inventory_transactions', entity_id: tx.id,
      ship_id: tx.ship_id, responsible_role: 'admin', escalated_to_admin: true, status: 'PENDIENTE',
      alert_message: `Retiro quedó Sin OT (aviso de trabajo no informado): se asignó ${resolvedName} en buque ${shipName} (OT anterior: ${prevWoLabel || 'Sin datos'}).`
    })
    if (alertErr) throw new Error(alertErr)
  }

  const auditBase = {
    entityType: 'inventory_transactions', entityId: tx.id, entityName: tx.material_id || tx.id,
    sheetName: 'Pañol · Stock y Movimientos', moduleRoute: '/panol', changeOrigin: 'INLINE_CELL', user: user?.email
  }
  await logCellChange({
    ...auditBase, field: 'contractor_name', fieldLabel: 'Contratista / Operario',
    oldValue: tx.worker_name || tx.contractor_name || '', newValue: resolvedName
  })
  if (shouldClearOt) {
    await logCellChange({
      ...auditBase, field: 'work_order_id', fieldLabel: 'Orden de Trabajo (OT)',
      oldValue: prevWoLabel || tx.work_order_id, newValue: 'Sin OT (borrada por contratista no habilitado)'
    })
  }
  return { updates, shouldClearOt, resolvedName, previousWoId: tx.work_order_id || null }
}
