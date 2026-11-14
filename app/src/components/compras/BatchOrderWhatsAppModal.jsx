import { useState, useMemo } from 'react'
import { MessageSquare, CheckCircle2, Phone } from 'lucide-react'
import { formatArgPhoneForWhatsApp } from '../../lib/comprasConstants'
import { groupOrdersBySupplier, buildBatchOrderWhatsAppText } from '../../lib/comprasAuxHelpers'
import { emitWhatsAppOrdersService } from '../../services/comprasAuxService'

export function BatchOrderWhatsAppModal({ selectedOrderIds, purchaseOrders, suppliers, systemSettings, onClose, onSuccess }) {
  const buyer1 = systemSettings?.buyer_1 || { name: 'Jorge Sentis', phone: '+5492235000001', is_active: true }
  const buyer2 = systemSettings?.buyer_2 || { name: 'Andrés', phone: '+5492235000002', is_active: true }

  const [selectedBuyer, setSelectedBuyer] = useState('buyer_1')
  const activeBuyer = selectedBuyer === 'buyer_1' ? buyer1 : buyer2

  const batchData = useMemo(
    () => groupOrdersBySupplier(selectedOrderIds, purchaseOrders, suppliers),
    [selectedOrderIds, purchaseOrders, suppliers]
  )

  async function handleEmitOrder(supplier, items) {
    const rawPhone = supplier.phone || ''
    const isLandlineOr0810 = rawPhone.startsWith('0810') || rawPhone.startsWith('0800')

    if (isLandlineOr0810) {
      alert(`El proveedor ${supplier.name} opera con línea fija / 0810 (${rawPhone}). Utilice el botón de llamada telefónica.`)
      return
    }

    const cleanFormatted = formatArgPhoneForWhatsApp(rawPhone)
    const encodedText = buildBatchOrderWhatsAppText(supplier.name, items, activeBuyer)
    const url = cleanFormatted
      ? `https://api.whatsapp.com/send?phone=${cleanFormatted}&text=${encodedText}`
      : `https://api.whatsapp.com/send?text=${encodedText}`

    try {
      const ids = await emitWhatsAppOrdersService({ items, supplierName: supplier.name })
      window.open(url, '_blank')
      onSuccess(ids)
    } catch (err) {
      alert('Error al emitir pedido: ' + err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              Emitir Pedidos Agrupados por WhatsApp
            </h3>
            <p className="text-xs text-slate-400">
              Seleccione el comprador emisor. Los pedidos se agrupan automáticamente por proveedor.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
          <label className="block text-slate-400 font-semibold text-xs">
            Seleccionar Comprador Emisor (Firma el mensaje):
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              { key: 'buyer_1', data: buyer1, defaultRole: 'Administración', activeCls: 'bg-cyan-950 border-cyan-500 text-white', iconCls: 'text-cyan-400' },
              { key: 'buyer_2', data: buyer2, defaultRole: 'Pañol', activeCls: 'bg-blue-950 border-blue-500 text-white', iconCls: 'text-blue-400' }
            ].map(({ key, data, defaultRole, activeCls, iconCls }) => (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedBuyer(key)}
                className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                  selectedBuyer === key ? activeCls : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                }`}
              >
                <div>
                  <p className="font-bold text-xs">{data.name}</p>
                  <p className="text-[10px] text-slate-400">{data.role || defaultRole} • {data.phone}</p>
                </div>
                {selectedBuyer === key && <CheckCircle2 className={`w-4 h-4 ${iconCls}`} />}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
          {batchData.map(({ supplier, items }) => {
            const rawPhone = supplier.phone || ''
            const is0810 = rawPhone.startsWith('0810') || rawPhone.startsWith('0800')

            return (
              <div key={supplier.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm">{supplier.name}</h4>
                    <p className="text-[10px] text-slate-400">
                      {supplier.phone ? `Tel: ${supplier.phone}` : '⚠️ Sin teléfono registrado'}
                      {supplier.client_number && ` • N° Cliente: ${supplier.client_number}`}
                    </p>
                  </div>

                  {is0810 ? (
                    <a
                      href={`tel:${rawPhone.replace(/[^0-9]/g, '')}`}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Llamar al {rawPhone}</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleEmitOrder(supplier, items)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Abrir WhatsApp ({items.length} ítems)</span>
                    </button>
                  )}
                </div>

                <ul className="divide-y divide-slate-850 text-xs text-slate-300">
                  {items.map((it) => (
                    <li key={it.id} className="py-1 flex items-center justify-between">
                      <span>{it.material_name_raw}</span>
                      <span className="font-mono text-cyan-400 font-bold">
                        {it.quantity} {it.unit_measure || 'unidades'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
