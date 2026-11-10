import { supabase } from './supabase.js'
import { logRowAction, sanitizeAuditValue } from './auditService.js'

/**
 * gridRowActions
 *
 * Fuente única de verdad para las acciones de FILA COMPLETA de las planillas
 * CARGA_EDICION (menú de clic derecho `GridContextMenu`):
 *   - Duplicar fila  (insert + auditoría ROW_DUPLICATE)
 *   - Pegar fila     (update de campos + auditoría BATCH_PASTE + Undo/Redo)
 *
 * Cada módulo solo declara: tabla, entityType, lista de campos clonables.
 */

/** Copia solo los campos declarados que existan en el origen (sin inventar columnas). */
export function pickFields(source, fields = []) {
  const out = {}
  if (!source) return out
  for (const f of fields) {
    if (source[f] !== undefined) out[f] = source[f]
  }
  return out
}

function toAuditScalar(val) {
  if (val && typeof val === 'object') return JSON.stringify(val)
  return sanitizeAuditValue(val)
}

/** Update directo de campos (usado también por Undo/Redo). */
export async function updateRecordFields({ table, id, patch }) {
  const { error } = await supabase.from(table).update(patch).eq('id', id)
  if (error) throw error
}

/**
 * Duplica un registro: inserta una copia con los campos indicados + overrides.
 * Devuelve el registro creado.
 */
export async function duplicateRecord({
  table,
  entityType,
  source,
  fields,
  overrides = {},
  nameOf = null,
  user = null
}) {
  if (!source) throw new Error('No hay registro origen para duplicar.')
  const payload = { ...pickFields(source, fields), ...overrides }
  const { data, error } = await supabase.from(table).insert([payload]).select().single()
  if (error) throw error

  await logRowAction({
    action: 'ROW_DUPLICATE',
    entityType,
    entityId: data.id,
    entityName: nameOf ? nameOf(data) : data.id,
    changes: { duplicated_from: source.id },
    rowData: payload,
    changeOrigin: 'CONTEXT_MENU',
    user
  })
  return data
}

/**
 * Pega los campos de `sourceRow` sobre `targetRow` (persistente + auditado).
 * Devuelve { patch, previous } para alimentar Undo/Redo y el estado local.
 */
export async function pasteRowFields({
  table,
  entityType,
  sourceRow,
  targetRow,
  fields,
  nameOf = null,
  user = null
}) {
  const patch = pickFields(sourceRow, fields)
  const previous = pickFields(targetRow, Object.keys(patch))
  await updateRecordFields({ table, id: targetRow.id, patch })

  const changes = {}
  for (const k of Object.keys(patch)) {
    const from = toAuditScalar(previous[k])
    const to = toAuditScalar(patch[k])
    if (String(from ?? '') !== String(to ?? '')) changes[k] = { from, to }
  }
  await logRowAction({
    action: 'BATCH_PASTE',
    entityType,
    entityId: targetRow.id,
    entityName: nameOf ? nameOf(targetRow) : targetRow.id,
    changes,
    changeOrigin: 'PASTE_ROW',
    user
  })
  return { patch, previous }
}

/**
 * Fábrica del callback `onPasteRow` de `useSpreadsheetGrid`.
 * Mantiene estado local, registra Undo/Redo en la grilla y avisa al usuario.
 *
 * @param {object} cfg
 * @param {string} cfg.table
 * @param {string} cfg.entityType
 * @param {string[]} cfg.fields
 * @param {object} cfg.grid           instancia de useSpreadsheetGrid
 * @param {function} cfg.setList      setState del array local de filas
 * @param {function} [cfg.mergeLocal] (row, patch) => fila local actualizada
 * @param {function} [cfg.nameOf]
 * @param {function} cfg.showFeedback (type, text)
 * @param {string}   [cfg.user]
 */
export function buildPasteRowHandler({
  table,
  entityType,
  fields,
  grid,
  setList,
  mergeLocal = (row, patch) => ({ ...row, ...patch }),
  nameOf = null,
  showFeedback,
  user = null
}) {
  return async ({ sourceRow, targetRow }) => {
    if (!sourceRow || !targetRow || sourceRow.id === targetRow.id) return
    try {
      const { patch, previous } = await pasteRowFields({
        table, entityType, sourceRow, targetRow, fields, nameOf, user
      })
      const apply = (values) =>
        setList((prev) => prev.map((r) => (r.id === targetRow.id ? mergeLocal(r, values) : r)))
      apply(patch)

      grid.pushUndoAction({
        actionLabel: 'Pegar fila completa',
        undoFn: async () => {
          await updateRecordFields({ table, id: targetRow.id, patch: previous })
          apply(previous)
        },
        redoFn: async () => {
          await updateRecordFields({ table, id: targetRow.id, patch })
          apply(patch)
        }
      })
      showFeedback?.('success', 'Fila pegada correctamente. (Ctrl+Z para deshacer)')
    } catch (err) {
      console.error(`[gridRowActions] Error pegando fila en ${table}:`, err)
      showFeedback?.('error', `Error al pegar fila: ${err.message}`)
    }
  }
}
