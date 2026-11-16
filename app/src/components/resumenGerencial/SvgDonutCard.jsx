import React, { useState } from 'react'
import { DONUT_PALETTE } from '../../lib/drydockCatalogConstants'

/**
 * Gráfico de anillo SVG limpio (estilo Imagen 3 e Imagen 4):
 * - Anillo limpio sin leyenda inferior/lateral cuando `showLegend = false` (por defecto).
 * - El centro conserva el total global legible y ampliado.
 * - Al acercar el mouse a cualquier segmento, despliega un tooltip flotante completo
 *   con Nombre completo (nunca truncado en el centro), cuadro de color, valor formateado y porcentaje.
 */
export default function SvgDonutCard({
  title,
  subtitle = '',
  segments = [],
  centerLabel = '',
  centerValue = '',
  valueFormatter = (v) => v.toLocaleString('es-AR', { maximumFractionDigits: 1 }),
  emptyMessage = 'Sin datos cargados',
  size = 152,
  strokeWidth = 22,
  showLegend = false,
  layout = 'vertical',
  compact = false
}) {
  const [hoveredIdx, setHoveredIdx] = useState(null)

  const total = segments.reduce((acc, s) => acc + (Number(s.value) || 0), 0)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const center = size / 2

  let cumulativeOffset = 0
  let cumulativeRatio = 0
  const arcs = segments.map((seg, idx) => {
    const ratio = total > 0 ? (Number(seg.value) || 0) / total : 0
    const dashLength = Math.max(0, ratio * circumference - (segments.length > 1 ? 1.8 : 0))
    const offset = -cumulativeOffset
    const midRatio = cumulativeRatio + ratio / 2
    cumulativeOffset += ratio * circumference
    cumulativeRatio += ratio

    // Ángulo medio del arco (0 rad = arriba 12h por el -rotate-90)
    const angleRad = midRatio * 2 * Math.PI - Math.PI / 2
    const tipRadius = radius + strokeWidth * 0.25
    const anchorX = center + Math.cos(angleRad) * tipRadius
    const anchorY = center + Math.sin(angleRad) * tipRadius

    return {
      ...seg,
      color: seg.color || DONUT_PALETTE[idx % DONUT_PALETTE.length],
      dashArray: `${dashLength} ${circumference}`,
      dashOffset: offset,
      anchorX,
      anchorY,
      isRightHalf: Math.cos(angleRad) >= 0,
      isBottomHalf: Math.sin(angleRad) >= 0
    }
  })

  const hoveredArc = hoveredIdx !== null ? arcs[hoveredIdx] : null
  const isVertical = layout === 'vertical'

  return (
    <div
      className={`bg-slate-900/80 border rounded-xl ${compact ? 'p-2.5' : 'p-3'} flex flex-col justify-between relative transition-colors h-full ${
        hoveredArc ? 'z-30 border-cyan-400/70' : 'border-slate-700/70 hover:border-cyan-500/40'
      }`}
    >
      <div className={`flex items-center justify-between gap-1.5 ${compact ? 'mb-1' : 'mb-2'}`}>
        <div className="min-w-0">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-100 truncate">
            {title}
          </h4>
          {subtitle && !compact && (
            <p className="text-[11px] text-slate-400 truncate">{subtitle}</p>
          )}
        </div>
        {hoveredArc && (
          <span className="text-[11px] font-mono font-extrabold px-1.5 py-0.5 rounded bg-slate-800 border border-cyan-500/50 text-cyan-200 shrink-0 tabular-nums">
            {hoveredArc.pct}%
          </span>
        )}
      </div>

      {total <= 0 || arcs.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-3 text-center">
          <div className="w-16 h-16 rounded-full border-[5px] border-dashed border-slate-800 flex items-center justify-center text-xs text-slate-500 font-bold">
            0%
          </div>
          <span className="text-xs text-slate-500 mt-1.5">{emptyMessage}</span>
        </div>
      ) : (
        <div
          className={`flex ${
            isVertical
              ? 'flex-col items-center justify-center flex-1'
              : 'items-center justify-center gap-3 flex-1'
          }`}
        >
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
                  strokeWidth={hoveredIdx === idx ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={arc.dashArray}
                  strokeDashoffset={arc.dashOffset}
                  strokeLinecap="butt"
                  className="cursor-pointer transition-all duration-150"
                  opacity={hoveredIdx === null || hoveredIdx === idx ? 1 : 0.38}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                />
              ))}
            </svg>

            {/* Centro limpio siempre legible con el total global */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 leading-tight truncate max-w-[96px]">
                {centerLabel}
              </span>
              <span className="text-sm font-black text-white tabular-nums leading-tight mt-0.5 truncate max-w-[104px]">
                {centerValue}
              </span>
            </div>

            {/* Tooltip flotante estilo Imagen 3: Nombre completo + Swatch + Valor (%) */}
            {hoveredArc && (
              <div
                className="absolute z-50 pointer-events-none min-w-[195px] max-w-[270px] bg-slate-950/95 border border-slate-500/90 rounded-lg px-3 py-2 shadow-2xl shadow-black/90 backdrop-blur-md"
                style={{
                  left: hoveredArc.isRightHalf ? '50%' : 'auto',
                  right: hoveredArc.isRightHalf ? 'auto' : '50%',
                  top: hoveredArc.isBottomHalf ? 'auto' : Math.max(-8, hoveredArc.anchorY - 14),
                  bottom: hoveredArc.isBottomHalf ? Math.max(-8, size - hoveredArc.anchorY - 14) : 'auto',
                  transform: hoveredArc.isRightHalf ? 'translateX(-15%)' : 'translateX(15%)'
                }}
              >
                <div className="text-xs font-extrabold text-white leading-snug break-words">
                  {hoveredArc.label}
                </div>
                <div className="mt-1 flex items-center gap-2 text-xs font-bold tabular-nums">
                  <span
                    className="w-3 h-3 rounded-sm shrink-0 border border-white/25"
                    style={{ backgroundColor: hoveredArc.color }}
                  />
                  <span className="text-cyan-200">{valueFormatter(hoveredArc.value)}</span>
                  <span className="text-slate-300">({hoveredArc.pct}%)</span>
                </div>
              </div>
            )}
          </div>

          {showLegend && (
            <ul className={isVertical ? 'w-full grid grid-cols-2 gap-x-2 gap-y-0.5 mt-2' : 'flex-1 min-w-0 space-y-0.5'}>
              {arcs.map((arc, idx) => (
                <li
                  key={`${arc.label}-leg-${idx}`}
                  onMouseEnter={() => setHoveredIdx(idx)}
                  onMouseLeave={() => setHoveredIdx(null)}
                  className={`flex items-center justify-between gap-1 text-[11px] px-1 py-0.5 rounded cursor-pointer transition-colors ${
                    hoveredIdx === idx ? 'bg-slate-800/90 text-white' : 'text-slate-300'
                  }`}
                  title={`${arc.label}: ${valueFormatter(arc.value)} (${arc.pct}%)`}
                >
                  <span className="flex items-center gap-1 min-w-0">
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
          )}
        </div>
      )}
    </div>
  )
}
