import { useState, useEffect, useMemo } from 'react'
import { Lightbulb, Phone, RefreshCw, Zap, AlertCircle } from 'lucide-react'
import { STANDARD_TRADES } from '../../lib/comprasConstants'
import { computeMaterialSupplierHistory, computeTradeSuppliers } from '../../lib/comprasAuxHelpers'

function SupplierSuggestionCard({ entry, mode, selectedTrade, applyingId, onApply }) {
  return (
    <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-amber-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className={`${mode === 'material' ? 'space-y-1.5' : 'space-y-1 text-xs'} flex-1 min-w-0`}>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-bold text-white ${mode === 'material' ? 'text-xs' : ''}`}>{entry.supplier.name}</span>
          {entry.supplier.is_local_supplier && (
            <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 text-[9px] font-bold">
              Local MDP
            </span>
          )}
          {entry.supplier.phone && (
            <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
              {mode === 'material' ? (
                <>
                  <Phone className="w-2.5 h-2.5 text-cyan-400" />
                  {entry.supplier.phone}
                </>
              ) : (
                `📞 ${entry.supplier.phone}`
              )}
            </span>
          )}
        </div>

        {mode === 'material' ? (
          <div className="space-y-0.5">
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span className="text-amber-400 font-bold">
                {entry.count} de {entry.totalMatches} compra(s) ({entry.percentage}% de frecuencia)
              </span>
              {entry.lastPrice && (
                <span className="text-emerald-400 font-bold">
                  Último: ${Number(entry.lastPrice).toLocaleString('es-AR')} {entry.lastDate ? `(${entry.lastDate})` : ''}
                </span>
              )}
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                style={{ width: `${entry.percentage}%` }}
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>{entry.count} compra(s) en {selectedTrade}</span>
            {entry.lastPrice && (
              <span className="text-emerald-400 font-bold">
                Ref: ${Number(entry.lastPrice).toLocaleString('es-AR')}
              </span>
            )}
          </div>
        )}

        {entry.supplier.address && (
          <p className="text-[10px] text-slate-500 truncate">📍 {entry.supplier.address}</p>
        )}
      </div>

      <button
        type="button"
        disabled={applyingId === entry.supplier.id}
        onClick={() => onApply(entry)}
        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 shrink-0 transition-all cursor-pointer disabled:opacity-50"
      >
        {applyingId === entry.supplier.id ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <Zap className="w-3.5 h-3.5 fill-slate-950" />
        )}
        <span>⚡ Cargar Pedido</span>
      </button>
    </div>
  )
}

export function SupplierHelperModal({ order, purchaseOrders, suppliers, onClose, onApply }) {
  const [activeTab, setActiveTab] = useState('material')
  const [selectedTrade, setSelectedTrade] = useState('')
  const [searchDesc, setSearchDesc] = useState('')
  const [applyingId, setApplyingId] = useState(null)

  const { materialHistory, totalMaterialMatches } = useMemo(
    () => computeMaterialSupplierHistory(order, purchaseOrders, suppliers),
    [order, purchaseOrders, suppliers]
  )

  useEffect(() => {
    if (materialHistory.length === 0 && activeTab === 'material') {
      setActiveTab('trade')
    }
  }, [materialHistory, activeTab])

  const tradeSuppliers = useMemo(
    () => computeTradeSuppliers(selectedTrade, suppliers, purchaseOrders, searchDesc),
    [selectedTrade, suppliers, purchaseOrders, searchDesc]
  )

  async function handleFastLoad(entry) {
    setApplyingId(entry.supplier.id)
    const today = new Date().toISOString().split('T')[0]
    const updates = {
      supplier_id: entry.supplier.id,
      order_date: order.order_date || today,
      supplier_quoted_price: entry.lastPrice ?? order.supplier_quoted_price ?? null,
      system_unit_price: entry.lastPrice ?? order.system_unit_price ?? null
    }
    await onApply(order.id, updates)
    setApplyingId(null)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl animate-in fade-in duration-150">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
              <Lightbulb className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Asistente Inteligente de Proveedores
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-300 uppercase font-black">
                  Frecuencia & Métricas
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Material solicitado:{' '}
                <strong className="text-white font-mono">{order.material_name_raw || 'Sin material especificado'}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg cursor-pointer">✕</button>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2 text-xs">
          {[
            { id: 'material', label: 'Histórico del Material', badge: totalMaterialMatches },
            { id: 'trade', label: 'Buscar por Rubro de Proveedor' }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
                  activeTab === tab.id ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'
                }`}>
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {activeTab === 'material' && (
          <div className="space-y-3">
            {materialHistory.length > 0 ? (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {materialHistory.map((entry) => (
                  <SupplierSuggestionCard
                    key={entry.supplier.id}
                    entry={entry}
                    mode="material"
                    applyingId={applyingId}
                    onApply={handleFastLoad}
                  />
                ))}
              </div>
            ) : (
              <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 text-center space-y-2">
                <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                <p className="text-xs text-white font-bold">No hay compras previas registradas para este material exacto.</p>
                <p className="text-[11px] text-slate-400">
                  Usa la pestaña <strong>"Buscar por Rubro de Proveedor"</strong> para sugerir proveedores del sector según su frecuencia de compra.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'trade' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">1. Seleccionar Rubro del Proveedor</label>
                <select
                  value={selectedTrade}
                  onChange={(e) => setSelectedTrade(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-bold focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Seleccionar Rubro --</option>
                  {STANDARD_TRADES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">2. Descripción / Filtro Opcional</label>
                <input
                  type="text"
                  placeholder="Ej: planchuela, bulón, electrodo..."
                  value={searchDesc}
                  onChange={(e) => setSearchDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {selectedTrade ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {tradeSuppliers.length > 0 ? (
                  tradeSuppliers.map((entry) => (
                    <SupplierSuggestionCard
                      key={entry.supplier.id}
                      entry={entry}
                      mode="trade"
                      selectedTrade={selectedTrade}
                      applyingId={applyingId}
                      onApply={handleFastLoad}
                    />
                  ))
                ) : (
                  <p className="p-4 text-center text-xs text-slate-500 italic">
                    No se encontraron proveedores registrados con el rubro "{selectedTrade}".
                  </p>
                )}
              </div>
            ) : (
              <p className="p-4 text-center text-xs text-slate-500 italic">
                Selecciona un rubro arriba para ver los proveedores sugeridos y sus métricas de compra.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
          <span className="text-[11px] text-slate-500">
            💡 Asigna proveedor y último precio registrado. Soporta Ctrl+Z para deshacer.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
