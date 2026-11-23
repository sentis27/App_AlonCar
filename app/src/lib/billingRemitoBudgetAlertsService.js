/**
 * billingRemitoBudgetAlertsService.js
 * Alerta automática en Dashboard para María José cuando un barco se abre en el
 * Remito Comercial sin Nº de Presupuesto asignado.
 */
import { shipsRepository } from '../repositories/shipsRepository.js'
import { dataRequirementsRepository, complianceAlertsRepository } from '../repositories/complianceAlertsRepository.js'
import { logCellChange } from './auditService.js'

const REMITO_BUDGET_REQ_DEF = {
  code: 'REQ_REMITO_PRESUPUESTO_MARIA_JOSE',
  module: 'remito',
  field_key: 'billing_budget_number',
  name: 'Nº de Presupuesto para Remito de Facturación (Barco)',
  description: 'Asignar el número de presupuesto al barco abierto en el Remito de Facturación del Resumen Gerencial.',
  trigger_event: 'BARCO_ABIERTO_EN_REMITO_SIN_PRESUP',
  trigger_condition: { billing_workspace_status: 'EN_PREPARACION', billing_budget_number: null },
  responsible_role: 'maria_jose',
  default_notice_time: '09:30:00',
  default_notice_frequency: 'DIARIO',
  max_attempts: 10,
  escalation_role: 'admin',
  is_active: true,
}

let cachedRemitoBudgetReqId = null

async function getRemitoBudgetRequirementId() {
  if (cachedRemitoBudgetReqId) return cachedRemitoBudgetReqId
  const { data, error } = await dataRequirementsRepository.ensureByCode(
    REMITO_BUDGET_REQ_DEF.code,
    REMITO_BUDGET_REQ_DEF
  )
  if (error) return null
  cachedRemitoBudgetReqId = data?.id || null
  return cachedRemitoBudgetReqId
}

export async function syncShipRemitoBudgetAlertForMariaService({ ship, user = 'Gerencia' }) {
  if (!ship?.id) return
  try {
    const isInWorkspace = ship.billing_workspace_status && ship.billing_workspace_status !== 'NONE'
    const hasBudgetNumber = Boolean(String(ship.billing_budget_number || '').trim())
    const needsAlert = isInWorkspace && !hasBudgetNumber

    const { data: existing } = await complianceAlertsRepository.listPending({
      select: 'id, notes',
      filters: { entity_type: 'ships', entity_id: ship.id, responsible_role: 'maria_jose' },
    })

    if (needsAlert) {
      const reqId = await getRemitoBudgetRequirementId()
      if (!reqId) return
      const msg = `Trabajo por facturar sin Nº de Presupuesto · ${ship.name || 'Buque'}`
      if (!existing || existing.length === 0) {
        await complianceAlertsRepository.insertOne({
          requirement_id: reqId,
          ship_id: ship.id,
          entity_type: 'ships',
          entity_id: ship.id,
          responsible_role: 'maria_jose',
          status: 'PENDIENTE',
          escalated_to_admin: false,
          alert_message: msg,
          notes: 'Responsable: María José • Colocar Nº de Presupuesto del remito del barco',
        })
      } else {
        await complianceAlertsRepository.updateById(existing[0].id, { alert_message: msg }, { select: null })
      }
    } else if (existing && existing.length > 0) {
      const note = hasBudgetNumber
        ? `Nº Presupuesto asignado: ${String(ship.billing_budget_number).trim()}`
        : 'Barco retirado de la mesa de facturación'
      await complianceAlertsRepository.closeByIds(
        existing.map((a) => a.id),
        {
          status: 'COMPLETADO',
          completed_at: new Date().toISOString(),
          completed_by: String(user || 'María José / Sistema'),
          notes: note,
        }
      )
    }
  } catch (err) {
    console.warn('[billingRemitoBudgetAlerts] Aviso sincronizando alerta María José:', err?.message)
  }
}

export async function fetchPendingShipRemitoBudgetAlertsForMariaService() {
  const { data: ships, error } = await shipsRepository.listShips({
    select: 'id, name, client_name, billing_workspace_status, billing_budget_number, billing_opened_at, created_at',
    orderBy: [{ column: 'billing_opened_at', ascending: false }],
  })
  if (error) throw new Error(error)

  return (ships || [])
    .filter((s) => (
      s.billing_workspace_status &&
      s.billing_workspace_status !== 'NONE' &&
      String(s.name || '').trim().toUpperCase() !== 'ASTILLERO' &&
      !String(s.billing_budget_number || '').trim()
    ))
    .map((s) => ({
      id: `ship_remito_${s.id}`,
      kind: 'SHIP_REMITO',
      ship_id: s.id,
      entity_type: 'ships',
      entity_id: s.id,
      ships: { id: s.id, name: s.name },
      created_at: s.billing_opened_at || s.created_at,
      workspace_status: s.billing_workspace_status,
      alert_message: `Trabajo por facturar sin Nº de Presupuesto · ${s.name}`,
      notes: 'Responsable: María José • Completar Nº de Presupuesto (ej. 733/26)',
    }))
}

export async function resolveShipRemitoBudgetAlertService({ shipId, shipName, budgetNumber, user, userName }) {
  const clean = String(budgetNumber || '').trim()
  if (!clean) throw new Error('Ingresá un número de presupuesto válido (ej. 733/26).')
  if (!shipId) throw new Error('Barco requerido para asignar Nº de Presupuesto.')

  const resolver = userName || user?.email || 'María José'
  const { data: updatedShip, error } = await shipsRepository.updateById(
    shipId,
    { billing_budget_number: clean },
    { select: '*' }
  )
  if (error) throw new Error(error)

  await syncShipRemitoBudgetAlertForMariaService({
    ship: updatedShip || { id: shipId, name: shipName, billing_workspace_status: 'EN_PREPARACION', billing_budget_number: clean },
    user: resolver,
  })

  await logCellChange({
    entityType: 'ships',
    entityId: shipId,
    entityName: `Remito · ${shipName || updatedShip?.name || shipId}`,
    field: 'billing_budget_number',
    fieldLabel: 'Nº Presupuesto Remito',
    oldValue: 'PENDIENTE',
    newValue: clean,
    sheetName: 'Alertas María José · Remito Comercial',
    moduleRoute: '/resumen-gerencial?tab=remito',
    user: resolver,
  })

  return { shipId, budgetNumber: clean, formatted: `Presupuesto Nº ${clean}` }
}
