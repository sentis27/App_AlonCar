import { useComprasPedidosState } from '../../hooks/useComprasPedidosState'
import ComprasKpiRadar from './ComprasKpiRadar'
import ComprasPedidosToolbar from './ComprasPedidosToolbar'
import ComprasPedidosTable from './ComprasPedidosTable'
import ComprasPedidosStatusBar from './ComprasPedidosStatusBar'
import ComprasPedidosModals from './ComprasPedidosModals'

export default function ComprasPedidosPanel(props) {
  const {
    purchaseOrders,
    setPurchaseOrders,
    suppliers,
    materials,
    ships,
    workOrders,
    workItems,
    workers,
    documents,
    setDocuments,
    systemSettings,
    contractorGroups,
    astilleroWorkers,
    currentFortnight,
    viewMode,
    isSupervisorOrAdmin,
    showFeedbackMsg,
    showOrderModal,
    setShowOrderModal,
    editingOrder,
    setEditingOrder
  } = props

  const state = useComprasPedidosState(props)
  const { filters, selection, modals } = state

  return (
    <>
      <ComprasKpiRadar
        kpis={state.kpis}
        activeKpiFilter={filters.activeKpiFilter}
        onToggleKpiFilter={filters.toggleKpiFilter}
        onClearKpiFilter={() => filters.setActiveKpiFilter(null)}
      />

      <div className="alon-workspace-block">
        <ComprasPedidosToolbar
          searchQuery={filters.searchQuery}
          setSearchQuery={filters.setSearchQuery}
          searchInputRef={filters.searchInputRef}
          onClearAllFilters={filters.clearAllFilters}
          viewMode={viewMode}
          filterSupplier={filters.filterSupplier}
          setFilterSupplier={filters.setFilterSupplier}
          suppliers={suppliers}
          filterStatus={filters.filterStatus}
          setFilterStatus={filters.setFilterStatus}
          filterFortnight={filters.filterFortnight}
          setFilterFortnight={filters.setFilterFortnight}
          availableFortnights={state.availableFortnights}
          currentFortnight={currentFortnight}
          filterChargeType={filters.filterChargeType}
          setFilterChargeType={filters.setFilterChargeType}
          filterNewOnly={filters.filterNewOnly}
          setFilterNewOnly={filters.setFilterNewOnly}
          newMaterialsCount={state.kpis.newMaterialsCount}
          hideReconciled={filters.hideReconciled}
          setHideReconciled={filters.setHideReconciled}
          localPendingCount={state.localPendingCount}
          onOpenMandados={() => {
            modals.setMandadosPreselectedIds([])
            modals.setShowMandadosModal(true)
          }}
          canUndo={state.grid.canUndo}
          onUndo={state.grid.undo}
          canRedo={state.grid.canRedo}
          onRedo={state.grid.redo}
        />

        <ComprasPedidosTable
          filteredOrders={state.filteredOrders}
          materials={materials}
          suppliers={suppliers}
          ships={ships}
          workOrders={workOrders}
          documents={documents}
          searchQuery={filters.searchQuery}
          viewMode={viewMode}
          isSupervisorOrAdmin={isSupervisorOrAdmin}
          grid={state.grid}
          getSpreadsheetCellProps={state.getSpreadsheetCellProps}
          selectedOrderIds={selection.selectedOrderIds}
          isAllFilteredSelected={selection.isAllFilteredSelected}
          toggleSelectAll={selection.toggleSelectAll}
          toggleSelectRow={selection.toggleSelectRow}
          inlineEdit={state.inlineEdit}
          setInlineEdit={state.setInlineEdit}
          rowMenuTarget={state.rowMenuTarget}
          setRowMenuTarget={state.setRowMenuTarget}
          activateComprasCell={state.activateComprasCell}
          saveInlineEdit={state.saveInlineEdit}
          saveInlineMaterialAndObs={state.saveInlineMaterialAndObs}
          handleQuickStatusChange={state.handleQuickStatusChange}
          handleCycleUrgency={state.handleCycleUrgency}
          handleAddNewBlankOrder={state.handleAddNewBlankOrder}
          handleInsertOrderContext={state.handleInsertOrderContext}
          handleDuplicateOrder={state.handleDuplicateOrder}
          handleDeleteOrder={state.handleDeleteOrder}
          onOpenNewMaterial={(po) => { modals.setPendingMaterialOrder(po); modals.setShowNewMaterialModal(true) }}
          onOpenDocs={(po) => { modals.setSelectedOrderForDocs(po); modals.setShowOrderDocsModal(true) }}
          onOpenReconcile={(target) => { modals.setReconcileTarget(target); modals.setShowReconcileModal(true) }}
          onOpenFreight={(po) => { modals.setFreightTargetOrder(po); modals.setShowFreightModal(true) }}
          onOpenSupplierHelper={(po) => { modals.setSupplierHelperTarget(po); modals.setShowSupplierHelperModal(true) }}
          onEditOrder={(po) => { setEditingOrder(po); setShowOrderModal(true) }}
        />
      </div>

      <ComprasPedidosStatusBar
        filteredCount={state.filteredOrders.length}
        totalCount={purchaseOrders.length}
        hasActiveFilters={filters.hasActiveFilters}
        onClearFilters={filters.clearAllFilters}
        selectionStats={state.grid.selectionStats}
        onClearGridSelection={() => state.grid.setSelectionRange(null)}
        selectedOrderIds={selection.selectedOrderIds}
        onClearSelectedOrders={() => selection.setSelectedOrderIds(new Set())}
        viewMode={viewMode}
        stats={state.stats}
        purchaseOrders={purchaseOrders}
        suppliers={suppliers}
        batchTargetStatus={selection.batchTargetStatus}
        setBatchTargetStatus={selection.setBatchTargetStatus}
        onOpenBatchWhatsApp={() => modals.setShowBatchOrderModal(true)}
        onOpenAssignSupplier={() => modals.setShowAssignSupplierModal(true)}
        onBatchDismissCatalogAlta={state.handleBatchDismissCatalogAlta}
        onOpenReconcileSelected={(target) => { modals.setReconcileTarget(target); modals.setShowReconcileModal(true) }}
        onOpenMandadosSelected={() => {
          modals.setMandadosPreselectedIds(Array.from(selection.selectedOrderIds))
          modals.setShowMandadosModal(true)
        }}
        onBatchStatusApply={state.handleBatchStatusApply}
      />

      <ComprasPedidosModals
        purchaseOrders={purchaseOrders}
        setPurchaseOrders={setPurchaseOrders}
        suppliers={suppliers}
        materials={materials}
        ships={ships}
        workOrders={workOrders}
        workItems={workItems}
        workers={workers}
        documents={documents}
        setDocuments={setDocuments}
        systemSettings={systemSettings}
        contractorGroups={contractorGroups}
        astilleroWorkers={astilleroWorkers}
        currentFortnight={currentFortnight}
        viewMode={viewMode}
        isSupervisorOrAdmin={isSupervisorOrAdmin}
        showOrderModal={showOrderModal}
        setShowOrderModal={setShowOrderModal}
        editingOrder={editingOrder}
        modals={modals}
        selectedOrderIds={selection.selectedOrderIds}
        setSelectedOrderIds={selection.setSelectedOrderIds}
        pushUndoAction={state.pushUndoAction}
        saveInlineEdit={state.saveInlineEdit}
        handleApplySupplierHelper={state.handleApplySupplierHelper}
        handleNewMaterialSuccess={state.handleNewMaterialSuccess}
        handleReconcileSuccess={state.handleReconcileSuccess}
        handleFreightSuccess={state.handleFreightSuccess}
        handleShipWorkOrderSave={state.handleShipWorkOrderSave}
        showFeedbackMsg={showFeedbackMsg}
      />
    </>
  )
}
