import { supabase } from './supabase.js'
import { logCellChange, logRowAction } from './auditService.js'
import { assignMonotonicFolios } from './monotonicFolioEngine.js'
import { cleanShipName, cleanLocation } from './shipsConstants.js'

const MODULE_ROUTE = '/barcos'

export async function fetchShipsModuleData() {
  const [shipsRes, ownersRes, staysRes, wosRes, itemsRes, oLabRes, oTercRes, oCompRes] = await Promise.all([
    supabase.from('ships').select('*, owners(*)').order('name', { ascending: true }),
    supabase.from('owners').select('*').order('name', { ascending: true }),
    supabase.from('ship_stays').select('*, ships(id, name)').order('start_date', { ascending: false }),
    supabase.from('work_orders').select('id, ship_id, ot_number, title, status, description, created_at, merged_into_wo_id, notes').order('created_at', { ascending: false }),
    supabase.from('work_items').select('id, work_order_id, status, description, contractors, work_type').order('created_at', { ascending: true }),
    supabase.from('labor_logs').select('id, ship_id').is('work_order_id', null),
    supabase.from('third_party_services').select('id, ship_id').is('work_order_id', null),
    supabase.from('purchase_orders').select('id, ship_id').is('work_order_id', null)
  ])

  const failed = [shipsRes, ownersRes, staysRes, wosRes, itemsRes, oLabRes, oTercRes, oCompRes].find((r) => r.error)
  if (failed?.error) throw failed.error

  return {
    ships: assignMonotonicFolios(shipsRes.data || [], { dateField: 'created_at' }),
    owners: assignMonotonicFolios(ownersRes.data || [], { dateField: 'created_at' }),
    stays: assignMonotonicFolios(staysRes.data || [], { dateField: 'start_date' }),
    workOrders: wosRes.data || [],
    workItems: itemsRes.data || [],
    orphanLabor: oLabRes.data || [],
    orphanTerceros: oTercRes.data || [],
    orphanCompras: oCompRes.data || []
  }
}

export function buildShipFieldPatch(colKey, rawValue, owners = []) {
  if (colKey === 'name') {
    const cleaned = cleanShipName(rawValue).toUpperCase().trim()
    if (!cleaned) return null
    return { dbPatch: { name: cleaned }, localPatch: { name: cleaned }, normalizedValue: cleaned }
  }
  if (colKey === 'vessel_type') {
    const vt = String(rawValue || '').trim() || 'Pesquero'
    return { dbPatch: { vessel_type: vt }, localPatch: { vessel_type: vt }, normalizedValue: vt }
  }
  if (colKey === 'current_location') {
    const loc = cleanLocation(rawValue).toUpperCase()
    return { dbPatch: { current_location: loc }, localPatch: { current_location: loc }, normalizedValue: loc }
  }
  if (colKey === 'owner_id') {
    const nextId = rawValue ? String(rawValue).trim() : null
    const nextOwner = nextId ? (owners.find((o) => o.id === nextId) || null) : null
    const dbPatch = {
      owner_id: nextId,
      ...(nextId ? { orphan_owner_alert: false, orphan_owner_previous_name: null } : {})
    }
    return { dbPatch, localPatch: { ...dbPatch, owners: nextOwner }, normalizedValue: nextId || '' }
  }
  return null
}

export function buildStayFieldPatch(colKey, rawValue, ships = []) {
  if (colKey === 'location') {
    const loc = cleanLocation(rawValue).toUpperCase()
    return { dbPatch: { location: loc }, localPatch: { location: loc }, normalizedValue: loc }
  }
  if (colKey === 'ship_id') {
    const nextId = rawValue ? String(rawValue).trim() : null
    const nextShip = nextId ? (ships.find((s) => s.id === nextId) || null) : null
    return { dbPatch: { ship_id: nextId }, localPatch: { ship_id: nextId, ships: nextShip }, normalizedValue: nextId || '' }
  }
  if (colKey === 'start_date') {
    const val = rawValue ? String(rawValue).trim() : null
    if (!val) return null
    return { dbPatch: { start_date: val }, localPatch: { start_date: val }, normalizedValue: val }
  }
  if (colKey === 'end_date') {
    const val = rawValue && String(rawValue).trim() ? String(rawValue).trim() : null
    return { dbPatch: { end_date: val }, localPatch: { end_date: val }, normalizedValue: val || '' }
  }
  return null
}

export function buildOwnerFieldPatch(colKey, rawValue) {
  if (colKey === 'name') {
    const name = String(rawValue || '').trim()
    if (!name) return null
    return { dbPatch: { name }, localPatch: { name }, normalizedValue: name }
  }
  if (['armador_name', 'armador_phone', 'email_principal', 'email_secundario', 'cuit'].includes(colKey)) {
    const val = String(rawValue || '').trim() || null
    return { dbPatch: { [colKey]: val }, localPatch: { [colKey]: val }, normalizedValue: val || '' }
  }
  return null
}

export async function updateGridEntityRowsService({
  table,
  entityType,
  sheetName,
  ids,
  dbPatch,
  auditMeta = null,
  user = null
}) {
  const query = ids.length === 1
    ? supabase.from(table).update(dbPatch).eq('id', ids[0])
    : supabase.from(table).update(dbPatch).in('id', ids)
  const { error } = await query
  if (error) throw error

  if (auditMeta?.mode === 'cell') {
    await logCellChange({
      entityType,
      entityId: ids[0],
      entityName: auditMeta.entityName,
      field: auditMeta.field,
      fieldLabel: auditMeta.fieldLabel || auditMeta.field,
      oldValue: auditMeta.oldValue,
      newValue: auditMeta.newValue,
      sheetName,
      moduleRoute: MODULE_ROUTE,
      changeOrigin: auditMeta.changeOrigin || 'INLINE_CELL',
      user
    })
  } else if (auditMeta?.mode === 'batch') {
    await logRowAction({
      action: 'BATCH_FILL',
      entityType,
      entityId: `batch_${ids.length}`,
      entityName: auditMeta.entityName,
      changes: auditMeta.changes,
      sheetName,
      moduleRoute: MODULE_ROUTE,
      changeOrigin: 'DRAG_FILL',
      user
    })
  }
}

export async function syncShipLocationFromStayService({ shipId, location }) {
  if (!shipId || !location) return
  const cleanLoc = cleanLocation(location).toUpperCase()
  const { error } = await supabase.from('ships').update({ current_location: cleanLoc }).eq('id', shipId)
  if (error) throw error
}

async function updateSingleAndAudit({ table, id, patch, action = 'STATUS_CHANGE', entityType, entityName, sheetName, changes, user }) {
  const { error } = await supabase.from(table).update(patch).eq('id', id)
  if (error) throw error
  await logRowAction({
    action,
    entityType,
    entityId: id,
    entityName,
    changes: changes || patch,
    sheetName,
    moduleRoute: MODULE_ROUTE,
    changeOrigin: 'QUICK_ACTION',
    user
  })
}

export async function toggleShipActiveService({ ship, user }) {
  const nextStatus = ship.is_active === false
  const patch = { is_active: nextStatus, status: nextStatus ? 'Activo' : 'Terminado' }
  await updateSingleAndAudit({
    table: 'ships',
    id: ship.id,
    patch,
    entityType: 'ships',
    entityName: cleanShipName(ship.name),
    sheetName: 'Barcos · Padrón de Buques',
    user
  })
  return nextStatus
}

export async function markShipRequestCompleteService({ ship, user }) {
  await updateSingleAndAudit({
    table: 'ships',
    id: ship.id,
    patch: { info_request_status: 'completo', info_request_notes: null },
    entityType: 'ships',
    entityName: cleanShipName(ship.name),
    sheetName: 'Barcos · Padrón de Buques',
    changes: { info_request_status: 'completo' },
    user
  })
}

export async function dismissShipOrphanAlertService({ ship, user }) {
  await updateSingleAndAudit({
    table: 'ships',
    id: ship.id,
    patch: { orphan_owner_alert: false },
    entityType: 'ships',
    entityName: cleanShipName(ship.name),
    sheetName: 'Barcos · Padrón de Buques',
    user
  })
}

export async function closeStayQuickService({ stay, today, user }) {
  await updateSingleAndAudit({
    table: 'ship_stays',
    id: stay.id,
    patch: { end_date: today },
    entityType: 'ship_stays',
    entityName: `Cierre estadía ${cleanShipName(stay.ships?.name) || stay.id}`,
    sheetName: 'Barcos · Estadías y Movimientos',
    user
  })
}
