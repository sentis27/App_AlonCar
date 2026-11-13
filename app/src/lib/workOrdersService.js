/**
 * workOrdersService.js
 * Capa de servicio y persistencia para Órdenes de Trabajo y Catálogo (M6 / GS-003).
 * Cumple Candado Mecánico #3 (Cero SQL en Vista) y #4 (Trazabilidad en audit_logs).
 */

import { supabase } from './supabase.js'
import { auditService } from './auditService.js'
import { assignMonotonicFolios } from './monotonicFolioEngine.js'
import {
  cleanWorkItemComment,
  normalizeSpecificBudgetId,
  formatSpecificBudgetLabel,
  isBudgetPendingAlert
} from './workOrdersConstants.js'

let cachedBudgetRequirementId = null

// Garantiza que exista el requisito canónico REQ_OT_PRESUPUESTO_ADICIONAL_MARIA_JOSE en data_requirements
async function getBudgetPendingRequirementId() {
  if (cachedBudgetRequirementId) return cachedBudgetRequirementId
  const { data: existing } = await supabase
    .from('data_requirements')
    .select('id')
    .eq('code', 'REQ_OT_PRESUPUESTO_ADICIONAL_MARIA_JOSE')
    .limit(1)
  if (existing && existing[0]?.id) {
    cachedBudgetRequirementId = existing[0].id
    return cachedBudgetRequirementId
  }
  const { data: created, error } = await supabase
    .from('data_requirements')
    .upsert({
      code: 'REQ_OT_PRESUPUESTO_ADICIONAL_MARIA_JOSE',
      module: 'ots',
      field_key: 'specific_budget_id',
      name: 'Nº de Presupuesto para Trabajo Adicional / Específico',
      description: 'Completar el número de presupuesto cuando un trabajo Adicional / Específico quedó PENDIENTE hasta su cotización/facturación.',
      trigger_event: 'ITEM_ADICIONAL_PENDIENTE',
      trigger_condition: { assignment_type: 'Adicional / Específico', specific_budget_id: 'PENDIENTE' },
      responsible_role: 'maria_jose',
      default_notice_time: '09:30:00',
      default_notice_frequency: 'CADA_48HS',
      max_attempts: 6,
      escalation_role: 'admin',
      is_active: true
    }, { onConflict: 'code' })
    .select('id')
  if (error) throw error
  cachedBudgetRequirementId = created?.[0]?.id || null
  return cachedBudgetRequirementId
}

// Sincroniza automáticamente la alerta de "Adicional sin Nº Presupuesto" para María José en compliance_alerts
export async function syncBudgetPendingAlertForWorkItem({ workItem, wo, shipId, user }) {
  if (!workItem?.id) return
  try {
    const needsAlert = isBudgetPendingAlert(workItem)
    const { data: existing } = await supabase
      .from('compliance_alerts')
      .select('id, notes')
      .eq('entity_type', 'work_items')
      .eq('entity_id', workItem.id)
      .eq('status', 'PENDIENTE')

    if (needsAlert) {
      const requirementId = await getBudgetPendingRequirementId()
      if (!requirementId) return
      const otLabel = wo?.ot_number ? `${wo.ot_number}${wo?.title ? ` (${String(wo.title).toUpperCase()})` : ''}` : 'OT'
      const msg = `Adicional sin Nº Presupuesto · ${otLabel} — ${workItem.description || 'Sin descripción'}`.trim()
      if (!existing || existing.length === 0) {
        const { error: insErr } = await supabase.from('compliance_alerts').insert([{
          requirement_id: requirementId,
          ship_id: shipId || wo?.ship_id || null,
          entity_type: 'work_items',
          entity_id: workItem.id,
          responsible_role: 'maria_jose',
          status: 'PENDIENTE',
          escalated_to_admin: false,
          alert_message: msg,
          notes: 'Responsable: María José • Completar Nº de Presupuesto (PRESUP. ...)'
        }])
        if (insErr) throw insErr
      } else {
        await supabase
          .from('compliance_alerts')
          .update({ ship_id: shipId || wo?.ship_id || null, alert_message: msg })
          .eq('id', existing[0].id)
      }
    } else if (existing && existing.length > 0) {
      const resolutionNote =
        workItem.status === 'Desestimado'
          ? 'Trabajo desestimado'
          : workItem.assignment_type === 'Presupuesto General'
          ? 'Reclasificado a Presupuesto General'
          : `Nº Presupuesto cargado: ${formatSpecificBudgetLabel(workItem.specific_budget_id)}`
      await supabase
        .from('compliance_alerts')
        .update({
          status: 'COMPLETADO',
          completed_at: new Date().toISOString(),
          completed_by: user?.email || 'María José / Sistema',
          notes: resolutionNote
        })
        .in('id', existing.map((a) => a.id))
    }
  } catch (err) {
    console.warn('No se pudo sincronizar compliance_alerts para Nº Presupuesto:', err?.message)
  }
}

// Permite a María José (Dashboard / Bandeja de Alertas) cargar el Nº numérico de presupuesto y cerrar la alerta
export async function resolvePendingBudgetAlertService({ alertItem, budgetNumber, user, userName }) {
  const cleanDigits = String(budgetNumber ?? '').replace(/\D+/g, '')
  if (!cleanDigits) {
    throw new Error('Ingresá un número de presupuesto válido (solo dígitos).')
  }
  const workItemId = alertItem?.work_item_id || alertItem?.entity_id
  if (!workItemId) {
    throw new Error('La alerta no tiene un trabajo vinculado.')
  }

  const nowIso = new Date().toISOString()
  const { error: itemErr } = await supabase
    .from('work_items')
    .update({
      specific_budget_id: cleanDigits,
      updated_at: nowIso
    })
    .eq('id', workItemId)
  if (itemErr) throw itemErr

  const formatted = formatSpecificBudgetLabel(cleanDigits)
  const resolver = userName || user?.email || 'María José'

  // Cerrar toda alerta pendiente vinculada a este work_item en compliance_alerts
  await supabase
    .from('compliance_alerts')
    .update({
      status: 'COMPLETADO',
      completed_at: nowIso,
      completed_by: resolver,
      notes: `${alertItem.notes ? `${alertItem.notes} — ` : ''}[${formatted} asignado por ${resolver}]`
    })
    .eq('entity_type', 'work_items')
    .eq('entity_id', workItemId)
    .eq('status', 'PENDIENTE')

  await auditService.logCellChange({
    entityType: 'work_orders',
    entityId: workItemId,
    entityName: alertItem.alert_message || `Trabajo ${workItemId}`,
    field: 'specific_budget_id',
    fieldLabel: 'Nº Presupuesto Específico',
    oldValue: 'PENDIENTE',
    newValue: formatted,
    sheetName: 'Órdenes de Trabajo / Alertas María José',
    moduleRoute: '/',
    user: resolver
  })

  return { workItemId, budgetDigits: cleanDigits, formatted }
}

// Consulta en vivo los trabajos Adicional / Específico pendientes de Nº Presupuesto asignados a María José
export async function fetchPendingBudgetAlertsForMariaService() {
  const { data: items, error } = await supabase
    .from('work_items')
    .select('id, work_order_id, description, status, assignment_type, specific_budget_id, created_at, work_orders(id, ot_number, title, ship_id, ships(name))')
    .eq('assignment_type', 'Adicional / Específico')
    .neq('status', 'Desestimado')
    .order('created_at', { ascending: false })
  if (error) throw error

  const pendingItems = (items || []).filter((it) => isBudgetPendingAlert(it))
  return pendingItems.map((it) => {
    const wo = it.work_orders
    const otLabel = wo?.ot_number ? `${wo.ot_number}${wo?.title ? ` (${String(wo.title).toUpperCase()})` : ''}` : 'OT'
    return {
      id: it.id,
      work_item_id: it.id,
      entity_type: 'work_items',
      entity_id: it.id,
      ship_id: wo?.ship_id || null,
      ships: wo?.ships || null,
      created_at: it.created_at,
      alert_message: `Adicional sin Nº Presupuesto · ${otLabel} — ${it.description || 'Sin descripción'}`.trim(),
      notes: 'Responsable: María José • Completar Nº de Presupuesto (PRESUP. ...)'
    }
  })
}

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
    const { data: updItemData, error } = await supabase
      .from('work_items')
      .update(itemPatch)
      .eq('id', rowId)
      .select()
    if (error) throw error

    if (updItemData?.[0] && (colKey === 'status' || colKey === 'specific_budget_id' || colKey === 'assignment_type')) {
      await syncBudgetPendingAlertForWorkItem({
        workItem: updItemData[0],
        wo: targetRow.wo,
        shipId: targetRow.wo?.ship_id,
        user
      })
    }

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
      const itemTitle = (batchItem.ot_title || '').trim().toUpperCase()
      const normalizedBudget = normalizeSpecificBudgetId(workForm.assignment_type, workForm.specific_budget_id)

      const woPayload = {
        ship_id: workForm.ship_id,
        ot_number: consecutiveOtNum,
        title: itemTitle,
        description: itemDesc || null,
        status: itemStatus === 'En ejecución' ? 'En Progreso' : itemStatus === 'Desestimado' ? 'Cancelada' : 'Pendiente',
        work_type: workForm.work_type,
        assignment_type: workForm.assignment_type,
        budget_code: normalizedBudget,
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
        specific_budget_id: normalizedBudget,
        contractors: workForm.contractors,
        contractor_name: workForm.contractors.join(', ') || null,
        comments: workForm.comments.trim() || null,
        send_to_third_party_prc: validFor3ros,
        updated_at: new Date().toISOString()
      }

      const { data: insItemData, error: itemErr } = await supabase.from('work_items').insert([itemPayload]).select()
      if (itemErr) throw itemErr
      const createdWorkItem = insItemData?.[0]

      if (createdWorkItem) {
        await syncBudgetPendingAlertForWorkItem({
          workItem: createdWorkItem,
          wo: newWoData[0],
          shipId: workForm.ship_id,
          user
        })
      }

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
  const normalizedBudget = normalizeSpecificBudgetId(workForm.assignment_type, workForm.specific_budget_id)
  const normalizedOtTitle = (workForm.ot_title || '').trim().toUpperCase()
  let targetWoRecord = null

  if (workForm.ot_mode === 'new') {
    // Blindaje defensivo contra duplicación de cabeceras en el mismo buque
    const normTitle = normalizedOtTitle
    let existingWo = null

    if (normTitle && workForm.ship_id) {
      const { data: matchedWos } = await supabase
        .from('work_orders')
        .select('id, ot_number, title, ship_id')
        .eq('ship_id', workForm.ship_id)
        .ilike('title', normTitle)
        .limit(1)

      if (matchedWos && matchedWos.length > 0) {
        existingWo = matchedWos[0]
      }
    }

    if (existingWo) {
      targetWoId = existingWo.id
      targetWoRecord = existingWo
    } else {
      const autoConsecutiveOt = getNextOtNumberForShip(workForm.ship_id, 0)
      const woPayload = {
        ship_id: workForm.ship_id,
        ot_number: autoConsecutiveOt,
        title: normalizedOtTitle,
        description: workForm.description.trim() || null,
        status: workForm.status === 'En ejecución' ? 'En Progreso' : 'Pendiente',
        work_type: workForm.work_type,
        assignment_type: workForm.assignment_type,
        budget_code: normalizedBudget,
        foreman_name: workForm.foreman_name,
        contractor_name: workForm.contractors.join(', ') || null,
        is_tabulated: workForm.ot_creation_type === 'tabulada',
        start_date: todayIso
      }

      const { data: newWoData, error: woErr } = await supabase.from('work_orders').insert([woPayload]).select()
      if (woErr) throw woErr
      targetWoId = newWoData[0].id
      targetWoRecord = newWoData[0]
    }
  } else if (editingWorkItem && normalizedOtTitle) {
    await supabase.from('work_orders').update({
      title: normalizedOtTitle,
      foreman_name: workForm.foreman_name
    }).eq('id', targetWoId)
    targetWoRecord = {
      id: targetWoId,
      ship_id: targetShipId,
      ot_number: editingWorkItem.wo?.ot_number || workForm.ot_number,
      title: normalizedOtTitle
    }
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
    specific_budget_id: normalizedBudget,
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
    if (!targetWoRecord && targetWoId) {
      const { data: woLookup } = await supabase
        .from('work_orders')
        .select('id, ot_number, title, ship_id')
        .eq('id', targetWoId)
        .limit(1)
      targetWoRecord = woLookup?.[0] || { id: targetWoId, ot_number: workForm.ot_number, title: normalizedOtTitle, ship_id: targetShipId }
    }
    await syncBudgetPendingAlertForWorkItem({
      workItem: savedWorkItem,
      wo: targetWoRecord,
      shipId: targetShipId || targetWoRecord?.ship_id,
      user
    })
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
    const newTitle = (separateForm.new_ot_title || '').trim().toUpperCase()
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

  await syncBudgetPendingAlertForWorkItem({
    workItem: { ...row, status: 'Desestimado' },
    wo: row.wo,
    shipId: row.wo?.ship_id,
    user
  })

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
      await syncBudgetPendingAlertForWorkItem({
        workItem: { ...item, status: 'Desestimado' },
        wo,
        shipId: wo.ship_id,
        user
      })
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

/**
 * Cierra orgánicamente todo el árbol de tareas de una OT en 1 solo clic.
 * Actualiza en lote todos los work_items no desestimados al estado objetivo ('Finalizado' o 'Facturado')
 * y sella la cabecera de la OT en Supabase, registrando trazabilidad completa en audit_logs.
 */
export async function closeEntireWorkOrderTreeService({
  wo,
  targetStatus = 'Finalizado',
  allowPostBillingCosts = false,
  user
}) {
  if (!wo?.id) throw new Error('Se requiere una Orden de Trabajo válida.')

  const nowIso = new Date().toISOString()

  // 1. Identificar todos los IDs de work_orders que forman este árbol (blindaje contra cabeceras hermanas)
  const targetWoIds = [wo.id]
  if (wo.ship_id && wo.ot_number) {
    const { data: siblings } = await supabase
      .from('work_orders')
      .select('id')
      .eq('ship_id', wo.ship_id)
      .eq('ot_number', wo.ot_number)
    if (siblings && siblings.length > 0) {
      siblings.forEach((s) => {
        if (!targetWoIds.includes(s.id)) targetWoIds.push(s.id)
      })
    }
  }

  // 2. Actualizar todas las subtareas/ítems activos
  const { data: updatedItems, error: itemsError } = await supabase
    .from('work_items')
    .update({
      status: targetStatus,
      updated_at: nowIso
    })
    .in('work_order_id', targetWoIds)
    .neq('status', 'Desestimado')
    .select('id, description')

  if (itemsError) throw itemsError

  // 3. Actualizar la cabecera de la OT (sin updated_at que no existe en el esquema de work_orders)
  const isBilled = targetStatus === 'Facturado'
  const woPayload = {
    status: isBilled ? 'Facturada' : 'Completada',
    allow_post_billing_costs: isBilled ? Boolean(allowPostBillingCosts) : false,
    closed_at: nowIso
  }

  const { error: woError } = await supabase
    .from('work_orders')
    .update(woPayload)
    .in('id', targetWoIds)

  if (woError) throw woError

  // 3. Estampar auditoría en audit_logs
  await auditService.logRowAction({
    action: isBilled ? 'CLOSE_TREE_FACTURADO' : 'CLOSE_TREE_FINALIZADO',
    entityType: 'work_orders',
    entityId: wo.id,
    entityName: `Cierre de Árbol · ${wo.ot_number || 'OT'} - ${wo.title}`,
    details: {
      targetStatus,
      allowPostBillingCosts: isBilled ? Boolean(allowPostBillingCosts) : false,
      totalItemsUpdated: updatedItems?.length || 0,
      tasks: (updatedItems || []).map((t) => t.description)
    },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor'
  })

  return {
    success: true,
    targetStatus,
    updatedCount: updatedItems?.length || 0
  }
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
