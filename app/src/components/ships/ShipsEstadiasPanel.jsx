import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { Pencil, CopyPlus, CheckSquare, Square, Anchor, Clock, CheckCircle } from 'lucide-react'
import { useSpreadsheetGrid } from '../../hooks/useSpreadsheetGrid'
import { useProgressiveRows } from '../../hooks/useProgressiveRows'
import { useAuth } from '../../context/AuthContext'
import { useModuleFilterMemory, resolveInitialModuleFilters } from '../../hooks/useModuleFilterMemory'
import CanonicalZone3Toolbar from '../canonical/CanonicalZone3Toolbar'
import CanonicalProgressiveTableFooter from '../canonical/CanonicalProgressiveTableFooter'
import { getFilterSelectClass } from '../../lib/filterThemeConstants'
import GridRibbon from '../GridRibbon'
import GridStatusBarBottom from '../GridStatusBarBottom'
import GridContextMenu from '../GridContextMenu'
import { useGridContextMenu } from '../../hooks/useGridContextMenu'
import { duplicateRecord, buildPasteRowHandler } from '../../lib/gridRowActions'
import { formatDateAr, getTodayArIso } from '../../lib/dateTimeCanonical'
import { matchesUniversalSearch } from '../../lib/searchEngine'
import HighlightText from '../HighlightText'
import { cleanShipName, cleanLocation, calculateStayDays, STANDARD_LOCATIONS, STAY_CLONE_FIELDS, calculateBerthMeters } from '../../lib/shipsConstants'
import { buildStayFieldPatch, updateGridEntityRowsService, syncShipLocationFromStayService, closeStayQuickService } from '../../lib/shipsService'
import { buildGridCellMeta, executeGridBatchUpdate, resolveShipsAuditUser } from '../../lib/shipsGridHelpers'

export default function ShipsEstadiasPanel({
  stays = [],
  setStays,
  ships = [],
  setShips,
  user,
  activeRolePerspective = 'admin',
  onOpenNewStay,
  onOpenEditStay,
  setStatusMessage,
  loadInitialData
}) {
  const { profile } = useAuth()
  const initialFilters = useMemo(
    () => resolveInitialModuleFilters(user, profile, 'ships_estadias'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [viewModeStays, setViewModeStays] = useState('tabla')
  const [searchTerm, setSearchTerm] = useState(initialFilters.searchTerm)
  const [locationFilter, setLocationFilter] = useState(initialFilters.locationFilter)

  const estadiasViewsController = useModuleFilterMemory({
    moduleKey: 'ships_estadias',
    currentFilters: { searchTerm, locationFilter },
    setters: { searchTerm: setSearchTerm, locationFilter: setLocationFilter },
    hasActiveFilters: Boolean(searchTerm || locationFilter !== 'todos')
  })
  const [inlineStayEdit, setInlineStayEdit] = useState(null)
  const searchInputRef = useRef(null)
  const staysPasteRef = useRef(null)
  const gridScrollRef = useRef(null)
  const { menuTarget, openMenu, closeMenu } = useGridContextMenu()
  const showFeedback = useCallback((type, text) => setStatusMessage?.({ type, text }), [setStatusMessage])

  // Cálculo de metros lineales de muelle ocupados
  const berthOccupancy = useMemo(() => {
    return calculateBerthMeters(ships, stays)
  }, [ships, stays])

  // Columnas para spreadsheet grid
  const staysGridColumns = useMemo(() => [
    {
      key: 'location',
      label: 'Locación',
      getValue: (st) => cleanLocation(st.location),
      formatDisplay: (val) => val
    },
    {
      key: 'ship_id',
      label: 'Buque',
      getValue: (st) => st.ship_id || '',
      formatDisplay: (val) => {
        const s = ships.find(shp => shp.id === val)
        return s ? cleanShipName(s.name) : 'Sin asignar'
      }
    },
    {
      key: 'start_date',
      label: 'Fecha Comienzo',
      getValue: (st) => st.start_date || '',
      formatDisplay: (val) => val
    },
    {
      key: 'end_date',
      label: 'Fecha Fin',
      getValue: (st) => st.end_date || '',
      formatDisplay: (val) => val || 'En curso (=HOY)'
    }
  ], [ships])

  // Filtrado de estadías
  const filteredStays = useMemo(() => {
    return stays.filter(stay => {
      if (searchTerm) {
        const shipObj = ships.find(s => s.id === stay.ship_id)
        const match = matchesUniversalSearch(stay, searchTerm, ['location', 'start_date', 'end_date', 'notes']) ||
          (shipObj && matchesUniversalSearch(shipObj, searchTerm, ['name', 'matricula', 'vessel_type']))
        if (!match) return false
      }

      if (locationFilter !== 'todos') {
        const locClean = cleanLocation(stay.location)
        if (locationFilter === 'VARADERO' && locClean !== 'VARADERO') return false
        if (locationFilter === 'MUELLE' && locClean !== 'MUELLE') return false
        if (locationFilter === 'PUERTO' && !locClean.includes('PUERTO')) return false
      }

      return true
    })
  }, [stays, ships, searchTerm, locationFilter])

  // Mutación atómica en DB con sincronización de locación de buque activo y auditoría
  const applyStaySinglePatch = useCallback(async (rowId, colKey, rawValue, { skipAudit = true } = {}) => {
    const targetStay = stays.find((s) => s.id === rowId)
    const built = buildStayFieldPatch(colKey, rawValue, ships)
    if (!built) return null

    setStays((prev) => prev.map((s) => (s.id === rowId ? { ...s, ...built.localPatch } : s)))
    await updateGridEntityRowsService({
      table: 'ship_stays',
      entityType: 'ship_stays',
      sheetName: 'Barcos · Estadías y Movimientos',
      ids: [rowId],
      dbPatch: built.dbPatch,
      auditMeta: skipAudit
        ? null
        : {
            mode: 'cell',
            entityName: `Estadía ${cleanShipName(targetStay?.ships?.name) || rowId}`,
            field: colKey,
            oldValue: targetStay?.[colKey] ?? null,
            newValue: built.normalizedValue,
            changeOrigin: 'PASTE_OR_UNDO'
          },
      user: resolveShipsAuditUser(user, activeRolePerspective)
    })

    if (colKey === 'location' && targetStay && !targetStay.end_date && targetStay.ship_id) {
      await syncShipLocationFromStayService({ shipId: targetStay.ship_id, location: built.normalizedValue })
      setShips?.((prev) => prev.map((shp) => (shp.id === targetStay.ship_id ? { ...shp, current_location: built.normalizedValue } : shp)))
    }
    return built.normalizedValue
  }, [stays, ships, setStays, setShips, user, activeRolePerspective])

  // Batch update canónico (Fill Down, Paste Matrix 2D y Undo/Redo)
  const handleStaysBatchUpdate = useCallback(async (args) => {
    await executeGridBatchUpdate({
      ...args,
      applySingle: applyStaySinglePatch,
      applyBatch: async (ids, colKey, newValue) => {
        const built = buildStayFieldPatch(colKey, newValue, ships)
        if (!built) return
        setStays((prev) => prev.map((s) => (ids.includes(s.id) ? { ...s, ...built.localPatch } : s)))
        await updateGridEntityRowsService({
          table: 'ship_stays',
          entityType: 'ship_stays',
          sheetName: 'Barcos · Estadías y Movimientos',
          ids,
          dbPatch: built.dbPatch,
          auditMeta: {
            mode: 'batch',
            entityName: `${ids.length} estadías`,
            changes: { colKey, newValue: built.normalizedValue, affectedCount: ids.length }
          },
          user: resolveShipsAuditUser(user, activeRolePerspective)
        })
        if (colKey === 'location') {
          const activeShipIds = [...new Set(stays.filter((s) => ids.includes(s.id) && !s.end_date && s.ship_id).map((s) => s.ship_id))]
          for (const shipId of activeShipIds) {
            await syncShipLocationFromStayService({ shipId, location: built.normalizedValue })
          }
          if (activeShipIds.length > 0) {
            setShips?.((prev) => prev.map((shp) => (activeShipIds.includes(shp.id) ? { ...shp, current_location: built.normalizedValue } : shp)))
          }
        }
      },
      onReload: loadInitialData
    })
  }, [applyStaySinglePatch, ships, stays, setStays, setShips, user, activeRolePerspective, loadInitialData])

  // Hook canónico spreadsheet grid
  const staysGrid = useSpreadsheetGrid({
    rows: filteredStays,
    columns: staysGridColumns,
    getRowId: (st) => st.id,
    onBatchUpdate: handleStaysBatchUpdate,
    onPasteRow: (args) => staysPasteRef.current?.(args),
    onFocusSearch: () => searchInputRef.current?.focus(),
    onCellActivate: (row, colDef, rowIndex) => {
      setInlineStayEdit({
        rowIndex,
        colKey: colDef.key,
        rowId: row.id,
        value: colDef.getValue ? colDef.getValue(row) : (row[colDef.key] ?? '')
      })
    },
    storageKey: 'aloncar_grid_ship_stays',
    showFeedback
  })

  const { visibleItems: visibleStays, visibleCount: visibleStaysCount, hasMore: hasMoreStays, remainingCount: remainingStaysCount, loadMore: loadMoreStays, showAll: showAllStays, sentinelRef: staysSentinelRef } = useProgressiveRows({
    items: filteredStays,
    resetKey: `${searchTerm}|${locationFilter}|${viewModeStays}`,
    activeIndex: staysGrid.activeCell?.rowIndex ?? -1,
    scrollContainerRef: gridScrollRef
  })

  useEffect(() => {
    staysPasteRef.current = buildPasteRowHandler({
      table: 'ship_stays',
      entityType: 'ship_stays',
      fields: STAY_CLONE_FIELDS,
      grid: staysGrid,
      setList: setStays,
      mergeLocal: (row, patch) => {
        const nextShip = patch.ship_id !== undefined
          ? (patch.ship_id ? (ships.find((s) => s.id === patch.ship_id) || null) : null)
          : row.ships
        return { ...row, ...patch, ships: nextShip }
      },
      nameOf: (r) => cleanShipName(r.ships?.name) || r.id,
      showFeedback,
      user: user?.email
    })
  }, [staysGrid, setStays, ships, showFeedback, user])

  const getStaysCellProps = (rowIndex, colKey) =>
    buildGridCellMeta({
      grid: staysGrid,
      columns: staysGridColumns,
      rowIndex,
      colKey,
      inlineEdit: inlineStayEdit,
      extraClass: colKey === 'start_date' || colKey === 'end_date' ? 'text-center' : '',
      onStartEdit: (rIdx, key) => {
        const stay = filteredStays[rIdx]
        if (!stay) return
        const colDef = staysGridColumns.find((c) => c.key === key)
        setInlineStayEdit({
          rowIndex: rIdx,
          colKey: key,
          rowId: stay.id,
          value: colDef?.getValue ? colDef.getValue(stay) : (stay[key] ?? '')
        })
      }
    })

  // Guardado de edición inline
  const commitInlineStayEdit = async (overrideValue = undefined) => {
    if (!inlineStayEdit) return
    const { rowId, colKey } = inlineStayEdit
    const nextRaw = overrideValue !== undefined ? overrideValue : inlineStayEdit.value
    const stay = stays.find((s) => s.id === rowId)
    setInlineStayEdit(null)
    if (!stay) return

    const colDef = staysGridColumns.find((c) => c.key === colKey)
    const prevValue = colDef?.getValue ? colDef.getValue(stay) : (stay[colKey] ?? '')
    try {
      const normalized = await applyStaySinglePatch(rowId, colKey, nextRaw, { skipAudit: true })
      if (normalized !== null && String(prevValue ?? '') !== String(normalized ?? '')) {
        staysGrid.pushUndoAction({
          colKey,
          colLabel: colDef?.label || colKey,
          actionLabel: `Edición de ${colDef?.label || colKey}`,
          previousValues: { [rowId]: prevValue },
          newValue: normalized,
          timestamp: Date.now()
        })
      }
    } catch (err) {
      showFeedback('error', 'Error guardando celda: ' + err.message)
      await loadInitialData?.()
    }
  }

  // Cierre rápido de estadía a la fecha actual
  const handleCloseStayQuick = async (stay) => {
    const today = getTodayArIso()
    try {
      await closeStayQuickService({ stay, today, user: resolveShipsAuditUser(user, activeRolePerspective) })
      showFeedback('success', `Cierre de estadía registrado al día ${today}.`)
      if (loadInitialData) await loadInitialData()
    } catch (err) {
      showFeedback('error', err.message)
    }
  }

  // Duplicar estadía
  const handleDuplicateStay = async (stay) => {
    try {
      await duplicateRecord({
        table: 'ship_stays',
        entityType: 'ship_stays',
        source: stay,
        fields: STAY_CLONE_FIELDS,
        nameOf: () => cleanShipName(stay.ships?.name) || stay.id,
        user: user?.email
      })
      if (setStatusMessage) setStatusMessage({ type: 'success', text: 'Estadía duplicada correctamente.' })
      if (loadInitialData) await loadInitialData()
    } catch (err) {
      if (setStatusMessage) setStatusMessage({ type: 'error', text: `Error al duplicar estadía: ${err.message}` })
    }
  }

  const isAllStaysSelected = filteredStays.length > 0 && filteredStays.every((s) => staysGrid.selectedRowIds.has(s.id))
  const hasActiveFilter = Boolean(searchTerm || locationFilter !== 'todos')
  const clearAllFilters = () => { setLocationFilter('todos'); setSearchTerm('') }
  const renderFillHandle = (cp) =>
    cp.renderHandle ? (
      <div
        onMouseDown={staysGrid.handleFillHandleMouseDown}
        onDoubleClick={staysGrid.handleFillHandleDoubleClick}
        title="Arrastrar para rellenar celdas (■)"
        className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-950 rounded-xs cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
      />
    ) : null

  return (
    <div className="space-y-4">
      {/* BANNER DE OCUPACIÓN DE MUELLE (METROS LINEALES) */}
      <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 shrink-0">
            <Anchor className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="font-extrabold text-white text-xs uppercase tracking-wider">
                Ocupación de Muelle en Vivo
              </h4>
              <span className="px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/30">
                {berthOccupancy.shipsDockedCount} buque(s) amarrados
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Metros lineales de muelle ocupados según eslora registrada: <strong className="text-white font-mono">{berthOccupancy.occupiedMeters.toFixed(1)} m</strong> de aprox. {berthOccupancy.capacityMeters} m ({berthOccupancy.percentage.toFixed(0)}% ocupado).
            </p>
          </div>
        </div>

        {berthOccupancy.dockedShips?.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 self-end sm:self-auto">
            {berthOccupancy.dockedShips.map(s => (
              <span
                key={s.id}
                className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-[10px] font-mono font-bold"
              >
                {cleanShipName(s.name)} ({s.eslora_mts ? `${s.eslora_mts}m` : 'S/D'})
              </span>
            ))}
          </div>
        )}
      </div>

      {/* ZONA 3: TOOLBAR CORPORATIVA CON BUSCADOR Y FILTROS */}
      <CanonicalZone3Toolbar
        className="rounded-2xl"
        searchInputRef={searchInputRef}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar estadía por buque, locación o fecha... (Ctrl+F | Esc limpia todo)"
        viewsController={estadiasViewsController}
        hasActiveFilters={Boolean(locationFilter !== 'todos' || searchTerm.trim())}
        onClearAllFilters={() => {
          setLocationFilter('todos')
          setSearchTerm('')
        }}
        history={staysGrid}
        viewModeToggle={{
          value: viewModeStays,
          onChange: setViewModeStays,
          rowsValue: 'tabla',
          cardsValue: 'tarjetas'
        }}
        filters={
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className={getFilterSelectClass('location', locationFilter !== 'todos')}
            title="Filtrar por Locación"
          >
            <option value="todos" className="bg-slate-900">Todas las Locaciones</option>
            <option value="VARADERO" className="bg-slate-900">Varadero</option>
            <option value="MUELLE" className="bg-slate-900">Muelle</option>
            <option value="PUERTO" className="bg-slate-900">Puertos Aldana</option>
          </select>
        }
      />

      {/* VISTA 1: TABLA EDITABLE (ZONA 4) */}
      {viewModeStays === 'tabla' && (
        <div
          ref={staysGrid.gridContainerRef}
          tabIndex={0}
          onKeyDown={staysGrid.handleKeyDown}
          onPaste={staysGrid.handlePaste}
          className="alon-zone-grid rounded-2xl overflow-hidden shadow-xl focus:outline-none"
        >
          <GridRibbon
            activeCellBadge={staysGrid.activeCellBadge}
            onInsertRow={() => onOpenNewStay()}
            insertRowLabel="Registrar Movimiento"
            undoCount={staysGrid.undoStack?.length || 0}
            totalRows={filteredStays.length}
            entityName="estadías"
            exportRows={filteredStays}
            exportFilename={`barcos_estadias_${getTodayArIso()}`}
          />

          <div ref={gridScrollRef} className="alon-grid-scroll">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="alon-grid-thead sticky top-0 z-20 shadow-sm backdrop-blur-md">
                <tr className="text-slate-300 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2 px-1 w-9 text-center select-none">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => staysGrid.toggleSelectAll(filteredStays.map((s) => s.id))}
                        className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                        title="Seleccionar o deseleccionar todas las estadías visibles"
                      >
                        {isAllStaysSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="font-mono text-[9px] text-slate-500 font-bold">#</span>
                    </div>
                  </th>
                  <th {...staysGrid.getColumnHeaderProps('location', 'py-3 px-4')}>Locación ✎</th>
                  <th {...staysGrid.getColumnHeaderProps('ship_id', 'py-3 px-4')}>Buque ✎</th>
                  <th {...staysGrid.getColumnHeaderProps('start_date', 'py-3 px-4 text-center')}>Comienzo ✎</th>
                  <th {...staysGrid.getColumnHeaderProps('end_date', 'py-3 px-4 text-center')}>Fin ✎</th>
                  <th className="py-3 px-4 text-center text-cyan-300">Días de Estadía</th>
                  <th className="py-3 px-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs font-medium">
                {filteredStays.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500">
                      No hay movimientos registrados todavía. Tocá &ldquo;+ Registrar Movimiento&rdquo; para asentar el primer ingreso.
                    </td>
                  </tr>
                ) : (
                  <>
                    {visibleStays.map((stay, rowIndex) => {
                    const isStaySelected = staysGrid.selectedRowIds.has(stay.id)
                    const isOngoing = !stay.end_date
                    const days = calculateStayDays(stay.start_date, stay.end_date)
                    const locClean = cleanLocation(stay.location)
                    const cpLoc = getStaysCellProps(rowIndex, 'location')
                    const cpShip = getStaysCellProps(rowIndex, 'ship_id')
                    const cpStart = getStaysCellProps(rowIndex, 'start_date')
                    const cpEnd = getStaysCellProps(rowIndex, 'end_date')

                    return (
                      <tr
                        key={stay.id}
                        onContextMenu={(e) => openMenu(e, stay, rowIndex, { entityType: 'ship_stays', recordId: stay.id, recordLabel: cleanShipName(stay.ships?.name) }, staysGrid)}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isStaySelected ? 'bg-cyan-950/40 text-cyan-50' : ''
                        }`}
                      >
                        {/* 0. Columna 0 Canónica */}
                        <td className="py-1 px-1 text-center w-9 select-none relative">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => staysGrid.toggleSelectRow(stay.id)}
                              className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                              title="Seleccionar estadía"
                            >
                              {isStaySelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                              ) : (
                                <Square className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                openMenu(e, stay, rowIndex, { entityType: 'ship_stays', recordId: stay.id, recordLabel: cleanShipName(stay.ships?.name), isRowHeader: true }, staysGrid)
                              }}
                              className="font-mono text-[9px] text-slate-500 hover:text-cyan-300 cursor-pointer font-bold"
                              title="Menú contextual"
                            >
                              #{stay._rowSeq || (rowIndex + 1)}
                            </button>
                          </div>
                        </td>

                        {/* 1. Locación (Editable) */}
                        <td {...cpLoc.domProps}>
                          {cpLoc.isEditing ? (
                            <select
                              autoFocus
                              value={cleanLocation(inlineStayEdit.value)}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                setInlineStayEdit({ ...inlineStayEdit, value: e.target.value })
                                commitInlineStayEdit(e.target.value)
                              }}
                              onBlur={() => commitInlineStayEdit()}
                              onKeyDown={(e) => {
                                e.stopPropagation()
                                if (e.key === 'Escape') setInlineStayEdit(null)
                              }}
                              className="w-full bg-slate-950 border border-primary rounded px-1.5 py-1 text-xs text-white font-bold focus:outline-none cursor-pointer"
                            >
                              {STANDARD_LOCATIONS.map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold border inline-flex items-center gap-1.5 whitespace-nowrap ${
                              locClean === 'VARADERO'
                                ? 'bg-amber-950 text-amber-300 border-amber-800'
                                : locClean === 'MUELLE'
                                ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                              <HighlightText text={locClean} query={searchTerm} />
                            </span>
                          )}
                          {renderFillHandle(cpLoc)}
                        </td>

                        {/* 2. Buque (Editable) */}
                        <td {...cpShip.domProps}>
                          {cpShip.isEditing ? (
                            <select
                              autoFocus
                              value={inlineStayEdit.value}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => {
                                setInlineStayEdit({ ...inlineStayEdit, value: e.target.value })
                                commitInlineStayEdit(e.target.value)
                              }}
                              onBlur={() => commitInlineStayEdit()}
                              onKeyDown={(e) => {
                                e.stopPropagation()
                                if (e.key === 'Escape') setInlineStayEdit(null)
                              }}
                              className="w-full bg-slate-950 border border-primary rounded px-1.5 py-1 text-xs text-white focus:outline-none cursor-pointer"
                            >
                              <option value="">-- Seleccionar Buque --</option>
                              {ships.map(s => (
                                <option key={s.id} value={s.id}>{cleanShipName(s.name)}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="font-extrabold text-white text-xs">
                              <HighlightText text={cleanShipName(stay.ships?.name || 'Buque S/D')} query={searchTerm} />
                              {stay.notes && (
                                <p className="text-[10px] text-slate-400 font-normal mt-0.5 line-clamp-1">
                                  {stay.notes}
                                </p>
                              )}
                            </div>
                          )}
                          {renderFillHandle(cpShip)}
                        </td>

                        {/* 3. Fecha Comienzo (Editable) */}
                        <td {...cpStart.domProps}>
                          {cpStart.isEditing ? (
                            <input
                              type="date"
                              autoFocus
                              value={inlineStayEdit.value}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setInlineStayEdit({ ...inlineStayEdit, value: e.target.value })}
                              onBlur={() => commitInlineStayEdit()}
                              onKeyDown={(e) => {
                                e.stopPropagation()
                                if (e.key === 'Enter') commitInlineStayEdit()
                                if (e.key === 'Escape') setInlineStayEdit(null)
                              }}
                              className="bg-slate-950 border border-primary rounded px-1.5 py-1 text-xs text-white font-mono focus:outline-none"
                            />
                          ) : (
                            <span className="font-mono text-slate-300">
                              <HighlightText text={formatDateAr(stay.start_date)} query={searchTerm} />
                            </span>
                          )}
                          {renderFillHandle(cpStart)}
                        </td>

                        {/* 4. Fecha Fin (Editable) */}
                        <td {...cpEnd.domProps}>
                          {cpEnd.isEditing ? (
                            <input
                              type="date"
                              autoFocus
                              value={inlineStayEdit.value}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setInlineStayEdit({ ...inlineStayEdit, value: e.target.value })}
                              onBlur={() => commitInlineStayEdit()}
                              onKeyDown={(e) => {
                                e.stopPropagation()
                                if (e.key === 'Enter') commitInlineStayEdit()
                                if (e.key === 'Escape') setInlineStayEdit(null)
                              }}
                              className="bg-slate-950 border border-primary rounded px-1.5 py-1 text-xs text-white font-mono focus:outline-none"
                            />
                          ) : isOngoing ? (
                            <span className="px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800 text-[10px] font-bold inline-flex items-center gap-1 font-mono">
                              <Clock className="w-3 h-3 animate-pulse" />
                              <span>En curso (=HOY)</span>
                            </span>
                          ) : (
                            <span className="font-mono text-slate-300">
                              <HighlightText text={formatDateAr(stay.end_date)} query={searchTerm} />
                            </span>
                          )}
                          {renderFillHandle(cpEnd)}
                        </td>

                        {/* 5. Días de Estadía */}
                        <td className="py-3 px-4 text-center">
                          <span className={`font-mono font-black text-sm ${
                            isOngoing ? 'text-cyan-300' : 'text-slate-300'
                          }`}>
                            {days} {days === 1 ? 'día' : 'días'}
                          </span>
                        </td>

                        {/* 6. Acciones */}
                        <td className="py-3 px-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1.5">
                            {isOngoing && (
                              <button
                                type="button"
                                onClick={() => handleCloseStayQuick(stay)}
                                className="px-2 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                                title="Cerrar estadía al día de hoy"
                              >
                                <CheckCircle className="w-3 h-3" />
                                <span>Cerrar</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => onOpenEditStay(stay)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                              title="Editar Estadía"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateStay(stay)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-cyan-300 cursor-pointer"
                              title="Duplicar Estadía"
                            >
                              <CopyPlus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                    <CanonicalProgressiveTableFooter colSpan={7} visibleCount={visibleStaysCount} totalCount={filteredStays.length} remainingCount={remainingStaysCount} hasMore={hasMoreStays} loadMore={loadMoreStays} showAll={showAllStays} sentinelRef={staysSentinelRef} entityLabel="estadías" />
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Menú Contextual Canónico */}
          {menuTarget && (
            <GridContextMenu
              target={menuTarget}
              onClose={closeMenu}
              onCopyCell={staysGrid.copyActiveCell}
              onCopyRow={staysGrid.copyRow}
              onPaste={staysGrid.pasteToActiveOrRange}
              onDeleteCell={staysGrid.deleteActiveCellOrRange}
              onInsertRowAbove={() => onOpenNewStay()}
              onDuplicateRow={(row) => handleDuplicateStay(row)}
              entityType="ship_stays"
              recordId={menuTarget.recordId}
              recordLabel={menuTarget.recordLabel}
            />
          )}
        </div>
      )}

      {/* VISTA 2: TARJETAS */}
      {viewModeStays === 'tarjetas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredStays.length === 0 ? (
            <div className="col-span-full p-10 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
              No hay movimientos registrados que coincidan con la búsqueda.
            </div>
          ) : (
            <>
              {visibleStays.map(stay => {
              const days = calculateStayDays(stay.start_date, stay.end_date)
              const locClean = cleanLocation(stay.location)
              const isOngoing = !stay.end_date

              return (
                <div
                  key={stay.id}
                  className="p-4 rounded-2xl border border-slate-800 bg-slate-900 hover:border-cyan-500/40 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <h4 className="font-extrabold text-white text-sm">
                        <HighlightText text={cleanShipName(stay.ships?.name || 'Buque S/D')} query={searchTerm} />
                      </h4>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {formatDateAr(stay.start_date)} &rarr; {stay.end_date ? formatDateAr(stay.end_date) : 'En curso'}
                      </div>
                    </div>

                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                      locClean === 'VARADERO'
                        ? 'bg-amber-950 text-amber-300 border-amber-800'
                        : locClean === 'MUELLE'
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}>
                      {locClean}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <span className="text-xs text-slate-400">Permanencia:</span>
                    <strong className="text-base font-black text-cyan-300 font-mono">
                      {days} {days === 1 ? 'día' : 'días'} {isOngoing && '• en curso'}
                    </strong>
                  </div>

                  {stay.notes && (
                    <p className="text-xs text-slate-400 italic bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
                      &ldquo;{stay.notes}&rdquo;
                    </p>
                  )}

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    {isOngoing && (
                      <button
                        type="button"
                        onClick={() => handleCloseStayQuick(stay)}
                        className="flex-1 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Cerrar Estadía</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onOpenEditStay(stay)}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                      title="Editar Estadía"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
              <CanonicalProgressiveTableFooter asDiv className="col-span-full" visibleCount={visibleStaysCount} totalCount={filteredStays.length} remainingCount={remainingStaysCount} hasMore={hasMoreStays} loadMore={loadMoreStays} showAll={showAllStays} sentinelRef={staysSentinelRef} entityLabel="estadías" />
            </>
          )}
        </div>
      )}

      {/* ZONA 5: BARRA DE ESTADO INFERIOR */}
      <GridStatusBarBottom
        filteredCount={filteredStays.length}
        totalCount={stays.length}
        entityName="estadías"
        hasActiveFilter={hasActiveFilter}
        onClearFilters={clearAllFilters}
        selectionStats={staysGrid.selectionStats}
        onClearSelection={() => staysGrid.setSelectionRange(null)}
        customSelection={
          staysGrid.selectedRowIds.size > 0
            ? {
                count: staysGrid.selectedRowIds.size,
                label: 'estadías seleccionadas',
                onClear: staysGrid.clearSelectedRows
              }
            : null
        }
      />
    </div>
  )
}
