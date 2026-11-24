/**
 * TercerosToolbar.jsx
 * Zona 3: Buscador Omnicanal CrawlerSearchBar, Filtros en Cascada, Deshacer/Rehacer y Alternador de Vistas (M5).
 */

import React from 'react'
import CanonicalZone3Toolbar from '../canonical/CanonicalZone3Toolbar'
import { OFFICIAL_TRADES, VOUCHER_TYPES } from '../../lib/tercerosConstants.js'
import {
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
  setViewMode,
  viewsController
}) {
  const otOptions = resolveOtFilterOptions(workOrders, workItems, selectedShipFilter)

  return (
    <CanonicalZone3Toolbar
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchInputRef={searchInputRef}
      searchPlaceholder="Buscar por contratista, N° factura, barco, OT, rubro, remito o detalle... (Ctrl+F | Esc limpia todo)"
      viewsController={viewsController}
      hasActiveFilters={hasActiveFilters}
      onClearAllFilters={clearAllFilters}
      history={grid}
      viewModeToggle={{
        value: viewMode,
        onChange: setViewMode,
        rowsValue: 'filas',
        cardsValue: 'fichas'
      }}
      filters={
        <>
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
        </>
      }
    />
  )
}
