import {
  BarChart3,
  PhoneOff,
  DollarSign,
  Building2,
  ShieldAlert,
  Lock,
  Calendar,
  Shield
} from 'lucide-react'
import { getCategoryBadgeStyle } from '../../lib/personalNominaHelpers'

export default function PersonalNominaKpiRadar({
  kpiStats,
  kpiFilter,
  setKpiFilter,
  dollarRate,
  rateOficial,
  rateMedioOficial,
  rateAyudante
}) {
  const alertCards = [
    {
      key: 'sin_telefono_astillero',
      label: 'Astillero sin Teléfono',
      value: kpiStats.sinTelefonoAstillero,
      unit: 'personal propio',
      desc: 'Sin número móvil cargado',
      Icon: PhoneOff,
      activeCls: 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-400 shadow-lg shadow-rose-950/50',
      idleCls: 'bg-rose-950/25 border-rose-500/50 hover:bg-rose-950/40 hover:border-rose-400',
      labelCls: 'text-rose-300',
      iconCls: 'text-rose-400',
      valueCls: 'text-rose-400',
      unitCls: 'text-rose-300/70',
      descCls: 'text-rose-300/60'
    },
    {
      key: 'sin_costo_astillero',
      label: 'Astillero sin Costo',
      value: kpiStats.sinCostoAstillero,
      unit: 'personal propio',
      desc: 'Sin tarifa AR$/h asignada',
      Icon: DollarSign,
      activeCls: 'bg-amber-950/60 border-amber-500 ring-2 ring-amber-400 shadow-lg shadow-amber-950/50',
      idleCls: 'bg-amber-950/25 border-amber-500/50 hover:bg-amber-950/40 hover:border-amber-400',
      labelCls: 'text-amber-300',
      iconCls: 'text-amber-400',
      valueCls: 'text-amber-400',
      unitCls: 'text-amber-300/70',
      descCls: 'text-amber-300/60'
    },
    {
      key: 'sin_costo_contratistas',
      label: 'Contratistas sin Costo',
      value: kpiStats.sinCostoContratistas,
      unit: 'cuadrillas',
      desc: 'Sin valor AR$/h pactado',
      Icon: Building2,
      activeCls: 'bg-cyan-950/60 border-cyan-500 ring-2 ring-cyan-400 shadow-lg shadow-cyan-950/50',
      idleCls: 'bg-cyan-950/25 border-cyan-500/50 hover:bg-cyan-950/40 hover:border-cyan-400',
      labelCls: 'text-cyan-300',
      iconCls: 'text-cyan-400',
      valueCls: 'text-cyan-400',
      unitCls: 'text-cyan-300/70',
      descCls: 'text-cyan-300/60'
    },
    {
      key: 'sin_consumibles_contratistas',
      label: 'Sin Consumibles',
      value: kpiStats.sinConsumiblesContratistas,
      unit: 'contratistas',
      desc: 'Sin % ni imputación',
      Icon: ShieldAlert,
      activeCls: 'bg-fuchsia-950/60 border-fuchsia-500 ring-2 ring-fuchsia-400 shadow-lg shadow-fuchsia-950/50',
      idleCls: 'bg-fuchsia-950/25 border-fuchsia-500/50 hover:bg-fuchsia-950/40 hover:border-fuchsia-400',
      labelCls: 'text-fuchsia-300',
      iconCls: 'text-fuchsia-400',
      valueCls: 'text-fuchsia-400',
      unitCls: 'text-fuchsia-300/70',
      descCls: 'text-fuchsia-300/60'
    },
    {
      key: 'sin_permisos',
      label: 'Sin Permisos',
      value: kpiStats.sinPermisos,
      unit: 'personal activo',
      desc: 'Sin Pañol, Horas ni 3ros',
      Icon: Lock,
      activeCls: 'bg-red-950/60 border-red-600 ring-2 ring-red-400 shadow-lg shadow-red-950/50',
      idleCls: 'bg-red-950/25 border-red-600/50 hover:bg-red-950/40 hover:border-red-500',
      labelCls: 'text-red-300',
      iconCls: 'text-red-400',
      valueCls: 'text-red-400',
      unitCls: 'text-red-300/70',
      descCls: 'text-red-300/60'
    },
    {
      key: 'contratos_por_vencer',
      label: 'Contratos p/ Vencer',
      value: kpiStats.contratosPorVencer,
      unit: 'aviso ≤ 7d',
      desc: 'Notifica a María José',
      title: 'Filtra personal propio de Astillero con contrato temporal próximo a vencer (≤ 7 días) o ya vencido.',
      Icon: Calendar,
      activeCls: 'bg-orange-950/70 border-orange-400 ring-2 ring-orange-400 shadow-lg shadow-orange-950/50',
      idleCls: 'bg-orange-950/25 border-orange-500/50 hover:bg-orange-950/40 hover:border-orange-400',
      labelCls: 'text-orange-300',
      iconCls: 'text-orange-400',
      valueCls: 'text-orange-400',
      unitCls: 'text-orange-300/70',
      descCls: 'text-orange-300/60'
    }
  ]

  const unionRates = [
    {
      key: 'categoria_OFICIAL',
      cat: 'OFICIAL',
      label: 'OFICIAL (Sindicato)',
      rate: rateOficial,
      activeCls: 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-400 shadow-lg',
      idleCls: 'bg-slate-950 border-emerald-900/40 hover:border-emerald-700/70 hover:bg-emerald-950/20',
      labelCls: 'text-emerald-400'
    },
    {
      key: 'categoria_1/2 OFICIAL',
      cat: '1/2 OFICIAL',
      label: '1/2 OFICIAL (Sindicato)',
      rate: rateMedioOficial,
      activeCls: 'bg-pink-950/60 border-pink-500 ring-2 ring-pink-400 shadow-lg',
      idleCls: 'bg-slate-950 border-pink-900/40 hover:border-pink-700/70 hover:bg-pink-950/20',
      labelCls: 'text-pink-400'
    },
    {
      key: 'categoria_AYUDANTE',
      cat: 'AYUDANTE',
      label: 'AYUDANTE (Sindicato)',
      rate: rateAyudante,
      activeCls: 'bg-cyan-950/60 border-cyan-500 ring-2 ring-cyan-400 shadow-lg',
      idleCls: 'bg-slate-950 border-cyan-900/40 hover:border-cyan-700/70 hover:bg-cyan-950/20',
      labelCls: 'text-cyan-400'
    }
  ]

  return (
    <>
      <div className="alon-zone-kpis rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
          <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>Radar de Alertas Operativas del Padrón • Clic en cualquier tarjeta para filtrar</span>
          </span>
          {kpiFilter && !kpiFilter.startsWith('categoria_') && (
            <button
              type="button"
              onClick={() => setKpiFilter(null)}
              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
            >
              ✕ Quitar filtro activo
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {alertCards.map(({ key, label, value, unit, desc, title, Icon, activeCls, idleCls, labelCls, iconCls, valueCls, unitCls, descCls }) => (
            <button
              key={key}
              type="button"
              title={title}
              onClick={() => setKpiFilter((prev) => (prev === key ? null : key))}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${kpiFilter === key ? activeCls : idleCls}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-bold uppercase tracking-wider ${labelCls}`}>{label}</span>
                <Icon className={`w-4 h-4 ${iconCls}`} />
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-2xl font-black font-mono ${valueCls}`}>{value}</span>
                <span className={`text-[10px] ${unitCls}`}>{unit}</span>
              </div>
              <p className={`text-[9px] mt-1 truncate ${descCls}`}>{desc}</p>
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl p-4 bg-slate-900/60 border border-slate-800/80 shadow-md space-y-2.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1.5 text-slate-300">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Tarifario Sindical de Referencia • Clic en una categoría para filtrar</span>
          </span>
          {kpiFilter?.startsWith('categoria_') && (
            <button
              type="button"
              onClick={() => setKpiFilter(null)}
              className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
            >
              ✕ Mostrar todas las categorías
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">VALOR US$ QUINCENAL</span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800 flex items-center gap-1" title="Dato congelado fijado por Administración Central">
                  <Lock className="w-2.5 h-2.5 text-amber-400" />
                  <span>Fijado</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-sm font-bold text-emerald-400 font-mono">$</span>
                <span className="font-mono text-base font-extrabold text-white">{parseFloat(dollarRate).toLocaleString('es-AR')}</span>
                <span className="text-[10px] text-slate-500 font-sans ml-1">ARS / USD</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          {unionRates.map(({ key, cat, label, rate, activeCls, idleCls, labelCls }) => (
            <button
              key={key}
              type="button"
              onClick={() => setKpiFilter((prev) => (prev === key ? null : key))}
              className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${kpiFilter === key ? activeCls : idleCls}`}
            >
              <div>
                <span className={`text-[10px] uppercase font-bold block tracking-wider ${labelCls}`}>{label}</span>
                <div className="flex items-center gap-1.5 mt-1 font-mono font-extrabold text-white text-base">
                  <span>${rate.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                </div>
              </div>
              <span className={`text-[10px] px-2 py-0.5 rounded border ${getCategoryBadgeStyle(cat)}`}>
                {(rate / dollarRate).toFixed(2)} USD
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
