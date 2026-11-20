import React, { useState } from 'react'
import { Plus } from 'lucide-react'
import { formatUsd } from '../../lib/drydockCatalogConstants'
import { PAIRED_GRID_CLASS as PAIRED_GRID, SHEET_COLS_CLASS as SHEET_COLS, formatMoneyClean } from '../../lib/billingSheetMath'

export function InlineNumberCell({ value, placeholder = '0,00', onCommit }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const start = () => { setDraft(value == null ? '' : String(value)); setEditing(true) }
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
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className="w-full bg-white text-slate-950 border border-sky-500 rounded px-1 py-0.5 text-right text-[11px] font-mono font-bold outline-none"
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
  const start = () => { setDraft(value == null ? '' : String(value)); setEditing(true) }
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
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commit()}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false) }}
        className="w-full bg-white text-slate-950 border border-sky-500 rounded px-1 py-0.5 text-right text-[10px] font-mono font-bold outline-none"
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

export function BillingSheetPageHeader({ ship, owner, budgetNumber, onChangeBudgetNumber, summary, pageIdx, grandTotal }) {
  const [editingBudget, setEditingBudget] = useState(false)
  const [budgetDraft, setBudgetDraft] = useState(budgetNumber || '')
  const todayFormatted = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className={PAIRED_GRID}>
      <div className="bg-white text-slate-950 rounded-t-lg border border-b-0 border-slate-400 overflow-hidden shadow-sm">
        <div className="p-3 border-b-2 border-slate-900 space-y-1.5">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-xs font-black tracking-tight text-slate-900">⚓ ASTILLERO VANOLI · ALON CAR S.A.</div>
              <div className="text-xs mt-1"><span className="text-slate-600">Señores: </span><strong className="uppercase">{owner?.name || ship?.client_name || 'ARMADOR / CLIENTE'}</strong></div>
              <div className="text-[11px] text-slate-600">mail: <span>{owner?.email_principal || '—'}</span></div>
            </div>
            <div className="text-right space-y-1">
              <div className="text-[11px] text-slate-700">Necochea, {todayFormatted}</div>
              <div className="inline-flex items-center gap-1 border-b border-slate-900 pb-0.5 text-xs font-bold">
                <span>Presupuesto Nº:</span>
                {editingBudget ? (
                  <input
                    type="text"
                    autoFocus
                    value={budgetDraft}
                    onChange={(e) => setBudgetDraft(e.target.value)}
                    onBlur={() => { setEditingBudget(false); onChangeBudgetNumber?.(budgetDraft) }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { setEditingBudget(false); onChangeBudgetNumber?.(budgetDraft) } }}
                    className="w-20 bg-white border border-sky-500 rounded px-1 text-xs font-mono"
                  />
                ) : (
                  <button type="button" onClick={() => { setBudgetDraft(budgetNumber || ''); setEditingBudget(true) }} className="font-mono hover:bg-sky-100 px-1 rounded cursor-text">
                    {budgetNumber || 'S/N'}
                  </button>
                )}
              </div>
              <div>
                <span className="inline-block bg-slate-300 text-slate-950 px-2.5 py-0.5 text-[11px] font-black tracking-wide">
                  HOJA {summary.pageNumber}/{summary.totalPages}
                </span>
              </div>
            </div>
          </div>
          {pageIdx === 0 && (
            <div className="pt-1.5 border-t border-slate-300 text-[11px] flex flex-wrap gap-x-4 gap-y-0.5 bg-slate-50 px-2 py-1 rounded">
              <span><strong>CARACTERÍSTICAS:</strong> Buque: <strong className="uppercase">{ship?.name}</strong></span>
              <span>Matr.: <strong>{ship?.matricula || '—'}</strong></span>
              <span>Eslora: <strong>{ship?.eslora_mts ? `${ship.eslora_mts}m` : '—'}</strong></span>
              <span>Manga: <strong>{ship?.manga_mts ? `${ship.manga_mts}m` : '—'}</strong></span>
              <span>Puntal: <strong>{ship?.puntal_mts ? `${ship.puntal_mts}m` : '—'}</strong></span>
            </div>
          )}
        </div>
        <div className={`${SHEET_COLS} bg-slate-100 border-b-2 border-slate-900 text-[10px] font-black uppercase text-slate-800 text-center`}>
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

      <div className="flex flex-col justify-end pb-1">
        {pageIdx === 0 && (
          <div className="grid grid-cols-2 rounded-lg overflow-hidden border border-slate-600 bg-slate-950 text-center shadow-md">
            <div className="border-r border-slate-700">
              <div className="bg-slate-800 px-2 py-1 text-[9px] font-black uppercase text-slate-300">COSTO OP. TOTAL</div>
              <div className="px-2 py-1.5 text-sm font-black text-white tabular-nums">{formatUsd(grandTotal?.operationalCostUsd || 0)}</div>
            </div>
            <div>
              <div className="bg-emerald-950/80 px-2 py-1 text-[9px] font-black uppercase text-emerald-300">MARGEN REAL</div>
              <div className={`px-2 py-1.5 text-xs font-black tabular-nums ${(grandTotal?.margenRealUsd || 0) >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {(grandTotal?.margenRealUsd || 0) >= 0 ? '+' : ''}{formatUsd(grandTotal?.margenRealUsd || 0, 0)} ({grandTotal?.margenPct || 0}%)
              </div>
            </div>
          </div>
        )}
      </div>
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
