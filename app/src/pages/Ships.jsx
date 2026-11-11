import React, { useState, useEffect, useMemo } from 'react'
import {
  Ship,
  Calendar,
  Users,
  Anchor,
  Plus,
  BellRing,
  AlertCircle,
  X
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { assignMonotonicFolios } from '../lib/monotonicFolioEngine'
import { cleanLocation, computeShipOtMetrics, PREDEFINED_VESSEL_TYPES, cleanShipName } from '../lib/shipsConstants'
import ShipsBarcosPanel from '../components/ships/ShipsBarcosPanel'
import ShipsEstadiasPanel from '../components/ships/ShipsEstadiasPanel'
import ShipsArmadoresPanel from '../components/ships/ShipsArmadoresPanel'
import ShipsModalsContainer from '../components/ships/ShipsModals'

export default function Ships() {
  const { user } = useAuth()

  // Datos maestros de Supabase
  const [ships, setShips] = useState([])
  const [owners, setOwners] = useState([])
  const [stays, setStays] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [workItems, setWorkItems] = useState([])
  const [orphanLabor, setOrphanLabor] = useState([])
  const [orphanTerceros, setOrphanTerceros] = useState([])
  const [orphanCompras, setOrphanCompras] = useState([])
  const [statusMessage, setStatusMessage] = useState(null)

  // Pestaña y perspectiva activa
  const [activeTab, setActiveTab] = useState('buques') // 'buques' | 'movimientos' | 'armadores'
  const [activeRolePerspective, setActiveRolePerspective] = useState('admin') // 'admin' | 'jefe_obra' | 'maria_jose'

  // Estados de apertura de Modales
  const [selectedShip360, setSelectedShip360] = useState(null)
  const [subTab360, setSubTab360] = useState('tecnica')
  const [modalShip, setModalShip] = useState({ isOpen: false, ship: null, isCustomVesselType: false, customVesselTypeVal: '' })
  const [modalStay, setModalStay] = useState({ isOpen: false, stay: null, defaultShipId: '' })
  const [modalOwner, setModalOwner] = useState({ isOpen: false, owner: null })
  const [modalDeleteOwner, setModalDeleteOwner] = useState({ isOpen: false, owner: null, linkedShips: [] })
  const [modalAssignOrphan, setModalAssignOrphan] = useState({ isOpen: false, ship: null, selectedOwnerId: '' })
  const [modalRequestInfo, setModalRequestInfo] = useState({ isOpen: false, ship: null, requestType: 'pendiente_jefe_obra', notes: '' })

  // Carga inicial de datos de Supabase
  const loadInitialData = async () => {
    try {
      const [shipsRes, ownersRes, staysRes, contactsRes, wosRes, itemsRes, oLabRes, oTercRes, oCompRes] = await Promise.all([
        supabase.from('ships').select('*, owners(*)').order('name', { ascending: true }),
        supabase.from('owners').select('*').order('name', { ascending: true }),
        supabase.from('ship_stays').select('*, ships(id, name)').order('start_date', { ascending: false }),
        supabase.from('contacts').select('*, owners(id, name), ships(id, name)').order('name', { ascending: true }),
        supabase.from('work_orders').select('id, ship_id, ot_number, title, status, description, created_at').order('created_at', { ascending: false }),
        supabase.from('work_items').select('id, work_order_id, status, description, contractors, work_type').order('created_at', { ascending: true }),
        supabase.from('labor_logs').select('id, ship_id').is('work_order_id', null),
        supabase.from('third_party_services').select('id, ship_id').is('work_order_id', null),
        supabase.from('purchase_orders').select('id, ship_id').is('work_order_id', null)
      ])

      if (oLabRes.data) setOrphanLabor(oLabRes.data)
      if (oTercRes.data) setOrphanTerceros(oTercRes.data)
      if (oCompRes.data) setOrphanCompras(oCompRes.data)
      if (shipsRes.data) setShips(assignMonotonicFolios(shipsRes.data, { dateField: 'created_at' }))
      if (ownersRes.data) setOwners(assignMonotonicFolios(ownersRes.data, { dateField: 'created_at' }))
      if (staysRes.data) setStays(assignMonotonicFolios(staysRes.data, { dateField: 'start_date' }))
      if (wosRes.data) setWorkOrders(wosRes.data)
      if (itemsRes.data) setWorkItems(itemsRes.data)
    } catch (err) {
      console.error('Error cargando módulo barcos:', err)
      setStatusMessage({ type: 'error', text: 'Error al conectar con Supabase: ' + err.message })
    }
  }

  useEffect(() => { loadInitialData() }, [])

  // Métricas calculadas
  const getShipOtMetrics = useMemo(() => {
    return computeShipOtMetrics(ships, workOrders, workItems, orphanLabor, orphanTerceros, orphanCompras)
  }, [ships, workOrders, workItems, orphanLabor, orphanTerceros, orphanCompras])

  const totalShips = ships.length
  const varaderoCount = ships.filter(s => cleanLocation(s.current_location) === 'VARADERO' && s.is_active !== false).length
  const muelleCount = ships.filter(s => cleanLocation(s.current_location) === 'MUELLE' && s.is_active !== false).length
  const puertoCount = ships.filter(s => cleanLocation(s.current_location).includes('PUERTO') && s.is_active !== false).length
  const pendingRequestsCount = ships.filter(s => s.info_request_status && s.info_request_status !== 'completo').length
  const shipsWithOrphanCostsCount = ships.filter(s => (getShipOtMetrics[s.id]?.orphanTotal || 0) > 0).length

  // Handlers de apertura de modales y acciones rápidas
  const handleOpenNewShip = () => setModalShip({ isOpen: true, ship: { name: '', owner_id: '', current_location: 'VARADERO', vessel_type: 'Pesquero', eslora_mts: '', manga_mts: '', puntal_mts: '', superficie_casco_m2: '', notes: '', technical_specs: {} }, isCustomVesselType: false, customVesselTypeVal: '' })
  const handleOpenEditShip = (ship) => setModalShip({ isOpen: true, ship: { ...ship }, isCustomVesselType: !PREDEFINED_VESSEL_TYPES.includes(ship.vessel_type || 'Pesquero'), customVesselTypeVal: ship.vessel_type || '' })
  const handleOpenShip360 = (ship) => { setSelectedShip360(ship); setSubTab360(activeRolePerspective === 'maria_jose' ? 'armador' : 'tecnica') }
  const handleOpenNewStay = (shipId = '') => setModalStay({ isOpen: true, stay: { ship_id: shipId || (ships[0]?.id || ''), location: 'VARADERO', start_date: new Date().toISOString().split('T')[0], end_date: '', notes: '' }, defaultShipId: shipId })
  const handleOpenEditStay = (stay) => setModalStay({ isOpen: true, stay: { ...stay }, defaultShipId: stay.ship_id })
  const handleOpenNewOwner = () => setModalOwner({ isOpen: true, owner: { name: '', armador_name: '', armador_phone: '', email_principal: '', email_secundario: '', cuit: '', notes: '' } })
  const handleOpenEditOwner = (owner) => setModalOwner({ isOpen: true, owner: { ...owner } })
  const handleOpenDeleteOwner = (owner) => setModalDeleteOwner({ isOpen: true, owner, linkedShips: ships.filter(s => s.owner_id === owner.id) })

  const handleToggleShipActive = async (ship) => {
    const nextStatus = ship.is_active === false
    if (!window.confirm(`¿Confirmás ${nextStatus ? 'reactivar' : 'desactivar'} el buque "${cleanShipName(ship.name)}"?`)) return
    try {
      await supabase.from('ships').update({ is_active: nextStatus, status: nextStatus ? 'Activo' : 'Terminado' }).eq('id', ship.id)
      setStatusMessage({ type: 'info', text: `Buque "${cleanShipName(ship.name)}" ${nextStatus ? 'reactivado' : 'desactivado'}.` })
      await loadInitialData()
    } catch (err) { setStatusMessage({ type: 'error', text: err.message }) }
  }

  const handleMarkRequestComplete = async (ship) => {
    try {
      await supabase.from('ships').update({ info_request_status: 'completo', info_request_notes: null }).eq('id', ship.id)
      setStatusMessage({ type: 'success', text: 'Solicitud marcada como completada.' })
      await loadInitialData()
    } catch (err) { setStatusMessage({ type: 'error', text: err.message }) }
  }

  return (
    <div className="space-y-4">
      {/* ZONA 1 (CONTEXTO CORPORATIVO): IDENTIDAD, PERSPECTIVA Y ACCIONES */}
      <div className="alon-zone-context p-4 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Ship className="w-6 h-6 text-primary" />
              <span>Flota Naval & Estadías</span>
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800">
              v3.5 CANÓNICA
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Relevamiento técnico 360°, inventario naval y control de muelle y varadero de AlonCar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Perspectiva de rol */}
          <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-1 text-xs">
            <span className="text-[10px] text-slate-400 font-bold px-2">Rol:</span>
            <button type="button" onClick={() => setActiveRolePerspective('admin')} className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all ${activeRolePerspective === 'admin' ? 'bg-primary text-slate-950' : 'text-slate-400 hover:text-white'}`}>Admin</button>
            <button type="button" onClick={() => setActiveRolePerspective('jefe_obra')} className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all ${activeRolePerspective === 'jefe_obra' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}>Jefe Obra</button>
            <button type="button" onClick={() => setActiveRolePerspective('maria_jose')} className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer transition-all ${activeRolePerspective === 'maria_jose' ? 'bg-amber-400 text-slate-950' : 'text-slate-400 hover:text-white'}`}>María José</button>
          </div>

          <button
            type="button"
            onClick={activeTab === 'buques' ? handleOpenNewShip : activeTab === 'movimientos' ? () => handleOpenNewStay() : handleOpenNewOwner}
            className="px-4 py-2 bg-gradient-to-r from-primary to-blue-500 hover:brightness-110 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{activeTab === 'buques' ? '+ Nuevo Buque' : activeTab === 'movimientos' ? '+ Nuevo Movimiento' : '+ Nuevo Armador'}</span>
          </button>
        </div>
      </div>

      {/* SELECTOR DE PESTAÑAS */}
      <div className="flex items-center gap-2 border-b border-slate-800 pb-2">
        <button type="button" onClick={() => setActiveTab('buques')} className={`px-3 py-1.5 rounded-lg font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition-all ${activeTab === 'buques' ? 'bg-primary text-slate-950 shadow-md' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}`}><Ship className="w-3.5 h-3.5" /><span>1. Buques ({ships.length})</span></button>
        <button type="button" onClick={() => setActiveTab('movimientos')} className={`px-3 py-1.5 rounded-lg font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition-all ${activeTab === 'movimientos' ? 'bg-cyan-500 text-slate-950 shadow-md' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}`}><Calendar className="w-3.5 h-3.5" /><span>2. Movimientos ({stays.length})</span></button>
        <button type="button" onClick={() => setActiveTab('armadores')} className={`px-3 py-1.5 rounded-lg font-extrabold text-xs flex items-center gap-1.5 cursor-pointer transition-all ${activeTab === 'armadores' ? 'bg-amber-400 text-slate-950 shadow-md' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'}`}><Users className="w-3.5 h-3.5" /><span>3. Armadores ({owners.length})</span></button>
      </div>

      {statusMessage && (
        <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${statusMessage.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' : statusMessage.type === 'info' ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300' : 'bg-rose-950/80 border-rose-500/50 text-rose-300'}`}>
          <span>{statusMessage.text}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ZONA 2: RADAR DE KPIS EN VIVO */}
      <div className="alon-zone-kpis p-4 space-y-3">
        <span className="text-xs font-black uppercase tracking-wider text-amber-400">📊 RADAR DE KPIS Y ALERTAS OPERATIVAS</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between"><span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5"><Ship className="w-3.5 h-3.5 text-primary" /> Total Buques</span><span className="text-2xl font-black text-white font-mono mt-2">{totalShips}</span></div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between"><span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5"><Anchor className="w-3.5 h-3.5 text-amber-400" /> Varadero</span><span className="text-2xl font-black text-amber-300 font-mono mt-2">{varaderoCount}</span></div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between"><span className="text-[11px] font-bold text-cyan-400 flex items-center gap-1.5"><Anchor className="w-3.5 h-3.5 text-cyan-400" /> Muelle</span><span className="text-2xl font-black text-cyan-300 font-mono mt-2">{muelleCount}</span></div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between"><span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5"><Anchor className="w-3.5 h-3.5 text-slate-400" /> Puerto</span><span className="text-2xl font-black text-slate-200 font-mono mt-2">{puertoCount}</span></div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between"><span className="text-[11px] font-bold text-amber-400 flex items-center gap-1.5"><BellRing className="w-3.5 h-3.5 text-amber-400" /> Solicitudes</span><span className="text-2xl font-black text-amber-300 font-mono mt-2">{pendingRequestsCount}</span></div>
          <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-col justify-between"><span className="text-[11px] font-bold text-rose-400 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5 text-rose-400" /> Costos s/OT</span><span className="text-2xl font-black text-rose-300 font-mono mt-2">{shipsWithOrphanCostsCount}</span></div>
        </div>
      </div>

      {/* PANELES MODULARES */}
      {activeTab === 'buques' && (
        <ShipsBarcosPanel ships={ships} setShips={setShips} owners={owners} stays={stays} getShipOtMetrics={getShipOtMetrics} user={user} activeRolePerspective={activeRolePerspective} onOpenNewShip={handleOpenNewShip} onOpenEditShip={handleOpenEditShip} onOpenShip360={handleOpenShip360} onOpenRequestInfo={(s) => setModalRequestInfo({ isOpen: true, ship: s, requestType: 'pendiente_jefe_obra', notes: '' })} onOpenNewStay={handleOpenNewStay} onDismissOrphanAlert={handleDismissOrphanAlert} onAssignOrphan={(s) => setModalAssignOrphan({ isOpen: true, ship: s, selectedOwnerId: '' })} onToggleShipActive={handleToggleShipActive} onMarkRequestComplete={handleMarkRequestComplete} setStatusMessage={setStatusMessage} loadInitialData={loadInitialData} />
      )}
      {activeTab === 'movimientos' && (
        <ShipsEstadiasPanel stays={stays} setStays={setStays} ships={ships} setShips={setShips} user={user} activeRolePerspective={activeRolePerspective} onOpenNewStay={handleOpenNewStay} onOpenEditStay={handleOpenEditStay} setStatusMessage={setStatusMessage} loadInitialData={loadInitialData} />
      )}
      {activeTab === 'armadores' && (
        <ShipsArmadoresPanel owners={owners} setOwners={setOwners} ships={ships} user={user} activeRolePerspective={activeRolePerspective} onOpenNewOwner={handleOpenNewOwner} onOpenEditOwner={handleOpenEditOwner} onOpenDeleteOwner={handleOpenDeleteOwner} setStatusMessage={setStatusMessage} loadInitialData={loadInitialData} />
      )}

      {/* CONTENEDOR INTEGRAL DE MODALES */}
      <ShipsModalsContainer selectedShip360={selectedShip360} setSelectedShip360={setSelectedShip360} subTab360={subTab360} setSubTab360={setSubTab360} modalShip={modalShip} setModalShip={setModalShip} modalStay={modalStay} setModalStay={setModalStay} modalOwner={modalOwner} setModalOwner={setModalOwner} modalDeleteOwner={modalDeleteOwner} setModalDeleteOwner={setModalDeleteOwner} modalAssignOrphan={modalAssignOrphan} setModalAssignOrphan={setModalAssignOrphan} modalRequestInfo={modalRequestInfo} setModalRequestInfo={setModalRequestInfo} ships={ships} setShips={setShips} owners={owners} setOwners={setOwners} stays={stays} setStays={setStays} workOrders={workOrders} workItems={workItems} getShipOtMetrics={getShipOtMetrics} user={user} activeRolePerspective={activeRolePerspective} setStatusMessage={setStatusMessage} loadInitialData={loadInitialData} handleOpenEditShip={handleOpenEditShip} handleOpenNewStay={handleOpenNewStay} />
    </div>
  )
}
