import { useState, useMemo, useEffect, useCallback } from 'react'
import {
  createEmptyOperarioRow,
  getEnabledContractorsForShip,
  getAvailableWorkOrders,
  getActiveItemsForSelectedWo,
  buildCrewRowsForContractor,
  buildPresetOperarioRow,
  applyOperarioRowFieldUpdate,
  applyHomonymCandidateToRow,
  computeDraftWorkerSummary
} from '../lib/laborCargaHelpers.js'

export function useLaborCargaCrewState({
  workOrders = [],
  workItems = [],
  dbWorkers = []
}) {
  const [selectedShipId, setSelectedShipId] = useState('')
  const [selectedContractorGroup, setSelectedContractorGroup] = useState('ASTILLERO')
  const [selectedWorkOrderId, setSelectedWorkOrderId] = useState('')
  const [selectedWorkItemId, setSelectedWorkItemId] = useState('')
  const [dateLogged, setDateLogged] = useState(() => new Date().toISOString().split('T')[0])
  const [workType, setWorkType] = useState('MONTAJE')
  const [openRubroEmergencyIds, setOpenRubroEmergencyIds] = useState(() => new Set())
  const [operariosRows, setOperariosRows] = useState(() => [createEmptyOperarioRow({ id: 1 })])

  const woByIdMap = useMemo(() => {
    const m = {}
    workOrders.forEach(w => { m[w.id] = w })
    return m
  }, [workOrders])

  const shipWorkItemsAll = useMemo(() => {
    if (!selectedShipId) return []
    return workItems.filter(item => {
      const wo = woByIdMap[item.work_order_id]
      return wo && wo.ship_id === selectedShipId
    })
  }, [workItems, woByIdMap, selectedShipId])

  const activeWorkItemsForShip = useMemo(
    () => shipWorkItemsAll.filter(item => item.status === 'En ejecución'),
    [shipWorkItemsAll]
  )

  const blockedWorkItemsForShip = useMemo(
    () => shipWorkItemsAll.filter(item => item.status !== 'En ejecución'),
    [shipWorkItemsAll]
  )

  const enabledContractorsForShip = useMemo(
    () => getEnabledContractorsForShip(selectedShipId, activeWorkItemsForShip, dbWorkers),
    [selectedShipId, activeWorkItemsForShip, dbWorkers]
  )

  const syncCrewWithContractor = useCallback((newContractor) => {
    setOperariosRows(prev => buildCrewRowsForContractor(prev, newContractor, dbWorkers))
  }, [dbWorkers])

  useEffect(() => {
    if (enabledContractorsForShip.length > 0) {
      if (!enabledContractorsForShip.includes(selectedContractorGroup)) {
        const nextContractor = enabledContractorsForShip[0]
        setSelectedContractorGroup(nextContractor)
        syncCrewWithContractor(nextContractor)
      }
    } else {
      setSelectedContractorGroup('')
    }
  }, [selectedShipId, enabledContractorsForShip, selectedContractorGroup, syncCrewWithContractor])

  const availableWorkOrders = useMemo(
    () => getAvailableWorkOrders(selectedShipId, selectedContractorGroup, activeWorkItemsForShip, workOrders),
    [selectedShipId, selectedContractorGroup, activeWorkItemsForShip, workOrders]
  )

  useEffect(() => {
    if (availableWorkOrders.length > 0) {
      if (!availableWorkOrders.some(w => w.id === selectedWorkOrderId)) {
        setSelectedWorkOrderId(availableWorkOrders[0].id)
      }
    } else {
      setSelectedWorkOrderId('')
    }
  }, [selectedShipId, selectedContractorGroup, availableWorkOrders, selectedWorkOrderId])

  const activeItemsForSelectedWo = useMemo(
    () => getActiveItemsForSelectedWo(activeWorkItemsForShip, selectedWorkOrderId, selectedContractorGroup),
    [activeWorkItemsForShip, selectedWorkOrderId, selectedContractorGroup]
  )

  useEffect(() => {
    if (activeItemsForSelectedWo.length > 0) {
      if (!activeItemsForSelectedWo.some(i => i.id === selectedWorkItemId)) {
        setSelectedWorkItemId(activeItemsForSelectedWo[0].id)
      }
      const firstItem = activeItemsForSelectedWo[0]
      if (firstItem?.work_type) setWorkType(firstItem.work_type)
    } else {
      setSelectedWorkItemId('')
    }
  }, [activeItemsForSelectedWo, selectedWorkItemId])

  const handleContractorGroupChange = (newContractor) => {
    setSelectedContractorGroup(newContractor)
    syncCrewWithContractor(newContractor)
  }

  const currentWorkOrder = workOrders.find(wo => wo.id === selectedWorkOrderId)
  const currentWorkItem = activeItemsForSelectedWo.find(i => i.id === selectedWorkItemId) || activeItemsForSelectedWo[0] || null
  const isSelectedGroupAstillero = !selectedContractorGroup || selectedContractorGroup.toUpperCase().startsWith('ASTILLERO')

  const addOperarioRow = (preset = {}) => {
    setOperariosRows(prev => [
      ...prev,
      buildPresetOperarioRow(preset, {
        isSelectedGroupAstillero,
        selectedContractorGroup,
        selectedShipId,
        selectedWorkOrderId,
        selectedWorkItemId,
        dbWorkers
      })
    ])
  }

  const removeOperarioRow = (rowId) => {
    if (operariosRows.length === 1) return
    setOperariosRows(prev => prev.filter(r => r.id !== rowId))
  }

  const updateOperarioRow = (rowId, field, value) => {
    setOperariosRows(prev => prev.map(r => (r.id === rowId ? applyOperarioRowFieldUpdate(r, field, value) : r)))
  }

  const resolveHomonymCandidate = (rowId, candidate) => {
    setOperariosRows(prev => prev.map(r => (r.id === rowId ? applyHomonymCandidateToRow(r, candidate) : r)))
  }

  const toggleRubroEmergency = (rowId) => {
    setOpenRubroEmergencyIds(prev => {
      const next = new Set(prev)
      if (next.has(rowId)) next.delete(rowId)
      else next.add(rowId)
      return next
    })
  }

  const draftWorkerSummary = useMemo(() => computeDraftWorkerSummary(operariosRows), [operariosRows])
  const totalHorasNormales = operariosRows.reduce((acc, r) => acc + (parseFloat(r.hours_normal) || 0), 0)
  const totalHoras50 = operariosRows.reduce((acc, r) => acc + (parseFloat(r.hours_extra_50) || 0), 0)
  const totalHoras100 = operariosRows.reduce((acc, r) => acc + (parseFloat(r.hours_extra_100) || 0), 0)
  const totalHorasGenerales = totalHorasNormales + totalHoras50 + totalHoras100

  return {
    selectedShipId,
    setSelectedShipId,
    selectedContractorGroup,
    selectedWorkOrderId,
    setSelectedWorkOrderId,
    selectedWorkItemId,
    setSelectedWorkItemId,
    dateLogged,
    setDateLogged,
    workType,
    setWorkType,
    openRubroEmergencyIds,
    operariosRows,
    setOperariosRows,
    woByIdMap,
    blockedWorkItemsForShip,
    enabledContractorsForShip,
    availableWorkOrders,
    activeItemsForSelectedWo,
    currentWorkOrder,
    currentWorkItem,
    isSelectedGroupAstillero,
    draftWorkerSummary,
    totalHorasNormales,
    totalHoras50,
    totalHoras100,
    totalHorasGenerales,
    handleContractorGroupChange,
    addOperarioRow,
    removeOperarioRow,
    updateOperarioRow,
    resolveHomonymCandidate,
    toggleRubroEmergency
  }
}
