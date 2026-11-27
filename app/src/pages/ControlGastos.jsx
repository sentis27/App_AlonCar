import { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useModuleTab } from '../hooks/useModuleTab.js'
import { useCostControlState } from '../hooks/useCostControlState.js'
import CostControlHeaderAndRadar from '../components/costControl/CostControlHeaderAndRadar.jsx'
import CostControlMaterialsTable from '../components/costControl/CostControlMaterialsTable.jsx'
import CostControlHoursMirror from '../components/costControl/CostControlHoursMirror.jsx'
import CostControlLaborOnlyPanel from '../components/costControl/CostControlLaborOnlyPanel.jsx'
import ShipWorkOrderPickerModal from '../components/ShipWorkOrderPickerModal.jsx'

/**
 * Módulo Control de Gastos (GS-010 / DEC-025).
 * Arquetipo: CARGA_EDICION (Gallo).
 */
export default function ControlGastos() {
  const { activeTab, activeSubmodule } = useModuleTab('control-gastos')
  const [pickerModal, setPickerModal] = useState(null)
  const [hideMigrationBanner, setHideMigrationBanner] = useState(false)

  const state = useCostControlState({ pauseRealtime: Boolean(pickerModal) })
  const { snapshot, raw, warnings, filteredMaterialRows, focusedRow, activeContractorEntity } = state
  const kpis = snapshot?.kpis || {}

  const hasActiveFilters = Boolean(
    state.contractorFilter || state.shipFilter || state.statusFilter !== 'NO' || state.searchQuery
  )

  return (
    <div className="space-y-4 font-sans pb-8">
      {warnings.reviewsTableMissing && !hideMigrationBanner && (
        <div className="p-3 rounded-xl bg-amber-950/70 border border-amber-500/60 text-amber-200 text-xs flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              Falta aplicar la migración <code>supabase/migrations/0055_cost_control_reviews.sql</code> en Supabase para guardar excepciones y aprobaciones rápidas.
            </span>
          </div>
          <button
            type="button"
            onClick={() => setHideMigrationBanner(true)}
            className="px-2 py-0.5 rounded bg-amber-900/70 hover:bg-amber-800 text-[11px] font-bold cursor-pointer shrink-0"
          >
            Ocultar aviso
          </button>
        </div>
      )}

      {state.errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/60 text-rose-200 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{state.errorMsg}</span>
        </div>
      )}

      {state.feedbackMsg && (
        <div className="p-3 rounded-xl bg-emerald-950/70 border border-emerald-500/60 text-emerald-200 text-xs font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{state.feedbackMsg}</span>
        </div>
      )}

      <CostControlHeaderAndRadar
        activeTab={activeTab}
        activeSubmodule={activeSubmodule}
        periodKey={state.periodKey}
        quincenaOptions={state.quincenaOptions}
        onPeriodChange={state.handlePeriodChange}
        contractorFilter={state.contractorFilter}
        contractorOptions={state.contractorOptions}
        onContractorChange={state.setContractorFilter}
        shipFilter={state.shipFilter}
        shipOptions={state.shipOptions}
        onShipChange={state.setShipFilter}
        statusFilter={state.statusFilter}
        onStatusFilterChange={state.setStatusFilter}
        snapshot={snapshot}
        loading={state.loading}
        onReload={state.reload}
        onStepNextContractor={state.stepNextContractor}
      />

      {activeTab === 'conciliacion' ? (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
          <div className="xl:col-span-7 min-w-0">
            <CostControlMaterialsTable
              rows={filteredMaterialRows}
              totalCount={snapshot?.materialRows?.length || 0}
              ships={raw.ships}
              workOrders={raw.workOrders}
              workItems={raw.workItems}
              statusFilter={state.statusFilter}
              onStatusFilterChange={state.setStatusFilter}
              searchQuery={state.searchQuery}
              onSearchChange={state.setSearchQuery}
              hasActiveFilters={hasActiveFilters}
              onClearAllFilters={state.clearAllFilters}
              selectedTxIds={state.selectedTxIds}
              onToggleSelectTx={state.toggleSelectTx}
              onToggleSelectAll={state.toggleSelectAllVisible}
              onClearSelection={state.clearSelection}
              focusedRowId={focusedRow?.id || null}
              onFocusRow={state.setFocusedRowId}
              onOpenShipOtModal={setPickerModal}
              onBatchUpdate={state.updateMaterialsBatch}
              onValidateException={state.validateMaterialException}
              onRevokeReview={state.revokeReview}
              saving={state.saving}
            />
          </div>

          <div className="xl:col-span-5 min-w-0">
            <CostControlHoursMirror
              laborLogs={raw.laborLogs}
              workers={raw.workers}
              ships={raw.ships}
              workOrders={raw.workOrders}
              workItems={raw.workItems}
              snapshot={snapshot}
              activeContractorEntity={activeContractorEntity}
              focusedRow={focusedRow}
              selectedTxIds={state.selectedTxIds}
              saving={state.saving}
              onApplyShipOtToMaterials={({ txIds, shipId, workOrderId }) =>
                state.updateMaterialsBatch({ txIds, patch: { ship_id: shipId || null, work_order_id: workOrderId || null } })
              }
              onMoveDateToPrevQuincena={({ txIds, dateArIso }) =>
                state.updateMaterialsBatch({ txIds, patch: { dateArIso } })
              }
              onUpdateLaborLog={state.updateLaborLog}
              onSplitLaborLog={state.splitLaborLog}
              onOpenLaborShipOtModal={(log) => setPickerModal({ mode: 'labor', log })}
            />
          </div>
        </div>
      ) : (
        <CostControlLaborOnlyPanel
          laborOnlyRows={snapshot?.laborOnlyRows || []}
          thirdPartyMaterialRows={snapshot?.thirdPartyMaterialRows || []}
          kpis={kpis}
          ships={raw.ships}
          workOrders={raw.workOrders}
          workItems={raw.workItems}
          contractorFilter={state.contractorFilter}
          shipFilter={state.shipFilter}
          searchQuery={state.searchQuery}
          onSearchChange={state.setSearchQuery}
          onClearAllFilters={state.clearAllFilters}
          saving={state.saving}
          onApproveLaborOnly={state.approveLaborOnlyRow}
          onRevokeReview={state.revokeReview}
        />
      )}

      <ShipWorkOrderPickerModal
        isOpen={Boolean(pickerModal)}
        onClose={() => setPickerModal(null)}
        ships={raw.ships}
        workOrders={raw.workOrders}
        workItems={raw.workItems}
        currentShipId={
          pickerModal?.mode === 'single'
            ? (pickerModal.row?.shipId || '')
            : pickerModal?.mode === 'labor'
            ? (pickerModal.log?.ship_id || '')
            : ''
        }
        currentWorkOrderId={
          pickerModal?.mode === 'single'
            ? (pickerModal.row?.workOrderId || '')
            : pickerModal?.mode === 'labor'
            ? (pickerModal.log?.work_order_id || '')
            : ''
        }
        contractorName={
          pickerModal?.mode === 'single'
            ? (pickerModal.row?.entity || '')
            : pickerModal?.mode === 'labor'
            ? activeContractorEntity
            : state.contractorFilter
        }
        workerName={
          pickerModal?.mode === 'single'
            ? (pickerModal.row?.workerName || '')
            : pickerModal?.mode === 'labor'
            ? (pickerModal.log?.worker_name || '')
            : ''
        }
        title={
          pickerModal?.mode === 'batch'
            ? `Reasignar Buque y OT (${pickerModal.txIds?.length || 0} líneas)`
            : pickerModal?.mode === 'labor'
            ? 'Corregir Buque y OT en Parte de Horas'
            : 'Asignar Buque y Orden de Trabajo'
        }
        onSave={async ({ shipId, workOrderId }) => {
          if (pickerModal?.mode === 'labor' && pickerModal.log?.id) {
            await state.updateLaborLog({
              logId: pickerModal.log.id,
              patch: { ship_id: shipId || null, work_order_id: workOrderId || null },
              previousLog: pickerModal.log,
            })
            return
          }
          const txIds = pickerModal?.mode === 'batch' ? pickerModal.txIds : [pickerModal?.row?.id].filter(Boolean)
          await state.updateMaterialsBatch({
            txIds,
            patch: { ship_id: shipId || null, work_order_id: workOrderId || null },
          })
        }}
      />
    </div>
  )
}
