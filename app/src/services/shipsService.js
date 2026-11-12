/**
 * shipsService.js
 * Capa de servicio y persistencia desacoplada para Buques, Estadías y Armadores (M7).
 * Cumple Candado Mecánico #3 (Cero SQL en Vista) y #4 (Trazabilidad en audit_logs).
 */

import { supabase } from '../lib/supabase.js'
import { logCellChange, logRowAction } from '../lib/auditService.js'
import { assignMonotonicFolios, stampNewRecordWithFolio } from '../lib/monotonicFolioEngine.js'

/**
 * Carga completa de la flota naval, armadores, estadías y vinculaciones operativas.
 */
export async function fetchShipsData() {
  const [
    shipsRes,
    ownersRes,
    staysRes,
    contactsRes,
    woRes,
    workItemsRes,
    unassignedHoursRes,
    unassignedThirdPartyRes,
    unassignedPurchasesRes
  ] = await Promise.all([
    supabase.from('ships').select('*, owners(*)').order('name', { ascending: true }),
    supabase.from('owners').select('*').order('name', { ascending: true }),
    supabase.from('ship_stays').select('*, ships(id, name)').order('start_date', { ascending: false }),
    supabase.from('contacts').select('*, owners(id, name), ships(id, name)').order('name', { ascending: true }),
    supabase.from('work_orders').select('id, ship_id, ot_number, title, status, description, created_at').order('created_at', { ascending: false }),
    supabase.from('work_items').select('id, work_order_id, status, description, contractors, work_type'),
    supabase.from('labor_logs').select('id, ship_id').is('work_order_id', null),
    supabase.from('third_party_services').select('id, ship_id').is('work_order_id', null),
    supabase.from('purchase_orders').select('id, ship_id').is('work_order_id', null)
  ])

  if (shipsRes.error) {
    console.error('[shipsService] Error cargando flota naval:', shipsRes.error)
  }

  const ships = shipsRes.data && shipsRes.data.length > 0
    ? assignMonotonicFolios(shipsRes.data, { dateField: 'created_at' })
    : []

  return {
    ships,
    owners: ownersRes.data || [],
    stays: staysRes.data || [],
    contacts: contactsRes.data || [],
    workOrders: woRes.data || [],
    workItems: workItemsRes.data || [],
    unassignedHours: unassignedHoursRes.data || [],
    unassignedThirdParty: unassignedThirdPartyRes.data || [],
    unassignedPurchases: unassignedPurchasesRes.data || []
  }
}

/**
 * Guarda o actualiza un buque en ships con trazabilidad en audit_logs.
 */
export async function saveShipService({ ship, isNew = false, changedBy = 'Operador Web' }) {
  if (!ship) throw new Error('Datos de buque requeridos.')

  let payload = { ...ship }
  if (isNew) {
    payload = stampNewRecordWithFolio(payload, 'ships')
  }

  delete payload.owners

  const { data, error } = await supabase
    .from('ships')
    .upsert([payload], { onConflict: 'id' })
    .select()

  if (error) {
    console.error('[shipsService] Error guardando buque:', error)
    throw error
  }

  const savedRecord = data?.[0] || payload

  logRowAction({
    action: isNew ? 'CREATE' : 'UPDATE',
    entityType: 'ships',
    entityId: savedRecord.id,
    entityName: savedRecord.name || 'Buque',
    performedBy: changedBy,
    details: {
      owner_id: savedRecord.owner_id,
      eslora: savedRecord.length_overall,
      manga: savedRecord.beam,
      status: savedRecord.status
    }
  })

  return { ok: true, ship: savedRecord }
}

/**
 * Actualiza el estado activo/terminado de un buque.
 */
export async function updateShipStatusService({ shipId, isActive, shipName = 'Buque', changedBy = 'Operador Web' }) {
  if (!shipId) throw new Error('ID de buque requerido.')

  const targetStatus = isActive ? 'Activo' : 'Terminado'

  const { error } = await supabase
    .from('ships')
    .update({ is_active: isActive, status: targetStatus })
    .eq('id', shipId)

  if (error) {
    console.error('[shipsService] Error actualizando estado de buque:', error)
    throw error
  }

  logCellChange({
    entityType: 'ships',
    entityId: shipId,
    entityName: shipName,
    field: 'status',
    fieldLabel: 'Estado Operativo del Buque',
    oldValue: isActive ? 'Terminado' : 'Activo',
    newValue: targetStatus,
    changeOrigin: 'STATUS_TOGGLE',
    performedBy: changedBy
  })

  return { ok: true }
}

/**
 * Guarda o actualiza una estadía en ship_stays con trazabilidad en audit_logs.
 */
export async function saveStayService({ stay, isNew = false, shipName = 'Buque', changedBy = 'Operador Web' }) {
  if (!stay) throw new Error('Datos de estadía requeridos.')

  let payload = { ...stay }
  delete payload.ships

  const { data, error } = await supabase
    .from('ship_stays')
    .upsert([payload], { onConflict: 'id' })
    .select()

  if (error) {
    console.error('[shipsService] Error guardando estadía:', error)
    throw error
  }

  const savedRecord = data?.[0] || payload

  logRowAction({
    action: isNew ? 'CREATE' : 'UPDATE',
    entityType: 'ship_stays',
    entityId: savedRecord.id,
    entityName: `Estadía en ${shipName}`,
    performedBy: changedBy,
    details: {
      location: savedRecord.location,
      start_date: savedRecord.start_date,
      end_date: savedRecord.end_date
    }
  })

  return { ok: true, stay: savedRecord }
}

/**
 * Guarda o actualiza un armador en owners.
 */
export async function saveOwnerService({ owner, isNew = false, changedBy = 'Operador Web' }) {
  if (!owner) throw new Error('Datos de armador requeridos.')

  const { data, error } = await supabase
    .from('owners')
    .upsert([owner], { onConflict: 'id' })
    .select()

  if (error) {
    console.error('[shipsService] Error guardando armador:', error)
    throw error
  }

  const savedRecord = data?.[0] || owner

  logRowAction({
    action: isNew ? 'CREATE' : 'UPDATE',
    entityType: 'owners',
    entityId: savedRecord.id,
    entityName: savedRecord.name || 'Armador',
    performedBy: changedBy,
    details: { cuit: savedRecord.cuit, contact_name: savedRecord.contact_name }
  })

  return { ok: true, owner: savedRecord }
}
