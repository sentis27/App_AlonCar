import { useState, useRef, useEffect, useMemo } from 'react'
import { CheckSquare, Square, RefreshCw, Anchor, Edit3, ShoppingCart, Copy, Trash2 } from 'lucide-react'
import { useSpreadsheetGrid } from '../../hooks/useSpreadsheetGrid'
import { useGridContextMenu } from '../../hooks/useGridContextMenu'
import { useProgressiveRows } from '../../hooks/useProgressiveRows'
import { buildPasteRowHandler } from '../../lib/gridRowActions'
import { buildLookupMap } from '../../lib/gridPerformanceHelpers'
import GridRibbon from '../GridRibbon'
import GridContextMenu from '../GridContextMenu'
import GridStatusBarBottom from '../GridStatusBarBottom'
import CanonicalProgressiveTableFooter from '../canonical/CanonicalProgressiveTableFooter'
import HighlightText from '../HighlightText'
import ShipWorkOrderPickerModal from '../ShipWorkOrderPickerModal'
import PanolContractorSelect from './PanolContractorSelect'
import CanonicalMaterialPicker from '../canonical/CanonicalMaterialPicker'
import CanonicalOtBadge from '../canonical/CanonicalOtBadge'
import FormulaNumericInput, { FormulaCellCornerMark } from '../canonical/FormulaNumericInput'
import PanolMovimientoCostCell from './PanolMovimientoCostCell'
import { describeFormula, getStoredCellFormula, getEditableCellInitialValue, formatFormulaNumericDisplay } from '../../lib/formulaEngine'
import { getPanolMovimientosColumns, getPanolPasteFields, resolvePanolTxCost, resolvePanolTxWeight } from '../../lib/panolCostHelpers'
import { formatUsd } from '../../lib/drydockCatalogConstants'
import { formatUnitMeasureShort } from '../../lib/unitMeasureUtils'
import { getLocalDateKey, formatLocalTimeHHMM } from '../../lib/panolBasketsEngine'
import { formatDateAr, formatDateTimeAr, getTodayArIso } from '../../lib/dateTimeCanonical'
import { evaluateAllocationState } from '../../lib/allocationEngine'
import { resolveTxStockCellState } from '../../lib/stockControlService'
import { buildPanolContractorSelectModel, saveInlineContractorService } from '../../lib/panolContractorService'
import {
  saveShipAndWorkOrderService, saveInlineTxService, insertBlankRowService,
  duplicateTxService, requestDeletionTxService, permanentDeleteTxService, restoreTxService
} from '../../lib/panolService'

export default function PanolMovimientosPanel({
  filteredTransactions, totalTransactionsCount, loading, filterResetKey = '',
  materials, setMaterials, ships, workOrders, workItems, astilleroWorkers, contractorGroups,
  workers = [], pendingAlerts, isAdmin, searchQuery, hasActivePanolFilter, panolTotals,
  user, profile, getEnabledWorkersAndContractors, getEnabledWosForShipAndContractor,
  formatWorkOrderTooltip, onClearAllFilters, onOpenWithdrawalModal, onOpenQuickPurchaseModal,
  onOpenRequestOtModal, onOpenWorkerPermissionModal, onPreviewImage, showFeedback, setInventoryTx,
  gasMovements = [], setGasMovements = null, macroVariables = [], pricingPolicy = null,
  onOpenEditMaterialModal = null, onHistoryChange = null, stockFreezeConfig = null, onOpenKardexModal = null
}) {
  const [selectedTxIds, setSelectedTxIds] = useState(new Set())
  const [inlineEdit, setInlineEdit] = useState({ id: null, field: null, value: '' })
  const [expandedContractorRowId, setExpandedContractorRowId] = useState(null)
  const [showCostCenter, setShowCostCenter] = useState(() => {
    try { return localStorage.getItem('aloncar_panol_show_cost_center') === '1' } catch { return false }
  })
  const toggleCostCenterColumn = () => {
    setShowCostCenter((prev) => {
      const next = !prev
      try { localStorage.setItem('aloncar_panol_show_cost_center', next ? '1' : '0') } catch {}
      return next
    })
  }
  const [pickerModal, setPickerModal] = useState({ isOpen: false, txId: null, shipId: '', workOrderId: '', workerName: '', contractorName: '' })

  const onPasteRowRef = useRef(null)
  const suppressBlurCommitRef = useRef(false)
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
        user, workItems,
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

  const handleSaveInlineTx = async (txId, field, value, { skipUndo = false } = {}) => {
    try {
      if (field === 'cost_center' && !isAdmin) {
        return showFeedback('error', 'Solo el Administrador puede cambiar el Centro de Costo.')
      }
      if (field === 'weight_total' && !isAdmin) {
        return showFeedback('error', 'El peso es solo de referencia para el Pañolero.')
      }
      const tx = filteredTransactions.find((t) => t.id === txId)
      const prevUndoVal =
        field === 'quantity_withdrawn' && tx
          ? getEditableCellInitialValue(tx, 'quantity_withdrawn', tx[field])
          : tx?.[field]
      if (!skipUndo && grid?.pushUndoAction && tx && String(prevUndoVal ?? '') !== String(value ?? '')) {
        grid.pushUndoAction({
          colKey: field,
          colLabel: field,
          actionLabel: 'Edición en celda',
          previousValues: { [txId]: prevUndoVal },
          newValue: value,
          timestamp: Date.now()
        })
      }
      const { _matUpdates, ...rowUpdates } = await saveInlineTxService({ txId, field, value, tx, materials, workers, user, isAdmin, macroVariables, pricingPolicy })
      setInventoryTx((prev) => prev.map((t) => (t.id === txId ? { ...t, ...rowUpdates } : t)))
      if (_matUpdates?.length > 0) {
        setMaterials((prev) => prev.map((m) => { const u = _matUpdates.find((x) => x.id === m.id); return u ? { ...m, current_stock: u.newStock } : m }))
      }
      showFeedback('success', 'Dato actualizado correctamente en la planilla.')
    } catch (err) {
      showFeedback('error', 'Error al actualizar celda: ' + err.message)
    }
  }

  const handleSaveInlineContractor = async (tx, newName, { skipUndo = false } = {}) => {
    try {
      const res = await saveInlineContractorService({
        tx, newName, ships, workOrders, workItems, astilleroWorkers, contractorGroups, workers, materials, user
      })
      if (!skipUndo && grid?.pushUndoAction) {
        const undoMutations = [
          { rowId: tx.id, colKey: 'contractor_name', oldValue: tx.worker_name || tx.contractor_name || '', newValue: res.resolvedName, actionLabel: 'Cambio Contratista' },
          { rowId: tx.id, colKey: 'worker_id', oldValue: tx.worker_id ?? null, newValue: res.updates.worker_id ?? null, actionLabel: 'Cambio Contratista' },
          ...(res.shouldClearOt ? [
            { rowId: tx.id, colKey: 'work_order_id', oldValue: tx.work_order_id ?? null, newValue: null, actionLabel: 'OT borrada por contratista no habilitado' },
            { rowId: tx.id, colKey: 'work_item_id', oldValue: tx.work_item_id ?? null, newValue: null, actionLabel: 'OT borrada por contratista no habilitado' }
          ] : [])
        ]
        grid.pushUndoAction(undoMutations)
      }
      setInventoryTx((prev) => prev.map((t) => (t.id === tx.id ? { ...t, ...res.updates } : t)))
      showFeedback(
        'success',
        res.shouldClearOt
          ? `Contratista actualizado a ${res.resolvedName}. No está habilitado en la OT anterior: se borró la OT (⚠️ Sin OT) como aviso.`
          : 'Operario / Contratista actualizado correctamente.'
      )
    } catch (err) {
      showFeedback('error', 'Error al actualizar contratista: ' + err.message)
    }
  }

  const commitInlineField = (txId, field, rawVal, focusGrid = false) => {
    if (suppressBlurCommitRef.current) return
    suppressBlurCommitRef.current = true
    handleSaveInlineTx(txId, field, rawVal)
    setInlineEdit({ id: null, field: null, value: '' })
    setTimeout(() => {
      suppressBlurCommitRef.current = false
      if (focusGrid) grid.gridContainerRef.current?.focus()
    }, 0)
  }

  const inlineFieldHandlers = (txId, field, val) => ({
    value: val,
    onChange: (e) => setInlineEdit({ id: txId, field, value: e.target.value }),
    onBlur: () => commitInlineField(txId, field, val, false),
    onKeyDown: (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') { e.preventDefault(); commitInlineField(txId, field, val, true) }
      if (e.key === 'Escape') {
        e.preventDefault()
        suppressBlurCommitRef.current = true
        setInlineEdit({ id: null, field: null, value: '' })
        setTimeout(() => { suppressBlurCommitRef.current = false; grid.gridContainerRef.current?.focus() }, 0)
      }
    }
  })

  const handleInsertBlankRow = async () => {
    try {
      const rowWithFolio = await insertBlankRowService({ inventoryTx: filteredTransactions, user })
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
      const { _matUpdates, ...data } = await duplicateTxService({ tx, user })
      setInventoryTx((prev) => [data, ...prev])
      if (_matUpdates?.length > 0) {
        setMaterials((prev) => prev.map((m) => { const u = _matUpdates.find((x) => x.id === m.id); return u ? { ...m, current_stock: u.newStock } : m }))
      }
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
      const res = await permanentDeleteTxService({ tx, gasMovements, user })
      setInventoryTx((prev) => prev.filter((t) => t.id !== tx.id))
      if (res?.updatedMaterial && setMaterials) {
        setMaterials((prev) => prev.map((m) => (m.id === res.updatedMaterial.id ? { ...m, current_stock: res.updatedMaterial.current_stock } : m)))
      }
      if (res?.deletedGasMovementId && setGasMovements) {
        setGasMovements((prev) => prev.filter((g) => g.id !== res.deletedGasMovementId))
      }
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

  const materialById = useMemo(() => buildLookupMap(materials), [materials])
  const shipById = useMemo(() => buildLookupMap(ships), [ships])
  const workOrderById = useMemo(() => buildLookupMap(workOrders), [workOrders])
  const movimientosColumns = useMemo(
    () =>
      getPanolMovimientosColumns(isAdmin, {
        getCostTotalUsd: (row) =>
          resolvePanolTxCost(row, row?.material_id ? (materialById.get(String(row.material_id)) || null) : null, {
            macroVariables,
            policy: pricingPolicy
          }).totalUsd,
        getWeightTotalKg: (row) =>
          resolvePanolTxWeight(row, row?.material_id ? (materialById.get(String(row.material_id)) || null) : null),
        showCostCenter
      }),
    [isAdmin, materialById, macroVariables, pricingPolicy, showCostCenter]
  )
  const totalColSpan = isAdmin ? 14 : 12

  useEffect(() => {
    onPasteRowRef.current = buildPasteRowHandler({
      table: 'inventory_transactions',
      entityType: 'inventory',
      fields: getPanolPasteFields(isAdmin),
      grid,
      setList: setInventoryTx,
      nameOf: (r) => r.id,
      showFeedback,
      user: user?.email
    })
  })

  const grid = useSpreadsheetGrid({
    rows: filteredTransactions,
    columns: movimientosColumns,
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
      if (colDef.key === 'contractor_name') {
        setExpandedContractorRowId(null)
        setInlineEdit({ id: row.id, field: 'contractor_name', value: row.worker_name || row.contractor_name || '' })
        return
      }
      if (colDef.key === 'cost_center') {
        if (isAdmin) handleSaveInlineTx(row.id, 'cost_center', row.cost_center === 'CLIENTE' ? 'CONTRATISTA' : 'CLIENTE')
        return
      }
      if (colDef.key === 'weight_total') {
        const matRow = row?.material_id ? (materialById.get(String(row.material_id)) || null) : null
        setInlineEdit({ id: row.id, field: 'weight_total', value: String(resolvePanolTxWeight(row, matRow)) })
        return
      }
      if (colDef.key === 'material_id') {
        const matchedMat = materials.find((m) => m.id === row.material_id)
        setInlineEdit({ id: row.id, field: 'material_id', value: matchedMat?.name || '' })
        return
      }
      if (colDef.key === 'quantity_withdrawn') {
        setInlineEdit({
          id: row.id,
          field: 'quantity_withdrawn',
          value: getEditableCellInitialValue(row, 'quantity_withdrawn', row.quantity_withdrawn ?? '')
        })
        return
      }
      const currentVal = row[colDef.key]
      setInlineEdit({ id: row.id, field: colDef.key, value: currentVal ?? '' })
    },
    canEditCell: (row, colKey) => {
      if (colKey === 'cost_center' && !isAdmin) {
        showFeedback('error', 'Solo el Administrador puede editar el Centro de Costo.')
        return false
      }
      if (colKey === 'weight_total' && !isAdmin) {
        showFeedback('error', 'El peso es solo de referencia para el Pañolero.')
        return false
      }
      return true
    },
    onBatchUpdate: async ({ colKey, newValue, targetIds, isRevert, revertMap }) => {
      try {
        if (isRevert && revertMap) {
          for (const [id, val] of Object.entries(revertMap)) {
            await handleSaveInlineTx(id, colKey, val, { skipUndo: true })
          }
        } else if (targetIds && targetIds.length > 0) {
          for (const id of targetIds) {
            if (colKey === 'contractor_name') {
              const targetTx = filteredTransactions.find((t) => t.id === id)
              if (targetTx) await handleSaveInlineContractor(targetTx, newValue, { skipUndo: true })
            } else {
              await handleSaveInlineTx(id, colKey, newValue)
            }
          }
        }
      } catch (err) {
        showFeedback('error', 'Error al actualizar lote: ' + err.message)
      }
    }
  })

  const { visibleItems: visibleTransactions, visibleCount, hasMore, remainingCount, loadMore, showAll, sentinelRef } = useProgressiveRows({
    items: filteredTransactions,
    activeIndex: grid.activeCell?.rowIndex ?? -1,
    scrollContainerRef: grid.gridContainerRef,
    resetKey: filterResetKey || searchQuery
  })

  const gridHistoryActionsRef = useRef({ undo: grid.undo, redo: grid.redo })
  useEffect(() => {
    gridHistoryActionsRef.current = { undo: grid.undo, redo: grid.redo }
  }, [grid.undo, grid.redo])

  const gridUndoCount = grid.undoStack?.length || 0
  const gridRedoCount = grid.redoStack?.length || 0
  useEffect(() => {
    onHistoryChange?.({
      canUndo: grid.canUndo,
      canRedo: grid.canRedo,
      undoCount: gridUndoCount,
      redoCount: gridRedoCount,
      onUndo: () => gridHistoryActionsRef.current.undo?.(),
      onRedo: () => gridHistoryActionsRef.current.redo?.()
    })
  }, [onHistoryChange, grid.canUndo, grid.canRedo, gridUndoCount, gridRedoCount])

  useEffect(() => () => onHistoryChange?.(null), [onHistoryChange])

  function getSpreadsheetCellProps(rowIndex, colKey) {
    const colIdx = movimientosColumns.findIndex((c) => c.key === colKey)
    if (colIdx === -1) return { className: '', renderHandle: false, domProps: {} }

    const isActive = grid.isCellActive(rowIndex, colIdx)
    const isSelected = grid.isCellSelected(rowIndex, colIdx)
    const isFillPreview = grid.isCellInFillPreview(rowIndex, colIdx)
    const renderHandle = grid.shouldRenderFillHandle(rowIndex, colIdx)

    return {
      renderHandle,
      domProps: {
        onClick: (e) => { if (!e.target.closest('input, select, textarea, button')) { grid.gridContainerRef.current?.focus(); grid.handleCellClick(rowIndex, colIdx, e) } },
        onMouseDown: (e) => { if (!e.target.closest('input, select, textarea, button')) { grid.gridContainerRef.current?.focus(); grid.handleCellMouseDown(rowIndex, colIdx, e) } },
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

  const renderFillHandle = (cp) =>
    cp.renderHandle ? (
      <div
        onMouseDown={grid.handleFillHandleMouseDown}
        onDoubleClick={grid.handleFillHandleDoubleClick}
        className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
      />
    ) : null

  const exportColumns = useMemo(
    () => [
      { key: 'transaction_date', label: 'Fecha', formatter: (v) => formatDateAr(getLocalDateKey(v), { fallback: '' }) },
      { key: 'ship_id', label: 'Barco', formatter: (v) => ships.find((s) => s.id === v)?.name || 'Astillero' },
      { key: 'work_order_id', label: 'OT', formatter: (v) => { const w = workOrders.find((x) => x.id === v); return w ? `${w.ot_number || ''} ${w.title || ''}`.trim() : 'Sin OT' } },
      { key: 'contractor_name', label: 'Contratista', formatter: (_v, row) => row.worker_name || row.contractor_name || '' },
      { key: 'material_id', label: 'Material', formatter: (v) => materialById.get(v)?.name || '' },
      { key: 'quantity_withdrawn', label: 'Cantidad' },
      {
        key: 'weight_total',
        label: 'Peso (kg)',
        formatter: (_v, row) => resolvePanolTxWeight(row, row?.material_id ? (materialById.get(String(row.material_id)) || null) : null)
      },
      ...(isAdmin
        ? [
            { key: 'cost_unit_usd', label: 'P. Unit US$', formatter: (_v, row) => resolvePanolTxCost(row, materialById.get(row.material_id) || null, { macroVariables, policy: pricingPolicy }).unitUsd },
            { key: 'cost_total_usd', label: 'Costo Total US$', formatter: (_v, row) => resolvePanolTxCost(row, materialById.get(row.material_id) || null, { macroVariables, policy: pricingPolicy }).totalUsd },
            { key: 'cost_center', label: 'Centro de Costo' }
          ]
        : []),
      { key: 'voucher_number', label: 'Nº Remito' },
      { key: 'notes', label: 'Observaciones' }
    ],
    [isAdmin, ships, workOrders, materialById, macroVariables, pricingPolicy]
  )

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
        exportColumns={exportColumns}
        exportFilename={`panol_retiros_${getTodayArIso()}`}
        extraActions={isAdmin ? (
          <button
            type="button"
            onClick={toggleCostCenterColumn}
            title={showCostCenter ? 'Contraer columna Centro de Costo (estilo Sheets)' : 'Expandir columna Centro de Costo'}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold transition-colors cursor-pointer ${
              showCostCenter
                ? 'bg-amber-950/70 hover:bg-amber-900/80 border-amber-500/60 text-amber-200'
                : 'bg-slate-800 hover:bg-slate-700 border-cyan-500/50 text-cyan-300'
            }`}
          >
            <span>{showCostCenter ? '− Ocultar C. Costo' : '+ Centro de Costo'}</span>
          </button>
        ) : null}
      />

      <div
        tabIndex={0}
        onKeyDown={grid.handleKeyDown}
        ref={grid.gridContainerRef}
        className="alon-grid-scroll focus:outline-none"
      >
        <table className="w-full text-left text-[10.5px] border-collapse">
          <thead className="sticky top-0 z-20 alon-grid-thead">
            <tr className="text-[9px] leading-tight tracking-normal">
              <th className="py-1 px-0.5 w-7 text-center select-none">
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
              <th className="py-1.5 px-1 text-center whitespace-nowrap" title="Stock del material: en vivo durante el día, congelado a las 21:00 hs ART · Clic para ver Kárdex">Stock</th>
              <th {...grid.getColumnHeaderProps('transaction_date', 'py-1.5 px-1')}>Fecha ✎</th>
              <th {...grid.getColumnHeaderProps('ship_id', 'py-1.5 px-1')}>Barco / Destino ✎</th>
              <th {...grid.getColumnHeaderProps('work_order_id', 'py-1.5 px-1')}>Orden de Trabajo (OT) ✎</th>
              <th {...grid.getColumnHeaderProps('contractor_name', 'py-1.5 px-1')}>Contratista / Grupo ✎</th>
              <th {...grid.getColumnHeaderProps('material_id', 'py-1.5 px-1')}>Material Insumo ✎</th>
              <th {...grid.getColumnHeaderProps('quantity_withdrawn', 'py-1.5 px-1 text-right')}>Cant. ✎</th>
              <th
                {...grid.getColumnHeaderProps('weight_total', 'py-1.5 px-1 text-right')}
                title={isAdmin ? 'Peso total en kg (calculado desde Catálogo; doble clic para editar)' : 'Peso referencial en kg (solo vista, calculado desde Catálogo)'}
              >
                Peso (kg){isAdmin ? ' ✎' : ''}
              </th>
              {isAdmin && <th {...grid.getColumnHeaderProps('cost_total_usd', 'py-1.5 px-1 text-right')} title="Costo total del retiro en US$ (y unitario debajo) según precio congelado por quincena">Costo US$</th>}
              {isAdmin && (showCostCenter ? (
                <th {...grid.getColumnHeaderProps('cost_center', 'py-1.5 px-1 text-center')}>
                  <div className="inline-flex items-center justify-center gap-1">
                    <span>Centro de Costo ✎</span>
                    <button
                      type="button"
                      onClick={toggleCostCenterColumn}
                      title="Contraer columna Centro de Costo"
                      className="w-4 h-4 rounded bg-slate-800 hover:bg-amber-900/80 border border-slate-600 text-amber-300 text-[10px] font-black leading-none inline-flex items-center justify-center cursor-pointer shrink-0"
                    >
                      −
                    </button>
                  </div>
                </th>
              ) : (
                <th className="py-1 px-0.5 w-6 text-center" title="Columna Centro de Costo contraída · Clic en [+] para expandir">
                  <button
                    type="button"
                    onClick={toggleCostCenterColumn}
                    className="w-4 h-4 rounded bg-cyan-950/90 hover:bg-cyan-800 border border-cyan-500/60 text-cyan-300 text-[10px] font-black leading-none inline-flex items-center justify-center cursor-pointer"
                  >
                    +
                  </button>
                </th>
              ))}
              <th {...grid.getColumnHeaderProps('voucher_number', 'py-1.5 px-1')}>Nº Remito ✎</th>
              <th {...grid.getColumnHeaderProps('notes', 'py-1.5 px-1')}>Observaciones ✎</th>
              <th className="py-1.5 px-1 text-center">Acciones</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-800/60 font-sans">
            {loading ? (
              <tr>
                <td colSpan={totalColSpan} className="py-12 text-center text-slate-500 text-xs">
                  <RefreshCw className="w-5 h-5 text-cyan-400 animate-spin mx-auto mb-2" />
                  <span>Cargando planilla de retiros de Pañol...</span>
                </td>
              </tr>
            ) : filteredTransactions.length === 0 ? (
              <tr>
                <td colSpan={totalColSpan} className="py-12 text-center text-slate-500 text-xs">
                  No se encontraron retiros con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              <>
              {visibleTransactions.map((tx, rowIndex) => {
                const isSelected = selectedTxIds.has(tx.id)
                const mat = tx.material_id ? (materialById.get(String(tx.material_id)) || null) : null
                const ship = tx.ship_id ? (shipById.get(String(tx.ship_id)) || null) : null
                const wo = tx.work_order_id ? (workOrderById.get(String(tx.work_order_id)) || null) : null
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
                    <td className="py-1 px-0.5 text-center w-7 select-none relative">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => toggleSelectTx(tx.id)}
                          className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                        >
                          {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
                        </button>
                        <span
                          className={`font-mono text-[9px] font-bold px-0.5 rounded ${
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

                    {/* 1b. Stock disponible del material (Vivo hoy / Congelado 21:00 ART · Clic -> Kárdex) */}
                    {(() => {
                      const cell = resolveTxStockCellState({ tx, material: mat, freezeConfig: stockFreezeConfig })
                      if (cell.mode === 'NO_MATERIAL') return <td className="py-1 px-1 text-center font-mono text-slate-600 whitespace-nowrap" title="Sin material asignado">—</td>
                      const openKardex = () => onOpenKardexModal?.(mat)
                      if (!mat.requires_stock_control || cell.mode === 'NO_CONTROL') {
                        return (
                          <td className="py-1 px-1 text-center font-mono whitespace-nowrap" title="Sin control de stock físico · Clic para ver Kárdex">
                            <button type="button" onClick={openKardex} className="inline-block px-1 py-0.5 rounded text-[10px] font-bold border bg-slate-800/80 text-slate-400 border-slate-700 hover:border-cyan-500/50 cursor-pointer">{'S/C'}</button>
                          </td>
                        )
                      }
                      if (cell.mode === 'PRE_ACTIVATION') {
                        const actLbl = cell.activatedDateAr ? formatDateAr(cell.activatedDateAr) : 'activación'
                        return (
                          <td className="py-1 px-1 text-center font-mono whitespace-nowrap" title={`Histórico previo a la activación del control de stock (${actLbl}) · Clic para ver Kárdex`}>
                            <button type="button" onClick={openKardex} className="inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border bg-slate-900/70 text-slate-500 border-slate-800 hover:text-cyan-300 cursor-pointer">—</button>
                          </td>
                        )
                      }
                      const unitShort = formatUnitMeasureShort(mat.unit_measure)
                      const minStock = Number(mat.minimum_stock) || 0
                      const isLow = cell.value < 0 || cell.value <= minStock
                      const isFrozen = cell.mode === 'FROZEN'
                      const cls = isLow ? 'bg-rose-950/75 text-rose-300 border-rose-500/50 hover:border-rose-400' : isFrozen ? 'bg-sky-950/75 text-sky-200 border-sky-500/50 hover:border-cyan-400' : 'bg-emerald-950/60 text-emerald-300 border-emerald-500/40 hover:border-cyan-400'
                      const tip = isFrozen
                        ? `Stock congelado al cierre del día (${formatDateTimeAr(cell.frozenAt)} hs · Mín: ${minStock}) · Clic para ver Kárdex`
                        : `Stock en vivo hoy (congela a las ${cell.cutoffHourAr}:00 hs · Mín: ${minStock}) · Clic para ver Kárdex`
                      return (
                        <td className="py-1 px-1 text-center font-mono whitespace-nowrap" title={tip}>
                          <button type="button" onClick={openKardex} className={`inline-flex items-center gap-1 px-1 py-0.5 rounded text-[10px] font-bold border cursor-pointer transition-colors ${cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${isFrozen ? 'bg-sky-400' : 'bg-emerald-400 animate-pulse'}`} />
                            <span>{isFrozen ? '🔒 ' : ''}{cell.value} {unitShort}</span>
                          </button>
                        </td>
                      )
                    })()}

                    {/* 2. Fecha */}
                    {(() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'transaction_date')
                      const dateVal = getLocalDateKey(tx.transaction_date)
                      const timeVal = formatLocalTimeHHMM(tx.transaction_date)
                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'transaction_date', value: dateVal })}
                          className={`py-1 px-1 whitespace-nowrap font-mono cursor-pointer ${cp.className} ${isDeletionReq ? 'line-through' : ''}`}
                          title={timeVal ? `Registrado a las ${timeVal} hs · Doble clic para editar fecha` : 'Doble clic para editar fecha con calendario'}
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
                              {...inlineFieldHandlers(tx.id, 'transaction_date', inlineEdit.value)}
                              className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[10.5px] font-mono text-white focus:outline-none"
                            />
                          ) : (
                            <span><HighlightText text={formatDateAr(dateVal)} query={searchQuery} /></span>
                          )}
                          {renderFillHandle(cp)}
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
                              isOpen: true, txId: tx.id, shipId: tx.ship_id, workOrderId: tx.work_order_id,
                              workerName: tx.worker_name, contractorName: tx.contractor_name
                            })
                          }}
                          className={`py-1 px-1 cursor-pointer font-semibold ${cp.className} ${isDeletionReq ? 'line-through text-rose-300' : 'text-slate-200'}`}
                          title={`${ship?.name || 'Sin buque'} · Doble clic para cambiar Buque u Orden de Trabajo`}
                        >
                          <div className="flex items-center gap-1 font-bold text-white max-w-[95px] xl:max-w-[115px] 2xl:max-w-[145px]">
                            {ship ? (
                              <>
                                <Anchor className="w-3 h-3 text-cyan-400 shrink-0" />
                                <span className="truncate"><HighlightText text={ship.name} query={searchQuery} /></span>
                              </>
                            ) : (
                              <span className="text-slate-500 font-normal italic text-[10px] truncate">— Sin Buque</span>
                            )}
                          </div>
                          {renderFillHandle(cp)}
                        </td>
                      )
                    })()}

                    {/* 4. Orden de Trabajo (OT) */}
                    {(() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'work_order_id')
                      const contractorVal = tx.contractor_name || tx.worker_name
                      const enabledShipWos = getEnabledWosForShipAndContractor(tx.ship_id, contractorVal)
                      const otTooltip = typeof formatWorkOrderTooltip === 'function' ? formatWorkOrderTooltip(wo, ship, workItems, workOrders) : ''
                      const allocState = evaluateAllocationState({
                        shipId: tx.ship_id, workOrderId: tx.work_order_id, contractorName: contractorVal,
                        isSinOt: !tx.work_order_id, availableWos: enabledShipWos, pendingAlerts
                      })

                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => {
                            setPickerModal({
                              isOpen: true, txId: tx.id, shipId: tx.ship_id, workOrderId: tx.work_order_id,
                              workerName: tx.worker_name, contractorName: tx.contractor_name
                            })
                          }}
                          className={`py-1 px-1 cursor-pointer ${cp.className} ${isDeletionReq ? 'line-through text-rose-300' : ''}`}
                          title={otTooltip}
                        >
                          <div className="max-w-[130px] xl:max-w-[155px] 2xl:max-w-[195px] overflow-hidden">
                            {wo ? (
                              <CanonicalOtBadge
                                wo={wo} ship={ship || null} workItems={workItems} workOrders={workOrders}
                                searchQuery={searchQuery} tooltipOverride={otTooltip} variant="pill"
                              />
                            ) : (
                              <div className="flex items-center justify-between gap-1">
                                <CanonicalOtBadge wo={null} tooltipOverride={otTooltip} />
                                {allocState.needsOtRequest && (
                                  allocState.isOtRequestPending ? (
                                    <span className="px-1 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed shrink-0">
                                      Enviada (1)
                                    </span>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        onOpenRequestOtModal({
                                          txId: tx.id, shipId: tx.ship_id || '', targetWorkerOrContractor: contractorVal || ''
                                        })
                                      }}
                                      className="px-1.5 py-0.5 rounded text-[9px] font-extrabold bg-rose-600 hover:bg-rose-500 text-white shadow animate-pulse shrink-0 cursor-pointer"
                                      title="No hay OT habilitada. Clic para pedir apertura a Jorge Sentis."
                                    >
                                      ➕ Pedir OT
                                    </button>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                          {renderFillHandle(cp)}
                        </td>
                      )
                    })()}

                    {/* 5. Operario / Contratista (mismo selector agrupado del modal ✎) */}
                    {(() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'contractor_name')
                      const currentVal = tx.worker_name || tx.contractor_name || ''
                      const isEditingContractor = inlineEdit.id === tx.id && inlineEdit.field === 'contractor_name'
                      const isRowExpanded = expandedContractorRowId === tx.id
                      const selectModel = isEditingContractor
                        ? buildPanolContractorSelectModel({
                            shipId: tx.ship_id, workOrderId: tx.work_order_id, isExpanded: isRowExpanded,
                            astilleroWorkers, contractorGroups, workOrders, workItems
                          })
                        : null
                      const allocState = isEditingContractor
                        ? evaluateAllocationState({
                            shipId: tx.ship_id, workOrderId: tx.work_order_id, contractorName: currentVal,
                            isSinOt: !tx.work_order_id,
                            availableWos: getEnabledWosForShipAndContractor(tx.ship_id, currentVal),
                            pendingAlerts
                          })
                        : null
                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => {
                            setExpandedContractorRowId(null)
                            setInlineEdit({ id: tx.id, field: 'contractor_name', value: currentVal })
                          }}
                          className={`py-1 px-1 cursor-pointer font-bold text-cyan-300 ${cp.className} ${isDeletionReq ? 'line-through text-rose-300' : ''}`}
                          title={`${currentVal || 'Sin asignar'} · Doble clic o Enter para seleccionar Operario / Contratista`}
                        >
                          {isEditingContractor && selectModel ? (
                            <PanolContractorSelect
                              inline
                              value={currentVal}
                              enabled={selectModel.displayed}
                              isExpanded={isRowExpanded}
                              hasScope={selectModel.hasScope}
                              scopeLabel={selectModel.scopeLabel}
                              enabledAstSet={selectModel.enabledAstSet}
                              enabledCntSet={selectModel.enabledCntSet}
                              unmatchedSuffix={tx.work_order_id ? ' (Sin OT — borra OT)' : ' (Sin OT en barco)'}
                              isOtRequestPending={Boolean(allocState?.isOtRequestPending)}
                              onToggleExpand={(exp) => setExpandedContractorRowId(exp ? tx.id : null)}
                              onRequestOt={() => onOpenRequestOtModal({ txId: tx.id, shipId: tx.ship_id || '', targetWorkerOrContractor: currentVal || '' })}
                              onRequestWorkerPermission={() => onOpenWorkerPermissionModal()}
                              onCancel={() => {
                                setInlineEdit({ id: null, field: null, value: '' })
                                setExpandedContractorRowId(null)
                                grid.gridContainerRef.current?.focus()
                              }}
                              onChange={(selectedName) => {
                                setInlineEdit({ id: null, field: null, value: '' })
                                setExpandedContractorRowId(null)
                                grid.gridContainerRef.current?.focus()
                                if (selectedName && selectedName !== currentVal) {
                                  handleSaveInlineContractor(tx, selectedName)
                                }
                              }}
                            />
                          ) : (
                            <div className="max-w-[105px] xl:max-w-[125px] 2xl:max-w-[155px] truncate">
                              <HighlightText text={currentVal || 'Sin asignar'} query={searchQuery} />
                            </div>
                          )}
                          {renderFillHandle(cp)}
                        </td>
                      )
                    })()}

                    {/* 6. Material Insumo */}
                    {(() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'material_id')
                      const isEditingMat = inlineEdit.id === tx.id && inlineEdit.field === 'material_id'
                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'material_id', value: mat?.name || '' })}
                          className={`py-1 px-1 cursor-pointer font-bold ${cp.className} ${isDeletionReq ? 'line-through text-rose-300' : 'text-white'}`}
                          title={`${mat?.name || 'Insumo sin asignar'} · Doble clic para cambiar material`}
                        >
                          {isEditingMat ? (
                            <CanonicalMaterialPicker
                              materials={materials} value={tx.material_id || ''} initialText={inlineEdit.value} compact autoFocus
                              placeholder="Buscar material o rubro..."
                              onChange={(matId) => {
                                if (matId && matId !== tx.material_id) handleSaveInlineTx(tx.id, 'material_id', matId)
                                setInlineEdit({ id: null, field: null, value: '' }); grid.gridContainerRef.current?.focus()
                              }}
                              onCancel={() => { setInlineEdit({ id: null, field: null, value: '' }); grid.gridContainerRef.current?.focus() }}
                            />
                          ) : (
                            <div className="flex items-center gap-1 max-w-[130px] xl:max-w-[155px] 2xl:max-w-[205px]">
                              {mat?.image_url && (
                                <img
                                  src={mat.image_url} alt=""
                                  onClick={(e) => { e.stopPropagation(); onPreviewImage(mat.image_url) }}
                                  className="w-4 h-4 rounded object-cover shrink-0 cursor-zoom-in border border-slate-700"
                                />
                              )}
                              <span className="truncate"><HighlightText text={mat?.name || 'Insumo sin asignar'} query={searchQuery} /></span>
                            </div>
                          )}
                          {renderFillHandle(cp)}
                        </td>
                      )
                    })()}

                    {/* 7. Cantidad */}
                    {(() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'quantity_withdrawn')
                      const qtyFormula = getStoredCellFormula(tx, 'quantity_withdrawn')
                      const formulaMeta = describeFormula(qtyFormula)
                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'quantity_withdrawn', value: getEditableCellInitialValue(tx, 'quantity_withdrawn', tx.quantity_withdrawn ?? 1) })}
                          className={`py-1 px-1 text-right font-mono font-bold cursor-pointer whitespace-nowrap ${cp.className} ${isDeletionReq ? 'line-through' : 'text-emerald-400'}`}
                          title={formulaMeta?.tooltipText || 'Doble clic para editar cantidad (acepta fórmulas =1*0.5 o +42+45)'}
                        >
                          <FormulaCellCornerMark formula={qtyFormula} />
                          {inlineEdit.id === tx.id && inlineEdit.field === 'quantity_withdrawn' ? (
                            <FormulaNumericInput
                              variant="cell" autoFocus maxDecimals={4} emptyValue={0}
                              unitSuffix={mat?.unit_measure || 'un.'} value={inlineEdit.value}
                              onChange={(val) => setInlineEdit({ ...inlineEdit, value: val })}
                              onCommit={(rawVal) => { handleSaveInlineTx(tx.id, 'quantity_withdrawn', rawVal); setInlineEdit({ id: null, field: null, value: '' }) }}
                              onCancel={() => setInlineEdit({ id: null, field: null, value: '' })}
                              onInvalid={(errMsg) => showFeedback('error', errMsg)}
                              className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[10.5px] font-mono text-white focus:outline-none w-20 text-right"
                            />
                          ) : (
                            <span>{formatFormulaNumericDisplay(tx.quantity_withdrawn, { maxDecimals: 3 })} {formatUnitMeasureShort(mat?.unit_measure || 'un.')}</span>
                          )}
                          {renderFillHandle(cp)}
                        </td>
                      )
                    })()}

                    {/* 8. Peso (kg) */}
                    {(() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'weight_total')
                      const w = resolvePanolTxWeight(tx, mat)
                      const unitKg = Number(mat?.weight_kg) || 0
                      const qtyNum = Number(tx?.quantity_withdrawn) || 0
                      const weightTooltip = isAdmin
                        ? (w > 0 && unitKg > 0 ? `${qtyNum} × ${unitKg} kg c/u = ${w.toFixed(2)} kg · Doble clic para editar` : 'Doble clic para editar peso en kg')
                        : (w > 0 && unitKg > 0 ? `Peso referencial (solo vista): ${qtyNum} × ${unitKg} kg c/u = ${w.toFixed(2)} kg` : 'Peso referencial (solo vista)')
                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => { if (isAdmin) setInlineEdit({ id: tx.id, field: 'weight_total', value: String(w) }) }}
                          className={`py-1 px-1 text-right font-mono text-slate-300 ${isAdmin ? 'cursor-pointer' : 'cursor-default'} whitespace-nowrap ${cp.className} ${isDeletionReq ? 'line-through' : ''}`}
                          title={weightTooltip}
                        >
                          {isAdmin && inlineEdit.id === tx.id && inlineEdit.field === 'weight_total' ? (
                            <input
                              type="number" autoFocus step="any" min="0"
                              {...inlineFieldHandlers(tx.id, 'weight_total', inlineEdit.value)}
                              className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[10.5px] font-mono text-white focus:outline-none w-16 text-right"
                            />
                          ) : (
                            <span>{w > 0 ? `${w.toFixed(2)} kg` : '—'}</span>
                          )}
                          {isAdmin && renderFillHandle(cp)}
                        </td>
                      )
                    })()}

                    {/* 9. Costo US$ (Solo Administrador) */}
                    {isAdmin && (() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'cost_total_usd')
                      return (
                        <PanolMovimientoCostCell
                          tx={tx} mat={mat} macroVariables={macroVariables} pricingPolicy={pricingPolicy}
                          cp={cp} isDeletionReq={isDeletionReq} onOpenEditMaterial={onOpenEditMaterialModal}
                          fillHandleNode={renderFillHandle(cp)}
                        />
                      )
                    })()}

                    {/* 10. Centro de Costo (Solo Administrador — Colapsable estilo Sheets) */}
                    {isAdmin && (showCostCenter ? (() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'cost_center')
                      const isCliente = tx.cost_center === 'CLIENTE'
                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => handleSaveInlineTx(tx.id, 'cost_center', isCliente ? 'CONTRATISTA' : 'CLIENTE')}
                          className={`py-1 px-1 whitespace-nowrap cursor-pointer text-center ${cp.className} ${isDeletionReq ? 'line-through' : ''}`}
                          title="Doble clic para alternar CLIENTE / CONTRATISTA"
                        >
                          {tx.cost_center ? (
                            <span className={`inline-block px-1 py-0.5 rounded text-[9.5px] font-bold border ${isCliente ? 'bg-cyan-950 text-cyan-300 border-cyan-800' : 'bg-amber-950 text-amber-300 border-amber-800'}`}>
                              {tx.cost_center}
                            </span>
                          ) : (
                            <span className="text-slate-500 italic text-[10px]">—</span>
                          )}
                          {renderFillHandle(cp)}
                        </td>
                      )
                    })() : (
                      <td
                        onClick={toggleCostCenterColumn}
                        className="py-1 px-0.5 w-6 text-center cursor-pointer hover:bg-slate-800/70"
                        title={`Centro de Costo: ${tx.cost_center || 'Sin definir'} · Clic para expandir columna`}
                      >
                        <span className={`inline-block w-2 h-2 rounded-full ${tx.cost_center === 'CLIENTE' ? 'bg-cyan-400' : tx.cost_center === 'CONTRATISTA' ? 'bg-amber-400' : 'bg-slate-700'}`} />
                      </td>
                    ))}

                    {/* 9b. Nº Remito AlonCar */}
                    {(() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'voucher_number')
                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'voucher_number', value: tx.voucher_number || '' })}
                          className={`py-1 px-1 whitespace-nowrap cursor-pointer font-mono ${cp.className} ${isDeletionReq ? 'line-through text-rose-300' : ''}`}
                          title="Doble clic para cargar o editar Nº de Remito AlonCar"
                        >
                          {inlineEdit.id === tx.id && inlineEdit.field === 'voucher_number' ? (
                            <input
                              type="text" autoFocus placeholder="Ej: 2530"
                              {...inlineFieldHandlers(tx.id, 'voucher_number', inlineEdit.value)}
                              className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[10.5px] font-mono text-white focus:outline-none w-16"
                            />
                          ) : tx.voucher_number ? (
                            <span className="inline-flex items-center px-1 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/40 text-cyan-300 text-[9.5px] font-bold">
                              #<HighlightText text={tx.voucher_number} query={searchQuery} />
                            </span>
                          ) : (
                            <span className="text-slate-600 text-[10px]">—</span>
                          )}
                          {renderFillHandle(cp)}
                        </td>
                      )
                    })()}

                    {/* 10. Observaciones */}
                    {(() => {
                      const cp = getSpreadsheetCellProps(rowIndex, 'notes')
                      const isEditingNotes = inlineEdit.id === tx.id && inlineEdit.field === 'notes'
                      return (
                        <td
                          {...cp.domProps}
                          onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'notes', value: tx.notes || '' })}
                          className={`py-1 px-1 cursor-pointer text-slate-400 ${cp.className} ${isDeletionReq ? 'line-through text-rose-300' : ''}`}
                          title={tx.notes || 'Doble clic para editar observaciones'}
                        >
                          {isEditingNotes ? (
                            <input
                              type="text" autoFocus
                              {...inlineFieldHandlers(tx.id, 'notes', inlineEdit.value)}
                              className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[10.5px] text-white focus:outline-none w-full"
                            />
                          ) : (
                            <div className="max-w-[75px] xl:max-w-[100px] 2xl:max-w-[140px] truncate">
                              <HighlightText text={tx.notes || '—'} query={searchQuery} />
                            </div>
                          )}
                          {renderFillHandle(cp)}
                        </td>
                      )
                    })()}

                    {/* 11. Acciones */}
                    <td className="py-1 px-1 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-0.5">
                        <button
                          type="button" onClick={() => onOpenWithdrawalModal(tx)}
                          className="p-0.5 rounded hover:bg-emerald-950/80 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                          title="Editar fila en ventana de salida multi-material"
                        >
                          <Edit3 className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenQuickPurchaseModal({
                            isOpen: true, urgency: 'SIN_APURO',
                            material: mat || { id: tx.material_id, name: 'Insumo', unit_measure: 'Unidad' },
                            quantity: String(tx.quantity_withdrawn || 1)
                          })}
                          className="p-0.5 rounded hover:bg-cyan-950/80 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                          title="Generar Pedido de Compra directo a Compras (Estado: PEDIR)"
                        >
                          <ShoppingCart className="w-3.5 h-3.5 stroke-[2.5]" />
                        </button>
                        <button
                          type="button" onClick={() => handleDuplicateTx(tx)}
                          className="p-0.5 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
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
              })}
              <CanonicalProgressiveTableFooter
                visibleCount={visibleCount} totalCount={filteredTransactions.length}
                hasMore={hasMore} remainingCount={remainingCount}
                loadMore={loadMore} showAll={showAll}
                sentinelRef={sentinelRef} colSpan={totalColSpan} entityLabel="retiros"
              />
              </>
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
        selectionStats={grid.selectionStats} onClearSelection={() => grid.setSelectionRange(null)}
        globalAggregates={[
          { label: 'Σ CANT', value: panolTotals.totalQty.toLocaleString('es-AR') },
          { label: 'Σ PESO', value: `${panolTotals.totalKg.toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg` },
          ...(isAdmin ? [{ label: 'Σ COSTO US$', value: formatUsd(panolTotals.totalUsd || 0), highlight: true }] : [])
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
    </div>
  )
}
