/**
 * workOrdersService.js
 * Capa de servicio y persistencia para Órdenes de Trabajo y Catálogo (M6 / GS-003).
 * Cumple Candado Mecánico #3 (Cero SQL en Vista) y #4 (Trazabilidad en audit_logs).
 */

import { auditService } from './auditService.js'
import { assignMonotonicFolios } from './monotonicFolioEngine.js'
import { assertNoDuplicateOtTitleInDb, separateWorkItemCompleteService } from './workOrderTransferService.js'
import { syncWorkOrderHeaderStatusService } from './workOrderHeaderSync.js'
import { normalizeOtTitleKey } from './workOrderUnificationEngine.js'
import { buildWorkItemPayloadsFromTemplateSelection } from './otAbcCatalogConstants.js'
export {
  saveOtTemplateCompleteService as saveTemplateService,
  deleteOtTemplateService as deleteTemplateService,
  updateOtTemplateCategoryService,
} from './otAbcCatalogService.js'
import {
  cleanWorkItemComment,
  normalizeSpecificBudgetId,
  formatSpecificBudgetLabel,
  isBudgetPendingAlert,
} from './workOrdersConstants.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { workItemsRepository } from '../repositories/workItemsRepository.js'
import { dataRequirementsRepository, complianceAlertsRepository } from '../repositories/complianceAlertsRepository.js'
import { shipsRepository } from '../repositories/shipsRepository.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { otTemplatesRepository } from '../repositories/otTemplatesRepository.js'
import { thirdPartyServicesRepository } from '../repositories/thirdPartyServicesRepository.js'
import { laborLogsRepository } from '../repositories/laborLogsRepository.js'
import { inventoryTransactionsRepository } from '../repositories/inventoryTransactionsRepository.js'
import { purchaseOrdersRepository } from '../repositories/purchaseOrdersRepository.js'
import { organizationRolesRepository } from '../repositories/organizationRolesRepository.js'

const BUDGET_REQUIREMENT_DEF = {
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
  is_active: true,
}

let cachedBudgetRequirementId = null

async function getBudgetPendingRequirementId() {
  if (cachedBudgetRequirementId) return cachedBudgetRequirementId
  const { data, error } = await dataRequirementsRepository.ensureByCode(
    BUDGET_REQUIREMENT_DEF.code,
    BUDGET_REQUIREMENT_DEF
  )
  if (error) throw new Error(error)
  cachedBudgetRequirementId = data?.id || null
  return cachedBudgetRequirementId
}

export async function syncBudgetPendingAlertForWorkItem({ workItem, wo, shipId, user }) {
  if (!workItem?.id) return
  try {
    const needsAlert = isBudgetPendingAlert(workItem)
    const { data: existing } = await complianceAlertsRepository.listPending({
      select: 'id, notes',
      filters: { entity_type: 'work_items', entity_id: workItem.id },
    })

    if (needsAlert) {
      const requirementId = await getBudgetPendingRequirementId()
      if (!requirementId) return
      const otLabel = wo?.ot_number ? `${wo.ot_number}${wo?.title ? ` (${String(wo.title).toUpperCase()})` : ''}` : 'OT'
      const msg = `Adicional sin Nº Presupuesto · ${otLabel} — ${workItem.description || 'Sin descripción'}`.trim()
      if (!existing || existing.length === 0) {
        const { error: insErr } = await complianceAlertsRepository.insertOne({
          requirement_id: requirementId,
          ship_id: shipId || wo?.ship_id || null,
          entity_type: 'work_items',
          entity_id: workItem.id,
          responsible_role: 'maria_jose',
          status: 'PENDIENTE',
          escalated_to_admin: false,
          alert_message: msg,
          notes: 'Responsable: María José • Completar Nº de Presupuesto (PRESUP. ...)',
        })
        if (insErr) throw new Error(insErr)
      } else {
        await complianceAlertsRepository.updateById(
          existing[0].id,
          { ship_id: shipId || wo?.ship_id || null, alert_message: msg },
          { select: null }
        )
      }
    } else if (existing && existing.length > 0) {
      const resolutionNote =
        workItem.status === 'Desestimado'
          ? 'Trabajo desestimado'
          : workItem.assignment_type === 'Presupuesto General'
          ? 'Reclasificado a Presupuesto General'
          : `Nº Presupuesto cargado: ${formatSpecificBudgetLabel(workItem.specific_budget_id)}`
      await complianceAlertsRepository.closeByIds(
        existing.map((a) => a.id),
        {
          status: 'COMPLETADO',
          completed_at: new Date().toISOString(),
          completed_by: user?.email || 'María José / Sistema',
          notes: resolutionNote,
        }
      )
    }
  } catch (err) {
    console.warn('No se pudo sincronizar compliance_alerts para Nº Presupuesto:', err?.message)
  }
}

export async function resolvePendingBudgetAlertService({ alertItem, budgetNumber, user, userName }) {
  const cleanDigits = String(budgetNumber ?? '').replace(/\D+/g, '')
  if (!cleanDigits) throw new Error('Ingresá un número de presupuesto válido (solo dígitos).')
  const workItemId = alertItem?.work_item_id || alertItem?.entity_id
  if (!workItemId) throw new Error('La alerta no tiene un trabajo vinculado.')

  const nowIso = new Date().toISOString()
  const { error: itemErr } = await workItemsRepository.updateById(
    workItemId,
    { specific_budget_id: cleanDigits, updated_at: nowIso },
    { select: null }
  )
  if (itemErr) throw new Error(itemErr)

  const formatted = formatSpecificBudgetLabel(cleanDigits)
  const resolver = userName || user?.email || 'María José'

  await complianceAlertsRepository.closePendingForWorkItem(workItemId, {
    status: 'COMPLETADO',
    completed_at: nowIso,
    completed_by: resolver,
    notes: `${alertItem.notes ? `${alertItem.notes} — ` : ''}[${formatted} asignado por ${resolver}]`,
  })

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
    user: resolver,
  })

  return { workItemId, budgetDigits: cleanDigits, formatted }
}

export async function fetchPendingBudgetAlertsForMariaService() {
  const { data: items, error } = await workItemsRepository.listPendingBudgetAlerts()
  if (error) throw new Error(error)

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
      notes: 'Responsable: María José • Completar Nº de Presupuesto (PRESUP. ...)',
    }
  })
}

export async function fetchWorkOrdersData() {
  const [shipsRes, wosRes, itemsRes, workersRes, tplRes, tpRes, logsRes, invRes, poRes] = await Promise.all([
    shipsRepository.listShips(),
    workOrdersRepository.listWorkOrders({ select: '*, ships(name, client_name)' }),
    workItemsRepository.listWorkItems(),
    workersRepository.listWorkers({ orderBy: [{ column: 'name', ascending: true }] }),
    otTemplatesRepository.listTemplates(),
    thirdPartyServicesRepository.listServices(),
    laborLogsRepository.listLaborLogs({
      select: 'id, ship_id, work_order_id, work_item_id, hours_worked, hours_normal, hours_extra_50, hours_extra_100, worker_name, date_logged',
      orderBy: [],
      limit: null,
    }),
    inventoryTransactionsRepository.listTransactions({
      select: 'id, ship_id, material_id, work_order_id, work_item_id, transaction_date, quantity_withdrawn, contractor_name, is_deletion_requested',
      orderBy: [],
    }),
    purchaseOrdersRepository.listOrders({ select: 'id, ship_id, work_order_id, charge_type', orderBy: [] }),
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
    purchaseOrders: poRes.data || [],
  }
}

export async function applyWoSinglePatchService({ rowId, colKey, cleanVal, targetRow, user }) {
  if (targetRow.isPlaceholder) {
    if (colKey === 'status') {
      const { data: insData, error: insErr } = await workItemsRepository.insertOne({
        work_order_id: targetRow.work_order_id,
        description: targetRow.description || targetRow.wo?.title || '',
        status: cleanVal,
        foreman_name: targetRow.foreman_name || 'ALE CAMADELLI',
        work_type: targetRow.work_type || 'HORA',
        assignment_type: targetRow.assignment_type || 'Presupuesto General',
        contractors: targetRow.contractors || [],
        updated_at: new Date().toISOString(),
      })
      if (insErr) throw new Error(insErr)
      return { type: 'created_item', item: insData }
    }
    const { error } = await workOrdersRepository.updateById(
      targetRow.work_order_id,
      { [colKey]: cleanVal },
      { select: null }
    )
    if (error) throw new Error(error)
  } else {
    const itemPatch = { [colKey]: cleanVal, updated_at: new Date().toISOString() }
    const { data: updItem, error } = await workItemsRepository.updateById(rowId, itemPatch, { select: '*' })
    if (error) throw new Error(error)

    if (updItem && (colKey === 'status' || colKey === 'specific_budget_id' || colKey === 'assignment_type')) {
      await syncBudgetPendingAlertForWorkItem({
        workItem: updItem,
        wo: targetRow.wo,
        shipId: targetRow.wo?.ship_id,
        user,
      })
    }

    if (colKey === 'description' && targetRow.thirdPartyRecord) {
      await thirdPartyServicesRepository.updateById(
        targetRow.thirdPartyRecord.id,
        { direct_observations: cleanVal || 'Sin descripción cargada en la OT', updated_at: new Date().toISOString() },
        { select: null }
      )
    }

    if (colKey === 'status' && targetRow.work_order_id) {
      await syncWorkOrderHeaderStatusService({
        workOrderId: targetRow.work_order_id,
        user,
        reason: 'Edición directa de estado en planilla',
      })
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
    user: user?.email || 'Supervisor',
  })

  return { type: 'updated', cleanVal }
}

export async function saveWorkOrderService({
  workForm,
  editingWorkItem,
  selectedBatchTemplates = [],
  workers = [],
  user,
  getNextOtNumberForShip,
}) {
  const todayIso = new Date().toISOString().split('T')[0]
  const isBatchMode =
    !editingWorkItem &&
    workForm.ot_mode === 'new' &&
    workForm.ot_creation_type === 'tabulada' &&
    selectedBatchTemplates.length > 1

  const validFor3ros = workForm.contractors.length === 1 && Boolean(workForm.send_to_third_party_prc)

  if (isBatchMode) {
    const seenBatchTitles = new Set()
    for (const batchItem of selectedBatchTemplates) {
      const tKey = normalizeOtTitleKey(batchItem.ot_title)
      if (seenBatchTitles.has(tKey)) throw new Error('Esta orden ya existe')
      seenBatchTitles.add(tKey)
      await assertNoDuplicateOtTitleInDb({ shipId: workForm.ship_id, title: tKey })
    }
    const createdOtNumbers = []
    for (let idx = 0; idx < selectedBatchTemplates.length; idx++) {
      const batchItem = selectedBatchTemplates[idx]
      const consecutiveOtNum = getNextOtNumberForShip(workForm.ship_id, idx)
      createdOtNumbers.push(consecutiveOtNum)

      const itemStatus = batchItem.status || 'En ejecución'
      const itemDesc = (batchItem.description ?? '').trim()
      const itemTitle = (batchItem.ot_title || '').trim().toUpperCase()
      const normalizedBudget = normalizeSpecificBudgetId(workForm.assignment_type, workForm.specific_budget_id)

      const { data: newWo, error: woErr } = await workOrdersRepository.insertOne({
        ship_id: workForm.ship_id, ot_number: consecutiveOtNum, title: itemTitle, description: itemDesc || null,
        status: itemStatus === 'En ejecución' ? 'En Progreso' : itemStatus === 'Desestimado' ? 'Cancelada' : 'Pendiente',
        work_type: workForm.work_type, assignment_type: workForm.assignment_type, budget_code: normalizedBudget,
        foreman_name: workForm.foreman_name, contractor_name: workForm.contractors.join(', ') || null,
        is_tabulated: true, ot_template_id: batchItem.template_id || null, start_date: todayIso,
      })
      if (woErr) throw new Error(woErr)
      const createdWoId = newWo.id

      const itemPayloads = buildWorkItemPayloadsFromTemplateSelection({
        templateSelection: batchItem,
        workOrderId: createdWoId,
        workForm,
        normalizedBudget,
        mergedComments: workForm.comments.trim() || null,
        validFor3ros,
      })
      const { data: insItemsData, error: itemErr } = await workItemsRepository.insertMany(itemPayloads)
      if (itemErr) throw new Error(itemErr)

      for (const createdWorkItem of insItemsData || []) {
        await syncBudgetPendingAlertForWorkItem({ workItem: createdWorkItem, wo: newWo, shipId: workForm.ship_id, user })
        if (validFor3ros) {
          await thirdPartyServicesRepository.upsertOne(
            {
              work_item_id: createdWorkItem.id,
              work_order_id: createdWoId,
              ship_id: workForm.ship_id,
              contractor_name: workForm.contractors[0],
              status: 'PRC',
              voucher_type: 'PRC',
              amount_ars: 0,
              service_date: todayIso,
              direct_observations: createdWorkItem.description || 'Sin descripción cargada en la OT',
              specific_observations: workForm.specific_observations.trim() || null,
              updated_at: new Date().toISOString(),
            },
            { onConflict: 'work_item_id' }
          )
        }
      }

      await auditService.logRowAction({
        action: 'CREATE',
        entityType: 'work_orders',
        entityId: createdWoId,
        entityName: `${consecutiveOtNum} · ${itemTitle}`,
        details: { batch: true, index: idx + 1, itemStatus },
        sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
        user: user?.email || 'Supervisor',
      })
    }

    return { type: 'batch', count: createdOtNumbers.length, createdOtNumbers }
  }

  let targetWoId = workForm.existing_wo_id
  const targetShipId = workForm.ship_id
  const normalizedBudget = normalizeSpecificBudgetId(workForm.assignment_type, workForm.specific_budget_id)
  const normalizedOtTitle = (workForm.ot_title || '').trim().toUpperCase()
  let targetWoRecord = null

  if (workForm.ot_mode === 'new') {
    await assertNoDuplicateOtTitleInDb({ shipId: workForm.ship_id, title: normalizedOtTitle })
    const autoConsecutiveOt = getNextOtNumberForShip(workForm.ship_id, 0)
    const { data: newWo, error: woErr } = await workOrdersRepository.insertOne({
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
      ot_template_id: workForm.ot_creation_type === 'tabulada' ? (workForm.selected_template_id || null) : null,
      start_date: todayIso,
    })
    if (woErr) throw new Error(woErr)
    targetWoId = newWo.id
    targetWoRecord = newWo
  } else if (editingWorkItem && normalizedOtTitle) {
    await assertNoDuplicateOtTitleInDb({ shipId: targetShipId, title: normalizedOtTitle, excludeWoId: targetWoId })
    await workOrdersRepository.updateById(
      targetWoId,
      { title: normalizedOtTitle, foreman_name: workForm.foreman_name },
      { select: null }
    )
    targetWoRecord = { id: targetWoId, ship_id: targetShipId, ot_number: editingWorkItem.wo?.ot_number || workForm.ot_number, title: normalizedOtTitle }
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
    updated_at: new Date().toISOString(),
  }

  let savedItems = []
  if (editingWorkItem && !editingWorkItem.isPlaceholder) {
    const { data: updData, error: itemErr } = await workItemsRepository.updateById(editingWorkItem.id, itemPayload, { select: '*' })
    if (itemErr) throw new Error(itemErr)
    savedItems = [updData || { ...editingWorkItem, ...itemPayload }]
  } else {
    const singleTemplate = workForm.ot_mode === 'new' && workForm.ot_creation_type === 'tabulada' ? selectedBatchTemplates[0] : null
    const insertPayloads = singleTemplate?.subworks?.length > 0
      ? buildWorkItemPayloadsFromTemplateSelection({
          templateSelection: singleTemplate, workOrderId: targetWoId, workForm, normalizedBudget, mergedComments, validFor3ros,
        })
      : [itemPayload]
    const { data: insData, error: itemErr } = await workItemsRepository.insertMany(insertPayloads)
    if (itemErr) throw new Error(itemErr)
    savedItems = insData || []
  }
  const savedWorkItem = savedItems[0] || null

  if (savedItems.length > 0 && !targetWoRecord && targetWoId) {
    const { data: woLookup } = await workOrdersRepository.findById(targetWoId, { select: 'id, ot_number, title, ship_id' })
    targetWoRecord = woLookup || { id: targetWoId, ot_number: workForm.ot_number, title: normalizedOtTitle, ship_id: targetShipId }
  }
  for (const wi of savedItems) {
    await syncBudgetPendingAlertForWorkItem({ workItem: wi, wo: targetWoRecord, shipId: targetShipId || targetWoRecord?.ship_id, user })
    if (validFor3ros) {
      const singleContractor = workForm.contractors[0]
      const workerObj = workers.find((w) => w.name.toUpperCase().trim() === singleContractor?.toUpperCase().trim())
      const resolvedTrade = workerObj?.trade && workerObj.trade.toUpperCase().trim() !== 'MANUAL' ? workerObj.trade : null
      await thirdPartyServicesRepository.upsertOne(
        {
          work_item_id: wi.id,
          work_order_id: targetWoId,
          ship_id: targetShipId,
          contractor_name: singleContractor,
          trade: resolvedTrade,
          status: 'PRC',
          voucher_type: 'PRC',
          amount_ars: 0,
          service_date: todayIso,
          entry_date: todayIso,
          direct_observations: wi.description || workForm.description.trim() || 'Sin descripción cargada en la OT',
          specific_observations: workForm.specific_observations.trim() || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'work_item_id' }
      )
    } else if (editingWorkItem) {
      await thirdPartyServicesRepository.deleteByWorkItemId(editingWorkItem.id)
    }
  }

  await auditService.logRowAction({
    action: editingWorkItem ? 'UPDATE' : 'CREATE',
    entityType: 'work_orders',
    entityId: targetWoId,
    entityName: `OT · ${workForm.ot_title || targetWoId}`,
    details: { workItemId: savedWorkItem?.id, status: workForm.status, contractors: workForm.contractors },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor',
  })

  if (targetWoId) {
    await syncWorkOrderHeaderStatusService({
      workOrderId: targetWoId,
      user,
      reason: editingWorkItem ? 'Edición desde ficha de trabajo (Lápiz)' : 'Alta de trabajo en OT',
    })
  }

  return { type: 'single', savedWorkItem, validFor3ros }
}

export async function createForemanInlineService(newForemanForm, workers = [], user) {
  const cleanName = newForemanForm.name.trim().toUpperCase()
  if (!cleanName) throw new Error('Ingresá el nombre y apellido del nuevo Jefe de Obra.')

  const existingWorker = workers.find((w) => (w.name || '').trim().toUpperCase() === cleanName)
  let savedWorker = null

  if (existingWorker) {
    const { data, error } = await workersRepository.updateById(
      existingWorker.id,
      { is_foreman: true, trade: 'TECNICOS', status: 'ACTIVO' },
      { select: '*' }
    )
    if (error) throw new Error(error)
    savedWorker = data || { ...existingWorker, is_foreman: true, trade: 'TECNICOS', status: 'ACTIVO' }
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
      is_foreman: true,
    }
    const { data, error } = await workersRepository.insertOne(workerPayload)
    if (error) throw new Error(error)
    savedWorker = data || workerPayload
  }

  const roleSlug = `JEFE_OBRA_${cleanName.replace(/[^A-Z0-9]+/g, '_')}`
  await organizationRolesRepository.upsertRole({
    role_key: roleSlug,
    role_title: 'Jefe de Obra Naval (TECNICOS)',
    holder_name: cleanName,
    department: 'Operaciones',
    security_level: 'SUPERVISOR',
    allowed_sections: ['barcos', 'ots', 'horas', 'panol'],
    status: 'ACTIVO',
    notes: 'Jefe de Obra (Rubro Técnico) dado de alta desde el módulo de Órdenes de Trabajo',
    updated_at: new Date().toISOString(),
  })

  await auditService.logRowAction({
    action: 'CREATE',
    entityType: 'workers',
    entityId: savedWorker.id || roleSlug,
    entityName: `Jefe de Obra · ${cleanName}`,
    details: { trade: 'TECNICOS', roleSlug },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor',
  })

  return savedWorker
}

export async function separateWorkItemService(args) {
  return separateWorkItemCompleteService(args)
}

export async function saveThirdPartyCascadeService(tpCascadeForm, selectedWorkItem, workers = [], user) {
  const workerObj = workers.find((w) => w.name.toUpperCase().trim() === tpCascadeForm.contractor_name?.toUpperCase().trim())
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
    updated_at: new Date().toISOString(),
  }

  const { error } = await thirdPartyServicesRepository.upsertOne(payload, { onConflict: 'work_item_id' })
  if (error) throw new Error(error)

  await auditService.logRowAction({
    action: 'CREATE',
    entityType: 'third_party_services',
    entityId: selectedWorkItem.id,
    entityName: `Terceros PRC · ${tpCascadeForm.contractor_name}`,
    details: { workOrderId: selectedWorkItem.work_order_id, amount: payload.amount_ars },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor',
  })
}

export async function deleteWorkItemService(row, user) {
  const baseComment = cleanWorkItemComment(row.comments)
  const nextComment = [baseComment, '[ELIMINADA] Desestimada por eliminación'].filter(Boolean).join(' | ')

  const { error } = await workItemsRepository.updateById(
    row.id,
    { status: 'Desestimado', comments: nextComment, updated_at: new Date().toISOString() },
    { select: null }
  )
  if (error) throw new Error(error)

  await syncBudgetPendingAlertForWorkItem({
    workItem: { ...row, status: 'Desestimado' },
    wo: row.wo,
    shipId: row.wo?.ship_id,
    user,
  })

  await auditService.logRowAction({
    action: 'DELETE',
    entityType: 'work_items',
    entityId: row.id,
    entityName: `Trabajo Desestimado · ${row.description || row.id}`,
    details: { otNumber: row.wo?.ot_number },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor',
  })

  const woId = row.work_order_id || row.wo?.id
  if (woId) {
    await syncWorkOrderHeaderStatusService({
      workOrderId: woId,
      user,
      reason: 'Desestimación de trabajo en OT',
    })
  }
}

export async function deleteWoService(wo, items = [], foremenList = [], user) {
  const timestamp = new Date().toLocaleString('es-AR')
  const elimNote = `[ELIMINADA] Desestimada por eliminación (${timestamp})`
  const updatedNotes = (wo.notes || '').includes('[ELIMINADA]')
    ? wo.notes
    : [wo.notes, elimNote].filter(Boolean).join('\n\n')

  const { error: woError } = await workOrdersRepository.updateById(
    wo.id,
    { status: 'Cancelada', is_in_billing: false, notes: updatedNotes },
    { select: null }
  )
  if (woError) throw new Error(woError)

  if (items.length > 0) {
    for (const item of items) {
      const baseComment = cleanWorkItemComment(item.comments)
      const nextComment = [baseComment, '[ELIMINADA] Desestimada por eliminación'].filter(Boolean).join(' | ')
      await workItemsRepository.updateById(
        item.id,
        { status: 'Desestimado', comments: nextComment, updated_at: new Date().toISOString() },
        { select: null }
      )
      await syncBudgetPendingAlertForWorkItem({
        workItem: { ...item, status: 'Desestimado' },
        wo,
        shipId: wo.ship_id,
        user,
      })
    }
  } else {
    await workItemsRepository.insertOne({
      work_order_id: wo.id,
      description: wo.description || wo.title,
      status: 'Desestimado',
      foreman_name: wo.foreman_name || foremenList[0] || 'ALE CAMADELLI',
      work_type: wo.work_type || 'HORA',
      assignment_type: wo.assignment_type || 'Presupuesto General',
      contractors: wo.contractor_name ? [wo.contractor_name] : [],
      contractor_name: wo.contractor_name || null,
      comments: '[ELIMINADA] Desestimada por eliminación',
      updated_at: new Date().toISOString(),
    })
  }

  await auditService.logRowAction({
    action: 'DELETE',
    entityType: 'work_orders',
    entityId: wo.id,
    entityName: `OT Desestimada · ${wo.ot_number} ${wo.title}`,
    details: { totalItems: items.length },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor',
  })
}

export async function closeOtWithValidationService(wo, allowPostBillingCosts = false, user) {
  await workItemsRepository.updateNonDesestimadoByWoIds(
    [wo.id],
    { status: 'Facturado', updated_at: new Date().toISOString() },
    { select: null }
  )

  const { error } = await workOrdersRepository.updateById(
    wo.id,
    { status: 'Facturada', allow_post_billing_costs: allowPostBillingCosts, closed_at: new Date().toISOString() },
    { select: null }
  )
  if (error) throw new Error(error)

  await auditService.logRowAction({
    action: 'UPDATE',
    entityType: 'work_orders',
    entityId: wo.id,
    entityName: `OT Facturada · ${wo.ot_number}`,
    details: { allowPostBillingCosts },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor',
  })
}

export async function closeEntireWorkOrderTreeService({
  wo,
  targetStatus = 'Finalizado',
  allowPostBillingCosts = false,
  user,
}) {
  if (!wo?.id) throw new Error('Se requiere una Orden de Trabajo válida.')

  const nowIso = new Date().toISOString()
  const targetWoIds = [wo.id]
  if (wo.ship_id && wo.ot_number) {
    const { data: siblings } = await workOrdersRepository.findByShipAndOtNumber(wo.ship_id, wo.ot_number, { select: 'id' })
    if (siblings && siblings.length > 0) {
      siblings.forEach((s) => {
        if (!targetWoIds.includes(s.id)) targetWoIds.push(s.id)
      })
    }
  }

  const { data: updatedItems, error: itemsError } = await workItemsRepository.updateNonDesestimadoByWoIds(
    targetWoIds,
    { status: targetStatus, updated_at: nowIso },
    { select: 'id, description' }
  )
  if (itemsError) throw new Error(itemsError)

  const isBilled = targetStatus === 'Facturado'
  const { error: woError } = await workOrdersRepository.updateByIds(
    targetWoIds,
    {
      status: isBilled ? 'Facturada' : 'Completada',
      allow_post_billing_costs: isBilled ? Boolean(allowPostBillingCosts) : false,
      closed_at: nowIso,
    },
    { select: null }
  )
  if (woError) throw new Error(woError)

  await auditService.logRowAction({
    action: isBilled ? 'CLOSE_TREE_FACTURADO' : 'CLOSE_TREE_FINALIZADO',
    entityType: 'work_orders',
    entityId: wo.id,
    entityName: `Cierre de Árbol · ${wo.ot_number || 'OT'} - ${wo.title}`,
    details: {
      targetStatus,
      allowPostBillingCosts: isBilled ? Boolean(allowPostBillingCosts) : false,
      totalItemsUpdated: updatedItems?.length || 0,
      tasks: (updatedItems || []).map((t) => t.description),
    },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor',
  })

  return { success: true, targetStatus, updatedCount: updatedItems?.length || 0 }
}

const ALLOWED_REOPEN_ITEM_STATUSES = new Set(['En ejecución', 'Finalizado', 'Pendiente de inicio'])

export async function reopenWorkOrderService({ wo, targetStatus = 'En ejecución', reason = '', user }) {
  if (!wo?.id) throw new Error('Se requiere una Orden de Trabajo válida.')
  const safeTargetStatus = typeof targetStatus === 'string' ? targetStatus.trim() : ''
  if (!ALLOWED_REOPEN_ITEM_STATUSES.has(safeTargetStatus)) {
    throw new Error(`Estado destino inválido para reapertura: ${safeTargetStatus}`)
  }

  const nowIso = new Date().toISOString()
  const targetWoIds = [wo.id]
  if (wo.ship_id && wo.ot_number) {
    const { data: siblings } = await workOrdersRepository.findByShipAndOtNumber(wo.ship_id, wo.ot_number, { select: 'id' })
    if (siblings && siblings.length > 0) {
      siblings.forEach((s) => {
        if (!targetWoIds.includes(s.id)) targetWoIds.push(s.id)
      })
    }
  }

  const revertFromStatuses = safeTargetStatus === 'Finalizado'
    ? ['Facturado']
    : ['Facturado', 'Finalizado']

  const { data: itemsToRevert, error: fetchErr } = await workItemsRepository.findAll({
    select: 'id, status, description',
    inFilters: { work_order_id: targetWoIds, status: revertFromStatuses },
  })
  if (fetchErr) throw new Error(fetchErr)

  const itemIds = (itemsToRevert || []).map((it) => it.id)
  if (itemIds.length > 0) {
    const { error: itemsError } = await workItemsRepository.updateByIds(
      itemIds,
      { status: safeTargetStatus, updated_at: nowIso },
      { select: null }
    )
    if (itemsError) throw new Error(itemsError)
  }

  const nextWoStatus = safeTargetStatus === 'Pendiente de inicio' ? 'Pendiente' : 'En Progreso'
  const { error: woError } = await workOrdersRepository.updateByIds(
    targetWoIds,
    { status: nextWoStatus, allow_post_billing_costs: false, closed_at: null },
    { select: null }
  )

  if (woError) {
    for (const prevItem of (itemsToRevert || [])) {
      await workItemsRepository.updateById(prevItem.id, { status: prevItem.status, updated_at: nowIso }, { select: null })
    }
    throw new Error(woError)
  }

  const cleanReason = typeof reason === 'string' && reason.trim()
    ? reason.trim()
    : 'Reapertura manual por corrección de estado'

  await auditService.logRowAction({
    action: 'REOPEN_FACTURADA',
    entityType: 'work_orders',
    entityId: wo.id,
    entityName: `Reapertura de OT · ${wo.ot_number || 'OT'} - ${wo.title}`,
    details: {
      previousWoStatus: wo.status || null,
      previousClosedAt: wo.closed_at || null,
      nextWoStatus,
      targetItemStatus: safeTargetStatus,
      reason: cleanReason,
      totalItemsUpdated: itemIds.length,
      tasks: (itemsToRevert || []).map((t) => t.description),
    },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor',
  })

  return { success: true, targetStatus: safeTargetStatus, nextWoStatus, updatedCount: itemIds.length }
}

export async function saveThirdPartyEditService(editingThirdParty, user) {
  const { error } = await thirdPartyServicesRepository.updateById(
    editingThirdParty.id,
    {
      specific_observations: editingThirdParty.specific_observations?.trim() || null,
      amount_ars: parseFloat(editingThirdParty.amount_ars) || 0,
      status: editingThirdParty.status || 'PRC',
      service_date: editingThirdParty.service_date || new Date().toISOString().split('T')[0],
      voucher_number: editingThirdParty.voucher_number?.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { select: null }
  )
  if (error) throw new Error(error)

  await auditService.logRowAction({
    action: 'UPDATE',
    entityType: 'third_party_services',
    entityId: editingThirdParty.id,
    entityName: `Terceros Edit · ${editingThirdParty.voucher_number || editingThirdParty.id}`,
    details: { amount: editingThirdParty.amount_ars, status: editingThirdParty.status },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor',
  })
}

export async function submitAmpliarService(selectedWoDetail, ampliarText, user) {
  const timestamp = new Date().toLocaleString('es-AR')
  const author = user?.email?.split('@')[0] || 'Supervisor'
  const appendedNote = `[${timestamp} - Consulta de ${author} a Jefe de Obra (${selectedWoDetail.foreman_name})]: ${ampliarText.trim()}`
  const newNotes = selectedWoDetail.notes ? `${selectedWoDetail.notes}\n\n${appendedNote}` : appendedNote

  const { error } = await workOrdersRepository.updateById(selectedWoDetail.id, { notes: newNotes }, { select: null })
  if (error) throw new Error(error)

  await auditService.logRowAction({
    action: 'UPDATE',
    entityType: 'work_orders',
    entityId: selectedWoDetail.id,
    entityName: `Consulta Ampliar · ${selectedWoDetail.ot_number}`,
    details: { note: appendedNote },
    sheetName: 'Órdenes de Trabajo y Catálogo (OT.ABC)',
    user: user?.email || 'Supervisor',
  })

  return newNotes
}
