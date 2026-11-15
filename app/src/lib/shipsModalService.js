import { supabase } from './supabase.js'
import { logRowAction } from './auditService.js'
import { cleanShipName, cleanLocation } from './shipsConstants.js'
import { syncShipLocationFromStayService } from './shipsService.js'

const MODULE_ROUTE = '/barcos'

async function upsertAndAuditRecord({ table, entityType, id, payload, entityName, sheetName, user }) {
  let savedId = id
  if (id) {
    const { error } = await supabase.from(table).update(payload).eq('id', id)
    if (error) throw error
  } else {
    const { data, error } = await supabase.from(table).insert([payload]).select().single()
    if (error) throw error
    savedId = data?.id
  }

  await logRowAction({
    action: id ? 'MODAL_SAVE' : 'ROW_INSERT',
    entityType,
    entityId: savedId,
    entityName,
    changes: payload,
    sheetName,
    moduleRoute: MODULE_ROUTE,
    changeOrigin: 'MODAL_FORM',
    user
  })
  return savedId
}

export async function saveShipService({ ship, isCustomVesselType, customVesselTypeVal, user }) {
  const cleanName = cleanShipName(ship.name).toUpperCase()
  if (!cleanName) throw new Error('El nombre del barco es obligatorio')
  const finalVesselType = isCustomVesselType
    ? (customVesselTypeVal?.trim() || 'Pesquero')
    : (ship.vessel_type || 'Pesquero')

  const payload = {
    name: cleanName,
    owner_id: ship.owner_id || null,
    matricula: ship.matricula || null,
    vessel_type: finalVesselType,
    eslora_mts: ship.eslora_mts ? parseFloat(ship.eslora_mts) : null,
    manga_mts: ship.manga_mts ? parseFloat(ship.manga_mts) : null,
    puntal_mts: ship.puntal_mts ? parseFloat(ship.puntal_mts) : null,
    superficie_casco_m2: ship.superficie_casco_m2 ? parseFloat(ship.superficie_casco_m2) : null,
    current_location: cleanLocation(ship.current_location),
    notes: ship.notes || null,
    technical_specs: ship.technical_specs || {},
    info_request_status: ship.info_request_status || 'completo',
    is_active: ship.is_active !== false
  }

  const savedId = await upsertAndAuditRecord({
    table: 'ships',
    entityType: 'ships',
    id: ship.id,
    payload,
    entityName: cleanName,
    sheetName: 'Barcos · Padrón de Buques',
    user
  })
  return { cleanName, savedId }
}

export async function saveStayService({ stay, user }) {
  const cleanLoc = cleanLocation(stay.location)
  const payload = {
    ship_id: stay.ship_id,
    location: cleanLoc,
    start_date: stay.start_date,
    end_date: stay.end_date || null,
    notes: stay.notes || null
  }
  const savedId = await upsertAndAuditRecord({
    table: 'ship_stays',
    entityType: 'ship_stays',
    id: stay.id,
    payload,
    entityName: `Estadía ${cleanLoc}`,
    sheetName: 'Barcos · Estadías y Movimientos',
    user
  })
  if (!payload.end_date) {
    await syncShipLocationFromStayService({ shipId: payload.ship_id, location: cleanLoc })
  }
  return { cleanLoc, savedId }
}

export async function saveOwnerService({ owner, user }) {
  if (!owner.name?.trim()) throw new Error('La Razón Social o Empresa es obligatoria')
  const payload = {
    name: owner.name.trim(),
    armador_name: owner.armador_name?.trim() || null,
    armador_phone: owner.armador_phone?.trim() || null,
    email_principal: owner.email_principal?.trim() || null,
    email_secundario: owner.email_secundario?.trim() || null,
    cuit: owner.cuit?.trim() || null,
    notes: owner.notes?.trim() || null,
    is_active: true
  }
  await upsertAndAuditRecord({
    table: 'owners',
    entityType: 'owners',
    id: owner.id,
    payload,
    entityName: payload.name,
    sheetName: 'Barcos · Padrón de Armadores',
    user
  })
}

export async function deleteOwnerWithAuditService({ owner, linkedShips = [], user }) {
  const { error: auditErr } = await supabase.from('audit_logs').insert([{
    action: 'DELETE_OWNER',
    entity_type: 'owners',
    entity_id: owner.id,
    entity_name: owner.name,
    details: {
      cuit: owner.cuit,
      armador_name: owner.armador_name,
      armador_phone: owner.armador_phone,
      email_principal: owner.email_principal,
      email_secundario: owner.email_secundario,
      affected_ships: linkedShips.map((s) => ({ id: s.id, name: s.name }))
    },
    performed_by: user || 'Administración'
  }])
  if (auditErr) throw auditErr

  if (linkedShips.length > 0) {
    const { error: shipErr } = await supabase
      .from('ships')
      .update({ owner_id: null, orphan_owner_alert: true, orphan_owner_previous_name: owner.name })
      .in('id', linkedShips.map((s) => s.id))
    if (shipErr) throw shipErr
  }

  const { error } = await supabase.from('owners').delete().eq('id', owner.id)
  if (error) throw error
}

export async function assignOrphanOwnerService({ ship, selectedOwnerId, owners = [], user }) {
  const patch = { owner_id: selectedOwnerId, orphan_owner_alert: false, orphan_owner_previous_name: null }
  const { error } = await supabase.from('ships').update(patch).eq('id', ship.id)
  if (error) throw error
  const ownerObj = owners.find((o) => o.id === selectedOwnerId) || null
  await logRowAction({
    action: 'MODAL_SAVE',
    entityType: 'ships',
    entityId: ship.id,
    entityName: cleanShipName(ship.name),
    changes: { owner_id: selectedOwnerId, orphan_owner_alert: false },
    sheetName: 'Barcos · Padrón de Buques',
    moduleRoute: MODULE_ROUTE,
    changeOrigin: 'MODAL_FORM',
    user
  })
  return { ...patch, owners: ownerObj }
}

export async function sendShipInfoRequestService({ ship, requestType, notes, user }) {
  const { error } = await supabase.from('ships').update({
    info_request_status: requestType,
    info_request_notes: notes?.trim() || null,
    info_requested_at: new Date().toISOString(),
    info_requested_by: user || 'Jorge Sentis (Admin)'
  }).eq('id', ship.id)
  if (error) throw error
  await logRowAction({
    action: 'STATUS_CHANGE',
    entityType: 'ships',
    entityId: ship.id,
    entityName: cleanShipName(ship.name),
    changes: { info_request_status: requestType, info_request_notes: notes?.trim() || null },
    sheetName: 'Barcos · Padrón de Buques',
    moduleRoute: MODULE_ROUTE,
    changeOrigin: 'MODAL_FORM',
    user
  })
}

export async function uploadShipNavalDocService({ shipId, docType, file, user }) {
  const cleanFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  const filePath = `${shipId}/${docType}_${Date.now()}_${cleanFileName}`
  const { error: uploadError } = await supabase.storage.from('ship-documents').upload(filePath, file, { upsert: true })
  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from('ship-documents').getPublicUrl(filePath)
  const fileUrl = urlData?.publicUrl
  const nowIso = new Date().toISOString()
  const updateFields = docType === 'plano_anguilera'
    ? { plan_anguilera_url: fileUrl, plan_anguilera_name: file.name, plan_anguilera_uploaded_at: nowIso }
    : { informe_pintado_url: fileUrl, informe_pintado_name: file.name, informe_pintado_uploaded_at: nowIso }

  const { error: dbErr } = await supabase.from('ships').update(updateFields).eq('id', shipId)
  if (dbErr) throw dbErr

  const { error: docErr } = await supabase.from('ship_documents').insert([{
    ship_id: shipId,
    doc_type: docType,
    title: docType === 'plano_anguilera' ? 'Plano de Diseño de Anguilera' : 'Informe de Pintado de Casco',
    file_name: file.name,
    file_url: fileUrl,
    file_size_bytes: file.size,
    uploaded_by: user || 'Jefe de Obra'
  }])
  if (docErr) console.warn('[ship_documents] Error registrando historial:', docErr.message)

  return updateFields
}

export async function deleteShipNavalDocService({ shipId, docType }) {
  const updateFields = docType === 'plano_anguilera'
    ? { plan_anguilera_url: null, plan_anguilera_name: null, plan_anguilera_uploaded_at: null }
    : { informe_pintado_url: null, informe_pintado_name: null, informe_pintado_uploaded_at: null }
  const { error } = await supabase.from('ships').update(updateFields).eq('id', shipId)
  if (error) throw error
  return updateFields
}
