import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSpreadsheetGrid } from '../hooks/useSpreadsheetGrid'
import { useGridContextMenu } from '../hooks/useGridContextMenu'
import { duplicateRecord } from '../lib/gridRowActions'
import WorkOrdersHeader from '../components/workOrders/WorkOrdersHeader'
import WorkOrdersKpiRadar from '../components/workOrders/WorkOrdersKpiRadar'
import WorkOrdersToolbar from '../components/workOrders/WorkOrdersToolbar'
import WorkOrdersUnificadoPanel from '../components/workOrders/WorkOrdersUnificadoPanel'
import WorkOrdersOtsPanel from '../components/workOrders/WorkOrdersOtsPanel'
import WorkOrdersTercerosPanel from '../components/workOrders/WorkOrdersTercerosPanel'
import { WorkOrdersModalsContainer } from '../components/workOrders/WorkOrdersModals'
import { fetchWorkOrdersData, applyWoSinglePatchService, deleteWorkItemService, deleteWoService } from '../lib/workOrdersService.js'
import { WO_GRID_COLUMNS, WORK_ITEM_CLONE_FIELDS, filterUnifiedRows, calculateWorkOrderStats, computeOtMetricsAndDates, buildContractorCatalog, buildUnifiedRows, isRowLockedDec011, hasThirdPartyPermission } from '../lib/workOrdersConstants.js'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'

export default function WorkOrders() {
  const { user } = useAuth()

  // Datos principales
  const [ships, setShips] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [workItems, setWorkItems] = useState([])
  const [workers, setWorkers] = useState([])
  const [templates, setTemplates] = useState([])
  const [thirdPartyServices, setThirdPartyServices] = useState([])
  const [laborLogs, setLaborLogs] = useState([])
  const [inventoryTx, setInventoryTx] = useState([])
  const [purchaseOrders, setPurchaseOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState(null)

  // Navegación y Filtros
  const [activeMainTab, setActiveMainTab] = useState('unificado')
  const [searchQuery, setSearchQuery] = useState('')
  const searchInputRef = useRef(null)
  const [selectedShipFilter, setSelectedShipFilter] = useState('todos')
  const [selectedOtFilter, setSelectedOtFilter] = useState('todas')
  const [selectedStatusFilter, setSelectedStatusFilter] = useState('todos')
  const [selectedForemanFilter, setSelectedForemanFilter] = useState('todos')
  const [selectedContractorFilter, setSelectedContractorFilter] = useState('todos')

  // Triggers de Modales
  const [isWorkModalOpen, setIsWorkModalOpen] = useState(false)
  const [editingWorkItem, setEditingWorkItem] = useState(null)
  const [preselectedWo, setPreselectedWo] = useState(null)
  const [separatingRow, setSeparatingRow] = useState(null)
  const [isThirdPartyCascadeOpen, setIsThirdPartyCascadeOpen] = useState(false)
  const [editingThirdParty, setEditingThirdParty] = useState(null)
  const [selectedWoDetail, setSelectedWoDetail] = useState(null)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [templatePickerFromForm, setTemplatePickerFromForm] = useState(false)
  const [inlineWoEdit, setInlineWoEdit] = useState(null)

  const showWoGridFeedback = useCallback((type, text) => {
    setStatusMessage({ type, text }); setTimeout(() => setStatusMessage(null), 3500)
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const d = await fetchWorkOrdersData()
      setShips(d.ships); setWorkOrders(d.workOrders); setWorkItems(d.workItems)
      setWorkers(d.workers); setTemplates(d.templates); setThirdPartyServices(d.thirdPartyServices)
      setLaborLogs(d.laborLogs); setInventoryTx(d.inventoryTx); setPurchaseOrders(d.purchaseOrders)
    } catch (err) {
      showWoGridFeedback('error', 'Error al cargar datos de OTs: ' + err.message)
    } finally { setLoading(false) }
  }, [showWoGridFeedback])

  useEffect(() => { loadData() }, [loadData])

  // Catálogos derivados y Mapeos
  const foremenList = useMemo(() => {
    const list = workers.filter(w => w.is_foreman && w.status !== 'INACTIVO').map(w => w.name)
    return list.length > 0 ? Array.from(new Set(list)).sort() : ['ALE CAMADELLI', 'HUGO OBREGOZO', 'MARTIN OBREGOZO', 'PABLO N.']
  }, [workers])
  const contractorCatalog = useMemo(() => buildContractorCatalog(workers), [workers])
  const checkContractor3ros = useCallback((name) => hasThirdPartyPermission(workers, name), [workers])

  const itemsByWoMap = useMemo(() => {
    const map = {}; workItems.forEach(i => { if (!map[i.work_order_id]) map[i.work_order_id] = []; map[i.work_order_id].push(i) }); return map
  }, [workItems])
  const thirdPartyByItemMap = useMemo(() => {
    const map = {}; thirdPartyServices.forEach(tp => { if (tp.work_item_id) map[tp.work_item_id] = tp }); return map
  }, [thirdPartyServices])

  const otMetricsAndDatesMap = useMemo(() => computeOtMetricsAndDates(workOrders, laborLogs, inventoryTx, thirdPartyServices), [workOrders, laborLogs, inventoryTx, thirdPartyServices])
  const unifiedRows = useMemo(() => buildUnifiedRows(workOrders, itemsByWoMap, thirdPartyByItemMap, foremenList[0] || 'ALE CAMADELLI', otMetricsAndDatesMap), [workOrders, itemsByWoMap, thirdPartyByItemMap, foremenList, otMetricsAndDatesMap])
  const filteredRows = useMemo(() => filterUnifiedRows(unifiedRows, { selectedShipFilter, selectedOtFilter, selectedStatusFilter, selectedForemanFilter, selectedContractorFilter, searchQuery }), [unifiedRows, selectedShipFilter, selectedOtFilter, selectedStatusFilter, selectedForemanFilter, selectedContractorFilter, searchQuery])
  const stats = useMemo(() => calculateWorkOrderStats(unifiedRows, laborLogs, thirdPartyServices, purchaseOrders, selectedShipFilter), [unifiedRows, laborLogs, thirdPartyServices, purchaseOrders, selectedShipFilter])
  const activeExecutionRows = useMemo(() => unifiedRows.filter(r => !r.isPlaceholder && r.status === 'En ejecución'), [unifiedRows])

  const hasActiveFilters = Boolean(searchQuery || selectedShipFilter !== 'todos' || selectedOtFilter !== 'todas' || selectedStatusFilter !== 'todos' || selectedForemanFilter !== 'todos' || selectedContractorFilter !== 'todos')
  const clearAllFilters = useCallback(() => {
    setSearchQuery(''); setSelectedShipFilter('todos'); setSelectedOtFilter('todas'); setSelectedStatusFilter('todos'); setSelectedForemanFilter('todos'); setSelectedContractorFilter('todos')
  }, [])

  // Disparadores de modales
  const handleOpenNewWorkModal = (preWo = null) => { setEditingWorkItem(null); setPreselectedWo(preWo); setIsWorkModalOpen(true) }
  const handleOpenEditWorkModal = (row) => { setEditingWorkItem(row.isPlaceholder ? null : row); setPreselectedWo(row.wo || null); setIsWorkModalOpen(true) }
  const handleOpenSeparateModal = (row) => { if (row && !row.isPlaceholder) setSeparatingRow(row) }

  // Mutaciones del SpreadsheetGrid
  const applyWoSinglePatch = useCallback(async (rowId, colKey, cleanVal) => {
    const targetRow = unifiedRows.find(r => r.id === rowId)
    if (!targetRow || isRowLockedDec011(targetRow)) return null
    await applyWoSinglePatchService({ rowId, colKey, cleanVal, targetRow, user })
    await loadData()
    return cleanVal
  }, [unifiedRows, user, loadData])

  const commitInlineWoEdit = async (overrideValue, targetRowId, targetColKey) => {
    const rowId = targetRowId || inlineWoEdit?.rowId
    const colKey = targetColKey || inlineWoEdit?.colKey
    const nextVal = overrideValue !== undefined ? overrideValue : inlineWoEdit?.value
    setInlineWoEdit(null)
    if (!rowId || !colKey) return
    try {
      await applyWoSinglePatch(rowId, colKey, nextVal)
      showWoGridFeedback('success', `Celda ${colKey} actualizada.`)
    } catch (err) { showWoGridFeedback('error', `Error al guardar celda: ${err.message}`) }
  }

  const { menuTarget, openMenu, closeMenu } = useGridContextMenu()
  const woGrid = useSpreadsheetGrid({
    rows: filteredRows, columns: WO_GRID_COLUMNS, getRowId: (r) => r.id, storageKey: 'aloncar_grid_workorders',
    canEditCell: (row) => !isRowLockedDec011(row),
    onBatchUpdate: async ({ colKey, newValue, targetIds }) => {
      if (Array.isArray(targetIds)) for (const id of targetIds) await applyWoSinglePatch(id, colKey, newValue)
    }
  })

  const handleDuplicateWorkItem = async (row) => {
    if (!row || row.isPlaceholder) return
    try {
      await duplicateRecord({ table: 'work_items', entityType: 'work_orders', source: row, fields: WORK_ITEM_CLONE_FIELDS, overrides: { updated_at: new Date().toISOString() }, nameOf: (r) => `${row.wo?.ot_number || 'OT'} · ${r.description || ''}`, user: user?.email })
      showWoGridFeedback('success', 'Trabajo duplicado.'); await loadData()
    } catch (err) { showWoGridFeedback('error', 'Error al duplicar: ' + err.message) }
  }

  const handleDeleteWorkItem = async (row) => {
    if (!window.confirm(`¿Desestimar por eliminación este trabajo de la ${row.wo?.ot_number || 'OT'}?`)) return
    try { await deleteWorkItemService(row, user); await loadData(); showWoGridFeedback('info', 'Trabajo desestimado.') }
    catch (err) { showWoGridFeedback('error', err.message) }
  }

  const handleDeleteWo = async (wo) => {
    if (!window.confirm(`¿Desestimar por eliminación la OT "${wo.ot_number} - ${wo.title}"?`)) return
    try { await deleteWoService(wo, itemsByWoMap[wo.id] || [], foremenList, user); await loadData(); showWoGridFeedback('info', 'OT desestimada.') }
    catch (err) { showWoGridFeedback('error', err.message) }
  }

  return (
    <div className="space-y-4 pb-10 font-sans text-slate-100 antialiased selection:bg-cyan-500 selection:text-slate-950">
      {statusMessage && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-xl shadow-2xl flex items-center gap-3 border text-xs font-bold ${statusMessage.type === 'error' ? 'bg-rose-950/95 border-rose-500 text-rose-200' : 'bg-emerald-950/95 border-emerald-500 text-emerald-200'}`}>
          {statusMessage.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="ml-2 text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* ZONA 1: CONTEXTO Y ACCIONES */}
      <WorkOrdersHeader
        activeMainTab={activeMainTab} setActiveMainTab={setActiveMainTab}
        onOpenNewWorkModal={() => handleOpenNewWorkModal(null)}
        onOpenCatalog={() => { setTemplatePickerFromForm(false); setIsTemplateModalOpen(true) }}
        totalUnifiedCount={filteredRows.length} totalOtsCount={workOrders.length} totalTercerosCount={thirdPartyServices.length}
      />

      {/* ZONA 2: RADAR DE KPIS */}
      <WorkOrdersKpiRadar stats={stats} selectedStatusFilter={selectedStatusFilter} setSelectedStatusFilter={setSelectedStatusFilter} />

      {/* BLOQUE OPERATIVO UNIFICADO (ZONAS 3 Y 4) */}
      <div className="alon-workspace-block">
        <WorkOrdersToolbar
          searchQuery={searchQuery} setSearchQuery={setSearchQuery} searchInputRef={searchInputRef}
          selectedShipFilter={selectedShipFilter} setSelectedShipFilter={setSelectedShipFilter}
          selectedOtFilter={selectedOtFilter} setSelectedOtFilter={setSelectedOtFilter}
          selectedStatusFilter={selectedStatusFilter} setSelectedStatusFilter={setSelectedStatusFilter}
          selectedForemanFilter={selectedForemanFilter} setSelectedForemanFilter={setSelectedForemanFilter}
          selectedContractorFilter={selectedContractorFilter} setSelectedContractorFilter={setSelectedContractorFilter}
          ships={ships} workOrders={workOrders} foremenList={foremenList} contractorCatalog={contractorCatalog}
          hasActiveFilters={hasActiveFilters} onClearAllFilters={clearAllFilters} activeMainTab={activeMainTab} woGrid={woGrid}
        />

        {activeMainTab === 'unificado' && (
          <WorkOrdersUnificadoPanel
            filteredRows={filteredRows} unifiedRows={unifiedRows} woGrid={woGrid} ships={ships} foremenList={foremenList}
            searchQuery={searchQuery} stats={stats} hasActiveFilters={hasActiveFilters} onClearAllFilters={clearAllFilters}
            isRowLockedDec011={isRowLockedDec011} hasThirdPartyPermission={checkContractor3ros}
            inlineWoEdit={inlineWoEdit} setInlineWoEdit={setInlineWoEdit} commitInlineWoEdit={commitInlineWoEdit}
            onOpenNewWorkModal={handleOpenNewWorkModal} onOpenEditWorkModal={handleOpenEditWorkModal}
            onOpenSeparateModal={handleOpenSeparateModal} onDuplicateWorkItem={handleDuplicateWorkItem}
            onDeleteWorkItem={handleDeleteWorkItem} setSelectedWoDetail={setSelectedWoDetail}
            setEditingThirdParty={setEditingThirdParty} menuTarget={menuTarget} openMenu={openMenu} closeMenu={closeMenu}
            showWoGridFeedback={showWoGridFeedback}
          />
        )}

        {activeMainTab === 'ots' && (
          <WorkOrdersOtsPanel
            workOrders={workOrders} itemsByWoMap={itemsByWoMap} otMetricsAndDatesMap={otMetricsAndDatesMap}
            thirdPartyByItemMap={thirdPartyByItemMap} selectedShipFilter={selectedShipFilter} searchQuery={searchQuery}
            onOpenNewWorkModal={handleOpenNewWorkModal} onOpenEditWorkModal={handleOpenEditWorkModal}
            onOpenSeparateModal={handleOpenSeparateModal} setSelectedWoDetail={setSelectedWoDetail} onDeleteWo={handleDeleteWo}
          />
        )}

        {activeMainTab === 'terceros' && (
          <WorkOrdersTercerosPanel
            thirdPartyServices={thirdPartyServices} workOrders={workOrders} searchQuery={searchQuery}
            onOpenTpCascadeModal={() => setIsThirdPartyCascadeOpen(true)}
            setEditingThirdParty={setEditingThirdParty}
          />
        )}
      </div>

      {/* CONTENEDOR INTEGRAL DE MODALES */}
      <WorkOrdersModalsContainer
        isWorkModalOpen={isWorkModalOpen} setIsWorkModalOpen={setIsWorkModalOpen}
        editingWorkItem={editingWorkItem} preselectedWo={preselectedWo}
        separatingRow={separatingRow} setSeparatingRow={setSeparatingRow}
        isThirdPartyCascadeOpen={isThirdPartyCascadeOpen} setIsThirdPartyCascadeOpen={setIsThirdPartyCascadeOpen}
        editingThirdParty={editingThirdParty} setEditingThirdParty={setEditingThirdParty}
        selectedWoDetail={selectedWoDetail} setSelectedWoDetail={setSelectedWoDetail}
        isTemplateModalOpen={isTemplateModalOpen} setIsTemplateModalOpen={setIsTemplateModalOpen}
        templatePickerFromForm={templatePickerFromForm} setTemplatePickerFromForm={setTemplatePickerFromForm}
        ships={ships} workOrders={workOrders} templates={templates} workers={workers}
        foremenList={foremenList} contractorCatalog={contractorCatalog} activeExecutionRows={activeExecutionRows}
        itemsByWoMap={itemsByWoMap} otMetricsAndDatesMap={otMetricsAndDatesMap} thirdPartyByItemMap={thirdPartyByItemMap}
        user={user} loadData={loadData} showWoGridFeedback={showWoGridFeedback}
        onOpenNewWorkModal={handleOpenNewWorkModal} onOpenSeparateModal={handleOpenSeparateModal}
      />
    </div>
  )
}
