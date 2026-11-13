import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Users,
  Plus,
  Pencil,
  Trash2,
  X,
  DollarSign,
  Briefcase,
  ShieldAlert,
  Building2,
  Lock,
  Settings,
  Undo2,
  Redo2,
  Phone,
  PhoneOff,
  Shield,
  Square,
  CheckSquare,
  CopyPlus,
  BarChart3,
  Save,
  HelpCircle,
  Calendar
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSpreadsheetGrid } from '../../hooks/useSpreadsheetGrid'
import CrawlerSearchBar from '../CrawlerSearchBar'
import GridRibbon from '../GridRibbon'
import GridStatusBarBottom from '../GridStatusBarBottom'
import GridContextMenu from '../GridContextMenu'
import HighlightText from '../HighlightText'
import { duplicateRecord, buildPasteRowHandler } from '../../lib/gridRowActions'
import { matchesUniversalSearch } from '../../lib/searchEngine'
import { auditService } from '../../lib/auditService'
import { stampNewRecordWithFolio } from '../../lib/monotonicFolioEngine'
import {
  CONTRACT_TYPES,
  SAFETY_ITEMS_OPTIONS,
  SAFETY_ITEMS_HELP_TEXT,
  computeContractExpiration
} from '../../lib/workCostRules'
import { syncContractExpiryAlertsService } from '../../lib/contractorDeductionsService'
import { persistWorkerWithSchemaFallbackService } from '../../services/personalService'

// Colores por Rubro idénticos a Google Sheets
const getRubroBadgeColor = (rubro = '') => {
  const r = rubro.toUpperCase()
  if (r.includes('CALDERERIA')) return 'bg-blue-950 text-blue-300 border-blue-700/80'
  if (r.includes('PINTURA')) return 'bg-rose-950 text-rose-300 border-rose-700/80'
  if (r.includes('ELECTRICIDAD')) return 'bg-emerald-950 text-emerald-300 border-emerald-700/80'
  if (r.includes('MECANICA')) return 'bg-purple-950 text-purple-300 border-purple-700/80'
  if (r.includes('CARPINTERIA')) return 'bg-amber-950 text-amber-300 border-amber-700/80'
  if (r.includes('RASCHINAJE')) return 'bg-cyan-950 text-cyan-300 border-cyan-700/80'
  if (r.includes('TORNERIA')) return 'bg-indigo-950 text-indigo-300 border-indigo-700/80'
  if (r.includes('SUPERVISION')) return 'bg-teal-950 text-teal-300 border-teal-700/80'
  if (r.includes('MANDADOS') || r.includes('MISCELANEOS')) return 'bg-slate-800 text-slate-300 border-slate-700'
  return 'bg-slate-900 text-slate-300 border-slate-800'
}

// 5 Categorías sindicales oficiales de Astillero
const ASTILLERO_BASE_CATEGORIES = [
  'AYUDANTE',
  'OFICIAL',
  '1/2 OFICIAL',
  'APRENDIZ',
  'OFICIAL BLACK'
]

// COLORES OFICIALES POR CATEGORÍA SINDICAL
export const getCategoryBadgeStyle = (category = '') => {
  const c = (category || '').toUpperCase().trim()
  if (c === 'AYUDANTE') return 'bg-[#00E5FF] text-slate-950 border-[#00B8D4] font-black'
  if (c === 'OFICIAL') return 'bg-[#00E676] text-slate-950 border-[#00C853] font-black'
  if (c === '1/2 OFICIAL') return 'bg-[#FF00D4] text-white border-[#D500F9] font-black'
  if (c === 'APRENDIZ') return 'bg-[#FFEA00] text-slate-950 border-[#FFD600] font-black'
  if (c.includes('BLACK') || c === 'OFICIAL BLACK') return 'bg-black text-white border-slate-700 font-black'
  return 'bg-slate-900 text-slate-300 border-slate-800 font-medium'
}

export default function PersonalNominaPanel({
  workers = [],
  setWorkers,
  reloadWorkers,
  dollarRate = 1500,
  rateAyudante = 14595.84,
  rateMedioOficial = 15069.14,
  rateOficial = 16365.76
}) {
  const [statusMessage, setStatusMessage] = useState(null)
  const [kpiFilter, setKpiFilter] = useState(null)
  const [customTrades, setCustomTrades] = useState([])
  const [isAddTradeModalOpen, setIsAddTradeModalOpen] = useState(false)
  const [newTradeInput, setNewTradeInput] = useState('')
  const [targetWorkerForNewTrade, setTargetWorkerForNewTrade] = useState(null)

  // Roles organizacionales
  const [orgRoles, setOrgRoles] = useState({
    'LIQUIDACION_SUELDOS': { title: 'Responsable de Liquidación de Sueldos y RRHH', holder: 'María José' },
    'DIRECCION_OPERACIONES': { title: 'Dirección Operativa y Negociaciones', holder: 'Hugo Obregozo' },
    'OFICINA_TECNICA': { title: 'Oficina Técnica & Subcontratos', holder: 'Omar' },
    'SUPERVISION_OBRA': { title: 'Supervisión de Obra & Pañol', holder: 'Jorge' },
    'TESORERIA': { title: 'Tesorería & Pagos', holder: 'Graciela' }
  })
  const [isRolesModalOpen, setIsRolesModalOpen] = useState(false)
  const [rolesFormData, setRolesFormData] = useState({})
  const [savingRoles, setSavingRoles] = useState(false)

  // Filtros de Nómina
  const [searchTerm, setSearchTerm] = useState('')
  const [filterCenter, setFilterCenter] = useState('todos')
  const [filterStatus, setFilterStatus] = useState('todos')
  const [filterGroup, setFilterGroup] = useState('todos')
  const [filterForemanOnly, setFilterForemanOnly] = useState(false)

  // Modales de Operario
  const [editingWorker, setEditingWorker] = useState(null)
  const [isNewModalOpen, setIsNewModalOpen] = useState(false)
  const [showGroupsView, setShowGroupsView] = useState(false)
  const [savingWorker, setSavingWorker] = useState(false)
  const [isCustomGroup, setIsCustomGroup] = useState(false)
  const [customGroupName, setCustomGroupName] = useState('')

  // Formulario de Alta / Edición de Operario
  const [formData, setFormData] = useState({
    name: '',
    work_group: 'ASTILLERO',
    trade: 'CALDERERIA',
    admin_center: 'ASTILLERO',
    consumables: 'CLIENTE',
    consumables_discount_pct: 0,
    safety_items: 'ASTILLERO',
    contract_type: '',
    contract_start_date: '',
    status: 'ACTIVO',
    hourly_rate_ars: 16365.76,
    hourly_rate_usd: 10.91,
    category: 'OFICIAL',
    phone: '',
    can_withdraw_materials: true,
    can_impute_hours: true,
    can_charge_third_party: false,
    is_foreman: false
  })

  const [contextMenuTarget, setContextMenuTarget] = useState(null)
  const [inlineCellEdit, setInlineCellEdit] = useState(null)
  const nominaSearchInputRef = useRef(null)
  const nominaPasteRef = useRef(null)

  // Cargar rubros maestros y roles
  useEffect(() => {
    async function loadAuxData() {
      try {
        const { data: tradesSetting } = await supabase
          .from('system_settings')
          .select('value')
          .eq('key', 'master_trades')
          .maybeSingle()
        if (tradesSetting?.value && Array.isArray(tradesSetting.value)) {
          setCustomTrades(tradesSetting.value)
        }
      } catch (tradeErr) {
        console.warn('No se pudieron cargar rubros maestros:', tradeErr)
      }

      try {
        const { data, error } = await supabase.from('organization_roles').select('*')
        if (error) throw error
        if (data && data.length > 0) {
          const map = {}
          data.forEach(r => {
            map[r.role_key] = { title: r.role_title, holder: r.holder_name, dept: r.department }
          })
          setOrgRoles(prev => ({ ...prev, ...map }))
        }
      } catch (err) {
        console.warn('Cargando roles por defecto:', err)
      }
    }
    loadAuxData()
  }, [])

  const showGridFeedback = useCallback((type, text) => {
    setStatusMessage({ type, text })
    setTimeout(() => setStatusMessage(null), 3200)
  }, [])

  const uniqueWorkGroups = useMemo(() => {
    const set = new Set()
    workers.forEach(w => {
      if (w.work_group) set.add(w.work_group)
    })
    return Array.from(set).sort()
  }, [workers])

  const availableContractorGroups = useMemo(() => {
    const set = new Set()
    workers.forEach(w => {
      if ((w.admin_center || '').toUpperCase() === 'CONTRATISTA' && w.work_group && w.work_group !== 'ASTILLERO') {
        const clean = w.work_group.replace(/\s+AYUDANTE$/, '').trim()
        if (clean) set.add(clean)
      }
    })
    const knownContractors = [
      'AVALOS', 'DAMIAN', 'TANO', 'PINTOR JUAREZ', 'RAMON ARANDA',
      'CHACANO', 'CHARRA', 'LUAYZA', 'TOBARES', 'BOLTRI', 'CAMILO MARTINEZ',
      'ALDO (CARPINTERO)', 'DE ANGELIS', 'VALENCIA ARENADOR', 'LEO ZOLOA',
      'EDUARDO FERNANDEZ', 'ARRIOLA', 'MATIAS SANCHEZ', 'ALAN MOISES',
      'GUILLERMO GARCIA', 'BRUNO HRNOS', 'CARLOS VIDONDO', 'JUAREZ JUAN', 'JHONNY'
    ]
    knownContractors.forEach(c => set.add(c))
    return Array.from(set).sort()
  }, [workers])

  const availableTallerGroups = useMemo(() => {
    const set = new Set()
    workers.forEach(w => {
      if ((w.admin_center || '').toUpperCase() === 'TALLER' && w.work_group && w.work_group !== 'ASTILLERO') {
        const clean = w.work_group.replace(/\s+TALLER$/, '').trim()
        if (clean) set.add(clean)
      }
    })
    const knownTalleres = [
      'CORMETAL', 'DIVISION CORTE', 'GARCIA TORNERIA.', 'GPA', 'GRILLO TORNERIA',
      'INTECO', 'JL ABREU', 'JOAO', 'KRANJAC', 'LESIN S.A', 'MCM MECANICA',
      'NECOLOGICA', 'PRFV DELTA', 'RAFA', 'CONS SR METAL SA (RIFFO)', 'STI INGENIERIA',
      'TECO TALLER', 'ULSTRUP', 'INA PANTOGRAFO', 'ATENEO', '4RG SERV. INDUSTRIALES',
      'ARENADO PUERTO', 'NAVAL TRONIC', 'SEN SRL', 'ELECTRICIDAD NAVAL SA',
      'EDUARDO FERNANDEZ TALLER', 'RAMON ARANDA TALLER'
    ]
    knownTalleres.forEach(t => set.add(t))
    return Array.from(set).sort()
  }, [workers])

  const uniqueTrades = useMemo(() => {
    const set = new Set([
      'CALDERERIA',
      'CARPINTERIA',
      'COBRERIA',
      'ELECTRICIDAD',
      'FIBRA VIDRIO',
      'FRIGORISTA',
      'GASISTA',
      'HIDRAULICA',
      'MANIOBRA',
      'MECANICA',
      'MISCELANEOS',
      'PAÑOLERO',
      'PINTURA',
      'RASCHINAJE',
      'SERENO',
      'SERVICIOS',
      'SOLDADURA',
      'TECNICOS',
      'TORNERIA'
    ])
    customTrades.forEach(t => set.add(t))
    workers.forEach(w => {
      if (w.trade) {
        String(w.trade).split(/[,;/|]+/).forEach(t => {
          const clean = t.trim().toUpperCase()
          if (clean) set.add(clean)
        })
      }
    })
    return Array.from(set).sort()
  }, [workers, customTrades])

  // Métricas y contadores de los 5 KPIs de Auditoría Operativa
  const kpiStats = useMemo(() => {
    const activos = workers.filter(w => w.status === 'ACTIVO')
    const sinTelefonoAstillero = activos.filter(w => w.admin_center === 'ASTILLERO' && (!w.phone || !w.phone.trim()))
    const sinCostoAstillero = activos.filter(w => w.admin_center === 'ASTILLERO' && (!w.hourly_rate_ars || Number(w.hourly_rate_ars) <= 0))
    const sinCostoContratistas = activos.filter(w => w.admin_center === 'CONTRATISTA' && (!w.hourly_rate_ars || Number(w.hourly_rate_ars) <= 0))
    const sinConsumiblesContratistas = activos.filter(w => w.admin_center === 'CONTRATISTA' && (w.consumables_discount_pct === null || w.consumables_discount_pct === undefined || w.consumables_discount_pct === '') && (!w.consumables || !w.consumables.trim()))
    const sinPermisos = activos.filter(w => !w.can_withdraw_materials && !w.can_impute_hours && !w.can_charge_third_party && !w.is_foreman)
    const contratosPorVencer = activos.filter(w =>
      w.admin_center === 'ASTILLERO' && computeContractExpiration(w.contract_type, w.contract_start_date).needsAttention
    )

    return {
      sinTelefonoAstillero: sinTelefonoAstillero.length,
      sinCostoAstillero: sinCostoAstillero.length,
      sinCostoContratistas: sinCostoContratistas.length,
      sinConsumiblesContratistas: sinConsumiblesContratistas.length,
      sinPermisos: sinPermisos.length,
      contratosPorVencer: contratosPorVencer.length
    }
  }, [workers])

  const clearAllFilters = useCallback(() => {
    setSearchTerm('')
    setFilterCenter('todos')
    setFilterStatus('todos')
    setFilterGroup('todos')
    setFilterForemanOnly(false)
    setKpiFilter(null)
  }, [])

  const hasActiveFilters = Boolean(
    searchTerm ||
    filterCenter !== 'todos' ||
    filterStatus !== 'todos' ||
    filterGroup !== 'todos' ||
    filterForemanOnly ||
    kpiFilter
  )

  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      if (searchTerm && !matchesUniversalSearch(w, searchTerm)) return false
      if (filterCenter !== 'todos' && w.admin_center !== filterCenter) return false
      if (filterStatus !== 'todos' && w.status !== filterStatus) return false
      if (filterGroup !== 'todos' && w.work_group !== filterGroup) return false
      if (filterForemanOnly && !w.is_foreman) return false

      if (kpiFilter === 'sin_telefono_astillero') {
        if (w.status !== 'ACTIVO' || w.admin_center !== 'ASTILLERO' || (w.phone && w.phone.trim())) return false
      } else if (kpiFilter === 'sin_costo_astillero') {
        if (w.status !== 'ACTIVO' || w.admin_center !== 'ASTILLERO' || (w.hourly_rate_ars && Number(w.hourly_rate_ars) > 0)) return false
      } else if (kpiFilter === 'sin_costo_contratistas') {
        if (w.status !== 'ACTIVO' || w.admin_center !== 'CONTRATISTA' || (w.hourly_rate_ars && Number(w.hourly_rate_ars) > 0)) return false
      } else if (kpiFilter === 'sin_consumibles_contratistas') {
        if (w.status !== 'ACTIVO' || w.admin_center !== 'CONTRATISTA' || (w.consumables_discount_pct !== null && w.consumables_discount_pct !== undefined && w.consumables_discount_pct !== '') || (w.consumables && w.consumables.trim())) return false
      } else if (kpiFilter === 'sin_permisos') {
        if (w.status !== 'ACTIVO' || w.can_withdraw_materials || w.can_impute_hours || w.can_charge_third_party || w.is_foreman) return false
      } else if (kpiFilter === 'contratos_por_vencer') {
        if (w.status !== 'ACTIVO' || w.admin_center !== 'ASTILLERO' || !computeContractExpiration(w.contract_type, w.contract_start_date).needsAttention) return false
      } else if (kpiFilter === 'categoria_OFICIAL') {
        const cat = (w.category || '').toUpperCase().trim()
        if (cat !== 'OFICIAL') return false
      } else if (kpiFilter === 'categoria_1/2 OFICIAL') {
        const cat = (w.category || '').toUpperCase().trim()
        if (cat !== '1/2 OFICIAL' && cat !== 'MEDIO OFICIAL') return false
      } else if (kpiFilter === 'categoria_AYUDANTE') {
        const cat = (w.category || '').toUpperCase().trim()
        if (cat !== 'AYUDANTE') return false
      }

      return true
    })
  }, [workers, searchTerm, filterCenter, filterStatus, filterGroup, filterForemanOnly, kpiFilter])

  const groupedSummary = useMemo(() => {
    const map = new Map()
    workers.forEach(w => {
      const g = w.work_group || 'SIN GRUPO'
      if (!map.has(g)) {
        map.set(g, {
          name: g,
          admin_center: w.admin_center,
          trade: w.trade,
          consumables: w.consumables,
          totalWorkers: 0,
          activeWorkers: 0,
          workers: [],
          avgRateArs: 0,
          avgRateUsd: 0,
          canChargeThirdParty: false
        })
      }
      const entry = map.get(g)
      entry.totalWorkers += 1
      if (w.status === 'ACTIVO') entry.activeWorkers += 1
      if (w.can_charge_third_party) entry.canChargeThirdParty = true
      entry.workers.push(w)
      entry.avgRateArs += (parseFloat(w.hourly_rate_ars) || 0)
      entry.avgRateUsd += (parseFloat(w.hourly_rate_usd) || 0)
    })

    return Array.from(map.values()).map(e => ({
      ...e,
      avgRateArs: e.totalWorkers > 0 ? (e.avgRateArs / e.totalWorkers).toFixed(2) : 0,
      avgRateUsd: e.totalWorkers > 0 ? (e.avgRateUsd / e.totalWorkers).toFixed(2) : 0
    }))
  }, [workers])

  const totalCount = workers.length
  const astilleroCount = workers.filter(w => w.admin_center === 'ASTILLERO').length
  const contratistasCount = workers.filter(w => w.admin_center === 'CONTRATISTA').length
  const talleresCount = workers.filter(w => w.admin_center === 'TALLER').length
  const foremenCount = workers.filter(w => w.is_foreman).length
  const activeCount = workers.filter(w => w.status === 'ACTIVO').length
  const inactiveCount = workers.filter(w => w.status === 'INACTIVO').length

  const handleAdminCenterChange = (newCenter) => {
    let defaultGroup = 'ASTILLERO'
    let defaultDiscount = 0
    let defaultSafety = 'ASTILLERO'
    let defaultRate = rateOficial || 16365.76

    if (newCenter === 'CONTRATISTA') {
      defaultGroup = availableContractorGroups[0] || 'AVALOS'
      defaultDiscount = 100
      defaultSafety = 'CONTRATISTA'
      defaultRate = 17500
    } else if (newCenter === 'TALLER') {
      defaultGroup = availableTallerGroups[0] || 'CORMETAL'
      defaultDiscount = 100
      defaultSafety = 'CONTRATISTA'
      defaultRate = 18000
    }

    setIsCustomGroup(false)
    setCustomGroupName('')
    setFormData(prev => ({
      ...prev,
      admin_center: newCenter,
      work_group: defaultGroup,
      consumables_discount_pct: defaultDiscount,
      consumables: defaultDiscount === 100 ? 'CONTRATISTA' : (defaultDiscount === 0 ? 'CLIENTE' : `DESC. ${defaultDiscount}%`),
      safety_items: defaultSafety,
      contract_type: newCenter === 'ASTILLERO' ? (prev.contract_type || '') : '',
      contract_start_date: newCenter === 'ASTILLERO' ? (prev.contract_start_date || '') : '',
      hourly_rate_ars: defaultRate,
      hourly_rate_usd: dollarRate > 0 ? Number((defaultRate / dollarRate).toFixed(2)) : 0,
      can_charge_third_party: newCenter !== 'ASTILLERO'
    }))
  }

  const handleOpenNew = () => {
    const initialCenter = filterCenter !== 'todos' ? filterCenter : 'ASTILLERO'
    let defaultGroup = 'ASTILLERO'
    let defaultDiscount = 0
    let defaultSafety = 'ASTILLERO'
    let defaultRate = rateOficial || 16365.76

    if (initialCenter === 'CONTRATISTA') {
      defaultGroup = filterGroup !== 'todos' && filterGroup !== 'ASTILLERO' ? filterGroup : (availableContractorGroups[0] || 'AVALOS')
      defaultDiscount = 100
      defaultSafety = 'CONTRATISTA'
      defaultRate = 17500
    } else if (initialCenter === 'TALLER') {
      defaultGroup = filterGroup !== 'todos' && filterGroup !== 'ASTILLERO' ? filterGroup : (availableTallerGroups[0] || 'CORMETAL')
      defaultDiscount = 100
      defaultSafety = 'CONTRATISTA'
      defaultRate = 18000
    }

    setIsCustomGroup(false)
    setCustomGroupName('')
    setFormData({
      name: '',
      work_group: defaultGroup,
      trade: 'CALDERERIA',
      admin_center: initialCenter,
      consumables: defaultDiscount === 100 ? 'CONTRATISTA' : (defaultDiscount === 0 ? 'CLIENTE' : `DESC. ${defaultDiscount}%`),
      consumables_discount_pct: defaultDiscount,
      safety_items: defaultSafety,
      contract_type: '',
      contract_start_date: '',
      status: 'ACTIVO',
      hourly_rate_ars: defaultRate,
      hourly_rate_usd: dollarRate > 0 ? Number((defaultRate / dollarRate).toFixed(2)) : 0,
      category: 'OFICIAL',
      phone: '',
      can_withdraw_materials: true,
      can_impute_hours: true,
      can_charge_third_party: initialCenter !== 'ASTILLERO',
      is_foreman: false
    })
    setIsNewModalOpen(true)
  }

  const handleEdit = (w) => {
    setEditingWorker(w)
    const center = w.admin_center || 'ASTILLERO'
    const grp = w.work_group || 'ASTILLERO'

    let isCustom = false
    if (center === 'CONTRATISTA' && !availableContractorGroups.includes(grp)) {
      isCustom = true
    } else if (center === 'TALLER' && !availableTallerGroups.includes(grp)) {
      isCustom = true
    }

    setIsCustomGroup(isCustom)
    setCustomGroupName(isCustom ? grp : '')

    let discountPct = 100
    if (w.consumables_discount_pct !== undefined && w.consumables_discount_pct !== null) {
      discountPct = Number(w.consumables_discount_pct)
    } else {
      discountPct = (w.consumables || '').toUpperCase().includes('CLIENTE') ? 0 : 100
    }

    const ars = parseFloat(w.hourly_rate_ars) || 0
    const usd = dollarRate > 0 ? Number((ars / dollarRate).toFixed(2)) : (parseFloat(w.hourly_rate_usd) || 0)

    setFormData({
      name: w.name || '',
      work_group: grp,
      trade: w.trade || 'CALDERERIA',
      admin_center: center,
      consumables: w.consumables || (discountPct === 0 ? 'CLIENTE' : (discountPct === 100 ? 'CONTRATISTA' : `DESC. ${discountPct}%`)),
      consumables_discount_pct: discountPct,
      safety_items: w.safety_items || (center === 'ASTILLERO' ? 'ASTILLERO' : 'CONTRATISTA'),
      contract_type: w.contract_type || '',
      contract_start_date: w.contract_start_date ? String(w.contract_start_date).slice(0, 10) : '',
      status: w.status || 'ACTIVO',
      hourly_rate_ars: ars,
      hourly_rate_usd: usd,
      category: w.category || 'OFICIAL',
      phone: w.phone || '',
      can_withdraw_materials: w.can_withdraw_materials ?? true,
      can_impute_hours: w.can_impute_hours ?? true,
      can_charge_third_party: w.can_charge_third_party ?? (center !== 'ASTILLERO'),
      is_foreman: Boolean(w.is_foreman)
    })
  }

  const handleSaveSubmit = async (e) => {
    e.preventDefault()
    setSavingWorker(true)

    try {
      const ars = parseFloat(formData.hourly_rate_ars) || 0
      const usd = dollarRate > 0 ? parseFloat((ars / dollarRate).toFixed(2)) : (parseFloat(formData.hourly_rate_usd) || 0)

      let finalGroup = 'ASTILLERO'
      if (formData.admin_center !== 'ASTILLERO') {
        if (isCustomGroup && customGroupName.trim()) {
          finalGroup = customGroupName.trim().toUpperCase()
        } else {
          finalGroup = (formData.work_group || '').trim().toUpperCase()
        }
      }

      const discountPct = Number(formData.consumables_discount_pct ?? 100)
      let consumablesLabel = 'CLIENTE'
      if (discountPct === 100) {
        consumablesLabel = 'CONTRATISTA'
      } else if (discountPct > 0) {
        consumablesLabel = `DESC. ${discountPct}%`
      }

      const payload = {
        name: formData.name.trim(),
        work_group: finalGroup,
        trade: formData.trade.trim().toUpperCase(),
        admin_center: formData.admin_center,
        consumables: consumablesLabel,
        consumables_discount_pct: discountPct,
        safety_items: formData.admin_center === 'ASTILLERO' ? 'ASTILLERO' : (formData.safety_items || 'CONTRATISTA'),
        contract_type: formData.admin_center === 'ASTILLERO' ? (formData.contract_type || null) : null,
        contract_start_date: formData.admin_center === 'ASTILLERO' && formData.contract_start_date ? formData.contract_start_date : null,
        status: formData.status,
        hourly_rate_ars: ars,
        hourly_rate_usd: usd,
        category: formData.category,
        phone: formData.phone?.trim() || null,
        can_withdraw_materials: Boolean(formData.can_withdraw_materials),
        can_impute_hours: Boolean(formData.can_impute_hours),
        can_charge_third_party: Boolean(formData.can_charge_third_party),
        is_foreman: Boolean(formData.is_foreman)
      }

      if (editingWorker) {
        const { missingContractCols } = await persistWorkerWithSchemaFallbackService({
          mode: 'update',
          targetId: editingWorker.id,
          payload,
          syncGroup: finalGroup
        })

        const updatedWorkersList = workers.map(w => {
          if (w.id === editingWorker.id) return { ...w, ...payload }
          if (finalGroup !== 'ASTILLERO' && w.work_group === finalGroup) {
            return {
              ...w,
              can_charge_third_party: payload.can_charge_third_party,
              trade: payload.trade
            }
          }
          return w
        })
        setWorkers(updatedWorkersList)
        syncContractExpiryAlertsService(updatedWorkersList)

        await auditService.logRowAction({
          action: 'MODAL_SAVE',
          entityType: 'workers',
          entityId: editingWorker.id,
          entityName: payload.name,
          changes: payload,
          sheetName: 'Personal · Nómina de Operarios',
          moduleRoute: '/personal'
        })
        setStatusMessage({
          type: missingContractCols ? 'info' : 'success',
          text: missingContractCols
            ? `Operario actualizado. Ejecutá la migración 0037 en Supabase para guardar Tipo de Contrato y Fecha Inicio.`
            : `Registro de ${payload.name} (${finalGroup}) actualizado con éxito.`
        })
        setEditingWorker(null)
      } else {
        const { data, missingContractCols } = await persistWorkerWithSchemaFallbackService({
          mode: 'insert',
          payload
        })

        const createdObj = data && data[0] ? data[0] : { ...payload, id: Date.now().toString() }
        const newRecord = stampNewRecordWithFolio(createdObj, workers)
        const updatedWorkersList = [newRecord, ...workers]
        setWorkers(updatedWorkersList)
        syncContractExpiryAlertsService(updatedWorkersList)

        await auditService.logRowAction({
          action: 'ROW_INSERT',
          entityType: 'workers',
          entityId: newRecord.id,
          entityName: payload.name,
          rowData: payload,
          sheetName: 'Personal · Nómina de Operarios',
          moduleRoute: '/personal'
        })
        setStatusMessage({
          type: missingContractCols ? 'info' : 'success',
          text: missingContractCols
            ? `Operario ${payload.name} creado. Ejecutá la migración 0037 en Supabase para guardar Contrato.`
            : `Operario ${payload.name} agregado al Grupo ${finalGroup}.`
        })
        setIsNewModalOpen(false)
      }

      setTimeout(() => setStatusMessage(null), 3500)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al guardar: ${err.message}` })
    } finally {
      setSavingWorker(false)
    }
  }

  const toggleWorkerStatus = async (worker) => {
    const newStatus = worker.status === 'ACTIVO' ? 'INACTIVO' : 'ACTIVO'
    try {
      setWorkers(prev => prev.map(w => w.id === worker.id ? { ...w, status: newStatus } : w))

      const { error } = await supabase
        .from('workers')
        .update({ status: newStatus })
        .eq('id', worker.id)

      if (error) throw error
      await auditService.logCellChange({
        entityType: 'workers',
        entityId: worker.id,
        entityName: worker.name,
        field: 'status',
        fieldLabel: 'Estado Operativo',
        oldValue: worker.status,
        newValue: newStatus,
        sheetName: 'Personal · Nómina de Operarios',
        moduleRoute: '/personal'
      })
    } catch (err) {
      console.error(err)
      reloadWorkers?.()
    }
  }

  const toggleWorkerPermission = async (worker, permType) => {
    const fieldMap = {
      'P': 'can_withdraw_materials',
      'H': 'can_impute_hours',
      '3ros': 'can_charge_third_party',
      'JO': 'is_foreman'
    }
    const field = fieldMap[permType]
    if (!field) return
    const defaultVal = permType === 'P' || permType === 'H'
    const currentVal = Boolean(worker[field] ?? defaultVal)
    const newVal = !currentVal
    const isGroup3ros = permType === '3ros' && worker.work_group && worker.work_group !== 'ASTILLERO'

    try {
      setWorkers(prev => prev.map(w => {
        if (w.id === worker.id) return { ...w, [field]: newVal }
        if (isGroup3ros && w.work_group === worker.work_group) return { ...w, [field]: newVal }
        return w
      }))

      if (isGroup3ros) {
        const { error } = await supabase
          .from('workers')
          .update({ [field]: newVal })
          .eq('work_group', worker.work_group)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('workers')
          .update({ [field]: newVal })
          .eq('id', worker.id)
        if (error) throw error
      }
      await auditService.logCellChange({
        entityType: 'workers',
        entityId: worker.id,
        entityName: worker.name,
        field,
        fieldLabel: `Permiso (${permType})`,
        oldValue: currentVal ? 'HABILITADO' : 'BLOQUEADO',
        newValue: newVal ? 'HABILITADO' : 'BLOQUEADO',
        sheetName: 'Personal · Nómina de Operarios',
        moduleRoute: '/personal'
      })
    } catch (err) {
      console.error(err)
      reloadWorkers?.()
    }
  }

  const handleDelete = async (worker) => {
    if (!window.confirm(`¿Estás seguro de eliminar a ${worker.name} del Grupo ${worker.work_group}?`)) return
    try {
      setWorkers(prev => prev.filter(w => w.id !== worker.id))
      const { error } = await supabase.from('workers').delete().eq('id', worker.id)
      if (error) throw error
      await auditService.logRowAction({
        action: 'ROW_DELETE',
        entityType: 'workers',
        entityId: worker.id,
        entityName: worker.name,
        rowData: worker,
        sheetName: 'Personal · Nómina de Operarios',
        moduleRoute: '/personal'
      })
      setStatusMessage({ type: 'info', text: `Se eliminó a ${worker.name}.` })
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al eliminar: ${err.message}` })
      reloadWorkers?.()
    }
  }

  const handleBatchToggleStatus = async () => {
    const selectedIds = Array.from(nominaGrid.selectedRowIds)
    if (selectedIds.length === 0) return

    const selectedWorkers = workers.filter(w => selectedIds.includes(w.id))
    const allActive = selectedWorkers.every(w => w.status === 'ACTIVO')
    const targetStatus = allActive ? 'INACTIVO' : 'ACTIVO'

    if (!window.confirm(`¿Cambiar estado a "${targetStatus}" para ${selectedIds.length} operario(s) seleccionado(s)?`)) return

    try {
      setWorkers(prev => prev.map(w => selectedIds.includes(w.id) ? { ...w, status: targetStatus } : w))
      const { error } = await supabase.from('workers').update({ status: targetStatus }).in('id', selectedIds)
      if (error) throw error
      showGridFeedback('success', `Se actualizaron ${selectedIds.length} operario(s) a ${targetStatus}.`)
      nominaGrid.clearSelectedRows()
    } catch (err) {
      console.error('Error en actualización en lote:', err)
      showGridFeedback('error', `Error al actualizar en lote: ${err.message}`)
      reloadWorkers?.()
    }
  }

  const handleBatchDeleteWorkers = async () => {
    const selectedIds = Array.from(nominaGrid.selectedRowIds)
    if (selectedIds.length === 0) return

    if (!window.confirm(`⚠️ ¡ATENCIÓN! ¿Eliminar permanentemente ${selectedIds.length} operario(s) seleccionado(s)?`)) return

    try {
      setWorkers(prev => prev.filter(w => !selectedIds.includes(w.id)))
      const { error } = await supabase.from('workers').delete().in('id', selectedIds)
      if (error) throw error
      showGridFeedback('info', `Se eliminaron ${selectedIds.length} operario(s).`)
      nominaGrid.clearSelectedRows()
    } catch (err) {
      console.error('Error eliminando en lote:', err)
      showGridFeedback('error', `Error al eliminar en lote: ${err.message}`)
      reloadWorkers?.()
    }
  }

  const nominaColumns = useMemo(() => [
    { key: 'name', label: 'Nombre y Apellido' },
    { key: 'category', label: 'Categoría' },
    { key: 'trade', label: 'Rubro' },
    { key: 'hourly_rate_ars', label: 'AR$/Hora' },
    { key: 'work_group', label: 'Grupo de Trabajo' },
    { key: 'admin_center', label: 'Centro Admin' },
    { key: 'safety_items', label: 'Elem. Seg.' }
  ], [])

  const applyWorkerSinglePatch = useCallback(async (rowId, colKey, rawValue) => {
    if (auditService.isInvalidEventOrObjectScalar(rawValue)) {
      console.warn('[Personal] Bloqueado intento de guardar objeto inválido en operario:', rawValue)
      return null
    }
    const targetWorker = workers.find(w => w.id === rowId)
    if (!targetWorker) return null

    const oldVal = targetWorker[colKey]

    let dbPatch = {}
    if (colKey === 'hourly_rate_ars') {
      const ars = Math.max(0, parseFloat(rawValue) || 0)
      const usd = dollarRate > 0 ? Number((ars / dollarRate).toFixed(2)) : (parseFloat(targetWorker.hourly_rate_usd) || 0)
      dbPatch = { hourly_rate_ars: ars, hourly_rate_usd: usd }
    } else if (colKey === 'admin_center') {
      const normalized = String(rawValue || '').trim().toUpperCase()
      const valid = ['ASTILLERO', 'CONTRATISTA', 'TALLER'].includes(normalized) ? normalized : targetWorker.admin_center
      dbPatch = {
        admin_center: valid,
        safety_items: valid === 'ASTILLERO' ? 'ASTILLERO' : (targetWorker.safety_items || 'CONTRATISTA')
      }
    } else if (colKey === 'safety_items') {
      const normalized = String(rawValue || '').trim().toUpperCase()
      const valid = targetWorker.admin_center === 'ASTILLERO'
        ? 'ASTILLERO'
        : (['ASTILLERO', 'CONTRATISTA'].includes(normalized) ? normalized : 'CONTRATISTA')
      dbPatch = { safety_items: valid }
    } else if (colKey === 'category' || colKey === 'trade' || colKey === 'work_group') {
      dbPatch = { [colKey]: String(rawValue || '').trim().toUpperCase() }
    } else if (colKey === 'name') {
      const trimmed = String(rawValue || '').trim()
      if (!trimmed || trimmed.toUpperCase() === '[OBJECT OBJECT]') return null
      dbPatch = { name: trimmed }
    } else {
      dbPatch = { [colKey]: rawValue }
    }

    setWorkers(prev => prev.map(w => w.id === rowId ? { ...w, ...dbPatch } : w))

    const { error } = await supabase
      .from('workers')
      .update(dbPatch)
      .eq('id', rowId)
    if (error) throw error

    const colDef = nominaColumns.find(c => c.key === colKey)
    await auditService.logCellChange({
      entityType: 'workers',
      entityId: rowId,
      entityName: dbPatch.name || targetWorker.name || rowId,
      field: colKey,
      fieldLabel: colDef?.label || colKey,
      oldValue: oldVal,
      newValue: dbPatch[colKey],
      sheetName: 'Personal · Nómina de Operarios',
      moduleRoute: '/personal'
    })
    return dbPatch[colKey]
  }, [workers, dollarRate, nominaColumns, setWorkers])

  const handleNominaBatchUpdate = useCallback(async ({ colKey, newValue, targetIds, revertMap, isRevert }) => {
    try {
      if (isRevert && revertMap) {
        for (const [id, oldVal] of Object.entries(revertMap)) {
          await applyWorkerSinglePatch(id, colKey, oldVal)
        }
      } else if (Array.isArray(targetIds)) {
        for (const id of targetIds) {
          await applyWorkerSinglePatch(id, colKey, newValue)
        }
      }
    } catch (err) {
      console.error(err)
      showGridFeedback('error', `Error actualizando padrón: ${err.message}`)
      reloadWorkers?.()
    }
  }, [applyWorkerSinglePatch, showGridFeedback, reloadWorkers])

  const nominaGrid = useSpreadsheetGrid({
    rows: filteredWorkers,
    columns: nominaColumns,
    getRowId: (w) => w.id,
    storageKey: 'aloncar_grid_personal',
    onBatchUpdate: handleNominaBatchUpdate,
    onPasteRow: (args) => nominaPasteRef.current?.(args),
    onFocusSearch: () => nominaSearchInputRef.current?.focus(),
    onCellActivate: (row, colDef) => {
      if (!row || !colDef) return
      setInlineCellEdit({
        rowId: row.id,
        colKey: colDef.key,
        value: row[colDef.key] ?? ''
      })
    },
    showFeedback: showGridFeedback
  })

  const commitInlineWorkerEdit = async (overrideValue = undefined) => {
    if (!inlineCellEdit) return
    const { rowId, colKey } = inlineCellEdit
    const hasValidOverride = overrideValue !== undefined && !auditService.isInvalidEventOrObjectScalar(overrideValue)
    const nextVal = hasValidOverride ? overrideValue : inlineCellEdit.value
    const worker = workers.find(w => w.id === rowId)
    setInlineCellEdit(null)
    if (!worker) return

    const oldVal = worker[colKey]
    if (String(oldVal ?? '') === String(nextVal ?? '')) return

    try {
      const savedVal = await applyWorkerSinglePatch(rowId, colKey, nextVal)
      if (savedVal !== null) {
        const colDef = nominaColumns.find(c => c.key === colKey)
        nominaGrid.pushUndoAction({
          colKey,
          colLabel: colDef?.label || colKey,
          actionLabel: `Editar ${colDef?.label || colKey} de ${worker.name}`,
          previousValues: { [rowId]: oldVal },
          newValue: savedVal,
          timestamp: Date.now()
        })
        showGridFeedback('success', `Celda actualizada en ${worker.name}. (Ctrl+Z para deshacer)`)
      }
    } catch (err) {
      console.error(err)
      showGridFeedback('error', `Error al guardar celda: ${err.message}`)
      reloadWorkers?.()
    }
  }

  const WORKER_CLONE_FIELDS = ['category', 'trade', 'hourly_rate_ars', 'hourly_rate_usd', 'work_group', 'admin_center', 'status', 'phone', 'consumables', 'consumables_discount_pct', 'can_withdraw_materials', 'can_impute_hours', 'can_charge_third_party', 'is_foreman']

  useEffect(() => {
    nominaPasteRef.current = buildPasteRowHandler({
      table: 'workers',
      entityType: 'workers',
      fields: WORKER_CLONE_FIELDS,
      grid: nominaGrid,
      setList: setWorkers,
      nameOf: (r) => r.name || r.id,
      showFeedback: showGridFeedback
    })
  })

  const handleDuplicateWorkerRow = async (w) => {
    if (!w) return
    try {
      const created = await duplicateRecord({
        table: 'workers',
        entityType: 'workers',
        source: w,
        fields: WORKER_CLONE_FIELDS,
        overrides: { name: `${w.name || 'Operario'} (COPIA)`, is_foreman: false },
        nameOf: (r) => r.name || r.id
      })
      showGridFeedback('success', `Operario duplicado como "${created.name}".`)
      reloadWorkers?.()
    } catch (err) {
      console.error(err)
      showGridFeedback('error', `Error al duplicar operario: ${err.message}`)
    }
  }

  const handleSaveRolesSubmit = async (e) => {
    e.preventDefault()
    setSavingRoles(true)
    try {
      for (const [key, val] of Object.entries(rolesFormData)) {
        await supabase
          .from('organization_roles')
          .update({ holder_name: val.holder, role_title: val.title })
          .eq('role_key', key)
      }
      const { data } = await supabase.from('organization_roles').select('*')
      if (data) {
        const map = {}
        data.forEach(r => {
          map[r.role_key] = { title: r.role_title, holder: r.holder_name, dept: r.department }
        })
        setOrgRoles(prev => ({ ...prev, ...map }))
      }
      setStatusMessage({ type: 'success', text: 'Titulares de puestos organizacionales actualizados en todo el sistema.' })
      setIsRolesModalOpen(false)
      setTimeout(() => setStatusMessage(null), 3500)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al actualizar puestos: ${err.message}` })
    } finally {
      setSavingRoles(false)
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Toast Feedback */}
      {statusMessage && (
        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between shadow-lg ${
          statusMessage.type === 'error'
            ? 'bg-rose-950/90 border-rose-500 text-rose-200'
            : statusMessage.type === 'info'
            ? 'bg-cyan-950/90 border-cyan-500 text-cyan-200'
            : 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
        }`}>
          <span>{statusMessage.text}</span>
          <button type="button" onClick={() => setStatusMessage(null)} className="text-slate-400 hover:text-white ml-2">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* ZONA 2: RADAR DE KPIS Y ALERTAS OPERATIVAS (5 TARJETAS CROMÁTICAS CON FILTRO AL CLIC) */}
      <div className="alon-zone-kpis rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between border-b border-amber-500/20 pb-2">
          <span className="text-xs font-black uppercase tracking-wider text-amber-300 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-amber-400" />
            <span>Radar de Alertas Operativas del Padrón • Clic en cualquier tarjeta para filtrar</span>
          </span>
          {kpiFilter && !kpiFilter.startsWith('categoria_') && (
            <button
              type="button"
              onClick={() => setKpiFilter(null)}
              className="text-[11px] font-bold text-amber-400 hover:text-amber-300 underline cursor-pointer"
            >
              ✕ Quitar filtro activo
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* KPI 1: Astillero sin Teléfono (Alerta Crítica / Rojo Carmín) */}
          <button
            type="button"
            onClick={() => setKpiFilter(prev => prev === 'sin_telefono_astillero' ? null : 'sin_telefono_astillero')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              kpiFilter === 'sin_telefono_astillero'
                ? 'bg-rose-950/60 border-rose-500 ring-2 ring-rose-400 shadow-lg shadow-rose-950/50'
                : 'bg-rose-950/25 border-rose-500/50 hover:bg-rose-950/40 hover:border-rose-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-300">
                Astillero sin Teléfono
              </span>
              <PhoneOff className="w-4 h-4 text-rose-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-rose-400">
                {kpiStats.sinTelefonoAstillero}
              </span>
              <span className="text-[10px] text-rose-300/70">personal propio</span>
            </div>
            <p className="text-[9px] text-rose-300/60 mt-1 truncate">Sin número móvil cargado</p>
          </button>

          {/* KPI 2: Astillero sin Costo (Amarillo Ámbar) */}
          <button
            type="button"
            onClick={() => setKpiFilter(prev => prev === 'sin_costo_astillero' ? null : 'sin_costo_astillero')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              kpiFilter === 'sin_costo_astillero'
                ? 'bg-amber-950/60 border-amber-500 ring-2 ring-amber-400 shadow-lg shadow-amber-950/50'
                : 'bg-amber-950/25 border-amber-500/50 hover:bg-amber-950/40 hover:border-amber-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-300">
                Astillero sin Costo
              </span>
              <DollarSign className="w-4 h-4 text-amber-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-amber-400">
                {kpiStats.sinCostoAstillero}
              </span>
              <span className="text-[10px] text-amber-300/70">personal propio</span>
            </div>
            <p className="text-[9px] text-amber-300/60 mt-1 truncate">Sin tarifa AR$/h asignada</p>
          </button>

          {/* KPI 3: Contratistas sin Costo (Cian Eléctrico) */}
          <button
            type="button"
            onClick={() => setKpiFilter(prev => prev === 'sin_costo_contratistas' ? null : 'sin_costo_contratistas')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              kpiFilter === 'sin_costo_contratistas'
                ? 'bg-cyan-950/60 border-cyan-500 ring-2 ring-cyan-400 shadow-lg shadow-cyan-950/50'
                : 'bg-cyan-950/25 border-cyan-500/50 hover:bg-cyan-950/40 hover:border-cyan-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-300">
                Contratistas sin Costo
              </span>
              <Building2 className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-cyan-400">
                {kpiStats.sinCostoContratistas}
              </span>
              <span className="text-[10px] text-cyan-300/70">cuadrillas</span>
            </div>
            <p className="text-[9px] text-cyan-300/60 mt-1 truncate">Sin valor AR$/h pactado</p>
          </button>

          {/* KPI 4: Contratistas sin Consumibles (Magenta / Fucsia) */}
          <button
            type="button"
            onClick={() => setKpiFilter(prev => prev === 'sin_consumibles_contratistas' ? null : 'sin_consumibles_contratistas')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              kpiFilter === 'sin_consumibles_contratistas'
                ? 'bg-fuchsia-950/60 border-fuchsia-500 ring-2 ring-fuchsia-400 shadow-lg shadow-fuchsia-950/50'
                : 'bg-fuchsia-950/25 border-fuchsia-500/50 hover:bg-fuchsia-950/40 hover:border-fuchsia-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-fuchsia-300">
                Sin Consumibles
              </span>
              <ShieldAlert className="w-4 h-4 text-fuchsia-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-fuchsia-400">
                {kpiStats.sinConsumiblesContratistas}
              </span>
              <span className="text-[10px] text-fuchsia-300/70">contratistas</span>
            </div>
            <p className="text-[9px] text-fuchsia-300/60 mt-1 truncate">Sin % ni imputación</p>
          </button>

          {/* KPI 5: Personal sin Permisos (Rojo Carmín / Bordo) */}
          <button
            type="button"
            onClick={() => setKpiFilter(prev => prev === 'sin_permisos' ? null : 'sin_permisos')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              kpiFilter === 'sin_permisos'
                ? 'bg-red-950/60 border-red-600 ring-2 ring-red-400 shadow-lg shadow-red-950/50'
                : 'bg-red-950/25 border-red-600/50 hover:bg-red-950/40 hover:border-red-500'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-300">
                Sin Permisos
              </span>
              <Lock className="w-4 h-4 text-red-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-red-400">
                {kpiStats.sinPermisos}
              </span>
              <span className="text-[10px] text-red-300/70">personal activo</span>
            </div>
            <p className="text-[9px] text-red-300/60 mt-1 truncate">Sin Pañol, Horas ni 3ros</p>
          </button>

          {/* KPI 6: Contratos Astillero próximos a vencerse <= 7 días */}
          <button
            type="button"
            onClick={() => setKpiFilter(prev => prev === 'contratos_por_vencer' ? null : 'contratos_por_vencer')}
            title="Filtra personal propio de Astillero con contrato temporal próximo a vencer (≤ 7 días) o ya vencido."
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
              kpiFilter === 'contratos_por_vencer'
                ? 'bg-orange-950/70 border-orange-400 ring-2 ring-orange-400 shadow-lg shadow-orange-950/50'
                : 'bg-orange-950/25 border-orange-500/50 hover:bg-orange-950/40 hover:border-orange-400'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-300">
                Contratos p/ Vencer
              </span>
              <Calendar className="w-4 h-4 text-orange-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black font-mono text-orange-400">
                {kpiStats.contratosPorVencer}
              </span>
              <span className="text-[10px] text-orange-300/70">aviso ≤ 7d</span>
            </div>
            <p className="text-[9px] text-orange-300/60 mt-1 truncate">Notifica a María José</p>
          </button>
        </div>
      </div>

      {/* SUBZONA 2: ESCALA SINDICAL DE REFERENCIA */}
      <div className="rounded-2xl p-4 bg-slate-900/60 border border-slate-800/80 shadow-md space-y-2.5">
        <div className="flex items-center justify-between text-[11px] text-slate-400 font-bold uppercase tracking-wider">
          <span className="flex items-center gap-1.5 text-slate-300">
            <Shield className="w-3.5 h-3.5 text-cyan-400" />
            <span>Tarifario Sindical de Referencia • Clic en una categoría para filtrar</span>
          </span>
          {kpiFilter?.startsWith('categoria_') && (
            <button
              type="button"
              onClick={() => setKpiFilter(null)}
              className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
            >
              ✕ Mostrar todas las categorías
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-center">
          {/* 1. Cotización Dólar Quincenal (Fijado) */}
          <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between shadow-sm">
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  VALOR US$ QUINCENAL
                </span>
                <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-900 text-slate-400 border border-slate-800 flex items-center gap-1" title="Dato congelado fijado por Administración Central">
                  <Lock className="w-2.5 h-2.5 text-amber-400" />
                  <span>Fijado</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-sm font-bold text-emerald-400 font-mono">$</span>
                <span className="font-mono text-base font-extrabold text-white">
                  {parseFloat(dollarRate).toLocaleString('es-AR')}
                </span>
                <span className="text-[10px] text-slate-500 font-sans ml-1">ARS / USD</span>
              </div>
            </div>
            <div className="w-9 h-9 rounded-lg bg-emerald-950/80 border border-emerald-800/60 flex items-center justify-center text-emerald-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          {/* 2. Tarifa Oficial Base */}
          <button
            type="button"
            onClick={() => setKpiFilter(prev => prev === 'categoria_OFICIAL' ? null : 'categoria_OFICIAL')}
            className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
              kpiFilter === 'categoria_OFICIAL'
                ? 'bg-emerald-950/60 border-emerald-500 ring-2 ring-emerald-400 shadow-lg'
                : 'bg-slate-950 border-emerald-900/40 hover:border-emerald-700/70 hover:bg-emerald-950/20'
            }`}
          >
            <div>
              <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                OFICIAL (Sindicato)
              </span>
              <div className="flex items-center gap-1.5 mt-1 font-mono font-extrabold text-white text-base">
                <span>${rateOficial.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded border ${getCategoryBadgeStyle('OFICIAL')}`}>
              {(rateOficial / dollarRate).toFixed(2)} USD
            </span>
          </button>

          {/* 3. Tarifa 1/2 Oficial */}
          <button
            type="button"
            onClick={() => setKpiFilter(prev => prev === 'categoria_1/2 OFICIAL' ? null : 'categoria_1/2 OFICIAL')}
            className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
              kpiFilter === 'categoria_1/2 OFICIAL'
                ? 'bg-pink-950/60 border-pink-500 ring-2 ring-pink-400 shadow-lg'
                : 'bg-slate-950 border-pink-900/40 hover:border-pink-700/70 hover:bg-pink-950/20'
            }`}
          >
            <div>
              <span className="text-[10px] uppercase font-bold text-pink-400 block tracking-wider">
                1/2 OFICIAL (Sindicato)
              </span>
              <div className="flex items-center gap-1.5 mt-1 font-mono font-extrabold text-white text-base">
                <span>${rateMedioOficial.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded border ${getCategoryBadgeStyle('1/2 OFICIAL')}`}>
              {(rateMedioOficial / dollarRate).toFixed(2)} USD
            </span>
          </button>

          {/* 4. Tarifa Ayudante Base */}
          <button
            type="button"
            onClick={() => setKpiFilter(prev => prev === 'categoria_AYUDANTE' ? null : 'categoria_AYUDANTE')}
            className={`p-3.5 rounded-xl border flex items-center justify-between text-left transition-all cursor-pointer ${
              kpiFilter === 'categoria_AYUDANTE'
                ? 'bg-cyan-950/60 border-cyan-500 ring-2 ring-cyan-400 shadow-lg'
                : 'bg-slate-950 border-cyan-900/40 hover:border-cyan-700/70 hover:bg-cyan-950/20'
            }`}
          >
            <div>
              <span className="text-[10px] uppercase font-bold text-cyan-400 block tracking-wider">
                AYUDANTE (Sindicato)
              </span>
              <div className="flex items-center gap-1.5 mt-1 font-mono font-extrabold text-white text-base">
                <span>${rateAyudante.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded border ${getCategoryBadgeStyle('AYUDANTE')}`}>
              {(rateAyudante / dollarRate).toFixed(2)} USD
            </span>
          </button>
        </div>
      </div>

      {/* ACCIONES Y BOTONES SUPERIORES */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGroupsView(!showGroupsView)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
              showGroupsView 
                ? 'bg-cyan-500 text-slate-950 border-cyan-400 shadow-md shadow-cyan-950/40' 
                : 'bg-slate-900 hover:bg-slate-800 text-cyan-300 border-cyan-800/60'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>{showGroupsView ? 'Ver Grilla Detallada de Personas' : `Ver por Grupos de Trabajo (${uniqueWorkGroups.length})`}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setRolesFormData(orgRoles)
              setIsRolesModalOpen(true)
            }}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Administrar Puestos y Titulares Organizacionales"
          >
            <Settings className="w-3.5 h-3.5 text-emerald-400" />
            <span>Puestos Organizacionales</span>
          </button>
        </div>

        <button
          type="button"
          onClick={handleOpenNew}
          className="px-4 py-2 bg-gradient-to-r from-primary to-blue-600 hover:brightness-110 text-slate-950 font-extrabold rounded-xl text-xs shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-2 cursor-pointer"
        >
          <Plus className="w-4 h-4 stroke-[3]" />
          <span>Cargar Operario / Contratista</span>
        </button>
      </div>

      {/* VISTA A: RESUMEN CONSOLIDADO POR GRUPO DE TRABAJO */}
      {showGroupsView && (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                Grupos de Trabajo & Contratistas Consolidados ({groupedSummary.length})
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Esta es la lista simplificada que aparece en los selectores de <strong>Horas</strong>, <strong>Pañol</strong> y <strong>Terceros</strong>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGroupsView(false)}
              className="text-xs text-slate-400 hover:text-white underline cursor-pointer"
            >
              Volver a la Grilla Detallada
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {groupedSummary.map(group => (
              <div 
                key={group.name}
                className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-all space-y-2.5"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-extrabold text-white text-sm">{group.name}</h3>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold border mt-1 inline-block ${
                      group.admin_center === 'ASTILLERO'
                        ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                        : group.admin_center === 'TALLER'
                        ? 'bg-purple-950 text-purple-300 border-purple-800'
                        : 'bg-amber-950 text-amber-300 border-amber-800'
                    }`}>
                      {group.admin_center}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800">
                    {group.activeWorkers} pers.
                  </span>
                </div>

                <div className="text-xs text-slate-400 space-y-1 pt-1 border-t border-slate-800/80">
                  <div className="flex justify-between">
                    <span>Rubro habitual:</span>
                    <strong className="text-slate-200">{group.trade || 'General'}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Tarifa promedio:</span>
                    <strong className="text-emerald-400 font-mono">${group.avgRateArs} ({group.avgRateUsd} USD)</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>Consumibles:</span>
                    <span className={`font-semibold ${group.consumables === 'CLIENTE' ? 'text-purple-400' : 'text-amber-400'}`}>
                      {group.consumables}
                    </span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterGroup(group.name)
                      setShowGroupsView(false)
                    }}
                    className="text-[11px] text-cyan-400 hover:text-cyan-300 font-bold underline cursor-pointer"
                  >
                    Ver sus {group.totalWorkers} integrantes &rarr;
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* BLOQUE OPERATIVO UNIFICADO: ZONA 3 + ZONA 4 (PADRÓN NÓMINA) */}
      <div className="alon-workspace-block">
        {/* ZONA 3 (BÚSQUEDA Y FILTROS): BARRA DE CONTROL DEL PADRÓN */}
        <div className="alon-zone-toolbar p-3 rounded-2xl shadow-lg space-y-3">
          <CrawlerSearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            onClear={clearAllFilters}
            inputRef={nominaSearchInputRef}
            placeholder="Buscar por operario, grupo, rubro, DNI, valor hora US$/AR$... (Ctrl+F | Esc limpia todo)"
          />

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => { setFilterCenter('todos'); setFilterGroup('todos') }}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterCenter === 'todos' && filterGroup === 'todos'
                    ? 'bg-primary text-slate-950 font-bold'
                    : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                }`}
              >
                Todos ({totalCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterCenter('ASTILLERO')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterCenter === 'ASTILLERO'
                    ? 'bg-cyan-500 text-slate-950 font-bold'
                    : 'bg-slate-950 text-cyan-400 hover:text-cyan-300 border border-slate-800'
                }`}
              >
                Astillero Propio ({astilleroCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterCenter('CONTRATISTA')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterCenter === 'CONTRATISTA'
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-950 text-amber-400 hover:text-amber-300 border border-slate-800'
                }`}
              >
                Contratistas ({contratistasCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterCenter('TALLER')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterCenter === 'TALLER'
                    ? 'bg-purple-500 text-slate-950 font-bold'
                    : 'bg-slate-950 text-purple-400 hover:text-purple-300 border border-slate-800'
                }`}
              >
                Talleres ({talleresCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterForemanOnly(!filterForemanOnly)}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterForemanOnly
                    ? 'bg-amber-500 text-slate-950 font-bold'
                    : 'bg-slate-950 text-amber-300 hover:text-amber-200 border border-amber-900/50'
                }`}
                title="Filtrar solo Jefes de Obra habilitados para Órdenes de Trabajo"
              >
                👷 Jefes de Obra ({foremenCount})
              </button>

              <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>

              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'ACTIVO' ? 'todos' : 'ACTIVO')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterStatus === 'ACTIVO'
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-950 text-emerald-400 border border-emerald-900/40'
                }`}
              >
                Solo Activos 🟢 ({activeCount})
              </button>

              <button
                type="button"
                onClick={() => setFilterStatus(filterStatus === 'INACTIVO' ? 'todos' : 'INACTIVO')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  filterStatus === 'INACTIVO'
                    ? 'bg-rose-600 text-white font-bold'
                    : 'bg-slate-950 text-rose-400 border border-rose-900/40'
                }`}
              >
                Inactivos 🔴 ({inactiveCount})
              </button>

              {filterGroup !== 'todos' && (
                <div className="flex items-center gap-1.5 bg-cyan-950 text-cyan-300 border border-cyan-800 px-2.5 py-1 rounded-lg">
                  <span>Grupo: <strong>{filterGroup}</strong></span>
                  <button
                    type="button"
                    onClick={() => setFilterGroup('todos')}
                    className="text-cyan-400 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-800 rounded-lg p-1">
              <button
                type="button"
                disabled={!nominaGrid.canUndo}
                onClick={nominaGrid.undo}
                className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Deshacer cambio en Padrón (Ctrl + Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!nominaGrid.canRedo}
                onClick={nominaGrid.redo}
                className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                title="Rehacer cambio en Padrón (Ctrl + Y)"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Datalists auxiliares */}
        <datalist id="nomina-categories-list">
          {ASTILLERO_BASE_CATEGORIES.map(cat => (
            <option key={cat} value={cat} />
          ))}
        </datalist>
        <datalist id="nomina-trades-list">
          {uniqueTrades.map(tr => (
            <option key={tr} value={tr} />
          ))}
        </datalist>
        <datalist id="nomina-groups-list">
          <option value="ASTILLERO" />
          {groupedSummary.map(g => (
            <option key={g.name} value={g.name} />
          ))}
        </datalist>

        {/* ZONA 4 (PLANILLA EDITABLE): TABLA MAESTRA DE PADRÓN */}
        <div
          ref={nominaGrid.gridContainerRef}
          tabIndex={0}
          onKeyDown={nominaGrid.handleKeyDown}
          className="alon-zone-grid rounded-2xl shadow-xl overflow-hidden focus:outline-none"
        >
          <GridRibbon
            activeCellBadge={nominaGrid.activeCellBadge || 'PADRÓN OPERATIVO'}
            onInsertRow={handleOpenNew}
            insertRowLabel="Cargar Operario / Contratista"
            undoCount={nominaGrid.undoStack?.length || 0}
            totalRows={filteredWorkers.length}
            entityName="operarios"
            exportRows={filteredWorkers}
            exportFilename={`personal_padron_${new Date().toISOString().split('T')[0]}`}
          />

          <div className="alon-grid-scroll">
            <table className="w-full text-left text-xs text-slate-300">
              <thead className="sticky top-0 z-20 alon-grid-thead text-[10px] uppercase font-bold text-slate-300 shadow-sm backdrop-blur-md">
                <tr>
                  <th className="py-2 px-1 text-center w-8 select-none">
                    <div className="flex flex-col items-center justify-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => nominaGrid.toggleSelectAll(filteredWorkers.map(w => w.id))}
                        className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                        title="Seleccionar todas las filas visibles"
                      >
                        {nominaGrid.selectedRowIds.size > 0 && nominaGrid.selectedRowIds.size === filteredWorkers.length ? (
                          <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                        ) : (
                          <Square className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <span className="font-mono text-[9px] text-slate-500 font-bold">#</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3">Nombre y Apellido ✎</th>
                  <th className="py-2.5 px-3 text-center">Categoría ✎</th>
                  <th className="py-2.5 px-3">Rubro ✎</th>
                  <th className="py-2.5 px-3 text-right">AR$/Hora ✎</th>
                  <th className="py-2.5 px-2 text-center text-emerald-400">U$/Hora</th>
                  <th className="py-2.5 px-3">Grupo de Trabajo ✎</th>
                  <th className="py-2.5 px-2.5">Centro Admin ✎</th>
                  <th className="py-2.5 px-2.5">Contrato</th>
                  <th className="py-2.5 px-2 text-center">Estado</th>
                  <th className="py-2.5 px-2.5">Consumibles</th>
                  <th className="py-2.5 px-2.5">
                    <div className="relative group inline-flex items-center gap-1 cursor-help">
                      <span>Elem. Seg. ✎</span>
                      <HelpCircle className="w-3.5 h-3.5 text-cyan-400" />
                      <div className="opacity-0 invisible group-hover:opacity-100 group-hover:visible pointer-events-none transition-all duration-150 absolute top-full right-0 mt-1.5 w-80 p-3 rounded-xl bg-slate-900 border border-cyan-500/40 shadow-2xl z-50 text-left font-normal normal-case tracking-normal text-[11px] leading-relaxed text-slate-200">
                        <div className="font-black text-cyan-300 mb-1 uppercase text-[10px]">
                          Regla Unificada: Elementos de Seguridad (EPP)
                        </div>
                        <p>{SAFETY_ITEMS_HELP_TEXT}</p>
                      </div>
                    </div>
                  </th>
                  <th className="py-2.5 px-2 text-center">Permisos</th>
                  <th className="py-2.5 px-3 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {filteredWorkers.length === 0 ? (
                  <tr>
                    <td colSpan={14} className="py-10 text-center text-slate-500">
                      No se encontraron registros que coincidan con la búsqueda.
                    </td>
                  </tr>
                ) : (
                  filteredWorkers.map((w, rowIndex) => {
                    const isActivo = w.status === 'ACTIVO'
                    const usdCalc = dollarRate > 0 && w.hourly_rate_ars ? (w.hourly_rate_ars / dollarRate).toFixed(2) : (w.hourly_rate_usd || 0)

                    const getCellClass = (colIdx, baseClass = '') => {
                      const active = nominaGrid.isCellActive(rowIndex, colIdx)
                      const fill = nominaGrid.isCellInFillPreview(rowIndex, colIdx)
                      const sel = nominaGrid.isCellSelected(rowIndex, colIdx)
                      return `${baseClass} relative cursor-cell ${
                        active ? 'ring-2 ring-inset ring-emerald-400 bg-emerald-950/30' :
                        fill ? 'bg-emerald-500/20 ring-1 ring-inset ring-emerald-400/60' :
                        sel ? 'bg-cyan-500/15' : ''
                      }`
                    }

                    const isEditingCell = (colKey) =>
                      Boolean(inlineCellEdit && inlineCellEdit.rowId === w.id && inlineCellEdit.colKey === colKey)

                    const isRowSelected = nominaGrid.isRowSelected(w.id)

                    return (
                      <tr
                        key={w.id}
                        onContextMenu={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          if (nominaGrid.activeCell?.rowIndex !== rowIndex) {
                            nominaGrid.setActiveCell({ rowIndex, colIndex: nominaGrid.activeCell?.colIndex ?? 0 })
                            nominaGrid.setSelectionRange?.(null)
                          }
                          setContextMenuTarget({
                            row: w,
                            rowIndex,
                            x: e.clientX,
                            y: e.clientY,
                            isRowHeader: false,
                            entityType: 'workers',
                            recordId: w.id,
                            recordLabel: w.name
                          })
                        }}
                        className={`group transition-colors select-none ${
                          isRowSelected
                            ? 'bg-cyan-950/35 hover:bg-cyan-950/45 text-cyan-200'
                            : !isActivo
                            ? 'opacity-60 bg-rose-950/5 hover:bg-slate-800/40'
                            : 'hover:bg-slate-800/40'
                        }`}
                      >
                        {/* Col 0: Checkbox + Número Ordinal (#) Canónico */}
                        <td className="py-1 px-1 text-center w-8 select-none relative">
                          <div className="flex flex-col items-center justify-center gap-0.5">
                            <button
                              type="button"
                              onClick={() => nominaGrid.toggleSelectRow(w.id)}
                              className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                            >
                              {isRowSelected ? (
                                <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                              ) : (
                                <Square className="w-3.5 h-3.5" />
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setContextMenuTarget(
                                  contextMenuTarget?.recordId === w.id
                                    ? null
                                    : {
                                        row: w,
                                        rowIndex,
                                        x: e.clientX,
                                        y: e.clientY,
                                        isRowHeader: true,
                                        entityType: 'workers',
                                        recordId: w.id,
                                        recordLabel: w.name
                                      }
                                )
                              }}
                              className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded transition-all cursor-pointer hover:bg-cyan-950/90 hover:text-cyan-300 hover:ring-1 hover:ring-cyan-500/60 ${
                                isRowSelected ? 'text-cyan-300' : 'text-slate-500 group-hover:text-cyan-400'
                              }`}
                              title={`Fila #${w._rowSeq || rowIndex + 1} • Clic para menú contextual`}
                            >
                              {w._rowSeq || rowIndex + 1}
                            </button>
                          </div>
                        </td>

                        {/* Col 1: Nombre y Apellido */}
                        <td
                          onClick={(e) => nominaGrid.handleCellClick(rowIndex, 0, e)}
                          onMouseDown={(e) => nominaGrid.handleCellMouseDown(rowIndex, 0, e)}
                          onMouseEnter={() => nominaGrid.handleCellMouseEnter(rowIndex, 0)}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            setInlineCellEdit({ rowId: w.id, colKey: 'name', value: w.name || '' })
                          }}
                          title="Doble clic para editar nombre"
                          className={getCellClass(0, 'py-2 px-3')}
                        >
                          {isEditingCell('name') ? (
                            <input
                              type="text"
                              autoFocus
                              value={inlineCellEdit.value}
                              onChange={(e) => setInlineCellEdit(prev => ({ ...prev, value: e.target.value }))}
                              onBlur={() => commitInlineWorkerEdit()}
                              onKeyDown={(e) => {
                                e.stopPropagation()
                                if (e.key === 'Enter') commitInlineWorkerEdit()
                                if (e.key === 'Escape') setInlineCellEdit(null)
                              }}
                              className="w-full min-w-[140px] bg-slate-950 border border-emerald-400 rounded px-2 py-0.5 text-xs text-white font-bold focus:outline-none"
                            />
                          ) : (
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-white">
                                <HighlightText text={w.name} query={searchTerm} />
                              </span>
                              {w.is_foreman && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600 font-extrabold">
                                  👷 Jefe de Obra
                                </span>
                              )}
                              {w.phone && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800 font-mono flex items-center gap-1" title={`WhatsApp / Móvil: ${w.phone}`}>
                                  <Phone className="w-2.5 h-2.5" />
                                  <span>
                                    <HighlightText text={w.phone} query={searchTerm} />
                                  </span>
                                </span>
                              )}
                            </div>
                          )}
                          {nominaGrid.shouldRenderFillHandle(rowIndex, 0) && (
                            <div
                              onMouseDown={nominaGrid.handleFillHandleMouseDown}
                              onDoubleClick={nominaGrid.handleFillHandleDoubleClick}
                              className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
                            />
                          )}
                        </td>

                        {/* Col 2: Categoría */}
                        <td
                          onClick={(e) => nominaGrid.handleCellClick(rowIndex, 1, e)}
                          onMouseDown={(e) => nominaGrid.handleCellMouseDown(rowIndex, 1, e)}
                          onMouseEnter={() => nominaGrid.handleCellMouseEnter(rowIndex, 1)}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            setInlineCellEdit({ rowId: w.id, colKey: 'category', value: w.category || '' })
                          }}
                          title="Doble clic para editar categoría"
                          className={getCellClass(1, 'py-2 px-3 text-center')}
                        >
                          {isEditingCell('category') ? (
                            w.admin_center === 'ASTILLERO' ? (
                              <select
                                autoFocus
                                value={inlineCellEdit.value}
                                onChange={(e) => {
                                  const nextVal = e.target.value
                                  setInlineCellEdit(prev => ({ ...prev, value: nextVal }))
                                }}
                                onBlur={() => commitInlineWorkerEdit()}
                                onKeyDown={(e) => {
                                  e.stopPropagation()
                                  if (e.key === 'Enter') commitInlineWorkerEdit()
                                  if (e.key === 'Escape') setInlineCellEdit(null)
                                }}
                                className="bg-slate-950 border border-emerald-400 rounded px-1.5 py-0.5 text-[11px] text-white font-bold focus:outline-none"
                              >
                                {ASTILLERO_BASE_CATEGORIES.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                type="text"
                                list="nomina-categories-list"
                                autoFocus
                                value={inlineCellEdit.value}
                                onChange={(e) => setInlineCellEdit(prev => ({ ...prev, value: e.target.value }))}
                                onBlur={() => commitInlineWorkerEdit()}
                                onKeyDown={(e) => {
                                  e.stopPropagation()
                                  if (e.key === 'Enter') commitInlineWorkerEdit()
                                  if (e.key === 'Escape') setInlineCellEdit(null)
                                }}
                                className="w-28 bg-slate-950 border border-emerald-400 rounded px-2 py-0.5 text-center text-[11px] text-white font-bold focus:outline-none"
                              />
                            )
                          ) : w.category ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] uppercase border inline-block ${getCategoryBadgeStyle(w.category)}`}>
                              <HighlightText text={w.category} query={searchTerm} />
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                          {nominaGrid.shouldRenderFillHandle(rowIndex, 1) && (
                            <div
                              onMouseDown={nominaGrid.handleFillHandleMouseDown}
                              onDoubleClick={nominaGrid.handleFillHandleDoubleClick}
                              className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
                            />
                          )}
                        </td>

                        {/* Col 3: Rubro */}
                        <td
                          onClick={(e) => nominaGrid.handleCellClick(rowIndex, 2, e)}
                          onMouseDown={(e) => nominaGrid.handleCellMouseDown(rowIndex, 2, e)}
                          onMouseEnter={() => nominaGrid.handleCellMouseEnter(rowIndex, 2)}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            setInlineCellEdit({ rowId: w.id, colKey: 'trade', value: w.trade || '' })
                          }}
                          title="Doble clic para seleccionar o agregar rubro"
                          className={getCellClass(2, 'py-2 px-3')}
                        >
                          {isEditingCell('trade') ? (
                            <select
                              autoFocus
                              value={inlineCellEdit.value}
                              onChange={(e) => {
                                const val = e.target.value
                                if (val === '__ADD_NEW_TRADE__') {
                                  setTargetWorkerForNewTrade(w)
                                  setNewTradeInput('')
                                  setIsAddTradeModalOpen(true)
                                  return
                                }
                                setInlineCellEdit(prev => ({ ...prev, value: val }))
                                commitInlineWorkerEdit(val)
                              }}
                              onBlur={() => commitInlineWorkerEdit()}
                              onKeyDown={(e) => {
                                e.stopPropagation()
                                if (e.key === 'Escape') setInlineCellEdit(null)
                              }}
                              className="bg-slate-950 border border-emerald-400 rounded px-2 py-1 text-xs text-white font-bold focus:outline-none w-full min-w-[140px]"
                            >
                              <option value="" className="bg-slate-950 text-slate-400">-- Seleccionar Rubro --</option>
                              {uniqueTrades.map(tr => (
                                <option key={tr} value={tr} className="bg-slate-950 text-white font-bold">
                                  {tr}
                                </option>
                              ))}
                              <option value="__ADD_NEW_TRADE__" className="bg-slate-900 text-cyan-400 font-bold">
                                ➕ Agregar nuevo rubro...
                              </option>
                            </select>
                          ) : (
                            <div className="flex flex-wrap items-center gap-1">
                              {String(w.trade || 'General')
                                .split(/[,;/|]+/)
                                .map(s => s.trim())
                                .filter(Boolean)
                                .map((tr, tIdx) => (
                                  <span
                                    key={`${w.id}-tr-${tIdx}`}
                                    className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRubroBadgeColor(tr)}`}
                                    title={tIdx === 0 ? 'Rubro Principal' : 'Rubro Secundario Habilitado'}
                                  >
                                    {tIdx === 0 && String(w.trade || '').includes(',') ? '⭐ ' : ''}
                                    <HighlightText text={tr} query={searchTerm} />
                                  </span>
                                ))}
                            </div>
                          )}
                          {nominaGrid.shouldRenderFillHandle(rowIndex, 2) && (
                            <div
                              onMouseDown={nominaGrid.handleFillHandleMouseDown}
                              onDoubleClick={nominaGrid.handleFillHandleDoubleClick}
                              className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
                            />
                          )}
                        </td>

                        {/* Col 4: AR$/Hora */}
                        <td
                          onClick={(e) => nominaGrid.handleCellClick(rowIndex, 3, e)}
                          onMouseDown={(e) => nominaGrid.handleCellMouseDown(rowIndex, 3, e)}
                          onMouseEnter={() => nominaGrid.handleCellMouseEnter(rowIndex, 3)}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            setInlineCellEdit({ rowId: w.id, colKey: 'hourly_rate_ars', value: w.hourly_rate_ars ?? 0 })
                          }}
                          title="Doble clic para editar tarifa AR$/Hora"
                          className={getCellClass(3, 'py-2 px-3 text-right font-mono font-bold text-white')}
                        >
                          {isEditingCell('hourly_rate_ars') ? (
                            <input
                              type="number"
                              step="50"
                              min="0"
                              autoFocus
                              value={inlineCellEdit.value}
                              onChange={(e) => setInlineCellEdit(prev => ({ ...prev, value: e.target.value }))}
                              onBlur={() => commitInlineWorkerEdit()}
                              onKeyDown={(e) => {
                                e.stopPropagation()
                                if (e.key === 'Enter') commitInlineWorkerEdit()
                                if (e.key === 'Escape') setInlineCellEdit(null)
                              }}
                              className="w-24 bg-slate-950 border border-emerald-400 rounded px-2 py-0.5 text-right text-xs text-white font-mono focus:outline-none"
                            />
                          ) : w.hourly_rate_ars > 0 ? (
                            <span>$<HighlightText text={parseFloat(w.hourly_rate_ars).toLocaleString('es-AR')} query={searchTerm} /></span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                          {nominaGrid.shouldRenderFillHandle(rowIndex, 3) && (
                            <div
                              onMouseDown={nominaGrid.handleFillHandleMouseDown}
                              onDoubleClick={nominaGrid.handleFillHandleDoubleClick}
                              className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
                            />
                          )}
                        </td>

                        {/* U$/Hora */}
                        <td className="py-2 px-2 text-center font-mono font-extrabold text-emerald-400">
                          $<HighlightText text={String(usdCalc)} query={searchTerm} />
                        </td>

                        {/* Col 5: Grupo de Trabajo */}
                        <td
                          onClick={(e) => nominaGrid.handleCellClick(rowIndex, 4, e)}
                          onMouseDown={(e) => nominaGrid.handleCellMouseDown(rowIndex, 4, e)}
                          onMouseEnter={() => nominaGrid.handleCellMouseEnter(rowIndex, 4)}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            setInlineCellEdit({ rowId: w.id, colKey: 'work_group', value: w.work_group || '' })
                          }}
                          title="Doble clic para editar Grupo de Trabajo"
                          className={getCellClass(4, 'py-2 px-3')}
                        >
                          {isEditingCell('work_group') ? (
                            <input
                              type="text"
                              list="nomina-groups-list"
                              autoFocus
                              value={inlineCellEdit.value}
                              onChange={(e) => setInlineCellEdit(prev => ({ ...prev, value: e.target.value }))}
                              onBlur={() => commitInlineWorkerEdit()}
                              onKeyDown={(e) => {
                                e.stopPropagation()
                                if (e.key === 'Enter') commitInlineWorkerEdit()
                                if (e.key === 'Escape') setInlineCellEdit(null)
                              }}
                              className="w-32 bg-slate-950 border border-emerald-400 rounded px-2 py-0.5 text-[11px] text-cyan-300 font-mono font-bold focus:outline-none"
                            />
                          ) : (
                            <span className="font-mono text-cyan-300 font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                              <HighlightText text={w.work_group} query={searchTerm} />
                            </span>
                          )}
                          {nominaGrid.shouldRenderFillHandle(rowIndex, 4) && (
                            <div
                              onMouseDown={nominaGrid.handleFillHandleMouseDown}
                              onDoubleClick={nominaGrid.handleFillHandleDoubleClick}
                              className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
                            />
                          )}
                        </td>

                        {/* Col 6: Centro Admin */}
                        <td
                          onClick={(e) => nominaGrid.handleCellClick(rowIndex, 5, e)}
                          onMouseDown={(e) => nominaGrid.handleCellMouseDown(rowIndex, 5, e)}
                          onMouseEnter={() => nominaGrid.handleCellMouseEnter(rowIndex, 5)}
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            setInlineCellEdit({ rowId: w.id, colKey: 'admin_center', value: w.admin_center || 'ASTILLERO' })
                          }}
                          title="Doble clic para cambiar Centro Administrativo"
                          className={getCellClass(5, 'py-2 px-2.5')}
                        >
                          {isEditingCell('admin_center') ? (
                            <select
                              autoFocus
                              value={inlineCellEdit.value}
                              onChange={(e) => setInlineCellEdit(prev => ({ ...prev, value: e.target.value }))}
                              onBlur={() => commitInlineWorkerEdit()}
                              onKeyDown={(e) => {
                                e.stopPropagation()
                                if (e.key === 'Enter') commitInlineWorkerEdit()
                                if (e.key === 'Escape') setInlineCellEdit(null)
                              }}
                              className="bg-slate-950 border border-emerald-400 rounded px-1.5 py-0.5 text-[10px] text-white font-bold focus:outline-none"
                            >
                              <option value="ASTILLERO">ASTILLERO</option>
                              <option value="CONTRATISTA">CONTRATISTA</option>
                              <option value="TALLER">TALLER</option>
                            </select>
                          ) : (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                              w.admin_center === 'ASTILLERO'
                                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60'
                                : w.admin_center === 'TALLER'
                                ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                                : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                            }`}>
                              <HighlightText text={w.admin_center} query={searchTerm} />
                            </span>
                          )}
                          {nominaGrid.shouldRenderFillHandle(rowIndex, 5) && (
                            <div
                              onMouseDown={nominaGrid.handleFillHandleMouseDown}
                              onDoubleClick={nominaGrid.handleFillHandleDoubleClick}
                              className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
                            />
                          )}
                        </td>

                        {/* Contrato (solo Astillero) */}
                        <td className="py-2 px-2.5 text-[10px]">
                          {w.admin_center === 'ASTILLERO' ? (() => {
                            const exp = computeContractExpiration(w.contract_type, w.contract_start_date)
                            if (!exp.hasContract) {
                              return <span className="text-slate-500 italic">Sin definir</span>
                            }
                            if (exp.isPermanent) {
                              return (
                                <span className="px-1.5 py-0.5 rounded bg-emerald-950/70 text-emerald-300 border border-emerald-800 font-bold">
                                  PERMANENTE
                                </span>
                              )
                            }
                            return (
                              <div className="space-y-0.5" title={exp.expiresIso ? `Inicio: ${w.contract_start_date || '—'} · Vence: ${exp.expiresIso}` : 'Falta fecha de inicio'}>
                                <span className={`px-1.5 py-0.5 rounded font-bold border inline-block ${
                                  exp.isExpired
                                    ? 'bg-rose-950 text-rose-300 border-rose-600'
                                    : exp.isExpiringSoon
                                    ? 'bg-orange-950 text-orange-300 border-orange-500'
                                    : 'bg-cyan-950/70 text-cyan-300 border-cyan-800'
                                }`}>
                                  {exp.contractType}
                                </span>
                                {exp.expiresIso && (
                                  <div className={`text-[9px] font-mono ${exp.needsAttention ? 'text-orange-300 font-bold' : 'text-slate-400'}`}>
                                    {exp.isExpired ? 'VENCIDO' : `${exp.daysRemaining}d`} · {exp.expiresIso.slice(5)}
                                  </div>
                                )}
                              </div>
                            )
                          })() : (
                            <span className="text-slate-600">—</span>
                          )}
                        </td>

                        {/* Estado */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => toggleWorkerStatus(w)}
                            className={`text-[9px] px-2 py-0.5 rounded font-bold border transition-all cursor-pointer ${
                              isActivo
                                ? 'bg-emerald-950 text-emerald-300 border-emerald-600 hover:bg-emerald-900'
                                : 'bg-rose-950 text-rose-300 border-rose-600 hover:bg-rose-900'
                            }`}
                            title="Hacé clic para alternar estado Activo/Inactivo"
                          >
                            {isActivo ? 'ACTIVO' : 'INACTIVO'}
                          </button>
                        </td>

                        {/* Consumibles */}
                        <td className="py-2 px-2.5">
                          {w.consumables_discount_pct !== undefined && w.consumables_discount_pct !== null ? (
                            <span 
                              title={`Descuento Contratista: ${w.consumables_discount_pct}% | Imputación Obra: ${100 - Number(w.consumables_discount_pct)}%`}
                              className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                                Number(w.consumables_discount_pct) === 0
                                  ? 'bg-purple-950 text-purple-300 border-purple-800'
                                  : Number(w.consumables_discount_pct) === 100
                                  ? 'bg-amber-950 text-amber-300 border-amber-800'
                                  : 'bg-blue-950 text-blue-300 border-blue-800'
                              }`}
                            >
                              {Number(w.consumables_discount_pct) === 0
                                ? '0% (OBRA)'
                                : Number(w.consumables_discount_pct) === 100
                                ? '100% (CONT.)'
                                : `${w.consumables_discount_pct}% CONT.`}
                            </span>
                          ) : (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                              w.consumables === 'CLIENTE'
                                ? 'bg-purple-950 text-purple-300 border-purple-800'
                                : 'bg-amber-950 text-amber-300 border-amber-800'
                            }`}>
                              {w.consumables || 'CLIENTE'}
                            </span>
                          )}
                        </td>

                        {/* Elem. Seg. */}
                        <td
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            if (w.admin_center === 'ASTILLERO') return
                            setInlineCellEdit({ rowId: w.id, colKey: 'safety_items', value: w.safety_items || 'CONTRATISTA' })
                          }}
                          title={w.admin_center === 'ASTILLERO' ? 'Personal propio de Astillero: siempre ASTILLERO (solo costo de referencia).' : `Doble clic para definir si descuenta EPP (CONTRATISTA) o es excepción de zona gris (ASTILLERO).\n${SAFETY_ITEMS_HELP_TEXT}`}
                          className={getCellClass(6, 'py-2 px-2.5')}
                        >
                          {isEditingCell('safety_items') ? (
                            <select
                              autoFocus
                              value={inlineCellEdit.value}
                              onChange={(e) => setInlineCellEdit(prev => ({ ...prev, value: e.target.value }))}
                              onBlur={() => commitInlineWorkerEdit()}
                              onKeyDown={(e) => {
                                e.stopPropagation()
                                if (e.key === 'Enter') commitInlineWorkerEdit()
                                if (e.key === 'Escape') setInlineCellEdit(null)
                              }}
                              className="bg-slate-950 border border-emerald-400 rounded px-1.5 py-0.5 text-[10px] text-white font-bold focus:outline-none"
                            >
                              {SAFETY_ITEMS_OPTIONS.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                              ))}
                            </select>
                          ) : (
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                              w.safety_items === 'ASTILLERO'
                                ? 'bg-cyan-950 text-cyan-300 border-cyan-700'
                                : 'bg-amber-950 text-amber-300 border-amber-800'
                            }`}>
                              {w.safety_items === 'ASTILLERO' && w.admin_center !== 'ASTILLERO'
                                ? 'ASTILLERO (Z.Gris)'
                                : (w.safety_items || 'CONTRATISTA')}
                            </span>
                          )}
                        </td>

                        {/* Permisos */}
                        <td className="py-2 px-2 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => toggleWorkerPermission(w, 'P')}
                              className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black transition-all cursor-pointer ${
                                w.can_withdraw_materials
                                  ? 'bg-emerald-950 text-emerald-400 border border-emerald-600 hover:bg-emerald-900 shadow-sm'
                                  : 'bg-slate-900 text-slate-500 border border-slate-800 hover:bg-slate-800 hover:text-slate-400 line-through'
                              }`}
                              title={w.can_withdraw_materials ? 'Habilitado para retirar de Pañol (P). Clic para deshabilitar.' : 'Deshabilitado para Pañol (P). Clic para habilitar.'}
                            >
                              P
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleWorkerPermission(w, 'H')}
                              className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-black transition-all cursor-pointer ${
                                w.can_impute_hours
                                  ? 'bg-cyan-950 text-cyan-400 border border-cyan-600 hover:bg-cyan-900 shadow-sm'
                                  : 'bg-slate-900 text-slate-500 border border-slate-800 hover:bg-slate-800 hover:text-slate-400 line-through'
                              }`}
                              title={w.can_impute_hours ? 'Habilitado para imputar Horas (H). Clic para deshabilitar.' : 'Deshabilitado para Horas (H). Clic para habilitar.'}
                            >
                              H
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleWorkerPermission(w, '3ros')}
                              className={`px-1.5 h-5 rounded flex items-center justify-center text-[10px] font-black transition-all cursor-pointer ${
                                w.can_charge_third_party
                                  ? 'bg-purple-950 text-purple-300 border border-purple-500 hover:bg-purple-900 shadow-sm'
                                  : 'bg-slate-900 text-slate-500 border border-slate-800 hover:bg-slate-800 hover:text-slate-400 line-through'
                              }`}
                              title={w.can_charge_third_party ? 'Habilitado para Terceros / Presupuestos (3ros). Clic para deshabilitar.' : 'Deshabilitado para Terceros (3ros). Clic para habilitar.'}
                            >
                              3ros
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleWorkerPermission(w, 'JO')}
                              className={`px-1 h-5 rounded flex items-center justify-center text-[9px] font-black transition-all cursor-pointer ${
                                w.is_foreman
                                  ? 'bg-amber-950 text-amber-300 border border-amber-500 hover:bg-amber-900 shadow-sm'
                                  : 'bg-slate-900 text-slate-600 border border-slate-800 hover:bg-slate-800 hover:text-slate-400'
                              }`}
                              title={w.is_foreman ? 'Jefe de Obra habilitado en Órdenes de Trabajo (JO). Clic para desmarcar.' : 'Marcar como Jefe de Obra (JO) para Órdenes de Trabajo.'}
                            >
                              JO
                            </button>
                          </div>
                        </td>

                        {/* Acciones */}
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleEdit(w)}
                              className="p-1 text-slate-400 hover:text-primary rounded hover:bg-slate-800 transition-colors cursor-pointer"
                              title="Editar operario"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDuplicateWorkerRow(w)}
                              className="p-1 text-amber-400 hover:text-amber-300 rounded hover:bg-amber-500/10 transition-colors cursor-pointer"
                              title="Duplicar fila"
                            >
                              <CopyPlus className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDelete(w)}
                              className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-rose-500/10 transition-colors cursor-pointer"
                              title="Eliminar de la nómina"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* BARRA INFERIOR FLOTANTE ESTANDARIZADA */}
      <GridStatusBarBottom
        filteredCount={filteredWorkers.length}
        totalCount={workers.length}
        entityName="operarios"
        hasActiveFilter={hasActiveFilters}
        onClearFilters={clearAllFilters}
        selectionStats={nominaGrid.selectionStats}
        onClearSelection={() => nominaGrid.setSelectionRange(null)}
        customSelection={
          nominaGrid.selectedRowIds.size > 0
            ? {
                count: nominaGrid.selectedRowIds.size,
                label: `${nominaGrid.selectedRowIds.size} operario(s) seleccionado(s)`,
                onClear: nominaGrid.clearSelectedRows
              }
            : null
        }
        extraActions={
          nominaGrid.selectedRowIds.size > 0 ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleBatchToggleStatus}
                className="px-2.5 py-1 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>Cambiar Estado (Activo/Inactivo)</span>
              </button>
              <button
                type="button"
                onClick={handleBatchDeleteWorkers}
                className="px-2.5 py-1 rounded-lg bg-rose-950 hover:bg-rose-900 border border-rose-500/60 text-rose-300 font-bold text-[11px] flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>Eliminar Selección</span>
              </button>
            </div>
          ) : null
        }
        globalAggregates={[
          { label: 'Activos', value: activeCount, highlight: true },
          { label: 'Astillero', value: astilleroCount },
          { label: 'Contratistas', value: contratistasCount },
          { label: 'Jefes Obra', value: foremenCount },
        ]}
      />

      {/* MODAL ÁGIL: AGREGAR NUEVO RUBRO OPERATIVO */}
      {isAddTradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800">
                  <Briefcase className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Agregar Nuevo Rubro Operativo</h3>
                  <p className="text-[11px] text-slate-400">Se estandarizará automáticamente en mayúsculas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTradeModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const cleaned = newTradeInput.trim().toUpperCase()
                if (!cleaned) {
                  alert('Por favor ingresá el nombre del rubro.')
                  return
                }
                setCustomTrades(prev => Array.from(new Set([...prev, cleaned])))
                if (targetWorkerForNewTrade) {
                  await applyWorkerSinglePatch(targetWorkerForNewTrade.id, 'trade', cleaned)
                  showGridFeedback('success', `Rubro "${cleaned}" asignado a ${targetWorkerForNewTrade.name}`)
                }
                setIsAddTradeModalOpen(false)
                setNewTradeInput('')
                setTargetWorkerForNewTrade(null)
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nombre del Rubro
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Ej: HIDRAULICA NAVAL, CALDERERIA PESADA"
                  value={newTradeInput}
                  onChange={(e) => setNewTradeInput(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-cyan-500 rounded-xl px-3 py-2 text-sm font-bold text-white uppercase focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                />
              </div>

              {newTradeInput.trim() && (
                <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/60 text-[11px] text-cyan-300">
                  Vista previa estandarizada: <strong>{newTradeInput.trim().toUpperCase()}</strong>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddTradeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-primary to-blue-500 hover:brightness-110 shadow-md cursor-pointer"
                >
                  Guardar Rubro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE PUESTOS Y TITULARES (ORGANIZATION ROLES) */}
      {isRolesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-400" />
                  Administrar Puestos y Titulares Organizacionales
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Modificá los nombres de las personas a cargo sin generar deuda técnica ni alterar el código.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRolesModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRolesSubmit} className="space-y-4">
              {Object.entries(rolesFormData).map(([key, item]) => (
                <div key={key} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider block">
                    {key}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">
                        Nombre Técnico del Puesto
                      </label>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => {
                          const val = e.target.value
                          setRolesFormData(prev => ({
                            ...prev,
                            [key]: { ...prev[key], title: val }
                          }))
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-emerald-400 font-bold mb-1">
                        Persona Titular
                      </label>
                      <input
                        type="text"
                        value={item.holder}
                        onChange={(e) => {
                          const val = e.target.value
                          setRolesFormData(prev => ({
                            ...prev,
                            [key]: { ...prev[key], holder: val }
                          }))
                        }}
                        className="w-full bg-slate-900 border border-emerald-800/80 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-bold focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRolesModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingRoles}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-extrabold rounded-lg shadow-md hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingRoles ? 'Guardando...' : 'Guardar Cambios de Puestos'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE ALTA / EDICIÓN DE OPERARIO */}
      {(isNewModalOpen || editingWorker) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="alon-modal-card">
            <div className="alon-modal-header">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  {editingWorker ? `Editar Operario: ${editingWorker.name}` : 'Cargar Nuevo Contratista / Operario'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Los operarios y contratistas se imputan por <strong>Grupo de Trabajo</strong> para unificar la carga en Horas y Pañol.
                </p>
              </div>
              <button
                type="button"
                tabIndex={-1}
                onClick={() => { setIsNewModalOpen(false); setEditingWorker(null) }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="alon-modal-body grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
                {/* COLUMNA IZQUIERDA */}
                <div className="space-y-3">
                  {/* BLOQUE 1: CENTRO ADMINISTRATIVO & GRUPO */}
                  <div className="alon-chunk-amber space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
                        1. Centro Administrativo (Origen del Personal)
                      </label>
                      <span className="text-[10px] font-mono text-amber-400/80">Paso 1/5</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => handleAdminCenterChange('ASTILLERO')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          formData.admin_center === 'ASTILLERO'
                            ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-md ring-1 ring-cyan-400'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <Building2 className={`w-3.5 h-3.5 ${formData.admin_center === 'ASTILLERO' ? 'text-cyan-400' : 'text-slate-500'}`} />
                          {formData.admin_center === 'ASTILLERO' && <span className="text-[9px] text-cyan-400 font-bold">✓ Activo</span>}
                        </div>
                        <div>
                          <div className="font-extrabold text-xs">ASTILLERO</div>
                          <div className="text-[10px] text-slate-400 leading-tight">Personal propio</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAdminCenterChange('CONTRATISTA')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          formData.admin_center === 'CONTRATISTA'
                            ? 'bg-amber-950/80 border-amber-400 text-white shadow-md ring-1 ring-amber-400'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <Users className={`w-3.5 h-3.5 ${formData.admin_center === 'CONTRATISTA' ? 'text-amber-400' : 'text-slate-500'}`} />
                          {formData.admin_center === 'CONTRATISTA' && <span className="text-[9px] text-amber-400 font-bold">✓ Activo</span>}
                        </div>
                        <div>
                          <div className="font-extrabold text-xs">CONTRATISTA</div>
                          <div className="text-[10px] text-slate-400 leading-tight">Cuadrillas ext.</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAdminCenterChange('TALLER')}
                        className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                          formData.admin_center === 'TALLER'
                            ? 'bg-purple-950/80 border-purple-400 text-white shadow-md ring-1 ring-purple-400'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full mb-1">
                          <Building2 className={`w-3.5 h-3.5 ${formData.admin_center === 'TALLER' ? 'text-purple-400' : 'text-slate-500'}`} />
                          {formData.admin_center === 'TALLER' && <span className="text-[9px] text-purple-400 font-bold">✓ Activo</span>}
                        </div>
                        <div>
                          <div className="font-extrabold text-xs">TALLER</div>
                          <div className="text-[10px] text-slate-400 leading-tight">Mecanizados ext.</div>
                        </div>
                      </button>
                    </div>

                    {/* GRUPO DE TRABAJO + CONTRATO / SEGURIDAD */}
                    {formData.admin_center === 'ASTILLERO' ? (
                      <div className="space-y-2.5">
                        <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
                          <span className="text-xs text-slate-300">Grupo de Trabajo Asignado:</span>
                          <span className="px-2.5 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono font-bold text-xs">
                            ASTILLERO (Propio)
                          </span>
                        </div>

                        {/* CONTRATO ASTILLERO */}
                        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5" />
                              <span>Contrato Laboral (Alerta a María José 7 días antes)</span>
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Tipo de Contrato:</label>
                              <select
                                value={formData.contract_type}
                                onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
                              >
                                <option value="">Sin especificar...</option>
                                {CONTRACT_TYPES.map((ct) => (
                                  <option key={ct.value} value={ct.value}>{ct.label}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-[10px] font-semibold text-slate-400 mb-1">Fecha de Inicio (doble clic calendario):</label>
                              <input
                                type="date"
                                value={formData.contract_start_date}
                                onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value })}
                                onDoubleClick={(e) => e.currentTarget.showPicker?.()}
                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                              />
                            </div>
                          </div>
                          {formData.contract_type && (() => {
                            const previewExp = computeContractExpiration(formData.contract_type, formData.contract_start_date)
                            return (
                              <div className="text-[10px] text-slate-300 flex items-center justify-between pt-1 border-t border-slate-800/80">
                                <span>
                                  {previewExp.isPermanent
                                    ? 'Planta Permanente (no emite alerta de vencimiento).'
                                    : previewExp.expiresIso
                                    ? `Vence: ${previewExp.expiresIso} (${previewExp.daysRemaining} días restantes)`
                                    : 'Ingresá fecha de inicio para calcular vencimiento.'}
                                </span>
                                {previewExp.vacationDays !== null && (
                                  <span className="font-mono text-emerald-300 font-bold">
                                    Ref. Vacaciones: {previewExp.vacationDays} día(s)
                                  </span>
                                )}
                              </div>
                            )
                          })()}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        <label className="block text-[11px] font-bold text-slate-300">
                          Grupo de Trabajo / Contratista / Razón Social:
                        </label>
                        {!isCustomGroup ? (
                          <div className="flex gap-2">
                            <select
                              value={formData.work_group}
                              onChange={(e) => {
                                if (e.target.value === '__NEW_GROUP__') {
                                  setIsCustomGroup(true)
                                  setCustomGroupName('')
                                } else {
                                  setFormData({ ...formData, work_group: e.target.value })
                                }
                              }}
                              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-amber-400"
                            >
                              {(formData.admin_center === 'CONTRATISTA' ? availableContractorGroups : availableTallerGroups).map(g => (
                                <option key={g} value={g}>{g}</option>
                              ))}
                              <option value="__NEW_GROUP__">➕ Cargar nuevo grupo...</option>
                            </select>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <input
                              type="text"
                              autoFocus
                              placeholder="Nombre del nuevo grupo..."
                              value={customGroupName}
                              onChange={(e) => setCustomGroupName(e.target.value.toUpperCase())}
                              className="flex-1 bg-slate-950 border border-amber-400 rounded-xl px-3 py-2 text-xs text-white uppercase font-bold focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => setIsCustomGroup(false)}
                              className="px-3 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl hover:text-white"
                            >
                              Cancelar
                            </button>
                          </div>
                        )}

                        {/* ELEMENTOS DE SEGURIDAD (ZONA GRIS) */}
                        <div className="p-2.5 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                              <Shield className="w-3.5 h-3.5" />
                              <span>Elementos de Seguridad (EPP)</span>
                            </label>
                            <span title={SAFETY_ITEMS_HELP_TEXT} className="text-[10px] text-cyan-400 cursor-help inline-flex items-center gap-1">
                              <HelpCircle className="w-3.5 h-3.5" /> ¿Cómo computa?
                            </span>
                          </div>
                          <select
                            value={formData.safety_items}
                            onChange={(e) => setFormData({ ...formData, safety_items: e.target.value })}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-amber-400"
                          >
                            {SAFETY_ITEMS_OPTIONS.map(opt => (
                              <option key={opt.value} value={opt.value}>{opt.label} — {opt.shortDesc}</option>
                            ))}
                          </select>
                          <p className="text-[10px] text-slate-400 leading-snug">
                            Por defecto <strong>CONTRATISTA</strong> (se descuenta en Tesorería). Elegir <strong>ASTILLERO</strong> solo si está en zona gris y el astillero absorbe el EPP sin descontárselo.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* BLOQUE 2: DATOS DEL OPERARIO */}
                  <div className="alon-chunk-cyan space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-cyan-300 uppercase tracking-wider">
                        2. Identificación del Operario
                      </label>
                      <span className="text-[10px] font-mono text-cyan-400/80">Paso 2/5</span>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Nombre Completo:
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Ej: JUAN PÉREZ"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white uppercase font-bold focus:outline-none focus:border-cyan-400"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Teléfono Móvil / WhatsApp:
                        </label>
                        <input
                          type="tel"
                          placeholder="Ej: +54 9 223 123-4567"
                          value={formData.phone}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Estado Operativo:
                        </label>
                        <select
                          value={formData.status}
                          onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
                        >
                          <option value="ACTIVO">🟢 ACTIVO</option>
                          <option value="INACTIVO">🔴 INACTIVO</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* COLUMNA DERECHA */}
                <div className="space-y-3">
                  {/* BLOQUE 3: ESPECIALIDAD Y CATEGORÍA */}
                  <div className="alon-chunk-emerald space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-emerald-300 uppercase tracking-wider">
                        3. Especialidad y Categoría
                      </label>
                      <span className="text-[10px] font-mono text-emerald-400/80">Paso 3/5</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Rubro / Especialidad:
                        </label>
                        <select
                          value={formData.trade}
                          onChange={(e) => {
                            if (e.target.value === '__ADD_NEW_TRADE__') {
                              setNewTradeInput('')
                              setIsAddTradeModalOpen(true)
                            } else {
                              setFormData({ ...formData, trade: e.target.value })
                            }
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-emerald-400"
                        >
                          {uniqueTrades.map(tr => (
                            <option key={tr} value={tr}>{tr}</option>
                          ))}
                          <option value="__ADD_NEW_TRADE__">➕ Cargar nuevo rubro...</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-300 mb-1">
                          Categoría Sindical:
                        </label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-emerald-400"
                        >
                          {ASTILLERO_BASE_CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* TARIFA AR$/HORA */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-300 mb-1">
                        Tarifa AR$/Hora:
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-slate-500 font-mono text-xs">$</span>
                        <input
                          type="number"
                          step="100"
                          min="0"
                          value={formData.hourly_rate_ars}
                          onChange={(e) => {
                            const ars = parseFloat(e.target.value) || 0
                            const usd = dollarRate > 0 ? Number((ars / dollarRate).toFixed(2)) : 0
                            setFormData({ ...formData, hourly_rate_ars: ars, hourly_rate_usd: usd })
                          }}
                          className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-400"
                        />
                      </div>
                      <p className="text-[10px] text-emerald-400/80 mt-1">
                        Equivalente: ${(dollarRate > 0 ? (formData.hourly_rate_ars / dollarRate).toFixed(2) : 0)} USD/h (Dólar: ${dollarRate})
                      </p>
                    </div>
                  </div>

                  {/* BLOQUE 4: PERMISOS Y ROLES */}
                  <div className="alon-chunk-purple space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-purple-300 uppercase tracking-wider">
                        4. Permisos Operativos & Habilitaciones
                      </label>
                      <span className="text-[10px] font-mono text-purple-400/80">Paso 4/5</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-emerald-300 font-semibold cursor-pointer hover:border-emerald-500/40">
                        <input
                          type="checkbox"
                          checked={formData.can_withdraw_materials}
                          onChange={(e) => setFormData({ ...formData, can_withdraw_materials: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500 cursor-pointer accent-emerald-500"
                        />
                        <span>Retirar de Pañol (<strong>P</strong>)</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-cyan-300 font-semibold cursor-pointer hover:border-cyan-500/40">
                        <input
                          type="checkbox"
                          checked={formData.can_impute_hours}
                          onChange={(e) => setFormData({ ...formData, can_impute_hours: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-primary cursor-pointer accent-primary"
                        />
                        <span>Imputar Horas (<strong>H</strong>)</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-purple-300 font-semibold cursor-pointer hover:border-purple-500/40">
                        <input
                          type="checkbox"
                          checked={formData.can_charge_third_party}
                          onChange={(e) => setFormData({ ...formData, can_charge_third_party: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-purple-400 cursor-pointer accent-purple-500"
                        />
                        <span>Habilitado Terceros (<strong>3ros</strong>)</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-amber-300 font-semibold cursor-pointer hover:border-amber-500/40">
                        <input
                          type="checkbox"
                          checked={formData.is_foreman}
                          onChange={(e) => setFormData({ ...formData, is_foreman: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-400 cursor-pointer accent-amber-500"
                        />
                        <span>👷 Es Jefe de Obra (<strong>JO</strong>)</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* PIE DE ACCIONES FIJO */}
              <div className="alon-modal-footer">
                <button
                  type="button"
                  onClick={() => { setIsNewModalOpen(false); setEditingWorker(null) }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingWorker}
                  className="px-5 py-2 bg-gradient-to-r from-primary to-blue-500 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-cyan-500/20 hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{savingWorker ? 'Guardando...' : (editingWorker ? 'Guardar Cambios' : 'Registrar Operario')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MENÚ CONTEXTUAL CANÓNICO */}
      {contextMenuTarget && (
        <GridContextMenu
          target={contextMenuTarget}
          onClose={() => setContextMenuTarget(null)}
          onCopyCell={nominaGrid.copyActiveCell}
          onCopyRow={nominaGrid.copyRow}
          onPaste={nominaGrid.pasteToActiveOrRange}
          onDeleteCell={nominaGrid.deleteActiveCellOrRange}
          onDeleteRow={(row) => handleDelete(row)}
          onDuplicateRow={(row) => handleDuplicateWorkerRow(row)}
          entityType={contextMenuTarget.entityType || 'workers'}
          recordId={contextMenuTarget.recordId}
          recordLabel={contextMenuTarget.recordLabel}
        />
      )}
    </div>
  )
}
