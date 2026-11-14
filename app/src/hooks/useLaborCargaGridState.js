import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useSpreadsheetGrid } from './useSpreadsheetGrid.js'
import { useGridContextMenu } from './useGridContextMenu.js'
import { buildPasteRowHandler } from '../lib/gridRowActions.js'
import { calculateHoursStats, buildLocalRelationsForLog } from '../lib/laborConstants.js'
import {
  LOG_PASTE_FIELDS,
  buildHorasSpreadsheetColumns,
  computeIncompleteWorkerDateKeys,
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
  const [filterWorker, setFilterWorker] = useState('')
  const [filterDate, setFilterDate] = useState('')
  const [filterShip, setFilterShip] = useState('')
  const [inlineLogEdit, setInlineLogEdit] = useState({ id: null, field: null, value: '' })
  const logSearchInputRef = useRef(null)
  const horasPasteRef = useRef(null)
  const { menuTarget, openMenu, closeMenu } = useGridContextMenu()

  const incompleteWorkerDateKeys = useMemo(
    () => computeIncompleteWorkerDateKeys(recentLogs),
    [recentLogs]
  )

  const filteredLogs = useMemo(
    () => filterLaborLogs(recentLogs, {
      filterWorker,
      filterDate,
      filterShip,
      activeKpiFilter,
      incompleteWorkerDateKeys
    }),
    [recentLogs, filterWorker, filterDate, filterShip, activeKpiFilter, incompleteWorkerDateKeys]
  )

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
        userEmail: user?.email
      })
      showGridFeedback('success', `Se actualizaron ${targetIds.length} imputación(es).`)
    } catch (err) {
      console.error(err)
      showGridFeedback('error', 'Error al actualizar: ' + err.message)
      fetchData?.()
    }
  }, [recentLogs, ships, workOrders, showGridFeedback, fetchData, setRecentLogs, user?.email])

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
    setInlineLogEdit({ id: log.id, field: colKey, value: log[colKey] ?? '' })
  }, [setShipPickerModal])

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
    const { shouldSkip, cleanedVal, extraPayload } = prepareInlineLogPatch(targetLog, field, newValue)
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

  const clearAllFilters = () => {
    setFilterWorker('')
    setFilterDate('')
    setFilterShip('')
    setActiveKpiFilter('todos')
  }

  const hoursStats = useMemo(
    () => calculateHoursStats(filteredLogs, selectedLogIds),
    [filteredLogs, selectedLogIds]
  )

  return {
    filterWorker,
    setFilterWorker,
    filterDate,
    setFilterDate,
    filterShip,
    setFilterShip,
    inlineLogEdit,
    setInlineLogEdit,
    logSearchInputRef,
    menuTarget,
    openMenu,
    closeMenu,
    filteredLogs,
    horasGrid,
    getHorasCellProps,
    activateHorasCell,
    saveInlineLogEdit,
    handleInsertRow,
    clearAllFilters,
    hoursStats
  }
}
