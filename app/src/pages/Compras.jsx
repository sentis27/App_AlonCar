import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSpreadsheetGrid } from '../hooks/useSpreadsheetGrid'
import {
  XCircle,
  Split,
  Camera,
  CornerDownRight,
  Bell,
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
  RotateCw,
  FileCheck,
  CheckSquare,
  Square,
  HelpCircle,
  Truck,
  Flame,
  ArrowRight,
  List,
  LayoutGrid,
  Image as ImageIcon,
  Tag,
  Lock,
  UserCheck,
  AlertCircle,
  Upload,
  Save,
  Navigation,
  Copy,
  Lightbulb,
  Zap
} from 'lucide-react'
import { extractTextFromPdf } from '../lib/pdfTextExtractor'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import ShipWorkOrderPickerModal from '../components/ShipWorkOrderPickerModal'

// Regla de Negocio: Para que una compra se cargue directamente a costo: destino=DIRECTO y estado=RECIB.COMP.DIRECT.
// Alerta Incoherencias si buque ≠ Astillero y:
// 1) estado=RECIB.COMP.DIRECT y destino ≠ DIRECTO
// 2) destino=DIRECTO y estado en (RECIBIDO, RECIBIDO 2)
// 3) destino=DIRECTO sin buque de obra específico
export function isCostAuditError(po, ships = []) {
  if (!po) return false
  const astShip = ships.find((s) => (s.name || '').toUpperCase().includes('ASTILLERO'))
  const isAstilleroOrEmpty = !po.ship_id || (astShip && po.ship_id === astShip.id)
  const isSpecificShip = !isAstilleroOrEmpty
  const isDirect = po.charge_type === 'DIRECT'
  const status = po.status || ''

  // Infracción 1: Destino DIRECTO pero sin Buque de obra específico
  if (isDirect && isAstilleroOrEmpty) return true

  // Infracción 2: Buque de obra específico con RECIB.COMP.DIRECT pero destino NO es DIRECTO
  if (isSpecificShip && status === 'RECIB.COMP.DIRECT' && !isDirect) return true

  // Infracción 3: Buque de obra específico con destino DIRECTO pero recibido como Pañol/Cliente (RECIBIDO o RECIBIDO 2) omitiendo la imputación directa
  if (isSpecificShip && isDirect && (status === 'RECIBIDO' || status === 'RECIBIDO 2')) return true

  return false
}

// Estados válidos según GS-006 (Ordenados según especificación operativa, texto corto visible y leyenda en tooltip)
const STATUS_OPTIONS = [
  { value: 'TODOS', label: 'Todos los Estados', tooltip: 'Mostrar todos los estados', textColor: 'text-slate-300' },
  { value: 'PEDIR', label: 'PEDIR', tooltip: 'Por Emitir', color: 'bg-amber-500/20 text-amber-300 border-amber-500/40', textColor: 'text-amber-400' },
  { value: 'PEDIDO', label: 'PEDIDO', tooltip: 'Emitido a Prov.', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40', textColor: 'text-blue-400' },
  { value: 'COTIZAR', label: 'COTIZAR', tooltip: 'A Pedir Precio', color: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40', textColor: 'text-indigo-400' },
  { value: 'COTIZA.SOLICITUD', label: 'COTIZA.SOLICITUD', tooltip: 'Esperando', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40', textColor: 'text-yellow-300' },
  { value: 'COTIZACION', label: 'COTIZACION', tooltip: 'En Evaluación', color: 'bg-purple-500/20 text-purple-300 border-purple-500/40', textColor: 'text-purple-400' },
  { value: 'COTIZA.APROBADA', label: 'COTIZA.APROBADA', tooltip: 'Aprobada', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', textColor: 'text-emerald-400' },
  { value: 'COTIZA.RECHAZADA', label: 'COTIZA.RECHAZADA', tooltip: 'Rechazada', color: 'bg-rose-500/20 text-rose-300 border-rose-500/40', textColor: 'text-rose-400' },
  { value: 'RECIBIDO', label: 'RECIBIDO', tooltip: 'Ingresó a Pañol', color: 'bg-emerald-500/30 text-emerald-200 border-emerald-400/50', textColor: 'text-emerald-400' },
  { value: 'RECIB.COMP.DIRECT', label: 'RECIB.COMP.DIRECT', tooltip: 'Imputado a Buque', color: 'bg-cyan-500/30 text-cyan-200 border-cyan-400/50', textColor: 'text-cyan-400' },
  { value: 'RECIBIDO 2', label: 'RECIBIDO 2', tooltip: 'Material de Cliente', color: 'bg-slate-500/20 text-slate-300 border-slate-500/40', textColor: 'text-slate-300' },
  { value: 'PEDIDO INCOMPLETO', label: 'PEDIDO INCOMPLETO', tooltip: 'Parcial', color: 'bg-orange-500/20 text-orange-300 border-orange-500/40', textColor: 'text-orange-400' },
  { value: 'SE COMPRA?', label: 'SE COMPRA?', tooltip: 'Duda', color: 'bg-pink-500/20 text-pink-300 border-pink-500/40', textColor: 'text-pink-400' },
  { value: 'CANCELADOS', label: 'CANCELADOS', tooltip: 'Orden cancelada', color: 'bg-red-500/20 text-red-400 border-red-500/40', textColor: 'text-rose-500' },
  { value: 'NO VENDEN', label: 'NO VENDEN', tooltip: 'Proveedor no comercializa el ítem', color: 'bg-slate-700/50 text-slate-400 border-slate-600', textColor: 'text-slate-500' }
]

// Lista estándar de rubros de proveedores para combobox
const STANDARD_TRADES = [
  'FERRETERIA',
  'GASES',
  'TORNERIA',
  'PINTURA',
  'METALES',
  'CALDERERIA',
  'ELECTRICIDAD',
  'SERVICIOS',
  'BULONERIA',
  'MADERA',
  'HIDRAULICA',
  'CORTE/PLEGADO',
  'MECANICA',
  'SEGURIDAD',
  'LUBRICANTES'
]

// Lista oficial de Rubros de Materiales para B.D. Maestra (Se vinculará a tabla de rubros en Módulo Pañol)
const CATALOG_RUBROS = [
  'ABRAZADERA',
  'ACC. ALBAÑILERIA',
  'ACC. CINTAS PESCA',
  'ACC. HIDRAULICA',
  'ACC. PINTURA',
  'ACCESORIOS',
  'ACEITES',
  'ACOPLE/ADAPTADOR',
  'ALBAÑILERIA',
  'ANGULOS',
  'ARANDELAS',
  'BOMBAS',
  'BRIDAS',
  'BRONCE',
  'BUJE',
  'BULONES',
  'BURLETES',
  'CADENAS',
  'CAÑO',
  'CAÑO COBRE',
  'CAÑO INOX',
  'CAÑO PVC',
  'CHAPAS',
  'ELECTRICIDAD',
  'ELECTRODOS',
  'ELEM. SEGURIDAD',
  'EQUIPO ESPECIAL',
  'FABRICACION',
  'GASES',
  'GRIFERIA',
  'HERRAJES',
  'HERRAMIENTAS',
  'INS.MECANICA',
  'JUNTAS',
  'LIMPIEZA',
  'MACIZO',
  'MADERA',
  'MATERIALES',
  'MOTOR',
  'OTROS',
  'PEGAMENTO',
  'PERFILES ALUMINIO',
  'PINTURA',
  'REDUCCION',
  'RODAMIENTOS',
  'SOLDADURA',
  'TERMOFUSION',
  'TORNERIA',
  'VIDRIOS'
]

// Unidades de medida oficiales del sistema
const OFFICIAL_UNITS = [
  { value: 'unidad', label: 'Unidad (un.)' },
  { value: 'm2', label: 'm2 (Lado x Lado / Área)' },
  { value: 'metro lineal', label: 'Metro Lineal (m)' },
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'm3', label: 'Metros Cúbicos (m3)' },
  { value: 'Litros', label: 'Litros (L)' },
  { value: 'Caja', label: 'Caja' },
  { value: 'Bolsón', label: 'Bolsón' },
  { value: 'Rollo', label: 'Rollo' },
  { value: 'Barra', label: 'Barra' },
  { value: 'Chapa', label: 'Chapa' },
  { value: 'Tubo', label: 'Tubo' },
  { value: 'Pieza', label: 'Pieza' }
]

// Porcentajes de seguridad (Merma / Buffer Naval según módulo Pañol)
const SECURITY_FACTORS = [
  { value: 1.02, label: '2% (Factor 1.02)' },
  { value: 1.06, label: '6% — Predeterminado (Factor 1.06)' },
  { value: 1.10, label: '10% (Factor 1.10)' },
  { value: 1.15, label: '15% (Factor 1.15)' },
  { value: 1.20, label: '20% (Factor 1.20)' },
  { value: 1.30, label: '30% (Factor 1.30)' }
]

// Función obligatoria de deducción estricta de unidad de medida por texto
export function deduceUnitMeasure(materialName = '') {
  const text = materialName.toLowerCase()
  if (text.includes('lado x lado')) return 'm2'
  if (text.includes('x metro lineal') || text.includes('x metro') || text.includes('metro lineal')) return 'metro lineal'
  if (text.includes('x kg') || text.includes('x kilo') || text.includes('kilo')) return 'kg'
  if (text.includes('x m3') || text.includes('metro cubico')) return 'm3'
  return 'unidad'
}

// Normalizador de teléfono argentino a formato WhatsApp internacional limpio (+54 9 [Área sin 0] [Número sin 15])
export function formatArgPhoneForWhatsApp(phoneStr = '') {
  if (!phoneStr) return ''
  const digits = phoneStr.replace(/[^0-9]/g, '')
  if (digits.startsWith('0810') || digits.startsWith('0800')) return digits // Línea fija no WhatsApp

  if (digits.startsWith('549')) return digits
  if (digits.startsWith('54')) {
    // Si empieza con 54 pero le falta el 9 móvil
    return '549' + digits.slice(2)
  }
  // Si empieza con 0 (ej 02234810922) -> quitar 0
  let clean = digits.startsWith('0') ? digits.slice(1) : digits
  // Si contiene 15 en medio después de código de área (ej 223 15 4810922) -> quitar 15
  if (clean.length === 11 && clean.slice(3, 5) === '15') {
    clean = clean.slice(0, 3) + clean.slice(5)
  }
  return '549' + clean
}

export default function Compras() {
  const { profile, user } = useAuth()
  const isSupervisorOrAdmin = profile?.role === 'Supervisor' || profile?.role === 'Gerencia' || profile?.role === 'Admin'

  // Modo de visualización: Simple (Solicitud Operativa) vs Completa (Gestión de Compras)
  // Por defecto, si el usuario no es supervisor/admin, arranca en modo Simple
  const [viewMode, setViewMode] = useState(isSupervisorOrAdmin ? 'completa' : 'simple')

  // Pestañas
  const [activeTab, setActiveTab] = useState('compras') // 'compras', 'proveedores', 'documentos'
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState(null)

  // Vistas alternativas dentro de pestañas
  const [suppliersViewMode, setSuppliersViewMode] = useState('lista') // 'lista' | 'fichas'
  const [docsViewMode, setDocsViewMode] = useState('lista') // 'lista' | 'fichas'

  // Datos desde Supabase
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [materials, setMaterials] = useState([])
  const [ships, setShips] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [workItems, setWorkItems] = useState([])
  const [workers, setWorkers] = useState([])
  const [macroVariables, setMacroVariables] = useState([])
  const [documents, setDocuments] = useState([])
  const [systemSettings, setSystemSettings] = useState(null)

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)
  const [filterSupplier, setFilterSupplier] = useState('TODOS')
  const [filterStatus, setFilterStatus] = useState('TODOS')
  const [filterFortnight, setFilterFortnight] = useState('TODAS')
  const [filterChargeType, setFilterChargeType] = useState('TODOS') // 'TODOS', 'DIRECT', 'VIA_PANOL'
  const [filterNewOnly, setFilterNewOnly] = useState(false)
  const [hideReconciled, setHideReconciled] = useState(false)
  const [activeKpiFilter, setActiveKpiFilter] = useState(null) // 'pedidos' | 'cotizaciones' | 'sin_recibir' | 'gases'

  // Filtros propios de Proveedores
  const [supplierKpiFilter, setSupplierKpiFilter] = useState('TODOS') // 'TODOS', 'NO_PHONE', 'NO_EMAIL', 'NO_TRADE', 'GASES'

  // Selección de filas (para totales y acciones en lote)
  const [selectedOrderIds, setSelectedOrderIds] = useState(new Set())

  const [shipPickerModal, setShipPickerModal] = useState({
    isOpen: false,
    orderId: null,
    shipId: '',
    workOrderId: '',
    chargeType: 'DIRECT',
    contractorName: ''
  })

    // Modales
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)

  const [showNewMaterialModal, setShowNewMaterialModal] = useState(false)
  const [pendingMaterialOrder, setPendingMaterialOrder] = useState(null)

  const [showDocModal, setShowDocModal] = useState(false)
  const [docTargetOrder, setDocTargetOrder] = useState(null)

  const [showDocActionModal, setShowDocActionModal] = useState(false)
  const [selectedDocAction, setSelectedDocAction] = useState(null)
  const [inlineEdit, setInlineEdit] = useState({ orderId: null, field: null, value: '' })
  const [showOrderDocsModal, setShowOrderDocsModal] = useState(false)
  const [selectedOrderForDocs, setSelectedOrderForDocs] = useState(null)
  const [showPartialModal, setShowPartialModal] = useState(false)
  const [partialDeliveryOrder, setPartialDeliveryOrder] = useState(null)
  const [showSeCompraModal, setShowSeCompraModal] = useState(false)
  const [seCompraAlertOrder, setSeCompraAlertOrder] = useState(null)
  const [showAssignSupplierModal, setShowAssignSupplierModal] = useState(false)
  const [seCompraAlertSettings, setSeCompraAlertSettings] = useState(null) // Para editar/reemplazar/eliminar doc

  const [showReconcileModal, setShowReconcileModal] = useState(false)
  const [reconcileTarget, setReconcileTarget] = useState(null)

  const [showFreightModal, setShowFreightModal] = useState(false)
  const [freightTargetOrder, setFreightTargetOrder] = useState(null)

  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)

  const [showBatchOrderModal, setShowBatchOrderModal] = useState(false)
  // Modales de Asistente de Proveedor y Despacho de Mandados
  const [showSupplierHelperModal, setShowSupplierHelperModal] = useState(false)
  const [supplierHelperTarget, setSupplierHelperTarget] = useState(null)
  const [showMandadosModal, setShowMandadosModal] = useState(false)
  const [mandadosPreselectedIds, setMandadosPreselectedIds] = useState([])

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
      const [poRes, supRes, matRes, shpRes, woRes, wiRes, wkrRes, mvRes, docRes, setRes] = await Promise.all([
        supabase.from('purchase_orders').select('*').order('order_date', { ascending: false }).order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('materials').select('*').order('name'),
        supabase.from('ships').select('id, name, vessel_type').order('name'),
        supabase.from('work_orders').select('id, ot_number, title, description, ship_id, status').order('ot_number'),
        supabase.from('work_items').select('id, work_order_id, contractors, description'),
        supabase.from('workers').select('id, name, trade, can_withdraw_materials, phone').order('name'),
        supabase.from('macro_variables').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
        supabase.from('purchase_documents').select('*').order('created_at', { ascending: false }),
        supabase.from('system_settings').select('*').eq('key', 'compras_whatsapp').maybeSingle()
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
      setWorkItems(wiRes?.data || [])
      setWorkers(wkrRes.data || [])
      setMacroVariables(mvRes.data || [])
      setDocuments(docRes.data || [])
      setSystemSettings(setRes.data?.value || null)
    } catch (err) {
      console.error('Error cargando Compras:', err)
      showFeedbackMsg('error', 'Error al sincronizar datos de Compras: ' + (err.message || err))
    } finally {
      setLoading(false)
    }
  }

  // Cotización del dólar quincenal oficial
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

  // KPIs superiores agrupados con soporte de sub-estados
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

  // Aplicar proveedor sugerido desde el Asistente Inteligente con soporte de Ctrl+Z
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
      showFeedbackMsg('success', `Proveedor "${supName}" y condiciones asignadas con éxito. (Ctrl+Z para deshacer)`)
      setShowSupplierHelperModal(false)
      setSupplierHelperTarget(null)
    } catch (err) {
      console.error('Error aplicando asistente de proveedor:', err)
      showFeedbackMsg('error', 'Error al asignar proveedor: ' + err.message)
    }
  }

  // Limpiar todos los filtros (Botón Global)
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

  // Comprobar si hay filtros activos para alerta visual
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

  // Toggle interactivo de KPI como filtro (Grupos y Subgrupos)
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
      // Texto de búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const mat = (po.material_name_raw || '').toLowerCase()
        const obs = (po.observations || '').toLowerCase()
        const req = (po.requested_by_name || '').toLowerCase()
        const inv = (po.invoice_number || '').toLowerCase()
        const rem = (po.remito_number || '').toLowerCase()
        const trn = (po.freight_transport_name || '').toLowerCase()
        const sup = suppliers.find((s) => s.id === po.supplier_id)?.name.toLowerCase() || ''
        const shp = ships.find((s) => s.id === po.ship_id)?.name.toLowerCase() || ''

        // Búsqueda en adjuntos (Nivel 1: metadatos + Nivel 2: texto digital PDF extraído sin IA)
        const orderDocs = documents.filter((d) => d.purchase_order_id === po.id || (d.work_order_id && d.work_order_id === po.work_order_id))
        const docMatches = orderDocs.some((d) => {
          const fn = (d.original_filename || '').toLowerCase()
          const ds = (d.description || '').toLowerCase()
          const dt = (d.doc_type || '').toLowerCase()
          const txt = (d.extracted_text || '').toLowerCase()
          return fn.includes(q) || ds.includes(q) || dt.includes(q) || txt.includes(q)
        })

        const matches = mat.includes(q) || obs.includes(q) || req.includes(q) || inv.includes(q) || rem.includes(q) || trn.includes(q) || sup.includes(q) || shp.includes(q) || docMatches
        if (!matches) return false
      }

      // Filtro KPI interactivo de Grupo
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

      // Filtro proveedor
      if (filterSupplier !== 'TODOS' && po.supplier_id !== filterSupplier) return false

      // Filtro estado
      if (filterStatus !== 'TODOS' && po.status !== filterStatus && !(filterStatus === 'PEDIR' && po.status === 'SOLICITUD')) return false

      // Filtro quincena
      if (filterFortnight !== 'TODAS' && po.fortnight_period !== filterFortnight) return false

      // Filtro tipo carga
      if (filterChargeType !== 'TODOS' && po.charge_type !== filterChargeType) return false

      // Solo nuevos sin registro
      if (filterNewOnly && (!po.is_new_material || po.no_catalog_required)) return false

      // Ocultar conciliados
      if (hideReconciled && po.is_reconciled) return false

      return true
    })
  }, [purchaseOrders, searchQuery, filterSupplier, filterStatus, filterFortnight, filterChargeType, filterNewOnly, hideReconciled, activeKpiFilter, suppliers, ships, documents])

  // Helper para calcular quincena YYYY-MM-Q1/Q2 desde una fecha YYYY-MM-DD
  const computeFortnightFromDate = useCallback((dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return currentFortnight
    const parts = dateStr.split('-')
    if (parts.length < 3) return currentFortnight
    const q = parseInt(parts[2], 10) <= 15 ? 'Q1' : 'Q2'
    return `${parts[0]}-${parts[1]}-${q}`
  }, [currentFortnight])

  // =========================================================================
  // HOJA DE CÁLCULO INTELIGENTE (ESTÁNDAR EXCEL / GOOGLE SHEETS)
  // Atajos: Ctrl+C, Ctrl+V, Ctrl+D, Ctrl+Z, Ctrl+Y, Ctrl+F, Flechas, Enter y Tirador ■
  // =========================================================================
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
        { key: 'supplier_quoted_price', label: '$/U Proveedor', readOnly: false },
        { key: 'system_unit_price', label: '$/U Sistema', readOnly: true }
      )
    }
    cols.push(
      { key: 'supplier_id', label: 'Proveedor', readOnly: false },
      { key: 'status', label: 'Estado', readOnly: false },
      { key: 'urgency', label: 'Urgencia', readOnly: false },
      { key: 'delivery_date', label: 'F. Entrega', readOnly: false }
    )
    return cols
  }, [viewMode, ships, workOrders])

  // Actualización batch para comandos de hoja de cálculo (Ctrl+D, Ctrl+V, Drag Fill, Ctrl+Z, Ctrl+Y)
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
        fetchData()
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
      } catch (err) {
        console.error('Error en batch update de compras:', err)
        showFeedbackMsg('error', 'Error al actualizar en lote: ' + err.message)
        fetchData()
      }
    }
  }, [fetchData, computeFortnightFromDate])

  // Activar edición de celda con doble clic o tecla Enter / F2
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
      setInlineEdit({ orderId: po.id, field: 'requested_by_name', value: po.requested_by_name || 'PAÑOL' })
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
  }, [suppliers])

  // Referencia para resolver circularidad de hook con pegado de filas
  const onPasteRowRef = useRef(null)

  // Hook central de Hoja de Cálculo
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

  // Helper para propiedades y eventos de celda spreadsheet
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

  // Guardar edición rápida inline (Doble Clic estilo Excel/Sheets)
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
      showFeedbackMsg('success', 'Campo actualizado correctamente.')
    } catch (err) {
      console.error('Error guardando edición rápida:', err)
      showFeedbackMsg('error', 'Error al guardar: ' + err.message)
      setPurchaseOrders((prev) =>
        prev.map((p) => (p.id === orderId ? targetOrder : p))
      )
    }
  }

  // Guardar simultáneamente material y observaciones desde el mini-editor in-situ de 2 renglones
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
      showFeedbackMsg('success', 'Material y observaciones guardados.')
    } catch (err) {
      console.error('Error guardando material y observaciones:', err)
      showFeedbackMsg('error', 'Error al guardar: ' + err.message)
      setPurchaseOrders((prev) =>
        prev.map((p) => (p.id === orderId ? targetOrder : p))
      )
    }
  }

  // Insertar un nuevo pedido rápido en blanco al final de la grilla (Imagen 2)
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
      charge_type: 'VIA_PANOL', // Destino por defecto = PAÑOL
      ship_id: astShip?.id || null, // Buque = Astillero / Stock por defecto
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

      // Reversión con Ctrl+Z elimina la fila recién creada
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

  // Duplicar pedido existente (clonar al final con fecha de hoy)
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

      showFeedbackMsg('success', `Pedido "${order.material_name_raw || 'S/D'}" duplicado al final con fecha de hoy.`)
    } catch (err) {
      console.error('Error duplicando pedido:', err)
      showFeedbackMsg('error', 'Error al duplicar pedido: ' + err.message)
    }
  }

  // Pegar fila completa copiada con Ctrl+C en otra fila de la grilla
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
      showFeedbackMsg('success', `Datos copiados en fila ${targetRow.material_name_raw || 'vacía'}.`)
    } catch (err) {
      console.error('Error al pegar fila:', err)
      showFeedbackMsg('error', 'Error al pegar fila: ' + err.message)
      setPurchaseOrders((prev) => prev.map((p) => (p.id === targetRow.id ? { ...p, ...previousValues } : p)))
    }
  }, [grid])

  // Asignar al ref para evitar dependencia circular
  useEffect(() => {
    onPasteRowRef.current = handlePasteRow
  }, [handlePasteRow])

  // Omitir / Descartar en bloque la necesidad de "Alta en Catálogo" para ítems seleccionados
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

  // Toggle rápido de urgencia
  async function handleCycleUrgency(orderId, currentUrgency) {
    const cycle = {
      'SIN_APURO': 'URGENTE',
      'URGENTE': 'PROXIMA_SALIDA',
      'PROXIMA_SALIDA': 'SIN_APURO'
    }
    const nextUrgency = cycle[currentUrgency] || 'SIN_APURO'
    await saveInlineEdit(orderId, 'urgency', nextUrgency)
  }

  // Cantidad de pedidos pendientes a retirar de proveedores locales
  const localPendingCount = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (!['PEDIDO', 'PEDIDO INCOMPLETO'].includes(po.status)) return false
      const sup = suppliers.find((s) => s.id === po.supplier_id)
      return Boolean(sup?.is_local_supplier)
    }).length
  }, [purchaseOrders, suppliers])

  // KPIs específicos de la pestaña Proveedores
  const supplierKpis = useMemo(() => {
    let noPhone = 0
    let noEmail = 0
    let noTrade = 0
    let gasesCount = 0

    suppliers.forEach((s) => {
      if (!s.phone || !s.phone.trim()) noPhone++
      if (!s.email || !s.email.trim()) noEmail++
      if ((!s.trades || s.trades.length === 0) && (!s.trade || !s.trade.trim())) noTrade++
      if (s.is_gas_supplier) gasesCount++
    })

    return {
      total: suppliers.length,
      noPhone,
      noEmail,
      noTrade,
      gasesCount
    }
  }, [suppliers])

  // Filtrado de proveedores
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (supplierKpiFilter === 'NO_PHONE' && s.phone && s.phone.trim()) return false
      if (supplierKpiFilter === 'NO_EMAIL' && s.email && s.email.trim()) return false
      if (supplierKpiFilter === 'NO_TRADE' && ((s.trades && s.trades.length > 0) || (s.trade && s.trade.trim()))) return false
      if (supplierKpiFilter === 'GASES' && !s.is_gas_supplier) return false
      return true
    })
  }, [suppliers, supplierKpiFilter])

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

  // Cambio rápido de estado con soporte para PEDIDO INCOMPLETO y SE COMPRA?
  async function handleQuickStatusChange(orderId, newStatus) {
    try {
      const order = purchaseOrders.find((p) => p.id === orderId)
      if (!order) return

      // Interceptor para PEDIDO INCOMPLETO -> Abre modal de recepción parcial
      if (newStatus === 'PEDIDO INCOMPLETO') {
        setPartialDeliveryOrder(order)
        setShowPartialModal(true)
        return
      }

      // Interceptor para SE COMPRA? -> Abre panel de alerta gerencial
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

      // Registrar en pila de deshacer (Ctrl+Z)
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

  return (
    <div className="space-y-4 pb-24">
      {/* ========================================================= */}
      {/* ZONA 1: CABECERA PRINCIPAL Y CONTEXTO DE MÓDULO */}
      {/* ========================================================= */}
      <div className="alon-zone-context flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-slate-950">
            <ShoppingCart className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
              MÓDULO DE COMPRAS
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 uppercase">
                {viewMode === 'simple' ? 'Modo Solicitud Simple' : 'Gestión Completa M4b'}
              </span>
            </h1>
            <p className="text-xs text-slate-400">
              {viewMode === 'simple'
                ? 'Panel simplificado para solicitud rápida de insumos de obra y pañol.'
                : 'Gestión integral de cotizaciones, proveedores, carga directa, stock y conciliación.'}
            </p>
          </div>
        </div>

        {/* Conmutador de Modo + Pestañas & Botón Cargar */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Conmutador de perfil/vista si es supervisor/admin */}
          {isSupervisorOrAdmin && (
            <button
              onClick={() => setViewMode(viewMode === 'simple' ? 'completa' : 'simple')}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Alternar entre Solicitud Simple y Gestión Completa"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>{viewMode === 'simple' ? 'Ver Modo Completo' : 'Ver Modo Simple'}</span>
            </button>
          )}

          {/* Pestañas solo visibles en modo completo */}
          {viewMode === 'completa' && (
            <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center text-xs">
              <button
                onClick={() => setActiveTab('compras')}
                className={`px-3 py-1.5 rounded-md font-semibold transition-all ${
                  activeTab === 'compras' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'
                }`}
              >
                📋 Registro
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
          )}

          <button
            onClick={() => {
              setEditingOrder(null)
              setShowOrderModal(true)
            }}
            className="flex items-center gap-2 px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg text-xs shadow-lg shadow-cyan-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>{viewMode === 'simple' ? 'Nueva Solicitud' : 'Cargar Pedido'}</span>
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
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA 1: REGISTRO DE COMPRAS (TAB PRINCIPAL) */}
      {/* ========================================================= */}
      {activeTab === 'compras' && (
        <>
          {/* ZONA 2: TARJETAS DE KPIs SUPERIORES (RADAR OPERATIVO 1-CLIC — COMPACTO Y COLORES ÚNICOS) */}
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
                  className="text-[10px] font-bold text-amber-300 hover:text-white bg-amber-500/20 border border-amber-500/40 px-2 py-0.5 rounded cursor-pointer"
                >
                  ✕ Quitar Filtro KPI
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
              {/* KPI 0: Falta Cargar OT — Color Único: NARANJA (Orange) */}
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
                    className={`px-1 py-0.5 rounded text-[9px] font-bold transition-colors ${
                      activeKpiFilter === 'sin_ot_obras' ? 'bg-orange-500 text-slate-950 font-black' : 'bg-orange-500/15 text-orange-200 hover:bg-orange-500/30'
                    }`}
                    title="Pedidos imputados a buque/obra sin OT vinculada"
                  >
                    🚢 {kpis.countSinOtObras}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleKpiFilter('sin_ot_stock'); }}
                    className={`px-1 py-0.5 rounded text-[9px] font-bold transition-colors ${
                      activeKpiFilter === 'sin_ot_stock' ? 'bg-orange-400 text-slate-950 font-black' : 'bg-orange-500/15 text-orange-200 hover:bg-orange-500/30'
                    }`}
                    title="Pedidos para Astillero / Stock general sin OT vinculada"
                  >
                    🏢 {kpis.countSinOtStock}
                  </button>
                </div>
              </div>

              {/* KPI 1: Por Emitir (PEDIR) — Color Único: ÁMBAR / DORADO (Amber) */}
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

              {/* KPI 2: Cotizaciones — Color Único: PÚRPURA / VIOLETA (Purple) */}
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
                    className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                      activeKpiFilter === 'COTIZAR' ? 'bg-indigo-500 text-white' : 'bg-purple-500/15 text-purple-200 hover:bg-purple-500/30'
                    }`}
                    title="COTIZAR (A Pedir Precio)"
                  >
                    COT:{kpis.countCotizar}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleKpiFilter('COTIZA.SOLICITUD'); }}
                    className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                      activeKpiFilter === 'COTIZA.SOLICITUD' ? 'bg-yellow-500 text-slate-950' : 'bg-purple-500/15 text-purple-200 hover:bg-purple-500/30'
                    }`}
                    title="COTIZA.SOLICITUD (Esperando)"
                  >
                    SOL:{kpis.countCotizaSol}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleKpiFilter('COTIZACION'); }}
                    className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                      activeKpiFilter === 'COTIZACION' ? 'bg-purple-400 text-slate-950' : 'bg-purple-500/15 text-purple-200 hover:bg-purple-500/30'
                    }`}
                    title="COTIZACION (En Evaluación)"
                  >
                    EV:{kpis.countCotizacion}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleKpiFilter('COTIZA.APROBADA'); }}
                    className={`px-1 py-0.2 rounded text-[8px] font-bold ${
                      activeKpiFilter === 'COTIZA.APROBADA' ? 'bg-emerald-500 text-slate-950' : 'bg-purple-500/15 text-purple-200 hover:bg-purple-500/30'
                    }`}
                    title="COTIZA.APROBADA (Aprobada)"
                  >
                    OK:{kpis.countCotizaAprob}
                  </button>
                </div>
              </div>

              {/* KPI 3: En Proveedor — Color Único: AZUL ELÉCTRICO (Blue) */}
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
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold transition-colors ${
                      activeKpiFilter === 'PEDIDO' ? 'bg-blue-500 text-slate-950 font-black' : 'bg-blue-500/15 text-blue-200 hover:bg-blue-500/30'
                    }`}
                  >
                    PED: {kpis.countPedido}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleKpiFilter('PEDIDO INCOMPLETO'); }}
                    className={`px-1.5 py-0.2 rounded text-[9px] font-bold transition-colors ${
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

              {/* KPI 4: SE COMPRA? — Color Único: FUCSIA / MAGENTA (Fuchsia) */}
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

              {/* KPI 5: Alta en Catálogo — Color Único: CARMÍN / ROJO (Rose) */}
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

              {/* KPI 6: Recibidos — Color Único: VERDE ESMERALDA (Emerald) */}
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
                    className={`px-1 py-0.2 rounded text-[8px] font-bold shrink-0 ${
                      activeKpiFilter === 'conciliados' ? 'bg-purple-500 text-white' : 'bg-purple-950 text-purple-300 hover:bg-purple-900'
                    }`}
                    title="Filtrar conciliados con factura"
                  >
                    🟣 {kpis.countConciliados}
                  </button>
                </div>
              </div>

                            {/* KPI 7: AUDITORÍA COSTO DIRECTO — Color Único: ROSE / CARMESÍ */}
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
                      7. AUDITORÍA COSTO DIRECTO
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

          {/* ZONA 3: BARRA DE FILTROS & HERRAMIENTAS */}
          <div className="alon-zone-toolbar p-2.5 flex flex-wrap items-center justify-between gap-2.5 text-xs">
            {/* Buscador con soporte Esc para limpiar filtros en 1 toque */}
            <div className="relative flex-1 min-w-[200px]">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar por material, proveedor, buque, solicitante, factura... (Ctrl+F | Esc limpia todo)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') {
                    e.preventDefault()
                    clearAllFilters()
                    e.target.blur()
                  }
                }}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-16 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <span className="absolute right-8 top-1.5 text-[10px] text-slate-500 border border-slate-800 rounded px-1 hidden sm:inline-block pointer-events-none">
                Ctrl+F
              </span>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="absolute right-3 top-2 text-slate-500 hover:text-white">✕</button>
              )}
            </div>

            {/* Selectores */}
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

            {/* Alternadores Rápidos */}
            <div className="flex items-center gap-1.5 border-l border-slate-800 pl-2.5">
              <button
                onClick={() => setFilterNewOnly(!filterNewOnly)}
                className={`px-2 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
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
                  className={`px-2 py-1 rounded-lg font-semibold transition-all flex items-center gap-1 ${
                    hideReconciled
                      ? 'bg-purple-950 border border-purple-500 text-purple-300'
                      : 'bg-slate-950 border border-slate-800 text-slate-400 hover:text-white'
                  }`}
                  title="Ocultar las compras que ya fueron conciliadas con factura"
                >
                  <span>🟣 Ocultar Conc.</span>
                </button>
              )}

              {/* Botón Deshacer (Ctrl+Z) / Rehacer (Ctrl+Y) */}
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

          {/* ========================================================= */}
          {/* ZONA 4: PLANILLA / HOJA DE CÁLCULO EDITABLE DE COMPRAS */}
          {/* ========================================================= */}
          <div className="alon-zone-grid">
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
              <div className="flex items-center gap-2 text-slate-500 font-mono text-[10px]">
                <span>Memoria Undo: {grid.undoStack?.length || 0}/50</span>
                <span>•</span>
                <span>{filteredOrders.length} filas</span>
              </div>
            </div>

            <datalist id="compras-materials-datalist">
              {materials.slice(0, 300).map((m) => (
                <option key={m.id} value={m.name} />
              ))}
            </datalist>
            <datalist id="compras-requesters-datalist">
              <option value="PAÑOL" />
              {workers.filter((w) => w.can_withdraw_materials).map((w) => (
                <option key={w.id} value={w.name} />
              ))}
            </datalist>

            <div
              tabIndex={0}
              onKeyDown={grid.handleKeyDown}
              ref={grid.gridContainerRef}
              className="w-full max-h-[620px] overflow-y-auto overflow-x-hidden relative focus:outline-none"
            >
              <table className="w-full text-left text-[11px] border-collapse">
                {/* STICKY HEADER TIPO EXCEL (FIT-TO-VIEWPORT SIN SCROLL HORIZONTAL) */}
                <thead className="sticky top-0 z-20 alon-grid-thead">
                  <tr>
                    <th className="py-2 px-1.5 w-7 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                        title={isAllFilteredSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
                      >
                        {isAllFilteredSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
                      </button>
                    </th>
                    <th className="py-2 px-1.5">Destino ✎</th>
                    <th className="py-2 px-1.5">Fecha / Q. ✎</th>
                    <th className="py-2 px-1.5">Buque / OT ✎</th>
                    <th className="py-2 px-1.5">Solicita ✎</th>
                    <th className="py-2 px-1.5">Material Solicitado ✎</th>
                    <th className="py-2 px-1.5 text-right">Cant. ✎</th>

                    {/* Columnas financieras visibles solo en Modo Completo */}
                    {viewMode === 'completa' && (
                      <>
                        <th className="py-2 px-1.5 text-right">$/U Prov. ✎</th>
                        <th className="py-2 px-1.5 text-right">$/U Sist.</th>
                      </>
                    )}

                    {/* Proveedor visible en AMBOS MODOS */}
                    <th className="py-2 px-1.5">Proveedor ✎</th>

                    {/* Estado compacto sin paréntesis */}
                    <th className="py-2 px-1.5">Estado ✎</th>

                    <th className="py-2 px-1.5">Urg. ✎</th>
                    <th className="py-2 px-1.5 text-center">Doc</th>
                    <th className="py-2 px-1.5 text-center" title="Fecha de entrega del pedido (independiente de la fecha de flete)">
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
                  {loading ? (
                    <tr>
                      <td colSpan={viewMode === 'completa' ? 16 : 13} className="text-center py-12 text-slate-500">
                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-cyan-400" />
                        Cargando registro de compras...
                      </td>
                    </tr>
                  ) : filteredOrders.length === 0 ? (
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
                      const lineDocs = documents.filter((d) => d.purchase_order_id === po.id)

                      // Diferencia de precio proveedor vs sistema
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
                          className={`group transition-colors ${
                            isSelected
                              ? 'bg-cyan-950/30 hover:bg-cyan-950/40'
                              : po.is_reconciled
                              ? 'bg-slate-900/40 hover:bg-slate-800/40 text-slate-300'
                              : 'hover:bg-slate-800/50'
                          }`}
                        >
                          {/* 1. Checkbox */}
                          <td className="py-1.5 px-1.5 text-center">
                            <button
                              type="button"
                              onClick={() => toggleSelectRow(po.id)}
                              className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                            >
                              {isSelected ? <CheckSquare className="w-3.5 h-3.5 text-cyan-400" /> : <Square className="w-3.5 h-3.5" />}
                            </button>
                          </td>

                          {/* 2. Destino (Doble clic editable) */}
                          {(() => {
                            const cp = getSpreadsheetCellProps(rowIndex, 'charge_type')
                            return (
                              <td
                                {...cp.domProps}
                                onDoubleClick={() => activateComprasCell(po, 'charge_type')}
                                className={`py-1.5 px-1.5 whitespace-nowrap cursor-pointer ${cp.className}`}
                                title="Doble clic para cambiar Destino (Directo / Pañol / Stand-by)"
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

                          {/* 3. Fecha / Quincena (Doble clic abre calendario automáticamente con showPicker) */}
                          {(() => {
                            const cp = getSpreadsheetCellProps(rowIndex, 'order_date')
                            return (
                              <td
                                {...cp.domProps}
                                onDoubleClick={() => activateComprasCell(po, 'order_date')}
                                className={`py-1.5 px-1.5 whitespace-nowrap font-mono cursor-pointer ${cp.className}`}
                                title="Doble clic para abrir calendario y editar fecha"
                              >
                                {inlineEdit.orderId === po.id && inlineEdit.field === 'order_date' ? (
                                  <input
                                    type="date"
                                    ref={(el) => {
                                      if (el && !el.dataset.pickerOpened) {
                                        el.dataset.pickerOpened = '1'
                                        el.focus()
                                        try {
                                          if (typeof el.showPicker === 'function') el.showPicker()
                                        } catch {}
                                      }
                                    }}
                                    onClick={(e) => {
                                      try {
                                        if (typeof e.target.showPicker === 'function') e.target.showPicker()
                                      } catch {}
                                    }}
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

                          {/* 4. Buque / OT (Doble Clic abre ShipWorkOrderPickerModal) */}
                          {(() => {
                            const cp = getSpreadsheetCellProps(rowIndex, 'ship_id')
                            return (
                              <td
                                {...cp.domProps}
                                onDoubleClick={() => activateComprasCell(po, 'ship_id')}
                                className={`py-1.5 px-1.5 cursor-pointer ${cp.className}`}
                                title="Doble clic para cambiar Buque u Orden de Trabajo"
                              >
                                <div className="font-semibold text-slate-200 truncate max-w-[105px]" title={shp?.name || 'ASTILLERO'}>
                                  {shp?.name || 'ASTILLERO'}
                                </div>
                                <div className="text-[9px] text-slate-400 truncate max-w-[105px]" title={wo?.title || (po.work_order_id ? 'OT' : '⚠️ Sin OT')}>
                                  {wo ? `${wo.ot_number ? `#${wo.ot_number} ` : ''}${wo.title}` : (po.work_order_id ? 'OT' : <span className="text-amber-400 font-bold">⚠️ Sin OT</span>)}
                                </div>
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

                          {/* 5. Solicita (Editable con Doble Clic o Fill Down) */}
                          {(() => {
                            const cp = getSpreadsheetCellProps(rowIndex, 'requested_by_name')
                            return (
                              <td
                                {...cp.domProps}
                                onDoubleClick={() => activateComprasCell(po, 'requested_by_name')}
                                className={`py-1.5 px-1.5 whitespace-nowrap cursor-pointer ${cp.className}`}
                                title={`Solicita: ${po.requested_by_name || 'PAÑOL'} (Doble clic para editar)`}
                              >
                                {inlineEdit.orderId === po.id && inlineEdit.field === 'requested_by_name' ? (
                                  <input
                                    type="text"
                                    list="compras-requesters-datalist"
                                    autoFocus
                                    value={inlineEdit.value}
                                    onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') saveInlineEdit(po.id, 'requested_by_name', inlineEdit.value)
                                      if (e.key === 'Escape') setInlineEdit({ orderId: null, field: null, value: '' })
                                    }}
                                    onBlur={() => saveInlineEdit(po.id, 'requested_by_name', inlineEdit.value)}
                                    className="w-24 bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[11px] text-white focus:outline-none"
                                  />
                                ) : (
                                  <div className="hover:bg-slate-800/80 px-1 py-0.5 rounded border border-transparent hover:border-cyan-500/30 text-slate-300 transition-all truncate max-w-[85px]">
                                    {po.requested_by_name || 'PAÑOL'}
                                  </div>
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

                          {/* 6. Material Solicitado (Editable con Doble Clic + Alerta Roja si NO requiere alta en catálogo) */}
                          {(() => {
                            const cp = getSpreadsheetCellProps(rowIndex, 'material_name_raw')
                            const isNoCatalogAlert = Boolean(po.no_catalog_required)
                            return (
                              <td
                                {...cp.domProps}
                                onDoubleClick={() => activateComprasCell(po, 'material_name_raw')}
                                className={`py-1.5 px-1.5 cursor-pointer ${cp.className}`}
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
                                      <label className="block text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Observación / Nota Técnica</label>
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
                                      <span className="text-slate-500">Tab: otro campo · Enter: guardar</span>
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
                                        {po.material_name_raw || <span className="text-slate-500 italic">-- Sin material --</span>}
                                      </span>
                                      {po.is_new_material && !po.no_catalog_required && isSupervisorOrAdmin && (
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            setPendingMaterialOrder(po)
                                            setShowNewMaterialModal(true)
                                          }}
                                          className="px-1.5 py-0.2 rounded bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/50 text-[9px] font-bold inline-flex items-center gap-0.5 cursor-pointer shrink-0"
                                          title="Material sin registro. Clic para formalizar alta o descartar."
                                        >
                                          <AlertTriangle className="w-2.5 h-2.5" />
                                          <span>Alta</span>
                                        </button>
                                      )}
                                    </div>

                                    {/* Opción 1: Badge rojo destacado para alerta de catálogo */}
                                    {isNoCatalogAlert && (
                                      <div className="my-0.5">
                                        <span
                                          className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-400 border border-rose-500/40 text-[9px] font-extrabold uppercase tracking-wider inline-block"
                                          title="Material nuevo marcado como: NO requiere alta en catálogo (No se cargará en Pañol)"
                                        >
                                          🔴 Sin alta en catálogo
                                        </span>
                                      </div>
                                    )}

                                    {/* Observación en renglón independiente (convive siempre) */}
                                    {po.observations && (
                                      <p className="text-[10px] text-slate-300 italic truncate max-w-[190px]" title={po.observations}>
                                        {po.observations}
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

                          {/* 7. Cantidad (Editable con Doble Clic o Fill Down) */}
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
                                    title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                                  />
                                )}
                              </td>
                            )
                          })()}

                          {/* Columnas Financieras (Solo Modo Completo) */}
                          {viewMode === 'completa' && (
                            <>
                              {/* 8. $/U Proveedor (Editable con Doble Clic o Fill Down) */}
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
                                        title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                                      />
                                    )}
                                  </td>
                                )
                              })()}

                              {/* 9. $/U Sistema + Semáforo */}
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

                          {/* 10. Proveedor (Editable con Doble Clic + Buscador por Iniciales o Fill Down) */}
                          {(() => {
                            const cp = getSpreadsheetCellProps(rowIndex, 'supplier_id')
                            return (
                              <td
                                {...cp.domProps}
                                onDoubleClick={() => activateComprasCell(po, 'supplier_id')}
                                className={`py-1.5 px-1.5 relative cursor-pointer ${cp.className}`}
                                title={sup?.name ? `Proveedor: ${sup.name} (Doble clic para cambiar)` : 'Doble clic para buscar y asignar proveedor por iniciales'}
                              >
                                {inlineEdit.orderId === po.id && inlineEdit.field === 'supplier_id' ? (
                                  <InlineSupplierPicker
                                    suppliers={suppliers}
                                    currentSupplierId={po.supplier_id}
                                    onSelect={(selectedSupId) => saveInlineEdit(po.id, 'supplier_id', selectedSupId)}
                                    onCancel={() => setInlineEdit({ orderId: null, field: null, value: '' })}
                                  />
                                ) : (
                                  <div className="hover:bg-slate-800/80 px-1 py-0.5 rounded border border-transparent hover:border-cyan-500/30 transition-all truncate max-w-[115px]">
                                    <span className="font-semibold text-slate-200">{sup?.name || <span className="text-slate-600 italic">Asignar...</span>}</span>
                                  </div>
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

                          {/* 11. Estado Compacto (Sin paréntesis visible, leyenda en tooltip al acercar el mouse) */}
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
                                  title={statusDef?.tooltip ? `${normalizedStatus} — ${statusDef.tooltip}` : normalizedStatus}
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
                                      <option value="PEDIR" title="Por Emitir" className="bg-slate-950 text-amber-400 font-semibold">PEDIR</option>
                                      <option value="RECIBIDO" title="Ingresó a Pañol" className="bg-slate-950 text-emerald-400 font-semibold">RECIBIDO</option>
                                      <option value="RECIB.COMP.DIRECT" title="Imputado a Buque" className="bg-slate-950 text-cyan-400 font-semibold">RECIB.COMP.DIRECT</option>
                                      <option value="PEDIDO INCOMPLETO" title="Parcial" className="bg-slate-950 text-orange-400 font-semibold">PEDIDO INCOMPLETO</option>
                                      <option value="RECIBIDO 2" title="Material de Cliente" className="bg-slate-950 text-slate-300 font-semibold">RECIBIDO 2</option>
                                      <option value="CANCELADOS" title="Orden cancelada" className="bg-slate-950 text-rose-400 font-semibold">CANCELADOS</option>
                                      <option value="SE COMPRA?" title="Duda" className="bg-slate-950 text-pink-400 font-semibold">SE COMPRA?</option>
                                    </>
                                  )}
                                </select>
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

                          {/* 12. Urgencia (Conmutable en 1 Clic / Doble Clic o Fill Down) */}
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
                                  title="Clic para cambiar urgencia (Sin Apuro -> Urgente -> Próx. Salida)"
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
                                    <span className="inline-block px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400 text-[9px] hover:border-slate-600">
                                      Normal
                                    </span>
                                  )}
                                </button>
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

                          {/* 13. Doc (Gestor Multidocumento con Contador) */}
                          <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedOrderForDocs(po)
                                setShowOrderDocsModal(true)
                              }}
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer ${
                                lineDocs.length > 0
                                  ? 'bg-cyan-950 border border-cyan-500/60 text-cyan-300 hover:bg-cyan-900 shadow-sm'
                                  : 'text-slate-500 hover:text-cyan-400 hover:bg-slate-800/80 border border-transparent'
                              }`}
                              title={lineDocs.length > 0 ? `${lineDocs.length} archivo(s) adjunto(s). Clic para ver / agregar más.` : 'Adjuntar cotización, ficha técnica o fotos'}
                            >
                              <Paperclip className="w-3 h-3" />
                              <span>{lineDocs.length > 0 ? lineDocs.length : ''}</span>
                            </button>
                          </td>

                          {/* 14. Fecha de Entrega (Entre Doc y Conciliado — Editable a mano con Calendario, distinta de la del flete) */}
                          {(() => {
                            const cp = getSpreadsheetCellProps(rowIndex, 'delivery_date')
                            return (
                              <td
                                {...cp.domProps}
                                onDoubleClick={() => activateComprasCell(po, 'delivery_date')}
                                className={`py-1.5 px-1.5 text-center whitespace-nowrap font-mono cursor-pointer ${cp.className}`}
                                title="Doble clic para abrir calendario y cargar Fecha de Entrega (independiente de la fecha de flete)"
                              >
                                {inlineEdit.orderId === po.id && inlineEdit.field === 'delivery_date' ? (
                                  <input
                                    type="date"
                                    ref={(el) => {
                                      if (el && !el.dataset.pickerOpened) {
                                        el.dataset.pickerOpened = '1'
                                        el.focus()
                                        try {
                                          if (typeof el.showPicker === 'function') el.showPicker()
                                        } catch {}
                                      }
                                    }}
                                    onClick={(e) => {
                                      try {
                                        if (typeof e.target.showPicker === 'function') e.target.showPicker()
                                      } catch {}
                                    }}
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
                                    title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                                  />
                                )}
                              </td>
                            )
                          })()}

                          {/* 15. Conciliado Ultra-Compacto (Círculo Violeta con detalle al hacer clic) */}
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
                                  title={`🟣 CONCILIADO — Factura: ${po.invoice_number || 'S/D'} • Por: ${po.reconciled_by || 'Supervisor'}${po.reconciled_at ? ' (' + new Date(po.reconciled_at).toLocaleDateString('es-AR') + ')' : ''}. Clic para ver detalle.`}
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
                                  title="Sin conciliar. Clic para conciliar o selecciona varias filas y usa el botón Conciliar del menú inferior."
                                />
                              )}
                            </td>
                          )}

                          {/* 16. Acciones (Camión de Flete + Editar + Eliminar) */}
                          <td className="py-1.5 px-1.5 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setFreightTargetOrder(po)
                                  setShowFreightModal(true)
                                }}
                                className={`p-1 rounded transition-colors cursor-pointer ${
                                  hasFreight
                                    ? 'text-amber-300 bg-amber-950/70 border border-amber-500/50 hover:bg-amber-900'
                                    : 'text-slate-400 hover:text-cyan-300 hover:bg-slate-800'
                                }`}
                                title={
                                  hasFreight
                                    ? `🚚 Flete: ${po.freight_transport_name || 'S/D'} | Solicitud: ${po.freight_request_date || '—'} | Est. Entrega: ${po.freight_estimated_date || '—'} (Clic para editar)`
                                    : 'Asignar datos de Flete (Transporte, Fecha Solicitud y Fecha Entrega Estimada)'
                                }
                              >
                                <Truck className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSupplierHelperTarget(po)
                                  setShowSupplierHelperModal(true)
                                }}
                                className="p-1 text-slate-400 hover:text-amber-300 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                                title="💡 Asistente Inteligente de Proveedores (Histórico y Métricas de Frecuencia)"
                              >
                                <Lightbulb className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDuplicateOrder(po)}
                                className="p-1 text-slate-400 hover:text-cyan-300 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                                title="⚡ Duplicar este pedido (clonar al final con fecha de hoy)"
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

                  {/* Fila de Acción Rápida al pie de la tabla (Imagen 2) */}
                  <tr className="border-t-2 border-dashed border-slate-800/80 bg-slate-950/40 hover:bg-slate-900/60 transition-colors">
                    <td colSpan={spreadsheetColumns.length + 3} className="py-2.5 px-4">
                      <div className="flex flex-wrap items-center justify-between gap-4">
                        <div className="flex flex-wrap items-center gap-3">
                          <button
                            type="button"
                            onClick={handleAddNewBlankOrder}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-yellow-500/15 hover:bg-yellow-500/25 border border-yellow-500/60 text-yellow-300 font-black text-xs shadow-md transition-all cursor-pointer"
                          >
                            <Plus className="w-4 h-4 text-yellow-400" />
                            <span>+ nuevo pedido</span>
                          </button>

                          <span className="text-slate-600 text-xs hidden sm:inline">|</span>

                          <button
                            type="button"
                            onClick={() => {
                              setEditingOrder(null)
                              setShowOrderModal(true)
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-slate-400 hover:text-cyan-300 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <FileText className="w-3.5 h-3.5 text-cyan-400" />
                            <span>o cargar con formulario multi-material...</span>
                          </button>
                        </div>

                        <div className="text-[11px] text-slate-500 font-mono hidden md:flex items-center gap-1">
                          <span>💡 Tip:</span>
                          <span>Usa el icono</span>
                          <Copy className="w-3 h-3 text-cyan-400 inline mx-0.5" />
                          <span>para duplicar en 1-clic, o copia fila con Ctrl+C y pega con Ctrl+V</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ========================================================= */}
          {/* BARRA DE TOTALES FLOTANTE DE ALTO CONTRASTE (Zona 5: Resumen y Stats Sheets/Excel) */}
          {/* ========================================================= */}
          <div className="fixed bottom-4 left-4 right-4 md:left-64 z-40 bg-slate-900/98 border-2 border-cyan-400 shadow-2xl shadow-cyan-500/30 rounded-2xl px-4 py-2.5 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs animate-in slide-in-from-bottom duration-200">
            {/* Indicador de selección y Alerta de Filtro Activo */}
            <div className="flex flex-wrap items-center gap-2">
              {grid.selectionStats ? (
                /* MODO VIVO SHEETS/EXCEL: Rango de Celdas Seleccionado */
                <div className="flex flex-wrap items-center gap-2 font-mono">
                  <div className="flex items-center gap-1.5 bg-emerald-950/90 border border-emerald-500/90 px-2.5 py-1 rounded-lg text-emerald-300 font-black text-xs shadow-md">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>SELECCIÓN ({grid.selectionStats.count} celdas)</span>
                  </div>

                  {grid.selectionStats.numericCount > 0 ? (
                    <>
                      <div className="flex items-baseline gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-cyan-500/60 shadow">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Σ SUMA:</span>
                        <span className="text-sm font-extrabold text-cyan-300">
                          ${grid.selectionStats.sum.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-1 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-700">
                        <span className="text-[10px] uppercase font-bold text-slate-400">Ø PROM:</span>
                        <span className="text-xs font-bold text-white">
                          ${grid.selectionStats.avg.toLocaleString('es-AR', { maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      <div className="flex items-baseline gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-[11px] text-slate-300">
                        <span>MÍN: <strong className="text-slate-100">${grid.selectionStats.min.toLocaleString('es-AR')}</strong></span>
                        <span className="mx-1 text-slate-600">·</span>
                        <span>MÁX: <strong className="text-slate-100">${grid.selectionStats.max.toLocaleString('es-AR')}</strong></span>
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-slate-400 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                      Texto ({grid.selectionStats.count} celdas)
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => grid.setSelectionRange(null)}
                    className="ml-1 text-slate-400 hover:text-white transition-colors cursor-pointer text-xs underline"
                    title="Quitar selección de rango"
                  >
                    ✕ Salir
                  </button>
                </div>
              ) : stats.isCustomSelection ? (
                /* MODO VIVO FILAS TILDADAS */
                <div className="flex items-center gap-2 bg-cyan-950 border border-cyan-400 px-2.5 py-1 rounded-lg text-cyan-300 font-extrabold shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                  <span>📌 Selección: {stats.count} pedidos tildados</span>
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
                /* MODO RESUMEN GENERAL FILTRADO */
                <div className="flex items-center gap-2 bg-slate-950 border border-slate-700 px-2.5 py-1 rounded-lg text-slate-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>🌐 Todo el filtro: {stats.count} pedidos</span>
                </div>
              )}

              {/* ALERTA VISUAL DE FILTRO ACTIVO */}
              {hasActiveFilters && (
                <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-400/80 px-2.5 py-1 rounded-lg text-amber-300 font-bold text-xs shadow-md">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>Filtro Activo ({filteredOrders.length} de {purchaseOrders.length})</span>
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="ml-1 px-2 py-0.5 rounded bg-rose-600 hover:bg-rose-500 text-white font-extrabold text-[10px] shadow transition-all cursor-pointer"
                  >
                    ✕ Limpiar Todo
                  </button>
                </div>
              )}
            </div>

            {/* Métricas calculadas en vivo */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 font-mono">
              <div className="flex items-baseline gap-1">
                <span className="text-[10px] uppercase font-bold text-slate-400">Σ Cant:</span>
                <span className="text-xs font-bold text-white">{stats.sumQty}</span>
              </div>

              {viewMode === 'completa' && (
                <>
                  <div className="flex items-baseline gap-1 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
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
                </>
              )}
            </div>

            {/* Botones de acción masiva */}
            {selectedOrderIds.size > 0 && (
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
                      title="Marcar que los materiales seleccionados NO requieren alta en catálogo maestro"
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
                      title="Desplegar menú de conciliación para todas las filas seleccionadas"
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
                  title="Generar orden de retiro para mandadero con los ítems seleccionados"
                >
                  <span>🛵</span>
                  <span>Mandar a Retirar ({selectedOrderIds.size})</span>
                </button>

                <button
                  type="button"
                  onClick={handleBatchReceive}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg text-xs shadow-md shadow-emerald-600/20 transition-all cursor-pointer"
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
      {/* VISTA 2: CATÁLOGO UNIFICADO DE PROVEEDORES (MULTI-RUBRO & KPIS) */}
      {/* ========================================================= */}
      {activeTab === 'proveedores' && (
        <div className="space-y-4">
          {/* ZONA 2: KPIS PROPIOS DE PROVEEDORES */}
          <div className="alon-zone-kpis p-3 space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/90 px-1 block">
              📊 RADAR DE PROVEEDORES • Clic para filtrar padrón
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div
              onClick={() => setSupplierKpiFilter('TODOS')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                supplierKpiFilter === 'TODOS' ? 'bg-cyan-950/60 border-cyan-500' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total Activos</p>
              <p className="text-xl font-black text-white mt-0.5">{supplierKpis.total}</p>
            </div>

            <div
              onClick={() => setSupplierKpiFilter(supplierKpiFilter === 'NO_PHONE' ? 'TODOS' : 'NO_PHONE')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                supplierKpiFilter === 'NO_PHONE' ? 'bg-amber-950/60 border-amber-500' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <p className="text-[10px] font-bold text-amber-400 uppercase">⚠️ Sin Teléfono</p>
              <p className="text-xl font-black text-amber-300 mt-0.5">{supplierKpis.noPhone}</p>
            </div>

            <div
              onClick={() => setSupplierKpiFilter(supplierKpiFilter === 'NO_EMAIL' ? 'TODOS' : 'NO_EMAIL')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                supplierKpiFilter === 'NO_EMAIL' ? 'bg-purple-950/60 border-purple-500' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <p className="text-[10px] font-bold text-purple-400 uppercase">⚠️ Sin Email</p>
              <p className="text-xl font-black text-purple-300 mt-0.5">{supplierKpis.noEmail}</p>
            </div>

            <div
              onClick={() => setSupplierKpiFilter(supplierKpiFilter === 'NO_TRADE' ? 'TODOS' : 'NO_TRADE')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                supplierKpiFilter === 'NO_TRADE' ? 'bg-rose-950/60 border-rose-500' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <p className="text-[10px] font-bold text-rose-400 uppercase">⚠️ Sin Rubro</p>
              <p className="text-xl font-black text-rose-300 mt-0.5">{supplierKpis.noTrade}</p>
            </div>

            <div
              onClick={() => setSupplierKpiFilter(supplierKpiFilter === 'GASES' ? 'TODOS' : 'GASES')}
              className={`p-3 rounded-xl border cursor-pointer transition-all ${
                supplierKpiFilter === 'GASES' ? 'bg-cyan-950/60 border-cyan-400' : 'bg-slate-900 border-slate-800'
              }`}
            >
              <p className="text-[10px] font-bold text-cyan-400 uppercase">💨 Gases (P-02)</p>
              <p className="text-xl font-black text-cyan-300 mt-0.5">{supplierKpis.gasesCount}</p>
            </div>
            </div>
          </div>

          {/* ZONA 3: BARRA DE HERRAMIENTAS Y VISTAS */}
          <div className="alon-zone-toolbar flex items-center justify-between p-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSuppliersViewMode('lista')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  suppliersViewMode === 'lista' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Vista Lista</span>
              </button>
              <button
                onClick={() => setSuppliersViewMode('fichas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  suppliersViewMode === 'fichas' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Vista Fichas</span>
              </button>
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

          {/* ZONA 4: TABLA DE PROVEEDORES */}
          {suppliersViewMode === 'lista' ? (
            <div className="alon-zone-grid">
              <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 z-20 alon-grid-thead">
                    <tr>
                      <th className="py-2.5 px-3">Proveedor / Razón Social</th>
                      <th className="py-2.5 px-3">Rubros</th>
                      <th className="py-2.5 px-3">CUIT</th>
                      <th className="py-2.5 px-3">Teléfono / WhatsApp</th>
                      <th className="py-2.5 px-3">Email</th>
                      <th className="py-2.5 px-3">Pago</th>
                      <th className="py-2.5 px-3">Circuito Gases (P-02)</th>
                      <th className="py-2.5 px-3 text-center">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredSuppliers.map((sup) => {
                      const allTrades = sup.trades && sup.trades.length > 0 ? sup.trades : sup.trade ? [sup.trade] : []
                      return (
                        <tr key={sup.id} className="hover:bg-slate-800/50 transition-colors">
                          <td className="py-2 px-3 font-bold text-white whitespace-nowrap">{sup.name}</td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-1 max-w-[200px]">
                              {allTrades.length > 0 ? (
                                allTrades.map((t, idx) => (
                                  <span key={idx} className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10px] uppercase font-semibold">
                                    {t}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[10px] text-rose-400 italic">Sin rubro</span>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 font-mono text-slate-300 whitespace-nowrap">{sup.cuit_cuil || '—'}</td>
                          <td className="py-2 px-3 font-mono text-slate-300 whitespace-nowrap">
                            {sup.phone ? (
                              <span className="text-emerald-400">{sup.phone}</span>
                            ) : (
                              <span className="text-amber-400/80 italic text-[10px]">Sin teléfono</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-300 truncate max-w-[150px]">{sup.email || '—'}</td>
                          <td className="py-2 px-3 whitespace-nowrap text-slate-400">{sup.payment_method || 'Cta Cte'}</td>
                          <td className="py-2 px-3 whitespace-nowrap">
                            {sup.is_gas_supplier ? (
                              <span className="px-1.5 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 text-[10px] font-bold">
                                {sup.client_number ? `Cli: ${sup.client_number}` : 'Gases'}
                              </span>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <button
                              onClick={() => {
                                setEditingSupplier(sup)
                                setShowSupplierModal(true)
                              }}
                              className="px-2 py-1 text-slate-400 hover:text-white rounded bg-slate-800 hover:bg-slate-700 text-xs"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* VISTA 2: FICHAS (CARDS) */
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredSuppliers.map((sup) => {
                const allTrades = sup.trades && sup.trades.length > 0 ? sup.trades : sup.trade ? [sup.trade] : []
                return (
                  <div key={sup.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-md">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-white text-sm">{sup.name}</h3>
                        {sup.is_gas_supplier && (
                          <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 text-[10px] font-bold shrink-0">
                            💨 GASES
                          </span>
                        )}
                      </div>

                      {/* Rubros múltiples */}
                      <div className="flex flex-wrap gap-1 mt-2">
                        {allTrades.map((t, idx) => (
                          <span key={idx} className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase font-semibold">
                            {t}
                          </span>
                        ))}
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
                      </div>

                      {sup.is_gas_supplier && (
                        <div className="mt-3 p-2 bg-slate-950 rounded-lg border border-cyan-900/40 text-[10px] text-cyan-200 space-y-0.5">
                          <p className="font-bold text-cyan-400">Circuito P-02:</p>
                          {sup.client_number && <p>N° Cliente: <span className="font-mono font-bold text-white">{sup.client_number}</span></p>}
                          {sup.order_cutoff_day && <p>Corte: {sup.order_cutoff_day}</p>}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                      <span className="text-[10px] text-slate-500">{sup.payment_method || 'Cta Cte'}</span>
                      <button
                        onClick={() => {
                          setEditingSupplier(sup)
                          setShowSupplierModal(true)
                        }}
                        className="px-2 py-1 text-slate-400 hover:text-white rounded bg-slate-800 hover:bg-slate-700 text-xs"
                      >
                        Editar
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* VISTA 3: ARCHIVO HISTÓRICO Y GESTOR DOCUMENTAL */}
      {/* ========================================================= */}
      {activeTab === 'documentos' && (
        <div className="space-y-4">
          <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Gestor Documental de Compras
                <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">
                  {documents.length} archivos
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Cotizaciones de materiales, fichas técnicas de fabricantes, cotizaciones confidenciales de mano de obra y fotos de muestra.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setDocsViewMode('lista')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  docsViewMode === 'lista' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>Vista Lista</span>
              </button>
              <button
                onClick={() => setDocsViewMode('fichas')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                  docsViewMode === 'fichas' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Vista Fichas</span>
              </button>
            </div>
          </div>

          {docsViewMode === 'lista' ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-20 bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Archivo</th>
                    <th className="py-2.5 px-3">Tipo Documento</th>
                    <th className="py-2.5 px-3">Descripción</th>
                    <th className="py-2.5 px-3">Rubro</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {documents.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-800/50 transition-colors">
                      <td className="py-2 px-3 font-bold text-white flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                        <span className="truncate max-w-[220px]">{d.original_filename}</span>
                      </td>
                      <td className="py-2 px-3">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                          {d.doc_type || 'COTIZACION_MATERIAL'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-300">{d.description || '—'}</td>
                      <td className="py-2 px-3 text-slate-400">{d.category || 'General'}</td>
                      <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">{new Date(d.created_at).toLocaleDateString('es-AR')}</td>
                      <td className="py-2 px-3 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <a
                            href={d.storage_path}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded text-xs font-bold"
                          >
                            Abrir
                          </a>
                          <button
                            onClick={() => {
                              setSelectedDocAction(d)
                              setShowDocActionModal(true)
                            }}
                            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                            title="Gestionar archivo (editar metadatos, reemplazar, borrar)"
                          >
                            <SlidersHorizontal className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {documents.map((d) => (
                <div key={d.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                        <h4 className="font-bold text-white text-xs truncate max-w-[180px]">{d.original_filename}</h4>
                      </div>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">{d.doc_type || 'Material'}</span>
                    </div>
                    {d.description && <p className="text-xs text-slate-300 mt-2">{d.description}</p>}
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500">{new Date(d.created_at).toLocaleDateString('es-AR')}</span>
                    <div className="flex items-center gap-1.5">
                      <a
                        href={d.storage_path}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs font-bold"
                      >
                        Abrir
                      </a>
                      <button
                        onClick={() => {
                          setSelectedDocAction(d)
                          setShowDocActionModal(true)
                        }}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: FORMULARIO MULTI-MATERIAL (ENCABEZADO ÚNICO + RENGLONES) */}
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

      {/* ========================================================= */}
      {/* MODAL 3: ADJUNTAR COTIZACIÓN / FICHA TÉCNICA (MULTI-ADJUNTO) */}
      {/* ========================================================= */}
      {showDocModal && docTargetOrder && (
        <UploadDocModal
          order={docTargetOrder}
          supplier={suppliers.find((s) => s.id === docTargetOrder.supplier_id)}
          onClose={() => {
            setShowDocModal(false)
            setDocTargetOrder(null)
          }}
          onSuccess={(newDocs) => {
            const addedArray = Array.isArray(newDocs) ? newDocs : [newDocs]
            setDocuments((prev) => [...addedArray, ...prev])
            showFeedbackMsg('success', `Se adjuntaron ${addedArray.length} documento(s) con éxito.`)
            setShowDocModal(false)
            setDocTargetOrder(null)
          }}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL 3B: GESTIONAR ARCHIVO EXISTENTE (EDITAR / REEMPLAZAR / BORRAR) */}
      {/* ========================================================= */}
      {showDocActionModal && selectedDocAction && (
        <DocActionModal
          doc={selectedDocAction}
          onClose={() => {
            setShowDocActionModal(false)
            setSelectedDocAction(null)
          }}
          onSuccess={({ action, updatedDoc, deletedId }) => {
            if (action === 'delete') {
              setDocuments((prev) => prev.filter((d) => d.id !== deletedId))
              showFeedbackMsg('success', 'Documento eliminado correctamente.')
            } else {
              setDocuments((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)))
              showFeedbackMsg('success', 'Documento actualizado correctamente.')
            }
            setShowDocActionModal(false)
            setSelectedDocAction(null)
          }}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL 4: CONCILIAR CON FACTURA ("LÍNEA MORADA") */}
      {/* ========================================================= */}
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

      {/* ========================================================= */}
      {/* MODAL 4B: DATOS DE FLETE Y TRANSPORTE (ICONO CAMIÓN) */}
      {/* ========================================================= */}
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

      {/* ========================================================= */}
      {/* MODAL 5: ALTA / EDICIÓN DE PROVEEDOR (MULTI-RUBRO COMBOBOX) */}
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
      {/* MODAL 6: DESPACHO POR WHATSAPP (SOPORTE 2 COMPRADORES & 0810) */}
      {/* ========================================================= */}
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
{/* ========================================================= */}
      {/* MODAL 7: GESTOR DE ADJUNTOS DE LA LÍNEA (MULTIDOCUMENTO) */}
      {/* ========================================================= */}
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

      {/* ========================================================= */}
      {/* MODAL 8: RECEPCIÓN PARCIAL / PEDIDO INCOMPLETO */}
      {/* ========================================================= */}
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

      {/* ========================================================= */}
      {/* MODAL 9: ALERTA SE COMPRA? (GERENCIA & JEFE DE OBRA) */}
      {/* ========================================================= */}
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

      {/* ========================================================= */}
      {/* MODAL 10: ASIGNAR PROVEEDOR EN LOTE */}
      {/* ========================================================= */}
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

      {/* ========================================================= */}
      {/* MODAL 11: SELECTOR ENFOCADO DE BUQUE Y OT (DOBLE CLIC) */}
      {/* ========================================================= */}
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
            fetchData()
          }
        }}
      />

      {/* MODAL 12: ASISTENTE INTELIGENTE DE PROVEEDOR */}
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

      {/* MODAL 13: PEDIDO DE MANDADO (RETIRO LOCAL) */}
      {showMandadosModal && (
        <MandadosModal
          purchaseOrders={purchaseOrders}
          suppliers={suppliers}
          workers={workers}
          preselectedIds={mandadosPreselectedIds}
          onClose={() => {
            setShowMandadosModal(false)
            setMandadosPreselectedIds([])
          }}
        />
      )}
    </div>
  )
}


// =========================================================================
// SUBCOMPONENTES MODALES
// =========================================================================

// MODAL 1: FORMULARIO MULTI-MATERIAL (ENCABEZADO ÚNICO + RENGLONES DINÁMICOS)
function OrderFormModal({
  order,
  ships,
  workOrders,
  suppliers,
  materials,
  workers,
  currentFortnight,
  viewMode,
  isSupervisorOrAdmin,
  onClose,
  onSuccess
}) {
  // Encabezado
  const [chargeType, setChargeType] = useState(order?.charge_type || 'VIA_PANOL')
  const [orderDate, setOrderDate] = useState(order?.order_date || new Date().toISOString().split('T')[0])
  const [shipId, setShipId] = useState(order?.ship_id || '')
  const [workOrderId, setWorkOrderId] = useState(order?.work_order_id || '')
  const [urgency, setUrgency] = useState(order?.urgency || 'SIN_APURO')
  const [requestedByName, setRequestedByName] = useState(order?.requested_by_name || 'PAÑOL')

  // Renglones dinámicos de materiales
  const [items, setItems] = useState([
    {
      material_id: order?.material_id || null,
      material_name_raw: order?.material_name_raw || '',
      is_new_material: order?.is_new_material || false,
      quantity: order?.quantity || 1,
      unit_measure: order?.unit_measure || 'unidad',
      supplier_id: order?.supplier_id || '', // Vacío por defecto
      supplier_quoted_price: order?.supplier_quoted_price || '', // Vacío por defecto
      system_unit_price: order?.system_unit_price || 0,
      observations: order?.observations || ''
    }
  ])

  const [saving, setSaving] = useState(false)

  // Lista de personas habilitadas para retirar materiales
  const authorizedWorkers = useMemo(() => {
    return workers.filter((w) => w.can_withdraw_materials)
  }, [workers])

  // Filtrado de OTs por Barco seleccionado
  const availableWorkOrders = useMemo(() => {
    if (!shipId) return []
    return workOrders.filter((w) => w.ship_id === shipId)
  }, [shipId, workOrders])

  // OT seleccionada para mostrar su descripción completa
  const selectedWorkOrder = useMemo(() => {
    return workOrders.find((w) => w.id === workOrderId)
  }, [workOrders, workOrderId])

  // Si cambia el destino a VIA_PANOL, fijar barco ASTILLERO y OT STOCK
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

  function handleAddItem() {
    setItems([
      ...items,
      {
        material_id: null,
        material_name_raw: '',
        is_new_material: false,
        quantity: 1,
        unit_measure: 'unidad',
        supplier_id: '',
        supplier_quoted_price: '',
        system_unit_price: 0,
        observations: ''
      }
    ])
  }

  function handleRemoveItem(idx) {
    if (items.length === 1) return alert('Debe haber al menos un material en el pedido.')
    setItems(items.filter((_, i) => i !== idx))
  }

  function handleItemChange(idx, field, value) {
    const updated = [...items]
    updated[idx][field] = value

    // Si cambia el nombre del material, deducir automáticamente la unidad
    if (field === 'material_name_raw') {
      updated[idx].unit_measure = deduceUnitMeasure(value)
      updated[idx].material_id = null
      updated[idx].is_new_material = true
      updated[idx].system_unit_price = 0
    }

    setItems(updated)
  }

  function handleSelectCatalogMaterial(idx, mat) {
    const updated = [...items]
    updated[idx].material_id = mat.id
    updated[idx].material_name_raw = mat.name
    updated[idx].is_new_material = false
    updated[idx].system_unit_price = mat.cost_ars || 0
    updated[idx].unit_measure = mat.unit_measure || deduceUnitMeasure(mat.name)
    setItems(updated)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const astShipObj = ships.find((s) => (s.name || '').toUpperCase().includes('ASTILLERO'))
    if (chargeType === 'DIRECT' && (!shipId || (astShipObj && shipId === astShipObj.id))) {
      return alert('Para compras con destino DIRECTO debe seleccionar un Buque específico de obra (distinto de Astillero). La Orden de Trabajo (OT) puede quedar en blanco si aún no está abierta.')
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (!it.material_name_raw.trim()) {
        return alert(`El renglón #${i + 1} no tiene nombre de material.`)
      }
      if (Number(it.quantity) <= 0) {
        return alert(`La cantidad del renglón #${i + 1} debe ser mayor a 0.`)
      }
    }

    setSaving(true)
    try {
      const payloads = items.map((it) => ({
        charge_type: chargeType,
        order_date: orderDate,
        ship_id: shipId || null,
        work_order_id: workOrderId || null,
        requested_by_name: requestedByName,
        urgency,
        material_id: it.material_id,
        material_name_raw: it.material_name_raw.trim(),
        is_new_material: it.is_new_material,
        quantity: Number(it.quantity),
        unit_measure: it.unit_measure,
        supplier_id: it.supplier_id || null,
        supplier_quoted_price: it.supplier_quoted_price ? Number(it.supplier_quoted_price) : null,
        system_unit_price: it.system_unit_price ? Number(it.system_unit_price) : 0,
        status: 'PEDIR',
        observations: it.observations.trim() || null,
        fortnight_period: currentFortnight,
        updated_at: new Date().toISOString()
      }))

      if (order?.id) {
        const { data, error } = await supabase.from('purchase_orders').update(payloads[0]).eq('id', order.id).select().single()
        if (error) throw error
        onSuccess([data])
      } else {
        const { data, error } = await supabase.from('purchase_orders').insert(payloads).select()
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-4xl p-6 space-y-4 shadow-2xl max-h-[90vh] flex flex-col">
        {/* Cabecera del Modal */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3 shrink-0">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-cyan-400" />
              {order ? 'Editar Pedido de Compra' : 'Cargar Materiales (Multi-Renglón por OT / Obra)'}
            </h3>
            <p className="text-xs text-slate-400">
              {viewMode === 'simple'
                ? 'Solicitud simplificada: carga los materiales que necesitás sin preocuparte por precios ni proveedores.'
                : 'Defina la obra o pañol una sola vez y agregue múltiples renglones de materiales.'}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs flex-1 overflow-y-auto pr-1">
          {/* SECCIÓN 1: ENCABEZADO COMÚN */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="text-[11px] uppercase tracking-wider font-bold text-cyan-400">1. Destino y Datos del Trabajo</h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Destino</label>
                <select
                  value={chargeType}
                  onChange={(e) => setChargeType(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="DIRECT">Carga Directa para Obra (Buque)</option>
                  <option value="VIA_PANOL">Reposición de Stock (Pañol)</option>
                  <option value="STANDBY">Stand-By en Depósito</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Fecha (Doble Clic para Calendario)</label>
                <input
                  type="date"
                  value={orderDate}
                  onChange={(e) => setOrderDate(e.target.value)}
                  onDoubleClick={(e) => e.target.showPicker && e.target.showPicker()}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500 cursor-pointer"
                  title="Doble clic para abrir calendario"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Urgencia</label>
                <select
                  value={urgency}
                  onChange={(e) => setUrgency(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500 font-bold"
                >
                  <option value="SIN_APURO">🟢 Sin Apuro (Normal)</option>
                  <option value="URGENTE">🔴 Urgente (Prioridad Alta)</option>
                  <option value="PROXIMA_SALIDA">🟡 Próxima Salida de Buque</option>
                </select>
              </div>
            </div>

            {/* Buque y OT (solo para Carga Directa) */}
            {chargeType === 'DIRECT' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-850">
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
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Orden de Trabajo (OT - Opcional)</label>
                  <select
                    value={workOrderId}
                    onChange={(e) => setWorkOrderId(e.target.value)}
                    className={`w-full bg-slate-900 border rounded-lg p-2 focus:outline-none focus:border-cyan-500 ${
                      !workOrderId ? 'border-amber-500/60 text-amber-300 font-semibold' : 'border-slate-700 text-white'
                    }`}
                  >
                    <option value="">-- ⚠️ Dejar OT en blanco (Pendiente de apertura) --</option>
                    {availableWorkOrders.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.ot_number ? `OT #${w.ot_number} - ` : ''}{w.title}
                      </option>
                    ))}
                  </select>
                </div>

                {/* DESCRIPCIÓN DE LA OT VISIBLE */}
                {selectedWorkOrder && (
                  <div className="col-span-full bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-300">
                    <span className="font-bold text-cyan-400">Descripción de la OT: </span>
                    <span>{selectedWorkOrder.description || selectedWorkOrder.title || 'Sin descripción técnica adicional.'}</span>
                  </div>
                )}
              </div>
            )}

            {/* Solicitante Inteligente */}
            <div className="pt-2 border-t border-slate-850 flex items-center gap-3">
              <div className="flex-1">
                <label className="block text-slate-400 mb-1 font-semibold">Persona o Sector que Solicita</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={requestedByName}
                    onChange={(e) => setRequestedByName(e.target.value)}
                    placeholder="Escriba o elija de la lista..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                  <select
                    onChange={(e) => {
                      if (e.target.value) setRequestedByName(e.target.value)
                    }}
                    className="bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-300 focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">-- Habilitados Pañol --</option>
                    <option value="PAÑOL">PAÑOL CENTRAL</option>
                    {authorizedWorkers.map((w) => (
                      <option key={w.id} value={w.name}>{w.name} ({w.trade})</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* SECCIÓN 2: GRILLA DINÁMICA DE MATERIALES */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-[11px] uppercase tracking-wider font-bold text-cyan-400">
                2. Materiales e Insumos ({items.length} renglones)
              </h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Agregar Renglón</span>
              </button>
            </div>

            <div className="space-y-3">
              {items.map((it, idx) => (
                <div key={idx} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3 relative group">
                  <div className="flex items-center justify-between border-b border-slate-850 pb-2">
                    <span className="font-mono text-cyan-400 font-bold">Renglón #{idx + 1}</span>
                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(idx)}
                        className="text-slate-500 hover:text-rose-400 transition-colors"
                        title="Eliminar este renglón"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Nombre del Material con Autocomplete */}
                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold flex items-center justify-between">
                      <span>Material / Insumo</span>
                      <span className="text-[10px] text-slate-500">
                        Unidad deducida: <strong className="text-cyan-400">{it.unit_measure}</strong>
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: BRONCE SAE 64 X KILO, MADERA ANCHICO x METRO..."
                      value={it.material_name_raw}
                      onChange={(e) => handleItemChange(idx, 'material_name_raw', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-medium focus:outline-none focus:border-cyan-500"
                      required
                    />

                    {/* Sugerencias de Catálogo si escribe */}
                    {it.material_name_raw && !it.material_id && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {materials
                          .filter((m) => m.name.toLowerCase().includes(it.material_name_raw.toLowerCase()))
                          .slice(0, 4)
                          .map((m) => (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => handleSelectCatalogMaterial(idx, m)}
                              className="px-2 py-0.5 rounded bg-slate-850 hover:bg-cyan-950 border border-slate-700 text-[10px] text-slate-300 hover:text-cyan-300 transition-colors"
                            >
                              ✓ {m.name} ({m.unit_measure || 'unidad'})
                            </button>
                          ))}
                      </div>
                    )}
                  </div>

                  {/* Cantidad y Unidad Automática Bloqueada */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Cantidad</label>
                      <input
                        type="number"
                        step="any"
                        min="0.01"
                        value={it.quantity}
                        onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Unidad Medida</label>
                      <input
                        type="text"
                        value={it.unit_measure}
                        disabled
                        className="w-full bg-slate-850 border border-slate-800 rounded-lg p-2 text-cyan-300 font-bold cursor-not-allowed uppercase"
                        title="Deducida automáticamente por reglas de nomenclatura"
                      />
                    </div>

                    {/* Campos de Costo y Proveedor: solo visibles en Modo Completo */}
                    {viewMode === 'completa' && (
                      <>
                        <div>
                          <label className="block text-slate-400 mb-1 font-semibold">Proveedor</label>
                          <select
                            value={it.supplier_id}
                            onChange={(e) => handleItemChange(idx, 'supplier_id', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                          >
                            <option value="">-- Sin Proveedor --</option>
                            {suppliers.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-400 mb-1 font-semibold">$/U Cotizado AR$</label>
                          <input
                            type="number"
                            step="any"
                            placeholder="Vacío por defecto"
                            value={it.supplier_quoted_price}
                            onChange={(e) => handleItemChange(idx, 'supplier_quoted_price', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {/* Observaciones del Renglón */}
                  <div>
                    <input
                      type="text"
                      placeholder="Observaciones de este material (medida específica, espesor, urgencia interna)..."
                      value={it.observations}
                      onChange={(e) => handleItemChange(idx, 'observations', e.target.value)}
                      className="w-full bg-slate-900 border border-slate-750 rounded-lg p-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Botones de acción */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold rounded-lg transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              {saving ? 'Guardando...' : order ? 'Actualizar Pedido' : `Registrar ${items.length} Materiales`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// MODAL 2: ALTA FORMAL DE MATERIAL EN CATÁLOGO (SUPERVISOR)
function NewMaterialModal({ order, onClose, onDismissed, onSuccess }) {
  const [noCatalogRequired, setNoCatalogRequired] = useState(false)
  const [name, setName] = useState(order.material_name_raw)
  const [category, setCategory] = useState('MATERIALES')
  const [rubro, setRubro] = useState('MATERIALES')
  const [requestNewRubro, setRequestNewRubro] = useState(false)
  const [suggestedRubro, setSuggestedRubro] = useState('')
  const [unitMeasure, setUnitMeasure] = useState(order.unit_measure || deduceUnitMeasure(order.material_name_raw))
  const [securityFactor, setSecurityFactor] = useState(1.06)
  const [costArs, setCostArs] = useState(order.supplier_quoted_price || 0)
  const [minimumStock, setMinimumStock] = useState(0)
  const [imageFile, setImageFile] = useState(null)
  const [saving, setSaving] = useState(false)

  function applyNamingPattern(prefix) {
    const updated = `${prefix} ${name}`
    setName(updated)
    setUnitMeasure(deduceUnitMeasure(updated))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    // Si el usuario tildó la casilla para descartar alta en catálogo
    if (noCatalogRequired) {
      setSaving(true)
      try {
        const { error } = await supabase
          .from('purchase_orders')
          .update({ no_catalog_required: true, updated_at: new Date().toISOString() })
          .eq('id', order.id)
        if (error) throw error
        if (onDismissed) onDismissed(order.id)
        else onClose()
      } catch (err) {
        console.error('Error descartando alta:', err)
        alert('Error al descartar alta: ' + err.message)
      } finally {
        setSaving(false)
      }
      return
    }

    if (!name.trim()) return alert('Debe ingresar el nombre normalizado.')
    if (requestNewRubro && !suggestedRubro.trim()) {
      return alert('Por favor ingrese el nombre del nuevo rubro sugerido para el Administrador.')
    }

    setSaving(true)
    try {
      let imageUrl = null
      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const safeName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
        const storagePath = `catalogo_materiales/${Date.now()}_${safeName}.${ext}`
        const { error: uploadError } = await supabase.storage.from('compras').upload(storagePath, imageFile)
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('compras').getPublicUrl(storagePath)
        imageUrl = urlData.publicUrl
      }

      const payload = {
        name: name.trim(),
        category, // Exclusivamente MATERIALES, CONSUMIBLES, ELEM.SEGURIDAD
        rubro: requestNewRubro ? null : rubro,
        rubro_status: requestNewRubro ? 'PENDIENTE_HOMOLOGACION' : 'APROBADO',
        suggested_rubro: requestNewRubro ? suggestedRubro.trim().toUpperCase() : null,
        unit_measure: unitMeasure,
        security_factor: Number(securityFactor) || 1.06,
        cost_ars: Number(costArs),
        cost_usd: Number(costArs) / 1500,
        current_stock: 0,
        minimum_stock: Number(minimumStock),
        image_url: imageUrl
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
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              Alta Formal de Material en B.D. Maestra
            </h3>
            <p className="text-xs text-slate-400">Normalización técnica, categoría, % seguridad y rubro (Solo Supervisor).</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-base">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Casilla para Desactivar / Omitir el Alta si es un material puntual */}
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 flex items-start gap-2.5">
            <input
              id="no-catalog-check"
              type="checkbox"
              checked={noCatalogRequired}
              onChange={(e) => setNoCatalogRequired(e.target.checked)}
              className="mt-0.5 rounded bg-slate-900 border-rose-500 text-rose-500 focus:ring-0 cursor-pointer"
            />
            <label htmlFor="no-catalog-check" className="cursor-pointer select-none">
              <span className="font-bold text-rose-300 block">
                No requiere alta en catálogo (Desactivar aviso para este pedido)
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Tilda esta casilla si es un material descartable o de compra única que no debe agregarse a la base de datos maestra.
              </span>
            </label>
          </div>

          {!noCatalogRequired && (
            <>
              {/* 1. Nombre Normalizado */}
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Nombre Normalizado en Catálogo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setUnitMeasure(deduceUnitMeasure(e.target.value))
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-medium focus:outline-none focus:border-cyan-500"
                  required
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-500">Prefijos rápidos:</span>
                  <button type="button" onClick={() => applyNamingPattern('BULON ZINCADO')} className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 cursor-pointer">BULON</button>
                  <button type="button" onClick={() => applyNamingPattern('CAÑO INOX')} className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 cursor-pointer">CAÑO</button>
                  <button type="button" onClick={() => applyNamingPattern('CHAPA NAVAL')} className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 cursor-pointer">CHAPA</button>
                  <button type="button" onClick={() => applyNamingPattern('ELECTRODO')} className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 cursor-pointer">ELECTRODO</button>
                </div>
              </div>

              {/* 2. Categoría Estricta (Solo 3) y Unidad de Medida (Desplegable) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Categoría Oficial (Únicas 3)</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-bold focus:outline-none focus:border-cyan-500"
                  >
                    <option value="MATERIALES">MATERIALES</option>
                    <option value="CONSUMIBLES">CONSUMIBLES</option>
                    <option value="ELEM.SEGURIDAD">ELEM.SEGURIDAD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Unidad de Medida</label>
                  <select
                    value={unitMeasure}
                    onChange={(e) => setUnitMeasure(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-cyan-300 font-bold focus:outline-none focus:border-cyan-500"
                  >
                    {OFFICIAL_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 3. Rubro & Solicitud de Apertura de Nuevo Rubro */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold">Rubro Técnico (Vinculado a Pañol)</label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-amber-300 font-bold text-[11px]">
                    <input
                      type="checkbox"
                      checked={requestNewRubro}
                      onChange={(e) => setRequestNewRubro(e.target.checked)}
                      className="rounded bg-slate-900 border-amber-500 text-amber-500 focus:ring-0 cursor-pointer"
                    />
                    <span>Solicitar apertura de nuevo rubro</span>
                  </label>
                </div>

                {!requestNewRubro ? (
                  <select
                    value={rubro}
                    onChange={(e) => setRubro(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    {CATALOG_RUBROS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="Escribe el nuevo rubro propuesto (ej: FIBRA OPTICA, COMPOSITES...)"
                      value={suggestedRubro}
                      onChange={(e) => setSuggestedRubro(e.target.value)}
                      className="w-full bg-amber-950/30 border border-amber-500/60 rounded-lg p-2 text-amber-200 placeholder-amber-400/50 font-semibold focus:outline-none focus:border-amber-400 uppercase"
                      required
                    />
                    <p className="text-[10px] text-amber-300/90">
                      ⚠️ El material se creará con todos sus datos técnicos y enviará una alerta al Dashboard del Administrador para homologar y asignar el nuevo rubro.
                    </p>
                  </div>
                )}
              </div>

              {/* 4. Precio Base AR$ y % de Seguridad (Por defecto 6%) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Precio Base AR$</label>
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
                  <label className="block text-slate-300 mb-1 font-semibold">% Seguridad (Merma / Buffer Pañol)</label>
                  <select
                    value={securityFactor}
                    onChange={(e) => setSecurityFactor(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-emerald-300 font-bold focus:outline-none focus:border-cyan-500"
                  >
                    {SECURITY_FACTORS.map((sf) => (
                      <option key={sf.value} value={sf.value}>
                        {sf.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* 5. Fotografía / Imagen para B.D. Materiales */}
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  Fotografía / Imagen del Material (Opcional — Para Ficha Visual de Pañol)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files[0] || null)}
                  className="w-full text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-950 file:text-cyan-400 hover:file:bg-cyan-900 cursor-pointer bg-slate-950 border border-slate-800 rounded-lg p-1.5"
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-4 py-2 font-bold rounded-lg cursor-pointer transition-all ${
                noCatalogRequired
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
              }`}
            >
              {saving
                ? 'Procesando...'
                : noCatalogRequired
                ? 'Confirmar: Omitir Alta en Catálogo'
                : 'Aprobar Alta en Catálogo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// MODAL 3: ADJUNTAR DOCUMENTOS MULTI-ARCHIVO (+ AGREGAR OTRO ADJUNTO)
function UploadDocModal({ order, supplier, onClose, onSuccess }) {
  const [pendingDocs, setPendingDocs] = useState([
    { id: 1, docType: 'COTIZACION_MATERIAL', file: null, description: '' }
  ])
  const [uploading, setUploading] = useState(false)

  function handleAddRow() {
    setPendingDocs((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), docType: 'FICHA_TECNICA', file: null, description: '' }
    ])
  }

  function handleRemoveRow(id) {
    if (pendingDocs.length <= 1) return
    setPendingDocs((prev) => prev.filter((item) => item.id !== id))
  }

  function handleChangeRow(id, field, value) {
    setPendingDocs((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  async function handleUpload(e) {
    e.preventDefault()
    const validRows = pendingDocs.filter((r) => r.file !== null)
    if (validRows.length === 0) return alert('Por favor selecciona al menos un archivo para subir.')

    setUploading(true)
    try {
      const year = new Date().getFullYear()
      const rubro = order.work_type || 'General'
      const safeProv = (supplier?.name || 'Proveedor').replace(/[^a-zA-Z0-9_-]/g, '_')
      const createdDocs = []

      for (const row of validRows) {
        const ext = row.file.name.split('.').pop()
        const safeDesc = (row.description || 'Doc').replace(/[^a-zA-Z0-9_-]/g, '_')
        const normalizedName = `${safeDesc}_${safeProv}.${ext}`
        const storagePath = `cotizaciones/${year}/${rubro}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${normalizedName}`

        const { error: uploadError } = await supabase.storage.from('compras').upload(storagePath, row.file)
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from('compras').getPublicUrl(storagePath)

        let extractedText = null
        if (row.file && (row.file.type === 'application/pdf' || row.file.name.toLowerCase().endsWith('.pdf'))) {
          try {
            extractedText = await extractTextFromPdf(row.file)
          } catch (e) {
            console.warn('Extracción digital PDF falló:', e)
          }
        }

        const docPayload = {
          purchase_order_id: order.id,
          supplier_id: supplier?.id || null,
          original_filename: row.file.name,
          normalized_filename: normalizedName,
          storage_path: urlData.publicUrl,
          category: rubro,
          description: row.description || 'Documento adjunto',
          year,
          file_size_bytes: row.file.size,
          doc_type: row.docType,
          is_confidential_labor: row.docType === 'COTIZACION_MANO_OBRA',
          extracted_text: extractedText
        }

        const { data: newDoc, error: dbError } = await supabase.from('purchase_documents').insert([docPayload]).select().single()
        if (dbError) throw dbError
        createdDocs.push(newDoc)
      }

      onSuccess(createdDocs)
    } catch (err) {
      console.error('Error subiendo documentos:', err)
      alert('Error subiendo archivos: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-cyan-400" />
            Adjuntar Documento(s) a Compra
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleUpload} className="space-y-4 text-xs">
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
            <p className="font-semibold text-white truncate">{order.material_name_raw}</p>
            <p className="text-[10px] text-slate-400">Proveedor: {supplier?.name || 'S/D'}</p>
          </div>

          <div className="space-y-3">
            {pendingDocs.map((row, idx) => (
              <div key={row.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
                    Adjunto #{idx + 1}
                  </span>
                  {pendingDocs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      className="text-rose-400 hover:text-rose-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      ✕ Quitar
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Tipo de Documento</label>
                  <select
                    value={row.docType}
                    onChange={(e) => handleChangeRow(row.id, 'docType', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500 font-semibold"
                  >
                    <option value="COTIZACION_MATERIAL">📄 Cotización de Material (Visible en Compras)</option>
                    <option value="COTIZACION_MANO_OBRA">🔒 Cotización de Mano de Obra (Confidencial Supervisor)</option>
                    <option value="FICHA_TECNICA">📐 Ficha Técnica / Especificación de Fabricante</option>
                    <option value="IMAGEN_MUESTRA">📸 Imagen / Fotografía de Muestra o Rotura</option>
                    <option value="REMITO">🧾 Remito de Entrega</option>
                    <option value="FACTURA">💳 Factura Comercial</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Seleccionar Archivo (PDF, DOCX, JPG, PNG)</label>
                  <input
                    type="file"
                    onChange={(e) => handleChangeRow(row.id, 'file', e.target.files[0] || null)}
                    className="w-full text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-950 file:text-cyan-400 hover:file:bg-cyan-900 cursor-pointer"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Descripción Breve</label>
                  <input
                    type="text"
                    placeholder="Ej: Presupuesto Tubos, Ficha Acero Naval..."
                    value={row.description}
                    onChange={(e) => handleChangeRow(row.id, 'description', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-300 text-xs font-extrabold transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ Agregar otro adjunto</span>
            </button>
            <span className="text-[10px] text-slate-500">{pendingDocs.length} archivo(s) a subir</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={uploading} className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-extrabold rounded-lg cursor-pointer">
              {uploading ? 'Subiendo y clasificando...' : `Subir ${pendingDocs.length > 1 ? `${pendingDocs.length} Documentos` : 'Documento'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// MODAL 3B: GESTIONAR ARCHIVO EXISTENTE (EDITAR METADATOS / REEMPLAZAR ARCHIVO / ELIMINAR)
function DocActionModal({ doc, onClose, onSuccess }) {
  const [description, setDescription] = useState(doc.description || '')
  const [docType, setDocType] = useState(doc.doc_type || 'COTIZACION_MATERIAL')
  const [newFile, setNewFile] = useState(null)
  const [processing, setProcessing] = useState(false)

  async function handleUpdateMetadata(e) {
    e.preventDefault()
    setProcessing(true)
    try {
      const updates = {
        description: description.trim(),
        doc_type: docType,
        is_confidential_labor: docType === 'COTIZACION_MANO_OBRA'
      }
      const { data, error } = await supabase.from('purchase_documents').update(updates).eq('id', doc.id).select().single()
      if (error) throw error
      onSuccess({ action: 'update', updatedDoc: data })
    } catch (err) {
      alert('Error actualizando metadatos: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleReplaceFile() {
    if (!newFile) return alert('Por favor selecciona el nuevo archivo físico.')
    if (!confirm('¿Reemplazar el archivo anterior por este nuevo? El archivo anterior será eliminado de la nube.')) return

    setProcessing(true)
    try {
      const year = new Date().getFullYear()
      const rubro = doc.category || 'General'
      const ext = newFile.name.split('.').pop()
      const safeDesc = (description || 'Doc').replace(/[^a-zA-Z0-9_-]/g, '_')
      const normalizedName = `${safeDesc}_reemplazo.${ext}`
      const storagePath = `cotizaciones/${year}/${rubro}/${Date.now()}_${normalizedName}`

      // Subir nuevo archivo
      const { error: uploadError } = await supabase.storage.from('compras').upload(storagePath, newFile)
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('compras').getPublicUrl(storagePath)

      // Actualizar registro
      const updates = {
        original_filename: newFile.name,
        normalized_filename: normalizedName,
        storage_path: urlData.publicUrl,
        file_size_bytes: newFile.size
      }

      const { data, error } = await supabase.from('purchase_documents').update(updates).eq('id', doc.id).select().single()
      if (error) throw error

      onSuccess({ action: 'replace', updatedDoc: data })
    } catch (err) {
      alert('Error reemplazando archivo: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleDeleteDoc() {
    if (!confirm(`¿Eliminar definitivamente el documento "${doc.original_filename}"? Se borrará el archivo de la nube.`)) return
    setProcessing(true)
    try {
      // Borrar de base de datos
      const { error: dbError } = await supabase.from('purchase_documents').delete().eq('id', doc.id)
      if (dbError) throw dbError

      onSuccess({ action: 'delete', deletedId: doc.id })
    } catch (err) {
      alert('Error eliminando documento: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
            Gestionar Archivo Adjunto
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="space-y-4 text-xs">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <p className="font-bold text-white truncate">{doc.original_filename}</p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Fecha: {new Date(doc.created_at).toLocaleDateString('es-AR')}</p>
          </div>

          <form onSubmit={handleUpdateMetadata} className="space-y-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Tipo de Documento</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500 font-semibold"
              >
                <option value="COTIZACION_MATERIAL">📄 Cotización de Material</option>
                <option value="COTIZACION_MANO_OBRA">🔒 Cotización de Mano de Obra (Confidencial)</option>
                <option value="FICHA_TECNICA">📐 Ficha Técnica</option>
                <option value="IMAGEN_MUESTRA">📸 Imagen / Foto de Muestra</option>
                <option value="REMITO_FACTURA">🧾 Remito o Factura</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Descripción</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="submit"
              disabled={processing}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition-colors"
            >
              Guardar Cambios de Metadatos
            </button>
          </form>

          {/* Reemplazo de archivo físico */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <label className="block text-slate-400 font-semibold">Reemplazar Archivo Físico</label>
            <input
              type="file"
              onChange={(e) => setNewFile(e.target.files[0])}
              className="w-full text-slate-300 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:bg-slate-800 file:text-cyan-300"
            />
            {newFile && (
              <button
                type="button"
                onClick={handleReplaceFile}
                disabled={processing}
                className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg transition-all"
              >
                Subir y Reemplazar Archivo
              </button>
            )}
          </div>

          {/* Eliminar definitivo */}
          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={handleDeleteDoc}
              disabled={processing}
              className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar Documento</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// MODAL 4: CONCILIAR CON FACTURA ("LÍNEA MORADA")
function ReconcileModal({ target, purchaseOrders, onClose, onSuccess }) {
  const isDetailMode = target?.mode === 'detail'
  const isSelectedMode = target?.mode === 'selected'
  const [invoiceNumber, setInvoiceNumber] = useState(target?.currentInvoice || '')
  const [reconcileAllPrior, setReconcileAllPrior] = useState(!isSelectedMode && !isDetailMode)

  const eligibleOrders = useMemo(() => {
    if (isSelectedMode && Array.isArray(target?.selectedIds)) {
      return purchaseOrders.filter((po) => target.selectedIds.includes(po.id))
    }
    if (isDetailMode) {
      return purchaseOrders.filter((po) => po.id === target.orderId)
    }
    return purchaseOrders.filter((po) => {
      if (target.supplierId && po.supplier_id !== target.supplierId) return false
      if (po.is_reconciled) return false
      if (reconcileAllPrior) return po.order_date <= target.orderDate
      return po.id === target.orderId
    })
  }, [purchaseOrders, target, reconcileAllPrior, isSelectedMode, isDetailMode])

  function handleSubmit(e) {
    e.preventDefault()
    if (!invoiceNumber.trim()) return alert('Debe ingresar el número de factura o remito.')
    onSuccess({
      invoiceNumber: invoiceNumber.trim(),
      orderIds: eligibleOrders.map((o) => o.id),
      action: 'reconcile'
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-purple-400">🟣</span>
              {isDetailMode ? 'Detalle de Conciliación' : 'Conciliación con Factura'}
            </h3>
            <p className="text-xs text-slate-400">
              {isSelectedMode
                ? `Aplicación masiva sobre ${eligibleOrders.length} fila(s) seleccionada(s)`
                : `Auditoría contable para ${target.supplierName || 'Proveedor'}`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        {isDetailMode && (
          <div className="bg-purple-950/40 border border-purple-700/60 rounded-xl p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-purple-300 font-bold">Estado actual:</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-600/30 text-purple-200 font-bold text-[10px]">
                🟣 CONCILIADO
              </span>
            </div>
            <p className="text-slate-300">
              Comprobante: <strong className="text-white font-mono">{target.currentInvoice || 'S/N'}</strong>
            </p>
            {target.reconciledAt && (
              <p className="text-[11px] text-slate-400">
                Fecha: {new Date(target.reconciledAt).toLocaleString('es-AR')}
                {target.reconciledBy ? ` • Por: ${target.reconciledBy}` : ''}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">
              {isDetailMode ? 'Modificar Número de Factura o Remito' : 'Número de Factura o Remito Proveedor'}
            </label>
            <input
              type="text"
              placeholder="Ej: FC-A-0004-9844"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono uppercase focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          {!isSelectedMode && !isDetailMode && target.supplierId && (
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={reconcileAllPrior}
                  onChange={(e) => setReconcileAllPrior(e.target.checked)}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <span>Conciliar hasta aquí (incluir todas las anteriores pendientes del proveedor)</span>
              </label>
              <p className="text-[11px] text-purple-300">
                Se marcarán <strong className="text-white">{eligibleOrders.length} compras</strong> de este proveedor como
                conciliadas bajo este comprobante.
              </p>
            </div>
          )}

          {isSelectedMode && (
            <div className="bg-purple-950/30 p-3 rounded-xl border border-purple-800/60 space-y-1.5">
              <p className="text-[11px] text-purple-200 font-semibold">
                Se aplicará la conciliación a las <strong className="text-white">{eligibleOrders.length} filas tildadas</strong>:
              </p>
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                {eligibleOrders.map((po) => (
                  <div key={po.id} className="flex items-center justify-between text-[10px] text-slate-300 bg-slate-950/70 px-2 py-1 rounded">
                    <span className="truncate font-semibold">{po.material_name}</span>
                    <span className="text-slate-400 font-mono shrink-0 ml-2">{po.supplier?.name || 'S/Prov'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
            {isDetailMode ? (
              <button
                type="button"
                onClick={() =>
                  onSuccess({
                    invoiceNumber: null,
                    orderIds: [target.orderId],
                    action: 'unreconcile'
                  })
                }
                className="px-3 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold rounded-lg cursor-pointer"
              >
                Quitar Conciliación
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={eligibleOrders.length === 0}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer"
              >
                {isDetailMode ? 'Actualizar Comprobante' : `Confirmar (${eligibleOrders.length})`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// MODAL 5: ALTA / EDICIÓN DE PROVEEDOR (COMBOBOX MULTI-RUBRO)
function SupplierModal({ supplier, onClose, onSuccess }) {
  const [name, setName] = useState(supplier?.name || '')
  const [cuitCuil, setCuitCuil] = useState(supplier?.cuit_cuil || '')
  const [phone, setPhone] = useState(supplier?.phone || '')
  const [email, setEmail] = useState(supplier?.email || '')
  const [address, setAddress] = useState(supplier?.address || '')
  const [isLocalSupplier, setIsLocalSupplier] = useState(supplier?.is_local_supplier ?? true)
  const [contactName, setContactName] = useState(supplier?.contact_name || '')
  const [paymentMethod, setPaymentMethod] = useState(supplier?.payment_method || 'CUENTA_CORRIENTE')
  const [billingMedium, setBillingMedium] = useState(supplier?.billing_medium || 'EMAIL')
  const [isGasSupplier, setIsGasSupplier] = useState(supplier?.is_gas_supplier || false)
  const [clientNumber, setClientNumber] = useState(supplier?.client_number || '')
  const [orderCutoffDay, setOrderCutoffDay] = useState(supplier?.order_cutoff_day || '')
  const [deliveryDay, setDeliveryDay] = useState(supplier?.delivery_day || '')
  const [observations, setObservations] = useState(supplier?.observations || '')

  // Rubros múltiples (Array de tags)
  const [selectedTrades, setSelectedTrades] = useState(
    supplier?.trades && supplier?.trades.length > 0
      ? supplier.trades
      : supplier?.trade
      ? [supplier.trade]
      : ['FERRETERIA']
  )
  const [newTradeInput, setNewTradeInput] = useState('')
  const [saving, setSaving] = useState(false)

  function handleToggleTrade(trade) {
    if (selectedTrades.includes(trade)) {
      setSelectedTrades(selectedTrades.filter((t) => t !== trade))
    } else {
      setSelectedTrades([...selectedTrades, trade])
    }
  }

  function handleAddNewTrade() {
    if (!newTradeInput.trim()) return
    const clean = newTradeInput.trim().toUpperCase()
    if (!selectedTrades.includes(clean)) {
      setSelectedTrades([...selectedTrades, clean])
    }
    setNewTradeInput('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return alert('Debe ingresar el nombre del proveedor.')
    if (selectedTrades.length === 0) return alert('Debe seleccionar al menos un rubro para el proveedor.')

    setSaving(true)
    try {
      const payload = {
        name: name.trim().toUpperCase(),
        trades: selectedTrades,
        trade: selectedTrades.join(', '), // Retrocompatibilidad
        cuit_cuil: cuitCuil.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        is_local_supplier: Boolean(isLocalSupplier),
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
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
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

          {/* COMBOBOX MULTI-RUBRO (CHIPS + ESCRIBIR NUEVO) */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
            <label className="block text-slate-400 font-semibold flex items-center justify-between">
              <span>Rubros Asignados (Multi-Selección)</span>
              <span className="text-[10px] text-cyan-400 font-bold">{selectedTrades.length} seleccionados</span>
            </label>

            {/* Chips de rubros seleccionados */}
            <div className="flex flex-wrap gap-1.5 min-h-[28px] p-1.5 bg-slate-900 rounded-lg border border-slate-800">
              {selectedTrades.length === 0 ? (
                <span className="text-[11px] text-slate-500 italic">Selecciona rubros abajo o escribe uno nuevo</span>
              ) : (
                selectedTrades.map((t, idx) => (
                  <span
                    key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 text-[10px] font-bold"
                  >
                    <span>{t}</span>
                    <button type="button" onClick={() => handleToggleTrade(t)} className="text-cyan-400 hover:text-white">✕</button>
                  </span>
                ))
              )}
            </div>

            {/* Rubros comunes para tildar rápido */}
            <div className="flex flex-wrap gap-1 pt-1">
              {STANDARD_TRADES.map((st) => {
                const isChecked = selectedTrades.includes(st)
                return (
                  <button
                    key={st}
                    type="button"
                    onClick={() => handleToggleTrade(st)}
                    className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${
                      isChecked
                        ? 'bg-cyan-500 text-slate-950 font-bold'
                        : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {isChecked ? `✓ ${st}` : `+ ${st}`}
                  </button>
                )
              })}
            </div>

            {/* Input para agregar nuevo rubro libre */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Escribir otro rubro nuevo..."
                value={newTradeInput}
                onChange={(e) => setNewTradeInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleAddNewTrade()
                  }
                }}
                className="flex-1 bg-slate-900 border border-slate-750 rounded-lg px-2.5 py-1 text-xs text-white uppercase"
              />
              <button
                type="button"
                onClick={handleAddNewTrade}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-semibold"
              >
                + Agregar
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">CUIT / CUIL</label>
              <input
                type="text"
                placeholder="30-50014764-9"
                value={cuitCuil}
                onChange={(e) => setCuitCuil(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Teléfono / WhatsApp</label>
              <input
                type="text"
                placeholder="+5492234810922"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Dirección Física (Mar del Plata)</label>
              <input
                type="text"
                placeholder="Ej: Juan B. Justo 1420"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>
            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={isLocalSupplier}
                  onChange={(e) => setIsLocalSupplier(e.target.checked)}
                  className="rounded border-slate-700 text-cyan-600 focus:ring-cyan-500"
                />
                <span>🛵 Proveedor Local (Retiro por Mandado)</span>
              </label>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Email</label>
              <input
                type="email"
                placeholder="contacto@proveedor.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

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

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg">Cancelar</button>
            <button type="submit" disabled={saving} className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg">
              {saving ? 'Guardando...' : supplier ? 'Guardar Cambios' : 'Registrar Proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// MODAL 6: DESPACHO POR WHATSAPP (SOPORTE 2 COMPRADORES & 0810)
function BatchOrderWhatsAppModal({ selectedOrderIds, purchaseOrders, suppliers, systemSettings, onClose, onSuccess }) {
  // Configuración de los 2 compradores (desde systemSettings o fallback)
  const buyer1 = systemSettings?.buyer_1 || { name: 'Jorge Sentis', phone: '+5492235000001', is_active: true }
  const buyer2 = systemSettings?.buyer_2 || { name: 'Andrés', phone: '+5492235000002', is_active: true }

  const [selectedBuyer, setSelectedBuyer] = useState('buyer_1')

  const activeBuyer = selectedBuyer === 'buyer_1' ? buyer1 : buyer2

  // Agrupar los pedidos seleccionados por proveedor
  const batchData = useMemo(() => {
    const selected = purchaseOrders.filter((p) => selectedOrderIds.has(p.id))
    const map = new Map()
    selected.forEach((po) => {
      const sup = suppliers.find((s) => s.id === po.supplier_id) || {
        id: 'unknown',
        name: 'Sin Proveedor Asignado',
        phone: ''
      }
      if (!map.has(sup.id)) {
        map.set(sup.id, { supplier: sup, items: [] })
      }
      map.get(sup.id).items.push(po)
    })
    return Array.from(map.values())
  }, [selectedOrderIds, purchaseOrders, suppliers])

  function buildWhatsAppText(supplierName, items) {
    const hasIncompleto = items.some((i) => i.status === 'PEDIDO INCOMPLETO')

    if (hasIncompleto) {
      let text = `Estimados ${supplierName},\n`
      items.forEach((item) => {
        const orderDateFormatted = item.order_date || 'reciente'
        const remitoText = item.remito_number ? `según Remito N° ${item.remito_number}` : ''
        const origQty = (Number(item.quantity) || 0) + (Number(item.missing_quantity) || 0)
        const recQty = Number(item.received_quantity) || (origQty > item.quantity ? origQty - item.quantity : 0)
        const missQty = Number(item.quantity) || Number(item.missing_quantity) || 0

        text += `Acusamos recibo de la entrega para Astillero Alon Car correspondiente a la orden de compra del día ${orderDateFormatted} ${remitoText}.\n`
        text += `Sobre el pedido de ${origQty} ${item.unit_measure || 'unidades'} de ${item.material_name_raw}, se recibieron físicamente ${recQty} ${item.unit_measure || 'unidades'}.\n`
        text += `Quedan pendientes de entrega ${missQty} ${item.unit_measure || 'unidades'}.\n`
      })
      text += `Agradecemos nos confirmen la fecha estimada de despacho del saldo faltante.\n\n`
      text += `Atte. Departamento de Compras Alon Car S.A.`
      return encodeURIComponent(text)
    }

    let text = `*SOLICITUD DE COMPRA - ALON CAR S.A.*\n`
    text += `Estimados *${supplierName}*,\n`
    text += `Por medio de la presente solicitamos cotización/entrega de los siguientes materiales:\n\n`

    items.forEach((item, idx) => {
      text += `*${idx + 1}.* ${item.material_name_raw} — Cantidad: *${item.quantity} ${item.unit_measure || 'unidades'}*`
      if (item.observations) text += ` _(Nota: ${item.observations})_`
      text += `\n`
    })

    text += `\n_Por favor confirmar disponibilidad y plazos de entrega._\n`
    text += `Muchas gracias.\n*Solicitado por: ${activeBuyer.name}*\n*Astillero & Metalúrgica Alon Car S.A.* (Tel: ${activeBuyer.phone})`
    return encodeURIComponent(text)
  }

  async function handleEmitOrder(supplier, items) {
    const rawPhone = supplier.phone || ''
    const isLandlineOr0810 = rawPhone.startsWith('0810') || rawPhone.startsWith('0800')

    if (isLandlineOr0810) {
      alert(`El proveedor ${supplier.name} opera con línea fija / 0810 (${rawPhone}). Utilice el botón de llamada telefónica.`)
      return
    }

    const cleanFormatted = formatArgPhoneForWhatsApp(rawPhone)
    const encodedText = buildWhatsAppText(supplier.name, items)
    const url = cleanFormatted ? `https://api.whatsapp.com/send?phone=${cleanFormatted}&text=${encodedText}` : `https://api.whatsapp.com/send?text=${encodedText}`

    try {
      const ids = items.map((i) => i.id)
      for (const id of ids) {
        await supabase.from('purchase_orders').update({ status: 'PEDIDO', updated_at: new Date().toISOString() }).eq('id', id)
      }
      window.open(url, '_blank')
      onSuccess(ids)
    } catch (err) {
      alert('Error al emitir pedido: ' + err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              Emitir Pedidos Agrupados por WhatsApp
            </h3>
            <p className="text-xs text-slate-400">
              Seleccione el comprador emisor. Los pedidos se agrupan automáticamente por proveedor.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        {/* SELECTOR DE LOS 2 COMPRADORES */}
        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
          <label className="block text-slate-400 font-semibold text-xs">
            Seleccionar Comprador Emisor (Firma el mensaje):
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedBuyer('buyer_1')}
              className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                selectedBuyer === 'buyer_1'
                  ? 'bg-cyan-950 border-cyan-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <div>
                <p className="font-bold text-xs">{buyer1.name}</p>
                <p className="text-[10px] text-slate-400">{buyer1.role || 'Administración'} • {buyer1.phone}</p>
              </div>
              {selectedBuyer === 'buyer_1' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
            </button>

            <button
              type="button"
              onClick={() => setSelectedBuyer('buyer_2')}
              className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                selectedBuyer === 'buyer_2'
                  ? 'bg-blue-950 border-blue-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <div>
                <p className="font-bold text-xs">{buyer2.name}</p>
                <p className="text-[10px] text-slate-400">{buyer2.role || 'Pañol'} • {buyer2.phone}</p>
              </div>
              {selectedBuyer === 'buyer_2' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
            </button>
          </div>
        </div>

        {/* LISTA AGRUPADA POR PROVEEDOR */}
        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
          {batchData.map(({ supplier, items }) => {
            const rawPhone = supplier.phone || ''
            const is0810 = rawPhone.startsWith('0810') || rawPhone.startsWith('0800')

            return (
              <div key={supplier.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm">{supplier.name}</h4>
                    <p className="text-[10px] text-slate-400">
                      {supplier.phone ? `Tel: ${supplier.phone}` : '⚠️ Sin teléfono registrado'}
                      {supplier.client_number && ` • N° Cliente: ${supplier.client_number}`}
                    </p>
                  </div>

                  {is0810 ? (
                    <a
                      href={`tel:${rawPhone.replace(/[^0-9]/g, '')}`}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Llamar al {rawPhone}</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleEmitOrder(supplier, items)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Abrir WhatsApp ({items.length} ítems)</span>
                    </button>
                  )}
                </div>

                <ul className="divide-y divide-slate-850 text-xs text-slate-300">
                  {items.map((it) => (
                    <li key={it.id} className="py-1 flex items-center justify-between">
                      <span>{it.material_name_raw}</span>
                      <span className="font-mono text-cyan-400 font-bold">
                        {it.quantity} {it.unit_measure || 'unidades'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}


// ==============================================================================
// MODAL 7: GESTOR DE ADJUNTOS DE LA LÍNEA (MULTIDOCUMENTO: COTIZACIONES, FICHAS, FOTOS)
// ==============================================================================
function OrderAttachmentsModal({ order, documents, suppliers, ships, workOrders, onClose, onDocAdded, onDocUpdated, onDocDeleted }) {
  const lineDocs = documents.filter((d) => d.purchase_order_id === order.id)
  const sup = suppliers.find((s) => s.id === order.supplier_id)
  const shp = ships.find((s) => s.id === order.ship_id)
  const wo = workOrders.find((w) => w.id === order.work_order_id)

  const [uploading, setUploading] = useState(false)
  const [pendingDocs, setPendingDocs] = useState([
    { id: 1, docType: 'COTIZACION_MATERIAL', file: null, description: '' }
  ])
  const [showDocAction, setShowDocAction] = useState(null)

  function handleAddRow() {
    setPendingDocs((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), docType: 'FICHA_TECNICA', file: null, description: '' }
    ])
  }

  function handleRemoveRow(id) {
    if (pendingDocs.length <= 1) return
    setPendingDocs((prev) => prev.filter((item) => item.id !== id))
  }

  function handleChangeRow(id, field, value) {
    setPendingDocs((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  async function handleAddDoc(e) {
    e.preventDefault()
    const validRows = pendingDocs.filter((r) => r.file !== null)
    if (validRows.length === 0) return alert('Por favor selecciona al menos un archivo para subir.')

    setUploading(true)
    try {
      const year = new Date().getFullYear()
      const rubro = order.work_type || 'General'
      const safeProv = (sup?.name || 'Proveedor').replace(/[^a-zA-Z0-9_-]/g, '_')

      for (const row of validRows) {
        const ext = row.file.name.split('.').pop()
        const safeDesc = (row.description || 'Doc').replace(/[^a-zA-Z0-9_-]/g, '_')
        const normalizedName = `${safeDesc}_${safeProv}.${ext}`
        const storagePath = `cotizaciones/${year}/${rubro}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${normalizedName}`

        const { error: uploadError } = await supabase.storage.from('compras').upload(storagePath, row.file)
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from('compras').getPublicUrl(storagePath)

        let extractedText = null
        if (row.file && (row.file.type === 'application/pdf' || row.file.name.toLowerCase().endsWith('.pdf'))) {
          try {
            extractedText = await extractTextFromPdf(row.file)
          } catch (e) {
            console.warn('Extracción digital PDF falló:', e)
          }
        }

        const docPayload = {
          purchase_order_id: order.id,
          supplier_id: order.supplier_id || null,
          original_filename: row.file.name,
          normalized_filename: normalizedName,
          storage_path: urlData.publicUrl,
          category: rubro,
          description: row.description || 'Documento adjunto',
          year,
          file_size_bytes: row.file.size,
          doc_type: row.docType,
          is_confidential_labor: row.docType === 'COTIZACION_MANO_OBRA',
          extracted_text: extractedText
        }

        const { data: newDoc, error: dbError } = await supabase.from('purchase_documents').insert([docPayload]).select().single()
        if (dbError) throw dbError

        onDocAdded(newDoc)
      }

      setPendingDocs([{ id: Date.now(), docType: 'COTIZACION_MATERIAL', file: null, description: '' }])
    } catch (err) {
      console.error('Error subiendo documento:', err)
      alert('Error al subir archivo: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
        {/* Cabecera */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Paperclip className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                Adjuntar Documento a Compra
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">
                  {lineDocs.length} adjunto{lineDocs.length === 1 ? '' : 's'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {order.material_name_raw} ({order.quantity} {order.unit_measure || 'un.'}) — Proveedor: {sup?.name || 'S/D'} | Buque: {shp?.name || 'ASTILLERO'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-base">✕</button>
        </div>

        {/* Listado de Documentos Existentes */}
        {lineDocs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Archivos actualmente guardados en esta compra:
            </h4>
            <div className="space-y-2">
              {lineDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white text-xs truncate max-w-[280px]" title={doc.original_filename}>
                          {doc.original_filename}
                        </p>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                            doc.doc_type === 'COTIZACION_MANO_OBRA'
                              ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                              : doc.doc_type === 'FICHA_TECNICA'
                              ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                              : doc.doc_type === 'IMAGEN_MUESTRA'
                              ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                              : doc.doc_type === 'REMITO' || doc.doc_type === 'REMITO_FACTURA'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                              : 'bg-purple-950/80 text-purple-300 border-purple-800'
                          }`}
                        >
                          {doc.doc_type === 'COTIZACION_MATERIAL' ? '📄 Cotiz. Material'
                            : doc.doc_type === 'COTIZACION_MANO_OBRA' ? '🔒 Mano de Obra'
                            : doc.doc_type === 'FICHA_TECNICA' ? '📐 Ficha Técnica'
                            : doc.doc_type === 'IMAGEN_MUESTRA' ? '📸 Muestra / Foto'
                            : doc.doc_type === 'REMITO' ? '🧾 Remito'
                            : doc.doc_type}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {doc.description || 'Sin notas'} • {(doc.file_size_bytes / 1024).toFixed(1)} KB • {new Date(doc.created_at).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={doc.storage_path}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Ver</span>
                    </a>
                    <button
                      onClick={() => setShowDocAction(doc)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Opciones avanzadas (modificar, reemplazar, eliminar)"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Zona Dinámica para Adjuntar 1 o Más Documentos (+ Agregar otro adjunto) */}
        <div className="pt-2 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-cyan-400" />
              Subir Nuevo(s) Documento(s) a esta Orden
            </h4>
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/70 text-emerald-300 text-xs font-extrabold transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ Agregar otro adjunto</span>
            </button>
          </div>

          <form onSubmit={handleAddDoc} className="space-y-3 text-xs">
            <div className="space-y-3">
              {pendingDocs.map((row, index) => (
                <div key={row.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
                      Nuevo Adjunto #{index + 1}
                    </span>
                    {pendingDocs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="text-rose-400 hover:text-rose-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        ✕ Quitar fila
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Tipo de Documento</label>
                      <select
                        value={row.docType}
                        onChange={(e) => handleChangeRow(row.id, 'docType', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500 font-semibold"
                      >
                        <option value="COTIZACION_MATERIAL">📄 Cotización de Material (Visible en Compras)</option>
                        <option value="COTIZACION_MANO_OBRA">🔒 Cotización de Mano de Obra (Confidencial)</option>
                        <option value="FICHA_TECNICA">📐 Ficha Técnica / Manual Naval</option>
                        <option value="IMAGEN_MUESTRA">📸 Fotografía de Muestra / Rotura</option>
                        <option value="REMITO">🧾 Remito de Entrega</option>
                        <option value="FACTURA">💳 Factura Comercial</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Descripción Breve</label>
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => handleChangeRow(row.id, 'description', e.target.value)}
                        placeholder="Ej: Presupuesto Tubos, Ficha Acero Naval..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Seleccionar Archivo (PDF, DOCX, JPG, PNG)</label>
                    <input
                      type="file"
                      onChange={(e) => handleChangeRow(row.id, 'file', e.target.files[0] || null)}
                      className="w-full text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-950 file:text-cyan-400 hover:file:bg-cyan-900 cursor-pointer"
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>+ Agregar otro adjunto</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold rounded-lg text-xs shadow-md shadow-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 stroke-[2.5]" />}
                  <span>
                    {uploading
                      ? 'Subiendo...'
                      : `Subir ${pendingDocs.length > 1 ? `${pendingDocs.length} Documentos` : 'Documento'}`}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {/* Modal de Acción sobre un Archivo Individual */}
        {showDocAction && (
          <DocActionModal
            doc={showDocAction}
            onClose={() => setShowDocAction(null)}
            onSuccess={({ action, updatedDoc, deletedId }) => {
              if (action === 'delete') {
                onDocDeleted(deletedId)
              } else {
                onDocUpdated(updatedDoc)
              }
              setShowDocAction(null)
            }}
          />
        )}
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL 8: RECEPCIÓN PARCIAL / PEDIDO INCOMPLETO (DIVISIÓN LIMPIA & RECLAMO)
// ==============================================================================
function PartialDeliveryModal({ order, suppliers, ships, workOrders, onClose, onSuccess }) {
  const sup = suppliers.find((s) => s.id === order.supplier_id)
  const shp = ships.find((s) => s.id === order.ship_id)
  const wo = workOrders.find((w) => w.id === order.work_order_id)

  const originalQty = Number(order.quantity) || 1
  const [receivedQty, setReceivedQty] = useState(Math.max(1, Math.floor(originalQty * 0.8)))
  const [remitoNumber, setRemitoNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const [processing, setProcessing] = useState(false)

  const missingQty = Math.max(0, originalQty - Number(receivedQty))

  async function handleSubmit(e) {
    e.preventDefault()
    if (Number(receivedQty) <= 0) return alert('La cantidad recibida debe ser mayor a 0.')
    if (Number(receivedQty) >= originalQty) return alert('Para una recepción completa de todas las unidades, usa el estado "RECIBIDO".')
    if (!remitoNumber.trim()) return alert('Por favor indica el Número de Remito de la entrega.')

    setProcessing(true)
    try {
      // 1. Actualizar orden original a la cantidad recibida y estado RECIBIDO
      const receivedStatus = order.charge_type === 'DIRECT' ? 'RECIB.COMP.DIRECT' : 'RECIBIDO'
      const originalUpdates = {
        quantity: Number(receivedQty),
        received_quantity: Number(receivedQty),
        missing_quantity: missingQty,
        remito_number: remitoNumber.trim(),
        status: receivedStatus,
        notes: (order.notes ? order.notes + ' | ' : '') + `Recepción parcial (${receivedQty}/${originalQty}) s/Remito ${remitoNumber}. ${notes}`,
        updated_at: new Date().toISOString()
      }

      // Si es pañol, sumar al stock
      if (order.charge_type === 'VIA_PANOL' && order.material_id) {
        const { data: matData } = await supabase.from('materials').select('current_stock').eq('id', order.material_id).single()
        if (matData) {
          const newStock = (matData.current_stock || 0) + Number(receivedQty)
          await supabase.from('materials').update({ current_stock: newStock }).eq('id', order.material_id)
        }
      }

      const { data: updatedOriginal, error: errOrig } = await supabase
        .from('purchase_orders')
        .update(originalUpdates)
        .eq('id', order.id)
        .select()
        .single()
      if (errOrig) throw errOrig

      // 2. Crear orden hija con la cantidad faltante en estado PEDIDO INCOMPLETO
      const childPayload = {
        charge_type: order.charge_type,
        order_date: order.order_date,
        ship_id: order.ship_id,
        work_order_id: order.work_order_id,
        requested_by_name: order.requested_by_name,
        work_type: order.work_type,
        material_id: order.material_id,
        material_name_raw: order.material_name_raw,
        is_new_material: order.is_new_material,
        quantity: missingQty,
        missing_quantity: missingQty,
        received_quantity: 0,
        unit_measure: order.unit_measure,
        supplier_id: order.supplier_id,
        supplier_quoted_price: order.supplier_quoted_price,
        system_unit_price: order.system_unit_price,
        currency: order.currency || 'ARS',
        status: 'PEDIDO INCOMPLETO',
        urgency: order.urgency || 'URGENTE',
        parent_order_id: order.id,
        remito_number: remitoNumber.trim(),
        fortnight_period: order.fortnight_period,
        notes: `Saldo faltante de orden anterior. Remito parcial: ${remitoNumber}. ${notes}`
      }

      const { data: childOrder, error: errChild } = await supabase
        .from('purchase_orders')
        .insert([childPayload])
        .select()
        .single()
      if (errChild) throw errChild

      // 3. Subir archivos de evidencia si se seleccionaron
      const newDocs = []
      if (evidenceFiles.length > 0) {
        const year = new Date().getFullYear()
        for (const f of evidenceFiles) {
          const ext = f.name.split('.').pop()
          const storagePath = `cotizaciones/${year}/remitos/${Date.now()}_remito_${remitoNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`
          const { error: upErr } = await supabase.storage.from('compras').upload(storagePath, f)
          if (!upErr) {
            const { data: urlData } = supabase.storage.from('compras').getPublicUrl(storagePath)
            const docPayload = {
              purchase_order_id: order.id,
              supplier_id: order.supplier_id || null,
              original_filename: f.name,
              normalized_filename: `Remito_${remitoNumber}.${ext}`,
              storage_path: urlData.publicUrl,
              category: 'REMITO',
              description: `Remito de entrega parcial ${remitoNumber} (${receivedQty}/${originalQty})`,
              year,
              file_size_bytes: f.size,
              doc_type: 'REMITO',
              is_confidential_labor: false
            }
            const { data: docRes } = await supabase.from('purchase_documents').insert([docPayload]).select().single()
            if (docRes) newDocs.push(docRes)
          }
        }
      }

      onSuccess({ originalOrder: updatedOriginal, childOrder, newDocs })
    } catch (err) {
      console.error('Error procesando recepción parcial:', err)
      alert('Error: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-950 border border-orange-800 flex items-center justify-center text-orange-400">
              <Split className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                Recepción Parcial de Mercadería
                <span className="text-[10px] px-2 py-0.5 rounded bg-orange-950 border border-orange-800 text-orange-300 font-bold">
                  PEDIDO INCOMPLETO
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Registra las unidades que llegaron y separa automáticamente el saldo faltante para reclamo.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Resumen del Material */}
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <p className="font-bold text-white text-sm">{order.material_name_raw}</p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
              <span>Cantidad Original: <strong className="text-white">{originalQty} {order.unit_measure || 'un.'}</strong></span>
              <span>Buque: <strong className="text-cyan-300">{shp?.name || 'ASTILLERO'}</strong></span>
              <span>Proveedor: <strong className="text-slate-200">{sup?.name || 'S/D'}</strong></span>
            </div>
          </div>

          {/* Desglose de Cantidades */}
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div>
              <label className="block text-emerald-400 font-bold mb-1">
                ✅ Cantidad Recibida Físicamente
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                max={originalQty - 0.01}
                value={receivedQty}
                onChange={(e) => setReceivedQty(e.target.value)}
                className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg p-2.5 text-white font-mono font-bold text-sm focus:outline-none focus:border-emerald-400"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Ingresan a Pañol / Obra
              </span>
            </div>

            <div>
              <label className="block text-orange-400 font-bold mb-1">
                ⚠️ Cantidad Faltante a Reclamar
              </label>
              <div className="w-full bg-slate-900 border border-orange-500/40 rounded-lg p-2.5 text-orange-300 font-mono font-extrabold text-sm flex items-center justify-between">
                <span>{missingQty}</span>
                <span className="text-xs text-slate-400 font-normal">{order.unit_measure || 'un.'}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Pasa a estado PEDIDO INCOMPLETO
              </span>
            </div>
          </div>

          {/* Número de Remito Obligatorio */}
          <div>
            <label className="block text-slate-300 font-bold mb-1">
              Nº de Remito del Proveedor <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={remitoNumber}
              onChange={(e) => setRemitoNumber(e.target.value)}
              placeholder="Ej: R-0004-00012345"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          {/* Subir Evidencia (Remito / Fotos) */}
          <div>
            <label className="block text-slate-300 font-bold mb-1">
              Fotos del Remito y Mercadería (Evidencia para el Reclamo)
            </label>
            <input
              type="file"
              multiple
              onChange={(e) => setEvidenceFiles(Array.from(e.target.files))}
              className="w-full text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-950 file:text-cyan-400 hover:file:bg-cyan-900 cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Se adjuntará automáticamente a la orden para respaldo de compras.
            </span>
          </div>

          {/* Observaciones */}
          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Observaciones del Pañolero / Motivo informado por el chofer
            </label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Chofer informa que no había stock suficiente, entregan el saldo la próxima semana..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={processing}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-slate-950 font-extrabold rounded-lg shadow-md shadow-orange-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Split className="w-4 h-4 stroke-[2.5]" />}
              <span>{processing ? 'Procesando...' : 'Confirmar Recepción y Separar Faltante'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL 9: ALERTA SE COMPRA? (GERENCIA & JEFE DE OBRA)
// ==============================================================================
function SeCompraAlertModal({ order, alertSettings, ships, workOrders, onClose }) {
  const shp = ships.find((s) => s.id === order.ship_id)
  const wo = workOrders.find((w) => w.id === order.work_order_id)

  const hugo = alertSettings?.hugo || { name: 'Hugo Sentis', phone: '+5492235000001', email: 'hugo@aloncar.com', enabled: true }
  const martin = alertSettings?.martin || { name: 'Martín Sentis', phone: '+5492235000002', email: 'martin@aloncar.com', enabled: true }

  const shipName = shp?.name || 'ASTILLERO'
  const otTitle = wo?.title || 'Stock'

  const messageText = `Alerta Alon Car - Compra 'SE COMPRA?':\nMaterial: ${order.material_name_raw} (${order.quantity} ${order.unit_measure || 'un.'})\nBuque: ${shipName} | OT: ${otTitle}\nSolicita: ${order.requested_by_name || 'PAÑOL'}\nPor favor confirmar si se procede con la adquisición.`

  function handleSendWhatsApp(phone) {
    const clean = phone.replace(/[^0-9]/g, '')
    const url = `https://web.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(messageText)}`
    window.open(url, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-950 border border-pink-800 flex items-center justify-center text-pink-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                Alerta Gerencial: "SE COMPRA?"
              </h3>
              <p className="text-[11px] text-slate-400">
                La compra requiere evaluación y confirmación de jefatura antes de emitirse.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
          <p className="font-bold text-white text-sm">{order.material_name_raw}</p>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
            <span>Cantidad: <strong className="text-white">{order.quantity} {order.unit_measure || 'un.'}</strong></span>
            <span>Buque: <strong className="text-cyan-300">{shipName}</strong></span>
            <span>OT: <strong className="text-slate-200">{otTitle}</strong></span>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <p className="font-bold text-slate-300">Destinatarios Notificados:</p>

          {hugo.enabled && (
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{hugo.name} (Gerente General)</p>
                <p className="text-[10px] text-slate-500 font-mono">{hugo.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => handleSendWhatsApp(hugo.phone)}
                className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <MessageSquare className="w-3 h-3" />
                <span>WhatsApp</span>
              </button>
            </div>
          )}

          {martin.enabled && (
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{martin.name} (Gerente Operaciones)</p>
                <p className="text-[10px] text-slate-500 font-mono">{martin.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => handleSendWhatsApp(martin.phone)}
                className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <MessageSquare className="w-3 h-3" />
                <span>WhatsApp</span>
              </button>
            </div>
          )}

          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">Jefe de Obra OT</p>
              <p className="text-[10px] text-slate-500">Asignado al buque {shipName}</p>
            </div>
            <span className="text-[10px] text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
              Notificado
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold rounded-lg text-xs cursor-pointer shadow-md"
          >
            Entendido / Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL 10: ASIGNAR PROVEEDOR EN LOTE (CON BUSCADOR POR INICIALES)
// ==============================================================================
function AssignSupplierModal({ selectedOrderIds, suppliers, onClose, onSuccess }) {
  const [searchText, setSearchText] = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || '')
  const [saving, setSaving] = useState(false)

  const filteredSuppliers = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter((s) => {
      const nameMatch = (s.name || '').toLowerCase().includes(q)
      const tradeMatch = (s.trade || '').toLowerCase().includes(q) || (s.trades || []).some((t) => t.toLowerCase().includes(q))
      return nameMatch || tradeMatch
    })
  }, [suppliers, searchText])

  async function handleAssign(e) {
    e.preventDefault()
    if (!selectedSupplierId) return alert('Por favor selecciona un proveedor.')

    setSaving(true)
    try {
      const idsArray = Array.from(selectedOrderIds)
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          supplier_id: selectedSupplierId,
          updated_at: new Date().toISOString()
        })
        .in('id', idsArray)

      if (error) throw error
      onSuccess(selectedSupplierId)
    } catch (err) {
      console.error('Error asignando proveedor en lote:', err)
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                Asignar Proveedor en Bloque
              </h3>
              <p className="text-[11px] text-slate-400">
                Se aplicará el proveedor elegido a los {selectedOrderIds.size} pedidos seleccionados.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleAssign} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Filtrar Proveedor por Nombre o Rubro
            </label>
            <input
              type="text"
              autoFocus
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value)
                const q = e.target.value.trim().toLowerCase()
                const firstMatch = suppliers.find((s) => (s.name || '').toLowerCase().includes(q))
                if (firstMatch) setSelectedSupplierId(firstMatch.id)
              }}
              placeholder="Escribir iniciales (ej: FER, AIR, PRAX...)"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white mb-2 focus:outline-none focus:border-cyan-500"
            />

            <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
              Resultados ({filteredSuppliers.length}):
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-semibold focus:outline-none focus:border-cyan-500"
              required
            >
              {filteredSuppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.trade || (s.trades && s.trades.join(', ')) || 'General'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{saving ? 'Asignando...' : `Asignar a ${selectedOrderIds.size} Pedidos`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// COMPONENTE AUXILIAR: BUSCADOR / AUTOCOMPLETE IN-SITU DE PROVEEDOR (300+ PROVEEDORES)
// ==============================================================================
function InlineSupplierPicker({ suppliers, currentSupplierId, onSelect, onCancel }) {
  const currentSup = suppliers.find((s) => s.id === currentSupplierId)
  const [query, setQuery] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const containerRef = useRef(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return suppliers.slice(0, 50)
    return suppliers.filter((s) => {
      const nameMatch = (s.name || '').toLowerCase().includes(q)
      const tradeMatch = (s.trade || '').toLowerCase().includes(q) || (s.trades || []).some((t) => t.toLowerCase().includes(q))
      return nameMatch || tradeMatch
    })
  }, [suppliers, query])

  useEffect(() => {
    setHighlightIdx(0)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onCancel()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onCancel])

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlightIdx]) {
        onSelect(filtered[highlightIdx].id)
      }
    }
  }

  return (
    <div ref={containerRef} className="relative z-50 min-w-[200px]">
      <input
        type="text"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={currentSup ? `Actual: ${currentSup.name} (filtrar...)` : 'Escribir iniciales...'}
        className="w-full bg-slate-950 border-2 border-cyan-400 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-400 focus:outline-none shadow-lg"
      />
      <div className="absolute left-0 top-full mt-1 w-64 max-h-56 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 divide-y divide-slate-800/80 text-xs">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="w-full text-left px-3 py-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-300 text-[11px] italic cursor-pointer"
        >
          -- Sin Proveedor (Quitar asignación) --
        </button>
        {filtered.length === 0 ? (
          <div className="px-3 py-2.5 text-slate-500 text-center text-[11px]">
            Sin coincidencias para "{query}"
          </div>
        ) : (
          filtered.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              onMouseEnter={() => setHighlightIdx(idx)}
              className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                idx === highlightIdx ? 'bg-cyan-950 text-cyan-200 font-bold' : 'text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span className="truncate">{s.name}</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 shrink-0">
                {s.trade || (s.trades && s.trades[0]) || 'Gral'}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// MODAL 4B: ASIGNAR DATOS DE FLETE Y TRANSPORTE (ICONO CAMIÓN EN ACCIONES)
function FreightModal({ order, onClose, onSuccess }) {
  const todayIso = new Date().toISOString().split('T')[0]
  const [transportName, setTransportName] = useState(order?.freight_transport_name || '')
  const [requestDate, setRequestDate] = useState(order?.freight_request_date || todayIso)
  const [estimatedDate, setEstimatedDate] = useState(order?.freight_estimated_date || '')

  function handleSubmit(e) {
    e.preventDefault()
    onSuccess({
      freight_transport_name: transportName.trim() || null,
      freight_request_date: requestDate || null,
      freight_estimated_date: estimatedDate || null
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-400" />
              Datos de Flete / Transporte
            </h3>
            <p className="text-xs text-slate-400 truncate max-w-[320px]">
              Material: <strong className="text-slate-200">{order?.material_name}</strong>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 mb-1 font-bold">Nombre del Transporte / Comisionista</label>
            <input
              type="text"
              autoFocus
              placeholder="Ej: Cruz del Sur / Expreso Tas / Flete propio..."
              value={transportName}
              onChange={(e) => setTransportName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1 font-bold">Fecha de Solicitud</label>
              <input
                type="date"
                value={requestDate}
                onClick={(e) => {
                  if (typeof e.currentTarget.showPicker === 'function') {
                    try { e.currentTarget.showPicker() } catch { /* ignore */ }
                  }
                }}
                onChange={(e) => setRequestDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono focus:outline-none focus:border-amber-400 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Por defecto hoy (editable)</span>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-bold">Fecha Entrega Estimada (Flete)</label>
              <input
                type="date"
                value={estimatedDate}
                onClick={(e) => {
                  if (typeof e.currentTarget.showPicker === 'function') {
                    try { e.currentTarget.showPicker() } catch { /* ignore */ }
                  }
                }}
                onChange={(e) => setEstimatedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-amber-200 font-mono focus:outline-none focus:border-amber-400 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Independiente de F. Entrega tabla</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
            {(order?.freight_transport_name || order?.freight_request_date || order?.freight_estimated_date) ? (
              <button
                type="button"
                onClick={() =>
                  onSuccess({
                    freight_transport_name: null,
                    freight_request_date: null,
                    freight_estimated_date: null
                  })
                }
                className="px-3 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold rounded-lg cursor-pointer"
              >
                Limpiar Flete
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Guardar Flete
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL: ASISTENTE INTELIGENTE DE SELECCIÓN DE PROVEEDOR (HISTÓRICO Y FRECUENCIA)
// ==============================================================================
function SupplierHelperModal({ order, purchaseOrders, suppliers, ships, workOrders, onClose, onApply }) {
  const [activeTab, setActiveTab] = useState('material') // 'material' | 'trade'
  const [selectedTrade, setSelectedTrade] = useState('')
  const [searchDesc, setSearchDesc] = useState('')
  const [applyingId, setApplyingId] = useState(null)

  const materialQuery = (order?.material_name_raw || '').trim().toLowerCase()

  // 1. Coincidencias en el histórico por Nombre de Material
  const materialHistory = useMemo(() => {
    if (!materialQuery) return []
    const keywords = materialQuery.split(/\s+/).filter((w) => w.length > 2)

    const matches = purchaseOrders.filter((po) => {
      if (po.id === order.id) return false
      if (!po.supplier_id) return false
      const name = (po.material_name_raw || '').toLowerCase()
      if (name.includes(materialQuery)) return true
      if (keywords.length > 0 && keywords.some((kw) => name.includes(kw))) return true
      return false
    })

    if (matches.length === 0) return []

    const groupMap = new Map()
    matches.forEach((po) => {
      const sup = suppliers.find((s) => s.id === po.supplier_id)
      if (!sup) return

      if (!groupMap.has(po.supplier_id)) {
        groupMap.set(po.supplier_id, {
          supplier: sup,
          count: 0,
          orders: []
        })
      }
      const entry = groupMap.get(po.supplier_id)
      entry.count++
      entry.orders.push(po)
    })

    const totalMatches = matches.length
    const results = Array.from(groupMap.values()).map((item) => {
      item.orders.sort((a, b) => new Date(b.order_date || 0) - new Date(a.order_date || 0))
      const last = item.orders[0]
      const lastPrice = last.supplier_quoted_price || last.system_unit_price || null
      const percentage = Math.round((item.count / totalMatches) * 100)

      return {
        supplier: item.supplier,
        count: item.count,
        percentage,
        lastPrice,
        lastDate: last.order_date,
        lastOrder: last
      }
    })

    results.sort((a, b) => b.count - a.count)
    return results
  }, [materialQuery, purchaseOrders, suppliers, order.id])

  useEffect(() => {
    if (materialHistory.length === 0 && activeTab === 'material') {
      setActiveTab('trade')
    }
  }, [materialHistory, activeTab])

  // 2. Coincidencias por Rubro
  const tradeSuppliers = useMemo(() => {
    if (!selectedTrade) return []
    const cleanTrade = selectedTrade.toUpperCase()

    const sups = suppliers.filter((s) => {
      if (s.trades && Array.isArray(s.trades) && s.trades.includes(cleanTrade)) return true
      if (s.trade && s.trade.toUpperCase().includes(cleanTrade)) return true
      return false
    })

    const results = sups.map((sup) => {
      let lastPrice = null
      let lastDate = null
      const supOrders = purchaseOrders.filter((po) => po.supplier_id === sup.id)
      const count = supOrders.length

      if (searchDesc.trim()) {
        const qDesc = searchDesc.toLowerCase()
        const descMatches = supOrders.filter((po) => (po.material_name_raw || '').toLowerCase().includes(qDesc))
        if (descMatches.length > 0) {
          descMatches.sort((a, b) => new Date(b.order_date || 0) - new Date(a.order_date || 0))
          lastPrice = descMatches[0].supplier_quoted_price || descMatches[0].system_unit_price || null
          lastDate = descMatches[0].order_date
        }
      } else if (supOrders.length > 0) {
        supOrders.sort((a, b) => new Date(b.order_date || 0) - new Date(a.order_date || 0))
        lastPrice = supOrders[0].supplier_quoted_price || supOrders[0].system_unit_price || null
        lastDate = supOrders[0].order_date
      }

      return {
        supplier: sup,
        count,
        lastPrice,
        lastDate
      }
    })

    const maxCount = Math.max(1, ...results.map((r) => r.count))
    return results.map((r) => ({
      ...r,
      percentage: Math.round((r.count / maxCount) * 100)
    })).sort((a, b) => b.count - a.count)
  }, [selectedTrade, suppliers, purchaseOrders, searchDesc])

  async function handleFastLoad(entry) {
    setApplyingId(entry.supplier.id)
    const today = new Date().toISOString().split('T')[0]
    const updates = {
      supplier_id: entry.supplier.id,
      order_date: order.order_date || today,
      supplier_quoted_price: entry.lastPrice ?? order.supplier_quoted_price ?? null,
      system_unit_price: entry.lastPrice ?? order.system_unit_price ?? null
    }
    await onApply(order.id, updates)
    setApplyingId(null)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl animate-in fade-in duration-150">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
              <Lightbulb className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Asistente Inteligente de Proveedores
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-300 uppercase font-black">
                  Frecuencia & Métricas
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Material solicitado:{' '}
                <strong className="text-white font-mono">{order.material_name_raw || 'Sin material especificado'}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('material')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'material'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>Histórico del Material</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeTab === 'material' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'
            }`}>
              {materialHistory.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('trade')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'trade'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>Buscar por Rubro de Proveedor</span>
          </button>
        </div>

        {activeTab === 'material' && (
          <div className="space-y-3">
            {materialHistory.length > 0 ? (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {materialHistory.map((entry) => (
                  <div
                    key={entry.supplier.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-amber-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-xs">{entry.supplier.name}</span>
                        {entry.supplier.is_local_supplier && (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 text-[9px] font-bold">
                            Local MDP
                          </span>
                        )}
                        {entry.supplier.phone && (
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5 text-cyan-400" />
                            {entry.supplier.phone}
                          </span>
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-amber-400 font-bold">
                            {entry.count} compra(s) registrada(s) ({entry.percentage}% de frecuencia)
                          </span>
                          {entry.lastPrice && (
                            <span className="text-emerald-400 font-bold">
                              Último: ${Number(entry.lastPrice).toLocaleString('es-AR')} {entry.lastDate ? `(${entry.lastDate})` : ''}
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                            style={{ width: `${entry.percentage}%` }}
                          />
                        </div>
                      </div>

                      {entry.supplier.address && (
                        <p className="text-[10px] text-slate-500 truncate">
                          📍 {entry.supplier.address}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={applyingId === entry.supplier.id}
                      onClick={() => handleFastLoad(entry)}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 shrink-0 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {applyingId === entry.supplier.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 fill-slate-950" />
                      )}
                      <span>⚡ Cargar Pedido</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 text-center space-y-2">
                <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                <p className="text-xs text-white font-bold">No hay compras previas registradas para este material exacto.</p>
                <p className="text-[11px] text-slate-400">
                  Usa la pestaña <strong>"Buscar por Rubro de Proveedor"</strong> para sugerir proveedores del sector según su frecuencia de compra.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'trade' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">1. Seleccionar Rubro del Proveedor</label>
                <select
                  value={selectedTrade}
                  onChange={(e) => setSelectedTrade(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-bold focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Seleccionar Rubro --</option>
                  {STANDARD_TRADES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">2. Descripción / Filtro Opcional</label>
                <input
                  type="text"
                  placeholder="Ej: planchuela, bulón, electrodo..."
                  value={searchDesc}
                  onChange={(e) => setSearchDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {selectedTrade ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {tradeSuppliers.length > 0 ? (
                  tradeSuppliers.map((entry) => (
                    <div
                      key={entry.supplier.id}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-amber-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 flex-1 min-w-0 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white">{entry.supplier.name}</span>
                          {entry.supplier.is_local_supplier && (
                            <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 text-[9px] font-bold">
                              Local MDP
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">
                            {entry.supplier.phone ? `📞 ${entry.supplier.phone}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>{entry.count} compra(s) en {selectedTrade}</span>
                          {entry.lastPrice && (
                            <span className="text-emerald-400 font-bold">
                              Ref: ${Number(entry.lastPrice).toLocaleString('es-AR')}
                            </span>
                          )}
                        </div>
                        {entry.supplier.address && (
                          <p className="text-[10px] text-slate-500 truncate">📍 {entry.supplier.address}</p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={applyingId === entry.supplier.id}
                        onClick={() => handleFastLoad(entry)}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 shrink-0 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {applyingId === entry.supplier.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 fill-slate-950" />
                        )}
                        <span>⚡ Cargar Pedido</span>
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="p-4 text-center text-xs text-slate-500 italic">
                    No se encontraron proveedores registrados con el rubro "{selectedTrade}".
                  </p>
                )}
              </div>
            ) : (
              <p className="p-4 text-center text-xs text-slate-500 italic">
                Selecciona un rubro arriba para ver los proveedores sugeridos y sus métricas de compra.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
          <span className="text-[11px] text-slate-500">
            💡 Asigna proveedor y último precio registrado. Soporta Ctrl+Z para deshacer.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL: GESTIÓN DE MANDADOS Y RETIROS LOCALES POR WHATSAPP
// ==============================================================================
function MandadosModal({ purchaseOrders, suppliers, workers, preselectedIds = [], onClose }) {
  const candidateOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (preselectedIds.includes(po.id)) return true
      if (!['PEDIDO', 'PEDIDO INCOMPLETO'].includes(po.status)) return false
      const sup = suppliers.find((s) => s.id === po.supplier_id)
      return Boolean(sup?.is_local_supplier)
    })
  }, [purchaseOrders, suppliers, preselectedIds])

  const [selectedIds, setSelectedIds] = useState(() => {
    if (preselectedIds.length > 0) return new Set(preselectedIds)
    return new Set(candidateOrders.map((p) => p.id))
  })

  const defaultWorker = useMemo(() => {
    const mandadero = workers.find((w) => (w.trade || '').toUpperCase().includes('MANDADO'))
    if (mandadero) return mandadero.id
    const withPhone = workers.find((w) => w.phone && w.phone.trim())
    return withPhone?.id || (workers[0]?.id || '')
  }, [workers])

  const [selectedWorkerId, setSelectedWorkerId] = useState(defaultWorker)
  const [copied, setCopied] = useState(false)

  const selectedWorker = useMemo(() => {
    return workers.find((w) => w.id === selectedWorkerId)
  }, [workers, selectedWorkerId])

  const groupedOrders = useMemo(() => {
    const groups = new Map()
    selectedIds.forEach((id) => {
      const po = candidateOrders.find((p) => p.id === id)
      if (!po) return
      const sup = suppliers.find((s) => s.id === po.supplier_id)
      const supKey = sup?.id || 'SIN_PROV'
      const supName = sup?.name || 'PROVEEDOR S/D'
      const supAddress = sup?.address || 'Mar del Plata'

      if (!groups.has(supKey)) {
        groups.set(supKey, {
          supplier: sup,
          name: supName,
          address: supAddress,
          items: []
        })
      }
      groups.get(supKey).items.push(po)
    })
    return Array.from(groups.values())
  }, [selectedIds, candidateOrders, suppliers])

  const messageText = useMemo(() => {
    const workerFirstName = (selectedWorker?.name || 'compañero').split(',')[0].split(' ')[0].toLowerCase()
    let msg = `buenas ${workerFirstName}, podes pasar a retirar por favor:\n\n`

    groupedOrders.forEach((grp) => {
      msg += `📍 ${grp.name} (${grp.address}):\n`
      grp.items.forEach((it) => {
        const qty = Number(it.quantity) || 1
        const u = it.unit_measure ? ` ${it.unit_measure}` : ''
        const mat = it.material_name_raw || 'Material'
        msg += ` - ${qty}${u} ${mat}\n`
      })
      msg += '\n'
    })

    msg += `*⚠️ Por favor retirar remito/factura.*`.trim()
    return msg
  }, [groupedOrders, selectedWorker])

  function toggleSelectAll() {
    if (selectedIds.size === candidateOrders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(candidateOrders.map((p) => p.id)))
    }
  }

  function toggleItem(id) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function handleCopy() {
    navigator.clipboard.writeText(messageText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function handleSendWhatsApp() {
    const cleanPhone = (selectedWorker?.phone || '').replace(/\D/g, '')
    if (!cleanPhone) {
      alert(`El operario "${selectedWorker?.name || 'seleccionado'}" no tiene cargado un número de teléfono en Nómina. Por favor agrégalo en el módulo Personal o copia el mensaje manualmente.`)
      return
    }
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
    window.open(url, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl p-6 space-y-4 shadow-2xl animate-in fade-in duration-150">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/10 text-xl">
              🛵
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Pedido de Mandado (Retiro Local)
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 uppercase font-black">
                  WhatsApp Inteligente
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Selecciona los materiales emitidos a retirar de proveedores locales y envía la orden agrupada al mandadero en 1 clic.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg">✕</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Operario Responsable de Mandados
            </label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-bold focus:outline-none focus:border-cyan-500"
            >
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.trade ? `(${w.trade})` : ''} {w.phone ? `• ${w.phone}` : '• S/Tel'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-center">
            <span className="text-slate-400 text-[11px]">Destino de Notificación:</span>
            <div className="flex items-center gap-2 mt-0.5 font-mono text-xs">
              <span className="text-white font-bold">{selectedWorker?.name || 'Sin seleccionar'}</span>
              {selectedWorker?.phone ? (
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold">
                  {selectedWorker.phone}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300">
                  ⚠️ Sin Teléfono
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">
                Materiales Emitidos a Prov. Locales ({selectedIds.size}/{candidateOrders.length})
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold"
              >
                {selectedIds.size === candidateOrders.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
              {candidateOrders.length > 0 ? (
                candidateOrders.map((po) => {
                  const isChecked = selectedIds.has(po.id)
                  const sup = suppliers.find((s) => s.id === po.supplier_id)
                  return (
                    <label
                      key={po.id}
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-cyan-950/40 border-cyan-500/50 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(po.id)}
                        className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white truncate">{po.material_name_raw || 'Material'}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {Number(po.quantity) || 1} {po.unit_measure || 'un.'} • <strong className="text-cyan-300">{sup?.name || 'S/Prov'}</strong> {sup?.address ? `(${sup.address})` : ''}
                        </p>
                      </div>
                    </label>
                  )
                })
              ) : (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-slate-500">
                  No hay pedidos pendientes de retiro de proveedores locales.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 flex flex-col">
            <span className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
              <span>Vista Previa del Mensaje</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">WhatsApp</span>
            </span>

            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-emerald-200/90 whitespace-pre-wrap max-h-[300px] overflow-y-auto leading-relaxed shadow-inner">
              {messageText}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Copiado!' : 'Copiar Mensaje'}</span>
            </button>

            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={handleSendWhatsApp}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <MessageSquare className="w-4 h-4 stroke-[2.5]" />
              <span>Enviar WhatsApp a {selectedWorker?.name?.split(',')[0]?.split(' ')[0] || 'Mandadero'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
