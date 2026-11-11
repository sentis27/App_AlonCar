import { useState, useEffect, useMemo } from 'react'
import {
  TrendingUp,
  HardHat,
  RefreshCw,
  BarChart3,
  AlertCircle
} from 'lucide-react'
import { supabase } from '../../lib/supabase'

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

export default function PersonalAnalisisPanel({ workers = [] }) {
  const [comparePeriodBase, setComparePeriodBase] = useState('2026-09-2Q')
  const [comparePeriodTarget, setComparePeriodTarget] = useState('2026-10-1Q')
  const [comparisonCards, setComparisonCards] = useState([])
  const [loadingComparison, setLoadingComparison] = useState(false)
  const [macroVariables, setMacroVariables] = useState([])
  const [chartMode, setChartMode] = useState('pct') // 'pct' | 'nominal'
  const [hoveredPointIndex, setHoveredPointIndex] = useState(null)
  const [timeWindowPreset, setTimeWindowPreset] = useState('month')
  const [selectedZoomContractor, setSelectedZoomContractor] = useState('ALDO (CARPINTERO)')

  useEffect(() => {
    loadComparisonData()
  }, [])

  async function loadComparisonData() {
    try {
      setLoadingComparison(true)
      const [cardsRes, macroRes] = await Promise.all([
        supabase.from('rate_cards').select('*').order('year', { ascending: true }).order('month', { ascending: true }).order('quincena', { ascending: true }),
        supabase.from('macro_variables').select('*').order('year', { ascending: true }).order('month', { ascending: true })
      ])

      const cards = cardsRes.data || []
      setComparisonCards(cards)
      if (macroRes.data) setMacroVariables(macroRes.data)

      // Inicializar períodos de comparación con las dos últimas quincenas disponibles
      const map = new Map()
      cards.forEach(d => {
        if (!map.has(d.period)) {
          map.set(d.period, {
            period: d.period,
            year: d.year,
            month: d.month,
            quincena: d.quincena
          })
        }
      })
      const unique = Array.from(map.values())
      unique.sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year
        if (a.month !== b.month) return a.month - b.month
        return a.quincena - b.quincena
      })
      if (unique.length >= 2) {
        setComparePeriodBase(unique[unique.length - 2].period)
        setComparePeriodTarget(unique[unique.length - 1].period)
      }
    } catch (err) {
      console.warn('Error cargando comparativa de salarios/tarifas:', err)
      setComparisonCards([])
    } finally {
      setLoadingComparison(false)
    }
  }

  const sortedRecordedPeriods = useMemo(() => {
    const map = new Map()
    comparisonCards.forEach(d => {
      if (!map.has(d.period)) {
        map.set(d.period, {
          period: d.period,
          year: d.year,
          month: d.month,
          quincena: d.quincena,
          dollar_rate: d.dollar_rate
        })
      }
    })
    return Array.from(map.values()).sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      if (a.month !== b.month) return a.month - b.month
      return a.quincena - b.quincena
    })
  }, [comparisonCards])

  const rootContractorsMap = useMemo(() => {
    const map = {}
    const contractors = workers.filter(w => (w.admin_center || '').toUpperCase() === 'CONTRATISTA')
    contractors.forEach(c => {
      const rawGroup = (c.work_group || '').trim().toUpperCase()
      const isAyudanteGroup = rawGroup.endsWith(' AYUDANTE')
      const root = isAyudanteGroup ? rawGroup.replace(/\s+AYUDANTE$/, '').trim() : rawGroup
      if (!root) return
      if (!map[root]) {
        map[root] = { name: root }
      }
    })
    return map
  }, [workers])

  const uniqueContractorList = useMemo(() => {
    const list = Object.keys(rootContractorsMap)
    if (list.length > 0) return list.sort()
    // Fallback a los nombres de contratistas en las tarjetas de tarifas
    const set = new Set()
    comparisonCards.forEach(c => {
      if (c.admin_center === 'CONTRATISTA' && c.entity_name) set.add(c.entity_name)
    })
    return Array.from(set).sort()
  }, [rootContractorsMap, comparisonCards])

  const handleSelectTimeWindow = (preset) => {
    setTimeWindowPreset(preset)
    if (sortedRecordedPeriods.length < 2) return

    const latestIdx = sortedRecordedPeriods.length - 1
    const targetPeriod = sortedRecordedPeriods[latestIdx].period

    if (preset === 'month') {
      const baseIdx = Math.max(0, latestIdx - 1)
      setComparePeriodBase(sortedRecordedPeriods[baseIdx].period)
      setComparePeriodTarget(targetPeriod)
    } else if (preset === 'quarter') {
      const baseIdx = Math.max(0, latestIdx - 5)
      setComparePeriodBase(sortedRecordedPeriods[baseIdx].period)
      setComparePeriodTarget(targetPeriod)
    } else if (preset === 'semester') {
      const baseIdx = Math.max(0, latestIdx - 11)
      setComparePeriodBase(sortedRecordedPeriods[baseIdx].period)
      setComparePeriodTarget(targetPeriod)
    } else if (preset === 'year') {
      const targetYear = sortedRecordedPeriods[latestIdx].year
      const firstOfYear = sortedRecordedPeriods.find(p => p.year === targetYear) || sortedRecordedPeriods[0]
      setComparePeriodBase(firstOfYear.period)
      setComparePeriodTarget(targetPeriod)
    }
  }

  const comparisonResults = useMemo(() => {
    const baseRows = comparisonCards.filter(c => c.period === comparePeriodBase)
    const targetRows = comparisonCards.filter(c => c.period === comparePeriodTarget)

    const baseDollar = baseRows.length > 0 && baseRows[0].dollar_rate ? parseFloat(baseRows[0].dollar_rate) : 1450
    const targetDollar = targetRows.length > 0 && targetRows[0].dollar_rate ? parseFloat(targetRows[0].dollar_rate) : 1500
    const dollarDiffArs = targetDollar - baseDollar
    const dollarDiffPct = baseDollar > 0 ? parseFloat(((dollarDiffArs / baseDollar) * 100).toFixed(2)) : 0

    const contractorTradeMap = new Map()
    workers.forEach(w => {
      if (w.work_group && w.trade) {
        contractorTradeMap.set(w.work_group, w.trade)
      }
    })

    const resultMap = new Map()

    baseRows.forEach(r => {
      const key = `${r.admin_center}___${r.entity_name}`
      resultMap.set(key, {
        admin_center: r.admin_center,
        entity_name: r.entity_name,
        trade: contractorTradeMap.get(r.entity_name) || (r.admin_center === 'ASTILLERO' ? 'SINDICATO' : 'General'),
        baseOficialArs: parseFloat(r.rate_oficial_ars) || 0,
        baseOficialUsd: parseFloat(r.rate_oficial_usd) || 0,
        targetOficialArs: 0,
        targetOficialUsd: 0,
        hasAyudante: r.has_ayudante
      })
    })

    targetRows.forEach(r => {
      const key = `${r.admin_center}___${r.entity_name}`
      if (!resultMap.has(key)) {
        resultMap.set(key, {
          admin_center: r.admin_center,
          entity_name: r.entity_name,
          trade: contractorTradeMap.get(r.entity_name) || (r.admin_center === 'ASTILLERO' ? 'SINDICATO' : 'General'),
          baseOficialArs: 0,
          baseOficialUsd: 0,
          targetOficialArs: parseFloat(r.rate_oficial_ars) || 0,
          targetOficialUsd: parseFloat(r.rate_oficial_usd) || 0,
          hasAyudante: r.has_ayudante
        })
      } else {
        const item = resultMap.get(key)
        item.targetOficialArs = parseFloat(r.rate_oficial_ars) || 0
        item.targetOficialUsd = parseFloat(r.rate_oficial_usd) || 0
        item.hasAyudante = r.has_ayudante || item.hasAyudante
      }
    })

    const astilleroOficialItem = resultMap.get('ASTILLERO___OFICIAL')
    let oficialAstilleroPct = 0
    if (astilleroOficialItem && astilleroOficialItem.baseOficialArs > 0) {
      oficialAstilleroPct = parseFloat((((astilleroOficialItem.targetOficialArs - astilleroOficialItem.baseOficialArs) / astilleroOficialItem.baseOficialArs) * 100).toFixed(2))
    }

    const rows = Array.from(resultMap.values()).map(item => {
      const diffOficialArs = item.targetOficialArs - item.baseOficialArs
      const diffOficialPct = item.baseOficialArs > 0
        ? parseFloat(((diffOficialArs / item.baseOficialArs) * 100).toFixed(2))
        : (item.targetOficialArs > 0 ? 100 : 0)

      const diffOficialUsd = item.targetOficialUsd - item.baseOficialUsd
      const diffOficialUsdPct = item.baseOficialUsd > 0
        ? parseFloat(((diffOficialUsd / item.baseOficialUsd) * 100).toFixed(2))
        : (item.targetOficialUsd > 0 ? 100 : 0)

      const brechaAstillero = parseFloat((diffOficialPct - oficialAstilleroPct).toFixed(2))

      let trafficLight = 'AMARILLO'
      if (item.admin_center === 'CONTRATISTA') {
        if (brechaAstillero > 5.0 || diffOficialUsdPct > 10.0) {
          trafficLight = 'ROJO'
        } else if (brechaAstillero < -2.0 || diffOficialUsdPct < 0) {
          trafficLight = 'VERDE'
        }
      }

      return {
        ...item,
        diffOficialArs,
        diffOficialPct,
        diffOficialUsd,
        diffOficialUsdPct,
        brechaAstillero,
        trafficLight
      }
    })

    const contractorRows = rows.filter(r => r.admin_center === 'CONTRATISTA')
    const redCount = contractorRows.filter(r => r.trafficLight === 'ROJO').length
    const yellowCount = contractorRows.filter(r => r.trafficLight === 'AMARILLO').length
    const greenCount = contractorRows.filter(r => r.trafficLight === 'VERDE').length

    return {
      baseDollar,
      targetDollar,
      dollarDiffArs,
      dollarDiffPct,
      oficialAstilleroPct,
      rows,
      redCount,
      yellowCount,
      greenCount
    }
  }, [comparisonCards, comparePeriodBase, comparePeriodTarget, workers])

  const fluctuationChartData = useMemo(() => {
    if (sortedRecordedPeriods.length === 0) {
      return { points: [], minPct: -5, maxPct: 15, minNom: 0, maxNom: 20000, summary: null }
    }

    const baseIdx = sortedRecordedPeriods.findIndex(p => p.period === comparePeriodBase)
    const targetIdx = sortedRecordedPeriods.findIndex(p => p.period === comparePeriodTarget)

    const startIdx = baseIdx !== -1 && targetIdx !== -1 ? Math.min(baseIdx, targetIdx) : 0
    const endIdx = baseIdx !== -1 && targetIdx !== -1 ? Math.max(baseIdx, targetIdx) : sortedRecordedPeriods.length - 1
    const windowPeriods = sortedRecordedPeriods.slice(startIdx, endIdx + 1)

    if (windowPeriods.length === 0) {
      return { points: [], minPct: -5, maxPct: 15, minNom: 0, maxNom: 20000, summary: null }
    }

    let compoundInflationFactor = 1.0

    const rawPoints = windowPeriods.map((wp, idx) => {
      const periodCards = comparisonCards.filter(c => c.period === wp.period)
      const macroRecord = macroVariables.find(m => m.year === wp.year && m.month === wp.month)

      const dollar = periodCards.length > 0 && periodCards[0].dollar_rate
        ? parseFloat(periodCards[0].dollar_rate)
        : (macroRecord ? parseFloat(macroRecord.dollar_rate) : 1500)

      const monthlyInf = periodCards.length > 0 && periodCards[0].monthly_inflation_pct !== undefined && periodCards[0].monthly_inflation_pct !== null
        ? parseFloat(periodCards[0].monthly_inflation_pct)
        : (macroRecord ? parseFloat(macroRecord.monthly_inflation_pct) : 3.5)

      if (idx > 0) {
        compoundInflationFactor = compoundInflationFactor * (1 + (monthlyInf / 200))
      }
      const cumInflationPct = Number(((compoundInflationFactor - 1) * 100).toFixed(2))

      const astilleroCard = periodCards.find(c => c.admin_center === 'ASTILLERO' && (c.entity_name === 'OFICIAL' || c.entity_name === 'OFICIAL BLACK'))
      const astilleroRate = astilleroCard ? parseFloat(astilleroCard.rate_oficial_ars) : 16365.76

      let contractorRate = 0
      let contractorUsd = 0
      if (selectedZoomContractor !== 'TODOS') {
        const contCard = periodCards.find(c => c.entity_name === selectedZoomContractor)
        if (contCard) {
          contractorRate = parseFloat(contCard.rate_oficial_ars) || 0
          contractorUsd = parseFloat(contCard.rate_oficial_usd) || 0
        }
      } else {
        const allContCards = periodCards.filter(c => c.admin_center === 'CONTRATISTA' && parseFloat(c.rate_oficial_ars) > 0)
        if (allContCards.length > 0) {
          contractorRate = allContCards.reduce((acc, c) => acc + parseFloat(c.rate_oficial_ars), 0) / allContCards.length
          contractorUsd = allContCards.reduce((acc, c) => acc + parseFloat(c.rate_oficial_usd), 0) / allContCards.length
        }
      }

      return {
        period: wp.period,
        year: wp.year,
        month: wp.month,
        quincena: wp.quincena,
        shortLabel: `${MONTH_NAMES[wp.month - 1].slice(0, 3)} ${wp.quincena}Q`,
        dollar,
        monthlyInf,
        cumInflationPct,
        astilleroRate,
        contractorRate: Number(contractorRate.toFixed(2)),
        contractorUsd: Number(contractorUsd.toFixed(2))
      }
    })

    const basePoint = rawPoints[0]
    const baseCont = basePoint.contractorRate > 0 ? basePoint.contractorRate : 1
    const baseAst = basePoint.astilleroRate > 0 ? basePoint.astilleroRate : 1
    const baseDol = basePoint.dollar > 0 ? basePoint.dollar : 1

    let minPct = 0
    let maxPct = 0
    let minNom = Infinity
    let maxNom = -Infinity

    const points = rawPoints.map((pt, idx) => {
      const contPct = idx === 0 || basePoint.contractorRate === 0
        ? 0
        : Number((((pt.contractorRate - baseCont) / baseCont) * 100).toFixed(2))
      const astPct = idx === 0
        ? 0
        : Number((((pt.astilleroRate - baseAst) / baseAst) * 100).toFixed(2))
      const dolPct = idx === 0
        ? 0
        : Number((((pt.dollar - baseDol) / baseDol) * 100).toFixed(2))
      const infPct = pt.cumInflationPct

      minPct = Math.min(minPct, contPct, astPct, dolPct, infPct)
      maxPct = Math.max(maxPct, contPct, astPct, dolPct, infPct)

      if (pt.contractorRate > 0) {
        minNom = Math.min(minNom, pt.contractorRate, pt.astilleroRate)
        maxNom = Math.max(maxNom, pt.contractorRate, pt.astilleroRate)
      } else {
        minNom = Math.min(minNom, pt.astilleroRate)
        maxNom = Math.max(maxNom, pt.astilleroRate)
      }

      return {
        ...pt,
        contPct,
        astPct,
        dolPct,
        infPct
      }
    })

    if (minNom === Infinity) minNom = 0
    if (maxNom === -Infinity) maxNom = 20000

    minPct = Math.floor(minPct - 2)
    maxPct = Math.ceil(maxPct + 3)
    if (maxPct - minPct < 10) maxPct = minPct + 10

    const lastPoint = points[points.length - 1] || points[0]
    const netContPct = lastPoint ? lastPoint.contPct : 0
    const netAstPct = lastPoint ? lastPoint.astPct : 0
    const netDolPct = lastPoint ? lastPoint.dolPct : 0
    const netInfPct = lastPoint ? lastPoint.infPct : 0

    const brechaVsAst = Number((netContPct - netAstPct).toFixed(2))
    const brechaVsInf = Number((netContPct - netInfPct).toFixed(2))
    const brechaVsDol = Number((netContPct - netDolPct).toFixed(2))

    return {
      points,
      minPct,
      maxPct,
      minNom: Math.floor(minNom * 0.95),
      maxNom: Math.ceil(maxNom * 1.05),
      summary: {
        basePoint,
        lastPoint,
        netContPct,
        netAstPct,
        netDolPct,
        netInfPct,
        brechaVsAst,
        brechaVsInf,
        brechaVsDol,
        targetName: selectedZoomContractor === 'TODOS' ? 'Promedio General de Contratistas' : selectedZoomContractor
      }
    }
  }, [sortedRecordedPeriods, comparePeriodBase, comparePeriodTarget, comparisonCards, macroVariables, selectedZoomContractor])

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* BARRA SUPERIOR: CONTROLES DE ANÁLISIS & PRESTADOR SELECCIONADO */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              <h2 className="text-base font-bold text-white">
                Fluctuación de Costos vs. 3 Anclas Determinísticas
              </h2>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Comparativa dinámica frente al <strong>Dólar Oficial FX</strong>, la <strong>Paritaria Sindical de Astillero</strong> y la <strong>Inflación Mensual</strong> fijada por Administrador.
            </p>
          </div>

          {/* Selector de Contratista a Evaluar & Botón Actualizar */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-700">
              <HardHat className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-bold text-slate-400">Prestador / Sujeto:</span>
              <select
                value={selectedZoomContractor}
                onChange={(e) => {
                  setSelectedZoomContractor(e.target.value)
                  setHoveredPointIndex(null)
                }}
                className="bg-slate-900 border border-slate-700 text-xs font-extrabold text-amber-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-400 font-mono cursor-pointer"
              >
                <option value="TODOS">👥 Promedio General de Contratistas</option>
                {uniqueContractorList.map(c => (
                  <option key={`eval-${c}`} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={loadComparisonData}
              className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Actualizar datos históricos"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingComparison ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
          </div>
        </div>

        {/* SELECTOR DE VENTANA TEMPORAL (PILAR A) */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
              Alcance:
            </span>

            {[
              { id: 'month', label: '1 Mes (2Q)', desc: 'Últimas 2 quincenas' },
              { id: 'quarter', label: 'Trimestre (6Q)', desc: 'Últimos 3 meses' },
              { id: 'semester', label: 'Semestre (12Q)', desc: 'Últimos 6 meses' },
              { id: 'year', label: 'Año Completo (YTD)', desc: 'Evolución anual' },
              { id: 'custom', label: '⚙️ Rango Libre', desc: 'Selección manual' }
            ].map(w => (
              <button
                key={w.id}
                type="button"
                onClick={() => handleSelectTimeWindow(w.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                  timeWindowPreset === w.id
                    ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-purple-400 shadow-md shadow-purple-950/50'
                    : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                }`}
                title={w.desc}
              >
                {w.label}
              </button>
            ))}
          </div>

          {timeWindowPreset === 'custom' ? (
            <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-purple-800/80">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-bold">Desde:</span>
                <select
                  value={comparePeriodBase}
                  onChange={(e) => setComparePeriodBase(e.target.value)}
                  className="bg-slate-900 text-cyan-400 font-mono font-bold rounded px-2 py-1 text-xs focus:outline-none"
                >
                  {sortedRecordedPeriods.map(p => (
                    <option key={`base-${p.period}`} value={p.period}>{p.period}</option>
                  ))}
                </select>
              </div>
              <span className="text-slate-600 font-bold">&rarr;</span>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="text-slate-400 font-bold">Hasta:</span>
                <select
                  value={comparePeriodTarget}
                  onChange={(e) => setComparePeriodTarget(e.target.value)}
                  className="bg-slate-900 text-purple-400 font-mono font-bold rounded px-2 py-1 text-xs focus:outline-none"
                >
                  {sortedRecordedPeriods.map(p => (
                    <option key={`target-${p.period}`} value={p.period}>{p.period}</option>
                  ))}
                </select>
              </div>
            </div>
          ) : (
            <div className="text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
              <span>Período evaluado:</span>
              <span className="font-mono font-bold text-cyan-400">{comparePeriodBase}</span>
              <span className="text-slate-600 font-bold">&rarr;</span>
              <span className="font-mono font-bold text-purple-400">{comparePeriodTarget}</span>
            </div>
          )}
        </div>

        {/* 5 TARJETAS KPI FIJAS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-2">
          {/* KPI 1: Semáforo Ejecutivo */}
          {(() => {
            const s = fluctuationChartData.summary
            const netCont = s ? s.netContPct : 0
            const brechaAst = s ? s.brechaVsAst : 0
            const isRed = brechaAst > 5.0
            const isGreen = brechaAst < -2.0 || netCont < 0
            const statusColor = isRed ? 'rose' : isGreen ? 'emerald' : 'amber'
            const statusLabel = isRed ? 'ALERTA ROJA' : isGreen ? 'FAVORABLE' : 'EN PARÁMETRO'

            return (
              <div className={`p-3.5 rounded-xl bg-slate-950 border border-${statusColor}-800/80 space-y-1.5`}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 truncate max-w-[120px]" title={s?.targetName}>
                    {s?.targetName}
                  </span>
                  <span className={`text-[9px] px-1.5 py-0.2 rounded font-black border ${
                    isRed ? 'bg-rose-950 text-rose-300 border-rose-700' : isGreen ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : 'bg-amber-950 text-amber-300 border-amber-700'
                  }`}>
                    {statusLabel}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-black font-mono ${
                    netCont > 0 ? (isRed ? 'text-rose-400' : 'text-amber-300') : 'text-slate-200'
                  }`}>
                    {netCont > 0 ? `+${netCont}%` : `${netCont}%`}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">AR$/h</span>
                </div>
                <span className="text-[10px] text-slate-400 block truncate">
                  Brecha vs Sindicato: <strong className={brechaAst > 0 ? 'text-rose-400 font-mono' : 'text-emerald-400 font-mono'}>
                    {brechaAst > 0 ? `+${brechaAst}%` : `${brechaAst}%`}
                  </strong>
                </span>
              </div>
            )
          })()}

          {/* KPI 2: Ancla 1 - Dólar Oficial FX */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span className="font-bold uppercase tracking-wider text-[10px] text-emerald-400">Ancla 1: Dólar FX</span>
              <span className="font-mono text-emerald-400 font-bold">${comparisonResults.targetDollar}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-white font-mono">
                {comparisonResults.dollarDiffPct > 0 ? `+${comparisonResults.dollarDiffPct}%` : `${comparisonResults.dollarDiffPct}%`}
              </span>
              <span className="text-xs text-slate-500 font-mono">
                (${comparisonResults.baseDollar} &rarr; ${comparisonResults.targetDollar})
              </span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              Ritmo cambiario en el período
            </span>
          </div>

          {/* KPI 3: Ancla 2 - Paritaria Oficial Astillero */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-900/40 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-cyan-400">
              <span className="font-bold uppercase tracking-wider text-[10px]">Ancla 2: Sindicato</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 font-bold">Astillero</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-black font-mono ${
                comparisonResults.oficialAstilleroPct > 0 ? 'text-cyan-400' : 'text-slate-300'
              }`}>
                {comparisonResults.oficialAstilleroPct > 0 ? `+${comparisonResults.oficialAstilleroPct}%` : `${comparisonResults.oficialAstilleroPct}%`}
              </span>
              <span className="text-xs text-slate-400 font-mono">convenio</span>
            </div>
            <span className="text-[10px] text-slate-400 block truncate">
              Pauta salarial oficial de planta
            </span>
          </div>

          {/* KPI 4: Ancla 3 - Inflación Oficial Mensual */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-orange-900/40 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-orange-400">
              <span className="font-bold uppercase tracking-wider text-[10px]">Ancla 3: Inflación</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-orange-950 border border-orange-800 font-bold">Admin Central</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-orange-400">
                +{fluctuationChartData.summary?.netInfPct || 0}%
              </span>
              <span className="text-xs text-slate-400 font-mono">acumulada</span>
            </div>
            <span className="text-[10px] text-slate-400 block">
              Aplica a ambas quincenas del mes
            </span>
          </div>

          {/* KPI 5: Semáforo Ejecutivo Global */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-purple-900/40 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-purple-400">
              <span className="font-bold uppercase tracking-wider text-[10px]">Semáforo Global</span>
              <span className="font-mono text-xs font-bold text-slate-400">{comparisonResults.rows.filter(r => r.admin_center === 'CONTRATISTA').length} Cuadrillas</span>
            </div>
            <div className="flex items-center gap-3 pt-0.5">
              <div className="flex items-center gap-1" title="Contratistas con aumento > +5% sobre Astillero">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                <span className="font-mono font-black text-rose-400 text-lg">{comparisonResults.redCount}</span>
              </div>
              <div className="flex items-center gap-1" title="Contratistas alineados a la paritaria">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                <span className="font-mono font-black text-amber-300 text-lg">{comparisonResults.yellowCount}</span>
              </div>
              <div className="flex items-center gap-1" title="Contratistas favorables">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                <span className="font-mono font-black text-emerald-300 text-lg">{comparisonResults.greenCount}</span>
              </div>
            </div>
            <span className="text-[10px] text-slate-400 block">
              Pauta general de contratistas
            </span>
          </div>
        </div>
      </div>

      {/* EL NUEVO CENTRO VISUAL: GRÁFICO DINÁMICO DE FLUCTUACIÓN TEMPORAL MULTIVARIABLE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-sm uppercase tracking-wider font-extrabold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-cyan-400" />
              Evolución Temporal: {fluctuationChartData.summary?.targetName} vs. 3 Anclas
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Visualizá punto por punto la fluctuación quincenal y la brecha relativa contra el Dólar, el Sindicato y la Inflación.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase">Ver:</span>
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={() => setChartMode('pct')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartMode === 'pct' ? 'bg-primary text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                📈 Variación Acumulada (%)
              </button>
              <button
                type="button"
                onClick={() => setChartMode('nominal')}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  chartMode === 'nominal' ? 'bg-primary text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                💵 Valores AR$/Hora
              </button>
            </div>
          </div>
        </div>

        {/* LEYENDA VISUAL */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <span className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-amber-300 shadow-sm shadow-amber-500/50"></span>
              <span>{fluctuationChartData.summary?.targetName}</span>
            </div>
            <div className="flex items-center gap-2 font-bold text-cyan-400">
              <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 border border-cyan-300 shadow-sm shadow-cyan-500/50"></span>
              <span>Paritaria Astillero (Sindicato)</span>
            </div>
            <div className="flex items-center gap-2 font-bold text-orange-400">
              <span className="w-3.5 h-3.5 rounded-full bg-orange-500 border border-orange-400 shadow-sm shadow-orange-500/50"></span>
              <span>Inflación Oficial (Mensual)</span>
            </div>
            <div className="flex items-center gap-2 font-bold text-emerald-400">
              <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 border border-emerald-300 shadow-sm shadow-emerald-500/50"></span>
              <span>Dólar Oficial (FX)</span>
            </div>
          </div>

          {hoveredPointIndex !== null && fluctuationChartData.points[hoveredPointIndex] && (
            <div className="font-mono text-xs font-bold text-cyan-300 bg-cyan-950/60 px-2.5 py-0.5 rounded border border-cyan-800">
              Inspeccionando: {fluctuationChartData.points[hoveredPointIndex].period}
            </div>
          )}
        </div>

        {/* LIENZO SVG */}
        {fluctuationChartData.points.length === 0 ? (
          <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
            No hay datos suficientes para trazar la curva en el período seleccionado.
          </div>
        ) : (() => {
          const pts = fluctuationChartData.points
          const N = pts.length
          const W = 840
          const H = 340
          const padLeft = 60
          const padRight = 50
          const padTop = 30
          const padBottom = 50
          const plotW = W - padLeft - padRight
          const plotH = H - padTop - padBottom

          const getX = (idx) => N === 1 ? padLeft + plotW / 2 : padLeft + (idx / (N - 1)) * plotW

          const isPct = chartMode === 'pct'
          const yMin = isPct ? fluctuationChartData.minPct : fluctuationChartData.minNom
          const yMax = isPct ? fluctuationChartData.maxPct : fluctuationChartData.maxNom
          const yRange = Math.max(1, yMax - yMin)

          const getY = (val) => padTop + plotH - ((val - yMin) / yRange) * plotH

          const getPath = (key) => {
            return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p[key])}`).join(' ')
          }

          const contKey = isPct ? 'contPct' : 'contractorRate'
          const astKey = isPct ? 'astPct' : 'astilleroRate'
          const dolKey = isPct ? 'dolPct' : 'dollar'

          const gridSteps = 5
          const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
            const val = yMin + (i / gridSteps) * yRange
            return {
              val: isPct ? `${val > 0 ? '+' : ''}${val.toFixed(1)}%` : `$${Math.round(val).toLocaleString('es-AR')}`,
              y: getY(val),
              isZero: Math.abs(val) < 0.1
            }
          })

          const activePt = hoveredPointIndex !== null && pts[hoveredPointIndex] ? pts[hoveredPointIndex] : pts[pts.length - 1]

          return (
            <div className="relative">
              <div className="w-full overflow-x-auto">
                <svg
                  viewBox={`0 0 ${W} ${H}`}
                  className="w-full h-auto min-w-[640px] select-none"
                >
                  <defs>
                    <linearGradient id="contGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {gridLines.map((gl, i) => (
                    <g key={`grid-${i}`}>
                      <line
                        x1={padLeft}
                        y1={gl.y}
                        x2={padLeft + plotW}
                        y2={gl.y}
                        stroke={gl.isZero ? '#475569' : '#1E293B'}
                        strokeDasharray={gl.isZero ? '0' : '4 4'}
                        strokeWidth={gl.isZero ? 1.5 : 1}
                      />
                      <text
                        x={padLeft - 8}
                        y={gl.y + 3.5}
                        textAnchor="end"
                        fill={gl.isZero ? '#94A3B8' : '#64748B'}
                        fontSize="10"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {gl.val}
                      </text>
                    </g>
                  ))}

                  {pts.map((p, i) => (
                    <g key={`x-axis-${i}`}>
                      <line
                        x1={getX(i)}
                        y1={padTop + plotH}
                        x2={getX(i)}
                        y2={padTop + plotH + 6}
                        stroke="#475569"
                        strokeWidth="1.5"
                      />
                      <text
                        x={getX(i)}
                        y={padTop + plotH + 20}
                        textAnchor="middle"
                        fill={hoveredPointIndex === i ? '#38BDF8' : '#94A3B8'}
                        fontSize="11"
                        fontFamily="monospace"
                        fontWeight={hoveredPointIndex === i ? 'bold' : 'medium'}
                      >
                        {p.shortLabel}
                      </text>
                    </g>
                  ))}

                  {hoveredPointIndex !== null && (
                    <line
                      x1={getX(hoveredPointIndex)}
                      y1={padTop}
                      x2={getX(hoveredPointIndex)}
                      y2={padTop + plotH}
                      stroke="#38BDF8"
                      strokeDasharray="3 3"
                      strokeWidth="1.5"
                    />
                  )}

                  {isPct && (
                    <path
                      d={`${getPath('contPct')} L ${getX(N - 1)} ${padTop + plotH} L ${getX(0)} ${padTop + plotH} Z`}
                      fill="url(#contGrad)"
                    />
                  )}

                  {isPct && (
                    <path
                      d={getPath('dolPct')}
                      fill="none"
                      stroke="#10B981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                  )}

                  {isPct && (
                    <path
                      d={getPath('infPct')}
                      fill="none"
                      stroke="#F97316"
                      strokeWidth="2.5"
                      strokeDasharray="4 4"
                      strokeLinecap="round"
                    />
                  )}

                  <path
                    d={getPath(astKey)}
                    fill="none"
                    stroke="#00E5FF"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />

                  <path
                    d={getPath(contKey)}
                    fill="none"
                    stroke="#F59E0B"
                    strokeWidth="3.5"
                    strokeLinecap="round"
                  />

                  {pts.map((p, i) => {
                    const x = getX(i)
                    const isHovered = hoveredPointIndex === i

                    return (
                      <g key={`pts-${i}`} className="cursor-pointer" onMouseEnter={() => setHoveredPointIndex(i)}>
                        <rect
                          x={x - (plotW / (Math.max(1, N) * 2))}
                          y={padTop}
                          width={plotW / Math.max(1, N)}
                          height={plotH}
                          fill="transparent"
                        />
                        {isPct && (
                          <circle
                            cx={x}
                            cy={getY(p.dolPct)}
                            r={isHovered ? 5 : 3.5}
                            fill="#10B981"
                            stroke="#022c22"
                            strokeWidth="1.5"
                          />
                        )}
                        {isPct && (
                          <circle
                            cx={x}
                            cy={getY(p.infPct)}
                            r={isHovered ? 5 : 3.5}
                            fill="#F97316"
                            stroke="#431407"
                            strokeWidth="1.5"
                          />
                        )}
                        <circle
                          cx={x}
                          cy={getY(p[astKey])}
                          r={isHovered ? 5.5 : 3.5}
                          fill="#00E5FF"
                          stroke="#083344"
                          strokeWidth="1.5"
                        />
                        <circle
                          cx={x}
                          cy={getY(p[contKey])}
                          r={isHovered ? 7 : 5}
                          fill="#F59E0B"
                          stroke="#451a03"
                          strokeWidth="2"
                          className="transition-all"
                        />
                      </g>
                    )
                  })}
                </svg>
              </div>

              {/* INSPECTOR DE DATOS DEL PUNTO ENFOCADO */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 mt-2">
                <div className="space-y-0.5">
                  <span className="text-[10px] text-amber-400 font-bold uppercase block truncate">
                    Tarifa {fluctuationChartData.summary?.targetName}
                  </span>
                  <div className="font-mono text-sm font-extrabold text-white">
                    ${activePt.contractorRate.toLocaleString('es-AR')} <span className="text-[10px] font-normal text-slate-400 font-sans">/h</span>
                  </div>
                  <div className="text-[10px] font-mono font-bold text-amber-300">
                    {activePt.contPct > 0 ? `+${activePt.contPct}%` : `${activePt.contPct}%`} vs base
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-cyan-400 font-bold uppercase block">
                    Paritaria Astillero (Sindicato)
                  </span>
                  <div className="font-mono text-sm font-extrabold text-white">
                    ${activePt.astilleroRate.toLocaleString('es-AR')} <span className="text-[10px] font-normal text-slate-400 font-sans">/h</span>
                  </div>
                  <div className="text-[10px] font-mono font-bold text-cyan-300">
                    {activePt.astPct > 0 ? `+${activePt.astPct}%` : `${activePt.astPct}%`} vs base
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-orange-400 font-bold uppercase block">
                    Inflación Oficial Acumulada
                  </span>
                  <div className="font-mono text-sm font-extrabold text-white">
                    +{activePt.infPct}% <span className="text-[10px] font-normal text-slate-400 font-sans">acum.</span>
                  </div>
                  <div className="text-[10px] font-mono font-bold text-orange-300">
                    {activePt.monthlyInf}% mensual
                  </div>
                </div>

                <div className="space-y-0.5">
                  <span className="text-[10px] text-emerald-400 font-bold uppercase block">
                    Dólar Oficial (FX)
                  </span>
                  <div className="font-mono text-sm font-extrabold text-white">
                    ${activePt.dollar.toLocaleString('es-AR')}
                  </div>
                  <div className="text-[10px] font-mono font-bold text-emerald-300">
                    {activePt.dolPct > 0 ? `+${activePt.dolPct}%` : `${activePt.dolPct}%`} vs base
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

        {/* DIAGNÓSTICO EJECUTIVO */}
        {(() => {
          const s = fluctuationChartData.summary
          if (!s) return null

          const brechaAst = s.brechaVsAst
          const brechaInf = s.brechaVsInf
          const isAlert = brechaAst > 5.0 || brechaInf > 5.0

          return (
            <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
              isAlert
                ? 'bg-rose-950/40 border-rose-800 text-rose-200'
                : brechaAst < -2.0
                ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
                : 'bg-amber-950/40 border-amber-800 text-amber-200'
            }`}>
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <strong className="block font-bold">
                  {isAlert
                    ? '🔴 Alerta de Desvío Presupuestario:'
                    : brechaAst < -2.0
                    ? '🟢 Situación de Tarifa Favorable:'
                    : '🟡 En Parámetro Operativo:'}
                </strong>
                <p className="leading-relaxed opacity-90">
                  Durante el período evaluado ({comparePeriodBase} &rarr; {comparePeriodTarget}), la tarifa de <strong>{s.targetName}</strong> creció un <strong>{s.netContPct > 0 ? `+${s.netContPct}%` : `${s.netContPct}%`}</strong>.
                  {brechaAst > 0
                    ? ` Supera a la paritaria oficial del sindicato (+${s.netAstPct}%) en ${brechaAst} puntos porcentuales.`
                    : ` Se encuentra ${Math.abs(brechaAst)} puntos por debajo del incremento paritario de Astillero (+${s.netAstPct}%).`}
                  {brechaInf > 0
                    ? ` También aumentó por encima de la inflación acumulada del período (+${s.netInfPct}%) en ${brechaInf} puntos.`
                    : ` Absorbió parte de la inflación acumulada (+${s.netInfPct}%), resultando económica en términos reales.`}
                </p>
              </div>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
