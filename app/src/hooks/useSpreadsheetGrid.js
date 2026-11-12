import { useRef, useCallback } from 'react'
import { useGridHistory } from './grid/useGridHistory.js'
import { useGridSelection } from './grid/useGridSelection.js'
import { useGridClipboard } from './grid/useGridClipboard.js'
import { useGridNavigation } from './grid/useGridNavigation.js'

/**
 * useSpreadsheetGrid
 * 
 * Hook transversal canónico para dotar a cualquier grilla de AlonCar ERP
 * de la ergonomía, navegación y atajos rápidos de Google Sheets / Microsoft Excel:
 * - Navegación con flechas (↑ ↓ ← →) entre celdas y Tab / Shift+Tab / Enter / Shift+Enter
 * - Enter o F2 sobre celda activa para abrir edición rápida
 * - Selección espacial de celdas y rangos (Shift + Flechas o Arrastre con Mouse)
 * - Selección canónica de filas completas con checkboxes y botón '#' apilado
 * - Cuadradito "Tirador" de esquina (Fill Handle ■) para arrastrar y rellenar hacia abajo (Ctrl+D)
 * - Portapapeles 2D Paste Matrix (Excel / Sheets) con sanitización de tipos
 * - Deshacer (Ctrl+Z) y Rehacer (Ctrl+Y) de hasta 50 pasos con persistencia y auditoría
 * - Estadísticas en vivo de selección (Σ, Ø, Recuento)
 */
export function useSpreadsheetGrid({
  rows = [],
  columns = [],
  getRowId = (row) => row?.id,
  onBatchUpdate,
  onFocusSearch,
  onCellActivate,
  onPasteRow,
  canEditCell = () => true,
  maxUndoSteps = 50,
  storageKey = 'aloncar_grid',
  showFeedback
}) {
  const gridContainerRef = useRef(null)

  // 1. Helpers para lectura y formateo de celdas
  const readCellValue = useCallback((row, colDef) => {
    if (!row || !colDef) return undefined
    if (typeof colDef.getValue === 'function') {
      return colDef.getValue(row)
    }
    return row[colDef.key]
  }, [])

  const formatCellDisplay = useCallback((val, row, colDef) => {
    if (colDef && typeof colDef.formatDisplay === 'function') {
      return colDef.formatDisplay(val, row)
    }
    if (val === null || val === undefined || val === '') return '—'
    if (typeof val === 'object') {
      if (val.label) return String(val.label)
      return JSON.stringify(val)
    }
    return String(val)
  }, [])

  // 2. Sub-hook: Historial de Deshacer / Rehacer y Auditoría
  const history = useGridHistory({
    storageKey,
    maxUndoSteps,
    rows,
    columns,
    getRowId,
    onBatchUpdate,
    showFeedback
  })

  // 3. Sub-hook: Selección espacial, de filas y estadísticas
  const selection = useGridSelection({
    rows,
    columns,
    getRowId,
    readCellValue
  })

  // 4. Sub-hook: Portapapeles 2D, matriz de pegado y borrado
  const clipboard = useGridClipboard({
    rows,
    columns,
    getRowId,
    activeCell: selection.activeCell,
    selectionRange: selection.selectionRange,
    canEditCell,
    readCellValue,
    formatCellDisplay,
    pushUndoAction: history.pushUndoAction,
    onBatchUpdate,
    onPasteRow,
    showFeedback
  })

  // 5. Sub-hook: Navegación por teclado, atajos y tirador (Fill Handle)
  const navigation = useGridNavigation({
    rows,
    columns,
    getRowId,
    selection,
    clipboard,
    history,
    canEditCell,
    readCellValue,
    formatCellDisplay,
    onBatchUpdate,
    onFocusSearch,
    onCellActivate,
    showFeedback
  })

  return {
    // Selección espacial y coordenadas
    activeCell: selection.activeCell,
    activeCellBadge: selection.activeCellBadge,
    selectionStats: selection.selectionStats,
    setActiveCell: selection.setActiveCell,
    selectionRange: selection.selectionRange,
    setSelectionRange: selection.setSelectionRange,
    handleCellClick: selection.handleCellClick,
    handleCellMouseDown: selection.handleCellMouseDown,
    handleCellMouseEnter: selection.handleCellMouseEnter,
    isCellActive: selection.isCellActive,
    isCellSelected: selection.isCellSelected,

    // Selección canónica de filas (Columna 0 #)
    selectedRowIds: selection.selectedRowIds,
    setSelectedRowIds: selection.setSelectedRowIds,
    toggleSelectRow: selection.toggleSelectRow,
    toggleSelectAll: selection.toggleSelectAll,
    clearSelectedRows: selection.clearSelectedRows,
    isRowSelected: selection.isRowSelected,

    // Historial Undo / Redo
    undoStack: history.undoStack,
    pushUndoAction: history.pushUndoAction,
    canUndo: history.canUndo,
    undo: history.undo,
    redoStack: history.redoStack,
    canRedo: history.canRedo,
    redo: history.redo,

    // Portapapeles y mutaciones matriciales
    copyActiveCell: clipboard.copyActiveCell,
    copyRow: clipboard.copyRow,
    internalClipboard: clipboard.internalClipboard,
    pasteToActiveOrRange: clipboard.pasteToActiveOrRange,
    handlePaste: clipboard.handlePaste,
    processPasteText: clipboard.processPasteText,
    deleteActiveCellOrRange: clipboard.deleteActiveCellOrRange,

    // Navegación direccional y Fill Handle
    fillRange: navigation.fillRange,
    isDraggingFill: navigation.isDraggingFill,
    executeFillDown: navigation.executeFillDown,
    handleFillHandleMouseDown: navigation.handleFillHandleMouseDown,
    handleFillHandleDoubleClick: navigation.handleFillHandleDoubleClick,
    handleKeyDown: navigation.handleKeyDown,
    isCellInFillPreview: navigation.isCellInFillPreview,
    shouldRenderFillHandle: navigation.shouldRenderFillHandle,

    // Referencia al contenedor
    gridContainerRef
  }
}
