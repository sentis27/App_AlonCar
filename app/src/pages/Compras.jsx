import { useState, useEffect, useMemo, useRef } from 'react'
import {
  ShoppingCart,
  Package,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  FileText,
  Paperclip,
  TrendingUp,
  TrendingDown,
  Trash2,
  Edit3,
  ExternalLink,
  X,
  ChevronDown,
  Sparkles,
  DollarSign,
  Calendar,
  Building2,
  Phone,
  Mail,
  MessageSquare,
  Eye,
  Download,
  RefreshCw,
  SlidersHorizontal,
  Layers,
  ShieldAlert,
  Check,
  RotateCcw,
  FileCheck,
  CheckSquare,
  Square,
  HelpCircle,
  Truck,
  Flame,
  ArrowRight
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Estados válidos según GS-006
const STATUS_OPTIONS = [
  { value: 'TODOS', label: 'Todos los Estados' },
  { value: 'PEDIR', label: 'PEDIR (Por Emitir)', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  { value: 'PEDIDO', label: 'PEDIDO (Emitido a Prov.)', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  { value: 'COTIZACION', label: 'COTIZACION (En Evaluación)', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40' },
  { value: 'COTIZAR', label: 'COTIZAR (A Pedir Precio)', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
  { value: 'COTIZA.SOLICITUD', label: 'COTIZA.SOLICITUD (Esperando)', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40' },
  { value: 'COTIZA.APROBADA', label: 'COTIZA.APROBADA (Aprobada)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  { value: 'COTIZA.RECHAZADA', label: 'COTIZA.RECHAZADA (Rechazada)', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  { value: 'RECIBIDO', label: 'RECIBIDO (Ingresó a Pañol)', color: 'bg-emerald-500/30 text-emerald-200 border-emerald-400/50' },
  { value: 'RECIB.COMP.DIRECT', label: 'RECIB.COMP.DIRECT (Imputado a Buque)', color: 'bg-cyan-500/30 text-cyan-200 border-cyan-400/50' },
  { value: 'RECIBIDO 2', label: 'RECIBIDO 2 (Material de Cliente)', color: 'bg-slate-500/20 text-slate-300 border-slate-500/40' },
  { value: 'PEDIDO INCOMPLETO', label: 'PEDIDO INCOMPLETO (Parcial)', color: 'bg-orange-500/20 text-orange-300 border-orange-500/40' },
  { value: 'SE COMPRA?', label: 'SE COMPRA? (Duda)', color: 'bg-pink-500/20 text-pink-300 border-pink-500/40' },
  { value: 'CANCELADOS', label: 'CANCELADOS', color: 'bg-red-500/20 text-red-400 border-red-500/40' },
  { value: 'NO VENDEN', label: 'NO VENDEN', color: 'bg-slate-700/50 text-slate-400 border-slate-600' }
]

export default function Compras() {
  const { profile, user } = useAuth()
  const isSupervisor = profile?.role === 'Supervisor' || profile?.role === 'Gerencia' || profile?.role === 'Admin'

  // Estados principales
  const [activeTab, setActiveTab] = useState('compras') // 'compras', 'proveedores', 'documentos'
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState(null)

  // Datos de base de datos
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [materials, setMaterials] = useState([])
  const [ships, setShips] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [workers, setWorkers] = useState([])
  const [macroVariables, setMacroVariables] = useState([])
  const [documents, setDocuments] = useState([])

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSupplier, setFilterSupplier] = useState('TODOS')
  const [filterStatus, setFilterStatus] = useState('TODOS')
  const [filterFortnight, setFilterFortnight] = useState('TODAS')
  const [filterChargeType, setFilterChargeType] = useState('TODOS') // 'TODOS', 'DIRECT', 'VIA_PANOL'
  const [filterNewOnly, setFilterNewOnly] = useState(false)
  const [hideReconciled, setHideReconciled] = useState(false)

  // Selección de filas (para totales y acciones en lote)
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set())

  // Modales
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)

  const [showNewMaterialModal, setShowNewMaterialModal] = useState(false)
  const [pendingMaterialOrder, setPendingMaterialOrder] = useState(null)

  const [showDocModal, setShowDocModal] = useState(false)
  const [docTargetOrder, setDocTargetOrder] = useState(null)

  const [showReconcileModal, setShowReconcileModal] = useState(false)
  const [reconcileTarget, setReconcileTarget] = useState(null) // { supplierId, orderId, orderDate }

  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)

  const [showBatchOrderModal, setShowBatchOrderModal] = useState(false)

  // Carga inicial
  useEffect(() => {
    fetchData()
  }, [])

  function showFeedbackMsg(type, text) {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 5000)
  }

  async function fetchData() {
    setLoading(true)
    try {
      const [poRes, supRes, matRes, shpRes, woRes, wkrRes, mvRes, docRes] = await Promise.all([
        supabase.from('purchase_orders').select('*').order('order_date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('materials').select('*').order('name'),
        supabase.from('ships').select('id, name, vessel_type').order('name'),
        supabase.from('work_orders').select('id, ot_number, title, ship_id').order('ot_number'),
        supabase.from('workers').select('id, name, trade').order('name'),
        supabase.from('macro_variables').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
        supabase.from('purchase_documents').select('*').order('created_at', { ascending: false })
      ])

      if (poRes.error) console.warn('Aviso purchase_orders:', poRes.error.message)
      if (supRes.error) console.warn('Aviso suppliers:', supRes.error.message)
      if (matRes.error) console.warn('Aviso materials:', matRes.error.message)
      if (shpRes.error) console.warn('Aviso ships:', shpRes.error.message)
      if (woRes.error) console.warn('Aviso work_orders:', woRes.error.message)
      if (wkrRes.error) console.warn('Aviso workers:', wkrRes.error.message)
      if (mvRes.error) console.warn('Aviso macro_variables:', mvRes.error.message)
      if (docRes.error) console.warn('Aviso purchase_documents:', docRes.error.message)

      setPurchaseOrders(poRes.data || [])
      setSuppliers(supRes.data || [])
      setMaterials(matRes.data || [])
      setShips(shpRes.data || [])
      setWorkOrders(woRes.data || [])
      setWorkers(wkrRes.data || [])
      setMacroVariables(mvRes.data || [])
      setDocuments(docRes.data || [])
    } catch (err) {
      console.error('Error cargando Compras:', err)
      showFeedbackMsg('error', 'Error al sincronizar datos de Compras: ' + (err.message || err))
    } finally {
      setLoading(false)
    }
  }

  // Cotización del dólar quincenal oficial según fecha
  function getDollarRateForDate(dateStr) {
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
  }

  // Quincena actual del sistema
  const currentFortnight = useMemo(() => {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const q = now.getDate() <= 15 ? 'Q1' : 'Q2'
    return `${y}-${m}-${q}`
  }, [])

  // Lista de quincenas disponibles
  const availableFortnights = useMemo(() => {
    const set = new Set()
    purchaseOrders.forEach((po) => {
      if (po.fortnight_period) set.add(po.fortnight_period)
    })
    set.add(currentFortnight)
    return Array.from(set).sort().reverse()
  }, [purchaseOrders, currentFortnight])

  // KPIs superiores
  const kpis = useMemo(() => {
    let pendingQuotes = 0
    let expiredQuotes = 0
    let pendingOrders = 0
    let pendingReceives = 0
    let newMaterialsCount = 0

    const now = new Date()

    purchaseOrders.forEach((po) => {
      if (po.is_new_material) newMaterialsCount++

      // Cotizaciones
      if (['COTIZACION', 'COTIZAR', 'COTIZA.SOLICITUD'].includes(po.status)) {
        pendingQuotes++
        const orderDate = new Date(po.order_date)
        const diffDays = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24))
        if (diffDays > 7) expiredQuotes++
      }

      // Pedidos emitidos
      if (po.status === 'PEDIDO') {
        pendingOrders++
      }

      // Sin recibir
      if (['PEDIDO', 'COTIZA.APROBADA', 'PEDIDO INCOMPLETO'].includes(po.status)) {
        pendingReceives++
      }
    })

    return {
      pendingQuotes,
      expiredQuotes,
      pendingOrders,
      pendingReceives,
      newMaterialsCount
    }
  }, [purchaseOrders])

  // Filtrado de pedidos
  const filteredOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      // Texto de búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const mat = (po.material_name_raw || '').toLowerCase()
        const obs = (po.observations || '').toLowerCase()
        const req = (po.requested_by_name || '').toLowerCase()
        const inv = (po.invoice_number || '').toLowerCase()
        const sup = suppliers.find((s) => s.id === po.supplier_id)?.name.toLowerCase() || ''
        const shp = ships.find((s) => s.id === po.ship_id)?.name.toLowerCase() || ''
        const matches = mat.includes(q) || obs.includes(q) || req.includes(q) || inv.includes(q) || sup.includes(q) || shp.includes(q)
        if (!matches) return false
      }

      // Filtro proveedor
      if (filterSupplier !== 'TODOS' && po.supplier_id !== filterSupplier) return false

      // Filtro estado
      if (filterStatus !== 'TODOS' && po.status !== filterStatus) return false

      // Filtro quincena
      if (filterFortnight !== 'TODAS' && po.fortnight_period !== filterFortnight) return false

      // Filtro tipo carga
      if (filterChargeType !== 'TODOS' && po.charge_type !== filterChargeType) return false

      // Solo nuevos sin registro
      if (filterNewOnly && !po.is_new_material) return false

      // Ocultar conciliados
      if (hideReconciled && po.is_reconciled) return false

      return true
    })
  }, [purchaseOrders, searchQuery, filterSupplier, filterStatus, filterFortnight, filterChargeType, filterNewOnly, hideReconciled, suppliers, ships])

  // Estadísticas de la barra inferior (Selección manual vs Todo el filtro)
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
  }, [selectedOrderIds, filteredOrders, purchaseOrders, macroVariables])

  // Selección de filas
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

  // Cambio rápido de estado
  async function handleQuickStatusChange(orderId, newStatus) {
    try {
      const order = purchaseOrders.find((p) => p.id === orderId)
      if (!order) return

      const updates = {
        status: newStatus,
        updated_at: new Date().toISOString()
      }

      // Si pasa a RECIBIDO y es Pañol, podríamos incrementar stock
      if (newStatus === 'RECIBIDO' && order.charge_type === 'VIA_PANOL' && order.material_id) {
        // Incremento en materials
        const mat = materials.find((m) => m.id === order.material_id)
        if (mat) {
          const newStock = (mat.current_stock || 0) + Number(order.quantity)
          await supabase.from('materials').update({ current_stock: newStock }).eq('id', mat.id)
          setMaterials((prev) => prev.map((m) => (m.id === mat.id ? { ...m, current_stock: newStock } : m)))
        }
      }

      const { error } = await supabase.from('purchase_orders').update(updates).eq('id', orderId)
      if (error) throw error

      setPurchaseOrders((prev) => prev.map((p) => (p.id === orderId ? { ...p, ...updates } : p)))
      showFeedbackMsg('success', `Estado actualizado a "${newStatus}"`)
    } catch (err) {
      console.error('Error cambiando estado:', err)
      showFeedbackMsg('error', 'Error al actualizar estado: ' + err.message)
    }
  }

  // Eliminar pedido
  async function handleDeleteOrder(id) {
    if (!confirm('¿Estás seguro de eliminar este registro de compra?')) return
    try {
      const { error } = await supabase.from('purchase_orders').delete().eq('id', id)
      if (error) throw error
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

  // Acción masiva: Recibir en lote
  async function handleBatchReceive() {
    if (selectedOrderIds.size === 0) return
    if (!confirm(`¿Marcar los ${selectedOrderIds.size} pedidos seleccionados como RECIBIDOS?`)) return

    try {
      const ids = Array.from(selectedOrderIds)
      for (const id of ids) {
        const po = purchaseOrders.find((p) => p.id === id)
        if (po) {
          const targetStatus = po.charge_type === 'DIRECT' ? 'RECIB.COMP.DIRECT' : 'RECIBIDO'
          await handleQuickStatusChange(id, targetStatus)
        }
      }
      setSelectedOrderIds(new Set())
      showFeedbackMsg('success', `Se marcaron ${ids.length} pedidos como recibidos con éxito.`)
    } catch (err) {
      console.error('Error en recepción masiva:', err)
      showFeedbackMsg('error', 'Error en recepción masiva: ' + err.message)
    }
  }

  // Acción masiva: Pedir por WhatsApp en lote (Agrupado por Proveedor)
  const batchOrderData = useMemo(() => {
    if (!showBatchOrderModal) return []
    const selected = purchaseOrders.filter((p) => selectedOrderIds.has(p.id))

    // Agrupar por proveedor
    const map = new Map()
    selected.forEach((po) => {
      const sup = suppliers.find((s) => s.id === po.supplier_id) || { id: 'unknown', name: 'Sin Proveedor Asignado', phone: '' }
      if (!map.has(sup.id)) {
        map.set(sup.id, { supplier: sup, items: [] })
      }
      map.get(sup.id).items.push(po)
    })

    return Array.from(map.values())
  }, [showBatchOrderModal, selectedOrderIds, purchaseOrders, suppliers])

  function buildWhatsAppText(supplierName, items) {
    let text = `*SOLICITUD DE COMPRA - ALON CAR S.A.*\n`
    text += `Estimados *${supplierName}*,\n`
    text += `Por medio de la presente solicitamos cotización/entrega de los siguientes materiales:\n\n`

    items.forEach((item, idx) => {
      text += `*${idx + 1}.* ${item.material_name_raw} — Cantidad: *${item.quantity} ${item.unit_measure || 'Unidades'}*`
      if (item.observations) text += ` _(Nota: ${item.observations})_`
      text += `\n`
    })

    text += `\n_Por favor confirmar disponibilidad, plazos de entrega y forma de facturación._\n`
    text += `Muchas gracias.\n*Astillero & Metalúrgica Alon Car S.A.*`
    return encodeURIComponent(text)
  }

  async function handleEmitBatchOrderWhatsApp(supplier, items) {
    const rawPhone = (supplier.phone || '').replace(/[^0-9]/g, '')
    const encodedText = buildWhatsAppText(supplier.name, items)
    const url = rawPhone ? `https://api.whatsapp.com/send?phone=${rawPhone}&text=${encodedText}` : `https://api.whatsapp.com/send?text=${encodedText}`

    // Marcar como PEDIDO
    try {
      const ids = items.map((i) => i.id)
      for (const id of ids) {
        await supabase.from('purchase_orders').update({ status: 'PEDIDO', updated_at: new Date().toISOString() }).eq('id', id)
      }
      setPurchaseOrders((prev) => prev.map((p) => (ids.includes(p.id) ? { ...p, status: 'PEDIDO' } : p)))
      window.open(url, '_blank')
      showFeedbackMsg('success', `Pedido abierto en WhatsApp y estado cambiado a PEDIDO para ${supplier.name}`)
    } catch (err) {
      console.error('Error emitiendo pedido:', err)
      showFeedbackMsg('error', 'Error emitiendo pedido: ' + err.message)
    }
  }

  return (
    <div className="space-y-4 pb-24">
      {/* ========================================================= */}
      {/* CABECERA PRINCIPAL Y PESTAÑAS */}
      {/* ========================================================= */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-xl border border-slate-800 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-slate-950">
            <ShoppingCart className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
              MÓDULO DE COMPRAS
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 uppercase">
                M4b / GS-006
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              Gestión de insumos, cotizaciones, compras directas de obra, reposición de pañol y conciliación con factura.
            </p>
          </div>
        </div>

        {/* Pestañas & Botón Cargar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center text-xs">
            <button
              onClick={() => setActiveTab('compras')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                activeTab === 'compras' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              📋 Registro Compras
            </button>
            <button
              onClick={() => setActiveTab('proveedores')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                activeTab === 'proveedores' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              🏢 Proveedores ({suppliers.length})
            </button>
            <button
              onClick={() => setActiveTab('documentos')}
              className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                activeTab === 'documentos' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
              }`}
            >
              📎 Archivo Docs ({documents.length})
            </button>
          </div>

          <button
            onClick={() => {
              setEditingOrder(null)
              setShowOrderModal(true)
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Cargar Pedido</span>
          </button>
        </div>
      </div>

      {/* FEEDBACK ALERT */}
      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA 1: REGISTRO DE COMPRAS (TAB PRINCIPAL) */}
      {/* ========================================================= */}
      {activeTab === 'compras' && (
        <>
          {/* TARJETAS DE KPIs SUPERIORES */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* KPI 1: Pedidos Emitidos / En curso */}
            <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Pedidos en Proveedor</p>
                <p className="text-2xl font-black text-blue-400 mt-1">{kpis.pendingOrders}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Órdenes activas en espera</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                <Truck className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 2: Cotizaciones Pendientes */}
            <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cotizaciones en Curso</p>
                  {kpis.expiredQuotes > 0 && (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse">
                      {kpis.expiredQuotes} vencida{kpis.expiredQuotes > 1 ? 's' : ''}
                    </span>
                  )}
                </div>
                <p className="text-2xl font-black text-purple-400 mt-1">{kpis.pendingQuotes}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Evaluación de precios</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <FileText className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 3: Sin Recibir en Astillero */}
            <div className="bg-slate-900/60 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Compras sin Recibir</p>
                <p className="text-2xl font-black text-amber-400 mt-1">{kpis.pendingReceives}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">Pendientes de ingreso físico/obra</p>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            {/* KPI 4: Regla P-02 Alertas de Gases (Air Liquide y Praxair) */}
            <div className="bg-gradient-to-br from-cyan-950/40 to-slate-900/90 border border-cyan-800/40 p-3.5 rounded-xl flex items-center justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <Flame className="w-3.5 h-3.5 text-cyan-400" />
                  <p className="text-[10px] uppercase font-bold text-cyan-300 tracking-wider">Reposición Gases (P-02)</p>
                </div>
                <p className="text-xs font-bold text-white mt-1 truncate">Air Liquide: Martes &lt;12hs</p>
                <p className="text-[10px] text-slate-400 truncate">Cliente N° 2234867 | Tel: 0810-222-5272</p>
              </div>
              <button
                onClick={() => {
                  setFilterSupplier(suppliers.find((s) => s.is_gas_supplier)?.id || 'TODOS')
                  showFeedbackMsg('success', 'Filtro aplicado a proveedores de gases industriales.')
                }}
                className="px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-[10px] font-bold shrink-0 transition-all cursor-pointer"
                title="Filtrar compras de gases"
              >
                Ver Gases
              </button>
            </div>
          </div>

          {/* BARRA DE FILTROS & HERRAMIENTAS */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
            {/* Buscador */}
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por material, proveedor, buque, solicitante, factura..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2.5 text-slate-500 hover:text-white">
                  ✕
                </button>
              )}
            </div>

            {/* Selectores */}
            <div className="flex flex-wrap items-center gap-2">
              {/* Proveedor */}
              <select
                value={filterSupplier}
                onChange={(e) => setFilterSupplier(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="TODOS">Todos los Proveedores</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.is_gas_supplier ? '💨' : ''}
                  </option>
                ))}
              </select>

              {/* Estado */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                {STATUS_OPTIONS.map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>

              {/* Quincena */}
              <select
                value={filterFortnight}
                onChange={(e) => setFilterFortnight(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="TODAS">Todas las Quincenas</option>
                {availableFortnights.map((fn) => (
                  <option key={fn} value={fn}>
                    {fn === currentFortnight ? `★ ${fn} (Actual)` : fn}
                  </option>
                ))}
              </select>

              {/* Tipo de Carga */}
              <select
                value={filterChargeType}
                onChange={(e) => setFilterChargeType(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
              >
                <option value="TODOS">Todos los Destinos</option>
                <option value="DIRECT">Directo para Obra</option>
                <option value="VIA_PANOL">Para Pañol / Stock</option>
                <option value="STANDBY">Stand-by en Depósito</option>
              </select>
            </div>

            {/* Alternadores Rápidos */}
            <div className="flex items-center gap-2 border-l border-slate-800 pl-3">
              <button
                onClick={() => setFilterNewOnly(!filterNewOnly)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  filterNewOnly
                    ? 'bg-rose-950 border border-rose-500 text-rose-300'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Filtrar materiales que no existen en base maestra"
              >
                <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
                <span>Nuevos s/reg ({kpis.newMaterialsCount})</span>
              </button>

              <button
                onClick={() => setHideReconciled(!hideReconciled)}
                className={`px-2.5 py-1.5 rounded-lg font-semibold transition-all flex items-center gap-1.5 ${
                  hideReconciled
                    ? 'bg-purple-950 border border-purple-500 text-purple-300'
                    : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                }`}
                title="Ocultar las compras que ya fueron conciliadas con factura"
              >
                <span>🟣 Ocultar Conciliados</span>
              </button>
            </div>
          </div>

          {/* ========================================================= */}
          {/* GRILLA MAESTRA DE COMPRAS CON STICKY HEADERS */}
          {/* ========================================================= */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto max-h-[600px] overflow-y-auto relative">
              <table className="w-full text-left text-xs border-collapse">
                {/* STICKY HEADER TIPO EXCEL */}
                <thead className="sticky top-0 z-20 bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 shadow-sm">
                  <tr>
                    <th className="py-2.5 px-3 w-10 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-slate-400 hover:text-cyan-400 transition-colors"
                        title={isAllFilteredSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                      >
                        {isAllFilteredSelected ? <CheckSquare className="w-4 h-4 text-cyan-400" /> : <Square className="w-4 h-4" />}
                      </button>
                    </th>
                    <th className="py-2.5 px-3">Fecha / Quincena</th>
                    <th className="py-2.5 px-3">Destino</th>
                    <th className="py-2.5 px-3">Buque / OT</th>
                    <th className="py-2.5 px-3">Solicita</th>
                    <th className="py-2.5 px-3">Material Solicitado</th>
                    <th className="py-2.5 px-3 text-right">Cant.</th>
                    <th className="py-2.5 px-3 text-right">$/U Proveedor</th>
                    <th className="py-2.5 px-3 text-right">$/U Sistema</th>
                    <th className="py-2.5 px-3">Proveedor</th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3 text-center">Doc</th>
                    <th className="py-2.5 px-3 text-center">Conciliado</th>
                    <th className="py-2.5 px-3 text-center">Acciones</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {loading ? (
                    <tr>
                      <td colSpan="14" className="text-center py-12 text-slate-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                        Cargando registro maestro de compras...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan="14" className="text-center py-12 text-slate-500">
                        No se encontraron registros de compra con los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((po, index) => {
                      const isSelected = selectedOrderIds.has(po.id)
                      const sup = suppliers.find((s) => s.id === po.supplier_id)
                      const shp = ships.find((s) => s.id === po.ship_id)
                      const wo = workOrders.find((w) => w.id === po.work_order_id)
                      const doc = documents.find((d) => d.purchase_order_id === po.id)

                      // Cálculo de diferencia de precio proveedor vs sistema
                      const quoted = Number(po.supplier_quoted_price) || 0
                      const system = Number(po.system_unit_price) || 0
                      let deltaPct = null
                      if (quoted > 0 && system > 0) {
                        deltaPct = Math.round(((quoted - system) / system) * 100)
                      }

                      // Verificar si es la última fila conciliada de este proveedor para trazar la LÍNEA MORADA
                      const nextOrder = filteredOrders[index + 1]
                      const showPurpleLine =
                        po.is_reconciled &&
                        (!nextOrder || !nextOrder.is_reconciled || nextOrder.supplier_id !== po.supplier_id)

                      return (
                        <tr
                          key={po.id}
                          className={`group transition-colors ${
                            isSelected
                              ? 'bg-cyan-950/30 hover:bg-cyan-950/40'
                              : po.is_reconciled
                              ? 'bg-slate-900/40 hover:bg-slate-800/40 text-slate-300'
                              : 'hover:bg-slate-800/50'
                          }`}
                        >
                          {/* 1. Checkbox */}
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSelectRow(po.id)}
                              className="text-slate-500 hover:text-cyan-400 transition-colors"
                            >
                              {isSelected ? <CheckSquare className="w-4 h-4 text-cyan-400" /> : <Square className="w-4 h-4" />}
                            </button>
                          </td>

                          {/* 2. Fecha / Quincena */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <div className="font-mono text-slate-200">{po.order_date}</div>
                            <div className="text-[10px] text-slate-500 font-mono">{po.fortnight_period}</div>
                          </td>

                          {/* 3. Destino */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            {po.charge_type === 'DIRECT' ? (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold text-[10px]">
                                DIRECTO
                              </span>
                            ) : po.charge_type === 'VIA_PANOL' ? (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold text-[10px]">
                                PAÑOL / STOCK
                              </span>
                            ) : (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300 text-[10px]">
                                {po.charge_type}
                              </span>
                            )}
                          </td>

                          {/* 4. Buque / OT */}
                          <td className="py-2 px-3">
                            <div className="font-semibold text-slate-200 truncate max-w-[140px]" title={shp?.name || 'ASTILLERO'}>
                              {shp?.name || 'ASTILLERO'}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate max-w-[140px]" title={wo?.title || 'STOCK'}>
                              {wo?.title || 'STOCK GENERAL'}
                            </div>
                          </td>

                          {/* 5. Solicita */}
                          <td className="py-2 px-3 text-slate-300 whitespace-nowrap">{po.requested_by_name || 'PAÑOL'}</td>

                          {/* 6. Material */}
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-white">{po.material_name_raw}</span>
                              {po.is_new_material && (
                                <button
                                  onClick={() => {
                                    setPendingMaterialOrder(po)
                                    setShowNewMaterialModal(true)
                                  }}
                                  className="px-1.5 py-0.2 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/50 text-[9px] font-bold inline-flex items-center gap-1 cursor-pointer"
                                  title="Material sin registro. Clic para formalizar alta."
                                >
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  <span>Alta</span>
                                </button>
                              )}
                            </div>
                            {po.observations && (
                              <p className="text-[10px] text-slate-400 italic truncate max-w-[200px]" title={po.observations}>
                                {po.observations}
                              </p>
                            )}
                          </td>

                          {/* 7. Cantidad */}
                          <td className="py-2 px-3 text-right whitespace-nowrap font-mono">
                            <span className="font-bold text-white">{po.quantity}</span>{' '}
                            <span className="text-[10px] text-slate-500">{po.unit_measure || 'u'}</span>
                          </td>

                          {/* 8. $/U Proveedor */}
                          <td className="py-2 px-3 text-right whitespace-nowrap font-mono">
                            {po.supplier_quoted_price ? (
                              <span className="text-slate-200 font-semibold">${Number(po.supplier_quoted_price).toLocaleString('es-AR')}</span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          {/* 9. $/U Sistema + Semáforo */}
                          <td className="py-2 px-3 text-right whitespace-nowrap font-mono">
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
                          </td>

                          {/* 10. Proveedor */}
                          <td className="py-2 px-3">
                            <div className="flex items-center justify-between gap-1 max-w-[140px]">
                              <span className="truncate font-semibold text-slate-200" title={sup?.name || 'S/D'}>
                                {sup?.name || 'S/D'}
                              </span>
                              {sup?.phone && (
                                <button
                                  type="button"
                                  onClick={() => handleEmitBatchOrderWhatsApp(sup, [po])}
                                  className="text-emerald-400 hover:text-emerald-300 p-0.5 transition-colors"
                                  title={`Enviar pedido a WhatsApp de ${sup.name}`}
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 11. Estado */}
                          <td className="py-2 px-3 whitespace-nowrap">
                            <select
                              value={po.status}
                              onChange={(e) => handleQuickStatusChange(po.id, e.target.value)}
                              className="bg-slate-950 border border-slate-800 rounded px-1.5 py-0.5 text-[11px] font-medium text-slate-300 focus:outline-none focus:border-cyan-500"
                            >
                              {STATUS_OPTIONS.filter((s) => s.value !== 'TODOS').map((st) => (
                                <option key={st.value} value={st.value}>
                                  {st.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          {/* 12. Doc Gestor Documental */}
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            {doc ? (
                              <a
                                href={doc.storage_path}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 bg-cyan-950 border border-cyan-800 text-cyan-300 rounded text-[10px] font-bold hover:bg-cyan-900 transition-colors"
                                title={`Ver: ${doc.original_filename}`}
                              >
                                <FileText className="w-3 h-3" />
                                <span>Ver</span>
                              </a>
                            ) : (
                              <button
                                onClick={() => {
                                  setDocTargetOrder(po)
                                  setShowDocModal(true)
                                }}
                                className="text-slate-500 hover:text-cyan-400 p-1 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Adjuntar comprobante o cotización (1-Clic)"
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </td>

                          {/* 13. Conciliado */}
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            {po.is_reconciled ? (
                              <span
                                className="inline-flex items-center gap-1 text-purple-400 font-bold text-[10px] bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-800/50"
                                title={`Factura: ${po.invoice_number || 'S/D'} (Conciliado por ${po.reconciled_by || 'Supervisor'})`}
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                                <span>Facturado</span>
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  setReconcileTarget({
                                    supplierId: po.supplier_id,
                                    orderId: po.id,
                                    orderDate: po.order_date,
                                    supplierName: sup?.name
                                  })
                                  setShowReconcileModal(true)
                                }}
                                className="text-slate-500 hover:text-purple-400 text-[10px] underline cursor-pointer"
                                title="Conciliar hasta este pedido con factura"
                              >
                                Conciliar
                              </button>
                            )}
                          </td>

                          {/* 14. Acciones */}
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1">
                              <button
                                onClick={() => {
                                  setEditingOrder(po)
                                  setShowOrderModal(true)
                                }}
                                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Editar pedido"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
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
          </div>

          {/* ========================================================= */}
          {/* BARRA DE TOTALES Y ESTADÍSTICAS REACTIVA (TIPO SHEETS / EXCEL) */}
          {/* ========================================================= */}
          <div className="fixed bottom-4 left-4 right-4 md:left-64 z-40 bg-slate-950/95 border border-slate-800 rounded-2xl shadow-2xl px-4 py-2.5 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs animate-in slide-in-from-bottom duration-200">
            {/* Indicador de modo */}
            <div className="flex items-center gap-3">
              {stats.isCustomSelection ? (
                <div className="flex items-center gap-2 bg-cyan-950/80 border border-cyan-500/60 px-2.5 py-1 rounded-lg text-cyan-300 font-bold">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                  <span>📌 Selección Manual: {stats.count} pedidos</span>
                  <button
                    type="button"
                    onClick={() => setSelectedOrderIds(new Set())}
                    className="ml-1 text-cyan-400 hover:text-white transition-colors cursor-pointer text-xs underline"
                    title="Limpiar selección"
                  >
                    ✕ Limpiar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 px-2.5 py-1 rounded-lg text-slate-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>🌐 Todo el filtro: {stats.count} pedidos</span>
                  <span className="text-[10px] text-slate-500 italic hidden sm:inline">(Clic en casillas para sumar a tu antojo)</span>
                </div>
              )}
            </div>

            {/* Métricas calculadas en vivo */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-5 font-mono">
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Σ Cant:</span>
                <span className="text-xs font-bold text-white">{stats.sumQty}</span>
              </div>

              <div className="flex items-baseline gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                <span className="text-[10px] uppercase font-bold text-slate-400">Σ AR$:</span>
                <span className="text-sm font-extrabold text-cyan-300">${stats.sumCostArs.toLocaleString('es-AR')}</span>
              </div>

              <div className="flex items-baseline gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Σ US$:</span>
                <span className="text-xs font-bold text-white">
                  ${stats.sumCostUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              <div className="flex items-baseline gap-1 hidden lg:flex">
                <span className="text-[10px] uppercase font-bold text-slate-500">Ø:</span>
                <span className="text-xs font-semibold text-slate-300">${Math.round(stats.avgPriceArs).toLocaleString('es-AR')}</span>
              </div>
            </div>

            {/* Botones de acción masiva */}
            {selectedOrderIds.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBatchOrderModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded-lg text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                  title="Abrir WhatsApp agrupado por proveedor"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Pedir Agrupado ({selectedOrderIds.size})</span>
                </button>

                <button
                  type="button"
                  onClick={handleBatchReceive}
                  className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
                  title="Marcar seleccionados como recibidos"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Recibir ({selectedOrderIds.size})</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}

      {/* ========================================================= */}
      {/* VISTA 2: CATÁLOGO UNIFICADO DE PROVEEDORES */}
      {/* ========================================================= */}
      {activeTab === 'proveedores' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between bg-slate-900/60 p-3 rounded-xl border border-slate-800">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Catálogo Unificado de Proveedores
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                  {suppliers.length} activos
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Alimenta Compras, Pañol (circuitos de gases P-02) y Talleres Tercerizados.
              </p>
            </div>
            <button
              onClick={() => {
                setEditingSupplier(null)
                setShowSupplierModal(true)
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nuevo Proveedor</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {suppliers.map((sup) => (
              <div
                key={sup.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between hover:border-slate-700 transition-all shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-white text-sm">{sup.name}</h3>
                    {sup.is_gas_supplier && (
                      <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 text-[10px] font-bold shrink-0">
                        💨 GASES
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase font-semibold">
                      {sup.trade || 'GENERAL'}
                    </span>
                    {sup.cuit_cuil && <span className="text-[10px] text-slate-500 font-mono">CUIT: {sup.cuit_cuil}</span>}
                  </div>

                  <div className="mt-3 space-y-1 text-xs text-slate-300">
                    {sup.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="font-mono">{sup.phone}</span>
                      </div>
                    )}
                    {sup.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="truncate">{sup.email}</span>
                      </div>
                    )}
                    {sup.contact_name && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <span>Contacto: {sup.contact_name}</span>
                      </div>
                    )}
                  </div>

                  {/* Datos especiales de Gases P-02 */}
                  {sup.is_gas_supplier && (
                    <div className="mt-3 p-2 bg-slate-950 rounded-lg border border-cyan-900/40 text-[10px] text-cyan-200 space-y-0.5">
                      <p className="font-bold text-cyan-400">Circuito de Reposición (Regla P-02):</p>
                      {sup.client_number && <p>N° Cliente: <span className="font-mono font-bold text-white">{sup.client_number}</span></p>}
                      {sup.order_cutoff_day && <p>Corte de Pedido: {sup.order_cutoff_day}</p>}
                      {sup.delivery_day && <p>Día de Entrega: {sup.delivery_day}</p>}
                    </div>
                  )}

                  {sup.observations && (
                    <p className="mt-2 text-[10px] text-slate-400 italic line-clamp-2">{sup.observations}</p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-500">Pago: {sup.payment_method || 'Cta Cte'}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingSupplier(sup)
                        setShowSupplierModal(true)
                      }}
                      className="px-2 py-1 text-slate-400 hover:text-white rounded bg-slate-800 hover:bg-slate-700 text-xs transition-colors"
                    >
                      Editar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA 3: ARCHIVO HISTÓRICO Y GESTOR DOCUMENTAL (1-CLIC) */}
      {/* ========================================================= */}
      {activeTab === 'documentos' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Gestor Documental de Compras (Supabase Storage)
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                  {documents.length} archivos indexados
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Cotizaciones, presupuestos y remitos organizados automáticamente en la nube sin carpetas externas ni links rotos.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {documents.length === 0 ? (
              <div className="col-span-full text-center py-12 text-slate-500 bg-slate-900 border border-slate-800 rounded-xl">
                Aún no hay comprobantes ni cotizaciones adjuntadas en el sistema.
              </div>
            ) : (
              documents.map((d) => (
                <div key={d.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                        <h4 className="font-bold text-white text-xs truncate max-w-[200px]" title={d.original_filename}>
                          {d.original_filename}
                        </h4>
                      </div>
                      <span className="text-[10px] text-slate-500 font-mono">{d.year || 2026}</span>
                    </div>

                    {d.description && <p className="text-xs text-slate-300 mt-2">{d.description}</p>}
                    <p className="text-[10px] text-slate-500 mt-1">Rubro: {d.category || 'General'}</p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">{new Date(d.created_at).toLocaleDateString('es-AR')}</span>
                    <a
                      href={d.storage_path}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Download className="w-3 h-3" />
                      <span>Abrir Archivo</span>
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: CARGAR / EDITAR PEDIDO DE COMPRA */}
      {/* ========================================================= */}
      {showOrderModal && (
        <OrderFormModal
          order={editingOrder}
          ships={ships}
          workOrders={workOrders}
          suppliers={suppliers}
          materials={materials}
          workers={workers}
          currentFortnight={currentFortnight}
          onClose={() => setShowOrderModal(false)}
          onSuccess={(savedOrder) => {
            if (editingOrder) {
              setPurchaseOrders((prev) => prev.map((p) => (p.id === savedOrder.id ? savedOrder : p)))
              showFeedbackMsg('success', 'Pedido actualizado exitosamente.')
            } else {
              setPurchaseOrders((prev) => [savedOrder, ...prev])
              showFeedbackMsg('success', 'Nuevo pedido de compra registrado exitosamente.')
            }
            setShowOrderModal(false)
          }}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL 2: ALTA FORMAL DE MATERIAL NUEVO (SUPERVISOR) */}
      {/* ========================================================= */}
      {showNewMaterialModal && pendingMaterialOrder && (
        <NewMaterialModal
          order={pendingMaterialOrder}
          onClose={() => {
            setShowNewMaterialModal(false)
            setPendingMaterialOrder(null)
          }}
          onSuccess={async (newMaterial) => {
            setMaterials((prev) => [...prev, newMaterial])
            // Actualizar la orden para vincularla al nuevo material
            await supabase
              .from('purchase_orders')
              .update({
                material_id: newMaterial.id,
                is_new_material: false,
                system_unit_price: newMaterial.cost_ars,
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
                      system_unit_price: newMaterial.cost_ars
                    }
                  : p
              )
            )

            showFeedbackMsg('success', `Material "${newMaterial.name}" dado de alta formalmente en catálogo.`)
            setShowNewMaterialModal(false)
            setPendingMaterialOrder(null)
          }}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL 3: ADJUNTAR COTIZACIÓN / COMPROBANTE (GESTOR 1-CLIC) */}
      {/* ========================================================= */}
      {showDocModal && docTargetOrder && (
        <UploadDocModal
          order={docTargetOrder}
          supplier={suppliers.find((s) => s.id === docTargetOrder.supplier_id)}
          onClose={() => {
            setShowDocModal(false)
            setDocTargetOrder(null)
          }}
          onSuccess={(newDoc) => {
            setDocuments((prev) => [newDoc, ...prev])
            showFeedbackMsg('success', 'Documento adjuntado y normalizado con éxito.')
            setShowDocModal(false)
            setDocTargetOrder(null)
          }}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL 4: CONCILIAR HASTA AQUÍ ("LÍNEA MORADA") */}
      {/* ========================================================= */}
      {showReconcileModal && reconcileTarget && (
        <ReconcileModal
          target={reconcileTarget}
          onClose={() => {
            setShowReconcileModal(false)
            setReconcileTarget(null)
          }}
          onSuccess={async ({ invoiceNumber, orderIds }) => {
            const updates = {
              is_reconciled: true,
              invoice_number: invoiceNumber,
              reconciled_at: new Date().toISOString(),
              reconciled_by: profile?.full_name || user?.email?.split('@')[0] || 'Supervisor'
            }

            for (const id of orderIds) {
              await supabase.from('purchase_orders').update(updates).eq('id', id)
            }

            setPurchaseOrders((prev) => prev.map((p) => (orderIds.includes(p.id) ? { ...p, ...updates } : p)))
            showFeedbackMsg('success', `Se conciliaron ${orderIds.length} compras de ${reconcileTarget.supplierName} con factura ${invoiceNumber}.`)
            setShowReconcileModal(false)
            setReconcileTarget(null)
          }}
          purchaseOrders={purchaseOrders}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL 5: ALTA / EDICIÓN DE PROVEEDOR */}
      {/* ========================================================= */}
      {showSupplierModal && (
        <SupplierModal
          supplier={editingSupplier}
          onClose={() => setShowSupplierModal(false)}
          onSuccess={(savedSupplier) => {
            if (editingSupplier) {
              setSuppliers((prev) => prev.map((s) => (s.id === savedSupplier.id ? savedSupplier : s)))
              showFeedbackMsg('success', 'Proveedor actualizado correctamente.')
            } else {
              setSuppliers((prev) => [...prev, savedSupplier].sort((a, b) => a.name.localeCompare(b.name)))
              showFeedbackMsg('success', 'Nuevo proveedor registrado en el catálogo.')
            }
            setShowSupplierModal(false)
          }}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL 6: DESPACHO AGRUPADO DE PEDIDOS POR WHATSAPP */}
      {/* ========================================================= */}
      {showBatchOrderModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-emerald-400" />
                  Emitir Pedidos Agrupados por WhatsApp
                </h3>
                <p className="text-xs text-slate-400">
                  El sistema agrupa automáticamente los materiales seleccionados por proveedor para envío directo.
                </p>
              </div>
              <button onClick={() => setShowBatchOrderModal(false)} className="text-slate-400 hover:text-white">
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-1">
              {batchOrderData.map(({ supplier, items }) => (
                <div key={supplier.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white text-sm">{supplier.name}</h4>
                      <p className="text-[10px] text-slate-400">
                        {supplier.phone ? `WhatsApp: ${supplier.phone}` : '⚠️ Sin teléfono registrado'}
                      </p>
                    </div>
                    <button
                      onClick={() => handleEmitBatchOrderWhatsApp(supplier, items)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Abrir WhatsApp ({items.length} ítems)</span>
                    </button>
                  </div>

                  <ul className="divide-y divide-slate-850 text-xs text-slate-300">
                    {items.map((it) => (
                      <li key={it.id} className="py-1 flex items-center justify-between">
                        <span>{it.material_name_raw}</span>
                        <span className="font-mono text-cyan-400 font-bold">
                          {it.quantity} {it.unit_measure || 'u'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setShowBatchOrderModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// =========================================================================
// SUBCOMPONENTES MODALES
// =========================================================================

// MODAL 1: FORMULARIO DE PEDIDO DE COMPRA
function OrderFormModal({ order, ships, workOrders, suppliers, materials, workers, currentFortnight, onClose, onSuccess }) {
  const [chargeType, setChargeType] = useState(order?.charge_type || 'DIRECT')
  const [orderDate, setOrderDate] = useState(order?.order_date || new Date().toISOString().split('T')[0])
  const [shipId, setShipId] = useState(order?.ship_id || '')
  const [workOrderId, setWorkOrderId] = useState(order?.work_order_id || '')
  const [requestedByName, setRequestedByName] = useState(order?.requested_by_name || 'PAÑOL')
  const [supplierId, setSupplierId] = useState(order?.supplier_id || (suppliers[0]?.id || ''))

  // Material (Buscador reactivo con autocompletado)
  const [materialSearch, setMaterialSearch] = useState(order?.material_name_raw || '')
  const [selectedMaterialId, setSelectedMaterialId] = useState(order?.material_id || null)
  const [isNewMaterial, setIsNewMaterial] = useState(order?.is_new_material || false)
  const [quantity, setQuantity] = useState(order?.quantity || 1)
  const [unitMeasure, setUnitMeasure] = useState(order?.unit_measure || 'Unidad')
  const [supplierQuotedPrice, setSupplierQuotedPrice] = useState(order?.supplier_quoted_price || '')
  const [systemUnitPrice, setSystemUnitPrice] = useState(order?.system_unit_price || 0)
  const [estimatedDelivery, setEstimatedDelivery] = useState(order?.estimated_delivery || '')
  const [status, setStatus] = useState(order?.status || 'PEDIR')
  const [observations, setObservations] = useState(order?.observations || '')
  const [saving, setSaving] = useState(false)

  // Autocompletado de materiales
  const filteredMaterials = useMemo(() => {
    if (!materialSearch || selectedMaterialId) return []
    const q = materialSearch.toLowerCase()
    return materials.filter((m) => m.name.toLowerCase().includes(q)).slice(0, 6)
  }, [materialSearch, selectedMaterialId, materials])

  // Filtrado de OTs por Barco seleccionado
  const availableWorkOrders = useMemo(() => {
    if (!shipId) return []
    return workOrders.filter((w) => w.ship_id === shipId)
  }, [shipId, workOrders])

  // Si cambia el destino a VIA_PANOL, fijar barco ASTILLERO
  useEffect(() => {
    if (chargeType === 'VIA_PANOL') {
      const ast = ships.find((s) => s.name === 'ASTILLERO')
      if (ast) {
        setShipId(ast.id)
        const stockWo = workOrders.find((w) => w.ship_id === ast.id && w.title === 'STOCK')
        if (stockWo) setWorkOrderId(stockWo.id)
      }
    }
  }, [chargeType, ships, workOrders])

  function handleSelectMaterial(mat) {
    setSelectedMaterialId(mat.id)
    setMaterialSearch(mat.name)
    setIsNewMaterial(false)
    setSystemUnitPrice(mat.cost_ars || 0)
    setUnitMeasure(mat.unit_measure || 'Unidad')
    if (!supplierQuotedPrice) setSupplierQuotedPrice(mat.cost_ars || '')
  }

  function handleMaterialSearchChange(val) {
    setMaterialSearch(val)
    setSelectedMaterialId(null)
    setIsNewMaterial(true) // Si escribe y no selecciona del catálogo, se marca como nuevo
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!materialSearch.trim()) return alert('Debe ingresar el nombre del material.')
    if (!supplierId) return alert('Debe seleccionar un proveedor.')
    if (Number(quantity) <= 0) return alert('La cantidad debe ser mayor a 0.')

    setSaving(true)
    try {
      const payload = {
        charge_type: chargeType,
        order_date: orderDate,
        ship_id: shipId || null,
        work_order_id: workOrderId || null,
        requested_by_name: requestedByName,
        material_id: selectedMaterialId,
        material_name_raw: materialSearch.trim(),
        is_new_material: isNewMaterial,
        quantity: Number(quantity),
        unit_measure: unitMeasure,
        supplier_id: supplierId,
        supplier_quoted_price: supplierQuotedPrice ? Number(supplierQuotedPrice) : null,
        system_unit_price: systemUnitPrice ? Number(systemUnitPrice) : 0,
        estimated_delivery: estimatedDelivery || null,
        status,
        observations: observations.trim() || null,
        fortnight_period: currentFortnight,
        updated_at: new Date().toISOString()
      }

      if (order?.id) {
        const { data, error } = await supabase.from('purchase_orders').update(payload).eq('id', order.id).select().single()
        if (error) throw error
        onSuccess(data)
      } else {
        const { data, error } = await supabase.from('purchase_orders').insert([payload]).select().single()
        if (error) throw error
        onSuccess(data)
      }
    } catch (err) {
      console.error('Error guardando pedido:', err)
      alert('Error guardando pedido: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-cyan-400" />
            {order ? 'Editar Pedido de Compra' : 'Cargar Pedido de Compra'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Tipo de Carga y Fecha */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Destino del Insumo</label>
              <select
                value={chargeType}
                onChange={(e) => setChargeType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="DIRECT">Carga Directa para Obra (Buque)</option>
                <option value="VIA_PANOL">Reposición de Stock (Pañol)</option>
                <option value="STANDBY">Stand-By en Depósito</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Fecha del Pedido</label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Buque y OT (solo si es Carga Directa) */}
          {chargeType === 'DIRECT' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Buque / Obra</label>
                <select
                  value={shipId}
                  onChange={(e) => {
                    setShipId(e.target.value)
                    setWorkOrderId('')
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                  required
                >
                  <option value="">-- Seleccionar Buque --</option>
                  {ships.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Orden de Trabajo (OT)</label>
                <select
                  value={workOrderId}
                  onChange={(e) => setWorkOrderId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                  required
                >
                  <option value="">-- Seleccionar OT --</option>
                  {availableWorkOrders.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.ot_number ? `OT #${w.ot_number} - ` : ''}
                      {w.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Material con Autocompletado */}
          <div className="relative">
            <label className="block text-slate-400 mb-1 font-semibold flex items-center justify-between">
              <span>Material / Insumo Solicitado</span>
              {isNewMaterial && (
                <span className="text-[10px] text-amber-400 font-bold">⚠️ Material nuevo (quedará pendiente de alta en B.D.)</span>
              )}
            </label>
            <input
              type="text"
              placeholder="Escribe para buscar en catálogo o cargar nuevo..."
              value={materialSearch}
              onChange={(e) => handleMaterialSearchChange(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500 font-medium"
              required
            />

            {/* Menú flotante de autocompletado */}
            {filteredMaterials.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-slate-950 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-slate-800">
                {filteredMaterials.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => handleSelectMaterial(m)}
                    className="w-full text-left p-2.5 hover:bg-cyan-950/50 flex items-center justify-between text-xs transition-colors"
                  >
                    <div>
                      <p className="font-bold text-white">{m.name}</p>
                      <p className="text-[10px] text-slate-400">Rubro: {m.rubro || m.category || 'General'}</p>
                    </div>
                    <div className="text-right font-mono">
                      <p className="text-cyan-300 font-bold">${Number(m.cost_ars || 0).toLocaleString('es-AR')}</p>
                      <p className="text-[10px] text-slate-500">{m.unit_measure || 'Unidad'}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Cantidad y Unidad */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Cantidad</label>
              <input
                type="number"
                step="any"
                min="0.01"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Unidad Medida</label>
              <input
                type="text"
                placeholder="Unidad, Kilos, Bolsón..."
                value={unitMeasure}
                onChange={(e) => setUnitMeasure(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">$/U Cotizado AR$</label>
              <input
                type="number"
                step="any"
                placeholder="Costo cotizado"
                value={supplierQuotedPrice}
                onChange={(e) => setSupplierQuotedPrice(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">$/U Sistema AR$</label>
              <input
                type="number"
                value={systemUnitPrice}
                disabled
                className="w-full bg-slate-900 border border-slate-800 rounded-lg p-2 text-slate-400 font-mono"
              />
            </div>
          </div>

          {/* Proveedor y Solicitante */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Proveedor Asignado</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                required
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.is_gas_supplier ? '(Gases)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Persona que Solicita</label>
              <input
                type="text"
                placeholder="Ej: PAÑOL, MANUEL, LUIS M..."
                value={requestedByName}
                onChange={(e) => setRequestedByName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Estado y Entrega Estimada */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Estado del Pedido</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              >
                {STATUS_OPTIONS.filter((s) => s.value !== 'TODOS').map((st) => (
                  <option key={st.value} value={st.value}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Fecha Estimada de Entrega</label>
              <input
                type="date"
                value={estimatedDelivery}
                onChange={(e) => setEstimatedDelivery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Observaciones / Especificaciones</label>
            <textarea
              rows="2"
              placeholder="Detalles técnicos, urgencia, número de presupuesto de referencia..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
            ></textarea>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg transition-all"
            >
              {saving ? 'Guardando...' : order ? 'Actualizar Pedido' : 'Guardar Pedido'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// MODAL 2: ALTA FORMAL DE MATERIAL EN CATÁLOGO (SUPERVISOR)
function NewMaterialModal({ order, onClose, onSuccess }) {
  const [name, setName] = useState(order.material_name_raw)
  const [category, setCategory] = useState('Consumibles')
  const [rubro, setRubro] = useState('MATERIALES')
  const [unitMeasure, setUnitMeasure] = useState(order.unit_measure || 'Unidad')
  const [costArs, setCostArs] = useState(order.supplier_quoted_price || 0)
  const [minimumStock, setMinimumStock] = useState(0)
  const [saving, setSaving] = useState(false)

  // Nomenclaturas técnicas sugeridas
  function applyNamingPattern(prefix) {
    setName(`${prefix} ${name}`)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return alert('Debe ingresar el nombre normalizado.')
    setSaving(true)
    try {
      const payload = {
        name: name.trim(),
        category,
        rubro,
        unit_measure: unitMeasure,
        cost_ars: Number(costArs),
        cost_usd: Number(costArs) / 1500,
        current_stock: 0,
        minimum_stock: Number(minimumStock)
      }

      const { data, error } = await supabase.from('materials').insert([payload]).select().single()
      if (error) throw error
      onSuccess(data)
    } catch (err) {
      console.error('Error creando material:', err)
      alert('Error dando alta a material: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              Alta Formal de Material en B.D. Maestra
            </h3>
            <p className="text-xs text-slate-400">Normalización técnica y asignación de rubro (Solo Supervisor).</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Nombre Normalizado</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-medium focus:outline-none focus:border-cyan-500"
              required
            />
            {/* Guías rápidas de nomenclatura */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <span className="text-[10px] text-slate-500">Prefijos:</span>
              <button
                type="button"
                onClick={() => applyNamingPattern('BULON ZINCADO')}
                className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:text-white"
              >
                BULON
              </button>
              <button
                type="button"
                onClick={() => applyNamingPattern('CAÑO INOX')}
                className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:text-white"
              >
                CAÑO
              </button>
              <button
                type="button"
                onClick={() => applyNamingPattern('CHAPA NAVAL')}
                className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:text-white"
              >
                CHAPA
              </button>
              <button
                type="button"
                onClick={() => applyNamingPattern('ELECTRODO')}
                className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300 hover:text-white"
              >
                ELECTRODO
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Rubro</label>
              <select
                value={rubro}
                onChange={(e) => setRubro(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="BULONES">BULONES</option>
                <option value="CAÑO">CAÑERÍA</option>
                <option value="CHAPAS">CHAPAS</option>
                <option value="ELECTRICIDAD">ELECTRICIDAD</option>
                <option value="GASES">GASES</option>
                <option value="HERRAMIENTAS">HERRAMIENTAS</option>
                <option value="SOLDADURA">SOLDADURA</option>
                <option value="TORNERIA">TORNERIA</option>
                <option value="PINTURA">PINTURA</option>
                <option value="MATERIALES">MATERIALES VARIOS</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Categoría</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="Consumibles">Consumibles</option>
                <option value="Metales">Metales</option>
                <option value="Fijaciones">Fijaciones</option>
                <option value="Repuestos">Repuestos</option>
                <option value="Gases">Gases</option>
                <option value="Pintura">Pintura</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Precio Base AR$</label>
              <input
                type="number"
                step="any"
                value={costArs}
                onChange={(e) => setCostArs(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                required
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Unidad de Medida</label>
              <input
                type="text"
                value={unitMeasure}
                onChange={(e) => setUnitMeasure(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all"
            >
              {saving ? 'Registrando...' : 'Aprobar Alta en Catálogo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// MODAL 3: ADJUNTAR COTIZACIÓN / REMITO (GESTOR 1-CLIC)
function UploadDocModal({ order, supplier, onClose, onSuccess }) {
  const [file, setFile] = useState(null)
  const [description, setDescription] = useState('')
  const [uploading, setUploading] = useState(false)

  async function handleUpload(e) {
    e.preventDefault()
    if (!file) return alert('Por favor selecciona un archivo.')

    setUploading(true)
    try {
      const year = new Date().getFullYear()
      const rubro = order.work_type || 'General'
      const ext = file.name.split('.').pop()
      const safeDesc = (description || 'Cotizacion').replace(/[^a-zA-Z0-9_-]/g, '_')
      const safeProv = (supplier?.name || 'Proveedor').replace(/[^a-zA-Z0-9_-]/g, '_')
      const normalizedName = `${safeDesc}_${safeProv}.${ext}`
      const storagePath = `cotizaciones/${year}/${rubro}/${Date.now()}_${normalizedName}`

      // Subir archivo al bucket compras
      const { error: uploadError } = await supabase.storage.from('compras').upload(storagePath, file)
      if (uploadError) throw uploadError

      // Obtener URL pública
      const { data: urlData } = supabase.storage.from('compras').getPublicUrl(storagePath)

      // Registrar en purchase_documents
      const docPayload = {
        purchase_order_id: order.id,
        supplier_id: supplier?.id || null,
        original_filename: file.name,
        normalized_filename: normalizedName,
        storage_path: urlData.publicUrl,
        category: rubro,
        description: description || 'Cotización de compra',
        year,
        file_size_bytes: file.size
      }

      const { data: newDoc, error: dbError } = await supabase.from('purchase_documents').insert([docPayload]).select().single()
      if (dbError) throw dbError

      onSuccess(newDoc)
    } catch (err) {
      console.error('Error subiendo documento:', err)
      alert('Error subiendo archivo: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-cyan-400" />
            Adjuntar Documento (1-Clic)
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <form onSubmit={handleUpload} className="space-y-4 text-xs">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
            <p className="font-semibold text-white truncate">{order.material_name_raw}</p>
            <p className="text-[10px] text-slate-400">Proveedor: {supplier?.name || 'S/D'}</p>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Seleccionar Archivo (PDF, JPG, PNG, DOC)</label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files[0])}
              className="w-full text-slate-300 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-950 file:text-cyan-400 hover:file:bg-cyan-900 cursor-pointer"
              required
            />
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Descripción Breve</label>
            <input
              type="text"
              placeholder="Ej: Presupuesto Oxígeno, Factura Lote Tubos..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={uploading}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg transition-all"
            >
              {uploading ? 'Subiendo y normalizando...' : 'Subir Documento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// MODAL 4: CONCILIAR CON FACTURA ("LÍNEA MORADA")
function ReconcileModal({ target, purchaseOrders, onClose, onSuccess }) {
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [reconcileAllPrior, setReconcileAllPrior] = useState(true)

  // Identificar qué pedidos se van a conciliar
  const eligibleOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (po.supplier_id !== target.supplierId) return false
      if (po.is_reconciled) return false
      if (reconcileAllPrior) {
        // Todas las de este proveedor con fecha menor o igual
        return po.order_date <= target.orderDate
      }
      return po.id === target.orderId
    })
  }, [purchaseOrders, target, reconcileAllPrior])

  function handleSubmit(e) {
    e.preventDefault()
    if (!invoiceNumber.trim()) return alert('Debe ingresar el número de factura o remito.')
    onSuccess({
      invoiceNumber: invoiceNumber.trim(),
      orderIds: eligibleOrders.map((o) => o.id)
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-purple-400">🟣</span> Conciliación con Factura ("Línea Morada")
            </h3>
            <p className="text-xs text-slate-400">Auditoría contable para {target.supplierName}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Número de Factura o Remito Proveedor</label>
            <input
              type="text"
              placeholder="Ej: FC-A-0004-9844"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono uppercase focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
            <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={reconcileAllPrior}
                onChange={(e) => setReconcileAllPrior(e.target.checked)}
                className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
              />
              <span>Conciliar hasta aquí (incluir todas las anteriores pendientes)</span>
            </label>
            <p className="text-[11px] text-purple-300">
              Se marcarán <strong className="text-white">{eligibleOrders.length} compras</strong> de este proveedor como
              conciliadas bajo este comprobante.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold rounded-lg transition-all"
            >
              Confirmar Conciliación
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// MODAL 5: NUEVO / EDITAR PROVEEDOR
function SupplierModal({ supplier, onClose, onSuccess }) {
  const [name, setName] = useState(supplier?.name || '')
  const [trade, setTrade] = useState(supplier?.trade || 'FERRETERIA')
  const [cuitCuil, setCuitCuil] = useState(supplier?.cuit_cuil || '')
  const [phone, setPhone] = useState(supplier?.phone || '')
  const [email, setEmail] = useState(supplier?.email || '')
  const [contactName, setContactName] = useState(supplier?.contact_name || '')
  const [paymentMethod, setPaymentMethod] = useState(supplier?.payment_method || 'CUENTA_CORRIENTE')
  const [billingMedium, setBillingMedium] = useState(supplier?.billing_medium || 'EMAIL')
  const [isGasSupplier, setIsGasSupplier] = useState(supplier?.is_gas_supplier || false)
  const [clientNumber, setClientNumber] = useState(supplier?.client_number || '')
  const [orderCutoffDay, setOrderCutoffDay] = useState(supplier?.order_cutoff_day || '')
  const [deliveryDay, setDeliveryDay] = useState(supplier?.delivery_day || '')
  const [observations, setObservations] = useState(supplier?.observations || '')
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return alert('Debe ingresar el nombre del proveedor.')

    setSaving(true)
    try {
      const payload = {
        name: name.trim().toUpperCase(),
        trade: trade.trim().toUpperCase(),
        cuit_cuil: cuitCuil.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        contact_name: contactName.trim() || null,
        payment_method: paymentMethod,
        billing_medium: billingMedium,
        is_gas_supplier: isGasSupplier,
        client_number: clientNumber.trim() || null,
        order_cutoff_day: orderCutoffDay.trim() || null,
        delivery_day: deliveryDay.trim() || null,
        observations: observations.trim() || null,
        updated_at: new Date().toISOString()
      }

      if (supplier?.id) {
        const { data, error } = await supabase.from('suppliers').update(payload).eq('id', supplier.id).select().single()
        if (error) throw error
        onSuccess(data)
      } else {
        const { data, error } = await supabase.from('suppliers').insert([payload]).select().single()
        if (error) throw error
        onSuccess(data)
      }
    } catch (err) {
      console.error('Error guardando proveedor:', err)
      alert('Error guardando proveedor: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-400" />
            {supplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Nombre / Razón Social</label>
            <input
              type="text"
              placeholder="Ej: FERREMAT, AIR LIQUIDE, CASA CARLITOS..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-bold uppercase focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Rubro Principal</label>
              <input
                type="text"
                placeholder="Ej: FERRETERIA, GASES, PINTURA..."
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white uppercase focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">CUIT / CUIL</label>
              <input
                type="text"
                placeholder="Ej: 30-50014764-9"
                value={cuitCuil}
                onChange={(e) => setCuitCuil(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Teléfono / WhatsApp</label>
              <input
                type="text"
                placeholder="Ej: +5492234810922"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Email de Contacto</label>
              <input
                type="email"
                placeholder="pedidos@empresa.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Forma de Pago</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="CUENTA_CORRIENTE">Cuenta Corriente</option>
                <option value="CONTADO">Contado / Transferencia</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Medio de Facturación</label>
              <select
                value={billingMedium}
                onChange={(e) => setBillingMedium(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="EMAIL">Email</option>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EN_MANO">En Mano / Remito Físico</option>
              </select>
            </div>
          </div>

          {/* Parámetros de Gases P-02 */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3">
            <label className="flex items-center gap-2 text-white font-semibold cursor-pointer">
              <input
                type="checkbox"
                checked={isGasSupplier}
                onChange={(e) => setIsGasSupplier(e.target.checked)}
                className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500"
              />
              <span>💨 Es Proveedor de Gases Industriales (Regla P-02)</span>
            </label>

            {isGasSupplier && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-[11px]">
                <div>
                  <label className="block text-slate-400 mb-1">N° Cliente</label>
                  <input
                    type="text"
                    placeholder="2234867"
                    value={clientNumber}
                    onChange={(e) => setClientNumber(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Día Corte Pedido</label>
                  <input
                    type="text"
                    placeholder="Martes <12hs"
                    value={orderCutoffDay}
                    onChange={(e) => setOrderCutoffDay(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Día de Entrega</label>
                  <input
                    type="text"
                    placeholder="Miércoles"
                    value={deliveryDay}
                    onChange={(e) => setDeliveryDay(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-1.5 text-white"
                  />
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold">Observaciones</label>
            <textarea
              rows="2"
              placeholder="Notas comerciales, descuentos acordados, plazos..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
            ></textarea>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg transition-all"
            >
              {saving ? 'Guardando...' : supplier ? 'Guardar Cambios' : 'Registrar Proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
