import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { Package, Flame, X, ChevronDown } from 'lucide-react'
import { normalizeText } from '../../lib/allocationEngine'
import { isGasMaterial } from '../../lib/panolConstants'

/**
 * Autocompletado directo en una sola caja con menú flotante por Portal (estilo Google Sheets / Imagen 4).
 * Evita recortes por contenedores overflow-y-auto y soporta navegación completa por teclado.
 */
export function MaterialAutocompleteInput({
  materials = [],
  value = '',
  onChange,
  placeholder = 'Escribir material o rubro (ej: chapa, gas, electrodo)...'
}) {
  const selectedMat = useMemo(() => materials.find((m) => m.id === value) || null, [materials, value])
  const [query, setQuery] = useState('')
  const [isEditingText, setIsEditingText] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [dropdownRect, setDropdownRect] = useState(null)

  const inputRef = useRef(null)
  const containerRef = useRef(null)
  const dropdownRef = useRef(null)

  const effectiveQuery = isEditingText ? query : (selectedMat?.name || '')

  const matches = useMemo(() => {
    const q = normalizeText(isEditingText ? query : '')
    if (!q) return materials.slice(0, 60)

    const startsWithList = []
    const includesList = []
    for (const m of materials) {
      const nameNorm = normalizeText(m.name)
      const rubroNorm = normalizeText(m.rubro)
      const catNorm = normalizeText(m.category)
      if (nameNorm.startsWith(q)) {
        startsWithList.push(m)
      } else if (nameNorm.includes(q) || rubroNorm.includes(q) || catNorm.includes(q)) {
        includesList.push(m)
      }
      if (startsWithList.length + includesList.length >= 80) break
    }
    return [...startsWithList, ...includesList].slice(0, 60)
  }, [materials, query, isEditingText])

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - 12
    const spaceAbove = rect.top - 12
    const openUpward = spaceBelow < 210 && spaceAbove > spaceBelow
    const maxHeight = Math.max(180, Math.min(320, openUpward ? spaceAbove : spaceBelow))
    const width = Math.min(window.innerWidth - 24, Math.max(rect.width, 460))
    const left = Math.min(rect.left, window.innerWidth - width - 12)

    setDropdownRect({
      top: openUpward ? rect.top - 4 : rect.bottom + 4,
      left: Math.max(12, left),
      width,
      maxHeight,
      openUpward
    })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    updatePosition()
    const handleReposition = () => updatePosition()
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [isOpen, updatePosition])

  useEffect(() => {
    const handleOutsideClick = (e) => {
      const insideInput = containerRef.current?.contains(e.target)
      const insideMenu = dropdownRef.current?.contains(e.target)
      if (!insideInput && !insideMenu) {
        setIsOpen(false)
        setIsEditingText(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const selectMaterial = (mat) => {
    onChange(mat.id)
    setQuery(mat.name)
    setIsEditingText(false)
    setIsOpen(false)
  }

  const clearSelection = (e) => {
    e.stopPropagation()
    onChange('')
    setQuery('')
    setIsEditingText(true)
    setActiveIndex(0)
    setIsOpen(true)
    inputRef.current?.focus()
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        setActiveIndex(0)
        return
      }
      setActiveIndex((prev) => (matches.length > 0 ? Math.min(prev + 1, matches.length - 1) : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        return
      }
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && isOpen) {
      e.preventDefault()
      if (matches[activeIndex]) {
        selectMaterial(matches[activeIndex])
      }
    } else if (e.key === 'Escape' && isOpen) {
      e.preventDefault()
      e.stopPropagation()
      setIsOpen(false)
      setIsEditingText(false)
    } else if (e.key === 'Tab') {
      setIsOpen(false)
      setIsEditingText(false)
    }
  }

  const selectedIsGas = isGasMaterial(selectedMat)

  return (
    <div ref={containerRef} className="relative w-full font-sans">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          value={effectiveQuery}
          placeholder={placeholder}
          onFocus={(e) => {
            setIsOpen(true)
            setIsEditingText(true)
            setQuery(selectedMat ? '' : query)
            setActiveIndex(0)
            e.target.select()
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsEditingText(true)
            setIsOpen(true)
            setActiveIndex(0)
          }}
          onKeyDown={handleKeyDown}
          className={`w-full pl-2.5 pr-28 py-1.5 rounded bg-slate-950 border text-white text-xs font-semibold focus:outline-none transition-colors ${
            isOpen
              ? 'border-cyan-400 ring-1 ring-cyan-400/40'
              : selectedIsGas
              ? 'border-amber-500/70'
              : 'border-slate-700 hover:border-slate-500'
          }`}
        />

        <div className="absolute right-1.5 flex items-center gap-1">
          {selectedMat && !isEditingText && (
            <>
              {selectedIsGas && (
                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 border border-amber-500/50 text-amber-300 font-black uppercase">
                  GAS
                </span>
              )}
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded bg-slate-800 font-mono font-bold ${
                  Number(selectedMat.current_stock) <= 0 ? 'text-rose-400' : 'text-emerald-400'
                }`}
              >
                Stock: {selectedMat.current_stock}
              </span>
              <button
                type="button"
                tabIndex={-1}
                onClick={clearSelection}
                title="Cambiar material"
                className="p-0.5 rounded text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            </>
          )}
          {(!selectedMat || isEditingText) && (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                setIsOpen((prev) => !prev)
                if (!isOpen) inputRef.current?.focus()
              }}
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
            left: dropdownRect.left,
            width: dropdownRect.width,
            maxHeight: dropdownRect.maxHeight,
            zIndex: 9999
          }}
          className="bg-slate-950 border border-cyan-500/60 rounded-xl shadow-2xl shadow-black/80 overflow-hidden flex flex-col font-sans"
        >
          <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-[10px] text-slate-400">
            <span>
              {isEditingText && query.trim()
                ? `${matches.length} coincidencia(s) para "${query.trim()}"`
                : `Mostrando ${matches.length} materiales (escribí para filtrar por nombre o rubro)`}
            </span>
            <span className="font-mono text-slate-500">↑↓ Navegar · Enter Elegir · Esc Cerrar</span>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-800/70 flex-1">
            {matches.length === 0 ? (
              <div className="p-4 text-center text-slate-400 text-xs">
                No se encontraron materiales que coincidan con "{query}".
              </div>
            ) : (
              matches.map((m, i) => {
                const matIsGas = isGasMaterial(m)
                const isHighlighted = i === activeIndex
                const isSelected = m.id === value
                return (
                  <div
                    key={m.id}
                    onMouseEnter={() => setActiveIndex(i)}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      selectMaterial(m)
                    }}
                    className={`px-3 py-2 cursor-pointer flex items-center justify-between gap-2.5 transition-colors ${
                      isHighlighted
                        ? 'bg-cyan-950/80 border-l-2 border-l-cyan-400'
                        : isSelected
                        ? 'bg-slate-900/90'
                        : 'hover:bg-slate-900/70'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {m.image_url ? (
                        <img src={m.image_url} alt="" className="w-6 h-6 rounded object-cover shrink-0 border border-slate-700" />
                      ) : (
                        <div
                          className={`w-6 h-6 rounded border flex items-center justify-center shrink-0 ${
                            matIsGas
                              ? 'bg-amber-950/60 border-amber-600/50 text-amber-400'
                              : 'bg-slate-900 border-slate-800 text-slate-500'
                          }`}
                        >
                          {matIsGas ? <Flame className="w-3.5 h-3.5" /> : <Package className="w-3.5 h-3.5" />}
                        </div>
                      )}
                      <div className="min-w-0">
                        <span className="font-bold text-white text-xs block truncate">{m.name}</span>
                        <div className="flex items-center gap-1.5 text-[10px]">
                          <span
                            className={`px-1.5 py-0.2 rounded font-semibold ${
                              matIsGas
                                ? 'bg-amber-950 text-amber-300 border border-amber-600/40'
                                : 'bg-slate-900 text-slate-400'
                            }`}
                          >
                            {m.rubro || m.category || 'SIN RUBRO'}
                          </span>
                          {m.location_bin && <span className="text-slate-500 font-mono">Ubic: {m.location_bin}</span>}
                        </div>
                      </div>
                    </div>

                    <span
                      className={`font-mono font-bold text-xs shrink-0 ${
                        Number(m.current_stock) <= 0 ? 'text-rose-400' : 'text-emerald-400'
                      }`}
                    >
                      {m.current_stock} {m.unit_measure || 'un.'}
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
