import React from 'react'
import { useLaborCargaCrewState } from '../../hooks/useLaborCargaCrewState.js'
import { useLaborCargaActions } from '../../hooks/useLaborCargaActions.js'
import { useLaborCargaGridState } from '../../hooks/useLaborCargaGridState.js'
import LaborLogsToolbar from './LaborLogsToolbar.jsx'
import LaborLogsTable from './LaborLogsTable.jsx'
import LaborTextMessageModal from './LaborTextMessageModal.jsx'
import LaborCrewBatchModal from './LaborCrewBatchModal.jsx'
import LaborFacialClockModal from './LaborFacialClockModal.jsx'
import ContractorPickerModal from '../ContractorPickerModal.jsx'

export default function LaborCargaPanel({
  ships = [],
  shipStays = [],
  workOrders = [],
  workItems = [],
  dbWorkers = [],
  recentLogs = [],
  setRecentLogs,
  fetchData,
  selectedLogIds = new Set(),
  setSelectedLogIds,
  toggleSelectLog,
  toggleSelectAllLogs,
  activeKpiFilter,
  setActiveKpiFilter,
  handleEditFromDaily,
  handleDeleteLog,
  handleUpdateApprovalStatus,
  setReviewReasonModal,
  setShipPickerModal,
  setActiveTab,
  setDailyFilterType,
  statusMessage,
  setStatusMessage,
  activeLoadModal = null,
  setActiveLoadModal,
  user
}) {
  const crew = useLaborCargaCrewState({
    ships,
    workOrders,
    workItems,
    dbWorkers
  })

  const actions = useLaborCargaActions({
    ships,
    workOrders,
    workItems,
    dbWorkers,
    fetchData,
    setStatusMessage,
    user,
    crew
  })

  const gridState = useLaborCargaGridState({
    ships,
    workOrders,
    workItems,
    dbWorkers,
    recentLogs,
    setRecentLogs,
    fetchData,
    selectedLogIds,
    activeKpiFilter,
    setActiveKpiFilter,
    setShipPickerModal,
    setStatusMessage,
    user
  })

  const cModal = gridState.contractorPickerModal

  return (
    <div className="space-y-3">
      {/* ZONA 3 + ZONA 4 UNIFICADAS (Estilo Google Sheets al tope de la pantalla) */}
      <div className="alon-workspace-block">
        <LaborLogsToolbar
          ships={ships}
          workOrders={workOrders}
          workItems={workItems}
          filterWorker={gridState.filterWorker}
          setFilterWorker={gridState.setFilterWorker}
          filterDate={gridState.filterDate}
          setFilterDate={gridState.setFilterDate}
          filterShip={gridState.filterShip}
          setFilterShip={gridState.setFilterShip}
          filterOt={gridState.filterOt}
          setFilterOt={gridState.setFilterOt}
          filterContractor={gridState.filterContractor}
          setFilterContractor={gridState.setFilterContractor}
          filterRubro={gridState.filterRubro}
          setFilterRubro={gridState.setFilterRubro}
          filterModality={gridState.filterModality}
          setFilterModality={gridState.setFilterModality}
          contractorOptions={gridState.contractorOptions}
          rubroOptions={gridState.rubroOptions}
          hasActiveFilters={gridState.hasActiveFilters}
          activeKpiFilter={activeKpiFilter}
          onClearAllFilters={gridState.clearAllFilters}
          logSearchInputRef={gridState.logSearchInputRef}
          filteredCount={gridState.filteredLogs.length}
          totalCount={recentLogs.length}
          canUndo={gridState.horasGrid.canUndo}
          canRedo={gridState.horasGrid.canRedo}
          onUndo={gridState.horasGrid.undo}
          onRedo={gridState.horasGrid.redo}
        />

        <LaborLogsTable
          filteredLogs={gridState.filteredLogs}
          recentLogs={recentLogs}
          selectedLogIds={selectedLogIds}
          setSelectedLogIds={setSelectedLogIds}
          toggleSelectLog={toggleSelectLog}
          toggleSelectAllLogs={toggleSelectAllLogs}
          activeKpiFilter={activeKpiFilter}
          hasActiveFilter={gridState.hasActiveFilters}
          filterWorker={gridState.filterWorker}
          filterDate={gridState.filterDate}
          filterShip={gridState.filterShip}
          inlineLogEdit={gridState.inlineLogEdit}
          setInlineLogEdit={gridState.setInlineLogEdit}
          horasGrid={gridState.horasGrid}
          getHorasCellProps={gridState.getHorasCellProps}
          activateHorasCell={gridState.activateHorasCell}
          saveInlineLogEdit={gridState.saveInlineLogEdit}
          handleInsertRow={gridState.handleInsertRow}
          clearAllFilters={gridState.clearAllFilters}
          hoursStats={gridState.hoursStats}
          menuTarget={gridState.menuTarget}
          openMenu={gridState.openMenu}
          closeMenu={gridState.closeMenu}
          handleEditFromDaily={handleEditFromDaily}
          handleDuplicateLog={gridState.handleDuplicateRow}
          handleDeleteLog={handleDeleteLog}
          handleUpdateApprovalStatus={handleUpdateApprovalStatus}
          setReviewReasonModal={setReviewReasonModal}
          setActiveTab={setActiveTab}
          setDailyFilterType={setDailyFilterType}
        />
      </div>

      {/* MODALES DE CARGA DESDE ZONA 1 */}
      <LaborTextMessageModal
        isOpen={activeLoadModal === 'texto'}
        onClose={() => setActiveLoadModal?.(null)}
        crew={crew}
        actions={actions}
        ships={ships}
        workOrders={workOrders}
        workItems={workItems}
        statusMessage={statusMessage}
        onClearStatusMessage={() => setStatusMessage?.(null)}
      />

      <LaborCrewBatchModal
        isOpen={activeLoadModal === 'cuadrilla'}
        onClose={() => setActiveLoadModal?.(null)}
        crew={crew}
        actions={actions}
        ships={ships}
        workOrders={workOrders}
        workItems={workItems}
        statusMessage={statusMessage}
        onClearStatusMessage={() => setStatusMessage?.(null)}
      />

      <LaborFacialClockModal
        isOpen={activeLoadModal === 'reloj'}
        onClose={() => setActiveLoadModal?.(null)}
        ships={ships}
        shipStays={shipStays}
        workOrders={workOrders}
        workItems={workItems}
        dbWorkers={dbWorkers}
        recentLogs={recentLogs}
        fetchData={fetchData}
        setStatusMessage={setStatusMessage}
        user={user}
      />

      {/* DISPARADOR CANÓNICO 2: PICKER DE OPERARIO / CONTRATISTA POR BUQUE Y OT */}
      <ContractorPickerModal
        isOpen={cModal.isOpen}
        onClose={() => gridState.setContractorPickerModal({
          isOpen: false, logId: null, currentValue: '', shipId: '', shipName: '', workOrderId: '', workOrderTitle: '', isOtBlank: true
        })}
        currentValue={cModal.currentValue}
        shipName={cModal.shipName}
        workOrderTitle={cModal.workOrderTitle}
        isOtBlank={cModal.isOtBlank}
        astilleroWorkers={gridState.contractorPickerOptions.astilleroWorkers}
        contractorGroups={gridState.contractorPickerOptions.contractorGroups}
        onSelect={(selectedName) => {
          if (cModal.logId) {
            gridState.saveInlineLogEdit(cModal.logId, 'worker_name', selectedName)
          }
        }}
      />
    </div>
  )
}
