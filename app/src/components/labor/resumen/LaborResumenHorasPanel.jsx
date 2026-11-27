/**
 * LaborResumenHorasPanel.jsx
 * Submódulo privado `4. Resumen Horas` (`/horas?tab=resumen_horas`, solo María José y Admin).
 * Contiene los 3 botones limpios pedidos: `Resumen`, `Horas Astillero` (= Sábana Quincenal) y `Contratados`.
 * Sin tarjetas de KPI ni controles redundantes.
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { FileSpreadsheet, Users, CalendarDays, RefreshCw, CheckCircle2, AlertTriangle, ClipboardList } from 'lucide-react'
import { useSupabaseRealtimeRefresh } from '../../../hooks/useSupabaseRealtimeRefresh'
import { buildContratadosSettlementRows } from '../../../lib/contractorSettlementEngine'
import { buildResumenNovedadesGroups } from '../../../lib/contractorSettlementHelpers'
import {
  closeQuincenaSettlementService,
  fetchResumenHorasWorkspaceData,
  reopenQuincenaSettlementService,
  saveContratadosRowObservationService,
} from '../../../services/resumenHorasService'
import LaborSabanaPanel from '../LaborSabanaPanel'
import LaborResumenNovedadesTable from './LaborResumenNovedadesTable'
import LaborResumenContratadosTable from './LaborResumenContratadosTable'

const RESUMEN_REALTIME_TABLES = [
  'labor_logs',
  'workers',
  'rate_cards',
  'contractor_prc_registry',
  'third_party_services',
  'contractor_cc_movements',
  'contractor_settlement_closures',
  'inventory_transactions',
  'macro_variables',
]

const MONTH_NAMES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function LaborResumenHorasPanel({
  selectedYear,
  selectedMonth,
  setSelectedMonth,
  selectedQuincena,
  setSelectedQuincena,
  canManage = false,
  isMasterAdmin = false,
  actor = 'LIQUIDACION_SUELDOS',
  sabanaProps = {},
}) {
  const [innerTab, setInnerTab] = useState('resumen') // 'resumen' | 'astillero' | 'contratados'
  const [raw, setRaw] = useState(null)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState(null)

  const periodKey = useMemo(
    () => `${selectedYear}-${String(selectedMonth).padStart(2, '0')}-${String(selectedQuincena) === '1' ? '1Q' : '2Q'}`,
    [selectedYear, selectedMonth, selectedQuincena]
  )

  const showFeedback = useCallback((type, text) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 5000)
  }, [])

  const loadWorkspace = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      const data = await fetchResumenHorasWorkspaceData(periodKey)
      setRaw(data)
    } catch (err) {
      showFeedback('error', err?.message || 'Error al cargar Resumen Horas.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [periodKey, showFeedback])

  useEffect(() => { loadWorkspace({ silent: false }) }, [loadWorkspace])

  useSupabaseRealtimeRefresh({
    channelName: 'labor_resumen_horas_live',
    tables: RESUMEN_REALTIME_TABLES,
    onSync: () => loadWorkspace({ silent: true }),
    pauseWhen: innerTab === 'astillero',
  })

  const novedadesGroups = useMemo(
    () => buildResumenNovedadesGroups({ laborLogs: raw?.laborLogs || [], workers: raw?.workers || [], periodKey }),
    [raw, periodKey]
  )

  const settlement = useMemo(
    () => buildContratadosSettlementRows({ ...(raw || {}), periodKey }),
    [raw, periodKey]
  )

  const handleSaveObservation = async (row, nextObs) => {
    try {
      await saveContratadosRowObservationService({
        periodKey, row, observationText: nextObs, dollarRate: settlement.fortnightDollarRate, actor,
      })
      showFeedback('ok', `Observación guardada para ${row.contractorLabel}.`)
      await loadWorkspace({ silent: true })
    } catch (err) {
      showFeedback('error', err?.message || 'No se pudo guardar la observación.')
    }
  }

  const handleCloseQuincena = async () => {
    try {
      await closeQuincenaSettlementService({
        periodKey, rows: settlement.rows, totals: settlement.totals, dollarRate: settlement.fortnightDollarRate, actor,
      })
      showFeedback('ok', `Quincena ${periodKey} cerrada e inmovilizada correctamente.`)
      await loadWorkspace({ silent: true })
    } catch (err) {
      showFeedback('error', err?.message || 'Error al cerrar la quincena.')
    }
  }

  const handleReopenQuincena = async (snapshotId) => {
    try {
      await reopenQuincenaSettlementService({ snapshotId, periodKey, actor })
      showFeedback('ok', `Quincena ${periodKey} reabierta a borrador en vivo.`)
      await loadWorkspace({ silent: true })
    } catch (err) {
      showFeedback('error', err?.message || 'Error al reabrir la quincena.')
    }
  }

  const btnCls = (active) => active
    ? 'px-3.5 py-2 rounded-xl bg-purple-500 text-slate-950 font-black text-xs inline-flex items-center gap-1.5 shadow-md shadow-purple-500/20 cursor-pointer'
    : 'px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer'

  return (
    <div className="space-y-3 font-sans">
      <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-purple-500/35 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setInnerTab('resumen')} className={btnCls(innerTab === 'resumen')}>
            <ClipboardList className="w-3.5 h-3.5" />
            <span>Resumen</span>
          </button>
          <button type="button" onClick={() => setInnerTab('astillero')} className={btnCls(innerTab === 'astillero')}>
            <CalendarDays className="w-3.5 h-3.5" />
            <span>Horas Astillero</span>
          </button>
          <button type="button" onClick={() => setInnerTab('contratados')} className={btnCls(innerTab === 'contratados')}>
            <Users className="w-3.5 h-3.5" />
            <span>Contratados</span>
          </button>
          <span className="text-[11px] text-slate-400 pl-1 hidden sm:inline">
            <FileSpreadsheet className="w-3.5 h-3.5 inline mr-1 text-purple-300" />
            Liquidación privada · Solo María José y Administración
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select value={selectedQuincena} onChange={(e) => setSelectedQuincena(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white cursor-pointer">
            <option value="1">1º Quincena (01 al 15)</option>
            <option value="2">2º Quincena (16 al fin)</option>
          </select>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white cursor-pointer">
            {MONTH_NAMES.map((m, i) => <option key={m} value={String(i + 1)}>{m}</option>)}
          </select>
          <span className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs font-mono font-bold text-purple-300">
            {periodKey}
          </span>
          <button type="button" onClick={() => loadWorkspace({ silent: false })} disabled={loading} className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>
      </div>

      {feedback && (
        <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${feedback.type === 'error' ? 'bg-rose-950/80 border-rose-500/60 text-rose-200' : 'bg-emerald-950/70 border-emerald-500/50 text-emerald-200'}`}>
          {feedback.type === 'error' ? <AlertTriangle className="w-4 h-4 shrink-0" /> : <CheckCircle2 className="w-4 h-4 shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {innerTab === 'resumen' && (
        <LaborResumenNovedadesTable groups={novedadesGroups} periodKey={periodKey} loading={loading && !raw} />
      )}

      {innerTab === 'astillero' && <LaborSabanaPanel {...sabanaProps} />}

      {innerTab === 'contratados' && (
        <LaborResumenContratadosTable
          settlement={settlement} periodKey={periodKey}
          workOrders={raw?.workOrders || sabanaProps.workOrders || []}
          workItems={raw?.workItems || sabanaProps.workItems || []}
          ships={raw?.ships || sabanaProps.ships || []}
          canManage={canManage} isMasterAdmin={isMasterAdmin} loading={loading && !raw}
          onSaveObservation={handleSaveObservation} onCloseQuincena={handleCloseQuincena} onReopenQuincena={handleReopenQuincena}
        />
      )}
    </div>
  )
}
