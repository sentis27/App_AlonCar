import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { 
  ClipboardList, 
  Plus, 
  Search, 
  Filter, 
  Ship, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Calendar, 
  User, 
  Wrench, 
  FileText, 
  Check, 
  X, 
  ChevronRight, 
  Pencil, 
  Trash2, 
  Lock, 
  Unlock, 
  Layers, 
  Briefcase, 
  Copy, 
  Eye, 
  RotateCcw,
  Sparkles,
  MessageSquare,
  DollarSign,
  AlertTriangle,
  Send
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// =========================================================================
// PLANTILLAS ESTÁNDAR TABULADAS DE VARADERO (OT.ABC - GS-003 / DEC-016)
// =========================================================================
const PLANTILLAS_OT_ABC = [
  {
    id: 'tpl-varadero',
    title: 'Varadero: Puesta en Seco y Maniobra',
    trade: 'Maniobras y varada',
    work_type: 'HORA',
    description: 'Maniobra de izado y puesta en seco en varadero sobre calzos y cunas normalizadas. Limpieza inicial de fondos con agua dulce a alta presión. Estadía, apuntalamiento, botada y prueba de estanqueidad post-trabajos.'
  },
  {
    id: 'tpl-valvulas',
    title: 'Válvulas de Fondo y Tomas de Mar',
    trade: 'Mecánica',
    work_type: 'HORA',
    description: 'Desmontaje de válvulas de casco, aspiración y descarga de fondo y tomas de mar. Limpieza química, rectificado de asientos y cono/obturador, prueba hidráulica a 1.5 veces la presión de trabajo con emisión de protocolo técnico.'
  },
  {
    id: 'tpl-caldereria',
    title: 'Calderería de Obra Viva y Fondos',
    trade: 'Calderería',
    work_type: 'HORA',
    description: 'Corte por oxicorte/plasma de tramos de chapa naval de fondo y piques de proa/popa según plano e informe de espesores PNA. Ajuste, biselado y soldadura de planchas grado naval bajo procedimiento homologado.'
  },
  {
    id: 'tpl-carenado',
    title: 'Carenado, Hidrolavado y Pintura',
    trade: 'Pintura',
    work_type: 'HORA',
    description: 'Lavado a ultra alta presión para desincrustar fouling y algas. Arenado comercial Sa 2.5 en sectores oxidados. Aplicación de esquema de pintura especificado: dos manos de anticorrosivo epoxídico y dos manos de antiincrustante autolimpiante.'
  },
  {
    id: 'tpl-linea-eje',
    title: 'Línea de Eje y Aparato de Gobierno (Timón)',
    trade: 'Mecánica',
    work_type: 'HORA',
    description: 'Desmonte de hélice y pala de timón. Extracción de eje portahélice hacia interior/exterior, verificación de alineación radial y axial en torno. Renovación de bujes de guayacán/tufnol y sellos de bocina.'
  },
  {
    id: 'tpl-galvanica',
    title: 'Protección Galvánica (Ánodos de Sacrificio)',
    trade: 'Soldadura',
    work_type: 'HORA',
    description: 'Cálculo de masa catódica requerida por superficie de carena. Desbaste de soportes preexistentes y soldadura de ánodos de sacrificio de aleación de zinc/aluminio naval de alta pureza en casco, timón y toberas.'
  },
  {
    id: 'tpl-sondajes',
    title: 'Sondajes Ultrasónicos de Casco',
    trade: 'Control',
    work_type: 'CONTROL',
    description: 'Trazado de retícula y medición ultrasónica de espesores de chapa en tramos de obra viva, obra muerta y mamparos estancos. Elaboración de croquis y planilla de cálculo de desgaste para Prefectura Naval Argentina (PNA).'
  },
  {
    id: 'tpl-tanques',
    title: 'Sentinas, Pocetes y Tanques de Doble Fondo',
    trade: 'Raschinear',
    work_type: 'HORA',
    description: 'Apertura de tapas de inspección de doble fondos y pocetes de achique. Desgasificación, extracción de lodos de sentina con camión atmosférico, desengrase químico, lavado caliente y pintado con bituminoso.'
  },
  {
    id: 'tpl-mantenimiento-predio',
    title: 'Mantenimiento de Predio e Infraestructura',
    trade: 'Calderería',
    work_type: 'HORA',
    description: 'Labores internas de mantenimiento edilicio, reparación de guinches de varadero, tendido de cables de potencia, reparación de vías de calzo y ordenamiento general de talleres y muelles.'
  }
]

// Jefes de obra frecuentes (Reglas Alon Car)
const JEFES_DE_OBRA = [
  'ALE C',
  'PABLO NOVARA',
  'HUGO',
  'MARTIN O',
  'ANDRÉS (Admin)'
]

// Tipos de trabajo
const TIPOS_DE_TRABAJO = [
  { value: 'HORA', label: 'Por Hora (Mano de Obra Directa)' },
  { value: 'PRESUPUESTO', label: 'Por Presupuesto (PRC / Ajuste Alzado)' },
  { value: 'CONTROL', label: 'De Control / Inspección Técnica' }
]

// Estados posibles de la OT
const ESTADOS_OT = [
  { value: 'En Progreso', label: 'En Progreso (Habilitada para Costos)', color: 'text-emerald-400 bg-emerald-950/80 border-emerald-600', dot: 'bg-emerald-400' },
  { value: 'Pendiente', label: 'Pendiente de Inicio', color: 'text-amber-400 bg-amber-950/80 border-amber-600', dot: 'bg-amber-400' },
  { value: 'Pausada', label: 'Pausada / Stand-by', color: 'text-slate-300 bg-slate-900 border-slate-700', dot: 'bg-slate-400' },
  { value: 'Completada', label: 'Finalizada (Pdte. Remito / Cierre)', color: 'text-cyan-300 bg-cyan-950/80 border-cyan-600', dot: 'bg-cyan-400' },
  { value: 'Facturada', label: 'Facturada - CERRADO', color: 'text-purple-300 bg-purple-950/80 border-purple-600', dot: 'bg-purple-400' },
  { value: 'Desestimada', label: 'Desestimada / Cancelada', color: 'text-rose-400 bg-rose-950/80 border-rose-800', dot: 'bg-rose-400' }
]

export default function WorkOrders() {
  const { user } = useAuth()

  // Estados principales
  const [workOrders, setWorkOrders] = useState([])
  const [ships, setShips] = useState([])
  const [laborLogs, setLaborLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState(null)

  // Filtros de navegación
  const [viewFilter, setViewFilter] = useState('activas') // 'activas' | 'historicas' | 'todas'
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedShipFilter, setSelectedShipFilter] = useState('todos')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('todos')
  const [selectedWorkTypeFilter, setSelectedWorkTypeFilter] = useState('todos')
  const [selectedForemanFilter, setSelectedForemanFilter] = useState('todos')
  const [viewMode, setViewMode] = useState('cards') // 'cards' | 'table'

  // Modales
  const [isFormModalOpen, setIsFormModalOpen] = useState(false)
  const [editingWoId, setEditingWoId] = useState(null)
  const [selectedWoDetail, setSelectedWoDetail] = useState(null)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [isAmpliarModalOpen, setIsAmpliarModalOpen] = useState(false)
  const [savingWo, setSavingWo] = useState(false)

  // Formulario de OT
  const [formData, setFormData] = useState({
    ship_id: '',
    ot_number: '',
    title: '',
    description: '',
    status: 'En Progreso',
    work_type: 'HORA',
    assignment_type: 'Presupuesto General',
    budget_code: '',
    foreman_name: 'ALE C',
    contractor_name: '',
    start_date: new Date().toISOString().split('T')[0],
    estimated_end_date: '',
    allow_post_billing_costs: false,
    notes: ''
  })

  // Consulta / Bitácora de ampliación
  const [ampliarText, setAmpliarText] = useState('')
  const [submittingAmpliar, setSubmittingAmpliar] = useState(false)

  // Sub-items / Tareas específicas de la OT seleccionada
  const [woItems, setWoItems] = useState([])
  const [newWorkItemText, setNewWorkItemText] = useState('')
  const [newWorkItemContractor, setNewWorkItemContractor] = useState('')

  // Cargar datos iniciales
  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const [shipsRes, wosRes, logsRes] = await Promise.all([
        supabase.from('ships').select('*').order('name'),
        supabase.from('work_orders').select('*, ships(name, client_name)').order('created_at', { ascending: false }),
        supabase.from('labor_logs').select('id, work_order_id, hours_worked, hours_normal, hours_extra_50, hours_extra_100, worker_name, date_logged')
      ])

      if (shipsRes.data) setShips(shipsRes.data)
      if (wosRes.data) setWorkOrders(wosRes.data)
      if (logsRes.data) setLaborLogs(logsRes.data)
    } catch (err) {
      console.error('Error cargando OTs:', err)
      setStatusMessage({ type: 'error', text: 'Error al conectar con la base de datos.' })
    } finally {
      setLoading(false)
    }
  }

  // Cargar sub-items cuando se abre la ficha detallada
  async function loadWorkItems(woId) {
    try {
      const { data, error } = await supabase
        .from('work_items')
        .select('*')
        .eq('work_order_id', woId)
        .order('created_at', { ascending: true })

      if (!error && data) {
        setWoItems(data)
      } else {
        setWoItems([])
      }
    } catch (err) {
      console.warn('Error al cargar work_items:', err)
      setWoItems([])
    }
  }

  // Abrir Ficha Detallada 360°
  const handleOpenDetail = (wo) => {
    setSelectedWoDetail(wo)
    loadWorkItems(wo.id)
  }

  // Abrir Modal de Creación
  const handleOpenCreateModal = () => {
    setEditingWoId(null)
    const nextNum = workOrders.length + 101
    setFormData({
      ship_id: ships[0]?.id || '',
      ot_number: `OT-${nextNum}`,
      title: '',
      description: '',
      status: 'En Progreso',
      work_type: 'HORA',
      assignment_type: 'Presupuesto General',
      budget_code: '',
      foreman_name: 'ALE C',
      contractor_name: '',
      start_date: new Date().toISOString().split('T')[0],
      estimated_end_date: '',
      allow_post_billing_costs: false,
      notes: ''
    })
    setIsFormModalOpen(true)
  }

  // Abrir Modal de Edición
  const handleOpenEditModal = (wo) => {
    setEditingWoId(wo.id)
    setFormData({
      ship_id: wo.ship_id,
      ot_number: wo.ot_number || `OT-${wo.id.slice(0, 4)}`,
      title: wo.title,
      description: wo.description || '',
      status: wo.status || 'En Progreso',
      work_type: wo.work_type || 'HORA',
      assignment_type: wo.assignment_type || 'Presupuesto General',
      budget_code: wo.budget_code || '',
      foreman_name: wo.foreman_name || 'ALE C',
      contractor_name: wo.contractor_name || '',
      start_date: wo.start_date || wo.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
      estimated_end_date: wo.estimated_end_date || '',
      allow_post_billing_costs: wo.allow_post_billing_costs || false,
      notes: wo.notes || ''
    })
    setIsFormModalOpen(true)
  }

  // Aplicar plantilla estándar a formulario
  const handleApplyTemplate = (tpl) => {
    setFormData(prev => ({
      ...prev,
      title: prev.title || tpl.title,
      description: tpl.description,
      work_type: tpl.work_type
    }))
    setIsTemplateModalOpen(false)
    setStatusMessage({ type: 'info', text: `Plantilla "${tpl.title}" aplicada al formulario.` })
    setTimeout(() => setStatusMessage(null), 3000)
  }

  // Guardar Creación o Edición
  const handleSaveWo = async (e) => {
    e.preventDefault()
    if (!formData.title.trim()) {
      alert('Por favor ingrese el título de la Orden de Trabajo.')
      return
    }

    setSavingWo(true)
    try {
      const payload = {
        ship_id: formData.ship_id,
        ot_number: formData.ot_number,
        title: formData.title,
        description: formData.description,
        status: formData.status,
        work_type: formData.work_type,
        assignment_type: formData.assignment_type,
        budget_code: formData.budget_code || null,
        foreman_name: formData.foreman_name,
        contractor_name: formData.contractor_name || null,
        start_date: formData.start_date,
        estimated_end_date: formData.estimated_end_date || null,
        allow_post_billing_costs: formData.allow_post_billing_costs,
        notes: formData.notes || null
      }

      if (editingWoId) {
        // Update
        const { error } = await supabase
          .from('work_orders')
          .update(payload)
          .eq('id', editingWoId)

        if (error) throw error
        setStatusMessage({ type: 'success', text: `¡Orden de Trabajo ${formData.ot_number || formData.title} actualizada con éxito!` })
      } else {
        // Insert
        const { error } = await supabase
          .from('work_orders')
          .insert([payload])

        if (error) throw error
        setStatusMessage({ type: 'success', text: `¡Nueva Orden de Trabajo creada con éxito!` })
      }

      setIsFormModalOpen(false)
      loadData()
      setTimeout(() => setStatusMessage(null), 3500)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al guardar: ${err.message}` })
    } finally {
      setSavingWo(false)
    }
  }

  // Cambio rápido de estado desde la vista o ficha
  const handleQuickStatusChange = async (woId, newStatus) => {
    try {
      const isClosing = newStatus === 'Facturada' || newStatus === 'Completada'
      const updateData = {
        status: newStatus,
        ...(isClosing ? { closed_at: new Date().toISOString() } : {})
      }

      setWorkOrders(prev => prev.map(w => w.id === woId ? { ...w, ...updateData } : w))
      if (selectedWoDetail?.id === woId) {
        setSelectedWoDetail(prev => ({ ...prev, ...updateData }))
      }

      const { error } = await supabase
        .from('work_orders')
        .update(updateData)
        .eq('id', woId)

      if (error) throw error

      setStatusMessage({ type: 'success', text: `Estado actualizado a "${newStatus}".` })
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al actualizar estado: ${err.message}` })
      loadData()
    }
  }

  // Eliminar OT
  const handleDeleteWo = async (wo) => {
    if (!window.confirm(`¿Estás seguro de eliminar la Orden de Trabajo "${wo.title}"? Esta acción no se puede deshacer.`)) return

    try {
      const { error } = await supabase
        .from('work_orders')
        .delete()
        .eq('id', wo.id)

      if (error) throw error

      setStatusMessage({ type: 'info', text: `Se eliminó la OT "${wo.title}".` })
      if (selectedWoDetail?.id === wo.id) setSelectedWoDetail(null)
      loadData()
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al eliminar: ${err.message}` })
    }
  }

  // Agregar sub-item / tarea a la OT
  const handleAddWorkItem = async (e) => {
    e.preventDefault()
    if (!newWorkItemText.trim() || !selectedWoDetail) return

    try {
      const payload = {
        work_order_id: selectedWoDetail.id,
        description: newWorkItemText.trim(),
        contractor_name: newWorkItemContractor.trim() || null,
        status: 'En Progreso'
      }

      const { data, error } = await supabase
        .from('work_items')
        .insert([payload])
        .select()

      if (error) throw error

      if (data && data[0]) {
        setWoItems(prev => [...prev, data[0]])
      }
      setNewWorkItemText('')
      setNewWorkItemContractor('')
      setStatusMessage({ type: 'success', text: 'Tarea específica agregada a la OT.' })
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: 'Error al agregar tarea: ' + err.message })
    }
  }

  // Toggle estado de un work item
  const handleToggleWorkItemStatus = async (item) => {
    const nextStatus = item.status === 'Completado' ? 'En Progreso' : 'Completado'
    try {
      setWoItems(prev => prev.map(i => i.id === item.id ? { ...i, status: nextStatus } : i))
      const { error } = await supabase
        .from('work_items')
        .update({ status: nextStatus })
        .eq('id', item.id)

      if (error) throw error
    } catch (err) {
      console.error(err)
      loadWorkItems(selectedWoDetail.id)
    }
  }

  // Eliminar work item
  const handleDeleteWorkItem = async (itemId) => {
    try {
      setWoItems(prev => prev.filter(i => i.id !== itemId))
      const { error } = await supabase.from('work_items').delete().eq('id', itemId)
      if (error) throw error
    } catch (err) {
      console.error(err)
      loadWorkItems(selectedWoDetail.id)
    }
  }

  // Enviar nota / aclaración mediante botón "Ampliar" (Regla 2)
  const handleSubmitAmpliar = async (e) => {
    e.preventDefault()
    if (!ampliarText.trim() || !selectedWoDetail) return

    setSubmittingAmpliar(true)
    try {
      const timestamp = new Date().toLocaleString('es-AR')
      const author = user?.email?.split('@')[0] || 'Supervisor'
      const appendedNote = `[${timestamp} - Consulta de ${author} a Jefe de Obra]: ${ampliarText.trim()}`
      const newNotes = selectedWoDetail.notes 
        ? `${selectedWoDetail.notes}\n\n${appendedNote}`
        : appendedNote

      const { error } = await supabase
        .from('work_orders')
        .update({ notes: newNotes })
        .eq('id', selectedWoDetail.id)

      if (error) throw error

      setSelectedWoDetail(prev => ({ ...prev, notes: newNotes }))
      setWorkOrders(prev => prev.map(w => w.id === selectedWoDetail.id ? { ...w, notes: newNotes } : w))
      setAmpliarText('')
      setIsAmpliarModalOpen(false)
      setStatusMessage({ type: 'success', text: 'Consulta técnica enviada y asentada en la bitácora de la OT.' })
      setTimeout(() => setStatusMessage(null), 4000)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: 'Error al registrar consulta: ' + err.message })
    } finally {
      setSubmittingAmpliar(false)
    }
  }

  // Cruzar horas trabajadas por OT
  const otMetricsMap = useMemo(() => {
    const map = {}
    laborLogs.forEach(log => {
      const woId = log.work_order_id
      if (!map[woId]) {
        map[woId] = {
          totalHours: 0,
          normalHours: 0,
          extra50: 0,
          extra100: 0,
          workerSet: new Set()
        }
      }
      const total = parseFloat(log.hours_worked) || 0
      const norm = parseFloat(log.hours_normal) || 0
      const h50 = parseFloat(log.hours_extra_50) || 0
      const h100 = parseFloat(log.hours_extra_100) || 0

      map[woId].totalHours += total
      map[woId].normalHours += norm
      map[woId].extra50 += h50
      map[woId].extra100 += h100
      if (log.worker_name) map[woId].workerSet.add(log.worker_name)
    })
    return map
  }, [laborLogs])

  // Filtrado de OTs
  const filteredWorkOrders = useMemo(() => {
    return workOrders.filter(wo => {
      // Filtro de Pestaña: Activas vs Históricas
      const isHistorical = wo.status === 'Facturada' || wo.status === 'Desestimada'
      if (viewFilter === 'activas' && isHistorical) return false
      if (viewFilter === 'historicas' && !isHistorical) return false

      // Filtro de Barco
      if (selectedShipFilter !== 'todos' && wo.ship_id !== selectedShipFilter) return false

      // Filtro de Estado
      if (selectedStatusFilter !== 'todos' && wo.status !== selectedStatusFilter) return false

      // Filtro de Tipo de Trabajo
      if (selectedWorkTypeFilter !== 'todos' && wo.work_type !== selectedWorkTypeFilter) return false

      // Filtro de Jefe de Obra
      if (selectedForemanFilter !== 'todos' && wo.foreman_name !== selectedForemanFilter) return false

      // Filtro de Búsqueda
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const shipName = (wo.ships?.name || '').toLowerCase()
        const clientName = (wo.ships?.client_name || '').toLowerCase()
        const title = (wo.title || '').toLowerCase()
        const otNum = (wo.ot_number || '').toLowerCase()
        const desc = (wo.description || '').toLowerCase()
        const foreman = (wo.foreman_name || '').toLowerCase()
        const contractor = (wo.contractor_name || '').toLowerCase()

        const match = title.includes(q) || otNum.includes(q) || desc.includes(q) || 
                      shipName.includes(q) || clientName.includes(q) || 
                      foreman.includes(q) || contractor.includes(q)
        if (!match) return false
      }

      return true
    })
  }, [workOrders, viewFilter, selectedShipFilter, selectedStatusFilter, selectedWorkTypeFilter, selectedForemanFilter, searchQuery])

  // Métricas superiores globales
  const stats = useMemo(() => {
    const enProgreso = workOrders.filter(w => w.status === 'En Progreso').length
    const pendientes = workOrders.filter(w => w.status === 'Pendiente').length
    const finalizadas = workOrders.filter(w => w.status === 'Completada').length
    const facturadas = workOrders.filter(w => w.status === 'Facturada').length
    const barcosActivos = new Set(workOrders.filter(w => w.status === 'En Progreso').map(w => w.ship_id)).size
    const totalHoras = laborLogs.reduce((acc, l) => acc + (parseFloat(l.hours_worked) || 0), 0)

    return { enProgreso, pendientes, finalizadas, facturadas, barcosActivos, totalHoras }
  }, [workOrders, laborLogs])

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* ========================================================= */}
      {/* 1. ENCABEZADO Y ACCIONES PRINCIPALES                      */}
      {/* ========================================================= */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold uppercase tracking-widest">
              Módulo M3 &bull; Operaciones
            </span>
            <span className="text-slate-500 text-xs">&bull;</span>
            <span className="text-xs text-slate-400 font-mono">Control de Obras & Costos</span>
          </div>
          <h1 className="text-2xl font-black text-white tracking-wide flex items-center gap-2.5">
            <ClipboardList className="w-7 h-7 text-primary" />
            Órdenes de Trabajo (OT)
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Gestión centralizada del ciclo de vida naval, alcance de tareas, asignación a buques y habilitación de costos (horas, pañol y terceros).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setIsTemplateModalOpen(true)}
            className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm hover:border-slate-600"
            title="Ver catálogo de tareas estándar de varadero (OT.ABC)"
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Plantillas Estándar</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-gradient-to-r from-primary to-cyan-500 hover:brightness-110 text-slate-950 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>+ Nueva Orden de Trabajo</span>
          </button>
        </div>
      </div>

      {/* MENSAJES DE ESTADO */}
      {statusMessage && (
        <div className={`p-3.5 rounded-xl text-xs font-medium border flex items-center justify-between ${
          statusMessage.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' :
          statusMessage.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-300' :
          'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
        }`}>
          <span>{statusMessage.text}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="p-1 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. TARJETAS DE MÉTRICAS OPERATIVAS SUPERIORES             */}
      {/* ========================================================= */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>En Progreso</span>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-emerald-400 font-mono">{stats.enProgreso}</span>
            <span className="text-[10px] text-slate-500">habilitadas</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Pendientes</span>
            <span className="w-2 h-2 rounded-full bg-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-amber-400 font-mono">{stats.pendientes}</span>
            <span className="text-[10px] text-slate-500">por iniciar</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Finalizadas</span>
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-cyan-300 font-mono">{stats.finalizadas}</span>
            <span className="text-[10px] text-slate-500">pdte. remito</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Facturadas</span>
            <span className="w-2 h-2 rounded-full bg-purple-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-purple-300 font-mono">{stats.facturadas}</span>
            <span className="text-[10px] text-slate-500">cerradas</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Buques Activos</span>
            <Ship className="w-3.5 h-3.5 text-slate-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-white font-mono">{stats.barcosActivos}</span>
            <span className="text-[10px] text-slate-500">con obras</span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-400 text-[11px] font-semibold">
            <span>Horas Totales</span>
            <Clock className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-black text-primary font-mono">{Math.round(stats.totalHoras)}</span>
            <span className="text-[10px] text-slate-500">hs cargadas</span>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 3. BARRA DE NAVEGACIÓN Y FILTROS AVANZADOS               */}
      {/* ========================================================= */}
      <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3.5">
        {/* Fila 1: Pestañas de Vista y Buscador */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center p-1 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
            <button
              type="button"
              onClick={() => setViewFilter('activas')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewFilter === 'activas' 
                  ? 'bg-primary text-slate-950 shadow-md shadow-primary/20' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>Obras Activas en Progreso ({workOrders.filter(w => w.status !== 'Facturada' && w.status !== 'Desestimada').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewFilter('historicas')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewFilter === 'historicas' 
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/30' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Archivo Histórico / Facturadas ({workOrders.filter(w => w.status === 'Facturada' || w.status === 'Desestimada').length})</span>
            </button>
            <button
              type="button"
              onClick={() => setViewFilter('todas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                viewFilter === 'todas' 
                  ? 'bg-slate-700 text-white' 
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>Todas ({workOrders.length})</span>
            </button>
          </div>

          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
              <input
                type="text"
                placeholder="Buscar por OT, barco, descripción, jefe de obra..."
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

            {/* Alternar Vista Grilla / Lista */}
            <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setViewMode('cards')}
                className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${viewMode === 'cards' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                title="Vista de Tarjetas / Fichas"
              >
                <Layers className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('table')}
                className={`p-1.5 rounded text-xs transition-colors cursor-pointer ${viewMode === 'table' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}
                title="Vista de Tabla Ejecutiva"
              >
                <FileText className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Fila 2: Selectores de filtrado en cascada */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-800/60 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Barco / Embarcación
            </label>
            <select
              value={selectedShipFilter}
              onChange={(e) => setSelectedShipFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-medium"
            >
              <option value="todos">Todos los Barcos</option>
              {ships.map(s => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.name === 'ASTILLERO' ? '(Uso Interno)' : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Estado Operativo
            </label>
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-medium"
            >
              <option value="todos">Todos los Estados</option>
              {ESTADOS_OT.map(st => (
                <option key={st.value} value={st.value}>{st.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Tipo de Trabajo
            </label>
            <select
              value={selectedWorkTypeFilter}
              onChange={(e) => setSelectedWorkTypeFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-medium"
            >
              <option value="todos">Todos los Tipos</option>
              {TIPOS_DE_TRABAJO.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">
              Jefe de Obra
            </label>
            <select
              value={selectedForemanFilter}
              onChange={(e) => setSelectedForemanFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-medium"
            >
              <option value="todos">Todos los Jefes de Obra</option>
              {JEFES_DE_OBRA.map(j => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 4. LISTADO PRINCIPAL (TARJETAS O TABLA)                   */}
      {/* ========================================================= */}
      {loading ? (
        <div className="py-20 text-center text-slate-400">
          <Clock className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm font-semibold">Cargando Órdenes de Trabajo...</p>
        </div>
      ) : filteredWorkOrders.length === 0 ? (
        <div className="py-16 text-center text-slate-500 border border-dashed border-slate-800 rounded-2xl p-8">
          <ClipboardList className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-base font-bold text-slate-300">No se encontraron Órdenes de Trabajo</p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            No hay registros que coincidan con los filtros aplicados. Podés ajustar la búsqueda o dar de alta una nueva OT.
          </p>
          <button
            type="button"
            onClick={handleOpenCreateModal}
            className="mt-4 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-xs font-bold transition-all cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Crear Primera OT</span>
          </button>
        </div>
      ) : viewMode === 'cards' ? (
        /* VISTA DE TARJETAS / FICHAS */
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredWorkOrders.map(wo => {
            const statusConfig = ESTADOS_OT.find(s => s.value === wo.status) || ESTADOS_OT[0]
            const metrics = otMetricsMap[wo.id] || { totalHours: 0, workerSet: new Set() }
            const isHistorical = wo.status === 'Facturada' || wo.status === 'Desestimada'
            const isInternalAstillero = (wo.ships?.name || '').toUpperCase() === 'ASTILLERO'

            return (
              <div 
                key={wo.id}
                className={`p-4 rounded-2xl border transition-all flex flex-col justify-between relative group ${
                  isHistorical
                    ? 'bg-slate-950/60 border-purple-900/30 hover:border-purple-800/50'
                    : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:shadow-xl'
                }`}
              >
                {/* Cabecera de la tarjeta */}
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-black text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
                        {wo.ot_number || `OT-${wo.id.slice(0, 4)}`}
                      </span>
                      {isInternalAstillero && (
                        <span className="text-[10px] font-bold text-purple-300 bg-purple-950/80 border border-purple-800 px-1.5 py-0.5 rounded">
                          Interno Astillero
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${statusConfig.color}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                        <span>{wo.status}</span>
                      </span>
                    </div>
                  </div>

                  {/* Nombre del barco */}
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 mb-1">
                    <Ship className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="text-white font-bold">{wo.ships?.name || 'Barco no asignado'}</span>
                    {wo.ships?.client_name && (
                      <span className="text-slate-500 text-[11px] font-normal">&bull; {wo.ships.client_name}</span>
                    )}
                  </div>

                  {/* Título de la OT */}
                  <h3 className="text-sm font-black text-white group-hover:text-primary transition-colors leading-snug">
                    {wo.title}
                  </h3>

                  {/* Descripción técnica / Alcance con Tooltip asistido (DEC-016) */}
                  {wo.description && (
                    <div className="mt-2 p-2 bg-slate-950/80 rounded-xl border border-slate-800/80 text-[11px] text-slate-400 line-clamp-2 hover:line-clamp-none transition-all cursor-pointer relative" title={wo.description}>
                      <span className="text-slate-500 font-bold block text-[10px] uppercase mb-0.5">Alcance Técnico:</span>
                      {wo.description}
                    </div>
                  )}

                  {/* Atributos: Jefe de Obra & Tipo de Trabajo */}
                  <div className="mt-3 pt-3 border-t border-slate-800/60 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Jefe de Obra</span>
                      <span className="font-semibold text-slate-200 flex items-center gap-1">
                        <User className="w-3 h-3 text-amber-400" />
                        {wo.foreman_name || 'Sin asignar'}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px] uppercase font-bold">Tipo de Trabajo</span>
                      <span className="font-mono text-cyan-300 font-bold">
                        {wo.work_type || 'HORA'} {wo.budget_code ? `(${wo.budget_code})` : ''}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Métricas de horas e interactividad */}
                <div className="mt-4 pt-3 border-t border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-3 text-xs font-mono">
                    <div title="Horas imputadas en partes diarios">
                      <span className="text-slate-500 text-[10px] block">Horas Real</span>
                      <strong className="text-primary font-extrabold">{metrics.totalHours} hs</strong>
                    </div>
                    {metrics.workerSet.size > 0 && (
                      <div title="Operarios que imputaron horas">
                        <span className="text-slate-500 text-[10px] block">Personal</span>
                        <span className="text-slate-300 font-semibold">{metrics.workerSet.size} op</span>
                      </div>
                    )}
                  </div>

                  {/* Botones de acción */}
                  <div className="flex items-center gap-1">
                    <Link
                      to="/horas"
                      className="p-1.5 text-slate-400 hover:text-cyan-400 rounded-lg hover:bg-slate-800 transition-colors"
                      title="Ir a Carga de Horas para este barco/OT"
                    >
                      <Clock className="w-4 h-4" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleOpenDetail(wo)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-colors cursor-pointer flex items-center gap-1"
                      title="Ver Ficha Detallada 360°"
                    >
                      <Eye className="w-3.5 h-3.5 text-primary" />
                      <span>Ficha</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditModal(wo)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Editar OT"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteWo(wo)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="Eliminar OT"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* VISTA DE TABLA EJECUTIVA */
        <div className="overflow-x-auto border border-slate-800 rounded-2xl bg-slate-900/90 shadow-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3 px-3.5 w-24">OT Nº</th>
                <th className="py-3 px-3">Barco & Cliente</th>
                <th className="py-3 px-3">Título & Alcance Técnico</th>
                <th className="py-3 px-3">Jefe Obra</th>
                <th className="py-3 px-3">Tipo</th>
                <th className="py-3 px-3 text-center">Horas Imputadas</th>
                <th className="py-3 px-3 text-center">Estado</th>
                <th className="py-3 px-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {filteredWorkOrders.map(wo => {
                const statusConfig = ESTADOS_OT.find(s => s.value === wo.status) || ESTADOS_OT[0]
                const metrics = otMetricsMap[wo.id] || { totalHours: 0, workerSet: new Set() }

                return (
                  <tr key={wo.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3.5 font-mono font-bold text-primary">
                      {wo.ot_number || `OT-${wo.id.slice(0, 4)}`}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-white block">{wo.ships?.name}</span>
                      <span className="text-[10px] text-slate-400">{wo.ships?.client_name || 'Alon Car'}</span>
                    </td>
                    <td className="py-2.5 px-3 max-w-sm">
                      <span className="font-bold text-slate-200 block">{wo.title}</span>
                      {wo.description && (
                        <p className="text-[11px] text-slate-400 truncate max-w-xs" title={wo.description}>
                          {wo.description}
                        </p>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-semibold text-slate-300">{wo.foreman_name || 'ALE C'}</span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-cyan-300 font-bold">
                      {wo.work_type || 'HORA'}
                    </td>
                    <td className="py-2.5 px-3 text-center font-mono font-bold text-primary">
                      {metrics.totalHours} hs
                    </td>
                    <td className="py-2.5 px-3 text-center">
                      <select
                        value={wo.status || 'En Progreso'}
                        onChange={(e) => handleQuickStatusChange(wo.id, e.target.value)}
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-colors cursor-pointer focus:outline-none ${statusConfig.color}`}
                      >
                        {ESTADOS_OT.map(st => (
                          <option key={st.value} value={st.value}>{st.value}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-2.5 px-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenDetail(wo)}
                          className="p-1.5 text-slate-400 hover:text-primary rounded hover:bg-slate-800"
                          title="Ficha 360°"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditModal(wo)}
                          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteWo(wo)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-500/10"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. MODAL FORMULARIO: CREAR O EDITAR ORDEN DE TRABAJO      */}
      {/* ========================================================= */}
      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 relative my-8">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <ClipboardList className="w-5 h-5 text-primary" />
                  {editingWoId ? `Editar ${formData.ot_number}` : 'Nueva Orden de Trabajo'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Complete los datos de la obra. Al guardarla en estado &quot;En Progreso&quot;, quedará habilitada inmediatamente para imputación de mano de obra y materiales.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsFormModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWo} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Barco */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                    <Ship className="w-3.5 h-3.5 text-cyan-400" />
                    Barco / Embarcación *
                  </label>
                  <select
                    required
                    value={formData.ship_id}
                    onChange={(e) => setFormData({ ...formData, ship_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-bold"
                  >
                    {ships.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.name === 'ASTILLERO' ? '(Uso Interno Astillero)' : ''} &bull; {s.client_name || 'Cliente'}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Número de OT */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Identificador / Nº OT *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.ot_number}
                    onChange={(e) => setFormData({ ...formData, ot_number: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-primary font-mono font-bold focus:outline-none focus:border-primary"
                    placeholder="Ej: OT-105"
                  />
                </div>
              </div>

              {/* Título de la OT y Botón de Plantillas */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-semibold text-slate-300">
                    Título descriptivo de la Obra *
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsTemplateModalOpen(true)}
                    className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Usar plantilla estándar (OT.ABC)</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Ej: Recorrido y Rectificación de Válvulas de Fondo"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-medium"
                />
              </div>

              {/* Descripción Técnica / Alcance */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Descripción Técnica y Alcance de Tareas (Aparece como ayuda memoria en Carga de Horas & Pañol)
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Detalle los trabajos a ejecutar, sectores a intervenir, espesores, tolerancias o normativas de aplicación..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                />
              </div>

              {/* Parametrización: Estado, Tipo y Jefe de Obra */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Estado Operativo
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-bold"
                  >
                    {ESTADOS_OT.map(st => (
                      <option key={st.value} value={st.value}>{st.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tipo de Trabajo
                  </label>
                  <select
                    value={formData.work_type}
                    onChange={(e) => setFormData({ ...formData, work_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    {TIPOS_DE_TRABAJO.map(t => (
                      <option key={t.value} value={t.value}>{t.value} &bull; {t.label.split('(')[0]}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Jefe de Obra Responsable
                  </label>
                  <select
                    value={formData.foreman_name}
                    onChange={(e) => setFormData({ ...formData, foreman_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-bold"
                  >
                    {JEFES_DE_OBRA.map(j => (
                      <option key={j} value={j}>{j}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Asignación y PRC */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Tipo de Asignación / Centro Costo
                  </label>
                  <select
                    value={formData.assignment_type}
                    onChange={(e) => setFormData({ ...formData, assignment_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    <option value="Presupuesto General">Presupuesto General de la Embarcación</option>
                    <option value="Adicional / Específico">Adicional / Específico (Centro de Costos Aislado)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nº Presupuesto / Código PRC (Opcional)
                  </label>
                  <input
                    type="text"
                    value={formData.budget_code}
                    onChange={(e) => setFormData({ ...formData, budget_code: e.target.value })}
                    placeholder="Ej: PRC-2026-042"
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-mono"
                  />
                </div>
              </div>

              {/* Fechas */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Fecha de Inicio
                  </label>
                  <input
                    type="date"
                    value={formData.start_date}
                    onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Fecha Estimada de Fin (Opcional)
                  </label>
                  <input
                    type="date"
                    value={formData.estimated_end_date}
                    onChange={(e) => setFormData({ ...formData, estimated_end_date: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* Data locking flexible para facturadas (DEC-011) */}
              {(formData.status === 'Facturada' || formData.status === 'Completada') && (
                <div className="p-3 bg-purple-950/40 border border-purple-800/60 rounded-xl space-y-1">
                  <label className="flex items-center gap-2 cursor-pointer text-xs font-bold text-purple-200">
                    <input
                      type="checkbox"
                      checked={formData.allow_post_billing_costs}
                      onChange={(e) => setFormData({ ...formData, allow_post_billing_costs: e.target.checked })}
                      className="rounded bg-slate-950 border-purple-700 text-purple-500"
                    />
                    <span>Permitir imputación de costos adicionales de arrastre post-cierre (DEC-011)</span>
                  </label>
                  <p className="text-[11px] text-purple-300/70 pl-5">
                    Si está desactivado, el sistema bloqueará estrictamente cualquier carga de horas o materiales a esta OT.
                  </p>
                </div>
              )}

              {/* Botones del formulario */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsFormModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingWo}
                  className="px-5 py-2 bg-gradient-to-r from-primary to-cyan-500 hover:brightness-110 text-slate-950 text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>{savingWo ? 'Guardando...' : (editingWoId ? 'Actualizar Orden de Trabajo' : 'Crear Orden de Trabajo')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 6. DRAWER / MODAL: FICHA DETALLADA 360° DE LA OT          */}
      {/* ========================================================= */}
      {selectedWoDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 sm:p-7 relative my-8">
            {/* Header del detalle */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-xs font-black text-primary px-2.5 py-0.5 rounded-lg bg-primary/10 border border-primary/30">
                    {selectedWoDetail.ot_number || `OT-${selectedWoDetail.id.slice(0, 4)}`}
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    ESTADOS_OT.find(s => s.value === selectedWoDetail.status)?.color || 'text-slate-300 bg-slate-800'
                  }`}>
                    {selectedWoDetail.status}
                  </span>
                </div>
                <h2 className="text-xl font-black text-white leading-tight">
                  {selectedWoDetail.title}
                </h2>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5 font-medium">
                  <Ship className="w-3.5 h-3.5 text-cyan-400" />
                  <strong>{selectedWoDetail.ships?.name}</strong> &bull; {selectedWoDetail.ships?.client_name || 'Alon Car'} &bull; Jefe de Obra: <strong className="text-amber-400">{selectedWoDetail.foreman_name || 'ALE C'}</strong>
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    handleOpenEditModal(selectedWoDetail)
                    setSelectedWoDetail(null)
                  }}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                  title="Editar OT"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedWoDetail(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Alcance Técnico de la OT */}
            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider mb-1.5">
                  Alcance Técnico & Descripción del Trabajo
                </h4>
                <div className="p-3.5 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-200 leading-relaxed whitespace-pre-wrap">
                  {selectedWoDetail.description || 'Sin descripción detallada cargada.'}
                </div>
              </div>

              {/* Métricas consolidadas en tiempo real */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-slate-950/70 rounded-2xl border border-slate-800 text-xs">
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Horas Totales</span>
                  <strong className="text-primary font-mono text-base font-black">
                    {otMetricsMap[selectedWoDetail.id]?.totalHours || 0} hs
                  </strong>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Normales / Extras</span>
                  <span className="text-slate-300 font-mono text-xs">
                    {otMetricsMap[selectedWoDetail.id]?.normalHours || 0}h / +{(otMetricsMap[selectedWoDetail.id]?.extra50 || 0) + (otMetricsMap[selectedWoDetail.id]?.extra100 || 0)}h
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Operarios</span>
                  <span className="text-slate-300 font-semibold text-xs">
                    {otMetricsMap[selectedWoDetail.id]?.workerSet.size || 0} operarios
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 text-[10px] uppercase font-bold block">Tipo & Asignación</span>
                  <span className="text-cyan-300 font-mono font-bold text-xs">
                    {selectedWoDetail.work_type}
                  </span>
                </div>
              </div>

              {/* Sub-trabajos / WorkItems de la OT */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-primary" />
                    <span>Sub-trabajos y Tareas Específicas ({woItems.length})</span>
                  </h4>
                  <span className="text-[11px] text-slate-500">
                    {woItems.filter(i => i.status === 'Completado').length} de {woItems.length} completadas
                  </span>
                </div>

                {/* Formulario rápido para agregar tarea */}
                <form onSubmit={handleAddWorkItem} className="flex gap-2 mb-3">
                  <input
                    type="text"
                    required
                    placeholder="Nueva tarea específica (ej: Desmonte de mecha y buje)..."
                    value={newWorkItemText}
                    onChange={(e) => setNewWorkItemText(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                  />
                  <input
                    type="text"
                    placeholder="Contratista/Taller..."
                    value={newWorkItemContractor}
                    onChange={(e) => setNewWorkItemContractor(e.target.value)}
                    className="w-40 bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Agregar</span>
                  </button>
                </form>

                {/* Lista de tareas */}
                {woItems.length === 0 ? (
                  <div className="p-3 bg-slate-950/50 rounded-xl border border-dashed border-slate-800 text-center text-xs text-slate-500">
                    Esta OT no tiene sub-trabajos individuales asignados aún. Podés desglosar las tareas arriba.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {woItems.map(item => (
                      <div 
                        key={item.id}
                        className={`p-2.5 rounded-xl border flex items-center justify-between text-xs transition-colors ${
                          item.status === 'Completado' 
                            ? 'bg-slate-950/40 border-slate-800/60 text-slate-400 line-through' 
                            : 'bg-slate-950 border-slate-800 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 flex-1">
                          <button
                            type="button"
                            onClick={() => handleToggleWorkItemStatus(item)}
                            className={`w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors ${
                              item.status === 'Completado' 
                                ? 'bg-emerald-500 border-emerald-400 text-slate-950' 
                                : 'border-slate-600 hover:border-primary'
                            }`}
                          >
                            {item.status === 'Completado' && <Check className="w-3 h-3 stroke-[3]" />}
                          </button>
                          <span>{item.description}</span>
                          {item.contractor_name && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-cyan-300 font-mono">
                              {item.contractor_name}
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteWorkItem(item.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Bitácora y Botón "Ampliar" (Regla de Negocio 2) */}
              <div className="pt-2 border-t border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                    <span>Comunicación & Bitácora de la OT</span>
                  </h4>
                  <button
                    type="button"
                    onClick={() => setIsAmpliarModalOpen(true)}
                    className="px-3 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                    title="Hacer una consulta o aclaración al Jefe de Obra"
                  >
                    <Send className="w-3 h-3" />
                    <span>Botón &quot;Ampliar&quot; (Consultar al Jefe de Obra)</span>
                  </button>
                </div>

                {selectedWoDetail.notes ? (
                  <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 text-xs text-slate-300 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {selectedWoDetail.notes}
                  </div>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    Sin consultas ni notas asentadas. Con el botón &quot;Ampliar&quot; podés solicitar aclaraciones técnicas al Jefe de Obra responsable.
                  </p>
                )}
              </div>
            </div>

            {/* Pie de la ficha con acciones operativas */}
            <div className="pt-5 mt-5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Link
                  to="/horas"
                  className="px-3.5 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Imputar Horas a esta OT</span>
                </Link>
              </div>

              <div className="flex items-center gap-2">
                {selectedWoDetail.status !== 'En Progreso' && (
                  <button
                    type="button"
                    onClick={() => handleQuickStatusChange(selectedWoDetail.id, 'En Progreso')}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Habilitar (En Progreso)
                  </button>
                )}

                {selectedWoDetail.status !== 'Completada' && (
                  <button
                    type="button"
                    onClick={() => handleQuickStatusChange(selectedWoDetail.id, 'Completada')}
                    className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Marcar Finalizada
                  </button>
                )}

                {selectedWoDetail.status !== 'Facturada' && (
                  <button
                    type="button"
                    onClick={() => handleQuickStatusChange(selectedWoDetail.id, 'Facturada')}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                  >
                    Cierre Facturado
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 7. MODAL: CATÁLOGO DE PLANTILLAS ESTÁNDAR (OT.ABC)        */}
      {/* ========================================================= */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 relative my-8">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Catálogo de Tareas Tabuladas de Varadero (OT.ABC)
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Seleccione un trabajo estándar para autocompletar el título, rubro y la descripción técnica de la Orden de Trabajo.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTemplateModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto pr-1">
              {PLANTILLAS_OT_ABC.map(tpl => (
                <div 
                  key={tpl.id}
                  className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/50 transition-all flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-1">
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 font-bold border border-amber-500/20">
                        {tpl.trade}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        {tpl.work_type}
                      </span>
                    </div>
                    <h4 className="text-xs font-black text-white mt-1">
                      {tpl.title}
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                      {tpl.description}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t border-slate-800/60 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleApplyTemplate(tpl)}
                      className="px-3 py-1 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Aplicar a esta OT</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 8. MODAL: CONSULTA TÉCNICA "AMPLIAR" (REGLA DE NEGOCIO 2) */}
      {/* ========================================================= */}
      {isAmpliarModalOpen && selectedWoDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-6 relative">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                  <Send className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">
                    Solicitud de Ampliación de Alcance
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {selectedWoDetail.ot_number} &bull; {selectedWoDetail.ships?.name} &bull; Para: <strong className="text-amber-400">{selectedWoDetail.foreman_name}</strong>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAmpliarModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitAmpliar} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Consulta o Detalle a Aclarar con el Jefe de Obra:
                </label>
                <textarea
                  required
                  rows={4}
                  value={ampliarText}
                  onChange={(e) => setAmpliarText(e.target.value)}
                  placeholder="Ej: Se detectó mayor fisura en el fondo de pique de proa. Se requiere verificar si el cliente aprobó renovación de chapa adicional o si se mantiene el alcance original..."
                  className="w-full bg-slate-950 border border-amber-500/40 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  autoFocus
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAmpliarModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submittingAmpliar}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{submittingAmpliar ? 'Enviando...' : 'Asentar en Bitácora'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
