import { Bell, MessageSquare } from 'lucide-react'

export function SeCompraAlertModal({ order, alertSettings, ships, workOrders, onClose }) {
  const shp = ships.find((s) => s.id === order.ship_id)
  const wo = workOrders.find((w) => w.id === order.work_order_id)

  const hugo = alertSettings?.hugo || { name: 'Hugo Sentis', phone: '+5492235000001', email: 'hugo@aloncar.com', enabled: true }
  const martin = alertSettings?.martin || { name: 'Martín Sentis', phone: '+5492235000002', email: 'martin@aloncar.com', enabled: true }

  const shipName = shp?.name || 'ASTILLERO'
  const otTitle = wo?.title || 'Stock'

  const messageText = `Alerta Alon Car - Compra 'SE COMPRA?':\nMaterial: ${order.material_name_raw} (${order.quantity} ${order.unit_measure || 'un.'})\nBuque: ${shipName} | OT: ${otTitle}\nSolicita: ${order.requested_by_name || 'PAÑOL'}\nPor favor confirmar si se procede con la adquisición.`

  function handleSendWhatsApp(phone) {
    const clean = phone.replace(/[^0-9]/g, '')
    const url = `https://web.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(messageText)}`
    window.open(url, '_blank')
  }

  const recipients = [
    { data: hugo, role: 'Gerente General' },
    { data: martin, role: 'Gerente Operaciones' }
  ]

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-950 border border-pink-800 flex items-center justify-center text-pink-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                Alerta Gerencial: "SE COMPRA?"
              </h3>
              <p className="text-[11px] text-slate-400">
                La compra requiere evaluación y confirmación de jefatura antes de emitirse.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
          <p className="font-bold text-white text-sm">{order.material_name_raw}</p>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
            <span>Cantidad: <strong className="text-white">{order.quantity} {order.unit_measure || 'un.'}</strong></span>
            <span>Buque: <strong className="text-cyan-300">{shipName}</strong></span>
            <span>OT: <strong className="text-slate-200">{otTitle}</strong></span>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <p className="font-bold text-slate-300">Destinatarios Notificados:</p>

          {recipients.map(({ data, role }) =>
            data.enabled ? (
              <div key={role} className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-white">{data.name} ({role})</p>
                  <p className="text-[10px] text-slate-500 font-mono">{data.phone}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleSendWhatsApp(data.phone)}
                  className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                >
                  <MessageSquare className="w-3 h-3" />
                  <span>WhatsApp</span>
                </button>
              </div>
            ) : null
          )}

          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">Jefe de Obra OT</p>
              <p className="text-[10px] text-slate-500">Asignado al buque {shipName}</p>
            </div>
            <span className="text-[10px] text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
              Notificado
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold rounded-lg text-xs cursor-pointer shadow-md"
          >
            Entendido / Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
