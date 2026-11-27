import { useState, useRef, useMemo } from 'react'
import { Anchor } from 'lucide-react'
import CanonicalZone3Toolbar from '../canonical/CanonicalZone3Toolbar.jsx'
import CanonicalProgressiveTableFooter from '../canonical/CanonicalProgressiveTableFooter.jsx'
import GridStatusBarBottom from '../GridStatusBarBottom.jsx'
import CostControlMaterialRow from './CostControlMaterialRow.jsx'
import { useSheetSelection } from '../../hooks/grid/useSheetSelection.js'
import { useProgressiveRows } from '../../hooks/useProgressiveRows.js'
import { getFilterSelectClass } from '../../lib/filterThemeConstants.js'
import { buildLookupMap } from '../../lib/gridPerformanceHelpers.js'

const MATERIALS_SHEET_COLUMNS = [
  { key: 'date', label: 'Fecha', type: 'date', getValue: (r) => r.dateAr || '' },
  { key: 'voucher', label: 'Vale', isNumeric: false, getValue: (r) => r.voucherNumber || '' },
  { key: 'material', label: 'Material / Cant.', isNumeric: false, getValue: (r) => `${r.materialName || ''} (${r.quantity || 0} ${r.unitMeasure || ''})` },
  { key: 'entity', label: 'Contratista', isNumeric: false, getValue: (r) => r.entity || '' },
  { key: 'shipOt', label: 'Buque / OT', isNumeric: false, getValue: (r) => `${r.shipName || ''} · ${r.otLabel || ''}` },
  { key: 'status', label: 'Estado', isNumeric: false, getValue: (r) => r.status || '' },
]

export default function CostControlMaterialsTable({
  rows = [],
  totalCount = 0,
  ships = [],
  workOrders = [],
  workItems = [],
  statusFilter,
  onStatusFilterChange,
  searchQuery,
  onSearchChange,
  hasActiveFilters = false,
  onClearAllFilters,
  selectedTxIds = new Set(),
  onToggleSelectTx,
  onToggleSelectAll,
  onClearSelection,
  focusedRowId,
  onFocusRow,
  onOpenShipOtModal,
  onBatchUpdate,
  onValidateException,
  onRevokeReview,
  saving = false,
}) {
  const searchInputRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const [batchDateDraft, setBatchDateDraft] = useState('')

  const shipsById = useMemo(() => buildLookupMap(ships), [ships])
  const workOrdersById = useMemo(() => buildLookupMap(workOrders), [workOrders])

  const sheet = useSheetSelection({ rows, columns: MATERIALS_SHEET_COLUMNS, getRowId: (r) => r.id, sortable: true })
  const resetKey = `${statusFilter}|${searchQuery}|${rows.length}`
  const progressive = useProgressiveRows({ items: sheet.sortedRows, resetKey, scrollContainerRef })

  const visibleIds = useMemo(() => sheet.sortedRows.map((r) => r.id), [sheet.sortedRows])
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedTxIds.has(id))

  return (
    <div className="space-y-2.5">
      <div className="alon-workspace-block">
        <CanonicalZone3Toolbar
          searchValue={searchQuery}
          onSearchChange={onSearchChange}
          searchInputRef={searchInputRef}
          searchPlaceholder="Buscar material, vale, barco, OT o contratista... (Ctrl+F)"
          hasActiveFilters={hasActiveFilters}
          onClearAllFilters={onClearAllFilters}
          counterText={`${rows.length} de ${totalCount} líneas`}
          filters={
            <select
              aria-label="Estado de conciliación"
              value={statusFilter}
              onChange={(e) => onStatusFilterChange(e.target.value)}
              className={getFilterSelectClass('status', statusFilter !== 'NO', 'bg-slate-950')}
            >
              <option value="NO" className="bg-slate-950 text-slate-100">Solo desvíos (NO)</option>
              <option value="SHIP_ERROR" className="bg-slate-950 text-slate-100">Posible error de Barco</option>
              <option value="PREV_QUINCENA" className="bg-slate-950 text-slate-100">Coincide quincena anterior</option>
              <option value="VALIDATED_EXCEPTION" className="bg-slate-950 text-slate-100">Excepciones validadas</option>
              <option value="OK" className="bg-slate-950 text-slate-100">Conciliadas OK</option>
              <option value="ALL" className="bg-slate-950 text-slate-100">Todas las líneas</option>
            </select>
          }
        />

        <div className="alon-zone-grid">
          <div className="alon-grid-ribbon">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-black text-emerald-300 uppercase tracking-wider">
                Líneas de Materiales ({rows.length})
              </span>
              {selectedTxIds.size > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 pl-2 border-l border-emerald-500/30">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => onOpenShipOtModal({ mode: 'batch', txIds: Array.from(selectedTxIds) })}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black cursor-pointer"
                    title="Reasignar Buque y OT a todas las líneas tildadas"
                  >
                    <Anchor className="w-3 h-3" />
                    <span>Asignar Buque/OT ({selectedTxIds.size})</span>
                  </button>
                  <input
                    type="date"
                    aria-label="Nueva fecha para selección en lote"
                    value={batchDateDraft}
                    onChange={(e) => setBatchDateDraft(e.target.value)}
                    className="bg-slate-950 text-slate-100 border border-indigo-500/60 rounded-lg px-2 py-0.5 text-[11px]"
                  />
                  <button
                    type="button"
                    disabled={saving || !batchDateDraft}
                    onClick={async () => {
                      if (!batchDateDraft) return
                      await onBatchUpdate({ txIds: Array.from(selectedTxIds), patch: { dateArIso: batchDateDraft } })
                      setBatchDateDraft('')
                    }}
                    className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-bold cursor-pointer"
                    title="Cambiar fecha en lote (útil para saltos de quincena)"
                  >
                    Aplicar fecha
                  </button>
                  <button
                    type="button"
                    onClick={onClearSelection}
                    className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
                  >
                    Limpiar
                  </button>
                </div>
              )}
            </div>
            <span className="text-[10px] text-slate-400">Doble clic en Fecha o Buque/OT para editar</span>
          </div>

          <div ref={scrollContainerRef} tabIndex={0} onKeyDown={sheet.handleKeyDown} className="alon-grid-scroll">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="alon-grid-thead">
                <tr>
                  <th className="w-9 px-2 py-2 text-center">
                    <input
                      type="checkbox"
                      aria-label="Seleccionar todas las líneas visibles"
                      checked={allVisibleSelected}
                      onChange={() => onToggleSelectAll(visibleIds)}
                      className="cursor-pointer accent-cyan-400"
                    />
                  </th>
                  {MATERIALS_SHEET_COLUMNS.map((col) => {
                    const hdr = sheet.getHeaderProps(col.key, 'px-2.5 py-2 whitespace-nowrap')
                    const editableMark = col.key === 'date' || col.key === 'shipOt' ? ' ✎' : ''
                    return (
                      <th key={col.key} {...hdr}>
                        {col.label}{editableMark}{sheet.getSortIndicator(col.key)}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {progressive.visibleItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      Sin líneas de materiales para los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  progressive.visibleItems.map((row, rowIdx) => (
                    <CostControlMaterialRow
                      key={row.id}
                      row={row}
                      rowIdx={rowIdx}
                      isFocused={focusedRowId === row.id}
                      isChecked={selectedTxIds.has(row.id)}
                      shipObj={row.shipId ? shipsById.get(row.shipId) : null}
                      woObj={row.workOrderId ? workOrdersById.get(row.workOrderId) : null}
                      workItems={workItems}
                      workOrders={workOrders}
                      searchQuery={searchQuery}
                      sheet={sheet}
                      saving={saving}
                      onFocusRow={onFocusRow}
                      onToggleSelectTx={onToggleSelectTx}
                      onOpenShipOtModal={onOpenShipOtModal}
                      onBatchUpdate={onBatchUpdate}
                      onValidateException={onValidateException}
                      onRevokeReview={onRevokeReview}
                    />
                  ))
                )}
                <CanonicalProgressiveTableFooter
                  visibleCount={progressive.visibleCount}
                  totalCount={progressive.totalCount}
                  hasMore={progressive.hasMore}
                  remainingCount={progressive.remainingCount}
                  loadMore={progressive.loadMore}
                  showAll={progressive.showAll}
                  sentinelRef={progressive.sentinelRef}
                  colSpan={7}
                  entityLabel="líneas de material"
                />
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <GridStatusBarBottom
        isFixed={false}
        filteredCount={rows.length}
        totalCount={totalCount}
        entityName="líneas"
        hasActiveFilter={hasActiveFilters}
        onClearFilters={onClearAllFilters}
        selectionStats={sheet.selectionStats}
        onClearSelection={sheet.clearSelection}
        customSelection={selectedTxIds.size > 0 ? { count: selectedTxIds.size, label: 'líneas tildadas', onClear: onClearSelection } : null}
      />
    </div>
  )
}
