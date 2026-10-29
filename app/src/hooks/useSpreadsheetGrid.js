import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * useSpreadsheetGrid
 * 
 * Hook transversal para dotar a cualquier tabla de la plataforma Alon Car
 * de la ergonomía, navegación y atajos rápidos de Google Sheets / Microsoft Excel:
 * - Navegación con flechas (↑ ↓ ← →) entre celdas
 * - Selección de celdas y rangos (Shift + Flechas o Arrastre con Mouse)
 * - Cuadradito "Tirador" de esquina (Fill Handle) para arrastrar y rellenar hacia abajo
 * - Doble clic en el tirador para auto-rellenar hasta el final
 * - Ctrl + C (Copiar) / Ctrl + V (Pegar en celda o rango)
 * - Ctrl + D (Fill Down: clonar valor de la primera celda hacia abajo)
 * - Ctrl + Z (Deshacer histórico de hasta 50 pasos, aislado por usuario)
 * - Ctrl + F (Enfocar buscador rápido de la tabla sin abrir la búsqueda de Chrome)
 */
export function useSpreadsheetGrid({
  rows = [],
  columns = [],
  getRowId = (row) => row.id,
  onBatchUpdate,
  onFocusSearch,
  canEditCell = () => true,
  maxUndoSteps = 50,
  showFeedback
}) {
  // Coordenadas de Celda Activa { rowIndex, colIndex, rowId, colKey }
  const [activeCell, setActiveCell] = useState(null)

  // Rango de selección { startRow, endRow, startCol, endCol } (índices numéricos)
  const [selectionRange, setSelectionRange] = useState(null)

  // Arrastre con Mouse para Selección de Rango
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [dragAnchor, setDragAnchor] = useState(null)

  // Arrastre del Tirador de Esquina (Fill Handle)
  const [isDraggingFill, setIsDraggingFill] = useState(false)
  const [fillRange, setFillRange] = useState(null) // { colIndex, fromRow, toRow }

  // Portapapeles Interno { colKey, value }
  const [internalClipboard, setInternalClipboard] = useState(null)

  // Pila de Deshacer (Undo Stack) aislada en memoria de la sesión
  const [undoStack, setUndoStack] = useState(() => {
    try {
      const saved = sessionStorage.getItem('aloncar_grid_undo_stack')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const gridContainerRef = useRef(null)

  // Sincronizar undoStack con sessionStorage (máx 50 pasos)
  const pushUndoAction = useCallback((action) => {
    setUndoStack((prev) => {
      const next = [action, ...prev].slice(0, maxUndoSteps)
      try {
        sessionStorage.setItem('aloncar_grid_undo_stack', JSON.stringify(next))
      } catch (e) {
        console.warn('Error guardando undo en sessionStorage:', e)
      }
      return next
    })
  }, [maxUndoSteps])

  // Deshacer el último cambio (Ctrl + Z)
  const undo = useCallback(async () => {
    if (undoStack.length === 0) {
      if (showFeedback) showFeedback('info', 'No hay más acciones para deshacer.')
      return
    }

    const [lastAction, ...remainingStack] = undoStack
    setUndoStack(remainingStack)
    try {
      sessionStorage.setItem('aloncar_grid_undo_stack', JSON.stringify(remainingStack))
    } catch {}

    if (onBatchUpdate && lastAction.previousValues) {
      // Revertir en Supabase y estado local
      const entries = Object.entries(lastAction.previousValues)
      await onBatchUpdate({
        colKey: lastAction.colKey,
        revertMap: lastAction.previousValues,
        isRevert: true,
        actionLabel: lastAction.actionLabel || 'deshacer'
      })

      if (showFeedback) {
        showFeedback('success', `Deshecho: Se restauraron ${entries.length} registro(s) en ${lastAction.colLabel || lastAction.colKey}.`)
      }
    }
  }, [undoStack, onBatchUpdate, showFeedback])

  // Ejecutar Fill Down (Ctrl + D o al soltar el tirador)
  const executeFillDown = useCallback(async (startRowIdx, endRowIdx, colIdx) => {
    if (rows.length === 0 || colIdx < 0 || colIdx >= columns.length) return
    const colDef = columns[colIdx]
    if (!colDef || colDef.readOnly) {
      if (showFeedback) showFeedback('error', 'Esta columna no permite rellenar hacia abajo.')
      return
    }

    const minRow = Math.min(startRowIdx, endRowIdx)
    const maxRow = Math.max(startRowIdx, endRowIdx)
    if (minRow === maxRow) return // Nada que rellenar

    const sourceRow = rows[minRow]
    if (!sourceRow) return

    const sourceValue = sourceRow[colDef.key]
    const targetRows = rows.slice(minRow + 1, maxRow + 1)
    if (targetRows.length === 0) return

    // Verificar si alguna celda no es editable por reglas de negocio
    const validRows = targetRows.filter((r) => canEditCell(r, colDef.key, sourceValue))
    if (validRows.length === 0) {
      if (showFeedback) showFeedback('error', 'Las filas seleccionadas no permiten esta modificación directa.')
      return
    }

    // Guardar valores anteriores para Ctrl + Z
    const previousValues = {}
    validRows.forEach((r) => {
      const id = getRowId(r)
      previousValues[id] = r[colDef.key]
    })

    const targetIds = validRows.map(getRowId)

    // Registrar en pila de deshacer
    pushUndoAction({
      colKey: colDef.key,
      colLabel: colDef.label || colDef.key,
      actionLabel: 'Rellenar hacia abajo (Ctrl+D)',
      previousValues,
      newValue: sourceValue,
      timestamp: Date.now()
    })

    // Ejecutar actualización batch
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
      showFeedback('success', `Rellenadas ${validRows.length} fila(s) con "${sourceValue ?? '—'}".`)
    }
  }, [rows, columns, getRowId, canEditCell, pushUndoAction, onBatchUpdate, showFeedback])

  // Copiar valor de la celda activa (Ctrl + C)
  const copyActiveCell = useCallback(() => {
    if (!activeCell) return
    const row = rows[activeCell.rowIndex]
    const colDef = columns[activeCell.colIndex]
    if (!row || !colDef) return

    const val = row[colDef.key]
    setInternalClipboard({
      colKey: colDef.key,
      value: val,
      colLabel: colDef.label
    })

    // También copiar al portapapeles nativo como texto
    try {
      if (val !== undefined && val !== null) {
        navigator.clipboard.writeText(String(val)).catch(() => {})
      }
    } catch {}

    if (showFeedback) {
      showFeedback('info', `Copiado: "${val ?? '—'}" de ${colDef.label || colDef.key}`)
    }
  }, [activeCell, rows, columns, showFeedback])

  // Pegar valor en celda activa o rango seleccionado (Ctrl + V)
  const pasteToActiveOrRange = useCallback(async () => {
    if (!activeCell || !internalClipboard) {
      // Intentar leer texto del clipboard nativo si no hay memoria interna
      try {
        const text = await navigator.clipboard.readText()
        if (text && activeCell) {
          const colDef = columns[activeCell.colIndex]
          if (colDef && !colDef.readOnly) {
            const startR = selectionRange ? Math.min(selectionRange.startRow, selectionRange.endRow) : activeCell.rowIndex
            const endR = selectionRange ? Math.max(selectionRange.startRow, selectionRange.endRow) : activeCell.rowIndex
            const targetRows = rows.slice(startR, endR + 1)
            const validRows = targetRows.filter((r) => canEditCell(r, colDef.key, text))
            if (validRows.length > 0) {
              const previousValues = {}
              validRows.forEach((r) => { previousValues[getRowId(r)] = r[colDef.key] })
              pushUndoAction({
                colKey: colDef.key,
                colLabel: colDef.label || colDef.key,
                actionLabel: 'Pegar (Ctrl+V)',
                previousValues,
                newValue: text,
                timestamp: Date.now()
              })
              if (onBatchUpdate) {
                await onBatchUpdate({
                  colKey: colDef.key,
                  newValue: text,
                  targetIds: validRows.map(getRowId),
                  isRevert: false,
                  actionLabel: 'Pegar'
                })
              }
              if (showFeedback) showFeedback('success', `Pegado en ${validRows.length} celda(s).`)
            }
          }
        }
      } catch {}
      return
    }

    const colDef = columns[activeCell.colIndex]
    if (!colDef || colDef.readOnly) {
      if (showFeedback) showFeedback('error', 'Esta columna es de solo lectura.')
      return
    }

    const startR = selectionRange ? Math.min(selectionRange.startRow, selectionRange.endRow) : activeCell.rowIndex
    const endR = selectionRange ? Math.max(selectionRange.startRow, selectionRange.endRow) : activeCell.rowIndex
    const targetRows = rows.slice(startR, endR + 1)
    const validRows = targetRows.filter((r) => canEditCell(r, colDef.key, internalClipboard.value))

    if (validRows.length === 0) {
      if (showFeedback) showFeedback('error', 'Las celdas de destino no admiten este valor.')
      return
    }

    const previousValues = {}
    validRows.forEach((r) => {
      previousValues[getRowId(r)] = r[colDef.key]
    })

    pushUndoAction({
      colKey: colDef.key,
      colLabel: colDef.label || colDef.key,
      actionLabel: 'Pegar (Ctrl+V)',
      previousValues,
      newValue: internalClipboard.value,
      timestamp: Date.now()
    })

    if (onBatchUpdate) {
      await onBatchUpdate({
        colKey: colDef.key,
        newValue: internalClipboard.value,
        targetIds: validRows.map(getRowId),
        isRevert: false,
        actionLabel: 'Pegar'
      })
    }

    if (showFeedback) {
      showFeedback('success', `Pegado "${internalClipboard.value ?? '—'}" en ${validRows.length} celda(s).`)
    }
  }, [activeCell, internalClipboard, columns, selectionRange, rows, canEditCell, getRowId, pushUndoAction, onBatchUpdate, showFeedback])

  // Manejador Central de Teclado (Navegación + Atajos)
  const handleKeyDown = useCallback((e) => {
    // Si el usuario está escribiendo dentro de un input, select o textarea activo, no interceptamos flechas comunes
    const isEditingInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)

    // Ctrl + F: Enfocar buscador de la tabla
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault()
      if (onFocusSearch) onFocusSearch()
      return
    }

    // Ctrl + Z: Deshacer
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
      e.preventDefault()
      undo()
      return
    }

    // Ctrl + C: Copiar celda
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && !isEditingInput) {
      e.preventDefault()
      copyActiveCell()
      return
    }

    // Ctrl + V: Pegar en celda o rango
    if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V') && !isEditingInput) {
      e.preventDefault()
      pasteToActiveOrRange()
      return
    }

    // Ctrl + D: Fill Down (Rellenar hacia abajo en rango seleccionado)
    if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
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
        // Estilo Excel individual: si solo hay 1 celda seleccionada, copia la celda de ARRIBA a la actual
        executeFillDown(startRow - 1, startRow, colIdx)
      } else {
        if (showFeedback) showFeedback('info', 'Selecciona varias filas hacia abajo (Shift+↓ o mouse) para rellenar.')
      }
      return
    }

    // Escape: limpiar selección de rango o salir
    if (e.key === 'Escape') {
      if (selectionRange) {
        setSelectionRange(null)
      }
      return
    }

    // Flechas de navegación (solo cuando no está editando un campo de texto)
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && !isEditingInput) {
      e.preventDefault()
      if (!activeCell && rows.length > 0) {
        setActiveCell({ rowIndex: 0, colIndex: 0, rowId: getRowId(rows[0]), colKey: columns[0]?.key })
        return
      }
      if (!activeCell) return

      const numRows = rows.length
      const numCols = columns.length
      let newRow = activeCell.rowIndex
      let newCol = activeCell.colIndex

      if (e.key === 'ArrowUp') newRow = Math.max(0, newRow - 1)
      if (e.key === 'ArrowDown') newRow = Math.min(numRows - 1, newRow + 1)
      if (e.key === 'ArrowLeft') newCol = Math.max(0, newCol - 1)
      if (e.key === 'ArrowRight') newCol = Math.min(numCols - 1, newCol + 1)

      if (e.shiftKey) {
        // Expandir / contraer selección con Shift + Flechas (Rango de selección)
        const anchorRow = selectionRange ? selectionRange.startRow : activeCell.rowIndex
        const anchorCol = selectionRange ? selectionRange.startCol : activeCell.colIndex
        setSelectionRange({
          startRow: anchorRow,
          endRow: newRow,
          startCol: anchorCol,
          endCol: newCol
        })
      } else {
        // Movimiento simple: actualiza celda activa y limpia rango
        setSelectionRange(null)
        setActiveCell({
          rowIndex: newRow,
          colIndex: newCol,
          rowId: getRowId(rows[newRow]),
          colKey: columns[newCol]?.key
        })
      }
    }
  }, [activeCell, selectionRange, rows, columns, getRowId, onFocusSearch, undo, copyActiveCell, pasteToActiveOrRange, executeFillDown, showFeedback])

  // Mouse: Clic en celda
  const handleCellClick = useCallback((rowIndex, colIndex, e) => {
    const row = rows[rowIndex]
    const colDef = columns[colIndex]
    if (!row || !colDef) return

    if (e.shiftKey && activeCell) {
      // Shift + Clic = Seleccionar Rango
      setSelectionRange({
        startRow: activeCell.rowIndex,
        endRow: rowIndex,
        startCol: activeCell.colIndex,
        endCol: colIndex
      })
    } else {
      setActiveCell({
        rowIndex,
        colIndex,
        rowId: getRowId(row),
        colKey: colDef.key
      })
      setSelectionRange(null)
    }
  }, [rows, columns, activeCell, getRowId])

  // Mouse: Inicio de arrastre de selección en celdas
  const handleCellMouseDown = useCallback((rowIndex, colIndex, e) => {
    if (e.button !== 0) return // Solo clic izquierdo
    if (e.target.closest('.fill-handle')) return // No interferir con el tirador
    if (['SELECT', 'INPUT', 'BUTTON'].includes(e.target.tagName)) return // Dejar interactuar con el control

    setIsMouseDown(true)
    setDragAnchor({ rowIndex, colIndex })
  }, [])

  // Mouse: Arrastre sobre otra celda
  const handleCellMouseEnter = useCallback((rowIndex, colIndex) => {
    if (isDraggingFill && activeCell) {
      // Arrastre del tirador: limitamos a la misma columna de la celda activa
      setFillRange({
        colIndex: activeCell.colIndex,
        fromRow: activeCell.rowIndex,
        toRow: rowIndex
      })
    } else if (isMouseDown && dragAnchor) {
      // Arrastre normal de selección de celdas
      setSelectionRange({
        startRow: dragAnchor.rowIndex,
        endRow: rowIndex,
        startCol: dragAnchor.colIndex,
        endCol: colIndex
      })
    }
  }, [isDraggingFill, activeCell, isMouseDown, dragAnchor])

  // Mouse: Inicio de arrastre del tirador (Fill Handle)
  const handleFillHandleMouseDown = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()
    if (!activeCell) return
    setIsDraggingFill(true)
    setFillRange({
      colIndex: activeCell.colIndex,
      fromRow: activeCell.rowIndex,
      toRow: activeCell.rowIndex
    })
  }, [activeCell])

  // Mouse: Doble Clic en el tirador (Auto-Fill hasta la última fila con datos)
  const handleFillHandleDoubleClick = useCallback((e) => {
    e.stopPropagation()
    e.preventDefault()
    if (!activeCell) return
    const lastRowIndex = rows.length - 1
    if (lastRowIndex > activeCell.rowIndex) {
      executeFillDown(activeCell.rowIndex, lastRowIndex, activeCell.colIndex)
    }
  }, [activeCell, rows.length, executeFillDown])

  // Window mouseup listener para finalizar arrastres de forma robusta
  useEffect(() => {
    function handleGlobalMouseUp() {
      if (isDraggingFill && fillRange && activeCell) {
        if (fillRange.toRow > fillRange.fromRow) {
          executeFillDown(fillRange.fromRow, fillRange.toRow, fillRange.colIndex)
        }
      }
      setIsMouseDown(false)
      setIsDraggingFill(false)
      setFillRange(null)
      setDragAnchor(null)
    }

    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [isDraggingFill, fillRange, activeCell, executeFillDown])

  // Función utilitaria para verificar si una celda está activa
  const isCellActive = useCallback((rowIndex, colIndex) => {
    return activeCell && activeCell.rowIndex === rowIndex && activeCell.colIndex === colIndex
  }, [activeCell])

  // Función utilitaria para verificar si una celda está dentro del rango seleccionado
  const isCellSelected = useCallback((rowIndex, colIndex) => {
    if (!selectionRange) return false
    const minR = Math.min(selectionRange.startRow, selectionRange.endRow)
    const maxR = Math.max(selectionRange.startRow, selectionRange.endRow)
    const minC = Math.min(selectionRange.startCol, selectionRange.endCol)
    const maxC = Math.max(selectionRange.startCol, selectionRange.endCol)
    return rowIndex >= minR && rowIndex <= maxR && colIndex >= minC && colIndex <= maxC
  }, [selectionRange])

  // Función utilitaria para verificar si una celda está en previsualización de Fill Down
  const isCellInFillPreview = useCallback((rowIndex, colIndex) => {
    if (!fillRange) return false
    if (colIndex !== fillRange.colIndex) return false
    const minR = Math.min(fillRange.fromRow, fillRange.toRow)
    const maxR = Math.max(fillRange.fromRow, fillRange.toRow)
    return rowIndex > fillRange.fromRow && rowIndex <= maxR
  }, [fillRange])

  // ¿Es la celda extrema inferior-derecha de la selección donde debe renderizarse el tirador?
  const shouldRenderFillHandle = useCallback((rowIndex, colIndex) => {
    if (!activeCell) return false
    const colDef = columns[colIndex]
    if (colDef?.readOnly) return false // No mostrar tirador en columnas de solo lectura

    if (selectionRange) {
      const maxR = Math.max(selectionRange.startRow, selectionRange.endRow)
      const maxC = Math.max(selectionRange.startCol, selectionRange.endCol)
      return rowIndex === maxR && colIndex === maxC
    }
    return activeCell.rowIndex === rowIndex && activeCell.colIndex === colIndex
  }, [activeCell, selectionRange, columns])

  return {
    activeCell,
    setActiveCell,
    selectionRange,
    setSelectionRange,
    fillRange,
    isDraggingFill,
    undoStack,
    pushUndoAction,
    canUndo: undoStack.length > 0,
    undo,
    copyActiveCell,
    pasteToActiveOrRange,
    executeFillDown,
    handleKeyDown,
    handleCellClick,
    handleCellMouseDown,
    handleCellMouseEnter,
    handleFillHandleMouseDown,
    handleFillHandleDoubleClick,
    isCellActive,
    isCellSelected,
    isCellInFillPreview,
    shouldRenderFillHandle,
    gridContainerRef
  }
}
