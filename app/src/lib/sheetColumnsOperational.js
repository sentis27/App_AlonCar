/**
 * sheetColumnsOperational.js
 * Definiciones puras de columnas para el Motor General Excel/Sheets (FL-027)
 * en submódulos operativos (Cuentas Corrientes, Pañol, Horas y OTs).
 */
import { formatDateAr, formatDateTimeAr } from './dateTimeCanonical.js'

export const CC_DEBE_SHEET_COLUMNS = [
  { key: 'remitoNumber', label: 'Remito AlonCar', isNumeric: false, getValue: (r) => r.remitoNumber || '' },
  { key: 'quincenaLabel', label: 'Quincena / Obra', isNumeric: false, getValue: (r) => r.entryDate || r.quincenaLabel || '' },
  { key: 'weightKg', label: 'Kilos', isNumeric: true, formatType: 'kg', getValue: (r) => (Number(r.weightKg) > 0 ? Number(r.weightKg) : null) },
  { key: 'rateUsdApplied', label: 'Tarifa US$/kg', isNumeric: true, formatType: 'usd', getValue: (r) => (Number(r.rateUsdApplied) > 0 ? Number(r.rateUsdApplied) : null) },
  { key: 'amountUsd', label: 'Monto US$', isNumeric: true, formatType: 'usd', getValue: (r) => Number(r.amountUsd || 0) },
  { key: 'status', label: 'Estado', isNumeric: false, getValue: (r) => (r.isCancelled ? 'Cancelado' : 'Pendiente') }
]

export const CC_HABER_SHEET_COLUMNS = [
  { key: 'payment_date', label: 'Fecha Pago', type: 'date', getValue: (p) => formatDateAr(p.payment_date) },
  { key: 'payment_type', label: 'Modalidad', isNumeric: false },
  { key: 'amount_usd', label: 'Neto US$', isNumeric: true, formatType: 'usd', getValue: (p) => Number(p.amount_usd || 0) },
  { key: 'detail', label: 'Detalle / Comprobante', isNumeric: false, getValue: (p) => p.invoice_number || (p.panol_remito_number ? `Rem. Pañol #${p.panol_remito_number}` : '') },
  { key: 'observations', label: 'Observaciones', isNumeric: false }
]

export function buildPanolEntradasSheetColumns(materialById, reasonLabels = {}, condLabels = {}) {
  return [
    { key: 'date', label: 'Fecha', type: 'date', getValue: (r) => formatDateAr(r.date) },
    { key: 'material', label: 'Material / Insumo', isNumeric: false, getValue: (r) => materialById.get(String(r.material_id))?.name || '' },
    { key: 'rubro', label: 'Rubro', isNumeric: false, getValue: (r) => materialById.get(String(r.material_id))?.rubro || '' },
    { key: 'quantity', label: 'Movimiento', isNumeric: true, formatType: 'number', getValue: (r) => Number(r.quantity) || 0 },
    { key: 'reason_type', label: 'Motivo', isNumeric: false, getValue: (r) => reasonLabels[r.reason_type] || r.reason_type || '' },
    { key: 'material_condition', label: 'Estado', isNumeric: false, getValue: (r) => condLabels[r.material_condition] || r.material_condition || '' },
    { key: 'notes', label: 'Observaciones', isNumeric: false },
    { key: 'created_by', label: 'Registrado por', isNumeric: false }
  ]
}

export function buildPanolStockAuditSheetColumns(materialById, condLabels = {}) {
  return [
    { key: 'date', label: 'Fecha', type: 'date', getValue: (r) => formatDateAr(r.date) },
    { key: 'material', label: 'Material / Insumo', isNumeric: false, getValue: (r) => materialById.get(String(r.material_id))?.name || '' },
    { key: 'rubro', label: 'Rubro', isNumeric: false, getValue: (r) => materialById.get(String(r.material_id))?.rubro || '' },
    { key: 'system_quantity', label: 'Stock Sistema', isNumeric: true, formatType: 'number', getValue: (r) => Number(r.system_quantity ?? 0) },
    { key: 'counted_quantity', label: 'Conteo Físico', isNumeric: true, formatType: 'number', getValue: (r) => Number(r.counted_quantity ?? 0) },
    { key: 'calculated_delta', label: 'Diferencia', isNumeric: true, formatType: 'number', getValue: (r) => Number(r.calculated_delta ?? 0) },
    { key: 'status', label: 'Resultado', isNumeric: false },
    { key: 'material_condition', label: 'Condición', isNumeric: false, getValue: (r) => condLabels[r.material_condition] || r.material_condition || '' },
    { key: 'notes', label: 'Auditor / Notas', isNumeric: false, getValue: (r) => `${r.audited_by || 'Pañol'}: ${r.notes || ''}` }
  ]
}

export const PANOL_STOCK_GAS_SHEET_COLUMNS = [
  { key: 'contractor', label: 'Contratista / Taller', isNumeric: false, getValue: (r) => r.name },
  { key: 'totalHeld', label: 'Tubos en Poder', isNumeric: true, formatType: 'number', getValue: (r) => Number(r.data?.totalHeld || 0) },
  { key: 'detail', label: 'Detalle por Gas / Marca', isNumeric: false, getValue: (r) => (r.data?.activeHoldings || []).map((h) => `${h.materialName} ${h.count}`).join(', ') },
  { key: 'retention', label: 'Estado Retención', isNumeric: false, getValue: (r) => (r.longHeld ? `Retenido ${r.longHeld.days}d` : r.data?.totalHeld > 0 ? 'Al día' : 'Saldado') }
]

export const KARDEX_SHEET_COLUMNS = [
  { key: 'date', label: 'Fecha y Hora', type: 'date', getValue: (ev) => formatDateTimeAr(ev.timestampIso, { fallback: formatDateAr(ev.dateIso) }) },
  { key: 'sourceType', label: 'Origen', isNumeric: false },
  { key: 'reference', label: 'Referencia / Notas', isNumeric: false, getValue: (ev) => ev.reference || ev.notes || '' },
  { key: 'delta', label: 'Movimiento', isNumeric: true, formatType: 'number', getValue: (ev) => Number(ev.delta || 0) },
  { key: 'runningBalance', label: 'Saldo Acum.', isNumeric: true, formatType: 'number', getValue: (ev) => Number(ev.runningBalance || 0) }
]

export const CONSUMPTION_6M_SHEET_COLUMNS = [
  { key: 'month', label: 'Mes', isNumeric: false, getValue: (m) => `${m.monthLabel} ${m.year}` },
  { key: 'quantity', label: 'Cantidad', isNumeric: true, formatType: 'number', getValue: (m) => Number(m.quantity || 0) },
  { key: 'workOrders', label: 'Órdenes de Trabajo', isNumeric: false, getValue: (m) => (m.uniqueWorkOrders || []).map((w) => w.label).join(', ') }
]

const sumLogs = (it, field) => (it?.logs || []).reduce((acc, l) => acc + (parseFloat(l[field]) || 0), 0)

export const LABOR_CONTROL_DIARIO_SHEET_COLUMNS = [
  { key: 'approval', label: 'Aprobación', isNumeric: false, getValue: (it) => (it.logs || []).map((l) => l.approval_status || '-').join(', ') },
  { key: 'status', label: 'Estado / Semáforo', isNumeric: false, getValue: (it) => `${it.totalDay || 0} hs (${it.status || ''})` },
  { key: 'worker', label: 'Operario / Taller', isNumeric: false, getValue: (it) => it.worker?.name || '' },
  { key: 'type', label: 'Tipo', isNumeric: false },
  { key: 'ship_wo', label: 'Imputación (Barco & OT)', isNumeric: false, getValue: (it) => (it.logs || []).map((l) => l.work_orders?.ships?.name || l.ships?.name || 'Sin Buque').join(', ') },
  { key: 'rubro', label: 'Rubro(s)', isNumeric: false, getValue: (it) => (it.logs || []).map((l) => l.rubro || 'General').join(', ') },
  { key: 'hours_normal', label: 'Norm', isNumeric: true, formatType: 'hours', getValue: (it) => (it.logs?.length ? sumLogs(it, 'hours_normal') : null) },
  { key: 'hours_extra_50', label: '50%', isNumeric: true, formatType: 'hours', getValue: (it) => (it.logs?.length ? sumLogs(it, 'hours_extra_50') : null) },
  { key: 'hours_extra_100', label: '100%', isNumeric: true, formatType: 'hours', getValue: (it) => (it.logs?.length ? sumLogs(it, 'hours_extra_100') : null) },
  { key: 'totalDay', label: 'Total Día', isNumeric: true, formatType: 'hours', getValue: (it) => Number(it.totalDay || 0) }
]

export function buildLaborSabanaMatrixColumns(daysInQuincena = [], sabanaIndex) {
  const dayCols = daysInQuincena.map((day) => ({
    key: `day_${day.dayNumber}`,
    label: `Día ${day.dayNumber}`,
    isNumeric: true,
    formatType: 'hours',
    getValue: (w) => {
      const h = sabanaIndex?.byWorkerDate?.get(w.name)?.get(day.dateStr)?.dayHours || 0
      return h > 0 ? h : null
    }
  }))
  const getTot = (w) => sabanaIndex?.totalsByWorker?.get(w.name) || { sumNorm: 0, sum50: 0, sum100: 0 }
  return [
    { key: 'worker', label: 'Operario / Contratista', isNumeric: false, getValue: (w) => w.name },
    ...dayCols,
    { key: 'sumNorm', label: 'Norm', isNumeric: true, formatType: 'hours', getValue: (w) => getTot(w).sumNorm },
    { key: 'sum50', label: '50%', isNumeric: true, formatType: 'hours', getValue: (w) => getTot(w).sum50 },
    { key: 'sum100', label: '100%', isNumeric: true, formatType: 'hours', getValue: (w) => getTot(w).sum100 },
    { key: 'total', label: 'TOTAL', isNumeric: true, formatType: 'hours', getValue: (w) => { const t = getTot(w); return t.sumNorm + t.sum50 + t.sum100 } }
  ]
}

export const LABOR_SABANA_DETAIL_SHEET_COLUMNS = [
  { key: 'date_logged', label: 'Fecha', type: 'date', getValue: (l) => formatDateAr(l.date_logged) },
  { key: 'worker_name', label: 'Operario', isNumeric: false },
  { key: 'worker_type', label: 'Tipo', isNumeric: false },
  { key: 'ship_wo', label: 'Barco & OT', isNumeric: false, getValue: (l) => l.ships?.name || l.work_orders?.ships?.name || 'Sin Buque' },
  { key: 'rubro', label: 'Rubro', isNumeric: false },
  { key: 'hours_normal', label: 'Norm', isNumeric: true, formatType: 'hours', getValue: (l) => Number(l.hours_normal ?? l.hours_worked ?? 0) },
  { key: 'hours_extra_50', label: '50%', isNumeric: true, formatType: 'hours', getValue: (l) => Number(l.hours_extra_50 || 0) },
  { key: 'hours_extra_100', label: '100%', isNumeric: true, formatType: 'hours', getValue: (l) => Number(l.hours_extra_100 || 0) },
  { key: 'hours_worked', label: 'Total', isNumeric: true, formatType: 'hours', getValue: (l) => Number(l.hours_worked || 0) },
  { key: 'approval_status', label: 'Estado', isNumeric: false }
]

export function buildWorkOrdersTercerosSheetColumns(workOrdersById) {
  return [
    { key: 'service_date', label: 'Fecha', type: 'date', getValue: (tp) => formatDateAr(tp.service_date || String(tp.created_at || '').split('T')[0]) },
    { key: 'ship_wo', label: 'Barco & OT', isNumeric: false, getValue: (tp) => { const wo = workOrdersById.get(String(tp.work_order_id)); return `${wo?.ships?.name || ''} ${wo?.ot_number || ''}`.trim() } },
    { key: 'contractor_name', label: 'Proveedor / Contratista', isNumeric: false },
    { key: 'status', label: 'Estado / Comprobante', isNumeric: false },
    { key: 'amount_ars', label: 'Importe AR$', isNumeric: true, formatType: 'ars', getValue: (tp) => Number(tp.amount_ars || 0) },
    { key: 'direct_observations', label: 'Observaciones Directas', isNumeric: false },
    { key: 'specific_observations', label: 'Observaciones Específicas', isNumeric: false }
  ]
}
