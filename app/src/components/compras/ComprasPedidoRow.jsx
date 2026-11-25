import { memo } from 'react'
import { CheckSquare, Copy, Edit3, Lightbulb, Paperclip, Plus, Square, Trash2, TrendingDown, TrendingUp, Truck } from 'lucide-react'
import HighlightText from '../HighlightText'
import CanonicalOtBadge from '../canonical/CanonicalOtBadge'
import FormulaNumericInput, { FormulaCellCornerMark } from '../canonical/FormulaNumericInput'
import { describeFormula, getStoredCellFormula, formatFormulaNumericDisplay } from '../../lib/formulaEngine'
import { InlineSupplierPicker } from './ComprasAuxModals'
import { formatDateAr } from '../../lib/dateTimeCanonical'
import { formatArsCached } from '../../lib/gridPerformanceHelpers'
import { STATUS_BY_VALUE, getFastComprasMatchMap, buildMemoizedComprasCellProps } from '../../lib/comprasPerformanceHelpers'
import { FillHandle, MaterialDisplayCell, MaterialInlineEditor, PedidoStatusSelect, RowClickNumMenu } from './ComprasRowCells'

const ComprasPedidoRow = memo(function ComprasPedidoRow({
  po, rowIndex, viewMode, indexByKey, isSelected, sup, shp, wo, lineDocs, woDocs,
  suppliers, materials = [], workOrders, workItems = [], searchQuery, isSupervisorOrAdmin,
  activeColIndex = -1, selStartCol = -1, selEndCol = -1, fillColIndex = -1, fillHandleColIndex = -1,
  rowInlineEdit = null, isClickNumMenuOpen = false, gridActions,
  setInlineEdit, setRowMenuTarget, toggleSelectRow, activateComprasCell, saveInlineEdit, saveInlineMaterialAndObs,
  handleQuickStatusChange, handleCycleUrgency, handleInsertOrderContext, handleDuplicateOrder, handleDeleteOrder,
  onOpenNewMaterial, onOpenDocs, onOpenReconcile, onOpenFreight, onOpenSupplierHelper, onEditOrder
}) {
  const orderDocs = woDocs && woDocs.length > 0 ? [...lineDocs, ...woDocs] : lineDocs
  const matchMap = getFastComprasMatchMap(po, searchQuery, { sup, shp, orderDocs })
  const quoted = Number(po.supplier_quoted_price) || 0
  const system = Number(po.system_unit_price) || 0
  const deltaPct = quoted > 0 && system > 0 ? Math.round(((quoted - system) / system) * 100) : null
  const urgency = po.urgency || 'SIN_APURO'
  const statusDef = STATUS_BY_VALUE.get(po.status)
  const hasFreight = Boolean(po.freight_transport_name || po.freight_estimated_date)
  const editingField = rowInlineEdit?.field || null
  const clearInline = () => setInlineEdit({ orderId: null, field: null, value: '' })

  const cellProps = (colKey) => buildMemoizedComprasCellProps({
    rowIndex, colKey, indexByKey, activeColIndex, selStartCol, selEndCol, fillColIndex, fillHandleColIndex, gridActions,
  })
  const cpCharge = cellProps('charge_type')
  const cpDate = cellProps('order_date')
  const cpShip = cellProps('ship_id')
  const cpReq = cellProps('requested_by_name')
  const cpMat = cellProps('material_name_raw')
  const cpQty = cellProps('quantity')
  const cpQuoted = cellProps('supplier_quoted_price')
  const cpSys = cellProps('system_unit_price')
  const cpSup = cellProps('supplier_id')
  const cpStatus = cellProps('status')
  const cpUrg = cellProps('urgency')
  const cpDeliv = cellProps('delivery_date')

  return (
    <tr
      onContextMenu={(e) => gridActions.onContextMenuRow(po, rowIndex, e)}
      className={`group transition-colors ${isSelected ? 'bg-cyan-950/30 hover:bg-cyan-950/40' : po.is_reconciled ? 'bg-slate-900/40 hover:bg-slate-800/40 text-slate-300' : 'hover:bg-slate-800/50'}`}
    >
      <td className="py-1 px-1 text-center w-8 select-none relative">
        <div className="flex flex-col items-center justify-center gap-0.5">
          <button type="button" onClick={() => toggleSelectRow(po.id)} className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer">
            {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={(e) => gridActions.onToggleClickNumMenu(po, rowIndex, e)}
            className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded transition-all cursor-pointer hover:bg-cyan-950/90 hover:text-cyan-300 hover:ring-1 hover:ring-cyan-500/60 ${isSelected ? 'text-cyan-300' : 'text-slate-500 group-hover:text-cyan-400'}`}
            title={`Fila #${po._rowSeq || rowIndex + 1} • Clic para opciones`}
          >
            {po._rowSeq || rowIndex + 1}
          </button>
        </div>
        {isClickNumMenuOpen && (
          <RowClickNumMenu po={po} rowIndex={rowIndex} onClose={() => setRowMenuTarget(null)} onInsertContext={handleInsertOrderContext} onDuplicate={handleDuplicateOrder} />
        )}
      </td>

      <td {...cpCharge.domProps} onDoubleClick={() => activateComprasCell(po, 'charge_type')} className={`py-1.5 px-1.5 whitespace-nowrap cursor-pointer ${cpCharge.className}`} title="Doble clic para cambiar Destino">
        {editingField === 'charge_type' ? (
          <select autoFocus value={rowInlineEdit.value} onChange={(e) => saveInlineEdit(po.id, 'charge_type', e.target.value)} onBlur={() => clearInline()} onKeyDown={(e) => { if (e.key === 'Escape') clearInline() }} className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[10px] font-bold text-white focus:outline-none">
            <option value="DIRECT">DIRECTO</option><option value="VIA_PANOL">PAÑOL</option><option value="STANDBY">STANDBY</option>
          </select>
        ) : po.charge_type === 'DIRECT' ? (
          <span className="inline-block px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold text-[10px]">DIRECTO</span>
        ) : po.charge_type === 'VIA_PANOL' ? (
          <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-[10px]">PAÑOL</span>
        ) : (
          <span className="inline-block px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px]">{po.charge_type}</span>
        )}
        {cpCharge.renderHandle && <FillHandle gridActions={gridActions} withTitle />}
      </td>

      <td {...cpDate.domProps} onDoubleClick={() => activateComprasCell(po, 'order_date')} className={`py-1.5 px-1.5 whitespace-nowrap font-mono cursor-pointer ${cpDate.className}`} title="Doble clic para editar fecha">
        {editingField === 'order_date' ? (
          <input type="date" autoFocus value={rowInlineEdit.value} onChange={(e) => { const v = e.target.value; setInlineEdit({ ...rowInlineEdit, value: v }); if (v) saveInlineEdit(po.id, 'order_date', v) }} onKeyDown={(e) => { if (e.key === 'Enter' && rowInlineEdit.value) saveInlineEdit(po.id, 'order_date', rowInlineEdit.value); if (e.key === 'Escape') clearInline() }} onBlur={() => { if (rowInlineEdit.value) saveInlineEdit(po.id, 'order_date', rowInlineEdit.value); else clearInline() }} className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[11px] text-white focus:outline-none cursor-pointer" />
        ) : (<><div className="text-slate-200 text-[11px]">{formatDateAr(po.order_date)}</div><div className="text-[9px] text-slate-500">{po.fortnight_period}</div></>)}
        {cpDate.renderHandle && <FillHandle gridActions={gridActions} />}
      </td>

      <td {...cpShip.domProps} onDoubleClick={() => activateComprasCell(po, 'ship_id')} className={`py-1.5 px-1.5 cursor-pointer ${matchMap.ship ? 'bg-amber-400/20 ring-1 ring-inset ring-amber-400/50' : ''} ${cpShip.className}`} title="Doble clic para cambiar Buque u Orden de Trabajo">
        <div className="font-semibold text-slate-200 truncate max-w-[105px]" title={shp?.name || 'ASTILLERO'}><HighlightText text={shp?.name || 'ASTILLERO'} query={searchQuery} /></div>
        <CanonicalOtBadge
          wo={wo || null}
          ship={shp || null}
          workItems={workItems}
          workOrders={workOrders}
          searchQuery={searchQuery}
          variant="compact"
          className="text-[9px] text-slate-400 max-w-[115px]"
        />
        {cpShip.renderHandle && <FillHandle gridActions={gridActions} />}
      </td>

      <td {...cpReq.domProps} onDoubleClick={() => activateComprasCell(po, 'requested_by_name')} className={`py-1.5 px-1.5 whitespace-nowrap cursor-pointer ${matchMap.requested_by ? 'bg-amber-400/20 ring-1 ring-inset ring-amber-400/50' : ''} ${cpReq.className}`} title={`Solicita: ${po.requested_by_name || 'PAÑOL'} (Doble clic para editar)`}>
        <div className="hover:bg-slate-800/80 px-1 py-0.5 rounded border border-transparent hover:border-cyan-500/30 text-slate-200 font-semibold transition-all truncate max-w-[85px]"><HighlightText text={po.requested_by_name || 'PAÑOL'} query={searchQuery} /></div>
        {cpReq.renderHandle && <FillHandle gridActions={gridActions} />}
      </td>

      <td {...cpMat.domProps} onDoubleClick={() => activateComprasCell(po, 'material_name_raw')} className={`py-1.5 px-1.5 cursor-pointer ${matchMap.material ? 'bg-amber-400/20 ring-1 ring-inset ring-amber-400/50' : ''} ${cpMat.className}`} title="Doble clic para editar material y observaciones in-situ">
        {editingField === 'material_name_raw' ? (
          <MaterialInlineEditor po={po} materials={materials} inlineEdit={rowInlineEdit} setInlineEdit={setInlineEdit} onSave={saveInlineMaterialAndObs} />
        ) : (
          <MaterialDisplayCell po={po} searchQuery={searchQuery} isSupervisorOrAdmin={isSupervisorOrAdmin} onOpenNewMaterial={onOpenNewMaterial} />
        )}
        {cpMat.renderHandle && <FillHandle gridActions={gridActions} />}
      </td>

      {(() => {
        const qtyFormula = getStoredCellFormula(po, 'quantity')
        const qtyMeta = describeFormula(qtyFormula)
        return (
          <td
            {...cpQty.domProps}
            onDoubleClick={() => activateComprasCell(po, 'quantity')}
            className={`py-1.5 px-1.5 text-right whitespace-nowrap font-mono cursor-pointer ${cpQty.className}`}
            title={qtyMeta?.tooltipText || 'Doble clic para editar cantidad (acepta =42+45 o +1*0.5)'}
          >
            <FormulaCellCornerMark formula={qtyFormula} />
            {editingField === 'quantity' ? (
              <FormulaNumericInput
                variant="cell"
                autoFocus
                maxDecimals={4}
                emptyValue={1}
                unitSuffix={po.unit_measure || 'un.'}
                value={rowInlineEdit.value}
                onChange={(val) => setInlineEdit({ ...rowInlineEdit, value: val })}
                onCommit={(rawVal) => saveInlineEdit(po.id, 'quantity', rawVal)}
                onCancel={clearInline}
                className="w-20 bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-right text-[11px] text-white focus:outline-none font-mono"
              />
            ) : (
              <div className="hover:bg-slate-800/80 px-1 py-0.5 rounded border border-transparent hover:border-cyan-500/30 transition-all font-mono inline-block text-right">
                <span className="font-bold text-white">{formatFormulaNumericDisplay(po.quantity, { maxDecimals: 3 })}</span>{' '}
                <span className="text-[9px] text-slate-500">{po.unit_measure || 'un.'}</span>
              </div>
            )}
            {cpQty.renderHandle && <FillHandle gridActions={gridActions} />}
          </td>
        )
      })()}

      {viewMode === 'completa' && (
        <>
          {(() => {
            const priceFormula = getStoredCellFormula(po, 'supplier_quoted_price')
            const priceMeta = describeFormula(priceFormula)
            return (
              <td
                {...cpQuoted.domProps}
                onDoubleClick={() => activateComprasCell(po, 'supplier_quoted_price')}
                className={`py-1.5 px-1.5 text-right whitespace-nowrap font-mono cursor-pointer ${cpQuoted.className}`}
                title={priceMeta?.tooltipText || 'Doble clic para editar $/U cotizado (acepta =42+45 o +42+45)'}
              >
                <FormulaCellCornerMark formula={priceFormula} />
                {editingField === 'supplier_quoted_price' ? (
                  <FormulaNumericInput
                    variant="cell"
                    autoFocus
                    currencyPrefix="$"
                    maxDecimals={2}
                    emptyValue={0}
                    value={rowInlineEdit.value}
                    onChange={(val) => setInlineEdit({ ...rowInlineEdit, value: val })}
                    onCommit={(rawVal) => saveInlineEdit(po.id, 'supplier_quoted_price', rawVal)}
                    onCancel={clearInline}
                    className="w-24 bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-right text-[11px] text-white focus:outline-none font-mono"
                  />
                ) : (
                  <div className="hover:bg-slate-800/80 px-1 py-0.5 rounded border border-transparent hover:border-cyan-500/30 transition-all inline-block text-right">
                    {po.supplier_quoted_price ? <span className="text-slate-200 font-semibold">${formatArsCached(po.supplier_quoted_price)}</span> : <span className="text-slate-600">—</span>}
                  </div>
                )}
                {cpQuoted.renderHandle && <FillHandle gridActions={gridActions} />}
              </td>
            )
          })()}
          <td {...cpSys.domProps} className={`py-1.5 px-1.5 text-right whitespace-nowrap font-mono ${cpSys.className}`}>
            <div className="text-slate-400">{po.system_unit_price ? `$${formatArsCached(po.system_unit_price)}` : '—'}</div>
            {deltaPct !== null && (
              <div className={`text-[9px] font-bold flex items-center justify-end gap-0.5 ${deltaPct > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {deltaPct > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                <span>{deltaPct > 0 ? `+${deltaPct}%` : `${deltaPct}%`}</span>
              </div>
            )}
            {cpSys.renderHandle && <FillHandle gridActions={gridActions} />}
          </td>
        </>
      )}

      <td {...cpSup.domProps} onDoubleClick={() => activateComprasCell(po, 'supplier_id')} className={`py-1.5 px-1.5 relative cursor-pointer ${matchMap.supplier ? 'bg-amber-400/20 ring-1 ring-inset ring-amber-400/50' : ''} ${cpSup.className}`} title={sup?.name ? `Proveedor: ${sup.name} (Doble clic para cambiar)` : 'Doble clic para asignar proveedor'}>
        {editingField === 'supplier_id' ? (
          <InlineSupplierPicker suppliers={suppliers} currentSupplierId={po.supplier_id} onSelect={(id) => saveInlineEdit(po.id, 'supplier_id', id)} onCancel={clearInline} />
        ) : (
          <div className="hover:bg-slate-800/80 px-1 py-0.5 rounded border border-transparent hover:border-cyan-500/30 transition-all flex items-center justify-between gap-1 max-w-[125px]">
            <span className="font-semibold text-slate-200 truncate flex-1">{sup?.name ? <HighlightText text={sup.name} query={searchQuery} /> : <span className="text-slate-600 italic">Asignar...</span>}</span>
            {Boolean(po.courier_dispatched) && ['PEDIDO', 'PEDIDO INCOMPLETO'].includes(po.status) && (
              <span className="text-xs shrink-0 select-none px-1 py-0.2 rounded bg-cyan-950/90 border border-cyan-500/60 shadow-sm" title={`🛵 Mandado a retirar por ${po.courier_worker_name || 'Mandadero'}`}>🛵</span>
            )}
          </div>
        )}
        {cpSup.renderHandle && <FillHandle gridActions={gridActions} />}
      </td>

      <td {...cpStatus.domProps} className={`py-1.5 px-1.5 whitespace-nowrap ${cpStatus.className}`} title={statusDef?.tooltip ? `${po.status}: ${statusDef.tooltip}` : po.status}>
        <PedidoStatusSelect po={po} viewMode={viewMode} onQuickStatusChange={handleQuickStatusChange} />
        {cpStatus.renderHandle && <FillHandle gridActions={gridActions} />}
      </td>

      <td {...cpUrg.domProps} className={`py-1.5 px-1.5 whitespace-nowrap ${cpUrg.className}`}>
        <button type="button" onClick={() => handleCycleUrgency(po.id, urgency)} className="cursor-pointer transition-transform hover:scale-105" title="Clic para cambiar urgencia">
          {urgency === 'URGENTE' ? <span className="inline-block px-1 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-extrabold text-[9px] animate-pulse">URGENTE</span> : urgency === 'PROXIMA_SALIDA' ? <span className="inline-block px-1 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 font-bold text-[9px]">PRÓX. SAL.</span> : <span className="inline-block px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 text-[9px]">Normal</span>}
        </button>
        {cpUrg.renderHandle && <FillHandle gridActions={gridActions} />}
      </td>

      <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
        <button type="button" onClick={() => onOpenDocs(po)} className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${matchMap.documents ? 'bg-amber-400/30 border-2 border-amber-400 text-amber-200 ring-2 ring-amber-400/60 shadow-lg shadow-amber-400/20 animate-pulse' : lineDocs.length > 0 ? 'bg-cyan-950 border border-cyan-500/60 text-cyan-300 hover:bg-cyan-900 shadow-sm' : 'text-slate-500 hover:text-cyan-400 hover:bg-slate-800/80 border border-transparent'}`} title={lineDocs.length > 0 ? `${lineDocs.length} archivo(s). Clic para ver.` : 'Adjuntar documento'}>
          <Paperclip className="w-3 h-3" /><span>{lineDocs.length > 0 ? lineDocs.length : ''}</span>
        </button>
      </td>

      <td {...cpDeliv.domProps} onDoubleClick={() => activateComprasCell(po, 'delivery_date')} className={`py-1.5 px-1.5 text-center whitespace-nowrap font-mono cursor-pointer ${cpDeliv.className}`} title="Doble clic para cargar Fecha de Entrega">
        {editingField === 'delivery_date' ? (
          <input type="date" autoFocus value={rowInlineEdit.value} onChange={(e) => { const v = e.target.value; setInlineEdit({ ...rowInlineEdit, value: v }); if (v) saveInlineEdit(po.id, 'delivery_date', v) }} onKeyDown={(e) => { if (e.key === 'Enter') saveInlineEdit(po.id, 'delivery_date', rowInlineEdit.value || null); if (e.key === 'Escape') clearInline() }} onBlur={() => saveInlineEdit(po.id, 'delivery_date', rowInlineEdit.value || null)} className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[11px] text-white focus:outline-none cursor-pointer" />
        ) : po.delivery_date ? <span className="text-emerald-300 font-semibold text-[10px] bg-emerald-950/50 border border-emerald-800/50 px-1.5 py-0.5 rounded">{formatDateAr(po.delivery_date)}</span> : <span className="text-slate-600 hover:text-slate-400 text-[10px]">—</span>}
        {cpDeliv.renderHandle && <FillHandle gridActions={gridActions} />}
      </td>

      {viewMode === 'completa' && (
        <td className="py-1.5 px-1 text-center whitespace-nowrap">
          {po.is_reconciled ? (
            <button type="button" onClick={() => onOpenReconcile({ mode: 'detail', supplierId: po.supplier_id, orderId: po.id, orderDate: po.order_date, supplierName: sup?.name || 'Proveedor', existingInvoice: po.invoice_number || '', reconciledBy: po.reconciled_by || 'Supervisor', reconciledAt: po.reconciled_at })} className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-400 flex items-center justify-center mx-auto cursor-pointer hover:scale-125 transition-transform" title={`🟣 CONCILIADO — Factura: ${po.invoice_number || 'S/D'}`}>
              <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_6px_#c084fc]" />
            </button>
          ) : (
            <button type="button" onClick={() => onOpenReconcile({ mode: 'single', supplierId: po.supplier_id, orderId: po.id, orderDate: po.order_date, supplierName: sup?.name || 'Proveedor' })} className="w-3.5 h-3.5 rounded-full border border-slate-700 hover:border-purple-400 hover:bg-purple-950/60 mx-auto block cursor-pointer transition-colors" title="Sin conciliar. Clic para conciliar." />
          )}
        </td>
      )}

      <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
        <div className="flex items-center justify-center gap-0.5">
          <button type="button" onClick={() => onOpenFreight(po)} className={`p-1 rounded transition-colors cursor-pointer ${matchMap.freight ? 'text-amber-100 bg-amber-500/40 border-2 border-amber-400 ring-2 ring-amber-400/60 shadow-md shadow-amber-500/20 font-bold' : hasFreight ? 'text-amber-300 bg-amber-950/70 border border-amber-500/50 hover:bg-amber-900' : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'}`} title="Asignar datos de flete"><Truck className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => handleInsertOrderContext(po, rowIndex, 'below')} className="p-1 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-800 transition-colors cursor-pointer" title="➕ Insertar fila contigua debajo"><Plus className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => onOpenSupplierHelper(po)} className="p-1 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-800 transition-colors cursor-pointer" title="💡 Asistente Inteligente de Proveedores"><Lightbulb className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => handleDuplicateOrder(po)} className="p-1 text-slate-400 hover:text-cyan-300 rounded hover:bg-slate-800 transition-colors cursor-pointer" title="⚡ Duplicar este pedido"><Copy className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => onEditOrder(po)} className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer" title="Editar pedido completo"><Edit3 className="w-3.5 h-3.5" /></button>
          <button type="button" onClick={() => handleDeleteOrder(po.id)} className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors cursor-pointer" title="Eliminar pedido"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </td>
    </tr>
  )
})

export default ComprasPedidoRow
