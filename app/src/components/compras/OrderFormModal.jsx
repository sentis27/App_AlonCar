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
  const [orderDate, setOrderDate] = useState(order?.order_date || new Date().toISOString().split('T')[0])
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
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="alon-modal-card max-w-5xl">
        <div className="alon-modal-header">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30 font-bold shrink-0">
              <ShoppingCart className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white truncate">
                {order?.id ? 'Editar Pedido de Compra' : 'Cargar Materiales (Multi-Renglón por OT / Obra)'}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Recorrido guiado por color y tecla <strong className="text-slate-200">Tab</strong>: 1° Destino/OT ➔ 2° Parámetros ➔ 3° Matriz de Materiales.
              </p>
            </div>
          </div>
          <button type="button" tabIndex={-1} onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
          <div className="alon-modal-body">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
              {/* COLUMNA IZQUIERDA: BLOQUES 1 Y 2 */}
              <div className="space-y-3">
                {/* BLOQUE 1: DESTINO E IMPUTACIÓN DE OBRA */}
                <div className="alon-chunk-sky space-y-2.5">
                  <div className="flex items-center justify-between border-b border-sky-500/20 pb-1">
                    <span className="font-black text-sky-400 uppercase tracking-wider text-[11px]">
                      1. Destino e Imputación de Obra
                    </span>
                    <span className="text-[10px] text-slate-400">Origen de imputación</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold text-[11px]">Destino del Pedido</label>
                      <select
                        autoFocus
                        value={chargeType}
                        onChange={(e) => setChargeType(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold focus:outline-none focus:border-cyan-500 text-xs"
                      >
                        <option value="DIRECT">Carga Directa para Obra (Buque)</option>
                        <option value="VIA_PANOL">Reposición de Stock (Pañol)</option>
                        <option value="STANDBY">Stand-By en Depósito</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1 font-bold text-[11px]">Solicitante</label>
                      <select
                        value={requestedByName}
                        onChange={(e) => setRequestedByName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-medium focus:outline-none focus:border-cyan-500 cursor-pointer text-xs"
                      >
                        <option value="PAÑOL">PAÑOL (Por Defecto)</option>
                        <optgroup label="Personal Habilitado (Pañol)">
                          {authorizedWorkers.map((w) => (
                            <option key={w.id} value={w.name}>
                              {w.name} {w.trade ? `(${w.trade})` : ''}
                            </option>
                          ))}
                        </optgroup>
                        {otherWorkers.length > 0 && (
                          <optgroup label="Demás Personal de Nómina">
                            {otherWorkers.map((w) => (
                              <option key={w.id} value={w.name}>
                                {w.name} {w.trade ? `(${w.trade})` : ''}
                              </option>
                            ))}
                          </optgroup>
                        )}
                        {contractorGroups.length > 0 && (
                          <optgroup label="🏗️ Contratistas Externos">
                            {contractorGroups.map((grp) => (
                              <option key={`m_cnt_${grp}`} value={grp}>
                                {grp}
                              </option>
                            ))}
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
                  </div>

                  {chargeType === 'DIRECT' && (
                    <div className="space-y-2 pt-1 border-t border-slate-800/80">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-slate-300 mb-1 font-bold text-[11px]">
                            Buque / Obra <span className="text-rose-400">*</span>
                          </label>
                          <select
                            value={shipId}
                            onChange={(e) => {
                              setShipId(e.target.value)
                              setWorkOrderId('')
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold focus:outline-none focus:border-cyan-500 text-xs"
                            required
                          >
                            <option value="">-- Seleccionar Buque --</option>
                            {ships.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-slate-300 mb-1 font-bold text-[11px]">
                            Orden de Trabajo (OT)
                          </label>
                          <WorkOrderSelectorWithHover
                            value={workOrderId}
                            onChange={(nextWoId) => setWorkOrderId(nextWoId)}
                            availableWos={availableWorkOrders}
                            ship={selectedShipObj}
                            workItems={workItems}
                            allWorkOrders={workOrders}
                            disabled={!shipId}
                            placeholder={!shipId ? '-- 1° elija buque --' : '-- ⚠️ Sin OT (Pendiente de apertura) --'}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* BLOQUE 2: PARÁMETROS DEL PEDIDO */}
                <div className="alon-chunk-amber space-y-2.5">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-1">
                    <span className="font-black text-amber-400 uppercase tracking-wider text-[11px]">
                      2. Parámetros y Cronograma de Compra
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-300 mb-1 font-bold text-[11px]">Fecha del Pedido</label>
                      <input
                        type="date"
                        value={orderDate}
                        onChange={(e) => setOrderDate(e.target.value)}
                        onDoubleClick={(e) => e.target.showPicker && e.target.showPicker()}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono focus:outline-none focus:border-amber-400 cursor-pointer text-xs"
                        title="Doble clic para abrir calendario"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 mb-1 font-bold text-[11px]">Nivel de Urgencia</label>
                      <select
                        value={urgency}
                        onChange={(e) => setUrgency(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-amber-400 font-bold text-xs"
                      >
                        <option value="SIN_APURO">🟢 Sin Apuro (Normal)</option>
                        <option value="URGENTE">🔴 Urgente (Prioridad Alta)</option>
                        <option value="PROXIMA_SALIDA">🟡 Próxima Salida de Buque</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMNA DERECHA: BLOQUE 3 */}
              <div className="space-y-3">
                <div className="alon-chunk-emerald space-y-2.5">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1">
                    <span className="font-black text-emerald-400 uppercase tracking-wider text-[11px]">
                      3. Matriz de Insumos y Materiales ({items.length} renglones)
                    </span>
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={handleAddItem}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-slate-950 rounded-lg font-black text-[11px] flex items-center gap-1 transition-all cursor-pointer shadow"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>+ Agregar Renglón</span>
                    </button>
                  </div>

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {items.map((it, idx) => (
                      <div key={idx} className="bg-slate-900 p-2.5 rounded-lg border border-slate-800 space-y-2 relative group">
                        <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                          <span className="font-mono text-cyan-400 font-bold text-[11px]">Renglón #{idx + 1}</span>
                          {items.length > 1 && (
                            <button
                              type="button"
                              tabIndex={-1}
                              onClick={() => handleRemoveItem(idx)}
                              className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer p-0.5"
                              title="Eliminar este renglón"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        <div>
                          <label className="block text-slate-300 mb-1 font-semibold text-[11px] flex items-center justify-between">
                            <span>Material / Insumo Solicitado <span className="text-rose-400">*</span></span>
                            <span className="text-[10px] text-slate-400">
                              Unidad: <strong className="text-cyan-400">{it.unit_measure}</strong>
                            </span>
                          </label>
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

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className="block text-slate-400 mb-1 font-bold text-[10px]">Cantidad</label>
                            <FormulaNumericInput
                              variant="field"
                              maxDecimals={4}
                              unitSuffix={formatUnitMeasureShort(it.unit_measure)}
                              value={it.quantity}
                              onChange={(val) => handleItemChange(idx, 'quantity', val)}
                              placeholder="1 o =2+3"
                              className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-center font-bold focus:outline-none focus:border-cyan-500 text-xs"
                              required
                            />
                          </div>

                          <div>
                            <label className="block text-slate-400 mb-1 font-bold text-[10px]">Unidad</label>
                            <input
                              type="text"
                              tabIndex={-1}
                              value={formatUnitMeasureShort(it.unit_measure)}
                              disabled
                              className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-cyan-300 font-bold text-center cursor-not-allowed text-xs"
                              title="Unidad oficial del material (se edita desde Pañol ➔ Catálogo & Stock ➔ ✏️ Editar Material)"
                            />
                          </div>

                          {viewMode === 'completa' && (
                            <>
                              <div>
                                <label className="block text-slate-400 mb-1 font-bold text-[10px]">Proveedor</label>
                                <select
                                  value={it.supplier_id}
                                  onChange={(e) => handleItemChange(idx, 'supplier_id', e.target.value)}
                                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white text-xs focus:outline-none focus:border-cyan-500"
                                >
                                  <option value="">-- Sin Proveedor --</option>
                                  {suppliers.map((s) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-slate-400 mb-1 font-bold text-[10px]">$/U Cotiz. AR$</label>
                                <FormulaNumericInput
                                  variant="field"
                                  currencyPrefix="$"
                                  maxDecimals={2}
                                  placeholder="$0 o =100+25"
                                  value={it.supplier_quoted_price}
                                  onChange={(val) => handleItemChange(idx, 'supplier_quoted_price', val)}
                                  className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white font-mono text-right text-xs focus:outline-none focus:border-cyan-500"
                                />
                              </div>
                            </>
                          )}
                        </div>

                        <div>
                          <input
                            type="text"
                            placeholder="Observaciones de este material (medida específica, espesor, urgencia)..."
                            value={it.observations}
                            onChange={(e) => handleItemChange(idx, 'observations', e.target.value)}
                            className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-300 placeholder-slate-600 focus:outline-none focus:border-cyan-500"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="alon-modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 text-xs font-black rounded-xl transition-all cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              {saving ? 'Guardando...' : order?.id ? 'Actualizar Pedido' : `Registrar ${items.length} Materiales`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
