import { useState, useEffect, useMemo, useRef } from 'react'

export function InlineSupplierPicker({ suppliers, currentSupplierId, onSelect, onCancel }) {
  const currentSup = suppliers.find((s) => s.id === currentSupplierId)
  const [query, setQuery] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const containerRef = useRef(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return suppliers.slice(0, 50)
    return suppliers.filter((s) => {
      const nameMatch = (s.name || '').toLowerCase().includes(q)
      const tradeMatch = (s.trade || '').toLowerCase().includes(q) || (s.trades || []).some((t) => t.toLowerCase().includes(q))
      return nameMatch || tradeMatch
    })
  }, [suppliers, query])

  useEffect(() => {
    setHighlightIdx(0)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
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
      setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1))
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
    <div ref={containerRef} className="relative z-50 min-w-[200px]">
      <input
        type="text"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={currentSup ? `Actual: ${currentSup.name} (filtrar...)` : 'Escribir iniciales...'}
        className="w-full bg-slate-950 border-2 border-cyan-400 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-400 focus:outline-none shadow-lg"
      />
      <div className="absolute left-0 top-full mt-1 w-64 max-h-56 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 divide-y divide-slate-800/80 text-xs">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="w-full text-left px-3 py-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-300 text-[11px] italic cursor-pointer"
        >
          -- Sin Proveedor (Quitar asignación) --
        </button>
        {filtered.length === 0 ? (
          <div className="px-3 py-2.5 text-slate-500 text-center text-[11px]">
            Sin coincidencias para "{query}"
          </div>
        ) : (
          filtered.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              onMouseEnter={() => setHighlightIdx(idx)}
              className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                idx === highlightIdx ? 'bg-cyan-950 text-cyan-200 font-bold' : 'text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span className="truncate">{s.name}</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 shrink-0">
                {s.trade || (s.trades && s.trades[0]) || 'Gral'}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}
