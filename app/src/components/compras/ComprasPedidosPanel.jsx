import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import {
  XCircle,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Paperclip,
  TrendingUp,
  TrendingDown,
  Trash2,
  Edit3,
  Building2,
  MessageSquare,
  ShieldAlert,
  RotateCcw,
  RotateCw,
  CheckSquare,
  Square,
  Truck,
  Copy,
  Lightbulb,
  RefreshCw
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSpreadsheetGrid } from '../../hooks/useSpreadsheetGrid'
import GridRibbon from '../GridRibbon'
import GridContextMenu from '../GridContextMenu'
import GridStatusBarBottom from '../GridStatusBarBottom'
import CrawlerSearchBar from '../CrawlerSearchBar'
import HighlightText from '../HighlightText'
import ShipWorkOrderPickerModal from '../ShipWorkOrderPickerModal'
import ContractorPickerModal from '../ContractorPickerModal'
import OrderFormModal from './OrderFormModal'
import NewMaterialModal from './NewMaterialModal'
import {
  ReconcileModal,
  BatchOrderWhatsAppModal,
  OrderAttachmentsModal,
  PartialDeliveryModal,
  SeCompraAlertModal,
  AssignSupplierModal,
  InlineSupplierPicker,
  FreightModal,
  SupplierHelperModal,
  MandadosModal
} from './ComprasAuxModals'
import {
  STATUS_OPTIONS,
  deduceUnitMeasure,
  isCostAuditError,
  getSearchMatchMap
} from '../../lib/comprasConstants'
import { normalizeSearchText, buildUniversalSearchCorpus } from '../../lib/searchEngine'
import { auditService } from '../../lib/auditService'

export default function ComprasPedidosPanel({
  purchaseOrders,
  setPurchaseOrders,
  suppliers,
  setSuppliers,
  materials,
  setMaterials,
  ships,
  workOrders,
  workItems,
  workers,
  macroVariables,
  documents,
  setDocuments,
  systemSettings,
  contractorGroups,
  astilleroWorkers,
  currentFortnight,
  viewMode,
  isSupervisorOrAdmin,
  user,
  profile,
  showFeedbackMsg,
  fetchData,
  showOrderModal,
  setShowOrderModal,
  editingOrder,
  setEditingOrder
}) {
  // Filtros de búsqueda
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)
  const [filterSupplier, setFilterSupplier] = useState('TODOS')
  const [filterStatus, setFilterStatus] = useState('TODOS')
  const [filterFortnight, setFilterFortnight] = useState('TODAS')
  const [filterChargeType, setFilterChargeType] = useState('TODOS')
  const [filterNewOnly, setFilterNewOnly] = useState(false)
  const [hideReconciled, setHideReconciled] = useState(false)
  const [activeKpiFilter, setActiveKpiFilter] = useState(null)

  // Selección de filas
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set())

  // Modales
  const [shipPickerModal, setShipPickerModal] = useState({
    isOpen: false,
    orderId: null,
    shipId: '',
    workOrderId: '',
    chargeType: 'DIRECT',
    contractorName: ''
  })
  const [contractorPickerModal, setContractorPickerModal] = useState({
    isOpen: false,
    orderId: null,
    currentValue: '',
    shipName: '',
    workOrderTitle: '',
    isOtBlank: true
  })
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
  const [seCompraAlertSettings, setSeCompraAlertSettings] = useState(null)
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

  // Cerrar menú de fila (#) al presionar Escape o clic fuera
  useEffect(() => {
    if (!rowMenuTarget || rowMenuTarget.mode === 'context_menu') return
    function handleGlobalClick() {
      setRowMenuTarget(null)
    }
    function handleGlobalKeyDown(e) {
      if (e.key === 'Escape') setRowMenuTarget(null)
    }
    window.addEventListener('click', handleGlobalClick)
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      window.removeEventListener('click', handleGlobalClick)
      window.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [rowMenuTarget])

  // Cotización del dólar quincenal oficial
  const getDollarRateForDate = useCallback((dateStr) => {
    if (!dateStr) return 1500
    const parts = dateStr.split('-')
    if (parts.length < 3) return 1500
    const year = parseInt(parts[0], 10)
    const month = parseInt(parts[1], 10)
    const day = parseInt(parts[2], 10)

    const mv = macroVariables.find((m) => m.year === year && m.month === month)
    if (!mv) {
      const sorted = [...macroVariables].sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month))
      const latest = sorted[0]
      if (!latest) return 1500
      const rate = day <= 15 ? (latest.dollar_rate_1q || latest.dollar_rate) : (latest.dollar_rate_2q || latest.dollar_rate)
      return Number(rate) || 1500
    }
    const rate = day <= 15 ? (mv.dollar_rate_1q || mv.dollar_rate) : (mv.dollar_rate_2q || mv.dollar_rate)
    return Number(rate) || 1500
  }, [macroVariables])

  // Quincenas disponibles
  const availableFortnights = useMemo(() => {
    const set = new Set()
    purchaseOrders.forEach((po) => {
      if (po.fortnight_period) set.add(po.fortnight_period)
    })
    set.add(currentFortnight)
    return Array.from(set).sort().reverse()
  }, [purchaseOrders, currentFortnight])

  // Radar de KPIs
  const kpis = useMemo(() => {
    let countPedir = 0
    let countCotizar = 0
    let countCotizaSol = 0
    let countCotizacion = 0
    let countCotizaAprob = 0
    let countCotizacionesTotal = 0
    let countPedido = 0
    let countPedidoIncompleto = 0
    let countSeCompra = 0
    let countRecibido = 0
    let countRecibidoDirecto = 0
    let countCostAuditErrors = 0
    let countConciliados = 0
    let expiredQuotes = 0
    let newMaterialsCount = 0

    const now = new Date()

    let countSinOtTotal = 0
    let countSinOtObras = 0
    let countSinOtStock = 0

    purchaseOrders.forEach((po) => {
      if (!po.work_order_id) {
        countSinOtTotal++
        if (po.charge_type === 'DIRECT') {
          countSinOtObras++
        } else {
          countSinOtStock++
        }
      }
      if (po.is_new_material && !po.no_catalog_required) newMaterialsCount++
      if (po.is_reconciled) countConciliados++

      if (po.status === 'PEDIR' || po.status === 'SOLICITUD') countPedir++

      if (['COTIZACION', 'COTIZAR', 'COTIZA.SOLICITUD', 'COTIZA.APROBADA'].includes(po.status)) {
        countCotizacionesTotal++
        if (po.status === 'COTIZAR') countCotizar++
        if (po.status === 'COTIZA.SOLICITUD') countCotizaSol++
        if (po.status === 'COTIZACION') countCotizacion++
        if (po.status === 'COTIZA.APROBADA') countCotizaAprob++

        const orderDate = new Date(po.order_date)
        const diffDays = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24))
        if (diffDays > 7) expiredQuotes++
      }

      if (po.status === 'PEDIDO') countPedido++
      if (po.status === 'PEDIDO INCOMPLETO') countPedidoIncompleto++
      if (po.status === 'SE COMPRA?') countSeCompra++
      if (po.status === 'RECIBIDO') countRecibido++
      if (po.status === 'RECIB.COMP.DIRECT') countRecibidoDirecto++
      if (isCostAuditError(po, ships)) countCostAuditErrors++
    })

    return {
      countSinOtTotal,
      countSinOtObras,
      countSinOtStock,
      porEmitirTotal: countPedir,
      countPedir,
      countCotizacionesTotal,
      countCotizar,
      countCotizaSol,
      countCotizacion,
      countCotizaAprob,
      expiredQuotes,
      enProveedorTotal: countPedido + countPedidoIncompleto,
      countPedido,
      countPedidoIncompleto,
      countSeCompra,
      recibidosTotal: countRecibido + countRecibidoDirecto,
      countRecibido,
      countRecibidoDirecto,
      costAuditErrors: countCostAuditErrors,
      countConciliados,
      newMaterialsCount
    }
  }, [purchaseOrders, ships])

  // Limpiar filtros
  function clearAllFilters() {
    setSearchQuery('')
    setFilterSupplier('TODOS')
    setFilterStatus('TODOS')
    setFilterFortnight('TODAS')
    setFilterChargeType('TODOS')
    setFilterNewOnly(false)
    setHideReconciled(false)
    setActiveKpiFilter(null)
  }

  const hasActiveFilters = Boolean(
    searchQuery.trim() ||
    filterSupplier !== 'TODOS' ||
    filterStatus !== 'TODOS' ||
    filterFortnight !== 'TODAS' ||
    filterChargeType !== 'TODOS' ||
    filterNewOnly ||
    hideReconciled ||
    activeKpiFilter !== null
  )

  function toggleKpiFilter(filterKey) {
    if (activeKpiFilter === filterKey) {
      setActiveKpiFilter(null)
      setFilterStatus('TODOS')
      setFilterSupplier('TODOS')
    } else {
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
    }
  }

  // Filtrado reactivo de pedidos
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (searchQuery.trim()) {
        const q = normalizeSearchText(searchQuery)
        const shp = ships.find((s) => s.id === po.ship_id)
        const wo = workOrders.find((w) => w.id === po.work_order_id)
        const sup = suppliers.find((s) => s.id === po.supplier_id)
        const orderDocs = documents.filter((d) => d.purchase_order_id === po.id || (d.work_order_id && d.work_order_id === po.work_order_id))

        const corpus = buildUniversalSearchCorpus(
          {
            ...po,
            ship_name: shp?.name || '',
            vessel_type: shp?.vessel_type || '',
            work_order_title: wo?.title || '',
            work_order_description: wo?.description || '',
            ot_number: wo?.ot_number || '',
            supplier_name: sup?.name || '',
            supplier_trade: sup?.trade || '',
            requested_by_name: po.requested_by_name || 'PAÑOL'
          },
          { documents: orderDocs }
        )

        if (!corpus.includes(q)) return false
      }

      if (activeKpiFilter === 'sin_ot') {
        if (po.work_order_id) return false
      } else if (activeKpiFilter === 'sin_ot_obras') {
        if (po.work_order_id || po.charge_type !== 'DIRECT') return false
      } else if (activeKpiFilter === 'sin_ot_stock') {
        if (po.work_order_id || po.charge_type === 'DIRECT') return false
      } else if (activeKpiFilter === 'por_emitir') {
        if (!['PEDIR', 'SOLICITUD'].includes(po.status)) return false
      } else if (activeKpiFilter === 'cotizaciones') {
        if (!['COTIZACION', 'COTIZAR', 'COTIZA.SOLICITUD', 'COTIZA.APROBADA'].includes(po.status)) return false
      } else if (activeKpiFilter === 'pedidos') {
        if (!['PEDIDO', 'PEDIDO INCOMPLETO'].includes(po.status)) return false
      } else if (activeKpiFilter === 'recibidos') {
        if (!['RECIBIDO', 'RECIB.COMP.DIRECT'].includes(po.status)) return false
      } else if (activeKpiFilter === 'conciliados') {
        if (!po.is_reconciled) return false
      } else if (activeKpiFilter === 'alta_materiales') {
        if (!po.is_new_material || po.no_catalog_required) return false
      } else if (activeKpiFilter === 'cost_audit') {
        if (!isCostAuditError(po, ships)) return false
      } else if (activeKpiFilter === 'gases') {
        const sup = suppliers.find((s) => s.id === po.supplier_id)
        if (!sup?.is_gas_supplier) return false
      }

      if (filterSupplier !== 'TODOS' && po.supplier_id !== filterSupplier) return false
      if (filterStatus !== 'TODOS' && po.status !== filterStatus && !(filterStatus === 'PEDIR' && po.status === 'SOLICITUD')) return false
      if (filterFortnight !== 'TODAS' && po.fortnight_period !== filterFortnight) return false
      if (filterChargeType !== 'TODOS' && po.charge_type !== filterChargeType) return false
      if (filterNewOnly && (!po.is_new_material || po.no_catalog_required)) return false
      if (hideReconciled && po.is_reconciled) return false

      return true
    })
  }, [purchaseOrders, searchQuery, filterSupplier, filterStatus, filterFortnight, filterChargeType, filterNewOnly, hideReconciled, activeKpiFilter, suppliers, ships, documents, workOrders])

  const computeFortnightFromDate = useCallback((dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return currentFortnight
    const parts = dateStr.split('-')
    if (parts.length < 3) return currentFortnight
    const q = parseInt(parts[2], 10) <= 15 ? 'Q1' : 'Q2'
    return `${parts[0]}-${parts[1]}-${q}`
  }, [currentFortnight])

  const spreadsheetColumns = useMemo(() => {
    const cols = [
      { key: 'charge_type', label: 'Destino', readOnly: false },
      { key: 'order_date', label: 'Fecha / Quincena', readOnly: false },
      {
        key: 'ship_id',
        label: 'Buque / OT',
        readOnly: false,
        getValue: (r) => {
          const shpName = ships.find((s) => s.id === r.ship_id)?.name || 'ASTILLERO'
          const woObj = workOrders.find((w) => w.id === r.work_order_id)
          return {
            ship_id: r.ship_id || null,
            work_order_id: r.work_order_id || null,
            charge_type: r.charge_type || 'DIRECT',
            label: `${shpName} / ${woObj?.ot_number || 'Sin OT'}`
          }
        }
      },
      { key: 'requested_by_name', label: 'Solicita', readOnly: false },
      { key: 'material_name_raw', label: 'Material', readOnly: false },
      { key: 'quantity', label: 'Cant.', readOnly: false }
    ]
    if (viewMode === 'completa') {
      cols.push(
        { key: 'supplier_quoted_price', label: '$/U Prov.', readOnly: false },
        { key: 'system_unit_price', label: '$/U Sist.', readOnly: true }
      )
    }
    cols.push(
      { key: 'supplier_id', label: 'Proveedor', readOnly: false },
      { key: 'status', label: 'Estado', readOnly: false },
      { key: 'urgency', label: 'Urg.', readOnly: false },
      { key: 'delivery_date', label: 'F. Entrega', readOnly: false }
    )
    return cols
  }, [viewMode, ships, workOrders])

  const handleSpreadsheetBatchUpdate = useCallback(async ({ colKey, newValue, targetIds, revertMap, isRevert }) => {
    if (isRevert && revertMap) {
      setPurchaseOrders((prev) =>
        prev.map((p) => {
          if (revertMap[p.id] !== undefined) {
            const oldVal = revertMap[p.id]
            if (colKey === 'ship_id' && oldVal && typeof oldVal === 'object') {
              return {
                ...p,
                ship_id: oldVal.ship_id ?? null,
                work_order_id: oldVal.work_order_id ?? null,
                charge_type: oldVal.charge_type || p.charge_type
              }
            }
            if (colKey === 'reconciliation' && oldVal && typeof oldVal === 'object') {
              return {
                ...p,
                is_reconciled: Boolean(oldVal.is_reconciled),
                invoice_number: oldVal.invoice_number ?? null,
                reconciled_at: oldVal.reconciled_at ?? null,
                reconciled_by: oldVal.reconciled_by ?? null
              }
            }
            if (colKey === 'freight' && oldVal && typeof oldVal === 'object') {
              return {
                ...p,
                freight_transport_name: oldVal.freight_transport_name ?? null,
                freight_request_date: oldVal.freight_request_date ?? null,
                freight_estimated_date: oldVal.freight_estimated_date ?? null
              }
            }
            if (colKey === 'supplier_helper' && oldVal && typeof oldVal === 'object') {
              return { ...p, ...oldVal }
            }
            if (colKey === 'order_date') {
              return { ...p, order_date: oldVal, fortnight_period: computeFortnightFromDate(oldVal) }
            }
            return { ...p, [colKey]: oldVal }
          }
          return p
        })
      )

      try {
        await Promise.all(
          Object.entries(revertMap).map(([id, oldVal]) => {
            let payload = { updated_at: new Date().toISOString() }
            if (colKey === 'ship_id' && oldVal && typeof oldVal === 'object') {
              payload.ship_id = oldVal.ship_id ?? null
              payload.work_order_id = oldVal.work_order_id ?? null
              if (oldVal.charge_type) payload.charge_type = oldVal.charge_type
            } else if (colKey === 'reconciliation' && oldVal && typeof oldVal === 'object') {
              payload.is_reconciled = Boolean(oldVal.is_reconciled)
              payload.invoice_number = oldVal.invoice_number ?? null
              payload.reconciled_at = oldVal.reconciled_at ?? null
              payload.reconciled_by = oldVal.reconciled_by ?? null
            } else if (colKey === 'supplier_helper' && oldVal && typeof oldVal === 'object') {
              payload = { ...payload, ...oldVal }
            } else if (colKey === 'freight' && oldVal && typeof oldVal === 'object') {
              payload.freight_transport_name = oldVal.freight_transport_name ?? null
              payload.freight_request_date = oldVal.freight_request_date ?? null
              payload.freight_estimated_date = oldVal.freight_estimated_date ?? null
            } else if (colKey === 'order_date') {
              payload.order_date = oldVal
              payload.fortnight_period = computeFortnightFromDate(oldVal)
            } else {
              payload[colKey] = oldVal
            }
            return supabase.from('purchase_orders').update(payload).eq('id', id)
          })
        )
      } catch (err) {
        console.error('Error al revertir en Supabase:', err)
        showFeedbackMsg('error', 'Error al revertir: ' + err.message)
        if (fetchData) fetchData()
      }
      return
    }

    if (targetIds && targetIds.length > 0) {
      const targetSet = new Set(targetIds)
      let dbPayload = { updated_at: new Date().toISOString() }

      if (colKey === 'ship_id' && newValue && typeof newValue === 'object') {
        dbPayload.ship_id = newValue.ship_id ?? null
        dbPayload.work_order_id = newValue.work_order_id ?? null
        if (newValue.charge_type) dbPayload.charge_type = newValue.charge_type
      } else if (colKey === 'reconciliation' && newValue && typeof newValue === 'object') {
        dbPayload.is_reconciled = Boolean(newValue.is_reconciled)
        dbPayload.invoice_number = newValue.invoice_number ?? null
        dbPayload.reconciled_at = newValue.reconciled_at ?? null
        dbPayload.reconciled_by = newValue.reconciled_by ?? null
      } else if (colKey === 'freight' && newValue && typeof newValue === 'object') {
        dbPayload.freight_transport_name = newValue.freight_transport_name ?? null
        dbPayload.freight_request_date = newValue.freight_request_date ?? null
        dbPayload.freight_estimated_date = newValue.freight_estimated_date ?? null
      } else if (colKey === 'order_date') {
        dbPayload.order_date = newValue
        dbPayload.fortnight_period = computeFortnightFromDate(newValue)
      } else if (colKey === 'material_name_raw') {
        dbPayload.material_name_raw = newValue
        dbPayload.unit_measure = deduceUnitMeasure(String(newValue || ''))
      } else if (colKey === 'charge_type') {
        dbPayload.charge_type = newValue
        if (newValue !== 'DIRECT') {
          dbPayload.work_order_id = null
        }
      } else {
        dbPayload[colKey] = newValue
      }

      setPurchaseOrders((prev) =>
        prev.map((p) => (targetSet.has(p.id) ? { ...p, ...dbPayload } : p))
      )

      try {
        const { error } = await supabase
          .from('purchase_orders')
          .update(dbPayload)
          .in('id', targetIds)
        if (error) throw error

        await auditService.logBatchPaste({
          sheetName: 'Compras · Pedidos',
          updatedCount: targetIds.length,
          colKeys: [colKey],
          rowIds: targetIds,
          moduleRoute: '/compras'
        })
      } catch (err) {
        console.error('Error en batch update de compras:', err)
        showFeedbackMsg('error', 'Error al actualizar en lote: ' + err.message)
        if (fetchData) fetchData()
      }
    }
  }, [fetchData, computeFortnightFromDate, setPurchaseOrders, showFeedbackMsg])

  const activateComprasCell = useCallback((po, colKey) => {
    if (!po) return
    if (colKey === 'ship_id') {
      const supName = suppliers.find((s) => s.id === po.supplier_id)?.name || po.requested_by_name || ''
      setShipPickerModal({
        isOpen: true,
        orderId: po.id,
        shipId: po.ship_id || '',
        workOrderId: po.work_order_id || '',
        chargeType: po.charge_type || 'DIRECT',
        contractorName: supName
      })
      return
    }
    if (colKey === 'urgency') {
      handleCycleUrgency(po.id, po.urgency || 'SIN_APURO')
      return
    }
    if (colKey === 'charge_type') {
      setInlineEdit({ orderId: po.id, field: 'charge_type', value: po.charge_type || 'DIRECT' })
      return
    }
    if (colKey === 'order_date') {
      setInlineEdit({ orderId: po.id, field: 'order_date', value: po.order_date || new Date().toISOString().split('T')[0] })
      return
    }
    if (colKey === 'delivery_date') {
      setInlineEdit({ orderId: po.id, field: 'delivery_date', value: po.delivery_date || new Date().toISOString().split('T')[0] })
      return
    }
    if (colKey === 'requested_by_name') {
      const shp = ships.find((s) => s.id === po.ship_id)
      const wo = workOrders.find((w) => w.id === po.work_order_id)
      setContractorPickerModal({
        isOpen: true,
        orderId: po.id,
        currentValue: po.requested_by_name || 'PAÑOL',
        shipName: shp?.name || 'ASTILLERO',
        workOrderTitle: wo ? (wo.ot_number ? `#${wo.ot_number} ${wo.title}` : wo.title) : '',
        isOtBlank: !po.work_order_id
      })
      return
    }
    if (colKey === 'material_name_raw') {
      setInlineEdit({
        orderId: po.id,
        field: 'material_name_raw',
        value: po.material_name_raw || '',
        obsValue: po.observations || ''
      })
      return
    }
    if (colKey === 'quantity') {
      setInlineEdit({ orderId: po.id, field: 'quantity', value: po.quantity || 1 })
      return
    }
    if (colKey === 'supplier_quoted_price') {
      setInlineEdit({ orderId: po.id, field: 'supplier_quoted_price', value: po.supplier_quoted_price || '' })
      return
    }
    if (colKey === 'supplier_id') {
      setInlineEdit({ orderId: po.id, field: 'supplier_id', value: po.supplier_id || '' })
    }
  }, [suppliers, ships, workOrders])

  const onPasteRowRef = useRef(null)

  const grid = useSpreadsheetGrid({
    rows: filteredOrders,
    columns: spreadsheetColumns,
    getRowId: (row) => row.id,
    storageKey: 'aloncar_grid_compras',
    onBatchUpdate: handleSpreadsheetBatchUpdate,
    onPasteRow: (args) => onPasteRowRef.current?.(args),
    onCellActivate: (row, colDef) => activateComprasCell(row, colDef.key),
    onFocusSearch: () => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    },
    canEditCell: (row, colKey, newValue) => {
      if (colKey === 'status' && newValue === 'PEDIDO INCOMPLETO') {
        showFeedbackMsg('error', 'El estado "PEDIDO INCOMPLETO" requiere recepción parcial individual con remito.')
        return false
      }
      return true
    },
    showFeedback: showFeedbackMsg
  })

  function getSpreadsheetCellProps(rowIndex, colKey) {
    const colIdx = spreadsheetColumns.findIndex((c) => c.key === colKey)
    if (colIdx === -1) return { className: '', renderHandle: false, domProps: {} }

    const isActive = grid.isCellActive(rowIndex, colIdx)
    const isSelected = grid.isCellSelected(rowIndex, colIdx)
    const isFillPreview = grid.isCellInFillPreview(rowIndex, colIdx)
    const renderHandle = grid.shouldRenderFillHandle(rowIndex, colIdx)

    return {
      renderHandle,
      domProps: {
        onClick: (e) => grid.handleCellClick(rowIndex, colIdx, e),
        onMouseDown: (e) => grid.handleCellMouseDown(rowIndex, colIdx, e),
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

  async function saveInlineEdit(orderId, field, newValue) {
    setInlineEdit({ orderId: null, field: null, value: '' })
    const targetOrder = purchaseOrders.find((p) => p.id === orderId)
    if (!targetOrder || targetOrder[field] === newValue) return

    if (grid?.pushUndoAction) {
      grid.pushUndoAction({
        colKey: field,
        colLabel: field,
        actionLabel: 'Edición en celda',
        previousValues: { [orderId]: targetOrder[field] },
        newValue,
        timestamp: Date.now()
      })
    }

    const extraFields = {}
    if (field === 'order_date') {
      extraFields.fortnight_period = computeFortnightFromDate(newValue)
    } else if (field === 'material_name_raw') {
      extraFields.unit_measure = deduceUnitMeasure(String(newValue || ''))
    } else if (field === 'charge_type' && newValue !== 'DIRECT') {
      extraFields.work_order_id = null
    }

    setPurchaseOrders((prev) =>
      prev.map((p) => (p.id === orderId ? { ...p, [field]: newValue, ...extraFields } : p))
    )

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ [field]: newValue, ...extraFields, updated_at: new Date().toISOString() })
        .eq('id', orderId)
      if (error) throw error

      await auditService.logCellChange({
        sheetName: 'Compras · Pedidos',
        rowId: orderId,
        colKey: field,
        colLabel: field,
        oldValue: targetOrder[field],
        newValue,
        entityName: targetOrder.material_name_raw,
        moduleRoute: '/compras'
      })

      showFeedbackMsg('success', 'Campo actualizado correctamente.')
    } catch (err) {
      console.error('Error guardando edición rápida:', err)
      showFeedbackMsg('error', 'Error al guardar: ' + err.message)
      setPurchaseOrders((prev) =>
        prev.map((p) => (p.id === orderId ? targetOrder : p))
      )
    }
  }

  async function saveInlineMaterialAndObs(orderId, materialName, observations) {
    setInlineEdit({ orderId: null, field: null, value: '', obsValue: '' })
    const targetOrder = purchaseOrders.find((p) => p.id === orderId)
    if (!targetOrder) return

    const newMaterial = (materialName || '').trim()
    const newObs = observations !== undefined ? (observations || '').trim() : (targetOrder.observations || '')
    const newUnit = deduceUnitMeasure(newMaterial)

    grid.pushUndoAction([
      {
        rowId: orderId,
        colId: 'material_name_raw',
        oldValue: targetOrder.material_name_raw,
        newValue: newMaterial
      },
      {
        rowId: orderId,
        colId: 'observations',
        oldValue: targetOrder.observations || null,
        newValue: newObs || null
      }
    ])

    const updates = {
      material_name_raw: newMaterial,
      unit_measure: newUnit,
      observations: newObs || null
    }

    setPurchaseOrders((prev) =>
      prev.map((p) => (p.id === orderId ? { ...p, ...updates } : p))
    )

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', orderId)
      if (error) throw error

      await auditService.logCellChange({
        sheetName: 'Compras · Pedidos',
        rowId: orderId,
        colKey: 'material_name_raw',
        colLabel: 'Material',
        oldValue: targetOrder.material_name_raw,
        newValue: newMaterial,
        entityName: newMaterial,
        moduleRoute: '/compras'
      })

      showFeedbackMsg('success', 'Material y observaciones guardados.')
    } catch (err) {
      console.error('Error guardando material y observaciones:', err)
      showFeedbackMsg('error', 'Error al guardar: ' + err.message)
      setPurchaseOrders((prev) =>
        prev.map((p) => (p.id === orderId ? targetOrder : p))
      )
    }
  }

  async function handleCycleUrgency(orderId, currentUrgency) {
    const cycle = {
      'SIN_APURO': 'URGENTE',
      'URGENTE': 'PROXIMA_SALIDA',
      'PROXIMA_SALIDA': 'SIN_APURO'
    }
    const nextUrgency = cycle[currentUrgency] || 'SIN_APURO'
    await saveInlineEdit(orderId, 'urgency', nextUrgency)
  }

  async function handleAddNewBlankOrder() {
    const todayStr = new Date().toISOString().split('T')[0]
    const fortnight = computeFortnightFromDate(todayStr)
    const defaultUser = profile?.full_name || user?.email?.split('@')[0] || 'PAÑOL'

    const astShip = ships.find((s) => (s.name || '').toUpperCase().includes('ASTILLERO'))
    const newOrderPayload = {
      order_date: todayStr,
      fortnight_period: fortnight,
      status: 'PEDIR',
      urgency: 'SIN_APURO',
      charge_type: 'VIA_PANOL',
      ship_id: astShip?.id || null,
      work_order_id: null,
      supplier_id: null,
      requested_by_name: defaultUser,
      material_name_raw: '',
      quantity: 1,
      unit_measure: 'unidad',
      supplier_quoted_price: null,
      system_unit_price: null,
      observations: null,
      is_new_material: true,
      no_catalog_required: false
    }

    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert([newOrderPayload])
        .select()
        .single()
      if (error) throw error

      setPurchaseOrders((prev) => [...prev, data])

      grid.pushUndoAction({
        actionLabel: 'Crear fila rápida',
        undoFn: async () => {
          await supabase.from('purchase_orders').delete().eq('id', data.id)
          setPurchaseOrders((prev) => prev.filter((p) => p.id !== data.id))
        },
        redoFn: async () => {
          await supabase.from('purchase_orders').insert([data])
          setPurchaseOrders((prev) => [...prev, data])
        }
      })

      await auditService.logRowAction({
        action: 'CREATE',
        entityType: 'purchase_orders',
        entityId: data.id,
        entityName: 'Fila rápida en blanco',
        sheetName: 'Compras · Pedidos',
        moduleRoute: '/compras',
        details: { newOrder: data }
      })

      showFeedbackMsg('success', 'Nuevo pedido rápido insertado al pie. Escribe el material directamente.')
      setTimeout(() => {
        setInlineEdit({
          orderId: data.id,
          field: 'material_name_raw',
          value: '',
          obsValue: ''
        })
      }, 50)
    } catch (err) {
      console.error('Error creando pedido rápido:', err)
      showFeedbackMsg('error', 'Error al insertar pedido: ' + err.message)
    }
  }

  async function handleInsertOrderContext(referenceOrder, rowIndex, position = 'below') {
    if (!referenceOrder) return
    const refDate = referenceOrder.order_date || new Date().toISOString().split('T')[0]
    const fortnight = referenceOrder.fortnight_period || computeFortnightFromDate(refDate)

    const refTime = new Date(referenceOrder.created_at || Date.now()).getTime()
    let newTime
    if (position === 'below') {
      const nextOrder = filteredOrders[rowIndex + 1]
      if (nextOrder && nextOrder.created_at) {
        const nextTime = new Date(nextOrder.created_at).getTime()
        newTime = Math.round((refTime + nextTime) / 2)
        if (newTime >= refTime || newTime <= nextTime) {
          newTime = refTime - 1000
        }
      } else {
        newTime = refTime - 1000
      }
    } else {
      const prevOrder = filteredOrders[rowIndex - 1]
      if (prevOrder && prevOrder.created_at) {
        const prevTime = new Date(prevOrder.created_at).getTime()
        newTime = Math.round((refTime + prevTime) / 2)
        if (newTime <= refTime || newTime >= prevTime) {
          newTime = refTime + 1000
        }
      } else {
        newTime = refTime + 1000
      }
    }

    const newOrderPayload = {
      order_date: refDate,
      fortnight_period: fortnight,
      status: referenceOrder.status || 'PEDIR',
      urgency: referenceOrder.urgency || 'SIN_APURO',
      charge_type: referenceOrder.charge_type || 'VIA_PANOL',
      ship_id: referenceOrder.ship_id || null,
      work_order_id: referenceOrder.work_order_id || null,
      supplier_id: referenceOrder.supplier_id || null,
      requested_by_name: referenceOrder.requested_by_name || 'PAÑOL',
      material_name_raw: '',
      quantity: 1,
      unit_measure: 'unidad',
      supplier_quoted_price: null,
      system_unit_price: null,
      observations: null,
      is_new_material: true,
      no_catalog_required: false,
      created_at: new Date(newTime).toISOString()
    }

    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert([newOrderPayload])
        .select()
        .single()
      if (error) throw error

      setPurchaseOrders((prev) => {
        const refIdxInAll = prev.findIndex((p) => p.id === referenceOrder.id)
        const targetAllIndex =
          refIdxInAll !== -1
            ? position === 'below'
              ? refIdxInAll + 1
              : refIdxInAll
            : prev.length
        const copy = [...prev]
        copy.splice(targetAllIndex, 0, data)
        return copy
      })

      grid.pushUndoAction({
        actionLabel: 'Insertar fila contigua',
        undoFn: async () => {
          await supabase.from('purchase_orders').delete().eq('id', data.id)
          setPurchaseOrders((prev) => prev.filter((p) => p.id !== data.id))
        },
        redoFn: async () => {
          await supabase.from('purchase_orders').insert([data])
          setPurchaseOrders((prev) => {
            const refIdx = prev.findIndex((p) => p.id === referenceOrder.id)
            const targetIdx =
              refIdx !== -1
                ? position === 'below'
                  ? refIdx + 1
                  : refIdx
                : prev.length
            const copy = [...prev]
            copy.splice(targetIdx, 0, data)
            return copy
          })
        }
      })

      await auditService.logRowAction({
        action: 'CREATE',
        entityType: 'purchase_orders',
        entityId: data.id,
        entityName: 'Fila contigua',
        sheetName: 'Compras · Pedidos',
        moduleRoute: '/compras',
        details: { position, refId: referenceOrder.id }
      })

      showFeedbackMsg(
        'success',
        `Fila insertada ${position === 'below' ? 'debajo' : 'arriba'}. Escribe el material directamente.`
      )
      setTimeout(() => {
        setInlineEdit({
          orderId: data.id,
          field: 'material_name_raw',
          value: '',
          obsValue: ''
        })
      }, 50)
    } catch (err) {
      console.error('Error insertando fila contigua:', err)
      showFeedbackMsg('error', 'Error al insertar fila: ' + err.message)
    }
  }

  async function handleDuplicateOrder(order) {
    const todayStr = new Date().toISOString().split('T')[0]
    const fortnight = computeFortnightFromDate(todayStr)

    const duplicatedPayload = {
      order_date: todayStr,
      fortnight_period: fortnight,
      status: 'PEDIR',
      urgency: order.urgency || 'SIN_APURO',
      charge_type: order.charge_type || 'DIRECT',
      ship_id: order.ship_id || null,
      work_order_id: order.work_order_id || null,
      supplier_id: order.supplier_id || null,
      requested_by_name: order.requested_by_name || 'PAÑOL',
      material_name_raw: order.material_name_raw || '',
      material_id: order.material_id || null,
      quantity: order.quantity || 1,
      unit_measure: order.unit_measure || 'unidad',
      supplier_quoted_price: order.supplier_quoted_price || null,
      system_unit_price: order.system_unit_price || null,
      observations: order.observations || null,
      is_new_material: Boolean(order.is_new_material),
      no_catalog_required: Boolean(order.no_catalog_required)
    }

    try {
      const { data, error } = await supabase
        .from('purchase_orders')
        .insert([duplicatedPayload])
        .select()
        .single()
      if (error) throw error

      setPurchaseOrders((prev) => [...prev, data])

      grid.pushUndoAction({
        actionLabel: `Duplicar ${order.material_name_raw || 'pedido'}`,
        undoFn: async () => {
          await supabase.from('purchase_orders').delete().eq('id', data.id)
          setPurchaseOrders((prev) => prev.filter((p) => p.id !== data.id))
        },
        redoFn: async () => {
          await supabase.from('purchase_orders').insert([data])
          setPurchaseOrders((prev) => [...prev, data])
        }
      })

      await auditService.logRowAction({
        action: 'DUPLICATE',
        entityType: 'purchase_orders',
        entityId: data.id,
        entityName: order.material_name_raw,
        sheetName: 'Compras · Pedidos',
        moduleRoute: '/compras',
        details: { sourceOrderId: order.id }
      })

      showFeedbackMsg('success', `Pedido "${order.material_name_raw || 'S/D'}" duplicado al final con fecha de hoy.`)
    } catch (err) {
      console.error('Error duplicando pedido:', err)
      showFeedbackMsg('error', 'Error al duplicar pedido: ' + err.message)
    }
  }

  const handlePasteRow = useCallback(async ({ sourceRow, targetRow }) => {
    if (!sourceRow || !targetRow || sourceRow.id === targetRow.id) return
    const fieldsToCopy = {
      ship_id: sourceRow.ship_id,
      work_order_id: sourceRow.work_order_id,
      charge_type: sourceRow.charge_type,
      requested_by_name: sourceRow.requested_by_name,
      material_name_raw: sourceRow.material_name_raw,
      material_id: sourceRow.material_id,
      quantity: sourceRow.quantity,
      unit_measure: sourceRow.unit_measure,
      supplier_quoted_price: sourceRow.supplier_quoted_price,
      system_unit_price: sourceRow.system_unit_price,
      supplier_id: sourceRow.supplier_id,
      urgency: sourceRow.urgency,
      observations: sourceRow.observations
    }

    const previousValues = {
      ship_id: targetRow.ship_id,
      work_order_id: targetRow.work_order_id,
      charge_type: targetRow.charge_type,
      requested_by_name: targetRow.requested_by_name,
      material_name_raw: targetRow.material_name_raw,
      material_id: targetRow.material_id,
      quantity: targetRow.quantity,
      unit_measure: targetRow.unit_measure,
      supplier_quoted_price: targetRow.supplier_quoted_price,
      system_unit_price: targetRow.system_unit_price,
      supplier_id: targetRow.supplier_id,
      urgency: targetRow.urgency,
      observations: targetRow.observations
    }

    grid.pushUndoAction({
      actionLabel: 'Pegar fila completa',
      undoFn: async () => {
        await supabase.from('purchase_orders').update(previousValues).eq('id', targetRow.id)
        setPurchaseOrders((prev) => prev.map((p) => (p.id === targetRow.id ? { ...p, ...previousValues } : p)))
      },
      redoFn: async () => {
        await supabase.from('purchase_orders').update(fieldsToCopy).eq('id', targetRow.id)
        setPurchaseOrders((prev) => prev.map((p) => (p.id === targetRow.id ? { ...p, ...fieldsToCopy } : p)))
      }
    })

    setPurchaseOrders((prev) =>
      prev.map((p) => (p.id === targetRow.id ? { ...p, ...fieldsToCopy } : p))
    )

    try {
      await supabase.from('purchase_orders').update({ ...fieldsToCopy, updated_at: new Date().toISOString() }).eq('id', targetRow.id)
      await auditService.logRowAction({
        action: 'PASTE_ROW',
        entityType: 'purchase_orders',
        entityId: targetRow.id,
        entityName: targetRow.material_name_raw,
        sheetName: 'Compras · Pedidos',
        moduleRoute: '/compras',
        details: { sourceId: sourceRow.id }
      })
      showFeedbackMsg('success', `Datos copiados en fila ${targetRow.material_name_raw || 'vacía'}.`)
    } catch (err) {
      console.error('Error al pegar fila:', err)
      showFeedbackMsg('error', 'Error al pegar fila: ' + err.message)
      setPurchaseOrders((prev) => prev.map((p) => (p.id === targetRow.id ? { ...p, ...previousValues } : p)))
    }
  }, [grid, setPurchaseOrders, showFeedbackMsg])

  useEffect(() => {
    onPasteRowRef.current = handlePasteRow
  }, [handlePasteRow])

  async function handleBatchDismissCatalogAlta() {
    if (selectedOrderIds.size === 0) return
    try {
      const idsArray = Array.from(selectedOrderIds)
      const previousValues = {}
      idsArray.forEach((id) => {
        const po = purchaseOrders.find((p) => p.id === id)
        previousValues[id] = Boolean(po?.no_catalog_required)
      })

      const { error } = await supabase
        .from('purchase_orders')
        .update({ no_catalog_required: true, updated_at: new Date().toISOString() })
        .in('id', idsArray)
      if (error) throw error

      if (grid?.pushUndoAction) {
        grid.pushUndoAction({
          colKey: 'no_catalog_required',
          colLabel: 'NO requiere alta en catálogo',
          actionLabel: 'Omitir Alta Catálogo',
          previousValues,
          newValue: true,
          timestamp: Date.now()
        })
      }

      setPurchaseOrders((prev) =>
        prev.map((p) => (selectedOrderIds.has(p.id) ? { ...p, no_catalog_required: true } : p))
      )
      showFeedbackMsg('success', `Se marcó "NO requiere alta en catálogo" para ${idsArray.length} pedido(s). (Ctrl+Z para deshacer)`)
      setSelectedOrderIds(new Set())
    } catch (err) {
      console.error('Error omitiendo alta en lote:', err)
      showFeedbackMsg('error', 'Error al omitir alta: ' + err.message)
    }
  }

  async function handleApplySupplierHelper(orderId, updates) {
    const target = purchaseOrders.find((p) => p.id === orderId)
    if (!target) return

    const previousValues = {
      [orderId]: {
        supplier_id: target.supplier_id,
        supplier_quoted_price: target.supplier_quoted_price,
        system_unit_price: target.system_unit_price,
        order_date: target.order_date,
        fortnight_period: target.fortnight_period,
        status: target.status
      }
    }

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', orderId)
      if (error) throw error

      if (grid?.pushUndoAction) {
        grid.pushUndoAction({
          colKey: 'supplier_helper',
          colLabel: 'Asistente de Proveedor',
          actionLabel: 'Asignar Proveedor Sugerido',
          previousValues,
          newValue: updates,
          timestamp: Date.now()
        })
      }

      setPurchaseOrders((prev) =>
        prev.map((p) => (p.id === orderId ? { ...p, ...updates } : p))
      )

      const supName = suppliers.find((s) => s.id === updates.supplier_id)?.name || 'Proveedor'
      await auditService.logCellChange({
        sheetName: 'Compras · Pedidos',
        rowId: orderId,
        colKey: 'supplier_id',
        colLabel: 'Proveedor',
        oldValue: target.supplier_id,
        newValue: supName,
        entityName: target.material_name_raw,
        moduleRoute: '/compras'
      })

      showFeedbackMsg('success', `Proveedor "${supName}" y condiciones asignadas con éxito. (Ctrl+Z para deshacer)`)
      setShowSupplierHelperModal(false)
      setSupplierHelperTarget(null)
    } catch (err) {
      console.error('Error aplicando asistente de proveedor:', err)
      showFeedbackMsg('error', 'Error al asignar proveedor: ' + err.message)
    }
  }

  const localPendingCount = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (!['PEDIDO', 'PEDIDO INCOMPLETO'].includes(po.status)) return false
      const sup = suppliers.find((s) => s.id === po.supplier_id)
      return Boolean(sup?.is_local_supplier)
    }).length
  }, [purchaseOrders, suppliers])

  const isAllFilteredSelected = filteredOrders.length > 0 && filteredOrders.every((o) => selectedOrderIds.has(o.id))

  function toggleSelectAll() {
    if (isAllFilteredSelected) {
      setSelectedOrderIds(new Set())
    } else {
      const next = new Set(selectedOrderIds)
      filteredOrders.forEach((o) => next.add(o.id))
      setSelectedOrderIds(next)
    }
  }

  function toggleSelectRow(id) {
    const next = new Set(selectedOrderIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    setSelectedOrderIds(next)
  }

  async function handleQuickStatusChange(orderId, newStatus) {
    try {
      const order = purchaseOrders.find((p) => p.id === orderId)
      if (!order) return

      if (newStatus === 'PEDIDO INCOMPLETO') {
        setPartialDeliveryOrder(order)
        setShowPartialModal(true)
        return
      }

      if (newStatus === 'SE COMPRA?') {
        const updates = { status: 'SE COMPRA?', updated_at: new Date().toISOString() }
        await supabase.from('purchase_orders').update(updates).eq('id', orderId)
        setPurchaseOrders((prev) => prev.map((p) => (p.id === orderId ? { ...p, ...updates } : p)))
        setSeCompraAlertOrder({ ...order, status: 'SE COMPRA?' })
        setShowSeCompraModal(true)
        showFeedbackMsg('success', 'Marcado como "SE COMPRA?". Abriendo panel de alerta gerencial...')
        return
      }

      const updates = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }

      if (newStatus === 'RECIBIDO' && order.charge_type === 'VIA_PANOL' && order.material_id) {
        const mat = materials.find((m) => m.id === order.material_id)
        if (mat) {
          const newStock = (mat.current_stock || 0) + Number(order.quantity)
          await supabase.from('materials').update({ current_stock: newStock }).eq('id', mat.id)
          setMaterials((prev) => prev.map((m) => (m.id === mat.id ? { ...m, current_stock: newStock } : m)))
        }
      }

      if (grid?.pushUndoAction) {
        grid.pushUndoAction({
          colKey: 'status',
          colLabel: 'Estado',
          actionLabel: 'Cambio de estado',
          previousValues: { [orderId]: order.status },
          newValue: newStatus,
          timestamp: Date.now()
        })
      }

      const { error } = await supabase.from('purchase_orders').update(updates).eq('id', orderId)
      if (error) throw error

      await auditService.logCellChange({
        sheetName: 'Compras · Pedidos',
        rowId: orderId,
        colKey: 'status',
        colLabel: 'Estado',
        oldValue: order.status,
        newValue: newStatus,
        entityName: order.material_name_raw,
        moduleRoute: '/compras'
      })

      setPurchaseOrders((prev) => prev.map((p) => (p.id === orderId ? { ...p, ...updates } : p)))
      showFeedbackMsg('success', `Estado actualizado a "${newStatus}"`)
    } catch (err) {
      console.error('Error cambiando estado:', err)
      showFeedbackMsg('error', 'Error al actualizar estado: ' + err.message)
    }
  }

  async function handleDeleteOrder(id) {
    if (!confirm('¿Estás seguro de eliminar este registro de compra?')) return
    try {
      const orderToDelete = purchaseOrders.find(p => p.id === id)
      const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
      if (error) throw error

      await auditService.logRowAction({
        action: 'DELETE',
        entityType: 'purchase_orders',
        entityId: id,
        entityName: orderToDelete?.material_name_raw || 'Pedido',
        sheetName: 'Compras · Pedidos',
        moduleRoute: '/compras'
      })

      setPurchaseOrders((prev) => prev.filter((p) => p.id !== id))
      if (selectedOrderIds.has(id)) {
        const next = new Set(selectedOrderIds)
        next.delete(id)
        setSelectedOrderIds(next)
      }
      showFeedbackMsg('success', 'Registro eliminado correctamente.')
    } catch (err) {
      console.error('Error eliminando compra:', err)
      showFeedbackMsg('error', 'Error al eliminar: ' + err.message)
    }
  }

  async function handleBatchStatusApply() {
    if (selectedOrderIds.size === 0) return
    const ids = Array.from(selectedOrderIds)
    const targetStatus = batchTargetStatus

    let convertToDirect = false
    if (targetStatus === 'RECIB.COMP.DIRECT') {
      const nonDirectOrders = ids
        .map((id) => purchaseOrders.find((p) => p.id === id))
        .filter((p) => p && p.charge_type !== 'DIRECT')
      if (nonDirectOrders.length > 0) {
        if (
          confirm(
            `Hay ${nonDirectOrders.length} pedido(s) con destino "PAÑOL". Para cumplir la regla de auditoría de Costo Directo, ¿deseas cambiar automáticamente su destino a "DIRECTO"?`
          )
        ) {
          convertToDirect = true
        }
      }
    }

    const previousValues = {}
    ids.forEach((id) => {
      const po = purchaseOrders.find((p) => p.id === id)
      if (po) {
        previousValues[id] = {
          status: po.status,
          charge_type: po.charge_type
        }
      }
    })

    const dbPayload = {
      status: targetStatus,
      updated_at: new Date().toISOString()
    }
    if (convertToDirect) {
      dbPayload.charge_type = 'DIRECT'
    }

    try {
      const { error } = await supabase
        .from('purchase_orders')
        .update(dbPayload)
        .in('id', ids)
      if (error) throw error

      if (grid?.pushUndoAction) {
        grid.pushUndoAction({
          colKey: 'status',
          colLabel: 'Estado en bloque',
          actionLabel: `Cambio masivo a ${targetStatus}`,
          previousValues,
          newValue: dbPayload,
          timestamp: Date.now()
        })
      }

      await auditService.logBatchPaste({
        sheetName: 'Compras · Pedidos',
        updatedCount: ids.length,
        colKeys: ['status'],
        rowIds: ids,
        moduleRoute: '/compras'
      })

      setPurchaseOrders((prev) =>
        prev.map((p) => (ids.includes(p.id) ? { ...p, ...dbPayload } : p))
      )
      setSelectedOrderIds(new Set())
      showFeedbackMsg(
        'success',
        `Se cambió el estado a "${targetStatus}" en ${ids.length} pedidos. (Ctrl+Z para deshacer)`
      )
    } catch (err) {
      console.error('Error en cambio de estado masivo:', err)
      showFeedbackMsg('error', 'Error en cambio de estado: ' + err.message)
    }
  }

  // Estadísticas reactivas inferiores
  const stats = useMemo(() => {
    const isCustom = selectedOrderIds.size > 0
    const targetList = isCustom ? purchaseOrders.filter((p) => selectedOrderIds.has(p.id)) : filteredOrders

    let sumQty = 0
    let sumCostArs = 0
    let sumCostUsd = 0

    targetList.forEach((po) => {
      const qty = Number(po.quantity) || 0
      const priceArs = Number(po.supplier_quoted_price || po.system_unit_price) || 0
      const rate = getDollarRateForDate(po.order_date)

      sumQty += qty
      sumCostArs += qty * priceArs
      sumCostUsd += (qty * priceArs) / rate
    })

    const count = targetList.length
    const avgPriceArs = count > 0 ? sumCostArs / count : 0

    return {
      isCustomSelection: isCustom,
      count,
      sumQty,
      sumCostArs,
      sumCostUsd,
      avgPriceArs,
      targetList
    }
  }, [selectedOrderIds, filteredOrders, purchaseOrders, getDollarRateForDate])

  return (
    <>
      {/* ZONA 2: RADAR DE KPIS Y ALERTAS OPERATIVAS */}
      <div className="alon-zone-kpis py-2.5 px-3 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="text-sm md:text-base font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              📊 RADAR DE KPIS Y ALERTAS OPERATIVAS
            </span>
            <span className="text-[11px] italic text-slate-400 font-normal">
              • Clic en cualquier tarjeta para filtrar
            </span>
          </div>
          {activeKpiFilter && (
            <button
              type="button"
              onClick={() => setActiveKpiFilter(null)}
              className="text-[10px] font-bold text-amber-300 hover:text-white bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded cursor-pointer"
            >
              ✕ Quitar Filtro KPI
            </button>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
          {/* KPI 0: Falta Cargar OT */}
          <div
            onClick={() => toggleKpiFilter('sin_ot')}
            className={`py-2 px-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
              activeKpiFilter === 'sin_ot' || activeKpiFilter === 'sin_ot_obras' || activeKpiFilter === 'sin_ot_stock'
                ? 'bg-orange-950/85 border-orange-400 ring-1 ring-orange-400/50 shadow-lg shadow-orange-500/20'
                : 'bg-orange-950/25 border-orange-500/40 hover:border-orange-400/70'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13px] xl:text-[14px] font-black text-orange-300 leading-tight tracking-tight">
                Falta OT
              </span>
              <span className="text-lg font-black text-orange-400 font-mono leading-none">{kpis.countSinOtTotal}</span>
            </div>
            <div className="flex items-center gap-1 mt-1.5 pt-1 border-t border-orange-900/50">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleKpiFilter('sin_ot_obras'); }}
                className={`px-1 py-0.5 rounded text-[9px] font-bold transition-colors cursor-pointer ${
                  activeKpiFilter === 'sin_ot_obras' ? 'bg-orange-500 text-slate-950 font-black' : 'bg-orange-500/15 text-orange-200 hover:bg-orange-500/30'
                }`}
                title="Pedidos imputados a buque/obra sin OT vinculada"
              >
                🚢 {kpis.countSinOtObras}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleKpiFilter('sin_ot_stock'); }}
                className={`px-1 py-0.5 rounded text-[9px] font-bold transition-colors cursor-pointer ${
                  activeKpiFilter === 'sin_ot_stock' ? 'bg-orange-400 text-slate-950 font-black' : 'bg-orange-500/15 text-orange-200 hover:bg-orange-500/30'
                }`}
                title="Pedidos para Astillero / Stock general sin OT vinculada"
              >
                🏢 {kpis.countSinOtStock}
              </button>
            </div>
          </div>

          {/* KPI 1: Por Emitir */}
          <div
            onClick={() => toggleKpiFilter('por_emitir')}
            className={`py-2 px-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
              activeKpiFilter === 'por_emitir' || activeKpiFilter === 'PEDIR'
                ? 'bg-amber-950/85 border-amber-400 ring-1 ring-amber-400/50 shadow-lg shadow-amber-500/20'
                : 'bg-amber-950/25 border-amber-500/40 hover:border-amber-400/70'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13px] xl:text-[14px] font-black text-amber-300 leading-tight tracking-tight">
                1. Por Emitir
              </span>
              <span className="text-lg font-black text-amber-400 font-mono leading-none">{kpis.porEmitirTotal}</span>
            </div>
            <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-amber-900/50 text-[9px]">
              <span className="text-amber-200/80 font-semibold">Estado: PEDIR</span>
              {activeKpiFilter === 'por_emitir' && (
                <span className="px-1 rounded bg-amber-400 text-slate-950 font-black text-[8px]">ACTIVO</span>
              )}
            </div>
          </div>

          {/* KPI 2: Cotizaciones */}
          <div
            onClick={() => toggleKpiFilter('cotizaciones')}
            className={`py-2 px-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
              activeKpiFilter === 'cotizaciones' || ['COTIZAR', 'COTIZA.SOLICITUD', 'COTIZACION', 'COTIZA.APROBADA'].includes(activeKpiFilter)
                ? 'bg-purple-950/85 border-purple-400 ring-1 ring-purple-400/50 shadow-lg shadow-purple-500/20'
                : 'bg-purple-950/25 border-purple-500/40 hover:border-purple-400/70'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13px] xl:text-[14px] font-black text-purple-300 leading-tight tracking-tight">
                2. Cotizac.
              </span>
              <span className="text-lg font-black text-purple-400 font-mono leading-none">{kpis.countCotizacionesTotal}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1 mt-1.5 pt-1 border-t border-purple-900/50">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleKpiFilter('COTIZAR'); }}
                className={`px-1 py-0.2 rounded text-[8px] font-bold cursor-pointer ${
                  activeKpiFilter === 'COTIZAR' ? 'bg-indigo-500 text-white' : 'bg-purple-500/15 text-purple-200 hover:bg-purple-500/30'
                }`}
                title="COTIZAR (A Pedir Precio)"
              >
                COT:{kpis.countCotizar}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleKpiFilter('COTIZA.SOLICITUD'); }}
                className={`px-1 py-0.2 rounded text-[8px] font-bold cursor-pointer ${
                  activeKpiFilter === 'COTIZA.SOLICITUD' ? 'bg-yellow-500 text-slate-950' : 'bg-purple-500/15 text-purple-200 hover:bg-purple-500/30'
                }`}
                title="COTIZA.SOLICITUD (Esperando)"
              >
                SOL:{kpis.countCotizaSol}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleKpiFilter('COTIZACION'); }}
                className={`px-1 py-0.2 rounded text-[8px] font-bold cursor-pointer ${
                  activeKpiFilter === 'COTIZACION' ? 'bg-purple-400 text-slate-950' : 'bg-purple-500/15 text-purple-200 hover:bg-purple-500/30'
                }`}
                title="COTIZACION (En Evaluación)"
              >
                EV:{kpis.countCotizacion}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleKpiFilter('COTIZA.APROBADA'); }}
                className={`px-1 py-0.2 rounded text-[8px] font-bold cursor-pointer ${
                  activeKpiFilter === 'COTIZA.APROBADA' ? 'bg-emerald-500 text-slate-950' : 'bg-purple-500/15 text-purple-200 hover:bg-purple-500/30'
                }`}
                title="COTIZA.APROBADA (Aprobada)"
              >
                OK:{kpis.countCotizaAprob}
              </button>
            </div>
          </div>

          {/* KPI 3: En Proveedor */}
          <div
            onClick={() => toggleKpiFilter('pedidos')}
            className={`py-2 px-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
              activeKpiFilter === 'pedidos' || activeKpiFilter === 'PEDIDO' || activeKpiFilter === 'PEDIDO INCOMPLETO'
                ? 'bg-blue-950/85 border-blue-400 ring-1 ring-blue-400/50 shadow-lg shadow-blue-500/20'
                : 'bg-blue-950/25 border-blue-500/40 hover:border-blue-400/70'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13px] xl:text-[14px] font-black text-blue-300 leading-tight tracking-tight">
                3. En Prov.
              </span>
              <span className="text-lg font-black text-blue-400 font-mono leading-none">{kpis.enProveedorTotal}</span>
            </div>
            <div className="flex items-center justify-between gap-1 mt-1.5 pt-1 border-t border-blue-900/50">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleKpiFilter('PEDIDO'); }}
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold transition-colors cursor-pointer ${
                  activeKpiFilter === 'PEDIDO' ? 'bg-blue-500 text-slate-950 font-black' : 'bg-blue-500/15 text-blue-200 hover:bg-blue-500/30'
                }`}
              >
                PED: {kpis.countPedido}
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleKpiFilter('PEDIDO INCOMPLETO'); }}
                className={`px-1.5 py-0.2 rounded text-[9px] font-bold transition-colors cursor-pointer ${
                  activeKpiFilter === 'PEDIDO INCOMPLETO'
                    ? 'bg-orange-500 text-slate-950 font-black'
                    : kpis.countPedidoIncompleto > 0
                    ? 'bg-orange-500/25 text-orange-300 border border-orange-500/40 animate-pulse'
                    : 'bg-blue-950 text-blue-300/70'
                }`}
                title="Recepción parcial / Saldo faltante a reclamar"
              >
                Inc.: {kpis.countPedidoIncompleto}
              </button>
            </div>
          </div>

          {/* KPI 4: SE COMPRA? */}
          <div
            onClick={() => toggleKpiFilter('SE COMPRA?')}
            className={`py-2 px-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
              activeKpiFilter === 'SE COMPRA?'
                ? 'bg-fuchsia-950/85 border-fuchsia-400 ring-1 ring-fuchsia-400/50 shadow-lg shadow-fuchsia-500/20'
                : 'bg-fuchsia-950/25 border-fuchsia-500/40 hover:border-fuchsia-400/70'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13px] xl:text-[14px] font-black text-fuchsia-300 leading-tight tracking-tight">
                4. Se Compra?
              </span>
              <span className={`text-lg font-black font-mono leading-none ${kpis.countSeCompra > 0 ? 'text-fuchsia-400 animate-pulse' : 'text-fuchsia-400/60'}`}>
                {kpis.countSeCompra}
              </span>
            </div>
            <div className="mt-1.5 pt-1 border-t border-fuchsia-900/50 text-[9px] text-fuchsia-200/80 flex items-center justify-between">
              <span className="truncate">Evaluación Gerencia</span>
              {activeKpiFilter === 'SE COMPRA?' && (
                <span className="px-1 rounded bg-fuchsia-400 text-slate-950 font-black text-[8px]">ACTIVO</span>
              )}
            </div>
          </div>

          {/* KPI 5: Alta en Catálogo */}
          <div
            onClick={() => toggleKpiFilter('alta_materiales')}
            className={`py-2 px-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
              activeKpiFilter === 'alta_materiales'
                ? 'bg-rose-950/85 border-rose-400 ring-1 ring-rose-400/50 shadow-lg shadow-rose-500/20'
                : 'bg-rose-950/25 border-rose-500/40 hover:border-rose-400/70'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13px] xl:text-[14px] font-black text-rose-300 leading-tight tracking-tight">
                5. Alta Catál.
              </span>
              <span className={`text-lg font-black font-mono leading-none ${kpis.newMaterialsCount > 0 ? 'text-rose-400' : 'text-rose-400/60'}`}>
                {kpis.newMaterialsCount}
              </span>
            </div>
            <div className="mt-1.5 pt-1 border-t border-rose-900/50 text-[9px] text-rose-200/80 flex items-center justify-between">
              <span className="truncate">Nuevos s/registro</span>
              {activeKpiFilter === 'alta_materiales' && (
                <span className="px-1 rounded bg-rose-400 text-slate-950 font-black text-[8px]">ACTIVO</span>
              )}
            </div>
          </div>

          {/* KPI 6: Recibidos */}
          <div
            onClick={() => toggleKpiFilter('recibidos')}
            className={`py-2 px-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
              activeKpiFilter === 'recibidos' || activeKpiFilter === 'conciliados'
                ? 'bg-emerald-950/85 border-emerald-400 ring-1 ring-emerald-400/50 shadow-lg shadow-emerald-500/20'
                : 'bg-emerald-950/25 border-emerald-500/40 hover:border-emerald-400/70'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[13px] xl:text-[14px] font-black text-emerald-300 leading-tight tracking-tight">
                6. Recibidos
              </span>
              <span className="text-lg font-black text-emerald-400 font-mono leading-none">{kpis.recibidosTotal}</span>
            </div>
            <div className="flex items-center justify-between gap-1 mt-1.5 pt-1 border-t border-emerald-900/50 text-[9px] font-mono">
              <span className="text-emerald-200/80 truncate">P:{kpis.countRecibido} | Ob:{kpis.countRecibidoDirecto}</span>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); toggleKpiFilter('conciliados'); }}
                className={`px-1 py-0.2 rounded text-[8px] font-bold shrink-0 cursor-pointer ${
                  activeKpiFilter === 'conciliados' ? 'bg-purple-500 text-white' : 'bg-purple-950 text-purple-300 hover:bg-purple-900'
                }`}
                title="Filtrar conciliados con factura"
              >
                🟣 {kpis.countConciliados}
              </button>
            </div>
          </div>

          {/* KPI 7: Auditoría Costo Directo */}
          <div
            onClick={() => toggleKpiFilter('cost_audit')}
            className={`py-2 px-2.5 rounded-xl border flex flex-col justify-between cursor-pointer transition-all ${
              activeKpiFilter === 'cost_audit'
                ? 'bg-rose-950/85 border-rose-400 ring-1 ring-rose-400/50 shadow-lg shadow-rose-500/20'
                : kpis.costAuditErrors > 0
                ? 'bg-rose-950/35 border-rose-500/60 hover:border-rose-400/80 animate-pulse'
                : 'bg-slate-900/60 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between gap-1">
              <div className="flex items-center gap-1">
                <ShieldAlert className={`w-3.5 h-3.5 ${kpis.costAuditErrors > 0 ? 'text-rose-400' : 'text-slate-400'} shrink-0`} />
                <span className={`text-[12px] xl:text-[13px] font-black leading-tight tracking-tight ${
                  kpis.costAuditErrors > 0 ? 'text-rose-300' : 'text-slate-400'
                }`}>
                  7. AUDITORÍA
                </span>
              </div>
              {activeKpiFilter === 'cost_audit' ? (
                <span className="px-1 rounded bg-rose-400 text-slate-950 font-black text-[8px]">ACTIVO</span>
              ) : (
                <span className={`text-base font-black font-mono leading-none ${
                  kpis.costAuditErrors > 0 ? 'text-rose-400' : 'text-slate-400'
                }`}>
                  {kpis.costAuditErrors}
                </span>
              )}
            </div>
            <div className="mt-1.5 pt-1 border-t border-rose-900/40 text-[9px]">
              <p className={`font-bold truncate ${kpis.costAuditErrors > 0 ? 'text-rose-300' : 'text-slate-400'}`}>
                {kpis.costAuditErrors > 0 ? '⚠️ Incoherencias Buque/Directo' : '✓ Cero Incoherencias'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE OPERATIVO UNIFICADO (ZONA 3 + ZONA 4) */}
      <div className="alon-workspace-block">
        {/* ZONA 3: BARRA DE FILTROS & HERRAMIENTAS */}
        <div className="alon-zone-toolbar p-3 space-y-2.5 text-xs">
          <CrawlerSearchBar
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={clearAllFilters}
            inputRef={searchInputRef}
            placeholder="Buscar por material, proveedor, buque, solicitante, factura... (Ctrl+F | Esc limpia todo)"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex flex-wrap items-center gap-1.5">
              {viewMode === 'completa' && (
                <select
                  value={filterSupplier}
                  onChange={(e) => setFilterSupplier(e.target.value)}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 max-w-[160px]"
                >
                  <option value="TODOS">Todos los Proveedores</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.is_gas_supplier ? '💨' : ''}
                    </option>
                  ))}
                </select>
              )}

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                title={STATUS_OPTIONS.find((s) => s.value === filterStatus)?.tooltip || 'Filtrar por estado'}
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st.value} value={st.value} title={st.tooltip}>
                    {st.label}
                  </option>
                ))}
              </select>

              <select
                value={filterFortnight}
                onChange={(e) => setFilterFortnight(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="TODAS">Todas las Quincenas</option>
                {availableFortnights.map((fn) => (
                  <option key={fn} value={fn}>
                    {fn === currentFortnight ? `★ ${fn} (Actual)` : fn}
                  </option>
                ))}
              </select>

              <select
                value={filterChargeType}
                onChange={(e) => setFilterChargeType(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="TODOS">Todos los Destinos</option>
                <option value="DIRECT">Directo para Obra</option>
                <option value="VIA_PANOL">Para Pañol / Stock</option>
                <option value="STANDBY">Stand-by en Depósito</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2.5">
              <button
                onClick={() => setFilterNewOnly(!filterNewOnly)}
                className={`px-2 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                  filterNewOnly
                    ? 'bg-rose-950 border border-rose-500 text-rose-300'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Filtrar materiales que no existen en base maestra"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Nuevos ({kpis.newMaterialsCount})</span>
              </button>

              {viewMode === 'completa' && (
                <button
                  onClick={() => setHideReconciled(!hideReconciled)}
                  className={`px-2 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 cursor-pointer ${
                    hideReconciled
                      ? 'bg-purple-950 border border-purple-500 text-purple-300'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="Ocultar las compras que ya fueron conciliadas con factura"
                >
                  <span>🟣 Ocultar Conc.</span>
                </button>
              )}

              {/* Botón Mandados */}
              <button
                type="button"
                onClick={() => {
                  setMandadosPreselectedIds([])
                  setShowMandadosModal(true)
                }}
                className="px-2 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 font-bold text-xs flex items-center gap-1 cursor-pointer"
                title="Generar mensaje de WhatsApp para el mandadero con materiales a retirar de proveedores locales"
              >
                <span>🛵 Mandados ({localPendingCount})</span>
              </button>

              {grid.canUndo && (
                <button
                  type="button"
                  onClick={grid.undo}
                  className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-amber-300 font-bold text-xs shadow flex items-center gap-1 transition-all cursor-pointer animate-in fade-in"
                  title="Deshacer el último cambio (Ctrl + Z)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Deshacer (Ctrl+Z)</span>
                </button>
              )}

              {grid.canRedo && (
                <button
                  type="button"
                  onClick={grid.redo}
                  className="px-2 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-300 font-bold text-xs shadow flex items-center gap-1 transition-all cursor-pointer animate-in fade-in"
                  title="Rehacer el cambio deshecho (Ctrl + Y)"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rehacer (Ctrl+Y)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* ZONA 4: PLANILLA EDITABLE DE COMPRAS */}
        <div className="alon-zone-grid">
          <GridRibbon
            activeCellBadge={grid.activeCellBadge}
            onInsertRow={() => {
              const targetIdx = grid.activeCell?.rowIndex >= 0 ? grid.activeCell.rowIndex : 0
              const targetPo = filteredOrders[targetIdx]
              if (targetPo) {
                handleInsertOrderContext(targetPo, targetIdx, 'below')
              } else {
                handleAddNewBlankOrder()
              }
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

          <div
            tabIndex={0}
            onKeyDown={grid.handleKeyDown}
            ref={grid.gridContainerRef}
            className="alon-grid-scroll"
          >
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
                  <th className="py-2 px-1.5 text-center" title="Fecha de entrega del pedido">
                    F. Entrega ✎
                  </th>

                  {viewMode === 'completa' && (
                    <th className="py-2 px-1 w-9 text-center" title="Conciliado con Factura">
                      Conc.
                    </th>
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
                  filteredOrders.map((po, rowIndex) => {
                    const isSelected = selectedOrderIds.has(po.id)
                    const sup = suppliers.find((s) => s.id === po.supplier_id)
                    const shp = ships.find((s) => s.id === po.ship_id)
                    const wo = workOrders.find((w) => w.id === po.work_order_id)
                    const matchMap = getSearchMatchMap(po, searchQuery, suppliers, ships, documents)
                    const lineDocs = documents.filter((d) => d.purchase_order_id === po.id)

                    const quoted = Number(po.supplier_quoted_price) || 0
                    const system = Number(po.system_unit_price) || 0
                    let deltaPct = null
                    if (quoted > 0 && system > 0) {
                      deltaPct = Math.round(((quoted - system) / system) * 100)
                    }

                    const urgency = po.urgency || 'SIN_APURO'
                    const statusDef = STATUS_OPTIONS.find((s) => s.value === po.status)
                    const hasFreight = Boolean(po.freight_transport_name || po.freight_estimated_date)

                    return (
                      <tr
                        key={po.id}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (grid.activeCell?.rowIndex !== rowIndex) {
                            grid.setActiveCell({ rowIndex, colIndex: grid.activeCell?.colIndex ?? 0 })
                            grid.setSelectionRange?.(null)
                          }
                          setRowMenuTarget({
                            order: po,
                            rowIndex,
                            mode: 'context_menu',
                            x: e.clientX,
                            y: e.clientY
                          })
                        }}
                        className={`group transition-colors ${
                          isSelected
                            ? 'bg-cyan-950/30 hover:bg-cyan-950/40'
                            : po.is_reconciled
                            ? 'bg-slate-900/40 hover:bg-slate-800/40 text-slate-300'
                            : 'hover:bg-slate-800/50'
                        }`}
                      >
                        {/* 1. Columna 0 Canónica (#) */}
                        <td className="py-1 px-1 text-center w-8 select-none relative">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => toggleSelectRow(po.id)}
                              className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                            >
                              {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setRowMenuTarget(
                                  rowMenuTarget?.order?.id === po.id && rowMenuTarget?.mode === 'click_num'
                                    ? null
                                    : { order: po, rowIndex, mode: 'click_num' }
                                )
                              }}
                              className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded transition-all cursor-pointer hover:bg-cyan-950/90 hover:text-cyan-300 hover:ring-1 hover:ring-cyan-500/60 ${
                                isSelected ? 'text-cyan-300' : 'text-slate-500 group-hover:text-cyan-400'
                              }`}
                              title={`Fila #${po._rowSeq || rowIndex + 1} • Clic para opciones`}
                            >
                              {po._rowSeq || rowIndex + 1}
                            </button>
                          </div>

                          {rowMenuTarget?.order?.id === po.id && rowMenuTarget?.mode === 'click_num' && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute left-9 top-1 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl p-1.5 w-52 text-left space-y-1 animate-in fade-in zoom-in-95 duration-100"
                            >
                              <div className="px-2 py-1 text-[10px] font-bold text-slate-400 border-b border-slate-800 flex items-center justify-between">
                                <span className="flex items-center gap-1.5 text-cyan-300">
                                  <span>Fila #{rowIndex + 1}</span>
                                  <span className="text-slate-500 font-normal truncate max-w-[85px]">{po.material_name_raw || 'S/D'}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setRowMenuTarget(null)}
                                  className="text-slate-500 hover:text-white text-xs px-1 cursor-pointer"
                                >
                                  ✕
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  setRowMenuTarget(null)
                                  handleInsertOrderContext(po, rowIndex, 'above')
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:bg-cyan-950 hover:text-cyan-300 flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <span className="text-sm">⬆️</span>
                                <span>Insertar fila ARRIBA</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRowMenuTarget(null)
                                  handleInsertOrderContext(po, rowIndex, 'below')
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:bg-cyan-950 hover:text-cyan-300 flex items-center gap-2 cursor-pointer transition-colors"
                              >
                                <span className="text-sm">⬇️</span>
                                <span>Insertar fila DEBAJO</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setRowMenuTarget(null)
                                  handleDuplicateOrder(po)
                                }}
                                className="w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-300 hover:bg-slate-800 hover:text-white flex items-center gap-2 cursor-pointer transition-colors border-t border-slate-800/80"
                              >
                                <Copy className="w-3.5 h-3.5 text-slate-400" />
                                <span>Duplicar pedido al final</span>
                              </button>
                            </div>
                          )}
                        </td>

                        {/* 2. Destino */}
                        {(() => {
                          const cp = getSpreadsheetCellProps(rowIndex, 'charge_type')
                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => activateComprasCell(po, 'charge_type')}
                              className={`py-1.5 px-1.5 whitespace-nowrap cursor-pointer ${cp.className}`}
                              title="Doble clic para cambiar Destino"
                            >
                              {inlineEdit.orderId === po.id && inlineEdit.field === 'charge_type' ? (
                                <select
                                  autoFocus
                                  value={inlineEdit.value}
                                  onChange={(e) => saveInlineEdit(po.id, 'charge_type', e.target.value)}
                                  onBlur={() => setInlineEdit({ orderId: null, field: null, value: '' })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') setInlineEdit({ orderId: null, field: null, value: '' })
                                  }}
                                  className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[10px] font-bold text-white focus:outline-none"
                                >
                                  <option value="DIRECT">DIRECTO</option>
                                  <option value="VIA_PANOL">PAÑOL</option>
                                  <option value="STANDBY">STANDBY</option>
                                </select>
                              ) : po.charge_type === 'DIRECT' ? (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold text-[10px]">
                                  DIRECTO
                                </span>
                              ) : po.charge_type === 'VIA_PANOL' ? (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-[10px]">
                                  PAÑOL
                                </span>
                              ) : (
                                <span className="inline-block px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px]">
                                  {po.charge_type}
                                </span>
                              )}
                              {cp.renderHandle && (
                                <div
                                  onMouseDown={grid.handleFillHandleMouseDown}
                                  onDoubleClick={grid.handleFillHandleDoubleClick}
                                  className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                                  title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                                />
                              )}
                            </td>
                          )
                        })()}

                        {/* 3. Fecha / Quincena */}
                        {(() => {
                          const cp = getSpreadsheetCellProps(rowIndex, 'order_date')
                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => activateComprasCell(po, 'order_date')}
                              className={`py-1.5 px-1.5 whitespace-nowrap font-mono cursor-pointer ${cp.className}`}
                              title="Doble clic para editar fecha"
                            >
                              {inlineEdit.orderId === po.id && inlineEdit.field === 'order_date' ? (
                                <input
                                  type="date"
                                  autoFocus
                                  value={inlineEdit.value}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setInlineEdit({ ...inlineEdit, value: val })
                                    if (val) saveInlineEdit(po.id, 'order_date', val)
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && inlineEdit.value) saveInlineEdit(po.id, 'order_date', inlineEdit.value)
                                    if (e.key === 'Escape') setInlineEdit({ orderId: null, field: null, value: '' })
                                  }}
                                  onBlur={() => {
                                    if (inlineEdit.value) saveInlineEdit(po.id, 'order_date', inlineEdit.value)
                                    else setInlineEdit({ orderId: null, field: null, value: '' })
                                  }}
                                  className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[11px] text-white focus:outline-none cursor-pointer"
                                />
                              ) : (
                                <>
                                  <div className="text-slate-200 text-[11px]">{po.order_date}</div>
                                  <div className="text-[9px] text-slate-500">{po.fortnight_period}</div>
                                </>
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

                        {/* 4. Buque / OT */}
                        {(() => {
                          const cp = getSpreadsheetCellProps(rowIndex, 'ship_id')
                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => activateComprasCell(po, 'ship_id')}
                              className={`py-1.5 px-1.5 cursor-pointer ${matchMap.ship ? 'bg-amber-400/20 ring-1 ring-inset ring-amber-400/50' : ''} ${cp.className}`}
                              title="Doble clic para cambiar Buque u Orden de Trabajo"
                            >
                              <div className="font-semibold text-slate-200 truncate max-w-[105px]" title={shp?.name || 'ASTILLERO'}>
                                <HighlightText text={shp?.name || 'ASTILLERO'} query={searchQuery} />
                              </div>
                              <div className="text-[9px] text-slate-400 truncate max-w-[105px]" title={wo?.title || (po.work_order_id ? 'OT' : '⚠️ Sin OT')}>
                                {wo ? (
                                  <HighlightText text={`${wo.ot_number ? `#${wo.ot_number} ` : ''}${wo.title}`} query={searchQuery} />
                                ) : (
                                  po.work_order_id ? 'OT' : <span className="text-amber-400 font-bold">⚠️ Sin OT</span>
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

                        {/* 5. Solicita */}
                        {(() => {
                          const cp = getSpreadsheetCellProps(rowIndex, 'requested_by_name')
                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => activateComprasCell(po, 'requested_by_name')}
                              className={`py-1.5 px-1.5 whitespace-nowrap cursor-pointer ${matchMap.requested_by ? 'bg-amber-400/20 ring-1 ring-inset ring-amber-400/50' : ''} ${cp.className}`}
                              title={`Solicita: ${po.requested_by_name || 'PAÑOL'} (Doble clic para editar)`}
                            >
                              <div className="hover:bg-slate-800/80 px-1 py-0.5 rounded border border-transparent hover:border-cyan-500/30 text-slate-200 font-semibold transition-all truncate max-w-[85px]">
                                <HighlightText text={po.requested_by_name || 'PAÑOL'} query={searchQuery} />
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

                        {/* 6. Material Solicitado */}
                        {(() => {
                          const cp = getSpreadsheetCellProps(rowIndex, 'material_name_raw')
                          const isNoCatalogAlert = Boolean(po.no_catalog_required)
                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => activateComprasCell(po, 'material_name_raw')}
                              className={`py-1.5 px-1.5 cursor-pointer ${matchMap.material ? 'bg-amber-400/20 ring-1 ring-inset ring-amber-400/50' : ''} ${cp.className}`}
                              title="Doble clic para editar material y observaciones in-situ"
                            >
                              {inlineEdit.orderId === po.id && inlineEdit.field === 'material_name_raw' ? (
                                <div
                                  className="bg-slate-950 border-2 border-cyan-400 rounded-lg p-2 space-y-1.5 shadow-2xl min-w-[220px] z-30 text-left"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Material</label>
                                    <input
                                      type="text"
                                      list="compras-materials-datalist"
                                      autoFocus
                                      value={inlineEdit.value}
                                      onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault()
                                          saveInlineMaterialAndObs(po.id, inlineEdit.value, inlineEdit.obsValue)
                                        } else if (e.key === 'Escape') {
                                          setInlineEdit({ orderId: null, field: null, value: '', obsValue: '' })
                                        }
                                      }}
                                      placeholder="Nombre del material..."
                                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-cyan-400 font-semibold"
                                    />
                                  </div>

                                  <div>
                                    <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Observación / Nota</label>
                                    <input
                                      type="text"
                                      value={inlineEdit.obsValue ?? ''}
                                      onChange={(e) => setInlineEdit({ ...inlineEdit, obsValue: e.target.value })}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                          e.preventDefault()
                                          saveInlineMaterialAndObs(po.id, inlineEdit.value, inlineEdit.obsValue)
                                        } else if (e.key === 'Escape') {
                                          setInlineEdit({ orderId: null, field: null, value: '', obsValue: '' })
                                        }
                                      }}
                                      placeholder="Ej: son para juan..."
                                      className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                                    />
                                  </div>

                                  <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1 border-t border-slate-800">
                                    <span className="text-slate-500">Enter: guardar</span>
                                    <button
                                      type="button"
                                      onClick={() => saveInlineMaterialAndObs(po.id, inlineEdit.value, inlineEdit.obsValue)}
                                      className="px-2 py-0.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded text-[10px] cursor-pointer"
                                    >
                                      Guardar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-1">
                                    <span className="font-medium text-white truncate max-w-[165px]" title={po.material_name_raw || 'Sin nombre'}>
                                      {po.material_name_raw ? (
                                        <HighlightText text={po.material_name_raw} query={searchQuery} />
                                      ) : (
                                        <span className="text-slate-500 italic">-- Sin material --</span>
                                      )}
                                    </span>
                                    {po.is_new_material && !po.no_catalog_required && isSupervisorOrAdmin && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setPendingMaterialOrder(po)
                                          setShowNewMaterialModal(true)
                                        }}
                                        className="px-1.5 py-0.2 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/50 text-[9px] font-bold inline-flex items-center gap-0.5 cursor-pointer shrink-0"
                                        title="Material sin registro. Clic para dar alta."
                                      >
                                        <AlertTriangle className="w-2.5 h-2.5" />
                                        <span>Alta</span>
                                      </button>
                                    )}
                                  </div>

                                  {isNoCatalogAlert && (
                                    <div className="my-0.5">
                                      <span
                                        className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[9px] font-extrabold uppercase tracking-wider inline-block"
                                        title="Material nuevo marcado como: NO requiere alta en catálogo"
                                      >
                                        🔴 Sin alta en catálogo
                                      </span>
                                    </div>
                                  )}

                                  {po.observations && (
                                    <p className="text-[10px] text-slate-300 italic truncate max-w-[190px]" title={po.observations}>
                                      <HighlightText text={po.observations} query={searchQuery} />
                                    </p>
                                  )}
                                </>
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

                        {/* 7. Cantidad */}
                        {(() => {
                          const cp = getSpreadsheetCellProps(rowIndex, 'quantity')
                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => activateComprasCell(po, 'quantity')}
                              className={`py-1.5 px-1.5 text-right whitespace-nowrap font-mono cursor-pointer ${cp.className}`}
                              title="Doble clic para editar cantidad"
                            >
                              {inlineEdit.orderId === po.id && inlineEdit.field === 'quantity' ? (
                                <input
                                  type="number"
                                  autoFocus
                                  value={inlineEdit.value}
                                  onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveInlineEdit(po.id, 'quantity', Number(inlineEdit.value) || 1)
                                    if (e.key === 'Escape') setInlineEdit({ orderId: null, field: null, value: '' })
                                  }}
                                  onBlur={() => saveInlineEdit(po.id, 'quantity', Number(inlineEdit.value) || 1)}
                                  className="w-16 bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-right text-[11px] text-white focus:outline-none font-mono"
                                />
                              ) : (
                                <div className="hover:bg-slate-800/80 px-1 py-0.5 rounded border border-transparent hover:border-cyan-500/30 transition-all font-mono inline-block text-right">
                                  <span className="font-bold text-white">{po.quantity}</span>{' '}
                                  <span className="text-[9px] text-slate-500">{po.unit_measure || 'un.'}</span>
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

                        {/* Financiero: $/U Prov y $/U Sist */}
                        {viewMode === 'completa' && (
                          <>
                            {(() => {
                              const cp = getSpreadsheetCellProps(rowIndex, 'supplier_quoted_price')
                              return (
                                <td
                                  {...cp.domProps}
                                  onDoubleClick={() => activateComprasCell(po, 'supplier_quoted_price')}
                                  className={`py-1.5 px-1.5 text-right whitespace-nowrap font-mono cursor-pointer ${cp.className}`}
                                  title="Doble clic para editar $/U cotizado"
                                >
                                  {inlineEdit.orderId === po.id && inlineEdit.field === 'supplier_quoted_price' ? (
                                    <input
                                      type="number"
                                      autoFocus
                                      value={inlineEdit.value}
                                      onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveInlineEdit(po.id, 'supplier_quoted_price', Number(inlineEdit.value) || 0)
                                        if (e.key === 'Escape') setInlineEdit({ orderId: null, field: null, value: '' })
                                      }}
                                      onBlur={() => saveInlineEdit(po.id, 'supplier_quoted_price', Number(inlineEdit.value) || 0)}
                                      className="w-24 bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-right text-[11px] text-white focus:outline-none font-mono"
                                    />
                                  ) : (
                                    <div className="hover:bg-slate-800/80 px-1 py-0.5 rounded border border-transparent hover:border-cyan-500/30 transition-all inline-block text-right">
                                      {po.supplier_quoted_price ? (
                                        <span className="text-slate-200 font-semibold">${Number(po.supplier_quoted_price).toLocaleString('es-AR')}</span>
                                      ) : (
                                        <span className="text-slate-600">—</span>
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

                            {(() => {
                              const cp = getSpreadsheetCellProps(rowIndex, 'system_unit_price')
                              return (
                                <td
                                  {...cp.domProps}
                                  className={`py-1.5 px-1.5 text-right whitespace-nowrap font-mono ${cp.className}`}
                                >
                                  <div className="text-slate-400">
                                    {po.system_unit_price ? `$${Number(po.system_unit_price).toLocaleString('es-AR')}` : '—'}
                                  </div>
                                  {deltaPct !== null && (
                                    <div
                                      className={`text-[9px] font-bold flex items-center justify-end gap-0.5 ${
                                        deltaPct > 0 ? 'text-rose-400' : 'text-emerald-400'
                                      }`}
                                    >
                                      {deltaPct > 0 ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                                      <span>{deltaPct > 0 ? `+${deltaPct}%` : `${deltaPct}%`}</span>
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
                          </>
                        )}

                        {/* Proveedor */}
                        {(() => {
                          const cp = getSpreadsheetCellProps(rowIndex, 'supplier_id')
                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => activateComprasCell(po, 'supplier_id')}
                              className={`py-1.5 px-1.5 relative cursor-pointer ${matchMap.supplier ? 'bg-amber-400/20 ring-1 ring-inset ring-amber-400/50' : ''} ${cp.className}`}
                              title={sup?.name ? `Proveedor: ${sup.name} (Doble clic para cambiar)` : 'Doble clic para asignar proveedor'}
                            >
                              {inlineEdit.orderId === po.id && inlineEdit.field === 'supplier_id' ? (
                                <InlineSupplierPicker
                                  suppliers={suppliers}
                                  currentSupplierId={po.supplier_id}
                                  onSelect={(selectedSupId) => saveInlineEdit(po.id, 'supplier_id', selectedSupId)}
                                  onCancel={() => setInlineEdit({ orderId: null, field: null, value: '' })}
                                />
                              ) : (
                                <div className="hover:bg-slate-800/80 px-1 py-0.5 rounded border border-transparent hover:border-cyan-500/30 transition-all flex items-center justify-between gap-1 max-w-[125px]">
                                  <span className="font-semibold text-slate-200 truncate flex-1">
                                    {sup?.name ? <HighlightText text={sup.name} query={searchQuery} /> : <span className="text-slate-600 italic">Asignar...</span>}
                                  </span>
                                  {Boolean(po.courier_dispatched) && (po.status === 'PEDIDO' || po.status === 'PEDIDO INCOMPLETO') && (
                                    <span
                                      className="text-xs shrink-0 select-none px-1 py-0.2 rounded bg-cyan-950/90 border border-cyan-500/60 shadow-sm"
                                      title={`🛵 Mandado a retirar por ${po.courier_worker_name || 'Mandadero'}`}
                                    >
                                      🛵
                                    </span>
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

                        {/* Estado */}
                        {(() => {
                          const cp = getSpreadsheetCellProps(rowIndex, 'status')
                          const normalizedStatus = po.status === 'SOLICITUD' ? 'PEDIR' : po.status
                          return (
                            <td
                              {...cp.domProps}
                              className={`py-1.5 px-1.5 whitespace-nowrap ${cp.className}`}
                              title={statusDef?.tooltip ? `${normalizedStatus}: ${statusDef.tooltip}` : normalizedStatus}
                            >
                              <select
                                value={normalizedStatus}
                                onChange={(e) => handleQuickStatusChange(po.id, e.target.value)}
                                className={`bg-slate-950 border border-slate-800 hover:border-slate-700 focus:border-cyan-500 rounded px-1 py-0.5 text-[10px] font-bold focus:outline-none transition-colors cursor-pointer max-w-[118px] ${
                                  normalizedStatus === 'SE COMPRA?'
                                    ? 'text-pink-400'
                                    : normalizedStatus === 'PEDIDO INCOMPLETO'
                                    ? 'text-orange-400'
                                    : normalizedStatus === 'RECIBIDO'
                                    ? 'text-emerald-400'
                                    : normalizedStatus === 'RECIBIDO 2'
                                    ? 'text-slate-300'
                                    : normalizedStatus === 'RECIB.COMP.DIRECT'
                                    ? 'text-cyan-400'
                                    : normalizedStatus === 'PEDIDO'
                                    ? 'text-blue-400'
                                    : normalizedStatus === 'PEDIR'
                                    ? 'text-amber-400'
                                    : ['COTIZACION', 'COTIZAR', 'COTIZA.SOLICITUD', 'COTIZA.APROBADA'].includes(normalizedStatus)
                                    ? 'text-purple-400'
                                    : normalizedStatus === 'CANCELADOS' || normalizedStatus === 'COTIZA.RECHAZADA'
                                    ? 'text-rose-400'
                                    : 'text-slate-300'
                                }`}
                              >
                                {viewMode === 'completa' ? (
                                  STATUS_OPTIONS.filter((s) => s.value !== 'TODOS').map((st) => (
                                    <option
                                      key={st.value}
                                      value={st.value}
                                      title={st.tooltip}
                                      className={`bg-slate-950 font-semibold ${st.textColor || 'text-slate-200'}`}
                                    >
                                      {st.label}
                                    </option>
                                  ))
                                ) : (
                                  <>
                                    <option value="PEDIR" className="bg-slate-950 text-amber-400 font-semibold">PEDIR</option>
                                    <option value="RECIBIDO" className="bg-slate-950 text-emerald-400 font-semibold">RECIBIDO</option>
                                    <option value="RECIB.COMP.DIRECT" className="bg-slate-950 text-cyan-400 font-semibold">RECIB.COMP.DIRECT</option>
                                    <option value="PEDIDO INCOMPLETO" className="bg-slate-950 text-orange-400 font-semibold">PEDIDO INCOMPLETO</option>
                                    <option value="RECIBIDO 2" className="bg-slate-950 text-slate-300 font-semibold">RECIBIDO 2</option>
                                    <option value="CANCELADOS" className="bg-slate-950 text-rose-400 font-semibold">CANCELADOS</option>
                                    <option value="SE COMPRA?" className="bg-slate-950 text-pink-400 font-semibold">SE COMPRA?</option>
                                  </>
                                )}
                              </select>
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

                        {/* Urgencia */}
                        {(() => {
                          const cp = getSpreadsheetCellProps(rowIndex, 'urgency')
                          return (
                            <td
                              {...cp.domProps}
                              className={`py-1.5 px-1.5 whitespace-nowrap ${cp.className}`}
                            >
                              <button
                                type="button"
                                onClick={() => handleCycleUrgency(po.id, urgency)}
                                className="cursor-pointer transition-transform hover:scale-105"
                                title="Clic para cambiar urgencia"
                              >
                                {urgency === 'URGENTE' ? (
                                  <span className="inline-block px-1 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300 font-extrabold text-[9px] animate-pulse">
                                    URGENTE
                                  </span>
                                ) : urgency === 'PROXIMA_SALIDA' ? (
                                  <span className="inline-block px-1 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 font-bold text-[9px]">
                                    PRÓX. SAL.
                                  </span>
                                ) : (
                                  <span className="inline-block px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 text-[9px]">
                                    Normal
                                  </span>
                                )}
                              </button>
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

                        {/* Doc */}
                        <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedOrderForDocs(po)
                              setShowOrderDocsModal(true)
                            }}
                            className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                              matchMap.documents
                                ? 'bg-amber-400/30 border-2 border-amber-400 text-amber-200 ring-2 ring-amber-400/60 shadow-lg shadow-amber-400/20 animate-pulse'
                                : lineDocs.length > 0
                                ? 'bg-cyan-950 border border-cyan-500/60 text-cyan-300 hover:bg-cyan-900 shadow-sm'
                                : 'text-slate-500 hover:text-cyan-400 hover:bg-slate-800/80 border border-transparent'
                            }`}
                            title={lineDocs.length > 0 ? `${lineDocs.length} archivo(s). Clic para ver.` : 'Adjuntar documento'}
                          >
                            <Paperclip className="w-3 h-3" />
                            <span>{lineDocs.length > 0 ? lineDocs.length : ''}</span>
                          </button>
                        </td>

                        {/* F. Entrega */}
                        {(() => {
                          const cp = getSpreadsheetCellProps(rowIndex, 'delivery_date')
                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => activateComprasCell(po, 'delivery_date')}
                              className={`py-1.5 px-1.5 text-center whitespace-nowrap font-mono cursor-pointer ${cp.className}`}
                              title="Doble clic para cargar Fecha de Entrega"
                            >
                              {inlineEdit.orderId === po.id && inlineEdit.field === 'delivery_date' ? (
                                <input
                                  type="date"
                                  autoFocus
                                  value={inlineEdit.value}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    setInlineEdit({ ...inlineEdit, value: val })
                                    if (val) saveInlineEdit(po.id, 'delivery_date', val)
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') saveInlineEdit(po.id, 'delivery_date', inlineEdit.value || null)
                                    if (e.key === 'Escape') setInlineEdit({ orderId: null, field: null, value: '' })
                                  }}
                                  onBlur={() => {
                                    saveInlineEdit(po.id, 'delivery_date', inlineEdit.value || null)
                                  }}
                                  className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[11px] text-white focus:outline-none cursor-pointer"
                                />
                              ) : po.delivery_date ? (
                                <span className="text-emerald-300 font-semibold text-[10px] bg-emerald-950/50 border border-emerald-800/50 px-1.5 py-0.5 rounded">
                                  {po.delivery_date}
                                </span>
                              ) : (
                                <span className="text-slate-600 hover:text-slate-400 text-[10px]">—</span>
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

                        {/* Conciliado */}
                        {viewMode === 'completa' && (
                          <td className="py-1.5 px-1 text-center whitespace-nowrap">
                            {po.is_reconciled ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setReconcileTarget({
                                    mode: 'detail',
                                    supplierId: po.supplier_id,
                                    orderId: po.id,
                                    orderDate: po.order_date,
                                    supplierName: sup?.name || 'Proveedor',
                                    existingInvoice: po.invoice_number || '',
                                    reconciledBy: po.reconciled_by || 'Supervisor',
                                    reconciledAt: po.reconciled_at
                                  })
                                  setShowReconcileModal(true)
                                }}
                                className="w-5 h-5 rounded-full bg-purple-500/20 border border-purple-400 flex items-center justify-center mx-auto cursor-pointer hover:scale-125 transition-transform"
                                title={`🟣 CONCILIADO — Factura: ${po.invoice_number || 'S/D'}`}
                              >
                                <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_6px_#c084fc]" />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setReconcileTarget({
                                    mode: 'single',
                                    supplierId: po.supplier_id,
                                    orderId: po.id,
                                    orderDate: po.order_date,
                                    supplierName: sup?.name || 'Proveedor'
                                  })
                                  setShowReconcileModal(true)
                                }}
                                className="w-3.5 h-3.5 rounded-full border border-slate-700 hover:border-purple-400 hover:bg-purple-950/60 mx-auto block cursor-pointer transition-colors"
                                title="Sin conciliar. Clic para conciliar."
                              />
                            )}
                          </td>
                        )}

                        {/* Acciones */}
                        <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setFreightTargetOrder(po)
                                setShowFreightModal(true)
                              }}
                              className={`p-1 rounded transition-colors cursor-pointer ${
                                matchMap.freight
                                  ? 'text-amber-100 bg-amber-500/40 border-2 border-amber-400 ring-2 ring-amber-400/60 shadow-md shadow-amber-500/20 font-bold'
                                  : hasFreight
                                  ? 'text-amber-300 bg-amber-950/70 border border-amber-500/50 hover:bg-amber-900'
                                  : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
                              }`}
                              title="Asignar datos de flete"
                            >
                              <Truck className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleInsertOrderContext(po, rowIndex, 'below')}
                              className="p-1 text-slate-400 hover:text-emerald-400 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                              title="➕ Insertar fila contigua debajo"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setSupplierHelperTarget(po)
                                setShowSupplierHelperModal(true)
                              }}
                              className="p-1 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                              title="💡 Asistente Inteligente de Proveedores"
                            >
                              <Lightbulb className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateOrder(po)}
                              className="p-1 text-slate-400 hover:text-cyan-300 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                              title="⚡ Duplicar este pedido"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingOrder(po)
                                setShowOrderModal(true)
                              }}
                              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Editar pedido completo"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteOrder(po.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Eliminar pedido"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
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
      </div>

      {/* ZONA 5: BARRA DE TOTALES FLOTANTE CANÓNICA */}
      <GridStatusBarBottom
        filteredCount={filteredOrders.length}
        totalCount={purchaseOrders.length}
        entityName="pedidos"
        hasActiveFilter={hasActiveFilters}
        onClearFilters={clearAllFilters}
        selectionStats={grid.selectionStats}
        onClearSelection={() => grid.setSelectionRange(null)}
        customSelection={selectedOrderIds.size > 0 ? {
          count: selectedOrderIds.size,
          label: 'pedidos tildados',
          onClear: () => setSelectedOrderIds(new Set())
        } : null}
        globalAggregates={[
          { label: 'Σ Cant', value: stats.sumQty },
          ...(viewMode === 'completa' ? [
            { label: 'Σ AR$', value: `$${stats.sumCostArs.toLocaleString('es-AR')}`, highlight: true },
            { label: 'Σ US$', value: `$${stats.sumCostUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
            { label: 'Ø', value: `$${Math.round(stats.avgPriceArs).toLocaleString('es-AR')}` }
          ] : [])
        ]}
        extraActions={selectedOrderIds.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {viewMode === 'completa' && (
              <>
                <button
                  type="button"
                  onClick={() => setShowBatchOrderModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded-lg text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                  title="Abrir WhatsApp agrupado por proveedor"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Pedir Agrupado ({selectedOrderIds.size})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAssignSupplierModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-cyan-500/50 text-cyan-300 font-bold rounded-lg text-xs shadow-md transition-all cursor-pointer"
                  title="Asignar rápidamente un proveedor a los pedidos seleccionados"
                >
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Asignar Proveedor ({selectedOrderIds.size})</span>
                </button>

                <button
                  type="button"
                  onClick={handleBatchDismissCatalogAlta}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-950/70 border border-rose-500/40 text-rose-300 font-bold rounded-lg text-xs shadow-md transition-all cursor-pointer"
                  title="Marcar que los materiales seleccionados NO requieren alta en catálogo"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Omitir Alta Catálogo ({selectedOrderIds.size})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const selectedRows = purchaseOrders.filter((p) => selectedOrderIds.has(p.id))
                    const firstRow = selectedRows[0]
                    const sup = suppliers.find((s) => s.id === firstRow?.supplier_id)
                    setReconcileTarget({
                      mode: 'selected',
                      selectedIds: Array.from(selectedOrderIds),
                      supplierId: firstRow?.supplier_id || null,
                      orderId: firstRow?.id || null,
                      orderDate: firstRow?.order_date || new Date().toISOString().split('T')[0],
                      supplierName: sup?.name || 'Filas Seleccionadas',
                      existingInvoice: firstRow?.invoice_number || ''
                    })
                    setShowReconcileModal(true)
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs shadow-md shadow-purple-600/25 transition-all cursor-pointer"
                  title="Desplegar menú de conciliación para las filas seleccionadas"
                >
                  <span>🟣</span>
                  <span>Conciliar ({selectedOrderIds.size})</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => {
                setMandadosPreselectedIds(Array.from(selectedOrderIds))
                setShowMandadosModal(true)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-200 font-bold rounded-lg text-xs shadow-md shadow-cyan-900/30 transition-all cursor-pointer"
              title="Generar orden de retiro para mandadero"
            >
              <span>🛵</span>
              <span>Mandar a Retirar ({selectedOrderIds.size})</span>
            </button>

            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700 rounded-lg p-1 shadow-md">
              <span className="text-[11px] text-slate-400 font-semibold pl-1">
                🏷️ Estado:
              </span>
              <select
                value={batchTargetStatus}
                onChange={(e) => setBatchTargetStatus(e.target.value)}
                className="bg-slate-950 border border-slate-700 hover:border-cyan-500 focus:border-cyan-500 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                <option value="PEDIR">PEDIR (Por emitir)</option>
                <option value="PEDIDO">PEDIDO (En proveedor)</option>
                <option value="RECIBIDO">RECIBIDO (Stock / Pañol)</option>
                <option value="RECIB.COMP.DIRECT">RECIB.COMP.DIRECT (Directo a obra)</option>
              </select>
              <button
                type="button"
                onClick={handleBatchStatusApply}
                className={`flex items-center gap-1.5 px-3 py-1 text-white font-bold rounded-md text-xs shadow-md transition-all cursor-pointer ${
                  batchTargetStatus === 'RECIB.COMP.DIRECT'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                    : batchTargetStatus === 'RECIBIDO'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                    : batchTargetStatus === 'PEDIDO'
                    ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                    : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/20'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Aplicar a ({selectedOrderIds.size})</span>
              </button>
            </div>
          </div>
        ) : null}
      />

      {/* MODALES DEL PANEL */}
      {showOrderModal && (
        <OrderFormModal
          order={editingOrder}
          ships={ships}
          workOrders={workOrders}
          suppliers={suppliers}
          materials={materials}
          workers={workers}
          contractorGroups={contractorGroups}
          currentFortnight={currentFortnight}
          viewMode={viewMode}
          isSupervisorOrAdmin={isSupervisorOrAdmin}
          onClose={() => setShowOrderModal(false)}
          onSuccess={(savedOrders) => {
            if (editingOrder) {
              setPurchaseOrders((prev) => prev.map((p) => (p.id === savedOrders[0].id ? savedOrders[0] : p)))
              showFeedbackMsg('success', 'Pedido actualizado correctamente.')
            } else {
              setPurchaseOrders((prev) => [...savedOrders, ...prev])
              showFeedbackMsg('success', `Se registraron ${savedOrders.length} materiales en la solicitud.`)
            }
            setShowOrderModal(false)
          }}
        />
      )}

      {showNewMaterialModal && pendingMaterialOrder && (
        <NewMaterialModal
          order={pendingMaterialOrder}
          onClose={() => {
            setShowNewMaterialModal(false)
            setPendingMaterialOrder(null)
          }}
          onDismissed={async (orderId) => {
            const targetPo = purchaseOrders.find((p) => p.id === orderId)
            grid.pushUndoAction([
              {
                rowId: orderId,
                colId: 'no_catalog_required',
                oldValue: Boolean(targetPo?.no_catalog_required),
                newValue: true
              }
            ])
            setPurchaseOrders((prev) =>
              prev.map((p) => (p.id === orderId ? { ...p, no_catalog_required: true } : p))
            )
            showFeedbackMsg('success', 'Se descartó el alta en catálogo (en rojo). Podés deshacer con Ctrl+Z.')
            setShowNewMaterialModal(false)
            setPendingMaterialOrder(null)
          }}
          onSuccess={async (newMaterial) => {
            setMaterials((prev) => [...prev, newMaterial])
            await supabase
              .from('purchase_orders')
              .update({
                material_id: newMaterial.id,
                is_new_material: false,
                system_unit_price: newMaterial.cost_ars,
                unit_measure: newMaterial.unit_measure,
                updated_at: new Date().toISOString()
              })
              .eq('id', pendingMaterialOrder.id)

            setPurchaseOrders((prev) =>
              prev.map((p) =>
                p.id === pendingMaterialOrder.id
                  ? {
                      ...p,
                      material_id: newMaterial.id,
                      is_new_material: false,
                      system_unit_price: newMaterial.cost_ars,
                      unit_measure: newMaterial.unit_measure
                    }
                  : p
              )
            )

            const rubroNotice = newMaterial.rubro_status === 'PENDIENTE_HOMOLOGACION'
              ? ' (Se envió alerta al Administrador para homologar el nuevo rubro).'
              : '.'
            showFeedbackMsg('success', `Material "${newMaterial.name}" dado de alta en catálogo${rubroNotice}`)
            setShowNewMaterialModal(false)
            setPendingMaterialOrder(null)
          }}
        />
      )}

      {showReconcileModal && reconcileTarget && (
        <ReconcileModal
          target={reconcileTarget}
          onClose={() => {
            setShowReconcileModal(false)
            setReconcileTarget(null)
          }}
          onSuccess={async ({ invoiceNumber, orderIds, action = 'reconcile' }) => {
            const isUnreconcile = action === 'unreconcile'
            const updates = isUnreconcile
              ? {
                  is_reconciled: false,
                  invoice_number: null,
                  reconciled_at: null,
                  reconciled_by: null
                }
              : {
                  is_reconciled: true,
                  invoice_number: invoiceNumber,
                  reconciled_at: new Date().toISOString(),
                  reconciled_by: profile?.full_name || user?.email?.split('@')[0] || 'Supervisor'
                }

            const undoChanges = orderIds.map((id) => {
              const prevOrder = purchaseOrders.find((p) => p.id === id)
              return {
                rowId: id,
                colId: 'reconciliation',
                oldValue: {
                  is_reconciled: Boolean(prevOrder?.is_reconciled),
                  invoice_number: prevOrder?.invoice_number || null,
                  reconciled_at: prevOrder?.reconciled_at || null,
                  reconciled_by: prevOrder?.reconciled_by || null
                },
                newValue: updates
              }
            })
            grid.pushUndoAction(undoChanges)

            for (const id of orderIds) {
              await supabase.from('purchase_orders').update(updates).eq('id', id)
            }

            setPurchaseOrders((prev) => prev.map((p) => (orderIds.includes(p.id) ? { ...p, ...updates } : p)))
            if (reconcileTarget.mode === 'selected') {
              setSelectedOrderIds(new Set())
            }
            if (isUnreconcile) {
              showFeedbackMsg('success', `Se quitó la conciliación de ${orderIds.length} registro(s).`)
            } else {
              showFeedbackMsg('success', `Se conciliaron ${orderIds.length} compras con comprobante ${invoiceNumber}.`)
            }
            setShowReconcileModal(false)
            setReconcileTarget(null)
          }}
          purchaseOrders={purchaseOrders}
        />
      )}

      {showFreightModal && freightTargetOrder && (
        <FreightModal
          order={freightTargetOrder}
          onClose={() => {
            setShowFreightModal(false)
            setFreightTargetOrder(null)
          }}
          onSuccess={async (freightUpdates) => {
            grid.pushUndoAction([
              {
                rowId: freightTargetOrder.id,
                colId: 'freight',
                oldValue: {
                  freight_transport_name: freightTargetOrder.freight_transport_name || null,
                  freight_request_date: freightTargetOrder.freight_request_date || null,
                  freight_estimated_date: freightTargetOrder.freight_estimated_date || null
                },
                newValue: freightUpdates
              }
            ])

            const { error } = await supabase
              .from('purchase_orders')
              .update({ ...freightUpdates, updated_at: new Date().toISOString() })
              .eq('id', freightTargetOrder.id)

            if (error) {
              showFeedbackMsg('error', 'Error al guardar datos de flete: ' + error.message)
              return
            }

            setPurchaseOrders((prev) =>
              prev.map((p) => (p.id === freightTargetOrder.id ? { ...p, ...freightUpdates } : p))
            )
            showFeedbackMsg('success', 'Datos de flete y transporte guardados correctamente.')
            setShowFreightModal(false)
            setFreightTargetOrder(null)
          }}
        />
      )}

      {showBatchOrderModal && (
        <BatchOrderWhatsAppModal
          selectedOrderIds={selectedOrderIds}
          purchaseOrders={purchaseOrders}
          suppliers={suppliers}
          systemSettings={systemSettings}
          onClose={() => setShowBatchOrderModal(false)}
          onSuccess={(updatedIds) => {
            setPurchaseOrders((prev) => prev.map((p) => (updatedIds.includes(p.id) ? { ...p, status: 'PEDIDO' } : p)))
            setShowBatchOrderModal(false)
            showFeedbackMsg('success', 'Pedidos emitidos por WhatsApp y actualizados a estado PEDIDO.')
          }}
        />
      )}

      {showOrderDocsModal && selectedOrderForDocs && (
        <OrderAttachmentsModal
          order={selectedOrderForDocs}
          documents={documents}
          suppliers={suppliers}
          ships={ships}
          workOrders={workOrders}
          onClose={() => {
            setShowOrderDocsModal(false)
            setSelectedOrderForDocs(null)
          }}
          onDocAdded={(newDoc) => {
            setDocuments((prev) => [newDoc, ...prev])
            showFeedbackMsg('success', 'Documento adjuntado correctamente a la orden.')
          }}
          onDocUpdated={(updatedDoc) => {
            setDocuments((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)))
            showFeedbackMsg('success', 'Documento actualizado correctamente.')
          }}
          onDocDeleted={(deletedId) => {
            setDocuments((prev) => prev.filter((d) => d.id !== deletedId))
            showFeedbackMsg('success', 'Documento eliminado correctamente.')
          }}
        />
      )}

      {showPartialModal && partialDeliveryOrder && (
        <PartialDeliveryModal
          order={partialDeliveryOrder}
          suppliers={suppliers}
          ships={ships}
          workOrders={workOrders}
          onClose={() => {
            setShowPartialModal(false)
            setPartialDeliveryOrder(null)
          }}
          onSuccess={({ originalOrder, childOrder, newDocs }) => {
            setPurchaseOrders((prev) => [childOrder, ...prev.map((p) => (p.id === originalOrder.id ? originalOrder : p))])
            if (newDocs && newDocs.length > 0) {
              setDocuments((prev) => [...newDocs, ...prev])
            }
            setShowPartialModal(false)
            setPartialDeliveryOrder(null)
            showFeedbackMsg('success', `Recepción parcial registrada: ${originalOrder.quantity} unidades ingresadas, ${childOrder.quantity} en reclamo pendiente.`)
          }}
        />
      )}

      {showSeCompraModal && seCompraAlertOrder && (
        <SeCompraAlertModal
          order={seCompraAlertOrder}
          alertSettings={seCompraAlertSettings}
          ships={ships}
          workOrders={workOrders}
          onClose={() => {
            setShowSeCompraModal(false)
            setSeCompraAlertOrder(null)
          }}
        />
      )}

      {showAssignSupplierModal && (
        <AssignSupplierModal
          selectedOrderIds={selectedOrderIds}
          suppliers={suppliers}
          onClose={() => setShowAssignSupplierModal(false)}
          onSuccess={(supplierId) => {
            setPurchaseOrders((prev) =>
              prev.map((p) => (selectedOrderIds.has(p.id) ? { ...p, supplier_id: supplierId } : p))
            )
            const supName = suppliers.find((s) => s.id === supplierId)?.name || 'Proveedor'
            showFeedbackMsg('success', `Proveedor "${supName}" asignado a ${selectedOrderIds.size} pedidos.`)
            setSelectedOrderIds(new Set())
            setShowAssignSupplierModal(false)
          }}
        />
      )}

      <ShipWorkOrderPickerModal
        isOpen={shipPickerModal.isOpen}
        onClose={() => setShipPickerModal({ isOpen: false, orderId: null, shipId: '', workOrderId: '', chargeType: 'DIRECT', contractorName: '' })}
        ships={ships}
        workOrders={workOrders}
        workItems={workItems}
        currentShipId={shipPickerModal.shipId}
        currentWorkOrderId={shipPickerModal.workOrderId}
        currentChargeType={shipPickerModal.chargeType}
        allowAstilleroStock={true}
        contractorName={shipPickerModal.contractorName}
        title="Asignar Buque y Orden de Trabajo (Compras)"
        onSave={async ({ shipId, workOrderId, isAstilleroStock }) => {
          const orderId = shipPickerModal.orderId
          const target = purchaseOrders.find((p) => p.id === orderId)
          if (!target) return

          const astShip = ships.find((s) => s.name === 'ASTILLERO')
          const resolvedShipId = isAstilleroStock ? (astShip?.id || null) : shipId
          const resolvedChargeType = isAstilleroStock || (astShip && resolvedShipId === astShip.id) ? 'VIA_PANOL' : 'DIRECT'

          if (grid?.pushUndoAction) {
            grid.pushUndoAction({
              colKey: 'ship_id',
              colLabel: 'Buque / OT',
              actionLabel: 'Cambio de Buque y OT',
              previousValues: { [orderId]: { ship_id: target.ship_id, work_order_id: target.work_order_id, charge_type: target.charge_type } },
              newValue: { ship_id: resolvedShipId, work_order_id: workOrderId, charge_type: resolvedChargeType },
              timestamp: Date.now()
            })
          }

          setPurchaseOrders((prev) =>
            prev.map((p) => (p.id === orderId ? { ...p, ship_id: resolvedShipId, work_order_id: workOrderId, charge_type: resolvedChargeType } : p))
          )

          try {
            const { error } = await supabase
              .from('purchase_orders')
              .update({
                ship_id: resolvedShipId,
                work_order_id: workOrderId,
                charge_type: resolvedChargeType,
                updated_at: new Date().toISOString()
              })
              .eq('id', orderId)
            if (error) throw error
            if (!workOrderId) {
              showFeedbackMsg('success', 'Destino asignado. OT dejada en blanco (sumada a KPI Falta Cargar OT).')
            } else {
              showFeedbackMsg('success', 'Buque y OT asignados con éxito.')
            }
          } catch (err) {
            console.error('Error guardando Buque y OT en Compras:', err)
            showFeedbackMsg('error', 'Error al guardar Buque y OT: ' + err.message)
            if (fetchData) fetchData()
          }
        }}
      />

      <ContractorPickerModal
        isOpen={contractorPickerModal.isOpen}
        onClose={() => setContractorPickerModal({ isOpen: false, orderId: null, currentValue: '', shipName: '', workOrderTitle: '', isOtBlank: true })}
        currentValue={contractorPickerModal.currentValue}
        shipName={contractorPickerModal.shipName}
        workOrderTitle={contractorPickerModal.workOrderTitle}
        isOtBlank={contractorPickerModal.isOtBlank}
        astilleroWorkers={astilleroWorkers}
        contractorGroups={contractorGroups}
        extraOptions={[
          { name: 'PAÑOL', label: 'PAÑOL (Central / Reposición de Stock)' },
          { name: 'ADMINISTRACION', label: 'ADMINISTRACION' },
          { name: 'OFICINA TECNICA', label: 'OFICINA TECNICA' },
          { name: 'MANTENIMIENTO', label: 'MANTENIMIENTO' },
          { name: 'CALIDAD / SEGURIDAD', label: 'CALIDAD / SEGURIDAD' }
        ]}
        title="Asignar Solicitante (Compras)"
        onSelect={(selectedName) => {
          if (contractorPickerModal.orderId) {
            saveInlineEdit(contractorPickerModal.orderId, 'requested_by_name', selectedName)
          }
        }}
      />

      {showSupplierHelperModal && supplierHelperTarget && (
        <SupplierHelperModal
          order={supplierHelperTarget}
          purchaseOrders={purchaseOrders}
          suppliers={suppliers}
          ships={ships}
          workOrders={workOrders}
          onClose={() => {
            setShowSupplierHelperModal(false)
            setSupplierHelperTarget(null)
          }}
          onApply={handleApplySupplierHelper}
        />
      )}

      {showMandadosModal && (
        <MandadosModal
          purchaseOrders={purchaseOrders}
          suppliers={suppliers}
          workers={workers}
          preselectedIds={mandadosPreselectedIds}
          onDispatched={(dispatchedIds, info) => {
            setPurchaseOrders((prev) =>
              prev.map((p) => (dispatchedIds.includes(p.id) ? { ...p, ...info } : p))
            )
            setSelectedOrderIds(new Set())
            showFeedbackMsg('success', `🛵 Retiro de mandado registrado para ${dispatchedIds.length} ítem(s).`)
          }}
          onClose={() => {
            setShowMandadosModal(false)
            setMandadosPreselectedIds([])
          }}
        />
      )}
    </>
  )
}
