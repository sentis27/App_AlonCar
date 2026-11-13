import { useState, useMemo } from 'react'
import { Flame, Check, X, RotateCcw, AlertTriangle, Package } from 'lucide-react'

/**
 * Modal de Devolución Final de cilindros vacíos desde Acciones en Control de Gases.
 * Lista únicamente los tubos que el contratista posee actualmente en su poder
 * (desglosados por Gas y Marca/Proveedor) y registra DEVOLUCION_FINAL sin generar gasto en Pañol.
 */
export function GasFinalReturnModal({
  isOpen,
  contractorName = '',
  contractorData = null,
  ships = [],
  onClose,
  onConfirm
}) {
  const activeHoldings = useMemo(() => contractorData?.activeHoldings || [], [contractorData])

  const [selectedByKey, setSelectedByKey] = useState(() => {
    if (activeHoldings.length === 1) {
      const only = activeHoldings[0]
      return { [only.key]: 1 }
    }
    return {}
  })
  const [shipId, setShipId] = useState('')
  const [movementDate, setMovementDate] = useState(() => new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen || !contractorName) return null

  const totalToReturn = Object.values(selectedByKey).reduce((acc, q) => acc + (Math.round(Number(q)) || 0), 0)

  const toggleHolding = (holding) => {
    setSelectedByKey((prev) => {
      const next = { ...prev }
      if (next[holding.key] > 0) {
        delete next[holding.key]
      } else {
        next[holding.key] = 1
      }
      return next
    })
  }

  const updateHoldingQty = (holding, rawVal) => {
    const num = Math.round(Number(rawVal) || 0)
    setSelectedByKey((prev) => {
      const next = { ...prev }
      if (num <= 0) {
        delete next[holding.key]
      } else {
        next[holding.key] = Math.min(holding.qty, num)
      }
      return next
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return

    const returns = activeHoldings
      .filter((h) => Number(selectedByKey[h.key]) > 0)
      .map((h) => ({
        materialId: h.materialId,
        supplierReturnedId: h.supplierId,
        quantity: Math.min(h.qty, Math.round(Number(selectedByKey[h.key]) || 0))
      }))

    if (returns.length === 0) {
      return alert('Seleccioná al menos un tubo en poder del contratista para registrar la devolución.')
    }

    try {
      setIsSubmitting(true)
      await onConfirm({
        contractorName,
        shipId: shipId || null,
        movementDate,
        notes,
        returns
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="alon-modal-card max-w-2xl">
        <div className="alon-modal-header">
          <div className="flex items-center gap-2 text-white font-black text-sm">
            <RotateCcw className="w-4 h-4 text-amber-400" />
            <div>
              <span className="block leading-tight">DEVOLUCIÓN FINAL DE TUBO VACÍO</span>
              <span className="text-[11px] font-normal text-slate-400 block">
                Contratista / Taller: <strong className="text-amber-300">{contractorName}</strong>
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-white cursor-pointer p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
          <div className="alon-modal-body space-y-3">
            <div className="p-2.5 rounded-xl bg-amber-950/25 border border-amber-500/40 text-amber-200 text-[11px] flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                <span>
                  Trámite de control: descuenta la deuda de envase del contratista y suma <strong>+1 vacío</strong> en patio (no genera gasto de obra en Pañol).
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-slate-950 border border-amber-500/50 text-amber-300 font-mono font-bold shrink-0">
                En poder: {contractorData?.totalHeld || 0}
              </span>
            </div>

            <div className="space-y-2">
              <label className="block text-slate-300 font-bold text-[11px]">
                Elegí qué tubo(s) está devolviendo vacío <span className="text-rose-400">*</span>
              </label>

              {activeHoldings.length === 0 ? (
                <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-center text-slate-400">
                  Este contratista no registra tubos pendientes de devolución en su poder.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {activeHoldings.map((h) => {
                    const selectedQty = Number(selectedByKey[h.key]) || 0
                    const isChecked = selectedQty > 0
                    return (
                      <div
                        key={h.key}
                        onClick={() => toggleHolding(h)}
                        className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isChecked
                            ? 'bg-emerald-950/30 border-emerald-500/70'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded border-slate-600 bg-slate-950 text-emerald-500 focus:ring-0 cursor-pointer"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-black text-white text-xs flex items-center gap-1">
                                <Package className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                                <span className="truncate">{h.materialName}</span>
                              </span>
                              <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-700/70 text-cyan-300 font-bold text-[10px]">
                                {h.supplierName}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-slate-400">
                              <span>
                                Cantidad en poder: <strong className="text-amber-300 font-mono">{h.qty}</strong>
                              </span>
                              {h.daysHeld > 15 ? (
                                <span className="inline-flex items-center gap-1 text-rose-300 font-bold">
                                  <AlertTriangle className="w-3 h-3 text-rose-400" />
                                  {h.daysHeld} días retenido
                                </span>
                              ) : (
                                <span>{h.daysHeld} días desde entrega</span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div
                          className="flex items-center gap-1.5 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <span className="text-[10px] text-slate-400 font-semibold">Devuelve:</span>
                          <input
                            type="number"
                            min="1"
                            max={h.qty}
                            step="1"
                            disabled={!isChecked}
                            value={isChecked ? selectedQty : ''}
                            placeholder="0"
                            onChange={(e) => updateHoldingQty(h, e.target.value)}
                            className="w-16 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-white font-mono text-center font-bold focus:outline-none focus:border-emerald-400 disabled:opacity-40"
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 pt-1">
              <div>
                <label className="block text-slate-300 font-bold text-[11px] mb-1">Fecha Devolución</label>
                <input
                  type="date"
                  value={movementDate}
                  onChange={(e) => setMovementDate(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>
              <div>
                <label className="block text-slate-300 font-bold text-[11px] mb-1">Buque (Opcional)</label>
                <select
                  value={shipId}
                  onChange={(e) => setShipId(e.target.value)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-semibold focus:outline-none focus:border-cyan-400"
                >
                  <option value="">General / Patio...</option>
                  {ships.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-slate-300 font-bold text-[11px] mb-1">Observaciones</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ej: Devuelto en mano..."
                  className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
          </div>

          <div className="alon-modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting || totalToReturn === 0}
              className="px-5 py-1.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-black flex items-center gap-1.5 cursor-pointer shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>
                {isSubmitting
                  ? 'Registrando...'
                  : `Confirmar Devolución Final (${totalToReturn} tubo${totalToReturn === 1 ? '' : 's'})`}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
