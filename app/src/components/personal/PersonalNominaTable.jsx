import { useEffect, useMemo, useRef } from 'react'
import { Square, CheckSquare, HelpCircle, ChevronDown } from 'lucide-react'
import GridRibbon from '../GridRibbon'
import PersonalNominaRow from './PersonalNominaRow'
import { SAFETY_ITEMS_HELP_TEXT } from '../../lib/workCostRules'
import { getTodayArIso } from '../../lib/dateTimeCanonical'
import { NOMINA_COLUMNS } from '../../lib/personalNominaHelpers'
import { useProgressiveRows } from '../../hooks/useProgressiveRows'

export default function PersonalNominaTable({
  nominaGrid,
  filteredWorkers,
  dollarRate,
  searchTerm,
  filterResetKey = '',
  contractMap = null,
  uniqueTrades,
  inlineCellEdit,
  setInlineCellEdit,
  commitInlineWorkerEdit,
  contextMenuTarget,
  setContextMenuTarget,
  onOpenNew,
  onOpenAddTradeModal,
  onToggleStatus,
  onTogglePermission,
  onEdit,
  onDuplicate,
  onDelete
}) {
  const {
    gridContainerRef,
    handleKeyDown,
    activeCellBadge,
    undoStack,
    selectedRowIds,
    toggleSelectAll,
    activeCell,
    selectionRange: selRange,
    fillRange
  } = nominaGrid

  const scrollContainerRef = useRef(null)
  const gridHandlersRef = useRef(null)
  const contextMenuRef = useRef(null)

  useEffect(() => {
    gridHandlersRef.current = {
      handleCellClick: nominaGrid.handleCellClick,
      handleCellMouseDown: nominaGrid.handleCellMouseDown,
      handleCellMouseEnter: nominaGrid.handleCellMouseEnter,
      handleFillHandleMouseDown: nominaGrid.handleFillHandleMouseDown,
      handleFillHandleDoubleClick: nominaGrid.handleFillHandleDoubleClick,
      toggleSelectRow: nominaGrid.toggleSelectRow,
      setActiveCell: nominaGrid.setActiveCell,
      setSelectionRange: nominaGrid.setSelectionRange,
      activeCell: nominaGrid.activeCell
    }
    contextMenuRef.current = contextMenuTarget
  })

  const exportFilename = useMemo(() => `personal_padron_${getTodayArIso()}`, [])

  const {
    visibleItems: visibleWorkers,
    visibleCount,
    hasMore,
    remainingCount,
    loadMore,
    showAll,
    sentinelRef
  } = useProgressiveRows({
    items: filteredWorkers,
    initialCount: 60,
    batchSize: 60,
    activeIndex: activeCell?.rowIndex ?? -1,
    scrollContainerRef,
    resetKey: filterResetKey
  })

  const gridActions = useMemo(() => ({
    onCellClick: (rowIdx, colIdx, e) => gridHandlersRef.current?.handleCellClick(rowIdx, colIdx, e),
    onCellMouseDown: (rowIdx, colIdx, e) => gridHandlersRef.current?.handleCellMouseDown(rowIdx, colIdx, e),
    onCellMouseEnter: (rowIdx, colIdx) => gridHandlersRef.current?.handleCellMouseEnter(rowIdx, colIdx),
    onFillHandleMouseDown: (e) => gridHandlersRef.current?.handleFillHandleMouseDown(e),
    onFillHandleDoubleClick: (e) => gridHandlersRef.current?.handleFillHandleDoubleClick(e),
    onToggleSelectRow: (id) => gridHandlersRef.current?.toggleSelectRow(id),
    onContextMenuRow: (row, rowIdx, e, isRowHeader) => {
      e.preventDefault()
      e.stopPropagation()
      const grid = gridHandlersRef.current
      if (!isRowHeader && grid && grid.activeCell?.rowIndex !== rowIdx) {
        grid.setActiveCell({ rowIndex: rowIdx, colIndex: grid.activeCell?.colIndex ?? 0 })
        grid.setSelectionRange?.(null)
      }
      if (isRowHeader && contextMenuRef.current?.recordId === row.id) {
        setContextMenuTarget(null)
        return
      }
      setContextMenuTarget({
        row,
        rowIndex: rowIdx,
        x: e.clientX,
        y: e.clientY,
        isRowHeader,
        entityType: 'workers',
        recordId: row.id,
        recordLabel: row.name
      })
    }
  }), [setContextMenuTarget])

  // Precalcular cotas de selección y tirador en O(1) para pasar solo primitivos a cada fila memoizada
  const selMinR = selRange ? Math.min(selRange.startRow, selRange.endRow) : -1
  const selMaxR = selRange ? Math.max(selRange.startRow, selRange.endRow) : -1
  const selMinC = selRange ? Math.min(selRange.startCol, selRange.endCol) : -1
  const selMaxC = selRange ? Math.max(selRange.startCol, selRange.endCol) : -1

  const fillFromR = fillRange ? fillRange.fromRow : -1
  const fillMaxR = fillRange ? Math.max(fillRange.fromRow, fillRange.toRow) : -1
  const fillCol = fillRange ? fillRange.colIndex : -1

  let handleRow = -1
  let handleCol = -1
  if (activeCell) {
    const candidateRow = selRange ? selMaxR : activeCell.rowIndex
    const candidateCol = selRange ? selMaxC : activeCell.colIndex
    if (!NOMINA_COLUMNS[candidateCol]?.readOnly) {
      handleRow = candidateRow
      handleCol = candidateCol
    }
  }

  return (
    <div
      ref={gridContainerRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="alon-zone-grid rounded-2xl shadow-xl overflow-hidden focus:outline-none"
    >
      <GridRibbon
        activeCellBadge={activeCellBadge || 'PADRÓN OPERATIVO'}
        onInsertRow={onOpenNew}
        insertRowLabel="Cargar Operario / Contratista"
        undoCount={undoStack?.length || 0}
        totalRows={filteredWorkers.length}
        entityName="operarios"
        exportRows={filteredWorkers}
        exportFilename={exportFilename}
      />

      <div ref={scrollContainerRef} className="alon-grid-scroll">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="sticky top-0 z-20 alon-grid-thead text-[10px] uppercase font-bold text-slate-300 shadow-sm backdrop-blur-md">
            <tr>
              <th className="py-2 px-1 text-center w-8 select-none">
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => toggleSelectAll(filteredWorkers.map((w) => w.id))}
                    className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                    title="Seleccionar todas las filas visibles"
                  >
                    {selectedRowIds.size > 0 && selectedRowIds.size === filteredWorkers.length ? (
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span className="font-mono text-[9px] text-slate-500 font-bold">#</span>
                </div>
              </th>
              <th className="py-2.5 px-2">Nombre y Apellido ✎</th>
              <th className="py-2.5 px-1.5 text-center">Categoría ✎</th>
              <th className="py-2.5 px-1.5">Rubro ✎</th>
              <th className="py-2.5 px-2 text-right">AR$/Hora ✎</th>
              <th className="py-2.5 px-1.5 text-center text-emerald-400">U$/Hora</th>
              <th className="py-2.5 px-2">Grupo de Trabajo ✎</th>
              <th className="py-2.5 px-1.5">Centro Admin ✎</th>
              <th className="py-2.5 px-1.5">Contrato</th>
              <th className="py-2.5 px-1.5 text-center">Estado</th>
              <th className="py-2.5 px-1.5">Consumibles</th>
              <th className="py-2.5 px-1.5">
                <div className="relative group inline-flex items-center gap-1 cursor-help">
                  <span>Elem. Seg. ✎</span>
                  <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <div className="opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none transition-all duration-150 absolute top-full right-0 mt-1.5 w-80 p-3 rounded-xl bg-slate-900 border border-cyan-500/40 shadow-2xl z-50 text-left font-normal normal-case tracking-normal text-[11px] leading-relaxed text-slate-200">
                    <div className="font-black text-cyan-300 mb-1 uppercase text-[10px]">
                      Regla Unificada: Elementos de Seguridad (EPP)
                    </div>
                    <p>{SAFETY_ITEMS_HELP_TEXT}</p>
                  </div>
                </div>
              </th>
              <th className="py-2.5 px-1.5 text-center">Permisos</th>
              <th className="py-2.5 px-2 text-right whitespace-nowrap">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {filteredWorkers.length === 0 ? (
              <tr>
                <td colSpan={14} className="py-10 text-center text-slate-500">
                  No se encontraron registros que coincidan con la búsqueda.
                </td>
              </tr>
            ) : (
              <>
                {visibleWorkers.map((w, rowIndex) => {
                  const isEditingThisRow = inlineCellEdit?.rowId === w.id
                  const rowInSel = selRange && rowIndex >= selMinR && rowIndex <= selMaxR
                  const rowInFill = fillRange && rowIndex > fillFromR && rowIndex <= fillMaxR
                  return (
                    <PersonalNominaRow
                      key={w.id}
                      w={w}
                      rowIndex={rowIndex}
                      dollarRate={dollarRate}
                      searchTerm={searchTerm}
                      uniqueTrades={uniqueTrades}
                      contractExp={contractMap?.get(w.id) || null}
                      isRowSelected={selectedRowIds.has(w.id)}
                      activeColIndex={activeCell?.rowIndex === rowIndex ? activeCell.colIndex : -1}
                      selStartCol={rowInSel ? selMinC : -1}
                      selEndCol={rowInSel ? selMaxC : -1}
                      fillColIndex={rowInFill ? fillCol : -1}
                      fillHandleColIndex={handleRow === rowIndex ? handleCol : -1}
                      editingColKey={isEditingThisRow ? inlineCellEdit.colKey : null}
                      editingValue={isEditingThisRow ? inlineCellEdit.value : ''}
                      gridActions={gridActions}
                      setInlineCellEdit={setInlineCellEdit}
                      commitInlineWorkerEdit={commitInlineWorkerEdit}
                      onOpenAddTradeModal={onOpenAddTradeModal}
                      onToggleStatus={onToggleStatus}
                      onTogglePermission={onTogglePermission}
                      onEdit={onEdit}
                      onDuplicate={onDuplicate}
                      onDelete={onDelete}
                    />
                  )
                })}
                {hasMore && (
                  <tr ref={sentinelRef} className="bg-slate-900/70">
                    <td colSpan={14} className="py-3 px-4">
                      <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                        <span>
                          Mostrando <strong className="text-cyan-300 font-mono">{visibleCount}</strong> de{' '}
                          <strong className="text-white font-mono">{filteredWorkers.length}</strong> operarios (el buscador, los filtros y la exportación trabajan sobre los {filteredWorkers.length})
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={loadMore}
                            className="px-3 py-1 rounded-lg bg-cyan-950/90 hover:bg-cyan-900 text-cyan-300 border border-cyan-600/60 font-bold inline-flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span>Cargar +{Math.min(60, remainingCount)}</span>
                          </button>
                          <button
                            type="button"
                            onClick={showAll}
                            className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold cursor-pointer transition-colors"
                          >
                            Mostrar todos ({filteredWorkers.length})
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
