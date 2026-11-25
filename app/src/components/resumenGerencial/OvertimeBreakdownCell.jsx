import React, { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Clock } from 'lucide-react'
import { computeStepHelpPosition } from '../../lib/stepHelpPosition.js'
import { formatUsd } from '../../lib/drydockCatalogConstants.js'

/**
 * OvertimeBreakdownCell
 * Muestra la suma de Horas Extra convertidas a su valor de referencia en horas normales
 * (`0` si no hubo extras) y abre una tarjeta flotante estilo "factura" al acercar el mouse
 * explicando el desglose exacto (50% × 1,5 y 100% × 2,0 en Astillero; × 1,0 en Contratistas).
 */
export default function OvertimeBreakdownCell({ row }) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const triggerRef = useRef(null)
  const closeTimerRef = useRef(null)

  const extraEquiv = Number(row?.hoursExtraEquiv) || 0
  const extraPhys = Number(row?.hoursExtraPhysical) || 0
  const h50 = Number(row?.hours50) || 0
  const h100 = Number(row?.hours100) || 0
  const h50Equiv = Number(row?.hoursExtra50Equiv) || 0
  const h100Equiv = Number(row?.hoursExtra100Equiv) || 0
  const hNorm = Number(row?.hoursNormal) || 0
  const totalEquiv = Number(row?.hoursEquiv) || 0
  const isContractor = Boolean(row?.isContractor)
  const hasExtra = extraEquiv > 0 || extraPhys > 0

  const updatePos = useCallback(() => {
    const el = triggerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const next = computeStepHelpPosition({
      rect,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      placement: 'auto',
      estimatedHeight: hasExtra ? 210 : 90
    })
    setCoords(next)
  }, [hasExtra])

  const clearTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  useEffect(() => () => clearTimer(), [clearTimer])

  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('resize', updatePos)
    window.addEventListener('scroll', updatePos, true)
    return () => {
      window.removeEventListener('resize', updatePos)
      window.removeEventListener('scroll', updatePos, true)
    }
  }, [open, updatePos])

  const handleEnter = () => {
    clearTimer()
    setOpen(true)
  }

  const handleLeave = () => {
    clearTimer()
    closeTimerRef.current = setTimeout(() => setOpen(false), 80)
  }

  return (
    <span
      ref={triggerRef}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      className={`inline-flex items-center justify-end px-1.5 py-0.5 rounded tabular-nums cursor-help transition-colors ${
        hasExtra
          ? 'bg-amber-500/15 border border-amber-400/40 text-amber-200 font-bold hover:bg-amber-500/25'
          : 'text-slate-500 hover:text-slate-300'
      }`}
    >
      {extraEquiv}

      {open && coords && typeof document !== 'undefined' && createPortal(
        <div
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
          style={{
            position: 'fixed',
            left: `${coords.left}px`,
            ...(coords.direction === 'up'
              ? { bottom: `${coords.bottom}px` }
              : { top: `${coords.top}px` }),
            width: `${Math.min(coords.width, 320)}px`
          }}
          className="z-[9999] p-3 rounded-xl bg-slate-950/98 border border-amber-400/55 shadow-2xl shadow-slate-950/90 text-[11px] text-slate-200 space-y-2 backdrop-blur-md font-sans text-left"
        >
          <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-black text-white uppercase tracking-wide text-[10.5px]">
              Desglose Horas Extra (Ref. Normal)
            </span>
          </div>

          {!hasExtra ? (
            <p className="text-slate-400 leading-snug">
              Sin horas extra registradas en este parte ({hNorm} hs normales).
            </p>
          ) : (
            <div className="space-y-1.5 font-mono text-[11px]">
              <div className="flex items-center justify-between text-cyan-200">
                <span>Extras al 50% ({h50} hs × {isContractor ? '1,0' : '1,5'}):</span>
                <strong>{h50Equiv} hs</strong>
              </div>
              <div className="flex items-center justify-between text-amber-200">
                <span>Extras al 100% ({h100} hs × {isContractor ? '1,0' : '2,0'}):</span>
                <strong>{h100Equiv} hs</strong>
              </div>
              <div className="border-t border-slate-800 pt-1.5 flex items-center justify-between text-white">
                <span className="font-sans font-bold text-[10.5px]">Total Hs Extra (ref. normal):</span>
                <strong className="text-amber-300">{extraEquiv} hs</strong>
              </div>
              <div className="text-[10px] text-slate-400 font-sans leading-snug pt-0.5 border-t border-slate-800/70">
                Hs reales extra: <strong className="text-slate-200">{extraPhys} hs</strong> ({h50} al 50% + {h100} al 100%).
                <br />
                Liquidación: <strong className="text-emerald-300">{hNorm} norm. + {extraEquiv} extra = {totalEquiv} hs</strong>
                {row?.isPresupuesto
                  ? ' · Presupuesto ($0)'
                  : ` × ${formatUsd(row?.hourlyRateUsd)} = ${formatUsd(row?.costUsd)}`}
              </div>
            </div>
          )}
        </div>,
        document.body
      )}
    </span>
  )
}
