import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import {
  Building2,
  Pencil,
  Trash2,
  CopyPlus,
  CheckSquare,
  Square,
  Phone,
  Mail
} from 'lucide-react'
import { useSpreadsheetGrid } from '../../hooks/useSpreadsheetGrid'
import { useAuth } from '../../context/AuthContext'
import { useModuleFilterMemory, resolveInitialModuleFilters } from '../../hooks/useModuleFilterMemory'
import CanonicalZone3Toolbar from '../canonical/CanonicalZone3Toolbar'
import GridRibbon from '../GridRibbon'
import GridStatusBarBottom from '../GridStatusBarBottom'
import GridContextMenu from '../GridContextMenu'
import { useGridContextMenu } from '../../hooks/useGridContextMenu'
import { duplicateRecord, buildPasteRowHandler } from '../../lib/gridRowActions'
import { getTodayArIso } from '../../lib/dateTimeCanonical'
import { matchesUniversalSearch } from '../../lib/searchEngine'
import HighlightText from '../HighlightText'
import {
  cleanShipName,
  OWNER_CLONE_FIELDS
} from '../../lib/shipsConstants'
import { buildOwnerFieldPatch, updateGridEntityRowsService } from '../../lib/shipsService'
import { buildGridCellMeta, executeGridBatchUpdate, resolveShipsAuditUser } from '../../lib/shipsGridHelpers'

export default function ShipsArmadoresPanel({
  owners = [],
  setOwners,
  ships = [],
  setShips,
  user,
  activeRolePerspective = 'admin',
  onOpenNewOwner,
  onOpenEditOwner,
  onOpenDeleteOwner,
  setStatusMessage,
  loadInitialData
}) {
  const { profile } = useAuth()
  const initialFilters = useMemo(
    () => resolveInitialModuleFilters(user, profile, 'ships_armadores'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [viewModeOwners, setViewModeOwners] = useState('tabla')
  const [searchTerm, setSearchTerm] = useState(initialFilters.searchTerm)

  const armadoresViewsController = useModuleFilterMemory({
    moduleKey: 'ships_armadores',
    currentFilters: { searchTerm },
    setters: { searchTerm: setSearchTerm },
    hasActiveFilters: Boolean(searchTerm)
  })
  const [inlineOwnerEdit, setInlineOwnerEdit] = useState(null)
  const searchInputRef = useRef(null)
  const ownersPasteRef = useRef(null)
  const { menuTarget, openMenu, closeMenu } = useGridContextMenu()
  const showFeedback = useCallback((type, text) => setStatusMessage?.({ type, text }), [setStatusMessage])

  // Columnas visibles editables para spreadsheet grid (1:1 con <td>)
  const ownersGridColumns = useMemo(() => [
    {
      key: 'name',
      label: 'Empresa / Razón Social',
      getValue: (o) => o.name || '',
      formatDisplay: (val) => val
    },
    {
      key: 'armador_name',
      label: 'Nombre del Armador',
      getValue: (o) => o.armador_name || '',
      formatDisplay: (val) => val || '—'
    },
    {
      key: 'armador_phone',
      label: 'Teléfono Directo',
      getValue: (o) => o.armador_phone || '',
      formatDisplay: (val) => val || '—'
    },
    {
      key: 'email_principal',
      label: 'Email Principal',
      getValue: (o) => o.email_principal || '',
      formatDisplay: (val) => val || '—'
    }
  ], [])

  // Filtrado de armadores
  const filteredOwners = useMemo(() => {
    return owners.filter(owner => {
      if (!searchTerm) return true
      return matchesUniversalSearch(owner, searchTerm, [
        'name',
        'armador_name',
        'armador_phone',
        'email_principal',
        'email_secundario',
        'cuit',
        'notes'
      ])
    })
  }, [owners, searchTerm])

  const syncShipsNestedOwners = useCallback((ids, localPatch) => {
    setShips?.((prev) =>
      prev.map((s) => (ids.includes(s.owner_id) && s.owners ? { ...s, owners: { ...s.owners, ...localPatch } } : s))
    )
  }, [setShips])

  // Mutación atómica en DB con sincronización de flota y auditoría
  const applyOwnerSinglePatch = useCallback(async (rowId, colKey, rawValue, { skipAudit = true } = {}) => {
    const targetOwner = owners.find((o) => o.id === rowId)
    const built = buildOwnerFieldPatch(colKey, rawValue)
    if (!built) return null

    setOwners((prev) => prev.map((o) => (o.id === rowId ? { ...o, ...built.localPatch } : o)))
    syncShipsNestedOwners([rowId], built.localPatch)

    await updateGridEntityRowsService({
      table: 'owners',
      entityType: 'owners',
      sheetName: 'Barcos · Padrón de Armadores',
      ids: [rowId],
      dbPatch: built.dbPatch,
      auditMeta: skipAudit
        ? null
        : {
            mode: 'cell',
            entityName: targetOwner?.name || rowId,
            field: colKey,
            oldValue: targetOwner?.[colKey] ?? null,
            newValue: built.normalizedValue,
            changeOrigin: 'PASTE_OR_UNDO'
          },
      user: resolveShipsAuditUser(user, activeRolePerspective)
    })
    return built.normalizedValue
  }, [owners, setOwners, syncShipsNestedOwners, user, activeRolePerspective])

  // Batch update canónico (Fill Down, Paste Matrix 2D y Undo/Redo)
  const handleOwnersBatchUpdate = useCallback(async (args) => {
    await executeGridBatchUpdate({
      ...args,
      applySingle: applyOwnerSinglePatch,
      applyBatch: async (ids, colKey, newValue) => {
        const built = buildOwnerFieldPatch(colKey, newValue)
        if (!built) return
        setOwners((prev) => prev.map((o) => (ids.includes(o.id) ? { ...o, ...built.localPatch } : o)))
        syncShipsNestedOwners(ids, built.localPatch)
        await updateGridEntityRowsService({
          table: 'owners',
          entityType: 'owners',
          sheetName: 'Barcos · Padrón de Armadores',
          ids,
          dbPatch: built.dbPatch,
          auditMeta: {
            mode: 'batch',
            entityName: `${ids.length} armadores`,
            changes: { colKey, newValue: built.normalizedValue, affectedCount: ids.length }
          },
          user: resolveShipsAuditUser(user, activeRolePerspective)
        })
      },
      onReload: loadInitialData
    })
  }, [applyOwnerSinglePatch, setOwners, syncShipsNestedOwners, user, activeRolePerspective, loadInitialData])

  // Hook canónico spreadsheet grid
  const ownersGrid = useSpreadsheetGrid({
    rows: filteredOwners,
    columns: ownersGridColumns,
    getRowId: (o) => o.id,
    onBatchUpdate: handleOwnersBatchUpdate,
    onPasteRow: (args) => ownersPasteRef.current?.(args),
    onFocusSearch: () => searchInputRef.current?.focus(),
    onCellActivate: (row, colDef, rowIndex) => {
      setInlineOwnerEdit({
        rowIndex,
        colKey: colDef.key,
        rowId: row.id,
        value: colDef.getValue ? colDef.getValue(row) : (row[colDef.key] ?? '')
      })
    },
    storageKey: 'aloncar_grid_owners',
    showFeedback
  })

  useEffect(() => {
    ownersPasteRef.current = buildPasteRowHandler({
      table: 'owners',
      entityType: 'owners',
      fields: OWNER_CLONE_FIELDS,
      grid: ownersGrid,
      setList: setOwners,
      nameOf: (r) => r.name,
      showFeedback,
      user: user?.email
    })
  }, [ownersGrid, setOwners, showFeedback, user])

  const getOwnersCellProps = (rowIndex, colKey) =>
    buildGridCellMeta({
      grid: ownersGrid,
      columns: ownersGridColumns,
      rowIndex,
      colKey,
      inlineEdit: inlineOwnerEdit,
      onStartEdit: (rIdx, key) => {
        const owner = filteredOwners[rIdx]
        if (!owner) return
        const colDef = ownersGridColumns.find((c) => c.key === key)
        setInlineOwnerEdit({
          rowIndex: rIdx,
          colKey: key,
          rowId: owner.id,
          value: colDef?.getValue ? colDef.getValue(owner) : (owner[key] ?? '')
        })
      }
    })

  // Guardado de edición inline
  const commitInlineOwnerEdit = async (overrideValue = undefined) => {
    if (!inlineOwnerEdit) return
    const { rowId, colKey } = inlineOwnerEdit
    const nextRaw = overrideValue !== undefined ? overrideValue : inlineOwnerEdit.value
    const owner = owners.find((o) => o.id === rowId)
    setInlineOwnerEdit(null)
    if (!owner) return

    const colDef = ownersGridColumns.find((c) => c.key === colKey)
    const prevValue = colDef?.getValue ? colDef.getValue(owner) : (owner[colKey] ?? '')
    try {
      const normalized = await applyOwnerSinglePatch(rowId, colKey, nextRaw, { skipAudit: true })
      if (normalized !== null && String(prevValue ?? '') !== String(normalized ?? '')) {
        ownersGrid.pushUndoAction({
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

  // Duplicar armador
  const handleDuplicateOwner = async (owner) => {
    try {
      const created = await duplicateRecord({
        table: 'owners',
        entityType: 'owners',
        source: owner,
        fields: OWNER_CLONE_FIELDS,
        overrides: { name: `${owner.name} (COPIA)`, is_active: true },
        nameOf: (r) => r.name,
        user: user?.email
      })
      if (setStatusMessage) setStatusMessage({ type: 'success', text: `Armador duplicado como "${created.name}".` })
      if (loadInitialData) await loadInitialData()
    } catch (err) {
      if (setStatusMessage) setStatusMessage({ type: 'error', text: `Error al duplicar armador: ${err.message}` })
    }
  }

  const isAllOwnersSelected = filteredOwners.length > 0 && filteredOwners.every((o) => ownersGrid.selectedRowIds.has(o.id))
  const hasActiveFilter = Boolean(searchTerm)
  const renderFillHandle = (cp) =>
    cp.renderHandle ? (
      <div
        onMouseDown={ownersGrid.handleFillHandleMouseDown}
        onDoubleClick={ownersGrid.handleFillHandleDoubleClick}
        title="Arrastrar para rellenar celdas (■)"
        className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-950 rounded-xs cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
      />
    ) : null

  return (
    <div className="space-y-4">
      {/* ZONA 3: TOOLBAR CORPORATIVA CON BUSCADOR Y CAMBIO DE VISTA */}
      <CanonicalZone3Toolbar
        className="rounded-2xl"
        searchInputRef={searchInputRef}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar empresa armadora, contacto, teléfono, email o CUIT... (Ctrl+F | Esc limpia todo)"
        viewsController={armadoresViewsController}
        hasActiveFilters={Boolean(searchTerm.trim())}
        onClearAllFilters={() => setSearchTerm('')}
        history={ownersGrid}
        viewModeToggle={{
          value: viewModeOwners,
          onChange: setViewModeOwners,
          rowsValue: 'tabla',
          cardsValue: 'tarjetas'
        }}
      />

      {/* VISTA 1: TABLA EDITABLE (ZONA 4) */}
      {viewModeOwners === 'tabla' && (
        <div
          ref={ownersGrid.gridContainerRef}
          tabIndex={0}
          onKeyDown={ownersGrid.handleKeyDown}
          onPaste={ownersGrid.handlePaste}
          className="alon-zone-grid rounded-2xl overflow-hidden shadow-xl focus:outline-none"
        >
          <GridRibbon
            activeCellBadge={ownersGrid.activeCellBadge}
            onInsertRow={onOpenNewOwner}
            insertRowLabel="Nueva Empresa Armadora"
            undoCount={ownersGrid.undoStack?.length || 0}
            totalRows={filteredOwners.length}
            entityName="armadores"
            exportRows={filteredOwners}
            exportFilename={`barcos_armadores_${getTodayArIso()}`}
          />

          <div className="alon-grid-scroll">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="alon-grid-thead sticky top-0 z-20 shadow-sm backdrop-blur-md">
                <tr className="text-slate-300 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2 px-1 w-9 text-center select-none">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => ownersGrid.toggleSelectAll(filteredOwners.map((o) => o.id))}
                        className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                        title="Seleccionar o deseleccionar todas las empresas armadoras visibles"
                      >
                        {isAllOwnersSelected ? (
                          <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="font-mono text-[9px] text-slate-500 font-bold">#</span>
                    </div>
                  </th>
                  <th className="py-3 px-4">Empresa / Razón Social ✎</th>
                  <th className="py-3 px-4">Nombre del Armador ✎</th>
                  <th className="py-3 px-4">Teléfono Directo ✎</th>
                  <th className="py-3 px-4">Correos (Principal ✎ / Facturación)</th>
                  <th className="py-3 px-4">Flota Vinculada</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 text-xs font-medium">
                {filteredOwners.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-slate-500">
                      No hay empresas armadoras que coincidan con la búsqueda. Tocá &ldquo;+ Nueva Empresa Armadora&rdquo;.
                    </td>
                  </tr>
                ) : (
                  filteredOwners.map((owner, rowIndex) => {
                    const isOwnerSelected = ownersGrid.selectedRowIds.has(owner.id)
                    const ownerShips = ships.filter(s => s.owner_id === owner.id)
                    const cpName = getOwnersCellProps(rowIndex, 'name')
                    const cpArmador = getOwnersCellProps(rowIndex, 'armador_name')
                    const cpPhone = getOwnersCellProps(rowIndex, 'armador_phone')
                    const cpEmail = getOwnersCellProps(rowIndex, 'email_principal')

                    return (
                      <tr
                        key={owner.id}
                        onContextMenu={(e) => openMenu(e, owner, rowIndex, { entityType: 'owners', recordId: owner.id, recordLabel: owner.name }, ownersGrid)}
                        className={`hover:bg-slate-800/40 transition-colors ${
                          isOwnerSelected ? 'bg-cyan-950/40 text-cyan-50' : ''
                        }`}
                      >
                        {/* 0. Columna 0 Canónica */}
                        <td className="py-1 px-1 text-center w-9 select-none relative">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => ownersGrid.toggleSelectRow(owner.id)}
                              className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                              title="Seleccionar armador"
                            >
                              {isOwnerSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                              ) : (
                                <Square className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                openMenu(e, owner, rowIndex, { entityType: 'owners', recordId: owner.id, recordLabel: owner.name, isRowHeader: true }, ownersGrid)
                              }}
                              className="font-mono text-[9px] text-slate-500 hover:text-cyan-300 cursor-pointer font-bold"
                              title="Menú contextual"
                            >
                              #{owner._rowSeq || (rowIndex + 1)}
                            </button>
                          </div>
                        </td>

                        {/* 1. Razón Social (Editable) */}
                        <td {...cpName.domProps}>
                          {cpName.isEditing ? (
                            <input
                              type="text"
                              autoFocus
                              value={inlineOwnerEdit.value}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setInlineOwnerEdit({ ...inlineOwnerEdit, value: e.target.value })}
                              onBlur={() => commitInlineOwnerEdit()}
                              onKeyDown={(e) => {
                                e.stopPropagation()
                                if (e.key === 'Enter') commitInlineOwnerEdit()
                                if (e.key === 'Escape') setInlineOwnerEdit(null)
                              }}
                              className="w-full bg-slate-950 border border-primary rounded px-2 py-1 text-xs text-white font-bold focus:outline-none"
                            />
                          ) : (
                            <div>
                              <strong className="text-white text-xs block">
                                <HighlightText text={owner.name} query={searchTerm} />
                              </strong>
                              {owner.cuit && (
                                <span className="text-[10px] text-slate-400 font-mono">CUIT: {owner.cuit}</span>
                              )}
                            </div>
                          )}
                          {renderFillHandle(cpName)}
                        </td>

                        {/* 2. Nombre del Armador (Editable) */}
                        <td {...cpArmador.domProps}>
                          {cpArmador.isEditing ? (
                            <input
                              type="text"
                              autoFocus
                              value={inlineOwnerEdit.value}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setInlineOwnerEdit({ ...inlineOwnerEdit, value: e.target.value })}
                              onBlur={() => commitInlineOwnerEdit()}
                              onKeyDown={(e) => {
                                e.stopPropagation()
                                if (e.key === 'Enter') commitInlineOwnerEdit()
                                if (e.key === 'Escape') setInlineOwnerEdit(null)
                              }}
                              className="w-full bg-slate-950 border border-primary rounded px-2 py-1 text-xs text-white focus:outline-none"
                            />
                          ) : (
                            <span className="text-amber-300 font-medium">
                              <HighlightText text={owner.armador_name || '—'} query={searchTerm} />
                            </span>
                          )}
                          {renderFillHandle(cpArmador)}
                        </td>

                        {/* 3. Teléfono (Editable) */}
                        <td {...cpPhone.domProps}>
                          {cpPhone.isEditing ? (
                            <input
                              type="text"
                              autoFocus
                              value={inlineOwnerEdit.value}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setInlineOwnerEdit({ ...inlineOwnerEdit, value: e.target.value })}
                              onBlur={() => commitInlineOwnerEdit()}
                              onKeyDown={(e) => {
                                e.stopPropagation()
                                if (e.key === 'Enter') commitInlineOwnerEdit()
                                if (e.key === 'Escape') setInlineOwnerEdit(null)
                              }}
                              className="w-full bg-slate-950 border border-primary rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
                            />
                          ) : (
                            <span className="font-mono text-cyan-300">
                              <HighlightText text={owner.armador_phone || '—'} query={searchTerm} />
                            </span>
                          )}
                          {renderFillHandle(cpPhone)}
                        </td>

                        {/* 4. Correos (Principal y Secundario) */}
                        <td {...cpEmail.domProps}>
                          {cpEmail.isEditing ? (
                            <input
                              type="email"
                              autoFocus
                              value={inlineOwnerEdit.value}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setInlineOwnerEdit({ ...inlineOwnerEdit, value: e.target.value })}
                              onBlur={() => commitInlineOwnerEdit()}
                              onKeyDown={(e) => {
                                e.stopPropagation()
                                if (e.key === 'Enter') commitInlineOwnerEdit()
                                if (e.key === 'Escape') setInlineOwnerEdit(null)
                              }}
                              className="w-full bg-slate-950 border border-primary rounded px-2 py-1 text-xs text-white font-mono focus:outline-none"
                            />
                          ) : (
                            <div className="font-mono text-[11px] space-y-0.5">
                              {owner.email_principal ? (
                                <span className="text-slate-200 block truncate max-w-[200px]" title={owner.email_principal}>
                                  <HighlightText text={owner.email_principal} query={searchTerm} />
                                </span>
                              ) : (
                                <span className="text-slate-600 italic">Sin correo principal</span>
                              )}
                              {owner.email_secundario && (
                                <span className="text-slate-400 text-[10px] block truncate max-w-[200px]" title={owner.email_secundario}>
                                  Facturación: {owner.email_secundario}
                                </span>
                              )}
                            </div>
                          )}
                          {renderFillHandle(cpEmail)}
                        </td>

                        {/* 5. Flota Vinculada */}
                        <td className="py-3 px-4">
                          {ownerShips.length === 0 ? (
                            <span className="text-slate-600 text-[11px] italic">Sin buques asignados</span>
                          ) : (
                            <div className="flex flex-wrap gap-1 max-w-[240px]">
                              {ownerShips.map(s => (
                                <span
                                  key={s.id}
                                  className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[10px] font-bold"
                                >
                                  {cleanShipName(s.name)}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>

                        {/* 6. Acciones */}
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => onOpenEditOwner(owner)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
                              title="Editar Armador"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateOwner(owner)}
                              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-cyan-300 cursor-pointer"
                              title="Duplicar Armador"
                            >
                              <CopyPlus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onOpenDeleteOwner(owner)}
                              className="p-1 rounded bg-slate-800 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 cursor-pointer"
                              title="Eliminar definitivamente (auditado)"
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

          {/* Menú Contextual Canónico */}
          {menuTarget && (
            <GridContextMenu
              target={menuTarget}
              onClose={closeMenu}
              onCopyCell={ownersGrid.copyActiveCell}
              onCopyRow={ownersGrid.copyRow}
              onPaste={ownersGrid.pasteToActiveOrRange}
              onDeleteCell={ownersGrid.deleteActiveCellOrRange}
              onInsertRowAbove={onOpenNewOwner}
              onDuplicateRow={(row) => handleDuplicateOwner(row)}
              onDeleteRow={(row) => onOpenDeleteOwner(row)}
              entityType="owners"
              recordId={menuTarget.recordId}
              recordLabel={menuTarget.recordLabel}
            />
          )}
        </div>
      )}

      {/* VISTA 2: TARJETAS */}
      {viewModeOwners === 'tarjetas' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredOwners.length === 0 ? (
            <div className="col-span-full p-10 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
              No hay empresas armadoras que coincidan con la búsqueda.
            </div>
          ) : (
            filteredOwners.map(owner => {
              const ownerShips = ships.filter(s => s.owner_id === owner.id)

              return (
                <div
                  key={owner.id}
                  className="p-4 rounded-2xl border border-slate-800 bg-slate-900 hover:border-amber-400/40 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <h4 className="font-extrabold text-white text-sm">
                          <HighlightText text={owner.name} query={searchTerm} />
                        </h4>
                        {owner.cuit && (
                          <div className="text-[10px] text-slate-400 font-mono">
                            CUIT: {owner.cuit}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 text-xs">
                    {owner.armador_name && (
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400">Armador:</span>
                        <strong className="text-amber-300">{owner.armador_name}</strong>
                      </div>
                    )}
                    {owner.armador_phone && (
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-cyan-400" />
                          <span>Teléfono:</span>
                        </span>
                        <strong className="text-cyan-300 font-mono">{owner.armador_phone}</strong>
                      </div>
                    )}
                    {owner.email_principal && (
                      <div className="flex items-center justify-between text-slate-300">
                        <span className="text-slate-400 flex items-center gap-1">
                          <Mail className="w-3 h-3 text-slate-400" />
                          <span>Email:</span>
                        </span>
                        <span className="text-slate-200 font-mono text-[11px] truncate max-w-[180px]">
                          {owner.email_principal}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-[10px] text-slate-400 block mb-1 font-bold">
                      Buques de este Armador ({ownerShips.length}):
                    </span>
                    {ownerShips.length === 0 ? (
                      <span className="text-slate-600 text-[10px] italic">Sin buques asignados</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {ownerShips.map(s => (
                          <span
                            key={s.id}
                            className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 text-slate-200 text-[10px] font-bold"
                          >
                            {cleanShipName(s.name)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end gap-1.5 pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => onOpenEditOwner(owner)}
                      className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                      <span>Editar</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenDeleteOwner(owner)}
                      className="p-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 cursor-pointer"
                      title="Eliminar"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
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
        filteredCount={filteredOwners.length}
        totalCount={owners.length}
        entityName="armadores"
        hasActiveFilter={hasActiveFilter}
        onClearFilters={() => setSearchTerm('')}
        selectionStats={ownersGrid.selectionStats}
        onClearSelection={() => ownersGrid.setSelectionRange(null)}
        customSelection={
          ownersGrid.selectedRowIds.size > 0
            ? {
                count: ownersGrid.selectedRowIds.size,
                label: 'armadores seleccionados',
                onClear: ownersGrid.clearSelectedRows
              }
            : null
        }
      />
    </div>
  )
}
