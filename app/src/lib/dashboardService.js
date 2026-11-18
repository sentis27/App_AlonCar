import { shipsRepository } from '../repositories/shipsRepository.js'
import { workOrdersRepository } from '../repositories/workOrdersRepository.js'
import { materialsRepository } from '../repositories/materialsRepository.js'
import { laborLogsRepository } from '../repositories/laborLogsRepository.js'
import { macroVariablesRepository } from '../repositories/macroVariablesRepository.js'
import { organizationRolesRepository } from '../repositories/organizationRolesRepository.js'
import { complianceAlertsRepository } from '../repositories/complianceAlertsRepository.js'

export const DASHBOARD_REALTIME_TABLES = [
  'ships',
  'work_orders',
  'work_items',
  'materials',
  'labor_logs',
  'macro_variables',
  'compliance_alerts',
  'workers',
  'inventory_transactions',
  'purchase_orders',
  'third_party_services',
]

export const ADMIN_DASHBOARD_REALTIME_TABLES = [
  'organization_roles',
  'compliance_alerts',
  'materials',
  'inventory_transactions',
  'purchase_orders',
  'third_party_services',
  'work_orders',
  'workers',
  'macro_variables',
]

/**
 * Conteos principales del Dashboard operativo.
 * Usa `labor_logs` (tabla canónica real de imputaciones de horas en Supabase).
 */
export async function fetchDashboardStatsService() {
  const [shipsRes, otsRes, materialsRes, hoursRes] = await Promise.all([
    shipsRepository.countShips(),
    workOrdersRepository.countWorkOrders(),
    materialsRepository.countMaterials(),
    laborLogsRepository.countLaborLogs(),
  ])

  const firstErr = [shipsRes.error, otsRes.error, materialsRes.error, hoursRes.error].find(Boolean)
  if (firstErr) throw new Error(firstErr)

  return {
    shipsCount: shipsRes.count || 0,
    otsCount: otsRes.count || 0,
    materialsCount: materialsRes.count || 0,
    hoursCount: hoursRes.count || 0,
  }
}

export async function fetchMacroVariablesService() {
  const { data, error } = await macroVariablesRepository.listMacroVariables()
  if (error) throw new Error(error)
  return data || []
}

export async function fetchAdminDashboardCountsService() {
  const [rolesRes, complianceRes] = await Promise.all([
    organizationRolesRepository.countRoles(),
    complianceAlertsRepository.listPending({ select: 'id, entity_type' }),
  ])

  return {
    rolesCount: rolesRes.count ?? null,
    pendingAlerts: complianceRes.data || [],
  }
}
