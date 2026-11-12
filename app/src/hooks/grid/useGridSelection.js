import { useState, useCallback, useMemo } from 'react'

/**
 * useGridSelection
 * Sub-hook especializado para gestionar la celda activa, el rango espacial de celdas seleccionadas,
 * la selección canónica de filas completas (Columna 0 #) y las estadísticas en vivo (Σ, Ø, Recuento).
 */
export function useGridSelection({
  rows = [],
  columns = [],
  getRowId = (row) => row?.id,
  readCellValue = (row, colDef) => (colDef?.getValue ? colDef.getValue(row) : row?.[colDef?.key]),
  isDraggingFill = false,
  onFillDrag
}) {
  // Coordenadas de Celda Activa { rowIndex, colIndex, rowId, colKey }
  const [activeCell, setActiveCell] = useState(null)

  // Rango de selección espacial { startRow, endRow, startCol, endCol } (índices numéricos)
  const [selectionRange, setSelectionRange] = useState(null)

  // Selección Canónica de Filas Completas (Checkboxes / Columna 0)
  const [selectedRowIds, setSelectedRowIds] = useState(new Set())

  // Arrastre con Mouse para Selección de Rango
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [dragAnchor, setDragAnchor] = useState(null)

  const toggleSelectRow = useCallback((rowId) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }, [])

  const toggleSelectAll = useCallback((allIds = []) => {
    setSelectedRowIds((prev) => {
      const targetIds = allIds.length > 0 ? allIds : rows.map(getRowId).filter(Boolean)
      if (prev.size >= targetIds.length && targetIds.every(id => prev.has(id))) {
        return new Set()
      }
      return new Set(targetIds)
    })
  }, [rows, getRowId])

  const clearSelectedRows = useCallback(() => {
    setSelectedRowIds(new Set())
  }, [])

  const isRowSelected = useCallback((rowId) => {
    return selectedRowIds.has(rowId)
  }, [selectedRowIds])

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
      if (typeof onFillDrag === 'function') {
        onFillDrag(rowIndex, colIndex)
      }
    } else if (isMouseDown && dragAnchor) {
      setSelectionRange({
        startRow: dragAnchor.rowIndex,
        endRow: rowIndex,
        startCol: dragAnchor.colIndex,
        endCol: colIndex
      })
    }
  }, [isDraggingFill, activeCell, onFillDrag, isMouseDown, dragAnchor])

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

  // Estadísticas en vivo del rango seleccionado (Estilo Excel: Suma, Promedio, Recuento)
  const selectionStats = useMemo(() => {
    if (!selectionRange || rows.length === 0 || columns.length === 0) return null
    const minR = Math.max(0, Math.min(selectionRange.startRow, selectionRange.endRow))
    const maxR = Math.min(rows.length - 1, Math.max(selectionRange.startRow, selectionRange.endRow))
    const minC = Math.max(0, Math.min(selectionRange.startCol, selectionRange.endCol))
    const maxC = Math.min(columns.length - 1, Math.max(selectionRange.startCol, selectionRange.endCol))

    const totalCells = (maxR - minR + 1) * (maxC - minC + 1)
    if (totalCells <= 1) return null

    let count = 0
    let numericCount = 0
    let sum = 0
    let min = Infinity
    let max = -Infinity

    for (let r = minR; r <= maxR; r++) {
      const row = rows[r]
      if (!row) continue
      for (let c = minC; c <= maxC; c++) {
        const colDef = columns[c]
        if (!colDef) continue
        const val = readCellValue(row, colDef)
        if (val !== null && val !== undefined && val !== '') {
          count++
          if (typeof val === 'number' && !Number.isNaN(val)) {
            numericCount++
            sum += val
            if (val < min) min = val
            if (val > max) max = val
          } else if (typeof val === 'string') {
            const cleaned = val.replace(/[^0-9.-]/g, '')
            if (cleaned !== '' && !Number.isNaN(Number(cleaned)) && !/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
              const num = Number(cleaned)
              numericCount++
              sum += num
              if (num < min) min = num
              if (num > max) max = num
            }
          }
        }
      }
    }

    return {
      totalCells,
      count,
      numericCount,
      sum: numericCount > 0 ? sum : null,
      avg: numericCount > 0 ? sum / numericCount : null,
      min: numericCount > 0 ? min : null,
      max: numericCount > 0 ? max : null
    }
  }, [selectionRange, rows, columns, readCellValue])

  // Etiqueta activa para mostrar en la cinta superior de la hoja de cálculo
  const activeCellBadge = activeCell && columns[activeCell.colIndex]
    ? `Fila ${activeCell.rowIndex + 1} · ${columns[activeCell.colIndex].label || columns[activeCell.colIndex].key}`
    : null

  return {
    activeCell,
    setActiveCell,
    activeCellBadge,
    selectionRange,
    setSelectionRange,
    selectedRowIds,
    setSelectedRowIds,
    toggleSelectRow,
    toggleSelectAll,
    clearSelectedRows,
    isRowSelected,
    isMouseDown,
    setIsMouseDown,
    dragAnchor,
    setDragAnchor,
    handleCellClick,
    handleCellMouseDown,
    handleCellMouseEnter,
    isCellActive,
    isCellSelected,
    selectionStats
  }
}
