import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSpreadsheetGrid } from '../hooks/useSpreadsheetGrid'
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
  UserX,
  Navigation,
  Copy,
  Inbox,
  AlertCircle
} from 'lucide-react'

import {
  NOMINA_ASTILLERO_BASE,
  CONTRATISTAS_FRECUENTES,
  normalizeText,
  filterEligiblePersonnel,
  getShipEnabledContractors,
  getContractorEnabledWos,
  evaluateAllocationState
} from '../lib/allocationEngine'

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
  const [filterStockOnly, setFilterStockOnly] = useState(false)
  const [activeKpiFilter, setActiveKpiFilter] = useState(null) // 'critico' | 'hoy' | 'sin_ot' | 'vacios' | 'retencion' | 'bajas_pendientes'

  // Selección de filas para acciones en bloque
  const [selectedTxIds, setSelectedTxIds] = useState(new Set())
  const [selectedMatIds, setSelectedMatIds] = useState(new Set())

  // Edición in-situ con doble clic
  const [inlineEdit, setInlineEdit] = useState({ id: null, field: null, value: '' })

  // Modales
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false)
  const [editingWithdrawalRow, setEditingWithdrawalRow] = useState(null)
  const [showNewMaterialModal, setShowNewMaterialModal] = useState(false)
  const [showStockAdjustModal, setShowStockAdjustModal] = useState({ isOpen: false, material: null })
  const [showGasModal, setShowGasModal] = useState({ isOpen: false, operationType: 'PRIMERA_ENTREGA' })
  const [quickPurchaseModal, setQuickPurchaseModal] = useState({ isOpen: false, material: null, quantity: '', urgency: 'SIN_APURO' })
  const [adminDeleteConfirmModal, setAdminDeleteConfirmModal] = useState({ isOpen: false, tx: null })
  const [requestOtModal, setRequestOtModal] = useState({ isOpen: false, txId: null, shipId: '', targetWorkerOrContractor: '', reason: '' })
  const [workerPermissionModal, setWorkerPermissionModal] = useState({ isOpen: false, workerId: '', reason: '' })
  const [pendingAlerts, setPendingAlerts] = useState([])
  const [previewImage, setPreviewImage] = useState(null)
  const [workItems, setWorkItems] = useState([])

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
        workersRes,
        workItemsRes,
        alertsRes
      ] = await Promise.all([
        supabase.from('materials').select('*').order('name'),
        supabase
          .from('inventory_transactions')
          .select('*')
          .order('transaction_date', { ascending: false })
          .limit(800),
        supabase
          .from('gas_cylinder_movements')
          .select('*')
          .order('movement_date', { ascending: false })
          .limit(800),
        supabase.from('material_rubros').select('*').order('name'),
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('ships').select('*').order('name'),
        supabase.from('work_orders').select('*').order('created_at', { ascending: false }),
        supabase.from('workers').select('*').order('name'),
        supabase.from('work_items').select('id, work_order_id, contractors, description, status, foreman_name').order('created_at', { ascending: true }),
        supabase.from('compliance_alerts').select('*').eq('status', 'PENDIENTE')
      ])

      if (matRes.data) setMaterials(matRes.data)
      if (invRes.data) setInventoryTx(invRes.data)
      if (gasRes.data) setGasMovements(gasRes.data)
      if (rubrosRes.data) setRubros(rubrosRes.data)
      if (supRes.data) setSuppliers(supRes.data)
      if (shipsRes.data) setShips(shipsRes.data)
      if (woRes.data) setWorkOrders(woRes.data)
      if (workersRes.data) setWorkers(workersRes.data)
      if (workItemsRes.data) setWorkItems(workItemsRes.data)
      if (alertsRes.data) setPendingAlerts(alertsRes.data)
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
      const supDelivered = m.supplier_delivered_id
      const supReturned = m.supplier_returned_id
      const q = Number(m.quantity) || 1

      if (m.operation_type === 'PRIMERA_ENTREGA') {
        if (patioStock[supDelivered]) patioStock[supDelivered].full -= q
      } else if (m.operation_type === 'RECAMBIO_1X1') {
        if (patioStock[supDelivered]) patioStock[supDelivered].full -= q
        if (patioStock[supReturned]) patioStock[supReturned].empty += q
      } else if (m.operation_type === 'DEVOLUCION_FINAL') {
        if (patioStock[supReturned]) patioStock[supReturned].empty += q
      } else if (m.operation_type === 'AJUSTE_PATIO') {
        if (patioStock[supDelivered]) patioStock[supDelivered].full += q
      }
    })

    // Calcular matriz de deuda por contratista
    const contractorDebts = {}
    gasMovements.forEach((m) => {
      const c = m.contractor_name || 'ALON CAR'
      if (!contractorDebts[c]) {
        contractorDebts[c] = { totalHeld: 0, movements: [] }
      }
      const q = Number(m.quantity) || 1
      if (m.operation_type === 'PRIMERA_ENTREGA') {
        contractorDebts[c].totalHeld += q
        contractorDebts[c].movements.push(m)
      } else if (m.operation_type === 'DEVOLUCION_FINAL') {
        contractorDebts[c].totalHeld -= q
      }
    })

    // Alertas de retención mayor a 15 días (Regla P-01)
    const now = new Date()
    const longHeldContractors = []

    Object.entries(contractorDebts).forEach(([cName, data]) => {
      if (data.totalHeld > 0) {
        data.movements.forEach((mov) => {
          const movDate = new Date(mov.movement_date || mov.created_at)
          const diffDays = Math.floor((now - movDate) / (1000 * 60 * 60 * 24))
          if (diffDays > 15) {
            longHeldContractors.push({
              contractor: cName,
              days: diffDays,
              movement: mov
            })
          }
        })
      }
    })

    let totalEmptyInPatio = 0
    Object.values(patioStock).forEach((p) => {
      if (p.empty > 0) totalEmptyInPatio += p.empty
    })

    return {
      patioStock,
      contractorDebts,
      longHeldContractors,
      totalEmptyInPatio
    }
  }, [suppliers, gasMovements])

  // Padrón oficial filtrado según permiso de Pañol (can_withdraw_materials) y exclusión de inactivos
  const eligiblePersonnel = useMemo(() => {
    return filterEligiblePersonnel(workers, { permissionField: 'can_withdraw_materials' })
  }, [workers])

  const astilleroWorkers = eligiblePersonnel.astilleroWorkers
  const contractorGroups = eligiblePersonnel.contractorGroups
  const unauthorizedWorkers = eligiblePersonnel.unauthorizedWorkers

  // Alias retrocompatible
  const availableGroups = eligiblePersonnel.allEligibleNames

  // Helper canónico para obtener operarios de Astillero y Contratistas habilitados para Barco y OT
  const getEnabledWorkersAndContractors = useCallback(
    (shipId, workOrderId) => {
      if (!workOrderId) {
        return getShipEnabledContractors(shipId, workOrders, workItems, eligiblePersonnel)
      }

      // Con OT especificada:
      const items = workItems.filter((wi) => wi.work_order_id === workOrderId && wi.status !== 'Desestimado')
      if (items.length === 0) {
        return { astilleroWorkers, contractorGroups }
      }

      const rawContractors = items.flatMap((wi) =>
        Array.isArray(wi.contractors)
          ? wi.contractors
          : wi.contractor_name
          ? [wi.contractor_name]
          : []
      )

      // Regla idéntica a Horas: Si la OT tiene ASTILLERO o ASTILLERO.*, habilita a TODO el personal propio elegible
      const hasAstillero = rawContractors.some((c) => {
        const norm = normalizeText(c)
        return norm === 'ASTILLERO' || norm.startsWith('ASTILLERO.') || norm === 'ALON CAR'
      })

      const enabledAst = hasAstillero || rawContractors.length === 0 ? astilleroWorkers : []

      const enabledContractorSet = new Set(
        rawContractors
          .filter((c) => {
            const norm = normalizeText(c)
            return norm && !norm.startsWith('ASTILLERO') && norm !== 'ALON CAR'
          })
          .map((c) => c.trim().toUpperCase())
      )

      const enabledCnt = contractorGroups.filter((grp) => enabledContractorSet.has(grp.toUpperCase()))

      return {
        astilleroWorkers: enabledAst,
        contractorGroups: enabledCnt
      }
    },
    [eligiblePersonnel, astilleroWorkers, contractorGroups, workOrders, workItems]
  )

  // Filtrar OTs habilitadas para un Barco y un Operario/Contratista usando el motor canónico
  const getEnabledWosForShipAndContractor = useCallback(
    (shipId, workerOrContractor) => {
      return getContractorEnabledWos(shipId, workerOrContractor, workOrders, workItems, eligiblePersonnel)
    },
    [workOrders, workItems, eligiblePersonnel]
  )

  // Formatear Tooltip enriquecido de OT (Imagen 1)
  const formatWorkOrderTooltip = useCallback(
    (wo, ship) => {
      if (!wo) return '(⚠️ Sin OT)'
      const otItems = workItems.filter((wi) => wi.work_order_id === wo.id)
      const fullDesc =
        otItems
          .map((i) => i.description)
          .filter(Boolean)
          .join(' | ') ||
        wo.description ||
        wo.title ||
        'Sin descripción técnica adicional'
      const foremen =
        Array.from(new Set(otItems.map((i) => i.foreman_name).filter(Boolean))).join(', ') || 'Sin asignar'
      const shipName = ship?.name || 'Astillero'

      return `OT #${wo.order_number || wo.ot_number || wo.id?.slice(0, 4)}: ${wo.title || ''}\nDescripción Técnica: ${fullDesc}\nJefe de obra: ${foremen}\nBuque: ${shipName} | Estado: ${wo.status || 'En ejecución'}`
    },
    [workItems]
  )

  // ==============================================================================
  // RADAR DE KPIS: CÁLCULO DE MÉTRICAS OPERATIVAS
  // ==============================================================================
  const kpiStats = useMemo(() => {
    const todayStr = new Date().toISOString().split('T')[0]
    let criticalCount = 0
    materials.forEach((m) => {
      const c = Number(m.current_stock) || 0
      const min = Number(m.minimum_stock) || 0
      if (c <= min) criticalCount++
    })

    let todayTxCount = 0
    let sinOtCount = 0
    let deletionRequestsCount = 0

    inventoryTx.forEach((t) => {
      const d = String(t.transaction_date).split('T')[0]
      if (d === todayStr) todayTxCount++
      if (!t.work_order_id) sinOtCount++
      if (t.is_deletion_requested) deletionRequestsCount++
    })

    return {
      criticalCount,
      todayTxCount,
      sinOtCount,
      deletionRequestsCount,
      emptyCylinders: gasStats.totalEmptyInPatio,
      longHeldGases: gasStats.longHeldContractors.length
    }
  }, [materials, inventoryTx, gasStats])

  // Comprobar si una fecha cae en el periodo del filtro
  const isDateInFilterPeriod = (dateStr) => {
    if (filterPeriod === 'TODOS') return true
    if (!dateStr) return false
    const d = new Date(dateStr)
    const now = new Date()
    if (filterPeriod === 'HOY') {
      return (
        d.getDate() === now.getDate() &&
        d.getMonth() === now.getMonth() &&
        d.getFullYear() === now.getFullYear()
      )
    }
    if (filterPeriod === 'QUINCENA') {
      if (d.getMonth() !== now.getMonth() || d.getFullYear() !== now.getFullYear()) return false
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
      if (activeKpiFilter === 'bajas_pendientes' && !t.is_deletion_requested) return false

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
        const contractor = t.contractor_name || ''
        const costCenter = t.cost_center || ''
        const notes = t.notes || ''

        const match =
          ship.toLowerCase().includes(q) ||
          wo.toLowerCase().includes(q) ||
          matName.toLowerCase().includes(q) ||
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
  // DEFINICIÓN DE COLUMNAS PARA EL MOTOR HOJA DE CÁLCULO (useSpreadsheetGrid)
  // ==============================================================================
  const spreadsheetColumns = useMemo(
    () => [
      { key: 'transaction_date', label: 'Fecha', readOnly: false },
      { key: 'ship_id', label: 'Barco / Destino', readOnly: false },
      { key: 'work_order_id', label: 'Orden de Trabajo (OT)', readOnly: false },
      { key: 'material_id', label: 'Material Insumo', readOnly: false },
      { key: 'quantity_withdrawn', label: 'Cant.', isNumeric: true, readOnly: false },
      { key: 'weight_total', label: 'Peso (kg)', isNumeric: true, readOnly: false },
      { key: 'contractor_name', label: 'Operario / Contratista', readOnly: false },
      { key: 'cost_center', label: 'Centro de Costo', readOnly: false },
      { key: 'notes', label: 'Observaciones', readOnly: false }
    ],
    []
  )

  // ==============================================================================
  // ACCIONES OPERATIVAS Y GUARDADO IN-SITU
  // ==============================================================================

  // Referencia para evitar circularidad en pegado de filas
  const onPasteRowRef = useRef(null)

  // Guardar celda en Supabase (Planilla de Retiros)
  const handleSaveInlineTx = async (txId, field, value) => {
    try {
      let finalValue = value
      const updates = { [field]: finalValue }
      const tx = inventoryTx.find((t) => t.id === txId)
      const prevVal = tx ? tx[field] : ''

      // Registrar acción en la pila de deshacer (Ctrl+Z)
      if (grid?.pushUndoAction && prevVal !== value) {
        grid.pushUndoAction({
          colKey: field,
          colLabel: field,
          actionLabel: 'Edición en celda',
          previousValues: { [txId]: prevVal },
          newValue: value,
          timestamp: Date.now()
        })
      }

      // Si se cambia la cantidad o el material, actualizar peso total
      if (field === 'quantity_withdrawn' || field === 'material_id') {
        const targetMatId = field === 'material_id' ? value : tx?.material_id
        const targetQty = field === 'quantity_withdrawn' ? Number(value) : Number(tx?.quantity_withdrawn) || 1
        const mat = materials.find((m) => m.id === targetMatId)
        if (mat) {
          updates.weight_total = (Number(mat.weight_kg) || 0) * targetQty
        }
      }

      // Regla canónica de cascada: Si se cambia el Barco, borrar la OT y validar Contratista/Operario
      if (field === 'ship_id') {
        updates.work_order_id = null
        const currentWorkerOrContractor = tx?.worker_name || tx?.contractor_name
        if (currentWorkerOrContractor && value) {
          const enabled = getEnabledWorkersAndContractors(value, null)
          const isValid =
            enabled.astilleroWorkers.some((w) => normalizeText(w.name) === normalizeText(currentWorkerOrContractor)) ||
            enabled.contractorGroups.some((g) => normalizeText(g) === normalizeText(currentWorkerOrContractor))
          if (!isValid) {
            updates.contractor_name = ''
            updates.worker_name = ''
            updates.worker_id = null
            showFeedback('info', 'OT reseteada y operario desasignado por no estar habilitado en el nuevo barco.')
          }
        }
      }

      // Regla canónica de cascada: Si se cambia la OT, validar Contratista/Operario
      if (field === 'work_order_id') {
        updates.work_order_id = value || null
        const currentWorkerOrContractor = tx?.worker_name || tx?.contractor_name
        const effShipId = tx?.ship_id
        if (currentWorkerOrContractor && value) {
          const enabled = getEnabledWorkersAndContractors(effShipId, value)
          const isValid =
            enabled.astilleroWorkers.some((w) => normalizeText(w.name) === normalizeText(currentWorkerOrContractor)) ||
            enabled.contractorGroups.some((g) => normalizeText(g) === normalizeText(currentWorkerOrContractor))
          if (!isValid) {
            updates.contractor_name = ''
            updates.worker_name = ''
            updates.worker_id = null
            showFeedback('info', 'Operario/contratista desasignado por no estar asignado a la OT seleccionada.')
          }
        }
        // Excepción / Bypass (⚠️ Sin OT): avisar a Administrador
        if (!value && effShipId && currentWorkerOrContractor) {
          const targetShip = ships.find((s) => s.id === effShipId)
          const shipName = targetShip?.name || 'Astillero General'
          const userIdentifier = profile?.full_name || profile?.email || user?.email || 'Pañolero'
          supabase.from('compliance_alerts').insert([{
            ship_id: effShipId,
            entity_type: 'inventory_transactions',
            entity_id: txId,
            responsible_role: 'admin',
            status: 'PENDIENTE',
            escalated_to_admin: true,
            alert_message: `⚠️ Fila cambiada a (⚠️ Sin OT) en buque ${shipName} para ${currentWorkerOrContractor}.`,
            notes: `[RETIRO_SIN_OT] Modificado desde grilla por ${userIdentifier}`
          }]).then(({ error }) => {
            if (error) console.warn('Aviso sin OT:', error)
          })
        }
      }

      // Asignación de Contratista / Operario
      if (field === 'contractor_name') {
        const foundAst = astilleroWorkers.find((w) => normalizeText(w.name) === normalizeText(value))
        if (foundAst) {
          updates.contractor_name = foundAst.name
          updates.worker_name = foundAst.name
          updates.worker_id = foundAst.id && foundAst.id !== foundAst.name ? foundAst.id : null
        } else {
          updates.contractor_name = (value || '').toUpperCase()
          updates.worker_name = (value || '').toUpperCase()
          const matchedWorker = workers.find(
            (w) => w.work_group && normalizeText(w.work_group) === normalizeText(value)
          )
          updates.worker_id = matchedWorker?.id || null
        }

        // Si la fila ya tenía una OT que no está habilitada para el nuevo contratista, borrar la OT
        if (tx?.work_order_id && tx?.ship_id && value) {
          const enabledWos = getEnabledWosForShipAndContractor(tx.ship_id, value)
          const isWoValid = enabledWos.some((w) => w.id === tx.work_order_id)
          if (!isWoValid) {
            updates.work_order_id = null
            showFeedback('info', 'OT reseteada a (⚠️ Sin OT) porque no coincide con el nuevo contratista.')
          }
        }
      }

      if (field === 'cost_center' && !isAdmin) {
        showFeedback('error', 'Solo el Administrador tiene autorización para cambiar el Centro de Costo.')
        setInlineEdit({ id: null, field: null, value: '' })
        return
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

  // Pegar fila completa con soporte de portapapeles de grilla
  const handlePasteRow = useCallback(
    async ({ sourceRow, targetRow, targetRowIndex }) => {
      if (!sourceRow || !targetRow) return
      try {
        const fieldsToCopy = {
          ship_id: sourceRow.ship_id || null,
          work_order_id: sourceRow.work_order_id || null,
          material_id: sourceRow.material_id || null,
          quantity_withdrawn: sourceRow.quantity_withdrawn ?? null,
          weight_total: sourceRow.weight_total ?? null,
          contractor_name: sourceRow.contractor_name || '',
          worker_name: sourceRow.worker_name || '',
          worker_id: sourceRow.worker_id || null,
          cost_center: sourceRow.cost_center || 'CLIENTE',
          notes: sourceRow.notes || ''
        }

        const { error } = await supabase
          .from('inventory_transactions')
          .update(fieldsToCopy)
          .eq('id', targetRow.id)
        if (error) throw error

        setInventoryTx((prev) =>
          prev.map((t) => (t.id === targetRow.id ? { ...t, ...fieldsToCopy } : t))
        )
        showFeedback('success', `Fila pegada exitosamente en fila #${targetRowIndex + 1}.`)
      } catch (err) {
        console.error('Error al pegar fila:', err)
        showFeedback('error', 'Error al pegar fila: ' + err.message)
      }
    },
    []
  )

  useEffect(() => {
    onPasteRowRef.current = handlePasteRow
  }, [handlePasteRow])

  // Instanciación del Hook de Hoja de Cálculo
  const grid = useSpreadsheetGrid({
    rows: filteredTransactions,
    columns: spreadsheetColumns,
    getRowId: (r) => r.id,
    storageKey: 'aloncar_panol_grid',
    showFeedback: (type, text) => showFeedback(type, text),
    onPasteRow: (args) => onPasteRowRef.current?.(args),
    onCellActivate: (row, colDef) => {
      if (!row || !colDef || colDef.readOnly) return
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
          // Deshacer / Rehacer (Ctrl+Z / Ctrl+Y)
          for (const [id, val] of Object.entries(revertMap)) {
            await handleSaveInlineTx(id, colKey, val)
          }
        } else if (targetIds && targetIds.length > 0) {
          // Pegado en bloque o Rellenar hacia abajo (Ctrl+V / Ctrl+D)
          for (const id of targetIds) {
            await handleSaveInlineTx(id, colKey, newValue)
          }
        }
      } catch (err) {
        console.error('Error en batch update de Pañol:', err)
        showFeedback('error', 'Error al actualizar lote: ' + err.message)
      }
    }
  })

  // Helper de propiedades y eventos para celdas spreadsheet con foco garantizado
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

  // Atajos de teclado globales para la grilla (Ctrl+C, Ctrl+V, Ctrl+Z, Ctrl+Y, Ctrl+D)
  useEffect(() => {
    const handleGlobalShortcuts = (e) => {
      // Si el foco está dentro de un input, select o textarea, no interceptar
      const isInput = ['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)
      if (isInput) return

      // Si hay un modal abierto, no interceptar
      if (
        showWithdrawalModal ||
        showNewMaterialModal ||
        showStockAdjustModal.isOpen ||
        showGasModal.isOpen ||
        quickPurchaseModal.isOpen ||
        requestOtModal.isOpen ||
        adminDeleteConfirmModal.isOpen
      ) {
        return
      }

      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'z', 'y', 'd', 'f'].includes(e.key.toLowerCase())) {
        grid.handleKeyDown(e)
      }
    }

    window.addEventListener('keydown', handleGlobalShortcuts)
    return () => window.removeEventListener('keydown', handleGlobalShortcuts)
  }, [
    grid,
    showWithdrawalModal,
    showNewMaterialModal,
    showStockAdjustModal.isOpen,
    showGasModal.isOpen,
    quickPurchaseModal.isOpen,
    requestOtModal.isOpen,
    adminDeleteConfirmModal.isOpen
  ])

  // Insertar nueva fila 100% en blanco al final de la planilla (solo fecha de hoy)
  const handleInsertRow = async () => {
    try {
      const todayStr = new Date().toISOString().split('T')[0]
      const newTx = {
        material_id: null,
        quantity_withdrawn: null,
        ship_id: null,
        work_order_id: null,
        contractor_name: '',
        cost_center: 'CLIENTE',
        weight_total: null,
        notes: '',
        transaction_date: todayStr
      }

      const { data, error } = await supabase
        .from('inventory_transactions')
        .insert([newTx])
        .select()
        .single()

      if (error) throw error

      setInventoryTx((prev) => [...prev, data])

      showFeedback('success', 'Fila 100% en blanco insertada al pie de la planilla (solo fecha de hoy).')
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al insertar fila: ' + err.message)
    }
  }

  // Duplicar transacción en 1 clic
  const handleDuplicateTx = async (tx) => {
    try {
      const cloned = {
        material_id: tx.material_id,
        quantity_withdrawn: tx.quantity_withdrawn,
        ship_id: tx.ship_id,
        work_order_id: tx.work_order_id,
        contractor_name: tx.contractor_name,
        cost_center: tx.cost_center,
        weight_total: tx.weight_total,
        movement_type: tx.movement_type,
        notes: `Copia de retiro - ${tx.notes || ''}`.trim(),
        transaction_date: new Date().toISOString()
      }

      const { data, error } = await supabase.from('inventory_transactions').insert([cloned]).select().single()
      if (error) throw error

      setInventoryTx((prev) => [data, ...prev])
      showFeedback('success', 'Retiro duplicado exitosamente con fecha de hoy.')
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al duplicar retiro: ' + err.message)
    }
  }

  // ACCIÓN 1: Solicitar baja de fila (pinta de rojo y alerta a Jorge Sentis)
  const handleRequestDeletionTx = async (tx) => {
    try {
      const userIdentifier = profile?.full_name || profile?.email || user?.email || 'Operario Pañol'
      const { error } = await supabase
        .from('inventory_transactions')
        .update({
          is_deletion_requested: true,
          deletion_requested_at: new Date().toISOString(),
          deletion_requested_by: userIdentifier
        })
        .eq('id', tx.id)

      if (error) throw error

      setInventoryTx((prev) =>
        prev.map((t) => (t.id === tx.id ? { ...t, is_deletion_requested: true, deletion_requested_by: userIdentifier } : t))
      )

      showFeedback(
        'error',
        'Fila marcada en rojo. Solicitud de baja enviada a Jorge Sentis. Solo el Administrador puede borrar datos de Pañol.'
      )
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al solicitar baja: ' + err.message)
    }
  }

  // Confirmar eliminación física permanente (solo Admin)
  const handlePermanentDeleteTx = async (tx) => {
    try {
      // Devolver stock al material
      const mat = materials.find((m) => m.id === tx.material_id)
      if (mat) {
        const restoredStock = (Number(mat.current_stock) || 0) + (Number(tx.quantity_withdrawn) || 0)
        await supabase.from('materials').update({ current_stock: restoredStock }).eq('id', mat.id)
        setMaterials((prev) => prev.map((m) => (m.id === mat.id ? { ...m, current_stock: restoredStock } : m)))
      }

      const { error } = await supabase.from('inventory_transactions').delete().eq('id', tx.id)
      if (error) throw error

      setInventoryTx((prev) => prev.filter((t) => t.id !== tx.id))
      setAdminDeleteConfirmModal({ isOpen: false, tx: null })
      showFeedback('success', 'Fila eliminada permanentemente y stock reintegrado.')
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al eliminar fila: ' + err.message)
    }
  }

  // Desestimar solicitud de baja / Restaurar fila normal (solo Admin)
  const handleRestoreTx = async (tx) => {
    try {
      const { error } = await supabase
        .from('inventory_transactions')
        .update({ is_deletion_requested: false, deletion_requested_at: null, deletion_requested_by: null })
        .eq('id', tx.id)

      if (error) throw error

      setInventoryTx((prev) =>
        prev.map((t) => (t.id === tx.id ? { ...t, is_deletion_requested: false, deletion_requested_by: null } : t))
      )
      showFeedback('success', 'Fila restaurada al estado operativo normal.')
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al restaurar fila: ' + err.message)
    }
  }

  // ACCIÓN 3: Solicitar apertura de OT a Jorge Sentis (Administrador)
  const handleSubmitRequestOt = async () => {
    if (!requestOtModal.targetWorkerOrContractor) {
      showFeedback('error', 'Por favor seleccione el operario o contratista que requiere la OT.')
      return
    }
    const targetShip = ships.find((s) => s.id === requestOtModal.shipId)
    const shipName = targetShip?.name || 'Astillero General'
    const userIdentifier = profile?.full_name || profile?.email || user?.email || 'Pañolero'

    try {
      const alertPayload = {
        ship_id: requestOtModal.shipId || null,
        entity_type: 'work_orders',
        entity_id: requestOtModal.shipId || '00000000-0000-0000-0000-000000000000',
        responsible_role: 'admin',
        status: 'PENDIENTE',
        escalated_to_admin: true,
        alert_message: `Solicitud de Apertura de OT en buque ${shipName} para ${requestOtModal.targetWorkerOrContractor}. Motivo: ${requestOtModal.reason || 'Sin detalles adicionales'}`.trim(),
        notes: `[SOLICITUD_OT] [CONTRATISTA: ${requestOtModal.targetWorkerOrContractor}] Solicitado desde Pañol Central por ${userIdentifier}`
      }
      const { error: alertErr } = await supabase.from('compliance_alerts').insert([alertPayload])
      if (alertErr) console.warn('Aviso compliance_alerts:', alertErr)

      // Actualizar alertas reactivamente en el estado para que la UI muestre Solicitud enviada (1)
      const { data: updatedAlerts } = await supabase.from('compliance_alerts').select('*').eq('status', 'PENDIENTE')
      if (updatedAlerts) setPendingAlerts(updatedAlerts)

      // Si se invocó desde una fila existente de la grilla:
      if (requestOtModal.txId) {
        const foundAst = astilleroWorkers.find((w) => w.name.toUpperCase() === requestOtModal.targetWorkerOrContractor.toUpperCase())
        const rowUpdates = {
          ship_id: requestOtModal.shipId || null,
          work_order_id: null,
          contractor_name: requestOtModal.targetWorkerOrContractor,
          worker_name: requestOtModal.targetWorkerOrContractor,
          worker_id: foundAst?.id && foundAst.id !== foundAst.name ? foundAst.id : null,
          notes: `[Apertura OT solicitada a Jorge Sentis: ${requestOtModal.reason || 'Sin detalle'}]`
        }
        await supabase.from('inventory_transactions').update(rowUpdates).eq('id', requestOtModal.txId)
        setInventoryTx((prev) =>
          prev.map((t) => (t.id === requestOtModal.txId ? { ...t, ...rowUpdates } : t))
        )
      }

      setRequestOtModal({ isOpen: false, txId: null, shipId: '', targetWorkerOrContractor: '', reason: '' })
      showFeedback(
        'success',
        `🔔 Alerta enviada a Jorge Sentis para apertura de OT de ${requestOtModal.targetWorkerOrContractor} en ${shipName}. Entrega provisoria habilitada bajo (⚠️ Sin OT).`
      )
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al enviar alerta a Administrador: ' + err.message)
    }
  }

  // ACCIÓN 4: Solicitar habilitación de operario en Pañol (Permiso P) a Jorge Sentis
  const handleSubmitWorkerPermission = async () => {
    if (!workerPermissionModal.workerId) {
      showFeedback('error', 'Por favor seleccione el operario a habilitar.')
      return
    }
    const targetWorker = workers.find((w) => w.id === workerPermissionModal.workerId)
    const workerName = targetWorker?.name || 'Operario'
    const userIdentifier = profile?.full_name || profile?.email || user?.email || 'Pañolero'

    try {
      const alertPayload = {
        ship_id: null,
        entity_type: 'workers',
        entity_id: targetWorker.id,
        responsible_role: 'admin',
        status: 'PENDIENTE',
        escalated_to_admin: true,
        alert_message: `Solicitud de Habilitación para retiro de Pañol: ${workerName}. Motivo: ${workerPermissionModal.reason || 'Sin detalles'}`.trim(),
        notes: `[HABILITACION_OPERARIO] Solicitado desde Pañol Central por ${userIdentifier}`
      }
      const { error: alertErr } = await supabase.from('compliance_alerts').insert([alertPayload])
      if (alertErr) throw alertErr

      setWorkerPermissionModal({ isOpen: false, workerId: '', reason: '' })
      showFeedback(
        'success',
        `🔔 Solicitud enviada a Jorge Sentis para habilitar a ${workerName} en Pañol (Permiso P).`
      )
      const { data: updatedAlerts } = await supabase.from('compliance_alerts').select('*').eq('status', 'PENDIENTE')
      if (updatedAlerts) setPendingAlerts(updatedAlerts)
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al solicitar habilitación: ' + err.message)
    }
  }

  // ACCIÓN 2: Pedido directo a Compras (Estado: PEDIR, Astillero, Stock, Pañol, Fecha Hoy)
  const handleCreateDirectPurchaseOrder = async ({ material, quantity, urgency = 'SIN_APURO' }) => {
    try {
      if (!material) throw new Error('Material no especificado')

      const today = new Date()
      const yyyy = today.getFullYear()
      const mm = String(today.getMonth() + 1).padStart(2, '0')
      const dd = today.getDate()
      const q = dd <= 15 ? 'Q1' : 'Q2'
      const fortnight = `${yyyy}-${mm}-${q}`
      const todayStr = today.toISOString().split('T')[0]

      // Buscar barco astillero
      const astilleroShip = ships.find((s) => (s.name || '').toUpperCase().includes('ASTILLERO')) || ships[0]

      const newOrder = {
        material_id: material.id || null,
        material_name_raw: material.name || 'Insumo',
        quantity: quantity ? Number(quantity) : 1,
        unit_measure: material.unit_measure || 'unidad',
        charge_type: 'VIA_PANOL',
        ship_id: astilleroShip?.id || null,
        work_order_id: null,
        supplier_id: null,
        requested_by_name: 'PAÑOL',
        order_date: todayStr,
        fortnight_period: fortnight,
        status: 'PEDIR',
        urgency: urgency || 'SIN_APURO',
        notes: 'Solicitud directa generada desde Planilla de Pañol',
        is_new_material: false,
        no_catalog_required: false
      }

      const { data, error } = await supabase.from('purchase_orders').insert([newOrder]).select().single()
      if (error) throw error

      setQuickPurchaseModal({ isOpen: false, material: null, quantity: '', urgency: 'SIN_APURO' })
      showFeedback(
        'success',
        `Pedido de "${material.name}" (${newOrder.quantity} ${newOrder.unit_measure}) creado con éxito en Compras (Estado: PEDIR | Urgencia: ${newOrder.urgency}).`
      )
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error al generar pedido en Compras: ' + err.message)
      throw err
    }
  }

  // EDICIÓN EN CELDA (CATÁLOGO DE MATERIALES)
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

  // RETIRO MULTI-MATERIAL (CASCADA CANÓNICA BARCO -> CONTRATISTA -> OT) Y MODO EDICIÓN
  const handleSaveMultiWithdrawal = async ({ shipId, workOrderId, contractorGroup, notes, date, items, editId }) => {
    try {
      if (!items || items.length === 0) throw new Error('No se agregaron materiales al retiro.')

      const matchedAst = astilleroWorkers.find(
        (w) => w.name.toUpperCase() === String(contractorGroup || '').toUpperCase()
      )
      const workerName = matchedAst ? matchedAst.name : contractorGroup || 'Sin asignar'
      const contractorName = matchedAst ? matchedAst.name : contractorGroup || 'Sin asignar'
      const workerId = matchedAst && matchedAst.id !== matchedAst.name ? matchedAst.id : null

      if (editId) {
        // MODO EDICIÓN: Ajuste integral de la fila seleccionada
        const item = items[0]
        const mat = materials.find((m) => m.id === item.material_id)
        const qty = item.quantity ? Number(item.quantity) : 1
        const weightTotal = (Number(mat?.weight_kg) || 0) * qty

        let costCenter = 'CLIENTE'
        if (mat?.category === 'CONSUMIBLES' || mat?.category === 'ELEM.SEGURIDAD') {
          costCenter = 'CLIENTE'
        }
        if (item.customCostCenter) costCenter = item.customCostCenter

        const updates = {
          material_id: item.material_id || null,
          quantity_withdrawn: qty,
          ship_id: shipId || null,
          work_order_id: workOrderId || null,
          contractor_name: contractorName,
          worker_name: workerName,
          worker_id: workerId,
          cost_center: costCenter,
          weight_total: weightTotal,
          movement_type: mat?.category === 'ELEM.SEGURIDAD' ? 'ENTREGA_EPP' : 'CONSUMO_OBRA',
          notes: item.notes ? `${notes} - ${item.notes}`.trim() : notes,
          transaction_date: date || new Date().toISOString()
        }

        const { data: updatedTx, error: updErr } = await supabase
          .from('inventory_transactions')
          .update(updates)
          .eq('id', editId)
          .select()
          .single()

        if (updErr) throw updErr

        // Excepción / Bypass (⚠️ Sin OT): avisar a Administrador
        if (!workOrderId && shipId) {
          const targetShip = ships.find((s) => s.id === shipId)
          const shipName = targetShip?.name || 'Astillero General'
          const userIdentifier = profile?.full_name || profile?.email || user?.email || 'Pañolero'
          supabase.from('compliance_alerts').insert([{
            ship_id: shipId,
            entity_type: 'inventory_transactions',
            entity_id: editId,
            responsible_role: 'admin',
            status: 'PENDIENTE',
            escalated_to_admin: true,
            alert_message: `⚠️ Retiro sin OT en buque ${shipName} por ${contractorName}. Modificado desde ventana de ajuste.`,
            notes: `[RETIRO_SIN_OT] Editado desde Pañol Central por ${userIdentifier}`
          }]).then(({ error }) => {
            if (error) console.warn('Aviso sin OT:', error)
          })
        }

        setInventoryTx((prev) => prev.map((t) => (t.id === editId ? { ...t, ...updates } : t)))
        setShowWithdrawalModal(false)
        setEditingWithdrawalRow(null)
        showFeedback('success', 'Fila modificada con éxito mediante la ventana de ajuste.')
        return
      }

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

        // Deducir centro de costo
        let costCenter = 'CLIENTE'
        if (mat.category === 'CONSUMIBLES' || mat.category === 'ELEM.SEGURIDAD') {
          // Si el contratista se paga sus consumibles (por grupo o custom)
          costCenter = 'CLIENTE'
        }
        if (item.customCostCenter) costCenter = item.customCostCenter

        txInserts.push({
          material_id: mat.id,
          quantity_withdrawn: qty,
          ship_id: shipId || null,
          work_order_id: workOrderId || null,
          contractor_name: contractorName,
          worker_name: workerName,
          worker_id: workerId,
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

      // Excepción / Bypass (⚠️ Sin OT): avisar a Administrador
      if (!workOrderId && shipId) {
        const targetShip = ships.find((s) => s.id === shipId)
        const shipName = targetShip?.name || 'Astillero General'
        const userIdentifier = profile?.full_name || profile?.email || user?.email || 'Pañolero'
        supabase.from('compliance_alerts').insert([{
          ship_id: shipId,
          entity_type: 'inventory_transactions',
          entity_id: (createdTxs && createdTxs[0]?.id) || '00000000-0000-0000-0000-000000000000',
          responsible_role: 'admin',
          status: 'PENDIENTE',
          escalated_to_admin: true,
          alert_message: `⚠️ Retiro sin OT en buque ${shipName} por ${contractorGroup}. ${txInserts.length} materiales entregados bajo régimen provisorio.`,
          notes: `[RETIRO_SIN_OT] Registrado desde Pañol Central por ${userIdentifier}`
        }]).then(({ error }) => {
          if (error) console.warn('Aviso sin OT:', error)
        })
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
        `Retiro multi-material confirmado: ${txInserts.length} insumos registrados para ${contractorGroup}.`
      )
      setShowWithdrawalModal(false)
    } catch (err) {
      console.error(err)
      showFeedback('error', 'Error registrando retiro: ' + err.message)
    }
  }

  // Selección de filas
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

  const toggleSelectMat = (id) => {
    setSelectedMatIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleSelectAllMats = () => {
    if (selectedMatIds.size === filteredMaterials.length) {
      setSelectedMatIds(new Set())
    } else {
      setSelectedMatIds(new Set(filteredMaterials.map((m) => m.id)))
    }
  }

  return (
    <div className="space-y-4 pb-20 font-sans text-slate-100 antialiased selection:bg-cyan-500 selection:text-slate-950">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-xs font-bold animate-in fade-in slide-in-from-top-2 ${
            feedback.type === 'error'
              ? 'bg-rose-950/95 border-rose-500 text-rose-200 shadow-rose-950/50'
              : 'bg-emerald-950/95 border-emerald-500 text-emerald-200 shadow-emerald-950/50'
          }`}
        >
          {feedback.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="ml-2 text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* ============================================================================== */}
      {/* ZONA 1: CONTEXTO OPERATIVO (.alon-zone-context - Acento Azul Cielo)             */}
      {/* ============================================================================== */}
      <div className="alon-zone-context flex flex-col md:flex-row md:items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 text-slate-950">
            <Package className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-black text-white tracking-wide">
                PAÑOL CENTRAL & MATERIALES
              </h1>
              <span className="text-[10px] font-mono tracking-widest text-emerald-400/90 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded-md uppercase font-bold">
                M4 · Logística Naval
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Planilla de retiros multi-material, control de tubos de gases (P-01/P-02) y catálogo físico de stock.
            </p>
          </div>
        </div>

        {/* Acciones Superiores: Bloque Compras | Bloque Pañol */}
        <div className="flex flex-wrap items-center gap-3">
          {/* BLOQUE COMPRAS (Acento Cian) */}
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-cyan-950/30 border border-cyan-500/30 shadow-inner">
            <span className="px-2 py-0.5 text-[9px] font-mono font-black text-cyan-400 uppercase tracking-wider hidden sm:inline-block">
              COMPRAS
            </span>
            <button
              type="button"
              onClick={() => navigate('/compras?nuevo=true')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 font-bold text-xs transition-all cursor-pointer shadow-sm hover:scale-[1.02]"
              title="Cargar solicitud de compra de materiales"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400 stroke-[3]" />
              <span>+ Pedir Materiales</span>
            </button>

            <button
              type="button"
              onClick={() => navigate('/compras?mode=simple')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 font-semibold text-xs transition-all cursor-pointer"
              title="Ir a la vista simplificada de Compras para revisar recepciones"
            >
              <ExternalLink className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden md:inline">Ver Compras y Recepciones</span>
              <span className="md:hidden">Recepciones</span>
            </button>
          </div>

          {/* DIVISOR VERTICAL */}
          <div className="h-7 w-px bg-slate-800 hidden lg:block" />

          {/* BLOQUE PAÑOL (Acento Esmeralda) */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Pestañas de Navegación Compactas */}
            <div className="flex items-center bg-slate-950/80 p-0.5 rounded-xl border border-slate-800 text-xs font-bold">
              <button
                onClick={() => changeTab('planillas')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'planillas'
                    ? 'bg-emerald-600 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Planilla de Retiros</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-900/60 font-mono">
                  {filteredTransactions.length}
                </span>
              </button>

              <button
                onClick={() => changeTab('gases')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'gases'
                    ? 'bg-emerald-600 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>Control de Gases</span>
              </button>

              <button
                onClick={() => changeTab('catalogo')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'catalogo'
                    ? 'bg-emerald-600 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Catálogo & Stock (B.D)</span>
                {kpiStats.criticalCount > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500 text-slate-950 font-black">
                    {kpiStats.criticalCount}
                  </span>
                )}
              </button>

              <button
                onClick={() => changeTab('epp')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  activeTab === 'epp'
                    ? 'bg-emerald-600 text-slate-950 shadow-md font-black'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Shield className="w-3.5 h-3.5" />
                <span>Control EPP</span>
              </button>
            </div>

            {/* Botón Principal de Alta */}
            {activeTab === 'planillas' && (
              <button
                type="button"
                onClick={() => {
                  setEditingWithdrawalRow(null)
                  setShowWithdrawalModal(true)
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Registrar Retiro Multi-Material</span>
              </button>
            )}

            {activeTab === 'catalogo' && (
              <button
                type="button"
                onClick={() => setShowNewMaterialModal(true)}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-500/20 cursor-pointer hover:scale-[1.02]"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>+ Nuevo Material</span>
              </button>
            )}

            {activeTab === 'gases' && (
              <button
                type="button"
                onClick={() => setShowGasModal({ isOpen: true, operationType: 'PRIMERA_ENTREGA' })}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black text-xs transition-all shadow-lg shadow-amber-500/20 cursor-pointer hover:scale-[1.02]"
              >
                <Flame className="w-4 h-4 stroke-[2.5]" />
                <span>+ Movimiento de Tubos</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* ZONA 2: RADAR OPERATIVO DE KPIS Y ALERTAS (.alon-zone-kpis - Acento Ámbar)     */}
      {/* ============================================================================== */}
      <div className="alon-zone-kpis py-2.5 px-3 space-y-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 px-1">
          <div className="flex flex-wrap items-baseline gap-2.5">
            <span className="text-sm md:text-base font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              📊 RADAR DE KPIs Y ALERTAS OPERATIVAS
            </span>
            <span className="text-[11px] italic text-slate-400 font-normal">
              • Clic en cualquier tarjeta para filtrar
            </span>
          </div>
          {activeKpiFilter && (
            <button
              type="button"
              onClick={() => setActiveKpiFilter(null)}
              className="text-[10px] font-bold text-amber-300 hover:text-white bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded cursor-pointer transition-all"
            >
              ✕ Limpiar Filtro Activo
            </button>
          )}
        </div>

        {/* Grilla de 6 Tarjetas con 6 Colores Distintivos (Sin Repetir) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {/* 1. Stock Crítico (Rojo Carmín) */}
          <div
            onClick={() => {
              setActiveKpiFilter(activeKpiFilter === 'critico' ? null : 'critico')
              if (activeTab !== 'catalogo') changeTab('catalogo')
            }}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              activeKpiFilter === 'critico'
                ? 'bg-rose-950 border-rose-400 ring-2 ring-white/60'
                : 'bg-rose-950/30 border-rose-500/40 hover:border-rose-400'
            }`}
          >
            <div className="flex items-center justify-between text-rose-300 mb-1">
              <span className="text-[11px] font-extrabold uppercase">Stock Crítico</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />
            </div>
            <div className="text-lg font-black text-rose-200">{kpiStats.criticalCount}</div>
            <div className="text-[10px] text-rose-300/80 font-semibold truncate">En o bajo mínimo</div>
          </div>

          {/* 2. Retiros Hoy (Verde Esmeralda) */}
          <div
            onClick={() => {
              setActiveKpiFilter(activeKpiFilter === 'hoy' ? null : 'hoy')
              if (activeTab !== 'planillas') changeTab('planillas')
            }}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              activeKpiFilter === 'hoy'
                ? 'bg-emerald-950 border-emerald-400 ring-2 ring-white/60'
                : 'bg-emerald-950/30 border-emerald-500/40 hover:border-emerald-400'
            }`}
          >
            <div className="flex items-center justify-between text-emerald-300 mb-1">
              <span className="text-[11px] font-extrabold uppercase">Retiros Hoy</span>
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-lg font-black text-emerald-200">{kpiStats.todayTxCount}</div>
            <div className="text-[10px] text-emerald-300/80 font-semibold truncate">Movimientos de la fecha</div>
          </div>

          {/* 3. Sin Cargar OT (Ámbar Dorado) */}
          <div
            onClick={() => {
              setActiveKpiFilter(activeKpiFilter === 'sin_ot' ? null : 'sin_ot')
              if (activeTab !== 'planillas') changeTab('planillas')
            }}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              activeKpiFilter === 'sin_ot'
                ? 'bg-amber-950 border-amber-400 ring-2 ring-white/60'
                : 'bg-amber-950/30 border-amber-500/40 hover:border-amber-400'
            }`}
          >
            <div className="flex items-center justify-between text-amber-300 mb-1">
              <span className="text-[11px] font-extrabold uppercase">Sin Cargar OT</span>
              <Anchor className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-lg font-black text-amber-200">{kpiStats.sinOtCount}</div>
            <div className="text-[10px] text-amber-300/80 font-semibold truncate">Imputación directa buque</div>
          </div>

          {/* 4. Vacíos en Patio (Azul Eléctrico) */}
          <div
            onClick={() => {
              setActiveKpiFilter(activeKpiFilter === 'vacios' ? null : 'vacios')
              if (activeTab !== 'gases') changeTab('gases')
            }}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              activeKpiFilter === 'vacios'
                ? 'bg-blue-950 border-blue-400 ring-2 ring-white/60'
                : 'bg-blue-950/30 border-blue-500/40 hover:border-blue-400'
            }`}
          >
            <div className="flex items-center justify-between text-blue-300 mb-1">
              <span className="text-[11px] font-extrabold uppercase">Vacíos Patio</span>
              <Flame className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-lg font-black text-blue-200">{kpiStats.emptyCylinders}</div>
            <div className="text-[10px] text-blue-300/80 font-semibold truncate">Tubos a reponer (P-02)</div>
          </div>

          {/* 5. Retención > 15 Días (Púrpura / Violeta) */}
          <div
            onClick={() => {
              setActiveKpiFilter(activeKpiFilter === 'retencion' ? null : 'retencion')
              if (activeTab !== 'gases') changeTab('gases')
            }}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              activeKpiFilter === 'retencion'
                ? 'bg-purple-950 border-purple-400 ring-2 ring-white/60'
                : 'bg-purple-950/30 border-purple-500/40 hover:border-purple-400'
            }`}
          >
            <div className="flex items-center justify-between text-purple-300 mb-1">
              <span className="text-[11px] font-extrabold uppercase">Retención &gt;15d</span>
              <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
            </div>
            <div className="text-lg font-black text-purple-200">{kpiStats.longHeldGases}</div>
            <div className="text-[10px] text-purple-300/80 font-semibold truncate">Tubos en taller/obra</div>
          </div>

          {/* 6. Bajas Pendientes (Fucsia / Advertencia Admin) */}
          <div
            onClick={() => {
              setActiveKpiFilter(activeKpiFilter === 'bajas_pendientes' ? null : 'bajas_pendientes')
              if (activeTab !== 'planillas') changeTab('planillas')
            }}
            className={`p-2.5 rounded-xl border transition-all cursor-pointer ${
              activeKpiFilter === 'bajas_pendientes'
                ? 'bg-fuchsia-950 border-fuchsia-400 ring-2 ring-white/60'
                : 'bg-fuchsia-950/40 border-fuchsia-600/50 hover:border-fuchsia-400'
            }`}
          >
            <div className="flex items-center justify-between text-fuchsia-300 mb-1">
              <span className="text-[11px] font-extrabold uppercase">Bajas Pendientes</span>
              <Trash2 className="w-3.5 h-3.5 text-fuchsia-400" />
            </div>
            <div className="text-lg font-black text-fuchsia-200">{kpiStats.deletionRequestsCount}</div>
            <div className="text-[10px] text-fuchsia-300/80 font-semibold truncate">Requieren decisión Admin</div>
          </div>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* ZONA 3: BARRA DE CONTROL DECK Y FILTROS (.alon-zone-toolbar - Acento Cian)      */}
      {/* ============================================================================== */}
      <div className="alon-zone-toolbar flex flex-wrap items-center justify-between gap-3 p-3.5">
        {/* Buscador reactivo integrado */}
        <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-md">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar material, barco, OT, contratista, notas... [Ctrl+F | Esc limpia]"
              className="w-full pl-9 pr-14 py-1.5 bg-slate-900/90 border border-slate-700 focus:border-cyan-500 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none transition-all shadow-inner"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="text-slate-400 hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              ) : (
                <span className="text-[9px] font-mono px-1 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  Ctrl+F
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Filtros en Cascada */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Filtro Período */}
          <select
            value={filterPeriod}
            onChange={(e) => setFilterPeriod(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-semibold"
          >
            <option value="TODOS">Todos los Períodos</option>
            <option value="HOY">Solo Hoy</option>
            <option value="QUINCENA">Quincena Actual</option>
            <option value="MES">Mes Actual</option>
          </select>

          {/* Filtro Categoría */}
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-semibold"
          >
            <option value="TODAS">Todas las Categorías</option>
            <option value="MATERIALES">MATERIALES</option>
            <option value="CONSUMIBLES">CONSUMIBLES</option>
            <option value="ELEM.SEGURIDAD">ELEM.SEGURIDAD</option>
            <option value="GASES">GASES</option>
          </select>

          {/* Filtro Barco */}
          <select
            value={filterShip}
            onChange={(e) => setFilterShip(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:border-cyan-400 font-semibold"
          >
            <option value="TODOS">Todos los Barcos</option>
            {ships.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Toggle Control de Stock (Pestaña Catálogo) */}
          {activeTab === 'catalogo' && (
            <button
              type="button"
              onClick={() => setFilterStockOnly(!filterStockOnly)}
              className={`px-2.5 py-1.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                filterStockOnly
                  ? 'bg-cyan-950 border-cyan-500 text-cyan-300 shadow-md'
                  : 'bg-slate-900 border-slate-700 text-slate-400 hover:text-white'
              }`}
            >
              <Package className="w-3.5 h-3.5" />
              <span>Solo con Control de Stock</span>
            </button>
          )}

          {/* Botón Deshacer Universal */}
          <button
            type="button"
            disabled={!grid.canUndo}
            onClick={grid.undo}
            className={`px-3 py-1.5 rounded-lg border text-xs font-bold transition-all flex items-center gap-1.5 ${
              grid.canUndo
                ? 'bg-amber-950/80 border-amber-500/60 text-amber-300 hover:bg-amber-900 cursor-pointer shadow-md'
                : 'bg-slate-900 border-slate-800 text-slate-600 cursor-not-allowed opacity-50'
            }`}
            title="Deshacer última acción (Ctrl+Z)"
          >
            <RefreshCw className="w-3 h-3" />
            <span>Deshacer (Ctrl+Z)</span>
            <span className="text-[10px] font-mono px-1 rounded bg-black/40 text-amber-400/90">
              {grid.undoStack?.length || 0}/50
            </span>
          </button>
        </div>
      </div>

      {/* ============================================================================== */}
      {/* PESTAÑA 1: PLANILLA DE RETIROS (ZONA 4: .alon-zone-grid - Acento Esmeralda)   */}
      {/* ============================================================================== */}
      {activeTab === 'planillas' && (
        <div className="alon-zone-grid">
          {/* Ribbon Superior Informativo de la Hoja de Cálculo */}
          <div className="alon-grid-ribbon">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black font-mono text-[10px] inline-flex items-center gap-1">
                <Navigation className="w-3 h-3 text-cyan-400 fill-cyan-400/20 shrink-0" />
                <span>{grid.activeCellBadge ? `CELDA ${grid.activeCellBadge}` : 'MODO PLANILLA'}</span>
              </span>

              {grid.selectionStats ? (
                <div className="flex flex-wrap items-center gap-2 bg-cyan-950/80 border border-cyan-500/40 px-2.5 py-0.5 rounded-lg text-[10px] font-mono text-cyan-200">
                  <span><strong># Recuento:</strong> {grid.selectionStats.count}</span>
                  {grid.selectionStats.numericCount > 0 && (
                    <>
                      <span>•</span>
                      <span><strong>Σ Suma:</strong> {grid.selectionStats.sum.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</span>
                      <span>•</span>
                      <span><strong>x̄ Promedio:</strong> {grid.selectionStats.avg.toLocaleString('es-AR', { maximumFractionDigits: 2 })}</span>
                    </>
                  )}
                </div>
              ) : (
                <span className="text-slate-400 text-[11px]">
                  Doble clic o <strong className="text-slate-200">Enter</strong> en cualquier celda para editar • Arrastrar esquina celeste o <strong className="text-slate-200">Ctrl+D</strong> para rellenar
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleInsertRow}
                className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-950 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-300 font-bold text-xs transition-all cursor-pointer shadow-md hover:scale-[1.02]"
                title="Insertar fila 100% en blanco al final de la planilla (solo fecha de hoy)"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />
                <span>+ Insertar Fila en Blanco al Final</span>
              </button>
              <div className="flex items-center gap-2 text-slate-500 font-mono text-[10px]">
                <span>Memoria Undo: {grid.undoStack?.length || 0}/50</span>
                <span>•</span>
                <span>{filteredTransactions.length} filas</span>
              </div>
            </div>
          </div>

          {/* Datalists para autocompletado in-situ */}
          <datalist id="panol-materials-datalist">
            {materials.map((m) => (
              <option key={m.id} value={m.name} />
            ))}
          </datalist>
          <datalist id="panol-contractors-datalist">
            {availableGroups.map((grp) => (
              <option key={grp} value={grp} />
            ))}
          </datalist>

          {/* Contenedor con Foco Interactivo para el Hook */}
          <div
            tabIndex={0}
            onKeyDown={grid.handleKeyDown}
            ref={grid.gridContainerRef}
            className="w-full max-h-[620px] overflow-y-auto overflow-x-hidden relative focus:outline-none"
          >
            <table className="w-full text-left text-[11px] border-collapse">
              {/* STICKY HEADER TIPO EXCEL */}
              <thead className="sticky top-0 z-20 alon-grid-thead">
                <tr>
                  {/* Columna 1 Apilada: Checkbox + # */}
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
                        className={`group transition-colors ${
                          isDeletionReq
                            ? 'bg-rose-950/60 text-rose-300 font-bold border-y-2 border-rose-500/60'
                            : isSelected
                            ? 'bg-cyan-950/30 hover:bg-cyan-950/40'
                            : 'hover:bg-slate-800/50'
                        }`}
                      >
                        {/* 1. Checkbox + Número de Fila (#) */}
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
                            >
                              {rowIndex + 1}
                            </span>
                          </div>
                        </td>

                        {/* 2. Fecha (Doble clic abre calendario con showPicker) */}
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
                                      try {
                                        if (typeof el.showPicker === 'function') el.showPicker()
                                      } catch {}
                                    }
                                  }}
                                  value={inlineEdit.value}
                                  onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                  onBlur={() => handleSaveInlineTx(tx.id, 'transaction_date', inlineEdit.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveInlineTx(tx.id, 'transaction_date', inlineEdit.value)
                                    if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                                  }}
                                  className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-[11px] font-mono text-white focus:outline-none"
                                />
                              ) : (
                                <span>{dateVal || '—'}</span>
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

                        {/* 3. Barco / Destino (Doble clic editable) */}
                        {(() => {
                          const cp = getSpreadsheetCellProps(rowIndex, 'ship_id')
                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'ship_id', value: tx.ship_id || '' })}
                              className={`py-1.5 px-1.5 whitespace-nowrap cursor-pointer font-semibold ${cp.className} ${isDeletionReq ? 'line-through text-rose-300' : 'text-slate-200'}`}
                              title="Doble clic para cambiar Barco"
                            >
                              {inlineEdit.id === tx.id && inlineEdit.field === 'ship_id' ? (
                                <select
                                  autoFocus
                                  value={inlineEdit.value}
                                  onChange={(e) => {
                                    handleSaveInlineTx(tx.id, 'ship_id', e.target.value)
                                  }}
                                  onBlur={() => setInlineEdit({ id: null, field: null, value: '' })}
                                  className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[10px] font-bold text-white focus:outline-none"
                                >
                                  <option value="">(Sin Barco / Astillero)</option>
                                  {ships.map((s) => (
                                    <option key={s.id} value={s.id}>
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <div className="flex items-center gap-1.5">
                                  <Anchor className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                                  <HighlightText text={ship?.name || 'ASTILLERO'} query={searchQuery} />
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

                        {/* 4. Orden de Trabajo (OT) (Doble clic editable con cascada de Contratista) */}
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
                              onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'work_order_id', value: tx.work_order_id || '' })}
                              className={`py-1.5 px-1.5 max-w-[220px] truncate cursor-pointer ${cp.className} ${isDeletionReq ? 'line-through text-rose-300' : ''}`}
                              title={otTooltip}
                            >
                              {inlineEdit.id === tx.id && inlineEdit.field === 'work_order_id' ? (
                                <select
                                  autoFocus
                                  value={inlineEdit.value}
                                  onChange={(e) => handleSaveInlineTx(tx.id, 'work_order_id', e.target.value || null)}
                                  onBlur={() => setInlineEdit({ id: null, field: null, value: '' })}
                                  className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[10px] text-white focus:outline-none max-w-[240px]"
                                >
                                  <option value="">(⚠️ Sin OT)</option>
                                  {enabledShipWos.map((w) => (
                                    <option key={w.id} value={w.id}>
                                      OT #{w.order_number || w.ot_number || w.id?.slice(0, 4)} - {w.title || w.description}
                                    </option>
                                  ))}
                                </select>
                              ) : wo ? (
                                <span className="text-cyan-400 font-bold">
                                  OT #{wo.order_number || wo.ot_number || wo.id?.slice(0, 4)}: <span className="text-slate-300 font-normal">{wo.title || wo.description}</span>
                                </span>
                              ) : (
                                <div className="flex items-center justify-between gap-1">
                                  <span className="text-amber-400/90 italic font-mono text-[10px]">
                                    (⚠️ Sin OT)
                                  </span>
                                  {allocState.needsOtRequest && (
                                    allocState.isOtRequestPending ? (
                                      <span
                                        className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed shrink-0"
                                        title="Solicitud de apertura de OT registrada en base de datos. Pendiente de resolución por Jorge Sentis."
                                      >
                                        Solicitud enviada (1)
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          setRequestOtModal({
                                            isOpen: true,
                                            txId: tx.id,
                                            shipId: tx.ship_id || '',
                                            targetWorkerOrContractor: contractorVal || '',
                                            reason: ''
                                          })
                                        }}
                                        className="px-2 py-0.5 rounded text-[9px] font-extrabold bg-rose-600 hover:bg-rose-500 text-white shadow animate-pulse shrink-0 cursor-pointer"
                                        title="No hay OT habilitada para este contratista en este buque. Clic para pedir apertura a Jorge Sentis."
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

                        {/* 5. Material Insumo (Doble clic editable con buscador datalist) */}
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
                                    if (match) {
                                      handleSaveInlineTx(tx.id, 'material_id', match.id)
                                    } else {
                                      setInlineEdit({ id: null, field: null, value: '' })
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const match = materials.find((m) => m.name.toLowerCase() === inlineEdit.value.toLowerCase().trim())
                                      if (match) handleSaveInlineTx(tx.id, 'material_id', match.id)
                                      else setInlineEdit({ id: null, field: null, value: '' })
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
                                        setPreviewImage(mat.image_url)
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

                        {/* 6. Cantidad (Doble clic editable, recalcula peso) */}
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
                                  onBlur={() => handleSaveInlineTx(tx.id, 'quantity_withdrawn', inlineEdit.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveInlineTx(tx.id, 'quantity_withdrawn', inlineEdit.value)
                                    if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                                  }}
                                  className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[11px] font-mono text-white focus:outline-none w-16 text-right"
                                />
                              ) : (
                                <span>
                                  {tx.quantity_withdrawn} {mat?.unit_measure || 'un.'}
                                </span>
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

                        {/* 7. Peso (kg) (Doble clic editable) */}
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
                                  onBlur={() => handleSaveInlineTx(tx.id, 'weight_total', inlineEdit.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveInlineTx(tx.id, 'weight_total', inlineEdit.value)
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

                        {/* 8. Operario / Contratista (Doble clic editable - Estilo Horas sin rubro en paréntesis) */}
                        {(() => {
                          const cp = getSpreadsheetCellProps(rowIndex, 'contractor_name')
                          const enabled = getEnabledWorkersAndContractors(tx.ship_id, tx.work_order_id)
                          const currentVal = tx.worker_name || tx.contractor_name || ''
                          const allocState = evaluateAllocationState({
                            shipId: tx.ship_id,
                            workOrderId: tx.work_order_id,
                            contractorName: currentVal,
                            isSinOt: !tx.work_order_id,
                            availableWos: getEnabledWosForShipAndContractor(tx.ship_id, currentVal),
                            pendingAlerts
                          })

                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => setInlineEdit({ id: tx.id, field: 'contractor_name', value: currentVal })}
                              className={`py-1.5 px-1.5 whitespace-nowrap cursor-pointer font-bold text-cyan-300 ${cp.className} ${isDeletionReq ? 'line-through text-rose-300' : ''}`}
                              title="Doble clic para cambiar Operario o Contratista"
                            >
                              {inlineEdit.id === tx.id && inlineEdit.field === 'contractor_name' ? (
                                <select
                                  autoFocus
                                  value={inlineEdit.value}
                                  onChange={(e) => {
                                    const val = e.target.value
                                    if (val === '__SOLICITAR_APERTURA_OT__') {
                                      setInlineEdit({ id: null, field: null, value: '' })
                                      setRequestOtModal({
                                        isOpen: true,
                                        txId: tx.id,
                                        shipId: tx.ship_id || '',
                                        targetWorkerOrContractor: currentVal || '',
                                        reason: ''
                                      })
                                      return
                                    }
                                    if (val === '__SOLICITAR_HABILITACION_OPERARIO__') {
                                      setInlineEdit({ id: null, field: null, value: '' })
                                      setWorkerPermissionModal({
                                        isOpen: true,
                                        workerId: '',
                                        reason: ''
                                      })
                                      return
                                    }
                                    handleSaveInlineTx(tx.id, 'contractor_name', val)
                                  }}
                                  onBlur={() => setInlineEdit({ id: null, field: null, value: '' })}
                                  className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-[11px] font-bold text-white focus:outline-none"
                                >
                                  <option value="">-- Seleccionar Operario / Contratista --</option>
                                  {enabled.astilleroWorkers.length > 0 && (
                                    <optgroup label={`⭐ Personal Astillero (${enabled.astilleroWorkers.length})`}>
                                      {enabled.astilleroWorkers.map((w) => (
                                        <option key={`cell_ast_${w.id || w.name}`} value={w.name}>
                                          {w.name}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                  {enabled.contractorGroups.length > 0 && (
                                    <optgroup label={`🏗️ Contratistas (${enabled.contractorGroups.length})`}>
                                      {enabled.contractorGroups.map((grp) => (
                                        <option key={`cell_cnt_${grp}`} value={grp}>
                                          {grp}
                                        </option>
                                      ))}
                                    </optgroup>
                                  )}
                                  <option
                                    value="__SOLICITAR_APERTURA_OT__"
                                    disabled={allocState.isOtRequestPending}
                                    className={`${allocState.isOtRequestPending ? 'text-slate-500 bg-slate-900' : 'text-rose-400 font-bold bg-slate-900'}`}
                                  >
                                    {allocState.isOtRequestPending ? 'Solicitud de OT enviada (1)' : '➕ Solicitar Apertura de OT a Admin...'}
                                  </option>
                                  <option value="__SOLICITAR_HABILITACION_OPERARIO__" className="text-cyan-400 font-bold bg-slate-900">
                                    ➕ Solicitar Habilitación de Operario a Admin...
                                  </option>
                                </select>
                              ) : (
                                <HighlightText text={currentVal || 'Sin asignar'} query={searchQuery} />
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

                        {/* 9. Centro de Costo (Doble clic: Admin puede alternar CLIENTE / CONTRATISTA) */}
                        {(() => {
                          const cp = getSpreadsheetCellProps(rowIndex, 'cost_center')
                          const isCliente = tx.cost_center === 'CLIENTE'
                          return (
                            <td
                              {...cp.domProps}
                              onDoubleClick={() => {
                                if (isAdmin) {
                                  const next = isCliente ? 'CONTRATISTA' : 'CLIENTE'
                                  handleSaveInlineTx(tx.id, 'cost_center', next)
                                } else {
                                  showFeedback('error', 'Solo el Administrador tiene permiso para modificar el Centro de Costo.')
                                }
                              }}
                              className={`py-1.5 px-1.5 whitespace-nowrap cursor-pointer text-center ${cp.className} ${isDeletionReq ? 'line-through' : ''}`}
                              title={isAdmin ? 'Doble clic para alternar CLIENTE / CONTRATISTA' : 'Centro de Costo deducido (Solo Admin)'}
                            >
                              <span
                                className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                  isCliente
                                    ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                                    : 'bg-amber-950 text-amber-300 border-amber-800'
                                }`}
                              >
                                {tx.cost_center || 'CLIENTE'}
                              </span>
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

                        {/* 10. Observaciones (Doble clic editable) */}
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
                                  onBlur={() => handleSaveInlineTx(tx.id, 'notes', inlineEdit.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleSaveInlineTx(tx.id, 'notes', inlineEdit.value)
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

                        {/* 11. Acciones: 1) Editar en Modal 2) Pedido de Compra 3) Duplicar 4) Borrar Fila */}
                        <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            {/* Acción 0: Editar Fila en Modal de Salida */}
                            <button
                              type="button"
                              onClick={() => {
                                setEditingWithdrawalRow(tx)
                                setShowWithdrawalModal(true)
                              }}
                              className="p-1 rounded hover:bg-emerald-950/80 text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                              title="Editar fila en ventana de salida multi-material"
                            >
                              <Edit3 className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>

                            {/* Acción 2: Pedido de Compra Directo */}
                            <button
                              type="button"
                              onClick={() => {
                                setQuickPurchaseModal({
                                  isOpen: true,
                                  material: mat || { id: tx.material_id, name: 'Insumo', unit_measure: 'Unidad' },
                                  quantity: String(tx.quantity_withdrawn || 1),
                                  urgency: 'SIN_APURO'
                                })
                              }}
                              className="p-1 rounded hover:bg-cyan-950/80 text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                              title="Generar Pedido de Compra directo a Compras (Estado: PEDIR)"
                            >
                              <ShoppingCart className="w-3.5 h-3.5 stroke-[2.5]" />
                            </button>

                            {/* Duplicar Registro */}
                            <button
                              type="button"
                              onClick={() => handleDuplicateTx(tx)}
                              className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                              title="Duplicar retiro con fecha de hoy"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {/* Acción 1: Borrar Fila */}
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
                                  title={`Eliminación solicitada por ${tx.deletion_requested_by || 'Operario'}. A la espera de Jorge Sentis.`}
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
        </div>
      )}

      {/* ============================================================================== */}
      {/* PESTAÑA 2: CONTROL DE GASES Y CILINDROS RETORNABLES                            */}
      {/* ============================================================================== */}
      {activeTab === 'gases' && (
        <div className="space-y-4">
          {/* Tarjetas de Stock en Patio por Marca Proveedor */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {Object.values(gasStats.patioStock).map(({ supplier, full, empty }) => (
              <div
                key={supplier.id}
                className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 shadow-lg flex flex-col justify-between"
              >
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-2 mb-2">
                  <span className="font-black text-white text-xs truncate">{supplier.name}</span>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 font-mono font-bold">
                    {supplier.is_local_supplier ? 'Local MDP' : 'Nacional'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-emerald-950/50 border border-emerald-500/40">
                    <span className="block text-[10px] text-emerald-400 font-bold uppercase">Llenos</span>
                    <span className="text-xl font-black text-emerald-300 font-mono">{full}</span>
                  </div>
                  <div className="p-2 rounded-lg bg-rose-950/50 border border-rose-500/40">
                    <span className="block text-[10px] text-rose-400 font-bold uppercase">Vacíos</span>
                    <span className="text-xl font-black text-rose-300 font-mono">{empty}</span>
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Total Patio:</span>
                  <span className="font-mono font-bold text-white">{full + empty} tubos</span>
                </div>
              </div>
            ))}
          </div>

          {/* Matriz de Deuda de Tubos por Contratista */}
          <div className="alon-zone-grid">
            <div className="alon-grid-ribbon">
              <span className="font-bold text-slate-300 uppercase tracking-wider text-xs flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Matriz de Deuda de Tubos por Contratista / Obra</span>
              </span>
              <span className="text-slate-500 text-[11px]">
                Regla P-01: Alerta ante retención mayor a 15 días sin rotación
              </span>
            </div>

            <div className="w-full max-h-[500px] overflow-y-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-20 alon-grid-thead">
                  <tr>
                    <th className="py-2.5 px-3">Contratista / Taller</th>
                    <th className="py-2.5 px-3 text-center">Tubos en Poder</th>
                    <th className="py-2.5 px-3">Estado de Retención</th>
                    <th className="py-2.5 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {Object.entries(gasStats.contractorDebts).map(([cName, data]) => {
                    const longHeld = gasStats.longHeldContractors.find((lh) => lh.contractor === cName)
                    return (
                      <tr key={cName} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 font-bold text-white flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-cyan-400" />
                          <span>{cName}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full font-mono font-black text-xs ${
                              data.totalHeld > 0 ? 'bg-amber-950 text-amber-300 border border-amber-600' : 'text-slate-500'
                            }`}
                          >
                            {data.totalHeld} tubos
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          {longHeld ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950 border border-rose-600 text-rose-300 font-bold text-[10px]">
                              <AlertTriangle className="w-3 h-3 text-rose-400" />
                              <span>{longHeld.days} días retenidos (&gt;15d)</span>
                            </span>
                          ) : (
                            <span className="text-emerald-400 text-[11px] font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Normal</span>
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {longHeld && (
                            <button
                              type="button"
                              onClick={() => {
                                const msg = `Hola ${cName}, desde Pañol Alon Car te recordamos que poseen cilindros de gas con más de ${longHeld.days} días de retiro. Por favor coordinar recambio o devolución final para evitar cargos de alquiler. Muchas gracias.`
                                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank')
                              }}
                              className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 border border-rose-600 text-rose-200 text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>Reclamar WhatsApp</span>
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* PESTAÑA 3: CATÁLOGO MAESTRO B.D MATERIALES & STOCK FÍSICO                     */}
      {/* ============================================================================== */}
      {activeTab === 'catalogo' && (
        <div className="alon-zone-grid">
          {/* Ribbon Superior de Catálogo */}
          <div className="alon-grid-ribbon">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black font-mono text-[10px] inline-flex items-center gap-1">
                <Layers className="w-3 h-3 text-cyan-400 shrink-0" />
                <span>CATÁLOGO B.D MATERIALES</span>
              </span>
              <span className="text-slate-400 text-[11px]">
                Doble clic en celdas para editar Nombre, Peso, Stock Mínimo y Control de Stock
              </span>
            </div>

            {selectedMatIds.size > 0 && (
              <button
                type="button"
                onClick={() => {
                  const selectedList = materials
                    .filter((m) => selectedMatIds.has(m.id))
                    .map((m) => ({ id: m.id, name: m.name, unit_measure: m.unit_measure }))
                  navigate(`/compras?nuevo=true&multiMaterials=${encodeURIComponent(JSON.stringify(selectedList))}`)
                }}
                className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black text-xs flex items-center gap-1.5 cursor-pointer shadow-lg animate-in fade-in"
              >
                <ShoppingCart className="w-3.5 h-3.5 stroke-[3]" />
                <span>🛒 Generar Pedido de Compra en Lote ({selectedMatIds.size})</span>
              </button>
            )}
          </div>

          <div className="w-full max-h-[620px] overflow-y-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead className="sticky top-0 z-20 alon-grid-thead">
                <tr>
                  <th className="py-1 px-1 w-8 text-center select-none">
                    <button
                      type="button"
                      onClick={toggleSelectAllMats}
                      className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                    >
                      {selectedMatIds.size === filteredMaterials.length && filteredMaterials.length > 0 ? (
                        <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </th>
                  <th className="py-2 px-1.5">Material / Insumo ✎</th>
                  <th className="py-2 px-1.5">Rubro Técnico</th>
                  <th className="py-2 px-1.5">Categoría</th>
                  <th className="py-2 px-1.5 text-right">Peso Unit. (kg) ✎</th>
                  <th className="py-2 px-1.5 text-right">Stock Actual</th>
                  <th className="py-2 px-1.5 text-right">Stock Mínimo ✎</th>
                  <th className="py-2 px-1.5 text-center">Lleva Stock Físico ✎</th>
                  <th className="py-2 px-1.5 text-center">% Seg. Naval ✎</th>
                  <th className="py-2 px-1.5 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {filteredMaterials.map((mat, idx) => {
                  const isSelected = selectedMatIds.has(mat.id)
                  const curr = Number(mat.current_stock) || 0
                  const min = Number(mat.minimum_stock) || 0
                  const isCritical = curr <= min && mat.requires_stock_control
                  const badge = getSecurityFactorBadge(mat.security_factor)

                  return (
                    <tr
                      key={mat.id}
                      className={`group transition-colors ${
                        isSelected ? 'bg-cyan-950/30' : isCritical ? 'bg-rose-950/20' : 'hover:bg-slate-800/40'
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-1 px-1 text-center w-8 select-none">
                        <button
                          type="button"
                          onClick={() => toggleSelectMat(mat.id)}
                          className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                        >
                          {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
                        </button>
                      </td>

                      {/* Nombre Material */}
                      <td
                        onDoubleClick={() => setInlineEdit({ id: mat.id, field: 'name', value: mat.name || '' })}
                        className="py-1.5 px-1.5 font-bold text-white cursor-pointer max-w-[240px] truncate"
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
                            className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none w-full"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5">
                            {mat.image_url ? (
                              <img
                                src={mat.image_url}
                                alt=""
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setPreviewImage(mat.image_url)
                                }}
                                className="w-5 h-5 rounded object-cover shrink-0 border border-slate-700 cursor-zoom-in"
                              />
                            ) : (
                              <Package className="w-4 h-4 text-slate-500 shrink-0" />
                            )}
                            <HighlightText text={mat.name} query={searchQuery} />
                          </div>
                        )}
                      </td>

                      {/* Rubro */}
                      <td className="py-1.5 px-1.5 text-slate-300 font-semibold">{mat.rubro || '—'}</td>

                      {/* Categoría */}
                      <td className="py-1.5 px-1.5">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                          {mat.category}
                        </span>
                      </td>

                      {/* Peso Unitario en kg */}
                      <td
                        onDoubleClick={() => setInlineEdit({ id: mat.id, field: 'weight_kg', value: String(mat.weight_kg || 0) })}
                        className="py-1.5 px-1.5 text-right font-mono text-slate-300 cursor-pointer"
                        title="Doble clic para editar peso por unidad"
                      >
                        {inlineEdit.id === mat.id && inlineEdit.field === 'weight_kg' ? (
                          <input
                            type="number"
                            autoFocus
                            step="any"
                            min="0"
                            value={inlineEdit.value}
                            onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                            onBlur={() => handleSaveInlineMaterial(mat.id, 'weight_kg', inlineEdit.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInlineMaterial(mat.id, 'weight_kg', inlineEdit.value)
                              if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                            }}
                            className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-xs font-mono text-white focus:outline-none w-16 text-right"
                          />
                        ) : (
                          <span>{Number(mat.weight_kg) > 0 ? `${mat.weight_kg} kg` : '—'}</span>
                        )}
                      </td>

                      {/* Stock Actual */}
                      <td className="py-1.5 px-1.5 text-right font-mono font-bold">
                        <span className={isCritical ? 'text-rose-400' : 'text-emerald-400'}>
                          {mat.current_stock} {mat.unit_measure || 'un.'}
                        </span>
                      </td>

                      {/* Stock Mínimo */}
                      <td
                        onDoubleClick={() => setInlineEdit({ id: mat.id, field: 'minimum_stock', value: String(mat.minimum_stock || 0) })}
                        className="py-1.5 px-1.5 text-right font-mono text-slate-400 cursor-pointer"
                        title="Doble clic para editar stock mínimo de reposición"
                      >
                        {inlineEdit.id === mat.id && inlineEdit.field === 'minimum_stock' ? (
                          <input
                            type="number"
                            autoFocus
                            min="0"
                            value={inlineEdit.value}
                            onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                            onBlur={() => handleSaveInlineMaterial(mat.id, 'minimum_stock', inlineEdit.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveInlineMaterial(mat.id, 'minimum_stock', inlineEdit.value)
                              if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                            }}
                            className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-xs font-mono text-white focus:outline-none w-16 text-right"
                          />
                        ) : (
                          <span>{mat.minimum_stock || 0}</span>
                        )}
                      </td>

                      {/* Lleva Control de Stock Físico */}
                      <td
                        onDoubleClick={() => handleSaveInlineMaterial(mat.id, 'requires_stock_control', !mat.requires_stock_control)}
                        className="py-1.5 px-1.5 text-center cursor-pointer"
                        title="Doble clic para alternar si lleva o no control de stock"
                      >
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                            mat.requires_stock_control
                              ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {mat.requires_stock_control ? 'SÍ (Físico)' : 'NO (Eventual)'}
                        </span>
                      </td>

                      {/* % Seguridad Naval */}
                      <td
                        onDoubleClick={() => {
                          if (isAdmin) {
                            setInlineEdit({ id: mat.id, field: 'security_factor', value: String(mat.security_factor || 1.06) })
                          } else {
                            showFeedback('error', 'Solo el Administrador puede modificar el porcentaje de seguridad.')
                          }
                        }}
                        className="py-1.5 px-1.5 text-center cursor-pointer"
                        title={isAdmin ? 'Doble clic para editar factor de seguridad (Solo Admin)' : 'Factor de seguridad naval'}
                      >
                        {inlineEdit.id === mat.id && inlineEdit.field === 'security_factor' ? (
                          <select
                            autoFocus
                            value={inlineEdit.value}
                            onChange={(e) => handleSaveInlineMaterial(mat.id, 'security_factor', e.target.value)}
                            onBlur={() => setInlineEdit({ id: null, field: null, value: '' })}
                            className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[10px] text-white focus:outline-none"
                          >
                            <option value="1.02">2% (1.02)</option>
                            <option value="1.06">6% (1.06 Estándar)</option>
                            <option value="1.10">10% (1.10)</option>
                            <option value="1.15">15% (1.15)</option>
                            <option value="1.20">20% (1.20)</option>
                          </select>
                        ) : (
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] border ${badge.style}`}>
                            {badge.label}
                          </span>
                        )}
                      </td>

                      {/* Acciones */}
                      <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* Botón Reponer en Compras */}
                          <button
                            type="button"
                            onClick={() => {
                              navigate(`/compras?nuevo=true&materialId=${mat.id}&materialName=${encodeURIComponent(mat.name)}`)
                            }}
                            className="px-2 py-0.5 rounded bg-cyan-950 hover:bg-cyan-900 border border-cyan-600 text-cyan-300 font-bold text-[10px] flex items-center gap-1 cursor-pointer transition-colors"
                            title="Generar pedido de reposición en Compras"
                          >
                            <ShoppingCart className="w-3 h-3" />
                            <span>Reponer</span>
                          </button>

                          {/* Ajuste de Stock */}
                          <button
                            type="button"
                            onClick={() => setShowStockAdjustModal({ isOpen: true, material: mat })}
                            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
                            title="Ajustar inventario físico"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* PESTAÑA 4: CONTROL DE EPP POR OPERARIO                                         */}
      {/* ============================================================================== */}
      {activeTab === 'epp' && (
        <div className="alon-zone-grid p-6 text-center text-slate-400 space-y-3">
          <Shield className="w-10 h-10 text-emerald-400 mx-auto" />
          <h2 className="text-base font-bold text-white">Registro y Control de Elementos de Protección Personal (EPP)</h2>
          <p className="text-xs max-w-md mx-auto">
            Consolidado histórico de entregas de botines, cascos, antiparras y guantes asignados a cada operario y contratista.
          </p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowWithdrawalModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs cursor-pointer shadow-lg inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Registrar Nueva Entrega de EPP</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODALES DEL MÓDULO                                                             */}
      {/* ============================================================================== */}

      {/* MODAL 1: RETIRO MULTI-MATERIAL (CASCADA CANÓNICA) Y EDICIÓN */}
      {showWithdrawalModal && (
        <MultiWithdrawalModal
          materials={materials}
          ships={ships}
          workOrders={workOrders}
          workItems={workItems}
          astilleroWorkers={astilleroWorkers}
          contractorGroups={contractorGroups}
          unauthorizedWorkers={unauthorizedWorkers}
          getEnabledWorkersAndContractors={getEnabledWorkersAndContractors}
          pendingAlerts={pendingAlerts}
          isAdmin={isAdmin}
          editingRow={editingWithdrawalRow}
          onRequestOt={(targetShipId, preselectedWorker) => {
            setRequestOtModal({
              isOpen: true,
              txId: null,
              shipId: targetShipId || '',
              targetWorkerOrContractor: preselectedWorker || '',
              reason: ''
            })
          }}
          onRequestWorkerPermission={() => {
            setWorkerPermissionModal({
              isOpen: true,
              workerId: '',
              reason: ''
            })
          }}
          onClose={() => {
            setShowWithdrawalModal(false)
            setEditingWithdrawalRow(null)
          }}
          onSave={handleSaveMultiWithdrawal}
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

      {/* MODAL 5: PEDIDO DE COMPRA DIRECTO (ACCIÓN 2) */}
      {quickPurchaseModal.isOpen && (
        <QuickPurchaseModal
          material={quickPurchaseModal.material}
          initialQuantity={quickPurchaseModal.quantity}
          initialUrgency={quickPurchaseModal.urgency || 'SIN_APURO'}
          onClose={() => setQuickPurchaseModal({ isOpen: false, material: null, quantity: '', urgency: 'SIN_APURO' })}
          onConfirm={handleCreateDirectPurchaseOrder}
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

      {/* MODAL 7: SOLICITAR APERTURA DE OT A JORGE SENTIS (ADMINISTRADOR) */}
      {requestOtModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
                <AlertCircle className="w-5 h-5" />
                <span>Solicitar Apertura de OT a Jorge Sentis</span>
              </div>
              <button
                type="button"
                onClick={() => setRequestOtModal({ isOpen: false, txId: null, shipId: '', targetWorkerOrContractor: '', reason: '' })}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              El operario o contratista no cuenta con una OT habilitada en este buque. 
              Al confirmar, se enviará una notificación prioritaria a <strong>Jorge Sentis (Administrador)</strong> para la apertura de la nueva OT y se habilitará la entrega provisoria bajo <strong>(⚠️ Sin OT)</strong>.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Buque / Destino</label>
                <select
                  value={requestOtModal.shipId}
                  onChange={(e) => setRequestOtModal((prev) => ({ ...prev, shipId: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
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
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Operario o Contratista Requerido</label>
                <select
                  value={requestOtModal.targetWorkerOrContractor}
                  onChange={(e) => setRequestOtModal((prev) => ({ ...prev, targetWorkerOrContractor: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-400"
                >
                  <option value="">-- Seleccionar de la nómina completa --</option>
                  <optgroup label="⭐ Personal Astillero (Aloncar)">
                    {astilleroWorkers.map((w) => (
                      <option key={`req_ast_${w.id || w.name}`} value={w.name}>
                        {w.name}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="🏗️ Contratistas Externos">
                    {contractorGroups.map((grp) => (
                      <option key={`req_cnt_${grp}`} value={grp}>
                        {grp}
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Motivo / Tareas a Realizar</label>
                <textarea
                  rows={3}
                  value={requestOtModal.reason}
                  onChange={(e) => setRequestOtModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Ej: Se requiere retirar insumos para tareas urgentes no contempladas en las OTs actuales..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setRequestOtModal({ isOpen: false, txId: null, shipId: '', targetWorkerOrContractor: '', reason: '' })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitRequestOt}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar Alerta a Jorge Sentis</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 8: SOLICITAR HABILITACIÓN DE OPERARIO A JORGE SENTIS */}
      {workerPermissionModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <UserCheck className="w-5 h-5" />
                <span>Solicitar Habilitación de Operario a Jorge Sentis</span>
              </div>
              <button
                type="button"
                onClick={() => setWorkerPermissionModal({ isOpen: false, workerId: '', reason: '' })}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              El operario seleccionado no cuenta actualmente con el permiso de retiro de materiales en Pañol (<strong>P</strong>).
              Al enviar esta solicitud, <strong>Jorge Sentis (Administrador)</strong> podrá habilitarlo formalmente en el Padrón de Personal.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Operario sin Permiso</label>
                <select
                  value={workerPermissionModal.workerId}
                  onChange={(e) => setWorkerPermissionModal((prev) => ({ ...prev, workerId: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-cyan-400 font-bold focus:outline-none focus:border-cyan-400"
                >
                  <option value="">-- Seleccionar Operario a Habilitar --</option>
                  {unauthorizedWorkers.map((w) => (
                    <option key={`unauth_${w.id}`} value={w.id}>
                      {w.name} ({w.trade || 'General'} - {w.admin_center || 'Astillero'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Motivo / Justificación</label>
                <textarea
                  rows={3}
                  value={workerPermissionModal.reason}
                  onChange={(e) => setWorkerPermissionModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Ej: Asignado a tareas urgentes en dique, requiere retirar insumos de trabajo y EPP..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setWorkerPermissionModal({ isOpen: false, workerId: '', reason: '' })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitWorkerPermission}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar Solicitud a Jorge Sentis</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==============================================================================
// SUBCOMPONENTE: MODAL DE RETIRO MULTI-MATERIAL (CASCADA CANÓNICA Y EDICIÓN)
// ==============================================================================
function MultiWithdrawalModal({
  materials,
  ships,
  workOrders,
  workItems,
  astilleroWorkers = [],
  contractorGroups = [],
  unauthorizedWorkers = [],
  getEnabledWorkersAndContractors,
  pendingAlerts = [],
  isAdmin,
  editingRow,
  onRequestOt,
  onRequestWorkerPermission,
  onClose,
  onSave
}) {
  const [shipId, setShipId] = useState(editingRow?.ship_id || '')
  const [contractorGroup, setContractorGroup] = useState(editingRow?.worker_name || editingRow?.contractor_name || '')
  const [workOrderId, setWorkOrderId] = useState(editingRow?.work_order_id || '')
  const [isOtEmpty, setIsOtEmpty] = useState(!editingRow?.work_order_id)
  const [date, setDate] = useState(
    editingRow?.transaction_date
      ? String(editingRow.transaction_date).split('T')[0]
      : new Date().toISOString().split('T')[0]
  )
  const [notes, setNotes] = useState(editingRow?.notes || '')

  // Renglones de materiales dinámicos
  const [items, setItems] = useState(
    editingRow
      ? [
          {
            material_id: editingRow.material_id || '',
            quantity: editingRow.quantity_withdrawn || 1,
            customCostCenter: editingRow.cost_center || '',
            notes: ''
          }
        ]
      : [
          {
            material_id: '',
            quantity: 1,
            customCostCenter: '',
            notes: ''
          }
        ]
  )

  const enabled = useMemo(() => {
    if (typeof getEnabledWorkersAndContractors === 'function') {
      return getEnabledWorkersAndContractors(shipId, isOtEmpty ? null : workOrderId)
    }
    return { astilleroWorkers, contractorGroups }
  }, [getEnabledWorkersAndContractors, shipId, workOrderId, isOtEmpty, astilleroWorkers, contractorGroups])

  // OTs habilitadas para el Barco y Contratista/Operario elegidos usando el motor canónico
  const availableWos = useMemo(() => {
    return getContractorEnabledWos(shipId, contractorGroup, workOrders, workItems, { astilleroWorkers, contractorGroups })
  }, [shipId, contractorGroup, workOrders, workItems, astilleroWorkers, contractorGroups])

  const allocState = useMemo(() => {
    return evaluateAllocationState({
      shipId,
      workOrderId: isOtEmpty ? null : workOrderId,
      contractorName: contractorGroup,
      isSinOt: isOtEmpty,
      availableWos,
      pendingAlerts
    })
  }, [shipId, isOtEmpty, workOrderId, contractorGroup, availableWos, pendingAlerts])

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

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, idx) => idx !== index))
  }

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
    if (!contractorGroup) return alert('Debes seleccionar un Operario o Contratista.')
    if (!isOtEmpty && !workOrderId) return alert('Debes seleccionar una OT o marcar la casilla (⚠️ Sin OT).')

    const validItems = items.filter((it) => it.material_id && Number(it.quantity) > 0)
    if (validItems.length === 0) {
      return alert('Debes cargar al menos un material válido con cantidad mayor a 0.')
    }

    onSave({
      shipId,
      workOrderId: isOtEmpty ? null : workOrderId,
      contractorGroup,
      notes,
      date,
      items: validItems,
      editId: editingRow?.id || null
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden font-sans flex flex-col max-h-[92vh]">
        {/* Cabecera Modal */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2 text-white font-black text-sm">
            {editingRow ? <Edit3 className="w-5 h-5 text-cyan-400" /> : <Package className="w-5 h-5 text-emerald-400" />}
            <span>
              {editingRow
                ? 'REGISTRAR SALIDA MULTI-MATERIAL DE PAÑOL - MODO EDICIÓN'
                : 'REGISTRAR SALIDA MULTI-MATERIAL DE PAÑOL'}
            </span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
          {/* CASCADA CANÓNICA (Barco -> Contratista -> OT) */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-2">
              <span className="font-bold text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Anchor className="w-4 h-4 text-cyan-400" />
                <span>1. Destino e Imputación de Obra</span>
              </span>
              <span className="text-slate-500 text-[11px]">Cascada: Barco ➔ Operario/Contratista ➔ OT</span>
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
                    const newShipId = e.target.value
                    setShipId(newShipId)
                    setWorkOrderId('')
                    if (contractorGroup && newShipId && typeof getEnabledWorkersAndContractors === 'function') {
                      const newEnabled = getEnabledWorkersAndContractors(newShipId, null)
                      const isValid =
                        newEnabled.astilleroWorkers.some((w) => w.name.toUpperCase() === contractorGroup.toUpperCase()) ||
                        newEnabled.contractorGroups.some((g) => g.toUpperCase() === contractorGroup.toUpperCase())
                      if (!isValid) setContractorGroup('')
                    }
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

              {/* Paso 2: Operario / Contratista */}
              <div>
                <label className="block text-slate-300 font-semibold mb-1">
                  2° Operario / Contratista <span className="text-rose-400">*</span>
                </label>
                <select
                  value={contractorGroup}
                  onChange={(e) => {
                    const val = e.target.value
                    if (val === '__SOLICITAR_APERTURA_OT__') {
                      onRequestOt && onRequestOt(shipId, contractorGroup || '')
                      return
                    }
                    if (val === '__SOLICITAR_HABILITACION_OPERARIO__') {
                      onRequestWorkerPermission && onRequestWorkerPermission()
                      return
                    }
                    setContractorGroup(val)
                  }}
                  required
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-cyan-400 font-black focus:outline-none focus:border-cyan-400"
                >
                  <option value="">-- Seleccionar Operario / Contratista --</option>
                  {enabled.astilleroWorkers.length > 0 && (
                    <optgroup label={`⭐ Personal Astillero (${enabled.astilleroWorkers.length})`}>
                      {enabled.astilleroWorkers.map((w) => (
                        <option key={`m_ast_${w.id || w.name}`} value={w.name}>
                          {w.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {enabled.contractorGroups.length > 0 && (
                    <optgroup label={`🏗️ Contratistas (${enabled.contractorGroups.length})`}>
                      {enabled.contractorGroups.map((grp) => (
                        <option key={`m_cnt_${grp}`} value={grp}>
                          {grp}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option
                    value="__SOLICITAR_APERTURA_OT__"
                    disabled={allocState.isOtRequestPending}
                    className={`${allocState.isOtRequestPending ? 'text-slate-500 bg-slate-900' : 'text-rose-400 font-bold bg-slate-900'}`}
                  >
                    {allocState.isOtRequestPending ? 'Solicitud de OT enviada (1)' : '➕ Solicitar Apertura de OT a Admin...'}
                  </option>
                  <option value="__SOLICITAR_HABILITACION_OPERARIO__" className="text-cyan-400 font-bold bg-slate-900">
                    ➕ Solicitar Habilitación de Operario a Admin...
                  </option>
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
                    <span>(⚠️ Sin OT)</span>
                  </label>
                </div>

                <select
                  value={workOrderId}
                  disabled={isOtEmpty}
                  onChange={(e) => {
                    const newWoId = e.target.value
                    setWorkOrderId(newWoId)
                    if (contractorGroup && typeof getEnabledWorkersAndContractors === 'function') {
                      const newEnabled = getEnabledWorkersAndContractors(shipId, newWoId)
                      const isValid =
                        newEnabled.astilleroWorkers.some((w) => w.name.toUpperCase() === contractorGroup.toUpperCase()) ||
                        newEnabled.contractorGroups.some((g) => g.toUpperCase() === contractorGroup.toUpperCase())
                      if (!isValid) setContractorGroup('')
                    }
                  }}
                  required={!isOtEmpty}
                  className={`w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-400 ${
                    isOtEmpty ? 'opacity-40 cursor-not-allowed bg-slate-950' : 'font-semibold'
                  }`}
                >
                  <option value="">(⚠️ Sin OT)</option>
                  {availableWos.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      OT #{wo.order_number || wo.ot_number || wo.id?.slice(0, 4)} - {wo.title || wo.description}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Aviso de Inconsistencia de OT & Botón Rojo de Apertura */}
            {shipId && contractorGroup && availableWos.length === 0 && !isOtEmpty && (
              <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-800/80 flex items-center justify-between gap-3 animate-in fade-in">
                <div className="flex items-center gap-2 text-rose-300 font-semibold text-xs">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>No hay OT habilitada para este contratista en este buque.</span>
                </div>
                {allocState.isOtRequestPending ? (
                  <button
                    type="button"
                    disabled
                    className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-500 border border-slate-700 font-bold text-xs cursor-not-allowed shrink-0"
                    title="La solicitud de apertura de OT ya fue enviada a Jorge Sentis y está registrada en la base de datos."
                  >
                    Solicitud enviada (1)
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => onRequestOt && onRequestOt(shipId, contractorGroup)}
                    className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-xs animate-pulse shadow-md cursor-pointer flex items-center gap-1.5 shrink-0"
                    title="Clic para solicitar formalmente a Jorge Sentis la apertura de una nueva OT para este contratista."
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                    <span>Solicitar Apertura de OT a Admin</span>
                  </button>
                )}
              </div>
            )}

            {/* Fecha del Retiro */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
              <div>
                <label className="block text-slate-300 font-semibold mb-1">Fecha del Retiro</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-slate-300 font-semibold mb-1">Observaciones Generales</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Retiro para reparación de mamparo en bodega de popa..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          {/* RENGLONES DINÁMICOS DE MATERIALES */}
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
                let autoCostCenter = 'CLIENTE'
                if (mat?.category === 'CONSUMIBLES' || mat?.category === 'ELEM.SEGURIDAD') {
                  autoCostCenter = 'CLIENTE'
                }
                const weightRow = ((Number(mat?.weight_kg) || 0) * (Number(item.quantity) || 1)).toFixed(2)

                return (
                  <div
                    key={idx}
                    className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center gap-3"
                  >
                    <span className="text-slate-500 font-mono text-xs w-5 shrink-0 text-center">#{idx + 1}</span>

                    {/* Buscador inteligente de material */}
                    <div className="flex-1 w-full min-w-[240px]">
                      <MaterialSearchInput
                        materials={materials}
                        value={item.material_id}
                        onChange={(mId) => handleItemChange(idx, 'material_id', mId)}
                      />
                    </div>

                    {/* Cantidad */}
                    <div className="w-24 shrink-0">
                      <input
                        type="number"
                        min="0.1"
                        step="any"
                        placeholder="Cant."
                        value={item.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        required
                        className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-white font-mono text-center font-bold focus:outline-none focus:border-cyan-400"
                      />
                      <span className="text-[10px] text-slate-500 block text-center truncate">
                        {mat?.unit_measure || 'un.'}
                      </span>
                    </div>

                    {/* Peso Total Calculado */}
                    <div className="w-24 shrink-0 text-center font-mono text-slate-400 text-xs">
                      <span className="block font-bold text-slate-200">{weightRow} kg</span>
                      <span className="text-[9px] text-slate-500">({mat?.weight_kg || 0} c/u)</span>
                    </div>

                    {/* Centro de Costo Deducido */}
                    <div className="w-28 shrink-0">
                      <select
                        value={item.customCostCenter || autoCostCenter}
                        disabled={!isAdmin}
                        onChange={(e) => handleItemChange(idx, 'customCostCenter', e.target.value)}
                        className={`w-full px-2 py-1.5 rounded text-[11px] font-bold border ${
                          !isAdmin
                            ? 'bg-slate-950 border-slate-800 text-cyan-400 opacity-90 cursor-not-allowed'
                            : 'bg-slate-950 border-cyan-500 text-cyan-300'
                        }`}
                        title={!isAdmin ? 'Deducido automáticamente (Solo Admin puede modificar)' : 'Centro de Costo'}
                      >
                        <option value="CLIENTE">CLIENTE</option>
                        <option value="CONTRATISTA">CONTRATISTA</option>
                      </select>
                    </div>

                    {/* Botón Eliminar Renglón */}
                    <button
                      type="button"
                      disabled={items.length <= 1}
                      onClick={() => handleRemoveItem(idx)}
                      className={`p-1.5 rounded hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 transition-colors shrink-0 ${
                        items.length <= 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                      }`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pie del Formulario */}
          <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-600/30 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{editingRow ? 'Guardar Cambios' : `Confirmar Retiro (${items.length} materiales)`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// SUBCOMPONENTE: BUSCADOR INTELIGENTE DE MATERIALES (COMBOBOX PREDICTIVO)
// ==============================================================================
function MaterialSearchInput({ materials, value, onChange }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const selectedMat = useMemo(() => materials.find((m) => m.id === value), [materials, value])

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

      {/* MODAL 8: SOLICITAR HABILITACIÓN DE OPERARIO A JORGE SENTIS */}
      {workerPermissionModal.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
                <UserCheck className="w-5 h-5" />
                <span>Solicitar Habilitación de Operario a Jorge Sentis</span>
              </div>
              <button
                type="button"
                onClick={() => setWorkerPermissionModal({ isOpen: false, workerId: '', reason: '' })}
                className="text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              El operario seleccionado no cuenta actualmente con el permiso de retiro de materiales en Pañol (<strong>P</strong>).
              Al enviar esta solicitud, <strong>Jorge Sentis (Administrador)</strong> podrá habilitarlo formalmente en el Padrón de Personal.
            </p>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Operario sin Permiso</label>
                <select
                  value={workerPermissionModal.workerId}
                  onChange={(e) => setWorkerPermissionModal((prev) => ({ ...prev, workerId: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-cyan-400 font-bold focus:outline-none focus:border-cyan-400"
                >
                  <option value="">-- Seleccionar Operario a Habilitar --</option>
                  {unauthorizedWorkers.map((w) => (
                    <option key={`unauth_${w.id}`} value={w.id}>
                      {w.name} ({w.trade || 'General'} - {w.admin_center || 'Astillero'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-300 mb-1">Motivo / Justificación</label>
                <textarea
                  rows={3}
                  value={workerPermissionModal.reason}
                  onChange={(e) => setWorkerPermissionModal((prev) => ({ ...prev, reason: e.target.value }))}
                  placeholder="Ej: Asignado a tareas urgentes en dique, requiere retirar insumos de trabajo y EPP..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setWorkerPermissionModal({ isOpen: false, workerId: '', reason: '' })}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSubmitWorkerPermission}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Enviar Solicitud a Jorge Sentis</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ==============================================================================
// SUBCOMPONENTE: MODAL DE PEDIDO DE COMPRA RÁPIDO (ACCIÓN 2 CON SELECTOR DE URGENCIA)
// ==============================================================================
function QuickPurchaseModal({ material, initialQuantity, initialUrgency = 'SIN_APURO', onClose, onConfirm }) {
  const [quantity, setQuantity] = useState(initialQuantity || '')
  const [urgency, setUrgency] = useState(initialUrgency || 'SIN_APURO')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onConfirm({ material, quantity, urgency })
    } catch {
      // En caso de error, el toast ya se mostró en handleCreateDirectPurchaseOrder
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden font-sans flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2 text-cyan-300 font-black text-sm">
            <ShoppingCart className="w-5 h-5 text-cyan-400" />
            <span>PEDIDO DIRECTO A COMPRAS</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Material Solicitado</div>
            <div className="font-black text-white text-sm">{material?.name || 'Insumo'}</div>
            <div className="flex items-center justify-between text-slate-400 text-[11px] pt-1 border-t border-slate-800/80">
              <span>Rubro: <strong className="text-slate-200">{material?.rubro || 'General'}</strong></span>
              <span>Stock actual: <strong className="text-emerald-400">{material?.current_stock || 0} {material?.unit_measure || 'un.'}</strong></span>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Cantidad a Pedir <span className="text-slate-500 text-[10px]">(puede quedar en blanco)</span>
            </label>
            <input
              type="number"
              min="0.1"
              step="any"
              autoFocus
              placeholder="Ej: 10 (por defecto 1)"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-base font-bold focus:outline-none focus:border-cyan-400"
            />
          </div>

          {/* Selector de Urgencia */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">
              Urgencia del Pedido en Compras <span className="text-cyan-400">*</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setUrgency('SIN_APURO')}
                className={`py-2 px-2 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                  urgency === 'SIN_APURO'
                    ? 'bg-emerald-950/80 border-emerald-400 text-emerald-300 ring-2 ring-emerald-500/50 shadow-md shadow-emerald-900/30'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🟢 Sin Apuro
              </button>
              <button
                type="button"
                onClick={() => setUrgency('URGENTE')}
                className={`py-2 px-2 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                  urgency === 'URGENTE'
                    ? 'bg-amber-950/80 border-amber-400 text-amber-300 ring-2 ring-amber-500/50 shadow-md shadow-amber-900/30'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🟡 Urgente
              </button>
              <button
                type="button"
                onClick={() => setUrgency('PROXIMA_SALIDA')}
                className={`py-2 px-2 rounded-xl border text-center font-bold text-xs transition-all cursor-pointer ${
                  urgency === 'PROXIMA_SALIDA'
                    ? 'bg-rose-950/80 border-rose-400 text-rose-300 ring-2 ring-rose-500/50 shadow-md shadow-rose-900/30'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                🔴 Próx. Salida
              </button>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-500/30 text-[11px] space-y-1 text-slate-300">
            <div className="font-bold text-cyan-300 flex items-center gap-1.5">
              <Check className="w-3.5 h-3.5 text-cyan-400" />
              <span>Datos automáticos precargados en Compras:</span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-[10px] pt-1 text-slate-400 font-mono">
              <div>• Destino: <strong className="text-slate-200">PAÑOL</strong></div>
              <div>• Buque: <strong className="text-slate-200">ASTILLERO / STOCK</strong></div>
              <div>• Solicitante: <strong className="text-slate-200">PAÑOL</strong></div>
              <div>• Estado: <strong className="text-cyan-300 font-bold">PEDIR</strong></div>
              <div>• Fecha: <strong className="text-slate-200">{today}</strong></div>
              <div>• Urgencia: <strong className={urgency === 'PROXIMA_SALIDA' ? 'text-rose-400 font-bold' : urgency === 'URGENTE' ? 'text-amber-400 font-bold' : 'text-emerald-400 font-bold'}>{urgency}</strong></div>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-300 font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-cyan-600/30 flex items-center gap-1.5 transition-all"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  <span>Enviando a Compras...</span>
                </>
              ) : (
                <>
                  <ShoppingCart className="w-4 h-4 stroke-[3]" />
                  <span>Pedir a Compras</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// SUBCOMPONENTE: MODAL ALTA FORMAL DE MATERIAL
// ==============================================================================
function NewMaterialModal({ rubros, isAdmin, onClose, onSave }) {
  const [name, setName] = useState('')
  const [rubro, setRubro] = useState('')
  const [category, setCategory] = useState('CONSUMIBLES')
  const [unitMeasure, setUnitMeasure] = useState('Unidad')
  const [weightKg, setWeightKg] = useState(0)
  const [requiresStockControl, setRequiresStockControl] = useState(true)
  const [currentStock, setCurrentStock] = useState(0)
  const [minimumStock, setMinimumStock] = useState(0)
  const [securityFactor, setSecurityFactor] = useState(1.06)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return alert('El nombre del material es obligatorio.')

    onSave({
      name: name.trim().toUpperCase(),
      rubro: rubro || 'GENERAL',
      category,
      unit_measure: unitMeasure,
      weight_kg: Number(weightKg) || 0,
      requires_stock_control: requiresStockControl,
      current_stock: Number(currentStock) || 0,
      minimum_stock: Number(minimumStock) || 0,
      security_factor: Number(securityFactor) || 1.06
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden font-sans">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/50">
          <div className="flex items-center gap-2 text-white font-black text-sm">
            <Package className="w-5 h-5 text-emerald-400" />
            <span>ALTA DE MATERIAL EN CATÁLOGO B.D</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nombre Técnico Oficial *</label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: CHAPA NAVAL GRADO A 1/2' x 1500 x 6000..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold uppercase focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Categoría General *</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold focus:outline-none focus:border-cyan-400"
              >
                <option value="MATERIALES">MATERIALES</option>
                <option value="CONSUMIBLES">CONSUMIBLES</option>
                <option value="ELEM.SEGURIDAD">ELEM.SEGURIDAD</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Rubro Técnico *</label>
              <select
                value={rubro}
                onChange={(e) => setRubro(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="">Seleccionar Rubro...</option>
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
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="Unidad">Unidad</option>
                <option value="kg">Kilogramo (kg)</option>
                <option value="metro">Metro lineal</option>
                <option value="m2">Metro cuadrado (m2)</option>
                <option value="Litro">Litro</option>
                <option value="Bolsón">Bolsón</option>
                <option value="Tubo">Tubo / Cilindro</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Peso Unitario (kg)</label>
              <input
                type="number"
                min="0"
                step="any"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Stock Inicial</label>
              <input
                type="number"
                min="0"
                step="any"
                value={currentStock}
                onChange={(e) => setCurrentStock(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Stock Mínimo de Alerta</label>
              <input
                type="number"
                min="0"
                step="any"
                value={minimumStock}
                onChange={(e) => setMinimumStock(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">% Seguridad Naval</label>
              <select
                disabled={!isAdmin}
                value={securityFactor}
                onChange={(e) => setSecurityFactor(e.target.value)}
                className={`w-full px-3 py-2 rounded-lg border ${
                  !isAdmin ? 'bg-slate-950 border-slate-800 text-slate-500' : 'bg-slate-950 border-slate-700 text-white'
                }`}
              >
                <option value="1.02">2% (1.02)</option>
                <option value="1.06">6% (1.06 Estándar)</option>
                <option value="1.10">10% (1.10)</option>
                <option value="1.15">15% (1.15)</option>
                <option value="1.20">20% (1.20)</option>
              </select>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <span className="font-bold text-white block">Lleva Control de Stock Físico</span>
              <span className="text-slate-500 text-[10px]">Desmarcar si es compra eventual que no se inventaría</span>
            </div>
            <input
              type="checkbox"
              checked={requiresStockControl}
              onChange={(e) => setRequiresStockControl(e.target.checked)}
              className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-emerald-600/30"
            >
              Guardar Material
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// SUBCOMPONENTE: AJUSTE DE STOCK FÍSICO
// ==============================================================================
function StockAdjustModal({ material, onClose, onSave }) {
  const [newStock, setNewStock] = useState(material?.current_stock || 0)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(material.id, 'current_stock', newStock)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 text-xs font-sans">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-bold text-white uppercase">Ajuste de Stock Físico</span>
          <button onClick={onClose} className="text-slate-500 hover:text-white">✕</button>
        </div>

        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
          <span className="font-bold text-white block truncate">{material?.name}</span>
          <span className="text-[10px] text-slate-500">Stock Actual en Sistema: {material?.current_stock} {material?.unit_measure}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nuevo Recuento Físico</label>
            <input
              type="number"
              step="any"
              autoFocus
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-base font-bold focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black cursor-pointer shadow"
            >
              Confirmar Ajuste
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// SUBCOMPONENTE: MOVIMIENTO DE GASES Y CILINDROS
// ==============================================================================
function GasMovementModal({ operationType, materials, suppliers, ships, workOrders, workers, onClose, onSave }) {
  const [opType, setOpType] = useState(operationType || 'PRIMERA_ENTREGA')
  const [materialId, setMaterialId] = useState('')
  const [shipId, setShipId] = useState('')
  const [contractorName, setContractorName] = useState('')
  const [supplierDeliveredId, setSupplierDeliveredId] = useState('')
  const [supplierReturnedId, setSupplierReturnedId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!materialId) return alert('Debes seleccionar un tipo de gas.')
    if (!contractorName) return alert('Debes seleccionar un contratista.')

    onSave({
      operation_type: opType,
      material_id: materialId,
      ship_id: shipId || null,
      contractor_name: contractorName,
      supplier_delivered_id: supplierDeliveredId || null,
      supplier_returned_id: supplierReturnedId || null,
      quantity: Number(quantity) || 1,
      notes
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 text-xs font-sans">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 text-white font-black">
            <Flame className="w-5 h-5 text-amber-400" />
            <span>MOVIMIENTO DE TUBOS DE GAS</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Tipo de Operación Canónica</label>
            <select
              value={opType}
              onChange={(e) => setOpType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-amber-400 font-bold focus:outline-none focus:border-cyan-400"
            >
              <option value="PRIMERA_ENTREGA">1. Primera Entrega (+1 deuda contratista, -1 lleno pañol)</option>
              <option value="RECAMBIO_1X1">2. Recambio 1x1 con Cruce (+1 vacío marca A, -1 lleno marca B)</option>
              <option value="DEVOLUCION_FINAL">3. Devolución Final (-1 deuda contratista, +1 vacío pañol)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Gas / Tubo</label>
              <select
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="">Seleccionar Gas...</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Contratista</label>
              <input
                type="text"
                required
                placeholder="Ej: TANO, BOLTRI..."
                value={contractorName}
                onChange={(e) => setContractorName(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white uppercase focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Proveedor Marca Entregada</label>
              <select
                value={supplierDeliveredId}
                onChange={(e) => setSupplierDeliveredId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="">Seleccionar Marca...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Proveedor Marca Devuelta</label>
              <select
                value={supplierReturnedId}
                onChange={(e) => setSupplierReturnedId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="">Seleccionar Marca...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Buque / Destino</label>
              <select
                value={shipId}
                onChange={(e) => setShipId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="">(Sin Barco / Astillero)</option>
                {ships.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Cantidad de Tubos</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Observaciones / Trazabilidad</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Tubo de acetileno entregado para corte en grada..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black cursor-pointer shadow-lg shadow-amber-600/30"
            >
              Guardar Movimiento
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}