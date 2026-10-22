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
  Gauge
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
  const { user, profile } = useAuth()

  // Datos principales
  const [ships, setShips] = useState([])
  const [owners, setOwners] = useState([])
  const [stays, setStays] = useState([])
  const [contacts, setContacts] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState(null)

  // Navegación de pestañas
  const [activeTab, setActiveTab] = useState('buques') // 'buques' | 'movimientos' | 'armadores'

  // Perspectiva / Rol de Operación
  // Jorge Sentis (Admin) | María José (Admin/Comercial/Armador) | Jefe de Obra (Técnico/Medidas) | Vista General
  const [activeRolePerspective, setActiveRolePerspective] = useState(() => {
    if (user?.email === 'app.aloncar2712@gmail.com') return 'admin'
    return 'admin' // Por defecto administrativo
  })

  // Filtros de búsqueda
  const [searchTerm, setSearchTerm] = useState('')
  const [locationFilter, setLocationFilter] = useState('todos')
  const [requestFilter, setRequestFilter] = useState('todos')

  // Modales
  const [selectedShip360, setSelectedShip360] = useState(null)
  const [modalShip, setModalShip] = useState({ isOpen: false, ship: null })
  const [modalStay, setModalStay] = useState({ isOpen: false, stay: null, defaultShipId: '' })
  const [modalOwner, setModalOwner] = useState({ isOpen: false, owner: null })
  const [modalContact, setModalContact] = useState({ isOpen: false, contact: null, defaultOwnerId: '', defaultShipId: '' })
  const [modalRequestInfo, setModalRequestInfo] = useState({ isOpen: false, ship: null })
  const [submitting, setSubmitting] = useState(false)

  // Subpestaña en modal 360
  const [subTab360, setSubTab360] = useState('tecnica') // 'tecnica' | 'armador' | 'movimientos' | 'ots'

  // Carga inicial de datos
  const loadInitialData = async () => {
    try {
      setLoading(true)
      const [shipsRes, ownersRes, staysRes, contactsRes, wosRes] = await Promise.all([
        supabase.from('ships').select('*, owners(*)').order('name', { ascending: true }),
        supabase.from('owners').select('*').order('name', { ascending: true }),
        supabase.from('ship_stays').select('*, ships(id, name)').order('start_date', { ascending: false }),
        supabase.from('contacts').select('*, owners(id, name), ships(id, name)').order('name', { ascending: true }),
        supabase.from('work_orders').select('id, ship_id, ot_number, title, status, description').order('created_at', { ascending: false })
      ])

      if (shipsRes.data) setShips(shipsRes.data)
      if (ownersRes.data) setOwners(ownersRes.data)
      if (staysRes.data) setStays(staysRes.data)
      if (contactsRes.data) setContacts(contactsRes.data)
      if (wosRes.data) setWorkOrders(wosRes.data)
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

  // KPI Calculations
  const totalShips = ships.length
  const varaderoCount = ships.filter(s => s.current_location === 'VARADERO ALON CAR' && s.is_active !== false).length
  const muelleCount = ships.filter(s => s.current_location === 'MUELLE ALON CAR' && s.is_active !== false).length
  const puertoCount = ships.filter(s => (s.current_location || '').includes('PUERTO') && s.is_active !== false).length
  const pendingRequestsCount = ships.filter(s => s.info_request_status && s.info_request_status !== 'completo').length

  // Barcos filtrados para la lista
  const filteredShips = useMemo(() => {
    return ships.filter(s => {
      const term = searchTerm.toLowerCase()
      const matchSearch = !term ||
        cleanShipName(s.name).toLowerCase().includes(term) ||
        (s.owners?.name || '').toLowerCase().includes(term) ||
        (s.owners?.armador_name || '').toLowerCase().includes(term) ||
        (s.current_location || '').toLowerCase().includes(term) ||
        (s.matricula || '').toLowerCase().includes(term)

      const matchLocation = locationFilter === 'todos' ||
        (locationFilter === 'PUERTO' ? (s.current_location || '').includes('PUERTO') : s.current_location === locationFilter)

      const matchRequest = requestFilter === 'todos' ||
        (requestFilter === 'pendientes' ? s.info_request_status && s.info_request_status !== 'completo' : s.info_request_status === 'completo')

      return matchSearch && matchLocation && matchRequest
    })
  }, [ships, searchTerm, locationFilter, requestFilter])

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
        info_request_status: 'pendiente_ambos', // Solicita info a María José y Jefe de Obra
        technical_specs: {}
      }
    })
  }

  const handleSaveShip = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setStatusMessage(null)

    try {
      const cleanName = cleanShipName(modalShip.ship.name).toUpperCase()
      if (!cleanName) throw new Error('El nombre del barco es obligatorio')

      const payload = {
        name: cleanName,
        owner_id: modalShip.ship.owner_id || null,
        matricula: modalShip.ship.matricula || null,
        imo_number: modalShip.ship.imo_number || null,
        vessel_type: modalShip.ship.vessel_type || 'Pesquero',
        eslora_mts: modalShip.ship.eslora_mts ? parseFloat(modalShip.ship.eslora_mts) : null,
        manga_mts: modalShip.ship.manga_mts ? parseFloat(modalShip.ship.manga_mts) : null,
        puntal_mts: modalShip.ship.puntal_mts ? parseFloat(modalShip.ship.puntal_mts) : null,
        superficie_casco_m2: modalShip.ship.superficie_casco_m2 ? parseFloat(modalShip.ship.superficie_casco_m2) : null,
        current_location: modalShip.ship.current_location || 'VARADERO ALON CAR',
        notes: modalShip.ship.notes || null,
        technical_specs: modalShip.ship.technical_specs || {},
        info_request_status: modalShip.ship.info_request_status || 'completo',
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
        payload.info_requested_by = user?.email || 'Administración'
        const { error } = await supabase.from('ships').insert([payload])
        if (error) throw error
        setStatusMessage({
          type: 'success',
          text: `Buque "${cleanName}" dado de alta exitosamente. Se notificó a María José y Jefes de Obra para completar datos.`
        })
      }

      setModalShip({ isOpen: false, ship: null })
      await loadInitialData()
    } catch (err) {
      console.error('Error guardando barco:', err)
      setStatusMessage({ type: 'error', text: 'Error al guardar buque: ' + err.message })
    } finally {
      setSubmitting(false)
    }
  }

  // Baja lógica (Desactivar barco sin borrar historial contable ni OTs)
  const handleToggleShipStatus = async (ship) => {
    const nextStatus = !ship.is_active
    const actionText = nextStatus ? 'reactivar' : 'dar de baja (desactivar)'
    if (!window.confirm(`¿Seguro que deseas ${actionText} el buque "${cleanShipName(ship.name)}"?`)) return

    try {
      const { error } = await supabase
        .from('ships')
        .update({ is_active: nextStatus, status: nextStatus ? 'Activo' : 'Terminado' })
        .eq('id', ship.id)

      if (error) throw error
      setStatusMessage({
        type: 'info',
        text: `Buque "${cleanShipName(ship.name)}" marcado como ${nextStatus ? 'ACTIVO' : 'INACTIVO'}.`
      })
      await loadInitialData()
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Error al cambiar estado: ' + err.message })
    }
  }

  // ==========================================================================
  // HANDLERS: CALENDARIO DE MOVIMIENTOS & ESTADÍAS (DEC-019 / IMAGEN ADJUNTA)
  // ==========================================================================
  const handleOpenNewStay = (defaultShipId = '') => {
    const todayStr = new Date().toISOString().slice(0, 10)
    setModalStay({
      isOpen: true,
      stay: {
        ship_id: defaultShipId || ships[0]?.id || '',
        location: 'VARADERO ALON CAR',
        start_date: todayStr,
        end_date: '',
        notes: ''
      }
    })
  }

  const handleSaveStay = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    setStatusMessage(null)

    try {
      if (!modalStay.stay.ship_id) throw new Error('Debe seleccionar un barco')
      if (!modalStay.stay.start_date) throw new Error('Debe ingresar la fecha de comienzo')

      const payload = {
        ship_id: modalStay.stay.ship_id,
        location: modalStay.stay.location,
        start_date: modalStay.stay.start_date,
        end_date: modalStay.stay.end_date || null,
        notes: modalStay.stay.notes || null,
        registered_by: user?.email || 'María José / Admin'
      }

      if (modalStay.stay.id) {
        const { error } = await supabase.from('ship_stays').update(payload).eq('id', modalStay.stay.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('ship_stays').insert([payload])
        if (error) throw error
      }

      // Si la estadía está en curso (sin fecha fin), actualizar la locación actual del barco
      if (!modalStay.stay.end_date) {
        await supabase
          .from('ships')
          .update({ current_location: modalStay.stay.location })
          .eq('id', modalStay.stay.ship_id)
      }

      setStatusMessage({ type: 'success', text: 'Movimiento de estadía registrado en el Calendario.' })
      setModalStay({ isOpen: false, stay: null })
      await loadInitialData()
    } catch (err) {
      setStatusMessage({ type: 'error', text: 'Error en estadía: ' + err.message })
    } finally {
      setSubmitting(false)
    }
  }

  // Cerrar estadía en curso con fecha manual o de hoy
  const handleCloseStayQuick = async (stay) => {
    const todayStr = new Date().toISOString().slice(0, 10)
    const newEnd = window.prompt(`Ingresá la fecha de salida/fin para ${cleanShipName(stay.ships?.name)}:`, todayStr)
    if (!newEnd) return

    try {
      const { error } = await supabase
        .from('ship_stays')
        .update({ end_date: newEnd })
        .eq('id', stay.id)

      if (error) throw error
      setStatusMessage({ type: 'success', text: `Estadía cerrada al día ${newEnd}.` })
      await loadInitialData()
    } catch (err) {
      setStatusMessage({ type: 'error', text: err.message })
    }
  }

  // ==========================================================================
  // HANDLERS: PROPIETARIOS / ARMADORES & CONTACTOS (MARÍA JOSÉ)
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
  // HANDLERS: SOLICITUD DE INFORMACIÓN (ADMINISTRADOR)
  // ==========================================================================
  const handleSendInfoRequest = async (ship, requestType) => {
    try {
      const { error } = await supabase
        .from('ships')
        .update({
          info_request_status: requestType,
          info_requested_at: new Date().toISOString(),
          info_requested_by: user?.email || 'Jorge Sentis (Administrador)'
        })
        .eq('id', ship.id)

      if (error) throw error
      setStatusMessage({
        type: 'success',
        text: `📢 Se envió la solicitud de carga para "${cleanShipName(ship.name)}" (${
          requestType === 'pendiente_maria_jose'
            ? 'María José: Armador & Contactos'
            : requestType === 'pendiente_jefe_obra'
            ? 'Jefes de Obra: Medidas & Ficha Técnica'
            : 'Ambos: María José & Jefes de Obra'
        }).`
      })
      setModalRequestInfo({ isOpen: false, ship: null })
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
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1 text-xs">
            <span className="text-[10px] uppercase font-bold text-slate-400 px-2 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-cyan-400" /> Rol Activo:
            </span>
            <button
              type="button"
              onClick={() => setActiveRolePerspective('admin')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeRolePerspective === 'admin'
                  ? 'bg-primary text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Jorge Sentis: Crea el barco y solicita que llenen la información"
            >
              👑 Admin (Jorge)
            </button>
            <button
              type="button"
              onClick={() => setActiveRolePerspective('maria_jose')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeRolePerspective === 'maria_jose'
                  ? 'bg-amber-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="María José: Carga contactos, armador y calendario de estadías"
            >
              📋 María José
            </button>
            <button
              type="button"
              onClick={() => setActiveRolePerspective('jefe_obra')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeRolePerspective === 'jefe_obra'
                  ? 'bg-emerald-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Jefes de Obra: Cargan medidas y Ficha Técnica Naval"
            >
              🛠️ Jefe de Obra
            </button>
          </div>

          {/* Botón Nuevo Barco (Visible para Admin) */}
          <button
            type="button"
            onClick={handleOpenNewShip}
            className="px-4 py-2 bg-gradient-to-r from-primary to-blue-500 hover:brightness-110 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(0,242,254,0.25)] transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>+ Nuevo Buque</span>
          </button>
        </div>
      </div>

      {/* MENSAJE DE ESTADO */}
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

      {/* KPIS DE MOVIMIENTOS & ESTADÍAS */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="text-[11px] font-bold uppercase text-slate-400 flex items-center gap-1.5 mb-1">
            <Ship className="w-3.5 h-3.5 text-cyan-400" /> Total Buques
          </div>
          <div className="text-2xl font-black text-white font-mono">{totalShips}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">En base histórica</div>
        </div>

        <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-500/30">
          <div className="text-[11px] font-bold uppercase text-cyan-300 flex items-center gap-1.5 mb-1">
            <Anchor className="w-3.5 h-3.5 text-cyan-400" /> En Varadero Alon Car
          </div>
          <div className="text-2xl font-black text-cyan-200 font-mono">{varaderoCount}</div>
          <div className="text-[10px] text-cyan-400/70 mt-0.5">Puesta en seco activa</div>
        </div>

        <div className="p-4 rounded-2xl bg-blue-950/30 border border-blue-500/30">
          <div className="text-[11px] font-bold uppercase text-blue-300 flex items-center gap-1.5 mb-1">
            <MapPin className="w-3.5 h-3.5 text-blue-400" /> En Muelle Alon Car
          </div>
          <div className="text-2xl font-black text-blue-200 font-mono">{muelleCount}</div>
          <div className="text-[10px] text-blue-400/70 mt-0.5">A flote con servicios</div>
        </div>

        <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-500/30">
          <div className="text-[11px] font-bold uppercase text-purple-300 flex items-center gap-1.5 mb-1">
            <MapPin className="w-3.5 h-3.5 text-purple-400" /> En Puerto / Aldana
          </div>
          <div className="text-2xl font-black text-purple-200 font-mono">{puertoCount}</div>
          <div className="text-[10px] text-purple-400/70 mt-0.5">Muelles externos</div>
        </div>

        <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-500/30">
          <div className="text-[11px] font-bold uppercase text-amber-300 flex items-center gap-1.5 mb-1">
            <BellRing className="w-3.5 h-3.5 text-amber-400" /> Solicitudes Pendientes
          </div>
          <div className="text-2xl font-black text-amber-200 font-mono">{pendingRequestsCount}</div>
          <div className="text-[10px] text-amber-400/70 mt-0.5">Requieren datos técnicos/contacto</div>
        </div>
      </div>

      {/* BARRA DE PESTAÑAS PRINCIPALES */}
      <div className="flex bg-slate-900 border border-slate-700/80 p-1.5 rounded-xl shadow-lg self-start">
        <button
          type="button"
          onClick={() => setActiveTab('buques')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'buques'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-[0_0_15px_rgba(0,242,254,0.3)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Ship className="w-3.5 h-3.5" />
          <span>1. Buques & Fichas Técnicas</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('movimientos')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'movimientos'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-[0_0_15px_rgba(0,242,254,0.3)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Calendar className="w-3.5 h-3.5" />
          <span>2. Calendario de Movimientos (Estadías)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('armadores')}
          className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
            activeTab === 'armadores'
              ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 shadow-[0_0_15px_rgba(0,242,254,0.3)]'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          <span>3. Armadores, Propietarios & Contactos</span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* PESTAÑA 1: CATÁLOGO DE BUQUES & FICHAS 360°                               */}
      {/* ========================================================================= */}
      {activeTab === 'buques' && (
        <div className="space-y-4">
          {/* BUSCADOR Y FILTROS RÁPIDOS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Buscar por nombre de buque, armador, matrícula o locación..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={locationFilter}
                onChange={(e) => setLocationFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-primary"
              >
                <option value="todos">Todas las Locaciones</option>
                <option value="VARADERO ALON CAR">Varadero Alon Car</option>
                <option value="MUELLE ALON CAR">Muelle Alon Car</option>
                <option value="PUERTO">Puertos Externos (Aldana)</option>
              </select>

              <select
                value={requestFilter}
                onChange={(e) => setRequestFilter(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-primary"
              >
                <option value="todos">Todos los Estados</option>
                <option value="pendientes">⚠️ Con Solicitud de Carga</option>
                <option value="completos">✅ Datos Completos</option>
              </select>
            </div>
          </div>

          {/* GRILLA DE TARJETAS DE BUQUES */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredShips.map(ship => {
              const cleanName = cleanShipName(ship.name)
              const hasPendingReq = ship.info_request_status && ship.info_request_status !== 'completo'
              const shipWos = workOrders.filter(w => w.ship_id === ship.id)
              const activeWos = shipWos.filter(w => w.status === 'En ejecución' || w.status === 'open')

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
                          {ship.vessel_type || 'Buque'} {ship.matricula ? `• Matrícula: ${ship.matricula}` : ''}
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

                    {/* Alerta de Solicitud de Carga */}
                    {hasPendingReq && (
                      <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-200 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <BellRing className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          <span>
                            {ship.info_request_status === 'pendiente_maria_jose'
                              ? 'Solicitado a María José: Armador/Contactos'
                              : ship.info_request_status === 'pendiente_jefe_obra'
                              ? 'Solicitado a Jefe de Obra: Medidas/Ficha Técnica'
                              : 'Solicitado a María José y Jefes de Obra'}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Datos Clave (Eslora, Manga, Armador) */}
                    <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                      <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                        <span className="text-[10px] text-slate-400 block font-medium">Eslora / Manga</span>
                        <strong className="text-white font-mono">
                          {ship.eslora_mts ? `${ship.eslora_mts}m` : 'S/D'} × {ship.manga_mts ? `${ship.manga_mts}m` : 'S/D'}
                        </strong>
                      </div>
                      <div className="p-2 rounded-lg bg-slate-950/60 border border-slate-800/80">
                        <span className="text-[10px] text-slate-400 block font-medium">OTs Activas</span>
                        <strong className="text-cyan-300 font-mono">
                          {activeWos.length} en ejecución
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
                      onClick={() => {
                        setSelectedShip360(ship)
                        setSubTab360('tecnica')
                      }}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-500/30 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ficha 360°</span>
                    </button>

                    <div className="flex items-center gap-1">
                      {/* Botón Solicitar Carga (Admin) */}
                      <button
                        type="button"
                        onClick={() => setModalRequestInfo({ isOpen: true, ship })}
                        className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors cursor-pointer"
                        title="Solicitar que María José o Jefes de Obra completen los datos"
                      >
                        <BellRing className="w-4 h-4" />
                      </button>

                      {/* Editar Ficha */}
                      <button
                        type="button"
                        onClick={() => setModalShip({ isOpen: true, ship })}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Editar Buque"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>

                      {/* Baja Lógica */}
                      <button
                        type="button"
                        onClick={() => handleToggleShipStatus(ship)}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          ship.is_active === false
                            ? 'text-emerald-400 hover:bg-emerald-500/10'
                            : 'text-slate-500 hover:text-rose-400 hover:bg-rose-500/10'
                        }`}
                        title={ship.is_active === false ? 'Reactivar Buque' : 'Dar de baja (desactivar)'}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: CALENDARIO DE MOVIMIENTOS & ESTADÍAS (EXACTO A FOTO EXCEL)      */}
      {/* ========================================================================= */}
      {activeTab === 'movimientos' && (
        <div className="space-y-4">
          <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            {/* Header del Calendario de Movimientos */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-xs uppercase tracking-wider font-extrabold text-cyan-300 flex items-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>CALENDARIO DE MOVIMIENTOS & ESTADÍA DE BARCOS</span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Registro cronológico de permanencia en Varadero Alon Car, Muelle o Puertos externos. Días calculados con la fórmula <code className="text-cyan-300 font-mono">Fin - Comienzo + 1</code> (acumula con HOY si está en curso).
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleOpenNewStay()}
                className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>+ Registrar Movimiento</span>
              </button>
            </div>

            {/* TABLA ESTILO EXCEL (CALENDARIO DE MOVIMIENTOS) */}
            <div className="overflow-x-auto pb-2">
              <table className="w-full text-left border-collapse min-w-[780px]">
                <thead>
                  <tr className="bg-slate-950 text-slate-300 text-xs uppercase font-extrabold tracking-wider border-b border-slate-800">
                    <th className="py-3 px-4">LOCACIÓN</th>
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
                                onClick={() => setModalStay({ isOpen: true, stay })}
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
          <div className="flex items-center justify-between bg-slate-900/80 border border-slate-800 p-4 rounded-2xl">
            <div>
              <h2 className="text-xs uppercase tracking-wider font-extrabold text-cyan-300 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                <span>Empresas Propietarias & Armadores Navales</span>
              </h2>
              <p className="text-[11px] text-slate-400">
                Directorio comercial de razones sociales, armadores responsables, teléfonos directos y correos (principal y secundario para facturación).
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenNewOwner}
              className="px-3.5 py-2 bg-gradient-to-r from-primary to-blue-500 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nueva Empresa Armadora</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {owners.map(owner => {
              const ownerShips = ships.filter(s => s.owner_id === owner.id)
              return (
                <div key={owner.id} className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-3">
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
                    <div>
                      <h3 className="font-extrabold text-white text-base">{owner.name}</h3>
                      <span className="text-[11px] text-slate-400 font-mono">CUIT: {owner.cuit || 'S/D'}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setModalOwner({ isOpen: true, owner })}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                      title="Editar Empresa"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-300">
                    <div className="flex items-center gap-2">
                      <Users className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Armador: <strong className="text-white">{owner.armador_name || 'Sin especificar'}</strong></span>
                    </div>
                    {owner.armador_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                        <span className="font-mono">{owner.armador_phone}</span>
                      </div>
                    )}
                    {owner.email_principal && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                        <span className="font-mono text-[11px]">{owner.email_principal}</span>
                      </div>
                    )}
                    {owner.email_secundario && (
                      <div className="flex items-center gap-2 text-slate-400">
                        <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span className="font-mono text-[11px]">{owner.email_secundario} (2° mail)</span>
                      </div>
                    )}
                  </div>

                  {/* Buques asignados */}
                  <div className="pt-2 border-t border-slate-800 text-xs">
                    <span className="text-[11px] text-slate-400 block mb-1">Buques en Flota ({ownerShips.length}):</span>
                    <div className="flex flex-wrap gap-1">
                      {ownerShips.length === 0 ? (
                        <span className="text-slate-500 italic text-[11px]">Sin buques vinculados</span>
                      ) : (
                        ownerShips.map(s => (
                          <span key={s.id} className="px-2 py-0.5 rounded bg-slate-950 text-cyan-300 border border-slate-800 font-bold text-[10px]">
                            {cleanShipName(s.name)}
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL / DRAWER: FICHA 360° INTEGRAL DEL BUQUE                             */}
      {/* ========================================================================= */}
      {selectedShip360 && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-3 md:p-6 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl flex flex-col">
            {/* Header Ficha 360 */}
            <div className="p-5 md:p-6 border-b border-slate-800 bg-slate-950/80 flex items-start justify-between gap-3 sticky top-0 z-10">
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <Ship className="w-6 h-6 text-primary" />
                  <h2 className="text-xl md:text-2xl font-black text-white">
                    {cleanShipName(selectedShip360.name)}
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-bold font-mono bg-cyan-950 text-cyan-300 border border-cyan-800">
                    {selectedShip360.current_location || 'VARADERO ALON CAR'}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                  <span>Tipo: <strong className="text-slate-200">{selectedShip360.vessel_type || 'Pesquero'}</strong></span>
                  <span>•</span>
                  <span>Matrícula: <strong className="text-slate-200">{selectedShip360.matricula || 'S/D'}</strong></span>
                  <span>•</span>
                  <span>Armador: <strong className="text-cyan-300">{selectedShip360.owners?.armador_name || selectedShip360.owners?.name || 'S/D'}</strong></span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedShip360(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Subpestañas Ficha 360 */}
            <div className="px-5 border-b border-slate-800 bg-slate-950 flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setSubTab360('tecnica')}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  subTab360 === 'tecnica'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>Ficha Técnica Naval (Jefe de Obra)</span>
              </button>

              <button
                type="button"
                onClick={() => setSubTab360('armador')}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  subTab360 === 'armador'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Armador & Contactos (María José)</span>
              </button>

              <button
                type="button"
                onClick={() => setSubTab360('movimientos')}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  subTab360 === 'movimientos'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Historial de Estadías</span>
              </button>

              <button
                type="button"
                onClick={() => setSubTab360('ots')}
                className={`px-4 py-2 text-xs font-bold border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                  subTab360 === 'ots'
                    ? 'border-primary text-primary'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>OTs & Trabajos</span>
              </button>
            </div>

            {/* Contenido de la Ficha 360 */}
            <div className="p-5 md:p-6 space-y-5 flex-1">
              {/* SUBPESTAÑA 1: FICHA TÉCNICA NAVAL (JEFES DE OBRA) */}
              {subTab360 === 'tecnica' && (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs uppercase tracking-wider font-extrabold text-cyan-300 flex items-center gap-2">
                      <Gauge className="w-4 h-4" />
                      <span>Medidas Principales & Componentes Navales Dinámicos</span>
                    </h3>
                    <button
                      type="button"
                      onClick={() => {
                        setModalShip({ isOpen: true, ship: selectedShip360 })
                      }}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 rounded-lg text-xs font-bold border border-cyan-500/30 flex items-center gap-1 cursor-pointer"
                    >
                      <Pencil className="w-3 h-3" />
                      <span>Editar Medidas / Componentes</span>
                    </button>
                  </div>

                  {/* Medidas Core */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Eslora</span>
                      <strong className="text-lg text-white font-mono">{selectedShip360.eslora_mts ? `${selectedShip360.eslora_mts} m` : 'S/D'}</strong>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Manga</span>
                      <strong className="text-lg text-white font-mono">{selectedShip360.manga_mts ? `${selectedShip360.manga_mts} m` : 'S/D'}</strong>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Puntal</span>
                      <strong className="text-lg text-white font-mono">{selectedShip360.puntal_mts ? `${selectedShip360.puntal_mts} m` : 'S/D'}</strong>
                    </div>
                    <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Sup. Casco</span>
                      <strong className="text-lg text-cyan-300 font-mono">
                        {selectedShip360.superficie_casco_m2 ? `${selectedShip360.superficie_casco_m2} m²` : 'S/D'}
                      </strong>
                    </div>
                  </div>

                  {/* Componentes Dinámicos (JSONB) */}
                  <div className="space-y-3 pt-2">
                    <span className="text-xs font-bold text-slate-300 block">
                      Componentes Verificados a Bordo:
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {DEFAULT_TECH_COMPONENTS.map(comp => {
                        const compData = selectedShip360.technical_specs?.[comp.key] || { cantidad: 0, observaciones: '' }
                        const qty = compData.cantidad || 0

                        return (
                          <div key={comp.key} className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-white">{comp.label}</span>
                              <span className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${
                                qty > 0 ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' : 'bg-slate-900 text-slate-500'
                              }`}>
                                Cantidad: {qty}
                              </span>
                            </div>
                            {qty > 0 && compData.observaciones ? (
                              <p className="text-xs text-slate-300 whitespace-pre-line bg-slate-900/60 p-2 rounded-lg border border-slate-800/80 font-sans">
                                {compData.observaciones}
                              </p>
                            ) : (
                              <span className="text-[11px] text-slate-500 italic block">
                                {qty === 0 ? 'No especificado / 0' : 'Sin observaciones adicionales'}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* SUBPESTAÑA 2: ARMADOR & CONTACTOS (MARÍA JOSÉ) */}
              {subTab360 === 'armador' && (
                <div className="space-y-5">
                  <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                    <h3 className="text-xs uppercase tracking-wider font-extrabold text-amber-300 flex items-center gap-2">
                      <Building2 className="w-4 h-4" />
                      <span>Empresa Propietaria / Armador Asignado</span>
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <span className="text-slate-400 block text-[11px]">Razón Social:</span>
                        <strong className="text-white text-sm">{selectedShip360.owners?.name || 'Sin asignar'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Nombre del Armador:</span>
                        <strong className="text-white text-sm">{selectedShip360.owners?.armador_name || 'Sin especificar'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Teléfono de Contacto Armador:</span>
                        <strong className="text-emerald-300 font-mono">{selectedShip360.owners?.armador_phone || 'S/D'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Email Principal:</span>
                        <strong className="text-cyan-300 font-mono">{selectedShip360.owners?.email_principal || 'S/D'}</strong>
                      </div>
                      <div>
                        <span className="text-slate-400 block text-[11px]">Email Secundario:</span>
                        <strong className="text-slate-300 font-mono">{selectedShip360.owners?.email_secundario || 'S/D'}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* SUBPESTAÑA 3: HISTORIAL DE ESTADÍAS */}
              {subTab360 === 'movimientos' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Movimientos de este buque:</span>
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

              {/* SUBPESTAÑA 4: OTS Y TRABAJOS */}
              {subTab360 === 'ots' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-300">Órdenes de Trabajo de este buque:</span>
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
                      {workOrders.filter(w => w.ship_id === selectedShip360.id).map(wo => (
                        <div key={wo.id} className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-mono text-cyan-400 font-bold mr-2">[{wo.ot_number || 'OT'}]</span>
                            <strong className="text-white">{wo.title}</strong>
                            <p className="text-slate-400 text-[11px] mt-0.5">{wo.description || 'Sin descripción'}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            wo.status === 'En ejecución' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-900 text-slate-400'
                          }`}>
                            {wo.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ALTA Y EDICIÓN DE BUQUE (DATOS CORE + FICHA TÉCNICA)              */}
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
                onClick={() => setModalShip({ isOpen: false, ship: null })}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveShip} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Nombre del buque */}
                <div className="sm:col-span-2">
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Nombre del Buque *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: TRITON I (se guarda limpio sin prefijos)"
                    value={modalShip.ship.name}
                    onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, name: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-bold"
                  />
                </div>

                {/* Propietario / Armador */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Empresa Propietaria / Armador
                  </label>
                  <select
                    value={modalShip.ship.owner_id || ''}
                    onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, owner_id: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    <option value="">-- Seleccionar Armador --</option>
                    {owners.map(o => (
                      <option key={o.id} value={o.id}>{o.name} {o.armador_name ? `(${o.armador_name})` : ''}</option>
                    ))}
                  </select>
                </div>

                {/* Tipo de Embarcación */}
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Tipo de Embarcación
                  </label>
                  <select
                    value={modalShip.ship.vessel_type || 'Pesquero'}
                    onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, vessel_type: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
                  >
                    <option value="Pesquero">Pesquero</option>
                    <option value="Remolcador">Remolcador</option>
                    <option value="Arenero">Arenero</option>
                    <option value="Barcaza">Barcaza</option>
                    <option value="Pontón">Pontón</option>
                    <option value="Buque Motor">Buque Motor General</option>
                  </select>
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
                <div>
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
                      placeholder="Ej: 3.5"
                      value={modalShip.ship.puntal_mts || ''}
                      onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, puntal_mts: e.target.value } })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1 font-mono">Sup. Casco (m²)</label>
                    <input
                      type="number"
                      step="0.1"
                      placeholder="Ej: 380"
                      value={modalShip.ship.superficie_casco_m2 || ''}
                      onChange={(e) => setModalShip({ ...modalShip, ship: { ...modalShip.ship, superficie_casco_m2: e.target.value } })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-cyan-300 font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* COMPONENTES DE LA FICHA TÉCNICA (CANTIDAD > 0 HABILITA OBSERVACIONES) */}
              <div className="pt-2 border-t border-slate-800 space-y-3">
                <div>
                  <span className="text-xs font-extrabold text-cyan-300 block uppercase tracking-wider">
                    Componentes Técnicos (Tanques, Válvulas, Pocetes)
                  </span>
                  <p className="text-[11px] text-slate-400">
                    Si la cantidad es mayor a 0, se habilita el campo para cargar detalles y distribución.
                  </p>
                </div>

                <div className="space-y-3">
                  {DEFAULT_TECH_COMPONENTS.map(comp => {
                    const currentVal = modalShip.ship.technical_specs?.[comp.key] || { cantidad: 0, observaciones: '' }
                    const hasCount = (parseInt(currentVal.cantidad) || 0) > 0

                    return (
                      <div key={comp.key} className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-2">
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-xs font-bold text-white flex-1">{comp.label}</label>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400">Cantidad:</span>
                            <input
                              type="number"
                              min="0"
                              value={currentVal.cantidad ?? 0}
                              onChange={(e) => {
                                const newQty = parseInt(e.target.value) || 0
                                setModalShip({
                                  ...modalShip,
                                  ship: {
                                    ...modalShip.ship,
                                    technical_specs: {
                                      ...modalShip.ship.technical_specs,
                                      [comp.key]: {
                                        ...currentVal,
                                        cantidad: newQty
                                      }
                                    }
                                  }
                                })
                              }}
                              className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono text-center font-bold"
                            />
                          </div>
                        </div>

                        {/* Textarea habilitado solo si cantidad > 0 */}
                        {hasCount && (
                          <div className="space-y-1 animate-in fade-in">
                            <textarea
                              rows={2}
                              placeholder={comp.hint}
                              value={currentVal.observaciones || ''}
                              onChange={(e) => {
                                setModalShip({
                                  ...modalShip,
                                  ship: {
                                    ...modalShip.ship,
                                    technical_specs: {
                                      ...modalShip.ship.technical_specs,
                                      [comp.key]: {
                                        ...currentVal,
                                        observaciones: e.target.value
                                      }
                                    }
                                  }
                                })
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-400 font-sans"
                            />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Botones */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalShip({ isOpen: false, ship: null })}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-primary hover:brightness-110 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{submitting ? 'Guardando...' : 'Guardar Buque'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: REGISTRAR MOVIMIENTO DE ESTADÍA (DEC-019)                         */}
      {/* ========================================================================= */}
      {modalStay.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 md:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Calendar className="w-5 h-5 text-cyan-400" />
                <span>Registrar Movimiento en Calendario</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalStay({ isOpen: false, stay: null })}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStay} className="space-y-4">
              {/* Barco */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Buque</label>
                <select
                  required
                  value={modalStay.stay.ship_id}
                  onChange={(e) => setModalStay({ ...modalStay, stay: { ...modalStay.stay, ship_id: e.target.value } })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-bold"
                >
                  <option value="">-- Seleccionar Buque --</option>
                  {ships.map(s => (
                    <option key={s.id} value={s.id}>{cleanShipName(s.name)}</option>
                  ))}
                </select>
              </div>

              {/* Locación */}
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Locación de Permanencia</label>
                <select
                  value={modalStay.stay.location}
                  onChange={(e) => setModalStay({ ...modalStay, stay: { ...modalStay.stay, location: e.target.value } })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-cyan-300 focus:outline-none focus:border-cyan-400 font-bold"
                >
                  {STANDARD_LOCATIONS.map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>

              {/* Fechas Comienzo y Fin */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Fecha Comienzo *</label>
                  <input
                    type="date"
                    required
                    value={modalStay.stay.start_date}
                    onChange={(e) => setModalStay({ ...modalStay, stay: { ...modalStay.stay, start_date: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">
                    Fecha Fin (Opcional)
                  </label>
                  <input
                    type="date"
                    value={modalStay.stay.end_date || ''}
                    onChange={(e) => setModalStay({ ...modalStay, stay: { ...modalStay.stay, end_date: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white font-mono"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">Si está en curso, dejalo vacío (=HOY)</span>
                </div>
              </div>

              {/* Días Calculados */}
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-400">Días que estuvo el barco:</span>
                <strong className="text-cyan-300 font-mono text-sm font-black">
                  {calculateStayDays(modalStay.stay.start_date, modalStay.stay.end_date)} días
                </strong>
              </div>

              {/* Botones */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setModalStay({ isOpen: false, stay: null })}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
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
      {/* MODAL: ALTA Y EDICIÓN DE EMPRESA PROPIETARIA & ARMADOR (MARÍA JOSÉ)       */}
      {/* ========================================================================= */}
      {modalOwner.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-lg p-5 md:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-400" />
                <span>Empresa Propietaria & Armador (María José)</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalOwner({ isOpen: false, owner: null })}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveOwner} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">Razón Social / Empresa *</label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Pesquera San Antonio S.A."
                  value={modalOwner.owner.name}
                  onChange={(e) => setModalOwner({ ...modalOwner, owner: { ...modalOwner.owner, name: e.target.value } })}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Nombre del Armador</label>
                  <input
                    type="text"
                    placeholder="Ej: Juan Carlos Pérez"
                    value={modalOwner.owner.armador_name || ''}
                    onChange={(e) => setModalOwner({ ...modalOwner, owner: { ...modalOwner.owner, armador_name: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-300 block mb-1">Teléfono Armador</label>
                  <input
                    type="text"
                    placeholder="Ej: +54 9 223 555-0123"
                    value={modalOwner.owner.armador_phone || ''}
                    onChange={(e) => setModalOwner({ ...modalOwner, owner: { ...modalOwner.owner, armador_phone: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              {/* 2 Opciones de Email de Contacto de Empresa */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-bold text-cyan-300 block mb-1">Email Contacto Empresa 1 *</label>
                  <input
                    type="email"
                    placeholder="operaciones@empresa.com"
                    value={modalOwner.owner.email_principal || ''}
                    onChange={(e) => setModalOwner({ ...modalOwner, owner: { ...modalOwner.owner, email_principal: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Email Contacto Empresa 2 (Opcional)</label>
                  <input
                    type="email"
                    placeholder="facturacion@empresa.com"
                    value={modalOwner.owner.email_secundario || ''}
                    onChange={(e) => setModalOwner({ ...modalOwner, owner: { ...modalOwner.owner, email_secundario: e.target.value } })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1">CUIT</label>
                <input
                  type="text"
                  placeholder="30-71234567-9"
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
      {/* MODAL: SOLICITAR CARGA DE INFORMACIÓN (ADMINISTRADOR)                     */}
      {/* ========================================================================= */}
      {modalRequestInfo.isOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-md p-5 md:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-extrabold text-white text-base flex items-center gap-2">
                <BellRing className="w-5 h-5 text-amber-400" />
                <span>Solicitar Carga de Información</span>
              </h3>
              <button
                type="button"
                onClick={() => setModalRequestInfo({ isOpen: false, ship: null })}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-300">
              Buque: <strong className="text-white text-sm">{cleanShipName(modalRequestInfo.ship?.name)}</strong>
              <br />
              Elegí a quién deseás notificar para completar los datos faltantes del barco:
            </p>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                onClick={() => handleSendInfoRequest(modalRequestInfo.ship, 'pendiente_ambos')}
                className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group"
              >
                <strong className="text-xs text-white group-hover:text-amber-300 block">
                  📢 A Ambos: María José & Jefes de Obra
                </strong>
                <span className="text-[11px] text-slate-400">
                  Solicita datos del armador/contactos y medidas/ficha técnica naval simultáneamente.
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSendInfoRequest(modalRequestInfo.ship, 'pendiente_maria_jose')}
                className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group"
              >
                <strong className="text-xs text-white group-hover:text-amber-300 block">
                  📋 Solo a María José (Administración / Comercial)
                </strong>
                <span className="text-[11px] text-slate-400">
                  Solicita asignar Razón Social, nombre del armador, teléfonos y correos de contacto.
                </span>
              </button>

              <button
                type="button"
                onClick={() => handleSendInfoRequest(modalRequestInfo.ship, 'pendiente_jefe_obra')}
                className="w-full p-3 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-left transition-all cursor-pointer group"
              >
                <strong className="text-xs text-white group-hover:text-emerald-300 block">
                  🛠️ Solo a Jefes de Obra (Técnico / Operaciones)
                </strong>
                <span className="text-[11px] text-slate-400">
                  Solicita completar Eslora, Manga, Superficie de Casco y Componentes Navales.
                </span>
              </button>
            </div>

            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setModalRequestInfo({ isOpen: false, ship: null })}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold cursor-pointer"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
