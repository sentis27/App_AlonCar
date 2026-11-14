import { useState } from 'react'
import { Split, RefreshCw } from 'lucide-react'
import { registerPartialDeliveryService } from '../../services/comprasAuxService'

export function PartialDeliveryModal({ order, suppliers, ships, onClose, onSuccess }) {
  const sup = suppliers.find((s) => s.id === order.supplier_id)
  const shp = ships.find((s) => s.id === order.ship_id)

  const originalQty = Number(order.quantity) || 1
  const [receivedQty, setReceivedQty] = useState(Math.max(1, Math.floor(originalQty * 0.8)))
  const [remitoNumber, setRemitoNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const [processing, setProcessing] = useState(false)

  const missingQty = Math.max(0, originalQty - Number(receivedQty))

  async function handleSubmit(e) {
    e.preventDefault()
    if (Number(receivedQty) <= 0) return alert('La cantidad recibida debe ser mayor a 0.')
    if (Number(receivedQty) >= originalQty) return alert('Para una recepción completa de todas las unidades, usa el estado "RECIBIDO".')
    if (!remitoNumber.trim()) return alert('Por favor indica el Número de Remito de la entrega.')

    setProcessing(true)
    try {
      const result = await registerPartialDeliveryService({
        order,
        receivedQty,
        missingQty,
        remitoNumber,
        notes,
        evidenceFiles
      })
      onSuccess(result)
    } catch (err) {
      console.error('Error procesando recepción parcial:', err)
      alert('Error: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-950 border border-orange-800 flex items-center justify-center text-orange-400">
              <Split className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                Recepción Parcial de Mercadería
                <span className="text-[10px] px-2 py-0.5 rounded bg-orange-950 border border-orange-800 text-orange-300 font-bold">
                  PEDIDO INCOMPLETO
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Registra las unidades que llegaron y separa automáticamente el saldo faltante para reclamo.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <p className="font-bold text-white text-sm">{order.material_name_raw}</p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
              <span>Cantidad Original: <strong className="text-white">{originalQty} {order.unit_measure || 'un.'}</strong></span>
              <span>Buque: <strong className="text-cyan-300">{shp?.name || 'ASTILLERO'}</strong></span>
              <span>Proveedor: <strong className="text-slate-200">{sup?.name || 'S/D'}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div>
              <label className="block text-emerald-400 font-bold mb-1">
                ✅ Cantidad Recibida Físicamente
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                max={originalQty - 0.01}
                value={receivedQty}
                onChange={(e) => setReceivedQty(e.target.value)}
                className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg p-2.5 text-white font-mono font-bold text-sm focus:outline-none focus:border-emerald-400"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">Ingresan a Pañol / Obra</span>
            </div>

            <div>
              <label className="block text-orange-400 font-bold mb-1">
                ⚠️ Cantidad Faltante a Reclamar
              </label>
              <div className="w-full bg-slate-900 border border-orange-500/40 rounded-lg p-2.5 text-orange-300 font-mono font-extrabold text-sm flex items-center justify-between">
                <span>{missingQty}</span>
                <span className="text-xs text-slate-400 font-normal">{order.unit_measure || 'un.'}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">Pasa a estado PEDIDO INCOMPLETO</span>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">
              Nº de Remito del Proveedor <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={remitoNumber}
              onChange={(e) => setRemitoNumber(e.target.value)}
              placeholder="Ej: R-0004-00012345"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">
              Fotos del Remito y Mercadería (Evidencia para el Reclamo)
            </label>
            <input
              type="file"
              multiple
              onChange={(e) => setEvidenceFiles(Array.from(e.target.files))}
              className="w-full text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-950 file:text-cyan-400 hover:file:bg-cyan-900 cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Se adjuntará automáticamente a la orden para respaldo de compras.
            </span>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Observaciones del Pañolero / Motivo informado por el chofer
            </label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Chofer informa que no había stock suficiente, entregan el saldo la próxima semana..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={processing}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-slate-950 font-extrabold rounded-lg shadow-md shadow-orange-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Split className="w-4 h-4 stroke-[2.5]" />}
              <span>{processing ? 'Procesando...' : 'Confirmar Recepción y Separar Faltante'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
