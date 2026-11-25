import { useMemo, useRef, useState } from 'react'
import { Download, Shield, Package, Users, Layers, CheckCircle2, Info } from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { useModuleFilterMemory, resolveInitialModuleFilters } from '../../hooks/useModuleFilterMemory'
import { useProgressiveRows } from '../../hooks/useProgressiveRows'
import CanonicalZone3Toolbar from '../canonical/CanonicalZone3Toolbar'
import CanonicalProgressiveTableFooter from '../canonical/CanonicalProgressiveTableFooter'
import { getFilterSelectClass } from '../../lib/filterThemeConstants'
import HighlightText from '../HighlightText'
import { matchesUniversalSearch } from '../../lib/searchEngine'
import { exportToSpreadsheet } from '../../lib/exportEngine'
import { formatDateAr } from '../../lib/dateTimeCanonical'

/**
 * Panel analítico de Extracción de Descuentos a Contratistas (Gallina / METRICAS_ANALISIS)
 * para Graciela (TESORERIA). Recibe la quincena calculada y expone:
 * 1) Consolidado por Contratista (Consumibles + EPP)
 * 2) Detalle de retiros descontables
 * 3) Exentos por Zona Gris / Astillero (EPP con safety_items = ASTILLERO)
 */
export default function TesoreriaDeduccionesPanel({
  data,
  loading,
  selectedPeriod,
  onPeriodChange
}) {
  const { user, profile } = useAuth()
  const initialFilters = useMemo(
    () => resolveInitialModuleFilters(user, profile, 'tesoreria_deducciones'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [subView, setSubView] = useState('consolidado') // 'consolidado' | 'detalle' | 'exentos'
  const [searchTerm, setSearchTerm] = useState(initialFilters.searchTerm)
  const [categoryFilter, setCategoryFilter] = useState(initialFilters.categoryFilter) // 'ALL' | 'CONSUMIBLES' | 'ELEM.SEGURIDAD'
  const [selectedContractor, setSelectedContractor] = useState(initialFilters.selectedContractor)
  const searchRef = useRef(null)
  const scrollRef = useRef(null)

  const tesoreriaViewsController = useModuleFilterMemory({
    moduleKey: 'tesoreria_deducciones',
    currentFilters: { searchTerm, categoryFilter, selectedContractor },
    setters: { searchTerm: setSearchTerm, categoryFilter: setCategoryFilter, selectedContractor: setSelectedContractor },
    hasActiveFilters: Boolean(searchTerm || categoryFilter !== 'ALL' || selectedContractor !== 'ALL')
  })

  const periods = data?.availablePeriods || [selectedPeriod]
  const summaryRows = useMemo(() => data?.summaryByContractor || [], [data?.summaryByContractor])
  const detailRows = useMemo(() => data?.deductibleRows || [], [data?.deductibleRows])
  const exemptRows = useMemo(() => data?.exemptedGrayZoneRows || [], [data?.exemptedGrayZoneRows])
  const totals = data?.totals || { contractorsCount: 0, deductibleItemsCount: 0, exemptedGrayZoneCount: 0, totalDeductArs: 0, totalDeductUsd: 0, totalReferenceExemptUsd: 0 }
  const contractorOptions = useMemo(() => summaryRows.map((r) => r.contractorLabel), [summaryRows])

  const filteredSummary = useMemo(() => summaryRows.filter((row) => {
    if (selectedContractor !== 'ALL' && row.contractorLabel !== selectedContractor) return false
    if (categoryFilter === 'CONSUMIBLES' && row.consumablesCount === 0) return false
    if (categoryFilter === 'ELEM.SEGURIDAD' && row.safetyCount === 0) return false
    if (searchTerm && !matchesUniversalSearch(row, searchTerm)) return false
    return true
  }), [summaryRows, selectedContractor, categoryFilter, searchTerm])

  const filteredDetails = useMemo(() => detailRows.filter((row) => {
    if (selectedContractor !== 'ALL' && row.contractorLabel !== selectedContractor) return false
    if (categoryFilter !== 'ALL' && row.category !== categoryFilter) return false
    if (searchTerm && !matchesUniversalSearch(row, searchTerm)) return false
    return true
  }), [detailRows, selectedContractor, categoryFilter, searchTerm])

  const filteredExempt = useMemo(() => exemptRows.filter((row) => {
    if (selectedContractor !== 'ALL' && row.contractorLabel !== selectedContractor) return false
    if (searchTerm && !matchesUniversalSearch(row, searchTerm)) return false
    return true
  }), [exemptRows, selectedContractor, searchTerm])

  const activeDetailRows = subView === 'exentos' ? filteredExempt : filteredDetails
  const resetKey = `${selectedPeriod}|${subView}|${selectedContractor}|${categoryFilter}|${searchTerm}`
  const { visibleItems: visibleSummary, visibleCount: visSummaryCount, hasMore: hasMoreSummary, remainingCount: remSummary, loadMore: loadMoreSummary, showAll: showAllSummary, sentinelRef: summarySentinelRef } = useProgressiveRows({ items: filteredSummary, resetKey, scrollContainerRef: scrollRef })
  const { visibleItems: visibleDetailRows, visibleCount: visDetailCount, hasMore: hasMoreDetail, remainingCount: remDetail, loadMore: loadMoreDetail, showAll: showAllDetail, sentinelRef: detailSentinelRef } = useProgressiveRows({ items: activeDetailRows, resetKey, scrollContainerRef: scrollRef })

  const clearFilters = () => { setSearchTerm(''); setCategoryFilter('ALL'); setSelectedContractor('ALL') }

  const handleExport = () => {
    if (subView === 'consolidado') {
      exportToSpreadsheet({
        filename: `descuentos_contratistas_${selectedPeriod}`,
        rows: filteredSummary,
        columns: [
          { key: 'contractorLabel', label: 'Contratista / Grupo' },
          { key: 'adminCenter', label: 'Centro Admin' },
          { key: 'safetyCenter', label: 'Regla Seguridad' },
          { key: 'consumablesCount', label: 'Cant. Consumibles' },
          { key: 'consumablesArs', label: 'Consumibles AR$' },
          { key: 'consumablesUsd', label: 'Consumibles US$' },
          { key: 'safetyCount', label: 'Cant. Elem. Seguridad' },
          { key: 'safetyArs', label: 'Seguridad AR$' },
          { key: 'safetyUsd', label: 'Seguridad US$' },
          { key: 'totalDeductArs', label: 'Total Descontar AR$' },
          { key: 'totalDeductUsd', label: 'Total Descontar US$' }
        ]
      })
      return
    }
    const targetRows = subView === 'exentos' ? filteredExempt : filteredDetails
    exportToSpreadsheet({
      filename: `detalle_${subView}_${selectedPeriod}`,
      rows: targetRows.map((r) => ({
        fecha: r.date,
        contratista: r.contractorLabel,
        operario: r.workerName,
        material: r.materialName,
        categoria: r.category,
        cantidad: `${r.quantity} ${r.unitMeasure}`,
        reglaPct: `${r.classification.contractorDeductPct}%`,
        barco: r.shipName,
        ot: r.otLabel,
        descuentoArs: r.classification.deductArs,
        descuentoUsd: r.classification.deductUsd,
        referenciaUsd: r.classification.referenceUsd
      })),
      columns: [
        { key: 'fecha', label: 'Fecha' },
        { key: 'contratista', label: 'Contratista' },
        { key: 'operario', label: 'Operario' },
        { key: 'material', label: 'Material / EPP' },
        { key: 'categoria', label: 'Categoría' },
        { key: 'cantidad', label: 'Cantidad' },
        { key: 'reglaPct', label: '% Descuento' },
        { key: 'barco', label: 'Buque' },
        { key: 'ot', label: 'OT' },
        { key: 'descuentoArs', label: 'Descontar AR$' },
        { key: 'descuentoUsd', label: 'Descontar US$' },
        { key: 'referenciaUsd', label: 'Ref. Astillero US$' }
      ]
    })
  }

  return (
    <div className="space-y-4">
      {/* ZONA 2: RADAR DE KPIS Y ALERTAS OPERATIVAS */}
      <div className="alon-zone-kpis">
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
            📊 RADAR DE KPIS Y EXTRACCIÓN QUINCENAL • Clic para alternar vista
          </span>
          <span className="text-[11px] font-mono text-slate-400">
            Rango: {data?.range?.startDate || '—'} al {data?.range?.endDate || '—'}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => setSubView('consolidado')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              subView === 'consolidado'
                ? 'bg-cyan-950/60 border-cyan-400 ring-2 ring-cyan-400'
                : 'bg-cyan-950/25 border-cyan-500/50 hover:bg-cyan-950/40'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-cyan-300">
              <span>Contratistas c/ Descuento</span>
              <Users className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-cyan-300">{totals.contractorsCount}</div>
            <p className="text-[10px] text-cyan-300/70 mt-1">Consolidado listo para liquidar</p>
          </button>

          <button
            type="button"
            onClick={() => setSubView('detalle')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              subView === 'detalle'
                ? 'bg-amber-950/60 border-amber-400 ring-2 ring-amber-400'
                : 'bg-amber-950/25 border-amber-500/50 hover:bg-amber-950/40'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-amber-300">
              <span>Ítems Descontables</span>
              <Package className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-amber-300">{totals.deductibleItemsCount}</div>
            <p className="text-[10px] text-amber-300/70 mt-1">Consumibles (%) + EPP Contratista</p>
          </button>

          <div className="p-3.5 rounded-xl border bg-emerald-950/25 border-emerald-500/50 text-left">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-emerald-300">
              <span>Total Neto a Descontar</span>
              <Layers className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="mt-2 text-xl font-black font-mono text-emerald-300">
              ${totals.totalDeductArs.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-[10px] font-mono text-emerald-300/80 mt-1">
              US$ {totals.totalDeductUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>

          <button
            type="button"
            onClick={() => setSubView('exentos')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              subView === 'exentos'
                ? 'bg-purple-950/60 border-purple-400 ring-2 ring-purple-400'
                : 'bg-purple-950/25 border-purple-500/50 hover:bg-purple-950/40'
            }`}
          >
            <div className="flex items-center justify-between text-[10px] font-bold uppercase text-purple-300">
              <span>Exentos (Zona Gris / Ast.)</span>
              <Shield className="w-4 h-4 text-purple-400" />
            </div>
            <div className="mt-2 text-2xl font-black font-mono text-purple-300">{totals.exemptedGrayZoneCount}</div>
            <p className="text-[10px] text-purple-300/70 mt-1">No descontar · Solo Ref. Gerencial</p>
          </button>
        </div>
      </div>

      {/* ZONA 3: TOOLBAR & BUSCADOR OMNICANAL */}
      <CanonicalZone3Toolbar
        searchInputRef={searchRef}
        searchValue={searchTerm}
        onSearchChange={setSearchTerm}
        searchPlaceholder="Buscar contratista, operario, material, barco o OT... [Ctrl+F | Esc limpia todo]"
        viewsController={tesoreriaViewsController}
        hasActiveFilters={Boolean(searchTerm.trim() || categoryFilter !== 'ALL' || selectedContractor !== 'ALL')}
        onClearAllFilters={clearFilters}
        filters={
          <>
            <select
              value={selectedPeriod}
              onChange={(e) => onPeriodChange(e.target.value)}
              className={getFilterSelectClass('period', true, 'font-mono font-bold')}
              title="Seleccionar Quincena"
            >
              {periods.map((p) => (
                <option key={p} value={p} className="bg-slate-900">Quincena: {p}</option>
              ))}
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className={getFilterSelectClass('category', categoryFilter !== 'ALL')}
              title="Filtrar por Categoría"
            >
              <option value="ALL" className="bg-slate-900">Todas las Categorías</option>
              <option value="CONSUMIBLES" className="bg-slate-900">Solo CONSUMIBLES</option>
              <option value="ELEM.SEGURIDAD" className="bg-slate-900">Solo ELEM. SEGURIDAD</option>
            </select>

            <select
              value={selectedContractor}
              onChange={(e) => setSelectedContractor(e.target.value)}
              className={getFilterSelectClass('contractor', selectedContractor !== 'ALL', 'max-w-[200px]')}
              title="Filtrar por Contratista"
            >
              <option value="ALL" className="bg-slate-900">Todos los Contratistas</option>
              {contractorOptions.map((c) => (
                <option key={c} value={c} className="bg-slate-900">{c}</option>
              ))}
            </select>
          </>
        }
      />

      {/* ZONA 4: GRILLA DE EXTRACCIÓN */}
      <div className="alon-zone-grid overflow-hidden">
        <div className="alon-grid-ribbon">
          <div className="flex items-center gap-2 text-xs">
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 font-black font-mono text-[10px]">
              TESORERÍA · EXTRACCIÓN AUTOMÁTICA
            </span>
            <span className="text-slate-400 text-[11px]">
              Excluye automáticamente retiros de operarios/contratistas marcados con excepción <strong className="text-cyan-300">ASTILLERO (Zona Gris)</strong>.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {['consolidado', 'detalle', 'exentos'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setSubView(tab)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                  subView === tab
                    ? 'bg-emerald-500 text-slate-950 font-black'
                    : 'bg-slate-900 text-slate-300 border border-slate-700 hover:text-white'
                }`}
              >
                {tab === 'consolidado' ? '1. Consolidado por Contratista' : tab === 'detalle' ? '2. Detalle Descontable' : '3. Exentos (Zona Gris)'}
              </button>
            ))}
            <button
              type="button"
              onClick={handleExport}
              className="px-3 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] inline-flex items-center gap-1.5 cursor-pointer shadow ml-1"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar CSV / Excel ({selectedPeriod})</span>
            </button>
          </div>
        </div>

        <div ref={scrollRef} className="alon-grid-scroll">
          {loading ? (
            <div className="p-8 text-center text-xs text-slate-400">Calculando extracciones de la quincena {selectedPeriod}...</div>
          ) : subView === 'consolidado' ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 alon-grid-thead">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Contratista / Razón Social</th>
                  <th className="py-2.5 px-3">Centro</th>
                  <th className="py-2.5 px-3 text-center">Regla EPP</th>
                  <th className="py-2.5 px-3 text-right">Consumibles (AR$)</th>
                  <th className="py-2.5 px-3 text-right">Elem. Seguridad (AR$)</th>
                  <th className="py-2.5 px-3 text-right text-emerald-300">Total Descontar AR$</th>
                  <th className="py-2.5 px-3 text-right text-cyan-300">Total Descontar US$</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSummary.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-500">
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                      Sin deducciones registradas en Pañol para {selectedPeriod}.
                    </td>
                  </tr>
                ) : (
                  <>
                    {visibleSummary.map((r, idx) => (
                      <tr key={r.contractorLabel} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-white"><HighlightText text={r.contractorLabel} query={searchTerm} /></td>
                        <td className="py-2 px-3 text-[10px] font-bold text-amber-300">{r.adminCenter}</td>
                        <td className="py-2 px-3 text-center"><span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-700 font-bold">{r.safetyCenter}</span></td>
                        <td className="py-2 px-3 text-right font-mono text-slate-200">${r.consumablesArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ({r.consumablesCount})</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-200">${r.safetyArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ({r.safetyCount})</td>
                        <td className="py-2 px-3 text-right font-mono font-black text-emerald-300">${r.totalDeductArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-cyan-300">US$ {r.totalDeductUsd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    <CanonicalProgressiveTableFooter colSpan={8} visibleCount={visSummaryCount} totalCount={filteredSummary.length} remainingCount={remSummary} hasMore={hasMoreSummary} loadMore={loadMoreSummary} showAll={showAllSummary} sentinelRef={summarySentinelRef} entityLabel="contratistas" />
                  </>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-20 alon-grid-thead">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Contratista</th>
                  <th className="py-2.5 px-3">Operario</th>
                  <th className="py-2.5 px-3">Material / Insumo</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3 text-right">Cant.</th>
                  <th className="py-2.5 px-3">Buque / OT</th>
                  <th className="py-2.5 px-3 text-right">
                    {subView === 'exentos' ? 'Costo Ref. US$' : 'Descuento AR$ / US$'}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {activeDetailRows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-10 text-center text-slate-500">
                      No hay movimientos para mostrar con los filtros actuales.
                    </td>
                  </tr>
                ) : (
                  <>
                    {visibleDetailRows.map((r, idx) => (
                      <tr key={r.id || idx} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 text-center font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-3 font-mono text-slate-300">{formatDateAr(r.date)}</td>
                        <td className="py-2 px-3 font-bold text-white"><HighlightText text={r.contractorLabel} query={searchTerm} /></td>
                        <td className="py-2 px-3 text-slate-300"><HighlightText text={r.workerName} query={searchTerm} /></td>
                        <td className="py-2 px-3 font-semibold text-slate-100"><HighlightText text={r.materialName} query={searchTerm} /></td>
                        <td className="py-2 px-3">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold border ${r.category === 'ELEM.SEGURIDAD' ? 'bg-cyan-950 text-cyan-300 border-cyan-700' : 'bg-amber-950 text-amber-300 border-amber-700'}`}>{r.category}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-200">{r.quantity} {r.unitMeasure}</td>
                        <td className="py-2 px-3 text-slate-300"><span className="font-bold text-white">{r.shipName}</span> · <span className="text-[11px] text-slate-400">{r.otLabel}</span></td>
                        <td className="py-2 px-3 text-right font-mono">
                          {subView === 'exentos' ? (
                            <span className="text-purple-300 font-bold">US$ {r.classification.referenceUsd.toLocaleString('es-AR', { minimumFractionDigits: 2 })} (No desc.)</span>
                          ) : (
                            <div>
                              <div className="font-bold text-emerald-300">${r.classification.deductArs.toLocaleString('es-AR', { minimumFractionDigits: 2 })} ({r.classification.contractorDeductPct}%)</div>
                              <div className="text-[10px] text-cyan-300">US$ {r.classification.deductUsd.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</div>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    <CanonicalProgressiveTableFooter colSpan={9} visibleCount={visDetailCount} totalCount={activeDetailRows.length} remainingCount={remDetail} hasMore={hasMoreDetail} loadMore={loadMoreDetail} showAll={showAllDetail} sentinelRef={detailSentinelRef} entityLabel="movimientos" />
                  </>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Nota hoja de ruta futura de Tesorería */}
      <div className="p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-start gap-2.5 text-xs text-slate-400">
        <Info className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
        <div>
          <strong className="text-slate-200">Hoja de Ruta — Tesorería (Graciela):</strong> Este módulo comienza con la extracción quincenal filtrada de Consumibles y Elementos de Seguridad para descontar a contratistas. Próximas funciones planificadas: control de pagos quincenales, registro de adelantos y validación contra Terceros.
        </div>
      </div>
    </div>
  )
}
