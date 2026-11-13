import { useState } from 'react'
import { NOMINA_ASTILLERO_BASE } from '../lib/laborConstants.js'
import { normalizeText, tabulateCrewMessage } from '../lib/aiLaborEngine.js'
import {
  LABOR_BATCH_STORAGE_KEY,
  SAMPLE_CREW_FALLBACK,
  createEmptyOperarioRow,
  consolidateSameOtRows,
  buildLaborBatchPayload
} from '../lib/laborCargaHelpers.js'
import {
  insertLaborBatchService,
  quickCreateShipAndWoService
} from '../services/laborCargaService.js'

export function useLaborCargaActions({
  ships = [],
  workOrders = [],
  workItems = [],
  dbWorkers = [],
  fetchData,
  setStatusMessage,
  user,
  crew
}) {
  const [isTabulatorOpen, setIsTabulatorOpen] = useState(false)
  const [isMultiOtMode, setIsMultiOtMode] = useState(false)
  const [rawReportText, setRawReportText] = useState('')
  const [isTabulating, setIsTabulating] = useState(false)
  const [tabulatorSummary, setTabulatorSummary] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  const handleTabulateMessage = async () => {
    if (!rawReportText.trim()) {
      setStatusMessage?.({ type: 'error', text: 'Pegá o escribí el parte de trabajo de la cuadrilla para poder tabularlo.' })
      return
    }
    setIsTabulating(true)
    setStatusMessage?.(null)
    try {
      const effectiveWorkers = dbWorkers.length > 0
        ? dbWorkers
        : NOMINA_ASTILLERO_BASE.map(w => ({ name: w.name, trade: w.defaultRubro, work_group: 'ASTILLERO', admin_center: 'ASTILLERO', status: 'ACTIVO' }))
      const result = await tabulateCrewMessage(rawReportText, {
        workers: effectiveWorkers,
        ships,
        workOrders,
        workItems,
        dateLogged: crew.dateLogged,
        userEmail: user?.email || 'Operador'
      })
      if (result.rows && result.rows.length > 0) {
        crew.setOperariosRows(result.rows)
        setIsMultiOtMode(true)
        setTabulatorSummary({
          summary: result.summary,
          engineUsed: result.engineUsed,
          promptVersion: result.promptVersion,
          tokensIn: result.tokensIn,
          tokensOut: result.tokensOut,
          llmError: result.llmError
        })
        setStatusMessage?.({ type: 'success', text: `⚡ Parte tabulado con éxito (${result.rows.length} filas en Cuadrilla).` })
      } else {
        setStatusMessage?.({ type: 'info', text: 'No se detectaron filas de operarios en el mensaje.' })
      }
    } catch (err) {
      console.error('Error tabulador:', err)
      setStatusMessage?.({ type: 'error', text: `Error al tabular: ${err.message}` })
    } finally {
      setIsTabulating(false)
    }
  }

  const handleConsolidateSameOtRows = () => {
    crew.setOperariosRows(prev => consolidateSameOtRows(prev, crew.selectedShipId, crew.selectedWorkOrderId))
    setStatusMessage?.({ type: 'info', text: 'Se consolidaron las subtareas que compartían exactamente el mismo Operario, Barco, OT y Rubro.' })
  }

  const replicateYesterday = () => {
    const saved = localStorage.getItem(LABOR_BATCH_STORAGE_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        crew.setOperariosRows(parsed.map(p => ({ ...p, id: Math.random() })))
        setStatusMessage?.({ type: 'info', text: 'Se replicó la cuadrilla cargada anteriormente.' })
      } catch (e) {
        console.error(e)
      }
    } else {
      crew.setOperariosRows(SAMPLE_CREW_FALLBACK.map((p, idx) => createEmptyOperarioRow({ ...p, id: idx + 1 })))
      setStatusMessage?.({ type: 'info', text: 'Se cargó una cuadrilla de ejemplo.' })
    }
  }

  const handleQuickCreateShipAndWoForRow = async (row) => {
    const shipNameClean = (row.ship_name_raw || '').trim().toUpperCase()
    if (!shipNameClean) return
    try {
      setSubmitting(true)
      const existingShip = ships.find(s => normalizeText(s.name) === normalizeText(shipNameClean)) || null
      const { targetShip, woData, otNumber } = await quickCreateShipAndWoService({
        shipNameClean,
        existingShip,
        workerName: row.worker_name,
        userEmail: user?.email
      })
      fetchData?.()
      crew.setOperariosRows(prev => prev.map(r => (r.id === row.id ? { ...r, ship_id: targetShip.id, work_order_id: woData.id, needs_review: false, review_warnings: [] } : r)))
      setStatusMessage?.({ type: 'success', text: `¡Barco "${shipNameClean}" y ${otNumber} creados y asignados!` })
    } catch (err) {
      console.error(err)
      setStatusMessage?.({ type: 'error', text: `No se pudo crear barco/OT: ${err.message}` })
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitBatch = async (e) => {
    e.preventDefault()
    setStatusMessage?.(null)
    const { errorMsg, payload } = buildLaborBatchPayload(crew.operariosRows, {
      selectedShipId: crew.selectedShipId,
      selectedWorkOrderId: crew.selectedWorkOrderId,
      currentWorkItem: crew.currentWorkItem,
      woByIdMap: crew.woByIdMap,
      dateLogged: crew.dateLogged,
      workType: crew.workType
    })
    if (errorMsg) {
      setStatusMessage?.({ type: 'error', text: errorMsg })
      return
    }
    setSubmitting(true)
    try {
      localStorage.setItem(LABOR_BATCH_STORAGE_KEY, JSON.stringify(crew.operariosRows))
      await insertLaborBatchService({
        payload,
        totalHorasGenerales: crew.totalHorasGenerales,
        userEmail: user?.email
      })
      setStatusMessage?.({
        type: 'success',
        text: `¡Lote guardado! Se registraron ${crew.operariosRows.length} imputaciones (${crew.totalHorasGenerales} hs).`
      })
      crew.setOperariosRows([createEmptyOperarioRow({ id: Date.now() })])
      setTabulatorSummary(null)
      fetchData?.()
    } catch (err) {
      console.error('Error al guardar horas:', err)
      setStatusMessage?.({ type: 'error', text: `Error al guardar en Supabase: ${err.message || 'Verifique conexión'}` })
    } finally {
      setSubmitting(false)
    }
  }

  return {
    isTabulatorOpen,
    setIsTabulatorOpen,
    isMultiOtMode,
    setIsMultiOtMode,
    rawReportText,
    setRawReportText,
    isTabulating,
    tabulatorSummary,
    setTabulatorSummary,
    submitting,
    handleTabulateMessage,
    handleConsolidateSameOtRows,
    replicateYesterday,
    handleQuickCreateShipAndWoForRow,
    handleSubmitBatch
  }
}
