import { useState, useMemo } from 'react'

export function ReconcileModal({ target, purchaseOrders, onClose, onSuccess }) {
  const isDetailMode = target?.mode === 'detail'
  const isSelectedMode = target?.mode === 'selected'
  const [invoiceNumber, setInvoiceNumber] = useState(target?.currentInvoice || '')
  const [reconcileAllPrior, setReconcileAllPrior] = useState(!isSelectedMode && !isDetailMode)

  const eligibleOrders = useMemo(() => {
    if (isSelectedMode && Array.isArray(target?.selectedIds)) {
      return purchaseOrders.filter((po) => target.selectedIds.includes(po.id))
    }
    if (isDetailMode) {
      return purchaseOrders.filter((po) => po.id === target.orderId)
    }
    return purchaseOrders.filter((po) => {
      if (target.supplierId && po.supplier_id !== target.supplierId) return false
      if (po.is_reconciled) return false
      if (reconcileAllPrior) return po.order_date <= target.orderDate
      return po.id === target.orderId
    })
  }, [purchaseOrders, target, reconcileAllPrior, isSelectedMode, isDetailMode])

  function handleSubmit(e) {
    e.preventDefault()
    if (!invoiceNumber.trim()) return alert('Debe ingresar el número de factura o remito.')
    onSuccess({
      invoiceNumber: invoiceNumber.trim(),
      orderIds: eligibleOrders.map((o) => o.id),
      action: 'reconcile'
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-purple-400">🟣</span>
              {isDetailMode ? 'Detalle de Conciliación' : 'Conciliación con Factura'}
            </h3>
            <p className="text-xs text-slate-400">
              {isSelectedMode
                ? `Aplicación masiva sobre ${eligibleOrders.length} fila(s) seleccionada(s)`
                : `Auditoría contable para ${target.supplierName || 'Proveedor'}`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        {isDetailMode && (
          <div className="bg-purple-950/40 border border-purple-700/60 rounded-xl p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-purple-300 font-bold">Estado actual:</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-600/30 text-purple-200 font-bold text-[10px]">
                🟣 CONCILIADO
              </span>
            </div>
            <p className="text-slate-300">
              Comprobante: <strong className="text-white font-mono">{target.currentInvoice || 'S/N'}</strong>
            </p>
            {target.reconciledAt && (
              <p className="text-[11px] text-slate-400">
                Fecha: {new Date(target.reconciledAt).toLocaleString('es-AR')}
                {target.reconciledBy ? ` • Por: ${target.reconciledBy}` : ''}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">
              {isDetailMode ? 'Modificar Número de Factura o Remito' : 'Número de Factura o Remito Proveedor'}
            </label>
            <input
              type="text"
              placeholder="Ej: FC-A-0004-9844"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono uppercase focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          {!isSelectedMode && !isDetailMode && target.supplierId && (
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={reconcileAllPrior}
                  onChange={(e) => setReconcileAllPrior(e.target.checked)}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <span>Conciliar hasta aquí (incluir todas las anteriores pendientes del proveedor)</span>
              </label>
              <p className="text-[11px] text-purple-300">
                Se marcarán <strong className="text-white">{eligibleOrders.length} compras</strong> de este proveedor como
                conciliadas bajo este comprobante.
              </p>
            </div>
          )}

          {isSelectedMode && (
            <div className="bg-purple-950/30 p-3 rounded-xl border border-purple-800/60 space-y-1.5">
              <p className="text-[11px] text-purple-200 font-semibold">
                Se aplicará la conciliación a las <strong className="text-white">{eligibleOrders.length} filas tildadas</strong>:
              </p>
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                {eligibleOrders.map((po) => (
                  <div key={po.id} className="flex items-center justify-between text-[10px] text-slate-300 bg-slate-950/70 px-2 py-1 rounded">
                    <span className="truncate font-semibold">{po.material_name}</span>
                    <span className="text-slate-400 font-mono shrink-0 ml-2">{po.supplier?.name || 'S/Prov'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
            {isDetailMode ? (
              <button
                type="button"
                onClick={() =>
                  onSuccess({
                    invoiceNumber: null,
                    orderIds: [target.orderId],
                    action: 'unreconcile'
                  })
                }
                className="px-3 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold rounded-lg cursor-pointer"
              >
                Quitar Conciliación
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={eligibleOrders.length === 0}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer"
              >
                {isDetailMode ? 'Actualizar Comprobante' : `Confirmar (${eligibleOrders.length})`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
