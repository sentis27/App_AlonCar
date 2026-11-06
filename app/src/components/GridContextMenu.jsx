import { useState, useEffect, useRef } from 'react'
import {
  Copy,
  ClipboardPaste,
  History,
  ArrowUpToLine,
  ArrowDownToLine,
  Trash2,
  CopyPlus,
  Eraser,
  X,
  Clock,
  User,
  Activity,
  AlertCircle,
  FileSpreadsheet
} from 'lucide-react'
import { supabase } from '../lib/supabase'

/**
 * GridContextMenu
 * 
 * Menú contextual estándar (clic derecho) para todas las planillas de Alon Car.
 * Proporciona:
 * - Copiar celda y fila completa
 * - Pegar datos
 * - Ver historial de auditoría en vivo desde `audit_logs`
 * - Inserción de filas (arriba/abajo)
 * - Duplicación y eliminación
 * - Limpieza de celda (Supr)
 */
export default function GridContextMenu({
  target, // { x, y, row, rowIndex, colDef, colIndex, isRowHeader }
  onClose,
  onCopyCell,
  onCopyRow,
  onPaste,
  onDeleteCell,
  onInsertRowAbove,
  onInsertRowBelow,
  onDuplicateRow,
  onDeleteRow,
  entityType = 'workers',
  recordId,
  recordLabel = ''
}) {
  const menuRef = useRef(null)
  const [showHistoryModal, setShowHistoryModal] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [auditLogs, setAuditLogs] = useState([])
  const [historyError, setHistoryError] = useState(null)

  // Cerrar al hacer clic fuera o presionar Escape (si no está abierto el modal de historial)
  useEffect(() => {
    if (!target) return

    function handleGlobalClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        if (!showHistoryModal) onClose?.()
      }
    }

    function handleKeyDown(e) {
      if (e.key === 'Escape') {
        if (showHistoryModal) {
          setShowHistoryModal(false)
        } else {
          onClose?.()
        }
      }
    }

    window.addEventListener('mousedown', handleGlobalClick)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('mousedown', handleGlobalClick)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [target, onClose, showHistoryModal])

  // Cargar historial de auditoría al abrir el modal
  const handleOpenHistory = async () => {
    setShowHistoryModal(true)
    setLoadingHistory(true)
    setHistoryError(null)

    try {
      const targetId = String(recordId || target?.row?.id || '')
      if (!targetId) {
        setAuditLogs([])
        setLoadingHistory(false)
        return
      }

      // Consultar audit_logs por entity_id o entity_type
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('entity_id', targetId)
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setAuditLogs(data || [])
    } catch (err) {
      console.error('Error consultando audit_logs:', err)
      setHistoryError(err.message || 'Error al recuperar auditoría.')
    } finally {
      setLoadingHistory(false)
    }
  }

  if (!target) return null

  // Clampear posición dentro de la pantalla para evitar desbordes
  const menuWidth = 240
  const menuHeight = 320
  const posX = Math.max(10, Math.min(target.x, window.innerWidth - menuWidth - 10))
  const posY = Math.max(10, Math.min(target.y, window.innerHeight - menuHeight - 10))

  return (
    <>
      {/* Menú Contextual Flotante */}
      {!showHistoryModal && (
        <div
          ref={menuRef}
          style={{ top: posY, left: posX }}
          className="fixed z-50 w-60 rounded-xl bg-slate-900/95 border border-slate-700/80 shadow-2xl backdrop-blur-md py-1.5 text-xs text-slate-200 select-none animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Cabecera del Menú */}
          <div className="px-3 py-1.5 border-b border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
            <span className="flex items-center gap-1.5 truncate">
              <FileSpreadsheet className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span className="font-semibold text-slate-300">
                Fila #{target.rowIndex + 1}
              </span>
              {recordLabel && (
                <span className="truncate max-w-[100px] text-slate-500">
                  · {recordLabel}
                </span>
              )}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-white p-0.5 rounded"
            >
              <X className="w-3 h-3" />
            </button>
          </div>

          <div className="py-1">
            {/* 1. Copiar Celda */}
            {onCopyCell && !target.isRowHeader && (
              <button
                type="button"
                onClick={() => {
                  onCopyCell()
                  onClose?.()
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-800/80 text-slate-300 hover:text-cyan-300 flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Copy className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Copiar celda</span>
                </span>
                <kbd className="text-[10px] text-slate-500 font-mono">Ctrl+C</kbd>
              </button>
            )}

            {/* 2. Copiar Fila Completa */}
            {onCopyRow && (
              <button
                type="button"
                onClick={() => {
                  onCopyRow(target.rowIndex)
                  onClose?.()
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-800/80 text-slate-300 hover:text-cyan-300 flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Copy className="w-3.5 h-3.5 text-slate-400" />
                  <span>Copiar fila completa</span>
                </span>
              </button>
            )}

            {/* 3. Pegar */}
            {onPaste && (
              <button
                type="button"
                onClick={() => {
                  onPaste()
                  onClose?.()
                }}
                className="w-full text-left px-3 py-1.5 hover:bg-slate-800/80 text-slate-300 hover:text-cyan-300 flex items-center justify-between transition-colors"
              >
                <span className="flex items-center gap-2">
                  <ClipboardPaste className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Pegar</span>
                </span>
                <kbd className="text-[10px] text-slate-500 font-mono">Ctrl+V</kbd>
              </button>
            )}

            {/* 4. Ver Historial de Cambios */}
            <button
              type="button"
              onClick={handleOpenHistory}
              className="w-full text-left px-3 py-1.5 hover:bg-cyan-950/50 text-cyan-300 hover:text-cyan-200 flex items-center gap-2 transition-colors border-t border-slate-800/60 mt-1 pt-1.5"
            >
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-medium">Ver historial de cambios</span>
            </button>

            {/* 5. Inserciones de Fila */}
            {(onInsertRowAbove || onInsertRowBelow || onDuplicateRow) && (
              <div className="border-t border-slate-800/60 my-1 pt-1">
                {onInsertRowAbove && (
                  <button
                    type="button"
                    onClick={() => {
                      onInsertRowAbove(target.row, target.rowIndex)
                      onClose?.()
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-800/80 text-slate-300 hover:text-emerald-300 flex items-center gap-2 transition-colors"
                  >
                    <ArrowUpToLine className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Insertar fila arriba</span>
                  </button>
                )}
                {onInsertRowBelow && (
                  <button
                    type="button"
                    onClick={() => {
                      onInsertRowBelow(target.row, target.rowIndex)
                      onClose?.()
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-800/80 text-slate-300 hover:text-emerald-300 flex items-center gap-2 transition-colors"
                  >
                    <ArrowDownToLine className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Insertar fila abajo</span>
                  </button>
                )}
                {onDuplicateRow && (
                  <button
                    type="button"
                    onClick={() => {
                      onDuplicateRow(target.row, target.rowIndex)
                      onClose?.()
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-800/80 text-slate-300 hover:text-amber-300 flex items-center gap-2 transition-colors"
                  >
                    <CopyPlus className="w-3.5 h-3.5 text-amber-400" />
                    <span>Duplicar fila</span>
                  </button>
                )}
              </div>
            )}

            {/* 6. Borrado y Limpieza */}
            {(onDeleteCell || onDeleteRow) && (
              <div className="border-t border-slate-800/60 my-1 pt-1">
                {onDeleteCell && !target.isRowHeader && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteCell()
                      onClose?.()
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-slate-800/80 text-slate-300 hover:text-slate-100 flex items-center justify-between transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      <Eraser className="w-3.5 h-3.5 text-slate-400" />
                      <span>Limpiar celda</span>
                    </span>
                    <kbd className="text-[10px] text-slate-500 font-mono">Supr</kbd>
                  </button>
                )}
                {onDeleteRow && (
                  <button
                    type="button"
                    onClick={() => {
                      onDeleteRow(target.row, target.rowIndex)
                      onClose?.()
                    }}
                    className="w-full text-left px-3 py-1.5 hover:bg-rose-950/60 text-rose-400 hover:text-rose-300 flex items-center gap-2 transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                    <span>Eliminar registro</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal Canónico de Historial de Cambios (Audit Logs) */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-cyan-950/80 border border-cyan-500/40 rounded-xl text-cyan-400">
                  <History className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2">
                    <span>Historial de Auditoría y Trazabilidad</span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {entityType}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 font-mono">
                    ID: {recordId || target?.row?.id || '—'} {recordLabel ? `· ${recordLabel}` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowHistoryModal(false)
                  onClose?.()
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto flex-1 space-y-3">
              {loadingHistory ? (
                <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
                  <Activity className="w-6 h-6 text-cyan-400 animate-spin" />
                  <span className="text-xs font-mono">Consultando libro de auditoría...</span>
                </div>
              ) : historyError ? (
                <div className="p-4 bg-rose-950/40 border border-rose-500/40 rounded-xl text-rose-300 text-xs flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-rose-400 shrink-0" />
                  <span>{historyError}</span>
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-2">
                  <Clock className="w-8 h-8 text-slate-600" />
                  <p className="text-xs font-medium text-slate-400">
                    No se registran eventos históricos para este registro.
                  </p>
                  <p className="text-[11px] text-slate-500 max-w-sm">
                    Los cambios de estado, modificaciones de precios y actualizaciones se registran automáticamente aquí.
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => {
                    const dateFormatted = log.created_at
                      ? new Date(log.created_at).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })
                      : '—'

                    return (
                      <div
                        key={log.id}
                        className="p-3 bg-slate-950/50 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-cyan-300 flex items-center gap-1.5 font-mono">
                            <span className="w-2 h-2 rounded-full bg-cyan-400" />
                            {log.action}
                          </span>
                          <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {dateFormatted}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                          <User className="w-3 h-3 text-slate-500" />
                          <span>Operador:</span>
                          <span className="text-slate-300 font-mono">{log.performed_by || 'Sistema'}</span>
                        </div>

                        {log.details && (
                          <div className="mt-2 p-2 bg-slate-900/90 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                            {typeof log.details === 'object' ? (
                              <pre className="whitespace-pre-wrap text-[10px] text-slate-400">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            ) : (
                              String(log.details)
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 border-t border-slate-800 bg-slate-950/60 flex items-center justify-between text-xs text-slate-400">
              <span className="text-[11px] font-mono">
                Total de registros: {auditLogs.length}
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowHistoryModal(false)
                  onClose?.()
                }}
                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
