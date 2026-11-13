import React, { useMemo } from 'react'
import { Download } from 'lucide-react'
import { formatUsd, formatKg } from '../../lib/drydockCatalogConstants'
import { exportToSpreadsheet } from '../../lib/exportEngine'

/**
 * Nivel 2 del Comparador de Obras: Matriz comparativa OT a OT (productividad y costo/KG entre buques seleccionados).
 */
export default function ComparadorNivel2OtTable({
  selectedShipsData = [],
  selectedOtKeys = []
}) {
  // Normalizar lista de títulos/códigos OT presentes entre los buques seleccionados
  const otComparisonRows = useMemo(() => {
    const keyMap = new Map()
    selectedShipsData.forEach((ship) => {
      ship.otRows.forEach((ot) => {
        const matchKey = String(ot.otNumber || ot.title || ot.id).trim().toUpperCase()
        if (selectedOtKeys.length > 0 && !selectedOtKeys.includes(matchKey)) return
        if (!keyMap.has(matchKey)) {
          keyMap.set(matchKey, {
            key: matchKey,
            label: ot.title && ot.title !== 'Sin título' ? `${ot.otNumber} · ${ot.title}` : ot.otNumber,
            byShip: {}
          })
        }
        keyMap.get(matchKey).byShip[ship.shipId] = ot
      })
    })
    return Array.from(keyMap.values())
  }, [selectedShipsData, selectedOtKeys])

  const handleExport = () => {
    const columns = [
      { key: 'label', label: 'Orden de Trabajo' },
      ...selectedShipsData.flatMap((s) => [
        { key: `${s.shipId}_usd`, label: `${s.shipName} (US$)` },
        { key: `${s.shipId}_kg`, label: `${s.shipName} (KG)` },
        { key: `${s.shipId}_ckg`, label: `${s.shipName} (US$/KG)` }
      ])
    ]

    const rows = otComparisonRows.map((row) => {
      const flat = { label: row.label }
      selectedShipsData.forEach((s) => {
        const ot = row.byShip[s.shipId]
        flat[`${s.shipId}_usd`] = ot ? ot.directTotalUsd : 0
        flat[`${s.shipId}_kg`] = ot ? ot.weightKg : 0
        flat[`${s.shipId}_ckg`] = ot && ot.weightKg > 0 ? Number((ot.directTotalUsd / ot.weightKg).toFixed(2)) : 0
      })
      return flat
    })

    exportToSpreadsheet({
      filename: 'comparador_obras_nivel2_ots.xls',
      columns,
      rows
    })
  }

  return (
    <div className="bg-slate-950/75 border border-violet-500/30 rounded-xl overflow-hidden">
      <div className="px-3.5 py-2.5 bg-violet-950/35 border-b border-violet-500/25 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-violet-200">
            Nivel 2 — Matriz Comparativa por Orden de Trabajo (US$, KG, US$/KG, KG/Hr)
          </h4>
          <p className="text-[10px] text-slate-400">
            Comparación directa de eficiencia y densidad de gasto entre los buques seleccionados.
          </p>
        </div>

        <button
          type="button"
          onClick={handleExport}
          disabled={otComparisonRows.length === 0}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 disabled:opacity-40 text-emerald-300 border border-emerald-500/40 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          Exportar Matriz Nivel 2
        </button>
      </div>

      <div className="overflow-x-auto max-h-[420px]">
        <table className="w-full text-xs text-left border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-900 border-b border-slate-700 text-[10px] uppercase tracking-wider text-slate-400">
            <tr>
              <th className="px-3 py-2">Orden / Rubro Común</th>
              {selectedShipsData.map((ship) => (
                <th key={ship.shipId} className="px-3 py-2 text-right border-l border-slate-800 text-violet-200">
                  {ship.shipName}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {otComparisonRows.length === 0 ? (
              <tr>
                <td colSpan={1 + selectedShipsData.length} className="px-4 py-8 text-center text-slate-500">
                  Seleccioná al menos 1 buque con OTs para visualizar la matriz Nivel 2.
                </td>
              </tr>
            ) : (
              otComparisonRows.map((row) => (
                <tr key={row.key} className="hover:bg-slate-800/40 text-slate-200">
                  <td className="px-3 py-2 font-semibold text-white whitespace-nowrap">{row.label}</td>
                  {selectedShipsData.map((ship) => {
                    const ot = row.byShip[ship.shipId]
                    if (!ot) {
                      return (
                        <td
                          key={ship.shipId}
                          className="px-3 py-2 text-right border-l border-slate-800/70 text-slate-600"
                        >
                          —
                        </td>
                      )
                    }
                    const costKg = ot.weightKg > 0 ? ot.directTotalUsd / ot.weightKg : 0
                    const kgHr = ot.physicalHours > 0 ? ot.weightKg / ot.physicalHours : 0
                    return (
                      <td
                        key={ship.shipId}
                        className="px-3 py-2 text-right border-l border-slate-800/70 tabular-nums"
                      >
                        <div className="font-bold text-emerald-300">{formatUsd(ot.directTotalUsd, 0)}</div>
                        <div className="text-[10px] text-slate-400">
                          {formatKg(ot.weightKg, 0)} · {costKg > 0 ? `${formatUsd(costKg, 1)}/kg` : 'sin peso'} ·{' '}
                          {kgHr > 0 ? `${kgHr.toFixed(1)} kg/h` : `${ot.physicalHours}h`}
                        </div>
                      </td>
                    )
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
