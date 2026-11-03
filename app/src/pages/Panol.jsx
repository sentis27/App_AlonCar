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
  Square,
  Edit3,
  Lock,
  UserCheck,
  UserX
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

// Colores de insignias para % de Seguridad Naval
function getSecurityFactorBadge(factor) {
  const f = Number(factor) || 1.06
  if (f <= 1.02) {
    return { label: '2% (1.02)', style: 'bg-slate-800 text-slate-300 border-slate-700' }
  }
  if (Math.abs(f - 1.06) < 0.005) {
    return { label: '6% (1.06 Estándar)', style: 'bg-emerald-950 text-emerald-300 border-emerald-500/60 font-bold' }
  }
  if (Math.abs(f - 1.10) < 0.005) {
    return { label: '10% (1.10)', style: 'bg-amber-950 text-amber-300 border-amber-600' }
  }
  if (Math.abs(f - 1.15) < 0.005) {
    return { label: '15% (1.15)', style: 'bg-orange-950 text-orange-300 border-orange-600' }
  }
  return { label: `${Math.round((f - 1) * 100)}% (${f})`, style: 'bg-rose-950 text-rose-300 border-rose-600 font-bold' }
}

export default function Panol() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'Admin' || profile?.role === 'Gerencia'

  // Pestañas del módulo: 'planillas' | 'gases' | 'catalogo' | 'epp'
  const [activeTab, setActiveTab] = useState(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam === 'movimientos' || tabParam === 'kardex') return 'planillas'
    return tabParam || 'planillas'
  })

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
  const [workers, setWorkers] = useState([])

  // Filtros de barra de herramientas
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)
  const [filterPeriod, setFilterPeriod] = useState('TODOS') // 'TODOS', 'HOY', 'QUINCENA', 'MES'
  const [filterCategory, setFilterCategory] = useState('TODAS') // 'TODAS', 'MATERIALES', 'CONSUMIBLES', 'ELEM.SEGURIDAD', 'GASES'
  const [filterShip, setFilterShip] = useState('TODOS')
  const [filterStockOnly, setFilterStockOnly] = useState(false) // Solo materiales que requieren control de stock
  const [activeKpiFilter, setActiveKpiFilter] = useState(null) // 'critico' | 'hoy' | 'sin_ot' | 'vacios' | 'retencion'

  // Selección de filas para acciones en bloque
  const [selectedTxIds, setSelectedTxIds] = useState(new Set())
  const [selectedMatIds, setSelectedMatIds] = useState(new Set())

  // Edición in-situ con doble clic
  const [inlineEdit, setInlineEdit] = useState({ id: null, field: null, value: '' })

  // Modales
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false)
  const [showNewMaterialModal, setShowNewMaterialModal] = useState(false)
  const [showStockAdjustModal, setShowStockAdjustModal] = useState({ isOpen: false, material: null })
  const [showGasModal, setShowGasModal] = useState({ isOpen: false, operationType: 'PRIMERA_ENTREGA' })
  const [showPermissionRequestModal, setShowPermissionRequestModal] = useState(false)
  const [previewImage, setPreviewImage] = useState(null)

  // Sincronizar parámetro URL tab
  useEffect(() => {
    const tabParam = searchParams.get('tab')
    if (tabParam) {
      if (tabParam === 'movimientos' || tabParam === 'kardex') setActiveTab('planillas')
      else if (['planillas', 'gases', 'catalogo', 'epp'].includes(tabParam)) setActiveTab(tabParam)
    }
  }, [searchParams])

  const changeTab = (tab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
    setActiveKpiFilter(null)
    setInlineEdit({ id: null, field: null, value: '' })
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
        setFilterStockOnly(false)
        setSelectedTxIds(new Set())
        setSelectedMatIds(new Set())
        setInlineEdit({ id: null, field: null, value: '' })
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
        workersRes
      ] = await Promise.all([
        supabase.from('materials').select('*').order('name'),
        supabase
          .from('inventory_transactions')
          .select('*')
          .order('transaction_date', { ascending: false })
          .limit(600),
        supabase
          .from('gas_cylinder_movements')
          .select('*')
          .order('movement_date', { ascending: false })
          .limit(600),
        supabase.from('material_rubros').select('*').order('name'),
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('ships').select('*').order('name'),
        supabase.from('work_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('workers').select('*').order('name')
      ])

      if (matRes.data) setMaterials(matRes.data)
      if (invRes.data) setInventoryTx(invRes.data)
      if (gasRes.data) setGasMovements(gasRes.data)
      if (rubrosRes.data) setRubros(rubrosRes.data)
      if (supRes.data) setSuppliers(supRes.data)
      if (shipsRes.data) setShips(shipsRes.data)
      if (woRes.data) setWorkOrders(woRes.data)
      if (workersRes.data) setWorkers(workersRes.data)
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
    const patioStock = {}

    gasSuppliers.forEach((s) => {
      patioStock[s.id] = { full: 0, empty: 0, supplier: s }
    })

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

    materials
      .filter((m) => m.rubro === 'GASES' || m.category === 'GASES' || m.name.toUpperCase().includes('GAS') || m.name.toUpperCase().includes('OXIGENO'))
      .forEach((m) => {
        const air = gasSuppliers.find((s) => s.name.toUpperCase().includes('AIR LIQUIDE'))
        if (air && patioStock[air.id]) {
          patioStock[air.id].full += Number(m.current_stock) || 0
        }
      })

    const contractorMap = {}
    const now = new Date()

    gasMovements.forEach((m) => {
      const cName = m.contractor_name || 'SIN ASIGNAR'
      if (!contractorMap[cName]) {
        contractorMap[cName] = {
          name: cName,
          shipId: m.ship_id,
          gases: {},
          total: 0,
          lastDate: m.movement_date
        }
      }

      const mDate = new Date(m.movement_date)
      if (!contractorMap[cName].lastDate || mDate > new Date(contractorMap[cName].lastDate)) {
        contractorMap[cName].lastDate = m.movement_date
      }

      const mat = materials.find((item) => item.id === m.material_id)
      const gasName = mat?.name || 'Tubo Gas'
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

    const contractorList = Object.values(contractorMap).map((c) => {
      const diffMs = c.lastDate ? now - new Date(c.lastDate) : 0
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
      return {
        ...c,
        daysHeld: days,
        isOverdue: days > 15 && c.total > 0
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
    const criticalStock = materials.filter((m) => {
      const curr = Number(m.current_stock) || 0
      const min = Number(m.minimum_stock) || 0
      return curr <= min
    }).length

    const todayStr = new Date().toISOString().split('T')[0]
    const retirosHoy = inventoryTx.filter((t) => {
      const d = String(t.transaction_date).split('T')[0]
      return d === todayStr
    }).length

    const sinOt = inventoryTx.filter((t) => !t.work_order_id).length
    const vaciosPatio = gasStats.totalEmptyPatio
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

  // Filtrado de Planilla de Retiros
  const filteredTransactions = useMemo(() => {
    return inventoryTx.filter((t) => {
      if (activeKpiFilter === 'sin_ot' && t.work_order_id) return false
      if (activeKpiFilter === 'hoy') {
        const d = String(t.transaction_date).split('T')[0]
        const todayStr = new Date().toISOString().split('T')[0]
        if (d !== todayStr) return false
      }

      if (!isDateInFilterPeriod(t.transaction_date)) return false
      if (filterShip !== 'TODOS' && t.ship_id !== filterShip) return false

      const mat = materials.find((m) => m.id === t.material_id)
      if (filterCategory !== 'TODAS') {
        if (!mat) return false
        if (filterCategory === 'GASES') {
          if (mat.rubro !== 'GASES' && mat.category !== 'GASES') return false
        } else if (mat.category !== filterCategory) {
          return false
        }
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const ship = ships.find((s) => s.id === t.ship_id)?.name || ''
        const wo = workOrders.find((w) => w.id === t.work_order_id)?.description || ''
        const matName = mat?.name || ''
        const worker = t.worker_name || ''
        const contractor = t.contractor_name || ''
        const costCenter = t.cost_center || ''
        const notes = t.notes || ''

        const match =
          ship.toLowerCase().includes(q) ||
          wo.toLowerCase().includes(q) ||
          matName.toLowerCase().includes(q) ||
          worker.toLowerCase().includes(q) ||
          contractor.toLowerCase().includes(q) ||
          costCenter.toLowerCase().includes(q) ||
          notes.toLowerCase().includes(q)

        if (!match) return false
      }

      return true
    })
  }, [inventoryTx, activeKpiFilter, filterPeriod, filterShip, filterCategory, searchQuery, materials, ships, workOrders])

  // Filtrado de Catálogo de Materiales
  const filteredMaterials = useMemo(() => {
    return materials.filter((m) => {
      if (activeKpiFilter === 'critico') {
        const curr = Number(m.current_stock) || 0
        const min = Number(m.minimum_stock) || 0
        if (curr > min) return false
      }

      if (filterStockOnly && !m.requires_stock_control) return false

      if (filterCategory !== 'TODAS') {
        if (filterCategory === 'GASES') {
          if (m.rubro !== 'GASES' && m.category !== 'GASES') return false
        } else if (m.category !== filterCategory) {
          return false
        }
      }

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
  }, [materials, activeKpiFilter, filterStockOnly, filterCategory, searchQuery])

  // ==============================================================================
  // ACCIÓN OPERATIVA: INSERTAR FILA EN PLANILLA DE RETIROS
  // ==============================================================================
  const handleInsertRow = async (targetIndex = 0) => {
    try {
      const defaultMat = materials[0]
      const newTx = {
        material_id: defaultMat?.id || null,
        quantity_withdrawn: 1,
        ship_id: ships[0]?.id || null,
        work_order_id: null,
        worker_name: 'PAÑOL',
        contractor_name: 'ALON CAR',
        cost_center: 'CLIENTE',
        weight_total: defaultMat?.weight_kg || 0,
        notes: 'Fila insertada manualmente',
        transaction_date: new Date().toISOString()
      }

      const { data, error } = await supabase
        .from('inventory_transactions')
        .insert([newTx])
        .select()
        .single()

      if (error) throw error

      setInventoryTx((prev) => {
        const next = [...prev]
        next.splice(targetIndex, 0, data)
        return next
      })

      showFeedback('success', 'Nueva fila insertada correctamente en la planilla.')
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al insertar fila: ' + err.message)
    }
  }

  // ==============================================================================
  // EDICIÓN EN CELDA CON DOBLE CLIC (PLANILLA DE RETIROS)
  // ==============================================================================
  const handleSaveInlineTx = async (txId, field, value) => {
    try {
      let finalValue = value
      const updates = { [field]: finalValue }

      // Si se cambia la cantidad o el material, actualizar peso total
      if (field === 'quantity_withdrawn' || field === 'material_id') {
        const tx = inventoryTx.find((t) => t.id === txId)
        const targetMatId = field === 'material_id' ? value : tx?.material_id
        const targetQty = field === 'quantity_withdrawn' ? Number(value) : Number(tx?.quantity_withdrawn) || 1
        const mat = materials.find((m) => m.id === targetMatId)
        if (mat) {
          updates.weight_total = (Number(mat.weight_kg) || 0) * targetQty
        }
      }

      const { error } = await supabase.from('inventory_transactions').update(updates).eq('id', txId)
      if (error) throw error

      setInventoryTx((prev) =>
        prev.map((t) => (t.id === txId ? { ...t, ...updates } : t))
      )
      setInlineEdit({ id: null, field: null, value: '' })
      showFeedback('success', 'Dato actualizado correctamente en la planilla.')
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al actualizar celda: ' + err.message)
    }
  }

  // EDICIÓN EN CELDA CON DOBLE CLIC (CATÁLOGO DE MATERIALES)
  const handleSaveInlineMaterial = async (matId, field, value) => {
    try {
      if (field === 'security_factor' && !isAdmin) {
        showFeedback('error', 'Solo el Administrador tiene autorización para cambiar el porcentaje de seguridad.')
        setInlineEdit({ id: null, field: null, value: '' })
        return
      }

      let parsedValue = value
      if (['weight_kg', 'cost_ars', 'cost_usd', 'current_stock', 'minimum_stock', 'security_factor'].includes(field)) {
        parsedValue = Number(value) || 0
      } else if (field === 'requires_stock_control') {
        parsedValue = Boolean(value)
      }

      const updates = { [field]: parsedValue }
      const { error } = await supabase.from('materials').update(updates).eq('id', matId)
      if (error) throw error

      setMaterials((prev) =>
        prev.map((m) => (m.id === matId ? { ...m, ...updates } : m))
      )
      setInlineEdit({ id: null, field: null, value: '' })
      showFeedback('success', 'Catálogo de materiales actualizado con éxito.')
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error actualizando material: ' + err.message)
    }
  }

  // ==============================================================================
  // ACCIÓN OPERATIVA: GUARDAR RETIRO MULTI-MATERIAL
  // ==============================================================================
  const handleSaveMultiWithdrawal = async ({ shipId, workOrderId, contractorGroup, worker, notes, date, items }) => {
    try {
      if (!items || items.length === 0) throw new Error('No se agregaron materiales al retiro.')

      const txInserts = []
      const matUpdates = []

      for (const item of items) {
        const mat = materials.find((m) => m.id === item.material_id)
        if (!mat) continue

        const qty = Number(item.quantity) || 1
        const weightTotal = (Number(mat.weight_kg) || 0) * qty

        // Calcular nuevo stock
        const currentStock = Number(mat.current_stock) || 0
        const newStock = currentStock - qty
        matUpdates.push({ id: mat.id, newStock })

        // Deducir centro de costo: Si es MATERIALES -> CLIENTE; si no, regla del worker
        let costCenter = 'CLIENTE'
        if (mat.category === 'CONSUMIBLES' || mat.category === 'ELEM.SEGURIDAD') {
          if (worker?.consumables === 'CONTRATISTA') {
            costCenter = 'CONTRATISTA'
          }
        }
        if (item.customCostCenter) costCenter = item.customCostCenter

        txInserts.push({
          material_id: mat.id,
          quantity_withdrawn: qty,
          ship_id: shipId || null,
          work_order_id: workOrderId || null,
          worker_id: worker?.id || null,
          worker_name: worker?.name || 'PAÑOL',
          contractor_name: contractorGroup || 'ALON CAR',
          cost_center: costCenter,
          weight_total: weightTotal,
          movement_type: mat.category === 'ELEM.SEGURIDAD' ? 'ENTREGA_EPP' : 'CONSUMO_OBRA',
          unit_cost_ars_snapshot: mat.cost_ars || 0,
          unit_cost_usd_snapshot: mat.cost_usd || 0,
          notes: item.notes ? `${notes} - ${item.notes}`.trim() : notes,
          transaction_date: date || new Date().toISOString()
        })
      }

      // Guardar todos los movimientos en bloque
      const { data: createdTxs, error: txErr } = await supabase
        .from('inventory_transactions')
        .insert(txInserts)
        .select()

      if (txErr) throw txErr

      // Actualizar stocks en materials
      for (const upd of matUpdates) {
        await supabase.from('materials').update({ current_stock: upd.newStock }).eq('id', upd.id)
      }

      // Actualizar estado local reactivamente
      setInventoryTx((prev) => [...(createdTxs || []), ...prev])
      setMaterials((prev) =>
        prev.map((m) => {
          const upd = matUpdates.find((u) => u.id === m.id)
          return upd ? { ...m, current_stock: upd.newStock } : m
        })
      )

      showFeedback(
        'success',
        `Retiro multi-material confirmado: ${txInserts.length} insumos registrados para ${contractorGroup} (${worker?.name || 'Pañol'}).`
      )
      setShowWithdrawalModal(false)
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al asentar retiro multi-material: ' + err.message)
    }
  }

  // ==============================================================================
  // ACCIÓN OPERATIVA: SOLICITAR HABILITACIÓN DE OPERARIO A JORGE SENTIS
  // ==============================================================================
  const handleRequestWorkerPermission = async ({ workerId, workerName, workGroup, shipId, reason }) => {
    try {
      const payload = {
        worker_id: workerId,
        worker_name: workerName,
        work_group: workGroup,
        requested_by: user?.id || null,
        requested_by_name: profile?.full_name || 'PAÑOLERO',
        ship_id: shipId || null,
        reason: reason || 'Solicitud de retiro de materiales en pañol para obra.',
        status: 'PENDIENTE'
      }

      const { error } = await supabase.from('worker_permission_requests').insert([payload])
      if (error) throw error

      showFeedback(
        'success',
        `Alerta emitida a Jorge Sentis: Se solicitó la habilitación de ${workerName} (${workGroup}) para retirar materiales.`
      )
      setShowPermissionRequestModal(false)
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al solicitar habilitación: ' + err.message)
    }
  }

  // ==============================================================================
  // ACCIONES OPERATIVAS: REPOSICIÓN INDIVIDUAL Y EN LOTE A COMPRAS
  // ==============================================================================
  const handleRequestPurchaseSingle = (mat) => {
    navigate(`/compras?mode=simple&nuevo=true&materialId=${mat.id}&materialName=${encodeURIComponent(mat.name)}`)
  }

  const handleRequestPurchaseBatch = () => {
    if (selectedMatIds.size === 0) return
    const selectedList = materials
      .filter((m) => selectedMatIds.has(m.id))
      .map((m) => ({ id: m.id, name: m.name, unit_measure: m.unit_measure || 'Unidad' }))

    const jsonParam = encodeURIComponent(JSON.stringify(selectedList))
    navigate(`/compras?mode=simple&nuevo=true&multiMaterials=${jsonParam}`)
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
              Planilla de retiros multi-material, control de tubos de gases (P-01/P-02) y catálogo físico de stock
            </p>
          </div>
        </div>

        {/* Accesos a Compras + Acciones Principales */}
        <div className="flex flex-wrap items-center gap-2">
          {/* BOTÓN 1: Pedir Materiales a Compras */}
          <button
            onClick={() => navigate('/compras?mode=simple&nuevo=true')}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-cyan-600/20 cursor-pointer"
            title="Abre el formulario simplificado de Compras para solicitar insumos"
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

          {/* Botones contextuales de acción en Pañol */}
          {activeTab === 'planillas' && (
            <>
              <button
                onClick={() => handleInsertRow(0)}
                className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer"
                title="Insertar fila en la planilla"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>Insertar Fila</span>
              </button>

              <button
                onClick={() => setShowWithdrawalModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Registrar Retiro Multi-Material</span>
              </button>
            </>
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
            <>
              {selectedMatIds.size > 0 && (
                <button
                  onClick={handleRequestPurchaseBatch}
                  className="px-3 py-1.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all cursor-pointer"
                >
                  <ShoppingCart className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Pedir Compra ({selectedMatIds.size} Materiales)</span>
                </button>
              )}

              <button
                onClick={() => setShowNewMaterialModal(true)}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Nuevo Material</span>
              </button>
            </>
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
          onClick={() => changeTab('planillas')}
          className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'planillas'
              ? 'border-emerald-500 text-emerald-400 bg-emerald-950/20'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          <span>📋 Planilla de Retiros</span>
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
            changeTab('planillas')
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
            changeTab('planillas')
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
              placeholder="Buscar por material, barco, OT, operario, grupo... (Esc para limpiar)"
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

        {/* Filtros rápidos: Periodo, Categoría, Control de Stock y Barco */}
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

          {/* Filtro específico de Catálogo: Solo con Control de Stock */}
          {activeTab === 'catalogo' && (
            <button
              onClick={() => setFilterStockOnly(!filterStockOnly)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
                filterStockOnly
                  ? 'bg-cyan-950/80 border-cyan-500 text-cyan-300 shadow-sm'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5 text-cyan-400" />
              <span>Solo con Control de Stock</span>
            </button>
          )}

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
          {(searchQuery || activeKpiFilter || filterPeriod !== 'TODOS' || filterCategory !== 'TODAS' || filterShip !== 'TODOS' || filterStockOnly) && (
            <button
              onClick={() => {
                setSearchQuery('')
                setActiveKpiFilter(null)
                setFilterPeriod('TODOS')
                setFilterCategory('TODAS')
                setFilterShip('TODOS')
                setFilterStockOnly(false)
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
        {/* PESTAÑA 1: 📋 PLANILLA DE RETIROS DE MATERIALES */}
        {activeTab === 'planillas' && (
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
                    <th className="py-2.5 px-3">Barco / Destino</th>
                    <th className="py-2.5 px-3">Orden de Trabajo (OT)</th>
                    <th className="py-2.5 px-3">Material Insumo</th>
                    <th className="py-2.5 px-3 text-right">Cantidad</th>
                    <th className="py-2.5 px-3 text-right">Peso (kg)</th>
                    <th className="py-2.5 px-3">Retirado Por</th>
                    <th className="py-2.5 px-3">Contratista / Grupo</th>
                    <th className="py-2.5 px-3 text-center">Centro de Costo</th>
                    <th className="py-2.5 px-3">Observaciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="py-12 text-center text-slate-500">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold">No se encontraron movimientos registrados con estos filtros.</p>
                        <p className="text-[11px] text-slate-600 mt-1">Presiona "Registrar Retiro Multi-Material" para asentar una salida de pañol.</p>
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

                          {/* Fecha (Doble Clic para editar) */}
                          <td
                            onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'transaction_date', value: tx.transaction_date ? String(tx.transaction_date).split('T')[0] : '' })}
                            className="py-2 px-3 text-slate-300 font-mono text-[11px] whitespace-nowrap cursor-pointer hover:text-cyan-300"
                            title="Doble clic para editar fecha"
                          >
                            {inlineEdit.id === tx.id && inlineEdit.field === 'transaction_date' ? (
                              <input
                                type="date"
                                autoFocus
                                value={inlineEdit.value}
                                onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                onBlur={() => handleSaveInlineTx(tx.id, 'transaction_date', inlineEdit.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveInlineTx(tx.id, 'transaction_date', inlineEdit.value)
                                  if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                                }}
                                className="px-1.5 py-0.5 rounded bg-slate-950 border border-cyan-400 text-white font-mono text-[11px]"
                              />
                            ) : (
                              tx.transaction_date ? String(tx.transaction_date).split('T')[0] : '-'
                            )}
                          </td>

                          {/* Barco (Doble Clic para cambiar) */}
                          <td
                            onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'ship_id', value: tx.ship_id || '' })}
                            className="py-2 px-3 font-semibold text-slate-200 cursor-pointer hover:text-cyan-300"
                            title="Doble clic para cambiar buque"
                          >
                            {inlineEdit.id === tx.id && inlineEdit.field === 'ship_id' ? (
                              <select
                                autoFocus
                                value={inlineEdit.value}
                                onChange={(e) => handleSaveInlineTx(tx.id, 'ship_id', e.target.value)}
                                onBlur={() => setInlineEdit({ id: null, field: null, value: '' })}
                                className="px-1.5 py-0.5 rounded bg-slate-950 border border-cyan-400 text-white text-xs"
                              >
                                <option value="">Astillero / General</option>
                                {ships.map((s) => (
                                  <option key={s.id} value={s.id}>
                                    {s.name}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <Anchor className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                <HighlightText text={ship?.name || 'STOCK GENERAL'} query={searchQuery} />
                              </div>
                            )}
                          </td>

                          {/* OT con Descripción Completa Visible */}
                          <td
                            onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'work_order_id', value: tx.work_order_id || '' })}
                            className="py-2 px-3 cursor-pointer hover:text-cyan-300"
                            title="Doble clic para cambiar o asignar OT"
                          >
                            {inlineEdit.id === tx.id && inlineEdit.field === 'work_order_id' ? (
                              <select
                                autoFocus
                                value={inlineEdit.value}
                                onChange={(e) => handleSaveInlineTx(tx.id, 'work_order_id', e.target.value || null)}
                                onBlur={() => setInlineEdit({ id: null, field: null, value: '' })}
                                className="px-1.5 py-0.5 rounded bg-slate-950 border border-cyan-400 text-white text-xs"
                              >
                                <option value="">(Dejar OT en blanco)</option>
                                {workOrders
                                  .filter((w) => !tx.ship_id || w.ship_id === tx.ship_id)
                                  .map((w) => (
                                    <option key={w.id} value={w.id}>
                                      OT #{w.ot_number} - {w.description}
                                    </option>
                                  ))}
                              </select>
                            ) : isSinOt ? (
                              <span className="px-2 py-0.5 rounded-full bg-amber-950/50 border border-amber-800 text-amber-300 text-[10px] font-bold">
                                ⚠️ Sin OT Cargada
                              </span>
                            ) : (
                              <div className="max-w-[260px] truncate text-slate-300 font-semibold" title={wo?.description}>
                                <span className="font-mono text-cyan-400 font-bold mr-1">OT #{wo?.ot_number}:</span>
                                <HighlightText text={wo?.description || ''} query={searchQuery} />
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

                          {/* Cantidad (Doble Clic para editar) */}
                          <td
                            onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'quantity_withdrawn', value: tx.quantity_withdrawn })}
                            className="py-2 px-3 text-right font-mono font-black text-emerald-400 cursor-pointer hover:bg-slate-800/80"
                            title="Doble clic para editar cantidad"
                          >
                            {inlineEdit.id === tx.id && inlineEdit.field === 'quantity_withdrawn' ? (
                              <input
                                type="number"
                                step="any"
                                autoFocus
                                value={inlineEdit.value}
                                onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                onBlur={() => handleSaveInlineTx(tx.id, 'quantity_withdrawn', inlineEdit.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveInlineTx(tx.id, 'quantity_withdrawn', inlineEdit.value)
                                  if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                                }}
                                className="w-16 px-1.5 py-0.5 rounded bg-slate-950 border border-cyan-400 text-right text-emerald-400 font-mono font-bold text-xs"
                              />
                            ) : (
                              `${tx.quantity_withdrawn} ${mat?.unit_measure || 'un.'}`
                            )}
                          </td>

                          {/* Peso Total (kg) */}
                          <td className="py-2 px-3 text-right font-mono text-slate-300">
                            {tx.weight_total ? `${Number(tx.weight_total).toFixed(2)} kg` : '-'}
                          </td>

                          {/* Retirado Por */}
                          <td className="py-2 px-3 text-slate-300">
                            <HighlightText text={tx.worker_name || '-'} query={searchQuery} />
                          </td>

                          {/* Contratista / Grupo */}
                          <td className="py-2 px-3 font-semibold text-slate-400">
                            <HighlightText text={tx.contractor_name || '-'} query={searchQuery} />
                          </td>

                          {/* Centro de Costo (CLIENTE vs CONTRATISTA) */}
                          <td
                            onDoubleClick={() => {
                              if (!isAdmin) {
                                showFeedback('error', 'Solo el Administrador puede editar el Centro de Costo de imputación.')
                                return
                              }
                              setInlineEdit({ id: tx.id, field: 'cost_center', value: tx.cost_center || 'CLIENTE' })
                            }}
                            className="py-2 px-3 text-center cursor-pointer"
                            title={isAdmin ? 'Doble clic para alternar Centro de Costo (Admin)' : 'Centro de Costo deducido automáticamente'}
                          >
                            {inlineEdit.id === tx.id && inlineEdit.field === 'cost_center' ? (
                              <select
                                autoFocus
                                value={inlineEdit.value}
                                onChange={(e) => handleSaveInlineTx(tx.id, 'cost_center', e.target.value)}
                                onBlur={() => setInlineEdit({ id: null, field: null, value: '' })}
                                className="px-1.5 py-0.5 rounded bg-slate-950 border border-cyan-400 text-white text-[10px] font-bold"
                              >
                                <option value="CLIENTE">CLIENTE / OBRA</option>
                                <option value="CONTRATISTA">CONTRATISTA</option>
                              </select>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                  tx.cost_center === 'CONTRATISTA'
                                    ? 'bg-amber-950 text-amber-300 border border-amber-800'
                                    : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                }`}
                              >
                                {tx.cost_center || 'CLIENTE'}
                              </span>
                            )}
                          </td>

                          {/* Observaciones (Doble Clic para editar) */}
                          <td
                            onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'notes', value: tx.notes || '' })}
                            className="py-2 px-3 text-slate-500 text-[11px] max-w-[200px] truncate cursor-pointer hover:text-slate-300"
                            title={tx.notes || 'Doble clic para escribir observaciones'}
                          >
                            {inlineEdit.id === tx.id && inlineEdit.field === 'notes' ? (
                              <input
                                type="text"
                                autoFocus
                                value={inlineEdit.value}
                                onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                onBlur={() => handleSaveInlineTx(tx.id, 'notes', inlineEdit.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveInlineTx(tx.id, 'notes', inlineEdit.value)
                                  if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                                }}
                                className="w-full px-1.5 py-0.5 rounded bg-slate-950 border border-cyan-400 text-white text-xs"
                              />
                            ) : (
                              <HighlightText text={tx.notes || '-'} query={searchQuery} />
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
                                  onClick={() => {
                                    const msg = `Astillero Alon Car - Pañol:\nHola ${c.name}, figuran en su poder ${c.total} cilindros de gas desde hace más de ${c.daysHeld} días. Por favor, acerque los envases vacíos a pañol para su recambio o devolución final.`
                                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
                                  }}
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
                    <th className="py-2.5 px-3 w-12 text-center">
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-slate-500 font-mono">#</span>
                        <input
                          type="checkbox"
                          checked={selectedMatIds.size > 0 && selectedMatIds.size === filteredMaterials.length}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedMatIds(new Set(filteredMaterials.map((m) => m.id)))
                            } else {
                              setSelectedMatIds(new Set())
                            }
                          }}
                          className="rounded border-slate-700 bg-slate-950 text-cyan-400 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                        />
                      </div>
                    </th>
                    <th className="py-2.5 px-3 w-12 text-center">Foto</th>
                    <th className="py-2.5 px-3">Material Técnico</th>
                    <th className="py-2.5 px-3">Categoría</th>
                    <th className="py-2.5 px-3">Rubro</th>
                    <th className="py-2.5 px-3 text-center">Control Stock?</th>
                    <th className="py-2.5 px-3 text-right">Stock Físico</th>
                    <th className="py-2.5 px-3 text-right">Mínimo</th>
                    <th className="py-2.5 px-3 text-center">Semáforo</th>
                    <th className="py-2.5 px-3">U. Medida</th>
                    <th className="py-2.5 px-3 text-right">Peso (kg)</th>
                    <th className="py-2.5 px-3 text-center">% Seguridad</th>
                    <th className="py-2.5 px-3 text-right">Costo Estimado</th>
                    <th className="py-2.5 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-sans">
                  {filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="py-12 text-center text-slate-500">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="font-semibold">No se encontraron materiales en el catálogo con estos filtros.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map((mat, idx) => {
                      const isSelected = selectedMatIds.has(mat.id)
                      const curr = Number(mat.current_stock) || 0
                      const min = Number(mat.minimum_stock) || 0
                      const isQuiebre = curr <= 0
                      const isBajo = curr > 0 && curr <= min
                      const secBadge = getSecurityFactorBadge(mat.security_factor)

                      return (
                        <tr
                          key={mat.id}
                          className={`hover:bg-slate-800/40 transition-colors ${
                            isSelected ? 'bg-cyan-950/20' : ''
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
                                  const next = new Set(selectedMatIds)
                                  if (e.target.checked) next.add(mat.id)
                                  else next.delete(mat.id)
                                  setSelectedMatIds(next)
                                }}
                                className="rounded border-slate-700 bg-slate-950 text-cyan-400 focus:ring-0 cursor-pointer w-3.5 h-3.5"
                              />
                            </div>
                          </td>

                          {/* Foto Técnica (DEC-010) */}
                          <td className="py-2 px-3 text-center">
                            {mat.image_url ? (
                              <button
                                onClick={() => setPreviewImage(mat.image_url)}
                                className="w-8 h-8 rounded-lg overflow-hidden border border-slate-700 hover:border-cyan-400 transition-all cursor-pointer inline-block"
                                title="Clic para ampliar foto técnica"
                              >
                                <img src={mat.image_url} alt="" className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <div className="w-8 h-8 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 mx-auto">
                                <Package className="w-4 h-4" />
                              </div>
                            )}
                          </td>

                          {/* Nombre (Doble Clic para editar) */}
                          <td
                            onDoubleClick={() => setInlineEdit({ id: mat.id, field: 'name', value: mat.name })}
                            className="py-2 px-3 font-bold text-white cursor-pointer hover:text-cyan-300"
                            title="Doble clic para editar nombre"
                          >
                            {inlineEdit.id === mat.id && inlineEdit.field === 'name' ? (
                              <input
                                type="text"
                                autoFocus
                                value={inlineEdit.value}
                                onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                onBlur={() => handleSaveInlineMaterial(mat.id, 'name', inlineEdit.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveInlineMaterial(mat.id, 'name', inlineEdit.value)
                                  if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                                }}
                                className="w-full px-1.5 py-0.5 rounded bg-slate-950 border border-cyan-400 text-white font-bold text-xs"
                              />
                            ) : (
                              <HighlightText text={mat.name} query={searchQuery} />
                            )}
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

                          {/* Casilla Control de Stock */}
                          <td className="py-2 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={Boolean(mat.requires_stock_control)}
                              onChange={(e) => handleSaveInlineMaterial(mat.id, 'requires_stock_control', e.target.checked)}
                              className="rounded border-slate-700 bg-slate-950 text-cyan-400 focus:ring-0 cursor-pointer w-4 h-4"
                              title="Marca si este material lleva inventario y auditoría física de stock"
                            />
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

                          {/* Stock Mínimo (Doble Clic para editar) */}
                          <td
                            onDoubleClick={() => setInlineEdit({ id: mat.id, field: 'minimum_stock', value: mat.minimum_stock || 0 })}
                            className="py-2 px-3 text-right font-mono text-slate-400 cursor-pointer hover:text-white"
                            title="Doble clic para editar stock mínimo"
                          >
                            {inlineEdit.id === mat.id && inlineEdit.field === 'minimum_stock' ? (
                              <input
                                type="number"
                                autoFocus
                                value={inlineEdit.value}
                                onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                onBlur={() => handleSaveInlineMaterial(mat.id, 'minimum_stock', inlineEdit.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveInlineMaterial(mat.id, 'minimum_stock', inlineEdit.value)
                                  if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                                }}
                                className="w-16 px-1.5 py-0.5 rounded bg-slate-950 border border-cyan-400 text-right text-white font-mono text-xs"
                              />
                            ) : (
                              min
                            )}
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

                          {/* Unidad de Medida */}
                          <td className="py-2 px-3 text-slate-300 font-mono text-[11px]">
                            {mat.unit_measure || 'Unidad'}
                          </td>

                          {/* Peso Unitario (Doble Clic para editar) */}
                          <td
                            onDoubleClick={() => setInlineEdit({ id: mat.id, field: 'weight_kg', value: mat.weight_kg || 0 })}
                            className="py-2 px-3 text-right font-mono text-slate-300 text-[11px] cursor-pointer hover:text-cyan-300"
                            title="Doble clic para editar peso unitario en kg"
                          >
                            {inlineEdit.id === mat.id && inlineEdit.field === 'weight_kg' ? (
                              <input
                                type="number"
                                step="any"
                                autoFocus
                                value={inlineEdit.value}
                                onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                onBlur={() => handleSaveInlineMaterial(mat.id, 'weight_kg', inlineEdit.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleSaveInlineMaterial(mat.id, 'weight_kg', inlineEdit.value)
                                  if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                                }}
                                className="w-16 px-1.5 py-0.5 rounded bg-slate-950 border border-cyan-400 text-right text-white font-mono text-xs"
                              />
                            ) : (
                              mat.weight_kg ? `${Number(mat.weight_kg).toFixed(2)} kg` : '-'
                            )}
                          </td>

                          {/* % Seguridad (Factor de Merma con color específico y bloqueo a Admin) */}
                          <td
                            onDoubleClick={() => {
                              if (!isAdmin) {
                                showFeedback('error', 'Solo el Administrador puede modificar el porcentaje de seguridad naval.')
                                return
                              }
                              setInlineEdit({ id: mat.id, field: 'security_factor', value: mat.security_factor || 1.06 })
                            }}
                            className="py-2 px-3 text-center cursor-pointer"
                            title={isAdmin ? 'Doble clic para cambiar factor de seguridad (Admin)' : 'Factor de seguridad naval (Solo Admin)'}
                          >
                            {inlineEdit.id === mat.id && inlineEdit.field === 'security_factor' ? (
                              <select
                                autoFocus
                                value={inlineEdit.value}
                                onChange={(e) => handleSaveInlineMaterial(mat.id, 'security_factor', e.target.value)}
                                onBlur={() => setInlineEdit({ id: null, field: null, value: '' })}
                                className="px-1.5 py-0.5 rounded bg-slate-950 border border-cyan-400 text-white text-[11px] font-mono font-bold"
                              >
                                <option value={1.02}>2% (1.02)</option>
                                <option value={1.06}>6% (1.06 Estándar)</option>
                                <option value={1.10}>10% (1.10)</option>
                                <option value={1.15}>15% (1.15)</option>
                                <option value={1.20}>20% (1.20)</option>
                              </select>
                            ) : (
                              <span className={`px-2 py-0.5 rounded-full text-[10px] border ${secBadge.style}`}>
                                {secBadge.label}
                              </span>
                            )}
                          </td>

                          {/* Costo */}
                          <td className="py-2 px-3 text-right font-mono text-slate-300 text-[11px]">
                            ${mat.cost_ars?.toLocaleString() || '0'}
                          </td>

                          {/* Acciones */}
                          <td className="py-2 px-3 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Botón Reponer (Garantiza precarga en Compras) */}
                              <button
                                onClick={() => handleRequestPurchaseSingle(mat)}
                                className="p-1 rounded bg-cyan-950 border border-cyan-800 text-cyan-400 hover:bg-cyan-900 transition-all cursor-pointer"
                                title="Pedir reposición en Compras (Precarga garantizada)"
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
                    <th className="py-2.5 px-3">Grupo / Contratista</th>
                    <th className="py-2.5 px-3">Oficio</th>
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
                        <td className="py-2 px-3 font-bold text-cyan-400">
                          {w.work_group || w.admin_center || 'ASTILLERO'}
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
                            onClick={() => setShowWithdrawalModal(true)}
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
              {activeTab === 'planillas'
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

        {/* Acciones masivas cuando hay filas seleccionadas en la Planilla */}
        {selectedTxIds.size > 0 && activeTab === 'planillas' && (
          <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-emerald-500/40 shadow-lg">
            <span className="text-emerald-400 font-bold">{selectedTxIds.size} seleccionados</span>
            <button
              onClick={() => {
                if (confirm(`¿Deseas desasentar o eliminar las ${selectedTxIds.size} salidas seleccionadas?`)) {
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
      {/* MODALES: REGISTRO MULTI-MATERIAL, ALTA MATERIAL, AJUSTE STOCK Y GASES          */}
      {/* ============================================================================== */}

      {/* MODAL 1: REGISTRAR RETIRO MULTI-MATERIAL (REDISEÑADO CON CASCADA REAL) */}
      {showWithdrawalModal && (
        <MultiWithdrawalModal
          materials={materials}
          ships={ships}
          workOrders={workOrders}
          workers={workers}
          isAdmin={isAdmin}
          onClose={() => setShowWithdrawalModal(false)}
          onSave={handleSaveMultiWithdrawal}
          onRequestPermission={() => setShowPermissionRequestModal(true)}
        />
      )}

      {/* MODAL 2: ALTA FORMAL DE MATERIAL */}
      {showNewMaterialModal && (
        <NewMaterialModal
          rubros={rubros}
          isAdmin={isAdmin}
          onClose={() => setShowNewMaterialModal(false)}
          onSave={async (formData) => {
            try {
              const { data, error } = await supabase.from('materials').insert([formData]).select().single()
              if (error) throw error
              setMaterials((prev) => [data, ...prev])
              showFeedback('success', `Material "${data.name}" agregado con éxito al Catálogo.`)
              setShowNewMaterialModal(false)
            } catch (err) {
              console.error(err)
              showFeedback('error', 'Error creando material: ' + err.message)
            }
          }}
        />
      )}

      {/* MODAL 3: AJUSTE DE STOCK FÍSICO */}
      {showStockAdjustModal.isOpen && (
        <StockAdjustModal
          material={showStockAdjustModal.material}
          onClose={() => setShowStockAdjustModal({ isOpen: false, material: null })}
          onSave={handleSaveInlineMaterial}
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
          onSave={async (gasData) => {
            try {
              const { data, error } = await supabase.from('gas_cylinder_movements').insert([gasData]).select().single()
              if (error) throw error
              setGasMovements((prev) => [data, ...prev])
              showFeedback('success', 'Movimiento de gas registrado correctamente.')
              setShowGasModal({ isOpen: false, operationType: 'PRIMERA_ENTREGA' })
            } catch (err) {
              console.error(err)
              showFeedback('error', 'Error en movimiento de cilindro: ' + err.message)
            }
          }}
        />
      )}

      {/* MODAL 5: SOLICITAR HABILITACIÓN DE OPERARIO A JORGE SENTIS */}
      {showPermissionRequestModal && (
        <WorkerPermissionRequestModal
          workers={workers.filter((w) => !w.can_withdraw_materials)}
          ships={ships}
          onClose={() => setShowPermissionRequestModal(false)}
          onSubmit={handleRequestWorkerPermission}
        />
      )}

      {/* MODAL 6: PREVISUALIZAR IMAGEN TÉCNICA */}
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
// SUBCOMPONENTE: MODAL DE RETIRO MULTI-MATERIAL (CASCADA CANÓNICA)
// ==============================================================================
function MultiWithdrawalModal({ materials, ships, workOrders, workers, isAdmin, onClose, onSave, onRequestPermission }) {
  const [shipId, setShipId] = useState('')
  const [contractorGroup, setContractorGroup] = useState('')
  const [workOrderId, setWorkOrderId] = useState('')
  const [isOtEmpty, setIsOtEmpty] = useState(false)
  const [workerId, setWorkerId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')

  // Renglones de materiales dinámicos
  const [items, setItems] = useState([
    {
      material_id: '',
      quantity: 1,
      customCostCenter: '',
      notes: ''
    }
  ])

  // 1. Grupos de Trabajo / Contratistas Únicos (desde workers.work_group)
  const availableGroups = useMemo(() => {
    const set = new Set()
    workers.forEach((w) => {
      if (w.work_group) {
        set.add(w.work_group.trim().toUpperCase())
      }
    })
    set.add('ASTILLERO')
    return Array.from(set).sort()
  }, [workers])

  // 2. OTs habilitadas para el Barco elegido
  const availableWos = useMemo(() => {
    if (!shipId) return workOrders
    return workOrders.filter((w) => w.ship_id === shipId)
  }, [workOrders, shipId])

  // 3. Operarios del Grupo elegido con Permiso [P] HABILITADO
  const eligibleWorkers = useMemo(() => {
    if (!contractorGroup) return []
    return workers.filter((w) => {
      const g = (w.work_group || w.admin_center || '').trim().toUpperCase()
      const matchGroup = g === contractorGroup || (contractorGroup === 'ASTILLERO' && w.admin_center === 'ASTILLERO')
      // Regla: Solo operarios con permiso can_withdraw_materials = true
      return matchGroup && w.can_withdraw_materials
    })
  }, [workers, contractorGroup])

  const selectedWorker = useMemo(() => workers.find((w) => w.id === workerId), [workers, workerId])

  // Añadir un renglón más
  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        material_id: '',
        quantity: 1,
        customCostCenter: '',
        notes: ''
      }
    ])
  }

  // Eliminar un renglón
  const handleRemoveItem = (index) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, idx) => idx !== index))
  }

  // Actualizar un campo de un renglón
  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!shipId) return alert('Debes seleccionar un Barco.')
    if (!contractorGroup) return alert('Debes seleccionar un Contratista / Grupo.')
    if (!isOtEmpty && !workOrderId) return alert('Debes seleccionar una OT o marcar la casilla de OT vacía.')
    if (!workerId) return alert('Debes seleccionar al operario que retira.')

    const validItems = items.filter((it) => it.material_id && Number(it.quantity) > 0)
    if (validItems.length === 0) {
      return alert('Debes cargar al menos un material válido con cantidad mayor a 0.')
    }

    onSave({
      shipId,
      workOrderId: isOtEmpty ? null : workOrderId,
      contractorGroup,
      worker: selectedWorker,
      notes,
      date,
      items: validItems
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden font-sans flex flex-col max-h-[92vh]">
        {/* Cabecera Modal */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2 text-white font-black text-sm">
            <Package className="w-5 h-5 text-emerald-400" />
            <span>REGISTRAR SALIDA MULTI-MATERIAL DE PAÑOL</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* ============================================================================== */}
          {/* SECCIÓN 1: CASCADA CANÓNICA (Barco -> Contratista -> OT)                       */}
          {/* ============================================================================== */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Anchor className="w-4 h-4 text-cyan-400" />
                <span>1. Destino e Imputación de Obra</span>
              </span>
              <span className="text-slate-500 text-[11px]">Cascada: Barco ➔ Contratista ➔ OT</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Paso 1: Barco */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  1° Barco / Buque <span className="text-rose-400">*</span>
                </label>
                <select
                  value={shipId}
                  onChange={(e) => {
                    setShipId(e.target.value)
                    setWorkOrderId('')
                  }}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold focus:outline-none focus:border-cyan-400"
                >
                  <option value="">Seleccionar Barco...</option>
                  {ships.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Paso 2: Contratista / Grupo de Trabajo */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  2° Contratista / Grupo <span className="text-rose-400">*</span>
                </label>
                <select
                  value={contractorGroup}
                  onChange={(e) => {
                    setContractorGroup(e.target.value)
                    setWorkerId('')
                  }}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-cyan-400 font-black focus:outline-none focus:border-cyan-400"
                >
                  <option value="">Seleccionar Contratista / Grupo...</option>
                  {availableGroups.map((grp) => (
                    <option key={grp} value={grp}>
                      {grp}
                    </option>
                  ))}
                </select>
              </div>

              {/* Paso 3: OT con Descripción Completa */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">
                    3° Orden de Trabajo (OT) <span className="text-rose-400">*</span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-amber-400">
                    <input
                      type="checkbox"
                      checked={isOtEmpty}
                      onChange={(e) => {
                        setIsOtEmpty(e.target.checked)
                        if (e.target.checked) setWorkOrderId('')
                      }}
                      className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0 cursor-pointer"
                    />
                    <span>OT en blanco (0028)</span>
                  </label>
                </div>

                <select
                  value={workOrderId}
                  disabled={isOtEmpty}
                  onChange={(e) => setWorkOrderId(e.target.value)}
                  required={!isOtEmpty}
                  className={`w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-400 ${
                    isOtEmpty ? 'opacity-40 cursor-not-allowed bg-slate-950' : 'font-semibold'
                  }`}
                >
                  <option value="">
                    {isOtEmpty ? '(Imputación a Buque sin OT)' : 'Seleccionar OT activa...'}
                  </option>
                  {availableWos.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      OT #{wo.ot_number} - {wo.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Operario Solicitante y Fecha */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div className="md:col-span-2">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold">
                    Operario que Retira en Pañol <span className="text-rose-400">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={onRequestPermission}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1 cursor-pointer"
                  >
                    <UserCheck className="w-3 h-3" />
                    <span>¿No aparece? Solicitar Habilitación a Jorge Sentis</span>
                  </button>
                </div>

                <select
                  value={workerId}
                  onChange={(e) => setWorkerId(e.target.value)}
                  required
                  disabled={!contractorGroup}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold focus:outline-none focus:border-cyan-400"
                >
                  <option value="">
                    {!contractorGroup
                      ? 'Selecciona primero el Contratista/Grupo...'
                      : eligibleWorkers.length === 0
                      ? `(No hay operarios con permiso [P] en ${contractorGroup})`
                      : `Seleccionar operario habilitado (${eligibleWorkers.length})...`}
                  </option>
                  {eligibleWorkers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.trade || 'Oficio'}) ✓ Habilitado [P]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Fecha del Retiro</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* ============================================================================== */}
          {/* SECCIÓN 2: RENGLONES DINÁMICOS DE MATERIALES (CARGA MÚLTIPLE)                  */}
          {/* ============================================================================== */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Package className="w-4 h-4 text-emerald-400" />
                <span>2. Insumos y Materiales Retirados ({items.length} renglones)</span>
              </span>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>+ Agregar Otro Material</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => {
                const mat = materials.find((m) => m.id === item.material_id)
                // Deducción de Centro de Costo
                let autoCostCenter = 'CLIENTE'
                if (mat?.category === 'CONSUMIBLES' || mat?.category === 'ELEM.SEGURIDAD') {
                  if (selectedWorker?.consumables === 'CONTRATISTA') autoCostCenter = 'CONTRATISTA'
                }
                const activeCostCenter = item.customCostCenter || autoCostCenter
                const itemWeight = (Number(mat?.weight_kg) || 0) * (Number(item.quantity) || 1)

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-lg border border-slate-800/90 bg-slate-900/60 grid grid-cols-1 md:grid-cols-12 gap-3 items-center"
                  >
                    <div className="md:col-span-1 text-center font-mono font-bold text-slate-500">
                      #{idx + 1}
                    </div>

                    {/* Buscador Inteligente de Material */}
                    <div className="md:col-span-5">
                      <MaterialSearchInput
                        materials={materials}
                        value={item.material_id}
                        onChange={(matId) => handleItemChange(idx, 'material_id', matId)}
                      />
                    </div>

                    {/* Cantidad y Unidad */}
                    <div className="md:col-span-2">
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          placeholder="Cant."
                          className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-white font-mono font-bold text-right text-xs focus:outline-none focus:border-cyan-400"
                        />
                        <span className="text-[11px] text-slate-400 font-mono shrink-0">
                          {mat?.unit_measure || 'un.'}
                        </span>
                      </div>
                      {itemWeight > 0 && (
                        <span className="block text-[10px] text-slate-500 font-mono text-right mt-0.5">
                          {itemWeight.toFixed(2)} kg
                        </span>
                      )}
                    </div>

                    {/* Centro de Costo (Auto-Deducido, Solo editable por Admin) */}
                    <div className="md:col-span-3">
                      {isAdmin ? (
                        <select
                          value={activeCostCenter}
                          onChange={(e) => handleItemChange(idx, 'customCostCenter', e.target.value)}
                          className="w-full px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-white font-bold text-[10px]"
                        >
                          <option value="CLIENTE">CLIENTE / OBRA</option>
                          <option value="CONTRATISTA">CONTRATISTA</option>
                        </select>
                      ) : (
                        <div
                          className={`px-2 py-1 rounded text-center font-black text-[10px] uppercase tracking-wider flex items-center justify-center gap-1 ${
                            activeCostCenter === 'CONTRATISTA'
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                          }`}
                        >
                          <Lock className="w-2.5 h-2.5 text-slate-500" />
                          <span>{activeCostCenter}</span>
                        </div>
                      )}
                    </div>

                    {/* Eliminar Renglón */}
                    <div className="md:col-span-1 text-center">
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        disabled={items.length <= 1}
                        className={`p-1 rounded text-slate-500 hover:text-rose-400 transition-all ${
                          items.length <= 1 ? 'opacity-20 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-800'
                        }`}
                        title="Eliminar este renglón"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Observaciones Generales */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Observaciones Generales de la Visita</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej. Entrega completa para etapa de popa / retiro por urgencia de agua..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Botones de Acción */}
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
              className="px-6 py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black flex items-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer text-xs"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>Confirmar Retiro ({items.length} Insumos)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// SUBCOMPONENTE: BUSCADOR INTELIGENTE DE MATERIAL CON AUTOCOMPLETADO
// ==============================================================================
function MaterialSearchInput({ materials, value, onChange }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const selectedMat = useMemo(() => materials.find((m) => m.id === value), [materials, value])

  // Filtrado reactivo mientras se escribe
  const matches = useMemo(() => {
    if (!query.trim()) return materials.slice(0, 30)
    const q = query.toLowerCase().trim()
    return materials
      .filter((m) => (m.name || '').toLowerCase().includes(q) || (m.rubro || '').toLowerCase().includes(q))
      .slice(0, 30)
  }, [materials, query])

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full font-sans">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-white cursor-pointer flex items-center justify-between hover:border-cyan-400"
      >
        <span className="truncate font-semibold text-xs">
          {selectedMat ? selectedMat.name : <span className="text-slate-500">Buscar material por nombre o rubro...</span>}
        </span>
        {selectedMat && (
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400 font-mono font-bold ml-1 shrink-0">
            Stock: {selectedMat.current_stock}
          </span>
        )}
      </div>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-64 flex flex-col">
          <div className="p-2 border-b border-slate-800 bg-slate-950">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escribe 'elec', 'chapa', 'disco'..."
              className="w-full px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="overflow-y-auto divide-y divide-slate-800/60 flex-1">
            {matches.length === 0 ? (
              <div className="p-3 text-center text-slate-500 text-xs">No se encontraron materiales coincidentes</div>
            ) : (
              matches.map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    onChange(m.id)
                    setIsOpen(false)
                  }}
                  className="p-2 hover:bg-slate-800/80 cursor-pointer flex items-center justify-between gap-2 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {m.image_url ? (
                      <img src={m.image_url} alt="" className="w-6 h-6 rounded object-cover shrink-0 border border-slate-700" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                        <Package className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div className="truncate">
                      <span className="font-bold text-white text-xs block truncate">{m.name}</span>
                      <span className="text-[10px] text-slate-400">{m.rubro || m.category}</span>
                    </div>
                  </div>

                  <span
                    className={`font-mono font-bold text-xs shrink-0 ${
                      m.current_stock <= 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {m.current_stock} {m.unit_measure || 'un.'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ==============================================================================
// SUBCOMPONENTE: MODAL PARA SOLICITAR HABILITACIÓN DE OPERARIO (ALERTA A JORGE SENTIS)
// ==============================================================================
function WorkerPermissionRequestModal({ workers, ships, onClose, onSubmit }) {
  const [workerId, setWorkerId] = useState('')
  const [shipId, setShipId] = useState('')
  const [reason, setReason] = useState('')

  const selectedWorker = useMemo(() => workers.find((w) => w.id === workerId), [workers, workerId])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!workerId) return alert('Debes seleccionar un operario.')
    onSubmit({
      workerId,
      workerName: selectedWorker?.name || '',
      workGroup: selectedWorker?.work_group || 'ASTILLERO',
      shipId: shipId || null,
      reason
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden font-sans">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/40">
          <div className="flex items-center gap-2 text-white font-black text-sm">
            <UserCheck className="w-4 h-4 text-cyan-400" />
            <span>SOLICITAR HABILITACIÓN A JORGE SENTIS</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          <p className="text-slate-400 leading-relaxed">
            Este formulario emite una alerta directa a la cuenta de <strong>Jorge Sentis (Administrador)</strong> para
            autorizar el permiso de retiro de materiales a un trabajador que actualmente figura inhabilitado en el
            padrón.
          </p>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Operario a Habilitar <span className="text-rose-400">*</span>
            </label>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              required
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold focus:outline-none focus:border-cyan-400"
            >
              <option value="">Seleccionar operario no habilitado...</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.work_group || w.trade || 'General'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Barco / Obra de Destino</label>
            <select
              value={shipId}
              onChange={(e) => setShipId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
            >
              <option value="">Astillero / General</option>
              {ships.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Motivo / Justificación</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Detalla por qué este operario debe retirar materiales hoy..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
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
              className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black flex items-center gap-1.5 shadow-md shadow-cyan-600/20 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Emitir Alerta a Jorge Sentis</span>
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
function NewMaterialModal({ rubros, isAdmin, onClose, onSave }) {
  const [name, setName] = useState('')
  const [category, setCategory] = useState('CONSUMIBLES')
  const [rubro, setRubro] = useState('')
  const [unitMeasure, setUnitMeasure] = useState('Unidad')
  const [weightKg, setWeightKg] = useState(0)
  const [requiresStockControl, setRequiresStockControl] = useState(true)
  const [securityFactor, setSecurityFactor] = useState(1.06)
  const [costArs, setCostArs] = useState(0)
  const [currentStock, setCurrentStock] = useState(0)
  const [minimumStock, setMinimumStock] = useState(5)
  const [imageUrl, setImageUrl] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)

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
      name: name.trim().toUpperCase(),
      category,
      rubro: rubro || 'VARIOS Y GENERAL',
      unit_measure: unitMeasure,
      weight_kg: Number(weightKg) || 0,
      requires_stock_control: requiresStockControl,
      security_factor: Number(securityFactor) || 1.06,
      cost_ars: Number(costArs) || 0,
      current_stock: Number(currentStock) || 0,
      minimum_stock: Number(minimumStock) || 0,
      image_url: imageUrl || null
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
              <label className="block text-slate-300 font-semibold mb-1">Peso Unitario (kg)</label>
              <input
                type="number"
                step="any"
                min="0"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
              />
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

          <div className="grid grid-cols-3 gap-3 items-center">
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
            <div>
              <label className="block text-slate-300 font-semibold mb-1">% Seguridad (Merma)</label>
              <select
                disabled={!isAdmin}
                value={securityFactor}
                onChange={(e) => setSecurityFactor(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-cyan-400 disabled:opacity-50"
              >
                <option value={1.02}>2% (1.02)</option>
                <option value={1.06}>6% (1.06 Estándar)</option>
                <option value={1.10}>10% (1.10)</option>
                <option value={1.15}>15% (1.15)</option>
                <option value={1.20}>20% (1.20)</option>
              </select>
            </div>
          </div>

          {/* Casilla de Control de Stock */}
          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Lleva Control de Stock Físico</span>
              <span className="text-slate-500 text-[11px]">Habilita recuento, semáforo de quiebre y auditorías en pañol</span>
            </div>
            <input
              type="checkbox"
              checked={requiresStockControl}
              onChange={(e) => setRequiresStockControl(e.target.checked)}
              className="rounded border-slate-700 bg-slate-900 text-cyan-400 focus:ring-0 cursor-pointer w-4 h-4"
            />
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

  if (!material) return null
  const currentStock = Number(material.current_stock) || 0
  const diff = countedQty - currentStock

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(material.id, 'current_stock', countedQty)
    onClose()
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
                <label className="block text-purple-400 font-semibold mb-1">Vacío Devuelto (Patio)</label>
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
                <label className="block text-emerald-400 font-semibold mb-1">Lleno Entregado (Obra)</label>
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

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Contratista / Taller <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                value={contractorName}
                onChange={(e) => setContractorName(e.target.value)}
                required
                placeholder="Ej. TECO TALLER, TANO"
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
