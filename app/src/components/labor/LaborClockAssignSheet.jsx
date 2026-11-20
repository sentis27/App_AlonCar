import React, { useState, useEffect, useRef } from 'react'
import { X, Mic, MicOff, Save, Ship, Users, AlertTriangle } from 'lucide-react'
import { buildClockAssignmentPayload } from '../../lib/laborFacialClockHelpers.js'
import { insertLaborBatchService } from '../../services/laborCargaService.js'
import { TIPOS_DE_TRABAJO } from '../../lib/workOrdersConstants.js'
import { buildStandardShipWorkOrdersCatalog, resolveSingleWorkItemId } from '../../lib/workOrderUnificationEngine.js'
import { WorkOrderSelectorWithHover } from '../workOrders/WorkOrderSelectorWithHover.jsx'

const QUICK_HOURS = [2, 4, 4.5, 8, 9]

/**
 * Hoja rápida de asignación (Popover PC / Bottom Sheet Celular) con OT opcional y dictado por voz.
 */
export default function LaborClockAssignSheet({
  assignment,
  onClose,
  workOrders = [],
  workItems = [],
  dateLogged,
  userEmail,
  onSuccess
}) {
  const [hoursMode, setHoursMode] = useState('fixed')
  const [customHours, setCustomHours] = useState('4.5')
  const [workOrderId, setWorkOrderId] = useState('')
  const [workType, setWorkType] = useState('HORA')
  const [rubro, setRubro] = useState('')
  const [notes, setNotes] = useState('')
  const [isListening, setIsListening] = useState(false)
  const [speechError, setSpeechError] = useState('')
  const [localError, setLocalError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const recognitionRef = useRef(null)

  useEffect(() => {
    if (!assignment) return
    const first = assignment.workers?.[0]
    const defH = first?.pendingHours > 0 ? first.pendingHours : (first?.estimated_hours || 9)
    setHoursMode(assignment.workers?.length > 1 ? 'pending' : 'fixed')
    setCustomHours(String(defH))
    setWorkOrderId('')
    setWorkType('HORA')
    setRubro(first?.default_rubro || 'Calderería')
    setNotes('')
    setSpeechError('')
    setLocalError('')
    return () => { recognitionRef.current?.stop?.() }
  }, [assignment])

  if (!assignment) return null

  const shipWos = buildStandardShipWorkOrdersCatalog(workOrders, workItems, {
    shipId: assignment.ship?.id,
    includeEliminated: false,
    includeClosed: false
  })
  const pendingCount = (assignment.workers || []).filter(w => w.pendingHours > 0).length

  const toggleVoiceDictation = () => {
    setSpeechError('')
    if (isListening) {
      recognitionRef.current?.stop?.()
      setIsListening(false)
      return
    }
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRec) {
      setSpeechError('Este navegador no soporta dictado directo; podés usar el micrófono del teclado del celular.')
      return
    }
    const rec = new SpeechRec()
    rec.lang = 'es-AR'
    rec.continuous = false
    rec.interimResults = true
    const baseText = notes.trim()
    rec.onresult = (event) => {
      let transcript = ''
      for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript
      setNotes(baseText ? `${baseText} ${transcript.trim()}` : transcript.trim())
    }
    rec.onerror = (ev) => {
      setSpeechError(ev.error === 'not-allowed' ? 'Permiso de micrófono denegado.' : 'No se pudo captar audio.')
      setIsListening(false)
    }
    rec.onend = () => setIsListening(false)
    recognitionRef.current = rec
    setIsListening(true)
    rec.start()
  }

  const handleConfirm = async (e) => {
    e.preventDefault()
    setLocalError('')
    const resolvedWiId = resolveSingleWorkItemId(workOrderId, workItems)
    const { errorMsg, payload, totalHours } = buildClockAssignmentPayload({
      ship: assignment.ship,
      targetWorkers: assignment.workers || [],
      hoursMode,
      customHours,
      workOrderId,
      workItemId: resolvedWiId,
      workType,
      rubro,
      notes,
      dateLogged
    })
    if (errorMsg) { setLocalError(errorMsg); return }

    setSubmitting(true)
    try {
      await insertLaborBatchService({ payload, totalHorasGenerales: totalHours, changeOrigin: 'FACIAL_CLOCK_BOARD', userEmail })
      onSuccess?.(`⚡ Cargadas ${totalHours} hs (${payload.length} registro/s) en ${assignment.ship.name}.`)
      onClose()
    } catch (err) {
      setLocalError(err.message || 'Error al guardar imputación.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <form onSubmit={handleConfirm} className="w-full sm:max-w-xl bg-slate-900 border border-cyan-500/40 rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="alon-modal-header">
          <div className="flex items-center gap-2 min-w-0">
            <Ship className="w-4 h-4 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white truncate">{assignment.ship.name} &bull; {assignment.label}</h3>
              <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <Users className="w-3 h-3 text-emerald-400" />
                <span>{assignment.workers.length} operario(s) ({pendingCount} con hs pendientes)</span>
              </p>
            </div>
          </div>
          <button type="button" tabIndex={-1} onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="alon-modal-body space-y-3">
          {localError && (
            <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/60 text-xs text-rose-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              <span>{localError}</span>
            </div>
          )}

          <div className="alon-chunk-sky space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-extrabold text-cyan-300">1. Cantidad de Horas</span>
              {assignment.workers.length > 1 && (
                <button
                  type="button"
                  onClick={() => setHoursMode(hoursMode === 'pending' ? 'fixed' : 'pending')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${hoursMode === 'pending' ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
                >
                  {hoursMode === 'pending' ? '✓ Usando hs faltantes c/u' : 'Usar hs faltantes c/u'}
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {QUICK_HOURS.map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => { setHoursMode('fixed'); setCustomHours(String(h)) }}
                  className={`px-3 py-2 rounded-xl font-mono text-xs font-black border cursor-pointer ${hoursMode === 'fixed' && String(customHours) === String(h) ? 'bg-cyan-500 text-slate-950 border-cyan-300' : 'bg-slate-950 border-slate-700 text-slate-200 hover:border-cyan-500/50'}`}
                >
                  {h}h
                </button>
              ))}
              <input
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                value={customHours}
                onChange={(e) => { setHoursMode('fixed'); setCustomHours(e.target.value) }}
                className="w-20 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-white font-mono text-center focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Orden de Trabajo (Opcional)</label>
              <WorkOrderSelectorWithHover
                value={workOrderId}
                onChange={(nextWoId) => {
                  setWorkOrderId(nextWoId)
                  const woObj = shipWos.find(w => String(w.id) === String(nextWoId))
                  if (woObj?.work_type && ['HORA', 'PRESUPUESTO', 'CONTROL'].includes(String(woObj.work_type).toUpperCase())) {
                    setWorkType(String(woObj.work_type).toUpperCase())
                  }
                }}
                availableWos={shipWos}
                ship={assignment.ship || null}
                workItems={workItems}
                allWorkOrders={workOrders}
                placeholder="-- ⚠️ Dejar OT en blanco --"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Rubro / Oficio</label>
              <input
                type="text"
                list="rubros-list-carga"
                value={rubro}
                onChange={(e) => setRubro(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
                placeholder="Ej: Calderería, Pintura..."
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-300 mb-1">Modalidad (Col. F)</label>
              <select
                value={workType}
                onChange={(e) => setWorkType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
              >
                {TIPOS_DE_TRABAJO.map(t => (
                  <option key={t.value} value={t.value} className="bg-slate-900 text-white">{t.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="alon-chunk-emerald space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="text-xs font-extrabold text-emerald-300">2. Descripción / Tarea (Obligatoria si va sin OT)</label>
              <button
                type="button"
                onClick={toggleVoiceDictation}
                className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-300'}`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                <span>{isListening ? 'Detener' : 'Dictar por Voz'}</span>
              </button>
            </div>
            <textarea
              rows={2}
              autoFocus
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Soldadura de chapa en cubierta babor, raschineado casco..."
              className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            {speechError && <p className="text-[11px] text-amber-300">{speechError}</p>}
          </div>
        </div>

        <div className="alon-modal-footer">
          <button type="button" tabIndex={-1} onClick={onClose} className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer">
            Cancelar
          </button>
          <button type="submit" disabled={submitting} className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 hover:brightness-110 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
            <Save className="w-4 h-4" />
            <span>{submitting ? 'Guardando...' : 'Guardar Imputación'}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
