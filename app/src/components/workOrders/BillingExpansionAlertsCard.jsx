import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Megaphone, CheckCircle2, ArrowUpRight, AlertTriangle, Send, Check } from 'lucide-react'
import {
  resolveBillingExpansionService,
  acknowledgeResolvedExpansionService
} from '../../lib/billingWorkflowService.js'

function stripHtmlPreview(raw = '') {
  return String(raw || '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').trim()
}

/**
 * Bandeja bidireccional de Ampliación de Información Comercial (`billing_description`):
 * - Para Jefe de Obra + Administrador: KPI y editor directo sobre `billing_description` (nunca altera la OT operativa).
 * - Para Gerencia: KPI verde de Solicitudes Resueltas listas para facturar.
 */
export default function BillingExpansionAlertsCard({
  requested = [],
  resolved = [],
  userName = 'Usuario',
  onUpdated
}) {
  const [drafts, setDrafts] = useState({})
  const [busyId, setBusyId] = useState(null)
  const [feedback, setFeedback] = useState(null)

  const handleSendExpansion = async (wo) => {
    const textVal = drafts[wo.id] !== undefined ? drafts[wo.id] : stripHtmlPreview(wo.billing_description)
    if (!String(textVal || '').trim()) {
      setFeedback({ type: 'error', text: 'Escribí el detalle comercial ampliado antes de enviar.' })
      return
    }
    try {
      setBusyId(wo.id)
      setFeedback(null)
      await resolveBillingExpansionService({
        wo,
        billingDescription: textVal.replace(/\n/g, '<br/>'),
        user: userName
      })
      setFeedback({ type: 'success', text: `Detalle comercial de ${wo.ot_number || 'OT'} enviado a Gerencia.` })
      onUpdated?.()
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    } finally {
      setBusyId(null)
    }
  }

  const handleAcknowledge = async (wo) => {
    try {
      setBusyId(wo.id)
      await acknowledgeResolvedExpansionService({ wo, user: userName })
      onUpdated?.()
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    } finally {
      setBusyId(null)
    }
  }

  if (requested.length === 0 && resolved.length === 0) return null

  return (
    <div className="rounded-2xl border border-orange-500/45 bg-slate-900/75 p-5 shadow-xl space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Megaphone className="w-4 h-4 text-orange-400" />
            Ampliación de Información Comercial por Gerencia (Jefe de Obra + Admin ↔ Gerencia)
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Edita exclusivamente el texto comercial de cobro (<code className="text-orange-300">billing_description</code>), manteniendo intacta la descripción operativa de la OT.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-orange-950/80 border-orange-500/60 text-orange-200">
            📣 {requested.length} pendiente(s) Jefe/Admin
          </span>
          <span className="px-2.5 py-1 rounded-full text-xs font-bold border bg-emerald-950/80 border-emerald-500/60 text-emerald-200">
            ✅ {resolved.length} resuelta(s) p/ Gerencia
          </span>
          <Link to="/resumen-gerencial?tab=remito" className="text-xs text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-1">
            <span>Ir a Facturación</span>
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

      {requested.length > 0 && (
        <div className="space-y-2.5">
          <p className="text-[11px] font-black uppercase tracking-wider text-orange-300">
            🔔 Pendientes de Ampliar (Jefe de Obra & Administrador)
          </p>
          {requested.map((wo) => {
            const draftVal = drafts[wo.id] !== undefined ? drafts[wo.id] : stripHtmlPreview(wo.billing_description)
            return (
              <div key={wo.id} className="p-3.5 rounded-xl bg-slate-950/90 border border-orange-500/35 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700 text-[10px] font-black">
                      {wo.ships?.name || 'Buque'}
                    </span>
                    <span className="text-xs font-black text-white">
                      {wo.ot_number || 'OT'} · {wo.title}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-amber-950/70 text-amber-200 border border-amber-600/50 text-[10px] font-bold">
                      Jefe de Obra: {wo.foreman_name || 'Asignado'}
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Pedido por {wo.foreman_review_requested_by || 'Gerencia'}
                  </span>
                </div>
                {wo.foreman_review_note && (
                  <p className="text-[11px] text-orange-200/90 bg-orange-950/30 border border-orange-500/25 rounded-lg px-2.5 py-1.5">
                    <strong>Nota de Gerencia:</strong> {wo.foreman_review_note}
                  </p>
                )}
                <div className="flex flex-col md:flex-row gap-2">
                  <textarea
                    rows={3}
                    value={draftVal}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [wo.id]: e.target.value }))}
                    placeholder="Redactá el detalle comercial ampliado para el cliente..."
                    className="flex-1 bg-slate-900 border border-orange-500/50 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-400 focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={busyId === wo.id}
                    onClick={() => handleSendExpansion(wo)}
                    className="self-end md:self-stretch px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{busyId === wo.id ? 'Enviando...' : 'Resolver y Avisar a Gerencia'}</span>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {resolved.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-black uppercase tracking-wider text-emerald-300">
            ✅ Solicitudes Resueltas — Listas en Hoja de Facturación (Gerencia)
          </p>
          {resolved.map((wo) => (
            <div key={wo.id} className="p-3 rounded-xl bg-emerald-950/20 border border-emerald-500/40 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-600/60 text-[10px] font-black">
                    {wo.ships?.name || 'Buque'}
                  </span>
                  <span className="text-xs font-bold text-white">{wo.ot_number} · {wo.title}</span>
                  <span className="text-[10px] text-emerald-300/90">
                    Ampliado por {wo.foreman_review_resolved_by || wo.foreman_name || 'Jefe de Obra'}
                  </span>
                </div>
                <p className="text-xs text-slate-300 line-clamp-2 whitespace-pre-line">
                  {stripHtmlPreview(wo.billing_description)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Link
                  to="/resumen-gerencial?tab=remito"
                  className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs"
                >
                  Ver en Facturación
                </Link>
                <button
                  type="button"
                  disabled={busyId === wo.id}
                  onClick={() => handleAcknowledge(wo)}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-600 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                  title="Marcar notificación como revisada"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>OK</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
