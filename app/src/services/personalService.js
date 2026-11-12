/**
 * personalService.js
 * Capa de servicio y persistencia desacoplada para Recursos Humanos, Personal y Tarifas (M8).
 * Cumple Candado Mecánico #3 (Cero SQL en Vista) y #4 (Trazabilidad en audit_logs).
 */

import { supabase } from '../lib/supabase.js'
import { logCellChange, logRowAction } from '../lib/auditService.js'
import { assignMonotonicFolios, stampNewRecordWithFolio } from '../lib/monotonicFolioEngine.js'

/**
 * Carga completa del padrón de personal, tarifarios y roles organizacionales.
 */
export async function fetchPersonalData() {
  const [workersRes, rateCardsRes, rolesRes] = await Promise.all([
    supabase
      .from('workers')
      .select('*')
      .order('admin_center', { ascending: true })
      .order('work_group', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('rate_cards')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .order('quincena', { ascending: false }),
    supabase
      .from('organization_roles')
      .select('*')
      .order('department', { ascending: true })
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
    organizationRoles: rolesRes.data || []
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

  const { data, error } = await supabase
    .from('workers')
    .upsert([payload], { onConflict: 'id' })
    .select()

  if (error) {
    console.error('[personalService] Error guardando operario:', error)
    throw error
  }

  const savedRecord = data?.[0] || payload

  logRowAction({
    action: isNew ? 'CREATE' : 'UPDATE',
    entityType: 'workers',
    entityId: savedRecord.id,
    entityName: savedRecord.name || 'Operario',
    performedBy: changedBy,
    details: { admin_center: savedRecord.admin_center, trade: savedRecord.trade, status: savedRecord.status }
  })

  return { ok: true, worker: savedRecord }
}

/**
 * Elimina un operario de workers con registro en audit_logs.
 */
export async function deleteWorkerService({ workerId, workerName = 'Operario', changedBy = 'Operador Web' }) {
  if (!workerId) throw new Error('ID de operario requerido para eliminación.')

  const { error } = await supabase
    .from('workers')
    .delete()
    .eq('id', workerId)

  if (error) {
    console.error('[personalService] Error eliminando operario:', error)
    throw error
  }

  logRowAction({
    action: 'DELETE',
    entityType: 'workers',
    entityId: workerId,
    entityName: workerName,
    performedBy: changedBy,
    details: { deletedAt: new Date().toISOString() }
  })

  return { ok: true }
}

/**
 * Actualiza en lote el estado (ACTIVO / INACTIVO) de operarios seleccionados.
 */
export async function batchUpdateWorkerStatusService({ workerIds = [], targetStatus = 'ACTIVO', changedBy = 'Operador Web' }) {
  if (workerIds.length === 0) return { ok: true, count: 0 }

  const { error } = await supabase
    .from('workers')
    .update({ status: targetStatus })
    .in('id', workerIds)

  if (error) {
    console.error('[personalService] Error actualizando estado en lote:', error)
    throw error
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
      performedBy: changedBy
    })
  })

  return { ok: true, count: workerIds.length }
}

/**
 * Guarda o actualiza un registro en el tarifario quincenal (rate_cards) con trazabilidad en audit_logs.
 */
export async function saveRateCardService({ rateCard, isNew = false, changedBy = 'Operador Web' }) {
  if (!rateCard) throw new Error('Datos de tarifario requeridos.')

  const { data, error } = await supabase
    .from('rate_cards')
    .upsert([rateCard], { onConflict: 'period,admin_center,entity_name' })
    .select()

  if (error) {
    console.error('[personalService] Error guardando tarifario:', error)
    throw error
  }

  const savedRecord = data?.[0] || rateCard

  logRowAction({
    action: isNew ? 'CREATE' : 'UPDATE',
    entityType: 'rate_cards',
    entityId: savedRecord.id || `${savedRecord.period}_${savedRecord.entity_name}`,
    entityName: `${savedRecord.period} · ${savedRecord.entity_name}`,
    performedBy: changedBy,
    details: {
      rate_oficial_ars: savedRecord.rate_oficial_ars,
      rate_oficial_usd: savedRecord.rate_oficial_usd,
      dollar_rate: savedRecord.dollar_rate
    }
  })

  return { ok: true, rateCard: savedRecord }
}
