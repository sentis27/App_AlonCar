import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { formatUsd } from '../../lib/drydockCatalogConstants'
import { PAIRED_GRID_CLASS as PAIRED_GRID, SHEET_COLS_CLASS as SHEET_COLS, formatMoneyClean } from '../../lib/billingSheetMath'
import { ALONCAR_AV_LOGO_SVG, formatLongSpanishDate, getTodayIsoDate } from '../../lib/aloncarLogoSvg'
import BillingSimpleHoverHint from './BillingSimpleHoverHint'

const BUDGET_MARIA_JOSE_HINT = (
  <div>
    El Nº de Presupuesto lo coloca <strong>Facturación (María José)</strong>. Al abrir un barco en el remito sin número asignado, se genera automáticamente una alerta en el Dashboard hasta que se coloque.
  </div>
)

export function InlineNumberCell({ value, placeholder = '0,00', onCommit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const start = () => {
    const num = Number(value)
    setDraft(value == null || !Number.isFinite(num) || num === 0 ? '' : String(value))
    setEditing(true)
  }
  const commit = () => {
    setEditing(false)
    const parsed = draft.trim() === '' ? 0 : Number(draft.replace(',', '.'))
    if (Number.isFinite(parsed) && parsed !== Number(value || 0)) onCommit?.(parsed)
  }
  if (editing) {
    return (
      <input
        type="text"
        inputMode="decimal"
        autoFocus
        placeholder={placeholder}
        value={draft}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className="w-full bg-white text-slate-950 border border-sky-500 rounded px-1 py-0.5 text-right text-[11px] font-mono font-bold outline-none placeholder:text-slate-300"
      />
    )
  }
  return (
    <button type="button" onClick={start} onDoubleClick={start} title="Clic o doble clic para editar importe" className="w-full text-right tabular-nums cursor-text hover:bg-sky-100 rounded px-1 py-0.5">
      {value != null && Number(value) !== 0 ? formatMoneyClean(value) : <span className="text-slate-400">{placeholder}</span>}
    </button>
  )
}

export function InlineQtyCell({ value, isKgMode = false, onCommit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const start = () => {
    const num = Number(value)
    setDraft(value == null || !Number.isFinite(num) || num === 0 ? '' : String(value))
    setEditing(true)
  }
  const commit = () => {
    setEditing(false)
    if (draft.trim() === '') { onCommit?.(null); return }
    const parsed = Number(draft.replace(',', '.'))
    if (Number.isFinite(parsed)) onCommit?.(parsed)
  }
  if (editing) {
    return (
      <input
        type="text"
        inputMode="decimal"
        autoFocus
        placeholder="0"
        value={draft}
        onFocus={(e) => e.target.select()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className="w-full bg-white text-slate-950 border border-sky-500 rounded px-1 py-0.5 text-right text-[10px] font-mono font-bold outline-none placeholder:text-slate-300"
      />
    )
  }
  const num = Number(value)
  const hasVal = value != null && Number.isFinite(num) && num !== 0
  return (
    <button type="button" onDoubleClick={start} title={isKgMode ? 'KG de la OT (Doble clic edita)' : 'Doble clic para editar cantidad'} className={`w-full text-right text-[11px] font-mono tabular-nums cursor-text hover:bg-sky-100 rounded px-0.5 ${isKgMode ? 'text-sky-900 font-bold' : 'text-slate-800'}`}>
      {hasVal ? num.toLocaleString('es-AR', { maximumFractionDigits: 1 }) : ''}
    </button>
  )
}

export function BillingSheetPageHeader({ ship, owner, budgetNumber, issueDate, onChangeBudgetNumber, onChangeIssueDate, summary, pageIdx }) {
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState(budgetNumber || '')
  const [editingDate, setEditingDate] = useState(false)
  const [dateDraft, setDateDraft] = useState(issueDate || getTodayIsoDate())
  const commitBudget = () => { setEditingBudget(false); onChangeBudgetNumber?.(budgetDraft) }
  const commitDate = () => { setEditingDate(false); if (dateDraft) onChangeIssueDate?.(dateDraft) }

  return (
    <div className={PAIRED_GRID}>
      <div className="bg-white text-slate-950 rounded-t-lg border border-b-0 border-slate-400 overflow-hidden shadow-sm">
        {/* Membrete Estandarizado Oficial (Imagen 2): Logo (AV) arriba a la izquierda + Recuadro Negro */}
        <div className="p-3 pb-2.5 grid grid-cols-[112px_minmax(0,1fr)] gap-2.5 items-start">
          <div className="flex flex-col items-center text-center pt-0.5 select-none">
            <div
              className="w-14 h-14 mb-1"
              dangerouslySetInnerHTML={{ __html: ALONCAR_AV_LOGO_SVG }}
            />
            <div className="text-[9px] font-black leading-tight tracking-tight text-slate-950 uppercase">
              ASTILLERO VANOLI
              <br />
              ALON CAR S.A.
            </div>
          </div>

          <div className="border-2 border-slate-900 text-[11px] leading-snug">
            {/* Fila superior: Señores / mail + Necochea, Fecha */}
            <div className="px-2.5 pt-2 pb-1.5 flex items-start justify-between gap-2">
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-800 shrink-0">Señores:</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 font-black uppercase text-xs text-slate-950 truncate">
                    {owner?.name || ship?.client_name || 'ARMADOR / CLIENTE'}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 pl-8">
                  <span className="text-slate-700 text-[10px] shrink-0">mail:</span>
                  <span className="bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-800 min-w-[120px] truncate">
                    {owner?.email_principal || '—'}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0 text-[11px] text-slate-900">
                <span>Necochea,&nbsp;&nbsp;</span>
                {editingDate ? (
                  <input
                    type="date"
                    autoFocus
                    value={dateDraft}
                    onChange={(e) => setDateDraft(e.target.value)}
                    onBlur={() => commitDate()}
                    onKeyDown={(e) => { if (e.key === 'Enter') commitDate(); if (e.key === 'Escape') setEditingDate(false) }}
                    className="bg-white border border-sky-500 rounded px-1 py-0.5 text-[11px] font-mono"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => { setDateDraft(issueDate || getTodayIsoDate()); setEditingDate(true) }}
                    title="Clic para cambiar la fecha de impresión del presupuesto"
                    className="hover:bg-sky-100 rounded px-1 cursor-text font-medium"
                  >
                    {formatLongSpanishDate(issueDate)}
                  </button>
                )}
              </div>
            </div>

            {/* Franja intermedia: doble línea izquierda + Presupuesto Nº subrayado a la derecha */}
            <div className="grid grid-cols-[1fr_auto] items-center border-t-2 border-slate-900 pr-2 gap-3">
              <div className="border-b-2 border-slate-900 h-5" />
              <BillingSimpleHoverHint side="bottom-end" content={BUDGET_MARIA_JOSE_HINT}>
                <div className="inline-flex items-center gap-1 border-b border-slate-900 pb-0.5 text-[11px] font-bold">
                  <span>Presupuesto Nº:</span>
                  {editingBudget ? (
                    <input
                      type="text"
                      autoFocus
                      value={budgetDraft}
                      onChange={(e) => setBudgetDraft(e.target.value)}
                      onBlur={() => commitBudget()}
                      onKeyDown={(e) => { if (e.key === 'Enter') commitBudget(); if (e.key === 'Escape') setEditingBudget(false) }}
                      placeholder="Ej: 733/26"
                      className="w-20 bg-white border border-sky-500 rounded px-1 text-xs font-mono"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setBudgetDraft(budgetNumber || ''); setEditingBudget(true) }}
                      className={`font-mono hover:bg-sky-100 px-1 rounded cursor-text ${budgetNumber ? 'text-slate-950' : 'text-slate-600'}`}
                    >
                      {budgetNumber || 'PENDIENTE'}
                    </button>
                  )}
                </div>
              </BillingSimpleHoverHint>
            </div>

            {/* Fila saludo formal + casillero gris HOJA X/N */}
            <div className="pl-2.5 flex items-start justify-between gap-2 pt-1">
              <div className="text-[10.5px] text-slate-900 leading-snug">
                {pageIdx === 0 && (
                  <>
                    <div>De nuestra consideración:</div>
                    <div className="pl-4">
                      Por la presente tenemos el agrado de dirigirnos a uds. A efectos de entregarles el sig. presupuesto
                    </div>
                  </>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <span className="bg-slate-300 text-slate-950 px-2.5 py-0.5 text-[10.5px] font-black tracking-wide">
                  HOJA {summary.pageNumber}/{summary.totalPages}
                </span>
              </div>
            </div>

            {/* Bloque CARACTERÍSTICAS (solo Hoja 1, idéntico a Imagen 2) */}
            {pageIdx === 0 && (
              <div className="px-2.5 pt-2 pb-1.5 text-[10.5px] text-slate-950 space-y-0.5">
                <div className="font-bold">CARACTERÍSTICAS:</div>
                <div className="grid grid-cols-[1.35fr_1fr] gap-2">
                  <div>
                    <span>Nombre del buque:&nbsp;&nbsp;</span>
                    <strong className="uppercase">{ship?.name || '—'}</strong>
                  </div>
                  <div>
                    <span>Matr.:&nbsp;</span>
                    <strong>{ship?.matricula || ''}</strong>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pl-4">
                  <div><span>Eslora:&nbsp;</span><strong>{ship?.eslora_mts ? `${ship.eslora_mts} m` : ''}</strong></div>
                  <div><span>Manga:&nbsp;</span><strong>{ship?.manga_mts ? `${ship.manga_mts} m` : ''}</strong></div>
                  <div><span>Puntal:&nbsp;</span><strong>{ship?.puntal_mts ? `${ship.puntal_mts} m` : ''}</strong></div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Cabecera de columnas de la tabla */}
        <div className={`${SHEET_COLS} bg-slate-100 border-y-2 border-slate-900 text-[10px] font-black uppercase text-slate-800 text-center`}>
          <div className="py-1.5 border-r border-slate-300" title="Arrastrar fila completa (bloque + venta + costos)">⋮⋮</div>
          <div className="py-1.5 border-r border-slate-400">Item</div>
          <div className="py-1.5 border-r border-slate-400">CANT.</div>
          <div className="py-1.5 border-r border-slate-400 text-left px-2">Concepto (Doble clic edita en prosa)</div>
          <div className="py-1.5 border-r border-slate-400">US$ UNIT.</div>
          <div className="py-1.5 border-r border-slate-400">TOTAL</div>
          <div className="py-1.5 bg-rose-100 text-rose-900" title="Columna vinculante Exento / IVA 21%">IVA</div>
        </div>
      </div>

      <div className="hidden xl:block bg-rose-600 rounded-t-full" />
      <div />
    </div>
  )
}

export function BillingSheetPageFooter({ summary, isLastPage, onAddFreeBlock }) {
  return (
    <div className={PAIRED_GRID}>
      <div className="bg-white text-slate-950 rounded-b-lg border border-t-0 border-slate-400 overflow-hidden shadow-md">
        {isLastPage && (
          <div onDoubleClick={() => onAddFreeBlock?.()} className="py-4 px-4 text-center border-t border-dashed border-slate-300 bg-slate-50/40 hover:bg-sky-50/60 cursor-pointer transition-colors">
            <button type="button" onClick={() => onAddFreeBlock?.()} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-sky-700 cursor-pointer">
              <Plus className="w-3.5 h-3.5" />
              <span>Doble clic aquí para escribir un nuevo bloque en prosa debajo</span>
            </button>
          </div>
        )}
        <div className="border-t-2 border-slate-900 bg-white">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_210px] divide-y sm:divide-y-0 sm:divide-x divide-slate-900 text-[10px]">
            <div className="p-2 flex flex-col justify-between min-h-[74px]">
              <span className="font-bold text-slate-700 uppercase text-[9px]">FIRMA DE QUIEN REALIZA EL PRESUPUESTO</span>
              <div className="text-center font-black text-slate-900 pt-2">HUGO C. OBREGOZO<br /><span className="font-semibold text-[9px]">ING. NAVAL · MAT. C.P.742</span></div>
            </div>
            <div className="p-2 flex flex-col justify-between min-h-[74px]">
              <span className="font-bold text-slate-700 uppercase text-[9px]">FIRMA ACEPTACIÓN DEL PRESUPUESTO</span>
            </div>
            <div className="divide-y divide-slate-300 font-mono text-[11px]">
              <div className="px-2 py-1 flex justify-between"><span className="font-sans font-semibold text-slate-700">Exento:</span><strong>{formatUsd(summary.exentoUsd)}</strong></div>
              <div className="px-2 py-1 flex justify-between"><span className="font-sans font-semibold text-slate-700">Gravado:</span><strong>{formatUsd(summary.gravadoUsd)}</strong></div>
              <div className="px-2 py-1 flex justify-between"><span className="font-sans font-semibold text-slate-700">I.V.A. (21%):</span><strong>{formatUsd(summary.ivaUsd)}</strong></div>
              <div className="px-2 py-1 flex justify-between bg-slate-100 font-black text-slate-950"><span className="font-sans">TOTAL</span><span className="underline">{formatUsd(summary.totalUsd)}</span></div>
            </div>
          </div>
          <div className="px-3 py-1 bg-slate-50 border-t border-slate-300 text-center text-[9px] text-slate-600">
            Domicilio 546 Nro 600 (7631) Quequén, Bs. As. · Telef 02262-452181 · Email: facturacion@aloncar.com.ar
          </div>
        </div>
      </div>
      <div className="hidden xl:block bg-rose-600 rounded-b-full" />
      <div />
    </div>
  )
}
