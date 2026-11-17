import React from 'react'
import { Check, X, Pencil, RefreshCw } from 'lucide-react'

/**
 * Fila individual dentro de SavedFilterViewsDropdown:
 * modo limpio (nombre + tooltip emergente estilo OT) o modo gestión ágil.
 */
export default function SavedFilterViewRow({
  view,
  isActive,
  isHovered,
  manageMode,
  isEditing,
  editingName,
  setEditingName,
  editInputRef,
  hasActiveFilters,
  onHover,
  onApply,
  onStartEdit,
  onConfirmRename,
  onCancelEdit,
  onUpdateWithCurrent,
  onDelete
}) {
  const summaryLines = view.summaryLines?.length > 0 ? view.summaryLines : ['Sin filtros detallados']

  return (
    <div
      className="relative"
      onMouseEnter={() => !manageMode && onHover?.(view.id)}
      onMouseLeave={() => onHover?.(null)}
    >
      {manageMode ? (
        <div className="flex items-center gap-1 px-2.5 py-1.5 hover:bg-slate-800/60">
          {isEditing ? (
            <>
              <input
                ref={editInputRef}
                type="text"
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    onConfirmRename(view.id)
                  }
                }}
                maxLength={50}
                className="flex-1 min-w-0 bg-slate-950 border border-cyan-500/70 rounded px-2 py-0.5 text-xs text-white outline-none"
              />
              <button
                type="button"
                onClick={() => onConfirmRename(view.id)}
                className="p-1 text-emerald-400 hover:text-emerald-300 cursor-pointer"
                title="Confirmar nombre"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={onCancelEdit}
                className="p-1 text-slate-400 hover:text-white cursor-pointer"
                title="Cancelar"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          ) : (
            <>
              <span className="flex-1 truncate text-slate-200 font-medium pl-1">{view.name}</span>
              <button
                type="button"
                onClick={() => onStartEdit(view)}
                className="p-1 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-700/60 cursor-pointer"
                title="Renombrar vista"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                type="button"
                disabled={!hasActiveFilters}
                onClick={() => onUpdateWithCurrent?.(view.id)}
                className="p-1 rounded text-slate-400 hover:text-emerald-300 hover:bg-slate-700/60 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title={hasActiveFilters ? 'Actualizar con filtros actuales' : 'Aplicá filtros primero'}
              >
                <RefreshCw className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={() => onDelete?.(view.id)}
                className="p-1 rounded text-slate-400 hover:text-rose-400 hover:bg-rose-950/50 cursor-pointer"
                title="Borrar esta vista"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => onApply(view)}
          className={`w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors cursor-pointer ${
            isActive ? 'bg-cyan-500/10 text-cyan-200 font-semibold' : 'text-slate-200 hover:bg-slate-800/80'
          }`}
        >
          <span className="w-3.5 shrink-0 flex items-center justify-center">
            {isActive && <Check className="w-3.5 h-3.5 text-cyan-400" />}
          </span>
          <span className="truncate flex-1">{view.name}</span>
        </button>
      )}

      {/* Tooltip emergente estilo OT al posicionar el cursor */}
      {!manageMode && isHovered && (
        <div className="hidden sm:block absolute right-full mr-2 top-0 w-64 bg-slate-100 text-slate-900 border border-slate-300 rounded-lg shadow-2xl p-2.5 z-[60] pointer-events-none">
          <div className="font-bold text-slate-950 truncate">Vista: {view.name}</div>
          <div className="text-[11px] text-slate-600 mt-1 mb-0.5 font-semibold">
            Filtros activos ({summaryLines.length}):
          </div>
          <ul className="space-y-0.5 text-[11px] text-slate-800">
            {summaryLines.map((line, idx) => (
              <li key={idx} className="truncate">• {line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
