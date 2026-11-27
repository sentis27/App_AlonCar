import { Scale, RefreshCw, ArrowRight, Users, Ship, Calendar } from 'lucide-react'
import CanonicalActiveSubmoduleBadge from '../canonical/CanonicalActiveSubmoduleBadge.jsx'
import { getFilterSelectClass } from '../../lib/filterThemeConstants.js'

const KPI_CARDS = [
  { key: 'NO', field: 'pendingLines', label: 'Líneas Material sin Horas', border: 'border-rose-500/60 bg-rose-950/35 text-rose-300', ring: 'ring-rose-400', title: 'Ver líneas de material sin horas registradas en la quincena' },
  { key: 'SHIP_ERROR', field: 'possibleShipErrorLines', label: 'Posible Error de Barco', border: 'border-amber-500/60 bg-amber-950/35 text-amber-300', ring: 'ring-amber-400', title: 'Ver líneas cuya OT coincide en otro barco trabajado por el contratista' },
  { key: 'PREV_QUINCENA', field: 'prevQuincenaMatchLines', label: 'Coincide Quincena Anterior', border: 'border-indigo-500/60 bg-indigo-950/35 text-indigo-300', ring: 'ring-indigo-400', title: 'Ver líneas con horas registradas en la quincena inmediata anterior' },
  { key: 'OK', field: 'okLines', label: 'Conciliadas OK', border: 'border-emerald-500/60 bg-emerald-950/35 text-emerald-300', ring: 'ring-emerald-400', title: 'Ver líneas de material respaldadas por horas en la quincena' },
  { key: 'VALIDATED_EXCEPTION', field: 'validatedExceptions', label: 'Excepciones Validadas', border: 'border-sky-500/60 bg-sky-950/35 text-sky-300', ring: 'ring-sky-400', title: 'Ver líneas autorizadas manualmente como excepción justificada' },
]

export default function CostControlHeaderAndRadar({
  activeTab,
  activeSubmodule,
  periodKey,
  quincenaOptions = [],
  onPeriodChange,
  contractorFilter,
  contractorOptions = [],
  onContractorChange,
  shipFilter,
  shipOptions = [],
  onShipChange,
  statusFilter,
  onStatusFilterChange,
  snapshot,
  loading = false,
  onReload,
  onStepNextContractor,
}) {
  const kpis = snapshot?.kpis || {
    pendingLines: 0, possibleShipErrorLines: 0, prevQuincenaMatchLines: 0, okLines: 0, validatedExceptions: 0,
  }
  const queue = snapshot?.contractorQueue || []

  return (
    <div className="space-y-3">
      {/* ZONA 1: Contexto Operativo + 3 Selectores Obligatorios (Quincena, Contratista, Barco) */}
      <div className="alon-zone-context">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shrink-0">
              <Scale className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-lg font-black text-white">Control de Gastos</h1>
                <CanonicalActiveSubmoduleBadge
                  label={activeSubmodule?.label || '1. Conciliación Horas vs Mat.'}
                  theme={activeSubmodule?.theme || 'cyan'}
                />
                <span
                  className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 border border-slate-700 text-slate-300"
                  title="Acceso restringido al Administrador por defecto; habilitable por puesto en Panel Administrador"
                >
                  Solo Admin · Configurable en Permisos
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 truncate">
                Auditoría quincenal línea por línea de Pañol vs Horas trabajadas · Detección de error de Barco y salto de quincena
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onReload}
            disabled={loading}
            className="px-3.5 py-2 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black inline-flex items-center gap-1.5 cursor-pointer self-start lg:self-auto shrink-0"
            title="Recargar movimientos y horas de la quincena"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Actualizar</span>
          </button>
        </div>

        <div className="mt-3 pt-3 border-t border-sky-500/20 flex flex-wrap items-center gap-2.5">
          <label className="inline-flex items-center gap-1.5 text-xs text-slate-300">
            <Calendar className="w-3.5 h-3.5 text-indigo-300 shrink-0" />
            <span className="font-bold text-[11px] uppercase tracking-wider text-slate-400">Quincena:</span>
            <select
              aria-label="Seleccionar quincena"
              value={periodKey}
              onChange={(e) => onPeriodChange(e.target.value)}
              className={getFilterSelectClass('period', true, 'bg-slate-950')}
            >
              {quincenaOptions.map((opt) => (
                <option key={opt.key} value={opt.key} className="bg-slate-950 text-slate-100">
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex items-center gap-1.5 text-xs text-slate-300">
            <Users className="w-3.5 h-3.5 text-amber-300 shrink-0" />
            <span className="font-bold text-[11px] uppercase tracking-wider text-slate-400">Contratista:</span>
            <select
              aria-label="Filtrar por contratista"
              value={contractorFilter}
              onChange={(e) => onContractorChange(e.target.value)}
              className={getFilterSelectClass('contractor', Boolean(contractorFilter), 'bg-slate-950 max-w-[240px]')}
            >
              <option value="" className="bg-slate-950 text-slate-100">Todos los Contratistas</option>
              {contractorOptions.map((name) => (
                <option key={name} value={name} className="bg-slate-950 text-slate-100">
                  {name}
                </option>
              ))}
            </select>
          </label>

          <label className="inline-flex items-center gap-1.5 text-xs text-slate-300">
            <Ship className="w-3.5 h-3.5 text-cyan-300 shrink-0" />
            <span className="font-bold text-[11px] uppercase tracking-wider text-slate-400">Barco:</span>
            <select
              aria-label="Filtrar por barco"
              value={shipFilter}
              onChange={(e) => onShipChange(e.target.value)}
              className={getFilterSelectClass('ship', Boolean(shipFilter), 'bg-slate-950 max-w-[240px]')}
            >
              <option value="" className="bg-slate-950 text-slate-100">Todos los Barcos</option>
              {shipOptions.map((s) => (
                <option key={s.id} value={s.id} className="bg-slate-950 text-slate-100">
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* ZONA 2: Radar de KPIs + Cola 1-Clic de Contratistas con pendientes */}
      {activeTab === 'conciliacion' && (
        <div className="alon-zone-kpis space-y-3">
          <div className="text-[10px] font-black uppercase tracking-wider text-amber-300/90">
            📊 RADAR DE KPIS Y ALERTAS OPERATIVAS • Clic en cualquier tarjeta para enfocar
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
            {KPI_CARDS.map((card) => {
              const active = statusFilter === card.key
              const nextVal = active ? 'ALL' : card.key
              return (
                <button
                  key={card.key}
                  type="button"
                  onClick={() => onStatusFilterChange(nextVal)}
                  title={card.title}
                  className={`rounded-xl border px-3 py-2 text-left transition-all cursor-pointer ${card.border} ${
                    active ? `ring-2 ${card.ring} shadow-lg` : 'opacity-90 hover:opacity-100'
                  }`}
                >
                  <div className="text-2xl font-black font-mono leading-tight">{kpis[card.field] ?? 0}</div>
                  <div className="text-[11px] font-bold text-slate-200 mt-0.5 leading-snug">{card.label}</div>
                </button>
              )
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-amber-500/20">
            <span className="text-[11px] font-bold text-slate-400 mr-1">Pendientes:</span>
            <button
              type="button"
              onClick={() => onContractorChange('')}
              className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                !contractorFilter
                  ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow'
                  : 'bg-slate-950 text-slate-300 border-slate-700 hover:border-cyan-500/60'
              }`}
              title="Mostrar todos los contratistas con líneas pendientes"
            >
              Todos ({kpis.pendingLines ?? 0})
            </button>
            {queue.map((q) => {
              const active = contractorFilter === q.entity
              return (
                <button
                  key={q.entity}
                  type="button"
                  onClick={() => onContractorChange(active ? '' : q.entity)}
                  title={`${q.pendingCount} línea(s) sin horas · ${q.possibleShipErrors} posible error de barco · ${q.prevQuincenaMatches} en quincena anterior`}
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold border transition-all cursor-pointer ${
                    active
                      ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow'
                      : 'bg-slate-950 text-slate-200 border-slate-700 hover:border-cyan-400/70'
                  }`}
                >
                  {q.entity} ({q.pendingCount})
                </button>
              )
            })}
            {queue.length > 0 && (
              <button
                type="button"
                onClick={onStepNextContractor}
                className="ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 cursor-pointer"
                title="Pasar al siguiente contratista con pendientes"
              >
                <span>Siguiente</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
