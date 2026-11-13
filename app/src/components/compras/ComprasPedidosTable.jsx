import { CheckSquare, Square } from 'lucide-react'
import GridRibbon from '../GridRibbon'
import GridContextMenu from '../GridContextMenu'
import ComprasPedidoRow from './ComprasPedidoRow'

export default function ComprasPedidosTable({
  filteredOrders,
  materials,
  suppliers,
  ships,
  workOrders,
  documents,
  searchQuery,
  viewMode,
  isSupervisorOrAdmin,
  grid,
  getSpreadsheetCellProps,
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
  return (
    <div className="alon-zone-grid">
      <GridRibbon
        activeCellBadge={grid.activeCellBadge}
        onInsertRow={() => {
          const targetIdx = grid.activeCell?.rowIndex >= 0 ? grid.activeCell.rowIndex : 0
          const targetPo = filteredOrders[targetIdx]
          if (targetPo) handleInsertOrderContext(targetPo, targetIdx, 'below')
          else handleAddNewBlankOrder()
        }}
        insertRowLabel="Nueva Fila en Blanco"
        undoCount={grid.undoStack?.length || 0}
        totalRows={filteredOrders.length}
        entityName="pedidos"
        exportRows={filteredOrders}
        exportFilename={`compras_pedidos_${new Date().toISOString().split('T')[0]}`}
      />

      <datalist id="compras-materials-datalist">
        {materials.slice(0, 300).map((m) => (
          <option key={m.id} value={m.name} />
        ))}
      </datalist>

      <div tabIndex={0} onKeyDown={grid.handleKeyDown} ref={grid.gridContainerRef} className="alon-grid-scroll">
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
              <th className="py-2 px-1.5">Destino ✎</th>
              <th className="py-2 px-1.5">Fecha / Q. ✎</th>
              <th className="py-2 px-1.5">Buque / OT ✎</th>
              <th className="py-2 px-1.5">Solicita ✎</th>
              <th className="py-2 px-1.5">Material Solicitado ✎</th>
              <th className="py-2 px-1.5 text-right">Cant. ✎</th>
              {viewMode === 'completa' && (
                <>
                  <th className="py-2 px-1.5 text-right">$/U Prov. ✎</th>
                  <th className="py-2 px-1.5 text-right">$/U Sist.</th>
                </>
              )}
              <th className="py-2 px-1.5">Proveedor ✎</th>
              <th className="py-2 px-1.5">Estado ✎</th>
              <th className="py-2 px-1.5">Urg. ✎</th>
              <th className="py-2 px-1.5 text-center">Doc</th>
              <th className="py-2 px-1.5 text-center" title="Fecha de entrega del pedido">F. Entrega ✎</th>
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
              filteredOrders.map((po, rowIndex) => (
                <ComprasPedidoRow
                  key={po.id}
                  po={po}
                  rowIndex={rowIndex}
                  viewMode={viewMode}
                  isSelected={selectedOrderIds.has(po.id)}
                  suppliers={suppliers}
                  ships={ships}
                  workOrders={workOrders}
                  documents={documents}
                  searchQuery={searchQuery}
                  isSupervisorOrAdmin={isSupervisorOrAdmin}
                  grid={grid}
                  getSpreadsheetCellProps={getSpreadsheetCellProps}
                  inlineEdit={inlineEdit}
                  setInlineEdit={setInlineEdit}
                  rowMenuTarget={rowMenuTarget}
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
              ))
            )}
          </tbody>
        </table>
      </div>

      {rowMenuTarget && rowMenuTarget.mode === 'context_menu' && (
        <GridContextMenu
          target={{
            row: rowMenuTarget.order,
            rowIndex: rowMenuTarget.rowIndex,
            x: rowMenuTarget.x,
            y: rowMenuTarget.y,
            isRowHeader: false
          }}
          onClose={() => setRowMenuTarget(null)}
          onCopyCell={grid.copyActiveCell}
          onCopyRow={grid.copyRow}
          onPaste={grid.pasteToActiveOrRange}
          onDeleteCell={grid.deleteActiveCellOrRange}
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
