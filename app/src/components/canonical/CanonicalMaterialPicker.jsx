import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Package, Flame, X, ChevronDown } from 'lucide-react'
import { isGasMaterial } from '../../lib/panolConstants'
import { filterCanonicalMaterials, formatCanonicalMaterialStock } from '../../lib/canonicalHelpers'

/**
 * CanonicalMaterialPicker.jsx
 * Componente Canónico Obligatorio (Candado #2 · Estándar 06 / 08_FEATURES_LOCK).
 *
 * Desplegable inteligente por Portal (`document.body`) reutilizable tanto en formularios/modales
 * como en celdas editables in-situ (`compact`, `autoFocus`, `onCancel`, `allowFreeText`).
 * Garantiza navegación 100% por teclado (↑↓ Enter Esc Tab), filtro sin tildes/mayúsculas,
 * visualización de stock en vivo, unidad oficial y rubro/categoría.
 */
export default function CanonicalMaterialPicker({
  materials = [],
  value = '',
  initialText = '',
  onChange,
  onSelectMaterial = null,
  onCancel = null,
  placeholder = 'Escribir material o rubro (ej: chapa, gas, electrodo)...',
  autoFocus = false,
  compact = false,
  allowFreeText = false,
}) {
  const selectedMat = useMemo(() => materials.find((m) => m.id === value) || null, [materials, value])
  const [query, setQuery] = useState(() => initialText || selectedMat?.name || '')
  const [hasTyped, setHasTyped] = useState(false)
  const [isEditingText, setIsEditingText] = useState(Boolean(autoFocus))
  const [isOpen, setIsOpen] = useState(Boolean(autoFocus))
  const [activeIndex, setActiveIndex] = useState(0)
  const [dropdownRect, setDropdownRect] = useState(null)

  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const dropdownRef = useRef(null)

  const effectiveQuery = isEditingText ? query : (selectedMat?.name || initialText || '')
  const matches = useMemo(
    () => filterCanonicalMaterials(materials, isEditingText && hasTyped ? query : ''),
    [materials, query, isEditingText, hasTyped]
  )

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - 12
    const spaceAbove = rect.top - 12
    const openUpward = spaceBelow < 210 && spaceAbove > spaceBelow
    const maxHeight = Math.max(180, Math.min(320, openUpward ? spaceAbove : spaceBelow))
    const width = Math.min(window.innerWidth - 24, Math.max(rect.width, 460))
    const left = Math.min(rect.left, window.innerWidth - width - 12)
    setDropdownRect({ top: openUpward ? rect.top - 4 : rect.bottom + 4, left: Math.max(12, left), width, maxHeight, openUpward })
  }, [])

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [autoFocus])

  useEffect(() => {
    if (!isOpen) return
    updatePosition()
    const onPos = () => updatePosition()
    window.addEventListener('resize', onPos)
    window.addEventListener('scroll', onPos, true)
    return () => {
      window.removeEventListener('resize', onPos)
      window.removeEventListener('scroll', onPos, true)
    }
  }, [isOpen, updatePosition])

  useEffect(() => {
    const onOutside = (e) => {
      const inside = containerRef.current?.contains(e.target) || dropdownRef.current?.contains(e.target)
      if (!inside) {
        setIsOpen(false)
        setIsEditingText(false)
        if (onCancel) onCancel()
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [onCancel])

  const commitMaterial = (mat) => {
    if (onChange) onChange(mat.id, mat)
    if (onSelectMaterial) onSelectMaterial(mat)
    setQuery(mat.name)
    setHasTyped(false)
    setIsEditingText(false)
    setIsOpen(false)
  }

  const clearSelection = (e) => {
    e.stopPropagation()
    if (onChange) onChange('', null)
    setQuery('')
    setHasTyped(false)
    setIsEditingText(true)
    setActiveIndex(0)
    setIsOpen(true)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      e.stopPropagation()
      if (!isOpen) { setIsOpen(true); setActiveIndex(0); return }
      setActiveIndex((prev) => (matches.length > 0 ? Math.min(prev + 1, matches.length - 1) : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      e.stopPropagation()
      if (!isOpen) { setIsOpen(true); return }
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      e.stopPropagation()
      if (isOpen && matches[activeIndex]) {
        commitMaterial(matches[activeIndex])
      } else if (allowFreeText && query.trim()) {
        if (onChange) onChange(null, { id: null, name: query.trim() })
        setIsOpen(false)
        setIsEditingText(false)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      setIsOpen(false)
      setIsEditingText(false)
      if (onCancel) onCancel()
    } else if (e.key === 'Tab') {
      setIsOpen(false)
      setIsEditingText(false)
      if (compact && onCancel) onCancel()
    }
  }

  const selectedIsGas = isGasMaterial(selectedMat)
  const selectedStock = formatCanonicalMaterialStock(selectedMat)

  return (
    <div ref={containerRef} className="relative w-full font-sans" onClick={(e) => e.stopPropagation()}>
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={effectiveQuery}
          placeholder={placeholder}
          onFocus={(e) => {
            setIsOpen(true)
            setIsEditingText(true)
            if (!compact && selectedMat) setQuery('')
            setActiveIndex(0)
            e.target.select()
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setHasTyped(true)
            setIsEditingText(true)
            setIsOpen(true)
            setActiveIndex(0)
          }}
          onKeyDown={handleKeyDown}
          className={`w-full rounded bg-slate-950 border text-white font-semibold focus:outline-none transition-colors ${
            compact ? 'pl-1.5 pr-6 py-0.5 text-[11px]' : 'pl-2.5 pr-28 py-1.5 text-xs'
          } ${
            isOpen ? 'border-cyan-400 ring-1 ring-cyan-400/40' : selectedIsGas ? 'border-amber-500/70' : 'border-slate-700 hover:border-slate-500'
          }`}
        />

        <div className="absolute right-1.5 flex items-center gap-1">
          {!compact && selectedMat && !isEditingText && (
            <>
              {selectedIsGas && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 border border-amber-500/50 text-amber-300 font-black uppercase">GAS</span>}
              <span className={`text-[10px] px-1.5 py-0.5 rounded bg-slate-800 font-mono font-bold ${selectedStock.isCritical ? 'text-rose-400' : selectedStock.tone === 'ok' ? 'text-emerald-400' : 'text-slate-400'}`}>
                Stock: {selectedStock.label}
              </span>
              <button type="button" tabIndex={-1} onClick={clearSelection} title="Cambiar material" className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer">
                <X className="w-3 h-3" />
              </button>
            </>
          )}
          {(compact || !selectedMat || isEditingText) && (
            <button
              type="button" tabIndex={-1}
              onClick={() => { setIsOpen((prev) => !prev); if (!isOpen) inputRef.current?.focus() }}
              className="p-0.5 text-slate-400 hover:text-cyan-400 cursor-pointer"
            >
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180 text-cyan-400' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {isOpen && dropdownRect && createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownRect.openUpward ? undefined : dropdownRect.top,
            bottom: dropdownRect.openUpward ? window.innerHeight - dropdownRect.top : undefined,
            left: dropdownRect.left, width: dropdownRect.width, maxHeight: dropdownRect.maxHeight, zIndex: 9999
          }}
          className="bg-slate-950 border border-cyan-500/60 rounded-xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col font-sans"
        >
          <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span>
              {isEditingText && hasTyped && query.trim() ? `${matches.length} coincidencia(s) para "${query.trim()}"` : `Mostrando ${matches.length} materiales (filtrá por nombre, rubro o categoría)`}
            </span>
            <span className="font-mono text-slate-500">↑↓ Navegar · Enter Elegir · Esc Cerrar</span>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-800/70 flex-1">
            {matches.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                No se encontraron materiales para "{query}".
              </div>
            ) : (
              matches.map((m, i) => {
                const matIsGas = isGasMaterial(m)
                const stockInfo = formatCanonicalMaterialStock(m)
                const isHighlighted = i === activeIndex
                const isSelected = m.id === value
                return (
                  <div
                    key={m.id}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseDown={(e) => { e.preventDefault(); commitMaterial(m) }}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-2.5 transition-colors ${
                      isHighlighted ? 'bg-cyan-950/80 border-l-2 border-l-cyan-400' : isSelected ? 'bg-slate-900/90' : 'hover:bg-slate-900/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {m.image_url ? (
                        <img src={m.image_url} alt="" className="w-6 h-6 rounded object-cover shrink-0 border border-slate-700" />
                      ) : (
                        <div className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 ${matIsGas ? 'bg-amber-950/60 border-amber-600/50 text-amber-400' : 'bg-slate-900 border-slate-800 text-slate-500'}`}>
                          {matIsGas ? <Flame className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-bold text-white text-xs block truncate">{m.name}</span>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span className={`px-1.5 py-0.2 rounded font-semibold ${matIsGas ? 'bg-amber-950 text-amber-300 border border-amber-600/40' : 'bg-slate-900 text-slate-400'}`}>
                            {m.rubro || m.category || 'SIN RUBRO'}
                          </span>
                          {m.rubro && m.category && m.category !== m.rubro && (
                            <span className="px-1.5 py-0.2 rounded bg-slate-800/80 text-slate-400">{m.category}</span>
                          )}
                          {m.location_bin && <span className="text-slate-500 font-mono">Ubic: {m.location_bin}</span>}
                        </div>
                      </div>
                    </div>
                    <span className={`font-mono font-bold text-xs shrink-0 ${stockInfo.isCritical ? 'text-rose-400' : stockInfo.tone === 'ok' ? 'text-emerald-400' : 'text-slate-400'}`}>
                      {stockInfo.label}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export { CanonicalMaterialPicker }
