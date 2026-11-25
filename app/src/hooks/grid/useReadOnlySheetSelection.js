import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import {
  computeReadOnlySelectionStats,
  buildReadOnlySelectionTsv
} from '../../lib/readOnlySheetSelectionStats'

export { computeReadOnlySelectionStats }

/**
 * Hook canónico liviano para selección de rango de celdas tipo Excel / Google Sheets
 * en hojas analíticas de solo lectura (Materiales, Horas y Terceros de Resumen Gerencial).
 */
export function useReadOnlySheetSelection({
  rows = [],
  columns = [],
  getRowId = (row) => row?.id
}) {
  const containerRef = useRef(null)
  const dragAnchorRef = useRef(null)
  const [isMouseDown, setIsMouseDown] = useState(false)
  const [selectionState, setSelectionState] = useState({
    signature: '',
    activeCell: null,
    selectionRange: null
  })

  const colIndexByKey = useMemo(() => {
    const map = new Map()
    columns.forEach((col, idx) => map.set(col.key, idx))
    return map
  }, [columns])

  const rowsSignature = useMemo(
    () => `${rows.length}:${rows[0] ? String(getRowId(rows[0])) : ''}:${rows[rows.length - 1] ? String(getRowId(rows[rows.length - 1])) : ''}`,
    [rows, getRowId]
  )

  const activeCell = selectionState.signature === rowsSignature ? selectionState.activeCell : null
  const selectionRange = selectionState.signature === rowsSignature ? selectionState.selectionRange : null

  useEffect(() => {
    function handleGlobalMouseUp() {
      setIsMouseDown(false)
      dragAnchorRef.current = null
    }
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => window.removeEventListener('mouseup', handleGlobalMouseUp)
  }, [])

  const clearSelection = useCallback(() => {
    setSelectionState({ signature: rowsSignature, activeCell: null, selectionRange: null })
    setIsMouseDown(false)
    dragAnchorRef.current = null
  }, [rowsSignature])

  const handleCellMouseDown = useCallback((rowIndex, colIndex, e) => {
    if (e.button !== 0) return
    if (e.target.closest('button, a, input, select, textarea')) return

    containerRef.current?.focus({ preventScroll: true })

    if (e.shiftKey && activeCell) {
      e.preventDefault()
      setSelectionState({
        signature: rowsSignature,
        activeCell,
        selectionRange: {
          startRow: activeCell.rowIndex,
          endRow: rowIndex,
          startCol: activeCell.colIndex,
          endCol: colIndex
        }
      })
      return
    }

    e.preventDefault()
    setIsMouseDown(true)
    dragAnchorRef.current = { rowIndex, colIndex }
    setSelectionState({
      signature: rowsSignature,
      activeCell: { rowIndex, colIndex },
      selectionRange: {
        startRow: rowIndex,
        endRow: rowIndex,
        startCol: colIndex,
        endCol: colIndex
      }
    })
  }, [activeCell, rowsSignature])

  const handleCellMouseEnter = useCallback((rowIndex, colIndex) => {
    if (!isMouseDown || !dragAnchorRef.current) return
    const anchor = dragAnchorRef.current
    setSelectionState((prev) => ({
      signature: rowsSignature,
      activeCell: prev.signature === rowsSignature ? prev.activeCell : anchor,
      selectionRange: {
        startRow: anchor.rowIndex,
        endRow: rowIndex,
        startCol: anchor.colIndex,
        endCol: colIndex
      }
    }))
  }, [isMouseDown, rowsSignature])

  const handleKeyDown = useCallback((e) => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target?.tagName)) return

    if (e.key === 'Escape') {
      if (selectionRange || activeCell) {
        e.preventDefault()
        clearSelection()
      }
      return
    }

    if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C') && (selectionRange || activeCell)) {
      const range = selectionRange || (activeCell
        ? { startRow: activeCell.rowIndex, endRow: activeCell.rowIndex, startCol: activeCell.colIndex, endCol: activeCell.colIndex }
        : null)
      const tsv = buildReadOnlySelectionTsv(range, rows, columns)
      if (!tsv) return
      try {
        navigator.clipboard?.writeText(tsv)
      } catch {
        // Fallback silencioso si el portapapeles no está disponible
      }
      return
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      if (rows.length === 0 || columns.length === 0) return
      e.preventDefault()
      const baseRow = selectionRange ? selectionRange.endRow : (activeCell?.rowIndex ?? 0)
      const baseCol = selectionRange ? selectionRange.endCol : (activeCell?.colIndex ?? 0)
      let nextRow = Math.min(rows.length - 1, Math.max(0, baseRow))
      let nextCol = Math.min(columns.length - 1, Math.max(0, baseCol))

      if (e.key === 'ArrowUp') nextRow = Math.max(0, nextRow - 1)
      if (e.key === 'ArrowDown') nextRow = Math.min(rows.length - 1, nextRow + 1)
      if (e.key === 'ArrowLeft') nextCol = Math.max(0, nextCol - 1)
      if (e.key === 'ArrowRight') nextCol = Math.min(columns.length - 1, nextCol + 1)

      if (e.shiftKey) {
        const anchorRow = selectionRange ? selectionRange.startRow : (activeCell?.rowIndex ?? 0)
        const anchorCol = selectionRange ? selectionRange.startCol : (activeCell?.colIndex ?? 0)
        setSelectionState({
          signature: rowsSignature,
          activeCell: activeCell || { rowIndex: anchorRow, colIndex: anchorCol },
          selectionRange: {
            startRow: anchorRow,
            endRow: nextRow,
            startCol: anchorCol,
            endCol: nextCol
          }
        })
      } else {
        setSelectionState({
          signature: rowsSignature,
          activeCell: { rowIndex: nextRow, colIndex: nextCol },
          selectionRange: {
            startRow: nextRow,
            endRow: nextRow,
            startCol: nextCol,
            endCol: nextCol
          }
        })
      }
    }
  }, [selectionRange, activeCell, rows, columns, clearSelection, rowsSignature])

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

  const selectionStats = useMemo(
    () => computeReadOnlySelectionStats(selectionRange, rows, columns),
    [selectionRange, rows, columns]
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
      className: `select-none cursor-cell ${
        active
          ? 'ring-2 ring-inset ring-cyan-400 bg-cyan-950/60'
          : selected
            ? 'bg-cyan-500/20 ring-1 ring-inset ring-cyan-400/45'
            : ''
      }`
    }
  }, [colIndexByKey, isCellActive, isCellSelected, handleCellMouseDown, handleCellMouseEnter])

  return {
    containerRef,
    activeCell,
    selectionRange,
    selectionStats,
    clearSelection,
    handleKeyDown,
    getCellProps
  }
}
