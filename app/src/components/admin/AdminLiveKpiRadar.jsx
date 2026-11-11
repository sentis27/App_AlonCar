import {
  ShieldAlert,
  AlertCircle,
  Package,
  Clock
} from 'lucide-react'

export default function AdminLiveKpiRadar({ alertSummary, complianceAlertsCount, onSelectAlerts }) {
  return (
    <div className="alon-zone-kpis p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-wider text-amber-400">📊 RADAR DE KPIs Y ALERTAS EN VIVO</span>
          <span className="text-[10px] text-slate-400 font-mono hidden sm:inline">Indicadores en tiempo real de gobernanza y control</span>
        </div>
        {complianceAlertsCount > 0 && (
          <button
            type="button"
            onClick={onSelectAlerts}
            className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
            <span>{complianceAlertsCount} Solicitudes Pendientes</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Alerta 1: Contratistas en Zona Roja */}
        <button
          type="button"
          onClick={onSelectAlerts}
          className="p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between bg-slate-900/80 border-slate-800 hover:border-rose-500/40 hover:bg-slate-850"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-400" />
              Zona Roja (+5%)
            </span>
            {alertSummary.redContractorsCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-400/20 text-rose-300 font-bold border border-rose-400/30">
                Desvío
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-rose-300 font-mono">{alertSummary.redContractorsCount}</span>
            <span className="text-xs text-slate-400">contratistas con desvíos</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Diferencia salarial mayor a paritaria oficial
          </p>
        </button>

        {/* Alerta 2: Bandeja de Cumplimiento (Compliance Alerts) */}
        <button
          type="button"
          onClick={onSelectAlerts}
          className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
            complianceAlertsCount > 0
              ? 'bg-amber-950/80 border-amber-400 shadow-lg shadow-amber-500/20 ring-1 ring-amber-400'
              : 'bg-slate-900/80 border-slate-800 hover:border-amber-500/40 hover:bg-slate-850'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              Bandeja Cumplimiento
            </span>
            {complianceAlertsCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                {complianceAlertsCount} Pend.
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-amber-300 font-mono">{complianceAlertsCount}</span>
            <span className="text-xs text-slate-400">solicitudes OT / permisos</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            {complianceAlertsCount > 0 ? '⚠️ Requiere resolución de Jorge Sentis' : '✓ Al día sin solicitudes pendientes'}
          </p>
        </button>

        {/* Alerta 3: Pañol sin Horas */}
        <button
          type="button"
          onClick={onSelectAlerts}
          className="p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between bg-slate-900/80 border-slate-800 hover:border-purple-500/40 hover:bg-slate-850"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-purple-400" />
              Pañol sin Horas
            </span>
            {alertSummary.panolWithoutHoursCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-300 font-bold border border-purple-400/30">
                Auditar
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-purple-300 font-mono">{alertSummary.panolWithoutHoursCount}</span>
            <span className="text-xs text-slate-400">retiros de materiales</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Consumibles retirados sin horas en la quincena
          </p>
        </button>

        {/* Alerta 4: Horas en Auditoría */}
        <button
          type="button"
          onClick={onSelectAlerts}
          className="p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between bg-slate-900/80 border-slate-800 hover:border-cyan-500/40 hover:bg-slate-850"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
              <Clock className="w-4 h-4 text-cyan-400" />
              Horas en Auditoría
            </span>
            {alertSummary.auditedHoursCount > 0 && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-400/20 text-cyan-300 font-bold border border-cyan-400/30">
                R / RR / RRR
              </span>
            )}
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-black text-cyan-300 font-mono">{alertSummary.auditedHoursCount}</span>
            <span className="text-xs text-slate-400">partes observados</span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1">
            Marcas pendientes de dictamen técnico
          </p>
        </button>
      </div>
    </div>
  )
}
