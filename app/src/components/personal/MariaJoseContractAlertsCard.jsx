import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Calendar, CheckCircle2, ArrowUpRight, AlertTriangle, Shield, Info } from 'lucide-react'
import { CONTRACT_TYPES, SAFETY_ITEMS_HELP_TEXT } from '../../lib/workCostRules.js'
import { resolveContractAlertService } from '../../lib/contractorDeductionsService.js'

/**
 * Bandeja compartida de Contratos de Personal Astillero próximos a vencerse (<= 7 días)
 * y guía rápida de imputación (Materiales / Consumibles / Elementos de Seguridad) para María José.
 */
export default function MariaJoseContractAlertsCard({
  alerts = [],
  user,
  userName,
  onResolved
}) {
  const [drafts, setDrafts] = useState({})
  const [resolvingId, setResolvingId] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const [showSafetyGuide, setShowSafetyGuide] = useState(false)

  const handleConfirmRenewal = async (al) => {
    const draft = drafts[al.id] || {}
    const nextType = draft.contract_type || 'PERMANENTE'
    const nextStart = draft.contract_start_date || new Date().toISOString().slice(0, 10)

    try {
      setResolvingId(al.id)
      setFeedback(null)
      const res = await resolveContractAlertService({
        alertItem: al,
        nextContractType: nextType,
        nextStartDate: nextStart,
        user,
        userName
      })
      setFeedback({ type: 'success', text: `Contrato actualizado a ${res.contract_type} y alerta resuelta.` })
      onResolved?.(al.id, res)
    } catch (err) {
      setFeedback({ type: 'error', text: err.message })
    } finally {
      setResolvingId(null)
    }
  }

  return (
    <div className={`rounded-2xl border p-5 shadow-xl space-y-3 ${
      alerts.length > 0
        ? 'bg-orange-950/20 border-orange-500/50'
        : 'bg-slate-900/60 border-slate-800'
    }`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
        <div>
          <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-orange-400" />
            Vencimiento de Contratos Astillero (7 días) — María José
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Personal propio con contrato temporal (1, 3 o 6 meses) próximo a vencer o vencido para definir renovación o pase a planta permanente.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setShowSafetyGuide((p) => !p)}
            className="px-2.5 py-1 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 text-cyan-300 border border-cyan-700/60 text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <Info className="w-3.5 h-3.5" />
            <span>{showSafetyGuide ? 'Ocultar Regla EPP/Costos' : 'Regla EPP & Costos'}</span>
          </button>
          <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${
            alerts.length > 0
              ? 'bg-orange-950 border-orange-500 text-orange-300'
              : 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300'
          }`}>
            {alerts.length} por vencer
          </span>
          <Link
            to="/personal"
            className="text-xs text-cyan-400 hover:text-cyan-300 font-bold inline-flex items-center gap-1"
          >
            <span>Ir a Personal</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>

      {showSafetyGuide && (
        <div className="p-3.5 rounded-xl bg-slate-950/90 border border-cyan-500/40 space-y-2 text-xs text-slate-300">
          <div className="font-black text-cyan-300 flex items-center gap-1.5 uppercase text-[11px]">
            <Shield className="w-4 h-4" />
            <span>Guía de Referencia para Liquidación y Costos (Materiales · Consumibles · Seguridad)</span>
          </div>
          <ul className="space-y-1 text-[11px] list-disc pl-4">
            <li><strong className="text-white">Materiales:</strong> Todo bien transformado en beneficio del buque se imputa siempre al Barco / Obra.</li>
            <li><strong className="text-white">Consumibles:</strong> Según acuerdo del contratista (% descuento al contratista en Tesorería vs resto al Barco).</li>
            <li><strong className="text-amber-300">Elementos de Seguridad (EPP):</strong> {SAFETY_ITEMS_HELP_TEXT}</li>
          </ul>
        </div>
      )}

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

      {alerts.length === 0 ? (
        <div className="p-3 rounded-xl border border-dashed border-slate-800 text-xs text-slate-400 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Al día: sin contratos temporales próximos a vencerse en los próximos 7 días.</span>
        </div>
      ) : (
        <div className="space-y-2">
          {alerts.map((al) => {
            const draft = drafts[al.id] || {}
            const isBusy = resolvingId === al.id
            return (
              <div
                key={al.id}
                className="p-3 rounded-xl bg-slate-950/80 border border-orange-500/30 flex flex-col lg:flex-row lg:items-center justify-between gap-3"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-black px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-700">
                      {al.workers?.name || 'Operario Astillero'}
                    </span>
                    <span className="text-[10px] font-mono text-slate-500">
                      {al.workers?.contract_type || 'Contrato'} · Inicio: {al.workers?.contract_start_date || '—'}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white">{al.alert_message}</div>
                </div>

                <div className="flex items-center gap-2 shrink-0 flex-wrap">
                  <select
                    value={draft.contract_type || 'PERMANENTE'}
                    onChange={(e) => setDrafts((prev) => ({
                      ...prev,
                      [al.id]: { ...prev[al.id], contract_type: e.target.value }
                    }))}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-bold"
                  >
                    {CONTRACT_TYPES.map((ct) => (
                      <option key={ct.value} value={ct.value}>{ct.value}</option>
                    ))}
                  </select>
                  <input
                    type="date"
                    value={draft.contract_start_date || new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setDrafts((prev) => ({
                      ...prev,
                      [al.id]: { ...prev[al.id], contract_start_date: e.target.value }
                    }))}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white font-mono"
                  />
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleConfirmRenewal(al)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black cursor-pointer disabled:opacity-50"
                  >
                    {isBusy ? 'Guardando...' : 'Renovar / Resolver'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
