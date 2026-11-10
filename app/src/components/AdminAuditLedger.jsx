import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  History,
  Search,
  RefreshCw,
  Download,
  Filter,
  User,
  Clock,
  FileSpreadsheet,
  ArrowRight,
  Activity,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  Layers,
  Database,
  Copy,
  X
} from 'lucide-react'
import {
  auditService,
  AUDIT_ENTITY_CATALOG,
  AUDIT_ACTION_LABELS
} from '../lib/auditService'
import { exportToSpreadsheet } from '../lib/exportEngine'
import HighlightText from './HighlightText'
import { matchesUniversalSearch } from '../lib/searchEngine'

export default function AdminAuditLedger() {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Filtros multidimensionales
  const [entityFilter, setEntityFilter] = useState('ALL')
  const [actionFilter, setActionFilter] = useState('ALL')
  const [userFilter, setUserFilter] = useState('ALL')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedLogDetail, setSelectedLogDetail] = useState(null)

  const loadAuditLedger = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const data = await auditService.getGlobalAuditLedger({
        entityType: entityFilter,
        actionFilter,
        userFilter,
        dateFrom,
        dateTo,
        limit: 400
      })
      setLogs(data || [])
    } catch (err) {
      console.error('Error cargando Libro de Auditoría:', err)
      setError(err.message || 'No se pudo cargar el libro de auditoría.')
    } finally {
      setLoading(false)
    }
  }, [entityFilter, actionFilter, userFilter, dateFrom, dateTo])

  useEffect(() => {
    loadAuditLedger()
  }, [loadAuditLedger])

  // Usuarios únicos presentes en los logs
  const uniqueUsers = useMemo(() => {
    const set = new Set()
    logs.forEach((l) => {
      if (l.performed_by) set.add(l.performed_by)
    })
    return Array.from(set).sort()
  }, [logs])

  // Filtrado instantáneo por buscador de texto omnicanal (Estándar 03)
  const filteredLogs = useMemo(() => {
    if (!searchQuery.trim()) return logs
    return logs.filter((log) => {
      const entityLabel = AUDIT_ENTITY_CATALOG[log.entity_type]?.label || log.entity_type || ''
      const detailsStr = log.details ? JSON.stringify(log.details) : ''
      return matchesUniversalSearch(
        log,
        searchQuery,
        {
          entityLabel,
          detailsStr,
          performed_by: log.performed_by,
          action: log.action,
          entity_name: log.entity_name
        }
      )
    })
  }, [logs, searchQuery])

  // Métricas analíticas en vivo
  const metrics = useMemo(() => {
    return auditService.computeAuditMetrics(filteredLogs)
  }, [filteredLogs])

  // Exportación a CSV / Excel
  const handleExportAuditCsv = () => {
    if (filteredLogs.length === 0) return
    const columns = [
      { key: 'fecha', label: 'Fecha y Hora' },
      { key: 'usuario', label: 'Usuario' },
      { key: 'planilla', label: 'Planilla / Submódulo' },
      { key: 'accion', label: 'Acción' },
      { key: 'registro', label: 'Registro Afectado' },
      { key: 'campo', label: 'Campo Modificado' },
      { key: 'valor_anterior', label: 'Valor Anterior' },
      { key: 'valor_nuevo', label: 'Valor Nuevo' },
      { key: 'id_entidad', label: 'ID Registro' }
    ]

    const rows = filteredLogs.map((l) => {
      const d = typeof l.details === 'object' && l.details !== null ? l.details : {}
      const sheetName = d.sheet_name || AUDIT_ENTITY_CATALOG[l.entity_type]?.label || l.entity_type
      return {
        fecha: l.created_at ? new Date(l.created_at).toLocaleString('es-AR') : '',
        usuario: l.performed_by || 'Sistema',
        planilla: sheetName,
        accion: AUDIT_ACTION_LABELS[l.action]?.label || l.action,
        registro: l.entity_name || l.entity_id || '',
        campo: d.field_label || d.field || 'Registro Completo',
        valor_anterior: d.old_value !== undefined && d.old_value !== null ? String(d.old_value) : '',
        valor_nuevo: d.new_value !== undefined && d.new_value !== null ? String(d.new_value) : '',
        id_entidad: l.entity_id || ''
      }
    })

    exportToSpreadsheet({
      filename: `libro_auditoria_aloncar_${new Date().toISOString().slice(0, 10)}.csv`,
      rows,
      columns
    })
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* CABECERA DOCUMENTAL E INDEXADA (ESTÁNDAR GALLINA A.1) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <History className="w-5 h-5 text-cyan-400" />
              <h2 className="text-sm uppercase tracking-wider font-extrabold text-white">
                Libro de Auditoría & Trazabilidad Global de Planillas
              </h2>
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-cyan-950/90 text-cyan-300 border border-cyan-500/40">
                ARQUETIPO: METRICAS_ANALISIS (Gallina · ID #A.1)
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-emerald-300 border border-emerald-700/50 flex items-center gap-1">
                <Database className="w-3 h-3" />
                <span>DB: public.audit_logs</span>
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Hoja general unificada vinculada a los <strong className="text-slate-200">22 submódulos de carga (`CARGA_EDICION`)</strong>. Permite auditar cada cambio por planilla y usuario, medir el volumen de trabajo y detectar correcciones frecuentes.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadAuditLedger}
              disabled={loading}
              className="px-3 py-2 bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${loading ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
            <button
              type="button"
              onClick={handleExportAuditCsv}
              disabled={filteredLogs.length === 0}
              className="px-3.5 py-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-xl text-xs font-extrabold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
            >
              <Download className="w-3.5 h-3.5" />
              <span>📥 Exportar Bitácora CSV/Excel</span>
            </button>
          </div>
        </div>

        {/* ZONA DE KPIS DE USO Y TRAZABILIDAD */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-500/40 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-cyan-300 uppercase">
              <span>Eventos Registrados</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-extrabold text-white font-mono">
              {metrics.totalEvents}
            </div>
            <p className="text-[11px] text-slate-400">
              <strong className="text-cyan-300 font-mono">{metrics.todayCount}</strong> cambios registrados hoy
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-950/30 border border-emerald-500/40 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-emerald-300 uppercase">
              <span>Planilla con Mayor Uso</span>
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-sm font-extrabold text-white truncate">
              {metrics.topSheets[0]?.label || 'Sin actividad'}
            </div>
            <p className="text-[11px] text-slate-400">
              {metrics.topSheets[0]
                ? `${metrics.topSheets[0].count} operaciones (${metrics.topSheets[0].pct}% del total)`
                : `${metrics.activeSheetsCount} planillas activas`}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-purple-950/30 border border-purple-500/40 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-purple-300 uppercase">
              <span>Operador Más Activo</span>
              <User className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-sm font-extrabold text-white truncate font-mono">
              {metrics.topUsers[0]?.user || '—'}
            </div>
            <p className="text-[11px] text-slate-400">
              {metrics.topUsers[0]
                ? `${metrics.topUsers[0].count} cargas · ${metrics.uniqueUsersCount} usuario(s) en total`
                : 'Sin usuarios registrados'}
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-500/40 space-y-1">
            <div className="flex items-center justify-between text-[11px] font-bold text-amber-300 uppercase">
              <span>Índice de Re-Edición</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-amber-300 font-mono">
              {metrics.repeatedCorrectionsCount}
            </div>
            <p className="text-[11px] text-slate-400">
              Celdas corregidas más de 1 vez (control de errores)
            </p>
          </div>
        </div>

        {/* DISTRIBUCIÓN DE ACTIVIDAD POR PLANILLA (CLIC PARA FILTRAR) */}
        {metrics.topSheets.length > 0 && (
          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Métricas de Trabajo por Planilla (Clic para aislar planilla)
              </span>
              {entityFilter !== 'ALL' && (
                <button
                  type="button"
                  onClick={() => setEntityFilter('ALL')}
                  className="text-cyan-400 hover:underline font-mono text-[11px] cursor-pointer"
                >
                  ✕ Mostrar todas las planillas
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(AUDIT_ENTITY_CATALOG).map(([key, meta]) => {
                const count = logs.filter((l) => l.entity_type === key).length
                const isSelected = entityFilter === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setEntityFilter(isSelected ? 'ALL' : key)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition-all flex items-center gap-1.5 border cursor-pointer ${
                      isSelected
                        ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400 font-bold shadow-sm'
                        : count > 0
                        ? 'bg-slate-900 text-slate-200 border-slate-700 hover:border-slate-500'
                        : 'bg-slate-950/60 text-slate-500 border-slate-800/80 hover:text-slate-300'
                    }`}
                  >
                    <span>{meta.label}</span>
                    <span className={`px-1.5 py-0.2 rounded text-[10px] ${
                      count > 0 ? 'bg-cyan-950 text-cyan-300 font-bold' : 'bg-slate-900 text-slate-600'
                    }`}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* BARRA DE FILTROS MULTIDIMENSIONALES */}
        <div className="p-3 rounded-xl bg-slate-950/90 border border-slate-800 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5 text-xs">
          {/* Buscador Omnicanal */}
          <div className="relative lg:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              placeholder="Buscar por operario, OT, material, valor anterior/nuevo o usuario..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-2 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>

          {/* Selector de Planilla / Submódulo */}
          <div>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="ALL">📋 Todas las Planillas (22 submódulos)</option>
              {Object.entries(AUDIT_ENTITY_CATALOG).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Tipo de Operación */}
          <div>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="ALL">⚡ Todas las Operaciones</option>
              {Object.entries(AUDIT_ACTION_LABELS).map(([key, meta]) => (
                <option key={key} value={key}>
                  {meta.label}
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Usuario */}
          <div>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-400"
            >
              <option value="ALL">👤 Todos los Usuarios</option>
              {uniqueUsers.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* GRILLA CANÓNICA DEL LIBRO DE AUDITORÍA */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
          <div className="overflow-x-auto max-h-[600px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-900/95 text-slate-300 uppercase text-[10px] font-mono sticky top-0 z-10 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3">Fecha / Hora</th>
                  <th className="py-2.5 px-3">Planilla / Submódulo</th>
                  <th className="py-2.5 px-3">Usuario</th>
                  <th className="py-2.5 px-3">Acción</th>
                  <th className="py-2.5 px-3">Registro Afectado</th>
                  <th className="py-2.5 px-3">Detalle del Cambio (Anterior ➔ Nuevo)</th>
                  <th className="py-2.5 px-3 text-center">Ir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-mono">
                      Cargando bitácora de auditoría desde Supabase...
                    </td>
                  </tr>
                ) : error ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-rose-400 font-mono">
                      {error}
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-500">
                      No se encontraron registros de auditoría con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, idx) => {
                    const catalogMeta = AUDIT_ENTITY_CATALOG[log.entity_type] || {
                      label: log.entity_type,
                      route: '/'
                    }
                    const actionMeta = AUDIT_ACTION_LABELS[log.action] || {
                      label: log.action,
                      badge: 'bg-slate-800 text-slate-300 border-slate-700'
                    }
                    const d = typeof log.details === 'object' && log.details !== null ? log.details : {}
                    const sheetName = d.sheet_name || catalogMeta.label
                    const route = d.module_route || catalogMeta.route || '/'
                    const hasFieldDiff = d.field || d.old_value !== undefined || d.new_value !== undefined

                    const formattedDate = log.created_at
                      ? new Date(log.created_at).toLocaleString('es-AR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit'
                        })
                      : '—'

                    return (
                      <tr key={log.id || idx} className="hover:bg-slate-900/70 transition-colors">
                        <td className="py-2 px-2 w-10 text-center font-mono text-[11px] border-r border-slate-800/80 bg-slate-900/50">
                          <button
                            type="button"
                            onClick={() => setSelectedLogDetail(log)}
                            className="px-1.5 py-0.5 rounded text-cyan-400 hover:text-white hover:bg-cyan-950/80 font-bold cursor-pointer transition-colors"
                            title="Clic para inspeccionar payload JSON y ficha técnica del evento"
                          >
                            #{idx + 1}
                          </button>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          {formattedDate}
                        </td>
                        <td className="py-2 px-3">
                          <span className="font-semibold text-cyan-300 text-[11px]">
                            <HighlightText text={sheetName} query={searchQuery} />
                          </span>
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-200">
                          <HighlightText text={log.performed_by || 'Sistema'} query={searchQuery} />
                        </td>
                        <td className="py-2 px-3">
                          <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border inline-block ${actionMeta.badge}`}>
                            <HighlightText text={actionMeta.label} query={searchQuery} />
                          </span>
                        </td>
                        <td className="py-2 px-3 font-bold text-white max-w-[200px] truncate" title={log.entity_name || log.entity_id}>
                          <HighlightText text={log.entity_name || log.entity_id || '—'} query={searchQuery} />
                        </td>
                        <td className="py-2 px-3 font-mono text-[11px]">
                          {hasFieldDiff ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-cyan-300 border border-slate-700 text-[10px] font-bold">
                                <HighlightText text={d.field_label || d.field || 'Campo'} query={searchQuery} />
                              </span>
                              <span className="px-1.5 py-0.5 rounded bg-rose-950/60 text-rose-300 border border-rose-800/50 line-through max-w-[180px] truncate">
                                {d.old_value !== null && d.old_value !== undefined && String(d.old_value) !== '' ? (
                                  <HighlightText text={String(d.old_value)} query={searchQuery} />
                                ) : (
                                  '(vacío)'
                                )}
                              </span>
                              <ArrowRight className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-700/60 font-bold max-w-[220px] truncate">
                                {d.new_value !== null && d.new_value !== undefined && String(d.new_value) !== '' ? (
                                  <HighlightText text={String(d.new_value)} query={searchQuery} />
                                ) : (
                                  '(vacío)'
                                )}
                              </span>
                            </div>
                          ) : d.changes ? (
                            <span className="text-slate-300 text-[10px]">
                              {Object.keys(d.changes).slice(0, 5).join(', ')}
                              {Object.keys(d.changes).length > 5 ? '...' : ''}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px] truncate block max-w-xs">
                              {JSON.stringify(d)}
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Link
                            to={route}
                            title={`Abrir planilla ${sheetName}`}
                            className="inline-flex items-center justify-center p-1.5 rounded-lg bg-slate-900 hover:bg-cyan-950 text-slate-400 hover:text-cyan-300 border border-slate-800 hover:border-cyan-500/40 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* MODAL DE INSPECCIÓN TÉCNICA DEL EVENTO DE AUDITORÍA */}
        {selectedLogDetail && (
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-5 space-y-4 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${
                      AUDIT_ACTION_LABELS[selectedLogDetail.action]?.badge || 'bg-slate-800 text-slate-300'
                    }`}>
                      {AUDIT_ACTION_LABELS[selectedLogDetail.action]?.label || selectedLogDetail.action}
                    </span>
                    <h3 className="text-sm font-bold text-white font-mono">
                      {selectedLogDetail.entity_name || selectedLogDetail.entity_id}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-400 mt-1">
                    Planilla: <strong className="text-cyan-300">{AUDIT_ENTITY_CATALOG[selectedLogDetail.entity_type]?.label || selectedLogDetail.entity_type}</strong> • Por: <span className="text-white font-semibold">{selectedLogDetail.performed_by || 'Sistema'}</span> • {new Date(selectedLogDetail.created_at).toLocaleString('es-AR')}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedLogDetail(null)}
                  className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 overflow-y-auto flex-1 pr-1 text-xs">
                {selectedLogDetail.details?.field && (
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Cambio Atómico</span>
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 font-bold">
                        {selectedLogDetail.details.field_label || selectedLogDetail.details.field}
                      </span>
                      <span className="line-through text-rose-400">
                        {String(selectedLogDetail.details.old_value ?? '(vacío)')}
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      <span className="font-bold text-emerald-300">
                        {String(selectedLogDetail.details.new_value ?? '(vacío)')}
                      </span>
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Payload JSON Completo</span>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(selectedLogDetail, null, 2))
                      }}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                    >
                      <Copy className="w-3 h-3" />
                      <span>Copiar JSON</span>
                    </button>
                  </div>
                  <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] font-mono text-slate-300 overflow-x-auto max-h-60">
                    {JSON.stringify(selectedLogDetail, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                <Link
                  to={selectedLogDetail.details?.module_route || AUDIT_ENTITY_CATALOG[selectedLogDetail.entity_type]?.route || '/'}
                  className="text-xs text-cyan-400 hover:underline flex items-center gap-1"
                >
                  <span>Ir a la planilla correspondiente</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <button
                  type="button"
                  onClick={() => setSelectedLogDetail(null)}
                  className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
