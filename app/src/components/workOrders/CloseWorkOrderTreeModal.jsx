import { useState } from 'react'
import { Lock, CheckCircle2, AlertTriangle, X, Ship, FileText, Check } from 'lucide-react'

/**
 * CloseWorkOrderTreeModal
 * 
 * Permite cerrar o dar por finalizadas todas las subtareas de una OT en 1 solo clic.
 * Elimina la necesidad de editar cada tarea de forma individual.
 */
export default function CloseWorkOrderTreeModal({
  isOpen,
  onClose,
  wo,
  items = [],
  onConfirm,
  loading = false
}) {
  const [selectedAction, setSelectedAction] = useState('Finalizado') // 'Finalizado' | 'Facturado'
  const [allowPostBillingCosts, setAllowPostBillingCosts] = useState(false)
  const [modalError, setModalError] = useState(null)

  if (!isOpen || !wo) return null

  const activeItems = items.filter((it) => it.status !== 'Desestimado')
  const inExecutionItems = activeItems.filter((it) => it.status === 'En ejecución' || it.status === 'Pendiente de inicio')
  const alreadyClosedCount = activeItems.length - inExecutionItems.length

  const handleSubmit = async (e) => {
    e.preventDefault()
    setModalError(null)
    if (typeof onConfirm === 'function') {
      try {
        await onConfirm({
          targetStatus: selectedAction,
          allowPostBillingCosts: selectedAction === 'Facturado' ? allowPostBillingCosts : false
        })
      } catch (err) {
        setModalError(err.message || 'Error al cerrar árbol')
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150 font-sans"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-slate-900 border-2 border-purple-500/40 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Cabecera */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-950 border border-purple-700 flex items-center justify-center text-purple-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">Cerrar Árbol de la Orden de Trabajo</h3>
              <p className="text-[11px] text-slate-400">
                Acción orgánica en 1 clic para actualizar todas las subtareas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Contenido */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-950/80 border border-rose-500 rounded-xl text-rose-200 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          {/* Tarjeta de Resumen de la OT */}
          <div className="p-3 rounded-xl bg-slate-950 border border-purple-500/30 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-xs font-black text-purple-300 px-2 py-0.5 rounded bg-purple-950 border border-purple-700">
                  {wo.ot_number || 'OT'}
                </span>
                <span className="text-white font-extrabold text-sm">{wo.title}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Ship className="w-3.5 h-3.5 text-cyan-400" />
                <span>Buque: <strong className="text-slate-200">{wo.ships?.name || 'Astillero'}</strong></span>
                <span className="text-slate-600">•</span>
                <span>Jefe: <strong className="text-amber-300">{wo.foreman_name || 'Sin asignar'}</strong></span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Subtareas</span>
              <span className="text-sm font-black text-white">{activeItems.length} totales</span>
            </div>
          </div>

          {/* Lista de Subtareas afectadas */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold px-1">
              <span>Subtareas en esta OT ({activeItems.length}):</span>
              <span className="text-emerald-400">{inExecutionItems.length} activas p/ cerrar</span>
            </div>
            <div className="max-h-36 overflow-y-auto space-y-1 p-2 bg-slate-950/60 rounded-xl border border-slate-800 pr-1 text-xs">
              {activeItems.length === 0 ? (
                <div className="text-slate-500 text-center py-2 text-[11px]">
                  No hay subtareas cargadas en esta OT.
                </div>
              ) : (
                activeItems.map((it, idx) => {
                  const isClosed = it.status === 'Finalizado' || it.status === 'Facturado'
                  return (
                    <div
                      key={it.id}
                      className={`p-1.5 rounded-lg border flex items-center justify-between gap-2 text-[11px] ${
                        isClosed ? 'bg-slate-900/40 border-slate-900 text-slate-500' : 'bg-slate-900 border-slate-800 text-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 truncate">
                        <span className="font-mono text-[10px] text-slate-500">#{idx + 1}</span>
                        <span className={`truncate ${isClosed ? 'line-through text-slate-500' : ''}`}>
                          {it.description || 'Sin descripción'}
                        </span>
                      </div>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shrink-0 ${
                        it.status === 'En ejecución'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                          : isClosed
                          ? 'bg-slate-800 text-slate-400 border border-slate-700'
                          : 'bg-amber-950 text-amber-300 border border-amber-700'
                      }`}>
                        {it.status}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Selector de Acción de Cierre */}
          <div className="space-y-2 pt-1">
            <label className="block text-xs font-bold text-slate-300">
              ¿Cómo deseas dar por cerrado el árbol?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSelectedAction('Finalizado')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedAction === 'Finalizado'
                    ? 'bg-cyan-950/50 border-cyan-400 text-cyan-200 shadow-lg shadow-cyan-950/40'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs flex items-center gap-1 text-cyan-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Dar por Finalizadas</span>
                  </span>
                  {selectedAction === 'Finalizado' && <Check className="w-3.5 h-3.5 text-cyan-400" />}
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Pasa las tareas a <strong>Finalizado</strong>. Lista p/ remito y cierre administrativo sin bloquear.
                </p>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAction('Facturado')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  selectedAction === 'Facturado'
                    ? 'bg-purple-950/50 border-purple-400 text-purple-200 shadow-lg shadow-purple-950/40'
                    : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-bold text-xs flex items-center gap-1 text-purple-300">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Facturar y Cerrar</span>
                  </span>
                  {selectedAction === 'Facturado' && <Check className="w-3.5 h-3.5 text-purple-400" />}
                </div>
                <p className="text-[10px] text-slate-400 leading-relaxed">
                  Pasa a <strong>Facturado</strong> y sella la OT completa bajo bloqueo DEC-011.
                </p>
              </button>
            </div>
          </div>

          {/* Opción adicional para Facturado */}
          {selectedAction === 'Facturado' && (
            <label className="p-2.5 rounded-xl bg-purple-950/30 border border-purple-500/30 flex items-start gap-2.5 cursor-pointer text-xs">
              <input
                type="checkbox"
                checked={allowPostBillingCosts}
                onChange={(e) => setAllowPostBillingCosts(e.target.checked)}
                className="mt-0.5 rounded border-slate-700 bg-slate-900 text-purple-500 focus:ring-0 cursor-pointer accent-purple-500"
              />
              <div>
                <span className="text-purple-300 font-bold block text-[11px]">
                  Permitir arrastre de costos post-facturación (DEC-011)
                </span>
                <span className="text-[10px] text-slate-400 leading-relaxed block">
                  Habilita imputar horas o materiales tardíos que hayan quedado pendientes sin reabrir toda la obra.
                </span>
              </div>
            </label>
          )}

          {/* Pie de Acciones */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-3 py-2 rounded-xl border border-slate-800 text-slate-400 hover:text-white text-xs font-semibold cursor-pointer"
            >
              Cancelar (Esc)
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`px-4 py-2 rounded-xl text-xs font-black text-slate-950 flex items-center gap-1.5 transition-all cursor-pointer shadow-lg ${
                selectedAction === 'Facturado'
                  ? 'bg-purple-400 hover:bg-purple-300 shadow-purple-950/50'
                  : 'bg-cyan-400 hover:bg-cyan-300 shadow-cyan-950/50'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {loading
                  ? 'Cerrando Árbol...'
                  : selectedAction === 'Facturado'
                  ? 'Confirmar Facturación y Cierre Total'
                  : 'Confirmar Finalización de Tareas'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
