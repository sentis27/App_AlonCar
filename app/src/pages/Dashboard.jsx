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
  AlertTriangle
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

export default function Dashboard() {
  const { profile, user } = useAuth()
  const [stats, setStats] = useState({
    shipsCount: 0,
    otsCount: 0,
    materialsCount: 0,
    hoursCount: 0,
  })
  const [loading, setLoading] = useState(true)

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
  }, [])

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
