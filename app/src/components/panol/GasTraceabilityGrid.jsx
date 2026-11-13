import { useState, useMemo } from 'react'
import {
  CheckSquare,
  Square,
  History,
  Trash2,
  Filter,
  Building2,
  Flame,
  Link2,
  Truck
} from 'lucide-react'
import { useSpreadsheetGrid } from '../../hooks/useSpreadsheetGrid'
import { useGridContextMenu } from '../../hooks/useGridContextMenu'
import GridRibbon from '../GridRibbon'
import GridContextMenu from '../GridContextMenu'
import GridStatusBarBottom from '../GridStatusBarBottom'
import HighlightText from '../HighlightText'
import {
  GAS_TRACEABILITY_COLUMNS,
  GAS_OPERATION_META,
  buildGasTraceabilityRows
} from '../../lib/panolConstants'
import {
  updateGasMovementInlineService,
  deleteGasMovementService
} from '../../lib/panolService'
import { matchesUniversalSearch } from '../../lib/searchEngine'

/**
 * Grilla canónica de Trazabilidad Cronológica de Cilindros de Gas (Control de Gases).
 * Integra movimientos con Empresas Gaseras (Saldo Inicial, Ingresos, Devoluciones) y Contratistas.
 * Cumple Estándar CARGA_EDICION (useSpreadsheetGrid + Columna 0 + GridContextMenu + audit_logs).
 */
export default function GasTraceabilityGrid({
  gasMovements = [],
  setGasMovements,
  suppliers = [],
  materials = [],
  ships = [],
  workOrders = [],
  searchQuery = '',
  filterSupplierId = 'TODOS',
  setFilterSupplierId = null,
  filterMaterialId = 'TODOS',
  setFilterMaterialId = null,
  isAdmin: _isAdmin = false,
  user = null,
  showFeedback,
  onOpenSupplierModal = null
}) {
  const [filterScope, setFilterScope] = useState('TODOS') // TODOS | PROVEEDOR | CONTRATISTA
  const [filterOpType, setFilterOpType] = useState('TODAS')
  const [localSupFilter, setLocalSupFilter] = useState('TODOS')
  const [localMatFilter, setLocalMatFilter] = useState('TODOS')
  const [inlineEdit, setInlineEdit] = useState({ id: null, field: null, value: '' })

  const activeSupplierFilter = setFilterSupplierId ? filterSupplierId : localSupFilter
  const updateSupplierFilter = setFilterSupplierId || setLocalSupFilter
  const activeMaterialFilter = setFilterMaterialId ? filterMaterialId : localMatFilter
  const updateMaterialFilter = setFilterMaterialId || setLocalMatFilter

  const gasSuppliers = useMemo(
    () => (suppliers || []).filter((s) => s.is_gas_supplier).sort((a, b) => a.name.localeCompare(b.name)),
    [suppliers]
  )

  const gasMaterials = useMemo(() => {
    const usedIds = new Set((gasMovements || []).map((m) => m.material_id).filter(Boolean))
    return (materials || [])
      .filter((m) => m.rubro === 'GASES' || m.category === 'GASES' || usedIds.has(m.id))
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [materials, gasMovements])

  const allRows = useMemo(
    () => buildGasTraceabilityRows(gasMovements, { suppliers, materials, ships, workOrders }),
    [gasMovements, suppliers, materials, ships, workOrders]
  )

  const filteredRows = useMemo(() => {
    return allRows.filter((r) => {
      if (filterScope !== 'TODOS' && r.opMeta?.scope !== filterScope) return false
      if (filterOpType !== 'TODAS' && r.operation_type !== filterOpType) return false
      if (activeSupplierFilter !== 'TODOS') {
        const matchSup =
          r.supplier_delivered_id === activeSupplierFilter ||
          r.supplier_returned_id === activeSupplierFilter
        if (!matchSup) return false
      }
      if (activeMaterialFilter !== 'TODOS' && r.material_id !== activeMaterialFilter) return false
      if (searchQuery && searchQuery.trim()) {
        return matchesUniversalSearch(r, searchQuery, {
          gas_name: r.gas_name,
          supplier_display: r.supplier_display,
          actor_display: r.actor_display,
          remito_number: r.remito_number || '',
          op_label: r.opMeta?.label || '',
          ship_name: r.ship_name,
          ot_label: r.ot_label,
          patio_impact: r.patio_impact,
          performed_by: r.performed_by || ''
        })
      }
      return true
    })
  }, [allRows, filterScope, filterOpType, activeSupplierFilter, activeMaterialFilter, searchQuery])

  const hasActiveLocalFilter = Boolean(
    filterScope !== 'TODOS' ||
      filterOpType !== 'TODAS' ||
      activeSupplierFilter !== 'TODOS' ||
      activeMaterialFilter !== 'TODOS'
  )

  const clearTraceFilters = () => {
    setFilterScope('TODOS')
    setFilterOpType('TODAS')
    updateSupplierFilter('TODOS')
    updateMaterialFilter('TODOS')
  }

  const commitInlineEdit = async (overrideValue = null) => {
    if (!inlineEdit.id || !inlineEdit.field) return
    const targetId = inlineEdit.id
    const targetField = inlineEdit.field
    const nextValue = overrideValue !== null ? overrideValue : inlineEdit.value
    setInlineEdit({ id: null, field: null, value: '' })

    try {
      const updated = await updateGasMovementInlineService({
        movementId: targetId,
        field: targetField,
        value: nextValue,
        gasMovements,
        user
      })
      if (updated && setGasMovements) {
        setGasMovements((prev) => prev.map((g) => (g.id === targetId ? { ...g, ...updated } : g)))
      }
      showFeedback?.('success', 'Registro de trazabilidad actualizado y auditado.')
    } catch (err) {
      showFeedback?.('error', err.message || 'Error al actualizar registro de gas.')
    }
  }

  const handleBatchUpdate = async (updatesList = []) => {
    for (const upd of updatesList) {
      try {
        const updated = await updateGasMovementInlineService({
          movementId: upd.rowId,
          field: upd.colKey,
          value: upd.newValue,
          gasMovements,
          user
        })
        if (updated && setGasMovements) {
          setGasMovements((prev) => prev.map((g) => (g.id === upd.rowId ? { ...g, ...updated } : g)))
        }
      } catch (err) {
        showFeedback?.('error', err.message || 'Error actualizando celda de trazabilidad.')
      }
    }
  }

  const handleDeleteRow = async (row) => {
    if (!row) return
    if (row.is_linked_to_panol_tx) {
      showFeedback?.(
        'error',
        'Este movimiento proviene de "Movimientos y Retiros". Editá o anulá la fila desde esa planilla.'
      )
      return
    }
    const label = `${row.opMeta?.shortLabel || row.operation_type} · ${row.quantity}x ${row.gas_name}`
    if (!window.confirm(`¿Eliminar de la trazabilidad "${label}"? El balance del patio se recalculará al instante.`)) {
      return
    }
    try {
      const deletedId = await deleteGasMovementService({ movement: row, user })
      if (setGasMovements) {
        setGasMovements((prev) => prev.filter((g) => g.id !== deletedId))
      }
      showFeedback?.('success', 'Movimiento eliminado de Control de Gases (registrado en auditoría).')
    } catch (err) {
      showFeedback?.('error', err.message || 'Error eliminando movimiento de gas.')
    }
  }

  const { menuTarget, openMenu, closeMenu } = useGridContextMenu()

  const grid = useSpreadsheetGrid({
    rows: filteredRows,
    columns: GAS_TRACEABILITY_COLUMNS,
    getRowId: (r) => r.id,
    storageKey: 'aloncar_panol_gas_traceability_grid',
    showFeedback: (t, msg) => showFeedback?.(t, msg),
    onBatchUpdate: handleBatchUpdate,
    canEditCell: (row, colKey) => {
      if (colKey === 'condition_display' && !row?.isSupplierOp) return false
      const col = GAS_TRACEABILITY_COLUMNS.find((c) => c.key === colKey)
      return Boolean(col && !col.readOnly)
    },
    onCellActivate: (row, colDef) => {
      if (!row || !colDef || colDef.readOnly) return
      if (colDef.key === 'condition_display') {
        if (!row.isSupplierOp) return
        setInlineEdit({ id: row.id, field: 'cylinder_condition', value: row.condition_code || 'VACIO' })
        return
      }
      if (colDef.key === 'movement_date') {
        setInlineEdit({ id: row.id, field: 'movement_date', value: row.date_only || '' })
        return
      }
      setInlineEdit({
        id: row.id,
        field: colDef.key,
        value: row[colDef.key] !== null && row[colDef.key] !== undefined ? String(row[colDef.key]) : ''
      })
    }
  })

  const getCellProps = (rowIndex, colKey) => {
    const colIdx = GAS_TRACEABILITY_COLUMNS.findIndex((c) => c.key === colKey)
    const isActive = grid.isCellActive(rowIndex, colIdx)
    const isSelected = grid.isCellSelected(rowIndex, colIdx)
    const isFillPreview = grid.isCellInFillPreview(rowIndex, colIdx)
    const renderHandle = grid.shouldRenderFillHandle(rowIndex, colIdx)
    return {
      renderHandle,
      domProps: {
        onClick: (e) => {
          grid.gridContainerRef.current?.focus()
          grid.handleCellClick(rowIndex, colIdx, e)
        },
        onMouseDown: (e) => {
          grid.gridContainerRef.current?.focus()
          grid.handleCellMouseDown(rowIndex, colIdx, e)
        },
        onMouseEnter: () => grid.handleCellMouseEnter(rowIndex, colIdx)
      },
      className: `relative select-none transition-colors ${
        isActive
          ? 'ring-2 ring-cyan-400 bg-cyan-950/40 z-20 outline-none'
          : isFillPreview
            ? 'bg-cyan-900/40 border-y border-dashed border-cyan-400'
            : isSelected
              ? 'bg-cyan-900/25'
              : ''
      }`
    }
  }

  const totalsSummary = useMemo(() => {
    let supplierIn = 0
    let supplierOut = 0
    let contractorMoves = 0
    filteredRows.forEach((r) => {
      const q = Number(r.quantity) || 1
      if (['SALDO_INICIAL_PATIO', 'INGRESO_PROVEEDOR', 'AJUSTE_PATIO'].includes(r.operation_type)) {
        supplierIn += q
      } else if (r.operation_type === 'DEVOLUCION_PROVEEDOR') {
        supplierOut += q
      } else {
        contractorMoves += q
      }
    })
    return { supplierIn, supplierOut, contractorMoves }
  }, [filteredRows])

  const exportRowsFormatted = useMemo(
    () =>
      filteredRows.map((r) => ({
        fecha: r.date_only,
        operacion: r.opMeta?.label || r.operation_type,
        remito: r.remito_number || '',
        gas: r.gas_name,
        actor: r.actor_display,
        buque_ot: [r.ship_name, r.ot_label].filter(Boolean).join(' · '),
        estado: r.condition_display,
        impacto: r.patio_impact,
        cantidad: Number(r.quantity) || 1,
        observaciones: r.notes || '',
        responsable: r.performed_by || ''
      })),
    [filteredRows]
  )

  const exportColumns = [
    { key: 'fecha', label: 'Fecha' },
    { key: 'operacion', label: 'Operación' },
    { key: 'remito', label: 'N° Remito' },
    { key: 'gas', label: 'Tipo de Gas' },
    { key: 'actor', label: 'Empresa / Contratista' },
    { key: 'buque_ot', label: 'Buque / OT' },
    { key: 'estado', label: 'Estado Tubo' },
    { key: 'impacto', label: 'Impacto Patio / Deuda' },
    { key: 'cantidad', label: 'Cantidad' },
    { key: 'observaciones', label: 'Observaciones' },
    { key: 'responsable', label: 'Registrado Por' }
  ]

  return (
    <div className="alon-zone-grid font-sans space-y-0">
      {/* Cabecera y Filtros Específicos de Trazabilidad */}
      <div className="px-3 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-cyan-400 shrink-0" />
          <div>
            <span className="font-black text-white uppercase tracking-wider text-xs block leading-tight">
              Tabla Cronológica de Trazabilidad de Tubos y Remitos
            </span>
            <span className="text-[10px] text-slate-400 block">
              Historial unificado: Saldo Inicial, Ingresos y Devoluciones a Gaseras + Entregas, Recambios 1x1 y Devoluciones Finales.
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <select
            value={filterScope}
            onChange={(e) => setFilterScope(e.target.value)}
            className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-semibold focus:outline-none focus:border-cyan-400"
          >
            <option value="TODOS">Todos los Circuitos</option>
            <option value="PROVEEDOR">Solo Empresas Gaseras</option>
            <option value="CONTRATISTA">Solo Contratistas</option>
          </select>

          <select
            value={activeSupplierFilter}
            onChange={(e) => updateSupplierFilter(e.target.value)}
            className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-semibold focus:outline-none focus:border-cyan-400"
          >
            <option value="TODOS">Todas las Gaseras</option>
            {gasSuppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          <select
            value={activeMaterialFilter}
            onChange={(e) => updateMaterialFilter(e.target.value)}
            className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-semibold focus:outline-none focus:border-cyan-400"
          >
            <option value="TODOS">Todos los Gases</option>
            {gasMaterials.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>

          <select
            value={filterOpType}
            onChange={(e) => setFilterOpType(e.target.value)}
            className="px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 font-semibold focus:outline-none focus:border-cyan-400"
          >
            <option value="TODAS">Todas las Operaciones</option>
            {Object.entries(GAS_OPERATION_META).map(([k, meta]) => (
              <option key={k} value={k}>
                {meta.label}
              </option>
            ))}
          </select>

          {hasActiveLocalFilter && (
            <button
              type="button"
              onClick={clearTraceFilters}
              className="px-2 py-1 rounded-lg bg-rose-950/70 hover:bg-rose-900 border border-rose-500/50 text-rose-200 font-bold text-[10px] cursor-pointer"
            >
              ✕ Limpiar
            </button>
          )}
        </div>
      </div>

      {/* Ribbon Canónico con Exportación */}
      <GridRibbon
        activeCellBadge={grid.activeCellBadge}
        undoCount={grid.undoStack?.length || 0}
        totalRows={filteredRows.length}
        entityName="movimientos"
        exportRows={exportRowsFormatted}
        exportColumns={exportColumns}
        exportFilename={`trazabilidad_gases_${new Date().toISOString().split('T')[0]}`}
        extraActions={
          onOpenSupplierModal && (
            <button
              type="button"
              onClick={() =>
                onOpenSupplierModal(activeSupplierFilter !== 'TODOS' ? activeSupplierFilter : '')
              }
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-600/25 hover:bg-cyan-600/40 border border-cyan-500/60 text-cyan-200 font-bold text-[11px] cursor-pointer transition-colors"
            >
              <Truck className="w-3.5 h-3.5 text-cyan-300" />
              <span>+ Remito / Saldo Gasera</span>
            </button>
          )
        }
      />

      {/* Grilla Canónica */}
      <div
        tabIndex={0}
        onKeyDown={grid.handleKeyDown}
        ref={grid.gridContainerRef}
        className="alon-grid-scroll focus:outline-none max-h-[460px] overflow-y-auto"
      >
        <table className="w-full text-left text-[11px] border-collapse">
          <thead className="sticky top-0 z-20 alon-grid-thead">
            <tr>
              <th className="py-2 px-1 w-9 text-center select-none">
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <button
                    type="button"
                    onClick={grid.toggleSelectAll}
                    className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                    title="Seleccionar todos los movimientos visibles"
                  >
                    {grid.isAllSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span className="font-mono text-[9px] text-slate-500 font-bold">#</span>
                </div>
              </th>
              <th className="py-2 px-2">Fecha ✎</th>
              <th className="py-2 px-2">Operación</th>
              <th className="py-2 px-2">N° Remito ✎</th>
              <th className="py-2 px-2">Tipo de Gas</th>
              <th className="py-2 px-2">Empresa Gasera / Contratista</th>
              <th className="py-2 px-2 text-center">Estado Tubo ✎</th>
              <th className="py-2 px-2">Impacto Patio / Deuda</th>
              <th className="py-2 px-2 text-right">Cant. ✎</th>
              <th className="py-2 px-2">Observaciones / Responsable ✎</th>
              <th className="py-2 px-2 text-center">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredRows.length === 0 ? (
              <tr>
                <td colSpan={11} className="py-10 text-center text-slate-500 italic">
                  No hay movimientos de gases que coincidan con los filtros seleccionados.
                </td>
              </tr>
            ) : (
              filteredRows.map((row, rowIndex) => {
                const isRowSelected = grid.selectedRowIds.has(row.id)
                const dateProps = getCellProps(rowIndex, 'movement_date')
                const remitoProps = getCellProps(rowIndex, 'remito_number')
                const condProps = getCellProps(rowIndex, 'condition_display')
                const qtyProps = getCellProps(rowIndex, 'quantity')
                const notesProps = getCellProps(rowIndex, 'notes')

                return (
                  <tr
                    key={row.id}
                    onContextMenu={(e) =>
                      openMenu(
                        e,
                        row,
                        rowIndex,
                        {
                          entityType: 'gas_cylinders',
                          recordId: row.id,
                          recordLabel: `${row.opMeta?.shortLabel || row.operation_type} · ${row.gas_name}`
                        },
                        grid
                      )
                    }
                    className={`group transition-colors ${
                      isRowSelected ? 'bg-cyan-950/35 text-cyan-50' : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Columna 0 Canónica (#) */}
                    <td className="py-1.5 px-1 text-center w-9 select-none">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => grid.toggleSelectRow(row.id)}
                          className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                          title="Seleccionar fila"
                        >
                          {isRowSelected ? (
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
                                entityType: 'gas_cylinders',
                                recordId: row.id,
                                recordLabel: `${row.opMeta?.shortLabel || row.operation_type} · ${row.gas_name}`
                              },
                              grid
                            )
                          }}
                          className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded cursor-pointer hover:bg-cyan-950/90 hover:text-cyan-300 ${
                            isRowSelected ? 'text-cyan-300 bg-cyan-950/50' : 'text-slate-500 group-hover:text-cyan-400'
                          }`}
                          title="Clic para menú contextual e historial de auditoría"
                        >
                          {rowIndex + 1}
                        </button>
                      </div>
                    </td>

                    {/* 1. Fecha */}
                    <td
                      {...dateProps.domProps}
                      onDoubleClick={() =>
                        setInlineEdit({ id: row.id, field: 'movement_date', value: row.date_only || '' })
                      }
                      className={`py-1.5 px-2 font-mono text-slate-300 whitespace-nowrap cursor-pointer ${dateProps.className}`}
                      title="Doble clic para corregir fecha"
                    >
                      {inlineEdit.id === row.id && inlineEdit.field === 'movement_date' ? (
                        <input
                          type="date"
                          autoFocus
                          value={inlineEdit.value}
                          onChange={(e) => setInlineEdit((prev) => ({ ...prev, value: e.target.value }))}
                          onBlur={() => commitInlineEdit()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitInlineEdit()
                            if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                          }}
                          className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[11px] font-mono text-white focus:outline-none"
                        />
                      ) : (
                        <span>{row.date_only}</span>
                      )}
                    </td>

                    {/* 2. Operación */}
                    <td className="py-1.5 px-2 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border font-bold text-[10px] ${
                          row.opMeta?.badge || 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        {row.isSupplierOp ? (
                          <Truck className="w-3 h-3 shrink-0" />
                        ) : (
                          <Flame className="w-3 h-3 shrink-0" />
                        )}
                        <span>{row.opMeta?.shortLabel || row.operation_type}</span>
                      </span>
                    </td>

                    {/* 3. N° Remito */}
                    <td
                      {...remitoProps.domProps}
                      onDoubleClick={() =>
                        setInlineEdit({ id: row.id, field: 'remito_number', value: row.remito_number || '' })
                      }
                      className={`py-1.5 px-2 font-mono text-cyan-200 whitespace-nowrap cursor-pointer ${remitoProps.className}`}
                      title="Doble clic para cargar o editar N° de Remito"
                    >
                      {inlineEdit.id === row.id && inlineEdit.field === 'remito_number' ? (
                        <input
                          type="text"
                          autoFocus
                          value={inlineEdit.value}
                          onChange={(e) =>
                            setInlineEdit((prev) => ({ ...prev, value: e.target.value.toUpperCase() }))
                          }
                          onBlur={() => commitInlineEdit()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitInlineEdit()
                            if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                          }}
                          className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-[11px] font-mono text-white w-28 uppercase focus:outline-none"
                        />
                      ) : row.remito_number ? (
                        <span className="px-1.5 py-0.5 rounded bg-slate-950 border border-cyan-500/40 text-cyan-300 font-bold text-[10px]">
                          <HighlightText text={row.remito_number} query={searchQuery} />
                        </span>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>

                    {/* 4. Tipo de Gas */}
                    <td className="py-1.5 px-2 font-bold text-white whitespace-nowrap">
                      <HighlightText text={row.gas_name} query={searchQuery} />
                    </td>

                    {/* 5. Empresa / Contratista */}
                    <td className="py-1.5 px-2">
                      {row.isSupplierOp ? (
                        <div className="flex items-center gap-1.5 font-bold text-cyan-200">
                          <Truck className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span>
                            <HighlightText text={row.supplier_display} query={searchQuery} />
                          </span>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center gap-1 font-bold text-amber-200">
                            <Building2 className="w-3 h-3 text-amber-400 shrink-0" />
                            <span>
                              <HighlightText text={row.contractor_name || 'ALON CAR'} query={searchQuery} />
                            </span>
                            <span className="text-[10px] font-normal text-slate-400">
                              · {row.supplier_display}
                            </span>
                          </div>
                          {(row.ship_name || row.ot_label) && (
                            <div className="text-[10px] text-slate-400">
                              {[row.ship_name, row.ot_label].filter(Boolean).join(' · ')}
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 6. Estado Tubo */}
                    <td
                      {...condProps.domProps}
                      onDoubleClick={() => {
                        if (!row.isSupplierOp) return
                        setInlineEdit({
                          id: row.id,
                          field: 'cylinder_condition',
                          value: row.condition_code || 'VACIO'
                        })
                      }}
                      className={`py-1.5 px-2 text-center whitespace-nowrap ${
                        row.isSupplierOp ? 'cursor-pointer' : ''
                      } ${condProps.className}`}
                      title={row.isSupplierOp ? 'Doble clic para alternar VACIO / LLENO' : 'Definido por operación'}
                    >
                      {inlineEdit.id === row.id && inlineEdit.field === 'cylinder_condition' ? (
                        <select
                          autoFocus
                          value={inlineEdit.value}
                          onChange={(e) => commitInlineEdit(e.target.value)}
                          onBlur={() => setInlineEdit({ id: null, field: null, value: '' })}
                          className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[10px] font-black text-white focus:outline-none"
                        >
                          <option value="VACIO">VACIO</option>
                          <option value="LLENO">LLENO</option>
                        </select>
                      ) : (
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded font-black text-[10px] border ${
                            row.condition_display === 'VACIO' || row.condition_display.startsWith('VACIO')
                              ? 'bg-rose-950/70 border-rose-500/40 text-rose-300'
                              : row.condition_display === 'LLENO'
                                ? 'bg-emerald-950/70 border-emerald-500/40 text-emerald-300'
                                : 'bg-sky-950/70 border-sky-500/40 text-sky-300'
                          }`}
                        >
                          {row.condition_display}
                        </span>
                      )}
                    </td>

                    {/* 7. Impacto Patio */}
                    <td className="py-1.5 px-2 whitespace-nowrap font-semibold">
                      <span
                        className={
                          row.operation_type === 'DEVOLUCION_PROVEEDOR'
                            ? 'text-rose-300'
                            : ['SALDO_INICIAL_PATIO', 'INGRESO_PROVEEDOR', 'DEVOLUCION_FINAL'].includes(
                                  row.operation_type
                                )
                              ? 'text-emerald-300'
                              : 'text-amber-300'
                        }
                      >
                        {row.patio_impact}
                      </span>
                    </td>

                    {/* 8. Cantidad */}
                    <td
                      {...qtyProps.domProps}
                      onDoubleClick={() =>
                        setInlineEdit({ id: row.id, field: 'quantity', value: String(row.quantity || 1) })
                      }
                      className={`py-1.5 px-2 text-right font-mono font-black text-white cursor-pointer whitespace-nowrap ${qtyProps.className}`}
                      title="Doble clic para editar cantidad de tubos"
                    >
                      {inlineEdit.id === row.id && inlineEdit.field === 'quantity' ? (
                        <input
                          type="number"
                          autoFocus
                          min="1"
                          value={inlineEdit.value}
                          onChange={(e) => setInlineEdit((prev) => ({ ...prev, value: e.target.value }))}
                          onBlur={() => commitInlineEdit()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitInlineEdit()
                            if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                          }}
                          className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-[11px] font-mono text-white w-14 text-right focus:outline-none"
                        />
                      ) : (
                        <span>{row.quantity || 1}</span>
                      )}
                    </td>

                    {/* 9. Observaciones / Responsable */}
                    <td
                      {...notesProps.domProps}
                      onDoubleClick={() =>
                        setInlineEdit({ id: row.id, field: 'notes', value: row.notes || '' })
                      }
                      className={`py-1.5 px-2 max-w-[260px] cursor-pointer ${notesProps.className}`}
                      title="Doble clic para editar observación"
                    >
                      {inlineEdit.id === row.id && inlineEdit.field === 'notes' ? (
                        <input
                          type="text"
                          autoFocus
                          value={inlineEdit.value}
                          onChange={(e) => setInlineEdit((prev) => ({ ...prev, value: e.target.value }))}
                          onBlur={() => commitInlineEdit()}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitInlineEdit()
                            if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                          }}
                          className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-[11px] text-white w-full focus:outline-none"
                        />
                      ) : (
                        <div className="truncate">
                          <span className="text-slate-300">
                            <HighlightText text={row.notes || '—'} query={searchQuery} />
                          </span>
                          {row.performed_by && (
                            <span className="block text-[9px] text-slate-500 truncate">
                              Cargó: {row.performed_by}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* 10. Acciones */}
                    <td className="py-1.5 px-2 text-center whitespace-nowrap">
                      {row.is_linked_to_panol_tx ? (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-800/80 border border-slate-700 text-slate-300 text-[9px] font-bold"
                          title="Sincronizado con Movimientos y Retiros (editar/eliminar desde esa pestaña)"
                        >
                          <Link2 className="w-2.5 h-2.5 text-cyan-400" />
                          <span>Vínculo Pañol</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row)}
                          className="p-1 rounded bg-slate-900 hover:bg-rose-950 border border-slate-700 hover:border-rose-500 text-slate-400 hover:text-rose-300 cursor-pointer transition-colors"
                          title="Eliminar movimiento de trazabilidad (registrado en auditoría)"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Barra Inferior Canónica */}
      <GridStatusBarBottom
        isFixed={false}
        filteredCount={filteredRows.length}
        totalCount={allRows.length}
        entityName="movimientos de gas"
        hasActiveFilter={hasActiveLocalFilter}
        onClearFilters={clearTraceFilters}
        selectionStats={grid.selectionStats}
        onClearSelection={() => grid.setSelectionRange(null)}
        customSelection={
          grid.selectedRowIds.size > 0
            ? {
                count: grid.selectedRowIds.size,
                label: 'movimientos seleccionados',
                onClear: grid.clearSelectedRows
              }
            : null
        }
        globalAggregates={[
          { label: '📥 Ing./Saldo Gasera', value: `+${totalsSummary.supplierIn}`, highlight: true },
          { label: '📤 Dev. a Gasera', value: `-${totalsSummary.supplierOut}` },
          { label: '🔄 Mov. Contratistas', value: `${totalsSummary.contractorMoves}` }
        ]}
      />

      {menuTarget && (
        <GridContextMenu
          target={menuTarget}
          onClose={closeMenu}
          onCopyCell={() => grid.copyActiveCell()}
          onCopyRow={() => grid.copyRow(menuTarget.row)}
          onDeleteRow={
            !menuTarget.row?.is_linked_to_panol_tx
              ? () => handleDeleteRow(menuTarget.row)
              : undefined
          }
          entityType="gas_cylinders"
          recordId={menuTarget.recordId}
          recordLabel={menuTarget.recordLabel}
        />
      )}
    </div>
  )
}
