import { useState, useEffect } from 'react'
import { Users, Calculator, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { assignMonotonicFolios } from '../lib/monotonicFolioEngine'
import PersonalNominaPanel from '../components/personal/PersonalNominaPanel'
import PersonalTarifarioPanel from '../components/personal/PersonalTarifarioPanel'
import PersonalAnalisisPanel from '../components/personal/PersonalAnalisisPanel'

export default function Personal() {
  const [activeTab, setActiveTab] = useState('nomina') // 'nomina' | 'tarifario' | 'analisis'
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPeriodKey, setCurrentPeriodKey] = useState('2026-10-1Q')
  const [dollarRate, setDollarRate] = useState(1500)

  // Cargar datos de personal desde Supabase (Fuente Única de Verdad - Hallazgo B-04)
  async function loadWorkers() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .order('admin_center', { ascending: true })
        .order('work_group', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error

      setWorkers(data && data.length > 0 ? assignMonotonicFolios(data, { dateField: 'created_at' }) : [])
    } catch (err) {
      console.error('Error al cargar nómina desde workers:', err)
      setWorkers([])
    } finally {
      setLoading(false)
    }
  }

  // Cargar última quincena y cotización dólar registrada
  useEffect(() => {
    async function loadLatestPeriodMeta() {
      try {
        const { data } = await supabase
          .from('rate_cards')
          .select('period, dollar_rate, year, month, quincena')
          .order('year', { ascending: false })
          .order('month', { ascending: false })
          .order('quincena', { ascending: false })
          .limit(1)

        if (data && data.length > 0) {
          if (data[0].period) setCurrentPeriodKey(data[0].period)
          if (data[0].dollar_rate) setDollarRate(parseFloat(data[0].dollar_rate) || 1500)
        }
      } catch (err) {
        console.warn('Error cargando período inicial de tarifas:', err)
      }
    }

    loadWorkers()
    loadLatestPeriodMeta()
  }, [])

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* ZONA 1 (CONTEXTO): CABECERA & NAVEGACIÓN PRINCIPAL */}
      <div className="alon-zone-context rounded-2xl p-5 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span className="text-slate-300">Recursos Humanos & Mano de Obra</span>
            <span>&bull;</span>
            <span className="text-primary font-medium">GS-008: B.D.NewSystemm</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <span>Padrón de Personal, Talleres & Tarifas</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestión centralizada de personal propio (Astillero), cuadrillas externas (Contratistas), talleres y costos quincenales.
          </p>
        </div>

        {/* SELECTOR DE PESTAÑAS PRINCIPALES */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950/90 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
          <button
            type="button"
            onClick={() => setActiveTab('nomina')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'nomina'
                ? 'bg-gradient-to-r from-primary to-blue-600 text-slate-950 border-primary shadow-lg shadow-cyan-500/25 font-black'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 text-cyan-400" />
            <span>Padrón de Personal ({workers.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tarifario')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'tarifario'
                ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/25 font-black'
                : 'bg-slate-900/80 hover:bg-slate-800 text-emerald-400/90 border-slate-800 hover:border-emerald-800/60 hover:text-emerald-300'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Tarifario Quincenal [{currentPeriodKey}]</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analisis')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'analisis'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-purple-400 shadow-lg shadow-purple-500/25 font-black'
                : 'bg-slate-900/80 hover:bg-slate-800 text-purple-400/90 border-slate-800 hover:border-purple-800/60 hover:text-purple-300'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Análisis de Variación & FX</span>
          </button>
        </div>
      </div>

      {/* PESTAÑA 1: PADRÓN OPERATIVO DE PERSONAS & GRUPOS DE TRABAJO */}
      {activeTab === 'nomina' && (
        <PersonalNominaPanel
          workers={workers}
          setWorkers={setWorkers}
          reloadWorkers={loadWorkers}
          dollarRate={dollarRate}
        />
      )}

      {/* PESTAÑA 2: TARIFARIO QUINCENAL OFICIAL */}
      {activeTab === 'tarifario' && (
        <PersonalTarifarioPanel
          currentPeriodKey={currentPeriodKey}
          onPeriodChange={setCurrentPeriodKey}
          workers={workers}
        />
      )}

      {/* PESTAÑA 3: ANÁLISIS DE EVOLUCIÓN SALARIAL VS INFLACIÓN Y FX */}
      {activeTab === 'analisis' && (
        <PersonalAnalisisPanel
          workers={workers}
        />
      )}
    </div>
  )
}
