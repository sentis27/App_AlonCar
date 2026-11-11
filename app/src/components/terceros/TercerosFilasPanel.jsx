/**
 * TercerosFilasPanel.jsx
 * Zona 4: Planilla Operativa Industrial sobre useSpreadsheetGrid (M5 / DEC-017).
 */

import React from 'react'
import HighlightText from '../HighlightText'
import GridRibbon from '../GridRibbon'
import GridContextMenu from '../GridContextMenu'
import GridStatusBarBottom from '../GridStatusBarBottom'
import {
  Ship,
  Square,
  CheckSquare,
  Sparkles,
  History,
  CopyPlus,
  Edit3,
  Trash2,
  RotateCcw,
  RotateCw
} from 'lucide-react'
import { VOUCHER_TYPES, OFFICIAL_TRADES, formatDate } from '../../lib/tercerosConstants.js'

export default function TercerosFilasPanel({
  filteredServices = [],
  services = [],
  contractors = [],
  shipMap = new Map(),
  otMap = new Map(),
  contractorMap = new Map(),
  searchTerm = '',
  canEditAmounts = false,
  canMutateRows = true,
  activeRolePerspective = 'maria_jose',
  grid,
  spreadsheetColumns = [],
  menuTarget,
  openMenu,
  closeMenu,
  selectedIds = new Set(),
  handleSelectAll,
  handleCheckboxToggle,
  handleClearSelection,
  inlineEdit,
  setInlineEdit,
  saveInlineEdit,
  handleInsertBlankRow,
  handleDuplicateService,
  handleDeleteService,
  handleOpenEvolutionModal,
  handleOpenEditModal,
  setHistoryService,
  setPickerModal,
  setContractorPickerModal,
  stats,
  hasActiveFilters,
  clearAllFilters
}) {
  // Helper de propiedades para cada celda
  function getSpreadsheetCellProps(rowIndex, colKey) {
    const colIdx = spreadsheetColumns.findIndex((c) => c.key === colKey)
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
          ? 'ring-2 ring-cyan-400 bg-cyan-950/40 z-20 outline-none'
          : isFillPreview
          ? 'bg-cyan-900/40 border-y border-dashed border-cyan-400'
          : isSelected
          ? 'bg-cyan-900/30'
          : ''
      }`
    }
  }

  return (
    <div className="alon-zone-grid flex flex-col">
      {/* Ribbon Canónico con Exportación integrada */}
      <GridRibbon
        activeCellBadge={grid.activeCellBadge}
        onInsertRow={activeRolePerspective !== 'direccion' ? handleInsertBlankRow : null}
        insertRowLabel="+ Fila en Blanco"
        undoCount={grid.undoStack?.length || 0}
        totalRows={filteredServices.length}
        entityName="comprobantes"
        exportRows={filteredServices}
        exportFilename={`terceros_${new Date().toISOString().split('T')[0]}`}
      />

      <datalist id="terceros-contractors-datalist">
        {contractors.map((c) => (
          <option key={c.id} value={c.name}>
            {c.trade || ''}
          </option>
        ))}
      </datalist>

      {/* Contenedor scrolleable vertical con encabezado congelado y teclado conectado */}
      <div
        tabIndex={0}
        onKeyDown={grid.handleKeyDown}
        ref={grid.gridContainerRef}
        className="alon-grid-scroll"
      >
        <table className="w-full text-left text-xs border-collapse table-fixed">
          <thead className="sticky top-0 z-20 alon-grid-thead backdrop-blur-md">
            <tr>
              {/* Columna 0: Checkbox Maestro apilado sobre # */}
              <th className="py-2 px-1 w-9 text-center select-none">
                <div className="flex flex-col items-center justify-center gap-0.5">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="text-slate-400 hover:text-cyan-400 transition-colors cursor-pointer"
                    title="Seleccionar o deseleccionar todas las filas visibles"
                  >
                    {filteredServices.length > 0 && selectedIds.size === filteredServices.length ? (
                      <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <span className="font-mono text-[9px] text-slate-500 font-bold">#</span>
                </div>
              </th>
              {/* 1. Fecha */}
              <th className="py-2.5 px-2 w-[8%]">Fecha ✎</th>
              {/* 2. Barco / OT */}
              <th className="py-2.5 px-2 w-[14%]">Barco / OT ✎</th>
              {/* 3. Contratista / Rubro */}
              <th className="py-2.5 px-2 w-[15%]">Contratista / Rubro ✎</th>
              {/* 4. Importe AR$ */}
              <th className="py-2.5 px-2 w-[11%] text-right">Importe AR$ ✎</th>
              {/* 5. Dólar / US$ */}
              <th className="py-2.5 px-2 w-[10%] text-right">Dólar / US$ ✎</th>
              {/* 6. Comprobante */}
              <th className="py-2.5 px-2 w-[7%] text-center">Comprobante ✎</th>
              {/* 7. Nº Comprobante */}
              <th className="py-2.5 px-2 w-[12%]">Nº Comprobante ✎</th>
              {/* 8. Comentarios */}
              <th className="py-2.5 px-2 w-[13%]">Comentarios ✎</th>
              {/* 9. Acciones */}
              <th className="py-2.5 px-2 w-[10%] text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {filteredServices.map((srv, index) => {
              const isSelected = selectedIds.has(srv.id)
              const shipName = shipMap.get(srv.ship_id)?.name || 'Sin Buque'
              const ot = otMap.get(srv.work_order_id)
              const voucherConfig = VOUCHER_TYPES.find((v) => v.code === srv.voucher_type) || VOUCHER_TYPES[0]
              const isEvolvable = srv.voucher_type === 'RMO' || srv.voucher_type === 'RPF'
              const contractorObj = contractorMap.get(srv.contractor_name?.toUpperCase()?.trim())
              const effectiveTrade = srv.trade || (contractorObj?.trade && contractorObj.trade !== 'MANUAL' ? contractorObj.trade : null)

              const fcrNumber = srv.invoice_number || (['FCR', 'FCA', 'FAC', 'REC', 'FCB', 'FCC'].includes(srv.voucher_type) ? srv.voucher_number : null)
              const prcNumber = srv.budget_number || (srv.voucher_type === 'PRC' ? srv.voucher_number : null)
              const remitoAloncar = srv.internal_remito_number || null
              const supplierRemito = srv.supplier_remito_number || (['RMO', 'RPF'].includes(srv.voucher_type) ? srv.voucher_number : null)
              const hasAnyVoucherNumber = Boolean(fcrNumber || prcNumber || remitoAloncar || supplierRemito)

              return (
                <tr
                  key={srv.id}
                  onContextMenu={(e) => openMenu(e, srv, index, { entityType: 'third_party_services', recordId: srv.id, recordLabel: srv.contractor_name }, grid)}
                  className={`transition-colors select-none ${
                    isSelected
                      ? 'bg-cyan-950/40 text-cyan-50 border-l-2 border-l-cyan-400'
                      : 'hover:bg-slate-850/40 text-slate-200'
                  }`}
                >
                  {/* 0. Columna 0 Canónica ([ ] / #) */}
                  <td className="py-1 px-1 text-center w-9 select-none relative">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => handleCheckboxToggle(srv.id, index, e)}
                        className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                        title="Seleccionar comprobante"
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
                          openMenu(e, srv, index, { entityType: 'third_party_services', recordId: srv.id, recordLabel: srv.contractor_name }, grid)
                        }}
                        className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded transition-all cursor-pointer hover:bg-cyan-950/90 hover:text-cyan-300 hover:ring-1 hover:ring-cyan-500/60 ${
                          isSelected ? 'text-cyan-300 bg-cyan-950/50 ring-1 ring-cyan-500/40' : 'text-slate-500 group-hover:text-cyan-400'
                        }`}
                        title={`Fila #${srv._rowSeq || index + 1} (DNI Inviolable) • Clic para menú contextual (o clic derecho)`}
                      >
                        {srv._rowSeq || index + 1}
                      </button>
                    </div>
                  </td>

                  {/* 1. Fecha */}
                  {(() => {
                    const cp = getSpreadsheetCellProps(index, 'service_date')
                    return (
                      <td
                        {...cp.domProps}
                        onDoubleClick={() => setInlineEdit({ id: srv.id, field: 'service_date', value: srv.service_date || srv.entry_date || '' })}
                        className={`py-2.5 px-2 whitespace-nowrap ${cp.className}`}
                      >
                        {inlineEdit.id === srv.id && inlineEdit.field === 'service_date' ? (
                          <input
                            type="date"
                            autoFocus
                            value={inlineEdit.value}
                            onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveInlineEdit(srv.id, 'service_date', inlineEdit.value)
                              if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                            }}
                            onBlur={() => saveInlineEdit(srv.id, 'service_date', inlineEdit.value)}
                            className="w-full bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white outline-none font-mono"
                          />
                        ) : (
                          <div>
                            <div className="font-semibold text-slate-200">
                              {formatDate(srv.service_date || srv.entry_date)}
                            </div>
                            {srv.entry_date && srv.entry_date !== srv.service_date && (
                              <div className="text-[10px] text-slate-500 font-sans">
                                Carga: {formatDate(srv.entry_date)}
                              </div>
                            )}
                          </div>
                        )}
                        {cp.renderHandle && (
                          <div
                            onMouseDown={grid.handleFillHandleMouseDown}
                            onDoubleClick={grid.handleFillHandleDoubleClick}
                            className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                            title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                          />
                        )}
                      </td>
                    )
                  })()}

                  {/* 2. Barco / OT */}
                  {(() => {
                    const cp = getSpreadsheetCellProps(index, 'ship_wo')
                    return (
                      <td
                        {...cp.domProps}
                        onDoubleClick={() => {
                          setPickerModal({
                            isOpen: true,
                            serviceId: srv.id,
                            shipId: srv.ship_id,
                            workOrderId: srv.work_order_id,
                            contractorName: srv.contractor_name
                          })
                        }}
                        className={`py-2.5 px-2 font-sans truncate cursor-pointer ${cp.className}`}
                        title="Doble clic para cambiar Buque u Orden de Trabajo"
                      >
                        <div className="font-bold text-white flex items-center gap-1.5 truncate" title={shipName}>
                          <Ship className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                          <span className="truncate">
                            <HighlightText text={shipName} query={searchTerm} />
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                          {ot ? (
                            <span className="font-mono text-cyan-300 font-semibold bg-cyan-950/60 px-1 rounded border border-cyan-800/50 shrink-0">
                              <HighlightText text={ot.ot_number} query={searchTerm} />
                            </span>
                          ) : (
                            <span className="text-amber-400 text-[10px] shrink-0 font-bold">⚠️ Sin OT</span>
                          )}
                          <span className="truncate text-[10px] text-slate-500" title={ot?.title}>
                            <HighlightText text={ot?.title || '(Doble clic para asignar)'} query={searchTerm} />
                          </span>
                        </div>
                        {cp.renderHandle && (
                          <div
                            onMouseDown={grid.handleFillHandleMouseDown}
                            onDoubleClick={grid.handleFillHandleDoubleClick}
                            className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                            title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                          />
                        )}
                      </td>
                    )
                  })()}

                  {/* 3. Contratista y Rubro */}
                  {(() => {
                    const cp = getSpreadsheetCellProps(index, 'contractor_name')
                    return (
                      <td
                        {...cp.domProps}
                        onDoubleClick={() => {
                          const effShip = shipMap.get(srv.ship_id)
                          const effWo = otMap.get(srv.work_order_id)
                          setContractorPickerModal({
                            isOpen: true,
                            serviceId: srv.id,
                            currentValue: srv.contractor_name || '',
                            shipId: srv.ship_id || '',
                            shipName: effShip?.name || 'Astillero General',
                            workOrderId: srv.work_order_id || '',
                            workOrderTitle: effWo ? `${effWo.ot_number} - ${effWo.title}` : '',
                            isOtBlank: !srv.work_order_id
                          })
                        }}
                        className={`py-2.5 px-2 font-sans truncate cursor-pointer ${cp.className}`}
                        title="Doble clic para abrir menú de Contratistas (o doble clic en el rubro para cambiar Rubro)"
                      >
                        {inlineEdit.id === srv.id && inlineEdit.field === 'contractor_name' ? (
                          <input
                            type="text"
                            list="terceros-contractors-datalist"
                            autoFocus
                            value={inlineEdit.value}
                            onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && inlineEdit.value.trim()) saveInlineEdit(srv.id, 'contractor_name', inlineEdit.value)
                              if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                            }}
                            onBlur={() => {
                              if (inlineEdit.value.trim()) saveInlineEdit(srv.id, 'contractor_name', inlineEdit.value)
                              else setInlineEdit({ id: null, field: null, value: '' })
                            }}
                            className="w-full bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white outline-none font-bold uppercase"
                          />
                        ) : inlineEdit.id === srv.id && inlineEdit.field === 'trade' ? (
                          <select
                            autoFocus
                            value={inlineEdit.value}
                            onChange={(e) => saveInlineEdit(srv.id, 'trade', e.target.value)}
                            onBlur={() => setInlineEdit({ id: null, field: null, value: '' })}
                            onKeyDown={(e) => {
                              if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                            }}
                            className="w-full bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-[11px] text-white outline-none font-bold"
                          >
                            <option value="">-- Elegir Rubro --</option>
                            {OFFICIAL_TRADES.map((t) => (
                              <option key={t} value={t}>{t}</option>
                            ))}
                          </select>
                        ) : (
                          <div>
                            <div className="font-bold text-slate-100 uppercase tracking-wide truncate" title={srv.contractor_name}>
                              <HighlightText text={srv.contractor_name} query={searchTerm} />
                            </div>
                            <div
                              className="mt-0.5 truncate"
                              onDoubleClick={(e) => {
                                e.stopPropagation()
                                setInlineEdit({ id: srv.id, field: 'trade', value: effectiveTrade || '' })
                              }}
                              title="Doble clic aquí para cambiar el Rubro"
                            >
                              {effectiveTrade ? (
                                <span className="inline-block text-[10px] px-1.5 py-0.2 rounded bg-slate-800 hover:border-cyan-500/50 text-slate-300 border border-slate-700 font-medium font-mono truncate max-w-full">
                                  <HighlightText text={effectiveTrade} query={searchTerm} />
                                </span>
                              ) : (
                                <span className="text-[10px] text-rose-400 font-semibold">⚠️ Sin Rubro (Doble clic)</span>
                              )}
                            </div>
                          </div>
                        )}
                        {cp.renderHandle && (
                          <div
                            onMouseDown={grid.handleFillHandleMouseDown}
                            onDoubleClick={grid.handleFillHandleDoubleClick}
                            className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                            title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                          />
                        )}
                      </td>
                    )
                  })()}

                  {/* 4. Importe AR$ */}
                  {(() => {
                    const cp = getSpreadsheetCellProps(index, 'amount_ars')
                    return (
                      <td
                        {...cp.domProps}
                        onDoubleClick={() => {
                          if (canEditAmounts) {
                            setInlineEdit({ id: srv.id, field: 'amount_ars', value: srv.amount_ars || '' })
                          }
                        }}
                        className={`py-2.5 px-2 text-right whitespace-nowrap font-mono font-semibold text-slate-100 ${cp.className}`}
                      >
                        {inlineEdit.id === srv.id && inlineEdit.field === 'amount_ars' ? (
                          <input
                            type="number"
                            autoFocus
                            step="any"
                            value={inlineEdit.value}
                            onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveInlineEdit(srv.id, 'amount_ars', inlineEdit.value)
                              if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                            }}
                            onBlur={() => saveInlineEdit(srv.id, 'amount_ars', inlineEdit.value)}
                            className="w-full bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-right text-white outline-none font-mono"
                          />
                        ) : (
                          Number(srv.amount_ars) > 0 ? (
                            <span>$<HighlightText text={Number(srv.amount_ars).toLocaleString('es-AR')} query={searchTerm} /></span>
                          ) : (
                            <span className="text-amber-400 text-xs font-bold">$0 (Sin Precio)</span>
                          )
                        )}
                        {cp.renderHandle && (
                          <div
                            onMouseDown={grid.handleFillHandleMouseDown}
                            onDoubleClick={grid.handleFillHandleDoubleClick}
                            className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                            title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                          />
                        )}
                      </td>
                    )
                  })()}

                  {/* 5. Dólar / US$ */}
                  <td className="py-2.5 px-2 text-right whitespace-nowrap">
                    <div className="font-mono font-extrabold text-cyan-300">
                      $<HighlightText text={Number(srv.amount_usd || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} query={searchTerm} />
                    </div>
                    <div className="text-[10px] text-slate-500 font-mono">
                      Cotiz: $<HighlightText text={Number(srv.usd_rate || 0).toLocaleString('es-AR')} query={searchTerm} />
                    </div>
                  </td>

                  {/* 6. Comprobante (Tipo) */}
                  {(() => {
                    const cp = getSpreadsheetCellProps(index, 'voucher_type')
                    return (
                      <td
                        {...cp.domProps}
                        onDoubleClick={() => setInlineEdit({ id: srv.id, field: 'voucher_type', value: srv.voucher_type || 'PRC' })}
                        className={`py-2.5 px-2 whitespace-nowrap text-center ${cp.className}`}
                      >
                        {inlineEdit.id === srv.id && inlineEdit.field === 'voucher_type' ? (
                          <select
                            autoFocus
                            value={inlineEdit.value}
                            onChange={(e) => saveInlineEdit(srv.id, 'voucher_type', e.target.value)}
                            onBlur={() => setInlineEdit({ id: null, field: null, value: '' })}
                            className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-xs text-white outline-none font-bold"
                          >
                            {VOUCHER_TYPES.map((v) => (
                              <option key={v.code} value={v.code}>{v.code}</option>
                            ))}
                          </select>
                        ) : (
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${voucherConfig.color}`}>
                            <HighlightText text={srv.voucher_type} query={searchTerm} />
                          </span>
                        )}
                        {cp.renderHandle && (
                          <div
                            onMouseDown={grid.handleFillHandleMouseDown}
                            onDoubleClick={grid.handleFillHandleDoubleClick}
                            className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                            title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                          />
                        )}
                      </td>
                    )
                  })()}

                  {/* 7. Nº Comprobante */}
                  {(() => {
                    const cp = getSpreadsheetCellProps(index, 'voucher_number')
                    return (
                      <td
                        {...cp.domProps}
                        onDoubleClick={() => setInlineEdit({ id: srv.id, field: 'voucher_number', value: srv.voucher_number || '' })}
                        className={`py-2.5 px-2 font-mono ${cp.className}`}
                      >
                        {inlineEdit.id === srv.id && inlineEdit.field === 'voucher_number' ? (
                          <input
                            type="text"
                            autoFocus
                            value={inlineEdit.value}
                            onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveInlineEdit(srv.id, 'voucher_number', inlineEdit.value)
                              if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                            }}
                            onBlur={() => saveInlineEdit(srv.id, 'voucher_number', inlineEdit.value)}
                            className="w-full bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white outline-none font-mono"
                          />
                        ) : (
                          <div className="space-y-0.5">
                            {fcrNumber && (
                              <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-300 truncate" title={`Factura: ${fcrNumber}`}>
                                <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0 font-sans">
                                  FCR
                                </span>
                                <span className="truncate">
                                  <HighlightText text={fcrNumber} query={searchTerm} />
                                </span>
                              </div>
                            )}
                            {prcNumber && (
                              <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300 truncate" title={`Presupuesto: ${prcNumber}`}>
                                <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950 text-amber-400 border border-amber-800 shrink-0 font-sans">
                                  PRC
                                </span>
                                <span className="truncate">
                                  <HighlightText text={prcNumber} query={searchTerm} />
                                </span>
                              </div>
                            )}
                            {remitoAloncar && (
                              <div className="flex items-center gap-1 text-[10px] text-cyan-300 truncate" title={`Remito: #${remitoAloncar}`}>
                                <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 shrink-0 font-sans">
                                  RMT
                                </span>
                                <span className="truncate">
                                  #<HighlightText text={remitoAloncar} query={searchTerm} />
                                </span>
                              </div>
                            )}
                            {supplierRemito && (
                              <div className="flex items-center gap-1 text-[10px] text-purple-300 truncate" title={`Remito Taller: ${supplierRemito}`}>
                                <span className="text-[9px] px-1 py-0.2 rounded bg-purple-950 text-purple-400 border border-purple-800 shrink-0 font-sans">
                                  RMO
                                </span>
                                <span className="truncate">
                                  <HighlightText text={supplierRemito} query={searchTerm} />
                                </span>
                              </div>
                            )}
                            {!hasAnyVoucherNumber && (
                              <span className="text-slate-600 text-[11px] italic font-sans">S/N</span>
                            )}
                          </div>
                        )}
                        {cp.renderHandle && (
                          <div
                            onMouseDown={grid.handleFillHandleMouseDown}
                            onDoubleClick={grid.handleFillHandleDoubleClick}
                            className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                            title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                          />
                        )}
                      </td>
                    )
                  })()}

                  {/* 8. Comentarios */}
                  {(() => {
                    const cp = getSpreadsheetCellProps(index, 'direct_observations')
                    return (
                      <td
                        {...cp.domProps}
                        onDoubleClick={() => setInlineEdit({ id: srv.id, field: 'direct_observations', value: srv.direct_observations || '' })}
                        className={`py-2.5 px-2 font-sans overflow-hidden ${cp.className}`}
                      >
                        {inlineEdit.id === srv.id && inlineEdit.field === 'direct_observations' ? (
                          <input
                            type="text"
                            autoFocus
                            value={inlineEdit.value}
                            onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveInlineEdit(srv.id, 'direct_observations', inlineEdit.value)
                              if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                            }}
                            onBlur={() => saveInlineEdit(srv.id, 'direct_observations', inlineEdit.value)}
                            className="w-full bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white outline-none font-sans"
                          />
                        ) : (
                          <div className="space-y-0.5 truncate max-w-full">
                            {srv.direct_observations ? (
                              <p className="text-[11px] text-slate-300 line-clamp-2" title={srv.direct_observations}>
                                <HighlightText text={srv.direct_observations} query={searchTerm} />
                              </p>
                            ) : (
                              <span className="text-slate-600 text-[11px] italic">Sin observaciones</span>
                            )}
                            {srv.specific_observations && (
                              <p className="text-[10px] text-slate-400 line-clamp-1 italic truncate" title={srv.specific_observations}>
                                Nota: <HighlightText text={srv.specific_observations} query={searchTerm} />
                              </p>
                            )}
                          </div>
                        )}
                        {cp.renderHandle && (
                          <div
                            onMouseDown={grid.handleFillHandleMouseDown}
                            onDoubleClick={grid.handleFillHandleDoubleClick}
                            className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                            title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                          />
                        )}
                      </td>
                    )
                  })()}

                  {/* 9. Acciones */}
                  <td className="py-2.5 px-2 text-right font-sans">
                    <div className="flex items-center justify-end gap-1 shrink-0">
                      {isEvolvable && activeRolePerspective !== 'direccion' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEvolutionModal(srv)
                          }}
                          className="p-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-400 hover:text-slate-950 rounded-lg transition-all cursor-pointer shrink-0 shadow-sm"
                          title="Evolucionar a Factura oficial (FCR) o SDT"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setHistoryService(srv)
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
                        title="Ver trazabilidad e historial"
                      >
                        <History className="w-4 h-4" />
                      </button>

                      {canMutateRows && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDuplicateService(srv)
                          }}
                          className="p-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Duplicar fila"
                        >
                          <CopyPlus className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {activeRolePerspective !== 'direccion' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEditModal(srv)
                          }}
                          className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Editar comprobante"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                      )}

                      {canEditAmounts && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteService(srv)
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                          title="Eliminar comprobante con auditoría"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* MENÚ CONTEXTUAL CANÓNICO (clic derecho) */}
      {menuTarget && (
        <GridContextMenu
          target={menuTarget}
          onClose={closeMenu}
          onCopyCell={grid.copyActiveCell}
          onCopyRow={grid.copyRow}
          onPaste={canMutateRows ? grid.pasteToActiveOrRange : undefined}
          onDeleteCell={canMutateRows ? grid.deleteActiveCellOrRange : undefined}
          onDuplicateRow={canMutateRows ? (row) => handleDuplicateService(row) : undefined}
          onDeleteRow={canEditAmounts ? (row) => handleDeleteService(row) : undefined}
          customActions={[
            ...(menuTarget.row?.voucher_type === 'RMO' || menuTarget.row?.voucher_type === 'RPF' ? [{
              id: 'evolve-voucher',
              label: '⭐ Evolucionar a Factura (FCR) o SDT',
              icon: Sparkles,
              iconClass: 'text-amber-400',
              hoverClass: 'hover:bg-amber-950/50 text-amber-300 hover:text-amber-200',
              visible: activeRolePerspective !== 'direccion',
              onClick: () => handleOpenEvolutionModal(menuTarget.row)
            }] : []),
            {
              id: 'voucher-evolution-history',
              label: '📜 Trazabilidad de comprobante',
              icon: History,
              iconClass: 'text-cyan-400',
              hoverClass: 'hover:bg-slate-800 text-slate-300 hover:text-cyan-300',
              visible: true,
              onClick: () => setHistoryService(menuTarget.row)
            },
            {
              id: 'edit-voucher',
              label: '✏️ Editar comprobante',
              icon: Edit3,
              iconClass: 'text-slate-300',
              hoverClass: 'hover:bg-slate-800 text-slate-300 hover:text-white',
              visible: activeRolePerspective !== 'direccion',
              onClick: () => handleOpenEditModal(menuTarget.row)
            }
          ]}
          entityType={menuTarget.entityType}
          recordId={menuTarget.recordId}
          recordLabel={menuTarget.recordLabel}
        />
      )}

      {/* BARRA INFERIOR FLOTANTE ESTANDARIZADA */}
      <GridStatusBarBottom
        filteredCount={filteredServices.length}
        totalCount={services.length}
        entityName="comprobantes"
        hasActiveFilter={hasActiveFilters}
        onClearFilters={clearAllFilters}
        selectionStats={grid.selectionStats}
        onClearSelection={() => grid.setSelectionRange(null)}
        customSelection={selectedIds.size > 0 ? {
          count: selectedIds.size,
          label: 'comprobantes tildados',
          onClear: handleClearSelection
        } : null}
        globalAggregates={[
          { label: 'Σ AR$', value: `$${stats.sumArs.toLocaleString('es-AR')}`, highlight: true },
          { label: 'Σ US$', value: `$${stats.sumUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
          { label: 'Ø AR$', value: `$${stats.avgArs.toLocaleString('es-AR', { maximumFractionDigits: 0 })}` },
          { label: 'Cotiz. Ø', value: `$${stats.avgRate.toLocaleString('es-AR', { maximumFractionDigits: 1 })}` }
        ]}
        extraActions={(grid?.canUndo || grid?.canRedo) ? (
          <div className="flex items-center gap-1.5">
            {grid?.canUndo && (
              <button
                type="button"
                onClick={grid.undo}
                className="px-2 py-0.5 rounded bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-amber-300 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                title="Deshacer el último cambio (Ctrl + Z)"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Deshacer (Ctrl+Z)</span>
              </button>
            )}
            {grid?.canRedo && (
              <button
                type="button"
                onClick={grid.redo}
                className="px-2 py-0.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-300 font-bold text-[11px] flex items-center gap-1 transition-all cursor-pointer"
                title="Rehacer el cambio deshecho (Ctrl + Y)"
              >
                <RotateCw className="w-3 h-3" />
                <span>Rehacer (Ctrl+Y)</span>
              </button>
            )}
          </div>
        ) : null}
      />
    </div>
  )
}
