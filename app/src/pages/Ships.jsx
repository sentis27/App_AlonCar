import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Ship,
  Anchor,
  Calendar,
  Users,
  Search,
  Filter,
  Plus,
  Pencil,
  Eye,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Clock,
  ClipboardList,
  Building2,
  Phone,
  Mail,
  FileText,
  ChevronRight,
  X,
  Save,
  Trash2,
  ExternalLink,
  MapPin,
  Layers,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  BellRing,
  Wrench,
  Gauge,
  Check,
  RotateCcw,
  MessageSquare
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

// Componentes predeterminados de la Ficha Técnica Dinámica Naval
const DEFAULT_TECH_COMPONENTS = [
  { key: 'tanques_combustible', label: 'Tanques de Combustible', defaultUnit: 'tanques', hint: 'Ej: 2 en bodega 10m³, 1 popa boyante 15m³, 1 diario 2m³' },
  { key: 'tanques_agua', label: 'Tanques de Agua Potable', defaultUnit: 'tanques', hint: 'Ej: Proa 5m³ c/u, babor' },
  { key: 'valvulas_casco_1_a_2_5', label: 'Válvulas de Casco (1" a 2½")', defaultUnit: 'válvulas', hint: 'Ej: 6 estribor, 6 babor. Mecanizado de asientos' },
  { key: 'valvulas_casco_3_a_6', label: 'Válvulas de Casco (3" a 6")', defaultUnit: 'válvulas', hint: 'Ej: Tomas de mar principales de sala de máquinas' },
  { key: 'valvulas_intermediarias', label: 'Válvulas Intermediarias', defaultUnit: 'válvulas', hint: 'Ej: Intermediarias de achique e incendio' },
  { key: 'pocetes_achique', label: 'Pocetes de Achique', defaultUnit: 'pocetes', hint: 'Ej: Ubicados en sala de máquinas y doble fondo' }
]

// Lista oficial de tipos de embarcación (eliminado Arenero, añadido Desguace)
const PREDEFINED_VESSEL_TYPES = [
  'Pesquero',
  'Desguace',
  'Remolcador',
  'Pontón',
  'Barcaza',
  'Buque Motor General',
  'Draga',
  'Lancha / Prácticos',
  'Yate / Recreo'
]

// Lista oficial de locaciones según la planilla 'CALENDARIO DE ESTADIA BARCOS' (DEC-019)
const STANDARD_LOCATIONS = [
  'VARADERO ALON CAR',
  'MUELLE ALON CAR',
  'PUERTO ?? ALDANA',
  'PUERTO 1RA ALDANA',
  'PUERTO 2DA ALDANA',
  'PUERTO 3RA ALDANA',
  'PUERTO 4TA ALDANA',
  'PUERTO 5TA ALDANA',
  'PUERTO 6TA ALDANA',
  'PUERTO 7MA ALDANA'
]

// Función para limpiar nombres de barco (sin prefijos contaminantes)
const cleanShipName = (name = '') =>
  String(name || '')
    .replace(/^\s*astillero\s+alon\s*car\s*[-–:]?\s*/i, '')
    .replace(/^\s*astillero\s*[-–:]?\s*/i, '')
    .trim() || String(name || '')

// Cálculo de días corridos: =SI(C="";"";Fin-Comienzo+1), si no tiene fin acumula con HOY()
const calculateStayDays = (startDateStr, endDateStr) => {
  if (!startDateStr) return 0
  const start = new Date(startDateStr + 'T00:00:00')
  const end = endDateStr ? new Date(endDateStr + 'T00:00:00') : new Date()
  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays + 1)
}

export default function Ships() {
  const { user } = useAuth()

  // Datos principales
  const [ships, setShips] = useState([])
  const [owners, setOwners] = useState([])
  const [stays, setStays] = useState([])
  const [contacts, setContacts] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [workItems, setWorkItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState(null)

  // Navegación de pestañas principales
  const [activeTab, setActiveTab] = useState('buques') // 'buques' | 'movimientos' | 'armadores'

  // Modo de visualización de Buques: 'tabla' (filas) | 'tarjetas' (fichas)
  const [viewMode, setViewMode] = useState('tabla')

  // Perspectiva / Rol de Operación
  // Jorge Sentis (Admin) | María José (Admin/Comercial/Armador) | Jefe de Obra (Técnico/Medidas)
  const [activeRolePerspective, setActiveRolePerspective] = useState('admin')

  // Filtros de búsqueda
  const [searchTerm, setSearchTerm] = useState('')
  const [locationFilter, setLocationFilter] = useState('todos')
  const [requestFilter, setRequestFilter] = useState('todos')
  const [roleQuickFilter, setRoleQuickFilter] = useState('todos') // 'todos' | 'mis_pendientes'

  // Modales
  const [selectedShip360, setSelectedShip360] = useState(null)
  const [modalShip, setModalShip] = useState({ isOpen: false, ship: null, isCustomVesselType: false, customVesselTypeVal: '' })
  const [modalStay, setModalStay] = useState({ isOpen: false, stay: null, defaultShipId: '' })
  const [modalOwner, setModalOwner] = useState({ isOpen: false, owner: null })
  const [modalContact, setModalContact] = useState({ isOpen: false, contact: null, defaultOwnerId: '', defaultShipId: '' })
  const [modalRequestInfo, setModalRequestInfo] = useState({ isOpen: false, ship: null, requestType: 'pendiente_jefe_obra', notes: '' })
  const [submitting, setSubmitting] = useState(false)

  // Subpestaña en modal 360
  const [subTab360, setSubTab360] = useState('tecnica') // 'tecnica' | 'armador' | 'movimientos' | 'ots'

  // Carga inicial de datos
  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [shipsRes, ownersRes, staysRes, contactsRes, wosRes, itemsRes] = await Promise.all([
        supabase.from('ships').select('*, owners(*)').order('name', { ascending: true }),
        supabase.from('owners').select('*').order('name', { ascending: true }),
        supabase.from('ship_stays').select('*, ships(id, name)').order('start_date', { ascending: false }),
        supabase.from('contacts').select('*, owners(id, name), ships(id, name)').order('name', { ascending: true }),
        supabase.from('work_orders').select('id, ship_id, ot_number, title, status, description, created_at').order('created_at', { ascending: false }),
        supabase.from('work_items').select('id, work_order_id, status, description, contractors, work_type').order('created_at', { ascending: true })
      ])

      if (shipsRes.data) setShips(shipsRes.data)
      if (ownersRes.data) setOwners(ownersRes.data)
      if (staysRes.data) setStays(staysRes.data)
      if (contactsRes.data) setContacts(contactsRes.data)
      if (wosRes.data) setWorkOrders(wosRes.data)
      if (itemsRes.data) setWorkItems(itemsRes.data)
    } catch (err) {
      console.error('Error cargando módulo barcos:', err)
      setStatusMessage({ type: 'error', text: 'Error al conectar con Supabase: ' + err.message })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInitialData()
  }, [])

  // ==========================================================================
  // CÁLCULO PRECISO DE OTS ACTIVAS POR BARCO (Evaluando items y estados reales)
  // ==========================================================================
  const getShipOtMetrics = useMemo(() => {
    const itemsByWo = {}
    workItems.forEach(it => {
      if (!itemsByWo[it.work_order_id]) itemsByWo[it.work_order_id] = []
      itemsByWo[it.work_order_id].push(it)
    })

    const map = {}
    ships.forEach(ship => {
      const shipWos = workOrders.filter(w => w.ship_id === ship.id)
      const activeWos = shipWos.filter(wo => {
        const items = itemsByWo[wo.id] || []
        const hasExecutionItem = items.some(i => i.status === 'En ejecución' || i.status === 'Pendiente de inicio')
        const isNotClosed = !['Cancelada', 'Completada', 'Facturada', 'Desestimada'].includes(wo.status)
        const isWoActiveStatus = ['En Progreso', 'En ejecución', 'open', 'Pendiente', 'Abierta'].includes(wo.status)
        return isNotClosed && (hasExecutionItem || isWoActiveStatus)
      })

      map[ship.id] = {
        total: shipWos.length,
        active: activeWos.length,
        shipWos,
        activeWos
      }
    })
    return map
  }, [ships, workOrders, workItems])

  // KPI Calculations
  const totalShips = ships.length
  const varaderoCount = ships.filter(s => s.current_location === 'VARADERO ALON CAR' && s.is_active !== false).length
  const muelleCount = ships.filter(s => s.current_location === 'MUELLE ALON CAR' && s.is_active !== false).length
  const puertoCount = ships.filter(s => (s.current_location || '').includes('PUERTO') && s.is_active !== false).length
  const pendingRequestsCount = ships.filter(s => s.info_request_status && s.info_request_status !== 'completo').length

  // Manejo de clic interactivo en KPI para filtrar
  const handleKpiClick = (type) => {
    if (type === 'todos') {
      setLocationFilter('todos')
      setRequestFilter('todos')
      setRoleQuickFilter('todos')
    } else if (type === 'VARADERO ALON CAR') {
      setRequestFilter('todos')
      setLocationFilter(prev => prev === 'VARADERO ALON CAR' ? 'todos' : 'VARADERO ALON CAR')
    } else if (type === 'MUELLE ALON CAR') {
      setRequestFilter('todos')
      setLocationFilter(prev => prev === 'MUELLE ALON CAR' ? 'todos' : 'MUELLE ALON CAR')
    } else if (type === 'PUERTO') {
      setRequestFilter('todos')
      setLocationFilter(prev => prev === 'PUERTO' ? 'todos' : 'PUERTO')
    } else if (type === 'pendientes') {
      setLocationFilter('todos')
      setRequestFilter(prev => prev === 'pendientes' ? 'todos' : 'pendientes')
    }
  }

  // Barcos filtrados para la lista (Tabla o Tarjetas)
  const filteredShips = useMemo(() => {
    return ships.filter(s => {
      const term = searchTerm.toLowerCase()
      const matchSearch = !term ||
        cleanShipName(s.name).toLowerCase().includes(term) ||
        (s.owners?.name || '').toLowerCase().includes(term) ||
        (s.owners?.armador_name || '').toLowerCase().includes(term) ||
        (s.current_location || '').toLowerCase().includes(term) ||
        (s.matricula || '').toLowerCase().includes(term) ||
        (s.vessel_type || '').toLowerCase().includes(term)

      const matchLocation = locationFilter === 'todos' ||
        (locationFilter === 'PUERTO' ? (s.current_location || '').includes('PUERTO') : s.current_location === locationFilter)

      const matchRequest = requestFilter === 'todos' ||
        (requestFilter === 'pendientes' ? (s.info_request_status && s.info_request_status !== 'completo') : s.info_request_status === 'completo')

      // Filtro rápido por rol activo
      let matchRole = true
      if (roleQuickFilter === 'mis_pendientes') {
        if (activeRolePerspective === 'maria_jose') {
          matchRole = s.info_request_status === 'pendiente_maria_jose' || s.info_request_status === 'pendiente_ambos'
        } else if (activeRolePerspective === 'jefe_obra') {
          matchRole = s.info_request_status === 'pendiente_jefe_obra' || s.info_request_status === 'pendiente_ambos'
        } else if (activeRolePerspective === 'admin') {
          matchRole = s.info_request_status && s.info_request_status !== 'completo'
        }
      }

      return matchSearch && matchLocation && matchRequest && matchRole
    })
  }, [ships, searchTerm, locationFilter, requestFilter, roleQuickFilter, activeRolePerspective])

  // Movimientos filtrados para el Calendario
  const filteredStays = useMemo(() => {
    return stays.filter(st => {
      const term = searchTerm.toLowerCase()
      const shipName = cleanShipName(st.ships?.name || '')
      return !term || shipName.toLowerCase().includes(term) || (st.location || '').toLowerCase().includes(term)
    })
  }, [stays, searchTerm])

  // ==========================================================================
  // HANDLERS: BARCO (CREAR / EDITAR / BAJA LÓGICA)
  // ==========================================================================
  const handleOpenNewShip = () => {
    setModalShip({
      isOpen: true,
      ship: {
        name: '',
        owner_id: owners[0]?.id || '',
        matricula: '',
        imo_number: '',
        vessel_type: 'Pesquero',
        eslora_mts: '',
        manga_mts: '',
        puntal_mts: '',
        superficie_casco_m2: '',
        current_location: 'VARADERO ALON CAR',
        notes: '',
        info_request_status: 'pendiente_ambos',
        info_request_notes: 'Completar medidas reales a bordo y cargar datos de contacto del armador.',
        technical_specs: {}
      },
      isCustomVesselType: false,
      customVesselTypeVal: ''
    })
  }

  const handleOpenEditShip = (ship) => {
    const isPredefined = PREDEFINED_VESSEL_TYPES.includes(ship.vessel_type)
    setModalShip({
      isOpen: true,
      ship: { ...ship },
      isCustomVesselType: !isPredefined && Boolean(ship.vessel_type),
      customVesselTypeVal: !isPredefined ? (ship.vessel_type || '') : ''
    })
  }

  const handleSaveShip = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setStatusMessage(null)

    try {
      const cleanName = cleanShipName(modalShip.ship.name).toUpperCase()
      if (!cleanName) throw new Error('El nombre del barco es obligatorio')

      const finalVesselType = modalShip.isCustomVesselType
        ? (modalShip.customVesselTypeVal?.trim() || 'Pesquero')
        : (modalShip.ship.vessel_type || 'Pesquero')

      const payload = {
        name: cleanName,
        owner_id: modalShip.ship.owner_id || null,
        matricula: modalShip.ship.matricula || null,
        imo_number: modalShip.ship.imo_number || null,
        vessel_type: finalVesselType,
        eslora_mts: modalShip.ship.eslora_mts ? parseFloat(modalShip.ship.eslora_mts) : null,
        manga_mts: modalShip.ship.manga_mts ? parseFloat(modalShip.ship.manga_mts) : null,
        puntal_mts: modalShip.ship.puntal_mts ? parseFloat(modalShip.ship.puntal_mts) : null,
        superficie_casco_m2: modalShip.ship.superficie_casco_m2 ? parseFloat(modalShip.ship.superficie_casco_m2) : null,
        current_location: modalShip.ship.current_location || 'VARADERO ALON CAR',
        notes: modalShip.ship.notes || null,
        technical_specs: modalShip.ship.technical_specs || {},
        info_request_status: modalShip.ship.info_request_status || 'completo',
        info_request_notes: modalShip.ship.info_request_notes || null,
        is_active: true
      }

      if (modalShip.ship.id) {
        // Update
        const { error } = await supabase.from('ships').update(payload).eq('id', modalShip.ship.id)
        if (error) throw error
        setStatusMessage({ type: 'success', text: `Buque "${cleanName}" actualizado correctamente.` })
      } else {
        // Insert
        payload.info_requested_at = new Date().toISOString()
        payload.info_requested_by = user?.email || 'Jorge Sentis (Administrador)'
        const { error } = await supabase.from('ships').insert([payload])
        if (error) throw error
        setStatusMessage({
          type: 'success',
          text: `Buque "${cleanName}" dado de alta exitosamente. Se notificó a María José y Jefes de Obra para completar datos.`
        })
      }

      setModalShip({ isOpen: false, ship: null, isCustomVesselType: false, customVesselTypeVal: '' })
      await loadInitialData()
    } catch (err) {
      console.error('Error guardando barco:', err)
      setStatusMessage({ type: 'error', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  // Baja lógica inviolable (is_active = false)
  const handleToggleShipActive = async (ship) => {
    const nextStatus = ship.is_active === false
    const actionLabel = nextStatus ? 'reactivar' : 'desactivar (baja lógica)'

    if (!window.confirm(`¿Confirmás ${actionLabel} el buque "${cleanShipName(ship.name)}"? El historial de OTs y jornales se preservará intacto.`)) {
      return
    }

    try {
      const { error } = await supabase
        .from('ships')
        .update({ is_active: nextStatus, status: nextStatus ? 'Activo' : 'Terminado' })
        .eq('id', ship.id)

      if (error) throw error
      setStatusMessage({
        type: 'info',
        text: `Buque "${cleanShipName(ship.name)}" ${nextStatus ? 'reactivado' : 'desactivado'}.`
      })
      await loadInitialData()
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message })
    }
  }

  // Abrir Ficha 360° respetando el rol activo para la subpestaña inicial
  const handleOpenShip360 = (ship) => {
    setSelectedShip360(ship)
    if (activeRolePerspective === 'maria_jose') {
      setSubTab360('armador')
    } else if (activeRolePerspective === 'jefe_obra') {
      setSubTab360('tecnica')
    } else {
      setSubTab360('tecnica')
    }
  }

  // Marcar solicitud como completada (por Jefe de Obra o María José)
  const handleMarkRequestComplete = async (ship) => {
    try {
      const { error } = await supabase
        .from('ships')
        .update({
          info_request_status: 'completo',
          info_request_notes: null
        })
        .eq('id', ship.id)

      if (error) throw error
      setStatusMessage({
        type: 'success',
        text: `Se marcó la solicitud de información para "${cleanShipName(ship.name)}" como completada.`
      })
      if (selectedShip360?.id === ship.id) {
        setSelectedShip360(prev => ({ ...prev, info_request_status: 'completo', info_request_notes: null }))
      }
      await loadInitialData()
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message })
    }
  }

  // ==========================================================================
  // HANDLERS: ESTADÍAS & MOVIMIENTOS
  // ==========================================================================
  const handleOpenNewStay = (shipId = '') => {
    const today = new Date().toISOString().split('T')[0]
    setModalStay({
      isOpen: true,
      stay: {
        ship_id: shipId || ships[0]?.id || '',
        location: 'VARADERO ALON CAR',
        start_date: today,
        end_date: '',
        notes: ''
      },
      defaultShipId: shipId
    })
  }

  const handleSaveStay = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (!modalStay.stay.ship_id) throw new Error('Seleccioná un barco')
      if (!modalStay.stay.start_date) throw new Error('La fecha de comienzo es obligatoria')

      const payload = {
        ship_id: modalStay.stay.ship_id,
        location: modalStay.stay.location || 'VARADERO ALON CAR',
        start_date: modalStay.stay.start_date,
        end_date: modalStay.stay.end_date || null,
        notes: modalStay.stay.notes || null
      }

      if (modalStay.stay.id) {
        const { error } = await supabase.from('ship_stays').update(payload).eq('id', modalStay.stay.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('ship_stays').insert([payload])
        if (error) throw error
      }

      // Si no tiene fecha de fin, actualizamos la locación actual del buque
      if (!modalStay.stay.end_date) {
        await supabase
          .from('ships')
          .update({ current_location: payload.location })
          .eq('id', payload.ship_id)
      }

      setStatusMessage({ type: 'success', text: 'Movimiento asentado en el Calendario de Estadías.' })
      setModalStay({ isOpen: false, stay: null, defaultShipId: '' })
      await loadInitialData()
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  const handleCloseStayQuick = async (stay) => {
    const today = new Date().toISOString().split('T')[0]
    try {
      const { error } = await supabase
        .from('ship_stays')
        .update({ end_date: today })
        .eq('id', stay.id)

      if (error) throw error
      setStatusMessage({ type: 'success', text: `Cierre de estadía registrado al día ${today}.` })
      await loadInitialData()
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message })
    }
  }

  // ==========================================================================
  // HANDLERS: ARMADORES & PROPIETARIOS
  // ==========================================================================
  const handleOpenNewOwner = () => {
    setModalOwner({
      isOpen: true,
      owner: {
        name: '',
        armador_name: '',
        armador_phone: '',
        email_principal: '',
        email_secundario: '',
        cuit: '',
        notes: ''
      }
    })
  }

  const handleSaveOwner = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    try {
      if (!modalOwner.owner.name.trim()) throw new Error('La Razón Social o Empresa es obligatoria')

      const payload = {
        name: modalOwner.owner.name.trim(),
        armador_name: modalOwner.owner.armador_name?.trim() || null,
        armador_phone: modalOwner.owner.armador_phone?.trim() || null,
        email_principal: modalOwner.owner.email_principal?.trim() || null,
        email_secundario: modalOwner.owner.email_secundario?.trim() || null,
        cuit: modalOwner.owner.cuit?.trim() || null,
        notes: modalOwner.owner.notes?.trim() || null,
        is_active: true
      }

      if (modalOwner.owner.id) {
        const { error } = await supabase.from('owners').update(payload).eq('id', modalOwner.owner.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('owners').insert([payload])
        if (error) throw error
      }

      setStatusMessage({ type: 'success', text: 'Datos de la empresa armadora guardados exitosamente.' })
      setModalOwner({ isOpen: false, owner: null })
      await loadInitialData()
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message })
    } finally {
      setSubmitting(false)
    }
  }

  // ==========================================================================
  // HANDLERS: SOLICITUD DE INFORMACIÓN CON CUADRO DE TEXTO (JORGE SENTIS)
  // ==========================================================================
  const handleOpenRequestInfoModal = (ship) => {
    setModalRequestInfo({
      isOpen: true,
      ship,
      requestType: ship.info_request_status !== 'completo' ? (ship.info_request_status || 'pendiente_jefe_obra') : 'pendiente_jefe_obra',
      notes: ship.info_request_notes || ''
    })
  }

  const handleSendInfoRequestWithNotes = async (e) => {
    e.preventDefault()
    if (!modalRequestInfo.ship) return

    try {
      const ship = modalRequestInfo.ship
      const requestType = modalRequestInfo.requestType
      const notes = modalRequestInfo.notes?.trim() || null

      const { error } = await supabase
        .from('ships')
        .update({
          info_request_status: requestType,
          info_request_notes: notes,
          info_requested_at: new Date().toISOString(),
          info_requested_by: user?.email || 'Jorge Sentis (Administrador)'
        })
        .eq('id', ship.id)

      if (error) throw error
      setStatusMessage({
        type: 'success',
        text: `📢 Se envió la solicitud de carga para "${cleanShipName(ship.name)}" con instrucciones claras (${
          requestType === 'pendiente_maria_jose'
            ? 'María José: Armador & Contactos'
            : requestType === 'pendiente_jefe_obra'
            ? 'Jefes de Obra: Medidas & Ficha Técnica'
            : 'Ambos: María José & Jefes de Obra'
        }).`
      })
      setModalRequestInfo({ isOpen: false, ship: null, requestType: 'pendiente_jefe_obra', notes: '' })
      await loadInitialData()
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message })
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* CABECERA & CONTROL DE PERSPECTIVA */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <Link to="/" className="hover:text-primary transition-colors">Inicio</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-300">Activos Navales</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-primary font-medium">Módulo M1: Barcos, Ficha Técnica & Estadías</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Ship className="w-8 h-8 text-primary" />
            <span>Barcos & Obras en Astillero</span>
          </h1>
        </div>

        {/* SELECTOR DE PERSPECTIVA / ROL DE OPERACIÓN */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1 text-xs shadow-inner">
            <span className="text-[10px] uppercase font-bold text-slate-400 px-2 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Rol Activo:
            </span>
            <button
              type="button"
              onClick={() => {
                setActiveRolePerspective('admin')
                setRoleQuickFilter('todos')
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeRolePerspective === 'admin'
                  ? 'bg-primary text-slate-950 shadow-md ring-1 ring-primary/50'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Jorge Sentis: Crea el barco, define tipo de embarcación y solicita con notas que llenen la información"
            >
              <span>👑 Admin (Jorge)</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveRolePerspective('maria_jose')
                setRoleQuickFilter('todos')
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeRolePerspective === 'maria_jose'
                  ? 'bg-amber-400 text-slate-950 shadow-md ring-1 ring-amber-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="María José: Carga contactos, armador y calendario de estadías"
            >
              <span>📋 María José</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveRolePerspective('jefe_obra')
                setRoleQuickFilter('todos')
              }}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeRolePerspective === 'jefe_obra'
                  ? 'bg-emerald-400 text-slate-950 shadow-md ring-1 ring-emerald-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Jefes de Obra: Cargan medidas, componentes técnicos navales y revisan OTs en ejecución"
            >
              <span>🛠️ Jefe de Obra</span>
            </button>
          </div>

          {/* Botón Nuevo Barco (Visible para Administrador) */}
          {activeRolePerspective === 'admin' && (
            <button
              type="button"
              onClick={handleOpenNewShip}
              className="px-4 py-2 bg-gradient-to-r from-primary to-blue-500 hover:brightness-110 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(0,242,254,0.25)] transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nuevo Buque</span>
            </button>
          )}
        </div>
      </div>

      {/* BANNER EXPLICATIVO DEL ROL ACTIVO (Responde: ¿Qué pasa cuando cambio de rol?) */}
      <div className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all ${
        activeRolePerspective === 'admin'
          ? 'bg-cyan-950/20 border-cyan-500/30 text-cyan-200'
          : activeRolePerspective === 'maria_jose'
          ? 'bg-amber-950/20 border-amber-500/30 text-amber-200'
          : 'bg-emerald-950/20 border-emerald-500/30 text-emerald-200'
      }`}>
        <div className="flex items-start sm:items-center gap-2.5">
          {activeRolePerspective === 'admin' && <ShieldCheck className="w-4 h-4 text-primary shrink-0 mt-0.5 sm:mt-0" />}
          {activeRolePerspective === 'maria_jose' && <Building2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />}
          {activeRolePerspective === 'jefe_obra' && <Wrench className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5 sm:mt-0" />}
          <div>
            <strong className="font-extrabold text-white mr-1.5">
              {activeRolePerspective === 'admin' && 'Modo Administrador (Jorge Sentis):'}
              {activeRolePerspective === 'maria_jose' && 'Modo Administración & Comercial (María José):'}
              {activeRolePerspective === 'jefe_obra' && 'Modo Técnico / Operativo (Jefes de Obra):'}
            </strong>
            <span>
              {activeRolePerspective === 'admin' && 'Control total: Creación de buques, gestión de tipos de embarcación, bajas lógicas y envío de solicitudes con notas e instrucciones claras.'}
              {activeRolePerspective === 'maria_jose' && 'Enfocada en datos de Armadores, teléfonos, emails principales/secundarios y fechas del Calendario de Estadías.'}
              {activeRolePerspective === 'jefe_obra' && 'Enfocado en medidas reales (eslora, manga), inventario técnico (válvulas de casco, tanques, pocetes) y control de OTs activas.'}
            </span>
          </div>
        </div>

        {/* Acceso rápido a tareas del rol */}
        <div className="flex items-center gap-2 shrink-0">
          {activeRolePerspective === 'maria_jose' && (
            <button
              type="button"
              onClick={() => setRoleQuickFilter(prev => prev === 'mis_pendientes' ? 'todos' : 'mis_pendientes')}
              className={`px-2.5 py-1 rounded-lg border font-bold text-[11px] cursor-pointer transition-all ${
                roleQuickFilter === 'mis_pendientes'
                  ? 'bg-amber-400 text-slate-950 border-amber-300'
                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30 hover:bg-amber-500/20'
              }`}
            >
              {roleQuickFilter === 'mis_pendientes' ? '✓ Mostrando pendientes María José' : '⚡ Filtrar pendientes de María José'}
            </button>
          )}

          {activeRolePerspective === 'jefe_obra' && (
            <button
              type="button"
              onClick={() => setRoleQuickFilter(prev => prev === 'mis_pendientes' ? 'todos' : 'mis_pendientes')}
              className={`px-2.5 py-1 rounded-lg border font-bold text-[11px] cursor-pointer transition-all ${
                roleQuickFilter === 'mis_pendientes'
                  ? 'bg-emerald-400 text-slate-950 border-emerald-300'
                  : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/20'
              }`}
            >
              {roleQuickFilter === 'mis_pendientes' ? '✓ Mostrando pendientes Jefe de Obra' : '⚡ Filtrar pendientes de Jefe de Obra'}
            </button>
          )}
        </div>
      </div>

      {/* MENSAJE DE ESTADO */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-start justify-between gap-3 transition-all ${
          statusMessage.type === 'success'
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            : statusMessage.type === 'info'
            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          <div className="flex items-start gap-2.5">
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            )}
            <div className="text-xs font-semibold leading-relaxed">{statusMessage.text}</div>
          </div>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* KPIS CLICKEABLES INTERACTIVOS (Filtran al dar clic) */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* KPI 1: Total Buques */}
        <div
          onClick={() => handleKpiClick('todos')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all relative group ${
            locationFilter === 'todos' && requestFilter === 'todos' && roleQuickFilter === 'todos'
              ? 'bg-slate-900 border-primary/60 ring-2 ring-primary/30 shadow-lg'
              : 'bg-slate-900/80 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
          }`}
          title="Clic para ver todos los buques registrados"
        >
          <div className="text-[11px] font-bold uppercase text-slate-400 flex items-center justify-between gap-1.5 mb-1">
            <span className="flex items-center gap-1.5">
              <Ship className="w-3.5 h-3.5 text-cyan-400" /> Total Buques
            </span>
            {locationFilter === 'todos' && requestFilter === 'todos' && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-primary/20 text-primary font-mono font-bold">ACTIVO</span>
            )}
          </div>
          <div className="text-2xl font-black text-white font-mono">{totalShips}</div>
          <div className="text-[10px] text-slate-500 mt-0.5 group-hover:text-cyan-400 transition-colors">
            Clic para quitar filtros
          </div>
        </div>

        {/* KPI 2: En Varadero Alon Car */}
        <div
          onClick={() => handleKpiClick('VARADERO ALON CAR')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all relative group ${
            locationFilter === 'VARADERO ALON CAR'
              ? 'bg-cyan-950/70 border-cyan-400 ring-2 ring-cyan-400/50 shadow-lg'
              : 'bg-cyan-950/20 border-cyan-500/30 hover:border-cyan-400/60 hover:bg-cyan-950/30'
          }`}
          title="Clic para filtrar solo barcos en Varadero Alon Car (Puesta en seco)"
        >
          <div className="text-[11px] font-bold uppercase text-cyan-300 flex items-center justify-between gap-1.5 mb-1">
            <span className="flex items-center gap-1.5">
              <Anchor className="w-3.5 h-3.5 text-cyan-400" /> En Varadero
            </span>
            {locationFilter === 'VARADERO ALON CAR' && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-400 text-slate-950 font-mono font-bold">FILTRANDO</span>
            )}
          </div>
          <div className="text-2xl font-black text-cyan-200 font-mono">{varaderoCount}</div>
          <div className="text-[10px] text-cyan-400/70 mt-0.5 group-hover:text-cyan-300">
            {locationFilter === 'VARADERO ALON CAR' ? '⚡ Clic para deseleccionar' : 'Clic para filtrar'}
          </div>
        </div>

        {/* KPI 3: En Muelle Alon Car */}
        <div
          onClick={() => handleKpiClick('MUELLE ALON CAR')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all relative group ${
            locationFilter === 'MUELLE ALON CAR'
              ? 'bg-blue-950/70 border-blue-400 ring-2 ring-blue-400/50 shadow-lg'
              : 'bg-blue-950/20 border-blue-500/30 hover:border-blue-400/60 hover:bg-blue-950/30'
          }`}
          title="Clic para filtrar barcos a flote en Muelle Alon Car"
        >
          <div className="text-[11px] font-bold uppercase text-blue-300 flex items-center justify-between gap-1.5 mb-1">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-blue-400" /> En Muelle
            </span>
            {locationFilter === 'MUELLE ALON CAR' && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-blue-400 text-slate-950 font-mono font-bold">FILTRANDO</span>
            )}
          </div>
          <div className="text-2xl font-black text-blue-200 font-mono">{muelleCount}</div>
          <div className="text-[10px] text-blue-400/70 mt-0.5 group-hover:text-blue-300">
            {locationFilter === 'MUELLE ALON CAR' ? '⚡ Clic para deseleccionar' : 'Clic para filtrar'}
          </div>
        </div>

        {/* KPI 4: Puertos Aldana */}
        <div
          onClick={() => handleKpiClick('PUERTO')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all relative group ${
            locationFilter === 'PUERTO'
              ? 'bg-purple-950/70 border-purple-400 ring-2 ring-purple-400/50 shadow-lg'
              : 'bg-purple-950/20 border-purple-500/30 hover:border-purple-400/60 hover:bg-purple-950/30'
          }`}
          title="Clic para filtrar barcos en puertos externos Aldana"
        >
          <div className="text-[11px] font-bold uppercase text-purple-300 flex items-center justify-between gap-1.5 mb-1">
            <span className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-purple-400" /> Puertos Aldana
            </span>
            {locationFilter === 'PUERTO' && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-purple-400 text-slate-950 font-mono font-bold">FILTRANDO</span>
            )}
          </div>
          <div className="text-2xl font-black text-purple-200 font-mono">{puertoCount}</div>
          <div className="text-[10px] text-purple-400/70 mt-0.5 group-hover:text-purple-300">
            {locationFilter === 'PUERTO' ? '⚡ Clic para deseleccionar' : 'Clic para filtrar'}
          </div>
        </div>

        {/* KPI 5: Solicitudes Pendientes */}
        <div
          onClick={() => handleKpiClick('pendientes')}
          className={`p-4 rounded-2xl border cursor-pointer transition-all relative group ${
            requestFilter === 'pendientes'
              ? 'bg-amber-950/70 border-amber-400 ring-2 ring-amber-400/50 shadow-lg'
              : 'bg-amber-950/20 border-amber-500/30 hover:border-amber-400/60 hover:bg-amber-950/30'
          }`}
          title="Clic para ver buques con solicitud de carga pendiente (María José o Jefes de Obra)"
        >
          <div className="text-[11px] font-bold uppercase text-amber-300 flex items-center justify-between gap-1.5 mb-1">
            <span className="flex items-center gap-1.5">
              <BellRing className="w-3.5 h-3.5 text-amber-400" /> Solicitudes
            </span>
            {requestFilter === 'pendientes' && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-amber-400 text-slate-950 font-mono font-bold">FILTRANDO</span>
            )}
          </div>
          <div className="text-2xl font-black text-amber-200 font-mono">{pendingRequestsCount}</div>
          <div className="text-[10px] text-amber-400/70 mt-0.5 group-hover:text-amber-300">
            {requestFilter === 'pendientes' ? '⚡ Clic para deseleccionar' : 'Clic para filtrar'}
          </div>
        </div>
      </div>

      {/* NAVEGACIÓN ENTRE PESTAÑAS PRINCIPALES */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('buques')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'buques'
                ? 'bg-primary text-slate-950 shadow-md ring-1 ring-primary/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Ship className="w-4 h-4" />
            <span>1. Buques & Fichas Técnicas ({ships.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('movimientos')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'movimientos'
                ? 'bg-cyan-500 text-slate-950 shadow-md ring-1 ring-cyan-400/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>2. Calendario de Movimientos (Estadías) ({stays.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('armadores')}
            className={`px-4 py-2.5 rounded-xl font-extrabold text-xs flex items-center gap-2 cursor-pointer transition-all ${
              activeTab === 'armadores'
                ? 'bg-amber-400 text-slate-950 shadow-md ring-1 ring-amber-400/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>3. Armadores, Propietarios & Contactos ({owners.length})</span>
          </button>
        </div>

        {/* SWITCHER DE VISTA EN TAB 1: FILAS (TABLA) VS TARJETAS (FICHAS) */}
        {activeTab === 'buques' && (
          <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setViewMode('tabla')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                viewMode === 'tabla'
                  ? 'bg-primary text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Vista tipo tabla con renglones como en Órdenes de Trabajo"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Vista Filas</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('tarjetas')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                viewMode === 'tarjetas'
                  ? 'bg-primary text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Vista tipo fichas / tarjetas individuales"
            >
              <ClipboardList className="w-3.5 h-3.5" />
              <span>Vista Fichas</span>
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* PESTAÑA 1: BUQUES & FICHAS TÉCNICAS (VISTA FILAS / VISTA TARJETAS)       */}
      {/* ========================================================================= */}
      {activeTab === 'buques' && (
        <div className="space-y-4">
          {/* BARRA DE BÚSQUEDA Y FILTROS */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/60 p-3 rounded-2xl border border-slate-800">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nombre de buque, tipo, armador, matrícula o locación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-primary font-bold"
              >
                <option value="todos">Todas las Locaciones</option>
                <option value="VARADERO ALON CAR">Varadero Alon Car</option>
                <option value="MUELLE ALON CAR">Muelle Alon Car</option>
                <option value="PUERTO">Puertos Externos (Aldana)</option>
              </select>

              <select
                value={requestFilter}
                onChange={(e) => setRequestFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-primary font-bold"
              >
                <option value="todos">Todos los Estados</option>
                <option value="pendientes">⚠️ Con Solicitud Activa</option>
                <option value="completos">✅ Datos Completos</option>
              </select>

              {(locationFilter !== 'todos' || requestFilter !== 'todos' || roleQuickFilter !== 'todos' || searchTerm) && (
                <button
                  type="button"
                  onClick={() => {
                    setLocationFilter('todos')
                    setRequestFilter('todos')
                    setRoleQuickFilter('todos')
                    setSearchTerm('')
                  }}
                  className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                  title="Limpiar todos los filtros"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Limpiar</span>
                </button>
              )}
            </div>
          </div>

          {/* VISTA FILAS / TABLA (Estilo Órdenes de Trabajo) */}
          {viewMode === 'tabla' && (
            <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 bg-slate-950/90 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                      <th className="py-3 px-3">Buque</th>
                      <th className="py-3 px-3">Tipo</th>
                      <th className="py-3 px-3">Locación Actual</th>
                      <th className="py-3 px-3">Dimensiones (Eslora × Manga)</th>
                      <th className="py-3 px-3">OTs Activas</th>
                      <th className="py-3 px-3">Armador / Empresa</th>
                      <th className="py-3 px-3">Estado / Solicitud</th>
                      <th className="py-3 px-3 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredShips.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-10 text-center text-slate-500">
                          No se encontraron buques con los filtros seleccionados.
                        </td>
                      </tr>
                    ) : (
                      filteredShips.map(ship => {
                        const cleanName = cleanShipName(ship.name)
                        const hasPendingReq = ship.info_request_status && ship.info_request_status !== 'completo'
                        const otMetrics = getShipOtMetrics[ship.id] || { total: 0, active: 0, shipWos: [], activeWos: [] }

                        return (
                          <tr
                            key={ship.id}
                            className={`hover:bg-slate-800/40 transition-colors align-top ${
                              hasPendingReq ? 'bg-amber-500/[0.02]' : ''
                            }`}
                          >
                            {/* 1. Buque (Nombre, Matrícula, Inactivo) */}
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-2">
                                <Ship className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                                <div>
                                  <div className="font-extrabold text-sm text-white tracking-tight flex items-center gap-1.5">
                                    <span>{cleanName}</span>
                                    {ship.is_active === false && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-950/80 text-rose-300 border border-rose-700 font-bold">
                                        Inactivo
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                                    {ship.matricula ? `Mat: ${ship.matricula}` : 'Sin matrícula'}
                                  </div>
                                </div>
                              </div>
                            </td>

                            {/* 2. Tipo de Embarcación */}
                            <td className="py-3.5 px-3">
                              <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-200 font-bold text-[11px]">
                                {ship.vessel_type || 'Pesquero'}
                              </span>
                            </td>

                            {/* 3. Locación Actual */}
                            <td className="py-3.5 px-3 font-mono">
                              <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold ${
                                ship.current_location === 'VARADERO ALON CAR'
                                  ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                                  : ship.current_location === 'MUELLE ALON CAR'
                                  ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                                  : 'bg-purple-950/80 text-purple-300 border-purple-800'
                              }`}>
                                {ship.current_location || 'VARADERO ALON CAR'}
                              </span>
                            </td>

                            {/* 4. Dimensiones Navales */}
                            <td className="py-3.5 px-3">
                              <div className="font-mono text-xs font-bold text-white">
                                {ship.eslora_mts ? `${ship.eslora_mts}m` : 'S/D'} × {ship.manga_mts ? `${ship.manga_mts}m` : 'S/D'}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                Puntal: {ship.puntal_mts ? `${ship.puntal_mts}m` : '—'} • Casco: {ship.superficie_casco_m2 ? `${ship.superficie_casco_m2}m²` : '—'}
                              </div>
                            </td>

                            {/* 5. OTs Activas (Suma y cálculo preciso) */}
                            <td className="py-3.5 px-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {otMetrics.active > 0 ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-300 border border-emerald-700/80 font-bold text-[11px] font-mono">
                                    {otMetrics.active} en ejecución
                                  </span>
                                ) : (
                                  <span className="text-slate-500 font-mono text-[11px]">
                                    0 en ejecución
                                  </span>
                                )}
                              </div>
                              <div className="mt-1">
                                <Link
                                  to="/ots"
                                  className="text-[10px] text-cyan-400 hover:text-cyan-300 underline font-bold"
                                  title="Ver Órdenes de Trabajo en el módulo de OTs"
                                >
                                  Ver OTs ({otMetrics.total}) &rarr;
                                </Link>
                              </div>
                            </td>

                            {/* 6. Armador / Contacto */}
                            <td className="py-3.5 px-3">
                              <div className="font-bold text-slate-200 truncate max-w-[170px]" title={ship.owners?.name}>
                                {ship.owners?.name || ship.client_name || 'Sin asignar'}
                              </div>
                              {ship.owners?.armador_name && (
                                <div className="text-[11px] text-amber-300/90 font-medium">
                                  Armador: {ship.owners.armador_name}
                                </div>
                              )}
                              {ship.owners?.armador_phone && (
                                <a
                                  href={`tel:${ship.owners.armador_phone}`}
                                  className="text-[10px] text-slate-400 hover:text-cyan-300 font-mono flex items-center gap-1 mt-0.5"
                                >
                                  <Phone className="w-2.5 h-2.5 text-cyan-400" />
                                  <span>{ship.owners.armador_phone}</span>
                                </a>
                              )}
                            </td>

                            {/* 7. Estado / Solicitud con Instrucciones */}
                            <td className="py-3.5 px-3 max-w-[200px]">
                              {hasPendingReq ? (
                                <div className="space-y-1">
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                                    <BellRing className="w-3 h-3 text-amber-400" />
                                    <span>
                                      {ship.info_request_status === 'pendiente_maria_jose'
                                        ? 'María José'
                                        : ship.info_request_status === 'pendiente_jefe_obra'
                                        ? 'Jefe de Obra'
                                        : 'Ambos'}
                                    </span>
                                  </span>
                                  {ship.info_request_notes && (
                                    <p className="text-[10px] text-slate-300 line-clamp-2 italic bg-slate-950/70 p-1.5 rounded border border-slate-800" title={ship.info_request_notes}>
                                      &ldquo;{ship.info_request_notes}&rdquo;
                                    </p>
                                  )}
                                </div>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold">
                                  <Check className="w-3 h-3" />
                                  <span>Completo</span>
                                </span>
                              )}
                            </td>

                            {/* 8. Acciones */}
                            <td className="py-3.5 px-3 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenShip360(ship)}
                                  className="px-2.5 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold cursor-pointer transition-all flex items-center gap-1"
                                  title="Abrir Ficha Técnica 360°, Armador y Componentes"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Ficha 360°</span>
                                </button>

                                {activeRolePerspective === 'admin' && (
                                  <button
                                    type="button"
                                    onClick={() => handleOpenRequestInfoModal(ship)}
                                    className="p-1.5 text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg border border-amber-500/30 cursor-pointer transition-all"
                                    title="Solicitar carga de info a María José o Jefe de Obra con instrucciones escritas"
                                  >
                                    <BellRing className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleOpenEditShip(ship)}
                                  className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg cursor-pointer transition-all"
                                  title="Editar barco y tipo de embarcación"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                {activeRolePerspective === 'admin' && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleShipActive(ship)}
                                    className={`p-1.5 rounded-lg cursor-pointer transition-all ${
                                      ship.is_active === false
                                        ? 'text-emerald-400 hover:bg-emerald-950/60'
                                        : 'text-slate-500 hover:text-rose-400 hover:bg-rose-950/60'
                                    }`}
                                    title={ship.is_active === false ? 'Reactivar Buque' : 'Baja lógica (Inactivar)'}
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

          {/* VISTA TARJETAS / FICHAS */}
          {viewMode === 'tarjetas' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredShips.map(ship => {
                const cleanName = cleanShipName(ship.name)
                const hasPendingReq = ship.info_request_status && ship.info_request_status !== 'completo'
                const otMetrics = getShipOtMetrics[ship.id] || { total: 0, active: 0, shipWos: [], activeWos: [] }

                return (
                  <div
                    key={ship.id}
                    className={`rounded-2xl border p-5 transition-all relative flex flex-col justify-between ${
                      hasPendingReq
                        ? 'bg-slate-900/90 border-amber-500/40 hover:border-amber-400 shadow-sm'
                        : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Header de la tarjeta */}
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-extrabold text-base text-white tracking-tight">
                              {cleanName}
                            </h3>
                            {ship.is_active === false && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-700/50 font-bold">
                                Inactivo
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-400 mt-0.5">
                            {ship.vessel_type || 'Pesquero'} {ship.matricula ? `• Matrícula: ${ship.matricula}` : ''}
                          </div>
                        </div>

                        {/* Locación Badge */}
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border font-mono ${
                          ship.current_location === 'VARADERO ALON CAR'
                            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                            : ship.current_location === 'MUELLE ALON CAR'
                            ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                            : 'bg-purple-950/80 text-purple-300 border-purple-800'
                        }`}>
                          {ship.current_location || 'VARADERO ALON CAR'}
                        </span>
                      </div>

                      {/* Alerta de Solicitud de Carga con Notas */}
                      {hasPendingReq && (
                        <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 font-bold">
                              <BellRing className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                              <span>
                                {ship.info_request_status === 'pendiente_maria_jose'
                                  ? 'Solicitado a María José'
                                  : ship.info_request_status === 'pendiente_jefe_obra'
                                  ? 'Solicitado a Jefe de Obra'
                                  : 'Solicitado a María José y Jefes de Obra'}
                              </span>
                            </div>
                            {(activeRolePerspective === 'maria_jose' || activeRolePerspective === 'jefe_obra') && (
                              <button
                                type="button"
                                onClick={() => handleMarkRequestComplete(ship)}
                                className="px-2 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold cursor-pointer"
                                title="Marcar solicitud como cumplida"
                              >
                                ✓ Listo
                              </button>
                            )}
                          </div>
                          {ship.info_request_notes && (
                            <p className="text-[10px] text-slate-300 italic bg-slate-950/60 p-1.5 rounded border border-slate-800/80">
                              💬 &ldquo;{ship.info_request_notes}&rdquo;
                            </p>
                          )}
                        </div>
                      )}

                      {/* Datos Clave (Eslora, Manga, OTs Activas) */}
                      <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block font-medium">Eslora / Manga</span>
                          <strong className="text-white font-mono">
                            {ship.eslora_mts ? `${ship.eslora_mts}m` : 'S/D'} × {ship.manga_mts ? `${ship.manga_mts}m` : 'S/D'}
                          </strong>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                          <span className="text-[10px] text-slate-400 block font-medium">OTs Activas</span>
                          <strong className={`${otMetrics.active > 0 ? 'text-emerald-400' : 'text-slate-400'} font-mono`}>
                            {otMetrics.active} en ejecución
                          </strong>
                        </div>
                      </div>

                      {/* Propietario / Armador */}
                      <div className="text-xs text-slate-300 border-t border-slate-800/80 pt-2 flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Armador / Empresa:</span>
                        <strong className="text-white truncate max-w-[180px]">
                          {ship.owners?.armador_name || ship.owners?.name || ship.client_name || 'Sin asignar'}
                        </strong>
                      </div>
                    </div>

                    {/* Acciones de la Tarjeta */}
                    <div className="pt-4 border-t border-slate-800/80 flex items-center justify-between gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => handleOpenShip360(ship)}
                        className="px-3 py-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/40 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Ficha 360°</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {activeRolePerspective === 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleOpenRequestInfoModal(ship)}
                            className="p-1.5 text-amber-400 hover:text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 rounded-lg border border-amber-500/30 cursor-pointer transition-all"
                            title="Solicitar carga de información con instrucciones"
                          >
                            <BellRing className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleOpenEditShip(ship)}
                          className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                          title="Editar barco y tipo"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        {activeRolePerspective === 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleToggleShipActive(ship)}
                            className={`p-1.5 rounded-lg cursor-pointer ${
                              ship.is_active === false ? 'text-emerald-400 hover:bg-emerald-950/60' : 'text-slate-400 hover:text-rose-400 hover:bg-slate-800'
                            }`}
                            title={ship.is_active === false ? 'Reactivar' : 'Baja lógica'}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: CALENDARIO DE MOVIMIENTOS & ESTADÍAS (REEMPLAZO EXCEL LEGACY) */}
      {/* ========================================================================= */}
      {activeTab === 'movimientos' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-cyan-400" />
                <span>Calendario de Movimientos & Estadías</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Cálculo automático de días de permanencia: <code>Fin - Comienzo + 1</code>. Si la fecha de fin está vacía, acumula en vivo con <code>=HOY()</code>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => handleOpenNewStay()}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>+ Registrar Movimiento</span>
            </button>
          </div>

          {/* TABLA DE ESTADÍAS EXACTA A LA HOJA EXCEL */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-slate-800 bg-slate-950 text-slate-400 font-bold uppercase text-[10px] tracking-wider">
                    <th className="py-3 px-4">LOCACIÓN / ESTADÍA</th>
                    <th className="py-3 px-4">BARCO</th>
                    <th className="py-3 px-4 text-center">Comienzo</th>
                    <th className="py-3 px-4 text-center">Fin</th>
                    <th className="py-3 px-4 text-center text-cyan-300">Días que estuvo el barco</th>
                    <th className="py-3 px-4 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80 text-xs font-medium">
                  {filteredStays.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-8 text-slate-500">
                        No hay movimientos registrados todavía. Tocá &ldquo;+ Registrar Movimiento&rdquo; para asentar el primer ingreso.
                      </td>
                    </tr>
                  ) : (
                    filteredStays.map(stay => {
                      const isOngoing = !stay.end_date
                      const days = calculateStayDays(stay.start_date, stay.end_date)
                      const isVaradero = stay.location === 'VARADERO ALON CAR'
                      const isMuelle = stay.location === 'MUELLE ALON CAR'

                      return (
                        <tr key={stay.id} className="hover:bg-slate-800/40 transition-colors">
                          {/* Locación */}
                          <td className="py-3 px-4 font-bold">
                            <span className={`px-2.5 py-1 rounded-lg border text-[11px] font-mono ${
                              isVaradero
                                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800'
                                : isMuelle
                                ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                                : 'bg-amber-950/80 text-amber-300 border-amber-800'
                            }`}>
                              {stay.location}
                            </span>
                          </td>

                          {/* Barco */}
                          <td className="py-3 px-4 font-extrabold text-white text-sm">
                            {cleanShipName(stay.ships?.name)}
                          </td>

                          {/* Fecha Comienzo */}
                          <td className="py-3 px-4 text-center font-mono text-slate-200">
                            {stay.start_date}
                          </td>

                          {/* Fecha Fin */}
                          <td className="py-3 px-4 text-center font-mono">
                            {stay.end_date ? (
                              <span className="text-slate-200">{stay.end_date}</span>
                            ) : (
                              <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-bold">
                                En curso (=HOY)
                              </span>
                            )}
                          </td>

                          {/* Días Calculados */}
                          <td className="py-3 px-4 text-center font-mono font-black text-sm text-cyan-300">
                            {days} {days === 1 ? 'día' : 'días'}
                          </td>

                          {/* Acciones */}
                          <td className="py-3 px-4 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              {isOngoing && (
                                <button
                                  type="button"
                                  onClick={() => handleCloseStayQuick(stay)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold cursor-pointer transition-all"
                                  title="Cerrar fecha de salida de esta locación"
                                >
                                  Cerrar Salida
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setModalStay({ isOpen: true, stay, defaultShipId: stay.ship_id })}
                                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                                title="Editar movimiento"
                              >
                                <Pencil className="w-3.5 h-3.5" />
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
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 3: ARMADORES, PROPIETARIOS & CONTACTOS                            */}
      {/* ========================================================================= */}
      {activeTab === 'armadores' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-400" />
                <span>Empresas Armadoras & Contactos (María José)</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Empresas armadoras propietarias de los buques, teléfonos de contacto directo y correos dobles para operaciones y facturación.
              </p>
            </div>
            <button
              type="button"
              onClick={handleOpenNewOwner}
              className="px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nueva Empresa Armadora</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {owners.map(owner => {
              const ownerShips = ships.filter(s => s.owner_id === owner.id)
              return (
                <div key={owner.id} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-amber-400 shrink-0" />
                        <div>
                          <h3 className="font-extrabold text-white text-sm">{owner.name}</h3>
                          {owner.cuit && <span className="text-[10px] text-slate-400 font-mono">CUIT: {owner.cuit}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setModalOwner({ isOpen: true, owner })}
                        className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                        title="Editar armador"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Datos del Armador y Contacto */}
                    <div className="space-y-1.5 text-xs text-slate-300 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80 font-mono">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Armador:</span>
                        <strong className="text-white">{owner.armador_name || 'No informado'}</strong>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400 text-[11px]">Teléfono Armador:</span>
                        {owner.armador_phone ? (
                          <a href={`tel:${owner.armador_phone}`} className="text-cyan-400 hover:underline flex items-center gap-1 font-bold">
                            <Phone className="w-3 h-3" />
                            <span>{owner.armador_phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-500">S/D</span>
                        )}
                      </div>
                      <div className="border-t border-slate-800 pt-1.5 space-y-1 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Mail Principal:</span>
                          <span className="text-slate-200 truncate max-w-[170px]">{owner.email_principal || '—'}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-slate-400">Mail Secundario:</span>
                          <span className="text-slate-200 truncate max-w-[170px]">{owner.email_secundario || '—'}</span>
                        </div>
                      </div>
                    </div>

                    {/* Flota de buques vinculada */}
                    <div className="text-xs pt-1">
                      <span className="text-slate-400 text-[11px] block mb-1">Buques de este Armador ({ownerShips.length}):</span>
                      <div className="flex flex-wrap gap-1">
                        {ownerShips.length === 0 ? (
                          <span className="text-slate-500 text-[10px]">Sin buques vinculados</span>
                        ) : (
                          ownerShips.map(s => (
                            <span key={s.id} className="px-2 py-0.5 rounded bg-slate-800 text-slate-200 text-[10px] font-bold border border-slate-700">
                              {cleanShipName(s.name)}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: FICHA 360° DEL BUQUE                                               */}
      {/* ========================================================================= */}
      {selectedShip360 && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto p-5 md:p-6 shadow-2xl space-y-5">
            {/* Cabecera Modal */}
            <div className="flex items-start justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-primary">
                  <Ship className="w-7 h-7" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl md:text-2xl font-black text-white tracking-tight">
                      {cleanShipName(selectedShip360.name)}
                    </h2>
                    <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-xs font-mono border border-slate-700">
                      {selectedShip360.vessel_type || 'Pesquero'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 flex items-center gap-2 mt-0.5">
                    <span>Matrícula: <strong className="text-slate-200 font-mono">{selectedShip360.matricula || 'S/D'}</strong></span>
                    <span>•</span>
                    <span>Locación Actual: <strong className="text-cyan-300 font-mono">{selectedShip360.current_location || 'VARADERO ALON CAR'}</strong></span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedShip360(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Alerta de Solicitud de Carga si está pendiente */}
            {selectedShip360.info_request_status && selectedShip360.info_request_status !== 'completo' && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-bold">
                    <BellRing className="w-4 h-4 text-amber-400 shrink-0" />
                    <span>
                      Solicitud Pendiente ({selectedShip360.info_request_status === 'pendiente_maria_jose' ? 'María José' : selectedShip360.info_request_status === 'pendiente_jefe_obra' ? 'Jefe de Obra' : 'María José y Jefes de Obra'})
                    </span>
                  </div>
                  {selectedShip360.info_request_notes && (
                    <p className="text-[11px] text-slate-300 italic bg-slate-950/70 p-2 rounded border border-slate-800">
                      💬 Instrucciones de Jorge Sentis (Admin): &ldquo;{selectedShip360.info_request_notes}&rdquo;
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleMarkRequestComplete(selectedShip360)}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/40 text-emerald-300 border border-emerald-500/40 text-xs font-bold cursor-pointer shrink-0 self-start sm:self-auto"
                >
                  ✓ Marcar como Completado
                </button>
              </div>
            )}

            {/* Subpestañas Ficha 360 */}
            <div className="flex items-center gap-2 border-b border-slate-800 pb-2 text-xs">
              <button
                type="button"
                onClick={() => setSubTab360('tecnica')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  subTab360 === 'tecnica'
                    ? 'bg-primary text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>Ficha Técnica Naval (Jefe de Obra)</span>
              </button>

              <button
                type="button"
                onClick={() => setSubTab360('armador')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  subTab360 === 'armador'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Armador & Contactos (María José)</span>
              </button>

              <button
                type="button"
                onClick={() => setSubTab360('movimientos')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  subTab360 === 'movimientos'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Historial de Movimientos</span>
              </button>

              <button
                type="button"
                onClick={() => setSubTab360('ots')}
                className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  subTab360 === 'ots'
                    ? 'bg-emerald-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Órdenes de Trabajo ({getShipOtMetrics[selectedShip360.id]?.total || 0})</span>
              </button>
            </div>

            {/* CONTENIDO SUBPESTAÑAS */}
            <div className="space-y-4 pt-1">
              {/* SUBPESTAÑA 1: FICHA TÉCNICA DINÁMICA */}
              {subTab360 === 'tecnica' && (
                <div className="space-y-4">
                  {/* Dimensiones Principales */}
                  <div>
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                      Medidas Principales de Casco
                    </span>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-mono">Eslora</span>
                        <strong className="text-base text-white font-mono">{selectedShip360.eslora_mts ? `${selectedShip360.eslora_mts} m` : 'S/D'}</strong>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-mono">Manga</span>
                        <strong className="text-base text-white font-mono">{selectedShip360.manga_mts ? `${selectedShip360.manga_mts} m` : 'S/D'}</strong>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-mono">Puntal</span>
                        <strong className="text-base text-white font-mono">{selectedShip360.puntal_mts ? `${selectedShip360.puntal_mts} m` : 'S/D'}</strong>
                      </div>
                      <div className="p-3 rounded-xl bg-slate-950 border border-slate-800">
                        <span className="text-[10px] text-slate-400 block font-mono">Superficie de Casco</span>
                        <strong className="text-base text-cyan-300 font-mono">{selectedShip360.superficie_casco_m2 ? `${selectedShip360.superficie_casco_m2} m²` : 'S/D'}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Componentes Técnicos Dinámicos (JSONB) */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                        Componentes & Válvulas a Bordo
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          handleOpenEditShip(selectedShip360)
                          setSelectedShip360(null)
                        }}
                        className="text-xs text-primary hover:underline font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Pencil className="w-3 h-3" />
                        <span>Editar Ficha Técnica</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                      {DEFAULT_TECH_COMPONENTS.map(comp => {
                        const compData = (selectedShip360.technical_specs || {})[comp.key] || { quantity: 0, notes: '' }
                        return (
                          <div key={comp.key} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                            <div className="flex items-center justify-between">
                              <strong className="text-white text-xs">{comp.label}</strong>
                              <span className={`px-2 py-0.5 rounded font-mono font-bold text-[11px] ${
                                compData.quantity > 0
                                  ? 'bg-cyan-950 text-cyan-300 border border-cyan-800'
                                  : 'bg-slate-900 text-slate-500'
                              }`}>
                                Cantidad: {compData.quantity}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-400">
                              {compData.notes ? compData.notes : 'Sin observaciones cargadas a bordo.'}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SUBPESTAÑA 2: ARMADOR & CONTACTOS */}
              {subTab360 === 'armador' && (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Razón Social:</span>
                      <strong className="text-white text-sm">{selectedShip360.owners?.name || selectedShip360.client_name || 'Sin asignar'}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Nombre del Armador:</span>
                      <strong className="text-amber-300">{selectedShip360.owners?.armador_name || 'No informado'}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Teléfono Armador:</span>
                      <strong className="text-cyan-300">{selectedShip360.owners?.armador_phone || 'No informado'}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Email Principal:</span>
                      <strong className="text-slate-200">{selectedShip360.owners?.email_principal || 'No informado'}</strong>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Email Secundario:</span>
                      <strong className="text-slate-200">{selectedShip360.owners?.email_secundario || 'No informado'}</strong>
                    </div>
                  </div>
                </div>
              )}

              {/* SUBPESTAÑA 3: MOVIMIENTOS */}
              {subTab360 === 'movimientos' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Historial de Estadías de este barco:</span>
                    <button
                      type="button"
                      onClick={() => handleOpenNewStay(selectedShip360.id)}
                      className="px-3 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      + Registrar Movimiento
                    </button>
                  </div>
                  {stays.filter(s => s.ship_id === selectedShip360.id).length === 0 ? (
                    <div className="p-5 text-center text-slate-500 text-xs">
                      Sin movimientos registrados aún para este barco.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {stays.filter(s => s.ship_id === selectedShip360.id).map(st => {
                        const days = calculateStayDays(st.start_date, st.end_date)
                        return (
                          <div key={st.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                            <div>
                              <strong className="text-white block">{st.location}</strong>
                              <span className="text-slate-400 text-[11px]">
                                {st.start_date} &rarr; {st.end_date || 'En curso (=HOY)'}
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-black text-cyan-300 font-mono block">
                                {days} {days === 1 ? 'día' : 'días'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* SUBPESTAÑA 4: OTS Y TRABAJOS (Con cálculo real de estado e items) */}
              {subTab360 === 'ots' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">
                      Órdenes de Trabajo vinculadas ({getShipOtMetrics[selectedShip360.id]?.total || 0}):
                    </span>
                    <Link
                      to="/ots"
                      className="text-xs font-bold text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1"
                    >
                      <span>Ir a Órdenes de Trabajo</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>

                  {workOrders.filter(w => w.ship_id === selectedShip360.id).length === 0 ? (
                    <div className="p-5 text-center text-slate-500 text-xs">
                      Sin Órdenes de Trabajo abiertas para este barco.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {workOrders.filter(w => w.ship_id === selectedShip360.id).map(wo => {
                        const items = workItems.filter(i => i.work_order_id === wo.id)
                        const inExecutionItems = items.filter(i => i.status === 'En ejecución')
                        const isExecution = inExecutionItems.length > 0 || wo.status === 'En Progreso' || wo.status === 'En ejecución'

                        return (
                          <div key={wo.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2 text-xs">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-primary font-black px-1.5 py-0.5 rounded bg-primary/10 border border-primary/30">
                                  {wo.ot_number || 'OT'}
                                </span>
                                <strong className="text-white text-sm">{wo.title}</strong>
                              </div>
                              <span className={`px-2.5 py-1 rounded text-[10px] font-bold ${
                                isExecution
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : 'bg-slate-900 text-slate-400 border border-slate-700'
                              }`}>
                                {isExecution ? `En ejecución (${inExecutionItems.length}/${items.length} act.)` : wo.status}
                              </span>
                            </div>

                            {/* Detalle de trabajos dentro de esta OT */}
                            {items.length > 0 && (
                              <div className="pl-3 border-l-2 border-slate-800 space-y-1 text-[11px]">
                                {items.map(it => (
                                  <div key={it.id} className="flex items-center justify-between text-slate-300">
                                    <span className="truncate max-w-[400px]">• {it.description}</span>
                                    <span className={`font-mono font-bold text-[10px] ${
                                      it.status === 'En ejecución' ? 'text-emerald-400' : 'text-slate-500'
                                    }`}>
                                      {it.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ALTA Y EDICIÓN DE BUQUE (DATOS CORE + TIPO EDITABLE)              */}
      {/* ========================================================================= */}
      {modalShip.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto p-5 md:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Ship className="w-5 h-5 text-primary" />
                <span>{modalShip.ship.id ? 'Editar Buque' : 'Alta de Nuevo Buque (Administrador)'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalShip({ isOpen: false, ship: null, isCustomVesselType: false, customVesselTypeVal: '' })}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShip} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Nombre del buque */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Nombre del Buque *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: TRITON I"
                    value={modalShip.ship.name}
                    onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, name: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary uppercase font-bold"
                  />
                </div>

                {/* Empresa Propietaria / Armador */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Empresa Propietaria / Armador
                  </label>
                  <select
                    value={modalShip.ship.owner_id || ''}
                    onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, owner_id: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-medium"
                  >
                    <option value="">-- Seleccionar Armador --</option>
                    {owners.map(o => (
                      <option key={o.id} value={o.id}>{o.name} {o.armador_name ? `(${o.armador_name})` : ''}</option>
                    ))}
                  </select>
                </div>

                {/* Tipo de Embarcación (Editable con opción de crear otra) */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Tipo de Embarcación
                  </label>
                  <select
                    value={modalShip.isCustomVesselType ? '__otro__' : (modalShip.ship.vessel_type || 'Pesquero')}
                    onChange={(e) => {
                      if (e.target.value === '__otro__') {
                        setModalShip({
                          ...modalShip,
                          isCustomVesselType: true,
                          customVesselTypeVal: modalShip.ship.vessel_type || ''
                        })
                      } else {
                        setModalShip({
                          ...modalShip,
                          isCustomVesselType: false,
                          ship: { ...modalShip.ship, vessel_type: e.target.value }
                        })
                      }
                    }}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-medium"
                  >
                    {PREDEFINED_VESSEL_TYPES.map(vt => (
                      <option key={vt} value={vt}>{vt}</option>
                    ))}
                    <option value="__otro__">✏️ + Otro (Personalizado)...</option>
                  </select>

                  {/* Input libre si eligió personalizado */}
                  {modalShip.isCustomVesselType && (
                    <input
                      type="text"
                      required
                      placeholder="Escribí el tipo de embarcación (ej: Desguace, Bongo, Catamarán)..."
                      value={modalShip.customVesselTypeVal}
                      onChange={(e) => setModalShip({ ...modalShip, customVesselTypeVal: e.target.value })}
                      className="w-full mt-2 bg-slate-950 border border-primary/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                      autoFocus
                    />
                  )}
                </div>

                {/* Matrícula */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Matrícula Naval</label>
                  <input
                    type="text"
                    placeholder="Ej: 0124-M"
                    value={modalShip.ship.matricula || ''}
                    onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, matricula: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-mono"
                  />
                </div>

                {/* Locación Inicial */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-300 block mb-1">Locación Actual</label>
                  <select
                    value={modalShip.ship.current_location || 'VARADERO ALON CAR'}
                    onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, current_location: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-bold"
                  >
                    {STANDARD_LOCATIONS.map(loc => (
                      <option key={loc} value={loc}>{loc}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* MEDIDAS NAVALES PRINCIPALES (JEFES DE OBRA) */}
              <div className="pt-2 border-t border-slate-800 space-y-2">
                <span className="text-xs font-extrabold text-cyan-300 block uppercase tracking-wider">
                  Medidas Principales (Jefe de Obra)
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-mono">Eslora (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ej: 28.5"
                      value={modalShip.ship.eslora_mts || ''}
                      onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, eslora_mts: e.target.value } })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-mono">Manga (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ej: 7.2"
                      value={modalShip.ship.manga_mts || ''}
                      onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, manga_mts: e.target.value } })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-mono">Puntal (m)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ej: 3.4"
                      value={modalShip.ship.puntal_mts || ''}
                      onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, puntal_mts: e.target.value } })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-mono">Sup. Casco (m²)</label>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="Ej: 320"
                      value={modalShip.ship.superficie_casco_m2 || ''}
                      onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, superficie_casco_m2: e.target.value } })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* COMPONENTES TÉCNICOS DINÁMICOS (Válvulas, Tanques, Pocetes) */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <span className="text-xs font-extrabold text-cyan-300 block uppercase tracking-wider">
                  Inventario Técnico a Bordo (Válvulas, Tanques, Pocetes)
                </span>
                <div className="space-y-3">
                  {DEFAULT_TECH_COMPONENTS.map(comp => {
                    const currentComp = (modalShip.ship.technical_specs || {})[comp.key] || { quantity: 0, notes: '' }
                    return (
                      <div key={comp.key} className="p-3 rounded-xl bg-slate-950 border border-slate-800/80 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <strong className="text-xs text-white">{comp.label}</strong>
                            <span className="text-[10px] text-slate-500 block">{comp.hint}</span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] text-slate-400">Cant:</span>
                            <input
                              type="number"
                              min="0"
                              value={currentComp.quantity || 0}
                              onChange={(e) => {
                                const q = parseInt(e.target.value, 10) || 0
                                const updatedSpecs = {
                                  ...(modalShip.ship.technical_specs || {}),
                                  [comp.key]: { ...currentComp, quantity: q }
                                }
                                setModalShip({
                                  ...modalShip,
                                  ship: { ...modalShip.ship, technical_specs: updatedSpecs }
                                })
                              }}
                              className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white text-center font-mono font-bold"
                            />
                          </div>
                        </div>

                        {/* Observaciones condicionales */}
                        {currentComp.quantity > 0 && (
                          <textarea
                            rows={2}
                            placeholder={`Observaciones de ${comp.label}...`}
                            value={currentComp.notes || ''}
                            onChange={(e) => {
                              const updatedSpecs = {
                                ...(modalShip.ship.technical_specs || {}),
                                [comp.key]: { ...currentComp, notes: e.target.value }
                              }
                              setModalShip({
                                ...modalShip,
                                ship: { ...modalShip.ship, technical_specs: updatedSpecs }
                              })
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-500"
                          />
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalShip({ isOpen: false, ship: null, isCustomVesselType: false, customVesselTypeVal: '' })}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-gradient-to-r from-primary to-blue-500 hover:brightness-110 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Buque</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR MOVIMIENTO / ESTADÍA                                     */}
      {/* ========================================================================= */}
      {modalStay.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 md:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Calendar className="w-5 h-5 text-cyan-400" />
                <span>{modalStay.stay.id ? 'Editar Movimiento' : 'Registrar Nuevo Movimiento'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalStay({ isOpen: false, stay: null, defaultShipId: '' })}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStay} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Buque *</label>
                <select
                  required
                  value={modalStay.stay.ship_id}
                  onChange={(e) => setModalStay({ ...modalStay, stay: { ...modalStay.stay, ship_id: e.target.value } })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
                >
                  {ships.map(s => (
                    <option key={s.id} value={s.id}>{cleanShipName(s.name)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Locación / Estadía *</label>
                <select
                  required
                  value={modalStay.stay.location}
                  onChange={(e) => setModalStay({ ...modalStay, stay: { ...modalStay.stay, location: e.target.value } })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
                >
                  {STANDARD_LOCATIONS.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Fecha Comienzo *</label>
                  <input
                    type="date"
                    required
                    value={modalStay.stay.start_date}
                    onChange={(e) => setModalStay({ ...modalStay, stay: { ...modalStay.stay, start_date: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Fecha Fin <span className="text-[10px] text-slate-500 font-normal">(Vacío = HOY)</span>
                  </label>
                  <input
                    type="date"
                    value={modalStay.stay.end_date || ''}
                    onChange={(e) => setModalStay({ ...modalStay, stay: { ...modalStay.stay, end_date: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Observaciones</label>
                <textarea
                  rows={2}
                  placeholder="Detalles del movimiento o cambio de amarre..."
                  value={modalStay.stay.notes || ''}
                  onChange={(e) => setModalStay({ ...modalStay, stay: { ...modalStay.stay, notes: e.target.value } })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalStay({ isOpen: false, stay: null, defaultShipId: '' })}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Movimiento</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: EMPRESA ARMADORA (MARÍA JOSÉ)                                      */}
      {/* ========================================================================= */}
      {modalOwner.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 md:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                <span>{modalOwner.owner.id ? 'Editar Armador' : 'Nueva Empresa Armadora'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOwner({ isOpen: false, owner: null })}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOwner} className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Razón Social o Empresa *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pesquera Aldana S.A."
                  value={modalOwner.owner.name}
                  onChange={(e) => setModalOwner({ ...modalOwner, owner: { ...modalOwner.owner, name: e.target.value } })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Nombre del Armador</label>
                  <input
                    type="text"
                    placeholder="Ej: Carlos Aldana"
                    value={modalOwner.owner.armador_name || ''}
                    onChange={(e) => setModalOwner({ ...modalOwner, owner: { ...modalOwner.owner, armador_name: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Teléfono Armador</label>
                  <input
                    type="text"
                    placeholder="Ej: +54 9 223 555-0192"
                    value={modalOwner.owner.armador_phone || ''}
                    onChange={(e) => setModalOwner({ ...modalOwner, owner: { ...modalOwner.owner, armador_phone: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Email Principal (Operativo)</label>
                <input
                  type="email"
                  placeholder="operaciones@armador.com"
                  value={modalOwner.owner.email_principal || ''}
                  onChange={(e) => setModalOwner({ ...modalOwner, owner: { ...modalOwner.owner, email_principal: e.target.value } })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Email Secundario (Facturación/Admin)</label>
                <input
                  type="email"
                  placeholder="facturacion@armador.com"
                  value={modalOwner.owner.email_secundario || ''}
                  onChange={(e) => setModalOwner({ ...modalOwner, owner: { ...modalOwner.owner, email_secundario: e.target.value } })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">CUIT</label>
                <input
                  type="text"
                  placeholder="30-12345678-9"
                  value={modalOwner.owner.cuit || ''}
                  onChange={(e) => setModalOwner({ ...modalOwner, owner: { ...modalOwner.owner, cuit: e.target.value } })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalOwner({ isOpen: false, owner: null })}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>Guardar Armador</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: SOLICITAR CARGA DE INFORMACIÓN CON NOTAS (JORGE SENTIS - ADMIN)    */}
      {/* ========================================================================= */}
      {modalRequestInfo.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg p-5 md:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <BellRing className="w-5 h-5 text-amber-400" />
                <span>Solicitar Carga de Información (Jorge Sentis)</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalRequestInfo({ isOpen: false, ship: null, requestType: 'pendiente_jefe_obra', notes: '' })}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSendInfoRequestWithNotes} className="space-y-4">
              <div className="text-xs text-slate-300">
                Buque: <strong className="text-white text-sm">{cleanShipName(modalRequestInfo.ship?.name)}</strong>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  1. ¿A quién deseás encomendar la carga de datos?
                </label>
                <div className="space-y-2">
                  <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                    modalRequestInfo.requestType === 'pendiente_jefe_obra'
                      ? 'bg-emerald-950/40 border-emerald-500/60 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="requestType"
                      value="pendiente_jefe_obra"
                      checked={modalRequestInfo.requestType === 'pendiente_jefe_obra'}
                      onChange={(e) => setModalRequestInfo({ ...modalRequestInfo, requestType: e.target.value })}
                      className="mt-0.5 accent-emerald-400"
                    />
                    <div>
                      <strong className="text-xs text-emerald-300 block">🛠️ Solo a Jefes de Obra (Técnico / Operaciones)</strong>
                      <span className="text-[11px] text-slate-400">
                        Solicita relevar Eslora, Manga, Superficie de Casco, Válvulas de fondo y Componentes Navales.
                      </span>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                    modalRequestInfo.requestType === 'pendiente_maria_jose'
                      ? 'bg-amber-950/40 border-amber-500/60 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="requestType"
                      value="pendiente_maria_jose"
                      checked={modalRequestInfo.requestType === 'pendiente_maria_jose'}
                      onChange={(e) => setModalRequestInfo({ ...modalRequestInfo, requestType: e.target.value })}
                      className="mt-0.5 accent-amber-400"
                    />
                    <div>
                      <strong className="text-xs text-amber-300 block">📋 Solo a María José (Administración / Comercial)</strong>
                      <span className="text-[11px] text-slate-400">
                        Solicita vincular Razón Social, nombre del armador, teléfonos y correos de contacto.
                      </span>
                    </div>
                  </label>

                  <label className={`p-3 rounded-xl border flex items-start gap-2.5 cursor-pointer transition-all ${
                    modalRequestInfo.requestType === 'pendiente_ambos'
                      ? 'bg-cyan-950/40 border-cyan-500/60 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}>
                    <input
                      type="radio"
                      name="requestType"
                      value="pendiente_ambos"
                      checked={modalRequestInfo.requestType === 'pendiente_ambos'}
                      onChange={(e) => setModalRequestInfo({ ...modalRequestInfo, requestType: e.target.value })}
                      className="mt-0.5 accent-cyan-400"
                    />
                    <div>
                      <strong className="text-xs text-cyan-300 block">📢 A Ambos: María José & Jefes de Obra</strong>
                      <span className="text-[11px] text-slate-400">
                        Solicita datos de armador y relevamiento técnico a bordo de forma paralela.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* CUADRO DE TEXTO PARA INSTRUCCIONES ESPECÍFICAS (Requerimiento del usuario) */}
              <div>
                <label className="text-xs font-bold text-slate-200 block mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-primary" />
                    <span>2. Instrucciones o detalle específico de la solicitud:</span>
                  </span>
                  <span className="text-[10px] text-slate-400 font-normal">Para que la tarea sea clara</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="Ej: Por favor verificar espesores de chapa del fondo, relevar las 4 válvulas de casco de 3 a 6 pulgadas y medir altura de pocetes de achique..."
                  value={modalRequestInfo.notes}
                  onChange={(e) => setModalRequestInfo({ ...modalRequestInfo, notes: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary leading-relaxed"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalRequestInfo({ isOpen: false, ship: null, requestType: 'pendiente_jefe_obra', notes: '' })}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-md transition-all"
                >
                  <BellRing className="w-4 h-4" />
                  <span>Enviar Solicitud con Instrucciones</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
