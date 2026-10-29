import { useState, useEffect, useMemo } from 'react'
import {
  ClipboardList,
  Plus,
  Search,
  Ship,
  Clock,
  User,
  Wrench,
  Check,
  X,
  Pencil,
  Trash2,
  Layers,
  Sparkles,
  MessageSquare,
  Send,
  ShieldCheck,
  Eye,
  GitBranch,
  Calendar,
  ArrowRight,
  UserPlus,
  Info,
  Lock,
  ExternalLink
} from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Grupos del Catálogo de Trabajos (OT.ABC)
const GRUPOS_CATALOGO = ['Renovación', 'Intermediaria']

// 8 Estados Oficiales del Ciclo de Vida de un Trabajo (GS-003 UNIFICADO)
const ESTADOS_TRABAJO = [
  {
    value: 'Pendiente de inicio',
    label: 'Pendiente de inicio',
    color: 'text-amber-300 bg-amber-950/80 border-amber-600/80',
    dot: 'bg-amber-400'
  },
  {
    value: 'En ejecución',
    label: 'En ejecución (Habilitado p/ Costos)',
    color: 'text-emerald-300 bg-emerald-950/80 border-emerald-500/80',
    dot: 'bg-emerald-400'
  },
  {
    value: 'Finalizado',
    label: 'Finalizado',
    color: 'text-cyan-300 bg-cyan-950/80 border-cyan-600/80',
    dot: 'bg-cyan-400'
  },
  {
    value: 'Pendiente remito',
    label: 'Pendiente remito',
    color: 'text-blue-300 bg-blue-950/80 border-blue-600/80',
    dot: 'bg-blue-400'
  },
  {
    value: 'Remito realizado/Pdte firma',
    label: 'Remito realizado/Pdte firma',
    color: 'text-indigo-300 bg-indigo-950/80 border-indigo-500/80',
    dot: 'bg-indigo-400'
  },
  {
    value: 'Finalizado costo final de obra',
    label: 'Finalizado costo final de obra',
    color: 'text-teal-300 bg-teal-950/80 border-teal-600/80',
    dot: 'bg-teal-400'
  },
  {
    value: 'Facturado',
    label: 'Facturado - CERRADO',
    color: 'text-purple-300 bg-purple-950/80 border-purple-500/80',
    dot: 'bg-purple-400'
  },
  {
    value: 'Desestimado',
    label: 'Desestimado',
    color: 'text-rose-300 bg-rose-950/80 border-rose-700/80',
    dot: 'bg-rose-400'
  }
]

// Tipos de Trabajo (Columna W de GS-003)
const TIPOS_DE_TRABAJO = [
  { value: 'HORA', label: 'Hora (Mano de Obra Directa)' },
  { value: 'PRESUPUESTO', label: 'Presupuesto (Ajuste Alzado / PRC)' },
  { value: 'CONTROL', label: 'Control (Inspección / Seguimiento)' }
]

// Formatear fecha YYYY-MM-DD a DD/MM/AA o DD/MM/AAAA
function formatShortDate(isoStr, fullYear = false) {
  if (!isoStr) return '—'
  const clean = String(isoStr).split('T')[0]
  const parts = clean.split('-')
  if (parts.length !== 3) return clean
  const [y, m, d] = parts
  return fullYear ? `${d}/${m}/${y}` : `${d}/${m}/${y.slice(-2)}`
}

// Determina si un trabajo u OT fue desestimado por eliminación (sin borrar el registro para no alterar el consecutivo)
function isWorkItemEliminada(item, wo) {
  if (item?.status !== 'Desestimado' && wo?.status !== 'Cancelada') return false
  const commentText = String(item?.comments || '').toUpperCase()
  const notesText = String(wo?.notes || '').toUpperCase()
  return commentText.includes('ELIMINADA') || notesText.includes('[ELIMINADA]')
}

// Limpia la etiqueta interna [ELIMINADA] del comentario visible para mostrarla como leyenda dedicada
function cleanWorkItemComment(comment) {
  if (!comment) return ''
  return String(comment)
    .replace(/\[ELIMINADA\]\s*Desestimada por eliminación\s*\|?\s*/gi, '')
    .replace(/\|\s*\[ELIMINADA\]\s*Desestimada por eliminación/gi, '')
    .replace(/\[ELIMINADA\]/gi, '')
    .trim()
}

// Cálculo automático del estado de la OT (Contenedor) a partir de sus trabajos hijos (work_items)
function computeOtState(wo, items = []) {
  const isDeletedWo =
    (wo?.notes || '').toUpperCase().includes('[ELIMINADA]') ||
    (items.length > 0 && items.every(i => i.status === 'Desestimado' && isWorkItemEliminada(i, wo)))

  if (!items || items.length === 0) {
    if (isDeletedWo || wo?.status === 'Cancelada') {
      return {
        label: 'Desestimado (Eliminada)',
        color: 'text-rose-300 bg-rose-950/80 border-rose-700',
        canClose: true,
        activeCount: 0,
        totalCount: 0,
        isEliminada: true
      }
    }
    return {
      label: 'Sin trabajos cargados',
      color: 'text-slate-400 bg-slate-900 border-slate-700',
      canClose: true,
      activeCount: 0,
      totalCount: 0,
      isEliminada: false
    }
  }

  const validItems = items.filter(i => i.status !== 'Desestimado')
  if (validItems.length === 0) {
    return {
      label: isDeletedWo ? 'Desestimado (Eliminada)' : 'Desestimada',
      color: 'text-rose-300 bg-rose-950/80 border-rose-700',
      canClose: true,
      activeCount: 0,
      totalCount: items.length,
      isEliminada: isDeletedWo
    }
  }

  const inExecutionCount = validItems.filter(i => i.status === 'En ejecución').length
  const pendingStartCount = validItems.filter(i => i.status === 'Pendiente de inicio').length
  const billedCount = validItems.filter(i => i.status === 'Facturado').length

  if (inExecutionCount > 0) {
    return {
      label: `En ejecución (${inExecutionCount}/${validItems.length} act.)`,
      color: 'text-emerald-300 bg-emerald-950/80 border-emerald-500/80',
      canClose: false,
      activeCount: inExecutionCount,
      totalCount: items.length,
      isEliminada: false
    }
  }

  if (billedCount === validItems.length) {
    return {
      label: wo?.allow_post_billing_costs ? 'Facturada (Abierta Arrastre)' : 'Facturada - CERRADA',
      color: 'text-purple-300 bg-purple-950/80 border-purple-500/80',
      canClose: true,
      activeCount: 0,
      totalCount: items.length,
      isEliminada: false
    }
  }

  if (pendingStartCount === validItems.length) {
    return {
      label: 'Pendiente de inicio',
      color: 'text-amber-300 bg-amber-950/80 border-amber-600/80',
      canClose: false,
      activeCount: 0,
      totalCount: items.length,
      isEliminada: false
    }
  }

  return {
    label: 'Trabajos Finalizados (Lista p/ Cierre)',
    color: 'text-cyan-300 bg-cyan-950/80 border-cyan-500/80',
    canClose: true,
    activeCount: 0,
    totalCount: items.length,
    isEliminada: false
  }
}

// Evaluación de Alertas automáticas por trabajo (Columnas N, O, P de GS-003)
function evaluateWorkItemAlerts(item, wo) {
  const alerts = []
  if (!wo?.title?.trim() && item.description?.trim() && item.status === 'En ejecución') {
    alerts.push({ code: 'S/OT', label: 'Falta nombre de OT', color: 'bg-rose-950 text-rose-300 border-rose-700' })
  }
  if (wo?.title?.trim() && item.status !== 'Desestimado' && !item.description?.trim()) {
    alerts.push({ code: 'S/DESCRPCN', label: 'Falta descripción del trabajo', color: 'bg-amber-950 text-amber-300 border-amber-700' })
  }
  const hasContractors = Array.isArray(item.contractors) && item.contractors.length > 0
  if (wo?.title?.trim() && item.status !== 'Desestimado' && item.description?.trim() && !hasContractors) {
    alerts.push({ code: 'S/CONTRATISTA', label: 'Falta asignar contratista', color: 'bg-orange-950 text-orange-300 border-orange-700' })
  }
  return alerts
}

export default function WorkOrders() {
  const { user } = useAuth()

  // Datos principales desde Supabase
  const [ships, setShips] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [workItems, setWorkItems] = useState([])
  const [workers, setWorkers] = useState([])
  const [templates, setTemplates] = useState([])
  const [thirdPartyServices, setThirdPartyServices] = useState([])
  const [laborLogs, setLaborLogs] = useState([])
  const [inventoryTx, setInventoryTx] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState(null)

  // Pestaña activa principal
  const [activeMainTab, setActiveMainTab] = useState('unificado') // 'unificado' | 'ots' | 'terceros'

  // Filtros
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedShipFilter, setSelectedShipFilter] = useState('todos')
  const [selectedOtFilter, setSelectedOtFilter] = useState('todas')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('todos')
  const [selectedForemanFilter, setSelectedForemanFilter] = useState('todos')
  const [selectedContractorFilter, setSelectedContractorFilter] = useState('todos')

  // Modal de Creación / Edición de Trabajo + OT
  const [isWorkModalOpen, setIsWorkModalOpen] = useState(false)
  const [editingWorkItem, setEditingWorkItem] = useState(null)
  const [savingWork, setSavingWork] = useState(false)

  // Caja in-situ para crear un nuevo Jefe de Obra sin salir del menú de OT (Único rubro disponible: TECNICOS)
  const [isCreatingForemanInline, setIsCreatingForemanInline] = useState(false)
  const [newForemanForm, setNewForemanForm] = useState({
    name: '',
    trade: 'TECNICOS'
  })
  const [savingNewForeman, setSavingNewForeman] = useState(false)

  // Selección múltiple de OTs del Catálogo OT.ABC (para abrir 5-6 OTs al mismo tiempo cuando sube el barco)
  // Cada ítem: { template_id, ot_title, description, status }
  const [selectedBatchTemplates, setSelectedBatchTemplates] = useState([])
  const [inlineCatalogSearch, setInlineCatalogSearch] = useState('')
  const [showInlineMultiPicker, setShowInlineMultiPicker] = useState(false)

  // Ayuda auto-entrenable para Tipo de Facturación (Centro de Facturación)
  const [billingTypeHelp, setBillingTypeHelp] = useState(() => {
    try {
      const saved = localStorage.getItem('aloncar_billing_type_help_v1')
      if (saved) return JSON.parse(saved)
    } catch {
      // ignore storage errors
    }
    return {
      presupuestoGeneral: 'Pendiente definir.',
      adicionalEspecifico: 'Pendiente definir.'
    }
  })
  const [isEditingBillingHelp, setIsEditingBillingHelp] = useState(false)

  // Formulario en cascada (Barco -> OT Existente o Nueva [Tabulada/Libre] -> Trabajo)
  const [workForm, setWorkForm] = useState({
    ship_id: '',
    ot_mode: 'new', // 'existing' | 'new'
    existing_wo_id: '',
    ot_creation_type: 'tabulada', // 'tabulada' | 'libre'
    selected_template_id: '',
    ot_number: 'OT-1',
    ot_title: '',
    created_date: new Date().toISOString().split('T')[0],
    description: '',
    status: 'En ejecución',
    foreman_name: '',
    work_type: 'HORA',
    assignment_type: 'Presupuesto General',
    specific_budget_id: '',
    contractors: [],
    comments: '',
    send_to_third_party_prc: false,
    specific_observations: ''
  })

  // Buscador por escritura en tiempo real para Contratista(s) / Grupo(s) de Trabajo
  const [contractorSelectInput, setContractorSelectInput] = useState('')
  const [isContractorListOpen, setIsContractorListOpen] = useState(false)

  // Modal para Separar / Independizar un Trabajo de un Contenedor OT
  const [separatingRow, setSeparatingRow] = useState(null)
  const [separateForm, setSeparateForm] = useState({
    mode: 'new_ot', // 'new_ot' | 'existing_ot'
    ot_creation_type: 'libre', // 'tabulada' | 'libre'
    selected_template_id: '',
    new_ot_number: 'OT-1',
    new_ot_title: '',
    target_existing_wo_id: '',
    migrate_linked_records: true,
    reason: 'Se independiza el trabajo en una OT propia para seguimiento y facturación individual'
  })
  const [savingSeparate, setSavingSeparate] = useState(false)

  // Modal de Carga Guiada en Cascada en Terceros (1. Barco -> 2. Contratista 3ros -> 3. OT en ejecución)
  const [isThirdPartyCascadeOpen, setIsThirdPartyCascadeOpen] = useState(false)
  const [tpCascadeForm, setTpCascadeForm] = useState({
    ship_id: '',
    contractor_name: '',
    work_item_id: '',
    service_date: new Date().toISOString().split('T')[0],
    status: 'PRC',
    voucher_number: '',
    amount_ars: 0,
    specific_observations: ''
  })
  const [savingTpCascade, setSavingTpCascade] = useState(false)

  // Modal de Catálogo de Trabajos (OT.ABC) con soporte de selección múltiple y estado individual
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [templatePickerFromForm, setTemplatePickerFromForm] = useState(false)
  const [templateEdit, setTemplateEdit] = useState(null)
  const [templateSearch, setTemplateSearch] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [catalogMultiSelection, setCatalogMultiSelection] = useState([]) // [{ template_id, ot_title, description, status }]

  // Modal de Ficha 360° de OT / Botón Ampliar / Cierre DEC-011
  const [selectedWoDetail, setSelectedWoDetail] = useState(null)
  const [isAmpliarModalOpen, setIsAmpliarModalOpen] = useState(false)
  const [ampliarText, setAmpliarText] = useState('')
  const [submittingAmpliar, setSubmittingAmpliar] = useState(false)

  // Edición de Observaciones en Terceros (Directas vs Específicas)
  const [editingThirdParty, setEditingThirdParty] = useState(null)
  const [savingThirdParty, setSavingThirdParty] = useState(false)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [shipsRes, wosRes, itemsRes, workersRes, tplRes, tpRes, logsRes, invRes] = await Promise.all([
        supabase.from('ships').select('*').order('name'),
        supabase.from('work_orders').select('*, ships(name, client_name)').order('created_at', { ascending: false }),
        supabase.from('work_items').select('*').order('created_at', { ascending: true }),
        supabase.from('workers').select('*').order('name'),
        supabase.from('ot_templates').select('*').order('sort_order').order('name'),
        supabase.from('third_party_services').select('*').order('created_at', { ascending: false }),
        supabase.from('labor_logs').select('id, work_order_id, work_item_id, hours_worked, hours_normal, hours_extra_50, hours_extra_100, worker_name, date_logged'),
        supabase.from('inventory_transactions').select('id, work_order_id, work_item_id, transaction_date, quantity_withdrawn, contractor_name')
      ])

      if (shipsRes.data) setShips(shipsRes.data)
      if (wosRes.data) setWorkOrders(wosRes.data)
      if (itemsRes.data) setWorkItems(itemsRes.data)
      if (workersRes.data) setWorkers(workersRes.data)
      if (tplRes.data) setTemplates(tplRes.data)
      if (tpRes.data) setThirdPartyServices(tpRes.data)
      if (logsRes.data) setLaborLogs(logsRes.data)
      if (invRes.data) setInventoryTx(invRes.data)
    } catch (err) {
      console.error('Error cargando datos de OTs:', err)
      setStatusMessage({ type: 'error', text: 'Error al cargar datos del módulo de Órdenes de Trabajo.' })
    } finally {
      setLoading(false)
    }
  }

  // 1. Lista dinámica de Jefes de Obra desde el Padrón de Personal (workers.is_foreman = true)
  const foremenList = useMemo(() => {
    const fromWorkers = workers
      .filter(w => w.is_foreman && w.status !== 'INACTIVO')
      .map(w => w.name)
    if (fromWorkers.length > 0) return Array.from(new Set(fromWorkers)).sort()
    return ['ALE CAMADELLI', 'HUGO OBREGOZO', 'MARTIN OBREGOZO', 'PABLO N.']
  }, [workers])

  // 2. Mapa de Contratistas / Grupos de Trabajo desde el Padrón con su permiso "3ros" (can_charge_third_party)
  const contractorCatalog = useMemo(() => {
    const map = new Map()

    // Agregar rubros internos de Astillero (como en B.D.IMPORTADA de GS-003: ASTILLERO.CALDERERIA, Raschinaje, etc.)
    const astilleroTrades = new Set(['CALDERERIA', 'RASCHINAJE', 'CARPINTERIA', 'MECANICA', 'PINTURA', 'ELECTRICIDAD', 'TORNERIA'])
    workers.forEach(w => {
      if (w.admin_center === 'ASTILLERO' && w.trade) {
        astilleroTrades.add(w.trade.trim().toUpperCase())
      }
    })
    Array.from(astilleroTrades).sort().forEach(trade => {
      const label = `ASTILLERO.${trade}`
      const has3ros = workers.some(w => w.admin_center === 'ASTILLERO' && (w.trade || '').toUpperCase() === trade && w.can_charge_third_party)
      map.set(label, {
        name: label,
        admin_center: 'ASTILLERO',
        trade,
        can_charge_third_party: has3ros
      })
    })

    // Agregar Grupos de Contratistas y Talleres del Padrón
    workers.forEach(w => {
      if (w.status === 'INACTIVO') return
      const grp = (w.work_group || '').trim()
      if (!grp || grp === 'ASTILLERO') return
      const cleanGroup = grp.replace(/\s+AYUDANTE$/, '').trim()
      if (!map.has(cleanGroup)) {
        map.set(cleanGroup, {
          name: cleanGroup,
          admin_center: w.admin_center || 'CONTRATISTA',
          trade: w.trade || 'General',
          can_charge_third_party: Boolean(w.can_charge_third_party)
        })
      } else if (w.can_charge_third_party) {
        map.get(cleanGroup).can_charge_third_party = true
      }
    })

    return Array.from(map.values()).sort((a, b) => {
      if (a.admin_center === 'ASTILLERO' && b.admin_center !== 'ASTILLERO') return -1
      if (a.admin_center !== 'ASTILLERO' && b.admin_center === 'ASTILLERO') return 1
      return a.name.localeCompare(b.name)
    })
  }, [workers])

  const contractorPermissionsMap = useMemo(() => {
    const map = new Map()
    contractorCatalog.forEach(c => {
      map.set(c.name.toUpperCase(), c)
    })
    workers.forEach(w => {
      if (w.name) {
        map.set(w.name.toUpperCase(), {
          name: w.name,
          admin_center: w.admin_center,
          trade: w.trade,
          can_charge_third_party: Boolean(w.can_charge_third_party)
        })
      }
    })
    return map
  }, [contractorCatalog, workers])

  // Evaluar si un contratista tiene permiso "3ros" activo en el Padrón
  const hasThirdPartyPermission = (contractorName) => {
    if (!contractorName) return false
    const key = contractorName.trim().toUpperCase()
    const found = contractorPermissionsMap.get(key)
    if (found) return Boolean(found.can_charge_third_party)
    return workers.some(
      w =>
        ((w.work_group || '').trim().toUpperCase() === key ||
          (w.name || '').trim().toUpperCase() === key) &&
        Boolean(w.can_charge_third_party)
    )
  }

  // Evaluar condición estricta para PRC $0 en Terceros (DEC-014):
  // 1) Exactamente 1 contratista en la lista
  // 2) Ese único contratista tiene el permiso "3ros" activo en el Padrón
  const thirdPartyPrcEvaluation = useMemo(() => {
    const list = workForm.contractors || []
    if (list.length === 0) {
      return {
        canEnable: false,
        reason: 'Seleccioná un contratista con permiso "3ros" activo para habilitar la carga de PRC $0 en Terceros.'
      }
    }
    if (list.length > 1) {
      return {
        canEnable: false,
        reason: `No habilitado: Seleccionaste ${list.length} contratistas (${list.join(', ')}). El sistema solo permite cargar PRC $0 a Terceros cuando hay un único (1) contratista en el trabajo.`
      }
    }
    const singleContractor = list[0]
    const allowed = hasThirdPartyPermission(singleContractor)
    if (!allowed) {
      return {
        canEnable: false,
        reason: `No habilitado: "${singleContractor}" no tiene activo el permiso "3ros" (Terceros) en el Padrón Operativo de Personas y Talleres.`
      }
    }
    return {
      canEnable: true,
      contractor: singleContractor,
      reason: `Habilitado: "${singleContractor}" es único contratista del trabajo y posee el permiso "3ros" activo en el Padrón.`
    }
  }, [workForm.contractors, contractorPermissionsMap, workers])

  // Calcular el siguiente número consecutivo de OT para un barco específico (100% automático por sistema)
  const getNextOtNumberForShip = (shipId, offset = 0) => {
    const shipWos = workOrders.filter(w => w.ship_id === shipId)
    let maxNum = 0
    shipWos.forEach(w => {
      const m = String(w.ot_number || '').match(/(\d+)/)
      if (m) {
        const n = parseInt(m[1], 10)
        if (n > maxNum && n < 100) maxNum = n
        else if (n >= 100 && shipWos.length === 1) maxNum = 1
      }
    })
    return `OT-${maxNum + 1 + offset}`
  }

  // Guardar cambios en la ayuda auto-entrenable de Tipo de Facturación
  const handleSaveBillingHelp = (newHelp) => {
    setBillingTypeHelp(newHelp)
    try {
      localStorage.setItem('aloncar_billing_type_help_v1', JSON.stringify(newHelp))
    } catch {
      // ignore storage errors
    }
    setIsEditingBillingHelp(false)
  }

  // Lista filtrada en tiempo real para el buscador de contratistas por escritura
  const filteredContractorsForSearch = useMemo(() => {
    const q = contractorSelectInput.trim().toLowerCase()
    return contractorCatalog.filter(c => {
      if ((workForm.contractors || []).includes(c.name)) return false
      if (!q) return true
      return (
        c.name.toLowerCase().includes(q) ||
        (c.trade || '').toLowerCase().includes(q) ||
        (c.admin_center || '').toLowerCase().includes(q)
      )
    })
  }, [contractorCatalog, contractorSelectInput, workForm.contractors])

  // Agrupar work_items por work_order_id
  const itemsByWoMap = useMemo(() => {
    const map = {}
    workItems.forEach(item => {
      if (!map[item.work_order_id]) map[item.work_order_id] = []
      map[item.work_order_id].push(item)
    })
    return map
  }, [workItems])

  // Mapa de registros de Terceros por work_item_id
  const thirdPartyByItemMap = useMemo(() => {
    const map = {}
    thirdPartyServices.forEach(tp => {
      if (tp.work_item_id) map[tp.work_item_id] = tp
    })
    return map
  }, [thirdPartyServices])

  // Mapa de Horas trabajadas y LAS 3 FECHAS DE LA OT:
  // 1) Fecha de Creación: cuando se creó el reporte de la OT (hoy() automático al cargar)
  // 2) Fecha de Inicio: primer dato cargado en todo el sistema (Horas, Materiales o Terceros)
  // 3) Fecha Final: último dato cargado en todo el sistema (Horas, Materiales o Terceros)
  const otMetricsAndDatesMap = useMemo(() => {
    const map = {}

    workOrders.forEach(wo => {
      const createdIso = wo.created_at
        ? String(wo.created_at).split('T')[0]
        : (wo.start_date || new Date().toISOString().split('T')[0])

      map[wo.id] = {
        totalHours: 0,
        normalHours: 0,
        extra50: 0,
        extra100: 0,
        workerSet: new Set(),
        createdDate: createdIso,
        events: [] // { date: 'YYYY-MM-DD', source: 'Horas' | 'Materiales' | 'Terceros' }
      }
    })

    // 1. Eventos desde Horas (labor_logs)
    laborLogs.forEach(log => {
      const woId = log.work_order_id
      if (!woId || !map[woId]) return
      map[woId].totalHours += parseFloat(log.hours_worked) || 0
      map[woId].normalHours += parseFloat(log.hours_normal) || 0
      map[woId].extra50 += parseFloat(log.hours_extra_50) || 0
      map[woId].extra100 += parseFloat(log.hours_extra_100) || 0
      if (log.worker_name) map[woId].workerSet.add(log.worker_name)
      if (log.date_logged) {
        map[woId].events.push({
          date: String(log.date_logged).split('T')[0],
          source: 'Horas'
        })
      }
    })

    // 2. Eventos desde Materiales / Pañol (inventory_transactions)
    inventoryTx.forEach(tx => {
      const woId = tx.work_order_id
      if (!woId || !map[woId]) return
      if (tx.transaction_date) {
        map[woId].events.push({
          date: String(tx.transaction_date).split('T')[0],
          source: 'Materiales'
        })
      }
    })

    // 3. Eventos desde Terceros (third_party_services)
    thirdPartyServices.forEach(tp => {
      const woId = tp.work_order_id
      if (!woId || !map[woId]) return
      const tpDate = tp.service_date || (tp.created_at ? String(tp.created_at).split('T')[0] : null)
      if (tpDate) {
        map[woId].events.push({
          date: tpDate,
          source: 'Terceros'
        })
      }
    })

    // Calcular Fecha de Inicio (MIN) y Fecha Final (MAX) para cada OT
    Object.values(map).forEach(entry => {
      if (entry.events.length === 0) {
        entry.startDate = null
        entry.startSource = null
        entry.endDate = null
        entry.endSource = null
      } else {
        const sorted = [...entry.events].sort((a, b) => a.date.localeCompare(b.date))
        entry.startDate = sorted[0].date
        entry.startSource = sorted[0].source
        entry.endDate = sorted[sorted.length - 1].date
        entry.endSource = sorted[sorted.length - 1].source
      }
    })

    return map
  }, [workOrders, laborLogs, inventoryTx, thirdPartyServices])

  // Filas unificadas (Cada fila = 1 Trabajo con su OT y Barco, igual a hoja UNIFICADO de GS-003)
  const unifiedRows = useMemo(() => {
    const rows = []
    workOrders.forEach(wo => {
      const items = itemsByWoMap[wo.id] || []
      const computedOt = computeOtState(wo, items)
      const otDates = otMetricsAndDatesMap[wo.id] || {
        totalHours: 0,
        createdDate: wo.created_at ? String(wo.created_at).split('T')[0] : null,
        startDate: null,
        endDate: null
      }
      if (items.length === 0) {
        const isWoEliminada =
          wo.status === 'Cancelada' || (wo.notes || '').toUpperCase().includes('[ELIMINADA]')
        rows.push({
          isPlaceholder: true,
          id: `placeholder-${wo.id}`,
          work_order_id: wo.id,
          wo,
          computedOt,
          otDates,
          siblingsCount: 0,
          description: wo.description || '',
          status: isWoEliminada ? 'Desestimado' : 'Pendiente de inicio',
          foreman_name: wo.foreman_name || foremenList[0] || 'ALE CAMADELLI',
          work_type: wo.work_type || 'HORA',
          assignment_type: wo.assignment_type || 'Presupuesto General',
          specific_budget_id: wo.budget_code || '',
          contractors: wo.contractor_name ? [wo.contractor_name] : [],
          comments: isWoEliminada ? '[ELIMINADA] Desestimada por eliminación' : '',
          send_to_third_party_prc: false,
          created_at: wo.created_at
        })
      } else {
        items.forEach(item => {
          rows.push({
            ...item,
            isPlaceholder: false,
            wo,
            computedOt,
            otDates,
            siblingsCount: items.length,
            thirdPartyRecord: thirdPartyByItemMap[item.id] || null
          })
        })
      }
    })
    return rows
  }, [workOrders, itemsByWoMap, thirdPartyByItemMap, foremenList, otMetricsAndDatesMap])

  // Filtrado de filas unificadas
  const filteredRows = useMemo(() => {
    return unifiedRows.filter(row => {
      if (selectedShipFilter !== 'todos' && row.wo?.ship_id !== selectedShipFilter) return false
      if (selectedOtFilter !== 'todas' && row.work_order_id !== selectedOtFilter) return false
      if (selectedStatusFilter !== 'todos' && row.status !== selectedStatusFilter) return false
      if (selectedForemanFilter !== 'todos' && row.foreman_name !== selectedForemanFilter) return false
      if (selectedContractorFilter !== 'todos') {
        const list = row.contractors || []
        if (!list.includes(selectedContractorFilter)) return false
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchShip = (row.wo?.ships?.name || '').toLowerCase().includes(q)
        const matchOtTitle = (row.wo?.title || '').toLowerCase().includes(q)
        const matchOtNum = (row.wo?.ot_number || '').toLowerCase().includes(q)
        const matchDesc = (row.description || '').toLowerCase().includes(q)
        const matchForeman = (row.foreman_name || '').toLowerCase().includes(q)
        const matchContractor = (row.contractors || []).some(c => c.toLowerCase().includes(q))
        if (!matchShip && !matchOtTitle && !matchOtNum && !matchDesc && !matchForeman && !matchContractor) {
          return false
        }
      }
      return true
    })
  }, [unifiedRows, selectedShipFilter, selectedOtFilter, selectedStatusFilter, selectedForemanFilter, selectedContractorFilter, searchQuery])

  // Métricas operativas globales (Sin PRC $0 en Terceros)
  const stats = useMemo(() => {
    const enEjecucion = unifiedRows.filter(r => r.status === 'En ejecución').length
    const pendientes = unifiedRows.filter(r => r.status === 'Pendiente de inicio').length
    const pdteRemito = unifiedRows.filter(r => r.status === 'Pendiente remito' || r.status === 'Remito realizado/Pdte firma' || r.status === 'Finalizado').length
    const facturados = unifiedRows.filter(r => r.status === 'Facturado').length
    const barcosActivos = new Set(unifiedRows.filter(r => r.status === 'En ejecución').map(r => r.wo?.ship_id)).size
    return { enEjecucion, pendientes, pdteRemito, facturados, barcosActivos }
  }, [unifiedRows])

  // Abrir Modal para Crear Nuevo Trabajo / OT (Fecha de creación sale automática de HOY)
  const handleOpenNewWorkModal = (preselectedWo = null) => {
    setEditingWorkItem(null)
    setIsCreatingForemanInline(false)
    setSelectedBatchTemplates([])
    setInlineCatalogSearch('')
    setShowInlineMultiPicker(false)
    setContractorSelectInput('')
    setIsContractorListOpen(false)

    const todayIso = new Date().toISOString().split('T')[0]
    const defaultShipId = preselectedWo
      ? preselectedWo.ship_id
      : (selectedShipFilter !== 'todos' ? selectedShipFilter : (ships[0]?.id || ''))
    const shipWos = workOrders.filter(w => w.ship_id === defaultShipId)
    const defaultForeman = preselectedWo?.foreman_name || foremenList[0] || 'ALE CAMADELLI'

    setWorkForm({
      ship_id: defaultShipId,
      ot_mode: preselectedWo ? 'existing' : (shipWos.length > 0 ? 'existing' : 'new'),
      existing_wo_id: preselectedWo ? preselectedWo.id : (shipWos[0]?.id || ''),
      ot_creation_type: 'tabulada',
      selected_template_id: '',
      ot_number: getNextOtNumberForShip(defaultShipId),
      ot_title: '',
      created_date: todayIso,
      description: '',
      status: 'En ejecución',
      foreman_name: defaultForeman,
      work_type: 'HORA',
      assignment_type: 'Presupuesto General',
      specific_budget_id: '',
      contractors: [],
      comments: '',
      send_to_third_party_prc: false,
      specific_observations: ''
    })
    setIsWorkModalOpen(true)
  }

  // Abrir Modal para Editar un Trabajo existente
  const handleOpenEditWorkModal = (row) => {
    setEditingWorkItem(row.isPlaceholder ? null : row)
    setIsCreatingForemanInline(false)
    setSelectedBatchTemplates([])
    setInlineCatalogSearch('')
    setShowInlineMultiPicker(false)
    setContractorSelectInput('')
    setIsContractorListOpen(false)

    const tp = row.thirdPartyRecord
    const createdIso = row.wo?.created_at
      ? String(row.wo.created_at).split('T')[0]
      : new Date().toISOString().split('T')[0]
    setWorkForm({
      ship_id: row.wo?.ship_id || '',
      ot_mode: 'existing',
      existing_wo_id: row.work_order_id,
      ot_creation_type: row.wo?.is_tabulated ? 'tabulada' : 'libre',
      selected_template_id: '',
      ot_number: row.wo?.ot_number || 'OT-1',
      ot_title: row.wo?.title || '',
      created_date: createdIso,
      description: row.description || '',
      status: row.status || 'En ejecución',
      foreman_name: row.foreman_name || foremenList[0] || 'ALE CAMADELLI',
      work_type: row.work_type || 'HORA',
      assignment_type: row.assignment_type || 'Presupuesto General',
      specific_budget_id: row.specific_budget_id || '',
      contractors: Array.isArray(row.contractors) ? [...row.contractors] : [],
      comments: cleanWorkItemComment(row.comments),
      send_to_third_party_prc: Boolean(row.send_to_third_party_prc || tp),
      specific_observations: tp?.specific_observations || ''
    })
    setIsWorkModalOpen(true)
  }

  // Crear nuevo Jefe de Obra In-Situ desde el selector de la OT (Único rubro disponible: TECNICOS)
  const handleCreateForemanInline = async () => {
    const cleanName = newForemanForm.name.trim().toUpperCase()
    if (!cleanName) {
      alert('Ingresá el nombre y apellido del nuevo Jefe de Obra.')
      return
    }
    setSavingNewForeman(true)
    try {
      const existingWorker = workers.find(w => (w.name || '').trim().toUpperCase() === cleanName)
      let savedWorker = null

      if (existingWorker) {
        const { data, error } = await supabase
          .from('workers')
          .update({
            is_foreman: true,
            trade: 'TECNICOS',
            status: 'ACTIVO'
          })
          .eq('id', existingWorker.id)
          .select()
        if (error) throw error
        savedWorker = data?.[0] || { ...existingWorker, is_foreman: true, trade: 'TECNICOS', status: 'ACTIVO' }
        setWorkers(prev => prev.map(w => (w.id === existingWorker.id ? savedWorker : w)))
      } else {
        const workerPayload = {
          name: cleanName,
          work_group: 'ASTILLERO',
          trade: 'TECNICOS',
          admin_center: 'ASTILLERO',
          consumables: 'CLIENTE',
          consumables_discount_pct: 0,
          safety_items: 'ASTILLERO',
          status: 'ACTIVO',
          hourly_rate_ars: 0,
          hourly_rate_usd: 0,
          category: 'OFICIAL',
          can_withdraw_materials: true,
          can_impute_hours: true,
          can_charge_third_party: false,
          is_foreman: true
        }
        const { data, error } = await supabase
          .from('workers')
          .insert([workerPayload])
          .select()
        if (error) throw error
        savedWorker = data?.[0] || workerPayload
        setWorkers(prev => [...prev, savedWorker])
      }

      // Sincronizar también en organization_roles (Gobierno / Operaciones en Dashboard Admin)
      const roleSlug = `JEFE_OBRA_${cleanName.replace(/[^A-Z0-9]+/g, '_')}`
      await supabase
        .from('organization_roles')
        .upsert(
          {
            role_key: roleSlug,
            role_title: 'Jefe de Obra Naval (TECNICOS)',
            holder_name: cleanName,
            department: 'Operaciones',
            security_level: 'SUPERVISOR',
            allowed_sections: ['barcos', 'ots', 'horas', 'panol'],
            status: 'ACTIVO',
            notes: 'Jefe de Obra (Rubro Técnico) dado de alta desde el módulo de Órdenes de Trabajo',
            updated_at: new Date().toISOString()
          },
          { onConflict: 'role_key' }
        )

      setWorkForm(prev => ({ ...prev, foreman_name: cleanName }))
      setNewForemanForm({ name: '', trade: 'TECNICOS' })
      setIsCreatingForemanInline(false)
      setStatusMessage({
        type: 'success',
        text: `Jefe de Obra "${cleanName}" (Rubro: Técnico) creado y sincronizado automáticamente en el Padrón de Personal (JO) y en Roles de Operaciones.`
      })
      setTimeout(() => setStatusMessage(null), 4000)
    } catch (err) {
      console.error(err)
      alert('Error al crear Jefe de Obra: ' + err.message)
    } finally {
      setSavingNewForeman(false)
    }
  }

  // Abrir Modal para Separar / Independizar un Trabajo de su Contenedor OT
  const handleOpenSeparateModal = (row) => {
    if (!row || row.isPlaceholder) return
    const shipId = row.wo?.ship_id
    const otherWosSameShip = workOrders.filter(w => w.ship_id === shipId && w.id !== row.work_order_id)
    const nextOtNum = getNextOtNumberForShip(shipId)
    const suggestedTitle = row.description
      ? row.description.split('\n')[0].slice(0, 55).toUpperCase()
      : `${row.wo?.title || 'TRABAJO'} (SEPARADO)`

    setSeparatingRow(row)
    setSeparateForm({
      mode: 'new_ot',
      ot_creation_type: 'libre',
      selected_template_id: '',
      new_ot_number: nextOtNum,
      new_ot_title: suggestedTitle,
      target_existing_wo_id: otherWosSameShip[0]?.id || '',
      migrate_linked_records: true,
      reason: 'Se independiza el trabajo en una OT propia para seguimiento y facturación individual'
    })
  }

  // Confirmar Separación / Independización del Trabajo hacia una Nueva OT o hacia otra OT existente
  const handleConfirmSeparateWorkItem = async (e) => {
    e.preventDefault()
    if (!separatingRow) return

    const sourceWo = separatingRow.wo
    const shipId = sourceWo?.ship_id

    if (separateForm.mode === 'new_ot' && !separateForm.new_ot_title.trim()) {
      alert('Ingresá el nombre para la nueva Orden de Trabajo independiente.')
      return
    }
    if (separateForm.mode === 'existing_ot' && !separateForm.target_existing_wo_id) {
      alert('Seleccioná la Orden de Trabajo de destino.')
      return
    }
    if (!separateForm.reason.trim()) {
      alert('Indicá brevemente el motivo de la separación para el registro de trazabilidad.')
      return
    }

    setSavingSeparate(true)
    try {
      let targetWoId = separateForm.target_existing_wo_id
      let targetWoLabel = ''
      const timestamp = new Date().toLocaleString('es-AR')
      const author = user?.email?.split('@')[0] || 'Supervisor'

      if (separateForm.mode === 'new_ot') {
        const newOtNum = getNextOtNumberForShip(shipId)
        const newTitle = separateForm.new_ot_title.trim()
        const originNote = `[${timestamp} - Separación de OT por ${author}]: Trabajo independizado desde ${sourceWo?.ot_number} (${sourceWo?.title}). Motivo: ${separateForm.reason.trim()}`

        const woPayload = {
          ship_id: shipId,
          ot_number: newOtNum,
          title: newTitle,
          description: separatingRow.description || null,
          status: separatingRow.status === 'En ejecución' ? 'En Progreso' : 'Pendiente',
          work_type: separatingRow.work_type || 'HORA',
          assignment_type: separatingRow.assignment_type || 'Presupuesto General',
          budget_code: separatingRow.specific_budget_id || null,
          foreman_name: separatingRow.foreman_name || sourceWo?.foreman_name,
          contractor_name: (separatingRow.contractors || []).join(', ') || null,
          is_tabulated: separateForm.ot_creation_type === 'tabulada',
          start_date: new Date().toISOString().split('T')[0],
          notes: originNote
        }

        const { data: createdWo, error: createWoErr } = await supabase
          .from('work_orders')
          .insert([woPayload])
          .select()

        if (createWoErr) throw createWoErr
        targetWoId = createdWo[0].id
        targetWoLabel = `${newOtNum} - ${newTitle}`
      } else {
        const destWo = workOrders.find(w => w.id === targetWoId)
        targetWoLabel = destWo ? `${destWo.ot_number} - ${destWo.title}` : 'OT destino'
        const destNote = `[${timestamp} - Reasignación de Trabajo por ${author}]: Se incorporó trabajo proveniente de ${sourceWo?.ot_number} (${sourceWo?.title}). Motivo: ${separateForm.reason.trim()}`
        const updatedDestNotes = destWo?.notes ? `${destWo.notes}\n\n${destNote}` : destNote
        await supabase.from('work_orders').update({ notes: updatedDestNotes }).eq('id', targetWoId)
      }

      // 1. Dejar constancia en la bitácora de la OT de origen
      if (sourceWo?.id) {
        const sourceNote = `[${timestamp} - Trabajo Separado por ${author}]: El trabajo "${(separatingRow.description || '').slice(0, 60)}..." fue separado hacia ${targetWoLabel}. Motivo: ${separateForm.reason.trim()}`
        const updatedSourceNotes = sourceWo.notes ? `${sourceWo.notes}\n\n${sourceNote}` : sourceNote
        await supabase.from('work_orders').update({ notes: updatedSourceNotes }).eq('id', sourceWo.id)
      }

      // 2. Mover el work_item al nuevo contenedor OT
      const { error: moveItemErr } = await supabase
        .from('work_items')
        .update({
          work_order_id: targetWoId,
          updated_at: new Date().toISOString()
        })
        .eq('id', separatingRow.id)

      if (moveItemErr) throw moveItemErr

      // 3. Actualizar registros vinculados (Terceros PRC, Horas y Materiales)
      await supabase
        .from('third_party_services')
        .update({
          work_order_id: targetWoId,
          updated_at: new Date().toISOString()
        })
        .eq('work_item_id', separatingRow.id)

      if (separateForm.migrate_linked_records) {
        await supabase
          .from('labor_logs')
          .update({ work_order_id: targetWoId })
          .eq('work_item_id', separatingRow.id)

        await supabase
          .from('inventory_transactions')
          .update({ work_order_id: targetWoId })
          .eq('work_item_id', separatingRow.id)
      }

      setSeparatingRow(null)
      setIsWorkModalOpen(false)
      await loadData()
      setStatusMessage({
        type: 'success',
        text: `Trabajo separado correctamente hacia ${targetWoLabel} con trazabilidad registrada en bitácora.`
      })
      setTimeout(() => setStatusMessage(null), 4500)
    } catch (err) {
      console.error(err)
      alert('Error al separar trabajo: ' + err.message)
    } finally {
      setSavingSeparate(false)
    }
  }

  // Cambiar barco en el formulario en cascada
  const handleShipChangeInForm = (newShipId) => {
    const shipWos = workOrders.filter(w => w.ship_id === newShipId)
    setWorkForm(prev => ({
      ...prev,
      ship_id: newShipId,
      ot_mode: shipWos.length > 0 ? 'existing' : 'new',
      existing_wo_id: shipWos[0]?.id || '',
      ot_number: getNextOtNumberForShip(newShipId)
    }))
  }

  // Seleccionar una plantilla tabulada del Catálogo (OT.ABC) desde el selector simple
  const handleSelectTabulatedTemplate = (tplId) => {
    const tpl = templates.find(t => t.id === tplId)
    if (!tpl) {
      setWorkForm(prev => ({ ...prev, selected_template_id: '' }))
      setSelectedBatchTemplates([])
      return
    }
    setWorkForm(prev => ({
      ...prev,
      selected_template_id: tpl.id,
      ot_title: tpl.name,
      description: tpl.description || prev.description
    }))
    setSelectedBatchTemplates([
      {
        template_id: tpl.id,
        ot_title: tpl.name,
        description: tpl.description || '',
        status: workForm.status || 'En ejecución'
      }
    ])
  }

  // Alternar selección múltiple de plantilla OT.ABC dentro del formulario de Nueva OT
  const handleToggleBatchTemplate = (tpl) => {
    setSelectedBatchTemplates(prev => {
      const exists = prev.some(item => item.template_id === tpl.id)
      const next = exists
        ? prev.filter(item => item.template_id !== tpl.id)
        : [
            ...prev,
            {
              template_id: tpl.id,
              ot_title: tpl.name,
              description: tpl.description || '',
              status: workForm.status || 'En ejecución'
            }
          ]

      if (next.length > 0) {
        setWorkForm(wf => ({
          ...wf,
          ot_creation_type: 'tabulada',
          selected_template_id: next[0].template_id,
          ot_title: next[0].ot_title,
          description: next[0].description,
          status: next[0].status
        }))
      } else {
        setWorkForm(wf => ({
          ...wf,
          selected_template_id: '',
          ot_title: '',
          description: ''
        }))
      }
      return next
    })
  }

  // Actualizar estado o descripción individual de una OT en la selección múltiple
  const handleUpdateBatchTemplateItem = (templateId, field, value) => {
    setSelectedBatchTemplates(prev => {
      const next = prev.map(item =>
        item.template_id === templateId ? { ...item, [field]: value } : item
      )
      if (next.length > 0 && next[0].template_id === templateId) {
        setWorkForm(wf => ({
          ...wf,
          ot_title: field === 'ot_title' ? value : wf.ot_title,
          description: field === 'description' ? value : wf.description,
          status: field === 'status' ? value : wf.status
        }))
      }
      return next
    })
  }

  // Agregar contratista a la lista del trabajo
  const handleAddContractorToForm = (contractorName) => {
    if (!contractorName) return
    setWorkForm(prev => {
      if (prev.contractors.includes(contractorName)) return prev
      const nextContractors = [...prev.contractors, contractorName]
      const canStillSend3ros = nextContractors.length === 1 && hasThirdPartyPermission(nextContractors[0])
      return {
        ...prev,
        contractors: nextContractors,
        send_to_third_party_prc: canStillSend3ros ? prev.send_to_third_party_prc : false
      }
    })
    setContractorSelectInput('')
    setIsContractorListOpen(false)
  }

  // Quitar contratista de la lista del trabajo
  const handleRemoveContractorFromForm = (contractorName) => {
    setWorkForm(prev => {
      const nextContractors = prev.contractors.filter(c => c !== contractorName)
      const canStillSend3ros = nextContractors.length === 1 && hasThirdPartyPermission(nextContractors[0])
      return {
        ...prev,
        contractors: nextContractors,
        send_to_third_party_prc: canStillSend3ros ? prev.send_to_third_party_prc : false
      }
    })
  }

  // Guardar Trabajo(s) (soporta apertura masiva de múltiples OTs de OT.ABC con estado individual por cada una)
  const handleSaveWorkSubmit = async (e) => {
    e.preventDefault()

    if (!workForm.ship_id) {
      alert('Seleccioná un Barco.')
      return
    }

    const isBatchMode =
      !editingWorkItem &&
      workForm.ot_mode === 'new' &&
      workForm.ot_creation_type === 'tabulada' &&
      selectedBatchTemplates.length > 1

    if (!isBatchMode && workForm.ot_mode === 'new' && !workForm.ot_title.trim()) {
      alert('Ingresá o seleccioná el nombre de la Orden de Trabajo (OT).')
      return
    }

    if (workForm.ot_mode === 'existing' && !workForm.existing_wo_id) {
      alert('Seleccioná una Orden de Trabajo existente o elegí "Crear Nueva OT".')
      return
    }

    if (workForm.assignment_type === 'Adicional / Específico' && !workForm.specific_budget_id.trim()) {
      alert('Para trabajos de tipo "Adicional / Específico" es obligatorio indicar el Nº de Presupuesto Específico.')
      return
    }

    setSavingWork(true)
    try {
      const todayIso = new Date().toISOString().split('T')[0]
      const validFor3ros =
        workForm.contractors.length === 1 &&
        hasThirdPartyPermission(workForm.contractors[0]) &&
        Boolean(workForm.send_to_third_party_prc)

      // CASO A: APERTURA MÚLTIPLE DE OTs DESDE CATÁLOGO OT.ABC (5-6 OTs simultáneas con estado individual)
      if (isBatchMode) {
        const createdOtNumbers = []

        for (let idx = 0; idx < selectedBatchTemplates.length; idx++) {
          const batchItem = selectedBatchTemplates[idx]
          const consecutiveOtNum = getNextOtNumberForShip(workForm.ship_id, idx)
          createdOtNumbers.push(consecutiveOtNum)

          const itemStatus = batchItem.status || 'En ejecución'
          const itemDesc = (batchItem.description ?? '').trim()
          const itemTitle = (batchItem.ot_title || '').trim()

          const woPayload = {
            ship_id: workForm.ship_id,
            ot_number: consecutiveOtNum,
            title: itemTitle,
            description: itemDesc || null,
            status:
              itemStatus === 'En ejecución'
                ? 'En Progreso'
                : itemStatus === 'Desestimado'
                ? 'Cancelada'
                : 'Pendiente',
            work_type: workForm.work_type,
            assignment_type: workForm.assignment_type,
            budget_code: workForm.specific_budget_id.trim() || null,
            foreman_name: workForm.foreman_name,
            contractor_name: workForm.contractors.join(', ') || null,
            is_tabulated: true,
            start_date: todayIso
          }

          const { data: newWoData, error: woErr } = await supabase
            .from('work_orders')
            .insert([woPayload])
            .select()

          if (woErr) throw woErr
          const createdWoId = newWoData[0].id

          const itemPayload = {
            work_order_id: createdWoId,
            description: itemDesc,
            status: itemStatus,
            foreman_name: workForm.foreman_name,
            work_type: workForm.work_type,
            assignment_type: workForm.assignment_type,
            specific_budget_id: workForm.specific_budget_id.trim() || null,
            contractors: workForm.contractors,
            contractor_name: workForm.contractors.join(', ') || null,
            comments: workForm.comments.trim() || null,
            send_to_third_party_prc: validFor3ros,
            updated_at: new Date().toISOString()
          }

          const { data: insItemData, error: itemErr } = await supabase
            .from('work_items')
            .insert([itemPayload])
            .select()

          if (itemErr) throw itemErr
          const createdWorkItem = insItemData?.[0]

          if (createdWorkItem && validFor3ros) {
            const singleContractor = workForm.contractors[0]
            await supabase
              .from('third_party_services')
              .upsert(
                {
                  work_item_id: createdWorkItem.id,
                  work_order_id: createdWoId,
                  ship_id: workForm.ship_id,
                  contractor_name: singleContractor,
                  status: 'PRC',
                  voucher_type: 'PRC',
                  amount_ars: 0,
                  service_date: todayIso,
                  direct_observations: itemDesc || 'Sin descripción cargada en la OT',
                  specific_observations: workForm.specific_observations.trim() || null,
                  updated_at: new Date().toISOString()
                },
                { onConflict: 'work_item_id' }
              )
          }
        }

        setIsWorkModalOpen(false)
        setSelectedBatchTemplates([])
        await loadData()
        setStatusMessage({
          type: 'success',
          text: `Se abrieron ${createdOtNumbers.length} Órdenes de Trabajo consecutivas (${createdOtNumbers.join(', ')}) con sus estados individuales configurados.`
        })
        setTimeout(() => setStatusMessage(null), 4500)
        return
      }

      // CASO B: GUARDADO DE UNA SOLA OT / TRABAJO
      let targetWoId = workForm.existing_wo_id
      let targetShipId = workForm.ship_id

      // 1. Si es Nueva OT, crear primero el contenedor en work_orders con consecutivo automático y fecha de creación = hoy()
      if (workForm.ot_mode === 'new') {
        const autoConsecutiveOt = getNextOtNumberForShip(workForm.ship_id, 0)
        const woPayload = {
          ship_id: workForm.ship_id,
          ot_number: autoConsecutiveOt,
          title: workForm.ot_title.trim(),
          description: workForm.description.trim() || null,
          status: workForm.status === 'En ejecución' ? 'En Progreso' : 'Pendiente',
          work_type: workForm.work_type,
          assignment_type: workForm.assignment_type,
          budget_code: workForm.specific_budget_id.trim() || null,
          foreman_name: workForm.foreman_name,
          contractor_name: workForm.contractors.join(', ') || null,
          is_tabulated: workForm.ot_creation_type === 'tabulada',
          start_date: todayIso
        }

        const { data: newWoData, error: woErr } = await supabase
          .from('work_orders')
          .insert([woPayload])
          .select()

        if (woErr) throw woErr
        targetWoId = newWoData[0].id
      } else if (editingWorkItem && workForm.ot_title.trim()) {
        await supabase
          .from('work_orders')
          .update({
            title: workForm.ot_title.trim(),
            foreman_name: workForm.foreman_name
          })
          .eq('id', targetWoId)
      }

      // 2. Insertar o actualizar el Trabajo en work_items
      const existingEliminadaTag =
        editingWorkItem && isWorkItemEliminada(editingWorkItem, editingWorkItem.wo) && workForm.status === 'Desestimado'
          ? '[ELIMINADA] Desestimada por eliminación'
          : ''
      const mergedComments = [workForm.comments.trim(), existingEliminadaTag].filter(Boolean).join(' | ') || null

      const itemPayload = {
        work_order_id: targetWoId,
        description: workForm.description.trim(),
        status: workForm.status,
        foreman_name: workForm.foreman_name,
        work_type: workForm.work_type,
        assignment_type: workForm.assignment_type,
        specific_budget_id: workForm.specific_budget_id.trim() || null,
        contractors: workForm.contractors,
        contractor_name: workForm.contractors.join(', ') || null,
        comments: mergedComments,
        send_to_third_party_prc: validFor3ros,
        updated_at: new Date().toISOString()
      }

      let savedWorkItem = null
      if (editingWorkItem && !editingWorkItem.isPlaceholder) {
        const { data: updData, error: itemErr } = await supabase
          .from('work_items')
          .update(itemPayload)
          .eq('id', editingWorkItem.id)
          .select()
        if (itemErr) throw itemErr
        savedWorkItem = updData?.[0] || { ...editingWorkItem, ...itemPayload }
      } else {
        const { data: insData, error: itemErr } = await supabase
          .from('work_items')
          .insert([itemPayload])
          .select()
        if (itemErr) throw itemErr
        savedWorkItem = insData?.[0]
      }

      // 3. Sincronizar con Terceros (third_party_services) si está habilitado PRC $0
      if (savedWorkItem) {
        if (validFor3ros) {
          const singleContractor = workForm.contractors[0]
          const workerObj = workers.find(w => w.name.toUpperCase().trim() === singleContractor?.toUpperCase().trim())
          const resolvedTrade = workerObj?.trade && workerObj.trade.toUpperCase().trim() !== 'MANUAL' ? workerObj.trade : null
          const tpPayload = {
            work_item_id: savedWorkItem.id,
            work_order_id: targetWoId,
            ship_id: targetShipId,
            contractor_name: singleContractor,
            trade: resolvedTrade,
            status: 'PRC',
            voucher_type: 'PRC',
            amount_ars: 0,
            service_date: todayIso,
            entry_date: todayIso,
            direct_observations: workForm.description.trim() || 'Sin descripción cargada en la OT',
            specific_observations: workForm.specific_observations.trim() || null,
            updated_at: new Date().toISOString()
          }

          const { error: tpErr } = await supabase
            .from('third_party_services')
            .upsert(tpPayload, { onConflict: 'work_item_id' })

          if (tpErr) throw tpErr
        } else if (editingWorkItem && thirdPartyByItemMap[editingWorkItem.id]) {
          await supabase
            .from('third_party_services')
            .delete()
            .eq('work_item_id', editingWorkItem.id)
        }
      }

      setIsWorkModalOpen(false)
      setSelectedBatchTemplates([])
      await loadData()
      setStatusMessage({
        type: 'success',
        text: validFor3ros
          ? `Trabajo guardado y registro PRC $0 generado automáticamente en Terceros para ${workForm.contractors[0]} (con Observaciones Directas vinculadas).`
          : 'Trabajo y Orden de Trabajo guardados correctamente.'
      })
      setTimeout(() => setStatusMessage(null), 4000)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al guardar: ${err.message}` })
    } finally {
      setSavingWork(false)
    }
  }

  // ============================================================================
  // LÓGICA DE BLOQUEO Y CASCADA ESTRICTA EN TERCEROS (1. Barco -> 2. Contratista 3ros -> 3. OT en ejecución)
  // ============================================================================
  const activeExecutionRows = useMemo(() => {
    return unifiedRows.filter(r => !r.isPlaceholder && r.status === 'En ejecución')
  }, [unifiedRows])

  // Paso 2 en Terceros: Contratistas con permiso 3ros habilitados en el barco seleccionado (solo en trabajos "En ejecución")
  const enabledThirdPartyContractorsForShip = useMemo(() => {
    if (!tpCascadeForm.ship_id) return []
    const set = new Set()
    activeExecutionRows
      .filter(r => r.wo?.ship_id === tpCascadeForm.ship_id)
      .forEach(r => {
        ;(r.contractors || []).forEach(c => {
          if (hasThirdPartyPermission(c)) set.add(c)
        })
      })
    return Array.from(set).sort()
  }, [activeExecutionRows, tpCascadeForm.ship_id, contractorPermissionsMap, workers])

  // Paso 3 en Terceros: Trabajos / OTs en ejecución donde está habilitado ese contratista en ese barco
  const enabledWorkItemsForShipAndContractor = useMemo(() => {
    if (!tpCascadeForm.ship_id || !tpCascadeForm.contractor_name) return []
    return activeExecutionRows.filter(
      r =>
        r.wo?.ship_id === tpCascadeForm.ship_id &&
        (r.contractors || []).includes(tpCascadeForm.contractor_name)
    )
  }, [activeExecutionRows, tpCascadeForm.ship_id, tpCascadeForm.contractor_name])

  const selectedTpCascadeWorkItem = useMemo(() => {
    return enabledWorkItemsForShipAndContractor.find(r => r.id === tpCascadeForm.work_item_id) || null
  }, [enabledWorkItemsForShipAndContractor, tpCascadeForm.work_item_id])

  const handleOpenTpCascadeModal = () => {
    const firstActiveShipId = ships.find(s => activeExecutionRows.some(r => r.wo?.ship_id === s.id))?.id || ships[0]?.id || ''
    setTpCascadeForm({
      ship_id: firstActiveShipId,
      contractor_name: '',
      work_item_id: '',
      service_date: new Date().toISOString().split('T')[0],
      status: 'PRC',
      voucher_number: '',
      amount_ars: 0,
      specific_observations: ''
    })
    setIsThirdPartyCascadeOpen(true)
  }

  const handleSaveTpCascade = async (e) => {
    e.preventDefault()
    if (!selectedTpCascadeWorkItem) {
      alert('Seleccioná un Barco, un Contratista habilitado y una Orden de Trabajo en ejecución.')
      return
    }
    setSavingTpCascade(true)
    try {
      const workerObj = workers.find(w => w.name.toUpperCase().trim() === tpCascadeForm.contractor_name?.toUpperCase().trim())
      const resolvedTrade = workerObj?.trade && workerObj.trade.toUpperCase().trim() !== 'MANUAL' ? workerObj.trade : null
      const vNum = tpCascadeForm.voucher_number.trim() || null
      const isPrc = (tpCascadeForm.status || 'PRC') === 'PRC'

      const payload = {
        work_item_id: selectedTpCascadeWorkItem.id,
        work_order_id: selectedTpCascadeWorkItem.work_order_id,
        ship_id: tpCascadeForm.ship_id,
        contractor_name: tpCascadeForm.contractor_name,
        trade: resolvedTrade,
        status: tpCascadeForm.status || 'PRC',
        voucher_type: tpCascadeForm.status || 'PRC',
        voucher_number: vNum,
        budget_number: isPrc ? vNum : null,
        invoice_number: !isPrc ? vNum : null,
        amount_ars: parseFloat(tpCascadeForm.amount_ars) || 0,
        service_date: tpCascadeForm.service_date || new Date().toISOString().split('T')[0],
        entry_date: tpCascadeForm.service_date || new Date().toISOString().split('T')[0],
        direct_observations: selectedTpCascadeWorkItem.description || 'Sin descripción en la OT',
        specific_observations: tpCascadeForm.specific_observations.trim() || null,
        updated_at: new Date().toISOString()
      }

      const { error } = await supabase
        .from('third_party_services')
        .upsert(payload, { onConflict: 'work_item_id' })

      if (error) throw error
      setIsThirdPartyCascadeOpen(false)
      await loadData()
      setStatusMessage({
        type: 'success',
        text: `Comprobante de Terceros (${tpCascadeForm.contractor_name}) guardado en ${selectedTpCascadeWorkItem.wo?.ot_number}.`
      })
      setTimeout(() => setStatusMessage(null), 4000)
    } catch (err) {
      console.error(err)
      alert('Error al guardar en Terceros: ' + err.message)
    } finally {
      setSavingTpCascade(false)
    }
  }

  // Cambio rápido de estado de un Trabajo (work_item) en la grilla
  const handleQuickItemStatusChange = async (row, newStatus) => {
    try {
      if (row.isPlaceholder) return
      setWorkItems(prev => prev.map(i => (i.id === row.id ? { ...i, status: newStatus } : i)))
      const { error } = await supabase
        .from('work_items')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', row.id)
      if (error) throw error
      setStatusMessage({ type: 'success', text: `Estado del trabajo actualizado a "${newStatus}".` })
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      console.error(err)
      loadData()
    }
  }

  // "Eliminar" un Trabajo individual: NO borra el registro (para no alterar el consecutivo de la OT),
  // sino que pasa a ESTADO DEL TRABAJO = Desestimado con la leyenda "[ELIMINADA]"
  const handleDeleteWorkItem = async (row) => {
    if (
      !window.confirm(
        `¿Desestimar por eliminación este trabajo de la ${row.wo?.ot_number || 'OT'}?\n\nNota: Las OTs no se borran físicamente para no alterar el número consecutivo; el trabajo pasará a estado "Desestimado" con la leyenda "Eliminada".`
      )
    ) {
      return
    }
    try {
      const baseComment = cleanWorkItemComment(row.comments)
      const nextComment = [baseComment, '[ELIMINADA] Desestimada por eliminación'].filter(Boolean).join(' | ')

      const { error } = await supabase
        .from('work_items')
        .update({
          status: 'Desestimado',
          comments: nextComment,
          updated_at: new Date().toISOString()
        })
        .eq('id', row.id)

      if (error) throw error
      await loadData()
      setStatusMessage({
        type: 'info',
        text: `Trabajo de ${row.wo?.ot_number || 'OT'} pasado a estado "Desestimado" con leyenda "Eliminada" (se preserva el consecutivo).`
      })
      setTimeout(() => setStatusMessage(null), 4000)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al desestimar trabajo: ${err.message}` })
    }
  }

  // "Eliminar" Orden de Trabajo completa: NO borra la OT (para no alterar el número consecutivo),
  // sino que pasa sus trabajos a ESTADO DEL TRABAJO = Desestimado con la leyenda "Eliminada"
  const handleDeleteWo = async (wo) => {
    if (
      !window.confirm(
        `¿Desestimar por eliminación la Orden de Trabajo "${wo.ot_number} - ${wo.title}"?\n\nNota: Las OTs no se eliminan de la base de datos para no alterar el número consecutivo; pasará a ESTADO DEL TRABAJO = "Desestimado" con la leyenda "Eliminada".`
      )
    ) {
      return
    }
    try {
      const items = itemsByWoMap[wo.id] || []
      const timestamp = new Date().toLocaleString('es-AR')
      const elimNote = `[ELIMINADA] Desestimada por eliminación (${timestamp})`
      const updatedNotes = (wo.notes || '').includes('[ELIMINADA]')
        ? wo.notes
        : [wo.notes, elimNote].filter(Boolean).join('\n\n')

      // 1. Marcar el contenedor work_orders como Cancelada con nota [ELIMINADA]
      const { error: woError } = await supabase
        .from('work_orders')
        .update({
          status: 'Cancelada',
          notes: updatedNotes
        })
        .eq('id', wo.id)

      if (woError) throw woError

      // 2. Pasar todos sus work_items a estado "Desestimado" con la leyenda "[ELIMINADA]"
      if (items.length > 0) {
        for (const item of items) {
          const baseComment = cleanWorkItemComment(item.comments)
          const nextComment = [baseComment, '[ELIMINADA] Desestimada por eliminación'].filter(Boolean).join(' | ')
          await supabase
            .from('work_items')
            .update({
              status: 'Desestimado',
              comments: nextComment,
              updated_at: new Date().toISOString()
            })
            .eq('id', item.id)
        }
      } else {
        // Si no tenía work_items aún, creamos el registro en estado Desestimado con leyenda Eliminada
        await supabase.from('work_items').insert([
          {
            work_order_id: wo.id,
            description: wo.description || wo.title,
            status: 'Desestimado',
            foreman_name: wo.foreman_name || foremenList[0] || 'ALE CAMADELLI',
            work_type: wo.work_type || 'HORA',
            assignment_type: wo.assignment_type || 'Presupuesto General',
            contractors: wo.contractor_name ? [wo.contractor_name] : [],
            contractor_name: wo.contractor_name || null,
            comments: '[ELIMINADA] Desestimada por eliminación',
            updated_at: new Date().toISOString()
          }
        ])
      }

      if (selectedWoDetail?.id === wo.id) setSelectedWoDetail(null)
      await loadData()
      setStatusMessage({
        type: 'info',
        text: `La ${wo.ot_number} pasó a estado "Desestimado" con leyenda "Eliminada" (conservando su número consecutivo).`
      })
      setTimeout(() => setStatusMessage(null), 4000)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al desestimar OT: ${err.message}` })
    }
  }

  // Cerrar / Facturar una OT validando que NO tenga trabajos "En ejecución" (GS-003 + DEC-011)
  const handleCloseOtWithValidation = async (wo, allowPostBillingCosts = false) => {
    const items = itemsByWoMap[wo.id] || []
    const inExec = items.filter(i => i.status === 'En ejecución')
    if (inExec.length > 0) {
      alert(
        `Bloqueo Operativo: No se puede cerrar ni facturar la ${wo.ot_number} (${wo.title}) porque todavía tiene ${inExec.length} trabajo(s) en estado "En ejecución". Finalice los trabajos primero.`
      )
      return
    }

    try {
      await supabase
        .from('work_items')
        .update({ status: 'Facturado', updated_at: new Date().toISOString() })
        .eq('work_order_id', wo.id)
        .neq('status', 'Desestimado')

      const { error } = await supabase
        .from('work_orders')
        .update({
          status: 'Facturada',
          allow_post_billing_costs: allowPostBillingCosts,
          closed_at: new Date().toISOString()
        })
        .eq('id', wo.id)

      if (error) throw error
      await loadData()
      setStatusMessage({
        type: 'success',
        text: allowPostBillingCosts
          ? `OT ${wo.ot_number} facturada con permiso de costos post-cierre activo (DEC-011).`
          : `OT ${wo.ot_number} facturada y cerrada definitivamente.`
      })
      setTimeout(() => setStatusMessage(null), 3500)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al cerrar OT: ${err.message}` })
    }
  }

  // Guardar Observaciones Específicas / Directas en Terceros
  const handleSaveThirdPartyEdit = async (e) => {
    e.preventDefault()
    if (!editingThirdParty) return
    setSavingThirdParty(true)
    try {
      const { error } = await supabase
        .from('third_party_services')
        .update({
          specific_observations: editingThirdParty.specific_observations?.trim() || null,
          amount_ars: parseFloat(editingThirdParty.amount_ars) || 0,
          status: editingThirdParty.status || 'PRC',
          service_date: editingThirdParty.service_date || new Date().toISOString().split('T')[0],
          voucher_number: editingThirdParty.voucher_number?.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', editingThirdParty.id)

      if (error) throw error
      setEditingThirdParty(null)
      await loadData()
      setStatusMessage({ type: 'success', text: 'Registro de Terceros y Observaciones Específicas actualizados.' })
      setTimeout(() => setStatusMessage(null), 3500)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al actualizar Terceros: ${err.message}` })
    } finally {
      setSavingThirdParty(false)
    }
  }

  // Gestión del Catálogo de Trabajos (OT.ABC) con soporte de Selección Múltiple
  const handleOpenCatalog = (fromForm = false) => {
    setTemplatePickerFromForm(fromForm)
    setTemplateEdit(null)
    setTemplateSearch('')
    setCatalogMultiSelection(fromForm ? [...selectedBatchTemplates] : [])
    setIsTemplateModalOpen(true)
  }

  // Alternar una plantilla en la selección múltiple del modal Catálogo OT.ABC
  const handleToggleCatalogMultiItem = (tpl) => {
    setCatalogMultiSelection(prev => {
      const exists = prev.some(i => i.template_id === tpl.id)
      if (exists) return prev.filter(i => i.template_id !== tpl.id)
      return [
        ...prev,
        {
          template_id: tpl.id,
          ot_title: tpl.name,
          description: tpl.description || '',
          status: 'En ejecución'
        }
      ]
    })
  }

  // Cambiar el estado individual de una OT seleccionada dentro del modal Catálogo OT.ABC
  const handleUpdateCatalogMultiStatus = (templateId, newStatus) => {
    setCatalogMultiSelection(prev =>
      prev.map(i => (i.template_id === templateId ? { ...i, status: newStatus } : i))
    )
  }

  // Confirmar selección múltiple desde el Catálogo OT.ABC hacia el formulario de Nueva OT
  const handleConfirmCatalogMultiSelection = () => {
    if (catalogMultiSelection.length === 0) return
    const first = catalogMultiSelection[0]

    if (templatePickerFromForm && isWorkModalOpen) {
      setSelectedBatchTemplates(catalogMultiSelection)
      setWorkForm(prev => ({
        ...prev,
        ot_mode: 'new',
        ot_creation_type: 'tabulada',
        selected_template_id: first.template_id,
        ot_title: first.ot_title,
        description: first.description || prev.description,
        status: first.status || prev.status
      }))
    } else {
      const defaultShipId = selectedShipFilter !== 'todos' ? selectedShipFilter : (ships[0]?.id || '')
      setEditingWorkItem(null)
      setSelectedBatchTemplates(catalogMultiSelection)
      setWorkForm({
        ship_id: defaultShipId,
        ot_mode: 'new',
        existing_wo_id: '',
        ot_creation_type: 'tabulada',
        selected_template_id: first.template_id,
        ot_number: getNextOtNumberForShip(defaultShipId),
        ot_title: first.ot_title,
        created_date: new Date().toISOString().split('T')[0],
        description: first.description || '',
        status: first.status || 'En ejecución',
        foreman_name: foremenList[0] || 'ALE CAMADELLI',
        work_type: 'HORA',
        assignment_type: 'Presupuesto General',
        specific_budget_id: '',
        contractors: [],
        comments: '',
        send_to_third_party_prc: false,
        specific_observations: ''
      })
      setIsWorkModalOpen(true)
    }
    setIsTemplateModalOpen(false)
  }

  const handleUseTemplate = (tpl) => {
    const singleItem = [
      {
        template_id: tpl.id,
        ot_title: tpl.name,
        description: tpl.description || '',
        status: workForm.status || 'En ejecución'
      }
    ]
    if (templatePickerFromForm && isWorkModalOpen) {
      setSelectedBatchTemplates(singleItem)
      setWorkForm(prev => ({
        ...prev,
        ot_creation_type: 'tabulada',
        selected_template_id: tpl.id,
        ot_title: tpl.name,
        description: tpl.description || prev.description
      }))
    } else {
      const defaultShipId = selectedShipFilter !== 'todos' ? selectedShipFilter : (ships[0]?.id || '')
      setEditingWorkItem(null)
      setSelectedBatchTemplates(singleItem)
      setWorkForm({
        ship_id: defaultShipId,
        ot_mode: 'new',
        existing_wo_id: '',
        ot_creation_type: 'tabulada',
        selected_template_id: tpl.id,
        ot_number: getNextOtNumberForShip(defaultShipId),
        ot_title: tpl.name,
        created_date: new Date().toISOString().split('T')[0],
        description: tpl.description || '',
        status: 'En ejecución',
        foreman_name: foremenList[0] || 'ALE CAMADELLI',
        work_type: 'HORA',
        assignment_type: 'Presupuesto General',
        specific_budget_id: '',
        contractors: [],
        comments: '',
        send_to_third_party_prc: false,
        specific_observations: ''
      })
      setIsWorkModalOpen(true)
    }
    setIsTemplateModalOpen(false)
  }

  const handleSaveTemplate = async (e) => {
    e.preventDefault()
    if (!templateEdit?.name?.trim()) return
    setSavingTemplate(true)
    try {
      const payload = {
        name: templateEdit.name.trim(),
        description: templateEdit.description?.trim() || null,
        category: templateEdit.category || null
      }
      const { error } = templateEdit.id
        ? await supabase.from('ot_templates').update(payload).eq('id', templateEdit.id)
        : await supabase.from('ot_templates').insert([{ ...payload, sort_order: templates.length + 1 }])
      if (error) throw error
      setTemplateEdit(null)
      const { data } = await supabase.from('ot_templates').select('*').order('sort_order').order('name')
      if (data) setTemplates(data)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: 'Error al guardar en el catálogo: ' + err.message })
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleDeleteTemplate = async (tpl) => {
    if (!window.confirm(`¿Eliminar "${tpl.name}" del Catálogo de Trabajos (OT.ABC)?`)) return
    const { error } = await supabase.from('ot_templates').delete().eq('id', tpl.id)
    if (error) {
      setStatusMessage({ type: 'error', text: 'Error al eliminar: ' + error.message })
      return
    }
    setTemplates(prev => prev.filter(t => t.id !== tpl.id))
  }

  // Botón Ampliar (Consulta a Jefe de Obra)
  const handleSubmitAmpliar = async (e) => {
    e.preventDefault()
    if (!ampliarText.trim() || !selectedWoDetail) return
    setSubmittingAmpliar(true)
    try {
      const timestamp = new Date().toLocaleString('es-AR')
      const author = user?.email?.split('@')[0] || 'Supervisor'
      const appendedNote = `[${timestamp} - Consulta de ${author} a Jefe de Obra (${selectedWoDetail.foreman_name})]: ${ampliarText.trim()}`
      const newNotes = selectedWoDetail.notes ? `${selectedWoDetail.notes}\n\n${appendedNote}` : appendedNote

      const { error } = await supabase.from('work_orders').update({ notes: newNotes }).eq('id', selectedWoDetail.id)
      if (error) throw error

      setSelectedWoDetail(prev => ({ ...prev, notes: newNotes }))
      setWorkOrders(prev => prev.map(w => (w.id === selectedWoDetail.id ? { ...w, notes: newNotes } : w)))
      setAmpliarText('')
      setIsAmpliarModalOpen(false)
      setStatusMessage({ type: 'success', text: 'Consulta registrada en la bitácora de la OT.' })
      setTimeout(() => setStatusMessage(null), 3500)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: 'Error al registrar consulta: ' + err.message })
    } finally {
      setSubmittingAmpliar(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-200 pb-16">
      {/* ========================================================= */}
      {/* 1. ENCABEZADO Y ACCIONES PRINCIPALES                      */}
      {/* ========================================================= */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-widest">
              Módulo M3 &bull; GS-003 Lista de Trabajos en Progreso
            </span>
            <span className="text-slate-500 text-xs">&bull;</span>
            <span className="text-xs text-slate-400 font-mono">3 Fechas Automáticas &bull; Separación de OT &bull; Bloqueo en Cascada</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2.5">
            <ClipboardList className="w-7 h-7 text-primary" />
            Órdenes de Trabajo y Trabajos en Progreso
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Cada OT gestiona automáticamente sus 3 fechas (<strong>Creación</strong>, <strong>Inicio Real</strong> por primer consumo/hora/tercero y <strong>Fin Real</strong> por último dato), permite <strong>separar o independizar</strong> trabajos hacia una OT propia y habilita la carga en cascada solo para contratistas en estado <strong>En ejecución</strong>.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => handleOpenCatalog(false)}
            className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer shadow-sm"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Catálogo de Trabajos (OT.ABC)</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenNewWorkModal(null)}
            className="px-4 py-2 bg-gradient-to-r from-primary to-cyan-500 hover:brightness-110 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Cargar Trabajo / Nueva OT</span>
          </button>
        </div>
      </div>

      {/* MENSAJES DE ESTADO */}
      {statusMessage && (
        <div
          className={`p-3.5 rounded-xl text-xs font-medium border flex items-center justify-between ${
            statusMessage.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              : statusMessage.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="p-1 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. MÉTRICAS OPERATIVAS SUPERIORES (5 KPIs)                */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Trabajos en Ejecución</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-400 font-mono">{stats.enEjecucion}</span>
            <span className="text-[10px] text-slate-500">activos p/ costos</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Pendientes Inicio</span>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-400 font-mono">{stats.pendientes}</span>
            <span className="text-[10px] text-slate-500">por iniciar</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Finalizados / Remito</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-cyan-300 font-mono">{stats.pdteRemito}</span>
            <span className="text-[10px] text-slate-500">en cierre</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Facturados</span>
            <span className="w-2 h-2 rounded-full bg-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-300 font-mono">{stats.facturados}</span>
            <span className="text-[10px] text-slate-500">cerrados</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Barcos en Obra</span>
            <Ship className="w-3.5 h-3.5 text-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white font-mono">{stats.barcosActivos}</span>
            <span className="text-[10px] text-slate-500">buques activos</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. PESTAÑAS DE VISTA Y FILTROS EN CASCADA                 */}
      {/* ========================================================= */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center p-1 bg-slate-950 rounded-xl border border-slate-800 gap-1">
            <button
              type="button"
              onClick={() => setActiveMainTab('unificado')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMainTab === 'unificado'
                  ? 'bg-primary text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Planilla Unificada de Trabajos ({unifiedRows.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMainTab('ots')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMainTab === 'ots'
                  ? 'bg-cyan-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Contenedores OT por Barco ({workOrders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveMainTab('terceros')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeMainTab === 'terceros'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-purple-300 hover:text-white'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Terceros Vinculados [3ros] ({thirdPartyServices.length})</span>
            </button>
          </div>

          {/* Buscador */}
          <div className="relative w-full lg:max-w-sm">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar barco, OT, descripción, contratista, jefe de obra..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Selectores de filtrado */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-2 border-t border-slate-800/60 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">1. Barco</label>
            <select
              value={selectedShipFilter}
              onChange={(e) => {
                setSelectedShipFilter(e.target.value)
                setSelectedOtFilter('todas')
              }}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-medium"
            >
              <option value="todos">Todos los Barcos</option>
              {ships.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">2. Orden de Trabajo</label>
            <select
              value={selectedOtFilter}
              onChange={(e) => setSelectedOtFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-medium"
            >
              <option value="todas">Todas las OTs</option>
              {workOrders
                .filter(w => selectedShipFilter === 'todos' || w.ship_id === selectedShipFilter)
                .map(w => (
                  <option key={w.id} value={w.id}>
                    {w.ot_number} &bull; {w.title}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">3. Estado del Trabajo</label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-medium"
            >
              <option value="todos">Todos los Estados</option>
              {ESTADOS_TRABAJO.map(st => (
                <option key={st.value} value={st.value}>{st.value}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">4. Jefe de Obra (Padrón)</label>
            <select
              value={selectedForemanFilter}
              onChange={(e) => setSelectedForemanFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-medium"
            >
              <option value="todos">Todos los Jefes de Obra</option>
              {foremenList.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">5. Contratista / Taller</label>
            <select
              value={selectedContractorFilter}
              onChange={(e) => setSelectedContractorFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-medium"
            >
              <option value="todos">Todos los Contratistas</option>
              {contractorCatalog.map(c => (
                <option key={c.name} value={c.name}>
                  {c.name} {c.can_charge_third_party ? '[3ros]' : ''}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4A. VISTA UNIFICADA DE TRABAJOS (GS-003 UNIFICADO)        */}
      {/* ========================================================= */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <Clock className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm font-semibold">Cargando trabajos y órdenes de trabajo...</p>
        </div>
      ) : activeMainTab === 'unificado' ? (
        <div className="overflow-y-auto max-h-[calc(100vh-280px)] border border-slate-800 rounded-2xl bg-slate-900/90 shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="sticky top-0 z-20 bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 shadow-sm backdrop-blur-md">
              <tr>
                <th className="py-3 px-3 bg-slate-950">Barco</th>
                <th className="py-3 px-3 bg-slate-950">Orden de Trabajo (Estado Calculado)</th>
                <th className="py-3 px-3 min-w-[155px] bg-slate-950">Fechas OT (Creac. / Inicio / Fin)</th>
                <th className="py-3 px-3 min-w-[240px] bg-slate-950">Descripción del Trabajo</th>
                <th className="py-3 px-3 bg-slate-950">Contratista(s) / Permiso 3ros</th>
                <th className="py-3 px-3 bg-slate-950">Jefe de Obra</th>
                <th className="py-3 px-2.5 bg-slate-950">Tipo / Facturación</th>
                <th className="py-3 px-3 text-center bg-slate-950">Estado del Trabajo</th>
                <th className="py-3 px-2.5 text-center bg-slate-950">Alertas / 3ros</th>
                <th className="py-3 px-3 text-right bg-slate-950">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-500">
                    No hay trabajos registrados para los filtros seleccionados. Hacé clic en <strong>&quot;+ Cargar Trabajo / Nueva OT&quot;</strong> para comenzar.
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => {
                  const stConfig = ESTADOS_TRABAJO.find(s => s.value === row.status) || ESTADOS_TRABAJO[0]
                  const alerts = evaluateWorkItemAlerts(row, row.wo)
                  const contractors = row.contractors || []
                  const tp = row.thirdPartyRecord
                  const dates = row.otDates || {}
                  const visibleComment = cleanWorkItemComment(row.comments)
                  const rowIsEliminada = isWorkItemEliminada(row, row.wo)

                  return (
                    <tr 
                      key={row.id} 
                      onDoubleClick={() => handleOpenEditWorkModal(row)}
                      className="hover:bg-slate-800/30 transition-colors align-top cursor-pointer select-none"
                      title="Doble clic para editar este trabajo / OT"
                    >
                      {/* 1. Barco (Nombre limpio sin texto extra) */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          <Ship className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>{row.wo?.ships?.name || 'Sin barco'}</span>
                        </div>
                      </td>

                      {/* 2. Orden de Trabajo + Estado Calculado + Botón Separar OT */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[11px] font-black text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/30">
                            {row.wo?.ot_number || 'OT-1'}
                          </span>
                          <span className="font-extrabold text-white">{row.wo?.title}</span>
                        </div>
                        <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${row.computedOt.color}`}>
                            OT: {row.computedOt.label}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenNewWorkModal(row.wo)}
                            className="text-[10px] text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer"
                            title="Agregar otro trabajo dentro de esta misma OT"
                          >
                            + Trabajo
                          </button>
                          {!row.isPlaceholder && (
                            <button
                              type="button"
                              onClick={() => handleOpenSeparateModal(row)}
                              className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-bold inline-flex items-center gap-1 cursor-pointer"
                              title="Separar este trabajo en una OT propia o moverlo a otra OT del barco"
                            >
                              <GitBranch className="w-2.5 h-2.5" />
                              <span>Separar OT</span>
                            </button>
                          )}
                        </div>
                      </td>

                      {/* 3. Las 3 Fechas de la OT (Creación, Inicio Real y Fin Real) */}
                      <td className="py-3 px-3 font-mono text-[10px] space-y-1">
                        <div className="flex items-center justify-between gap-2 text-slate-300">
                          <span className="text-slate-500">Creac.:</span>
                          <span className="font-bold">{formatShortDate(dates.createdDate)}</span>
                        </div>
                        <div
                          className="flex items-center justify-between gap-2 text-emerald-300"
                          title={
                            dates.startDate
                              ? `Primer dato cargado en el sistema (${dates.startSource}): ${formatShortDate(dates.startDate, true)}`
                              : 'Sin datos cargados aún en Horas, Materiales ni Terceros'
                          }
                        >
                          <span className="text-slate-500">Inicio:</span>
                          <span className="font-bold">
                            {dates.startDate ? `${formatShortDate(dates.startDate)} (${dates.startSource?.slice(0, 3)})` : '—'}
                          </span>
                        </div>
                        <div
                          className="flex items-center justify-between gap-2 text-cyan-300"
                          title={
                            dates.endDate
                              ? `Último dato cargado a esta OT (${dates.endSource}): ${formatShortDate(dates.endDate, true)}`
                              : 'Sin datos cargados aún'
                          }
                        >
                          <span className="text-slate-500">Final:</span>
                          <span className="font-bold">
                            {dates.endDate ? `${formatShortDate(dates.endDate)} (${dates.endSource?.slice(0, 3)})` : '—'}
                          </span>
                        </div>
                      </td>

                      {/* 4. Descripción del Trabajo */}
                      <td className="py-3 px-3 max-w-md">
                        {row.description ? (
                          <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed line-clamp-3 hover:line-clamp-none">
                            {row.description}
                          </div>
                        ) : (
                          <span className="text-amber-400/80 italic text-xs">Sin descripción cargada</span>
                        )}
                        {visibleComment && (
                          <div className="mt-1 text-[10px] text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                            💬 <strong>Comentario:</strong> {visibleComment}
                          </div>
                        )}
                      </td>

                      {/* 5. Contratistas */}
                      <td className="py-3 px-3">
                        {contractors.length === 0 ? (
                          <span className="text-slate-500 italic text-[11px]">Sin asignar</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {contractors.map(c => {
                              const is3ros = hasThirdPartyPermission(c)
                              return (
                                <span
                                  key={c}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] font-mono font-bold text-slate-200"
                                >
                                  <span>{c}</span>
                                  {is3ros && (
                                    <span
                                      className="text-[8px] px-1 rounded bg-purple-950 text-purple-300 border border-purple-600 font-black"
                                      title="Habilitado para Terceros (3ros) en Padrón"
                                    >
                                      3ros
                                    </span>
                                  )}
                                </span>
                              )
                            })}
                          </div>
                        )}
                      </td>

                      {/* 6. Jefe de Obra */}
                      <td className="py-3 px-3">
                        <span className="font-bold text-amber-300 flex items-center gap-1 text-xs">
                          <User className="w-3 h-3 shrink-0" />
                          <span>{row.foreman_name || 'Sin asignar'}</span>
                        </span>
                      </td>

                      {/* 7. Tipo y Facturación */}
                      <td className="py-3 px-2.5">
                        <span className="font-mono font-bold text-cyan-300 text-[11px] block">
                          {row.work_type || 'HORA'}
                        </span>
                        <span className="text-[10px] text-slate-400 block">
                          {row.assignment_type === 'Adicional / Específico'
                            ? `Adic. (${row.specific_budget_id || 'S/N'})`
                            : 'Presup. Gral.'}
                        </span>
                      </td>

                      {/* 8. Estado del Trabajo (Editable inline + Leyenda Eliminada abajo si corresponde) */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <select
                            value={row.status}
                            onChange={(e) => handleQuickItemStatusChange(row, e.target.value)}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border cursor-pointer focus:outline-none ${stConfig.color}`}
                          >
                            {ESTADOS_TRABAJO.map(st => (
                              <option key={st.value} value={st.value} className="bg-slate-950 text-white">
                                {st.value}
                              </option>
                            ))}
                          </select>
                          {row.status === 'Desestimado' && rowIsEliminada && (
                            <span
                              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/90 text-rose-300 border border-rose-700/80 text-[9px] font-black uppercase tracking-wider"
                              title="Esta OT / trabajo fue desestimada por eliminación (se conserva el registro para no alterar el número consecutivo)"
                            >
                              🗑️ Eliminada
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 9. Alertas y Vinculación PRC Terceros */}
                      <td className="py-3 px-2.5 text-center">
                        <div className="flex flex-col items-center gap-1">
                          {tp && (
                            <button
                              type="button"
                              onClick={() => setEditingThirdParty(tp)}
                              className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500 text-[9px] font-black hover:bg-purple-900 cursor-pointer flex items-center gap-1"
                              title="Ver/Editar Observaciones Directas y Específicas en Terceros"
                            >
                              <span>PRC 3ros (${Number(tp.amount_ars || 0).toLocaleString('es-AR')})</span>
                            </button>
                          )}
                          {alerts.map(a => (
                            <span
                              key={a.code}
                              title={a.label}
                              className={`text-[9px] px-1.5 py-0.5 rounded border font-black ${a.color}`}
                            >
                              ⚠️ {a.code}
                            </span>
                          ))}
                          {!tp && alerts.length === 0 && (
                            <span className="text-[10px] text-emerald-400 font-bold">✓ OK</span>
                          )}
                        </div>
                      </td>

                      {/* 10. Acciones */}
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditWorkModal(row)}
                            className="p-1.5 text-slate-400 hover:text-primary rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Editar este trabajo"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {!row.isPlaceholder && (
                            <button
                              type="button"
                              onClick={() => handleOpenSeparateModal(row)}
                              className="p-1.5 text-amber-400/80 hover:text-amber-300 rounded-lg hover:bg-amber-500/10 transition-colors cursor-pointer"
                              title="Separar / Independizar este trabajo en su propia OT o moverlo a otra OT"
                            >
                              <GitBranch className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedWoDetail(row.wo)}
                            className="p-1.5 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Ver Ficha de la OT y Bitácora (Botón Ampliar)"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {!row.isPlaceholder && (
                            <button
                              type="button"
                              onClick={() => handleDeleteWorkItem(row)}
                              className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Desestimar por eliminación (conserva el consecutivo)"
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
      ) : activeMainTab === 'ots' ? (
        /* ========================================================= */
        /* 4B. VISTA DE CONTENEDORES OT POR BARCO (CON LAS 3 FECHAS) */
        /* ========================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workOrders
            .filter(w => selectedShipFilter === 'todos' || w.ship_id === selectedShipFilter)
            .map(wo => {
              const items = itemsByWoMap[wo.id] || []
              const computed = computeOtState(wo, items)
              const datesAndMetrics = otMetricsAndDatesMap[wo.id] || {
                totalHours: 0,
                createdDate: wo.created_at ? String(wo.created_at).split('T')[0] : null,
                startDate: null,
                endDate: null
              }

              return (
                <div
                  key={wo.id}
                  className="p-5 rounded-2xl bg-slate-900/90 border border-slate-800 hover:border-slate-700 flex flex-col justify-between space-y-4 shadow-xl"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <span className="font-mono text-xs font-black text-primary px-2.5 py-0.5 rounded bg-primary/10 border border-primary/30">
                        {wo.ot_number}
                      </span>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${computed.color}`}>
                          {computed.label}
                        </span>
                        {computed.isEliminada && (
                          <span className="px-2 py-0.5 rounded bg-rose-950/90 text-rose-300 border border-rose-700 text-[9px] font-black uppercase">
                            🗑️ Eliminada
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1">
                      <Ship className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-white font-bold">{wo.ships?.name}</span>
                    </div>

                    <h3 className="text-base font-black text-white">{wo.title}</h3>

                    {/* Lista resumida de trabajos hijos dentro de esta OT con botón Separar */}
                    <div className="mt-3 space-y-1.5 border-t border-slate-800 pt-3">
                      <div className="flex items-center justify-between text-[10px] uppercase font-bold text-slate-400">
                        <span>Trabajos en esta OT ({items.length})</span>
                        <button
                          type="button"
                          onClick={() => handleOpenNewWorkModal(wo)}
                          className="text-primary hover:underline cursor-pointer"
                        >
                          + Agregar Trabajo
                        </button>
                      </div>

                      {items.map(item => {
                        const st = ESTADOS_TRABAJO.find(s => s.value === item.status) || ESTADOS_TRABAJO[0]
                        const itemElim = isWorkItemEliminada(item, wo)
                        return (
                          <div
                            key={item.id}
                            className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 flex items-start justify-between gap-2 text-xs"
                          >
                            <div
                              onClick={() => handleOpenEditWorkModal({ ...item, wo, thirdPartyRecord: thirdPartyByItemMap[item.id] })}
                              className="truncate flex-1 cursor-pointer"
                            >
                              <span className="text-slate-200 block truncate">
                                {item.description || 'Sin descripción'}
                              </span>
                              {(item.contractors || []).length > 0 && (
                                <span className="text-[10px] font-mono text-cyan-400">
                                  {item.contractors.join(', ')}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <div className="flex flex-col items-end gap-0.5">
                                <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${st.color}`}>
                                  {item.status}
                                </span>
                                {item.status === 'Desestimado' && itemElim && (
                                  <span className="text-[8px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-700 font-black uppercase">
                                    🗑️ Eliminada
                                  </span>
                                )}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenSeparateModal({ ...item, wo })}
                                className="p-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 cursor-pointer"
                                title="Separar este trabajo en una OT propia o moverlo a otro contenedor"
                              >
                                <GitBranch className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* BANDA DE HORAS IMPUTADAS + LAS 3 FECHAS DE LA OT (Creación, Inicio Real y Fin Real) */}
                  <div className="pt-3 border-t border-slate-800 space-y-2.5">
                    <div className="grid grid-cols-4 gap-1.5 p-2 rounded-xl bg-slate-950/90 border border-slate-800/80 font-mono text-center">
                      <div>
                        <span className="text-[9px] text-slate-500 uppercase block">Horas Imp.</span>
                        <strong className="text-xs text-primary font-extrabold">
                          {datesAndMetrics.totalHours} hs
                        </strong>
                      </div>
                      <div title="Fecha automática de creación del reporte de esta OT">
                        <span className="text-[9px] text-slate-500 uppercase block">F. Creación</span>
                        <strong className="text-[11px] text-slate-200 font-bold">
                          {formatShortDate(datesAndMetrics.createdDate)}
                        </strong>
                      </div>
                      <div
                        title={
                          datesAndMetrics.startDate
                            ? `1º dato cargado en todo el sistema (${datesAndMetrics.startSource}): ${formatShortDate(datesAndMetrics.startDate, true)}`
                            : 'Aún sin cargas en Horas, Materiales ni Terceros'
                        }
                      >
                        <span className="text-[9px] text-emerald-400/80 uppercase block">F. Inicio</span>
                        <strong className="text-[11px] text-emerald-300 font-bold">
                          {formatShortDate(datesAndMetrics.startDate)}
                        </strong>
                      </div>
                      <div
                        title={
                          datesAndMetrics.endDate
                            ? `Último dato cargado a la OT (${datesAndMetrics.endSource}): ${formatShortDate(datesAndMetrics.endDate, true)}`
                            : 'Aún sin cargas en Horas, Materiales ni Terceros'
                        }
                      >
                        <span className="text-[9px] text-cyan-400/80 uppercase block">F. Final</span>
                        <strong className="text-[11px] text-cyan-300 font-bold">
                          {formatShortDate(datesAndMetrics.endDate)}
                        </strong>
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] text-slate-400">
                        Jefe Obra: <strong className="text-amber-300">{wo.foreman_name || 'S/A'}</strong>
                      </span>

                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelectedWoDetail(wo)}
                          className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 text-primary" />
                          <span>Ficha / Cierre</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWo(wo)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                          title="Desestimar OT por eliminación (conserva el consecutivo)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      ) : (
        /* ========================================================= */
        /* 4C. VISTA DE TERCEROS VINCULADOS (DOBLE OBSERVACIÓN + CASCADA) */
        /* ========================================================= */
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                Registros en Terceros Generados desde Órdenes de Trabajo (Estado PRC)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cada registro recibe las <strong>Observaciones Directas</strong> desde la Descripción del trabajo en la OT y admite <strong>Observaciones Específicas</strong> propias del módulo de Terceros.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Link
                to="/terceros"
                className="px-3.5 py-2 bg-gradient-to-r from-primary to-blue-500 hover:brightness-110 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-500/20 shrink-0"
              >
                <ExternalLink className="w-4 h-4 stroke-[2.5]" />
                <span>Abrir Módulo Completo de Terceros ↗</span>
              </Link>
              <button
                type="button"
                onClick={handleOpenTpCascadeModal}
                className="px-3.5 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-purple-600/20 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ Carga Rápida</span>
              </button>
            </div>
          </div>

          <div className="overflow-y-auto max-h-[calc(100vh-280px)] border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="sticky top-0 z-20 bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 shadow-sm backdrop-blur-md">
                <tr>
                  <th className="py-3 px-3 bg-slate-950">Fecha</th>
                  <th className="py-3 px-3 bg-slate-950">Barco & OT</th>
                  <th className="py-3 px-3 bg-slate-950">Proveedor / Contratista [3ros]</th>
                  <th className="py-3 px-3 text-center bg-slate-950">Estado / Comprobante</th>
                  <th className="py-3 px-3 text-right bg-slate-950">Importe AR$</th>
                  <th className="py-3 px-3 min-w-[220px] text-cyan-300 bg-slate-950">Observaciones Directas (Desde OT)</th>
                  <th className="py-3 px-3 min-w-[220px] text-purple-300 bg-slate-950">Observaciones Específicas (Módulo Terceros)</th>
                  <th className="py-3 px-3 text-right bg-slate-950">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {thirdPartyServices.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      Aún no hay registros PRC generados en Terceros. Al crear un trabajo con un único contratista que tenga el permiso <strong>3ros</strong> activo, podrás activar la carga automática a Terceros.
                    </td>
                  </tr>
                ) : (
                  thirdPartyServices.map(tp => {
                    const wo = workOrders.find(w => w.id === tp.work_order_id)
                    const tpDate = tp.service_date || (tp.created_at ? String(tp.created_at).split('T')[0] : null)
                    return (
                      <tr key={tp.id} className="hover:bg-slate-800/30 transition-colors align-top">
                        <td className="py-3 px-3 font-mono text-[11px] text-slate-300">
                          {formatShortDate(tpDate, true)}
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-bold text-white block">{wo?.ships?.name || 'Barco'}</span>
                          <span className="font-mono text-[11px] text-primary font-bold">
                            {wo?.ot_number} &bull; {wo?.title}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <span className="font-mono font-extrabold text-purple-300 px-2 py-0.5 rounded bg-purple-950 border border-purple-700">
                            {tp.contractor_name}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 font-mono font-bold text-[10px]">
                            {tp.status || 'PRC'} {tp.voucher_number ? `#${tp.voucher_number}` : ''}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-emerald-400">
                          ${Number(tp.amount_ars || 0).toLocaleString('es-AR')}
                        </td>
                        <td className="py-3 px-3">
                          <div className="p-2 rounded-lg bg-slate-950 border border-cyan-900/50 text-slate-200 whitespace-pre-wrap text-[11px]">
                            {tp.direct_observations || '-'}
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="p-2 rounded-lg bg-slate-950 border border-purple-900/50 text-purple-200 whitespace-pre-wrap text-[11px]">
                            {tp.specific_observations || (
                              <span className="text-slate-500 italic">Sin observaciones específicas cargadas</span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => setEditingThirdParty(tp)}
                            className="px-2.5 py-1 rounded-lg bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold cursor-pointer inline-flex items-center gap-1"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Editar Obs. Específica</span>
                          </button>
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

      {/* ========================================================= */}
      {/* 5. MODAL EN CASCADA: CARGAR TRABAJO / NUEVA OT            */}
      {/* ========================================================= */}
      {isWorkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 relative my-8 max-h-[94vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-mono text-[10px] font-bold flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>Fecha de Creación (Automática HOY): {formatShortDate(workForm.created_date, true)}</span>
                  </span>
                </div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  {editingWorkItem ? 'Editar Trabajo en Orden de Trabajo' : 'Cargar Trabajo / Nueva Orden de Trabajo'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Flujo de carga según planilla GS-003: 1º Barco &rarr; 2º OT (Tabulada con Selección Múltiple o Libre) &rarr; 3º Estado del Trabajo, Contratista(s), Jefe de Obra y Tipo de Facturación.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsWorkModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkSubmit} className="space-y-4">
              {/* PASO 1 Y 2: BARCO Y CONTENEDOR OT */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* 1. Selección de Barco (Nombre limpio y solo) */}
                  <div>
                    <label className="block text-xs font-bold text-cyan-400 uppercase mb-1">
                      1. Barco / Embarcación *
                    </label>
                    <select
                      required
                      disabled={Boolean(editingWorkItem)}
                      value={workForm.ship_id}
                      onChange={(e) => handleShipChangeInForm(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-primary disabled:opacity-60"
                    >
                      {ships.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Modo de OT: Existente vs Nueva OT (o botón Separar si está editando) */}
                  <div>
                    <label className="block text-xs font-bold text-cyan-400 uppercase mb-1">
                      2. Orden de Trabajo (Contenedor) *
                    </label>
                    {editingWorkItem ? (
                      <div className="flex items-center justify-between gap-2 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-primary">
                        <span className="truncate">{workForm.ot_number} &bull; {workForm.ot_title}</span>
                        <button
                          type="button"
                          onClick={() => handleOpenSeparateModal(editingWorkItem)}
                          className="px-2 py-0.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                          title="Separar este trabajo en una OT propia o moverlo a otra OT"
                        >
                          <GitBranch className="w-3 h-3" />
                          <span>Separar de esta OT</span>
                        </button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const shipWos = workOrders.filter(w => w.ship_id === workForm.ship_id)
                            if (shipWos.length === 0) {
                              alert('Este barco aún no tiene OTs abiertas. Creá una Nueva OT.')
                              return
                            }
                            setWorkForm(prev => ({
                              ...prev,
                              ot_mode: 'existing',
                              existing_wo_id: shipWos[0]?.id || ''
                            }))
                          }}
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            workForm.ot_mode === 'existing'
                              ? 'bg-primary text-slate-950 border-primary shadow'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          Usar OT Existente ({workOrders.filter(w => w.ship_id === workForm.ship_id).length})
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setWorkForm(prev => ({
                              ...prev,
                              ot_mode: 'new',
                              ot_number: getNextOtNumberForShip(prev.ship_id)
                            }))
                          }
                          className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            workForm.ot_mode === 'new'
                              ? 'bg-amber-400 text-slate-950 border-amber-400 shadow'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          + Crear Nueva OT
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Si elige OT Existente */}
                {!editingWorkItem && workForm.ot_mode === 'existing' && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Seleccionar Orden de Trabajo abierta en este barco:
                    </label>
                    <select
                      value={workForm.existing_wo_id}
                      onChange={(e) => setWorkForm(prev => ({ ...prev, existing_wo_id: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-primary"
                    >
                      {workOrders
                        .filter(w => w.ship_id === workForm.ship_id)
                        .map(w => (
                          <option key={w.id} value={w.id}>
                            {w.ot_number} &bull; {w.title} (Jefe Obra: {w.foreman_name || 'S/A'})
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                {/* Si elige Crear Nueva OT: Tabulada (OT.ABC con selección múltiple) vs Libre */}
                {(workForm.ot_mode === 'new' || editingWorkItem) && (
                  <div className="space-y-3 pt-2 border-t border-slate-800/80">
                    {!editingWorkItem && (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-300">Tipo de OT:</span>
                          <button
                            type="button"
                            onClick={() => setWorkForm(prev => ({ ...prev, ot_creation_type: 'tabulada' }))}
                            className={`px-3 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                              workForm.ot_creation_type === 'tabulada'
                                ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                                : 'bg-slate-900 text-slate-400 border-slate-800'
                            }`}
                          >
                            📋 OT Tabulada (Catálogo OT.ABC)
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedBatchTemplates([])
                              setShowInlineMultiPicker(false)
                              setWorkForm(prev => ({ ...prev, ot_creation_type: 'libre', selected_template_id: '' }))
                            }}
                            className={`px-3 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                              workForm.ot_creation_type === 'libre'
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500'
                                : 'bg-slate-900 text-slate-400 border-slate-800'
                            }`}
                          >
                            ✍️ OT Libre (Escribir nombre)
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          {workForm.ot_creation_type === 'tabulada' && (
                            <button
                              type="button"
                              onClick={() => setShowInlineMultiPicker(prev => !prev)}
                              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border flex items-center gap-1 cursor-pointer transition-all ${
                                showInlineMultiPicker || selectedBatchTemplates.length > 1
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                                  : 'bg-slate-900 text-amber-300 border-amber-500/40 hover:border-amber-400'
                              }`}
                            >
                              <Layers className="w-3.5 h-3.5" />
                              <span>
                                {selectedBatchTemplates.length > 1
                                  ? `Selección Múltiple (${selectedBatchTemplates.length} OTs)`
                                  : 'Seleccionar Varias OTs (5-6 al subir barco)'}
                              </span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenCatalog(true)}
                            className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Catálogo OT.ABC</span>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Selector directo o Selección Múltiple de plantillas si es OT Tabulada */}
                    {!editingWorkItem && workForm.ot_creation_type === 'tabulada' && (
                      <div className="space-y-3">
                        {/* Selector rápido para 1 OT si no está usando selección múltiple */}
                        {selectedBatchTemplates.length <= 1 && !showInlineMultiPicker && (
                          <div>
                            <label className="block text-[11px] font-semibold text-amber-300 mb-1">
                              Seleccionar Trabajo Tabulado del Catálogo (OT.ABC) — o usá &quot;Seleccionar Varias OTs&quot; arriba para abrir 5-6 juntas:
                            </label>
                            <select
                              value={workForm.selected_template_id}
                              onChange={(e) => handleSelectTabulatedTemplate(e.target.value)}
                              className="w-full bg-slate-900 border border-amber-500/50 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-amber-400"
                            >
                              <option value="">-- Elegir trabajo estándar de OT.ABC --</option>
                              {[...GRUPOS_CATALOGO, ''].map(grupo => {
                                const groupItems = templates.filter(t => (t.category || '') === grupo)
                                if (groupItems.length === 0) return null
                                return (
                                  <optgroup key={grupo || 'sin'} label={grupo || 'General / Sin clasificar'}>
                                    {groupItems.map(tpl => (
                                      <option key={tpl.id} value={tpl.id}>
                                        {tpl.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                )
                              })}
                            </select>
                          </div>
                        )}

                        {/* Panel desplegable de Selección Múltiple de OTs del Catálogo OT.ABC */}
                        {showInlineMultiPicker && (
                          <div className="p-3.5 rounded-2xl bg-slate-900 border border-amber-500/40 space-y-2.5 animate-in fade-in duration-150">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div>
                                <span className="text-xs font-black text-amber-300 block">
                                  ☑️ Selección Múltiple del Catálogo OT.ABC ({selectedBatchTemplates.length} seleccionada{selectedBatchTemplates.length === 1 ? '' : 's'})
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  Marcá todas las OTs estándar que quieras abrir simultáneamente para este barco. Abajo podrás editar el estado de cada una.
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setShowInlineMultiPicker(false)}
                                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 font-bold cursor-pointer"
                              >
                                Listo ({selectedBatchTemplates.length})
                              </button>
                            </div>

                            <div className="relative">
                              <Search className="w-3.5 h-3.5 absolute left-3 top-2 text-slate-500" />
                              <input
                                type="text"
                                value={inlineCatalogSearch}
                                onChange={(e) => setInlineCatalogSearch(e.target.value)}
                                placeholder="Filtrar plantillas en OT.ABC por nombre o descripción..."
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                              />
                            </div>

                            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
                              {[...GRUPOS_CATALOGO, ''].map(grupo => {
                                const q = inlineCatalogSearch.trim().toLowerCase()
                                const groupItems = templates.filter(
                                  t =>
                                    (t.category || '') === grupo &&
                                    (!q ||
                                      t.name.toLowerCase().includes(q) ||
                                      (t.description || '').toLowerCase().includes(q))
                                )
                                if (groupItems.length === 0) return null
                                return (
                                  <div key={grupo || 'sin'} className="space-y-1">
                                    <span className="text-[10px] font-black uppercase text-amber-400/90 block">
                                      {grupo || 'General / Sin clasificar'}
                                    </span>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                      {groupItems.map(tpl => {
                                        const isChecked = selectedBatchTemplates.some(i => i.template_id === tpl.id)
                                        return (
                                          <label
                                            key={tpl.id}
                                            className={`flex items-start gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-all ${
                                              isChecked
                                                ? 'bg-amber-500/15 border-amber-400 text-white font-bold'
                                                : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                                            }`}
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isChecked}
                                              onChange={() => handleToggleBatchTemplate(tpl)}
                                              className="mt-0.5 w-3.5 h-3.5 rounded accent-amber-500 shrink-0"
                                            />
                                            <div className="min-w-0 flex-1">
                                              <span className="block truncate">{tpl.name}</span>
                                              {tpl.description && (
                                                <span className="block text-[10px] text-slate-400 truncate font-normal">
                                                  {tpl.description}
                                                </span>
                                              )}
                                            </div>
                                          </label>
                                        )
                                      })}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* Grilla de OTs seleccionadas cuando se abren múltiples OTs a la vez (Consecutivo bloqueado + Estado editable por cada una) */}
                        {selectedBatchTemplates.length > 1 && (
                          <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/50 space-y-2.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-black text-emerald-300 flex items-center gap-1.5">
                                <Layers className="w-4 h-4 text-emerald-400" />
                                <span>
                                  Apertura Simultánea de {selectedBatchTemplates.length} OTs Consecutivas (Estado editable por cada OT)
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedBatchTemplates([])}
                                className="text-[10px] text-slate-400 hover:text-rose-400 underline cursor-pointer"
                              >
                                Limpiar selección
                              </button>
                            </div>

                            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                              {selectedBatchTemplates.map((batchItem, idx) => {
                                const autoOtNum = getNextOtNumberForShip(workForm.ship_id, idx)
                                const stObj = ESTADOS_TRABAJO.find(s => s.value === batchItem.status) || ESTADOS_TRABAJO[0]
                                return (
                                  <div
                                    key={batchItem.template_id}
                                    className="p-2.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2"
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                      <div className="flex items-center gap-2 min-w-0">
                                        <span
                                          className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 font-mono text-[11px] font-black text-primary shrink-0"
                                          title="Consecutivo asignado automáticamente por el sistema"
                                        >
                                          🔒 {autoOtNum}
                                        </span>
                                        <span className="font-bold text-white text-xs truncate">
                                          {batchItem.ot_title}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-2 shrink-0">
                                        <label className="text-[10px] font-bold text-slate-400 uppercase">
                                          Estado:
                                        </label>
                                        <select
                                          value={batchItem.status}
                                          onChange={(e) =>
                                            handleUpdateBatchTemplateItem(
                                              batchItem.template_id,
                                              'status',
                                              e.target.value
                                            )
                                          }
                                          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border cursor-pointer focus:outline-none ${stObj.color}`}
                                        >
                                          {ESTADOS_TRABAJO.map(st => (
                                            <option key={st.value} value={st.value} className="bg-slate-950 text-white">
                                              {st.label}
                                            </option>
                                          ))}
                                        </select>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleToggleBatchTemplate({
                                              id: batchItem.template_id,
                                              name: batchItem.ot_title,
                                              description: batchItem.description
                                            })
                                          }
                                          className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                                          title="Quitar esta OT del lote"
                                        >
                                          <X className="w-3.5 h-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    <input
                                      type="text"
                                      value={batchItem.description}
                                      onChange={(e) =>
                                        handleUpdateBatchTemplateItem(
                                          batchItem.template_id,
                                          'description',
                                          e.target.value
                                        )
                                      }
                                      placeholder="Descripción del trabajo para esta OT..."
                                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 focus:outline-none focus:border-primary"
                                    />
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Si es 1 sola OT (o Libre, o Edición): Mostrar Nº Consecutivo BLOQUEADO y Nombre de la OT */}
                    {selectedBatchTemplates.length <= 1 && (
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                            Nº OT (Consecutivo Sistema)
                          </label>
                          <div className="relative">
                            <input
                              type="text"
                              readOnly
                              disabled
                              value={workForm.ot_number}
                              title="El número consecutivo lo decide automáticamente el sistema y no es editable"
                              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-primary font-mono font-black cursor-not-allowed opacity-90"
                            />
                            <span className="absolute right-2.5 top-2 text-[10px] text-slate-500 font-bold">
                              🔒 Auto
                            </span>
                          </div>
                        </div>
                        <div className="sm:col-span-3">
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Nombre de la Orden de Trabajo (OT) *
                          </label>
                          <input
                            type="text"
                            required={workForm.ot_mode === 'new' && selectedBatchTemplates.length <= 1}
                            value={workForm.ot_title}
                            onChange={(e) => setWorkForm(prev => ({ ...prev, ot_title: e.target.value }))}
                            placeholder="Ej: CARENADO DE CASCO o CAMBIO MOTOR"
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-primary"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* PASO 3: DATOS DEL TRABAJO INDIVIDUAL (WORK ITEM) */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-primary">
                  3. Detalle Operativo del Trabajo {selectedBatchTemplates.length > 1 ? `(Común a las ${selectedBatchTemplates.length} OTs seleccionadas)` : ''}
                </h4>

                {/* Descripción del Trabajo (oculta si ya está editando cada una en lote múltiple) */}
                {selectedBatchTemplates.length <= 1 && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Descripción del Trabajo (Si se envía a Terceros, este texto pasa a Observaciones Directas) *
                    </label>
                    <textarea
                      rows={4}
                      value={workForm.description}
                      onChange={(e) => setWorkForm(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Detalle específico del trabajo a realizar..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                    />
                  </div>
                )}

                {/* Estado del Trabajo, Jefe de Obra (con opción de Crear al final de la lista) y Tipo de Trabajo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      {selectedBatchTemplates.length > 1 ? 'Estado por Defecto (o individual arriba)' : 'Estado del Trabajo *'}
                    </label>
                    <select
                      value={workForm.status}
                      onChange={(e) => {
                        const nextStatus = e.target.value
                        setWorkForm(prev => ({ ...prev, status: nextStatus }))
                        if (selectedBatchTemplates.length === 1) {
                          setSelectedBatchTemplates(prev =>
                            prev.map((it, idx) => (idx === 0 ? { ...it, status: nextStatus } : it))
                          )
                        }
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-primary"
                    >
                      {ESTADOS_TRABAJO.map(st => (
                        <option key={st.value} value={st.value}>{st.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-amber-300">
                        Jefe de Obra (Desde Padrón) *
                      </label>
                      <button
                        type="button"
                        onClick={() => setIsCreatingForemanInline(prev => !prev)}
                        className="text-[10px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
                      >
                        {isCreatingForemanInline ? 'Cancelar' : '+ Crear'}
                      </button>
                    </div>
                    <select
                      value={workForm.foreman_name}
                      onChange={(e) => {
                        if (e.target.value === '__CREATE_NEW_FOREMAN__') {
                          setIsCreatingForemanInline(true)
                        } else {
                          setWorkForm(prev => ({ ...prev, foreman_name: e.target.value }))
                        }
                      }}
                      className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                    >
                      {foremenList.map(f => (
                        <option key={f} value={f} className="bg-slate-900 text-amber-300">
                          {f}
                        </option>
                      ))}
                      <option value="__CREATE_NEW_FOREMAN__" className="bg-slate-950 text-emerald-400 font-black">
                        + Crear nuevo Jefe de Obra...
                      </option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Tipo de Trabajo *
                    </label>
                    <select
                      value={workForm.work_type}
                      onChange={(e) => setWorkForm(prev => ({ ...prev, work_type: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-cyan-300 font-bold focus:outline-none focus:border-primary"
                    >
                      {TIPOS_DE_TRABAJO.map(t => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* CAJA IN-SITU PARA CREAR NUEVO JEFE DE OBRA SIN SALIR DEL MODAL (Único rubro disponible: Técnico) */}
                {isCreatingForemanInline && (
                  <div className="p-3.5 rounded-2xl bg-amber-950/20 border border-amber-500/50 space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-amber-300 flex items-center gap-1.5">
                        <UserPlus className="w-4 h-4 text-amber-400" />
                        <span>Alta Rápida de Nuevo Jefe de Obra (Sincroniza Padrón Personal + Operaciones)</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsCreatingForemanInline(false)}
                        className="text-slate-400 hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      <div className="sm:col-span-2">
                        <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                          Nombre y Apellido del Jefe de Obra *
                        </label>
                        <input
                          type="text"
                          value={newForemanForm.name}
                          onChange={(e) => setNewForemanForm(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Ej: JORGE GEORGETTI"
                          className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-amber-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-slate-300 uppercase mb-1">
                          Rubro / Especialidad (Fijo)
                        </label>
                        <select
                          value="TECNICOS"
                          disabled
                          className="w-full bg-slate-950 border border-amber-500/40 rounded-xl px-2.5 py-1.5 text-xs text-amber-300 font-bold cursor-not-allowed"
                        >
                          <option value="TECNICOS">Técnico (TECNICOS)</option>
                        </select>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span className="text-[10px] text-slate-400">
                        Se dará de alta en <strong>Personal y Tarifas</strong> bajo el rubro <strong>Técnico (TECNICOS)</strong> con permiso <strong>JO</strong> activo.
                      </span>
                      <button
                        type="button"
                        disabled={savingNewForeman}
                        onClick={handleCreateForemanInline}
                        className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5 shrink-0"
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                        <span>{savingNewForeman ? 'Creando...' : 'Crear y Seleccionar'}</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Tipo de Facturación (Centro de Facturación) + Ayuda Auto-Entrenable y Nº Presupuesto Específico */}
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Tipo de Facturación (Centro de Facturación)
                      </label>
                      <select
                        value={workForm.assignment_type}
                        onChange={(e) => setWorkForm(prev => ({ ...prev, assignment_type: e.target.value }))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                      >
                        <option value="Presupuesto General">Presupuesto General</option>
                        <option value="Adicional / Específico">Adicional / Específico</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-300 mb-1">
                        Nº Presupuesto Específico {workForm.assignment_type === 'Adicional / Específico' ? '*' : '(Opcional)'}
                      </label>
                      <input
                        type="text"
                        required={workForm.assignment_type === 'Adicional / Específico'}
                        value={workForm.specific_budget_id}
                        onChange={(e) => setWorkForm(prev => ({ ...prev, specific_budget_id: e.target.value }))}
                        placeholder="Ej: PRES-ADIC-04"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  {/* Cuadro de Ayuda al Usuario Auto-Entrenable para Tipo de Facturación */}
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-cyan-900/50 text-[11px] space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-400" />
                        <span>Guía de Ayuda al Usuario (Auto-entrenable) &bull; Tipo de Facturación</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setIsEditingBillingHelp(prev => !prev)}
                        className="text-[10px] text-amber-400 hover:text-amber-300 font-bold underline cursor-pointer"
                      >
                        {isEditingBillingHelp ? 'Cerrar edición' : '✏️ Entrenar / Editar ayuda'}
                      </button>
                    </div>

                    {isEditingBillingHelp ? (
                      <div className="space-y-2 pt-1">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-300 mb-0.5">
                            Presupuesto General:
                          </label>
                          <input
                            type="text"
                            value={billingTypeHelp.presupuestoGeneral}
                            onChange={(e) =>
                              setBillingTypeHelp(prev => ({ ...prev, presupuestoGeneral: e.target.value }))
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-300 mb-0.5">
                            Adicional/especifico:
                          </label>
                          <input
                            type="text"
                            value={billingTypeHelp.adicionalEspecifico}
                            onChange={(e) =>
                              setBillingTypeHelp(prev => ({ ...prev, adicionalEspecifico: e.target.value }))
                            }
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white"
                          />
                        </div>
                        <div className="flex justify-end">
                          <button
                            type="button"
                            onClick={() => handleSaveBillingHelp(billingTypeHelp)}
                            className="px-3 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg text-[10px] cursor-pointer"
                          >
                            Guardar Ayuda
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-300">
                        <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                          <strong className="text-white">Presupuesto General:</strong>{' '}
                          <span className="text-slate-400">{billingTypeHelp.presupuestoGeneral}</span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/80 border border-slate-800/80">
                          <strong className="text-white">Adicional/especifico:</strong>{' '}
                          <span className="text-slate-400">{billingTypeHelp.adicionalEspecifico}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Selección de Contratista(s) / Taller(es) con Buscador por Escritura en Tiempo Real */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <label className="block text-xs font-bold text-slate-200">
                    Contratista(s) / Grupo(s) de Trabajo Habilitados en esta OT (Filtra Carga de Horas, Materiales y Terceros)
                  </label>
                  <div className="relative">
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                        <input
                          type="text"
                          value={contractorSelectInput}
                          onFocus={() => setIsContractorListOpen(true)}
                          onChange={(e) => {
                            setContractorSelectInput(e.target.value)
                            setIsContractorListOpen(true)
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && filteredContractorsForSearch.length > 0) {
                              e.preventDefault()
                              handleAddContractorToForm(filteredContractorsForSearch[0].name)
                            }
                          }}
                          placeholder="Escribí para filtrar conforme vas escribiendo (ej: raschinaje, caldereria, pintor juarez)..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-8 pr-8 py-2 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-primary"
                        />
                        {contractorSelectInput && (
                          <button
                            type="button"
                            onClick={() => setContractorSelectInput('')}
                            className="absolute right-2.5 top-2 text-slate-400 hover:text-white cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsContractorListOpen(prev => !prev)}
                        className="px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-700 rounded-xl text-xs font-bold text-slate-300 cursor-pointer shrink-0"
                      >
                        {isContractorListOpen ? 'Ocultar lista' : `Ver lista (${filteredContractorsForSearch.length})`}
                      </button>
                    </div>

                    {/* Resultados filtrados en vivo conforme se escribe */}
                    {(isContractorListOpen || contractorSelectInput.trim().length > 0) && (
                      <div className="mt-1.5 p-2 rounded-xl bg-slate-900 border border-slate-700 shadow-xl max-h-48 overflow-y-auto space-y-1 z-20">
                        {filteredContractorsForSearch.length === 0 ? (
                          <p className="text-[11px] text-slate-400 py-2 px-2 text-center">
                            No se encontraron contratistas o grupos que coincidan con &quot;{contractorSelectInput}&quot;.
                          </p>
                        ) : (
                          filteredContractorsForSearch.map(c => (
                            <button
                              key={c.name}
                              type="button"
                              onClick={() => handleAddContractorToForm(c.name)}
                              className="w-full text-left px-3 py-1.5 rounded-lg hover:bg-slate-800 flex items-center justify-between gap-2 text-xs font-mono transition-colors cursor-pointer"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="font-bold text-white truncate">{c.name}</span>
                                <span className="text-[10px] text-slate-400">
                                  ({c.admin_center === 'ASTILLERO' ? 'Sector Propio' : c.admin_center})
                                </span>
                              </div>
                              <span
                                className={`text-[9px] px-1.5 py-0.5 rounded font-black border shrink-0 ${
                                  c.can_charge_third_party
                                    ? 'bg-purple-950 text-purple-300 border-purple-500'
                                    : 'bg-slate-950 text-slate-500 border-slate-800'
                                }`}
                              >
                                {c.can_charge_third_party ? 'Permiso 3ros ACTIVO' : 'Sin Permiso 3ros'}
                              </span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  {/* Chips de contratistas seleccionados */}
                  {workForm.contractors.length === 0 ? (
                    <p className="text-[11px] text-slate-500 italic">
                      Aún no se seleccionaron contratistas para este trabajo.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2 pt-1">
                      {workForm.contractors.map(c => {
                        const is3ros = hasThirdPartyPermission(c)
                        return (
                          <div
                            key={c}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-white"
                          >
                            <span>{c}</span>
                            <span
                              className={`text-[9px] px-1.5 py-0.2 rounded font-black border ${
                                is3ros
                                  ? 'bg-purple-950 text-purple-300 border-purple-500'
                                  : 'bg-slate-950 text-slate-500 border-slate-800 line-through'
                              }`}
                            >
                              3ros
                            </span>
                            <button
                              type="button"
                              onClick={() => handleRemoveContractorFromForm(c)}
                              className="text-slate-400 hover:text-rose-400 ml-1 cursor-pointer"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* REGLA CONDICIONAL DE AUTOCARGA PRC $0 EN TERCEROS (DEC-014) */}
                <div
                  className={`p-3.5 rounded-2xl border transition-all space-y-2 ${
                    thirdPartyPrcEvaluation.canEnable
                      ? 'bg-purple-950/30 border-purple-500/60'
                      : 'bg-slate-900/60 border-slate-800 opacity-85'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <label
                      className={`flex items-center gap-2.5 text-xs font-black ${
                        thirdPartyPrcEvaluation.canEnable ? 'text-purple-200 cursor-pointer' : 'text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={!thirdPartyPrcEvaluation.canEnable}
                        checked={Boolean(workForm.send_to_third_party_prc && thirdPartyPrcEvaluation.canEnable)}
                        onChange={(e) => setWorkForm(prev => ({ ...prev, send_to_third_party_prc: e.target.checked }))}
                        className="w-4 h-4 rounded accent-purple-500 disabled:opacity-40"
                      />
                      <span>Cargar automáticamente registro PRC $0 en módulo de Terceros [Permiso 3ros]</span>
                    </label>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-black border shrink-0 ${
                        thirdPartyPrcEvaluation.canEnable
                          ? 'bg-purple-950 text-purple-300 border-purple-500'
                          : 'bg-slate-950 text-slate-500 border-slate-800'
                      }`}
                    >
                      {thirdPartyPrcEvaluation.canEnable ? '✓ HABILITADO (3ros)' : '🔒 BLOQUEADO'}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {thirdPartyPrcEvaluation.reason}
                  </p>

                  {thirdPartyPrcEvaluation.canEnable && workForm.send_to_third_party_prc && (
                    <div className="pt-2 border-t border-purple-800/50 space-y-2">
                      <div className="text-[11px] text-cyan-300 bg-slate-950/90 p-2.5 rounded-xl border border-cyan-900/50">
                        <strong className="block text-[10px] uppercase text-cyan-400 mb-0.5">
                          1. Observaciones Directas (Vinculadas automáticamente de la Descripción de esta OT):
                        </strong>
                        <span className="text-slate-300 italic">
                          {workForm.description.trim() || '(Se copiará lo que escribas en el campo Descripción del Trabajo)'}
                        </span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-purple-300 mb-1">
                          2. Observaciones Específicas de Terceros (Opcional - Propias del módulo de Terceros):
                        </label>
                        <input
                          type="text"
                          value={workForm.specific_observations}
                          onChange={(e) => setWorkForm(prev => ({ ...prev, specific_observations: e.target.value }))}
                          placeholder="Notas internas de presupuesto, condiciones comerciales o alcance específico para Terceros..."
                          className="w-full bg-slate-950 border border-purple-700/70 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Comentario Auxiliar */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Comentario Auxiliar
                  </label>
                  <input
                    type="text"
                    value={workForm.comments}
                    onChange={(e) => setWorkForm(prev => ({ ...prev, comments: e.target.value }))}
                    placeholder="Materiales esperados, notas operativas..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsWorkModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingWork}
                  className="px-5 py-2 bg-gradient-to-r from-primary to-cyan-500 hover:brightness-110 text-slate-950 text-xs font-black rounded-xl shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>
                    {savingWork
                      ? 'Guardando...'
                      : selectedBatchTemplates.length > 1 && workForm.ot_mode === 'new' && workForm.ot_creation_type === 'tabulada'
                      ? `Abrir ${selectedBatchTemplates.length} OTs Seleccionadas`
                      : 'Guardar Trabajo'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5B. MODAL: SEPARAR / INDEPENDIZAR TRABAJO DE CONTENEDOR OT */}
      {/* ========================================================= */}
      {separatingRow && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-xl bg-slate-900 border border-amber-500/50 rounded-3xl shadow-2xl p-6 space-y-4 my-8">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase">
                  Desglose y Reasignación con Trazabilidad
                </span>
                <h3 className="text-base font-black text-white flex items-center gap-2 mt-1">
                  <GitBranch className="w-5 h-5 text-amber-400" />
                  Separar / Independizar Trabajo de su Contenedor OT
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Si este trabajo inició dentro de una OT pero ahora necesita tener su propia OT independiente (o pasar a otra OT del mismo barco), elegí el destino abajo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSeparatingRow(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Resumen del trabajo a separar */}
            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>
                  Barco: <strong className="text-white">{separatingRow.wo?.ships?.name}</strong>
                </span>
                <span>
                  OT Actual: <strong className="text-primary font-mono">{separatingRow.wo?.ot_number} &bull; {separatingRow.wo?.title}</strong>
                </span>
              </div>
              <p className="text-slate-200 font-medium line-clamp-3">
                {separatingRow.description || 'Sin descripción'}
              </p>
              {(separatingRow.contractors || []).length > 0 && (
                <div className="text-[10px] text-cyan-400 font-mono">
                  Contratista(s): {separatingRow.contractors.join(', ')}
                </div>
              )}
            </div>

            <form onSubmit={handleConfirmSeparateWorkItem} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSeparateForm(prev => ({ ...prev, mode: 'new_ot' }))}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    separateForm.mode === 'new_ot'
                      ? 'bg-amber-500/20 border-amber-400 text-white shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-black text-amber-300 flex items-center gap-1.5">
                    <Plus className="w-3.5 h-3.5" />
                    <span>1. Darle una Nueva OT Propia</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Crea un nuevo contenedor OT independiente en este barco y traslada el trabajo allí.
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const otherWos = workOrders.filter(
                      w => w.ship_id === separatingRow.wo?.ship_id && w.id !== separatingRow.work_order_id
                    )
                    if (otherWos.length === 0) {
                      alert('Este barco no tiene otras OTs abiertas además de la actual. Usá la opción "Darle una Nueva OT Propia".')
                      return
                    }
                    setSeparateForm(prev => ({
                      ...prev,
                      mode: 'existing_ot',
                      target_existing_wo_id: otherWos[0]?.id || ''
                    }))
                  }}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                    separateForm.mode === 'existing_ot'
                      ? 'bg-cyan-500/20 border-cyan-400 text-white shadow'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                  }`}
                >
                  <div className="font-black text-cyan-300 flex items-center gap-1.5">
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>2. Mover a otra OT del Barco</span>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Traslada este trabajo a otro contenedor OT ya existente en la misma embarcación.
                  </p>
                </button>
              </div>

              {separateForm.mode === 'new_ot' ? (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-300">Tipo de Nueva OT:</span>
                    <button
                      type="button"
                      onClick={() => setSeparateForm(prev => ({ ...prev, ot_creation_type: 'tabulada' }))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                        separateForm.ot_creation_type === 'tabulada'
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      📋 OT Tabulada (OT.ABC)
                    </button>
                    <button
                      type="button"
                      onClick={() => setSeparateForm(prev => ({ ...prev, ot_creation_type: 'libre', selected_template_id: '' }))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${
                        separateForm.ot_creation_type === 'libre'
                          ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800'
                      }`}
                    >
                      ✍️ OT Libre
                    </button>
                  </div>

                  {separateForm.ot_creation_type === 'tabulada' && (
                    <div>
                      <label className="block text-[11px] font-semibold text-amber-300 mb-1">
                        Elegir nombre del Catálogo (OT.ABC):
                      </label>
                      <select
                        value={separateForm.selected_template_id}
                        onChange={(e) => {
                          const tpl = templates.find(t => t.id === e.target.value)
                          setSeparateForm(prev => ({
                            ...prev,
                            selected_template_id: e.target.value,
                            new_ot_title: tpl ? tpl.name : prev.new_ot_title
                          }))
                        }}
                        className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-white font-bold"
                      >
                        <option value="">-- Seleccionar plantilla OT.ABC --</option>
                        {templates.map(t => (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.category ? `(${t.category})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                        Nº Nueva OT (Sistema)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          readOnly
                          disabled
                          value={separateForm.new_ot_number}
                          title="El número consecutivo lo decide automáticamente el sistema"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-primary font-mono font-black cursor-not-allowed"
                        />
                        <span className="absolute right-2 top-1.5 text-[10px] text-slate-500 font-bold">
                          🔒 Auto
                        </span>
                      </div>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                        Nombre de la Nueva OT Independiente *
                      </label>
                      <input
                        type="text"
                        required
                        value={separateForm.new_ot_title}
                        onChange={(e) => setSeparateForm(prev => ({ ...prev, new_ot_title: e.target.value }))}
                        placeholder="Ej: REPARACIÓN DE TIMÓN"
                        className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Seleccionar Orden de Trabajo destino en {separatingRow.wo?.ships?.name}:
                  </label>
                  <select
                    value={separateForm.target_existing_wo_id}
                    onChange={(e) => setSeparateForm(prev => ({ ...prev, target_existing_wo_id: e.target.value }))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
                  >
                    {workOrders
                      .filter(w => w.ship_id === separatingRow.wo?.ship_id && w.id !== separatingRow.work_order_id)
                      .map(w => (
                        <option key={w.id} value={w.id}>
                          {w.ot_number} &bull; {w.title}
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={separateForm.migrate_linked_records}
                  onChange={(e) => setSeparateForm(prev => ({ ...prev, migrate_linked_records: e.target.checked }))}
                  className="w-4 h-4 rounded accent-amber-500"
                />
                <span>
                  Arrastrar automáticamente los registros vinculados de Terceros (PRC), Horas y Materiales de este trabajo a la OT destino
                </span>
              </label>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Motivo de la separación / reasignación (Trazabilidad en bitácora) *
                </label>
                <input
                  type="text"
                  required
                  value={separateForm.reason}
                  onChange={(e) => setSeparateForm(prev => ({ ...prev, reason: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setSeparatingRow(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingSeparate}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <GitBranch className="w-4 h-4" />
                  <span>{savingSeparate ? 'Separando...' : 'Confirmar Separación'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5C. MODAL DE CARGA EN TERCEROS CON CASCADA ESTRICTA       */}
      {/* (1º Barco -> 2º Contratista Habilitado 3ros -> 3º OT)     */}
      {/* ========================================================= */}
      {isThirdPartyCascadeOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-xl bg-slate-900 border border-purple-600/60 rounded-3xl shadow-2xl p-6 space-y-4 my-8">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-700 text-[10px] font-black uppercase">
                  Principio 3 &bull; Bloqueo por OT y Contratista Habilitado
                </span>
                <h3 className="text-base font-black text-white flex items-center gap-2 mt-1">
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                  Cargar en Terceros (Cascada: Barco &rarr; Contratista &rarr; OT)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Solo aparecen los contratistas con permiso <strong>3ros</strong> asignados a trabajos en estado <strong>&quot;En ejecución&quot;</strong> en el barco elegido.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsThirdPartyCascadeOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTpCascade} className="space-y-3.5 text-xs">
              {/* 1. Barco */}
              <div>
                <label className="block text-[11px] font-bold text-cyan-400 uppercase mb-1">
                  1. Seleccionar Barco *
                </label>
                <select
                  required
                  value={tpCascadeForm.ship_id}
                  onChange={(e) =>
                    setTpCascadeForm(prev => ({
                      ...prev,
                      ship_id: e.target.value,
                      contractor_name: '',
                      work_item_id: ''
                    }))
                  }
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
                >
                  <option value="">-- Elegir Barco --</option>
                  {ships.map(s => {
                    const countActive = activeExecutionRows.filter(r => r.wo?.ship_id === s.id).length
                    return (
                      <option key={s.id} value={s.id}>
                        {s.name} ({countActive} trabajo{countActive === 1 ? '' : 's'} en ejecución)
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* 2. Contratista habilitado en ese barco */}
              <div>
                <label className="block text-[11px] font-bold text-purple-300 uppercase mb-1">
                  2. Contratista Habilitado en el Barco [Permiso 3ros] *
                </label>
                <select
                  required
                  disabled={!tpCascadeForm.ship_id || enabledThirdPartyContractorsForShip.length === 0}
                  value={tpCascadeForm.contractor_name}
                  onChange={(e) => {
                    const nextContractor = e.target.value
                    const matchingItems = activeExecutionRows.filter(
                      r => r.wo?.ship_id === tpCascadeForm.ship_id && (r.contractors || []).includes(nextContractor)
                    )
                    setTpCascadeForm(prev => ({
                      ...prev,
                      contractor_name: nextContractor,
                      work_item_id: matchingItems[0]?.id || ''
                    }))
                  }}
                  className="w-full bg-slate-950 border border-purple-700/60 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold disabled:opacity-50"
                >
                  {enabledThirdPartyContractorsForShip.length === 0 ? (
                    <option value="">
                      🔒 Sin contratistas [3ros] con trabajos &quot;En ejecución&quot; en este barco
                    </option>
                  ) : (
                    <>
                      <option value="">-- Elegir Contratista Habilitado ({enabledThirdPartyContractorsForShip.length}) --</option>
                      {enabledThirdPartyContractorsForShip.map(c => (
                        <option key={c} value={c}>
                          {c} [3ros Habilitado]
                        </option>
                      ))}
                    </>
                  )}
                </select>
              </div>

              {/* 3. Orden de Trabajo donde está habilitado ese contratista */}
              <div>
                <label className="block text-[11px] font-bold text-emerald-400 uppercase mb-1">
                  3. Orden de Trabajo Habilitada para este Contratista (En Ejecución) *
                </label>
                <select
                  required
                  disabled={!tpCascadeForm.contractor_name || enabledWorkItemsForShipAndContractor.length === 0}
                  value={tpCascadeForm.work_item_id}
                  onChange={(e) => setTpCascadeForm(prev => ({ ...prev, work_item_id: e.target.value }))}
                  className="w-full bg-slate-950 border border-emerald-600/60 rounded-xl px-3 py-2 text-xs text-white font-bold disabled:opacity-50"
                >
                  {enabledWorkItemsForShipAndContractor.length === 0 ? (
                    <option value="">Seleccione primero un contratista habilitado</option>
                  ) : (
                    enabledWorkItemsForShipAndContractor.map(item => (
                      <option key={item.id} value={item.id}>
                        {item.wo?.ot_number} &bull; {item.wo?.title}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Ayuda Memoria Flotante (DEC-016) + Observaciones Directas */}
              {selectedTpCascadeWorkItem && (
                <div className="p-3 rounded-xl bg-slate-950 border border-cyan-800/60 space-y-1">
                  <div className="flex items-center justify-between text-[10px] font-bold uppercase text-cyan-400">
                    <span>📋 Descripción del Trabajo / Observaciones Directas (DEC-016):</span>
                    <span>Jefe Obra: {selectedTpCascadeWorkItem.foreman_name}</span>
                  </div>
                  <p className="text-xs text-slate-200 whitespace-pre-wrap">
                    {selectedTpCascadeWorkItem.description || 'Sin descripción cargada'}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={tpCascadeForm.service_date}
                    onChange={(e) => setTpCascadeForm(prev => ({ ...prev, service_date: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Comprobante</label>
                  <select
                    value={tpCascadeForm.status}
                    onChange={(e) => setTpCascadeForm(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold"
                  >
                    <option value="PRC">PRC (Presupuesto)</option>
                    <option value="RMO">RMO (Remito M.O.)</option>
                    <option value="RPF">RPF (Pdte. Factura)</option>
                    <option value="FCR">FCR (Factura)</option>
                    <option value="SDT">SDT (Sin Doc.)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Importe AR$</label>
                  <input
                    type="number"
                    step="100"
                    value={tpCascadeForm.amount_ars}
                    onChange={(e) => setTpCascadeForm(prev => ({ ...prev, amount_ars: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-emerald-400 font-mono font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-purple-300 mb-1">
                  Observaciones Específicas (Propias de Terceros):
                </label>
                <textarea
                  rows={2}
                  value={tpCascadeForm.specific_observations}
                  onChange={(e) => setTpCascadeForm(prev => ({ ...prev, specific_observations: e.target.value }))}
                  placeholder="Condiciones del presupuesto, entregas parciales, notas específicas de Terceros..."
                  className="w-full bg-slate-950 border border-purple-700/60 rounded-xl p-2.5 text-xs text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsThirdPartyCascadeOpen(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingTpCascade || !selectedTpCascadeWorkItem}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black rounded-xl cursor-pointer"
                >
                  {savingTpCascade ? 'Guardando...' : 'Guardar en Terceros'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. MODAL EDICIÓN DE OBSERVACIONES EN TERCEROS (DIRECTAS Y ESPECÍFICAS) */}
      {/* ========================================================= */}
      {editingThirdParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-purple-700/80 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-purple-400" />
                  Registro en Terceros: {editingThirdParty.contractor_name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Vinculado desde Orden de Trabajo con doble observación (Directa de OT + Específica de Terceros).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingThirdParty(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveThirdPartyEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-cyan-400 uppercase mb-1">
                  1. Observaciones Directas (Heredadas de la Descripción en la OT)
                </label>
                <div className="p-3 rounded-xl bg-slate-950 border border-cyan-900/60 text-slate-200 whitespace-pre-wrap">
                  {editingThirdParty.direct_observations || 'Sin descripción en la OT'}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-purple-300 uppercase mb-1">
                  2. Observaciones Específicas (Propias del Módulo de Terceros)
                </label>
                <textarea
                  rows={3}
                  value={editingThirdParty.specific_observations || ''}
                  onChange={(e) => setEditingThirdParty(prev => ({ ...prev, specific_observations: e.target.value }))}
                  placeholder="Escribí acá las observaciones específicas de Terceros (acuerdos de pago, adicionales de presupuesto, etc.)..."
                  className="w-full bg-slate-950 border border-purple-600/60 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-purple-400"
                />
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Fecha</label>
                  <input
                    type="date"
                    value={editingThirdParty.service_date || (editingThirdParty.created_at ? String(editingThirdParty.created_at).split('T')[0] : '')}
                    onChange={(e) => setEditingThirdParty(prev => ({ ...prev, service_date: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Estado Comprobante</label>
                  <select
                    value={editingThirdParty.status || 'PRC'}
                    onChange={(e) => setEditingThirdParty(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white font-bold"
                  >
                    <option value="PRC">PRC (Presupuesto)</option>
                    <option value="RMO">RMO (Remito)</option>
                    <option value="RPF">RPF (Pdte. Factura)</option>
                    <option value="FCR">FCR (Factura)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Importe AR$</label>
                  <input
                    type="number"
                    step="100"
                    value={editingThirdParty.amount_ars ?? 0}
                    onChange={(e) => setEditingThirdParty(prev => ({ ...prev, amount_ars: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-emerald-400 font-mono font-bold"
                  />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingThirdParty(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingThirdParty}
                  className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl cursor-pointer"
                >
                  {savingThirdParty ? 'Guardando...' : 'Guardar en Terceros'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. FICHA 360° DE LA OT, 3 FECHAS, CIERRE DEC-011 Y AMPLIAR */}
      {/* ========================================================= */}
      {selectedWoDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 relative my-8">
            {(() => {
              const items = itemsByWoMap[selectedWoDetail.id] || []
              const computed = computeOtState(selectedWoDetail, items)
              const datesAndMetrics = otMetricsAndDatesMap[selectedWoDetail.id] || {
                totalHours: 0,
                createdDate: selectedWoDetail.created_at ? String(selectedWoDetail.created_at).split('T')[0] : null,
                startDate: null,
                endDate: null
              }
              return (
                <>
                  <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-black text-primary px-2.5 py-0.5 rounded-lg bg-primary/10 border border-primary/30">
                          {selectedWoDetail.ot_number}
                        </span>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${computed.color}`}>
                          Estado Calculado OT: {computed.label}
                        </span>
                        {computed.isEliminada && (
                          <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-700 text-[10px] font-black uppercase">
                            🗑️ Eliminada
                          </span>
                        )}
                      </div>
                      <h2 className="text-xl font-black text-white">{selectedWoDetail.title}</h2>
                      <p className="text-xs text-slate-400 mt-1">
                        Barco: <strong className="text-white">{selectedWoDetail.ships?.name}</strong> &bull; Jefe de Obra: <strong className="text-amber-300">{selectedWoDetail.foreman_name}</strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedWoDetail(null)}
                      className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Tarjetas con Horas Imputadas y las 3 Fechas de la OT */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-4 font-mono">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block">Horas Imputadas</span>
                      <strong className="text-sm text-primary font-black">{datesAndMetrics.totalHours} hs</strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block">1. Fecha Creación</span>
                      <strong className="text-sm text-white font-bold">
                        {formatShortDate(datesAndMetrics.createdDate, true)}
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-emerald-900/50">
                      <span className="text-[10px] text-emerald-400 uppercase block">
                        2. Fecha Inicio {datesAndMetrics.startSource ? `(${datesAndMetrics.startSource})` : ''}
                      </span>
                      <strong className="text-sm text-emerald-300 font-bold">
                        {formatShortDate(datesAndMetrics.startDate, true)}
                      </strong>
                    </div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-cyan-900/50">
                      <span className="text-[10px] text-cyan-400 uppercase block">
                        3. Fecha Final {datesAndMetrics.endSource ? `(${datesAndMetrics.endSource})` : ''}
                      </span>
                      <strong className="text-sm text-cyan-300 font-bold">
                        {formatShortDate(datesAndMetrics.endDate, true)}
                      </strong>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {/* Trabajos de esta OT */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold uppercase text-slate-400">
                          Trabajos dentro de esta OT ({items.length})
                        </h4>
                        <button
                          type="button"
                          onClick={() => {
                            const wo = selectedWoDetail
                            setSelectedWoDetail(null)
                            handleOpenNewWorkModal(wo)
                          }}
                          className="text-xs font-bold text-primary hover:underline cursor-pointer"
                        >
                          + Agregar Trabajo a esta OT
                        </button>
                      </div>
                      <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                        {items.map(it => {
                          const st = ESTADOS_TRABAJO.find(s => s.value === it.status) || ESTADOS_TRABAJO[0]
                          const itElim = isWorkItemEliminada(it, selectedWoDetail)
                          return (
                            <div key={it.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-start justify-between gap-3 text-xs">
                              <div className="space-y-1">
                                <p className="text-slate-200 whitespace-pre-wrap">{it.description}</p>
                                <div className="flex flex-wrap gap-2 text-[10px] text-slate-400">
                                  <span>Contratistas: <strong className="text-cyan-300 font-mono">{(it.contractors || []).join(', ') || 'Sin asignar'}</strong></span>
                                  <span>&bull;</span>
                                  <span>Jefe Obra: <strong className="text-amber-300">{it.foreman_name}</strong></span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <div className="flex flex-col items-end gap-0.5">
                                  <span className={`text-[10px] px-2 py-0.5 rounded border font-bold ${st.color}`}>
                                    {it.status}
                                  </span>
                                  {it.status === 'Desestimado' && itElim && (
                                    <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-950 text-rose-300 border border-rose-700 font-black uppercase">
                                      🗑️ Eliminada
                                    </span>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const wo = selectedWoDetail
                                    setSelectedWoDetail(null)
                                    handleOpenSeparateModal({ ...it, wo })
                                  }}
                                  className="px-2 py-0.5 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                  title="Separar este trabajo en una OT propia"
                                >
                                  <GitBranch className="w-3 h-3" />
                                  <span>Separar</span>
                                </button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Bitácora y Botón Ampliar */}
                    <div className="pt-3 border-t border-slate-800">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold uppercase text-slate-400 flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                          <span>Bitácora de Consultas y Trazabilidad de la OT</span>
                        </h4>
                        <button
                          type="button"
                          onClick={() => setIsAmpliarModalOpen(true)}
                          className="px-3 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Send className="w-3 h-3" />
                          <span>Botón &quot;Ampliar&quot;</span>
                        </button>
                      </div>
                      {selectedWoDetail.notes ? (
                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto">
                          {selectedWoDetail.notes}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-500 italic">Sin consultas registradas.</p>
                      )}
                    </div>

                    {/* Opciones de Cierre Comercial de OT (DEC-011) */}
                    <div className="pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                      <div className="text-xs text-slate-400">
                        {!computed.canClose ? (
                          <span className="text-amber-400 font-semibold">
                            🔒 Cierre bloqueado: Hay {computed.activeCount} trabajo(s) en estado &quot;En ejecución&quot;.
                          </span>
                        ) : (
                          <span className="text-emerald-400 font-semibold">
                            ✓ Sin trabajos en ejecución: La OT puede cerrarse/facturarse.
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          disabled={!computed.canClose}
                          onClick={() => handleCloseOtWithValidation(selectedWoDetail, false)}
                          className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white rounded-xl text-xs font-bold cursor-pointer"
                        >
                          Facturar y Cerrar Definitivo
                        </button>
                        <button
                          type="button"
                          disabled={!computed.canClose}
                          onClick={() => handleCloseOtWithValidation(selectedWoDetail, true)}
                          className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold cursor-pointer"
                          title="Permite seguir imputando costos de arrastre post-facturación (DEC-011)"
                        >
                          Facturar y Mantener Abierta (DEC-011)
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )
            })()}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. MODAL: CATÁLOGO DE TRABAJOS (OT.ABC) - SELECCIÓN MÚLTIPLE */}
      {/* ========================================================= */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 relative my-8">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">Catálogo de Trabajos (OT.ABC)</h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Seleccioná varias OTs a la vez (5-6 al subir el barco) y definí el estado individual de cada una, o agregá/editá plantillas.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsTemplateModalOpen(false)
                  setTemplateEdit(null)
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {templateEdit ? (
              <form onSubmit={handleSaveTemplate} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre de la OT *</label>
                  <input
                    type="text"
                    required
                    value={templateEdit.name}
                    onChange={(e) => setTemplateEdit({ ...templateEdit, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Grupo</label>
                  <select
                    value={templateEdit.category || ''}
                    onChange={(e) => setTemplateEdit({ ...templateEdit, category: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    <option value="">Sin clasificar</option>
                    {GRUPOS_CATALOGO.map(g => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción</label>
                  <textarea
                    rows={6}
                    value={templateEdit.description || ''}
                    onChange={(e) => setTemplateEdit({ ...templateEdit, description: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setTemplateEdit(null)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingTemplate}
                    className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{savingTemplate ? 'Guardando...' : 'Guardar'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <>
                {/* Barra de Selección Múltiple de OTs dentro del Catálogo OT.ABC */}
                {catalogMultiSelection.length > 0 && (
                  <div className="mb-3 p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/60 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-black text-emerald-300">
                        ☑️ {catalogMultiSelection.length} OT(s) seleccionada(s) para apertura simultánea (Estado editable por cada una):
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCatalogMultiSelection([])}
                          className="text-[11px] text-slate-400 hover:text-rose-400 underline cursor-pointer"
                        >
                          Limpiar
                        </button>
                        <button
                          type="button"
                          onClick={handleConfirmCatalogMultiSelection}
                          className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-xs font-black cursor-pointer flex items-center gap-1.5 shadow"
                        >
                          <Check className="w-3.5 h-3.5 stroke-[3]" />
                          <span>Cargar {catalogMultiSelection.length} OT(s) Seleccionada(s)</span>
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {catalogMultiSelection.map((sel, idx) => {
                        const stObj = ESTADOS_TRABAJO.find(s => s.value === sel.status) || ESTADOS_TRABAJO[0]
                        return (
                          <div
                            key={sel.template_id}
                            className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-2 text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-mono text-[10px] font-black text-primary">
                                #{idx + 1}
                              </span>
                              <span className="font-bold text-white truncate">{sel.ot_title}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-[10px] text-slate-400 font-semibold">Estado:</span>
                              <select
                                value={sel.status}
                                onChange={(e) => handleUpdateCatalogMultiStatus(sel.template_id, e.target.value)}
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border cursor-pointer ${stObj.color}`}
                              >
                                {ESTADOS_TRABAJO.map(st => (
                                  <option key={st.value} value={st.value} className="bg-slate-950 text-white">
                                    {st.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Buscar en el catálogo..."
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setTemplateEdit({ name: '', description: '', category: '' })}
                    className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Nuevo trabajo</span>
                  </button>
                </div>

                <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                  {[...GRUPOS_CATALOGO, ''].map(grupo => {
                    const q = templateSearch.toLowerCase()
                    const items = templates.filter(
                      t =>
                        (t.category || '') === grupo &&
                        (!q || t.name.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))
                    )
                    if (items.length === 0) return null
                    return (
                      <div key={grupo || 'sin'}>
                        <h4 className="text-[11px] font-black uppercase tracking-wider text-amber-400 mb-1.5">
                          {grupo || 'Sin clasificar'} ({items.length})
                        </h4>
                        <div className="space-y-1.5">
                          {items.map(tpl => {
                            const isChecked = catalogMultiSelection.some(i => i.template_id === tpl.id)
                            return (
                              <div
                                key={tpl.id}
                                className={`p-3 rounded-xl border transition-colors ${
                                  isChecked
                                    ? 'bg-emerald-950/20 border-emerald-500/50'
                                    : 'bg-slate-950 border-slate-800 hover:border-amber-500/40'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <label className="flex items-start gap-2.5 flex-1 min-w-0 cursor-pointer">
                                    <input
                                      type="checkbox"
                                      checked={isChecked}
                                      onChange={() => handleToggleCatalogMultiItem(tpl)}
                                      className="mt-0.5 w-4 h-4 rounded accent-emerald-500 shrink-0"
                                      title="Seleccionar para abrir varias OTs al mismo tiempo"
                                    />
                                    <div className="flex-1 min-w-0">
                                      <span className="font-bold text-white text-xs block">{tpl.name}</span>
                                      {tpl.description ? (
                                        <p className="text-[11px] text-slate-400 mt-1 whitespace-pre-line">
                                          {tpl.description}
                                        </p>
                                      ) : (
                                        <p className="text-[11px] text-slate-600 italic mt-0.5">Sin descripción</p>
                                      )}
                                    </div>
                                  </label>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleUseTemplate(tpl)}
                                      className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold cursor-pointer"
                                    >
                                      Usar 1
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setTemplateEdit(tpl)}
                                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                                      title="Editar"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteTemplate(tpl)}
                                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                                      title="Eliminar"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 9. MODAL: BOTÓN "AMPLIAR" (CONSULTA AL JEFE DE OBRA)       */}
      {/* ========================================================= */}
      {isAmpliarModalOpen && selectedWoDetail && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-black text-white">Ampliar / Consultar al Jefe de Obra</h3>
              </div>
              <button
                type="button"
                onClick={() => setIsAmpliarModalOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitAmpliar} className="space-y-3">
              <textarea
                rows={4}
                required
                value={ampliarText}
                onChange={(e) => setAmpliarText(e.target.value)}
                placeholder={`Escribir consulta para ${selectedWoDetail.foreman_name || 'el Jefe de Obra'}...`}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                autoFocus
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAmpliarModalOpen(false)}
                  className="px-3.5 py-1.5 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingAmpliar}
                  className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingAmpliar ? 'Enviando...' : 'Asentar Consulta'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
