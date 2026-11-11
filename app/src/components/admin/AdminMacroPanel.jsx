import { useState, useEffect } from 'react'
import {
  DollarSign,
  Percent,
  Save,
  TrendingUp,
  Calendar,
  Pencil,
  Trash2,
  Lock,
  Unlock,
  CheckSquare,
  Square,
  CheckCircle2,
  AlertCircle,
  X
} from 'lucide-react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { assignMonotonicFolios } from '../../lib/monotonicFolioEngine.js'
import { saveMacroVariables } from '../../lib/macroVariablesService.js'

export const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function AdminMacroPanel() {
  const { profile, user } = useAuth()

  const [macroVariables, setMacroVariables] = useState([])
  const [ratePeriods, setRatePeriods] = useState([])
  const [loadingMacro, setLoadingMacro] = useState(true)
  const [macroForm, setMacroForm] = useState({
    year: 2026,
    month: 10,
    dollar_rate: 1500,
    monthly_inflation_pct: 3.2
  })
  const [savingMacro, setSavingMacro] = useState(false)
  const [isEditingMacro, setIsEditingMacro] = useState(false)
  const [macroEditTarget, setMacroEditTarget] = useState(null)
  const [message, setMessage] = useState(null)

  // Modal de edición completa de variables macro
  const [macroEditModal, setMacroEditModal] = useState({
    isOpen: false,
    id: null,
    year: 2026,
    month: 1,
    dollar_rate: 1500,
    dollar_rate_1q: 1500,
    dollar_rate_2q: 1500,
    monthly_inflation_pct: 0
  })

  // Modal de ajuste manual de dólar por quincena
  const [quincenaDollarModal, setQuincenaDollarModal] = useState({
    isOpen: false,
    period: '',
    year: 2026,
    month: 1,
    quincena: 1,
    dollar_rate: 1500
  })

  // Selección manual de quincenas (Checkboxes para borrado granular)
  const [selectedPeriods, setSelectedPeriods] = useState(new Set())

  useEffect(() => {
    loadMacroData()
  }, [])

  async function loadMacroData() {
    try {
      setLoadingMacro(true)
      const [macroRes, ratesRes] = await Promise.all([
        supabase.from('macro_variables').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
        supabase.from('rate_cards').select('period, year, month, quincena, dollar_rate, monthly_inflation_pct, is_locked, entity_name, admin_center').order('year', { ascending: false }).order('month', { ascending: false }).order('quincena', { ascending: false })
      ])

      const macroList = assignMonotonicFolios(macroRes.data || [], { dateField: 'created_at' })
      setMacroVariables(macroList)

      const ratesList = ratesRes.data || []
      
      // Construir mapa unificado de quincenas:
      const periodMap = new Map()

      // 1. Quincenas derivadas de cada mes cargado en macro_variables (1Q y 2Q)
      macroList.forEach(m => {
        const y = m.year
        const mo = m.month
        const moStr = String(mo).padStart(2, '0')
        const q1Key = `${y}-${moStr}-1Q`
        const q2Key = `${y}-${moStr}-2Q`

        const d1q = m.dollar_rate_1q ? parseFloat(m.dollar_rate_1q) : (parseFloat(m.dollar_rate) || 1500)
        const d2q = m.dollar_rate_2q ? parseFloat(m.dollar_rate_2q) : (parseFloat(m.dollar_rate) || 1500)
        const infPct = parseFloat(m.monthly_inflation_pct) || 0

        // 1Q
        const ratesQ1 = ratesList.filter(r => r.period === q1Key)
        const isLockedQ1 = m.is_locked_1q ?? (ratesQ1.length > 0 ? ratesQ1.every(r => r.is_locked) : false)
        periodMap.set(q1Key, {
          period: q1Key,
          year: y,
          month: mo,
          quincena: 1,
          dollar_rate: d1q,
          monthly_inflation_pct: infPct,
          is_locked: isLockedQ1,
          rates_count: ratesQ1.length,
          origin: 'macro'
        })

        // 2Q
        const ratesQ2 = ratesList.filter(r => r.period === q2Key)
        const isLockedQ2 = m.is_locked_2q ?? (ratesQ2.length > 0 ? ratesQ2.every(r => r.is_locked) : false)
        periodMap.set(q2Key, {
          period: q2Key,
          year: y,
          month: mo,
          quincena: 2,
          dollar_rate: d2q,
          monthly_inflation_pct: infPct,
          is_locked: isLockedQ2,
          rates_count: ratesQ2.length,
          origin: 'macro'
        })
      })

      // 2. Incluir cualquier período existente en rate_cards que no esté en macro_variables
      ratesList.forEach(r => {
        if (!periodMap.has(r.period)) {
          const ratesThisPeriod = ratesList.filter(x => x.period === r.period)
          periodMap.set(r.period, {
            period: r.period,
            year: r.year,
            month: r.month,
            quincena: r.quincena,
            dollar_rate: parseFloat(r.dollar_rate) || 1500,
            monthly_inflation_pct: parseFloat(r.monthly_inflation_pct) || 0,
            is_locked: Boolean(r.is_locked),
            rates_count: ratesThisPeriod.length,
            origin: 'rate_cards_legacy'
          })
        }
      })

      // Ordenar cronológico estricto para calcular variaciones: de más antiguo a más nuevo
      const chronological = Array.from(periodMap.values()).sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        if (a.month !== b.month) return a.month - b.month
        return a.quincena - b.quincena
      })

      // Calcular variación de Dólar e Inflación respecto al mes anterior para cada quincena
      const enrichedPeriods = chronological.map(p => {
        const prevYear = p.month === 1 ? p.year - 1 : p.year
        const prevMonth = p.month === 1 ? 12 : p.month - 1

        const prevMonthMacro = macroList.find(m => m.year === prevYear && m.month === prevMonth)
        let infDiff = null
        if (prevMonthMacro) {
          infDiff = p.monthly_inflation_pct - parseFloat(prevMonthMacro.monthly_inflation_pct)
        }

        const prevMonthSameQ = chronological.find(x => x.year === prevYear && x.month === prevMonth && x.quincena === p.quincena)
        const prevMonthAny = chronological.find(x => x.year === prevYear && x.month === prevMonth)
        const prevDollarTarget = prevMonthSameQ ? prevMonthSameQ.dollar_rate : (prevMonthAny ? prevMonthAny.dollar_rate : null)

        let dollarDiffPct = null
        if (prevDollarTarget && prevDollarTarget > 0) {
          dollarDiffPct = ((p.dollar_rate - prevDollarTarget) / prevDollarTarget) * 100
        }

        let intraDollarDiffPct = null
        if (p.quincena === 2) {
          const q1Period = chronological.find(x => x.year === p.year && x.month === p.month && x.quincena === 1)
          if (q1Period && q1Period.dollar_rate > 0) {
            intraDollarDiffPct = ((p.dollar_rate - q1Period.dollar_rate) / q1Period.dollar_rate) * 100
          }
        }

        return {
          ...p,
          infDiff,
          dollarDiffPct,
          intraDollarDiffPct
        }
      })

      enrichedPeriods.sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year
        if (a.month !== b.month) return b.month - a.month
        return b.quincena - a.quincena
      })

      setRatePeriods(enrichedPeriods)
    } catch (err) {
      console.error('Error cargando variables macro:', err)
    } finally {
      setLoadingMacro(false)
    }
  }

  // Guardar Dólar e Inflación Mensual desde el formulario superior
  async function handleSaveMacroSubmit(e) {
    e.preventDefault()
    try {
      setSavingMacro(true)
      const yr = parseInt(macroForm.year)
      const mo = parseInt(macroForm.month)
      const dRate = parseFloat(macroForm.dollar_rate) || 1500
      const infPct = parseFloat(macroForm.monthly_inflation_pct) || 0

      const { error: macroErr } = await supabase
        .from('macro_variables')
        .upsert({
          year: yr,
          month: mo,
          dollar_rate: dRate,
          dollar_rate_1q: dRate,
          dollar_rate_2q: dRate,
          monthly_inflation_pct: infPct,
          updated_by: profile?.full_name || user?.email || 'Administrador',
          updated_at: new Date().toISOString()
        }, { onConflict: 'year,month' })

      if (macroErr) throw macroErr

      await supabase
        .from('rate_cards')
        .update({
          dollar_rate: dRate,
          monthly_inflation_pct: infPct
        })
        .eq('year', yr)
        .eq('month', mo)

      setMessage({
        type: 'success',
        text: `Parámetros guardados: Dólar $${dRate.toLocaleString('es-AR')} e Inflación ${infPct}% para ${MONTH_NAMES[mo - 1]} ${yr}. Se aplicó a ambas quincenas (1Q y 2Q).`
      })
      setTimeout(() => setMessage(null), 5000)
      loadMacroData()
    } catch (err) {
      console.error('Error al guardar variables macro:', err)
      setMessage({ type: 'error', text: `Error al guardar: ${err.message}` })
    } finally {
      setSavingMacro(false)
    }
  }

  function handleCancelEditMacro() {
    setIsEditingMacro(false)
    setMacroEditTarget(null)
  }

  function handleOpenMacroModal(item) {
    const dBase = parseFloat(item.dollar_rate) || 1500
    setMacroEditModal({
      isOpen: true,
      id: item.id,
      year: item.year,
      month: item.month,
      dollar_rate: dBase,
      dollar_rate_1q: item.dollar_rate_1q ? parseFloat(item.dollar_rate_1q) : dBase,
      dollar_rate_2q: item.dollar_rate_2q ? parseFloat(item.dollar_rate_2q) : dBase,
      monthly_inflation_pct: parseFloat(item.monthly_inflation_pct) || 0
    })
  }

  async function handleSaveMacroModalSubmit(e) {
    e.preventDefault()
    try {
      setSavingMacro(true)
      const yr = parseInt(macroEditModal.year)
      const mo = parseInt(macroEditModal.month)
      const dBase = parseFloat(macroEditModal.dollar_rate) || 1500
      const d1q = parseFloat(macroEditModal.dollar_rate_1q) || dBase
      const d2q = parseFloat(macroEditModal.dollar_rate_2q) || dBase
      const infPct = parseFloat(macroEditModal.monthly_inflation_pct) || 0

      const previous = (macroVariables || []).find(m => m.year === yr && m.month === mo)

      await saveMacroVariables({
        year: yr,
        month: mo,
        dollar_rate: dBase,
        dollar_rate_1q: d1q,
        dollar_rate_2q: d2q,
        monthly_inflation_pct: infPct,
        updated_by: profile?.full_name || user?.email || 'Administrador',
        previousValues: previous ? {
          dollar_rate: previous.dollar_rate,
          dollar_rate_1q: previous.dollar_rate_1q,
          dollar_rate_2q: previous.dollar_rate_2q,
          monthly_inflation_pct: previous.monthly_inflation_pct
        } : null,
        user
      })

      setMessage({
        type: 'success',
        text: `Variables actualizadas y auditadas para ${MONTH_NAMES[mo - 1]} ${yr}: 1Q a $${d1q.toLocaleString('es-AR')}, 2Q a $${d2q.toLocaleString('es-AR')}, e Inflación ${infPct}%.`
      })
      setTimeout(() => setMessage(null), 5000)
      setMacroEditModal(prev => ({ ...prev, isOpen: false }))
      loadMacroData()
    } catch (err) {
      console.error('Error al guardar variables macro:', err)
      setMessage({ type: 'error', text: `Error al guardar: ${err.message}` })
    } finally {
      setSavingMacro(false)
    }
  }

  function handleOpenQuincenaDollar(p) {
    setQuincenaDollarModal({
      isOpen: true,
      period: p.period,
      year: p.year,
      month: p.month,
      quincena: p.quincena,
      dollar_rate: p.dollar_rate
    })
  }

  async function handleSaveQuincenaDollarSubmit(e) {
    e.preventDefault()
    try {
      const { period, year, month, quincena, dollar_rate } = quincenaDollarModal
      const newD = parseFloat(dollar_rate) || 1500

      const col = quincena === 1 ? 'dollar_rate_1q' : 'dollar_rate_2q'
      await supabase
        .from('macro_variables')
        .update({ [col]: newD, updated_at: new Date().toISOString() })
        .eq('year', year)
        .eq('month', month)

      await supabase
        .from('rate_cards')
        .update({ dollar_rate: newD })
        .eq('period', period)

      setMessage({
        type: 'success',
        text: `Dólar ajustado para la quincena ${period}: $${newD.toLocaleString('es-AR')}.`
      })
      setTimeout(() => setMessage(null), 4000)
      setQuincenaDollarModal(prev => ({ ...prev, isOpen: false }))
      loadMacroData()
    } catch (err) {
      console.error('Error al ajustar dólar quincenal:', err)
      setMessage({ type: 'error', text: `Error al ajustar: ${err.message}` })
    }
  }

  async function handleDeleteMacro(item) {
    const monthName = MONTH_NAMES[item.month - 1]
    if (!window.confirm(`¿Estás seguro de eliminar el registro macroeconómico de ${monthName} ${item.year}?`)) return
    try {
      const { error } = await supabase
        .from('macro_variables')
        .delete()
        .eq('id', item.id)

      if (error) throw error

      setMessage({
        type: 'info',
        text: `Se eliminó el registro de variables macro de ${monthName} ${item.year}.`
      })
      setTimeout(() => setMessage(null), 4000)
      loadMacroData()
    } catch (err) {
      console.error('Error eliminando macro:', err)
      setMessage({ type: 'error', text: `Error al eliminar: ${err.message}` })
    }
  }

  async function togglePeriodLock(periodItem) {
    const periodKey = periodItem.period
    const newLockState = !periodItem.is_locked

    setRatePeriods(prev => prev.map(p => p.period === periodKey ? { ...p, is_locked: newLockState } : p))

    try {
      const col = periodItem.quincena === 1 ? 'is_locked_1q' : 'is_locked_2q'
      await supabase
        .from('macro_variables')
        .update({ [col]: newLockState })
        .eq('year', periodItem.year)
        .eq('month', periodItem.month)

      await supabase
        .from('rate_cards')
        .update({ is_locked: newLockState })
        .eq('period', periodKey)

      setMessage({
        type: 'info',
        text: `Quincena ${periodKey} ${newLockState ? 'CONGELADA (Inmutable)' : 'DESBLOQUEADA (Abierta para edición)'}.`
      })
      setTimeout(() => setMessage(null), 3000)
    } catch (err) {
      console.error('Error al alternar bloqueo de quincena:', err)
      loadMacroData()
    }
  }

  function toggleSelectPeriod(periodKey) {
    setSelectedPeriods(prev => {
      const next = new Set(prev)
      if (next.has(periodKey)) next.delete(periodKey)
      else next.add(periodKey)
      return next
    })
  }

  function toggleSelectAllPeriods() {
    if (selectedPeriods.size === ratePeriods.length) {
      setSelectedPeriods(new Set())
    } else {
      setSelectedPeriods(new Set(ratePeriods.map(p => p.period)))
    }
  }

  async function handleDeleteSinglePeriod(p) {
    if (!window.confirm(`¿Confirmas eliminar las tarifas y registros de la quincena "${p.period}"?`)) return
    try {
      const { error } = await supabase
        .from('rate_cards')
        .delete()
        .eq('period', p.period)

      if (error) throw error

      setMessage({
        type: 'info',
        text: `Registros de la quincena ${p.period} eliminados.`
      })
      setTimeout(() => setMessage(null), 3000)
      loadMacroData()
    } catch (err) {
      console.error('Error eliminando quincena:', err)
      setMessage({ type: 'error', text: `Error al eliminar: ${err.message}` })
    }
  }

  async function handleDeleteSelectedPeriods() {
    const count = selectedPeriods.size
    if (count === 0) return
    if (!window.confirm(`¿Confirmas eliminar las ${count} quincenas seleccionadas y todas sus tarifas de mano de obra asociadas?`)) return
    try {
      const periodsArr = Array.from(selectedPeriods)

      const { error } = await supabase
        .from('rate_cards')
        .delete()
        .in('period', periodsArr)

      if (error) throw error

      setMessage({
        type: 'success',
        text: `Se eliminaron las tarifas de las ${count} quincenas seleccionadas.`
      })
      setTimeout(() => setMessage(null), 4000)
      setSelectedPeriods(new Set())
      loadMacroData()
    } catch (err) {
      console.error('Error eliminando quincenas seleccionadas:', err)
      setMessage({ type: 'error', text: `Error al eliminar seleccionados: ${err.message}` })
    }
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* MENSAJES DE ESTADO */}
      {message && (
        <div className={`p-4 rounded-xl border flex items-center gap-2.5 text-xs font-bold animate-in fade-in ${
          message.type === 'success' 
            ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300' 
            : message.type === 'info'
            ? 'bg-blue-950/60 border-blue-800 text-blue-300'
            : 'bg-rose-950/60 border-rose-800 text-rose-300'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Formulario de Carga y Fijación Mensual/Quincenal */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm uppercase tracking-wider font-extrabold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-emerald-400" />
              {isEditingMacro ? `Modificar Parámetros: ${macroEditTarget}` : 'Fijación Central de Dólar e Inflación Mensual'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Los valores aquí establecidos rigen automáticamente para la 1ª y 2ª quincena (1Q y 2Q) de ese mes en todo el sistema.
            </p>
          </div>

          {isEditingMacro && (
            <button
              type="button"
              onClick={handleCancelEditMacro}
              className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all border border-slate-700 self-start sm:self-auto cursor-pointer"
            >
              ✕ Cancelar Edición
            </button>
          )}
        </div>

        <form onSubmit={handleSaveMacroSubmit} className="alon-zone-entry grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Año
            </label>
            <select
              value={macroForm.year}
              onChange={(e) => setMacroForm({ ...macroForm, year: parseInt(e.target.value) })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-400"
            >
              {[2025, 2026, 2027].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
              Mes de Aplicación
            </label>
            <select
              value={macroForm.month}
              onChange={(e) => {
                const m = parseInt(e.target.value)
                const existing = macroVariables.find(v => v.year === macroForm.year && v.month === m)
                setMacroForm({
                  ...macroForm,
                  month: m,
                  dollar_rate: existing ? parseFloat(existing.dollar_rate) : macroForm.dollar_rate,
                  monthly_inflation_pct: existing ? parseFloat(existing.monthly_inflation_pct) : macroForm.monthly_inflation_pct
                })
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-400"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>{name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-emerald-400" /> Dólar Referencia (AR$/USD)
            </label>
            <input
              type="number"
              step="1"
              value={macroForm.dollar_rate}
              onChange={(e) => setMacroForm({ ...macroForm, dollar_rate: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-extrabold text-emerald-300 focus:outline-none focus:border-emerald-400"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1 flex items-center gap-1">
              <Percent className="w-3 h-3 text-amber-400" /> Inflación Mensual (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={macroForm.monthly_inflation_pct}
              onChange={(e) => setMacroForm({ ...macroForm, monthly_inflation_pct: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs font-mono font-extrabold text-amber-300 focus:outline-none focus:border-emerald-400"
              required
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={savingMacro}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-lg text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingMacro ? 'Guardando...' : isEditingMacro ? 'Guardar Cambios' : 'Aplicar a Quincenas'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* TABLA DE HISTORIAL MENSUAL DE VARIABLES MACROECONÓMICAS */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm uppercase tracking-wider font-extrabold text-white flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-400" />
              Historial Mensual de Parámetros Macro (Dólar & Inflación)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Registros cargados por mes. Cada fila rige para la 1ª y 2ª quincena (1Q y 2Q) de su respectivo mes.
            </p>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 border border-slate-700 self-start sm:self-auto font-bold">
            {macroVariables.length} {macroVariables.length === 1 ? 'mes registrado' : 'meses registrados'}
          </span>
        </div>

        <div className="overflow-y-auto max-h-[calc(100vh-280px)] border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="sticky top-0 z-20 alon-grid-thead">
              <tr>
                <th className="py-2.5 px-2 w-10 text-center font-bold text-slate-400 bg-slate-900 border-b border-r border-slate-750">#</th>
                <th className="py-2.5 px-3">Mes y Año</th>
                <th className="py-2.5 px-3 text-right">Dólar Referencia ($ / USD)</th>
                <th className="py-2.5 px-3 text-center">Inflación Mensual (%)</th>
                <th className="py-2.5 px-3 text-center">Quincenas que Rige</th>
                <th className="py-2.5 px-3">Registrado por</th>
                <th className="py-2.5 px-3 text-center">Fecha de Carga</th>
                <th className="py-2.5 px-3 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {macroVariables.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No hay variables macroeconómicas cargadas aún. Utiliza el formulario superior para crear la primera.
                  </td>
                </tr>
              ) : (
                macroVariables.map((item, idx) => {
                  const monthName = MONTH_NAMES[item.month - 1]
                  const q1Key = `${item.year}-${String(item.month).padStart(2, '0')}-1Q`
                  const q2Key = `${item.year}-${String(item.month).padStart(2, '0')}-2Q`
                  const updatedDate = item.updated_at ? new Date(item.updated_at).toLocaleDateString('es-AR', {
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  }) : '--'

                  return (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-2.5 px-2 w-10 text-center border-r border-slate-800/80 bg-slate-900/50 font-mono text-[11px] text-slate-500">
                        <button
                          type="button"
                          onClick={() => handleOpenMacroModal(item)}
                          className="hover:text-cyan-300 hover:bg-slate-800 px-1 py-0.5 rounded font-bold cursor-pointer transition-colors"
                          title={`Fila #${item._rowSeq || idx + 1} (DNI Inviolable) • Clic para editar parámetros`}
                        >
                          {item._rowSeq || idx + 1}
                        </button>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span className="font-extrabold text-white text-sm">
                            {monthName} {item.year}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-emerald-400 text-sm">
                        ${Number(item.dollar_rate).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-3 px-3 text-center font-mono font-bold text-amber-300">
                        <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 font-extrabold">
                          {Number(item.monthly_inflation_pct).toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-bold">
                            {q1Key}
                          </span>
                          <span className="text-slate-500 text-[10px]">&</span>
                          <span className="font-mono text-[10px] px-2 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-bold">
                            {q2Key}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-slate-300 text-xs">
                        <span className="font-semibold text-white">{item.updated_by || 'Administrador'}</span>
                      </td>
                      <td className="py-3 px-3 text-center text-slate-400 text-[11px] font-mono">
                        {updatedDate}
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenMacroModal(item)}
                            className="p-1.5 text-slate-400 hover:text-emerald-400 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                            title="Editar parámetros e inflacion de este mes"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMacro(item)}
                            className="p-1.5 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                            title="Eliminar registro"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TABLA DE QUINCENAS, VARIACIÓN RESPECTO AL MES ANTERIOR & CIERRE INMUTABLE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h2 className="text-sm uppercase tracking-wider font-extrabold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400" />
              Historial Quincenal & Control de Períodos Cerrados
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              El Dólar admite ajuste manual por quincena (1Q / 2Q) con su variación % respecto al mes anterior. La inflación es mensual y se hereda a ambas quincenas.
            </p>
          </div>

          {selectedPeriods.size > 0 && (
            <button
              type="button"
              onClick={handleDeleteSelectedPeriods}
              className="px-3.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition-all flex items-center gap-1.5 shadow-lg shadow-rose-950/40 cursor-pointer self-start sm:self-auto animate-in fade-in"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar ({selectedPeriods.size}) quincenas seleccionadas</span>
            </button>
          )}
        </div>

        <div className="overflow-y-auto max-h-[calc(100vh-280px)] border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="sticky top-0 z-20 alon-grid-thead">
              <tr>
                <th className="py-2.5 px-2 w-10 text-center font-bold text-slate-400 bg-slate-900 border-b border-r border-slate-750">
                  <div className="flex flex-col items-center justify-center gap-0.5">
                    <button
                      type="button"
                      onClick={toggleSelectAllPeriods}
                      className="text-slate-400 hover:text-cyan-300 transition-colors"
                      title="Seleccionar todas las quincenas"
                    >
                      {ratePeriods.length > 0 && selectedPeriods.size === ratePeriods.length ? (
                        <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                      ) : (
                        <Square className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <span className="text-[10px] text-slate-500 font-mono">#</span>
                  </div>
                </th>
                <th className="py-2.5 px-3">Quincena (Período)</th>
                <th className="py-2.5 px-3 text-right">Dólar Quincenal (AR$/USD)</th>
                <th className="py-2.5 px-3 text-center">Inflación Mensual</th>
                <th className="py-2.5 px-3 text-center">Tarifario de Mano de Obra</th>
                <th className="py-2.5 px-3 text-center">Estado del Período</th>
                <th className="py-2.5 px-3 text-right">Control de Cierre</th>
                <th className="py-2.5 px-3 text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-medium">
              {ratePeriods.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-slate-500">
                    No hay quincenas generadas en la base de datos.
                  </td>
                </tr>
              ) : (
                ratePeriods.map((p, pIdx) => {
                  const hasRates = p.rates_count > 0
                  const isSelected = selectedPeriods.has(p.period)

                  return (
                    <tr 
                      key={p.period} 
                      className={`hover:bg-slate-800/30 transition-colors ${isSelected ? 'bg-cyan-950/20' : ''}`}
                    >
                      <td className="py-2 px-2 w-10 text-center border-r border-slate-800/80 bg-slate-900/50">
                        <div className="flex flex-col items-center justify-center gap-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleSelectPeriod(p.period)
                            }}
                            className="text-slate-400 hover:text-cyan-300 transition-colors"
                            title={isSelected ? 'Deseleccionar quincena' : 'Seleccionar quincena'}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                            ) : (
                              <Square className="w-3.5 h-3.5" />
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleOpenQuincenaDollar(p)
                            }}
                            className={`text-[10px] font-mono px-1 py-0.5 rounded transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-cyan-950/60 text-cyan-300 font-bold border border-cyan-800'
                                : 'text-slate-500 hover:text-cyan-400 hover:bg-slate-800'
                            }`}
                            title={`Clic para ajustar cotización de dólar de ${p.period}`}
                          >
                            {pIdx + 1}
                          </button>
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-cyan-300 text-sm">
                        {p.period}
                        <span className="ml-2 text-[10px] font-normal text-slate-400 font-sans block sm:inline">
                          ({p.quincena === 1 ? '1ª Quincena' : '2ª Quincena'} de {MONTH_NAMES[p.month - 1]} {p.year})
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end gap-1.5 font-mono">
                          <span className="font-extrabold text-emerald-400 text-sm">
                            ${p.dollar_rate.toLocaleString('es-AR')}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleOpenQuincenaDollar(p)}
                            className="p-1 text-slate-400 hover:text-emerald-300 hover:bg-slate-800 rounded transition-colors cursor-pointer"
                            title={`Ajustar cotización de dólar para ${p.period}`}
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex items-center justify-end gap-1 mt-0.5 font-mono text-[10px]">
                          {p.dollarDiffPct !== null ? (
                            <span className={`px-1.5 py-0.2 rounded font-bold ${
                              p.dollarDiffPct > 0 
                                ? 'bg-amber-950 text-amber-300 border border-amber-800/60' 
                                : p.dollarDiffPct < 0 
                                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                : 'text-slate-500'
                            }`}>
                              {p.dollarDiffPct > 0 ? '+' : ''}{p.dollarDiffPct.toFixed(1)}% vs mes ant.
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[9px]">Base inicial</span>
                          )}

                          {p.intraDollarDiffPct !== null && Math.abs(p.intraDollarDiffPct) > 0.01 && (
                            <span className="text-[9px] text-cyan-400 ml-1">
                              ({p.intraDollarDiffPct > 0 ? '+' : ''}{p.intraDollarDiffPct.toFixed(1)}% vs 1Q)
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="font-mono font-bold text-amber-300 text-sm block">
                          {p.monthly_inflation_pct}% mensual
                        </span>
                        {p.infDiff !== null ? (
                          <span className={`text-[10px] font-mono font-bold inline-block mt-0.5 px-1.5 py-0.2 rounded ${
                            p.infDiff > 0 
                              ? 'bg-rose-950 text-rose-300 border border-rose-800/60' 
                              : p.infDiff < 0 
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                              : 'text-slate-500'
                          }`}>
                            {p.infDiff > 0 ? '+' : ''}{p.infDiff.toFixed(1)} p.p. vs mes ant.
                          </span>
                        ) : (
                          <span className="text-[9px] text-slate-500 block">Base inicial</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        {hasRates ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950/80 text-blue-300 border border-blue-800/60 font-semibold inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-blue-400" />
                            {p.rates_count} tarifas vigentes (Personal & Tarifas)
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 font-medium inline-flex items-center gap-1">
                            <AlertCircle className="w-3 h-3 text-amber-400/80" />
                            Pendiente fijar tarifas de mano de obra
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className={`text-[9px] px-2.5 py-1 rounded font-black border uppercase inline-flex items-center gap-1.5 ${
                          p.is_locked
                            ? 'bg-amber-950 text-amber-300 border-amber-700'
                            : 'bg-emerald-950 text-emerald-300 border-emerald-700'
                        }`}>
                          {p.is_locked ? <Lock className="w-2.5 h-2.5" /> : <Unlock className="w-2.5 h-2.5" />}
                          <span>{p.is_locked ? 'CONGELADA / CERRADA' : 'ABIERTA / MODIFICABLE'}</span>
                        </span>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => togglePeriodLock(p)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            p.is_locked
                              ? 'bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700'
                              : 'bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-800'
                          }`}
                        >
                          {p.is_locked ? 'Desbloquear Quincena' : 'Bloquear e Inmutabilizar'}
                        </button>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteSinglePeriod(p)}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title={`Eliminar registros de la quincena ${p.period}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL 1: EDICIÓN COMPLETA DE VARIABLES MACROECONÓMICAS (LÁPIZ DE MES) */}
      {macroEditModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="alon-modal-card max-w-xl">
            <div className="alon-modal-header">
              <div className="flex items-center gap-2.5 min-w-0">
                <Pencil className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-black text-white text-sm truncate">
                    Editar Variables Macroeconómicas: {MONTH_NAMES[macroEditModal.month - 1]} {macroEditModal.year}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    Recorrido guiado por color y tecla <strong className="text-slate-200">Tab</strong>: 1° Vigencia ➔ 2° Inflación ➔ 3° Cotizaciones Dólar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setMacroEditModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveMacroModalSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
              <div className="alon-modal-body space-y-3">
                {/* BLOQUE 1: CONTEXTO Y VIGENCIA */}
                <div className="alon-chunk-sky space-y-1.5">
                  <div className="flex items-center justify-between pb-1 border-b border-sky-500/20">
                    <span className="font-black text-[11px] uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> 1. Período de Vigencia
                    </span>
                    <span className="text-[10px] text-sky-300/70 font-mono">Mes & Quincenas</span>
                  </div>
                  <div className="flex items-center justify-between bg-slate-950/60 p-2 rounded-lg border border-sky-500/20">
                    <div>
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Mes y Año de Aplicación</span>
                      <span className="font-black text-white text-xs">{MONTH_NAMES[macroEditModal.month - 1]} {macroEditModal.year}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-slate-400 block text-[10px] uppercase font-bold">Quincenas que Rige</span>
                      <span className="font-mono text-sky-300 font-extrabold text-xs">1ª y 2ª Quincena (1Q / 2Q)</span>
                    </div>
                  </div>
                </div>

                {/* BLOQUE 2: INFLACIÓN MENSUAL */}
                <div className="alon-chunk-amber space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-amber-500/20">
                    <span className="font-black text-[11px] uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Percent className="w-3.5 h-3.5" /> 2. Tasa de Inflación Mensual (%) *
                    </span>
                    <span className="text-[10px] text-amber-300/70 font-mono">Índice IPC / Costos</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    La inflación es mensual y aplica automáticamente para actualizar tarifas testigo en ambas quincenas (1Q y 2Q).
                  </p>
                  <div>
                    <input
                      type="number"
                      step="0.1"
                      required
                      value={macroEditModal.monthly_inflation_pct}
                      onChange={(e) => setMacroEditModal({ ...macroEditModal, monthly_inflation_pct: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-amber-500/60 focus:border-amber-400 rounded-xl px-3 py-2 text-base font-mono font-black text-amber-300 focus:outline-none focus:ring-1 focus:ring-amber-400 shadow-inner"
                      placeholder="ej. 3.2"
                    />
                  </div>
                </div>

                {/* BLOQUE 3: COTIZACIONES DÓLAR POR QUINCENA */}
                <div className="alon-chunk-emerald space-y-2">
                  <div className="flex items-center justify-between pb-1 border-b border-emerald-500/20">
                    <span className="font-black text-[11px] uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5" /> 3. Ajuste Manual de Dólar por Quincena ($/USD)
                    </span>
                    <span className="text-[10px] text-emerald-300/70 font-mono">Cotización Oficial</span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Podés definir un tipo de cambio de referencia específico e independiente para cada quincena del mes.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="bg-slate-950/60 p-2.5 border border-emerald-500/30 rounded-xl space-y-1">
                      <label className="text-[11px] font-bold text-emerald-300 block font-mono">
                        Dólar 1ª Quincena (1Q) *
                      </label>
                      <input
                        type="number"
                        step="1"
                        required
                        value={macroEditModal.dollar_rate_1q}
                        onChange={(e) => setMacroEditModal({ ...macroEditModal, dollar_rate_1q: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-950 border border-emerald-500/60 focus:border-emerald-400 rounded-lg px-2.5 py-1.5 text-sm font-mono font-black text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>

                    <div className="bg-slate-950/60 p-2.5 border border-emerald-500/30 rounded-xl space-y-1">
                      <label className="text-[11px] font-bold text-emerald-300 block font-mono">
                        Dólar 2ª Quincena (2Q) *
                      </label>
                      <input
                        type="number"
                        step="1"
                        required
                        value={macroEditModal.dollar_rate_2q}
                        onChange={(e) => setMacroEditModal({ ...macroEditModal, dollar_rate_2q: parseFloat(e.target.value) || 0 })}
                        className="w-full bg-slate-950 border border-emerald-500/60 focus:border-emerald-400 rounded-lg px-2.5 py-1.5 text-sm font-mono font-black text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="alon-modal-footer">
                <button
                  type="button"
                  onClick={() => setMacroEditModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingMacro}
                  className="px-5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5 shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingMacro ? 'Guardando...' : 'Guardar Cambios'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: AJUSTE RÁPIDO DE DÓLAR POR QUINCENA */}
      {quincenaDollarModal.isOpen && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="alon-modal-card max-w-sm">
            <div className="alon-modal-header">
              <div className="flex items-center gap-2 min-w-0">
                <DollarSign className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <h3 className="font-black text-white text-sm truncate">
                    Ajustar Dólar de Quincena
                  </h3>
                  <p className="text-[10px] text-slate-400 truncate font-mono">
                    {quincenaDollarModal.period}
                  </p>
                </div>
              </div>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setQuincenaDollarModal(prev => ({ ...prev, isOpen: false }))}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuincenaDollarSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
              <div className="alon-modal-body space-y-2.5">
                <div className="alon-chunk-sky space-y-1">
                  <span className="text-[10px] font-black text-sky-400 uppercase tracking-wider block">
                    1. Quincena Seleccionada
                  </span>
                  <div className="p-2 rounded-lg bg-slate-950/60 border border-sky-500/20 font-mono font-bold text-white text-xs flex items-center justify-between">
                    <span className="text-sky-300 font-extrabold">{quincenaDollarModal.period}</span>
                    <span className="text-[11px] text-slate-400 font-sans">
                      {quincenaDollarModal.quincena === 1 ? '1ª Quincena' : '2ª Quincena'} de {MONTH_NAMES[quincenaDollarModal.month - 1]}
                    </span>
                  </div>
                </div>

                <div className="alon-chunk-emerald space-y-1.5">
                  <label className="text-[11px] font-black text-emerald-400 uppercase tracking-wider block">
                    2. Cotización Dólar Oficial (AR$/USD) *
                  </label>
                  <input
                    type="number"
                    step="1"
                    required
                    autoFocus
                    value={quincenaDollarModal.dollar_rate}
                    onChange={(e) => setQuincenaDollarModal({ ...quincenaDollarModal, dollar_rate: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-950 border border-emerald-500/60 focus:border-emerald-400 rounded-xl px-3 py-2 text-base font-mono font-black text-emerald-300 focus:outline-none focus:ring-1 focus:ring-emerald-400 shadow-inner"
                  />
                </div>
              </div>

              <div className="alon-modal-footer">
                <button
                  type="button"
                  onClick={() => setQuincenaDollarModal(prev => ({ ...prev, isOpen: false }))}
                  className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-md"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>Guardar Dólar</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
