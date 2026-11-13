import { useState } from 'react'
import { Truck } from 'lucide-react'

function openNativePicker(e) {
  if (typeof e.currentTarget.showPicker === 'function') {
    try { e.currentTarget.showPicker() } catch { /* ignore */ }
  }
}

export function FreightModal({ order, onClose, onSuccess }) {
  const todayIso = new Date().toISOString().split('T')[0]
  const [transportName, setTransportName] = useState(order?.freight_transport_name || '')
  const [requestDate, setRequestDate] = useState(order?.freight_request_date || todayIso)
  const [estimatedDate, setEstimatedDate] = useState(order?.freight_estimated_date || '')

  function handleSubmit(e) {
    e.preventDefault()
    onSuccess({
      freight_transport_name: transportName.trim() || null,
      freight_request_date: requestDate || null,
      freight_estimated_date: estimatedDate || null
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-400" />
              Datos de Flete / Transporte
            </h3>
            <p className="text-xs text-slate-400 truncate max-w-[320px]">
              Material: <strong className="text-slate-200">{order?.material_name}</strong>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 mb-1 font-bold">Nombre del Transporte / Comisionista</label>
            <input
              type="text"
              autoFocus
              placeholder="Ej: Cruz del Sur / Expreso Tas / Flete propio..."
              value={transportName}
              onChange={(e) => setTransportName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1 font-bold">Fecha de Solicitud</label>
              <input
                type="date"
                value={requestDate}
                onClick={openNativePicker}
                onChange={(e) => setRequestDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono focus:outline-none focus:border-amber-400 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Por defecto hoy (editable)</span>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-bold">Fecha Entrega Estimada (Flete)</label>
              <input
                type="date"
                value={estimatedDate}
                onClick={openNativePicker}
                onChange={(e) => setEstimatedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-amber-200 font-mono focus:outline-none focus:border-amber-400 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Independiente de F. Entrega tabla</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
            {(order?.freight_transport_name || order?.freight_request_date || order?.freight_estimated_date) ? (
              <button
                type="button"
                onClick={() =>
                  onSuccess({
                    freight_transport_name: null,
                    freight_request_date: null,
                    freight_estimated_date: null
                  })
                }
                className="px-3 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold rounded-lg cursor-pointer"
              >
                Limpiar Flete
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Guardar Flete
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
