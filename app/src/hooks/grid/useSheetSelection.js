import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  computeSheetStats,
  buildSelectionTsv,
  buildColumnRange,
  isCellInRanges,
  sortRowsByColumn
} from '../../lib/sheetSelectionEngine.js'

const cellRange = (r, c) => ({ startRow: r, endRow: r, startCol: c, endCol: c })

/**
 * useSheetSelection (Capa 2 · SKL-019 · FL-027)
 * Experiencia Excel / Google Sheets "en 3 líneas" para cualquier tabla (editable o de consulta):
 * clic, arrastre, Shift+Flechas, Ctrl+Clic salteado, clic en encabezado = columna completa,
 * doble clic en encabezado = ordenar `↕` (si `sortable: true`), Ctrl+C 2D (TSV), Esc y `selectionStats`.
 */
export function useSheetSelection({ rows = [], columns = [], getRowId = (row) => row?.id, sortable = false }) {
  const containerRef = useRef(null)
  const dragAnchorRef = useRef(null)
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [sortState, setSortState] = useState({ colKey: null, dir: null })
  const [state, setState] = useState({ signature: '', activeCell: null, range: null, extra: [] })

  const colIndexByKey = useMemo(() => new Map(columns.map((col, idx) => [col.key, idx])), [columns])

  const sortedRows = useMemo(() => {
    if (!sortable || !sortState.colKey || !sortState.dir) return rows
    const colDef = columns.find((c) => c.key === sortState.colKey)
    return colDef ? sortRowsByColumn(rows, colDef, sortState.dir) : rows
  }, [sortable, sortState, rows, columns])

  const effectiveRows = sortable ? sortedRows : rows
  const signature = useMemo(
    () => `${effectiveRows.length}:${effectiveRows[0] ? String(getRowId(effectiveRows[0])) : ''}:${effectiveRows[effectiveRows.length - 1] ? String(getRowId(effectiveRows[effectiveRows.length - 1])) : ''}`,
    [effectiveRows, getRowId]
  )

  const fresh = state.signature === signature
  const activeCell = fresh ? state.activeCell : null
  const selectionRange = fresh ? state.range : null
  const extraRanges = useMemo(() => (fresh ? state.extra : []), [fresh, state.extra])
  const selectionRanges = useMemo(
    () => (selectionRange ? [...extraRanges, selectionRange] : extraRanges),
    [extraRanges, selectionRange]
  )

  useEffect(() => {
    const up = () => { setIsMouseDown(false); dragAnchorRef.current = null }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  const commit = useCallback((patch) => setState((prev) => {
    const base = prev.signature === signature ? prev : { signature, activeCell: null, range: null, extra: [] }
    return { ...base, signature, ...patch }
  }), [signature])

  const clearSelection = useCallback(() => {
    commit({ activeCell: null, range: null, extra: [] })
    setIsMouseDown(false)
    dragAnchorRef.current = null
  }, [commit])

  const toggleSort = useCallback((colKey) => {
    if (!sortable || !colKey) return
    setSortState((prev) => {
      if (prev.colKey !== colKey) return { colKey, dir: 'asc' }
      if (prev.dir === 'asc') return { colKey, dir: 'desc' }
      return { colKey: null, dir: null }
    })
  }, [sortable])

  const getSortIndicator = useCallback((colKey) => {
    if (!sortable) return ''
    if (sortState.colKey !== colKey) return ' ↕'
    return sortState.dir === 'asc' ? ' ↑' : ' ↓'
  }, [sortable, sortState])

  const handleCellMouseDown = useCallback((rowIndex, colIndex, e) => {
    if (e.button !== 0 || e.target.closest('button, a, input, select, textarea')) return
    containerRef.current?.focus({ preventScroll: true })
    e.preventDefault()
    if (e.shiftKey && activeCell) {
      commit({ range: { startRow: activeCell.rowIndex, endRow: rowIndex, startCol: activeCell.colIndex, endCol: colIndex } })
      return
    }
    const additive = e.ctrlKey || e.metaKey
    const keep = additive ? [...extraRanges, ...(selectionRange ? [selectionRange] : [])] : []
    setIsMouseDown(true)
    dragAnchorRef.current = { rowIndex, colIndex }
    commit({ activeCell: { rowIndex, colIndex }, range: cellRange(rowIndex, colIndex), extra: keep })
  }, [activeCell, extraRanges, selectionRange, commit])

  const handleCellMouseEnter = useCallback((rowIndex, colIndex) => {
    const anchor = dragAnchorRef.current
    if (!isMouseDown || !anchor) return
    commit({
      activeCell: activeCell || anchor,
      range: { startRow: anchor.rowIndex, endRow: rowIndex, startCol: anchor.colIndex, endCol: colIndex }
    })
  }, [isMouseDown, activeCell, commit])

  const selectColumn = useCallback((colIndex, additive = false) => {
    if (effectiveRows.length === 0 || colIndex < 0 || colIndex >= columns.length) return
    const keep = additive ? [...extraRanges, ...(selectionRange ? [selectionRange] : [])] : []
    containerRef.current?.focus({ preventScroll: true })
    commit({ activeCell: { rowIndex: 0, colIndex }, range: buildColumnRange(colIndex, effectiveRows.length), extra: keep })
  }, [effectiveRows.length, columns.length, extraRanges, selectionRange, commit])

  const handleKeyDown = useCallback((e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName)) return
    if (e.key === 'Escape' && (selectionRange || activeCell)) {
      e.preventDefault()
      e.stopPropagation()
      clearSelection()
      return
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && selectionRanges.length > 0) {
      const tsv = buildSelectionTsv(selectionRanges, effectiveRows, columns)
      if (!tsv) return
      try { navigator.clipboard?.writeText(tsv) } catch { /* portapapeles no disponible */ }
      return
    }
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) || effectiveRows.length === 0 || columns.length === 0) return
    e.preventDefault()
    const baseRow = selectionRange ? selectionRange.endRow : (activeCell?.rowIndex ?? 0)
    const baseCol = selectionRange ? selectionRange.endCol : (activeCell?.colIndex ?? 0)
    let nextRow = Math.min(effectiveRows.length - 1, Math.max(0, baseRow))
    let nextCol = Math.min(columns.length - 1, Math.max(0, baseCol))
    if (e.key === 'ArrowUp') nextRow = Math.max(0, nextRow - 1)
    if (e.key === 'ArrowDown') nextRow = Math.min(effectiveRows.length - 1, nextRow + 1)
    if (e.key === 'ArrowLeft') nextCol = Math.max(0, nextCol - 1)
    if (e.key === 'ArrowRight') nextCol = Math.min(columns.length - 1, nextCol + 1)
    if (e.shiftKey) {
      const aRow = selectionRange ? selectionRange.startRow : (activeCell?.rowIndex ?? 0)
      const aCol = selectionRange ? selectionRange.startCol : (activeCell?.colIndex ?? 0)
      commit({ activeCell: activeCell || { rowIndex: aRow, colIndex: aCol }, range: { startRow: aRow, endRow: nextRow, startCol: aCol, endCol: nextCol } })
    } else {
      commit({ activeCell: { rowIndex: nextRow, colIndex: nextCol }, range: cellRange(nextRow, nextCol), extra: [] })
    }
  }, [selectionRange, selectionRanges, activeCell, effectiveRows, columns, clearSelection, commit])

  const isCellActive = useCallback((r, c) => Boolean(activeCell && activeCell.rowIndex === r && activeCell.colIndex === c), [activeCell])
  const isCellSelected = useCallback((r, c) => selectionRanges.length > 0 && isCellInRanges(selectionRanges, r, c), [selectionRanges])

  const selectionStats = useMemo(
    () => (selectionRanges.length === 0 ? null : computeSheetStats(selectionRanges, effectiveRows, columns)),
    [selectionRanges, effectiveRows, columns]
  )

  const getCellProps = useCallback((rowIndex, colKey) => {
    const colIdx = colIndexByKey.get(colKey)
    if (colIdx === undefined) return { className: '', domProps: {} }
    const active = isCellActive(rowIndex, colIdx)
    const selected = isCellSelected(rowIndex, colIdx)
    return {
      domProps: {
        onMouseDown: (e) => handleCellMouseDown(rowIndex, colIdx, e),
        onMouseEnter: () => handleCellMouseEnter(rowIndex, colIdx)
      },
      className: `select-none cursor-cell ${active ? 'ring-2 ring-inset ring-cyan-400 bg-cyan-950/60' : selected ? 'bg-cyan-500/20 ring-1 ring-inset ring-cyan-400/45' : ''}`
    }
  }, [colIndexByKey, isCellActive, isCellSelected, handleCellMouseDown, handleCellMouseEnter])

  const getHeaderProps = useCallback((colKey, extraClassName = '') => {
    const colIdx = colIndexByKey.get(colKey)
    const isCol = colIdx !== undefined && selectionRange && selectionRange.startCol === colIdx && selectionRange.endCol === colIdx &&
      (selectionRange.isColumn || (selectionRange.startRow === 0 && selectionRange.endRow === effectiveRows.length - 1 && effectiveRows.length > 1))
    return {
      onClick: (e) => {
        if (e.target?.closest?.('button, input, select, a') || colIdx === undefined) return
        selectColumn(colIdx, e.ctrlKey || e.metaKey)
      },
      ...(sortable ? {
        onDoubleClick: (e) => {
          if (e.target?.closest?.('button, input, select, a')) return
          e.stopPropagation()
          toggleSort(colKey)
        }
      } : {}),
      title: `Clic: seleccionar columna y ver Suma / Promedio / Cantidad abajo (Ctrl+Clic suma otra columna)${sortable ? ' · Doble clic: ordenar ↕' : ''}`,
      'data-col-select': 'true',
      className: `${extraClassName} cursor-pointer select-none transition-colors ${isCol ? 'bg-cyan-500/25 text-cyan-100' : 'hover:text-cyan-300'}`.trim()
    }
  }, [colIndexByKey, selectionRange, effectiveRows.length, selectColumn, sortable, toggleSort])

  return {
    containerRef, activeCell, selectionRange, selectionRanges, selectionStats,
    sortedRows, sortState, toggleSort, getSortIndicator,
    clearSelection, handleKeyDown, getCellProps, getHeaderProps, selectColumn
  }
}

export default useSheetSelection
