import { useState, useCallback } from 'react'
import { auditService } from '../../lib/auditService.js'

const STORAGE_KEY_AUDIT_MAP = {
  aloncar_grid_compras: 'purchase_orders',
  aloncar_grid_horas: 'daily_labor_logs',
  aloncar_panol_grid: 'inventory',
  aloncar_grid_ships: 'ships',
  aloncar_grid_ship_stays: 'ship_stays',
  aloncar_grid_owners: 'owners',
  aloncar_grid_terceros: 'third_party_services'
}

/**
 * useGridHistory
 * Sub-hook especializado para gestionar la pila multinivel de Deshacer/Rehacer (Ctrl+Z / Ctrl+Y)
 * con persistencia aislada en sessionStorage por módulo y trazabilidad automática hacia audit_logs.
 */
export function useGridHistory({
  storageKey = 'aloncar_grid',
  maxUndoSteps = 50,
  rows = [],
  columns = [],
  getRowId = (row) => row?.id,
  onBatchUpdate,
  showFeedback
}) {
  const undoStorageKey = `${storageKey}_undo_stack`
  const redoStorageKey = `${storageKey}_redo_stack`

  // Pila de Deshacer (Undo Stack)
  const [undoStack, setUndoStack] = useState(() => {
    try {
      const saved = sessionStorage.getItem(undoStorageKey)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Pila de Rehacer (Redo Stack)
  const [redoStack, setRedoStack] = useState(() => {
    try {
      const saved = sessionStorage.getItem(redoStorageKey)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  // Sincronizar undoStack con sessionStorage (máx 50 pasos) - Polimórfico (objeto, array o callbacks)
  const pushUndoAction = useCallback((action) => {
    setRedoStack([])
    try {
      sessionStorage.removeItem(redoStorageKey)
    } catch {}

    let normalizedAction = action
    if (Array.isArray(action)) {
      const byColPrev = {}
      const byColNew = {}
      let defaultCol = ''
      action.forEach((m) => {
        const k = m.colId || m.colKey || 'value'
        defaultCol = k
        if (!byColPrev[k]) byColPrev[k] = {}
        if (!byColNew[k]) byColNew[k] = {}
        byColPrev[k][m.rowId] = m.oldValue
        byColNew[k][m.rowId] = m.newValue
      })
      normalizedAction = {
        type: 'multi_column_mutations',
        mutationsByCol: { prev: byColPrev, next: byColNew },
        colKey: defaultCol,
        colLabel: defaultCol,
        actionLabel: action[0]?.actionLabel || 'cambio'
      }
    }

    setUndoStack((prev) => {
      const next = [normalizedAction, ...prev].slice(0, maxUndoSteps)
      try {
        sessionStorage.setItem(undoStorageKey, JSON.stringify(next))
      } catch (e) {
        console.warn('Error guardando undo en sessionStorage:', e)
      }
      return next
    })

    // Registro automático en el Libro de Auditoría Global (audit_logs)
    const mappedEntityType = STORAGE_KEY_AUDIT_MAP[storageKey]
    if (mappedEntityType && normalizedAction) {
      try {
        const resolveRowName = (rId) => {
          const r = rows.find((item) => String(getRowId(item)) === String(rId))
          if (!r) return String(rId)
          return (
            r.name ||
            r.material_name_raw ||
            r.entity_name ||
            r.contractor_name ||
            r.worker_name ||
            r.ot_number ||
            r.description ||
            String(rId)
          )
        }
        if (normalizedAction.previousValues && normalizedAction.colKey) {
          const entries = Object.entries(normalizedAction.previousValues)
          const cDef = columns.find((c) => c.key === normalizedAction.colKey)
          const fLabel = normalizedAction.colLabel || cDef?.label || normalizedAction.colKey
          entries.forEach(([rId, oldVal]) => {
            auditService.logCellChange({
              entityType: mappedEntityType,
              entityId: rId,
              entityName: resolveRowName(rId),
              field: normalizedAction.colKey,
              fieldLabel: fLabel,
              oldValue: oldVal,
              newValue: normalizedAction.newValue,
              changeOrigin: entries.length > 1 ? 'BATCH_PASTE' : 'INLINE_CELL'
            })
          })
        }
      } catch (auditErr) {
        console.warn('[useGridHistory] Error enviando log de auditoría:', auditErr)
      }
    }
  }, [maxUndoSteps, undoStorageKey, redoStorageKey, storageKey, rows, getRowId, columns])

  // Deshacer el último cambio (Ctrl + Z)
  const undo = useCallback(async () => {
    if (undoStack.length === 0) {
      if (showFeedback) showFeedback('info', 'No hay más acciones para deshacer en esta planilla.')
      return
    }

    const [lastAction, ...remainingStack] = undoStack
    setUndoStack(remainingStack)
    try {
      sessionStorage.setItem(undoStorageKey, JSON.stringify(remainingStack))
    } catch {}

    setRedoStack((prev) => {
      const nextRedo = [lastAction, ...prev].slice(0, maxUndoSteps)
      try {
        sessionStorage.setItem(redoStorageKey, JSON.stringify(nextRedo))
      } catch {}
      return nextRedo
    })

    if (lastAction.undoFn && typeof lastAction.undoFn === 'function') {
      try {
        await lastAction.undoFn()
        if (showFeedback) showFeedback('success', `Deshecho (Ctrl+Z): ${lastAction.actionLabel || 'Acción revertida'}.`)
      } catch (err) {
        console.error('Error en undoFn personalizada:', err)
      }
      return
    }

    if (lastAction.type === 'multi_column_mutations' && lastAction.mutationsByCol) {
      if (onBatchUpdate) {
        for (const [colKey, revertMap] of Object.entries(lastAction.mutationsByCol.prev)) {
          await onBatchUpdate({
            colKey,
            revertMap,
            isRevert: true,
            actionLabel: lastAction.actionLabel || 'deshacer'
          })
        }
        if (showFeedback) {
          showFeedback('success', `Deshecho (Ctrl+Z): Se restauraron cambios en ${lastAction.colLabel || lastAction.colKey}.`)
        }
      }
      return
    }

    if (onBatchUpdate && lastAction.previousValues) {
      const entries = Object.entries(lastAction.previousValues)
      await onBatchUpdate({
        colKey: lastAction.colKey,
        revertMap: lastAction.previousValues,
        isRevert: true,
        actionLabel: lastAction.actionLabel || 'deshacer'
      })

      if (showFeedback) {
        showFeedback('success', `Deshecho (Ctrl+Z): Se restauraron ${entries.length} celda(s) en ${lastAction.colLabel || lastAction.colKey}.`)
      }
    }
  }, [undoStack, onBatchUpdate, maxUndoSteps, showFeedback, undoStorageKey, redoStorageKey])

  // Rehacer el último cambio deshecho (Ctrl + Y o Ctrl + Shift + Z)
  const redo = useCallback(async () => {
    if (redoStack.length === 0) {
      if (showFeedback) showFeedback('info', 'No hay más acciones para rehacer en esta planilla.')
      return
    }

    const [actionToRedo, ...remainingRedo] = redoStack
    setRedoStack(remainingRedo)
    try {
      sessionStorage.setItem(redoStorageKey, JSON.stringify(remainingRedo))
    } catch {}

    setUndoStack((prev) => {
      const nextUndo = [actionToRedo, ...prev].slice(0, maxUndoSteps)
      try {
        sessionStorage.setItem(undoStorageKey, JSON.stringify(nextUndo))
      } catch {}
      return nextUndo
    })

    if (actionToRedo.redoFn && typeof actionToRedo.redoFn === 'function') {
      try {
        await actionToRedo.redoFn()
        if (showFeedback) showFeedback('success', `Rehecho (Ctrl+Y): ${actionToRedo.actionLabel || 'Acción reaplicada'}.`)
      } catch (err) {
        console.error('Error en redoFn personalizada:', err)
      }
      return
    }

    if (actionToRedo.type === 'multi_column_mutations' && actionToRedo.mutationsByCol) {
      if (onBatchUpdate) {
        for (const [colKey, revertMap] of Object.entries(actionToRedo.mutationsByCol.next)) {
          await onBatchUpdate({
            colKey,
            revertMap,
            isRevert: true,
            actionLabel: actionToRedo.actionLabel || 'rehacer'
          })
        }
        if (showFeedback) {
          showFeedback('success', `Rehecho (Ctrl+Y): Se re-aplicó el cambio en ${actionToRedo.colLabel || actionToRedo.colKey}.`)
        }
      }
      return
    }

    if (onBatchUpdate) {
      const targetIds = Object.keys(actionToRedo.previousValues || {})
      if (actionToRedo.newValuesMap) {
        await onBatchUpdate({
          colKey: actionToRedo.colKey,
          revertMap: actionToRedo.newValuesMap,
          isRevert: true,
          actionLabel: actionToRedo.actionLabel || 'rehacer'
        })
      } else {
        await onBatchUpdate({
          colKey: actionToRedo.colKey,
          newValue: actionToRedo.newValue,
          targetIds,
          isRevert: false,
          actionLabel: 'Rehacer'
        })
      }

      if (showFeedback) {
        showFeedback('success', `Rehecho (Ctrl+Y): Se re-aplicó el cambio en ${actionToRedo.colLabel || actionToRedo.colKey}.`)
      }
    }
  }, [redoStack, onBatchUpdate, maxUndoSteps, showFeedback, undoStorageKey, redoStorageKey])

  return {
    undoStack,
    redoStack,
    pushUndoAction,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0
  }
}
