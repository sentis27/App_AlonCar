import { useState, useMemo } from 'react'
import { Building2, RefreshCw, Save } from 'lucide-react'
import { assignSupplierBatchService } from '../../services/comprasAuxService'

export function AssignSupplierModal({ selectedOrderIds, suppliers, onClose, onSuccess }) {
  const [searchText, setSearchText] = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || '')
  const [saving, setSaving] = useState(false)

  const filteredSuppliers = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter((s) => {
      const nameMatch = (s.name || '').toLowerCase().includes(q)
      const tradeMatch = (s.trade || '').toLowerCase().includes(q) || (s.trades || []).some((t) => t.toLowerCase().includes(q))
      return nameMatch || tradeMatch
    })
  }, [suppliers, searchText])

  async function handleAssign(e) {
    e.preventDefault()
    if (!selectedSupplierId) return alert('Por favor selecciona un proveedor.')

    setSaving(true)
    try {
      const supName = suppliers.find((s) => s.id === selectedSupplierId)?.name || 'Proveedor'
      await assignSupplierBatchService({
        orderIds: Array.from(selectedOrderIds),
        supplierId: selectedSupplierId,
        supplierName: supName
      })
      onSuccess(selectedSupplierId)
    } catch (err) {
      console.error('Error asignando proveedor en lote:', err)
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                Asignar Proveedor en Bloque
              </h3>
              <p className="text-[11px] text-slate-400">
                Se aplicará el proveedor elegido a los {selectedOrderIds.size} pedidos seleccionados.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        <form onSubmit={handleAssign} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Filtrar Proveedor por Nombre o Rubro
            </label>
            <input
              type="text"
              autoFocus
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value)
                const q = e.target.value.trim().toLowerCase()
                const firstMatch = suppliers.find((s) => (s.name || '').toLowerCase().includes(q))
                if (firstMatch) setSelectedSupplierId(firstMatch.id)
              }}
              placeholder="Escribir iniciales (ej: FER, AIR, PRAX...)"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white mb-2 focus:outline-none focus:border-cyan-500"
            />

            <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
              Resultados ({filteredSuppliers.length}):
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-semibold focus:outline-none focus:border-cyan-500"
              required
            >
              {filteredSuppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.trade || (s.trades && s.trades.join(', ')) || 'General'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{saving ? 'Asignando...' : `Asignar a ${selectedOrderIds.size} Pedidos`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
