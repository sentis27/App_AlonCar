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
  FileSpreadsheet,
  ArrowRight
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { AUDIT_ACTION_LABELS, AUDIT_ENTITY_CATALOG } from '../lib/auditService'

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
  customActions = [],
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

  // ==========================================================================
  // REGISTRO DECLARATIVO DE ACCIONES (Single Source of Truth del menú)
  // Para sumar una función nueva a TODAS las planillas: agregar un ítem aquí.
  // Para una función puntual de un módulo: pasar `customActions` por prop.
  // Cada ítem: { id, label, icon, shortcut, visible, onClick, iconClass, hoverClass, bold }
  // ==========================================================================
  const sections = [
    {
      id: 'clipboard',
      items: [
        { id: 'copy-cell', label: 'Copiar celda', icon: Copy, shortcut: 'Ctrl+C', visible: Boolean(onCopyCell) && !target.isRowHeader, onClick: () => onCopyCell() },
        { id: 'copy-row', label: 'Copiar fila completa', icon: Copy, iconClass: 'text-slate-400', visible: Boolean(onCopyRow), onClick: () => onCopyRow(target.rowIndex) },
        { id: 'paste', label: 'Pegar', icon: ClipboardPaste, shortcut: 'Ctrl+V', visible: Boolean(onPaste), onClick: () => onPaste() }
      ]
    },
    {
      id: 'audit',
      items: [
        { id: 'history', label: 'Ver historial de cambios', icon: History, bold: true, visible: true, keepOpen: true, hoverClass: 'hover:bg-cyan-950/50 text-cyan-300 hover:text-cyan-200', onClick: handleOpenHistory }
      ]
    },
    {
      id: 'mutations',
      items: [
        { id: 'insert-above', label: 'Insertar fila arriba', icon: ArrowUpToLine, iconClass: 'text-emerald-400', hoverClass: 'hover:bg-slate-800/80 text-slate-300 hover:text-emerald-300', visible: Boolean(onInsertRowAbove), onClick: () => onInsertRowAbove(target.row, target.rowIndex) },
        { id: 'insert-below', label: 'Insertar fila abajo', icon: ArrowDownToLine, iconClass: 'text-emerald-400', hoverClass: 'hover:bg-slate-800/80 text-slate-300 hover:text-emerald-300', visible: Boolean(onInsertRowBelow), onClick: () => onInsertRowBelow(target.row, target.rowIndex) },
        { id: 'duplicate-row', label: 'Duplicar fila', icon: CopyPlus, iconClass: 'text-amber-400', hoverClass: 'hover:bg-slate-800/80 text-slate-300 hover:text-amber-300', visible: Boolean(onDuplicateRow), onClick: () => onDuplicateRow(target.row, target.rowIndex) }
      ]
    },
    {
      id: 'custom',
      items: (customActions || []).map((a) => ({
        ...a,
        onClick: () => a.onClick?.(target.row, target.rowIndex, target)
      }))
    },
    {
      id: 'destructive',
      items: [
        { id: 'clear-cell', label: 'Limpiar celda', icon: Eraser, iconClass: 'text-slate-400', shortcut: 'Supr', hoverClass: 'hover:bg-slate-800/80 text-slate-300 hover:text-slate-100', visible: Boolean(onDeleteCell) && !target.isRowHeader, onClick: () => onDeleteCell() },
        { id: 'delete-row', label: 'Eliminar registro', icon: Trash2, iconClass: 'text-rose-400', hoverClass: 'hover:bg-rose-950/60 text-rose-400 hover:text-rose-300', visible: Boolean(onDeleteRow), onClick: () => onDeleteRow(target.row, target.rowIndex) }
      ]
    }
  ]

  const visibleSections = sections
    .map((sec) => ({ ...sec, items: sec.items.filter((it) => it.visible !== false) }))
    .filter((sec) => sec.items.length > 0)

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
            {visibleSections.map((section, sIdx) => (
              <div
                key={section.id}
                className={sIdx > 0 ? 'border-t border-slate-800/60 mt-1 pt-1' : ''}
              >
                {section.items.map((item) => {
                  const Icon = item.icon
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        item.onClick?.()
                        if (!item.keepOpen) onClose?.()
                      }}
                      className={`w-full text-left px-3 py-1.5 flex items-center justify-between transition-colors ${item.hoverClass || 'hover:bg-slate-800/80 text-slate-300 hover:text-cyan-300'}`}
                    >
                      <span className="flex items-center gap-2">
                        {Icon && <Icon className={`w-3.5 h-3.5 ${item.iconClass || 'text-cyan-400'}`} />}
                        <span className={item.bold ? 'font-medium' : ''}>{item.label}</span>
                      </span>
                      {item.shortcut && (
                        <kbd className="text-[10px] text-slate-500 font-mono">{item.shortcut}</kbd>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
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

                    const actionMeta = AUDIT_ACTION_LABELS[log.action] || {
                      label: log.action,
                      badge: 'bg-slate-800 text-cyan-300 border-slate-700'
                    }
                    const detailsObj = typeof log.details === 'object' && log.details !== null ? log.details : null
                    const hasFieldDiff = detailsObj && (detailsObj.field || detailsObj.old_value !== undefined || detailsObj.new_value !== undefined)
                    const sheetLabel = detailsObj?.sheet_name || AUDIT_ENTITY_CATALOG[log.entity_type]?.label || log.entity_type

                    return (
                      <div
                        key={log.id}
                        className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl hover:border-slate-700 transition-colors space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded border font-mono ${actionMeta.badge}`}>
                              {actionMeta.label}
                            </span>
                            {sheetLabel && (
                              <span className="text-[10px] text-slate-400 font-mono">
                                {sheetLabel}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1 shrink-0">
                            <Clock className="w-3 h-3 text-cyan-400" />
                            {dateFormatted}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-400 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5">
                            <User className="w-3 h-3 text-slate-500" />
                            <span>Usuario:</span>
                            <span className="text-slate-200 font-semibold font-mono">{log.performed_by || 'Sistema'}</span>
                          </div>
                          {log.entity_name && (
                            <span className="text-[10px] text-slate-400 font-mono truncate max-w-[240px]">
                              Reg: <strong className="text-slate-200">{log.entity_name}</strong>
                            </span>
                          )}
                        </div>

                        {hasFieldDiff ? (
                          <div className="mt-1.5 p-2.5 bg-slate-900/90 rounded-lg border border-slate-800 flex flex-wrap items-center gap-2 text-xs font-mono">
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 text-[10px] font-bold">
                              {detailsObj.field_label || detailsObj.field || 'Campo'}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/50 line-through">
                              {detailsObj.old_value !== null && detailsObj.old_value !== undefined && String(detailsObj.old_value) !== ''
                                ? String(detailsObj.old_value)
                                : '(vacío)'}
                            </span>
                            <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                            <span className="px-2 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 font-bold">
                              {detailsObj.new_value !== null && detailsObj.new_value !== undefined && String(detailsObj.new_value) !== ''
                                ? String(detailsObj.new_value)
                                : '(vacío)'}
                            </span>
                          </div>
                        ) : log.details ? (
                          <div className="mt-1.5 p-2 bg-slate-900/90 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto">
                            {typeof log.details === 'object' ? (
                              <pre className="whitespace-pre-wrap text-[10px] text-slate-400">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            ) : (
                              String(log.details)
                            )}
                          </div>
                        ) : null}
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
