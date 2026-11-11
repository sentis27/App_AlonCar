import {
  AlertTriangle,
  Clock,
  Anchor,
  Flame,
  MessageSquare,
  Trash2
} from 'lucide-react'

export default function PanolAlertasPanel({
  kpiStats,
  activeKpiFilter,
  onToggleKpiFilter,
  onClearKpiFilter
}) {
  return (
    <div className="alon-zone-kpis py-2.5 px-3 space-y-2 font-sans">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="text-sm md:text-base font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            📊 RADAR DE KPIs Y ALERTAS OPERATIVAS
          </span>
          <span className="text-[11px] italic text-slate-400 font-normal">
            • Clic en cualquier tarjeta para filtrar
          </span>
        </div>
        {activeKpiFilter && (
          <button
            type="button"
            onClick={onClearKpiFilter}
            className="text-[10px] font-bold text-amber-300 hover:text-white bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded cursor-pointer transition-all"
          >
            ✕ Limpiar Filtro Activo
          </button>
        )}
      </div>

      {/* Grilla de 6 Tarjetas con 6 Colores Distintivos (Sin Repetir) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {/* 1. Stock Crítico (Rojo Carmín) */}
        <div
          onClick={() => onToggleKpiFilter('critico', 'catalogo')}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
            activeKpiFilter === 'critico'
              ? 'bg-rose-950 border-rose-400 ring-2 ring-white/60'
              : 'bg-rose-950/30 border-rose-500/40 hover:border-rose-400'
          }`}
        >
          <div className="flex items-center justify-between text-rose-300 mb-1">
            <span className="text-[11px] font-extrabold uppercase">Stock Crítico</span>
            <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-lg font-black text-rose-200">{kpiStats.criticalCount}</div>
          <div className="text-[10px] text-rose-300/80 font-semibold truncate">En o bajo mínimo</div>
        </div>

        {/* 2. Retiros Hoy (Verde Esmeralda) */}
        <div
          onClick={() => onToggleKpiFilter('hoy', 'planillas')}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
            activeKpiFilter === 'hoy'
              ? 'bg-emerald-950 border-emerald-400 ring-2 ring-white/60'
              : 'bg-emerald-950/30 border-emerald-500/40 hover:border-emerald-400'
          }`}
        >
          <div className="flex items-center justify-between text-emerald-300 mb-1">
            <span className="text-[11px] font-extrabold uppercase">Retiros Hoy</span>
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-lg font-black text-emerald-200">{kpiStats.todayTxCount}</div>
          <div className="text-[10px] text-emerald-300/80 font-semibold truncate">Movimientos de la fecha</div>
        </div>

        {/* 3. Sin Cargar OT (Ámbar Dorado) */}
        <div
          onClick={() => onToggleKpiFilter('sin_ot', 'planillas')}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
            activeKpiFilter === 'sin_ot'
              ? 'bg-amber-950 border-amber-400 ring-2 ring-white/60'
              : 'bg-amber-950/30 border-amber-500/40 hover:border-amber-400'
          }`}
        >
          <div className="flex items-center justify-between text-amber-300 mb-1">
            <span className="text-[11px] font-extrabold uppercase">Sin Cargar OT</span>
            <Anchor className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-black text-amber-200">{kpiStats.sinOtCount}</div>
          <div className="text-[10px] text-amber-300/80 font-semibold truncate">Imputación directa buque</div>
        </div>

        {/* 4. Vacíos en Patio (Azul Eléctrico) */}
        <div
          onClick={() => onToggleKpiFilter('vacios', 'gases')}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
            activeKpiFilter === 'vacios'
              ? 'bg-blue-950 border-blue-400 ring-2 ring-white/60'
              : 'bg-blue-950/30 border-blue-500/40 hover:border-blue-400'
          }`}
        >
          <div className="flex items-center justify-between text-blue-300 mb-1">
            <span className="text-[11px] font-extrabold uppercase">Vacíos Patio</span>
            <Flame className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-lg font-black text-blue-200">{kpiStats.emptyCylinders}</div>
          <div className="text-[10px] text-blue-300/80 font-semibold truncate">Tubos a reponer (P-02)</div>
        </div>

        {/* 5. Retención > 15 Días (Púrpura / Violeta) */}
        <div
          onClick={() => onToggleKpiFilter('retencion', 'gases')}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
            activeKpiFilter === 'retencion'
              ? 'bg-purple-950 border-purple-400 ring-2 ring-white/60'
              : 'bg-purple-950/30 border-purple-500/40 hover:border-purple-400'
          }`}
        >
          <div className="flex items-center justify-between text-purple-300 mb-1">
            <span className="text-[11px] font-extrabold uppercase">Retención &gt;15d</span>
            <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="text-lg font-black text-purple-200">{kpiStats.longHeldGases}</div>
          <div className="text-[10px] text-purple-300/80 font-semibold truncate">Tubos en taller/obra</div>
        </div>

        {/* 6. Bajas Pendientes (Fucsia / Advertencia Admin) */}
        <div
          onClick={() => onToggleKpiFilter('bajas_pendientes', 'planillas')}
          className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
            activeKpiFilter === 'bajas_pendientes'
              ? 'bg-fuchsia-950 border-fuchsia-400 ring-2 ring-white/60'
              : 'bg-fuchsia-950/40 border-fuchsia-600/50 hover:border-fuchsia-400'
          }`}
        >
          <div className="flex items-center justify-between text-fuchsia-300 mb-1">
            <span className="text-[11px] font-extrabold uppercase">Bajas Pendientes</span>
            <Trash2 className="w-3.5 h-3.5 text-fuchsia-400" />
          </div>
          <div className="text-lg font-black text-fuchsia-200">{kpiStats.deletionRequestsCount}</div>
          <div className="text-[10px] text-fuchsia-300/80 font-semibold truncate">Requieren decisión Admin</div>
        </div>
      </div>
    </div>
  )
}
