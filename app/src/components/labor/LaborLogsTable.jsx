import React, { useEffect, useMemo, useRef, useCallback } from 'react'
import GridRibbon from '../GridRibbon.jsx'
import GridContextMenu from '../GridContextMenu.jsx'
import GridStatusBarBottom from '../GridStatusBarBottom.jsx'
import CanonicalProgressiveTableFooter from '../canonical/CanonicalProgressiveTableFooter.jsx'
import LaborLogsTableRow from './LaborLogsTableRow.jsx'
import { getTodayArIso } from '../../lib/dateTimeCanonical.js'
import { buildHorasSpreadsheetColumns } from '../../lib/laborCargaGridHelpers.js'
import {
  buildLookupMap,
  computeGridSelectionBounds,
  DEFAULT_PROGRESSIVE_INITIAL,
  DEFAULT_PROGRESSIVE_BATCH,
} from '../../lib/gridPerformanceHelpers.js'
import { useProgressiveRows } from '../../hooks/useProgressiveRows.js'

const HORAS_COLUMNS = buildHorasSpreadsheetColumns()

export default function LaborLogsTable({
  ships = [],
  workOrders = [],
  workItems = [],
  filteredLogs = [],
  recentLogs = [],
  filterResetKey = '',
  selectedLogIds = new Set(),
  setSelectedLogIds,
  toggleSelectLog,
  toggleSelectAllLogs,
  activeKpiFilter,
  hasActiveFilter,
  filterWorker,
  filterDate,
  filterShip,
  inlineLogEdit,
  setInlineLogEdit,
  horasGrid,
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
  const {
    gridContainerRef, handleKeyDown, activeCellBadge, undoStack, activeCell, selectionRange,
    fillRange, selectionStats, setSelectionRange, copyActiveCell, copyRow, pasteToActiveOrRange, deleteActiveCellOrRange,
  } = horasGrid

  const gridHandlersRef = useRef(null)
  const openMenuRef = useRef(openMenu)
  const horasGridRef = useRef(horasGrid)

  useEffect(() => {
    gridHandlersRef.current = {
      handleCellClick: horasGrid.handleCellClick,
      handleCellMouseDown: horasGrid.handleCellMouseDown,
      handleCellMouseEnter: horasGrid.handleCellMouseEnter,
      handleFillHandleMouseDown: horasGrid.handleFillHandleMouseDown,
      handleFillHandleDoubleClick: horasGrid.handleFillHandleDoubleClick,
    }
    openMenuRef.current = openMenu
    horasGridRef.current = horasGrid
  })

  const shipsById = useMemo(() => buildLookupMap(ships), [ships])
  const workOrdersById = useMemo(() => buildLookupMap(workOrders), [workOrders])
  const exportFilename = useMemo(() => `horas_imputaciones_${getTodayArIso()}`, [])

  const {
    visibleItems: visibleLogs,
    visibleCount,
    hasMore,
    remainingCount,
    loadMore,
    showAll,
    sentinelRef,
  } = useProgressiveRows({
    items: filteredLogs,
    initialCount: DEFAULT_PROGRESSIVE_INITIAL,
    batchSize: DEFAULT_PROGRESSIVE_BATCH,
    activeIndex: activeCell?.rowIndex ?? -1,
    scrollContainerRef: gridContainerRef,
    resetKey: filterResetKey,
  })

  const gridActions = useMemo(() => ({
    onCellClick: (rowIdx, colIdx, e) => gridHandlersRef.current?.handleCellClick(rowIdx, colIdx, e),
    onCellMouseDown: (rowIdx, colIdx, e) => gridHandlersRef.current?.handleCellMouseDown(rowIdx, colIdx, e),
    onCellMouseEnter: (rowIdx, colIdx) => gridHandlersRef.current?.handleCellMouseEnter(rowIdx, colIdx),
    onFillHandleMouseDown: (e) => gridHandlersRef.current?.handleFillHandleMouseDown(e),
    onFillHandleDoubleClick: (e) => gridHandlersRef.current?.handleFillHandleDoubleClick(e),
    onOpenContextMenu: (e, targetLog, rIdx) =>
      openMenuRef.current?.(
        e,
        targetLog,
        rIdx,
        { entityType: 'daily_labor_logs', recordId: targetLog.id, recordLabel: targetLog.worker_name },
        horasGridRef.current
      ),
  }), [])

  const handleOpenReviewReason = useCallback((log, shipDisplayName, otTitle) => {
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
  }, [setReviewReasonModal])

  const { selMinR, selMaxR, selMinC, selMaxC, fillFromR, fillMaxR, fillCol, handleRow, handleCol } =
    computeGridSelectionBounds({ activeCell, selectionRange, fillRange, columns: HORAS_COLUMNS })

  return (
    <div className="alon-zone-grid">
      <GridRibbon
        activeCellBadge={activeCellBadge}
        onInsertRow={handleInsertRow}
        insertRowLabel="Fila en Blanco"
        undoCount={undoStack?.length || 0}
        totalRows={filteredLogs.length}
        entityName="imputaciones"
        exportRows={filteredLogs}
        exportFilename={exportFilename}
      />

      {filteredLogs.length === 0 ? (
        <div className="text-center py-10 text-slate-400 text-xs space-y-2">
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
      ) : (
        <div
          tabIndex={0}
          onKeyDown={handleKeyDown}
          ref={gridContainerRef}
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
                <th className="py-2.5 px-2.5">Fecha ✎</th>
                <th className="py-2.5 px-2.5">Barco / OT ✎</th>
                <th className="py-2.5 px-2.5">Operario / Tipo ✎</th>
                <th className="py-2.5 px-2.5">Rubro ✎</th>
                <th className="py-2.5 px-2 text-center" title="Columna F (GS-001): Hora, Presupuesto o Control">Modalidad ✎</th>
                <th className="py-2.5 px-2 text-center">Norm ✎</th>
                <th className="py-2.5 px-2 text-center text-cyan-400">50% ✎</th>
                <th className="py-2.5 px-2 text-center text-amber-400">100% ✎</th>
                <th className="py-2.5 px-2.5 text-center text-primary font-bold">Total</th>
                <th className="py-2.5 px-2 text-center">Estado ✎</th>
                <th className="py-2.5 px-2.5">Obs / Tarea ✎</th>
                <th className="py-2.5 px-2.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {visibleLogs.map((log, rowIndex) => {
                const isEditingRow = inlineLogEdit.id === log.id
                const rowInSel = selectionRange && rowIndex >= selMinR && rowIndex <= selMaxR
                const rowInFill = fillRange && rowIndex > fillFromR && rowIndex <= fillMaxR
                return (
                  <LaborLogsTableRow
                    key={log.id}
                    log={log}
                    shipsById={shipsById}
                    workOrdersById={workOrdersById}
                    workOrders={workOrders}
                    workItems={workItems}
                    rowIndex={rowIndex}
                    isSelected={selectedLogIds.has(log.id)}
                    filterWorker={filterWorker}
                    activeColIndex={activeCell?.rowIndex === rowIndex ? activeCell.colIndex : -1}
                    selStartCol={rowInSel ? selMinC : -1}
                    selEndCol={rowInSel ? selMaxC : -1}
                    fillColIndex={rowInFill ? fillCol : -1}
                    fillHandleColIndex={handleRow === rowIndex ? handleCol : -1}
                    editingField={isEditingRow ? inlineLogEdit.field : null}
                    editingValue={isEditingRow ? inlineLogEdit.value : ''}
                    setInlineLogEdit={setInlineLogEdit}
                    gridActions={gridActions}
                    activateHorasCell={activateHorasCell}
                    saveInlineLogEdit={saveInlineLogEdit}
                    onToggleSelectLog={toggleSelectLog}
                    onUpdateApprovalStatus={handleUpdateApprovalStatus}
                    onOpenReviewReason={handleOpenReviewReason}
                    onEditFromDaily={handleEditFromDaily}
                    onDuplicateLog={handleDuplicateLog}
                    onDeleteLog={handleDeleteLog}
                  />
                )
              })}
              <CanonicalProgressiveTableFooter
                visibleCount={visibleCount}
                totalCount={filteredLogs.length}
                hasMore={hasMore}
                remainingCount={remainingCount}
                loadMore={loadMore}
                showAll={showAll}
                sentinelRef={sentinelRef}
                colSpan={13}
                entityLabel="imputaciones"
              />
            </tbody>
          </table>
        </div>
      )}

      {menuTarget && (
        <GridContextMenu
          target={menuTarget}
          onClose={closeMenu}
          onCopyCell={copyActiveCell}
          onCopyRow={copyRow}
          onPaste={pasteToActiveOrRange}
          onDeleteCell={deleteActiveCellOrRange}
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
        hasActiveFilter={Boolean(hasActiveFilter || filterWorker || filterDate || filterShip || (activeKpiFilter && activeKpiFilter !== 'todos'))}
        onClearFilters={clearAllFilters}
        selectionStats={selectionStats}
        onClearSelection={() => setSelectionRange(null)}
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
