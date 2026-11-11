import React, { useState, useEffect } from 'react'
import {
  Pencil,
  X,
  Ship,
  ClipboardList,
  Save,
  AlertCircle,
  AlertTriangle,
  FileText,
  Plus,
  Info,
  CheckCircle,
  Search,
  Check
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import ShipWorkOrderPickerModal from '../ShipWorkOrderPickerModal'
import { buildLocalRelationsForLog, getEnabledWosForWorkerInShip } from '../../lib/laborConstants'

// ==============================================================================
// MODAL 1: EDICIÓN COMPLETA DE REGISTRO DE HORAS
// ==============================================================================
export function EditLaborLogModal({
  editingLog,
  setEditingLog,
  editingForm,
  setEditingForm,
  savingEdit,
  handleSaveEdit,
  ships = [],
  workOrders = []
}) {
  if (!editingLog || !editingForm) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 relative">
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Pencil className="w-4 h-4 text-primary" />
              Editar Registro de Horas
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Operario: <strong className="text-white">{editingForm.worker_name}</strong> &bull; Centro Costo: <strong className="text-cyan-400">CLIENTE</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setEditingLog(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Ship className="w-3.5 h-3.5 text-cyan-400" />
                Barco / Embarcación
              </label>
              <select
                value={editingForm.ship_id || ''}
                onChange={(e) => {
                  const newShipId = e.target.value
                  const filteredWos = workOrders.filter(w => w.ship_id === newShipId)
                  setEditingForm({
                    ...editingForm,
                    ship_id: newShipId,
                    work_order_id: filteredWos[0]?.id || '',
                    shipName: ships.find(s => s.id === newShipId)?.name || 'Barco'
                  })
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
              >
                {ships.map(ship => (
                  <option key={ship.id} value={ship.id} className="bg-slate-900">
                    {ship.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-cyan-400" />
                Orden de Trabajo (OT)
              </label>
              <select
                required
                value={editingForm.work_order_id}
                onChange={(e) => setEditingForm({ ...editingForm, work_order_id: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
              >
                {(() => {
                  const currentShipId = editingForm.ship_id || ships[0]?.id
                  const filteredWos = workOrders.filter(w => w.ship_id === currentShipId)
                  if (filteredWos.length === 0) {
                    return <option value="">Sin OTs abiertas para este barco</option>
                  }
                  return filteredWos.map(wo => (
                    <option key={wo.id} value={wo.id} className="bg-slate-900">
                      {wo.title}
                    </option>
                  ))
                })()}
              </select>
            </div>
          </div>

          {(() => {
            const selectedWo = workOrders.find(w => w.id === editingForm.work_order_id)
            if (!selectedWo) return null
            return (
              <div className="p-2.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-start gap-2 text-xs">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-200">Alcance de {selectedWo.title}: </strong>
                  <span className="text-slate-400">{selectedWo.description || 'Sin descripción detallada registrada.'}</span>
                </div>
              </div>
            )
          })()}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Operario / Contratista
              </label>
              <input
                type="text"
                required
                value={editingForm.worker_name}
                onChange={(e) => setEditingForm({ ...editingForm, worker_name: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Rubro Manual
              </label>
              <input
                type="text"
                required
                value={editingForm.rubro}
                onChange={(e) => setEditingForm({ ...editingForm, rubro: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* HORAS NORMALES, EXTRAS 50% Y 100% */}
          <div className="grid grid-cols-3 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
            <div>
              <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1 text-center">
                Hs Normales
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                required
                value={editingForm.hours_normal}
                onChange={(e) => setEditingForm({ ...editingForm, hours_normal: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-white text-center font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-cyan-400 mb-1 text-center">
                Extras 50%
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={editingForm.hours_extra_50}
                onChange={(e) => setEditingForm({ ...editingForm, hours_extra_50: e.target.value })}
                className="w-full bg-slate-900 border border-cyan-800 rounded-lg px-2 py-1.5 text-xs text-cyan-300 text-center font-bold focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-[10px] uppercase font-bold text-amber-400 mb-1 text-center">
                Extras 100%
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={editingForm.hours_extra_100}
                onChange={(e) => setEditingForm({ ...editingForm, hours_extra_100: e.target.value })}
                className="w-full bg-slate-900 border border-amber-800 rounded-lg px-2 py-1.5 text-xs text-amber-300 text-center font-bold focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Fecha del Trabajo
              </label>
              <input
                type="date"
                required
                value={editingForm.date_logged}
                onChange={(e) => setEditingForm({ ...editingForm, date_logged: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Tipo de Personal
              </label>
              <select
                value={editingForm.worker_type}
                onChange={(e) => setEditingForm({ ...editingForm, worker_type: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
              >
                <option value="Astillero">Astillero</option>
                <option value="Taller">Taller</option>
                <option value="Contratista">Contratista</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Estado de Aprobación
              </label>
              <select
                value={editingForm.approval_status || ''}
                onChange={(e) => setEditingForm({ ...editingForm, approval_status: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-bold"
              >
                <option value="">- Sin Revisar -</option>
                <option value="S">S (Aprobado)</option>
                <option value="R">R (Requiere Revisión / Observado)</option>
                <option value="RR">RR (Corregido por Operario)</option>
                <option value="RRR">RRR (Aprobado Final Supervisor)</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                Observaciones
              </label>
              <input
                type="text"
                value={editingForm.notes || ''}
                placeholder="Detalle opcional..."
                onChange={(e) => setEditingForm({ ...editingForm, notes: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {editingForm.approval_status === 'R' && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-1.5 animate-in fade-in duration-150">
              <div className="flex items-center gap-1.5 text-rose-400 text-xs font-bold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>Motivo de Revisión / Duda Técnica (Auditoría)</span>
              </div>
              <p className="text-[11px] text-rose-300/80">
                Especifique la duda u observación para que el operario o supervisor pueda revisar y corregir:
              </p>
              <textarea
                rows={2}
                value={editingForm.review_reason || ''}
                onChange={(e) => setEditingForm({ ...editingForm, review_reason: e.target.value })}
                placeholder="Ej: Tareas no coinciden con la OT; exceso de horas extras al 100% no autorizadas..."
                className="w-full bg-slate-950 border border-rose-500/40 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400"
              />
            </div>
          )}

          {editingForm.approval_status === 'RR' && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-2 animate-in fade-in duration-150">
              {editingForm.review_reason && (
                <div className="text-[11px] text-amber-200/90 bg-amber-950/40 p-2 rounded border border-amber-800/40">
                  <strong className="text-amber-400 block mb-0.5 font-semibold">Duda planteada previamente (R):</strong>
                  {editingForm.review_reason}
                </div>
              )}
              <div className="flex items-center gap-1.5 text-amber-400 text-xs font-bold">
                <FileText className="w-4 h-4 shrink-0" />
                <span>Descargo / Corrección del Operario o Responsable (RR)</span>
              </div>
              <textarea
                rows={2}
                value={editingForm.worker_response || ''}
                onChange={(e) => setEditingForm({ ...editingForm, worker_response: e.target.value })}
                placeholder="Explique la corrección realizada o aclare el motivo de las horas imputadas..."
                className="w-full bg-slate-950 border border-amber-500/40 rounded-lg p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
              />
            </div>
          )}

          {(editingForm.approval_status === 'RRR' || editingForm.approval_status === 'S' || editingForm.approval_status === 'Aprobado') && editingForm.review_reason && (
            <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded-lg text-xs space-y-1">
              <div className="text-[11px] text-slate-400">
                <span className="text-rose-400 font-semibold">Observación previa (R): </span>
                {editingForm.review_reason}
              </div>
              {editingForm.worker_response && (
                <div className="text-[11px] text-slate-400">
                  <span className="text-amber-400 font-semibold">Respuesta previa (RR): </span>
                  {editingForm.worker_response}
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setEditingLog(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-5 py-2 bg-gradient-to-r from-primary to-blue-500 text-slate-950 text-xs font-bold rounded-lg shadow-md hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingEdit ? 'Guardando...' : 'Guardar Cambios'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL 2: CARGA RÁPIDA IN-SITU DESDE CONTROL DIARIO
// ==============================================================================
export function QuickLogModal({
  quickLogWorker,
  setQuickLogWorker,
  handleQuickLogSubmit,
  savingEdit,
  ships = [],
  workOrders = [],
  auditDate = '',
  getEnabledWosForWorkerInShip
}) {
  if (!quickLogWorker) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 relative">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-primary" />
              Imputar Horas a {quickLogWorker.name}
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Fecha: <strong className="text-white font-mono">{quickLogWorker.date || auditDate}</strong> &bull; Centro Costo: <strong className="text-cyan-400">CLIENTE</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => setQuickLogWorker(null)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleQuickLogSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <Ship className="w-3.5 h-3.5 text-cyan-400" />
                1. Barco / Embarcación
              </label>
              <select
                value={quickLogWorker.ship_id || ''}
                onChange={(e) => {
                  const newShipId = e.target.value
                  const filteredWos = getEnabledWosForWorkerInShip
                    ? getEnabledWosForWorkerInShip(newShipId, quickLogWorker.name, quickLogWorker.type)
                    : workOrders.filter(w => w.ship_id === newShipId)
                  setQuickLogWorker({
                    ...quickLogWorker,
                    ship_id: newShipId,
                    work_order_id: filteredWos[0]?.id || ''
                  })
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
              >
                {ships.map(ship => (
                  <option key={ship.id} value={ship.id} className="bg-slate-900">
                    {ship.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                <ClipboardList className="w-3.5 h-3.5 text-emerald-400" />
                2. OT (Opcional: puede dejarse en blanco)
              </label>
              <select
                value={quickLogWorker.work_order_id || ''}
                onChange={(e) => setQuickLogWorker({ ...quickLogWorker, work_order_id: e.target.value })}
                className={`w-full bg-slate-950 border rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-emerald-400 ${
                  !quickLogWorker.work_order_id ? 'border-amber-500/60 text-amber-300 font-semibold' : 'border-emerald-500/40 text-white'
                }`}
              >
                <option value="" className="bg-slate-900 text-amber-300 font-bold">
                  -- ⚠️ Dejar OT en blanco (Pendiente de apertura) --
                </option>
                {(() => {
                  const currentShipId = quickLogWorker.ship_id || ships[0]?.id
                  const filteredWos = getEnabledWosForWorkerInShip
                    ? getEnabledWosForWorkerInShip(currentShipId, quickLogWorker.name, quickLogWorker.type)
                    : workOrders.filter(w => w.ship_id === currentShipId)
                  return filteredWos.map(wo => (
                    <option key={wo.id} value={wo.id} className="bg-slate-900 text-white">
                      {wo.ot_number ? `${wo.ot_number} — ` : ''}{wo.title}
                    </option>
                  ))
                })()}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Rubro
              </label>
              <input
                type="text"
                required
                value={quickLogWorker.rubro || ''}
                onChange={(e) => setQuickLogWorker({ ...quickLogWorker, rubro: e.target.value })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Hs Normales
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                required
                value={quickLogWorker.hours_normal ?? 9}
                onChange={(e) => setQuickLogWorker({ ...quickLogWorker, hours_normal: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-cyan-400 mb-1">
                Extras 50%
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={quickLogWorker.hours_extra_50 ?? 0}
                onChange={(e) => setQuickLogWorker({ ...quickLogWorker, hours_extra_50: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-cyan-800 rounded-lg px-3 py-2 text-xs text-cyan-300 focus:outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-amber-400 mb-1">
                Extras 100%
              </label>
              <input
                type="number"
                step="0.5"
                min="0"
                max="24"
                value={quickLogWorker.hours_extra_100 ?? 0}
                onChange={(e) => setQuickLogWorker({ ...quickLogWorker, hours_extra_100: parseFloat(e.target.value) || 0 })}
                className="w-full bg-slate-950 border border-amber-800 rounded-lg px-3 py-2 text-xs text-amber-300 focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Observaciones
            </label>
            <input
              type="text"
              placeholder="Detalle opcional..."
              value={quickLogWorker.notes || ''}
              onChange={(e) => setQuickLogWorker({ ...quickLogWorker, notes: e.target.value })}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-300 placeholder-slate-600 focus:outline-none focus:border-primary"
            />
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => setQuickLogWorker(null)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="px-5 py-2 bg-gradient-to-r from-primary to-blue-500 text-slate-950 text-xs font-bold rounded-lg shadow-md hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingEdit ? 'Guardando...' : 'Guardar Horas'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// BARRA FIJA INFERIOR DE TOTALES Y ACCIONES MASIVAS (ZONA 5)
// ==============================================================================
export function LaborStatusBarBottom({
  hoursStats,
  selectedLogIds = new Set(),
  setSelectedLogIds,
  bulkUpdating = false,
  handleUpdateApprovalStatus
}) {
  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-64 z-40 bg-slate-950/95 border border-slate-800 rounded-2xl shadow-2xl px-4 py-2.5 backdrop-blur-md flex flex-wrap items-center justify-between gap-3 text-xs animate-in slide-in-from-bottom duration-200">
      <div className="flex items-center gap-3">
        {hoursStats.isCustomSelection ? (
          <div className="flex items-center gap-2 bg-cyan-950/80 border border-cyan-500/60 px-2.5 py-1 rounded-lg text-cyan-300 font-bold">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
            <span>📌 Selección Manual: {hoursStats.count} imputaciones</span>
            <button
              type="button"
              onClick={() => setSelectedLogIds(new Set())}
              className="ml-1 text-cyan-400 hover:text-white transition-colors cursor-pointer text-xs underline"
              title="Deseleccionar todas las filas"
            >
              ✕ Limpiar
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 px-2.5 py-1 rounded-lg text-slate-300 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>🌐 Todo el filtro: {hoursStats.count} imputaciones</span>
            <span className="text-[10px] text-slate-500 italic hidden sm:inline">(Clic en filas o casillas para sumar a tu antojo)</span>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 sm:gap-5 font-mono">
        <div className="flex items-baseline gap-1">
          <span className="text-[10px] uppercase font-bold text-slate-400">Norm:</span>
          <span className="text-xs font-bold text-white">{hoursStats.sumNorm}h</span>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-[10px] uppercase font-bold text-cyan-400">50%:</span>
          <span className="text-xs font-bold text-cyan-300">{hoursStats.sum50}h</span>
        </div>

        <div className="flex items-baseline gap-1">
          <span className="text-[10px] uppercase font-bold text-amber-400">100%:</span>
          <span className="text-xs font-bold text-amber-300">{hoursStats.sum100}h</span>
        </div>

        <div className="flex items-baseline gap-1 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
          <span className="text-[10px] uppercase font-bold text-slate-400">Total:</span>
          <span className="text-sm font-extrabold text-primary">{hoursStats.sumTotalHours} hs</span>
        </div>

        <div className="flex items-baseline gap-1 hidden md:flex">
          <span className="text-[10px] uppercase font-bold text-slate-500">Ø:</span>
          <span className="text-xs font-semibold text-slate-300">{hoursStats.avgHours.toFixed(1)}h</span>
        </div>

        {hoursStats.sumCostArs > 0 && (
          <div className="flex items-baseline gap-1 hidden lg:flex">
            <span className="text-[10px] uppercase font-bold text-slate-400">Σ AR$:</span>
            <span className="text-xs font-bold text-white">${hoursStats.sumCostArs.toLocaleString('es-AR')}</span>
          </div>
        )}

        {hoursStats.sumCostUsd > 0 && (
          <div className="flex items-baseline gap-1 hidden xl:flex">
            <span className="text-[10px] uppercase font-bold text-cyan-400">Σ US$:</span>
            <span className="text-xs font-bold text-cyan-300">${hoursStats.sumCostUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
          </div>
        )}
      </div>

      {selectedLogIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 border-l border-slate-800 pl-3">
          <span className="text-[10px] text-slate-400 font-semibold hidden sm:inline">Estado:</span>
          <button
            type="button"
            disabled={bulkUpdating}
            onClick={() => handleUpdateApprovalStatus(Array.from(selectedLogIds), 'S')}
            className="px-2 py-0.5 bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700 rounded font-bold transition-all cursor-pointer text-[10px] disabled:opacity-50"
            title="Aprobar seleccionadas (S)"
          >
            S
          </button>
          <button
            type="button"
            disabled={bulkUpdating}
            onClick={() => handleUpdateApprovalStatus(Array.from(selectedLogIds), 'R')}
            className="px-2 py-0.5 bg-rose-950/80 hover:bg-rose-900 text-rose-300 border border-rose-600 rounded font-bold transition-all cursor-pointer text-[10px] disabled:opacity-50"
            title="Requiere Revisión (R)"
          >
            R
          </button>
          <button
            type="button"
            disabled={bulkUpdating}
            onClick={() => handleUpdateApprovalStatus(Array.from(selectedLogIds), 'RR')}
            className="px-2 py-0.5 bg-amber-950/80 hover:bg-amber-900 text-amber-300 border border-amber-600 rounded font-bold transition-all cursor-pointer text-[10px] disabled:opacity-50"
            title="Corregidas por Operario (RR)"
          >
            RR
          </button>
          <button
            type="button"
            disabled={bulkUpdating}
            onClick={() => handleUpdateApprovalStatus(Array.from(selectedLogIds), 'RRR')}
            className="px-2 py-0.5 bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 border border-cyan-600 rounded font-bold transition-all cursor-pointer text-[10px] disabled:opacity-50"
            title="Aprobado Final Supervisor (RRR)"
          >
            RRR
          </button>
          <button
            type="button"
            disabled={bulkUpdating}
            onClick={() => handleUpdateApprovalStatus(Array.from(selectedLogIds), '')}
            className="px-1.5 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 rounded font-medium transition-all cursor-pointer text-[10px] disabled:opacity-50"
            title="Vaciar estado"
          >
            Vaciar
          </button>
        </div>
      )}
    </div>
  )
}

// ==============================================================================
// MODAL 3: BANDEJA DE HORAS QUE REQUIEREN REVISIÓN (R / RR / RRR)
// ==============================================================================
export function ReviewLaborLogsModal({
  showReviewModal,
  setShowReviewModal,
  reviewModalFilter,
  setReviewModalFilter,
  reviewModalSearch,
  setReviewModalSearch,
  filteredReviewLogs = [],
  selectedLogIds = new Set(),
  toggleSelectLog,
  toggleSelectAllLogs,
  handleUpdateApprovalStatus,
  handleEditFromDaily,
  countR = 0,
  countRR = 0,
  reviewCount = 0
}) {
  if (!showReviewModal) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-5xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 relative max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              reviewModalFilter === 'R'
                ? 'bg-rose-500/20 border border-rose-500/40 text-rose-400'
                : reviewModalFilter === 'RR'
                ? 'bg-amber-500/20 border border-amber-500/40 text-amber-400'
                : 'bg-primary/20 border border-primary/40 text-primary'
            }`}>
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {reviewModalFilter === 'R'
                  ? 'Horas que Requieren Revisión (Alerta para el Operario)'
                  : reviewModalFilter === 'RR'
                  ? 'Horas Corregidas (Alerta para el Supervisor)'
                  : 'Bandeja de Revisión y Corrección de Horas'}
                {reviewModalFilter === 'R' && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800">
                    {countR} por corregir
                  </span>
                )}
                {reviewModalFilter === 'RR' && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800">
                    {countRR} por aprobar
                  </span>
                )}
                {reviewModalFilter === 'todos' && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-slate-800 text-slate-300 border border-slate-700">
                    {reviewCount} total
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-1 flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-rose-300 bg-rose-950/40 px-2 py-0.5 rounded border border-rose-900/60 font-medium">
                  <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                  <strong>R (Rojo):</strong> Observadas por supervisor → Operario corrige
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-900/60 font-medium">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  <strong>RR (Amarillo):</strong> Corregidas por operario → Supervisor da visto bueno
                </span>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowReviewModal(false)}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => setReviewModalFilter('R')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                reviewModalFilter === 'R'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-950'
                  : 'bg-slate-950 text-rose-400 hover:text-rose-300 border border-rose-900/50'
              }`}
            >
              <span>🔴 Requieren Revisión R</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-950/80 border border-rose-800 font-mono">
                {countR}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setReviewModalFilter('RR')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                reviewModalFilter === 'RR'
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-950 font-black'
                  : 'bg-slate-950 text-amber-400 hover:text-amber-300 border border-amber-900/50'
              }`}
            >
              <span>🟡 Horas Corregidas RR</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-950/80 border border-amber-800 font-mono">
                {countRR}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setReviewModalFilter('todos')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                reviewModalFilter === 'todos'
                  ? 'bg-slate-700 text-white font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Todas ({reviewCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-500" />
            <input
              type="text"
              placeholder="Buscar por operario, barco..."
              value={reviewModalSearch}
              onChange={(e) => setReviewModalSearch(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1 border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 sticky top-0 z-10">
              <tr>
                <th className="py-2.5 px-3 w-8">
                  <input
                    type="checkbox"
                    checked={filteredReviewLogs.length > 0 && filteredReviewLogs.every(l => selectedLogIds.has(l.id))}
                    onChange={() => toggleSelectAllLogs(filteredReviewLogs.map(l => l.id))}
                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary"
                  />
                </th>
                <th className="py-2.5 px-3">Estado</th>
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3">Operario</th>
                <th className="py-2.5 px-3">Barco & OT</th>
                <th className="py-2.5 px-3">Rubro</th>
                <th className="py-2.5 px-2 text-center">Horas</th>
                <th className="py-2.5 px-3">Observaciones / Duda R</th>
                <th className="py-2.5 px-3 text-right">Editar</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredReviewLogs.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500">
                    <CheckCircle className="w-8 h-8 text-emerald-500/50 mx-auto mb-2" />
                    <p className="font-semibold text-slate-400">¡No hay horas pendientes de revisión!</p>
                    <p className="text-xs text-slate-500 mt-0.5">Todas las imputaciones observadas fueron aprobadas o corregidas.</p>
                  </td>
                </tr>
              ) : (
                filteredReviewLogs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <input
                        type="checkbox"
                        checked={selectedLogIds.has(log.id)}
                        onChange={() => toggleSelectLog(log.id)}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary"
                      />
                    </td>
                    <td className="py-2.5 px-3">
                      <select
                        value={log.approval_status || ''}
                        onChange={(e) => handleUpdateApprovalStatus(log.id, e.target.value)}
                        className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer focus:outline-none ${
                          log.approval_status === 'R'
                            ? 'bg-rose-950 text-rose-300 border-rose-500'
                            : log.approval_status === 'RR'
                            ? 'bg-amber-950 text-amber-300 border-amber-500'
                            : 'bg-slate-900 text-slate-400 border-slate-700'
                        }`}
                      >
                        <option value="R">R (Observado)</option>
                        <option value="RR">RR (Corregido)</option>
                        <option value="RRR">RRR (Aprobado Fin)</option>
                        <option value="S">S (Aprobado)</option>
                        <option value="">- Vacío</option>
                      </select>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-300">
                      {log.date_logged}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="font-bold text-white block">{log.worker_name}</span>
                      <span className="text-[10px] text-slate-400">{log.worker_type || 'Astillero'}</span>
                    </td>
                    <td className="py-2.5 px-3">
                      <strong className="text-white block">{log.work_orders?.ships?.name}</strong>
                      <span className="text-[11px] text-slate-300">{log.work_orders?.title}</span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-300">
                      {log.rubro || 'General'}
                    </td>
                    <td className="py-2.5 px-2 text-center font-mono font-bold text-primary">
                      {log.hours_worked || log.hours_normal || 0} hs
                    </td>
                    <td className="py-2.5 px-3 text-[11px] max-w-[260px]">
                      {log.review_reason && (
                        <div className="bg-rose-950/50 border border-rose-800/60 text-rose-300 p-1.5 rounded text-[11px] mb-1">
                          <strong className="text-rose-400 font-bold block text-[10px]">Duda / Observación (R):</strong>
                          {log.review_reason}
                        </div>
                      )}
                      {log.worker_response && (
                        <div className="bg-amber-950/50 border border-amber-800/60 text-amber-300 p-1.5 rounded text-[11px] mb-1">
                          <strong className="text-amber-400 font-bold block text-[10px]">Descargo (RR):</strong>
                          {log.worker_response}
                        </div>
                      )}
                      {log.notes && (
                        <span className="text-slate-400 italic block">{log.notes}</span>
                      )}
                      {!log.review_reason && !log.worker_response && !log.notes && (
                        <span className="text-slate-600">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setShowReviewModal(false)
                          handleEditFromDaily(log)
                        }}
                        className="p-1.5 text-slate-400 hover:text-primary rounded hover:bg-slate-800 transition-colors cursor-pointer"
                        title="Editar registro in-situ"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredReviewLogs.length > 0 && (
          <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
            <div className="flex items-center gap-2 text-slate-400">
              <span>{selectedLogIds.size} seleccionadas de esta vista</span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={selectedLogIds.size === 0}
                onClick={() => handleUpdateApprovalStatus(Array.from(selectedLogIds), 'RR')}
                className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded-lg font-bold transition-all disabled:opacity-40 cursor-pointer"
              >
                Pasar seleccionadas a RR (Corregidas)
              </button>
              <button
                type="button"
                disabled={selectedLogIds.size === 0}
                onClick={() => handleUpdateApprovalStatus(Array.from(selectedLogIds), 'RRR')}
                className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg font-bold transition-all disabled:opacity-40 cursor-pointer"
              >
                Pasar seleccionadas a RRR (Aprobación Final)
              </button>
              <button
                type="button"
                disabled={selectedLogIds.size === 0}
                onClick={() => handleUpdateApprovalStatus(Array.from(selectedLogIds), 'S')}
                className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg font-bold transition-all disabled:opacity-40 cursor-pointer"
              >
                Aprobar (S)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL 4: MOTIVO DE OBSERVACIÓN / DUDA TÉCNICA (ESTADO R) O DESCARGO RR
// ==============================================================================
export function ReviewReasonModal({
  reviewReasonModal,
  setReviewReasonModal,
  handleConfirmReviewModal
}) {
  if (!reviewReasonModal.isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-lg bg-slate-900 border border-rose-500/50 rounded-2xl shadow-2xl p-6 relative">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                {reviewReasonModal.targetStatus === 'R' ? 'Observar Imputación de Horas (Estado R)' : 'Revisión y Descargo Técnico'}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                <strong className="text-white">{reviewReasonModal.workerName}</strong> &bull; <span className="font-mono">{reviewReasonModal.dateLogged}</span> &bull; {reviewReasonModal.shipWo}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setReviewReasonModal({ isOpen: false, logId: null, workerName: '', dateLogged: '', shipWo: '', targetStatus: 'R', reason: '', response: '' })}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleConfirmReviewModal} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-rose-300 mb-1.5 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" />
              Motivo de Revisión / Duda Técnica (Auditoría):
            </label>
            <p className="text-[11px] text-slate-400 mb-2">
              Detalle el motivo por el cual se observa este parte de horas para que el operario o supervisor de cuadrilla pueda corregir y justificar (circuito S &rarr; R &rarr; RR &rarr; RRR):
            </p>
            <textarea
              required={reviewReasonModal.targetStatus === 'R'}
              rows={3}
              value={reviewReasonModal.reason}
              onChange={(e) => setReviewReasonModal(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="Ej: Revisar cantidad de horas extras al 100%, no coincide con el avance del parte diario; o rubro erróneo..."
              className="w-full bg-slate-950 border border-rose-500/40 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
              autoFocus
            />
          </div>

          {reviewReasonModal.response && (
            <div>
              <label className="block text-xs font-semibold text-amber-300 mb-1 flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                Descargo / Respuesta del Operario:
              </label>
              <p className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 text-xs text-slate-300">
                {reviewReasonModal.response}
              </p>
            </div>
          )}

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setReviewReasonModal({ isOpen: false, logId: null, workerName: '', dateLogged: '', shipWo: '', targetStatus: 'R', reason: '', response: '' })}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Guardar Observación (R)</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// CONTENEDOR INTEGRADO DE MODALES DE HORAS
// ==============================================================================
export function LaborModalsContainer({
  editingLog,
  setEditingLog,
  quickLogWorker,
  setQuickLogWorker,
  showReviewModal,
  setShowReviewModal,
  reviewReasonModal,
  setReviewReasonModal,
  shipPickerModal,
  setShipPickerModal,
  ships = [],
  workOrders = [],
  workItems = [],
  dbWorkers = [],
  auditDate = '',
  recentLogs = [],
  setRecentLogs,
  selectedLogIds = new Set(),
  toggleSelectLog,
  toggleSelectAllLogs,
  handleUpdateApprovalStatus,
  handleEditFromDaily,
  countR = 0,
  countRR = 0,
  filteredReviewLogs = [],
  showFeedbackMsg
}) {
  const [editingForm, setEditingForm] = useState(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const [reviewModalFilter, setReviewModalFilter] = useState('TODOS')
  const [reviewModalSearch, setReviewModalSearch] = useState('')

  useEffect(() => {
    if (editingLog) {
      setEditingForm({
        id: editingLog.id,
        ship_id: editingLog.ship_id || editingLog.work_orders?.ship_id || '',
        work_order_id: editingLog.work_order_id || '',
        worker_name: editingLog.worker_name || '',
        worker_type: editingLog.worker_type || 'Astillero',
        rubro: editingLog.rubro || 'General',
        date_logged: editingLog.date_logged || auditDate,
        hours_normal: editingLog.hours_normal ?? editingLog.hours_worked ?? 0,
        hours_extra_50: editingLog.hours_extra_50 ?? 0,
        hours_extra_100: editingLog.hours_extra_100 ?? 0,
        work_type: editingLog.work_type || 'MONTAJE',
        notes: editingLog.notes || '',
        approval_status: editingLog.approval_status || 'Aprobado',
        review_reason: editingLog.review_reason || ''
      })
    } else {
      setEditingForm(null)
    }
  }, [editingLog, auditDate])

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editingForm) return
    setSavingEdit(true)
    try {
      const hN = parseFloat(editingForm.hours_normal) || 0
      const h50 = parseFloat(editingForm.hours_extra_50) || 0
      const h100 = parseFloat(editingForm.hours_extra_100) || 0
      const payload = {
        ship_id: editingForm.ship_id || null,
        work_order_id: editingForm.work_order_id || null,
        worker_name: editingForm.worker_name,
        worker_type: editingForm.worker_type,
        rubro: editingForm.rubro,
        date_logged: editingForm.date_logged,
        hours_worked: hN + h50 + h100,
        hours_normal: hN,
        hours_extra_50: h50,
        hours_extra_100: h100,
        work_type: editingForm.work_type,
        notes: editingForm.notes,
        approval_status: editingForm.work_order_id ? editingForm.approval_status : 'R',
        review_reason: editingForm.work_order_id ? editingForm.review_reason : 'Falta Cargar OT'
      }
      const { error } = await supabase.from('labor_logs').update(payload).eq('id', editingForm.id)
      if (error) throw error
      setRecentLogs(prev => prev.map(l => l.id === editingForm.id ? { ...l, ...payload, ...buildLocalRelationsForLog(payload.ship_id, payload.work_order_id, ships, workOrders) } : l))
      setEditingLog(null)
      showFeedbackMsg?.('success', 'Imputación actualizada.')
    } catch (err) {
      showFeedbackMsg?.('error', 'Error: ' + err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleQuickLogSubmit = async (e) => {
    e.preventDefault()
    if (!quickLogWorker) return
    setSavingEdit(true)
    try {
      const hN = parseFloat(quickLogWorker.hours_normal) || 0
      const h50 = parseFloat(quickLogWorker.hours_extra_50) || 0
      const h100 = parseFloat(quickLogWorker.hours_extra_100) || 0
      const isMissing = !quickLogWorker.work_order_id
      const payload = {
        ship_id: quickLogWorker.ship_id || null,
        work_order_id: quickLogWorker.work_order_id || null,
        worker_name: quickLogWorker.worker_name,
        worker_type: quickLogWorker.worker_type,
        rubro: quickLogWorker.rubro,
        date_logged: auditDate,
        hours_worked: hN + h50 + h100,
        hours_normal: hN,
        hours_extra_50: h50,
        hours_extra_100: h100,
        work_type: 'MONTAJE',
        cost_center: 'CLIENTE',
        notes: quickLogWorker.notes || null,
        approval_status: isMissing ? 'R' : 'Aprobado',
        review_reason: isMissing ? 'Falta Cargar OT' : null
      }
      const { data, error } = await supabase.from('labor_logs').insert([payload]).select('*, ships(id, name), work_orders(id, ot_number, title, ship_id)').single()
      if (error) throw error
      setRecentLogs(prev => [data, ...prev])
      setQuickLogWorker(null)
      showFeedbackMsg?.('success', `Horas cargadas para ${quickLogWorker.worker_name}.`)
    } catch (err) {
      showFeedbackMsg?.('error', 'Error: ' + err.message)
    } finally {
      setSavingEdit(false)
    }
  }

  const handleConfirmReviewModal = async (reason) => {
    if (!reviewReasonModal.logId) return
    try {
      const { error } = await supabase.from('labor_logs').update({ approval_status: 'R', review_reason: reason }).eq('id', reviewReasonModal.logId)
      if (error) throw error
      setRecentLogs(prev => prev.map(l => l.id === reviewReasonModal.logId ? { ...l, approval_status: 'R', review_reason: reason } : l))
      setReviewReasonModal({ isOpen: false, logId: null, initialReason: '' })
      showFeedbackMsg?.('success', 'Observación guardada.')
    } catch (err) {
      showFeedbackMsg?.('error', 'Error: ' + err.message)
    }
  }

  const handleSelectShipWo = async ({ shipId, workOrderId }) => {
    if (!shipPickerModal.logId) return
    try {
      const payload = {
        ship_id: shipId || null,
        work_order_id: workOrderId || null,
        ...(workOrderId ? { approval_status: 'Aprobado', review_reason: null } : { approval_status: 'R', review_reason: 'Falta Cargar OT' })
      }
      const { error } = await supabase.from('labor_logs').update(payload).eq('id', shipPickerModal.logId)
      if (error) throw error
      setRecentLogs(prev => prev.map(l => l.id === shipPickerModal.logId ? { ...l, ...payload, ...buildLocalRelationsForLog(shipId, workOrderId, ships, workOrders) } : l))
      setShipPickerModal({ isOpen: false, logId: null, currentShipId: '', currentWorkOrderId: '', workerName: '' })
      showFeedbackMsg?.('success', 'Buque y OT vinculados.')
    } catch (err) {
      showFeedbackMsg?.('error', 'Error al asignar Buque/OT: ' + err.message)
    }
  }

  return (
    <>
      {editingLog && (
        <EditLaborLogModal
          editingLog={editingLog}
          setEditingLog={setEditingLog}
          editingForm={editingForm}
          setEditingForm={setEditingForm}
          savingEdit={savingEdit}
          handleSaveEdit={handleSaveEdit}
          ships={ships}
          workOrders={workOrders}
        />
      )}
      {quickLogWorker && (
        <QuickLogModal
          quickLogWorker={quickLogWorker}
          setQuickLogWorker={setQuickLogWorker}
          handleQuickLogSubmit={handleQuickLogSubmit}
          savingEdit={savingEdit}
          ships={ships}
          workOrders={workOrders}
          auditDate={auditDate}
          getEnabledWosForWorkerInShip={(shipId, name, type) => getEnabledWosForWorkerInShip(shipId, name, type, workOrders, workItems, dbWorkers)}
        />
      )}
      {showReviewModal && (
        <ReviewLaborLogsModal
          showReviewModal={showReviewModal}
          setShowReviewModal={setShowReviewModal}
          reviewModalFilter={reviewModalFilter}
          setReviewModalFilter={setReviewModalFilter}
          reviewModalSearch={reviewModalSearch}
          setReviewModalSearch={setReviewModalSearch}
          filteredReviewLogs={filteredReviewLogs}
          selectedLogIds={selectedLogIds}
          toggleSelectLog={toggleSelectLog}
          toggleSelectAllLogs={toggleSelectAllLogs}
          handleUpdateApprovalStatus={handleUpdateApprovalStatus}
          handleEditFromDaily={handleEditFromDaily}
          countR={countR}
          countRR={countRR}
          reviewCount={filteredReviewLogs.length}
        />
      )}
      {reviewReasonModal.isOpen && (
        <ReviewReasonModal
          reviewReasonModal={reviewReasonModal}
          setReviewReasonModal={setReviewReasonModal}
          handleConfirmReviewModal={handleConfirmReviewModal}
        />
      )}
      {shipPickerModal.isOpen && (
        <ShipWorkOrderPickerModal
          isOpen={shipPickerModal.isOpen}
          onClose={() => setShipPickerModal({ isOpen: false, logId: null, currentShipId: '', currentWorkOrderId: '', workerName: '' })}
          ships={ships}
          workOrders={workOrders}
          currentShipId={shipPickerModal.currentShipId}
          currentWorkOrderId={shipPickerModal.currentWorkOrderId}
          onSelect={handleSelectShipWo}
        />
      )}
    </>
  )
}
