import { useState, useEffect, useRef, useCallback } from 'react'

/**
 * useSpreadsheetGrid
 * 
 * Hook transversal para dotar a cualquier tabla de la plataforma Alon Car
 * de la ergonomía, navegación y atajos rápidos de Google Sheets / Microsoft Excel:
 * - Navegación con flechas (↑ ↓ ← →) entre celdas
 * - Enter o F2 sobre celda activa para abrir edición rápida (igual que doble clic)
 * - Selección de celdas y rangos (Shift + Flechas o Arrastre con Mouse)
 * - Cuadradito "Tirador" de esquina (Fill Handle ■) para arrastrar y rellenar hacia abajo
 * - Doble clic en el tirador para auto-rellenar hasta el final
 * - Ctrl + C (Copiar) / Ctrl + V (Pegar en celda o rango)
 * - Ctrl + D (Fill Down: clonar valor de la primera celda hacia abajo)
 * - Ctrl + Z (Deshacer histórico de hasta 50 pasos, aislado por módulo y sesión)
 * - Ctrl + Y / Ctrl + Shift + Z (Rehacer)
 * - Ctrl + F (Enfocar buscador rápido de la tabla sin abrir la búsqueda de Chrome)
 */
export function useSpreadsheetGrid({
  rows = [],
  columns = [],
  getRowId = (row) => row.id,
  onBatchUpdate,
  onFocusSearch,
  onCellActivate,
  canEditCell = () => true,
  maxUndoSteps = 50,
  storageKey = 'aloncar_grid',
  showFeedback
}) {
  const undoStorageKey = `${storageKey}_undo_stack`
  const redoStorageKey = `${storageKey}_redo_stack`

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

  // Portapapeles Interno { colKey, value, displayLabel }
  const [internalClipboard, setInternalClipboard] = useState(null)

  // Pila de Deshacer (Undo Stack) aislada en memoria de la sesión por módulo
  const [undoStack, setUndoStack] = useState(() => {
    try {
      const saved = sessionStorage.getItem(undoStorageKey)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Pila de Rehacer (Redo Stack)
  const [redoStack, setRedoStack] = useState(() => {
    try {
      const saved = sessionStorage.getItem(redoStorageKey)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const gridContainerRef = useRef(null)

  // Helper para obtener el valor real (simple o compuesto, ej. Barco + OT) de una celda
  const readCellValue = useCallback((row, colDef) => {
    if (!row || !colDef) return undefined
    if (typeof colDef.getValue === 'function') {
      return colDef.getValue(row)
    }
    return row[colDef.key]
  }, [])

  // Helper para mostrar etiqueta legible en mensajes de feedback y portapapeles de texto
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

  // Sincronizar undoStack con sessionStorage (máx 50 pasos)
  const pushUndoAction = useCallback((action) => {
    setRedoStack([])
    try {
      sessionStorage.removeItem(redoStorageKey)
    } catch {}

    setUndoStack((prev) => {
      const next = [action, ...prev].slice(0, maxUndoSteps)
      try {
        sessionStorage.setItem(undoStorageKey, JSON.stringify(next))
      } catch (e) {
        console.warn('Error guardando undo en sessionStorage:', e)
      }
      return next
    })
  }, [maxUndoSteps, undoStorageKey, redoStorageKey])

  // Deshacer el último cambio (Ctrl + Z)
  const undo = useCallback(async () => {
    if (undoStack.length === 0) {
      if (showFeedback) showFeedback('info', 'No hay más acciones para deshacer en esta planilla.')
      return
    }

    const [lastAction, ...remainingStack] = undoStack
    setUndoStack(remainingStack)
    try {
      sessionStorage.setItem(undoStorageKey, JSON.stringify(remainingStack))
    } catch {}

    setRedoStack((prev) => {
      const nextRedo = [lastAction, ...prev].slice(0, maxUndoSteps)
      try {
        sessionStorage.setItem(redoStorageKey, JSON.stringify(nextRedo))
      } catch {}
      return nextRedo
    })

    if (onBatchUpdate && lastAction.previousValues) {
      const entries = Object.entries(lastAction.previousValues)
      await onBatchUpdate({
        colKey: lastAction.colKey,
        revertMap: lastAction.previousValues,
        isRevert: true,
        actionLabel: lastAction.actionLabel || 'deshacer'
      })

      if (showFeedback) {
        showFeedback('success', `Deshecho (Ctrl+Z): Se restauraron ${entries.length} celda(s) en ${lastAction.colLabel || lastAction.colKey}.`)
      }
    }
  }, [undoStack, onBatchUpdate, maxUndoSteps, showFeedback, undoStorageKey, redoStorageKey])

  // Rehacer el último cambio deshecho (Ctrl + Y o Ctrl + Shift + Z)
  const redo = useCallback(async () => {
    if (redoStack.length === 0) {
      if (showFeedback) showFeedback('info', 'No hay más acciones para rehacer en esta planilla.')
      return
    }

    const [actionToRedo, ...remainingRedo] = redoStack
    setRedoStack(remainingRedo)
    try {
      sessionStorage.setItem(redoStorageKey, JSON.stringify(remainingRedo))
    } catch {}

    setUndoStack((prev) => {
      const nextUndo = [actionToRedo, ...prev].slice(0, maxUndoSteps)
      try {
        sessionStorage.setItem(undoStorageKey, JSON.stringify(nextUndo))
      } catch {}
      return nextUndo
    })

    if (onBatchUpdate) {
      const targetIds = Object.keys(actionToRedo.previousValues || {})
      if (actionToRedo.newValuesMap) {
        await onBatchUpdate({
          colKey: actionToRedo.colKey,
          revertMap: actionToRedo.newValuesMap,
          isRevert: true,
          actionLabel: actionToRedo.actionLabel || 'rehacer'
        })
      } else {
        await onBatchUpdate({
          colKey: actionToRedo.colKey,
          newValue: actionToRedo.newValue,
          targetIds,
          isRevert: false,
          actionLabel: 'Rehacer'
        })
      }

      if (showFeedback) {
        showFeedback('success', `Rehecho (Ctrl+Y): Se re-aplicó el cambio en ${actionToRedo.colLabel || actionToRedo.colKey}.`)
      }
    }
  }, [redoStack, onBatchUpdate, maxUndoSteps, showFeedback, undoStorageKey, redoStorageKey])

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
    if (minRow === maxRow) return // Nada que rellenar

    const sourceRow = rows[minRow]
    if (!sourceRow) return

    const sourceValue = readCellValue(sourceRow, colDef)
    const displayStr = formatCellDisplay(sourceValue, sourceRow, colDef)
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
      previousValues[id] = readCellValue(r, colDef)
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
      showFeedback('success', `Rellenadas ${validRows.length} fila(s) con "${displayStr}".`)
    }
  }, [rows, columns, getRowId, canEditCell, pushUndoAction, onBatchUpdate, showFeedback, readCellValue, formatCellDisplay])

  // Copiar valor de la celda activa (Ctrl + C)
  const copyActiveCell = useCallback(() => {
    if (!activeCell) return
    const row = rows[activeCell.rowIndex]
    const colDef = columns[activeCell.colIndex]
    if (!row || !colDef) return

    const val = readCellValue(row, colDef)
    const displayLabel = formatCellDisplay(val, row, colDef)
    setInternalClipboard({
      colKey: colDef.key,
      value: val,
      colLabel: colDef.label,
      displayLabel
    })

    // También copiar al portapapeles nativo como texto
    try {
      if (displayLabel && displayLabel !== '—') {
        navigator.clipboard.writeText(displayLabel).catch(() => {})
      }
    } catch {}

    if (showFeedback) {
      showFeedback('info', `Copiado: "${displayLabel}" (${colDef.label || colDef.key})`)
    }
  }, [activeCell, rows, columns, showFeedback, readCellValue, formatCellDisplay])

  // Pegar valor en celda activa o rango seleccionado (Ctrl + V)
  const pasteToActiveOrRange = useCallback(async () => {
    if (!activeCell) return
    const colDef = columns[activeCell.colIndex]
    if (!colDef || colDef.readOnly) {
      if (showFeedback) showFeedback('error', 'Esta columna es de solo lectura.')
      return
    }

    // Si es columna compuesta (ej. Barco/OT) y el portapapeles interno proviene de otra columna incompatible, bloquear
    if (internalClipboard && typeof colDef.getValue === 'function' && internalClipboard.colKey !== colDef.key) {
      if (showFeedback) showFeedback('error', `Para pegar en "${colDef.label}", primero copia (Ctrl+C) una celda de "${colDef.label}".`)
      return
    }

    if (!internalClipboard) {
      // Intentar leer texto del clipboard nativo si no hay memoria interna y no es celda compuesta
      if (typeof colDef.getValue === 'function') return
      try {
        const text = await navigator.clipboard.readText()
        if (text) {
          const startR = selectionRange ? Math.min(selectionRange.startRow, selectionRange.endRow) : activeCell.rowIndex
          const endR = selectionRange ? Math.max(selectionRange.startRow, selectionRange.endRow) : activeCell.rowIndex
          const targetRows = rows.slice(startR, endR + 1)
          const validRows = targetRows.filter((r) => canEditCell(r, colDef.key, text))
          if (validRows.length > 0) {
            const previousValues = {}
            validRows.forEach((r) => { previousValues[getRowId(r)] = readCellValue(r, colDef) })
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
      } catch {}
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
      previousValues[getRowId(r)] = readCellValue(r, colDef)
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
      showFeedback('success', `Pegado "${internalClipboard.displayLabel || '—'}" en ${validRows.length} celda(s).`)
    }
  }, [activeCell, internalClipboard, columns, selectionRange, rows, canEditCell, getRowId, pushUndoAction, onBatchUpdate, showFeedback, readCellValue])

  // Manejador Central de Teclado (Navegación + Atajos)
  const handleKeyDown = useCallback((e) => {
    // Si el usuario está escribiendo dentro de un input, select o textarea activo, no interceptamos flechas comunes ni Enter
    const isEditingInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)

    // Ctrl + F: Enfocar buscador de la tabla
    if ((e.ctrlKey || e.metaKey) && (e.key === 'f' || e.key === 'F')) {
      e.preventDefault()
      if (onFocusSearch) onFocusSearch()
      return
    }

    // Ctrl + Y o Ctrl + Shift + Z: Rehacer
    if ((e.ctrlKey || e.metaKey) && ((e.key === 'y' || e.key === 'Y') || ((e.key === 'z' || e.key === 'Z') && e.shiftKey)) && !isEditingInput) {
      e.preventDefault()
      redo()
      return
    }

    // Ctrl + Z: Deshacer
    if ((e.ctrlKey || e.metaKey) && (e.key === 'z' || e.key === 'Z') && !e.shiftKey && !isEditingInput) {
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
        // Estilo Excel individual: si solo hay 1 celda seleccionada, copia la celda de ARRIBA a la actual
        executeFillDown(startRow - 1, startRow, colIdx)
      } else {
        if (showFeedback) showFeedback('info', 'Selecciona varias filas hacia abajo (Shift+↓ o mouse) para rellenar con Ctrl+D.')
      }
      return
    }

    // Enter o F2 sobre celda activa: abrir editor de celda (igual que doble clic en Google Sheets)
    if ((e.key === 'Enter' || e.key === 'F2') && !isEditingInput && activeCell && onCellActivate) {
      const row = rows[activeCell.rowIndex]
      const colDef = columns[activeCell.colIndex]
      if (row && colDef && !colDef.readOnly) {
        e.preventDefault()
        onCellActivate(row, colDef, activeCell.rowIndex, activeCell.colIndex)
        return
      }
    }

    // Escape: limpiar selección de rango
    if (e.key === 'Escape' && !isEditingInput) {
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
  }, [activeCell, selectionRange, rows, columns, getRowId, onFocusSearch, onCellActivate, undo, redo, copyActiveCell, pasteToActiveOrRange, executeFillDown, showFeedback])

  // Mouse: Clic en celda
  const handleCellClick = useCallback((rowIndex, colIndex, e) => {
    const row = rows[rowIndex]
    const colDef = columns[colIndex]
    if (!row || !colDef) return

    if (e.shiftKey && activeCell) {
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
    if (['SELECT', 'INPUT', 'BUTTON', 'TEXTAREA'].includes(e.target.tagName)) return // Dejar interactuar con el control

    setIsMouseDown(true)
    setDragAnchor({ rowIndex, colIndex })
  }, [])

  // Mouse: Arrastre sobre otra celda
  const handleCellMouseEnter = useCallback((rowIndex, colIndex) => {
    if (isDraggingFill && activeCell) {
      setFillRange({
        colIndex: activeCell.colIndex,
        fromRow: activeCell.rowIndex,
        toRow: rowIndex
      })
    } else if (isMouseDown && dragAnchor) {
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

  const isCellActive = useCallback((rowIndex, colIndex) => {
    return Boolean(activeCell && activeCell.rowIndex === rowIndex && activeCell.colIndex === colIndex)
  }, [activeCell])

  const isCellSelected = useCallback((rowIndex, colIndex) => {
    if (!selectionRange) return false
    const minR = Math.min(selectionRange.startRow, selectionRange.endRow)
    const maxR = Math.max(selectionRange.startRow, selectionRange.endRow)
    const minC = Math.min(selectionRange.startCol, selectionRange.endCol)
    const maxC = Math.max(selectionRange.startCol, selectionRange.endCol)
    return rowIndex >= minR && rowIndex <= maxR && colIndex >= minC && colIndex <= maxC
  }, [selectionRange])

  const isCellInFillPreview = useCallback((rowIndex, colIndex) => {
    if (!fillRange) return false
    if (colIndex !== fillRange.colIndex) return false
    const maxR = Math.max(fillRange.fromRow, fillRange.toRow)
    return rowIndex > fillRange.fromRow && rowIndex <= maxR
  }, [fillRange])

  const shouldRenderFillHandle = useCallback((rowIndex, colIndex) => {
    if (!activeCell) return false
    const colDef = columns[colIndex]
    if (colDef?.readOnly) return false

    if (selectionRange) {
      const maxR = Math.max(selectionRange.startRow, selectionRange.endRow)
      const maxC = Math.max(selectionRange.startCol, selectionRange.endCol)
      return rowIndex === maxR && colIndex === maxC
    }
    return activeCell.rowIndex === rowIndex && activeCell.colIndex === colIndex
  }, [activeCell, selectionRange, columns])

  // Etiqueta activa para mostrar en la cinta superior de la hoja de cálculo
  const activeCellBadge = activeCell && columns[activeCell.colIndex]
    ? `Fila ${activeCell.rowIndex + 1} · ${columns[activeCell.colIndex].label || columns[activeCell.colIndex].key}`
    : null

  return {
    activeCell,
    activeCellBadge,
    setActiveCell,
    selectionRange,
    setSelectionRange,
    fillRange,
    isDraggingFill,
    undoStack,
    pushUndoAction,
    canUndo: undoStack.length > 0,
    undo,
    redoStack,
    canRedo: redoStack.length > 0,
    redo,
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
