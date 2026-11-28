import { useEffect, useState, useCallback } from 'react'
import { Wallet, RefreshCw, AlertTriangle } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useModuleTab } from '../hooks/useModuleTab'
import CanonicalActiveSubmoduleBadge from '../components/canonical/CanonicalActiveSubmoduleBadge'
import TesoreriaDeduccionesPanel from '../components/tesoreria/TesoreriaDeduccionesPanel'
import TesoreriaCcPanel from '../components/tesoreria/TesoreriaCcPanel'
import TesoreriaContratadosPanel from '../components/tesoreria/contratados/TesoreriaContratadosPanel'
import { useSupabaseRealtimeRefresh } from '../hooks/useSupabaseRealtimeRefresh'
import {
  fetchContractorDeductionsForPeriod,
  getCurrentQuincenaKey
} from '../lib/contractorDeductionsService'

const TESORERIA_REALTIME_TABLES = [
  'inventory_transactions',
  'materials',
  'workers',
  'ships',
  'work_orders',
  'rate_cards',
  'macro_variables'
]

/**
 * Módulo Tesorería (Graciela — TESORERIA)
 * Submódulos:
 *  1. `deducciones`: Descuentos de Pañol (Gallina · solo extracción/análisis)
 *  2. `movimientos`: Cuenta Corriente & Pagos de Contratistas (Gallo · CARGA_EDICION)
 *  3. `contratados`: Libro por Contratista & Barcos (Gallo · CARGA_EDICION)
 */
export default function Tesoreria() {
  const { user, profile, orgRole, capabilities } = useAuth()
  const { activeTab, activeSubmodule } = useModuleTab('tesoreria')
  const isCcTab = activeTab === 'movimientos'
  const isContratadosTab = activeTab === 'contratados'
  const pauseDeductions = isCcTab || isContratadosTab

  const [selectedPeriod, setSelectedPeriod] = useState(() => getCurrentQuincenaKey())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)

  const actor = orgRole?.holder_name || profile?.full_name || user?.email || 'TESORERIA'
  const canManageCc = capabilities ? Boolean(capabilities.canManageContractorCc) : true

  const loadPeriod = useCallback(async (periodKey, { silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      setErrorMsg(null)
      const res = await fetchContractorDeductionsForPeriod(periodKey)
      setData(res)
    } catch (err) {
      setErrorMsg(err?.message || 'Error al cargar datos de Tesorería.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useSupabaseRealtimeRefresh({
    channelName: 'tesoreria_live',
    tables: TESORERIA_REALTIME_TABLES,
    onSync: () => loadPeriod(selectedPeriod, { silent: true }),
    pauseWhen: pauseDeductions,
  })

  useEffect(() => {
    if (pauseDeductions) return undefined
    let active = true
    fetchContractorDeductionsForPeriod(selectedPeriod)
      .then((res) => {
        if (!active) return
        setData(res)
        setErrorMsg(null)
      })
      .catch((err) => {
        if (!active) return
        setErrorMsg(err?.message || 'Error al cargar datos de Tesorería.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => { active = false }
  }, [selectedPeriod, pauseDeductions])

  if (isContratadosTab) {
    return (
      <TesoreriaContratadosPanel
        selectedPeriod={selectedPeriod}
        onPeriodChange={(nextPeriod) => setSelectedPeriod(nextPeriod)}
        activeSubmodule={activeSubmodule}
        canManageCc={canManageCc}
        actor={actor}
      />
    )
  }

  if (isCcTab) {
    return (
      <TesoreriaCcPanel
        selectedPeriod={selectedPeriod}
        onPeriodChange={(nextPeriod) => setSelectedPeriod(nextPeriod)}
        activeSubmodule={activeSubmodule}
        canManageCc={canManageCc}
        actor={actor}
      />
    )
  }

  return (
    <div className="space-y-4 font-sans">
      {/* ZONA 1: CONTEXTO Y ACCIONES PRINCIPALES */}
      <div className="alon-zone-context">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-sky-500/20 border border-sky-400/40 flex items-center justify-center text-sky-300 shrink-0">
              <Wallet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <CanonicalActiveSubmoduleBadge
                  label={activeSubmodule?.label || '1. Descuentos de Pañol'}
                  theme={activeSubmodule?.theme || 'sky'}
                />
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-sky-950 text-sky-300 border border-sky-700">
                  MÓDULO TESORERÍA · GALLINA (SOLO ANÁLISIS)
                </span>
                <span className="text-[10px] font-bold text-slate-400">Responsable: Graciela</span>
              </div>
              <h1 className="text-lg font-black text-white mt-0.5">
                Tesorería & Extracción de Descuentos a Contratistas
              </h1>
              <p className="text-xs text-slate-400">
                Seleccioná la quincena para obtener automáticamente Consumibles y Elementos de Seguridad cobrables por contratista, respetando excepciones de zona gris.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => loadPeriod(selectedPeriod)}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar Quincena</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="p-3 rounded-xl bg-rose-950/70 border border-rose-500/50 text-rose-200 text-xs font-bold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <TesoreriaDeduccionesPanel
        data={data}
        loading={loading}
        selectedPeriod={selectedPeriod}
        onPeriodChange={(nextPeriod) => {
          setLoading(true)
          setSelectedPeriod(nextPeriod)
        }}
      />
    </div>
  )
}
