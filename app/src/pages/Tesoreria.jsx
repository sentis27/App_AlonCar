import { useEffect, useState, useCallback } from 'react'
import { Wallet, RefreshCw, AlertTriangle } from 'lucide-react'
import TesoreriaDeduccionesPanel from '../components/tesoreria/TesoreriaDeduccionesPanel'
import {
  fetchContractorDeductionsForPeriod,
  getCurrentQuincenaKey
} from '../lib/contractorDeductionsService'

/**
 * Módulo Tesorería (Graciela — TESORERIA)
 * Arquetipo: METRICAS_ANALISIS (Gallina)
 */
export default function Tesoreria() {
  const [selectedPeriod, setSelectedPeriod] = useState(() => getCurrentQuincenaKey())
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [errorMsg, setErrorMsg] = useState(null)

  const loadPeriod = useCallback(async (periodKey) => {
    try {
      setLoading(true)
      setErrorMsg(null)
      const res = await fetchContractorDeductionsForPeriod(periodKey)
      setData(res)
    } catch (err) {
      setErrorMsg(err?.message || 'Error al cargar datos de Tesorería.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
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
  }, [selectedPeriod])

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
