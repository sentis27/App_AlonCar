import React, { useState } from 'react'
import { GripVertical, Plus, Trash2 } from 'lucide-react'
import { SHEET_COLS_CLASS as SHEET_COLS, formatMoneyClean } from '../../lib/billingSheetMath'
import { extractBlockHeadingText, normalizeBillingLineItems } from '../../lib/billingLineItemsHelper'
import { InlineNumberCell, InlineQtyCell } from './BillingSheetFrameParts'

function InlineLineTextCell({ value, isNote = false, fontSizePx = 12, compact = false, onCommit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const start = () => {
    setDraft(String(value || ''))
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    const clean = draft.trim()
    if (clean !== String(value || '').trim()) onCommit?.(clean)
  }

  if (editing) {
    return (
      <textarea
        rows={Math.min(5, Math.max(2, Math.ceil((draft.length || 40) / 56)))}
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); commit() }
        }}
        style={{ fontSize: `${fontSizePx}px`, lineHeight: 1.35 }}
        className="w-full bg-white text-slate-950 border border-sky-500 rounded px-1.5 py-0.5 outline-none resize-y font-sans"
      />
    )
  }

  return (
    <div
      onDoubleClick={start}
      style={{ fontSize: `${fontSizePx}px`, lineHeight: compact ? 1.24 : 1.36 }}
      title="Doble clic para editar el texto de este ítem"
      className={`w-full cursor-text hover:bg-sky-50/80 rounded px-1 ${compact ? 'py-0.5' : 'py-0.5'} whitespace-pre-wrap break-words ${
        isNote ? 'italic text-slate-700 font-semibold' : 'text-slate-950'
      }`}
    >
      {value ? value : <span className="text-slate-400 italic text-[11px]">Doble clic para redactar ítem...</span>}
    </div>
  )
}

function InlineHeadingCell({ value, fontSizePx = 12, onCommit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const start = () => {
    setDraft(String(value || ''))
    setEditing(true)
  }

  const commit = () => {
    setEditing(false)
    const clean = draft.trim().toUpperCase()
    if (clean && clean !== String(value || '').trim().toUpperCase()) onCommit?.(clean)
  }

  if (editing) {
    return (
      <input
        type="text"
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
        }}
        style={{ fontSize: `${fontSizePx}px` }}
        className="w-full bg-white text-slate-950 font-black uppercase border border-sky-500 rounded px-1.5 py-0.5 outline-none"
      />
    )
  }

  return (
    <div
      onDoubleClick={start}
      style={{ fontSize: `${fontSizePx}px` }}
      title="Doble clic para editar el título del trabajo"
      className="font-black uppercase text-slate-950 cursor-text hover:bg-sky-50/80 rounded px-1 py-0.5"
    >
      {value || 'TRABAJO TABULADO'}
    </div>
  )
}

/**
 * Bloque de cobro por ítem individual (modo `ITEMS` · Imagen 1):
 * - 1 solo número de Item a la izquierda y 1 tarjeta de costos a la derecha.
 * - Cada sub-ítem alinea horizontalmente su CANT., CONCEPTO, US$ UNIT., TOTAL e IVA (EX / 21%).
 */
export default function BillingLineItemsBlock({
  block,
  itemIndex,
  isCompact = false,
  onCommitLineItems,
  onCommitHeading
}) {
  const fontSizePx = Math.max(10, Math.min(14, Number(block.fontSizePx) || 12))
  const heading = extractBlockHeadingText(block.billing_description || '', 'TRABAJO')
  const items = normalizeBillingLineItems(block.billing_line_items)

  const patchItem = (idx, patch) => {
    const next = items.map((it, i) => (i === idx ? { ...it, ...patch } : it))
    onCommitLineItems?.(block, next)
  }

  const removeItem = (idx) => {
    const next = items.filter((_, i) => i !== idx)
    onCommitLineItems?.(block, next)
  }

  const addItem = () => {
    const next = [
      ...items,
      {
        id: `sub_${Date.now()}_${items.length + 1}`,
        text: '',
        qty: 1,
        unit_price_usd: 0,
        tax_type: block.billing_mo_tax === 'GRAVADO_21' ? 'GRAVADO_21' : 'EXENTO',
        is_note: false
      }
    ]
    onCommitLineItems?.(block, next)
  }

  return (
    <div className="bg-white text-slate-950 border-x border-slate-400 border-b border-b-slate-300 group/items">
      {/* Cabecera del bloque: Grip + Nº Item + Título en negrita */}
      <div className={`${SHEET_COLS} items-stretch`}>
        <div
          className={`flex items-start justify-center ${isCompact ? 'pt-1' : 'pt-1.5'} text-slate-400 hover:text-slate-800 border-r border-slate-200 cursor-grab active:cursor-grabbing`}
          title="Arrastrar para reordenar bloque + venta + costos"
        >
          <GripVertical className="w-3.5 h-3.5" />
        </div>
        <div className={`${isCompact ? 'pt-1' : 'pt-1.5'} text-center text-[11px] font-mono text-slate-600 border-r border-slate-300`}>
          {itemIndex}
        </div>
        <div className="border-r border-slate-300" />
        <div className={`px-2 ${isCompact ? 'pt-0.5' : 'pt-1'} border-r border-slate-300`}>
          <InlineHeadingCell
            value={heading}
            fontSizePx={fontSizePx}
            onCommit={(nextTitle) => onCommitHeading?.(block, nextTitle)}
          />
        </div>
        <div className="border-r border-slate-300" />
        <div className="border-r border-slate-300" />
        <div className="bg-rose-50/90" />
      </div>

      {/* Filas individuales alineadas 1-a-1 (CANT. | CONCEPTO | US$ UNIT. | TOTAL | IVA) */}
      {items.map((it, idx) => {
        const lineTotal = it.is_note
          ? 0
          : Number(((Number(it.qty) || 0) * (Number(it.unit_price_usd) || 0)).toFixed(2))
        const isLast = idx === items.length - 1

        return (
          <div
            key={it.id || `sub_${idx}`}
            className={`${SHEET_COLS} items-stretch group/subrow ${isLast ? '' : 'border-b border-slate-100'}`}
          >
            <div className="border-r border-slate-200" />
            <div className="border-r border-slate-300" />
            <div className={`px-1 ${isCompact ? 'py-0.5' : 'py-0.5'} border-r border-slate-300 flex items-center justify-end`}>
              {!it.is_note && (
                <InlineQtyCell
                  value={it.qty}
                  onCommit={(v) => patchItem(idx, { qty: v == null ? 0 : v })}
                />
              )}
            </div>
            <div className={`px-2 ${isCompact ? 'py-0.5' : 'py-0.5'} border-r border-slate-300 flex items-start justify-between gap-1`}>
              <div className="flex-1 min-w-0">
                <InlineLineTextCell
                  value={it.text}
                  isNote={it.is_note}
                  fontSizePx={fontSizePx}
                  compact={isCompact}
                  onCommit={(nextText) => patchItem(idx, { text: nextText })}
                />
              </div>
              <div className="opacity-0 group-hover/subrow:opacity-100 transition-opacity flex items-center gap-0.5 pt-0.5 shrink-0">
                <button
                  type="button"
                  onClick={() => patchItem(idx, { is_note: !it.is_note, qty: it.is_note ? 1 : null, unit_price_usd: it.is_note ? it.unit_price_usd : 0 })}
                  className="px-1 py-0.2 rounded text-[8px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
                  title={it.is_note ? 'Convertir nota en ítem cobrable' : 'Marcar renglón como nota sin importe'}
                >
                  {it.is_note ? 'Ítem' : 'Nota'}
                </button>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItem(idx)}
                    className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                    title="Quitar este sub-ítem"
                  >
                    <Trash2 className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="px-1 py-0.5 border-r border-slate-300 flex items-center justify-end text-[11px]">
              {!it.is_note && (
                <InlineNumberCell
                  value={it.unit_price_usd}
                  placeholder="Unit."
                  onCommit={(v) => patchItem(idx, { unit_price_usd: v })}
                />
              )}
            </div>
            <div className="px-1 py-0.5 border-r border-slate-300 flex items-center justify-end text-[11px] font-bold">
              {!it.is_note && (Number(it.unit_price_usd) !== 0 || lineTotal !== 0) ? (
                <div className="text-right tabular-nums px-1 text-slate-950">{formatMoneyClean(lineTotal)}</div>
              ) : null}
            </div>
            <div className="bg-rose-50/90 px-0.5 py-0.5 flex items-center justify-center">
              {!it.is_note ? (
                <button
                  type="button"
                  onClick={() => patchItem(idx, { tax_type: it.tax_type === 'GRAVADO_21' ? 'EXENTO' : 'GRAVADO_21' })}
                  className={`w-full py-0.5 rounded text-[9px] font-black cursor-pointer ${
                    it.tax_type === 'GRAVADO_21'
                      ? 'bg-rose-600 text-white'
                      : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  }`}
                  title="Alternar Exento / IVA 21% en este renglón"
                >
                  {it.tax_type === 'GRAVADO_21' ? '21%' : 'EX'}
                </button>
              ) : (
                <span className="text-[9px] text-slate-400">—</span>
              )}
            </div>
          </div>
        )
      })}

      {/* Pie liviano para sumar sub-ítem al vuelo */}
      <div className={`${SHEET_COLS} items-stretch`}>
        <div className="border-r border-slate-200" />
        <div className="border-r border-slate-300" />
        <div className="border-r border-slate-300" />
        <div className="px-2 pb-1 border-r border-slate-300">
          <button
            type="button"
            onClick={addItem}
            className="opacity-40 group-hover/items:opacity-100 transition-opacity inline-flex items-center gap-0.5 text-[9px] font-bold text-slate-500 hover:text-sky-700 cursor-pointer"
          >
            <Plus className="w-2.5 h-2.5" />
            <span>Agregar ítem individual</span>
          </button>
        </div>
        <div className="border-r border-slate-300" />
        <div className="border-r border-slate-300" />
        <div className="bg-rose-50/90" />
      </div>
    </div>
  )
}
