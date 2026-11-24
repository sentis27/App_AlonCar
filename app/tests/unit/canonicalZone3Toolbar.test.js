import { describe, it, expect, vi } from 'vitest'
import {
  CLEAR_FILTER_BTN_CLASS,
  ZONE3_UNDO_GROUP_CLASS,
  ZONE3_VIEW_TOGGLE_GROUP_CLASS,
  getUndoButtonClass,
  getRedoButtonClass,
  getViewToggleButtonClass,
  resolveGridHistoryControl
} from '../../src/lib/filterThemeConstants.js'

describe('CanonicalZone3Toolbar — Capa 1 tokens y helpers de Zona 3', () => {
  it('CLEAR_FILTER_BTN_CLASS usa paleta roja carmín y sin ml-auto fijo', () => {
    expect(CLEAR_FILTER_BTN_CLASS).toContain('bg-rose-950')
    expect(CLEAR_FILTER_BTN_CLASS).toContain('border-rose-500')
    expect(CLEAR_FILTER_BTN_CLASS).not.toContain('ml-auto')
  })

  it('resolveGridHistoryControl soporta shape de useSpreadsheetGrid y props explícitos', () => {
    expect(resolveGridHistoryControl(null)).toBeNull()
    expect(resolveGridHistoryControl(undefined)).toBeNull()

    const undoFn = vi.fn()
    const redoFn = vi.fn()
    const fromGrid = resolveGridHistoryControl({
      canUndo: true,
      canRedo: false,
      undoStack: [{ id: 1 }, { id: 2 }, { id: 3 }],
      redoStack: [],
      undo: undoFn,
      redo: redoFn
    })
    expect(fromGrid).toEqual({
      canUndo: true,
      canRedo: false,
      undoCount: 3,
      redoCount: 0,
      onUndo: undoFn,
      onRedo: redoFn
    })

    const fromProps = resolveGridHistoryControl({
      canUndo: false,
      canRedo: true,
      undoCount: 0,
      redoCount: 2,
      onUndo: undoFn,
      onRedo: redoFn
    })
    expect(fromProps).toEqual({
      canUndo: false,
      canRedo: true,
      undoCount: 0,
      redoCount: 2,
      onUndo: undoFn,
      onRedo: redoFn
    })
  })

  it('clases de Undo/Redo y Filas/Fichas respetan estado activo e inactivo', () => {
    expect(ZONE3_UNDO_GROUP_CLASS).toContain('inline-flex')
    expect(ZONE3_VIEW_TOGGLE_GROUP_CLASS).toContain('inline-flex')

    expect(getUndoButtonClass(true)).toContain('amber-')
    expect(getUndoButtonClass(false)).toContain('opacity-35')
    expect(getUndoButtonClass(false)).toContain('cursor-not-allowed')

    expect(getRedoButtonClass(true)).toContain('cyan-')
    expect(getRedoButtonClass(false)).toContain('opacity-35')

    expect(getViewToggleButtonClass(true)).toContain('bg-cyan-400')
    expect(getViewToggleButtonClass(false)).toContain('text-slate-400')
  })
})
