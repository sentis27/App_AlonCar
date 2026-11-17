import React from 'react'
import { RotateCcw, RotateCw, X } from 'lucide-react'
import CrawlerSearchBar from '../CrawlerSearchBar.jsx'
import { cleanShipName } from '../../lib/laborConstants.js'
import {
  CLEAR_FILTER_BTN_CLASS,
  getFilterSelectClass,
  resolveOtFilterOptions
} from '../../lib/filterThemeConstants.js'

export default function LaborLogsToolbar({
  ships = [],
  workOrders = [],
  workItems = [],
  filterWorker,
  setFilterWorker,
  filterDate,
  setFilterDate,
  filterShip,
  setFilterShip,
  filterOt = 'todas',
  setFilterOt,
  filterContractor = 'todos',
  setFilterContractor,
  filterRubro = 'todos',
  setFilterRubro,
  filterModality = 'todas',
  setFilterModality,
  contractorOptions = [],
  rubroOptions = [],
  hasActiveFilters = false,
  activeKpiFilter,
  onClearAllFilters,
  logSearchInputRef,
  filteredCount,
  totalCount,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  viewsController
}) {
  const hasFilters = Boolean(
    hasActiveFilters ||
    filterWorker ||
    filterDate ||
    filterShip ||
    filterOt !== 'todas' ||
    filterContractor !== 'todos' ||
    filterRubro !== 'todos' ||
    filterModality !== 'todas' ||
    (activeKpiFilter && activeKpiFilter !== 'todos')
  )
  const otOptions = resolveOtFilterOptions(workOrders, workItems, filterShip)

  return (
    <div className="alon-zone-toolbar p-3 rounded-2xl shadow-lg space-y-2.5">
      <CrawlerSearchBar
        value={filterWorker}
        onChange={setFilterWorker}
        onClear={onClearAllFilters}
        inputRef={logSearchInputRef}
        viewsController={viewsController}
        placeholder="Buscar operario, buque, OT, rubro, tarea... (Ctrl+F | Esc limpia todo)"
      />

      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          {/* Fecha (Índigo) */}
          <input
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            className={getFilterSelectClass('period', Boolean(filterDate))}
            title="Acotar planilla por fecha exacta"
          />

          {/* 1. Barco (Cian) */}
          {setFilterShip && (
            <select
              value={filterShip}
              onChange={(e) => {
                setFilterShip(e.target.value)
                setFilterOt?.('todas')
              }}
              className={getFilterSelectClass('ship', Boolean(filterShip), 'max-w-[160px]')}
              title="Filtrar por Barco"
            >
              <option value="" className="bg-slate-900">Todos los Barcos</option>
              {ships.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-900">
                  {cleanShipName(s.name)}
                </option>
              ))}
            </select>
          )}

          {/* 2. Orden de Trabajo (Esmeralda) */}
          {setFilterOt && (
            <select
              value={filterOt}
              onChange={(e) => setFilterOt(e.target.value)}
              className={getFilterSelectClass('ot', filterOt !== 'todas', 'max-w-[175px]')}
              title="Filtrar por Orden de Trabajo"
            >
              <option value="todas" className="bg-slate-900">Todas las OTs</option>
              <option value="SIN_OT" className="bg-slate-900">⚠️ Sin OT</option>
              {otOptions.map((w) => (
                <option key={w.id} value={w.id} className="bg-slate-900">
                  {w.ot_number} • {w.title}
                </option>
              ))}
            </select>
          )}

          {/* 3. Operario / Contratista (Ámbar) */}
          {setFilterContractor && (
            <select
              value={filterContractor}
              onChange={(e) => setFilterContractor(e.target.value)}
              className={getFilterSelectClass('contractor', filterContractor !== 'todos', 'max-w-[185px]')}
              title="Filtrar por Operario o Contratista"
            >
              <option value="todos" className="bg-slate-900">Todos Operarios / Contr.</option>
              {contractorOptions.map((c) => (
                <option key={c.name} value={c.name} className="bg-slate-900">
                  {c.name} ({c.workerType})
                </option>
              ))}
            </select>
          )}

          {/* 4. Rubro (Azul Cielo) */}
          {setFilterRubro && (
            <select
              value={filterRubro}
              onChange={(e) => setFilterRubro(e.target.value)}
              className={getFilterSelectClass('trade', filterRubro !== 'todos', 'max-w-[150px]')}
              title="Filtrar por Rubro"
            >
              <option value="todos" className="bg-slate-900">Todos los Rubros</option>
              {rubroOptions.map((r) => (
                <option key={r} value={r} className="bg-slate-900">
                  {r}
                </option>
              ))}
            </select>
          )}

          {/* 5. Modalidad (Rosa) */}
          {setFilterModality && (
            <select
              value={filterModality}
              onChange={(e) => setFilterModality(e.target.value)}
              className={getFilterSelectClass('modality', filterModality !== 'todas', 'max-w-[155px]')}
              title="Filtrar por Modalidad (Col. F)"
            >
              <option value="todas" className="bg-slate-900">Todas Modalidades</option>
              <option value="HORA" className="bg-slate-900">HH · Hora</option>
              <option value="PRESUPUESTO" className="bg-slate-900">PRC · Presupuesto</option>
              <option value="CONTROL" className="bg-slate-900">CTRL · Control</option>
            </select>
          )}

          <span className="text-[11px] text-slate-400 whitespace-nowrap hidden xl:inline">
            Mostrando {filteredCount} de {totalCount}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {hasFilters && (
            <button
              type="button"
              onClick={onClearAllFilters}
              className={CLEAR_FILTER_BTN_CLASS}
              title="Limpiar todos los filtros (Esc)"
            >
              <X className="w-3.5 h-3.5" />
              <span>Limpiar filtro</span>
            </button>
          )}
          {canUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold shadow flex items-center gap-1 cursor-pointer border border-slate-700"
              title="Deshacer último cambio (Ctrl+Z)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
          {canRedo && (
            <button
              type="button"
              onClick={onRedo}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold shadow flex items-center gap-1 cursor-pointer border border-slate-700"
              title="Rehacer cambio (Ctrl+Y)"
            >
              <RotateCw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
