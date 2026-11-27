import { useState, useEffect, useCallback, useMemo } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { useSupabaseRealtimeRefresh } from './useSupabaseRealtimeRefresh.js'
import { matchesUniversalSearch } from '../lib/searchEngine.js'
import {
  getCurrentQuincenaKeyAr,
  listRecentQuincenaOptions,
} from '../lib/costControlPeriodHelpers.js'
import {
  fetchCostControlDataService,
  batchUpdateMaterialsAllocationService,
  updateLaborLogFromCostControlService,
  splitLaborLogForMaterialService,
  saveCostControlReviewService,
  revokeCostControlReviewService,
} from '../services/costControlService.js'

const REALTIME_TABLES = ['inventory_transactions', 'labor_logs', 'cost_control_reviews', 'work_orders']

export function useCostControlState({ pauseRealtime = false } = {}) {
  const { profile, user } = useAuth()
  const userLabel = profile?.full_name || user?.email || 'Administrador'

  const [periodKey, setPeriodKey] = useState(() => getCurrentQuincenaKeyAr())
  const quincenaOptions = useMemo(() => listRecentQuincenaOptions(14), [])

  const [contractorFilter, setContractorFilter] = useState('')
  const [shipFilter, setShipFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('NO')
  const [searchQuery, setSearchQuery] = useState('')

  const [selectedTxIds, setSelectedTxIds] = useState(() => new Set())
  const [focusedRowId, setFocusedRowId] = useState(null)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [feedbackMsg, setFeedbackMsg] = useState(null)

  const loadPeriod = useCallback(async (targetKey, { silent = false } = {}) => {
    try {
      if (!silent) setLoading(true)
      setErrorMsg(null)
      const res = await fetchCostControlDataService(targetKey)
      setData(res)
    } catch (err) {
      setErrorMsg(err?.message || 'Error al cargar datos de Control de Gastos.')
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadPeriod(periodKey)
  }, [periodKey, loadPeriod])

  useEffect(() => {
    if (!feedbackMsg) return undefined
    const t = setTimeout(() => setFeedbackMsg(null), 4000)
    return () => clearTimeout(t)
  }, [feedbackMsg])

  useSupabaseRealtimeRefresh({
    channelName: 'control_gastos_live',
    tables: REALTIME_TABLES,
    pauseWhen: pauseRealtime || saving,
    onSync: () => loadPeriod(periodKey, { silent: true }),
  })

  const snapshot = data?.snapshot || null
  const raw = data?.raw || { transactions: [], laborLogs: [], thirdPartyServices: [], workers: [], ships: [], workOrders: [], workItems: [], materials: [], reviews: [] }
  const warnings = data?.warnings || { reviewsTableMissing: false, thirdPartyError: null, materialsError: null }

  const contractorOptions = useMemo(() => {
    const set = new Set()
    const lists = [snapshot?.contractorQueue, snapshot?.materialRows, snapshot?.laborOnlyRows, snapshot?.thirdPartyMaterialRows]
    for (const list of lists) for (const item of list || []) if (item.entity) set.add(item.entity)
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'es'))
  }, [snapshot])

  const shipOptions = useMemo(
    () => [...(raw.ships || [])].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'es')),
    [raw.ships]
  )

  const filteredMaterialRows = useMemo(() => {
    const rows = snapshot?.materialRows || []
    return rows.filter((r) => {
      if (contractorFilter && r.entity !== contractorFilter) return false
      if (shipFilter && String(r.shipId || '') !== String(shipFilter)) return false
      if (statusFilter === 'NO' && r.status !== 'NO') return false
      if (statusFilter === 'OK' && r.status !== 'OK') return false
      if (statusFilter === 'VALIDATED_EXCEPTION' && r.status !== 'VALIDATED_EXCEPTION') return false
      if (statusFilter === 'SHIP_ERROR' && !(r.status === 'NO' && r.possibleShipMatches?.length > 0)) return false
      if (statusFilter === 'PREV_QUINCENA' && !(r.status === 'NO' && r.prevQuincenaMatch)) return false
      if (searchQuery) {
        const corpus = `${r.dateAr} ${r.voucherNumber} ${r.materialName} ${r.shipName} ${r.otLabel} ${r.entity} ${r.workerName}`
        if (!matchesUniversalSearch(corpus, searchQuery)) return false
      }
      return true
    })
  }, [snapshot, contractorFilter, shipFilter, statusFilter, searchQuery])

  const focusedRow = useMemo(
    () => filteredMaterialRows.find((r) => r.id === focusedRowId) || filteredMaterialRows[0] || null,
    [filteredMaterialRows, focusedRowId]
  )

  const activeContractorEntity = contractorFilter || focusedRow?.entity || snapshot?.contractorQueue?.[0]?.entity || ''

  const handlePeriodChange = useCallback((nextKey) => {
    setSelectedTxIds(new Set())
    setFocusedRowId(null)
    setPeriodKey(nextKey)
  }, [])

  const handleSelectContractor = useCallback((nextEntity) => {
    setContractorFilter(nextEntity)
    setSelectedTxIds(new Set())
    setFocusedRowId(null)
  }, [])

  const stepNextContractor = useCallback(() => {
    const queue = snapshot?.contractorQueue || []
    if (queue.length === 0) return
    const idx = queue.findIndex((q) => q.entity === contractorFilter)
    const next = idx >= 0 ? queue[(idx + 1) % queue.length] : queue[0]
    handleSelectContractor(next.entity)
  }, [snapshot, contractorFilter, handleSelectContractor])

  const toggleSelectTx = useCallback((id) => {
    setSelectedTxIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleSelectAllVisible = useCallback((visibleIds = []) => {
    setSelectedTxIds((prev) => {
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id))
      return allSelected ? new Set() : new Set(visibleIds)
    })
  }, [])

  const clearSelection = useCallback(() => setSelectedTxIds(new Set()), [])

  const clearAllFilters = useCallback(() => {
    setContractorFilter('')
    setShipFilter('')
    setStatusFilter('NO')
    setSearchQuery('')
  }, [])

  const runMutation = useCallback(async (workFn, formatSuccess, fallbackErr) => {
    try {
      setSaving(true); setErrorMsg(null)
      const res = await workFn()
      setFeedbackMsg(typeof formatSuccess === 'function' ? formatSuccess(res) : formatSuccess)
      await loadPeriod(periodKey, { silent: true })
      return res
    } catch (err) {
      setErrorMsg(err?.message || fallbackErr)
      return null
    } finally { setSaving(false) }
  }, [loadPeriod, periodKey])

  const updateMaterialsBatch = useCallback(({ txIds, patch }) => runMutation(async () => {
    const previousRows = (snapshot?.materialRows || []).filter((r) => txIds.includes(r.id))
    const res = await batchUpdateMaterialsAllocationService({ txIds, patch, previousRows, changedBy: userLabel })
    setSelectedTxIds(new Set())
    return res
  }, (res) => `Actualizadas ${res.count} línea(s) en Materiales (auditado).`, 'Error actualizando líneas de material.'), [runMutation, snapshot, userLabel])

  const validateMaterialException = useCallback((row, reason = '') => (row?.id ? runMutation(() => saveCostControlReviewService({
    review_type: 'MATERIAL_EXCEPTION', period_key: periodKey, inventory_transaction_id: row.id,
    ship_id: row.shipId || null, work_order_id: row.workOrderId || null, contractor_entity: row.entity,
    reason: String(reason || '').trim() || 'Excepción validada por Control de Gastos', reviewed_by: userLabel,
  }), `Excepción validada para ${row.materialName}.`, 'No se pudo guardar la excepción.') : null), [runMutation, periodKey, userLabel])

  const approveLaborOnlyRow = useCallback((row) => (row?.entity ? runMutation(() => saveCostControlReviewService({
    review_type: 'LABOR_ONLY_APPROVED', period_key: periodKey, inventory_transaction_id: null,
    ship_id: row.shipId || null, work_order_id: row.workOrderId || null, contractor_entity: row.entity,
    reason: 'Solo mano de obra aprobada', reviewed_by: userLabel,
  }), `Aprobado solo mano de obra: ${row.entity} (${row.shipName}).`, 'No se pudo aprobar la fila de solo mano de obra.') : null), [runMutation, periodKey, userLabel])

  const revokeReview = useCallback((reviewKey) => (reviewKey ? runMutation(
    () => revokeCostControlReviewService({ reviewKey, reviewedBy: userLabel }),
    'Revisión revertida.', 'No se pudo revertir la revisión.'
  ) : null), [runMutation, userLabel])

  const updateLaborLog = useCallback(async ({ logId, patch, previousLog }) => Boolean(await runMutation(
    () => updateLaborLogFromCostControlService({ logId, patch, previousLog, changedBy: userLabel }),
    'Parte de horas actualizado (auditado).', 'No se pudo actualizar el parte de horas.'
  )), [runMutation, userLabel])

  const splitLaborLog = useCallback(async (params) => Boolean(await runMutation(
    () => splitLaborLogForMaterialService({ ...params, changedBy: userLabel }),
    'Fila de horas desdoblada (auditado).', 'No se pudo desdoblar la fila de horas.'
  )), [runMutation, userLabel])

  return {
    periodKey, quincenaOptions, handlePeriodChange, contractorFilter, setContractorFilter: handleSelectContractor,
    contractorOptions, shipFilter, setShipFilter, shipOptions, statusFilter, setStatusFilter,
    searchQuery, setSearchQuery, selectedTxIds, toggleSelectTx, toggleSelectAllVisible, clearSelection,
    focusedRowId, setFocusedRowId, focusedRow, activeContractorEntity, snapshot, raw, warnings,
    filteredMaterialRows, loading, saving, errorMsg, feedbackMsg, setErrorMsg, setFeedbackMsg,
    reload: () => loadPeriod(periodKey), stepNextContractor, clearAllFilters,
    updateMaterialsBatch, validateMaterialException, approveLaborOnlyRow, revokeReview, updateLaborLog, splitLaborLog,
  }
}
