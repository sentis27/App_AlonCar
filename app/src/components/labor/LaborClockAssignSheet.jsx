import React, { useState, useEffect, useRef } from 'react'
import { Mic, MicOff, Save, Ship, Users, AlertTriangle } from 'lucide-react'
import { buildClockAssignmentPayload } from '../../lib/laborFacialClockHelpers.js'
import { insertLaborBatchService } from '../../services/laborCargaService.js'
import { TIPOS_DE_TRABAJO } from '../../lib/workOrdersConstants.js'
import { buildStandardShipWorkOrdersCatalog, resolveSingleWorkItemId } from '../../lib/workOrderUnificationEngine.js'
import { LABOR_CLOCK_ASSIGN_STEP_HELP } from '../../lib/businessHelpRegistry.js'
import { CanonicalStepperModal, CanonicalStepperStep } from '../canonical/CanonicalStepperModal.jsx'
import { WorkOrderSelectorWithHover } from '../workOrders/WorkOrderSelectorWithHover.jsx'

const QUICK_HOURS = [2, 4, 4.5, 8, 9]

/**
 * Hoja rápida de asignación desde Reloj Facial (Stepper Vertical Zero-Scroll 1 ➔ 2 ➔ 3)
 * con OT opcional (tooltip flotante), atajos de horas y dictado por voz.
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
  const pendingCount = (assignment.workers || []).filter((w) => w.pendingHours > 0).length

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
    <CanonicalStepperModal
      isOpen={Boolean(assignment)}
      onClose={onClose}
      maxWidthClass="max-w-4xl"
      zIndexClass="z-[60]"
      icon={<Ship className="w-4 h-4 text-cyan-400" />}
      title={`${assignment.ship.name} · ${assignment.label}`}
      headerBadges={
        <span className="px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[10px] font-bold flex items-center gap-1">
          <Users className="w-3 h-3" />
          <span>{assignment.workers.length} operario(s) ({pendingCount} con hs pend.)</span>
        </span>
      }
      onSubmit={handleConfirm}
      footerLeft={
        <button type="button" tabIndex={-1} onClick={onClose} className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer">
          Cancelar
        </button>
      }
      footerRight={
        <button type="submit" disabled={submitting} className="px-5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-lg shadow-emerald-500/20">
          <Save className="w-4 h-4" />
          <span>{submitting ? 'Guardando...' : 'Confirmar Imputación'}</span>
        </button>
      }
    >
      {localError && (
        <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-500/60 text-xs text-rose-200 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{localError}</span>
        </div>
      )}

      <CanonicalStepperStep
        step={1}
        helpEntry={LABOR_CLOCK_ASSIGN_STEP_HELP[1]}
        title="CANTIDAD DE HORAS A IMPUTAR"
        headerRight={
          assignment.workers.length > 1 ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setHoursMode(hoursMode === 'pending' ? 'fixed' : 'pending')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer ${hoursMode === 'pending' ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300' : 'bg-slate-900 border-slate-700 text-slate-300'}`}
            >
              {hoursMode === 'pending' ? '✓ Usando hs faltantes c/u' : 'Usar hs faltantes c/u'}
            </button>
          ) : null
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {QUICK_HOURS.map((h) => (
            <button
              key={h}
              type="button"
              tabIndex={-1}
              onClick={() => { setHoursMode('fixed'); setCustomHours(String(h)) }}
              className={`px-3.5 py-1.5 rounded-xl font-mono text-xs font-black border cursor-pointer transition-all ${hoursMode === 'fixed' && String(customHours) === String(h) ? 'bg-cyan-500 text-slate-950 border-cyan-300' : 'bg-slate-950 border-slate-700 text-slate-200 hover:border-cyan-500/50'}`}
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
            className="w-24 bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono text-center font-bold focus:outline-none focus:border-cyan-400"
          />
          <span className="text-[11px] text-slate-400">hs manuales</span>
        </div>
      </CanonicalStepperStep>

      <CanonicalStepperStep
        step={2}
        helpEntry={LABOR_CLOCK_ASSIGN_STEP_HELP[2]}
        title="ORDEN DE TRABAJO, RUBRO Y MODALIDAD"
        subtitle="OT opcional · Tooltip flotante al pasar el mouse"
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Orden de Trabajo (Opcional)</label>
            <WorkOrderSelectorWithHover
              value={workOrderId}
              onChange={(nextWoId) => {
                setWorkOrderId(nextWoId)
                const woObj = shipWos.find((w) => String(w.id) === String(nextWoId))
                if (woObj?.work_type && ['HORA', 'PRESUPUESTO', 'CONTROL'].includes(String(woObj.work_type).toUpperCase())) {
                  setWorkType(String(woObj.work_type).toUpperCase())
                }
              }}
              availableWos={shipWos}
              ship={assignment.ship || null}
              workItems={workItems}
              allWorkOrders={workOrders}
              placeholder="-- ⚠️ Dejar OT en blanco --"
              showPreviewCard={false}
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Rubro / Oficio</label>
            <input
              type="text"
              list="rubros-list-carga"
              value={rubro}
              onChange={(e) => setRubro(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400"
              placeholder="Ej: Calderería, Pintura..."
            />
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Modalidad (Col. F)</label>
            <select
              value={workType}
              onChange={(e) => setWorkType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
            >
              {TIPOS_DE_TRABAJO.map((t) => (
                <option key={t.value} value={t.value} className="bg-slate-900 text-white">{t.label}</option>
              ))}
            </select>
          </div>
        </div>
      </CanonicalStepperStep>

      <CanonicalStepperStep
        step={3}
        helpEntry={LABOR_CLOCK_ASSIGN_STEP_HELP[3]}
        title="DESCRIPCIÓN / TAREA (OBLIGATORIA SI VA SIN OT)"
        isLast={true}
        headerRight={
          <button
            type="button"
            tabIndex={-1}
            onClick={toggleVoiceDictation}
            className={`px-3 py-1 rounded-lg text-[11px] font-black flex items-center gap-1.5 cursor-pointer ${isListening ? 'bg-rose-500 text-white animate-pulse' : 'bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400/60 text-cyan-300'}`}
          >
            {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            <span>{isListening ? 'Detener' : 'Dictar por Voz'}</span>
          </button>
        }
      >
        <input
          type="text"
          autoFocus
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Ej: Soldadura de chapa en cubierta babor, raschineado casco..."
          className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded-lg px-2.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
        />
        {speechError && <p className="text-[11px] text-amber-300">{speechError}</p>}
      </CanonicalStepperStep>
    </CanonicalStepperModal>
  )
}
