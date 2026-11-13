import {
  Ship,
  User,
  Pencil,
  CopyPlus,
  GitBranch,
  Eye,
  Trash2,
  Lock,
  Plus
} from 'lucide-react'
import GridRibbon from '../GridRibbon'
import GridStatusBarBottom from '../GridStatusBarBottom'
import GridContextMenu from '../GridContextMenu'
import HighlightText from '../HighlightText'
import {
  ESTADOS_TRABAJO,
  TIPOS_DE_TRABAJO,
  formatShortDate,
  formatSpecificBudgetLabel,
  isBudgetPendingAlert,
  isWorkItemEliminada,
  cleanWorkItemComment,
  evaluateWorkItemAlerts
} from '../../lib/workOrdersConstants'

export default function WorkOrdersUnificadoPanel({
  filteredRows = [],
  unifiedRows = [],
  woGrid,
  ships = [],
  foremenList = [],
  searchQuery = '',
  stats,
  hasActiveFilters,
  onClearAllFilters,
  isRowLockedDec011,
  hasThirdPartyPermission: _hasThirdPartyPermission,
  inlineWoEdit,
  setInlineWoEdit,
  commitInlineWoEdit,
  onOpenNewWorkModal,
  onOpenEditWorkModal,
  onOpenSeparateModal,
  onOpenCloseTreeModal,
  onDuplicateWorkItem,
  onDeleteWorkItem,
  setSelectedWoDetail,
  setEditingThirdParty,
  menuTarget,
  openMenu,
  closeMenu,
  showWoGridFeedback
}) {
  return (
    <div
      ref={woGrid.gridContainerRef}
      tabIndex={0}
      onKeyDown={woGrid.handleKeyDown}
      className="alon-zone-grid rounded-2xl shadow-xl overflow-hidden focus:outline-none font-sans"
    >
      {/* Ribbon Canónico (Estándar 04) con Exportación integrada */}
      <GridRibbon
        activeCellBadge={woGrid.activeCellBadge || 'PLANILLA UNIFICADA OTs'}
        onInsertRow={() => onOpenNewWorkModal(null)}
        insertRowLabel="+ Cargar Trabajo"
        undoCount={woGrid.undoStack?.length || 0}
        totalRows={filteredRows.length}
        entityName="trabajos"
        exportRows={filteredRows}
        exportFilename={`ordenes_trabajo_${new Date().toISOString().split('T')[0]}`}
      />

      <div className="alon-grid-scroll">
        <table className="w-full text-left text-xs text-slate-300">
          <thead className="sticky top-0 z-20 alon-grid-thead text-[10px] uppercase font-bold text-slate-300 shadow-sm backdrop-blur-md">
            <tr>
              <th className="py-2 px-2 text-center w-10">#</th>
              <th className="py-2 px-2.5">Barco ✎</th>
              <th className="py-2 px-2.5">Orden de Trabajo (Estado Calculado) ✎</th>
              <th className="py-2 px-2.5 min-w-[140px]">Fechas OT (Creac. / Inicio / Fin)</th>
              <th className="py-2 px-2.5 min-w-[230px]">Descripción del Trabajo ✎</th>
              <th className="py-2 px-2.5">Contratista ✎</th>
              <th className="py-2 px-2.5">Jefe de Obra ✎</th>
              <th className="py-2 px-2">Tipo / Facturación ✎</th>
              <th className="py-2 px-2.5 text-center">Estado del Trabajo ✎</th>
              <th className="py-2 px-2 text-center">Alertas / 3ros</th>
              <th className="py-2 px-2.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-12 text-center text-slate-500">
                  No hay trabajos registrados para los filtros seleccionados. Hacé clic en <strong>&quot;+ Cargar Trabajo / Nueva OT&quot;</strong> para comenzar.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, rowIndex) => {
                const stConfig = ESTADOS_TRABAJO.find((s) => s.value === row.status) || ESTADOS_TRABAJO[0]
                const alerts = evaluateWorkItemAlerts(row, row.wo)
                const contractors = row.contractors || []
                const tp = row.thirdPartyRecord
                const dates = row.otDates || {}
                const visibleComment = cleanWorkItemComment(row.comments)
                const rowIsEliminada = isWorkItemEliminada(row, row.wo)
                const isLocked = isRowLockedDec011(row)

                const getWoCellClass = (colIdx, baseClass = '') => {
                  const active = woGrid.isCellActive(rowIndex, colIdx)
                  const fill = woGrid.isCellInFillPreview(rowIndex, colIdx)
                  const sel = woGrid.isCellSelected(rowIndex, colIdx)
                  return `${baseClass} relative ${isLocked ? 'cursor-not-allowed' : 'cursor-cell'} ${
                    active
                      ? 'ring-2 ring-inset ring-emerald-400 bg-emerald-950/30'
                      : fill
                      ? 'bg-emerald-500/20 ring-1 ring-inset ring-emerald-400/60'
                      : sel
                      ? 'bg-cyan-500/15'
                      : ''
                  }`
                }

                const isEditingCol = (colKey) =>
                  Boolean(inlineWoEdit && inlineWoEdit.rowId === row.id && inlineWoEdit.colKey === colKey)

                return (
                  <tr
                    key={row.id}
                    onContextMenu={(e) =>
                      openMenu(
                        e,
                        row,
                        rowIndex,
                        {
                          entityType: 'work_orders',
                          recordId: row.isPlaceholder ? row.work_order_id : row.id,
                          recordLabel: row.wo?.ot_number || ''
                        },
                        woGrid
                      )
                    }
                    className="hover:bg-slate-800/30 transition-colors align-middle select-none"
                  >
                    {/* 0. Número Ordinal de Fila (# DNI Inviolable de Registro) */}
                    <td
                      className="py-1.5 px-2 text-center font-mono text-[11px] text-slate-500 font-bold whitespace-nowrap"
                      title={
                        row._rowSeq
                          ? `Fila #${row._rowSeq} (DNI Inviolable)`
                          : 'OT abierta sin trabajos cargados aún'
                      }
                    >
                      {row._rowSeq || 'OT'}
                    </td>

                    {/* Col 0: Barco */}
                    <td
                      onClick={(e) => woGrid.handleCellClick(rowIndex, 0, e)}
                      onMouseDown={(e) => woGrid.handleCellMouseDown(rowIndex, 0, e)}
                      onMouseEnter={() => woGrid.handleCellMouseEnter(rowIndex, 0)}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        if (isLocked) {
                          showWoGridFeedback('error', `🔒 Bloqueo DEC-011: La ${row.wo?.ot_number} está Facturada y Cerrada.`)
                          return
                        }
                        setInlineWoEdit({ rowId: row.id, colKey: 'ship_id', value: row.wo?.ship_id || '' })
                      }}
                      title={isLocked ? 'Bloqueado DEC-011' : 'Doble clic para cambiar Buque'}
                      className={getWoCellClass(0, 'py-1.5 px-2.5')}
                    >
                      {isEditingCol('ship_id') ? (
                        <select
                          autoFocus
                          value={inlineWoEdit.value}
                          onChange={(e) => commitInlineWoEdit(e.target.value)}
                          onBlur={() => commitInlineWoEdit()}
                          onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Escape') setInlineWoEdit(null)
                          }}
                          className="bg-slate-950 border border-emerald-400 rounded px-2 py-1 text-xs text-cyan-300 font-bold focus:outline-none"
                        >
                          <option value="">-- Seleccionar Buque --</option>
                          {ships.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <div className="flex items-center gap-1.5 font-bold text-white">
                          <Ship className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>
                            <HighlightText text={row.wo?.ships?.name || 'Sin barco'} query={searchQuery} />
                          </span>
                        </div>
                      )}
                      {!isLocked && woGrid.shouldRenderFillHandle(rowIndex, 0) && (
                        <div
                          onMouseDown={woGrid.handleFillHandleMouseDown}
                          onDoubleClick={woGrid.handleFillHandleDoubleClick}
                          className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
                        />
                      )}
                    </td>

                    {/* Col 1: Orden de Trabajo */}
                    <td
                      onClick={(e) => woGrid.handleCellClick(rowIndex, 1, e)}
                      onMouseDown={(e) => woGrid.handleCellMouseDown(rowIndex, 1, e)}
                      onMouseEnter={() => woGrid.handleCellMouseEnter(rowIndex, 1)}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        if (isLocked) {
                          showWoGridFeedback('error', `🔒 Bloqueo DEC-011: La ${row.wo?.ot_number} está Facturada y Cerrada.`)
                          return
                        }
                        onOpenEditWorkModal(row)
                      }}
                      title={isLocked ? 'Bloqueado DEC-011' : 'Doble clic para editar Orden de Trabajo'}
                      className={getWoCellClass(1, 'py-1.5 px-2.5')}
                    >
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-[10px] font-black text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/30">
                          <HighlightText text={row.wo?.ot_number || 'OT-1'} query={searchQuery} />
                        </span>
                        <span className="font-extrabold text-white text-[11px] uppercase leading-tight">
                          <HighlightText text={(row.wo?.title || '').toUpperCase()} query={searchQuery} />
                        </span>
                        {isLocked && <Lock className="w-3 h-3 text-purple-400" title="OT Facturada y Cerrada (DEC-011)" />}
                      </div>
                      <div className="mt-1 flex items-center gap-1 flex-wrap">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded border font-bold ${row.computedOt.color}`}>
                          OT: {row.computedOt.label}
                        </span>
                      </div>
                      {!isLocked && woGrid.shouldRenderFillHandle(rowIndex, 1) && (
                        <div
                          onMouseDown={woGrid.handleFillHandleMouseDown}
                          onDoubleClick={woGrid.handleFillHandleDoubleClick}
                          className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
                        />
                      )}
                    </td>

                    {/* 3. Las 3 Fechas de la OT (Creación, Inicio Real y Fin Real) */}
                    <td className="py-1.5 px-2.5 font-mono text-[10px] leading-tight space-y-0.5 whitespace-nowrap">
                      <div className="flex items-center justify-between gap-2 text-slate-300">
                        <span className="text-slate-500">Creac.:</span>
                        <span className="font-bold">{formatShortDate(dates.createdDate)}</span>
                      </div>
                      <div
                        className="flex items-center justify-between gap-2 text-emerald-300"
                        title={
                          dates.startDate
                            ? `Primer dato cargado en el sistema (${dates.startSource}): ${formatShortDate(dates.startDate, true)}`
                            : 'Sin datos cargados aún en Horas, Materiales ni Terceros'
                        }
                      >
                        <span className="text-slate-500">Inicio:</span>
                        <span className="font-bold">
                          {dates.startDate ? `${formatShortDate(dates.startDate)} (${dates.startSource?.slice(0, 3)})` : '—'}
                        </span>
                      </div>
                      <div
                        className="flex items-center justify-between gap-2 text-cyan-300"
                        title={
                          dates.endDate
                            ? `Último dato cargado a esta OT (${dates.endSource}): ${formatShortDate(dates.endDate, true)}`
                            : 'Sin datos cargados aún'
                        }
                      >
                        <span className="text-slate-500">Final:</span>
                        <span className="font-bold">
                          {dates.endDate ? `${formatShortDate(dates.endDate)} (${dates.endSource?.slice(0, 3)})` : '—'}
                        </span>
                      </div>
                    </td>

                    {/* Col 2: Descripción del Trabajo */}
                    <td
                      onClick={(e) => woGrid.handleCellClick(rowIndex, 2, e)}
                      onMouseDown={(e) => woGrid.handleCellMouseDown(rowIndex, 2, e)}
                      onMouseEnter={() => woGrid.handleCellMouseEnter(rowIndex, 2)}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        if (isLocked) {
                          showWoGridFeedback('error', `🔒 Bloqueo DEC-011: La ${row.wo?.ot_number} está Facturada y Cerrada.`)
                          return
                        }
                        setInlineWoEdit({ rowId: row.id, colKey: 'description', value: row.description || '' })
                      }}
                      title={isLocked ? 'Bloqueado DEC-011' : 'Doble clic para editar descripción'}
                      className={getWoCellClass(2, 'py-1.5 px-2.5 max-w-md')}
                    >
                      {isEditingCol('description') ? (
                        <textarea
                          rows={2}
                          autoFocus
                          value={inlineWoEdit.value}
                          onChange={(e) => setInlineWoEdit((prev) => ({ ...prev, value: e.target.value }))}
                          onBlur={() => commitInlineWoEdit()}
                          onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault()
                              commitInlineWoEdit()
                            }
                            if (e.key === 'Escape') setInlineWoEdit(null)
                          }}
                          className="w-full min-w-[210px] bg-slate-950 border border-emerald-400 rounded-lg px-2 py-1 text-xs text-white focus:outline-none"
                        />
                      ) : row.description ? (
                        <div className="text-xs text-slate-200 whitespace-pre-wrap leading-snug line-clamp-2 hover:line-clamp-none">
                          <HighlightText text={row.description} query={searchQuery} />
                        </div>
                      ) : (
                        <span className="text-amber-400/80 italic text-xs">Sin descripción cargada</span>
                      )}
                      {visibleComment && (
                        <div className="mt-1 text-[10px] text-slate-400 bg-slate-950 px-2 py-1 rounded border border-slate-800">
                          💬 <strong>Comentario:</strong> {visibleComment}
                        </div>
                      )}
                      {!isLocked && woGrid.shouldRenderFillHandle(rowIndex, 2) && (
                        <div
                          onMouseDown={woGrid.handleFillHandleMouseDown}
                          onDoubleClick={woGrid.handleFillHandleDoubleClick}
                          className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
                        />
                      )}
                    </td>

                    {/* Col 3: Contratistas */}
                    <td
                      onClick={(e) => woGrid.handleCellClick(rowIndex, 3, e)}
                      onMouseDown={(e) => woGrid.handleCellMouseDown(rowIndex, 3, e)}
                      onMouseEnter={() => woGrid.handleCellMouseEnter(rowIndex, 3)}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        if (isLocked) {
                          showWoGridFeedback('error', `🔒 Bloqueo DEC-011: La ${row.wo?.ot_number} está Facturada y Cerrada.`)
                          return
                        }
                        onOpenEditWorkModal(row)
                      }}
                      title={isLocked ? 'Bloqueado DEC-011' : 'Doble clic para editar o asignar contratistas'}
                      className={getWoCellClass(3, 'py-1.5 px-2.5')}
                    >
                      {contractors.length === 0 ? (
                        <span className="text-slate-500 italic text-[11px]">Sin asignar</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {contractors.map((c) => (
                            <span
                              key={c}
                              className="inline-flex items-center px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-[10px] font-mono font-bold text-slate-200"
                            >
                              <HighlightText text={c} query={searchQuery} />
                            </span>
                          ))}
                        </div>
                      )}
                      {!isLocked && woGrid.shouldRenderFillHandle(rowIndex, 3) && (
                        <div
                          onMouseDown={woGrid.handleFillHandleMouseDown}
                          onDoubleClick={woGrid.handleFillHandleDoubleClick}
                          className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
                        />
                      )}
                    </td>

                    {/* Col 4: Jefe de Obra */}
                    <td
                      onClick={(e) => woGrid.handleCellClick(rowIndex, 4, e)}
                      onMouseDown={(e) => woGrid.handleCellMouseDown(rowIndex, 4, e)}
                      onMouseEnter={() => woGrid.handleCellMouseEnter(rowIndex, 4)}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        if (isLocked) {
                          showWoGridFeedback('error', `🔒 Bloqueo DEC-011: La ${row.wo?.ot_number} está Facturada y Cerrada.`)
                          return
                        }
                        setInlineWoEdit({ rowId: row.id, colKey: 'foreman_name', value: row.foreman_name || foremenList[0] || '' })
                      }}
                      title={isLocked ? 'Bloqueado DEC-011' : 'Doble clic para cambiar Jefe de Obra'}
                      className={getWoCellClass(4, 'py-1.5 px-2.5')}
                    >
                      {isEditingCol('foreman_name') ? (
                        <select
                          autoFocus
                          value={inlineWoEdit.value}
                          onChange={(e) => commitInlineWoEdit(e.target.value)}
                          onBlur={() => commitInlineWoEdit()}
                          onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Escape') setInlineWoEdit(null)
                          }}
                          className="bg-slate-950 border border-emerald-400 rounded px-2 py-1 text-xs text-amber-300 font-bold focus:outline-none"
                        >
                          {foremenList.map((f) => (
                            <option key={f} value={f}>
                              {f}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="font-bold text-amber-300 flex items-center gap-1 text-xs">
                          <User className="w-3 h-3 shrink-0" />
                          <span>
                            <HighlightText text={row.foreman_name || 'Sin asignar'} query={searchQuery} />
                          </span>
                        </span>
                      )}
                      {!isLocked && woGrid.shouldRenderFillHandle(rowIndex, 4) && (
                        <div
                          onMouseDown={woGrid.handleFillHandleMouseDown}
                          onDoubleClick={woGrid.handleFillHandleDoubleClick}
                          className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
                        />
                      )}
                    </td>

                    {/* Col 5: Tipo y Facturación */}
                    <td
                      onClick={(e) => woGrid.handleCellClick(rowIndex, 5, e)}
                      onMouseDown={(e) => woGrid.handleCellMouseDown(rowIndex, 5, e)}
                      onMouseEnter={() => woGrid.handleCellMouseEnter(rowIndex, 5)}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        if (isLocked) {
                          showWoGridFeedback('error', `🔒 Bloqueo DEC-011: La ${row.wo?.ot_number} está Facturada y Cerrada.`)
                          return
                        }
                        setInlineWoEdit({ rowId: row.id, colKey: 'work_type', value: row.work_type || 'HORA' })
                      }}
                      title={isLocked ? 'Bloqueado DEC-011' : 'Doble clic para cambiar Tipo de Trabajo'}
                      className={getWoCellClass(5, 'py-1.5 px-2')}
                    >
                      {isEditingCol('work_type') ? (
                        <select
                          autoFocus
                          value={inlineWoEdit.value}
                          onChange={(e) => commitInlineWoEdit(e.target.value)}
                          onBlur={() => commitInlineWoEdit()}
                          onKeyDown={(e) => {
                            e.stopPropagation()
                            if (e.key === 'Escape') setInlineWoEdit(null)
                          }}
                          className="bg-slate-950 border border-emerald-400 rounded px-1.5 py-1 text-[11px] text-cyan-300 font-mono font-bold focus:outline-none"
                        >
                          {TIPOS_DE_TRABAJO.map((t) => (
                            <option key={t.value} value={t.value}>
                              {t.value}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <>
                          <span className="font-mono font-bold text-cyan-300 text-[11px] block leading-tight">
                            <HighlightText text={row.work_type || 'HORA'} query={searchQuery} />
                          </span>
                          <span
                            className={`text-[10px] block leading-tight ${
                              isBudgetPendingAlert(row)
                                ? 'text-amber-300 font-bold'
                                : row.assignment_type === 'Adicional / Específico'
                                ? 'text-cyan-200 font-semibold'
                                : 'text-slate-400'
                            }`}
                          >
                            <HighlightText
                              text={
                                row.assignment_type === 'Adicional / Específico'
                                  ? formatSpecificBudgetLabel(row.specific_budget_id)
                                  : 'Presup. Gral.'
                              }
                              query={searchQuery}
                            />
                          </span>
                        </>
                      )}
                      {!isLocked && woGrid.shouldRenderFillHandle(rowIndex, 5) && (
                        <div
                          onMouseDown={woGrid.handleFillHandleMouseDown}
                          onDoubleClick={woGrid.handleFillHandleDoubleClick}
                          className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
                        />
                      )}
                    </td>

                    {/* Col 6: Estado del Trabajo */}
                    <td
                      onClick={(e) => woGrid.handleCellClick(rowIndex, 6, e)}
                      onMouseDown={(e) => woGrid.handleCellMouseDown(rowIndex, 6, e)}
                      onMouseEnter={() => woGrid.handleCellMouseEnter(rowIndex, 6)}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        if (isLocked) {
                          showWoGridFeedback('error', `🔒 Bloqueo DEC-011: La ${row.wo?.ot_number} está Facturada y Cerrada.`)
                          return
                        }
                        setInlineWoEdit({ rowId: row.id, colKey: 'status', value: row.status })
                      }}
                      title={isLocked ? 'Bloqueado DEC-011' : 'Doble clic o selector para cambiar Estado del Trabajo'}
                      className={getWoCellClass(6, 'py-1.5 px-2.5 text-center')}
                    >
                      <div className="flex flex-col items-center gap-1">
                        {isEditingCol('status') ? (
                          <select
                            autoFocus
                            value={inlineWoEdit.value}
                            onChange={(e) => commitInlineWoEdit(e.target.value)}
                            onBlur={() => commitInlineWoEdit()}
                            onKeyDown={(e) => {
                              e.stopPropagation()
                              if (e.key === 'Escape') setInlineWoEdit(null)
                            }}
                            className="text-[10px] font-bold px-2.5 py-1 rounded-lg border border-emerald-400 bg-slate-950 text-white focus:outline-none"
                          >
                            {ESTADOS_TRABAJO.map((st) => (
                              <option key={st.value} value={st.value} className="bg-slate-950 text-white">
                                {st.value}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <select
                            disabled={isLocked}
                            value={row.status}
                            onChange={(e) => {
                              e.stopPropagation()
                              commitInlineWoEdit(e.target.value, row.id, 'status')
                            }}
                            className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border cursor-pointer focus:outline-none disabled:opacity-60 disabled:cursor-not-allowed ${stConfig.color}`}
                          >
                            {ESTADOS_TRABAJO.map((st) => (
                              <option key={st.value} value={st.value} className="bg-slate-950 text-white">
                                {st.value}
                              </option>
                            ))}
                          </select>
                        )}
                        {row.status === 'Desestimado' && rowIsEliminada && (
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/90 text-rose-300 border border-rose-700/80 text-[9px] font-black uppercase tracking-wider"
                            title="Esta OT / trabajo fue desestimada por eliminación (se conserva el registro para no alterar el número consecutivo)"
                          >
                            🗑️ Eliminada
                          </span>
                        )}
                      </div>
                      {!isLocked && woGrid.shouldRenderFillHandle(rowIndex, 6) && (
                        <div
                          onMouseDown={woGrid.handleFillHandleMouseDown}
                          onDoubleClick={woGrid.handleFillHandleDoubleClick}
                          className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
                        />
                      )}
                    </td>

                    {/* 9. Alertas y Vinculación PRC Terceros */}
                    <td className="py-1.5 px-2 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {tp && (
                          <button
                            type="button"
                            onClick={() => setEditingThirdParty(tp)}
                            className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-500 text-[9px] font-black hover:bg-purple-900 cursor-pointer flex items-center gap-1"
                            title="Ver/Editar Observaciones Directas y Específicas en Terceros"
                          >
                            <span>PRC 3ros (${Number(tp.amount_ars || 0).toLocaleString('es-AR')})</span>
                          </button>
                        )}
                        {alerts.map((a) => (
                          <span
                            key={a.code}
                            title={a.label}
                            className={`text-[9px] px-1.5 py-0.5 rounded border font-black ${a.color}`}
                          >
                            ⚠️ {a.code}
                          </span>
                        ))}
                        {!tp && alerts.length === 0 && (
                          <span className="text-[10px] text-emerald-400 font-bold">✓ OK</span>
                        )}
                      </div>
                    </td>

                    {/* 10. Acciones (2 secciones / 2 filas compactas de iconos) */}
                    <td className="py-1.5 px-2.5 text-right whitespace-nowrap">
                      <div className="flex flex-col items-end gap-1">
                        {/* Fila 1: Acciones sobre el Trabajo / Fila */}
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => onOpenEditWorkModal(row)}
                            className="p-1 text-slate-400 hover:text-primary rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Editar este trabajo"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {!row.isPlaceholder && (
                            <button
                              type="button"
                              onClick={() => onDuplicateWorkItem(row)}
                              className="p-1 text-amber-400 hover:text-amber-300 rounded-md hover:bg-amber-500/10 transition-colors cursor-pointer"
                              title="Duplicar fila"
                            >
                              <CopyPlus className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setSelectedWoDetail(row.wo)}
                            className="p-1 text-slate-400 hover:text-cyan-400 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Ver Ficha de la OT y Bitácora (Botón Ampliar)"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {!row.isPlaceholder && (
                            <button
                              type="button"
                              onClick={() => onDeleteWorkItem(row)}
                              className="p-1 text-slate-500 hover:text-rose-400 rounded-md hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Desestimar por eliminación (conserva el consecutivo)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Fila 2: Acciones sobre la OT / Árbol */}
                        <div className="flex items-center justify-end gap-1 pt-0.5 border-t border-slate-800/70">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpenNewWorkModal(row.wo)
                            }}
                            className="p-1 text-cyan-400 hover:text-cyan-200 rounded-md bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-colors cursor-pointer"
                            title="+ Trabajo: Agregar otro trabajo dentro de esta misma OT"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                          {!row.isPlaceholder && (
                            <button
                              type="button"
                              onClick={() => onOpenSeparateModal(row)}
                              className="p-1 text-amber-300 hover:text-amber-200 rounded-md bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors cursor-pointer"
                              title="Separar OT: Independizar o mover este trabajo a otra OT"
                            >
                              <GitBranch className="w-3 h-3" />
                            </button>
                          )}
                          {row.wo && !isLocked && typeof onOpenCloseTreeModal === 'function' && (
                            <button
                              type="button"
                              onClick={() => onOpenCloseTreeModal(row.wo)}
                              className="p-1 text-purple-300 hover:text-purple-200 rounded-md bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/30 transition-colors cursor-pointer"
                              title="Cerrar Árbol: Finalizar o Facturar todas las subtareas de esta OT en 1 clic"
                            >
                              <Lock className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MENÚ CONTEXTUAL CANÓNICO (clic derecho) */}
      {menuTarget && (
        <GridContextMenu
          target={menuTarget}
          onClose={closeMenu}
          onCopyCell={woGrid.copyActiveCell}
          onCopyRow={woGrid.copyRow}
          onPaste={woGrid.pasteToActiveOrRange}
          onDeleteCell={woGrid.deleteActiveCellOrRange}
          onDuplicateRow={(row) => onDuplicateWorkItem(row)}
          onDeleteRow={(row) =>
            row.isPlaceholder
              ? showWoGridFeedback('error', 'Esta OT no tiene trabajos para eliminar.')
              : onDeleteWorkItem(row)
          }
          entityType={menuTarget.entityType}
          recordId={menuTarget.recordId}
          recordLabel={menuTarget.recordLabel}
        />
      )}

      {/* BARRA INFERIOR FLOTANTE ESTANDARIZADA (ARQUETIPO CARGA DE DATOS) */}
      <GridStatusBarBottom
        filteredCount={filteredRows.length}
        totalCount={unifiedRows.length}
        entityName="trabajos"
        hasActiveFilter={hasActiveFilters}
        onClearFilters={onClearAllFilters}
        selectionStats={woGrid.selectionStats}
        onClearSelection={() => woGrid.setSelectionRange(null)}
        globalAggregates={[
          { label: 'En Ejecución', value: stats.enEjecucion, highlight: true },
          { label: 'Pendientes', value: stats.pendientes },
          { label: 'Pdte Remito', value: stats.pdteRemito },
          { label: 'Sin OT', value: stats.totalSinOt }
        ]}
      />
    </div>
  )
}
