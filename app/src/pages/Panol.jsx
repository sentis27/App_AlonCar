import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useModuleTab } from '../hooks/useModuleTab'
import { useTabbedFilterMemory } from '../hooks/useTabbedFilterMemory'
import { useSupabaseRealtimeRefresh } from '../hooks/useSupabaseRealtimeRefresh'
import PanolHeader from '../components/panol/PanolHeader'
import PanolAlertasPanel from '../components/panol/PanolAlertasPanel'
import PanolToolbar from '../components/panol/PanolToolbar'
import PanolMovimientosPanel from '../components/panol/PanolMovimientosPanel'
import PanolStockAuditPanel from '../components/panol/PanolStockAuditPanel'
import PanolEntradasPanel from '../components/panol/PanolEntradasPanel'
import PanolStockPanel from '../components/panol/PanolStockPanel'
import { PanolModalsContainer } from '../components/panol/PanolModals'
import PanolCostBasketModal from '../components/panol/PanolCostBasketModal'
import { fetchPanolData } from '../lib/panolService'
import { computeVirtualStockByMaterial } from '../lib/stockControlService'
import { isPanolAdminRole } from '../lib/panolCatalogService'
import { calculateGasStats, calculatePanolKpis, calculatePanolTotalsWithCost, formatWorkOrderTooltip, filterPanolTransactions, filterPanolMaterials } from '../lib/panolConstants'
import { filterEligiblePersonnel, getContractorEnabledWos, getEnabledWorkersAndContractors } from '../lib/allocationEngine'
import { exportPlateCutsReport } from '../lib/plateCutsExport'
import { DEFAULT_HISTORY_RANGE } from '../lib/gridPerformanceHelpers'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

const PANOL_REALTIME_TABLES = ['materials', 'inventory_transactions', 'stock_adjustments', 'stock_audits', 'purchase_orders', 'gas_cylinder_movements', 'compliance_alerts', 'ships', 'work_orders', 'work_items', 'workers', 'suppliers', 'material_rubros', 'macro_variables', 'system_settings']

export default function Panol() {
  const navigate = useNavigate()
  const { user, profile, capabilities } = useAuth()
  const isAdmin = capabilities ? capabilities.isPanolAdmin : isPanolAdminRole(profile)
  const { activeTab, setActiveTab, activeSubmodule, searchParams, setSearchParams } = useModuleTab('panol')

  const [loading, setLoading] = useState(true); const [feedback, setFeedback] = useState(null); const [historyRange, setHistoryRange] = useState(DEFAULT_HISTORY_RANGE)
  const [materials, setMaterials] = useState([]); const [inventoryTx, setInventoryTx] = useState([]); const [gasMovements, setGasMovements] = useState([]); const [stockAdjustments, setStockAdjustments] = useState([]); const [stockAudits, setStockAudits] = useState([]); const [viaPanolOrders, setViaPanolOrders] = useState([])
  const [rubros, setRubros] = useState([]); const [suppliers, setSuppliers] = useState([]); const [ships, setShips] = useState([]); const [workOrders, setWorkOrders] = useState([]); const [workers, setWorkers] = useState([]); const [workItems, setWorkItems] = useState([])
  const [pendingAlerts, setPendingAlerts] = useState([]); const [macroVariables, setMacroVariables] = useState([]); const [pricingPolicy, setPricingPolicy] = useState(null); const [stockFreezeConfig, setStockFreezeConfig] = useState(null)

  const searchInputRef = useRef(null)
  const [activeGridHistory, setActiveGridHistory] = useState(null)
  useEffect(() => { setActiveGridHistory(null) }, [activeTab])
  const { safeTab, filtersByTab, activeFilters, hasActiveFilters: hasActivePanolFilter, setTabFilter, setActiveFilter, clearActiveTabFilters, viewsController: panolViewsController } = useTabbedFilterMemory({
    modulePrefix: 'panol', tabs: ['planillas', 'control_stock', 'entradas', 'catalogo', 'gases', 'epp'], activeTab,
    urlOverridesByTab: { planillas: { ...(searchParams.get('kpi') ? { activeKpiFilter: searchParams.get('kpi') } : {}), ...(searchParams.get('con_barco') === '1' ? { onlyWithShipFilter: true } : {}) } },
    summaryContext: { ships, workOrders, suppliers, materials }
  })

  const planillasFilters = filtersByTab.planillas; const gasesFilters = filtersByTab.gases
  const searchQuery = activeFilters.searchQuery ?? ''; const filterCategory = activeFilters.filterCategory ?? 'TODAS'
  const filterStockOnly = Boolean(activeFilters.filterStockOnly); const activeKpiFilter = activeFilters.activeKpiFilter ?? null

  const [showWithdrawalModal, setShowWithdrawalModal] = useState(false); const [showCostBasketModal, setShowCostBasketModal] = useState(false); const [editingWithdrawalRow, setEditingWithdrawalRow] = useState(null)
  const [materialFormModal, setMaterialFormModal] = useState({ isOpen: false, material: null }); const [showRubrosModal, setShowRubrosModal] = useState(false); const [consumption6MModal, setConsumption6MModal] = useState({ isOpen: false, material: null })
  const [showStockAdjustModal, setShowStockAdjustModal] = useState({ isOpen: false, material: null, initialMode: null }); const [kardexModal, setKardexModal] = useState({ isOpen: false, material: null }); const [showAuditBatchModal, setShowAuditBatchModal] = useState(false)
  const [showGasModal, setShowGasModal] = useState({ isOpen: false, operationType: 'PRIMERA_ENTREGA' }); const [gasFinalReturnModal, setGasFinalReturnModal] = useState({ isOpen: false, contractorName: '' }); const [gasSupplierModal, setGasSupplierModal] = useState({ isOpen: false, supplierId: '' })
  const [quickPurchaseModal, setQuickPurchaseModal] = useState({ isOpen: false, material: null, quantity: '', urgency: 'SIN_APURO' }); const [requestOtModal, setRequestOtModal] = useState({ isOpen: false, txId: null, shipId: '', targetWorkerOrContractor: '', reason: '' }); const [workerPermissionModal, setWorkerPermissionModal] = useState({ isOpen: false, workerId: '', reason: '' }); const [previewImage, setPreviewImage] = useState(null)

  useEffect(() => {
    const kpiParam = searchParams.get('kpi')
    if (kpiParam) setTabFilter('planillas', 'activeKpiFilter', kpiParam)
    if (searchParams.get('con_barco') === '1') setTabFilter('planillas', 'onlyWithShipFilter', true)
  }, [searchParams, setTabFilter])

  const showFeedback = (type, text) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 4500)
  }

  const loadData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const d = await fetchPanolData({ historyRange })
      setMaterials(d.materials); setInventoryTx(d.inventoryTx); setGasMovements(d.gasMovements)
      setRubros(d.rubros); setSuppliers(d.suppliers); setShips(d.ships); setWorkOrders(d.workOrders)
      setWorkers(d.workers); setWorkItems(d.workItems); setPendingAlerts(d.pendingAlerts)
      setMacroVariables(d.macroVariables || []); setPricingPolicy(d.pricingPolicy || null); setStockAdjustments(d.stockAdjustments || []); setStockFreezeConfig(d.stockFreezeConfig || null)
      setStockAudits(d.stockAudits || []); setViaPanolOrders(d.viaPanolOrders || [])
    } catch (err) {
      showFeedback('error', 'Error cargando datos de Pañol: ' + err.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [historyRange])

  const isPanolModalOpen = Boolean(showWithdrawalModal || materialFormModal.isOpen || showRubrosModal || consumption6MModal.isOpen || showStockAdjustModal.isOpen || showAuditBatchModal || kardexModal.isOpen || showGasModal.isOpen || gasFinalReturnModal.isOpen || gasSupplierModal.isOpen || quickPurchaseModal.isOpen || requestOtModal.isOpen || workerPermissionModal.isOpen)
  useSupabaseRealtimeRefresh({
    channelName: 'panol_live',
    tables: PANOL_REALTIME_TABLES,
    onSync: () => loadData({ silent: true }),
    pauseWhen: isPanolModalOpen
  })

  useEffect(() => { loadData({ silent: false }) }, [loadData])

  const gasStats = useMemo(() => calculateGasStats(suppliers, gasMovements, materials), [suppliers, gasMovements, materials])
  const virtualStockMap = useMemo(() => computeVirtualStockByMaterial(viaPanolOrders), [viaPanolOrders])
  const eligiblePersonnel = useMemo(() => filterEligiblePersonnel(workers, { permissionField: 'can_withdraw_materials' }), [workers])
  const { astilleroWorkers, contractorGroups, unauthorizedWorkers, allEligibleNames: availableGroups } = eligiblePersonnel

  const getEnabledPersonnel = useCallback((shipId, workOrderId, options = {}) => getEnabledWorkersAndContractors(shipId, workOrderId, workItems, eligiblePersonnel, { workOrders, ...options }), [workItems, workOrders, eligiblePersonnel])
  const getEnabledWos = useCallback((shipId, workerOrContractor) => getContractorEnabledWos(shipId, workerOrContractor, workOrders, workItems, eligiblePersonnel), [workOrders, workItems, eligiblePersonnel])

  const kpiStats = useMemo(() => calculatePanolKpis(materials, inventoryTx, gasStats), [materials, inventoryTx, gasStats])

  const filteredTransactions = useMemo(
    () => filterPanolTransactions(inventoryTx, {
      activeKpiFilter: planillasFilters.activeKpiFilter, onlyWithShip: Boolean(planillasFilters.onlyWithShipFilter),
      onlyZeroCost: isAdmin && Boolean(planillasFilters.onlyZeroCost), filterPeriod: planillasFilters.filterPeriod,
      filterShip: planillasFilters.filterShip, filterOt: planillasFilters.filterOt, filterContractor: planillasFilters.filterContractor,
      filterCategory: planillasFilters.filterCategory, filterMaterialQuick: planillasFilters.filterMaterialQuick || '',
      searchQuery: planillasFilters.searchQuery, materials, ships, workOrders, macroVariables, pricingPolicy
    }),
    [inventoryTx, planillasFilters, materials, ships, workOrders, macroVariables, pricingPolicy, isAdmin]
  )

  const handleExportPanolPlateCuts = useCallback(() => {
    const matMap = new Map(materials.map((m) => [m.id, m]))
    const shipMap = new Map(ships.map((s) => [s.id, s]))
    const woMap = new Map(workOrders.map((w) => [w.id, w]))
    const activeShipName = planillasFilters.filterShip && planillasFilters.filterShip !== 'TODOS' ? (shipMap.get(planillasFilters.filterShip)?.name || 'buque') : 'flota'
    const enriched = filteredTransactions.map((tx) => {
      const mat = matMap.get(tx.material_id); const wo = woMap.get(tx.work_order_id)
      return {
        ...tx, shipName: shipMap.get(tx.ship_id)?.name || 'SIN BUQUE',
        otLabel: wo ? `${wo.ot_number || ''} · ${wo.title || ''}`.trim() : 'Sin OT',
        materialName: mat?.name || 'Chapa / Material', unitMeasure: mat?.unit_measure || 'm²',
        workerName: tx.worker_name || tx.contractor_name || ''
      }
    })
    exportPlateCutsReport({ rows: enriched, shipName: activeShipName })
  }, [filteredTransactions, materials, ships, workOrders, planillasFilters.filterShip])

  const panolTotals = useMemo(() => calculatePanolTotalsWithCost(filteredTransactions, materials, { macroVariables, policy: pricingPolicy }), [filteredTransactions, materials, macroVariables, pricingPolicy])
  const totalUnvaluedCount = useMemo(() => calculatePanolTotalsWithCost(inventoryTx, materials, { macroVariables, policy: pricingPolicy }).unvaluedCount, [inventoryTx, materials, macroVariables, pricingPolicy])
  const clearAllPanolFilters = useCallback(() => {
    clearActiveTabFilters()
    if (searchParams.get('kpi') || searchParams.get('con_barco')) setSearchParams({ tab: safeTab }, { replace: true })
  }, [clearActiveTabFilters, safeTab, searchParams, setSearchParams])

  const filteredMaterials = useMemo(() => filterPanolMaterials(materials, {
    activeKpiFilter: activeFilters.activeKpiFilter, filterStockOnly: !isAdmin ? true : Boolean(activeFilters.filterStockOnly),
    filterCategory: activeFilters.filterCategory || 'TODAS', searchQuery: activeFilters.searchQuery || ''
  }), [materials, activeFilters, isAdmin])

  const openKardex = (mat) => setKardexModal({ isOpen: true, material: mat })
  const openStockAdjust = (mat = null, initialMode = null) => setShowStockAdjustModal({ isOpen: true, material: mat, initialMode: initialMode || (mat ? 'RECOUNT' : 'ENTRY') })

  return (
    <div className="space-y-4 pb-10 font-sans text-slate-100 antialiased selection:bg-cyan-500 selection:text-slate-950">
      {feedback && (
        <div className={`fixed top-5 right-5 z-[100] px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-xs font-bold ${
          feedback.type === 'error' ? 'bg-rose-950/95 border-rose-500 text-rose-200' : 'bg-emerald-950/95 border-emerald-500 text-emerald-200'
        }`}>
          {feedback.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          <span>{feedback.text}</span>
          <button onClick={() => setFeedback(null)} className="ml-2 text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* ZONA 1: CONTEXTO OPERATIVO */}
      <PanolHeader
        activeTab={activeTab} activeSubmodule={activeSubmodule} isAdmin={isAdmin} filteredTransactionsCount={filteredTransactions.length} auditsCount={stockAudits.length} entradasCount={stockAdjustments.length} criticalCount={kpiStats.criticalCount}
        onOpenWithdrawalModal={() => { setEditingWithdrawalRow(null); setShowWithdrawalModal(true) }}
        onOpenCostBasketModal={() => setShowCostBasketModal(true)}
        onOpenAuditBatchModal={() => setShowAuditBatchModal(true)}
        onOpenStockAdjustModal={(mat) => openStockAdjust(mat, 'ENTRY')}
        onOpenNewMaterialModal={() => setMaterialFormModal({ isOpen: true, material: null })}
        onOpenRubrosModal={() => setShowRubrosModal(true)}
        onOpenGasModal={() => setShowGasModal({ isOpen: true, operationType: 'PRIMERA_ENTREGA' })}
        onOpenGasSupplierModal={(supplierId = '') => setGasSupplierModal({ isOpen: true, supplierId })}
        navigate={navigate}
      />

      {/* ZONA 2: RADAR DE KPIS */}
      <PanolAlertasPanel
        kpiStats={kpiStats}
        activeKpiFilter={activeKpiFilter}
        onClearKpiFilter={() => {
          setTabFilter(safeTab, 'activeKpiFilter', null)
          if (safeTab === 'planillas') setTabFilter('planillas', 'onlyWithShipFilter', false)
          if (searchParams.get('kpi') || searchParams.get('con_barco')) setSearchParams({ tab: safeTab }, { replace: true })
        }}
        onToggleKpiFilter={(k, targetTab) => {
          const dest = targetTab || safeTab
          const currVal = filtersByTab[dest]?.activeKpiFilter
          setTabFilter(dest, 'activeKpiFilter', currVal === k ? null : k)
          if (dest === 'planillas') setTabFilter('planillas', 'onlyWithShipFilter', false)
          if (targetTab && activeTab !== targetTab) setActiveTab(targetTab)
        }}
      />

      {/* BLOQUE OPERATIVO UNIFICADO (ZONA 3 + ZONA 4) */}
      <div className="alon-workspace-block">
        <PanolToolbar
          searchQuery={searchQuery} setSearchQuery={(v) => setActiveFilter('searchQuery', v)} searchInputRef={searchInputRef}
          filterPeriod={activeFilters.filterPeriod ?? 'TODOS'} setFilterPeriod={(v) => setActiveFilter('filterPeriod', v)}
          filterCategory={filterCategory} setFilterCategory={(v) => setActiveFilter('filterCategory', v)}
          filterReason={activeFilters.filterReason ?? 'TODOS'} setFilterReason={(v) => setActiveFilter('filterReason', v)}
          filterDirection={activeFilters.filterDirection ?? 'TODOS'} setFilterDirection={(v) => setActiveFilter('filterDirection', v)}
          filterRubro={activeFilters.filterRubro ?? 'TODOS'} setFilterRubro={(v) => setActiveFilter('filterRubro', v)}
          filterAuditStatus={activeFilters.filterAuditStatus ?? 'TODOS'} setFilterAuditStatus={(v) => setActiveFilter('filterAuditStatus', v)}
          rubros={rubros} materials={materials}
          filterMaterialQuick={activeFilters.filterMaterialQuick ?? ''} setFilterMaterialQuick={(v) => setActiveFilter('filterMaterialQuick', v)}
          onlyZeroCost={Boolean(activeFilters.onlyZeroCost)} setOnlyZeroCost={(v) => setActiveFilter('onlyZeroCost', v)}
          unvaluedCount={totalUnvaluedCount} activeKpiFilter={activeKpiFilter}
          onClearZeroCostKpi={() => { setTabFilter('planillas', 'activeKpiFilter', null); setTabFilter('planillas', 'onlyWithShipFilter', false); if (searchParams.get('kpi') || searchParams.get('con_barco')) setSearchParams({ tab: safeTab }, { replace: true }) }}
          onExportPlateCuts={handleExportPanolPlateCuts}
          filterShip={activeFilters.filterShip ?? 'TODOS'} setFilterShip={(v) => setActiveFilter('filterShip', v)}
          filterOt={activeFilters.filterOt ?? 'TODAS'} setFilterOt={(v) => setActiveFilter('filterOt', v)}
          filterContractor={activeFilters.filterContractor ?? 'TODOS'} setFilterContractor={(v) => setActiveFilter('filterContractor', v)}
          filterStockOnly={!isAdmin ? true : filterStockOnly} setFilterStockOnly={(v) => setActiveFilter('filterStockOnly', v)}
          isAdmin={isAdmin} activeTab={activeTab} ships={ships} workOrders={workOrders} workItems={workItems}
          contractorOptions={availableGroups} hasActiveFilters={hasActivePanolFilter} onClearAllFilters={clearAllPanolFilters} viewsController={panolViewsController}
          gridHistory={activeTab !== 'epp' && activeTab !== 'entradas' && activeTab !== 'control_stock' ? activeGridHistory : null}
          historyRange={historyRange} setHistoryRange={setHistoryRange} loading={loading}
        />

        {activeTab === 'planillas' && (
          <PanolMovimientosPanel
            filteredTransactions={filteredTransactions} totalTransactionsCount={inventoryTx.length} loading={loading}
            filterResetKey={`${searchQuery}|${planillasFilters.filterPeriod || ''}|${planillasFilters.filterShip || ''}|${planillasFilters.filterOt || ''}|${planillasFilters.filterContractor || ''}|${planillasFilters.filterCategory || ''}|${planillasFilters.filterMaterialQuick || ''}|${planillasFilters.onlyZeroCost || ''}|${planillasFilters.activeKpiFilter || ''}|${historyRange}`}
            materials={materials} setMaterials={setMaterials} ships={ships} workOrders={workOrders} workItems={workItems}
            astilleroWorkers={astilleroWorkers} contractorGroups={contractorGroups} workers={workers}
            pendingAlerts={pendingAlerts} isAdmin={isAdmin} searchQuery={searchQuery} hasActivePanolFilter={hasActivePanolFilter}
            panolTotals={panolTotals} user={user} profile={profile} macroVariables={macroVariables} pricingPolicy={pricingPolicy}
            getEnabledWorkersAndContractors={getEnabledPersonnel} getEnabledWosForShipAndContractor={getEnabledWos}
            formatWorkOrderTooltip={(wo, ship) => formatWorkOrderTooltip(wo, ship, workItems, workOrders)}
            onClearAllFilters={clearAllPanolFilters}
            onOpenWithdrawalModal={(tx) => { setEditingWithdrawalRow(tx); setShowWithdrawalModal(true) }}
            onOpenEditMaterialModal={isAdmin ? (mat) => setMaterialFormModal({ isOpen: true, material: mat }) : null}
            onOpenQuickPurchaseModal={(payload) => setQuickPurchaseModal({ isOpen: true, urgency: 'SIN_APURO', ...payload })}
            onOpenRequestOtModal={({ txId, shipId, targetWorkerOrContractor }) => setRequestOtModal({ isOpen: true, txId, shipId, targetWorkerOrContractor, reason: '' })}
            onOpenWorkerPermissionModal={() => setWorkerPermissionModal({ isOpen: true, workerId: '', reason: '' })}
            onPreviewImage={setPreviewImage} showFeedback={showFeedback} setInventoryTx={setInventoryTx}
            gasMovements={gasMovements} setGasMovements={setGasMovements} onHistoryChange={setActiveGridHistory}
            stockFreezeConfig={stockFreezeConfig} onOpenKardexModal={openKardex}
          />
        )}

        {activeTab === 'control_stock' && (
          <PanolStockAuditPanel
            stockAudits={stockAudits} materials={materials} searchQuery={searchQuery}
            filterRubro={activeFilters.filterRubro ?? 'TODOS'} filterAuditStatus={activeFilters.filterAuditStatus ?? 'TODOS'}
            hasActiveFilters={hasActivePanolFilter} onClearFilters={clearAllPanolFilters}
            onOpenAuditBatchModal={() => setShowAuditBatchModal(true)} onOpenKardexModal={openKardex} loading={loading}
          />
        )}

        {activeTab === 'entradas' && (
          <PanolEntradasPanel
            stockAdjustments={stockAdjustments} setStockAdjustments={setStockAdjustments} materials={materials} setMaterials={setMaterials}
            searchQuery={searchQuery} filterReason={activeFilters.filterReason ?? 'TODOS'} filterDirection={activeFilters.filterDirection ?? 'TODOS'}
            hasActiveFilters={hasActivePanolFilter} onClearFilters={clearAllPanolFilters}
            onOpenStockAdjustModal={(mat) => openStockAdjust(mat, mat ? 'RECOUNT' : 'ENTRY')} onOpenKardexModal={openKardex}
            isAdmin={isAdmin} user={user} showFeedback={showFeedback} loading={loading}
          />
        )}

        {(activeTab === 'catalogo' || activeTab === 'gases' || activeTab === 'epp') && (
          <PanolStockPanel
            activeTab={activeTab} filteredMaterials={filteredMaterials} materials={materials} rubros={rubros} gasStats={gasStats}
            gasMovements={gasMovements} setGasMovements={setGasMovements} suppliers={suppliers} ships={ships} workOrders={workOrders}
            searchQuery={searchQuery} activeKpiFilter={activeKpiFilter} filterCategory={filterCategory} filterStockOnly={!isAdmin ? true : filterStockOnly}
            traceSupplierFilter={gasesFilters.traceSupplierFilter} setTraceSupplierFilter={(v) => setTabFilter('gases', 'traceSupplierFilter', v)}
            traceMaterialFilter={gasesFilters.traceMaterialFilter} setTraceMaterialFilter={(v) => setTabFilter('gases', 'traceMaterialFilter', v)}
            isAdmin={isAdmin} user={user} macroVariables={macroVariables} pricingPolicy={pricingPolicy} criticalMaterialsCount={kpiStats.criticalCount}
            stockControlledCount={materials.filter((m) => m.requires_stock_control).length} onClearFilters={clearAllPanolFilters}
            onOpenEditMaterialModal={(mat) => setMaterialFormModal({ isOpen: true, material: mat })}
            onOpenStockAdjustModal={(mat) => openStockAdjust(mat, 'RECOUNT')}
            onOpenConsumption6MModal={(mat) => setConsumption6MModal({ isOpen: true, material: mat })} onOpenKardexModal={openKardex} virtualStockMap={virtualStockMap}
            onOpenRubrosModal={() => setShowRubrosModal(true)}
            onOpenWithdrawalModal={() => { setEditingWithdrawalRow(null); setShowWithdrawalModal(true) }}
            onOpenGasFinalReturnModal={(cName) => setGasFinalReturnModal({ isOpen: true, contractorName: cName })}
            onOpenGasSupplierModal={(supplierId = '') => setGasSupplierModal({ isOpen: true, supplierId })}
            onPreviewImage={setPreviewImage} showFeedback={showFeedback} fetchData={loadData} setMaterials={setMaterials} onHistoryChange={setActiveGridHistory}
          />
        )}
      </div>

      {/* CONTENEDOR UNIFICADO DE MODALES */}
      <PanolModalsContainer
        showWithdrawalModal={showWithdrawalModal} setShowWithdrawalModal={setShowWithdrawalModal} editingWithdrawalRow={editingWithdrawalRow} setEditingWithdrawalRow={setEditingWithdrawalRow}
        materialFormModal={materialFormModal} setMaterialFormModal={setMaterialFormModal} showRubrosModal={showRubrosModal} setShowRubrosModal={setShowRubrosModal}
        consumption6MModal={consumption6MModal} setConsumption6MModal={setConsumption6MModal} showStockAdjustModal={showStockAdjustModal} setShowStockAdjustModal={setShowStockAdjustModal}
        showAuditBatchModal={showAuditBatchModal} setShowAuditBatchModal={setShowAuditBatchModal} setStockAudits={setStockAudits}
        kardexModal={kardexModal} setKardexModal={setKardexModal} setStockAdjustments={setStockAdjustments} virtualStockMap={virtualStockMap}
        showGasModal={showGasModal} setShowGasModal={setShowGasModal} gasFinalReturnModal={gasFinalReturnModal} setGasFinalReturnModal={setGasFinalReturnModal}
        gasSupplierModal={gasSupplierModal} setGasSupplierModal={setGasSupplierModal} quickPurchaseModal={quickPurchaseModal} setQuickPurchaseModal={setQuickPurchaseModal}
        requestOtModal={requestOtModal} setRequestOtModal={setRequestOtModal} workerPermissionModal={workerPermissionModal} setWorkerPermissionModal={setWorkerPermissionModal}
        previewImage={previewImage} setPreviewImage={setPreviewImage} materials={materials} setMaterials={setMaterials} inventoryTx={inventoryTx} setInventoryTx={setInventoryTx}
        gasMovements={gasMovements} setGasMovements={setGasMovements} gasStats={gasStats} ships={ships} workOrders={workOrders} workItems={workItems}
        astilleroWorkers={astilleroWorkers} contractorGroups={contractorGroups} unauthorizedWorkers={unauthorizedWorkers} getEnabledWorkersAndContractors={getEnabledPersonnel}
        pendingAlerts={pendingAlerts} setPendingAlerts={setPendingAlerts} suppliers={suppliers} rubros={rubros} workers={workers}
        macroVariables={macroVariables} pricingPolicy={pricingPolicy} isAdmin={isAdmin} user={user} showFeedback={showFeedback} onRefreshData={loadData} navigate={navigate}
      />
      {showCostBasketModal && <PanolCostBasketModal isOpen onClose={() => setShowCostBasketModal(false)} workers={workers} ships={ships} workOrders={workOrders} workItems={workItems} inventoryTx={inventoryTx} materials={materials} suppliers={suppliers} gasStats={gasStats} gasMovements={gasMovements} astilleroWorkers={astilleroWorkers} macroVariables={macroVariables} pricingPolicy={pricingPolicy} user={user} onRefreshData={loadData} showFeedback={showFeedback} />}
    </div>
  )
}
