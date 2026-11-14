/**
 * laborCargaService.js
 * Capa de persistencia y auditoría desacoplada para LaborCargaPanel (M3).
 * Cumple Candado #3 (Cero SQL en vistas/hooks) y Candado #4 (Trazabilidad en audit_logs).
 */

import { supabase } from '../lib/supabase.js'
import { auditService } from '../lib/auditService.js'
import { HOUR_NUMERIC_FIELDS } from '../lib/laborCargaGridHelpers.js'

const SHEET_NAME = 'Carga e Imputación de Horas'
const MODULE_ROUTE = '/horas'

/**
 * Inserta un lote de imputaciones de cuadrilla y registra auditoría.
 */
export async function insertLaborBatchService({ payload = [], totalHorasGenerales = 0, userEmail = null }) {
  if (!Array.isArray(payload) || payload.length === 0) {
    throw new Error('El lote de imputaciones está vacío.')
  }

  const { error } = await supabase.from('labor_logs').insert(payload)
  if (error) throw error

  await auditService.logRowAction({
    action: 'ROW_INSERT',
    entityType: 'daily_labor_logs',
    entityId: `batch_${Date.now()}`,
    entityName: `Lote cuadrilla (${payload.length} filas · ${totalHorasGenerales} hs)`,
    changes: { total_filas: payload.length, total_horas: totalHorasGenerales },
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
    changeOrigin: 'BATCH_CREW_FORM',
    user: userEmail
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
  userEmail = null
}) {
  if (!targetIds || targetIds.length === 0) return { ok: true, count: 0 }

  if (HOUR_NUMERIC_FIELDS.includes(colKey)) {
    const num = parseFloat(newValue) || 0
    await Promise.all(
      targetIds.map(async (id) => {
        const targetLog = recentLogs.find(x => x.id === id)
        const n = colKey === 'hours_normal' ? num : (parseFloat(targetLog?.hours_normal) || 0)
        const h50 = colKey === 'hours_extra_50' ? num : (parseFloat(targetLog?.hours_extra_50) || 0)
        const h100 = colKey === 'hours_extra_100' ? num : (parseFloat(targetLog?.hours_extra_100) || 0)
        const { error } = await supabase
          .from('labor_logs')
          .update({ [colKey]: num, hours_worked: n + h50 + h100 })
          .eq('id', id)
        if (error) throw error
      })
    )
  } else {
    const payload = {}
    if (colKey === 'ship_wo' && newValue && typeof newValue === 'object') {
      payload.ship_id = newValue.ship_id ?? null
      payload.work_order_id = newValue.work_order_id ?? null
    } else {
      payload[colKey] = newValue
    }
    const { error } = await supabase.from('labor_logs').update(payload).in('id', targetIds)
    if (error) throw error
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
    user: userEmail
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
  userEmail = null
}) {
  const { error } = await supabase
    .from('labor_logs')
    .update({ [field]: cleanedVal, ...extraPayload })
    .eq('id', logId)

  if (error) throw error

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
    user: userEmail
  })

  return { ok: true }
}

/**
 * Inserta una fila en blanco al inicio de la grilla y devuelve el registro con relaciones.
 */
export async function insertBlankLaborLogService({ newPayload, userEmail = null }) {
  const { data, error } = await supabase
    .from('labor_logs')
    .insert([newPayload])
    .select('*, ships(id, name), work_orders(id, ot_number, title, ship_id)')
    .single()

  if (error) throw error

  await auditService.logRowAction({
    action: 'ROW_INSERT',
    entityType: 'daily_labor_logs',
    entityId: data.id,
    entityName: 'Nueva fila en blanco',
    rowData: newPayload,
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
    changeOrigin: 'GRID_RIBBON_INSERT',
    user: userEmail
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
  userEmail = null
}) {
  let targetShip = existingShip
  if (!targetShip) {
    const { data: shipData, error: shipErr } = await supabase
      .from('ships')
      .insert([{ name: shipNameClean, client_name: shipNameClean, status: 'Activo' }])
      .select()
      .single()
    if (shipErr) throw shipErr
    targetShip = shipData
  }

  const otNumber = `OT-${Date.now().toString().slice(-4)}`
  const { data: woData, error: woErr } = await supabase
    .from('work_orders')
    .insert([{
      ship_id: targetShip.id,
      ot_number: otNumber,
      title: `${otNumber}: Apertura Urgente (${shipNameClean})`,
      description: `Creada automáticamente desde parte diario para imputación de ${workerName || 'cuadrilla'}.`,
      status: 'En ejecución'
    }])
    .select()
    .single()

  if (woErr) throw woErr

  await auditService.logRowAction({
    action: 'ROW_INSERT',
    entityType: 'work_orders',
    entityId: woData.id,
    entityName: `${otNumber} · ${shipNameClean}`,
    rowData: woData,
    sheetName: SHEET_NAME,
    moduleRoute: MODULE_ROUTE,
    changeOrigin: 'QUICK_CREATE_FROM_LABOR',
    user: userEmail
  })

  return { targetShip, woData, otNumber }
}
