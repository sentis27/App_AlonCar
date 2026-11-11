import { useState, useEffect } from 'react'
import {
  ShieldCheck,
  Lock,
  Building2,
  DollarSign,
  ShieldAlert,
  Brain,
  ShoppingCart,
  Wrench,
  History
} from 'lucide-react'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/AuthContext.jsx'

// Subpaneles modulares extraídos (Arquitectura limpia < 250L)
import AdminLiveKpiRadar from '../components/admin/AdminLiveKpiRadar.jsx'
import AdminRolesMatrixPanel from '../components/admin/AdminRolesMatrixPanel.jsx'
import AdminMacroPanel from '../components/admin/AdminMacroPanel.jsx'
import AdminAlertsCompliancePanel from '../components/admin/AdminAlertsCompliancePanel.jsx'
import AiGovernancePanel from '../components/AiGovernancePanel.jsx'
import ComprasSettingsPanel from '../components/ComprasSettingsPanel.jsx'
import TradesManagementPanel from '../components/TradesManagementPanel.jsx'
import AdminAuditLedger from '../components/AdminAuditLedger.jsx'

export default function AdminDashboard() {
  const { profile, user } = useAuth()
  const [activeTab, setActiveTab] = useState('matriz')
  const [rolesCount, setRolesCount] = useState(0)

  // Radar Operativo y Contadores de Alertas en Vivo
  const [alertSummary, setAlertSummary] = useState({
    redContractorsCount: 2,
    panolWithoutHoursCount: 0,
    auditedHoursCount: 4,
    pendingRubroCount: 0
  })
  const [complianceAlertsCount, setComplianceAlertsCount] = useState(0)

  useEffect(() => {
    loadInitialCounts()
  }, [])

  async function loadInitialCounts() {
    try {
      const [rolesRes, complianceRes] = await Promise.all([
        supabase.from('organization_roles').select('role_key', { count: 'exact', head: true }),
        supabase.from('compliance_alerts').select('id, entity_type').eq('status', 'PENDIENTE')
      ])

      if (rolesRes.count !== null && rolesRes.count !== undefined) {
        setRolesCount(rolesRes.count)
      }

      const pendingAlerts = complianceRes.data || []
      setComplianceAlertsCount(pendingAlerts.length)
      setAlertSummary((prev) => ({
        ...prev,
        panolWithoutHoursCount: pendingAlerts.filter((a) => a.entity_type === 'inventory_transactions').length
      }))
    } catch (err) {
      console.error('Error cargando métricas iniciales del dashboard admin:', err)
    }
  }

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

      {/* ============================================================================== */}
      {/* NAVEGACIÓN PRINCIPAL DE PESTAÑAS (ESTANDARIZADA)                              */}
      {/* ============================================================================== */}
      <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl/80 border border-slate-800">
        <button
          type="button"
          onClick={() => setActiveTab('matriz')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'matriz'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Building2 className="w-4 h-4 text-purple-400" />
          <span>Matriz de Puestos & Permisos</span>
          <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-slate-900 border border-slate-700 text-slate-300 font-mono">
            {rolesCount}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('macro')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'macro'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4 text-emerald-400" />
          <span>Variables Macro & Cierre Quincenal</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('alertas')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'alertas'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ShieldAlert className="w-4 h-4 text-amber-400" />
          <span>Alertas & Cumplimiento</span>
          {complianceAlertsCount > 0 && (
            <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-500 text-slate-950 font-bold font-mono">
              {complianceAlertsCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('ia')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'ia'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Brain className="w-4 h-4 text-cyan-400" />
          <span>🧠 Gobernanza IA & Prompts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('compras')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'compras'
              ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <ShoppingCart className="w-4 h-4 text-blue-400" />
          <span>Config. Compras & WhatsApp</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('rubros')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'rubros'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <Wrench className="w-4 h-4 text-amber-400" />
          <span>Gestión de Rubros & Oficios</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('auditoria')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'auditoria'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-slate-400 hover:text-white hover:bg-slate-900'
          }`}
        >
          <History className="w-4 h-4 text-cyan-400" />
          <span>📜 Libro de Auditoría & Trazabilidad</span>
        </button>
      </div>

      {/* RENDERIZADO MODULAR DE PESTAÑAS */}
      {activeTab === 'matriz' && <AdminRolesMatrixPanel onRoleCountChange={setRolesCount} />}
      {activeTab === 'macro' && <AdminMacroPanel />}
      {activeTab === 'alertas' && <AdminAlertsCompliancePanel onSummaryChange={handleAlertsSummaryChange} />}
      {activeTab === 'ia' && <AiGovernancePanel />}
      {activeTab === 'compras' && <ComprasSettingsPanel />}
      {activeTab === 'rubros' && <TradesManagementPanel />}
      {activeTab === 'auditoria' && <AdminAuditLedger />}
    </div>
  )
}
