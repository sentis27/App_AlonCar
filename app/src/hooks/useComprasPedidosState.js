import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import { useSpreadsheetGrid } from './useSpreadsheetGrid'
import {
  computeFortnightFromDate,
  computeAvailableFortnights,
  computePedidosKpis,
  filterPurchaseOrders,
  computePedidosStats
} from '../lib/comprasPedidosHelpers'
import { buildPedidosSpreadsheetColumns, buildBatchOrderDbPayload } from '../lib/comprasPedidosGridHelpers'
import { batchRevertPedidosService, batchUpdatePedidosService } from '../services/comprasPedidosService'
import { useComprasPedidosMutations } from './useComprasPedidosMutations'
import { useComprasPedidosModalActions } from './useComprasPedidosModalActions'

export function useComprasPedidosState(props) {
  const {
    purchaseOrders, setPurchaseOrders, suppliers, materials, setMaterials,
    ships, workOrders, macroVariables, documents, currentFortnight,
    viewMode, user, profile, showFeedbackMsg, fetchData
  } = props

  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)
  const [filterSupplier, setFilterSupplier] = useState('TODOS')
  const [filterStatus, setFilterStatus] = useState('TODOS')
  const [filterFortnight, setFilterFortnight] = useState('TODAS')
  const [filterChargeType, setFilterChargeType] = useState('TODOS')
  const [filterNewOnly, setFilterNewOnly] = useState(false)
  const [hideReconciled, setHideReconciled] = useState(false)
  const [activeKpiFilter, setActiveKpiFilter] = useState(null)
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set())

  const [shipPickerModal, setShipPickerModal] = useState({ isOpen: false, orderId: null, shipId: '', workOrderId: '', chargeType: 'DIRECT', contractorName: '' })
  const [contractorPickerModal, setContractorPickerModal] = useState({ isOpen: false, orderId: null, currentValue: '', shipName: '', workOrderTitle: '', isOtBlank: true })
  const [showNewMaterialModal, setShowNewMaterialModal] = useState(false)
  const [pendingMaterialOrder, setPendingMaterialOrder] = useState(null)
  const [inlineEdit, setInlineEdit] = useState({ orderId: null, field: null, value: '' })
  const [showOrderDocsModal, setShowOrderDocsModal] = useState(false)
  const [selectedOrderForDocs, setSelectedOrderForDocs] = useState(null)
  const [showPartialModal, setShowPartialModal] = useState(false)
  const [partialDeliveryOrder, setPartialDeliveryOrder] = useState(null)
  const [showSeCompraModal, setShowSeCompraModal] = useState(false)
  const [seCompraAlertOrder, setSeCompraAlertOrder] = useState(null)
  const [showAssignSupplierModal, setShowAssignSupplierModal] = useState(false)
  const [seCompraAlertSettings] = useState(null)
  const [showReconcileModal, setShowReconcileModal] = useState(false)
  const [reconcileTarget, setReconcileTarget] = useState(null)
  const [showFreightModal, setShowFreightModal] = useState(false)
  const [freightTargetOrder, setFreightTargetOrder] = useState(null)
  const [showBatchOrderModal, setShowBatchOrderModal] = useState(false)
  const [showSupplierHelperModal, setShowSupplierHelperModal] = useState(false)
  const [supplierHelperTarget, setSupplierHelperTarget] = useState(null)
  const [showMandadosModal, setShowMandadosModal] = useState(false)
  const [mandadosPreselectedIds, setMandadosPreselectedIds] = useState([])
  const [batchTargetStatus, setBatchTargetStatus] = useState('RECIBIDO')
  const [rowMenuTarget, setRowMenuTarget] = useState(null)

  useEffect(() => {
    if (!rowMenuTarget || rowMenuTarget.mode === 'context_menu') return
    const handleGlobalClick = () => setRowMenuTarget(null)
    const handleGlobalKeyDown = (e) => { if (e.key === 'Escape') setRowMenuTarget(null) }
    window.addEventListener('click', handleGlobalClick)
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      window.removeEventListener('click', handleGlobalClick)
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [rowMenuTarget])

  const getFortnight = useCallback((d) => computeFortnightFromDate(d, currentFortnight), [currentFortnight])
  const availableFortnights = useMemo(() => computeAvailableFortnights(purchaseOrders, currentFortnight), [purchaseOrders, currentFortnight])
  const kpis = useMemo(() => computePedidosKpis(purchaseOrders, ships), [purchaseOrders, ships])

  const hasActiveFilters = Boolean(
    searchQuery.trim() || filterSupplier !== 'TODOS' || filterStatus !== 'TODOS' ||
    filterFortnight !== 'TODAS' || filterChargeType !== 'TODOS' || filterNewOnly || hideReconciled || activeKpiFilter !== null
  )

  const clearAllFilters = useCallback(() => {
    setSearchQuery('')
    setFilterSupplier('TODOS')
    setFilterStatus('TODOS')
    setFilterFortnight('TODAS')
    setFilterChargeType('TODOS')
    setFilterNewOnly(false)
    setHideReconciled(false)
    setActiveKpiFilter(null)
  }, [])

  const toggleKpiFilter = useCallback((filterKey) => {
    if (activeKpiFilter === filterKey) {
      setActiveKpiFilter(null)
      setFilterStatus('TODOS')
      setFilterSupplier('TODOS')
      return
    }
    setActiveKpiFilter(filterKey)
    if (['por_emitir', 'cotizaciones', 'pedidos', 'recibidos', 'conciliados', 'alta_materiales', 'cost_audit'].includes(filterKey)) {
      setFilterStatus('TODOS')
      setFilterSupplier('TODOS')
    } else if (['PEDIR', 'COTIZAR', 'COTIZA.SOLICITUD', 'COTIZACION', 'COTIZA.APROBADA', 'PEDIDO', 'PEDIDO INCOMPLETO', 'SE COMPRA?'].includes(filterKey)) {
      setFilterStatus(filterKey)
      setFilterSupplier('TODOS')
    } else if (filterKey === 'gases') {
      const gasSup = suppliers.find((s) => s.is_gas_supplier)
      if (gasSup) setFilterSupplier(gasSup.id)
      setFilterStatus('TODOS')
    }
  }, [activeKpiFilter, suppliers])

  const filteredOrders = useMemo(
    () => filterPurchaseOrders(
      purchaseOrders,
      { searchQuery, filterSupplier, filterStatus, filterFortnight, filterChargeType, filterNewOnly, hideReconciled, activeKpiFilter },
      { suppliers, ships, documents, workOrders }
    ),
    [purchaseOrders, searchQuery, filterSupplier, filterStatus, filterFortnight, filterChargeType, filterNewOnly, hideReconciled, activeKpiFilter, suppliers, ships, documents, workOrders]
  )

  const spreadsheetColumns = useMemo(() => buildPedidosSpreadsheetColumns(viewMode, ships, workOrders), [viewMode, ships, workOrders])
  const pushUndoRef = useRef(null)
  const pushUndoAction = useCallback((action) => pushUndoRef.current?.(action), [])

  const rowMutations = useComprasPedidosMutations({
    purchaseOrders, setPurchaseOrders, ships, filteredOrders, selectedOrderIds, setSelectedOrderIds,
    currentFortnight, user, profile, pushUndoAction, setInlineEdit, showFeedbackMsg
  })

  const modalActions = useComprasPedidosModalActions({
    purchaseOrders, setPurchaseOrders, materials, setMaterials, ships, suppliers,
    selectedOrderIds, setSelectedOrderIds, batchTargetStatus, user, profile, pushUndoAction,
    fetchData, showFeedbackMsg, setShowPartialModal, setPartialDeliveryOrder, setShowSeCompraModal,
    setSeCompraAlertOrder, setShowSupplierHelperModal, setSupplierHelperTarget, setShowNewMaterialModal,
    pendingMaterialOrder, setPendingMaterialOrder, reconcileTarget, setShowReconcileModal, setReconcileTarget,
    freightTargetOrder, setShowFreightModal, setFreightTargetOrder, shipPickerModal
  })

  const handleSpreadsheetBatchUpdate = useCallback(async ({ colKey, newValue, targetIds, revertMap, isRevert }) => {
    if (isRevert && revertMap) {
      setPurchaseOrders((prev) => prev.map((p) => {
        if (revertMap[p.id] === undefined) return p
        const oldVal = revertMap[p.id]
        if (colKey === 'ship_id' && oldVal && typeof oldVal === 'object') return { ...p, ship_id: oldVal.ship_id ?? null, work_order_id: oldVal.work_order_id ?? null, charge_type: oldVal.charge_type || p.charge_type }
        if (colKey === 'reconciliation' && oldVal && typeof oldVal === 'object') return { ...p, is_reconciled: Boolean(oldVal.is_reconciled), invoice_number: oldVal.invoice_number ?? null, reconciled_at: oldVal.reconciled_at ?? null, reconciled_by: oldVal.reconciled_by ?? null }
        if (colKey === 'freight' && oldVal && typeof oldVal === 'object') return { ...p, freight_transport_name: oldVal.freight_transport_name ?? null, freight_request_date: oldVal.freight_request_date ?? null, freight_estimated_date: oldVal.freight_estimated_date ?? null }
        if (colKey === 'supplier_helper' && oldVal && typeof oldVal === 'object') return { ...p, ...oldVal }
        if (colKey === 'order_date') return { ...p, order_date: oldVal, fortnight_period: getFortnight(oldVal) }
        return { ...p, [colKey]: oldVal }
      }))
      try {
        await batchRevertPedidosService({ colKey, revertMap, computeFortnight: getFortnight })
      } catch (err) {
        console.error('Error al revertir en Supabase:', err)
        showFeedbackMsg('error', 'Error al revertir: ' + err.message)
        if (fetchData) fetchData()
      }
      return
    }
    if (!targetIds || targetIds.length === 0) return
    const targetSet = new Set(targetIds)
    const dbPayload = buildBatchOrderDbPayload(colKey, newValue, colKey === 'order_date' ? getFortnight(newValue) : undefined)
    const batchItems = targetIds.map((id) => {
      const po = purchaseOrders.find((p) => p.id === id)
      return { entityId: id, entityName: po?.material_name_raw || `OC #${id}`, field: colKey, fieldLabel: colKey, oldValue: po?.[colKey], newValue }
    })
    setPurchaseOrders((prev) => prev.map((p) => (targetSet.has(p.id) ? { ...p, ...dbPayload } : p)))
    try {
      await batchUpdatePedidosService({ targetIds, dbPayload, colKey, batchItems })
    } catch (err) {
      console.error('Error en batch update de compras:', err)
      showFeedbackMsg('error', 'Error al actualizar en lote: ' + err.message)
      if (fetchData) fetchData()
    }
  }, [fetchData, getFortnight, purchaseOrders, setPurchaseOrders, showFeedbackMsg])

  const activateComprasCell = useCallback((po, colKey) => {
    if (!po) return
    if (colKey === 'ship_id') {
      const supName = suppliers.find((s) => s.id === po.supplier_id)?.name || po.requested_by_name || ''
      setShipPickerModal({ isOpen: true, orderId: po.id, shipId: po.ship_id || '', workOrderId: po.work_order_id || '', chargeType: po.charge_type || 'DIRECT', contractorName: supName })
      return
    }
    if (colKey === 'urgency') { rowMutations.handleCycleUrgency(po.id, po.urgency || 'SIN_APURO'); return }
    if (colKey === 'requested_by_name') {
      const shp = ships.find((s) => s.id === po.ship_id)
      const wo = workOrders.find((w) => w.id === po.work_order_id)
      setContractorPickerModal({ isOpen: true, orderId: po.id, currentValue: po.requested_by_name || 'PAÑOL', shipName: shp?.name || 'ASTILLERO', workOrderTitle: wo ? (wo.ot_number ? `#${wo.ot_number} ${wo.title}` : wo.title) : '', isOtBlank: !po.work_order_id })
      return
    }
    if (colKey === 'material_name_raw') { setInlineEdit({ orderId: po.id, field: 'material_name_raw', value: po.material_name_raw || '', obsValue: po.observations || '' }); return }
    const today = new Date().toISOString().split('T')[0]
    const defaults = { charge_type: po.charge_type || 'DIRECT', order_date: po.order_date || today, delivery_date: po.delivery_date || today, quantity: po.quantity || 1, supplier_quoted_price: po.supplier_quoted_price || '', supplier_id: po.supplier_id || '' }
    if (colKey in defaults) setInlineEdit({ orderId: po.id, field: colKey, value: defaults[colKey] })
  }, [suppliers, ships, workOrders, rowMutations])

  const onPasteRowRef = useRef(null)
  const grid = useSpreadsheetGrid({
    rows: filteredOrders,
    columns: spreadsheetColumns,
    getRowId: (row) => row.id,
    storageKey: 'aloncar_grid_compras',
    onBatchUpdate: handleSpreadsheetBatchUpdate,
    onPasteRow: (args) => onPasteRowRef.current?.(args),
    onCellActivate: (row, colDef) => activateComprasCell(row, colDef.key),
    onFocusSearch: () => { searchInputRef.current?.focus(); searchInputRef.current?.select() },
    canEditCell: (_row, colKey, newValue) => {
      if (colKey === 'status' && newValue === 'PEDIDO INCOMPLETO') {
        showFeedbackMsg('error', 'El estado "PEDIDO INCOMPLETO" requiere recepción parcial individual con remito.')
        return false
      }
      return true
    },
    showFeedback: showFeedbackMsg
  })

  useEffect(() => {
    pushUndoRef.current = grid.pushUndoAction
    onPasteRowRef.current = rowMutations.handlePasteRow
  }, [grid.pushUndoAction, rowMutations.handlePasteRow])

  const getSpreadsheetCellProps = useCallback((rowIndex, colKey) => {
    const colIdx = spreadsheetColumns.findIndex((c) => c.key === colKey)
    if (colIdx === -1) return { className: '', renderHandle: false, domProps: {} }
    const isActive = grid.isCellActive(rowIndex, colIdx)
    const isSelected = grid.isCellSelected(rowIndex, colIdx)
    const isFillPreview = grid.isCellInFillPreview(rowIndex, colIdx)
    return {
      renderHandle: grid.shouldRenderFillHandle(rowIndex, colIdx),
      domProps: {
        onClick: (e) => grid.handleCellClick(rowIndex, colIdx, e),
        onMouseDown: (e) => grid.handleCellMouseDown(rowIndex, colIdx, e),
        onMouseEnter: () => grid.handleCellMouseEnter(rowIndex, colIdx)
      },
      className: `relative select-none transition-colors ${isActive ? 'ring-2 ring-cyan-400 bg-cyan-950/40 z-20 outline-none' : isFillPreview ? 'bg-cyan-900/40 border-y border-dashed border-cyan-400' : isSelected ? 'bg-cyan-900/30' : ''}`
    }
  }, [spreadsheetColumns, grid])

  const localPendingCount = useMemo(() => purchaseOrders.filter((po) => ['PEDIDO', 'PEDIDO INCOMPLETO'].includes(po.status) && Boolean(suppliers.find((s) => s.id === po.supplier_id)?.is_local_supplier)).length, [purchaseOrders, suppliers])
  const isAllFilteredSelected = filteredOrders.length > 0 && filteredOrders.every((o) => selectedOrderIds.has(o.id))
  const toggleSelectAll = useCallback(() => {
    if (isAllFilteredSelected) { setSelectedOrderIds(new Set()); return }
    const next = new Set(selectedOrderIds)
    filteredOrders.forEach((o) => next.add(o.id))
    setSelectedOrderIds(next)
  }, [isAllFilteredSelected, selectedOrderIds, filteredOrders])

  const toggleSelectRow = useCallback((id) => {
    const next = new Set(selectedOrderIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedOrderIds(next)
  }, [selectedOrderIds])

  const stats = useMemo(() => {
    const isCustomSelection = selectedOrderIds.size > 0
    const targetList = isCustomSelection ? purchaseOrders.filter((p) => selectedOrderIds.has(p.id)) : filteredOrders
    return { isCustomSelection, targetList, ...computePedidosStats(targetList, macroVariables) }
  }, [selectedOrderIds, filteredOrders, purchaseOrders, macroVariables])

  return {
    filters: { searchQuery, setSearchQuery, searchInputRef, filterSupplier, setFilterSupplier, filterStatus, setFilterStatus, filterFortnight, setFilterFortnight, filterChargeType, setFilterChargeType, filterNewOnly, setFilterNewOnly, hideReconciled, setHideReconciled, activeKpiFilter, setActiveKpiFilter, hasActiveFilters, clearAllFilters, toggleKpiFilter },
    selection: { selectedOrderIds, setSelectedOrderIds, isAllFilteredSelected, toggleSelectAll, toggleSelectRow, batchTargetStatus, setBatchTargetStatus },
    modals: { shipPickerModal, setShipPickerModal, contractorPickerModal, setContractorPickerModal, showNewMaterialModal, setShowNewMaterialModal, pendingMaterialOrder, setPendingMaterialOrder, showOrderDocsModal, setShowOrderDocsModal, selectedOrderForDocs, setSelectedOrderForDocs, showPartialModal, setShowPartialModal, partialDeliveryOrder, setPartialDeliveryOrder, showSeCompraModal, setShowSeCompraModal, seCompraAlertOrder, setSeCompraAlertOrder, showAssignSupplierModal, setShowAssignSupplierModal, seCompraAlertSettings, showReconcileModal, setShowReconcileModal, reconcileTarget, setReconcileTarget, showFreightModal, setShowFreightModal, freightTargetOrder, setFreightTargetOrder, showBatchOrderModal, setShowBatchOrderModal, showSupplierHelperModal, setShowSupplierHelperModal, supplierHelperTarget, setSupplierHelperTarget, showMandadosModal, setShowMandadosModal, mandadosPreselectedIds, setMandadosPreselectedIds },
    inlineEdit, setInlineEdit, rowMenuTarget, setRowMenuTarget,
    availableFortnights, kpis, filteredOrders, localPendingCount, stats,
    grid, pushUndoAction, activateComprasCell, getSpreadsheetCellProps,
    ...rowMutations, ...modalActions
  }
}
