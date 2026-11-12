import { useState, useEffect, useCallback } from 'react'

/**
 * useGridNavigation
 * Sub-hook especializado para gestionar la navegación direccional por teclado estilo Excel/Sheets,
 * atajos de teclado globales (Ctrl+Z, Ctrl+Y, Ctrl+F), apertura de editores y el tirador de arrastre (Fill Handle ■).
 */
export function useGridNavigation({
  rows = [],
  columns = [],
  getRowId = (row) => row?.id,
  selection,
  clipboard,
  history,
  canEditCell = () => true,
  readCellValue,
  formatCellDisplay,
  onBatchUpdate,
  onFocusSearch,
  onCellActivate,
  showFeedback
}) {
  // Arrastre del Tirador de Esquina (Fill Handle ■)
  const [isDraggingFill, setIsDraggingFill] = useState(false)
  const [fillRange, setFillRange] = useState(null) // { colIndex, fromRow, toRow }

  // Ejecutar Fill Down (Ctrl + D o al soltar el tirador ■)
  const executeFillDown = useCallback(async (startRowIdx, endRowIdx, colIdx) => {
    if (rows.length === 0 || colIdx < 0 || colIdx >= columns.length) return
    const colDef = columns[colIdx]
    if (!colDef || colDef.readOnly) {
      if (showFeedback) showFeedback('error', 'Esta columna es de solo lectura y no permite rellenar hacia abajo.')
      return
    }

    const minRow = Math.min(startRowIdx, endRowIdx)
    const maxRow = Math.max(startRowIdx, endRowIdx)
    if (minRow === maxRow) return

    const sourceRow = rows[minRow]
    if (!sourceRow) return

    const sourceValue = readCellValue(sourceRow, colDef)
    const displayStr = formatCellDisplay(sourceValue, sourceRow, colDef)
    const targetRows = rows.slice(minRow + 1, maxRow + 1)
    if (targetRows.length === 0) return

    const validRows = targetRows.filter((r) => canEditCell(r, colDef.key, sourceValue))
    if (validRows.length === 0) {
      if (showFeedback) showFeedback('error', 'Las filas seleccionadas no permiten esta modificación directa.')
      return
    }

    const previousValues = {}
    validRows.forEach((r) => {
      previousValues[getRowId(r)] = readCellValue(r, colDef)
    })

    const targetIds = validRows.map(getRowId)

    history.pushUndoAction({
      colKey: colDef.key,
      colLabel: colDef.label || colDef.key,
      actionLabel: 'Rellenar hacia abajo (Ctrl+D)',
      previousValues,
      newValue: sourceValue,
      timestamp: Date.now()
    })

    if (onBatchUpdate) {
      await onBatchUpdate({
        colKey: colDef.key,
        newValue: sourceValue,
        targetIds,
        isRevert: false,
        actionLabel: 'Fill Down'
      })
    }

    if (showFeedback) {
      showFeedback('success', `Rellenadas ${validRows.length} fila(s) con "${displayStr}".`)
    }
  }, [rows, columns, getRowId, canEditCell, history, onBatchUpdate, showFeedback, readCellValue, formatCellDisplay])

  // Tirador Mouse Handlers
  const handleFillHandleMouseDown = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()
    if (!selection.activeCell) return
    setIsDraggingFill(true)
    setFillRange({
      colIndex: selection.activeCell.colIndex,
      fromRow: selection.activeCell.rowIndex,
      toRow: selection.activeCell.rowIndex
    })
  }, [selection.activeCell])

  const handleFillHandleDoubleClick = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()
    if (!selection.activeCell) return
    const lastRowIndex = rows.length - 1
    if (lastRowIndex > selection.activeCell.rowIndex) {
      executeFillDown(selection.activeCell.rowIndex, lastRowIndex, selection.activeCell.colIndex)
    }
  }, [selection.activeCell, rows.length, executeFillDown])

  // Window mouseup listener para finalizar arrastres
  useEffect(() => {
    function handleGlobalMouseUp() {
      if (isDraggingFill && fillRange && selection.activeCell) {
        if (fillRange.toRow > fillRange.fromRow) {
          executeFillDown(fillRange.fromRow, fillRange.toRow, fillRange.colIndex)
        }
      }
      selection.setIsMouseDown(false)
      setIsDraggingFill(false)
      setFillRange(null)
      selection.setDragAnchor(null)
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [isDraggingFill, fillRange, selection, executeFillDown])

  // Manejador Central de Teclado (Navegación + Atajos)
  const handleKeyDown = useCallback((e) => {
    const isEditingInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)
    const { activeCell, selectionRange, selectedRowIds, setSelectionRange, setActiveCell } = selection

    if ((e.key === 'Delete' || e.key === 'Backspace') && !isEditingInput && activeCell) {
      e.preventDefault()
      clipboard.deleteActiveCellOrRange()
      return
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault()
      if (onFocusSearch) onFocusSearch()
      return
    }

    if ((e.ctrlKey || e.metaKey) && ((e.key === 'y' || e.key === 'Y') || ((e.key === 'z' || e.key === 'Z') && e.shiftKey)) && !isEditingInput) {
      e.preventDefault()
      history.redo()
      return
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey && !isEditingInput) {
      e.preventDefault()
      history.undo()
      return
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && !isEditingInput) {
      e.preventDefault()
      if (e.shiftKey && activeCell) {
        clipboard.copyRow(activeCell.rowIndex)
        return
      }
      if (selectedRowIds.size === 1) {
        const selId = Array.from(selectedRowIds)[0]
        const selIdx = rows.findIndex((r, idx) => getRowId(r, idx) === selId)
        if (selIdx !== -1 && (!activeCell || activeCell.rowIndex === selIdx)) {
          clipboard.copyRow(selIdx)
          return
        }
      }
      clipboard.copyActiveCell()
      return
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V') && !isEditingInput) {
      e.preventDefault()
      clipboard.pasteToActiveOrRange()
      return
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && !isEditingInput) {
      e.preventDefault()
      if (!activeCell) return
      let startRow = activeCell.rowIndex
      let endRow = activeCell.rowIndex
      let colIdx = activeCell.colIndex

      if (selectionRange && selectionRange.startCol === selectionRange.endCol) {
        startRow = Math.min(selectionRange.startRow, selectionRange.endRow)
        endRow = Math.max(selectionRange.startRow, selectionRange.endRow)
        colIdx = selectionRange.startCol
      }

      if (startRow < endRow) {
        executeFillDown(startRow, endRow, colIdx)
      } else if (startRow > 0) {
        executeFillDown(startRow - 1, startRow, colIdx)
      } else {
        if (showFeedback) showFeedback('info', 'Selecciona varias filas hacia abajo (Shift+↓ o mouse) para rellenar con Ctrl+D.')
      }
      return
    }

    if (e.key === 'Tab' && !isEditingInput && activeCell) {
      e.preventDefault()
      const numRows = rows.length
      const numCols = columns.length
      if (numRows === 0 || numCols === 0) return

      let nextCol = activeCell.colIndex
      let nextRow = activeCell.rowIndex

      if (e.shiftKey) {
        if (nextCol > 0) nextCol -= 1
        else if (nextRow > 0) { nextRow -= 1; nextCol = numCols - 1 }
      } else {
        if (nextCol < numCols - 1) nextCol += 1
        else if (nextRow < numRows - 1) { nextRow += 1; nextCol = 0 }
      }

      setSelectionRange(null)
      setActiveCell({
        rowIndex: nextRow,
        colIndex: nextCol,
        rowId: getRowId(rows[nextRow]),
        colKey: columns[nextCol]?.key
      })
      return
    }

    if (e.key === 'Enter' && e.shiftKey && !isEditingInput && activeCell) {
      e.preventDefault()
      if (activeCell.rowIndex > 0) {
        const nextRow = activeCell.rowIndex - 1
        setSelectionRange(null)
        setActiveCell({
          rowIndex: nextRow,
          colIndex: activeCell.colIndex,
          rowId: getRowId(rows[nextRow]),
          colKey: columns[activeCell.colIndex]?.key
        })
      }
      return
    }

    if ((e.key === 'Enter' || e.key === 'F2') && !e.shiftKey && !isEditingInput && activeCell) {
      const row = rows[activeCell.rowIndex]
      const colDef = columns[activeCell.colIndex]
      if (row && colDef && !colDef.readOnly && onCellActivate) {
        e.preventDefault()
        onCellActivate(row, colDef, activeCell.rowIndex, activeCell.colIndex)
        return
      }
      if (e.key === 'Enter' && activeCell.rowIndex < rows.length - 1) {
        e.preventDefault()
        const nextRow = activeCell.rowIndex + 1
        setSelectionRange(null)
        setActiveCell({
          rowIndex: nextRow,
          colIndex: activeCell.colIndex,
          rowId: getRowId(rows[nextRow]),
          colKey: columns[activeCell.colIndex]?.key
        })
        return
      }
    }

    if (e.key === 'Escape' && !isEditingInput) {
      if (selectionRange) setSelectionRange(null)
      return
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isEditingInput) {
      e.preventDefault()
      if (!activeCell && rows.length > 0) {
        setActiveCell({ rowIndex: 0, colIndex: 0, rowId: getRowId(rows[0]), colKey: columns[0]?.key })
        return
      }
      if (!activeCell) return

      const numRows = rows.length
      const numCols = columns.length
      if (numRows === 0 || numCols === 0) return

      let newRow = Math.min(numRows - 1, Math.max(0, activeCell.rowIndex))
      let newCol = Math.min(numCols - 1, Math.max(0, activeCell.colIndex))

      if (e.key === 'ArrowUp') newRow = Math.max(0, newRow - 1)
      if (e.key === 'ArrowDown') newRow = Math.min(numRows - 1, newRow + 1)
      if (e.key === 'ArrowLeft') newCol = Math.max(0, newCol - 1)
      if (e.key === 'ArrowRight') newCol = Math.min(numCols - 1, newCol + 1)

      if (e.shiftKey) {
        const anchorRow = selectionRange ? selectionRange.startRow : activeCell.rowIndex
        const anchorCol = selectionRange ? selectionRange.startCol : activeCell.colIndex
        setSelectionRange({
          startRow: anchorRow,
          endRow: newRow,
          startCol: anchorCol,
          endCol: newCol
        })
      } else {
        setSelectionRange(null)
        setActiveCell({
          rowIndex: newRow,
          colIndex: newCol,
          rowId: getRowId(rows[newRow]),
          colKey: columns[newCol]?.key
        })
      }
    }
  }, [selection, clipboard, history, rows, columns, getRowId, onFocusSearch, onCellActivate, executeFillDown, showFeedback])

  // Listener global de teclado para que Ctrl+Z, Ctrl+Y y Ctrl+F funcionen siempre
  useEffect(() => {
    function handleGlobalKeyDown(e) {
      if (e.defaultPrevented) return
      const isEditingInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName)

      if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
        if (onFocusSearch) {
          e.preventDefault()
          onFocusSearch()
        }
        return
      }

      if (isEditingInput) return

      if ((e.ctrlKey || e.metaKey) && ((e.key === 'y' || e.key === 'Y') || ((e.key === 'z' || e.key === 'Z') && e.shiftKey))) {
        e.preventDefault()
        history.redo()
        return
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
        e.preventDefault()
        history.undo()
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [history, onFocusSearch])

  // Helper checkers para renderizado visual
  const isCellInFillPreview = useCallback((rowIndex, colIndex) => {
    if (!fillRange) return false
    if (colIndex !== fillRange.colIndex) return false
    const maxR = Math.max(fillRange.fromRow, fillRange.toRow)
    return rowIndex > fillRange.fromRow && rowIndex <= maxR
  }, [fillRange])

  const shouldRenderFillHandle = useCallback((rowIndex, colIndex) => {
    if (!selection.activeCell) return false
    const colDef = columns[colIndex]
    if (colDef?.readOnly) return false

    if (selection.selectionRange) {
      const maxR = Math.max(selection.selectionRange.startRow, selection.selectionRange.endRow)
      const maxC = Math.max(selection.selectionRange.startCol, selection.selectionRange.endCol)
      return rowIndex === maxR && colIndex === maxC
    }
    return selection.activeCell.rowIndex === rowIndex && selection.activeCell.colIndex === colIndex
  }, [selection.activeCell, selection.selectionRange, columns])

  return {
    fillRange,
    isDraggingFill,
    setIsDraggingFill,
    setFillRange,
    executeFillDown,
    handleFillHandleMouseDown,
    handleFillHandleDoubleClick,
    handleKeyDown,
    isCellInFillPreview,
    shouldRenderFillHandle
  }
}
