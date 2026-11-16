import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Wrench, Package, ArrowUpRight, ShoppingCart } from 'lucide-react'
import ZeroCostAlertHoverCard from './ZeroCostAlertHoverCard'

/**
 * Alerta Pre-Facturación ($0) compartida para Dashboard (/) y Panel Admin (/admin):
 * - Muestra Terceros $0 y Materiales imputados a obra $0 (Pañol + Compras Directas, excl. EPP).
 * - Hover: despliega Contratista, OT, Nº Presupuesto, Buque y Observaciones.
 * - Clic: navega directo a Terceros / Pañol / Compras pre-filtrado por ítems $0.
 */
export default function ZeroCostDashboardAlertCard({ alerts, compact = false }) {
  const navigate = useNavigate()
  const [hoveredKind, setHoveredKind] = useState(null)

  const data = alerts || {
    thirdPartyCount: 0,
    materialsCount: 0,
    panolCount: 0,
    directPurchasesCount: 0,
    totalCount: 0,
    thirdPartyItems: [],
    materialItems: []
  }

  const hasPending = data.totalCount > 0

  const handleOpenMaterials = () => {
    if (data.panolCount === 0 && data.directPurchasesCount > 0) {
      navigate('/compras?mode=completa&kpi=sin_precio')
      return
    }
    navigate('/panol?tab=planillas&kpi=sin_precio&con_barco=1')
  }

  return (
    <div
      className={`rounded-2xl border transition-all ${compact ? 'p-3' : 'p-4'} ${
        hasPending
          ? 'bg-gradient-to-r from-amber-950/35 via-slate-900/90 to-rose-950/25 border-amber-500/45 shadow-lg shadow-amber-950/20'
          : 'bg-slate-900/70 border-emerald-500/35'
      }`}
    >
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`p-2 rounded-xl border shrink-0 ${
              hasPending
                ? 'bg-amber-500/15 border-amber-400/40 text-amber-300'
                : 'bg-emerald-500/15 border-emerald-400/40 text-emerald-300'
            }`}
          >
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xs sm:text-sm font-black uppercase tracking-wider text-white">
                Pendientes de Valorizar ($0 · Pre-Facturación de Obra)
              </h3>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                  hasPending
                    ? 'bg-amber-500/20 text-amber-200 border-amber-400/40'
                    : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40'
                }`}
              >
                {hasPending ? `${data.totalCount} a completar` : 'Al día'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Movimientos imputados a buques con costo $0 (excluye EPP y catálogo). Pasá el mouse para ver contratista, OT y detalle; clic abre planilla filtrada.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {/* Trigger 1: Terceros Sin Costo ($0) -> /terceros?kpi=sin_precio */}
          <div
            className="relative"
            onMouseEnter={() => setHoveredKind('TERCEROS')}
            onMouseLeave={() => setHoveredKind((p) => (p === 'TERCEROS' ? null : p))}
          >
            <button
              type="button"
              onClick={() => navigate('/terceros?kpi=sin_precio')}
              className={`px-3.5 py-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                data.thirdPartyCount > 0
                  ? 'bg-amber-950/60 hover:bg-amber-900/70 border-amber-400/60 text-amber-100 shadow-md shadow-amber-950/30'
                  : 'bg-slate-950/75 hover:bg-slate-800 border-slate-700 text-slate-300'
              }`}
            >
              <Wrench className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                  Terceros $0
                </div>
                <div className="text-base font-black text-white leading-tight font-mono">
                  {data.thirdPartyCount}
                  <span className="text-[10px] font-sans font-semibold text-slate-300 ml-1">ítems</span>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-amber-300 shrink-0" />
            </button>

            {hoveredKind === 'TERCEROS' && (
              <div className="absolute right-0 top-full pt-1.5 z-50 w-[min(540px,88vw)]">
                <ZeroCostAlertHoverCard
                  kind="TERCEROS"
                  items={data.thirdPartyItems}
                  showShip
                  title="Terceros Pendientes de Valorizar ($0)"
                />
              </div>
            )}
          </div>

          {/* Trigger 2: Materiales Imputados a Obra ($0) -> Pañol / Compras Directas */}
          <div
            className="relative"
            onMouseEnter={() => setHoveredKind('MATERIALES')}
            onMouseLeave={() => setHoveredKind((p) => (p === 'MATERIALES' ? null : p))}
          >
            <div className="flex items-stretch gap-1.5">
              <button
                type="button"
                onClick={handleOpenMaterials}
                className={`px-3.5 py-2 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-3 ${
                  data.materialsCount > 0
                    ? 'bg-rose-950/60 hover:bg-rose-900/70 border-rose-400/60 text-rose-100 shadow-md shadow-rose-950/30'
                    : 'bg-slate-950/75 hover:bg-slate-800 border-slate-700 text-slate-300'
                }`}
              >
                <Package className="w-4 h-4 text-rose-400 shrink-0" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                    Materiales Obra $0
                  </div>
                  <div className="text-base font-black text-white leading-tight font-mono">
                    {data.materialsCount}
                    <span className="text-[10px] font-sans font-semibold text-slate-300 ml-1">
                      ({data.panolCount} Pañol · {data.directPurchasesCount} Comp.Dir)
                    </span>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-rose-300 shrink-0" />
              </button>

              {data.directPurchasesCount > 0 && data.panolCount > 0 && (
                <button
                  type="button"
                  onClick={() => navigate('/compras?mode=completa&kpi=sin_precio')}
                  title="Ir directo a Compras Directas sin precio ($0)"
                  className="px-2.5 py-2 rounded-xl border border-violet-500/50 bg-violet-950/60 hover:bg-violet-900/70 text-violet-200 text-[10px] font-bold flex flex-col items-center justify-center cursor-pointer"
                >
                  <ShoppingCart className="w-3.5 h-3.5 text-violet-300 mb-0.5" />
                  <span>Comp. Dir ({data.directPurchasesCount})</span>
                </button>
              )}
            </div>

            {hoveredKind === 'MATERIALES' && (
              <div className="absolute right-0 top-full pt-1.5 z-50 w-[min(560px,88vw)]">
                <ZeroCostAlertHoverCard
                  kind="MATERIALES"
                  items={data.materialItems}
                  showShip
                  title="Materiales Imputados a Obra Sin Precio ($0 · Excl. EPP)"
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
