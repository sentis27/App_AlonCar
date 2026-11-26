/**
 * useReadOnlySheetSelection — alias retrocompatible del motor único `useSheetSelection` (FL-027).
 * Las hojas de Resumen Gerencial conservan su import; toda mejora vive en `useSheetSelection`.
 */
export { useSheetSelection as useReadOnlySheetSelection } from './useSheetSelection.js'
export { computeReadOnlySelectionStats } from '../../lib/readOnlySheetSelectionStats'
