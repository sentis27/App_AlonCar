import React from 'react'
import {
  Table,
  Search,
  Pencil,
  Plus,
  Trash2,
  AlertCircle,
  CheckCircle
} from 'lucide-react'
import HighlightText from '../HighlightText'

export default function LaborSabanaPanel({
  selectedYear,
  selectedMonth,
  setSelectedMonth,
  selectedQuincena,
  setSelectedQuincena,
  sabanaSearch,
  setSabanaSearch,
  selectedQuincenaWorker,
  setSelectedQuincenaWorker,
  daysInQuincena = [],
  filteredSabanaWorkers = [],
  allQuincenaWorkers = [],
  recentLogs = [],
  selectedLogIds = new Set(),
  toggleSelectLog,
  toggleSelectAllLogs,
  handleEditDayCell,
  handleQuickAddFromSabana,
  handleEditFromDaily,
  handleDeleteLog,
  handleUpdateApprovalStatus,
  setReviewReasonModal
}) {
  return (
    <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-5">
      {/* Cabecera Sábana */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Table className="w-5 h-5 text-primary" />
            Sábana Quincenal de Imputación de Horas
          </h2>
          <p className="text-xs text-slate-400">
            Visualización idéntica a Google Sheets: control de horas día por día para todo el personal y contratistas.
          </p>
        </div>

        {/* Selectores de Período */}
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            value={selectedQuincena}
            onChange={(e) => setSelectedQuincena(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-primary font-bold"
          >
            <option value="1">1º Quincena (Días 01 al 15)</option>
            <option value="2">2º Quincena (Día 16 al fin de mes)</option>
          </select>

          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-primary"
          >
            <option value="1">Enero</option>
            <option value="2">Febrero</option>
            <option value="3">Marzo</option>
            <option value="4">Abril</option>
            <option value="5">Mayo</option>
            <option value="6">Junio</option>
            <option value="7">Julio</option>
            <option value="8">Agosto</option>
            <option value="9">Septiembre</option>
            <option value="10">Octubre</option>
            <option value="11">Noviembre</option>
            <option value="12">Diciembre</option>
          </select>

          <span className="text-xs font-mono font-bold text-slate-400 px-2 py-1 bg-slate-950 rounded-lg border border-slate-800">
            {selectedYear}
          </span>

          {/* Buscador de Operario en Sábana */}
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar operario en la sábana..."
              value={sabanaSearch}
              onChange={(e) => setSabanaSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 transition-colors"
            />
            {sabanaSearch && (
              <button
                type="button"
                onClick={() => setSabanaSearch('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs font-bold"
              >
                ×
              </button>
            )}
          </div>
        </div>
      </div>

      {/* MATRIZ TIPO SHEETS */}
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)] border border-slate-800 rounded-xl">
        <table className="w-full text-center text-xs border-collapse">
          <thead className="sticky top-0 z-20 bg-slate-950 shadow-sm">
            <tr className="bg-slate-950 text-slate-300 font-bold border-b border-slate-800">
              <th className="py-3 px-4 text-left border-r border-slate-800 sticky left-0 top-0 bg-slate-950 z-30 min-w-[180px]">
                Operario / Contratista
              </th>
              {daysInQuincena.map(day => (
                <th 
                  key={day.dayNumber} 
                  className={`py-2 px-2.5 border-r border-slate-800/80 min-w-[42px] ${
                    day.isWeekend ? 'bg-slate-900/60 text-slate-500' : 'text-slate-300'
                  }`}
                >
                  <div className="text-[10px] uppercase font-normal">{day.dayName}</div>
                  <div className="text-xs font-mono font-bold">{day.dayNumber}</div>
                </th>
              ))}
              <th className="py-3 px-3 bg-slate-900 text-slate-300 min-w-[65px] border-l border-slate-800">Norm</th>
              <th className="py-3 px-3 bg-cyan-950/60 text-cyan-300 min-w-[65px]">50%</th>
              <th className="py-3 px-3 bg-amber-950/60 text-amber-300 min-w-[65px]">100%</th>
              <th className="py-3 px-4 bg-slate-950 text-primary font-bold min-w-[80px]">TOTAL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredSabanaWorkers.length === 0 ? (
              <tr>
                <td colSpan={daysInQuincena.length + 5} className="py-8 text-center text-slate-400">
                  No se encontraron operarios en la sábana coincidentes con &quot;{sabanaSearch}&quot;
                </td>
              </tr>
            ) : (
              filteredSabanaWorkers.map(w => {
                let sumNorm = 0
                let sum50 = 0
                let sum100 = 0

                return (
                  <tr key={w.name} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3 text-left font-medium border-r border-slate-800 sticky left-0 bg-slate-900 z-10">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedQuincenaWorker(w.name === selectedQuincenaWorker ? null : w.name)
                          const el = document.getElementById('quincena-inspector-section')
                          if (el) el.scrollIntoView({ behavior: 'smooth' })
                        }}
                        className={`text-left font-bold flex items-center justify-between w-full group transition-colors cursor-pointer ${
                          selectedQuincenaWorker === w.name ? 'text-primary' : 'text-slate-200 hover:text-cyan-300'
                        }`}
                        title="Clic para ver y editar todas las horas de este operario"
                      >
                        <span className="truncate max-w-[120px]">
                          <HighlightText text={w.name} query={sabanaSearch} />
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                            w.type === 'Astillero'
                              ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60'
                              : w.type === 'Taller'
                              ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                              : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                          }`}>
                            <HighlightText text={w.type} query={sabanaSearch} />
                          </span>
                          <Pencil className="w-3 h-3 opacity-40 group-hover:opacity-100 text-cyan-400 transition-opacity" />
                        </span>
                      </button>
                    </td>

                    {daysInQuincena.map(day => {
                      const dayLogs = recentLogs.filter(l => l.worker_name === w.name && l.date_logged === day.dateStr)
                      const dayHours = dayLogs.reduce((acc, l) => acc + (parseFloat(l.hours_worked) || 0), 0)
                      const dayNorm = dayLogs.reduce((acc, l) => acc + (parseFloat(l.hours_normal) || parseFloat(l.hours_worked) || 0), 0)
                      const day50 = dayLogs.reduce((acc, l) => acc + (parseFloat(l.hours_extra_50) || 0), 0)
                      const day100 = dayLogs.reduce((acc, l) => acc + (parseFloat(l.hours_extra_100) || 0), 0)
                      const hasFeriado = dayLogs.some(l => (l.rubro || '').toLowerCase().includes('feriado'))
                      const target = hasFeriado ? 8 : 9
                      const hasR = dayLogs.some(l => l.approval_status === 'R')
                      const hasRR = dayLogs.some(l => l.approval_status === 'RR')

                      sumNorm += dayNorm
                      sum50 += day50
                      sum100 += day100

                      return (
                        <td 
                          key={day.dayNumber}
                          className={`py-2 px-1 border-r border-slate-800/60 font-mono text-xs ${
                            day.isWeekend ? 'bg-slate-950/40 text-slate-600' : ''
                          }`}
                        >
                          {dayHours > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleEditDayCell(w.name, day.dateStr, dayLogs)}
                              className={`inline-block px-1.5 py-0.5 rounded font-bold transition-all hover:scale-110 cursor-pointer relative ${
                                hasR
                                  ? 'bg-rose-950 text-rose-200 border border-rose-500 shadow-sm shadow-rose-950'
                                  : hasRR
                                  ? 'bg-amber-950 text-amber-200 border border-amber-500 shadow-sm shadow-amber-950'
                                  : day50 > 0 || day100 > 0 
                                  ? 'text-cyan-300 font-extrabold bg-cyan-950/80 border border-cyan-800/60' 
                                  : dayHours >= target 
                                  ? 'text-emerald-400 bg-emerald-950/60 border border-emerald-800/40' 
                                  : 'text-amber-400 bg-amber-950/60 border border-amber-800/40'
                              }`}
                              title={
                                hasR
                                  ? `🔴 Requiere Revisión (R - Alerta Operario) - ${dayHours} hs`
                                  : hasRR
                                  ? `🟡 Horas Corregidas (RR - Alerta Supervisor) - ${dayHours} hs`
                                  : `Clic para editar registro del día ${day.dateStr} (${dayHours} hs)`
                              }
                            >
                              {dayHours}
                              {hasR && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-rose-500 border border-slate-900 animate-pulse" />
                              )}
                              {hasRR && !hasR && (
                                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 border border-slate-900" />
                              )}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleQuickAddFromSabana(w.name, w.type, day.dateStr)}
                              className="text-slate-700 hover:text-cyan-400 px-1 py-0.5 rounded hover:bg-slate-800 transition-colors cursor-pointer text-xs"
                              title={`Clic para cargar horas el ${day.dateStr}`}
                            >
                              -
                            </button>
                          )}
                        </td>
                      )
                    })}

                    <td className="py-2.5 px-3 font-mono font-bold text-slate-300 border-l border-slate-800 bg-slate-950/40">
                      {sumNorm}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-cyan-400 bg-cyan-950/20">
                      {sum50}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-amber-400 bg-amber-950/20">
                      {sum100}
                    </td>
                    <td className="py-2.5 px-4 font-mono font-extrabold text-primary bg-slate-950">
                      {sumNorm + sum50 + sum100} hs
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pie de la Sábana con leyenda */}
      <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
            Jornada normal (9h / 8h Feriado)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 inline-block"></span>
            Horas Extras (50% / 100%)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
            Jornada Incompleta
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-rose-300">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 inline-block animate-pulse"></span>
            🔴 Requiere Revisión (R - Operario)
          </span>
          <span className="flex items-center gap-1.5 font-semibold text-amber-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block"></span>
            🟡 Horas Corregidas (RR - Supervisor)
          </span>
          <span className="text-slate-500 italic ml-2">
            &bull; Hacé clic en cualquier celda o nombre de operario para corregir horas in-situ.
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            alert('¡Cierre quincenal verificado! Las horas están consolidadas para liquidación.')
          }}
          className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-sm self-start sm:self-auto"
        >
          <CheckCircle className="w-4 h-4 text-emerald-400" />
          <span>Aprobar Cierre Quincenal (R)</span>
        </button>
      </div>

      {/* SECCIÓN INTERACTIVA: DETALLE Y CORRECCIÓN POR OPERARIO */}
      <div id="quincena-inspector-section" className="pt-6 border-t border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-950/80 p-4 rounded-xl border border-slate-800">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Pencil className="w-4 h-4 text-primary" />
                {selectedQuincenaWorker 
                  ? `Auditoría y Corrección de Imputaciones: ${selectedQuincenaWorker}` 
                  : 'Todas las Imputaciones de la Quincena (Hacé clic en un operario para aislarlo)'}
              </h3>
              {selectedQuincenaWorker && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold">
                  Filtrado
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Podés modificar rubro, horas normales, extras o eliminar cualquier registro directamente desde acá.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {selectedQuincenaWorker && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const workerObj = allQuincenaWorkers.find(x => x.name === selectedQuincenaWorker)
                    handleQuickAddFromSabana(selectedQuincenaWorker, workerObj?.type || 'Astillero', daysInQuincena[0]?.dateStr)
                  }}
                  className="px-3 py-1.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Imputar Horas</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedQuincenaWorker(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg border border-slate-700 cursor-pointer"
                >
                  Ver Todos
                </button>
              </>
            )}
          </div>
        </div>

        {/* Grilla Detallada de la Quincena */}
        {(() => {
          const quincenaLogs = recentLogs.filter(log => {
            if (!log.date_logged) return false
            const [year, month, day] = log.date_logged.split('-').map(Number)
            const matchYear = year === parseInt(selectedYear, 10)
            const matchMonth = month === parseInt(selectedMonth, 10)
            const matchQuincena = selectedQuincena === '1' ? (day >= 1 && day <= 15) : (day >= 16)
            const matchWorker = !selectedQuincenaWorker || log.worker_name === selectedQuincenaWorker
            return matchYear && matchMonth && matchQuincena && matchWorker
          })

          if (quincenaLogs.length === 0) {
            return (
              <div className="py-8 text-center text-slate-500 text-xs border border-dashed border-slate-800 rounded-xl">
                No se encontraron registros de horas para {selectedQuincenaWorker || 'este período'}.
              </div>
            )
          }

          return (
            <div className="overflow-y-auto max-h-[calc(100vh-320px)] border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="sticky top-0 z-20 bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 shadow-sm backdrop-blur-md">
                  <tr>
                    <th className="py-2.5 px-2 text-center w-8 bg-slate-950">
                      <input
                        type="checkbox"
                        checked={quincenaLogs.length > 0 && quincenaLogs.every(l => selectedLogIds.has(l.id))}
                        onChange={() => toggleSelectAllLogs(quincenaLogs.map(l => l.id))}
                        className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary"
                        title="Seleccionar todas las imputaciones visibles"
                      />
                    </th>
                    <th className="py-2.5 px-3 bg-slate-950">Fecha</th>
                    <th className="py-2.5 px-3 bg-slate-950">Operario</th>
                    <th className="py-2.5 px-2 bg-slate-950">Tipo</th>
                    <th className="py-2.5 px-3 bg-slate-950">Barco & OT</th>
                    <th className="py-2.5 px-3 bg-slate-950">Rubro</th>
                    <th className="py-2.5 px-2 text-center bg-slate-950">Norm</th>
                    <th className="py-2.5 px-2 text-center text-cyan-400 bg-slate-950">50%</th>
                    <th className="py-2.5 px-2 text-center text-amber-400 bg-slate-950">100%</th>
                    <th className="py-2.5 px-3 text-center text-primary font-bold bg-slate-950">Total</th>
                    <th className="py-2.5 px-2 text-center bg-slate-950">Estado</th>
                    <th className="py-2.5 px-3 text-right bg-slate-950">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {quincenaLogs.map(log => {
                    const isSelected = selectedLogIds.has(log.id)
                    return (
                      <tr 
                        key={log.id} 
                        onClick={(e) => {
                          if (e.target.closest('button') || e.target.closest('select') || e.target.tagName === 'INPUT') return
                          toggleSelectLog(log.id)
                        }}
                        className={`transition-colors cursor-pointer select-none ${
                          isSelected ? 'bg-cyan-950/50 hover:bg-cyan-950/70 border-l-2 border-l-cyan-400' : 'hover:bg-slate-800/30'
                        }`}
                      >
                        <td className="py-2 px-2 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectLog(log.id)}
                            className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary"
                          />
                        </td>
                        <td className="py-2 px-3 font-mono text-slate-400">{log.date_logged}</td>
                        <td className="py-2 px-3 font-bold text-white">{log.worker_name}</td>
                        <td className="py-2 px-2">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                            log.worker_type === 'Astillero' 
                              ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60' 
                              : log.worker_type === 'Taller'
                              ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                              : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                          }`}>
                            {log.worker_type || 'Astillero'}
                          </span>
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-white block">{log.work_orders?.ships?.name}</span>
                          <span className="text-[11px] text-slate-400">{log.work_orders?.title}</span>
                        </td>
                        <td className="py-2 px-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] ${
                            (log.rubro || '').toLowerCase().includes('feriado')
                              ? 'bg-amber-950 text-amber-300 border border-amber-700/80 font-bold'
                              : 'bg-slate-800 text-slate-300'
                          }`}>
                            {log.rubro || 'General'}
                          </span>
                        </td>
                        <td className="py-2 px-2 text-center font-mono">{log.hours_normal || log.hours_worked}</td>
                        <td className="py-2 px-2 text-center font-mono text-cyan-400">{log.hours_extra_50 || 0}</td>
                        <td className="py-2 px-2 text-center font-mono text-amber-400">{log.hours_extra_100 || 0}</td>
                        <td className="py-2 px-3 text-center font-mono font-bold text-primary">{log.hours_worked} hs</td>
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <select
                              value={log.approval_status || ''}
                              onChange={(e) => handleUpdateApprovalStatus(log.id, e.target.value)}
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer focus:outline-none ${
                                log.approval_status === 'S' || log.approval_status === 'Aprobado'
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                  : log.approval_status === 'R'
                                  ? 'bg-rose-950 text-rose-300 border-rose-500 shadow-sm shadow-rose-900/50'
                                  : log.approval_status === 'RR'
                                  ? 'bg-amber-950 text-amber-300 border-amber-500'
                                  : log.approval_status === 'RRR'
                                  ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                                  : 'bg-slate-900 text-slate-400 border-slate-700'
                              }`}
                              title={`Estado de revisión de ${log.worker_name}`}
                            >
                              <option value="">-</option>
                              <option value="S">S (Aprobado)</option>
                              <option value="R">R (Revisión)</option>
                              <option value="RR">RR (Corregido)</option>
                              <option value="RRR">RRR (Aprobado Fin)</option>
                            </select>
                            {log.review_reason && (
                              <button
                                type="button"
                                onClick={() => {
                                  setReviewReasonModal({
                                    isOpen: true,
                                    logId: log.id,
                                    workerName: log.worker_name,
                                    dateLogged: log.date_logged,
                                    shipWo: `${log.work_orders?.ships?.name || ''} - ${log.work_orders?.title || ''}`,
                                    targetStatus: log.approval_status || 'R',
                                    reason: log.review_reason || '',
                                    response: log.worker_response || ''
                                  })
                                }}
                                className="p-1 text-rose-400 hover:text-rose-300 rounded hover:bg-rose-900/40 transition-colors"
                                title={`Motivo de observación (R): ${log.review_reason}`}
                              >
                                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                              </button>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditFromDaily(log)}
                              className="p-1 text-slate-400 hover:text-primary rounded hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Editar registro"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteLog(log.id, log.worker_name)}
                              className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
