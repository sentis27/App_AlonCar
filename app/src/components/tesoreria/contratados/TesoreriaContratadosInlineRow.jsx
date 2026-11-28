/**
 * TesoreriaContratadosInlineRow.jsx
 * Fila de carga rápida in-situ (`+ Fila en Blanco`, fila de tabla sin envoltorio propio) para `3. Contratados`.
 * Pre-carga únicamente la fecha de hoy y permite guardar con Enter o cancelar con Esc.
 */
import React, { useState } from 'react'
import { Check, X } from 'lucide-react'
import { getTodayArIso } from '../../../lib/dateTimeCanonical'
import { RESUMEN_TAB_ID, GENERAL_SHIP_TAB_ID } from '../../../lib/contractorLedgerHelpers'
import { formatPrcNumberLabel } from '../../../lib/prcRegistryRules'

const INPUT_CLS = 'w-full bg-slate-950 border border-slate-700 focus:border-amber-400 rounded px-2 py-1 text-xs text-white focus:outline-none'

export default function TesoreriaContratadosInlineRow({
  activeTabId = RESUMEN_TAB_ID,
  activeTabLabel = 'RESUMEN',
  currency = 'ARS',
  ships = [],
  contractorPrcs = [],
  onSave,
  onCancel,
}) {
  const isResumen = activeTabId === RESUMEN_TAB_ID
  const fixedShipId = !isResumen && activeTabId !== GENERAL_SHIP_TAB_ID ? activeTabId : ''

  const [draft, setDraft] = useState({
    concept: '',
    entryDate: getTodayArIso(),
    paidAmount: '',
    accruedAmount: '',
    shipId: fixedShipId,
    prcId: '',
    invoiceNumber: '',
    observations: '',
  })
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const setField = (k, v) => setDraft((prev) => ({ ...prev, [k]: v }))

  const submit = async () => {
    if (saving) return
    setErr('')
    try {
      setSaving(true)
      await onSave?.(draft)
    } catch (e) {
      setErr(e?.message || 'Error al guardar fila')
      setSaving(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      submit()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel?.()
    }
  }

  return (
    <tr className="bg-amber-950/25 border-y-2 border-amber-400/60 align-top">
      <td className="py-2 px-2 text-center">
        <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500 text-slate-950 text-[9px] font-black">NUEVA</span>
      </td>

      <td className="py-2 px-2 space-y-1 min-w-[200px]">
        <input
          autoFocus
          type="text"
          value={draft.concept}
          onChange={(e) => setField('concept', e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ej: transferencia, ch 0664, rto pañol 1962..."
          className={INPUT_CLS}
        />
        {isResumen && currency === 'ARS' ? (
          <select
            value={draft.shipId}
            onChange={(e) => setField('shipId', e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-cyan-200 focus:outline-none"
          >
            <option value="">General / Sin barco</option>
            {ships.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        ) : (
          <div className="text-[10px] text-cyan-300 font-semibold">Barco: {activeTabLabel}</div>
        )}
        {err && <div className="text-[10px] text-rose-300 font-bold">{err}</div>}
      </td>

      <td className="py-2 px-2 whitespace-nowrap">
        <input
          type="date"
          value={draft.entryDate}
          onChange={(e) => setField('entryDate', e.target.value)}
          onKeyDown={onKeyDown}
          className={`${INPUT_CLS} font-mono w-[132px]`}
        />
      </td>

      <td className="py-2 px-2">
        <input
          type="number"
          step="0.01"
          min="0"
          value={draft.paidAmount}
          onChange={(e) => setField('paidAmount', e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={currency === 'USD' ? 'Pago US$' : 'Pago AR$'}
          className={`${INPUT_CLS} text-right font-mono text-emerald-300 font-bold`}
        />
      </td>

      <td className="py-2 px-2">
        {currency === 'USD' ? (
          <span className="text-[10px] text-slate-500 block text-right pt-1.5">Desde remitos</span>
        ) : (
          <input
            type="number"
            step="0.01"
            min="0"
            value={draft.accruedAmount}
            onChange={(e) => setField('accruedAmount', e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Devengado"
            className={`${INPUT_CLS} text-right font-mono text-amber-300 font-bold`}
          />
        )}
      </td>

      <td className="py-2 px-2 text-right font-mono text-[11px] text-slate-400 pt-3">Auto</td>

      <td className="py-2 px-2 space-y-1 min-w-[140px]">
        <input
          type="text"
          value={draft.invoiceNumber}
          onChange={(e) => setField('invoiceNumber', e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Nº Factura (opcional)"
          className={`${INPUT_CLS} font-mono`}
        />
        {currency === 'ARS' && contractorPrcs.length > 0 && (
          <select
            value={draft.prcId}
            onChange={(e) => setField('prcId', e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-amber-200 focus:outline-none"
          >
            <option value="">Sin PRC</option>
            {contractorPrcs.map((p) => (
              <option key={p.id} value={p.id}>{formatPrcNumberLabel(p.prc_number)} · {p.shipName || ''}</option>
            ))}
          </select>
        )}
      </td>

      <td className="py-2 px-2">
        <input
          type="text"
          value={draft.observations}
          onChange={(e) => setField('observations', e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Notas / aclaración..."
          className={INPUT_CLS}
        />
      </td>

      <td className="py-2 px-2 whitespace-nowrap text-right">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            disabled={saving}
            onClick={submit}
            title="Guardar fila (Enter)"
            className="p-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black cursor-pointer"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
          </button>
          <button
            type="button"
            onClick={onCancel}
            title="Cancelar (Esc)"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  )
}
