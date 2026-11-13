import React, { useState, useEffect } from 'react'
import {
  Package,
  Clock,
  Wrench,
  ShieldAlert,
  ArrowUpRight,
  TableProperties,
  Anchor,
  DollarSign,
  Weight
} from 'lucide-react'
import {
  COST_SHEET_QUICK_LINKS,
  formatUsd,
  formatKg
} from '../../lib/drydockCatalogConstants'
import SvgDonutCard from './SvgDonutCard'

/**
 * Vista 1 del Submódulo 1 (Arquetipo B: Gallina · Solo Análisis).
 * Fiel a GS-004 RESUMEN:
 * - Botonera rápida 3x2 (GENERAL arriba / POR O.T. abajo) hacia hojas solo lectura.
 * - Bloque superior de Costo Directo Total del Buque + 4 Donuts.
 * - Bloque inferior por OT activa con llaves Mat+Cons y M.O Total + 3 Donuts + descripción.
 * - Regla EPP astillero: visible en ámbar punteado debajo de Horas Pend. "R", nunca suma al Total US$.
 */
export default function ResumenObraCostosPanel({
  summary,
  dollarRate = 1500,
  onDollarRateOverride,
  onSelectOt,
  onOpenCostSheet,
  onOpenMatrixView,
  onSaveCraneHours
}) {
  const {
    ship,
    totals,
    otRows = [],
    activeOt,
    donutsShip,
    donutsOt,
    craneHours = {}
  } = summary || {}

  const [localDollar, setLocalDollar] = useState(String(dollarRate || 1500))
  const [shipGruaGrande, setShipGruaGrande] = useState(String(craneHours.shipGruaGrande || 0))
  const [shipGruaChica, setShipGruaChica] = useState(String(craneHours.shipGruaChica || 0))
  const [otGruaGrande, setOtGruaGrande] = useState(String(craneHours.otGruaGrande || 0))
  const [otGruaChica, setOtGruaChica] = useState(String(craneHours.otGruaChica || 0))
  const [otHrsPala, setOtHrsPala] = useState(String(craneHours.otHrsPala || 0))

  useEffect(() => {
    setLocalDollar(String(dollarRate || 1500))
  }, [dollarRate])

  useEffect(() => {
    setShipGruaGrande(String(craneHours.shipGruaGrande ?? 0))
    setShipGruaChica(String(craneHours.shipGruaChica ?? 0))
    setOtGruaGrande(String(craneHours.otGruaGrande ?? 0))
    setOtGruaChica(String(craneHours.otGruaChica ?? 0))
    setOtHrsPala(String(craneHours.otHrsPala ?? 0))
  }, [
    ship?.id,
    activeOt?.id,
    craneHours.shipGruaGrande,
    craneHours.shipGruaChica,
    craneHours.otGruaGrande,
    craneHours.otGruaChica,
    craneHours.otHrsPala
  ])

  const commitDollar = () => {
    const parsed = Number(localDollar)
    if (Number.isFinite(parsed) && parsed > 0 && onDollarRateOverride) {
      onDollarRateOverride(parsed)
    }
  }

  const commitShipCrane = (field, rawVal) => {
    if (!ship?.id || !onSaveCraneHours) return
    const num = Math.max(0, Number(rawVal) || 0)
    onSaveCraneHours({ level: 'SHIP', shipId: ship.id, field, value: num })
  }

  const commitOtCrane = (field, rawVal) => {
    if (!ship?.id || !activeOt?.id || !onSaveCraneHours) return
    const num = Math.max(0, Number(rawVal) || 0)
    onSaveCraneHours({
      level: 'OT',
      shipId: ship.id,
      otId: activeOt.id,
      field,
      value: num
    })
  }

  if (!ship || !totals) {
    return (
      <div className="bg-slate-900/60 border border-slate-700/70 rounded-xl p-8 text-center text-slate-400">
        Seleccioná un buque para visualizar el Resumen Ejecutivo GS-004.
      </div>
    )
  }

  const generalLinks = COST_SHEET_QUICK_LINKS.filter((l) => l.row === 1)
  const otLinks = COST_SHEET_QUICK_LINKS.filter((l) => l.row === 2)

  const iconForSheet = (sheet) => {
    if (sheet === 'materiales') return Package
    if (sheet === 'horas') return Clock
    return Wrench
  }

  return (
    <div className="space-y-4">
      {/* BARRA RÁPIDA GS-004: Dólar Ref + Navegación 3x2 (GENERAL arriba / POR O.T. abajo) + Switch Matriz */}
      <div className="bg-slate-900/75 border border-cyan-500/30 rounded-xl p-3 flex flex-col xl:flex-row xl:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="bg-slate-950/90 border border-emerald-500/40 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
            <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Valor Dólar
            </span>
            <input
              type="number"
              step="1"
              min="1"
              value={localDollar}
              onChange={(e) => setLocalDollar(e.target.value)}
              onBlur={() => commitDollar()}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.currentTarget.blur()
                }
              }}
              className="w-20 bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded px-1.5 py-0.5 text-xs font-bold text-emerald-300 text-right tabular-nums outline-none"
              title="Dólar de referencia para conversiones ARS → US$ en análisis"
            />
          </div>

          <button
            type="button"
            onClick={onOpenMatrixView}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-500/15 text-cyan-200 border border-cyan-400/40 hover:bg-cyan-500/25 transition-colors cursor-pointer"
          >
            <TableProperties className="w-3.5 h-3.5" />
            Ver Matriz OTs (RESUMEN 2)
          </button>
        </div>

        {/* Grilla 3x2 fiel al encabezado GS-004 */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-1.5 flex-1 max-w-4xl">
          {[0, 1, 2].map((colIdx) => {
            const topLink = generalLinks[colIdx]
            const bottomLink = otLinks[colIdx]
            const TopIcon = iconForSheet(topLink.sheet)
            const BotIcon = iconForSheet(bottomLink.sheet)

            return (
              <div key={topLink.sheet} className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => onOpenCostSheet(topLink.sheet, 'GENERAL')}
                  className="flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wide bg-slate-800/90 hover:bg-cyan-500/20 text-cyan-200 border border-slate-700 hover:border-cyan-400/50 transition-colors cursor-pointer"
                  title={`Abrir ${topLink.hint} filtrada al buque completo`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <TopIcon className="w-3 h-3 text-cyan-400 shrink-0" />
                    <span className="truncate">{topLink.label}</span>
                  </span>
                  <ArrowUpRight className="w-3 h-3 text-cyan-400 shrink-0" />
                </button>

                <button
                  type="button"
                  onClick={() => onOpenCostSheet(bottomLink.sheet, 'OT')}
                  className="flex items-center justify-between gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-semibold uppercase tracking-wide bg-slate-950/80 hover:bg-violet-500/20 text-slate-200 hover:text-violet-100 border border-slate-700/80 hover:border-violet-400/50 transition-colors cursor-pointer"
                  title={`Abrir ${bottomLink.hint} (${activeOt?.otNumber || 'OT activa'})`}
                >
                  <span className="flex items-center gap-1.5 truncate">
                    <BotIcon className="w-3 h-3 text-violet-400 shrink-0" />
                    <span className="truncate">{bottomLink.label}</span>
                  </span>
                  <span className="text-[9px] text-violet-300 font-mono shrink-0">
                    {activeOt?.otNumber || 'OT'}
                  </span>
                </button>
              </div>
            )
          })}
        </div>
      </div>

      {/* BLOQUE SUPERIOR: COSTO DIRECTO TOTAL US$ DEL BUQUE + 4 DONUTS */}
      <div className="bg-slate-900/75 border border-slate-700/80 rounded-xl p-4">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
          {/* Columna izquierda: Tabla financiera GS-004 del Buque */}
          <div className="lg:col-span-4 bg-slate-950/80 border border-cyan-500/35 rounded-xl overflow-hidden flex flex-col justify-between">
            <div>
              <div className="px-3.5 py-2.5 bg-cyan-950/50 border-b border-cyan-500/30 flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <Anchor className="w-4 h-4 text-cyan-400 shrink-0" />
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-cyan-200 truncate">
                    COSTO DIRECTO TOTAL US$
                  </h3>
                </div>
                <span className="text-[10px] font-semibold text-cyan-300 truncate max-w-[120px]">
                  {ship.name}
                </span>
              </div>

              <div className="divide-y divide-slate-800/80 text-xs">
                <div className="px-3.5 py-2 flex items-center justify-between">
                  <span className="text-slate-300 font-medium">1. MATERIALES</span>
                  <span className="font-bold text-slate-100 tabular-nums">
                    {formatUsd(totals.materialesUsd)}
                  </span>
                </div>
                <div className="px-3.5 py-2 flex items-center justify-between">
                  <span className="text-slate-300 font-medium">2. MAT. CONSUMIBLES</span>
                  <span className="font-bold text-slate-100 tabular-nums">
                    {formatUsd(totals.consumiblesObraUsd)}
                  </span>
                </div>
                <div className="px-3.5 py-2 flex items-center justify-between">
                  <span className="text-slate-300 font-medium">3. TERCEROS</span>
                  <span className="font-bold text-slate-100 tabular-nums">
                    {formatUsd(totals.tercerosUsd)}
                  </span>
                </div>
                <div className="px-3.5 py-2 flex items-center justify-between">
                  <span className="text-slate-300 font-medium">4. HORAS APROBADAS</span>
                  <span className="font-bold text-slate-100 tabular-nums">
                    {formatUsd(totals.horasUsd)}
                  </span>
                </div>
                <div className="px-3.5 py-2 flex items-center justify-between bg-amber-950/15">
                  <span className="text-amber-200/90 font-medium">
                    5. HORAS PEND. APROBAR (&quot;R&quot;)
                  </span>
                  <span className="font-bold text-amber-300 tabular-nums">
                    {formatUsd(totals.horasPendAprobarUsd)}
                  </span>
                </div>

                {/* Fila obligatoria ELEM. SEGURIDAD: visible debajo de "R", nunca suma al TOTAL US$ */}
                <div className="px-3 py-2 bg-amber-500/10 border-y border-dashed border-amber-400/50 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-300">
                      <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">ELEM. SEGURIDAD (REF. ASTILLERO)</span>
                    </div>
                    <p className="text-[10px] text-amber-200/70">
                      Informativo EPP propio · No suma al Total US$
                    </p>
                  </div>
                  <span className="font-bold text-amber-300 tabular-nums shrink-0">
                    {formatUsd(totals.seguridadReferenciaUsd)}
                  </span>
                </div>

                {/* Referencias operativas de grúa (editables, guardan en system_settings) */}
                <div className="px-3.5 py-2 flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-400 uppercase font-medium">HRS. GRÚA GRANDE</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={shipGruaGrande}
                    onChange={(e) => setShipGruaGrande(e.target.value)}
                    onBlur={() => commitShipCrane('gruaGrande', shipGruaGrande)}
                    className="w-20 bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded px-2 py-0.5 text-right font-semibold text-cyan-200 tabular-nums outline-none"
                  />
                </div>
                <div className="px-3.5 py-2 flex items-center justify-between gap-2 text-[11px]">
                  <span className="text-slate-400 uppercase font-medium">HRS. GRÚA CHICA</span>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={shipGruaChica}
                    onChange={(e) => setShipGruaChica(e.target.value)}
                    onBlur={() => commitShipCrane('gruaChica', shipGruaChica)}
                    className="w-20 bg-slate-900 border border-slate-700 focus:border-cyan-400 rounded px-2 py-0.5 text-right font-semibold text-cyan-200 tabular-nums outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="px-3.5 py-3 bg-emerald-950/40 border-t border-emerald-500/40 flex items-center justify-between">
              <div>
                <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-300 block">
                  TOTAL US$ OBRA
                </span>
                <span className="text-[10px] text-emerald-200/70">
                  Mat + Cons + Terc + Horas (incl. &quot;R&quot;)
                </span>
              </div>
              <span className="text-lg font-black text-emerald-300 tabular-nums">
                {formatUsd(totals.directTotalUsd)}
              </span>
            </div>
          </div>

          {/* Columna derecha: Cabecera de magnitudes globales + 4 Donuts del Buque */}
          <div className="lg:col-span-8 flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="bg-slate-950/75 border border-slate-700/80 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase text-slate-400 flex items-center gap-1.5">
                  <Weight className="w-3.5 h-3.5 text-cyan-400" />
                  Peso Instalado
                </span>
                <span className="text-sm font-extrabold text-slate-100 tabular-nums">
                  {formatKg(totals.weightKg, 2)}
                </span>
              </div>
              <div className="bg-slate-950/75 border border-slate-700/80 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase text-slate-400 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-violet-400" />
                  Horas Físicas
                </span>
                <span className="text-sm font-extrabold text-slate-100 tabular-nums">
                  {totals.physicalHours.toLocaleString('es-AR', { maximumFractionDigits: 1 })} hs
                </span>
              </div>
              <div className="bg-slate-950/75 border border-slate-700/80 rounded-lg px-3 py-2 flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase text-slate-400 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5 text-amber-400" />
                  Terceros Totales
                </span>
                <span className="text-sm font-extrabold text-slate-100 tabular-nums">
                  {formatUsd(totals.tercerosUsd)}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1">
              <SvgDonutCard
                title="TOTAL POR O.T"
                subtitle="Participación en US$ por orden"
                segments={donutsShip?.totalPorOt || []}
                centerLabel="TOTAL"
                centerValue={formatUsd(totals.directTotalUsd, 0)}
                valueFormatter={(v) => formatUsd(v, 0)}
              />
              <SvgDonutCard
                title="DISTRIBUCIÓN DE PESOS"
                subtitle="Kilos instalados por orden"
                segments={donutsShip?.pesosPorOt || []}
                centerLabel="PESO"
                centerValue={formatKg(totals.weightKg, 0)}
                valueFormatter={(v) => formatKg(v, 1)}
              />
              <SvgDonutCard
                title="TOTAL DE HORAS"
                subtitle="Horas hombre físicas por OT"
                segments={donutsShip?.horasPorOt || []}
                centerLabel="HORAS"
                centerValue={`${totals.physicalHours.toLocaleString('es-AR', { maximumFractionDigits: 0 })} h`}
                valueFormatter={(v) => `${v.toLocaleString('es-AR', { maximumFractionDigits: 1 })} hs`}
              />
              <SvgDonutCard
                title="TERCEROS TOTAL"
                subtitle="Subcontratos y talleres por OT"
                segments={donutsShip?.tercerosPorOt || []}
                centerLabel="TERC."
                centerValue={formatUsd(totals.tercerosUsd, 0)}
                valueFormatter={(v) => formatUsd(v, 0)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* BLOQUE INFERIOR: DETALLE POR ORDEN DE TRABAJO (GS-004 ABAJO) */}
      <div className="bg-slate-900/75 border border-slate-700/80 rounded-xl p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-800">
          <div>
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-violet-300">
              DETALLE POR ORDEN DE TRABAJO (COSTO TOTAL POR O.T US$)
            </h3>
            <p className="text-[11px] text-slate-400">
              Seleccioná la OT en la cabecera o aquí para inspeccionar llaves laterales y distribución interna.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-[11px] text-slate-400 font-semibold">OT activa:</label>
            <select
              value={activeOt?.id || ''}
              onChange={(e) => onSelectOt(e.target.value)}
              className="bg-slate-950 border border-violet-500/40 rounded-lg px-2.5 py-1 text-xs font-semibold text-violet-100 outline-none"
            >
              {otRows.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.otNumber} · {o.title} ({formatUsd(o.directTotalUsd, 0)})
                </option>
              ))}
            </select>
          </div>
        </div>

        {!activeOt ? (
          <div className="py-6 text-center text-xs text-slate-500">
            No hay órdenes de trabajo con costos para el alcance seleccionado.
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Bloque izquierdo con llaves laterales Mat+Cons y M.O Total */}
            <div className="lg:col-span-5 bg-slate-950/80 border border-violet-500/35 rounded-xl overflow-hidden flex flex-col justify-between">
              <div>
                <div className="px-3.5 py-2 bg-violet-950/40 border-b border-violet-500/30 flex items-center justify-between">
                  <span className="text-xs font-bold text-violet-200 truncate">
                    {activeOt.otNumber} — {activeOt.title}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-violet-500/20 text-violet-200 font-semibold shrink-0">
                    {activeOt.workType}
                  </span>
                </div>

                {/* Grupo 1: Materiales + Consumibles + Llave lateral Mat+Cons */}
                <div className="grid grid-cols-12 border-b border-slate-800">
                  <div className="col-span-8 divide-y divide-slate-800/70 text-xs">
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-slate-300">MATERIALES</span>
                      <span className="font-bold text-slate-100 tabular-nums">
                        {formatUsd(activeOt.materialesUsd)}
                      </span>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-slate-300">MAT. CONSUMIBLES</span>
                      <span className="font-bold text-slate-100 tabular-nums">
                        {formatUsd(activeOt.consumiblesObraUsd)}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-4 bg-cyan-950/25 border-l border-cyan-500/30 flex flex-col items-center justify-center p-2 text-center">
                    <span className="text-[10px] font-bold uppercase text-cyan-300">Mat+Cons</span>
                    <span className="text-xs font-extrabold text-cyan-100 tabular-nums mt-0.5">
                      {formatUsd(activeOt.matPlusConsUsd)}
                    </span>
                  </div>
                </div>

                {/* Grupo 2: Terceros + Horas + Llave lateral M.O Total */}
                <div className="grid grid-cols-12 border-b border-slate-800">
                  <div className="col-span-8 divide-y divide-slate-800/70 text-xs">
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-slate-300">TERCEROS</span>
                      <span className="font-bold text-slate-100 tabular-nums">
                        {formatUsd(activeOt.tercerosUsd)}
                      </span>
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-slate-300">HORAS (Aprob.+&quot;R&quot;)</span>
                      <span className="font-bold text-slate-100 tabular-nums">
                        {formatUsd(activeOt.horasTotalUsd)}
                      </span>
                    </div>
                  </div>
                  <div className="col-span-4 bg-emerald-950/25 border-l border-emerald-500/30 flex flex-col items-center justify-center p-2 text-center">
                    <span className="text-[10px] font-bold uppercase text-emerald-300">M.O Total</span>
                    <span className="text-xs font-extrabold text-emerald-100 tabular-nums mt-0.5">
                      {formatUsd(activeOt.manoObraTotalUsd)}
                    </span>
                  </div>
                </div>

                {/* EPP de referencia OT */}
                <div className="px-3 py-1.5 bg-amber-500/10 border-b border-dashed border-amber-400/40 flex items-center justify-between text-[11px]">
                  <span className="text-amber-300 font-semibold">
                    ELEM. SEGURIDAD (REF. OT · No suma)
                  </span>
                  <span className="font-bold text-amber-200 tabular-nums">
                    {formatUsd(activeOt.seguridadReferenciaUsd)}
                  </span>
                </div>

                {/* Grúas y Pala específicas de la OT */}
                <div className="divide-y divide-slate-800/70 text-[11px]">
                  <div className="px-3 py-1.5 flex items-center justify-between">
                    <span className="text-amber-200/80 font-medium">HRS. GRÚA GRANDE</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={otGruaGrande}
                      onChange={(e) => setOtGruaGrande(e.target.value)}
                      onBlur={() => commitOtCrane('gruaGrande', otGruaGrande)}
                      className="w-20 bg-slate-900 border border-slate-700 focus:border-violet-400 rounded px-2 py-0.5 text-right font-semibold text-amber-200 tabular-nums outline-none"
                    />
                  </div>
                  <div className="px-3 py-1.5 flex items-center justify-between">
                    <span className="text-amber-200/80 font-medium">HRS. GRÚA CHICA</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={otGruaChica}
                      onChange={(e) => setOtGruaChica(e.target.value)}
                      onBlur={() => commitOtCrane('gruaChica', otGruaChica)}
                      className="w-20 bg-slate-900 border border-slate-700 focus:border-violet-400 rounded px-2 py-0.5 text-right font-semibold text-amber-200 tabular-nums outline-none"
                    />
                  </div>
                  <div className="px-3 py-1.5 flex items-center justify-between">
                    <span className="text-amber-200/80 font-medium">HRS. PALA</span>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      value={otHrsPala}
                      onChange={(e) => setOtHrsPala(e.target.value)}
                      onBlur={() => commitOtCrane('hrsPala', otHrsPala)}
                      className="w-20 bg-slate-900 border border-slate-700 focus:border-violet-400 rounded px-2 py-0.5 text-right font-semibold text-amber-200 tabular-nums outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="px-3.5 py-2.5 bg-violet-950/45 border-t border-violet-500/40 flex items-center justify-between">
                <span className="text-xs font-extrabold uppercase text-violet-200">
                  TOTAL US$ ({activeOt.otNumber})
                </span>
                <span className="text-base font-black text-violet-200 tabular-nums">
                  {formatUsd(activeOt.directTotalUsd)}
                </span>
              </div>
            </div>

            {/* Columna derecha: Totales OT + 3 Donuts + Descripción de Trabajo */}
            <div className="lg:col-span-7 flex flex-col gap-3">
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-slate-950/70 border border-slate-700/80 rounded-lg px-3 py-2 text-center">
                  <span className="text-[10px] uppercase text-slate-400 block">Total Peso OT</span>
                  <span className="text-xs font-bold text-slate-100 tabular-nums">
                    {formatKg(activeOt.weightKg, 2)}
                  </span>
                </div>
                <div className="bg-slate-950/70 border border-slate-700/80 rounded-lg px-3 py-2 text-center">
                  <span className="text-[10px] uppercase text-slate-400 block">Total Horas OT</span>
                  <span className="text-xs font-bold text-slate-100 tabular-nums">
                    {activeOt.physicalHours.toLocaleString('es-AR', { maximumFractionDigits: 1 })} hs
                  </span>
                </div>
                <div className="bg-slate-950/70 border border-slate-700/80 rounded-lg px-3 py-2 text-center">
                  <span className="text-[10px] uppercase text-slate-400 block">Total Terceros OT</span>
                  <span className="text-xs font-bold text-slate-100 tabular-nums">
                    {formatUsd(activeOt.tercerosUsd)}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 flex-1">
                <SvgDonutCard
                  title="KILOS POR RUBRO"
                  segments={donutsOt?.kilosPorRubro || []}
                  centerLabel="KG OT"
                  centerValue={formatKg(activeOt.weightKg, 0)}
                  valueFormatter={(v) => formatKg(v, 1)}
                  size={104}
                />
                <SvgDonutCard
                  title="HORAS POR OFICIO"
                  segments={donutsOt?.horasPorOficio || []}
                  centerLabel="HORAS"
                  centerValue={`${activeOt.physicalHours.toLocaleString('es-AR', { maximumFractionDigits: 0 })} h`}
                  valueFormatter={(v) => `${v.toLocaleString('es-AR', { maximumFractionDigits: 1 })} hs`}
                  size={104}
                />
                <SvgDonutCard
                  title="TERCEROS OT"
                  segments={donutsOt?.tercerosOt || []}
                  centerLabel="TERC."
                  centerValue={formatUsd(activeOt.tercerosUsd, 0)}
                  valueFormatter={(v) => formatUsd(v, 0)}
                  size={104}
                />
              </div>

              <div className="bg-slate-950/80 border border-slate-700/80 rounded-lg px-3.5 py-2.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                  Descripción de Trabajo ({activeOt.otNumber})
                </span>
                <p className="text-xs text-slate-200 leading-relaxed">
                  {activeOt.description || 'Sin descripción de trabajos registrada en OTs.'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
