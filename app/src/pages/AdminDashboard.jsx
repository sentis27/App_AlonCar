import { useState, useEffect, useCallback } from 'react'
import { ShieldCheck, Lock } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useModuleTab } from '../hooks/useModuleTab.js'
import CanonicalActiveSubmoduleBadge from '../components/canonical/CanonicalActiveSubmoduleBadge.jsx'
import { fetchDashboardZeroCostAlerts } from '../lib/zeroCostAlertsService.js'
import {
  ADMIN_DASHBOARD_REALTIME_TABLES,
  fetchAdminDashboardCountsService
} from '../lib/dashboardService.js'
import { useSupabaseRealtimeRefresh } from '../hooks/useSupabaseRealtimeRefresh.js'

// Subpaneles modulares extraídos (Arquitectura limpia < 250L)
import AdminLiveKpiRadar from '../components/admin/AdminLiveKpiRadar.jsx'
import ZeroCostDashboardAlertCard from '../components/ZeroCostDashboardAlertCard.jsx'
import AdminRolesMatrixPanel from '../components/admin/AdminRolesMatrixPanel.jsx'
import AdminMacroPanel from '../components/admin/AdminMacroPanel.jsx'
import AdminMaterialPricingPolicyCard from '../components/admin/AdminMaterialPricingPolicyCard.jsx'
import AdminAlertsCompliancePanel from '../components/admin/AdminAlertsCompliancePanel.jsx'
import AiGovernancePanel from '../components/AiGovernancePanel.jsx'
import ComprasSettingsPanel from '../components/ComprasSettingsPanel.jsx'
import TradesManagementPanel from '../components/TradesManagementPanel.jsx'
import AdminAuditLedger from '../components/AdminAuditLedger.jsx'

export default function AdminDashboard() {
  const { profile, user } = useAuth()
  const { activeTab, setActiveTab, activeSubmodule } = useModuleTab('admin')
  const [rolesCount, setRolesCount] = useState(0)

  // Radar Operativo y Contadores de Alertas en Vivo
  const [alertSummary, setAlertSummary] = useState({
    redContractorsCount: 2,
    panolWithoutHoursCount: 0,
    auditedHoursCount: 4,
    pendingRubroCount: 0
  })
  const [complianceAlertsCount, setComplianceAlertsCount] = useState(0)
  const [zeroCostAlerts, setZeroCostAlerts] = useState(null)

  const loadInitialCounts = useCallback(async () => {
    try {
      const [{ rolesCount: nextRolesCount, pendingAlerts }, zeroCostData] = await Promise.all([
        fetchAdminDashboardCountsService(),
        fetchDashboardZeroCostAlerts()
      ])

      if (nextRolesCount !== null && nextRolesCount !== undefined) {
        setRolesCount(nextRolesCount)
      }

      setComplianceAlertsCount(pendingAlerts.length)
      setAlertSummary((prev) => ({
        ...prev,
        panolWithoutHoursCount: pendingAlerts.filter((a) => a.entity_type === 'inventory_transactions').length
      }))
      setZeroCostAlerts(zeroCostData)
    } catch (err) {
      console.error('Error cargando métricas iniciales del dashboard admin:', err)
    }
  }, [])

  useSupabaseRealtimeRefresh({
    channelName: 'admin_dashboard_live',
    tables: ADMIN_DASHBOARD_REALTIME_TABLES,
    onSync: loadInitialCounts
  })

  useEffect(() => {
    loadInitialCounts()
  }, [loadInitialCounts])

  function handleAlertsSummaryChange({ summary, alertsCount }) {
    if (summary) setAlertSummary(summary)
    if (typeof alertsCount === 'number') setComplianceAlertsCount(alertsCount)
  }

  return (
    <div className="space-y-4 w-full pb-24">
      {/* ============================================================================== */}
      {/* ZONA 1: CONTEXTO OPERATIVO (.alon-zone-context - Acento Azul Cielo)             */}
      {/* ============================================================================== */}
      <div className="alon-zone-context flex flex-col md:flex-row md:items-center justify-between gap-4 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20 text-slate-950 shrink-0">
            <ShieldCheck className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-black text-white tracking-wide">
                PANEL DE CONTROL ADMINISTRADOR
              </h1>
              <span className="text-[10px] font-mono tracking-widest text-purple-300 bg-purple-950/60 border border-purple-800/60 px-2 py-0.5 rounded-md uppercase font-bold">
                M9 · Gobernanza & Control Central
              </span>
              <CanonicalActiveSubmoduleBadge
                label={activeSubmodule?.label || 'Matriz de Puestos & Permisos'}
                suffix={
                  activeTab === 'matriz' && rolesCount > 0
                    ? `(${rolesCount})`
                    : activeTab === 'alertas' && complianceAlertsCount > 0
                    ? `(${complianceAlertsCount})`
                    : null
                }
                theme={activeSubmodule?.theme || 'purple'}
              />
            </div>
            <p className="text-xs text-slate-400">
              Administración de variables macroeconómicas, cotización oficial, matriz de puestos y radar de auditoría operativa.
            </p>
          </div>
        </div>

        {/* Sesión Activa del Administrador */}
        <div className="flex items-center gap-3 self-start md:self-auto">
          <div className="flex items-center gap-2 bg-purple-950/20 px-3 py-1.5 rounded-xl border border-purple-500/30 text-xs shadow-inner">
            <Lock className="w-3.5 h-3.5 text-purple-400" />
            <div>
              <span className="text-slate-500 block text-[9px] uppercase font-bold">Sesión Activa:</span>
              <span className="font-extrabold text-white text-xs">{profile?.full_name || user?.email || 'Jorge Sentis (Admin)'}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* ZONA 2: RADAR OPERATIVO DE KPIS Y ALERTAS EN VIVO (.alon-zone-kpis)            */}
      {/* ============================================================================== */}
      <AdminLiveKpiRadar
        alertSummary={alertSummary}
        complianceAlertsCount={complianceAlertsCount}
        onSelectAlerts={() => setActiveTab('alertas')}
      />

      <ZeroCostDashboardAlertCard alerts={zeroCostAlerts} compact />

      {/* RENDERIZADO MODULAR DE SUBMÓDULOS (Navegación vía Menú Lateral Acordeón) */}
      {activeTab === 'matriz' && <AdminRolesMatrixPanel onRoleCountChange={setRolesCount} />}
      {activeTab === 'macro' && (
        <div className="space-y-5">
          <AdminMaterialPricingPolicyCard />
          <AdminMacroPanel />
        </div>
      )}
      {activeTab === 'alertas' && <AdminAlertsCompliancePanel onSummaryChange={handleAlertsSummaryChange} />}
      {activeTab === 'ia' && <AiGovernancePanel />}
      {activeTab === 'compras' && <ComprasSettingsPanel />}
      {activeTab === 'rubros' && <TradesManagementPanel />}
      {activeTab === 'auditoria' && <AdminAuditLedger />}
    </div>
  )
}
