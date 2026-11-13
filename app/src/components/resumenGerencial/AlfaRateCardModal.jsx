import React, { useState } from 'react'
import { X, Lock, Save, RotateCcw } from 'lucide-react'
import { DEFAULT_DRYDOCK_RATE_CARD_ALFA, formatUsd } from '../../lib/drydockCatalogConstants'

/**
 * Modal modular para inspeccionar y ajustar el Tarifario Base Nivel Alfa (`drydock_rate_card_alfa`).
 * Cada edición guarda en `system_settings` y registra historial en `audit_logs` via callback.
 */
export default function AlfaRateCardModal({
  isOpen,
  onClose,
  rateCard = [],
  onSaveRateItem
}) {
  const [editingCode, setEditingCode] = useState(null)
  const [priceDraft, setPriceDraft] = useState('')
  const [savingCode, setSavingCode] = useState(null)

  if (!isOpen) return null

  const startEdit = (item) => {
    setEditingCode(item.code)
    setPriceDraft(String(item.unit_price_usd ?? 0))
  }

  const commitRateEdit = async (item) => {
    if (editingCode !== item.code) return
    const nextPrice = Math.max(0, Number(priceDraft) || 0)
    const oldPrice = Number(item.unit_price_usd || 0)
    setEditingCode(null)

    if (nextPrice === oldPrice) return

    setSavingCode(item.code)
    try {
      const nextRates = rateCard.map((r) =>
        r.code === item.code ? { ...r, unit_price_usd: nextPrice } : r
      )
      await onSaveRateItem({
        nextRates,
        changedCode: item.code,
        oldPrice,
        newPrice: nextPrice
      })
    } finally {
      setSavingCode(null)
    }
  }

  const handleRestoreDefaults = async () => {
    setSavingCode('ALL')
    try {
      await onSaveRateItem({
        nextRates: DEFAULT_DRYDOCK_RATE_CARD_ALFA,
        changedCode: 'RESTORE_DEFAULTS',
        oldPrice: 'Custom',
        newPrice: 'Tarifario Base Nivel Alfa'
      })
    } finally {
      setSavingCode(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-emerald-500/40 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <div>
              <h3 className="text-sm font-extrabold text-white">
                Tarifario Comercial Nivel Alfa (`drydock_rate_card_alfa`)
              </h3>
              <p className="text-[11px] text-slate-400">
                Base oficial GS-012. Todo ajuste de precio queda auditado en `audit_logs`.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleRestoreDefaults}
              disabled={savingCode === 'ALL'}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Restaurar Base Alfa
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="sticky top-0 bg-slate-950 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-3 py-2">Código</th>
                <th className="px-3 py-2">Rubro</th>
                <th className="px-3 py-2">Concepto</th>
                <th className="px-3 py-2">Unidad</th>
                <th className="px-3 py-2">IVA</th>
                <th className="px-3 py-2 text-right">Tarifa US$ ✎</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {rateCard.map((item) => {
                const isEditing = editingCode === item.code
                return (
                  <tr key={item.code} className="hover:bg-slate-800/40 text-slate-200">
                    <td className="px-3 py-2 font-mono font-bold text-emerald-300">{item.code}</td>
                    <td className="px-3 py-2 text-slate-400 text-[11px]">{item.rubro}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-white">{item.concept}</div>
                      {item.surchargeNote && (
                        <div className="text-[10px] text-slate-400">{item.surchargeNote}</div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-300">{item.unit}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          item.tax_type === 'EXENTO'
                            ? 'bg-emerald-500/15 text-emerald-300'
                            : 'bg-cyan-500/15 text-cyan-300'
                        }`}
                      >
                        {item.tax_type === 'EXENTO' ? 'EXENTO' : '21%'}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {isEditing ? (
                        <div className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            autoFocus
                            value={priceDraft}
                            onChange={(e) => setPriceDraft(e.target.value)}
                            onBlur={() => commitRateEdit(item)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') commitRateEdit(item)
                              if (e.key === 'Escape') setEditingCode(null)
                            }}
                            className="w-24 bg-slate-950 border border-emerald-400 rounded px-2 py-0.5 text-right text-emerald-200 font-bold outline-none"
                          />
                          <Save className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          disabled={savingCode === item.code}
                          className="px-2 py-0.5 rounded bg-slate-950 border border-slate-700 hover:border-emerald-400 font-bold text-emerald-300 cursor-pointer"
                          title="Clic para ajustar tarifa base Nivel Alfa"
                        >
                          {savingCode === item.code
                            ? 'Guardando...'
                            : formatUsd(item.unit_price_usd)}
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
