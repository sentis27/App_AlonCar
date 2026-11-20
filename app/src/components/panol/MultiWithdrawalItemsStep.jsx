import { Plus, Trash2 } from 'lucide-react'
import { isGasMaterial } from '../../lib/panolConstants'
import { evaluateFormulaInput } from '../../lib/formulaEngine'
import CanonicalMaterialPicker from '../canonical/CanonicalMaterialPicker.jsx'
import FormulaNumericInput from '../canonical/FormulaNumericInput.jsx'
import MaterialThumbnailZoom from './MaterialThumbnailZoom.jsx'
import { GasDeliveryInlinePanel } from './GasDeliveryInlinePanel.jsx'

/**
 * Paso 2 del Stepper Vertical de Retiro Multi-Material:
 * Matriz de insumos con miniatura ampliable a 5cm×5cm, CanonicalMaterialPicker y trazabilidad de gases.
 */
export default function MultiWithdrawalItemsStep({
  items,
  materials,
  gasSuppliers,
  gasStats,
  contractorGroup,
  isAdmin,
  onAddItem,
  onRemoveItem,
  onItemChange
}) {
  return (
    <div className="flex-1 min-w-0 space-y-2.5 pb-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-black text-white uppercase tracking-wider text-xs">
          INSUMOS Y MATERIALES RETIRADOS ({items.length})
        </span>
        <button
          type="button"
          tabIndex={-1}
          onClick={onAddItem}
          className="px-2.5 py-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-[11px] flex items-center gap-1 cursor-pointer transition-colors shadow-sm"
        >
          <Plus className="w-3.5 h-3.5 stroke-[3]" />
          <span>Agregar Material</span>
        </button>
      </div>

      <div className="space-y-2 max-h-[34vh] overflow-y-auto pr-1">
        {items.map((item, idx) => {
          const mat = materials.find((m) => m.id === item.material_id)
          const rowIsGas = isGasMaterial(mat)
          const parsedQty = evaluateFormulaInput(item.quantity, { allowNegative: false, maxDecimals: 4, emptyValue: 0 })
          const numericQty = parsedQty.ok && parsedQty.value !== null ? parsedQty.value : 0
          const weightRow = ((Number(mat?.weight_kg) || 0) * numericQty).toFixed(2)

          return (
            <div
              key={idx}
              className={`p-2 rounded-xl bg-slate-900/70 border ${rowIsGas ? 'border-amber-500/50' : 'border-slate-800'}`}
            >
              <div className="flex flex-col md:flex-row items-center gap-2">
                <div className="flex items-center gap-1.5 shrink-0">
                  <MaterialThumbnailZoom material={mat} size="md" />
                  <span className="text-slate-500 font-mono text-xs w-5 text-center">#{idx + 1}</span>
                </div>

                <div className="flex-1 w-full min-w-[220px]">
                  <CanonicalMaterialPicker
                    materials={materials}
                    value={item.material_id}
                    onChange={(mId) => onItemChange(idx, 'material_id', mId)}
                  />
                </div>

                <div className="w-28 shrink-0 flex items-start gap-1">
                  <div className="w-20">
                    <FormulaNumericInput
                      variant="field"
                      maxDecimals={rowIsGas ? 0 : 4}
                      unitSuffix={mat?.unit_measure || 'un.'}
                      placeholder="Cant."
                      value={item.quantity}
                      onChange={(val) => onItemChange(idx, 'quantity', val)}
                      required
                      title="Cantidad o fórmula (=1*0.5, +42+45)"
                      className="w-full px-2 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-center font-bold focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold truncate pt-2">{mat?.unit_measure || 'un.'}</span>
                </div>

                <div className="w-20 shrink-0 text-center font-mono text-slate-400 text-[11px]">
                  <span className="block font-bold text-slate-200">{weightRow} kg</span>
                  <span className="text-[9px] text-slate-500">({mat?.weight_kg || 0} c/u)</span>
                </div>

                <div className="w-28 shrink-0">
                  <select
                    value={item.customCostCenter || 'CLIENTE'}
                    disabled={!isAdmin}
                    onChange={(e) => onItemChange(idx, 'customCostCenter', e.target.value)}
                    className={`w-full px-2 py-1.5 rounded-lg text-[11px] font-bold border ${
                      !isAdmin
                        ? 'bg-slate-950 border-slate-800 text-cyan-400 opacity-90 cursor-not-allowed'
                        : 'bg-slate-950 border-cyan-500/70 text-cyan-300'
                    }`}
                    title={!isAdmin ? 'Deducido automáticamente (Solo Admin puede modificar)' : 'Centro de Costo'}
                  >
                    <option value="CLIENTE">CLIENTE</option>
                    <option value="CONTRATISTA">CONTRATISTA</option>
                  </select>
                </div>

                <button
                  type="button"
                  tabIndex={-1}
                  disabled={items.length <= 1}
                  onClick={() => onRemoveItem(idx)}
                  className={`p-1.5 rounded-lg hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 transition-colors shrink-0 ${
                    items.length <= 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                  }`}
                  title="Quitar renglón"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {rowIsGas && (
                <GasDeliveryInlinePanel
                  item={item}
                  gasSuppliers={gasSuppliers}
                  gasStats={gasStats}
                  contractorGroup={contractorGroup}
                  onChangeField={(field, val) => onItemChange(idx, field, val)}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
