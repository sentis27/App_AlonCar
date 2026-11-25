import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileSpreadsheet, CheckCircle2, ArrowUpRight, AlertTriangle } from 'lucide-react'
import { extractBudgetDigits } from '../../lib/workOrdersConstants.js'
import { resolvePendingBudgetAlertService } from '../../lib/workOrdersService.js'
import { resolveShipRemitoBudgetAlertService } from '../../lib/billingWorkflowService.js'
import { formatDateAr } from '../../lib/dateTimeCanonical.js'

/**
 * Bandeja compartida de Alertas de Presupuestos para María José (Facturación):
 * 1. Remitos de barcos abiertos para facturar sin Nº de Presupuesto (`remitoAlerts`).
 * 2. Trabajos "Adicional / Específico" cuyo Nº de Presupuesto quedó PENDIENTE (`alerts`).
 */
export default function MariaJoseBudgetAlertsCard({
  alerts = [],
  remitoAlerts = [],
  user,
  userName,
  onResolved
}) {
  const [draftNumbers, setDraftNumbers] = useState({})
  const [resolvingId, setResolvingId] = useState(null)
  const [feedback, setFeedback] = useState(null)

  const totalPending = remitoAlerts.length + alerts.length

  const clearDraft = (id) => {
    setDraftNumbers((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }

  const handleConfirmRemitoBudget = async (al) => {
    const clean = String(draftNumbers[al.id] || '').trim()
    if (!clean) {
      setFeedback({ type: 'error', text: 'Ingresá un Nº de Presupuesto válido (ej. 733/26).' })
      return
    }
    try {
      setResolvingId(al.id)
      setFeedback(null)
      const res = await resolveShipRemitoBudgetAlertService({
        shipId: al.ship_id,
        shipName: al.ships?.name || '',
        budgetNumber: clean,
        user,
        userName
      })
      clearDraft(al.id)
      setFeedback({ type: 'success', text: `Asignado ${res.formatted} al remito de ${al.ships?.name || 'Buque'}.` })
      onResolved?.(al.id, res)
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    } finally {
      setResolvingId(null)
    }
  }

  const handleConfirmBudgetNumber = async (alertItem) => {
    const digits = extractBudgetDigits(draftNumbers[alertItem.id] || '')
    if (!digits) {
      setFeedback({ type: 'error', text: 'Ingresá un número de presupuesto válido (solo dígitos).' })
      return
    }
    try {
      setResolvingId(alertItem.id)
      setFeedback(null)
      const res = await resolvePendingBudgetAlertService({
        alertItem,
        budgetNumber: digits,
        user,
        userName
      })
      clearDraft(alertItem.id)
      setFeedback({ type: 'success', text: `Asignado ${res.formatted} y alerta resuelta.` })
      onResolved?.(alertItem.id, res)
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    } finally {
      setResolvingId(null)
    }
  }

  return (
    <div className={`rounded-2xl border p-5 shadow-xl space-y-3 ${
      totalPending > 0
        ? 'bg-amber-950/20 border-amber-500/50'
        : 'bg-slate-900/60 border-slate-800'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-amber-400" />
            Alertas de Nº de Presupuesto — María José
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Remitos abiertos para facturar y trabajos adicionales que esperan asignación de <strong>Nº de Presupuesto</strong>.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
            totalPending > 0
              ? 'bg-amber-950 border-amber-600 text-amber-300'
              : 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
          }`}>
            {totalPending} pendiente(s)
          </span>
          <Link to="/resumen-gerencial?tab=remito" className="text-xs text-emerald-400 hover:text-emerald-300 font-bold inline-flex items-center gap-1">
            <span>Ir a Remito</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
          <Link to="/ots" className="text-xs text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-1">
            <span>Ir a OTs</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {feedback && (
        <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
          feedback.type === 'error'
            ? 'bg-rose-950/80 border-rose-500/50 text-rose-200'
            : 'bg-emerald-950/80 border-emerald-500/50 text-emerald-200'
        }`}>
          {feedback.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {totalPending === 0 ? (
        <div className="p-3 rounded-xl border border-dashed border-slate-800 text-xs text-slate-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Al día: no hay remitos ni trabajos adicionales esperando Nº de Presupuesto.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {remitoAlerts.map((al) => (
            <div
              key={al.id}
              className="p-3 rounded-xl bg-slate-950/80 border border-amber-400/50 flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600">
                    REMITO P/ FACTURAR
                  </span>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700">
                    {al.ships?.name || 'Buque'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {al.created_at ? formatDateAr(al.created_at) : 'Hoy'}
                  </span>
                </div>
                <div className="text-xs font-semibold text-white truncate" title={al.alert_message}>
                  {al.alert_message}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center bg-slate-900 border border-amber-500/50 rounded-lg overflow-hidden">
                  <span className="px-2 py-1.5 bg-amber-950/60 border-r border-amber-500/30 text-[10px] font-mono font-black text-amber-300 select-none">
                    Nº
                  </span>
                  <input
                    type="text"
                    value={draftNumbers[al.id] || ''}
                    onChange={(e) => setDraftNumbers((prev) => ({ ...prev, [al.id]: e.target.value }))}
                    placeholder="Ej: 733/26"
                    className="w-24 bg-transparent px-2 py-1 text-xs text-white font-mono font-bold focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={resolvingId === al.id}
                  onClick={() => handleConfirmRemitoBudget(al)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs cursor-pointer transition-colors"
                >
                  {resolvingId === al.id ? 'Guardando...' : '✓ Cargar Nº'}
                </button>
              </div>
            </div>
          ))}

          {alerts.map((al) => (
            <div
              key={al.id}
              className="p-3 rounded-xl bg-slate-950/80 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-3"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-black px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700">
                    {al.ships?.name || 'Buque / Astillero'}
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">
                    {al.created_at ? formatDateAr(al.created_at) : 'Hoy'}
                  </span>
                </div>
                <div className="text-xs font-semibold text-white truncate" title={al.alert_message}>
                  {al.alert_message}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center bg-slate-900 border border-amber-500/50 rounded-lg overflow-hidden">
                  <span className="px-2 py-1.5 bg-amber-950/60 border-r border-amber-500/30 text-[10px] font-mono font-black text-amber-300 select-none">
                    PRESUP.
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={draftNumbers[al.id] || ''}
                    onChange={(e) => {
                      const val = extractBudgetDigits(e.target.value)
                      setDraftNumbers((prev) => ({ ...prev, [al.id]: val }))
                    }}
                    placeholder="Ej: 210"
                    className="w-24 bg-transparent px-2 py-1 text-xs text-white font-mono font-bold focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  disabled={resolvingId === al.id}
                  onClick={() => handleConfirmBudgetNumber(al)}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs cursor-pointer transition-colors"
                >
                  {resolvingId === al.id ? 'Guardando...' : '✓ Cargar Nº'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
