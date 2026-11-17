import { useState } from 'react'
import { Unlock, AlertTriangle, X, Ship, RotateCcw, Check } from 'lucide-react'

const REOPEN_TARGETS = [
  {
    value: 'En ejecución',
    label: 'En ejecución',
    description: 'Vuelve la OT y sus subtareas a estado activo operativo.',
    badgeClass: 'border-emerald-500/70 bg-emerald-950/50 text-emerald-200'
  },
  {
    value: 'Finalizado',
    label: 'Finalizado',
    description: 'Revierte solo la facturación; mantiene trabajos como finalizados (desbloqueados).',
    badgeClass: 'border-cyan-500/70 bg-cyan-950/50 text-cyan-200'
  },
  {
    value: 'Pendiente de inicio',
    label: 'Pendiente de inicio',
    description: 'Retrotrae la OT y sus trabajos a espera de inicio.',
    badgeClass: 'border-amber-500/70 bg-amber-950/50 text-amber-200'
  }
]

/**
 * ReopenWorkOrderModal
 *
 * Permite revertir de forma controlada y auditada una OT Facturada o Cerrada
 * (ej. corrección por error humano), desbloqueando la grilla y registrando motivo en audit_logs.
 */
export default function ReopenWorkOrderModal({
  isOpen,
  onClose,
  wo,
  items = [],
  onConfirm,
  loading = false
}) {
  const [targetStatus, setTargetStatus] = useState('En ejecución')
  const [reason, setReason] = useState('')
  const [modalError, setModalError] = useState(null)

  if (!isOpen || !wo) return null

  const activeItems = items.filter((it) => it.status !== 'Desestimado')
  const billedItems = activeItems.filter((it) => it.status === 'Facturado')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setModalError(null)
    if (typeof onConfirm === 'function') {
      try {
        await onConfirm({ targetStatus, reason })
      } catch (err) {
        setModalError(err.message || 'Error al reabrir Orden de Trabajo')
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-sans"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border-2 border-amber-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-950 border border-amber-600 flex items-center justify-center text-amber-400">
              <Unlock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Reabrir Orden de Trabajo Facturada</h3>
              <p className="text-[11px] text-slate-400">
                Revierte el bloqueo DEC-011 por error humano con registro en auditoría
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs">
          {modalError && (
            <div className="p-3 bg-rose-950/80 border border-rose-500 rounded-xl text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          <div className="p-3 rounded-xl bg-slate-950 border border-amber-500/30 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-black text-purple-300 px-2 py-0.5 rounded bg-purple-950 border border-purple-700">
                  {wo.ot_number || 'OT'}
                </span>
                <span className="text-white font-extrabold text-sm">{wo.title}</span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-400">
                <Ship className="w-3.5 h-3.5 text-cyan-400" />
                <span>Buque: <strong className="text-slate-200">{wo.ships?.name || 'Astillero'}</strong></span>
                <span className="text-slate-600">•</span>
                <span>Estado actual: <strong className="text-purple-300">{wo.status}</strong></span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Facturadas</span>
              <span className="text-sm font-black text-white">{billedItems.length} / {activeItems.length}</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold text-slate-300 uppercase tracking-wider block">
              Estado al que querés regresar la OT
            </label>
            <div className="space-y-1.5">
              {REOPEN_TARGETS.map((opt) => {
                const isSelected = targetStatus === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setTargetStatus(opt.value)}
                    className={`w-full p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-start justify-between gap-2 ${
                      isSelected
                        ? opt.badgeClass
                        : 'bg-slate-950/60 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div>
                      <span className="font-bold text-white block">{opt.label}</span>
                      <span className="text-[11px] text-slate-400">{opt.description}</span>
                    </div>
                    {isSelected && <Check className="w-4 h-4 shrink-0 mt-0.5" />}
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">
              Motivo de la reapertura (opcional, queda en auditoría)
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Se facturó por error, faltan cargar horas..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-amber-400 focus:outline-none"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-lg"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{loading ? 'Reabriendo...' : `Revertir a ${targetStatus}`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
