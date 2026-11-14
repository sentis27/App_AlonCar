import { Building2, CheckCircle2, MessageSquare, XCircle } from 'lucide-react'
import GridStatusBarBottom from '../GridStatusBarBottom'

export default function ComprasPedidosStatusBar({
  filteredCount,
  totalCount,
  hasActiveFilters,
  onClearFilters,
  selectionStats,
  onClearGridSelection,
  selectedOrderIds,
  onClearSelectedOrders,
  viewMode,
  stats,
  purchaseOrders,
  suppliers,
  batchTargetStatus,
  setBatchTargetStatus,
  onOpenBatchWhatsApp,
  onOpenAssignSupplier,
  onBatchDismissCatalogAlta,
  onOpenReconcileSelected,
  onOpenMandadosSelected,
  onBatchStatusApply
}) {
  return (
    <GridStatusBarBottom
      filteredCount={filteredCount}
      totalCount={totalCount}
      entityName="pedidos"
      hasActiveFilter={hasActiveFilters}
      onClearFilters={onClearFilters}
      selectionStats={selectionStats}
      onClearSelection={onClearGridSelection}
      customSelection={
        selectedOrderIds.size > 0
          ? {
              count: selectedOrderIds.size,
              label: 'pedidos tildados',
              onClear: onClearSelectedOrders
            }
          : null
      }
      globalAggregates={[
        { label: 'Σ Cant', value: stats.sumQty },
        ...(viewMode === 'completa'
          ? [
              { label: 'Σ AR$', value: `$${stats.sumCostArs.toLocaleString('es-AR')}`, highlight: true },
              { label: 'Σ US$', value: `$${stats.sumCostUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
              { label: 'Ø', value: `$${Math.round(stats.avgPriceArs).toLocaleString('es-AR')}` }
            ]
          : [])
      ]}
      extraActions={
        selectedOrderIds.size > 0 ? (
          <div className="flex flex-wrap items-center gap-2">
            {viewMode === 'completa' && (
              <>
                <button
                  type="button"
                  onClick={onOpenBatchWhatsApp}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold rounded-lg text-xs shadow-md shadow-blue-500/20 transition-all cursor-pointer"
                  title="Abrir WhatsApp agrupado por proveedor"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Pedir Agrupado ({selectedOrderIds.size})</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenAssignSupplier}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-cyan-500/50 text-cyan-300 font-bold rounded-lg text-xs shadow-md transition-all cursor-pointer"
                  title="Asignar rápidamente un proveedor a los pedidos seleccionados"
                >
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Asignar Proveedor ({selectedOrderIds.size})</span>
                </button>

                <button
                  type="button"
                  onClick={onBatchDismissCatalogAlta}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-rose-950/70 border border-rose-500/40 text-rose-300 font-bold rounded-lg text-xs shadow-md transition-all cursor-pointer"
                  title="Marcar que los materiales seleccionados NO requieren alta en catálogo"
                >
                  <XCircle className="w-3.5 h-3.5 text-rose-400" />
                  <span>Omitir Alta Catálogo ({selectedOrderIds.size})</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const selectedRows = purchaseOrders.filter((p) => selectedOrderIds.has(p.id))
                    const firstRow = selectedRows[0]
                    const sup = suppliers.find((s) => s.id === firstRow?.supplier_id)
                    onOpenReconcileSelected({
                      mode: 'selected',
                      selectedIds: Array.from(selectedOrderIds),
                      supplierId: firstRow?.supplier_id || null,
                      orderId: firstRow?.id || null,
                      orderDate: firstRow?.order_date || new Date().toISOString().split('T')[0],
                      supplierName: sup?.name || 'Filas Seleccionadas',
                      existingInvoice: firstRow?.invoice_number || ''
                    })
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs shadow-md shadow-purple-600/25 transition-all cursor-pointer"
                  title="Desplegar menú de conciliación para las filas seleccionadas"
                >
                  <span>🟣</span>
                  <span>Conciliar ({selectedOrderIds.size})</span>
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onOpenMandadosSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-950/90 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-200 font-bold rounded-lg text-xs shadow-md shadow-cyan-900/30 transition-all cursor-pointer"
              title="Generar orden de retiro para mandadero"
            >
              <span>🛵</span>
              <span>Mandar a Retirar ({selectedOrderIds.size})</span>
            </button>

            <div className="flex items-center gap-1.5 bg-slate-900/90 border border-slate-700 rounded-lg p-1 shadow-md">
              <span className="text-[11px] text-slate-400 font-semibold pl-1">🏷️ Estado:</span>
              <select
                value={batchTargetStatus}
                onChange={(e) => setBatchTargetStatus(e.target.value)}
                className="bg-slate-950 border border-slate-700 hover:border-cyan-500 focus:border-cyan-500 rounded px-2 py-1 text-xs font-bold text-white focus:outline-none cursor-pointer"
              >
                <option value="PEDIR">PEDIR (Por emitir)</option>
                <option value="PEDIDO">PEDIDO (En proveedor)</option>
                <option value="RECIBIDO">RECIBIDO (Stock / Pañol)</option>
                <option value="RECIB.COMP.DIRECT">RECIB.COMP.DIRECT (Directo a obra)</option>
              </select>
              <button
                type="button"
                onClick={onBatchStatusApply}
                className={`flex items-center gap-1.5 px-3 py-1 text-white font-bold rounded-md text-xs shadow-md transition-all cursor-pointer ${
                  batchTargetStatus === 'RECIB.COMP.DIRECT'
                    ? 'bg-amber-600 hover:bg-amber-500 shadow-amber-600/20'
                    : batchTargetStatus === 'RECIBIDO'
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-emerald-600/20'
                    : batchTargetStatus === 'PEDIDO'
                    ? 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/20'
                    : 'bg-cyan-600 hover:bg-cyan-500 shadow-cyan-600/20'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Aplicar a ({selectedOrderIds.size})</span>
              </button>
            </div>
          </div>
        ) : null
      }
    />
  )
}
