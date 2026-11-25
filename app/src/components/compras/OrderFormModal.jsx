import { useState, useEffect, useMemo } from 'react'
import { ShoppingCart, Plus, Trash2 } from 'lucide-react'
import { deduceUnitMeasure, normalizeUnitMeasure, formatUnitMeasureShort, resolveOrderMaterialUnit } from '../../lib/comprasConstants'
import { normalizeText } from '../../lib/allocationEngine'
import { savePurchaseOrdersFromModalService } from '../../services/comprasOcrSettingsService'
import { buildStandardShipWorkOrdersCatalog } from '../../lib/workOrderUnificationEngine'
import { resolveWorkerIdFromCatalog } from '../../lib/workerIdentity'
import CanonicalMaterialPicker from '../canonical/CanonicalMaterialPicker'
import FormulaNumericInput from '../canonical/FormulaNumericInput'
import { evaluateFormulaInput, buildCellFormulasPatch, getEditableCellInitialValue } from '../../lib/formulaEngine'
import { WorkOrderSelectorWithHover } from '../workOrders/WorkOrderSelectorWithHover'
import { CanonicalStepperModal, CanonicalStepperStep } from '../canonical/CanonicalStepperModal.jsx'
import { COMPRAS_ORDER_STEP_HELP } from '../../lib/businessHelpRegistry.js'
import { getTodayArIso } from '../../lib/dateTimeCanonical.js'

export default function OrderFormModal({
  order,
  ships,
  workOrders,
  workItems = [],
  suppliers,
  materials,
  workers,
  contractorGroups = [],
  currentFortnight,
  viewMode,
  isSupervisorOrAdmin,
  onClose,
  onSuccess
}) {
  // Encabezado
  const [chargeType, setChargeType] = useState(order?.charge_type || 'VIA_PANOL')
  const [orderDate, setOrderDate] = useState(order?.order_date || getTodayArIso())
  const [shipId, setShipId] = useState(order?.ship_id || '')
  const [workOrderId, setWorkOrderId] = useState(order?.work_order_id || '')
  const [urgency, setUrgency] = useState(order?.urgency || 'SIN_APURO')
  const [requestedByName, setRequestedByName] = useState(order?.requested_by_name || 'PAÑOL')

  // Renglones dinámicos de materiales (prioriza unidad oficial del Catálogo de Pañol)
  const [items, setItems] = useState(() => {
    if (order?.initialItems?.length > 0) {
      return order.initialItems.map((it) => ({
        material_id: it.material_id || null, material_name_raw: it.material_name_raw || '', is_new_material: false,
        quantity: it.quantity || 1, unit_measure: resolveOrderMaterialUnit(materials, it.material_id, it.material_name_raw, it.unit_measure),
        supplier_id: '', supplier_quoted_price: '', system_unit_price: 0, observations: ''
      }))
    }
    return [{
      material_id: order?.material_id || null, material_name_raw: order?.material_name_raw || '', is_new_material: order?.is_new_material || false,
      quantity: getEditableCellInitialValue(order, 'quantity', order?.quantity || 1), unit_measure: resolveOrderMaterialUnit(materials, order?.material_id, order?.material_name_raw, order?.unit_measure),
      supplier_id: order?.supplier_id || '', supplier_quoted_price: getEditableCellInitialValue(order, 'supplier_quoted_price', order?.supplier_quoted_price || ''),
      system_unit_price: order?.system_unit_price || 0, observations: order?.observations || ''
    }]
  })

  const [saving, setSaving] = useState(false)

  // Lista de personas habilitadas para retirar materiales y demás personal
  const { authorizedWorkers, otherWorkers } = useMemo(() => {
    const auth = []
    const others = []
    workers.forEach((w) => {
      if (w.can_withdraw_materials) auth.push(w)
      else others.push(w)
    })
    return { authorizedWorkers: auth, otherWorkers: others }
  }, [workers])

  // Filtrado estandarizado de OTs por Barco seleccionado
  const availableWorkOrders = useMemo(() => {
    if (!shipId) return []
    return buildStandardShipWorkOrdersCatalog(workOrders, workItems, { shipId, includeEliminated: false, includeClosed: true })
  }, [shipId, workOrders, workItems])

  // Barco seleccionado para el tooltip flotante canónico de OT
  const selectedShipObj = useMemo(() => ships.find((s) => s.id === shipId) || null, [ships, shipId])

  // Si cambia el destino a VIA_PANOL, fijar barco ASTILLERO y OT STOCK
  useEffect(() => {
    if (chargeType === 'VIA_PANOL') {
      const ast = ships.find((s) => s.name === 'ASTILLERO')
      if (ast) {
        setShipId(ast.id)
        const stockWo = workOrders.find((w) => w.ship_id === ast.id && w.title === 'STOCK')
        if (stockWo) setWorkOrderId(stockWo.id)
      }
    }
  }, [chargeType, ships, workOrders])

  function handleAddItem() {
    setItems([...items, {
      material_id: null, material_name_raw: '', is_new_material: false, quantity: 1,
      unit_measure: 'unidad', supplier_id: '', supplier_quoted_price: '', system_unit_price: 0, observations: ''
    }])
  }

  function handleRemoveItem(idx) {
    if (items.length === 1) return alert('Debe haber al menos un material en el pedido.')
    setItems(items.filter((_, i) => i !== idx))
  }

  function handleItemChange(idx, field, value) {
    const updated = [...items]
    updated[idx][field] = value

    if (field === 'material_name_raw') {
      const exactCatalogMatch = materials.find((m) => normalizeText(m.name) === normalizeText(value))
      if (exactCatalogMatch) {
        updated[idx].material_id = exactCatalogMatch.id
        updated[idx].is_new_material = false
        updated[idx].system_unit_price = exactCatalogMatch.cost_ars || 0
        updated[idx].unit_measure = normalizeUnitMeasure(exactCatalogMatch.unit_measure, exactCatalogMatch.name)
      } else {
        updated[idx].unit_measure = deduceUnitMeasure(value)
        updated[idx].material_id = null
        updated[idx].is_new_material = true
        updated[idx].system_unit_price = 0
      }
    }

    setItems(updated)
  }

  function handleSelectCatalogMaterial(idx, mat) {
    const updated = [...items]
    updated[idx].material_id = mat.id
    updated[idx].material_name_raw = mat.name
    updated[idx].is_new_material = false
    updated[idx].system_unit_price = mat.cost_ars || 0
    updated[idx].unit_measure = normalizeUnitMeasure(mat.unit_measure, mat.name)
    setItems(updated)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const astShipObj = ships.find((s) => (s.name || '').toUpperCase().includes('ASTILLERO'))
    if (chargeType === 'DIRECT' && (!shipId || (astShipObj && shipId === astShipObj.id))) {
      return alert('Para compras con destino DIRECTO debe seleccionar un Buque específico de obra (distinto de Astillero). La Orden de Trabajo (OT) puede quedar en blanco si aún no está abierta.')
    }

    for (let i = 0; i < items.length; i++) {
      const it = items[i]
      if (!it.material_name_raw.trim()) {
        return alert(`El renglón #${i + 1} no tiene nombre de material.`)
      }
      const parsedQty = evaluateFormulaInput(it.quantity, { allowNegative: false, maxDecimals: 4, emptyValue: 0 })
      if (!parsedQty.ok || (parsedQty.value || 0) <= 0) {
        return alert(`La cantidad del renglón #${i + 1} debe ser mayor a 0${parsedQty.error ? ` (${parsedQty.error})` : ''}.`)
      }
      if (it.supplier_quoted_price !== '' && it.supplier_quoted_price !== null && it.supplier_quoted_price !== undefined) {
        const parsedPrice = evaluateFormulaInput(it.supplier_quoted_price, { allowNegative: false, maxDecimals: 2, emptyValue: null })
        if (!parsedPrice.ok) {
          return alert(`Precio cotizado inválido en renglón #${i + 1}: ${parsedPrice.error}`)
        }
      }
    }

    setSaving(true)
    try {
      const resolvedRequestedById = resolveWorkerIdFromCatalog(
        requestedByName,
        workers,
        order?.requested_by_name === requestedByName ? order?.requested_by : null
      )
      const payloads = items.map((it) => {
        const parsedQty = evaluateFormulaInput(it.quantity, { allowNegative: false, maxDecimals: 4, emptyValue: 1 })
        const parsedPrice = evaluateFormulaInput(it.supplier_quoted_price, { allowNegative: false, maxDecimals: 2, emptyValue: null })
        let formulas = buildCellFormulasPatch(order?.cell_formulas, 'quantity', parsedQty.formula)
        formulas = buildCellFormulasPatch(formulas, 'supplier_quoted_price', parsedPrice.value !== null ? parsedPrice.formula : null)
        return {
          charge_type: chargeType,
          order_date: orderDate,
          ship_id: shipId || null,
          work_order_id: workOrderId || null,
          requested_by: resolvedRequestedById,
          requested_by_name: requestedByName,
          urgency,
          material_id: it.material_id,
          material_name_raw: it.material_name_raw.trim(),
          is_new_material: it.is_new_material,
          quantity: parsedQty.value ?? 1,
          unit_measure: it.unit_measure,
          supplier_id: it.supplier_id || null,
          supplier_quoted_price: parsedPrice.value !== null ? parsedPrice.value : null,
          system_unit_price: it.system_unit_price ? Number(it.system_unit_price) : 0,
          cell_formulas: formulas,
          status: 'PEDIR',
          observations: it.observations.trim() || null,
          fortnight_period: currentFortnight,
          updated_at: new Date().toISOString()
        }
      })

      const savedRows = await savePurchaseOrdersFromModalService({
        orderId: order?.id || null,
        payloads
      })
      onSuccess(savedRows)
    } catch (err) {
      console.error('Error guardando pedido:', err)
      alert('Error guardando pedido: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <CanonicalStepperModal
      isOpen={true}
      onClose={onClose}
      maxWidthClass="max-w-6xl"
      icon={
        <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30 font-bold">
          <ShoppingCart className="w-4 h-4" />
        </div>
      }
      title={order?.id ? 'Editar Pedido de Compra' : 'CARGAR MATERIALES A COMPRAR (MULTI-RENGLÓN)'}
      onSubmit={handleSubmit}
      footerLeft={
        <button type="button" onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer">
          Cancelar
        </button>
      }
      footerRight={
        <button type="submit" disabled={saving} className="px-5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl transition-all cursor-pointer shadow-lg shadow-emerald-500/20 disabled:opacity-50">
          {saving ? 'Guardando...' : order?.id ? 'Actualizar Pedido' : `Registrar ${items.length} Materiales`}
        </button>
      }
    >
      <CanonicalStepperStep
        step={1}
        helpEntry={COMPRAS_ORDER_STEP_HELP[1]}
        title="DESTINO E IMPUTACIÓN DEL PEDIDO"
        subtitle={chargeType === 'DIRECT' ? 'Destino ➔ Solicitante ➔ Buque ➔ OT' : 'Destino ➔ Solicitante'}
      >
        <div className={`grid grid-cols-1 gap-2.5 ${chargeType === 'DIRECT' ? 'md:grid-cols-4' : 'md:grid-cols-2'}`}>
          <div>
            <label className="block text-slate-400 mb-1 font-semibold text-[11px]">Destino del Pedido</label>
            <select autoFocus value={chargeType} onChange={(e) => setChargeType(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold focus:outline-none focus:border-cyan-400 text-xs">
              <option value="DIRECT">Carga Directa para Obra (Buque)</option>
              <option value="VIA_PANOL">Reposición de Stock (Pañol)</option>
              <option value="STANDBY">Stand-By en Depósito</option>
            </select>
          </div>

          <div>
            <label className="block text-slate-400 mb-1 font-semibold text-[11px]">Solicitante</label>
            <select value={requestedByName} onChange={(e) => setRequestedByName(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-cyan-400 cursor-pointer text-xs">
              <option value="PAÑOL">PAÑOL (Por Defecto)</option>
              <optgroup label="Personal Habilitado (Pañol)">
                {authorizedWorkers.map((w) => <option key={w.id} value={w.name}>{w.name} {w.trade ? `(${w.trade})` : ''}</option>)}
              </optgroup>
              {otherWorkers.length > 0 && (
                <optgroup label="Demás Personal de Nómina">
                  {otherWorkers.map((w) => <option key={w.id} value={w.name}>{w.name} {w.trade ? `(${w.trade})` : ''}</option>)}
                </optgroup>
              )}
              {contractorGroups.length > 0 && (
                <optgroup label="🏗️ Contratistas Externos">
                  {contractorGroups.map((grp) => <option key={`m_cnt_${grp}`} value={grp}>{grp}</option>)}
                </optgroup>
              )}
              <optgroup label="Sectores / Áreas Comunes">
                <option value="ADMINISTRACION">ADMINISTRACION</option>
                <option value="OFICINA TECNICA">OFICINA TECNICA</option>
                <option value="MANTENIMIENTO">MANTENIMIENTO</option>
                <option value="CALIDAD / SEGURIDAD">CALIDAD / SEGURIDAD</option>
              </optgroup>
              {requestedByName &&
                requestedByName !== 'PAÑOL' &&
                !authorizedWorkers.some((w) => w.name === requestedByName) &&
                !otherWorkers.some((w) => w.name === requestedByName) &&
                !['ADMINISTRACION', 'OFICINA TECNICA', 'MANTENIMIENTO', 'CALIDAD / SEGURIDAD'].includes(requestedByName) && (
                  <option value={requestedByName}>{requestedByName} (Actual)</option>
                )}
            </select>
          </div>

          {chargeType === 'DIRECT' && (
            <>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold text-[11px]">Buque / Obra <span className="text-rose-400">*</span></label>
                <select value={shipId} onChange={(e) => { setShipId(e.target.value); setWorkOrderId('') }} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold focus:outline-none focus:border-cyan-400 text-xs" required>
                  <option value="">-- Seleccionar Buque --</option>
                  {ships.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 mb-1 font-semibold text-[11px]">Orden de Trabajo (OT)</label>
                <WorkOrderSelectorWithHover
                  value={workOrderId}
                  onChange={(nextWoId) => setWorkOrderId(nextWoId)}
                  availableWos={availableWorkOrders}
                  ship={selectedShipObj}
                  workItems={workItems}
                  allWorkOrders={workOrders}
                  disabled={!shipId}
                  placeholder={!shipId ? '-- 1° elija buque --' : '-- ⚠️ Sin OT (Pendiente) --'}
                  showPreviewCard={false}
                />
              </div>
            </>
          )}
        </div>
      </CanonicalStepperStep>

      <CanonicalStepperStep
        step={2}
        helpEntry={COMPRAS_ORDER_STEP_HELP[2]}
        title={`INSUMOS Y MATERIALES A COMPRAR (${items.length})`}
        headerRight={
          <button type="button" tabIndex={-1} onClick={handleAddItem} className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-lg font-black text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow-sm">
            <Plus className="w-3.5 h-3.5 stroke-[3]" /><span>Agregar Material</span>
          </button>
        }
      >
        <div className="space-y-2 max-h-[38vh] overflow-y-auto pr-1">
          {items.map((it, idx) => (
            <div key={idx} className="p-2 rounded-xl bg-slate-950/70 border border-slate-800 space-y-1.5">
              <div className="grid grid-cols-1 md:grid-cols-12 gap-2 items-center">
                <div className={viewMode === 'completa' ? 'md:col-span-5 flex items-center gap-1.5' : 'md:col-span-8 flex items-center gap-1.5'}>
                  <span className="text-slate-500 font-mono text-xs w-5 text-center shrink-0">#{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <CanonicalMaterialPicker
                      materials={materials}
                      value={it.material_id || ''}
                      initialText={it.material_name_raw || ''}
                      allowFreeText
                      placeholder="Ej: CHAPA NAVAL 1/4', ELECTRODO CONARCO 7018..."
                      onChange={(matId, mat) => {
                        if (mat?.id) handleSelectCatalogMaterial(idx, mat)
                        else handleItemChange(idx, 'material_name_raw', mat?.name || '')
                      }}
                    />
                  </div>
                </div>

                <div className="md:col-span-2 flex items-center gap-1">
                  <div className="flex-1 min-w-0">
                    <FormulaNumericInput
                      variant="field"
                      maxDecimals={4}
                      unitSuffix={formatUnitMeasureShort(it.unit_measure)}
                      value={it.quantity}
                      onChange={(val) => handleItemChange(idx, 'quantity', val)}
                      placeholder="1 o =2+3"
                      className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-mono text-center font-bold focus:outline-none focus:border-cyan-400 text-xs"
                      required
                    />
                  </div>
                  <span className="text-[10px] text-cyan-300 font-bold shrink-0 px-1" title="Unidad oficial del Catálogo de Pañol">
                    {formatUnitMeasureShort(it.unit_measure)}
                  </span>
                </div>

                {viewMode === 'completa' && (
                  <>
                    <div className="md:col-span-2">
                      <select value={it.supplier_id} onChange={(e) => handleItemChange(idx, 'supplier_id', e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-cyan-400">
                        <option value="">-- Proveedor --</option>
                        {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="md:col-span-2">
                      <FormulaNumericInput
                        variant="field"
                        currencyPrefix="$"
                        maxDecimals={2}
                        placeholder="$/U AR$ o =..."
                        value={it.supplier_quoted_price}
                        onChange={(val) => handleItemChange(idx, 'supplier_quoted_price', val)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-white font-mono text-right text-xs focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </>
                )}

                <div className={viewMode === 'completa' ? 'md:col-span-1 flex justify-end' : 'md:col-span-2 flex justify-end'}>
                  <button
                    type="button"
                    tabIndex={-1}
                    disabled={items.length <= 1}
                    onClick={() => handleRemoveItem(idx)}
                    className={`p-1.5 rounded-lg hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 transition-colors ${items.length <= 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'}`}
                    title="Quitar renglón"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <input
                type="text"
                placeholder="Observaciones de este material (medida específica, espesor, aclaración para proveedor)..."
                value={it.observations}
                onChange={(e) => handleItemChange(idx, 'observations', e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-400"
              />
            </div>
          ))}
        </div>
      </CanonicalStepperStep>

      <CanonicalStepperStep step={3} helpEntry={COMPRAS_ORDER_STEP_HELP[3]} title="FECHA Y NIVEL DE URGENCIA" isLast={true}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold text-[11px]">Fecha del Pedido</label>
            <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} onDoubleClick={(e) => e.target.showPicker && e.target.showPicker()} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-cyan-400 cursor-pointer text-xs" title="Doble clic para abrir calendario" />
          </div>
          <div>
            <label className="block text-slate-400 mb-1 font-semibold text-[11px]">Nivel de Urgencia</label>
            <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-400 font-bold text-xs">
              <option value="SIN_APURO">🟢 Sin Apuro (Normal)</option>
              <option value="URGENTE">🔴 Urgente (Prioridad Alta)</option>
              <option value="PROXIMA_SALIDA">🟡 Próxima Salida de Buque</option>
            </select>
          </div>
        </div>
      </CanonicalStepperStep>
    </CanonicalStepperModal>
  )
}
