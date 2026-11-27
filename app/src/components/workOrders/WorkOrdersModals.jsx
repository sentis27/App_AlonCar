import { useState, useEffect, useMemo, useRef } from 'react'
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
  Lock,
  User,
  CheckCircle2,
  AlertTriangle,
  Combine
} from 'lucide-react'
import { WORK_ORDER_STEP_HELP } from '../../lib/businessHelpRegistry.js'
import { getTodayArIso, toArIsoDate } from '../../lib/dateTimeCanonical.js'
import { CanonicalStepperModal, CanonicalStepperStep } from '../canonical/CanonicalStepperModal.jsx'
import CanonicalPrcBadge from '../canonical/CanonicalPrcBadge.jsx'
import CanonicalPrcConfirmModal from '../canonical/CanonicalPrcConfirmModal.jsx'
import { PRC_BUSINESS_RULE_NOTICE } from '../../schemas/prcRegistry.schema.js'
import { buildPrcLookupMaps, formatPrcNumberLabel, resolvePrcForWorkItem } from '../../lib/prcRegistryRules.js'
import { issueAndLinkPrcFromWorkOrderRowService, issueAndSaveTpCascadePrcService } from '../../services/prcIntegrationService.js'
import WorkOrderSeparateModal from './WorkOrderSeparateModal.jsx'
import OtCatalogModal from './OtCatalogModal.jsx'
import {
  buildStandardShipWorkOrdersCatalog,
  findDuplicateOtNameConflict,
  findBatchOtNameConflicts,
  isMergedWorkOrder
} from '../../lib/workOrderUnificationEngine.js'
import {
  ESTADOS_TRABAJO,
  TIPOS_DE_TRABAJO,
  BUDGET_PENDING_VALUE,
  extractBudgetDigits,
  formatSpecificBudgetLabel,
  formatShortDate,
  computeOtState,
  isWorkItemEliminada,
  getNextOtNumberForShip,
  cleanWorkItemComment
} from '../../lib/workOrdersConstants.js'
import {
  OT_ABC_CATEGORIES,
  buildOperationalSelectionFromTemplate,
  normalizeOtAbcCategory
} from '../../lib/otAbcCatalogConstants.js'
import {
  saveOtTemplateCompleteService,
  updateOtTemplateCategoryService,
  deleteOtTemplateService
} from '../../lib/otAbcCatalogService.js'
import {
  saveWorkOrderService,
  createForemanInlineService,
  saveThirdPartyCascadeService,
  saveThirdPartyEditService,
  closeOtWithValidationService,
  closeEntireWorkOrderTreeService,
  submitAmpliarService
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
  workItems = [],
  templates = [],
  workers = [],
  foremenList = [],
  contractorCatalog = [],
  activeExecutionRows = [],
  itemsByWoMap = {},
  otMetricsAndDatesMap = {},
  thirdPartyByItemMap = {},
  prcMaps = null,
  prcRegistry = [],
  macroVariables = [],
  user,
  loadData,
  showWoGridFeedback,
  onOpenNewWorkModal,
  onOpenSeparateModal,
  onOpenUnifyModal
}) {
  // -------------------------------------------------------------
  // 1. ESTADOS LOCALES DEL WORK MODAL
  // -------------------------------------------------------------
  const [workForm, setWorkForm] = useState({
    ship_id: '',
    ot_mode: 'new',
    existing_wo_id: '',
    ot_creation_type: 'libre',
    selected_template_id: '',
    ot_number: 'OT-1',
    ot_title: '',
    created_date: getTodayArIso(),
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
  const [inlineCatalogCategory, setInlineCatalogCategory] = useState('TODAS')
  const [showInlineMultiPicker, setShowInlineMultiPicker] = useState(false)
  const pendingCatalogTemplatesRef = useRef(null)
  const [contractorSelectInput, setContractorSelectInput] = useState('')
  const [isContractorListOpen, setIsContractorListOpen] = useState(false)
  const [isCreatingForemanInline, setIsCreatingForemanInline] = useState(false)
  const [newForemanForm, setNewForemanForm] = useState({ name: '', trade: 'TECNICOS' })
  const [savingNewForeman, setSavingNewForeman] = useState(false)
  const [budgetOptionMode, setBudgetOptionMode] = useState('PENDIENTE')
  const [pendingModalPrcConfirm, setPendingModalPrcConfirm] = useState(null)

  const resolvedPrcMaps = useMemo(() => prcMaps || buildPrcLookupMaps(prcRegistry), [prcMaps, prcRegistry])
  const existingWorkItemPrc = useMemo(
    () => (editingWorkItem ? resolvePrcForWorkItem(editingWorkItem, resolvedPrcMaps) : { prc: null, additionals: [], hasOfficialPrc: false }),
    [editingWorkItem, resolvedPrcMaps]
  )

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
        created_date: row.wo?.created_at ? toArIsoDate(row.wo.created_at) : getTodayArIso(),
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
      setSelectedBatchTemplates([])
      setShowInlineMultiPicker(false)
    } else {
      const defaultShipId = preselectedWo ? preselectedWo.ship_id : (ships[0]?.id || '')
      const shipWos = buildStandardShipWorkOrdersCatalog(workOrders, workItems, {
        shipId: defaultShipId,
        includeEliminated: false,
        includeClosed: false
      })
      const pendingCatalog = pendingCatalogTemplatesRef.current
      pendingCatalogTemplatesRef.current = null
      const hasPending = Array.isArray(pendingCatalog) && pendingCatalog.length > 0
      const firstTpl = hasPending ? pendingCatalog[0] : null

      setBudgetOptionMode('PENDIENTE')
      setWorkForm({
        ship_id: defaultShipId,
        ot_mode: preselectedWo ? 'existing' : 'new',
        existing_wo_id: preselectedWo ? preselectedWo.id : (shipWos[0]?.id || ''),
        ot_creation_type: hasPending ? 'tabulada' : 'libre',
        selected_template_id: firstTpl?.template_id || '',
        ot_number: getNextOtNumberForShip(workOrders, defaultShipId),
        ot_title: firstTpl ? String(firstTpl.ot_title || '').toUpperCase() : '',
        created_date: getTodayArIso(),
        description: firstTpl?.description || '',
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
      setSelectedBatchTemplates(hasPending ? pendingCatalog : [])
      setShowInlineMultiPicker(hasPending && pendingCatalog.length > 1)
    }
    setInlineCatalogSearch('')
    setInlineCatalogCategory('TODAS')
    setContractorSelectInput('')
    setIsContractorListOpen(false)
    setIsCreatingForemanInline(false)
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

  const standardShipWos = useMemo(() => {
    if (!workForm.ship_id) return []
    return buildStandardShipWorkOrdersCatalog(workOrders, workItems, {
      shipId: workForm.ship_id,
      includeEliminated: false,
      includeClosed: Boolean(editingWorkItem)
    })
  }, [workOrders, workItems, workForm.ship_id, editingWorkItem])

  const workDuplicateConflict = useMemo(() => {
    if (editingWorkItem || workForm.ot_mode !== 'new' || !workForm.ship_id) return null
    const singleTitle = workForm.ot_title || (selectedBatchTemplates.length === 1 ? selectedBatchTemplates[0].ot_title : '')
    return findDuplicateOtNameConflict(workOrders, workItems, workForm.ship_id, singleTitle)
  }, [editingWorkItem, workForm.ot_mode, workForm.ship_id, workForm.ot_title, selectedBatchTemplates, workOrders, workItems])

  const batchDuplicateConflicts = useMemo(() => {
    if (editingWorkItem || workForm.ot_mode !== 'new' || !workForm.ship_id || selectedBatchTemplates.length <= 1) return []
    return findBatchOtNameConflicts(workOrders, workItems, workForm.ship_id, selectedBatchTemplates)
  }, [editingWorkItem, workForm.ot_mode, workForm.ship_id, selectedBatchTemplates, workOrders, workItems])

  const handleSaveWorkSubmit = async (e) => {
    e.preventDefault()
    if (!workForm.ship_id) {
      alert('Seleccioná un Barco.')
      return
    }
    if (!editingWorkItem && workForm.ot_mode === 'new') {
      if (workDuplicateConflict) {
        showWoGridFeedback('error', workDuplicateConflict.message)
        return
      }
      if (batchDuplicateConflicts.length > 0) {
        showWoGridFeedback('error', `${batchDuplicateConflicts[0].title}: ${batchDuplicateConflicts[0].message}`)
        return
      }
    }
    const wantsNewThirdPartyPrc =
      Boolean(workForm.send_to_third_party_prc && thirdPartyPrcEvaluation.canEnable) && !existingWorkItemPrc.hasOfficialPrc
    if (wantsNewThirdPartyPrc && (workForm.ot_mode !== 'new' || selectedBatchTemplates.length <= 1)) {
      setPendingModalPrcConfirm({ kind: 'work_modal' })
      return
    }
    await executeSaveWorkSubmit()
  }

  const executeSaveWorkSubmit = async (issueOfficialPrc = false) => {
    setSavingWork(true)
    try {
      const saveRes = await saveWorkOrderService({
        workForm,
        editingWorkItem,
        selectedBatchTemplates,
        workers,
        user,
        getNextOtNumberForShip: (shipId, off) => getNextOtNumberForShip(workOrders, shipId, off)
      })
      let prcNumMsg = ''
      if (issueOfficialPrc && saveRes?.savedWorkItem) {
        const targetWo = workOrders.find((w) => w.id === saveRes.savedWorkItem.work_order_id) || {
          id: saveRes.savedWorkItem.work_order_id,
          ship_id: workForm.ship_id,
          ot_number: workForm.ot_number,
          title: workForm.ot_title,
        }
        const prcRes = await issueAndLinkPrcFromWorkOrderRowService({
          targetRow: { ...saveRes.savedWorkItem, contractors: workForm.contractors, wo: targetWo },
          workers,
          macroVariables,
          prcs: prcRegistry,
          user,
        })
        prcNumMsg = ` y emitido ${formatPrcNumberLabel(prcRes.prc.prc_number)}`
      }
      setIsWorkModalOpen(false)
      await loadData()
      showWoGridFeedback('success', `Trabajo y Orden de Trabajo guardados correctamente${prcNumMsg}.`)
    } catch (err) {
      showWoGridFeedback('error', 'Error al guardar: ' + err.message)
      throw err
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
  // 2. SEPARAR TRABAJO (DELEGADO A WorkOrderSeparateModal)
  // -------------------------------------------------------------

  // -------------------------------------------------------------
  // 3. ESTADOS LOCALES DE TERCEROS CASCADA
  // -------------------------------------------------------------
  const [tpCascadeForm, setTpCascadeForm] = useState({
    ship_id: '',
    contractor_name: '',
    work_item_id: '',
    service_date: getTodayArIso(),
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
    if ((tpCascadeForm.status || 'PRC') === 'PRC') {
      setPendingModalPrcConfirm({ kind: 'tp_cascade' })
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
  // 6. IMPORTACIÓN OPERATIVA DESDE CATÁLOGO OT.ABC (SOLO DESCRIPCIÓN)
  // -------------------------------------------------------------
  const handleConfirmCatalogMultiSelection = (selectionList) => {
    if (!Array.isArray(selectionList) || selectionList.length === 0) return
    if (templatePickerFromForm && isWorkModalOpen) {
      setSelectedBatchTemplates(selectionList)
      setWorkForm((p) => ({
        ...p,
        ot_mode: p.existing_wo_id ? p.ot_mode : 'new',
        ot_creation_type: 'tabulada',
        selected_template_id: selectionList[0].template_id,
        ot_title: String(selectionList[0].ot_title || '').toUpperCase(),
        description: selectionList[0].description || p.description
      }))
    } else {
      pendingCatalogTemplatesRef.current = selectionList
      onOpenNewWorkModal(null)
    }
    setIsTemplateModalOpen(false)
  }

  const handleUseSingleTemplate = (tpl) => {
    const single = [buildOperationalSelectionFromTemplate(tpl, workForm.status || 'En ejecución')]
    if (templatePickerFromForm && isWorkModalOpen) {
      setSelectedBatchTemplates(single)
      setWorkForm((p) => ({
        ...p,
        ot_creation_type: 'tabulada',
        selected_template_id: single[0].template_id,
        ot_title: single[0].ot_title,
        description: single[0].description || p.description
      }))
    } else {
      pendingCatalogTemplatesRef.current = single
      onOpenNewWorkModal(null)
    }
    setIsTemplateModalOpen(false)
  }

  return (
    <>
      {/* 1. WORK MODAL (STEPPER VERTICAL ZERO-SCROLL 1 ➔ 2 ➔ 3) */}
      <CanonicalStepperModal
        isOpen={isWorkModalOpen}
        onClose={() => setIsWorkModalOpen(false)}
        maxWidthClass="max-w-6xl"
        icon={<ClipboardList className="w-4 h-4 text-primary" />}
        title={editingWorkItem ? 'EDITAR TRABAJO EN ORDEN DE TRABAJO' : 'CARGAR TRABAJO / NUEVA ORDEN DE TRABAJO'}
        headerBadges={
          <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-700/60 font-mono text-[10px] font-bold flex items-center gap-1 shrink-0">
            <Calendar className="w-3 h-3" />
            <span>HOY: {formatShortDate(workForm.created_date, true)}</span>
          </span>
        }
        onSubmit={handleSaveWorkSubmit}
        footerLeft={
          <button type="button" onClick={() => setIsWorkModalOpen(false)} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer">
            Cancelar
          </button>
        }
        footerRight={
          <button
            type="submit"
            disabled={savingWork || (!editingWorkItem && workForm.ot_mode === 'new' && (Boolean(workDuplicateConflict) || batchDuplicateConflicts.length > 0))}
            className="px-5 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-xl cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>{savingWork ? 'Guardando...' : editingWorkItem ? 'Actualizar Trabajo' : 'Guardar Trabajo y OT'}</span>
          </button>
        }
      >
        <CanonicalStepperStep
          step={1}
          helpEntry={WORK_ORDER_STEP_HELP[1]}
          title="BARCO Y CONTENEDOR DE ORDEN DE TRABAJO"
          subtitle="Tipo de OT ➔ Destino ➔ Barco y Título"
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
            <div className="md:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Tipo de OT</label>
              <div className={`grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-slate-950 border border-slate-800 ${workForm.ot_mode === 'existing' ? 'opacity-50 pointer-events-none' : ''}`}>
                <button type="button" tabIndex={-1} onClick={() => { setWorkForm((prev) => ({ ...prev, ot_creation_type: 'tabulada' })); setShowInlineMultiPicker(true) }} className={`py-1 px-2 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${workForm.ot_creation_type === 'tabulada' ? 'bg-purple-950/90 text-purple-200 border border-purple-500/80 shadow-sm' : 'text-slate-400 hover:text-white'}`}>Tabulada</button>
                <button type="button" tabIndex={-1} onClick={() => { setWorkForm((prev) => ({ ...prev, ot_creation_type: 'libre', selected_template_id: '' })); setShowInlineMultiPicker(false) }} className={`py-1 px-2 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${workForm.ot_creation_type === 'libre' ? 'bg-amber-500/20 text-amber-200 border border-amber-400/80 shadow-sm' : 'text-slate-400 hover:text-white'}`}>Nombre Libre</button>
              </div>
            </div>
            <div className="md:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Destino del Trabajo <span className="text-rose-400">*</span></label>
              <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-slate-950 border border-slate-800">
                <button type="button" tabIndex={-1} disabled={Boolean(editingWorkItem)} onClick={() => setWorkForm((prev) => ({ ...prev, ot_mode: 'new' }))} className={`py-1 px-2 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${workForm.ot_mode === 'new' ? 'bg-sky-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}`}>+ Crear Nueva OT</button>
                <button type="button" tabIndex={-1} disabled={Boolean(editingWorkItem)} onClick={() => setWorkForm((prev) => ({ ...prev, ot_mode: 'existing' }))} className={`py-1 px-2 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${workForm.ot_mode === 'existing' ? 'bg-sky-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}`}>Usar OT Existente</button>
              </div>
            </div>
            <div className="md:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Tipo de Trabajo <span className="text-rose-400">*</span></label>
              <div className="grid grid-cols-3 gap-1 p-0.5 rounded-xl bg-slate-950 border border-slate-800">
                {TIPOS_DE_TRABAJO.map((t) => (
                  <button key={t.value} type="button" tabIndex={-1} onClick={() => setWorkForm((prev) => ({ ...prev, work_type: t.value }))} className={`py-1 px-1.5 rounded-lg font-bold text-[11px] transition-all cursor-pointer truncate ${workForm.work_type === t.value ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400 shadow-sm' : 'text-slate-400 hover:text-white'}`} title={t.label}>
                    {t.shortLabel || t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            <div className="sm:col-span-2">
              <label className="flex items-center justify-between text-[11px] font-semibold text-slate-400 mb-1">
                <span>Nº OT</span>
                {workForm.ot_mode === 'new' && <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400">Auto</span>}
              </label>
              <input type="text" readOnly disabled value={workForm.ot_number} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-2 py-1.5 text-xs text-primary font-mono font-black text-center cursor-not-allowed" />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Barco / Embarcación <span className="text-rose-400">*</span></label>
              <select
                required
                autoFocus
                disabled={Boolean(editingWorkItem)}
                value={workForm.ship_id}
                onChange={(e) => {
                  const newShipId = e.target.value
                  const shipWos = buildStandardShipWorkOrdersCatalog(workOrders, workItems, { shipId: newShipId, includeEliminated: false, includeClosed: false })
                  setWorkForm((p) => ({ ...p, ship_id: newShipId, existing_wo_id: shipWos[0]?.id || '', ot_number: getNextOtNumberForShip(workOrders, newShipId) }))
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold disabled:opacity-60 focus:outline-none focus:border-cyan-400"
              >
                <option value="">-- Seleccionar Barco --</option>
                {ships.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            {workForm.ot_mode === 'new' ? (
              <>
                <div className={workForm.ot_creation_type === 'tabulada' ? 'sm:col-span-4' : 'sm:col-span-7'}>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">Nombre de la OT <span className="text-rose-400">*</span></label>
                  <input
                    type="text"
                    required={selectedBatchTemplates.length <= 1}
                    value={workForm.ot_title}
                    onChange={(e) => setWorkForm((prev) => ({ ...prev, ot_title: e.target.value.toUpperCase() }))}
                    onBlur={() => setWorkForm((prev) => ({ ...prev, ot_title: (prev.ot_title || '').trim().toUpperCase() }))}
                    placeholder="Ej: REPARACIÓN VÁLVULAS DE CASCO..."
                    className={`w-full bg-slate-950 border rounded-lg px-2.5 py-1.5 text-xs text-white font-bold uppercase focus:outline-none ${workDuplicateConflict ? 'border-rose-500 focus:border-rose-400' : 'border-slate-700 focus:border-cyan-400'}`}
                  />
                </div>
                {workForm.ot_creation_type === 'tabulada' && (
                  <div className="sm:col-span-3">
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-purple-300">Catálogo OT.ABC</label>
                      <button type="button" tabIndex={-1} onClick={() => { setTemplatePickerFromForm(true); setIsTemplateModalOpen(true) }} className="text-[10px] text-amber-300 hover:underline font-bold flex items-center gap-0.5 cursor-pointer">
                        <Sparkles className="w-2.5 h-2.5" /><span>ABM</span>
                      </button>
                    </div>
                    <input type="text" value={inlineCatalogSearch} onChange={(e) => { setInlineCatalogSearch(e.target.value); setShowInlineMultiPicker(true) }} placeholder="Buscar trabajo estándar..." className="w-full bg-slate-950 border border-purple-700/70 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400" />
                  </div>
                )}
              </>
            ) : (
              <div className="sm:col-span-7">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Seleccionar OT Existente <span className="text-rose-400">*</span></label>
                <select
                  required
                  disabled={Boolean(editingWorkItem)}
                  value={workForm.existing_wo_id}
                  onChange={(e) => {
                    const wo = workOrders.find((w) => w.id === e.target.value)
                    setWorkForm((prev) => ({ ...prev, existing_wo_id: e.target.value, foreman_name: wo?.foreman_name || prev.foreman_name, ot_title: wo?.title || prev.ot_title, ot_number: wo?.ot_number || prev.ot_number }))
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold disabled:opacity-60 focus:outline-none focus:border-cyan-400"
                >
                  <option value="">-- Seleccionar OT --</option>
                  {standardShipWos.map((w) => <option key={w.id} value={w.id}>{w.ot_number} &bull; {w.title}</option>)}
                </select>
              </div>
            )}
          </div>

          {workForm.ot_mode === 'new' && (workDuplicateConflict || batchDuplicateConflicts.length > 0) && (
            <div className={`px-2.5 py-1.5 rounded-xl border text-[11px] font-bold flex items-center justify-between gap-2 ${(workDuplicateConflict?.kind || batchDuplicateConflicts[0]?.kind) === 'ELIMINATED' ? 'bg-amber-950/60 border-amber-500/60 text-amber-200' : 'bg-rose-950/60 border-rose-500/60 text-rose-200'}`}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{workDuplicateConflict ? workDuplicateConflict.message : `${batchDuplicateConflicts[0].title}: ${batchDuplicateConflicts[0].message}`}</span>
              </div>
              {workDuplicateConflict?.kind === 'ACTIVE' && workDuplicateConflict.existingWo?.id && (
                <button type="button" onClick={() => setWorkForm((prev) => ({ ...prev, ot_mode: 'existing', existing_wo_id: workDuplicateConflict.existingWo.id, ot_title: workDuplicateConflict.existingWo.title, ot_number: workDuplicateConflict.existingWo.ot_number }))} className="px-2 py-0.5 rounded-lg bg-white text-slate-900 text-[10px] font-black shrink-0 cursor-pointer">
                  Usar esa OT existente
                </button>
              )}
            </div>
          )}

          {workForm.ot_mode === 'new' && workForm.ot_creation_type === 'tabulada' && (
            <div className="p-2 rounded-xl bg-slate-950/90 border border-purple-700/50 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-purple-300">Catálogo OT.ABC ({templates.length})</span>
                  {['TODAS', ...OT_ABC_CATEGORIES].map((cat) => (
                    <button key={cat} type="button" tabIndex={-1} onClick={() => { setInlineCatalogCategory(cat); setShowInlineMultiPicker(true) }} className={`px-1.5 py-0.5 rounded text-[10px] font-bold cursor-pointer ${inlineCatalogCategory === cat ? 'bg-purple-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}>
                      {cat === 'TODAS' ? 'Todas' : cat}
                    </button>
                  ))}
                  {selectedBatchTemplates.length > 0 && <span className="px-1.5 py-0.5 rounded bg-purple-900/80 text-white text-[10px]">{selectedBatchTemplates.length} sel.</span>}
                </div>
                <button type="button" tabIndex={-1} onClick={() => setShowInlineMultiPicker((v) => !v)} className="text-[10px] text-slate-400 hover:text-white font-bold cursor-pointer">
                  {showInlineMultiPicker ? 'Contraer lista' : 'Mostrar lista'}
                </button>
              </div>
              {(showInlineMultiPicker || inlineCatalogSearch.trim()) && (
                <div className="max-h-24 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-1">
                  {templates
                    .filter((t) => {
                      const cat = normalizeOtAbcCategory(t.category)
                      if (inlineCatalogCategory !== 'TODAS' && cat !== inlineCatalogCategory && cat !== 'Ambas') return false
                      return !inlineCatalogSearch.trim() ? true : t.name.toLowerCase().includes(inlineCatalogSearch.toLowerCase())
                    })
                    .map((tpl) => {
                      const isChecked = selectedBatchTemplates.some((item) => item.template_id === tpl.id)
                      const opSel = buildOperationalSelectionFromTemplate(tpl, workForm.status || 'En ejecución')
                      return (
                        <div
                          key={tpl.id}
                          onClick={() => {
                            setSelectedBatchTemplates((prev) => {
                              const next = prev.some((item) => item.template_id === tpl.id) ? prev.filter((item) => item.template_id !== tpl.id) : [...prev, opSel]
                              if (next.length === 1) {
                                setWorkForm((wf) => ({ ...wf, selected_template_id: next[0].template_id, ot_title: next[0].ot_title, description: next[0].description || wf.description }))
                              }
                              return next
                            })
                          }}
                          className={`p-1.5 rounded-lg border text-[11px] flex items-center justify-between gap-1.5 cursor-pointer ${isChecked ? 'bg-purple-950/80 border-purple-500 text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'}`}
                        >
                          <div className="flex items-center gap-1.5 truncate">
                            <input type="checkbox" checked={isChecked} onChange={() => {}} className="w-3.5 h-3.5 rounded accent-purple-500 shrink-0" />
                            <span className="truncate">{tpl.name}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {opSel.subworks.length > 0 && <span className="text-[9px] px-1 rounded bg-amber-500/20 text-amber-300 font-bold">{opSel.subworks.length} sub</span>}
                            {tpl.category && <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400 font-mono">{tpl.category}</span>}
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
              {selectedBatchTemplates.length === 1 && selectedBatchTemplates[0].subworks?.length > 0 && (
                <div className="px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/40 text-[10px] text-amber-200">
                  <strong>Sub-trabajos automáticos ({selectedBatchTemplates[0].subworks.length}):</strong>{' '}
                  {selectedBatchTemplates[0].subworks.map((s) => s.title).join(' · ')}
                </div>
              )}
            </div>
          )}
        </CanonicalStepperStep>

        <CanonicalStepperStep step={2} helpEntry={WORK_ORDER_STEP_HELP[2]} title="DETALLE TÉCNICO DEL TRABAJO" subtitle="Descripción operativa y estado">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
            <div className="md:col-span-6">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Descripción Técnica <span className="text-rose-400">*</span></label>
              <input type="text" required value={workForm.description} onChange={(e) => setWorkForm((prev) => ({ ...prev, description: e.target.value }))} placeholder="Detallá los trabajos a realizar..." className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none" />
            </div>
            <div className="md:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Estado del Trabajo <span className="text-rose-400">*</span></label>
              <select value={workForm.status} onChange={(e) => setWorkForm((prev) => ({ ...prev, status: e.target.value }))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:border-cyan-400 focus:outline-none">
                {ESTADOS_TRABAJO.map((st) => <option key={st.value} value={st.value}>{st.value}</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Comentarios</label>
              <input type="text" value={workForm.comments} onChange={(e) => setWorkForm((prev) => ({ ...prev, comments: e.target.value }))} placeholder="Comentario interno opcional..." className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-cyan-400 focus:outline-none" />
            </div>
          </div>
        </CanonicalStepperStep>

        <CanonicalStepperStep step={3} helpEntry={WORK_ORDER_STEP_HELP[3]} title="RESPONSABLES, FACTURACIÓN Y TERCEROS" subtitle="Jefe de Obra ➔ Facturación ➔ Contratistas y PRC $0" isLast={true}>
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-start">
            <div className="md:col-span-3">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-semibold text-slate-400">Jefe de Obra <span className="text-rose-400">*</span></label>
                <button type="button" tabIndex={-1} onClick={() => setIsCreatingForemanInline(!isCreatingForemanInline)} className="text-[10px] text-cyan-400 hover:underline font-bold cursor-pointer">
                  {isCreatingForemanInline ? 'Cancelar' : '+ Crear JO'}
                </button>
              </div>
              {isCreatingForemanInline ? (
                <div className="p-2 rounded-xl bg-slate-950 border border-cyan-500/50 flex items-center gap-1.5">
                  <input type="text" placeholder="Nombre Jefe..." value={newForemanForm.name} onChange={(e) => setNewForemanForm((p) => ({ ...p, name: e.target.value }))} className="flex-1 min-w-0 bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white" />
                  <button type="button" disabled={savingNewForeman} onClick={handleCreateForemanInline} className="px-2 py-1 rounded bg-cyan-500 text-slate-950 text-[10px] font-bold cursor-pointer shrink-0">{savingNewForeman ? '...' : 'Guardar'}</button>
                </div>
              ) : (
                <select value={workForm.foreman_name} onChange={(e) => setWorkForm((prev) => ({ ...prev, foreman_name: e.target.value }))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-400">
                  {foremenList.map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              )}
            </div>

            <div className="md:col-span-5 space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-400">Centro de Facturación</label>
              <div className="grid grid-cols-2 gap-1 p-0.5 rounded-xl bg-slate-950 border border-slate-800">
                {['Presupuesto General', 'Adicional / Específico'].map((opt) => (
                  <button key={opt} type="button" tabIndex={-1} onClick={() => setWorkForm((prev) => ({ ...prev, assignment_type: opt, specific_budget_id: opt === 'Adicional / Específico' ? prev.specific_budget_id : '' }))} className={`py-1 px-2 rounded-lg font-bold text-[11px] transition-all cursor-pointer truncate ${workForm.assignment_type === opt ? 'bg-cyan-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'}`}>
                    {opt}
                  </button>
                ))}
              </div>
              {workForm.assignment_type === 'Adicional / Específico' && (
                <div className="p-1.5 rounded-xl bg-amber-950/20 border border-amber-500/40 flex items-center gap-1.5">
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" tabIndex={-1} onClick={() => { setBudgetOptionMode('CONOCIDO'); setWorkForm((prev) => ({ ...prev, specific_budget_id: extractBudgetDigits(prev.specific_budget_id) })) }} className={`py-1 px-2 rounded-lg text-[10px] font-bold border cursor-pointer whitespace-nowrap ${budgetOptionMode === 'CONOCIDO' ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>Tengo Nº</button>
                    <button type="button" tabIndex={-1} onClick={() => { setBudgetOptionMode('PENDIENTE'); setWorkForm((prev) => ({ ...prev, specific_budget_id: BUDGET_PENDING_VALUE })) }} className={`py-1 px-2 rounded-lg text-[10px] font-bold border cursor-pointer whitespace-nowrap ${budgetOptionMode === 'PENDIENTE' ? 'bg-amber-500/20 border-amber-400 text-amber-200' : 'bg-slate-900 border-slate-800 text-slate-400'}`}>Pendiente</button>
                  </div>
                  {budgetOptionMode === 'CONOCIDO' ? (
                    <div className="flex items-center flex-1 min-w-0 bg-slate-950 border border-amber-500/50 rounded-lg overflow-hidden focus-within:border-amber-400">
                      <span className="px-1.5 py-1 bg-amber-950/60 border-r border-amber-500/30 text-[9px] font-mono font-black text-amber-300 select-none shrink-0">PRESUP.</span>
                      <input type="text" inputMode="numeric" pattern="[0-9]*" value={extractBudgetDigits(workForm.specific_budget_id)} onChange={(e) => setWorkForm((prev) => ({ ...prev, specific_budget_id: extractBudgetDigits(e.target.value) }))} onBlur={() => { if (!extractBudgetDigits(workForm.specific_budget_id)) setWorkForm((prev) => ({ ...prev, specific_budget_id: '' })) }} placeholder="Ej: 210" className="w-full min-w-0 bg-transparent px-2 py-1 text-xs text-white font-mono font-bold focus:outline-none" />
                    </div>
                  ) : (
                    <div className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-amber-950/50 border border-amber-500/50 text-[10px] font-mono font-black text-amber-300 truncate">{BUDGET_PENDING_VALUE} • Alerta M.J.</div>
                  )}
                </div>
              )}
            </div>

            <div className="md:col-span-4 space-y-1.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Contratista(s) o Grupo(s)</label>
                <div className="relative">
                  <input type="text" value={contractorSelectInput} onChange={(e) => { setContractorSelectInput(e.target.value); setIsContractorListOpen(true) }} onFocus={() => setIsContractorListOpen(true)} onBlur={() => setTimeout(() => setIsContractorListOpen(false), 150)} placeholder="Buscar contratista o grupo..." className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-400" />
                  {isContractorListOpen && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 max-h-40 overflow-y-auto bg-slate-950 border border-slate-700 rounded-xl shadow-2xl z-30 divide-y divide-slate-800">
                      {contractorCatalog
                        .filter((c) => !(workForm.contractors || []).includes(c.name) && (!contractorSelectInput.trim() || c.name.toLowerCase().includes(contractorSelectInput.toLowerCase())))
                        .map((c) => (
                          <div key={c.name} onMouseDown={() => { setWorkForm((p) => ({ ...p, contractors: [...p.contractors, c.name] })); setContractorSelectInput(''); setIsContractorListOpen(false) }} className="p-2 hover:bg-slate-800/80 cursor-pointer flex items-center justify-between text-xs">
                            <span className="font-bold text-white">{c.name}</span>
                            {c.can_charge_third_party && <span className="text-[9px] px-1.5 py-0.2 rounded bg-purple-950 text-purple-300 font-mono">3ros</span>}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
                {workForm.contractors.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {workForm.contractors.map((c) => (
                      <span key={c} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-950 border border-slate-700 text-[11px] font-mono font-bold text-slate-200">
                        <span>{c}</span>
                        <button type="button" tabIndex={-1} onClick={() => setWorkForm((p) => ({ ...p, contractors: p.contractors.filter((x) => x !== c) }))} className="text-slate-400 hover:text-rose-400 cursor-pointer">✕</button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <label className="p-1.5 rounded-xl bg-slate-950 border border-purple-900/50 flex items-start gap-2 text-xs text-slate-200 cursor-pointer">
                <input type="checkbox" disabled={!thirdPartyPrcEvaluation.canEnable} checked={workForm.send_to_third_party_prc && thirdPartyPrcEvaluation.canEnable} onChange={(e) => setWorkForm((prev) => ({ ...prev, send_to_third_party_prc: e.target.checked }))} className="w-4 h-4 rounded accent-purple-500 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-purple-300 text-[11px]">Generar Comprobante PRC $0 en Terceros</span>
                    {existingWorkItemPrc.hasOfficialPrc && (
                      <CanonicalPrcBadge prc={existingWorkItemPrc.prc} additionals={existingWorkItemPrc.additionals} variant="pill" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate">{thirdPartyPrcEvaluation.reason}</span>
                  {(workForm.send_to_third_party_prc || workForm.work_type === 'PRESUPUESTO') && (
                    <span className="text-[10px] text-amber-300/90 block mt-0.5">{PRC_BUSINESS_RULE_NOTICE}</span>
                  )}
                </div>
              </label>
            </div>
          </div>
        </CanonicalStepperStep>
      </CanonicalStepperModal>

      {/* 2. SEPARATE MODAL (MODULAR) */}
      {separatingRow && (
        <WorkOrderSeparateModal
          key={separatingRow.id || separatingRow.work_order_id}
          separatingRow={separatingRow}
          workOrders={workOrders}
          workItems={workItems}
          user={user}
          onClose={() => setSeparatingRow(null)}
          loadData={loadData}
          showWoGridFeedback={showWoGridFeedback}
        />
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

              {tpCascadeForm.status === 'PRC' && (
                <div className="p-2.5 rounded-xl bg-amber-950/35 border border-amber-500/40 text-amber-200 text-[11px]">
                  {PRC_BUSINESS_RULE_NOTICE} El número correlativo (#2000+) se asignará automáticamente tras la doble confirmación.
                </div>
              )}

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

                  <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setIsAmpliarModalOpen(true)} className="px-3 py-1.5 bg-amber-500/15 text-amber-300 border border-amber-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer">
                        <Send className="w-3.5 h-3.5" /><span>Botón Ampliar</span>
                      </button>
                      {typeof onOpenUnifyModal === 'function' && !isMergedWorkOrder(selectedWoDetail) && (
                        <button
                          type="button"
                          onClick={() => {
                            const target = selectedWoDetail
                            setSelectedWoDetail(null)
                            onOpenUnifyModal(target)
                          }}
                          className="px-3 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/40 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Combine className="w-3.5 h-3.5" /><span>Unificar OT</span>
                        </button>
                      )}
                    </div>
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

      {/* 7. CATÁLOGO OT.ABC MODULAR */}
      <OtCatalogModal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        templates={templates}
        user={user}
        loadData={loadData}
        showWoGridFeedback={showWoGridFeedback}
        onUseSingleTemplate={handleUseSingleTemplate}
        onConfirmMultiSelection={handleConfirmCatalogMultiSelection}
        onSaveTemplate={saveOtTemplateCompleteService}
        onUpdateCategory={updateOtTemplateCategoryService}
        onDeleteTemplate={deleteOtTemplateService}
      />

      {/* 8. DOBLE CONFIRMACIÓN PRC DESDE MODALES OT / TERCEROS CASCADA */}
      <CanonicalPrcConfirmModal
        isOpen={Boolean(pendingModalPrcConfirm)}
        context={pendingModalPrcConfirm?.kind === 'tp_cascade' ? {
          contractorName: tpCascadeForm.contractor_name,
          shipName: ships.find((s) => s.id === tpCascadeForm.ship_id)?.name || 'Buque',
          otLabel: selectedTpCascadeWorkItem ? `${selectedTpCascadeWorkItem.wo?.ot_number || ''} ${selectedTpCascadeWorkItem.wo?.title || ''}`.trim() : '',
          description: selectedTpCascadeWorkItem?.description || '',
          amountArs: Number(tpCascadeForm.amount_ars || 0),
        } : pendingModalPrcConfirm ? {
          contractorName: (workForm.contractors || [])[0] || '',
          shipName: ships.find((s) => s.id === workForm.ship_id)?.name || 'Buque',
          otLabel: workForm.ot_title || '',
          description: workForm.description || '',
        } : null}
        onCancel={() => setPendingModalPrcConfirm(null)}
        onConfirm={async () => {
          if (pendingModalPrcConfirm?.kind === 'tp_cascade') {
            setSavingTpCascade(true)
            try {
              const res = await issueAndSaveTpCascadePrcService({
                tpCascadeForm,
                selectedWorkItem: selectedTpCascadeWorkItem,
                workers,
                macroVariables,
                user,
              })
              setPendingModalPrcConfirm(null)
              setIsThirdPartyCascadeOpen(false)
              await loadData()
              showWoGridFeedback('success', `${formatPrcNumberLabel(res.prc.prc_number)} emitido y guardado en Terceros.`)
            } finally {
              setSavingTpCascade(false)
            }
          } else {
            await executeSaveWorkSubmit(true)
            setPendingModalPrcConfirm(null)
          }
        }}
      />
    </>
  )
}
