import React from 'react'
import ResumenShipCostStrip from './ResumenShipCostStrip'
import ResumenOtDetailStrip from './ResumenOtDetailStrip'
import ResumenCostosMobileView from './ResumenCostosMobileView'

/**
 * Vista 1 del Submódulo 1 (100% Solo Lectura · Zero-Scroll Desktop).
 * - Sin Zona 2 redundante: cada fila de costo (Cian = General, Violeta = O.T.) funciona como acceso directo
 *   con previsualización emergente al hover y clic para abrir la hoja filtrada correspondiente.
 * - Dólar Ref. reside en Zona 1 (`ResumenGerencialHeader`).
 */
export default function ResumenObraCostosPanel({
  summary,
  onOpenCostSheet
}) {
  const {
    ship,
    totals,
    activeOt,
    donutsShip,
    donutsOt,
    craneHours = {},
    zeroCostAlerts,
    hoverSummaries
  } = summary || {}

  if (!ship || !totals) {
    return (
      <div className="bg-slate-900/60 border border-slate-700/70 rounded-xl p-8 text-center text-slate-400">
        Seleccioná un buque para visualizar el Resumen Ejecutivo GS-004.
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 md:flex-1 md:min-h-0">
      {/* VISTA DESKTOP ZERO-SCROLL (`md+`): 100% Solo Lectura Visual */}
      <div className="hidden md:flex flex-col gap-3 flex-1 min-h-0">
        <ResumenShipCostStrip
          ship={ship}
          totals={totals}
          craneHours={craneHours}
          donutsShip={donutsShip}
          zeroCostAlerts={zeroCostAlerts}
          hoverShip={hoverSummaries?.ship}
          onOpenCostSheet={onOpenCostSheet}
        />

        <ResumenOtDetailStrip
          activeOt={activeOt}
          craneHours={craneHours}
          donutsOt={donutsOt}
          hoverOt={hoverSummaries?.ot}
          onOpenCostSheet={onOpenCostSheet}
        />
      </div>

      {/* VISTA MÓVIL ÁGIL (`< md`): Costo Directo Total + Detalle OT */}
      <ResumenCostosMobileView
        ship={ship}
        totals={totals}
        activeOt={activeOt}
        craneHours={craneHours}
        zeroCostAlerts={zeroCostAlerts}
        onOpenCostSheet={onOpenCostSheet}
      />
    </div>
  )
}
