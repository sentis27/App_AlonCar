import React, { useState } from 'react'
import { DONUT_PALETTE } from '../../lib/drydockCatalogConstants'

/**
 * Gráfico de anillo SVG reutilizable sin dependencias externas.
 * Soporta tooltip flotante limpio al pasar el mouse y leyenda compacta.
 */
export default function SvgDonutCard({
  title,
  subtitle = '',
  segments = [],
  centerLabel = '',
  centerValue = '',
  valueFormatter = (v) => v.toLocaleString('es-AR', { maximumFractionDigits: 1 }),
  emptyMessage = 'Sin datos cargados para este período',
  size = 118
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  const total = segments.reduce((acc, s) => acc + (Number(s.value) || 0), 0)
  const strokeWidth = 18
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  let cumulativeOffset = 0
  const arcs = segments.map((seg, idx) => {
    const ratio = total > 0 ? (Number(seg.value) || 0) / total : 0
    const dashLength = Math.max(0, ratio * circumference - (segments.length > 1 ? 1.8 : 0))
    const offset = -cumulativeOffset
    cumulativeOffset += ratio * circumference
    return {
      ...seg,
      color: seg.color || DONUT_PALETTE[idx % DONUT_PALETTE.length],
      dashArray: `${dashLength} ${circumference}`,
      dashOffset: offset
    }
  })

  const hoveredArc = hoveredIdx !== null ? arcs[hoveredIdx] : null

  return (
    <div className="bg-slate-900/80 border border-slate-700/70 rounded-xl p-3 flex flex-col justify-between relative hover:border-cyan-500/40 transition-colors">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="min-w-0">
          <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-200 truncate">
            {title}
          </h4>
          {subtitle && (
            <p className="text-[10px] text-slate-400 truncate">{subtitle}</p>
          )}
        </div>
        {hoveredArc && (
          <span
            className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-800 border border-slate-600/80 text-slate-100 shrink-0 tabular-nums"
            title={`${hoveredArc.label}: ${valueFormatter(hoveredArc.value)} (${hoveredArc.pct}%)`}
          >
            {hoveredArc.pct}%
          </span>
        )}
      </div>

      {total <= 0 || arcs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-4 text-center">
          <div className="w-16 h-16 rounded-full border-[6px] border-dashed border-slate-800 flex items-center justify-center text-[10px] text-slate-500">
            0%
          </div>
          <span className="text-[11px] text-slate-500 mt-2">{emptyMessage}</span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="relative shrink-0" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
              <circle
                cx={center}
                cy={center}
                r={radius}
                fill="none"
                stroke="#1e293b"
                strokeWidth={strokeWidth}
              />
              {arcs.map((arc, idx) => (
                <circle
                  key={`${arc.label}-${idx}`}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={hoveredIdx === idx ? strokeWidth + 3 : strokeWidth}
                  strokeDasharray={arc.dashArray}
                  strokeDashoffset={arc.dashOffset}
                  strokeLinecap="butt"
                  className="cursor-pointer transition-all duration-150"
                  opacity={hoveredIdx === null || hoveredIdx === idx ? 1 : 0.45}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
              <span className="text-[9px] uppercase tracking-wider text-slate-400 leading-tight truncate max-w-[74px]">
                {hoveredArc ? hoveredArc.label : centerLabel}
              </span>
              <span className="text-[11px] font-bold text-slate-100 tabular-nums leading-tight mt-0.5 truncate max-w-[78px]">
                {hoveredArc ? valueFormatter(hoveredArc.value) : centerValue}
              </span>
            </div>
          </div>

          <ul className="flex-1 min-w-0 space-y-1">
            {arcs.map((arc, idx) => (
              <li
                key={`${arc.label}-leg-${idx}`}
                onMouseEnter={() => setHoveredIdx(idx)}
                onMouseLeave={() => setHoveredIdx(null)}
                className={`flex items-center justify-between gap-1.5 text-[11px] px-1.5 py-0.5 rounded cursor-pointer transition-colors ${
                  hoveredIdx === idx ? 'bg-slate-800/90 text-white' : 'text-slate-300'
                }`}
              >
                <span className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: arc.color }}
                  />
                  <span className="truncate">{arc.label}</span>
                </span>
                <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                  {arc.pct}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
