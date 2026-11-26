import { useCallback } from 'react'
import { buildSelectionTsv, normalizeRange } from '../../lib/sheetSelectionEngine.js'

/**
 * useGridRangeCopy
 * `Ctrl+C` de bloques 2D (y rangos salteados) hacia Excel / Google Sheets en formato TSV.
 * Si hay una sola celda devuelve `false` para que actúe el copiado de celda/fila existente.
 */
export function useGridRangeCopy({ selectionRanges, rows, columns, readCellValue, clipboard, showFeedback }) {
  return useCallback(() => {
    const valid = (selectionRanges || []).map((r) => normalizeRange(r, rows.length, columns.length)).filter(Boolean)
    const totalCells = valid.reduce((s, r) => s + (r.maxR - r.minR + 1) * (r.maxC - r.minC + 1), 0)
    if (totalCells <= 1) return false

    const tsv = buildSelectionTsv(selectionRanges, rows, columns, readCellValue)
    if (!tsv) return false
    clipboard?.setInternalClipboard?.(null)
    try {
      navigator.clipboard?.writeText(tsv)?.catch?.(() => {})
    } catch {
      // Portapapeles nativo no disponible
    }
    showFeedback?.('info', `Copiadas ${totalCells} celdas (${valid.length > 1 ? 'selección salteada' : `${valid[0].maxR - valid[0].minR + 1} filas × ${valid[0].maxC - valid[0].minC + 1} col.`}). Pegá con Ctrl+V en Excel / Sheets.`)
    return true
  }, [selectionRanges, rows, columns, readCellValue, clipboard, showFeedback])
}
