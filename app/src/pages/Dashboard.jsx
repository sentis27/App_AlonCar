import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { 
  Ship, 
  ClipboardList, 
  Clock, 
  Package, 
  CheckCircle2, 
  TrendingUp, 
  ArrowUpRight,
  AlertTriangle,
  DollarSign,
  Percent,
  Calendar,
  Save,
  Check,
  Building2,
  Lock,
  Layers
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function Dashboard() {
  const { profile, user } = useAuth()
  const [stats, setStats] = useState({
    shipsCount: 0,
    otsCount: 0,
    materialsCount: 0,
    hoursCount: 0,
  })
  const [loading, setLoading] = useState(true)

  // Estados de Variables Macroeconómicas fijadas por Administrador
  const [macroVariables, setMacroVariables] = useState([])
  const [macroForm, setMacroForm] = useState({
    year: 2026,
    month: 10,
    dollar_rate: 1500,
    monthly_inflation_pct: 3.2
  })
  const [savingMacro, setSavingMacro] = useState(false)
  const [macroMessage, setMacroMessage] = useState(null)

  useEffect(() => {
    async function loadStats() {
      try {
        setLoading(true)
        // Consultar conteos en paralelo desde Supabase
        const [shipsRes, otsRes, materialsRes] = await Promise.all([
          supabase.from('ships').select('id', { count: 'exact', head: true }),
          supabase.from('work_orders').select('id', { count: 'exact', head: true }),
          supabase.from('materials').select('id', { count: 'exact', head: true })
        ])

        setStats({
          shipsCount: shipsRes.count || 0,
          otsCount: otsRes.count || 0,
          materialsCount: materialsRes.count || 0,
          hoursCount: 0
        })
      } catch (err) {
        console.error('Error al cargar métricas:', err)
      } finally {
        setLoading(false)
      }
    }

    loadStats()
    loadMacroVariables()
  }, [])

  async function loadMacroVariables() {
    try {
      const { data, error } = await supabase
        .from('macro_variables')
        .select('*')
        .order('year', { ascending: false })
        .order('month', { ascending: false })

      if (!error && data && data.length > 0) {
        setMacroVariables(data)
        const current = data[0]
        setMacroForm({
          year: current.year,
          month: current.month,
          dollar_rate: parseFloat(current.dollar_rate) || 1500,
          monthly_inflation_pct: parseFloat(current.monthly_inflation_pct) || 0
        })
      }
    } catch (err) {
      console.error('Error al cargar variables macro:', err)
    }
  }

  async function handleSaveMacro(e) {
    e.preventDefault()
    try {
      setSavingMacro(true)
      const yr = parseInt(macroForm.year)
      const mo = parseInt(macroForm.month)
      const dRate = parseFloat(macroForm.dollar_rate) || 1500
      const infPct = parseFloat(macroForm.monthly_inflation_pct) || 0

      // 1. Guardar en macro_variables
      const { error: macroErr } = await supabase
        .from('macro_variables')
        .upsert({
          year: yr,
          month: mo,
          dollar_rate: dRate,
          monthly_inflation_pct: infPct,
          updated_by: profile?.full_name || user?.email || 'Administrador',
          updated_at: new Date().toISOString()
        }, { onConflict: 'year,month' })

      if (macroErr) throw macroErr

      // 2. Sincronizar automáticamente en las rate_cards del mes (1Q y 2Q)
      await supabase
        .from('rate_cards')
        .update({
          dollar_rate: dRate,
          monthly_inflation_pct: infPct
        })
        .eq('year', yr)
        .eq('month', mo)

      setMacroMessage({
        type: 'success',
        text: `Parámetros guardados: Dólar a $${dRate.toLocaleString('es-AR')} e Inflación en ${infPct}% para ${MONTH_NAMES[mo - 1]} ${yr}. Se aplicó a la 1ª y 2ª quincena.`
      })
      setTimeout(() => setMacroMessage(null), 5000)
      loadMacroVariables()
    } catch (err) {
      console.error('Error al guardar macro variables:', err)
      setMacroMessage({ type: 'error', text: `Error al guardar: ${err.message}` })
    } finally {
      setSavingMacro(false)
    }
  }

  const cards = [
    {
      title: 'Barcos en Obra',
      value: stats.shipsCount,
      icon: Ship,
      color: 'from-cyan-500 to-blue-500',
      link: '/barcos',
      desc: 'Embarcaciones activas en varadero / taller'
    },
    {
      title: 'Órdenes de Trabajo',
      value: stats.otsCount,
      icon: ClipboardList,
      color: 'from-blue-500 to-indigo-500',
      link: '/ots',
      desc: 'OTs abiertas y en ejecución'
    },
    {
      title: 'Catálogo de Pañol',
      value: stats.materialsCount,
      icon: Package,
      color: 'from-emerald-500 to-teal-500',
      link: '/panol',
      desc: 'Ítems registrados y consumibles'
    },
    {
      title: 'Control Quincenal',
      value: 'Al día',
      icon: Clock,
      color: 'from-amber-500 to-orange-500',
      link: '/horas',
      desc: 'Carga de horas y conciliación'
    }
  ]

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Banner de Bienvenida */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800/80 to-slate-900 border border-slate-700/60 p-8 shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-semibold mb-3">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Base de Datos Supabase En Línea
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">
              Bienvenido, {profile?.full_name || user?.email?.split('@')[0] || 'Comandante de Operaciones'}
            </h1>
            <p className="text-slate-400 text-sm mt-1 max-w-2xl">
              Panel de control operativo de <strong className="text-slate-200">Alon Car S.A.</strong> Gestioná órdenes de trabajo, seguimiento de contratistas, retiros de materiales y horas trabajadas.
            </p>
          </div>

          <div className="flex gap-3">
            <Link
              to="/horas"
              className="px-4 py-2.5 bg-primary text-slate-950 font-semibold rounded-lg text-sm hover:brightness-110 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(0,242,254,0.3)]"
            >
              <Clock className="w-4 h-4" />
              <span>Cargar Horas</span>
            </Link>
            <Link
              to="/panol"
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-lg text-sm border border-slate-700 transition-all flex items-center gap-2"
            >
              <Package className="w-4 h-4" />
              <span>Retiro Pañol</span>
            </Link>
          </div>
        </div>

        {/* Glow de fondo */}
        <div className="absolute right-0 top-0 w-96 h-full bg-gradient-to-l from-cyan-500/10 to-transparent pointer-events-none" />
      </div>

      {/* Grid de Tarjetas KPI */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {cards.map((card, i) => {
          const Icon = card.icon
          return (
            <Link
              key={i}
              to={card.link}
              className="group bg-slate-900/60 hover:bg-slate-800/60 border border-slate-800 hover:border-slate-700 p-5 rounded-xl transition-all duration-200 flex flex-col justify-between"
            >
              <div className="flex items-start justify-between">
                <div className={`p-2.5 rounded-lg bg-gradient-to-br ${card.color} text-slate-950 shadow-md`}>
                  <Icon className="w-5 h-5 stroke-[2.2]" />
                </div>
                <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-primary transition-colors" />
              </div>

              <div className="mt-4">
                <p className="text-xs uppercase tracking-wider font-semibold text-slate-400">
                  {card.title}
                </p>
                <div className="text-2xl font-bold text-white mt-1">
                  {loading ? '...' : card.value}
                </div>
                <p className="text-xs text-slate-500 mt-1">{card.desc}</p>
              </div>
            </Link>
          )
        })}
      </div>

      {/* PANEL DE VARIABLES MACROECONÓMICAS (ADMINISTRADOR) */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">
                Variables Macroeconómicas Centrales (Dólar & Inflación Mensual)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Fijadas exclusivamente por el Administrador. Rigen para todas las liquidaciones y se trasladan automáticamente a la 1ª y 2ª quincena del mes.
            </p>
          </div>

          <span className="text-[10px] px-2.5 py-1 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-800 font-bold flex items-center gap-1 self-start md:self-auto">
            <Lock className="w-3 h-3" /> Panel Maestro de Cotización
          </span>
        </div>

        {macroMessage && (
          <div className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
            macroMessage.type === 'success' 
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' 
              : 'bg-rose-950/60 border-rose-800 text-rose-300'
          }`}>
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{macroMessage.text}</span>
          </div>
        )}

        {/* Formulario de Carga / Actualización Mensual */}
        <form onSubmit={handleSaveMacro} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end bg-slate-950 p-4 rounded-xl border border-slate-800">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Año
            </label>
            <select
              value={macroForm.year}
              onChange={(e) => setMacroForm({ ...macroForm, year: parseInt(e.target.value) })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
            >
              {[2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Mes de Aplicación
            </label>
            <select
              value={macroForm.month}
              onChange={(e) => {
                const m = parseInt(e.target.value)
                const existing = macroVariables.find(v => v.year === macroForm.year && v.month === m)
                setMacroForm({ 
                  ...macroForm, 
                  month: m,
                  dollar_rate: existing ? parseFloat(existing.dollar_rate) : macroForm.dollar_rate,
                  monthly_inflation_pct: existing ? parseFloat(existing.monthly_inflation_pct) : macroForm.monthly_inflation_pct
                })
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>{name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-400" /> Valor Dólar (AR$/USD)
            </label>
            <input
              type="number"
              step="1"
              value={macroForm.dollar_rate}
              onChange={(e) => setMacroForm({ ...macroForm, dollar_rate: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-extrabold text-emerald-300 focus:outline-none focus:border-emerald-400"
              placeholder="1500"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Percent className="w-3 h-3 text-amber-400" /> Inflación Mensual (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={macroForm.monthly_inflation_pct}
              onChange={(e) => setMacroForm({ ...macroForm, monthly_inflation_pct: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-extrabold text-amber-300 focus:outline-none focus:border-emerald-400"
              placeholder="3.2"
              required
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={savingMacro}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingMacro ? 'Guardando...' : 'Guardar Parámetros'}</span>
            </button>
          </div>
        </form>

        {/* Historial de meses cargados */}
        {macroVariables.length > 0 && (
          <div className="pt-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
              Historial de Parámetros Macroeconómicos Registrados
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
              {macroVariables.slice(0, 6).map(v => (
                <div 
                  key={`${v.year}-${v.month}`} 
                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                    macroForm.year === v.year && macroForm.month === v.month
                      ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950/30'
                      : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                  }`}
                  onClick={() => setMacroForm({
                    year: v.year,
                    month: v.month,
                    dollar_rate: parseFloat(v.dollar_rate),
                    monthly_inflation_pct: parseFloat(v.monthly_inflation_pct)
                  })}
                  title="Hacé clic para cargar en el formulario"
                >
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">
                    {MONTH_NAMES[v.month - 1]} {v.year}
                  </span>
                  <div className="font-mono text-xs font-extrabold text-emerald-400 mt-0.5">
                    ${parseFloat(v.dollar_rate).toLocaleString('es-AR')}
                  </div>
                  <div className="font-mono text-[10px] font-bold text-amber-300">
                    Inf: {v.monthly_inflation_pct}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Accesos rápidos & Reglas operativas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl p-6">
          <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Flujo de Operaciones Alon Car
          </h2>
          <div className="space-y-3 text-sm">
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">1</span>
              <div>
                <strong className="text-slate-200 block">Apertura y Asignación de OTs</strong>
                <p className="text-slate-400 text-xs">Jefes de Obra (Martín, Alejandro, Pablo) definen alcances para cada barco en astillero.</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">2</span>
              <div>
                <strong className="text-slate-200 block">Imputación de Horas & Pañol</strong>
                <p className="text-slate-400 text-xs">Carga diaria por operario/contratista y retiro de consumibles vinculados directamente al barco y OT.</p>
              </div>
            </div>
            <div className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">3</span>
              <div>
                <strong className="text-slate-200 block">Auditoría Quincenal con Jorge y Graciela</strong>
                <p className="text-slate-400 text-xs">Validación de la regla dura: <em>Material sin horas de contratista no se liquida hasta aclaración</em>.</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Consistencia ERP
            </h2>
            <p className="text-xs text-slate-400 leading-relaxed">
              El motor de base de datos en Supabase tiene activadas las restricciones de integridad y Row Level Security (RLS) para proteger los datos financieros y de cotización.
            </p>
          </div>
          <div className="pt-4 border-t border-slate-800/80 mt-6">
            <span className="text-[11px] text-slate-500">Versión App: 1.0.0-sprint1</span>
          </div>
        </div>
      </div>
    </div>
  )
}
