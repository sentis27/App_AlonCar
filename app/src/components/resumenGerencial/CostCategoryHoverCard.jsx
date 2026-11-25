import React from 'react'
import { Clock, Package, Wrench } from 'lucide-react'
import { formatUsd } from '../../lib/drydockCatalogConstants'
import CostHoverMaterialsSection from './CostHoverMaterialsSection'

function formatHoursClean(val) {
  const n = Number(val) || 0
  return n.toLocaleString('es-AR', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 1,
    maximumFractionDigits: 2
  })
}

const WORK_TYPE_BADGE = {
  PRC: 'bg-purple-950/90 text-purple-200 border-purple-500/60',
  HH: 'bg-cyan-950/90 text-cyan-200 border-cyan-500/60'
}

/**
 * Tarjeta flotante de previsualización resumida al acercar el mouse a las filas de costo
 * en Resumen Gerencial (GS-004), siguiendo la línea estética de `WorkOrderScopeHoverCard`
 * y `ZeroCostAlertHoverCard`.
 */
export default function CostCategoryHoverCard({
  mode = 'MATERIALES',
  scope = 'GENERAL',
  title,
  subtitle = '',
  summaryData = null,
  className = ''
}) {
  const isOt = scope === 'OT'
  const accentBorder = isOt ? 'border-violet-500/65' : 'border-cyan-500/65'
  const badgeStyle = isOt
    ? 'bg-violet-950 text-violet-300 border-violet-700'
    : 'bg-cyan-950 text-cyan-300 border-cyan-700'

  const Icon = mode === 'HORAS' || mode === 'EQUIPO' ? Clock : mode === 'TERCEROS' ? Wrench : Package

  return (
    <div
      className={`p-3 bg-slate-950/95 rounded-xl border-2 ${accentBorder} text-xs text-slate-200 space-y-2.5 shadow-2xl shadow-black/80 backdrop-blur-md ${className}`}
    >
      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className={`p-1.5 rounded-lg border shrink-0 ${badgeStyle}`}>
            <Icon className="w-4 h-4" />
          </span>
          <div className="min-w-0">
            <div className="font-extrabold text-white text-[13px] truncate">{title}</div>
            {subtitle && <div className="text-[11px] text-slate-400 truncate">{subtitle}</div>}
          </div>
        </div>
        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 shrink-0">
          Clic abre hoja ↗
        </span>
      </div>

      {mode === 'HORAS' && (() => {
        const items = summaryData?.items || []
        const totalHours = summaryData?.totalHours || 0
        if (items.length === 0) {
          return <div className="py-3 text-center text-slate-500">Sin horas cargadas en este estado.</div>
        }
        return (
          <>
            <div className="max-h-[48vh] overflow-y-auto pr-1 divide-y divide-slate-800/70">
              {items.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-[54px_54px_1fr] items-center gap-2 py-1.5 px-1.5 hover:bg-slate-900/70 rounded"
                >
                  <span className="font-mono text-sm font-black text-white text-right tabular-nums">
                    {formatHoursClean(row.hours)}
                  </span>
                  <span
                    className={`text-center font-mono text-[10.5px] font-black px-1.5 py-0.5 rounded border ${
                      WORK_TYPE_BADGE[row.workTypeCode] || WORK_TYPE_BADGE.HH
                    }`}
                  >
                    {row.workTypeCode}
                  </span>
                  <span className="font-bold text-slate-100 truncate tracking-wide" title={row.actorLabel}>
                    {row.actorLabel}
                  </span>
                </div>
              ))}
            </div>
            <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">{items.length} {items.length === 1 ? 'grupo' : 'grupos'} · PRC = Presupuesto ($0 · en Terceros)</span>
              <span className="font-mono font-black text-cyan-300 tabular-nums">Total: {formatHoursClean(totalHours)} hs</span>
            </div>
          </>
        )
      })()}

      {mode === 'EQUIPO' && (() => {
        const items = summaryData?.items || []
        const totalHours = summaryData?.totalHours || 0
        if (items.length === 0) {
          return <div className="py-3 text-center text-slate-500">Sin horas de esta grúa cargadas en este alcance.</div>
        }
        return (
          <>
            <div className="max-h-[48vh] overflow-y-auto pr-1 divide-y divide-slate-800/70">
              {items.map((row) => (
                <div
                  key={row.id}
                  className="grid grid-cols-[68px_1fr] items-start gap-2.5 py-1.5 px-1.5 hover:bg-slate-900/70 rounded"
                >
                  <span className="font-mono text-sm font-black text-cyan-200 text-right tabular-nums shrink-0">
                    {formatHoursClean(row.hours)} hs
                  </span>
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-100 leading-snug break-words">{row.comment}</div>
                    {(row.date || row.otLabel) && (
                      <div className="text-[10.5px] text-slate-400 truncate mt-0.5">
                        {[row.date, row.otLabel].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">{items.length} {items.length === 1 ? 'línea cargada' : 'líneas cargadas'}</span>
              <span className="font-mono font-black text-cyan-300 tabular-nums">Total: {formatHoursClean(totalHours)} hs</span>
            </div>
          </>
        )
      })()}

      {mode === 'MATERIALES' && <CostHoverMaterialsSection summaryData={summaryData} />}

      {mode === 'TERCEROS' && (() => {
        const items = summaryData?.items || []
        const totalUsd = summaryData?.totalUsd || 0
        const zeroCount = summaryData?.zeroCount || 0
        if (items.length === 0) {
          return <div className="py-3 text-center text-slate-500">Sin servicios de terceros cargados.</div>
        }
        return (
          <>
            <div className="max-h-[48vh] overflow-y-auto pr-1 divide-y divide-slate-800/70">
              {items.map((row) => (
                <div
                  key={row.contractorName}
                  className="grid grid-cols-[1fr_118px] items-center gap-2 py-1.5 px-1.5 hover:bg-slate-900/70 rounded"
                >
                  <div className="min-w-0 flex items-center gap-1.5">
                    <span className="font-bold text-slate-100 truncate" title={row.contractorName}>{row.contractorName}</span>
                    {row.count > 1 && <span className="text-[10px] font-mono text-slate-400 shrink-0">({row.count})</span>}
                  </div>
                  {row.isZeroCost ? (
                    <span className="text-right font-mono text-[11px] font-bold text-amber-300 bg-amber-950/50 border border-amber-500/40 rounded px-1.5 py-0.5 tabular-nums justify-self-end">
                      Sin valor ($0)
                    </span>
                  ) : (
                    <span className="text-right font-mono text-xs font-extrabold text-emerald-300 tabular-nums">
                      {formatUsd(row.totalUsd)}
                    </span>
                  )}
                </div>
              ))}
            </div>
            <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
              <span className="text-slate-400">
                {items.length} {items.length === 1 ? 'taller' : 'talleres'}
                {zeroCount > 0 ? ` · ${zeroCount} sin valor al final` : ''}
              </span>
              <span className="font-mono font-black text-emerald-300 tabular-nums">Total: {formatUsd(totalUsd)}</span>
            </div>
          </>
        )
      })()}
    </div>
  )
}
