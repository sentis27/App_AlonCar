/**
 * TesoreriaCcPanel.jsx
 * Submódulo "2. Cuenta Corriente & Pagos" en `/tesoreria?tab=movimientos` (Gallo · Graciela y Admin).
 * Sin tarjetas de KPI: foco operativo en adelantos, pagos, DEBE FACTURA, PRCs #2000+ y pase 1-clic de Pañol.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { Plus, RefreshCw, Download, CheckCircle2, AlertTriangle, FileWarning, DollarSign } from 'lucide-react'
import CanonicalActiveSubmoduleBadge from '../canonical/CanonicalActiveSubmoduleBadge'
import CanonicalZone3Toolbar from '../canonical/CanonicalZone3Toolbar'
import { useModuleFilterMemory, resolveInitialModuleFilters } from '../../hooks/useModuleFilterMemory'
import { useSupabaseRealtimeRefresh } from '../../hooks/useSupabaseRealtimeRefresh'
import { useAuth } from '../../context/AuthContext'
import { exportToSpreadsheet } from '../../lib/exportEngine'
import { getFilterPillClass, getFilterSelectClass } from '../../lib/filterThemeConstants'
import { buildCcExportPayload } from '../../lib/contractorCcFormHelpers'
import { buildPrcLookupMaps } from '../../lib/prcRegistryRules'
import { CONTRACTOR_CC_CATEGORIES } from '../../schemas/contractorCc.schema'
import {
  buildPendingPanolBatches,
  CC_CATEGORY_META,
  enrichContractorCcMovements,
  filterContractorCcRows,
  summarizeContractorCcRows,
} from '../../lib/contractorCcRules'
import {
  absorbPanolBatchToCcService,
  deleteContractorCcMovementService,
  fetchContractorCcWorkspaceData,
  saveContractorCcMovementService,
} from '../../services/contractorCcService'
import TesoreriaPanolPendingStrip from './TesoreriaPanolPendingStrip'
import TesoreriaCcTable from './TesoreriaCcTable'
import TesoreriaCcModal from './TesoreriaCcModal'

const CC_REALTIME_TABLES = [
  'contractor_cc_movements',
  'contractor_prc_registry',
  'inventory_transactions',
  'workers',
  'ships',
  'work_orders',
  'macro_variables',
]

export default function TesoreriaCcPanel({
  selectedPeriod,
  onPeriodChange,
  activeSubmodule = null,
  canManageCc = false,
  actor = 'TESORERIA',
}) {
  const { user, profile } = useAuth()
  const initialFilters = useMemo(
    () => resolveInitialModuleFilters(user, profile, 'tesoreria_cc'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [raw, setRaw] = useState({
    movements: [], prcs: [], workers: [], eligibleContractors: [], ships: [], workOrders: [], workItems: [], macroVariables: [], deductionsData: null,
  })
  const [loading, setLoading] = useState(true)
  const [absorbingKey, setAbsorbingKey] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [searchTerm, setSearchTerm] = useState(initialFilters.searchTerm || '')
  const [onlyCurrentPeriod, setOnlyCurrentPeriod] = useState(true)
  const [contractorFilter, setContractorFilter] = useState(initialFilters.contractorFilter || 'todos')
  const [categoryFilter, setCategoryFilter] = useState(initialFilters.categoryFilter || 'todos')
  const [onlyDebeFactura, setOnlyDebeFactura] = useState(false)
  const [modalState, setModalState] = useState({ isOpen: false, initialRow: null, presetInvoiceOnly: false })
  const searchRef = useRef(null)

  const ccViewsController = useModuleFilterMemory({
    moduleKey: 'tesoreria_cc',
    currentFilters: { searchTerm, contractorFilter, categoryFilter },
    setters: { searchTerm: setSearchTerm, contractorFilter: setContractorFilter, categoryFilter: setCategoryFilter },
    hasActiveFilters: Boolean(searchTerm || contractorFilter !== 'todos' || categoryFilter !== 'todos' || onlyDebeFactura || !onlyCurrentPeriod),
  })

  const showFeedback = useCallback((type, text) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 5000)
  }, [])

  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      const data = await fetchContractorCcWorkspaceData(selectedPeriod)
      setRaw(data)
    } catch (err) {
      showFeedback('error', err?.message || 'Error al cargar Cuenta Corriente.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [selectedPeriod, showFeedback])

  useEffect(() => { loadData({ silent: false }) }, [loadData])

  useSupabaseRealtimeRefresh({
    channelName: 'tesoreria_cc_live',
    tables: CC_REALTIME_TABLES,
    onSync: () => loadData({ silent: true }),
    pauseWhen: Boolean(modalState.isOpen || absorbingKey),
  })

  const prcMaps = useMemo(() => buildPrcLookupMaps(raw.prcs), [raw.prcs])
  const enrichedRows = useMemo(
    () => enrichContractorCcMovements(raw.movements, { ships: raw.ships, workOrders: raw.workOrders, prcMaps }),
    [raw.movements, raw.ships, raw.workOrders, prcMaps]
  )

  const filteredRows = useMemo(
    () => filterContractorCcRows(enrichedRows, { searchTerm, onlyCurrentPeriod, currentPeriod: selectedPeriod, contractorFilter, categoryFilter, onlyDebeFactura }),
    [enrichedRows, searchTerm, onlyCurrentPeriod, selectedPeriod, contractorFilter, categoryFilter, onlyDebeFactura]
  )

  const summary = useMemo(() => summarizeContractorCcRows(filteredRows), [filteredRows])
  const pendingPanol = useMemo(() => buildPendingPanolBatches(raw.deductionsData, raw.movements), [raw.deductionsData, raw.movements])

  const periods = raw.deductionsData?.availablePeriods || [selectedPeriod]
  const fortnightDollarRate = Number(raw.deductionsData?.fortnightDollarRate) || 1500
  const contractorOptions = useMemo(() => {
    const names = new Set([
      ...(raw.eligibleContractors || []).map((c) => c.name),
      ...enrichedRows.map((r) => r.contractor_group).filter(Boolean),
    ])
    return [...names].sort((a, b) => a.localeCompare(b, 'es'))
  }, [raw.eligibleContractors, enrichedRows])

  const hasActiveFilters = Boolean(searchTerm || contractorFilter !== 'todos' || categoryFilter !== 'todos' || onlyDebeFactura || !onlyCurrentPeriod)
  const clearAllFilters = () => {
    setSearchTerm(''); setContractorFilter('todos'); setCategoryFilter('todos'); setOnlyDebeFactura(false); setOnlyCurrentPeriod(true)
  }

  const handleSaveMovement = async ({ id, payload }) => {
    await saveContractorCcMovementService({ id, payload, prcs: raw.prcs, actor })
    setModalState({ isOpen: false, initialRow: null, presetInvoiceOnly: false })
    showFeedback('ok', id ? 'Movimiento actualizado en Cuenta Corriente.' : 'Movimiento registrado en Cuenta Corriente.')
    await loadData({ silent: true })
  }

  const handleDeleteRow = async (row) => {
    const panolNote = row.inventory_transaction_ids?.length
      ? `\nLiberará ${row.inventory_transaction_ids.length} retiro(s) de Pañol como pendientes nuevamente.`
      : ''
    if (!window.confirm(`¿Eliminar movimiento de ${row.contractor_group} (${row.categoryLabel}) por AR$ ${Number(row.amount_ars || 0).toLocaleString('es-AR')}?${panolNote}`)) return
    try {
      await deleteContractorCcMovementService({ row, actor })
      showFeedback('ok', 'Movimiento eliminado de Cuenta Corriente.')
      await loadData({ silent: true })
    } catch (err) {
      showFeedback('error', err?.message || 'No se pudo eliminar el movimiento.')
    }
  }

  const handleAbsorbOne = async (batch) => {
    const msg = `¿Confirmar pase a Cuenta Corriente de ${batch.contractorLabel} (${selectedPeriod})?\n• ${batch.pendingCount} retiro(s) de Pañol\n• Total a descontar: AR$ ${batch.pendingTotalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })} (TC AR$ ${fortnightDollarRate})`
    if (!window.confirm(msg)) return
    try {
      setAbsorbingKey(batch.contractorLabel)
      await absorbPanolBatchToCcService({
        pendingBatch: batch, periodKey: selectedPeriod, periodEndDate: raw.deductionsData?.range?.endDate,
        fortnightDollarRate, workers: raw.workers, existingMovements: raw.movements, actor,
      })
      showFeedback('ok', `Pañol de ${batch.contractorLabel} pasado a Cuenta Corriente sin duplicados.`)
      await loadData({ silent: true })
    } catch (err) {
      showFeedback('error', err?.message || 'Error al pasar retiros de Pañol a CC.')
    } finally {
      setAbsorbingKey(null)
    }
  }

  const handleAbsorbAll = async () => {
    const count = pendingPanol.pendingBatches.length
    if (!window.confirm(`¿Confirmar pase a Cuenta Corriente de los ${count} contratistas pendientes en ${selectedPeriod} (AR$ ${pendingPanol.pendingTotalArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })})?`)) return
    try {
      setAbsorbingKey('ALL')
      let latestMovements = raw.movements
      for (const batch of pendingPanol.pendingBatches) {
        const created = await absorbPanolBatchToCcService({
          pendingBatch: batch, periodKey: selectedPeriod, periodEndDate: raw.deductionsData?.range?.endDate,
          fortnightDollarRate, workers: raw.workers, existingMovements: latestMovements, actor,
        })
        if (created) latestMovements = [created, ...latestMovements]
      }
      showFeedback('ok', `${count} lotes de Pañol (${selectedPeriod}) pasados a Cuenta Corriente.`)
      await loadData({ silent: true })
    } catch (err) {
      showFeedback('error', err?.message || 'Error al pasar lotes de Pañol a CC.')
    } finally {
      setAbsorbingKey(null)
    }
  }

  const handleExport = () => exportToSpreadsheet(buildCcExportPayload(filteredRows, onlyCurrentPeriod ? selectedPeriod : 'historico'))

  return (
    <div className="space-y-3 font-sans">
      <div className="alon-zone-context">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-emerald-300 shrink-0">
              <DollarSign className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CanonicalActiveSubmoduleBadge label={activeSubmodule?.label || '2. Cuenta Corriente & Pagos'} theme={activeSubmodule?.theme || 'emerald'} />
                <span className="text-[10px] font-bold text-slate-400">Responsable: Graciela · Planilla auditada en audit_logs</span>
              </div>
              <h1 className="text-lg font-black text-white mt-0.5">Cuenta Corriente & Pagos de Contratistas</h1>
              <p className="text-xs text-slate-400">
                Adelantos, pagos, gastos a cuenta, seguimiento DEBE FACTURA, PRCs oficiales (#2000+) y pase directo desde Pañol.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select value={selectedPeriod} onChange={(e) => onPeriodChange?.(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-xs font-bold text-cyan-300 cursor-pointer">
              {periods.map((p) => <option key={p} value={p}>Quincena {p}</option>)}
            </select>
            {canManageCc && (
              <button type="button" onClick={() => setModalState({ isOpen: true, initialRow: null, presetInvoiceOnly: false })} className="px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer">
                <Plus className="w-3.5 h-3.5" />
                <span>Cargar Movimiento</span>
              </button>
            )}
            <button type="button" onClick={() => loadData({ silent: false })} disabled={loading} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
            <button type="button" onClick={handleExport} className="px-3 py-2 rounded-xl bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>
          </div>
        </div>
      </div>

      {feedback && (
        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${feedback.type === 'error' ? 'bg-rose-950/80 border-rose-500/60 text-rose-200' : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'}`}>
          {feedback.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      <TesoreriaPanolPendingStrip
        pendingReport={pendingPanol} periodKey={selectedPeriod} fortnightDollarRate={fortnightDollarRate}
        canManageCc={canManageCc} absorbingKey={absorbingKey} onAbsorbOne={handleAbsorbOne} onAbsorbAll={handleAbsorbAll}
      />

      <CanonicalZone3Toolbar
        searchValue={searchTerm} onSearchChange={setSearchTerm} searchInputRef={searchRef}
        searchPlaceholder="Buscar contratista, PRC #2000+, cheque, factura, barco u observaciones..."
        viewsController={ccViewsController}
        hasActiveFilters={hasActiveFilters} onClearAllFilters={clearAllFilters}
        counterText={`${filteredRows.length} de ${enrichedRows.length} mov.`}
        filters={(
          <>
            <button type="button" onClick={() => setOnlyCurrentPeriod((p) => !p)} className={getFilterPillClass('period', onlyCurrentPeriod)}>
              {onlyCurrentPeriod ? `Quincena: ${selectedPeriod}` : 'Todo el historial'}
            </button>
            <select value={contractorFilter} onChange={(e) => setContractorFilter(e.target.value)} className={getFilterSelectClass('contractor', contractorFilter !== 'todos')}>
              <option value="todos">Contratista (Todos)</option>
              {contractorOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className={getFilterSelectClass('category', categoryFilter !== 'todos')}>
              <option value="todos">Categoría (Todas)</option>
              {CONTRACTOR_CC_CATEGORIES.map((c) => <option key={c} value={c}>{CC_CATEGORY_META[c]?.label || c}</option>)}
            </select>
            <button type="button" onClick={() => setOnlyDebeFactura((p) => !p)} className={getFilterPillClass('status', onlyDebeFactura)}>
              <FileWarning className="w-3.5 h-3.5" />
              <span>Solo DEBE FACTURA</span>
            </button>
          </>
        )}
      />

      <TesoreriaCcTable
        rows={filteredRows} totalCount={enrichedRows.length} summary={summary}
        resetKey={`${selectedPeriod}|${onlyCurrentPeriod}|${contractorFilter}|${categoryFilter}|${onlyDebeFactura}|${searchTerm}`}
        searchTerm={searchTerm} hasActiveFilters={hasActiveFilters} onClearAllFilters={clearAllFilters}
        workOrders={raw.workOrders} workItems={raw.workItems} canManageCc={canManageCc}
        onEditRow={(row) => setModalState({ isOpen: true, initialRow: row, presetInvoiceOnly: false })}
        onQuickResolveInvoice={(row) => setModalState({ isOpen: true, initialRow: row, presetInvoiceOnly: true })}
        onDeleteRow={handleDeleteRow}
      />

      <TesoreriaCcModal
        isOpen={modalState.isOpen} initialRow={modalState.initialRow} presetInvoiceOnly={modalState.presetInvoiceOnly}
        currentPeriod={selectedPeriod} availablePeriods={periods} fortnightDollarRate={fortnightDollarRate}
        contractors={raw.eligibleContractors} prcs={raw.prcs} ships={raw.ships} workOrders={raw.workOrders}
        onClose={() => setModalState({ isOpen: false, initialRow: null, presetInvoiceOnly: false })}
        onSave={handleSaveMovement}
      />
    </div>
  )
}
