import React from 'react'
import { X, Check } from 'lucide-react'
import CrawlerSearchBar from '../CrawlerSearchBar'
import {
  CLEAR_FILTER_BTN_CLASS,
  getFilterPillClass,
  getFilterSelectClass
} from '../../lib/filterThemeConstants'

/**
 * Zona 3 de la hoja Materiales en Resumen Gerencial (GS-004).
 */
export default function ResumenHojaMaterialesToolbar({
  searchQuery,
  setSearchQuery,
  costScope,
  otFilter,
  setOtFilter,
  otRows = [],
  contractorFilter,
  setContractorFilter,
  contractorOptions = [],
  showMateriales,
  setShowMateriales,
  showConsumibles,
  setShowConsumibles,
  materialQuick,
  setMaterialQuick,
  onlyKgPositive,
  setOnlyKgPositive,
  hasFilters,
  onClearFilters
}) {
  return (
    <div className="alon-zone-toolbar p-3 bg-slate-900/70 flex flex-wrap items-center gap-2">
      <CrawlerSearchBar
        compact
        value={searchQuery}
        onChange={setSearchQuery}
        onClear={() => setSearchQuery('')}
        placeholder="Buscar material, rubro, OT, solicitante, vale o factura... (Ctrl+F)"
      />

      {costScope === 'GENERAL' && (
        <select
          value={otFilter}
          onChange={(e) => setOtFilter(e.target.value)}
          className={getFilterSelectClass('ot', otFilter !== 'ALL', 'max-w-[175px]')}
          title="Filtrar por Orden de Trabajo"
        >
          <option value="ALL" className="bg-slate-900">OT: Todas</option>
          {otRows.map((o) => (
            <option key={o.id} value={o.id} className="bg-slate-900">
              {o.otLabel || `${o.otNumber} · ${o.title}`}
            </option>
          ))}
        </select>
      )}

      <select
        value={contractorFilter}
        onChange={(e) => setContractorFilter(e.target.value)}
        className={getFilterSelectClass('contractor', contractorFilter !== 'ALL', 'max-w-[180px]')}
        title="Filtrar por Contratista"
      >
        <option value="ALL" className="bg-slate-900">Contratista: Todos</option>
        {contractorOptions.map((c) => (
          <option key={c} value={c} className="bg-slate-900">
            {c}
          </option>
        ))}
      </select>

      <div
        className="inline-flex items-center gap-1 px-1.5 py-1 rounded-full bg-slate-950 border border-sky-800/70 shadow-inner"
        title="Categorías incluidas (ambas tildadas por defecto)"
      >
        <button
          type="button"
          onClick={() => setShowMateriales((v) => !v)}
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
            showMateriales ? 'bg-sky-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {showMateriales && <Check className="w-3 h-3 stroke-[3]" />}
          <span>Materiales</span>
        </button>
        <button
          type="button"
          onClick={() => setShowConsumibles((v) => !v)}
          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold transition-all cursor-pointer ${
            showConsumibles ? 'bg-sky-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          {showConsumibles && <Check className="w-3 h-3 stroke-[3]" />}
          <span>Consumibles</span>
        </button>
      </div>

      <button
        type="button"
        onClick={() => setMaterialQuick((prev) => (prev === 'CHAPA' ? '' : 'CHAPA'))}
        className={getFilterPillClass('materialQuick', materialQuick === 'CHAPA')}
        title="Filtrar automáticamente todo lo que sea Chapa"
      >
        <span>Chapa</span>
      </button>

      <button
        type="button"
        onClick={() => setMaterialQuick((prev) => (prev === 'CANOS' ? '' : 'CANOS'))}
        className={getFilterPillClass('materialQuick', materialQuick === 'CANOS')}
        title="Filtrar automáticamente todo lo que sea Caños"
      >
        <span>Caños</span>
      </button>

      <button
        type="button"
        onClick={() => setOnlyKgPositive((prev) => !prev)}
        className={getFilterPillClass('weightQuick', onlyKgPositive)}
        title="Mostrar únicamente materiales con peso mayor a 0 kg"
      >
        <span>Solo KG &gt; 0</span>
      </button>

      {hasFilters && (
        <button
          type="button"
          onClick={onClearFilters}
          className={CLEAR_FILTER_BTN_CLASS}
          title="Limpiar todos los filtros"
        >
          <X className="w-3.5 h-3.5" />
          <span>Limpiar filtro</span>
        </button>
      )}
    </div>
  )
}
