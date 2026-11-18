/**
 * personalService.js
 * Capa de servicio y persistencia desacoplada para Recursos Humanos, Personal y Tarifas (M8).
 * Cumple Candado Mecánico #3 (Cero SQL en Vista) y #4 (Trazabilidad en audit_logs).
 */

import { logCellChange, logRowAction } from '../lib/auditService.js'
import { assignMonotonicFolios, stampNewRecordWithFolio } from '../lib/monotonicFolioEngine.js'
import { rateCardsRepository } from '../repositories/rateCardsRepository.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { organizationRolesRepository } from '../repositories/organizationRolesRepository.js'

/**
 * Carga completa del padrón de personal, tarifarios y roles organizacionales.
 */
export async function fetchPersonalData() {
  const [workersRes, rateCardsRes, rolesRes] = await Promise.all([
    workersRepository.listWorkers(),
    rateCardsRepository.listRateCards(),
    organizationRolesRepository.listRoles(),
  ])

  if (workersRes.error) {
    console.error('[personalService] Error cargando nómina de workers:', workersRes.error)
  }

  const workers = workersRes.data && workersRes.data.length > 0
    ? assignMonotonicFolios(workersRes.data, { dateField: 'created_at' })
    : []

  return {
    workers,
    rateCards: rateCardsRes.data || [],
    organizationRoles: rolesRes.data || [],
  }
}

/**
 * Guarda o actualiza un operario/contratista en la tabla workers con trazabilidad en audit_logs.
 */
export async function saveWorkerService({ worker, isNew = false, changedBy = 'Operador Web' }) {
  if (!worker) throw new Error('Datos de operario requeridos.')

  let payload = { ...worker }
  if (isNew) {
    payload = stampNewRecordWithFolio(payload, 'workers')
  }

  const { data: savedRecord, error } = await workersRepository.upsertOne(payload, { onConflict: 'id' })
  if (error) {
    console.error('[personalService] Error guardando operario:', error)
    throw new Error(error)
  }

  logRowAction({
    action: isNew ? 'CREATE' : 'UPDATE',
    entityType: 'workers',
    entityId: savedRecord.id,
    entityName: savedRecord.name || 'Operario',
    performedBy: changedBy,
    details: { admin_center: savedRecord.admin_center, trade: savedRecord.trade, status: savedRecord.status },
  })

  return { ok: true, worker: savedRecord }
}

/**
 * Elimina un operario de workers con registro en audit_logs.
 */
export async function deleteWorkerService({ workerId, workerName = 'Operario', changedBy = 'Operador Web' }) {
  if (!workerId) throw new Error('ID de operario requerido para eliminación.')

  const { error } = await workersRepository.deleteById(workerId)
  if (error) {
    console.error('[personalService] Error eliminando operario:', error)
    throw new Error(error)
  }

  logRowAction({
    action: 'DELETE',
    entityType: 'workers',
    entityId: workerId,
    entityName: workerName,
    performedBy: changedBy,
    details: { deletedAt: new Date().toISOString() },
  })

  return { ok: true }
}

/**
 * Actualiza en lote el estado (ACTIVO / INACTIVO) de operarios seleccionados.
 */
export async function batchUpdateWorkerStatusService({ workerIds = [], targetStatus = 'ACTIVO', changedBy = 'Operador Web' }) {
  if (workerIds.length === 0) return { ok: true, count: 0 }

  const { error } = await workersRepository.updateWorkersByIds(workerIds, { status: targetStatus })
  if (error) {
    console.error('[personalService] Error actualizando estado en lote:', error)
    throw new Error(error)
  }

  workerIds.forEach((wId) => {
    logCellChange({
      entityType: 'workers',
      entityId: wId,
      entityName: `Operario #${wId}`,
      field: 'status',
      fieldLabel: 'Estado Operario',
      oldValue: targetStatus === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO',
      newValue: targetStatus,
      changeOrigin: 'BATCH_ACTION',
      performedBy: changedBy,
    })
  })

  return { ok: true, count: workerIds.length }
}

/**
 * Guarda o actualiza un registro en el tarifario quincenal (rate_cards) con trazabilidad en audit_logs.
 */
export async function saveRateCardService({ rateCard, isNew = false, changedBy = 'Operador Web' }) {
  if (!rateCard) throw new Error('Datos de tarifario requeridos.')

  const { data, error } = await rateCardsRepository.saveRateCard(rateCard, {
    isNew,
    changedBy,
  })

  if (error) {
    console.error('[personalService] Error guardando tarifario:', error)
    throw new Error(error)
  }

  return { ok: true, rateCard: data }
}

export * from './personalNominaService.js'
