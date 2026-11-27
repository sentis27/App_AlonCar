/**
 * LaborResumenNovedadesTable.jsx
 * Botón 1 ("Resumen") de `4. Resumen Horas` — réplica fiel de la hoja `RESUMEN`:
 * 4 columnas (`OPERARIO`, `RUBRO`, `DÍA DEL MES`, `OBSERVACIONES`) con grupos colapsables `[-]`/`[+]`.
 */
import React, { useMemo, useRef, useState } from 'react'
import { Download, MinusSquare, PlusSquare, Search } from 'lucide-react'
import CanonicalProgressiveTableFooter from '../../canonical/CanonicalProgressiveTableFooter'
import GridStatusBarBottom from '../../GridStatusBarBottom'
import HighlightText from '../../HighlightText'
import { useProgressiveRows } from '../../../hooks/useProgressiveRows'
import { useSheetSelection } from '../../../hooks/grid/useSheetSelection'
import { exportToSpreadsheet } from '../../../lib/exportEngine'
import { RESUMEN_NOVEDADES_SHEET_COLUMNS } from '../../../lib/contractorSettlementHelpers'

export default function LaborResumenNovedadesTable({
  groups = [],
  periodKey = '',
  loading = false,
}) {
  const [searchTerm, setSearchTerm] = useState('')
  const [collapsedKeys, setCollapsedKeys] = useState(() => new Set())
  const scrollRef = useRef(null)

  const filteredGroups = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return groups
    return groups.filter(
      (g) =>
        g.workerName.toLowerCase().includes(q) ||
        g.novedad.toLowerCase().includes(q) ||
        g.entries.some((e) => String(e.dayNumber).includes(q) || (e.observations || '').toLowerCase().includes(q))
    )
  }, [groups, searchTerm])

  const flatRows = useMemo(() => {
    const out = []
    for (const g of filteredGroups) {
      const isCollapsed = collapsedKeys.has(g.key)
      if (isCollapsed) {
        out.push({
          rowId: `${g.key}|collapsed`,
          groupKey: g.key,
          isFirstInGroup: true,
          isGroupToggleable: g.entries.length > 0,
          isCollapsed: true,
          workerName: g.workerName,
          novedad: g.novedad,
          dayNumber: g.entries.map((e) => e.dayNumber).join(', '),
          daysCount: g.entries.length,
          observations: g.entries.map((e) => e.observations).filter(Boolean).join(' · '),
        })
      } else {
        g.entries.forEach((e, idx) => {
          out.push({
            rowId: `${g.key}|${e.id}|${idx}`,
            groupKey: g.key,
            isFirstInGroup: idx === 0,
            isGroupToggleable: g.entries.length > 1,
            isCollapsed: false,
            workerName: g.workerName,
            novedad: g.novedad,
            dayNumber: e.dayNumber,
            daysCount: g.entries.length,
            observations: e.observations || '',
          })
        })
      }
    }
    return out
  }, [filteredGroups, collapsedKeys])

  const sheet = useSheetSelection({ rows: flatRows, columns: RESUMEN_NOVEDADES_SHEET_COLUMNS, getRowId: (r) => r.rowId, sortable: false })
  const { visibleItems, visibleCount, hasMore, remainingCount, loadMore, showAll, sentinelRef } = useProgressiveRows({
    items: flatRows,
    scrollContainerRef: scrollRef,
    resetKey: `${periodKey}|${searchTerm}|${collapsedKeys.size}`,
  })

  const toggleGroup = (key) => {
    setCollapsedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const collapseAll = () => setCollapsedKeys(new Set(filteredGroups.map((g) => g.key)))
  const expandAll = () => setCollapsedKeys(new Set())

  const handleExport = () => {
    const allDays = filteredGroups.flatMap((g) =>
      g.entries.map((e) => ({ operario: g.workerName, rubro: g.novedad, dia: e.dayNumber, observaciones: e.observations || '' }))
    )
    exportToSpreadsheet({
      filename: `resumen_novedades_${periodKey}`,
      rows: allDays,
      columns: [
        { key: 'operario', label: 'OPERARIO' },
        { key: 'rubro', label: 'RUBRO' },
        { key: 'dia', label: 'DÍA DEL MES' },
        { key: 'observaciones', label: 'OBSERVACIONES' },
      ],
    })
  }

  return (
    <div ref={sheet.containerRef} tabIndex={0} onKeyDown={sheet.handleKeyDown} className="alon-zone-grid flex flex-col focus:outline-none">
      <div className="alon-grid-ribbon flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-purple-300 uppercase tracking-wider">Resumen de Novedades Astillero · {periodKey}</span>
          <span className="text-slate-400 font-mono">({filteredGroups.length} legajos · {flatRows.length} filas)</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar operario o novedad..."
              className="bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-2.5 py-1 text-xs text-white placeholder:text-slate-500 w-52"
            />
          </div>
          <button type="button" onClick={expandAll} className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer">
            <PlusSquare className="w-3 h-3" /> Expandir
          </button>
          <button type="button" onClick={collapseAll} className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer">
            <MinusSquare className="w-3 h-3" /> Colapsar
          </button>
          <button type="button" onClick={handleExport} className="px-2.5 py-1 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 border border-cyan-500/40 text-cyan-200 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer">
            <Download className="w-3 h-3" /> Excel
          </button>
        </div>
      </div>

      <div ref={scrollRef} className="alon-grid-scroll">
        <table className="w-full text-left border-collapse text-xs">
          <thead className="alon-grid-thead sticky top-0 z-10 text-[10px] uppercase tracking-wider text-slate-300">
            <tr>
              <th {...sheet.getHeaderProps('workerName', 'py-2 px-3 min-w-[220px]')}>OPERARIO</th>
              <th {...sheet.getHeaderProps('novedad', 'py-2 px-3 w-40')}>RUBRO</th>
              <th {...sheet.getHeaderProps('dayNumber', 'py-2 px-3 text-center w-36')}>DÍA DEL MES</th>
              <th {...sheet.getHeaderProps('observations', 'py-2 px-3')}>OBSERVACIONES</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {loading ? (
              <tr><td colSpan={4} className="py-10 text-center text-cyan-300 font-semibold">Cargando novedades de la quincena...</td></tr>
            ) : visibleItems.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-10 text-center text-slate-400">
                  Sin novedades de ausentismo / enfermedad / ART / licencia registradas para <strong>{periodKey}</strong>.
                </td>
              </tr>
            ) : (
              visibleItems.map((row, rowIdx) => {
                const cWorker = sheet.getCellProps(rowIdx, 'workerName')
                const cRubro = sheet.getCellProps(rowIdx, 'novedad')
                const cDay = sheet.getCellProps(rowIdx, 'dayNumber')
                const cObs = sheet.getCellProps(rowIdx, 'observations')
                const badgeCls = row.novedad === 'AUSENTE'
                  ? 'bg-rose-950/80 text-rose-300 border-rose-500/50'
                  : row.novedad === 'ENFERMO' || row.novedad === 'ART'
                  ? 'bg-amber-950/80 text-amber-300 border-amber-500/50'
                  : 'bg-sky-950/80 text-sky-300 border-sky-500/50'

                return (
                  <tr key={row.rowId} className={`hover:bg-slate-900/70 transition-colors ${row.isFirstInGroup ? 'bg-slate-900/40' : ''}`}>
                    <td {...cWorker.domProps} className={`py-1.5 px-3 font-bold text-white ${cWorker.className}`}>
                      {row.isFirstInGroup ? (
                        <div className="flex items-center gap-2">
                          <button type="button" onClick={() => toggleGroup(row.groupKey)} className="text-slate-400 hover:text-cyan-300 cursor-pointer" title={row.isCollapsed ? 'Expandir días' : 'Colapsar días'}>
                            {row.isCollapsed ? <PlusSquare className="w-3.5 h-3.5" /> : <MinusSquare className="w-3.5 h-3.5" />}
                          </button>
                          <HighlightText text={row.workerName} query={searchTerm} />
                        </div>
                      ) : (
                        <span className="text-slate-600 pl-6">↳</span>
                      )}
                    </td>
                    <td {...cRubro.domProps} className={`py-1.5 px-3 ${cRubro.className}`}>
                      {row.isFirstInGroup ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black border ${badgeCls}`}>{row.novedad}</span>
                      ) : null}
                    </td>
                    <td {...cDay.domProps} className={`py-1.5 px-3 text-center font-mono font-bold text-cyan-200 ${cDay.className}`}>
                      {row.dayNumber}
                      {row.isCollapsed && <span className="ml-1.5 text-[10px] text-slate-400 font-sans">({row.daysCount} días)</span>}
                    </td>
                    <td {...cObs.domProps} className={`py-1.5 px-3 text-slate-300 ${cObs.className}`}>
                      <HighlightText text={row.observations || '—'} query={searchTerm} />
                    </td>
                  </tr>
                )
              })
            )}
            <CanonicalProgressiveTableFooter
              visibleCount={visibleCount} totalCount={flatRows.length} hasMore={hasMore} remainingCount={remainingCount}
              loadMore={loadMore} showAll={showAll} sentinelRef={sentinelRef} colSpan={4} entityLabel="novedades"
            />
          </tbody>
        </table>
      </div>

      <GridStatusBarBottom
        isFixed={false} filteredCount={flatRows.length} totalCount={flatRows.length}
        entityName="novedades" hasActiveFilter={Boolean(searchTerm)} onClearFilters={() => setSearchTerm('')}
        selectionStats={sheet.selectionStats} onClearSelection={sheet.clearSelection}
      />
    </div>
  )
}
