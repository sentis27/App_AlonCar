import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useAuth } from '../context/AuthContext'
import { useSpreadsheetGrid } from '../hooks/useSpreadsheetGrid'
import { useGridContextMenu } from '../hooks/useGridContextMenu'
import { duplicateRecord, buildPasteRowHandler } from '../lib/gridRowActions'
import TercerosHeader from '../components/terceros/TercerosHeader'
import TercerosKpiRadar from '../components/terceros/TercerosKpiRadar'
import TercerosToolbar from '../components/terceros/TercerosToolbar'
import TercerosFilasPanel from '../components/terceros/TercerosFilasPanel'
import TercerosFichasPanel from '../components/terceros/TercerosFichasPanel'
import { TercerosModalsContainer } from '../components/terceros/TercerosModals'
import { fetchTercerosData, insertBlankRowService, deleteServiceService, saveInlineEditService, saveSpreadsheetBatchService } from '../lib/tercerosService.js'
import { calculateTercerosKpis, calculateTercerosStats, filterTercerosServices, getSpreadsheetColumnsTerceros, buildTercerosMaps, TERCEROS_CLONE_FIELDS, TERCEROS_PASTE_BASE_FIELDS } from '../lib/tercerosConstants.js'
import { AlertTriangle, CheckCircle2, Clock, Wrench } from 'lucide-react'

export default function Terceros() {
  const { user } = useAuth()
  const [activeRolePerspective, setActiveRolePerspective] = useState(() => localStorage.getItem('aloncar_terceros_terminal') || 'maria_jose')
  useEffect(() => { localStorage.setItem('aloncar_terceros_terminal', activeRolePerspective) }, [activeRolePerspective])

  const canEditAmounts = useMemo(() => activeRolePerspective === 'admin' || activeRolePerspective === 'maria_jose', [activeRolePerspective])
  const canMutateRows = activeRolePerspective !== 'direccion'
  const actor = activeRolePerspective === 'admin' ? 'JORGE SENTIS' : (activeRolePerspective === 'jefe_obra' ? 'JEFE DE OBRA' : 'MARIA JOSE')

  // Datos principales
  const [services, setServices] = useState([])
  const [ships, setShips] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [workItems, setWorkItems] = useState([])
  const [contractors, setContractors] = useState([])
  const [macroVariables, setMacroVariables] = useState([])
  const [voucherHistory, setVoucherHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedbackMessage, setFeedbackMessage] = useState(null)

  // Filtros y vistas
  const [viewMode, setViewMode] = useState('filas')
  const [kpiFilter, setKpiFilter] = useState('todos')
  const [searchTerm, setSearchTerm] = useState('')
  const searchInputRef = useRef(null)
  const [selectedShipFilter, setSelectedShipFilter] = useState('todos')
  const [selectedContractorFilter, setSelectedContractorFilter] = useState('todos')
  const [selectedTradeFilter, setSelectedTradeFilter] = useState('todos')
  const [selectedVoucherFilter, setSelectedVoucherFilter] = useState('todos')
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null)
  const [inlineEdit, setInlineEdit] = useState({ id: null, field: null, value: '' })

  // Triggers de modales
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [evolvingService, setEvolvingService] = useState(null)
  const [auditingService, setAuditingService] = useState(null)
  const [historyService, setHistoryService] = useState(null)
  const [pickerModal, setPickerModal] = useState({ isOpen: false, serviceId: null, shipId: '', workOrderId: '', contractorName: '' })
  const [contractorPickerModal, setContractorPickerModal] = useState({ isOpen: false, serviceId: null, currentValue: '', shipId: '', shipName: '', workOrderId: '', workOrderTitle: '', isOtBlank: true })

  const showFeedback = useCallback((type, text) => {
    setFeedbackMessage({ type, text }); setTimeout(() => setFeedbackMessage(null), 4500)
  }, [])

  const loadData = useCallback(async () => {
    try {
      setLoading(true)
      const d = await fetchTercerosData()
      setServices(d.services); setShips(d.ships); setWorkOrders(d.workOrders)
      setWorkItems(d.workItems); setContractors(d.contractors)
      setMacroVariables(d.macroVariables); setVoucherHistory(d.voucherHistory)
    } catch (err) { showFeedback('error', 'Error al sincronizar datos: ' + err.message) }
    finally { setLoading(false) }
  }, [showFeedback])

  useEffect(() => { loadData() }, [loadData])

  // Mapas y derivados
  const { shipMap, otMap, contractorMap } = useMemo(() => buildTercerosMaps(ships, workOrders, contractors), [ships, workOrders, contractors])
  const kpiCounts = useMemo(() => calculateTercerosKpis(services), [services])
  const filteredServices = useMemo(() => filterTercerosServices(services, {
    kpiFilter, selectedShipFilter, selectedContractorFilter, selectedTradeFilter, selectedVoucherFilter, searchTerm
  }, { shipMap, otMap, contractorMap }), [services, kpiFilter, selectedShipFilter, selectedContractorFilter, selectedTradeFilter, selectedVoucherFilter, searchTerm, shipMap, otMap, contractorMap])

  const stats = useMemo(() => calculateTercerosStats(selectedIds.size > 0 ? filteredServices.filter((s) => selectedIds.has(s.id)) : filteredServices, filteredServices.length, selectedIds.size > 0), [selectedIds, filteredServices])
  const hasActiveFilters = Boolean(searchTerm || selectedShipFilter !== 'todos' || selectedContractorFilter !== 'todos' || selectedTradeFilter !== 'todos' || selectedVoucherFilter !== 'todos' || (kpiFilter && kpiFilter !== 'todos'))
  const clearAllFilters = useCallback(() => {
    setSearchTerm(''); setSelectedShipFilter('todos'); setSelectedContractorFilter('todos'); setSelectedTradeFilter('todos'); setSelectedVoucherFilter('todos'); setKpiFilter('todos')
  }, [])

  // Modales y acciones
  const handleOpenNewModal = () => { setEditingService(null); setIsModalOpen(true) }
  const handleOpenEditModal = (service) => { setEditingService(service); setIsModalOpen(true) }
  const handleOpenEvolutionModal = (service) => setEvolvingService(service)

  const handleDuplicateService = async (srv) => {
    if (!canMutateRows) return showFeedback('error', 'Tu perfil (Dirección) es de solo lectura.')
    try {
      const today = new Date().toISOString().split('T')[0]
      await duplicateRecord({ table: 'third_party_services', entityType: 'third_party_services', source: srv, fields: TERCEROS_CLONE_FIELDS, overrides: { entry_date: today, voucher_date: today, service_date: today, audit_status: 'PENDIENTE', created_by: actor, updated_at: new Date().toISOString() }, nameOf: (r) => r.contractor_name || r.id, user: actor })
      showFeedback('success', `Comprobante de ${srv.contractor_name} duplicado.`); await loadData()
    } catch (err) { showFeedback('error', 'Error al duplicar comprobante: ' + err.message) }
  }

  const handleDeleteService = async (service) => {
    if (!window.confirm(`¿Confirmas la baja del comprobante ${service.voucher_type} - ${service.contractor_name} por $${Number(service.amount_ars).toLocaleString('es-AR')}?`)) return
    try { await deleteServiceService({ service, actor }); showFeedback('success', 'Registro de Terceros eliminado.'); await loadData() }
    catch (err) { showFeedback('error', 'No se pudo eliminar el comprobante: ' + err.message) }
  }

  const handleInsertBlankRow = async () => {
    try {
      const row = await insertBlankRowService({ services, macroVariables, actor })
      setServices((prev) => [row, ...prev]); showFeedback('success', `Fila en blanco insertada con Folio #${row._rowSeq}.`)
    } catch (err) { showFeedback('error', 'Error al insertar fila en blanco: ' + err.message) }
  }

  const saveInlineEdit = async (serviceId, field, newValue) => {
    setInlineEdit({ id: null, field: null, value: '' })
    const target = services.find((s) => s.id === serviceId)
    if (!target || target[field] === newValue) return
    try {
      const res = await saveInlineEditService({ serviceId, field, newValue, services, macroVariables, contractors, actor })
      if (res) { setServices((prev) => prev.map((s) => (s.id === serviceId ? { ...s, [field]: res.cleanedValue, ...res.extraFields } : s))); showFeedback('success', 'Campo actualizado.') }
    } catch (err) { showFeedback('error', 'Error al guardar: ' + err.message) }
  }

  // Hook SpreadsheetGrid
  const spreadsheetColumns = useMemo(() => getSpreadsheetColumnsTerceros(canEditAmounts, shipMap, otMap), [canEditAmounts, shipMap, otMap])
  const tercerosPasteRef = useRef(null)
  const { menuTarget, openMenu, closeMenu } = useGridContextMenu()

  const grid = useSpreadsheetGrid({
    rows: filteredServices, columns: spreadsheetColumns, getRowId: (row) => row.id, storageKey: 'aloncar_grid_terceros',
    onBatchUpdate: async (args) => {
      try { await saveSpreadsheetBatchService({ ...args, services, contractors, macroVariables }); await loadData(); showFeedback('success', 'Filas actualizadas.') }
      catch (err) { showFeedback('error', 'Error en lote: ' + err.message) }
    },
    onPasteRow: (args) => tercerosPasteRef.current?.(args),
    onCellActivate: (srv, colDef) => {
      if (colDef.key === 'ship_wo') setPickerModal({ isOpen: true, serviceId: srv.id, shipId: srv.ship_id || '', workOrderId: srv.work_order_id || '', contractorName: srv.contractor_name || '' })
      else if (colDef.key === 'amount_ars' && !canEditAmounts) showFeedback('error', 'No tienes permisos para modificar importes.')
      else setInlineEdit({ id: srv.id, field: colDef.key, value: srv[colDef.key] || '' })
    },
    onFocusSearch: () => { searchInputRef.current?.focus(); searchInputRef.current?.select() },
    canEditCell: (row, colKey) => colKey !== 'amount_ars' || canEditAmounts,
    showFeedback
  })

  useEffect(() => {
    tercerosPasteRef.current = canMutateRows ? buildPasteRowHandler({
      table: 'third_party_services', entityType: 'third_party_services', fields: [...TERCEROS_PASTE_BASE_FIELDS, ...(canEditAmounts ? ['amount_ars', 'usd_rate', 'amount_usd'] : [])],
      grid, setList: setServices, nameOf: (r) => r.contractor_name || r.id, showFeedback, user: actor
    }) : () => showFeedback('error', 'Tu perfil (Dirección) es de solo lectura: no puede pegar filas.')
  })

  // Selección de filas
  const toggleRowSelection = (id, index, shift) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (shift && lastSelectedIndex !== null) {
        const [start, end] = [Math.min(lastSelectedIndex, index), Math.max(lastSelectedIndex, index)]
        for (let i = start; i <= end; i++) { const it = filteredServices[i]; if (it) next.add(it.id) }
      } else { if (next.has(id)) next.delete(id); else next.add(id); setLastSelectedIndex(index) }
      return next
    })
  }

  return (
    <div className="space-y-4 w-full pb-10">
      {feedbackMessage && (
        <div className={`p-4 rounded-xl border flex items-center justify-between shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-4 transition-all ${feedbackMessage.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200' : 'bg-rose-950/90 border-rose-500/60 text-rose-200'}`}>
          <div className="flex items-center gap-3">
            {feedbackMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />}
            <span className="text-sm font-medium">{feedbackMessage.text}</span>
          </div>
          <button type="button" onClick={() => setFeedbackMessage(null)} className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* ZONA 1: CONTEXTO Y TERMINAL */}
      <TercerosHeader activeRolePerspective={activeRolePerspective} setActiveRolePerspective={setActiveRolePerspective} canEditAmounts={canEditAmounts} onOpenNewModal={handleOpenNewModal} />

      {/* ZONA 2: RADAR DE KPIS */}
      <TercerosKpiRadar kpiFilter={kpiFilter} setKpiFilter={setKpiFilter} kpiCounts={kpiCounts} />

      {/* BLOQUE OPERATIVO UNIFICADO (ZONAS 3 Y 4) */}
      <div className="alon-workspace-block">
        <TercerosToolbar
          searchTerm={searchTerm} setSearchTerm={setSearchTerm} searchInputRef={searchInputRef}
          selectedShipFilter={selectedShipFilter} setSelectedShipFilter={setSelectedShipFilter}
          selectedContractorFilter={selectedContractorFilter} setSelectedContractorFilter={setSelectedContractorFilter}
          selectedTradeFilter={selectedTradeFilter} setSelectedTradeFilter={setSelectedTradeFilter}
          selectedVoucherFilter={selectedVoucherFilter} setSelectedVoucherFilter={setSelectedVoucherFilter}
          ships={ships} contractors={contractors} hasActiveFilters={hasActiveFilters} clearAllFilters={clearAllFilters}
          grid={grid} viewMode={viewMode} setViewMode={setViewMode}
        />

        {loading ? (
          <div className="p-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
            <Clock className="w-8 h-8 animate-spin mx-auto text-cyan-400 mb-3" />
            <p className="text-sm font-medium">Sincronizando registros de Terceros con Supabase...</p>
          </div>
        ) : filteredServices.length === 0 ? (
          <div className="p-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
            <Wrench className="w-10 h-10 mx-auto text-slate-600 mb-2" />
            <p className="text-base font-semibold text-slate-300">No se encontraron comprobantes con los filtros seleccionados.</p>
            {activeRolePerspective !== 'direccion' && (
              <button type="button" onClick={handleOpenNewModal} className="px-4 py-2 bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold hover:bg-cyan-500 hover:text-slate-950 transition-all cursor-pointer">+ Cargar Primer Gasto</button>
            )}
          </div>
        ) : viewMode === 'filas' ? (
          <TercerosFilasPanel
            filteredServices={filteredServices} services={services} contractors={contractors} shipMap={shipMap} otMap={otMap} contractorMap={contractorMap}
            searchTerm={searchTerm} canEditAmounts={canEditAmounts} canMutateRows={canMutateRows} activeRolePerspective={activeRolePerspective}
            grid={grid} spreadsheetColumns={spreadsheetColumns} menuTarget={menuTarget} openMenu={openMenu} closeMenu={closeMenu}
            selectedIds={selectedIds} handleSelectAll={() => setSelectedIds(selectedIds.size === filteredServices.length ? new Set() : new Set(filteredServices.map((s) => s.id)))}
            handleCheckboxToggle={(id, idx, e) => { e.stopPropagation(); toggleRowSelection(id, idx, e.shiftKey) }}
            handleClearSelection={() => { setSelectedIds(new Set()); setLastSelectedIndex(null) }}
            inlineEdit={inlineEdit} setInlineEdit={setInlineEdit} saveInlineEdit={saveInlineEdit}
            handleInsertBlankRow={handleInsertBlankRow} handleDuplicateService={handleDuplicateService} handleDeleteService={handleDeleteService}
            handleOpenEvolutionModal={handleOpenEvolutionModal} handleOpenEditModal={handleOpenEditModal} setHistoryService={setHistoryService}
            setPickerModal={setPickerModal} setContractorPickerModal={setContractorPickerModal} stats={stats} hasActiveFilters={hasActiveFilters} clearAllFilters={clearAllFilters}
          />
        ) : (
          <TercerosFichasPanel
            filteredServices={filteredServices} shipMap={shipMap} otMap={otMap} contractorMap={contractorMap} selectedIds={selectedIds}
            handleRowClick={(id, idx, e) => { if (!e.target.closest('button, a, input')) toggleRowSelection(id, idx, e.shiftKey) }}
            handleCheckboxToggle={(id, idx, e) => { e.stopPropagation(); toggleRowSelection(id, idx, e.shiftKey) }}
            handleClearSelection={() => { setSelectedIds(new Set()); setLastSelectedIndex(null) }}
            canEditAmounts={canEditAmounts} activeRolePerspective={activeRolePerspective}
            handleOpenEvolutionModal={handleOpenEvolutionModal} setHistoryService={setHistoryService} handleOpenEditModal={handleOpenEditModal} handleDeleteService={handleDeleteService}
            stats={stats}
          />
        )}
      </div>

      {/* CONTENEDOR DE MODALES */}
      <TercerosModalsContainer
        isModalOpen={isModalOpen} setIsModalOpen={setIsModalOpen} editingService={editingService} setEditingService={setEditingService}
        evolvingService={evolvingService} setEvolvingService={setEvolvingService} auditingService={auditingService} setAuditingService={setAuditingService}
        historyService={historyService} setHistoryService={setHistoryService} pickerModal={pickerModal} setPickerModal={setPickerModal}
        contractorPickerModal={contractorPickerModal} setContractorPickerModal={setContractorPickerModal}
        ships={ships} workOrders={workOrders} workItems={workItems} contractors={contractors} macroVariables={macroVariables} voucherHistory={voucherHistory} services={services}
        shipMap={shipMap} otMap={otMap} canEditAmounts={canEditAmounts} activeRolePerspective={activeRolePerspective} user={user} loadData={loadData} showFeedback={showFeedback}
      />
    </div>
  )
}
