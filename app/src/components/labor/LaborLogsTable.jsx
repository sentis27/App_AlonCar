import React from 'react'
import GridRibbon from '../GridRibbon.jsx'
import GridContextMenu from '../GridContextMenu.jsx'
import GridStatusBarBottom from '../GridStatusBarBottom.jsx'
import LaborLogsTableRow from './LaborLogsTableRow.jsx'

export default function LaborLogsTable({
  filteredLogs = [],
  recentLogs = [],
  selectedLogIds = new Set(),
  setSelectedLogIds,
  toggleSelectLog,
  toggleSelectAllLogs,
  activeKpiFilter,
  filterWorker,
  filterDate,
  filterShip,
  inlineLogEdit,
  setInlineLogEdit,
  horasGrid,
  getHorasCellProps,
  activateHorasCell,
  saveInlineLogEdit,
  handleInsertRow,
  clearAllFilters,
  hoursStats,
  menuTarget,
  openMenu,
  closeMenu,
  handleEditFromDaily,
  handleDuplicateLog,
  handleDeleteLog,
  handleUpdateApprovalStatus,
  setReviewReasonModal,
  setActiveTab,
  setDailyFilterType
}) {
  if (filteredLogs.length === 0) {
    return (
      <div className="alon-zone-grid text-center py-10 text-slate-400 text-xs space-y-2">
        <p>No hay imputaciones que coincidan con los filtros seleccionados.</p>
        {activeKpiFilter === 'incompleta' && (
          <button
            type="button"
            onClick={() => {
              setActiveTab('control_diario')
              setDailyFilterType('incompleta')
            }}
            className="px-3 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 border border-orange-500/50 text-orange-300 font-bold cursor-pointer"
          >
            Ir a Control Diario de Nómina (Operarios con jornada incompleta hoy) &rarr;
          </button>
        )}
      </div>
    )
  }

  const handleOpenReviewReason = (log, shipDisplayName, otTitle) => {
    setReviewReasonModal({
      isOpen: true,
      logId: log.id,
      workerName: log.worker_name,
      dateLogged: log.date_logged,
      shipWo: `${shipDisplayName} - ${otTitle || 'Sin OT'}`,
      targetStatus: log.approval_status || 'R',
      reason: log.review_reason || '',
      response: log.worker_response || ''
    })
  }

  return (
    <div className="alon-zone-grid">
      <GridRibbon
        activeCellBadge={horasGrid.activeCellBadge}
        onInsertRow={handleInsertRow}
        insertRowLabel="Nueva Fila en Blanco"
        undoCount={horasGrid.undoStack?.length || 0}
        totalRows={filteredLogs.length}
        entityName="imputaciones"
        exportRows={filteredLogs}
        exportFilename={`horas_imputaciones_${new Date().toISOString().split('T')[0]}`}
      />

      <div
        tabIndex={0}
        onKeyDown={horasGrid.handleKeyDown}
        ref={horasGrid.gridContainerRef}
        className="alon-grid-scroll"
      >
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead className="sticky top-0 z-20 alon-grid-thead backdrop-blur-md">
            <tr>
              <th className="py-2.5 px-2 text-center w-8">
                <input
                  type="checkbox"
                  checked={filteredLogs.length > 0 && filteredLogs.every(l => selectedLogIds.has(l.id))}
                  onChange={() => toggleSelectAllLogs(filteredLogs.map(l => l.id))}
                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary"
                  title="Seleccionar todas las imputaciones visibles"
                />
              </th>
              <th className="py-2.5 px-3">Fecha ✎</th>
              <th className="py-2.5 px-3">Barco / OT ✎</th>
              <th className="py-2.5 px-3">Operario / Tipo ✎</th>
              <th className="py-2.5 px-3">Rubro ✎</th>
              <th className="py-2.5 px-2 text-center">Norm ✎</th>
              <th className="py-2.5 px-2 text-center text-cyan-400">50% ✎</th>
              <th className="py-2.5 px-2 text-center text-amber-400">100% ✎</th>
              <th className="py-2.5 px-3 text-center text-primary font-bold">Total</th>
              <th className="py-2.5 px-2 text-center">Estado ✎</th>
              <th className="py-2.5 px-3 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredLogs.map((log, rowIndex) => (
              <LaborLogsTableRow
                key={log.id}
                log={log}
                rowIndex={rowIndex}
                isSelected={selectedLogIds.has(log.id)}
                filterWorker={filterWorker}
                inlineLogEdit={inlineLogEdit}
                setInlineLogEdit={setInlineLogEdit}
                getHorasCellProps={getHorasCellProps}
                activateHorasCell={activateHorasCell}
                saveInlineLogEdit={saveInlineLogEdit}
                onToggleSelectLog={toggleSelectLog}
                onUpdateApprovalStatus={handleUpdateApprovalStatus}
                onOpenReviewReason={handleOpenReviewReason}
                onEditFromDaily={handleEditFromDaily}
                onDuplicateLog={handleDuplicateLog}
                onDeleteLog={handleDeleteLog}
                onOpenContextMenu={(e, targetLog, rIdx) =>
                  openMenu(e, targetLog, rIdx, { entityType: 'daily_labor_logs', recordId: targetLog.id, recordLabel: targetLog.worker_name }, horasGrid)
                }
                onFillHandleMouseDown={horasGrid.handleFillHandleMouseDown}
                onFillHandleDoubleClick={horasGrid.handleFillHandleDoubleClick}
              />
            ))}
          </tbody>
        </table>
      </div>

      {menuTarget && (
        <GridContextMenu
          target={menuTarget}
          onClose={closeMenu}
          onCopyCell={horasGrid.copyActiveCell}
          onCopyRow={horasGrid.copyRow}
          onPaste={horasGrid.pasteToActiveOrRange}
          onDeleteCell={horasGrid.deleteActiveCellOrRange}
          onDuplicateRow={(row) => handleDuplicateLog(row)}
          onDeleteRow={(row) => handleDeleteLog(row.id, row.worker_name)}
          entityType={menuTarget.entityType}
          recordId={menuTarget.recordId}
          recordLabel={menuTarget.recordLabel}
        />
      )}

      <GridStatusBarBottom
        filteredCount={filteredLogs.length}
        totalCount={recentLogs.length}
        entityName="imputaciones"
        hasActiveFilter={Boolean(filterWorker || filterDate || filterShip || (activeKpiFilter && activeKpiFilter !== 'todos'))}
        onClearFilters={clearAllFilters}
        selectionStats={horasGrid.selectionStats}
        onClearSelection={() => horasGrid.setSelectionRange(null)}
        customSelection={selectedLogIds.size > 0 ? {
          count: selectedLogIds.size,
          label: 'filas tildadas',
          onClear: () => setSelectedLogIds(new Set())
        } : null}
        globalAggregates={[
          { label: 'Σ Horas', value: hoursStats.sumTotalHours.toFixed(1), highlight: true },
          { label: 'Norm', value: hoursStats.sumNorm.toFixed(1) },
          { label: '50%', value: hoursStats.sum50.toFixed(1) },
          { label: '100%', value: hoursStats.sum100.toFixed(1) },
          { label: 'Ø Horas', value: hoursStats.avgHours.toFixed(1) }
        ]}
      />
    </div>
  )
}
