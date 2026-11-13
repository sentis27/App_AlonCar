import { useState, useEffect, useMemo, useCallback } from 'react'
import {
  OP_INPUTS_SETTINGS_KEY,
  COMPARATOR_VIEWS_SETTINGS_KEY,
  ADHOC_METRICS_SETTINGS_KEY
} from '../lib/drydockCatalogConstants'
import {
  fetchManagerialData,
  resolveDollarReference,
  enrichMaterialMovements,
  enrichLaborLogs,
  enrichThirdPartyServices,
  computeShipManagerialSummary,
  computeComparatorDataset,
  saveSystemSettingJson,
  saveRemitoCellChangeWithAudit,
  saveRemitoActionWithAudit,
  saveAlfaRateCardWithAudit
} from '../lib/managerialSummaryService'

/**
 * Hook orquestador del estado, datos enriquecidos y mutaciones con auditoría del Resumen Gerencial.
 */
export function useResumenGerencialState({ actorName = 'Dirección' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [feedback, setFeedback] = useState(null)
  const [scope, setScope] = useState('mixto')
  const [yearFilter, setYearFilter] = useState('TODOS')
  const [dollarOverride, setDollarOverride] = useState(null)
  const [selectedShipId, setSelectedShipId] = useState('')
  const [selectedOtId, setSelectedOtId] = useState('')

  const showFeedback = useCallback((type, text) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback((curr) => (curr?.text === text ? null : curr)), 4500)
  }, [])

  const loadAll = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetchManagerialData()
      setData(res)
      setSelectedShipId((prevId) => {
        if (prevId) return prevId
        const firstActive =
          res.ships.find((s) => s.name?.toUpperCase() !== 'ASTILLERO') || res.ships[0]
        return firstActive?.id || ''
      })
    } catch (err) {
      showFeedback('error', `Error cargando Resumen Gerencial: ${err.message}`)
    } finally {
      setLoading(false)
    }
  }, [showFeedback])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const dollarRate = useMemo(
    () => resolveDollarReference(data?.macroVariables, data?.rateCards, dollarOverride),
    [data?.macroVariables, data?.rateCards, dollarOverride]
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

  const shipSummary = useMemo(() => {
    if (!data || !selectedShipId) return null
    return computeShipManagerialSummary({
      shipId: selectedShipId,
      activeOtId: selectedOtId || 'ALL',
      ships: data.ships,
      workOrders: data.workOrders,
      workItems: data.workItems,
      materialRows,
      laborRows,
      thirdPartyRows,
      operationalInputsByShip: data.operationalInputsByShip,
      scope,
      yearFilter
    })
  }, [
    data,
    selectedShipId,
    selectedOtId,
    materialRows,
    laborRows,
    thirdPartyRows,
    scope,
    yearFilter
  ])

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

  const selectableShips = useMemo(
    () => (data?.ships || []).filter((s) => s.name?.toUpperCase() !== 'ASTILLERO'),
    [data?.ships]
  )

  const handleSaveCraneHours = useCallback(
    async ({ level, shipId, otId, field, value }) => {
      const currMap = data?.operationalInputsByShip || {}
      const currShip = currMap[shipId] || {}
      const nextShip =
        level === 'SHIP'
          ? { ...currShip, [field]: value }
          : {
              ...currShip,
              byOt: {
                ...(currShip.byOt || {}),
                [otId]: { ...(currShip.byOt?.[otId] || {}), [field]: value }
              }
            }
      const nextMap = { ...currMap, [shipId]: nextShip }
      await saveSystemSettingJson(OP_INPUTS_SETTINGS_KEY, nextMap, actorName)
      setData((prev) => ({ ...prev, operationalInputsByShip: nextMap }))
      showFeedback('success', 'Horas de equipo guardadas en system_settings.')
    },
    [data?.operationalInputsByShip, actorName, showFeedback]
  )

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
    scope,
    setScope,
    yearFilter,
    setYearFilter,
    dollarRate,
    setDollarOverride,
    selectedShipId,
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
    handleSaveCraneHours,
    handleSaveAdhocArea,
    handleSavePresetView,
    handleDeletePresetView,
    handlePersistRemitoCellChange,
    handlePersistRemitoRowAction,
    handleSaveAlfaRateCard
  }
}
