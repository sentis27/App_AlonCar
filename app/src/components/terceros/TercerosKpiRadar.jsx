/**
 * TercerosKpiRadar.jsx
 * Zona 2: Radar de KPIs Operativas y Alertas en Vivo (M5 / DEC-017).
 */

import React from 'react'
import { AlertCircle, AlertTriangle, Clock, FileCheck, X } from 'lucide-react'

export default function TercerosKpiRadar({
  kpiFilter,
  setKpiFilter,
  kpiCounts = { sinPrecio: 0, sinOt: 0, rpf: 0, fcr: 0 }
}) {
  return (
    <div className="alon-zone-kpis p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-amber-400">
            📊 RADAR DE KPIs Y ALERTAS EN VIVO
          </span>
          <span className="text-[10px] text-slate-400 font-mono">
            Clic en cualquier indicador para filtrar
          </span>
        </div>
        {kpiFilter !== 'todos' && (
          <button
            type="button"
            onClick={() => setKpiFilter('todos')}
            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5 text-slate-400" />
            <span>Ver todas las líneas</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Alerta 1: Falta Cargar OT (Ámbar) */}
        <button
          type="button"
          onClick={() => setKpiFilter(kpiFilter === 'sin_ot' ? 'todos' : 'sin_ot')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            kpiFilter === 'sin_ot'
              ? 'bg-amber-950/80 border-amber-400 shadow-lg shadow-amber-500/20 ring-2 ring-amber-400'
              : 'bg-slate-900/80 border-slate-800 hover:border-amber-500/40 hover:bg-slate-850'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Falta Cargar OT
            </span>
            {kpiCounts.sinOt > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                Sin C.C.
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-amber-300 font-mono">{kpiCounts.sinOt}</span>
            <span className="text-xs text-slate-400">trabajos sin OT vinculada</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {kpiFilter === 'sin_ot' ? '✓ Filtro activo (Clic para ver todos)' : 'Clic para filtrar solo líneas sin OT'}
          </p>
        </button>

        {/* Alerta 2: Sin Costo $0 (Rojo / Rose) */}
        <button
          type="button"
          onClick={() => setKpiFilter(kpiFilter === 'sin_precio' ? 'todos' : 'sin_precio')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            kpiFilter === 'sin_precio'
              ? 'bg-rose-950/80 border-rose-400 shadow-lg shadow-rose-500/20 ring-2 ring-rose-400'
              : 'bg-slate-900/80 border-slate-800 hover:border-rose-500/40 hover:bg-slate-850'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4 text-rose-400" />
              Líneas Sin Costo
            </span>
            {kpiCounts.sinPrecio > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-400/20 text-rose-300 font-bold border border-rose-400/30">
                Pendiente $
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-rose-300 font-mono">{kpiCounts.sinPrecio}</span>
            <span className="text-xs text-slate-400">comprobantes a valorizar ($0)</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {kpiFilter === 'sin_precio' ? '✓ Filtro activo (Clic para ver todos)' : 'Clic para filtrar comprobantes $0'}
          </p>
        </button>

        {/* Alerta 3: RPF Pendiente de Factura (Púrpura) */}
        <button
          type="button"
          onClick={() => setKpiFilter(kpiFilter === 'RPF' ? 'todos' : 'RPF')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            kpiFilter === 'RPF'
              ? 'bg-purple-950/80 border-purple-400 shadow-lg shadow-purple-500/20 ring-2 ring-purple-400'
              : 'bg-slate-900/80 border-slate-800 hover:border-purple-500/40 hover:bg-slate-850'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-purple-400" />
              RPF Pdte. Factura
            </span>
            {kpiCounts.rpf > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-300 font-bold border border-purple-400/30">
                Reclamar
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-purple-300 font-mono">{kpiCounts.rpf}</span>
            <span className="text-xs text-slate-400">remitos sin factura oficial</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {kpiFilter === 'RPF' ? '✓ Filtro activo (Clic para ver todos)' : 'Clic para exigir factura oficial'}
          </p>
        </button>

        {/* Alerta 4: FCR Facturado Definitivo (Esmeralda / Verde) */}
        <button
          type="button"
          onClick={() => setKpiFilter(kpiFilter === 'FCR' ? 'todos' : 'FCR')}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            kpiFilter === 'FCR'
              ? 'bg-emerald-950/80 border-emerald-400 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-400'
              : 'bg-slate-900/80 border-slate-800 hover:border-emerald-500/40 hover:bg-slate-850'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <FileCheck className="w-4 h-4 text-emerald-400" />
              FCR Facturado
            </span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 font-bold border border-emerald-400/30">
              Definitivo
            </span>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-emerald-300 font-mono">{kpiCounts.fcr}</span>
            <span className="text-xs text-slate-400">facturas fiscales oficiales</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {kpiFilter === 'FCR' ? '✓ Filtro activo (Clic para ver todos)' : 'Clic para filtrar solo facturados'}
          </p>
        </button>
      </div>
    </div>
  )
}
