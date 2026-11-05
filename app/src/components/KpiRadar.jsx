import React from 'react'
import { Sparkles, BarChart2 } from 'lucide-react'

/**
 * Paleta Canónica AlonCar ERP para Tarjetas de KPI (Estándar 02)
 */
const KPI_COLOR_THEMES = {
  amber: {
    border: 'border-amber-500/50 hover:border-amber-400',
    activeBg: 'bg-amber-950/80 border-amber-400 text-amber-200 ring-2 ring-amber-400/40',
    inactiveBg: 'bg-slate-950/60 text-slate-300',
    countColor: 'text-amber-400',
    barColor: 'bg-amber-500'
  },
  blue: {
    border: 'border-blue-500/50 hover:border-blue-400',
    activeBg: 'bg-blue-950/80 border-blue-400 text-blue-200 ring-2 ring-blue-400/40',
    inactiveBg: 'bg-slate-950/60 text-slate-300',
    countColor: 'text-blue-400',
    barColor: 'bg-blue-500'
  },
  purple: {
    border: 'border-purple-500/50 hover:border-purple-400',
    activeBg: 'bg-purple-950/80 border-purple-400 text-purple-200 ring-2 ring-purple-400/40',
    inactiveBg: 'bg-slate-950/60 text-slate-300',
    countColor: 'text-purple-400',
    barColor: 'bg-purple-500'
  },
  cyan: {
    border: 'border-cyan-500/50 hover:border-cyan-400',
    activeBg: 'bg-cyan-950/80 border-cyan-400 text-cyan-200 ring-2 ring-cyan-400/40',
    inactiveBg: 'bg-slate-950/60 text-slate-300',
    countColor: 'text-cyan-400',
    barColor: 'bg-cyan-500'
  },
  pink: {
    border: 'border-pink-500/50 hover:border-pink-400',
    activeBg: 'bg-pink-950/80 border-pink-400 text-pink-200 ring-2 ring-pink-400/40',
    inactiveBg: 'bg-slate-950/60 text-slate-300',
    countColor: 'text-pink-400',
    barColor: 'bg-pink-500'
  },
  fuchsia: {
    border: 'border-fuchsia-500/50 hover:border-fuchsia-400',
    activeBg: 'bg-fuchsia-950/80 border-fuchsia-400 text-fuchsia-200 ring-2 ring-fuchsia-400/40',
    inactiveBg: 'bg-slate-950/60 text-slate-300',
    countColor: 'text-fuchsia-400',
    barColor: 'bg-fuchsia-500'
  },
  emerald: {
    border: 'border-emerald-500/50 hover:border-emerald-400',
    activeBg: 'bg-emerald-950/80 border-emerald-400 text-emerald-200 ring-2 ring-emerald-400/40',
    inactiveBg: 'bg-slate-950/60 text-slate-300',
    countColor: 'text-emerald-400',
    barColor: 'bg-emerald-500'
  },
  rose: {
    border: 'border-rose-500/50 hover:border-rose-400',
    activeBg: 'bg-rose-950/80 border-rose-400 text-rose-200 ring-2 ring-rose-400/40',
    inactiveBg: 'bg-slate-950/60 text-slate-300',
    countColor: 'text-rose-400',
    barColor: 'bg-rose-500'
  }
}

/**
 * KpiRadar
 * 
 * Componente Canónico de KPIs y Alertas Operativas (Zona 2) para AlonCar ERP.
 * Permite filtrar en 1 clic y mantener sincronizada la estética cromática estándar.
 */
export default function KpiRadar({
  title = 'RADAR DE KPIS Y ALERTAS OPERATIVAS',
  subtitle = 'Clic en cualquier tarjeta para filtrar',
  cards = [], // Array de { id, label, count, colorTheme ('amber'|'blue'|...), subtext, onClick, isActive }
  activeFilterId = null,
  onCardClick = null,
  className = ''
}) {
  if (!cards || cards.length === 0) return null

  return (
    <div className={`alon-zone-kpi p-3 md:p-3.5 rounded-2xl bg-slate-900/60 border border-slate-800/80 mb-3 shadow-sm ${className}`}>
      {/* Título de la Zona */}
      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-2">
          <span className="text-amber-400">📊</span>
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
            {title}
          </span>
          {subtitle && (
            <span className="text-[10px] text-slate-500 hidden sm:inline">
              • {subtitle}
            </span>
          )}
        </div>
      </div>

      {/* Grid de Tarjetas de KPI */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
        {cards.map((card) => {
          const theme = KPI_COLOR_THEMES[card.colorTheme || 'blue'] || KPI_COLOR_THEMES.blue
          const isSelected = card.isActive !== undefined ? card.isActive : (activeFilterId === card.id)

          const handleClick = () => {
            if (card.onClick) {
              card.onClick(card.id)
            } else if (onCardClick) {
              onCardClick(card.id)
            }
          }

          return (
            <div
              key={card.id}
              onClick={handleClick}
              className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between select-none relative overflow-hidden group hover:scale-[1.02] ${
                isSelected
                  ? theme.activeBg
                  : `${theme.inactiveBg} ${theme.border}`
              }`}
              title={card.title || `Filtrar por ${card.label}`}
            >
              {/* Barra lateral de color */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${theme.barColor}`} />

              <div className="pl-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block truncate group-hover:text-slate-200">
                  {card.label}
                </span>
                <span className={`text-lg font-black font-mono leading-tight block mt-0.5 ${theme.countColor}`}>
                  {card.count ?? 0}
                </span>
              </div>

              {card.subtext && (
                <span className="pl-1 text-[9px] text-slate-500 truncate mt-1 block">
                  {card.subtext}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
