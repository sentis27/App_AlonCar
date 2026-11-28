/**
 * TesoreriaContratadosPanel.jsx
 * Submódulo `3. Contratados` (`CARGA_EDICION` — Gallo · `/tesoreria?tab=contratados`).
 * Vista por Contratista/Taller con solapa `RESUMEN` + pestañas por Barco,
 * Zona 2 KpiRadar de totales, Buscador Crawler por contratista y grilla editable.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, FileWarning, Layers, Clock } from 'lucide-react'
import KpiRadar from '../../KpiRadar'
import CanonicalZone3Toolbar from '../../canonical/CanonicalZone3Toolbar'
import { useModuleFilterMemory, resolveInitialModuleFilters } from '../../../hooks/useModuleFilterMemory'
import { useSupabaseRealtimeRefresh } from '../../../hooks/useSupabaseRealtimeRefresh'
import { useAuth } from '../../../context/AuthContext'
import { exportToSpreadsheet } from '../../../lib/exportEngine'
import { getFilterPillClass, getViewToggleButtonClass, ZONE3_VIEW_TOGGLE_GROUP_CLASS } from '../../../lib/filterThemeConstants'
import { buildPendingPanolBatches, normalizeContractorKey } from '../../../lib/contractorCcRules'
import { absorbPanolBatchToCcService, saveContractorCcMovementService } from '../../../services/contractorCcService'
import { saveCcPaymentService } from '../../../services/thirdPartyCcService'
import {
  RESUMEN_TAB_ID, GENERAL_SHIP_TAB_ID, buildContractorEntitiesList,
  buildContratadosKpiCards, buildLedgerExportPayload, formatLedgerMoney,
} from '../../../lib/contractorLedgerHelpers'
import { buildContractorBook, computeBookKpis, filterBookRowsAndCrossMatches } from '../../../lib/contractorLedgerEngine'
import {
  deleteLedgerRowService, fetchContractorLedgerWorkspaceData,
  patchInlineLedgerCellService, saveInlineLedgerRowService,
} from '../../../services/contractorLedgerService'
import TesoreriaPanolPendingStrip from '../TesoreriaPanolPendingStrip'
import TesoreriaContratadosHeader from './TesoreriaContratadosHeader'
import TesoreriaContratadosBookTabs from './TesoreriaContratadosBookTabs'
import TesoreriaContratadosGrid from './TesoreriaContratadosGrid'
import TesoreriaContratadosModals from './TesoreriaContratadosModals'

const LEDGER_REALTIME_TABLES = [
  'contractor_cc_movements', 'contractor_prc_registry', 'contractor_settlement_closures',
  'labor_logs', 'rate_cards', 'workers', 'ships', 'work_orders',
  'third_party_cc_accounts', 'third_party_cc_entries', 'third_party_cc_payments', 'inventory_transactions',
]

export default function TesoreriaContratadosPanel({
  selectedPeriod = '', onPeriodChange, activeSubmodule = null, canManageCc = false, actor = 'TESORERIA',
}) {
  const { user, profile } = useAuth()
  const initialFilters = useMemo(
    () => resolveInitialModuleFilters(user, profile, 'tesoreria_contratados'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const [raw, setRaw] = useState(null)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState(null)
  const [selectedEntityId, setSelectedEntityId] = useState(initialFilters.selectedEntityId || '')
  const [activeTabId, setActiveTabId] = useState(RESUMEN_TAB_ID)
  const [resumenSortMode, setResumenSortMode] = useState('grouped')
  const [manualShipsByEntity, setManualShipsByEntity] = useState({})
  const [searchTerm, setSearchTerm] = useState('')
  const [kpiFilter, setKpiFilter] = useState('todos')
  const [onlyDebeFactura, setOnlyDebeFactura] = useState(false)
  const [isAddingInline, setIsAddingInline] = useState(false)
  const [editingCell, setEditingCell] = useState(null)
  const [absorbingKey, setAbsorbingKey] = useState(null)
  const [ccModal, setCcModal] = useState({ isOpen: false, initialRow: null, presetInvoiceOnly: false, presetDefaults: null })
  const [wsPayModal, setWsPayModal] = useState({ isOpen: false, editingPayment: null })
  const searchRef = useRef(null)

  const viewsController = useModuleFilterMemory({
    moduleKey: 'tesoreria_contratados',
    currentFilters: { selectedEntityId, searchTerm, kpiFilter },
    setters: { selectedEntityId: setSelectedEntityId, searchTerm: setSearchTerm, kpiFilter: setKpiFilter },
    hasActiveFilters: Boolean(searchTerm || kpiFilter !== 'todos' || onlyDebeFactura),
  })

  const showFeedback = useCallback((type, text) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 5000)
  }, [])

  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      setRaw(await fetchContractorLedgerWorkspaceData(selectedPeriod))
    } catch (err) {
      showFeedback('error', err?.message || 'Error al cargar Contratados.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [selectedPeriod, showFeedback])

  useEffect(() => { loadData({ silent: false }) }, [loadData])
  useSupabaseRealtimeRefresh({
    channelName: 'tesoreria_contratados_live', tables: LEDGER_REALTIME_TABLES,
    onSync: () => loadData({ silent: true }),
    pauseWhen: Boolean(isAddingInline || editingCell || ccModal.isOpen || wsPayModal.isOpen || absorbingKey),
  })

  const entities = useMemo(() => buildContractorEntitiesList({
    workers: raw?.workers || [], movements: raw?.movements || [], prcs: raw?.prcs || [],
    laborLogs: raw?.laborLogs || [], ccAccounts: raw?.thirdPartyCcData?.accounts || [],
  }), [raw])
  const selectedEntity = useMemo(() => entities.find((e) => e.id === selectedEntityId) || entities[0] || null, [entities, selectedEntityId])
  const manualShipIds = useMemo(() => (selectedEntity ? (manualShipsByEntity[selectedEntity.id] || []) : []), [manualShipsByEntity, selectedEntity])

  const book = useMemo(() => buildContractorBook({
    entity: selectedEntity, movements: raw?.movements || [], prcs: raw?.prcs || [],
    laborLogs: raw?.laborLogs || [], rateCards: raw?.rateCards || [], closures: raw?.closures || [],
    workers: raw?.workers || [], ships: raw?.ships || [], workOrders: raw?.workOrders || [],
    thirdPartyCcData: raw?.thirdPartyCcData || null, manualShipIds, resumenSortMode,
  }), [selectedEntity, raw, manualShipIds, resumenSortMode])

  const effectiveTabId = (activeTabId === RESUMEN_TAB_ID || !book.rowsByTab[activeTabId]) ? RESUMEN_TAB_ID : activeTabId
  const activeTabLabel = effectiveTabId === RESUMEN_TAB_ID ? 'RESUMEN' : (book.shipTabs.find((t) => t.tabId === effectiveTabId)?.label || 'BARCO')
  const { baseRows, filteredRows, crossTabMatches } = useMemo(() => filterBookRowsAndCrossMatches({
    activeTabId: effectiveTabId, rowsByTab: book.rowsByTab, shipTabs: book.shipTabs, searchTerm, kpiFilter, onlyDebeFactura,
  }), [effectiveTabId, book.rowsByTab, book.shipTabs, searchTerm, kpiFilter, onlyDebeFactura])

  const tabKpis = useMemo(() => ({
    ...computeBookKpis(baseRows, book.shipTabs),
    openShipsCount: book.globalKpis.openShipsCount,
    settledShipsCount: book.globalKpis.settledShipsCount,
  }), [baseRows, book.shipTabs, book.globalKpis])

  const currency = selectedEntity?.currency || 'ARS'
  const periods = raw?.deductionsData?.availablePeriods || [selectedPeriod]
  const fortnightDollarRate = Number(raw?.deductionsData?.fortnightDollarRate) || 1500

  const contractorPendingPanol = useMemo(() => {
    if (!selectedEntity || selectedEntity.entityType === 'WORKSHOP_CC' || !raw?.deductionsData) return null
    const full = buildPendingPanolBatches(raw.deductionsData, raw.movements || [])
    const targetKey = normalizeContractorKey(selectedEntity.baseGroup)
    const pendingBatches = full.pendingBatches.filter((b) => normalizeContractorKey(b.contractorLabel) === targetKey)
    return pendingBatches.length ? { ...full, pendingBatches, pendingTotalArs: pendingBatches.reduce((s, b) => s + b.pendingTotalArs, 0) } : null
  }, [selectedEntity, raw])

  const contractorPrcs = useMemo(() => {
    if (!selectedEntity || selectedEntity.entityType === 'WORKSHOP_CC') return []
    const shipMap = new Map((raw?.ships || []).map((s) => [s.id, s]))
    return (raw?.prcs || [])
      .filter((p) => p.status !== 'ANULADO' && normalizeContractorKey(p.contractor_name) === normalizeContractorKey(selectedEntity.baseGroup))
      .map((p) => ({ ...p, shipName: shipMap.get(p.ship_id)?.name || '' }))
  }, [selectedEntity, raw])

  const handleSelectEntity = (nextId) => {
    setSelectedEntityId(nextId); setActiveTabId(RESUMEN_TAB_ID); setKpiFilter('todos'); setSearchTerm(''); setIsAddingInline(false); setEditingCell(null)
  }
  const handleAddShipTab = (shipId) => {
    if (!selectedEntity || !shipId) return
    setManualShipsByEntity((prev) => ({ ...prev, [selectedEntity.id]: Array.from(new Set([...(prev[selectedEntity.id] || []), shipId])) }))
    setActiveTabId(shipId)
  }
  const handleSaveInlineRow = async (draft) => {
    await saveInlineLedgerRowService({ entity: selectedEntity, draft, currentPeriod: selectedPeriod, fortnightDollarRate, prcs: raw?.prcs || [], actor })
    setIsAddingInline(false); showFeedback('ok', 'Renglón agregado al libro.'); await loadData({ silent: true })
  }
  const handleCommitEditCell = async () => {
    if (!editingCell) return
    const current = editingCell; setEditingCell(null)
    try {
      await patchInlineLedgerCellService({ entity: selectedEntity, row: current.row, field: current.field, value: current.value, fortnightDollarRate, actor })
      showFeedback('ok', 'Celda actualizada y registrada en auditoría.'); await loadData({ silent: true })
    } catch (err) { showFeedback('error', err?.message || 'No se pudo actualizar la celda.') }
  }
  const handleOpenNewModal = () => {
    if (!selectedEntity) return
    if (selectedEntity.entityType === 'WORKSHOP_CC') return setWsPayModal({ isOpen: true, editingPayment: null })
    const preShipId = effectiveTabId !== RESUMEN_TAB_ID && effectiveTabId !== GENERAL_SHIP_TAB_ID ? effectiveTabId : ''
    setCcModal({ isOpen: true, initialRow: null, presetInvoiceOnly: false, presetDefaults: { contractor_group: selectedEntity.baseGroup, ship_id: preShipId, period_key: selectedPeriod } })
  }
  const handleEditRow = (row) => {
    if (row.origin === 'WORKSHOP_PAYMENT' && row.rawPayment) return setWsPayModal({ isOpen: true, editingPayment: row.rawPayment })
    if (row.origin === 'CC_MOVEMENT' && row.rawMovement) return setCcModal({ isOpen: true, initialRow: row.rawMovement, presetInvoiceOnly: false, presetDefaults: null })
  }
  const handleDeleteRow = async (row) => {
    if (!window.confirm(`¿Eliminar "${row.concept}" por ${formatLedgerMoney(row.paidAmount || row.accruedAmount, currency)}?`)) return
    try { await deleteLedgerRowService({ row, actor }); showFeedback('ok', 'Registro eliminado del libro.'); await loadData({ silent: true }) }
    catch (err) { showFeedback('error', err?.message || 'Error al eliminar registro.') }
  }
  const handleAbsorbPanol = async (batch) => {
    if (!window.confirm(`¿Pasar ${batch.pendingCount} retiro(s) de Pañol (${selectedPeriod}) a ${batch.contractorLabel}?`)) return
    try {
      setAbsorbingKey(batch.contractorLabel)
      await absorbPanolBatchToCcService({ pendingBatch: batch, periodKey: selectedPeriod, periodEndDate: raw?.deductionsData?.range?.endDate, fortnightDollarRate, workers: raw?.workers || [], existingMovements: raw?.movements || [], actor })
      showFeedback('ok', `Pañol de ${batch.contractorLabel} pasado a su cuenta corriente.`); await loadData({ silent: true })
    } catch (err) { showFeedback('error', err?.message || 'Error al pasar Pañol.') } finally { setAbsorbingKey(null) }
  }

  const hasActiveFilters = Boolean(searchTerm || kpiFilter !== 'todos' || onlyDebeFactura)
  const clearAllFilters = () => { setSearchTerm(''); setKpiFilter('todos'); setOnlyDebeFactura(false) }
  const kpiCards = buildContratadosKpiCards({ tabKpis, activeTabLabel, currency, onGoToResumen: () => setActiveTabId(RESUMEN_TAB_ID) })

  return (
    <div className="space-y-3 font-sans pb-10">
      <TesoreriaContratadosHeader
        activeSubmodule={activeSubmodule} entities={entities} selectedEntity={selectedEntity} onSelectEntity={handleSelectEntity}
        selectedPeriod={selectedPeriod} periods={periods} onPeriodChange={onPeriodChange}
        canManageCc={canManageCc} loading={loading} onStartInlineRow={() => setIsAddingInline(true)}
        onOpenNewModal={handleOpenNewModal} onRefresh={() => loadData({ silent: false })}
        onExport={() => exportToSpreadsheet(buildLedgerExportPayload({ entity: selectedEntity, activeTabLabel, rows: filteredRows, currency }))}
      />
      {feedback && (
        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${feedback.type === 'error' ? 'bg-rose-950/80 border-rose-500/60 text-rose-200' : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'}`}>
          {feedback.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}
      <KpiRadar
        title={`TOTALES DE CUENTA · ${selectedEntity?.label || 'CONTRATISTA'} (${activeTabLabel})`}
        subtitle="Clic para filtrar por concepto · Saldo negativo = debe el astillero"
        cards={kpiCards} activeFilterId={kpiFilter}
        onCardClick={(id) => setKpiFilter((prev) => (prev === id || id === 'todos' ? 'todos' : id))}
      />
      {contractorPendingPanol && (
        <TesoreriaPanolPendingStrip
          pendingReport={contractorPendingPanol} periodKey={selectedPeriod} fortnightDollarRate={fortnightDollarRate}
          canManageCc={canManageCc} absorbingKey={absorbingKey} onAbsorbOne={handleAbsorbPanol}
        />
      )}
      <div className="alon-workspace-block">
        <CanonicalZone3Toolbar
          searchValue={searchTerm} onSearchChange={setSearchTerm} searchInputRef={searchRef}
          searchPlaceholder={`Buscar en ${selectedEntity?.label || 'contratista'}: barco, PRC, cheque, factura, remito Pañol, fecha...`}
          viewsController={viewsController} hasActiveFilters={hasActiveFilters} onClearAllFilters={clearAllFilters}
          counterText={`${filteredRows.length} de ${baseRows.length} renglones`}
          filters={(
            <>
              {effectiveTabId === RESUMEN_TAB_ID && (
                <div className={ZONE3_VIEW_TOGGLE_GROUP_CLASS} role="group" aria-label="Orden de RESUMEN">
                  <button type="button" onClick={() => setResumenSortMode('grouped')} className={getViewToggleButtonClass(resumenSortMode === 'grouped')}><Layers className="w-3 h-3" /><span>Por Barco</span></button>
                  <button type="button" onClick={() => setResumenSortMode('chronological')} className={getViewToggleButtonClass(resumenSortMode === 'chronological')}><Clock className="w-3 h-3" /><span>Cronológico</span></button>
                </div>
              )}
              <button type="button" onClick={() => setOnlyDebeFactura((p) => !p)} className={getFilterPillClass('status', onlyDebeFactura)}><FileWarning className="w-3.5 h-3.5" /><span>Solo DEBE FACTURA</span></button>
              {crossTabMatches.length > 0 && (
                <div className="flex items-center gap-1 flex-wrap text-[10px] text-cyan-200">
                  <span>También en:</span>
                  {crossTabMatches.map((m) => (
                    <button key={m.tabId} type="button" onClick={() => setActiveTabId(m.tabId)} className="px-2 py-0.5 rounded bg-cyan-950/90 border border-cyan-500/50 font-bold hover:bg-cyan-900 cursor-pointer">{m.label} ({m.count})</button>
                  ))}
                </div>
              )}
            </>
          )}
        />
        <TesoreriaContratadosBookTabs
          shipTabs={book.shipTabs} activeTabId={effectiveTabId} onSelectTab={setActiveTabId}
          globalBalance={book.globalKpis.currentBalance} currency={currency} ships={raw?.ships || []}
          canManageCc={canManageCc} onAddShipTab={handleAddShipTab}
        />
        <TesoreriaContratadosGrid
          entityLabel={selectedEntity?.label || ''} activeTabId={effectiveTabId} activeTabLabel={activeTabLabel}
          resumenSortMode={resumenSortMode} currency={currency} rows={filteredRows} totalCount={baseRows.length}
          resetKey={`${selectedEntity?.id}|${effectiveTabId}|${resumenSortMode}|${kpiFilter}|${onlyDebeFactura}|${searchTerm}`}
          searchTerm={searchTerm} hasActiveFilters={hasActiveFilters} onClearAllFilters={clearAllFilters}
          ships={raw?.ships || []} contractorPrcs={contractorPrcs} workOrders={raw?.workOrders || []} workItems={raw?.workItems || []}
          canManageCc={canManageCc} isAddingInline={isAddingInline} onStartInlineRow={() => setIsAddingInline(true)}
          onSaveInlineRow={handleSaveInlineRow} onCancelInlineRow={() => setIsAddingInline(false)}
          editingCell={editingCell} onStartEditCell={setEditingCell}
          onChangeEditValue={(val) => setEditingCell((prev) => (prev ? { ...prev, value: val } : null))}
          onCommitEditCell={handleCommitEditCell} onCancelEditCell={() => setEditingCell(null)}
          onEditRow={handleEditRow} onDeleteRow={handleDeleteRow}
          onQuickResolveInvoice={(row) => row.rawMovement && setCcModal({ isOpen: true, initialRow: row.rawMovement, presetInvoiceOnly: true, presetDefaults: null })}
        />
      </div>
      <TesoreriaContratadosModals
        ccModal={ccModal} onCloseCcModal={() => setCcModal({ isOpen: false, initialRow: null, presetInvoiceOnly: false, presetDefaults: null })}
        onSaveCcMovement={async ({ id, payload }) => {
          await saveContractorCcMovementService({ id, payload, prcs: raw?.prcs || [], actor })
          setCcModal({ isOpen: false, initialRow: null, presetInvoiceOnly: false, presetDefaults: null })
          showFeedback('ok', id ? 'Movimiento actualizado.' : 'Movimiento registrado en la cuenta corriente.')
          await loadData({ silent: true })
        }}
        wsPayModal={wsPayModal} onCloseWsModal={() => setWsPayModal({ isOpen: false, editingPayment: null })}
        onSaveWsPayment={async (formData, editingPayment) => {
          await saveCcPaymentService({ account: selectedEntity?.ccAccount, formData, editingPayment, actor, sourceModule: 'TESORERIA' })
          showFeedback('ok', 'Pago de taller registrado y sincronizado con Control Pampa.'); await loadData({ silent: true })
        }}
        selectedEntity={selectedEntity} selectedPeriod={selectedPeriod} periods={periods}
        fortnightDollarRate={fortnightDollarRate} entities={entities} prcs={raw?.prcs || []}
        ships={raw?.ships || []} workOrders={raw?.workOrders || []} macroVariables={raw?.macroVariables || []}
      />
    </div>
  )
}
