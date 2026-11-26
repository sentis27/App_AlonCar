/**
 * readOnlySheetSelectionStats — compatibilidad: delega en el motor único `sheetSelectionEngine` (FL-027).
 * Las columnas con `isNumeric: false` nunca se parsean como números (OT, fechas, notas).
 */
import { computeSheetStats, buildSelectionTsv } from './sheetSelectionEngine'

export function computeReadOnlySelectionStats(selectionRange, rows = [], columns = []) {
  return selectionRange ? computeSheetStats(selectionRange, rows, columns) : null
}

export function buildReadOnlySelectionTsv(range, rows = [], columns = []) {
  return range ? buildSelectionTsv(range, rows, columns) : ''
}
