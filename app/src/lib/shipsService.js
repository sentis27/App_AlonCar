import { logCellChange, logRowAction } from './auditService.js'
import { assignMonotonicFolios } from './monotonicFolioEngine.js'
import { cleanShipName, cleanLocation } from './shipsConstants.js'
import { shipsRepository } from '../repositories/shipsRepository.js'
import { ownersRepository } from '../repositories/ownersRepository.js'
import { shipStaysRepository } from '../repositories/shipStaysRepository.js'
import { laborLogsRepository } from '../repositories/laborLogsRepository.js'
import { thirdPartyServicesRepository } from '../repositories/thirdPartyServicesRepository.js'
import { purchaseOrdersRepository } from '../repositories/purchaseOrdersRepository.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { workItemsRepository } from '../repositories/workItemsRepository.js'

const MODULE_ROUTE = '/barcos'

const REPOS_BY_TABLE = {
  ships: shipsRepository,
  ship_stays: shipStaysRepository,
  owners: ownersRepository,
}

export async function fetchShipsModuleData() {
  const [shipsRes, ownersRes, staysRes, wosRes, itemsRes, oLabRes, oTercRes, oCompRes] = await Promise.all([
    shipsRepository.listShips({ select: '*, owners(*)', orderBy: [{ column: 'name', ascending: true }] }),
    ownersRepository.listOwners({ select: '*', orderBy: [{ column: 'name', ascending: true }] }),
    shipStaysRepository.listStays({ select: '*, ships(id, name)', orderBy: [{ column: 'start_date', ascending: false }] }),
    workOrdersRepository.listWorkOrders({
      select: 'id, ship_id, ot_number, title, status, description, created_at, merged_into_wo_id, notes',
    }),
    workItemsRepository.listWorkItems({
      select: 'id, work_order_id, status, description, contractors, work_type',
    }),
    laborLogsRepository.findAll({ select: 'id, ship_id', isNull: ['work_order_id'] }),
    thirdPartyServicesRepository.listServices({ select: 'id, ship_id', isNull: ['work_order_id'], orderBy: [] }),
    purchaseOrdersRepository.listOrders({ select: 'id, ship_id', isNull: ['work_order_id'], orderBy: [] }),
  ])

  const firstErr = [shipsRes.error, ownersRes.error, staysRes.error, wosRes.error, itemsRes.error, oLabRes.error, oTercRes.error, oCompRes.error].find(Boolean)
  if (firstErr) throw new Error(firstErr)

  return {
    ships: assignMonotonicFolios(shipsRes.data || [], { dateField: 'created_at' }),
    owners: assignMonotonicFolios(ownersRes.data || [], { dateField: 'created_at' }),
    stays: assignMonotonicFolios(staysRes.data || [], { dateField: 'start_date' }),
    workOrders: wosRes.data || [],
    workItems: itemsRes.data || [],
    orphanLabor: oLabRes.data || [],
    orphanTerceros: oTercRes.data || [],
    orphanCompras: oCompRes.data || [],
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
      ...(nextId ? { orphan_owner_alert: false, orphan_owner_previous_name: null } : {}),
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
  user = null,
}) {
  const repo = REPOS_BY_TABLE[table]
  if (!repo) throw new Error(`Tabla no soportada en shipsService: ${table}`)

  const { error } = ids.length === 1
    ? await repo.updateById(ids[0], dbPatch, { select: null })
    : await repo.updateByIds(ids, dbPatch, { select: null })
  if (error) throw new Error(error)

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
      user,
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
      user,
    })
  }
}

export async function syncShipLocationFromStayService({ shipId, location }) {
  if (!shipId || !location) return
  const cleanLoc = cleanLocation(location).toUpperCase()
  const { error } = await shipsRepository.updateById(shipId, { current_location: cleanLoc }, { select: null })
  if (error) throw new Error(error)
}

async function updateSingleAndAudit({ table, id, patch, action = 'STATUS_CHANGE', entityType, entityName, sheetName, changes, user }) {
  const repo = REPOS_BY_TABLE[table]
  if (!repo) throw new Error(`Tabla no soportada: ${table}`)
  const { error } = await repo.updateById(id, patch, { select: null })
  if (error) throw new Error(error)

  await logRowAction({
    action,
    entityType,
    entityId: id,
    entityName,
    changes: changes || patch,
    sheetName,
    moduleRoute: MODULE_ROUTE,
    changeOrigin: 'QUICK_ACTION',
    user,
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
    user,
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
    user,
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
    user,
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
    user,
  })
}
