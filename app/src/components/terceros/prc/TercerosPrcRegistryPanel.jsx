/**
 * TercerosPrcRegistryPanel.jsx
 * Submódulo "3. Base de datos de PRC" en `/terceros?tab=base-prc` (Gallo · solo María José, Graciela y Admin).
 * Visual limpia sin tarjetas de KPI, con libreta oficial #2000+, anulación tachada y adicionales.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { FileSpreadsheet, Plus, Download, AlertTriangle, CheckCircle2, Clock } from 'lucide-react'
import CanonicalActiveSubmoduleBadge from '../../canonical/CanonicalActiveSubmoduleBadge'
import CanonicalZone3Toolbar from '../../canonical/CanonicalZone3Toolbar'
import { useSupabaseRealtimeRefresh } from '../../../hooks/useSupabaseRealtimeRefresh'
import { PRC_BUSINESS_RULE_NOTICE } from '../../../schemas/prcRegistry.schema'
import { formatDateAr, getTodayArIso } from '../../../lib/dateTimeCanonical'
import { exportToSpreadsheet } from '../../../lib/exportEngine'
import {
  enrichPrcRegistryRows,
  filterPrcRegistryRows,
  formatPrcNumberLabel,
  getEligiblePrcContractors,
} from '../../../lib/prcRegistryRules'
import {
  annulPrcService,
  fetchPrcRegistryWorkspaceData,
  issueNewPrcService,
  previewNextPrcNumberService,
  updatePrcRecordService,
} from '../../../services/prcRegistryService'
import TercerosPrcRegistryTable from './TercerosPrcRegistryTable'
import TercerosPrcIssueModal from './TercerosPrcIssueModal'
import TercerosPrcAnnulModal from './TercerosPrcAnnulModal'

const PRC_REALTIME_TABLES = ['contractor_prc_registry', 'ships', 'work_orders', 'work_items', 'workers', 'macro_variables']

export default function TercerosPrcRegistryPanel({
  activeSubmodule = null,
  canManagePrc = false,
  actor = 'ADMIN',
}) {
  const [raw, setRaw] = useState({ prcs: [], nextPrcNumber: 2000, ships: [], workOrders: [], workItems: [], workers: [], macroVariables: [] })
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [contractorFilter, setContractorFilter] = useState('todos')
  const [shipFilter, setShipFilter] = useState('todos')
  const searchInputRef = useRef(null)

  const [issueModal, setIssueModal] = useState({ isOpen: false, mode: 'issue', editingPrc: null, parentPrc: null })
  const [annulTarget, setAnnulTarget] = useState(null)

  const showFeedback = useCallback((type, text) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 4500)
  }, [])

  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      const data = await fetchPrcRegistryWorkspaceData()
      setRaw(data)
    } catch (err) {
      showFeedback('error', 'Error al cargar Base de datos de PRC: ' + (err?.message || err))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [showFeedback])

  useEffect(() => { loadData({ silent: false }) }, [loadData])

  useSupabaseRealtimeRefresh({
    channelName: 'terceros_prc_registry_live',
    tables: PRC_REALTIME_TABLES,
    onSync: () => loadData({ silent: true }),
    pauseWhen: Boolean(issueModal.isOpen || annulTarget),
  })

  const enrichedRows = useMemo(
    () => enrichPrcRegistryRows(raw.prcs, { ships: raw.ships, workOrders: raw.workOrders }),
    [raw.prcs, raw.ships, raw.workOrders]
  )

  const filteredRows = useMemo(
    () => filterPrcRegistryRows(enrichedRows, { searchTerm, statusFilter, contractorFilter, shipFilter }),
    [enrichedRows, searchTerm, statusFilter, contractorFilter, shipFilter]
  )

  const contractorOptions = useMemo(() => {
    const names = new Set([
      ...getEligiblePrcContractors(raw.workers).map((c) => c.name),
      ...enrichedRows.map((r) => r.contractor_name).filter(Boolean),
    ])
    return [...names].sort((a, b) => a.localeCompare(b, 'es'))
  }, [raw.workers, enrichedRows])

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== 'todos' || contractorFilter !== 'todos' || shipFilter !== 'todos')
  const clearAllFilters = () => { setSearchTerm(''); setStatusFilter('todos'); setContractorFilter('todos'); setShipFilter('todos') }

  const handleIssuePrc = async (formData, parentPrc) => {
    const created = await issueNewPrcService({
      formData,
      contractors: raw.workers,
      macroVariables: raw.macroVariables,
      actor,
      sourceModule: 'TERCEROS_PRC',
      parentPrc,
    })
    showFeedback('success', `${formatPrcNumberLabel(created.prc_number)} emitido para ${created.contractor_name}.`)
    await loadData({ silent: true })
  }

  const handleUpdatePrc = async (prc, patch) => {
    await updatePrcRecordService({ prc, patch, actor })
    showFeedback('success', `${formatPrcNumberLabel(prc.prc_number)} actualizado.`)
    await loadData({ silent: true })
  }

  const handleToggleTerminated = async (prc) => {
    const nextStatus = prc.status === 'TERMINADO' ? 'ACTIVO' : 'TERMINADO'
    await updatePrcRecordService({ prc, patch: { status: nextStatus }, actor })
    showFeedback('success', `${formatPrcNumberLabel(prc.prc_number)} marcado como ${nextStatus}.`)
    await loadData({ silent: true })
  }

  const handleConfirmAnnul = async (prc, reason) => {
    await annulPrcService({ prc, reason, actor })
    showFeedback('success', `${formatPrcNumberLabel(prc.prc_number)} anulado y tachado en la libreta oficial.`)
    await loadData({ silent: true })
  }

  const handleExport = () => {
    exportToSpreadsheet({
      filename: `base_prc_${getTodayArIso()}`,
      rows: filteredRows.map((r) => ({
        numero_prc: formatPrcNumberLabel(r.prc_number),
        fecha: formatDateAr(r.issue_date),
        contratista: r.contractor_name,
        barco: r.shipName,
        orden_trabajo: r.otLabel,
        descripcion: r.description,
        importe_ars: Number(r.amount_ars || 0),
        importe_usd: Number(r.amount_usd || 0),
        vinculo: r.parentLabel || (r.additionalsCount ? `Con ${r.additionalsCount} adicional(es)` : ''),
        estado: r.status,
        observaciones: r.status === 'ANULADO' && r.annulled_reason ? `Anulado: ${r.annulled_reason}` : (r.observations || ''),
      })),
    })
  }

  return (
    <div className="space-y-3.5 w-full pb-10">
      {feedback && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between ${feedback.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200' : 'bg-rose-950/90 border-rose-500/60 text-rose-200'}`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{feedback.text}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      {/* ZONA 1: CONTEXTO, REGLA DE NEGOCIO Y ACCIONES PRINCIPALES (SIN KPIS) */}
      <div className="alon-zone-context p-4 space-y-2.5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 shrink-0">
              <FileSpreadsheet className="w-5 h-5 stroke-[2.4]" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-lg sm:text-xl font-black text-white tracking-wide">BASE DE DATOS DE PRC</h1>
                <CanonicalActiveSubmoduleBadge label={activeSubmodule?.shortLabel || 'Base de datos PRC'} theme={activeSubmodule?.theme || 'amber'} />
                <span className="px-2 py-0.5 rounded-md bg-amber-950/80 border border-amber-500/50 text-amber-300 font-mono text-[11px] font-black">
                  Próximo libre: PRC #{raw.nextPrcNumber}
                </span>
              </div>
              <p className="text-xs text-slate-400">Libreta digital única e inmutable de presupuestos para contratistas (desde #2000 · Solo María José, Graciela y Admin).</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button type="button" onClick={handleExport} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>
            {canManagePrc && (
              <button type="button" onClick={() => setIssueModal({ isOpen: true, mode: 'issue', editingPrc: null, parentPrc: null })} className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 shadow-lg shadow-amber-500/20 cursor-pointer">
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Nuevo PRC</span>
              </button>
            )}
          </div>
        </div>

        <div className="px-3 py-2 rounded-xl bg-amber-950/35 border border-amber-500/40 text-amber-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>{PRC_BUSINESS_RULE_NOTICE}</span>
        </div>
      </div>

      {/* ZONA 3 & ZONA 4: FILTROS + PLANILLA OFICIAL */}
      <div className="alon-workspace-block">
        <CanonicalZone3Toolbar
          searchValue={searchTerm}
          onSearchChange={setSearchTerm}
          searchInputRef={searchInputRef}
          searchPlaceholder="Buscar Nº PRC, contratista, barco, OT, descripción o DD/MM/AAAA... (Ctrl+F)"
          hasActiveFilters={hasActiveFilters}
          onClearAllFilters={clearAllFilters}
          counterText={`${filteredRows.length} de ${enrichedRows.length} PRCs`}
          filters={(
            <>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white">
                <option value="todos">Todos los Estados</option>
                <option value="ACTIVO">Activos</option>
                <option value="TERMINADO">Terminados</option>
                <option value="ANULADO">Anulados (Tachados)</option>
              </select>
              <select value={contractorFilter} onChange={(e) => setContractorFilter(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white max-w-[200px]">
                <option value="todos">Todos los Contratistas</option>
                {contractorOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={shipFilter} onChange={(e) => setShipFilter(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white max-w-[180px]">
                <option value="todos">Todos los Barcos</option>
                {(raw.ships || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </>
          )}
        />

        {loading && enrichedRows.length === 0 ? (
          <div className="p-10 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
            <Clock className="w-7 h-7 animate-spin mx-auto text-amber-400 mb-2" />
            <p className="text-xs font-semibold">Sincronizando Base de datos de PRC...</p>
          </div>
        ) : (
          <TercerosPrcRegistryTable
            rows={filteredRows}
            totalCount={enrichedRows.length}
            resetKey={`${searchTerm}|${statusFilter}|${contractorFilter}|${shipFilter}`}
            searchTerm={searchTerm}
            hasActiveFilters={hasActiveFilters}
            onClearAllFilters={clearAllFilters}
            ships={raw.ships}
            workOrders={raw.workOrders}
            workItems={raw.workItems}
            canManagePrc={canManagePrc}
            onCreateAdditional={(row) => setIssueModal({ isOpen: true, mode: 'additional', editingPrc: null, parentPrc: row })}
            onEditPrc={(row) => setIssueModal({ isOpen: true, mode: 'edit', editingPrc: row, parentPrc: null })}
            onToggleTerminated={(row) => handleToggleTerminated(row).catch((err) => showFeedback('error', err.message))}
            onOpenAnnul={(row) => setAnnulTarget(row)}
          />
        )}
      </div>

      <TercerosPrcIssueModal
        isOpen={issueModal.isOpen}
        mode={issueModal.mode}
        editingPrc={issueModal.editingPrc}
        parentPrc={issueModal.parentPrc}
        workers={raw.workers}
        ships={raw.ships}
        workOrders={raw.workOrders}
        macroVariables={raw.macroVariables}
        initialNextNumber={raw.nextPrcNumber}
        onPeekNextNumber={previewNextPrcNumberService}
        onClose={() => setIssueModal({ isOpen: false, mode: 'issue', editingPrc: null, parentPrc: null })}
        onIssuePrc={handleIssuePrc}
        onUpdatePrc={handleUpdatePrc}
      />

      <TercerosPrcAnnulModal
        isOpen={Boolean(annulTarget)}
        prc={annulTarget}
        onClose={() => setAnnulTarget(null)}
        onConfirmAnnul={handleConfirmAnnul}
      />
    </div>
  )
}
