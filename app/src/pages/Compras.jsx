import { useState, useEffect, useMemo, useCallback } from 'react'
import { ShoppingCart, SlidersHorizontal, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useModuleTab } from '../hooks/useModuleTab'
import { useSupabaseRealtimeRefresh } from '../hooks/useSupabaseRealtimeRefresh'
import CanonicalActiveSubmoduleBadge from '../components/canonical/CanonicalActiveSubmoduleBadge'
import { fetchComprasData } from '../services/comprasService'
import ComprasPedidosPanel from '../components/compras/ComprasPedidosPanel'
import ComprasProveedoresPanel from '../components/compras/ComprasProveedoresPanel'
import ComprasOcrPanel from '../components/compras/ComprasOcrPanel'
import { parseOrderQueryParams, computeContractorGroups, getCurrentFortnight } from '../lib/comprasConstants'
import { countLocalPendingOrders } from '../lib/comprasPedidosHelpers'

const COMPRAS_REALTIME_TABLES = ['purchase_orders', 'suppliers', 'materials', 'ships', 'work_orders', 'work_items', 'workers', 'macro_variables', 'purchase_documents', 'system_settings']

// Re-exportar utilidades y constantes canónicas para retrocompatibilidad
export { isCostAuditError, STATUS_OPTIONS, STANDARD_TRADES, CATALOG_RUBROS, OFFICIAL_UNITS, SECURITY_FACTORS, deduceUnitMeasure, formatArgPhoneForWhatsApp, getSearchMatchMap } from '../lib/comprasConstants'

export default function Compras() {
  const { profile, user, capabilities } = useAuth()
  const isSupervisorOrAdmin = capabilities
    ? capabilities.canUseComprasCompleteMode
    : (profile?.role === 'Supervisor' || profile?.role === 'Gerencia' || profile?.role === 'Admin')

  const [viewMode, setViewMode] = useState(isSupervisorOrAdmin ? 'completa' : 'simple')
  const { activeTab: rawActiveTab, setActiveTab, activeSubmodule, searchParams, setSearchParams } = useModuleTab('compras')
  const activeTab = !isSupervisorOrAdmin && rawActiveTab !== 'compras' ? 'compras' : rawActiveTab
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState(null)

  // Datos de Supabase
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

  // Modal de carga inicial y nuevo pedido
  const [showOrderModal, setShowOrderModal] = useState(false)
  const [editingOrder, setEditingOrder] = useState(null)
  const [initialKpiFilter, setInitialKpiFilter] = useState(() => searchParams.get('kpi') || null)
  const [mandadosOpenTick, setMandadosOpenTick] = useState(0)

  // Sincronización con parámetros URL (?mode=simple, ?nuevo=true, ?materialId=..., ?kpi=sin_precio)
  useEffect(() => {
    const { viewMode: vMode, newOrderPayload, kpiFilter: urlKpi } = parseOrderQueryParams(searchParams, materials)
    if (vMode) setViewMode(vMode)
    if (urlKpi) setInitialKpiFilter(urlKpi)
    if (newOrderPayload) {
      setEditingOrder(newOrderPayload)
      setShowOrderModal(true)
    }
  }, [searchParams, materials])

  useEffect(() => {
    if (!isSupervisorOrAdmin && viewMode !== 'simple') setViewMode('simple')
    else if (isSupervisorOrAdmin && activeTab !== 'compras' && viewMode === 'simple') setViewMode('completa')
  }, [isSupervisorOrAdmin, activeTab, viewMode])

  const handleCloseOrderModal = useCallback(() => {
    setShowOrderModal(false)
    setEditingOrder(null)
    const keys = ['nuevo', 'materialId', 'materialName', 'multiMaterials']
    if (keys.some((k) => searchParams.has(k))) {
      const next = new URLSearchParams(searchParams)
      keys.forEach((k) => next.delete(k))
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  const showFeedbackMsg = useCallback((type, text) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 5000)
  }, [])

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const d = await fetchComprasData()
      setPurchaseOrders(d.purchaseOrders)
      setSuppliers(d.suppliers)
      setMaterials(d.materials)
      setShips(d.ships)
      setWorkOrders(d.workOrders)
      setWorkItems(d.workItems)
      setWorkers(d.workers)
      setMacroVariables(d.macroVariables)
      setDocuments(d.purchaseDocuments)
      setSystemSettings(d.whatsappSetting)
    } catch (err) {
      console.error('Error cargando Compras:', err)
      showFeedbackMsg('error', 'Error al sincronizar datos de Compras: ' + (err.message || err))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [showFeedbackMsg])

  useSupabaseRealtimeRefresh({
    channelName: 'compras_live',
    tables: COMPRAS_REALTIME_TABLES,
    onSync: () => fetchData({ silent: true }),
    pauseWhen: Boolean(showOrderModal || editingOrder)
  })

  useEffect(() => {
    fetchData({ silent: false })
  }, [fetchData])

  const contractorGroups = useMemo(() => computeContractorGroups(workItems, suppliers), [workItems, suppliers])
  const astilleroWorkers = useMemo(() => workers.filter((w) => w.can_withdraw_materials), [workers])
  const currentFortnight = useMemo(() => getCurrentFortnight(), [])
  const localPendingCount = useMemo(() => countLocalPendingOrders(purchaseOrders, suppliers), [purchaseOrders, suppliers])

  return (
    <div className="space-y-4 pb-10">
      {/* ZONA 1: CABECERA PRINCIPAL Y CONTEXTO DE MÓDULO */}
      <div className="alon-zone-context flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-slate-950">
            <ShoppingCart className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-wide flex flex-wrap items-center gap-2">
              MÓDULO DE COMPRAS
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 uppercase">
                {viewMode === 'simple' ? 'Modo Solicitud Simple' : 'Gestión Completa M4b'}
              </span>
              <CanonicalActiveSubmoduleBadge
                label={activeSubmodule?.label || 'Registro de Pedidos'}
                suffix={`(${activeTab === 'proveedores' ? suppliers.length : activeTab === 'documentos' ? documents.length : purchaseOrders.length})`}
                theme={activeSubmodule?.theme || 'cyan'}
              />
            </h1>
            <p className="text-xs text-slate-400">
              {viewMode === 'simple'
                ? 'Panel simplificado para solicitud rápida de insumos de obra y pañol.'
                : 'Gestión integral de cotizaciones, proveedores, carga directa, stock y conciliación.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSupervisorOrAdmin && (
            <button
              type="button"
              onClick={() => {
                const nextMode = viewMode === 'simple' ? 'completa' : 'simple'
                setViewMode(nextMode)
                if (nextMode === 'simple' && activeTab !== 'compras') setActiveTab('compras')
              }}
              className="px-2.5 py-1.5 rounded-lg border border-slate-700 bg-slate-950 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer"
              title="Alternar entre Solicitud Simple y Gestión Completa"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>{viewMode === 'simple' ? 'Ver Modo Completo' : 'Ver Modo Simple'}</span>
            </button>
          )}

          {activeTab === 'compras' && (
            <button
              type="button"
              onClick={() => setMandadosOpenTick((n) => n + 1)}
              className="px-2.5 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 font-bold text-xs flex items-center gap-1 cursor-pointer transition-all"
              title="Generar mensaje de WhatsApp para el mandadero con materiales a retirar de proveedores locales"
            >
              <span>🛵 Mandados ({localPendingCount})</span>
            </button>
          )}

          <button
            type="button"
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

      {feedback && (
        <div
          className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-between animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/80 border-rose-500/50 text-rose-300'
          }`}
        >
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* PANELES MODULARES SEGÚN PESTAÑA ACTIVA */}
      {activeTab === 'compras' && (
        <ComprasPedidosPanel
          purchaseOrders={purchaseOrders} setPurchaseOrders={setPurchaseOrders}
          suppliers={suppliers} setSuppliers={setSuppliers}
          materials={materials} setMaterials={setMaterials}
          ships={ships} workOrders={workOrders} workItems={workItems} workers={workers}
          macroVariables={macroVariables} documents={documents} setDocuments={setDocuments}
          systemSettings={systemSettings} contractorGroups={contractorGroups} astilleroWorkers={astilleroWorkers}
          currentFortnight={currentFortnight} viewMode={viewMode} isSupervisorOrAdmin={isSupervisorOrAdmin}
          user={user} profile={profile} showFeedbackMsg={showFeedbackMsg} fetchData={fetchData}
          showOrderModal={showOrderModal} setShowOrderModal={setShowOrderModal}
          editingOrder={editingOrder} setEditingOrder={setEditingOrder} onCloseOrderModal={handleCloseOrderModal}
          mandadosOpenTick={mandadosOpenTick} initialKpiFilter={initialKpiFilter}
          onClearUrlKpi={() => {
            setInitialKpiFilter(null)
            if (searchParams.get('kpi')) {
              const next = new URLSearchParams(searchParams)
              next.delete('kpi')
              next.set('mode', viewMode)
              setSearchParams(next, { replace: true })
            }
          }}
        />
      )}

      {activeTab === 'proveedores' && (
        <ComprasProveedoresPanel
          suppliers={suppliers}
          setSuppliers={setSuppliers}
          purchaseOrders={purchaseOrders}
          showFeedbackMsg={showFeedbackMsg}
        />
      )}

      {activeTab === 'documentos' && (
        <ComprasOcrPanel
          documents={documents}
          setDocuments={setDocuments}
          suppliers={suppliers}
          ships={ships}
          purchaseOrders={purchaseOrders}
          showFeedbackMsg={showFeedbackMsg}
        />
      )}
    </div>
  )
}
