import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  ClipboardList,
  Plus,
  Search,
  Ship,
  Clock,
  CheckCircle2,
  AlertCircle,
  User,
  Wrench,
  FileText,
  Check,
  X,
  Pencil,
  Trash2,
  Lock,
  Layers,
  Sparkles,
  MessageSquare,
  AlertTriangle,
  Send,
  Building2,
  HardHat,
  ShieldCheck,
  Ban,
  Eye
} from 'lucide-react'
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

// Cálculo automático del estado de la OT (Contenedor) a partir de sus trabajos hijos (work_items)
function computeOtState(wo, items = []) {
  if (!items || items.length === 0) {
    return {
      label: 'Sin trabajos cargados',
      color: 'text-slate-400 bg-slate-900 border-slate-700',
      canClose: true,
      activeCount: 0,
      totalCount: 0
    }
  }

  const validItems = items.filter(i => i.status !== 'Desestimado')
  if (validItems.length === 0) {
    return {
      label: 'Desestimada',
      color: 'text-rose-300 bg-rose-950/80 border-rose-700',
      canClose: true,
      activeCount: 0,
      totalCount: items.length
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
      totalCount: items.length
    }
  }

  if (billedCount === validItems.length) {
    return {
      label: wo?.allow_post_billing_costs ? 'Facturada (Abierta Arrastre)' : 'Facturada - CERRADA',
      color: 'text-purple-300 bg-purple-950/80 border-purple-500/80',
      canClose: true,
      activeCount: 0,
      totalCount: items.length
    }
  }

  if (pendingStartCount === validItems.length) {
    return {
      label: 'Pendiente de inicio',
      color: 'text-amber-300 bg-amber-950/80 border-amber-600/80',
      canClose: false,
      activeCount: 0,
      totalCount: items.length
    }
  }

  return {
    label: 'Trabajos Finalizados (Lista p/ Cierre)',
    color: 'text-cyan-300 bg-cyan-950/80 border-cyan-500/80',
    canClose: true,
    activeCount: 0,
    totalCount: items.length
  }
}

// Evaluación de Alertas automáticas por trabajo (Columnas N, O, P, Q de GS-003)
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
  if (
    (item.status === 'Remito realizado/Pdte firma' || item.status === 'Facturado') &&
    !item.voucher_number?.trim()
  ) {
    alerts.push({ code: 'S/# COMPR.', label: 'Falta Nº de comprobante', color: 'bg-purple-950 text-purple-300 border-purple-700' })
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
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState(null)

  // Pestaña activa principal
  const [activeMainTab, setActiveMainTab] = useState('unificado') // 'unificado' | 'ots' | 'terceros' | 'alertas'

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

  // Formulario en cascada (Barco -> OT Existente o Nueva [Tabulada/Libre] -> Trabajo)
  const [workForm, setWorkForm] = useState({
    ship_id: '',
    ot_mode: 'new', // 'existing' | 'new'
    existing_wo_id: '',
    ot_creation_type: 'tabulada', // 'tabulada' | 'libre'
    selected_template_id: '',
    ot_number: 'OT-1',
    ot_title: '',
    description: '',
    status: 'En ejecución',
    foreman_name: '',
    work_type: 'HORA',
    assignment_type: 'Presupuesto General',
    specific_budget_id: '',
    contractors: [],
    comments: '',
    voucher_type: '',
    voucher_number: '',
    send_to_third_party_prc: false,
    specific_observations: ''
  })

  // Selector de contratista dentro del formulario
  const [contractorSelectInput, setContractorSelectInput] = useState('')

  // Modal de Catálogo de Trabajos (OT.ABC)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [templatePickerFromForm, setTemplatePickerFromForm] = useState(false)
  const [templateEdit, setTemplateEdit] = useState(null)
  const [templateSearch, setTemplateSearch] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)

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
      const [shipsRes, wosRes, itemsRes, workersRes, tplRes, tpRes, logsRes] = await Promise.all([
        supabase.from('ships').select('*').order('name'),
        supabase.from('work_orders').select('*, ships(name, client_name)').order('created_at', { ascending: false }),
        supabase.from('work_items').select('*').order('created_at', { ascending: true }),
        supabase.from('workers').select('*').order('name'),
        supabase.from('ot_templates').select('*').order('sort_order').order('name'),
        supabase.from('third_party_services').select('*').order('created_at', { ascending: false }),
        supabase.from('labor_logs').select('id, work_order_id, hours_worked, hours_normal, hours_extra_50, hours_extra_100, worker_name, date_logged')
      ])

      if (shipsRes.data) setShips(shipsRes.data)
      if (wosRes.data) setWorkOrders(wosRes.data)
      if (itemsRes.data) setWorkItems(itemsRes.data)
      if (workersRes.data) setWorkers(workersRes.data)
      if (tplRes.data) setTemplates(tplRes.data)
      if (tpRes.data) setThirdPartyServices(tpRes.data)
      if (logsRes.data) setLaborLogs(logsRes.data)
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
      // Verificar si algún operario de ese rubro en Astillero tiene 3ros activo (por defecto false)
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

  // Calcular el siguiente número consecutivo de OT para un barco específico
  const getNextOtNumberForShip = (shipId) => {
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
    return `OT-${maxNum + 1}`
  }

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

  // Mapa de Horas trabajadas por OT
  const otMetricsMap = useMemo(() => {
    const map = {}
    laborLogs.forEach(log => {
      const woId = log.work_order_id
      if (!woId) return
      if (!map[woId]) {
        map[woId] = { totalHours: 0, normalHours: 0, extra50: 0, extra100: 0, workerSet: new Set() }
      }
      map[woId].totalHours += parseFloat(log.hours_worked) || 0
      map[woId].normalHours += parseFloat(log.hours_normal) || 0
      map[woId].extra50 += parseFloat(log.hours_extra_50) || 0
      map[woId].extra100 += parseFloat(log.hours_extra_100) || 0
      if (log.worker_name) map[woId].workerSet.add(log.worker_name)
    })
    return map
  }, [laborLogs])

  // Filas unificadas (Cada fila = 1 Trabajo con su OT y Barco, igual a hoja UNIFICADO de GS-003)
  const unifiedRows = useMemo(() => {
    const rows = []
    workOrders.forEach(wo => {
      const items = itemsByWoMap[wo.id] || []
      const computedOt = computeOtState(wo, items)
      if (items.length === 0) {
        rows.push({
          isPlaceholder: true,
          id: `placeholder-${wo.id}`,
          work_order_id: wo.id,
          wo,
          computedOt,
          description: wo.description || '',
          status: 'Pendiente de inicio',
          foreman_name: wo.foreman_name || foremenList[0] || 'ALE CAMADELLI',
          work_type: wo.work_type || 'HORA',
          assignment_type: wo.assignment_type || 'Presupuesto General',
          specific_budget_id: wo.budget_code || '',
          contractors: wo.contractor_name ? [wo.contractor_name] : [],
          comments: '',
          voucher_type: '',
          voucher_number: '',
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
            thirdPartyRecord: thirdPartyByItemMap[item.id] || null
          })
        })
      }
    })
    return rows
  }, [workOrders, itemsByWoMap, thirdPartyByItemMap, foremenList])

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

  // Métricas operativas globales
  const stats = useMemo(() => {
    const enEjecucion = unifiedRows.filter(r => r.status === 'En ejecución').length
    const pendientes = unifiedRows.filter(r => r.status === 'Pendiente de inicio').length
    const pdteRemito = unifiedRows.filter(r => r.status === 'Pendiente remito' || r.status === 'Remito realizado/Pdte firma' || r.status === 'Finalizado').length
    const facturados = unifiedRows.filter(r => r.status === 'Facturado').length
    const barcosActivos = new Set(unifiedRows.filter(r => r.status === 'En ejecución').map(r => r.wo?.ship_id)).size
    const prcTercerosCount = thirdPartyServices.length
    return { enEjecucion, pendientes, pdteRemito, facturados, barcosActivos, prcTercerosCount }
  }, [unifiedRows, thirdPartyServices])

  // Abrir Modal para Crear Nuevo Trabajo / OT
  const handleOpenNewWorkModal = (preselectedWo = null) => {
    setEditingWorkItem(null)
    const defaultShipId = preselectedWo
      ? preselectedWo.ship_id
      : (selectedShipFilter !== 'todos' ? selectedShipFilter : (ships[0]?.id || ''))
    const shipWos = workOrders.filter(w => w.ship_id === defaultShipId)
    const defaultForeman = preselectedWo?.foreman_name || foremenList[0] || 'ALE CAMADELLI'

    setContractorSelectInput('')
    setWorkForm({
      ship_id: defaultShipId,
      ot_mode: preselectedWo ? 'existing' : (shipWos.length > 0 ? 'existing' : 'new'),
      existing_wo_id: preselectedWo ? preselectedWo.id : (shipWos[0]?.id || ''),
      ot_creation_type: 'tabulada',
      selected_template_id: '',
      ot_number: getNextOtNumberForShip(defaultShipId),
      ot_title: '',
      description: '',
      status: 'En ejecución',
      foreman_name: defaultForeman,
      work_type: 'HORA',
      assignment_type: 'Presupuesto General',
      specific_budget_id: '',
      contractors: [],
      comments: '',
      voucher_type: '',
      voucher_number: '',
      send_to_third_party_prc: false,
      specific_observations: ''
    })
    setIsWorkModalOpen(true)
  }

  // Abrir Modal para Editar un Trabajo existente
  const handleOpenEditWorkModal = (row) => {
    setEditingWorkItem(row.isPlaceholder ? null : row)
    const tp = row.thirdPartyRecord
    setContractorSelectInput('')
    setWorkForm({
      ship_id: row.wo?.ship_id || '',
      ot_mode: 'existing',
      existing_wo_id: row.work_order_id,
      ot_creation_type: row.wo?.is_tabulated ? 'tabulada' : 'libre',
      selected_template_id: '',
      ot_number: row.wo?.ot_number || 'OT-1',
      ot_title: row.wo?.title || '',
      description: row.description || '',
      status: row.status || 'En ejecución',
      foreman_name: row.foreman_name || foremenList[0] || 'ALE CAMADELLI',
      work_type: row.work_type || 'HORA',
      assignment_type: row.assignment_type || 'Presupuesto General',
      specific_budget_id: row.specific_budget_id || '',
      contractors: Array.isArray(row.contractors) ? [...row.contractors] : [],
      comments: row.comments || '',
      voucher_type: row.voucher_type || '',
      voucher_number: row.voucher_number || '',
      send_to_third_party_prc: Boolean(row.send_to_third_party_prc || tp),
      specific_observations: tp?.specific_observations || ''
    })
    setIsWorkModalOpen(true)
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

  // Seleccionar plantilla tabulada del Catálogo (OT.ABC)
  const handleSelectTabulatedTemplate = (tplId) => {
    const tpl = templates.find(t => t.id === tplId)
    if (!tpl) {
      setWorkForm(prev => ({ ...prev, selected_template_id: '' }))
      return
    }
    setWorkForm(prev => ({
      ...prev,
      selected_template_id: tpl.id,
      ot_title: tpl.name,
      description: tpl.description || prev.description
    }))
  }

  // Agregar contratista a la lista del trabajo
  const handleAddContractorToForm = (contractorName) => {
    if (!contractorName) return
    setWorkForm(prev => {
      if (prev.contractors.includes(contractorName)) return prev
      const nextContractors = [...prev.contractors, contractorName]
      // Si pasa a tener más de 1 contratista o no tiene permiso 3ros, desactivar send_to_third_party_prc
      const canStillSend3ros = nextContractors.length === 1 && hasThirdPartyPermission(nextContractors[0])
      return {
        ...prev,
        contractors: nextContractors,
        send_to_third_party_prc: canStillSend3ros ? prev.send_to_third_party_prc : false
      }
    })
    setContractorSelectInput('')
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

  // Guardar Trabajo (y crear OT si ot_mode === 'new', y sincronizar PRC $0 en Terceros si aplica)
  const handleSaveWorkSubmit = async (e) => {
    e.preventDefault()

    if (!workForm.ship_id) {
      alert('Seleccioná un Barco.')
      return
    }

    if (workForm.ot_mode === 'new' && !workForm.ot_title.trim()) {
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
      let targetWoId = workForm.existing_wo_id
      let targetShipId = workForm.ship_id

      // 1. Si es Nueva OT, crear primero el contenedor en work_orders
      if (workForm.ot_mode === 'new') {
        const woPayload = {
          ship_id: workForm.ship_id,
          ot_number: workForm.ot_number.trim() || getNextOtNumberForShip(workForm.ship_id),
          title: workForm.ot_title.trim(),
          description: workForm.description.trim() || null,
          status: workForm.status === 'En ejecución' ? 'En Progreso' : 'Pendiente',
          work_type: workForm.work_type,
          assignment_type: workForm.assignment_type,
          budget_code: workForm.specific_budget_id.trim() || null,
          foreman_name: workForm.foreman_name,
          contractor_name: workForm.contractors.join(', ') || null,
          is_tabulated: workForm.ot_creation_type === 'tabulada',
          start_date: new Date().toISOString().split('T')[0]
        }

        const { data: newWoData, error: woErr } = await supabase
          .from('work_orders')
          .insert([woPayload])
          .select()

        if (woErr) throw woErr
        targetWoId = newWoData[0].id
      } else if (editingWorkItem && workForm.ot_title.trim()) {
        // Actualizar datos de cabecera de la OT si se editó el título
        await supabase
          .from('work_orders')
          .update({
            title: workForm.ot_title.trim(),
            foreman_name: workForm.foreman_name
          })
          .eq('id', targetWoId)
      }

      // Validar elegibilidad real de Terceros (1 contratista + permiso 3ros)
      const validFor3ros =
        workForm.contractors.length === 1 &&
        hasThirdPartyPermission(workForm.contractors[0]) &&
        Boolean(workForm.send_to_third_party_prc)

      // 2. Insertar o actualizar el Trabajo en work_items
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
        comments: workForm.comments.trim() || null,
        voucher_type: workForm.voucher_type || null,
        voucher_number: workForm.voucher_number.trim() || null,
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
          const tpPayload = {
            work_item_id: savedWorkItem.id,
            work_order_id: targetWoId,
            ship_id: targetShipId,
            contractor_name: singleContractor,
            status: 'PRC',
            voucher_type: 'PRC',
            amount_ars: 0,
            direct_observations: workForm.description.trim() || 'Sin descripción cargada en la OT',
            specific_observations: workForm.specific_observations.trim() || null,
            updated_at: new Date().toISOString()
          }

          const { error: tpErr } = await supabase
            .from('third_party_services')
            .upsert(tpPayload, { onConflict: 'work_item_id' })

          if (tpErr) throw tpErr
        } else if (editingWorkItem && thirdPartyByItemMap[editingWorkItem.id]) {
          // Si se desmarcó o dejó de cumplir condición de 1 contratista + 3ros, eliminar el PRC $0 vinculado
          await supabase
            .from('third_party_services')
            .delete()
            .eq('work_item_id', editingWorkItem.id)
        }
      }

      setIsWorkModalOpen(false)
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

  // Eliminar un Trabajo individual
  const handleDeleteWorkItem = async (row) => {
    if (!window.confirm('¿Eliminar este trabajo de la Orden de Trabajo?')) return
    try {
      const { error } = await supabase.from('work_items').delete().eq('id', row.id)
      if (error) throw error
      await loadData()
      setStatusMessage({ type: 'info', text: 'Trabajo eliminado.' })
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al eliminar trabajo: ${err.message}` })
    }
  }

  // Eliminar Orden de Trabajo completa
  const handleDeleteWo = async (wo) => {
    if (!window.confirm(`¿Eliminar la Orden de Trabajo "${wo.ot_number} - ${wo.title}" y todos sus trabajos asociados?`)) return
    try {
      const { error } = await supabase.from('work_orders').delete().eq('id', wo.id)
      if (error) throw error
      if (selectedWoDetail?.id === wo.id) setSelectedWoDetail(null)
      await loadData()
      setStatusMessage({ type: 'info', text: `Se eliminó la OT ${wo.ot_number}.` })
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al eliminar OT: ${err.message}` })
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
      // Marcar trabajos no desestimados como Facturado
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

  // Gestión del Catálogo de Trabajos (OT.ABC)
  const handleOpenCatalog = (fromForm = false) => {
    setTemplatePickerFromForm(fromForm)
    setTemplateEdit(null)
    setTemplateSearch('')
    setIsTemplateModalOpen(true)
  }

  const handleUseTemplate = (tpl) => {
    if (templatePickerFromForm && isWorkModalOpen) {
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
      setWorkForm({
        ship_id: defaultShipId,
        ot_mode: 'new',
        existing_wo_id: '',
        ot_creation_type: 'tabulada',
        selected_template_id: tpl.id,
        ot_number: getNextOtNumberForShip(defaultShipId),
        ot_title: tpl.name,
        description: tpl.description || '',
        status: 'En ejecución',
        foreman_name: foremenList[0] || 'ALE CAMADELLI',
        work_type: 'HORA',
        assignment_type: 'Presupuesto General',
        specific_budget_id: '',
        contractors: [],
        comments: '',
        voucher_type: '',
        voucher_number: '',
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
            <span className="text-xs text-slate-400 font-mono">Estado en Trabajo / OT Calculada</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2.5">
            <ClipboardList className="w-7 h-7 text-primary" />
            Órdenes de Trabajo y Trabajos en Progreso
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-3xl">
            Cada OT agrupa los trabajos de un barco. El estado operativo se gestiona por trabajo individual, calculando automáticamente el estado de la OT y habilitando la autocarga de PRC $0 en Terceros cuando hay un único contratista con permiso <strong>3ros</strong>.
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
      {/* 2. MÉTRICAS OPERATIVAS SUPERIORES                         */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
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

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-purple-900/50 flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-300 text-[11px] font-semibold">
            <span>PRC $0 en Terceros</span>
            <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 border border-purple-700 font-black">3ros</span>
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-300 font-mono">{stats.prcTercerosCount}</span>
            <span className="text-[10px] text-slate-500">vinculados</span>
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
                  {s.name} {s.name === 'ASTILLERO' ? '(Interno)' : ''}
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
        <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900/90 shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-3">Barco</th>
                <th className="py-3 px-3">Orden de Trabajo (Estado Calculado)</th>
                <th className="py-3 px-3 min-w-[260px]">Descripción del Trabajo</th>
                <th className="py-3 px-3">Contratista(s) / Permiso 3ros</th>
                <th className="py-3 px-3">Jefe de Obra</th>
                <th className="py-3 px-2.5">Tipo / Asignación</th>
                <th className="py-3 px-3 text-center">Estado del Trabajo</th>
                <th className="py-3 px-2.5 text-center">Alertas / 3ros</th>
                <th className="py-3 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    No hay trabajos registrados para los filtros seleccionados. Hacé clic en <strong>&quot;+ Cargar Trabajo / Nueva OT&quot;</strong> para comenzar.
                  </td>
                </tr>
              ) : (
                filteredRows.map(row => {
                  const stConfig = ESTADOS_TRABAJO.find(s => s.value === row.status) || ESTADOS_TRABAJO[0]
                  const alerts = evaluateWorkItemAlerts(row, row.wo)
                  const contractors = row.contractors || []
                  const tp = row.thirdPartyRecord

                  return (
                    <tr key={row.id} className="hover:bg-slate-800/30 transition-colors align-top">
                      {/* 1. Barco */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          <Ship className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>{row.wo?.ships?.name || 'Sin barco'}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 block mt-0.5">
                          {row.wo?.ships?.client_name || 'Alon Car'}
                        </span>
                      </td>

                      {/* 2. Orden de Trabajo + Estado Calculado */}
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[11px] font-black text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/30">
                            {row.wo?.ot_number || 'OT-1'}
                          </span>
                          <span className="font-extrabold text-white">{row.wo?.title}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-1.5 flex-wrap">
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
                        </div>
                      </td>

                      {/* 3. Descripción del Trabajo */}
                      <td className="py-3 px-3 max-w-md">
                        {row.description ? (
                          <div className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed line-clamp-3 hover:line-clamp-none">
                            {row.description}
                          </div>
                        ) : (
                          <span className="text-amber-400/80 italic text-xs">Sin descripción cargada</span>
                        )}
                        {row.comments && (
                          <div className="mt-1 text-[10px] text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                            💬 <strong>Nota:</strong> {row.comments}
                          </div>
                        )}
                      </td>

                      {/* 4. Contratistas */}
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

                      {/* 5. Jefe de Obra */}
                      <td className="py-3 px-3">
                        <span className="font-bold text-amber-300 flex items-center gap-1 text-xs">
                          <User className="w-3 h-3 shrink-0" />
                          <span>{row.foreman_name || 'Sin asignar'}</span>
                        </span>
                      </td>

                      {/* 6. Tipo y Asignación */}
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

                      {/* 7. Estado del Trabajo (Editable inline) */}
                      <td className="py-3 px-3 text-center">
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
                      </td>

                      {/* 8. Alertas y Vinculación PRC Terceros */}
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

                      {/* 9. Acciones */}
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
                              title="Eliminar este trabajo"
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
        /* 4B. VISTA DE CONTENEDORES OT POR BARCO                    */
        /* ========================================================= */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {workOrders
            .filter(w => selectedShipFilter === 'todos' || w.ship_id === selectedShipFilter)
            .map(wo => {
              const items = itemsByWoMap[wo.id] || []
              const computed = computeOtState(wo, items)
              const metrics = otMetricsMap[wo.id] || { totalHours: 0, workerSet: new Set() }

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
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${computed.color}`}>
                        {computed.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1">
                      <Ship className="w-3.5 h-3.5 text-cyan-400" />
                      <span className="text-white font-bold">{wo.ships?.name}</span>
                      <span className="text-slate-500 text-[11px]">&bull; {wo.ships?.client_name || 'Alon Car'}</span>
                    </div>

                    <h3 className="text-base font-black text-white">{wo.title}</h3>

                    {/* Lista resumida de trabajos hijos dentro de esta OT */}
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
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleOpenEditWorkModal({ ...item, wo, thirdPartyRecord: thirdPartyByItemMap[item.id] })}
                            className="p-2 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 cursor-pointer flex items-start justify-between gap-2 text-xs"
                          >
                            <div className="truncate flex-1">
                              <span className="text-slate-200 block truncate">
                                {item.description || 'Sin descripción'}
                              </span>
                              {(item.contractors || []).length > 0 && (
                                <span className="text-[10px] font-mono text-cyan-400">
                                  {item.contractors.join(', ')}
                                </span>
                              )}
                            </div>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded border shrink-0 font-bold ${st.color}`}>
                              {item.status}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Pie de tarjeta OT */}
                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                    <div className="font-mono">
                      <span className="text-[10px] text-slate-500 block">Horas Imputadas</span>
                      <strong className="text-primary font-extrabold">{metrics.totalHours} hs</strong>
                    </div>

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
                        title="Eliminar OT"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      ) : (
        /* ========================================================= */
        /* 4C. VISTA DE TERCEROS VINCULADOS (DOBLE OBSERVACIÓN)      */
        /* ========================================================= */
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-black text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-purple-400" />
                Registros en Terceros Generados desde Órdenes de Trabajo (Estado PRC)
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cada registro recibe las <strong>Observaciones Directas</strong> desde la Descripción del trabajo en la OT y admite <strong>Observaciones Específicas</strong> propias del módulo de Terceros.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-3 px-3">Barco & OT</th>
                  <th className="py-3 px-3">Proveedor / Contratista [3ros]</th>
                  <th className="py-3 px-3 text-center">Estado / Comprobante</th>
                  <th className="py-3 px-3 text-right">Importe AR$</th>
                  <th className="py-3 px-3 min-w-[240px] text-cyan-300">Observaciones Directas (Desde OT)</th>
                  <th className="py-3 px-3 min-w-[240px] text-purple-300">Observaciones Específicas (Módulo Terceros)</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {thirdPartyServices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-500">
                      Aún no hay registros PRC generados en Terceros. Al crear un trabajo con un único contratista que tenga el permiso <strong>3ros</strong> activo, podrás activar la carga automática a Terceros.
                    </td>
                  </tr>
                ) : (
                  thirdPartyServices.map(tp => {
                    const wo = workOrders.find(w => w.id === tp.work_order_id)
                    return (
                      <tr key={tp.id} className="hover:bg-slate-800/30 transition-colors align-top">
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
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  {editingWorkItem ? 'Editar Trabajo en Orden de Trabajo' : 'Cargar Trabajo / Nueva Orden de Trabajo'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Flujo de carga según planilla GS-003: 1º Barco &rarr; 2º OT (Tabulada o Libre) &rarr; 3º Estado del Trabajo, Contratista(s), Jefe de Obra y validación de PRC $0 a Terceros.
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
                  {/* 1. Selección de Barco */}
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
                          {s.name} {s.name === 'ASTILLERO' ? '(Uso Interno Astillero)' : ''} &bull; {s.client_name || 'Cliente'}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Modo de OT: Existente vs Nueva OT */}
                  <div>
                    <label className="block text-xs font-bold text-cyan-400 uppercase mb-1">
                      2. Orden de Trabajo (Contenedor) *
                    </label>
                    {editingWorkItem ? (
                      <div className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-primary">
                        {workForm.ot_number} &bull; {workForm.ot_title}
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

                {/* Si elige Crear Nueva OT: Tabulada (OT.ABC) vs Libre */}
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
                            onClick={() => setWorkForm(prev => ({ ...prev, ot_creation_type: 'libre', selected_template_id: '' }))}
                            className={`px-3 py-1 rounded-lg text-xs font-bold border cursor-pointer ${
                              workForm.ot_creation_type === 'libre'
                                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500'
                                : 'bg-slate-900 text-slate-400 border-slate-800'
                            }`}
                          >
                            ✍️ OT Libre (Escribir nombre)
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleOpenCatalog(true)}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-bold underline flex items-center gap-1 cursor-pointer"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>Explorar / Editar Catálogo OT.ABC</span>
                        </button>
                      </div>
                    )}

                    {/* Selector directo de plantilla si es OT Tabulada */}
                    {!editingWorkItem && workForm.ot_creation_type === 'tabulada' && (
                      <div>
                        <label className="block text-[11px] font-semibold text-amber-300 mb-1">
                          Seleccionar Trabajo Tabulado del Catálogo (OT.ABC):
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

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                          Nº OT (Consecutivo Barco)
                        </label>
                        <input
                          type="text"
                          value={workForm.ot_number}
                          onChange={(e) => setWorkForm(prev => ({ ...prev, ot_number: e.target.value }))}
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-primary font-mono font-bold"
                        />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Nombre de la Orden de Trabajo (OT) *
                        </label>
                        <input
                          type="text"
                          required={workForm.ot_mode === 'new'}
                          value={workForm.ot_title}
                          onChange={(e) => setWorkForm(prev => ({ ...prev, ot_title: e.target.value }))}
                          placeholder="Ej: CARENADO DE CASCO o CAMBIO MOTOR"
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-primary"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* PASO 3: DATOS DEL TRABAJO INDIVIDUAL (WORK ITEM) */}
              <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3.5">
                <h4 className="text-xs font-black uppercase tracking-wider text-primary">
                  3. Detalle Operativo del Trabajo
                </h4>

                {/* Descripción del Trabajo */}
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

                {/* Estado del Trabajo, Jefe de Obra y Tipo de Trabajo */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Estado del Trabajo *
                    </label>
                    <select
                      value={workForm.status}
                      onChange={(e) => setWorkForm(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-primary"
                    >
                      {ESTADOS_TRABAJO.map(st => (
                        <option key={st.value} value={st.value}>{st.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-amber-300 mb-1">
                      Jefe de Obra (Desde Padrón) *
                    </label>
                    <select
                      value={workForm.foreman_name}
                      onChange={(e) => setWorkForm(prev => ({ ...prev, foreman_name: e.target.value }))}
                      className="w-full bg-slate-900 border border-amber-500/40 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400"
                    >
                      {foremenList.map(f => (
                        <option key={f} value={f}>{f}</option>
                      ))}
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

                {/* Tipo de Asignación y Nº Presupuesto Específico */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Tipo de Asignación (Centro de Costos)
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

                {/* Selección de Contratista(s) / Taller(es) desde el Padrón */}
                <div className="space-y-2 pt-2 border-t border-slate-800/80">
                  <label className="block text-xs font-bold text-slate-200">
                    Contratista(s) / Grupo(s) de Trabajo Asignados (Desde Padrón de Personal y Talleres)
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={contractorSelectInput}
                      onChange={(e) => {
                        if (e.target.value) handleAddContractorToForm(e.target.value)
                      }}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-primary"
                    >
                      <option value="">+ Seleccionar contratista, taller o rubro para agregar al trabajo...</option>
                      <optgroup label="Sectores Propios (Astillero)">
                        {contractorCatalog
                          .filter(c => c.admin_center === 'ASTILLERO')
                          .map(c => (
                            <option key={c.name} value={c.name}>
                              {c.name} {c.can_charge_third_party ? '[Permiso 3ros ACTIVO]' : '[Sin Permiso 3ros]'}
                            </option>
                          ))}
                      </optgroup>
                      <optgroup label="Contratistas y Talleres Externos">
                        {contractorCatalog
                          .filter(c => c.admin_center !== 'ASTILLERO')
                          .map(c => (
                            <option key={c.name} value={c.name}>
                              {c.name} ({c.admin_center}) {c.can_charge_third_party ? '• [Permiso 3ros ACTIVO]' : '• [Sin Permiso 3ros]'}
                            </option>
                          ))}
                      </optgroup>
                    </select>
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

                {/* Comentario Auxiliar y Comprobante */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Comentario Auxiliar (Columna F)
                    </label>
                    <input
                      type="text"
                      value={workForm.comments}
                      onChange={(e) => setWorkForm(prev => ({ ...prev, comments: e.target.value }))}
                      placeholder="Materiales esperados, notas operativas..."
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Nº Comprobante / Remito
                    </label>
                    <input
                      type="text"
                      value={workForm.voucher_number}
                      onChange={(e) => setWorkForm(prev => ({ ...prev, voucher_number: e.target.value }))}
                      placeholder="Ej: REM-0042"
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-primary"
                    />
                  </div>
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
                  <span>{savingWork ? 'Guardando...' : 'Guardar Trabajo'}</span>
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Estado Comprobante</label>
                  <select
                    value={editingThirdParty.status || 'PRC'}
                    onChange={(e) => setEditingThirdParty(prev => ({ ...prev, status: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
                  >
                    <option value="PRC">PRC (Presupuesto)</option>
                    <option value="RMO">RMO (Remito)</option>
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
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-emerald-400 font-mono font-bold"
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
      {/* 7. FICHA 360° DE LA OT, CIERRE DEC-011 Y BOTÓN AMPLIAR     */}
      {/* ========================================================= */}
      {selectedWoDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 relative my-8">
            {(() => {
              const items = itemsByWoMap[selectedWoDetail.id] || []
              const computed = computeOtState(selectedWoDetail, items)
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
                              <span className={`text-[10px] px-2 py-0.5 rounded border font-bold shrink-0 ${st.color}`}>
                                {it.status}
                              </span>
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
                          <span>Bitácora de Consultas al Jefe de Obra</span>
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
      {/* 8. MODAL: CATÁLOGO DE TRABAJOS (OT.ABC) - EDITABLE         */}
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
                    Guía de texto tabulada: Nombre de la OT y Descripción estándar agrupada en Renovación e Intermediaria.
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

                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
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
                          {items.map(tpl => (
                            <div
                              key={tpl.id}
                              className="p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/40 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
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
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handleUseTemplate(tpl)}
                                    className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg text-[11px] font-bold cursor-pointer"
                                  >
                                    Usar
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
                          ))}
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
