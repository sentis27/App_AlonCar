import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, X } from 'lucide-react'
import { normalizeText } from '../../lib/allocationEngine.js'

const TONE_CLASSES = {
  cyan: 'bg-cyan-950 text-cyan-300 border-cyan-700/50',
  amber: 'bg-amber-950 text-amber-300 border-amber-700/50',
  purple: 'bg-purple-950 text-purple-300 border-purple-700/50',
  slate: 'bg-slate-900 text-slate-300 border-slate-700/60'
}

export default function LaborSearchableSelect({
  value = '',
  options = [],
  placeholder = 'Escribir o elegir...',
  headerTitle = 'Opciones disponibles',
  emptyMessage = 'Sin coincidencias habilitadas en este barco.',
  inputClassName = '',
  required = false,
  onChangeText,
  onSelectOption,
  expandConfig = null,
  fallbackExpandCountFn = null
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isFiltering, setIsFiltering] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [dropdownRect, setDropdownRect] = useState(null)

  const containerRef = useRef(null)
  const inputRef = useRef(null)
  const dropdownRef = useRef(null)

  const activeQuery = isFiltering ? value : ''

  const matches = useMemo(() => {
    const q = normalizeText(activeQuery)
    if (!q) return options
    const starts = []
    const includes = []
    for (const opt of options) {
      const lbl = normalizeText(opt.label)
      const kw = normalizeText(opt.searchKeywords || opt.label)
      if (lbl.startsWith(q)) starts.push(opt)
      else if (kw.includes(q)) includes.push(opt)
    }
    return [...starts, ...includes]
  }, [options, activeQuery])

  const fallbackMatchesCount = useMemo(() => {
    if (!expandConfig || expandConfig.isExpanded || matches.length > 0 || !fallbackExpandCountFn) return 0
    return fallbackExpandCountFn(activeQuery)
  }, [expandConfig, matches.length, fallbackExpandCountFn, activeQuery])

  const updatePosition = useCallback(() => {
    if (!inputRef.current) return
    const rect = inputRef.current.getBoundingClientRect()
    const spaceBelow = window.innerHeight - rect.bottom - 12
    const spaceAbove = rect.top - 12
    const openUpward = spaceBelow < 220 && spaceAbove > spaceBelow
    const maxHeight = Math.max(190, Math.min(340, openUpward ? spaceAbove : spaceBelow))
    const width = Math.min(window.innerWidth - 24, Math.max(rect.width, 360))
    const left = Math.min(rect.left, window.innerWidth - width - 12)
    setDropdownRect({ top: openUpward ? rect.top - 4 : rect.bottom + 4, left: Math.max(12, left), width, maxHeight, openUpward })
  }, [])

  useEffect(() => {
    if (!isOpen) return
    updatePosition()
    const onRepos = () => updatePosition()
    window.addEventListener('resize', onRepos)
    window.addEventListener('scroll', onRepos, true)
    return () => {
      window.removeEventListener('resize', onRepos)
      window.removeEventListener('scroll', onRepos, true)
    }
  }, [isOpen, updatePosition, options.length])

  useEffect(() => {
    if (isOpen) dropdownRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest' })
  }, [isOpen, activeIndex])

  useEffect(() => {
    const onOutside = (e) => {
      if (!containerRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) {
        setIsOpen(false)
        setIsFiltering(false)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [])

  const chooseOption = (opt) => {
    onSelectOption?.(opt.value, opt)
    setIsOpen(false)
    setIsFiltering(false)
  }

  const commitBlur = () => {
    setIsOpen(false)
    setIsFiltering(false)
    const exact = options.find((o) => normalizeText(o.label) === normalizeText(value))
    if (exact && exact.value !== value) onSelectOption?.(exact.value, exact)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) { setIsOpen(true); setActiveIndex(0); return }
      setActiveIndex((prev) => (matches.length > 0 ? Math.min(prev + 1, matches.length - 1) : 0))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) { setIsOpen(true); return }
      setActiveIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && isOpen) {
      if (matches[activeIndex]) { e.preventDefault(); chooseOption(matches[activeIndex]) }
      else { setIsOpen(false); setIsFiltering(false) }
    } else if (e.key === 'Escape' && isOpen) {
      e.preventDefault(); e.stopPropagation(); setIsOpen(false); setIsFiltering(false)
    } else if (e.key === 'Tab') {
      setIsOpen(false); setIsFiltering(false)
    }
  }

  let lastSectionKey = null

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type="text"
          required={required}
          value={value}
          placeholder={placeholder}
          onFocus={(e) => { setIsOpen(true); setIsFiltering(false); setActiveIndex(0); e.target.select() }}
          onChange={(e) => { onChangeText?.(e.target.value); setIsFiltering(true); setIsOpen(true); setActiveIndex(0) }}
          onBlur={() => commitBlur()}
          onKeyDown={handleKeyDown}
          className={`w-full pr-11 ${inputClassName}`}
        />
        <div className="absolute right-1.5 flex items-center gap-0.5">
          {value && (
            <button
              type="button"
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault()
                onChangeText?.('')
                setIsFiltering(true); setIsOpen(true); setActiveIndex(0)
                inputRef.current?.focus()
              }}
              title="Limpiar"
              className="p-0.5 rounded text-slate-500 hover:text-white cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            onMouseDown={(e) => {
              e.preventDefault()
              setIsOpen((prev) => !prev)
              setIsFiltering(false)
              inputRef.current?.focus()
            }}
            title="Ver lista"
            className="p-0.5 text-slate-400 hover:text-cyan-400 cursor-pointer"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180 text-cyan-400' : ''}`} />
          </button>
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
          className="bg-slate-950 border border-cyan-500/60 rounded-xl shadow-2xl shadow-black/85 overflow-hidden flex flex-col font-sans"
        >
          <div className="px-3 py-1.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between gap-2 text-[10px] text-slate-300 font-semibold">
            <span className="truncate">{isFiltering && activeQuery.trim() ? `${matches.length} coincidencia(s) para "${activeQuery.trim()}"` : headerTitle}</span>
            <span className="font-mono text-slate-500 shrink-0">↑↓ · Enter · Esc</span>
          </div>

          <div className="overflow-y-auto divide-y divide-slate-800/60 flex-1">
            {matches.length === 0 ? (
              <div className="p-3 text-center space-y-2 text-xs text-slate-400">
                <p>{emptyMessage}</p>
                {expandConfig && !expandConfig.isExpanded && (
                  <button
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); expandConfig.onToggleExpand(true); setActiveIndex(0) }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-[11px] cursor-pointer"
                  >
                    {fallbackMatchesCount > 0 ? `🔓 Ver ${fallbackMatchesCount} coincidencia(s) en totalidad del padrón` : `🔓 Expandir (Ver totalidad — ${expandConfig.expandedCount})`}
                  </button>
                )}
              </div>
            ) : (
              matches.map((opt, idx) => {
                const showHeader = opt.sectionLabel && opt.sectionKey !== lastSectionKey
                lastSectionKey = opt.sectionKey
                const isHl = idx === activeIndex
                const isSel = normalizeText(opt.value) === normalizeText(value)
                return (
                  <div key={`${opt.sectionKey}_${opt.value}_${idx}`} data-active={isHl ? 'true' : undefined}>
                    {showHeader && (
                      <div className="px-3 py-1 bg-slate-900/95 border-y border-slate-800/80 text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                        {opt.sectionLabel}
                      </div>
                    )}
                    <div
                      onMouseEnter={() => setActiveIndex(idx)}
                      onMouseDown={(e) => { e.preventDefault(); chooseOption(opt) }}
                      className={`px-3 py-1.5 cursor-pointer flex items-center justify-between gap-2 transition-colors ${
                        isHl ? 'bg-cyan-950/80 border-l-2 border-l-cyan-400' : isSel ? 'bg-slate-900/90' : 'hover:bg-slate-900/70'
                      }`}
                    >
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-white block truncate">{opt.label}</span>
                        {(opt.metaText || opt.sinOtEnBarco) && (
                          <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                            {opt.metaText && <span>{opt.metaText}</span>}
                            {opt.sinOtEnBarco && <span className="text-amber-300 font-semibold">(Sin OT en barco)</span>}
                          </div>
                        )}
                      </div>
                      {opt.badgeText && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded border font-semibold shrink-0 ${TONE_CLASSES[opt.badgeTone] || TONE_CLASSES.slate}`}>
                          {opt.badgeText}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {expandConfig && (
            <button
              type="button"
              onMouseDown={(e) => { e.preventDefault(); expandConfig.onToggleExpand(!expandConfig.isExpanded); setActiveIndex(0) }}
              className={`w-full px-3 py-2 text-left text-[11px] font-bold border-t border-slate-800 cursor-pointer transition-colors ${
                expandConfig.isExpanded ? 'bg-sky-950/70 hover:bg-sky-900/80 text-sky-300' : 'bg-slate-900 hover:bg-amber-950/50 text-amber-300'
              }`}
            >
              {expandConfig.isExpanded
                ? `🔒 Contraer (Solo habilitados del barco — ${expandConfig.enabledCount})`
                : `🔓 Expandir (Ver totalidad de operarios y contratistas — ${expandConfig.expandedCount})...`}
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
