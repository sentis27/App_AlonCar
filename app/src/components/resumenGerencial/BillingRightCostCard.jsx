import React, { useState } from 'react'
import { Megaphone, AlertTriangle, CheckCircle2, Trash2, X } from 'lucide-react'
import { formatUsd } from '../../lib/drydockCatalogConstants'

/**
 * Columna 3 (Derecha, Compacta y Soldada a la Cabecera `top-0` de cada OT):
 * Respeta el orden exacto aprobado en la Versión 4:
 * - Cabecera Naranja: `OT-XX · Nombre` + `[Estado]` + `TOTAL OT: $...` arriba a la derecha.
 * - Cuerpo Compacto 3 secciones:
 *     Izquierda: `M.O.` y `MAT.` apilados | Centro: `ACCIONES` (`[📣 Ampliar]`, modo precio) | Derecha: `HORAS`
 * - Pie de Tarjeta: Franja amarilla `⚠️ X SIN VALORIZAR` con las 4 píldoras `[Hs | 3ros | Comp | Mat]`
 *   y ventana emergente con el detalle exacto de contratistas, materiales u horas en $0.
 */
export default function BillingRightCostCard({
  block,
  otRow,
  rubroSubtotal = null,
  onRequestExpansion,
  onChangePricingMode,
  onRemoveBlock
}) {
  const [showUnvaluedPopover, setShowUnvaluedPopover] = useState(false)
  const [showNoteInput, setShowNoteInput] = useState(false)
  const [noteDraft, setNoteDraft] = useState('')
  const [sending, setSending] = useState(false)

  // Fila tipo Delimitador de Rubro (ej. CALDERERÍA)
  if (block?.blockType === 'RUBRO_DELIMITER') {
    return (
      <div className="px-2.5 py-1.5 rounded-lg bg-slate-900/90 border border-slate-700/80 text-[10px] flex items-center justify-between gap-2">
        <span className="font-black uppercase text-cyan-300 truncate">{block.label}</span>
        <div className="flex items-center gap-2 text-slate-300 font-mono shrink-0">
          {rubroSubtotal && (
            <>
              <span>Costo: <strong>{formatUsd(rubroSubtotal.costUsd, 0)}</strong></span>
              {rubroSubtotal.weightKg > 0 && (
                <span className="text-sky-300">{rubroSubtotal.weightKg.toLocaleString('es-AR', { maximumFractionDigits: 1 })} kg</span>
              )}
            </>
          )}
          <button
            type="button"
            onClick={() => onRemoveBlock?.(block)}
            className="text-slate-500 hover:text-rose-400 cursor-pointer"
            title="Quitar delimitador de rubro"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    )
  }

  // Fila tipo Bloque Comercial Libre (sin OT de taller asociada)
  if (block?.blockType === 'FREE_BLOCK' || !otRow) {
    return (
      <div className="px-2.5 py-2 rounded-lg bg-slate-900/60 border border-dashed border-slate-700 text-[10px] text-slate-400 flex items-center justify-between gap-2">
        <div className="space-y-1 min-w-0">
          <span className="font-bold text-slate-300 block truncate">Bloque Comercial Libre</span>
          <div className="flex items-center gap-1">
            {[
              { id: 'MO_MAT', label: 'M.O+MAT' },
              { id: 'UNITARIO', label: 'Unit.' },
              { id: 'SIN_CARGO', label: 'S/Cargo' }
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onChangePricingMode?.(block, m.id)}
                className={`px-1.5 py-0.5 rounded text-[9px] font-bold border cursor-pointer ${
                  (block.billing_pricing_mode || 'MO_MAT') === m.id
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                    : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={() => onRemoveBlock?.(block)}
          className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-800 cursor-pointer"
          title="Quitar bloque libre"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    )
  }

  const unv = otRow.unvaluedByOt || { hsCount: 0, tercerosCount: 0, comprasCount: 0, matCount: 0, totalCount: 0, details: [] }
  const reviewSt = otRow.foremanReviewStatus || 'NONE'
  const pricingMode = block.billing_pricing_mode || otRow.billingPricingMode || 'MO_MAT'

  const handleSendExpansion = async () => {
    try {
      setSending(true)
      await onRequestExpansion?.(otRow, noteDraft)
      setShowNoteInput(false)
      setNoteDraft('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="rounded-lg border border-slate-600/80 bg-slate-950 overflow-visible shadow-md text-[11px] relative">
      {/* Cabecera Naranja: OT-XX · Nombre + [Estado] + TOTAL OT arriba a la derecha */}
      <div className="flex items-stretch rounded-t-lg overflow-hidden border-b border-slate-700">
        <div className="flex-1 min-w-0 bg-gradient-to-r from-amber-500 to-orange-500 px-2 py-1 flex items-center justify-between gap-1 text-slate-950">
          <span className="font-black text-[11px] uppercase truncate" title={`${otRow.otNumber} · ${otRow.title}`}>
            {otRow.otNumber} · {otRow.title}
          </span>
          <span className="px-1.5 py-0.5 rounded bg-white/95 border border-purple-500 text-purple-900 text-[9px] font-black shrink-0 max-w-[82px] truncate" title={otRow.status}>
            {otRow.status}
          </span>
        </div>
        <div className="bg-sky-200 text-slate-950 px-2 py-0.5 flex flex-col justify-center items-end border-l-2 border-rose-500 shrink-0 min-w-[84px]">
          <span className="text-[8px] font-black uppercase leading-none text-slate-800">TOTAL OT:</span>
          <span className="text-xs font-black tabular-nums leading-tight">{formatUsd(otRow.directTotalUsd, 2).replace('US$ ', '$')}</span>
        </div>
      </div>

      {/* Cuerpo Compacto de 3 Secciones */}
      <div className="grid grid-cols-[1.15fr_1fr_0.72fr] divide-x divide-slate-800 bg-slate-900/95">
        {/* Izquierda: M.O. y MAT. apilados */}
        <div className="divide-y divide-slate-800 text-[10px]">
          <div className="px-1.5 py-1 flex items-center justify-between gap-1">
            <span className="font-bold text-slate-400">M.O.</span>
            <span className="font-black text-white tabular-nums">{formatUsd(otRow.manoObraTotalUsd, 2).replace('US$ ', '$')}</span>
          </div>
          <div className="px-1.5 py-1 flex items-center justify-between gap-1">
            <span className="font-bold text-slate-400">MAT.</span>
            <span className="font-black text-white tabular-nums">{formatUsd(otRow.matPlusConsUsd, 2).replace('US$ ', '$')}</span>
          </div>
        </div>

        {/* Centro: ACCIONES ([📣 Ampliar] + modo precio) */}
        <div className="px-1.5 py-1 flex flex-col items-center justify-center gap-1">
          <div className="flex items-center justify-between w-full gap-1">
            <span className="text-[8px] font-black uppercase text-rose-300 tracking-wider">ACCIONES</span>
            <button
              type="button"
              onClick={() => onRemoveBlock?.(block)}
              className="text-slate-500 hover:text-rose-400 cursor-pointer"
              title="Quitar esta OT de la hoja (no borra la OT del taller)"
            >
              <Trash2 className="w-2.5 h-2.5" />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowNoteInput((v) => !v)}
            className={`w-full px-1.5 py-0.5 rounded text-[10px] font-black inline-flex items-center justify-center gap-1 cursor-pointer transition-colors ${
              reviewSt === 'REQUESTED'
                ? 'bg-orange-500 text-slate-950'
                : reviewSt === 'RESOLVED'
                  ? 'bg-emerald-600 text-white'
                  : 'bg-sky-600 hover:bg-sky-500 text-white'
            }`}
            title="Notificar a Jefe de Obra + Administrador para ampliar billing_description"
          >
            <Megaphone className="w-3 h-3 shrink-0" />
            <span className="truncate">
              {reviewSt === 'REQUESTED' ? 'Pedido' : reviewSt === 'RESOLVED' ? 'Ampliado' : 'Ampliar'}
            </span>
          </button>
          <div className="flex items-center gap-0.5 w-full justify-center">
            {[
              { id: 'MO_MAT', label: 'MO' },
              { id: 'UNITARIO', label: 'Unit' },
              { id: 'SIN_CARGO', label: 'S/C' }
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => onChangePricingMode?.(block, m.id)}
                className={`px-1 py-0.2 rounded text-[8px] font-bold border cursor-pointer ${
                  pricingMode === m.id
                    ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200'
                    : 'bg-slate-950 border-slate-700 text-slate-400 hover:text-white'
                }`}
                title={`Modo de precio: ${m.id}`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Derecha: HORAS */}
        <div className="px-1.5 py-1 flex flex-col items-center justify-center text-center">
          <span className="text-[8px] font-black uppercase text-slate-400 leading-tight">HORAS</span>
          <span className="text-xs font-black text-amber-200 tabular-nums mt-0.5">
            {Number(otRow.physicalHours || 0).toLocaleString('es-AR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} hs
          </span>
        </div>
      </div>

      {/* Mini formulario inline para nota de Ampliar Información */}
      {showNoteInput && (
        <div className="p-2 bg-slate-950 border-t border-orange-500/60 space-y-1.5">
          <div className="flex items-center justify-between text-[10px] text-orange-300 font-bold">
            <span>Indicación p/ {otRow.foremanName || 'Jefe de Obra'} + Admin:</span>
            <button type="button" onClick={() => setShowNoteInput(false)} className="text-slate-400 hover:text-white cursor-pointer">
              <X className="w-3 h-3" />
            </button>
          </div>
          <input
            type="text"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            placeholder="Ej: Indicar lugar, kilos y si se recicló madera..."
            className="w-full bg-slate-900 border border-orange-500/50 rounded px-2 py-1 text-[11px] text-white focus:outline-none"
          />
          <button
            type="button"
            disabled={sending}
            onClick={handleSendExpansion}
            className="w-full py-1 rounded bg-orange-500 hover:bg-orange-400 text-slate-950 font-black text-[10px] cursor-pointer"
          >
            {sending ? 'Enviando aviso...' : '📣 Enviar Acuse a Jefe de Obra + Admin'}
          </button>
        </div>
      )}

      {/* Franja Amarilla / Verde de Ítems Sin Valorizar + 4 Píldoras [Hs | 3ros | Comp | Mat] */}
      <button
        type="button"
        onClick={() => unv.totalCount > 0 && setShowUnvaluedPopover((v) => !v)}
        className={`w-full px-2 py-1 rounded-b-lg border-t flex items-center justify-between gap-1 text-left ${
          unv.totalCount > 0
            ? 'bg-amber-300 hover:bg-amber-200 text-slate-950 border-amber-500 cursor-pointer'
            : 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50 cursor-default'
        }`}
        title={unv.totalCount > 0 ? 'Clic para ver detalle de ítems sin valorizar en esta OT' : 'Todos los ítems de esta OT tienen valor'}
      >
        <span className="inline-flex items-center gap-1 text-[9px] font-black uppercase truncate">
          {unv.totalCount > 0 ? <AlertTriangle className="w-3 h-3 shrink-0" /> : <CheckCircle2 className="w-3 h-3 shrink-0" />}
          <span>{unv.totalCount} SIN VALORIZAR</span>
        </span>
        <span className="inline-flex items-center gap-0.5 bg-slate-950/90 px-1 py-0.5 rounded font-mono text-[8px] font-bold shrink-0">
          <span className="px-1 rounded bg-cyan-950 text-cyan-300">Hs:{unv.hsCount}</span>
          <span className="px-1 rounded bg-purple-950 text-purple-300">3r:{unv.tercerosCount}</span>
          <span className="px-1 rounded bg-amber-950 text-amber-300">C:{unv.comprasCount}</span>
          <span className="px-1 rounded bg-emerald-950 text-emerald-300">M:{unv.matCount}</span>
        </span>
      </button>

      {/* Popover Emergente con Detalle de Ítems Sin Valorizar */}
      {showUnvaluedPopover && unv.details.length > 0 && (
        <div className="mt-1 p-2.5 rounded-lg bg-slate-950 border-2 border-amber-400 shadow-2xl space-y-1.5 z-30 relative">
          <div className="flex items-center justify-between border-b border-slate-800 pb-1">
            <span className="text-[10px] font-black text-amber-300 uppercase">Detalle Sin Valorizar ({unv.details.length})</span>
            <button type="button" onClick={() => setShowUnvaluedPopover(false)} className="text-slate-400 hover:text-white cursor-pointer">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <ul className="space-y-1 max-h-40 overflow-y-auto text-[10px]">
            {unv.details.map((d) => (
              <li key={d.id} className="text-slate-200 leading-snug">
                <span className="font-mono font-bold text-amber-300">[{d.badge}]</span>{' '}
                <strong>{d.label}</strong> — <span className="text-slate-400">{d.detail}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
