import { useState, useCallback } from 'react'

/**
 * useGridClipboard
 * Sub-hook especializado para gestionar el portapapeles bidimensional (Paste Matrix 2D de Excel/Sheets),
 * copia de celdas o filas completas, sanitización de tipos y borrado de celdas o rangos con Supr/Backspace.
 */
export function useGridClipboard({
  rows = [],
  columns = [],
  getRowId = (row) => row?.id,
  activeCell,
  selectionRange,
  canEditCell = () => true,
  readCellValue,
  formatCellDisplay,
  pushUndoAction,
  onBatchUpdate,
  onPasteRow,
  showFeedback
}) {
  // Portapapeles Interno { colKey, value, displayLabel, type, rowObj, rowIndex }
  const [internalClipboard, setInternalClipboard] = useState(null)

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

  // Copiar fila completa como objeto de plantilla (estilo Excel / Google Sheets)
  const copyRow = useCallback((rowIndex) => {
    const row = rows[rowIndex]
    if (!row) return
    setInternalClipboard({
      type: 'row',
      rowObj: { ...row },
      rowIndex,
      displayLabel: `Fila ${rowIndex + 1}`
    })
    if (showFeedback) {
      showFeedback('info', `Fila ${rowIndex + 1} copiada al portapapeles. Pega con Ctrl+V en otra fila o en una fila vacía.`)
    }
  }, [rows, showFeedback])

  // Sanitizar y tipificar el valor pegado según la definición de la columna
  const sanitizeCellValue = useCallback((rawVal, colDef) => {
    if (rawVal === null || rawVal === undefined) return null
    const str = String(rawVal).trim()
    if (str === '' || str === '—') {
      return typeof colDef?.getEmptyValue === 'function' ? colDef.getEmptyValue() : (colDef?.emptyValue ?? null)
    }

    if (colDef?.type === 'number' || colDef?.type === 'currency') {
      const cleaned = str.replace(/[$€\s]/g, '').replace(/,/g, '.')
      const num = Number(cleaned)
      return isNaN(num) ? null : num
    }

    if (colDef?.type === 'boolean') {
      return ['SI', 'SÍ', 'TRUE', '1', 'VERDADERO', 'YES'].includes(str.toUpperCase())
    }

    return str
  }, [])

  // Procesar texto plano que puede ser un valor único o una matriz bidimensional (separada por \t y \n)
  const processPasteText = useCallback(async (rawText) => {
    if (!activeCell || !rawText) return
    const text = String(rawText).trimEnd()
    if (!text) return

    // Dividir filas y columnas
    const matrix = text.split(/\r\n|\n|\r/).map(row => row.split('\t'))
    const isMultiCellMatrix = matrix.length > 1 || (matrix[0] && matrix[0].length > 1)

    // Si NO es una matriz bidimensional (es 1 solo valor o se pega sobre rango seleccionado)
    if (!isMultiCellMatrix) {
      const singleValue = matrix[0][0]
      const colDef = columns[activeCell.colIndex]
      if (!colDef || colDef.readOnly) {
        if (showFeedback) showFeedback('error', 'Esta columna es de solo lectura.')
        return
      }

      const parsedValue = sanitizeCellValue(singleValue, colDef)
      const startR = selectionRange ? Math.min(selectionRange.startRow, selectionRange.endRow) : activeCell.rowIndex
      const endR = selectionRange ? Math.max(selectionRange.startRow, selectionRange.endRow) : activeCell.rowIndex
      const targetRows = rows.slice(startR, endR + 1)
      const validRows = targetRows.filter((r) => canEditCell(r, colDef.key, parsedValue))

      if (validRows.length === 0) {
        if (showFeedback) showFeedback('error', 'Las celdas de destino no admiten este valor.')
        return
      }

      const previousValues = {}
      validRows.forEach((r) => { previousValues[getRowId(r)] = readCellValue(r, colDef) })

      pushUndoAction({
        colKey: colDef.key,
        colLabel: colDef.label || colDef.key,
        actionLabel: 'Pegar (Ctrl+V)',
        previousValues,
        newValue: parsedValue,
        timestamp: Date.now()
      })

      if (onBatchUpdate) {
        await onBatchUpdate({
          colKey: colDef.key,
          newValue: parsedValue,
          targetIds: validRows.map(getRowId),
          isRevert: false,
          actionLabel: 'Pegar'
        })
      }

      if (showFeedback) {
        showFeedback('success', `Pegado "${singleValue}" en ${validRows.length} celda(s).`)
      }
      return
    }

    // SI ES UNA MATRIZ MULTICELDA (Portapapeles 2D de Excel o Google Sheets)
    const byColPrev = {}
    const byColNew = {}
    let totalCellsUpdated = 0
    let totalRowsUpdated = 0

    const startRowIdx = activeCell.rowIndex
    const startColIdx = activeCell.colIndex

    for (let rIdx = 0; rIdx < matrix.length; rIdx++) {
      const targetRowIdx = startRowIdx + rIdx
      if (targetRowIdx >= rows.length) break

      const row = rows[targetRowIdx]
      if (!row) continue
      const rowId = getRowId(row)
      const rowCells = matrix[rIdx]
      let rowHadUpdate = false

      for (let cIdx = 0; cIdx < rowCells.length; cIdx++) {
        const targetColIdx = startColIdx + cIdx
        if (targetColIdx >= columns.length) break

        const colDef = columns[targetColIdx]
        if (!colDef || colDef.readOnly) continue

        const rawCell = rowCells[cIdx]
        const parsedVal = sanitizeCellValue(rawCell, colDef)
        if (!canEditCell(row, colDef.key, parsedVal)) continue

        const prevVal = readCellValue(row, colDef)

        if (!byColPrev[colDef.key]) byColPrev[colDef.key] = {}
        if (!byColNew[colDef.key]) byColNew[colDef.key] = {}

        byColPrev[colDef.key][rowId] = prevVal
        byColNew[colDef.key][rowId] = parsedVal
        totalCellsUpdated++
        rowHadUpdate = true
      }
      if (rowHadUpdate) totalRowsUpdated++
    }

    if (totalCellsUpdated === 0) {
      if (showFeedback) showFeedback('error', 'No se pudieron pegar celdas: columnas protegidas o valores no admitidos.')
      return
    }

    // Registrar en pila de deshacer con soporte multi_column_mutations
    pushUndoAction({
      type: 'multi_column_mutations',
      mutationsByCol: { prev: byColPrev, next: byColNew },
      colKey: columns[activeCell.colIndex]?.key || 'matriz',
      colLabel: `Matriz ${totalRowsUpdated}x${matrix[0]?.length || 1}`,
      actionLabel: 'Pegar Matriz (Ctrl+V)'
    })

    // Ejecutar mutaciones en lote para cada columna afectada
    if (onBatchUpdate) {
      for (const [colKey, newValuesMap] of Object.entries(byColNew)) {
        await onBatchUpdate({
          colKey,
          revertMap: newValuesMap,
          isRevert: true,
          actionLabel: 'Pegar Matriz'
        })
      }
    }

    if (showFeedback) {
      showFeedback('success', `Pegada matriz de ${totalRowsUpdated} fila(s) en ${totalCellsUpdated} celda(s).`)
    }
  }, [activeCell, selectionRange, rows, columns, canEditCell, getRowId, readCellValue, pushUndoAction, onBatchUpdate, showFeedback, sanitizeCellValue])

  // Pegar valor en celda activa o rango seleccionado (Ctrl + V)
  const pasteToActiveOrRange = useCallback(async () => {
    if (!activeCell) return

    // Soporte especial: Si el portapapeles contiene una fila completa y se definió onPasteRow
    if (internalClipboard && internalClipboard.type === 'row' && onPasteRow) {
      const targetRow = rows[activeCell.rowIndex]
      if (targetRow) {
        await onPasteRow({
          sourceRow: internalClipboard.rowObj,
          targetRow,
          targetRowIndex: activeCell.rowIndex
        })
        return
      }
    }

    const colDef = columns[activeCell.colIndex]
    if (!colDef || colDef.readOnly) {
      if (showFeedback) showFeedback('error', 'Esta columna es de solo lectura.')
      return
    }

    if (internalClipboard && typeof colDef.getValue === 'function' && internalClipboard.colKey !== colDef.key) {
      if (showFeedback) showFeedback('error', `Para pegar en "${colDef.label}", primero copia (Ctrl+C) una celda de "${colDef.label}".`)
      return
    }

    if (internalClipboard && internalClipboard.value !== undefined) {
      await processPasteText(String(internalClipboard.value))
      return
    }

    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        await processPasteText(text)
      }
    } catch (e) {
      console.warn('Error leyendo clipboard:', e)
    }
  }, [activeCell, internalClipboard, columns, onPasteRow, rows, showFeedback, processPasteText])

  // Manejador del evento onPaste en contenedor o tabla
  const handlePaste = useCallback(async (e) => {
    if (!activeCell) return
    const isEditingInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName)
    if (isEditingInput) return

    e.preventDefault()
    let text = e.clipboardData?.getData('text/plain')
    if (!text) {
      try {
        text = await navigator.clipboard.readText()
      } catch {}
    }
    if (text) {
      await processPasteText(text)
    }
  }, [activeCell, processPasteText])

  // Borrar valor de celda activa o rango seleccionado (Tecla Supr / Delete / Backspace)
  const deleteActiveCellOrRange = useCallback(async () => {
    if (!activeCell) return

    const colDef = columns[activeCell.colIndex]
    if (!colDef || colDef.readOnly) {
      if (showFeedback) showFeedback('error', 'Esta columna es de solo lectura.')
      return
    }

    const startR = selectionRange ? Math.min(selectionRange.startRow, selectionRange.endRow) : activeCell.rowIndex
    const endR = selectionRange ? Math.max(selectionRange.startRow, selectionRange.endRow) : activeCell.rowIndex
    const startC = selectionRange ? Math.min(selectionRange.startCol, selectionRange.endCol) : activeCell.colIndex
    const endC = selectionRange ? Math.max(selectionRange.startCol, selectionRange.endCol) : activeCell.colIndex

    const multiColMutations = []
    let totalCelled = 0

    for (let cIdx = startC; cIdx <= endC; cIdx++) {
      const currentCol = columns[cIdx]
      if (!currentCol || currentCol.readOnly) continue

      let cEmptyVal = null
      if (typeof currentCol.getEmptyValue === 'function') {
        cEmptyVal = currentCol.getEmptyValue()
      } else if (currentCol.emptyValue !== undefined) {
        cEmptyVal = currentCol.emptyValue
      } else if (currentCol.type === 'text' || currentCol.type === 'string') {
        cEmptyVal = ''
      } else {
        cEmptyVal = null
      }

      const targetRows = rows.slice(startR, endR + 1)
      const validRows = targetRows.filter((r) => canEditCell(r, currentCol.key, cEmptyVal))
      if (validRows.length === 0) continue

      const previousValues = {}
      validRows.forEach((r) => {
        previousValues[getRowId(r)] = readCellValue(r, currentCol)
      })

      multiColMutations.push({
        colKey: currentCol.key,
        colLabel: currentCol.label || currentCol.key,
        newValue: cEmptyVal,
        previousValues,
        targetIds: validRows.map(getRowId)
      })
      totalCelled += validRows.length
    }

    if (multiColMutations.length === 0) {
      if (showFeedback) showFeedback('info', 'No se pudieron borrar celdas protegidas o de solo lectura.')
      return
    }

    if (multiColMutations.length === 1) {
      const mut = multiColMutations[0]
      pushUndoAction({
        colKey: mut.colKey,
        colLabel: mut.colLabel,
        actionLabel: 'Borrar (Supr)',
        previousValues: mut.previousValues,
        newValue: mut.newValue,
        timestamp: Date.now()
      })
      if (onBatchUpdate) {
        await onBatchUpdate({
          colKey: mut.colKey,
          newValue: mut.newValue,
          targetIds: mut.targetIds,
          isRevert: false,
          actionLabel: 'Borrar (Supr)'
        })
      }
    } else {
      const undoPayload = []
      for (const mut of multiColMutations) {
        Object.entries(mut.previousValues).forEach(([rId, oldVal]) => {
          undoPayload.push({
            rowId: rId,
            colKey: mut.colKey,
            oldValue: oldVal,
            newValue: mut.newValue,
            actionLabel: 'Borrado múltiple (Supr)'
          })
        })
        if (onBatchUpdate) {
          await onBatchUpdate({
            colKey: mut.colKey,
            newValue: mut.newValue,
            targetIds: mut.targetIds,
            isRevert: false,
            actionLabel: 'Borrado múltiple (Supr)'
          })
        }
      }
      pushUndoAction(undoPayload)
    }

    if (showFeedback) {
      showFeedback('info', `Dato(s) borrado(s) con Supr en ${totalCelled} celda(s). Pulsa Ctrl+Z para deshacer.`)
    }
  }, [activeCell, selectionRange, columns, rows, canEditCell, getRowId, readCellValue, pushUndoAction, onBatchUpdate, showFeedback])

  return {
    internalClipboard,
    setInternalClipboard,
    copyActiveCell,
    copyRow,
    sanitizeCellValue,
    processPasteText,
    pasteToActiveOrRange,
    handlePaste,
    deleteActiveCellOrRange
  }
}
