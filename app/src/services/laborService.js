/**
 * laborService.js
 * Capa de servicio y persistencia desacoplada para Mano de Obra, Partes Diarios y Sábana Quincenal (M3).
 * Cumple Candado Mecánico #3 (Cero SQL en Vista) y #4 (Trazabilidad en audit_logs).
 */

import { logCellChange, logRowAction } from '../lib/auditService.js'
import { assignMonotonicFolios, stampNewRecordWithFolio } from '../lib/monotonicFolioEngine.js'
import { getWorkersLookupCached, stampWorkerIdOnRecord } from '../lib/workerIdentity.js'
import { laborLogsRepository } from '../repositories/laborLogsRepository.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { shipsRepository } from '../repositories/shipsRepository.js'
import { shipStaysRepository } from '../repositories/shipStaysRepository.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { workItemsRepository } from '../repositories/workItemsRepository.js'
import { buildDateRangeOption, DEFAULT_HISTORY_RANGE } from '../lib/gridPerformanceHelpers.js'

/**
 * Carga completa de imputaciones de mano de obra, buques, OTs y personal habilitado.
 * Respeta ventana histórica configurable (`90d` | `year` | `all`) sin techo de 1.000 filas (FL-025).
 */
export async function fetchLaborData({ historyRange = DEFAULT_HISTORY_RANGE } = {}) {
  const dateRange = buildDateRangeOption('date_logged', historyRange)
  const [logsRes, shipsRes, staysRes, woRes, workItemsRes, workersRes] = await Promise.all([
    laborLogsRepository.listLaborLogs({ dateRange }),
    shipsRepository.listShips({ select: 'id, name, status, current_location, is_active' }),
    shipStaysRepository.listStays({ select: 'id, ship_id, location, start_date, end_date' }),
    workOrdersRepository.listCanonicalWorkOrders(),
    workItemsRepository.listCanonicalWorkItems(),
    workersRepository.listWorkers({
      select: 'id, name, category, trade, work_group, admin_center, status, can_impute_hours',
      orderBy: [{ column: 'name', ascending: true }],
    }),
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
    shipStays: staysRes.data || [],
    workOrders: woRes.data || [],
    workItems: workItemsRes.data || [],
    workers: workersRes.data || [],
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

  delete payload.ships
  delete payload.work_orders

  if (!payload.worker_id && payload.worker_name) {
    const workersCatalog = await getWorkersLookupCached()
    payload = stampWorkerIdOnRecord(payload, workersCatalog)
  }

  const { data: savedRecord, error } = await laborLogsRepository.upsertOne(payload, { onConflict: 'id' })
  if (error) {
    console.error('[laborService] Error guardando labor_log:', error)
    throw new Error(error)
  }

  await logRowAction({
    action: isNew ? 'ROW_INSERT' : 'MODAL_SAVE',
    entityType: 'daily_labor_logs',
    entityId: savedRecord.id,
    entityName: `${savedRecord.worker_name || 'Operario'} · ${savedRecord.date_logged || savedRecord.date || 'S/F'}`,
    sheetName: 'Carga e Imputación de Horas',
    moduleRoute: '/horas',
    user: changedBy,
    changes: {
      ship_id: savedRecord.ship_id,
      work_order_id: savedRecord.work_order_id,
      hours_normal: savedRecord.hours_normal,
      hours_extra_50: savedRecord.hours_extra_50,
      hours_extra_100: savedRecord.hours_extra_100,
      rubro: savedRecord.rubro,
    },
  })

  return { ok: true, log: savedRecord }
}

/**
 * Elimina una imputación de horas con registro en audit_logs.
 */
export async function deleteLaborLogService({ logId, workerName = 'Operario', shipName = 'Buque', changedBy = 'Operador Web' }) {
  if (!logId) throw new Error('ID de imputación requerido para eliminación.')

  const { error } = await laborLogsRepository.deleteById(logId)
  if (error) {
    console.error('[laborService] Error eliminando labor_log:', error)
    throw new Error(error)
  }

  await logRowAction({
    action: 'ROW_DELETE',
    entityType: 'daily_labor_logs',
    entityId: logId,
    entityName: `${workerName} (${shipName})`,
    sheetName: 'Carga e Imputación de Horas',
    moduleRoute: '/horas',
    user: changedBy,
    changes: { deletedAt: new Date().toISOString() },
  })

  return { ok: true }
}

/**
 * Actualiza el estado de aprobación de una imputación (S / R / RR / RRR).
 */
export async function updateLaborApprovalStatusService({ logId, approvalStatus, oldStatus = '', workerName = 'Operario', changedBy = 'Operador Web' }) {
  if (!logId) throw new Error('ID requerido.')

  const { error } = await laborLogsRepository.updateById(logId, { approval_status: approvalStatus }, { select: null })
  if (error) {
    console.error('[laborService] Error actualizando approval_status:', error)
    throw new Error(error)
  }

  await logCellChange({
    entityType: 'daily_labor_logs',
    entityId: logId,
    entityName: workerName,
    field: 'approval_status',
    fieldLabel: 'Estado de Aprobación',
    oldValue: oldStatus || '-',
    newValue: approvalStatus || '-',
    sheetName: 'Carga e Imputación de Horas',
    moduleRoute: '/horas',
    changeOrigin: 'APPROVAL_ACTION',
    user: changedBy,
  })

  return { ok: true }
}

/**
 * Inserta masivamente partes diarios generados por el motor de IA o cuadrilla rápida.
 */
export async function batchSaveLaborLogsService({ logs = [], changedBy = 'Operador Web' }) {
  if (logs.length === 0) return { ok: true, count: 0 }

  let cleanLogs = logs.map((l) => {
    const copy = { ...l }
    delete copy.ships
    delete copy.work_orders
    return copy
  })

  if (cleanLogs.some((l) => !l.worker_id && l.worker_name)) {
    const workersCatalog = await getWorkersLookupCached()
    cleanLogs = cleanLogs.map((l) => stampWorkerIdOnRecord(l, workersCatalog))
  }

  const { data, error } = await laborLogsRepository.insertMany(cleanLogs)
  if (error) {
    console.error('[laborService] Error insertando lote de labor_logs:', error)
    throw new Error(error)
  }

  logRowAction({
    action: 'BATCH_INSERT',
    entityType: 'labor_logs',
    entityId: `batch_${Date.now()}`,
    entityName: `Lote de ${cleanLogs.length} partes diarios`,
    performedBy: changedBy,
    details: { total_filas: cleanLogs.length },
  })

  return { ok: true, count: data?.length || cleanLogs.length, logs: data || cleanLogs }
}

/**
 * Actualiza un parte diario de horas puntual (Control Diario / Modales) sin SQL en JSX.
 */
export async function patchLaborLogService(logId, payload) {
  if (!logId) throw new Error('ID de imputación requerido.')
  const { error } = await laborLogsRepository.updateById(logId, payload, { select: null })
  if (error) throw new Error(error)
  return { ok: true }
}

/**
 * Crea un parte rápido de Control Diario devolviendo relaciones Buque/OT para la UI.
 */
export async function createLaborLogWithRelationsService(payload) {
  let clean = { ...payload }
  delete clean.ships
  delete clean.work_orders
  if (!clean.worker_id && clean.worker_name) {
    const workersCatalog = await getWorkersLookupCached()
    clean = stampWorkerIdOnRecord(clean, workersCatalog)
  }
  const { data, error } = await laborLogsRepository.insertOne(clean, {
    select: '*, ships(id, name), work_orders(id, ot_number, title, ship_id, work_type)',
  })
  if (error) throw new Error(error)
  return data
}

export * from './laborCargaService.js'
