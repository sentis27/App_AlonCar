import { useState, useEffect } from 'react'
import { Brain, Save, Play, RotateCcw, KeyRound, Eye, EyeOff, ScrollText, Cpu } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  DEFAULT_SYSTEM_PROMPTS,
  loadAiProviderConfig,
  saveAiProviderConfig,
  loadSystemPrompts,
  saveSystemPrompt,
  loadAiProcessingLogs,
  tabulateCrewMessage
} from '../lib/aiLaborEngine'

const SAMPLE =
  'Luciano Tritón reguillas cuvierta protección de bacha y colocación de parrilla andres y diego soldadura parches trancalin don Antonio 9hr franco y enzo higinio subir portones y matafuego vuoso 2hr 2hr maniobra para prueba navegación  5 hr en don Antonio bodega sacar porurietano y comentando'

const bumpVersion = (v = 'v1.0') => {
  const m = String(v).match(/^v(\d+)\.(\d+)$/)
  return m ? `v${m[1]}.${parseInt(m[2], 10) + 1}` : 'v1.1'
}

/**
 * Tablero de Gobernanza IA: proveedor, prompts versionados, sandbox y auditoría.
 * Solo se monta desde /admin (AdminDashboard).
 */
export default function AiGovernancePanel() {
  const [config, setConfig] = useState(loadAiProviderConfig())
  const [showKey, setShowKey] = useState(false)
  const [prompts, setPrompts] = useState(DEFAULT_SYSTEM_PROMPTS)
  const [promptsSource, setPromptsSource] = useState('default')
  const [selectedSlug, setSelectedSlug] = useState(DEFAULT_SYSTEM_PROMPTS[0].slug)
  const [draft, setDraft] = useState(DEFAULT_SYSTEM_PROMPTS[0])
  const [logs, setLogs] = useState([])
  const [msg, setMsg] = useState(null)
  const [sandboxText, setSandboxText] = useState(SAMPLE)
  const [sandboxResult, setSandboxResult] = useState(null)
  const [running, setRunning] = useState(false)

  const flash = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 5000)
  }

  const reload = async () => {
    const res = await loadSystemPrompts()
    setPrompts(res.prompts)
    setPromptsSource(res.source)
    const current = res.prompts.find(p => p.slug === selectedSlug) || res.prompts[0]
    setDraft(current)
    setLogs(await loadAiProcessingLogs())
  }

  useEffect(() => {
    reload()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectPrompt = (slug) => {
    setSelectedSlug(slug)
    setDraft(prompts.find(p => p.slug === slug) || prompts[0])
  }

  const handleSaveConfig = () => {
    const { hasEnvKey: _h, ...toSave } = config
    saveAiProviderConfig(toSave)
    flash('success', 'Configuración del proveedor guardada.')
  }

  const handleSavePrompt = async () => {
    const next = { ...draft, version: bumpVersion(draft.version), updated_by: 'Administrador' }
    const res = await saveSystemPrompt(next)
    flash(
      res.syncedToDb ? 'success' : 'info',
      res.syncedToDb
        ? `Prompt guardado como ${next.version} en Supabase.`
        : `Prompt guardado localmente como ${next.version} (ejecutá la migración 0017 para sincronizar).`
    )
    await reload()
    setDraft(next)
  }

  const handleRestoreDefault = () => {
    const def = DEFAULT_SYSTEM_PROMPTS.find(p => p.slug === draft.slug)
    if (def) setDraft({ ...draft, prompt_template: def.prompt_template })
  }

  const handleSandbox = async () => {
    setRunning(true)
    setSandboxResult(null)
    try {
      const [w, s, wo, wi] = await Promise.all([
        supabase.from('workers').select('*'),
        supabase.from('ships').select('*'),
        supabase.from('work_orders').select('*'),
        supabase.from('work_items').select('*')
      ])
      const result = await tabulateCrewMessage(sandboxText, {
        workers: w.data || [],
        ships: s.data || [],
        workOrders: wo.data || [],
        workItems: wi.data || [],
        dateLogged: new Date().toISOString().slice(0, 10),
        userEmail: 'Administrador (sandbox)'
      })
      setSandboxResult(result)
      setLogs(await loadAiProcessingLogs())
    } catch (err) {
      setSandboxResult({ error: err.message })
    } finally {
      setRunning(false)
    }
  }

  const inputCls =
    'w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-primary'

  return (
    <div className="space-y-5">
      {msg && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold ${
            msg.type === 'success'
              ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
              : 'bg-blue-950/60 border-blue-800 text-blue-300'
          }`}
        >
          {msg.text}
        </div>
      )}

      {/* 1. PROVEEDOR */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h3 className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-2">
          <Cpu className="w-4 h-4" /> Proveedor de IA
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1">Modo</label>
            <select
              value={config.mode}
              onChange={(e) => setConfig({ ...config, mode: e.target.value })}
              className={inputCls}
            >
              <option value="hybrid">Híbrido (OpenAI + respaldo local)</option>
              <option value="openai">Solo OpenAI</option>
              <option value="local">Solo parser local (sin costo)</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1">Modelo</label>
            <select
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              className={inputCls}
            >
              <option value="gpt-4o-mini">gpt-4o-mini (recomendado)</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4.1-mini">gpt-4.1-mini</option>
            </select>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1">Temperatura</label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="1"
              value={config.temperature}
              onChange={(e) => setConfig({ ...config, temperature: parseFloat(e.target.value) || 0 })}
              className={inputCls}
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1 flex items-center gap-1">
              <KeyRound className="w-3 h-3" /> API Key
              {config.hasEnvKey && <span className="text-emerald-400">(.env.local activa)</span>}
            </label>
            <div className="flex gap-1">
              <input
                type={showKey ? 'text' : 'password'}
                value={config.apiKey || ''}
                onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
                className={inputCls}
                placeholder="sk-..."
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="px-2 rounded-xl bg-slate-800 text-slate-300 cursor-pointer"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
        <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={config.prioritizeTaskDivision !== false}
            onChange={(e) => setConfig({ ...config, prioritizeTaskDivision: e.target.checked })}
            className="accent-primary"
          />
          Priorizar división de tareas sobre consolidación (E5/E6)
        </label>
        <p className="text-[11px] text-amber-300/80">
          Buenas prácticas: la clave se guarda solo en este navegador y en <code>.env.local</code>. Para producción,
          mover la llamada a una Edge Function de Supabase para no exponer la clave en el cliente, y fijar un límite
          de gasto mensual en el panel de OpenAI.
        </p>
        <button
          type="button"
          onClick={handleSaveConfig}
          className="px-4 py-2 bg-primary text-slate-950 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
        >
          <Save className="w-3.5 h-3.5" /> Guardar proveedor
        </button>
      </section>

      {/* 2. PROMPTS */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-2">
            <Brain className="w-4 h-4" /> Prompts del Sistema (versionados)
          </h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
            Fuente: {promptsSource}
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {prompts.map(p => (
            <button
              key={p.slug}
              type="button"
              onClick={() => selectPrompt(p.slug)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer ${
                p.slug === selectedSlug
                  ? 'bg-primary text-slate-950 border-primary'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
              }`}
            >
              {p.title?.split(':')[0] || p.slug} · {p.version}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-slate-400">{draft.description}</p>
        <textarea
          rows={14}
          value={draft.prompt_template || ''}
          onChange={(e) => setDraft({ ...draft, prompt_template: e.target.value })}
          className={`${inputCls} font-mono leading-relaxed`}
        />
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleSavePrompt}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" /> Guardar nueva versión ({bumpVersion(draft.version)})
          </button>
          <button
            type="button"
            onClick={handleRestoreDefault}
            className="px-4 py-2 bg-slate-800 text-slate-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Restaurar original
          </button>
        </div>
      </section>

      {/* 3. SANDBOX */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-2">
          <Play className="w-4 h-4" /> Sandbox de Prueba (no guarda horas)
        </h3>
        <textarea
          rows={3}
          value={sandboxText}
          onChange={(e) => setSandboxText(e.target.value)}
          className={`${inputCls} font-mono`}
        />
        <button
          type="button"
          disabled={running}
          onClick={handleSandbox}
          className="px-4 py-2 bg-primary text-slate-950 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5" /> {running ? 'Procesando...' : 'Probar con prompts actuales'}
        </button>
        {sandboxResult && (
          <div className="space-y-2">
            {sandboxResult.error ? (
              <div className="text-xs text-rose-300">Error: {sandboxResult.error}</div>
            ) : (
              <>
                <div className="text-[11px] text-slate-300 font-mono">
                  Motor: {sandboxResult.engineUsed} · Prompt {sandboxResult.promptVersion} · Tokens{' '}
                  {sandboxResult.tokensIn}/{sandboxResult.tokensOut}
                  {sandboxResult.llmError ? ` · Fallback: ${sandboxResult.llmError}` : ''}
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px] text-left">
                    <thead className="text-slate-400">
                      <tr>
                        <th className="p-1.5">Operario</th>
                        <th className="p-1.5">Rubro</th>
                        <th className="p-1.5">Hs</th>
                        <th className="p-1.5">Tarea</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-200">
                      {(sandboxResult.rows || []).map(r => (
                        <tr key={r.id} className="border-t border-slate-800">
                          <td className="p-1.5">{r.worker_name || r.worker_raw}</td>
                          <td className="p-1.5">{r.rubro}</td>
                          <td className="p-1.5">{r.hours_normal}</td>
                          <td className="p-1.5">{r.notes}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      {/* 4. AUDITORIA */}
      <section className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 space-y-3">
        <h3 className="text-xs uppercase tracking-wider font-bold text-primary flex items-center gap-2">
          <ScrollText className="w-4 h-4" /> Auditoría de Ejecuciones (LOG_PROCESAMIENTO)
        </h3>
        {logs.length === 0 ? (
          <p className="text-xs text-slate-500">Aún no hay ejecuciones registradas.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[11px] text-left">
              <thead className="text-slate-400">
                <tr>
                  <th className="p-1.5">Fecha</th>
                  <th className="p-1.5">Usuario</th>
                  <th className="p-1.5">Motor</th>
                  <th className="p-1.5">Prompt</th>
                  <th className="p-1.5">Filas</th>
                  <th className="p-1.5">Revisar</th>
                  <th className="p-1.5">Tokens</th>
                </tr>
              </thead>
              <tbody className="text-slate-200">
                {logs.map((l, i) => (
                  <tr key={l.id || i} className="border-t border-slate-800">
                    <td className="p-1.5">
                      {new Date(l.fecha_procesamiento || l.created_at).toLocaleString('es-AR')}
                    </td>
                    <td className="p-1.5">{l.usuario_emisor}</td>
                    <td className="p-1.5">{l.engine_used}</td>
                    <td className="p-1.5">{l.prompt_version}</td>
                    <td className="p-1.5">{l.total_filas}</td>
                    <td className="p-1.5">{l.filas_review}</td>
                    <td className="p-1.5">
                      {l.tokens_in}/{l.tokens_out}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
