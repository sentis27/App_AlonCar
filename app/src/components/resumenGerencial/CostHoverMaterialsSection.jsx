import React, { useMemo, useState } from 'react'
import { Search, ChevronDown, ChevronRight, Layers, List } from 'lucide-react'
import { formatUsd } from '../../lib/drydockCatalogConstants'

/**
 * Contenido interactivo del popover de Materiales/Consumibles para soportar +100 ítems:
 * - Buscador instantáneo en memoria (material o rubro)
 * - Alternancia entre `Lista A-Z` (por defecto) y `Por Rubro` colapsable (A-Z interno)
 */
export default function CostHoverMaterialsSection({ summaryData = null }) {
  const [searchTerm, setSearchTerm] = useState('')
  const [materialsViewMode, setMaterialsViewMode] = useState('AZ') // 'AZ' | 'RUBRO'
  const [expandedRubros, setExpandedRubros] = useState(() => new Set())

  const totalItems = summaryData?.totalItems || 0
  const totalUsd = summaryData?.totalUsd || 0

  const filteredMaterials = useMemo(() => {
    const items = summaryData?.items || []
    const byRubro = summaryData?.byRubro || []
    const q = searchTerm.trim().toUpperCase()
    if (!q) return { items, byRubro }

    const matchedItems = items.filter(
      (it) => it.materialName.toUpperCase().includes(q) || it.rubro.toUpperCase().includes(q)
    )
    const matchedByRubro = byRubro
      .map((rg) => {
        if (rg.rubro.toUpperCase().includes(q)) return rg
        const sub = rg.items.filter((it) => it.materialName.toUpperCase().includes(q))
        if (sub.length === 0) return null
        return {
          ...rg,
          itemsCount: sub.length,
          totalUsd: sub.reduce((acc, i) => acc + (Number(i.costUsd) || 0), 0),
          items: sub
        }
      })
      .filter(Boolean)
    return { items: matchedItems, byRubro: matchedByRubro }
  }, [summaryData, searchTerm])

  if (totalItems === 0) {
    return <div className="py-3 text-center text-slate-500">Sin materiales imputados en este filtro.</div>
  }

  const toggleRubro = (rubroName) => {
    setExpandedRubros((prev) => {
      const next = new Set(prev)
      if (next.has(rubroName)) next.delete(rubroName)
      else next.add(rubroName)
      return next
    })
  }

  const expandAllRubros = () => {
    const all = (filteredMaterials.byRubro || []).map((r) => r.rubro)
    setExpandedRubros((prev) => (prev.size === all.length ? new Set() : new Set(all)))
  }

  const activeItems = filteredMaterials.items
  const activeRubros = filteredMaterials.byRubro

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Buscar entre ${totalItems} materiales...`}
            className="w-full bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder-slate-500 outline-none"
          />
        </div>

        <div className="inline-flex items-center bg-slate-900 border border-slate-700 rounded-lg p-0.5 shrink-0">
          <button
            type="button"
            onClick={() => setMaterialsViewMode('AZ')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
              materialsViewMode === 'AZ'
                ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <List className="w-3 h-3" />
            A-Z
          </button>
          <button
            type="button"
            onClick={() => setMaterialsViewMode('RUBRO')}
            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
              materialsViewMode === 'RUBRO'
                ? 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/50'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            <Layers className="w-3 h-3" />
            Por Rubro ({activeRubros.length})
          </button>
        </div>
      </div>

      {materialsViewMode === 'AZ' ? (
        <div className="max-h-[46vh] overflow-y-auto pr-1 divide-y divide-slate-800/70">
          {activeItems.length === 0 ? (
            <div className="py-3 text-center text-slate-500">Sin coincidencias para &ldquo;{searchTerm}&rdquo;.</div>
          ) : (
            activeItems.map((it) => (
              <div
                key={it.key}
                className="py-1.5 px-1.5 hover:bg-slate-900/70 rounded"
              >
                <div className="grid grid-cols-[84px_1fr_92px] items-center gap-2">
                  <span className="font-mono text-xs font-extrabold text-cyan-300 text-right tabular-nums truncate">
                    {it.qtyUnitLabel}
                  </span>
                  <span className="font-semibold text-white truncate" title={it.materialName}>
                    {it.materialName}
                  </span>
                  <span className="font-mono text-xs font-bold text-emerald-300 text-right tabular-nums shrink-0">
                    {formatUsd(it.costUsd)}
                  </span>
                </div>
                {it.cuts?.length > 0 && (
                  <div className="mt-0.5 pl-[92px] flex flex-wrap gap-1">
                    {it.cuts.slice(0, 6).map((c, idx) => (
                      <span
                        key={idx}
                        title={[c.date, c.dimensionsLabel, c.notes].filter(Boolean).join(' · ')}
                        className="px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/35 text-[10px] font-mono text-cyan-200 max-w-[200px] truncate"
                      >
                        {c.dimensionsLabel}{c.notes ? ` · ${c.notes}` : ''}
                      </span>
                    ))}
                    {it.cuts.length > 6 && (
                      <span className="text-[10px] font-mono text-slate-400">+{it.cuts.length - 6} más</span>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-1.5">
          {activeRubros.length > 1 && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={expandAllRubros}
                className="text-[10.5px] font-semibold text-cyan-300 hover:text-cyan-200 underline cursor-pointer"
              >
                {expandedRubros.size === activeRubros.length ? 'Colapsar todos' : 'Expandir todos'}
              </button>
            </div>
          )}
          <div className="max-h-[43vh] overflow-y-auto pr-1 space-y-1.5">
            {activeRubros.length === 0 ? (
              <div className="py-3 text-center text-slate-500">Sin rubros coincidentes.</div>
            ) : (
              activeRubros.map((rg) => {
                const isExpanded = Boolean(searchTerm.trim()) || activeRubros.length <= 2 || expandedRubros.has(rg.rubro)
                return (
                  <div key={rg.rubro} className="rounded-lg border border-slate-800 bg-slate-900/70 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => toggleRubro(rg.rubro)}
                      className="w-full px-2.5 py-1.5 flex items-center justify-between gap-2 hover:bg-slate-800/80 cursor-pointer text-left"
                    >
                      <span className="flex items-center gap-1.5 min-w-0">
                        {isExpanded ? (
                          <ChevronDown className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="font-extrabold text-cyan-200 truncate">{rg.rubro}</span>
                        <span className="text-[10px] font-mono text-slate-400 shrink-0">({rg.itemsCount})</span>
                      </span>
                      <span className="font-mono text-xs font-extrabold text-emerald-300 tabular-nums shrink-0">
                        {formatUsd(rg.totalUsd)}
                      </span>
                    </button>

                    {isExpanded && (
                      <div className="border-t border-slate-800/80 bg-slate-950/75 divide-y divide-slate-800/50 px-1.5">
                        {rg.items.map((it) => (
                          <div key={it.key} className="py-1 px-1">
                            <div className="grid grid-cols-[78px_1fr_88px] items-center gap-2">
                              <span className="font-mono text-[11px] font-bold text-cyan-300 text-right tabular-nums truncate">
                                {it.qtyUnitLabel}
                              </span>
                              <span className="text-[11.5px] font-medium text-slate-100 truncate" title={it.materialName}>
                                {it.materialName}
                              </span>
                              <span className="font-mono text-[11px] font-bold text-emerald-300 text-right tabular-nums shrink-0">
                                {formatUsd(it.costUsd)}
                              </span>
                            </div>
                            {it.cuts?.length > 0 && (
                              <div className="mt-0.5 pl-[86px] flex flex-wrap gap-1">
                                {it.cuts.slice(0, 6).map((c, idx) => (
                                  <span
                                    key={idx}
                                    title={[c.date, c.dimensionsLabel, c.notes].filter(Boolean).join(' · ')}
                                    className="px-1.5 py-0.5 rounded bg-cyan-950/70 border border-cyan-500/35 text-[9.5px] font-mono text-cyan-200 max-w-[190px] truncate"
                                  >
                                    {c.dimensionsLabel}{c.notes ? ` · ${c.notes}` : ''}
                                  </span>
                                ))}
                                {it.cuts.length > 6 && (
                                  <span className="text-[9.5px] font-mono text-slate-400">+{it.cuts.length - 6} más</span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      )}

      <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between text-[11px]">
        <span className="text-slate-400">Mostrando {activeItems.length} de {totalItems} materiales (A-Z)</span>
        <span className="font-mono font-black text-emerald-300 tabular-nums">Total: {formatUsd(totalUsd)}</span>
      </div>
    </>
  )
}
