/**
 * TercerosToolbar.jsx
 * Zona 3: Buscador Omnicanal CrawlerSearchBar, Filtros en Cascada, Deshacer/Rehacer y Alternador de Vistas (M5).
 */

import React from 'react'
import CrawlerSearchBar from '../CrawlerSearchBar'
import { X, RotateCcw, RotateCw } from 'lucide-react'
import { OFFICIAL_TRADES, VOUCHER_TYPES } from '../../lib/tercerosConstants.js'
import {
  CLEAR_FILTER_BTN_CLASS,
  getFilterSelectClass,
  resolveOtFilterOptions
} from '../../lib/filterThemeConstants.js'

export default function TercerosToolbar({
  searchTerm,
  setSearchTerm,
  searchInputRef,
  selectedShipFilter,
  setSelectedShipFilter,
  selectedOtFilter = 'todas',
  setSelectedOtFilter,
  selectedContractorFilter,
  setSelectedContractorFilter,
  selectedTradeFilter,
  setSelectedTradeFilter,
  selectedVoucherFilter,
  setSelectedVoucherFilter,
  ships = [],
  workOrders = [],
  workItems = [],
  contractors = [],
  hasActiveFilters,
  clearAllFilters,
  grid,
  viewMode,
  setViewMode
}) {
  const otOptions = resolveOtFilterOptions(workOrders, workItems, selectedShipFilter)

  return (
    <div className="alon-zone-toolbar p-3 space-y-2.5">
      {/* NIVEL 1: Buscador Canónico */}
      <CrawlerSearchBar
        value={searchTerm}
        onChange={setSearchTerm}
        onClear={clearAllFilters}
        inputRef={searchInputRef}
        placeholder="Buscar por contratista, N° factura, barco, OT, rubro, remito o detalle... (Ctrl+F | Esc limpia todo)"
      />

      {/* NIVEL 2: Filtros Dropdown Compactos + Limpiar + Undo/Redo + Conmutador de Vista */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 1. Buque (Cian) */}
          <select
            value={selectedShipFilter}
            onChange={(e) => {
              setSelectedShipFilter(e.target.value)
              setSelectedOtFilter?.('todas')
            }}
            className={getFilterSelectClass('ship', selectedShipFilter !== 'todos', 'max-w-[160px]')}
            title="Filtrar por Barco"
          >
            <option value="todos" className="bg-slate-900">Barco: Todos ({ships.length})</option>
            {ships.map((s) => (
              <option key={s.id} value={s.id} className="bg-slate-900">{s.name}</option>
            ))}
          </select>

          {/* 2. Orden de Trabajo (Esmeralda) */}
          {setSelectedOtFilter && (
            <select
              value={selectedOtFilter}
              onChange={(e) => setSelectedOtFilter(e.target.value)}
              className={getFilterSelectClass('ot', selectedOtFilter !== 'todas', 'max-w-[175px]')}
              title="Filtrar por Orden de Trabajo"
            >
              <option value="todas" className="bg-slate-900">OT: Todas</option>
              <option value="SIN_OT" className="bg-slate-900">⚠️ Sin OT</option>
              {otOptions.map((w) => (
                <option key={w.id} value={w.id} className="bg-slate-900">
                  {w.ot_number} • {w.title}
                </option>
              ))}
            </select>
          )}

          {/* 3. Contratista (Ámbar) */}
          <select
            value={selectedContractorFilter}
            onChange={(e) => setSelectedContractorFilter(e.target.value)}
            className={getFilterSelectClass('contractor', selectedContractorFilter !== 'todos', 'max-w-[180px] truncate')}
            title="Filtrar por Contratista"
          >
            <option value="todos" className="bg-slate-900">Contratista: Todos ({contractors.length})</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.name} className="bg-slate-900">{c.name}</option>
            ))}
          </select>

          {/* 4. Rubro (Azul Cielo) */}
          <select
            value={selectedTradeFilter}
            onChange={(e) => setSelectedTradeFilter(e.target.value)}
            className={getFilterSelectClass('trade', selectedTradeFilter !== 'todos', 'max-w-[150px]')}
            title="Filtrar por Rubro"
          >
            <option value="todos" className="bg-slate-900">Rubro: Todos</option>
            {OFFICIAL_TRADES.map((t) => (
              <option key={t} value={t} className="bg-slate-900">{t}</option>
            ))}
          </select>

          {/* 5. Comprobante (Rosa) */}
          <select
            value={selectedVoucherFilter}
            onChange={(e) => setSelectedVoucherFilter(e.target.value)}
            className={getFilterSelectClass('voucher', selectedVoucherFilter !== 'todos', 'max-w-[160px]')}
            title="Filtrar por Comprobante"
          >
            <option value="todos" className="bg-slate-900">Comprobante: Todos</option>
            {VOUCHER_TYPES.map((v) => (
              <option key={v.code} value={v.code} className="bg-slate-900">{v.label}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className={CLEAR_FILTER_BTN_CLASS}
              title="Limpiar todos los filtros (Esc)"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar filtro</span>
            </button>
          )}
          {grid?.canUndo && (
            <button
              type="button"
              onClick={grid.undo}
              className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-amber-300 font-bold text-xs shadow flex items-center gap-1 transition-all cursor-pointer"
              title="Deshacer último cambio (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Deshacer</span>
            </button>
          )}
          {grid?.canRedo && (
            <button
              type="button"
              onClick={grid.redo}
              className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-300 font-bold text-xs shadow flex items-center gap-1 transition-all cursor-pointer"
              title="Rehacer cambio (Ctrl+Y)"
            >
              <RotateCw className="w-3.5 h-3.5" />
              <span>Rehacer</span>
            </button>
          )}

          {/* Toggle de Vistas Universales (Filas / Fichas) */}
          <div className="bg-slate-950 border border-slate-800 p-1 rounded-xl flex items-center shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('filas')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'filas'
                  ? 'bg-cyan-400 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>☷ Filas</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('fichas')}
              className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                viewMode === 'fichas'
                  ? 'bg-cyan-400 text-slate-950 shadow-md font-black'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>⊞ Fichas</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
