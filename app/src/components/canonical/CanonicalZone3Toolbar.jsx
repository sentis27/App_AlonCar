import { X, Undo2, Redo2, Layers, LayoutGrid } from 'lucide-react'
import CrawlerSearchBar from '../CrawlerSearchBar'
import {
  CLEAR_FILTER_BTN_CLASS,
  ZONE3_UNDO_GROUP_CLASS,
  ZONE3_VIEW_TOGGLE_GROUP_CLASS,
  getUndoButtonClass,
  getRedoButtonClass,
  getViewToggleButtonClass,
  resolveGridHistoryControl
} from '../../lib/filterThemeConstants'

/**
 * CanonicalZone3Toolbar
 * Pieza maestra única de Zona 3 (.alon-zone-toolbar) en 2 niveles fijos:
 * - Nivel 1: Buscador omnicanal (CrawlerSearchBar) + Vistas guardadas.
 * - Nivel 2: Izquierda (filtros variables de cada planilla) | Derecha constante
 *   ([✕ Limpiar filtro] rojo si hay filtros -> cápsula fija [Undo/Redo] -> toggle [Filas/Fichas]).
 */
export default function CanonicalZone3Toolbar({
  searchValue = '',
  onSearchChange,
  searchInputRef = null,
  searchPlaceholder = 'Buscar... (Ctrl+F | Esc limpia todo)',
  viewsController = null,
  showCrawlerBadge = true,
  filters = null,
  counterText = null,
  hasActiveFilters = false,
  onClearAllFilters = null,
  history = null,
  viewModeToggle = null,
  className = ''
}) {
  const resolvedHistory = resolveGridHistoryControl(history)
  const showClearBtn = Boolean(hasActiveFilters && onClearAllFilters)
  const hasLevel2 = Boolean(filters || counterText || showClearBtn || resolvedHistory || viewModeToggle)

  const rowsValue = viewModeToggle?.rowsValue ?? 'filas'
  const cardsValue = viewModeToggle?.cardsValue ?? 'fichas'

  return (
    <div data-testid="zone3-toolbar" className={`alon-zone-toolbar space-y-2.5 text-xs font-sans ${className}`.trim()}>
      <CrawlerSearchBar
        value={searchValue}
        onChange={onSearchChange}
        onClear={onClearAllFilters}
        hasActiveFilters={hasActiveFilters}
        inputRef={searchInputRef}
        viewsController={viewsController}
        showCrawlerBadge={showCrawlerBadge}
        placeholder={searchPlaceholder}
      />

      {hasLevel2 && (
        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5 min-w-0">
            {filters}
            {counterText && (
              <span className="text-[11px] text-slate-400 whitespace-nowrap hidden xl:inline pl-1">
                {counterText}
              </span>
            )}
          </div>

          {(showClearBtn || resolvedHistory || viewModeToggle) && (
            <div className="flex items-center gap-2 ml-auto shrink-0">
              {showClearBtn && (
                <button
                  type="button"
                  data-testid="zone3-clear-filters"
                  onClick={onClearAllFilters}
                  className={CLEAR_FILTER_BTN_CLASS}
                  title="Limpiar todos los filtros (Esc)"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Limpiar filtro</span>
                </button>
              )}

              {resolvedHistory && (
                <div className={ZONE3_UNDO_GROUP_CLASS} role="group" aria-label="Historial de cambios">
                  <button
                    type="button"
                    data-testid="zone3-undo"
                    disabled={!resolvedHistory.canUndo}
                    onClick={() => resolvedHistory.onUndo?.()}
                    className={getUndoButtonClass(resolvedHistory.canUndo)}
                    title={
                      resolvedHistory.canUndo
                        ? `Deshacer último cambio (Ctrl+Z)${resolvedHistory.undoCount > 0 ? ` · ${resolvedHistory.undoCount} paso(s)` : ''}`
                        : 'Sin cambios para deshacer (Ctrl+Z)'
                    }
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    {resolvedHistory.canUndo && resolvedHistory.undoCount > 0 && (
                      <span className="font-mono text-[10px]">({resolvedHistory.undoCount})</span>
                    )}
                  </button>
                  <button
                    type="button"
                    data-testid="zone3-redo"
                    disabled={!resolvedHistory.canRedo}
                    onClick={() => resolvedHistory.onRedo?.()}
                    className={getRedoButtonClass(resolvedHistory.canRedo)}
                    title={
                      resolvedHistory.canRedo
                        ? `Rehacer cambio (Ctrl+Y)${resolvedHistory.redoCount > 0 ? ` · ${resolvedHistory.redoCount} paso(s)` : ''}`
                        : 'Sin cambios para rehacer (Ctrl+Y)'
                    }
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                    {resolvedHistory.canRedo && resolvedHistory.redoCount > 0 && (
                      <span className="font-mono text-[10px]">({resolvedHistory.redoCount})</span>
                    )}
                  </button>
                </div>
              )}

              {viewModeToggle && (
                <div className={ZONE3_VIEW_TOGGLE_GROUP_CLASS} role="group" aria-label="Modo de visualización">
                  <button
                    type="button"
                    data-testid="zone3-view-rows"
                    onClick={() => viewModeToggle.onChange?.(rowsValue)}
                    className={getViewToggleButtonClass(viewModeToggle.value === rowsValue)}
                    title="Vista planilla editable"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span>{viewModeToggle.rowsLabel ?? 'Filas'}</span>
                  </button>
                  <button
                    type="button"
                    data-testid="zone3-view-cards"
                    onClick={() => viewModeToggle.onChange?.(cardsValue)}
                    className={getViewToggleButtonClass(viewModeToggle.value === cardsValue)}
                    title="Vista en fichas / tarjetas"
                  >
                    <LayoutGrid className="w-3.5 h-3.5" />
                    <span>{viewModeToggle.cardsLabel ?? 'Fichas'}</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
