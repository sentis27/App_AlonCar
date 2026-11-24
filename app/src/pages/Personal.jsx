import { useState, useEffect, useCallback } from 'react'
import { Users } from 'lucide-react'
import { fetchPersonalBaseDataService } from '../services/personalNominaService'
import { useModuleTab } from '../hooks/useModuleTab'
import { useSupabaseRealtimeRefresh } from '../hooks/useSupabaseRealtimeRefresh'
import CanonicalActiveSubmoduleBadge from '../components/canonical/CanonicalActiveSubmoduleBadge'
import PersonalNominaPanel from '../components/personal/PersonalNominaPanel'
import PersonalTarifarioPanel from '../components/personal/PersonalTarifarioPanel'
import PersonalAnalisisPanel from '../components/personal/PersonalAnalisisPanel'

const PERSONAL_REALTIME_TABLES = ['workers', 'rate_cards', 'organization_roles', 'system_settings']

export default function Personal() {
  const { activeTab, activeSubmodule } = useModuleTab('personal')
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentPeriodKey, setCurrentPeriodKey] = useState('2026-10-1Q')
  const [dollarRate, setDollarRate] = useState(1500)

  const loadWorkers = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      const data = await fetchPersonalBaseDataService()
      setWorkers(data.workers)
      if (!silent) {
        if (data.periodKey) setCurrentPeriodKey(data.periodKey)
        if (data.dollarRate) setDollarRate(data.dollarRate)
      }
    } catch (err) {
      console.error('Error al cargar nómina desde workers:', err)
      if (!silent) setWorkers([])
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useSupabaseRealtimeRefresh({
    channelName: 'personal_live',
    tables: PERSONAL_REALTIME_TABLES,
    onSync: () => loadWorkers({ silent: true })
  })

  useEffect(() => {
    loadWorkers({ silent: false })
  }, [loadWorkers])

  return (
    <div className="space-y-6 w-full pb-10">
      {/* ZONA 1 (CONTEXTO): CABECERA LIMPIA (Pestañas migradas al Menú Lateral Acordeón) */}
      <div className="alon-zone-context rounded-2xl p-5 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mb-1">
            <span className="text-slate-300">Recursos Humanos & Mano de Obra</span>
            <span>&bull;</span>
            <span className="text-primary font-medium">GS-008: B.D.NewSystemm</span>
            <CanonicalActiveSubmoduleBadge
              label={activeSubmodule?.label || 'Padrón de Personal'}
              suffix={
                activeTab === 'nomina'
                  ? `(${workers.length})`
                  : activeTab === 'tarifario'
                  ? `[${currentPeriodKey}]`
                  : null
              }
              theme={activeSubmodule?.theme || 'cyan'}
            />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <span>Padrón de Personal, Talleres & Tarifas</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestión centralizada de personal propio (Astillero), cuadrillas externas (Contratistas), talleres y costos quincenales.
          </p>
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
