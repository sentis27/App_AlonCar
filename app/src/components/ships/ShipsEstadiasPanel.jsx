import React, { useState, useMemo, useCallback } from 'react'
import {
  Calendar,
  Pencil,
  Trash2,
  CopyPlus,
  CheckSquare,
  Square,
  Undo2,
  Redo2,
  Layers,
  ClipboardList,
  Anchor,
  Clock,
  CheckCircle,
  X
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSpreadsheetGrid } from '../../hooks/useSpreadsheetGrid'
import { logCellChange, logRowAction } from '../../lib/auditService'
import CrawlerSearchBar from '../CrawlerSearchBar'
import GridRibbon from '../GridRibbon'
import GridStatusBarBottom from '../GridStatusBarBottom'
import GridContextMenu from '../GridContextMenu'
import { useGridContextMenu } from '../../hooks/useGridContextMenu'
import { duplicateRecord, buildPasteRowHandler } from '../../lib/gridRowActions'
import { matchesUniversalSearch } from '../../lib/searchEngine'
import HighlightText from '../HighlightText'
import {
  cleanShipName,
  cleanLocation,
  calculateStayDays,
  STANDARD_LOCATIONS,
  STAY_CLONE_FIELDS,
  calculateBerthMeters
} from '../../lib/shipsConstants'

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
  // Vista local: 'tabla' | 'tarjetas'
  const [viewModeStays, setViewModeStays] = useState('tabla')

  // Filtros locales
  const [searchTerm, setSearchTerm] = useState('')
  const [locationFilter, setLocationFilter] = useState('todos')

  // Inline edit state
  const [inlineStayEdit, setInlineStayEdit] = useState(null)

  // Context menu canónico
  const {
    menuState,
    openMenu,
    closeMenu,
    handleCopy,
    handlePaste,
    handleInsertAbove,
    handleInsertBelow,
    handleDuplicate,
    handleDelete,
    showAuditModal,
    auditModalInfo,
    closeAuditModal
  } = useGridContextMenu()

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

  // Mutación atómica en DB con auditoría
  const applyStaySinglePatch = useCallback(async (rowId, colKey, rawValue) => {
    const targetStay = stays.find(s => s.id === rowId)
    if (!targetStay) return null

    let dbPatch = {}
    let localPatch = {}
    let returnedVal = rawValue

    if (colKey === 'location') {
      const loc = cleanLocation(rawValue).toUpperCase()
      dbPatch = { location: loc }
      localPatch = { location: loc }
      returnedVal = loc
    } else if (colKey === 'ship_id') {
      const nextShipId = rawValue ? String(rawValue).trim() : null
      const nextShipObj = nextShipId ? (ships.find(s => s.id === nextShipId) || null) : null
      dbPatch = { ship_id: nextShipId }
      localPatch = { ship_id: nextShipId, ships: nextShipObj }
      returnedVal = nextShipId || ''
    } else if (colKey === 'start_date') {
      dbPatch = { start_date: rawValue || null }
      localPatch = { start_date: rawValue || null }
      returnedVal = rawValue || ''
    } else if (colKey === 'end_date') {
      dbPatch = { end_date: rawValue || null }
      localPatch = { end_date: rawValue || null }
      returnedVal = rawValue || ''
    } else {
      return null
    }

    setStays(prev => prev.map(s => (s.id === rowId ? { ...s, ...localPatch } : s)))
    const { error } = await supabase.from('ship_stays').update(dbPatch).eq('id', rowId)
    if (error) throw error

    logCellChange({
      entityType: 'ship_stays',
      entityId: rowId,
      entityName: `Estadía ${rowId}`,
      field: colKey,
      fieldLabel: colKey,
      oldValue: targetStay ? targetStay[colKey] : null,
      newValue: returnedVal,
      sheetName: 'Barcos · Estadías y Movimientos',
      moduleRoute: '/barcos',
      changeOrigin: 'INLINE_CELL',
      user: activeRolePerspective === 'admin' ? 'JORGE SENTIS' : 'MARIA JOSE'
    })

    return returnedVal
  }, [stays, ships, setStays, activeRolePerspective])

  // Batch update para fill-handle
  const handleStaysBatchUpdate = useCallback(async ({ colKey, newValue, targetIds }) => {
    if (!targetIds || targetIds.length === 0) return
    const ids = Array.from(targetIds)

    let dbPatch = {}
    let localPatch = {}

    if (colKey === 'location') {
      const loc = cleanLocation(newValue).toUpperCase()
      dbPatch = { location: loc }
      localPatch = { location: loc }
    } else if (colKey === 'ship_id') {
      const nextShipId = newValue ? String(newValue).trim() : null
      const nextShipObj = nextShipId ? (ships.find(s => s.id === nextShipId) || null) : null
      dbPatch = { ship_id: nextShipId }
      localPatch = { ship_id: nextShipId, ships: nextShipObj }
    } else if (colKey === 'start_date' || colKey === 'end_date') {
      dbPatch = { [colKey]: newValue || null }
      localPatch = { [colKey]: newValue || null }
    } else {
      return
    }

    setStays(prev => prev.map(s => (ids.includes(s.id) ? { ...s, ...localPatch } : s)))
    const { error } = await supabase.from('ship_stays').update(dbPatch).in('id', ids)
    if (error) {
      console.error('Error en batch update de estadías:', error)
      await loadInitialData?.()
      throw error
    }

    logRowAction({
      action: 'BATCH_FILL',
      entityType: 'ship_stays',
      entityId: `batch_${ids.length}`,
      entityName: `${ids.length} estadías`,
      changes: { colKey, newValue, affectedCount: ids.length },
      sheetName: 'Barcos · Estadías y Movimientos',
      moduleRoute: '/barcos',
      changeOrigin: 'DRAG_FILL',
      user: activeRolePerspective === 'admin' ? 'JORGE SENTIS' : 'MARIA JOSE'
    })
  }, [ships, setStays, loadInitialData, activeRolePerspective])

  // Paste handler 2D
  const handlePasteStayRows = useMemo(() => {
    return buildPasteRowHandler({
      table: 'ship_stays',
      columns: ['location', 'start_date', 'end_date'],
      transformRow: (cells) => {
        return {
          location: cleanLocation(cells[0] || 'VARADERO'),
          start_date: cells[1] || new Date().toISOString().split('T')[0],
          end_date: cells[2] || null
        }
      },
      onSuccess: async () => {
        if (loadInitialData) await loadInitialData()
      },
      onError: (err) => {
        if (setStatusMessage) setStatusMessage({ type: 'error', text: 'Error al pegar estadías: ' + err.message })
      },
      user: user?.email
    })
  }, [loadInitialData, setStatusMessage, user])

  // Hook canónico spreadsheet grid
  const staysGrid = useSpreadsheetGrid({
    data: filteredStays,
    columns: staysGridColumns,
    onBatchUpdate: handleStaysBatchUpdate,
    onPasteRows: handlePasteStayRows,
    storageKey: 'aloncar_grid_ship_stays'
  })

  // Props de celda para navegación espacial
  const getStaysCellProps = (rowIndex, colKey) => {
    const isFocused = staysGrid.focusedCell?.rowIndex === rowIndex && staysGrid.focusedCell?.colKey === colKey
    const isSelected = staysGrid.isCellSelected(rowIndex, colKey)
    const isEditing = inlineStayEdit?.rowIndex === rowIndex && inlineStayEdit?.colKey === colKey
    const isFillHandleSource = staysGrid.isFillHandleSource(rowIndex, colKey)

    return {
      tabIndex: -1,
      'data-row': rowIndex,
      'data-col': colKey,
      className: `relative px-3 py-2 cursor-pointer transition-colors border-r border-b border-slate-800/80 outline-none select-none ${
        isEditing
          ? 'bg-slate-900 ring-2 ring-primary ring-inset z-20'
          : isFocused
          ? 'bg-cyan-950/60 ring-2 ring-cyan-400 ring-inset z-10'
          : isSelected
          ? 'bg-cyan-950/30'
          : 'hover:bg-slate-800/40'
      }`,
      onClick: (e) => staysGrid.handleCellClick(rowIndex, colKey, e),
      onDoubleClick: () => {
        const stay = filteredStays[rowIndex]
        if (!stay) return
        setInlineStayEdit({
          rowIndex,
          colKey,
          rowId: stay.id,
          value: stay[colKey] !== undefined && stay[colKey] !== null ? stay[colKey] : ''
        })
      },
      onMouseDown: (e) => staysGrid.handleMouseDown(rowIndex, colKey, e),
      onMouseEnter: () => staysGrid.handleMouseEnter(rowIndex, colKey),
      childrenFillHandle: isFillHandleSource ? (
        <div
          {...staysGrid.fillHandleProps}
          title="Arrastrar para rellenar celdas (■)"
          className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-950 rounded-xs cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
        />
      ) : null
    }
  }

  // Guardado de edición inline
  const commitInlineStayEdit = async (overrideValue = undefined) => {
    if (!inlineStayEdit) return
    const { rowId, colKey } = inlineStayEdit
    const nextRaw = overrideValue !== undefined ? overrideValue : inlineStayEdit.value
    const stay = stays.find(s => s.id === rowId)
    setInlineStayEdit(null)
    if (!stay) return

    try {
      await applyStaySinglePatch(rowId, colKey, nextRaw)
    } catch (err) {
      if (setStatusMessage) setStatusMessage({ type: 'error', text: 'Error guardando celda: ' + err.message })
    }
  }

  // Cierre rápido de estadía a la fecha actual
  const handleCloseStayQuick = async (stay) => {
    const today = new Date().toISOString().split('T')[0]
    try {
      const { error } = await supabase
        .from('ship_stays')
        .update({ end_date: today })
        .eq('id', stay.id)

      if (error) throw error

      logRowAction({
        action: 'STATUS_CHANGE',
        entityType: 'ship_stays',
        entityId: stay.id,
        entityName: `Cierre estadía ${stay.id}`,
        changes: { end_date: today },
        sheetName: 'Barcos · Estadías y Movimientos',
        moduleRoute: '/barcos',
        changeOrigin: 'QUICK_ACTION',
        user: user?.email || (activeRolePerspective === 'admin' ? 'JORGE SENTIS' : 'MARIA JOSE')
      })

      if (setStatusMessage) setStatusMessage({ type: 'success', text: `Cierre de estadía registrado al día ${today}.` })
      if (loadInitialData) await loadInitialData()
    } catch (err) {
      if (setStatusMessage) setStatusMessage({ type: 'error', text: err.message })
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
      <div className="alon-zone-toolbar p-3 rounded-2xl shadow-lg flex flex-col gap-2.5">
        <CrawlerSearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar estadía por buque, locación o fecha... (Ctrl+F | Esc limpia todo)"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-medium cursor-pointer"
            >
              <option value="todos">Todas las Locaciones</option>
              <option value="VARADERO">Varadero</option>
              <option value="MUELLE">Muelle</option>
              <option value="PUERTO">Puertos Aldana</option>
            </select>

            {(locationFilter !== 'todos' || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setLocationFilter('todos')
                  setSearchTerm('')
                }}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
                title="Limpiar filtros"
              >
                <X className="w-3.5 h-3.5" />
                <span>Limpiar</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Deshacer / Rehacer */}
            <div className="flex items-center bg-slate-950 border border-slate-800 rounded-xl p-0.5">
              <button
                type="button"
                disabled={!staysGrid.canUndo}
                onClick={staysGrid.undo}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Deshacer (Ctrl + Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!staysGrid.canRedo}
                onClick={staysGrid.redo}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Rehacer (Ctrl + Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* SWITCHER DE VISTA: FILAS VS FICHAS */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setViewModeStays('tabla')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all ${
                  viewModeStays === 'tabla'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista planilla editable"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Filas</span>
              </button>
              <button
                type="button"
                onClick={() => setViewModeStays('tarjetas')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all ${
                  viewModeStays === 'tarjetas'
                    ? 'bg-cyan-500 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista de fichas"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Fichas</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* VISTA 1: TABLA EDITABLE (ZONA 4) */}
      {viewModeStays === 'tabla' && (
        <div
          ref={staysGrid.gridContainerRef}
          tabIndex={0}
          onKeyDown={staysGrid.handleKeyDown}
          className="alon-zone-grid rounded-2xl overflow-hidden shadow-xl focus:outline-none"
        >
          <GridRibbon
            activeCellBadge={staysGrid.activeCellBadge || 'PLANILLA ESTADÍAS'}
            onInsertRow={() => onOpenNewStay()}
            insertRowLabel="+ Registrar Movimiento"
            undoCount={staysGrid.undoStack?.length || 0}
            totalRows={filteredStays.length}
            entityName="estadías"
            exportRows={filteredStays}
            exportFilename={`barcos_estadias_${new Date().toISOString().split('T')[0]}`}
          />

          <div className="alon-grid-scroll">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="alon-grid-thead sticky top-0 z-20 shadow-sm backdrop-blur-md">
                <tr className="text-slate-300 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2 px-1 w-9 text-center select-none">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={staysGrid.toggleSelectAll}
                        className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                        title="Seleccionar o deseleccionar todas las estadías visibles"
                      >
                        {staysGrid.isAllSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="font-mono text-[9px] text-slate-500 font-bold">#</span>
                    </div>
                  </th>
                  <th className="py-3 px-4">Locación ✎</th>
                  <th className="py-3 px-4">Buque ✎</th>
                  <th className="py-3 px-4 text-center">Comienzo ✎</th>
                  <th className="py-3 px-4 text-center">Fin ✎</th>
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
                  filteredStays.map((stay, rowIndex) => {
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
                                openMenu(e, stay, rowIndex, { entityType: 'ship_stays', recordId: stay.id, recordLabel: cleanShipName(stay.ships?.name) }, staysGrid)
                              }}
                              className="font-mono text-[9px] text-slate-500 hover:text-cyan-300 cursor-pointer font-bold"
                              title="Menú contextual"
                            >
                              {stay.folio ? `#${stay.folio}` : `${rowIndex + 1}`}
                            </button>
                          </div>
                        </td>

                        {/* 1. Locación (Editable) */}
                        <td {...cpLoc}>
                          {inlineStayEdit?.rowIndex === rowIndex && inlineStayEdit?.colKey === 'location' ? (
                            <select
                              autoFocus
                              value={cleanLocation(inlineStayEdit.value)}
                              onChange={(e) => {
                                setInlineStayEdit({ ...inlineStayEdit, value: e.target.value })
                                commitInlineStayEdit(e.target.value)
                              }}
                              onBlur={() => commitInlineStayEdit()}
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
                          {cpLoc.childrenFillHandle}
                        </td>

                        {/* 2. Buque (Editable) */}
                        <td {...cpShip}>
                          {inlineStayEdit?.rowIndex === rowIndex && inlineStayEdit?.colKey === 'ship_id' ? (
                            <select
                              autoFocus
                              value={inlineStayEdit.value}
                              onChange={(e) => {
                                setInlineStayEdit({ ...inlineStayEdit, value: e.target.value })
                                commitInlineStayEdit(e.target.value)
                              }}
                              onBlur={() => commitInlineStayEdit()}
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
                          {cpShip.childrenFillHandle}
                        </td>

                        {/* 3. Fecha Comienzo (Editable) */}
                        <td {...cpStart} className={`${cpStart.className} text-center`}>
                          {inlineStayEdit?.rowIndex === rowIndex && inlineStayEdit?.colKey === 'start_date' ? (
                            <input
                              type="date"
                              autoFocus
                              value={inlineStayEdit.value}
                              onChange={(e) => setInlineStayEdit({ ...inlineStayEdit, value: e.target.value })}
                              onBlur={() => commitInlineStayEdit()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitInlineStayEdit()
                                if (e.key === 'Escape') setInlineStayEdit(null)
                              }}
                              className="bg-slate-950 border border-primary rounded px-1.5 py-1 text-xs text-white font-mono focus:outline-none"
                            />
                          ) : (
                            <span className="font-mono text-slate-300">
                              <HighlightText text={stay.start_date || '—'} query={searchTerm} />
                            </span>
                          )}
                          {cpStart.childrenFillHandle}
                        </td>

                        {/* 4. Fecha Fin (Editable) */}
                        <td {...cpEnd} className={`${cpEnd.className} text-center`}>
                          {inlineStayEdit?.rowIndex === rowIndex && inlineStayEdit?.colKey === 'end_date' ? (
                            <input
                              type="date"
                              autoFocus
                              value={inlineStayEdit.value}
                              onChange={(e) => setInlineStayEdit({ ...inlineStayEdit, value: e.target.value })}
                              onBlur={() => commitInlineStayEdit()}
                              onKeyDown={(e) => {
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
                              <HighlightText text={stay.end_date} query={searchTerm} />
                            </span>
                          )}
                          {cpEnd.childrenFillHandle}
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
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Menú Contextual */}
          <GridContextMenu
            menuState={menuState}
            onClose={closeMenu}
            onCopy={handleCopy}
            onPaste={handlePaste}
            onInsertAbove={handleInsertAbove}
            onInsertBelow={handleInsertBelow}
            onDuplicate={handleDuplicate}
            onDelete={handleDelete}
            onViewHistory={showAuditModal}
          />
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
            filteredStays.map(stay => {
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
                        {stay.start_date} &rarr; {stay.end_date || 'En curso'}
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
            })
          )}
        </div>
      )}

      {/* ZONA 5: BARRA DE ESTADO INFERIOR */}
      <GridStatusBarBottom
        selectedCount={staysGrid.selectedRowIds.size}
        totalCount={filteredStays.length}
        activeFilterLabel={locationFilter !== 'todos' ? `Locación: ${locationFilter}` : null}
        onClearSelection={staysGrid.clearRowSelection}
        entityLabel="estadías"
      />
    </div>
  )
}
