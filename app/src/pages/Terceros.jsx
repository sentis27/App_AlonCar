import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useSpreadsheetGrid } from '../hooks/useSpreadsheetGrid'
import ShipWorkOrderPickerModal from '../components/ShipWorkOrderPickerModal'
import {
  Wrench,
  Building2,
  ShieldCheck,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Clock,
  DollarSign,
  Filter,
  Plus,
  Search,
  X,
  ChevronRight,
  Layers,
  ArrowRight,
  Lock,
  Unlock,
  FileCheck,
  Eye,
  History,
  Calendar,
  Anchor,
  AlertCircle,
  Trash2,
  Edit3,
  Ship,
  Sparkles,
  ExternalLink,
  ChevronDown,
  RotateCcw,
  RotateCw
} from 'lucide-react'

// Tipos de Comprobante y Reglas de Negocio (DEC-017)
const VOUCHER_TYPES = [
  {
    code: 'PRC',
    label: 'PRC - Presupuesto Interno',
    color: 'bg-emerald-950/80 text-emerald-300 border-emerald-800/60',
    description: 'Trabajo ejecutado dentro de las instalaciones del astillero. Estado definitivo, no evoluciona.'
  },
  {
    code: 'RMO',
    label: 'RMO - Remito Mano de Obra (Taller)',
    color: 'bg-blue-950/80 text-blue-300 border-blue-800/60',
    description: 'Trabajo ejecutado en taller externo del contratista. Evoluciona a FCR (Factura) o SDT.'
  },
  {
    code: 'RPF',
    label: 'RPF - Remito Pendiente de Factura',
    color: 'bg-amber-950/80 text-amber-300 border-amber-800/60 ring-1 ring-amber-500/50',
    description: 'Remito valorizado pendiente de factura oficial. Genera alerta administrativa para exigir factura.'
  },
  {
    code: 'FCR',
    label: 'FCR - Factura Fiscal Oficial',
    color: 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60',
    description: 'Comprobante fiscal respaldatorio oficial definitivo.'
  },
  {
    code: 'SDT',
    label: 'SDT - Sin Documentación',
    color: 'bg-rose-950/80 text-rose-300 border-rose-800/60',
    description: 'Gasto o trabajo cerrado sin factura fiscal oficial (Excepcional).'
  }
]

// Lista oficial de rubros disponibles (para contratistas MANUAL / polirrubro)
const OFFICIAL_TRADES = [
  'CALDERERIA',
  'TORNERIA',
  'MECANICA',
  'CORTE/PLEGADO',
  'CORTE PANTOGRAFO',
  'CARPINTERIA',
  'ELECTRICIDAD',
  'PINTURA',
  'MANIOBRA',
  'HIDRAULICA',
  'SOLDADURAS',
  'ARENADO',
  'RECTIFICACION MECANICA',
  'FLETE',
  'ELECTRONICA',
  'FIBRA VIDRIO',
  'SERVICIOS',
  'LONAS',
  'TALLER',
  'HONORARIOS',
  'CONTENEDORES',
  'GRUA',
  'ENSAYOS',
  'DESGASIFICACION'
]

// Formateador estándar de fecha dd/mm/aaaa para todo el sistema
function formatDate(dateStr) {
  if (!dateStr) return '-'
  const clean = String(dateStr).split('T')[0]
  const parts = clean.split('-')
  if (parts.length === 3) {
    const [y, m, d] = parts
    return `${d.padStart(2, '0')}/${m.padStart(2, '0')}/${y}`
  }
  return dateStr
}

// Función utilitaria para obtener el tipo de cambio oficial congelado por fecha de carga
function getDollarRateForDate(dateStr, macroVariables) {
  if (!dateStr) return 1500
  if (!macroVariables || macroVariables.length === 0) return 1500
  const parts = dateStr.split('-')
  if (parts.length < 3) return 1500
  const year = parseInt(parts[0], 10)
  const month = parseInt(parts[1], 10)
  const day = parseInt(parts[2], 10)

  const mv = macroVariables.find((m) => m.year === year && m.month === month)
  if (!mv) {
    const sorted = [...macroVariables].sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month))
    const latest = sorted[0]
    if (!latest) return 1500
    const rate = day <= 15 ? (latest.dollar_rate_1q || latest.dollar_rate) : (latest.dollar_rate_2q || latest.dollar_rate)
    return Number(rate) || 1500
  }
  const rate = day <= 15 ? (mv.dollar_rate_1q || mv.dollar_rate) : (mv.dollar_rate_2q || mv.dollar_rate)
  return Number(rate) || 1500
}

// Desplegable integrado con buscador en tiempo real (Regla general como en creación de OT)
function SearchableContractorSelect({ contractors, value, onChange, disabled }) {
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
        <Search className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none z-10" />
        <input
          type="text"
          disabled={disabled}
          placeholder="Escribí para buscar o seleccioná de la lista..."
          value={isOpen ? query : (selectedContractor ? `${selectedContractor.name} [${selectedContractor.trade || 'SIN RUBRO'}]` : '')}
          onFocus={() => {
            setIsOpen(true)
            setQuery('')
          }}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
          }}
          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-16 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400 placeholder-slate-500 transition-colors cursor-pointer"
        />
        <div className="absolute right-2 flex items-center gap-1 z-10">
          {value && !disabled && (
            <button
              type="button"
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
            disabled={disabled}
            onClick={() => setIsOpen((prev) => !prev)}
            className="p-1 text-slate-400 hover:text-white rounded-md cursor-pointer"
          >
            <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </div>

      {isOpen && !disabled && (
        <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 p-1 divide-y divide-slate-800/60">
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
                  onClick={() => {
                    onChange(c.name)
                    setIsOpen(false)
                    setQuery('')
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg flex items-center justify-between text-xs font-mono transition-colors cursor-pointer ${
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

export default function Terceros() {
  const { profile, user } = useAuth()

  // 1. Perspectiva / Terminal Activa
  const [activeRolePerspective, setActiveRolePerspective] = useState(() => {
    const saved = localStorage.getItem('aloncar_terceros_terminal')
    return saved || 'maria_jose'
  })

  useEffect(() => {
    localStorage.setItem('aloncar_terceros_terminal', activeRolePerspective)
  }, [activeRolePerspective])

  // Permiso de edición de montos: Exclusivo para María José y Jorge Sentis (Admin)
  const canEditAmounts = useMemo(() => {
    return activeRolePerspective === 'admin' || activeRolePerspective === 'maria_jose'
  }, [activeRolePerspective])

  // 2. Estados principales de datos
  const [services, setServices] = useState([])
  const [ships, setShips] = useState([])
  const [workOrders, setWorkOrders] = useState([])
  const [contractors, setContractors] = useState([])
  const [macroVariables, setMacroVariables] = useState([])
  const [voucherHistory, setVoucherHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [feedbackMessage, setFeedbackMessage] = useState(null)

  const searchInputRef = useRef(null)
  const [inlineEdit, setInlineEdit] = useState({ id: null, field: null, value: '' })
  const [pickerModal, setPickerModal] = useState({
    isOpen: false,
    serviceId: null,
    shipId: '',
    workOrderId: '',
    contractorName: ''
  })

  // 3. Filtros y Vistas
  const [viewMode, setViewMode] = useState('filas') // 'filas' | 'fichas'
  const [kpiFilter, setKpiFilter] = useState('todos') // 'todos' | 'sin_precio' | 'sin_ot'
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedShipFilter, setSelectedShipFilter] = useState('todos')
  const [selectedContractorFilter, setSelectedContractorFilter] = useState('todos')
  const [selectedTradeFilter, setSelectedTradeFilter] = useState('todos')
  const [selectedVoucherFilter, setSelectedVoucherFilter] = useState('todos')
  const [selectedAuditFilter, setSelectedAuditFilter] = useState('todos')

  // Selección múltiple interactiva (estilo Excel / Google Sheets)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null)

  // 4. Modal de Carga Guiada en Cascada (Barco -> Contratista 3ros -> OT)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [savingService, setSavingService] = useState(false)
  const [contractorModalSearch, setContractorModalSearch] = useState('')

  // Formulario de servicio con soporte multi-comprobante
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

  // 5. Modal de Evolución Rápida de Comprobante (RMO / RPF -> FCR o SDT)
  const [evolvingService, setEvolvingService] = useState(null)
  const [evolutionForm, setEvolutionForm] = useState({
    target_voucher_type: 'FCR',
    new_voucher_number: '',
    voucher_date: new Date().toISOString().split('T')[0],
    final_amount_ars: '',
    evolution_notes: ''
  })
  const [savingEvolution, setSavingEvolution] = useState(false)

  // 6. Modal de Auditoría Técnica (Jefes de Obra)
  const [auditingService, setAuditingService] = useState(null)
  const [auditForm, setAuditForm] = useState({
    audit_status: 'CONFORME',
    audit_notes: ''
  })
  const [savingAudit, setSavingAudit] = useState(false)

  // 7. Modal de Historial de Comprobante
  const [historyService, setHistoryService] = useState(null)

  // Cargar datos desde Supabase
  const fetchData = async () => {
    try {
      setLoading(true)
      const [
        srvRes,
        shpRes,
        woRes,
        wkrRes,
        mvRes,
        vhRes
      ] = await Promise.all([
        supabase.from('third_party_services').select('*').order('created_at', { ascending: false }),
        supabase.from('ships').select('id, name, vessel_type, current_location').order('name'),
        supabase.from('work_orders').select('id, ot_number, title, ship_id, status, is_tabulated').order('ot_number'),
        supabase.from('workers').select('id, name, trade, work_group, admin_center, can_charge_third_party').eq('can_charge_third_party', true).order('name'),
        supabase.from('macro_variables').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
        supabase.from('third_party_voucher_history').select('*').order('created_at', { ascending: false })
      ])

      if (srvRes.error) console.warn('Aviso third_party_services:', srvRes.error.message)
      if (shpRes.error) console.warn('Aviso ships:', shpRes.error.message)
      if (woRes.error) console.warn('Aviso work_orders:', woRes.error.message)
      if (wkrRes.error) console.warn('Aviso workers:', wkrRes.error.message)
      if (mvRes.error) console.warn('Aviso macro_variables:', mvRes.error.message)
      if (vhRes.error) console.warn('Aviso third_party_voucher_history:', vhRes.error.message)

      setServices(srvRes.data || [])
      setShips(shpRes.data || [])
      setWorkOrders(woRes.data || [])
      setContractors(wkrRes.data || [])
      setMacroVariables(mvRes.data || [])
      setVoucherHistory(vhRes.data || [])
    } catch (err) {
      console.error('Error cargando módulo de terceros:', err)
      showFeedback('error', 'Error al sincronizar datos de Terceros: ' + (err.message || err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const showFeedback = (type, text) => {
    setFeedbackMessage({ type, text })
    setTimeout(() => {
      setFeedbackMessage(null)
    }, 4500)
  }

  // OTs disponibles en cascada para el barco seleccionado en el formulario
  const availableWorkOrdersForSelectedShip = useMemo(() => {
    if (!formData.ship_id) return []
    return workOrders.filter((wo) => wo.ship_id === formData.ship_id)
  }, [workOrders, formData.ship_id])

  // Contratistas filtrados en el modal de carga para búsqueda veloz
  const filteredModalContractors = useMemo(() => {
    if (!contractorModalSearch.trim()) return contractors
    const q = contractorModalSearch.toLowerCase().trim()
    return contractors.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.trade || '').toLowerCase().includes(q)
    )
  }, [contractors, contractorModalSearch])

  // Mapa de barcos por id
  const shipMap = useMemo(() => {
    const map = new Map()
    ships.forEach((s) => map.set(s.id, s))
    return map
  }, [ships])

  // Mapa de OTs por id
  const otMap = useMemo(() => {
    const map = new Map()
    workOrders.forEach((w) => map.set(w.id, w))
    return map
  }, [workOrders])

  // Mapa de contratistas por nombre en mayúsculas para rápida resolución de rubros
  const contractorMap = useMemo(() => {
    const map = new Map()
    contractors.forEach((c) => map.set(c.name.toUpperCase().trim(), c))
    return map
  }, [contractors])

  // Recálculo del dólar oficial congelado por fecha de entrada (intocable)
  const handleEntryDateOrAmountChange = (newDate, newAmountArs) => {
    const rate = getDollarRateForDate(newDate, macroVariables) || 1500
    const ars = parseFloat(newAmountArs) || 0
    const usd = rate > 0 ? Number((ars / rate).toFixed(2)) : 0
    return { usd_rate: rate, amount_usd: usd }
  }

  // Al seleccionar un contratista en el modal de carga:
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

  // Abrir modal para nuevo gasto de terceros
  const handleOpenNewModal = () => {
    const today = new Date().toISOString().split('T')[0]
    const defaultShipId = ships.length > 0 ? ships[0].id : ''
    const { usd_rate, amount_usd } = handleEntryDateOrAmountChange(today, 0)

    setContractorModalSearch('')
    setEditingService(null)
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
    setIsModalOpen(true)
  }

  // Abrir modal de edición
  const handleOpenEditModal = (service) => {
    const foundContractor = contractors.find((c) => c.name.toUpperCase().trim() === (service.contractor_name || '').toUpperCase().trim())
    const isManual = foundContractor?.trade?.toUpperCase().trim() === 'MANUAL'
    const resolvedTrade = service.trade || (!isManual ? foundContractor?.trade || '' : '')

    const bNum = service.budget_number || (service.voucher_type === 'PRC' ? service.voucher_number || '' : '')
    const iNum = service.invoice_number || (['FCR', 'FCA', 'FAC', 'REC', 'FCB', 'FCC'].includes(service.voucher_type) ? service.voucher_number || '' : '')
    const sNum = service.supplier_remito_number || (['RMO', 'RPF'].includes(service.voucher_type) ? service.voucher_number || '' : '')

    const rate = getDollarRateForDate(service.entry_date || service.service_date, macroVariables) || service.usd_rate || 1500
    const ars = service.amount_ars !== null ? service.amount_ars : ''
    const usd = rate > 0 && ars ? Number((parseFloat(ars) / rate).toFixed(2)) : (service.amount_usd || 0)

    setContractorModalSearch('')
    setEditingService(service)
    setFormData({
      ship_id: service.ship_id || '',
      work_order_id: service.work_order_id || '',
      work_item_id: service.work_item_id || '',
      contractor_name: service.contractor_name || '',
      trade: resolvedTrade,
      is_manual_trade: isManual,
      voucher_type: service.voucher_type || 'PRC',
      voucher_number: service.voucher_number || '',
      budget_number: bNum,
      invoice_number: iNum,
      internal_remito_number: service.internal_remito_number || '',
      supplier_remito_number: sNum,
      voucher_date: service.voucher_date || service.service_date || '',
      entry_date: service.entry_date || service.service_date || '',
      service_date: service.service_date || '',
      amount_ars: ars,
      usd_rate: rate,
      amount_usd: usd,
      direct_observations: service.direct_observations || '',
      specific_observations: service.specific_observations || '',
      audit_status: service.audit_status || 'PENDIENTE'
    })
    setIsModalOpen(true)
  }

  // Guardar servicio (Insertar o Editar)
  const handleSaveService = async (e) => {
    e.preventDefault()

    if (!formData.ship_id) {
      showFeedback('error', 'Debe seleccionar un buque/embarcación.')
      return
    }
    if (!formData.contractor_name) {
      showFeedback('error', 'Debe seleccionar un contratista o taller autorizado.')
      return
    }
    if (formData.is_manual_trade && !formData.trade) {
      showFeedback('error', 'Este contratista es polirrubro (MANUAL). Debe seleccionar el rubro aplicable de la lista oficial.')
      return
    }

    // Regla obligatoria: Si es PRC requiere número de presupuesto sí o sí
    if (formData.voucher_type === 'PRC' && !formData.budget_number?.trim() && !formData.voucher_number?.trim()) {
      showFeedback('error', 'La opción PRC requiere cargar un número de presupuesto sí o sí.')
      return
    }

    // Comprobar permiso de edición de montos si es una edición
    if (editingService && !canEditAmounts) {
      formData.amount_ars = editingService.amount_ars
      formData.amount_usd = editingService.amount_usd
      formData.usd_rate = editingService.usd_rate
    }

    try {
      setSavingService(true)
      const parsedArs = parseFloat(formData.amount_ars) || 0
      const rate = getDollarRateForDate(formData.entry_date, macroVariables) || 1500
      const parsedUsd = rate > 0 ? Number((parsedArs / rate).toFixed(2)) : 0

      const foundContractor = contractors.find((c) => c.name.toUpperCase().trim() === formData.contractor_name.toUpperCase().trim())
      const isManual = foundContractor?.trade?.toUpperCase().trim() === 'MANUAL'
      const resolvedTrade = formData.trade?.trim().toUpperCase() || (!isManual ? (foundContractor?.trade || '').trim().toUpperCase() : null)

      let primaryVoucherNumber = formData.voucher_number?.trim() || null
      if (formData.voucher_type === 'PRC') {
        primaryVoucherNumber = formData.budget_number?.trim() || primaryVoucherNumber
      } else if (['FCR', 'FCA', 'FAC', 'REC', 'FCB', 'FCC'].includes(formData.voucher_type)) {
        primaryVoucherNumber = formData.invoice_number?.trim() || primaryVoucherNumber
      } else if (['RMO', 'RPF'].includes(formData.voucher_type)) {
        primaryVoucherNumber = formData.supplier_remito_number?.trim() || primaryVoucherNumber
      }

      const payload = {
        ship_id: formData.ship_id,
        work_order_id: formData.work_order_id || null,
        work_item_id: formData.work_item_id || null,
        contractor_name: formData.contractor_name.trim().toUpperCase(),
        trade: resolvedTrade || 'VARIOS',
        voucher_type: formData.voucher_type,
        voucher_number: primaryVoucherNumber,
        budget_number: formData.budget_number?.trim() || (formData.voucher_type === 'PRC' ? primaryVoucherNumber : null),
        invoice_number: formData.invoice_number?.trim() || (['FCR', 'FCA', 'FAC', 'REC', 'FCB', 'FCC'].includes(formData.voucher_type) ? primaryVoucherNumber : null),
        internal_remito_number: formData.internal_remito_number ? formData.internal_remito_number.trim() : null,
        supplier_remito_number: formData.supplier_remito_number?.trim() || (['RMO', 'RPF'].includes(formData.voucher_type) ? primaryVoucherNumber : null),
        voucher_date: formData.voucher_date || formData.entry_date,
        entry_date: formData.entry_date,
        service_date: formData.service_date || formData.entry_date,
        amount_ars: parsedArs,
        usd_rate: rate,
        amount_usd: parsedUsd,
        direct_observations: formData.direct_observations ? formData.direct_observations.trim() : null,
        specific_observations: formData.specific_observations ? formData.specific_observations.trim() : null,
        status: formData.voucher_type,
        audit_status: formData.audit_status || 'PENDIENTE',
        updated_at: new Date().toISOString()
      }

      if (editingService) {
        // Actualización
        const { error: updErr } = await supabase
          .from('third_party_services')
          .update(payload)
          .eq('id', editingService.id)

        if (updErr) throw updErr

        // Registrar auditoría de edición
        await supabase.from('audit_logs').insert({
          action: 'EDICION_TERCEROS',
          entity_type: 'third_party_services',
          entity_id: editingService.id,
          entity_name: formData.contractor_name,
          details: {
            changes: payload,
            previous_amount_ars: editingService.amount_ars,
            new_amount_ars: parsedArs
          },
          performed_by: activeRolePerspective === 'admin' ? 'JORGE SENTIS' : 'MARIA JOSE'
        })

        showFeedback('success', `Comprobante de ${formData.contractor_name} actualizado exitosamente.`)
      } else {
        // Creación
        payload.created_by = activeRolePerspective === 'admin' ? 'JORGE SENTIS' : 'MARIA JOSE'

        const { error: insErr } = await supabase
          .from('third_party_services')
          .insert(payload)

        if (insErr) throw insErr

        showFeedback('success', `Comprobante de ${formData.contractor_name} (${formData.voucher_type}) cargado con éxito.`)
      }

      setIsModalOpen(false)
      fetchData()
    } catch (err) {
      console.error('Error guardando comprobante de terceros:', err)
      showFeedback('error', 'Error al guardar comprobante: ' + (err.message || err))
    } finally {
      setSavingService(false)
    }
  }

  // Eliminar servicio con registro de auditoría
  const handleDeleteService = async (service) => {
    if (!window.confirm(`¿Confirmas la baja del comprobante ${service.voucher_type} - ${service.contractor_name} por $${Number(service.amount_ars).toLocaleString('es-AR')}?`)) {
      return
    }

    try {
      const { error: delErr } = await supabase
        .from('third_party_services')
        .delete()
        .eq('id', service.id)

      if (delErr) throw delErr

      // Registrar auditoría
      await supabase.from('audit_logs').insert({
        action: 'ELIMINACION_TERCEROS',
        entity_type: 'third_party_services',
        entity_id: service.id,
        entity_name: service.contractor_name,
        details: {
          voucher_type: service.voucher_type,
          voucher_number: service.voucher_number,
          amount_ars: service.amount_ars,
          amount_usd: service.amount_usd
        },
        performed_by: activeRolePerspective === 'admin' ? 'JORGE SENTIS' : 'MARIA JOSE'
      })

      showFeedback('success', 'Registro de Terceros eliminado y asentado en Hoja de Auditorías.')
      fetchData()
    } catch (err) {
      console.error('Error eliminando servicio:', err)
      showFeedback('error', 'No se pudo eliminar el comprobante: ' + (err.message || err))
    }
  }

  // Abrir modal de evolución rápida de comprobante (RMO / RPF -> FCR o SDT)
  const handleOpenEvolutionModal = (service) => {
    setEvolvingService(service)
    setEvolutionForm({
      target_voucher_type: 'FCR',
      new_voucher_number: '',
      voucher_date: new Date().toISOString().split('T')[0],
      final_amount_ars: service.amount_ars !== null ? service.amount_ars : '',
      evolution_notes: `Evolución de ${service.voucher_type} a Factura oficial respaldatoria.`
    })
  }

  // Confirmar evolución de comprobante
  const handleConfirmEvolution = async (e) => {
    e.preventDefault()
    if (!evolvingService) return

    if (evolutionForm.target_voucher_type === 'FCR' && !evolutionForm.new_voucher_number) {
      showFeedback('error', 'Debe especificar el número de Factura oficial definitiva.')
      return
    }

    try {
      setSavingEvolution(true)
      const parsedArs = parseFloat(evolutionForm.final_amount_ars) || evolvingService.amount_ars || 0
      const rate = evolvingService.usd_rate > 0 ? evolvingService.usd_rate : 1500
      const parsedUsd = Number((parsedArs / rate).toFixed(2))

      // 1. Actualizar el servicio
      const { error: updErr } = await supabase
        .from('third_party_services')
        .update({
          voucher_type: evolutionForm.target_voucher_type,
          status: evolutionForm.target_voucher_type,
          voucher_number: evolutionForm.new_voucher_number.trim(),
          voucher_date: evolutionForm.voucher_date,
          amount_ars: parsedArs,
          amount_usd: parsedUsd,
          updated_at: new Date().toISOString()
        })
        .eq('id', evolvingService.id)

      if (updErr) throw updErr

      // 2. Registrar en historial de comprobantes
      await supabase.from('third_party_voucher_history').insert({
        third_party_service_id: evolvingService.id,
        from_voucher_type: evolvingService.voucher_type,
        to_voucher_type: evolutionForm.target_voucher_type,
        from_amount_ars: evolvingService.amount_ars,
        to_amount_ars: parsedArs,
        voucher_number: evolutionForm.new_voucher_number.trim(),
        notes: evolutionForm.evolution_notes,
        changed_by: activeRolePerspective === 'admin' ? 'JORGE SENTIS' : 'MARIA JOSE'
      })

      // 3. Registrar en audit_logs general
      await supabase.from('audit_logs').insert({
        action: 'EVOLUCION_COMPROBANTE_TERCEROS',
        entity_type: 'third_party_services',
        entity_id: evolvingService.id,
        entity_name: evolvingService.contractor_name,
        details: {
          from_voucher_type: evolvingService.voucher_type,
          to_voucher_type: evolutionForm.target_voucher_type,
          invoice_number: evolutionForm.new_voucher_number,
          notes: evolutionForm.evolution_notes
        },
        performed_by: activeRolePerspective === 'admin' ? 'JORGE SENTIS' : 'MARIA JOSE'
      })

      showFeedback('success', `Comprobante evolucionado exitosamente a ${evolutionForm.target_voucher_type} (${evolutionForm.new_voucher_number}).`)
      setEvolvingService(null)
      fetchData()
    } catch (err) {
      console.error('Error al evolucionar comprobante:', err)
      showFeedback('error', 'Error al evolucionar comprobante: ' + (err.message || err))
    } finally {
      setSavingEvolution(false)
    }
  }

  // Abrir modal de auditoría técnica
  const handleOpenAuditModal = (service) => {
    setAuditingService(service)
    setAuditForm({
      audit_status: service.audit_status === 'CONFORME' ? 'CONFORME' : 'CONFORME',
      audit_notes: service.audit_notes || ''
    })
  }

  // Guardar conformidad técnica
  const handleSaveAudit = async (e) => {
    e.preventDefault()
    if (!auditingService) return

    try {
      setSavingAudit(true)
      const auditorName = activeRolePerspective === 'jefe_obra' ? 'JEFE DE OBRA' : activeRolePerspective === 'admin' ? 'JORGE SENTIS' : 'MARIA JOSE'

      const { error: updErr } = await supabase
        .from('third_party_services')
        .update({
          audit_status: auditForm.audit_status,
          audit_notes: auditForm.audit_notes.trim(),
          audited_by: auditorName,
          audited_at: new Date().toISOString()
        })
        .eq('id', auditingService.id)

      if (updErr) throw updErr

      showFeedback('success', `Conformidad técnica guardada como "${auditForm.audit_status}".`)
      setAuditingService(null)
      fetchData()
    } catch (err) {
      console.error('Error guardando auditoría técnica:', err)
      showFeedback('error', 'Error al asentar auditoría técnica: ' + (err.message || err))
    } finally {
      setSavingAudit(false)
    }
  }

  // Filtrado reactivo de servicios
  const filteredServices = useMemo(() => {
    return services.filter((srv) => {
      // 1. Filtro KPI
      if (kpiFilter === 'PRC' && srv.voucher_type !== 'PRC') return false
      if (kpiFilter === 'RMO' && srv.voucher_type !== 'RMO') return false
      if (kpiFilter === 'RPF' && srv.voucher_type !== 'RPF') return false
      if (kpiFilter === 'FCR' && srv.voucher_type !== 'FCR') return false
      if (kpiFilter === 'SDT' && srv.voucher_type !== 'SDT') return false
      if (kpiFilter === 'sin_precio' && Number(srv.amount_ars) > 0) return false
      if (kpiFilter === 'sin_ot' && srv.work_order_id) return false

      // 2. Filtro Buque
      if (selectedShipFilter !== 'todos' && srv.ship_id !== selectedShipFilter) return false

      // 3. Filtro Contratista
      if (selectedContractorFilter !== 'todos' && srv.contractor_name !== selectedContractorFilter) return false

      // 4. Filtro Rubro (evalúa trade directo o rubro del contratista)
      const contractorObj = contractorMap.get(srv.contractor_name?.toUpperCase()?.trim())
      const effectiveTrade = (srv.trade || (contractorObj?.trade && contractorObj.trade !== 'MANUAL' ? contractorObj.trade : '')).toUpperCase()
      if (selectedTradeFilter !== 'todos' && effectiveTrade !== selectedTradeFilter.toUpperCase()) return false

      // 5. Filtro Comprobante
      if (selectedVoucherFilter !== 'todos' && srv.voucher_type !== selectedVoucherFilter) return false

      // 6. Búsqueda de texto libre (cubre barco, OT, contratista, rubro, observaciones y todos los números de comprobantes)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase().trim()
        const ship = shipMap.get(srv.ship_id)?.name?.toLowerCase() || ''
        const otObj = otMap.get(srv.work_order_id)
        const ot = otObj?.ot_number?.toLowerCase() || ''
        const otTitle = otObj?.title?.toLowerCase() || ''
        const contractor = (srv.contractor_name || '').toLowerCase()
        const trade = effectiveTrade.toLowerCase()
        const vnum = (srv.voucher_number || '').toLowerCase()
        const bnum = (srv.budget_number || '').toLowerCase()
        const inum = (srv.invoice_number || '').toLowerCase()
        const snum = (srv.supplier_remito_number || '').toLowerCase()
        const remito = (srv.internal_remito_number || '').toLowerCase()
        const dirObs = (srv.direct_observations || '').toLowerCase()
        const specObs = (srv.specific_observations || '').toLowerCase()

        if (
          !ship.includes(q) &&
          !ot.includes(q) &&
          !otTitle.includes(q) &&
          !contractor.includes(q) &&
          !trade.includes(q) &&
          !vnum.includes(q) &&
          !bnum.includes(q) &&
          !inum.includes(q) &&
          !snum.includes(q) &&
          !remito.includes(q) &&
          !dirObs.includes(q) &&
          !specObs.includes(q)
        ) {
          return false
        }
      }

      return true
    })
  }, [services, kpiFilter, selectedShipFilter, selectedContractorFilter, selectedTradeFilter, selectedVoucherFilter, searchTerm, shipMap, otMap, contractorMap])

  // Métricas calculadas para las alertas individuales de KPI (DEC-017 + Radar Operativo)
  const kpiCounts = useMemo(() => {
    let sinPrecioCount = 0
    let sinOtCount = 0
    let rpfCount = 0
    let fcrCount = 0

    services.forEach((s) => {
      if (!s.amount_ars || Number(s.amount_ars) === 0) sinPrecioCount++
      if (!s.work_order_id) sinOtCount++
      if (s.voucher_type === 'RPF') rpfCount++
      if (s.voucher_type === 'FCR') fcrCount++
    })

    return {
      sinPrecio: sinPrecioCount,
      sinOt: sinOtCount,
      rpf: rpfCount,
      fcr: fcrCount
    }
  }, [services])

  // Columnas interactivas estilo Hoja de Cálculo
  const spreadsheetColumns = useMemo(() => [
    { key: 'service_date', label: 'Fecha', readOnly: false },
    { key: 'ship_wo', label: 'Barco / OT', readOnly: false },
    { key: 'contractor_name', label: 'Contratista', readOnly: false },
    { key: 'trade', label: 'Rubro', readOnly: false },
    { key: 'amount_ars', label: 'Importe AR$', readOnly: !canEditAmounts },
    { key: 'voucher_type', label: 'Comprobante', readOnly: false },
    { key: 'voucher_number', label: 'Nº Comprobante', readOnly: false },
    { key: 'direct_observations', label: 'Comentarios', readOnly: false }
  ], [canEditAmounts])

  // Actualización batch para comandos de hoja de cálculo (Ctrl+D, Ctrl+V, Drag Fill, Ctrl+Z)
  const handleSpreadsheetBatchUpdate = useCallback(async ({ colKey, newValue, targetIds, revertMap, isRevert }) => {
    if (isRevert && revertMap) {
      setServices((prev) =>
        prev.map((s) => {
          if (revertMap[s.id] !== undefined) {
            if (colKey === 'ship_wo') {
              return { ...s, ship_id: revertMap[s.id].ship_id, work_order_id: revertMap[s.id].work_order_id }
            }
            return { ...s, [colKey]: revertMap[s.id] }
          }
          return s
        })
      )
      try {
        for (const [id, oldVal] of Object.entries(revertMap)) {
          if (colKey === 'ship_wo') {
            await supabase.from('third_party_services').update({
              ship_id: oldVal.ship_id,
              work_order_id: oldVal.work_order_id,
              updated_at: new Date().toISOString()
            }).eq('id', id)
          } else {
            await supabase.from('third_party_services').update({
              [colKey]: oldVal,
              updated_at: new Date().toISOString()
            }).eq('id', id)
          }
        }
        showFeedback('success', `Deshecho: valores restaurados en ${Object.keys(revertMap).length} filas.`)
      } catch (err) {
        console.error('Error al revertir:', err)
        showFeedback('error', 'Error al revertir: ' + err.message)
        fetchData()
      }
      return
    }

    const targetIdSet = new Set(targetIds)
    setServices((prev) =>
      prev.map((s) => {
        if (targetIdSet.has(s.id)) {
          if (colKey === 'amount_ars') {
            const num = parseFloat(newValue) || 0
            const rate = Number(s.usd_rate) || 1500
            const usd = rate > 0 ? Number((num / rate).toFixed(2)) : 0
            return { ...s, amount_ars: num, amount_usd: usd }
          }
          return { ...s, [colKey]: newValue }
        }
        return s
      })
    )

    try {
      const updatePayload = { [colKey]: newValue, updated_at: new Date().toISOString() }
      const { error } = await supabase
        .from('third_party_services')
        .update(updatePayload)
        .in('id', targetIds)
      if (error) throw error
      showFeedback('success', `Se actualizaron ${targetIds.length} fila(s) con "${newValue}".`)
    } catch (err) {
      console.error('Error en lote Terceros:', err)
      showFeedback('error', 'Error al actualizar filas: ' + err.message)
      fetchData()
    }
  }, [showFeedback, fetchData])

  // Hook central de Hoja de Cálculo
  const grid = useSpreadsheetGrid({
    rows: filteredServices,
    columns: spreadsheetColumns,
    getRowId: (row) => row.id,
    onBatchUpdate: handleSpreadsheetBatchUpdate,
    onFocusSearch: () => {
      searchInputRef.current?.focus()
      searchInputRef.current?.select()
    },
    canEditCell: (row, colKey, newValue) => {
      if (colKey === 'amount_ars' && !canEditAmounts) {
        showFeedback('error', 'No tienes permisos para modificar importes en esta terminal.')
        return false
      }
      return true
    },
    showFeedback: (type, text) => showFeedback(type, text)
  })

  // Helper de propiedades para cada celda
  function getSpreadsheetCellProps(rowIndex, colKey) {
    const colIdx = spreadsheetColumns.findIndex((c) => c.key === colKey)
    if (colIdx === -1) return { className: '', renderHandle: false, domProps: {} }

    const isActive = grid.isCellActive(rowIndex, colIdx)
    const isSelected = grid.isCellSelected(rowIndex, colIdx)
    const isFillPreview = grid.isCellInFillPreview(rowIndex, colIdx)
    const renderHandle = grid.shouldRenderFillHandle(rowIndex, colIdx)

    return {
      renderHandle,
      domProps: {
        onClick: (e) => grid.handleCellClick(rowIndex, colIdx, e),
        onMouseDown: (e) => grid.handleCellMouseDown(rowIndex, colIdx, e),
        onMouseEnter: () => grid.handleCellMouseEnter(rowIndex, colIdx)
      },
      className: `relative select-none transition-colors ${
        isActive
          ? 'ring-2 ring-cyan-400 bg-cyan-950/40 z-20 outline-none'
          : isFillPreview
          ? 'bg-cyan-900/40 border-y border-dashed border-cyan-400'
          : isSelected
          ? 'bg-cyan-900/30'
          : ''
      }`
    }
  }

  // Guardar edición rápida inline con doble clic
  async function saveInlineEdit(serviceId, field, newValue) {
    setInlineEdit({ id: null, field: null, value: '' })
    const targetService = services.find((s) => s.id === serviceId)
    if (!targetService || targetService[field] === newValue) return

    if (grid?.pushUndoAction) {
      grid.pushUndoAction({
        colKey: field,
        colLabel: field,
        actionLabel: 'Edición en celda',
        previousValues: { [serviceId]: targetService[field] },
        newValue,
        timestamp: Date.now()
      })
    }

    setServices((prev) =>
      prev.map((s) => {
        if (s.id === serviceId) {
          if (field === 'amount_ars') {
            const num = parseFloat(newValue) || 0
            const rate = Number(s.usd_rate) || 1500
            const usd = rate > 0 ? Number((num / rate).toFixed(2)) : 0
            return { ...s, amount_ars: num, amount_usd: usd }
          }
          return { ...s, [field]: newValue }
        }
        return s
      })
    )

    try {
      const updateData = { [field]: newValue, updated_at: new Date().toISOString() }
      if (field === 'amount_ars') {
        const num = parseFloat(newValue) || 0
        const rate = Number(targetService.usd_rate) || 1500
        updateData.amount_ars = num
        updateData.amount_usd = rate > 0 ? Number((num / rate).toFixed(2)) : 0
      }
      const { error } = await supabase
        .from('third_party_services')
        .update(updateData)
        .eq('id', serviceId)
      if (error) throw error
      showFeedback('success', 'Campo actualizado correctamente.')
    } catch (err) {
      console.error('Error guardando celda inline:', err)
      showFeedback('error', 'Error al guardar: ' + err.message)
      setServices((prev) => prev.map((s) => (s.id === serviceId ? targetService : s)))
    }
  }

  const handleRowClick = (id, index, event) => {
    if (event.target.closest('button') || event.target.closest('a') || event.target.tagName === 'INPUT') {
      return
    }

    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (event.shiftKey && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, index)
        const end = Math.max(lastSelectedIndex, index)
        for (let i = start; i <= end; i++) {
          const item = filteredServices[i]
          if (item) next.add(item.id)
        }
      } else if (event.ctrlKey || event.metaKey) {
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setLastSelectedIndex(index)
      } else {
        // Clic simple: alterna selección
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setLastSelectedIndex(index)
      }
      return next
    })
  }

  // Alternar checkbox individual
  const handleCheckboxToggle = (id, index, event) => {
    event.stopPropagation()
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (event.shiftKey && lastSelectedIndex !== null) {
        const start = Math.min(lastSelectedIndex, index)
        const end = Math.max(lastSelectedIndex, index)
        for (let i = start; i <= end; i++) {
          const item = filteredServices[i]
          if (item) next.add(item.id)
        }
      } else {
        if (next.has(id)) next.delete(id)
        else next.add(id)
        setLastSelectedIndex(index)
      }
      return next
    })
  }

  // Alternar selección de todas las filas visibles
  const handleSelectAll = () => {
    if (selectedIds.size === filteredServices.length && filteredServices.length > 0) {
      setSelectedIds(new Set())
      setLastSelectedIndex(null)
    } else {
      setSelectedIds(new Set(filteredServices.map((s) => s.id)))
    }
  }

  // Limpiar selección
  const handleClearSelection = () => {
    setSelectedIds(new Set())
    setLastSelectedIndex(null)
  }

  // Métricas reactivas para la barra inferior inteligente tipo Sheets / Excel
  const stats = useMemo(() => {
    const isCustomSelection = selectedIds.size > 0
    const targetItems = isCustomSelection
      ? filteredServices.filter((s) => selectedIds.has(s.id))
      : filteredServices

    const count = targetItems.length
    let sumArs = 0
    let sumUsd = 0
    let sumDollarRate = 0
    let validRatesCount = 0

    targetItems.forEach((s) => {
      sumArs += Number(s.amount_ars) || 0
      sumUsd += Number(s.amount_usd) || 0
      if (Number(s.usd_rate) > 0) {
        sumDollarRate += Number(s.usd_rate)
        validRatesCount++
      }
    })

    const avgArs = count > 0 ? sumArs / count : 0
    const avgUsd = count > 0 ? sumUsd / count : 0
    const avgRate = validRatesCount > 0 ? sumDollarRate / validRatesCount : 0

    return {
      isCustomSelection,
      count,
      totalVisible: filteredServices.length,
      sumArs,
      sumUsd,
      avgArs,
      avgUsd,
      avgRate
    }
  }, [selectedIds, filteredServices])

  return (
    <div className="space-y-6 w-full pb-20">
      {/* ALERTA DE FEEDBACK / TOAST */}
      {feedbackMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-lg backdrop-blur-md animate-in fade-in slide-in-from-top-4 transition-all ${
            feedbackMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/60 text-emerald-200'
              : 'bg-rose-950/90 border-rose-500/60 text-rose-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedbackMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            )}
            <span className="text-sm font-medium">{feedbackMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMessage(null)}
            className="p-1 hover:bg-white/10 rounded-lg text-slate-400 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* CABECERA & SELECTOR DE TERMINAL */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Alon Car ERP</span>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-primary font-medium">Módulo M3: Terceros y Talleres Externos (GS-005)</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Wrench className="w-8 h-8 text-primary" />
            <span>Costos de Contratistas & Servicios de Terceros</span>
          </h1>
        </div>

        {/* SELECTOR DE TERMINALES DE TRABAJO */}
        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1 text-xs shadow-inner">
            <span className="text-[10px] uppercase font-bold text-slate-400 px-2 flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Terminal Activa:
            </span>
            <button
              type="button"
              onClick={() => setActiveRolePerspective('admin')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeRolePerspective === 'admin'
                  ? 'bg-primary text-slate-950 shadow-md ring-1 ring-primary/50'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Terminal Jorge Sentis: Control total, edición de montos autorizada, auditoría y configuración general"
            >
              <span>👑 Terminal Admin</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRolePerspective('maria_jose')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeRolePerspective === 'maria_jose'
                  ? 'bg-amber-400 text-slate-950 shadow-md ring-1 ring-amber-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Terminal María José: Carga y valorización de comprobantes, control de facturación, reclamos de RPF, edición de montos y evolución a factura"
            >
              <span>📋 Terminal María José</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRolePerspective('jefe_obra')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeRolePerspective === 'jefe_obra'
                  ? 'bg-emerald-400 text-slate-950 shadow-md ring-1 ring-emerald-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Terminal Jefe de Obra: Auditoría técnica y conformidad de trabajos ejecutados en obra, notas técnicas"
            >
              <span>🛠️ Terminal Jefe de Obra</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRolePerspective('direccion')}
              className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                activeRolePerspective === 'direccion'
                  ? 'bg-purple-400 text-slate-950 shadow-md ring-1 ring-purple-400/50'
                  : 'text-slate-400 hover:text-white'
              }`}
              title="Terminal Dirección: Solo lectura gerencial en USD por buque y órdenes de trabajo"
            >
              <span>👁️ Terminal Dirección</span>
            </button>
          </div>

          {/* Botón Nuevo Comprobante */}
          {activeRolePerspective !== 'direccion' && (
            <button
              type="button"
              onClick={handleOpenNewModal}
              className="px-4 py-2 bg-gradient-to-r from-primary to-blue-500 hover:brightness-110 text-slate-950 font-extrabold rounded-xl text-xs flex items-center gap-2 cursor-pointer shadow-[0_0_15px_rgba(0,242,254,0.25)] transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>+ Cargar Comprobante / Gasto</span>
            </button>
          )}
        </div>
      </div>

      {/* BANNER DINÁMICO DE INSTRUCCIONES POR PUESTO DE TRABAJO */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 md:p-5 text-xs text-slate-300 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-primary font-bold tracking-wide uppercase text-[11px]">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>
              {activeRolePerspective === 'admin' && 'Terminal Administrador General — Control Maestro & Finanzas'}
              {activeRolePerspective === 'maria_jose' && 'Terminal Administración Comercial (María José) — Ciclo de Comprobantes & Valorización'}
              {activeRolePerspective === 'jefe_obra' && 'Terminal Jefes de Obra (Omar / Pablo / Ale) — Conformidad Técnica & Control de Obra'}
              {activeRolePerspective === 'direccion' && 'Terminal Dirección Estratégica (Hugo) — Supervisión de Costos & Alertas'}
            </span>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
            {canEditAmounts ? '🔓 Edición de montos AR$/US$ Habilitada' : '🔒 Edición de montos AR$/US$ Bloqueada'}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-slate-400 pt-1">
          <div className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <span className="font-bold text-slate-200 shrink-0">📌 Qué debes completar:</span>
            <span>
              {activeRolePerspective === 'admin' && 'Aprobar evoluciones excepcionales (SDT), auditar montos sensibles y configurar cotizaciones oficiales de dólar por quincena.'}
              {activeRolePerspective === 'maria_jose' && 'Cargar facturas (FCR), presupuestos (PRC) y remitos (RMO/RPF). Reclamar facturas a proveedores con alerta RPF y evolucionarlos a FCR.'}
              {activeRolePerspective === 'jefe_obra' && 'Revisar trabajos ejecutados por contratistas, dar conformidad técnica (Conforme / Observado) y anotar observaciones técnicas.'}
              {activeRolePerspective === 'direccion' && 'Supervisión ejecutiva. Módulo en modo consulta.'}
            </span>
          </div>
          <div className="flex items-start gap-2 bg-slate-950/60 p-2.5 rounded-xl border border-slate-800/80">
            <span className="font-bold text-slate-200 shrink-0">🔍 Qué puedes consultar / consumir:</span>
            <span>
              {activeRolePerspective === 'admin' && 'Total acumulado en USD, auditoría completa de bajas y modificaciones, historial de pases y cruce de remitos con Pañol.'}
              {activeRolePerspective === 'maria_jose' && 'Contratistas autorizados en Padrón (con permiso 3ros), cotización quincenal congelada, y estado de reclamos por facturar.'}
              {activeRolePerspective === 'jefe_obra' && 'Costos y servicios asignados a cada buque y OT, piezas enviadas a taller externo con Remito Aloncar, y observaciones directas.'}
              {activeRolePerspective === 'direccion' && 'Total de costos de terceros imputados a cada buque en USD, OTs sin costo y comparador de contratistas.'}
            </span>
          </div>
        </div>
      </div>

      {/* ZONA 2: RADAR OPERATIVO & ALERTAS EN VIVO (ESTANDARIZADO) */}
      <div className="bg-slate-950/70 border border-slate-800/80 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-wider text-cyan-400">📊 RADAR OPERATIVO & ALERTAS EN VIVO</span>
            <span className="text-[10px] text-slate-500 font-mono">Monitoreo de inconsistencias contables y fiscales</span>
          </div>
          {kpiFilter !== 'todos' && (
            <button
              type="button"
              onClick={() => setKpiFilter('todos')}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5 text-slate-400" />
              <span>Ver todas las líneas</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Alerta 1: Falta Cargar OT (Ámbar) */}
          <button
            type="button"
            onClick={() => setKpiFilter(kpiFilter === 'sin_ot' ? 'todos' : 'sin_ot')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              kpiFilter === 'sin_ot'
                ? 'bg-amber-950/80 border-amber-400 shadow-lg shadow-amber-500/20 ring-2 ring-amber-400'
                : 'bg-slate-900/80 border-slate-800 hover:border-amber-500/40 hover:bg-slate-850'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                Falta Cargar OT
              </span>
              {kpiCounts.sinOt > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-bold border border-amber-400/30">
                  Sin C.C.
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-amber-300 font-mono">{kpiCounts.sinOt}</span>
              <span className="text-xs text-slate-400">trabajos sin OT vinculada</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {kpiFilter === 'sin_ot' ? '✓ Filtro activo (Clic para ver todos)' : 'Clic para filtrar solo líneas sin OT'}
            </p>
          </button>

          {/* Alerta 2: Sin Costo $0 (Rojo / Rose) */}
          <button
            type="button"
            onClick={() => setKpiFilter(kpiFilter === 'sin_precio' ? 'todos' : 'sin_precio')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              kpiFilter === 'sin_precio'
                ? 'bg-rose-950/80 border-rose-400 shadow-lg shadow-rose-500/20 ring-2 ring-rose-400'
                : 'bg-slate-900/80 border-slate-800 hover:border-rose-500/40 hover:bg-slate-850'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-400" />
                Líneas Sin Costo
              </span>
              {kpiCounts.sinPrecio > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-rose-400/20 text-rose-300 font-bold border border-rose-400/30">
                  Pendiente $
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-rose-300 font-mono">{kpiCounts.sinPrecio}</span>
              <span className="text-xs text-slate-400">comprobantes a valorizar ($0)</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {kpiFilter === 'sin_precio' ? '✓ Filtro activo (Clic para ver todos)' : 'Clic para filtrar comprobantes $0'}
            </p>
          </button>

          {/* Alerta 3: RPF Pendiente de Factura (Púrpura) */}
          <button
            type="button"
            onClick={() => setKpiFilter(kpiFilter === 'RPF' ? 'todos' : 'RPF')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              kpiFilter === 'RPF'
                ? 'bg-purple-950/80 border-purple-400 shadow-lg shadow-purple-500/20 ring-2 ring-purple-400'
                : 'bg-slate-900/80 border-slate-800 hover:border-purple-500/40 hover:bg-slate-850'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-purple-400" />
                RPF Pdte. Factura
              </span>
              {kpiCounts.rpf > 0 && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-400/20 text-purple-300 font-bold border border-purple-400/30">
                  Reclamar
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-purple-300 font-mono">{kpiCounts.rpf}</span>
              <span className="text-xs text-slate-400">remitos sin factura oficial</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {kpiFilter === 'RPF' ? '✓ Filtro activo (Clic para ver todos)' : 'Clic para exigir factura oficial'}
            </p>
          </button>

          {/* Alerta 4: FCR Facturado Definitivo (Esmeralda / Verde) */}
          <button
            type="button"
            onClick={() => setKpiFilter(kpiFilter === 'FCR' ? 'todos' : 'FCR')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
              kpiFilter === 'FCR'
                ? 'bg-emerald-950/80 border-emerald-400 shadow-lg shadow-emerald-500/20 ring-2 ring-emerald-400'
                : 'bg-slate-900/80 border-slate-800 hover:border-emerald-500/40 hover:bg-slate-850'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                FCR Facturado
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-400/20 text-emerald-300 font-bold border border-emerald-400/30">
                Definitivo
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-2xl font-black text-emerald-300 font-mono">{kpiCounts.fcr}</span>
              <span className="text-xs text-slate-400">facturas fiscales oficiales</span>
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              {kpiFilter === 'FCR' ? '✓ Filtro activo (Clic para ver todos)' : 'Clic para filtrar solo facturados'}
            </p>
          </button>
        </div>
      </div>

      {/* BARRA DE FILTROS & BÚSQUEDA */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Buscador */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-500" />
            <input
              ref={searchInputRef}
              type="text"
              placeholder="Buscar por contratista, N° factura, barco, OT, rubro, remito o detalle... (Ctrl+F)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary transition-all"
            />
            <span className="absolute right-8 top-2.5 px-1.5 py-0.5 rounded bg-slate-800 text-[9px] font-mono text-slate-400 border border-slate-700 pointer-events-none hidden sm:inline">Ctrl + F</span>
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="hidden xl:flex items-center gap-1.5 text-[10px] font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800">
            <span className="text-cyan-400 font-bold">⌨️ Atajos:</span>
            <span>Doble Clic (Editar) | Ctrl+C/V/D | Ctrl+Z/Y</span>
          </div>

          {/* Toggle de Vistas Universales (Filas / Fichas) */}
          <div className="bg-slate-950 border border-slate-800 p-1 rounded-xl flex items-center shrink-0 self-end md:self-auto">
            <button
              type="button"
              onClick={() => setViewMode('filas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'filas'
                  ? 'bg-primary text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>☷ Vista Filas</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('fichas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                viewMode === 'fichas'
                  ? 'bg-primary text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <span>⊞ Vista Fichas</span>
            </button>
          </div>
        </div>

        {/* Filtros Dropdown */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-1 text-xs">
          {/* Buque */}
          <select
            value={selectedShipFilter}
            onChange={(e) => setSelectedShipFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-primary"
          >
            <option value="todos">Buque: Todos ({ships.length})</option>
            {ships.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>

          {/* Contratista */}
          <select
            value={selectedContractorFilter}
            onChange={(e) => setSelectedContractorFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-primary truncate"
          >
            <option value="todos">Contratista: Todos ({contractors.length})</option>
            {contractors.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Rubro */}
          <select
            value={selectedTradeFilter}
            onChange={(e) => setSelectedTradeFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-primary"
          >
            <option value="todos">Rubro: Todos</option>
            {OFFICIAL_TRADES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          {/* Comprobante */}
          <select
            value={selectedVoucherFilter}
            onChange={(e) => setSelectedVoucherFilter(e.target.value)}
            className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-primary"
          >
            <option value="todos">Comprobante: Todos</option>
            {VOUCHER_TYPES.map((v) => (
              <option key={v.code} value={v.code}>
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL: VISTA FILAS / VISTA FICHAS */}
      {loading ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800">
          <Clock className="w-8 h-8 animate-spin mx-auto text-primary mb-3" />
          <p className="text-sm font-medium">Sincronizando registros de Terceros con Supabase...</p>
        </div>
      ) : filteredServices.length === 0 ? (
        <div className="p-12 text-center text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800 space-y-3">
          <Wrench className="w-10 h-10 mx-auto text-slate-600 mb-2" />
          <p className="text-base font-semibold text-slate-300">No se encontraron comprobantes con los filtros seleccionados.</p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Prueba cambiando los filtros superiores o carga un nuevo comprobante de contratista mediante el botón "+ Cargar Comprobante".
          </p>
          {activeRolePerspective !== 'direccion' && (
            <button
              type="button"
              onClick={handleOpenNewModal}
              className="px-4 py-2 bg-primary/20 text-primary border border-primary/40 rounded-xl text-xs font-bold hover:bg-primary hover:text-slate-950 transition-all cursor-pointer"
            >
              + Cargar Primer Gasto
            </button>
          )}
        </div>
      ) : viewMode === 'filas' ? (
        /* VISTA FILAS (TABLA DENSA CON CABECERA CONGELADA Y STATUS BAR TIPO EXCEL) */
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl flex flex-col overflow-hidden">
          {/* Contenedor scrolleable vertical con encabezado congelado tipo Excel */}
          <div className="overflow-y-auto max-h-[calc(100vh-270px)] overflow-x-hidden">
            <table className="w-full text-left text-xs border-collapse table-fixed">
              <thead className="sticky top-0 z-20 bg-slate-950 text-[10px] uppercase font-bold text-slate-400 tracking-wider border-b border-slate-800 shadow-sm backdrop-blur-md">
                <tr>
                  {/* Selector / Checkbox Maestro */}
                  <th className="py-3 px-2 w-9 text-center bg-slate-950">
                    <input
                      type="checkbox"
                      checked={filteredServices.length > 0 && selectedIds.size === filteredServices.length}
                      ref={(input) => {
                        if (input) {
                          input.indeterminate = selectedIds.size > 0 && selectedIds.size < filteredServices.length
                        }
                      }}
                      onChange={handleSelectAll}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/30 cursor-pointer"
                      title="Seleccionar o deseleccionar todas las filas visibles"
                    />
                  </th>
                  {/* 1. Fecha */}
                  <th className="py-3 px-2 w-[8%] bg-slate-950">Fecha</th>
                  {/* 2. Barco / OT */}
                  <th className="py-3 px-2 w-[14%] bg-slate-950">Barco / OT</th>
                  {/* 3. Contratista / Rubro */}
                  <th className="py-3 px-2 w-[15%] bg-slate-950">Contratista / Rubro</th>
                  {/* 4. Importe AR$ */}
                  <th className="py-3 px-2 w-[11%] text-right bg-slate-950">Importe AR$</th>
                  {/* 5. Dólar / US$ */}
                  <th className="py-3 px-2 w-[10%] text-right bg-slate-950">Dólar / US$</th>
                  {/* 6. Comprobante */}
                  <th className="py-3 px-2 w-[7%] text-center bg-slate-950">Comprobante</th>
                  {/* 7. Nº Comprobante */}
                  <th className="py-3 px-2 w-[12%] bg-slate-950">Nº Comprobante</th>
                  {/* 8. Comentarios */}
                  <th className="py-3 px-2 w-[13%] bg-slate-950">Comentarios</th>
                  {/* 9. Acciones */}
                  <th className="py-3 px-2 w-[10%] text-right bg-slate-950">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-mono">
                {filteredServices.map((srv, index) => {
                  const isSelected = selectedIds.has(srv.id)
                  const shipName = shipMap.get(srv.ship_id)?.name || 'Sin Buque'
                  const ot = otMap.get(srv.work_order_id)
                  const voucherConfig = VOUCHER_TYPES.find((v) => v.code === srv.voucher_type) || VOUCHER_TYPES[0]
                  const isEvolvable = srv.voucher_type === 'RMO' || srv.voucher_type === 'RPF'
                  const contractorObj = contractorMap.get(srv.contractor_name?.toUpperCase()?.trim())
                  const effectiveTrade = srv.trade || (contractorObj?.trade && contractorObj.trade !== 'MANUAL' ? contractorObj.trade : null)

                  // Detección de múltiples comprobantes vinculados
                  const fcrNumber = srv.invoice_number || (['FCR', 'FCA', 'FAC', 'REC', 'FCB', 'FCC'].includes(srv.voucher_type) ? srv.voucher_number : null)
                  const prcNumber = srv.budget_number || (srv.voucher_type === 'PRC' ? srv.voucher_number : null)
                  const remitoAloncar = srv.internal_remito_number || null
                  const supplierRemito = srv.supplier_remito_number || (['RMO', 'RPF'].includes(srv.voucher_type) ? srv.voucher_number : null)
                  const hasAnyVoucherNumber = Boolean(fcrNumber || prcNumber || remitoAloncar || supplierRemito)

                  return (
                    <tr
                      key={srv.id}
                      className={`transition-colors select-none ${
                        isSelected
                          ? 'bg-cyan-950/40 text-cyan-50 border-l-2 border-l-cyan-400'
                          : 'hover:bg-slate-850/40 text-slate-200'
                      }`}
                    >
                      {/* Checkbox individual para selección de fila */}
                      <td className="py-2.5 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleCheckboxToggle(srv.id, index, e)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/30 cursor-pointer"
                        />
                      </td>

                      {/* 1. Fecha (Editable con doble clic) */}
                      {(() => {
                        const cp = getSpreadsheetCellProps(index, 'service_date')
                        return (
                          <td
                            {...cp.domProps}
                            onDoubleClick={() => setInlineEdit({ id: srv.id, field: 'service_date', value: srv.service_date || srv.entry_date || '' })}
                            className={`py-2.5 px-2 whitespace-nowrap ${cp.className}`}
                          >
                            {inlineEdit.id === srv.id && inlineEdit.field === 'service_date' ? (
                              <input
                                type="date"
                                autoFocus
                                value={inlineEdit.value}
                                onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveInlineEdit(srv.id, 'service_date', inlineEdit.value)
                                  if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                                }}
                                onBlur={() => saveInlineEdit(srv.id, 'service_date', inlineEdit.value)}
                                className="w-full bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white outline-none font-mono"
                              />
                            ) : (
                              <div>
                                <div className="font-semibold text-slate-200">
                                  {formatDate(srv.service_date || srv.entry_date)}
                                </div>
                                {srv.entry_date && srv.entry_date !== srv.service_date && (
                                  <div className="text-[10px] text-slate-500 font-sans">
                                    Carga: {formatDate(srv.entry_date)}
                                  </div>
                                )}
                              </div>
                            )}
                            {cp.renderHandle && (
                              <div
                                onMouseDown={grid.handleFillHandleMouseDown}
                                onDoubleClick={grid.handleFillHandleDoubleClick}
                                className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                                title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                              />
                            )}
                          </td>
                        )
                      })()}

                      {/* 2. Barco / OT (Doble Clic abre ShipWorkOrderPickerModal) */}
                      {(() => {
                        const cp = getSpreadsheetCellProps(index, 'ship_wo')
                        return (
                          <td
                            {...cp.domProps}
                            onDoubleClick={() => {
                              setPickerModal({
                                isOpen: true,
                                serviceId: srv.id,
                                shipId: srv.ship_id,
                                workOrderId: srv.work_order_id,
                                contractorName: srv.contractor_name
                              })
                            }}
                            className={`py-2.5 px-2 font-sans truncate cursor-pointer ${cp.className}`}
                            title="Doble clic para cambiar Buque u Orden de Trabajo"
                          >
                            <div className="font-bold text-white flex items-center gap-1.5 truncate" title={shipName}>
                              <Ship className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                              <span className="truncate">{shipName}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                              {ot ? (
                                <span className="font-mono text-cyan-300 font-semibold bg-cyan-950/60 px-1 rounded border border-cyan-800/50 shrink-0">
                                  {ot.ot_number}
                                </span>
                              ) : (
                                <span className="text-amber-400 text-[10px] shrink-0 font-bold">⚠️ Sin OT</span>
                              )}
                              <span className="truncate text-[10px] text-slate-500" title={ot?.title}>
                                {ot?.title || '(Doble clic para asignar)'}
                              </span>
                            </div>
                            {cp.renderHandle && (
                              <div
                                onMouseDown={grid.handleFillHandleMouseDown}
                                onDoubleClick={grid.handleFillHandleDoubleClick}
                                className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                                title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                              />
                            )}
                          </td>
                        )
                      })()}

                      {/* 3. Contratista y Rubro */}
                      {(() => {
                        const cp = getSpreadsheetCellProps(index, 'contractor_name')
                        return (
                          <td
                            {...cp.domProps}
                            onDoubleClick={() => setInlineEdit({ id: srv.id, field: 'contractor_name', value: srv.contractor_name || '' })}
                            className={`py-2.5 px-2 font-sans truncate ${cp.className}`}
                          >
                            {inlineEdit.id === srv.id && inlineEdit.field === 'contractor_name' ? (
                              <input
                                type="text"
                                autoFocus
                                value={inlineEdit.value}
                                onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveInlineEdit(srv.id, 'contractor_name', inlineEdit.value)
                                  if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                                }}
                                onBlur={() => saveInlineEdit(srv.id, 'contractor_name', inlineEdit.value)}
                                className="w-full bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white outline-none font-bold uppercase"
                              />
                            ) : (
                              <div>
                                <div className="font-bold text-slate-100 uppercase tracking-wide truncate" title={srv.contractor_name}>
                                  {srv.contractor_name}
                                </div>
                                <div className="mt-0.5 truncate">
                                  {effectiveTrade ? (
                                    <span className="inline-block text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium font-mono truncate max-w-full">
                                      {effectiveTrade}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-rose-400 font-semibold">⚠️ Sin Rubro</span>
                                  )}
                                </div>
                              </div>
                            )}
                            {cp.renderHandle && (
                              <div
                                onMouseDown={grid.handleFillHandleMouseDown}
                                onDoubleClick={grid.handleFillHandleDoubleClick}
                                className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                                title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                              />
                            )}
                          </td>
                        )
                      })()}

                      {/* 4. Importe AR$ (Editable si tiene permiso canEditAmounts) */}
                      {(() => {
                        const cp = getSpreadsheetCellProps(index, 'amount_ars')
                        return (
                          <td
                            {...cp.domProps}
                            onDoubleClick={() => {
                              if (canEditAmounts) {
                                setInlineEdit({ id: srv.id, field: 'amount_ars', value: srv.amount_ars || '' })
                              } else {
                                showFeedback('error', 'No tienes permisos para modificar importes monetarios.')
                              }
                            }}
                            className={`py-2.5 px-2 text-right whitespace-nowrap font-mono font-semibold text-slate-100 ${cp.className}`}
                          >
                            {inlineEdit.id === srv.id && inlineEdit.field === 'amount_ars' ? (
                              <input
                                type="number"
                                autoFocus
                                step="any"
                                value={inlineEdit.value}
                                onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveInlineEdit(srv.id, 'amount_ars', inlineEdit.value)
                                  if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                                }}
                                onBlur={() => saveInlineEdit(srv.id, 'amount_ars', inlineEdit.value)}
                                className="w-full bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-right text-white outline-none font-mono"
                              />
                            ) : (
                              Number(srv.amount_ars) > 0 ? (
                                <span>${Number(srv.amount_ars).toLocaleString('es-AR')}</span>
                              ) : (
                                <span className="text-amber-400 text-xs font-bold">$0 (Sin Precio)</span>
                              )
                            )}
                            {cp.renderHandle && (
                              <div
                                onMouseDown={grid.handleFillHandleMouseDown}
                                onDoubleClick={grid.handleFillHandleDoubleClick}
                                className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                                title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                              />
                            )}
                          </td>
                        )
                      })()}

                      {/* 5. Dólar / US$ (Calculado) */}
                      <td className="py-2.5 px-2 text-right whitespace-nowrap">
                        <div className="font-mono font-extrabold text-cyan-300">
                          ${Number(srv.amount_usd || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono">
                          Cotiz: ${Number(srv.usd_rate || 0).toLocaleString('es-AR')}
                        </div>
                      </td>

                      {/* 6. Comprobante (Tipo - Editable con doble clic y compatible con Ctrl+D) */}
                      {(() => {
                        const cp = getSpreadsheetCellProps(index, 'voucher_type')
                        return (
                          <td
                            {...cp.domProps}
                            onDoubleClick={() => setInlineEdit({ id: srv.id, field: 'voucher_type', value: srv.voucher_type || 'PRC' })}
                            className={`py-2.5 px-2 whitespace-nowrap text-center ${cp.className}`}
                          >
                            {inlineEdit.id === srv.id && inlineEdit.field === 'voucher_type' ? (
                              <select
                                autoFocus
                                value={inlineEdit.value}
                                onChange={(e) => saveInlineEdit(srv.id, 'voucher_type', e.target.value)}
                                onBlur={() => setInlineEdit({ id: null, field: null, value: '' })}
                                className="bg-slate-950 border border-cyan-400 rounded px-1 py-0.5 text-xs text-white outline-none font-bold"
                              >
                                {VOUCHER_TYPES.map((v) => (
                                  <option key={v.code} value={v.code}>{v.code}</option>
                                ))}
                              </select>
                            ) : (
                              <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${voucherConfig.color}`}>
                                {srv.voucher_type}
                              </span>
                            )}
                            {cp.renderHandle && (
                              <div
                                onMouseDown={grid.handleFillHandleMouseDown}
                                onDoubleClick={grid.handleFillHandleDoubleClick}
                                className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                                title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                              />
                            )}
                          </td>
                        )
                      })()}

                      {/* 7. Nº Comprobante (Editable con doble clic) */}
                      {(() => {
                        const cp = getSpreadsheetCellProps(index, 'voucher_number')
                        return (
                          <td
                            {...cp.domProps}
                            onDoubleClick={() => setInlineEdit({ id: srv.id, field: 'voucher_number', value: srv.voucher_number || '' })}
                            className={`py-2.5 px-2 font-mono ${cp.className}`}
                          >
                            {inlineEdit.id === srv.id && inlineEdit.field === 'voucher_number' ? (
                              <input
                                type="text"
                                autoFocus
                                value={inlineEdit.value}
                                onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveInlineEdit(srv.id, 'voucher_number', inlineEdit.value)
                                  if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                                }}
                                onBlur={() => saveInlineEdit(srv.id, 'voucher_number', inlineEdit.value)}
                                className="w-full bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white outline-none font-mono"
                              />
                            ) : (
                              <div className="space-y-0.5">
                                {fcrNumber && (
                                  <div className="flex items-center gap-1 text-[11px] font-bold text-emerald-300 truncate" title={`Factura: ${fcrNumber}`}>
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 shrink-0 font-sans">
                                      FCR
                                    </span>
                                    <span className="truncate">{fcrNumber}</span>
                                  </div>
                                )}
                                {prcNumber && (
                                  <div className="flex items-center gap-1 text-[11px] font-bold text-amber-300 truncate" title={`Presupuesto: ${prcNumber}`}>
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950 text-amber-400 border border-amber-800 shrink-0 font-sans">
                                      PRC
                                    </span>
                                    <span className="truncate">{prcNumber}</span>
                                  </div>
                                )}
                                {remitoAloncar && (
                                  <div className="flex items-center gap-1 text-[10px] text-cyan-300 truncate" title={`Remito: #${remitoAloncar}`}>
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-cyan-950 text-cyan-400 border border-cyan-800 shrink-0 font-sans">
                                      RMT
                                    </span>
                                    <span className="truncate">#{remitoAloncar}</span>
                                  </div>
                                )}
                                {supplierRemito && (
                                  <div className="flex items-center gap-1 text-[10px] text-purple-300 truncate" title={`Remito Taller: ${supplierRemito}`}>
                                    <span className="text-[9px] px-1 py-0.2 rounded bg-purple-950 text-purple-400 border border-purple-800 shrink-0 font-sans">
                                      RMO
                                    </span>
                                    <span className="truncate">{supplierRemito}</span>
                                  </div>
                                )}
                                {!hasAnyVoucherNumber && (
                                  <span className="text-slate-600 text-[11px] italic font-sans">S/N</span>
                                )}
                              </div>
                            )}
                            {cp.renderHandle && (
                              <div
                                onMouseDown={grid.handleFillHandleMouseDown}
                                onDoubleClick={grid.handleFillHandleDoubleClick}
                                className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                                title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                              />
                            )}
                          </td>
                        )
                      })()}

                      {/* 8. Comentarios (Editable con doble clic) */}
                      {(() => {
                        const cp = getSpreadsheetCellProps(index, 'direct_observations')
                        return (
                          <td
                            {...cp.domProps}
                            onDoubleClick={() => setInlineEdit({ id: srv.id, field: 'direct_observations', value: srv.direct_observations || '' })}
                            className={`py-2.5 px-2 font-sans overflow-hidden ${cp.className}`}
                          >
                            {inlineEdit.id === srv.id && inlineEdit.field === 'direct_observations' ? (
                              <input
                                type="text"
                                autoFocus
                                value={inlineEdit.value}
                                onChange={(e) => setInlineEdit({ ...inlineEdit, value: e.target.value })}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveInlineEdit(srv.id, 'direct_observations', inlineEdit.value)
                                  if (e.key === 'Escape') setInlineEdit({ id: null, field: null, value: '' })
                                }}
                                onBlur={() => saveInlineEdit(srv.id, 'direct_observations', inlineEdit.value)}
                                className="w-full bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white outline-none font-sans"
                              />
                            ) : (
                              <div className="space-y-0.5 truncate max-w-full">
                                {srv.direct_observations ? (
                                  <p className="text-[11px] text-slate-300 line-clamp-2" title={srv.direct_observations}>
                                    {srv.direct_observations}
                                  </p>
                                ) : (
                                  <span className="text-slate-600 text-[11px] italic">Sin observaciones</span>
                                )}
                                {srv.specific_observations && (
                                  <p className="text-[10px] text-slate-400 line-clamp-1 italic truncate" title={srv.specific_observations}>
                                    Nota: {srv.specific_observations}
                                  </p>
                                )}
                              </div>
                            )}
                            {cp.renderHandle && (
                              <div
                                onMouseDown={grid.handleFillHandleMouseDown}
                                onDoubleClick={grid.handleFillHandleDoubleClick}
                                className="fill-handle absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-cyan-400 border border-slate-900 rounded-[1px] cursor-crosshair z-30 shadow-md hover:scale-125 transition-transform"
                                title="Arrastra hacia abajo (o doble clic) para rellenar (Ctrl+D)"
                              />
                            )}
                          </td>
                        )
                      })()}

                      {/* 9. Acciones */}
                      <td className="py-2.5 px-2 text-right font-sans">
                        <div className="flex items-center justify-end gap-1 shrink-0">
                          {/* Botón Evolucionar (RMO / RPF -> FCR): Solo ícono de estrella con tooltip */}
                          {isEvolvable && activeRolePerspective !== 'direccion' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenEvolutionModal(srv)
                              }}
                              className="p-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-400 hover:text-slate-950 rounded-lg transition-all cursor-pointer shrink-0 shadow-sm"
                              title="Evolucionar a Factura oficial (FCR) o SDT"
                            >
                              <Sparkles className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Historial */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setHistoryService(srv)
                            }}
                            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
                            title="Ver trazabilidad e historial"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>

                          {/* Editar */}
                          {activeRolePerspective !== 'direccion' && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleOpenEditModal(srv)
                              }}
                              className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                              title="Editar comprobante"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          )}

                          {/* Eliminar (solo Admin / María José) */}
                          {canEditAmounts && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDeleteService(srv)
                              }}
                              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                              title="Eliminar comprobante con auditoría"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* BARRA DE TOTALES Y ESTADÍSTICAS REACTIVA (TIPO EXCEL / GOOGLE SHEETS) */}
          <div className="bg-slate-950 border-t border-slate-800 px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-inner shrink-0 z-20">
            {/* Botones Deshacer / Rehacer estilo Hoja de Cálculo */}
            <div className="flex items-center gap-1.5">
              {grid?.canUndo && (
                <button
                  type="button"
                  onClick={grid.undo}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-400 text-amber-300 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer animate-in fade-in"
                  title="Deshacer el último cambio (Ctrl + Z)"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Deshacer (Ctrl+Z)</span>
                </button>
              )}
              {grid?.canRedo && (
                <button
                  type="button"
                  onClick={grid.redo}
                  className="px-2.5 py-1 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-400 text-cyan-300 font-bold text-xs flex items-center gap-1 transition-all cursor-pointer animate-in fade-in"
                  title="Rehacer el cambio deshecho (Ctrl + Y)"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Rehacer (Ctrl+Y)</span>
                </button>
              )}
            </div>

            {/* Indicador de modo (Selección manual vs Todo lo filtrado) */}
            <div className="flex items-center gap-3">
              {stats.isCustomSelection ? (
                <div className="flex items-center gap-2 bg-cyan-950/80 border border-cyan-500/60 px-2.5 py-1 rounded-lg text-cyan-300 font-bold">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                  <span>📌 Selección Manual: {stats.count} de {stats.totalVisible} filas</span>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="ml-1 text-cyan-400 hover:text-white transition-colors cursor-pointer text-xs underline"
                    title="Deseleccionar todas las filas"
                  >
                    ✕ Limpiar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 px-2.5 py-1 rounded-lg text-slate-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>🌐 Todo el filtro: {stats.count} filas</span>
                  <span className="text-[10px] text-slate-500 italic hidden sm:inline">(Clic o Ctrl+Clic en filas para seleccionar y sumar a tu antojo)</span>
                </div>
              )}
            </div>

            {/* Métricas calculadas en vivo */}
            <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono">
              {/* Suma AR$ */}
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Σ AR$:</span>
                <span className="text-sm font-extrabold text-white">
                  ${stats.sumArs.toLocaleString('es-AR')}
                </span>
              </div>

              {/* Suma US$ */}
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] uppercase font-bold text-cyan-400">Σ US$:</span>
                <span className="text-sm font-extrabold text-cyan-300">
                  ${stats.sumUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Promedio AR$ */}
              <div className="flex items-baseline gap-1.5 hidden md:flex">
                <span className="text-[10px] uppercase font-bold text-slate-400">Ø AR$:</span>
                <span className="text-xs font-semibold text-slate-300">
                  ${stats.avgArs.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </span>
              </div>

              {/* Promedio US$ */}
              <div className="flex items-baseline gap-1.5 hidden md:flex">
                <span className="text-[10px] uppercase font-bold text-cyan-400">Ø US$:</span>
                <span className="text-xs font-semibold text-cyan-200">
                  ${stats.avgUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>

              {/* Cotización Promedio */}
              <div className="flex items-baseline gap-1.5 hidden lg:flex">
                <span className="text-[10px] uppercase font-bold text-slate-500">Cotiz. Ø:</span>
                <span className="text-xs font-semibold text-slate-400">
                  ${stats.avgRate.toLocaleString('es-AR', { maximumFractionDigits: 1 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* VISTA FICHAS (TARJETAS MODERNAS CON SOPORTE DE SELECCIÓN Y STATUS BAR) */
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredServices.map((srv, index) => {
              const shipName = shipMap.get(srv.ship_id)?.name || 'Sin Buque'
              const ot = otMap.get(srv.work_order_id)
              const voucherConfig = VOUCHER_TYPES.find((v) => v.code === srv.voucher_type) || VOUCHER_TYPES[0]
              const isEvolvable = srv.voucher_type === 'RMO' || srv.voucher_type === 'RPF'
              const contractorObj = contractorMap.get(srv.contractor_name?.toUpperCase()?.trim())
              const effectiveTrade = srv.trade || (contractorObj?.trade && contractorObj.trade !== 'MANUAL' ? contractorObj.trade : null)
              const isSelected = selectedIds.has(srv.id)

              return (
                <div
                  key={srv.id}
                  onClick={(e) => handleRowClick(srv.id, index, e)}
                  className={`border rounded-2xl p-5 space-y-4 flex flex-col justify-between shadow-lg transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'border-cyan-400 bg-cyan-950/40 ring-1 ring-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.2)]'
                      : srv.voucher_type === 'RPF'
                      ? 'border-amber-500/40 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/20'
                      : 'border-slate-800 bg-slate-900/90 hover:border-slate-700'
                  }`}
                >
                  {/* Header de la tarjeta */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => handleCheckboxToggle(srv.id, index, e)}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500/30 cursor-pointer"
                        />
                        <span className={`px-2.5 py-0.5 rounded-lg text-xs font-bold border ${voucherConfig.color}`}>
                          {srv.voucher_type} - {voucherConfig.label.split(' - ')[1] || srv.voucher_type}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400 font-mono">
                        {formatDate(srv.service_date || srv.entry_date)}
                      </span>
                    </div>

                    <div>
                      <h3 className="font-extrabold text-base text-white tracking-wide uppercase truncate" title={srv.contractor_name}>
                        {srv.contractor_name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {effectiveTrade ? (
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-medium font-mono">
                            {effectiveTrade}
                          </span>
                        ) : (
                          <span className="text-[10px] text-rose-400 font-semibold">⚠️ Sin Rubro</span>
                        )}
                      </div>
                    </div>

                    {/* Números de Comprobantes Asociados */}
                    <div className="bg-slate-950/70 p-2 rounded-xl border border-slate-800/80 space-y-1 font-mono text-xs">
                      {/* Factura Fiscal FCR / FCA */}
                      {(srv.invoice_number || (['FCR', 'FCA', 'FAC', 'REC', 'FCB', 'FCC'].includes(srv.voucher_type) && srv.voucher_number)) && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-emerald-400 font-bold">FACTURA:</span>
                          <span className="text-emerald-300 font-bold">{srv.invoice_number || srv.voucher_number}</span>
                        </div>
                      )}

                      {/* Presupuesto Interno PRC */}
                      {(srv.budget_number || (srv.voucher_type === 'PRC' && srv.voucher_number)) && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-amber-400 font-bold">PRESUPUESTO:</span>
                          <span className="text-amber-300 font-bold">{srv.budget_number || srv.voucher_number}</span>
                        </div>
                      )}

                      {/* Remito Aloncar */}
                      {srv.internal_remito_number && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-cyan-400 font-bold">REMITO ALONCAR:</span>
                          <span className="text-cyan-300 font-bold">#{srv.internal_remito_number}</span>
                        </div>
                      )}

                      {/* Remito Proveedor */}
                      {(srv.supplier_remito_number || (['RMO', 'RPF'].includes(srv.voucher_type) && srv.voucher_number)) && (
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-purple-400 font-bold">REMITO PROV:</span>
                          <span className="text-purple-300 font-bold">{srv.supplier_remito_number || srv.voucher_number}</span>
                        </div>
                      )}

                      {!srv.invoice_number && !srv.budget_number && !srv.internal_remito_number && !srv.supplier_remito_number && !srv.voucher_number && (
                        <span className="text-slate-600 italic text-[11px] block text-center font-sans">Sin comprobante numerado</span>
                      )}
                    </div>
                  </div>

                  {/* Buque y OT */}
                  <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800/80 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-white">
                      <Ship className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>{shipName}</span>
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      {ot ? (
                        <>
                          <span className="font-mono text-cyan-300 font-bold bg-cyan-950/80 px-1 rounded border border-cyan-800/60">
                            {ot.ot_number}
                          </span>
                          <span className="truncate text-slate-300 text-[11px]">{ot.title}</span>
                        </>
                      ) : (
                        <span className="text-amber-400 text-xs">⚠️ Sin Orden de Trabajo asignada</span>
                      )}
                    </div>
                  </div>

                  {/* Observaciones Directas y Específicas */}
                  {(srv.direct_observations || srv.specific_observations) && (
                    <div className="space-y-1 text-xs text-slate-400">
                      {srv.direct_observations && (
                        <div className="line-clamp-2" title={srv.direct_observations}>
                          <span className="font-semibold text-slate-300">Tarea:</span> {srv.direct_observations}
                        </div>
                      )}
                      {srv.specific_observations && (
                        <div className="line-clamp-2 text-slate-500 italic" title={srv.specific_observations}>
                          <span className="font-semibold text-slate-400 font-sans not-italic">Obs:</span> {srv.specific_observations}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Importe y Cotización */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-bold block">Importe AR$</span>
                      <span className="font-mono font-bold text-slate-200 text-sm">
                        ${Number(srv.amount_ars).toLocaleString('es-AR')}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-cyan-400 uppercase font-bold block">Costo Total US$</span>
                      <span className="font-mono font-extrabold text-cyan-300 text-lg">
                        ${Number(srv.amount_usd || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  {/* Footer de Tarjeta con Acciones */}
                  <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between gap-2">
                    <span className="text-[10px] text-slate-500 font-mono">
                      Cotiz: ${Number(srv.usd_rate || 0).toLocaleString('es-AR')}
                    </span>

                    <div className="flex items-center gap-1">
                      {isEvolvable && activeRolePerspective !== 'direccion' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEvolutionModal(srv)
                          }}
                          className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500 hover:text-slate-950 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer"
                          title="Evolucionar a Factura oficial (FCR)"
                        >
                          <span>⚡ Factura</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setHistoryService(srv)
                        }}
                        className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                        title="Ver trazabilidad"
                      >
                        <History className="w-4 h-4" />
                      </button>

                      {activeRolePerspective !== 'direccion' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleOpenEditModal(srv)
                          }}
                          className="p-1.5 text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Editar"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                      )}

                      {canEditAmounts && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDeleteService(srv)
                          }}
                          className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* BARRA DE TOTALES Y ESTADÍSTICAS REACTIVA (MODO FICHAS) */}
          <div className="bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shadow-xl">
            <div className="flex items-center gap-3">
              {stats.isCustomSelection ? (
                <div className="flex items-center gap-2 bg-cyan-950/80 border border-cyan-500/60 px-2.5 py-1 rounded-lg text-cyan-300 font-bold">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                  <span>📌 Selección Manual: {stats.count} de {stats.totalVisible} fichas</span>
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="ml-1 text-cyan-400 hover:text-white transition-colors cursor-pointer text-xs underline"
                  >
                    ✕ Limpiar
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 bg-slate-900 border border-slate-700/80 px-2.5 py-1 rounded-lg text-slate-300 font-medium">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span>🌐 Todo el filtro: {stats.count} fichas</span>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4 sm:gap-6 font-mono">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400">Σ AR$:</span>
                <span className="text-sm font-extrabold text-white">
                  ${stats.sumArs.toLocaleString('es-AR')}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-[10px] uppercase font-bold text-cyan-400">Σ US$:</span>
                <span className="text-sm font-extrabold text-cyan-300">
                  ${stats.sumUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 hidden md:flex">
                <span className="text-[10px] uppercase font-bold text-slate-400">Ø AR$:</span>
                <span className="text-xs font-semibold text-slate-300">
                  ${stats.avgArs.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="flex items-baseline gap-1.5 hidden md:flex">
                <span className="text-[10px] uppercase font-bold text-cyan-400">Ø US$:</span>
                <span className="text-xs font-semibold text-cyan-200">
                  ${stats.avgUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MODAL 1: CARGA GUIADA EN CASCADA (Barco -> Contratista 3ros -> OT)   */}
      {/* ==================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 my-8">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center border border-cyan-500/30 font-bold">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingService ? 'Editar Comprobante de Terceros' : 'Carga Guiada de Gasto de Terceros (GS-005)'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cascada estricta: 1° Barco ➔ 2° Contratista [3ros] ➔ 3° Orden de Trabajo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveService} className="p-6 space-y-4 text-xs">
              {/* PASO 1: SELECCIONAR BARCO */}
              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Ship className="w-3.5 h-3.5 text-cyan-400" />
                  <span>1° Buque / Embarcación de la Obra ({ships.length} disponibles) *</span>
                </label>
                <select
                  required
                  value={formData.ship_id}
                  onChange={(e) => {
                    const newShipId = e.target.value
                    setFormData((prev) => ({
                      ...prev,
                      ship_id: newShipId,
                      work_order_id: '' // reset OT en cascada
                    }))
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary text-xs"
                >
                  <option value="">-- Seleccionar Buque --</option>
                  {ships.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.current_location ? `[${s.current_location}]` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* PASO 2: SELECCIONAR CONTRATISTA (CON PERMISO 3ROS) */}
              <div className="space-y-1.5">
                <label className="font-bold text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>2° Contratista o Taller Autorizado [3ros] ({contractors.length} disponibles) *</span>
                </label>

                {/* Desplegable integrado con buscador en tiempo real */}
                <SearchableContractorSelect
                  contractors={contractors}
                  value={formData.contractor_name}
                  onChange={handleContractorSelect}
                />

                {/* MANEJO DE RUBRO MANUAL / POLIRRUBRO */}
                {formData.is_manual_trade ? (
                  <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/50 space-y-1.5 mt-2">
                    <div className="flex items-center gap-1.5 text-amber-300 font-bold text-[11px]">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                      <span>Proveedor Polirrubro (MANUAL): Seleccione el rubro aplicable al trabajo de la lista oficial</span>
                    </div>
                    <select
                      required
                      value={formData.trade}
                      onChange={(e) => setFormData((prev) => ({ ...prev, trade: e.target.value }))}
                      className="w-full bg-slate-950 border border-amber-600/70 rounded-lg px-2.5 py-1.5 text-amber-200 text-xs focus:outline-none"
                    >
                      <option value="">-- Seleccionar Rubro Oficial --</option>
                      {OFFICIAL_TRADES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : formData.trade ? (
                  <div className="flex items-center gap-2 text-slate-400 text-[11px] mt-1 pl-1">
                    <span>Rubro asignado automáticamente:</span>
                    <span className="font-bold text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60">
                      {formData.trade}
                    </span>
                  </div>
                ) : null}
              </div>

              {/* PASO 3: SELECCIONAR ORDEN DE TRABAJO (OT) */}
              <div className="space-y-1">
                <label className="font-bold text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-cyan-400" />
                  <span>3° Orden de Trabajo (OT) en Ejecución *</span>
                </label>
                <select
                  value={formData.work_order_id}
                  onChange={(e) => setFormData((prev) => ({ ...prev, work_order_id: e.target.value }))}
                  disabled={!formData.ship_id}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary text-xs disabled:opacity-50"
                >
                  <option value="">
                    {!formData.ship_id ? '-- Primero seleccione un buque --' : '-- Seleccionar OT del buque --'}
                  </option>
                  {availableWorkOrdersForSelectedShip.map((wo) => (
                    <option key={wo.id} value={wo.id}>
                      {wo.ot_number}: {wo.title} ({wo.status || 'En ejecución'})
                    </option>
                  ))}
                </select>
              </div>

              {/* TIPO DE COMPROBANTE PRINCIPAL */}
              <div className="space-y-1 pt-1">
                <label className="font-bold text-slate-300 uppercase tracking-wider text-[11px]">
                  Tipo de Comprobante Principal (DEC-017) *
                </label>
                <select
                  value={formData.voucher_type}
                  onChange={(e) => {
                    const vCode = e.target.value
                    setFormData((prev) => ({
                      ...prev,
                      voucher_type: vCode
                    }))
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-cyan-400 text-xs"
                >
                  {VOUCHER_TYPES.map((v) => (
                    <option key={v.code} value={v.code}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500 italic">
                  {VOUCHER_TYPES.find((v) => v.code === formData.voucher_type)?.description}
                </p>
              </div>

              {/* NÚMEROS DE COMPROBANTES ASOCIADOS (MÚLTIPLES COMPROBANTES POR TRABAJO) */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-300 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Identificación de Comprobantes (Pueden registrarse varios)</span>
                  </label>
                  <span className="text-[10px] text-slate-500">Se mostrarán en la columna Nº Comprobante</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* 1. Nº Presupuesto Interno (PRC) */}
                  <div className="space-y-1">
                    <label className="font-bold text-xs flex items-center justify-between">
                      <span className={formData.voucher_type === 'PRC' ? 'text-amber-300 font-black' : 'text-slate-300'}>
                        Nº Presupuesto Interno (PRC) {formData.voucher_type === 'PRC' && '* (Obligatorio)'}
                      </span>
                      <span className="text-[10px] text-amber-500 font-mono">PRC</span>
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

                  {/* 2. Nº Factura / Comprobante Fiscal (FCR / FCA) */}
                  <div className="space-y-1">
                    <label className="font-bold text-xs flex items-center justify-between">
                      <span className={['FCR', 'FCA', 'FAC', 'REC', 'FCB', 'FCC'].includes(formData.voucher_type) ? 'text-emerald-300 font-black' : 'text-slate-300'}>
                        Nº Factura / Comprobante Fiscal
                      </span>
                      <span className="text-[10px] text-emerald-500 font-mono">FCR / FCA</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: FAC-B-0004-00012480"
                      value={formData.invoice_number || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  {/* 3. Nº Remito Alon Car (Cruce Pañol) */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300 text-xs flex items-center justify-between">
                      <span>Nº Remito Alon Car (Cruce Pañol)</span>
                      <span className="text-[10px] text-cyan-500 font-mono">ALONCAR</span>
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: 1042 (Remito de salida de Pañol)"
                      value={formData.internal_remito_number || ''}
                      onChange={(e) => setFormData(prev => ({ ...prev, internal_remito_number: e.target.value }))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>

                  {/* 4. Nº Remito de Proveedor / Taller (RPF / RMO) */}
                  <div className="space-y-1">
                    <label className="font-bold text-slate-300 text-xs flex items-center justify-between">
                      <span>Nº Remito Proveedor / Taller</span>
                      <span className="text-[10px] text-purple-500 font-mono">RPF / RMO</span>
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

              {/* FECHAS & DÓLAR INTOCABLE SEGÚN FECHA DE CARGA */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <div className="space-y-1">
                  <label className="font-bold text-slate-300 text-[11px] flex items-center justify-between">
                    <span>Fecha de Carga (A mano) *</span>
                    <span className="text-[10px] text-cyan-400 font-normal">Quincena Oficial</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.entry_date}
                    onChange={(e) => {
                      const newDate = e.target.value
                      const { usd_rate, amount_usd } = handleEntryDateOrAmountChange(newDate, formData.amount_ars)
                      setFormData((prev) => ({
                        ...prev,
                        entry_date: newDate,
                        service_date: newDate,
                        usd_rate,
                        amount_usd
                      }))
                    }}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white focus:outline-none focus:border-primary font-mono text-xs"
                  />
                  <span className="text-[10px] text-slate-500">Determina el tipo de cambio oficial</span>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-amber-300 text-[11px]">
                    Importe AR$ *
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
                        const { usd_rate, amount_usd } = handleEntryDateOrAmountChange(formData.entry_date, newArs)
                        setFormData((prev) => ({
                          ...prev,
                          amount_ars: newArs,
                          usd_rate,
                          amount_usd
                        }))
                      }}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-3 pr-7 py-1.5 text-white font-mono font-bold text-xs focus:outline-none focus:border-amber-400 disabled:opacity-50"
                    />
                    {editingService && !canEditAmounts && (
                      <Lock className="w-3.5 h-3.5 text-amber-400 absolute right-2.5 top-2" title="Edición de montos bloqueada" />
                    )}
                  </div>
                  <span className="text-[10px] text-slate-500">Monto del trabajo o comprobante</span>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-cyan-300 text-[11px] flex items-center justify-between">
                    <span className="flex items-center gap-1">
                      <Lock className="w-3 h-3 text-cyan-400" />
                      Cotiz. Dólar (Intocable)
                    </span>
                    <span className="text-white font-black font-mono text-xs">US$ {formData.amount_usd}</span>
                  </label>
                  <div className="w-full bg-slate-900/90 border border-cyan-800/60 rounded-lg px-2.5 py-1.5 font-mono text-xs text-cyan-300 font-bold flex items-center justify-between select-none">
                    <span>${Number(formData.usd_rate).toLocaleString('es-AR')}</span>
                    <span className="text-[10px] text-cyan-500 font-normal">Quincena Oficial</span>
                  </div>
                  <span className="text-[10px] text-cyan-400/90 font-mono block truncate">
                    {formData.amount_ars && formData.usd_rate > 0
                      ? `$${Number(formData.amount_ars).toLocaleString('es-AR')} ÷ $${formData.usd_rate} = US$ ${formData.amount_usd}`
                      : 'Congelado según fecha de carga'}
                  </span>
                </div>
              </div>

              {/* OBSERVACIONES DIRECTAS (TÉCNICAS) Y ESPECÍFICAS (ADMINISTRATIVAS) */}
              <div className="space-y-2">
                <div>
                  <label className="font-bold text-slate-300 text-[11px]">
                    Observaciones Directas (Detalle técnico de la tarea ejecutada)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Describa el trabajo realizado por el contratista en la obra..."
                    value={formData.direct_observations}
                    onChange={(e) => setFormData((prev) => ({ ...prev, direct_observations: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary text-xs"
                  />
                </div>

                <div>
                  <label className="font-bold text-slate-300 text-[11px]">
                    Observaciones Específicas (Administración / Reclamo de Facturas)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Notas contables, reclamos de facturas pendientes, condiciones de pago..."
                    value={formData.specific_observations}
                    onChange={(e) => setFormData((prev) => ({ ...prev, specific_observations: e.target.value }))}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-primary text-xs"
                  />
                </div>
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingService}
                  className="px-5 py-2 bg-gradient-to-r from-primary to-blue-500 hover:brightness-110 text-slate-950 rounded-xl text-xs font-extrabold flex items-center gap-2 cursor-pointer shadow-md disabled:opacity-50"
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

            <form onSubmit={handleConfirmEvolution} className="p-6 space-y-4 text-xs">
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
                <p className="font-bold text-slate-200">
                  Proveedor: <span className="text-primary">{evolvingService.contractor_name}</span>
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

            <form onSubmit={handleSaveAudit} className="p-6 space-y-4 text-xs">
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
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={savingAudit}
                  className="px-5 py-2 bg-primary text-slate-950 font-extrabold rounded-xl hover:brightness-110 disabled:opacity-50"
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
        currentShipId={pickerModal.shipId}
        currentWorkOrderId={pickerModal.workOrderId}
        contractorName={pickerModal.contractorName}
        title="Asignar Buque y OT al Comprobante de Terceros"
        onSave={async ({ shipId, workOrderId }) => {
          const serviceId = pickerModal.serviceId
          const target = services.find((s) => s.id === serviceId)
          if (!target) return

          if (grid?.pushUndoAction) {
            grid.pushUndoAction({
              colKey: 'ship_wo',
              colLabel: 'Barco / OT',
              actionLabel: 'Cambio de Buque y OT',
              previousValues: { [serviceId]: { ship_id: target.ship_id, work_order_id: target.work_order_id } },
              newValue: { ship_id: shipId, work_order_id: workOrderId },
              timestamp: Date.now()
            })
          }

          setServices((prev) =>
            prev.map((s) => (s.id === serviceId ? { ...s, ship_id: shipId, work_order_id: workOrderId } : s))
          )

          try {
            const { error } = await supabase
              .from('third_party_services')
              .update({
                ship_id: shipId,
                work_order_id: workOrderId,
                updated_at: new Date().toISOString()
              })
              .eq('id', serviceId)
            if (error) throw error
            if (!workOrderId) {
              showFeedback('success', 'Buque asignado. OT dejada en blanco (sumada a KPI Falta Cargar OT).')
            } else {
              showFeedback('success', 'Buque y OT asignados con éxito.')
            }
          } catch (err) {
            console.error('Error guardando Buque y OT:', err)
            showFeedback('error', 'Error al guardar Buque y OT: ' + err.message)
            fetchData()
          }
        }}
      />
    </div>
  )
}
