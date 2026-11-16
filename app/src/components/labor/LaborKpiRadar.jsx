import React from 'react'
import { AlertCircle, AlertTriangle, Clock, FileText, X } from 'lucide-react'

/**
 * ZONA 2 CANÓNICA DE /horas: Radar de KPIs y Alertas Operativas.
 * Cromatismo único por tarjeta, sin palabra "Filtrar".
 */
export default function LaborKpiRadar({
  countSinOt = 0,
  countR = 0,
  countRR = 0,
  incompleteCount = 0,
  countSinPrc = 0,
  activeKpiFilter = 'todos',
  onToggleKpiFilter
}) {
  const cards = [
    {
      key: 'sin_ot',
      label: 'Falta Cargar OT',
      count: countSinOt,
      unit: 'sin OT',
      icon: AlertCircle,
      title: 'Imputaciones guardadas con Orden de Trabajo en blanco',
      idleCls: 'bg-orange-950/25 border-orange-500/40 hover:border-orange-400/80',
      activeCls: 'bg-orange-950/85 border-orange-400 ring-2 ring-orange-400/70',
      titleCls: 'text-orange-300',
      numCls: 'text-orange-400'
    },
    {
      key: 'revision_R',
      label: 'Requiere Revisión (R)',
      count: countR,
      unit: 'alertas',
      icon: AlertTriangle,
      title: 'Registros marcados con R que requieren revisión o descargo',
      idleCls: 'bg-rose-950/25 border-rose-500/40 hover:border-rose-400/80',
      activeCls: 'bg-rose-950/85 border-rose-400 ring-2 ring-rose-400/70',
      titleCls: 'text-rose-300',
      numCls: 'text-rose-400'
    },
    {
      key: 'corregidas_RR',
      label: 'Horas Corregidas (RR)',
      count: countRR,
      unit: 'revisadas',
      icon: Clock,
      title: 'Registros ya corregidos y pendientes de aprobación final',
      idleCls: 'bg-amber-950/25 border-amber-500/40 hover:border-amber-400/80',
      activeCls: 'bg-amber-950/85 border-amber-400 ring-2 ring-amber-400/70',
      titleCls: 'text-amber-300',
      numCls: 'text-amber-400'
    },
    {
      key: 'incompleta',
      label: 'Jornada Incompleta',
      count: incompleteCount,
      unit: '<9hs',
      icon: Clock,
      title: 'Operarios propios de Astillero con menos de 9hs normales (u 8hs en feriado)',
      idleCls: 'bg-blue-950/25 border-blue-500/40 hover:border-blue-400/80',
      activeCls: 'bg-blue-950/85 border-blue-400 ring-2 ring-blue-400/70',
      titleCls: 'text-blue-300',
      numCls: 'text-blue-400'
    },
    {
      key: 'sin_prc',
      label: 'Sin PRC Vinculado',
      count: countSinPrc,
      unit: 'sin PRC',
      icon: FileText,
      title: 'Horas bajo modalidad Presupuesto sin código PRC asociado',
      idleCls: 'bg-purple-950/25 border-purple-500/40 hover:border-purple-400/80',
      activeCls: 'bg-purple-950/85 border-purple-400 ring-2 ring-purple-400/70',
      titleCls: 'text-purple-300',
      numCls: 'text-purple-400'
    }
  ]

  return (
    <div className="alon-zone-kpis py-2.5 px-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 px-1">
        <div className="flex flex-wrap items-baseline gap-2.5">
          <span className="text-xs sm:text-sm font-black uppercase tracking-wider text-amber-400">
            📊 RADAR DE KPIS Y ALERTAS OPERATIVAS
          </span>
          <span className="text-[11px] italic text-slate-400">
            • Clic en cualquier tarjeta para acotar la planilla
          </span>
        </div>
        {activeKpiFilter !== 'todos' && (
          <button
            type="button"
            onClick={() => onToggleKpiFilter('todos')}
            className="px-2.5 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
            <span>Quitar Filtro KPI</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
        {cards.map((c) => {
          const Icon = c.icon
          const isActive = activeKpiFilter === c.key
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => onToggleKpiFilter(isActive ? 'todos' : c.key)}
              title={c.title}
              className={`py-2 px-3 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
                isActive ? c.activeCls : c.idleCls
              }`}
            >
              <div className="min-w-0">
                <span className={`text-xs font-extrabold flex items-center gap-1.5 truncate ${c.titleCls}`}>
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{c.label}</span>
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">{c.unit}</span>
              </div>
              <span className={`text-xl font-black font-mono leading-none shrink-0 ${c.numCls}`}>
                {c.count}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
