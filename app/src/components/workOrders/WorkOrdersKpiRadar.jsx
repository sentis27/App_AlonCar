import { Link } from 'react-router-dom'
import { AlertTriangle, Ship, Megaphone } from 'lucide-react'

export default function WorkOrdersKpiRadar({
  stats,
  selectedStatusFilter,
  setSelectedStatusFilter,
  pendingBillingExpansionsCount = 0,
  onOpenBillingExpansionModal
}) {
  return (
    <div className="alon-zone-kpis rounded-2xl p-4 shadow-xl font-sans">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
          📊 Radar de KPIs & Estados Operativos • Clic en cualquier tarjeta para filtrar
        </span>
        {pendingBillingExpansionsCount > 0 && (
          <button
            type="button"
            onClick={onOpenBillingExpansionModal}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-500/20 hover:bg-orange-500/30 border border-orange-400 text-orange-200 text-[11px] font-black cursor-pointer animate-pulse"
            title="Gerencia solicitó ampliar el detalle comercial (billing_description) de estas OTs"
          >
            <Megaphone className="w-3.5 h-3.5 text-orange-300" />
            <span>Ampliación Gerencia: {pendingBillingExpansionsCount} pendiente(s)</span>
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* KPI ALERTA: IMPUTACIONES SIN OT EN EL ERP */}
        <div
          className={`p-3.5 rounded-xl border flex flex-col justify-between transition-all ${
            stats.totalSinOt > 0
              ? 'bg-rose-950/35 border-rose-500/60 shadow-md shadow-rose-950/30'
              : 'bg-rose-950/15 border-rose-500/30'
          }`}
        >
          <div className="flex items-center justify-between text-[11px] font-bold">
            <span className={stats.totalSinOt > 0 ? 'text-rose-300' : 'text-rose-200/80'}>
              ⚠️ Imputaciones sin OT
            </span>
            <AlertTriangle
              className={`w-3.5 h-3.5 ${stats.totalSinOt > 0 ? 'text-rose-400 animate-pulse' : 'text-rose-400/50'}`}
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
              to="/horas?kpi=sin_ot"
              className="px-1.5 py-0.5 rounded bg-cyan-950/60 hover:bg-cyan-900/70 text-cyan-300 border border-cyan-500/40"
              title="Filtrar Horas sin OT"
            >
              Hs: {stats.horasSinOt}
            </Link>
            <Link
              to="/terceros?kpi=sin_ot"
              className="px-1.5 py-0.5 rounded bg-purple-950/60 hover:bg-purple-900/70 text-purple-300 border border-purple-500/40"
              title="Filtrar Terceros sin OT"
            >
              3ros: {stats.tercerosSinOt}
            </Link>
            <Link
              to="/compras?kpi=sin_ot"
              className="px-1.5 py-0.5 rounded bg-amber-950/60 hover:bg-amber-900/70 text-amber-300 border border-amber-500/40"
              title="Filtrar Compras sin OT"
            >
              Comp: {stats.comprasSinOt}
            </Link>
            <Link
              to="/panol?tab=planillas&kpi=sin_ot"
              className="px-1.5 py-0.5 rounded bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-300 border border-emerald-500/40"
              title="Filtrar Materiales de Pañol sin OT"
            >
              Mat: {stats.materialesSinOt ?? 0}
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
              ? 'bg-emerald-950/70 border-emerald-400 ring-2 ring-emerald-400/70 shadow-lg shadow-emerald-500/15'
              : 'bg-emerald-950/20 border-emerald-500/40 hover:border-emerald-400/80'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-300 text-[11px] font-bold">
            <span>Trabajos en Ejecución</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-400 font-mono">{stats.enEjecucion}</span>
            <span className="text-[10px] text-slate-400">activos p/ costos</span>
          </div>
        </div>

        {/* PENDIENTES DE INICIO */}
        <div
          onClick={() =>
            setSelectedStatusFilter(selectedStatusFilter === 'Pendiente de inicio' ? 'todos' : 'Pendiente de inicio')
          }
          className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
            selectedStatusFilter === 'Pendiente de inicio'
              ? 'bg-amber-950/70 border-amber-400 ring-2 ring-amber-400/70 shadow-lg shadow-amber-500/15'
              : 'bg-amber-950/20 border-amber-500/40 hover:border-amber-400/80'
          }`}
        >
          <div className="flex items-center justify-between text-amber-300 text-[11px] font-bold">
            <span>Pendientes Inicio</span>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-400 font-mono">{stats.pendientes}</span>
            <span className="text-[10px] text-slate-400">por iniciar</span>
          </div>
        </div>

        {/* FINALIZADOS / PENDIENTE REMITO */}
        <div
          onClick={() =>
            setSelectedStatusFilter(selectedStatusFilter === 'Finalizado' ? 'todos' : 'Finalizado')
          }
          className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
            selectedStatusFilter === 'Finalizado'
              ? 'bg-cyan-950/70 border-cyan-400 ring-2 ring-cyan-400/70 shadow-lg shadow-cyan-500/15'
              : 'bg-cyan-950/20 border-cyan-500/40 hover:border-cyan-400/80'
          }`}
        >
          <div className="flex items-center justify-between text-cyan-300 text-[11px] font-bold">
            <span>Finalizados / Remito</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-cyan-300 font-mono">{stats.pdteRemito}</span>
            <span className="text-[10px] text-slate-400">en cierre</span>
          </div>
        </div>

        {/* FACTURADOS */}
        <div
          onClick={() =>
            setSelectedStatusFilter(selectedStatusFilter === 'Facturado' ? 'todos' : 'Facturado')
          }
          className={`p-3.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
            selectedStatusFilter === 'Facturado'
              ? 'bg-purple-950/70 border-purple-400 ring-2 ring-purple-400/70 shadow-lg shadow-purple-500/15'
              : 'bg-purple-950/20 border-purple-500/40 hover:border-purple-400/80'
          }`}
        >
          <div className="flex items-center justify-between text-purple-300 text-[11px] font-bold">
            <span>Facturados</span>
            <span className="w-2 h-2 rounded-full bg-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-300 font-mono">{stats.facturados}</span>
            <span className="text-[10px] text-slate-400">cerrados</span>
          </div>
        </div>

        {/* BARCOS EN OBRA (SOLO INDICADOR INFORMATIVO - NO FILTRA) */}
        <div
          className="p-3.5 rounded-xl bg-slate-900/50 border border-dashed border-slate-700 flex flex-col justify-between cursor-default select-none"
          title="Indicador informativo de cantidad de buques con trabajos activos (no aplica filtro)"
        >
          <div className="flex items-center justify-between gap-1 text-slate-400 text-[11px] font-semibold">
            <div className="flex items-center gap-1.5">
              <Ship className="w-3.5 h-3.5 text-sky-400 shrink-0" />
              <span>Barcos en Obra</span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700 text-[8px] font-black uppercase tracking-wider">
              Solo lectura
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-slate-200 font-mono">{stats.barcosActivos}</span>
            <span className="text-[10px] text-slate-500">buques activos</span>
          </div>
        </div>
      </div>
    </div>
  )
}
