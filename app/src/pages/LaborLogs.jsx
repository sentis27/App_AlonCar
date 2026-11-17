import { useState, useEffect, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { resolveInitialModuleFilters } from '../hooks/useModuleFilterMemory'
import { useSupabaseRealtimeRefresh } from '../hooks/useSupabaseRealtimeRefresh'
import {
  fetchLaborData,
  deleteLaborLogService,
  updateLaborApprovalStatusService
} from '../services/laborService'
import LaborLogsHeader from '../components/labor/LaborLogsHeader'
import LaborKpiRadar from '../components/labor/LaborKpiRadar'
import LaborCargaPanel from '../components/labor/LaborCargaPanel'
import LaborControlDiarioPanel from '../components/labor/LaborControlDiarioPanel'
import LaborSabanaPanel from '../components/labor/LaborSabanaPanel'
import { LaborModalsContainer } from '../components/labor/LaborModals'
import LaborSharedDatalists from '../components/labor/LaborSharedDatalists'
import { buildQuincenaWorkersList } from '../lib/laborWorkerCatalog'
import { buildQuincenaDays, FALLBACK_SHIPS, FALLBACK_WOS } from '../lib/laborConstants'

const LABOR_REALTIME_TABLES = ['labor_logs', 'ships', 'ship_stays', 'work_orders', 'work_items', 'workers', 'rate_cards']

export default function LaborLogs() {
  const { user, profile } = useAuth()
  const [activeTab, setActiveTab] = useState('carga')
  const [activeLoadModal, setActiveLoadModal] = useState(null) // null | 'texto' | 'reloj' | 'cuadrilla'
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])
  const [ships, setShips] = useState([])
  const [shipStays, setShipStays] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [workItems, setWorkItems] = useState([])
  const [dbWorkers, setDbWorkers] = useState([])

  const [searchParams, setSearchParams] = useSearchParams()
  const [activeKpiFilter, setActiveKpiFilter] = useState(() => {
    const kpiParam = searchParams.get('kpi')
    if (kpiParam) return kpiParam
    const restored = resolveInitialModuleFilters(user, profile, 'labor_carga')
    return restored.activeKpiFilter || 'todos'
  })

  useEffect(() => {
    const kpiParam = searchParams.get('kpi')
    if (kpiParam) {
      setActiveTab('carga')
      setActiveKpiFilter(kpiParam)
    }
  }, [searchParams])

  const handleSetActiveKpiFilter = useCallback((nextVal) => {
    setActiveKpiFilter((prev) => {
      const resolved = typeof nextVal === 'function' ? nextVal(prev) : nextVal
      if (resolved === 'todos' && searchParams.get('kpi')) {
        setSearchParams({}, { replace: true })
      }
      return resolved
    })
  }, [searchParams, setSearchParams])
  const initialControlFilters = useMemo(
    () => resolveInitialModuleFilters(user, profile, 'labor_control_diario'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const initialSabanaFilters = useMemo(
    () => resolveInitialModuleFilters(user, profile, 'labor_sabana'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [dailyFilterType, setDailyFilterType] = useState('todos')
  const [selectedLogIds, setSelectedLogIds] = useState(new Set())
  const [auditDate, setAuditDate] = useState(() => initialControlFilters.auditDate || new Date().toISOString().split('T')[0])

  const [editingLog, setEditingLog] = useState(null)
  const [quickLogWorker, setQuickLogWorker] = useState(null)
  const [reviewReasonModal, setReviewReasonModal] = useState({ isOpen: false, logId: null, initialReason: '' })
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [shipPickerModal, setShipPickerModal] = useState({ isOpen: false, logId: null, currentShipId: '', currentWorkOrderId: '', workerName: '' })

  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()))
  const [selectedMonth, setSelectedMonth] = useState(() => initialSabanaFilters.selectedMonth || String(currentDate.getMonth() + 1))
  const [selectedQuincena, setSelectedQuincena] = useState(() => initialSabanaFilters.selectedQuincena || (currentDate.getDate() <= 15 ? '1' : '2'))
  const [sabanaSearch, setSabanaSearch] = useState(() => initialSabanaFilters.sabanaSearch || '')
  const [selectedQuincenaWorker, setSelectedQuincenaWorker] = useState(null)

  const showFeedbackMsg = useCallback((type, text) => {
    setStatusMessage({ type, text })
    setTimeout(() => setStatusMessage(null), 5000)
  }, [])

  const fetchData = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true)
    try {
      const d = await fetchLaborData()
      setRecentLogs(d.laborLogs || [])
      setShips(d.ships?.length ? d.ships : FALLBACK_SHIPS)
      setShipStays(d.shipStays || [])
      setWorkOrders(d.workOrders?.length ? d.workOrders : FALLBACK_WOS)
      setWorkItems(d.workItems || [])
      setDbWorkers(d.workers || [])
    } catch (err) {
      showFeedbackMsg('error', 'Error al sincronizar datos: ' + (err.message || err))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [showFeedbackMsg])

  useSupabaseRealtimeRefresh({
    channelName: 'labor_logs_live',
    tables: LABOR_REALTIME_TABLES,
    onSync: () => fetchData({ silent: true }),
    pauseWhen: Boolean(activeLoadModal || editingLog || quickLogWorker || showReviewModal || reviewReasonModal.isOpen || shipPickerModal.isOpen)
  })

  useEffect(() => { fetchData({ silent: false }) }, [fetchData])

  const toggleSelectLog = useCallback((id) => {
    setSelectedLogIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])
  const toggleSelectAllLogs = useCallback((ids) => {
    setSelectedLogIds(prev => prev.size === ids.length ? new Set() : new Set(ids))
  }, [])

  const handleDeleteLog = async (id, name) => {
    if (!window.confirm(`¿Eliminar imputación de ${name}?`)) return
    try {
      const target = recentLogs.find(l => l.id === id)
      await deleteLaborLogService({
        logId: id,
        workerName: name,
        shipName: target?.ships?.name || 'Buque',
        changedBy: user?.email || 'Operador Web'
      })
      setRecentLogs(prev => prev.filter(l => l.id !== id))
      setSelectedLogIds(prev => { const n = new Set(prev); n.delete(id); return n })
      showFeedbackMsg('success', 'Imputación eliminada.')
    } catch (err) { showFeedbackMsg('error', 'Error al eliminar: ' + err.message) }
  }

  const handleUpdateApprovalStatus = async (logId, status) => {
    try {
      const target = recentLogs.find(l => l.id === logId)
      await updateLaborApprovalStatusService({
        logId,
        approvalStatus: status,
        oldStatus: target?.approval_status || '',
        workerName: target?.worker_name || 'Operario',
        changedBy: user?.email || 'Operador Web'
      })
      setRecentLogs(prev => prev.map(l => l.id === logId ? { ...l, approval_status: status } : l))
    } catch (err) { showFeedbackMsg('error', 'Error: ' + err.message) }
  }

  const countSinOt = useMemo(() => recentLogs.filter(l => !l.work_order_id).length, [recentLogs])
  const countR = useMemo(() => recentLogs.filter(l => l.approval_status === 'R').length, [recentLogs])
  const countRR = useMemo(() => recentLogs.filter(l => l.approval_status === 'RR').length, [recentLogs])
  const countSinPrc = useMemo(() => recentLogs.filter(l => (l.cost_center === 'PRESUPUESTO' || l.work_type === 'PRESUPUESTO') && !l.prc_number).length, [recentLogs])
  const incompleteCount = useMemo(() => {
    const map = new Map()
    recentLogs.forEach(l => {
      if ((l.worker_type || 'Astillero') !== 'Astillero' || !l.worker_name || !l.date_logged) return
      const k = `${l.worker_name}__${l.date_logged}`
      if (!map.has(k)) map.set(k, { sum: 0, feriado: false })
      const e = map.get(k)
      e.sum += parseFloat(l.hours_normal ?? l.hours_worked) || 0
      if ((l.rubro || '').toLowerCase().includes('feriado')) e.feriado = true
    })
    let count = 0
    map.forEach(v => { if (v.sum < (v.feriado ? 8 : 9)) count++ })
    return count
  }, [recentLogs])

  const daysInQuincena = useMemo(() => buildQuincenaDays(selectedYear, selectedMonth, selectedQuincena), [selectedYear, selectedMonth, selectedQuincena])
  const allQuincenaWorkers = useMemo(() => buildQuincenaWorkersList(dbWorkers, recentLogs), [dbWorkers, recentLogs])
  const filteredSabanaWorkers = useMemo(() => {
    if (!sabanaSearch) return allQuincenaWorkers
    const q = sabanaSearch.toLowerCase()
    return allQuincenaWorkers.filter(w => (w.name || '').toLowerCase().includes(q) || (w.type || '').toLowerCase().includes(q))
  }, [allQuincenaWorkers, sabanaSearch])
  const filteredReviewLogs = useMemo(() => recentLogs.filter(l => l.approval_status === 'R' || l.approval_status === 'RR'), [recentLogs])

  const handleOpenLoadModal = useCallback((mode) => {
    setActiveTab('carga')
    setActiveLoadModal(mode)
  }, [])

  return (
    <div className="space-y-4 pb-10">
      <LaborLogsHeader
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        dailyCount={recentLogs.filter(l => l.date_logged === auditDate).length}
        totalLogsCount={recentLogs.length}
        onOpenTextModal={() => handleOpenLoadModal('texto')}
        onOpenClockModal={() => handleOpenLoadModal('reloj')}
        onOpenCrewModal={() => handleOpenLoadModal('cuadrilla')}
      />

      {statusMessage && (
        <div className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-between ${statusMessage.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' : statusMessage.type === 'info' ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300' : 'bg-rose-950/80 border-rose-500/50 text-rose-300'}`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      <LaborKpiRadar
        countSinOt={countSinOt}
        countR={countR}
        countRR={countRR}
        incompleteCount={incompleteCount}
        countSinPrc={countSinPrc}
        activeKpiFilter={activeKpiFilter}
        onToggleKpiFilter={handleSetActiveKpiFilter}
      />

      {loading && recentLogs.length === 0 && (
        <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-800 text-xs text-cyan-300 font-semibold">
          Sincronizando planilla de horas y padrón...
        </div>
      )}

      {activeTab === 'carga' && (
        <LaborCargaPanel
          ships={ships}
          shipStays={shipStays}
          workOrders={workOrders}
          workItems={workItems}
          dbWorkers={dbWorkers}
          recentLogs={recentLogs}
          setRecentLogs={setRecentLogs}
          fetchData={fetchData}
          selectedLogIds={selectedLogIds}
          setSelectedLogIds={setSelectedLogIds}
          toggleSelectLog={toggleSelectLog}
          toggleSelectAllLogs={toggleSelectAllLogs}
          activeKpiFilter={activeKpiFilter}
          setActiveKpiFilter={handleSetActiveKpiFilter}
          handleEditFromDaily={(log) => setEditingLog(log)}
          handleDeleteLog={handleDeleteLog}
          handleUpdateApprovalStatus={handleUpdateApprovalStatus}
          setReviewReasonModal={setReviewReasonModal}
          setShipPickerModal={setShipPickerModal}
          setActiveTab={setActiveTab}
          setDailyFilterType={setDailyFilterType}
          statusMessage={statusMessage}
          setStatusMessage={setStatusMessage}
          activeLoadModal={activeLoadModal}
          setActiveLoadModal={setActiveLoadModal}
          user={user}
        />
      )}
      {activeTab === 'control_diario' && (
        <LaborControlDiarioPanel auditDate={auditDate} setAuditDate={setAuditDate} recentLogs={recentLogs} setRecentLogs={setRecentLogs} dbWorkers={dbWorkers} selectedLogIds={selectedLogIds} toggleSelectLog={toggleSelectLog} toggleSelectAllLogs={toggleSelectAllLogs} handleUpdateApprovalStatus={handleUpdateApprovalStatus} setShipPickerModal={setShipPickerModal} openQuickLogModal={(w) => setQuickLogWorker({ worker_name: w.name, worker_type: w.type, default_rubro: w.defaultRubro, allowed_trades: [w.defaultRubro], rubro: w.defaultRubro, ship_id: '', work_order_id: '', work_type: 'HORA', hours_normal: w.type === 'Astillero' ? 9 : 8, hours_extra_50: 0, hours_extra_100: 0, notes: '' })} handleEditFromDaily={(log) => setEditingLog(log)} handleDeleteLog={handleDeleteLog} />
      )}
      {activeTab === 'sabana_quincenal' && (
        <LaborSabanaPanel selectedYear={selectedYear} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} selectedQuincena={selectedQuincena} setSelectedQuincena={setSelectedQuincena} sabanaSearch={sabanaSearch} setSabanaSearch={setSabanaSearch} selectedQuincenaWorker={selectedQuincenaWorker} setSelectedQuincenaWorker={setSelectedQuincenaWorker} daysInQuincena={daysInQuincena} filteredSabanaWorkers={filteredSabanaWorkers} allQuincenaWorkers={allQuincenaWorkers} recentLogs={recentLogs} selectedLogIds={selectedLogIds} toggleSelectLog={toggleSelectLog} toggleSelectAllLogs={toggleSelectAllLogs} handleEditDayCell={(log) => setEditingLog(log)} handleQuickAddFromSabana={(name, date) => setQuickLogWorker({ worker_name: name, worker_type: 'Astillero', default_rubro: 'General', allowed_trades: ['General'], rubro: 'General', ship_id: '', work_order_id: '', work_type: 'HORA', hours_normal: 9, hours_extra_50: 0, hours_extra_100: 0, notes: `Imputación desde sábana ${date}` })} handleEditFromDaily={(log) => setEditingLog(log)} handleDeleteLog={handleDeleteLog} handleUpdateApprovalStatus={handleUpdateApprovalStatus} setReviewReasonModal={setReviewReasonModal} />
      )}

      <LaborSharedDatalists dbWorkers={dbWorkers} />
      <LaborModalsContainer editingLog={editingLog} setEditingLog={setEditingLog} quickLogWorker={quickLogWorker} setQuickLogWorker={setQuickLogWorker} showReviewModal={showReviewModal} setShowReviewModal={setShowReviewModal} reviewReasonModal={reviewReasonModal} setReviewReasonModal={setReviewReasonModal} shipPickerModal={shipPickerModal} setShipPickerModal={setShipPickerModal} ships={ships} workOrders={workOrders} workItems={workItems} dbWorkers={dbWorkers} auditDate={auditDate} recentLogs={recentLogs} setRecentLogs={setRecentLogs} selectedLogIds={selectedLogIds} toggleSelectLog={toggleSelectLog} toggleSelectAllLogs={toggleSelectAllLogs} handleUpdateApprovalStatus={handleUpdateApprovalStatus} handleEditFromDaily={(log) => setEditingLog(log)} countR={countR} countRR={countRR} filteredReviewLogs={filteredReviewLogs} showFeedbackMsg={showFeedbackMsg} />
    </div>
  )
}
