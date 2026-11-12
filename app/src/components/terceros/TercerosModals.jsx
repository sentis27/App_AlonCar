/**
 * TercerosModals.jsx
 * Contenedor integral de modales para el módulo de Terceros y Contratistas (M5 / DEC-017).
 * Encapsula:
 * 1. Modal de Carga Guiada en Cascada (5 bloques cromáticos GS-005).
 * 2. Modal de Evolución Rápida de Comprobante (RMO / RPF -> FCR o SDT).
 * 3. Modal de Auditoría y Conformidad Técnica (Jefes de Obra).
 * 4. Modal de Trazabilidad e Historial de Comprobante.
 * 5. ShipWorkOrderPickerModal y ContractorPickerModal.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Wrench,
  Building2,
  FileText,
  DollarSign,
  Ship,
  Search,
  X,
  ChevronDown,
  Clock,
  Lock,
  ArrowRight,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  History
} from 'lucide-react'
import ShipWorkOrderPickerModal from '../ShipWorkOrderPickerModal'
import ContractorPickerModal from '../ContractorPickerModal'
import {
  VOUCHER_TYPES,
  OFFICIAL_TRADES,
  getDollarRateForDate,
  computeEntryDateOrAmountChange
} from '../../lib/tercerosConstants.js'
import {
  saveServiceService,
  confirmEvolutionService,
  saveAuditService,
  saveShipWoPickerService,
  saveInlineEditService
} from '../../lib/tercerosService.js'
import { getEnabledWorkersAndContractors } from '../../lib/allocationEngine.js'
import { deduplicateWorkOrdersWithScope } from '../../lib/workOrdersConstants.js'
import { WorkOrderSelectorWithHover } from '../workOrders/WorkOrderSelectorWithHover.jsx'
import { WorkOrderScopeHoverCard } from '../workOrders/WorkOrderScopeHoverCard.jsx'

// ----------------------------------------------------------------------------
// COMPONENTE AUXILIAR: DESPLEGABLE DE CONTRATISTAS CON BÚSQUEDA REACTIVA
// ----------------------------------------------------------------------------
export function SearchableContractorSelect({ contractors = [], value = '', onChange, disabled = false }) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const containerRef = useRef(null)

  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const selectedContractor = useMemo(() => {
    if (!value) return null
    return contractors.find((c) => c.name.toUpperCase().trim() === value.toUpperCase().trim())
  }, [contractors, value])

  const filtered = useMemo(() => {
    if (!query.trim()) return contractors
    const q = query.toLowerCase().trim()
    return contractors.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.trade || '').toLowerCase().includes(q)
    )
  }, [contractors, query])

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative flex items-center">
        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none z-10" />
        <input
          type="text"
          disabled={disabled}
          placeholder="Escribí contratista y presioná Enter..."
          value={isOpen ? query : (selectedContractor ? `${selectedContractor.name} [${selectedContractor.trade || 'SIN RUBRO'}]` : '')}
          onFocus={() => {
            setIsOpen(true)
            setQuery('')
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && isOpen && filtered.length > 0) {
              e.preventDefault()
              onChange(filtered[0].name)
              setIsOpen(false)
              setQuery('')
            }
            if (e.key === 'Escape' || e.key === 'Tab') {
              setIsOpen(false)
            }
          }}
          className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-14 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 placeholder-slate-500 transition-colors cursor-pointer"
        />
        <div className="absolute right-1.5 flex items-center gap-0.5 z-10">
          {value && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={(e) => {
                e.stopPropagation()
                onChange('')
                setQuery('')
              }}
              className="p-1 text-slate-400 hover:text-white rounded-md hover:bg-slate-800"
              title="Borrar selección"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            type="button"
            tabIndex={-1}
            disabled={disabled}
            onClick={() => setIsOpen((prev) => !prev)}
            className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
          >
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 mt-1 max-h-52 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-1 divide-y divide-slate-800/60">
          {filtered.length === 0 ? (
            <div className="p-3 text-center text-slate-500 text-xs font-mono">
              No se encontraron contratistas que coincidan con &quot;{query}&quot;
            </div>
          ) : (
            filtered.map((c) => {
              const isSelected = selectedContractor?.name === c.name
              return (
                <button
                  key={c.id || c.name}
                  type="button"
                  tabIndex={-1}
                  onClick={() => {
                    onChange(c.name)
                    setIsOpen(false)
                    setQuery('')
                  }}
                  className={`w-full text-left px-2.5 py-1.5 rounded-lg flex items-center justify-between text-xs font-mono transition-colors cursor-pointer ${
                    isSelected ? 'bg-cyan-950 text-cyan-300 font-bold border border-cyan-700' : 'text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="truncate font-bold">{c.name}</span>
                    <span className="text-[10px] text-slate-400 shrink-0">
                      [{c.trade || 'SIN RUBRO'}]
                    </span>
                  </div>
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-950 text-purple-300 border border-purple-800 shrink-0">
                    {c.trade === 'MANUAL' ? 'Polirrubro' : '3ROS'}
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// CONTENEDOR INTEGRAL DE MODALES DE TERCEROS
// ----------------------------------------------------------------------------
export function TercerosModalsContainer({
  // Modal de Carga / Edición
  isModalOpen,
  setIsModalOpen,
  editingService,
  setEditingService,
  // Modal de Evolución
  evolvingService,
  setEvolvingService,
  // Modal de Auditoría
  auditingService,
  setAuditingService,
  // Modal de Historial
  historyService,
  setHistoryService,
  // Modal Pickers
  pickerModal,
  setPickerModal,
  contractorPickerModal,
  setContractorPickerModal,
  // Datos
  ships = [],
  workOrders = [],
  workItems = [],
  contractors = [],
  macroVariables = [],
  voucherHistory = [],
  services = [],
  shipMap = new Map(),
  otMap = new Map(),
  canEditAmounts = false,
  activeRolePerspective = 'maria_jose',
  user,
  loadData,
  showFeedback
}) {
  const actor = activeRolePerspective === 'admin' ? 'JORGE SENTIS' : (activeRolePerspective === 'jefe_obra' ? 'JEFE DE OBRA' : 'MARIA JOSE')

  // 1. ESTADO INTERNO DEL FORMULARIO DE CARGA / EDICIÓN
  const [formData, setFormData] = useState({
    ship_id: '',
    work_order_id: '',
    work_item_id: '',
    contractor_name: '',
    trade: '',
    is_manual_trade: false,
    voucher_type: 'PRC',
    voucher_number: '',
    budget_number: '',
    invoice_number: '',
    internal_remito_number: '',
    supplier_remito_number: '',
    voucher_date: new Date().toISOString().split('T')[0],
    entry_date: new Date().toISOString().split('T')[0],
    service_date: new Date().toISOString().split('T')[0],
    amount_ars: '',
    usd_rate: 1500,
    amount_usd: 0,
    direct_observations: '',
    specific_observations: '',
    audit_status: 'PENDIENTE'
  })
  const [savingService, setSavingService] = useState(false)

  // Sincronizar formulario cuando se abre el modal para edición o alta
  useEffect(() => {
    if (!isModalOpen) return

    if (editingService) {
      const foundContractor = contractors.find((c) => c.name.toUpperCase().trim() === (editingService.contractor_name || '').toUpperCase().trim())
      const isManual = foundContractor?.trade?.toUpperCase().trim() === 'MANUAL'
      const resolvedTrade = editingService.trade || (!isManual ? foundContractor?.trade || '' : '')

      const bNum = editingService.budget_number || (editingService.voucher_type === 'PRC' ? editingService.voucher_number || '' : '')
      const iNum = editingService.invoice_number || (['FCR', 'FCA', 'FAC', 'REC', 'FCB', 'FCC'].includes(editingService.voucher_type) ? editingService.voucher_number || '' : '')
      const sNum = editingService.supplier_remito_number || (['RMO', 'RPF'].includes(editingService.voucher_type) ? editingService.voucher_number || '' : '')

      const rate = getDollarRateForDate(editingService.entry_date || editingService.service_date, macroVariables) || editingService.usd_rate || 1500
      const ars = editingService.amount_ars !== null ? editingService.amount_ars : ''
      const usd = rate > 0 && ars ? Number((parseFloat(ars) / rate).toFixed(2)) : (editingService.amount_usd || 0)

      setFormData({
        ship_id: editingService.ship_id || '',
        work_order_id: editingService.work_order_id || '',
        work_item_id: editingService.work_item_id || '',
        contractor_name: editingService.contractor_name || '',
        trade: resolvedTrade,
        is_manual_trade: isManual,
        voucher_type: editingService.voucher_type || 'PRC',
        voucher_number: editingService.voucher_number || '',
        budget_number: bNum,
        invoice_number: iNum,
        internal_remito_number: editingService.internal_remito_number || '',
        supplier_remito_number: sNum,
        voucher_date: editingService.voucher_date || editingService.service_date || '',
        entry_date: editingService.entry_date || editingService.service_date || '',
        service_date: editingService.service_date || '',
        amount_ars: ars,
        usd_rate: rate,
        amount_usd: usd,
        direct_observations: editingService.direct_observations || '',
        specific_observations: editingService.specific_observations || '',
        audit_status: editingService.audit_status || 'PENDIENTE'
      })
    } else {
      const today = new Date().toISOString().split('T')[0]
      const defaultShipId = ships.length > 0 ? ships[0].id : ''
      const { usd_rate, amount_usd } = computeEntryDateOrAmountChange(today, 0, macroVariables)

      setFormData({
        ship_id: defaultShipId,
        work_order_id: '',
        work_item_id: '',
        contractor_name: '',
        trade: '',
        is_manual_trade: false,
        voucher_type: 'PRC',
        voucher_number: '',
        budget_number: '',
        invoice_number: '',
        internal_remito_number: '',
        supplier_remito_number: '',
        voucher_date: today,
        entry_date: today,
        service_date: today,
        amount_ars: '',
        usd_rate,
        amount_usd,
        direct_observations: '',
        specific_observations: '',
        audit_status: 'PENDIENTE'
      })
    }
  }, [isModalOpen, editingService, contractors, macroVariables, ships])

  const availableWorkOrdersForSelectedShip = useMemo(() => {
    if (!formData.ship_id) return []
    const dedup = deduplicateWorkOrdersWithScope(
      workOrders.filter((wo) => String(wo.ship_id) === String(formData.ship_id)),
      workItems
    )
    return dedup.filter(
      (wo) => wo.isActiveForImputation !== false || String(wo.id) === String(formData.work_order_id)
    )
  }, [workOrders, workItems, formData.ship_id, formData.work_order_id])

  const handleContractorSelect = (contractorName) => {
    const found = contractors.find((c) => c.name.toUpperCase().trim() === contractorName.toUpperCase().trim())
    const tradeUpper = (found?.trade || '').toUpperCase().trim()
    const isManual = tradeUpper === 'MANUAL' || tradeUpper === 'POLIRRUBRO'

    setFormData((prev) => ({
      ...prev,
      contractor_name: contractorName,
      trade: isManual ? '' : found?.trade || '',
      is_manual_trade: isManual
    }))
  }

  const handleSubmitService = async (e) => {
    e.preventDefault()
    setSavingService(true)
    try {
      const res = await saveServiceService({
        formData,
        editingService,
        canEditAmounts,
        contractors,
        macroVariables,
        actor
      })
      setIsModalOpen(false)
      await loadData()
      showFeedback('success', res.isNew ? `Comprobante de ${formData.contractor_name} (${formData.voucher_type}) cargado con éxito.` : `Comprobante de ${formData.contractor_name} actualizado.`)
    } catch (err) {
      showFeedback('error', 'Error al guardar comprobante: ' + (err.message || err))
    } finally {
      setSavingService(false)
    }
  }

  // 2. ESTADO INTERNO DEL FORMULARIO DE EVOLUCIÓN (DEC-017)
  const [evolutionForm, setEvolutionForm] = useState({
    target_voucher_type: 'FCR',
    new_voucher_number: '',
    voucher_date: new Date().toISOString().split('T')[0],
    final_amount_ars: '',
    evolution_notes: ''
  })
  const [savingEvolution, setSavingEvolution] = useState(false)

  useEffect(() => {
    if (evolvingService) {
      setEvolutionForm({
        target_voucher_type: 'FCR',
        new_voucher_number: '',
        voucher_date: new Date().toISOString().split('T')[0],
        final_amount_ars: evolvingService.amount_ars !== null ? evolvingService.amount_ars : '',
        evolution_notes: `Evolución de ${evolvingService.voucher_type} a Factura oficial respaldatoria.`
      })
    }
  }, [evolvingService])

  const handleConfirmEvolutionSubmit = async (e) => {
    e.preventDefault()
    setSavingEvolution(true)
    try {
      await confirmEvolutionService({ evolvingService, evolutionForm, actor })
      setEvolvingService(null)
      await loadData()
      showFeedback('success', `Comprobante evolucionado exitosamente a ${evolutionForm.target_voucher_type} (${evolutionForm.new_voucher_number}).`)
    } catch (err) {
      showFeedback('error', 'Error al evolucionar comprobante: ' + (err.message || err))
    } finally {
      setSavingEvolution(false)
    }
  }

  // 3. ESTADO INTERNO DEL FORMULARIO DE AUDITORÍA TÉCNICA
  const [auditForm, setAuditForm] = useState({
    audit_status: 'CONFORME',
    audit_notes: ''
  })
  const [savingAudit, setSavingAudit] = useState(false)

  useEffect(() => {
    if (auditingService) {
      setAuditForm({
        audit_status: auditingService.audit_status === 'CONFORME' ? 'CONFORME' : 'CONFORME',
        audit_notes: auditingService.audit_notes || ''
      })
    }
  }, [auditingService])

  const handleSaveAuditSubmit = async (e) => {
    e.preventDefault()
    setSavingAudit(true)
    try {
      await saveAuditService({ auditingService, auditForm, auditorName: actor })
      setAuditingService(null)
      await loadData()
      showFeedback('success', `Conformidad técnica guardada como "${auditForm.audit_status}".`)
    } catch (err) {
      showFeedback('error', 'Error al asentar auditoría técnica: ' + (err.message || err))
    } finally {
      setSavingAudit(false)
    }
  }

  return (
    <>
      {/* ==================================================================== */}
      {/* MODAL 1: CARGA GUIADA EN CASCADA (Barco -> Contratista 3ros -> OT)   */}
      {/* ==================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="alon-modal-card max-w-5xl animate-in fade-in zoom-in-95">
            <div className="alon-modal-header">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30 font-bold shrink-0">
                  <Wrench className="w-3.5 h-3.5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-black text-white truncate">
                    {editingService ? 'Editar Comprobante de Terceros' : 'Carga Guiada de Gasto de Terceros (GS-005)'}
                  </h3>
                  <p className="text-[11px] text-slate-400 truncate">
                    Recorrido guiado por color y tecla <strong className="text-slate-200">Tab</strong>: 1° Cascada de Obra ➔ 2° Tipo Comprobante ➔ 3° Observaciones ➔ 4° N° Comprobantes ➔ 5° Importes.
                  </p>
                </div>
              </div>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitService} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
              <div className="alon-modal-body">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
                  {/* COLUMNA IZQUIERDA: BLOQUES 1, 2 Y 3 */}
                  <div className="space-y-3">
                    {/* BLOQUE 1: CASCADA DE IMPUTACIÓN DE OBRA */}
                    <div className="alon-chunk-sky space-y-2.5">
                      <div className="flex items-center justify-between border-b border-sky-500/20 pb-1">
                        <span className="font-black text-sky-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <Ship className="w-3.5 h-3.5 text-sky-400" />
                          <span>1. Cascada de Imputación de Obra</span>
                        </span>
                        <span className="text-[10px] text-slate-400">Buque ➔ Contratista [3ros] ➔ OT</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* PASO 1: SELECCIONAR BARCO */}
                        <div>
                          <label className="block font-bold text-slate-300 text-[11px] mb-1">
                            1° Buque / Embarcación <span className="text-rose-400">*</span>
                          </label>
                          <select
                            autoFocus
                            required
                            value={formData.ship_id}
                            onChange={(e) => {
                              const newShipId = e.target.value
                              setFormData((prev) => ({
                                ...prev,
                                ship_id: newShipId,
                                work_order_id: ''
                              }))
                            }}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold focus:outline-none focus:border-cyan-400 text-xs"
                          >
                            <option value="">-- Seleccionar Buque --</option>
                            {ships.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} {s.current_location ? `[${s.current_location}]` : ''}
                              </option>
                            ))}
                          </select>
                        </div>

                        {/* PASO 3: SELECCIONAR ORDEN DE TRABAJO */}
                        <div>
                          <label className="block font-bold text-slate-300 text-[11px] mb-1">
                            3° Orden de Trabajo (OT)
                          </label>
                          <WorkOrderSelectorWithHover
                            value={formData.work_order_id}
                            onChange={(newWoId) => setFormData((prev) => ({ ...prev, work_order_id: newWoId }))}
                            availableWos={availableWorkOrdersForSelectedShip}
                            ship={ships.find((s) => String(s.id) === String(formData.ship_id))}
                            workItems={workItems}
                            allWorkOrders={workOrders}
                            contractorName={formData.contractor_name}
                            disabled={!formData.ship_id}
                            placeholder={!formData.ship_id ? '-- 1° elija buque --' : '-- ⚠️ Dejar OT en blanco --'}
                            showPreviewCard={true}
                          />
                        </div>
                      </div>

                      {/* PASO 2: SELECCIONAR CONTRATISTA */}
                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="font-bold text-slate-300 text-[11px] flex items-center gap-1">
                            <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                            <span>2° Contratista o Taller Autorizado [3ros] ({contractors.length}) <span className="text-rose-400">*</span></span>
                          </label>
                          {!formData.is_manual_trade && formData.trade && (
                            <span className="text-[10px] font-bold text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-800/60">
                              Rubro: {formData.trade}
                            </span>
                          )}
                        </div>

                        <SearchableContractorSelect
                          contractors={contractors}
                          value={formData.contractor_name}
                          onChange={handleContractorSelect}
                        />

                        {/* MANEJO DE RUBRO MANUAL / POLIRRUBRO */}
                        {formData.is_manual_trade && (
                          <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/50 space-y-1 mt-1.5">
                            <div className="flex items-center gap-1.5 text-amber-300 font-bold text-[10px]">
                              <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                              <span>Proveedor Polirrubro (MANUAL): Seleccione el rubro aplicable al trabajo</span>
                            </div>
                            <select
                              required
                              value={formData.trade}
                              onChange={(e) => setFormData((prev) => ({ ...prev, trade: e.target.value }))}
                              className="w-full bg-slate-950 border border-amber-600/70 rounded-lg px-2.5 py-1 text-amber-200 text-xs focus:outline-none"
                            >
                              <option value="">-- Seleccionar Rubro Oficial --</option>
                              {OFFICIAL_TRADES.map((t) => (
                                <option key={t} value={t}>
                                  {t}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* BLOQUE 2: TIPO DE COMPROBANTE PRINCIPAL */}
                    <div className="alon-chunk-amber space-y-1.5">
                      <div className="flex items-center justify-between border-b border-amber-500/20 pb-1">
                        <span className="font-black text-amber-400 uppercase tracking-wider text-[11px]">
                          2. Tipo de Comprobante Principal (DEC-017) *
                        </span>
                      </div>
                      <select
                        value={formData.voucher_type}
                        onChange={(e) => {
                          const vCode = e.target.value
                          setFormData((prev) => ({
                            ...prev,
                            voucher_type: vCode
                          }))
                        }}
                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold focus:outline-none focus:border-amber-400 text-xs"
                      >
                        {VOUCHER_TYPES.map((v) => (
                          <option key={v.code} value={v.code}>
                            {v.label}
                          </option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400 italic leading-snug">
                        {VOUCHER_TYPES.find((v) => v.code === formData.voucher_type)?.description}
                      </p>
                    </div>

                    {/* BLOQUE 3: OBSERVACIONES TÉCNICAS Y ADMINISTRATIVAS */}
                    <div className="alon-chunk-indigo space-y-2">
                      <div className="flex items-center justify-between border-b border-indigo-500/20 pb-1">
                        <span className="font-black text-indigo-400 uppercase tracking-wider text-[11px]">
                          3. Observaciones Técnicas y Administrativas
                        </span>
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        <div>
                          <label className="block font-bold text-slate-300 text-[11px] mb-1">
                            Observaciones Directas (Detalle técnico de la tarea ejecutada)
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Describa el trabajo realizado por el contratista en la obra..."
                            value={formData.direct_observations}
                            onChange={(e) => setFormData((prev) => ({ ...prev, direct_observations: e.target.value }))}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-400 text-xs"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-slate-300 text-[11px] mb-1">
                            Observaciones Específicas (Administración / Reclamo de Facturas)
                          </label>
                          <textarea
                            rows={2}
                            placeholder="Notas contables, reclamos de facturas pendientes, condiciones de pago..."
                            value={formData.specific_observations}
                            onChange={(e) => setFormData((prev) => ({ ...prev, specific_observations: e.target.value }))}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-400 text-xs"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* COLUMNA DERECHA: BLOQUES 4 Y 5 */}
                  <div className="space-y-3">
                    {/* BLOQUE 4: IDENTIFICACIÓN DE COMPROBANTES ASOCIADOS */}
                    <div className="alon-chunk-purple space-y-2.5">
                      <div className="flex items-center justify-between border-b border-purple-500/20 pb-1">
                        <span className="font-black text-purple-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <FileText className="w-3.5 h-3.5 text-purple-400" />
                          <span>4. Identificación de Comprobantes Asociados</span>
                        </span>
                        <span className="text-[10px] text-slate-400">Múltiples admitidos</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        {/* 1. Nº Presupuesto Interno (PRC) */}
                        <div className="space-y-1">
                          <label className="font-bold text-[11px] flex items-center justify-between">
                            <span className={formData.voucher_type === 'PRC' ? 'text-amber-300 font-black' : 'text-slate-300'}>
                              Nº Presupuesto (PRC) {formData.voucher_type === 'PRC' && '*'}
                            </span>
                            <span className="text-[9px] text-amber-500 font-mono">PRC</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: 104 o PRC-2026-01"
                            value={formData.budget_number || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, budget_number: e.target.value }))}
                            className={`w-full bg-slate-900 border rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none ${
                              formData.voucher_type === 'PRC' && !formData.budget_number?.trim()
                                ? 'border-amber-500/80 focus:border-amber-400'
                                : 'border-slate-700 focus:border-cyan-400'
                            }`}
                          />
                        </div>

                        {/* 2. Nº Factura Fiscal (FCR) */}
                        <div className="space-y-1">
                          <label className="font-bold text-[11px] flex items-center justify-between">
                            <span className={['FCR', 'FCA', 'FAC', 'REC', 'FCB', 'FCC'].includes(formData.voucher_type) ? 'text-emerald-300 font-black' : 'text-slate-300'}>
                              Nº Factura Fiscal
                            </span>
                            <span className="text-[9px] text-emerald-500 font-mono">FCR / FCA</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: FAC-B-0004-00012480"
                            value={formData.invoice_number || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                          />
                        </div>

                        {/* 3. Nº Remito Alon Car */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-300 text-[11px] flex items-center justify-between">
                            <span>Nº Remito Alon Car</span>
                            <span className="text-[9px] text-cyan-500 font-mono">PAÑOL</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: 1042 (Cruce Pañol)"
                            value={formData.internal_remito_number || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, internal_remito_number: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                          />
                        </div>

                        {/* 4. Nº Remito Proveedor */}
                        <div className="space-y-1">
                          <label className="font-bold text-slate-300 text-[11px] flex items-center justify-between">
                            <span>Nº Remito Proveedor</span>
                            <span className="text-[9px] text-purple-400 font-mono">RPF / RMO</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Ej: RMO-789"
                            value={formData.supplier_remito_number || ''}
                            onChange={(e) => setFormData(prev => ({ ...prev, supplier_remito_number: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                          />
                        </div>
                      </div>
                    </div>

                    {/* BLOQUE 5: FECHA DE CARGA, IMPORTE AR$ Y CONVERSIÓN US$ */}
                    <div className="alon-chunk-emerald space-y-2.5">
                      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1">
                        <span className="font-black text-emerald-400 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                          <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
                          <span>5. Fecha de Carga, Importe AR$ y Conversión US$</span>
                        </span>
                        <span className="text-[10px] text-emerald-300 font-mono">Quincena Oficial</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="font-bold text-slate-300 text-[11px] block">
                            Fecha de Carga (A mano) <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="date"
                            required
                            value={formData.entry_date}
                            onChange={(e) => {
                              const newDate = e.target.value
                              const { usd_rate, amount_usd } = computeEntryDateOrAmountChange(newDate, formData.amount_ars, macroVariables)
                              setFormData((prev) => ({
                                ...prev,
                                entry_date: newDate,
                                service_date: newDate,
                                usd_rate,
                                amount_usd
                              }))
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-cyan-400 font-mono text-xs"
                          />
                          <span className="text-[10px] text-slate-500 block">Fija cotización de quincena</span>
                        </div>

                        <div className="space-y-1">
                          <label className="font-bold text-amber-300 text-[11px] block">
                            Importe AR$ <span className="text-rose-400">*</span>
                          </label>
                          <div className="relative">
                            <input
                              type="number"
                              step="any"
                              placeholder="0.00"
                              disabled={editingService && !canEditAmounts}
                              value={formData.amount_ars}
                              onChange={(e) => {
                                const newArs = e.target.value
                                const { usd_rate, amount_usd } = computeEntryDateOrAmountChange(formData.entry_date, newArs, macroVariables)
                                setFormData((prev) => ({
                                  ...prev,
                                  amount_ars: newArs,
                                  usd_rate,
                                  amount_usd
                                }))
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-2.5 pr-7 py-1.5 text-white font-mono font-bold text-xs focus:outline-none focus:border-amber-400 disabled:opacity-50"
                            />
                            {editingService && !canEditAmounts && (
                              <Lock className="w-3.5 h-3.5 text-amber-400 absolute right-2.5 top-2" title="Edición de montos bloqueada" />
                            )}
                          </div>
                          <span className="text-[10px] text-slate-500 block">Monto en pesos</span>
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-emerald-500/30 flex items-center justify-between gap-2">
                        <div>
                          <span className="text-[10px] font-bold text-cyan-300 flex items-center gap-1">
                            <Lock className="w-3 h-3 text-cyan-400" />
                            Cotiz. Dólar Intocable: ${Number(formData.usd_rate).toLocaleString('es-AR')}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono block">
                            {formData.amount_ars && formData.usd_rate > 0
                              ? `$${Number(formData.amount_ars).toLocaleString('es-AR')} ÷ $${formData.usd_rate}`
                              : 'Calculado automáticamente según fecha'}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-emerald-400 uppercase font-bold block">Equivalente</span>
                          <span className="text-sm font-black font-mono text-white">US$ {formData.amount_usd}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* BOTONES DE ACCIÓN FIJOS */}
              <div className="alon-modal-footer">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingService}
                  className="px-5 py-1.5 bg-gradient-to-r from-cyan-400 to-blue-500 hover:brightness-110 text-slate-950 rounded-xl text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {savingService ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <span>{editingService ? 'Actualizar Comprobante' : 'Guardar Comprobante'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 2: EVOLUCIÓN RÁPIDA DE COMPROBANTE (RMO / RPF -> FCR o SDT)     */}
      {/* ==================================================================== */}
      {evolvingService && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-amber-500/50 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/40 font-bold">
                  ⚡
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">Evolución de Comprobante (DEC-017)</h3>
                  <p className="text-xs text-amber-300/80">
                    Pasar {evolvingService.voucher_type} a Factura Oficial Definitiva (FCR)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEvolvingService(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmEvolutionSubmit} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <p className="font-bold text-slate-200">
                  Proveedor: <span className="text-cyan-400">{evolvingService.contractor_name}</span>
                </p>
                <p className="text-slate-400">
                  Comprobante actual: <span className="font-mono text-amber-300 font-bold">{evolvingService.voucher_type}</span> ({evolvingService.voucher_number || 'S/N'})
                </p>
                <p className="text-slate-400">
                  Importe actual registrado: <span className="font-mono text-white font-bold">${Number(evolvingService.amount_ars).toLocaleString('es-AR')}</span>
                </p>
              </div>

              {/* Tipo de Destino */}
              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                  Evolucionar a *
                </label>
                <select
                  value={evolutionForm.target_voucher_type}
                  onChange={(e) => setEvolutionForm((prev) => ({ ...prev, target_voucher_type: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-400 font-bold"
                >
                  <option value="FCR">FCR - Factura Fiscal Oficial Definitiva (Recomendado)</option>
                  {evolvingService.voucher_type === 'RMO' && (
                    <option value="SDT">SDT - Sin Documentación Fiscal (Cierre excepcional)</option>
                  )}
                </select>
              </div>

              {/* Número de Factura */}
              {evolutionForm.target_voucher_type === 'FCR' && (
                <div className="space-y-1">
                  <label className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                    Número de Factura Fiscal Oficial *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: FAC-A-0001-00012345"
                    value={evolutionForm.new_voucher_number}
                    onChange={(e) => setEvolutionForm((prev) => ({ ...prev, new_voucher_number: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
              )}

              {/* Fecha y Monto Final */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300 text-[11px]">
                    Fecha de Factura
                  </label>
                  <input
                    type="date"
                    required
                    value={evolutionForm.voucher_date}
                    onChange={(e) => setEvolutionForm((prev) => ({ ...prev, voucher_date: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono text-xs focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-300 text-[11px]">
                    Monto Final Facturado AR$
                  </label>
                  <input
                    type="number"
                    step="any"
                    disabled={!canEditAmounts}
                    value={evolutionForm.final_amount_ars}
                    onChange={(e) => setEvolutionForm((prev) => ({ ...prev, final_amount_ars: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white font-mono font-bold text-xs focus:outline-none disabled:opacity-50"
                  />
                </div>
              </div>

              {/* Notas de Evolución */}
              <div className="space-y-1">
                <label className="font-bold text-slate-300 text-[11px]">
                  Constancia / Motivo del Pase
                </label>
                <textarea
                  rows={2}
                  value={evolutionForm.evolution_notes}
                  onChange={(e) => setEvolutionForm((prev) => ({ ...prev, evolution_notes: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                />
              </div>

              {/* Botones */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEvolvingService(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingEvolution}
                  className="px-5 py-2 bg-gradient-to-r from-amber-400 to-amber-500 hover:brightness-110 text-slate-950 font-extrabold rounded-xl flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
                >
                  {savingEvolution ? 'Evolucionando...' : 'Confirmar Pase a Factura Oficial'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 3: AUDITORÍA TÉCNICA (Jefes de Obra)                           */}
      {/* ==================================================================== */}
      {auditingService && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-emerald-400" />
                <h3 className="text-base font-bold text-white">Conformidad Técnica de Obra</h3>
              </div>
              <button
                type="button"
                onClick={() => setAuditingService(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAuditSubmit} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <p className="font-bold text-slate-200">
                  {auditingService.contractor_name} — <span className="text-cyan-400">{auditingService.voucher_type}</span>
                </p>
                <p className="text-slate-400">
                  Buque: {shipMap.get(auditingService.ship_id)?.name} | OT: {otMap.get(auditingService.work_order_id)?.ot_number || 'S/N'}
                </p>
                {auditingService.direct_observations && (
                  <p className="text-slate-500 text-[11px] italic">
                    "{auditingService.direct_observations}"
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                  Estado de Auditoría Técnica *
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAuditForm((prev) => ({ ...prev, audit_status: 'CONFORME' }))}
                    className={`py-2 rounded-xl font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      auditForm.audit_status === 'CONFORME'
                        ? 'bg-emerald-950 border-emerald-400 text-emerald-300 ring-1 ring-emerald-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>CONFORME</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuditForm((prev) => ({ ...prev, audit_status: 'OBSERVADO' }))}
                    className={`py-2 rounded-xl font-bold border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      auditForm.audit_status === 'OBSERVADO'
                        ? 'bg-rose-950 border-rose-400 text-rose-300 ring-1 ring-rose-400'
                        : 'bg-slate-950 border-slate-800 text-slate-400'
                    }`}
                  >
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>OBSERVADO</span>
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-300 text-[11px]">
                  Notas u Observaciones del Jefe de Obra
                </label>
                <textarea
                  rows={3}
                  placeholder="Detalle de inspección dimensional, prueba hidráulica, ensayo o inconformidad..."
                  value={auditForm.audit_notes}
                  onChange={(e) => setAuditForm((prev) => ({ ...prev, audit_notes: e.target.value }))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs focus:outline-none"
                />
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAuditingService(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={savingAudit}
                  className="px-5 py-2 bg-cyan-400 text-slate-950 font-extrabold rounded-xl hover:brightness-110 disabled:opacity-50 cursor-pointer"
                >
                  {savingAudit ? 'Guardando...' : 'Asentar Conformidad'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 4: HISTORIAL DE TRAZABILIDAD DEL COMPROBANTE                  */}
      {/* ==================================================================== */}
      {historyService && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-cyan-400" />
                <h3 className="text-base font-bold text-white">Trazabilidad del Comprobante</h3>
              </div>
              <button
                type="button"
                onClick={() => setHistoryService(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                <h4 className="font-bold text-white uppercase">{historyService.contractor_name}</h4>
                <p className="text-slate-400 text-[11px] mt-0.5">
                  Estado actual: <span className="font-mono text-cyan-300 font-bold">{historyService.voucher_type}</span> - N° {historyService.voucher_number || 'S/N'}
                </p>
                <p className="text-slate-400 text-[11px]">
                  Cargado por: <span className="text-slate-200">{historyService.created_by || 'Administración'}</span> ({historyService.created_at?.split('T')[0]})
                </p>
              </div>

              <div className="space-y-3">
                <h5 className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">
                  Historial de Evoluciones (Pases de Estado)
                </h5>

                {voucherHistory.filter((h) => h.third_party_service_id === historyService.id).length === 0 ? (
                  <p className="text-slate-500 italic p-3 bg-slate-950/40 rounded-xl border border-slate-800/60 text-center">
                    Este comprobante permanece en su estado original ({historyService.voucher_type}). No ha tenido evoluciones de comprobante.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {voucherHistory
                      .filter((h) => h.third_party_service_id === historyService.id)
                      .map((h) => (
                        <div key={h.id} className="p-3 bg-slate-950/80 rounded-xl border border-slate-800 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-amber-300 flex items-center gap-1.5 font-mono">
                              <span>{h.from_voucher_type}</span>
                              <ArrowRight className="w-3 h-3 text-slate-500" />
                              <span className="text-cyan-300">{h.to_voucher_type}</span>
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono">
                              {h.created_at?.split('T')[0]}
                            </span>
                          </div>
                          {h.voucher_number && (
                            <p className="text-slate-300 font-mono text-[11px]">
                              Nuevo N°: {h.voucher_number}
                            </p>
                          )}
                          {h.notes && (
                            <p className="text-slate-400 text-[11px] italic">
                              "{h.notes}"
                            </p>
                          )}
                          <p className="text-[10px] text-slate-500">
                            Por: <span className="text-slate-400 font-semibold">{h.changed_by || 'Sistema'}</span>
                          </p>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end">
                <button
                  type="button"
                  onClick={() => setHistoryService(null)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal enfocado de Buque / OT en Doble Clic */}
      <ShipWorkOrderPickerModal
        isOpen={pickerModal.isOpen}
        onClose={() => setPickerModal({ isOpen: false, serviceId: null, shipId: '', workOrderId: '', contractorName: '' })}
        ships={ships}
        workOrders={workOrders}
        workItems={workItems}
        currentShipId={pickerModal.shipId}
        currentWorkOrderId={pickerModal.workOrderId}
        contractorName={pickerModal.contractorName}
        title="Asignar Buque y OT al Comprobante de Terceros"
        onSave={async ({ shipId, workOrderId }) => {
          try {
            await saveShipWoPickerService({
              serviceId: pickerModal.serviceId,
              shipId,
              workOrderId,
              services,
              actor
            })
            setPickerModal({ isOpen: false, serviceId: null, shipId: '', workOrderId: '', contractorName: '' })
            await loadData()
            if (!workOrderId) {
              showFeedback('success', 'Buque asignado. OT dejada en blanco (sumada a KPI Falta Cargar OT).')
            } else {
              showFeedback('success', 'Buque y OT asignados con éxito.')
            }
          } catch (err) {
            showFeedback('error', 'Error al guardar Buque y OT: ' + err.message)
          }
        }}
      />

      {/* MODAL CANÓNICO: ASIGNACIÓN DE CONTRATISTA */}
      <ContractorPickerModal
        isOpen={contractorPickerModal.isOpen}
        onClose={() =>
          setContractorPickerModal({
            isOpen: false,
            serviceId: null,
            currentValue: '',
            shipId: '',
            shipName: '',
            workOrderId: '',
            workOrderTitle: '',
            isOtBlank: true
          })
        }
        currentValue={contractorPickerModal.currentValue}
        shipName={contractorPickerModal.shipName}
        workOrderTitle={contractorPickerModal.workOrderTitle}
        isOtBlank={contractorPickerModal.isOtBlank}
        astilleroWorkers={getEnabledWorkersAndContractors(contractorPickerModal.shipId, contractorPickerModal.workOrderId, workItems).astilleroWorkers}
        contractorGroups={getEnabledWorkersAndContractors(contractorPickerModal.shipId, contractorPickerModal.workOrderId, workItems).contractorGroups}
        onSelect={async (selectedName) => {
          if (contractorPickerModal.serviceId) {
            try {
              await saveInlineEditService({
                serviceId: contractorPickerModal.serviceId,
                field: 'contractor_name',
                newValue: selectedName,
                services,
                macroVariables,
                contractors,
                actor
              })
              setContractorPickerModal({
                isOpen: false,
                serviceId: null,
                currentValue: '',
                shipId: '',
                shipName: '',
                workOrderId: '',
                workOrderTitle: '',
                isOtBlank: true
              })
              await loadData()
              showFeedback('success', 'Contratista asignado con éxito.')
            } catch (err) {
              showFeedback('error', 'Error al asignar contratista: ' + err.message)
            }
          }
        }}
      />
    </>
  )
}
