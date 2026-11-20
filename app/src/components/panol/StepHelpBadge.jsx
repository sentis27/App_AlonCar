import { useState, useRef, useEffect } from 'react'
import { Lightbulb } from 'lucide-react'

/**
 * StepHelpBadge
 * Circulito numerado de paso (1..4) con tarjeta emergente simple (estilo tarjeta de OT)
 * alimentada desde `businessHelpRegistry.js`. Soporta hover y clic táctil/teclado.
 */
export default function StepHelpBadge({ step, helpEntry, isActive = false }) {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const wrapperRef = useRef(null)

  useEffect(() => {
    if (!pinned) return
    const handleOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setPinned(false)
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [pinned])

  const visible = open || pinned

  return (
    <div
      ref={wrapperRef}
      className="relative shrink-0"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => { if (!pinned) setOpen(false) }}
    >
      <button
        type="button"
        tabIndex={-1}
        onClick={() => {
          const next = !pinned
          setPinned(next)
          setOpen(next)
        }}
        className={`w-7 h-7 rounded-full flex items-center justify-center font-mono font-black text-xs border-2 transition-all cursor-pointer select-none ${
          visible || isActive
            ? 'bg-amber-500/20 border-amber-400 text-amber-200 ring-2 ring-amber-400/35 shadow-lg shadow-amber-500/25'
            : 'bg-slate-900 border-cyan-500/60 text-cyan-300 hover:border-amber-400 hover:text-amber-200'
        }`}
        title={`Ayuda del Paso ${step} (acercá el mouse o hacé clic)`}
      >
        {step}
      </button>

      {visible && helpEntry && (
        <div className="absolute left-9 top-0 z-[70] w-72 sm:w-80 p-3 rounded-xl bg-slate-950/95 border border-cyan-400/60 shadow-2xl shadow-cyan-950/70 text-[11px] text-slate-200 space-y-1.5 backdrop-blur-md">
          <div className="flex items-center gap-1.5 border-b border-slate-800 pb-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-amber-400 shrink-0" />
            <span className="font-black text-white tracking-wide uppercase text-[11px]">
              {helpEntry.title}
            </span>
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
        </div>
      )}
    </div>
  )
}
