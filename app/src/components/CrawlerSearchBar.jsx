import React, { useRef, useEffect } from 'react'
import { Search, X, Sparkles } from 'lucide-react'

/**
 * CrawlerSearchBar
 * 
 * Componente Canónico de Búsqueda Omnicanal (Zona 3) para AlonCar ERP.
 * Encapsula la estética, atajos de teclado (Ctrl+F, Esc) y feedback visual del crawler.
 */
export default function CrawlerSearchBar({
  value = '',
  onChange,
  onClear,
  placeholder = 'Buscar por material, proveedor, buque, solicitante, factura, notas... (Ctrl+F | Esc limpia)',
  className = '',
  inputRef = null,
  showCrawlerBadge = true
}) {
  const localRef = useRef(null)
  const effectiveRef = inputRef || localRef

  // Atajos de teclado globales: Ctrl+F para enfocar buscador, Esc para limpiar
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        // Si no estamos escribiendo en otro input editable
        if (['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName) && document.activeElement !== effectiveRef.current) {
          return
        }
        e.preventDefault()
        effectiveRef.current?.focus()
        effectiveRef.current?.select()
      } else if (e.key === 'Escape' && document.activeElement === effectiveRef.current) {
        if (value) {
          e.preventDefault()
          if (onClear) onClear()
          else if (onChange) onChange('')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [value, onChange, onClear, effectiveRef])

  const handleClearClick = () => {
    if (onClear) onClear()
    else if (onChange) onChange('')
    effectiveRef.current?.focus()
  }

  const isSearching = Boolean(value && value.trim().length > 0)

  return (
    <div className={`relative flex-1 min-w-[280px] max-w-2xl ${className}`}>
      {/* Icono de Lupa / Crawler */}
      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
        {isSearching && showCrawlerBadge ? (
          <Sparkles className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
        ) : (
          <Search className="w-3.5 h-3.5 text-slate-400" />
        )}
      </div>

      {/* Input de texto */}
      <input
        ref={effectiveRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full pl-9 pr-14 py-1.5 bg-slate-900/90 border rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner font-sans ${
          isSearching
            ? 'border-cyan-400/80 shadow-cyan-500/10 ring-1 ring-cyan-500/20'
            : 'border-slate-700/80 hover:border-slate-600 focus:border-cyan-500'
        }`}
      />

      {/* Botón de Limpiar / Atajo Esc */}
      {isSearching && (
        <div className="absolute inset-y-0 right-0 pr-2 flex items-center gap-1">
          <button
            type="button"
            onClick={handleClearClick}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            title="Limpiar búsqueda (Esc)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  )
}
