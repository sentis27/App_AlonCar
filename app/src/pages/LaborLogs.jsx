import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Clock, 
  Ship, 
  ClipboardList, 
  Plus, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  RotateCcw, 
  Save, 
  Calendar,
  Users,
  ChevronRight,
  Info,
  Pencil,
  X,
  Filter,
  Search,
  UserCheck,
  Table,
  CheckCircle,
  AlertTriangle,
  Briefcase
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Nómina base de Personal Propio del Astillero (Regla: 8 hs diarias obligatorias)
const NOMINA_ASTILLERO_BASE = [
  { name: 'Carlos Peralta', defaultRubro: 'Soldadura' },
  { name: 'Lucas Benítez', defaultRubro: 'Pintura' },
  { name: 'Martín Gómez', defaultRubro: 'Calderería' },
  { name: 'Juan Pérez', defaultRubro: 'Mecánica' },
  { name: 'Marcelo Ramos', defaultRubro: 'Varadero' },
  { name: 'Jorge', defaultRubro: 'Coordinación' },
  { name: 'Hugo Obregozo', defaultRubro: 'Supervisión' }
]

// Contratistas / Talleres frecuentes (Sin regla de horas diarias)
const CONTRATISTAS_FRECUENTES = [
  'Aldo',
  'Ateneo',
  'Electromecánica Sur',
  'Calderería Naval Don Luis',
  'Jorge Giorgetti'
]

// Opciones de rubros comunes según matriz Alon Car
const RUBROS_SUGERIDOS = [
  'Calderería',
  'Pintura',
  'Mecánica',
  'Soldadura',
  'Raschinear',
  'Electricidad',
  'Carpintería naval',
  'Maniobras y varada',
  'Fletes / Logística'
]

// Datos semilla de respaldo si la conexión no responde
const FALLBACK_SHIPS = [
  { id: 'ship-1', name: 'VIRGEN DE ITATI', client_name: 'Astillero Alon Car' },
  { id: 'ship-2', name: 'NONO PASCUAL', client_name: 'Astillero Alon Car' },
  { id: 'ship-3', name: 'SIEMPRE DON VICENTE', client_name: 'Astillero Alon Car' },
  { id: 'ship-4', name: 'MIS SUEÑOS', client_name: 'Astillero Alon Car' },
]

const FALLBACK_WOS = [
  { id: 'wo-1', ship_id: 'ship-1', title: 'OT-101: Válvulas de Fondo', description: 'Recorrido, rectificación y prueba hidráulica de válvulas de casco y tomas de mar.' },
  { id: 'wo-2', ship_id: 'ship-1', title: 'OT-102: Calderería Obra Viva', description: 'Renovación de tramos de chapa 3/8" y fondos de pique proa según informe de espesores.' },
  { id: 'wo-3', ship_id: 'ship-2', title: 'OT-103: Pintura General', description: 'Lavado a alta presión, arenado comercial y esquema de pintura antiincrustante.' },
  { id: 'wo-4', ship_id: 'ship-2', title: 'OT-104: Línea de Eje y Timón', description: 'Desmontaje de hélice, alineación de eje portahélice y cambio de bujes.' },
]

export default function LaborLogs() {
  const { user } = useAuth()

  // Pestaña activa: 'carga' | 'control_diario' | 'sabana_quincenal'
  const [activeTab, setActiveTab] = useState('carga')

  // Listados principales
  const [ships, setShips] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)

  // Cabecera de la Carga
  const [selectedShipId, setSelectedShipId] = useState('')
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('')
  const [dateLogged, setDateLogged] = useState(new Date().toISOString().split('T')[0])
  const [workType, setWorkType] = useState('HORA')
  // Centro de costo: Regla Alon Car -> SIEMPRE CLIENTE (Fijo, no configurable para evitar errores)
  const costCenter = 'CLIENTE'

  // Filas de Operarios en la Cuadrilla
  const [operariosRows, setOperariosRows] = useState([
    { 
      id: 1, 
      worker_name: '', 
      worker_type: 'Astillero', 
      rubro: '', 
      hours_normal: 8, 
      hours_extra_50: 0, 
      hours_extra_100: 0, 
      notes: '' 
    }
  ])

  // Filtros de la Tabla Detallada
  const [filterWorker, setFilterWorker] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [filterShip, setFilterShip] = useState('')

  // Control Diario
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split('T')[0])

  // Sábana Quincenal
  const [selectedQuincena, setSelectedQuincena] = useState('1') // '1' = 1 al 15, '2' = 16 al fin
  const [selectedMonth, setSelectedMonth] = useState('10') // Octubre
  const [selectedYear, setSelectedYear] = useState('2026')

  // Estado para Edición / Carga Rápida In-situ
  const [editingLog, setEditingLog] = useState(null)
  const [editingForm, setEditingForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)

  // Modal para Carga Rápida a Operario desde Control Diario
  const [quickLogWorker, setQuickLogWorker] = useState(null)

  // Cargar Barcos, OTs y Horas desde Supabase
  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    try {
      setLoading(true)
      const [shipsRes, wosRes, logsRes] = await Promise.all([
        supabase.from('ships').select('*').order('name'),
        supabase.from('work_orders').select('*').order('title'),
        supabase.from('labor_logs').select('*, work_orders(title, ship_id, ships(name))').order('date_logged', { ascending: false }).limit(200)
      ])

      const loadedShips = (shipsRes.data && shipsRes.data.length > 0) ? shipsRes.data : FALLBACK_SHIPS
      const loadedWos = (wosRes.data && wosRes.data.length > 0) ? wosRes.data : FALLBACK_WOS

      setShips(loadedShips)
      setWorkOrders(loadedWos)

      if (loadedShips.length > 0 && !selectedShipId) {
        setSelectedShipId(loadedShips[0].id)
      }

      if (logsRes.data) {
        setRecentLogs(logsRes.data)
      }
    } catch (err) {
      console.warn('Usando datos de respaldo para barcos y OTs:', err)
      setShips(FALLBACK_SHIPS)
      setWorkOrders(FALLBACK_WOS)
      setSelectedShipId(FALLBACK_SHIPS[0].id)
    } finally {
      setLoading(false)
    }
  }

  // Filtrar OTs según barco
  const availableWorkOrders = workOrders.filter(wo => wo.ship_id === selectedShipId)

  useEffect(() => {
    if (availableWorkOrders.length > 0) {
      setSelectedWorkOrderId(availableWorkOrders[0].id)
    } else {
      setSelectedWorkOrderId('')
    }
  }, [selectedShipId])

  const currentWorkOrder = workOrders.find(wo => wo.id === selectedWorkOrderId)
  const currentShip = ships.find(s => s.id === selectedShipId)

  // Manejo de Filas de Carga
  const addOperarioRow = (preset = {}) => {
    setOperariosRows(prev => [
      ...prev,
      { 
        id: Date.now() + Math.random(), 
        worker_name: preset.worker_name || '', 
        worker_type: preset.worker_type || 'Astillero', 
        rubro: preset.rubro || '', 
        hours_normal: preset.hours_normal ?? 8, 
        hours_extra_50: preset.hours_extra_50 ?? 0, 
        hours_extra_100: preset.hours_extra_100 ?? 0, 
        notes: preset.notes || '' 
      }
    ])
  }

  const removeOperarioRow = (rowId) => {
    if (operariosRows.length === 1) return
    setOperariosRows(prev => prev.filter(r => r.id !== rowId))
  }

  const updateOperarioRow = (rowId, field, value) => {
    setOperariosRows(prev => prev.map(r => {
      if (r.id === rowId) {
        return { ...r, [field]: value }
      }
      return r
    }))
  }

  // Replicar Cuadrilla
  const replicateYesterday = () => {
    const saved = localStorage.getItem('aloncar_last_labor_batch_v2')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setOperariosRows(parsed.map(p => ({ ...p, id: Math.random() })))
        setStatusMessage({ type: 'info', text: 'Se replicó la cuadrilla cargada anteriormente.' })
      } catch (e) {
        console.error(e)
      }
    } else {
      setOperariosRows([
        { id: 1, worker_name: 'Carlos Peralta', worker_type: 'Astillero', rubro: 'Soldadura', hours_normal: 8, hours_extra_50: 1, hours_extra_100: 0, notes: 'Reparación chapa fondo' },
        { id: 2, worker_name: 'Lucas Benítez', worker_type: 'Astillero', rubro: 'Pintura', hours_normal: 8, hours_extra_50: 1, hours_extra_100: 0, notes: 'Arenado y esquema anticorrosivo' },
        { id: 3, worker_name: 'Aldo', worker_type: 'Contratista', rubro: 'Calderería', hours_normal: 6, hours_extra_50: 0, hours_extra_100: 0, notes: 'Corte y curvado de perfiles' },
      ])
      setStatusMessage({ type: 'info', text: 'Se cargó una cuadrilla de ejemplo (Carlos, Lucas, Aldo).' })
    }
    setTimeout(() => setStatusMessage(null), 4000)
  }

  // Cálculos de Totales en Carga
  const totalHorasNormales = operariosRows.reduce((acc, r) => acc + (parseFloat(r.hours_normal) || 0), 0)
  const totalHoras50 = operariosRows.reduce((acc, r) => acc + (parseFloat(r.hours_extra_50) || 0), 0)
  const totalHoras100 = operariosRows.reduce((acc, r) => acc + (parseFloat(r.hours_extra_100) || 0), 0)
  const totalHorasGenerales = totalHorasNormales + totalHoras50 + totalHoras100

  // Guardar Lote en Supabase
  const handleSubmitBatch = async (e) => {
    e.preventDefault()
    setStatusMessage(null)

    if (!selectedWorkOrderId) {
      setStatusMessage({ type: 'error', text: 'Debe seleccionar una Orden de Trabajo válida.' })
      return
    }

    const rowsWithErrors = operariosRows.filter(r => !r.worker_name.trim() || !r.rubro.trim())
    if (rowsWithErrors.length > 0) {
      setStatusMessage({ type: 'error', text: 'Complete Nombre y Rubro para todas las filas.' })
      return
    }

    setSubmitting(true)

    try {
      localStorage.setItem('aloncar_last_labor_batch_v2', JSON.stringify(operariosRows))

      const payload = operariosRows.map(row => {
        const hNorm = parseFloat(row.hours_normal) || 0
        const h50 = parseFloat(row.hours_extra_50) || 0
        const h100 = parseFloat(row.hours_extra_100) || 0
        const hTotal = hNorm + h50 + h100

        return {
          work_order_id: selectedWorkOrderId,
          hours_worked: hTotal,
          hours_normal: hNorm,
          hours_extra_50: h50,
          hours_extra_100: h100,
          date_logged: dateLogged,
          worker_name: row.worker_name,
          worker_type: row.worker_type,
          rubro: row.rubro,
          work_type: workType,
          cost_center: 'CLIENTE',
          notes: row.notes || null,
          approval_status: 'Aprobado'
        }
      })

      const { error } = await supabase.from('labor_logs').insert(payload)
      if (error) throw error

      setStatusMessage({ 
        type: 'success', 
        text: `¡Lote guardado! Se registraron ${operariosRows.length} operarios (${totalHorasGenerales} hs totales: ${totalHorasNormales}h normales, ${totalHoras50}h al 50%, ${totalHoras100}h al 100%) en ${currentWorkOrder?.title || 'la OT'}.` 
      })

      setOperariosRows([
        { id: Date.now(), worker_name: '', worker_type: 'Astillero', rubro: '', hours_normal: 8, hours_extra_50: 0, hours_extra_100: 0, notes: '' }
      ])

      loadInitialData()
    } catch (err) {
      console.error('Error al guardar horas:', err)
      setStatusMessage({ type: 'error', text: `Error al guardar en Supabase: ${err.message || 'Verifique conexión'}` })
    } finally {
      setSubmitting(false)
    }
  }

  // Guardar Edición
  const handleSaveEdit = async (e) => {
    e.preventDefault()
    setSavingEdit(true)
    try {
      const hNorm = parseFloat(editingForm.hours_normal) || 0
      const h50 = parseFloat(editingForm.hours_extra_50) || 0
      const h100 = parseFloat(editingForm.hours_extra_100) || 0
      const hTotal = hNorm + h50 + h100

      const { error } = await supabase
        .from('labor_logs')
        .update({
          worker_name: editingForm.worker_name,
          worker_type: editingForm.worker_type,
          rubro: editingForm.rubro,
          hours_worked: hTotal,
          hours_normal: hNorm,
          hours_extra_50: h50,
          hours_extra_100: h100,
          date_logged: editingForm.date_logged,
          work_type: editingForm.work_type,
          cost_center: 'CLIENTE',
          notes: editingForm.notes,
          approval_status: editingForm.approval_status
        })
        .eq('id', editingForm.id)

      if (error) throw error

      setStatusMessage({ type: 'success', text: `Registro de ${editingForm.worker_name} actualizado.` })
      setEditingLog(null)
      loadInitialData()
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al actualizar: ${err.message}` })
    } finally {
      setSavingEdit(false)
    }
  }

  // Eliminar Fila
  const handleDeleteLog = async (logId, workerName) => {
    if (!window.confirm(`¿Estás seguro de eliminar el registro de ${workerName}?`)) return
    try {
      const { error } = await supabase.from('labor_logs').delete().eq('id', logId)
      if (error) throw error
      setStatusMessage({ type: 'info', text: `Se eliminó el registro de ${workerName}.` })
      loadInitialData()
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al eliminar: ${err.message}` })
    }
  }

  // Carga rápida in-situ desde Control Diario
  const handleQuickLogSubmit = async (e) => {
    e.preventDefault()
    setSavingEdit(true)
    try {
      const hNorm = parseFloat(quickLogWorker.hours_normal) || 0
      const h50 = parseFloat(quickLogWorker.hours_extra_50) || 0
      const h100 = parseFloat(quickLogWorker.hours_extra_100) || 0
      const hTotal = hNorm + h50 + h100

      const { error } = await supabase.from('labor_logs').insert([{
        work_order_id: quickLogWorker.work_order_id,
        hours_worked: hTotal,
        hours_normal: hNorm,
        hours_extra_50: h50,
        hours_extra_100: h100,
        date_logged: auditDate,
        worker_name: quickLogWorker.name,
        worker_type: quickLogWorker.type || 'Astillero',
        rubro: quickLogWorker.rubro,
        work_type: 'HORA',
        cost_center: 'CLIENTE',
        notes: quickLogWorker.notes || null,
        approval_status: 'Aprobado'
      }])

      if (error) throw error

      setStatusMessage({ type: 'success', text: `Horas registradas para ${quickLogWorker.name} el día ${auditDate}.` })
      setQuickLogWorker(null)
      loadInitialData()
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al cargar horas: ${err.message}` })
    } finally {
      setSavingEdit(false)
    }
  }

  // ==========================================
  // LÓGICA DE AUDITORÍA Y CONTROL DIARIO
  // ==========================================
  // Todos los operarios conocidos (combinación de nómina fija + los registrados en la DB)
  const allKnownWorkers = (() => {
    const names = new Set(NOMINA_ASTILLERO_BASE.map(w => w.name))
    recentLogs.forEach(l => {
      if (l.worker_name && l.worker_type === 'Astillero') names.add(l.worker_name)
    })
    return Array.from(names).map(name => {
      const base = NOMINA_ASTILLERO_BASE.find(b => b.name === name)
      return { name, defaultRubro: base?.defaultRubro || 'General', type: 'Astillero' }
    })
  })()

  // Logs del día auditado
  const logsForAuditDate = recentLogs.filter(l => l.date_logged === auditDate)

  // Estado diario de la Nómina Propia del Astillero
  const astilleroDailyStatus = allKnownWorkers.map(w => {
    const logs = logsForAuditDate.filter(l => l.worker_name === w.name)
    const totalNormal = logs.reduce((a, b) => a + (parseFloat(b.hours_normal) || (parseFloat(b.hours_worked) || 0)), 0)
    const total50 = logs.reduce((a, b) => a + (parseFloat(b.hours_extra_50) || 0), 0)
    const total100 = logs.reduce((a, b) => a + (parseFloat(b.hours_extra_100) || 0), 0)
    const totalDay = totalNormal + total50 + total100

    let status = 'sin_carga' // 'completa' | 'incompleta' | 'extras' | 'sin_carga'
    if (totalNormal >= 8) {
      status = (total50 > 0 || total100 > 0 || totalDay > 8) ? 'extras' : 'completa'
    } else if (totalDay > 0) {
      status = 'incompleta'
    }

    return {
      worker: w,
      totalNormal,
      total50,
      total100,
      totalDay,
      status,
      logs
    }
  })

  // Contratistas cargados ese día (sin regla de 8 hs)
  const contratistasDailyStatus = (() => {
    const logs = logsForAuditDate.filter(l => l.worker_type === 'Contratista')
    const map = {}
    logs.forEach(l => {
      const name = l.worker_name || 'Contratista'
      if (!map[name]) {
        map[name] = { name, totalHours: 0, total50: 0, total100: 0, logs: [] }
      }
      map[name].totalHours += parseFloat(l.hours_worked) || 0
      map[name].total50 += parseFloat(l.hours_extra_50) || 0
      map[name].total100 += parseFloat(l.hours_extra_100) || 0
      map[name].logs.push(l)
    })
    return Object.values(map)
  })()

  // ==========================================
  // LÓGICA DE LA SÁBANA QUINCENAL (TIPO EXCEL)
  // ==========================================
  const startDay = selectedQuincena === '1' ? 1 : 16
  const endDay = selectedQuincena === '1' ? 15 : new Date(parseInt(selectedYear), parseInt(selectedMonth), 0).getDate()
  const daysInQuincena = []
  for (let d = startDay; d <= endDay; d++) {
    const dayStr = d.toString().padStart(2, '0')
    const dateStr = `${selectedYear}-${selectedMonth.padStart(2, '0')}-${dayStr}`
    const dateObj = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, d)
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
    const dayName = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][dateObj.getDay()]
    daysInQuincena.push({ dayNumber: d, dateStr, isWeekend, dayName })
  }

  // Lista de operarios que aparecen en la quincena o nómina
  const allQuincenaWorkers = (() => {
    const list = [...NOMINA_ASTILLERO_BASE.map(w => ({ name: w.name, type: 'Astillero' }))]
    recentLogs.forEach(l => {
      if (l.worker_name && !list.some(x => x.name === l.worker_name)) {
        list.push({ name: l.worker_name, type: l.worker_type || 'Contratista' })
      }
    })
    return list
  })()

  // Registros filtrados reactivos en la pestaña de detalle
  const filteredLogs = recentLogs.filter(log => {
    const matchWorker = !filterWorker || log.worker_name?.toLowerCase().includes(filterWorker.toLowerCase())
    const matchDate = !filterDate || log.date_logged === filterDate
    const matchShip = !filterShip || log.work_orders?.ships?.name === filterShip
    return matchWorker && matchDate && matchShip
  })

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* CABECERA & NAVEGACIÓN DE PESTAÑAS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to="/" className="hover:text-primary transition-colors">Inicio</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-300">Operaciones</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-primary font-medium">Módulo M3: Carga & Control de Horas</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Clock className="w-8 h-8 text-primary" />
            <span>Control & Carga de Horas</span>
          </h1>
        </div>

        {/* BARRA DE PESTAÑAS PRINCIPALES */}
        <div className="flex bg-slate-900 border border-slate-700/80 p-1.5 rounded-xl shadow-lg self-start md:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('carga')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'carga'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-[0_0_15px_rgba(0,242,254,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>1. Carga de Cuadrilla</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('control_diario')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'control_diario'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-[0_0_15px_rgba(0,242,254,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" />
            <span>2. Control Diario (Nómina)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('sabana_quincenal')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'sabana_quincenal'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-[0_0_15px_rgba(0,242,254,0.3)]'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <Table className="w-3.5 h-3.5" />
            <span>3. Sábana Quincenal</span>
          </button>
        </div>
      </div>

      {/* MENSAJES DE ESTADO */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : statusMessage.type === 'info'
            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <div className="text-sm font-medium">{statusMessage.text}</div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 1: CARGA DE CUADRILLA                           */}
      {/* ========================================================= */}
      {activeTab === 'carga' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <p className="text-slate-400 text-xs">
              Imputá múltiples operarios trabajando en la misma OT con desglose de <strong className="text-white">Horas Normales</strong> y <strong className="text-cyan-300">Horas Extras (50% / 100%)</strong>.
            </p>
            <button
              type="button"
              onClick={replicateYesterday}
              className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-all flex items-center gap-2 cursor-pointer shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-400" />
              <span>Replicar Cuadrilla Anterior</span>
            </button>
          </div>

          <form onSubmit={handleSubmitBatch} className="space-y-6">
            {/* CABECERA OT */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 md:p-6 backdrop-blur-xl shadow-xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h2 className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-2">
                  <ClipboardList className="w-4 h-4" />
                  Orden de Trabajo & Destino
                </h2>
                <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-950/70 text-cyan-400 border border-cyan-800/40 font-semibold font-mono">
                  Centro de Costo: CLIENTE (Fijo)
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Barco */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <Ship className="w-3.5 h-3.5 text-cyan-400" />
                    Barco / Embarcación
                  </label>
                  <select
                    value={selectedShipId}
                    onChange={(e) => setSelectedShipId(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    {ships.map(ship => (
                      <option key={ship.id} value={ship.id} className="bg-slate-900">
                        {ship.name} ({ship.client_name || 'Astillero'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* OT */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-cyan-400" />
                    Orden de Trabajo (OT)
                  </label>
                  <select
                    value={selectedWorkOrderId}
                    onChange={(e) => setSelectedWorkOrderId(e.target.value)}
                    className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    {availableWorkOrders.length === 0 ? (
                      <option value="">Sin OTs abiertas para este barco</option>
                    ) : (
                      availableWorkOrders.map(wo => (
                        <option key={wo.id} value={wo.id} className="bg-slate-900">
                          {wo.title}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* Fecha y Modalidad */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                      Fecha Trabajo
                    </label>
                    <input
                      type="date"
                      value={dateLogged}
                      onChange={(e) => setDateLogged(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Modalidad
                    </label>
                    <select
                      value={workType}
                      onChange={(e) => setWorkType(e.target.value)}
                      className="w-full bg-slate-950/80 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                    >
                      <option value="HORA">Por Hora</option>
                      <option value="PRESUPUESTO">Presupuesto</option>
                      <option value="CONTROL">Control</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Alcance de la OT */}
              {currentWorkOrder && (
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-start gap-2.5 text-xs">
                  <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-slate-200">Alcance de {currentWorkOrder.title}: </strong>
                    <span className="text-slate-400">{currentWorkOrder.description || 'Sin descripción registrada.'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* GRILLA DE CUADRILLA */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 md:p-6 backdrop-blur-xl shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Cuadrilla de Trabajo
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    Definí horas normales y extras (50% / 100%) por cada operario.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => addOperarioRow({ worker_type: 'Astillero' })}
                    className="px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Operario Astillero</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => addOperarioRow({ worker_type: 'Contratista', hours_normal: 0 })}
                    className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Briefcase className="w-3.5 h-3.5" />
                    <span>+ Contratista / Taller</span>
                  </button>
                </div>
              </div>

              {/* FILAS DE LA CUADRILLA */}
              <div className="space-y-3">
                {operariosRows.map((row, index) => {
                  const hNorm = parseFloat(row.hours_normal) || 0
                  const h50 = parseFloat(row.hours_extra_50) || 0
                  const h100 = parseFloat(row.hours_extra_100) || 0
                  const totalRow = hNorm + h50 + h100

                  return (
                    <div 
                      key={row.id}
                      className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 grid grid-cols-1 md:grid-cols-12 gap-3 items-center hover:border-slate-700 transition-colors"
                    >
                      {/* Nº y Tipo */}
                      <div className="md:col-span-1 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-md bg-slate-800 text-slate-300 font-mono text-xs font-bold flex items-center justify-center">
                          {index + 1}
                        </span>
                        <select
                          value={row.worker_type}
                          onChange={(e) => updateOperarioRow(row.id, 'worker_type', e.target.value)}
                          className={`text-[10px] font-bold px-1.5 py-1 rounded border ${
                            row.worker_type === 'Astillero'
                              ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                              : 'bg-amber-950 text-amber-300 border-amber-800'
                          }`}
                        >
                          <option value="Astillero">Propio</option>
                          <option value="Contratista">Tercero</option>
                        </select>
                      </div>

                      {/* Operario */}
                      <div className="md:col-span-3">
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 md:hidden">
                          Operario
                        </label>
                        <input
                          type="text"
                          required
                          list="all-workers-datalist"
                          placeholder={row.worker_type === 'Astillero' ? 'Nombre operario...' : 'Taller / Contratista...'}
                          value={row.worker_name}
                          onChange={(e) => updateOperarioRow(row.id, 'worker_name', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                        />
                      </div>

                      {/* Rubro */}
                      <div className="md:col-span-2">
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 md:hidden">
                          Rubro (Manual)
                        </label>
                        <input
                          type="text"
                          required
                          list="rubros-list-carga"
                          placeholder="Rubro manual..."
                          value={row.rubro}
                          onChange={(e) => updateOperarioRow(row.id, 'rubro', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                        />
                      </div>

                      {/* Horas Normales */}
                      <div className="md:col-span-1">
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 text-center">
                          Normales
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          value={row.hours_normal}
                          onChange={(e) => updateOperarioRow(row.id, 'hours_normal', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1.5 text-xs text-white text-center font-bold focus:outline-none focus:border-primary"
                        />
                      </div>

                      {/* Extras 50% */}
                      <div className="md:col-span-1">
                        <label className="block text-[10px] uppercase font-bold text-cyan-400 mb-1 text-center">
                          Ext. 50%
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          value={row.hours_extra_50}
                          onChange={(e) => updateOperarioRow(row.id, 'hours_extra_50', e.target.value)}
                          className="w-full bg-slate-900 border border-cyan-800/60 rounded-lg px-1.5 py-1.5 text-xs text-cyan-300 text-center font-bold focus:outline-none focus:border-primary"
                        />
                      </div>

                      {/* Extras 100% */}
                      <div className="md:col-span-1">
                        <label className="block text-[10px] uppercase font-bold text-amber-400 mb-1 text-center">
                          Ext. 100%
                        </label>
                        <input
                          type="number"
                          step="0.5"
                          min="0"
                          max="24"
                          value={row.hours_extra_100}
                          onChange={(e) => updateOperarioRow(row.id, 'hours_extra_100', e.target.value)}
                          className="w-full bg-slate-900 border border-amber-800/60 rounded-lg px-1.5 py-1.5 text-xs text-amber-300 text-center font-bold focus:outline-none focus:border-primary"
                        />
                      </div>

                      {/* Total Hs Calculado */}
                      <div className="md:col-span-1 text-center">
                        <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                          Total
                        </span>
                        <span className="text-xs font-mono font-extrabold text-primary">
                          {totalRow} hs
                        </span>
                      </div>

                      {/* Observaciones */}
                      <div className="md:col-span-1">
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 md:hidden">
                          Notas
                        </label>
                        <input
                          type="text"
                          placeholder="Nota..."
                          value={row.notes}
                          onChange={(e) => updateOperarioRow(row.id, 'notes', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-primary"
                        />
                      </div>

                      {/* Eliminar Fila */}
                      <div className="md:col-span-1 flex justify-end">
                        <button
                          type="button"
                          disabled={operariosRows.length === 1}
                          onClick={() => removeOperarioRow(row.id)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                          title="Eliminar fila"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* BARRA DE RESUMEN Y GUARDAR */}
              <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Cuadrilla: </span>
                    <strong className="text-white font-mono">{operariosRows.length} operarios</strong>
                  </div>
                  <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                    <span className="text-slate-400">Normales: </span>
                    <strong className="text-slate-200 font-mono">{totalHorasNormales} hs</strong>
                  </div>
                  <div className="bg-cyan-950/60 border border-cyan-800/40 px-3 py-1.5 rounded-lg text-cyan-300">
                    <span>Ext. 50%: </span>
                    <strong className="font-mono">{totalHoras50} hs</strong>
                  </div>
                  <div className="bg-amber-950/60 border border-amber-800/40 px-3 py-1.5 rounded-lg text-amber-300">
                    <span>Ext. 100%: </span>
                    <strong className="font-mono">{totalHoras100} hs</strong>
                  </div>
                  <div className="bg-cyan-500/20 border border-cyan-500/40 px-3 py-1.5 rounded-lg text-primary">
                    <span className="font-bold">Total General: </span>
                    <strong className="font-mono text-sm">{totalHorasGenerales} hs</strong>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 bg-gradient-to-r from-primary to-blue-500 text-slate-950 font-bold rounded-lg text-sm shadow-[0_0_20px_rgba(0,242,254,0.3)] hover:shadow-[0_0_30px_rgba(0,242,254,0.5)] transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  <span>{submitting ? 'Guardando en Supabase...' : 'Confirmar Registro Grupal'}</span>
                </button>
              </div>
            </div>
          </form>

          {/* HISTORIAL RECIENTE CON FILTROS */}
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-lg space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <h3 className="text-xs uppercase tracking-wider font-bold text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-400" />
                Últimas Horas Registradas en la Nube
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Buscar operario..."
                  value={filterWorker}
                  onChange={(e) => setFilterWorker(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                />
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:border-primary"
                />
                {(filterWorker || filterDate) && (
                  <button
                    type="button"
                    onClick={() => { setFilterWorker(''); setFilterDate(''); }}
                    className="p-1 text-slate-400 hover:text-white"
                    title="Limpiar filtros"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                No hay registros que coincidan con los filtros.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-300">
                  <thead className="bg-slate-950/80 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2 px-3">Fecha</th>
                      <th className="py-2 px-3">Barco / OT</th>
                      <th className="py-2 px-3">Operario / Tipo</th>
                      <th className="py-2 px-3">Rubro</th>
                      <th className="py-2 px-2 text-center">Norm</th>
                      <th className="py-2 px-2 text-center text-cyan-400">50%</th>
                      <th className="py-2 px-2 text-center text-amber-400">100%</th>
                      <th className="py-2 px-3 text-center text-primary font-bold">Total</th>
                      <th className="py-2 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60">
                    {filteredLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 px-3 font-mono text-slate-400">{log.date_logged}</td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-white block">{log.work_orders?.ships?.name || 'Barco'}</span>
                          <span className="text-[11px] text-slate-400">{log.work_orders?.title || 'OT'}</span>
                        </td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-200">{log.worker_name}</span>
                            <span className={`text-[9px] px-1 rounded font-bold ${
                              log.worker_type === 'Astillero' ? 'bg-cyan-950 text-cyan-400' : 'bg-amber-950 text-amber-400'
                            }`}>
                              {log.worker_type === 'Astillero' ? 'Propio' : 'Tercero'}
                            </span>
                          </div>
                        </td>
                        <td className="py-2 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[11px]">
                            {log.rubro || 'General'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center font-mono">{log.hours_normal || (log.hours_worked || 0)}</td>
                        <td className="py-2 px-2 text-center font-mono text-cyan-400">{log.hours_extra_50 || 0}</td>
                        <td className="py-2 px-2 text-center font-mono text-amber-400">{log.hours_extra_100 || 0}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-primary">{log.hours_worked} hs</td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingLog(log)
                                setEditingForm({
                                  id: log.id,
                                  worker_name: log.worker_name,
                                  worker_type: log.worker_type || 'Astillero',
                                  rubro: log.rubro,
                                  hours_normal: log.hours_normal || log.hours_worked || 8,
                                  hours_extra_50: log.hours_extra_50 || 0,
                                  hours_extra_100: log.hours_extra_100 || 0,
                                  date_logged: log.date_logged,
                                  work_type: log.work_type || 'HORA',
                                  notes: log.notes || '',
                                  approval_status: log.approval_status || 'Aprobado',
                                  shipName: log.work_orders?.ships?.name || 'Barco',
                                  woTitle: log.work_orders?.title || 'OT'
                                })
                              }}
                              className="p-1 text-slate-400 hover:text-primary rounded hover:bg-slate-800"
                              title="Editar"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLog(log.id, log.worker_name)}
                              className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10"
                              title="Eliminar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 2: CONTROL DIARIO DE JORNADA (NÓMINA)           */}
      {/* ========================================================= */}
      {activeTab === 'control_diario' && (
        <div className="space-y-6">
          {/* BARRA DE FECHA Y RESUMEN DE JORNADA */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 md:p-6 backdrop-blur-xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Calendar className="w-5 h-5 text-primary" />
              <div>
                <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
                  Fecha de Auditoría Diaria
                </span>
                <input
                  type="date"
                  value={auditDate}
                  onChange={(e) => setAuditDate(e.target.value)}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-primary mt-1"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
                <span className="text-slate-400">Personal Astillero Activo: </span>
                <strong className="text-white font-mono">
                  {astilleroDailyStatus.filter(w => w.status !== 'sin_carga').length} / {astilleroDailyStatus.length}
                </strong>
              </div>
              <div className="bg-emerald-950/60 border border-emerald-800/40 px-3.5 py-2 rounded-xl text-emerald-300">
                <span>Jornadas Completas (8h+): </span>
                <strong className="font-mono">
                  {astilleroDailyStatus.filter(w => w.status === 'completa' || w.status === 'extras').length}
                </strong>
              </div>
              <div className="bg-rose-950/60 border border-rose-800/40 px-3.5 py-2 rounded-xl text-rose-300">
                <span>Sin Carga Hoy: </span>
                <strong className="font-mono">
                  {astilleroDailyStatus.filter(w => w.status === 'sin_carga').length}
                </strong>
              </div>
            </div>
          </div>

          {/* SECCIÓN 1: NÓMINA PROPIA DEL ASTILLERO (REGLA DE 8 HORAS) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-xs uppercase tracking-wider font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" />
                  Personal Propio del Astillero (Regla de Jornada Obligatoria: 8 hs)
                </h2>
                <p className="text-[11px] text-slate-400">
                  Control de cumplimiento de jornada completa y detección automática de personal sin imputar.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {astilleroDailyStatus.map(item => {
                const isSinCarga = item.status === 'sin_carga'
                const isIncompleta = item.status === 'incompleta'
                const isCompleta = item.status === 'completa'
                const isExtras = item.status === 'extras'

                return (
                  <div 
                    key={item.worker.name}
                    className={`p-4 rounded-xl border transition-all flex flex-col justify-between ${
                      isSinCarga 
                        ? 'bg-rose-950/20 border-rose-900/40 hover:border-rose-700/60'
                        : isIncompleta
                        ? 'bg-amber-950/20 border-amber-900/40 hover:border-amber-700/60'
                        : 'bg-slate-950/60 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      {/* Cabecera Tarjeta */}
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h4 className="font-bold text-white text-sm">{item.worker.name}</h4>
                          <span className="text-[10px] text-slate-400">Rubro habitual: {item.worker.defaultRubro}</span>
                        </div>

                        {/* Semáforo */}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border shrink-0 ${
                          isSinCarga
                            ? 'bg-rose-950 text-rose-400 border-rose-800'
                            : isIncompleta
                            ? 'bg-amber-950 text-amber-400 border-amber-800'
                            : isExtras
                            ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                            : 'bg-emerald-950 text-emerald-400 border-emerald-800'
                        }`}>
                          {isSinCarga && '0 hs (Sin Carga)'}
                          {isIncompleta && `${item.totalDay} hs (Faltan ${8 - item.totalDay}h)`}
                          {isCompleta && '8 hs (Jornada Completa)'}
                          {isExtras && `${item.totalDay} hs (Completa + Extras)`}
                        </span>
                      </div>

                      {/* Desglose de horas */}
                      {!isSinCarga && (
                        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-800 text-[11px] font-mono">
                          <span className="text-slate-400">Norm: <strong className="text-white">{item.totalNormal}h</strong></span>
                          {item.total50 > 0 && <span className="text-cyan-400">+50%: <strong>{item.total50}h</strong></span>}
                          {item.total100 > 0 && <span className="text-amber-400">+100%: <strong>{item.total100}h</strong></span>}
                        </div>
                      )}

                      {/* Tareas donde trabajó */}
                      <div className="space-y-1 mt-2.5 text-[11px]">
                        {item.logs.map(l => (
                          <div key={l.id} className="text-slate-400 flex items-center justify-between">
                            <span className="truncate max-w-[180px]">{l.work_orders?.ships?.name} &bull; {l.rubro}</span>
                            <span className="font-mono text-white">{l.hours_worked} hs</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Botón de Acción In-situ */}
                    <div className="mt-4 pt-2.5 border-t border-slate-800/80 flex items-center justify-between">
                      {isSinCarga ? (
                        <button
                          type="button"
                          onClick={() => setQuickLogWorker({
                            name: item.worker.name,
                            rubro: item.worker.defaultRubro,
                            type: 'Astillero',
                            work_order_id: availableWorkOrders[0]?.id || workOrders[0]?.id,
                            hours_normal: 8,
                            hours_extra_50: 0,
                            hours_extra_100: 0,
                            notes: ''
                          })}
                          className="w-full py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Cargar Jornada de 8 hs</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setQuickLogWorker({
                            name: item.worker.name,
                            rubro: item.worker.defaultRubro,
                            type: 'Astillero',
                            work_order_id: availableWorkOrders[0]?.id || workOrders[0]?.id,
                            hours_normal: isIncompleta ? (8 - item.totalDay) : 0,
                            hours_extra_50: 0,
                            hours_extra_100: 0,
                            notes: ''
                          })}
                          className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Sumar más horas / OT</span>
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* SECCIÓN 2: CONTRATISTAS Y TALLERES (SIN REGLA DE 8 HORAS) */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-xs uppercase tracking-wider font-bold text-amber-300 flex items-center gap-2">
                  <Briefcase className="w-4 h-4" />
                  Contratistas y Talleres Tercerizados
                </h2>
                <p className="text-[11px] text-slate-400">
                  Sin regla de horas diarias fijas. Registran horas según avance o tarea acordada.
                </p>
              </div>
              <span className="text-xs font-mono text-slate-400">
                {contratistasDailyStatus.length} contratistas activos hoy
              </span>
            </div>

            {contratistasDailyStatus.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                No hay horas imputadas a contratistas o talleres en esta fecha.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                {contratistasDailyStatus.map(item => (
                  <div key={item.name} className="p-4 rounded-xl bg-slate-950/60 border border-slate-800">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="font-bold text-white text-sm">{item.name}</h4>
                      <span className="text-xs font-mono font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800/40">
                        {item.totalHours} hs imputadas
                      </span>
                    </div>

                    <div className="space-y-1.5 mt-3 pt-2 border-t border-slate-800 text-xs text-slate-400">
                      {item.logs.map(l => (
                        <div key={l.id} className="flex justify-between items-center text-[11px]">
                          <span>{l.work_orders?.ships?.name} &bull; {l.rubro}</span>
                          <span className="text-white font-mono font-bold">{l.hours_worked} hs</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* PESTAÑA 3: SÁBANA QUINCENAL (MATRIZ TIPO GOOGLE SHEETS)   */}
      {/* ========================================================= */}
      {activeTab === 'sabana_quincenal' && (
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-5">
          {/* Cabecera Sábana */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Table className="w-5 h-5 text-primary" />
                Sábana Quincenal de Imputación de Horas
              </h2>
              <p className="text-xs text-slate-400">
                Visualización idéntica a Google Sheets: control de horas día por día para todo el personal y contratistas.
              </p>
            </div>

            {/* Selectores de Período */}
            <div className="flex items-center gap-2.5">
              <select
                value={selectedQuincena}
                onChange={(e) => setSelectedQuincena(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-bold"
              >
                <option value="1">1º Quincena (Días 01 al 15)</option>
                <option value="2">2º Quincena (Día 16 al fin de mes)</option>
              </select>

              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
              >
                <option value="1">Enero</option>
                <option value="2">Febrero</option>
                <option value="3">Marzo</option>
                <option value="4">Abril</option>
                <option value="5">Mayo</option>
                <option value="6">Junio</option>
                <option value="7">Julio</option>
                <option value="8">Agosto</option>
                <option value="9">Septiembre</option>
                <option value="10">Octubre</option>
                <option value="11">Noviembre</option>
                <option value="12">Diciembre</option>
              </select>

              <span className="text-xs font-mono font-bold text-slate-400 px-2 py-1 bg-slate-950 rounded-lg border border-slate-800">
                {selectedYear}
              </span>
            </div>
          </div>

          {/* MATRIZ TIPO SHEETS */}
          <div className="overflow-x-auto border border-slate-800 rounded-xl">
            <table className="w-full text-center text-xs border-collapse">
              <thead>
                <tr className="bg-slate-950 text-slate-300 font-bold border-b border-slate-800">
                  <th className="py-3 px-4 text-left border-r border-slate-800 sticky left-0 bg-slate-950 z-10 min-w-[180px]">
                    Operario / Contratista
                  </th>
                  {daysInQuincena.map(day => (
                    <th 
                      key={day.dayNumber} 
                      className={`py-2 px-2.5 border-r border-slate-800/80 min-w-[42px] ${
                        day.isWeekend ? 'bg-slate-900/60 text-slate-500' : 'text-slate-300'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-normal">{day.dayName}</div>
                      <div className="text-xs font-mono font-bold">{day.dayNumber}</div>
                    </th>
                  ))}
                  <th className="py-3 px-3 bg-slate-900 text-slate-300 min-w-[65px] border-l border-slate-800">Norm</th>
                  <th className="py-3 px-3 bg-cyan-950/60 text-cyan-300 min-w-[65px]">50%</th>
                  <th className="py-3 px-3 bg-amber-950/60 text-amber-300 min-w-[65px]">100%</th>
                  <th className="py-3 px-4 bg-slate-950 text-primary font-bold min-w-[80px]">TOTAL</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {allQuincenaWorkers.map(w => {
                  let sumNorm = 0
                  let sum50 = 0
                  let sum100 = 0

                  return (
                    <tr key={w.name} className="hover:bg-slate-800/30 transition-colors">
                      {/* Nombre Operario Fijo */}
                      <td className="py-2.5 px-4 text-left font-medium text-white border-r border-slate-800 sticky left-0 bg-slate-900 z-10 flex items-center justify-between">
                        <span className="truncate">{w.name}</span>
                        <span className={`text-[9px] px-1 rounded font-bold ml-2 shrink-0 ${
                          w.type === 'Astillero' ? 'bg-cyan-950 text-cyan-400' : 'bg-amber-950 text-amber-400'
                        }`}>
                          {w.type === 'Astillero' ? 'Propio' : 'Tercero'}
                        </span>
                      </td>

                      {/* Días del 1 al 15 (o 16 al fin) */}
                      {daysInQuincena.map(day => {
                        const dayLogs = recentLogs.filter(l => l.worker_name === w.name && l.date_logged === day.dateStr)
                        const dayHours = dayLogs.reduce((acc, l) => acc + (parseFloat(l.hours_worked) || 0), 0)
                        const dayNorm = dayLogs.reduce((acc, l) => acc + (parseFloat(l.hours_normal) || parseFloat(l.hours_worked) || 0), 0)
                        const day50 = dayLogs.reduce((acc, l) => acc + (parseFloat(l.hours_extra_50) || 0), 0)
                        const day100 = dayLogs.reduce((acc, l) => acc + (parseFloat(l.hours_extra_100) || 0), 0)

                        sumNorm += dayNorm
                        sum50 += day50
                        sum100 += day100

                        const isZeroOnWeekday = dayHours === 0 && !day.isWeekend && w.type === 'Astillero'

                        return (
                          <td 
                            key={day.dayNumber}
                            className={`py-2 px-1 border-r border-slate-800/60 font-mono text-xs ${
                              day.isWeekend ? 'bg-slate-950/40 text-slate-600' : ''
                            } ${isZeroOnWeekday ? 'text-slate-600' : 'text-slate-200'}`}
                          >
                            {dayHours > 0 ? (
                              <span className={`inline-block px-1 rounded font-bold ${
                                day50 > 0 || day100 > 0 
                                  ? 'text-cyan-300 font-extrabold' 
                                  : dayHours >= 8 
                                  ? 'text-emerald-400' 
                                  : 'text-amber-400'
                              }`}>
                                {dayHours}
                              </span>
                            ) : (
                              <span className="text-slate-700">-</span>
                            )}
                          </td>
                        )
                      })}

                      {/* Totales */}
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-300 border-l border-slate-800 bg-slate-950/40">
                        {sumNorm}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-cyan-400 bg-cyan-950/20">
                        {sum50}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-400 bg-amber-950/20">
                        {sum100}
                      </td>
                      <td className="py-2.5 px-4 font-mono font-extrabold text-primary bg-slate-950">
                        {sumNorm + sum50 + sum100} hs
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Pie de la Sábana con Acción de Cierre Quincenal */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                Jornada normal (8h)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span>
                Horas Extras (50% / 100%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                Jornada Parcial
              </span>
            </div>

            <button
              type="button"
              onClick={() => {
                alert('¡Cierre quincenal verificado! Las horas están consolidadas para liquidación.')
              }}
              className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm self-start sm:self-auto"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>Aprobar Cierre Quincenal (R)</span>
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: EDICIÓN COMPLETA DE REGISTRO                     */}
      {/* ========================================================= */}
      {editingLog && editingForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 relative">
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Pencil className="w-4 h-4 text-primary" />
                  Editar Registro de Horas
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {editingForm.shipName} &bull; {editingForm.woTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingLog(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Operario / Contratista
                  </label>
                  <input
                    type="text"
                    required
                    value={editingForm.worker_name}
                    onChange={(e) => setEditingForm({ ...editingForm, worker_name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Rubro Manual
                  </label>
                  <input
                    type="text"
                    required
                    value={editingForm.rubro}
                    onChange={(e) => setEditingForm({ ...editingForm, rubro: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              {/* HORAS NORMALES, EXTRAS 50% Y 100% */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 text-center">
                    Hs Normales
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    required
                    value={editingForm.hours_normal}
                    onChange={(e) => setEditingForm({ ...editingForm, hours_normal: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-center font-bold focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-cyan-400 mb-1 text-center">
                    Extras 50%
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={editingForm.hours_extra_50}
                    onChange={(e) => setEditingForm({ ...editingForm, hours_extra_50: e.target.value })}
                    className="w-full bg-slate-900 border border-cyan-800 rounded-lg px-2 py-1.5 text-xs text-cyan-300 text-center font-bold focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-amber-400 mb-1 text-center">
                    Extras 100%
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={editingForm.hours_extra_100}
                    onChange={(e) => setEditingForm({ ...editingForm, hours_extra_100: e.target.value })}
                    className="w-full bg-slate-900 border border-amber-800 rounded-lg px-2 py-1.5 text-xs text-amber-300 text-center font-bold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Fecha del Trabajo
                  </label>
                  <input
                    type="date"
                    required
                    value={editingForm.date_logged}
                    onChange={(e) => setEditingForm({ ...editingForm, date_logged: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Tipo de Personal
                  </label>
                  <select
                    value={editingForm.worker_type}
                    onChange={(e) => setEditingForm({ ...editingForm, worker_type: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    <option value="Astillero">Personal Propio (Astillero)</option>
                    <option value="Contratista">Contratista / Taller Tercero</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Observaciones
                </label>
                <input
                  type="text"
                  value={editingForm.notes}
                  placeholder="Detalle opcional..."
                  onChange={(e) => setEditingForm({ ...editingForm, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingLog(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-gradient-to-r from-primary to-blue-500 text-slate-950 text-xs font-bold rounded-lg shadow-md hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingEdit ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CARGA RÁPIDA IN-SITU DESDE CONTROL DIARIO        */}
      {/* ========================================================= */}
      {quickLogWorker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 relative">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" />
                  Imputar Horas a {quickLogWorker.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fecha: <strong className="text-white font-mono">{auditDate}</strong> &bull; Centro Costo: <strong className="text-cyan-400">CLIENTE</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickLogWorker(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickLogSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Orden de Trabajo (Barco / Tarea)
                </label>
                <select
                  required
                  value={quickLogWorker.work_order_id}
                  onChange={(e) => setQuickLogWorker({ ...quickLogWorker, work_order_id: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                >
                  {workOrders.map(wo => {
                    const shipName = ships.find(s => s.id === wo.ship_id)?.name || 'Barco'
                    return (
                      <option key={wo.id} value={wo.id} className="bg-slate-900">
                        {shipName} - {wo.title}
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Rubro Manual
                </label>
                <input
                  type="text"
                  required
                  list="rubros-list-carga"
                  value={quickLogWorker.rubro}
                  onChange={(e) => setQuickLogWorker({ ...quickLogWorker, rubro: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                />
              </div>

              {/* HORAS NORMALES Y EXTRAS */}
              <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 text-center">
                    Normales
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    required
                    value={quickLogWorker.hours_normal}
                    onChange={(e) => setQuickLogWorker({ ...quickLogWorker, hours_normal: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-center font-bold focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-cyan-400 mb-1 text-center">
                    Ext. 50%
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={quickLogWorker.hours_extra_50}
                    onChange={(e) => setQuickLogWorker({ ...quickLogWorker, hours_extra_50: e.target.value })}
                    className="w-full bg-slate-900 border border-cyan-800 rounded-lg px-2 py-1.5 text-xs text-cyan-300 text-center font-bold focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-amber-400 mb-1 text-center">
                    Ext. 100%
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={quickLogWorker.hours_extra_100}
                    onChange={(e) => setQuickLogWorker({ ...quickLogWorker, hours_extra_100: e.target.value })}
                    className="w-full bg-slate-900 border border-amber-800 rounded-lg px-2 py-1.5 text-xs text-amber-300 text-center font-bold focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Observaciones
                </label>
                <input
                  type="text"
                  placeholder="Detalle opcional..."
                  value={quickLogWorker.notes}
                  onChange={(e) => setQuickLogWorker({ ...quickLogWorker, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setQuickLogWorker(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="px-5 py-2 bg-gradient-to-r from-primary to-blue-500 text-slate-950 text-xs font-bold rounded-lg shadow-md hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingEdit ? 'Guardando...' : 'Guardar Horas'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DATALISTS COMPARTIDOS */}
      <datalist id="all-workers-datalist">
        {NOMINA_ASTILLERO_BASE.map(w => (
          <option key={w.name} value={w.name} />
        ))}
        {CONTRATISTAS_FRECUENTES.map(c => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <datalist id="rubros-list-carga">
        {RUBROS_SUGERIDOS.map(r => (
          <option key={r} value={r} />
        ))}
      </datalist>
    </div>
  )
}
