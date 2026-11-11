import { useState, useEffect, useMemo, useCallback } from 'react'
import { Clock, AlertCircle, AlertTriangle, FileText, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import LaborCargaPanel from '../components/labor/LaborCargaPanel'
import LaborControlDiarioPanel from '../components/labor/LaborControlDiarioPanel'
import LaborSabanaPanel from '../components/labor/LaborSabanaPanel'
import { LaborModalsContainer } from '../components/labor/LaborModals'
import { NOMINA_ASTILLERO_BASE, buildQuincenaDays, FALLBACK_SHIPS, FALLBACK_WOS } from '../lib/laborConstants'

export default function LaborLogs() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState('carga')
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState(null)
  const [recentLogs, setRecentLogs] = useState([])
  const [ships, setShips] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [workItems, setWorkItems] = useState([])
  const [dbWorkers, setDbWorkers] = useState([])

  const [activeKpiFilter, setActiveKpiFilter] = useState('todos')
  const [dailyFilterType, setDailyFilterType] = useState('todos')
  const [selectedLogIds, setSelectedLogIds] = useState(new Set())
  const [auditDate, setAuditDate] = useState(new Date().toISOString().split('T')[0])

  const [editingLog, setEditingLog] = useState(null)
  const [quickLogWorker, setQuickLogWorker] = useState(null)
  const [reviewReasonModal, setReviewReasonModal] = useState({ isOpen: false, logId: null, initialReason: '' })
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [shipPickerModal, setShipPickerModal] = useState({ isOpen: false, logId: null, currentShipId: '', currentWorkOrderId: '', workerName: '' })

  const currentDate = new Date()
  const [selectedYear, setSelectedYear] = useState(String(currentDate.getFullYear()))
  const [selectedMonth, setSelectedMonth] = useState(String(currentDate.getMonth() + 1))
  const [selectedQuincena, setSelectedQuincena] = useState(currentDate.getDate() <= 15 ? '1' : '2')
  const [sabanaSearch, setSabanaSearch] = useState('')
  const [selectedQuincenaWorker, setSelectedQuincenaWorker] = useState(null)

  const showFeedbackMsg = useCallback((type, text) => {
    setStatusMessage({ type, text })
    setTimeout(() => setStatusMessage(null), 5000)
  }, [])

  useEffect(() => { fetchData() }, [])

  async function fetchData() {
    setLoading(true)
    try {
      const [logsRes, shipsRes, woRes, wiRes, wkrRes] = await Promise.all([
        supabase.from('labor_logs').select('*, ships(id, name), work_orders(id, ot_number, title, ship_id)').order('date_logged', { ascending: false }).order('created_at', { ascending: false }).limit(2000),
        supabase.from('ships').select('id, name, status').order('name'),
        supabase.from('work_orders').select('id, ot_number, title, ship_id, status').order('ot_number'),
        supabase.from('work_items').select('id, work_order_id, contractors, description, status, work_type'),
        supabase.from('workers').select('id, name, category, trade, work_group, admin_center, status, can_impute_hours').order('name')
      ])
      setRecentLogs(logsRes.data || [])
      setShips(shipsRes.data?.length ? shipsRes.data : FALLBACK_SHIPS)
      setWorkOrders(woRes.data?.length ? woRes.data : FALLBACK_WOS)
      setWorkItems(wiRes.data || [])
      setDbWorkers(wkrRes.data || [])
    } catch (err) {
      showFeedbackMsg('error', 'Error al sincronizar datos: ' + (err.message || err))
    } finally {
      setLoading(false)
    }
  }

  const toggleSelectLog = useCallback((id) => {
    setSelectedLogIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }, [])
  const toggleSelectAllLogs = useCallback((ids) => {
    setSelectedLogIds(prev => prev.size === ids.length ? new Set() : new Set(ids))
  }, [])

  const handleDeleteLog = async (id, name) => {
    if (!window.confirm(`¿Eliminar imputación de ${name}?`)) return
    try {
      const { error } = await supabase.from('labor_logs').delete().eq('id', id)
      if (error) throw error
      setRecentLogs(prev => prev.filter(l => l.id !== id))
      setSelectedLogIds(prev => { const n = new Set(prev); n.delete(id); return n })
      showFeedbackMsg('success', 'Imputación eliminada.')
    } catch (err) { showFeedbackMsg('error', 'Error al eliminar: ' + err.message) }
  }

  const handleUpdateApprovalStatus = async (logId, status) => {
    try {
      const { error } = await supabase.from('labor_logs').update({ approval_status: status }).eq('id', logId)
      if (error) throw error
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
  const allQuincenaWorkers = useMemo(() => {
    const set = new Set()
    dbWorkers.filter(w => w.status !== 'INACTIVO').forEach(w => set.add(w.name))
    NOMINA_ASTILLERO_BASE.forEach(w => set.add(w.name))
    recentLogs.forEach(l => { if (l.worker_name) set.add(l.worker_name) })
    return Array.from(set).sort()
  }, [dbWorkers, recentLogs])
  const filteredSabanaWorkers = useMemo(() => !sabanaSearch ? allQuincenaWorkers : allQuincenaWorkers.filter(w => w.toLowerCase().includes(sabanaSearch.toLowerCase())), [allQuincenaWorkers, sabanaSearch])
  const filteredReviewLogs = useMemo(() => recentLogs.filter(l => l.approval_status === 'R' || l.approval_status === 'RR'), [recentLogs])

  return (
    <div className="space-y-4 pb-12">
      <div className="alon-zone-context flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/20 text-slate-950">
            <Clock className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <h1 className="text-xl font-black text-white tracking-wide flex items-center gap-2">
              CONTROL DE HORAS Y CUADRILLAS
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-400 uppercase">M3b Canónico</span>
            </h1>
            <p className="text-xs text-slate-400">Imputación de mano de obra naval, tabulador IA WhatsApp y control diario/quincenal de nómina.</p>
          </div>
        </div>
        <div className="bg-slate-950 p-1 rounded-lg border border-slate-800 flex items-center text-xs">
          <button onClick={() => setActiveTab('carga')} className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${activeTab === 'carga' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}>⚡ Carga & Cuadrillas</button>
          <button onClick={() => setActiveTab('control_diario')} className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${activeTab === 'control_diario' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}>📋 Control Diario ({recentLogs.filter(l => l.date_logged === auditDate).length})</button>
          <button onClick={() => setActiveTab('sabana_quincenal')} className={`px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${activeTab === 'sabana_quincenal' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' : 'text-slate-400 hover:text-white'}`}>📊 Sábana Quincenal</button>
        </div>
      </div>

      {statusMessage && (
        <div className={`p-3 rounded-lg border text-xs font-semibold flex items-center justify-between ${statusMessage.type === 'success' ? 'bg-emerald-950/80 border-emerald-500/50 text-emerald-300' : 'bg-rose-950/80 border-rose-500/50 text-rose-300'}`}>
          <span>{statusMessage.text}</span>
          <button onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      <div className="alon-zone-kpis p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-amber-400">📊 RADAR DE KPIS Y ALERTAS OPERATIVAS</span>
          {activeKpiFilter !== 'todos' && (
            <button type="button" onClick={() => setActiveKpiFilter('todos')} className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-1.5 cursor-pointer">
              <X className="w-3.5 h-3.5" /> Quitar Filtro KPI
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <button type="button" onClick={() => setActiveKpiFilter(activeKpiFilter === 'sin_ot' ? 'todos' : 'sin_ot')} className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${activeKpiFilter === 'sin_ot' ? 'bg-amber-950/80 border-amber-400 ring-2 ring-amber-400' : 'bg-slate-900/80 border-slate-800 hover:border-amber-500/40'}`}>
            <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Falta Cargar OT</span>
            <div className="flex items-baseline gap-2 mt-2"><span className="text-2xl font-black text-amber-300 font-mono">{countSinOt}</span><span className="text-xs text-slate-400">sin OT</span></div>
          </button>
          <button type="button" onClick={() => setActiveKpiFilter(activeKpiFilter === 'revision_R' ? 'todos' : 'revision_R')} className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${activeKpiFilter === 'revision_R' ? 'bg-rose-950/80 border-rose-400 ring-2 ring-rose-400' : 'bg-slate-900/80 border-slate-800 hover:border-rose-500/40'}`}>
            <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Requiere Revisión (R)</span>
            <div className="flex items-baseline gap-2 mt-2"><span className="text-2xl font-black text-rose-300 font-mono">{countR}</span><span className="text-xs text-slate-400">alertas</span></div>
          </button>
          <button type="button" onClick={() => setActiveKpiFilter(activeKpiFilter === 'corregidas_RR' ? 'todos' : 'corregidas_RR')} className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${activeKpiFilter === 'corregidas_RR' ? 'bg-amber-950/80 border-amber-400 ring-2 ring-amber-400' : 'bg-slate-900/80 border-slate-800 hover:border-amber-500/40'}`}>
            <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Horas Corregidas (RR)</span>
            <div className="flex items-baseline gap-2 mt-2"><span className="text-2xl font-black text-amber-300 font-mono">{countRR}</span><span className="text-xs text-slate-400">revisadas</span></div>
          </button>
          <button type="button" onClick={() => setActiveKpiFilter(activeKpiFilter === 'incompleta' ? 'todos' : 'incompleta')} className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${activeKpiFilter === 'incompleta' ? 'bg-orange-950/80 border-orange-400 ring-2 ring-orange-400' : 'bg-slate-900/80 border-slate-800 hover:border-orange-500/40'}`}>
            <span className="text-xs font-bold text-orange-400 flex items-center gap-1.5"><Clock className="w-4 h-4" /> Jornada Incompleta</span>
            <div className="flex items-baseline gap-2 mt-2"><span className="text-2xl font-black text-orange-300 font-mono">{incompleteCount}</span><span className="text-xs text-slate-400">&lt;9hs</span></div>
          </button>
          <button type="button" onClick={() => setActiveKpiFilter(activeKpiFilter === 'sin_prc' ? 'todos' : 'sin_prc')} className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${activeKpiFilter === 'sin_prc' ? 'bg-purple-950/80 border-purple-400 ring-2 ring-purple-400' : 'bg-slate-900/80 border-slate-800 hover:border-purple-500/40'}`}>
            <span className="text-xs font-bold text-purple-400 flex items-center gap-1.5"><FileText className="w-4 h-4" /> Sin PRC Vinculado</span>
            <div className="flex items-baseline gap-2 mt-2"><span className="text-2xl font-black text-purple-300 font-mono">{countSinPrc}</span><span className="text-xs text-slate-400">sin PRC</span></div>
          </button>
        </div>
      </div>

      {activeTab === 'carga' && (
        <LaborCargaPanel ships={ships} workOrders={workOrders} workItems={workItems} dbWorkers={dbWorkers} recentLogs={recentLogs} setRecentLogs={setRecentLogs} fetchData={fetchData} selectedLogIds={selectedLogIds} setSelectedLogIds={setSelectedLogIds} toggleSelectLog={toggleSelectLog} toggleSelectAllLogs={toggleSelectAllLogs} activeKpiFilter={activeKpiFilter} setActiveKpiFilter={setActiveKpiFilter} handleEditFromDaily={(log) => setEditingLog(log)} handleDeleteLog={handleDeleteLog} handleUpdateApprovalStatus={handleUpdateApprovalStatus} setReviewReasonModal={setReviewReasonModal} setShipPickerModal={setShipPickerModal} setActiveTab={setActiveTab} setDailyFilterType={setDailyFilterType} setStatusMessage={setStatusMessage} user={user} />
      )}
      {activeTab === 'control_diario' && (
        <LaborControlDiarioPanel auditDate={auditDate} setAuditDate={setAuditDate} recentLogs={recentLogs} setRecentLogs={setRecentLogs} dbWorkers={dbWorkers} selectedLogIds={selectedLogIds} toggleSelectLog={toggleSelectLog} toggleSelectAllLogs={toggleSelectAllLogs} handleUpdateApprovalStatus={handleUpdateApprovalStatus} setShipPickerModal={setShipPickerModal} openQuickLogModal={(w) => setQuickLogWorker({ worker_name: w.name, worker_type: w.type, default_rubro: w.defaultRubro, allowed_trades: [w.defaultRubro], rubro: w.defaultRubro, ship_id: '', work_order_id: '', hours_normal: w.type === 'Astillero' ? 9 : 8, hours_extra_50: 0, hours_extra_100: 0, notes: '' })} handleEditFromDaily={(log) => setEditingLog(log)} handleDeleteLog={handleDeleteLog} />
      )}
      {activeTab === 'sabana_quincenal' && (
        <LaborSabanaPanel selectedYear={selectedYear} selectedMonth={selectedMonth} setSelectedMonth={setSelectedMonth} selectedQuincena={selectedQuincena} setSelectedQuincena={setSelectedQuincena} sabanaSearch={sabanaSearch} setSabanaSearch={setSabanaSearch} selectedQuincenaWorker={selectedQuincenaWorker} setSelectedQuincenaWorker={setSelectedQuincenaWorker} daysInQuincena={daysInQuincena} filteredSabanaWorkers={filteredSabanaWorkers} allQuincenaWorkers={allQuincenaWorkers} recentLogs={recentLogs} selectedLogIds={selectedLogIds} toggleSelectLog={toggleSelectLog} toggleSelectAllLogs={toggleSelectAllLogs} handleEditDayCell={(log) => setEditingLog(log)} handleQuickAddFromSabana={(name, date) => setQuickLogWorker({ worker_name: name, worker_type: 'Astillero', default_rubro: 'General', allowed_trades: ['General'], rubro: 'General', ship_id: '', work_order_id: '', hours_normal: 9, hours_extra_50: 0, hours_extra_100: 0, notes: `Imputación desde sábana ${date}` })} handleEditFromDaily={(log) => setEditingLog(log)} handleDeleteLog={handleDeleteLog} handleUpdateApprovalStatus={handleUpdateApprovalStatus} setReviewReasonModal={setReviewReasonModal} />
      )}

      <LaborModalsContainer editingLog={editingLog} setEditingLog={setEditingLog} quickLogWorker={quickLogWorker} setQuickLogWorker={setQuickLogWorker} showReviewModal={showReviewModal} setShowReviewModal={setShowReviewModal} reviewReasonModal={reviewReasonModal} setReviewReasonModal={setReviewReasonModal} shipPickerModal={shipPickerModal} setShipPickerModal={setShipPickerModal} ships={ships} workOrders={workOrders} workItems={workItems} dbWorkers={dbWorkers} auditDate={auditDate} recentLogs={recentLogs} setRecentLogs={setRecentLogs} selectedLogIds={selectedLogIds} toggleSelectLog={toggleSelectLog} toggleSelectAllLogs={toggleSelectAllLogs} handleUpdateApprovalStatus={handleUpdateApprovalStatus} handleEditFromDaily={(log) => setEditingLog(log)} countR={countR} countRR={countRR} filteredReviewLogs={filteredReviewLogs} showFeedbackMsg={showFeedbackMsg} />
    </div>
  )
}
