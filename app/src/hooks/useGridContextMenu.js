import { useState, useCallback } from 'react'

/**
 * useGridContextMenu
 *
 * Estado + disparador estándar del menú de clic derecho (`GridContextMenu`).
 * Uso en cualquier planilla:
 *
 *   const { menuTarget, openMenu, closeMenu } = useGridContextMenu()
 *   <tr onContextMenu={(e) => openMenu(e, row, rowIndex, { entityType, recordId, recordLabel }, grid)}>
 *   {menuTarget && <GridContextMenu target={menuTarget} onClose={closeMenu} ... />}
 *
 * Al abrir, deja activa la fila clickeada en la grilla para que
 * "Copiar celda / Copiar fila / Pegar / Limpiar" actúen sobre ella.
 */
export function useGridContextMenu() {
  const [menuTarget, setMenuTarget] = useState(null)

  const openMenu = useCallback((e, row, rowIndex, extra = {}, grid = null) => {
    e.preventDefault()
    e.stopPropagation()
    if (grid?.setActiveCell && grid.activeCell?.rowIndex !== rowIndex) {
      grid.setActiveCell({ rowIndex, colIndex: grid.activeCell?.colIndex ?? 0 })
      grid.setSelectionRange?.(null)
    }
    setMenuTarget({
      row,
      rowIndex,
      x: e.clientX,
      y: e.clientY,
      isRowHeader: false,
      ...extra
    })
  }, [])

  const closeMenu = useCallback(() => setMenuTarget(null), [])

  return { menuTarget, openMenu, closeMenu }
}

export default useGridContextMenu
