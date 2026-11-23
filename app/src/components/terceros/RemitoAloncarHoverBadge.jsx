/**
 * RemitoAloncarHoverBadge.jsx
 * Tooltip interactivo en Portal para `Nº Remito AlonCar` en Terceros.
 * Al acercar el mouse, muestra todos los materiales imputados a ese remito en Pañol
 * (Cantidad · Nombre del material · Kilos si corresponde) y alerta si existe
 * incongruencia entre la OT de Pañol y la OT de Terceros.
 */

import React, { useState, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { Package, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { evaluateRemitoMatch } from '../../lib/tercerosRemitoMatcher.js'

function computePopoverCoords(rect) {
  const width = 370
  const estHeight = 250
  const margin = 12
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800

  let left = rect.left
  if (left + width > vw - margin) {
    left = Math.max(margin, vw - width - margin)
  }
  if (left < margin) left = margin

  const spaceBelow = vh - rect.bottom - margin
  const openUp = spaceBelow < estHeight && rect.top > estHeight
  const style = openUp
    ? { position: 'fixed', left, bottom: Math.max(margin, vh - rect.top + 8), width, zIndex: 9999 }
    : { position: 'fixed', left, top: Math.min(vh - margin - 80, rect.bottom + 8), width, zIndex: 9999 }

  return style
}

export function RemitoOtMismatchAlert({ match, compact = false }) {
  if (!match?.hasOtMismatch) return null
  if (compact) {
    return (
      <div
        className="mt-0.5 flex items-center gap-1 text-[9px] font-sans font-bold text-amber-300 bg-amber-950/70 border border-amber-500/50 rounded px-1.5 py-0.5 leading-tight"
        title={match.mismatchMessage}
      >
        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
        <span className="truncate">OT Pañol ≠ Terceros</span>
      </div>
    )
  }

  return (
    <div className="mt-1.5 px-2.5 py-1.5 rounded-lg bg-amber-950/70 border border-amber-500/60 text-amber-200 text-[11px] flex items-start gap-2 leading-snug">
      <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
      <div>
        <span className="font-black text-amber-300 block">Incongruencia de Orden de Trabajo (Pañol vs Terceros)</span>
        <span>{match.mismatchMessage}</span>
      </div>
    </div>
  )
}

export default function RemitoAloncarHoverBadge({
  remitoNumber,
  tercerosWorkOrderId = null,
  remitoIndex = null,
  otMap = null,
  children,
  className = '',
  showInlineMismatch = false,
  compactMismatch = false,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const anchorRef = useRef(null)

  const match = useMemo(
    () => evaluateRemitoMatch({ remitoNumber, tercerosWorkOrderId, remitoIndex, otMap }),
    [remitoNumber, tercerosWorkOrderId, remitoIndex, otMap]
  )

  const handleMouseEnter = () => {
    if (!match.hasRemito || !anchorRef.current) return
    const rect = anchorRef.current.getBoundingClientRect()
    setCoords(computePopoverCoords(rect))
    setIsOpen(true)
  }

  const handleMouseLeave = () => {
    setIsOpen(false)
  }

  return (
    <div
      ref={anchorRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className={className}
    >
      {children}
      {showInlineMismatch && <RemitoOtMismatchAlert match={match} compact={compactMismatch} />}

      {isOpen && match.hasRemito && coords && typeof document !== 'undefined' && createPortal(
        <div
          style={{ ...coords, backgroundColor: '#020617' }}
          className="pointer-events-none rounded-xl bg-slate-950 border border-cyan-500/70 shadow-2xl shadow-black text-xs font-sans overflow-hidden"
        >
          <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <Package className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="font-black text-cyan-300 truncate">
                PAÑOL · Remito #{String(remitoNumber || '').trim()}
              </span>
            </div>
            <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-500/50 text-cyan-200 font-mono text-[10px] font-bold shrink-0">
              {match.items.length} {match.items.length === 1 ? 'material' : 'materiales'}
            </span>
          </div>

          <div className="p-2.5 space-y-2 max-h-60 overflow-y-auto bg-slate-950">
            {!match.hasMatches ? (
              <p className="text-[11px] text-slate-400 italic py-1">
                Sin materiales cargados en Pañol con el Remito #{String(remitoNumber || '').trim()}.
              </p>
            ) : (
              <>
                <ul className="space-y-1.5">
                  {match.items.map((item) => {
                    const itemDiffers = String(item.workOrderId || '') !== String(tercerosWorkOrderId || '')
                    return (
                      <li
                        key={item.id}
                        className={`px-2 py-1.5 rounded-lg border text-[11px] ${
                          itemDiffers
                            ? 'bg-amber-950 border-amber-500/60'
                            : 'bg-slate-900 border-slate-800'
                        }`}
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <div className="min-w-0 flex items-baseline gap-1.5">
                            <span className="font-mono font-black text-emerald-300 shrink-0">
                              {item.quantityLabel}
                            </span>
                            <span className="font-semibold text-white truncate">
                              {item.materialName}
                            </span>
                          </div>
                          {item.weightLabel && (
                            <span className="font-mono font-bold text-cyan-300 text-[10px] px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-500/40 shrink-0">
                              {item.weightLabel}
                            </span>
                          )}
                        </div>
                        <div className="mt-0.5 flex items-center justify-between gap-2 text-[10px] text-slate-400">
                          <span className="truncate">
                            OT Pañol: <strong className={itemDiffers ? 'text-amber-300' : 'text-slate-300'}>{item.workOrderLabel}</strong>
                          </span>
                          <span className="shrink-0 text-slate-500">{item.shipName}</span>
                        </div>
                      </li>
                    )
                  })}
                </ul>

                {match.hasOtMismatch ? (
                  <div className="p-2 rounded-lg bg-amber-950 border border-amber-500/70 text-amber-200 text-[10.5px] flex items-start gap-1.5 leading-snug">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      <strong className="text-amber-300">Incongruencia de OT:</strong> {match.mismatchMessage}
                    </span>
                  </div>
                ) : (
                  <div className="px-2 py-1 rounded-lg bg-emerald-950 border border-emerald-500/50 text-emerald-300 text-[9.5px] flex items-center gap-1.5 font-semibold leading-tight">
                    <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                    <span className="leading-tight">
                      OT OK con Pañol ({match.tercerosWorkOrderLabel}){match.panolContractorSummary ? ` - ${match.panolContractorSummary}` : ''}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
