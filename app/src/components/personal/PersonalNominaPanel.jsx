import { Plus, Trash2, X, Building2, Settings } from 'lucide-react'
import GridStatusBarBottom from '../GridStatusBarBottom'
import GridContextMenu from '../GridContextMenu'
import { usePersonalNominaState } from '../../hooks/usePersonalNominaState'
import { usePersonalNominaActions } from '../../hooks/usePersonalNominaActions'
import PersonalNominaKpiRadar from './PersonalNominaKpiRadar'
import PersonalNominaGroupsView from './PersonalNominaGroupsView'
import PersonalNominaToolbar from './PersonalNominaToolbar'
import PersonalNominaTable from './PersonalNominaTable'
import PersonalAuxModals from './PersonalAuxModals'
import PersonalWorkerFormModal from './PersonalWorkerFormModal'

export default function PersonalNominaPanel({
  workers = [],
  setWorkers,
  reloadWorkers,
  dollarRate = 1500,
  rateAyudante = 14595.84,
  rateMedioOficial = 15069.14,
  rateOficial = 16365.76
}) {
  const state = usePersonalNominaState({ workers, dollarRate, rateOficial })
  const actions = usePersonalNominaActions({ workers, setWorkers, reloadWorkers, dollarRate, state })

  const {
    statusMessage, setStatusMessage,
    kpiFilter, setKpiFilter,
    isAddTradeModalOpen, setIsAddTradeModalOpen,
    newTradeInput, setNewTradeInput,
    setTargetWorkerForNewTrade,
    orgRoles, isRolesModalOpen, setIsRolesModalOpen,
    rolesFormData, setRolesFormData, savingRoles,
    searchTerm, setSearchTerm,
    filterCenter, setFilterCenter,
    filterStatus, setFilterStatus,
    filterGroup, setFilterGroup,
    filterForemanOnly, setFilterForemanOnly,
    editingWorker, setEditingWorker,
    isNewModalOpen, setIsNewModalOpen,
    showGroupsView, setShowGroupsView,
    savingWorker, isCustomGroup, setIsCustomGroup,
    customGroupName, setCustomGroupName,
    formData, setFormData,
    contextMenuTarget, setContextMenuTarget,
    inlineCellEdit, setInlineCellEdit,
    nominaSearchInputRef,
    uniqueWorkGroups, availableContractorGroups, availableTallerGroups,
    uniqueTrades, kpiStats, filteredWorkers, groupedSummary, centerCounts,
    clearAllFilters, hasActiveFilters,
    handleAdminCenterChange, handleOpenNew, handleEdit
  } = state

  const {
    nominaGrid,
    commitInlineWorkerEdit,
    handleSaveSubmit,
    toggleWorkerStatus,
    toggleWorkerPermission,
    handleDelete,
    handleBatchToggleStatus,
    handleBatchDeleteWorkers,
    handleDuplicateWorkerRow,
    handleSaveRolesSubmit,
    handleAddTradeSubmit
  } = actions

  const openAddTradeModal = (workerTarget = null) => {
    setTargetWorkerForNewTrade(workerTarget)
    setNewTradeInput('')
    setIsAddTradeModalOpen(true)
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {statusMessage && (
        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between shadow-lg ${
          statusMessage.type === 'error'
            ? 'bg-rose-950/90 border-rose-500 text-rose-200'
            : statusMessage.type === 'info'
            ? 'bg-cyan-950/90 border-cyan-500 text-cyan-200'
            : 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
        }`}>
          <span>{statusMessage.text}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      <PersonalNominaKpiRadar
        kpiStats={kpiStats}
        kpiFilter={kpiFilter}
        setKpiFilter={setKpiFilter}
        dollarRate={dollarRate}
        rateOficial={rateOficial}
        rateMedioOficial={rateMedioOficial}
        rateAyudante={rateAyudante}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGroupsView(!showGroupsView)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
              showGroupsView
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-950/40'
                : 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-cyan-800/60'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>{showGroupsView ? 'Ver Grilla Detallada de Personas' : `Ver por Grupos de Trabajo (${uniqueWorkGroups.length})`}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRolesFormData(orgRoles)
              setIsRolesModalOpen(true)
            }}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Administrar Puestos y Titulares Organizacionales"
          >
            <Settings className="w-3.5 h-3.5 text-emerald-400" />
            <span>Puestos Organizacionales</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleOpenNew}
          className="px-4 py-2 bg-gradient-to-r from-primary to-blue-600 hover:brightness-110 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Cargar Operario / Contratista</span>
        </button>
      </div>

      {showGroupsView && (
        <PersonalNominaGroupsView
          groupedSummary={groupedSummary}
          onSelectGroup={(name) => {
            setFilterGroup(name)
            setShowGroupsView(false)
          }}
          onClose={() => setShowGroupsView(false)}
        />
      )}

      <div className="alon-workspace-block">
        <PersonalNominaToolbar
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          clearAllFilters={clearAllFilters}
          nominaSearchInputRef={nominaSearchInputRef}
          filterCenter={filterCenter}
          setFilterCenter={setFilterCenter}
          filterGroup={filterGroup}
          setFilterGroup={setFilterGroup}
          filterForemanOnly={filterForemanOnly}
          setFilterForemanOnly={setFilterForemanOnly}
          filterStatus={filterStatus}
          setFilterStatus={setFilterStatus}
          centerCounts={centerCounts}
          canUndo={nominaGrid.canUndo}
          onUndo={nominaGrid.undo}
          canRedo={nominaGrid.canRedo}
          onRedo={nominaGrid.redo}
          uniqueTrades={uniqueTrades}
          groupedSummary={groupedSummary}
        />

        <PersonalNominaTable
          nominaGrid={nominaGrid}
          filteredWorkers={filteredWorkers}
          dollarRate={dollarRate}
          searchTerm={searchTerm}
          uniqueTrades={uniqueTrades}
          inlineCellEdit={inlineCellEdit}
          setInlineCellEdit={setInlineCellEdit}
          commitInlineWorkerEdit={commitInlineWorkerEdit}
          contextMenuTarget={contextMenuTarget}
          setContextMenuTarget={setContextMenuTarget}
          onOpenNew={handleOpenNew}
          onOpenAddTradeModal={openAddTradeModal}
          onToggleStatus={toggleWorkerStatus}
          onTogglePermission={toggleWorkerPermission}
          onEdit={handleEdit}
          onDuplicate={handleDuplicateWorkerRow}
          onDelete={handleDelete}
        />
      </div>

      <GridStatusBarBottom
        filteredCount={filteredWorkers.length}
        totalCount={workers.length}
        entityName="operarios"
        hasActiveFilter={hasActiveFilters}
        onClearFilters={clearAllFilters}
        selectionStats={nominaGrid.selectionStats}
        onClearSelection={() => nominaGrid.setSelectionRange(null)}
        customSelection={
          nominaGrid.selectedRowIds.size > 0
            ? {
                count: nominaGrid.selectedRowIds.size,
                label: `${nominaGrid.selectedRowIds.size} operario(s) seleccionado(s)`,
                onClear: nominaGrid.clearSelectedRows
              }
            : null
        }
        extraActions={
          nominaGrid.selectedRowIds.size > 0 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBatchToggleStatus}
                className="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Cambiar Estado (Activo/Inactivo)</span>
              </button>
              <button
                type="button"
                onClick={handleBatchDeleteWorkers}
                className="px-2.5 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-500/60 text-rose-300 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Eliminar Selección</span>
              </button>
            </div>
          ) : null
        }
        globalAggregates={[
          { label: 'Activos', value: centerCounts.activeCount, highlight: true },
          { label: 'Astillero', value: centerCounts.astilleroCount },
          { label: 'Contratistas', value: centerCounts.contratistasCount },
          { label: 'Jefes Obra', value: centerCounts.foremenCount }
        ]}
      />

      <PersonalAuxModals
        isAddTradeModalOpen={isAddTradeModalOpen}
        setIsAddTradeModalOpen={setIsAddTradeModalOpen}
        newTradeInput={newTradeInput}
        setNewTradeInput={setNewTradeInput}
        onAddTradeSubmit={handleAddTradeSubmit}
        isRolesModalOpen={isRolesModalOpen}
        setIsRolesModalOpen={setIsRolesModalOpen}
        rolesFormData={rolesFormData}
        setRolesFormData={setRolesFormData}
        savingRoles={savingRoles}
        onSaveRolesSubmit={handleSaveRolesSubmit}
      />

      <PersonalWorkerFormModal
        isOpen={Boolean(isNewModalOpen || editingWorker)}
        editingWorker={editingWorker}
        onClose={() => { setIsNewModalOpen(false); setEditingWorker(null) }}
        onSubmit={handleSaveSubmit}
        savingWorker={savingWorker}
        formData={formData}
        setFormData={setFormData}
        onAdminCenterChange={handleAdminCenterChange}
        isCustomGroup={isCustomGroup}
        setIsCustomGroup={setIsCustomGroup}
        customGroupName={customGroupName}
        setCustomGroupName={setCustomGroupName}
        availableContractorGroups={availableContractorGroups}
        availableTallerGroups={availableTallerGroups}
        uniqueTrades={uniqueTrades}
        dollarRate={dollarRate}
        onOpenAddTradeModal={() => openAddTradeModal(null)}
      />

      {contextMenuTarget && (
        <GridContextMenu
          target={contextMenuTarget}
          onClose={() => setContextMenuTarget(null)}
          onCopyCell={nominaGrid.copyActiveCell}
          onCopyRow={nominaGrid.copyRow}
          onPaste={nominaGrid.pasteToActiveOrRange}
          onDeleteCell={nominaGrid.deleteActiveCellOrRange}
          onDeleteRow={(row) => handleDelete(row)}
          onDuplicateRow={(row) => handleDuplicateWorkerRow(row)}
          entityType={contextMenuTarget.entityType || 'workers'}
          recordId={contextMenuTarget.recordId}
          recordLabel={contextMenuTarget.recordLabel}
        />
      )}
    </div>
  )
}
