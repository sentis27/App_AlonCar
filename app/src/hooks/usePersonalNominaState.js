import { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from 'react'
import { useAuth } from '../context/AuthContext'
import { useModuleFilterMemory, resolveInitialModuleFilters } from './useModuleFilterMemory'
import {
  DEFAULT_ORG_ROLES,
  KNOWN_CONTRACTORS,
  KNOWN_TALLERES,
  buildNominaSearchCorpusMap,
  buildNominaContractMap,
  computeAvailableGroups,
  computeUniqueTrades,
  computeNominaKpiStats,
  filterNominaWorkers,
  computeGroupedSummary,
  computeAdminCenterCounts
} from '../lib/personalNominaHelpers'
import {
  resolveCenterDefaults,
  buildDefaultWorkerForm,
  buildWorkerFormFromRecord
} from '../lib/personalNominaFormHelpers'
import { fetchNominaAuxDataService } from '../services/personalNominaService'

export function usePersonalNominaState({
  workers = [],
  dollarRate = 1500,
  rateOficial = 16365.76
}) {
  const { user, profile } = useAuth()
  const initialFilters = useMemo(
    () => resolveInitialModuleFilters(user, profile, 'personal_nomina'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [statusMessage, setStatusMessage] = useState(null)
  const [kpiFilter, setKpiFilter] = useState(initialFilters.kpiFilter)
  const [customTrades, setCustomTrades] = useState([])
  const [isAddTradeModalOpen, setIsAddTradeModalOpen] = useState(false)
  const [newTradeInput, setNewTradeInput] = useState('')
  const [targetWorkerForNewTrade, setTargetWorkerForNewTrade] = useState(null)

  const [orgRoles, setOrgRoles] = useState(DEFAULT_ORG_ROLES)
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false)
  const [rolesFormData, setRolesFormData] = useState({})
  const [savingRoles, setSavingRoles] = useState(false)

  const [searchTerm, setSearchTerm] = useState(initialFilters.searchTerm)
  const [filterCenter, setFilterCenter] = useState(initialFilters.filterCenter)
  const [filterStatus, setFilterStatus] = useState(initialFilters.filterStatus)
  const [filterGroup, setFilterGroup] = useState(initialFilters.filterGroup)
  const [filterForemanOnly, setFilterForemanOnly] = useState(Boolean(initialFilters.filterForemanOnly))

  const [editingWorker, setEditingWorker] = useState(null)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [showGroupsView, setShowGroupsView] = useState(false)
  const [savingWorker, setSavingWorker] = useState(false)
  const [isCustomGroup, setIsCustomGroup] = useState(false)
  const [customGroupName, setCustomGroupName] = useState('')

  const [formData, setFormData] = useState(() =>
    buildDefaultWorkerForm({ adminCenter: 'ASTILLERO', dollarRate, rateOficial })
  )

  const [contextMenuTarget, setContextMenuTarget] = useState(null)
  const [inlineCellEdit, setInlineCellEdit] = useState(null)
  const nominaSearchInputRef = useRef(null)
  const nominaPasteRef = useRef(null)

  useEffect(() => {
    let active = true
    fetchNominaAuxDataService()
      .then(({ customTrades: loadedTrades, orgRolesMap }) => {
        if (!active) return
        if (loadedTrades.length > 0) setCustomTrades(loadedTrades)
        if (Object.keys(orgRolesMap).length > 0) {
          setOrgRoles((prev) => ({ ...prev, ...orgRolesMap }))
        }
      })
      .catch((err) => {
        console.warn('No se pudieron cargar datos auxiliares de nómina:', err)
      })
    return () => { active = false }
  }, [])

  const showGridFeedback = useCallback((type, text, durationMs = 3200) => {
    setStatusMessage({ type, text })
    setTimeout(() => setStatusMessage(null), durationMs)
  }, [])

  const uniqueWorkGroups = useMemo(() => {
    const set = new Set()
    workers.forEach((w) => {
      if (w.work_group) set.add(w.work_group)
    })
    return Array.from(set).sort()
  }, [workers])

  const availableContractorGroups = useMemo(
    () => computeAvailableGroups(workers, 'CONTRATISTA', KNOWN_CONTRACTORS, /\s+AYUDANTE$/),
    [workers]
  )

  const availableTallerGroups = useMemo(
    () => computeAvailableGroups(workers, 'TALLER', KNOWN_TALLERES, /\s+TALLER$/),
    [workers]
  )

  const uniqueTrades = useMemo(
    () => computeUniqueTrades(workers, customTrades),
    [workers, customTrades]
  )

  const kpiStats = useMemo(() => computeNominaKpiStats(workers), [workers])

  const clearAllFilters = useCallback(() => {
    setSearchTerm('')
    setFilterCenter('todos')
    setFilterStatus('todos')
    setFilterGroup('todos')
    setFilterForemanOnly(false)
    setKpiFilter(null)
  }, [])

  const hasActiveFilters = Boolean(
    searchTerm ||
    filterCenter !== 'todos' ||
    filterStatus !== 'todos' ||
    filterGroup !== 'todos' ||
    filterForemanOnly ||
    kpiFilter
  )

  const viewsController = useModuleFilterMemory({
    moduleKey: 'personal_nomina',
    currentFilters: { searchTerm, kpiFilter, filterCenter, filterStatus, filterGroup, filterForemanOnly },
    setters: { searchTerm: setSearchTerm, kpiFilter: setKpiFilter, filterCenter: setFilterCenter, filterStatus: setFilterStatus, filterGroup: setFilterGroup, filterForemanOnly: setFilterForemanOnly },
    hasActiveFilters
  })

  const deferredSearchTerm = useDeferredValue(searchTerm)
  const searchCorpusMap = useMemo(() => buildNominaSearchCorpusMap(workers), [workers])
  const contractMap = useMemo(() => buildNominaContractMap(workers), [workers])

  const filteredWorkers = useMemo(
    () => filterNominaWorkers(workers, {
      searchTerm: deferredSearchTerm,
      filterCenter,
      filterStatus,
      filterGroup,
      filterForemanOnly,
      kpiFilter,
      searchCorpusMap
    }),
    [workers, deferredSearchTerm, filterCenter, filterStatus, filterGroup, filterForemanOnly, kpiFilter, searchCorpusMap]
  )

  const groupedSummary = useMemo(() => computeGroupedSummary(workers), [workers])
  const centerCounts = useMemo(() => computeAdminCenterCounts(workers), [workers])

  const handleAdminCenterChange = useCallback((newCenter) => {
    const defaults = resolveCenterDefaults({
      adminCenter: newCenter,
      availableContractorGroups,
      availableTallerGroups,
      dollarRate,
      rateOficial
    })
    setIsCustomGroup(false)
    setCustomGroupName('')
    setFormData((prev) => ({
      ...prev,
      admin_center: newCenter,
      ...defaults,
      contract_type: newCenter === 'ASTILLERO' ? (prev.contract_type || '') : '',
      contract_start_date: newCenter === 'ASTILLERO' ? (prev.contract_start_date || '') : ''
    }))
  }, [availableContractorGroups, availableTallerGroups, dollarRate, rateOficial])

  const handleOpenNew = useCallback(() => {
    const initialCenter = filterCenter !== 'todos' ? filterCenter : 'ASTILLERO'
    setIsCustomGroup(false)
    setCustomGroupName('')
    setFormData(
      buildDefaultWorkerForm({
        adminCenter: initialCenter,
        filterGroup,
        availableContractorGroups,
        availableTallerGroups,
        dollarRate,
        rateOficial
      })
    )
    setIsNewModalOpen(true)
  }, [filterCenter, filterGroup, availableContractorGroups, availableTallerGroups, dollarRate, rateOficial])

  const handleEdit = useCallback((w) => {
    setEditingWorker(w)
    const mapped = buildWorkerFormFromRecord(w, {
      availableContractorGroups,
      availableTallerGroups,
      dollarRate
    })
    setIsCustomGroup(mapped.isCustomGroup)
    setCustomGroupName(mapped.customGroupName)
    setFormData(mapped.formData)
  }, [availableContractorGroups, availableTallerGroups, dollarRate])

  return {
    statusMessage, setStatusMessage, showGridFeedback,
    kpiFilter, setKpiFilter,
    customTrades, setCustomTrades,
    isAddTradeModalOpen, setIsAddTradeModalOpen,
    newTradeInput, setNewTradeInput,
    targetWorkerForNewTrade, setTargetWorkerForNewTrade,
    orgRoles, setOrgRoles,
    isRolesModalOpen, setIsRolesModalOpen,
    rolesFormData, setRolesFormData,
    savingRoles, setSavingRoles,
    searchTerm, setSearchTerm, deferredSearchTerm, contractMap,
    filterCenter, setFilterCenter,
    filterStatus, setFilterStatus,
    filterGroup, setFilterGroup,
    filterForemanOnly, setFilterForemanOnly,
    editingWorker, setEditingWorker,
    isNewModalOpen, setIsNewModalOpen,
    showGroupsView, setShowGroupsView,
    savingWorker, setSavingWorker,
    isCustomGroup, setIsCustomGroup,
    customGroupName, setCustomGroupName,
    formData, setFormData,
    contextMenuTarget, setContextMenuTarget,
    inlineCellEdit, setInlineCellEdit,
    nominaSearchInputRef, nominaPasteRef,
    uniqueWorkGroups, availableContractorGroups, availableTallerGroups,
    uniqueTrades, kpiStats, filteredWorkers, groupedSummary, centerCounts,
    clearAllFilters, hasActiveFilters, viewsController,
    handleAdminCenterChange, handleOpenNew, handleEdit
  }
}
