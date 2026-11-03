import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import {
  Package,
  Plus,
  Search,
  Filter,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Flame,
  Shield,
  FileSpreadsheet,
  Download,
  RefreshCw,
  Trash2,
  ExternalLink,
  Eye,
  ShoppingCart,
  Truck,
  ArrowRight,
  ChevronRight,
  ArrowUpDown,
  Check,
  X,
  Info,
  Phone,
  MessageSquare,
  Building2,
  User,
  Anchor,
  Layers,
  Settings,
  HelpCircle,
  Send,
  Camera,
  Scale,
  Sparkles,
  CheckSquare,
  Square
} from 'lucide-react'

// ==============================================================================
// COMPONENTE AUXILIAR: Resaltador de coincidencias de búsqueda en amarillo
// ==============================================================================
function HighlightText({ text, query }) {
  if (!text) return null
  const textStr = String(text)
  if (!query || !query.trim()) return <span>{textStr}</span>

  const q = query.trim().toLowerCase()
  const idx = textStr.toLowerCase().indexOf(q)
  if (idx === -1) return <span>{textStr}</span>

  const before = textStr.substring(0, idx)
  const match = textStr.substring(idx, idx + q.length)
  const after = textStr.substring(idx + q.length)

  return (
    <span>
      {before}
      <mark className="bg-amber-400 text-slate-950 font-semibold px-0.5 rounded-xs">
        {match}
      </mark>
      <HighlightText text={after} query={query} />
    </span>
  )
}

export default function Panol() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile } = useAuth()

  // Pestañas del módulo: 'movimientos' | 'gases' | 'catalogo' | 'epp'
  const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'movimientos')

  // Datos principales
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState(null)
  const [materials, setMaterials] = useState([])
  const [inventoryTx, setInventoryTx] = useState([])
  const [gasMovements, setGasMovements] = useState([])
  const [rubros, setRubros] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [ships, setShips] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [workItems, setWorkItems] = useState([])
  const [workers, setWorkers] = useState([])
  const [systemSettings, setSystemSettings] = useState(null)

  // Filtros de barra de herramientas
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)
  const [filterPeriod, setFilterPeriod] = useState('TODOS') // 'TODOS', 'HOY', 'QUINCENA', 'MES'
  const [filterCategory, setFilterCategory] = useState('TODAS') // 'TODAS', 'MATERIALES', 'CONSUMIBLES', 'ELEM.SEGURIDAD', 'GASES'
  const [filterShip, setFilterShip] = useState('TODOS')
  const [activeKpiFilter, setActiveKpiFilter] = useState(null) // 'critico' | 'hoy' | 'sin_ot' | 'vacios' | 'retencion'

  // Selección de filas para acciones en bloque
  const [selectedTxIds, setSelectedTxIds] = useState(new Set())
  const [selectedMatIds, setSelectedMatIds] = useState(new Set())

  // Modales
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false)
  const [showNewMaterialModal, setShowNewMaterialModal] = useState(false)
  const [showStockAdjustModal, setShowStockAdjustModal] = useState({ isOpen: false, material: null })
  const [showGasModal, setShowGasModal] = useState({ isOpen: false, operationType: 'PRIMERA_ENTREGA' })
  const [previewImage, setPreviewImage] = useState(null)

  // Sincronizar parámetro URL tab
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam && ['movimientos', 'gases', 'catalogo', 'epp'].includes(tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  const changeTab = (tab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
    setActiveKpiFilter(null)
  }

  // Notificaciones flotantes
  const showFeedback = (type, text) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 4500)
  }

  // Atajo de teclado Escape para limpiar filtros
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSearchQuery('')
        setActiveKpiFilter(null)
        setFilterPeriod('TODOS')
        setFilterCategory('TODAS')
        setFilterShip('TODOS')
        setSelectedTxIds(new Set())
        setSelectedMatIds(new Set())
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // ==============================================================================
  // CARGA DE DATOS PARALELA DESDE SUPABASE
  // ==============================================================================
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [
        matRes,
        invRes,
        gasRes,
        rubrosRes,
        supRes,
        shipsRes,
        woRes,
        wiRes,
        workersRes,
        settRes
      ] = await Promise.all([
        supabase.from('materials').select('*').order('name'),
        supabase
          .from('inventory_transactions')
          .select('*')
          .order('transaction_date', { ascending: false })
          .limit(500),
        supabase
          .from('gas_cylinder_movements')
          .select('*')
          .order('movement_date', { ascending: false })
          .limit(500),
        supabase.from('material_rubros').select('*').order('name'),
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('ships').select('*').order('name'),
        supabase.from('work_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('work_items').select('*').order('created_at', { ascending: true }),
        supabase.from('workers').select('*').order('name'),
        supabase.from('system_settings').select('*').in('key', ['gases_p02_alerta'])
      ])

      if (matRes.data) setMaterials(matRes.data)
      if (invRes.data) setInventoryTx(invRes.data)
      if (gasRes.data) setGasMovements(gasRes.data)
      if (rubrosRes.data) setRubros(rubrosRes.data)
      if (supRes.data) setSuppliers(supRes.data)
      if (shipsRes.data) setShips(shipsRes.data)
      if (woRes.data) setWorkOrders(woRes.data)
      if (wiRes.data) setWorkItems(wiRes.data)
      if (workersRes.data) setWorkers(workersRes.data)
      if (settRes.data && settRes.data.length > 0) {
        setSystemSettings(settRes.data[0].value)
      }
    } catch (err) {
      console.error('Error cargando Pañol:', err)
      showFeedback('error', 'Error cargando datos de Pañol: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // ==============================================================================
  // CÁLCULOS DE NEGOCIO: GASES (BALANCES, PATIO Y RETENCIÓN >15 DÍAS P-01/P-02)
  // ==============================================================================
  const gasStats = useMemo(() => {
    const gasSuppliers = suppliers.filter((s) => s.is_gas_supplier)
    const patioStock = {} // { supplierId: { full: 0, empty: 0, supplier: s } }

    gasSuppliers.forEach((s) => {
      patioStock[s.id] = { full: 0, empty: 0, supplier: s }
    })

    // Calcular patio inicial a partir de movimientos
    gasMovements.forEach((m) => {
      const qty = Number(m.quantity) || 1
      if (m.operation_type === 'PRIMERA_ENTREGA') {
        if (m.supplier_delivered_id && patioStock[m.supplier_delivered_id]) {
          patioStock[m.supplier_delivered_id].full = Math.max(0, patioStock[m.supplier_delivered_id].full - qty)
        }
      } else if (m.operation_type === 'RECAMBIO_1X1') {
        if (m.supplier_returned_id && patioStock[m.supplier_returned_id]) {
          patioStock[m.supplier_returned_id].empty += qty
        }
        if (m.supplier_delivered_id && patioStock[m.supplier_delivered_id]) {
          patioStock[m.supplier_delivered_id].full = Math.max(0, patioStock[m.supplier_delivered_id].full - qty)
        }
      } else if (m.operation_type === 'DEVOLUCION_FINAL') {
        if (m.supplier_returned_id && patioStock[m.supplier_returned_id]) {
          patioStock[m.supplier_returned_id].empty += qty
        }
      }
    })

    // Sumar stock teórico de materials para gases
    materials
      .filter((m) => m.rubro === 'GASES' || m.category === 'GASES' || m.name.toUpperCase().includes('GAS') || m.name.toUpperCase().includes('OXIGENO'))
      .forEach((m) => {
        // Asignar al proveedor predeterminado Air Liquide si no está desglosado
        const air = gasSuppliers.find((s) => s.name.toUpperCase().includes('AIR LIQUIDE'))
        if (air && patioStock[air.id]) {
          patioStock[air.id].full += Number(m.current_stock) || 0
        }
      })

    // Matriz de tenencia de contratistas / buques
    const contractorMap = {} // { contractorKey: { name, shipId, gases: {}, total: 0, lastDate: null, daysHeld: 0 } }
    const now = new Date()

    gasMovements.forEach((m) => {
      const cName = m.contractor_name || 'SIN ASIGNAR'
      if (!contractorMap[cName]) {
        contractorMap[cName] = {
          name: cName,
          shipId: m.ship_id,
          gases: {},
          total: 0,
          lastDate: m.movement_date,
          movements: []
        }
      }

      contractorMap[cName].movements.push(m)
      const mDate = new Date(m.movement_date)
      if (!contractorMap[cName].lastDate || mDate > new Date(contractorMap[cName].lastDate)) {
        contractorMap[cName].lastDate = m.movement_date
      }

      const mat = materials.find((item) => item.id === m.material_id)
      const gasName = mat?.name || 'Tubo de Gas'
      if (!contractorMap[cName].gases[gasName]) {
        contractorMap[cName].gases[gasName] = 0
      }

      const qty = Number(m.quantity) || 1
      if (m.operation_type === 'PRIMERA_ENTREGA') {
        contractorMap[cName].gases[gasName] += qty
        contractorMap[cName].total += qty
      } else if (m.operation_type === 'DEVOLUCION_FINAL') {
        contractorMap[cName].gases[gasName] = Math.max(0, contractorMap[cName].gases[gasName] - qty)
        contractorMap[cName].total = Math.max(0, contractorMap[cName].total - qty)
      }
    })

    // Calcular días de retención
    const contractorList = Object.values(contractorMap).map((c) => {
      const diffMs = c.lastDate ? now - new Date(c.lastDate) : 0
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      return {
        ...c,
        daysHeld: days,
        isOverdue: days > 15 && c.total > 0 // Regla P-01
      }
    })

    const overdueCount = contractorList.filter((c) => c.isOverdue).length
    const totalEmptyPatio = Object.values(patioStock).reduce((acc, curr) => acc + curr.empty, 0)

    return {
      patioStock,
      contractorList,
      overdueCount,
      totalEmptyPatio
    }
  }, [gasMovements, suppliers, materials])

  // ==============================================================================
  // RADAR DE 5 KPIS INTERACTIVOS
  // ==============================================================================
  const kpis = useMemo(() => {
    // KPI 1: Stock Crítico / Quiebre
    const criticalStock = materials.filter((m) => {
      const curr = Number(m.current_stock) || 0
      const min = Number(m.minimum_stock) || 0
      return curr <= min
    }).length

    // KPI 2: Retiros Hoy y Quincena
    const todayStr = new Date().toISOString().split('T')[0]
    const retirosHoy = inventoryTx.filter((t) => {
      const d = String(t.transaction_date).split('T')[0]
      return d === todayStr
    }).length

    // KPI 3: Retiros sin OT asignada (OT Nullable - Regla 0028)
    const sinOt = inventoryTx.filter((t) => !t.work_order_id).length

    // KPI 4: Tubos Vacíos en Patio (Regla P-02)
    const vaciosPatio = gasStats.totalEmptyPatio

    // KPI 5: Cilindros en Retención >15 días (Regla P-01)
    const retencionProlongada = gasStats.overdueCount

    return {
      criticalStock,
      retirosHoy,
      sinOt,
      vaciosPatio,
      retencionProlongada
    }
  }, [materials, inventoryTx, gasStats])

  // ==============================================================================
  // FILTRADO DINÁMICO DE DATOS (ZONA 4)
  // ==============================================================================
  const isDateInFilterPeriod = (dateStr) => {
    if (filterPeriod === 'TODOS') return true
    if (!dateStr) return false
    const d = new Date(dateStr)
    const now = new Date()

    if (filterPeriod === 'HOY') {
      return d.toISOString().split('T')[0] === now.toISOString().split('T')[0]
    }
    if (filterPeriod === 'QUINCENA') {
      const isCurrentMonth = d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      if (!isCurrentMonth) return false
      const day = d.getDate()
      const nowDay = now.getDate()
      const isQ1 = nowDay <= 15
      return isQ1 ? day <= 15 : day > 15
    }
    if (filterPeriod === 'MES') {
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    }
    return true
  }

  // Filtrado de Kárdex de Retiros
  const filteredTransactions = useMemo(() => {
    return inventoryTx.filter((t) => {
      // Filtro KPI
      if (activeKpiFilter === 'sin_ot' && t.work_order_id) return false
      if (activeKpiFilter === 'hoy') {
        const d = String(t.transaction_date).split('T')[0]
        const todayStr = new Date().toISOString().split('T')[0]
        if (d !== todayStr) return false
      }

      // Filtro Periodo
      if (!isDateInFilterPeriod(t.transaction_date)) return false

      // Filtro Barco
      if (filterShip !== 'TODOS' && t.ship_id !== filterShip) return false

      // Filtro Categoría
      const mat = materials.find((m) => m.id === t.material_id)
      if (filterCategory !== 'TODAS') {
        if (!mat) return false
        if (filterCategory === 'GASES') {
          if (mat.rubro !== 'GASES' && mat.category !== 'GASES') return false
        } else if (mat.category !== filterCategory) {
          return false
        }
      }

      // Filtro de Búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const ship = ships.find((s) => s.id === t.ship_id)?.name || ''
        const wo = workOrders.find((w) => w.id === t.work_order_id)?.description || ''
        const matName = mat?.name || ''
        const worker = t.worker_name || ''
        const contractor = t.contractor_name || ''
        const voucher = t.voucher_number || ''
        const notes = t.notes || ''

        const match =
          ship.toLowerCase().includes(q) ||
          wo.toLowerCase().includes(q) ||
          matName.toLowerCase().includes(q) ||
          worker.toLowerCase().includes(q) ||
          contractor.toLowerCase().includes(q) ||
          voucher.toLowerCase().includes(q) ||
          notes.toLowerCase().includes(q)

        if (!match) return false
      }

      return true
    })
  }, [inventoryTx, activeKpiFilter, filterPeriod, filterShip, filterCategory, searchQuery, materials, ships, workOrders])

  // Filtrado de Catálogo de Materiales
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      // Filtro KPI
      if (activeKpiFilter === 'critico') {
        const curr = Number(m.current_stock) || 0
        const min = Number(m.minimum_stock) || 0
        if (curr > min) return false
      }

      // Filtro Categoría
      if (filterCategory !== 'TODAS') {
        if (filterCategory === 'GASES') {
          if (m.rubro !== 'GASES' && m.category !== 'GASES') return false
        } else if (m.category !== filterCategory) {
          return false
        }
      }

      // Filtro de Búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const match =
          (m.name || '').toLowerCase().includes(q) ||
          (m.rubro || '').toLowerCase().includes(q) ||
          (m.category || '').toLowerCase().includes(q) ||
          (m.unit_measure || '').toLowerCase().includes(q)
        if (!match) return false
      }

      return true
    })
  }, [materials, activeKpiFilter, filterCategory, searchQuery])

  // ==============================================================================
  // ACCIONES OPERATIVAS: REGISTRO DE RETIRO
  // ==============================================================================
  const handleSaveWithdrawal = async (withdrawalData) => {
    try {
      const mat = materials.find((m) => m.id === withdrawalData.material_id)
      if (!mat) throw new Error('Material no seleccionado')

      const qty = Number(withdrawalData.quantity)
      if (isNaN(qty) || qty <= 0) throw new Error('Cantidad debe ser mayor a 0')

      // 1. Descontar stock en materials
      const currentStock = Number(mat.current_stock) || 0
      const newStock = currentStock - qty

      const { error: matErr } = await supabase
        .from('materials')
        .update({ current_stock: newStock })
        .eq('id', mat.id)

      if (matErr) throw matErr

      // 2. Insertar movimiento en inventory_transactions
      const autoVoucher = `RET-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`
      const payload = {
        material_id: mat.id,
        quantity_withdrawn: qty,
        ship_id: withdrawalData.ship_id || null,
        work_order_id: withdrawalData.work_order_id || null,
        work_item_id: withdrawalData.work_item_id || null,
        worker_id: withdrawalData.worker_id || null,
        worker_name: withdrawalData.worker_name || 'PAÑOL',
        contractor_name: withdrawalData.contractor_name || 'ALON CAR',
        voucher_number: autoVoucher,
        movement_type: withdrawalData.movement_type || (mat.category === 'ELEM.SEGURIDAD' ? 'ENTREGA_EPP' : 'CONSUMO_OBRA'),
        unit_cost_ars_snapshot: mat.cost_ars || 0,
        unit_cost_usd_snapshot: mat.cost_usd || 0,
        notes: withdrawalData.notes || null,
        transaction_date: withdrawalData.transaction_date || new Date().toISOString()
      }

      const { data: newTx, error: txErr } = await supabase
        .from('inventory_transactions')
        .insert([payload])
        .select()
        .single()

      if (txErr) throw txErr

      // Actualizar estado local reactivamente
      setMaterials((prev) => prev.map((m) => (m.id === mat.id ? { ...m, current_stock: newStock } : m)))
      if (newTx) setInventoryTx((prev) => [newTx, ...prev])

      showFeedback('success', `Retiro registrado correctamente (${autoVoucher}). Stock restante: ${newStock} ${mat.unit_measure || 'un.'}`)
      setShowWithdrawalModal(false)
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al registrar retiro: ' + err.message)
    }
  }

  // ==============================================================================
  // ACCIONES OPERATIVAS: ALTA DE MATERIAL
  // ==============================================================================
  const handleSaveMaterial = async (formData) => {
    try {
      const payload = {
        name: formData.name.trim().toUpperCase(),
        category: formData.category,
        rubro: formData.rubro,
        rubro_status: formData.rubro_status || 'APROBADO',
        unit_measure: formData.unit_measure || 'Unidad',
        security_factor: Number(formData.security_factor) || 1.06,
        cost_ars: Number(formData.cost_ars) || 0,
        cost_usd: Number(formData.cost_usd) || 0,
        current_stock: Number(formData.current_stock) || 0,
        minimum_stock: Number(formData.minimum_stock) || 0,
        image_url: formData.image_url || null
      }

      const { data, error } = await supabase.from('materials').insert([payload]).select().single()
      if (error) throw error

      setMaterials((prev) => [data, ...prev])
      showFeedback('success', `Material "${data.name}" dado de alta con éxito en el Catálogo de Pañol.`)
      setShowNewMaterialModal(false)
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al crear material: ' + err.message)
    }
  }

  // ==============================================================================
  // ACCIONES OPERATIVAS: AJUSTE FÍSICO DE INVENTARIO
  // ==============================================================================
  const handleSaveStockAdjust = async (materialId, countedQty, reason) => {
    try {
      const mat = materials.find((m) => m.id === materialId)
      if (!mat) return

      const realQty = Number(countedQty)
      const diff = realQty - (Number(mat.current_stock) || 0)

      // Actualizar stock
      const { error: updErr } = await supabase
        .from('materials')
        .update({ current_stock: realQty })
        .eq('id', mat.id)

      if (updErr) throw updErr

      // Registrar asiento compensatorio en kárdex
      const autoVoucher = `AJU-${new Date().getFullYear()}-${String(Date.now()).slice(-5)}`
      const payload = {
        material_id: mat.id,
        quantity_withdrawn: -diff, // si diff > 0, es entrada (-diff es negativo); si diff < 0, es salida
        voucher_number: autoVoucher,
        worker_name: profile?.full_name || 'PAÑOLERO',
        contractor_name: 'AJUSTE DE INVENTARIO',
        movement_type: 'AJUSTE_INVENTARIO',
        unit_cost_ars_snapshot: mat.cost_ars || 0,
        unit_cost_usd_snapshot: mat.cost_usd || 0,
        notes: `Ajuste por control de stock físico. Motivo: ${reason}. Diferencia: ${diff > 0 ? '+' : ''}${diff} ${mat.unit_measure || 'un.'}`
      }

      await supabase.from('inventory_transactions').insert([payload])

      setMaterials((prev) => prev.map((m) => (m.id === mat.id ? { ...m, current_stock: realQty } : m)))
      showFeedback('success', `Ajuste guardado. Nuevo stock físico de "${mat.name}": ${realQty}`)
      setShowStockAdjustModal({ isOpen: false, material: null })
      fetchData()
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al guardar ajuste: ' + err.message)
    }
  }

  // ==============================================================================
  // ACCIONES OPERATIVAS: MOVIMIENTO DE GASES (PRIMERA ENTREGA, RECAMBIO, DEVOLUCIÓN)
  // ==============================================================================
  const handleSaveGasMovement = async (gasData) => {
    try {
      const { data, error } = await supabase
        .from('gas_cylinder_movements')
        .insert([gasData])
        .select()
        .single()

      if (error) throw error

      setGasMovements((prev) => [data, ...prev])
      showFeedback('success', `Movimiento de gas registrado correctamente (${gasData.operation_type}).`)
      setShowGasModal({ isOpen: false, operationType: 'PRIMERA_ENTREGA' })
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al registrar movimiento de cilindro: ' + err.message)
    }
  }

  // Enviar mensaje WhatsApp de reclamo por retención prolongada (Regla P-01)
  const handleWhatsAppClaimP01 = (contractor) => {
    const phone = '' // se toma del contratista o supervisor
    const msg = `Astillero Alon Car - Pañol:\nHola ${contractor.name}, figuran en su poder ${contractor.total} cilindros de gas desde hace más de ${contractor.daysHeld} días. Por favor, acerque los envases vacíos a pañol para su recambio o devolución final.`
    const cleanPhone = phone.replace(/\D/g, '')
    const url = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(url, '_blank')
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans select-none">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-2xl text-xs font-semibold border backdrop-blur-md transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/40 shadow-emerald-950/40'
              : feedback.type === 'error'
              ? 'bg-rose-950/90 text-rose-300 border-rose-500/40 shadow-rose-950/40'
              : 'bg-cyan-950/90 text-cyan-300 border-cyan-500/40 shadow-cyan-950/40'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          ) : feedback.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          ) : (
            <Info className="w-4 h-4 text-cyan-400" />
          )}
          <span>{feedback.text}</span>
        </div>
      )}

      {/* ============================================================================== */}
      {/* ZONA 1: CABECERA Y SELECTOR DE VISTAS                                          */}
      {/* ============================================================================== */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md px-6 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950">
            <Package className="w-6 h-6 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-black text-white tracking-wide">
                PAÑOL CENTRAL & MATERIALES
              </h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-950 border border-emerald-700 text-emerald-400 uppercase tracking-wider">
                M4 Logística Naval
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Kárdex de consumos, control de tubos de gases (P-01/P-02), catálogo maestro y stock físico
            </p>
          </div>
        </div>

        {/* Accesos a Compras + Acciones Principales */}
        <div className="flex flex-wrap items-center gap-2">
          {/* BOTÓN 1: Pedir Materiales a Compras */}
          <button
            onClick={() => navigate('/compras?mode=simple&nuevo=true')}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/20 cursor-pointer"
            title="Abre directamente el formulario de compras para solicitar insumos"
          >
            <ShoppingCart className="w-4 h-4 stroke-[2.5]" />
            <span>+ Pedir Materiales</span>
          </button>

          {/* BOTÓN 2: Ver Compras y Recepciones */}
          <button
            onClick={() => navigate('/compras?mode=simple')}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-200 font-semibold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Ir a la vista simplificada de Compras para revisar pedidos y cotejar remitos"
          >
            <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
            <span>Ver Compras y Recepciones</span>
          </button>

          <div className="h-6 w-px bg-slate-800 mx-1" />

          {/* Botones de acción propios de Pañol */}
          {activeTab === 'movimientos' && (
            <button
              onClick={() => setShowWithdrawalModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Registrar Retiro</span>
            </button>
          )}

          {activeTab === 'gases' && (
            <button
              onClick={() => setShowGasModal({ isOpen: true, operationType: 'PRIMERA_ENTREGA' })}
              className="px-3.5 py-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-purple-500/20 transition-all cursor-pointer"
            >
              <Flame className="w-4 h-4 stroke-[2.5]" />
              <span>Nuevo Movimiento Tubo</span>
            </button>
          )}

          {activeTab === 'catalogo' && (
            <button
              onClick={() => setShowNewMaterialModal(true)}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nuevo Material</span>
            </button>
          )}

          {/* Recargar */}
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-1.5 rounded-lg border border-slate-700 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all cursor-pointer"
            title="Recargar datos"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </header>

      {/* Selector de Pestañas Principales */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => changeTab('movimientos')}
          className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'movimientos'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>📋 Kárdex de Retiros</span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-800 text-slate-300">
            {inventoryTx.length}
          </span>
        </button>

        <button
          onClick={() => changeTab('gases')}
          className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'gases'
              ? 'border-purple-500 text-purple-400 bg-purple-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Flame className="w-4 h-4" />
          <span>💨 Control de Gases (Detalle de Tubos)</span>
          {kpis.retencionProlongada > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-950 text-rose-400 border border-rose-800 font-bold">
              {kpis.retencionProlongada} P-01
            </span>
          )}
        </button>

        <button
          onClick={() => changeTab('catalogo')}
          className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'catalogo'
              ? 'border-cyan-500 text-cyan-400 bg-cyan-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Package className="w-4 h-4" />
          <span>📦 Catálogo & Stock Físico (B.D)</span>
          {kpis.criticalStock > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-950 text-rose-400 border border-rose-800">
              {kpis.criticalStock}
            </span>
          )}
        </button>

        <button
          onClick={() => changeTab('epp')}
          className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'epp'
              ? 'border-amber-500 text-amber-400 bg-amber-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>🦺 Control de EPP por Operario</span>
        </button>
      </div>

      {/* ============================================================================== */}
      {/* ZONA 2: RADAR DE 5 KPIS INTERACTIVOS                                           */}
      {/* ============================================================================== */}
      <div className="px-6 py-3 bg-slate-900/40 border-b border-slate-800 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* KPI 1: Stock Crítico / Quiebre */}
        <div
          onClick={() => {
            changeTab('catalogo')
            setActiveKpiFilter(activeKpiFilter === 'critico' ? null : 'critico')
          }}
          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
            activeKpiFilter === 'critico'
              ? 'bg-rose-950/40 border-rose-500 shadow-md shadow-rose-950/30'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Stock Crítico</span>
            <AlertTriangle className={`w-3.5 h-3.5 ${kpis.criticalStock > 0 ? 'text-rose-400' : 'text-slate-600'}`} />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-xl font-black font-mono ${kpis.criticalStock > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
              {kpis.criticalStock}
            </span>
            <span className="text-[10px] text-slate-500">quiebres</span>
          </div>
        </div>

        {/* KPI 2: Retiros Hoy */}
        <div
          onClick={() => {
            changeTab('movimientos')
            setActiveKpiFilter(activeKpiFilter === 'hoy' ? null : 'hoy')
          }}
          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
            activeKpiFilter === 'hoy'
              ? 'bg-emerald-950/40 border-emerald-500 shadow-md shadow-emerald-950/30'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Retiros Hoy</span>
            <Clock className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black font-mono text-emerald-400">
              {kpis.retirosHoy}
            </span>
            <span className="text-[10px] text-slate-500">movimientos</span>
          </div>
        </div>

        {/* KPI 3: Retiros sin OT (Nullable 0028) */}
        <div
          onClick={() => {
            changeTab('movimientos')
            setActiveKpiFilter(activeKpiFilter === 'sin_ot' ? null : 'sin_ot')
          }}
          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
            activeKpiFilter === 'sin_ot'
              ? 'bg-amber-950/40 border-amber-500 shadow-md shadow-amber-950/30'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Sin Cargar OT</span>
            <Anchor className={`w-3.5 h-3.5 ${kpis.sinOt > 0 ? 'text-amber-400' : 'text-slate-600'}`} />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-xl font-black font-mono ${kpis.sinOt > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
              {kpis.sinOt}
            </span>
            <span className="text-[10px] text-slate-500">pendientes</span>
          </div>
        </div>

        {/* KPI 4: Tubos Vacíos en Patio (P-02) */}
        <div
          onClick={() => changeTab('gases')}
          className="p-3 rounded-xl border bg-slate-900/80 border-slate-800 hover:border-purple-500/50 transition-all cursor-pointer flex flex-col justify-between"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Vacíos en Patio</span>
            <Flame className="w-3.5 h-3.5 text-purple-400" />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-xl font-black font-mono text-purple-400">
              {kpis.vaciosPatio}
            </span>
            <span className="text-[10px] text-slate-500">a reponer (P-02)</span>
          </div>
        </div>

        {/* KPI 5: Cilindros >15 Días Retención (P-01) */}
        <div
          onClick={() => changeTab('gases')}
          className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
            kpis.retencionProlongada > 0
              ? 'bg-rose-950/30 border-rose-700/60 shadow-md shadow-rose-950/20'
              : 'bg-slate-900/80 border-slate-800'
          }`}
        >
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-semibold">Retención &gt; 15d</span>
            <Shield className={`w-3.5 h-3.5 ${kpis.retencionProlongada > 0 ? 'text-rose-400 animate-pulse' : 'text-slate-600'}`} />
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className={`text-xl font-black font-mono ${kpis.retencionProlongada > 0 ? 'text-rose-400' : 'text-slate-200'}`}>
              {kpis.retencionProlongada}
            </span>
            <span className="text-[10px] text-slate-500">talleres / obras</span>
          </div>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* ZONA 3: BARRA DE HERRAMIENTAS Y FILTROS UNIVERSALES                            */}
      {/* ============================================================================== */}
      <div className="px-6 py-3 bg-slate-900/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        {/* Buscador Universal */}
        <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-lg">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por material, barco, OT, operario, vale, o nota... (Esc para limpiar)"
              className="w-full pl-9 pr-8 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-all font-sans"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Filtros rápidos: Periodo, Categoría y Barco */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Selector de Periodo */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-lg p-0.5 text-[11px]">
            {['TODOS', 'HOY', 'QUINCENA', 'MES'].map((period) => (
              <button
                key={period}
                onClick={() => setFilterPeriod(period)}
                className={`px-2.5 py-1 rounded-md font-semibold transition-all cursor-pointer ${
                  filterPeriod === period
                    ? 'bg-slate-800 text-cyan-400 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {period === 'TODOS' ? 'Histórico' : period}
              </button>
            ))}
          </div>

          {/* Selector de Categoría */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-400 font-semibold"
          >
            <option value="TODAS">Todas las Categorías</option>
            <option value="MATERIALES">Materiales Navales</option>
            <option value="CONSUMIBLES">Consumibles de Taller</option>
            <option value="ELEM.SEGURIDAD">Seguridad (EPP)</option>
            <option value="GASES">Gases Industriales</option>
          </select>

          {/* Selector de Barco */}
          <select
            value={filterShip}
            onChange={(e) => setFilterShip(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-slate-300 focus:outline-none focus:border-cyan-400 font-semibold"
          >
            <option value="TODOS">Todos los Barcos</option>
            {ships.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Botón Limpiar Filtros */}
          {(searchQuery || activeKpiFilter || filterPeriod !== 'TODOS' || filterCategory !== 'TODAS' || filterShip !== 'TODOS') && (
            <button
              onClick={() => {
                setSearchQuery('')
                setActiveKpiFilter(null)
                setFilterPeriod('TODOS')
                setFilterCategory('TODAS')
                setFilterShip('TODOS')
              }}
              className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 border border-rose-800/60 text-rose-300 text-xs font-semibold flex items-center gap-1 hover:bg-rose-900/50 transition-all cursor-pointer"
              title="Restablecer todos los filtros (Esc)"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {/* ============================================================================== */}
      {/* ZONA 4: GRILLAS SPREADSHEET REACTIVAS SEGÚN LA PESTAÑA ACTIVA                 */}
      {/* ============================================================================== */}
      <main className="flex-1 overflow-auto bg-slate-950 p-6">
        {/* PESTAÑA 1: 📋 KÁRDEX DE RETIROS DE MATERIALES */}
        {activeTab === 'movimientos' && (
          <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-bold uppercase tracking-wider sticky top-0 z-10">
                    <th className="py-2.5 px-3 w-12 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-slate-500 font-mono">#</span>
                        <input
                          type="checkbox"
                          checked={selectedTxIds.size > 0 && selectedTxIds.size === filteredTransactions.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedTxIds(new Set(filteredTransactions.map((t) => t.id)))
                            } else {
                              setSelectedTxIds(new Set())
                            }
                          }}
                          className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                        />
                      </div>
                    </th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Vale / N°</th>
                    <th className="py-2.5 px-3">Barco / Destino</th>
                    <th className="py-2.5 px-3">OT / Tarea</th>
                    <th className="py-2.5 px-3">Material Insumo</th>
                    <th className="py-2.5 px-3 text-right">Cantidad</th>
                    <th className="py-2.5 px-3">Retirado Por</th>
                    <th className="py-2.5 px-3">Contratista / Taller</th>
                    <th className="py-2.5 px-3">Tipo Movimiento</th>
                    <th className="py-2.5 px-3">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-500">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold">No se encontraron movimientos registrados con estos filtros.</p>
                        <p className="text-[11px] text-slate-600 mt-1">Presiona "Registrar Retiro" para asentar una salida de pañol.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx, idx) => {
                      const isSelected = selectedTxIds.has(tx.id)
                      const mat = materials.find((m) => m.id === tx.material_id)
                      const ship = ships.find((s) => s.id === tx.ship_id)
                      const wo = workOrders.find((w) => w.id === tx.work_order_id)
                      const isSinOt = !tx.work_order_id

                      return (
                        <tr
                          key={tx.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isSelected ? 'bg-emerald-950/20' : ''
                          }`}
                        >
                          {/* Columna apilada # y Checkbox */}
                          <td className="py-2 px-3 text-center">
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[10px] text-slate-500 font-mono leading-none">
                                {idx + 1}
                              </span>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  const next = new Set(selectedTxIds)
                                  if (e.target.checked) next.add(tx.id)
                                  else next.delete(tx.id)
                                  setSelectedTxIds(next)
                                }}
                                className="rounded border-slate-700 bg-slate-950 text-emerald-500 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                              />
                            </div>
                          </td>

                          {/* Fecha */}
                          <td className="py-2 px-3 text-slate-300 font-mono text-[11px] whitespace-nowrap">
                            {tx.transaction_date ? String(tx.transaction_date).split('T')[0] : '-'}
                          </td>

                          {/* Vale */}
                          <td className="py-2 px-3 font-mono font-bold text-slate-300">
                            <HighlightText text={tx.voucher_number || '-'} query={searchQuery} />
                          </td>

                          {/* Barco */}
                          <td className="py-2 px-3 font-semibold text-slate-200">
                            <div className="flex items-center gap-1.5">
                              <Anchor className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <HighlightText text={ship?.name || 'STOCK GENERAL'} query={searchQuery} />
                            </div>
                          </td>

                          {/* OT */}
                          <td className="py-2 px-3">
                            {isSinOt ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-950/50 border border-amber-800 text-amber-300 text-[10px] font-bold">
                                ⚠️ Sin OT Cargada
                              </span>
                            ) : (
                              <div className="max-w-[200px] truncate text-slate-300" title={wo?.description}>
                                <HighlightText text={wo?.description || `OT #${wo?.ot_number}`} query={searchQuery} />
                              </div>
                            )}
                          </td>

                          {/* Material */}
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-2">
                              {mat?.image_url && (
                                <button
                                  onClick={() => setPreviewImage(mat.image_url)}
                                  className="w-5 h-5 rounded overflow-hidden shrink-0 border border-slate-700 hover:border-cyan-400 transition-all cursor-pointer"
                                  title="Ver foto técnica del material"
                                >
                                  <img src={mat.image_url} alt="" className="w-full h-full object-cover" />
                                </button>
                              )}
                              <span className="font-bold text-white">
                                <HighlightText text={mat?.name || 'Material Desconocido'} query={searchQuery} />
                              </span>
                            </div>
                          </td>

                          {/* Cantidad */}
                          <td className="py-2 px-3 text-right font-mono font-black text-emerald-400">
                            {tx.quantity_withdrawn} {mat?.unit_measure || 'un.'}
                          </td>

                          {/* Retirado Por */}
                          <td className="py-2 px-3 text-slate-300">
                            <HighlightText text={tx.worker_name || '-'} query={searchQuery} />
                          </td>

                          {/* Contratista */}
                          <td className="py-2 px-3 text-slate-400">
                            <HighlightText text={tx.contractor_name || '-'} query={searchQuery} />
                          </td>

                          {/* Tipo Movimiento */}
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                tx.movement_type === 'AJUSTE_INVENTARIO'
                                  ? 'bg-purple-950/60 text-purple-300 border border-purple-800'
                                  : tx.movement_type === 'ENTREGA_EPP'
                                  ? 'bg-amber-950/60 text-amber-300 border border-amber-800'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                            >
                              {tx.movement_type || 'CONSUMO_OBRA'}
                            </span>
                          </td>

                          {/* Observaciones */}
                          <td className="py-2 px-3 text-slate-500 text-[11px] max-w-[200px] truncate" title={tx.notes}>
                            <HighlightText text={tx.notes || '-'} query={searchQuery} />
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PESTAÑA 2: 💨 CONTROL DE GASES NAVALES Y DETALLE DE TUBOS */}
        {activeTab === 'gases' && (
          <div className="space-y-6">
            {/* Panel de Patio: Llenos vs Vacíos por Proveedor (Regla P-02) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                  <Flame className="w-4 h-4 text-purple-400" />
                  <span>Estado de Patio de Cilindros por Proveedor (Regla P-02)</span>
                </h3>
                <span className="text-xs text-slate-400">
                  Consolidado para reposición semanal (Air Liquide) o quincenal (Praxair Linde)
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Object.values(gasStats.patioStock).map(({ supplier, full, empty }) => {
                  const isAir = supplier.name.toUpperCase().includes('AIR LIQUIDE')
                  const isLinde = supplier.name.toUpperCase().includes('LINDE') || supplier.name.toUpperCase().includes('PRAXAIR')

                  return (
                    <div
                      key={supplier.id}
                      className="p-4 rounded-xl border border-slate-800 bg-slate-900/80 flex flex-col justify-between shadow-lg"
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <span className="font-black text-sm text-white tracking-wide">{supplier.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-bold">
                            {supplier.trade || 'GASES'}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {supplier.order_cutoff_day ? `Cierre: ${supplier.order_cutoff_day}` : 'A demanda'}
                        </p>

                        <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                          <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-800/40">
                            <span className="block text-xs text-emerald-400 font-semibold">Llenos en Pañol</span>
                            <span className="text-xl font-black font-mono text-emerald-300">{full}</span>
                          </div>
                          <div className="p-2 rounded-lg bg-purple-950/30 border border-purple-800/40">
                            <span className="block text-xs text-purple-400 font-semibold">Vacíos en Patio</span>
                            <span className="text-xl font-black font-mono text-purple-300">{empty}</span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80">
                        <button
                          onClick={() => {
                            if (isAir) {
                              alert(`Regla P-02 Air Liquide:\nLlamar al 0810-222-5272\nN° Cliente Alon Car: 2234867\nVacíos a canjear: ${empty} tubos.`)
                            } else {
                              navigate('/compras?mode=simple&nuevo=true')
                            }
                          }}
                          className="w-full py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-purple-600/20 cursor-pointer"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>Pedir Reposición ({empty} Vacíos)</span>
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Los 3 Botones de Operaciones de Envases */}
            <div className="p-4 rounded-xl border border-slate-800 bg-slate-900/60 flex flex-wrap items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-slate-300 uppercase">Acciones Rápidas de Pañol para Tubos</h4>
                <p className="text-xs text-slate-500">Registra entregas a obras, recambios mano a mano o reingreso de envases</p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowGasModal({ isOpen: true, operationType: 'PRIMERA_ENTREGA' })}
                  className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>1. Primera Entrega (Salida a Obra)</span>
                </button>

                <button
                  onClick={() => setShowGasModal({ isOpen: true, operationType: 'RECAMBIO_1X1' })}
                  className="px-3.5 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4 stroke-[2.5]" />
                  <span>2. Recambio (1 x 1 Cruce Marcas)</span>
                </button>

                <button
                  onClick={() => setShowGasModal({ isOpen: true, operationType: 'DEVOLUCION_FINAL' })}
                  className="px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>3. Devolución Final (Reingreso Patio)</span>
                </button>
              </div>
            </div>

            {/* Matriz de Tenencia de Tubos por Contratista / Taller / Buque */}
            <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden shadow-2xl">
              <div className="p-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <span>DETALLE DE TUBOS EN CONTRATISTAS Y OBRAS</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">
                      Matriz de Tenencia
                    </span>
                  </h4>
                  <p className="text-xs text-slate-500">
                    Alerta automática en amarillo/naranja ante retenciones mayores a 15 días sin movimiento (Regla P-01)
                  </p>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-bold uppercase tracking-wider sticky top-0 z-10">
                      <th className="py-2.5 px-3">Contratista / Taller</th>
                      <th className="py-2.5 px-3">Barco Asignado</th>
                      <th className="py-2.5 px-3 text-right">Oxígeno</th>
                      <th className="py-2.5 px-3 text-right">Acetileno</th>
                      <th className="py-2.5 px-3 text-right">Atal / Mezcla</th>
                      <th className="py-2.5 px-3 text-right">Propano 45kg</th>
                      <th className="py-2.5 px-3 text-right font-black">Total Tubos</th>
                      <th className="py-2.5 px-3">Último Movimiento</th>
                      <th className="py-2.5 px-3 text-center">Días Retención</th>
                      <th className="py-2.5 px-3 text-center">Acción P-01</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {gasStats.contractorList.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="py-12 text-center text-slate-500">
                          <Flame className="w-8 h-8 mx-auto mb-2 opacity-30" />
                          <p className="font-semibold">No hay deudas de envases registradas en este momento.</p>
                        </td>
                      </tr>
                    ) : (
                      gasStats.contractorList.map((c, idx) => {
                        const ship = ships.find((s) => s.id === c.shipId)
                        const oxigeno = Object.entries(c.gases).find(([k]) => k.toUpperCase().includes('OXIGENO'))?.[1] || 0
                        const acetileno = Object.entries(c.gases).find(([k]) => k.toUpperCase().includes('ACETILENO'))?.[1] || 0
                        const atal = Object.entries(c.gases).find(([k]) => k.toUpperCase().includes('ATAL') || k.toUpperCase().includes('MEZCLA'))?.[1] || 0
                        const propano = Object.entries(c.gases).find(([k]) => k.toUpperCase().includes('PROPANO') || k.toUpperCase().includes('45'))?.[1] || 0

                        return (
                          <tr
                            key={idx}
                            className={`hover:bg-slate-800/40 transition-colors ${
                              c.isOverdue ? 'bg-rose-950/20' : ''
                            }`}
                          >
                            <td className="py-2 px-3 font-bold text-white flex items-center gap-1.5">
                              <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              <span>{c.name}</span>
                            </td>
                            <td className="py-2 px-3 text-slate-300">
                              {ship?.name || 'Astillero / Varios'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono text-slate-300">{oxigeno || '-'}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-300">{acetileno || '-'}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-300">{atal || '-'}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-300">{propano || '-'}</td>
                            <td className="py-2 px-3 text-right font-mono font-black text-purple-400">
                              {c.total}
                            </td>
                            <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                              {c.lastDate ? String(c.lastDate).split('T')[0] : '-'}
                            </td>
                            <td className="py-2 px-3 text-center font-mono">
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                  c.isOverdue
                                    ? 'bg-rose-950 border border-rose-700 text-rose-300'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {c.daysHeld} días
                              </span>
                            </td>
                            <td className="py-2 px-3 text-center">
                              {c.isOverdue && (
                                <button
                                  onClick={() => handleWhatsAppClaimP01(c)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-[11px] flex items-center gap-1 mx-auto transition-all cursor-pointer shadow-sm"
                                  title="Enviar recordatorio WhatsApp por retención >15 días"
                                >
                                  <MessageSquare className="w-3 h-3" />
                                  <span>Reclamar (WhatsApp)</span>
                                </button>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 3: 📦 CATÁLOGO MAESTRO & STOCK FÍSICO (B.D MATERIALES) */}
        {activeTab === 'catalogo' && (
          <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-bold uppercase tracking-wider sticky top-0 z-10">
                    <th className="py-2.5 px-3 w-12 text-center">#</th>
                    <th className="py-2.5 px-3 w-12 text-center">Foto</th>
                    <th className="py-2.5 px-3">Material Técnico</th>
                    <th className="py-2.5 px-3">Categoría</th>
                    <th className="py-2.5 px-3">Rubro</th>
                    <th className="py-2.5 px-3 text-right">Stock Físico</th>
                    <th className="py-2.5 px-3 text-right">Mínimo</th>
                    <th className="py-2.5 px-3 text-center">Semáforo</th>
                    <th className="py-2.5 px-3">U. Medida</th>
                    <th className="py-2.5 px-3 text-center">% Seguridad</th>
                    <th className="py-2.5 px-3 text-right">Costo Estimado</th>
                    <th className="py-2.5 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-12 text-center text-slate-500">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold">No se encontraron materiales en el catálogo con estos filtros.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map((mat, idx) => {
                      const curr = Number(mat.current_stock) || 0
                      const min = Number(mat.minimum_stock) || 0
                      const isQuiebre = curr <= 0
                      const isBajo = curr > 0 && curr <= min

                      return (
                        <tr key={mat.id} className="hover:bg-slate-800/40 transition-colors">
                          <td className="py-2 px-3 text-center text-slate-500 font-mono text-[10px]">
                            {idx + 1}
                          </td>

                          {/* Foto Técnica (DEC-010) */}
                          <td className="py-2 px-3 text-center">
                            {mat.image_url ? (
                              <button
                                onClick={() => setPreviewImage(mat.image_url)}
                                className="w-8 h-8 rounded-lg overflow-hidden border border-slate-700 hover:border-cyan-400 transition-all cursor-pointer inline-block"
                                title="Clic para ampliar foto"
                              >
                                <img src={mat.image_url} alt="" className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 mx-auto">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                          </td>

                          {/* Nombre */}
                          <td className="py-2 px-3 font-bold text-white">
                            <HighlightText text={mat.name} query={searchQuery} />
                          </td>

                          {/* Categoría */}
                          <td className="py-2 px-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                mat.category === 'MATERIALES'
                                  ? 'bg-blue-950 text-blue-300 border border-blue-800'
                                  : mat.category === 'CONSUMIBLES'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-amber-950 text-amber-300 border border-amber-800'
                              }`}
                            >
                              {mat.category || 'MATERIALES'}
                            </span>
                          </td>

                          {/* Rubro */}
                          <td className="py-2 px-3 text-slate-300">
                            <HighlightText text={mat.rubro || '-'} query={searchQuery} />
                          </td>

                          {/* Stock Actual */}
                          <td className="py-2 px-3 text-right font-mono font-black text-sm">
                            <span
                              className={
                                isQuiebre
                                  ? 'text-rose-400'
                                  : isBajo
                                  ? 'text-amber-400'
                                  : 'text-emerald-400'
                              }
                            >
                              {curr}
                            </span>
                          </td>

                          {/* Stock Mínimo */}
                          <td className="py-2 px-3 text-right font-mono text-slate-400">
                            {min}
                          </td>

                          {/* Semáforo */}
                          <td className="py-2 px-3 text-center">
                            {isQuiebre ? (
                              <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold">
                                🔴 Quiebre
                              </span>
                            ) : isBajo ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-950 text-amber-400 border border-amber-800 text-[10px] font-bold">
                                🟡 Bajo Stock
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                                🟢 Óptimo
                              </span>
                            )}
                          </td>

                          {/* Unidad */}
                          <td className="py-2 px-3 text-slate-300 font-mono text-[11px]">
                            {mat.unit_measure || 'Unidad'}
                          </td>

                          {/* Factor Seguridad */}
                          <td className="py-2 px-3 text-center font-mono text-slate-400 text-[11px]">
                            {mat.security_factor || 1.06}
                          </td>

                          {/* Costo */}
                          <td className="py-2 px-3 text-right font-mono text-slate-300 text-[11px]">
                            ${mat.cost_ars?.toLocaleString() || '0'}
                          </td>

                          {/* Acciones */}
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Botón Reponer (Lleva a Compras) */}
                              <button
                                onClick={() => navigate(`/compras?mode=simple&nuevo=true&materialId=${mat.id}`)}
                                className="p-1 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 hover:bg-cyan-900 transition-all cursor-pointer"
                                title="Solicitar reposición a Compras"
                              >
                                <ShoppingCart className="w-3.5 h-3.5" />
                              </button>

                              {/* Botón Ajuste Físico */}
                              <button
                                onClick={() => setShowStockAdjustModal({ isOpen: true, material: mat })}
                                className="p-1 rounded bg-purple-950 border border-purple-800 text-purple-400 hover:bg-purple-900 transition-all cursor-pointer"
                                title="Ajuste de inventario físico"
                              >
                                <Scale className="w-3.5 h-3.5" />
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
        )}

        {/* PESTAÑA 4: 🦺 CONTROL DE EPP POR OPERARIO */}
        {activeTab === 'epp' && (
          <div className="border border-slate-800 rounded-xl bg-slate-900/50 overflow-hidden shadow-2xl">
            <div className="p-4 border-b border-slate-800">
              <h4 className="text-sm font-black text-white flex items-center gap-2">
                <Shield className="w-4 h-4 text-amber-400" />
                <span>HISTORIAL DE ENTREGA DE ELEMENTOS DE SEGURIDAD (EPP)</span>
              </h4>
              <p className="text-xs text-slate-500">
                Trazabilidad de indumentaria y protección entregada por operario para seguridad e higiene y deducciones
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-bold uppercase tracking-wider sticky top-0 z-10">
                    <th className="py-2.5 px-3">Operario</th>
                    <th className="py-2.5 px-3">Oficio / Sector</th>
                    <th className="py-2.5 px-3">Habilitado Pañol</th>
                    <th className="py-2.5 px-3">Último EPP Retirado</th>
                    <th className="py-2.5 px-3">Fecha de Entrega</th>
                    <th className="py-2.5 px-3 text-right">Total EPPs Entregados</th>
                    <th className="py-2.5 px-3 text-center">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {workers.map((w) => {
                    const eppTx = inventoryTx.filter((t) => {
                      if (t.worker_id && t.worker_id === w.id) return t.movement_type === 'ENTREGA_EPP'
                      if (t.worker_name && t.worker_name.toUpperCase() === w.name.toUpperCase()) return t.movement_type === 'ENTREGA_EPP'
                      return false
                    })
                    const lastEpp = eppTx[0]
                    const mat = lastEpp ? materials.find((m) => m.id === lastEpp.material_id) : null

                    return (
                      <tr key={w.id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2 px-3 font-bold text-white flex items-center gap-2">
                          <User className="w-3.5 h-3.5 text-slate-500" />
                          <span>{w.name}</span>
                        </td>
                        <td className="py-2 px-3 text-slate-400">{w.trade || 'GENERAL'}</td>
                        <td className="py-2 px-3">
                          {w.can_withdraw_materials ? (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold">
                              ✓ Habilitado
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold">
                              ✕ No Habilitado
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 font-semibold text-slate-200">
                          {mat?.name || (eppTx.length > 0 ? 'EPP General' : '-')}
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-400 text-[11px]">
                          {lastEpp?.transaction_date ? String(lastEpp.transaction_date).split('T')[0] : '-'}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-amber-400">
                          {eppTx.length} entregas
                        </td>
                        <td className="py-2 px-3 text-center">
                          <button
                            onClick={() => {
                              setShowWithdrawalModal(true)
                            }}
                            className="px-2.5 py-1 rounded bg-amber-950/60 border border-amber-800 text-amber-300 font-bold text-[11px] hover:bg-amber-900 transition-all cursor-pointer"
                          >
                            + Entregar EPP
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ============================================================================== */}
      {/* ZONA 5: BARRA INFERIOR DE TOTALES Y ACCIONES EN BLOQUE                         */}
      {/* ============================================================================== */}
      <footer className="border-t border-slate-800 bg-slate-900/90 px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-4 text-slate-400">
          <div>
            <span className="text-slate-500">Mostrando:</span>{' '}
            <span className="font-mono font-bold text-white">
              {activeTab === 'movimientos'
                ? filteredTransactions.length
                : activeTab === 'catalogo'
                ? filteredMaterials.length
                : gasStats.contractorList.length}
            </span>{' '}
            registros
          </div>
          <div className="h-4 w-px bg-slate-800" />
          <div>
            <span className="text-slate-500">Catálogo Total:</span>{' '}
            <span className="font-mono font-bold text-cyan-400">{materials.length} materiales</span>
          </div>
        </div>

        {/* Barra flotante de acciones masivas cuando hay filas seleccionadas */}
        {selectedTxIds.size > 0 && activeTab === 'movimientos' && (
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-emerald-500/40 shadow-lg">
            <span className="text-emerald-400 font-bold">{selectedTxIds.size} seleccionados</span>
            <button
              onClick={() => {
                if (confirm(`¿Deseas desasentar o eliminar los ${selectedTxIds.size} movimientos seleccionados?`)) {
                  // Eliminación masiva
                  supabase
                    .from('inventory_transactions')
                    .delete()
                    .in('id', Array.from(selectedTxIds))
                    .then(() => {
                      showFeedback('success', `${selectedTxIds.size} movimientos eliminados correctamente.`)
                      setSelectedTxIds(new Set())
                      fetchData()
                    })
                }
              }}
              className="px-2 py-1 rounded bg-rose-950 text-rose-300 border border-rose-800 hover:bg-rose-900 font-semibold cursor-pointer"
            >
              Eliminar Selección
            </button>
          </div>
        )}
      </footer>

      {/* ============================================================================== */}
      {/* MODALES: REGISTRO RETIRO, ALTA MATERIAL, AJUSTE STOCK Y GASES                  */}
      {/* ============================================================================== */}

      {/* MODAL 1: REGISTRAR RETIRO / SALIDA DE PAÑOL */}
      {showWithdrawalModal && (
        <WithdrawalModal
          materials={materials}
          ships={ships}
          workOrders={workOrders}
          workItems={workItems}
          workers={workers}
          onClose={() => setShowWithdrawalModal(false)}
          onSave={handleSaveWithdrawal}
        />
      )}

      {/* MODAL 2: ALTA FORMAL DE MATERIAL */}
      {showNewMaterialModal && (
        <NewMaterialModal
          rubros={rubros}
          onClose={() => setShowNewMaterialModal(false)}
          onSave={handleSaveMaterial}
        />
      )}

      {/* MODAL 3: AJUSTE DE STOCK FÍSICO */}
      {showStockAdjustModal.isOpen && (
        <StockAdjustModal
          material={showStockAdjustModal.material}
          onClose={() => setShowStockAdjustModal({ isOpen: false, material: null })}
          onSave={handleSaveStockAdjust}
        />
      )}

      {/* MODAL 4: MOVIMIENTOS DE CILINDROS DE GAS */}
      {showGasModal.isOpen && (
        <GasMovementModal
          operationType={showGasModal.operationType}
          materials={materials.filter((m) => m.rubro === 'GASES' || m.category === 'GASES' || m.name.toUpperCase().includes('GAS') || m.name.toUpperCase().includes('OXIGENO'))}
          suppliers={suppliers.filter((s) => s.is_gas_supplier)}
          ships={ships}
          workOrders={workOrders}
          workers={workers}
          onClose={() => setShowGasModal({ isOpen: false, operationType: 'PRIMERA_ENTREGA' })}
          onSave={handleSaveGasMovement}
        />
      )}

      {/* MODAL 5: PREVISUALIZAR IMAGEN TÉCNICA */}
      {previewImage && (
        <div
          onClick={() => setPreviewImage(null)}
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer"
        >
          <div className="max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden p-2 shadow-2xl">
            <img src={previewImage} alt="Material Técnico" className="w-full h-auto max-h-[80vh] object-contain rounded-xl" />
          </div>
        </div>
      )}
    </div>
  )
}

// ==============================================================================
// SUBCOMPONENTE: MODAL DE REGISTRO DE RETIRO DE PAÑOL
// ==============================================================================
function WithdrawalModal({ materials, ships, workOrders, workItems, workers, onClose, onSave }) {
  const [materialId, setMaterialId] = useState('')
  const [shipId, setShipId] = useState('')
  const [workOrderId, setWorkOrderId] = useState('')
  const [workItemId, setWorkItemId] = useState('')
  const [workerId, setWorkerId] = useState('')
  const [contractorName, setContractorName] = useState('ALON CAR')
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [movementType, setMovementType] = useState('CONSUMO_OBRA')

  const selectedMaterial = useMemo(() => materials.find((m) => m.id === materialId), [materials, materialId])
  const selectedWorker = useMemo(() => workers.find((w) => w.id === workerId), [workers, workerId])

  // Filtrar OTs por Barco
  const availableWos = useMemo(() => {
    if (!shipId) return workOrders
    return workOrders.filter((w) => w.ship_id === shipId)
  }, [workOrders, shipId])

  // Filtrar Work Items por OT
  const availableItems = useMemo(() => {
    if (!workOrderId) return []
    return workItems.filter((wi) => wi.work_order_id === workOrderId)
  }, [workItems, workOrderId])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!materialId) return alert('Debes seleccionar un material.')
    if (quantity <= 0) return alert('La cantidad debe ser mayor a 0.')

    onSave({
      material_id: materialId,
      quantity,
      ship_id: shipId || null,
      work_order_id: workOrderId || null,
      work_item_id: workItemId || null,
      worker_id: workerId || null,
      worker_name: selectedWorker?.name || 'PAÑOL',
      contractor_name: contractorName,
      movement_type: movementType,
      notes
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden font-sans">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2 text-white font-black text-sm">
            <Package className="w-4 h-4 text-emerald-400" />
            <span>REGISTRAR SALIDA / RETIRO DE PAÑOL</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Material con stock disponible en vivo */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Material a Retirar <span className="text-rose-400">*</span>
            </label>
            <select
              value={materialId}
              onChange={(e) => setMaterialId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-semibold focus:outline-none focus:border-cyan-400"
            >
              <option value="">Seleccionar material del catálogo...</option>
              {materials.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} (Stock: {m.current_stock} {m.unit_measure || 'un.'})
                </option>
              ))}
            </select>
            {selectedMaterial && (
              <div className="mt-1 flex items-center gap-2 text-[11px] text-slate-400">
                <span>Stock Actual: <strong className="text-emerald-400">{selectedMaterial.current_stock}</strong> {selectedMaterial.unit_measure || 'un.'}</span>
                <span>• Categoría: <strong>{selectedMaterial.category}</strong></span>
                <span>• Rubro: <strong>{selectedMaterial.rubro || '-'}</strong></span>
              </div>
            )}
          </div>

          {/* Cantidad y Unidad */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Cantidad a Retirar <span className="text-rose-400">*</span>
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Tipo de Salida</label>
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-semibold focus:outline-none focus:border-cyan-400"
              >
                <option value="CONSUMO_OBRA">Consumo de Obra / Barco</option>
                <option value="ENTREGA_EPP">Entrega de EPP (Seguridad)</option>
                <option value="CONSUMO_TALLER">Insumo General de Taller</option>
              </select>
            </div>
          </div>

          {/* Barco y OT (Desacoplados - OT Nullable 0028) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Barco / Buque</label>
              <select
                value={shipId}
                onChange={(e) => {
                  setShipId(e.target.value)
                  setWorkOrderId('')
                  setWorkItemId('')
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="">Astillero / Stock General</option>
                {ships.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Orden de Trabajo (OT)</label>
              <select
                value={workOrderId}
                onChange={(e) => {
                  setWorkOrderId(e.target.value)
                  setWorkItemId('')
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="">Dejar sin OT (Asignar luego)</option>
                {availableWos.map((wo) => (
                  <option key={wo.id} value={wo.id}>
                    OT #{wo.ot_number} - {wo.description}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Trabajo Específico dentro de la OT (Work Item) */}
          {availableItems.length > 0 && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Trabajo Específico (Item)</label>
              <select
                value={workItemId}
                onChange={(e) => setWorkItemId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="">Imputar al trabajo general de la OT</option>
                {availableItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.description} ({item.contractor_name || 'Alon Car'})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Operario Solicitante (Validación can_withdraw_materials) */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Operario Solicitante</label>
              <select
                value={workerId}
                onChange={(e) => {
                  const id = e.target.value
                  setWorkerId(id)
                  const w = workers.find((item) => item.id === id)
                  if (w && w.trade) setContractorName(`ASTILLERO.${w.trade}`)
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="">Retiro de Pañol Central</option>
                {workers.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.can_withdraw_materials ? '✓' : '(⚠️ Sin Habilitación)'}
                  </option>
                ))}
              </select>
              {selectedWorker && !selectedWorker.can_withdraw_materials && (
                <p className="text-[11px] text-amber-400 mt-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  Este operario no tiene permiso [P] habilitado en Personal.
                </p>
              )}
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Contratista / Grupo</label>
              <input
                type="text"
                value={contractorName}
                onChange={(e) => setContractorName(e.target.value)}
                placeholder="Ej. TECO TALLER, ASTILLERO.MECANICA"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400 font-semibold"
              />
            </div>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Observaciones</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Detalle del uso, sector de obra o motivo..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Botones */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Confirmar Retiro</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// SUBCOMPONENTE: MODAL DE ALTA FORMAL DE MATERIAL EN CATÁLOGO
// ==============================================================================
function NewMaterialModal({ rubros, onClose, onSave }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('CONSUMIBLES')
  const [rubro, setRubro] = useState('')
  const [unitMeasure, setUnitMeasure] = useState('Unidad')
  const [securityFactor, setSecurityFactor] = useState(1.06)
  const [costArs, setCostArs] = useState(0)
  const [currentStock, setCurrentStock] = useState(0)
  const [minimumStock, setMinimumStock] = useState(5)
  const [imageUrl, setImageUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)

  // Deducción automática de unidad de medida
  const handleNameChange = (val) => {
    setName(val)
    const upper = val.toUpperCase()
    if (upper.includes('X METRO') || upper.includes('MT') || upper.includes('METRO')) {
      setUnitMeasure('metro lineal')
    } else if (upper.includes('X KG') || upper.includes('KG') || upper.includes('KILO')) {
      setUnitMeasure('kg')
    } else if (upper.includes('M2') || upper.includes('X M2')) {
      setUnitMeasure('m2')
    } else if (upper.includes('TUBO') || upper.includes('GAS')) {
      setUnitMeasure('Tubo')
    } else if (upper.includes('LITRO') || upper.includes('LT')) {
      setUnitMeasure('litro')
    }
  }

  // Subir imagen a storage
  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const ext = file.name.split('.').pop()
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`
      const filePath = `catalogo_materiales/${fileName}`

      const { error: upErr } = await supabase.storage.from('compras').upload(filePath, file)
      if (upErr) throw upErr

      const { data: pubData } = supabase.storage.from('compras').getPublicUrl(filePath)
      setImageUrl(pubData.publicUrl)
    } catch (err) {
      console.error(err)
      alert('Error subiendo imagen: ' + err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return alert('El nombre es obligatorio.')
    onSave({
      name,
      category,
      rubro: rubro || 'VARIOS Y GENERAL',
      unit_measure: unitMeasure,
      security_factor: securityFactor,
      cost_ars: costArs,
      current_stock: currentStock,
      minimum_stock: minimumStock,
      image_url: imageUrl
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden font-sans">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2 text-white font-black text-sm">
            <Plus className="w-4 h-4 text-emerald-400 stroke-[3]" />
            <span>ALTA FORMAL DE MATERIAL EN CATÁLOGO (B.D)</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Nombre Técnico del Material <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              required
              placeholder="Ej. ELECTRODO CONARCO 13A 3.25MM X KG"
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Categoría Oficial</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-semibold focus:outline-none focus:border-cyan-400"
              >
                <option value="MATERIALES">MATERIALES (Chapas, Tubos, Ejes)</option>
                <option value="CONSUMIBLES">CONSUMIBLES (Soldadura, Discos, Gases)</option>
                <option value="ELEM.SEGURIDAD">ELEM.SEGURIDAD (EPP)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Rubro Técnico</label>
              <select
                value={rubro}
                onChange={(e) => setRubro(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-semibold focus:outline-none focus:border-cyan-400"
              >
                <option value="">Seleccionar rubro...</option>
                {rubros.map((r) => (
                  <option key={r.id} value={r.name}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Unidad de Medida</label>
              <select
                value={unitMeasure}
                onChange={(e) => setUnitMeasure(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-semibold focus:outline-none focus:border-cyan-400"
              >
                <option value="Unidad">Unidad</option>
                <option value="kg">kg</option>
                <option value="metro lineal">metro lineal</option>
                <option value="m2">m2</option>
                <option value="litro">litro</option>
                <option value="Tubo">Tubo</option>
                <option value="par">par</option>
                <option value="caja">caja</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">% Seguridad (Merma)</label>
              <select
                value={securityFactor}
                onChange={(e) => setSecurityFactor(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
              >
                <option value={1.02}>2% (1.02)</option>
                <option value={1.06}>6% (1.06 Estándar)</option>
                <option value={1.10}>10% (1.10)</option>
                <option value={1.15}>15% (1.15)</option>
                <option value={1.20}>20% (1.20)</option>
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Stock Mínimo</label>
              <input
                type="number"
                min="0"
                value={minimumStock}
                onChange={(e) => setMinimumStock(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Stock Inicial Físico</label>
              <input
                type="number"
                min="0"
                value={currentStock}
                onChange={(e) => setCurrentStock(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Costo Estimado ARS</label>
              <input
                type="number"
                min="0"
                value={costArs}
                onChange={(e) => setCostArs(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          {/* Foto Técnica para Verificación Visual (DEC-010) */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Fotografía Técnica (Verificación Visual DEC-010)</label>
            <div className="flex items-center gap-3">
              <label className="px-3 py-2 rounded-lg border border-slate-700 bg-slate-950 text-slate-300 hover:text-white flex items-center gap-2 cursor-pointer transition-all">
                <Camera className="w-4 h-4 text-cyan-400" />
                <span>{uploadingImage ? 'Subiendo imagen...' : 'Seleccionar Foto'}</span>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploadingImage} />
              </label>
              {imageUrl && (
                <div className="flex items-center gap-2">
                  <img src={imageUrl} alt="" className="w-8 h-8 rounded object-cover border border-slate-700" />
                  <span className="text-emerald-400 font-semibold text-[11px]">✓ Foto cargada</span>
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black flex items-center gap-1.5 shadow-md shadow-emerald-500/20 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Guardar en Catálogo</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// SUBCOMPONENTE: MODAL DE AJUSTE FÍSICO DE STOCK EN 1-CLIC
// ==============================================================================
function StockAdjustModal({ material, onClose, onSave }) {
  const [countedQty, setCountedQty] = useState(material?.current_stock || 0)
  const [reason, setReason] = useState('INVENTARIO_FISICO')

  if (!material) return null

  const currentStock = Number(material.current_stock) || 0
  const diff = countedQty - currentStock

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(material.id, countedQty, reason)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden font-sans">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2 text-white font-black text-sm">
            <Scale className="w-4 h-4 text-purple-400" />
            <span>AJUSTE FÍSICO DE INVENTARIO</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <div>
            <span className="text-slate-400 block text-[11px]">Material a Ajustar:</span>
            <span className="font-bold text-white text-sm">{material.name}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
            <div>
              <span className="text-slate-500 block text-[11px]">Stock en Sistema:</span>
              <span className="text-lg font-black font-mono text-slate-300">
                {currentStock} {material.unit_measure || 'un.'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block text-[11px]">Diferencia Detectada:</span>
              <span
                className={`text-lg font-black font-mono ${
                  diff > 0 ? 'text-emerald-400' : diff < 0 ? 'text-rose-400' : 'text-slate-400'
                }`}
              >
                {diff > 0 ? `+${diff}` : diff} {material.unit_measure || 'un.'}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Cantidad Física Contada en Depósito <span className="text-rose-400">*</span>
            </label>
            <input
              type="number"
              step="any"
              value={countedQty}
              onChange={(e) => setCountedQty(Number(e.target.value))}
              required
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-black text-base focus:outline-none focus:border-purple-400"
            />
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Motivo del Ajuste</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-semibold focus:outline-none focus:border-purple-400"
            >
              <option value="INVENTARIO_FISICO">Auditoría / Conteo Físico Periódico</option>
              <option value="ROTURA_MERMA">Merma / Rotura en Pañol</option>
              <option value="ERROR_CARGA">Corrección de Error de Registro Anterior</option>
              <option value="INICIALIZACION">Inicialización de Stock Nuevo</option>
            </select>
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-slate-950 font-black flex items-center gap-1.5 shadow-md shadow-purple-500/20 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Guardar Ajuste Físico</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// SUBCOMPONENTE: MODAL DE MOVIMIENTOS DE CILINDROS DE GASES (P-01 Y P-02)
// ==============================================================================
function GasMovementModal({ operationType, materials, suppliers, ships, workOrders, workers, onClose, onSave }) {
  const [opType, setOpType] = useState(operationType)
  const [materialId, setMaterialId] = useState('')
  const [contractorName, setContractorName] = useState('')
  const [shipId, setShipId] = useState('')
  const [workOrderId, setWorkOrderId] = useState('')
  const [supplierDeliveredId, setSupplierDeliveredId] = useState('')
  const [supplierReturnedId, setSupplierReturnedId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  const availableWos = useMemo(() => {
    if (!shipId) return workOrders
    return workOrders.filter((w) => w.ship_id === shipId)
  }, [workOrders, shipId])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!materialId) return alert('Debes seleccionar el tipo de gas.')
    if (!contractorName.trim()) return alert('Debes indicar el contratista o taller.')

    onSave({
      operation_type: opType,
      material_id: materialId,
      contractor_name: contractorName.trim().toUpperCase(),
      ship_id: shipId || null,
      work_order_id: workOrderId || null,
      supplier_delivered_id: opType !== 'DEVOLUCION_FINAL' ? supplierDeliveredId || null : null,
      supplier_returned_id: opType !== 'PRIMERA_ENTREGA' ? supplierReturnedId || null : null,
      quantity,
      notes
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden font-sans">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2 text-white font-black text-sm">
            <Flame className="w-4 h-4 text-purple-400" />
            <span>MOVIMIENTO DE CILINDROS / GASES INDUSTRIALES</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* Selector de los 3 Tipos de Operación */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Operación de Envase</label>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-lg bg-slate-950 border border-slate-800">
              <button
                type="button"
                onClick={() => setOpType('PRIMERA_ENTREGA')}
                className={`py-1.5 rounded-md font-bold text-center cursor-pointer transition-all ${
                  opType === 'PRIMERA_ENTREGA'
                    ? 'bg-emerald-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                1. Entrega Inicial
              </button>
              <button
                type="button"
                onClick={() => setOpType('RECAMBIO_1X1')}
                className={`py-1.5 rounded-md font-bold text-center cursor-pointer transition-all ${
                  opType === 'RECAMBIO_1X1'
                    ? 'bg-cyan-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                2. Recambio 1x1
              </button>
              <button
                type="button"
                onClick={() => setOpType('DEVOLUCION_FINAL')}
                className={`py-1.5 rounded-md font-bold text-center cursor-pointer transition-all ${
                  opType === 'DEVOLUCION_FINAL'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                3. Devolución
              </button>
            </div>
          </div>

          {/* Tipo de Gas y Cantidad */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-2">
              <label className="block text-slate-300 font-semibold mb-1">
                Tipo de Gas <span className="text-rose-400">*</span>
              </label>
              <select
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-semibold focus:outline-none focus:border-purple-400"
              >
                <option value="">Seleccionar gas...</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Cant. Tubos</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Number(e.target.value))}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-purple-400"
              />
            </div>
          </div>

          {/* Trazabilidad de Proveedores de Envases */}
          {opType === 'PRIMERA_ENTREGA' && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Marca / Proveedor del Tubo Lleno</label>
              <select
                value={supplierDeliveredId}
                onChange={(e) => setSupplierDeliveredId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-semibold focus:outline-none focus:border-purple-400"
              >
                <option value="">Seleccionar proveedor...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {opType === 'RECAMBIO_1X1' && (
            <div className="grid grid-cols-2 gap-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
              <div>
                <label className="block text-purple-400 font-semibold mb-1">Vacío Devuelto (Entra a Patio)</label>
                <select
                  value={supplierReturnedId}
                  onChange={(e) => setSupplierReturnedId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                >
                  <option value="">Marca del vacío...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-emerald-400 font-semibold mb-1">Lleno Entregado (Sale a Obra)</label>
                <select
                  value={supplierDeliveredId}
                  onChange={(e) => setSupplierDeliveredId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs"
                >
                  <option value="">Marca del lleno...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {opType === 'DEVOLUCION_FINAL' && (
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Marca / Proveedor del Vacío Reingresado</label>
              <select
                value={supplierReturnedId}
                onChange={(e) => setSupplierReturnedId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-semibold focus:outline-none focus:border-purple-400"
              >
                <option value="">Seleccionar proveedor...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Contratista y Buque */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Contratista / Taller / Quien Retira <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={contractorName}
                onChange={(e) => setContractorName(e.target.value)}
                required
                placeholder="Ej. TECO TALLER, MECANICA"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-semibold focus:outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Barco / Destino</label>
              <select
                value={shipId}
                onChange={(e) => {
                  setShipId(e.target.value)
                  setWorkOrderId('')
                }}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-400"
              >
                <option value="">Astillero / Sin Asignar</option>
                {ships.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Observaciones</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ubicación a bordo, responsable, etc."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-purple-400"
            />
          </div>

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-700 bg-slate-800 text-slate-300 font-semibold hover:bg-slate-700 cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-purple-500 hover:bg-purple-400 text-slate-950 font-black flex items-center gap-1.5 shadow-md shadow-purple-500/20 cursor-pointer"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Guardar Movimiento</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
