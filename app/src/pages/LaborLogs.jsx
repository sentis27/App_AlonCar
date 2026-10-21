import { useState, useEffect, useMemo } from 'react'
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
  Briefcase,
  Check,
  FileText
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Nómina oficial de Personal Propio del Astillero (Regla: 9 hs diarias obligatorias, salvo Feriado que son 8 hs)
const NOMINA_ASTILLERO_BASE = [
  { name: 'Rodriguez, Enzo', defaultRubro: 'Raschinear' },
  { name: 'Colonga, Franco', defaultRubro: 'Raschinear' },
  { name: 'Gari, Mario Andres', defaultRubro: 'Calderería' },
  { name: 'Georgetti, Jorge', defaultRubro: 'Mandados' },
  { name: 'Hernández, Santiago', defaultRubro: 'Maquinaria' },
  { name: 'Lescano, Alexander', defaultRubro: 'Raschinear' },
  { name: 'López, Ricardo Héctor', defaultRubro: 'Raschinear' },
  { name: 'Lorenzi, Martin', defaultRubro: 'Supervisión' },
  { name: 'Merlos, Cristian', defaultRubro: 'Mecánica' },
  { name: 'Putallaz, Leonel', defaultRubro: 'Mecánica' },
  { name: 'Maciel, Rodrigo', defaultRubro: 'Raschinear' },
  { name: 'Palotta Jara, Valentin', defaultRubro: 'Mecánica' },
  { name: 'Peralta Pablo', defaultRubro: 'Carpintería' },
  { name: 'Navarro, Matias', defaultRubro: 'Carpintería' },
  { name: 'Rancatti, Gonzalo', defaultRubro: 'Carpintería' },
  { name: 'Rodriguez, Diego', defaultRubro: 'Calderería' },
  { name: 'Rodriguez, Mariano R O', defaultRubro: 'Pañolero' },
  { name: 'Sosa, José Mauricio', defaultRubro: 'Raschinear' },
  { name: 'Sostoa Gonzalez, Higinio', defaultRubro: 'Raschinear' },
  { name: 'Caballero, Daniel Emanuel', defaultRubro: 'Calderería' },
  { name: 'Toledo, Luciano', defaultRubro: 'Calderería' },
  { name: 'Alanis, Carlos', defaultRubro: 'Raschinear' },
  { name: 'Hernandez, Jorge', defaultRubro: 'Carpintería' },
  { name: 'Gonzalez, Luciano', defaultRubro: 'Supervisión' },
  { name: 'Rancatti, Franco', defaultRubro: 'Raschinear' },
  { name: 'Caballero, Cristian', defaultRubro: 'Calderería' },
  { name: 'Salvador Alan', defaultRubro: 'Carpintería' },
  { name: 'Salvador Oscar', defaultRubro: 'Carpintería' },
  { name: 'Incorvaia, Emanuel', defaultRubro: 'Raschinear' }
]

// Talleres externos frecuentes (Grupos de Trabajo - RMO)
const TALLERES_FRECUENTES = [
  'BRUNO HRNOS',
  'CORMETAL',
  'DIVISION CORTE',
  'GARCIA TORNERIA.',
  'GPA',
  'GRILLO TORNERIA',
  'GUILLERMO GARCIA',
  'INA PANTOGRAFO',
  'INTECO',
  'JL ABREU',
  'JOAO',
  'KRANJAC',
  'LEO ZOLOA',
  'LESIN S.A',
  'MCM MECANICA',
  'NECOLOGICA',
  'PRFV DELTA',
  'RAFA',
  'RAMON ARANDA TALLER',
  'RODRIGO TORRES',
  'STI INGENIERIA',
  'TECO TALLER',
  'ULSTRUP'
]

// Contratistas frecuentes (Grupos de Trabajo en Planta - PRC)
const CONTRATISTAS_FRECUENTES = [
  '4RG SERV. INDUSTRIALES',
  'ALDO (CARPINTERO)',
  'ARENADO PUERTO',
  'ATENEO',
  'AVALOS',
  'AVALOS AYUDANTE',
  'BOLTRI',
  'CAMILO MARTINEZ',
  'CARLOS VIDONDO',
  'CHACANO',
  'DAMIAN',
  'DE ANGELIS',
  'EDUARDO FERNANDEZ',
  'ELECTRICIDAD NAVAL SA',
  'JHONNY',
  'JUAREZ JUAN',
  'LUAYZA',
  'LUAYZA MARCOS',
  'NAVAL TRONIC',
  'PINTOR JUAREZ',
  'RAMON ARANDA',
  'RAMON ARANDA AYUDANTE',
  'SEN SRL',
  'TANO',
  'TOBARES',
  'TOBARES AYUDANTE',
  'VALENCIA ARENADOR'
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
  'Fletes / Logística',
  'Feriado' // Regla Alon Car: si se indica Feriado, la jornada estándar es de 8 horas
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
  const [workItems, setWorkItems] = useState([])
  const [recentLogs, setRecentLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [statusMessage, setStatusMessage] = useState(null)

  // Cabecera de la Carga (Filtro en Cascada: 1º Barco -> 2º Contratista Habilitado -> 3º OT Habilitada en Ejecución)
  const [selectedShipId, setSelectedShipId] = useState('')
  const [selectedContractorGroup, setSelectedContractorGroup] = useState('')
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('')
  const [selectedWorkItemId, setSelectedWorkItemId] = useState('')
  const [dateLogged, setDateLogged] = useState(new Date().toISOString().split('T')[0])
  const [workType, setWorkType] = useState('HORA')
  // Centro de costo: Regla Alon Car -> SIEMPRE CLIENTE (Fijo, no configurable para evitar errores)
  const costCenter = 'CLIENTE'

  // Filas de Operarios en la Cuadrilla (Astillero regla: 9 hs normales por defecto)
  const [operariosRows, setOperariosRows] = useState([
    { 
      id: 1, 
      worker_name: '', 
      worker_type: 'Astillero', 
      rubro: '', 
      hours_normal: 9, 
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
  const [dailySearch, setDailySearch] = useState('')
  const [dailyFilterType, setDailyFilterType] = useState('todos') // 'todos' | 'Astillero' | 'Taller' | 'Contratista' | 'sin_carga' | 'incompleta' | 'completa'

  // Sábana Quincenal
  const [selectedQuincena, setSelectedQuincena] = useState('1') // '1' = 1 al 15, '2' = 16 al fin
  const [selectedMonth, setSelectedMonth] = useState('10') // Octubre
  const [selectedYear, setSelectedYear] = useState('2026')
  const [selectedQuincenaWorker, setSelectedQuincenaWorker] = useState(null) // Para inspección y ajuste 1-clic

  // Estado para Edición / Carga Rápida In-situ
  const [editingLog, setEditingLog] = useState(null)
  const [editingForm, setEditingForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)

  // Modal para Carga Rápida a Operario desde Control Diario
  const [quickLogWorker, setQuickLogWorker] = useState(null)

  // Selección múltiple para aprobación / revisión en lote
  const [selectedLogIds, setSelectedLogIds] = useState(new Set())
  const [bulkUpdating, setBulkUpdating] = useState(false)

  // Ventana / Modal de Horas que Requieren Revisión (Bandeja R y RR)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewModalFilter, setReviewModalFilter] = useState('todos') // 'todos' | 'R' | 'RR'
  const [reviewModalSearch, setReviewModalSearch] = useState('')
  const [dbWorkers, setDbWorkers] = useState([])

  // Modal interactivo para Observación / Duda de Auditoría en Estado R o Descargo RR
  const [reviewReasonModal, setReviewReasonModal] = useState({
    isOpen: false,
    logId: null,
    workerName: '',
    dateLogged: '',
    shipWo: '',
    targetStatus: 'R',
    reason: '',
    response: ''
  })

  // Cargar Barcos, OTs, Trabajos (work_items), Horas y Nómina Oficial desde Supabase
  useEffect(() => {
    loadInitialData()
  }, [])

  async function loadInitialData() {
    try {
      setLoading(true)
      const [shipsRes, wosRes, itemsRes, logsRes, workersRes] = await Promise.all([
        supabase.from('ships').select('*').order('name'),
        supabase.from('work_orders').select('*').order('ot_number'),
        supabase.from('work_items').select('*').order('created_at', { ascending: true }),
        supabase.from('labor_logs').select('*, work_orders(title, ot_number, ship_id, ships(name))').order('date_logged', { ascending: false }).limit(200),
        supabase.from('workers').select('*').order('name')
      ])

      const loadedShips = (shipsRes.data && shipsRes.data.length > 0) ? shipsRes.data : FALLBACK_SHIPS
      const loadedWos = (wosRes.data && wosRes.data.length > 0) ? wosRes.data : FALLBACK_WOS
      const loadedItems = itemsRes.data || []

      setShips(loadedShips)
      setWorkOrders(loadedWos)
      setWorkItems(loadedItems)

      if (workersRes.data && workersRes.data.length > 0) {
        setDbWorkers(workersRes.data)
      }

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

  // Mapa rápido de OTs por ID
  const woByIdMap = useMemo(() => {
    const m = {}
    workOrders.forEach(w => { m[w.id] = w })
    return m
  }, [workOrders])

  // Trabajos del barco seleccionado (separados entre "En ejecución" habilitados vs bloqueados)
  const shipWorkItemsAll = useMemo(() => {
    if (!selectedShipId) return []
    return workItems.filter(item => {
      const wo = woByIdMap[item.work_order_id]
      return wo && wo.ship_id === selectedShipId
    })
  }, [workItems, woByIdMap, selectedShipId])

  const activeWorkItemsForShip = useMemo(() => {
    return shipWorkItemsAll.filter(item => item.status === 'En ejecución')
  }, [shipWorkItemsAll])

  const blockedWorkItemsForShip = useMemo(() => {
    return shipWorkItemsAll.filter(item => item.status !== 'En ejecución')
  }, [shipWorkItemsAll])

  // PASO 2 DE LA CASCADA: Contratistas / Grupos habilitados en trabajos "En ejecución" del barco seleccionado
  const enabledContractorsForShip = useMemo(() => {
    if (!selectedShipId) return []
    const set = new Set()
    activeWorkItemsForShip.forEach(item => {
      const list = item.contractors || []
      if (list.length === 0) {
        set.add('ASTILLERO.GENERAL')
      } else {
        list.forEach(c => {
          if (c) set.add(c)
        })
      }
    })
    return Array.from(set).sort()
  }, [selectedShipId, activeWorkItemsForShip])

  // Sincronizar fila de cuadrilla según el Contratista / Grupo habilitado elegido en el Paso 2
  const syncCrewWithContractor = (newContractor) => {
    if (!newContractor) return

    const upper = newContractor.toUpperCase()
    if (upper.startsWith('ASTILLERO')) {
      let suggestedRubro = ''
      if (upper.includes('CALDERERIA')) suggestedRubro = 'Calderería'
      else if (upper.includes('RASCHINAJE')) suggestedRubro = 'Raschinear'
      else if (upper.includes('MECANICA')) suggestedRubro = 'Mecánica'
      else if (upper.includes('CARPINTERIA')) suggestedRubro = 'Carpintería naval'
      else if (upper.includes('ELECTRICIDAD')) suggestedRubro = 'Electricidad'
      else if (upper.includes('PINTURA')) suggestedRubro = 'Pintura'

      setOperariosRows(prev => {
        const onlyAstillero = prev.filter(r => r.worker_type === 'Astillero')
        if (onlyAstillero.length === 0) {
          return [
            {
              id: Date.now(),
              worker_name: '',
              worker_type: 'Astillero',
              rubro: suggestedRubro || 'General',
              hours_normal: 9,
              hours_extra_50: 0,
              hours_extra_100: 0,
              notes: ''
            }
          ]
        }
        return onlyAstillero.map(row => ({
          ...row,
          worker_type: 'Astillero',
          rubro: suggestedRubro || row.rubro || 'General'
        }))
      })
    } else {
      const isTaller =
        TALLERES_FRECUENTES.includes(newContractor) ||
        dbWorkers.some(w => w.work_group === newContractor && w.admin_center === 'TALLER')
      const targetType = isTaller ? 'Taller' : 'Contratista'
      setOperariosRows([
        {
          id: Date.now(),
          worker_name: newContractor,
          worker_type: targetType,
          rubro: isTaller ? 'Taller Externo' : 'Servicio Contratista',
          hours_normal: 8,
          hours_extra_50: 0,
          hours_extra_100: 0,
          notes: ''
        }
      ])
    }
  }

  // Sincronizar automáticamente el Contratista seleccionado al cambiar de Barco
  useEffect(() => {
    if (enabledContractorsForShip.length > 0) {
      if (!enabledContractorsForShip.includes(selectedContractorGroup)) {
        const nextContractor = enabledContractorsForShip[0]
        setSelectedContractorGroup(nextContractor)
        syncCrewWithContractor(nextContractor)
      }
    } else {
      setSelectedContractorGroup('')
    }
  }, [selectedShipId, enabledContractorsForShip])

  // PASO 3 DE LA CASCADA: Filtrar únicamente las OTs del barco donde se habilita al contratista elegido (en estado "En ejecución")
  const availableWorkOrders = useMemo(() => {
    if (!selectedShipId || !selectedContractorGroup) return []

    const matchingWoIds = new Set()
    activeWorkItemsForShip.forEach(item => {
      const list = item.contractors || []
      const isMatch =
        list.includes(selectedContractorGroup) ||
        (selectedContractorGroup === 'ASTILLERO.GENERAL' && list.length === 0)
      if (isMatch) {
        matchingWoIds.add(item.work_order_id)
      }
    })

    return workOrders.filter(wo => wo.ship_id === selectedShipId && matchingWoIds.has(wo.id))
  }, [selectedShipId, selectedContractorGroup, activeWorkItemsForShip, workOrders])

  useEffect(() => {
    if (availableWorkOrders.length > 0) {
      if (!availableWorkOrders.some(w => w.id === selectedWorkOrderId)) {
        setSelectedWorkOrderId(availableWorkOrders[0].id)
      }
    } else {
      setSelectedWorkOrderId('')
    }
  }, [selectedShipId, selectedContractorGroup, availableWorkOrders])

  // Trabajos específicos ("En ejecución") dentro de la OT seleccionada para ese contratista (DEC-016 Ayuda Memoria)
  const activeItemsForSelectedWo = useMemo(() => {
    if (!selectedWorkOrderId || !selectedContractorGroup) return []
    return activeWorkItemsForShip.filter(item => {
      if (item.work_order_id !== selectedWorkOrderId) return false
      const list = item.contractors || []
      return (
        list.includes(selectedContractorGroup) ||
        (selectedContractorGroup === 'ASTILLERO.GENERAL' && list.length === 0)
      )
    })
  }, [activeWorkItemsForShip, selectedWorkOrderId, selectedContractorGroup])

  useEffect(() => {
    if (activeItemsForSelectedWo.length > 0) {
      if (!activeItemsForSelectedWo.some(i => i.id === selectedWorkItemId)) {
        setSelectedWorkItemId(activeItemsForSelectedWo[0].id)
      }
      // Sincronizar modalidad del trabajo (HORA / PRESUPUESTO / CONTROL)
      const firstItem = activeItemsForSelectedWo[0]
      if (firstItem?.work_type) {
        setWorkType(firstItem.work_type)
      }
    } else {
      setSelectedWorkItemId('')
    }
  }, [activeItemsForSelectedWo])

  const handleContractorGroupChange = (newContractor) => {
    setSelectedContractorGroup(newContractor)
    syncCrewWithContractor(newContractor)
  }

  const currentWorkOrder = workOrders.find(wo => wo.id === selectedWorkOrderId)
  const currentWorkItem = activeItemsForSelectedWo.find(i => i.id === selectedWorkItemId) || activeItemsForSelectedWo[0] || null
  const currentShip = ships.find(s => s.id === selectedShipId)
  const isSelectedGroupAstillero = !selectedContractorGroup || selectedContractorGroup.toUpperCase().startsWith('ASTILLERO')

  // Manejo de Filas de Carga
  const addOperarioRow = (preset = {}) => {
    const isAstillero = isSelectedGroupAstillero
    const isFeriado = (preset.rubro || '').toLowerCase().includes('feriado')
    const defaultNorm = isAstillero ? (isFeriado ? 8 : 9) : 8
    const isTaller = !isAstillero && (
      TALLERES_FRECUENTES.includes(selectedContractorGroup) ||
      dbWorkers.some(w => w.work_group === selectedContractorGroup && w.admin_center === 'TALLER')
    )
    const forcedType = isAstillero ? 'Astillero' : (isTaller ? 'Taller' : 'Contratista')

    let defaultRubro = preset.rubro || ''
    if (!defaultRubro && isAstillero && selectedContractorGroup) {
      const upper = selectedContractorGroup.toUpperCase()
      if (upper.includes('CALDERERIA')) defaultRubro = 'Calderería'
      else if (upper.includes('RASCHINAJE')) defaultRubro = 'Raschinear'
      else if (upper.includes('MECANICA')) defaultRubro = 'Mecánica'
      else if (upper.includes('CARPINTERIA')) defaultRubro = 'Carpintería naval'
      else if (upper.includes('ELECTRICIDAD')) defaultRubro = 'Electricidad'
      else if (upper.includes('PINTURA')) defaultRubro = 'Pintura'
    } else if (!defaultRubro && !isAstillero) {
      defaultRubro = isTaller ? 'Taller Externo' : 'Servicio Contratista'
    }

    setOperariosRows(prev => [
      ...prev,
      { 
        id: Date.now() + Math.random(), 
        worker_name: preset.worker_name || (isAstillero ? '' : selectedContractorGroup), 
        worker_type: forcedType, 
        rubro: defaultRubro, 
        hours_normal: preset.hours_normal ?? defaultNorm, 
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
        const updated = { ...r, [field]: value }
        
        // Regla Alon Car: Si es Astillero y el rubro es Feriado -> 8 hs normales
        // Si no es feriado -> 9 hs normales
        if (field === 'rubro' && updated.worker_type === 'Astillero') {
          if (value.toLowerCase().includes('feriado')) {
            updated.hours_normal = 8
          } else if (r.rubro.toLowerCase().includes('feriado') && updated.hours_normal === 8) {
            updated.hours_normal = 9
          }
        }

        // Si cambia el tipo a Astillero
        if (field === 'worker_type') {
          if (value === 'Astillero') {
            updated.hours_normal = updated.rubro.toLowerCase().includes('feriado') ? 8 : 9
          }
        }

        return updated
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
      setStatusMessage({ type: 'error', text: 'Debe seleccionar un Contratista habilitado y una Orden de Trabajo en ejecución.' })
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
          work_item_id: currentWorkItem?.id || null,
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
        text: `¡Lote guardado! Se registraron ${operariosRows.length} operarios (${totalHorasGenerales} hs totales: ${totalHorasNormales}h normales, ${totalHoras50}h al 50%, ${totalHoras100}h al 100%) en ${currentWorkOrder?.ot_number ? `${currentWorkOrder.ot_number} - ` : ''}${currentWorkOrder?.title || 'la OT'}.` 
      })

      setOperariosRows([
        { id: Date.now(), worker_name: '', worker_type: 'Astillero', rubro: '', hours_normal: 9, hours_extra_50: 0, hours_extra_100: 0, notes: '' }
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
          work_order_id: editingForm.work_order_id,
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
          approval_status: editingForm.approval_status,
          review_reason: editingForm.review_reason || null,
          worker_response: editingForm.worker_response || null
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

  // Helper para abrir modal de edición de cualquier log
  const handleEditFromDaily = (log) => {
    const currentWo = workOrders.find(wo => wo.id === log.work_order_id)
    const currentShipId = currentWo?.ship_id || log.work_orders?.ship_id || ships[0]?.id || ''

    setEditingLog(log)
    setEditingForm({
      id: log.id,
      worker_name: log.worker_name,
      worker_type: log.worker_type || 'Astillero',
      rubro: log.rubro,
      hours_normal: log.hours_normal || log.hours_worked || 9,
      hours_extra_50: log.hours_extra_50 || 0,
      hours_extra_100: log.hours_extra_100 || 0,
      date_logged: log.date_logged,
      work_type: log.work_type || 'HORA',
      notes: log.notes || '',
      approval_status: log.approval_status || 'Aprobado',
      review_reason: log.review_reason || '',
      worker_response: log.worker_response || '',
      ship_id: currentShipId,
      work_order_id: log.work_order_id,
      shipName: log.work_orders?.ships?.name || ships.find(s => s.id === currentShipId)?.name || 'Barco',
      woTitle: log.work_orders?.title || currentWo?.title || 'OT'
    })
  }

  // Helper para actualizar estado de aprobación / revisión (S, R, RR, RRR, '') en lote o individual
  const handleUpdateApprovalStatus = async (logIds, newStatus, customReason = null, customResponse = null) => {
    const ids = Array.isArray(logIds) ? logIds : [logIds]
    if (ids.length === 0) return

    // Si es cambio individual a R y no se proveyó customReason, abrimos el modal interactivo de duda técnica
    if (newStatus === 'R' && customReason === null && ids.length === 1) {
      const targetLog = recentLogs.find(l => l.id === ids[0])
      setReviewReasonModal({
        isOpen: true,
        logId: ids[0],
        workerName: targetLog?.worker_name || 'Operario',
        dateLogged: targetLog?.date_logged || '',
        shipWo: `${targetLog?.work_orders?.ships?.name || ''} - ${targetLog?.work_orders?.title || ''}`,
        targetStatus: 'R',
        reason: targetLog?.review_reason || '',
        response: targetLog?.worker_response || ''
      })
      return
    }

    setBulkUpdating(true)
    try {
      // Actualización optimista local
      setRecentLogs(prev => prev.map(l => {
        if (!ids.includes(l.id)) return l
        const updated = { ...l, approval_status: newStatus }
        if (customReason !== null) updated.review_reason = customReason
        if (customResponse !== null) updated.worker_response = customResponse
        return updated
      }))

      const updatePayload = { approval_status: newStatus }
      if (customReason !== null) updatePayload.review_reason = customReason
      if (customResponse !== null) updatePayload.worker_response = customResponse

      const { error } = await supabase
        .from('labor_logs')
        .update(updatePayload)
        .in('id', ids)

      if (error) throw error

      setStatusMessage({ 
        type: 'success', 
        text: `Estado actualizado a "${newStatus || 'Vacío'}" en ${ids.length} imputación(es).` 
      })
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al actualizar estado: ${err.message}` })
      loadInitialData()
    } finally {
      setBulkUpdating(false)
    }
  }

  // Confirmar motivo / duda desde el modal de Estado R
  const handleConfirmReviewModal = async (e) => {
    e.preventDefault()
    if (!reviewReasonModal.logId) return

    const { logId, targetStatus, reason, response } = reviewReasonModal
    setReviewReasonModal(prev => ({ ...prev, isOpen: false }))
    await handleUpdateApprovalStatus(logId, targetStatus, reason, response)
  }

  // Toggle selección de un log individual
  const toggleSelectLog = (logId) => {
    setSelectedLogIds(prev => {
      const next = new Set(prev)
      if (next.has(logId)) {
        next.delete(logId)
      } else {
        next.add(logId)
      }
      return next
    })
  }

  // Toggle seleccionar/deseleccionar todos los logs de una lista
  const toggleSelectAllLogs = (logIds) => {
    setSelectedLogIds(prev => {
      const allSelected = logIds.length > 0 && logIds.every(id => prev.has(id))
      const next = new Set(prev)
      if (allSelected) {
        logIds.forEach(id => next.delete(id))
      } else {
        logIds.forEach(id => next.add(id))
      }
      return next
    })
  }

  // Helper para obtener las OTs habilitadas en ejecución para un operario/contratista en un barco
  const getEnabledWosForWorkerInShip = (shipId, workerName, workerType) => {
    if (!shipId) return []
    const shipWos = workOrders.filter(w => w.ship_id === shipId)
    if (workItems.length === 0) return shipWos

    const activeItems = workItems.filter(item => {
      const wo = woByIdMap[item.work_order_id]
      if (!wo || wo.ship_id !== shipId || item.status !== 'En ejecución') return false
      const list = item.contractors || []
      if ((workerType || 'Astillero') === 'Astillero') {
        return list.length === 0 || list.some(c => String(c).toUpperCase().startsWith('ASTILLERO'))
      }
      return list.includes(workerName)
    })

    const enabledWoIds = new Set(activeItems.map(i => i.work_order_id))
    return shipWos.filter(w => enabledWoIds.has(w.id))
  }

  // Helper unificado para abrir modal de carga rápida con barco y OT separados
  const openQuickLogModal = ({ name, rubro, type, hours_normal, notes, date, ship_id, work_order_id }) => {
    const resolvedType = type || 'Astillero'
    let initialShipId = ship_id
    if (!initialShipId && work_order_id) {
      const matchedWo = workOrders.find(w => w.id === work_order_id)
      if (matchedWo?.ship_id) initialShipId = matchedWo.ship_id
    }
    if (!initialShipId) {
      // Buscar el primer barco donde este operario/contratista tenga al menos 1 OT en ejecución
      const shipWithEnabledWo = ships.find(s => getEnabledWosForWorkerInShip(s.id, name, resolvedType).length > 0)
      initialShipId = shipWithEnabledWo?.id || selectedShipId || ships[0]?.id || ''
    }
    const enabledWos = getEnabledWosForWorkerInShip(initialShipId, name, resolvedType)
    const initialWoId = work_order_id || (enabledWos.length > 0 ? enabledWos[0].id : '')

    setQuickLogWorker({
      name,
      rubro: rubro || (resolvedType === 'Astillero' ? 'General' : 'Servicio'),
      type: resolvedType,
      ship_id: initialShipId,
      work_order_id: initialWoId,
      hours_normal: hours_normal ?? (resolvedType === 'Astillero' ? 9 : 0),
      hours_extra_50: 0,
      hours_extra_100: 0,
      notes: notes || '',
      date: date || auditDate
    })
  }

  // Helper para clic en celda con horas en la Sábana Quincenal
  const handleEditDayCell = (workerName, dateStr, dayLogs) => {
    if (!dayLogs || dayLogs.length === 0) return
    if (dayLogs.length === 1) {
      handleEditFromDaily(dayLogs[0])
    } else {
      setSelectedQuincenaWorker(workerName)
      setFilterDate(dateStr)
    }
  }

  // Helper para clic en celda vacía en la Sábana Quincenal
  const handleQuickAddFromSabana = (workerName, workerType, dateStr) => {
    openQuickLogModal({
      name: workerName,
      type: workerType,
      date: dateStr
    })
  }

  // Carga rápida in-situ desde Control Diario o Sábana
  const handleQuickLogSubmit = async (e) => {
    e.preventDefault()
    setSavingEdit(true)
    const targetDate = quickLogWorker.date || auditDate
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
        date_logged: targetDate,
        worker_name: quickLogWorker.name,
        worker_type: quickLogWorker.type || 'Astillero',
        rubro: quickLogWorker.rubro,
        work_type: 'HORA',
        cost_center: 'CLIENTE',
        notes: quickLogWorker.notes || null,
        approval_status: 'Aprobado'
      }])

      if (error) throw error

      setStatusMessage({ type: 'success', text: `Horas registradas para ${quickLogWorker.name} el día ${targetDate}.` })
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
  // Fuentes reactivas desde Supabase (workers) o nómina oficial de respaldo
  const astilleroSource = useMemo(() => {
    if (dbWorkers.length > 0) {
      const filtered = dbWorkers.filter(w => w.admin_center === 'ASTILLERO' && w.status === 'ACTIVO')
      if (filtered.length > 0) return filtered.map(w => ({ name: w.name, defaultRubro: w.trade || 'General' }))
    }
    return NOMINA_ASTILLERO_BASE
  }, [dbWorkers])

  const tallerSource = useMemo(() => {
    if (dbWorkers.length > 0) {
      const set = new Set(dbWorkers.filter(w => w.admin_center === 'TALLER').map(w => w.work_group))
      if (set.size > 0) return Array.from(set).sort()
    }
    return TALLERES_FRECUENTES
  }, [dbWorkers])

  const contratistaSource = useMemo(() => {
    if (dbWorkers.length > 0) {
      const set = new Set(dbWorkers.filter(w => w.admin_center === 'CONTRATISTA').map(w => w.work_group))
      if (set.size > 0) return Array.from(set).sort()
    }
    return CONTRATISTAS_FRECUENTES
  }, [dbWorkers])

  // Lista maestra de personal conocido según tipo
  const allKnownWorkers = useMemo(() => {
    const list = []
    
    // 1. Astillero
    const astilleroNames = new Set(astilleroSource.map(w => w.name))
    recentLogs.forEach(l => {
      if (l.worker_name && l.worker_type === 'Astillero') astilleroNames.add(l.worker_name)
    })
    astilleroNames.forEach(name => {
      const base = astilleroSource.find(b => b.name === name)
      list.push({ name, defaultRubro: base?.defaultRubro || 'General', type: 'Astillero' })
    })

    // 2. Talleres
    const tallerNames = new Set(tallerSource)
    recentLogs.forEach(l => {
      if (l.worker_name && l.worker_type === 'Taller') tallerNames.add(l.worker_name)
    })
    tallerNames.forEach(name => {
      list.push({ name, defaultRubro: 'Taller Externo', type: 'Taller' })
    })

    // 3. Contratistas
    const contratistaNames = new Set(contratistaSource)
    recentLogs.forEach(l => {
      if (l.worker_name && l.worker_type === 'Contratista') contratistaNames.add(l.worker_name)
    })
    contratistaNames.forEach(name => {
      list.push({ name, defaultRubro: 'Servicio Contratista', type: 'Contratista' })
    })

    return list
  }, [astilleroSource, tallerSource, contratistaSource, recentLogs])

  // Logs del día auditado
  const logsForAuditDate = recentLogs.filter(l => l.date_logged === auditDate)

  // Lista unificada para la grilla de Control Diario (Modo Lista)
  const unifiedDailyList = allKnownWorkers.map(w => {
    const logs = logsForAuditDate.filter(l => l.worker_name === w.name)
    const totalNormal = logs.reduce((a, b) => a + (parseFloat(b.hours_normal) || (parseFloat(b.hours_worked) || 0)), 0)
    const total50 = logs.reduce((a, b) => a + (parseFloat(b.hours_extra_50) || 0), 0)
    const total100 = logs.reduce((a, b) => a + (parseFloat(b.hours_extra_100) || 0), 0)
    const totalDay = totalNormal + total50 + total100

    // Regla Alon Car para Astillero:
    // Si el rubro de cualquier registro del día dice "Feriado", la jornada requerida es de 8 horas.
    // De lo contrario, la regla obligatoria es de 9 horas diarias.
    const isFeriado = logs.some(l => (l.rubro || '').toLowerCase().includes('feriado'))
    const targetHours = w.type === 'Astillero' ? (isFeriado ? 8 : 9) : null

    let status = 'sin_carga' // 'completa' | 'incompleta' | 'extras' | 'sin_carga' | 'registrado'
    if (w.type === 'Astillero') {
      if (totalDay === 0) {
        status = 'sin_carga'
      } else if (totalNormal < targetHours) {
        status = 'incompleta'
      } else if (totalNormal >= targetHours) {
        status = (total50 > 0 || total100 > 0 || totalDay > targetHours) ? 'extras' : 'completa'
      }
    } else {
      // Talleres y Contratistas no tienen regla de horas diarias
      status = totalDay > 0 ? 'registrado' : 'sin_carga'
    }

    return {
      worker: w,
      type: w.type,
      defaultRubro: w.defaultRubro,
      isFeriado,
      targetHours,
      totalNormal,
      total50,
      total100,
      totalDay,
      status,
      logs
    }
  })

  // Operarios filtrados para el Control Diario
  const filteredDailyList = unifiedDailyList.filter(item => {
    // Filtro por búsqueda
    const term = dailySearch.toLowerCase()
    const matchSearch = !term || 
      item.worker.name.toLowerCase().includes(term) || 
      item.defaultRubro.toLowerCase().includes(term) ||
      item.logs.some(l => l.rubro?.toLowerCase().includes(term) || l.work_orders?.ships?.name?.toLowerCase().includes(term))

    // Filtro por tipo o estado
    if (!matchSearch) return false
    if (dailyFilterType === 'todos') return true
    if (dailyFilterType === 'Astillero') return item.type === 'Astillero'
    if (dailyFilterType === 'Taller') return item.type === 'Taller'
    if (dailyFilterType === 'Contratista') return item.type === 'Contratista'
    if (dailyFilterType === 'sin_carga') return item.status === 'sin_carga'
    if (dailyFilterType === 'incompleta') return item.status === 'incompleta'
    if (dailyFilterType === 'completa') return item.status === 'completa' || item.status === 'extras'
    if (dailyFilterType === 'revision_R') return item.logs.some(l => l.approval_status === 'R')
    if (dailyFilterType === 'corregidas_RR') return item.logs.some(l => l.approval_status === 'RR')
    return true
  })

  // Estadísticas de la Jornada
  const astilleroWorkersList = unifiedDailyList.filter(i => i.type === 'Astillero')
  const totalAstillero = astilleroWorkersList.length
  const completasAstillero = astilleroWorkersList.filter(i => i.status === 'completa' || i.status === 'extras').length
  const incompletasAstillero = astilleroWorkersList.filter(i => i.status === 'incompleta').length
  const sinCargaAstillero = astilleroWorkersList.filter(i => i.status === 'sin_carga').length

  const totalTalleresActivos = unifiedDailyList.filter(i => i.type === 'Taller' && i.totalDay > 0).length
  const totalContratistasActivos = unifiedDailyList.filter(i => i.type === 'Contratista' && i.totalDay > 0).length

  // Métricas separadas: R (Rojo = Alerta Operario) y RR (Amarillo = Alerta Supervisor)
  const countR = recentLogs.filter(l => l.approval_status === 'R').length
  const countRR = recentLogs.filter(l => l.approval_status === 'RR').length
  const logsRequiringReview = recentLogs.filter(l => l.approval_status === 'R' || l.approval_status === 'RR')
  const reviewCount = logsRequiringReview.length

  // Imputaciones del día auditado para selección rápida
  const allAuditDateLogIds = logsForAuditDate.map(l => l.id)
  const auditDateRCount = logsForAuditDate.filter(l => l.approval_status === 'R').length
  const auditDateRRCount = logsForAuditDate.filter(l => l.approval_status === 'RR').length

  // Lista filtrada para la Ventanita / Modal de Horas que Requieren Revisión
  const filteredReviewLogs = logsRequiringReview.filter(log => {
    if (reviewModalFilter === 'R' && log.approval_status !== 'R') return false
    if (reviewModalFilter === 'RR' && log.approval_status !== 'RR') return false
    if (reviewModalSearch) {
      const term = reviewModalSearch.toLowerCase()
      const match = (log.worker_name || '').toLowerCase().includes(term) ||
        (log.rubro || '').toLowerCase().includes(term) ||
        (log.work_orders?.ships?.name || '').toLowerCase().includes(term) ||
        (log.work_orders?.title || '').toLowerCase().includes(term) ||
        (log.date_logged || '').includes(term) ||
        (log.notes || '').toLowerCase().includes(term)
      if (!match) return false
    }
    return true
  })

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

  // Lista de operarios que aparecen en la quincena o nómina (Astillero, Taller, Contratista)
  const allQuincenaWorkers = useMemo(() => {
    const map = new Map()
    
    // Primero los fijos de Astillero
    astilleroSource.forEach(w => {
      map.set(w.name, { name: w.name, type: 'Astillero' })
    })

    // Luego todos los que tienen registros en la base
    recentLogs.forEach(l => {
      if (l.worker_name && !map.has(l.worker_name)) {
        map.set(l.worker_name, { name: l.worker_name, type: l.worker_type || 'Astillero' })
      }
    })

    return Array.from(map.values())
  }, [astilleroSource, recentLogs])

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
            {/* CABECERA OT CON FILTRO EN CASCADA (1. BARCO -> 2. CONTRATISTA HABILITADO -> 3. OT EN EJECUCIÓN) */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 md:p-6 backdrop-blur-xl shadow-xl space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <h2 className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-2">
                    <ClipboardList className="w-4 h-4" />
                    Orden de Trabajo & Destino (Filtro de Habilitación en Cascada)
                  </h2>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-700/50 font-bold">
                    Solo OTs &ldquo;En ejecución&rdquo;
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {blockedWorkItemsForShip.length > 0 && (
                    <span
                      className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950/70 text-amber-300 border border-amber-800/50 font-semibold"
                      title="Trabajos en estado Pendiente de inicio, Detenido, Cancelado o Finalizado están bloqueados para recibir costos."
                    >
                      🔒 {blockedWorkItemsForShip.length} trabajo(s) bloqueado(s) en este barco
                    </span>
                  )}
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-cyan-950/70 text-cyan-400 border border-cyan-800/40 font-semibold font-mono">
                    Centro de Costo: CLIENTE (Fijo)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* PASO 1: Barco */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-bold flex items-center justify-center">
                      1
                    </span>
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

                {/* PASO 2: Contratista / Grupo Habilitado en el Barco */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center justify-center">
                      2
                    </span>
                    <Briefcase className="w-3.5 h-3.5 text-amber-400" />
                    Contratista / Grupo Habilitado
                  </label>
                  <select
                    value={selectedContractorGroup}
                    onChange={(e) => handleContractorGroupChange(e.target.value)}
                    className="w-full bg-slate-950/80 border border-amber-500/40 rounded-lg px-3 py-2 text-xs text-amber-200 font-semibold focus:outline-none focus:border-amber-400"
                  >
                    {enabledContractorsForShip.length === 0 ? (
                      <option value="">🔒 Sin contratistas habilitados (En ejecución)</option>
                    ) : (
                      enabledContractorsForShip.map(contractor => (
                        <option key={contractor} value={contractor} className="bg-slate-900 text-white">
                          {contractor}
                        </option>
                      ))
                    )}
                  </select>
                </div>

                {/* PASO 3: Orden de Trabajo (OT) donde se habilita a ese contratista */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5 flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold flex items-center justify-center">
                      3
                    </span>
                    <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
                    OT Habilitada ({availableWorkOrders.length})
                  </label>
                  <select
                    value={selectedWorkOrderId}
                    onChange={(e) => setSelectedWorkOrderId(e.target.value)}
                    className="w-full bg-slate-950/80 border border-emerald-500/40 rounded-lg px-3 py-2 text-xs text-white font-semibold focus:outline-none focus:border-emerald-400"
                  >
                    {availableWorkOrders.length === 0 ? (
                      <option value="">🔒 Sin OTs habilitadas en ejecución</option>
                    ) : (
                      availableWorkOrders.map(wo => (
                        <option key={wo.id} value={wo.id} className="bg-slate-900">
                          {wo.ot_number ? `${wo.ot_number} — ` : ''}{wo.title}
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

              {/* Si la OT tiene múltiples trabajos en ejecución para este contratista, permitir elegir cuál */}
              {activeItemsForSelectedWo.length > 1 && (
                <div className="pt-1">
                  <label className="block text-[11px] font-semibold text-cyan-300 mb-1">
                    Trabajo específico dentro de {currentWorkOrder?.ot_number || currentWorkOrder?.title} ({activeItemsForSelectedWo.length} habilitados para {selectedContractorGroup}):
                  </label>
                  <select
                    value={selectedWorkItemId}
                    onChange={(e) => setSelectedWorkItemId(e.target.value)}
                    className="w-full bg-slate-950 border border-cyan-500/40 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
                  >
                    {activeItemsForSelectedWo.map((item, idx) => (
                      <option key={item.id} value={item.id} className="bg-slate-900">
                        Trabajo #{idx + 1}: {item.description}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Alcance de la OT y Descripción del Trabajo Habilitado (DEC-016 Ayuda Memoria) */}
              {currentWorkOrder ? (
                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start gap-2.5">
                    <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <div>
                        <span className="font-mono font-bold text-emerald-300 mr-1.5">
                          [{currentWorkOrder.ot_number || 'OT'}]
                        </span>
                        <strong className="text-white">{currentWorkOrder.title}: </strong>
                        <span className="text-slate-200 font-medium">
                          {currentWorkItem?.description || currentWorkOrder.description || 'Sin descripción detallada registrada.'}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span>
                          Jefe de Obra: <strong className="text-cyan-300">{currentWorkItem?.foreman_name || currentWorkOrder.foreman_name || 'S/D'}</strong>
                        </span>
                        <span>&bull;</span>
                        <span>
                          Contratistas habilitados en este trabajo:{' '}
                          <strong className="text-amber-300">
                            {(currentWorkItem?.contractors || []).join(' / ') || selectedContractorGroup || 'Astillero'}
                          </strong>
                        </span>
                      </div>
                    </div>
                  </div>
                  <Link
                    to="/ordenes"
                    className="shrink-0 text-[11px] text-cyan-400 hover:text-cyan-300 underline font-semibold"
                  >
                    Ver en Órdenes de Trabajo &rarr;
                  </Link>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 flex items-center justify-between gap-3 text-xs text-amber-200">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      No hay Órdenes de Trabajo en estado <strong>&ldquo;En ejecución&rdquo;</strong> habilitadas para este barco/contratista. Para cargar horas, primero habilitá el contratista o pasá el trabajo a &ldquo;En ejecución&rdquo;.
                    </span>
                  </div>
                  <Link
                    to="/ordenes"
                    className="shrink-0 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 font-bold"
                  >
                    Ir a OTs
                  </Link>
                </div>
              )}
            </div>

            {/* GRILLA DE CUADRILLA */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 md:p-6 backdrop-blur-xl shadow-xl space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <h2 className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-2">
                    <Users className="w-4 h-4" />
                    Cuadrilla de Trabajo — {selectedContractorGroup || 'Sin contratista habilitado'}
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {isSelectedGroupAstillero
                      ? 'Seleccioná los operarios del Astillero habilitados y definí horas normales y extras (50% / 100%).'
                      : `Imputación restringida exclusivamente a ${selectedContractorGroup} según habilitación de la OT.`}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {isSelectedGroupAstillero ? (
                    <button
                      type="button"
                      disabled={!selectedWorkOrderId}
                      onClick={() => addOperarioRow({ worker_type: 'Astillero' })}
                      className="px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Operario Astillero (9h)</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={!selectedWorkOrderId}
                      onClick={() => addOperarioRow({ worker_name: selectedContractorGroup, hours_normal: 8 })}
                      className="px-3 py-1.5 bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-40"
                    >
                      <Briefcase className="w-3.5 h-3.5" />
                      <span>+ Fila {selectedContractorGroup}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* FILAS DE LA CUADRILLA */}
              <div className="overflow-x-auto pb-1">
                <div className="min-w-[960px] space-y-2.5">
                  {/* Encabezado fijo en escritorio */}
                  <div className="grid grid-cols-[125px_minmax(180px,1.5fr)_minmax(140px,1.2fr)_75px_75px_75px_65px_minmax(130px,1fr)_40px] gap-2.5 px-3.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <div>Tipo</div>
                    <div>Operario / Prestador Habilitado</div>
                    <div>Rubro (Manual)</div>
                    <div className="text-center">Normales</div>
                    <div className="text-center text-cyan-400">Ext. 50%</div>
                    <div className="text-center text-amber-400">Ext. 100%</div>
                    <div className="text-center text-primary">Total</div>
                    <div>Observaciones</div>
                    <div className="text-center"></div>
                  </div>

                  {operariosRows.map((row, index) => {
                    const hNorm = parseFloat(row.hours_normal) || 0
                    const h50 = parseFloat(row.hours_extra_50) || 0
                    const h100 = parseFloat(row.hours_extra_100) || 0
                    const totalRow = hNorm + h50 + h100

                    return (
                      <div 
                        key={row.id}
                        className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 grid grid-cols-[125px_minmax(180px,1.5fr)_minmax(140px,1.2fr)_75px_75px_75px_65px_minmax(130px,1fr)_40px] gap-2.5 items-center hover:border-slate-700 transition-colors"
                      >
                        {/* Nº y Tipo (Bloqueado según el grupo habilitado en Paso 2) */}
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="w-5 h-5 shrink-0 rounded bg-slate-800 text-slate-300 font-mono text-[11px] font-bold flex items-center justify-center">
                            {index + 1}
                          </span>
                          <span
                            className={`w-[96px] text-[10px] font-bold px-2 py-1.5 rounded border text-center truncate ${
                              row.worker_type === 'Astillero'
                                ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                                : row.worker_type === 'Taller'
                                ? 'bg-purple-950 text-purple-300 border-purple-800'
                                : 'bg-amber-950 text-amber-300 border-amber-800'
                            }`}
                            title="Definido por el Contratista / Grupo habilitado elegido en el Paso 2"
                          >
                            {row.worker_type}
                          </span>
                        </div>

                        {/* Operario (Filtrado estrictamente por el Contratista / Grupo habilitado en Paso 2) */}
                        <div>
                          {isSelectedGroupAstillero ? (
                            <select
                              required
                              value={row.worker_name}
                              onChange={(e) => {
                                const val = e.target.value
                                updateOperarioRow(row.id, 'worker_name', val)
                                const found = astilleroSource.find(w => w.name === val)
                                if (found && !row.rubro) {
                                  updateOperarioRow(row.id, 'rubro', found.defaultRubro)
                                }
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
                            >
                              <option value="">
                                -- Seleccionar operario de {selectedContractorGroup || 'Astillero'} --
                              </option>
                              {(() => {
                                const upperGroup = (selectedContractorGroup || '').toUpperCase()
                                const tradeKey = upperGroup.includes('.') ? upperGroup.split('.')[1] : ''
                                const normalize = (s) =>
                                  String(s || '')
                                    .normalize('NFD')
                                    .replace(/[\u0300-\u036f]/g, '')
                                    .toUpperCase()
                                const matchingWorkers = tradeKey
                                  ? astilleroSource.filter(w => {
                                      const r = normalize(w.defaultRubro)
                                      if (tradeKey === 'RASCHINAJE') return r.includes('RASCHIN')
                                      return r.includes(tradeKey)
                                    })
                                  : astilleroSource
                                const listToRender = matchingWorkers.length > 0 ? matchingWorkers : astilleroSource
                                return listToRender.map(w => (
                                  <option key={w.name} value={w.name} className="bg-slate-900">
                                    {w.name} ({w.defaultRubro})
                                  </option>
                                ))
                              })()}
                            </select>
                          ) : (
                            <select
                              required
                              value={row.worker_name}
                              onChange={(e) => updateOperarioRow(row.id, 'worker_name', e.target.value)}
                              className="w-full bg-slate-900 border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-xs text-amber-200 font-bold focus:outline-none focus:border-amber-400"
                            >
                              <option value={selectedContractorGroup}>{selectedContractorGroup}</option>
                              {allKnownWorkers
                                .filter(
                                  w =>
                                    w.name !== selectedContractorGroup &&
                                    w.name.toUpperCase().startsWith(selectedContractorGroup.toUpperCase() + ' ')
                                )
                                .map(w => (
                                  <option key={w.name} value={w.name} className="bg-slate-900">
                                    {w.name}
                                  </option>
                                ))}
                            </select>
                          )}
                        </div>

                        {/* Rubro */}
                        <div>
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
                        <div>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="24"
                            value={row.hours_normal}
                            onChange={(e) => updateOperarioRow(row.id, 'hours_normal', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1.5 text-xs text-white text-center font-bold focus:outline-none focus:border-primary font-mono"
                          />
                        </div>

                        {/* Extras 50% */}
                        <div>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="24"
                            value={row.hours_extra_50}
                            onChange={(e) => updateOperarioRow(row.id, 'hours_extra_50', e.target.value)}
                            className="w-full bg-slate-900 border border-cyan-800/60 rounded-lg px-1.5 py-1.5 text-xs text-cyan-300 text-center font-bold focus:outline-none focus:border-primary font-mono"
                          />
                        </div>

                        {/* Extras 100% */}
                        <div>
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            max="24"
                            value={row.hours_extra_100}
                            onChange={(e) => updateOperarioRow(row.id, 'hours_extra_100', e.target.value)}
                            className="w-full bg-slate-900 border border-amber-800/60 rounded-lg px-1.5 py-1.5 text-xs text-amber-300 text-center font-bold focus:outline-none focus:border-primary font-mono"
                          />
                        </div>

                        {/* Total Hs Calculado */}
                        <div className="text-center font-mono font-extrabold text-primary text-xs bg-slate-900/80 py-1.5 rounded-lg border border-slate-800">
                          {totalRow} hs
                        </div>

                        {/* Observaciones */}
                        <div>
                          <input
                            type="text"
                            placeholder="Nota opcional..."
                            value={row.notes}
                            onChange={(e) => updateOperarioRow(row.id, 'notes', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-primary"
                          />
                        </div>

                        {/* Eliminar Fila */}
                        <div className="flex justify-center">
                          <button
                            type="button"
                            disabled={operariosRows.length === 1}
                            onClick={() => removeOperarioRow(row.id)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed transition-colors rounded hover:bg-rose-500/10 cursor-pointer"
                            title="Eliminar fila"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
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
                      <th className="py-2 px-2 text-center">Estado</th>
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
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                              log.worker_type === 'Astillero' 
                                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60' 
                                : log.worker_type === 'Taller'
                                ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                                : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                            }`}>
                              {log.worker_type || 'Astillero'}
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
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <select
                              value={log.approval_status || ''}
                              onChange={(e) => handleUpdateApprovalStatus(log.id, e.target.value)}
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer focus:outline-none ${
                                log.approval_status === 'S' || log.approval_status === 'Aprobado'
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                  : log.approval_status === 'R'
                                  ? 'bg-rose-950 text-rose-300 border-rose-500 shadow-sm shadow-rose-900/50'
                                  : log.approval_status === 'RR'
                                  ? 'bg-amber-950 text-amber-300 border-amber-500'
                                  : log.approval_status === 'RRR'
                                  ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                                  : 'bg-slate-900 text-slate-400 border-slate-700'
                              }`}
                              title={`Estado de revisión de ${log.worker_name}`}
                            >
                              <option value="">-</option>
                              <option value="S">S (Aprobado)</option>
                              <option value="R">R (Revisión)</option>
                              <option value="RR">RR (Corregido)</option>
                              <option value="RRR">RRR (Aprobado Fin)</option>
                            </select>
                            {log.review_reason && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewReasonModal({
                                    isOpen: true,
                                    logId: log.id,
                                    workerName: log.worker_name,
                                    dateLogged: log.date_logged,
                                    shipWo: `${log.work_orders?.ships?.name || ''} - ${log.work_orders?.title || ''}`,
                                    targetStatus: log.approval_status || 'R',
                                    reason: log.review_reason || '',
                                    response: log.worker_response || ''
                                  })
                                }}
                                className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-900/40 transition-colors"
                                title={`Motivo de observación (R): ${log.review_reason}`}
                              >
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditFromDaily(log)}
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
      {/* PESTAÑA 2: CONTROL DIARIO DE JORNADA (MODO LISTA)         */}
      {/* ========================================================= */}
      {activeTab === 'control_diario' && (
        <div className="space-y-6">
          {/* BARRA DE FECHA Y RESUMEN KPI */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 md:p-6 backdrop-blur-xl shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-primary" />
                <div>
                  <span className="text-[11px] uppercase tracking-wider text-slate-400 font-bold block">
                    Fecha de Auditoría
                  </span>
                  <input
                    type="date"
                    value={auditDate}
                    onChange={(e) => setAuditDate(e.target.value)}
                    className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-sm font-bold text-white focus:outline-none focus:border-primary mt-1"
                  />
                </div>
              </div>

              {/* Botón rápido Hoy */}
              <button
                type="button"
                onClick={() => setAuditDate(new Date().toISOString().split('T')[0])}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 rounded-lg border border-slate-700 mt-4 sm:mt-0 cursor-pointer"
              >
                Ir a Hoy
              </button>
            </div>

            {/* KPIs Rápidos y Botones de Revisión Separados */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {/* Botón 1 (Rojo): HORAS QUE REQUIEREN REVISIÓN (Alerta Operario) */}
              <button
                type="button"
                onClick={() => {
                  setReviewModalFilter('R')
                  setShowReviewModal(true)
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-sm ${
                  countR > 0
                    ? 'bg-rose-950/90 hover:bg-rose-900 text-rose-200 border-rose-500 shadow-rose-900/40'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-slate-800'
                }`}
                title="Horas observadas por el supervisor que el operario debe corregir (Alerta Operario)"
              >
                <span className={`px-1.5 py-0.5 rounded-md text-xs font-mono font-extrabold ${
                  countR > 0 ? 'bg-rose-600 text-white animate-pulse' : 'bg-slate-800 text-slate-400'
                }`}>
                  {countR}
                </span>
                <span className="underline decoration-rose-500 underline-offset-4 tracking-wide font-extrabold text-[11px]">
                  REQUIEREN REVISIÓN (R)
                </span>
              </button>

              {/* Botón 2 (Amarillo): HORAS CORREGIDAS (Alerta Supervisor) */}
              <button
                type="button"
                onClick={() => {
                  setReviewModalFilter('RR')
                  setShowReviewModal(true)
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-sm ${
                  countRR > 0
                    ? 'bg-amber-950/90 hover:bg-amber-900 text-amber-200 border-amber-500 shadow-amber-900/40'
                    : 'bg-slate-950 hover:bg-slate-800 text-slate-400 border-slate-800'
                }`}
                title="Horas corregidas por el operario esperando visto bueno final del supervisor (Alerta Supervisor)"
              >
                <span className={`px-1.5 py-0.5 rounded-md text-xs font-mono font-extrabold ${
                  countRR > 0 ? 'bg-amber-500 text-slate-950 font-black animate-pulse' : 'bg-slate-800 text-slate-400'
                }`}>
                  {countRR}
                </span>
                <span className="underline decoration-amber-500 underline-offset-4 tracking-wide font-extrabold text-[11px]">
                  HORAS CORREGIDAS (RR)
                </span>
              </button>

              <div className="bg-slate-950 px-3.5 py-2 rounded-xl border border-slate-800">
                <span className="text-slate-400">Nómina Astillero: </span>
                <strong className="text-white font-mono">{totalAstillero}</strong>
              </div>
              <div className="bg-emerald-950/60 border border-emerald-800/40 px-3.5 py-2 rounded-xl text-emerald-300">
                <span>Completas (9h / 8h Feriado): </span>
                <strong className="font-mono">{completasAstillero}</strong>
              </div>
              <div className="bg-amber-950/60 border border-amber-800/40 px-3.5 py-2 rounded-xl text-amber-300">
                <span>Incompletas: </span>
                <strong className="font-mono">{incompletasAstillero}</strong>
              </div>
              <div className="bg-rose-950/60 border border-rose-800/40 px-3.5 py-2 rounded-xl text-rose-300">
                <span>Sin Carga: </span>
                <strong className="font-mono">{sinCargaAstillero}</strong>
              </div>
              <div className="bg-purple-950/60 border border-purple-800/40 px-3.5 py-2 rounded-xl text-purple-300">
                <span>Talleres / Terceros: </span>
                <strong className="font-mono">{totalTalleresActivos + totalContratistasActivos}</strong>
              </div>
            </div>
          </div>

          {/* TABLA PRINCIPAL DE CONTROL DIARIO EN MODO LISTA */}
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
            {/* BARRA DE FILTROS & BÚSQUEDA */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-sm uppercase tracking-wider font-bold text-white flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-cyan-400" />
                  Nómina Diaria en Modo Lista
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Regla Astillero: <strong>9 hs obligatorias</strong> (salvo Feriado = <strong>8 hs</strong>). Talleres y Contratistas no tienen regla de cuota diaria.
                </p>
              </div>

              {/* Input de Búsqueda */}
              <div className="relative min-w-[260px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar operario, taller, rubro..."
                  value={dailySearch}
                  onChange={(e) => setDailySearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                />
                {dailySearch && (
                  <button
                    type="button"
                    onClick={() => setDailySearch('')}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* BOTONES / PESTAÑAS DE FILTRO RÁPIDO */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                type="button"
                onClick={() => setDailyFilterType('todos')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  dailyFilterType === 'todos'
                    ? 'bg-primary text-slate-950 font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Todos ({unifiedDailyList.length})
              </button>
              <button
                type="button"
                onClick={() => setDailyFilterType('Astillero')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  dailyFilterType === 'Astillero'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Astillero ({totalAstillero})
              </button>
              <button
                type="button"
                onClick={() => setDailyFilterType('Taller')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  dailyFilterType === 'Taller'
                    ? 'bg-purple-500 text-slate-950 font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Talleres ({unifiedDailyList.filter(i => i.type === 'Taller').length})
              </button>
              <button
                type="button"
                onClick={() => setDailyFilterType('Contratista')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  dailyFilterType === 'Contratista'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Contratistas ({unifiedDailyList.filter(i => i.type === 'Contratista').length})
              </button>
              <button
                type="button"
                onClick={() => setDailyFilterType('sin_carga')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  dailyFilterType === 'sin_carga'
                    ? 'bg-rose-500 text-white font-bold'
                    : 'bg-slate-950 text-rose-400 hover:text-rose-300 border border-rose-900/40'
                }`}
              >
                Sin Carga 🔴 ({sinCargaAstillero})
              </button>
              <button
                type="button"
                onClick={() => setDailyFilterType('incompleta')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  dailyFilterType === 'incompleta'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-950 text-amber-400 hover:text-amber-300 border border-amber-900/40'
                }`}
              >
                Incompletas 🟡 ({incompletasAstillero})
              </button>
              <button
                type="button"
                onClick={() => setDailyFilterType('completa')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  dailyFilterType === 'completa'
                    ? 'bg-emerald-500 text-slate-950 font-bold'
                    : 'bg-slate-950 text-emerald-400 hover:text-emerald-300 border border-emerald-900/40'
                }`}
              >
                Completas 🟢 ({completasAstillero})
              </button>
              <button
                type="button"
                onClick={() => setDailyFilterType('revision_R')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  dailyFilterType === 'revision_R'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'bg-slate-950 text-rose-400 hover:text-rose-300 border border-rose-900/40'
                }`}
              >
                🔴 En Revisión R ({auditDateRCount})
              </button>
              <button
                type="button"
                onClick={() => setDailyFilterType('corregidas_RR')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  dailyFilterType === 'corregidas_RR'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-950 text-amber-400 hover:text-amber-300 border border-amber-900/40'
                }`}
              >
                🟡 Corregidas RR ({auditDateRRCount})
              </button>
            </div>

            {/* TABLA DE AUDITORÍA */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-2 text-center w-8">
                      <input
                        type="checkbox"
                        checked={allAuditDateLogIds.length > 0 && allAuditDateLogIds.every(id => selectedLogIds.has(id))}
                        onChange={() => toggleSelectAllLogs(allAuditDateLogIds)}
                        disabled={allAuditDateLogIds.length === 0}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary disabled:opacity-30"
                        title="Seleccionar todas las imputaciones del día"
                      />
                    </th>
                    <th className="py-2.5 px-2 min-w-[95px]">Aprobación</th>
                    <th className="py-2.5 px-3">Estado / Semáforo</th>
                    <th className="py-2.5 px-3">Operario / Taller</th>
                    <th className="py-2.5 px-2">Tipo</th>
                    <th className="py-2.5 px-3">Imputación (Barco & OT)</th>
                    <th className="py-2.5 px-3">Rubro(s)</th>
                    <th className="py-2.5 px-2 text-center">Norm</th>
                    <th className="py-2.5 px-2 text-center text-cyan-400">50%</th>
                    <th className="py-2.5 px-2 text-center text-amber-400">100%</th>
                    <th className="py-2.5 px-3 text-center text-primary font-bold">Total Día</th>
                    <th className="py-2.5 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredDailyList.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="py-8 text-center text-slate-500">
                        No se encontraron registros para los filtros seleccionados.
                      </td>
                    </tr>
                  ) : (
                    filteredDailyList.map(item => {
                      const isAstillero = item.type === 'Astillero'
                      const isSinCarga = item.status === 'sin_carga'
                      const isIncompleta = item.status === 'incompleta'
                      const isCompleta = item.status === 'completa'
                      const isExtras = item.status === 'extras'

                      return (
                        <tr 
                          key={`${item.worker.name}-${item.type}`} 
                          className={`hover:bg-slate-800/30 transition-colors ${
                            isSinCarga ? 'bg-rose-950/10' : isIncompleta ? 'bg-amber-950/10' : ''
                          }`}
                        >
                          {/* Checkbox Selección */}
                          <td className="py-2.5 px-2 text-center align-top">
                            {item.logs.length === 0 ? (
                              <span className="text-slate-700 text-xs">-</span>
                            ) : (
                              <div className="space-y-2 py-0.5">
                                {item.logs.map(log => (
                                  <div key={log.id} className="h-6 flex items-center justify-center">
                                    <input
                                      type="checkbox"
                                      checked={selectedLogIds.has(log.id)}
                                      onChange={() => toggleSelectLog(log.id)}
                                      className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary"
                                      title={`Seleccionar ${log.work_orders?.ships?.name} - ${log.work_orders?.title}`}
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Casilla de Aprobación Legacy (S, R, RR, RRR, '') */}
                          <td className="py-2.5 px-2 align-top">
                            {item.logs.length === 0 ? (
                              <span className="text-slate-700 text-xs">-</span>
                            ) : (
                              <div className="space-y-2 py-0.5">
                                {item.logs.map(log => {
                                  const status = log.approval_status || ''
                                  const isS = status === 'S' || status === 'Aprobado'
                                  const isR = status === 'R'
                                  const isRR = status === 'RR'
                                  const isRRR = status === 'RRR'

                                  return (
                                    <div key={log.id} className="h-6 flex items-center">
                                      <select
                                        value={status}
                                        onChange={(e) => handleUpdateApprovalStatus(log.id, e.target.value)}
                                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer focus:outline-none ${
                                          isS
                                            ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                            : isR
                                            ? 'bg-rose-950 text-rose-300 border-rose-500 shadow-sm shadow-rose-900/50'
                                            : isRR
                                            ? 'bg-amber-950 text-amber-300 border-amber-500'
                                            : isRRR
                                            ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                                            : 'bg-slate-900 text-slate-400 border-slate-700'
                                        }`}
                                        title={`Estado de aprobación de ${log.work_orders?.title}`}
                                      >
                                        <option value="" className="bg-slate-900 text-slate-400">-</option>
                                        <option value="S" className="bg-slate-900 text-emerald-400 font-bold">S (Aprobado)</option>
                                        <option value="R" className="bg-slate-900 text-rose-400 font-bold">R (Revisión)</option>
                                        <option value="RR" className="bg-slate-900 text-amber-400 font-bold">RR (Corregido)</option>
                                        <option value="RRR" className="bg-slate-900 text-cyan-400 font-bold">RRR (Aprobado Fin)</option>
                                      </select>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </td>

                          {/* Semáforo */}
                          <td className="py-2.5 px-3 align-top">
                            {isAstillero ? (
                              <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                                isSinCarga
                                  ? 'bg-rose-950 text-rose-300 border-rose-800/80'
                                  : isIncompleta
                                  ? 'bg-amber-950 text-amber-300 border-amber-800/80'
                                  : isExtras
                                  ? 'bg-cyan-950 text-cyan-300 border-cyan-800/80'
                                  : 'bg-emerald-950 text-emerald-300 border-emerald-800/80'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  isSinCarga ? 'bg-rose-400 animate-pulse' : isIncompleta ? 'bg-amber-400' : isExtras ? 'bg-cyan-400' : 'bg-emerald-400'
                                }`}></span>
                                {isSinCarga && '0 hs (Sin Carga)'}
                                {isIncompleta && `${item.totalDay}h (Faltan ${item.targetHours - item.totalDay}h)`}
                                {isCompleta && `${item.targetHours}h (Jornada Completa)`}
                                {isExtras && `${item.totalDay}h (Completa + Extras)`}
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-900 text-slate-300 border border-slate-800">
                                {item.totalDay > 0 ? `${item.totalDay} hs imputadas` : 'Sin actividad hoy'}
                              </span>
                            )}
                          </td>

                          {/* Operario */}
                          <td className="py-2.5 px-3 align-top">
                            <span className="font-bold text-white block">{item.worker.name}</span>
                            <span className="text-[10px] text-slate-400">Habitual: {item.defaultRubro}</span>
                          </td>

                          {/* Tipo */}
                          <td className="py-2.5 px-2 align-top">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                              item.type === 'Astillero'
                                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60'
                                : item.type === 'Taller'
                                ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                                : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                            }`}>
                              {item.type}
                            </span>
                          </td>

                          {/* Imputación OT */}
                          <td className="py-2.5 px-3 align-top">
                            {item.logs.length === 0 ? (
                              <span className="text-slate-500 italic text-[11px]">Sin imputación</span>
                            ) : (
                              <div className="space-y-2 py-0.5">
                                {item.logs.map(l => (
                                  <div key={l.id} className="h-6 flex items-center text-[11px] truncate max-w-[220px]" title={`${l.work_orders?.ships?.name}: ${l.work_orders?.title} (${l.hours_worked || l.hours_normal || 0} hs)`}>
                                    <strong className="text-white mr-1">{l.work_orders?.ships?.name}:</strong>
                                    <span className="text-slate-300 truncate">{l.work_orders?.title}</span>
                                    {item.logs.length > 1 && (
                                      <span className="ml-1 text-[10px] text-cyan-400 font-mono font-bold shrink-0">
                                        ({l.hours_worked || l.hours_normal || 0}h)
                                      </span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Rubro(s) */}
                          <td className="py-2.5 px-3 align-top">
                            {item.logs.length === 0 ? (
                              <span className="text-slate-600 text-[11px]">-</span>
                            ) : (
                              <div className="space-y-2 py-0.5">
                                {item.logs.map(l => {
                                  const isLogFeriado = (l.rubro || '').toLowerCase().includes('feriado')
                                  return (
                                    <div key={l.id} className="h-6 flex items-center">
                                      <span 
                                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[130px] ${
                                          isLogFeriado 
                                            ? 'bg-amber-950 text-amber-300 border border-amber-700/80 font-bold' 
                                            : 'bg-slate-800 text-slate-300'
                                        }`}
                                        title={l.rubro || 'General'}
                                      >
                                        {l.rubro || 'General'}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            )}
                          </td>

                          {/* Horas Normales */}
                          <td className="py-2.5 px-2 text-center font-mono align-top">
                            {item.totalNormal > 0 ? (
                              <span>
                                {item.totalNormal}
                                {item.targetHours && <span className="text-slate-500 text-[10px]">/{item.targetHours}h</span>}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>

                          {/* 50% */}
                          <td className="py-2.5 px-2 text-center font-mono text-cyan-400 align-top">
                            {item.total50 > 0 ? item.total50 : <span className="text-slate-600">-</span>}
                          </td>

                          {/* 100% */}
                          <td className="py-2.5 px-2 text-center font-mono text-amber-400 align-top">
                            {item.total100 > 0 ? item.total100 : <span className="text-slate-600">-</span>}
                          </td>

                          {/* Total Día */}
                          <td className="py-2.5 px-3 text-center font-mono font-bold text-primary align-top">
                            {item.totalDay > 0 ? `${item.totalDay} hs` : <span className="text-slate-600">0 hs</span>}
                          </td>

                          {/* Acciones */}
                          <td className="py-2.5 px-3 text-right align-top">
                            {isSinCarga ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => openQuickLogModal({
                                    name: item.worker.name,
                                    rubro: item.defaultRubro,
                                    type: item.type,
                                    hours_normal: isAstillero ? 9 : 0,
                                    date: auditDate
                                  })}
                                  className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                  title="Cargar jornada habitual (9h)"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>+ Cargar {isAstillero ? '9h' : 'Horas'}</span>
                                </button>

                                {isAstillero && (
                                  <button
                                    type="button"
                                    onClick={() => openQuickLogModal({
                                      name: item.worker.name,
                                      rubro: 'Feriado',
                                      type: 'Astillero',
                                      hours_normal: 8,
                                      notes: 'Jornada de Feriado',
                                      date: auditDate
                                    })}
                                    className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                    title="Cargar como Feriado (8h)"
                                  >
                                    <span>Feriado 8h</span>
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="space-y-2 py-0.5">
                                {item.logs.map((log, idx) => (
                                  <div key={log.id} className="h-6 flex items-center justify-end gap-1">
                                    <button
                                      type="button"
                                      onClick={() => handleEditFromDaily(log)}
                                      className="p-1 text-slate-400 hover:text-primary rounded hover:bg-slate-800 transition-colors cursor-pointer"
                                      title={`Editar imputación en ${log.work_orders?.ships?.name}`}
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>

                                    {idx === item.logs.length - 1 && (
                                      <button
                                        type="button"
                                        onClick={() => openQuickLogModal({
                                          name: item.worker.name,
                                          rubro: item.defaultRubro,
                                          type: item.type,
                                          hours_normal: isIncompleta ? (item.targetHours - item.totalDay) : 0,
                                          date: auditDate
                                        })}
                                        className="p-1 text-slate-400 hover:text-cyan-300 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                                        title="Sumar más horas u otra OT"
                                      >
                                        <Plus className="w-3.5 h-3.5" />
                                      </button>
                                    )}

                                    {item.logs.length === 1 && (
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteLog(item.logs[0].id, item.worker.name)}
                                        className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                                        title="Eliminar registro"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </div>
                                ))}
                              </div>
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
                      {/* Nombre Operario Fijo con acción de filtrado/inspección */}
                      <td className="py-2.5 px-3 text-left font-medium border-r border-slate-800 sticky left-0 bg-slate-900 z-10">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedQuincenaWorker(w.name === selectedQuincenaWorker ? null : w.name)
                            const el = document.getElementById('quincena-inspector-section')
                            if (el) el.scrollIntoView({ behavior: 'smooth' })
                          }}
                          className={`text-left font-bold flex items-center justify-between w-full group transition-colors cursor-pointer ${
                            selectedQuincenaWorker === w.name ? 'text-primary' : 'text-slate-200 hover:text-cyan-300'
                          }`}
                          title="Clic para ver y editar todas las horas de este operario"
                        >
                          <span className="truncate max-w-[120px]">{w.name}</span>
                          <span className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                              w.type === 'Astillero'
                                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60'
                                : w.type === 'Taller'
                                ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                                : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                            }`}>
                              {w.type}
                            </span>
                            <Pencil className="w-3 h-3 opacity-40 group-hover:opacity-100 text-cyan-400 transition-opacity" />
                          </span>
                        </button>
                      </td>

                      {/* Días del 1 al 15 (o 16 al fin) con clic interactivo para editar celda */}
                      {daysInQuincena.map(day => {
                        const dayLogs = recentLogs.filter(l => l.worker_name === w.name && l.date_logged === day.dateStr)
                        const dayHours = dayLogs.reduce((acc, l) => acc + (parseFloat(l.hours_worked) || 0), 0)
                        const dayNorm = dayLogs.reduce((acc, l) => acc + (parseFloat(l.hours_normal) || parseFloat(l.hours_worked) || 0), 0)
                        const day50 = dayLogs.reduce((acc, l) => acc + (parseFloat(l.hours_extra_50) || 0), 0)
                        const day100 = dayLogs.reduce((acc, l) => acc + (parseFloat(l.hours_extra_100) || 0), 0)
                        const hasFeriado = dayLogs.some(l => (l.rubro || '').toLowerCase().includes('feriado'))
                        const target = hasFeriado ? 8 : 9
                        const hasR = dayLogs.some(l => l.approval_status === 'R')
                        const hasRR = dayLogs.some(l => l.approval_status === 'RR')

                        sumNorm += dayNorm
                        sum50 += day50
                        sum100 += day100

                        return (
                          <td 
                            key={day.dayNumber}
                            className={`py-2 px-1 border-r border-slate-800/60 font-mono text-xs ${
                              day.isWeekend ? 'bg-slate-950/40 text-slate-600' : ''
                            }`}
                          >
                            {dayHours > 0 ? (
                              <button
                                type="button"
                                onClick={() => handleEditDayCell(w.name, day.dateStr, dayLogs)}
                                className={`inline-block px-1.5 py-0.5 rounded font-bold transition-all hover:scale-110 cursor-pointer relative ${
                                  hasR
                                    ? 'bg-rose-950 text-rose-200 border border-rose-500 shadow-sm shadow-rose-950'
                                    : hasRR
                                    ? 'bg-amber-950 text-amber-200 border border-amber-500 shadow-sm shadow-amber-950'
                                    : day50 > 0 || day100 > 0 
                                    ? 'text-cyan-300 font-extrabold bg-cyan-950/80 border border-cyan-800/60' 
                                    : dayHours >= target 
                                    ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/40' 
                                    : 'text-amber-400 bg-amber-950/60 border border-amber-800/40'
                                }`}
                                title={
                                  hasR
                                    ? `🔴 Requiere Revisión (R - Alerta Operario) - ${dayHours} hs`
                                    : hasRR
                                    ? `🟡 Horas Corregidas (RR - Alerta Supervisor) - ${dayHours} hs`
                                    : `Clic para editar registro del día ${day.dateStr} (${dayHours} hs)`
                                }
                              >
                                {dayHours}
                                {hasR && (
                                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 border border-slate-900 animate-pulse" />
                                )}
                                {hasRR && !hasR && (
                                  <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 border border-slate-900" />
                                )}
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleQuickAddFromSabana(w.name, w.type, day.dateStr)}
                                className="text-slate-700 hover:text-cyan-400 px-1 py-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer text-xs"
                                title={`Clic para cargar horas el ${day.dateStr}`}
                              >
                                -
                              </button>
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

          {/* Pie de la Sábana con leyenda y botón de cierre */}
          <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
                Jornada normal (9h / 8h Feriado)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span>
                Horas Extras (50% / 100%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                Jornada Incompleta
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-rose-300">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block animate-pulse"></span>
                🔴 Requiere Revisión (R - Operario)
              </span>
              <span className="flex items-center gap-1.5 font-semibold text-amber-300">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
                🟡 Horas Corregidas (RR - Supervisor)
              </span>
              <span className="text-slate-500 italic ml-2">
                &bull; Hacé clic en cualquier celda o nombre de operario para corregir horas in-situ.
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

          {/* SECCIÓN INTERACTIVA: DETALLE Y CORRECCIÓN POR OPERARIO */}
          <div id="quincena-inspector-section" className="pt-6 border-t border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Pencil className="w-4 h-4 text-primary" />
                    {selectedQuincenaWorker 
                      ? `Auditoría y Corrección de Imputaciones: ${selectedQuincenaWorker}` 
                      : 'Todas las Imputaciones de la Quincena (Hacé clic en un operario para aislarlo)'}
                  </h3>
                  {selectedQuincenaWorker && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                      Filtrado
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Podés modificar rubro, horas normales, extras o eliminar cualquier registro directamente desde acá.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {selectedQuincenaWorker && (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        const workerObj = allQuincenaWorkers.find(x => x.name === selectedQuincenaWorker)
                        handleQuickAddFromSabana(selectedQuincenaWorker, workerObj?.type || 'Astillero', daysInQuincena[0]?.dateStr)
                      }}
                      className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Imputar Horas</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedQuincenaWorker(null)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 cursor-pointer"
                    >
                      Ver Todos
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Grilla Detallada de la Quincena */}
            {(() => {
              const quincenaLogs = recentLogs.filter(log => {
                if (!log.date_logged) return false
                const [year, month, day] = log.date_logged.split('-').map(Number)
                const matchYear = year === parseInt(selectedYear)
                const matchMonth = month === parseInt(selectedMonth)
                const matchQuincena = selectedQuincena === '1' ? (day >= 1 && day <= 15) : (day >= 16)
                const matchWorker = !selectedQuincenaWorker || log.worker_name === selectedQuincenaWorker
                return matchYear && matchMonth && matchQuincena && matchWorker
              })

              if (quincenaLogs.length === 0) {
                return (
                  <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                    No se encontraron registros de horas para {selectedQuincenaWorker || 'este período'}.
                  </div>
                )
              }

              return (
                <div className="overflow-x-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-2.5 px-3">Fecha</th>
                        <th className="py-2.5 px-3">Operario</th>
                        <th className="py-2.5 px-2">Tipo</th>
                        <th className="py-2.5 px-3">Barco & OT</th>
                        <th className="py-2.5 px-3">Rubro</th>
                        <th className="py-2.5 px-2 text-center">Norm</th>
                        <th className="py-2.5 px-2 text-center text-cyan-400">50%</th>
                        <th className="py-2.5 px-2 text-center text-amber-400">100%</th>
                        <th className="py-2.5 px-3 text-center text-primary font-bold">Total</th>
                        <th className="py-2.5 px-2 text-center">Estado</th>
                        <th className="py-2.5 px-3 text-right">Acciones</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {quincenaLogs.map(log => (
                        <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                          <td className="py-2 px-3 font-mono text-slate-400">{log.date_logged}</td>
                          <td className="py-2 px-3 font-bold text-white">{log.worker_name}</td>
                          <td className="py-2 px-2">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                              log.worker_type === 'Astillero' 
                                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60' 
                                : log.worker_type === 'Taller'
                                ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                                : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                            }`}>
                              {log.worker_type || 'Astillero'}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className="font-semibold text-white block">{log.work_orders?.ships?.name}</span>
                            <span className="text-[11px] text-slate-400">{log.work_orders?.title}</span>
                          </td>
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[11px] ${
                              (log.rubro || '').toLowerCase().includes('feriado')
                                ? 'bg-amber-950 text-amber-300 border border-amber-700/80 font-bold'
                                : 'bg-slate-800 text-slate-300'
                            }`}>
                              {log.rubro || 'General'}
                            </span>
                          </td>
                          <td className="py-2 px-2 text-center font-mono">{log.hours_normal || log.hours_worked}</td>
                          <td className="py-2 px-2 text-center font-mono text-cyan-400">{log.hours_extra_50 || 0}</td>
                          <td className="py-2 px-2 text-center font-mono text-amber-400">{log.hours_extra_100 || 0}</td>
                          <td className="py-2 px-3 text-center font-mono font-bold text-primary">{log.hours_worked} hs</td>
                          <td className="py-2 px-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              <select
                                value={log.approval_status || ''}
                                onChange={(e) => handleUpdateApprovalStatus(log.id, e.target.value)}
                                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer focus:outline-none ${
                                  log.approval_status === 'S' || log.approval_status === 'Aprobado'
                                    ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                    : log.approval_status === 'R'
                                    ? 'bg-rose-950 text-rose-300 border-rose-500 shadow-sm shadow-rose-900/50'
                                    : log.approval_status === 'RR'
                                    ? 'bg-amber-950 text-amber-300 border-amber-500'
                                    : log.approval_status === 'RRR'
                                    ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                                    : 'bg-slate-900 text-slate-400 border-slate-700'
                                }`}
                                title={`Estado de revisión de ${log.worker_name}`}
                              >
                                <option value="">-</option>
                                <option value="S">S (Aprobado)</option>
                                <option value="R">R (Revisión)</option>
                                <option value="RR">RR (Corregido)</option>
                                <option value="RRR">RRR (Aprobado Fin)</option>
                              </select>
                              {log.review_reason && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewReasonModal({
                                      isOpen: true,
                                      logId: log.id,
                                      workerName: log.worker_name,
                                      dateLogged: log.date_logged,
                                      shipWo: `${log.work_orders?.ships?.name || ''} - ${log.work_orders?.title || ''}`,
                                      targetStatus: log.approval_status || 'R',
                                      reason: log.review_reason || '',
                                      response: log.worker_response || ''
                                    })
                                  }}
                                  className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-900/40 transition-colors"
                                  title={`Motivo de observación (R): ${log.review_reason}`}
                                >
                                  <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => handleEditFromDaily(log)}
                                className="p-1 text-slate-400 hover:text-primary rounded hover:bg-slate-800 transition-colors cursor-pointer"
                                title="Editar registro"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteLog(log.id, log.worker_name)}
                                className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                                title="Eliminar registro"
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
              )
            })()}
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
                  Operario: <strong className="text-white">{editingForm.worker_name}</strong> &bull; Centro Costo: <strong className="text-cyan-400">CLIENTE</strong>
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
              {/* Selección de Barco y OT separados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Ship className="w-3.5 h-3.5 text-cyan-400" />
                    Barco / Embarcación
                  </label>
                  <select
                    value={editingForm.ship_id || ''}
                    onChange={(e) => {
                      const newShipId = e.target.value
                      const filteredWos = workOrders.filter(w => w.ship_id === newShipId)
                      setEditingForm({
                        ...editingForm,
                        ship_id: newShipId,
                        work_order_id: filteredWos[0]?.id || '',
                        shipName: ships.find(s => s.id === newShipId)?.name || 'Barco'
                      })
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    {ships.map(ship => (
                      <option key={ship.id} value={ship.id} className="bg-slate-900">
                        {ship.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-cyan-400" />
                    Orden de Trabajo (OT)
                  </label>
                  <select
                    required
                    value={editingForm.work_order_id}
                    onChange={(e) => setEditingForm({ ...editingForm, work_order_id: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    {(() => {
                      const currentShipId = editingForm.ship_id || ships[0]?.id
                      const filteredWos = workOrders.filter(w => w.ship_id === currentShipId)
                      if (filteredWos.length === 0) {
                        return <option value="">Sin OTs abiertas para este barco</option>
                      }
                      return filteredWos.map(wo => (
                        <option key={wo.id} value={wo.id} className="bg-slate-900">
                          {wo.title}
                        </option>
                      ))
                    })()}
                  </select>
                </div>
              </div>

              {/* Ayuda obligatoria: Descripción y alcance de la OT */}
              {(() => {
                const selectedWo = workOrders.find(w => w.id === editingForm.work_order_id)
                if (!selectedWo) return null
                return (
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2 text-xs">
                    <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-slate-200">Alcance de {selectedWo.title}: </strong>
                      <span className="text-slate-400">{selectedWo.description || 'Sin descripción detallada registrada.'}</span>
                    </div>
                  </div>
                )
              })()}

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
                    <option value="Astillero">Astillero</option>
                    <option value="Taller">Taller</option>
                    <option value="Contratista">Contratista</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                    Estado de Aprobación
                  </label>
                  <select
                    value={editingForm.approval_status || ''}
                    onChange={(e) => setEditingForm({ ...editingForm, approval_status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-bold"
                  >
                    <option value="">- Sin Revisar -</option>
                    <option value="S">S (Aprobado)</option>
                    <option value="R">R (Requiere Revisión / Observado)</option>
                    <option value="RR">RR (Corregido por Operario)</option>
                    <option value="RRR">RRR (Aprobado Final Supervisor)</option>
                  </select>
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
              </div>

              {/* CASILLA DINÁMICA DE TEXTO LIBRE PARA ESTADO R (OBSERVADO) */}
              {editingForm.approval_status === 'R' && (
                <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-1.5 animate-in fade-in duration-150">
                  <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>Motivo de Revisión / Duda Técnica (Auditoría)</span>
                  </div>
                  <p className="text-[11px] text-rose-300/80">
                    Especifique la duda u observación para que el operario o supervisor pueda revisar y corregir:
                  </p>
                  <textarea
                    rows={2}
                    value={editingForm.review_reason || ''}
                    onChange={(e) => setEditingForm({ ...editingForm, review_reason: e.target.value })}
                    placeholder="Ej: Tareas no coinciden con la OT; exceso de horas extras al 100% no autorizadas..."
                    className="w-full bg-slate-950 border border-rose-500/40 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400"
                  />
                </div>
              )}

              {/* CASILLA DINÁMICA PARA ESTADO RR (CORREGIDO POR OPERARIO) */}
              {editingForm.approval_status === 'RR' && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 animate-in fade-in duration-150">
                  {editingForm.review_reason && (
                    <div className="text-[11px] text-amber-200/90 bg-amber-950/40 p-2 rounded border border-amber-800/40">
                      <strong className="text-amber-400 block mb-0.5 font-semibold">Duda planteada previamente (R):</strong>
                      {editingForm.review_reason}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                    <FileText className="w-4 h-4 shrink-0" />
                    <span>Descargo / Corrección del Operario o Responsable (RR)</span>
                  </div>
                  <textarea
                    rows={2}
                    value={editingForm.worker_response || ''}
                    onChange={(e) => setEditingForm({ ...editingForm, worker_response: e.target.value })}
                    placeholder="Explique la corrección realizada o aclare el motivo de las horas imputadas..."
                    className="w-full bg-slate-950 border border-amber-500/40 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}

              {/* HISTORIAL PREVIO SI YA ESTÁ APROBADO O RRR */}
              {(editingForm.approval_status === 'RRR' || editingForm.approval_status === 'S' || editingForm.approval_status === 'Aprobado') && editingForm.review_reason && (
                <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs space-y-1">
                  <div className="text-[11px] text-slate-400">
                    <span className="text-rose-400 font-semibold">Observación previa (R): </span>
                    {editingForm.review_reason}
                  </div>
                  {editingForm.worker_response && (
                    <div className="text-[11px] text-slate-400">
                      <span className="text-amber-400 font-semibold">Respuesta previa (RR): </span>
                      {editingForm.worker_response}
                    </div>
                  )}
                </div>
              )}

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
          <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 relative">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Plus className="w-4 h-4 text-primary" />
                  Imputar Horas a {quickLogWorker.name}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Fecha: <strong className="text-white font-mono">{quickLogWorker.date || auditDate}</strong> &bull; Centro Costo: <strong className="text-cyan-400">CLIENTE</strong>
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
              {/* Selección de Barco y OT habilitada en cascada */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <Ship className="w-3.5 h-3.5 text-cyan-400" />
                    1. Barco / Embarcación
                  </label>
                  <select
                    value={quickLogWorker.ship_id || ''}
                    onChange={(e) => {
                      const newShipId = e.target.value
                      const filteredWos = getEnabledWosForWorkerInShip(newShipId, quickLogWorker.name, quickLogWorker.type)
                      setQuickLogWorker({
                        ...quickLogWorker,
                        ship_id: newShipId,
                        work_order_id: filteredWos[0]?.id || ''
                      })
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    {ships.map(ship => (
                      <option key={ship.id} value={ship.id} className="bg-slate-900">
                        {ship.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                    <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
                    2. OT Habilitada (En Ejecución)
                  </label>
                  <select
                    required
                    value={quickLogWorker.work_order_id}
                    onChange={(e) => setQuickLogWorker({ ...quickLogWorker, work_order_id: e.target.value })}
                    className="w-full bg-slate-950 border border-emerald-500/40 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-400"
                  >
                    {(() => {
                      const currentShipId = quickLogWorker.ship_id || ships[0]?.id
                      const filteredWos = getEnabledWosForWorkerInShip(currentShipId, quickLogWorker.name, quickLogWorker.type)
                      if (filteredWos.length === 0) {
                        return <option value="">🔒 Sin OTs en ejecución habilitadas en este barco</option>
                      }
                      return filteredWos.map(wo => (
                        <option key={wo.id} value={wo.id} className="bg-slate-900">
                          {wo.ot_number ? `${wo.ot_number} — ` : ''}{wo.title}
                        </option>
                      ))
                    })()}
                  </select>
                </div>
              </div>

              {/* Ayuda obligatoria: Descripción y alcance de la OT (DEC-016) */}
              {(() => {
                const selectedWo = workOrders.find(w => w.id === quickLogWorker.work_order_id)
                if (!selectedWo) return null
                const matchedItem = workItems.find(
                  i => i.work_order_id === selectedWo.id && i.status === 'En ejecución'
                )
                return (
                  <div className="p-2.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 flex items-start gap-2 text-xs">
                    <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-emerald-300">[{selectedWo.ot_number || 'OT'}] {selectedWo.title}: </strong>
                      <span className="text-slate-300">{matchedItem?.description || selectedWo.description || 'Sin descripción detallada registrada.'}</span>
                    </div>
                  </div>
                )
              })()}

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

      {/* ========================================================= */}
      {/* BARRA FLOTANTE DE ACCIONES MASIVAS (SELECCIÓN MÚLTIPLE)   */}
      {/* ========================================================= */}
      {selectedLogIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-slate-900/95 border border-cyan-500/50 rounded-2xl shadow-2xl px-5 py-3 backdrop-blur-md flex flex-wrap items-center gap-4 text-xs animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center gap-2 text-white font-bold">
            <CheckCircle2 className="w-4 h-4 text-cyan-400" />
            <span>{selectedLogIds.size} imputación(es) seleccionada(s)</span>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-semibold mr-1">Cambiar estado a:</span>
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => handleUpdateApprovalStatus(Array.from(selectedLogIds), 'S')}
              className="px-2.5 py-1 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 rounded font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Aprobar seleccionadas"
            >
              S (Aprobar)
            </button>
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => handleUpdateApprovalStatus(Array.from(selectedLogIds), 'R')}
              className="px-2.5 py-1 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-600 rounded font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Marcar como Requiere Revisión"
            >
              R (Observar)
            </button>
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => handleUpdateApprovalStatus(Array.from(selectedLogIds), 'RR')}
              className="px-2.5 py-1 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-600 rounded font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Marcar como Corregidas por Operario"
            >
              RR (Corregidas)
            </button>
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => handleUpdateApprovalStatus(Array.from(selectedLogIds), 'RRR')}
              className="px-2.5 py-1 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-600 rounded font-bold transition-all cursor-pointer disabled:opacity-50"
              title="Aprobación Definitiva Supervisor"
            >
              RRR (Aprobado Final)
            </button>
            <button
              type="button"
              disabled={bulkUpdating}
              onClick={() => handleUpdateApprovalStatus(Array.from(selectedLogIds), '')}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 rounded font-medium transition-all cursor-pointer disabled:opacity-50"
              title="Limpiar estado a vacío"
            >
              Vaciar
            </button>
          </div>

          <div className="h-4 w-px bg-slate-700 hidden sm:block"></div>

          <button
            type="button"
            onClick={() => setSelectedLogIds(new Set())}
            className="text-slate-400 hover:text-white text-xs underline cursor-pointer"
          >
            Deseleccionar
          </button>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: BANDEJA DE HORAS QUE REQUIEREN REVISIÓN          */}
      {/* ========================================================= */}
      {showReviewModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 relative max-h-[90vh] flex flex-col">
            {/* Cabecera */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  reviewModalFilter === 'R'
                    ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
                    : reviewModalFilter === 'RR'
                    ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                    : 'bg-primary/20 border border-primary/40 text-primary'
                }`}>
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    {reviewModalFilter === 'R'
                      ? 'Horas que Requieren Revisión (Alerta para el Operario)'
                      : reviewModalFilter === 'RR'
                      ? 'Horas Corregidas (Alerta para el Supervisor)'
                      : 'Bandeja de Revisión y Corrección de Horas'}
                    {reviewModalFilter === 'R' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800">
                        {countR} por corregir
                      </span>
                    )}
                    {reviewModalFilter === 'RR' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800">
                        {countRR} por aprobar
                      </span>
                    )}
                    {reviewModalFilter === 'todos' && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                        {reviewCount} total
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1.5 text-rose-300 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/60 font-medium">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      <strong>R (Rojo):</strong> Observadas por supervisor → Operario corrige
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/60 font-medium">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      <strong>RR (Amarillo):</strong> Corregidas por operario → Supervisor da visto bueno
                    </span>
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowReviewModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Barra de Filtros y Búsqueda interna */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 shrink-0">
              <div className="flex items-center gap-2 text-xs">
                <button
                  type="button"
                  onClick={() => setReviewModalFilter('R')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    reviewModalFilter === 'R'
                      ? 'bg-rose-600 text-white shadow-md shadow-rose-950'
                      : 'bg-slate-950 text-rose-400 hover:text-rose-300 border border-rose-900/50'
                  }`}
                >
                  <span>🔴 Requieren Revisión R</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-950/80 border border-rose-800 font-mono">
                    {countR}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setReviewModalFilter('RR')}
                  className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                    reviewModalFilter === 'RR'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950 font-black'
                      : 'bg-slate-950 text-amber-400 hover:text-amber-300 border border-amber-900/50'
                  }`}
                >
                  <span>🟡 Horas Corregidas RR</span>
                  <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-950/80 border border-amber-800 font-mono">
                    {countRR}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setReviewModalFilter('todos')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    reviewModalFilter === 'todos'
                      ? 'bg-slate-700 text-white font-bold'
                      : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Todas ({reviewCount})
                </button>
              </div>

              {/* Input búsqueda */}
              <div className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por operario, barco..."
                  value={reviewModalSearch}
                  onChange={(e) => setReviewModalSearch(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                />
              </div>
            </div>

            {/* Tabla con scroll de registros que requieren revisión */}
            <div className="overflow-y-auto flex-1 border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 sticky top-0 z-10">
                  <tr>
                    <th className="py-2.5 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={filteredReviewLogs.length > 0 && filteredReviewLogs.every(l => selectedLogIds.has(l.id))}
                        onChange={() => toggleSelectAllLogs(filteredReviewLogs.map(l => l.id))}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary"
                      />
                    </th>
                    <th className="py-2.5 px-3">Estado</th>
                    <th className="py-2.5 px-3">Fecha</th>
                    <th className="py-2.5 px-3">Operario</th>
                    <th className="py-2.5 px-3">Barco & OT</th>
                    <th className="py-2.5 px-3">Rubro</th>
                    <th className="py-2.5 px-2 text-center">Horas</th>
                    <th className="py-2.5 px-3">Observaciones / Duda R</th>
                    <th className="py-2.5 px-3 text-right">Editar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredReviewLogs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-500">
                        <CheckCircle className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                        <p className="font-semibold text-slate-400">¡No hay horas pendientes de revisión!</p>
                        <p className="text-xs text-slate-500 mt-0.5">Todas las imputaciones observadas fueron aprobadas o corregidas.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredReviewLogs.map(log => (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2.5 px-3">
                          <input
                            type="checkbox"
                            checked={selectedLogIds.has(log.id)}
                            onChange={() => toggleSelectLog(log.id)}
                            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary"
                          />
                        </td>
                        <td className="py-2.5 px-3">
                          <select
                            value={log.approval_status || ''}
                            onChange={(e) => handleUpdateApprovalStatus(log.id, e.target.value)}
                            className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer focus:outline-none ${
                              log.approval_status === 'R'
                                ? 'bg-rose-950 text-rose-300 border-rose-500'
                                : log.approval_status === 'RR'
                                ? 'bg-amber-950 text-amber-300 border-amber-500'
                                : 'bg-slate-900 text-slate-400 border-slate-700'
                            }`}
                          >
                            <option value="R">R (Observado)</option>
                            <option value="RR">RR (Corregido)</option>
                            <option value="RRR">RRR (Aprobado Fin)</option>
                            <option value="S">S (Aprobado)</option>
                            <option value="">- Vacío</option>
                          </select>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300">
                          {log.date_logged}
                        </td>
                        <td className="py-2.5 px-3">
                          <span className="font-bold text-white block">{log.worker_name}</span>
                          <span className="text-[10px] text-slate-400">{log.worker_type || 'Astillero'}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          <strong className="text-white block">{log.work_orders?.ships?.name}</strong>
                          <span className="text-[11px] text-slate-300">{log.work_orders?.title}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {log.rubro || 'General'}
                        </td>
                        <td className="py-2.5 px-2 text-center font-mono font-bold text-primary">
                          {log.hours_worked || log.hours_normal || 0} hs
                        </td>
                        <td className="py-2.5 px-3 text-[11px] max-w-[260px]">
                          {log.review_reason && (
                            <div className="bg-rose-950/50 border border-rose-800/60 text-rose-300 p-1.5 rounded text-[11px] mb-1">
                              <strong className="text-rose-400 font-bold block text-[10px]">Duda / Observación (R):</strong>
                              {log.review_reason}
                            </div>
                          )}
                          {log.worker_response && (
                            <div className="bg-amber-950/50 border border-amber-800/60 text-amber-300 p-1.5 rounded text-[11px] mb-1">
                              <strong className="text-amber-400 font-bold block text-[10px]">Descargo (RR):</strong>
                              {log.worker_response}
                            </div>
                          )}
                          {log.notes && (
                            <span className="text-slate-400 italic block">{log.notes}</span>
                          )}
                          {!log.review_reason && !log.worker_response && !log.notes && (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setShowReviewModal(false)
                              handleEditFromDaily(log)
                            }}
                            className="p-1.5 text-slate-400 hover:text-primary rounded hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Editar registro in-situ"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Pie del modal con acciones rápidas masivas */}
            {filteredReviewLogs.length > 0 && (
              <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
                <div className="flex items-center gap-2 text-slate-400">
                  <span>{selectedLogIds.size} seleccionadas de esta vista</span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={selectedLogIds.size === 0}
                    onClick={() => handleUpdateApprovalStatus(Array.from(selectedLogIds), 'RR')}
                    className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold transition-all disabled:opacity-40 cursor-pointer"
                  >
                    Pasar seleccionadas a RR (Corregidas)
                  </button>
                  <button
                    type="button"
                    disabled={selectedLogIds.size === 0}
                    onClick={() => handleUpdateApprovalStatus(Array.from(selectedLogIds), 'RRR')}
                    className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg font-bold transition-all disabled:opacity-40 cursor-pointer"
                  >
                    Pasar seleccionadas a RRR (Aprobación Final)
                  </button>
                  <button
                    type="button"
                    disabled={selectedLogIds.size === 0}
                    onClick={() => handleUpdateApprovalStatus(Array.from(selectedLogIds), 'S')}
                    className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg font-bold transition-all disabled:opacity-40 cursor-pointer"
                  >
                    Aprobar (S)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: MOTIVO DE REVISIÓN / DUDA TÉCNICA (ESTADO R / RR)   */}
      {/* ========================================================= */}
      {reviewReasonModal.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-lg bg-slate-900 border border-rose-500/50 rounded-2xl shadow-2xl p-6 relative">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {reviewReasonModal.targetStatus === 'R' ? 'Observar Imputación de Horas (Estado R)' : 'Revisión y Descargo Técnico'}
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    <strong className="text-white">{reviewReasonModal.workerName}</strong> &bull; <span className="font-mono">{reviewReasonModal.dateLogged}</span> &bull; {reviewReasonModal.shipWo}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setReviewReasonModal({ isOpen: false, logId: null, workerName: '', dateLogged: '', shipWo: '', targetStatus: 'R', reason: '', response: '' })}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmReviewModal} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-rose-300 mb-1.5 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" />
                  Motivo de Revisión / Duda Técnica (Auditoría):
                </label>
                <p className="text-[11px] text-slate-400 mb-2">
                  Detalle el motivo por el cual se observa este parte de horas para que el operario o supervisor de cuadrilla pueda corregir y justificar (circuito S &rarr; R &rarr; RR &rarr; RRR):
                </p>
                <textarea
                  required={reviewReasonModal.targetStatus === 'R'}
                  rows={3}
                  value={reviewReasonModal.reason}
                  onChange={(e) => setReviewReasonModal(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Ej: Revisar cantidad de horas extras al 100%, no coincide con el avance del parte diario; o rubro erróneo..."
                  className="w-full bg-slate-950 border border-rose-500/40 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
                  autoFocus
                />
              </div>

              {reviewReasonModal.response && (
                <div>
                  <label className="block text-xs font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" />
                    Descargo / Respuesta del Operario:
                  </label>
                  <p className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300">
                    {reviewReasonModal.response}
                  </p>
                </div>
              )}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setReviewReasonModal({ isOpen: false, logId: null, workerName: '', dateLogged: '', shipWo: '', targetStatus: 'R', reason: '', response: '' })}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardar Observación (R)</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DATALISTS COMPARTIDOS */}
      <datalist id="all-workers-datalist">
        {astilleroSource.map(w => (
          <option key={w.name} value={w.name} />
        ))}
        {tallerSource.map(t => (
          <option key={t} value={t} />
        ))}
        {contratistaSource.map(c => (
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
