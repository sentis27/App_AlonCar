import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Lightbulb } from 'lucide-react'
import { computeStepHelpPosition } from '../../lib/stepHelpPosition.js'

/**
 * StepHelpBadge (Pieza Canónica Transversal · SKL-019)
 * Circulito numerado de paso (1..N) con tarjeta emergente renderizada en portal (`document.body`).
 * Garantiza 0px de expansión/scroll en el modal y apertura hacia arriba en los pasos inferiores.
 */
export default function StepHelpBadge({
  step,
  helpEntry,
  isActive = false,
  isLastStep = false,
  placement = 'auto'
}) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [coords, setCoords] = useState(null)
  const buttonRef = useRef(null)
  const popoverRef = useRef(null)
  const closeTimerRef = useRef(null)

  const visible = (open || pinned) && Boolean(helpEntry)

  const updatePosition = useCallback(() => {
    const btn = buttonRef.current
    if (!btn) return
    const rect = btn.getBoundingClientRect()
    const bulletsCount = (helpEntry?.uiBullets || []).length
    const estimatedHeight = Math.max(130, 56 + bulletsCount * 46)
    const next = computeStepHelpPosition({
      rect,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      placement,
      isLastStep,
      estimatedHeight
    })
    setCoords(next)
  }, [helpEntry, isLastStep, placement])

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
    const handleReposition = () => updatePosition()
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [visible, updatePosition])

  useEffect(() => {
    if (!pinned) return
    const handleOutside = (e) => {
      const inBtn = buttonRef.current && buttonRef.current.contains(e.target)
      const inPop = popoverRef.current && popoverRef.current.contains(e.target)
      if (!inBtn && !inPop) {
        setPinned(false)
        setOpen(false)
      }
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') {
        setPinned(false)
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    window.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('keydown', handleKey)
    }
  }, [pinned])

  const handleMouseEnter = () => {
    clearCloseTimer()
    setOpen(true)
  }

  return (
    <div
      className="relative shrink-0"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={scheduleHoverClose}
    >
      <button
        ref={buttonRef}
        type="button"
        tabIndex={-1}
        aria-label={`Ayuda del Paso ${step}`}
        onClick={() => {
          clearCloseTimer()
          const next = !pinned
          setPinned(next)
          setOpen(next)
        }}
        className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-black text-xs border-2 transition-all cursor-pointer select-none ${
          visible || isActive
            ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/35 shadow-lg shadow-amber-500/25'
            : 'bg-slate-900 border-cyan-500/60 text-cyan-300 hover:border-amber-400 hover:text-amber-200'
        }`}
      >
        {step}
      </button>

      {visible && coords && typeof document !== 'undefined' && createPortal(
        <div
          ref={popoverRef}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleHoverClose}
          style={{
            position: 'fixed',
            left: `${coords.left}px`,
            ...(coords.direction === 'up'
              ? { bottom: `${coords.bottom}px` }
              : { top: `${coords.top}px` }),
            width: `${coords.width}px`,
            maxHeight: `${coords.maxHeight}px`
          }}
          className="z-[9999] p-3.5 rounded-xl bg-slate-950/98 border border-cyan-400/65 shadow-2xl shadow-cyan-950/80 text-[11px] text-slate-200 space-y-1.5 backdrop-blur-md overflow-y-auto font-sans animate-in fade-in duration-100"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span className="font-black text-white tracking-wide uppercase text-[11px] truncate">
                {helpEntry.title}
              </span>
            </div>
            {pinned && (
              <span className="text-[9px] font-mono text-amber-300/90 uppercase shrink-0">Fijada</span>
            )}
          </div>
          <ul className="space-y-1.5">
            {(helpEntry.uiBullets || []).map((b, idx) => (
              <li key={idx} className="leading-snug text-slate-300 flex items-start gap-1.5">
                <span className="text-cyan-400 font-bold mt-0.5">•</span>
                <span>
                  {b.label && <strong className="text-white">{b.label}: </strong>}
                  <span>{b.text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}
    </div>
  )
}
