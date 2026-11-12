/**
 * laborService.js
 * Capa de servicio y persistencia desacoplada para Mano de Obra, Partes Diarios y Sábana Quincenal (M3).
 * Cumple Candado Mecánico #3 (Cero SQL en Vista) y #4 (Trazabilidad en audit_logs).
 */

import { supabase } from '../lib/supabase.js'
import { logCellChange, logRowAction } from '../lib/auditService.js'
import { assignMonotonicFolios, stampNewRecordWithFolio } from '../lib/monotonicFolioEngine.js'

/**
 * Carga completa de imputaciones de mano de obra, buques, OTs y personal habilitado.
 */
export async function fetchLaborData() {
  const [logsRes, shipsRes, woRes, workItemsRes, workersRes] = await Promise.all([
    supabase
      .from('labor_logs')
      .select('*, ships(id, name), work_orders(id, ot_number, title, ship_id)')
      .order('date_logged', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(1500),
    supabase.from('ships').select('id, name, status').order('name'),
    supabase.from('work_orders').select('id, ot_number, title, ship_id, status').order('ot_number'),
    supabase.from('work_items').select('id, work_order_id, contractors, description, status, work_type'),
    supabase.from('workers').select('id, name, category, trade, work_group, admin_center, status, can_impute_hours').order('name')
  ])

  if (logsRes.error) {
    console.error('[laborService] Error cargando labor_logs:', logsRes.error)
  }

  const laborLogs = logsRes.data && logsRes.data.length > 0
    ? assignMonotonicFolios(logsRes.data, { dateField: 'date_logged' })
    : []

  return {
    laborLogs,
    ships: shipsRes.data || [],
    workOrders: woRes.data || [],
    workItems: workItemsRes.data || [],
    workers: workersRes.data || []
  }
}

/**
 * Guarda o actualiza una imputación de horas en labor_logs con trazabilidad en audit_logs.
 */
export async function saveLaborLogService({ log, isNew = false, changedBy = 'Operador Web' }) {
  if (!log) throw new Error('Datos de parte de mano de obra requeridos.')

  let payload = { ...log }
  if (isNew) {
    payload = stampNewRecordWithFolio(payload, 'labor_logs')
  }

  // Descartar joins para evitar errores de mutación en PostgREST
  delete payload.ships
  delete payload.work_orders

  const { data, error } = await supabase
    .from('labor_logs')
    .upsert([payload], { onConflict: 'id' })
    .select()

  if (error) {
    console.error('[laborService] Error guardando labor_log:', error)
    throw error
  }

  const savedRecord = data?.[0] || payload

  logRowAction({
    action: isNew ? 'CREATE' : 'UPDATE',
    entityType: 'labor_logs',
    entityId: savedRecord.id,
    entityName: `${savedRecord.worker_name || 'Operario'} · ${savedRecord.date_logged || savedRecord.date || 'S/F'}`,
    performedBy: changedBy,
    details: {
      ship_id: savedRecord.ship_id,
      work_order_id: savedRecord.work_order_id,
      hours_normal: savedRecord.hours_normal,
      hours_extra_50: savedRecord.hours_extra_50,
      hours_extra_100: savedRecord.hours_extra_100,
      rubro: savedRecord.rubro
    }
  })

  return { ok: true, log: savedRecord }
}

/**
 * Elimina una imputación de horas con registro en audit_logs.
 */
export async function deleteLaborLogService({ logId, workerName = 'Operario', shipName = 'Buque', changedBy = 'Operador Web' }) {
  if (!logId) throw new Error('ID de imputación requerido para eliminación.')

  const { error } = await supabase
    .from('labor_logs')
    .delete()
    .eq('id', logId)

  if (error) {
    console.error('[laborService] Error eliminando labor_log:', error)
    throw error
  }

  logRowAction({
    action: 'DELETE',
    entityType: 'labor_logs',
    entityId: logId,
    entityName: `${workerName} (${shipName})`,
    performedBy: changedBy,
    details: { deletedAt: new Date().toISOString() }
  })

  return { ok: true }
}

/**
 * Actualiza el estado de aprobación de una imputación (PENDIENTE / APROBADO / OBSERVADO).
 */
export async function updateLaborApprovalStatusService({ logId, approvalStatus, workerName = 'Operario', changedBy = 'Operador Web' }) {
  if (!logId) throw new Error('ID requerido.')

  const { error } = await supabase
    .from('labor_logs')
    .update({ approval_status: approvalStatus })
    .eq('id', logId)

  if (error) {
    console.error('[laborService] Error actualizando approval_status:', error)
    throw error
  }

  logCellChange({
    entityType: 'labor_logs',
    entityId: logId,
    entityName: workerName,
    field: 'approval_status',
    fieldLabel: 'Estado de Aprobación',
    oldValue: 'PENDIENTE',
    newValue: approvalStatus,
    changeOrigin: 'APPROVAL_ACTION',
    performedBy: changedBy
  })

  return { ok: true }
}

/**
 * Inserta masivamente partes diarios generados por el motor de IA o cuadrilla rápida.
 */
export async function batchSaveLaborLogsService({ logs = [], changedBy = 'Operador Web' }) {
  if (logs.length === 0) return { ok: true, count: 0 }

  const cleanLogs = logs.map(l => {
    const copy = { ...l }
    delete copy.ships
    delete copy.work_orders
    return copy
  })

  const { data, error } = await supabase
    .from('labor_logs')
    .insert(cleanLogs)
    .select()

  if (error) {
    console.error('[laborService] Error insertando lote de labor_logs:', error)
    throw error
  }

  logRowAction({
    action: 'BATCH_INSERT',
    entityType: 'labor_logs',
    entityId: `batch_${Date.now()}`,
    entityName: `Lote de ${cleanLogs.length} partes diarios`,
    performedBy: changedBy,
    details: { total_filas: cleanLogs.length }
  })

  return { ok: true, count: data?.length || cleanLogs.length, logs: data || cleanLogs }
}
