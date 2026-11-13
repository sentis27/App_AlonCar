import { useState, useEffect, useMemo } from 'react'
import {
  ClipboardList,
  Calendar,
  X,
  Plus,
  ArrowRight,
  GitBranch,
  ShieldCheck,
  Eye,
  MessageSquare,
  Send,
  Sparkles,
  Pencil,
  Trash2,
  Lock,
  User,
  Info,
  CheckCircle2
} from 'lucide-react'
import {
  ESTADOS_TRABAJO,
  TIPOS_DE_TRABAJO,
  GRUPOS_CATALOGO,
  BUDGET_PENDING_VALUE,
  FACTURACION_CENTRO_INFO,
  extractBudgetDigits,
  formatSpecificBudgetLabel,
  formatShortDate,
  computeOtState,
  isWorkItemEliminada,
  getNextOtNumberForShip,
  cleanWorkItemComment
} from '../../lib/workOrdersConstants.js'
import {
  saveWorkOrderService,
  createForemanInlineService,
  separateWorkItemService,
  saveThirdPartyCascadeService,
  saveThirdPartyEditService,
  closeOtWithValidationService,
  closeEntireWorkOrderTreeService,
  submitAmpliarService,
  saveTemplateService,
  deleteTemplateService
} from '../../lib/workOrdersService.js'

export function WorkOrdersModalsContainer({
  // WorkModal trigger
  isWorkModalOpen,
  setIsWorkModalOpen,
  editingWorkItem,
  preselectedWo,
  // SeparateModal trigger
  separatingRow,
  setSeparatingRow,
  // ThirdPartyCascadeModal trigger
  isThirdPartyCascadeOpen,
  setIsThirdPartyCascadeOpen,
  // EditingThirdPartyModal trigger
  editingThirdParty,
  setEditingThirdParty,
  // Wo360DetailModal trigger
  selectedWoDetail,
  setSelectedWoDetail,
  // TemplateModal trigger
  isTemplateModalOpen,
  setIsTemplateModalOpen,
  templatePickerFromForm,
  setTemplatePickerFromForm,
  // Data
  ships = [],
  workOrders = [],
  templates = [],
  workers = [],
  foremenList = [],
  contractorCatalog = [],
  activeExecutionRows = [],
  itemsByWoMap = {},
  otMetricsAndDatesMap = {},
  thirdPartyByItemMap = {},
  user,
  loadData,
  showWoGridFeedback,
  onOpenNewWorkModal,
  onOpenSeparateModal
}) {
  // -------------------------------------------------------------
  // 1. ESTADOS LOCALES DEL WORK MODAL
  // -------------------------------------------------------------
  const [workForm, setWorkForm] = useState({
    ship_id: '',
    ot_mode: 'new',
    existing_wo_id: '',
    ot_creation_type: 'tabulada',
    selected_template_id: '',
    ot_number: 'OT-1',
    ot_title: '',
    created_date: new Date().toISOString().split('T')[0],
    description: '',
    status: 'En ejecución',
    foreman_name: '',
    work_type: 'HORA',
    assignment_type: 'Presupuesto General',
    specific_budget_id: '',
    contractors: [],
    comments: '',
    send_to_third_party_prc: false,
    specific_observations: ''
  })
  const [savingWork, setSavingWork] = useState(false)
  const [selectedBatchTemplates, setSelectedBatchTemplates] = useState([])
  const [inlineCatalogSearch, setInlineCatalogSearch] = useState('')
  const [showInlineMultiPicker, setShowInlineMultiPicker] = useState(false)
  const [contractorSelectInput, setContractorSelectInput] = useState('')
  const [isContractorListOpen, setIsContractorListOpen] = useState(false)
  const [isCreatingForemanInline, setIsCreatingForemanInline] = useState(false)
  const [newForemanForm, setNewForemanForm] = useState({ name: '', trade: 'TECNICOS' })
  const [savingNewForeman, setSavingNewForeman] = useState(false)
  const [showFacturacionInfo, setShowFacturacionInfo] = useState(false)
  const [budgetOptionMode, setBudgetOptionMode] = useState('PENDIENTE')

  // Sincronizar apertura de WorkModal
  useEffect(() => {
    if (!isWorkModalOpen) return
    if (editingWorkItem) {
      const row = editingWorkItem
      const tp = row.thirdPartyRecord
      const rawBudget = String(row.specific_budget_id ?? '').trim()
      const existingDigits = rawBudget.toUpperCase() === BUDGET_PENDING_VALUE ? '' : extractBudgetDigits(rawBudget)
      setBudgetOptionMode(existingDigits ? 'CONOCIDO' : 'PENDIENTE')
      setWorkForm({
        ship_id: row.wo?.ship_id || '',
        ot_mode: 'existing',
        existing_wo_id: row.work_order_id,
        ot_creation_type: row.wo?.is_tabulated ? 'tabulada' : 'libre',
        selected_template_id: '',
        ot_number: row.wo?.ot_number || 'OT-1',
        ot_title: (row.wo?.title || '').toUpperCase(),
        created_date: row.wo?.created_at ? String(row.wo.created_at).split('T')[0] : new Date().toISOString().split('T')[0],
        description: row.description || '',
        status: row.status || 'En ejecución',
        foreman_name: row.foreman_name || foremenList[0] || 'ALE CAMADELLI',
        work_type: row.work_type || 'HORA',
        assignment_type: row.assignment_type || 'Presupuesto General',
        specific_budget_id: existingDigits || '',
        contractors: Array.isArray(row.contractors) ? [...row.contractors] : [],
        comments: cleanWorkItemComment(row.comments),
        send_to_third_party_prc: Boolean(row.send_to_third_party_prc || tp),
        specific_observations: tp?.specific_observations || ''
      })
    } else {
      const defaultShipId = preselectedWo ? preselectedWo.ship_id : (ships[0]?.id || '')
      const shipWos = workOrders.filter((w) => w.ship_id === defaultShipId)
      setBudgetOptionMode('PENDIENTE')
      setWorkForm({
        ship_id: defaultShipId,
        ot_mode: preselectedWo ? 'existing' : (shipWos.length > 0 ? 'existing' : 'new'),
        existing_wo_id: preselectedWo ? preselectedWo.id : (shipWos[0]?.id || ''),
        ot_creation_type: 'tabulada',
        selected_template_id: '',
        ot_number: getNextOtNumberForShip(workOrders, defaultShipId),
        ot_title: '',
        created_date: new Date().toISOString().split('T')[0],
        description: '',
        status: 'En ejecución',
        foreman_name: preselectedWo?.foreman_name || foremenList[0] || 'ALE CAMADELLI',
        work_type: 'HORA',
        assignment_type: 'Presupuesto General',
        specific_budget_id: '',
        contractors: [],
        comments: '',
        send_to_third_party_prc: false,
        specific_observations: ''
      })
    }
    setSelectedBatchTemplates([])
    setInlineCatalogSearch('')
    setShowInlineMultiPicker(false)
    setContractorSelectInput('')
    setIsContractorListOpen(false)
    setIsCreatingForemanInline(false)
    setShowFacturacionInfo(false)
  }, [isWorkModalOpen, editingWorkItem, preselectedWo, ships, workOrders, foremenList])

  const hasThirdPartyPermission = (contractorName) => {
    if (!contractorName) return false
    const key = contractorName.trim().toUpperCase()
    return workers.some(
      (w) =>
        ((w.work_group || '').trim().toUpperCase() === key ||
          (w.name || '').trim().toUpperCase() === key) &&
        Boolean(w.can_charge_third_party)
    )
  }

  const thirdPartyPrcEvaluation = useMemo(() => {
    const list = workForm.contractors || []
    if (list.length === 0) return { canEnable: false, reason: 'Seleccioná un contratista con permiso "3ros" activo.' }
    if (list.length > 1) return { canEnable: false, reason: `Solo se permite PRC $0 con un único contratista (${list.length} seleccionados).` }
    const allowed = hasThirdPartyPermission(list[0])
    return allowed
      ? { canEnable: true, contractor: list[0], reason: `Habilitado: "${list[0]}" posee permiso 3ros.` }
      : { canEnable: false, reason: `"${list[0]}" no tiene permiso 3ros activo.` }
  }, [workForm.contractors, workers])

  const handleSaveWorkSubmit = async (e) => {
    e.preventDefault()
    if (!workForm.ship_id) {
      alert('Seleccioná un Barco.')
      return
    }
    setSavingWork(true)
    try {
      await saveWorkOrderService({
        workForm,
        editingWorkItem,
        selectedBatchTemplates,
        workers,
        user,
        getNextOtNumberForShip: (shipId, off) => getNextOtNumberForShip(workOrders, shipId, off)
      })
      setIsWorkModalOpen(false)
      await loadData()
      showWoGridFeedback('success', 'Trabajo y Orden de Trabajo guardados correctamente.')
    } catch (err) {
      showWoGridFeedback('error', 'Error al guardar: ' + err.message)
    } finally {
      setSavingWork(false)
    }
  }

  const handleCreateForemanInline = async () => {
    setSavingNewForeman(true)
    try {
      const w = await createForemanInlineService(newForemanForm, workers, user)
      setWorkForm((prev) => ({ ...prev, foreman_name: w.name }))
      setIsCreatingForemanInline(false)
      await loadData()
      showWoGridFeedback('success', `Jefe de Obra "${w.name}" creado con éxito.`)
    } catch (err) {
      showWoGridFeedback('error', err.message)
    } finally {
      setSavingNewForeman(false)
    }
  }

  // -------------------------------------------------------------
  // 2. ESTADOS LOCALES DE SEPARAR TRABAJO
  // -------------------------------------------------------------
  const [separateForm, setSeparateForm] = useState({
    mode: 'new_ot',
    ot_creation_type: 'libre',
    selected_template_id: '',
    new_ot_number: 'OT-1',
    new_ot_title: '',
    target_existing_wo_id: '',
    migrate_linked_records: true,
    reason: 'Se independiza el trabajo en una OT propia para seguimiento individual'
  })
  const [savingSeparate, setSavingSeparate] = useState(false)

  useEffect(() => {
    if (!separatingRow) return
    const shipId = separatingRow.wo?.ship_id
    const otherWos = workOrders.filter((w) => w.ship_id === shipId && w.id !== separatingRow.work_order_id)
    setSeparateForm({
      mode: 'new_ot',
      ot_creation_type: 'libre',
      selected_template_id: '',
      new_ot_number: getNextOtNumberForShip(workOrders, shipId),
      new_ot_title: separatingRow.description ? separatingRow.description.split('\n')[0].slice(0, 55).toUpperCase() : `${separatingRow.wo?.title || 'TRABAJO'} (SEPARADO)`,
      target_existing_wo_id: otherWos[0]?.id || '',
      migrate_linked_records: true,
      reason: 'Se independiza el trabajo en una OT propia para seguimiento individual'
    })
  }, [separatingRow, workOrders])

  const handleConfirmSeparateWorkItem = async (e) => {
    e.preventDefault()
    setSavingSeparate(true)
    try {
      const label = await separateWorkItemService({
        separateForm,
        separatingRow,
        user,
        getNextOtNumberForShip: (sId) => getNextOtNumberForShip(workOrders, sId),
        workOrders
      })
      setSeparatingRow(null)
      await loadData()
      showWoGridFeedback('success', `Trabajo separado hacia ${label}.`)
    } catch (err) {
      showWoGridFeedback('error', 'Error al separar: ' + err.message)
    } finally {
      setSavingSeparate(false)
    }
  }

  // -------------------------------------------------------------
  // 3. ESTADOS LOCALES DE TERCEROS CASCADA
  // -------------------------------------------------------------
  const [tpCascadeForm, setTpCascadeForm] = useState({
    ship_id: '',
    contractor_name: '',
    work_item_id: '',
    service_date: new Date().toISOString().split('T')[0],
    status: 'PRC',
    voucher_number: '',
    amount_ars: 0,
    specific_observations: ''
  })
  const [savingTpCascade, setSavingTpCascade] = useState(false)

  const enabledThirdPartyContractorsForShip = useMemo(() => {
    if (!tpCascadeForm.ship_id) return []
    const set = new Set()
    activeExecutionRows
      .filter((r) => r.wo?.ship_id === tpCascadeForm.ship_id)
      .forEach((r) => {
        ;(r.contractors || []).forEach((c) => {
          if (hasThirdPartyPermission(c)) set.add(c)
        })
      })
    return Array.from(set).sort()
  }, [activeExecutionRows, tpCascadeForm.ship_id, workers])

  const enabledWorkItemsForShipAndContractor = useMemo(() => {
    if (!tpCascadeForm.ship_id || !tpCascadeForm.contractor_name) return []
    return activeExecutionRows.filter(
      (r) =>
        r.wo?.ship_id === tpCascadeForm.ship_id &&
        (r.contractors || []).includes(tpCascadeForm.contractor_name)
    )
  }, [activeExecutionRows, tpCascadeForm.ship_id, tpCascadeForm.contractor_name])

  const selectedTpCascadeWorkItem = useMemo(() => {
    return enabledWorkItemsForShipAndContractor.find((r) => r.id === tpCascadeForm.work_item_id) || null
  }, [enabledWorkItemsForShipAndContractor, tpCascadeForm.work_item_id])

  const handleSaveTpCascade = async (e) => {
    e.preventDefault()
    if (!selectedTpCascadeWorkItem) {
      alert('Seleccioná un Barco, Contratista habilitado y Orden de Trabajo.')
      return
    }
    setSavingTpCascade(true)
    try {
      await saveThirdPartyCascadeService(tpCascadeForm, selectedTpCascadeWorkItem, workers, user)
      setIsThirdPartyCascadeOpen(false)
      await loadData()
      showWoGridFeedback('success', 'Registro guardado en Terceros.')
    } catch (err) {
      showWoGridFeedback('error', 'Error al guardar en Terceros: ' + err.message)
    } finally {
      setSavingTpCascade(false)
    }
  }

  // -------------------------------------------------------------
  // 4. ESTADOS LOCALES DE EDICIÓN TERCEROS
  // -------------------------------------------------------------
  const [savingThirdParty, setSavingThirdParty] = useState(false)
  const handleSaveThirdPartyEdit = async (e) => {
    e.preventDefault()
    setSavingThirdParty(true)
    try {
      await saveThirdPartyEditService(editingThirdParty, user)
      setEditingThirdParty(null)
      await loadData()
      showWoGridFeedback('success', 'Terceros actualizado.')
    } catch (err) {
      showWoGridFeedback('error', 'Error al actualizar Terceros: ' + err.message)
    } finally {
      setSavingThirdParty(false)
    }
  }

  // -------------------------------------------------------------
  // 5. ESTADOS LOCALES DE FICHA 360 / AMPLIAR
  // -------------------------------------------------------------
  const [isAmpliarModalOpen, setIsAmpliarModalOpen] = useState(false)
  const [ampliarText, setAmpliarText] = useState('')
  const [submittingAmpliar, setSubmittingAmpliar] = useState(false)

  const handleSubmitAmpliar = async (e) => {
    e.preventDefault()
    setSubmittingAmpliar(true)
    try {
      const notes = await submitAmpliarService(selectedWoDetail, ampliarText, user)
      setSelectedWoDetail((p) => ({ ...p, notes }))
      setAmpliarText('')
      setIsAmpliarModalOpen(false)
      await loadData()
      showWoGridFeedback('success', 'Consulta asentada en la bitácora.')
    } catch (err) {
      showWoGridFeedback('error', 'Error al asentar consulta: ' + err.message)
    } finally {
      setSubmittingAmpliar(false)
    }
  }

  // -------------------------------------------------------------
  // 6. ESTADOS LOCALES DEL CATÁLOGO OT.ABC
  // -------------------------------------------------------------
  const [templateEdit, setTemplateEdit] = useState(null)
  const [templateSearch, setTemplateSearch] = useState('')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [catalogMultiSelection, setCatalogMultiSelection] = useState([])

  const handleSaveTemplate = async (e) => {
    e.preventDefault()
    setSavingTemplate(true)
    try {
      await saveTemplateService(templateEdit, templates.length, user)
      setTemplateEdit(null)
      await loadData()
      showWoGridFeedback('success', 'Plantilla guardada en catálogo.')
    } catch (err) {
      showWoGridFeedback('error', 'Error al guardar plantilla: ' + err.message)
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleDeleteTemplate = async (tpl) => {
    if (!window.confirm(`¿Eliminar "${tpl.name}" del catálogo?`)) return
    try {
      await deleteTemplateService(tpl.id, tpl.name, user)
      await loadData()
      showWoGridFeedback('info', 'Plantilla eliminada.')
    } catch (err) {
      showWoGridFeedback('error', err.message)
    }
  }

  const handleConfirmCatalogMultiSelection = () => {
    if (catalogMultiSelection.length === 0) return
    setSelectedBatchTemplates(catalogMultiSelection)
    if (templatePickerFromForm && isWorkModalOpen) {
      setWorkForm((p) => ({
        ...p,
        ot_mode: p.existing_wo_id ? p.ot_mode : 'new',
        ot_creation_type: 'tabulada',
        selected_template_id: catalogMultiSelection[0].template_id,
        ot_title: String(catalogMultiSelection[0].ot_title || '').toUpperCase()
      }))
    } else {
      onOpenNewWorkModal(null)
    }
    setIsTemplateModalOpen(false)
  }

  const handleUseSingleTemplate = (tpl) => {
    const upperName = String(tpl.name || '').toUpperCase()
    const single = [{ template_id: tpl.id, ot_title: upperName, description: tpl.description || '', status: 'En ejecución' }]
    setSelectedBatchTemplates(single)
    if (templatePickerFromForm && isWorkModalOpen) {
      setWorkForm((p) => ({
        ...p,
        ot_creation_type: 'tabulada',
        selected_template_id: tpl.id,
        ot_title: upperName,
        description: tpl.description || p.description
      }))
    } else {
      onOpenNewWorkModal(null)
    }
    setIsTemplateModalOpen(false)
  }

  return (
    <>
      {/* 1. WORK MODAL */}
      {isWorkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 font-sans">
          <div className="alon-modal-card max-w-5xl">
            <div className="alon-modal-header">
              <div className="flex items-center gap-3 min-w-0">
                <ClipboardList className="w-5 h-5 text-primary shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-white truncate">
                      {editingWorkItem ? 'Editar Trabajo en Orden de Trabajo' : 'Cargar Trabajo / Nueva Orden de Trabajo'}
                    </h3>
                    <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-mono text-[10px] font-bold flex items-center gap-1 shrink-0">
                      <Calendar className="w-3 h-3" />
                      <span>HOY: {formatShortDate(workForm.created_date, true)}</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">
                    Recorrido guiado por color: 1º Barco/OT ➔ 2º Catálogo OT.ABC ➔ 3º Detalle y Responsables ➔ 4º Contratistas y 3ros.
                  </p>
                </div>
              </div>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => setIsWorkModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveWorkSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden text-xs">
              <div className="alon-modal-body">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
                  {/* COLUMNA IZQUIERDA */}
                  <div className="space-y-3">
                    {/* BLOQUE 1: BARCO Y OT */}
                    <div className="alon-chunk-sky space-y-2.5">
                      <div className="flex items-center justify-between border-b border-sky-500/20 pb-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-sky-400">
                          1. Barco y Contenedor de Orden de Trabajo
                        </span>
                        <span className="text-[10px] text-slate-400">Origen naval</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            1° Barco / Embarcación <span className="text-rose-400">*</span>
                          </label>
                          <select
                            required
                            disabled={Boolean(editingWorkItem)}
                            value={workForm.ship_id}
                            onChange={(e) => {
                              const newShipId = e.target.value
                              const shipWos = workOrders.filter((w) => w.ship_id === newShipId)
                              setWorkForm((p) => ({
                                ...p,
                                ship_id: newShipId,
                                ot_mode: shipWos.length > 0 ? 'existing' : 'new',
                                existing_wo_id: shipWos[0]?.id || '',
                                ot_number: getNextOtNumberForShip(workOrders, newShipId)
                              }))
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold disabled:opacity-60"
                          >
                            <option value="">-- Seleccionar Barco --</option>
                            {ships.map((s) => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">
                            2° Destino del Trabajo <span className="text-rose-400">*</span>
                          </label>
                          <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-slate-900 border border-slate-800">
                            <button
                              type="button"
                              disabled={Boolean(editingWorkItem)}
                              onClick={() => setWorkForm((prev) => ({ ...prev, ot_mode: 'new' }))}
                              className={`py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                                workForm.ot_mode === 'new' ? 'bg-sky-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              + Crear Nueva OT
                            </button>
                            <button
                              type="button"
                              disabled={Boolean(editingWorkItem)}
                              onClick={() => setWorkForm((prev) => ({ ...prev, ot_mode: 'existing' }))}
                              className={`py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                                workForm.ot_mode === 'existing' ? 'bg-sky-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              Usar OT Existente
                            </button>
                          </div>
                        </div>
                      </div>

                      {workForm.ot_mode === 'new' ? (
                        <div className="space-y-2.5 pt-1 border-t border-sky-500/15">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-bold text-slate-300">Tipo de OT:</span>
                            <button
                              type="button"
                              onClick={() => setWorkForm((prev) => ({ ...prev, ot_creation_type: 'tabulada' }))}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border cursor-pointer ${
                                workForm.ot_creation_type === 'tabulada' ? 'bg-purple-950/80 text-purple-300 border-purple-500 shadow-sm' : 'bg-slate-900 text-slate-400 border-slate-800'
                              }`}
                            >
                              📋 Tabulada (Catálogo OT.ABC)
                            </button>
                            <button
                              type="button"
                              onClick={() => setWorkForm((prev) => ({ ...prev, ot_creation_type: 'libre', selected_template_id: '' }))}
                              className={`px-2.5 py-1 rounded-lg font-bold text-[11px] border cursor-pointer ${
                                workForm.ot_creation_type === 'libre' ? 'bg-cyan-950/80 text-cyan-300 border-cyan-500 shadow-sm' : 'bg-slate-900 text-slate-400 border-slate-800'
                              }`}
                            >
                              ✍️ Nombre Libre
                            </button>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Nº Consecutivo</label>
                              <div className="relative">
                                <input
                                  type="text"
                                  readOnly
                                  disabled
                                  value={workForm.ot_number}
                                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-primary font-mono font-black cursor-not-allowed"
                                />
                                <span className="absolute right-2 top-1.5 text-[10px] text-slate-500 font-bold">🔒 Auto</span>
                              </div>
                            </div>
                            <div className="sm:col-span-2">
                              <label className="block text-[11px] font-semibold text-slate-300 mb-1">Nombre de la OT *</label>
                              <input
                                type="text"
                                required={selectedBatchTemplates.length <= 1}
                                value={workForm.ot_title}
                                onChange={(e) => setWorkForm((prev) => ({ ...prev, ot_title: e.target.value.toUpperCase() }))}
                                onBlur={() => setWorkForm((prev) => ({ ...prev, ot_title: (prev.ot_title || '').trim().toUpperCase() }))}
                                placeholder="EJ: REPARACIÓN DE LÍNEA DE EJES"
                                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold uppercase focus:border-sky-400 focus:outline-none"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="pt-1 border-t border-sky-500/15">
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Seleccionar OT Existente *</label>
                          <select
                            required
                            disabled={Boolean(editingWorkItem)}
                            value={workForm.existing_wo_id}
                            onChange={(e) => {
                              const wo = workOrders.find((w) => w.id === e.target.value)
                              setWorkForm((prev) => ({
                                ...prev,
                                existing_wo_id: e.target.value,
                                foreman_name: wo?.foreman_name || prev.foreman_name,
                                ot_title: wo?.title || prev.ot_title,
                                ot_number: wo?.ot_number || prev.ot_number
                              }))
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold disabled:opacity-60"
                          >
                            <option value="">-- Seleccionar OT --</option>
                            {workOrders
                              .filter((w) => w.ship_id === workForm.ship_id)
                              .map((w) => (
                                <option key={w.id} value={w.id}>{w.ot_number} &bull; {w.title}</option>
                              ))}
                          </select>
                        </div>
                      )}
                    </div>

                    {/* BLOQUE 2: CATÁLOGO */}
                    {workForm.ot_mode === 'new' && workForm.ot_creation_type === 'tabulada' && (
                      <div className="alon-chunk-purple space-y-2">
                        <div className="flex items-center justify-between border-b border-purple-500/20 pb-1">
                          <span className="text-[11px] font-black uppercase tracking-wider text-purple-300">
                            2. Catálogo OT.ABC y Selección Múltiple
                          </span>
                          <button
                            type="button"
                            onClick={() => { setTemplatePickerFromForm(true); setIsTemplateModalOpen(true) }}
                            className="text-[10px] text-amber-300 hover:underline font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <Sparkles className="w-3 h-3" />
                            <span>Abrir Catálogo Completo</span>
                          </button>
                        </div>

                        <div className="flex items-center gap-2">
                          <input
                            type="text"
                            value={inlineCatalogSearch}
                            onChange={(e) => setInlineCatalogSearch(e.target.value)}
                            placeholder="Buscar en Catálogo OT.ABC..."
                            className="flex-1 bg-slate-900 border border-purple-800/60 rounded-xl px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => setShowInlineMultiPicker(!showInlineMultiPicker)}
                            className="px-2.5 py-1 rounded-xl bg-purple-950 border border-purple-600/70 text-purple-200 text-[11px] font-bold cursor-pointer"
                          >
                            {showInlineMultiPicker ? 'Ocultar' : `Ver Lista (${templates.length})`}
                          </button>
                        </div>

                        {(showInlineMultiPicker || inlineCatalogSearch.trim()) && (
                          <div className="max-h-40 overflow-y-auto space-y-1 p-1 bg-slate-950 rounded-xl border border-purple-900/50">
                            {templates
                              .filter((t) =>
                                !inlineCatalogSearch.trim() ? true : t.name.toLowerCase().includes(inlineCatalogSearch.toLowerCase())
                              )
                              .map((tpl) => {
                                const isChecked = selectedBatchTemplates.some((item) => item.template_id === tpl.id)
                                return (
                                  <div
                                    key={tpl.id}
                                    onClick={() =>
                                      setSelectedBatchTemplates((prev) =>
                                        prev.some((item) => item.template_id === tpl.id)
                                          ? prev.filter((item) => item.template_id !== tpl.id)
                                          : [...prev, { template_id: tpl.id, ot_title: String(tpl.name || '').toUpperCase(), description: tpl.description || '', status: workForm.status || 'En ejecución' }]
                                      )
                                    }
                                    className={`p-1.5 rounded-lg border text-[11px] flex items-center justify-between cursor-pointer ${
                                      isChecked ? 'bg-purple-950/80 border-purple-500 text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-300'
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate">
                                      <input type="checkbox" checked={isChecked} onChange={() => {}} className="w-3.5 h-3.5 rounded accent-purple-500" />
                                      <span className="truncate">{tpl.name}</span>
                                    </div>
                                    {tpl.category && <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">{tpl.category}</span>}
                                  </div>
                                )
                              })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* COLUMNA DERECHA */}
                  <div className="space-y-3">
                    {/* BLOQUE 3: DETALLE TÉCNICO */}
                    <div className="alon-chunk-amber space-y-2">
                      <div className="flex items-center justify-between border-b border-amber-500/20 pb-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-amber-300">
                          3. Detalle Técnico del Trabajo
                        </span>
                        <span className="text-[10px] text-slate-400">Descripción & Estado</span>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Descripción Técnica del Trabajo <span className="text-rose-400">*</span>
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={workForm.description}
                          onChange={(e) => setWorkForm((prev) => ({ ...prev, description: e.target.value }))}
                          placeholder="Detallá los trabajos a realizar..."
                          className="w-full bg-slate-900 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:border-amber-400 focus:outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                            Estado del Trabajo <span className="text-rose-400">*</span>
                          </label>
                          <select
                            value={workForm.status}
                            onChange={(e) => setWorkForm((prev) => ({ ...prev, status: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold focus:border-amber-400 focus:outline-none"
                          >
                            {ESTADOS_TRABAJO.map((st) => (
                              <option key={st.value} value={st.value}>{st.value}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-semibold text-slate-300 mb-1">Comentarios</label>
                          <input
                            type="text"
                            value={workForm.comments}
                            onChange={(e) => setWorkForm((prev) => ({ ...prev, comments: e.target.value }))}
                            placeholder="Comentario interno opcional..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          />
                        </div>
                      </div>
                    </div>

                    {/* BLOQUE 4: RESPONSABLES & CONTRATISTAS */}
                    <div className="alon-chunk-emerald space-y-2.5">
                      <div className="flex items-center justify-between border-b border-emerald-500/20 pb-1">
                        <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
                          4. Responsables, Facturación y Terceros PRC
                        </span>
                        <span className="text-[10px] text-slate-400">Asignación operativa</span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-bold text-slate-300">Jefe de Obra *</label>
                            <button
                              type="button"
                              onClick={() => setIsCreatingForemanInline(!isCreatingForemanInline)}
                              className="text-[10px] text-cyan-400 hover:underline font-bold cursor-pointer"
                            >
                              {isCreatingForemanInline ? 'Cancelar' : '+ Crear JO'}
                            </button>
                          </div>
                          {isCreatingForemanInline ? (
                            <div className="p-2 rounded-xl bg-slate-950 border border-cyan-500/50 space-y-1.5">
                              <input
                                type="text"
                                placeholder="Nombre Jefe..."
                                value={newForemanForm.name}
                                onChange={(e) => setNewForemanForm((p) => ({ ...p, name: e.target.value }))}
                                className="w-full bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                              />
                              <div className="flex items-center justify-between">
                                <span className="text-[9px] text-slate-400">Técnico</span>
                                <button
                                  type="button"
                                  disabled={savingNewForeman}
                                  onClick={handleCreateForemanInline}
                                  className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 text-[10px] font-bold cursor-pointer"
                                >
                                  {savingNewForeman ? 'Guardando...' : 'Guardar'}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <select
                              value={workForm.foreman_name}
                              onChange={(e) => setWorkForm((prev) => ({ ...prev, foreman_name: e.target.value }))}
                              className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold"
                            >
                              {foremenList.map((f) => (
                                <option key={f} value={f}>{f}</option>
                              ))}
                            </select>
                          )}
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold text-slate-300 mb-1">Tipo de Trabajo *</label>
                          <select
                            value={workForm.work_type}
                            onChange={(e) => setWorkForm((prev) => ({ ...prev, work_type: e.target.value }))}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-cyan-300 font-mono font-bold"
                          >
                            {TIPOS_DE_TRABAJO.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="relative">
                          <div className="flex items-center justify-between mb-1">
                            <label className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
                              <span>Centro de Facturación</span>
                              <button
                                type="button"
                                onClick={() => setShowFacturacionInfo((v) => !v)}
                                onMouseEnter={() => setShowFacturacionInfo(true)}
                                onMouseLeave={() => setShowFacturacionInfo(false)}
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-600/60 hover:bg-cyan-900 text-[10px] font-bold cursor-pointer transition-colors"
                                title="¿Qué diferencia hay entre Presupuesto General y Adicional / Específico?"
                              >
                                <Info className="w-3 h-3" />
                                <span>¿Qué es?</span>
                              </button>
                            </label>
                          </div>

                          {showFacturacionInfo && (
                            <div
                              onMouseEnter={() => setShowFacturacionInfo(true)}
                              onMouseLeave={() => setShowFacturacionInfo(false)}
                              className="absolute left-0 right-0 bottom-full mb-1.5 z-40 p-3 bg-slate-950/95 rounded-xl border-2 border-cyan-500/40 text-[11px] text-slate-200 space-y-2 shadow-2xl shadow-cyan-950/30 animate-in fade-in duration-100"
                            >
                              <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                                <span className="font-bold text-white flex items-center gap-1.5">
                                  <Info className="w-3.5 h-3.5 text-cyan-400" />
                                  {FACTURACION_CENTRO_INFO.title}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setShowFacturacionInfo(false)}
                                  className="text-slate-400 hover:text-white cursor-pointer"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="space-y-1.5">
                                {FACTURACION_CENTRO_INFO.options.map((opt) => (
                                  <div key={opt.key} className="p-2 rounded-lg bg-slate-900/90 border border-slate-800 space-y-1">
                                    <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded border ${opt.badgeClass}`}>
                                      {opt.badge}
                                    </span>
                                    <p className="text-white font-semibold leading-snug">{opt.summary}</p>
                                    <p className="text-[10px] text-slate-400 leading-snug">{opt.details}</p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <select
                            value={workForm.assignment_type}
                            onChange={(e) => {
                              const nextType = e.target.value
                              setWorkForm((prev) => ({
                                ...prev,
                                assignment_type: nextType,
                                specific_budget_id: nextType === 'Adicional / Específico' ? prev.specific_budget_id : ''
                              }))
                            }}
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold"
                          >
                            <option value="Presupuesto General">Presupuesto General</option>
                            <option value="Adicional / Específico">Adicional / Específico</option>
                          </select>
                        </div>

                        {workForm.assignment_type === 'Adicional / Específico' && (
                          <div className="p-2.5 rounded-xl bg-amber-950/20 border border-amber-500/40 space-y-2">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[11px] font-semibold text-amber-300 mb-1">
                                  Opción de Nº Presupuesto *
                                </label>
                                <select
                                  value={budgetOptionMode}
                                  onChange={(e) => {
                                    const mode = e.target.value
                                    setBudgetOptionMode(mode)
                                    if (mode === 'PENDIENTE') {
                                      setWorkForm((prev) => ({ ...prev, specific_budget_id: BUDGET_PENDING_VALUE }))
                                    } else {
                                      setWorkForm((prev) => ({
                                        ...prev,
                                        specific_budget_id: extractBudgetDigits(prev.specific_budget_id)
                                      }))
                                    }
                                  }}
                                  className="w-full bg-slate-900 border border-amber-500/50 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none"
                                >
                                  <option value="CONOCIDO">Tengo Nº de Presupuesto (Numérico)</option>
                                  <option value="PENDIENTE">Pendiente / A definir (Alerta María José)</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-[11px] font-semibold text-amber-300 mb-1">
                                  Nº Presupuesto (Solo números — vacío = PENDIENTE)
                                </label>
                                {budgetOptionMode === 'CONOCIDO' ? (
                                  <div className="flex items-center bg-slate-900 border border-amber-500/50 rounded-xl overflow-hidden focus-within:border-amber-400">
                                    <span className="px-2.5 py-1.5 bg-amber-950/60 border-r border-amber-500/30 text-[11px] font-mono font-black text-amber-300 select-none shrink-0">
                                      PRESUP.
                                    </span>
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      value={extractBudgetDigits(workForm.specific_budget_id)}
                                      onChange={(e) => {
                                        const onlyDigits = extractBudgetDigits(e.target.value)
                                        setWorkForm((prev) => ({ ...prev, specific_budget_id: onlyDigits }))
                                      }}
                                      onBlur={() => {
                                        const onlyDigits = extractBudgetDigits(workForm.specific_budget_id)
                                        if (!onlyDigits) {
                                          setWorkForm((prev) => ({ ...prev, specific_budget_id: '' }))
                                        }
                                      }}
                                      placeholder="Ej: 210 (vacío = PENDIENTE)"
                                      className="w-full bg-transparent px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none"
                                    />
                                  </div>
                                ) : (
                                  <div className="px-2.5 py-1.5 rounded-xl bg-amber-950/50 border border-amber-500/50 text-[11px] font-mono font-black text-amber-300">
                                    {BUDGET_PENDING_VALUE} • Alerta a María José
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-amber-200/90">
                              <span>
                                Se guardará como:{' '}
                                <strong className="font-mono text-white">
                                  {formatSpecificBudgetLabel(
                                    budgetOptionMode === 'PENDIENTE' ? BUDGET_PENDING_VALUE : workForm.specific_budget_id
                                  )}
                                </strong>
                              </span>
                              {(!extractBudgetDigits(workForm.specific_budget_id) || budgetOptionMode === 'PENDIENTE') && (
                                <span className="text-amber-300 font-semibold">
                                  ⚠️ Generará alerta pendiente para María José
                                </span>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">Contratista(s) o Grupo(s)</label>
                        <div className="relative">
                          <input
                            type="text"
                            value={contractorSelectInput}
                            onChange={(e) => { setContractorSelectInput(e.target.value); setIsContractorListOpen(true) }}
                            onFocus={() => setIsContractorListOpen(true)}
                            placeholder="Escribí para buscar y agregar..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white focus:outline-none"
                          />
                          {isContractorListOpen && (
                            <div className="absolute top-full left-0 right-0 mt-1 max-h-36 overflow-y-auto bg-slate-950 border border-slate-700 rounded-xl shadow-2xl z-20 divide-y divide-slate-800">
                              {contractorCatalog
                                .filter((c) => !(workForm.contractors || []).includes(c.name) && (!contractorSelectInput.trim() || c.name.toLowerCase().includes(contractorSelectInput.toLowerCase())))
                                .map((c) => (
                                  <div
                                    key={c.name}
                                    onClick={() => {
                                      setWorkForm((p) => ({ ...p, contractors: [...p.contractors, c.name] }))
                                      setContractorSelectInput('')
                                      setIsContractorListOpen(false)
                                    }}
                                    className="p-2 hover:bg-slate-800/80 cursor-pointer flex items-center justify-between text-xs"
                                  >
                                    <span className="font-bold text-white">{c.name}</span>
                                    {c.can_charge_third_party && <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 font-mono">3ros Habilitado</span>}
                                  </div>
                                ))}
                            </div>
                          )}
                        </div>

                        {workForm.contractors.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-1.5">
                            {workForm.contractors.map((c) => (
                              <span key={c} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-mono font-bold text-slate-200">
                                <span>{c}</span>
                                <button type="button" onClick={() => setWorkForm((p) => ({ ...p, contractors: p.contractors.filter((x) => x !== c) }))} className="text-slate-400 hover:text-rose-400">✕</button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-950 border border-purple-900/50 space-y-1.5">
                        <label className="flex items-start gap-2 text-xs text-slate-200 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!thirdPartyPrcEvaluation.canEnable}
                            checked={workForm.send_to_third_party_prc && thirdPartyPrcEvaluation.canEnable}
                            onChange={(e) => setWorkForm((prev) => ({ ...prev, send_to_third_party_prc: e.target.checked }))}
                            className="w-4 h-4 rounded accent-purple-500 mt-0.5"
                          />
                          <div>
                            <span className="font-bold text-purple-300">Generar Comprobante PRC $0 en Terceros</span>
                            <p className="text-[10px] text-slate-400 mt-0.5">{thirdPartyPrcEvaluation.reason}</p>
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="alon-modal-footer">
                <button type="button" onClick={() => setIsWorkModalOpen(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-semibold cursor-pointer">Cancelar</button>
                <button type="submit" disabled={savingWork} className="px-5 py-2 bg-gradient-to-r from-primary to-blue-500 hover:brightness-110 text-slate-950 font-black rounded-xl cursor-pointer flex items-center gap-1.5 shadow-lg">
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                  <span>{savingWork ? 'Guardando...' : editingWorkItem ? 'Actualizar Trabajo' : 'Guardar Trabajo y OT'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. SEPARATE MODAL */}
      {separatingRow && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto font-sans">
          <div className="w-full max-w-xl bg-slate-900 border border-amber-500/50 rounded-3xl shadow-2xl p-6 space-y-4 my-8">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 text-[10px] font-black uppercase">Desglose y Reasignación con Trazabilidad</span>
                <h3 className="text-base font-black text-white flex items-center gap-2 mt-1">
                  <GitBranch className="w-5 h-5 text-amber-400" />
                  Separar / Independizar Trabajo de su Contenedor OT
                </h3>
              </div>
              <button type="button" onClick={() => setSeparatingRow(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Barco: <strong className="text-white">{separatingRow.wo?.ships?.name}</strong></span>
                <span>OT: <strong className="text-primary font-mono">{separatingRow.wo?.ot_number} &bull; {separatingRow.wo?.title}</strong></span>
              </div>
              <p className="text-slate-200 font-medium line-clamp-3">{separatingRow.description || 'Sin descripción'}</p>
            </div>

            <form onSubmit={handleConfirmSeparateWorkItem} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setSeparateForm((prev) => ({ ...prev, mode: 'new_ot' }))}
                  className={`p-3 rounded-xl border text-left cursor-pointer ${separateForm.mode === 'new_ot' ? 'bg-amber-500/20 border-amber-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                >
                  <div className="font-black text-amber-300 flex items-center gap-1.5"><Plus className="w-3.5 h-3.5" /><span>1. Nueva OT Propia</span></div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const otherWos = workOrders.filter((w) => w.ship_id === separatingRow.wo?.ship_id && w.id !== separatingRow.work_order_id)
                    if (otherWos.length === 0) { alert('No hay otras OTs en este barco.'); return }
                    setSeparateForm((prev) => ({ ...prev, mode: 'existing_ot', target_existing_wo_id: otherWos[0]?.id || '' }))
                  }}
                  className={`p-3 rounded-xl border text-left cursor-pointer ${separateForm.mode === 'existing_ot' ? 'bg-cyan-500/20 border-cyan-400 text-white' : 'bg-slate-950 border-slate-800 text-slate-400'}`}
                >
                  <div className="font-black text-cyan-300 flex items-center gap-1.5"><ArrowRight className="w-3.5 h-3.5" /><span>2. Mover a otra OT</span></div>
                </button>
              </div>

              {separateForm.mode === 'new_ot' ? (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-400 mb-1">Nº Nueva OT</label>
                      <input type="text" readOnly disabled value={separateForm.new_ot_number} className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-primary font-mono font-black cursor-not-allowed" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-[11px] font-semibold text-slate-300 mb-1">Nombre Nueva OT *</label>
                      <input type="text" required value={separateForm.new_ot_title} onChange={(e) => setSeparateForm((p) => ({ ...p, new_ot_title: e.target.value.toUpperCase() }))} onBlur={() => setSeparateForm((p) => ({ ...p, new_ot_title: (p.new_ot_title || '').trim().toUpperCase() }))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white font-bold uppercase" />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-slate-950 border border-slate-800">
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">OT Destino:</label>
                  <select value={separateForm.target_existing_wo_id} onChange={(e) => setSeparateForm((p) => ({ ...p, target_existing_wo_id: e.target.value }))} className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold">
                    {workOrders.filter((w) => w.ship_id === separatingRow.wo?.ship_id && w.id !== separatingRow.work_order_id).map((w) => (
                      <option key={w.id} value={w.id}>{w.ot_number} &bull; {w.title}</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Motivo de Separación *</label>
                <input type="text" required value={separateForm.reason} onChange={(e) => setSeparateForm((p) => ({ ...p, reason: e.target.value }))} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" />
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2.5">
                <button type="button" onClick={() => setSeparatingRow(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold cursor-pointer">Cancelar</button>
                <button type="submit" disabled={savingSeparate} className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl cursor-pointer">{savingSeparate ? 'Separando...' : 'Confirmar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. TERCEROS CASCADA */}
      {isThirdPartyCascadeOpen && (
        <div className="fixed inset-0 z-[65] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto font-sans">
          <div className="w-full max-w-xl bg-slate-900 border border-purple-600/60 rounded-3xl shadow-2xl p-6 space-y-4 my-8">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="px-2 py-0.5 rounded bg-purple-950 text-purple-300 border border-purple-700 text-[10px] font-black uppercase">Bloqueo por OT y Contratista Habilitado</span>
                <h3 className="text-base font-black text-white flex items-center gap-2 mt-1"><ShieldCheck className="w-5 h-5 text-purple-400" />Cargar en Terceros (Cascada: Barco ➔ Contratista ➔ OT)</h3>
              </div>
              <button type="button" onClick={() => setIsThirdPartyCascadeOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleSaveTpCascade} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-cyan-400 uppercase mb-1">1. Seleccionar Barco *</label>
                <select required value={tpCascadeForm.ship_id} onChange={(e) => setTpCascadeForm((p) => ({ ...p, ship_id: e.target.value, contractor_name: '', work_item_id: '' }))} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold">
                  <option value="">-- Elegir Barco --</option>
                  {ships.map((s) => (<option key={s.id} value={s.id}>{s.name}</option>))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-purple-300 uppercase mb-1">2. Contratista Habilitado en Barco [3ros] *</label>
                <select required disabled={!tpCascadeForm.ship_id || enabledThirdPartyContractorsForShip.length === 0} value={tpCascadeForm.contractor_name} onChange={(e) => {
                  const c = e.target.value
                  const matching = activeExecutionRows.filter((r) => r.wo?.ship_id === tpCascadeForm.ship_id && (r.contractors || []).includes(c))
                  setTpCascadeForm((p) => ({ ...p, contractor_name: c, work_item_id: matching[0]?.id || '' }))
                }} className="w-full bg-slate-950 border border-purple-700/60 rounded-xl px-3 py-2 text-xs text-white font-mono font-bold disabled:opacity-50">
                  <option value="">-- Elegir Contratista ({enabledThirdPartyContractorsForShip.length}) --</option>
                  {enabledThirdPartyContractorsForShip.map((c) => (<option key={c} value={c}>{c}</option>))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-emerald-400 uppercase mb-1">3. OT en Ejecución *</label>
                <select required disabled={!tpCascadeForm.contractor_name || enabledWorkItemsForShipAndContractor.length === 0} value={tpCascadeForm.work_item_id} onChange={(e) => setTpCascadeForm((p) => ({ ...p, work_item_id: e.target.value }))} className="w-full bg-slate-950 border border-emerald-600/60 rounded-xl px-3 py-2 text-xs text-white font-bold disabled:opacity-50">
                  <option value="">-- Elegir OT --</option>
                  {enabledWorkItemsForShipAndContractor.map((i) => (<option key={i.id} value={i.id}>{i.wo?.ot_number} &bull; {i.wo?.title}</option>))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Fecha</label>
                  <input type="date" value={tpCascadeForm.service_date} onChange={(e) => setTpCascadeForm((p) => ({ ...p, service_date: e.target.value }))} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white" />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Comprobante</label>
                  <select value={tpCascadeForm.status} onChange={(e) => setTpCascadeForm((p) => ({ ...p, status: e.target.value }))} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold">
                    <option value="PRC">PRC</option><option value="RMO">RMO</option><option value="RPF">RPF</option><option value="FCR">FCR</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 mb-1">Importe AR$</label>
                  <input type="number" step="100" value={tpCascadeForm.amount_ars} onChange={(e) => setTpCascadeForm((p) => ({ ...p, amount_ars: e.target.value }))} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs text-emerald-400 font-mono font-bold" />
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button type="button" onClick={() => setIsThirdPartyCascadeOpen(false)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold cursor-pointer">Cancelar</button>
                <button type="submit" disabled={savingTpCascade || !selectedTpCascadeWorkItem} className="px-5 py-2 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl cursor-pointer">{savingTpCascade ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. EDIT TERCEROS */}
      {editingThirdParty && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 font-sans">
          <div className="w-full max-w-lg bg-slate-900 border border-purple-700/80 rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-purple-400" />Terceros: {editingThirdParty.contractor_name}</h3>
              <button type="button" onClick={() => setEditingThirdParty(null)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handleSaveThirdPartyEdit} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-cyan-400 uppercase mb-1">Directas (desde OT)</label>
                <div className="p-3 rounded-xl bg-slate-950 border border-cyan-900/60 text-slate-200">{editingThirdParty.direct_observations || 'Sin descripción'}</div>
              </div>
              <div>
                <label className="block text-[11px] font-bold text-purple-300 uppercase mb-1">Específicas (Terceros)</label>
                <textarea rows={3} value={editingThirdParty.specific_observations || ''} onChange={(e) => setEditingThirdParty((p) => ({ ...p, specific_observations: e.target.value }))} className="w-full bg-slate-950 border border-purple-600/60 rounded-xl p-3 text-xs text-white" />
              </div>
              <div className="pt-3 border-t border-slate-800 flex justify-end gap-2">
                <button type="button" onClick={() => setEditingThirdParty(null)} className="px-4 py-2 bg-slate-800 text-slate-300 rounded-xl font-semibold cursor-pointer">Cancelar</button>
                <button type="submit" disabled={savingThirdParty} className="px-4 py-2 bg-purple-600 text-white font-black rounded-xl cursor-pointer">{savingThirdParty ? 'Guardando...' : 'Guardar'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. FICHA 360 / CIERRE */}
      {selectedWoDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto font-sans">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 relative my-8">
            {(() => {
              const items = itemsByWoMap[selectedWoDetail.id] || []
              const computed = computeOtState(selectedWoDetail, items)
              const dates = otMetricsAndDatesMap[selectedWoDetail.id] || { totalHours: 0 }
              return (
                <div className="space-y-4">
                  <div className="flex items-start justify-between border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs font-black text-primary px-2.5 py-0.5 rounded bg-primary/10 border border-primary/30">{selectedWoDetail.ot_number}</span>
                        <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${computed.color}`}>{computed.label}</span>
                      </div>
                      <h2 className="text-xl font-black text-white">{selectedWoDetail.title}</h2>
                    </div>
                    <button type="button" onClick={() => setSelectedWoDetail(null)} className="text-slate-400 hover:text-white p-1.5 rounded-xl hover:bg-slate-800 cursor-pointer"><X className="w-5 h-5" /></button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono text-xs">
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><span className="text-[10px] text-slate-500 uppercase block">Horas Imp.</span><strong className="text-primary font-black">{dates.totalHours} hs</strong></div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-slate-800"><span className="text-[10px] text-slate-500 uppercase block">F. Creación</span><strong className="text-white font-bold">{formatShortDate(dates.createdDate, true)}</strong></div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-emerald-900/50"><span className="text-[10px] text-emerald-400 uppercase block">F. Inicio</span><strong className="text-emerald-300 font-bold">{formatShortDate(dates.startDate, true)}</strong></div>
                    <div className="p-3 rounded-xl bg-slate-950 border border-cyan-900/50"><span className="text-[10px] text-cyan-400 uppercase block">F. Final</span><strong className="text-cyan-300 font-bold">{formatShortDate(dates.endDate, true)}</strong></div>
                  </div>

                  <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                    <button type="button" onClick={() => setIsAmpliarModalOpen(true)} className="px-3 py-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                      <Send className="w-3.5 h-3.5" /><span>Botón Ampliar</span>
                    </button>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <button
                        type="button"
                        onClick={async () => {
                          await closeEntireWorkOrderTreeService({ wo: selectedWoDetail, targetStatus: 'Finalizado', user })
                          await loadData()
                          setSelectedWoDetail(null)
                          showWoGridFeedback('success', 'Todas las subtareas dadas por Finalizadas.')
                        }}
                        className="px-3 py-1.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs cursor-pointer flex items-center gap-1 shadow-sm"
                        title="Pasa todas las subtareas a Finalizado sin sellar la OT aún"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Finalizar Subtareas</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await closeEntireWorkOrderTreeService({ wo: selectedWoDetail, targetStatus: 'Facturado', allowPostBillingCosts: false, user })
                          await loadData()
                          setSelectedWoDetail(null)
                          showWoGridFeedback('success', 'OT Facturada y Cerrada en 1 clic.')
                        }}
                        className="px-3.5 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-bold cursor-pointer"
                        title="Pasa todas las subtareas a Facturado y sella la OT"
                      >
                        Facturar y Cerrar
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await closeEntireWorkOrderTreeService({ wo: selectedWoDetail, targetStatus: 'Facturado', allowPostBillingCosts: true, user })
                          await loadData()
                          setSelectedWoDetail(null)
                          showWoGridFeedback('success', 'OT Facturada con permiso post-cierre.')
                        }}
                        className="px-3.5 py-1.5 bg-slate-800 text-purple-300 border border-purple-500/40 rounded-xl text-xs font-bold cursor-pointer"
                        title="Factura y cierra con permiso DEC-011 de imputaciones tardías"
                      >
                        Facturar y Abierta (DEC-011)
                      </button>
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* 6. AMPLIAR MODAL */}
      {isAmpliarModalOpen && selectedWoDetail && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150 font-sans">
          <div className="w-full max-w-md bg-slate-900 border border-amber-500/40 rounded-2xl shadow-2xl p-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
              <div className="flex items-center gap-2"><MessageSquare className="w-4 h-4 text-amber-400" /><h3 className="text-sm font-black text-white">Ampliar / Consulta a Jefe de Obra</h3></div>
              <button type="button" onClick={() => setIsAmpliarModalOpen(false)} className="text-slate-400 hover:text-white p-1"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSubmitAmpliar} className="space-y-3 text-xs">
              <textarea rows={4} required value={ampliarText} onChange={(e) => setAmpliarText(e.target.value)} placeholder={`Escribir consulta para ${selectedWoDetail.foreman_name || 'Jefe de Obra'}...`} className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-amber-400" autoFocus />
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setIsAmpliarModalOpen(false)} className="px-3.5 py-1.5 bg-slate-800 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer">Cancelar</button>
                <button type="submit" disabled={submittingAmpliar} className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black rounded-xl cursor-pointer">{submittingAmpliar ? 'Enviando...' : 'Asentar Consulta'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 7. TEMPLATE MODAL */}
      {isTemplateModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 overflow-y-auto font-sans">
          <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 relative my-8">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0"><Sparkles className="w-5 h-5" /></div>
                <div><h3 className="text-base font-black text-white">Catálogo de Trabajos (OT.ABC)</h3></div>
              </div>
              <button type="button" onClick={() => setIsTemplateModalOpen(false)} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"><X className="w-5 h-5" /></button>
            </div>

            {templateEdit ? (
              <form onSubmit={handleSaveTemplate} className="space-y-3 text-xs">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre *</label>
                  <input type="text" required value={templateEdit.name} onChange={(e) => setTemplateEdit({ ...templateEdit, name: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white" autoFocus />
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
                  <button type="button" onClick={() => setTemplateEdit(null)} className="px-3.5 py-1.5 bg-slate-800 text-slate-300 rounded-xl">Cancelar</button>
                  <button type="submit" disabled={savingTemplate} className="px-4 py-1.5 bg-primary text-slate-950 font-black rounded-xl">{savingTemplate ? 'Guardando...' : 'Guardar'}</button>
                </div>
              </form>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3 mb-4 text-xs">
                  <input type="text" value={templateSearch} onChange={(e) => setTemplateSearch(e.target.value)} placeholder="Buscar en catálogo..." className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white" />
                  {catalogMultiSelection.length > 0 && (
                    <button type="button" onClick={handleConfirmCatalogMultiSelection} className="px-4 py-2 bg-purple-600 text-white font-black rounded-xl">Abrir {catalogMultiSelection.length} OTs</button>
                  )}
                  <button type="button" onClick={() => setTemplateEdit({ name: '', description: '', category: 'Renovación' })} className="px-3.5 py-2 bg-slate-800 text-slate-200 rounded-xl font-bold">+ Nueva</button>
                </div>
                <div className="space-y-2 max-h-[50vh] overflow-y-auto text-xs">
                  {templates.filter((t) => !templateSearch || t.name.toLowerCase().includes(templateSearch.toLowerCase())).map((tpl) => (
                    <div key={tpl.id} className="p-3 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3">
                      <span className="font-bold text-white truncate">{tpl.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button type="button" onClick={() => handleUseSingleTemplate(tpl)} className="px-2.5 py-1 bg-amber-500/20 text-amber-300 rounded-lg font-bold">Usar</button>
                        <button type="button" onClick={() => setTemplateEdit(tpl)} className="p-1.5 text-slate-400 hover:text-white"><Pencil className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => handleDeleteTemplate(tpl)} className="p-1.5 text-slate-500 hover:text-rose-400"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
