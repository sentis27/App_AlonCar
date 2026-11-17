import React from 'react'
import { Undo2, Redo2, Layers, ClipboardList, X } from 'lucide-react'
import CrawlerSearchBar from '../CrawlerSearchBar'
import { CLEAR_FILTER_BTN_CLASS, getFilterSelectClass } from '../../lib/filterThemeConstants'

/**
 * ShipsBarcosToolbar.jsx
 * Zona 3 (Toolbar Corporativa) de la pestaña Buques en Flota Naval.
 */
export default function ShipsBarcosToolbar({
  searchInputRef,
  searchTerm,
  setSearchTerm,
  locationFilter,
  setLocationFilter,
  requestFilter,
  setRequestFilter,
  ownerFilter,
  setOwnerFilter,
  owners = [],
  activeRolePerspective,
  roleQuickFilter,
  setRoleQuickFilter,
  hasActiveFilter,
  clearAllFilters,
  shipsGrid,
  viewModeShips,
  setViewModeShips,
  viewsController
}) {
  return (
    <div className="alon-zone-toolbar p-3 rounded-2xl shadow-lg flex flex-col gap-2.5">
      <CrawlerSearchBar
        inputRef={searchInputRef}
        value={searchTerm}
        onChange={setSearchTerm}
        viewsController={viewsController}
        placeholder="Buscar por nombre de buque, matrícula, tipo, locación o empresa armadora... (Ctrl+F | Esc limpia todo)"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* 1. Locaciones (Azul Cielo) */}
          <select
            value={locationFilter}
            onChange={(e) => setLocationFilter(e.target.value)}
            className={getFilterSelectClass('location', locationFilter !== 'todos')}
            title="Filtrar por Locación"
          >
            <option value="todos" className="bg-slate-900">Todas las Locaciones</option>
            <option value="VARADERO" className="bg-slate-900">Varadero</option>
            <option value="MUELLE" className="bg-slate-900">Muelle</option>
            <option value="PUERTO" className="bg-slate-900">Puertos Aldana</option>
          </select>

          {/* 2. Estados (Rosa) */}
          <select
            value={requestFilter}
            onChange={(e) => setRequestFilter(e.target.value)}
            className={getFilterSelectClass('status', requestFilter !== 'todos')}
            title="Filtrar por Estado"
          >
            <option value="todos" className="bg-slate-900">Todos los Estados</option>
            <option value="pendientes" className="bg-slate-900">⚠️ Con Solicitud Activa</option>
            <option value="completos" className="bg-slate-900">✅ Datos Completos</option>
          </select>

          {/* 3. Armador y Empresa (Púrpura) */}
          <select
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className={getFilterSelectClass('owner', ownerFilter !== 'todos', 'max-w-[220px]')}
            title="Filtrar por Armador o Empresa"
          >
            <option value="todos" className="bg-slate-900">Armador / Empresa: Todos</option>
            <option value="SIN_ASIGNAR" className="bg-slate-900">⚠️ Sin Armador Asignado</option>
            {[...owners].sort((a, b) => (a.name || '').localeCompare(b.name || '')).map((o) => (
              <option key={o.id} value={o.id} className="bg-slate-900">
                {o.name}{o.armador_name && o.armador_name !== o.name ? ` (${o.armador_name})` : ''}
              </option>
            ))}
          </select>

          {(activeRolePerspective !== 'admin' || roleQuickFilter !== 'todos') && (
            <select
              value={roleQuickFilter}
              onChange={(e) => setRoleQuickFilter(e.target.value)}
              className={getFilterSelectClass('contractor', roleQuickFilter !== 'todos')}
            >
              <option value="todos" className="bg-slate-900">Todos los Buques</option>
              {activeRolePerspective !== 'admin' && <option value="mis_tareas" className="bg-slate-900">⚡ Mis Tareas Pendientes</option>}
              <option value="sin_ot" className="bg-slate-900">⚠️ Costos sin OT</option>
            </select>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {hasActiveFilter && (
            <button
              type="button"
              onClick={clearAllFilters}
              className={CLEAR_FILTER_BTN_CLASS}
              title="Limpiar filtros"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar filtro</span>
            </button>
          )}
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

          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-1 rounded-xl text-xs">
            <button
              type="button"
              onClick={() => setViewModeShips('tabla')}
              className={`px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-all ${
                viewModeShips === 'tabla' ? 'bg-primary text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
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
                viewModeShips === 'tarjetas' ? 'bg-primary text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
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
  )
}
