import { supabase } from './supabase.js'

/**
 * Diccionario Canónico de Módulos y Submódulos Auditables (Padrón 2.A)
 */
export const AUDIT_ENTITY_CATALOG = {
  work_orders: { label: 'Órdenes de Trabajo (OTs)', route: '/ots', module: 'Órdenes de Trabajo' },
  work_order_tasks: { label: 'Catálogo de Trabajos / Tareas (OT.ABC)', route: '/ots', module: 'Órdenes de Trabajo' },
  workers: { label: 'Personal · Nómina de Operarios', route: '/personal', module: 'Personal y Tarifas' },
  rate_cards: { label: 'Personal · Tarifario Quincenal', route: '/personal', module: 'Personal y Tarifas' },
  work_groups: { label: 'Personal · Grupos y Cuadrillas', route: '/personal', module: 'Personal y Tarifas' },
  daily_labor_logs: { label: 'Carga e Imputación de Horas', route: '/horas', module: 'Carga de Horas' },
  purchase_orders: { label: 'Compras · Pedidos de Materiales', route: '/compras', module: 'Compras y Proveedores' },
  suppliers: { label: 'Compras · Padrón de Proveedores', route: '/compras', module: 'Compras y Proveedores' },
  purchase_documents: { label: 'Compras · Gestor Documental', route: '/compras', module: 'Compras y Proveedores' },
  inventory: { label: 'Pañol · Stock y Movimientos', route: '/panol', module: 'Pañol y Stock' },
  inventory_transactions: { label: 'Pañol · Movimientos de Stock', route: '/panol', module: 'Pañol y Stock' },
  materials: { label: 'Pañol · Catálogo Maestro de Materiales', route: '/panol', module: 'Pañol y Stock' },
  gas_cylinders: { label: 'Pañol · Control de Gases Industriales', route: '/panol', module: 'Pañol y Stock' },
  ppe_deliveries: { label: 'Pañol · Entrega de EPP', route: '/panol', module: 'Pañol y Stock' },
  ships: { label: 'Barcos · Padrón de Buques', route: '/barcos', module: 'Barcos y Armadores' },
  ship_stays: { label: 'Barcos · Estadías y Movimientos', route: '/barcos', module: 'Barcos y Armadores' },
  owners: { label: 'Barcos · Padrón de Armadores', route: '/barcos', module: 'Barcos y Armadores' },
  third_party_services: { label: 'Terceros · Servicios y Facturación', route: '/terceros', module: 'Servicios de Terceros' },
  workshops: { label: 'Terceros · Talleres y Contratistas', route: '/terceros', module: 'Servicios de Terceros' },
  system_settings: { label: 'Admin · Catálogo de Rubros y Configuración', route: '/admin', module: 'Administración' },
  user_roles: { label: 'Admin · Matriz de Puestos y Permisos', route: '/admin', module: 'Administración' },
  macro_variables: { label: 'Admin · Variables Macroeconómicas', route: '/admin', module: 'Administración' },
  remito_comercial: { label: 'Resumen Gerencial · Remito Comercial Alfa', route: '/resumen-gerencial', module: 'Resumen Gerencial' },
  resumen_gerencial_config: { label: 'Resumen Gerencial · Tarifario y Parámetros', route: '/resumen-gerencial', module: 'Resumen Gerencial' }
}

export const AUDIT_ACTION_LABELS = {
  CELL_EDIT: { label: 'Edición en Celda', badge: 'bg-cyan-950/80 text-cyan-300 border-cyan-500/40' },
  BATCH_PASTE: { label: 'Pegado Masivo (Ctrl+V)', badge: 'bg-indigo-950/80 text-indigo-300 border-indigo-500/40' },
  ROW_INSERT: { label: 'Alta de Registro', badge: 'bg-emerald-950/80 text-emerald-300 border-emerald-500/40' },
  ROW_DELETE: { label: 'Baja / Eliminación', badge: 'bg-rose-950/80 text-rose-300 border-rose-500/40' },
  ROW_DUPLICATE: { label: 'Duplicación de Fila', badge: 'bg-purple-950/80 text-purple-300 border-purple-500/40' },
  MODAL_SAVE: { label: 'Edición por Formulario', badge: 'bg-amber-950/80 text-amber-300 border-amber-500/40' },
  STATUS_CHANGE: { label: 'Cambio de Estado', badge: 'bg-blue-950/80 text-blue-300 border-blue-500/40' },
  EDICION_TERCEROS: { label: 'Edición Terceros', badge: 'bg-amber-950/80 text-amber-300 border-amber-500/40' },
  DELETE_OWNER: { label: 'Baja de Armador', badge: 'bg-rose-950/80 text-rose-300 border-rose-500/40' }
}

/**
 * Detecta si un valor es un objeto de evento de React/DOM o una referencia inválida `[object Object]`
 */
export function isInvalidEventOrObjectScalar(val) {
  if (val === null || val === undefined) return false
  if (typeof val === 'string') {
    const upper = val.trim().toUpperCase()
    return upper === '[OBJECT OBJECT]' || upper.includes('[OBJECT ')
  }
  if (typeof val === 'object') {
    if ('nativeEvent' in val || 'target' in val || 'currentTarget' in val || 'preventDefault' in val) {
      return true
    }
    if (Object.prototype.toString.call(val) === '[object Object]' && !Array.isArray(val)) {
      return true
    }
  }
  return false
}

/**
 * Sanitiza un valor para guardarlo en el registro de auditoría sin corromper tipos
 */
export function sanitizeAuditValue(val) {
  if (val === undefined || val === null) return null
  if (isInvalidEventOrObjectScalar(val)) {
    if (Array.isArray(val)) return val
    return null
  }
  if (typeof val === 'number' || typeof val === 'boolean') return val
  if (Array.isArray(val)) return val.join(', ')
  return String(val)
}

/**
 * Obtiene el identificador de usuario actual de forma segura
 */
async function resolveCurrentUserLabel(explicitUser) {
  if (explicitUser && typeof explicitUser === 'string' && explicitUser.trim()) {
    return explicitUser.trim()
  }
  if (explicitUser && typeof explicitUser === 'object') {
    const candidate = explicitUser.full_name || explicitUser.name || explicitUser.email
    if (candidate) return String(candidate)
  }
  try {
    const { data } = await supabase.auth.getUser()
    if (data?.user?.email) return data.user.email
  } catch {
    // Fallback silencioso
  }
  return 'Operador Sistema'
}

/**
 * Registra la edición de una celda individual o campo puntual en `audit_logs`
 */
export async function logCellChange({
  entityType,
  entityId,
  entityName = '',
  field,
  fieldLabel = '',
  oldValue,
  newValue,
  sheetName = '',
  moduleRoute = '',
  changeOrigin = 'INLINE_CELL',
  cellCoordinates = null,
  user = null
}) {
  try {
    if (!entityType || !entityId || !field) return null
    if (isInvalidEventOrObjectScalar(newValue)) {
      console.warn('[auditService] Bloqueado intento de auditar objeto inválido:', newValue)
      return null
    }

    const cleanOld = sanitizeAuditValue(oldValue)
    const cleanNew = sanitizeAuditValue(newValue)

    // No registrar si el valor no cambió realmente
    if (String(cleanOld ?? '') === String(cleanNew ?? '')) {
      return null
    }

    const catalogEntry = AUDIT_ENTITY_CATALOG[entityType] || {}
    const resolvedSheet = sheetName || catalogEntry.label || entityType
    const resolvedRoute = moduleRoute || catalogEntry.route || ''
    const performedBy = await resolveCurrentUserLabel(user)

    const payload = {
      action: 'CELL_EDIT',
      entity_type: String(entityType),
      entity_id: String(entityId),
      entity_name: String(entityName || entityId),
      details: {
        sheet_name: resolvedSheet,
        module_route: resolvedRoute,
        change_origin: changeOrigin,
        field: String(field),
        field_label: String(fieldLabel || field),
        old_value: cleanOld,
        new_value: cleanNew,
        cell_coordinates: cellCoordinates || undefined,
        changes: {
          [field]: {
            from: cleanOld,
            to: cleanNew
          }
        }
      },
      performed_by: performedBy
    }

    const { data, error } = await supabase.from('audit_logs').insert(payload).select().single()
    if (error) {
      console.error('[auditService.logCellChange] Error:', error.message)
      return null
    }
    return data
  } catch (err) {
    console.error('[auditService.logCellChange] Excepción:', err)
    return null
  }
}

/**
 * Registra una acción sobre una fila completa o formulario modal (Alta, Baja, Duplicación, Edición Modal)
 */
export async function logRowAction({
  action = 'ROW_INSERT',
  entityType,
  entityId,
  entityName = '',
  changes = null,
  rowData = null,
  sheetName = '',
  moduleRoute = '',
  changeOrigin = 'MODAL_FORM',
  user = null
}) {
  try {
    if (!entityType || !entityId) return null

    const catalogEntry = AUDIT_ENTITY_CATALOG[entityType] || {}
    const resolvedSheet = sheetName || catalogEntry.label || entityType
    const resolvedRoute = moduleRoute || catalogEntry.route || ''
    const performedBy = await resolveCurrentUserLabel(user)

    const payload = {
      action: String(action),
      entity_type: String(entityType),
      entity_id: String(entityId),
      entity_name: String(entityName || entityId),
      details: {
        sheet_name: resolvedSheet,
        module_route: resolvedRoute,
        change_origin: changeOrigin,
        ...(changes ? { changes } : {}),
        ...(rowData ? { snapshot: rowData } : {})
      },
      performed_by: performedBy
    }

    const { data, error } = await supabase.from('audit_logs').insert(payload).select().single()
    if (error) {
      console.error('[auditService.logRowAction] Error:', error.message)
      return null
    }
    return data
  } catch (err) {
    console.error('[auditService.logRowAction] Excepción:', err)
    return null
  }
}

/**
 * Registra un evento de auditoría genérico o transaccional (SKL-015)
 */
export async function logEvent({
  module = 'rate_cards',
  action = 'UPDATE_RATE_CARD',
  user = null,
  target = '',
  details = {}
}) {
  try {
    const catalogEntry = AUDIT_ENTITY_CATALOG[module] || {}
    const resolvedSheet = catalogEntry.label || module
    const resolvedRoute = catalogEntry.route || ''
    const performedBy = await resolveCurrentUserLabel(user)

    const payload = {
      action: String(action),
      entity_type: String(module),
      entity_id: String(target || 'SYSTEM'),
      entity_name: String(target || module),
      details: {
        sheet_name: resolvedSheet,
        module_route: resolvedRoute,
        ...(details || {})
      },
      performed_by: performedBy
    }

    const { data, error } = await supabase.from('audit_logs').insert(payload).select().single()
    if (error) {
      console.error('[auditService.logEvent] Error:', error.message)
      return null
    }
    return data
  } catch (err) {
    console.error('[auditService.logEvent] Excepción:', err)
    return null
  }
}

/**
 * Registra un pegado matricial 2D o actualización en lote
 */
export async function logBatchPaste({
  entityType,
  batchItems = [], // Array de { entityId, entityName, field, fieldLabel, oldValue, newValue }
  sheetName = '',
  moduleRoute = '',
  user = null
}) {
  try {
    if (!entityType || !Array.isArray(batchItems) || batchItems.length === 0) return []

    const catalogEntry = AUDIT_ENTITY_CATALOG[entityType] || {}
    const resolvedSheet = sheetName || catalogEntry.label || entityType
    const resolvedRoute = moduleRoute || catalogEntry.route || ''
    const performedBy = await resolveCurrentUserLabel(user)

    const rowsToInsert = batchItems
      .filter((item) => item && item.entityId && String(item.oldValue ?? '') !== String(item.newValue ?? ''))
      .map((item) => ({
        action: 'BATCH_PASTE',
        entity_type: String(entityType),
        entity_id: String(item.entityId),
        entity_name: String(item.entityName || item.entityId),
        details: {
          sheet_name: resolvedSheet,
          module_route: resolvedRoute,
          change_origin: 'CONTEXT_MENU_PASTE',
          field: String(item.field || ''),
          field_label: String(item.fieldLabel || item.field || ''),
          old_value: sanitizeAuditValue(item.oldValue),
          new_value: sanitizeAuditValue(item.newValue),
          changes: {
            [item.field || 'valor']: {
              from: sanitizeAuditValue(item.oldValue),
              to: sanitizeAuditValue(item.newValue)
            }
          }
        },
        performed_by: performedBy
      }))

    if (rowsToInsert.length === 0) return []

    const { data, error } = await supabase.from('audit_logs').insert(rowsToInsert).select()
    if (error) {
      console.error('[auditService.logBatchPaste] Error:', error.message)
      return []
    }
    return data || []
  } catch (err) {
    console.error('[auditService.logBatchPaste] Excepción:', err)
    return []
  }
}

/**
 * Consulta el historial de auditoría para un registro específico (alimenta GridContextMenu)
 */
export async function getHistoryForEntity(entityId, entityType = null, limit = 50) {
  if (!entityId) return []
  let query = supabase
    .from('audit_logs')
    .select('*')
    .eq('entity_id', String(entityId))
    .order('created_at', { ascending: false })
    .limit(limit)

  if (entityType) {
    query = query.eq('entity_type', String(entityType))
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * Consulta el Libro de Auditoría Global (alimenta AdminAuditLedger en AdminDashboard)
 */
export async function getGlobalAuditLedger({
  entityType = 'ALL',
  actionFilter = 'ALL',
  userFilter = 'ALL',
  dateFrom = '',
  dateTo = '',
  limit = 300
} = {}) {
  let query = supabase
    .from('audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (entityType && entityType !== 'ALL') {
    query = query.eq('entity_type', entityType)
  }
  if (actionFilter && actionFilter !== 'ALL') {
    query = query.eq('action', actionFilter)
  }
  if (userFilter && userFilter !== 'ALL') {
    query = query.eq('performed_by', userFilter)
  }
  if (dateFrom) {
    query = query.gte('created_at', `${dateFrom}T00:00:00`)
  }
  if (dateTo) {
    query = query.lte('created_at', `${dateTo}T23:59:59`)
  }

  const { data, error } = await query
  if (error) throw error
  return data || []
}

/**
 * Calcula métricas de trabajo, uso por planilla y frecuencia de correcciones sobre un lote de logs
 */
export function computeAuditMetrics(logs = []) {
  const totalEvents = logs.length
  const now = new Date()
  const todayStr = now.toISOString().slice(0, 10)

  let todayCount = 0
  const bySheet = {}
  const byUser = {}
  const byAction = {}
  const recordEditFrequency = {} // Para detectar registros re-editados múltiples veces (posibles errores/correcciones)

  logs.forEach((log) => {
    const createdDate = log.created_at ? log.created_at.slice(0, 10) : ''
    if (createdDate === todayStr) todayCount++

    const eType = log.entity_type || 'otros'
    const sheetLabel = log.details?.sheet_name || AUDIT_ENTITY_CATALOG[eType]?.label || eType
    bySheet[sheetLabel] = (bySheet[sheetLabel] || 0) + 1

    const user = log.performed_by || 'Desconocido'
    byUser[user] = (byUser[user] || 0) + 1

    const act = log.action || 'OTRO'
    byAction[act] = (byAction[act] || 0) + 1

    if (log.entity_id && (act === 'CELL_EDIT' || act === 'MODAL_SAVE' || act.startsWith('EDICION'))) {
      const fieldKey = `${log.entity_type}:${log.entity_id}:${log.details?.field || 'row'}`
      recordEditFrequency[fieldKey] = (recordEditFrequency[fieldKey] || 0) + 1
    }
  })

  const topSheets = Object.entries(bySheet)
    .map(([label, count]) => ({ label, count, pct: totalEvents ? Math.round((count / totalEvents) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)

  const topUsers = Object.entries(byUser)
    .map(([user, count]) => ({ user, count, pct: totalEvents ? Math.round((count / totalEvents) * 100) : 0 }))
    .sort((a, b) => b.count - a.count)

  // Correcciones recurrentes: mismo campo del mismo registro editado > 1 vez
  const repeatedCorrectionsCount = Object.values(recordEditFrequency).filter((c) => c > 1).length

  return {
    totalEvents,
    todayCount,
    topSheets,
    topUsers,
    byAction,
    repeatedCorrectionsCount,
    uniqueUsersCount: Object.keys(byUser).length,
    activeSheetsCount: Object.keys(bySheet).length
  }
}

export const auditService = {
  AUDIT_ENTITY_CATALOG,
  AUDIT_ACTION_LABELS,
  isInvalidEventOrObjectScalar,
  sanitizeAuditValue,
  logCellChange,
  logRowAction,
  logBatchPaste,
  logEvent,
  getHistoryForEntity,
  getGlobalAuditLedger,
  computeAuditMetrics
}

export default auditService
