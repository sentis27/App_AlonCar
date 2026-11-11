import { useState, useRef, useEffect } from 'react'
import {
  CheckSquare,
  Square,
  RefreshCw,
  Anchor,
  Edit3,
  ShoppingCart,
  Copy,
  Trash2
} from 'lucide-react'
import { useSpreadsheetGrid } from '../../hooks/useSpreadsheetGrid'
import { useGridContextMenu } from '../../hooks/useGridContextMenu'
import { buildPasteRowHandler } from '../../lib/gridRowActions'
import GridRibbon from '../GridRibbon'
import GridContextMenu from '../GridContextMenu'
import GridStatusBarBottom from '../GridStatusBarBottom'
import HighlightText from '../HighlightText'
import ShipWorkOrderPickerModal from '../ShipWorkOrderPickerModal'
import ContractorPickerModal from '../ContractorPickerModal'
import { SPREADSHEET_COLUMNS_PANOL, PANOL_PASTE_FIELDS } from '../../lib/panolConstants'
import { evaluateAllocationState } from '../../lib/allocationEngine'
import {
  saveShipAndWorkOrderService,
  saveInlineTxService,
  insertBlankRowService,
  duplicateTxService,
  requestDeletionTxService,
  permanentDeleteTxService,
  restoreTxService
} from '../../lib/panolService'

export default function PanolMovimientosPanel({
  filteredTransactions,
  totalTransactionsCount,
  loading,
  materials,
  setMaterials,
  ships,
  workOrders,
  workItems,
  astilleroWorkers,
  contractorGroups,
  availableGroups,
  pendingAlerts,
  isAdmin,
  searchQuery,
  hasActivePanolFilter,
  panolTotals,
  user,
  profile,
  getEnabledWorkersAndContractors,
  getEnabledWosForShipAndContractor,
  formatWorkOrderTooltip,
  onClearAllFilters,
  onOpenWithdrawalModal,
  onOpenQuickPurchaseModal,
  onOpenRequestOtModal,
  onOpenWorkerPermissionModal,
  onPreviewImage,
  showFeedback,
  setInventoryTx
}) {
  const [selectedTxIds, setSelectedTxIds] = useState(new Set())
  const [inlineEdit, setInlineEdit] = useState({ id: null, field: null, value: '' })

  const [pickerModal, setPickerModal] = useState({
    isOpen: false,
    txId: null,
    shipId: '',
    workOrderId: '',
    workerName: '',
    contractorName: ''
  })

  const [contractorPickerModal, setContractorPickerModal] = useState({
    isOpen: false,
    txId: null,
    currentValue: '',
    shipId: '',
    shipName: '',
    workOrderId: '',
    workOrderTitle: '',
    isOtBlank: true
  })

  const onPasteRowRef = useRef(null)
  const { menuTarget, openMenu, closeMenu } = useGridContextMenu()

  const toggleSelectTx = (id) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllTxs = () => {
    if (selectedTxIds.size === filteredTransactions.length) {
      setSelectedTxIds(new Set())
    } else {
      setSelectedTxIds(new Set(filteredTransactions.map((t) => t.id)))
    }
  }

  const handleSaveShipAndWorkOrder = async (txId, newShipId, newWorkOrderId) => {
    try {
      const tx = filteredTransactions.find((t) => t.id === txId)
      const res = await saveShipAndWorkOrderService({
        txId,
        newShipId,
        newWorkOrderId,
        tx,
        ships,
        user,
        getEnabledWorkersAndContractors
      })
      if (grid?.pushUndoAction && tx) {
        grid.pushUndoAction([
          { rowId: txId, colKey: 'ship_id', oldValue: tx.ship_id, newValue: res.updates.ship_id, actionLabel: 'Cambio Barco' },
          { rowId: txId, colKey: 'work_order_id', oldValue: tx.work_order_id, newValue: res.updates.work_order_id, actionLabel: 'Cambio OT' }
        ])
      }
      setInventoryTx((prev) => prev.map((t) => (t.id === txId ? { ...t, ...res.updates } : t)))
      showFeedback('success', res.deassigned ? 'Imputación actualizada (operario desasignado).' : 'Barco y OT actualizados correctamente.')
    } catch (err) {
      showFeedback('error', 'Error al guardar imputación: ' + err.message)
    }
  }

  const handleSaveInlineTx = async (txId, field, value) => {
    try {
      if (field === 'cost_center' && !isAdmin) {
        return showFeedback('error', 'Solo el Administrador puede cambiar el Centro de Costo.')
      }
      const tx = filteredTransactions.find((t) => t.id === txId)
      if (grid?.pushUndoAction && tx && tx[field] !== value) {
        grid.pushUndoAction({
          colKey: field,
          colLabel: field,
          actionLabel: 'Edición en celda',
          previousValues: { [txId]: tx[field] },
          newValue: value,
          timestamp: Date.now()
        })
      }
      const updates = await saveInlineTxService({ txId, field, value, tx, materials, user })
      setInventoryTx((prev) => prev.map((t) => (t.id === txId ? { ...t, ...updates } : t)))
      showFeedback('success', 'Dato actualizado correctamente en la planilla.')
    } catch (err) {
      showFeedback('error', 'Error al actualizar celda: ' + err.message)
    }
  }

  const handleInsertBlankRow = async () => {
    try {
      const rowWithFolio = await insertBlankRowService({ inventoryTx: filteredTransactions })
      const activeIdx = grid?.activeCell?.rowIndex ?? 0
      const targetRow = filteredTransactions[activeIdx]
      setInventoryTx((prev) => {
        if (!targetRow) return [rowWithFolio, ...prev]
        const realIdx = prev.findIndex((t) => t.id === targetRow.id)
        if (realIdx === -1) return [rowWithFolio, ...prev]
        const copy = [...prev]
        copy.splice(realIdx, 0, rowWithFolio)
        return copy
      })
      showFeedback('success', `Fila insertada con Folio #${rowWithFolio._rowSeq}.`)
    } catch (e) {
      showFeedback('error', 'Error insertando fila: ' + e.message)
    }
  }

  const handleDuplicateTx = async (tx) => {
    try {
      const data = await duplicateTxService({ tx, user })
      setInventoryTx((prev) => [data, ...prev])
      showFeedback('success', 'Retiro duplicado con fecha de hoy.')
    } catch (e) {
      showFeedback('error', 'Error duplicando: ' + e.message)
    }
  }

  const handleRequestDeletionTx = async (tx) => {
    try {
      const userIdentifier = profile?.full_name || user?.email || 'Operario Pañol'
      await requestDeletionTxService({ tx, userIdentifier })
      setInventoryTx((prev) => prev.map((t) => (t.id === tx.id ? { ...t, is_deletion_requested: true } : t)))
      showFeedback('error', 'Fila marcada en rojo. Solicitud enviada a Jorge Sentis.')
    } catch (e) {
      showFeedback('error', 'Error: ' + e.message)
    }
  }

  const handlePermanentDeleteTx = async (tx) => {
    try {
      await permanentDeleteTxService({ tx, materials, user })
      setInventoryTx((prev) => prev.filter((t) => t.id !== tx.id))
      showFeedback('success', 'Fila eliminada permanentemente y stock reintegrado.')
    } catch (e) {
      showFeedback('error', 'Error: ' + e.message)
    }
  }

  const handleRestoreTx = async (tx) => {
    try {
      await restoreTxService({ tx })
      setInventoryTx((prev) => prev.map((t) => (t.id === tx.id ? { ...t, is_deletion_requested: false } : t)))
      showFeedback('success', 'Fila restaurada al estado normal.')
    } catch (e) {
      showFeedback('error', 'Error: ' + e.message)
    }
  }

  useEffect(() => {
    onPasteRowRef.current = buildPasteRowHandler({
      table: 'inventory_transactions',
      entityType: 'inventory',
      fields: PANOL_PASTE_FIELDS,
      grid,
      setList: setInventoryTx,
      nameOf: (r) => r.id,
      showFeedback,
      user: user?.email
    })
  })

  const grid = useSpreadsheetGrid({
    rows: filteredTransactions,
    columns: SPREADSHEET_COLUMNS_PANOL,
    getRowId: (r) => r.id,
    storageKey: 'aloncar_panol_grid',
    showFeedback: (type, text) => showFeedback(type, text),
    onPasteRow: (args) => onPasteRowRef.current?.(args),
    onCellActivate: (row, colDef) => {
      if (!row || !colDef || colDef.readOnly) return
      if (colDef.key === 'ship_id' || colDef.key === 'work_order_id') {
        setPickerModal({
          isOpen: true,
          txId: row.id,
          shipId: row.ship_id,
          workOrderId: row.work_order_id,
          workerName: row.worker_name,
          contractorName: row.contractor_name
        })
        return
      }
      const currentVal = row[colDef.key]
      setInlineEdit({
        id: row.id,
        field: colDef.key,
        value: currentVal !== null && currentVal !== undefined ? currentVal : ''
      })
    },
    canEditCell: (row, colKey) => {
      if (colKey === 'cost_center' && !isAdmin) {
        showFeedback('error', 'Solo el Administrador puede editar el Centro de Costo.')
        return false
      }
      return true
    },
    onBatchUpdate: async ({ colKey, newValue, targetIds, isRevert, revertMap }) => {
      try {
        if (isRevert && revertMap) {
          for (const [id, val] of Object.entries(revertMap)) {
            await handleSaveInlineTx(id, colKey, val)
          }
        } else if (targetIds && targetIds.length > 0) {
          for (const id of targetIds) {
            await handleSaveInlineTx(id, colKey, newValue)
          }
        }
      } catch (err) {
        showFeedback('error', 'Error al actualizar lote: ' + err.message)
      }
    }
  })

  function getSpreadsheetCellProps(rowIndex, colKey) {
    const colIdx = SPREADSHEET_COLUMNS_PANOL.findIndex((c) => c.key === colKey)
    if (colIdx === -1) return { className: '', renderHandle: false, domProps: {} }

    const isActive = grid.isCellActive(rowIndex, colIdx)
    const isSelected = grid.isCellSelected(rowIndex, colIdx)
    const isFillPreview = grid.isCellInFillPreview(rowIndex, colIdx)
    const renderHandle = grid.shouldRenderFillHandle(rowIndex, colIdx)

    return {
      renderHandle,
      domProps: {
        onClick: (e) => {
          grid.gridContainerRef.current?.focus()
          grid.handleCellClick(rowIndex, colIdx, e)
        },
        onMouseDown: (e) => {
          grid.gridContainerRef.current?.focus()
          grid.handleCellMouseDown(rowIndex, colIdx, e)
        },
        onMouseEnter: () => grid.handleCellMouseEnter(rowIndex, colIdx)
      },
      className: `relative select-none transition-colors ${
        isActive
          ? 'ring-2 ring-cyan-400 bg-cyan-950/40 z-20 outline-none'
          : isFillPreview
          ? 'bg-cyan-900/40 border-y border-dashed border-cyan-400'
          : isSelected
          ? 'bg-cyan-900/30'
          : ''
      }`
    }
  }

  return (
    <div className="alon-zone-grid font-sans">
      <GridRibbon
        activeCellBadge={grid.activeCellBadge}
        onInsertRow={handleInsertBlankRow}
        insertRowLabel="+ Fila en Blanco"
        undoCount={grid.undoStack?.length || 0}
        totalRows={filteredTransactions.length}
        entityName="filas"
        exportRows={filteredTransactions}
        exportFilename={`panol_retiros_${new Date().toISOString().split('T')[0]}`}
      />

      <datalist id="panol-materials-datalist">
        {materials.map((m) => (<option key={m.id} value={m.name} />))}
      </datalist>
      <datalist id="panol-contractors-datalist">
        {availableGroups.map((grp) => (<option key={grp} value={grp} />))}
      </datalist>

      <div
        tabIndex={0}
        onKeyDown={grid.handleKeyDown}
        ref={grid.gridContainerRef}
        className="alon-grid-scroll focus:outline-none"
      >
        <table className="w-full text-left text-[11px] border-collapse">
          <thead className="sticky top-0 z-20 alon-grid-thead">
            <tr>
              <th className="py-1 px-1 w-8 text-center select-none">
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <button
                    type="button"
                    onClick={toggleSelectAllTxs}
                    className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                    title={selectedTxIds.size === filteredTransactions.length ? 'Deseleccionar todo' : 'Seleccionar todo'}
                  >
                    {selectedTxIds.size === filteredTransactions.length && filteredTransactions.length > 0 ? (
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span className="font-mono text-[9px] text-slate-500 font-bold" title="Número de fila">#</span>
                </div>
              </th>
              <th className="py-2 px-1.5">Fecha ✎</th>
              <th className="py-2 px-1.5">Barco / Destino ✎</th>
              <th className="py-2 px-1.5">Orden de Trabajo (OT) ✎</th>
              <th className="py-2 px-1.5">Material Insumo ✎</th>
              <th className="py-2 px-1.5 text-right">Cant. ✎</th>
              <th className="py-2 px-1.5 text-right">Peso (kg) ✎</th>
              <th className="py-2 px-1.5">Contratista / Grupo ✎</th>
              <th className="py-2 px-1.5">Centro de Costo ✎</th>
              <th className="py-2 px-1.5">Observaciones ✎</th>
              <th className="py-2 px-1.5 text-center">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 font-sans">
            {loading ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-500 text-xs">
                  <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin mx-auto mb-2" />
                  <span>Cargando planilla de retiros de Pañol...</span>
                </td>
              </tr>
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-500 text-xs">
                  No se encontraron retiros con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredTransactions.map((tx, rowIndex) => {
                const isSelected = selectedTxIds.has(tx.id)
                const mat = materials.find((m) => m.id === tx.material_id)
                const ship = ships.find((s) => s.id === tx.ship_id)
                const wo = workOrders.find((w) => w.id === tx.work_order_id)
                const isDeletionReq = Boolean(tx.is_deletion_requested)

                return (
                  <tr
                    key={tx.id}
                    onContextMenu={(e) => openMenu(e, tx, rowIndex, { entityType: 'inventory', recordId: tx.id, recordLabel: mat?.name || '' }, grid)}
                    className={`group transition-colors ${
                      isDeletionReq
                        ? 'bg-rose-950/60 text-rose-300 font-bold border-y-2 border-rose-500/60'
                        : isSelected
                        ? 'bg-cyan-950/30 hover:bg-cyan-950/40'
                        : 'hover:bg-slate-800/50'
                    }`}
                  >
                    {/* 1. Checkbox + # */}
                    <td className="py-1 px-1 text-center w-8 select-none relative">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggleSelectTx(tx.id)}
                          className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                        >
                          {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
                        </button>
                        <span
                          className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded ${
                            isDeletionReq
                              ? 'text-rose-400 line-through'
                              : isSelected
                              ? 'text-cyan-300'
                              : 'text-slate-500 group-hover:text-cyan-400'
                          }`}
                          title={`Fila #${tx._rowSeq || rowIndex + 1}`}
                        >
                          {tx._rowSeq || rowIndex + 1}
                        </span>
                      </div>
                    </td>

                    {/* 2. Fecha */}
                    {(() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'transaction_date')
                      const dateVal = tx.transaction_date ? String(tx.transaction_date).split('T')[0] : ''
                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'transaction_date', value: dateVal })}
                          className={`py-1.5 px-1.5 whitespace-nowrap font-mono cursor-pointer ${cp.className} ${isDeletionReq ? 'line-through' : ''}`}
                          title="Doble clic para editar fecha con calendario"
                        >
                          {inlineEdit.id === tx.id && inlineEdit.field === 'transaction_date' ? (
                            <input
                              type="date"
                              autoFocus
                              ref={(el) => {
                                if (el && !el.dataset.pickerOpened) {
                                  el.dataset.pickerOpened = '1'
                                  try { if (typeof el.showPicker === 'function') el.showPicker() } catch {}
                                }
                              }}
                              value={inlineEdit.value}
                              onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                              onBlur={() => {
                                handleSaveInlineTx(tx.id, 'transaction_date', inlineEdit.value)
                                setInlineEdit({ id: null, field: null, value: '' })
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveInlineTx(tx.id, 'transaction_date', inlineEdit.value)
                                  setInlineEdit({ id: null, field: null, value: '' })
                                }
                                if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                              }}
                              className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-[11px] font-mono text-white focus:outline-none"
                            />
                          ) : (
                            <span><HighlightText text={dateVal || '—'} query={searchQuery} /></span>
                          )}
                          {cp.renderHandle && (
                            <div
                              onMouseDown={grid.handleFillHandleMouseDown}
                              onDoubleClick={grid.handleFillHandleDoubleClick}
                              className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                            />
                          )}
                        </td>
                      )
                    })()}

                    {/* 3. Barco / Destino */}
                    {(() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'ship_id')
                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => {
                            setPickerModal({
                              isOpen: true,
                              txId: tx.id,
                              shipId: tx.ship_id,
                              workOrderId: tx.work_order_id,
                              workerName: tx.worker_name,
                              contractorName: tx.contractor_name
                            })
                          }}
                          className={`py-1.5 px-1.5 whitespace-nowrap cursor-pointer font-semibold ${cp.className} ${isDeletionReq ? 'line-through text-rose-300' : 'text-slate-200'}`}
                          title="Doble clic para cambiar Buque u Orden de Trabajo"
                        >
                          <div className="flex items-center gap-1.5 font-bold text-white truncate" title={ship?.name || 'Sin buque asignado'}>
                            {ship ? (
                              <>
                                <Anchor className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                <HighlightText text={ship.name} query={searchQuery} />
                              </>
                            ) : (
                              <span className="text-slate-500 font-normal italic text-[11px]">— Sin Buque (Doble clic)</span>
                            )}
                          </div>
                          {cp.renderHandle && (
                            <div
                              onMouseDown={grid.handleFillHandleMouseDown}
                              onDoubleClick={grid.handleFillHandleDoubleClick}
                              className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                            />
                          )}
                        </td>
                      )
                    })()}

                    {/* 4. Orden de Trabajo (OT) */}
                    {(() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'work_order_id')
                      const contractorVal = tx.contractor_name || tx.worker_name
                      const enabledShipWos = getEnabledWosForShipAndContractor(tx.ship_id, contractorVal)
                      const otTooltip = formatWorkOrderTooltip(wo, ship)
                      const allocState = evaluateAllocationState({
                        shipId: tx.ship_id,
                        workOrderId: tx.work_order_id,
                        contractorName: contractorVal,
                        isSinOt: !tx.work_order_id,
                        availableWos: enabledShipWos,
                        pendingAlerts
                      })

                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => {
                            setPickerModal({
                              isOpen: true,
                              txId: tx.id,
                              shipId: tx.ship_id,
                              workOrderId: tx.work_order_id,
                              workerName: tx.worker_name,
                              contractorName: tx.contractor_name
                            })
                          }}
                          className={`py-1.5 px-1.5 max-w-[220px] truncate cursor-pointer ${cp.className} ${isDeletionReq ? 'line-through text-rose-300' : ''}`}
                          title={otTooltip}
                        >
                          {wo ? (
                            <div className="truncate">
                              <span className="font-mono text-cyan-300 font-bold bg-cyan-950/60 px-1 py-0.5 rounded border border-cyan-800/50 mr-1.5">
                                OT #<HighlightText text={wo.order_number || wo.ot_number || wo.id?.slice(0, 4)} query={searchQuery} />
                              </span>
                              <span className="text-slate-200 text-xs truncate">
                                <HighlightText text={wo.title || wo.description} query={searchQuery} />
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-amber-400 font-bold font-mono text-[10px]">
                                ⚠️ Sin OT
                              </span>
                              {allocState.needsOtRequest && (
                                allocState.isOtRequestPending ? (
                                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed shrink-0">
                                    Solicitud enviada (1)
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onOpenRequestOtModal({
                                        txId: tx.id,
                                        shipId: tx.ship_id || '',
                                        targetWorkerOrContractor: contractorVal || ''
                                      })
                                    }}
                                    className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-rose-600 hover:bg-rose-500 text-white shadow animate-pulse shrink-0 cursor-pointer"
                                    title="No hay OT habilitada. Clic para pedir apertura a Jorge Sentis."
                                  >
                                    ➕ Pedir Apertura OT
                                  </button>
                                )
                              )}
                            </div>
                          )}
                          {cp.renderHandle && (
                            <div
                              onMouseDown={grid.handleFillHandleMouseDown}
                              onDoubleClick={grid.handleFillHandleDoubleClick}
                              className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                            />
                          )}
                        </td>
                      )
                    })()}

                    {/* 5. Material Insumo */}
                    {(() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'material_id')
                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'material_id', value: mat?.name || '' })}
                          className={`py-1.5 px-1.5 max-w-[220px] truncate cursor-pointer font-bold ${cp.className} ${isDeletionReq ? 'line-through text-rose-300' : 'text-white'}`}
                          title="Doble clic para cambiar material"
                        >
                          {inlineEdit.id === tx.id && inlineEdit.field === 'material_id' ? (
                            <input
                              type="text"
                              autoFocus
                              list="panol-materials-datalist"
                              value={inlineEdit.value}
                              onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                              onBlur={() => {
                                const match = materials.find((m) => m.name.toLowerCase() === inlineEdit.value.toLowerCase().trim())
                                if (match) handleSaveInlineTx(tx.id, 'material_id', match.id)
                                setInlineEdit({ id: null, field: null, value: '' })
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  const match = materials.find((m) => m.name.toLowerCase() === inlineEdit.value.toLowerCase().trim())
                                  if (match) handleSaveInlineTx(tx.id, 'material_id', match.id)
                                  setInlineEdit({ id: null, field: null, value: '' })
                                }
                                if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                              }}
                              className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none w-full"
                            />
                          ) : (
                            <div className="flex items-center gap-1.5">
                              {mat?.image_url && (
                                <img
                                  src={mat.image_url}
                                  alt=""
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onPreviewImage(mat.image_url)
                                  }}
                                  className="w-4 h-4 rounded object-cover shrink-0 cursor-zoom-in border border-slate-700"
                                />
                              )}
                              <HighlightText text={mat?.name || 'Insumo sin asignar'} query={searchQuery} />
                            </div>
                          )}
                          {cp.renderHandle && (
                            <div
                              onMouseDown={grid.handleFillHandleMouseDown}
                              onDoubleClick={grid.handleFillHandleDoubleClick}
                              className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                            />
                          )}
                        </td>
                      )
                    })()}

                    {/* 6. Cantidad */}
                    {(() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'quantity_withdrawn')
                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'quantity_withdrawn', value: String(tx.quantity_withdrawn || 1) })}
                          className={`py-1.5 px-1.5 text-right font-mono font-bold cursor-pointer whitespace-nowrap ${cp.className} ${isDeletionReq ? 'line-through' : 'text-emerald-400'}`}
                          title="Doble clic para editar cantidad retirada"
                        >
                          {inlineEdit.id === tx.id && inlineEdit.field === 'quantity_withdrawn' ? (
                            <input
                              type="number"
                              autoFocus
                              step="any"
                              min="0"
                              value={inlineEdit.value}
                              onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                              onBlur={() => {
                                handleSaveInlineTx(tx.id, 'quantity_withdrawn', inlineEdit.value)
                                setInlineEdit({ id: null, field: null, value: '' })
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveInlineTx(tx.id, 'quantity_withdrawn', inlineEdit.value)
                                  setInlineEdit({ id: null, field: null, value: '' })
                                }
                                if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                              }}
                              className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[11px] font-mono text-white focus:outline-none w-16 text-right"
                            />
                          ) : (
                            <span>{tx.quantity_withdrawn} {mat?.unit_measure || 'un.'}</span>
                          )}
                          {cp.renderHandle && (
                            <div
                              onMouseDown={grid.handleFillHandleMouseDown}
                              onDoubleClick={grid.handleFillHandleDoubleClick}
                              className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                            />
                          )}
                        </td>
                      )
                    })()}

                    {/* 7. Peso (kg) */}
                    {(() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'weight_total')
                      const w = Number(tx.weight_total) || 0
                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'weight_total', value: String(w) })}
                          className={`py-1.5 px-1.5 text-right font-mono text-slate-300 cursor-pointer whitespace-nowrap ${cp.className} ${isDeletionReq ? 'line-through' : ''}`}
                          title="Doble clic para editar peso en kg"
                        >
                          {inlineEdit.id === tx.id && inlineEdit.field === 'weight_total' ? (
                            <input
                              type="number"
                              autoFocus
                              step="any"
                              min="0"
                              value={inlineEdit.value}
                              onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                              onBlur={() => {
                                handleSaveInlineTx(tx.id, 'weight_total', inlineEdit.value)
                                setInlineEdit({ id: null, field: null, value: '' })
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveInlineTx(tx.id, 'weight_total', inlineEdit.value)
                                  setInlineEdit({ id: null, field: null, value: '' })
                                }
                                if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                              }}
                              className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[11px] font-mono text-white focus:outline-none w-16 text-right"
                            />
                          ) : (
                            <span>{w > 0 ? `${w.toFixed(2)} kg` : '—'}</span>
                          )}
                          {cp.renderHandle && (
                            <div
                              onMouseDown={grid.handleFillHandleMouseDown}
                              onDoubleClick={grid.handleFillHandleDoubleClick}
                              className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                            />
                          )}
                        </td>
                      )
                    })()}

                    {/* 8. Operario / Contratista */}
                    {(() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'contractor_name')
                      const currentVal = tx.worker_name || tx.contractor_name || ''

                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => {
                            const effShip = ships.find((s) => s.id === tx.ship_id)
                            const effWo = workOrders.find((w) => w.id === tx.work_order_id)
                            setContractorPickerModal({
                              isOpen: true,
                              txId: tx.id,
                              currentValue: currentVal,
                              shipId: tx.ship_id || '',
                              shipName: effShip?.name || 'Astillero',
                              workOrderId: tx.work_order_id || '',
                              workOrderTitle: effWo ? (effWo.ot_number ? `#${effWo.ot_number} ${effWo.title}` : effWo.title) : '',
                              isOtBlank: !tx.work_order_id
                            })
                          }}
                          className={`py-1.5 px-1.5 whitespace-nowrap cursor-pointer font-bold text-cyan-300 ${cp.className} ${isDeletionReq ? 'line-through text-rose-300' : ''}`}
                          title="Doble clic para cambiar Operario o Contratista"
                        >
                          <HighlightText text={currentVal || 'Sin asignar'} query={searchQuery} />
                          {cp.renderHandle && (
                            <div
                              onMouseDown={grid.handleFillHandleMouseDown}
                              onDoubleClick={grid.handleFillHandleDoubleClick}
                              className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                            />
                          )}
                        </td>
                      )
                    })()}

                    {/* 9. Centro de Costo */}
                    {(() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'cost_center')
                      const isCliente = tx.cost_center === 'CLIENTE'
                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => {
                            if (isAdmin) {
                              handleSaveInlineTx(tx.id, 'cost_center', isCliente ? 'CONTRATISTA' : 'CLIENTE')
                            } else {
                              showFeedback('error', 'Solo el Administrador puede modificar el Centro de Costo.')
                            }
                          }}
                          className={`py-1.5 px-1.5 whitespace-nowrap cursor-pointer text-center ${cp.className} ${isDeletionReq ? 'line-through' : ''}`}
                          title={isAdmin ? 'Doble clic para alternar CLIENTE / CONTRATISTA' : 'Centro de Costo deducido'}
                        >
                          {tx.cost_center ? (
                            <span
                              className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                isCliente
                                  ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                                  : 'bg-amber-950 text-amber-300 border-amber-800'
                              }`}
                            >
                              {tx.cost_center}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic text-[10px]">—</span>
                          )}
                          {cp.renderHandle && (
                            <div
                              onMouseDown={grid.handleFillHandleMouseDown}
                              onDoubleClick={grid.handleFillHandleDoubleClick}
                              className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                            />
                          )}
                        </td>
                      )
                    })()}

                    {/* 10. Observaciones */}
                    {(() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'notes')
                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'notes', value: tx.notes || '' })}
                          className={`py-1.5 px-1.5 max-w-[160px] truncate cursor-pointer text-slate-400 ${cp.className} ${isDeletionReq ? 'line-through text-rose-300' : ''}`}
                          title="Doble clic para editar observaciones"
                        >
                          {inlineEdit.id === tx.id && inlineEdit.field === 'notes' ? (
                            <input
                              type="text"
                              autoFocus
                              value={inlineEdit.value}
                              onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                              onBlur={() => {
                                handleSaveInlineTx(tx.id, 'notes', inlineEdit.value)
                                setInlineEdit({ id: null, field: null, value: '' })
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  handleSaveInlineTx(tx.id, 'notes', inlineEdit.value)
                                  setInlineEdit({ id: null, field: null, value: '' })
                                }
                                if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                              }}
                              className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none w-full"
                            />
                          ) : (
                            <HighlightText text={tx.notes || '—'} query={searchQuery} />
                          )}
                          {cp.renderHandle && (
                            <div
                              onMouseDown={grid.handleFillHandleMouseDown}
                              onDoubleClick={grid.handleFillHandleDoubleClick}
                              className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                            />
                          )}
                        </td>
                      )
                    })()}

                    {/* 11. Acciones */}
                    <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onOpenWithdrawalModal(tx)}
                          className="p-1 rounded hover:bg-emerald-950/80 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                          title="Editar fila en ventana de salida multi-material"
                        >
                          <Edit3 className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            onOpenQuickPurchaseModal({
                              material: mat || { id: tx.material_id, name: 'Insumo', unit_measure: 'Unidad' },
                              quantity: String(tx.quantity_withdrawn || 1)
                            })
                          }}
                          className="p-1 rounded hover:bg-cyan-950/80 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                          title="Generar Pedido de Compra directo a Compras (Estado: PEDIR)"
                        >
                          <ShoppingCart className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDuplicateTx(tx)}
                          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                          title="Duplicar retiro con fecha de hoy"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        {isDeletionReq ? (
                          isAdmin ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handlePermanentDeleteTx(tx)}
                                className="p-1 rounded bg-rose-600 hover:bg-rose-500 text-slate-950 font-black text-[9px] cursor-pointer"
                                title="Confirmar eliminación física definitiva"
                              >
                                <Trash2 className="w-3 h-3 stroke-[3]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRestoreTx(tx)}
                                className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[9px] cursor-pointer"
                                title="Restaurar fila a estado activo"
                              >
                                <RefreshCw className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <span
                              className="text-[9px] font-bold text-rose-400 bg-rose-950/90 border border-rose-800 px-1 py-0.5 rounded cursor-help"
                              title={`Eliminación solicitada por ${tx.deletion_requested_by || 'Operario'}.`}
                            >
                              Baja solicitada
                            </span>
                          )
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRequestDeletionTx(tx)}
                            className="p-1 rounded hover:bg-rose-950/80 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Solicitar baja de fila a Jorge Sentis (pinta de rojo)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {menuTarget && menuTarget.entityType !== 'materials' && (
        <GridContextMenu
          target={menuTarget}
          onClose={closeMenu}
          onCopyCell={grid.copyActiveCell}
          onCopyRow={grid.copyRow}
          onPaste={grid.pasteToActiveOrRange}
          onDeleteCell={grid.deleteActiveCellOrRange}
          onDuplicateRow={(row) => handleDuplicateTx(row)}
          onDeleteRow={(row) =>
            row.is_deletion_requested
              ? (isAdmin ? handlePermanentDeleteTx(row) : showFeedback('error', 'Baja ya solicitada: espera la decisión del Administrador.'))
              : handleRequestDeletionTx(row)
          }
          entityType={menuTarget.entityType}
          recordId={menuTarget.recordId}
          recordLabel={menuTarget.recordLabel}
        />
      )}

      <GridStatusBarBottom
        filteredCount={filteredTransactions.length}
        totalCount={totalTransactionsCount}
        entityName="retiros"
        hasActiveFilter={hasActivePanolFilter}
        onClearFilters={onClearAllFilters}
        selectionStats={grid.selectionStats}
        globalAggregates={[
          { label: 'Σ CANT', value: panolTotals.totalQty.toLocaleString('es-AR') },
          { label: 'Σ PESO', value: `${panolTotals.totalKg.toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg` }
        ]}
      />

      <ShipWorkOrderPickerModal
        isOpen={pickerModal.isOpen}
        onClose={() => setPickerModal({ isOpen: false, txId: null, shipId: '', workOrderId: '', workerName: '', contractorName: '' })}
        ships={ships}
        workOrders={workOrders}
        workItems={workItems}
        currentShipId={pickerModal.shipId}
        currentWorkOrderId={pickerModal.workOrderId}
        allowAstilleroStock={true}
        contractorName={pickerModal.contractorName}
        workerName={pickerModal.workerName}
        onSave={async ({ shipId, workOrderId }) => {
          if (!pickerModal.txId) return
          await handleSaveShipAndWorkOrder(pickerModal.txId, shipId, workOrderId)
          setPickerModal({ isOpen: false, txId: null, shipId: '', workOrderId: '', workerName: '', contractorName: '' })
        }}
      />

      <ContractorPickerModal
        isOpen={contractorPickerModal.isOpen}
        onClose={() => setContractorPickerModal({ isOpen: false, txId: null, currentValue: '', shipId: '', shipName: '', workOrderId: '', workOrderTitle: '', isOtBlank: true })}
        currentValue={contractorPickerModal.currentValue}
        shipName={contractorPickerModal.shipName}
        workOrderTitle={contractorPickerModal.workOrderTitle}
        isOtBlank={contractorPickerModal.isOtBlank}
        astilleroWorkers={getEnabledWorkersAndContractors(contractorPickerModal.shipId, contractorPickerModal.workOrderId).astilleroWorkers}
        contractorGroups={getEnabledWorkersAndContractors(contractorPickerModal.shipId, contractorPickerModal.workOrderId).contractorGroups}
        onRequestOt={() => {
          onOpenRequestOtModal({
            txId: contractorPickerModal.txId,
            shipId: contractorPickerModal.shipId || '',
            targetWorkerOrContractor: contractorPickerModal.currentValue || ''
          })
        }}
        onRequestWorkerPermission={() => onOpenWorkerPermissionModal()}
        onSelect={(selectedName) => {
          if (contractorPickerModal.txId) {
            handleSaveInlineTx(contractorPickerModal.txId, 'contractor_name', selectedName)
          }
        }}
      />
    </div>
  )
}
