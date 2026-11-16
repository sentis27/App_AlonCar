import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import {
  COMPARATOR_VIEWS_SETTINGS_KEY,
  ADHOC_METRICS_SETTINGS_KEY
} from '../lib/drydockCatalogConstants'
import {
  RESUMEN_REALTIME_TABLES,
  fetchManagerialData,
  resolveDollarReference,
  enrichMaterialMovements,
  enrichLaborLogs,
  enrichThirdPartyServices,
  filterSelectableShipsByScope,
  computeShipManagerialSummary,
  computeComparatorDataset,
  saveSystemSettingJson,
  saveRemitoCellChangeWithAudit,
  saveRemitoActionWithAudit,
  saveAlfaRateCardWithAudit
} from '../lib/managerialSummaryService'
import { useSupabaseRealtimeRefresh } from './useSupabaseRealtimeRefresh'

/**
 * Hook orquestador del estado, datos enriquecidos, sincronización Realtime en vivo
 * y mutaciones auditadas (únicamente en sub-herramientas editables como Remito / Comparador).
 */
export function useResumenGerencialState({ actorName = 'Dirección' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState(null)
  const [scope, setScope] = useState('activas')
  const [yearFilter, setYearFilter] = useState('TODOS')
  const [selectedShipId, setSelectedShipId] = useState('')
  const [selectedOtId, setSelectedOtId] = useState('')

  const showFeedback = useCallback((type, text) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback((curr) => (curr?.text === text ? null : curr)), 4500)
  }, [])

  const markSyncedRef = useRef(null)

  const loadAll = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true)
      try {
        const res = await fetchManagerialData()
        setData(res)
        markSyncedRef.current?.()
        setSelectedShipId((prevId) => {
          if (prevId) return prevId
          const actives = filterSelectableShipsByScope(res.ships, 'activas')
          const first = actives[0] || res.ships.find((s) => s.name?.toUpperCase() !== 'ASTILLERO') || res.ships[0]
          return first?.id || ''
        })
      } catch (err) {
        if (!silent) showFeedback('error', `Error cargando Resumen Gerencial: ${err.message}`)
      } finally {
        if (!silent) setLoading(false)
      }
    },
    [showFeedback]
  )

  const { realtimeStatus, lastSyncAt, markSynced } = useSupabaseRealtimeRefresh({
    channelName: 'resumen_gerencial_live',
    tables: RESUMEN_REALTIME_TABLES,
    onSync: () => loadAll({ silent: true }),
    enabled: true
  })

  useEffect(() => {
    markSyncedRef.current = markSynced
  }, [markSynced])

  useEffect(() => {
    loadAll({ silent: false })
  }, [loadAll])

  const dollarRate = useMemo(
    () => resolveDollarReference(data?.macroVariables, data?.rateCards),
    [data?.macroVariables, data?.rateCards]
  )

  const materialRows = useMemo(
    () => (data ? enrichMaterialMovements({ ...data, defaultDollarRate: dollarRate }) : []),
    [data, dollarRate]
  )

  const laborRows = useMemo(
    () => (data ? enrichLaborLogs({ ...data, defaultDollarRate: dollarRate }) : []),
    [data, dollarRate]
  )

  const thirdPartyRows = useMemo(
    () => (data ? enrichThirdPartyServices({ ...data, defaultDollarRate: dollarRate }) : []),
    [data, dollarRate]
  )

  const availableYears = useMemo(() => {
    const yrs = new Set(
      [...materialRows, ...laborRows, ...thirdPartyRows].map((r) => r.year).filter(Boolean)
    )
    return Array.from(yrs).sort((a, b) => b.localeCompare(a))
  }, [materialRows, laborRows, thirdPartyRows])

  const selectableShips = useMemo(
    () => filterSelectableShipsByScope(data?.ships || [], scope),
    [data?.ships, scope]
  )

  const effectiveShipId = useMemo(() => {
    if (selectableShips.some((s) => s.id === selectedShipId)) return selectedShipId
    return selectableShips[0]?.id || ''
  }, [selectableShips, selectedShipId])

  const shipSummary = useMemo(() => {
    if (!data || !effectiveShipId) return null
    return computeShipManagerialSummary({
      shipId: effectiveShipId,
      activeOtId: selectedOtId || 'ALL',
      ships: data.ships,
      workOrders: data.workOrders,
      workItems: data.workItems,
      materialRows,
      laborRows,
      thirdPartyRows,
      scope,
      yearFilter
    })
  }, [data, effectiveShipId, selectedOtId, materialRows, laborRows, thirdPartyRows, scope, yearFilter])

  const comparatorData = useMemo(() => {
    if (!data) return []
    return computeComparatorDataset({
      ships: data.ships,
      workOrders: data.workOrders,
      workItems: data.workItems,
      materialRows,
      laborRows,
      thirdPartyRows,
      adhocMetricsByShip: data.adhocMetricsByShip,
      scope,
      yearFilter
    })
  }, [data, materialRows, laborRows, thirdPartyRows, scope, yearFilter])

  const handleSaveAdhocArea = useCallback(
    async (shipId, areaM2) => {
      const nextMap = { ...(data?.adhocMetricsByShip || {}), [shipId]: { areaM2 } }
      await saveSystemSettingJson(ADHOC_METRICS_SETTINGS_KEY, nextMap, actorName)
      setData((prev) => ({ ...prev, adhocMetricsByShip: nextMap }))
      showFeedback('success', 'Superficie ad-hoc (m²) actualizada.')
    },
    [data?.adhocMetricsByShip, actorName, showFeedback]
  )

  const handleSavePresetView = useCallback(
    async (viewObj) => {
      const nextViews = [viewObj, ...(data?.comparatorSavedViews || [])]
      await saveSystemSettingJson(COMPARATOR_VIEWS_SETTINGS_KEY, nextViews, actorName)
      setData((prev) => ({ ...prev, comparatorSavedViews: nextViews }))
      showFeedback('success', `Vista "${viewObj.name}" guardada.`)
    },
    [data?.comparatorSavedViews, actorName, showFeedback]
  )

  const handleDeletePresetView = useCallback(
    async (viewId) => {
      const nextViews = (data?.comparatorSavedViews || []).filter((v) => v.id !== viewId)
      await saveSystemSettingJson(COMPARATOR_VIEWS_SETTINGS_KEY, nextViews, actorName)
      setData((prev) => ({ ...prev, comparatorSavedViews: nextViews }))
    },
    [data?.comparatorSavedViews, actorName]
  )

  const handlePersistRemitoCellChange = useCallback(
    async (args) => {
      const updatedMap = await saveRemitoCellChangeWithAudit({
        ...args,
        allRemitosByShip: data?.remitosByShip || {},
        user: actorName
      })
      setData((prev) => ({ ...prev, remitosByShip: updatedMap }))
    },
    [data?.remitosByShip, actorName]
  )

  const handlePersistRemitoRowAction = useCallback(
    async (args) => {
      const updatedMap = await saveRemitoActionWithAudit({
        ...args,
        allRemitosByShip: data?.remitosByShip || {},
        user: actorName
      })
      setData((prev) => ({ ...prev, remitosByShip: updatedMap }))
    },
    [data?.remitosByShip, actorName]
  )

  const handleSaveAlfaRateCard = useCallback(
    async (args) => {
      await saveAlfaRateCardWithAudit({ ...args, user: actorName })
      setData((prev) => ({ ...prev, alfaRateCard: args.nextRates }))
      showFeedback('success', 'Tarifario Nivel Alfa actualizado con auditoría.')
    },
    [actorName, showFeedback]
  )

  return {
    data,
    loading,
    feedback,
    showFeedback,
    loadAll,
    realtimeStatus,
    lastSyncAt,
    scope,
    setScope,
    yearFilter,
    setYearFilter,
    dollarRate,
    selectedShipId: effectiveShipId,
    setSelectedShipId,
    selectedOtId,
    setSelectedOtId,
    materialRows,
    laborRows,
    thirdPartyRows,
    availableYears,
    shipSummary,
    comparatorData,
    selectableShips,
    handleSaveAdhocArea,
    handleSavePresetView,
    handleDeletePresetView,
    handlePersistRemitoCellChange,
    handlePersistRemitoRowAction,
    handleSaveAlfaRateCard
  }
}
