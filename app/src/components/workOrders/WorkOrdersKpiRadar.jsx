import { Link } from 'react-router-dom'
import { AlertTriangle, Ship } from 'lucide-react'

export default function WorkOrdersKpiRadar({
  stats,
  selectedStatusFilter,
  setSelectedStatusFilter
}) {
  return (
    <div className="alon-zone-kpis rounded-2xl p-4 shadow-xl font-sans">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
          📊 Radar de KPIs & Estados Operativos • Clic en cualquier tarjeta para filtrar
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI ALERTA: IMPUTACIONES SIN OT EN EL ERP */}
        <div
          className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
            stats.totalSinOt > 0
              ? 'bg-rose-950/40 border-rose-500/50 shadow-md shadow-rose-950/30'
              : 'bg-slate-950/80 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className={stats.totalSinOt > 0 ? 'text-rose-300' : 'text-slate-400'}>
              ⚠️ Imputaciones sin OT
            </span>
            <AlertTriangle
              className={`w-3.5 h-3.5 ${stats.totalSinOt > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-600'}`}
            />
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span
              className={`text-2xl font-black font-mono ${stats.totalSinOt > 0 ? 'text-rose-400' : 'text-emerald-400'}`}
            >
              {stats.totalSinOt}
            </span>
            <span className="text-[10px] text-slate-400">pendientes</span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-1 text-[9px] font-mono font-bold">
            <Link
              to="/horas"
              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-slate-700"
              title="Ir a Horas sin OT"
            >
              Hs: {stats.horasSinOt}
            </Link>
            <Link
              to="/terceros"
              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-purple-300 border border-slate-700"
              title="Ir a Terceros sin OT"
            >
              3ros: {stats.tercerosSinOt}
            </Link>
            <Link
              to="/compras"
              className="px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700"
              title="Ir a Compras sin OT"
            >
              Comp: {stats.comprasSinOt}
            </Link>
          </div>
        </div>

        {/* TRABAJOS EN EJECUCIÓN */}
        <div
          onClick={() =>
            setSelectedStatusFilter(selectedStatusFilter === 'En ejecución' ? 'todos' : 'En ejecución')
          }
          className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
            selectedStatusFilter === 'En ejecución'
              ? 'bg-emerald-950/50 border-emerald-500 ring-1 ring-emerald-400'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Trabajos en Ejecución</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-400 font-mono">{stats.enEjecucion}</span>
            <span className="text-[10px] text-slate-500">activos p/ costos</span>
          </div>
        </div>

        {/* PENDIENTES DE INICIO */}
        <div
          onClick={() =>
            setSelectedStatusFilter(selectedStatusFilter === 'Pendiente de inicio' ? 'todos' : 'Pendiente de inicio')
          }
          className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
            selectedStatusFilter === 'Pendiente de inicio'
              ? 'bg-amber-950/50 border-amber-500 ring-1 ring-amber-400'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Pendientes Inicio</span>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-400 font-mono">{stats.pendientes}</span>
            <span className="text-[10px] text-slate-500">por iniciar</span>
          </div>
        </div>

        {/* FINALIZADOS / PENDIENTE REMITO */}
        <div
          onClick={() =>
            setSelectedStatusFilter(selectedStatusFilter === 'Finalizado' ? 'todos' : 'Finalizado')
          }
          className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
            selectedStatusFilter === 'Finalizado'
              ? 'bg-cyan-950/50 border-cyan-500 ring-1 ring-cyan-400'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Finalizados / Remito</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-cyan-300 font-mono">{stats.pdteRemito}</span>
            <span className="text-[10px] text-slate-500">en cierre</span>
          </div>
        </div>

        {/* FACTURADOS */}
        <div
          onClick={() =>
            setSelectedStatusFilter(selectedStatusFilter === 'Facturado' ? 'todos' : 'Facturado')
          }
          className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
            selectedStatusFilter === 'Facturado'
              ? 'bg-purple-950/50 border-purple-500 ring-1 ring-purple-400'
              : 'bg-slate-950/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Facturados</span>
            <span className="w-2 h-2 rounded-full bg-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-300 font-mono">{stats.facturados}</span>
            <span className="text-[10px] text-slate-500">cerrados</span>
          </div>
        </div>

        {/* BARCOS EN OBRA */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Barcos en Obra</span>
            <Ship className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white font-mono">{stats.barcosActivos}</span>
            <span className="text-[10px] text-slate-500">buques activos</span>
          </div>
        </div>
      </div>
    </div>
  )
}
