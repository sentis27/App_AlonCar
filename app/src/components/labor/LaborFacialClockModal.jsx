import React, { useState, useMemo, useRef, useEffect } from 'react'
import { Watch, X, Upload, FolderOpen, AlertTriangle, CheckCircle2, Sparkles } from 'lucide-react'
import {
  parseFacialClockCsv,
  buildSampleClockCsvFromWorkers,
  classifyShipsByStayLocation,
  buildFacialClockDashboardState
} from '../../lib/laborFacialClockHelpers.js'
import { LABOR_CLOCK_BOARD_STEP_HELP } from '../../lib/businessHelpRegistry.js'
import { CanonicalStepperStep } from '../canonical/CanonicalStepperModal.jsx'
import LaborFacialClockWorkspace from './LaborFacialClockWorkspace.jsx'
import LaborClockAssignSheet from './LaborClockAssignSheet.jsx'

const STORAGE_PREFIX = 'aloncar_facial_clock_v1_'
const FOLDER_PATH_KEY = 'aloncar_facial_clock_folder_label'

export default function LaborFacialClockModal({
  isOpen,
  onClose,
  ships = [],
  shipStays = [],
  workOrders = [],
  workItems = [],
  dbWorkers = [],
  recentLogs = [],
  fetchData,
  setStatusMessage,
  user
}) {
  const [dateLogged, setDateLogged] = useState(() => new Date().toISOString().split('T')[0])
  const [folderLabel, setFolderLabel] = useState(() => localStorage.getItem(FOLDER_PATH_KEY) || 'C:\\RelojFacial\\reportes')
  const [attendees, setAttendees] = useState([])
  const [closingRecords, setClosingRecords] = useState([])
  const [shipLocationTab, setShipLocationTab] = useState('ASTILLERO')
  const [selectedShipId, setSelectedShipId] = useState('')
  const [expandedGroups, setExpandedGroups] = useState(() => new Set())
  const [assignContext, setAssignContext] = useState(null)
  const [showFormatNote, setShowFormatNote] = useState(false)
  const [showReconciliation, setShowReconciliation] = useState(false)
  const [modalAlert, setModalAlert] = useState(null)
  const entryInputRef = useRef(null)
  const closingInputRef = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    try {
      const saved = localStorage.getItem(`${STORAGE_PREFIX}${dateLogged}`)
      const parsed = saved ? JSON.parse(saved) : {}
      setAttendees(parsed.attendees || [])
      setClosingRecords(parsed.closingRecords || [])
    } catch {
      setAttendees([])
      setClosingRecords([])
    }
    setModalAlert(null)
  }, [isOpen, dateLogged])

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e) => { if (e.key === 'Escape' && !assignContext) onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, assignContext, onClose])

  const classifiedShips = useMemo(() => classifyShipsByStayLocation(ships, shipStays, recentLogs, dateLogged), [ships, shipStays, recentLogs, dateLogged])
  const visibleShips = useMemo(() => classifiedShips.filter(s => s.zone === shipLocationTab), [classifiedShips, shipLocationTab])
  const activeTargetShip = useMemo(() => visibleShips.find(s => s.id === selectedShipId) || visibleShips[0] || null, [visibleShips, selectedShipId])
  const dashboard = useMemo(() => buildFacialClockDashboardState({ attendees, closingRecords, recentLogs, dateLogged }), [attendees, closingRecords, recentLogs, dateLogged])

  if (!isOpen) return null

  const persistSession = (nextA, nextC) => {
    try { localStorage.setItem(`${STORAGE_PREFIX}${dateLogged}`, JSON.stringify({ attendees: nextA, closingRecords: nextC })) } catch { /* ignore */ }
  }

  const applyCsvText = (rawText, mode) => {
    const { rows } = parseFacialClockCsv(rawText, dbWorkers)
    if (rows.length === 0) { setModalAlert({ type: 'error', text: 'No se reconocieron filas válidas en el archivo CSV.' }); return }
    if (mode === 'ingreso') {
      setAttendees(rows)
      persistSession(rows, closingRecords)
      setExpandedGroups(new Set(rows.slice(0, 3).map(r => r.group_name)))
      setModalAlert({ type: 'success', text: `✔ Ingreso importado: ${rows.length} personas agrupadas.` })
    } else {
      const nextA = attendees.length > 0 ? attendees : rows
      setAttendees(nextA)
      setClosingRecords(rows)
      persistSession(nextA, rows)
      setShowReconciliation(true)
      setModalAlert({ type: 'success', text: `✔ Fichaje final cargado (${rows.length} registros). Comparativa lista.` })
    }
  }

  const handleFilePick = (e, mode) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => applyCsvText(String(reader.result || ''), mode)
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleImportFromFolder = async () => {
    if (!window.showDirectoryPicker) { entryInputRef.current?.click(); return }
    try {
      const dirHandle = await window.showDirectoryPicker()
      localStorage.setItem(FOLDER_PATH_KEY, dirHandle.name)
      setFolderLabel(dirHandle.name)
      const csvFiles = []
      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && /\.(csv|txt)$/i.test(entry.name)) csvFiles.push(await entry.getFile())
      }
      if (csvFiles.length === 0) { setModalAlert({ type: 'error', text: `La carpeta "${dirHandle.name}" no contiene archivos .csv/.txt.` }); return }
      csvFiles.sort((a, b) => b.lastModified - a.lastModified)
      applyCsvText(await csvFiles[0].text(), attendees.length === 0 ? 'ingreso' : 'cierre')
    } catch (err) {
      if (err?.name !== 'AbortError') setModalAlert({ type: 'error', text: err.message })
    }
  }

  const handleSimulate = (mode) => {
    const csv = buildSampleClockCsvFromWorkers(dbWorkers, mode)
    if (!csv) { setModalAlert({ type: 'error', text: 'No hay personal activo en Padrón para simular.' }); return }
    applyCsvText(csv, mode)
  }

  const openAssignment = (ship, workers, label) => {
    if (!ship) { setModalAlert({ type: 'error', text: 'Seleccioná un barco de destino primero.' }); return }
    setAssignContext({ ship, workers, label })
  }

  const toggleGroupExpand = (gName) => {
    setExpandedGroups(prev => {
      const n = new Set(prev)
      if (n.has(gName)) n.delete(gName)
      else n.add(gName)
      return n
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4">
      <div className="alon-modal-card alon-modal-zeroscroll max-w-7xl h-[94vh]">
        <div className="alon-modal-header flex-wrap gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0"><Watch className="w-4 h-4" /></div>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h2 className="text-sm font-black text-white uppercase">CARGA POR RELOJ DE ALERTA (LECTOR FACIAL)</h2>
              <input type="date" value={dateLogged} onChange={(e) => setDateLogged(e.target.value)} className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400" />
              {!dashboard.summary.hasClosingReport ? (
                <span className="px-2 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/50 text-amber-300 text-[10px] font-black flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Esperando cierre de fichaje final del día
                </span>
              ) : (
                <button type="button" onClick={() => setShowReconciliation(p => !p)} className={`px-2 py-0.5 rounded-full border text-[10px] font-black flex items-center gap-1 cursor-pointer ${dashboard.summary.mismatchCount > 0 ? 'bg-rose-500/20 border-rose-500/60 text-rose-300' : 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'}`}>
                  <CheckCircle2 className="w-3 h-3" /> Cierre cargado • {dashboard.summary.mismatchCount} dif. {showReconciliation ? '▲' : '▼'}
                </button>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button type="button" tabIndex={-1} onClick={handleImportFromFolder} className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer" title={`Carpeta configurada: ${folderLabel}`}>
              <FolderOpen className="w-3.5 h-3.5 text-cyan-400" /><span className="hidden md:inline">Carpeta: {folderLabel}</span><span className="md:hidden">Carpeta</span>
            </button>
            <button type="button" tabIndex={-1} onClick={() => entryInputRef.current?.click()} className="px-2.5 py-1.5 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 text-cyan-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> CSV Entrada
            </button>
            <button type="button" tabIndex={-1} onClick={() => closingInputRef.current?.click()} className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/50 text-amber-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer">
              <Upload className="w-3.5 h-3.5" /> CSV Cierre
            </button>
            <button type="button" tabIndex={-1} onClick={() => handleSimulate(attendees.length === 0 ? 'ingreso' : 'cierre')} className="px-2.5 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-400/50 text-indigo-200 text-[11px] font-bold flex items-center gap-1 cursor-pointer" title="Simular desde Padrón mientras queda pendiente el formato exacto del reloj">
              <Sparkles className="w-3.5 h-3.5" /> {attendees.length === 0 ? 'Simular Ingreso' : 'Simular Cierre'}
            </button>
            <button type="button" tabIndex={-1} onClick={() => setShowFormatNote(p => !p)} className="px-2 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-400 hover:text-white text-[10px] font-bold cursor-pointer">Formato CSV</button>
            <button type="button" tabIndex={-1} onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"><X className="w-4 h-4" /></button>
            <input ref={entryInputRef} type="file" accept=".csv,.txt" onChange={(e) => handleFilePick(e, 'ingreso')} className="hidden" />
            <input ref={closingInputRef} type="file" accept=".csv,.txt" onChange={(e) => handleFilePick(e, 'cierre')} className="hidden" />
          </div>
        </div>

        <div className="p-4 flex flex-col gap-3 flex-1 min-h-0 overflow-visible">
          {showFormatNote && (
            <div className="alon-chunk-indigo text-[11px] text-indigo-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <span><strong>Formato CSV pendiente de hardware:</strong> acepta cualquier <code>.csv</code>/<code>.txt</code> (<code>,</code>/<code>;</code>/Tab) con columnas como <code>nombre;grupo;entrada;salida;horas</code> o solo nombres.</span>
              <input type="text" value={folderLabel} onChange={(e) => { setFolderLabel(e.target.value); localStorage.setItem(FOLDER_PATH_KEY, e.target.value) }} className="bg-slate-950 border border-indigo-500/40 rounded px-2 py-1 text-[11px] text-white w-56 font-mono" placeholder="Ruta habitual del lector..." />
            </div>
          )}

          {modalAlert && (
            <div className={`px-3 py-2 rounded-xl border text-xs font-semibold flex items-center justify-between shrink-0 ${modalAlert.type === 'error' ? 'bg-rose-950/70 border-rose-500/60 text-rose-200' : 'bg-emerald-950/70 border-emerald-500/60 text-emerald-200'}`}>
              <span>{modalAlert.text}</span>
              <button type="button" onClick={() => setModalAlert(null)} className="cursor-pointer">✕</button>
            </div>
          )}

          <div className="shrink-0">
            <CanonicalStepperStep step={1} helpEntry={LABOR_CLOCK_BOARD_STEP_HELP[1]} title="RESUMEN DE FICHAJE DEL DÍA" subtitle="Presentes ➔ Estimado ➔ Distribuidas ➔ Pendientes">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-2 rounded-xl bg-slate-950/90 border border-sky-500/40 flex items-center justify-between"><span className="text-[10px] font-bold text-sky-300 uppercase">Presentes</span><span className="text-base font-black font-mono text-white">{dashboard.summary.presentCount} pers.</span></div>
                <div className="p-2 rounded-xl bg-slate-950/90 border border-cyan-500/40 flex items-center justify-between"><span className="text-[10px] font-bold text-cyan-300 uppercase">Estimado (9h/8h)</span><span className="text-base font-black font-mono text-cyan-300">{dashboard.summary.totalEstimated} h</span></div>
                <div className="p-2 rounded-xl bg-slate-950/90 border border-emerald-500/40 flex items-center justify-between"><span className="text-[10px] font-bold text-emerald-300 uppercase">Distribuidas</span><span className="text-base font-black font-mono text-emerald-300">{dashboard.summary.totalLogged} h</span></div>
                <div className="p-2 rounded-xl bg-slate-950/90 border border-amber-500/50 flex items-center justify-between"><span className="text-[10px] font-bold text-amber-300 uppercase">Faltan Cargar</span><span className="text-base font-black font-mono text-amber-400">{dashboard.summary.totalPending} h</span></div>
              </div>
              {showReconciliation && dashboard.summary.hasClosingReport && (
                <div className="alon-chunk-rose space-y-1.5 max-h-28 overflow-y-auto mt-2">
                  <div className="text-xs font-black text-rose-300">Comparativa Cierre Final (Fichado Real vs. Cargado)</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5 text-[11px]">
                    {dashboard.workers.filter((w) => w.actualHours !== null).map((w) => (
                      <div key={w.worker_name} className={`p-1.5 rounded-lg border flex items-center justify-between ${w.hasMismatch ? 'bg-rose-950/60 border-rose-500/60 text-rose-200' : 'bg-slate-950/80 border-emerald-700/40 text-emerald-200'}`}>
                        <span className="font-bold truncate mr-2">{w.worker_name}</span>
                        <span className="font-mono shrink-0">Real {w.actualHours}h / Imp {w.loggedHours}h ({w.diffVsLogged >= 0 ? `+${w.diffVsLogged}` : w.diffVsLogged}h)</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CanonicalStepperStep>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <CanonicalStepperStep step={2} helpEntry={LABOR_CLOCK_BOARD_STEP_HELP[2]} title="DISTRIBUCIÓN DE PRESENTES A BUQUES Y OTs" subtitle="Seleccioná buque y tocá un grupo u operario para imputar" isLast={true}>
              <LaborFacialClockWorkspace
                groups={dashboard.groups}
                visibleShips={visibleShips}
                shipLocationTab={shipLocationTab}
                setShipLocationTab={setShipLocationTab}
                activeTargetShip={activeTargetShip}
                setSelectedShipId={setSelectedShipId}
                expandedGroups={expandedGroups}
                onToggleGroupExpand={toggleGroupExpand}
                onOpenAssignment={openAssignment}
                onSimulateEntry={() => handleSimulate('ingreso')}
              />
            </CanonicalStepperStep>
          </div>
        </div>
      </div>

      <LaborClockAssignSheet
        assignment={assignContext}
        onClose={() => setAssignContext(null)}
        workOrders={workOrders}
        workItems={workItems}
        dateLogged={dateLogged}
        userEmail={user?.email}
        onSuccess={(msg) => {
          setModalAlert({ type: 'success', text: msg })
          setStatusMessage?.({ type: 'success', text: msg })
          fetchData?.({ silent: true })
        }}
      />
    </div>
  )
}
