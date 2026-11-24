import React from 'react'
import CanonicalZone3Toolbar from '../canonical/CanonicalZone3Toolbar'
import { getFilterSelectClass } from '../../lib/filterThemeConstants'

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
    <CanonicalZone3Toolbar
      className="rounded-2xl"
      searchInputRef={searchInputRef}
      searchValue={searchTerm}
      onSearchChange={setSearchTerm}
      searchPlaceholder="Buscar por nombre de buque, matrícula, tipo, locación o empresa armadora... (Ctrl+F | Esc limpia todo)"
      viewsController={viewsController}
      hasActiveFilters={hasActiveFilter}
      onClearAllFilters={clearAllFilters}
      history={shipsGrid}
      viewModeToggle={{
        value: viewModeShips,
        onChange: setViewModeShips,
        rowsValue: 'tabla',
        cardsValue: 'tarjetas'
      }}
      filters={
        <>
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
        </>
      }
    />
  )
}
