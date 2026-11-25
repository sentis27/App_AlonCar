import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  Ship,
  Anchor,
  Plus,
  BellRing,
  AlertCircle,
  X
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useModuleTab } from '../hooks/useModuleTab'
import { resolveUserRolePerspective } from '../lib/navigationCatalog'
import { resolveInitialModuleFilters } from '../hooks/useModuleFilterMemory'
import { useSupabaseRealtimeRefresh } from '../hooks/useSupabaseRealtimeRefresh'
import CanonicalActiveSubmoduleBadge from '../components/canonical/CanonicalActiveSubmoduleBadge'
import { cleanLocation, computeShipOtMetrics, PREDEFINED_VESSEL_TYPES, cleanShipName } from '../lib/shipsConstants'
import { getTodayArIso } from '../lib/dateTimeCanonical'
import {
  fetchShipsModuleData,
  toggleShipActiveService,
  markShipRequestCompleteService,
  dismissShipOrphanAlertService
} from '../lib/shipsService'
import ShipsBarcosPanel from '../components/ships/ShipsBarcosPanel'
import ShipsEstadiasPanel from '../components/ships/ShipsEstadiasPanel'
import ShipsArmadoresPanel from '../components/ships/ShipsArmadoresPanel'
import ShipsModalsContainer from '../components/ships/ShipsModals'

export default function Ships() {
  const { user, profile, capabilities } = useAuth()
  const initialShipsShared = useMemo(
    () => resolveInitialModuleFilters(user, profile, 'ships_buques'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

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

  // Submódulo sincronizado vía Sidebar/URL y perspectiva automática del puesto autenticado
  const { activeTab, setActiveTab, activeSubmodule } = useModuleTab('barcos')
  const activeRolePerspective = capabilities?.rolePerspective || resolveUserRolePerspective(profile)
  const [locationFilter, setLocationFilter] = useState(initialShipsShared.locationFilter)
  const [requestFilter, setRequestFilter] = useState(initialShipsShared.requestFilter)
  const [roleQuickFilter, setRoleQuickFilter] = useState(initialShipsShared.roleQuickFilter)

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
  const loadInitialData = useCallback(async () => {
    try {
      const data = await fetchShipsModuleData()
      setOrphanLabor(data.orphanLabor)
      setOrphanTerceros(data.orphanTerceros)
      setOrphanCompras(data.orphanCompras)
      setShips(data.ships)
      setOwners(data.owners)
      setStays(data.stays)
      setWorkOrders(data.workOrders)
      setWorkItems(data.workItems)
    } catch (err) {
      console.error('Error cargando módulo barcos:', err)
      setStatusMessage({ type: 'error', text: 'Error al conectar con Supabase: ' + err.message })
    }
  }, [])

  useSupabaseRealtimeRefresh({
    channelName: 'ships_live',
    tables: ['ships', 'owners', 'ship_stays', 'contacts', 'work_orders', 'work_items', 'labor_logs', 'third_party_services', 'purchase_orders'],
    onSync: loadInitialData,
    pauseWhen: Boolean(modalShip.isOpen || modalStay.isOpen || modalOwner.isOpen || modalDeleteOwner.isOpen || modalAssignOrphan.isOpen || modalRequestInfo.isOpen)
  })

  useEffect(() => { loadInitialData() }, [loadInitialData])

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
  const handleOpenNewStay = (shipId = '') => setModalStay({ isOpen: true, stay: { ship_id: shipId || (ships[0]?.id || ''), location: 'VARADERO', start_date: getTodayArIso(), end_date: '', notes: '' }, defaultShipId: shipId })
  const handleOpenEditStay = (stay) => setModalStay({ isOpen: true, stay: { ...stay }, defaultShipId: stay.ship_id })
  const handleOpenNewOwner = () => setModalOwner({ isOpen: true, owner: { name: '', armador_name: '', armador_phone: '', email_principal: '', email_secundario: '', cuit: '', notes: '' } })
  const handleOpenEditOwner = (owner) => setModalOwner({ isOpen: true, owner: { ...owner } })
  const handleOpenDeleteOwner = (owner) => setModalDeleteOwner({ isOpen: true, owner, linkedShips: ships.filter(s => s.owner_id === owner.id) })

  const handleKpiClick = (type) => {
    setActiveTab('buques')
    if (type === 'todos') {
      setLocationFilter('todos'); setRequestFilter('todos'); setRoleQuickFilter('todos')
    } else if (type === 'pendientes') {
      setLocationFilter('todos'); setRoleQuickFilter('todos')
      setRequestFilter((prev) => (prev === 'pendientes' ? 'todos' : 'pendientes'))
    } else if (type === 'sin_ot') {
      setLocationFilter('todos'); setRequestFilter('todos')
      setRoleQuickFilter((prev) => (prev === 'sin_ot' ? 'todos' : 'sin_ot'))
    } else {
      setRequestFilter('todos'); setRoleQuickFilter('todos')
      setLocationFilter((prev) => (prev === type ? 'todos' : type))
    }
  }

  const handleToggleShipActive = async (ship) => {
    const nextStatus = ship.is_active === false
    if (!window.confirm(`¿Confirmás ${nextStatus ? 'reactivar' : 'desactivar'} el buque "${cleanShipName(ship.name)}"?`)) return
    try {
      await toggleShipActiveService({ ship, user: user?.email })
      setStatusMessage({ type: 'info', text: `Buque "${cleanShipName(ship.name)}" ${nextStatus ? 'reactivado' : 'desactivado'}.` })
      await loadInitialData()
    } catch (err) { setStatusMessage({ type: 'error', text: err.message }) }
  }

  const handleMarkRequestComplete = async (ship) => {
    try {
      await markShipRequestCompleteService({ ship, user: user?.email })
      setStatusMessage({ type: 'success', text: 'Solicitud marcada como completada.' })
      await loadInitialData()
    } catch (err) { setStatusMessage({ type: 'error', text: err.message }) }
  }

  const handleDismissOrphanAlert = async (ship) => {
    if (!window.confirm(`¿Apagar la alerta de buque huérfano para "${cleanShipName(ship.name)}"?`)) return
    try {
      await dismissShipOrphanAlertService({ ship, user: user?.email })
      if (selectedShip360?.id === ship.id) setSelectedShip360((prev) => ({ ...prev, orphan_owner_alert: false }))
      setStatusMessage({ type: 'info', text: 'Alerta de buque huérfano apagada.' })
      await loadInitialData()
    } catch (err) { setStatusMessage({ type: 'error', text: err.message }) }
  }

  return (
    <div className="space-y-4">
      {/* ZONA 1 (CONTEXTO CORPORATIVO): IDENTIDAD Y ACCIÓN PRINCIPAL */}
      <div className="alon-zone-context p-4 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl md:text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <Ship className="w-6 h-6 text-primary" />
              <span>Flota Naval & Estadías</span>
            </h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-800">
              v3.5 CANÓNICA
            </span>
            <CanonicalActiveSubmoduleBadge
              label={activeSubmodule?.label || '1. Buques'}
              suffix={`(${activeTab === 'movimientos' ? stays.length : activeTab === 'armadores' ? owners.length : ships.length})`}
              theme={activeSubmodule?.theme || 'cyan'}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Relevamiento técnico 360°, inventario naval y control de muelle y varadero de AlonCar.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={activeTab === 'buques' ? handleOpenNewShip : activeTab === 'movimientos' ? () => handleOpenNewStay() : handleOpenNewOwner}
            className="px-4 py-2 bg-gradient-to-r from-primary to-blue-500 hover:brightness-110 text-slate-950 font-black rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-lg transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>{activeTab === 'buques' ? 'Nuevo Buque' : activeTab === 'movimientos' ? 'Nuevo Movimiento' : 'Nuevo Armador'}</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-3 rounded-xl border text-xs font-semibold flex items-center justify-between ${statusMessage.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' : statusMessage.type === 'info' ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300' : 'bg-rose-950/80 border-rose-500/50 text-rose-300'}`}>
          <span>{statusMessage.text}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* ZONA 2: RADAR DE KPIS EN VIVO */}
      <div className="alon-zone-kpis p-4 space-y-3">
        <span className="text-xs font-black uppercase tracking-wider text-amber-400">📊 RADAR DE KPIS Y ALERTAS OPERATIVAS (CLIC PARA FILTRAR)</span>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { id: 'todos', label: 'Total Buques', val: totalShips, icon: <Ship className="w-3.5 h-3.5 text-primary" />, cls: 'text-slate-400', valCls: 'text-white', active: locationFilter === 'todos' && requestFilter === 'todos' && roleQuickFilter === 'todos' },
            { id: 'VARADERO', label: 'Varadero', val: varaderoCount, icon: <Anchor className="w-3.5 h-3.5 text-amber-400" />, cls: 'text-amber-400', valCls: 'text-amber-300', active: locationFilter === 'VARADERO' },
            { id: 'MUELLE', label: 'Muelle', val: muelleCount, icon: <Anchor className="w-3.5 h-3.5 text-cyan-400" />, cls: 'text-cyan-400', valCls: 'text-cyan-300', active: locationFilter === 'MUELLE' },
            { id: 'PUERTO', label: 'Puerto', val: puertoCount, icon: <Anchor className="w-3.5 h-3.5 text-slate-400" />, cls: 'text-slate-300', valCls: 'text-slate-200', active: locationFilter === 'PUERTO' },
            { id: 'pendientes', label: 'Solicitudes', val: pendingRequestsCount, icon: <BellRing className="w-3.5 h-3.5 text-amber-400" />, cls: 'text-amber-400', valCls: 'text-amber-300', active: requestFilter === 'pendientes' },
            { id: 'sin_ot', label: 'Costos s/OT', val: shipsWithOrphanCostsCount, icon: <AlertCircle className="w-3.5 h-3.5 text-rose-400" />, cls: 'text-rose-400', valCls: 'text-rose-300', active: roleQuickFilter === 'sin_ot' }
          ].map((k) => (
            <button key={k.id} type="button" onClick={() => handleKpiClick(k.id)} className={`p-3 rounded-xl bg-slate-900/80 border text-left flex flex-col justify-between cursor-pointer transition-all hover:border-cyan-500/50 ${k.active ? 'border-cyan-400 ring-1 ring-cyan-400/50' : 'border-slate-800'}`}>
              <span className={`text-[11px] font-bold flex items-center gap-1.5 ${k.cls}`}>{k.icon} {k.label}</span>
              <span className={`text-2xl font-black font-mono mt-2 ${k.valCls}`}>{k.val}</span>
            </button>
          ))}
        </div>
      </div>

      {/* PANELES MODULARES */}
      {activeTab === 'buques' && (
        <ShipsBarcosPanel ships={ships} setShips={setShips} owners={owners} stays={stays} getShipOtMetrics={getShipOtMetrics} user={user} activeRolePerspective={activeRolePerspective} locationFilter={locationFilter} setLocationFilter={setLocationFilter} requestFilter={requestFilter} setRequestFilter={setRequestFilter} roleQuickFilter={roleQuickFilter} setRoleQuickFilter={setRoleQuickFilter} onOpenNewShip={handleOpenNewShip} onOpenEditShip={handleOpenEditShip} onOpenShip360={handleOpenShip360} onOpenRequestInfo={(s) => setModalRequestInfo({ isOpen: true, ship: s, requestType: 'pendiente_jefe_obra', notes: '' })} onOpenNewStay={handleOpenNewStay} onDismissOrphanAlert={handleDismissOrphanAlert} onAssignOrphan={(s) => setModalAssignOrphan({ isOpen: true, ship: s, selectedOwnerId: '' })} onToggleShipActive={handleToggleShipActive} onMarkRequestComplete={handleMarkRequestComplete} setStatusMessage={setStatusMessage} loadInitialData={loadInitialData} />
      )}
      {activeTab === 'movimientos' && (
        <ShipsEstadiasPanel stays={stays} setStays={setStays} ships={ships} setShips={setShips} user={user} activeRolePerspective={activeRolePerspective} onOpenNewStay={handleOpenNewStay} onOpenEditStay={handleOpenEditStay} setStatusMessage={setStatusMessage} loadInitialData={loadInitialData} />
      )}
      {activeTab === 'armadores' && (
        <ShipsArmadoresPanel owners={owners} setOwners={setOwners} ships={ships} setShips={setShips} user={user} activeRolePerspective={activeRolePerspective} onOpenNewOwner={handleOpenNewOwner} onOpenEditOwner={handleOpenEditOwner} onOpenDeleteOwner={handleOpenDeleteOwner} setStatusMessage={setStatusMessage} loadInitialData={loadInitialData} />
      )}

      {/* CONTENEDOR INTEGRAL DE MODALES */}
      <ShipsModalsContainer selectedShip360={selectedShip360} setSelectedShip360={setSelectedShip360} subTab360={subTab360} setSubTab360={setSubTab360} modalShip={modalShip} setModalShip={setModalShip} modalStay={modalStay} setModalStay={setModalStay} modalOwner={modalOwner} setModalOwner={setModalOwner} modalDeleteOwner={modalDeleteOwner} setModalDeleteOwner={setModalDeleteOwner} modalAssignOrphan={modalAssignOrphan} setModalAssignOrphan={setModalAssignOrphan} modalRequestInfo={modalRequestInfo} setModalRequestInfo={setModalRequestInfo} ships={ships} setShips={setShips} owners={owners} setOwners={setOwners} stays={stays} setStays={setStays} workOrders={workOrders} workItems={workItems} getShipOtMetrics={getShipOtMetrics} user={user} activeRolePerspective={activeRolePerspective} setStatusMessage={setStatusMessage} loadInitialData={loadInitialData} handleOpenEditShip={handleOpenEditShip} handleOpenNewStay={handleOpenNewStay} handleDismissOrphanAlert={handleDismissOrphanAlert} />
    </div>
  )
}
