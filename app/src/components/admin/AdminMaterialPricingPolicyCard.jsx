import { useState, useEffect, useCallback } from 'react'
import { Lock, Save, RotateCcw, ShieldCheck, CheckCircle2, AlertCircle, HelpCircle } from 'lucide-react'
import { useAuth } from '../../context/AuthContext.jsx'
import { DEFAULT_MATERIAL_PRICING_POLICY } from '../../lib/materialPricingPolicy.js'
import {
  fetchMaterialPricingPolicyService,
  saveMaterialPricingPolicyService,
  countPendingHistoricalSnapshotsService,
  sealPendingHistoricalFortnightSnapshotsService
} from '../../services/materialPricingService.js'
import { formatDateTimeAr } from '../../lib/dateTimeCanonical.js'
import { SECURITY_FACTORS } from '../../lib/unitMeasureUtils.js'

/**
 * AdminMaterialPricingPolicyCard
 * Panel editable de la Regla de Negocio de Precios y Costos de Materiales (Congelamiento Quincenal).
 * Vive dentro de Panel Administrador -> Variables Macro & Cierre (`system_settings.material_pricing_policy`).
 */
export default function AdminMaterialPricingPolicyCard() {
  const { profile, user } = useAuth()
  const [policy, setPolicy] = useState({ ...DEFAULT_MATERIAL_PRICING_POLICY })
  const [meta, setMeta] = useState({ updatedAt: null, updatedBy: null, isDefault: true })
  const [pendingSeal, setPendingSeal] = useState({ pendingCount: 0, currentPeriod: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sealing, setSealing] = useState(false)
  const [feedback, setFeedback] = useState(null)

  const flash = (type, text) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 5000)
  }

  const loadPolicyAndPending = useCallback(async () => {
    try {
      setLoading(true)
      const [polRes, sealRes] = await Promise.all([
        fetchMaterialPricingPolicyService(),
        countPendingHistoricalSnapshotsService()
      ])
      setPolicy(polRes.policy)
      setMeta({ updatedAt: polRes.updatedAt, updatedBy: polRes.updatedBy, isDefault: polRes.isDefault })
      setPendingSeal(sealRes)
    } catch (err) {
      flash('error', `Error cargando política de precios: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPolicyAndPending()
  }, [loadPolicyAndPending])

  const handleSave = async (e) => {
    e.preventDefault()
    try {
      setSaving(true)
      const saved = await saveMaterialPricingPolicyService({
        policy,
        updatedBy: profile?.full_name || user?.email || 'Administrador',
        user
      })
      setPolicy(saved.policy)
      setMeta({ updatedAt: saved.updatedAt, updatedBy: saved.updatedBy, isDefault: false })
      flash('success', 'Regla de precios y congelamiento quincenal guardada y auditada correctamente.')
    } catch (err) {
      flash('error', `No se pudo guardar la regla: ${err.message}`)
    } finally {
      setSaving(false)
    }
  }

  const handleSealHistorical = async () => {
    try {
      setSealing(true)
      const res = await sealPendingHistoricalFortnightSnapshotsService({ user })
      flash(
        'success',
        res.sealedCount > 0
          ? `Se sellaron ${res.sealedCount} retiro(s) de quincenas anteriores a ${res.currentPeriod} con el dólar y precio de su quincena.`
          : 'No había retiros históricos pendientes de sellar.'
      )
      await loadPolicyAndPending()
    } catch (err) {
      flash('error', `Error al sellar quincenas anteriores: ${err.message}`)
    } finally {
      setSealing(false)
    }
  }

  const inputCls =
    'w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400'

  return (
    <section className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-5 shadow-xl space-y-4 font-sans">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
        <div>
          <h2 className="text-sm uppercase tracking-wider font-extrabold text-white flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>Regla de Negocio · Precios y Costos de Materiales (Congelamiento Quincenal)</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Define cómo impactan los cambios de Dólar y Catálogo sobre los retiros de Pañol y alimenta el signo <strong className="text-cyan-300">(?)</strong> del Catálogo (solo Administrador).
          </p>
        </div>
        <span className="text-[10.5px] font-mono px-2.5 py-1 rounded-full bg-slate-950 border border-slate-700 text-slate-300 self-start sm:self-auto">
          {meta.isDefault
            ? 'Configuración por defecto'
            : `Actualizado: ${meta.updatedAt ? formatDateTimeAr(meta.updatedAt) : '—'} · ${meta.updatedBy || 'Admin'}`}
        </span>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded-xl border flex items-center gap-2 text-xs font-bold ${
            feedback.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300'
              : 'bg-rose-950/60 border-rose-700 text-rose-300'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {loading ? (
        <p className="text-xs text-slate-500 py-4">Cargando política de precios de materiales...</p>
      ) : (
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
            <div className="lg:col-span-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Criterio de Vigencia de Costos
              </label>
              <select
                value={policy.mode}
                onChange={(e) => setPolicy({ ...policy, mode: e.target.value })}
                className={`${inputCls} font-bold text-cyan-200`}
              >
                <option value="FORTNIGHT_LOCKED">Congelado por Quincena (Recomendado · Protege históricos)</option>
                <option value="LIVE_CATALOG">Catálogo en Vivo (Actualiza retroactivamente todos los períodos abiertos)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                % Seguridad Predeterminado
              </label>
              <select
                value={policy.defaultSecurityFactor}
                onChange={(e) => setPolicy({ ...policy, defaultSecurityFactor: Number(e.target.value) })}
                className={`${inputCls} font-mono font-bold text-emerald-300`}
              >
                {SECURITY_FACTORS.map((sf) => (
                  <option key={sf.value} value={sf.value}>{sf.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Umbral Alto Valor (US$ ➔ 2%)
              </label>
              <input
                type="number"
                min="100"
                step="100"
                value={policy.highValueThresholdUsd}
                onChange={(e) => setPolicy({ ...policy, highValueThresholdUsd: Math.max(0, Number(e.target.value) || 0) })}
                className={`${inputCls} font-mono font-bold text-amber-300`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
            <label className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer text-xs text-slate-200">
              <input
                type="checkbox"
                checked={policy.propagatePriceToCurrentFortnight}
                onChange={(e) => setPolicy({ ...policy, propagatePriceToCurrentFortnight: e.target.checked })}
                className="mt-0.5 accent-cyan-400"
              />
              <span>
                <strong className="text-white block">Propagar desde quincena en curso</strong>
                <span className="text-[11px] text-slate-400">Al subir un precio en Catálogo, actualiza retiros de la quincena actual en adelante.</span>
              </span>
            </label>

            <label className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer text-xs text-slate-200">
              <input
                type="checkbox"
                checked={policy.fillHistoricalZeroCostOnCatalogUpdate}
                onChange={(e) => setPolicy({ ...policy, fillHistoricalZeroCostOnCatalogUpdate: e.target.checked })}
                className="mt-0.5 accent-cyan-400"
              />
              <span>
                <strong className="text-white block">Completar históricos en $0</strong>
                <span className="text-[11px] text-slate-400">Si un retiro anterior quedó sin valor ($0), toma el precio cuando se cargue (si la quincena no está cerrada).</span>
              </span>
            </label>

            <label className="flex items-start gap-2 p-2.5 rounded-xl bg-slate-950/70 border border-slate-800 cursor-pointer text-xs text-slate-200">
              <input
                type="checkbox"
                checked={policy.respectLockedFortnights}
                onChange={(e) => setPolicy({ ...policy, respectLockedFortnights: e.target.checked })}
                className="mt-0.5 accent-cyan-400"
              />
              <span>
                <strong className="text-white block">Respetar candados de cierre</strong>
                <span className="text-[11px] text-slate-400">Jamás modifica costos en quincenas marcadas como CONGELADAS en la tabla inferior.</span>
              </span>
            </label>
          </div>

          <div>
            <div className="flex items-center justify-between gap-2 mb-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                <span>Leyenda breve del signo (?) en Catálogo de Stock (Solo Administrador)</span>
              </label>
              <button
                type="button"
                onClick={() => setPolicy({ ...policy, ruleSummaryText: DEFAULT_MATERIAL_PRICING_POLICY.ruleSummaryText })}
                className="text-[10.5px] text-slate-400 hover:text-cyan-300 inline-flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restaurar texto sugerido</span>
              </button>
            </div>
            <textarea
              rows={2}
              value={policy.ruleSummaryText}
              onChange={(e) => setPolicy({ ...policy, ruleSummaryText: e.target.value })}
              className={`${inputCls} leading-relaxed`}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-2">
              {pendingSeal.pendingCount > 0 ? (
                <button
                  type="button"
                  disabled={sealing}
                  onClick={handleSealHistorical}
                  className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/50 text-amber-200 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Congela con el dólar y precio vigente de su período los retiros de quincenas pasadas que todavía no tenían snapshot guardado"
                >
                  <Lock className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    {sealing
                      ? 'Sellando históricos...'
                      : `Sellar ${pendingSeal.pendingCount} retiro(s) previos a ${pendingSeal.currentPeriod}`}
                  </span>
                </button>
              ) : (
                <span className="text-[11px] text-emerald-400/90 font-semibold inline-flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Quincenas anteriores a {pendingSeal.currentPeriod || 'la actual'} protegidas y selladas.</span>
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-950/40 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{saving ? 'Guardando...' : 'Guardar Regla de Precios'}</span>
            </button>
          </div>
        </form>
      )}
    </section>
  )
}
