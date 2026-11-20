import { useState } from 'react'
import { Ship, Plus, AlertTriangle, Clock, CheckCircle2, FolderOpen } from 'lucide-react'

/**
 * Columna izquierda del Menú "Carga por Canasta de Costos":
 * Libretitas agrupadas por Contratista ➔ Barco (código de color) ➔ OTs Activas / Canasta Única Sin OT.
 */
export default function PanolMostradorRapidoPanel({
  contractors = [],
  ships = [],
  selectedBasketKey = null,
  focusedContractorKey = null,
  onSelectBasket,
  onOpenBlankBasket
}) {
  const [blankPickerFor, setBlankPickerFor] = useState(null)
  const [pickedShipId, setPickedShipId] = useState('')

  const visibleCards = focusedContractorKey
    ? contractors.filter((c) => c.key === focusedContractorKey)
    : contractors.filter((c) => c.basketsCount > 0)

  const handleConfirmBlank = (contractorName) => {
    if (!pickedShipId) return
    onOpenBlankBasket(contractorName, pickedShipId)
    setBlankPickerFor(null)
    setPickedShipId('')
  }

  return (
    <div className="space-y-3 overflow-y-auto pr-1 max-h-full">
      <div className="flex items-center justify-between gap-2 sticky top-0 z-10 bg-slate-900/95 backdrop-blur py-1">
        <span className="text-[11px] font-black uppercase tracking-wider text-slate-300">
          Libretitas Activas ({visibleCards.length}) · OTs Habilitadas y Canastas Sin OT
        </span>
        <span className="text-[10px] text-slate-400">
          Los materiales mostrados se reinician cada día
        </span>
      </div>

      {visibleCards.length === 0 ? (
        <div className="p-6 rounded-xl border border-dashed border-slate-700 bg-slate-950/60 text-center space-y-2">
          <FolderOpen className="w-6 h-6 text-slate-500 mx-auto" />
          <p className="text-xs text-slate-300 font-bold">
            No hay canastas activas para el filtro seleccionado.
          </p>
          <p className="text-[11px] text-slate-400">
            Al crearse una OT activa en Órdenes de Trabajo aparecerá aquí automáticamente, o elegí un contratista arriba para abrir una Orden en Blanco.
          </p>
        </div>
      ) : (
        visibleCards.map((card) => {
          const isBlankOpen = blankPickerFor === card.key
          return (
            <div
              key={card.key}
              className="rounded-2xl bg-slate-950/85 border border-slate-800 p-3 space-y-2.5 shadow-lg"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${card.todayCount > 0 ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]' : 'bg-slate-600'}`}
                    title={card.todayCount > 0 ? 'Tiene retiros registrados hoy' : 'Sin retiros hoy todavía'}
                  />
                  <h3 className="text-sm font-black text-white tracking-wide truncate">{card.name}</h3>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] font-mono">
                  <span className="px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                    {card.shipGroups.length} Barco{card.shipGroups.length === 1 ? '' : 's'} · {card.basketsCount} Canasta{card.basketsCount === 1 ? '' : 's'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full border font-bold ${
                    card.todayCount > 0
                      ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}>
                    Hoy: {card.todayCount}
                  </span>
                </div>
              </div>

              {card.shipGroups.length === 0 ? (
                <p className="text-[11px] text-slate-400 italic px-1">
                  Sin OTs activas asignadas todavía. Podés abrir una Orden en Blanco (⚠️ Sin OT) abajo.
                </p>
              ) : (
                <div className="space-y-2">
                  {card.shipGroups.map((group) => (
                    <div
                      key={group.shipId}
                      className={`rounded-xl border p-2.5 space-y-1.5 ${group.theme.border} ${group.theme.bg}`}
                    >
                      <div className={`flex items-center gap-1.5 text-xs font-black uppercase ${group.theme.title}`}>
                        <Ship className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{group.shipName}</span>
                      </div>
                      <div className="space-y-1.5">
                        {group.baskets.map((basket) => {
                          const isActive = selectedBasketKey === basket.key
                          return (
                            <div
                              key={basket.key}
                              onClick={() => onSelectBasket(basket.key)}
                              className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg border transition-all cursor-pointer ${
                                isActive
                                  ? 'bg-emerald-950/60 border-emerald-400 ring-1 ring-emerald-400/60 shadow-md'
                                  : basket.isSinOt
                                  ? 'bg-slate-950/90 border-amber-500/40 hover:border-amber-400'
                                  : 'bg-slate-950/90 border-slate-800 hover:border-slate-600'
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 text-xs font-bold text-white truncate">
                                  {basket.isSinOt ? (
                                    <span className="inline-flex items-center gap-1 text-amber-300" title="Canasta única para retiros sin OT en este barco">
                                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Sin OT · Orden en Blanco
                                    </span>
                                  ) : (
                                    <span className="truncate">
                                      {basket.otNumber ? `${basket.otNumber} · ` : ''}{basket.otTitle}
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400 font-mono mt-0.5">
                                  <span className={basket.todayItems.length > 0 ? 'text-emerald-300 font-bold' : ''}>
                                    Hoy: {basket.todayItems.length} ítem{basket.todayItems.length === 1 ? '' : 's'}
                                  </span>
                                  {basket.lastTodayTime && (
                                    <span className="inline-flex items-center gap-0.5 text-slate-300">
                                      <Clock className="w-2.5 h-2.5" /> {basket.lastTodayTime} hs
                                    </span>
                                  )}
                                  {basket.previousItems.length > 0 && (
                                    <span className="text-slate-500" title="Retiros de días anteriores ocultos (ampliables desde la canasta)">
                                      ({basket.previousItems.length} días ant.)
                                    </span>
                                  )}
                                </div>
                              </div>
                              <span
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-black shrink-0 flex items-center gap-1 ${
                                  isActive
                                    ? 'bg-emerald-400 text-slate-950'
                                    : 'bg-slate-900 border border-emerald-500/50 text-emerald-300 hover:bg-emerald-500/20'
                                }`}
                              >
                                {isActive ? <><CheckCircle2 className="w-3 h-3" /> ACTIVA</> : <><Plus className="w-3 h-3" /> Sumar</>}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {isBlankOpen ? (
                <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-slate-800">
                  <select
                    value={pickedShipId}
                    onChange={(e) => setPickedShipId(e.target.value)}
                    className="flex-1 min-w-[180px] bg-slate-950 border border-amber-500/60 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400"
                  >
                    <option value="" className="bg-slate-900">-- Elegir barco para Orden en Blanco (Sin OT) --</option>
                    {ships.map((s) => (
                      <option key={s.id} value={s.id} className="bg-slate-900 text-white">{s.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!pickedShipId}
                    onClick={() => handleConfirmBlank(card.name)}
                    className="px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 text-xs font-black cursor-pointer"
                  >
                    Abrir Canasta Sin OT
                  </button>
                  <button
                    type="button"
                    onClick={() => { setBlankPickerFor(null); setPickedShipId('') }}
                    className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold cursor-pointer"
                  >
                    Cancelar
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setBlankPickerFor(card.key); setPickedShipId('') }}
                  className="w-full py-1.5 rounded-lg border border-dashed border-amber-500/40 hover:border-amber-400 bg-amber-950/10 hover:bg-amber-950/30 text-amber-300 text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Crea o abre la única canasta en blanco (Sin OT) para este contratista en el barco elegido"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Agregar Orden en Blanco (⚠️ Sin OT) en un Barco</span>
                </button>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
