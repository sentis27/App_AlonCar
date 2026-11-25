/**
 * comprasPerformanceHelpers.js
 * Lookups O(1), mapa de coincidencias sin escaneo repetido y cálculo de celda memoizable
 * para la planilla de Compras (FL-025).
 */
import { STATUS_OPTIONS } from './comprasConstants.js'

export const STATUS_BY_VALUE = new Map(STATUS_OPTIONS.map((s) => [s.value, s]))

export const COMPRAS_COLS_COMPLETA = [
  { key: 'charge_type', readOnly: false },
  { key: 'order_date', readOnly: false },
  { key: 'ship_id', readOnly: false },
  { key: 'requested_by_name', readOnly: false },
  { key: 'material_name_raw', readOnly: false },
  { key: 'quantity', readOnly: false },
  { key: 'supplier_quoted_price', readOnly: false },
  { key: 'system_unit_price', readOnly: true },
  { key: 'supplier_id', readOnly: false },
  { key: 'status', readOnly: false },
  { key: 'urgency', readOnly: false },
  { key: 'delivery_date', readOnly: false },
]

export const COMPRAS_COLS_SIMPLE = COMPRAS_COLS_COMPLETA.filter(
  (c) => c.key !== 'supplier_quoted_price' && c.key !== 'system_unit_price'
)

const INDEX_COMPLETA = Object.fromEntries(COMPRAS_COLS_COMPLETA.map((c, i) => [c.key, i]))
const INDEX_SIMPLE = Object.fromEntries(COMPRAS_COLS_SIMPLE.map((c, i) => [c.key, i]))

export function getComprasColumnsMeta(viewMode) {
  return viewMode === 'completa'
    ? { cols: COMPRAS_COLS_COMPLETA, indexByKey: INDEX_COMPLETA }
    : { cols: COMPRAS_COLS_SIMPLE, indexByKey: INDEX_SIMPLE }
}

const EMPTY_MATCH = Object.freeze({
  hasMatch: false,
  material: false,
  supplier: false,
  ship: false,
  requested_by: false,
  freight: false,
  documents: false,
  docMatchDetail: null,
})

/**
 * Versión O(1) de `getSearchMatchMap` usando entidades ya resueltas por Map.
 * Evita 3 `.find()` + 1 `.filter()` completos en cada fila de Compras.
 */
export function getFastComprasMatchMap(po, searchQuery, { sup = null, shp = null, orderDocs = [] } = {}) {
  const q = String(searchQuery || '').toLowerCase().trim()
  if (!q) return EMPTY_MATCH

  const matRaw = (po.material_name_raw || '').toLowerCase()
  const obs = (po.observations || '').toLowerCase()
  const supName = (sup?.name || '').toLowerCase()
  const shpName = (shp?.name || '').toLowerCase()
  const req = (po.requested_by_name || '').toLowerCase()
  const trn = (po.freight_transport_name || '').toLowerCase()

  let docMatchDetail = null
  let isDoc = false
  for (let i = 0; i < orderDocs.length; i++) {
    const d = orderDocs[i]
    if ((d.original_filename || '').toLowerCase().includes(q)) { docMatchDetail = d.original_filename; isDoc = true; break }
    if ((d.description || '').toLowerCase().includes(q)) { docMatchDetail = d.description; isDoc = true; break }
    if ((d.doc_type || '').toLowerCase().includes(q)) { docMatchDetail = d.doc_type; isDoc = true; break }
    if ((d.extracted_text || '').toLowerCase().includes(q)) { docMatchDetail = `Texto en ${d.original_filename || 'PDF'}`; isDoc = true; break }
  }

  const material = matRaw.includes(q) || obs.includes(q)
  const supplier = supName.includes(q)
  const ship = shpName.includes(q)
  const requested_by = req.includes(q)
  const freight = trn.includes(q)

  return {
    hasMatch: material || supplier || ship || requested_by || freight || isDoc,
    material,
    supplier,
    ship,
    requested_by,
    freight,
    documents: isDoc,
    docMatchDetail,
  }
}

export function buildMemoizedComprasCellProps({
  rowIndex,
  colKey,
  indexByKey,
  activeColIndex,
  selStartCol,
  selEndCol,
  fillColIndex,
  fillHandleColIndex,
  gridActions,
}) {
  const colIdx = indexByKey[colKey]
  if (colIdx === undefined) return { className: '', renderHandle: false, domProps: {} }
  const isActive = activeColIndex === colIdx
  const isSelected = selStartCol >= 0 && colIdx >= selStartCol && colIdx <= selEndCol
  const isFillPreview = fillColIndex === colIdx
  const renderHandle = fillHandleColIndex === colIdx

  return {
    renderHandle,
    domProps: {
      onClick: (e) => gridActions.onCellClick(rowIndex, colIdx, e),
      onMouseDown: (e) => gridActions.onCellMouseDown(rowIndex, colIdx, e),
      onMouseEnter: () => gridActions.onCellMouseEnter(rowIndex, colIdx),
    },
    className: `relative select-none transition-colors ${
      isActive
        ? 'ring-2 ring-cyan-400 bg-cyan-950/40 z-20 outline-none'
        : isFillPreview
        ? 'bg-cyan-900/40 border-y border-dashed border-cyan-400'
        : isSelected
        ? 'bg-cyan-900/30'
        : ''
    }`,
  }
}
