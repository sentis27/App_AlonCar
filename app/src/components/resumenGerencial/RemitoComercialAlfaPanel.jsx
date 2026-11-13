import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  CheckSquare,
  Square,
  RefreshCw,
  Settings2,
  Lock,
  Undo2,
  Trash2,
  CopyPlus,
  RotateCcw,
  ShieldAlert
} from 'lucide-react'
import KpiRadar from '../KpiRadar'
import CrawlerSearchBar from '../CrawlerSearchBar'
import GridRibbon from '../GridRibbon'
import GridContextMenu from '../GridContextMenu'
import GridStatusBarBottom from '../GridStatusBarBottom'
import { useSpreadsheetGrid } from '../../hooks/useSpreadsheetGrid'
import { useGridContextMenu } from '../../hooks/useGridContextMenu'
import { matchesUniversalSearch } from '../../lib/searchEngine'
import {
  BILLING_TEMPLATES,
  REMITO_SPREADSHEET_COLUMNS,
  formatUsd
} from '../../lib/drydockCatalogConstants'
import {
  buildRemitoAutoFeedRows,
  computeRemitoFinancialTotals
} from '../../lib/managerialSummaryService'
import AlfaRateCardModal from './AlfaRateCardModal'

/**
 * Submódulo 3 (Arquetipo A: Gallo · Editable + Autoalimentado):
 * Remito Comercial & Tarifario Nivel Alfa.
 * Cumple Estándares 01–07 + Kit Canónico + Audit Logs.
 */
export default function RemitoComercialAlfaPanel({
  ship,
  shipStays = [],
  workOrders = [],
  shipSummary,
  materialRows = [],
  craneHours = {},
  alfaRateCard = [],
  remitoState = null,
  onPersistCellChange,
  onPersistRowAction,
  onSaveAlfaRateCard,
  showFeedback
}) {
  const [templateId, setTemplateId] = useState(remitoState?.templateId || 'PUESTA_SECO_30M')
  const [rows, setRows] = useState(() => {
    if (Array.isArray(remitoState?.rows) && remitoState.rows.length > 0) {
      return remitoState.rows
    }
    return buildRemitoAutoFeedRows({
      ship,
      shipStays,
      workOrders,
      shipSummary,
      materialRows,
      craneHours,
      alfaRateCard,
      templateId: 'PUESTA_SECO_30M',
      existingRows: []
    })
  })

  const [searchQuery, setSearchQuery] = useState('')
  const [kpiFilter, setKpiFilter] = useState('ALL')
  const [taxFilter, setTaxFilter] = useState('ALL')
  const [inlineEdit, setInlineEdit] = useState(null) // { rowId, field, value }
  const [showAlfaModal, setShowAlfaModal] = useState(false)
  const searchInputRef = useRef(null)

  // Rehidratar filas cuando cambia el buque o los datos persistidos desde Supabase
  useEffect(() => {
    const nextTpl = remitoState?.templateId || 'PUESTA_SECO_30M'
    setTemplateId(nextTpl)
    if (Array.isArray(remitoState?.rows) && remitoState.rows.length > 0) {
      setRows(remitoState.rows)
    } else if (ship) {
      setRows(
        buildRemitoAutoFeedRows({
          ship,
          shipStays,
          workOrders,
          shipSummary,
          materialRows,
          craneHours,
          alfaRateCard,
          templateId: nextTpl,
          existingRows: []
        })
      )
    } else {
      setRows([])
    }
    setInlineEdit(null)
  }, [ship?.id, remitoState])

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (kpiFilter === 'EXENTO' && row.tax_type !== 'EXENTO') return false
      if (kpiFilter === 'GRAVADO' && row.tax_type === 'EXENTO') return false
      if (kpiFilter === 'ALFA_LOCK' && !row.is_alfa_locked) return false
      if (kpiFilter === 'ACTIVE_LINES' && Number(row.quantity) <= 0) return false
      if (taxFilter !== 'ALL' && row.tax_type !== taxFilter) return false
      if (searchQuery && !matchesUniversalSearch(row, searchQuery)) return false
      return true
    })
  }, [rows, kpiFilter, taxFilter, searchQuery])

  const internalDirectCostUsd = Number(shipSummary?.totals?.directTotalUsd || 0)
  const financialTotals = useMemo(
    () => computeRemitoFinancialTotals(rows, internalDirectCostUsd),
    [rows, internalDirectCostUsd]
  )

  const kpiCards = useMemo(() => {
    const activeLines = rows.filter((r) => Number(r.quantity) > 0)
    const alfaCount = rows.filter((r) => r.is_alfa_locked).length
    return [
      {
        id: 'GRAVADO',
        label: 'Subtotal Gravado (21%)',
        count: formatUsd(financialTotals.subtotalGravado, 0),
        subtext: `IVA 21%: ${formatUsd(financialTotals.iva21Usd, 0)}`,
        colorTheme: 'cyan'
      },
      {
        id: 'EXENTO',
        label: 'Subtotal Exento',
        count: formatUsd(financialTotals.subtotalExento, 0),
        subtext: 'Navegación / Exentos',
        colorTheme: 'emerald'
      },
      {
        id: 'ACTIVE_LINES',
        label: 'Total Remito c/IVA',
        count: formatUsd(financialTotals.totalRemitoUsd, 0),
        subtext: `${activeLines.length} conceptos con cant. > 0`,
        colorTheme: 'blue'
      },
      {
        id: 'ALFA_LOCK',
        label: 'Costo Directo Piso',
        count: formatUsd(internalDirectCostUsd, 0),
        subtext: `${alfaCount} tarifas Nivel Alfa`,
        colorTheme: 'amber'
      },
      {
        id: 'MARGEN',
        label: 'Margen Real Obra',
        count: formatUsd(financialTotals.margenRealUsd, 0),
        subtext: `${financialTotals.margenPct}% s/Neto (EPP excluido)`,
        colorTheme: financialTotals.margenRealUsd >= 0 ? 'purple' : 'rose'
      }
    ]
  }, [rows, financialTotals, internalDirectCostUsd])

  const commitRowsUpdate = async ({
    nextRows,
    nextTpl = templateId,
    actionType = 'ROW_EDIT',
    rowId = 'batch',
    rowLabel = 'Remito Comercial',
    field = null,
    oldValue = null,
    newValue = null,
    batchUpdates = null,
    changes = {}
  }) => {
    setRows(nextRows)
    if (!ship?.id) return

    const nextShipRemitoState = {
      templateId: nextTpl,
      updatedAt: new Date().toISOString(),
      rows: nextRows
    }

    try {
      if (field !== null && actionType === 'CELL_EDIT') {
        await onPersistCellChange({
          shipId: ship.id,
          shipName: ship.name,
          nextShipRemitoState,
          rowId,
          rowLabel,
          field,
          oldValue,
          newValue
        })
      } else {
        await onPersistRowAction({
          actionType,
          shipId: ship.id,
          shipName: ship.name,
          nextShipRemitoState,
          rowId,
          rowLabel,
          changes,
          batchUpdates
        })
      }
    } catch (err) {
      showFeedback?.('error', `Error al guardar con auditoría: ${err.message}`)
    }
  }

  // Motor Batch del Hook Canónico (Paste 2D, Fill Down, Undo/Redo, Supr)
  const handleGridBatchUpdate = async ({
    colKey,
    newValue,
    targetIds,
    revertMap,
    isRevert,
    actionLabel
  }) => {
    const colDef = REMITO_SPREADSHEET_COLUMNS.find((c) => c.key === colKey)
    if (!colDef || colDef.readOnly) return

    const updatesForAudit = []
    const nextRows = rows.map((row) => {
      const targetVal = isRevert
        ? revertMap?.[row.id]
        : targetIds?.includes(row.id)
          ? newValue
          : undefined

      if (targetVal === undefined) return row

      const cleanVal = colDef.isNumeric ? Number(targetVal) || 0 : String(targetVal ?? '')
      updatesForAudit.push({
        recordId: `${ship?.id}::${row.id}`,
        recordName: `${row.line_code} · ${row.concept}`,
        field: colKey,
        fieldLabel: colDef.label,
        oldValue: row[colKey],
        newValue: cleanVal
      })

      return {
        ...row,
        [colKey]: cleanVal,
        ...(colKey === 'quantity' ? { manualQtyOverride: true } : {}),
        ...(colKey === 'unit_price_usd' ? { is_alfa_locked: false } : {})
      }
    })

    if (updatesForAudit.length === 0) return

    await commitRowsUpdate({
      nextRows,
      actionType: 'BATCH_PASTE',
      rowId: updatesForAudit[0]?.recordId || 'batch',
      rowLabel: `${updatesForAudit.length} celdas (${actionLabel || 'Lote'})`,
      batchUpdates: updatesForAudit
    })
    showFeedback?.('success', `${updatesForAudit.length} celdas actualizadas y auditadas.`)
  }

  const grid = useSpreadsheetGrid({
    rows: filteredRows,
    columns: REMITO_SPREADSHEET_COLUMNS,
    getRowId: (r) => r.id,
    storageKey: `aloncar_grid_remito_${ship?.id || 'default'}`,
    onBatchUpdate: handleGridBatchUpdate,
    canEditCell: (_row, colKey) => !REMITO_SPREADSHEET_COLUMNS.find((c) => c.key === colKey)?.readOnly,
    onCellActivate: (row, colDef) => {
      if (colDef.readOnly) return
      setInlineEdit({
        rowId: row.id,
        field: colDef.key,
        value: row[colDef.key] ?? ''
      })
    },
    onFocusSearch: () => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    },
    showFeedback
  })

  const { menuTarget, openMenu, closeMenu } = useGridContextMenu()

  const commitInlineEdit = async () => {
    if (!inlineEdit) return
    const { rowId, field, value } = inlineEdit
    setInlineEdit(null)

    const targetRow = rows.find((r) => r.id === rowId)
    if (!targetRow) return

    const colDef = REMITO_SPREADSHEET_COLUMNS.find((c) => c.key === field)
    const parsedVal = colDef?.isNumeric ? Math.max(0, Number(value) || 0) : String(value ?? '')
    const prevVal = targetRow[field]
    if (String(parsedVal) === String(prevVal ?? '')) return

    const nextRows = rows.map((r) =>
      r.id === rowId
        ? {
            ...r,
            [field]: parsedVal,
            ...(field === 'quantity' ? { manualQtyOverride: true } : {}),
            ...(field === 'unit_price_usd' ? { is_alfa_locked: false } : {})
          }
        : r
    )

    grid.pushUndoAction({
      colKey: field,
      previousValues: { [rowId]: prevVal },
      newValue: parsedVal,
      actionLabel: `Edición ${colDef?.label || field}`
    })

    await commitRowsUpdate({
      nextRows,
      actionType: 'CELL_EDIT',
      rowId,
      rowLabel: `${targetRow.line_code} · ${targetRow.concept}`,
      field,
      oldValue: prevVal,
      newValue: parsedVal
    })
  }

  const handleInsertRowAt = async (insertIdx = rows.length) => {
    const newRow = {
      id: `rem_${ship?.id || 's'}_custom_${Date.now()}`,
      line_code: 'EXT-01',
      rubro: 'ADICIONALES DE OBRA',
      concept: 'Nuevo ítem adicional de remito comercial',
      source_module: 'Alta Manual Gerencia',
      unit: 'Global',
      quantity: 1,
      unit_price_usd: 0,
      tax_type: 'GRAVADO_21',
      is_alfa_locked: false,
      manualQtyOverride: true,
      observations: ''
    }

    const nextRows = [...rows]
    nextRows.splice(insertIdx, 0, newRow)

    await commitRowsUpdate({
      nextRows,
      actionType: 'ROW_INSERT',
      rowId: newRow.id,
      rowLabel: newRow.concept,
      changes: { inserted: newRow }
    })
    showFeedback?.('success', 'Ítem agregado al remito comercial.')
  }

  const handleDuplicateRow = async (row) => {
    const idx = rows.findIndex((r) => r.id === row.id)
    const copy = {
      ...row,
      id: `rem_${ship?.id || 's'}_dup_${Date.now()}`,
      concept: `${row.concept} (Copia)`,
      manualQtyOverride: true
    }
    const nextRows = [...rows]
    nextRows.splice(idx >= 0 ? idx + 1 : rows.length, 0, copy)

    await commitRowsUpdate({
      nextRows,
      actionType: 'ROW_DUPLICATE',
      rowId: copy.id,
      rowLabel: copy.concept,
      changes: { duplicated_from: row.line_code }
    })
    showFeedback?.('success', 'Fila duplicada.')
  }

  const handleDeleteRow = async (row) => {
    const nextRows = rows.filter((r) => r.id !== row.id)
    await commitRowsUpdate({
      nextRows,
      actionType: 'ROW_DELETE',
      rowId: row.id,
      rowLabel: `${row.line_code} · ${row.concept}`,
      changes: { deleted_code: row.line_code, concept: row.concept }
    })
    showFeedback?.('success', 'Ítem eliminado del remito con trazabilidad.')
  }

  const handleBulkTaxChange = async (nextTax) => {
    if (grid.selectedRowIds.size === 0) return
    const nextRows = rows.map((r) =>
      grid.selectedRowIds.has(r.id) ? { ...r, tax_type: nextTax } : r
    )
    await commitRowsUpdate({
      nextRows,
      actionType: 'BULK_TAX_UPDATE',
      rowId: 'bulk',
      rowLabel: `${grid.selectedRowIds.size} filas -> ${nextTax}`,
      changes: { count: grid.selectedRowIds.size, tax_type: nextTax }
    })
    grid.clearSelectedRows()
  }

  const handleBulkDelete = async () => {
    if (grid.selectedRowIds.size === 0) return
    const count = grid.selectedRowIds.size
    const nextRows = rows.filter((r) => !grid.selectedRowIds.has(r.id))
    await commitRowsUpdate({
      nextRows,
      actionType: 'BULK_DELETE',
      rowId: 'bulk_delete',
      rowLabel: `${count} ítems eliminados`,
      changes: { deletedCount: count }
    })
    grid.clearSelectedRows()
  }

  const handleResyncFromSheets = async (targetTpl = templateId) => {
    const synced = buildRemitoAutoFeedRows({
      ship,
      shipStays,
      workOrders,
      shipSummary,
      materialRows,
      craneHours,
      alfaRateCard,
      templateId: targetTpl,
      existingRows: targetTpl === templateId ? rows : []
    })
    await commitRowsUpdate({
      nextRows: synced,
      nextTpl: targetTpl,
      actionType: 'RESYNC_AUTO_FEED',
      rowId: ship?.id || 'ship',
      rowLabel: `Resincronización Plantilla ${targetTpl}`,
      changes: { templateId: targetTpl, count: synced.length }
    })
    showFeedback?.('success', 'Remito re-sincronizado desde Estadías, Pañol, OTs y Resumen GS-004.')
  }

  const handleTemplateChange = async (nextTpl) => {
    setTemplateId(nextTpl)
    await handleResyncFromSheets(nextTpl)
  }

  function getSpreadsheetCellProps(rowIndex, colKey) {
    const colIdx = REMITO_SPREADSHEET_COLUMNS.findIndex((c) => c.key === colKey)
    if (colIdx === -1) return { className: '', renderHandle: false, domProps: {} }

    const isActive = grid.isCellActive(rowIndex, colIdx)
    const isSelected = grid.isCellSelected(rowIndex, colIdx)
    const isFillPreview = grid.isCellInFillPreview(rowIndex, colIdx)
    const renderHandle = grid.shouldRenderFillHandle(rowIndex, colIdx)

    return {
      renderHandle,
      domProps: {
        onClick: (e) => grid.handleCellClick(rowIndex, colIdx, e),
        onMouseDown: (e) => grid.handleCellMouseDown(rowIndex, colIdx, e),
        onMouseEnter: () => grid.handleCellMouseEnter(rowIndex, colIdx)
      },
      className: `relative select-none transition-colors ${
        isActive
          ? 'ring-2 ring-cyan-400 bg-cyan-950/45 z-20 outline-none'
          : isFillPreview
            ? 'bg-emerald-900/35 border-y border-dashed border-emerald-400'
            : isSelected
              ? 'bg-cyan-900/25'
              : ''
      }`
    }
  }

  const hasFilters = Boolean(searchQuery || kpiFilter !== 'ALL' || taxFilter !== 'ALL')
  const clearFilters = () => {
    setSearchQuery('')
    setKpiFilter('ALL')
    setTaxFilter('ALL')
  }

  if (!ship) {
    return (
      <div className="bg-slate-900/70 border border-slate-700 rounded-xl p-8 text-center text-slate-400">
        Seleccioná un buque para abrir el Remito Comercial Gallo.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {/* Cabecera operativa Remito Alfa: Template + Autoalimentación + Botón Tarifario Alfa */}
      <div className="bg-slate-900/80 border border-emerald-500/35 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase text-emerald-300">Plantilla:</span>
            <select
              value={templateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="bg-slate-950 border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-white outline-none"
            >
              {BILLING_TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={() => handleResyncFromSheets(templateId)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-200 border border-cyan-400/40 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Resincronizar desde Planillas
          </button>

          <button
            type="button"
            onClick={() => setShowAlfaModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-400/40 cursor-pointer"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Tarifario Nivel Alfa ({alfaRateCard.length})
          </button>
        </div>

        {/* Bloque resumen económico Nivel Alfa */}
        <div className="flex flex-wrap items-center gap-3 text-xs tabular-nums">
          <div className="bg-slate-950/90 border border-slate-700 rounded-lg px-2.5 py-1">
            <span className="text-slate-400 mr-1">Exento:</span>
            <strong className="text-emerald-300">{formatUsd(financialTotals.subtotalExento)}</strong>
          </div>
          <div className="bg-slate-950/90 border border-slate-700 rounded-lg px-2.5 py-1">
            <span className="text-slate-400 mr-1">Gravado + IVA:</span>
            <strong className="text-cyan-300">
              {formatUsd(financialTotals.subtotalGravado + financialTotals.iva21Usd)}
            </strong>
          </div>
          <div className="bg-emerald-950/60 border border-emerald-400/50 rounded-lg px-3 py-1">
            <span className="text-emerald-200 mr-1 font-bold">TOTAL REMITO:</span>
            <strong className="text-white text-sm font-black">
              {formatUsd(financialTotals.totalRemitoUsd)}
            </strong>
          </div>
        </div>
      </div>

      {/* ZONA 2: KPI RADAR */}
      <div className="alon-zone-kpis p-3 bg-slate-900/70">
        <KpiRadar
          title="💰 RADAR COMERCIAL NIVEL ALFA & MARGEN REAL DE OBRA"
          subtitle="Clic en cualquier tarjeta para acotar ítems · Margen compara Neto vs Costo Directo GS-004 (sin EPP)"
          cards={kpiCards}
          activeFilterId={kpiFilter === 'ALL' ? null : kpiFilter}
          onCardClick={(id) => {
            if (id !== 'MARGEN') setKpiFilter((prev) => (prev === id ? 'ALL' : id))
          }}
        />
      </div>

      {/* ZONA 3: TOOLBAR */}
      <div className="alon-zone-toolbar p-3 bg-slate-900/70 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5 flex-1">
          <CrawlerSearchBar
            ref={searchInputRef}
            inputRef={searchInputRef}
            value={searchQuery}
            onChange={setSearchQuery}
            onClear={() => setSearchQuery('')}
            placeholder="Buscar ítem, código Alfa, origen, notas... (Ctrl+F)"
          />

          <select
            value={taxFilter}
            onChange={(e) => setTaxFilter(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 outline-none"
          >
            <option value="ALL">Alícuota: Todas</option>
            <option value="GRAVADO_21">Gravado 21%</option>
            <option value="EXENTO">Exento</option>
          </select>

          {hasFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-200 border border-slate-600 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Limpiar
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => grid.undo()}
          disabled={!grid.canUndo}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-cyan-200 border border-cyan-500/40 cursor-pointer"
        >
          <Undo2 className="w-3.5 h-3.5" />
          Deshacer (Ctrl+Z)
        </button>
      </div>

      {/* ZONA 4: GRILLA INDUSTRIAL CANÓNICA (useSpreadsheetGrid) */}
      <div className="alon-zone-grid flex flex-col bg-slate-900/80 overflow-hidden">
        <GridRibbon
          activeCellBadge={grid.activeCellBadge}
          onInsertRow={() => handleInsertRowAt(rows.length)}
          insertRowLabel="+ Insertar Ítem"
          undoCount={grid.undoStack?.length || 0}
          totalRows={filteredRows.length}
          entityName="ítems"
          exportRows={filteredRows.map((r) => ({
            ...r,
            net_usd: REMITO_SPREADSHEET_COLUMNS.find((c) => c.key === 'net_usd').getValue(r),
            total_usd: REMITO_SPREADSHEET_COLUMNS.find((c) => c.key === 'total_usd').getValue(r)
          }))}
          exportFilename={`remito_comercial_${ship.name.replace(/\s+/g, '_')}.xls`}
          exportColumns={REMITO_SPREADSHEET_COLUMNS}
        />

        <div
          tabIndex={0}
          onKeyDown={grid.handleKeyDown}
          onPaste={grid.handlePaste}
          ref={grid.gridContainerRef}
          className="alon-grid-scroll max-h-[55vh] overflow-auto outline-none"
        >
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 alon-grid-thead backdrop-blur-md">
              <tr>
                {/* Columna 0 Canónica: Checkbox Maestro + # */}
                <th className="py-2 px-1.5 w-10 text-center select-none">
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => grid.toggleSelectAll()}
                      className="text-slate-400 hover:text-cyan-400 cursor-pointer"
                      title="Seleccionar todas las filas visibles"
                    >
                      {filteredRows.length > 0 && grid.selectedRowIds.size === filteredRows.length ? (
                        <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span className="font-mono text-[9px] text-slate-500 font-bold">#</span>
                  </div>
                </th>
                <th className="py-2 px-2 w-24">Código ✎</th>
                <th className="py-2 px-2 min-w-[230px]">Concepto / Ítem del Remito ✎</th>
                <th className="py-2 px-2">Origen Autoalimentado</th>
                <th className="py-2 px-2 w-20">Unid. ✎</th>
                <th className="py-2 px-2 w-24 text-right">Cantidad ✎</th>
                <th className="py-2 px-2 w-28 text-right">P.Unit US$ ✎</th>
                <th className="py-2 px-2 w-24 text-center">IVA 21% ✎</th>
                <th className="py-2 px-2 w-28 text-right">Neto US$</th>
                <th className="py-2 px-2 w-28 text-right">Total c/IVA</th>
                <th className="py-2 px-2 min-w-[160px]">Notas / Criterio ✎</th>
                <th className="py-2 px-2 w-20 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredRows.map((row, rowIndex) => {
                const isSelected = grid.isRowSelected(row.id)
                const qtyNum = Number(row.quantity) || 0
                const unitPrice = Number(row.unit_price_usd) || 0
                const netUsd = qtyNum * unitPrice
                const totalWithTax = row.tax_type === 'EXENTO' ? netUsd : netUsd * 1.21

                const renderEditableCell = (colKey, displayNode, extraClass = '') => {
                  const cp = getSpreadsheetCellProps(rowIndex, colKey)
                  const isEditingThis =
                    inlineEdit?.rowId === row.id && inlineEdit?.field === colKey
                  const colDef = REMITO_SPREADSHEET_COLUMNS.find((c) => c.key === colKey)

                  return (
                    <td
                      {...cp.domProps}
                      onDoubleClick={() => {
                        if (!colDef?.readOnly) {
                          setInlineEdit({ rowId: row.id, field: colKey, value: row[colKey] ?? '' })
                        }
                      }}
                      className={`py-2 px-2 ${extraClass} ${cp.className}`}
                    >
                      {isEditingThis ? (
                        colKey === 'tax_type' ? (
                          <select
                            autoFocus
                            value={inlineEdit.value}
                            onChange={(e) =>
                              setInlineEdit((prev) => ({ ...prev, value: e.target.value }))
                            }
                            onBlur={() => commitInlineEdit()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitInlineEdit()
                              if (e.key === 'Escape') setInlineEdit(null)
                            }}
                            className="w-full bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-xs text-white outline-none"
                          >
                            <option value="GRAVADO_21">Gravado 21%</option>
                            <option value="EXENTO">Exento</option>
                          </select>
                        ) : (
                          <input
                            autoFocus
                            type={colDef?.isNumeric ? 'number' : 'text'}
                            step={colDef?.isNumeric ? 'any' : undefined}
                            value={inlineEdit.value}
                            onChange={(e) =>
                              setInlineEdit((prev) => ({ ...prev, value: e.target.value }))
                            }
                            onBlur={() => commitInlineEdit()}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitInlineEdit()
                              if (e.key === 'Escape') setInlineEdit(null)
                            }}
                            className={`w-full bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white outline-none ${
                              colDef?.isNumeric ? 'text-right tabular-nums' : ''
                            }`}
                          />
                        )
                      ) : (
                        displayNode
                      )}

                      {cp.renderHandle && (
                        <div
                          onMouseDown={grid.handleFillHandleMouseDown}
                          onDoubleClick={grid.handleFillHandleDoubleClick}
                          className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow"
                          title="Arrastrar hacia abajo para rellenar (Ctrl+D)"
                        />
                      )}
                    </td>
                  )
                }

                return (
                  <tr
                    key={row.id}
                    onContextMenu={(e) =>
                      openMenu(
                        e,
                        row,
                        rowIndex,
                        {
                          entityType: 'remito_comercial',
                          recordId: `${ship.id}::${row.id}`,
                          recordLabel: `${row.line_code} · ${row.concept}`
                        },
                        grid
                      )
                    }
                    className={`transition-colors ${
                      isSelected
                        ? 'bg-cyan-950/30 text-white'
                        : qtyNum > 0
                          ? 'hover:bg-slate-800/45 text-slate-200'
                          : 'hover:bg-slate-800/35 text-slate-500'
                    }`}
                  >
                    {/* Columna 0 Canónica */}
                    <td className="py-1.5 px-1.5 text-center w-10 select-none">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => grid.toggleSelectRow(row.id)}
                          className="text-slate-500 hover:text-cyan-400 cursor-pointer"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            openMenu(
                              e,
                              row,
                              rowIndex,
                              {
                                entityType: 'remito_comercial',
                                recordId: `${ship.id}::${row.id}`,
                                recordLabel: `${row.line_code} · ${row.concept}`
                              },
                              grid
                            )
                          }}
                          className="text-[10px] font-mono text-slate-400 hover:text-cyan-300 cursor-pointer"
                          title="Clic para menú contextual e historial audit_logs"
                        >
                          {rowIndex + 1}
                        </button>
                      </div>
                    </td>

                    {renderEditableCell(
                      'line_code',
                      <span className="font-mono font-bold text-emerald-300">{row.line_code}</span>
                    )}

                    {renderEditableCell(
                      'concept',
                      <div>
                        <div className="font-semibold text-white">{row.concept}</div>
                        {row.line_code === 'OBR-OT' && (
                          <div className="text-[10px] text-amber-300 flex items-center gap-1 mt-0.5">
                            <ShieldAlert className="w-3 h-3" />
                            Piso Directo GS-004: {formatUsd(internalDirectCostUsd)}
                          </div>
                        )}
                      </div>
                    )}

                    {renderEditableCell(
                      'source_module',
                      <span className="text-[11px] text-slate-400">{row.source_module}</span>
                    )}

                    {renderEditableCell(
                      'unit',
                      <span className="text-slate-300">{row.unit}</span>
                    )}

                    {renderEditableCell(
                      'quantity',
                      <span className="font-bold tabular-nums">{qtyNum}</span>,
                      'text-right'
                    )}

                    {renderEditableCell(
                      'unit_price_usd',
                      <span className="inline-flex items-center justify-end gap-1 font-bold text-emerald-300 tabular-nums">
                        {row.is_alfa_locked && <Lock className="w-3 h-3 text-emerald-400" />}
                        {formatUsd(unitPrice)}
                      </span>,
                      'text-right'
                    )}

                    {renderEditableCell(
                      'tax_type',
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          row.tax_type === 'EXENTO'
                            ? 'bg-emerald-500/20 text-emerald-300'
                            : 'bg-cyan-500/20 text-cyan-300'
                        }`}
                      >
                        {row.tax_type === 'EXENTO' ? 'Exento' : 'IVA 21%'}
                      </span>,
                      'text-center'
                    )}

                    {renderEditableCell(
                      'net_usd',
                      <span className="font-semibold text-slate-100 tabular-nums">
                        {formatUsd(netUsd)}
                      </span>,
                      'text-right'
                    )}

                    {renderEditableCell(
                      'total_usd',
                      <span className="font-extrabold text-cyan-300 tabular-nums">
                        {formatUsd(totalWithTax)}
                      </span>,
                      'text-right'
                    )}

                    {renderEditableCell(
                      'observations',
                      <span className="text-slate-400 truncate block max-w-[200px]" title={row.observations}>
                        {row.observations || '—'}
                      </span>
                    )}

                    <td className="py-2 px-2 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => handleDuplicateRow(row)}
                        className="p-1 text-slate-400 hover:text-cyan-300 cursor-pointer"
                        title="Duplicar ítem"
                      >
                        <CopyPlus className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteRow(row)}
                        className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                        title="Eliminar ítem"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* MENÚ CONTEXTUAL CANÓNICO */}
        {menuTarget && (
          <GridContextMenu
            target={menuTarget}
            onClose={closeMenu}
            onCopyCell={grid.copyActiveCell}
            onCopyRow={grid.copyRow}
            onPaste={grid.pasteToActiveOrRange}
            onDeleteCell={grid.deleteActiveCellOrRange}
            onInsertRowAbove={() => handleInsertRowAt(menuTarget.rowIndex)}
            onInsertRowBelow={() => handleInsertRowAt(menuTarget.rowIndex + 1)}
            onDuplicateRow={handleDuplicateRow}
            onDeleteRow={handleDeleteRow}
            entityType="remito_comercial"
            recordId={`${ship.id}::${menuTarget.row?.id}`}
            recordLabel={`${menuTarget.row?.line_code || ''} · ${menuTarget.row?.concept || ''}`}
          />
        )}

        {/* ZONA 5: BARRA DE ESTADO Y ACCIONES MASIVAS */}
        <GridStatusBarBottom
          isFixed={false}
          filteredCount={filteredRows.length}
          totalCount={rows.length}
          entityName="ítems"
          hasActiveFilter={hasFilters}
          onClearFilters={clearFilters}
          selectionStats={grid.selectionStats}
          onClearSelection={() => grid.setSelectionRange(null)}
          customSelection={
            grid.selectedRowIds.size > 0
              ? {
                  count: grid.selectedRowIds.size,
                  label: 'ítems seleccionados',
                  onClear: () => grid.clearSelectedRows()
                }
              : null
          }
          extraActions={
            grid.selectedRowIds.size > 0 ? (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handleBulkTaxChange('EXENTO')}
                  className="px-2 py-1 rounded bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-200 border border-emerald-400/40 text-[11px] font-bold cursor-pointer"
                >
                  Marcar Exento
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkTaxChange('GRAVADO_21')}
                  className="px-2 py-1 rounded bg-cyan-600/30 hover:bg-cyan-600/50 text-cyan-200 border border-cyan-400/40 text-[11px] font-bold cursor-pointer"
                >
                  Gravado 21%
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="px-2 py-1 rounded bg-rose-600/30 hover:bg-rose-600/50 text-rose-200 border border-rose-400/40 text-[11px] font-bold cursor-pointer"
                >
                  Eliminar ({grid.selectedRowIds.size})
                </button>
              </div>
            ) : null
          }
          globalAggregates={[
            { label: 'SUBTOTAL NETO', value: formatUsd(financialTotals.subtotalNetoUsd) },
            { label: 'IVA 21%', value: formatUsd(financialTotals.iva21Usd) },
            { label: 'TOTAL REMITO', value: formatUsd(financialTotals.totalRemitoUsd), highlight: true },
            {
              label: `MARGEN (${financialTotals.margenPct}%)`,
              value: formatUsd(financialTotals.margenRealUsd)
            }
          ]}
        />
      </div>

      <AlfaRateCardModal
        isOpen={showAlfaModal}
        onClose={() => setShowAlfaModal(false)}
        rateCard={alfaRateCard}
        onSaveRateItem={onSaveAlfaRateCard}
      />
    </div>
  )
}
