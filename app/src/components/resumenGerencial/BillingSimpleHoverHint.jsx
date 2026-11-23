import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * Cartel flotante simple de fondo blanco y texto oscuro (mismo diseño sobrio de
 * WorkOrderCostPreviewBox en Órdenes de Trabajo), renderizado en portal para no
 * ser recortado por barras sticky o contenedores con scroll.
 */
export default function BillingSimpleHoverHint({
  children,
  content,
  side = 'bottom', // 'right' | 'bottom' | 'bottom-end'
  maxWidth = 280,
  className = 'inline-flex',
}) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState(null)
  const anchorRef = useRef(null)

  const computeCoords = useCallback(() => {
    const el = anchorRef.current
    if (!el || typeof window === 'undefined') return
    const rect = el.getBoundingClientRect()
    const pad = 10
    const vw = window.innerWidth
    const vh = window.innerHeight
    let top = rect.bottom + 6
    let left = rect.left

    if (side === 'right') {
      top = Math.max(pad, Math.min(rect.top - 4, vh - 140))
      left = rect.right + 10
      if (left + maxWidth > vw - pad) {
        left = Math.max(pad, rect.left - maxWidth - 10)
      }
    } else if (side === 'bottom-end') {
      top = rect.bottom + 8
      left = Math.max(pad, Math.min(rect.right - maxWidth, vw - maxWidth - pad))
    } else {
      top = rect.bottom + 8
      left = Math.max(pad, Math.min(rect.left, vw - maxWidth - pad))
    }

    if (top > vh - 110) {
      top = Math.max(pad, rect.top - 96)
    }

    setCoords({ top, left })
  }, [side, maxWidth])

  useEffect(() => {
    if (!open) return
    computeCoords()
    const onMove = () => computeCoords()
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => {
      window.removeEventListener('scroll', onMove, true)
      window.removeEventListener('resize', onMove)
    }
  }, [open, computeCoords])

  if (!content) return <span className={className}>{children}</span>

  return (
    <span
      ref={anchorRef}
      className={className}
      onMouseEnter={() => {
        computeCoords()
        setOpen(true)
      }}
      onMouseLeave={() => setOpen(false)}
    >
      {children}
      {open && coords && typeof document !== 'undefined' && createPortal(
        <div
          role="tooltip"
          style={{ position: 'fixed', top: coords.top, left: coords.left, maxWidth }}
          className="z-[120] pointer-events-none rounded-xl bg-white text-slate-900 border border-slate-300 px-3 py-2 shadow-xl text-[11px] leading-snug font-normal"
        >
          {content}
        </div>,
        document.body
      )}
    </span>
  )
}
