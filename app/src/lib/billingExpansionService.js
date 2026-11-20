/**
 * billingExpansionService.js
 * Circuito `[📣 Ampliar Información]` 100% sobre `work_orders.billing_description`
 * (nunca modifica `work_orders.description` ni `work_items.description`).
 * Notifica a Jefe de Obra + Administrador y computa solicitudes resueltas para Gerencia.
 */

import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { dataRequirementsRepository, complianceAlertsRepository } from '../repositories/complianceAlertsRepository.js'
import { logCellChange } from './auditService.js'

const EXPANSION_REQ_DEF = {
  code: 'REQ_OT_AMPLIACION_INFO_GERENCIA',
  module: 'ots',
  field_key: 'billing_description',
  name: 'Ampliación de Información Comercial solicitada por Gerencia',
  description: 'Pedido de Gerencia al Jefe de Obra y Administrador para ampliar el detalle comercial (`billing_description`) de una OT.',
  trigger_event: 'GERENCIA_SOLICITA_AMPLIACION_BILLING',
  trigger_condition: { foreman_review_status: 'REQUESTED' },
  responsible_role: 'jefe_de_obra',
  default_notice_time: '09:00:00',
  default_notice_frequency: 'DIARIO',
  max_attempts: 5,
  escalation_role: 'admin',
  is_active: true
}

let cachedExpansionReqId = null

async function getExpansionRequirementId() {
  if (cachedExpansionReqId) return cachedExpansionReqId
  const { data, error } = await dataRequirementsRepository.ensureByCode(EXPANSION_REQ_DEF.code, EXPANSION_REQ_DEF)
  if (error) return null
  cachedExpansionReqId = data?.id || null
  return cachedExpansionReqId
}

export async function requestBillingExpansionService({ wo, ship, note = '', user = 'Gerencia' }) {
  if (!wo?.id) throw new Error('Orden de Trabajo requerida para pedir ampliación.')
  const nowIso = new Date().toISOString()
  const existingBilling = wo.billing_description ?? wo.billingDescription
  const ghostBase = existingBilling && String(existingBilling).length > 0
    ? existingBilling
    : String(wo.description || '').trim() || `<b>${String(wo.title || 'OT').toUpperCase()}</b>`

  const patch = {
    billing_description: ghostBase,
    foreman_review_status: 'REQUESTED',
    foreman_review_note: String(note || '').trim() || 'Gerencia solicita ampliar el detalle comercial para facturación.',
    foreman_review_requested_at: nowIso,
    foreman_review_requested_by: String(user || 'Gerencia')
  }

  const { data, error } = await workOrdersRepository.updateById(wo.id, patch, { select: '*' })
  if (error) throw new Error(error)

  try {
    const reqId = await getExpansionRequirementId()
    const foremanLabel = wo.foreman_name || wo.foremanName || 'Jefe de Obra'
    const shipLabel = ship?.name || wo.ships?.name || 'Buque'
    const otLabel = `${wo.ot_number || wo.otNumber || 'OT'} · ${wo.title || ''}`.trim()
    const msg = `📣 Ampliar Info Comercial (${shipLabel} · ${otLabel}) — Jefe de Obra: ${foremanLabel}`
    const { data: existingAlerts } = await complianceAlertsRepository.listPending({
      select: 'id',
      filters: { entity_type: 'work_orders', entity_id: wo.id }
    })
    if (reqId && (!existingAlerts || existingAlerts.length === 0)) {
      await complianceAlertsRepository.insertOne({
        requirement_id: reqId,
        ship_id: ship?.id || wo.ship_id || null,
        entity_type: 'work_orders',
        entity_id: wo.id,
        responsible_role: 'jefe_de_obra',
        status: 'PENDIENTE',
        escalated_to_admin: true,
        alert_message: msg,
        notes: `Destinatarios: ${foremanLabel} + Administrador · ${patch.foreman_review_note}`
      })
    }
  } catch (alertErr) {
    console.warn('Aviso sincronizando compliance_alerts de ampliación:', alertErr?.message)
  }

  await logCellChange({
    entityType: 'work_orders',
    entityId: wo.id,
    entityName: `${ship?.name || ''} · ${wo.ot_number || wo.otNumber || 'OT'} ${wo.title || ''}`,
    field: 'foreman_review_status',
    fieldLabel: 'Solicitud Ampliación Comercial',
    oldValue: wo.foreman_review_status || wo.foremanReviewStatus || 'NONE',
    newValue: 'REQUESTED',
    sheetName: 'Facturación · Acuse Jefe de Obra + Admin',
    moduleRoute: '/resumen-gerencial?tab=remito',
    user
  })
  return data
}

export async function resolveBillingExpansionService({ wo, billingDescription, user = 'Jefe de Obra' }) {
  if (!wo?.id) throw new Error('Orden de Trabajo requerida.')
  const cleanText = String(billingDescription || '').trim()
  if (!cleanText) throw new Error('Escribí el detalle comercial ampliado antes de enviar a Gerencia.')

  const nowIso = new Date().toISOString()
  const patch = {
    billing_description: cleanText,
    foreman_review_status: 'RESOLVED',
    foreman_review_resolved_at: nowIso,
    foreman_review_resolved_by: String(user || 'Jefe de Obra')
  }

  const { data, error } = await workOrdersRepository.updateById(wo.id, patch, { select: '*' })
  if (error) throw new Error(error)

  try {
    const { data: pendingAlerts } = await complianceAlertsRepository.listPending({
      select: 'id',
      filters: { entity_type: 'work_orders', entity_id: wo.id }
    })
    if (pendingAlerts?.length > 0) {
      await complianceAlertsRepository.closeByIds(
        pendingAlerts.map((a) => a.id),
        {
          status: 'COMPLETADO',
          completed_at: nowIso,
          completed_by: String(user || 'Jefe de Obra'),
          notes: 'Ampliación comercial cargada en billing_description y enviada a Gerencia.'
        }
      )
    }
  } catch (alertErr) {
    console.warn('Aviso cerrando compliance_alerts de ampliación:', alertErr?.message)
  }

  await logCellChange({
    entityType: 'work_orders',
    entityId: wo.id,
    entityName: `${wo.ships?.name || ''} · ${wo.ot_number || 'OT'} ${wo.title || ''}`,
    field: 'billing_description',
    fieldLabel: 'Descripción Comercial Ampliada (billing_description)',
    oldValue: wo.billing_description || '',
    newValue: cleanText,
    sheetName: 'Ampliación Comercial · Jefe de Obra / Admin',
    moduleRoute: '/',
    user
  })
  return data
}

export async function acknowledgeResolvedExpansionService({ wo, user = 'Gerencia' }) {
  if (!wo?.id) return
  const { error } = await workOrdersRepository.updateById(wo.id, { foreman_review_status: 'NONE' }, { select: null })
  if (error) throw new Error(error)
  await logCellChange({
    entityType: 'work_orders',
    entityId: wo.id,
    entityName: `${wo.ships?.name || ''} · ${wo.ot_number || 'OT'} ${wo.title || ''}`,
    field: 'foreman_review_status',
    fieldLabel: 'Confirmación Gerencia',
    oldValue: 'RESOLVED',
    newValue: 'NONE',
    sheetName: 'Dashboard · Solicitudes Resueltas',
    moduleRoute: '/',
    user
  })
}

export async function fetchBillingExpansionAlertsService() {
  const { data, error } = await workOrdersRepository.listWorkOrders({
    select: 'id, ship_id, ot_number, title, description, foreman_name, status, billing_description, foreman_review_status, foreman_review_note, foreman_review_requested_at, foreman_review_requested_by, foreman_review_resolved_at, foreman_review_resolved_by, ships(id, name, client_name)',
    orderBy: [{ column: 'created_at', ascending: false }]
  })
  if (error) throw new Error(error)
  const list = data || []
  return {
    requested: list.filter((w) => w.foreman_review_status === 'REQUESTED'),
    resolved: list.filter((w) => w.foreman_review_status === 'RESOLVED')
  }
}
