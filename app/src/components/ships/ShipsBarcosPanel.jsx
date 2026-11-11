import React, { useState, useMemo, useRef, useCallback } from 'react'
import {
  Ship,
  Plus,
  Pencil,
  Trash2,
  CopyPlus,
  Eye,
  CheckSquare,
  Square,
  Undo2,
  Redo2,
  Layers,
  ClipboardList,
  AlertTriangle,
  BellRing,
  CheckCircle,
  Building2,
  Anchor,
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
  STANDARD_LOCATIONS,
  PREDEFINED_VESSEL_TYPES,
  SHIP_CLONE_FIELDS
} from '../../lib/shipsConstants'

export default function ShipsBarcosPanel({
  ships = [],
  setShips,
  owners = [],
  stays = [],
  getShipOtMetrics = {},
  user,
  activeRolePerspective = 'admin',
  onOpenNewShip,
  onOpenEditShip,
  onOpenShip360,
  onOpenRequestInfo,
  onOpenNewStay,
  onDismissOrphanAlert,
  onAssignOrphan,
  onToggleShipActive,
  onMarkRequestComplete,
  setStatusMessage,
  loadInitialData
}) {
  // Vista local: 'tabla' | 'tarjetas'
  const [viewModeShips, setViewModeShips] = useState('tabla')

  // Filtros locales
  const [searchTerm, setSearchTerm] = useState('')
  const [locationFilter, setLocationFilter] = useState('todos')
  const [requestFilter, setRequestFilter] = useState('todos')
  const [roleQuickFilter, setRoleQuickFilter] = useState('todos')

  // Inline edit state
  const [inlineShipEdit, setInlineShipEdit] = useState(null)

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

  // Columnas para spreadsheet grid
  const shipsGridColumns = useMemo(() => [
    {
      key: 'name',
      label: 'Buque',
      getValue: (s) => cleanShipName(s.name),
      formatDisplay: (val) => val
    },
    {
      key: 'vessel_type',
      label: 'Tipo',
      getValue: (s) => s.vessel_type || 'Pesquero',
      formatDisplay: (val) => val
    },
    {
      key: 'current_location',
      label: 'Locación',
      getValue: (s) => cleanLocation(s.current_location),
      formatDisplay: (val) => val
    },
    {
      key: 'owner_id',
      label: 'Armador / Empresa',
      getValue: (s) => s.owner_id || '',
      formatDisplay: (val) => owners.find(o => o.id === val)?.name || 'Sin asignar'
    }
  ], [owners])

  // Filtrado de buques
  const filteredShips = useMemo(() => {
    return ships.filter(ship => {
      // 1. Buscador omnicanal
      if (searchTerm) {
        const ownerObj = owners.find(o => o.id === ship.owner_id)
        const match = matchesUniversalSearch(ship, searchTerm, [
          'name',
          'matricula',
          'vessel_type',
          'current_location',
          'notes'
        ]) || (ownerObj && matchesUniversalSearch(ownerObj, searchTerm, ['name', 'armador_name', 'armador_phone', 'email_principal', 'cuit']))
        if (!match) return false
      }

      // 2. Filtro por locación
      if (locationFilter !== 'todos') {
        const cleanLoc = cleanLocation(ship.current_location)
        if (locationFilter === 'VARADERO' && cleanLoc !== 'VARADERO') return false
        if (locationFilter === 'MUELLE' && cleanLoc !== 'MUELLE') return false
        if (locationFilter === 'PUERTO' && !cleanLoc.includes('PUERTO')) return false
      }

      // 3. Filtro por estado de solicitud de info
      if (requestFilter === 'pendientes') {
        if (!ship.info_request_status || ship.info_request_status === 'completo') return false
      } else if (requestFilter === 'completos') {
        if (ship.info_request_status && ship.info_request_status !== 'completo') return false
      }

      // 4. Filtro por rol / perspectiva
      if (roleQuickFilter === 'mis_tareas') {
        if (activeRolePerspective === 'jefe_obra') {
          const isPendingMe = ship.info_request_status === 'pendiente_jefe_obra' || ship.info_request_status === 'pendiente_ambos'
          const lacksSpecs = !ship.eslora_mts || !ship.manga_mts || !ship.superficie_casco_m2
          if (!isPendingMe && !lacksSpecs) return false
        } else if (activeRolePerspective === 'maria_jose') {
          const isPendingMe = ship.info_request_status === 'pendiente_maria_jose' || ship.info_request_status === 'pendiente_ambos'
          const isOrphan = ship.orphan_owner_alert || !ship.owner_id
          if (!isPendingMe && !isOrphan) return false
        }
      }

      return true
    })
  }, [ships, owners, searchTerm, locationFilter, requestFilter, roleQuickFilter, activeRolePerspective])

  // Mutación atómica en DB con auditoría
  const applyShipSinglePatch = useCallback(async (rowId, colKey, rawValue) => {
    const targetShip = ships.find(s => s.id === rowId)
    if (!targetShip) return null

    let dbPatch = {}
    let localPatch = {}
    let returnedVal = rawValue

    if (colKey === 'name') {
      const cleaned = cleanShipName(rawValue).toUpperCase().trim()
      if (!cleaned) return null
      dbPatch = { name: cleaned }
      localPatch = { name: cleaned }
      returnedVal = cleaned
    } else if (colKey === 'vessel_type') {
      const vt = String(rawValue || '').trim() || 'Pesquero'
      dbPatch = { vessel_type: vt }
      localPatch = { vessel_type: vt }
      returnedVal = vt
    } else if (colKey === 'current_location') {
      const loc = cleanLocation(rawValue).toUpperCase()
      dbPatch = { current_location: loc }
      localPatch = { current_location: loc }
      returnedVal = loc
    } else if (colKey === 'owner_id') {
      const nextOwnerId = rawValue ? String(rawValue).trim() : null
      const nextOwnerObj = nextOwnerId ? (owners.find(o => o.id === nextOwnerId) || null) : null
      dbPatch = {
        owner_id: nextOwnerId,
        ...(nextOwnerId ? { orphan_owner_alert: false, orphan_owner_previous_name: null } : {})
      }
      localPatch = {
        ...dbPatch,
        owners: nextOwnerObj
      }
      returnedVal = nextOwnerId || ''
    } else {
      return null
    }

    setShips(prev => prev.map(s => (s.id === rowId ? { ...s, ...localPatch } : s)))
    const { error } = await supabase.from('ships').update(dbPatch).eq('id', rowId)
    if (error) throw error

    logCellChange({
      entityType: 'ships',
      entityId: rowId,
      entityName: targetShip?.name || rowId,
      field: colKey,
      fieldLabel: colKey,
      oldValue: targetShip ? targetShip[colKey] : null,
      newValue: returnedVal,
      sheetName: 'Barcos · Padrón de Buques',
      moduleRoute: '/barcos',
      changeOrigin: 'INLINE_CELL',
      user: activeRolePerspective === 'admin' ? 'JORGE SENTIS' : 'MARIA JOSE'
    })

    return returnedVal
  }, [ships, owners, setShips, activeRolePerspective])

  // Batch update para fill-handle
  const handleShipsBatchUpdate = useCallback(async ({ colKey, newValue, targetIds, sourceRowId }) => {
    if (!targetIds || targetIds.length === 0) return
    const ids = Array.from(targetIds)

    let dbPatch = {}
    let localPatch = {}

    if (colKey === 'name') {
      const cleaned = cleanShipName(newValue).toUpperCase().trim()
      if (!cleaned) return
      dbPatch = { name: cleaned }
      localPatch = { name: cleaned }
    } else if (colKey === 'vessel_type') {
      const vt = String(newValue || '').trim() || 'Pesquero'
      dbPatch = { vessel_type: vt }
      localPatch = { vessel_type: vt }
    } else if (colKey === 'current_location') {
      const loc = cleanLocation(newValue).toUpperCase()
      dbPatch = { current_location: loc }
      localPatch = { current_location: loc }
    } else if (colKey === 'owner_id') {
      const nextOwnerId = newValue ? String(newValue).trim() : null
      const nextOwnerObj = nextOwnerId ? (owners.find(o => o.id === nextOwnerId) || null) : null
      dbPatch = {
        owner_id: nextOwnerId,
        ...(nextOwnerId ? { orphan_owner_alert: false, orphan_owner_previous_name: null } : {})
      }
      localPatch = {
        ...dbPatch,
        owners: nextOwnerObj
      }
    } else {
      return
    }

    setShips(prev => prev.map(s => (ids.includes(s.id) ? { ...s, ...localPatch } : s)))
    const { error } = await supabase.from('ships').update(dbPatch).in('id', ids)
    if (error) {
      console.error('Error en batch update de buques:', error)
      await loadInitialData?.()
      throw error
    }

    logRowAction({
      action: 'BATCH_FILL',
      entityType: 'ships',
      entityId: `batch_${ids.length}`,
      entityName: `${ids.length} buques`,
      changes: { colKey, newValue, affectedCount: ids.length },
      sheetName: 'Barcos · Padrón de Buques',
      moduleRoute: '/barcos',
      changeOrigin: 'DRAG_FILL',
      user: activeRolePerspective === 'admin' ? 'JORGE SENTIS' : 'MARIA JOSE'
    })
  }, [owners, setShips, loadInitialData, activeRolePerspective])

  // Paste handler 2D
  const handlePasteShipRows = useMemo(() => {
    return buildPasteRowHandler({
      table: 'ships',
      columns: ['name', 'vessel_type', 'current_location'],
      transformRow: (cells) => {
        const name = (cells[0] || '').trim().toUpperCase()
        if (!name) return null
        return {
          name,
          vessel_type: (cells[1] || '').trim() || 'Pesquero',
          current_location: cleanLocation(cells[2] || 'VARADERO'),
          is_active: true
        }
      },
      onSuccess: async () => {
        if (loadInitialData) await loadInitialData()
      },
      onError: (err) => {
        if (setStatusMessage) setStatusMessage({ type: 'error', text: 'Error al pegar buques: ' + err.message })
      },
      user: user?.email
    })
  }, [loadInitialData, setStatusMessage, user])

  // Hook canónico spreadsheet grid
  const shipsGrid = useSpreadsheetGrid({
    data: filteredShips,
    columns: shipsGridColumns,
    onBatchUpdate: handleShipsBatchUpdate,
    onPasteRows: handlePasteShipRows,
    storageKey: 'aloncar_grid_ships'
  })

  // Props de celda para navegación espacial
  const getShipsCellProps = (rowIndex, colKey) => {
    const isFocused = shipsGrid.focusedCell?.rowIndex === rowIndex && shipsGrid.focusedCell?.colKey === colKey
    const isSelected = shipsGrid.isCellSelected(rowIndex, colKey)
    const isEditing = inlineShipEdit?.rowIndex === rowIndex && inlineShipEdit?.colKey === colKey
    const isFillHandleSource = shipsGrid.isFillHandleSource(rowIndex, colKey)

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
      onClick: (e) => shipsGrid.handleCellClick(rowIndex, colKey, e),
      onDoubleClick: () => {
        const ship = filteredShips[rowIndex]
        if (!ship) return
        setInlineShipEdit({
          rowIndex,
          colKey,
          rowId: ship.id,
          value: ship[colKey] !== undefined && ship[colKey] !== null ? ship[colKey] : ''
        })
      },
      onMouseDown: (e) => shipsGrid.handleMouseDown(rowIndex, colKey, e),
      onMouseEnter: () => shipsGrid.handleMouseEnter(rowIndex, colKey),
      childrenFillHandle: isFillHandleSource ? (
        <div
          {...shipsGrid.fillHandleProps}
          title="Arrastrar para rellenar celdas (■)"
          className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-950 rounded-xs cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
        />
      ) : null
    }
  }

  // Guardado de edición inline
  const commitInlineShipEdit = async (overrideValue = undefined) => {
    if (!inlineShipEdit) return
    const { rowId, colKey } = inlineShipEdit
    const nextRaw = overrideValue !== undefined ? overrideValue : inlineShipEdit.value
    const ship = ships.find(s => s.id === rowId)
    setInlineShipEdit(null)
    if (!ship) return

    try {
      await applyShipSinglePatch(rowId, colKey, nextRaw)
    } catch (err) {
      if (setStatusMessage) setStatusMessage({ type: 'error', text: 'Error guardando celda: ' + err.message })
    }
  }

  // Duplicar buque
  const handleDuplicateShip = async (ship) => {
    try {
      const created = await duplicateRecord({
        table: 'ships',
        entityType: 'ships',
        source: ship,
        fields: SHIP_CLONE_FIELDS,
        overrides: { name: `${ship.name} (COPIA)`, is_active: true },
        nameOf: (r) => r.name,
        user: user?.email
      })
      if (setStatusMessage) setStatusMessage({ type: 'success', text: `Buque duplicado como "${created.name}".` })
      if (loadInitialData) await loadInitialData()
    } catch (err) {
      if (setStatusMessage) setStatusMessage({ type: 'error', text: `Error al duplicar buque: ${err.message}` })
    }
  }

  return (
    <div className="space-y-4">
      {/* ZONA 3 (TOOLBAR CORPORATIVA): BUSCADOR, FILTROS Y CAMBIO DE VISTA */}
      <div className="alon-zone-toolbar p-3 rounded-2xl shadow-lg flex flex-col gap-2.5">
        <CrawlerSearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar por nombre de buque, matrícula, tipo, locación o empresa armadora... (Ctrl+F | Esc limpia todo)"
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

            <select
              value={requestFilter}
              onChange={(e) => setRequestFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-cyan-500 font-medium cursor-pointer"
            >
              <option value="todos">Todos los Estados</option>
              <option value="pendientes">⚠️ Con Solicitud Activa</option>
              <option value="completos">✅ Datos Completos</option>
            </select>

            {activeRolePerspective !== 'admin' && (
              <select
                value={roleQuickFilter}
                onChange={(e) => setRoleQuickFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-amber-300 focus:outline-none focus:border-amber-400 font-bold cursor-pointer"
              >
                <option value="todos">Todos los Buques</option>
                <option value="mis_tareas">⚡ Mis Tareas Pendientes</option>
              </select>
            )}

            {(locationFilter !== 'todos' || requestFilter !== 'todos' || roleQuickFilter !== 'todos' || searchTerm) && (
              <button
                type="button"
                onClick={() => {
                  setLocationFilter('todos')
                  setRequestFilter('todos')
                  setRoleQuickFilter('todos')
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
                disabled={!shipsGrid.canUndo}
                onClick={shipsGrid.undo}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Deshacer (Ctrl + Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!shipsGrid.canRedo}
                onClick={shipsGrid.redo}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Rehacer (Ctrl + Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* SWITCHER DE VISTA: FILAS (TABLA) VS FICHAS (TARJETAS) */}
            <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setViewModeShips('tabla')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all ${
                  viewModeShips === 'tabla'
                    ? 'bg-primary text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista tipo planilla editable"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Filas</span>
              </button>
              <button
                type="button"
                onClick={() => setViewModeShips('tarjetas')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all ${
                  viewModeShips === 'tarjetas'
                    ? 'bg-primary text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista de fichas / tarjetas"
              >
                <ClipboardList className="w-3.5 h-3.5" />
                <span>Fichas</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* VISTA 1: TABLA EDITABLE (ZONA 4) */}
      {viewModeShips === 'tabla' && (
        <div
          ref={shipsGrid.gridContainerRef}
          tabIndex={0}
          onKeyDown={shipsGrid.handleKeyDown}
          className="alon-zone-grid rounded-2xl overflow-hidden shadow-xl focus:outline-none"
        >
          <GridRibbon
            activeCellBadge={shipsGrid.activeCellBadge || 'FLOTA NAVAL'}
            onInsertRow={onOpenNewShip}
            insertRowLabel="+ Nuevo Buque"
            undoCount={shipsGrid.undoStack?.length || 0}
            totalRows={filteredShips.length}
            entityName="buques"
            exportRows={filteredShips}
            exportFilename={`barcos_flota_${new Date().toISOString().split('T')[0]}`}
          />

          <div className="alon-grid-scroll">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="alon-grid-thead sticky top-0 z-20 shadow-sm backdrop-blur-md">
                <tr className="text-slate-300 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2 px-1 w-9 text-center select-none">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={shipsGrid.toggleSelectAll}
                        className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                        title="Seleccionar o deseleccionar todos los buques visibles"
                      >
                        {shipsGrid.isAllSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="font-mono text-[9px] text-slate-500 font-bold">#</span>
                    </div>
                  </th>
                  <th className="py-3 px-3">Buque ✎</th>
                  <th className="py-3 px-3">Tipo ✎</th>
                  <th className="py-3 px-3">Locación ✎</th>
                  <th className="py-3 px-3">Dimensiones</th>
                  <th className="py-3 px-3">OTs Activas</th>
                  <th className="py-3 px-3">Armador / Empresa ✎</th>
                  <th className="py-3 px-3">Estado / Solicitud</th>
                  <th className="py-3 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {filteredShips.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-500">
                      No se encontraron buques con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredShips.map((ship, rowIndex) => {
                    const cleanName = cleanShipName(ship.name)
                    const locClean = cleanLocation(ship.current_location)
                    const hasPendingReq = ship.info_request_status && ship.info_request_status !== 'completo'
                    const otMetrics = getShipOtMetrics[ship.id] || { total: 0, active: 0, shipWos: [], activeWos: [] }
                    const cpName = getShipsCellProps(rowIndex, 'name')
                    const cpType = getShipsCellProps(rowIndex, 'vessel_type')
                    const cpLoc = getShipsCellProps(rowIndex, 'current_location')
                    const cpOwner = getShipsCellProps(rowIndex, 'owner_id')

                    const isShipSelected = shipsGrid.selectedRowIds.has(ship.id)

                    return (
                      <tr
                        key={ship.id}
                        onContextMenu={(e) => openMenu(e, ship, rowIndex, { entityType: 'ships', recordId: ship.id, recordLabel: cleanName }, shipsGrid)}
                        className={`hover:bg-slate-800/40 transition-colors align-top ${
                          isShipSelected
                            ? 'bg-cyan-950/40 text-cyan-50'
                            : ship.orphan_owner_alert
                            ? 'bg-rose-500/[0.04]'
                            : hasPendingReq
                            ? 'bg-amber-500/[0.02]'
                            : ''
                        }`}
                      >
                        {/* 0. Columna 0 Canónica ([ ] / #) */}
                        <td className="py-1 px-1 text-center w-9 select-none relative">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => shipsGrid.toggleSelectRow(ship.id)}
                              className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                              title="Seleccionar buque"
                            >
                              {isShipSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                              ) : (
                                <Square className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                openMenu(e, ship, rowIndex, { entityType: 'ships', recordId: ship.id, recordLabel: cleanName }, shipsGrid)
                              }}
                              className="font-mono text-[9px] text-slate-500 hover:text-cyan-300 cursor-pointer font-bold"
                              title="Menú contextual"
                            >
                              {ship.folio ? `#${ship.folio}` : `${rowIndex + 1}`}
                            </button>
                          </div>
                        </td>

                        {/* 1. Nombre de Buque + Matrícula (Editable) */}
                        <td {...cpName}>
                          {inlineShipEdit?.rowIndex === rowIndex && inlineShipEdit?.colKey === 'name' ? (
                            <input
                              type="text"
                              autoFocus
                              value={inlineShipEdit.value}
                              onChange={(e) => setInlineShipEdit({ ...inlineShipEdit, value: e.target.value })}
                              onBlur={() => commitInlineShipEdit()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') commitInlineShipEdit()
                                if (e.key === 'Escape') setInlineShipEdit(null)
                              }}
                              className="w-full bg-slate-950 border border-primary rounded px-2 py-1 text-xs text-white uppercase font-bold focus:outline-none"
                            />
                          ) : (
                            <div className="min-w-[130px]">
                              <button
                                type="button"
                                onClick={() => onOpenShip360(ship)}
                                className="font-extrabold text-white text-xs hover:text-primary hover:underline text-left block truncate cursor-pointer"
                                title="Ver Ficha Técnica 360°"
                              >
                                <HighlightText text={cleanName} query={searchTerm} />
                              </button>
                              <span className="text-[10px] text-slate-400 font-mono block">
                                Matrícula: {ship.matricula || 'S/D'}
                              </span>
                            </div>
                          )}
                          {cpName.childrenFillHandle}
                        </td>

                        {/* 2. Tipo de Embarcación (Editable) */}
                        <td {...cpType}>
                          {inlineShipEdit?.rowIndex === rowIndex && inlineShipEdit?.colKey === 'vessel_type' ? (
                            <select
                              autoFocus
                              value={inlineShipEdit.value}
                              onChange={(e) => {
                                setInlineShipEdit({ ...inlineShipEdit, value: e.target.value })
                                commitInlineShipEdit(e.target.value)
                              }}
                              onBlur={() => commitInlineShipEdit()}
                              className="w-full bg-slate-950 border border-primary rounded px-1.5 py-1 text-xs text-white font-medium focus:outline-none cursor-pointer"
                            >
                              {PREDEFINED_VESSEL_TYPES.map(vt => (
                                <option key={vt} value={vt}>{vt}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-900 text-slate-300 text-[10px] font-mono border border-slate-800 whitespace-nowrap">
                              <HighlightText text={ship.vessel_type || 'Pesquero'} query={searchTerm} />
                            </span>
                          )}
                          {cpType.childrenFillHandle}
                        </td>

                        {/* 3. Locación Actual en Astillero (Editable) */}
                        <td {...cpLoc}>
                          {inlineShipEdit?.rowIndex === rowIndex && inlineShipEdit?.colKey === 'current_location' ? (
                            <select
                              autoFocus
                              value={cleanLocation(inlineShipEdit.value)}
                              onChange={(e) => {
                                setInlineShipEdit({ ...inlineShipEdit, value: e.target.value })
                                commitInlineShipEdit(e.target.value)
                              }}
                              onBlur={() => commitInlineShipEdit()}
                              className="w-full bg-slate-950 border border-primary rounded px-1.5 py-1 text-xs text-white font-bold focus:outline-none cursor-pointer"
                            >
                              {STANDARD_LOCATIONS.map(loc => (
                                <option key={loc} value={loc}>{loc}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border inline-flex items-center gap-1 whitespace-nowrap ${
                              locClean === 'VARADERO'
                                ? 'bg-amber-950/80 text-amber-300 border-amber-700/80'
                                : locClean === 'MUELLE'
                                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-700/80'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}>
                              <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                              <HighlightText text={locClean} query={searchTerm} />
                            </span>
                          )}
                          {cpLoc.childrenFillHandle}
                        </td>

                        {/* 4. Dimensiones (Eslora x Manga) */}
                        <td className="py-2 px-3 text-[11px] font-mono whitespace-nowrap text-slate-300">
                          {ship.eslora_mts || ship.manga_mts ? (
                            <div>
                              <span>{ship.eslora_mts ? `${ship.eslora_mts}m` : '—'} &times; {ship.manga_mts ? `${ship.manga_mts}m` : '—'}</span>
                              {ship.superficie_casco_m2 && (
                                <span className="block text-[10px] text-cyan-400">{ship.superficie_casco_m2} m² casco</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-slate-600 italic">Sin medidas</span>
                          )}
                        </td>

                        {/* 5. OTs Activas / Costos Huérfanos */}
                        <td className="py-2 px-3 text-xs whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${
                              otMetrics.active > 0
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                                : 'bg-slate-900 text-slate-500 border-slate-800'
                            }`}>
                              {otMetrics.active} activas
                            </span>
                            <span className="text-[10px] text-slate-500">({otMetrics.total} tot.)</span>
                          </div>
                          {otMetrics.orphanTotal > 0 && (
                            <span className="inline-flex items-center gap-1 text-[9px] text-amber-400 font-bold mt-0.5" title="Costos imputados a este buque sin OT asignada">
                              <AlertTriangle className="w-3 h-3 text-amber-400" />
                              <span>{otMetrics.orphanTotal} sin OT</span>
                            </span>
                          )}
                        </td>

                        {/* 6. Armador / Empresa Propietaria (Editable) */}
                        <td {...cpOwner}>
                          {inlineShipEdit?.rowIndex === rowIndex && inlineShipEdit?.colKey === 'owner_id' ? (
                            <select
                              autoFocus
                              value={inlineShipEdit.value}
                              onChange={(e) => {
                                setInlineShipEdit({ ...inlineShipEdit, value: e.target.value })
                                commitInlineShipEdit(e.target.value)
                              }}
                              onBlur={() => commitInlineShipEdit()}
                              className="w-full bg-slate-950 border border-primary rounded px-1.5 py-1 text-xs text-white focus:outline-none cursor-pointer"
                            >
                              <option value="">-- Sin asignar --</option>
                              {owners.map(o => (
                                <option key={o.id} value={o.id}>{o.name}</option>
                              ))}
                            </select>
                          ) : (
                            <div className="min-w-[120px]">
                              {ship.orphan_owner_alert ? (
                                <button
                                  type="button"
                                  onClick={() => onAssignOrphan(ship)}
                                  className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold flex items-center gap-1 hover:bg-rose-500/30 cursor-pointer"
                                  title="Empresa eliminada. Clic para reasignar"
                                >
                                  <AlertTriangle className="w-3 h-3" />
                                  <span>Asignar Armador</span>
                                </button>
                              ) : ship.owners ? (
                                <div>
                                  <span className="font-bold text-white text-xs block truncate max-w-[180px]">
                                    <HighlightText text={ship.owners.name} query={searchTerm} />
                                  </span>
                                  {ship.owners.armador_name && (
                                    <span className="text-[10px] text-slate-400 block truncate max-w-[180px]">
                                      {ship.owners.armador_name}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-500 italic text-[11px]">Sin asignar</span>
                              )}
                            </div>
                          )}
                          {cpOwner.childrenFillHandle}
                        </td>

                        {/* 7. Estado / Solicitud de Información */}
                        <td className="py-2 px-3 text-xs whitespace-nowrap">
                          {hasPendingReq ? (
                            <div className="flex items-center gap-1.5">
                              <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold flex items-center gap-1">
                                <BellRing className="w-3 h-3 text-amber-400" />
                                <span>
                                  {ship.info_request_status === 'pendiente_maria_jose'
                                    ? 'María José'
                                    : ship.info_request_status === 'pendiente_jefe_obra'
                                    ? 'Jefe Obra'
                                    : 'Ambos'}
                                </span>
                              </span>
                              {(activeRolePerspective !== 'admin') && (
                                <button
                                  type="button"
                                  onClick={() => onMarkRequestComplete(ship)}
                                  className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-bold border border-emerald-500/40 cursor-pointer"
                                  title="Marcar como completada"
                                >
                                  Listo ✓
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-bold">
                              <CheckCircle className="w-3 h-3" />
                              <span>Completo</span>
                            </span>
                          )}
                        </td>

                        {/* 8. Acciones Rápidas */}
                        <td className="py-2 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenShip360(ship)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white cursor-pointer"
                              title="Ver Ficha Técnica 360°"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenEditShip(ship)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                              title="Editar Buque"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateShip(ship)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-cyan-300 cursor-pointer"
                              title="Duplicar Buque"
                            >
                              <CopyPlus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onToggleShipActive(ship)}
                              className={`p-1 rounded cursor-pointer ${
                                ship.is_active === false
                                  ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-500 hover:text-rose-400'
                              }`}
                              title={ship.is_active === false ? 'Reactivar Buque' : 'Desactivar Buque (Baja lógica)'}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {/* VISTA 2: TARJETAS / FICHAS */}
      {viewModeShips === 'tarjetas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredShips.length === 0 ? (
            <div className="col-span-full p-10 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
              No se encontraron buques con los filtros actuales.
            </div>
          ) : (
            filteredShips.map(ship => {
              const cleanName = cleanShipName(ship.name)
              const locClean = cleanLocation(ship.current_location)
              const otMetrics = getShipOtMetrics[ship.id] || { total: 0, active: 0 }

              return (
                <div
                  key={ship.id}
                  className={`p-4 rounded-2xl border bg-slate-900 transition-all hover:border-cyan-500/40 space-y-3 ${
                    ship.orphan_owner_alert
                      ? 'border-rose-500/40 bg-rose-950/10'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/30 flex items-center justify-center text-primary shrink-0">
                        <Ship className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-white text-sm">
                          <HighlightText text={cleanName} query={searchTerm} />
                        </h4>
                        <div className="text-[10px] text-slate-400 font-mono">
                          Mat: {ship.matricula || 'S/D'} &bull; {ship.vessel_type || 'Pesquero'}
                        </div>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                      locClean === 'VARADERO'
                        ? 'bg-amber-950 text-amber-300 border-amber-800'
                        : locClean === 'MUELLE'
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                        : 'bg-slate-950 text-slate-400 border-slate-800'
                    }`}>
                      {locClean}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">Dimensiones</span>
                      <strong className="text-white font-mono text-[11px]">
                        {ship.eslora_mts ? `${ship.eslora_mts}m` : '—'} &times; {ship.manga_mts ? `${ship.manga_mts}m` : '—'}
                      </strong>
                    </div>
                    <div className="p-2 rounded-xl bg-slate-950 border border-slate-800">
                      <span className="text-[10px] text-slate-500 block">OTs Activas</span>
                      <strong className="text-emerald-300 font-mono text-[11px]">
                        {otMetrics.active} en curso ({otMetrics.total} tot.)
                      </strong>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 flex items-center justify-between pt-1">
                    <span className="text-[11px] text-slate-400">Armador:</span>
                    <strong className="text-white text-right truncate max-w-[180px]">
                      {ship.owners?.name || 'Sin asignar'}
                    </strong>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => onOpenShip360(ship)}
                      className="flex-1 py-1.5 rounded-xl bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Ficha 360°</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenEditShip(ship)}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                      title="Editar Buque"
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

      {/* ZONA 5: BARRA DE ESTADO INFERIOR CANÓNICA */}
      <GridStatusBarBottom
        selectedCount={shipsGrid.selectedRowIds.size}
        totalCount={filteredShips.length}
        activeFilterLabel={locationFilter !== 'todos' ? `Locación: ${locationFilter}` : null}
        onClearSelection={shipsGrid.clearRowSelection}
        entityLabel="buques"
      />
    </div>
  )
}
