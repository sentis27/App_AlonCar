import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useSpreadsheetGrid } from './useSpreadsheetGrid.js'
import { useGridContextMenu } from './useGridContextMenu.js'
import { useModuleFilterMemory, resolveInitialModuleFilters } from './useModuleFilterMemory.js'
import { useAuth } from '../context/AuthContext.jsx'
import { buildPasteRowHandler, duplicateRecord } from '../lib/gridRowActions.js'
import { calculateHoursStats, buildLocalRelationsForLog } from '../lib/laborConstants.js'
import { buildLaborEligibleCatalog } from '../lib/laborWorkerCatalog.js'
import { getEnabledWorkersAndContractors } from '../lib/allocationEngine.js'
import {
  LOG_PASTE_FIELDS,
  buildHorasSpreadsheetColumns,
  computeIncompleteWorkerDateKeys,
  extractLaborFilterOptions,
  filterLaborLogs,
  applyLocalHorasBatchUpdate,
  prepareInlineLogPatch,
  buildBlankLaborLogPayload,
  buildHorasCellVisualProps
} from '../lib/laborCargaGridHelpers.js'
import {
  batchUpdateLaborLogsService,
  updateInlineLaborLogService,
  insertBlankLaborLogService
} from '../services/laborCargaService.js'

export function useLaborCargaGridState({
  ships = [],
  workOrders = [],
  workItems = [],
  dbWorkers = [],
  recentLogs = [],
  setRecentLogs,
  fetchData,
  selectedLogIds = new Set(),
  activeKpiFilter,
  setActiveKpiFilter,
  setShipPickerModal,
  setStatusMessage,
  user
}) {
  const { profile } = useAuth()
  const initialFilters = useMemo(
    () => resolveInitialModuleFilters(user, profile, 'labor_carga', activeKpiFilter && activeKpiFilter !== 'todos' ? { activeKpiFilter } : {}),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )

  const [filterWorker, setFilterWorker] = useState(initialFilters.filterWorker)
  const [filterDate, setFilterDate] = useState(initialFilters.filterDate)
  const [filterShip, setFilterShip] = useState(initialFilters.filterShip)
  const [filterOt, setFilterOt] = useState(initialFilters.filterOt)
  const [filterContractor, setFilterContractor] = useState(initialFilters.filterContractor)
  const [filterRubro, setFilterRubro] = useState(initialFilters.filterRubro)
  const [filterModality, setFilterModality] = useState(initialFilters.filterModality)
  const [inlineLogEdit, setInlineLogEdit] = useState({ id: null, field: null, value: '' })
  const [contractorPickerModal, setContractorPickerModal] = useState({
    isOpen: false,
    logId: null,
    currentValue: '',
    shipId: '',
    shipName: '',
    workOrderId: '',
    workOrderTitle: '',
    isOtBlank: true
  })
  const logSearchInputRef = useRef(null)
  const horasPasteRef = useRef(null)
  const { menuTarget, openMenu, closeMenu } = useGridContextMenu()

  const eligibleCatalog = useMemo(() => buildLaborEligibleCatalog(dbWorkers), [dbWorkers])

  const incompleteWorkerDateKeys = useMemo(
    () => computeIncompleteWorkerDateKeys(recentLogs),
    [recentLogs]
  )

  const filteredLogs = useMemo(
    () => filterLaborLogs(recentLogs, {
      filterWorker,
      filterDate,
      filterShip,
      filterOt,
      filterContractor,
      filterRubro,
      filterModality,
      activeKpiFilter,
      incompleteWorkerDateKeys
    }),
    [recentLogs, filterWorker, filterDate, filterShip, filterOt, filterContractor, filterRubro, filterModality, activeKpiFilter, incompleteWorkerDateKeys]
  )

  const { contractorOptions, rubroOptions } = useMemo(() => extractLaborFilterOptions(recentLogs), [recentLogs])

  const horasSpreadsheetColumns = useMemo(() => buildHorasSpreadsheetColumns(), [])

  const showGridFeedback = useCallback((type, text) => {
    setStatusMessage?.({ type: type === 'error' ? 'error' : 'success', text })
  }, [setStatusMessage])

  const handleHorasBatchUpdate = useCallback(async ({ colKey, newValue, targetIds, revertMap, isRevert }) => {
    if (isRevert && revertMap) {
      setRecentLogs(prev => applyLocalHorasBatchUpdate(prev, { colKey, revertMap, isRevert: true, ships, workOrders }))
      return
    }
    if (!targetIds || targetIds.length === 0) return

    setRecentLogs(prev => applyLocalHorasBatchUpdate(prev, { colKey, newValue, targetIds, isRevert: false, ships, workOrders }))
    try {
      await batchUpdateLaborLogsService({
        colKey,
        newValue,
        targetIds,
        recentLogs,
        workItems,
        userEmail: user?.email
      })
      showGridFeedback('success', `Se actualizaron ${targetIds.length} imputación(es).`)
    } catch (err) {
      console.error(err)
      showGridFeedback('error', 'Error al actualizar: ' + err.message)
      fetchData?.()
    }
  }, [recentLogs, ships, workOrders, workItems, showGridFeedback, fetchData, setRecentLogs, user?.email])

  const activateHorasCell = useCallback((log, colKey) => {
    if (!log) return
    if (colKey === 'ship_wo') {
      setShipPickerModal({
        isOpen: true,
        logId: log.id,
        rowIndex: null,
        currentShipId: log.ship_id || log.work_orders?.ship_id || '',
        currentWorkOrderId: log.work_order_id || '',
        workerName: log.worker_name || ''
      })
      return
    }
    if (colKey === 'worker_name') {
      const effShipId = log.ship_id || log.work_orders?.ship_id || ''
      const effShip = ships.find(s => String(s.id) === String(effShipId))
      const effWo = workOrders.find(w => String(w.id) === String(log.work_order_id))
      setContractorPickerModal({
        isOpen: true,
        logId: log.id,
        currentValue: log.worker_name || '',
        shipId: effShipId,
        shipName: effShip?.name || log.ships?.name || 'Astillero',
        workOrderId: log.work_order_id || '',
        workOrderTitle: effWo ? `${effWo.ot_number ? `#${effWo.ot_number} ` : ''}${effWo.title}` : '',
        isOtBlank: !log.work_order_id
      })
      return
    }
    setInlineLogEdit({ id: log.id, field: colKey, value: log[colKey] ?? '' })
  }, [setShipPickerModal, ships, workOrders])

  const horasGrid = useSpreadsheetGrid({
    rows: filteredLogs,
    columns: horasSpreadsheetColumns,
    getRowId: (row) => row.id,
    storageKey: 'aloncar_grid_horas',
    onBatchUpdate: handleHorasBatchUpdate,
    onPasteRow: (args) => horasPasteRef.current?.(args),
    onCellActivate: (row, colDef) => activateHorasCell(row, colDef.key),
    onFocusSearch: () => {
      logSearchInputRef.current?.focus()
      logSearchInputRef.current?.select()
    },
    showFeedback: showGridFeedback
  })

  useEffect(() => {
    horasPasteRef.current = buildPasteRowHandler({
      table: 'labor_logs',
      entityType: 'daily_labor_logs',
      fields: LOG_PASTE_FIELDS,
      grid: horasGrid,
      setList: setRecentLogs,
      mergeLocal: (row, patch) => ({
        ...row,
        ...patch,
        ...('work_order_id' in patch || 'ship_id' in patch
          ? buildLocalRelationsForLog(patch.ship_id ?? row.ship_id, patch.work_order_id ?? row.work_order_id, ships, workOrders)
          : {})
      }),
      nameOf: (r) => `${r.worker_name || ''} ${r.date_logged || ''}`.trim() || r.id,
      showFeedback: showGridFeedback,
      user: user?.email
    })
  })

  const getHorasCellProps = useCallback(
    (rowIndex, colKey) => buildHorasCellVisualProps(horasGrid, horasSpreadsheetColumns, rowIndex, colKey),
    [horasGrid, horasSpreadsheetColumns]
  )

  const saveInlineLogEdit = async (logId, field, newValue) => {
    setInlineLogEdit({ id: null, field: null, value: '' })
    const targetLog = recentLogs.find(l => l.id === logId)
    const { shouldSkip, cleanedVal, extraPayload } = prepareInlineLogPatch(targetLog, field, newValue, { eligibleCatalog })
    if (shouldSkip) return

    setRecentLogs(prev => prev.map(l => (l.id === logId ? { ...l, [field]: cleanedVal, ...extraPayload } : l)))
    try {
      await updateInlineLaborLogService({
        logId,
        field,
        cleanedVal,
        extraPayload,
        targetLog,
        userEmail: user?.email
      })
      showGridFeedback('success', 'Imputación actualizada.')
    } catch (err) {
      console.error(err)
      showGridFeedback('error', 'Error al guardar: ' + err.message)
      setRecentLogs(prev => prev.map(l => (l.id === logId ? targetLog : l)))
    }
  }

  const handleDuplicateRow = async (sourceLog) => {
    if (!sourceLog) return
    try {
      const created = await duplicateRecord({
        table: 'labor_logs',
        entityType: 'daily_labor_logs',
        source: sourceLog,
        fields: ['date_logged', 'worker_name', 'worker_type', 'cost_center', ...LOG_PASTE_FIELDS],
        nameOf: (r) => `${r.worker_name || 'Operario'} ${r.date_logged || ''}`.trim(),
        user: user?.email
      })
      const hydrated = { ...created, ...buildLocalRelationsForLog(created.ship_id, created.work_order_id, ships, workOrders) }
      setRecentLogs(prev => [hydrated, ...prev])
      showGridFeedback('success', 'Fila duplicada correctamente.')
    } catch (err) {
      console.error(err)
      showGridFeedback('error', 'Error al duplicar: ' + err.message)
    }
  }

  const contractorPickerOptions = useMemo(() => {
    if (!contractorPickerModal.isOpen) return { astilleroWorkers: [], contractorGroups: [] }
    return getEnabledWorkersAndContractors(
      contractorPickerModal.shipId || null,
      contractorPickerModal.workOrderId || null,
      workItems,
      eligibleCatalog.rawEligible,
      { workOrders, strictShipFilter: Boolean(contractorPickerModal.shipId) }
    )
  }, [contractorPickerModal, workItems, eligibleCatalog.rawEligible, workOrders])

  const handleInsertRow = async () => {
    try {
      const newPayload = buildBlankLaborLogPayload()
      const data = await insertBlankLaborLogService({ newPayload, userEmail: user?.email })
      setRecentLogs(prev => [data, ...prev])
      showGridFeedback('success', 'Fila en blanco insertada al inicio.')
    } catch (err) {
      console.error(err)
      showGridFeedback('error', 'Error al insertar fila: ' + err.message)
    }
  }

  const hasActiveFilters = Boolean(filterWorker || filterDate || filterShip || filterOt !== 'todas' || filterContractor !== 'todos' || filterRubro !== 'todos' || filterModality !== 'todas' || (activeKpiFilter && activeKpiFilter !== 'todos'))
  const clearAllFilters = () => { setFilterWorker(''); setFilterDate(''); setFilterShip(''); setFilterOt('todas'); setFilterContractor('todos'); setFilterRubro('todos'); setFilterModality('todas'); setActiveKpiFilter('todos') }
  const hoursStats = useMemo(() => calculateHoursStats(filteredLogs, selectedLogIds), [filteredLogs, selectedLogIds])

  const viewsController = useModuleFilterMemory({
    moduleKey: 'labor_carga',
    currentFilters: { filterWorker, filterDate, filterShip, filterOt, filterContractor, filterRubro, filterModality, activeKpiFilter: activeKpiFilter || 'todos' },
    setters: { filterWorker: setFilterWorker, filterDate: setFilterDate, filterShip: setFilterShip, filterOt: setFilterOt, filterContractor: setFilterContractor, filterRubro: setFilterRubro, filterModality: setFilterModality, activeKpiFilter: setActiveKpiFilter },
    summaryContext: { ships, workOrders },
    hasActiveFilters
  })

  return {
    filterWorker, setFilterWorker, filterDate, setFilterDate, filterShip, setFilterShip,
    filterOt, setFilterOt, filterContractor, setFilterContractor, filterRubro, setFilterRubro, filterModality, setFilterModality,
    contractorOptions, rubroOptions, hasActiveFilters, viewsController, inlineLogEdit, setInlineLogEdit, logSearchInputRef,
    menuTarget, openMenu, closeMenu, filteredLogs, horasGrid, getHorasCellProps, activateHorasCell,
    saveInlineLogEdit, handleInsertRow, handleDuplicateRow, contractorPickerModal, setContractorPickerModal,
    contractorPickerOptions, clearAllFilters, hoursStats
  }
}
