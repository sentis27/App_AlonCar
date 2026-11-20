import { useState, useMemo } from 'react'
import { Plus, Trash2, Clock, Save, AlertTriangle, ChevronDown, ChevronRight, ShoppingBasket } from 'lucide-react'
import { MaterialAutocompleteInput } from './MaterialAutocompleteInput'
import { GasDeliveryInlinePanel } from './GasDeliveryInlinePanel'
import CanonicalOtBadge from '../canonical/CanonicalOtBadge'
import { isGasMaterial } from '../../lib/panolConstants'
import { formatLocalTimeHHMM } from '../../lib/panolBasketsEngine'

const createEmptyItem = () => ({
  material_id: '', quantity: 1, customCostCenter: 'CLIENTE', notes: '',
  gasOperationType: 'PRIMERA_ENTREGA', supplierDeliveredId: '', supplierReturnedId: ''
})

/**
 * Columna derecha del Menú "Carga por Canasta de Costos":
 * Carga rápida multi-material precargada (Contratista + Barco + OT/Sin OT), hora exacta HH:mm,
 * lista del día (reseteo diario) y desplegable 1-clic para días anteriores.
 */
export default function PanolBasketFastEntryCard({
  basket = null,
  targetDate,
  materials = [],
  suppliers = [],
  gasStats = null,
  submitting = false,
  onSubmitDelivery
}) {
  const [items, setItems] = useState([createEmptyItem()])
  const [notes, setNotes] = useState('')
  const [entryTime, setEntryTime] = useState(() => formatLocalTimeHHMM(new Date()) || '08:00')
  const [showPreviousDays, setShowPreviousDays] = useState(false)
  const [localError, setLocalError] = useState('')

  const gasSuppliers = useMemo(() => {
    const flagged = suppliers.filter((s) => s.is_gas_supplier)
    return flagged.length > 0 ? flagged : suppliers
  }, [suppliers])

  if (!basket) {
    return (
      <div className="rounded-2xl bg-slate-950/80 border border-slate-800 p-8 h-full flex flex-col items-center justify-center text-center space-y-2.5">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <ShoppingBasket className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-black text-white">Seleccioná una Canasta de Costos</h3>
        <p className="text-xs text-slate-400 max-w-xs">
          Hacé clic en cualquier OT activa de la izquierda (o abrí una Orden en Blanco) para cargar materiales sin volver a elegir barco ni contratista.
        </p>
      </div>
    )
  }

  const updateItem = (idx, field, val) => {
    setItems((prev) => prev.map((it, i) => {
      if (i !== idx) return it
      const next = { ...it, [field]: val }
      if (field === 'material_id') {
        const mat = materials.find((m) => m.id === val)
        if (isGasMaterial(mat)) next.quantity = Math.max(1, Math.round(Number(next.quantity) || 1))
      }
      return next
    }))
  }

  const handleFormSubmit = async (e) => {
    e.preventDefault()
    setLocalError('')
    const validItems = items.filter((it) => it.material_id && Number(it.quantity) > 0)
    if (validItems.length === 0) { setLocalError('Elegí al menos un material y una cantidad mayor a 0.'); return }
    for (const it of validItems) {
      const mat = materials.find((m) => m.id === it.material_id)
      if (isGasMaterial(mat)) {
        if (!it.supplierDeliveredId) { setLocalError(`Seleccioná la Marca Entregada para "${mat.name}".`); return }
        if (it.gasOperationType === 'RECAMBIO_1X1' && !it.supplierReturnedId) {
          setLocalError(`En Recambio 1x1 debés indicar la Marca Devuelta para "${mat.name}".`); return
        }
      }
    }
    const ok = await onSubmitDelivery({ basket, items: validItems, notes, date: targetDate, time: entryTime })
    if (ok) {
      setItems([createEmptyItem()])
      setNotes('')
      setEntryTime(formatLocalTimeHHMM(new Date()) || '08:00')
    }
  }

  return (
    <div className="rounded-2xl bg-slate-950/90 border border-emerald-500/40 flex flex-col max-h-full overflow-hidden shadow-2xl">
      <div className={`p-3 border-b ${basket.isSinOt ? 'bg-amber-950/40 border-amber-500/40' : 'bg-emerald-950/35 border-emerald-500/30'}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5 text-xs font-black text-white min-w-0">
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-300">{basket.contractorName}</span>
            <span className="text-slate-500">➔</span>
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-cyan-500/40 text-cyan-300 truncate max-w-[160px]">{basket.shipName}</span>
          </div>
          <label className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-mono text-emerald-300 shrink-0" title="Hora exacta de registro del retiro">
            <Clock className="w-3 h-3" />
            <input type="time" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} className="bg-slate-950 text-emerald-300 focus:outline-none w-16" />
          </label>
        </div>
        <div
          className={`mt-1.5 text-xs font-bold truncate ${basket.isSinOt ? 'text-amber-300' : 'text-slate-200'}`}
          title={basket.otTooltip || (basket.isSinOt ? 'Canasta única para retiros sin OT en este barco' : `${basket.otNumber ? `${basket.otNumber} · ` : ''}${basket.otTitle}`)}
        >
          {basket.isSinOt ? (
            '⚠️ Sin OT — Canasta Única en Blanco para este barco'
          ) : (
            <CanonicalOtBadge
              otNumber={basket.otNumber}
              otTitle={basket.otTitle}
              tooltipOverride={basket.otTooltip}
              variant="inline"
              className="text-xs font-bold text-slate-200"
            />
          )}
        </div>
      </div>

      <form onSubmit={handleFormSubmit} className="p-3 space-y-3 overflow-y-auto flex-1">
        {localError && (
          <div className="p-2 rounded-lg bg-rose-950/80 border border-rose-500/60 text-xs text-rose-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" /> <span>{localError}</span>
          </div>
        )}

        <div className="space-y-2">
          <span className="text-[11px] font-black uppercase text-emerald-300">1. Materiales a Entregar</span>
          {items.map((item, idx) => {
            const mat = materials.find((m) => m.id === item.material_id)
            const rowIsGas = isGasMaterial(mat)
            return (
              <div key={idx} className="p-2 rounded-xl bg-slate-900/90 border border-slate-800 space-y-2">
                <div className="flex items-center gap-1.5">
                  <div className="flex-1 min-w-0">
                    <MaterialAutocompleteInput materials={materials} value={item.material_id} onChange={(id) => updateItem(idx, 'material_id', id)} />
                  </div>
                  <input
                    type="number" min="0.01" step={rowIsGas ? '1' : '0.01'} value={item.quantity}
                    onChange={(e) => updateItem(idx, 'quantity', e.target.value)}
                    className="w-16 bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded px-2 py-1.5 text-xs font-mono text-white text-center focus:outline-none"
                    title="Cantidad a retirar"
                  />
                  <span className="text-[10px] font-mono text-slate-400 w-7 truncate">{mat?.unit_measure || 'un.'}</span>
                  <button
                    type="button" tabIndex={-1}
                    onClick={() => updateItem(idx, 'customCostCenter', item.customCostCenter === 'CONTRATISTA' ? 'CLIENTE' : 'CONTRATISTA')}
                    className={`px-1.5 py-1 rounded text-[9px] font-black border cursor-pointer shrink-0 ${
                      item.customCostCenter === 'CONTRATISTA' ? 'bg-amber-950 border-amber-500/60 text-amber-300' : 'bg-slate-950 border-slate-700 text-slate-300'
                    }`}
                    title="Clic para alternar Centro de Costo (CLIENTE / CONTRATISTA)"
                  >
                    {item.customCostCenter === 'CONTRATISTA' ? 'CONTR.' : 'CLI.'}
                  </button>
                  {items.length > 1 && (
                    <button type="button" tabIndex={-1} onClick={() => setItems((p) => p.filter((_, i) => i !== idx))} className="p-1 text-slate-500 hover:text-rose-400 cursor-pointer" title="Quitar renglón">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                {rowIsGas && (
                  <GasDeliveryInlinePanel
                    material={mat} item={item} gasSuppliers={gasSuppliers} contractorName={basket.contractorName}
                    gasStats={gasStats} onChangeField={(f, v) => updateItem(idx, f, v)}
                  />
                )}
              </div>
            )
          })}
          <button
            type="button" onClick={() => setItems((p) => [...p, createEmptyItem()])}
            className="w-full py-1.5 rounded-lg border border-dashed border-cyan-500/50 hover:border-cyan-400 text-cyan-300 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar otro material
          </button>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-300 mb-1">2. Observaciones (opcional)</label>
          <input
            type="text" value={notes} onChange={(e) => setNotes(e.target.value)}
            placeholder="Detalle del retiro, ubicación en buque..."
            className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-400 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none"
          />
        </div>

        <button
          type="submit" disabled={submitting}
          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:brightness-110 disabled:opacity-50 text-slate-950 text-xs font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 cursor-pointer"
        >
          <Save className="w-4 h-4" />
          <span>{submitting ? 'Registrando...' : `Registrar Entrega (${entryTime} hs)`}</span>
        </button>

        <div className="pt-2.5 border-t border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-[11px] font-black text-slate-300">
            <span>Retiros de HOY en esta canasta ({basket.todayItems.length})</span>
            {basket.previousItems.length > 0 && (
              <button
                type="button" onClick={() => setShowPreviousDays((p) => !p)}
                className="text-[10px] font-bold text-cyan-300 hover:text-cyan-200 flex items-center gap-1 cursor-pointer"
              >
                {showPreviousDays ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                <span>{showPreviousDays ? 'Ocultar' : 'Ver'} días anteriores ({basket.previousItems.length})</span>
              </button>
            )}
          </div>
          {basket.todayItems.length === 0 ? (
            <p className="text-[11px] text-slate-500 italic">Sin retiros cargados hoy en esta canasta.</p>
          ) : (
            <ul className="space-y-1 max-h-36 overflow-y-auto">
              {basket.todayItems.map((it) => (
                <li key={it.id} className="text-[11px] flex items-start justify-between gap-2 px-2 py-1 rounded bg-slate-900/80 border border-slate-800/80">
                  <span className="text-slate-200 truncate"><strong className="text-emerald-300 font-mono mr-1.5">{it.timeLabel}</strong>{it.materialName}</span>
                  <span className="font-mono font-bold text-white shrink-0">{it.quantity} {it.unitMeasure}</span>
                </li>
              ))}
            </ul>
          )}
          {showPreviousDays && basket.previousItems.length > 0 && (
            <ul className="space-y-1 pt-1 border-t border-slate-800/70 max-h-36 overflow-y-auto">
              {basket.previousItems.map((it) => (
                <li key={it.id} className="text-[10px] flex items-start justify-between gap-2 px-2 py-1 rounded bg-slate-900/40 text-slate-400">
                  <span className="truncate"><strong className="font-mono text-slate-500 mr-1.5">{it.dateKey} {it.timeLabel}</strong>{it.materialName}</span>
                  <span className="font-mono shrink-0">{it.quantity} {it.unitMeasure}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </form>
    </div>
  )
}
