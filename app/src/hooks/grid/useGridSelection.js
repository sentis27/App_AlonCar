import { useState, useCallback, useMemo, useRef } from 'react'
import { computeSheetStats, isCellInRanges, buildColumnRange } from '../../lib/sheetSelectionEngine.js'

/**
 * useGridSelection
 * Sub-hook para la celda activa, rangos espaciales (arrastre, Shift, Ctrl+Clic salteado),
 * selección de columna completa desde el encabezado, selección canónica de filas (Columna 0 #)
 * y estadísticas en vivo (Σ, Ø, Mín, Máx, Cantidad, Únicos) delegadas al motor único `sheetSelectionEngine`.
 */
export function useGridSelection({
  rows = [],
  columns = [],
  getRowId = (row) => row?.id,
  readCellValue = (row, colDef) => (colDef?.getValue ? colDef.getValue(row) : row?.[colDef?.key]),
  isDraggingFill = false,
  onFillDrag
}) {
  const [activeCell, setActiveCell] = useState(null)
  const [selectionRange, setSelectionRangeRaw] = useState(null)
  const [extraRanges, setExtraRanges] = useState([])
  const [selectedRowIds, setSelectedRowIds] = useState(new Set())
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [dragAnchor, setDragAnchor] = useState(null)
  const ctrlDownRef = useRef(false)

  const colIndexByKey = useMemo(() => new Map(columns.map((col, idx) => [col.key, idx])), [columns])
  const resolveColIndex = useCallback((colOrIdx) => {
    if (typeof colOrIdx === 'number') return colOrIdx
    return colIndexByKey.has(colOrIdx) ? colIndexByKey.get(colOrIdx) : -1
  }, [colIndexByKey])

  const setSelectionRange = useCallback((range) => {
    setExtraRanges([])
    setSelectionRangeRaw(range)
  }, [])

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
      if (prev.size >= targetIds.length && targetIds.every((id) => prev.has(id))) return new Set()
      return new Set(targetIds)
    })
  }, [rows, getRowId])

  const clearSelectedRows = useCallback(() => setSelectedRowIds(new Set()), [])
  const isRowSelected = useCallback((rowId) => selectedRowIds.has(rowId), [selectedRowIds])

  const cellToRange = (rowIndex, colIndex) => ({ startRow: rowIndex, endRow: rowIndex, startCol: colIndex, endCol: colIndex })
  const currentAsRange = () => selectionRange || (activeCell ? cellToRange(activeCell.rowIndex, activeCell.colIndex) : null)

  const activateCell = useCallback((rowIndex, colIndex) => {
    const row = rows[rowIndex]
    const colDef = columns[colIndex]
    if (!row || !colDef) return false
    setActiveCell({ rowIndex, colIndex, rowId: getRowId(row), colKey: colDef.key })
    return true
  }, [rows, columns, getRowId])

  const addCellToSelection = useCallback((rowIndex, colIndex) => {
    const current = currentAsRange()
    if (current) setExtraRanges((prev) => [...prev, current])
    if (activateCell(rowIndex, colIndex)) setSelectionRangeRaw(cellToRange(rowIndex, colIndex))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectionRange, activeCell, activateCell])

  const handleCellClick = useCallback((rowIndex, colIndex, e) => {
    if (e?.target?.closest?.('input, select, textarea, button')) return
    if (!rows[rowIndex] || !columns[colIndex]) return
    if (e.ctrlKey || e.metaKey) {
      if (ctrlDownRef.current) { ctrlDownRef.current = false; return }
      addCellToSelection(rowIndex, colIndex)
      return
    }
    if (e.shiftKey && activeCell) {
      setSelectionRangeRaw({ startRow: activeCell.rowIndex, endRow: rowIndex, startCol: activeCell.colIndex, endCol: colIndex })
    } else {
      activateCell(rowIndex, colIndex)
      setSelectionRange(null)
    }
  }, [rows, columns, activeCell, activateCell, addCellToSelection, setSelectionRange])

  const handleCellMouseDown = useCallback((rowIndex, colIndex, e) => {
    if (e.button !== 0 || e.target?.closest?.('.fill-handle, select, input, button, textarea')) return
    if (e.ctrlKey || e.metaKey) {
      ctrlDownRef.current = true
      addCellToSelection(rowIndex, colIndex)
    } else if (!e.shiftKey) {
      activateCell(rowIndex, colIndex)
      setExtraRanges([])
      setSelectionRangeRaw(null)
    }
    setIsMouseDown(true)
    setDragAnchor({ rowIndex, colIndex })
  }, [addCellToSelection, activateCell])

  const handleCellMouseEnter = useCallback((rowIndex, colIndex) => {
    if (isDraggingFill && activeCell) {
      if (typeof onFillDrag === 'function') onFillDrag(rowIndex, colIndex)
    } else if (isMouseDown && dragAnchor) {
      setSelectionRangeRaw({ startRow: dragAnchor.rowIndex, endRow: rowIndex, startCol: dragAnchor.colIndex, endCol: colIndex })
    }
  }, [isDraggingFill, activeCell, onFillDrag, isMouseDown, dragAnchor])

  const selectColumn = useCallback((colOrIdx, additive = false) => {
    const colIndex = resolveColIndex(colOrIdx)
    if (rows.length === 0 || colIndex < 0 || colIndex >= columns.length) return
    if (additive) {
      const current = currentAsRange()
      if (current) setExtraRanges((prev) => [...prev, current])
    } else {
      setExtraRanges([])
    }
    setSelectionRangeRaw(buildColumnRange(colIndex, rows.length))
    activateCell(0, colIndex)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolveColIndex, rows, columns, selectionRange, activeCell, activateCell])

  const isColumnSelected = useCallback((colOrIdx) => {
    const colIndex = resolveColIndex(colOrIdx)
    if (colIndex < 0 || !selectionRange) return false
    return Boolean(
      selectionRange.startCol === colIndex && selectionRange.endCol === colIndex &&
      (selectionRange.isColumn || (selectionRange.startRow === 0 && selectionRange.endRow === rows.length - 1 && rows.length > 1))
    )
  }, [resolveColIndex, selectionRange, rows.length])

  const getColumnHeaderProps = useCallback((colOrIdx, extraClassName = '') => {
    const colIndex = resolveColIndex(colOrIdx)
    if (colIndex < 0) return { className: extraClassName }
    const selected = isColumnSelected(colIndex)
    return {
      onClick: (e) => {
        if (e.target?.closest?.('button, input, select, a')) return
        selectColumn(colIndex, e.ctrlKey || e.metaKey)
      },
      title: 'Clic: seleccionar columna y ver Suma / Promedio / Cantidad abajo (Ctrl+Clic suma otra columna)',
      'data-col-select': 'true',
      className: `${extraClassName} cursor-pointer select-none transition-colors ${selected ? 'bg-cyan-500/25 text-cyan-100' : 'hover:text-cyan-300'}`.trim()
    }
  }, [resolveColIndex, selectColumn, isColumnSelected])

  const selectionRanges = useMemo(
    () => (selectionRange ? [...extraRanges, selectionRange] : extraRanges),
    [extraRanges, selectionRange]
  )

  const isCellActive = useCallback((rowIndex, colIndex) => (
    Boolean(activeCell && activeCell.rowIndex === rowIndex && activeCell.colIndex === colIndex)
  ), [activeCell])

  const isCellSelected = useCallback((rowIndex, colIndex) => (
    selectionRanges.length > 0 && isCellInRanges(selectionRanges, rowIndex, colIndex)
  ), [selectionRanges])

  const getCellProps = useCallback((rowIndex, colOrIdx) => {
    const colIdx = resolveColIndex(colOrIdx)
    if (colIdx < 0) return { className: '', domProps: {} }
    const active = isCellActive(rowIndex, colIdx)
    const selected = isCellSelected(rowIndex, colIdx)
    return {
      domProps: {
        onClick: (e) => handleCellClick(rowIndex, colIdx, e),
        onMouseDown: (e) => handleCellMouseDown(rowIndex, colIdx, e),
        onMouseEnter: () => handleCellMouseEnter(rowIndex, colIdx)
      },
      className: `relative select-none transition-colors ${active ? 'ring-2 ring-cyan-400 bg-cyan-950/40 z-20 outline-none' : selected ? 'bg-cyan-900/30' : ''}`
    }
  }, [resolveColIndex, isCellActive, isCellSelected, handleCellClick, handleCellMouseDown, handleCellMouseEnter])

  const selectionStats = useMemo(
    () => (selectionRanges.length === 0 ? null : computeSheetStats(selectionRanges, rows, columns, readCellValue)),
    [selectionRanges, rows, columns, readCellValue]
  )

  const activeCellBadge = activeCell && columns[activeCell.colIndex]
    ? `Fila ${activeCell.rowIndex + 1} · ${columns[activeCell.colIndex].label || columns[activeCell.colIndex].key}`
    : null

  return {
    activeCell, setActiveCell, activeCellBadge,
    selectionRange, setSelectionRange, selectionRanges, extraRanges,
    selectedRowIds, setSelectedRowIds, toggleSelectRow, toggleSelectAll, clearSelectedRows, isRowSelected,
    isMouseDown, setIsMouseDown, dragAnchor, setDragAnchor,
    handleCellClick, handleCellMouseDown, handleCellMouseEnter,
    selectColumn, isColumnSelected, getColumnHeaderProps, getCellProps,
    isCellActive, isCellSelected, selectionStats
  }
}
