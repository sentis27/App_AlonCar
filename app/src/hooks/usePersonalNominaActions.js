import { useCallback, useEffect } from 'react'
import { useSpreadsheetGrid } from './useSpreadsheetGrid'
import { duplicateRecord, buildPasteRowHandler } from '../lib/gridRowActions'
import { auditService } from '../lib/auditService'
import { NOMINA_COLUMNS, WORKER_CLONE_FIELDS } from '../lib/personalNominaHelpers'
import { buildWorkerPatchFromCell } from '../lib/personalNominaFormHelpers'
import {
  toggleWorkerStatusNominaService,
  toggleWorkerPermissionNominaService,
  deleteWorkerNominaService,
  batchUpdateWorkersStatusNominaService,
  batchDeleteWorkersNominaService,
  updateWorkerCellNominaService
} from '../services/personalNominaService'
import { usePersonalNominaModalActions } from './usePersonalNominaModalActions'

export function usePersonalNominaActions({
  workers,
  setWorkers,
  reloadWorkers,
  dollarRate,
  state
}) {
  const {
    showGridFeedback,
    filteredWorkers,
    inlineCellEdit, setInlineCellEdit,
    nominaSearchInputRef, nominaPasteRef
  } = state

  const applyWorkerSinglePatch = useCallback(async (rowId, colKey, rawValue) => {
    if (auditService.isInvalidEventOrObjectScalar(rawValue)) {
      console.warn('[Personal] Bloqueado intento de guardar objeto inválido en operario:', rawValue)
      return null
    }
    const targetWorker = workers.find((w) => w.id === rowId)
    if (!targetWorker) return null

    const dbPatch = buildWorkerPatchFromCell(targetWorker, colKey, rawValue, dollarRate)
    if (!dbPatch) return null

    setWorkers((prev) => prev.map((w) => (w.id === rowId ? { ...w, ...dbPatch } : w)))

    const colDef = NOMINA_COLUMNS.find((c) => c.key === colKey)
    await updateWorkerCellNominaService({
      rowId,
      colKey,
      colLabel: colDef?.label || colKey,
      oldValue: targetWorker[colKey],
      dbPatch,
      entityName: dbPatch.name || targetWorker.name || rowId
    })

    return dbPatch[colKey]
  }, [workers, dollarRate, setWorkers])

  const handleNominaBatchUpdate = useCallback(async ({ colKey, newValue, targetIds, revertMap, isRevert }) => {
    try {
      if (isRevert && revertMap) {
        for (const [id, oldVal] of Object.entries(revertMap)) {
          await applyWorkerSinglePatch(id, colKey, oldVal)
        }
      } else if (Array.isArray(targetIds)) {
        for (const id of targetIds) {
          await applyWorkerSinglePatch(id, colKey, newValue)
        }
      }
    } catch (err) {
      console.error(err)
      showGridFeedback('error', `Error actualizando padrón: ${err.message}`)
      reloadWorkers?.()
    }
  }, [applyWorkerSinglePatch, showGridFeedback, reloadWorkers])

  const nominaGrid = useSpreadsheetGrid({
    rows: filteredWorkers,
    columns: NOMINA_COLUMNS,
    getRowId: (w) => w.id,
    storageKey: 'aloncar_grid_personal',
    onBatchUpdate: handleNominaBatchUpdate,
    onPasteRow: (args) => nominaPasteRef.current?.(args),
    onFocusSearch: () => nominaSearchInputRef.current?.focus(),
    onCellActivate: (row, colDef) => {
      if (!row || !colDef) return
      setInlineCellEdit({ rowId: row.id, colKey: colDef.key, value: row[colDef.key] ?? '' })
    },
    showFeedback: showGridFeedback
  })

  useEffect(() => {
    nominaPasteRef.current = buildPasteRowHandler({
      table: 'workers',
      entityType: 'workers',
      fields: WORKER_CLONE_FIELDS,
      grid: nominaGrid,
      setList: setWorkers,
      nameOf: (r) => r.name || r.id,
      showFeedback: showGridFeedback
    })
  })

  const commitInlineWorkerEdit = async (overrideValue = undefined) => {
    if (!inlineCellEdit) return
    const { rowId, colKey } = inlineCellEdit
    const hasValidOverride = overrideValue !== undefined && !auditService.isInvalidEventOrObjectScalar(overrideValue)
    const nextVal = hasValidOverride ? overrideValue : inlineCellEdit.value
    const worker = workers.find((w) => w.id === rowId)
    setInlineCellEdit(null)
    if (!worker) return

    const oldVal = worker[colKey]
    if (String(oldVal ?? '') === String(nextVal ?? '')) return

    try {
      const savedVal = await applyWorkerSinglePatch(rowId, colKey, nextVal)
      if (savedVal !== null) {
        const colDef = NOMINA_COLUMNS.find((c) => c.key === colKey)
        nominaGrid.pushUndoAction({
          colKey,
          colLabel: colDef?.label || colKey,
          actionLabel: `Editar ${colDef?.label || colKey} de ${worker.name}`,
          previousValues: { [rowId]: oldVal },
          newValue: savedVal,
          timestamp: Date.now()
        })
        showGridFeedback('success', `Celda actualizada en ${worker.name}. (Ctrl+Z para deshacer)`)
      }
    } catch (err) {
      console.error(err)
      showGridFeedback('error', `Error al guardar celda: ${err.message}`)
      reloadWorkers?.()
    }
  }

  const toggleWorkerStatus = async (worker) => {
    const newStatus = worker.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
    try {
      setWorkers((prev) => prev.map((w) => (w.id === worker.id ? { ...w, status: newStatus } : w)))
      await toggleWorkerStatusNominaService({ worker })
    } catch (err) {
      console.error(err)
      reloadWorkers?.()
    }
  }

  const toggleWorkerPermission = async (worker, permType) => {
    const fieldMap = { P: 'can_withdraw_materials', H: 'can_impute_hours', '3ros': 'can_charge_third_party', JO: 'is_foreman' }
    const field = fieldMap[permType]
    if (!field) return
    const defaultVal = permType === 'P' || permType === 'H'
    const newVal = !(worker[field] ?? defaultVal)
    const isGroup3ros = permType === '3ros' && worker.work_group && worker.work_group !== 'ASTILLERO'

    try {
      setWorkers((prev) => prev.map((w) => {
        if (w.id === worker.id || (isGroup3ros && w.work_group === worker.work_group)) return { ...w, [field]: newVal }
        return w
      }))
      await toggleWorkerPermissionNominaService({ worker, permType })
    } catch (err) {
      console.error(err)
      reloadWorkers?.()
    }
  }

  const handleDelete = async (worker) => {
    if (!window.confirm(`¿Estás seguro de eliminar a ${worker.name} del Grupo ${worker.work_group}?`)) return
    try {
      setWorkers((prev) => prev.filter((w) => w.id !== worker.id))
      await deleteWorkerNominaService({ worker })
      showGridFeedback('info', `Se eliminó a ${worker.name}.`, 3000)
    } catch (err) {
      console.error(err)
      showGridFeedback('error', `Error al eliminar: ${err.message}`, 3500)
      reloadWorkers?.()
    }
  }

  const handleBatchToggleStatus = async () => {
    const selectedIds = Array.from(nominaGrid.selectedRowIds)
    if (selectedIds.length === 0) return
    const allActive = workers.filter((w) => selectedIds.includes(w.id)).every((w) => w.status === 'ACTIVO')
    const targetStatus = allActive ? 'INACTIVO' : 'ACTIVO'
    if (!window.confirm(`¿Cambiar estado a "${targetStatus}" para ${selectedIds.length} operario(s) seleccionado(s)?`)) return

    try {
      setWorkers((prev) => prev.map((w) => (selectedIds.includes(w.id) ? { ...w, status: targetStatus } : w)))
      await batchUpdateWorkersStatusNominaService({ selectedIds, targetStatus, workers })
      showGridFeedback('success', `Se actualizaron ${selectedIds.length} operario(s) a ${targetStatus}.`)
      nominaGrid.clearSelectedRows()
    } catch (err) {
      console.error('Error en actualización en lote:', err)
      showGridFeedback('error', `Error al actualizar en lote: ${err.message}`)
      reloadWorkers?.()
    }
  }

  const handleBatchDeleteWorkers = async () => {
    const selectedIds = Array.from(nominaGrid.selectedRowIds)
    if (selectedIds.length === 0) return
    if (!window.confirm(`⚠️ ¡ATENCIÓN! ¿Eliminar permanentemente ${selectedIds.length} operario(s) seleccionado(s)?`)) return

    try {
      setWorkers((prev) => prev.filter((w) => !selectedIds.includes(w.id)))
      await batchDeleteWorkersNominaService({ selectedIds, workers })
      showGridFeedback('info', `Se eliminaron ${selectedIds.length} operario(s).`)
      nominaGrid.clearSelectedRows()
    } catch (err) {
      console.error('Error eliminando en lote:', err)
      showGridFeedback('error', `Error al eliminar en lote: ${err.message}`)
      reloadWorkers?.()
    }
  }

  const handleDuplicateWorkerRow = async (w) => {
    if (!w) return
    try {
      const created = await duplicateRecord({
        table: 'workers',
        entityType: 'workers',
        source: w,
        fields: WORKER_CLONE_FIELDS,
        overrides: { name: `${w.name || 'Operario'} (COPIA)`, is_foreman: false },
        nameOf: (r) => r.name || r.id
      })
      showGridFeedback('success', `Operario duplicado como "${created.name}".`)
      reloadWorkers?.()
    } catch (err) {
      console.error(err)
      showGridFeedback('error', `Error al duplicar operario: ${err.message}`)
    }
  }

  const modalActions = usePersonalNominaModalActions({
    workers,
    setWorkers,
    dollarRate,
    state,
    applyWorkerSinglePatch
  })

  return {
    nominaGrid,
    commitInlineWorkerEdit,
    toggleWorkerStatus,
    toggleWorkerPermission,
    handleDelete,
    handleBatchToggleStatus,
    handleBatchDeleteWorkers,
    handleDuplicateWorkerRow,
    ...modalActions
  }
}
