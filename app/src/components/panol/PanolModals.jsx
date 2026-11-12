import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Package,
  Plus,
  Trash2,
  Check,
  X,
  AlertTriangle,
  AlertCircle,
  Anchor,
  Edit3,
  ShoppingCart,
  Send,
  UserCheck,
  Flame
} from 'lucide-react'
import { getContractorEnabledWos, evaluateAllocationState } from '../../lib/allocationEngine'
import { WorkOrderSelectorWithHover } from '../workOrders/WorkOrderSelectorWithHover.jsx'
import { WorkOrderScopeHoverCard } from '../workOrders/WorkOrderScopeHoverCard.jsx'
import { supabase } from '../../lib/supabase'
import {
  saveMultiWithdrawalService,
  saveInlineMaterialService,
  createDirectPurchaseOrderService,
  submitRequestOtService,
  submitWorkerPermissionService
} from '../../lib/panolService'

// ==============================================================================
// 1. BUSCADOR INTELIGENTE DE MATERIALES (COMBOBOX PREDICTIVO)
// ==============================================================================
export function MaterialSearchInput({ materials, value, onChange }) {
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef(null)

  const selectedMat = useMemo(() => materials.find((m) => m.id === value), [materials, value])

  const matches = useMemo(() => {
    if (!query.trim()) return materials.slice(0, 30)
    const q = query.toLowerCase().trim()
    return materials
      .filter((m) => (m.name || '').toLowerCase().includes(q) || (m.rubro || '').toLowerCase().includes(q))
      .slice(0, 30)
  }, [materials, query])

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  return (
    <div ref={containerRef} className="relative w-full font-sans">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
            e.preventDefault()
            setIsOpen(true)
          }
        }}
        className="w-full px-2.5 py-1.5 rounded bg-slate-950 border border-slate-700 text-white cursor-pointer flex items-center justify-between hover:border-cyan-400 focus:outline-none focus:border-cyan-400 text-left"
      >
        <span className="truncate font-semibold text-xs">
          {selectedMat ? selectedMat.name : <span className="text-slate-500">Buscar material por nombre o rubro (Enter)...</span>}
        </span>
        {selectedMat && (
          <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-emerald-400 font-mono font-bold ml-1 shrink-0">
            Stock: {selectedMat.current_stock}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden max-h-56 flex flex-col">
          <div className="p-2 border-b border-slate-800 bg-slate-950">
            <input
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && matches.length > 0) {
                  e.preventDefault()
                  onChange(matches[0].id)
                  setIsOpen(false)
                }
                if (e.key === 'Escape') {
                  e.preventDefault()
                  setIsOpen(false)
                }
              }}
              placeholder="Escribe 'elec', 'chapa', 'disco' y presiona Enter..."
              className="w-full px-2.5 py-1 rounded bg-slate-900 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="overflow-y-auto divide-y divide-slate-800/60 flex-1">
            {matches.length === 0 ? (
              <div className="p-3 text-center text-slate-500 text-xs">No se encontraron materiales coincidentes</div>
            ) : (
              matches.map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    onChange(m.id)
                    setIsOpen(false)
                  }}
                  className="p-2 hover:bg-slate-800/80 cursor-pointer flex items-center justify-between gap-2 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {m.image_url ? (
                      <img src={m.image_url} alt="" className="w-6 h-6 rounded object-cover shrink-0 border border-slate-700" />
                    ) : (
                      <div className="w-6 h-6 rounded bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600 shrink-0">
                        <Package className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div className="truncate">
                      <span className="font-bold text-white text-xs block truncate">{m.name}</span>
                      <span className="text-[10px] text-slate-400">{m.rubro || m.category}</span>
                    </div>
                  </div>

                  <span
                    className={`font-mono font-bold text-xs shrink-0 ${
                      m.current_stock <= 0 ? 'text-rose-400' : 'text-emerald-400'
                    }`}
                  >
                    {m.current_stock} {m.unit_measure || 'un.'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ==============================================================================
// 2. MODAL DE RETIRO MULTI-MATERIAL (CASCADA CANÓNICA Y EDICIÓN)
// ==============================================================================
export function MultiWithdrawalModal({
  materials,
  ships,
  workOrders,
  workItems,
  astilleroWorkers = [],
  contractorGroups = [],
  unauthorizedWorkers = [],
  getEnabledWorkersAndContractors,
  pendingAlerts = [],
  isAdmin,
  editingRow,
  onRequestOt,
  onRequestWorkerPermission,
  onClose,
  onSave
}) {
  const [shipId, setShipId] = useState(editingRow?.ship_id || '')
  const [contractorGroup, setContractorGroup] = useState(editingRow?.worker_name || editingRow?.contractor_name || '')
  const [workOrderId, setWorkOrderId] = useState(editingRow?.work_order_id || '')
  const [isOtEmpty, setIsOtEmpty] = useState(!editingRow?.work_order_id)
  const [hoveredWo, setHoveredWo] = useState(null)
  const [date, setDate] = useState(
    editingRow?.transaction_date
      ? String(editingRow.transaction_date).split('T')[0]
      : new Date().toISOString().split('T')[0]
  )
  const [notes, setNotes] = useState(editingRow?.notes || '')

  const [items, setItems] = useState(
    editingRow
      ? [
          {
            material_id: editingRow.material_id || '',
            quantity: editingRow.quantity_withdrawn || 1,
            customCostCenter: editingRow.cost_center || '',
            notes: ''
          }
        ]
      : [
          {
            material_id: '',
            quantity: 1,
            customCostCenter: '',
            notes: ''
          }
        ]
  )

  const enabled = useMemo(() => {
    if (typeof getEnabledWorkersAndContractors === 'function') {
      return getEnabledWorkersAndContractors(shipId, isOtEmpty ? null : workOrderId)
    }
    return { astilleroWorkers, contractorGroups }
  }, [getEnabledWorkersAndContractors, shipId, workOrderId, isOtEmpty, astilleroWorkers, contractorGroups])

  const availableWos = useMemo(() => {
    return getContractorEnabledWos(shipId, contractorGroup, workOrders, workItems, { astilleroWorkers, contractorGroups })
  }, [shipId, contractorGroup, workOrders, workItems, astilleroWorkers, contractorGroups])

  const allocState = useMemo(() => {
    return evaluateAllocationState({
      shipId,
      workOrderId: isOtEmpty ? null : workOrderId,
      contractorName: contractorGroup,
      isSinOt: isOtEmpty,
      availableWos,
      pendingAlerts
    })
  }, [shipId, isOtEmpty, workOrderId, contractorGroup, availableWos, pendingAlerts])

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        material_id: '',
        quantity: 1,
        customCostCenter: '',
        notes: ''
      }
    ])
  }

  const handleRemoveItem = (index) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((_, idx) => idx !== index))
  }

  const handleItemChange = (index, field, value) => {
    setItems((prev) => {
      const next = [...prev]
      next[index] = { ...next[index], [field]: value }
      return next
    })
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!shipId) return alert('Debes seleccionar un Barco.')
    if (!contractorGroup) return alert('Debes seleccionar un Operario o Contratista.')
    if (!isOtEmpty && !workOrderId) return alert('Debes seleccionar una OT o marcar la casilla (⚠️ Sin OT).')

    const validItems = items.filter((it) => it.material_id && Number(it.quantity) > 0)
    if (validItems.length === 0) {
      return alert('Debes cargar al menos un material válido con cantidad mayor a 0.')
    }

    onSave({
      shipId,
      workOrderId: isOtEmpty ? null : workOrderId,
      contractorGroup,
      notes,
      date,
      items: validItems,
      editId: editingRow?.id || null
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="alon-modal-card max-w-5xl">
        <div className="alon-modal-header">
          <div className="flex items-center gap-2 text-white font-black text-sm">
            {editingRow ? <Edit3 className="w-4 h-4 text-cyan-400" /> : <Package className="w-4 h-4 text-emerald-400" />}
            <div>
              <span className="block leading-tight">
                {editingRow
                  ? 'REGISTRAR SALIDA MULTI-MATERIAL DE PAÑOL — MODO EDICIÓN'
                  : 'REGISTRAR SALIDA MULTI-MATERIAL DE PAÑOL'}
              </span>
              <span className="text-[11px] font-normal text-slate-400 block">
                Recorrido guiado por color y tecla <strong className="text-slate-200">Tab</strong>: 1° Obra ➔ 2° Matriz de Materiales ➔ 3° Fecha y Notas.
              </span>
            </div>
          </div>
          <button type="button" tabIndex={-1} onClick={onClose} className="text-slate-500 hover:text-white cursor-pointer p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
          <div className="alon-modal-body space-y-3">
            {/* BLOQUE 1: DESTINO E IMPUTACIÓN DE OBRA */}
            <div className="alon-chunk-sky space-y-2.5">
              <div className="flex items-center justify-between border-b border-sky-500/20 pb-1.5">
                <span className="font-black text-sky-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Anchor className="w-3.5 h-3.5 text-sky-400" />
                  <span>1. Destino e Imputación de Obra (Cascada Naval)</span>
                </span>
                <span className="text-slate-400 text-[10px]">Barco ➔ Operario/Contratista ➔ OT</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {/* Paso 1: Barco */}
                <div>
                  <label className="block text-slate-300 font-bold text-[11px] mb-1">
                    1° Barco / Buque <span className="text-rose-400">*</span>
                  </label>
                  <select
                    autoFocus
                    value={shipId}
                    onChange={(e) => {
                      const newShipId = e.target.value
                      setShipId(newShipId)
                      setWorkOrderId('')
                    }}
                    required
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold focus:outline-none focus:border-cyan-400"
                  >
                    <option value="">Seleccionar Barco...</option>
                    {ships.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Paso 2: Operario / Contratista */}
                <div>
                  <label className="block text-slate-300 font-bold text-[11px] mb-1">
                    2° Operario / Contratista <span className="text-rose-400">*</span>
                  </label>
                  <select
                    value={contractorGroup}
                    onChange={(e) => {
                      const val = e.target.value
                      if (val === '__SOLICITAR_APERTURA_OT__') {
                        onRequestOt && onRequestOt(shipId, contractorGroup || '')
                        return
                      }
                      if (val === '__SOLICITAR_HABILITACION_OPERARIO__') {
                        onRequestWorkerPermission && onRequestWorkerPermission()
                        return
                      }
                      setContractorGroup(val)
                    }}
                    required
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-cyan-400 font-black focus:outline-none focus:border-cyan-400"
                  >
                    <option value="">-- Seleccionar Operario / Contratista --</option>
                    {contractorGroup &&
                      !enabled.astilleroWorkers.some((w) => w.name === contractorGroup) &&
                      !enabled.contractorGroups.some((g) => g === contractorGroup) && (
                        <option value={contractorGroup}>{contractorGroup} (Actual)</option>
                      )}
                    {enabled.astilleroWorkers.length > 0 && (
                      <optgroup label={`⭐ Personal Astillero (${enabled.astilleroWorkers.length})`}>
                        {enabled.astilleroWorkers.map((w) => (
                          <option key={`m_ast_${w.id || w.name}`} value={w.name}>
                            {w.name}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    {enabled.contractorGroups.length > 0 && (
                      <optgroup label={`🏗️ Contratistas (${enabled.contractorGroups.length})`}>
                        {enabled.contractorGroups.map((grp) => (
                          <option key={`m_cnt_${grp}`} value={grp}>
                            {grp}
                          </option>
                        ))}
                      </optgroup>
                    )}
                    <option
                      value="__SOLICITAR_APERTURA_OT__"
                      disabled={allocState.isOtRequestPending}
                      className={`${allocState.isOtRequestPending ? 'text-slate-500 bg-slate-900' : 'text-rose-400 font-bold bg-slate-900'}`}
                    >
                      {allocState.isOtRequestPending ? 'Solicitud de OT enviada (1)' : '➕ Solicitar Apertura de OT a Admin...'}
                    </option>
                    <option value="__SOLICITAR_HABILITACION_OPERARIO__" className="text-cyan-400 font-bold bg-slate-900">
                      ➕ Solicitar Habilitación de Operario a Admin...
                    </option>
                  </select>
                </div>

                {/* Paso 3: OT */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-slate-300 font-bold text-[11px]">
                      3° Orden de Trabajo (OT) <span className="text-rose-400">*</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer text-[10px] text-amber-400">
                      <input
                        type="checkbox"
                        tabIndex={-1}
                        checked={isOtEmpty}
                        onChange={(e) => {
                          setIsOtEmpty(e.target.checked)
                          if (e.target.checked) setWorkOrderId('')
                        }}
                        className="rounded border-slate-700 bg-slate-950 text-amber-500 focus:ring-0 cursor-pointer"
                      />
                      <span>(⚠️ Sin OT)</span>
                    </label>
                  </div>

                  <WorkOrderSelectorWithHover
                    value={workOrderId}
                    onChange={(newWoId) => {
                      setWorkOrderId(newWoId)
                      if (!newWoId) {
                        setIsOtEmpty(true)
                      } else {
                        setIsOtEmpty(false)
                      }
                      if (contractorGroup && typeof getEnabledWorkersAndContractors === 'function') {
                        const newEnabled = getEnabledWorkersAndContractors(shipId, newWoId)
                        const isValid =
                          newEnabled.astilleroWorkers.some((w) => w.name.toUpperCase() === contractorGroup.toUpperCase()) ||
                          newEnabled.contractorGroups.some((g) => g.toUpperCase() === contractorGroup.toUpperCase())
                        if (!isValid) setContractorGroup('')
                      }
                    }}
                    onHoverChange={setHoveredWo}
                    availableWos={availableWos}
                    ship={ships.find((s) => s.id === shipId)}
                    workItems={workItems}
                    allWorkOrders={workOrders}
                    contractorName={contractorGroup}
                    disabled={isOtEmpty}
                    isSinOt={isOtEmpty}
                    placeholder="-- 3° Seleccionar OT --"
                    showPreviewCard={false}
                  />
                </div>
              </div>

              {/* TARJETA CANÓNICA HOVER / SELECCIONADA (IMAGEN 2) */}
              {(hoveredWo || workOrderId) && !isOtEmpty && (
                <WorkOrderScopeHoverCard
                  wo={hoveredWo || availableWos.find((w) => String(w.id) === String(workOrderId)) || workOrders.find((w) => String(w.id) === String(workOrderId))}
                  ship={ships.find((s) => s.id === shipId)}
                  workItems={workItems}
                  allWorkOrders={workOrders}
                  contractorFilter={contractorGroup}
                  isHoverPreview={Boolean(hoveredWo && hoveredWo.id !== workOrderId)}
                />
              )}

              {/* Inconsistencia OT */}
              {shipId && contractorGroup && availableWos.length === 0 && !isOtEmpty && (
                <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/80 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-rose-300 font-semibold text-[11px]">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    <span>No hay OT habilitada para este contratista en este buque.</span>
                  </div>
                  {allocState.isOtRequestPending ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      disabled
                      className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-500 border border-slate-700 font-bold text-[11px] cursor-not-allowed shrink-0"
                    >
                      Solicitud enviada (1)
                    </button>
                  ) : (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => onRequestOt && onRequestOt(shipId, contractorGroup)}
                      className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-black text-[11px] shadow-md cursor-pointer flex items-center gap-1 shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[3]" />
                      <span>Solicitar Apertura de OT a Admin</span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* BLOQUE 2: MATRIZ DE INSUMOS */}
            <div className="alon-chunk-emerald space-y-2.5">
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1.5">
                <span className="font-black text-emerald-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-emerald-400" />
                  <span>2. Matriz de Insumos y Materiales Retirados ({items.length} renglones)</span>
                </span>
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={handleAddItem}
                  className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-[11px] flex items-center gap-1 cursor-pointer transition-all shadow"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>+ Agregar Otro Material</span>
                </button>
              </div>

              <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                {items.map((item, idx) => {
                  const mat = materials.find((m) => m.id === item.material_id)
                  let autoCostCenter = 'CLIENTE'
                  if (mat?.category === 'CONSUMIBLES' || mat?.category === 'ELEM.SEGURIDAD') {
                    autoCostCenter = 'CLIENTE'
                  }
                  const weightRow = ((Number(mat?.weight_kg) || 0) * (Number(item.quantity) || 1)).toFixed(2)

                  return (
                    <div
                      key={idx}
                      className="p-2 rounded-lg bg-slate-900 border border-slate-800 flex flex-col md:flex-row items-center gap-2.5"
                    >
                      <span className="text-slate-500 font-mono text-xs w-5 shrink-0 text-center">#{idx + 1}</span>

                      <div className="flex-1 w-full min-w-[220px]">
                        <MaterialSearchInput
                          materials={materials}
                          value={item.material_id}
                          onChange={(mId) => handleItemChange(idx, 'material_id', mId)}
                        />
                      </div>

                      <div className="w-28 shrink-0 flex items-center gap-1.5">
                        <input
                          type="number"
                          min="0.1"
                          step="any"
                          placeholder="Cant."
                          value={item.quantity}
                          onChange={(e) => handleItemChange(idx, 'quantity', e.target.value)}
                          required
                          className="w-16 px-2 py-1.5 rounded bg-slate-950 border border-slate-700 text-white font-mono text-center font-bold focus:outline-none focus:border-cyan-400"
                        />
                        <span className="text-[10px] text-slate-400 font-semibold truncate">
                          {mat?.unit_measure || 'un.'}
                        </span>
                      </div>

                      <div className="w-20 shrink-0 text-center font-mono text-slate-400 text-[11px]">
                        <span className="block font-bold text-slate-200">{weightRow} kg</span>
                        <span className="text-[9px] text-slate-500">({mat?.weight_kg || 0} c/u)</span>
                      </div>

                      <div className="w-28 shrink-0">
                        <select
                          value={item.customCostCenter || autoCostCenter}
                          disabled={!isAdmin}
                          onChange={(e) => handleItemChange(idx, 'customCostCenter', e.target.value)}
                          className={`w-full px-2 py-1.5 rounded text-[11px] font-bold border ${
                            !isAdmin
                              ? 'bg-slate-950 border-slate-800 text-cyan-400 opacity-90 cursor-not-allowed'
                              : 'bg-slate-950 border-cyan-500 text-cyan-300'
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
                        onClick={() => handleRemoveItem(idx)}
                        className={`p-1.5 rounded hover:bg-rose-950/60 text-slate-500 hover:text-rose-400 transition-colors shrink-0 ${
                          items.length <= 1 ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer'
                        }`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* BLOQUE 3: FECHA Y OBSERVACIONES */}
            <div className="alon-chunk-indigo">
              <div className="flex items-center justify-between border-b border-indigo-500/20 pb-1.5 mb-2">
                <span className="font-black text-indigo-400 uppercase tracking-wider text-[11px]">
                  3. Fecha del Retiro y Observaciones Generales
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-slate-300 font-bold text-[11px] mb-1">Fecha del Retiro</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-cyan-400"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-slate-300 font-bold text-[11px] mb-1">Observaciones Generales</label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Ej: Retiro para reparación de mamparo en bodega de popa..."
                    className="w-full px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="alon-modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs transition-all shadow-lg shadow-emerald-600/30 cursor-pointer flex items-center gap-1.5"
            >
              <Check className="w-4 h-4 stroke-[3]" />
              <span>{editingRow ? 'Guardar Cambios' : `Confirmar Retiro (${items.length} materiales)`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// 3. MODAL DE PEDIDO DE COMPRA DIRECTO
// ==============================================================================
export function QuickPurchaseModal({ material, initialQuantity, initialUrgency = 'SIN_APURO', onClose, onConfirm }) {
  const [quantity, setQuantity] = useState(initialQuantity || '')
  const [urgency, setUrgency] = useState(initialUrgency || 'SIN_APURO')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const today = new Date().toISOString().split('T')[0]

  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await onConfirm({ material, quantity, urgency })
    } catch {
      // Toast gestionado por el llamador
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-cyan-500/50 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden font-sans flex flex-col">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-2 text-cyan-300 font-black text-sm">
            <ShoppingCart className="w-5 h-5 text-cyan-400" />
            <span>PEDIDO DIRECTO A COMPRAS</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5 text-xs">
          <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-500 uppercase font-mono font-bold block">Material / Insumo Requerido</span>
            <span className="font-bold text-white text-sm block truncate">{material?.name}</span>
            <span className="text-[11px] text-cyan-400 font-mono">Unidad de medida: {material?.unit_measure || 'un.'}</span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Cantidad a Pedir</label>
              <input
                type="number"
                min="0.1"
                step="any"
                autoFocus
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="1"
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Nivel de Urgencia</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold focus:outline-none focus:border-cyan-400"
              >
                <option value="SIN_APURO">Sin Apuro</option>
                <option value="URGENTE">⚠️ Urgente</option>
                <option value="BLOQUEANTE">🚨 Bloqueante</option>
              </select>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-cyan-950/30 border border-cyan-800/40 text-[11px] text-slate-300 space-y-0.5">
            <div className="flex justify-between">
              <span className="text-slate-400">Destino:</span>
              <span className="font-semibold text-white">Astillero / Stock Pañol</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Estado inicial en Compras:</span>
              <span className="font-mono font-bold text-cyan-300">PEDIR</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Fecha de pedido:</span>
              <span className="font-mono text-slate-300">{today}</span>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-black flex items-center gap-1.5 cursor-pointer shadow-lg shadow-cyan-600/30 disabled:opacity-50"
            >
              <ShoppingCart className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{isSubmitting ? 'Enviando...' : 'Confirmar Pedido a Compras'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// 4. MODAL ALTA FORMAL DE MATERIAL
// ==============================================================================
export function NewMaterialModal({ rubros, isAdmin, onClose, onSave }) {
  const [name, setName] = useState('')
  const [rubro, setRubro] = useState('')
  const [category, setCategory] = useState('CONSUMIBLES')
  const [unitMeasure, setUnitMeasure] = useState('Unidad')
  const [weightKg, setWeightKg] = useState(0)
  const [requiresStockControl, setRequiresStockControl] = useState(true)
  const [currentStock, setCurrentStock] = useState(0)
  const [minimumStock, setMinimumStock] = useState(0)
  const [securityFactor, setSecurityFactor] = useState(1.06)

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) return alert('El nombre del material es obligatorio.')

    onSave({
      name: name.trim().toUpperCase(),
      rubro: rubro || 'GENERAL',
      category,
      unit_measure: unitMeasure,
      weight_kg: Number(weightKg) || 0,
      requires_stock_control: requiresStockControl,
      current_stock: Number(currentStock) || 0,
      minimum_stock: Number(minimumStock) || 0,
      security_factor: Number(securityFactor) || 1.06
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="alon-modal-card max-w-4xl">
        <div className="alon-modal-header">
          <div className="flex items-center gap-2 text-white font-black text-sm min-w-0">
            <Package className="w-5 h-5 text-emerald-400 shrink-0" />
            <div className="min-w-0">
              <span className="block leading-tight truncate">ALTA DE MATERIAL EN CATÁLOGO B.D (PAÑOL)</span>
              <span className="text-[11px] font-normal text-slate-400 block truncate">
                Recorrido guiado por color y tecla <strong className="text-slate-200">Tab</strong>: 1° Identificación ➔ 2° Medidas ➔ 3° Stock & Alertas ➔ 4° Seguridad Naval.
              </span>
            </div>
          </div>
          <button type="button" tabIndex={-1} onClick={onClose} className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
          <div className="alon-modal-body">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
              {/* COLUMNA IZQUIERDA */}
              <div className="space-y-3">
                <div className="alon-chunk-sky space-y-2.5">
                  <div className="flex items-center justify-between border-b border-sky-500/20 pb-1">
                    <span className="font-black text-sky-400 uppercase tracking-wider text-[11px]">
                      1. Identificación Técnica y Clasificación
                    </span>
                    <span className="text-[10px] text-slate-400">Catálogo oficial</span>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold text-[11px] mb-1">
                      Nombre Técnico Oficial <span className="text-rose-400">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      autoFocus
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Ej: CHAPA NAVAL GRADO A 1/2' x 1500 x 6000..."
                      className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold uppercase focus:outline-none focus:border-cyan-400 text-xs"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-300 font-bold text-[11px] mb-1">
                        Categoría General <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-bold focus:outline-none focus:border-cyan-400 text-xs"
                      >
                        <option value="MATERIALES">MATERIALES</option>
                        <option value="CONSUMIBLES">CONSUMIBLES</option>
                        <option value="ELEM.SEGURIDAD">ELEM.SEGURIDAD</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold text-[11px] mb-1">
                        Rubro Técnico <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={rubro}
                        onChange={(e) => setRubro(e.target.value)}
                        required
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400 text-xs"
                      >
                        <option value="">Seleccionar Rubro...</option>
                        {rubros.map((r) => (
                          <option key={r.id} value={r.name}>
                            {r.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="alon-chunk-indigo space-y-2.5">
                  <div className="flex items-center justify-between border-b border-indigo-500/20 pb-1">
                    <span className="font-black text-indigo-400 uppercase tracking-wider text-[11px]">
                      2. Métricas Físicas y Unidad de Despacho
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-300 font-bold text-[11px] mb-1">Unidad de Medida</label>
                      <select
                        value={unitMeasure}
                        onChange={(e) => setUnitMeasure(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-indigo-400 text-xs"
                      >
                        <option value="Unidad">Unidad</option>
                        <option value="kg">Kilogramo (kg)</option>
                        <option value="metro">Metro lineal</option>
                        <option value="m2">Metro cuadrado (m2)</option>
                        <option value="Litro">Litro</option>
                        <option value="Bolsón">Bolsón</option>
                        <option value="Tubo">Tubo / Cilindro</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold text-[11px] mb-1">Peso Unitario (kg)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        placeholder="0.00"
                        value={weightKg}
                        onChange={(e) => setWeightKg(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-indigo-400 text-xs"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* COLUMNA DERECHA */}
              <div className="space-y-3">
                <div className="alon-chunk-emerald space-y-2.5">
                  <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1">
                    <span className="font-black text-emerald-400 uppercase tracking-wider text-[11px]">
                      3. Stock y Alertas de Reposición
                    </span>
                    <span className="text-[10px] text-emerald-300 font-bold">Depósito Central</span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-slate-300 font-bold text-[11px] mb-1">Stock Inicial Actual</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={currentStock}
                        onChange={(e) => setCurrentStock(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-emerald-500 text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-300 font-bold text-[11px] mb-1">Stock Mínimo (Alerta)</label>
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={minimumStock}
                        onChange={(e) => setMinimumStock(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-emerald-500 text-xs"
                      />
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="font-bold text-white block text-[11px]">Lleva Control de Stock Físico</span>
                      <span className="text-slate-400 text-[10px]">Desmarcar solo si es compra directa sin depósito</span>
                    </div>
                    <input
                      type="checkbox"
                      checked={requiresStockControl}
                      onChange={(e) => setRequiresStockControl(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700 cursor-pointer"
                    />
                  </div>
                </div>

                <div className="alon-chunk-amber space-y-2">
                  <div className="flex items-center justify-between border-b border-amber-500/20 pb-1">
                    <span className="font-black text-amber-400 uppercase tracking-wider text-[11px]">
                      4. Coeficiente de Seguridad Naval
                    </span>
                  </div>

                  <div>
                    <label className="block text-slate-300 font-bold text-[11px] mb-1">% Seguridad Naval (Merma / Desperdicio)</label>
                    <select
                      disabled={!isAdmin}
                      value={securityFactor}
                      onChange={(e) => setSecurityFactor(e.target.value)}
                      className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${
                        !isAdmin ? 'bg-slate-950 border-slate-800 text-slate-500' : 'bg-slate-950 border-slate-700 text-white focus:outline-none focus:border-amber-400'
                      }`}
                    >
                      <option value="1.02">2% (1.02)</option>
                      <option value="1.06">6% (1.06 Estándar Astillero)</option>
                      <option value="1.10">10% (1.10)</option>
                      <option value="1.15">15% (1.15)</option>
                      <option value="1.20">20% (1.20)</option>
                    </select>
                  </div>
                  <p className="text-[10px] text-slate-400 italic">
                    Aplica automáticamente sobre los cálculos de reposición y pedidos de compra directa.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="alon-modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer text-xs"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-emerald-600/30 transition-all"
            >
              Guardar Material
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// 5. SUBCOMPONENTE: AJUSTE DE STOCK FÍSICO
// ==============================================================================
export function StockAdjustModal({ material, onClose, onSave }) {
  const [newStock, setNewStock] = useState(material?.current_stock || 0)

  const handleSubmit = (e) => {
    e.preventDefault()
    onSave(material.id, 'current_stock', newStock)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-sm shadow-2xl p-5 space-y-4 text-xs font-sans">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-bold text-white uppercase">Ajuste de Stock Físico</span>
          <button onClick={onClose} className="text-slate-500 hover:text-white">✕</button>
        </div>

        <div className="p-3 rounded-lg bg-slate-950 border border-slate-800">
          <span className="font-bold text-white block truncate">{material?.name}</span>
          <span className="text-[10px] text-slate-500">Stock Actual en Sistema: {material?.current_stock} {material?.unit_measure}</span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Nuevo Recuento Físico</label>
            <input
              type="number"
              step="any"
              autoFocus
              value={newStock}
              onChange={(e) => setNewStock(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-base font-bold focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black cursor-pointer shadow"
            >
              Confirmar Ajuste
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// 6. SUBCOMPONENTE: MOVIMIENTO DE GASES Y CILINDROS
// ==============================================================================
export function GasMovementModal({ operationType, materials, suppliers, ships, workOrders, workers, onClose, onSave }) {
  const [opType, setOpType] = useState(operationType || 'PRIMERA_ENTREGA')
  const [materialId, setMaterialId] = useState('')
  const [shipId, setShipId] = useState('')
  const [contractorName, setContractorName] = useState('')
  const [supplierDeliveredId, setSupplierDeliveredId] = useState('')
  const [supplierReturnedId, setSupplierReturnedId] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!materialId) return alert('Debes seleccionar un tipo de gas.')
    if (!contractorName) return alert('Debes seleccionar un contratista.')

    onSave({
      operation_type: opType,
      material_id: materialId,
      ship_id: shipId || null,
      contractor_name: contractorName,
      supplier_delivered_id: supplierDeliveredId || null,
      supplier_returned_id: supplierReturnedId || null,
      quantity: Number(quantity) || 1,
      notes
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl p-5 space-y-4 text-xs font-sans">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2 text-white font-black">
            <Flame className="w-5 h-5 text-amber-400" />
            <span>MOVIMIENTO DE TUBOS DE GAS</span>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">Tipo de Operación Canónica</label>
            <select
              value={opType}
              onChange={(e) => setOpType(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-amber-400 font-bold focus:outline-none focus:border-cyan-400"
            >
              <option value="PRIMERA_ENTREGA">1. Primera Entrega (+1 deuda contratista, -1 lleno pañol)</option>
              <option value="RECAMBIO_1X1">2. Recambio 1x1 con Cruce (+1 vacío marca A, -1 lleno marca B)</option>
              <option value="DEVOLUCION_FINAL">3. Devolución Final (-1 deuda contratista, +1 vacío pañol)</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Gas / Tubo</label>
              <select
                value={materialId}
                onChange={(e) => setMaterialId(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="">Seleccionar Gas...</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Contratista</label>
              <input
                type="text"
                required
                placeholder="Ej: TANO, BOLTRI..."
                value={contractorName}
                onChange={(e) => setContractorName(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white uppercase focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Proveedor Marca Entregada</label>
              <select
                value={supplierDeliveredId}
                onChange={(e) => setSupplierDeliveredId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="">Seleccionar Marca...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Proveedor Marca Devuelta</label>
              <select
                value={supplierReturnedId}
                onChange={(e) => setSupplierReturnedId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="">Seleccionar Marca...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">Buque / Destino</label>
              <select
                value={shipId}
                onChange={(e) => setShipId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
              >
                <option value="">(Sin Barco / Astillero)</option>
                {ships.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">Cantidad de Tubos</label>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold mb-1">Observaciones / Trazabilidad</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Tubo de acetileno entregado para corte en grada..."
              className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-white focus:outline-none focus:border-cyan-400"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-slate-950 font-black cursor-pointer shadow-lg shadow-amber-600/30"
            >
              Guardar Movimiento
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// 7. MODAL SOLICITAR APERTURA DE OT A JORGE SENTIS
// ==============================================================================
export function RequestOtModal({
  isOpen,
  shipId,
  targetWorkerOrContractor,
  reason,
  ships,
  astilleroWorkers,
  contractorGroups,
  onChangeShipId,
  onChangeTargetWorkerOrContractor,
  onChangeReason,
  onClose,
  onSubmit
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-amber-400 font-bold text-sm">
            <AlertCircle className="w-5 h-5" />
            <span>Solicitar Apertura de OT a Jorge Sentis</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300">
          El operario o contratista no cuenta con una OT habilitada en este buque. 
          Al confirmar, se enviará una notificación prioritaria a <strong>Jorge Sentis (Administrador)</strong> para la apertura de la nueva OT y se habilitará la entrega provisoria bajo <strong>(⚠️ Sin OT)</strong>.
        </p>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Buque / Destino</label>
            <select
              value={shipId}
              onChange={(e) => onChangeShipId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              <option value="">-- Seleccionar Buque --</option>
              {ships.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Operario o Contratista Requerido</label>
            <select
              value={targetWorkerOrContractor}
              onChange={(e) => onChangeTargetWorkerOrContractor(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-400"
            >
              <option value="">-- Seleccionar de la nómina completa --</option>
              <optgroup label="⭐ Personal Astillero (Aloncar)">
                {astilleroWorkers.map((w) => (
                  <option key={`req_ast_${w.id || w.name}`} value={w.name}>
                    {w.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="🏗️ Contratistas Externos">
                {contractorGroups.map((grp) => (
                  <option key={`req_cnt_${grp}`} value={grp}>
                    {grp}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Motivo / Tareas a Realizar</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => onChangeReason(e.target.value)}
              placeholder="Ej: Se requiere retirar insumos para tareas urgentes no contempladas en las OTs actuales..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar Alerta a Jorge Sentis</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ==============================================================================
// 8. MODAL SOLICITAR HABILITACIÓN DE OPERARIO A JORGE SENTIS
// ==============================================================================
export function WorkerPermissionModal({
  isOpen,
  workerId,
  reason,
  unauthorizedWorkers,
  onChangeWorkerId,
  onChangeReason,
  onClose,
  onSubmit
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-cyan-500/40 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 font-sans">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <UserCheck className="w-5 h-5" />
            <span>Solicitar Habilitación de Operario a Jorge Sentis</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          El operario seleccionado no cuenta actualmente con el permiso de retiro de materiales en Pañol (<strong>P</strong>).
          Al enviar esta solicitud, <strong>Jorge Sentis (Administrador)</strong> podrá habilitarlo formalmente en el Padrón de Personal.
        </p>

        <div className="space-y-3 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Operario sin Permiso</label>
            <select
              value={workerId}
              onChange={(e) => onChangeWorkerId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-cyan-400 font-bold focus:outline-none focus:border-cyan-400"
            >
              <option value="">-- Seleccionar Operario a Habilitar --</option>
              {unauthorizedWorkers.map((w) => (
                <option key={`unauth_${w.id}`} value={w.id}>
                  {w.name} ({w.trade || 'General'} - {w.admin_center || 'Astillero'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 mb-1">Motivo / Justificación</label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => onChangeReason(e.target.value)}
              placeholder="Ej: Asignado a tareas urgentes en dique, requiere retirar insumos de trabajo y EPP..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-400"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSubmit}
            className="px-4 py-1.5 rounded-lg text-xs font-bold text-slate-950 bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Enviar Solicitud a Jorge Sentis</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ==============================================================================
// 9. MODAL PREVISUALIZAR IMAGEN TÉCNICA
// ==============================================================================
export function ImagePreviewModal({ previewImage, onClose }) {
  if (!previewImage) return null

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-pointer font-sans"
    >
      <div className="max-w-2xl max-h-[85vh] bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden p-2 shadow-2xl">
        <img src={previewImage} alt="Material Técnico" className="w-full h-auto max-h-[80vh] object-contain rounded-xl" />
      </div>
    </div>
  )
}

// ==============================================================================
// 10. CONTENEDOR MODULAR UNIFICADO DE MODALES DE PAÑOL
// ==============================================================================
export function PanolModalsContainer({
  showWithdrawalModal,
  setShowWithdrawalModal,
  editingWithdrawalRow,
  setEditingWithdrawalRow,
  showNewMaterialModal,
  setShowNewMaterialModal,
  showStockAdjustModal,
  setShowStockAdjustModal,
  showGasModal,
  setShowGasModal,
  quickPurchaseModal,
  setQuickPurchaseModal,
  requestOtModal,
  setRequestOtModal,
  workerPermissionModal,
  setWorkerPermissionModal,
  previewImage,
  setPreviewImage,
  materials,
  setMaterials,
  setInventoryTx,
  setGasMovements,
  ships,
  workOrders,
  workItems,
  astilleroWorkers,
  contractorGroups,
  unauthorizedWorkers,
  getEnabledWorkersAndContractors,
  pendingAlerts,
  setPendingAlerts,
  suppliers,
  rubros,
  workers,
  isAdmin,
  user,
  showFeedback
}) {
  const handleSaveMultiWithdrawal = async (payload) => {
    try {
      const res = await saveMultiWithdrawalService({ ...payload, materials, astilleroWorkers, user })
      if (res.isEdit) {
        setInventoryTx((prev) => prev.map((t) => (t.id === payload.editId ? { ...t, ...res.updates } : t)))
        setShowWithdrawalModal(false)
        setEditingWithdrawalRow(null)
        showFeedback('success', 'Fila modificada con éxito.')
        return
      }
      setInventoryTx((prev) => [...res.createdTxs, ...prev])
      setMaterials((prev) => prev.map((m) => {
        const upd = res.matUpdates.find((u) => u.id === m.id)
        return upd ? { ...m, current_stock: upd.newStock } : m
      }))
      showFeedback('success', `Retiro confirmado: ${res.createdTxs.length} insumos registrados.`)
      setShowWithdrawalModal(false)
    } catch (err) {
      showFeedback('error', 'Error registrando retiro: ' + err.message)
    }
  }

  const handleSaveNewMaterial = async (formData) => {
    try {
      const { data, error } = await supabase.from('materials').insert([formData]).select().single()
      if (error) throw error
      setMaterials((prev) => [data, ...prev])
      showFeedback('success', `Material "${data.name}" agregado con éxito.`)
      setShowNewMaterialModal(false)
    } catch (e) {
      showFeedback('error', 'Error creando material: ' + e.message)
    }
  }

  const handleSaveStockAdjust = async (matId, field, value) => {
    try {
      const updates = await saveInlineMaterialService({ matId, field, value, materials, user })
      setMaterials((prev) => prev.map((m) => (m.id === matId ? { ...m, ...updates } : m)))
      showFeedback('success', 'Stock físico ajustado con éxito.')
      setShowStockAdjustModal({ isOpen: false, material: null })
    } catch (err) {
      showFeedback('error', 'Error al ajustar stock: ' + err.message)
    }
  }

  const handleSaveGasMovement = async (gasData) => {
    try {
      const { data, error } = await supabase.from('gas_cylinder_movements').insert([gasData]).select().single()
      if (error) throw error
      if (setGasMovements) setGasMovements((prev) => [data, ...prev])
      showFeedback('success', 'Movimiento de gas registrado correctamente.')
      setShowGasModal({ isOpen: false, operationType: 'PRIMERA_ENTREGA' })
    } catch (e) {
      showFeedback('error', 'Error en movimiento de tubos: ' + e.message)
    }
  }

  const handleConfirmQuickPurchase = async (args) => {
    try {
      await createDirectPurchaseOrderService({ ...args, ships })
      setQuickPurchaseModal({ isOpen: false, material: null, quantity: '', urgency: 'SIN_APURO' })
      showFeedback('success', `Pedido de "${args.material?.name}" enviado a Compras.`)
    } catch (e) {
      showFeedback('error', 'Error al generar pedido: ' + e.message)
    }
  }

  const handleSubmitRequestOt = async () => {
    try {
      await submitRequestOtService({ requestOtModal, ships })
      setRequestOtModal({ isOpen: false, txId: null, shipId: '', targetWorkerOrContractor: '', reason: '' })
      showFeedback('success', '🔔 Alerta enviada a Jorge Sentis para apertura de OT.')
      const { data: updatedAlerts } = await supabase.from('compliance_alerts').select('*').eq('status', 'PENDIENTE')
      if (updatedAlerts && setPendingAlerts) setPendingAlerts(updatedAlerts)
    } catch (e) {
      showFeedback('error', 'Error al solicitar OT: ' + e.message)
    }
  }

  const handleSubmitWorkerPermission = async () => {
    try {
      await submitWorkerPermissionService({ workerPermissionModal, workers })
      setWorkerPermissionModal({ isOpen: false, workerId: '', reason: '' })
      showFeedback('success', '🔔 Solicitud enviada para habilitar operario en Pañol.')
      const { data: updatedAlerts } = await supabase.from('compliance_alerts').select('*').eq('status', 'PENDIENTE')
      if (updatedAlerts && setPendingAlerts) setPendingAlerts(updatedAlerts)
    } catch (e) {
      showFeedback('error', 'Error al solicitar habilitación: ' + e.message)
    }
  }

  return (
    <>
      {showWithdrawalModal && (
        <MultiWithdrawalModal
          materials={materials}
          ships={ships}
          workOrders={workOrders}
          workItems={workItems}
          astilleroWorkers={astilleroWorkers}
          contractorGroups={contractorGroups}
          unauthorizedWorkers={unauthorizedWorkers}
          getEnabledWorkersAndContractors={getEnabledWorkersAndContractors}
          pendingAlerts={pendingAlerts}
          isAdmin={isAdmin}
          editingRow={editingWithdrawalRow}
          onRequestOt={(targetShipId, preselectedWorker) =>
            setRequestOtModal({ isOpen: true, txId: null, shipId: targetShipId || '', targetWorkerOrContractor: preselectedWorker || '', reason: '' })
          }
          onRequestWorkerPermission={() =>
            setWorkerPermissionModal({ isOpen: true, workerId: '', reason: '' })
          }
          onClose={() => {
            setShowWithdrawalModal(false)
            setEditingWithdrawalRow(null)
          }}
          onSave={handleSaveMultiWithdrawal}
        />
      )}

      {showNewMaterialModal && (
        <NewMaterialModal
          rubros={rubros}
          isAdmin={isAdmin}
          onClose={() => setShowNewMaterialModal(false)}
          onSave={handleSaveNewMaterial}
        />
      )}

      {showStockAdjustModal.isOpen && (
        <StockAdjustModal
          material={showStockAdjustModal.material}
          onClose={() => setShowStockAdjustModal({ isOpen: false, material: null })}
          onSave={handleSaveStockAdjust}
        />
      )}

      {showGasModal.isOpen && (
        <GasMovementModal
          operationType={showGasModal.operationType}
          materials={materials.filter((m) => m.rubro === 'GASES' || m.category === 'GASES' || m.name?.toUpperCase().includes('GAS') || m.name?.toUpperCase().includes('OXIGENO'))}
          suppliers={suppliers.filter((s) => s.is_gas_supplier)}
          ships={ships}
          workOrders={workOrders}
          workers={workers}
          onClose={() => setShowGasModal({ isOpen: false, operationType: 'PRIMERA_ENTREGA' })}
          onSave={handleSaveGasMovement}
        />
      )}

      {quickPurchaseModal.isOpen && (
        <QuickPurchaseModal
          material={quickPurchaseModal.material}
          initialQuantity={quickPurchaseModal.quantity}
          initialUrgency={quickPurchaseModal.urgency || 'SIN_APURO'}
          onClose={() => setQuickPurchaseModal({ isOpen: false, material: null, quantity: '', urgency: 'SIN_APURO' })}
          onConfirm={handleConfirmQuickPurchase}
        />
      )}

      <ImagePreviewModal
        previewImage={previewImage}
        onClose={() => setPreviewImage(null)}
      />

      <RequestOtModal
        isOpen={requestOtModal.isOpen}
        shipId={requestOtModal.shipId}
        targetWorkerOrContractor={requestOtModal.targetWorkerOrContractor}
        reason={requestOtModal.reason}
        ships={ships}
        astilleroWorkers={astilleroWorkers}
        contractorGroups={contractorGroups}
        onChangeShipId={(val) => setRequestOtModal((prev) => ({ ...prev, shipId: val }))}
        onChangeTargetWorkerOrContractor={(val) => setRequestOtModal((prev) => ({ ...prev, targetWorkerOrContractor: val }))}
        onChangeReason={(val) => setRequestOtModal((prev) => ({ ...prev, reason: val }))}
        onClose={() => setRequestOtModal({ isOpen: false, txId: null, shipId: '', targetWorkerOrContractor: '', reason: '' })}
        onSubmit={handleSubmitRequestOt}
      />

      <WorkerPermissionModal
        isOpen={workerPermissionModal.isOpen}
        workerId={workerPermissionModal.workerId}
        reason={workerPermissionModal.reason}
        unauthorizedWorkers={unauthorizedWorkers}
        onChangeWorkerId={(val) => setWorkerPermissionModal((prev) => ({ ...prev, workerId: val }))}
        onChangeReason={(val) => setWorkerPermissionModal((prev) => ({ ...prev, reason: val }))}
        onClose={() => setWorkerPermissionModal({ isOpen: false, workerId: '', reason: '' })}
        onSubmit={handleSubmitWorkerPermission}
      />
    </>
  )
}
