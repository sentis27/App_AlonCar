import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import PanolHeader from '../components/panol/PanolHeader'
import PanolAlertasPanel from '../components/panol/PanolAlertasPanel'
import PanolToolbar from '../components/panol/PanolToolbar'
import PanolMovimientosPanel from '../components/panol/PanolMovimientosPanel'
import PanolStockPanel from '../components/panol/PanolStockPanel'
import { PanolModalsContainer } from '../components/panol/PanolModals'
import { fetchPanolData } from '../lib/panolService'
import {
  calculateGasStats,
  calculatePanolKpis,
  calculatePanolTotals,
  getEnabledWorkersAndContractors,
  formatWorkOrderTooltip,
  filterPanolTransactions,
  filterPanolMaterials
} from '../lib/panolConstants'
import { filterEligiblePersonnel, getContractorEnabledWos } from '../lib/allocationEngine'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function Panol() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'Admin' || profile?.role === 'Gerencia'

  const [activeTab, setActiveTab] = useState(() => {
    const t = searchParams.get('tab')
    return (t === 'movimientos' || t === 'kardex') ? 'planillas' : (t || 'planillas')
  })

  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState(null)
  const [materials, setMaterials] = useState([])
  const [inventoryTx, setInventoryTx] = useState([])
  const [gasMovements, setGasMovements] = useState([])
  const [rubros, setRubros] = useState([])
  const [suppliers, setSuppliers] = useState([])
  const [ships, setShips] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [workers, setWorkers] = useState([])
  const [workItems, setWorkItems] = useState([])
  const [pendingAlerts, setPendingAlerts] = useState([])

  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)
  const [filterPeriod, setFilterPeriod] = useState('TODOS')
  const [filterCategory, setFilterCategory] = useState('TODAS')
  const [filterShip, setFilterShip] = useState('TODOS')
  const [filterStockOnly, setFilterStockOnly] = useState(false)
  const [activeKpiFilter, setActiveKpiFilter] = useState(null)

  // Estados de Modales
  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false)
  const [editingWithdrawalRow, setEditingWithdrawalRow] = useState(null)
  const [showNewMaterialModal, setShowNewMaterialModal] = useState(false)
  const [showStockAdjustModal, setShowStockAdjustModal] = useState({ isOpen: false, material: null })
  const [showGasModal, setShowGasModal] = useState({ isOpen: false, operationType: 'PRIMERA_ENTREGA' })
  const [quickPurchaseModal, setQuickPurchaseModal] = useState({ isOpen: false, material: null, quantity: '', urgency: 'SIN_APURO' })
  const [requestOtModal, setRequestOtModal] = useState({ isOpen: false, txId: null, shipId: '', targetWorkerOrContractor: '', reason: '' })
  const [workerPermissionModal, setWorkerPermissionModal] = useState({ isOpen: false, workerId: '', reason: '' })
  const [previewImage, setPreviewImage] = useState(null)

  useEffect(() => {
    const t = searchParams.get('tab')
    if (t && ['planillas', 'gases', 'catalogo', 'epp', 'movimientos', 'kardex'].includes(t)) {
      setActiveTab((t === 'movimientos' || t === 'kardex') ? 'planillas' : t)
    }
  }, [searchParams])

  const changeTab = (tab) => {
    setActiveTab(tab)
    setSearchParams({ tab })
    setActiveKpiFilter(null)
  }

  const showFeedback = (type, text) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 4500)
  }

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const d = await fetchPanolData()
      setMaterials(d.materials); setInventoryTx(d.inventoryTx); setGasMovements(d.gasMovements)
      setRubros(d.rubros); setSuppliers(d.suppliers); setShips(d.ships); setWorkOrders(d.workOrders)
      setWorkers(d.workers); setWorkItems(d.workItems); setPendingAlerts(d.pendingAlerts)
    } catch (err) {
      showFeedback('error', 'Error cargando datos de Pañol: ' + err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const gasStats = useMemo(() => calculateGasStats(suppliers, gasMovements), [suppliers, gasMovements])
  const eligiblePersonnel = useMemo(() => filterEligiblePersonnel(workers, { permissionField: 'can_withdraw_materials' }), [workers])
  const { astilleroWorkers, contractorGroups, unauthorizedWorkers, allEligibleNames: availableGroups } = eligiblePersonnel

  const getEnabledPersonnel = useCallback(
    (shipId, workOrderId) => getEnabledWorkersAndContractors(shipId, workOrderId, workItems, eligiblePersonnel),
    [workItems, eligiblePersonnel]
  )

  const getEnabledWos = useCallback(
    (shipId, workerOrContractor) => getContractorEnabledWos(shipId, workerOrContractor, workOrders, workItems, eligiblePersonnel),
    [workOrders, workItems, eligiblePersonnel]
  )

  const kpiStats = useMemo(() => calculatePanolKpis(materials, inventoryTx, gasStats), [materials, inventoryTx, gasStats])

  const filteredTransactions = useMemo(
    () => filterPanolTransactions(inventoryTx, { activeKpiFilter, filterPeriod, filterShip, filterCategory, searchQuery, materials, ships, workOrders }),
    [inventoryTx, activeKpiFilter, filterPeriod, filterShip, filterCategory, searchQuery, materials, ships, workOrders]
  )

  const panolTotals = useMemo(() => calculatePanolTotals(filteredTransactions), [filteredTransactions])
  const hasActivePanolFilter = Boolean(searchQuery.trim() || activeKpiFilter || filterShip !== 'TODOS' || filterCategory !== 'TODAS' || filterPeriod !== 'TODOS')

  const filteredMaterials = useMemo(
    () => filterPanolMaterials(materials, { activeKpiFilter, filterStockOnly, filterCategory, searchQuery }),
    [materials, activeKpiFilter, filterStockOnly, filterCategory, searchQuery]
  )

  return (
    <div className="space-y-4 pb-10 font-sans text-slate-100 antialiased selection:bg-cyan-500 selection:text-slate-950">
      {feedback && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-xs font-bold ${
          feedback.type === 'error' ? 'bg-rose-950/95 border-rose-500 text-rose-200' : 'bg-emerald-950/95 border-emerald-500 text-emerald-200'
        }`}>
          {feedback.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="ml-2 text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* ZONA 1: CONTEXTO OPERATIVO */}
      <PanolHeader
        activeTab={activeTab} filteredTransactionsCount={filteredTransactions.length} criticalCount={kpiStats.criticalCount} onChangeTab={changeTab}
        onOpenWithdrawalModal={() => { setEditingWithdrawalRow(null); setShowWithdrawalModal(true) }}
        onOpenNewMaterialModal={() => setShowNewMaterialModal(true)}
        onOpenGasModal={() => setShowGasModal({ isOpen: true, operationType: 'PRIMERA_ENTREGA' })}
        navigate={navigate}
      />

      {/* ZONA 2: RADAR DE KPIS */}
      <PanolAlertasPanel
        kpiStats={kpiStats} activeKpiFilter={activeKpiFilter} onClearKpiFilter={() => setActiveKpiFilter(null)}
        onToggleKpiFilter={(k, tab) => { setActiveKpiFilter(activeKpiFilter === k ? null : k); if (tab && activeTab !== tab) changeTab(tab) }}
      />

      {/* BLOQUE OPERATIVO UNIFICADO (ZONA 3 + ZONA 4) */}
      <div className="alon-workspace-block">
        <PanolToolbar
          searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchInputRef={searchInputRef}
          filterPeriod={filterPeriod} setFilterPeriod={setFilterPeriod}
          filterCategory={filterCategory} setFilterCategory={setFilterCategory}
          filterShip={filterShip} setFilterShip={setFilterShip}
          filterStockOnly={filterStockOnly} setFilterStockOnly={setFilterStockOnly}
          activeTab={activeTab} ships={ships}
        />

        {activeTab === 'planillas' && (
          <PanolMovimientosPanel
            filteredTransactions={filteredTransactions} totalTransactionsCount={inventoryTx.length} loading={loading}
            materials={materials} setMaterials={setMaterials} ships={ships} workOrders={workOrders} workItems={workItems}
            astilleroWorkers={astilleroWorkers} contractorGroups={contractorGroups} availableGroups={availableGroups}
            pendingAlerts={pendingAlerts} isAdmin={isAdmin} searchQuery={searchQuery} hasActivePanolFilter={hasActivePanolFilter}
            panolTotals={panolTotals} user={user} profile={profile}
            getEnabledWorkersAndContractors={getEnabledPersonnel} getEnabledWosForShipAndContractor={getEnabledWos}
            formatWorkOrderTooltip={(wo, ship) => formatWorkOrderTooltip(wo, ship, workItems, workOrders)}
            onClearAllFilters={() => { setSearchQuery(''); setActiveKpiFilter(null); setFilterShip('TODOS'); setFilterCategory('TODAS'); setFilterPeriod('TODOS') }}
            onOpenWithdrawalModal={(tx) => { setEditingWithdrawalRow(tx); setShowWithdrawalModal(true) }}
            onOpenQuickPurchaseModal={setQuickPurchaseModal}
            onOpenRequestOtModal={({ txId, shipId, targetWorkerOrContractor }) => setRequestOtModal({ isOpen: true, txId, shipId, targetWorkerOrContractor, reason: '' })}
            onOpenWorkerPermissionModal={() => setWorkerPermissionModal({ isOpen: true, workerId: '', reason: '' })}
            onPreviewImage={setPreviewImage} showFeedback={showFeedback} setInventoryTx={setInventoryTx}
          />
        )}

        {(activeTab === 'catalogo' || activeTab === 'gases' || activeTab === 'epp') && (
          <PanolStockPanel
            activeTab={activeTab} filteredMaterials={filteredMaterials} materials={materials} gasStats={gasStats}
            searchQuery={searchQuery} activeKpiFilter={activeKpiFilter} filterCategory={filterCategory} filterStockOnly={filterStockOnly}
            isAdmin={isAdmin} user={user} criticalMaterialsCount={kpiStats.criticalCount}
            stockControlledCount={materials.filter((m) => m.requires_stock_control).length}
            onClearFilters={() => { setSearchQuery(''); setActiveKpiFilter(null); setFilterCategory('TODAS'); setFilterStockOnly(false) }}
            onOpenStockAdjustModal={(mat) => setShowStockAdjustModal({ isOpen: true, material: mat })}
            onOpenWithdrawalModal={() => setShowWithdrawalModal(true)}
            onPreviewImage={setPreviewImage} showFeedback={showFeedback} fetchData={loadData} setMaterials={setMaterials}
          />
        )}
      </div>

      {/* CONTENEDOR UNIFICADO DE MODALES */}
      <PanolModalsContainer
        showWithdrawalModal={showWithdrawalModal} setShowWithdrawalModal={setShowWithdrawalModal}
        editingWithdrawalRow={editingWithdrawalRow} setEditingWithdrawalRow={setEditingWithdrawalRow}
        showNewMaterialModal={showNewMaterialModal} setShowNewMaterialModal={setShowNewMaterialModal}
        showStockAdjustModal={showStockAdjustModal} setShowStockAdjustModal={setShowStockAdjustModal}
        showGasModal={showGasModal} setShowGasModal={setShowGasModal}
        quickPurchaseModal={quickPurchaseModal} setQuickPurchaseModal={setQuickPurchaseModal}
        requestOtModal={requestOtModal} setRequestOtModal={setRequestOtModal}
        workerPermissionModal={workerPermissionModal} setWorkerPermissionModal={setWorkerPermissionModal}
        previewImage={previewImage} setPreviewImage={setPreviewImage}
        materials={materials} setMaterials={setMaterials} setInventoryTx={setInventoryTx} setGasMovements={setGasMovements}
        ships={ships} workOrders={workOrders} workItems={workItems} astilleroWorkers={astilleroWorkers}
        contractorGroups={contractorGroups} unauthorizedWorkers={unauthorizedWorkers}
        getEnabledWorkersAndContractors={getEnabledPersonnel}
        pendingAlerts={pendingAlerts} setPendingAlerts={setPendingAlerts}
        suppliers={suppliers} rubros={rubros} workers={workers} isAdmin={isAdmin} user={user} showFeedback={showFeedback}
      />
    </div>
  )
}
