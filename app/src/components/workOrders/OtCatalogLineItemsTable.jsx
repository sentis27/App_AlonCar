import { Plus, Trash2, Layers } from 'lucide-react'
import {
  OT_ABC_DATA_SOURCES,
  OT_ABC_LINE_TAX_OPTIONS,
  OT_ABC_ROW_TYPES
} from '../../lib/otAbcCatalogConstants'

/**
 * Grilla tabular de renglones, sub-trabajos (amarillo), valores unitarios US$, IVA y origen.
 * Mantiene los inputs en tema oscuro contrastado (bg-slate-900/950) y foco limpio.
 */
export default function OtCatalogLineItemsTable({
  lineItems = [],
  taxSummary,
  onAddLine,
  onUpdateLine,
  onRemoveLine
}) {
  return (
    <div className="alon-chunk-emerald p-2.5 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-emerald-500/20 pb-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
            3. Renglones Tabulados, Valores US$ e IVA ({lineItems.length})
          </span>
          <span className="px-1.5 py-0.5 rounded bg-rose-950/70 border border-rose-500/40 text-[10px] text-rose-200 font-bold">
            Exento: {taxSummary.exentoCount}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-emerald-950/70 border border-emerald-500/40 text-[10px] text-emerald-200 font-bold">
            IVA 21%: {taxSummary.gravadoCount}
          </span>
          {taxSummary.subworkCount > 0 && (
            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-[10px] text-amber-200 font-bold flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {taxSummary.subworkCount} Sub-trabajos
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            tabIndex={-1}
            onClick={() => onAddLine('ITEM')}
            className="px-2 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-200 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Ítem</span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => onAddLine('SUBWORK')}
            className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/50 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Sub-trabajo</span>
          </button>
          <button
            type="button"
            tabIndex={-1}
            onClick={() => onAddLine('NOTE')}
            className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3 h-3" />
            <span>Nota</span>
          </button>
        </div>
      </div>

      <div className="max-h-[30vh] overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/80">
        <table className="w-full text-left text-[11px] border-collapse">
          <thead className="sticky top-0 z-10 bg-slate-950 border-b border-slate-800 text-[10px] uppercase text-slate-400">
            <tr>
              <th className="py-1.5 px-2 w-8 text-center">#</th>
              <th className="py-1.5 px-1.5 w-28">Tipo</th>
              <th className="py-1.5 px-2">Concepto / Texto Fijo</th>
              <th className="py-1.5 px-1.5 w-32">Origen</th>
              <th className="py-1.5 px-1.5 w-20">Unid.</th>
              <th className="py-1.5 px-1.5 w-24 text-right">US$ Unit.</th>
              <th className="py-1.5 px-1.5 w-28 text-center">IVA</th>
              <th className="py-1.5 px-1.5 w-10 text-center">✕</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {lineItems.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-5 text-center text-slate-500">
                  Sin renglones tabulados aún. Agregá un ítem o sub-trabajo para armar el tarifario.
                </td>
              </tr>
            ) : (
              lineItems.map((row, idx) => {
                const isSubwork = row.row_type === 'SUBWORK'
                const isNote = row.row_type === 'NOTE'
                return (
                  <tr
                    key={row.id || idx}
                    className={
                      isSubwork
                        ? 'bg-amber-500/10 border-l-4 border-l-amber-400'
                        : isNote
                          ? 'bg-slate-900/70'
                          : 'hover:bg-slate-900/40'
                    }
                  >
                    <td className="py-1.5 px-2 text-center font-mono text-slate-500">{idx + 1}</td>
                    <td className="py-1.5 px-1.5">
                      <select
                        value={row.row_type}
                        onChange={(e) => onUpdateLine(idx, { row_type: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1 text-[11px] text-white font-semibold"
                      >
                        {OT_ABC_ROW_TYPES.map((rt) => (
                          <option key={rt.value} value={rt.value}>{rt.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 px-2 space-y-1">
                      {isSubwork && (
                        <input
                          type="text"
                          value={row.subwork_title}
                          onChange={(e) => onUpdateLine(idx, { subwork_title: e.target.value.toUpperCase() })}
                          placeholder="Ej: 1) LAVADO DE CASCO"
                          className="w-full bg-amber-950/60 border border-amber-500/60 rounded-lg px-2 py-1 text-[11px] text-amber-200 font-black uppercase"
                        />
                      )}
                      <input
                        type="text"
                        value={row.concept}
                        onChange={(e) => onUpdateLine(idx, { concept: e.target.value })}
                        placeholder={isNote ? 'Texto de nota fija en negrita...' : 'Descripción fija del trabajo...'}
                        className={`w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] ${
                          isNote ? 'text-slate-300 font-bold italic' : 'text-white'
                        }`}
                      />
                    </td>
                    <td className="py-1.5 px-1.5">
                      <select
                        value={row.data_source}
                        onChange={(e) => onUpdateLine(idx, { data_source: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1 text-[11px] text-rose-300 font-semibold"
                      >
                        {OT_ABC_DATA_SOURCES.map((src) => (
                          <option key={src.value} value={src.value}>{src.shortLabel}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 px-1.5">
                      {isNote ? (
                        <span className="text-slate-600 px-1">—</span>
                      ) : (
                        <input
                          type="text"
                          value={row.unit}
                          onChange={(e) => onUpdateLine(idx, { unit: e.target.value })}
                          placeholder="Global"
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1 text-[11px] text-slate-200"
                        />
                      )}
                    </td>
                    <td className="py-1.5 px-1.5">
                      {isNote ? (
                        <span className="text-slate-600 block text-right px-1">—</span>
                      ) : (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0"
                          value={Number(row.unit_price_usd) === 0 ? '' : row.unit_price_usd}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => onUpdateLine(idx, { unit_price_usd: e.target.value === '' ? 0 : (Number(e.target.value) || 0) })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1 text-[11px] text-emerald-300 font-mono font-bold text-right tabular-nums placeholder:text-slate-600"
                        />
                      )}
                    </td>
                    <td className="py-1.5 px-1.5">
                      <select
                        value={row.tax_type}
                        onChange={(e) => onUpdateLine(idx, { tax_type: e.target.value })}
                        className={`w-full rounded-lg px-1.5 py-1 text-[11px] font-bold border ${
                          row.tax_type === 'GRAVADO_21'
                            ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'
                            : 'bg-rose-950/70 border-rose-500/50 text-rose-200'
                        }`}
                      >
                        {OT_ABC_LINE_TAX_OPTIONS.map((tx) => (
                          <option key={tx.value} value={tx.value}>{tx.label}</option>
                        ))}
                      </select>
                    </td>
                    <td className="py-1.5 px-1.5 text-center">
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => onRemoveLine(idx)}
                        className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer"
                        title="Quitar renglón"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
