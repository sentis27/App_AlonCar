/**
 * sheetColumnsAdmin.js
 * Definiciones puras de columnas para el Motor General Excel/Sheets (FL-027)
 * en módulos gerenciales, Tesorería, Compras OCR y Administración.
 */
import { formatDateAr, formatDateTimeAr } from './dateTimeCanonical.js'

export const TESORERIA_RESUMEN_SHEET_COLUMNS = [
  { key: 'contractorLabel', label: 'Contratista / Razón Social', isNumeric: false },
  { key: 'adminCenter', label: 'Centro', isNumeric: false },
  { key: 'safetyCenter', label: 'Regla EPP', isNumeric: false },
  { key: 'consumablesArs', label: 'Consumibles (AR$)', isNumeric: true, formatType: 'ars' },
  { key: 'safetyArs', label: 'Elem. Seguridad (AR$)', isNumeric: true, formatType: 'ars' },
  { key: 'totalDeductArs', label: 'Total Descontar AR$', isNumeric: true, formatType: 'ars' },
  { key: 'totalDeductUsd', label: 'Total Descontar US$', isNumeric: true, formatType: 'usd' }
]

export function buildTesoreriaDetalleSheetColumns(subView) {
  return [
    { key: 'date', label: 'Fecha', type: 'date', getValue: (r) => formatDateAr(r.date) },
    { key: 'contractorLabel', label: 'Contratista', isNumeric: false },
    { key: 'workerName', label: 'Operario', isNumeric: false },
    { key: 'materialName', label: 'Material / Insumo', isNumeric: false },
    { key: 'category', label: 'Categoría', isNumeric: false },
    { key: 'quantity', label: 'Cant.', isNumeric: true, formatType: 'number', getValue: (r) => Number(r.quantity || 0) },
    { key: 'ship_wo', label: 'Buque / OT', isNumeric: false, getValue: (r) => `${r.shipName || ''} · ${r.otLabel || ''}` },
    {
      key: 'amount',
      label: subView === 'exentos' ? 'Costo Ref. US$' : 'Descuento AR$',
      isNumeric: true,
      formatType: subView === 'exentos' ? 'usd' : 'ars',
      getValue: (r) => (subView === 'exentos' ? Number(r.classification?.referenceUsd || 0) : Number(r.classification?.deductArs || 0))
    }
  ]
}

export const RESUMEN_MATRIZ_OTS_SHEET_COLUMNS = [
  { key: 'ot', label: 'Orden de Trabajo', isNumeric: false, getValue: (r) => `${r.otNumber || ''} ${r.title || ''}`.trim() },
  { key: 'tercerosUsd', label: 'Terceros', isNumeric: true, formatType: 'usd' },
  { key: 'materialesUsd', label: 'Materiales', isNumeric: true, formatType: 'usd' },
  { key: 'consumiblesObraUsd', label: 'Consumibles', isNumeric: true, formatType: 'usd' },
  { key: 'horasTotalUsd', label: 'Hora', isNumeric: true, formatType: 'usd' },
  { key: 'matPlusConsUsd', label: 'Mat+Cons', isNumeric: true, formatType: 'usd' },
  { key: 'manoObraTotalUsd', label: 'M.O', isNumeric: true, formatType: 'usd' },
  { key: 'directTotalUsd', label: 'Total por O.T', isNumeric: true, formatType: 'usd' },
  { key: 'weightKg', label: 'KG por O.T', isNumeric: true, formatType: 'kg' },
  { key: 'seguridadReferenciaUsd', label: 'EPP Ref*', isNumeric: true, formatType: 'usd', getValue: (r) => (r.seguridadReferenciaUsd > 0 ? r.seguridadReferenciaUsd : null) },
  { key: 'description', label: 'Descripción de trabajo', isNumeric: false }
]

export function buildComparadorNivel2Columns(selectedShipsData = []) {
  return [
    { key: 'label', label: 'Orden / Rubro Común', isNumeric: false },
    ...selectedShipsData.map((ship) => ({
      key: `ship_${ship.shipId}`,
      label: `${ship.shipName} (US$)`,
      isNumeric: true,
      formatType: 'usd',
      getValue: (row) => row.byShip?.[ship.shipId]?.directTotalUsd ?? null
    }))
  ]
}

export const COMPRAS_OCR_SHEET_COLUMNS = [
  { key: 'original_filename', label: 'Archivo', isNumeric: false },
  { key: 'doc_type', label: 'Tipo Documento', isNumeric: false },
  { key: 'description', label: 'Descripción', isNumeric: false },
  { key: 'category', label: 'Rubro', isNumeric: false },
  { key: 'created_at', label: 'Fecha', type: 'date', getValue: (d) => (d.created_at ? formatDateAr(d.created_at) : '') }
]

export function buildAdminAuditLedgerColumns(auditCatalog = {}, actionLabels = {}) {
  return [
    { key: 'created_at', label: 'Fecha / Hora', type: 'date', getValue: (l) => (l.created_at ? formatDateTimeAr(l.created_at, { includeSeconds: true, shortYear: true }) : '') },
    { key: 'sheet', label: 'Planilla / Submódulo', isNumeric: false, getValue: (l) => l.details?.sheet_name || auditCatalog[l.entity_type]?.label || l.entity_type || '' },
    { key: 'performed_by', label: 'Usuario', isNumeric: false },
    { key: 'action', label: 'Acción', isNumeric: false, getValue: (l) => actionLabels[l.action]?.label || l.action || '' },
    { key: 'entity_name', label: 'Registro Afectado', isNumeric: false, getValue: (l) => l.entity_name || l.entity_id || '' },
    { key: 'detail', label: 'Detalle del Cambio', isNumeric: false, getValue: (l) => (l.details?.field ? `${l.details.field_label || l.details.field}: ${l.details.old_value ?? ''} -> ${l.details.new_value ?? ''}` : '') }
  ]
}

export function buildAdminMacroMonthlyColumns(monthNames = []) {
  return [
    { key: 'month', label: 'Mes y Año', isNumeric: false, getValue: (m) => `${monthNames[m.month - 1] || m.month} ${m.year}` },
    { key: 'dollar_rate', label: 'Dólar Referencia ($ / USD)', isNumeric: true, formatType: 'ars', getValue: (m) => Number(m.dollar_rate || 0) },
    { key: 'monthly_inflation_pct', label: 'Inflación Mensual (%)', isNumeric: true, formatType: 'pct', getValue: (m) => Number(m.monthly_inflation_pct || 0) },
    { key: 'quincenas', label: 'Quincenas', isNumeric: false, getValue: (m) => `${m.year}-${String(m.month).padStart(2, '0')}` },
    { key: 'updated_by', label: 'Registrado por', isNumeric: false },
    { key: 'updated_at', label: 'Fecha de Carga', type: 'date', getValue: (m) => (m.updated_at ? formatDateTimeAr(m.updated_at) : '') }
  ]
}

export const ADMIN_MACRO_QUINCENA_SHEET_COLUMNS = [
  { key: 'period', label: 'Quincena (Período)', isNumeric: false },
  { key: 'dollar_rate', label: 'Dólar Quincenal (AR$/USD)', isNumeric: true, formatType: 'ars', getValue: (p) => (Number(p.dollar_rate) > 0 ? Number(p.dollar_rate) : null) },
  { key: 'inflation', label: 'Inflación Mensual', isNumeric: true, formatType: 'pct', getValue: (p) => (p.monthly_inflation_pct !== undefined && p.monthly_inflation_pct !== null ? Number(p.monthly_inflation_pct) : null) },
  { key: 'rates_count', label: 'Tarifario MO', isNumeric: true, formatType: 'number', getValue: (p) => Number(p.rates_count || 0) },
  { key: 'status', label: 'Estado del Período', isNumeric: false, getValue: (p) => (p.is_locked ? 'Cerrado' : 'Abierto') },
  { key: 'control', label: 'Control de Cierre', isNumeric: false, getValue: (p) => (p.locked_at ? formatDateAr(p.locked_at) : '') }
]
