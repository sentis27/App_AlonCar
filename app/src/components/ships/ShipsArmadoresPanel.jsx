import React, { useState, useMemo, useCallback } from 'react'
import {
  Building2,
  Pencil,
  Trash2,
  CopyPlus,
  CheckSquare,
  Square,
  Undo2,
  Redo2,
  Layers,
  ClipboardList,
  Phone,
  Mail,
  Ship,
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
  OWNER_CLONE_FIELDS
} from '../../lib/shipsConstants'

export default function ShipsArmadoresPanel({
  owners = [],
  setOwners,
  ships = [],
  user,
  activeRolePerspective = 'admin',
  onOpenNewOwner,
  onOpenEditOwner,
  onOpenDeleteOwner,
  setStatusMessage,
  loadInitialData
}) {
  // Vista local: 'tabla' | 'tarjetas'
  const [viewModeOwners, setViewModeOwners] = useState('tabla')

  // Filtro de búsqueda local
  const [searchTerm, setSearchTerm] = useState('')

  // Inline edit state
  const [inlineOwnerEdit, setInlineOwnerEdit] = useState(null)

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
    },
    {
      key: 'cuit',
      label: 'CUIT',
      getValue: (o) => o.cuit || '',
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

  // Mutación atómica en DB con auditoría
  const applyOwnerSinglePatch = useCallback(async (rowId, colKey, rawValue) => {
    const targetOwner = owners.find(o => o.id === rowId)
    if (!targetOwner) return null

    let dbPatch = {}
    let localPatch = {}
    let returnedVal = rawValue

    if (colKey === 'name') {
      const name = String(rawValue || '').trim()
      if (!name) return null
      dbPatch = { name }
      localPatch = { name }
      returnedVal = name
    } else if (['armador_name', 'armador_phone', 'email_principal', 'email_secundario', 'cuit'].includes(colKey)) {
      const val = String(rawValue || '').trim() || null
      dbPatch = { [colKey]: val }
      localPatch = { [colKey]: val }
      returnedVal = val || ''
    } else {
      return null
    }

    setOwners(prev => prev.map(o => (o.id === rowId ? { ...o, ...localPatch } : o)))
    const { error } = await supabase.from('owners').update(dbPatch).eq('id', rowId)
    if (error) throw error

    logCellChange({
      entityType: 'owners',
      entityId: rowId,
      entityName: targetOwner?.name || rowId,
      field: colKey,
      fieldLabel: colKey,
      oldValue: targetOwner ? targetOwner[colKey] : null,
      newValue: returnedVal,
      sheetName: 'Barcos · Padrón de Armadores',
      moduleRoute: '/barcos',
      changeOrigin: 'INLINE_CELL',
      user: activeRolePerspective === 'admin' ? 'JORGE SENTIS' : 'MARIA JOSE'
    })

    return returnedVal
  }, [owners, setOwners, activeRolePerspective])

  // Batch update para fill-handle
  const handleOwnersBatchUpdate = useCallback(async ({ colKey, newValue, targetIds }) => {
    if (!targetIds || targetIds.length === 0) return
    const ids = Array.from(targetIds)

    let dbPatch = {}
    let localPatch = {}

    if (colKey === 'name') {
      const name = String(newValue || '').trim()
      if (!name) return
      dbPatch = { name }
      localPatch = { name }
    } else if (['armador_name', 'armador_phone', 'email_principal', 'email_secundario', 'cuit'].includes(colKey)) {
      const val = String(newValue || '').trim() || null
      dbPatch = { [colKey]: val }
      localPatch = { [colKey]: val }
    } else {
      return
    }

    setOwners(prev => prev.map(o => (ids.includes(o.id) ? { ...o, ...localPatch } : o)))
    const { error } = await supabase.from('owners').update(dbPatch).in('id', ids)
    if (error) {
      console.error('Error en batch update de armadores:', error)
      await loadInitialData?.()
      throw error
    }

    logRowAction({
      action: 'BATCH_FILL',
      entityType: 'owners',
      entityId: `batch_${ids.length}`,
      entityName: `${ids.length} armadores`,
      changes: { colKey, newValue, affectedCount: ids.length },
      sheetName: 'Barcos · Padrón de Armadores',
      moduleRoute: '/barcos',
      changeOrigin: 'DRAG_FILL',
      user: activeRolePerspective === 'admin' ? 'JORGE SENTIS' : 'MARIA JOSE'
    })
  }, [setOwners, loadInitialData, activeRolePerspective])

  // Paste handler 2D
  const handlePasteOwnerRows = useMemo(() => {
    return buildPasteRowHandler({
      table: 'owners',
      columns: ['name', 'armador_name', 'armador_phone', 'email_principal'],
      transformRow: (cells) => {
        const name = (cells[0] || '').trim()
        if (!name) return null
        return {
          name,
          armador_name: (cells[1] || '').trim() || null,
          armador_phone: (cells[2] || '').trim() || null,
          email_principal: (cells[3] || '').trim() || null,
          is_active: true
        }
      },
      onSuccess: async () => {
        if (loadInitialData) await loadInitialData()
      },
      onError: (err) => {
        if (setStatusMessage) setStatusMessage({ type: 'error', text: 'Error al pegar armadores: ' + err.message })
      },
      user: user?.email
    })
  }, [loadInitialData, setStatusMessage, user])

  // Hook canónico spreadsheet grid
  const ownersGrid = useSpreadsheetGrid({
    data: filteredOwners,
    columns: ownersGridColumns,
    onBatchUpdate: handleOwnersBatchUpdate,
    onPasteRows: handlePasteOwnerRows,
    storageKey: 'aloncar_grid_owners'
  })

  // Props de celda para navegación espacial
  const getOwnersCellProps = (rowIndex, colKey) => {
    const isFocused = ownersGrid.focusedCell?.rowIndex === rowIndex && ownersGrid.focusedCell?.colKey === colKey
    const isSelected = ownersGrid.isCellSelected(rowIndex, colKey)
    const isEditing = inlineOwnerEdit?.rowIndex === rowIndex && inlineOwnerEdit?.colKey === colKey
    const isFillHandleSource = ownersGrid.isFillHandleSource(rowIndex, colKey)

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
      onClick: (e) => ownersGrid.handleCellClick(rowIndex, colKey, e),
      onDoubleClick: () => {
        const owner = filteredOwners[rowIndex]
        if (!owner) return
        setInlineOwnerEdit({
          rowIndex,
          colKey,
          rowId: owner.id,
          value: owner[colKey] !== undefined && owner[colKey] !== null ? owner[colKey] : ''
        })
      },
      onMouseDown: (e) => ownersGrid.handleMouseDown(rowIndex, colKey, e),
      onMouseEnter: () => ownersGrid.handleMouseEnter(rowIndex, colKey),
      childrenFillHandle: isFillHandleSource ? (
        <div
          {...ownersGrid.fillHandleProps}
          title="Arrastrar para rellenar celdas (■)"
          className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-950 rounded-xs cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
        />
      ) : null
    }
  }

  // Guardado de edición inline
  const commitInlineOwnerEdit = async (overrideValue = undefined) => {
    if (!inlineOwnerEdit) return
    const { rowId, colKey } = inlineOwnerEdit
    const nextRaw = overrideValue !== undefined ? overrideValue : inlineOwnerEdit.value
    const owner = owners.find(o => o.id === rowId)
    setInlineOwnerEdit(null)
    if (!owner) return

    try {
      await applyOwnerSinglePatch(rowId, colKey, nextRaw)
    } catch (err) {
      if (setStatusMessage) setStatusMessage({ type: 'error', text: 'Error guardando celda: ' + err.message })
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

  return (
    <div className="space-y-4">
      {/* ZONA 3: TOOLBAR CORPORATIVA CON BUSCADOR Y CAMBIO DE VISTA */}
      <div className="alon-zone-toolbar p-3 rounded-2xl shadow-lg flex flex-col gap-2.5">
        <CrawlerSearchBar
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder="Buscar empresa armadora, contacto, teléfono, email o CUIT... (Ctrl+F | Esc limpia todo)"
        />

        <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
          <div className="flex items-center gap-1.5">
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
                title="Limpiar búsqueda"
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
                disabled={!ownersGrid.canUndo}
                onClick={ownersGrid.undo}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Deshacer (Ctrl + Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!ownersGrid.canRedo}
                onClick={ownersGrid.redo}
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
                onClick={() => setViewModeOwners('tabla')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all ${
                  viewModeOwners === 'tabla'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Vista planilla editable"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Filas</span>
              </button>
              <button
                type="button"
                onClick={() => setViewModeOwners('tarjetas')}
                className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all ${
                  viewModeOwners === 'tarjetas'
                    ? 'bg-amber-400 text-slate-950 shadow-sm'
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
      {viewModeOwners === 'tabla' && (
        <div
          ref={ownersGrid.gridContainerRef}
          tabIndex={0}
          onKeyDown={ownersGrid.handleKeyDown}
          className="alon-zone-grid rounded-2xl overflow-hidden shadow-xl focus:outline-none"
        >
          <GridRibbon
            activeCellBadge={ownersGrid.activeCellBadge || 'PLANILLA ARMADORES'}
            onInsertRow={onOpenNewOwner}
            insertRowLabel="+ Nueva Empresa Armadora"
            undoCount={ownersGrid.undoStack?.length || 0}
            totalRows={filteredOwners.length}
            entityName="armadores"
            exportRows={filteredOwners}
            exportFilename={`barcos_armadores_${new Date().toISOString().split('T')[0]}`}
          />

          <div className="alon-grid-scroll">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="alon-grid-thead sticky top-0 z-20 shadow-sm backdrop-blur-md">
                <tr className="text-slate-300 font-bold uppercase text-[10px] tracking-wider">
                  <th className="py-2 px-1 w-9 text-center select-none">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={ownersGrid.toggleSelectAll}
                        className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                        title="Seleccionar o deseleccionar todas las empresas armadoras visibles"
                      >
                        {ownersGrid.isAllSelected ? (
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
                                openMenu(e, owner, rowIndex, { entityType: 'owners', recordId: owner.id, recordLabel: owner.name }, ownersGrid)
                              }}
                              className="font-mono text-[9px] text-slate-500 hover:text-cyan-300 cursor-pointer font-bold"
                              title="Menú contextual"
                            >
                              {owner.folio ? `#${owner.folio}` : `${rowIndex + 1}`}
                            </button>
                          </div>
                        </td>

                        {/* 1. Razón Social (Editable) */}
                        <td {...cpName}>
                          {inlineOwnerEdit?.rowIndex === rowIndex && inlineOwnerEdit?.colKey === 'name' ? (
                            <input
                              type="text"
                              autoFocus
                              value={inlineOwnerEdit.value}
                              onChange={(e) => setInlineOwnerEdit({ ...inlineOwnerEdit, value: e.target.value })}
                              onBlur={() => commitInlineOwnerEdit()}
                              onKeyDown={(e) => {
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
                          {cpName.childrenFillHandle}
                        </td>

                        {/* 2. Nombre del Armador (Editable) */}
                        <td {...cpArmador}>
                          {inlineOwnerEdit?.rowIndex === rowIndex && inlineOwnerEdit?.colKey === 'armador_name' ? (
                            <input
                              type="text"
                              autoFocus
                              value={inlineOwnerEdit.value}
                              onChange={(e) => setInlineOwnerEdit({ ...inlineOwnerEdit, value: e.target.value })}
                              onBlur={() => commitInlineOwnerEdit()}
                              onKeyDown={(e) => {
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
                          {cpArmador.childrenFillHandle}
                        </td>

                        {/* 3. Teléfono (Editable) */}
                        <td {...cpPhone}>
                          {inlineOwnerEdit?.rowIndex === rowIndex && inlineOwnerEdit?.colKey === 'armador_phone' ? (
                            <input
                              type="text"
                              autoFocus
                              value={inlineOwnerEdit.value}
                              onChange={(e) => setInlineOwnerEdit({ ...inlineOwnerEdit, value: e.target.value })}
                              onBlur={() => commitInlineOwnerEdit()}
                              onKeyDown={(e) => {
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
                          {cpPhone.childrenFillHandle}
                        </td>

                        {/* 4. Correos (Principal y Secundario) */}
                        <td {...cpEmail}>
                          {inlineOwnerEdit?.rowIndex === rowIndex && inlineOwnerEdit?.colKey === 'email_principal' ? (
                            <input
                              type="email"
                              autoFocus
                              value={inlineOwnerEdit.value}
                              onChange={(e) => setInlineOwnerEdit({ ...inlineOwnerEdit, value: e.target.value })}
                              onBlur={() => commitInlineOwnerEdit()}
                              onKeyDown={(e) => {
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
                          {cpEmail.childrenFillHandle}
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
        selectedCount={ownersGrid.selectedRowIds.size}
        totalCount={filteredOwners.length}
        activeFilterLabel={null}
        onClearSelection={ownersGrid.clearRowSelection}
        entityLabel="armadores"
      />
    </div>
  )
}
