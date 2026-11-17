import React, { useState, useRef, useEffect } from 'react'
import { Star, ChevronDown, Plus, Check, X, Settings, Trash2 } from 'lucide-react'
import SavedFilterViewRow from './SavedFilterViewRow'

/**
 * SavedFilterViewsDropdown
 * Menú minimalista estilo Google Sheets en Zona 3 para guardar, aplicar,
 * previsualizar (tooltip estilo OT al posicionar el cursor) y gestionar
 * hasta 5 vistas de filtro por usuario y módulo.
 */
export default function SavedFilterViewsDropdown({ controller }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [manageMode, setManageMode] = useState(false)
  const [editingViewId, setEditingViewId] = useState(null)
  const [editingName, setEditingName] = useState('')
  const [confirmClearAll, setConfirmClearAll] = useState(false)
  const [hoveredViewId, setHoveredViewId] = useState(null)
  const [localError, setLocalError] = useState('')

  const containerRef = useRef(null)
  const createInputRef = useRef(null)
  const editInputRef = useRef(null)

  const {
    views = [],
    maxViews = 5,
    activeViewId = null,
    hasActiveFilters = false,
    onApplyView,
    onSaveNewView,
    onRenameView,
    onUpdateViewWithCurrent,
    onDeleteView,
    onClearAllViews
  } = controller || {}

  useEffect(() => {
    if (!isOpen) return undefined
    const handleOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false); setIsCreating(false); setManageMode(false)
        setEditingViewId(null); setConfirmClearAll(false); setHoveredViewId(null); setLocalError('')
      }
    }
    const handleEsc = (e) => {
      if (e.key !== 'Escape') return
      if (editingViewId) return setEditingViewId(null)
      if (isCreating) return setIsCreating(false)
      setIsOpen(false); setManageMode(false); setConfirmClearAll(false)
    }
    document.addEventListener('mousedown', handleOutside)
    window.addEventListener('keydown', handleEsc)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      window.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, isCreating, editingViewId])

  useEffect(() => {
    if (isCreating) setTimeout(() => createInputRef.current?.focus(), 20)
  }, [isCreating])

  useEffect(() => {
    if (editingViewId) {
      setTimeout(() => { editInputRef.current?.focus(); editInputRef.current?.select() }, 20)
    }
  }, [editingViewId])

  if (!controller) return null

  const canCreate = hasActiveFilters && views.length < maxViews
  const activeView = views.find((v) => v.id === activeViewId) || null

  const handleConfirmCreate = async () => {
    setLocalError('')
    try {
      await onSaveNewView?.(newName)
      setNewName(''); setIsCreating(false)
    } catch (err) {
      setLocalError(err?.message || 'No se pudo guardar.')
    }
  }

  const handleConfirmRename = async (viewId) => {
    setLocalError('')
    try {
      await onRenameView?.(viewId, editingName)
      setEditingViewId(null)
    } catch (err) {
      setLocalError(err?.message || 'Nombre inválido.')
    }
  }

  return (
    <div ref={containerRef} className="relative shrink-0 font-sans">
      <button
        type="button"
        onClick={() => { setIsOpen((prev) => !prev); setLocalError('') }}
        title={activeView ? `Vista activa: ${activeView.name} (${views.length}/${maxViews})` : `Vistas de filtro guardadas (${views.length}/${maxViews})`}
        className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
          isOpen || activeView
            ? 'bg-cyan-500/15 border-cyan-400/80 text-cyan-200 shadow-sm shadow-cyan-500/15'
            : 'bg-slate-900/90 border-slate-700/80 text-slate-300 hover:border-cyan-500/60 hover:text-white'
        }`}
      >
        <Star className={`w-3.5 h-3.5 ${activeView ? 'text-cyan-300 fill-cyan-300/30' : 'text-cyan-400'}`} />
        <span>{activeView ? activeView.name : 'Vistas'} ({views.length}/{maxViews})</span>
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl z-50 text-xs text-slate-200 overflow-visible">
          <div className="p-1.5 border-b border-slate-800">
            {isCreating ? (
              <div className="flex items-center gap-1 p-1">
                <input
                  ref={createInputRef}
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleConfirmCreate() } }}
                  maxLength={50}
                  placeholder="Nombre de la vista..."
                  className="flex-1 min-w-0 bg-slate-950 border border-cyan-500/70 rounded-md px-2 py-1 text-xs text-white placeholder-slate-500 outline-none"
                />
                <button type="button" onClick={handleConfirmCreate} className="p-1 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 cursor-pointer" title="Guardar vista">
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => { setIsCreating(false); setNewName(''); setLocalError('') }} className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer" title="Cancelar">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={!canCreate}
                onClick={() => { setIsCreating(true); setManageMode(false); setConfirmClearAll(false) }}
                title={views.length >= maxViews ? `Límite de ${maxViews} vistas alcanzado` : !hasActiveFilters ? 'Aplicá al menos un filtro primero' : 'Guardar combinación actual'}
                className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left font-semibold transition-colors text-cyan-300 hover:bg-slate-800/80 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 shrink-0" />
                <span>Guardar vista actual</span>
                {views.length >= maxViews && <span className="ml-auto text-[10px] text-amber-400">5/5</span>}
              </button>
            )}
          </div>

          {localError && <div className="px-3 py-1.5 bg-rose-950/60 border-b border-rose-500/30 text-[11px] text-rose-300">{localError}</div>}

          <div className="py-1 max-h-64 overflow-visible">
            {views.length === 0 ? (
              <div className="px-3 py-3 text-center text-[11px] text-slate-500">Sin vistas guardadas en este módulo</div>
            ) : (
              views.map((view) => (
                <SavedFilterViewRow
                  key={view.id}
                  view={view}
                  isActive={view.id === activeViewId}
                  isHovered={view.id === hoveredViewId}
                  manageMode={manageMode}
                  isEditing={view.id === editingViewId}
                  editingName={editingName}
                  setEditingName={setEditingName}
                  editInputRef={editInputRef}
                  hasActiveFilters={hasActiveFilters}
                  onHover={(id) => setHoveredViewId(id)}
                  onApply={(v) => { onApplyView?.(v); setIsOpen(false); setHoveredViewId(null) }}
                  onStartEdit={(v) => { setEditingViewId(v.id); setEditingName(v.name) }}
                  onConfirmRename={handleConfirmRename}
                  onCancelEdit={() => setEditingViewId(null)}
                  onUpdateWithCurrent={onUpdateViewWithCurrent}
                  onDelete={onDeleteView}
                />
              ))
            )}
          </div>

          {views.length > 0 && (
            <div className="border-t border-slate-800 p-1.5 flex items-center justify-between gap-2">
              {confirmClearAll ? (
                <div className="w-full flex items-center justify-between gap-2 px-1.5 py-0.5">
                  <span className="text-[11px] text-rose-300 font-semibold">¿Borrar las {views.length}?</span>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={async () => { await onClearAllViews?.(); setConfirmClearAll(false); setManageMode(false) }} className="px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] cursor-pointer">Sí</button>
                    <button type="button" onClick={() => setConfirmClearAll(false)} className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer">No</button>
                  </div>
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => { setManageMode((prev) => !prev); setEditingViewId(null); setHoveredViewId(null) }}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      manageMode ? 'text-emerald-300 bg-emerald-950/40 hover:bg-emerald-950/70' : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    {manageMode ? <><Check className="w-3.5 h-3.5" /><span>Listo</span></> : <><Settings className="w-3.5 h-3.5 text-slate-400" /><span>Gestionar vistas</span></>}
                  </button>
                  <button type="button" onClick={() => setConfirmClearAll(true)} className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer" title="Borrar todas las vistas">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
