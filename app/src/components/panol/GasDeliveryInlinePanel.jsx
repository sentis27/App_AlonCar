import { Flame, AlertCircle } from 'lucide-react'
import { PANOL_GAS_OPERATION_TYPES } from '../../lib/panolConstants'

/**
 * Subpanel inline (Progressive Disclosure SKL-012) para entregas de materiales de rubro Gases.
 * Conecta el retiro de Pañol con la trazabilidad de cilindros/marcas en `gas_cylinder_movements` (doble imputación).
 */
export function GasDeliveryInlinePanel({
  item,
  gasSuppliers = [],
  gasStats = null,
  contractorGroup = '',
  onChangeField
}) {
  const opType = item.gasOperationType || 'PRIMERA_ENTREGA'
  const isRecambio = opType === 'RECAMBIO_1X1'
  const contractorHeld = contractorGroup
    ? (gasStats?.contractorDebts?.[contractorGroup]?.totalHeld ?? gasStats?.contractorDebts?.[contractorGroup.toUpperCase()]?.totalHeld ?? null)
    : null

  return (
    <div className="mt-2 p-2.5 rounded-lg bg-amber-950/25 border border-amber-500/40 space-y-2 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-500/20 pb-1.5">
        <span className="font-black text-amber-300 uppercase tracking-wider text-[10px] flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5 text-amber-400" />
          <span>Datos de Entrega de Gas / Cilindro Retornable (Doble Imputación)</span>
        </span>
        <div className="flex items-center gap-2 text-[10px]">
          {contractorHeld !== null && (
            <span className="px-2 py-0.5 rounded bg-slate-900 border border-amber-500/40 text-amber-200 font-mono font-bold">
              Deuda actual {contractorGroup}: {contractorHeld} tubo(s)
            </span>
          )}
          <span className="text-slate-400">
            Devolución final sin retiro: pestaña <strong className="text-amber-300">Control de Gases</strong>
          </span>
        </div>
      </div>

      {gasSuppliers.length === 0 ? (
        <div className="flex items-center gap-2 text-rose-300 text-[11px] font-semibold">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>No hay proveedores marcados como proveedor de gas (`is_gas_supplier`) en Compras/Proveedores.</span>
        </div>
      ) : (
        <div className={`grid grid-cols-1 gap-2 ${isRecambio ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
          <div>
            <label className="block text-[10px] font-bold text-slate-300 mb-1">
              Tipo de Entrega de Tubo <span className="text-rose-400">*</span>
            </label>
            <select
              value={opType}
              onChange={(e) => {
                const nextOp = e.target.value
                onChangeField('gasOperationType', nextOp)
                if (nextOp !== 'RECAMBIO_1X1') {
                  onChangeField('supplierReturnedId', '')
                }
              }}
              className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-amber-500/50 text-amber-300 font-bold text-xs focus:outline-none focus:border-cyan-400"
            >
              {PANOL_GAS_OPERATION_TYPES.map((op) => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold text-slate-300 mb-1">
              Marca / Proveedor Entregada (Lleno) <span className="text-rose-400">*</span>
            </label>
            <select
              value={item.supplierDeliveredId || ''}
              onChange={(e) => onChangeField('supplierDeliveredId', e.target.value)}
              required
              className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:border-cyan-400"
            >
              <option value="">-- Seleccionar Marca Entregada --</option>
              {gasSuppliers.map((s) => {
                const fullCount = gasStats?.patioStock?.[s.id]?.full
                return (
                  <option key={s.id} value={s.id}>
                    {s.name}{typeof fullCount === 'number' ? ` (Patio llenos: ${fullCount})` : ''}
                  </option>
                )
              })}
            </select>
          </div>

          {isRecambio && (
            <div>
              <label className="block text-[10px] font-bold text-slate-300 mb-1">
                Marca / Proveedor Devuelta (Vacío) <span className="text-rose-400">*</span>
              </label>
              <select
                value={item.supplierReturnedId || ''}
                onChange={(e) => onChangeField('supplierReturnedId', e.target.value)}
                required
                className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:border-cyan-400"
              >
                <option value="">-- Seleccionar Marca Devuelta --</option>
                {gasSuppliers.map((s) => {
                  const emptyCount = gasStats?.patioStock?.[s.id]?.empty
                  return (
                    <option key={s.id} value={s.id}>
                      {s.name}{typeof emptyCount === 'number' ? ` (Patio vacíos: ${emptyCount})` : ''}
                    </option>
                  )
                })}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
