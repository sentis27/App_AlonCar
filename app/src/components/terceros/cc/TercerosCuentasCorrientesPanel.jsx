/**
 * TercerosCuentasCorrientesPanel.jsx
 * Submódulo "2. Cuentas Corrientes" (CARGA_EDICION · Libro en "T" DEBE/HABER) en 5 Zonas.
 */
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { CheckCircle2, AlertTriangle, Clock } from 'lucide-react'
import { useSupabaseRealtimeRefresh } from '../../../hooks/useSupabaseRealtimeRefresh'
import CanonicalZone3Toolbar from '../../canonical/CanonicalZone3Toolbar'
import { ENTITY_FILTER_THEMES } from '../../../lib/filterThemeConstants'
import { matchesUniversalSearch } from '../../../lib/searchEngine'
import { formatDateAr, getTodayArIso } from '../../../lib/dateTimeCanonical'
import { exportToSpreadsheet } from '../../../lib/exportEngine'
import { buildThirdPartyCcLedger } from '../../../lib/thirdPartyCcEngine'
import {
  fetchThirdPartyCcData, createCcAccountService, addCcRateHistoryService,
  updateCcCancellationModeService, saveCcEntryOverrideService, saveCcManualEntryService,
  deleteCcManualEntryService, saveCcPaymentService, deleteCcPaymentService,
} from '../../../services/thirdPartyCcService'
import TercerosCcHeaderAndKpis from './TercerosCcHeaderAndKpis'
import TercerosCcDebeTable from './TercerosCcDebeTable'
import TercerosCcHaberTable from './TercerosCcHaberTable'
import TercerosCcAccountModal from './TercerosCcAccountModal'
import TercerosCcPaymentModal from './TercerosCcPaymentModal'
import { TercerosCcRateHistoryModal, TercerosCcManualEntryModal } from './TercerosCcRateAndEntryModals'

const CC_REALTIME_TABLES = [
  'third_party_cc_accounts', 'third_party_cc_rate_history', 'third_party_cc_entries',
  'third_party_cc_payments', 'inventory_transactions', 'materials',
  'third_party_services', 'workers', 'macro_variables', 'work_orders', 'work_items', 'ships',
]

export default function TercerosCuentasCorrientesPanel({ activeSubmodule = null, canManageCc = false, actor = 'ADMIN' }) {
  const [rawData, setRawData] = useState({
    accounts: [], rateHistory: [], savedEntries: [], payments: [], panolRemitoTx: [],
    materials: [], thirdPartyServices: [], workOrders: [], workItems: [], ships: [], contractors: [], macroVariables: [],
  })
  const [selectedAccountId, setSelectedAccountId] = useState('')
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('todos')
  const [paymentTypeFilter, setPaymentTypeFilter] = useState('todos')
  const searchInputRef = useRef(null)

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)
  const [isRateModalOpen, setIsRateModalOpen] = useState(false)
  const [paymentModal, setPaymentModal] = useState({ isOpen: false, editing: null })
  const [manualEntryModal, setManualEntryModal] = useState({ isOpen: false, editing: null })

  const showFeedback = useCallback((type, text) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 4500)
  }, [])

  const loadData = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      const data = await fetchThirdPartyCcData()
      setRawData(data)
      setSelectedAccountId((prev) => (prev && data.accounts.some((a) => a.id === prev) ? prev : (data.accounts[0]?.id || '')))
    } catch (err) {
      showFeedback('error', 'Error cargando Cuentas Corrientes: ' + (err?.message || err))
    } finally {
      if (!silent) setLoading(false)
    }
  }, [showFeedback])

  useEffect(() => { loadData({ silent: false }) }, [loadData])
  useSupabaseRealtimeRefresh({
    channelName: 'terceros_cc_live', tables: CC_REALTIME_TABLES,
    onSync: () => loadData({ silent: true }),
    pauseWhen: Boolean(isAccountModalOpen || isRateModalOpen || paymentModal.isOpen || manualEntryModal.isOpen),
  })

  const selectedAccount = useMemo(() => rawData.accounts.find((a) => a.id === selectedAccountId) || rawData.accounts[0] || null, [rawData.accounts, selectedAccountId])
  const accountRateHistory = useMemo(() => rawData.rateHistory.filter((r) => r.account_id === selectedAccount?.id), [rawData.rateHistory, selectedAccount])
  const ledger = useMemo(() => buildThirdPartyCcLedger({
    account: selectedAccount, rateHistory: accountRateHistory,
    savedEntries: rawData.savedEntries.filter((e) => e.account_id === selectedAccount?.id),
    payments: rawData.payments.filter((p) => p.account_id === selectedAccount?.id),
    panolRemitoTx: rawData.panolRemitoTx, materials: rawData.materials,
    thirdPartyServices: rawData.thirdPartyServices, workOrders: rawData.workOrders, ships: rawData.ships,
  }), [selectedAccount, accountRateHistory, rawData])

  const filteredDebeRows = useMemo(() => ledger.debeRows.filter((row) => {
    if (statusFilter === 'pendientes' && row.isCancelled) return false
    if (statusFilter === 'cancelados' && !row.isCancelled) return false
    if (statusFilter === 'special' && !row.isSpecialRate) return false
    return !searchTerm || matchesUniversalSearch(row, searchTerm)
  }), [ledger.debeRows, statusFilter, searchTerm])

  const filteredHaberRows = useMemo(() => ledger.haberRows.filter((row) => {
    if (paymentTypeFilter !== 'todos' && row.payment_type !== paymentTypeFilter) return false
    return !searchTerm || matchesUniversalSearch(row, searchTerm)
  }), [ledger.haberRows, paymentTypeFilter, searchTerm])

  const hasActiveFilters = Boolean(searchTerm || statusFilter !== 'todos' || paymentTypeFilter !== 'todos')
  const clearAllFilters = () => { setSearchTerm(''); setStatusFilter('todos'); setPaymentTypeFilter('todos') }

  const handleSaveSpecialRate = async (row, nextRate, reason) => {
    try {
      const amountUsd = row.weightKg > 0 ? Number((row.weightKg * nextRate).toFixed(2)) : Number(row.amountUsd || 0)
      await saveCcEntryOverrideService({
        account: selectedAccount, row, actor,
        patch: { rate_usd_applied: nextRate, amount_usd: amountUsd, is_special_rate: true, special_rate_reason: reason || 'Ajuste especial a la tarifa' },
      })
      showFeedback('success', `Tarifa especial US$ ${nextRate}/kg aplicada al remito ${row.remitoNumber}.`)
      await loadData({ silent: true })
    } catch (err) { showFeedback('error', err.message) }
  }

  const handleToggleManualCancel = async (row) => {
    try {
      const nextCancel = !row.manualCancelled
      await saveCcEntryOverrideService({
        account: selectedAccount, row, actor,
        patch: { is_cancelled: nextCancel, cancelled_at: nextCancel ? new Date().toISOString() : null },
      })
      await loadData({ silent: true })
    } catch (err) { showFeedback('error', err.message) }
  }

  const handleExportCsv = () => {
    if (!selectedAccount) return
    const combined = [
      ...filteredDebeRows.map((r) => ({ lado: 'DEBE', fecha: formatDateAr(r.entryDate), referencia: `Remito ${r.remitoNumber}`, quincena_modalidad: r.quincenaLabel, kilos: r.weightKg, tarifa_usd: r.rateUsdApplied, debe_usd: r.amountUsd, haber_usd: 0, estado: r.isCancelled ? 'Cancelado' : 'Pendiente', detalle: r.description || r.specialRateReason || '' })),
      ...filteredHaberRows.map((p) => ({ lado: 'HABER', fecha: formatDateAr(p.payment_date), referencia: p.invoice_number || (p.panol_remito_number ? `Remito Pañol ${p.panol_remito_number}` : 'Pago'), quincena_modalidad: p.payment_type, kilos: '', tarifa_usd: p.exchange_rate || '', debe_usd: 0, haber_usd: p.amount_usd, estado: p.has_iva ? 'Neto s/IVA' : 'Imputado', detalle: p.observations || '' })),
    ]
    const slug = String(selectedAccount.legal_name || selectedAccount.operational_name || 'cuenta').toLowerCase().replace(/\s+/g, '_')
    exportToSpreadsheet({ filename: `cc_${slug}_${getTodayArIso()}`, rows: combined })
  }

  return (
    <div className="space-y-4 w-full pb-10">
      {feedback && (
        <div className={`p-3.5 rounded-xl border flex items-center justify-between ${feedback.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200' : 'bg-rose-950/90 border-rose-500/60 text-rose-200'}`}>
          <div className="flex items-center gap-2 text-xs font-bold">
            {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <AlertTriangle className="w-4 h-4 text-rose-400" />}
            <span>{feedback.text}</span>
          </div>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      <TercerosCcHeaderAndKpis
        activeSubmodule={activeSubmodule} accounts={rawData.accounts} selectedAccount={selectedAccount}
        onSelectAccount={setSelectedAccountId} totals={ledger.totals} statusFilter={statusFilter} setStatusFilter={setStatusFilter}
        canManageCc={canManageCc} onOpenNewAccount={() => setIsAccountModalOpen(true)} onOpenRateHistory={() => setIsRateModalOpen(true)}
        onOpenNewManualEntry={() => setManualEntryModal({ isOpen: true, editing: null })}
        onOpenNewPayment={() => setPaymentModal({ isOpen: true, editing: null })} onExportCsv={handleExportCsv}
      />

      <div className="alon-workspace-block">
        <CanonicalZone3Toolbar
          searchValue={searchTerm} onSearchChange={setSearchTerm} searchInputRef={searchInputRef}
          searchPlaceholder="Buscar remito, quincena, chapa, OT, factura, E-Cheq u observaciones... (Ctrl+F)"
          hasActiveFilters={hasActiveFilters} onClearAllFilters={clearAllFilters}
          counterText={`${filteredDebeRows.length} DEBE · ${filteredHaberRows.length} HABER`}
          filters={(
            <>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className={`border rounded-lg px-2.5 py-1 text-xs focus:outline-none ${statusFilter !== 'todos' ? ENTITY_FILTER_THEMES.status.active : ENTITY_FILTER_THEMES.status.inactive}`}>
                <option value="todos">Estado DEBE: Todos</option>
                <option value="pendientes">Solo Pendientes</option>
                <option value="cancelados">Solo Cancelados (Verdes)</option>
                <option value="special">Solo Tarifa Especial (Azul)</option>
              </select>
              <select value={paymentTypeFilter} onChange={(e) => setPaymentTypeFilter(e.target.value)} className={`border rounded-lg px-2.5 py-1 text-xs focus:outline-none ${paymentTypeFilter !== 'todos' ? ENTITY_FILTER_THEMES.modality.active : ENTITY_FILTER_THEMES.modality.inactive}`}>
                <option value="todos">Pagos HABER: Todos</option>
                <option value="EFECTIVO_USD">Efectivo US$</option>
                <option value="TRANSFERENCIA_ARS">Transferencia AR$</option>
                <option value="ECHEQ_ARS">E-Cheq AR$</option>
                <option value="COMPENSACION_PANOL">Remito Pañol</option>
                <option value="COMPENSACION_TRABAJO">Canje Trabajo</option>
              </select>
              {selectedAccount && canManageCc && (
                <button
                  type="button"
                  onClick={async () => { await updateCcCancellationModeService({ account: selectedAccount, cancellationMode: selectedAccount.cancellation_mode === 'FIFO' ? 'MANUAL' : 'FIFO', actor }); await loadData({ silent: true }) }}
                  className="px-2.5 py-1 rounded-lg bg-slate-950 border border-emerald-700/60 text-emerald-300 text-xs font-bold hover:border-emerald-400 cursor-pointer"
                  title="Alternar entre marcado automático FIFO de remitos pagados o tilde manual"
                >
                  Cancelados: {selectedAccount.cancellation_mode === 'MANUAL' ? 'Manual' : 'FIFO Auto'}
                </button>
              )}
            </>
          )}
        />

        {loading ? (
          <div className="p-12 text-center text-slate-400 bg-slate-900/40 rounded-2xl border border-slate-800">
            <Clock className="w-7 h-7 animate-spin mx-auto text-emerald-400 mb-2" />
            <p className="text-xs font-bold">Sincronizando Libro en T de Cuenta Corriente...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-3">
            <div className="xl:col-span-6">
              <TercerosCcDebeTable
                rows={filteredDebeRows} resetKey={`${selectedAccount?.id}|${statusFilter}|${searchTerm}`} searchTerm={searchTerm}
                cancellationMode={selectedAccount?.cancellation_mode || 'FIFO'} pricingMode={selectedAccount?.pricing_mode || 'PER_KG'}
                workOrders={rawData.workOrders} workItems={rawData.workItems} ships={rawData.ships} canManageCc={canManageCc}
                onSaveSpecialRate={handleSaveSpecialRate} onToggleManualCancel={handleToggleManualCancel}
                onEditManualEntry={(row) => setManualEntryModal({ isOpen: true, editing: row })}
                onDeleteManualEntry={async (row) => { if (!window.confirm(`¿Eliminar ajuste manual "${row.remitoNumber}"?`)) return; await deleteCcManualEntryService({ entry: row, actor }); showFeedback('success', 'Ajuste DEBE eliminado.'); await loadData({ silent: true }) }}
              />
            </div>
            <div className="xl:col-span-6">
              <TercerosCcHaberTable
                rows={filteredHaberRows} resetKey={`${selectedAccount?.id}|${paymentTypeFilter}|${searchTerm}`} canManageCc={canManageCc}
                onEditPayment={(p) => setPaymentModal({ isOpen: true, editing: p })}
                onDeletePayment={async (p) => { if (!window.confirm(`¿Eliminar pago de US$ ${p.amount_usd}?`)) return; await deleteCcPaymentService({ payment: p, actor }); showFeedback('success', 'Pago del HABER eliminado.'); await loadData({ silent: true }) }}
              />
            </div>
          </div>
        )}
      </div>

      <TercerosCcAccountModal
        isOpen={isAccountModalOpen} onClose={() => setIsAccountModalOpen(false)} contractors={rawData.contractors} existingAccounts={rawData.accounts}
        onSave={async (fd) => { const created = await createCcAccountService({ formData: fd, contractors: rawData.contractors, actor }); await loadData({ silent: true }); setSelectedAccountId(created.id); showFeedback('success', `Cuenta Corriente ${created.legal_name || created.operational_name} creada.`) }}
      />
      <TercerosCcPaymentModal
        isOpen={paymentModal.isOpen} onClose={() => setPaymentModal({ isOpen: false, editing: null })} account={selectedAccount} editingPayment={paymentModal.editing} macroVariables={rawData.macroVariables}
        onSave={async (fd, editing) => { await saveCcPaymentService({ account: selectedAccount, formData: fd, editingPayment: editing, actor }); showFeedback('success', editing ? 'Pago actualizado.' : 'Pago registrado en HABER.'); await loadData({ silent: true }) }}
      />
      <TercerosCcRateHistoryModal
        isOpen={isRateModalOpen} onClose={() => setIsRateModalOpen(false)} account={selectedAccount} rateHistory={accountRateHistory}
        onAddRate={async (payload) => { await addCcRateHistoryService({ account: selectedAccount, ...payload, actor }); showFeedback('success', `Nueva tarifa US$ ${payload.rateUsdPerKg}/kg vigente desde ${formatDateAr(payload.effectiveFrom)}.`); await loadData({ silent: true }) }}
      />
      <TercerosCcManualEntryModal
        isOpen={manualEntryModal.isOpen} onClose={() => setManualEntryModal({ isOpen: false, editing: null })} account={selectedAccount} editingEntry={manualEntryModal.editing}
        onSave={async (fd, editing) => { await saveCcManualEntryService({ account: selectedAccount, formData: fd, editingEntry: editing, actor }); showFeedback('success', 'Asiento manual guardado en DEBE.'); await loadData({ silent: true }) }}
      />
    </div>
  )
}
