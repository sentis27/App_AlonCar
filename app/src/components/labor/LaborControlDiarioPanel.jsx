import { useState, useMemo } from 'react'
import { useAuth } from '../../context/AuthContext'
import { useModuleFilterMemory, resolveInitialModuleFilters } from '../../hooks/useModuleFilterMemory'
import CanonicalZone3Toolbar from '../canonical/CanonicalZone3Toolbar'
import { getFilterSelectClass } from '../../lib/filterThemeConstants'
import { getTodayArIso } from '../../lib/dateTimeCanonical'
import {
  Calendar,
  UserCheck,
  Ship,
  Pencil,
  Plus,
  Trash2
} from 'lucide-react'
import HighlightText from '../HighlightText'
import CanonicalOtBadge from '../canonical/CanonicalOtBadge'
import FormulaNumericInput, { FormulaCellCornerMark } from '../canonical/FormulaNumericInput'
import {
  evaluateFormulaInput,
  buildCellFormulasPatch,
  describeFormula,
  getStoredCellFormula,
  getEditableCellInitialValue
} from '../../lib/formulaEngine'
import { patchLaborLogService } from '../../services/laborService'
import {
  cleanShipName,
  NOMINA_ASTILLERO_BASE,
  TALLERES_FRECUENTES,
  CONTRATISTAS_FRECUENTES
} from '../../lib/laborConstants'
import { matchesUniversalSearch } from '../../lib/searchEngine'

export default function LaborControlDiarioPanel({
  ships = [],
  workOrders = [],
  workItems = [],
  auditDate,
  setAuditDate,
  recentLogs = [],
  setRecentLogs,
  dbWorkers = [],
  selectedLogIds = new Set(),
  toggleSelectLog,
  toggleSelectAllLogs,
  handleUpdateApprovalStatus,
  setShipPickerModal,
  openQuickLogModal,
  handleEditFromDaily,
  handleDeleteLog
}) {
  const { user, profile } = useAuth()
  const initialDailyFilters = useMemo(
    () => resolveInitialModuleFilters(user, profile, 'labor_control_diario'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  const [dailySearch, setDailySearch] = useState(initialDailyFilters.dailySearch || '')
  const [dailyFilterType, setDailyFilterType] = useState(initialDailyFilters.dailyFilterType || 'todos')
  const [inlineLogEdit, setInlineLogEdit] = useState({ id: null, field: null, value: '' })

  const controlViewsController = useModuleFilterMemory({
    moduleKey: 'labor_control_diario',
    currentFilters: { dailySearch, dailyFilterType, auditDate },
    onApplyFilters: (f) => {
      setDailySearch(f.dailySearch ?? '')
      setDailyFilterType(f.dailyFilterType ?? 'todos')
      if (f.auditDate) setAuditDate?.(f.auditDate)
    },
    hasActiveFilters: Boolean(dailySearch || dailyFilterType !== 'todos')
  })

  const activateHorasCell = (log, field) => {
    if (!log) return
    const isHourField = ['hours_normal', 'hours_extra_50', 'hours_extra_100'].includes(field)
    setInlineLogEdit({
      id: log.id,
      field,
      value: isHourField ? getEditableCellInitialValue(log, field, log[field] ?? '') : (log[field] ?? '')
    })
  }

  const saveInlineLogEdit = async (logId, field, value) => {
    if (!logId || !field) return
    setInlineLogEdit({ id: null, field: null, value: '' })

    const targetLog = recentLogs.find(l => l.id === logId)
    if (!targetLog) return

    const isHourField = ['hours_normal', 'hours_extra_50', 'hours_extra_100'].includes(field)
    let numVal = value
    let nextFormulas = null
    if (isHourField) {
      const parsed = evaluateFormulaInput(value, { allowNegative: false, maxDecimals: 2, emptyValue: 0 })
      if (!parsed.ok) return
      numVal = parsed.value ?? 0
      nextFormulas = buildCellFormulasPatch(targetLog.cell_formulas, field, parsed.formula)
    }

    setRecentLogs(prev =>
      prev.map(l => {
        if (l.id !== logId) return l
        const updated = { ...l, [field]: numVal, ...(nextFormulas ? { cell_formulas: nextFormulas } : {}) }
        if (isHourField) {
          const n = parseFloat(updated.hours_normal) || 0
          const h50 = parseFloat(updated.hours_extra_50) || 0
          const h100 = parseFloat(updated.hours_extra_100) || 0
          updated.hours_worked = n + h50 + h100
        }
        return updated
      })
    )

    try {
      const payload = { [field]: numVal }
      if (isHourField) {
        const n = field === 'hours_normal' ? numVal : (parseFloat(targetLog.hours_normal) || 0)
        const h50 = field === 'hours_extra_50' ? numVal : (parseFloat(targetLog.hours_extra_50) || 0)
        const h100 = field === 'hours_extra_100' ? numVal : (parseFloat(targetLog.hours_extra_100) || 0)
        payload.hours_worked = n + h50 + h100
        payload.cell_formulas = nextFormulas
      }
      await patchLaborLogService(logId, payload)
    } catch (err) {
      console.error('Error guardando celda inline en Control Diario:', err)
    }
  }

  // Fuentes reactivas desde Supabase (workers) o nómina oficial de respaldo
  const astilleroSource = useMemo(() => {
    if (dbWorkers.length > 0) {
      const filtered = dbWorkers.filter(w => w.admin_center === 'ASTILLERO' && w.status === 'ACTIVO' && w.can_impute_hours !== false)
      if (filtered.length > 0) return filtered.map(w => ({ name: w.name, defaultRubro: w.trade || 'General' }))
    }
    return NOMINA_ASTILLERO_BASE
  }, [dbWorkers])

  const tallerSource = useMemo(() => {
    if (dbWorkers.length > 0) {
      const set = new Set(dbWorkers.filter(w => w.admin_center === 'TALLER').map(w => w.work_group))
      if (set.size > 0) return Array.from(set).sort()
    }
    return TALLERES_FRECUENTES
  }, [dbWorkers])

  const contratistaSource = useMemo(() => {
    if (dbWorkers.length > 0) {
      const set = new Set(dbWorkers.filter(w => w.admin_center === 'CONTRATISTA').map(w => w.work_group))
      if (set.size > 0) return Array.from(set).sort()
    }
    return CONTRATISTAS_FRECUENTES
  }, [dbWorkers])

  const allKnownWorkers = useMemo(() => {
    const list = []
    const astilleroNames = new Set(astilleroSource.map(w => w.name))
    recentLogs.forEach(l => {
      if (l.worker_name && l.worker_type === 'Astillero') astilleroNames.add(l.worker_name)
    })
    astilleroNames.forEach(name => {
      const base = astilleroSource.find(b => b.name === name)
      list.push({ name, defaultRubro: base?.defaultRubro || 'General', type: 'Astillero' })
    })

    const tallerNames = new Set(tallerSource)
    recentLogs.forEach(l => {
      if (l.worker_name && l.worker_type === 'Taller') tallerNames.add(l.worker_name)
    })
    tallerNames.forEach(name => {
      list.push({ name, defaultRubro: 'Taller Externo', type: 'Taller' })
    })

    const contratistaNames = new Set(contratistaSource)
    recentLogs.forEach(l => {
      if (l.worker_name && l.worker_type === 'Contratista') contratistaNames.add(l.worker_name)
    })
    contratistaNames.forEach(name => {
      list.push({ name, defaultRubro: 'Servicio Contratista', type: 'Contratista' })
    })

    return list
  }, [astilleroSource, tallerSource, contratistaSource, recentLogs])

  const logsForAuditDate = useMemo(() => {
    return recentLogs.filter(l => l.date_logged === auditDate)
  }, [recentLogs, auditDate])

  const allAuditDateLogIds = useMemo(() => {
    return logsForAuditDate.map(l => l.id)
  }, [logsForAuditDate])

  const unifiedDailyList = useMemo(() => {
    return allKnownWorkers.map(w => {
      const logs = logsForAuditDate.filter(l => l.worker_name === w.name)
      const totalNormal = logs.reduce((a, b) => a + (parseFloat(b.hours_normal) || (parseFloat(b.hours_worked) || 0)), 0)
      const total50 = logs.reduce((a, b) => a + (parseFloat(b.hours_extra_50) || 0), 0)
      const total100 = logs.reduce((a, b) => a + (parseFloat(b.hours_extra_100) || 0), 0)
      const totalDay = totalNormal + total50 + total100

      const isFeriado = logs.some(l => (l.rubro || '').toLowerCase().includes('feriado'))
      const targetHours = w.type === 'Astillero' ? (isFeriado ? 8 : 9) : null

      let status = 'sin_carga'
      if (w.type === 'Astillero') {
        if (totalDay === 0) {
          status = 'sin_carga'
        } else if (totalNormal < targetHours) {
          status = 'incompleta'
        } else if (totalNormal >= targetHours) {
          status = (total50 > 0 || total100 > 0 || totalDay > targetHours) ? 'extras' : 'completa'
        }
      } else {
        status = totalDay > 0 ? 'registrado' : 'sin_carga'
      }

      return {
        worker: w,
        type: w.type,
        defaultRubro: w.defaultRubro,
        isFeriado,
        targetHours,
        totalNormal,
        total50,
        total100,
        totalDay,
        status,
        logs
      }
    })
  }, [allKnownWorkers, logsForAuditDate])

  const filteredDailyList = useMemo(() => {
    return unifiedDailyList.filter(item => {
      const matchSearch = !dailySearch || matchesUniversalSearch(item, dailySearch, {
        extraSearchableValues: [
          item.worker?.name,
          item.defaultRubro,
          item.type,
          ...(item.logs || []).flatMap(l => [
            l.rubro,
            l.work_orders?.ships?.name,
            l.work_orders?.ot_number,
            l.work_orders?.title,
            l.cost_center,
            l.notes
          ])
        ]
      })

      if (!matchSearch) return false
      if (dailyFilterType === 'todos') return true
      if (dailyFilterType === 'Astillero') return item.type === 'Astillero'
      if (dailyFilterType === 'Taller') return item.type === 'Taller'
      if (dailyFilterType === 'Contratista') return item.type === 'Contratista'
      if (dailyFilterType === 'sin_carga') return item.status === 'sin_carga'
      if (dailyFilterType === 'incompleta') return item.status === 'incompleta'
      if (dailyFilterType === 'completa') return item.status === 'completa' || item.status === 'extras'
      if (dailyFilterType === 'revision_R') return item.logs.some(l => l.approval_status === 'R')
      if (dailyFilterType === 'corregidas_RR') return item.logs.some(l => l.approval_status === 'RR')
      if (dailyFilterType === 'sin_ot') return item.logs.some(l => !l.work_order_id)
      if (dailyFilterType === 'sin_prc') return item.logs.some(l => (l.cost_center === 'PRESUPUESTO' || l.work_type === 'PRESUPUESTO') && !l.prc_number)
      return true
    })
  }, [unifiedDailyList, dailySearch, dailyFilterType])

  const astilleroWorkersList = useMemo(() => unifiedDailyList.filter(i => i.type === 'Astillero'), [unifiedDailyList])
  const totalAstillero = astilleroWorkersList.length
  const completasAstillero = astilleroWorkersList.filter(i => i.status === 'completa' || i.status === 'extras').length
  const incompletasAstillero = astilleroWorkersList.filter(i => i.status === 'incompleta').length
  const sinCargaAstillero = astilleroWorkersList.filter(i => i.status === 'sin_carga').length

  const auditDateRCount = useMemo(() => logsForAuditDate.filter(l => l.approval_status === 'R').length, [logsForAuditDate])
  const auditDateRRCount = useMemo(() => logsForAuditDate.filter(l => l.approval_status === 'RR').length, [logsForAuditDate])

  return (
    <div className="alon-workspace-block">
      {/* ZONA 3: BARRA DE FECHA, BÚSQUEDA Y FILTROS DE CONTROL DIARIO */}
      <CanonicalZone3Toolbar
        searchValue={dailySearch}
        onSearchChange={setDailySearch}
        searchPlaceholder="Buscar operario, taller, rubro... (Ctrl+F | Esc limpia todo)"
        viewsController={controlViewsController}
        hasActiveFilters={Boolean(dailySearch.trim() || dailyFilterType !== 'todos')}
        onClearAllFilters={() => {
          setDailySearch('')
          setDailyFilterType('todos')
        }}
        filters={
          <>
            <div className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-primary shrink-0" />
              <input
                type="date"
                value={auditDate}
                onChange={(e) => setAuditDate(e.target.value)}
                className={getFilterSelectClass('period', true)}
                title="Fecha de Auditoría"
              />
              <button
                type="button"
                onClick={() => setAuditDate(getTodayArIso())}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-300 rounded-lg border border-slate-700 cursor-pointer"
              >
                Ir a Hoy
              </button>
            </div>

            <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>

            <button
              type="button"
              onClick={() => setDailyFilterType('todos')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                dailyFilterType === 'todos'
                  ? 'bg-primary text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Todos ({unifiedDailyList.length})
            </button>
            <button
              type="button"
              onClick={() => setDailyFilterType('Astillero')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                dailyFilterType === 'Astillero'
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Astillero ({totalAstillero})
            </button>
            <button
              type="button"
              onClick={() => setDailyFilterType('Taller')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                dailyFilterType === 'Taller'
                  ? 'bg-purple-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Talleres ({unifiedDailyList.filter(i => i.type === 'Taller').length})
            </button>
            <button
              type="button"
              onClick={() => setDailyFilterType('Contratista')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                dailyFilterType === 'Contratista'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              Contratistas ({unifiedDailyList.filter(i => i.type === 'Contratista').length})
            </button>
            <button
              type="button"
              onClick={() => setDailyFilterType('sin_carga')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                dailyFilterType === 'sin_carga'
                  ? 'bg-rose-500 text-white font-bold'
                  : 'bg-slate-950 text-rose-400 hover:text-rose-300 border border-rose-900/40'
              }`}
            >
              Sin Carga 🔴 ({sinCargaAstillero})
            </button>
            <button
              type="button"
              onClick={() => setDailyFilterType('incompleta')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                dailyFilterType === 'incompleta'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-amber-400 hover:text-amber-300 border border-amber-900/40'
              }`}
            >
              Incompletas 🟡 ({incompletasAstillero})
            </button>
            <button
              type="button"
              onClick={() => setDailyFilterType('completa')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                dailyFilterType === 'completa'
                  ? 'bg-emerald-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-emerald-400 hover:text-emerald-300 border border-emerald-900/40'
              }`}
            >
              Completas 🟢 ({completasAstillero})
            </button>
            <button
              type="button"
              onClick={() => setDailyFilterType('revision_R')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                dailyFilterType === 'revision_R'
                  ? 'bg-rose-600 text-white font-bold'
                  : 'bg-slate-950 text-rose-400 hover:text-rose-300 border border-rose-900/40'
              }`}
            >
              🔴 En Revisión R ({auditDateRCount})
            </button>
            <button
              type="button"
              onClick={() => setDailyFilterType('corregidas_RR')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                dailyFilterType === 'corregidas_RR'
                  ? 'bg-amber-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-amber-400 hover:text-amber-300 border border-amber-900/40'
              }`}
            >
              🟡 Corregidas RR ({auditDateRRCount})
            </button>
          </>
        }
      />

      {/* ZONA 4: TABLA PRINCIPAL DE CONTROL DIARIO EN MODO LISTA */}
      <div className="alon-zone-grid p-5 md:p-6 space-y-4">
        <div className="border-b border-slate-800 pb-3">
          <h2 className="text-sm uppercase tracking-wider font-bold text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-cyan-400" />
            Nómina Diaria en Modo Lista
          </h2>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Regla Astillero: <strong>9 hs obligatorias</strong> (salvo Feriado = <strong>8 hs</strong>). Talleres y Contratistas no tienen regla de cuota diaria.
          </p>
        </div>

        {/* TABLA DE AUDITORÍA */}
        <div className="alon-grid-scroll border border-slate-800 rounded-xl">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="sticky top-0 z-20 bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800 shadow-sm backdrop-blur-md">
              <tr>
                <th className="py-2.5 px-2 text-center w-8 bg-slate-950">
                  <input
                    type="checkbox"
                    checked={allAuditDateLogIds.length > 0 && allAuditDateLogIds.every(id => selectedLogIds.has(id))}
                    onChange={() => toggleSelectAllLogs(allAuditDateLogIds)}
                    disabled={allAuditDateLogIds.length === 0}
                    className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary disabled:opacity-30"
                    title="Seleccionar todas las imputaciones del día"
                  />
                </th>
                <th className="py-2.5 px-2 min-w-[95px] bg-slate-950">Aprobación</th>
                <th className="py-2.5 px-3 bg-slate-950">Estado / Semáforo</th>
                <th className="py-2.5 px-3 bg-slate-950">Operario / Taller</th>
                <th className="py-2.5 px-2 bg-slate-950">Tipo</th>
                <th className="py-2.5 px-3 bg-slate-950">Imputación (Barco & OT)</th>
                <th className="py-2.5 px-3 bg-slate-950">Rubro(s)</th>
                <th className="py-2.5 px-2 text-center bg-slate-950">Norm</th>
                <th className="py-2.5 px-2 text-center text-cyan-400 bg-slate-950">50%</th>
                <th className="py-2.5 px-2 text-center text-amber-400 bg-slate-950">100%</th>
                <th className="py-2.5 px-3 text-center text-primary font-bold bg-slate-950">Total Día</th>
                <th className="py-2.5 px-3 text-right bg-slate-950">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDailyList.length === 0 ? (
                <tr>
                  <td colSpan={12} className="py-8 text-center text-slate-500">
                    No se encontraron registros para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredDailyList.map(item => {
                  const isAstillero = item.type === 'Astillero'
                  const isSinCarga = item.status === 'sin_carga'
                  const isIncompleta = item.status === 'incompleta'
                  const isCompleta = item.status === 'completa'
                  const isExtras = item.status === 'extras'
                  const isSelected = item.logs.length > 0 && item.logs.every(l => selectedLogIds.has(l.id))

                  return (
                    <tr 
                      key={`${item.worker.name}-${item.type}`} 
                      className={`transition-colors select-none ${
                        isSelected 
                          ? 'bg-cyan-950/50 hover:bg-cyan-950/70 border-l-2 border-l-cyan-400' 
                          : isSinCarga ? 'bg-rose-950/10 hover:bg-rose-950/20' : isIncompleta ? 'bg-amber-950/10 hover:bg-amber-950/20' : 'hover:bg-slate-800/30'
                      }`}
                    >
                      {/* Checkbox Selección */}
                      <td className="py-2.5 px-2 text-center align-top">
                        {item.logs.length === 0 ? (
                          <span className="text-slate-700 text-xs">-</span>
                        ) : (
                          <div className="space-y-2 py-0.5">
                            {item.logs.map(log => (
                              <div key={log.id} className="h-6 flex items-center justify-center">
                                <input
                                  type="checkbox"
                                  checked={selectedLogIds.has(log.id)}
                                  onChange={() => toggleSelectLog(log.id)}
                                  className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary"
                                  title={`Seleccionar ${log.work_orders?.ships?.name} - ${log.work_orders?.title}`}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Casilla de Aprobación */}
                      <td className="py-2.5 px-2 align-top">
                        {item.logs.length === 0 ? (
                          <span className="text-slate-700 text-xs">-</span>
                        ) : (
                          <div className="space-y-2 py-0.5">
                            {item.logs.map(log => {
                              const status = log.approval_status || ''
                              const isS = status === 'S' || status === 'Aprobado'
                              const isR = status === 'R'
                              const isRR = status === 'RR'
                              const isRRR = status === 'RRR'

                              return (
                                <div key={log.id} className="h-6 flex items-center">
                                  <select
                                    value={status}
                                    onChange={(e) => handleUpdateApprovalStatus(log.id, e.target.value)}
                                    className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border transition-colors cursor-pointer focus:outline-none ${
                                      isS
                                        ? 'bg-emerald-950 text-emerald-300 border-emerald-600'
                                        : isR
                                        ? 'bg-rose-950 text-rose-300 border-rose-500 shadow-sm shadow-rose-900/50'
                                        : isRR
                                        ? 'bg-amber-950 text-amber-300 border-amber-500'
                                        : isRRR
                                        ? 'bg-cyan-950 text-cyan-300 border-cyan-500'
                                        : 'bg-slate-950 text-slate-400 border-slate-700'
                                    }`}
                                    title={`Estado de aprobación de ${log.work_orders?.title}`}
                                  >
                                    <option value="" className="bg-slate-900 text-slate-400">-</option>
                                    <option value="S" className="bg-slate-900 text-emerald-400 font-bold">S (Aprobado)</option>
                                    <option value="R" className="bg-slate-900 text-rose-400 font-bold">R (Revisión)</option>
                                    <option value="RR" className="bg-slate-900 text-amber-400 font-bold">RR (Corregido)</option>
                                    <option value="RRR" className="bg-slate-900 text-cyan-400 font-bold">RRR (Aprobado Fin)</option>
                                  </select>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </td>

                      {/* Semáforo */}
                      <td className="py-2.5 px-3 align-top">
                        {isAstillero ? (
                          <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                            isSinCarga
                              ? 'bg-rose-950 text-rose-300 border-rose-800/80'
                              : isIncompleta
                              ? 'bg-amber-950 text-amber-300 border-amber-800/80'
                              : isExtras
                              ? 'bg-cyan-950 text-cyan-300 border-cyan-800/80'
                              : 'bg-emerald-950 text-emerald-300 border-emerald-800/80'
                          }`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              isSinCarga ? 'bg-rose-400 animate-pulse' : isIncompleta ? 'bg-amber-400' : isExtras ? 'bg-cyan-400' : 'bg-emerald-400'
                            }`}></span>
                            {isSinCarga && '0 hs (Sin Carga)'}
                            {isIncompleta && `${item.totalDay}h (Faltan ${item.targetHours - item.totalDay}h)`}
                            {isCompleta && `${item.targetHours}h (Jornada Completa)`}
                            {isExtras && `${item.totalDay}h (Completa + Extras)`}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-900 text-slate-300 border border-slate-800">
                            {item.totalDay > 0 ? `${item.totalDay} hs imputadas` : 'Sin actividad hoy'}
                          </span>
                        )}
                      </td>

                      {/* Operario */}
                      <td className="py-2.5 px-3 align-top">
                        <span className="font-bold text-white block">
                          <HighlightText text={item.worker.name} query={dailySearch} />
                        </span>
                        <span className="text-[10px] text-slate-400">
                          Habitual: <HighlightText text={item.defaultRubro} query={dailySearch} />
                        </span>
                      </td>

                      {/* Tipo */}
                      <td className="py-2.5 px-2 align-top">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                          item.type === 'Astillero'
                            ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60'
                            : item.type === 'Taller'
                            ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                            : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                        }`}>
                          <HighlightText text={item.type} query={dailySearch} />
                        </span>
                      </td>

                      {/* Imputación OT */}
                      <td className="py-2.5 px-3 align-top font-sans">
                        {item.logs.length === 0 ? (
                          <span className="text-slate-500 italic text-[11px]">Sin imputación</span>
                        ) : (
                          <div className="space-y-2 py-0.5">
                            {item.logs.map(l => {
                              const shipName = cleanShipName(l.ships?.name || l.work_orders?.ships?.name || '') || 'Sin Buque'
                              const ot = (l.work_order_id && workOrders.find((w) => String(w.id) === String(l.work_order_id))) || l.work_orders || null
                              const shipObj = ships.find((s) => String(s.id) === String(l.ship_id || ot?.ship_id)) || l.ships || l.work_orders?.ships || null

                              return (
                                <div 
                                  key={l.id} 
                                  onDoubleClick={() => {
                                    setShipPickerModal({
                                      isOpen: true,
                                      logId: l.id,
                                      rowIndex: null,
                                      currentShipId: l.ship_id || l.work_orders?.ship_id || '',
                                      currentWorkOrderId: l.work_order_id || '',
                                      workerName: `${item.worker.name} (${l.rubro || 'General'})`
                                    })
                                  }}
                                  className="h-6 flex items-center text-[11px] truncate max-w-[270px] cursor-pointer hover:bg-cyan-950/40 px-1 rounded transition-colors group" 
                                  title="Doble clic para cambiar Buque u OT"
                                >
                                  <Ship className="w-3 h-3 text-cyan-400 mr-1 shrink-0" />
                                  <strong className="text-white mr-1 truncate shrink-0 max-w-[95px]">
                                    <HighlightText text={shipName} query={dailySearch} />:
                                  </strong>
                                  <CanonicalOtBadge
                                    wo={l.work_order_id ? ot : null}
                                    ship={shipObj}
                                    workItems={workItems}
                                    workOrders={workOrders}
                                    searchQuery={dailySearch}
                                    variant="inline"
                                    sinOtLabel="Sin OT (Doble clic)"
                                    className="text-[10px] text-slate-300 flex-1 min-w-0"
                                  />
                                  {item.logs.length > 1 && (
                                    <span className="ml-1 text-[10px] text-cyan-400 font-mono font-bold shrink-0">
                                      ({l.hours_worked || l.hours_normal || 0}h)
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </td>

                      {/* Rubro(s) */}
                      <td className="py-2.5 px-3 align-top">
                        {item.logs.length === 0 ? (
                          <span className="text-slate-600 text-[11px]">-</span>
                        ) : (
                          <div className="space-y-2 py-0.5">
                            {item.logs.map(l => {
                              const isLogFeriado = (l.rubro || '').toLowerCase().includes('feriado')
                              return (
                                <div
                                  key={l.id}
                                  onDoubleClick={() => activateHorasCell(l, 'rubro')}
                                  className="h-6 flex items-center cursor-pointer"
                                  title="Doble clic para editar Rubro"
                                >
                                  {inlineLogEdit.id === l.id && inlineLogEdit.field === 'rubro' ? (
                                    <input
                                      type="text"
                                      list="rubros-list-carga"
                                      autoFocus
                                      value={inlineLogEdit.value}
                                      onChange={(e) => setInlineLogEdit({ ...inlineLogEdit, value: e.target.value })}
                                      onKeyDown={(e) => {
                                        if (e.key === 'Enter') saveInlineLogEdit(l.id, 'rubro', inlineLogEdit.value)
                                        if (e.key === 'Escape') setInlineLogEdit({ id: null, field: null, value: '' })
                                      }}
                                      onBlur={() => saveInlineLogEdit(l.id, 'rubro', inlineLogEdit.value)}
                                      className="w-28 bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-[11px] text-white focus:outline-none"
                                    />
                                  ) : (
                                    <span 
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-medium truncate max-w-[130px] hover:ring-1 hover:ring-cyan-400 ${
                                        isLogFeriado 
                                          ? 'bg-amber-950 text-amber-300 border border-amber-700/80 font-bold' 
                                          : 'bg-slate-800 text-slate-300'
                                      }`}
                                    >
                                      <HighlightText text={l.rubro || 'General'} query={dailySearch} />
                                    </span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </td>

                      {/* Horas Normales */}
                      <td className="py-2.5 px-2 text-center font-mono align-top">
                        {item.logs.length === 0 ? (
                          <span className="text-slate-600">-</span>
                        ) : (
                          <div className="space-y-2 py-0.5">
                            {item.logs.map(l => {
                              const fNorm = getStoredCellFormula(l, 'hours_normal')
                              return (
                              <div
                                key={l.id}
                                onDoubleClick={() => activateHorasCell(l, 'hours_normal')}
                                className="relative h-6 flex items-center justify-center cursor-pointer hover:bg-slate-800/80 rounded px-1"
                                title={describeFormula(fNorm)?.tooltipText || 'Doble clic para editar Horas Normales (acepta =4+4.5)'}
                              >
                                <FormulaCellCornerMark formula={fNorm} />
                                {inlineLogEdit.id === l.id && inlineLogEdit.field === 'hours_normal' ? (
                                  <FormulaNumericInput
                                    variant="cell"
                                    autoFocus
                                    maxDecimals={2}
                                    emptyValue={0}
                                    unitSuffix="hs"
                                    value={inlineLogEdit.value}
                                    onChange={(val) => setInlineLogEdit({ ...inlineLogEdit, value: val })}
                                    onCommit={(rawVal) => saveInlineLogEdit(l.id, 'hours_normal', rawVal)}
                                    onCancel={() => setInlineLogEdit({ id: null, field: null, value: '' })}
                                    className="w-16 bg-slate-950 border border-cyan-400 rounded px-1 py-0.2 text-center text-xs text-white focus:outline-none"
                                  />
                                ) : (
                                  <span>
                                    {l.hours_normal ?? l.hours_worked ?? 0}
                                    {item.logs.length === 1 && item.targetHours && <span className="text-slate-500 text-[10px]">/{item.targetHours}h</span>}
                                  </span>
                                )}
                              </div>
                              )
                            })}
                          </div>
                        )}
                      </td>

                      {/* 50% */}
                      <td className="py-2.5 px-2 text-center font-mono text-cyan-400 align-top">
                        {item.logs.length === 0 ? (
                          <span className="text-slate-600">-</span>
                        ) : (
                          <div className="space-y-2 py-0.5">
                            {item.logs.map(l => {
                              const f50 = getStoredCellFormula(l, 'hours_extra_50')
                              return (
                              <div
                                key={l.id}
                                onDoubleClick={() => activateHorasCell(l, 'hours_extra_50')}
                                className="relative h-6 flex items-center justify-center cursor-pointer hover:bg-slate-800/80 rounded px-1"
                                title={describeFormula(f50)?.tooltipText || 'Doble clic para editar Horas 50% (acepta =1+1.5)'}
                              >
                                <FormulaCellCornerMark formula={f50} />
                                {inlineLogEdit.id === l.id && inlineLogEdit.field === 'hours_extra_50' ? (
                                  <FormulaNumericInput
                                    variant="cell"
                                    autoFocus
                                    maxDecimals={2}
                                    emptyValue={0}
                                    unitSuffix="hs"
                                    value={inlineLogEdit.value}
                                    onChange={(val) => setInlineLogEdit({ ...inlineLogEdit, value: val })}
                                    onCommit={(rawVal) => saveInlineLogEdit(l.id, 'hours_extra_50', rawVal)}
                                    onCancel={() => setInlineLogEdit({ id: null, field: null, value: '' })}
                                    className="w-16 bg-slate-950 border border-cyan-400 rounded px-1 py-0.2 text-center text-xs text-white focus:outline-none"
                                  />
                                ) : (
                                  <span>{l.hours_extra_50 || '-'}</span>
                                )}
                              </div>
                              )
                            })}
                          </div>
                        )}
                      </td>

                      {/* 100% */}
                      <td className="py-2.5 px-2 text-center font-mono text-amber-400 align-top">
                        {item.logs.length === 0 ? (
                          <span className="text-slate-600">-</span>
                        ) : (
                          <div className="space-y-2 py-0.5">
                            {item.logs.map(l => {
                              const f100 = getStoredCellFormula(l, 'hours_extra_100')
                              return (
                              <div
                                key={l.id}
                                onDoubleClick={() => activateHorasCell(l, 'hours_extra_100')}
                                className="relative h-6 flex items-center justify-center cursor-pointer hover:bg-slate-800/80 rounded px-1"
                                title={describeFormula(f100)?.tooltipText || 'Doble clic para editar Horas 100% (acepta =2+2)'}
                              >
                                <FormulaCellCornerMark formula={f100} />
                                {inlineLogEdit.id === l.id && inlineLogEdit.field === 'hours_extra_100' ? (
                                  <FormulaNumericInput
                                    variant="cell"
                                    autoFocus
                                    maxDecimals={2}
                                    emptyValue={0}
                                    unitSuffix="hs"
                                    value={inlineLogEdit.value}
                                    onChange={(val) => setInlineLogEdit({ ...inlineLogEdit, value: val })}
                                    onCommit={(rawVal) => saveInlineLogEdit(l.id, 'hours_extra_100', rawVal)}
                                    onCancel={() => setInlineLogEdit({ id: null, field: null, value: '' })}
                                    className="w-16 bg-slate-950 border border-cyan-400 rounded px-1 py-0.2 text-center text-xs text-white focus:outline-none"
                                  />
                                ) : (
                                  <span>{l.hours_extra_100 || '-'}</span>
                                )}
                              </div>
                              )
                            })}
                          </div>
                        )}
                      </td>

                      {/* Total Día */}
                      <td className="py-2.5 px-3 text-center font-mono font-bold text-primary align-top">
                        {item.totalDay > 0 ? `${item.totalDay} hs` : <span className="text-slate-600">0 hs</span>}
                      </td>

                      {/* Acciones */}
                      <td className="py-2.5 px-3 text-right align-top">
                        {isSinCarga ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => openQuickLogModal({
                                name: item.worker.name,
                                rubro: item.defaultRubro,
                                type: item.type,
                                hours_normal: isAstillero ? 9 : 0,
                                date: auditDate
                              })}
                              className="px-2.5 py-1 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-300 border border-cyan-500/40 rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="Cargar jornada habitual (9h)"
                            >
                              <Plus className="w-3 h-3" />
                              <span>+ Cargar {isAstillero ? '9h' : 'Horas'}</span>
                            </button>

                            {isAstillero && (
                              <button
                                type="button"
                                onClick={() => openQuickLogModal({
                                  name: item.worker.name,
                                  rubro: 'Feriado',
                                  type: 'Astillero',
                                  hours_normal: 8,
                                  notes: 'Jornada de Feriado',
                                  date: auditDate
                                })}
                                className="px-2 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                title="Cargar como Feriado (8h)"
                              >
                                <span>Feriado 8h</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2 py-0.5">
                            {item.logs.map((log, idx) => (
                              <div key={log.id} className="h-6 flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleEditFromDaily(log)}
                                  className="p-1 text-slate-400 hover:text-primary rounded hover:bg-slate-800 transition-colors cursor-pointer"
                                  title={`Editar imputación en ${log.work_orders?.ships?.name}`}
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>

                                {idx === item.logs.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={() => openQuickLogModal({
                                      name: item.worker.name,
                                      rubro: item.defaultRubro,
                                      type: item.type,
                                      hours_normal: isIncompleta ? (item.targetHours - item.totalDay) : 0,
                                      date: auditDate
                                    })}
                                    className="p-1 text-slate-400 hover:text-cyan-300 rounded hover:bg-slate-800 transition-colors cursor-pointer"
                                    title="Sumar más horas u otra OT"
                                  >
                                    <Plus className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                {item.logs.length === 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteLog(item.logs[0].id, item.worker.name)}
                                    className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                                    title="Eliminar registro"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
