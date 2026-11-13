import { useState, useMemo } from 'react'
import { Check, Copy, MessageSquare } from 'lucide-react'
import { groupMandadoOrders, buildMandadosWhatsAppMessage } from '../../lib/comprasAuxHelpers'
import { dispatchMandadosService } from '../../services/comprasAuxService'

export function MandadosModal({ purchaseOrders, suppliers, workers, preselectedIds = [], onDispatched, onClose }) {
  const candidateOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (preselectedIds.includes(po.id)) return true
      if (!['PEDIDO', 'PEDIDO INCOMPLETO'].includes(po.status)) return false
      const sup = suppliers.find((s) => s.id === po.supplier_id)
      return Boolean(sup?.is_local_supplier)
    })
  }, [purchaseOrders, suppliers, preselectedIds])

  const [selectedIds, setSelectedIds] = useState(() => {
    if (preselectedIds.length > 0) return new Set(preselectedIds)
    return new Set(candidateOrders.map((p) => p.id))
  })

  const defaultWorker = useMemo(() => {
    const mandadero = workers.find((w) => (w.trade || '').toUpperCase().includes('MANDADO'))
    if (mandadero) return mandadero.id
    const withPhone = workers.find((w) => w.phone && w.phone.trim())
    return withPhone?.id || (workers[0]?.id || '')
  }, [workers])

  const [selectedWorkerId, setSelectedWorkerId] = useState(defaultWorker)
  const [copied, setCopied] = useState(false)

  const selectedWorker = useMemo(
    () => workers.find((w) => w.id === selectedWorkerId),
    [workers, selectedWorkerId]
  )

  const groupedOrders = useMemo(
    () => groupMandadoOrders(selectedIds, candidateOrders, suppliers),
    [selectedIds, candidateOrders, suppliers]
  )

  const messageText = useMemo(
    () => buildMandadosWhatsAppMessage(groupedOrders, selectedWorker),
    [groupedOrders, selectedWorker]
  )

  function toggleSelectAll() {
    if (selectedIds.size === candidateOrders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(candidateOrders.map((p) => p.id)))
    }
  }

  function toggleItem(id) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function handleCopy() {
    navigator.clipboard.writeText(messageText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function handleSendWhatsApp() {
    const cleanPhone = (selectedWorker?.phone || '').replace(/\D/g, '')
    if (!cleanPhone) {
      alert(`El operario "${selectedWorker?.name || 'seleccionado'}" no tiene cargado un número de teléfono en Nómina. Por favor agrégalo en el módulo Personal o copia el mensaje manualmente.`)
      return
    }
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
    window.open(url, '_blank')

    const dispatchedIds = Array.from(selectedIds)
    const dispatchInfo = {
      courier_dispatched: true,
      courier_dispatched_at: new Date().toISOString(),
      courier_worker_id: selectedWorker?.id || null,
      courier_worker_name: selectedWorker?.name || null
    }

    try {
      await dispatchMandadosService({
        dispatchedIds,
        dispatchInfo,
        candidateOrders,
        workerName: selectedWorker?.name
      })
    } catch (err) {
      console.error('Error registrando despacho de mandado en Supabase:', err)
    }

    if (onDispatched) {
      onDispatched(dispatchedIds, dispatchInfo)
    }
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl p-6 space-y-4 shadow-2xl animate-in fade-in duration-150">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/10 text-xl">
              🛵
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Pedido de Mandado (Retiro Local)
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 uppercase font-black">
                  WhatsApp Inteligente
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Selecciona los materiales emitidos a retirar de proveedores locales y envía la orden agrupada al mandadero en 1 clic.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg cursor-pointer">✕</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Operario Responsable de Mandados</label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-bold focus:outline-none focus:border-cyan-500"
            >
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.trade ? `(${w.trade})` : ''} {w.phone ? `• ${w.phone}` : '• S/Tel'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-center">
            <span className="text-slate-400 text-[11px]">Destino de Notificación:</span>
            <div className="flex items-center gap-2 mt-0.5 font-mono text-xs">
              <span className="text-white font-bold">{selectedWorker?.name || 'Sin seleccionar'}</span>
              {selectedWorker?.phone ? (
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold">
                  {selectedWorker.phone}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300">
                  ⚠️ Sin Teléfono
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">
                Materiales Emitidos a Prov. Locales ({selectedIds.size}/{candidateOrders.length})
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
              >
                {selectedIds.size === candidateOrders.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
              {candidateOrders.length > 0 ? (
                candidateOrders.map((po) => {
                  const isChecked = selectedIds.has(po.id)
                  const sup = suppliers.find((s) => s.id === po.supplier_id)
                  return (
                    <label
                      key={po.id}
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-cyan-950/40 border-cyan-500/50 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(po.id)}
                        className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white truncate">{po.material_name_raw || 'Material'}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {Number(po.quantity) || 1} {po.unit_measure || 'un.'} • <strong className="text-cyan-300">{sup?.name || 'S/Prov'}</strong> {sup?.address ? `(${sup.address})` : ''}
                        </p>
                      </div>
                    </label>
                  )
                })
              ) : (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-slate-500">
                  No hay pedidos pendientes de retiro de proveedores locales.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 flex flex-col">
            <span className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
              <span>Vista Previa del Mensaje</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">WhatsApp</span>
            </span>

            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-emerald-200/90 whitespace-pre-wrap max-h-[300px] overflow-y-auto leading-relaxed shadow-inner">
              {messageText}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Copiado!' : 'Copiar Mensaje'}</span>
            </button>

            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={handleSendWhatsApp}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <MessageSquare className="w-4 h-4 stroke-[2.5]" />
              <span>Enviar WhatsApp a {selectedWorker?.name?.split(',')[0]?.split(' ')[0] || 'Mandadero'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
