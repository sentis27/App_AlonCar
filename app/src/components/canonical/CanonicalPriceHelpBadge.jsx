import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { HelpCircle, Lock } from 'lucide-react'
import { computeStepHelpPosition } from '../../lib/stepHelpPosition.js'
import { DEFAULT_MATERIAL_PRICING_POLICY, getFortnightPeriodKey } from '../../lib/materialPricingPolicy.js'
import { getTodayArIso } from '../../lib/dateTimeCanonical.js'

/**
 * CanonicalPriceHelpBadge
 * Signo de pregunta (?) flotante en portal (`document.body`, Zero-Scroll)
 * exclusivo para Administrador: explica la fórmula y el congelamiento quincenal de precios.
 */
export default function CanonicalPriceHelpBadge({
  isAdmin = false,
  pricingPolicy = null,
  dollarRate = 1500,
  periodKey = null,
  size = 'sm',
  className = ''
}) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [coords, setCoords] = useState(null)
  const buttonRef = useRef(null)
  const popoverRef = useRef(null)
  const closeTimerRef = useRef(null)

  const policy = pricingPolicy || DEFAULT_MATERIAL_PRICING_POLICY
  const activePeriod = periodKey || getFortnightPeriodKey(getTodayArIso()) || 'Quincena actual'
  const visible = isAdmin && (open || pinned)

  const updatePosition = useCallback(() => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const next = computeStepHelpPosition({
      rect,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      placement: 'auto',
      estimatedHeight: 215
    })
    setCoords(next)
  }, [])

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
  }, [])

  const scheduleHoverClose = useCallback(() => {
    clearCloseTimer()
    closeTimerRef.current = setTimeout(() => {
      if (!pinned) setOpen(false)
    }, 90)
  }, [clearCloseTimer, pinned])

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer])

  useEffect(() => {
    if (!visible) return
    updatePosition()
    const onMove = () => updatePosition()
    window.addEventListener('resize', onMove)
    window.addEventListener('scroll', onMove, true)
    return () => {
      window.removeEventListener('resize', onMove)
      window.removeEventListener('scroll', onMove, true)
    }
  }, [visible, updatePosition])

  useEffect(() => {
    if (!pinned) return
    const onOutside = (e) => {
      if (!buttonRef.current?.contains(e.target) && !popoverRef.current?.contains(e.target)) {
        setPinned(false)
        setOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setPinned(false)
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onOutside)
      window.removeEventListener('keydown', onKey)
    }
  }, [pinned])

  if (!isAdmin) return null

  const iconCls = size === 'xs' ? 'w-3.5 h-3.5' : 'w-4 h-4'

  return (
    <span
      className={`inline-flex items-center align-middle ${className}`}
      onMouseEnter={() => { clearCloseTimer(); setOpen(true) }}
      onMouseLeave={scheduleHoverClose}
    >
      <button
        ref={buttonRef}
        type="button"
        tabIndex={-1}
        aria-label="Regla de precios y congelamiento quincenal"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation()
          clearCloseTimer()
          const next = !pinned
          setPinned(next)
          setOpen(next)
        }}
        className={`inline-flex items-center justify-center rounded-full transition-colors cursor-pointer ${
          visible
            ? 'text-amber-300'
            : 'text-cyan-400/80 hover:text-amber-300'
        }`}
      >
        <HelpCircle className={iconCls} />
      </button>

      {visible && coords && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleHoverClose}
          style={{
            position: 'fixed',
            left: `${coords.left}px`,
            ...(coords.direction === 'up' ? { bottom: `${coords.bottom}px` } : { top: `${coords.top}px` }),
            width: `${coords.width}px`,
            maxHeight: `${coords.maxHeight}px`
          }}
          className="z-[9999] p-3.5 rounded-xl bg-slate-950/98 border border-cyan-400/65 shadow-2xl shadow-cyan-950/80 text-[11px] text-slate-200 space-y-2 backdrop-blur-md overflow-y-auto font-sans"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
            <span className="font-black text-amber-300 uppercase tracking-wide text-[10.5px] flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Regla Quincenal de Precios</span>
            </span>
            <span className="font-mono text-[9.5px] px-1.5 py-0.5 rounded bg-cyan-950/80 border border-cyan-500/40 text-cyan-300 font-bold">
              {activePeriod} · ${Number(dollarRate || 1500).toLocaleString('es-AR')}
            </span>
          </div>

          <p className="leading-snug text-slate-200">{policy.ruleSummaryText}</p>

          <ul className="space-y-1 text-[10.5px] text-slate-300">
            <li className="flex items-start gap-1.5">
              <span className="text-cyan-400 font-bold">•</span>
              <span><strong className="text-white">Fórmula:</strong> Precio AR$ × % Seguridad ÷ Dólar quincenal = Costo US$.</span>
            </li>
            <li className="flex items-start gap-1.5">
              <span className="text-cyan-400 font-bold">•</span>
              <span><strong className="text-white">Alto valor:</strong> Si supera US$ {Number(policy.highValueThresholdUsd || 4000).toLocaleString('es-AR')}, usar {Math.round(((policy.highValueSecurityFactor || 1.02) - 1) * 100)}% de seguridad.</span>
            </li>
          </ul>

          <div className="pt-1 border-t border-slate-800/80 text-[10px] text-slate-400 flex items-center justify-between">
            <span>Editable en <strong className="text-cyan-300">Panel Admin ➔ Variables Macro &amp; Cierre</strong></span>
            {pinned && <span className="text-amber-300 font-mono uppercase">Fijada</span>}
          </div>
        </div>,
        document.body
      )}
    </span>
  )
}
