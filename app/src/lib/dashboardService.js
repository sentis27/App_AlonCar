import { supabase } from './supabase.js'

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
  'third_party_services'
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
  'macro_variables'
]

/**
 * Conteos principales del Dashboard operativo.
 * Usa `labor_logs` (tabla canónica real de imputaciones de horas en Supabase).
 */
export async function fetchDashboardStatsService() {
  const [shipsRes, otsRes, materialsRes, hoursRes] = await Promise.all([
    supabase.from('ships').select('id', { count: 'exact', head: true }),
    supabase.from('work_orders').select('id', { count: 'exact', head: true }),
    supabase.from('materials').select('id', { count: 'exact', head: true }),
    supabase.from('labor_logs').select('id', { count: 'exact', head: true })
  ])

  const firstErr = [shipsRes.error, otsRes.error, materialsRes.error, hoursRes.error].find(Boolean)
  if (firstErr) throw firstErr

  return {
    shipsCount: shipsRes.count || 0,
    otsCount: otsRes.count || 0,
    materialsCount: materialsRes.count || 0,
    hoursCount: hoursRes.count || 0
  }
}

export async function fetchMacroVariablesService() {
  const { data, error } = await supabase
    .from('macro_variables')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) throw error
  return data || []
}

export async function fetchAdminDashboardCountsService() {
  const [rolesRes, complianceRes] = await Promise.all([
    supabase.from('organization_roles').select('role_key', { count: 'exact', head: true }),
    supabase.from('compliance_alerts').select('id, entity_type').eq('status', 'PENDIENTE')
  ])

  return {
    rolesCount: rolesRes.count ?? null,
    pendingAlerts: complianceRes.data || []
  }
}
