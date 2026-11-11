/**
 * TercerosToolbar.jsx
 * Zona 3: Buscador Omnicanal CrawlerSearchBar, Filtros en Cascada, Deshacer/Rehacer y Alternador de Vistas (M5).
 */

import React from 'react'
import CrawlerSearchBar from '../CrawlerSearchBar'
import { X, RotateCcw, RotateCw } from 'lucide-react'
import { OFFICIAL_TRADES, VOUCHER_TYPES } from '../../lib/tercerosConstants.js'

export default function TercerosToolbar({
  searchTerm,
  setSearchTerm,
  searchInputRef,
  selectedShipFilter,
  setSelectedShipFilter,
  selectedContractorFilter,
  setSelectedContractorFilter,
  selectedTradeFilter,
  setSelectedTradeFilter,
  selectedVoucherFilter,
  setSelectedVoucherFilter,
  ships = [],
  contractors = [],
  hasActiveFilters,
  clearAllFilters,
  grid,
  viewMode,
  setViewMode
}) {
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

      {/* NIVEL 2: Filtros Dropdown Compactos + Undo/Redo + Conmutador de Vista */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Buque */}
          <select
            value={selectedShipFilter}
            onChange={(e) => setSelectedShipFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-400 max-w-[160px]"
          >
            <option value="todos">Buque: Todos ({ships.length})</option>
            {ships.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>

          {/* Contratista */}
          <select
            value={selectedContractorFilter}
            onChange={(e) => setSelectedContractorFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-400 max-w-[180px] truncate"
          >
            <option value="todos">Contratista: Todos ({contractors.length})</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>

          {/* Rubro */}
          <select
            value={selectedTradeFilter}
            onChange={(e) => setSelectedTradeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-400 max-w-[150px]"
          >
            <option value="todos">Rubro: Todos</option>
            {OFFICIAL_TRADES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Comprobante */}
          <select
            value={selectedVoucherFilter}
            onChange={(e) => setSelectedVoucherFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-cyan-400 max-w-[160px]"
          >
            <option value="todos">Comprobante: Todos</option>
            {VOUCHER_TYPES.map((v) => (
              <option key={v.code} value={v.code}>{v.label}</option>
            ))}
          </select>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer border border-slate-700"
              title="Limpiar todos los filtros (Esc)"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
