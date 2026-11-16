import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Ship,
  ClipboardList,
  Clock,
  Package,
  CheckCircle2,
  ArrowUpRight,
  Radio
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { saveMacroVariables } from '../lib/macroVariablesService'
import { fetchPendingBudgetAlertsForMariaService } from '../lib/workOrdersService'
import { fetchPendingContractAlertsForMariaService } from '../lib/contractorDeductionsService'
import { fetchDashboardZeroCostAlerts } from '../lib/zeroCostAlertsService'
import {
  DASHBOARD_REALTIME_TABLES,
  fetchDashboardStatsService,
  fetchMacroVariablesService
} from '../lib/dashboardService'
import { useSupabaseRealtimeRefresh } from '../hooks/useSupabaseRealtimeRefresh'
import MariaJoseBudgetAlertsCard from '../components/workOrders/MariaJoseBudgetAlertsCard'
import MariaJoseContractAlertsCard from '../components/personal/MariaJoseContractAlertsCard'
import ZeroCostDashboardAlertCard from '../components/ZeroCostDashboardAlertCard'
import DashboardMacroPanel from '../components/dashboard/DashboardMacroPanel'
import DashboardOperationsGuide from '../components/dashboard/DashboardOperationsGuide'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function Dashboard() {
  const { profile, user } = useAuth()
  const [stats, setStats] = useState({ shipsCount: 0, otsCount: 0, materialsCount: 0, hoursCount: 0 })
  const [loading, setLoading] = useState(true)

  const [macroVariables, setMacroVariables] = useState([])
  const [macroForm, setMacroForm] = useState({
    year: 2026,
    month: 10,
    dollar_rate: 1500,
    monthly_inflation_pct: 3.2
  })
  const [savingMacro, setSavingMacro] = useState(false)
  const [macroMessage, setMacroMessage] = useState(null)
  const [pendingBudgetAlerts, setPendingBudgetAlerts] = useState([])
  const [pendingContractAlerts, setPendingContractAlerts] = useState([])
  const [zeroCostAlerts, setZeroCostAlerts] = useState(null)

  const loadAllDashboard = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      const [statsData, macroData, budgetData, contractData, zeroCostData] = await Promise.all([
        fetchDashboardStatsService(),
        fetchMacroVariablesService(),
        fetchPendingBudgetAlertsForMariaService(),
        fetchPendingContractAlertsForMariaService({ syncFirst: !silent }),
        fetchDashboardZeroCostAlerts()
      ])

      setStats(statsData)
      setMacroVariables(macroData)
      if (!silent && macroData.length > 0) {
        const current = macroData[0]
        setMacroForm({
          year: current.year,
          month: current.month,
          dollar_rate: parseFloat(current.dollar_rate) || 1500,
          monthly_inflation_pct: parseFloat(current.monthly_inflation_pct) || 0
        })
      }
      setPendingBudgetAlerts(budgetData)
      setPendingContractAlerts(contractData)
      setZeroCostAlerts(zeroCostData)
    } catch (err) {
      console.warn('Error cargando métricas del Dashboard:', err)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  const { realtimeStatus } = useSupabaseRealtimeRefresh({
    channelName: 'dashboard_live',
    tables: DASHBOARD_REALTIME_TABLES,
    onSync: () => loadAllDashboard({ silent: true }),
    pauseWhen: savingMacro
  })

  useEffect(() => {
    loadAllDashboard({ silent: false })
  }, [loadAllDashboard])

  async function handleSaveMacro(e) {
    e.preventDefault()
    try {
      setSavingMacro(true)
      const yr = parseInt(macroForm.year, 10)
      const mo = parseInt(macroForm.month, 10)
      const dRate = parseFloat(macroForm.dollar_rate) || 1500
      const infPct = parseFloat(macroForm.monthly_inflation_pct) || 0
      const previous = (macroVariables || []).find((m) => m.year === yr && m.month === mo)

      await saveMacroVariables({
        year: yr,
        month: mo,
        dollar_rate: dRate,
        dollar_rate_1q: dRate,
        dollar_rate_2q: dRate,
        monthly_inflation_pct: infPct,
        updated_by: profile?.full_name || user?.email || 'Administrador',
        previousValues: previous ? {
          dollar_rate: previous.dollar_rate,
          dollar_rate_1q: previous.dollar_rate_1q,
          dollar_rate_2q: previous.dollar_rate_2q,
          monthly_inflation_pct: previous.monthly_inflation_pct
        } : null,
        user
      })

      setMacroMessage({
        type: 'success',
        text: `Parámetros guardados y auditados: Dólar a $${dRate.toLocaleString('es-AR')} e Inflación en ${infPct}% para ${MONTH_NAMES[mo - 1]} ${yr}. Se aplicó a la 1ª y 2ª quincena.`
      })
      setTimeout(() => setMacroMessage(null), 5000)
      loadAllDashboard({ silent: true })
    } catch (err) {
      console.error('Error al guardar macro variables:', err)
      setMacroMessage({ type: 'error', text: `Error al guardar: ${err.message}` })
    } finally {
      setSavingMacro(false)
    }
  }

  const cards = [
    { title: 'Barcos en Obra', value: stats.shipsCount, icon: Ship, color: 'from-cyan-500 to-blue-500', link: '/barcos', desc: 'Embarcaciones activas en varadero / taller' },
    { title: 'Órdenes de Trabajo', value: stats.otsCount, icon: ClipboardList, color: 'from-blue-500 to-indigo-500', link: '/ots', desc: 'OTs abiertas y en ejecución' },
    { title: 'Catálogo de Pañol', value: stats.materialsCount, icon: Package, color: 'from-emerald-500 to-teal-500', link: '/panol', desc: 'Ítems registrados y consumibles' },
    { title: 'Imputaciones de Horas', value: stats.hoursCount, icon: Clock, color: 'from-amber-500 to-orange-500', link: '/horas', desc: 'Registros en planilla diaria (labor_logs)' }
  ]

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800/80 to-slate-900 border border-slate-700/60 p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Base de Datos Supabase En Línea
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-[11px] font-bold">
                <Radio className={`w-3 h-3 ${realtimeStatus === 'SUBSCRIBED' ? 'animate-pulse text-emerald-400' : 'text-amber-400'}`} />
                {realtimeStatus === 'SUBSCRIBED' ? 'En vivo' : 'Auto-sync'}
              </span>
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Bienvenido, {profile?.full_name || user?.email?.split('@')[0] || 'Comandante de Operaciones'}
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Panel de control operativo de <strong className="text-slate-200">Alon Car S.A.</strong> Gestioná órdenes de trabajo, seguimiento de contratistas, retiros de materiales y horas trabajadas.
            </p>
          </div>

          <div className="flex gap-3">
            <Link to="/horas" className="px-4 py-2.5 bg-primary text-slate-950 font-semibold rounded-lg text-sm hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(0,242,254,0.3)]">
              <Clock className="w-4 h-4" /><span>Cargar Horas</span>
            </Link>
            <Link to="/panol" className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg text-sm border border-slate-700 transition-all flex items-center gap-2">
              <Package className="w-4 h-4" /><span>Retiro Pañol</span>
            </Link>
          </div>
        </div>
        <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-cyan-500/10 to-transparent pointer-events-none" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((card, i) => {
          const Icon = card.icon
          return (
            <Link key={i} to={card.link} className="group bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 p-5 rounded-xl transition-all duration-200 flex flex-col justify-between">
              <div className="flex items-start justify-between">
                <div className={`p-2.5 rounded-lg bg-gradient-to-br ${card.color} text-slate-950 shadow-md`}>
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-primary transition-colors" />
              </div>
              <div className="mt-4">
                <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">{card.title}</p>
                <div className="text-2xl font-bold text-white mt-1">{loading ? '...' : card.value}</div>
                <p className="text-xs text-slate-500 mt-1">{card.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>

      <ZeroCostDashboardAlertCard alerts={zeroCostAlerts} />

      <MariaJoseBudgetAlertsCard alerts={pendingBudgetAlerts} user={user} userName={profile?.full_name || user?.email || 'María José'} onResolved={() => loadAllDashboard({ silent: true })} />

      <MariaJoseContractAlertsCard alerts={pendingContractAlerts} user={user} userName={profile?.full_name || user?.email || 'María José'} onResolved={() => loadAllDashboard({ silent: true })} />

      <DashboardMacroPanel macroVariables={macroVariables} macroForm={macroForm} setMacroForm={setMacroForm} savingMacro={savingMacro} macroMessage={macroMessage} onSaveMacro={handleSaveMacro} />

      <DashboardOperationsGuide />
    </div>
  )
}
