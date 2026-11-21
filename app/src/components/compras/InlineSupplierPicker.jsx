import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'

/**
 * InlineSupplierPicker
 * Selector rápido de proveedor por doble clic en la planilla de Compras.
 * Renderiza el desplegable en Portal (`document.body`) con posicionamiento fijo inteligente
 * para nunca quedar recortado por el borde inferior de `.alon-grid-scroll`.
 */
export function InlineSupplierPicker({ suppliers, currentSupplierId, onSelect, onCancel }) {
  const currentSup = suppliers.find((s) => s.id === currentSupplierId)
  const [query, setQuery] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const [dropdownRect, setDropdownRect] = useState(null)
  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return suppliers.slice(0, 50)
    return suppliers.filter((s) => {
      const nameMatch = (s.name || '').toLowerCase().includes(q)
      const tradeMatch =
        (s.trade || '').toLowerCase().includes(q) ||
        (s.trades || []).some((t) => t.toLowerCase().includes(q))
      return nameMatch || tradeMatch
    })
  }, [suppliers, query])

  const updatePosition = useCallback(() => {
    const el = inputRef.current || containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - 12
    const spaceAbove = rect.top - 12
    const openUpward = spaceBelow < 200 && spaceAbove > spaceBelow
    const maxHeight = Math.max(160, Math.min(240, openUpward ? spaceAbove : spaceBelow))
    const width = Math.min(window.innerWidth - 24, Math.max(rect.width, 280))
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12))
    setDropdownRect({
      top: openUpward ? rect.top - 4 : rect.bottom + 4,
      left,
      width,
      maxHeight,
      openUpward
    })
  }, [])

  useEffect(() => {
    setHighlightIdx(0)
  }, [query])

  useEffect(() => {
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [updatePosition])

  useEffect(() => {
    function handleClickOutside(e) {
      const insideInput = containerRef.current?.contains(e.target)
      const insideDropdown = dropdownRef.current?.contains(e.target)
      if (!insideInput && !insideDropdown) {
        onCancel()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onCancel])

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((prev) => Math.min(prev + 1, Math.max(filtered.length - 1, 0)))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlightIdx]) {
        onSelect(filtered[highlightIdx].id)
      }
    }
  }

  return (
    <div ref={containerRef} className="relative z-50 min-w-[200px]" onClick={(e) => e.stopPropagation()}>
      <input
        ref={inputRef}
        type="text"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={currentSup ? `Actual: ${currentSup.name} (filtrar...)` : 'Escribir iniciales...'}
        className="w-full bg-slate-950 border-2 border-cyan-400 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-400 focus:outline-none shadow-lg"
      />
      {dropdownRect && typeof document !== 'undefined' && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownRect.openUpward ? undefined : `${dropdownRect.top}px`,
            bottom: dropdownRect.openUpward ? `${window.innerHeight - dropdownRect.top}px` : undefined,
            left: `${dropdownRect.left}px`,
            width: `${dropdownRect.width}px`,
            maxHeight: `${dropdownRect.maxHeight}px`,
            zIndex: 9999
          }}
          className="overflow-y-auto bg-slate-900 border border-cyan-500/60 rounded-xl shadow-2xl shadow-black/80 divide-y divide-slate-800/80 text-xs font-sans"
        >
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); onSelect(null) }}
            className="w-full text-left px-3 py-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-300 text-[11px] italic cursor-pointer"
          >
            -- Sin Proveedor (Quitar asignación) --
          </button>
          {filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-slate-500 text-center text-[11px]">
              Sin coincidencias para &ldquo;{query}&rdquo;
            </div>
          ) : (
            filtered.map((s, idx) => (
              <button
                key={s.id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); onSelect(s.id) }}
                onMouseEnter={() => setHighlightIdx(idx)}
                className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                  idx === highlightIdx ? 'bg-cyan-950 text-cyan-200 font-bold' : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span className="truncate">{s.name}</span>
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 shrink-0">
                  {s.trade || (s.trades && s.trades[0]) || 'Gral'}
                </span>
              </button>
            ))
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
