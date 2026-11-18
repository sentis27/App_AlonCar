/**
 * laborCargaService.js
 * Capa de persistencia y auditoría desacoplada para LaborCargaPanel (M3).
 * Cumple Candado #3 (Cero SQL en vistas/hooks) y Candado #4 (Trazabilidad en audit_logs).
 */

import { auditService } from '../lib/auditService.js'
import { HOUR_NUMERIC_FIELDS } from '../lib/laborCargaGridHelpers.js'
import { resolveSingleWorkItemId } from '../lib/workOrderUnificationEngine.js'
import { getWorkersLookupCached, resolveWorkerIdFromCatalog, stampWorkerIdOnRecord } from '../lib/workerIdentity.js'
import { laborLogsRepository } from '../repositories/laborLogsRepository.js'
import { shipsRepository } from '../repositories/shipsRepository.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'

const SHEET_NAME = 'Carga e Imputación de Horas'
const MODULE_ROUTE = '/horas'

/**
 * Inserta un lote de imputaciones de cuadrilla y registra auditoría.
 */
export async function insertLaborBatchService({
  payload = [],
  totalHorasGenerales = 0,
  changeOrigin = 'BATCH_CREW_FORM',
  userEmail = null,
}) {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error('El lote de imputaciones está vacío.')
  }

  let safePayload = payload
  if (safePayload.some((row) => !row.worker_id && row.worker_name)) {
    const workersCatalog = await getWorkersLookupCached()
    safePayload = safePayload.map((row) => stampWorkerIdOnRecord(row, workersCatalog))
  }

  const { error } = await laborLogsRepository.insertMany(safePayload, { select: null })
  if (error) throw new Error(error)

  await auditService.logRowAction({
    action: 'ROW_INSERT',
    entityType: 'daily_labor_logs',
    entityId: `batch_${Date.now()}`,
    entityName: `Lote cuadrilla (${payload.length} filas · ${totalHorasGenerales} hs)`,
    changes: { total_filas: payload.length, total_horas: totalHorasGenerales },
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
    changeOrigin,
    user: userEmail,
  })

  return { ok: true, count: payload.length }
}

/**
 * Actualiza en lote celdas de la grilla de horas (soporta horas recalculadas, ship_wo y escalares).
 */
export async function batchUpdateLaborLogsService({
  colKey,
  newValue,
  targetIds = [],
  recentLogs = [],
  workItems = [],
  userEmail = null,
}) {
  if (!targetIds || targetIds.length === 0) return { ok: true, count: 0 }

  if (HOUR_NUMERIC_FIELDS.includes(colKey)) {
    const num = parseFloat(newValue) || 0
    await Promise.all(
      targetIds.map(async (id) => {
        const targetLog = recentLogs.find((x) => x.id === id)
        const n = colKey === 'hours_normal' ? num : (parseFloat(targetLog?.hours_normal) || 0)
        const h50 = colKey === 'hours_extra_50' ? num : (parseFloat(targetLog?.hours_extra_50) || 0)
        const h100 = colKey === 'hours_extra_100' ? num : (parseFloat(targetLog?.hours_extra_100) || 0)
        const { error } = await laborLogsRepository.updateById(
          id,
          { [colKey]: num, hours_worked: n + h50 + h100 },
          { select: null }
        )
        if (error) throw new Error(error)
      })
    )
  } else {
    const payload = {}
    if (colKey === 'ship_wo' && newValue && typeof newValue === 'object') {
      payload.ship_id = newValue.ship_id ?? null
      payload.work_order_id = newValue.work_order_id ?? null
      payload.work_item_id = payload.work_order_id
        ? (newValue.work_item_id ?? resolveSingleWorkItemId(payload.work_order_id, workItems))
        : null
    } else if (colKey === 'work_type') {
      const upperWt = String(newValue || '').trim().toUpperCase()
      payload.work_type = ['HORA', 'PRESUPUESTO', 'CONTROL'].includes(upperWt) ? upperWt : 'HORA'
    } else if (colKey === 'worker_name') {
      payload.worker_name = newValue
      const workersCatalog = await getWorkersLookupCached()
      payload.worker_id = resolveWorkerIdFromCatalog(newValue, workersCatalog)
    } else {
      payload[colKey] = newValue
    }
    const { error } = await laborLogsRepository.updateByIds(targetIds, payload, { select: null })
    if (error) throw new Error(error)
  }

  await auditService.logRowAction({
    action: 'CELL_EDIT',
    entityType: 'daily_labor_logs',
    entityId: targetIds.length === 1 ? String(targetIds[0]) : `batch_${targetIds.length}`,
    entityName: `Edición masiva ${colKey} (${targetIds.length} filas)`,
    changes: { field: colKey, target_ids: targetIds },
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
    changeOrigin: 'GRID_BATCH_EDIT',
    user: userEmail,
  })

  return { ok: true, count: targetIds.length }
}

/**
 * Persiste una edición inline de celda en labor_logs con trazabilidad en audit_logs.
 */
export async function updateInlineLaborLogService({
  logId,
  field,
  cleanedVal,
  extraPayload = {},
  targetLog = {},
  userEmail = null,
}) {
  const finalExtra = { ...extraPayload }
  if (field === 'worker_name' && !finalExtra.worker_id) {
    const workersCatalog = await getWorkersLookupCached()
    finalExtra.worker_id = resolveWorkerIdFromCatalog(cleanedVal, workersCatalog)
  }

  const { error } = await laborLogsRepository.updateById(
    logId,
    { [field]: cleanedVal, ...finalExtra },
    { select: null }
  )
  if (error) throw new Error(error)

  await auditService.logCellChange({
    entityType: 'daily_labor_logs',
    entityId: logId,
    entityName: `${targetLog.worker_name || 'Operario'} ${targetLog.date_logged || ''}`.trim(),
    field,
    fieldLabel: field,
    oldValue: targetLog[field],
    newValue: cleanedVal,
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
    changeOrigin: 'INLINE_CELL',
    user: userEmail,
  })

  return { ok: true }
}

/**
 * Inserta una fila en blanco al inicio de la grilla y devuelve el registro con relaciones.
 */
export async function insertBlankLaborLogService({ newPayload, userEmail = null }) {
  const { data, error } = await laborLogsRepository.insertBlankRow(newPayload)
  if (error) throw new Error(error)

  await auditService.logRowAction({
    action: 'ROW_INSERT',
    entityType: 'daily_labor_logs',
    entityId: data.id,
    entityName: 'Nueva fila en blanco',
    rowData: newPayload,
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
    changeOrigin: 'GRID_RIBBON_INSERT',
    user: userEmail,
  })

  return data
}

/**
 * Crea buque (si no existe) y una OT urgente en ejecución para asignación rápida.
 */
export async function quickCreateShipAndWoService({
  shipNameClean,
  existingShip = null,
  workerName = 'cuadrilla',
  userEmail = null,
}) {
  let targetShip = existingShip
  if (!targetShip) {
    const { data: shipData, error: shipErr } = await shipsRepository.insertOne({
      name: shipNameClean,
      client_name: shipNameClean,
      status: 'Activo',
    })
    if (shipErr) throw new Error(shipErr)
    targetShip = shipData
  }

  const otNumber = `OT-${Date.now().toString().slice(-4)}`
  const { data: woData, error: woErr } = await workOrdersRepository.insertOne({
    ship_id: targetShip.id,
    ot_number: otNumber,
    title: `${otNumber}: Apertura Urgente (${shipNameClean})`,
    description: `Creada automáticamente desde parte diario para imputación de ${workerName || 'cuadrilla'}.`,
    status: 'En ejecución',
  })

  if (woErr) throw new Error(woErr)

  await auditService.logRowAction({
    action: 'ROW_INSERT',
    entityType: 'work_orders',
    entityId: woData.id,
    entityName: `${otNumber} · ${shipNameClean}`,
    rowData: woData,
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
    changeOrigin: 'QUICK_CREATE_FROM_LABOR',
    user: userEmail,
  })

  return { targetShip, woData, otNumber }
}

/**
 * Actualiza Buque y OT desde ShipWorkOrderPickerModal con registro en audit_logs.
 */
export async function updateLaborShipWoService({
  logId,
  shipId,
  workOrderId,
  workItemId = null,
  workItems = [],
  targetLog = {},
  inferredWorkType = null,
  userEmail = null,
}) {
  const currentWt = String(targetLog.work_type || '').trim().toUpperCase()
  const validInferred = ['HORA', 'PRESUPUESTO', 'CONTROL'].includes(String(inferredWorkType || '').trim().toUpperCase())
    ? String(inferredWorkType).trim().toUpperCase()
    : null
  const shouldInheritWorkType =
    Boolean(validInferred) && (!targetLog.work_order_id || !['HORA', 'PRESUPUESTO', 'CONTROL'].includes(currentWt))

  const resolvedWiId = workOrderId ? (workItemId ?? resolveSingleWorkItemId(workOrderId, workItems)) : null
  const payload = {
    ship_id: shipId || null,
    work_order_id: workOrderId || null,
    work_item_id: resolvedWiId,
    ...(shouldInheritWorkType ? { work_type: validInferred } : {}),
    ...(workOrderId
      ? { approval_status: 'Aprobado', review_reason: null }
      : { approval_status: 'R', review_reason: 'Falta Cargar OT' }),
  }
  const { error } = await laborLogsRepository.updateById(logId, payload, { select: null })
  if (error) throw new Error(error)

  await auditService.logRowAction({
    action: 'CELL_EDIT',
    entityType: 'daily_labor_logs',
    entityId: logId,
    entityName: `${targetLog.worker_name || 'Operario'} ${targetLog.date_logged || ''}`.trim(),
    changes: {
      ship_id: { from: targetLog.ship_id || null, to: payload.ship_id },
      work_order_id: { from: targetLog.work_order_id || null, to: payload.work_order_id },
    },
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
    changeOrigin: 'SHIP_WO_PICKER',
    user: userEmail,
  })

  return payload
}
