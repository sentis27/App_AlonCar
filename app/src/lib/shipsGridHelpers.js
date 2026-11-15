/**
 * Helpers compartidos para las grillas del módulo Flota Naval & Estadías.
 * Evita duplicar lógica de props de celda (índice numérico) y actualizaciones batch/undo.
 */

export function resolveShipsAuditUser(user, activeRolePerspective = 'admin') {
  if (user?.email) return user.email
  return activeRolePerspective === 'admin' ? 'JORGE SENTIS' : 'MARIA JOSE'
}

export function buildGridCellMeta({
  grid,
  columns,
  rowIndex,
  colKey,
  inlineEdit,
  onStartEdit,
  extraClass = ''
}) {
  const colIdx = columns.findIndex((c) => c.key === colKey)
  const isEditing = inlineEdit?.rowIndex === rowIndex && inlineEdit?.colKey === colKey
  const isActive = colIdx >= 0 && grid.isCellActive(rowIndex, colIdx)
  const isSelected = colIdx >= 0 && grid.isCellSelected(rowIndex, colIdx)
  const isFillPreview = colIdx >= 0 && grid.isCellInFillPreview(rowIndex, colIdx)
  const renderHandle = colIdx >= 0 && !isEditing && grid.shouldRenderFillHandle(rowIndex, colIdx)

  const stateClass = isEditing
    ? 'bg-slate-900 ring-2 ring-primary ring-inset z-20'
    : isActive
    ? 'bg-cyan-950/60 ring-2 ring-cyan-400 ring-inset z-10'
    : isFillPreview
    ? 'bg-cyan-500/20 ring-1 ring-cyan-400/60 ring-inset'
    : isSelected
    ? 'bg-cyan-950/30'
    : 'hover:bg-slate-800/40'

  const domProps = {
    tabIndex: -1,
    'data-row': rowIndex,
    'data-col': colKey,
    className: `relative px-3 py-2 cursor-pointer transition-colors border-r border-b border-slate-800/80 outline-none select-none ${stateClass} ${extraClass}`.trim(),
    onClick: (e) => colIdx >= 0 && grid.handleCellClick(rowIndex, colIdx, e),
    onMouseDown: (e) => colIdx >= 0 && grid.handleCellMouseDown(rowIndex, colIdx, e),
    onMouseEnter: () => colIdx >= 0 && grid.handleCellMouseEnter(rowIndex, colIdx),
    onDoubleClick: () => onStartEdit?.(rowIndex, colKey)
  }

  return { domProps, renderHandle, colIdx, isEditing }
}

export async function executeGridBatchUpdate({
  colKey,
  newValue,
  targetIds,
  revertMap,
  isRevert,
  applySingle,
  applyBatch,
  onReload
}) {
  try {
    if (isRevert && revertMap && typeof revertMap === 'object') {
      const entries = Object.entries(revertMap)
      for (const [rowId, prevValue] of entries) {
        await applySingle(rowId, colKey, prevValue, { skipAudit: false })
      }
      return entries.length
    }

    const ids = Array.isArray(targetIds) ? targetIds : Array.from(targetIds || [])
    if (ids.length === 0) return 0
    await applyBatch(ids, colKey, newValue)
    return ids.length
  } catch (err) {
    console.error('[shipsGridHelpers] Error en batch update:', err)
    if (onReload) await onReload()
    throw err
  }
}
