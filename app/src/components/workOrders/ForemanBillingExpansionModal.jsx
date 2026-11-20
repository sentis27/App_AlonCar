import { useState } from 'react'
import { Megaphone, X, Send, CheckCircle2 } from 'lucide-react'
import { resolveBillingExpansionService } from '../../lib/billingWorkflowService.js'

function htmlToPlain(raw = '') {
  return String(raw || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
}

/**
 * Modal rápido en `/ots` para que el Jefe de Obra o el Administrador respondan
 * las solicitudes de Ampliación de Información de Gerencia editando únicamente `billing_description`.
 */
export default function ForemanBillingExpansionModal({
  isOpen,
  onClose,
  requestedOrders = [],
  userName = 'Jefe de Obra',
  onResolved
}) {
  const [drafts, setDrafts] = useState({})
  const [savingId, setSavingId] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')

  if (!isOpen) return null

  const handleSave = async (wo) => {
    const val = drafts[wo.id] !== undefined ? drafts[wo.id] : htmlToPlain(wo.billing_description)
    if (!String(val || '').trim()) {
      setErrorMsg('Completá el detalle comercial antes de enviar a Gerencia.')
      return
    }
    try {
      setSavingId(wo.id)
      setErrorMsg('')
      await resolveBillingExpansionService({
        wo,
        billingDescription: val.replace(/\n/g, '<br/>'),
        user: userName
      })
      onResolved?.(wo)
    } catch (err) {
      setErrorMsg(err.message)
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="alon-modal-card max-w-4xl max-h-[88vh] w-full flex flex-col">
        <div className="alon-modal-header px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-orange-500/20 border border-orange-400/40 text-orange-300 flex items-center justify-center">
              <Megaphone className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white">
                Ampliación de Información Comercial solicitada por Gerencia ({requestedOrders.length})
              </h3>
              <p className="text-[11px] text-slate-400">
                Se guarda directo en <code>billing_description</code> para cobro sin modificar la descripción operativa del taller.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="alon-modal-body p-4 space-y-3 overflow-y-auto">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-950/80 border border-rose-500/50 text-rose-200 text-xs font-bold">
              {errorMsg}
            </div>
          )}

          {requestedOrders.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-xs flex flex-col items-center gap-2">
              <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              <span>No hay solicitudes de ampliación pendientes para resolver.</span>
            </div>
          ) : (
            requestedOrders.map((wo) => {
              const val = drafts[wo.id] !== undefined ? drafts[wo.id] : htmlToPlain(wo.billing_description)
              return (
                <div key={wo.id} className="p-3.5 rounded-xl bg-slate-950 border border-orange-500/40 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700 text-[10px] font-black">
                        {wo.ships?.name || 'Buque'}
                      </span>
                      <span className="font-black text-white">{wo.ot_number || 'OT'} · {wo.title}</span>
                      <span className="px-2 py-0.5 rounded bg-amber-950/70 text-amber-200 border border-amber-600/50 text-[10px] font-bold">
                        Jefe: {wo.foreman_name || 'Asignado'}
                      </span>
                    </div>
                  </div>
                  {wo.foreman_review_note && (
                    <p className="text-[11px] text-orange-200 bg-orange-950/30 border border-orange-500/25 rounded-lg px-2.5 py-1.5">
                      <strong>Indicación Gerencia:</strong> {wo.foreman_review_note}
                    </p>
                  )}
                  <textarea
                    rows={4}
                    value={val}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [wo.id]: e.target.value }))}
                    placeholder="Escribí aquí el detalle comercial ampliado para la factura..."
                    className="w-full bg-slate-900 border border-orange-500/50 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      disabled={savingId === wo.id}
                      onClick={() => handleSave(wo)}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>{savingId === wo.id ? 'Guardando...' : 'Guardar y Enviar a Gerencia'}</span>
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <div className="alon-modal-footer px-5 py-3 flex justify-end">
          <button type="button" onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold cursor-pointer">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
