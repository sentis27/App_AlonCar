import { ShieldAlert } from 'lucide-react'

export default function ComprasKpiRadar({
  kpis,
  activeKpiFilter,
  onToggleKpiFilter,
  onClearKpiFilter
}) {
  return (
    <div className="alon-zone-kpis py-2.5 px-3 space-y-2">
      <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="text-sm md:text-base font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
            📊 RADAR DE KPIS Y ALERTAS OPERATIVAS
          </span>
          <span className="text-[11px] italic text-slate-400 font-normal">
            • Clic en cualquier tarjeta para filtrar
          </span>
        </div>
        {activeKpiFilter && (
          <button
            type="button"
            onClick={onClearKpiFilter}
            className="text-[10px] font-bold text-amber-300 hover:text-white bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded cursor-pointer"
          >
            ✕ Quitar Filtro KPI
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
        {/* KPI 0: Falta Cargar OT */}
        <div
          onClick={() => onToggleKpiFilter('sin_ot')}
          className={`py-2 px-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
            ['sin_ot', 'sin_ot_obras', 'sin_ot_stock'].includes(activeKpiFilter)
              ? 'bg-orange-950/85 border-orange-400 ring-1 ring-orange-400/50 shadow-lg shadow-orange-500/20'
              : 'bg-orange-950/25 border-orange-500/40 hover:border-orange-400/70'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[13px] xl:text-[14px] font-black text-orange-300 leading-tight tracking-tight">Falta OT</span>
            <span className="text-lg font-black text-orange-400 font-mono leading-none">{kpis.countSinOtTotal}</span>
          </div>
          <div className="flex items-center gap-1 mt-1.5 pt-1 border-t border-orange-900/50">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleKpiFilter('sin_ot_obras') }}
              className={`px-1 py-0.5 rounded text-[9px] font-bold transition-colors cursor-pointer ${
                activeKpiFilter === 'sin_ot_obras' ? 'bg-orange-500 text-slate-950 font-black' : 'bg-orange-500/15 text-orange-200 hover:bg-orange-500/30'
              }`}
              title="Pedidos imputados a buque/obra sin OT vinculada"
            >
              🚢 {kpis.countSinOtObras}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleKpiFilter('sin_ot_stock') }}
              className={`px-1 py-0.5 rounded text-[9px] font-bold transition-colors cursor-pointer ${
                activeKpiFilter === 'sin_ot_stock' ? 'bg-orange-400 text-slate-950 font-black' : 'bg-orange-500/15 text-orange-200 hover:bg-orange-500/30'
              }`}
              title="Pedidos para Astillero / Stock general sin OT vinculada"
            >
              🏢 {kpis.countSinOtStock}
            </button>
          </div>
        </div>

        {/* KPI 1: Por Emitir */}
        <div
          onClick={() => onToggleKpiFilter('por_emitir')}
          className={`py-2 px-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
            activeKpiFilter === 'por_emitir' || activeKpiFilter === 'PEDIR'
              ? 'bg-amber-950/85 border-amber-400 ring-1 ring-amber-400/50 shadow-lg shadow-amber-500/20'
              : 'bg-amber-950/25 border-amber-500/40 hover:border-amber-400/70'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[13px] xl:text-[14px] font-black text-amber-300 leading-tight tracking-tight">1. Por Emitir</span>
            <span className="text-lg font-black text-amber-400 font-mono leading-none">{kpis.porEmitirTotal}</span>
          </div>
          <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-amber-900/50 text-[9px]">
            <span className="text-amber-200/80 font-semibold">Estado: PEDIR</span>
            {activeKpiFilter === 'por_emitir' && <span className="px-1 rounded bg-amber-400 text-slate-950 font-black text-[8px]">ACTIVO</span>}
          </div>
        </div>

        {/* KPI 2: Cotizaciones */}
        <div
          onClick={() => onToggleKpiFilter('cotizaciones')}
          className={`py-2 px-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
            activeKpiFilter === 'cotizaciones' || ['COTIZAR', 'COTIZA.SOLICITUD', 'COTIZACION', 'COTIZA.APROBADA'].includes(activeKpiFilter)
              ? 'bg-purple-950/85 border-purple-400 ring-1 ring-purple-400/50 shadow-lg shadow-purple-500/20'
              : 'bg-purple-950/25 border-purple-500/40 hover:border-purple-400/70'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[13px] xl:text-[14px] font-black text-purple-300 leading-tight tracking-tight">2. Cotizac.</span>
            <span className="text-lg font-black text-purple-400 font-mono leading-none">{kpis.countCotizacionesTotal}</span>
          </div>
          <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1 border-t border-purple-900/50">
            {[
              { key: 'COTIZAR', label: `COT:${kpis.countCotizar}`, activeCls: 'bg-indigo-500 text-white', title: 'COTIZAR (A Pedir Precio)' },
              { key: 'COTIZA.SOLICITUD', label: `SOL:${kpis.countCotizaSol}`, activeCls: 'bg-yellow-500 text-slate-950', title: 'COTIZA.SOLICITUD (Esperando)' },
              { key: 'COTIZACION', label: `EV:${kpis.countCotizacion}`, activeCls: 'bg-purple-400 text-slate-950', title: 'COTIZACION (En Evaluación)' },
              { key: 'COTIZA.APROBADA', label: `OK:${kpis.countCotizaAprob}`, activeCls: 'bg-emerald-500 text-slate-950', title: 'COTIZA.APROBADA (Aprobada)' }
            ].map((sub) => (
              <button
                key={sub.key}
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggleKpiFilter(sub.key) }}
                className={`px-1 py-0.2 rounded text-[8px] font-bold cursor-pointer ${
                  activeKpiFilter === sub.key ? sub.activeCls : 'bg-purple-500/15 text-purple-200 hover:bg-purple-500/30'
                }`}
                title={sub.title}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>

        {/* KPI 3: En Proveedor */}
        <div
          onClick={() => onToggleKpiFilter('pedidos')}
          className={`py-2 px-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
            ['pedidos', 'PEDIDO', 'PEDIDO INCOMPLETO'].includes(activeKpiFilter)
              ? 'bg-blue-950/85 border-blue-400 ring-1 ring-blue-400/50 shadow-lg shadow-blue-500/20'
              : 'bg-blue-950/25 border-blue-500/40 hover:border-blue-400/70'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[13px] xl:text-[14px] font-black text-blue-300 leading-tight tracking-tight">3. En Prov.</span>
            <span className="text-lg font-black text-blue-400 font-mono leading-none">{kpis.enProveedorTotal}</span>
          </div>
          <div className="flex items-center justify-between gap-1 mt-1.5 pt-1 border-t border-blue-900/50">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleKpiFilter('PEDIDO') }}
              className={`px-1.5 py-0.2 rounded text-[9px] font-bold transition-colors cursor-pointer ${
                activeKpiFilter === 'PEDIDO' ? 'bg-blue-500 text-slate-950 font-black' : 'bg-blue-500/15 text-blue-200 hover:bg-blue-500/30'
              }`}
            >
              PED: {kpis.countPedido}
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleKpiFilter('PEDIDO INCOMPLETO') }}
              className={`px-1.5 py-0.2 rounded text-[9px] font-bold transition-colors cursor-pointer ${
                activeKpiFilter === 'PEDIDO INCOMPLETO'
                  ? 'bg-orange-500 text-slate-950 font-black'
                  : kpis.countPedidoIncompleto > 0
                  ? 'bg-orange-500/25 text-orange-300 border border-orange-500/40 animate-pulse'
                  : 'bg-blue-950 text-blue-300/70'
              }`}
              title="Recepción parcial / Saldo faltante a reclamar"
            >
              Inc.: {kpis.countPedidoIncompleto}
            </button>
          </div>
        </div>

        {/* KPI 4: SE COMPRA? */}
        <div
          onClick={() => onToggleKpiFilter('SE COMPRA?')}
          className={`py-2 px-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
            activeKpiFilter === 'SE COMPRA?'
              ? 'bg-fuchsia-950/85 border-fuchsia-400 ring-1 ring-fuchsia-400/50 shadow-lg shadow-fuchsia-500/20'
              : 'bg-fuchsia-950/25 border-fuchsia-500/40 hover:border-fuchsia-400/70'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[13px] xl:text-[14px] font-black text-fuchsia-300 leading-tight tracking-tight">4. Se Compra?</span>
            <span className={`text-lg font-black font-mono leading-none ${kpis.countSeCompra > 0 ? 'text-fuchsia-400 animate-pulse' : 'text-fuchsia-400/60'}`}>
              {kpis.countSeCompra}
            </span>
          </div>
          <div className="mt-1.5 pt-1 border-t border-fuchsia-900/50 text-[9px] text-fuchsia-200/80 flex items-center justify-between">
            <span className="truncate">Evaluación Gerencia</span>
            {activeKpiFilter === 'SE COMPRA?' && <span className="px-1 rounded bg-fuchsia-400 text-slate-950 font-black text-[8px]">ACTIVO</span>}
          </div>
        </div>

        {/* KPI 5: Alta en Catálogo */}
        <div
          onClick={() => onToggleKpiFilter('alta_materiales')}
          className={`py-2 px-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
            activeKpiFilter === 'alta_materiales'
              ? 'bg-rose-950/85 border-rose-400 ring-1 ring-rose-400/50 shadow-lg shadow-rose-500/20'
              : 'bg-rose-950/25 border-rose-500/40 hover:border-rose-400/70'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[13px] xl:text-[14px] font-black text-rose-300 leading-tight tracking-tight">5. Alta Catál.</span>
            <span className={`text-lg font-black font-mono leading-none ${kpis.newMaterialsCount > 0 ? 'text-rose-400' : 'text-rose-400/60'}`}>
              {kpis.newMaterialsCount}
            </span>
          </div>
          <div className="mt-1.5 pt-1 border-t border-rose-900/50 text-[9px] text-rose-200/80 flex items-center justify-between">
            <span className="truncate">Nuevos s/registro</span>
            {activeKpiFilter === 'alta_materiales' && <span className="px-1 rounded bg-rose-400 text-slate-950 font-black text-[8px]">ACTIVO</span>}
          </div>
        </div>

        {/* KPI 6: Recibidos */}
        <div
          onClick={() => onToggleKpiFilter('recibidos')}
          className={`py-2 px-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
            activeKpiFilter === 'recibidos' || activeKpiFilter === 'conciliados'
              ? 'bg-emerald-950/85 border-emerald-400 ring-1 ring-emerald-400/50 shadow-lg shadow-emerald-500/20'
              : 'bg-emerald-950/25 border-emerald-500/40 hover:border-emerald-400/70'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <span className="text-[13px] xl:text-[14px] font-black text-emerald-300 leading-tight tracking-tight">6. Recibidos</span>
            <span className="text-lg font-black text-emerald-400 font-mono leading-none">{kpis.recibidosTotal}</span>
          </div>
          <div className="flex items-center justify-between gap-1 mt-1.5 pt-1 border-t border-emerald-900/50 text-[9px] font-mono">
            <span className="text-emerald-200/80 truncate">P:{kpis.countRecibido} | Ob:{kpis.countRecibidoDirecto}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onToggleKpiFilter('conciliados') }}
              className={`px-1 py-0.2 rounded text-[8px] font-bold shrink-0 cursor-pointer ${
                activeKpiFilter === 'conciliados' ? 'bg-purple-500 text-white' : 'bg-purple-950 text-purple-300 hover:bg-purple-900'
              }`}
              title="Filtrar conciliados con factura"
            >
              🟣 {kpis.countConciliados}
            </button>
          </div>
        </div>

        {/* KPI 7: Auditoría Costo Directo */}
        <div
          onClick={() => onToggleKpiFilter('cost_audit')}
          className={`py-2 px-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
            activeKpiFilter === 'cost_audit'
              ? 'bg-rose-950/85 border-rose-400 ring-1 ring-rose-400/50 shadow-lg shadow-rose-500/20'
              : kpis.costAuditErrors > 0
              ? 'bg-rose-950/35 border-rose-500/60 hover:border-rose-400/80 animate-pulse'
              : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-1">
              <ShieldAlert className={`w-3.5 h-3.5 ${kpis.costAuditErrors > 0 ? 'text-rose-400' : 'text-slate-400'} shrink-0`} />
              <span className={`text-[12px] xl:text-[13px] font-black leading-tight tracking-tight ${kpis.costAuditErrors > 0 ? 'text-rose-300' : 'text-slate-400'}`}>
                7. AUDITORÍA
              </span>
            </div>
            {activeKpiFilter === 'cost_audit' ? (
              <span className="px-1 rounded bg-rose-400 text-slate-950 font-black text-[8px]">ACTIVO</span>
            ) : (
              <span className={`text-base font-black font-mono leading-none ${kpis.costAuditErrors > 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                {kpis.costAuditErrors}
              </span>
            )}
          </div>
          <div className="mt-1.5 pt-1 border-t border-rose-900/40 text-[9px]">
            <p className={`font-bold truncate ${kpis.costAuditErrors > 0 ? 'text-rose-300' : 'text-slate-400'}`}>
              {kpis.costAuditErrors > 0 ? '⚠️ Incoherencias Buque/Directo' : '✓ Cero Incoherencias'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
