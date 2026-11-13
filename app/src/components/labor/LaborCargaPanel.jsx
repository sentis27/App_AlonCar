import React from 'react'
import { useLaborCargaCrewState } from '../../hooks/useLaborCargaCrewState.js'
import { useLaborCargaActions } from '../../hooks/useLaborCargaActions.js'
import { useLaborCargaGridState } from '../../hooks/useLaborCargaGridState.js'
import LaborCargaTopActions from './LaborCargaTopActions.jsx'
import LaborTabulatorPanel from './LaborTabulatorPanel.jsx'
import LaborCascadeHeader from './LaborCascadeHeader.jsx'
import LaborCrewGridSection from './LaborCrewGridSection.jsx'
import LaborLogsToolbar from './LaborLogsToolbar.jsx'
import LaborLogsTable from './LaborLogsTable.jsx'

export default function LaborCargaPanel({
  ships = [],
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
  handleDuplicateLog,
  handleDeleteLog,
  handleUpdateApprovalStatus,
  setReviewReasonModal,
  setShipPickerModal,
  setActiveTab,
  setDailyFilterType,
  setStatusMessage,
  user
}) {
  const crew = useLaborCargaCrewState({
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

  return (
    <div className="space-y-6">
      <LaborCargaTopActions
        isTabulatorOpen={actions.isTabulatorOpen}
        onToggleTabulator={() => actions.setIsTabulatorOpen(prev => !prev)}
        isMultiOtMode={actions.isMultiOtMode}
        onToggleMultiOtMode={() => actions.setIsMultiOtMode(prev => !prev)}
        onReplicateYesterday={actions.replicateYesterday}
      />

      {actions.isTabulatorOpen && (
        <LaborTabulatorPanel
          rawReportText={actions.rawReportText}
          setRawReportText={actions.setRawReportText}
          isTabulating={actions.isTabulating}
          tabulatorSummary={actions.tabulatorSummary}
          setTabulatorSummary={actions.setTabulatorSummary}
          operariosCount={crew.operariosRows.length}
          onConsolidateSameOtRows={actions.handleConsolidateSameOtRows}
          onTabulateMessage={actions.handleTabulateMessage}
        />
      )}

      <form onSubmit={actions.handleSubmitBatch} className="space-y-6">
        <LaborCascadeHeader
          ships={ships}
          selectedShipId={crew.selectedShipId}
          setSelectedShipId={crew.setSelectedShipId}
          selectedContractorGroup={crew.selectedContractorGroup}
          onContractorGroupChange={crew.handleContractorGroupChange}
          enabledContractorsForShip={crew.enabledContractorsForShip}
          selectedWorkOrderId={crew.selectedWorkOrderId}
          setSelectedWorkOrderId={crew.setSelectedWorkOrderId}
          availableWorkOrders={crew.availableWorkOrders}
          selectedWorkItemId={crew.selectedWorkItemId}
          setSelectedWorkItemId={crew.setSelectedWorkItemId}
          activeItemsForSelectedWo={crew.activeItemsForSelectedWo}
          dateLogged={crew.dateLogged}
          setDateLogged={crew.setDateLogged}
          workType={crew.workType}
          setWorkType={crew.setWorkType}
          blockedWorkItemsForShip={crew.blockedWorkItemsForShip}
          currentWorkOrder={crew.currentWorkOrder}
          currentWorkItem={crew.currentWorkItem}
        />

        <LaborCrewGridSection
          isMultiOtMode={actions.isMultiOtMode}
          isSelectedGroupAstillero={crew.isSelectedGroupAstillero}
          selectedContractorGroup={crew.selectedContractorGroup}
          operariosRows={crew.operariosRows}
          openRubroEmergencyIds={crew.openRubroEmergencyIds}
          draftWorkerSummary={crew.draftWorkerSummary}
          ships={ships}
          workOrders={workOrders}
          workItems={workItems}
          selectedShipId={crew.selectedShipId}
          selectedWorkOrderId={crew.selectedWorkOrderId}
          totalHorasNormales={crew.totalHorasNormales}
          totalHoras50={crew.totalHoras50}
          totalHoras100={crew.totalHoras100}
          totalHorasGenerales={crew.totalHorasGenerales}
          submitting={actions.submitting}
          onAddOperarioRow={crew.addOperarioRow}
          onUpdateRow={crew.updateOperarioRow}
          onRemoveRow={crew.removeOperarioRow}
          onToggleRubroEmergency={crew.toggleRubroEmergency}
          onResolveHomonym={crew.resolveHomonymCandidate}
        />
      </form>

      <div className="alon-workspace-block">
        <LaborLogsToolbar
          filterWorker={gridState.filterWorker}
          setFilterWorker={gridState.setFilterWorker}
          filterDate={gridState.filterDate}
          setFilterDate={gridState.setFilterDate}
          filterShip={gridState.filterShip}
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
          handleDuplicateLog={handleDuplicateLog}
          handleDeleteLog={handleDeleteLog}
          handleUpdateApprovalStatus={handleUpdateApprovalStatus}
          setReviewReasonModal={setReviewReasonModal}
          setActiveTab={setActiveTab}
          setDailyFilterType={setDailyFilterType}
        />
      </div>
    </div>
  )
}
