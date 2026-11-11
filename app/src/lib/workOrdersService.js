/**
 * workOrdersService.js
 * Capa de servicio y persistencia para Órdenes de Trabajo y Catálogo (M6 / GS-003).
 * Cumple Candado Mecánico #3 (Cero SQL en Vista) y #4 (Trazabilidad en audit_logs).
 */

import { supabase } from './supabase.js'
import { auditService } from './auditService.js'
import { assignMonotonicFolios } from './monotonicFolioEngine.js'
import { cleanWorkItemComment } from './workOrdersConstants.js'

// Carga inicial y recarga completa de datos del módulo de Órdenes de Trabajo
export async function fetchWorkOrdersData() {
  const [shipsRes, wosRes, itemsRes, workersRes, tplRes, tpRes, logsRes, invRes, poRes] = await Promise.all([
    supabase.from('ships').select('*').order('name'),
    supabase.from('work_orders').select('*, ships(name, client_name)').order('created_at', { ascending: false }),
    supabase.from('work_items').select('*').order('created_at', { ascending: true }),
    supabase.from('workers').select('*').order('name'),
    supabase.from('ot_templates').select('*').order('sort_order').order('name'),
    supabase.from('third_party_services').select('*').order('created_at', { ascending: false }),
    supabase.from('labor_logs').select('id, ship_id, work_order_id, work_item_id, hours_worked, hours_normal, hours_extra_50, hours_extra_100, worker_name, date_logged'),
    supabase.from('inventory_transactions').select('id, work_order_id, work_item_id, transaction_date, quantity_withdrawn, contractor_name'),
    supabase.from('purchase_orders').select('id, ship_id, work_order_id, charge_type')
  ])

  return {
    ships: shipsRes.data || [],
    workOrders: assignMonotonicFolios(wosRes.data || [], { dateField: 'created_at' }),
    workItems: assignMonotonicFolios(itemsRes.data || [], { dateField: 'created_at' }),
    workers: workersRes.data || [],
    templates: tplRes.data || [],
    thirdPartyServices: tpRes.data || [],
    laborLogs: logsRes.data || [],
    inventoryTx: invRes.data || [],
    purchaseOrders: poRes.data || []
  }
}

// Edición in-situ de celda en la planilla unificada
export async function applyWoSinglePatchService({
  rowId,
  colKey,
  cleanVal,
  targetRow,
  user
}) {
  if (targetRow.isPlaceholder) {
    if (colKey === 'status') {
      const { data: insData, error: insErr } = await supabase
        .from('work_items')
        .insert([{
          work_order_id: targetRow.work_order_id,
          description: targetRow.description || targetRow.wo?.title || '',
          status: cleanVal,
          foreman_name: targetRow.foreman_name || 'ALE CAMADELLI',
          work_type: targetRow.work_type || 'HORA',
          assignment_type: targetRow.assignment_type || 'Presupuesto General',
          contractors: targetRow.contractors || [],
          updated_at: new Date().toISOString()
        }])
        .select()
      if (insErr) throw insErr
      return { type: 'created_item', item: insData?.[0] }
    } else {
      const woPatch = { [colKey]: cleanVal }
      const { error } = await supabase
        .from('work_orders')
        .update(woPatch)
        .eq('id', targetRow.work_order_id)
      if (error) throw error
    }
  } else {
    // Actualizar work_item real
    const itemPatch = { [colKey]: cleanVal, updated_at: new Date().toISOString() }
    const { error } = await supabase
      .from('work_items')
      .update(itemPatch)
      .eq('id', rowId)
    if (error) throw error

    // Si se modificó la descripción y existe un PRC vinculado en Terceros, sincronizar direct_observations
    if (colKey === 'description' && targetRow.thirdPartyRecord) {
      await supabase
        .from('third_party_services')
        .update({ direct_observations: cleanVal || 'Sin descripción cargada en la OT', updated_at: new Date().toISOString() })
        .eq('id', targetRow.thirdPartyRecord.id)
    }
  }

  await auditService.logCellChange({
    entityType: 'work_orders',
    entityId: rowId,
    entityName: `${targetRow.wo?.ot_number || 'OT'} · ${targetRow.description || ''}`,
    field: colKey,
    fieldLabel: colKey,
    oldValue: targetRow[colKey],
    newValue: cleanVal,
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    moduleRoute: '/ots',
    user: user?.email || 'Supervisor'
  })

  return { type: 'updated', cleanVal }
}

// Crear / Guardar Trabajo(s) (soporta caso individual o batch múltiple desde OT.ABC)
export async function saveWorkOrderService({
  workForm,
  editingWorkItem,
  selectedBatchTemplates = [],
  workers = [],
  user,
  getNextOtNumberForShip
}) {
  const todayIso = new Date().toISOString().split('T')[0]
  const isBatchMode =
    !editingWorkItem &&
    workForm.ot_mode === 'new' &&
    workForm.ot_creation_type === 'tabulada' &&
    selectedBatchTemplates.length > 1

  const validFor3ros =
    workForm.contractors.length === 1 &&
    Boolean(workForm.send_to_third_party_prc)

  if (isBatchMode) {
    const createdOtNumbers = []
    for (let idx = 0; idx < selectedBatchTemplates.length; idx++) {
      const batchItem = selectedBatchTemplates[idx]
      const consecutiveOtNum = getNextOtNumberForShip(workForm.ship_id, idx)
      createdOtNumbers.push(consecutiveOtNum)

      const itemStatus = batchItem.status || 'En ejecución'
      const itemDesc = (batchItem.description ?? '').trim()
      const itemTitle = (batchItem.ot_title || '').trim()

      const woPayload = {
        ship_id: workForm.ship_id,
        ot_number: consecutiveOtNum,
        title: itemTitle,
        description: itemDesc || null,
        status: itemStatus === 'En ejecución' ? 'En Progreso' : itemStatus === 'Desestimado' ? 'Cancelada' : 'Pendiente',
        work_type: workForm.work_type,
        assignment_type: workForm.assignment_type,
        budget_code: workForm.specific_budget_id.trim() || null,
        foreman_name: workForm.foreman_name,
        contractor_name: workForm.contractors.join(', ') || null,
        is_tabulated: true,
        start_date: todayIso
      }

      const { data: newWoData, error: woErr } = await supabase.from('work_orders').insert([woPayload]).select()
      if (woErr) throw woErr
      const createdWoId = newWoData[0].id

      const itemPayload = {
        work_order_id: createdWoId,
        description: itemDesc,
        status: itemStatus,
        foreman_name: workForm.foreman_name,
        work_type: workForm.work_type,
        assignment_type: workForm.assignment_type,
        specific_budget_id: workForm.specific_budget_id.trim() || null,
        contractors: workForm.contractors,
        contractor_name: workForm.contractors.join(', ') || null,
        comments: workForm.comments.trim() || null,
        send_to_third_party_prc: validFor3ros,
        updated_at: new Date().toISOString()
      }

      const { data: insItemData, error: itemErr } = await supabase.from('work_items').insert([itemPayload]).select()
      if (itemErr) throw itemErr
      const createdWorkItem = insItemData?.[0]

      if (createdWorkItem && validFor3ros) {
        const singleContractor = workForm.contractors[0]
        await supabase.from('third_party_services').upsert({
          work_item_id: createdWorkItem.id,
          work_order_id: createdWoId,
          ship_id: workForm.ship_id,
          contractor_name: singleContractor,
          status: 'PRC',
          voucher_type: 'PRC',
          amount_ars: 0,
          service_date: todayIso,
          direct_observations: itemDesc || 'Sin descripción cargada en la OT',
          specific_observations: workForm.specific_observations.trim() || null,
          updated_at: new Date().toISOString()
        }, { onConflict: 'work_item_id' })
      }

      await auditService.logRowAction({
        action: 'CREATE',
        entityType: 'work_orders',
        entityId: createdWoId,
        entityName: `${consecutiveOtNum} · ${itemTitle}`,
        details: { batch: true, index: idx + 1, itemStatus },
        sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
        user: user?.email || 'Supervisor'
      })
    }

    return { type: 'batch', count: createdOtNumbers.length, createdOtNumbers }
  }

  // CASO B: GUARDADO INDIVIDUAL
  let targetWoId = workForm.existing_wo_id
  let targetShipId = workForm.ship_id

  if (workForm.ot_mode === 'new') {
    const autoConsecutiveOt = getNextOtNumberForShip(workForm.ship_id, 0)
    const woPayload = {
      ship_id: workForm.ship_id,
      ot_number: autoConsecutiveOt,
      title: workForm.ot_title.trim(),
      description: workForm.description.trim() || null,
      status: workForm.status === 'En ejecución' ? 'En Progreso' : 'Pendiente',
      work_type: workForm.work_type,
      assignment_type: workForm.assignment_type,
      budget_code: workForm.specific_budget_id.trim() || null,
      foreman_name: workForm.foreman_name,
      contractor_name: workForm.contractors.join(', ') || null,
      is_tabulated: workForm.ot_creation_type === 'tabulada',
      start_date: todayIso
    }

    const { data: newWoData, error: woErr } = await supabase.from('work_orders').insert([woPayload]).select()
    if (woErr) throw woErr
    targetWoId = newWoData[0].id
  } else if (editingWorkItem && workForm.ot_title.trim()) {
    await supabase.from('work_orders').update({
      title: workForm.ot_title.trim(),
      foreman_name: workForm.foreman_name
    }).eq('id', targetWoId)
  }

  const existingEliminadaTag =
    editingWorkItem && workForm.status === 'Desestimado' && String(editingWorkItem.comments || '').includes('ELIMINADA')
      ? '[ELIMINADA] Desestimada por eliminación'
      : ''
  const mergedComments = [workForm.comments.trim(), existingEliminadaTag].filter(Boolean).join(' | ') || null

  const itemPayload = {
    work_order_id: targetWoId,
    description: workForm.description.trim(),
    status: workForm.status,
    foreman_name: workForm.foreman_name,
    work_type: workForm.work_type,
    assignment_type: workForm.assignment_type,
    specific_budget_id: workForm.specific_budget_id.trim() || null,
    contractors: workForm.contractors,
    contractor_name: workForm.contractors.join(', ') || null,
    comments: mergedComments,
    send_to_third_party_prc: validFor3ros,
    updated_at: new Date().toISOString()
  }

  let savedWorkItem = null
  if (editingWorkItem && !editingWorkItem.isPlaceholder) {
    const { data: updData, error: itemErr } = await supabase.from('work_items').update(itemPayload).eq('id', editingWorkItem.id).select()
    if (itemErr) throw itemErr
    savedWorkItem = updData?.[0] || { ...editingWorkItem, ...itemPayload }
  } else {
    const { data: insData, error: itemErr } = await supabase.from('work_items').insert([itemPayload]).select()
    if (itemErr) throw itemErr
    savedWorkItem = insData?.[0]
  }

  if (savedWorkItem) {
    if (validFor3ros) {
      const singleContractor = workForm.contractors[0]
      const workerObj = workers.find(w => w.name.toUpperCase().trim() === singleContractor?.toUpperCase().trim())
      const resolvedTrade = workerObj?.trade && workerObj.trade.toUpperCase().trim() !== 'MANUAL' ? workerObj.trade : null
      const tpPayload = {
        work_item_id: savedWorkItem.id,
        work_order_id: targetWoId,
        ship_id: targetShipId,
        contractor_name: singleContractor,
        trade: resolvedTrade,
        status: 'PRC',
        voucher_type: 'PRC',
        amount_ars: 0,
        service_date: todayIso,
        entry_date: todayIso,
        direct_observations: workForm.description.trim() || 'Sin descripción cargada en la OT',
        specific_observations: workForm.specific_observations.trim() || null,
        updated_at: new Date().toISOString()
      }

      await supabase.from('third_party_services').upsert(tpPayload, { onConflict: 'work_item_id' })
    } else if (editingWorkItem) {
      await supabase.from('third_party_services').delete().eq('work_item_id', editingWorkItem.id)
    }
  }

  await auditService.logRowAction({
    action: editingWorkItem ? 'UPDATE' : 'CREATE',
    entityType: 'work_orders',
    entityId: targetWoId,
    entityName: `OT · ${workForm.ot_title || targetWoId}`,
    details: { workItemId: savedWorkItem?.id, status: workForm.status, contractors: workForm.contractors },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor'
  })

  return { type: 'single', savedWorkItem, validFor3ros }
}

// Crear o promover nuevo Jefe de Obra In-Situ
export async function createForemanInlineService(newForemanForm, workers = [], user) {
  const cleanName = newForemanForm.name.trim().toUpperCase()
  if (!cleanName) throw new Error('Ingresá el nombre y apellido del nuevo Jefe de Obra.')

  const existingWorker = workers.find(w => (w.name || '').trim().toUpperCase() === cleanName)
  let savedWorker = null

  if (existingWorker) {
    const { data, error } = await supabase
      .from('workers')
      .update({
        is_foreman: true,
        trade: 'TECNICOS',
        status: 'ACTIVO'
      })
      .eq('id', existingWorker.id)
      .select()
    if (error) throw error
    savedWorker = data?.[0] || { ...existingWorker, is_foreman: true, trade: 'TECNICOS', status: 'ACTIVO' }
  } else {
    const workerPayload = {
      name: cleanName,
      work_group: 'ASTILLERO',
      trade: 'TECNICOS',
      admin_center: 'ASTILLERO',
      consumables: 'CLIENTE',
      consumables_discount_pct: 0,
      safety_items: 'ASTILLERO',
      status: 'ACTIVO',
      hourly_rate_ars: 0,
      hourly_rate_usd: 0,
      category: 'OFICIAL',
      can_withdraw_materials: true,
      can_impute_hours: true,
      can_charge_third_party: false,
      is_foreman: true
    }
    const { data, error } = await supabase.from('workers').insert([workerPayload]).select()
    if (error) throw error
    savedWorker = data?.[0] || workerPayload
  }

  const roleSlug = `JEFE_OBRA_${cleanName.replace(/[^A-Z0-9]+/g, '_')}`
  await supabase.from('organization_roles').upsert({
    role_key: roleSlug,
    role_title: 'Jefe de Obra Naval (TECNICOS)',
    holder_name: cleanName,
    department: 'Operaciones',
    security_level: 'SUPERVISOR',
    allowed_sections: ['barcos', 'ots', 'horas', 'panol'],
    status: 'ACTIVO',
    notes: 'Jefe de Obra (Rubro Técnico) dado de alta desde el módulo de Órdenes de Trabajo',
    updated_at: new Date().toISOString()
  }, { onConflict: 'role_key' })

  await auditService.logRowAction({
    action: 'CREATE',
    entityType: 'workers',
    entityId: savedWorker.id || roleSlug,
    entityName: `Jefe de Obra · ${cleanName}`,
    details: { trade: 'TECNICOS', roleSlug },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor'
  })

  return savedWorker
}

// Separar / Independizar trabajo de una OT
export async function separateWorkItemService({
  separateForm,
  separatingRow,
  user,
  getNextOtNumberForShip,
  workOrders = []
}) {
  const sourceWo = separatingRow.wo
  const shipId = sourceWo?.ship_id
  let targetWoId = separateForm.target_existing_wo_id
  let targetWoLabel = ''
  const timestamp = new Date().toLocaleString('es-AR')
  const author = user?.email?.split('@')[0] || 'Supervisor'

  if (separateForm.mode === 'new_ot') {
    const newOtNum = getNextOtNumberForShip(shipId)
    const newTitle = separateForm.new_ot_title.trim()
    const originNote = `[${timestamp} - Separación de OT por ${author}]: Trabajo independizado desde ${sourceWo?.ot_number} (${sourceWo?.title}). Motivo: ${separateForm.reason.trim()}`

    const woPayload = {
      ship_id: shipId,
      ot_number: newOtNum,
      title: newTitle,
      description: separatingRow.description || null,
      status: separatingRow.status === 'En ejecución' ? 'En Progreso' : 'Pendiente',
      work_type: separatingRow.work_type || 'HORA',
      assignment_type: separatingRow.assignment_type || 'Presupuesto General',
      budget_code: separatingRow.specific_budget_id || null,
      foreman_name: separatingRow.foreman_name || sourceWo?.foreman_name,
      contractor_name: (separatingRow.contractors || []).join(', ') || null,
      is_tabulated: separateForm.ot_creation_type === 'tabulada',
      start_date: new Date().toISOString().split('T')[0],
      notes: originNote
    }

    const { data: createdWo, error: createWoErr } = await supabase.from('work_orders').insert([woPayload]).select()
    if (createWoErr) throw createWoErr
    targetWoId = createdWo[0].id
    targetWoLabel = `${newOtNum} - ${newTitle}`
  } else {
    const destWo = workOrders.find(w => w.id === targetWoId)
    targetWoLabel = destWo ? `${destWo.ot_number} - ${destWo.title}` : 'OT destino'
    const destNote = `[${timestamp} - Reasignación de Trabajo por ${author}]: Se incorporó trabajo proveniente de ${sourceWo?.ot_number} (${sourceWo?.title}). Motivo: ${separateForm.reason.trim()}`
    const updatedDestNotes = destWo?.notes ? `${destWo.notes}\n\n${destNote}` : destNote
    await supabase.from('work_orders').update({ notes: updatedDestNotes }).eq('id', targetWoId)
  }

  if (sourceWo?.id) {
    const sourceNote = `[${timestamp} - Trabajo Separado por ${author}]: El trabajo "${(separatingRow.description || '').slice(0, 60)}..." fue separado hacia ${targetWoLabel}. Motivo: ${separateForm.reason.trim()}`
    const updatedSourceNotes = sourceWo.notes ? `${sourceWo.notes}\n\n${sourceNote}` : sourceNote
    await supabase.from('work_orders').update({ notes: updatedSourceNotes }).eq('id', sourceWo.id)
  }

  const { error: moveItemErr } = await supabase.from('work_items').update({
    work_order_id: targetWoId,
    updated_at: new Date().toISOString()
  }).eq('id', separatingRow.id)
  if (moveItemErr) throw moveItemErr

  await supabase.from('third_party_services').update({
    work_order_id: targetWoId,
    updated_at: new Date().toISOString()
  }).eq('work_item_id', separatingRow.id)

  if (separateForm.migrate_linked_records) {
    await supabase.from('labor_logs').update({ work_order_id: targetWoId }).eq('work_item_id', separatingRow.id)
    await supabase.from('inventory_transactions').update({ work_order_id: targetWoId }).eq('work_item_id', separatingRow.id)
  }

  await auditService.logRowAction({
    action: 'UPDATE',
    entityType: 'work_orders',
    entityId: targetWoId,
    entityName: `Separación · ${targetWoLabel}`,
    details: { workItemId: separatingRow.id, sourceWoId: sourceWo?.id, reason: separateForm.reason },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor'
  })

  return targetWoLabel
}

// Carga guiada en cascada hacia Terceros
export async function saveThirdPartyCascadeService(tpCascadeForm, selectedWorkItem, workers = [], user) {
  const workerObj = workers.find(w => w.name.toUpperCase().trim() === tpCascadeForm.contractor_name?.toUpperCase().trim())
  const resolvedTrade = workerObj?.trade && workerObj.trade.toUpperCase().trim() !== 'MANUAL' ? workerObj.trade : null
  const vNum = tpCascadeForm.voucher_number.trim() || null
  const isPrc = (tpCascadeForm.status || 'PRC') === 'PRC'

  const payload = {
    work_item_id: selectedWorkItem.id,
    work_order_id: selectedWorkItem.work_order_id,
    ship_id: tpCascadeForm.ship_id,
    contractor_name: tpCascadeForm.contractor_name,
    trade: resolvedTrade,
    status: tpCascadeForm.status || 'PRC',
    voucher_type: tpCascadeForm.status || 'PRC',
    voucher_number: vNum,
    budget_number: isPrc ? vNum : null,
    invoice_number: !isPrc ? vNum : null,
    amount_ars: parseFloat(tpCascadeForm.amount_ars) || 0,
    service_date: tpCascadeForm.service_date || new Date().toISOString().split('T')[0],
    entry_date: tpCascadeForm.service_date || new Date().toISOString().split('T')[0],
    direct_observations: selectedWorkItem.description || 'Sin descripción en la OT',
    specific_observations: tpCascadeForm.specific_observations.trim() || null,
    updated_at: new Date().toISOString()
  }

  const { error } = await supabase.from('third_party_services').upsert(payload, { onConflict: 'work_item_id' })
  if (error) throw error

  await auditService.logRowAction({
    action: 'CREATE',
    entityType: 'third_party_services',
    entityId: selectedWorkItem.id,
    entityName: `Terceros PRC · ${tpCascadeForm.contractor_name}`,
    details: { workOrderId: selectedWorkItem.work_order_id, amount: payload.amount_ars },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor'
  })
}

// Desestimar por eliminación un trabajo (preserva el consecutivo)
export async function deleteWorkItemService(row, user) {
  const baseComment = cleanWorkItemComment(row.comments)
  const nextComment = [baseComment, '[ELIMINADA] Desestimada por eliminación'].filter(Boolean).join(' | ')

  const { error } = await supabase
    .from('work_items')
    .update({
      status: 'Desestimado',
      comments: nextComment,
      updated_at: new Date().toISOString()
    })
    .eq('id', row.id)
  if (error) throw error

  await auditService.logRowAction({
    action: 'DELETE',
    entityType: 'work_items',
    entityId: row.id,
    entityName: `Trabajo Desestimado · ${row.description || row.id}`,
    details: { otNumber: row.wo?.ot_number },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor'
  })
}

// Desestimar por eliminación una OT completa (preserva el consecutivo)
export async function deleteWoService(wo, items = [], foremenList = [], user) {
  const timestamp = new Date().toLocaleString('es-AR')
  const elimNote = `[ELIMINADA] Desestimada por eliminación (${timestamp})`
  const updatedNotes = (wo.notes || '').includes('[ELIMINADA]')
    ? wo.notes
    : [wo.notes, elimNote].filter(Boolean).join('\n\n')

  const { error: woError } = await supabase
    .from('work_orders')
    .update({ status: 'Cancelada', notes: updatedNotes })
    .eq('id', wo.id)
  if (woError) throw woError

  if (items.length > 0) {
    for (const item of items) {
      const baseComment = cleanWorkItemComment(item.comments)
      const nextComment = [baseComment, '[ELIMINADA] Desestimada por eliminación'].filter(Boolean).join(' | ')
      await supabase
        .from('work_items')
        .update({ status: 'Desestimado', comments: nextComment, updated_at: new Date().toISOString() })
        .eq('id', item.id)
    }
  } else {
    await supabase.from('work_items').insert([{
      work_order_id: wo.id,
      description: wo.description || wo.title,
      status: 'Desestimado',
      foreman_name: wo.foreman_name || foremenList[0] || 'ALE CAMADELLI',
      work_type: wo.work_type || 'HORA',
      assignment_type: wo.assignment_type || 'Presupuesto General',
      contractors: wo.contractor_name ? [wo.contractor_name] : [],
      contractor_name: wo.contractor_name || null,
      comments: '[ELIMINADA] Desestimada por eliminación',
      updated_at: new Date().toISOString()
    }])
  }

  await auditService.logRowAction({
    action: 'DELETE',
    entityType: 'work_orders',
    entityId: wo.id,
    entityName: `OT Desestimada · ${wo.ot_number} ${wo.title}`,
    details: { totalItems: items.length },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor'
  })
}

// Facturar / Cerrar una OT con validación de trabajos
export async function closeOtWithValidationService(wo, allowPostBillingCosts = false, user) {
  await supabase
    .from('work_items')
    .update({ status: 'Facturado', updated_at: new Date().toISOString() })
    .eq('work_order_id', wo.id)
    .neq('status', 'Desestimado')

  const { error } = await supabase
    .from('work_orders')
    .update({
      status: 'Facturada',
      allow_post_billing_costs: allowPostBillingCosts,
      closed_at: new Date().toISOString()
    })
    .eq('id', wo.id)
  if (error) throw error

  await auditService.logRowAction({
    action: 'UPDATE',
    entityType: 'work_orders',
    entityId: wo.id,
    entityName: `OT Facturada · ${wo.ot_number}`,
    details: { allowPostBillingCosts },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor'
  })
}

// Guardar Observaciones en Terceros
export async function saveThirdPartyEditService(editingThirdParty, user) {
  const { error } = await supabase
    .from('third_party_services')
    .update({
      specific_observations: editingThirdParty.specific_observations?.trim() || null,
      amount_ars: parseFloat(editingThirdParty.amount_ars) || 0,
      status: editingThirdParty.status || 'PRC',
      service_date: editingThirdParty.service_date || new Date().toISOString().split('T')[0],
      voucher_number: editingThirdParty.voucher_number?.trim() || null,
      updated_at: new Date().toISOString()
    })
    .eq('id', editingThirdParty.id)
  if (error) throw error

  await auditService.logRowAction({
    action: 'UPDATE',
    entityType: 'third_party_services',
    entityId: editingThirdParty.id,
    entityName: `Terceros Edit · ${editingThirdParty.voucher_number || editingThirdParty.id}`,
    details: { amount: editingThirdParty.amount_ars, status: editingThirdParty.status },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor'
  })
}

// Guardar o Actualizar plantilla en el Catálogo OT.ABC
export async function saveTemplateService(templateEdit, totalTemplates = 0, user) {
  const payload = {
    name: templateEdit.name.trim(),
    description: templateEdit.description?.trim() || null,
    category: templateEdit.category || null
  }
  const { error } = templateEdit.id
    ? await supabase.from('ot_templates').update(payload).eq('id', templateEdit.id)
    : await supabase.from('ot_templates').insert([{ ...payload, sort_order: totalTemplates + 1 }])
  if (error) throw error

  await auditService.logRowAction({
    action: templateEdit.id ? 'UPDATE' : 'CREATE',
    entityType: 'ot_templates',
    entityId: templateEdit.id || 'NEW',
    entityName: `Plantilla OT.ABC · ${payload.name}`,
    details: payload,
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor'
  })
}

// Eliminar plantilla del Catálogo OT.ABC
export async function deleteTemplateService(tplId, tplName, user) {
  const { error } = await supabase.from('ot_templates').delete().eq('id', tplId)
  if (error) throw error

  await auditService.logRowAction({
    action: 'DELETE',
    entityType: 'ot_templates',
    entityId: tplId,
    entityName: `Plantilla Eliminada · ${tplName || tplId}`,
    details: {},
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor'
  })
}

// Consulta a Jefe de Obra (Botón Ampliar)
export async function submitAmpliarService(selectedWoDetail, ampliarText, user) {
  const timestamp = new Date().toLocaleString('es-AR')
  const author = user?.email?.split('@')[0] || 'Supervisor'
  const appendedNote = `[${timestamp} - Consulta de ${author} a Jefe de Obra (${selectedWoDetail.foreman_name})]: ${ampliarText.trim()}`
  const newNotes = selectedWoDetail.notes ? `${selectedWoDetail.notes}\n\n${appendedNote}` : appendedNote

  const { error } = await supabase.from('work_orders').update({ notes: newNotes }).eq('id', selectedWoDetail.id)
  if (error) throw error

  await auditService.logRowAction({
    action: 'UPDATE',
    entityType: 'work_orders',
    entityId: selectedWoDetail.id,
    entityName: `Consulta Ampliar · ${selectedWoDetail.ot_number}`,
    details: { note: appendedNote },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor'
  })

  return newNotes
}
