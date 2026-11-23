import { useState, useMemo, useEffect } from 'react'
import { ShoppingBasket, X, Search, FileSpreadsheet, CheckCircle2, AlertTriangle } from 'lucide-react'
import { buildContractorCostBaskets, getLocalDateKey, makeBasketKey } from '../../lib/panolBasketsEngine'
import { saveMultiWithdrawalService } from '../../lib/panolService'
import { normalizeText } from '../../lib/allocationEngine'
import PanolMostradorRapidoPanel from './PanolMostradorRapidoPanel'
import PanolBasketFastEntryCard from './PanolBasketFastEntryCard'

/**
 * Modal Canónico "Carga por Canasta de Costos" de Pañol (CARGA_EDICION · Gallo).
 * Análogo a LaborFacialClockModal en Horas: impacta en vivo en inventory_transactions y la Planilla Completa.
 */
export default function PanolCostBasketModal({
  isOpen, onClose, workers = [], ships = [], workOrders = [], workItems = [],
  inventoryTx = [], materials = [], suppliers = [], gasStats = null, gasMovements = [],
  astilleroWorkers = [], user, onRefreshData, showFeedback
}) {
  const [targetDate, setTargetDate] = useState(() => getLocalDateKey(new Date()))
  const [contractorQuery, setContractorQuery] = useState('')
  const [focusedContractorKey, setFocusedContractorKey] = useState(null)
  const [selectedBasketKey, setSelectedBasketKey] = useState(null)
  const [manualBlankBaskets, setManualBlankBaskets] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [modalNotice, setModalNotice] = useState(null)

  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  const board = useMemo(
    () => buildContractorCostBaskets({
      workers, ships, workOrders, workItems, inventoryTx, materials, targetDate, manualBlankBaskets
    }),
    [workers, ships, workOrders, workItems, inventoryTx, materials, targetDate, manualBlankBaskets]
  )

  const filteredChips = useMemo(() => {
    const q = normalizeText(contractorQuery)
    if (!q) return board.activeContractors
    return board.activeContractors.filter((c) => normalizeText(c.name).includes(q))
  }, [board.activeContractors, contractorQuery])

  const selectedBasket = useMemo(() => {
    if (!selectedBasketKey) return null
    for (const c of board.activeContractors) {
      for (const g of c.shipGroups) {
        const hit = g.baskets.find((b) => b.key === selectedBasketKey)
        if (hit) return hit
      }
    }
    return null
  }, [board.activeContractors, selectedBasketKey])

  if (!isOpen) return null

  const handleChipClick = (card) => {
    setFocusedContractorKey((prev) => (prev === card.key ? null : card.key))
    if (card.shipGroups[0]?.baskets[0]) {
      setSelectedBasketKey(card.shipGroups[0].baskets[0].key)
    }
  }

  const handleOpenBlankBasket = (contractorName, shipId) => {
    const key = makeBasketKey(contractorName, shipId, null)
    setManualBlankBaskets((prev) => (
      prev.some((b) => makeBasketKey(b.contractorName, b.shipId, null) === key)
        ? prev
        : [...prev, { contractorName, shipId }]
    ))
    setSelectedBasketKey(key)
  }

  const handleSubmitDelivery = async ({ basket, items, voucherNumber = '', notes, date, time }) => {
    setSubmitting(true)
    setModalNotice(null)
    try {
      await saveMultiWithdrawalService({
        shipId: basket.shipId, workOrderId: basket.isSinOt ? null : basket.workOrderId,
        workItems, contractorGroup: basket.contractorName, voucherNumber, notes, date, time, items,
        gasMovements, materials, suppliers, ships, astilleroWorkers, user,
        changeOrigin: 'COST_BASKET_COUNTER'
      })
      const msg = `✔ Registrado en ${basket.contractorName} · ${basket.shipName} (${items.length} ítem/s a las ${time} hs).`
      setModalNotice({ type: 'success', text: msg })
      showFeedback?.('success', msg)
      await onRefreshData?.({ silent: true })
      return true
    } catch (err) {
      setModalNotice({ type: 'error', text: err.message || 'No se pudo registrar el retiro.' })
      return false
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 font-sans">
      <div className="alon-modal-card max-w-7xl h-[94vh] flex flex-col">
        <div className="alon-modal-header flex-wrap gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-300 shrink-0">
              <ShoppingBasket className="w-4 h-4" />
            </div>
            <div className="flex flex-wrap items-center gap-2 min-w-0">
              <h2 className="text-sm font-black text-white">PAÑOL CENTRAL · CARGA POR CANASTA DE COSTOS</h2>
              <input
                type="date" value={targetDate} onChange={(e) => setTargetDate(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded-lg px-2 py-0.5 text-xs text-white font-mono focus:outline-none focus:border-emerald-400"
                title="Día de trabajo visualizado en las canastas (reseteo diario)"
              />
              <span className="px-2 py-0.5 rounded-full bg-emerald-950/70 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold">
                Hoy: {board.totalTodayWithdrawals} retiros · {board.totalActiveBaskets} canastas
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button" onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" />
              <span>Planilla Completa</span>
            </button>
            <button type="button" tabIndex={-1} onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-3.5 flex flex-col gap-3 flex-1 min-h-0">
          {/* ZONA 1 DEL MOSTRADOR: CONTRATISTAS ACTIVOS DE PERSONAL Y TARIFAS */}
          <div className="p-2.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2 shrink-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300">
                Contratistas Activos · Personal y Tarifas ({board.activeContractors.length})
              </span>
              {focusedContractorKey && (
                <button type="button" onClick={() => setFocusedContractorKey(null)} className="text-[10px] font-bold text-amber-300 hover:underline cursor-pointer">
                  ✕ Mostrar todos los contratistas
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="relative w-44">
                <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text" value={contractorQuery} onChange={(e) => setContractorQuery(e.target.value)}
                  placeholder="Buscar contratista..."
                  className="w-full pl-8 pr-2 py-1 rounded-lg bg-slate-900 border border-slate-700 focus:border-cyan-400 text-xs text-white focus:outline-none"
                />
              </div>
              {filteredChips.map((c) => {
                const isFocused = focusedContractorKey === c.key
                return (
                  <button
                    key={c.key} type="button" onClick={() => handleChipClick(c)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-bold border flex items-center gap-1.5 transition-all cursor-pointer ${
                      isFocused
                        ? 'bg-emerald-500 text-slate-950 border-emerald-300 shadow'
                        : 'bg-slate-900 hover:bg-slate-800 border-slate-700 text-slate-200'
                    }`}
                    title={`${c.name}: ${c.basketsCount} canasta(s) activa(s) · ${c.todayCount} retiro(s) hoy`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.todayCount > 0 ? 'bg-emerald-400' : c.basketsCount > 0 ? 'bg-cyan-400' : 'bg-slate-600'}`} />
                    <span>{c.name}</span>
                    {c.basketsCount > 0 && <span className={`text-[9px] font-mono ${isFocused ? 'text-slate-900' : 'text-slate-400'}`}>({c.basketsCount})</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {modalNotice && (
            <div className={`px-3 py-2 rounded-xl border text-xs font-bold flex items-center justify-between shrink-0 ${
              modalNotice.type === 'error' ? 'bg-rose-950/80 border-rose-500/60 text-rose-200' : 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200'
            }`}>
              <span className="flex items-center gap-2">
                {modalNotice.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-400" /> : <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                {modalNotice.text}
              </span>
              <button type="button" onClick={() => setModalNotice(null)} className="cursor-pointer">✕</button>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 flex-1 min-h-0">
            <div className="lg:col-span-7 min-h-0 flex flex-col">
              <PanolMostradorRapidoPanel
                contractors={board.activeContractors} ships={ships}
                selectedBasketKey={selectedBasketKey} focusedContractorKey={focusedContractorKey}
                onSelectBasket={setSelectedBasketKey} onOpenBlankBasket={handleOpenBlankBasket}
              />
            </div>
            <div className="lg:col-span-5 min-h-0 flex flex-col">
              <PanolBasketFastEntryCard
                key={selectedBasket?.key || 'empty'}
                basket={selectedBasket} targetDate={targetDate}
                materials={materials} suppliers={suppliers} gasStats={gasStats}
                submitting={submitting} onSubmitDelivery={handleSubmitDelivery}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
