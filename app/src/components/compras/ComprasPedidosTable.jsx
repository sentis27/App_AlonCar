import { useEffect, useMemo, useRef } from 'react'
import { CheckSquare, Square } from 'lucide-react'
import GridRibbon from '../GridRibbon'
import GridContextMenu from '../GridContextMenu'
import CanonicalProgressiveTableFooter from '../canonical/CanonicalProgressiveTableFooter'
import ComprasPedidoRow from './ComprasPedidoRow'
import { getTodayArIso } from '../../lib/dateTimeCanonical'
import {
  buildLookupMap,
  buildGroupedMap,
  computeGridSelectionBounds,
  DEFAULT_PROGRESSIVE_INITIAL,
  DEFAULT_PROGRESSIVE_BATCH,
} from '../../lib/gridPerformanceHelpers'
import { getComprasColumnsMeta } from '../../lib/comprasPerformanceHelpers'
import { useProgressiveRows } from '../../hooks/useProgressiveRows'

const EMPTY_DOCS = []

export default function ComprasPedidosTable({
  filteredOrders,
  filterResetKey = '',
  materials,
  suppliers,
  ships,
  workOrders,
  workItems = [],
  documents,
  searchQuery,
  viewMode,
  isSupervisorOrAdmin,
  grid,
  selectedOrderIds,
  isAllFilteredSelected,
  toggleSelectAll,
  toggleSelectRow,
  inlineEdit,
  setInlineEdit,
  rowMenuTarget,
  setRowMenuTarget,
  activateComprasCell,
  saveInlineEdit,
  saveInlineMaterialAndObs,
  handleQuickStatusChange,
  handleCycleUrgency,
  handleAddNewBlankOrder,
  handleInsertOrderContext,
  handleDuplicateOrder,
  handleDeleteOrder,
  onOpenNewMaterial,
  onOpenDocs,
  onOpenReconcile,
  onOpenFreight,
  onOpenSupplierHelper,
  onEditOrder
}) {
  const {
    gridContainerRef, handleKeyDown, activeCellBadge, undoStack, activeCell, selectionRange,
    fillRange, copyActiveCell, copyRow, pasteToActiveOrRange, deleteActiveCellOrRange,
  } = grid

  const gridHandlersRef = useRef(null)
  const rowMenuRef = useRef(rowMenuTarget)

  useEffect(() => {
    gridHandlersRef.current = {
      handleCellClick: grid.handleCellClick,
      handleCellMouseDown: grid.handleCellMouseDown,
      handleCellMouseEnter: grid.handleCellMouseEnter,
      handleFillHandleMouseDown: grid.handleFillHandleMouseDown,
      handleFillHandleDoubleClick: grid.handleFillHandleDoubleClick,
      setActiveCell: grid.setActiveCell,
      setSelectionRange: grid.setSelectionRange,
      activeCell: grid.activeCell,
    }
    rowMenuRef.current = rowMenuTarget
  })

  const suppliersById = useMemo(() => buildLookupMap(suppliers), [suppliers])
  const shipsById = useMemo(() => buildLookupMap(ships), [ships])
  const workOrdersById = useMemo(() => buildLookupMap(workOrders), [workOrders])
  const docsByOrderId = useMemo(() => buildGroupedMap(documents, 'purchase_order_id'), [documents])
  const docsByWoId = useMemo(() => buildGroupedMap(documents, 'work_order_id'), [documents])
  const exportFilename = useMemo(() => `compras_pedidos_${getTodayArIso()}`, [])

  const { cols: comprasCols, indexByKey } = getComprasColumnsMeta(viewMode)

  const {
    visibleItems: visibleOrders,
    visibleCount,
    hasMore,
    remainingCount,
    loadMore,
    showAll,
    sentinelRef,
  } = useProgressiveRows({
    items: filteredOrders,
    initialCount: DEFAULT_PROGRESSIVE_INITIAL,
    batchSize: DEFAULT_PROGRESSIVE_BATCH,
    activeIndex: activeCell?.rowIndex ?? -1,
    scrollContainerRef: gridContainerRef,
    resetKey: filterResetKey,
  })

  const gridActions = useMemo(() => ({
    onCellClick: (rowIdx, colIdx, e) => gridHandlersRef.current?.handleCellClick(rowIdx, colIdx, e),
    onCellMouseDown: (rowIdx, colIdx, e) => gridHandlersRef.current?.handleCellMouseDown(rowIdx, colIdx, e),
    onCellMouseEnter: (rowIdx, colIdx) => gridHandlersRef.current?.handleCellMouseEnter(rowIdx, colIdx),
    onFillHandleMouseDown: (e) => gridHandlersRef.current?.handleFillHandleMouseDown(e),
    onFillHandleDoubleClick: (e) => gridHandlersRef.current?.handleFillHandleDoubleClick(e),
    onContextMenuRow: (po, rowIdx, e) => {
      e.preventDefault(); e.stopPropagation()
      const h = gridHandlersRef.current
      if (h && h.activeCell?.rowIndex !== rowIdx) {
        h.setActiveCell({ rowIndex: rowIdx, colIndex: h.activeCell?.colIndex ?? 0 })
        h.setSelectionRange?.(null)
      }
      setRowMenuTarget({ order: po, rowIndex: rowIdx, mode: 'context_menu', x: e.clientX, y: e.clientY })
    },
    onToggleClickNumMenu: (po, rowIdx, e) => {
      e.stopPropagation()
      const cur = rowMenuRef.current
      setRowMenuTarget(cur?.order?.id === po.id && cur?.mode === 'click_num' ? null : { order: po, rowIndex: rowIdx, mode: 'click_num' })
    },
  }), [setRowMenuTarget])

  const { selMinR, selMaxR, selMinC, selMaxC, fillFromR, fillMaxR, fillCol, handleRow, handleCol } =
    computeGridSelectionBounds({ activeCell, selectionRange, fillRange, columns: comprasCols })

  const hasSearch = Boolean(searchQuery && searchQuery.trim())

  return (
    <div className="alon-zone-grid">
      <GridRibbon
        activeCellBadge={activeCellBadge}
        onInsertRow={() => {
          const targetIdx = activeCell?.rowIndex >= 0 ? activeCell.rowIndex : 0
          const targetPo = filteredOrders[targetIdx]
          if (targetPo) handleInsertOrderContext(targetPo, targetIdx, 'below')
          else handleAddNewBlankOrder()
        }}
        insertRowLabel="Nueva Fila en Blanco"
        undoCount={undoStack?.length || 0}
        totalRows={filteredOrders.length}
        entityName="pedidos"
        exportRows={filteredOrders}
        exportFilename={exportFilename}
      />

      <div tabIndex={0} onKeyDown={handleKeyDown} ref={gridContainerRef} className="alon-grid-scroll">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead className="sticky top-0 z-20 alon-grid-thead">
            <tr>
              <th className="py-1 px-1 w-8 text-center select-none">
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <button
                    type="button"
                    onClick={toggleSelectAll}
                    className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                    title={isAllFilteredSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  >
                    {isAllFilteredSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
                  </button>
                  <span className="font-mono text-[9px] text-slate-500 font-bold" title="Número de fila">#</span>
                </div>
              </th>
              <th {...grid.getColumnHeaderProps('charge_type', 'py-2 px-1.5')}>Destino ✎</th>
              <th {...grid.getColumnHeaderProps('order_date', 'py-2 px-1.5')}>Fecha / Q. ✎</th>
              <th {...grid.getColumnHeaderProps('ship_id', 'py-2 px-1.5')}>Buque / OT ✎</th>
              <th {...grid.getColumnHeaderProps('requested_by_name', 'py-2 px-1.5')}>Solicita ✎</th>
              <th {...grid.getColumnHeaderProps('material_name_raw', 'py-2 px-1.5')}>Material Solicitado ✎</th>
              <th {...grid.getColumnHeaderProps('quantity', 'py-2 px-1.5 text-right')}>Cant. ✎</th>
              {viewMode === 'completa' && (
                <>
                  <th {...grid.getColumnHeaderProps('supplier_quoted_price', 'py-2 px-1.5 text-right')}>$/U Prov. ✎</th>
                  <th {...grid.getColumnHeaderProps('system_unit_price', 'py-2 px-1.5 text-right')}>$/U Sist.</th>
                </>
              )}
              <th {...grid.getColumnHeaderProps('supplier_id', 'py-2 px-1.5')}>Proveedor ✎</th>
              <th {...grid.getColumnHeaderProps('status', 'py-2 px-1.5')}>Estado ✎</th>
              <th {...grid.getColumnHeaderProps('urgency', 'py-2 px-1.5')}>Urg. ✎</th>
              <th className="py-2 px-1.5 text-center">Doc</th>
              <th {...grid.getColumnHeaderProps('delivery_date', 'py-2 px-1.5 text-center')} title="Fecha de entrega del pedido">F. Entrega ✎</th>
              {viewMode === 'completa' && (
                <th className="py-2 px-1 w-9 text-center" title="Conciliado con Factura">Conc.</th>
              )}
              <th className="py-2 px-1.5 text-center">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 font-sans">
            {filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={viewMode === 'completa' ? 16 : 13} className="text-center py-12 text-slate-500">
                  No se encontraron registros de compra con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              <>
                {visibleOrders.map((po, rowIndex) => {
                  const isEditingRow = inlineEdit.orderId === po.id
                  const rowInSel = selectionRange && rowIndex >= selMinR && rowIndex <= selMaxR
                  const rowInFill = fillRange && rowIndex > fillFromR && rowIndex <= fillMaxR
                  const lineDocs = docsByOrderId.get(String(po.id)) || EMPTY_DOCS
                  const woDocs = hasSearch && po.work_order_id ? (docsByWoId.get(String(po.work_order_id)) || EMPTY_DOCS) : EMPTY_DOCS
                  return (
                    <ComprasPedidoRow
                      key={po.id}
                      po={po}
                      rowIndex={rowIndex}
                      viewMode={viewMode}
                      indexByKey={indexByKey}
                      isSelected={selectedOrderIds.has(po.id)}
                      sup={po.supplier_id ? (suppliersById.get(String(po.supplier_id)) || null) : null}
                      shp={po.ship_id ? (shipsById.get(String(po.ship_id)) || null) : null}
                      wo={po.work_order_id ? (workOrdersById.get(String(po.work_order_id)) || null) : null}
                      lineDocs={lineDocs}
                      woDocs={woDocs}
                      suppliers={suppliers}
                      materials={materials}
                      workOrders={workOrders}
                      workItems={workItems}
                      searchQuery={searchQuery}
                      isSupervisorOrAdmin={isSupervisorOrAdmin}
                      activeColIndex={activeCell?.rowIndex === rowIndex ? activeCell.colIndex : -1}
                      selStartCol={rowInSel ? selMinC : -1}
                      selEndCol={rowInSel ? selMaxC : -1}
                      fillColIndex={rowInFill ? fillCol : -1}
                      fillHandleColIndex={handleRow === rowIndex ? handleCol : -1}
                      rowInlineEdit={isEditingRow ? inlineEdit : null}
                      isClickNumMenuOpen={Boolean(rowMenuTarget?.order?.id === po.id && rowMenuTarget?.mode === 'click_num')}
                      gridActions={gridActions}
                      setInlineEdit={setInlineEdit}
                      setRowMenuTarget={setRowMenuTarget}
                      toggleSelectRow={toggleSelectRow}
                      activateComprasCell={activateComprasCell}
                      saveInlineEdit={saveInlineEdit}
                      saveInlineMaterialAndObs={saveInlineMaterialAndObs}
                      handleQuickStatusChange={handleQuickStatusChange}
                      handleCycleUrgency={handleCycleUrgency}
                      handleInsertOrderContext={handleInsertOrderContext}
                      handleDuplicateOrder={handleDuplicateOrder}
                      handleDeleteOrder={handleDeleteOrder}
                      onOpenNewMaterial={onOpenNewMaterial}
                      onOpenDocs={onOpenDocs}
                      onOpenReconcile={onOpenReconcile}
                      onOpenFreight={onOpenFreight}
                      onOpenSupplierHelper={onOpenSupplierHelper}
                      onEditOrder={onEditOrder}
                    />
                  )
                })}
                <CanonicalProgressiveTableFooter
                  visibleCount={visibleCount}
                  totalCount={filteredOrders.length}
                  hasMore={hasMore}
                  remainingCount={remainingCount}
                  loadMore={loadMore}
                  showAll={showAll}
                  sentinelRef={sentinelRef}
                  colSpan={viewMode === 'completa' ? 16 : 13}
                  entityLabel="pedidos"
                />
              </>
            )}
          </tbody>
        </table>
      </div>

      {rowMenuTarget && rowMenuTarget.mode === 'context_menu' && (
        <GridContextMenu
          target={{ row: rowMenuTarget.order, rowIndex: rowMenuTarget.rowIndex, x: rowMenuTarget.x, y: rowMenuTarget.y, isRowHeader: false }}
          onClose={() => setRowMenuTarget(null)}
          onCopyCell={copyActiveCell}
          onCopyRow={copyRow}
          onPaste={pasteToActiveOrRange}
          onDeleteCell={deleteActiveCellOrRange}
          onInsertRowAbove={(row, idx) => handleInsertOrderContext(row, idx, 'above')}
          onInsertRowBelow={(row, idx) => handleInsertOrderContext(row, idx, 'below')}
          onDuplicateRow={(row) => handleDuplicateOrder(row)}
          onDeleteRow={(row) => handleDeleteOrder(row.id)}
          entityType="purchase_orders"
          recordId={rowMenuTarget.order?.id}
          recordLabel={rowMenuTarget.order?.material_name_raw || 'Pedido'}
        />
      )}
    </div>
  )
}
