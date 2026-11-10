import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { 
  Users, 
  Plus, 
  Search, 
  Filter, 
  Pencil, 
  Trash2, 
  CheckCircle2, 
  X, 
  DollarSign, 
  Briefcase, 
  ShieldAlert, 
  PackageCheck, 
  AlertCircle, 
  RefreshCw,
  Clock,
  Save,
  Check,
  Building2,
  HardHat,
  Calculator,
  Lock,
  Unlock,
  Calendar,
  History,
  ArrowRight,
  CheckCheck,
  Layers,
  FileSpreadsheet,
  TrendingUp,
  Percent,
  Settings,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  SlidersHorizontal,
  ChevronRight,
  ChevronDown,
  Undo2,
  Redo2,
  Phone,
  PhoneOff,
  Shield,
  Square,
  CheckSquare
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useSpreadsheetGrid } from '../hooks/useSpreadsheetGrid'
import CrawlerSearchBar from '../components/CrawlerSearchBar'
import GridRibbon from '../components/GridRibbon'
import GridStatusBarBottom from '../components/GridStatusBarBottom'
import GridContextMenu from '../components/GridContextMenu'
import { matchesUniversalSearch } from '../lib/searchEngine'
import { auditService } from '../lib/auditService'

import HighlightText from '../components/HighlightText'

import initialPersonnelData from '../data/initialPersonnel.json'

// Mapeo inicial normalizado para fallback local
const INITIAL_WORKERS_LOCAL = initialPersonnelData.map((p, idx) => ({
  id: `worker-local-${idx}`,
  name: p['NOMBRE'] || '',
  work_group: p['GRUPO DE TRABAJO'] || 'ASTILLERO',
  trade: p['RUBRO'] || 'General',
  admin_center: p['CENTRO ADMINISTRATIVO'] || 'ASTILLERO',
  consumables: p['CONSUMIBLES'] || 'CLIENTE',
  consumables_discount_pct: (p['CONSUMIBLES'] || '').trim().toUpperCase() === 'CONTRATISTA' ? 100 : 0,
  safety_items: p['ELEM_SEGURIDAD'] || 'CONTRATISTA',
  status: (p['ESTADO'] || 'ACTIVO').toUpperCase(),
  hourly_rate_ars: parseFloat(p['AR$/HORA']) || 0,
  hourly_rate_usd: parseFloat(p['U$/HORA']) || 0,
  category: p['CATEGORIA'] || '',
  can_withdraw_materials: (p['CARGA MATERIALES'] || 'SI').trim().toUpperCase() === 'SI',
  can_impute_hours: (p['COSTO HORAS'] || 'SI').trim().toUpperCase() === 'SI',
  can_charge_third_party: (p['CENTRO ADMINISTRATIVO'] || 'ASTILLERO').trim().toUpperCase() !== 'ASTILLERO',
  is_foreman: ['ALE CAMADELLI', 'PABLO N.', 'MARTIN OBREGOZO', 'HUGO OBREGOZO'].includes((p['NOMBRE'] || '').trim().toUpperCase())
}))

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

// COLORES OFICIALES POR CATEGORÍA SINDICAL (IDÉNTICO A IMAGEN PLANILLA LEGACY)
// 1. AYUDANTE: Celeste / Cyan flúor
// 2. OFICIAL: Verde flúor
// 3. 1/2 OFICIAL: Fucsia / Magenta flúor
// 4. APRENDIZ: Amarillo flúor
// 5. OFICIAL BLACK: Negro con texto blanco
export const getCategoryBadgeStyle = (category = '') => {
  const c = (category || '').toUpperCase().trim()
  if (c === 'AYUDANTE') return 'bg-[#00E5FF] text-slate-950 border-[#00B8D4] font-black'
  if (c === 'OFICIAL') return 'bg-[#00E676] text-slate-950 border-[#00C853] font-black'
  if (c === '1/2 OFICIAL') return 'bg-[#FF00D4] text-white border-[#D500F9] font-black'
  if (c === 'APRENDIZ') return 'bg-[#FFEA00] text-slate-950 border-[#FFD600] font-black'
  if (c.includes('BLACK') || c === 'OFICIAL BLACK') return 'bg-black text-white border-slate-700 font-black'
  return 'bg-slate-900 text-slate-300 border-slate-800 font-medium'
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

// 5 Categorías sindicales oficiales de Astillero (MANDADOS eliminado por ser rubro)
const ASTILLERO_BASE_CATEGORIES = [
  'AYUDANTE',
  'OFICIAL',
  '1/2 OFICIAL',
  'APRENDIZ',
  'OFICIAL BLACK'
]

export default function Personal() {
  const [activeTab, setActiveTab] = useState('nomina') // 'nomina' | 'tarifario' | 'analisis'
  const [workers, setWorkers] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusMessage, setStatusMessage] = useState(null)

  // Variables globales del encabezado (Legacy B.D.NewSystemm)
  // Valor US$ Quincenal: Se muestra CONGELADO (solo lectura / referencia fijada por Administrador)
  const [dollarRate, setDollarRate] = useState(1500)
  const [rateAyudante, setRateAyudante] = useState(14595.84)
  const [rateMedioOficial, setRateMedioOficial] = useState(15069.14)
  const [rateOficial, setRateOficial] = useState(16365.76)

  // Filtro activo por tarjeta KPI de auditoría operativa
  const [kpiFilter, setKpiFilter] = useState(null)

  // Estado para creación de nuevos rubros estandarizados
  const [customTrades, setCustomTrades] = useState([])
  const [isAddTradeModalOpen, setIsAddTradeModalOpen] = useState(false)
  const [newTradeInput, setNewTradeInput] = useState('')
  const [targetWorkerForNewTrade, setTargetWorkerForNewTrade] = useState(null)

  // Roles organizacionales dinámicos (desvinculados de nombres hardcodeados)
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
    safety_items: 'CONTRATISTA',
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

  // -------------------------------------------------------------
  // ESTADOS DEL SUBMÓDULO: TARIFARIO QUINCENAL (COSTOS)
  // -------------------------------------------------------------
  const [rateYear, setRateYear] = useState(2026)
  const [rateMonth, setRateMonth] = useState(10)
  const [rateQuincena, setRateQuincena] = useState(1)
  const [rateCards, setRateCards] = useState([])
  const [allRecordedPeriods, setAllRecordedPeriods] = useState([])
  const [loadingRateCards, setLoadingRateCards] = useState(false)
  const [savingRateCard, setSavingRateCard] = useState(false)
  const [filterTableCenter, setFilterTableCenter] = useState('todos')
  const [rateTableSearch, setRateTableSearch] = useState('')
  const [rateTableScope, setRateTableScope] = useState('current') // 'current' | 'all'
  const [contextMenuTarget, setContextMenuTarget] = useState(null)

  // Selector unificado de Centro Administrativo para carga
  const [rateAdminCenter, setRateAdminCenter] = useState('ASTILLERO') // 'ASTILLERO' | 'CONTRATISTA'

  // Formulario de Astillero (5 categorías sindicales oficiales)
  const [astilleroForm, setAstilleroForm] = useState({
    'AYUDANTE': { ars: 14595.84, usd: 9.73 },
    'OFICIAL': { ars: 16365.76, usd: 10.91 },
    '1/2 OFICIAL': { ars: 15069.14, usd: 10.05 },
    'APRENDIZ': { ars: 13656.80, usd: 9.10 },
    'OFICIAL BLACK': { ars: 18500.00, usd: 12.33 }
  })

  // Formulario de Contratistas
  const [selectedContractor, setSelectedContractor] = useState('RAMON ARANDA')
  const [contractorHasAyudante, setContractorHasAyudante] = useState(true)
  const [contractorOficialArs, setContractorOficialArs] = useState(17500)
  const [contractorOficialUsd, setContractorOficialUsd] = useState(11.67)
  const [contractorAyudanteArs, setContractorAyudanteArs] = useState(13500)
  const [contractorAyudanteUsd, setContractorAyudanteUsd] = useState(9.00)

  // Estados del selector unificado y buscador de quincenas en cascada
  const [allRateCardRecords, setAllRateCardRecords] = useState([])
  const [periodSearchInput, setPeriodSearchInput] = useState('')
  const [isPeriodSelectOpen, setIsPeriodSelectOpen] = useState(false)
  const [isNewPeriodModalOpen, setIsNewPeriodModalOpen] = useState(false)
  const [newPeriodYear, setNewPeriodYear] = useState(2026)
  const [newPeriodMonth, setNewPeriodMonth] = useState(11)
  const [newPeriodQuincena, setNewPeriodQuincena] = useState(2)
  const [newPeriodDollarRate, setNewPeriodDollarRate] = useState(1500)
  const [newPeriodCopyLast, setNewPeriodCopyLast] = useState(true)
  const [creatingNewPeriod, setCreatingNewPeriod] = useState(false)
  const periodDropdownRef = useRef(null)
  const tarifarioFormRef = useRef(null)
  const [isTargetFocusGlow, setIsTargetFocusGlow] = useState(false)

  // Manejo de clic exterior para cerrar el dropdown con filtro de quincenas
  useEffect(() => {
    function handleClickOutsidePeriodSelect(event) {
      if (periodDropdownRef.current && !periodDropdownRef.current.contains(event.target)) {
        setIsPeriodSelectOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutsidePeriodSelect)
    return () => document.removeEventListener('mousedown', handleClickOutsidePeriodSelect)
  }, [])

  // -------------------------------------------------------------
  // ESTADOS DEL DASHBOARD DE ANÁLISIS DE VARIACIÓN & EVOLUCIÓN
  // -------------------------------------------------------------
  const [comparePeriodBase, setComparePeriodBase] = useState('2026-09-2Q')
  const [comparePeriodTarget, setComparePeriodTarget] = useState('2026-10-1Q')
  const [comparisonCards, setComparisonCards] = useState([])
  const [loadingComparison, setLoadingComparison] = useState(false)
  const [macroVariables, setMacroVariables] = useState([])
  const [chartMode, setChartMode] = useState('pct') // 'pct' | 'nominal'
  const [hoveredPointIndex, setHoveredPointIndex] = useState(null)
  
  // Pilar A: Presets de Ventanas Temporales
  const [timeWindowPreset, setTimeWindowPreset] = useState('month') // 'month' | 'quarter' | 'semester' | 'year' | 'custom'

  // Sujeto a Evaluar en Gráfico (default a 'ALDO (CARPINTERO)')
  const [selectedZoomContractor, setSelectedZoomContractor] = useState('ALDO (CARPINTERO)')

  // Filtro de Semáforo
  const [filterTrafficLight, setFilterTrafficLight] = useState('TODOS')

  // Período activo formateado (ej: 2026-10-1Q)
  const currentPeriodKey = useMemo(() => {
    return `${rateYear}-${String(rateMonth).padStart(2, '0')}-${rateQuincena}Q`
  }, [rateYear, rateMonth, rateQuincena])

  useEffect(() => {
    loadWorkers()
    loadOrgRoles()
    loadRecordedPeriods()
    loadRateCards(currentPeriodKey)
  }, [])

  useEffect(() => {
    loadRateCards(currentPeriodKey)
  }, [currentPeriodKey])

  useEffect(() => {
    if (activeTab === 'analisis') {
      loadComparisonData()
    }
  }, [activeTab])

  // Cargar datos de personal desde Supabase con fallback local
  async function loadWorkers() {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('workers')
        .select('*')
        .order('admin_center', { ascending: true })
        .order('work_group', { ascending: true })
        .order('name', { ascending: true })

      if (error) throw error

            if (data && data.length > 0) {
        setWorkers(data)
      } else {
        setWorkers(INITIAL_WORKERS_LOCAL)
      }

      // Cargar catálogo de rubros maestros desde system_settings
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
    } catch (err) {
      console.warn('Cargando nómina desde datos iniciales locales:', err)
      setWorkers(INITIAL_WORKERS_LOCAL)
    } finally {
      setLoading(false)
    }
  }

  // Cargar roles organizacionales dinámicos
  async function loadOrgRoles() {
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

  // Cargar todas las quincenas registradas en la base de datos ORDENADAS POR CALENDARIO (1Q y luego 2Q)
  async function loadRecordedPeriods() {
    try {
      const { data, error } = await supabase
        .from('rate_cards')
        .select('*')

      if (error) throw error
      if (data) {
        setAllRateCardRecords(data)
        const map = new Map()
        data.forEach(d => {
          if (!map.has(d.period)) {
            map.set(d.period, {
              period: d.period,
              year: d.year,
              month: d.month,
              quincena: d.quincena,
              dollar_rate: d.dollar_rate
            })
          }
        })
        const unique = Array.from(map.values())
        // ORDEN ESTRICTO CALENDARIO: Año ascendente -> Mes ascendente -> Quincena 1Q luego 2Q
        unique.sort((a, b) => {
          if (a.year !== b.year) return a.year - b.year
          if (a.month !== b.month) return a.month - b.month
          return a.quincena - b.quincena
        })
        setAllRecordedPeriods(unique)

        // Configurar comparación por defecto si existen quincenas
        if (unique.length >= 2) {
          setComparePeriodBase(unique[unique.length - 2].period)
          setComparePeriodTarget(unique[unique.length - 1].period)
        }
      }
    } catch (err) {
      console.warn('Error al cargar períodos registrados:', err)
    }
  }

  // Helper para cargar y editar una tarifa
  const handleLoadRateCard = (rc) => {
    if (rc.year && rc.month && rc.quincena) {
      setRateYear(rc.year)
      setRateMonth(rc.month)
      setRateQuincena(rc.quincena)
    }
    if (rc.admin_center === 'ASTILLERO') {
      setRateAdminCenter('ASTILLERO')
      if (rc.rate_oficial_ars) {
        setAstilleroForm(prev => ({
          ...prev,
          [rc.entity_name]: {
            ars: parseFloat(rc.rate_oficial_ars) || 0,
            usd: parseFloat(rc.rate_oficial_usd) || 0
          }
        }))
      }
    } else {
      setRateAdminCenter('CONTRATISTA')
      handleSelectContractor(rc.entity_name)
      setContractorOficialArs(parseFloat(rc.rate_oficial_ars) || 0)
      setContractorOficialUsd(parseFloat(rc.rate_oficial_usd) || 0)
      setContractorHasAyudante(rc.has_ayudante)
      setContractorAyudanteArs(rc.rate_ayudante_ars ? parseFloat(rc.rate_ayudante_ars) : 0)
      setContractorAyudanteUsd(rc.rate_ayudante_usd ? parseFloat(rc.rate_ayudante_usd) : 0)
    }
    setStatusMessage({
      type: 'info',
      text: `Editando valores de ${rc.entity_name} para la quincena ${rc.period}.`
    })
    if (tarifarioFormRef.current) {
      tarifarioFormRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setIsTargetFocusGlow(true)
      setTimeout(() => setIsTargetFocusGlow(false), 2200)
    }
  }

  // Cargar tarifario de la quincena seleccionada o historial completo
  async function loadRateCards(periodToLoad, scope = rateTableScope) {
    try {
      setLoadingRateCards(true)
      let query = supabase.from('rate_cards').select('*')
      
      if (scope === 'current') {
        query = query.eq('period', periodToLoad)
      }

      const { data, error } = await query
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .order('quincena', { ascending: false })
        .order('admin_center', { ascending: true })
        .order('entity_name', { ascending: true })

      if (error) throw error

      if (data && data.length > 0) {
        setRateCards(data)
        
        // Si hay cotización guardada en el período actual, sincronizarla como lectura
        const currentPeriodRows = data.filter(d => d.period === periodToLoad)
        if (currentPeriodRows.length > 0 && currentPeriodRows[0].dollar_rate) {
          const dVal = parseFloat(currentPeriodRows[0].dollar_rate) || 1500
          setDollarRate(dVal)
        }

        // Sincronizar formulario de Astillero con los datos guardados
        const astilleroRows = data.filter(d => d.period === periodToLoad && d.admin_center === 'ASTILLERO')
        if (astilleroRows.length > 0) {
          setAstilleroForm(prev => {
            const next = { ...prev }
            astilleroRows.forEach(row => {
              if (next[row.entity_name]) {
                next[row.entity_name] = {
                  ars: parseFloat(row.rate_oficial_ars) || 0,
                  usd: parseFloat(row.rate_oficial_usd) || 0
                }
              }
            })
            return next
          })
          const ofRow = astilleroRows.find(r => r.entity_name === 'OFICIAL')
          if (ofRow) setRateOficial(parseFloat(ofRow.rate_oficial_ars) || rateOficial)
          const moRow = astilleroRows.find(r => r.entity_name === '1/2 OFICIAL')
          if (moRow) setRateMedioOficial(parseFloat(moRow.rate_oficial_ars) || 15069.14)
          const ayRow = astilleroRows.find(r => r.entity_name === 'AYUDANTE')
          if (ayRow) setRateAyudante(parseFloat(ayRow.rate_oficial_ars) || rateAyudante)
        }
      } else {
        setRateCards([])
      }
    } catch (err) {
      console.warn('Error cargando rate_cards:', err)
      setRateCards([])
    } finally {
      setLoadingRateCards(false)
    }
  }

  // Cargar datos para el comparador de variación quincenal (historial completo y macro variables)
  async function loadComparisonData() {
    try {
      setLoadingComparison(true)
      const [cardsRes, macroRes] = await Promise.all([
        supabase.from('rate_cards').select('*').order('year', { ascending: true }).order('month', { ascending: true }).order('quincena', { ascending: true }),
        supabase.from('macro_variables').select('*').order('year', { ascending: true }).order('month', { ascending: true })
      ])

      if (cardsRes.data) setComparisonCards(cardsRes.data)
      if (macroRes.data) setMacroVariables(macroRes.data)
    } catch (err) {
      console.warn('Error cargando comparativa:', err)
      setComparisonCards([])
    } finally {
      setLoadingComparison(false)
    }
  }

  // Lista ordenada cronológicamente de quincenas guardadas (1Q luego 2Q)
  const sortedRecordedPeriods = useMemo(() => {
    return [...allRecordedPeriods].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      if (a.month !== b.month) return a.month - b.month
      return a.quincena - b.quincena
    })
  }, [allRecordedPeriods])

  // Mapeo detallado de tarifas por período para acceso instantáneo y tooltips de hover
  const rateCardsByPeriod = useMemo(() => {
    const lookup = {}
    allRateCardRecords.forEach(r => {
      if (!lookup[r.period]) {
        lookup[r.period] = {
          dollar_rate: r.dollar_rate,
          astillero: {},
          contractors: {}
        }
      }
      if (r.admin_center === 'ASTILLERO') {
        lookup[r.period].astillero[r.entity_name] = {
          ars: parseFloat(r.rate_oficial_ars) || 0,
          usd: parseFloat(r.rate_oficial_usd) || 0
        }
      } else if (r.admin_center === 'CONTRATISTA') {
        lookup[r.period].contractors[r.entity_name] = {
          oficialArs: parseFloat(r.rate_oficial_ars) || 0,
          oficialUsd: parseFloat(r.rate_oficial_usd) || 0,
          ayudanteArs: r.rate_ayudante_ars ? parseFloat(r.rate_ayudante_ars) : null,
          ayudanteUsd: r.rate_ayudante_usd ? parseFloat(r.rate_ayudante_usd) : null,
          hasAyudante: Boolean(r.has_ayudante)
        }
      }
    })
    return lookup
  }, [allRateCardRecords])

  // Últimas 10 quincenas estrictas en orden cronológico
  const last10RecordedPeriods = useMemo(() => {
    return sortedRecordedPeriods.slice(-10)
  }, [sortedRecordedPeriods])

  // Cálculo de la próxima quincena correlativa sugerida
  const nextCorrelativePeriod = useMemo(() => {
    if (sortedRecordedPeriods.length === 0) {
      return { year: 2026, month: 11, quincena: 2, period: '2026-11-2Q' }
    }
    const last = sortedRecordedPeriods[sortedRecordedPeriods.length - 1]
    let nextYear = last.year
    let nextMonth = last.month
    let nextQuincena = last.quincena === 1 ? 2 : 1
    if (last.quincena === 2) {
      if (last.month === 12) {
        nextYear = last.year + 1
        nextMonth = 1
      } else {
        nextMonth = last.month + 1
      }
    }
    const nextKey = `${nextYear}-${String(nextMonth).padStart(2, '0')}-${nextQuincena}Q`
    return { year: nextYear, month: nextMonth, quincena: nextQuincena, period: nextKey }
  }, [sortedRecordedPeriods])

  // Filtro de búsqueda en tiempo real para el desplegable de quincenas
  const filteredSelectablePeriods = useMemo(() => {
    if (!periodSearchInput || !periodSearchInput.trim()) {
      return sortedRecordedPeriods
    }
    const query = periodSearchInput.trim().toLowerCase()
    return sortedRecordedPeriods.filter(p => {
      const pKey = (p.period || '').toLowerCase()
      const mName = MONTH_NAMES[p.month - 1] ? MONTH_NAMES[p.month - 1].toLowerCase() : ''
      const qDesc = p.quincena === 1 ? '1ra quincena primera 1q' : '2da quincena segunda 2q'
      return pKey.includes(query) || mName.includes(query) || qDesc.includes(query)
    })
  }, [sortedRecordedPeriods, periodSearchInput])

  // Seleccionar período desde desplegable o chip de acceso rápido
  const handleSelectPeriod = (p) => {
    setRateYear(p.year)
    setRateMonth(p.month)
    setRateQuincena(p.quincena)
    if (p.dollar_rate) {
      setDollarRate(parseFloat(p.dollar_rate))
    }
    setIsPeriodSelectOpen(false)
    setPeriodSearchInput('')
  }

  // Abrir modal de nueva quincena inicializando con el correlativo sugerido
  const handleOpenNewPeriodModal = () => {
    setNewPeriodYear(nextCorrelativePeriod.year)
    setNewPeriodMonth(nextCorrelativePeriod.month)
    setNewPeriodQuincena(nextCorrelativePeriod.quincena)
    setNewPeriodDollarRate(dollarRate || 1500)
    setNewPeriodCopyLast(true)
    setIsNewPeriodModalOpen(true)
  }

  // Confirmar creación de nueva quincena
  const handleConfirmNewPeriod = async () => {
    const targetKey = `${newPeriodYear}-${String(newPeriodMonth).padStart(2, '0')}-${newPeriodQuincena}Q`
    
    // Validar si el período ya existe
    const exists = sortedRecordedPeriods.some(p => p.period === targetKey)
    if (exists) {
      setRateYear(newPeriodYear)
      setRateMonth(newPeriodMonth)
      setRateQuincena(newPeriodQuincena)
      setIsNewPeriodModalOpen(false)
      setStatusMessage({
        type: 'info',
        text: `La quincena ${targetKey} ya existía y fue seleccionada.`
      })
      setTimeout(() => setStatusMessage(null), 3000)
      return
    }

    setCreatingNewPeriod(true)
    try {
      const userHolder = orgRoles['LIQUIDACION_SUELDOS']?.holder || 'María José'
      const newDollar = parseFloat(newPeriodDollarRate) || 1500

      if (newPeriodCopyLast && sortedRecordedPeriods.length > 0) {
        const lastPeriodKey = sortedRecordedPeriods[sortedRecordedPeriods.length - 1].period
        const lastRecords = allRateCardRecords.filter(r => r.period === lastPeriodKey)
        
        if (lastRecords.length > 0) {
          const rowsToInsert = lastRecords.map(r => ({
            period: targetKey,
            year: newPeriodYear,
            month: newPeriodMonth,
            quincena: newPeriodQuincena,
            admin_center: r.admin_center,
            entity_name: r.entity_name,
            rate_oficial_ars: r.rate_oficial_ars,
            rate_oficial_usd: newDollar > 0 ? Number((r.rate_oficial_ars / newDollar).toFixed(2)) : 0,
            rate_ayudante_ars: r.rate_ayudante_ars,
            rate_ayudante_usd: (newDollar > 0 && r.rate_ayudante_ars) ? Number((r.rate_ayudante_ars / newDollar).toFixed(2)) : null,
            has_ayudante: r.has_ayudante,
            dollar_rate: newDollar,
            updated_by: userHolder,
            updated_at: new Date().toISOString()
          }))

          const { error } = await supabase.from('rate_cards').upsert(rowsToInsert, { onConflict: 'period,admin_center,entity_name' })
          if (error) throw error
        }
      } else {
        const baseAstilleroRows = ASTILLERO_BASE_CATEGORIES.map(cat => ({
          period: targetKey,
          year: newPeriodYear,
          month: newPeriodMonth,
          quincena: newPeriodQuincena,
          admin_center: 'ASTILLERO',
          entity_name: cat,
          rate_oficial_ars: astilleroForm[cat]?.ars || 0,
          rate_oficial_usd: newDollar > 0 ? Number(((astilleroForm[cat]?.ars || 0) / newDollar).toFixed(2)) : 0,
          has_ayudante: false,
          dollar_rate: newDollar,
          updated_by: userHolder,
          updated_at: new Date().toISOString()
        }))

        const { error } = await supabase.from('rate_cards').upsert(baseAstilleroRows, { onConflict: 'period,admin_center,entity_name' })
        if (error) throw error
      }

      // Log en auditoría
      auditService.logEvent({
        module: 'TARIFARIO_QUINCENAL',
        action: 'CREATE_PERIOD',
        user: userHolder,
        target: targetKey,
        details: {
          period: targetKey,
          year: newPeriodYear,
          month: newPeriodMonth,
          quincena: newPeriodQuincena,
          dollar_rate: newDollar,
          copied_from_last: newPeriodCopyLast
        }
      })

      setRateYear(newPeriodYear)
      setRateMonth(newPeriodMonth)
      setRateQuincena(newPeriodQuincena)
      setDollarRate(newDollar)
      setIsNewPeriodModalOpen(false)

      await loadRecordedPeriods()
      await loadRateCards(targetKey)

      setStatusMessage({
        type: 'success',
        text: `Nueva quincena ${targetKey} creada con éxito.`
      })
      setTimeout(() => setStatusMessage(null), 3500)
    } catch (err) {
      console.error(err)
      setStatusMessage({
        type: 'error',
        text: `Error al crear nueva quincena: ${err.message}`
      })
    } finally {
      setCreatingNewPeriod(false)
    }
  }

  // Análisis inteligente de contratistas registrados
  const rootContractorsMap = useMemo(() => {
    const map = {}
    const contractors = workers.filter(w => (w.admin_center || '').toUpperCase() === 'CONTRATISTA')
    
    contractors.forEach(c => {
      const rawGroup = (c.work_group || '').trim().toUpperCase()
      const isAyudanteGroup = rawGroup.endsWith(' AYUDANTE')
      const root = isAyudanteGroup ? rawGroup.replace(/\s+AYUDANTE$/, '').trim() : rawGroup
      if (!root) return

      if (!map[root]) {
        map[root] = {
          name: root,
          hasAyudanteOption: false,
          oficialRateArs: 0,
          ayudanteRateArs: 0,
          workersCount: 0
        }
      }

      const rateArs = parseFloat(c.hourly_rate_ars) || 0
      const isAy = isAyudanteGroup || (c.category || '').toUpperCase().includes('AYUDANTE')

      if (isAy) {
        map[root].hasAyudanteOption = true
        if (rateArs > 0) map[root].ayudanteRateArs = rateArs
      } else {
        if (rateArs > 0) map[root].oficialRateArs = rateArs
      }
      map[root].workersCount += 1
    })

    return map
  }, [workers])

  const uniqueContractorList = useMemo(() => {
    return Object.keys(rootContractorsMap).sort()
  }, [rootContractorsMap])

  // Cambiar contratista seleccionado en el formulario unificado
  const handleSelectContractor = (contractorName) => {
    setSelectedContractor(contractorName)
    
    // 1. Revisar si ya está guardado en el período activo en rate_cards
    const existing = rateCards.find(rc => rc.period === currentPeriodKey && rc.admin_center === 'CONTRATISTA' && rc.entity_name === contractorName)
    if (existing) {
      setContractorHasAyudante(existing.has_ayudante)
      setContractorOficialArs(parseFloat(existing.rate_oficial_ars) || 0)
      setContractorOficialUsd(parseFloat(existing.rate_oficial_usd) || 0)
      setContractorAyudanteArs(existing.rate_ayudante_ars ? parseFloat(existing.rate_ayudante_ars) : 0)
      setContractorAyudanteUsd(existing.rate_ayudante_usd ? parseFloat(existing.rate_ayudante_usd) : 0)
    } else {
      // 2. Tomar valores sugeridos del padrón de nómina
      const meta = rootContractorsMap[contractorName]
      const hasAy = meta ? meta.hasAyudanteOption : false
      setContractorHasAyudante(hasAy)
      
      const ofArs = meta && meta.oficialRateArs > 0 ? meta.oficialRateArs : 18000
      setContractorOficialArs(ofArs)
      setContractorOficialUsd(dollarRate > 0 ? Number((ofArs / dollarRate).toFixed(2)) : 0)

      const ayArs = meta && meta.ayudanteRateArs > 0 ? meta.ayudanteRateArs : (hasAy ? 13500 : 0)
      setContractorAyudanteArs(ayArs)
      setContractorAyudanteUsd(dollarRate > 0 ? Number((ayArs / dollarRate).toFixed(2)) : 0)
    }
  }

  // Guardar escala sindical de Astillero (5 categorías)
  // SE APLICA AUTOMÁTICAMENTE A LA NÓMINA SIN CONSULTAR (REGLA DE NEGOCIO CERO ERROR)
  const handleSaveAstilleroRates = async () => {
    setSavingRateCard(true)
    try {
      for (const cat of ASTILLERO_BASE_CATEGORIES) {
        const ars = parseFloat(astilleroForm[cat]?.ars) || 0
        const usd = dollarRate > 0 ? Number((ars / dollarRate).toFixed(2)) : 0

        const { error } = await supabase
          .from('rate_cards')
          .upsert({
            period: currentPeriodKey,
            year: rateYear,
            month: rateMonth,
            quincena: rateQuincena,
            admin_center: 'ASTILLERO',
            entity_name: cat,
            rate_oficial_ars: ars,
            rate_oficial_usd: usd,
            rate_ayudante_ars: null,
            rate_ayudante_usd: null,
            has_ayudante: false,
            dollar_rate: dollarRate,
            updated_by: orgRoles['LIQUIDACION_SUELDOS']?.holder || 'María José',
            updated_at: new Date().toISOString()
          }, { onConflict: 'period,admin_center,entity_name' })

        if (error) throw error

        // Sincronización automática inmediata en tabla workers
        if (ars > 0) {
          await supabase
            .from('workers')
            .update({ hourly_rate_ars: ars, hourly_rate_usd: usd })
            .eq('admin_center', 'ASTILLERO')
            .eq('category', cat)

          setWorkers(prev => prev.map(w => 
            (w.admin_center === 'ASTILLERO' && w.category === cat)
              ? { ...w, hourly_rate_ars: ars, hourly_rate_usd: usd }
              : w
          ))
        }
      }

      if (astilleroForm['OFICIAL']?.ars > 0) setRateOficial(astilleroForm['OFICIAL'].ars)
      if (astilleroForm['AYUDANTE']?.ars > 0) setRateAyudante(astilleroForm['AYUDANTE'].ars)

      await loadRateCards(currentPeriodKey)
      await loadRecordedPeriods()

      // Registrar evento de auditoría trazable
      auditService.logEvent({
        module: 'TARIFARIO_QUINCENAL',
        action: 'UPDATE_RATE_CARD',
        user: orgRoles['LIQUIDACION_SUELDOS']?.holder || 'María José',
        target: currentPeriodKey,
        details: { admin_center: 'ASTILLERO', period: currentPeriodKey, rates: astilleroForm, dollarRate }
      })

      setStatusMessage({ 
        type: 'success', 
        text: `Escala sindical guardada para la quincena ${currentPeriodKey}. Valores sincronizados automáticamente en el padrón de Astillero.` 
      })
      setTimeout(() => setStatusMessage(null), 3500)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al guardar escala: ${err.message}` })
    } finally {
      setSavingRateCard(false)
    }
  }

  // Guardar tarifa de contratista
  // SE APLICA AUTOMÁTICAMENTE A LOS OPERARIOS ASOCIADOS SIN CONSULTAR
  const handleSaveContractorRate = async () => {
    if (!selectedContractor) return
    setSavingRateCard(true)
    try {
      const ofArs = parseFloat(contractorOficialArs) || 0
      const ofUsd = dollarRate > 0 ? Number((ofArs / dollarRate).toFixed(2)) : 0
      const ayArs = contractorHasAyudante ? (parseFloat(contractorAyudanteArs) || 0) : null
      const ayUsd = contractorHasAyudante && dollarRate > 0 && ayArs ? Number((ayArs / dollarRate).toFixed(2)) : null

      const { error } = await supabase
        .from('rate_cards')
        .upsert({
          period: currentPeriodKey,
          year: rateYear,
          month: rateMonth,
          quincena: rateQuincena,
          admin_center: 'CONTRATISTA',
          entity_name: selectedContractor,
          rate_oficial_ars: ofArs,
          rate_oficial_usd: ofUsd,
          rate_ayudante_ars: ayArs,
          rate_ayudante_usd: ayUsd,
          has_ayudante: contractorHasAyudante,
          dollar_rate: dollarRate,
          updated_by: orgRoles['LIQUIDACION_SUELDOS']?.holder || 'María José',
          updated_at: new Date().toISOString()
        }, { onConflict: 'period,admin_center,entity_name' })

      if (error) throw error

      // Sincronización automática inmediata en workers
      if (contractorHasAyudante && ayArs > 0) {
        await supabase
          .from('workers')
          .update({ hourly_rate_ars: ayArs, hourly_rate_usd: ayUsd })
          .eq('admin_center', 'CONTRATISTA')
          .or(`work_group.eq.${selectedContractor} AYUDANTE,category.eq.${selectedContractor} AYUDANTE`)

        await supabase
          .from('workers')
          .update({ hourly_rate_ars: ofArs, hourly_rate_usd: ofUsd })
          .eq('admin_center', 'CONTRATISTA')
          .eq('work_group', selectedContractor)
          .neq('category', `${selectedContractor} AYUDANTE`)

        setWorkers(prev => prev.map(w => {
          if (w.admin_center !== 'CONTRATISTA') return w
          const isAyudante = (w.work_group === `${selectedContractor} AYUDANTE`) || (w.category === `${selectedContractor} AYUDANTE`)
          const isOficial = w.work_group === selectedContractor && !isAyudante
          if (isAyudante) return { ...w, hourly_rate_ars: ayArs, hourly_rate_usd: ayUsd }
          if (isOficial) return { ...w, hourly_rate_ars: ofArs, hourly_rate_usd: ofUsd }
          return w
        }))
      } else if (ofArs > 0) {
        await supabase
          .from('workers')
          .update({ hourly_rate_ars: ofArs, hourly_rate_usd: ofUsd })
          .eq('admin_center', 'CONTRATISTA')
          .eq('work_group', selectedContractor)

        setWorkers(prev => prev.map(w => {
          if (w.admin_center === 'CONTRATISTA' && w.work_group === selectedContractor) {
            return { ...w, hourly_rate_ars: ofArs, hourly_rate_usd: ofUsd }
          }
          return w
        }))
      }

      await loadRateCards(currentPeriodKey)
      await loadRecordedPeriods()

      // Registrar evento de auditoría trazable
      auditService.logEvent({
        module: 'TARIFARIO_QUINCENAL',
        action: 'UPDATE_RATE_CARD',
        user: orgRoles['LIQUIDACION_SUELDOS']?.holder || 'María José',
        target: `${currentPeriodKey} - ${selectedContractor}`,
        details: { admin_center: 'CONTRATISTA', contractor: selectedContractor, period: currentPeriodKey, ofArs, ayArs, dollarRate }
      })

      setStatusMessage({ 
        type: 'success', 
        text: `Tarifa para contratista ${selectedContractor} guardada (${currentPeriodKey}) y sincronizada en el padrón.` 
      })
      setTimeout(() => setStatusMessage(null), 3500)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al guardar contratista: ${err.message}` })
    } finally {
      setSavingRateCard(false)
    }
  }

  // Guardar edición de roles organizacionales dinámicos
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
      await loadOrgRoles()
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

  // Filtrado de tarifas para la tabla histórica (Crawler Omnicanal)
  const filteredRateCards = useMemo(() => {
    return rateCards.filter(rc => {
      if (filterTableCenter !== 'todos' && rc.admin_center !== filterTableCenter) return false
      if (rateTableSearch && !matchesUniversalSearch(rc, rateTableSearch)) return false
      return true
    })
  }, [rateCards, filterTableCenter, rateTableSearch])

  // -------------------------------------------------------------
  // PILAR A: SELECCIÓN DE VENTANAS TEMPORALES INTELIGENTES
  // -------------------------------------------------------------
  const handleSelectTimeWindow = (preset) => {
    setTimeWindowPreset(preset)
    if (sortedRecordedPeriods.length < 2) return

    const latestIdx = sortedRecordedPeriods.length - 1
    const targetPeriod = sortedRecordedPeriods[latestIdx].period

    if (preset === 'month') {
      const baseIdx = Math.max(0, latestIdx - 1)
      setComparePeriodBase(sortedRecordedPeriods[baseIdx].period)
      setComparePeriodTarget(targetPeriod)
    } else if (preset === 'quarter') {
      const baseIdx = Math.max(0, latestIdx - 5)
      setComparePeriodBase(sortedRecordedPeriods[baseIdx].period)
      setComparePeriodTarget(targetPeriod)
    } else if (preset === 'semester') {
      const baseIdx = Math.max(0, latestIdx - 11)
      setComparePeriodBase(sortedRecordedPeriods[baseIdx].period)
      setComparePeriodTarget(targetPeriod)
    } else if (preset === 'year') {
      const targetYear = sortedRecordedPeriods[latestIdx].year
      const firstOfYear = sortedRecordedPeriods.find(p => p.year === targetYear) || sortedRecordedPeriods[0]
      setComparePeriodBase(firstOfYear.period)
      setComparePeriodTarget(targetPeriod)
    }
  }

  // -------------------------------------------------------------
  // PILAR B, C & D: CÁLCULOS DEL COMPARADOR, SEMÁFORO Y RUBROS
  // -------------------------------------------------------------
  const comparisonResults = useMemo(() => {
    const baseRows = comparisonCards.filter(c => c.period === comparePeriodBase)
    const targetRows = comparisonCards.filter(c => c.period === comparePeriodTarget)

    const baseDollar = baseRows.length > 0 && baseRows[0].dollar_rate ? parseFloat(baseRows[0].dollar_rate) : 1450
    const targetDollar = targetRows.length > 0 && targetRows[0].dollar_rate ? parseFloat(targetRows[0].dollar_rate) : 1500
    const dollarDiffArs = targetDollar - baseDollar
    const dollarDiffPct = baseDollar > 0 ? parseFloat(((dollarDiffArs / baseDollar) * 100).toFixed(2)) : 0

    // Mapa de rubros de contratistas desde la tabla workers
    const contractorTradeMap = new Map()
    workers.forEach(w => {
      if (w.work_group && w.trade) {
        contractorTradeMap.set(w.work_group, w.trade)
      }
    })

    const resultMap = new Map()

    // 1. Cargar base
    baseRows.forEach(r => {
      const key = `${r.admin_center}___${r.entity_name}`
      resultMap.set(key, {
        admin_center: r.admin_center,
        entity_name: r.entity_name,
        trade: contractorTradeMap.get(r.entity_name) || (r.admin_center === 'ASTILLERO' ? 'SINDICATO' : 'General'),
        baseOficialArs: parseFloat(r.rate_oficial_ars) || 0,
        baseOficialUsd: parseFloat(r.rate_oficial_usd) || 0,
        targetOficialArs: 0,
        targetOficialUsd: 0,
        hasAyudante: r.has_ayudante,
        baseAyudanteArs: r.rate_ayudante_ars ? parseFloat(r.rate_ayudante_ars) : null,
        baseAyudanteUsd: r.rate_ayudante_usd ? parseFloat(r.rate_ayudante_usd) : null,
        targetAyudanteArs: null,
        targetAyudanteUsd: null
      })
    })

    // 2. Merge target
    targetRows.forEach(r => {
      const key = `${r.admin_center}___${r.entity_name}`
      if (!resultMap.has(key)) {
        resultMap.set(key, {
          admin_center: r.admin_center,
          entity_name: r.entity_name,
          trade: contractorTradeMap.get(r.entity_name) || (r.admin_center === 'ASTILLERO' ? 'SINDICATO' : 'General'),
          baseOficialArs: 0,
          baseOficialUsd: 0,
          targetOficialArs: parseFloat(r.rate_oficial_ars) || 0,
          targetOficialUsd: parseFloat(r.rate_oficial_usd) || 0,
          hasAyudante: r.has_ayudante,
          baseAyudanteArs: null,
          baseAyudanteUsd: null,
          targetAyudanteArs: r.rate_ayudante_ars ? parseFloat(r.rate_ayudante_ars) : null,
          targetAyudanteUsd: r.rate_ayudante_usd ? parseFloat(r.rate_ayudante_usd) : null
        })
      } else {
        const item = resultMap.get(key)
        item.targetOficialArs = parseFloat(r.rate_oficial_ars) || 0
        item.targetOficialUsd = parseFloat(r.rate_oficial_usd) || 0
        item.hasAyudante = r.has_ayudante || item.hasAyudante
        item.targetAyudanteArs = r.rate_ayudante_ars ? parseFloat(r.rate_ayudante_ars) : null
        item.targetAyudanteUsd = r.rate_ayudante_usd ? parseFloat(r.rate_ayudante_usd) : null
      }
    })

    // 3. Obtener el aumento de Oficial de Astillero (Ancla Testigo Oficial)
    const astilleroOficialItem = resultMap.get('ASTILLERO___OFICIAL')
    let oficialAstilleroPct = 0
    if (astilleroOficialItem && astilleroOficialItem.baseOficialArs > 0) {
      oficialAstilleroPct = parseFloat((((astilleroOficialItem.targetOficialArs - astilleroOficialItem.baseOficialArs) / astilleroOficialItem.baseOficialArs) * 100).toFixed(2))
    }

    // 4. Calcular dispersión por rubro (Media Inter-Pares)
    const rubroAverages = new Map()
    Array.from(resultMap.values()).forEach(item => {
      if (item.admin_center === 'CONTRATISTA' && item.targetOficialArs > 0) {
        const t = item.trade || 'General'
        if (!rubroAverages.has(t)) {
          rubroAverages.set(t, { totalArs: 0, count: 0 })
        }
        const entry = rubroAverages.get(t)
        entry.totalArs += item.targetOficialArs
        entry.count += 1
      }
    })

    // 5. Mapear cada fila con Semáforo y Brechas
    const rows = Array.from(resultMap.values()).map(item => {
      const diffOficialArs = item.targetOficialArs - item.baseOficialArs
      const diffOficialPct = item.baseOficialArs > 0 
        ? parseFloat(((diffOficialArs / item.baseOficialArs) * 100).toFixed(2))
        : (item.targetOficialArs > 0 ? 100 : 0)

      const diffOficialUsd = item.targetOficialUsd - item.baseOficialUsd
      const diffOficialUsdPct = item.baseOficialUsd > 0 
        ? parseFloat(((diffOficialUsd / item.baseOficialUsd) * 100).toFixed(2))
        : (item.targetOficialUsd > 0 ? 100 : 0)

      const brechaAstillero = parseFloat((diffOficialPct - oficialAstilleroPct).toFixed(2))

      // Media de su rubro
      const rubroData = rubroAverages.get(item.trade)
      const avgRubroRate = rubroData && rubroData.count > 0 ? (rubroData.totalArs / rubroData.count) : item.targetOficialArs
      const diffVsRubroPct = avgRubroRate > 0 ? parseFloat((((item.targetOficialArs - avgRubroRate) / avgRubroRate) * 100).toFixed(1)) : 0

      // Semáforo gerencial
      let trafficLight = 'AMARILLO'
      let trafficReason = 'Tarifa en equilibrio con paritarias'
      if (item.admin_center === 'CONTRATISTA') {
        if (brechaAstillero > 5.0 || diffOficialUsdPct > 10.0) {
          trafficLight = 'ROJO'
          trafficReason = brechaAstillero > 5.0 
            ? `Supera al gremio Astillero por +${brechaAstillero}%`
            : `Costo en dólares subió +${diffOficialUsdPct}% USD`
        } else if (brechaAstillero < -2.0 || diffOficialUsdPct < 0) {
          trafficLight = 'VERDE'
          trafficReason = diffOficialUsdPct < 0 
            ? `Hora en dólares licuada ${diffOficialUsdPct}% USD` 
            : `Aumento inferior al gremio (${brechaAstillero}%)`
        }
      }

      return {
        ...item,
        diffOficialArs,
        diffOficialPct,
        diffOficialUsd,
        diffOficialUsdPct,
        brechaAstillero,
        avgRubroRate: Math.round(avgRubroRate),
        diffVsRubroPct,
        trafficLight,
        trafficReason
      }
    })

    // Métricas globales
    const astilleroDiffs = rows.filter(r => r.admin_center === 'ASTILLERO' && r.baseOficialArs > 0)
    const avgAstilleroPct = astilleroDiffs.length > 0 
      ? parseFloat((astilleroDiffs.reduce((acc, curr) => acc + curr.diffOficialPct, 0) / astilleroDiffs.length).toFixed(2))
      : 0
    const avgAstilleroUsdPct = astilleroDiffs.length > 0 
      ? parseFloat((astilleroDiffs.reduce((acc, curr) => acc + curr.diffOficialUsdPct, 0) / astilleroDiffs.length).toFixed(2))
      : 0

    const contractorRows = rows.filter(r => r.admin_center === 'CONTRATISTA')
    const contractorWithBase = contractorRows.filter(r => r.baseOficialArs > 0)
    const avgContractorPct = contractorWithBase.length > 0
      ? parseFloat((contractorWithBase.reduce((acc, curr) => acc + curr.diffOficialPct, 0) / contractorWithBase.length).toFixed(2))
      : 0
    const avgContractorUsdPct = contractorWithBase.length > 0
      ? parseFloat((contractorWithBase.reduce((acc, curr) => acc + curr.diffOficialUsdPct, 0) / contractorWithBase.length).toFixed(2))
      : 0

    // Contadores de Semáforos
    const redCount = contractorRows.filter(r => r.trafficLight === 'ROJO').length
    const yellowCount = contractorRows.filter(r => r.trafficLight === 'AMARILLO').length
    const greenCount = contractorRows.filter(r => r.trafficLight === 'VERDE').length

    return {
      baseDollar,
      targetDollar,
      dollarDiffArs,
      dollarDiffPct,
      oficialAstilleroPct,
      rows,
      avgAstilleroPct,
      avgAstilleroUsdPct,
      avgContractorPct,
      avgContractorUsdPct,
      redCount,
      yellowCount,
      greenCount
    }
  }, [comparisonCards, comparePeriodBase, comparePeriodTarget, workers])

  // -------------------------------------------------------------
  // MOTOR DE CÁLCULO PARA EL GRÁFICO DE FLUCTUACIÓN MULTIVARIABLE
  // 3 ANCLAS: DÓLAR FX, PARITARIA SINDICAL ASTILLERO E INFLACIÓN MENSUAL
  // -------------------------------------------------------------
  const fluctuationChartData = useMemo(() => {
    if (sortedRecordedPeriods.length === 0) {
      return { points: [], minPct: -5, maxPct: 15, minNom: 0, maxNom: 20000, summary: null }
    }

    // 1. Filtrar los períodos dentro de la ventana de tiempo seleccionada
    const baseIdx = sortedRecordedPeriods.findIndex(p => p.period === comparePeriodBase)
    const targetIdx = sortedRecordedPeriods.findIndex(p => p.period === comparePeriodTarget)

    const startIdx = baseIdx !== -1 && targetIdx !== -1 ? Math.min(baseIdx, targetIdx) : 0
    const endIdx = baseIdx !== -1 && targetIdx !== -1 ? Math.max(baseIdx, targetIdx) : sortedRecordedPeriods.length - 1
    const windowPeriods = sortedRecordedPeriods.slice(startIdx, endIdx + 1)

    if (windowPeriods.length === 0) {
      return { points: [], minPct: -5, maxPct: 15, minNom: 0, maxNom: 20000, summary: null }
    }

    // 2. Extraer puntos cronológicos para las 4 variables
    let compoundInflationFactor = 1.0

    const rawPoints = windowPeriods.map((wp, idx) => {
      const periodCards = comparisonCards.filter(c => c.period === wp.period)
      const macroRecord = macroVariables.find(m => m.year === wp.year && m.month === wp.month)

      // a) Dólar FX
      const dollar = periodCards.length > 0 && periodCards[0].dollar_rate
        ? parseFloat(periodCards[0].dollar_rate)
        : (macroRecord ? parseFloat(macroRecord.dollar_rate) : 1500)

      // b) Inflación mensual (%) que aplica para ambas quincenas (1Q y 2Q)
      const monthlyInf = periodCards.length > 0 && periodCards[0].monthly_inflation_pct !== undefined && periodCards[0].monthly_inflation_pct !== null
        ? parseFloat(periodCards[0].monthly_inflation_pct)
        : (macroRecord ? parseFloat(macroRecord.monthly_inflation_pct) : 3.5)

      // Compounding aproximado por quincena (la mitad del mes por quincena)
      if (idx > 0) {
        compoundInflationFactor = compoundInflationFactor * (1 + (monthlyInf / 200))
      }
      const cumInflationPct = Number(((compoundInflationFactor - 1) * 100).toFixed(2))

      // c) Paritaria Oficial Astillero (Ancla Testigo Sindical)
      const astilleroCard = periodCards.find(c => c.admin_center === 'ASTILLERO' && (c.entity_name === 'OFICIAL' || c.entity_name === 'OFICIAL BLACK'))
      const astilleroRate = astilleroCard ? parseFloat(astilleroCard.rate_oficial_ars) : 16365.76

      // d) Contratista seleccionado (o promedio si es TODOS)
      let contractorRate = 0
      let contractorUsd = 0
      if (selectedZoomContractor !== 'TODOS') {
        const contCard = periodCards.find(c => c.entity_name === selectedZoomContractor)
        if (contCard) {
          contractorRate = parseFloat(contCard.rate_oficial_ars) || 0
          contractorUsd = parseFloat(contCard.rate_oficial_usd) || 0
        }
      } else {
        const allContCards = periodCards.filter(c => c.admin_center === 'CONTRATISTA' && parseFloat(c.rate_oficial_ars) > 0)
        if (allContCards.length > 0) {
          contractorRate = allContCards.reduce((acc, c) => acc + parseFloat(c.rate_oficial_ars), 0) / allContCards.length
          contractorUsd = allContCards.reduce((acc, c) => acc + parseFloat(c.rate_oficial_usd), 0) / allContCards.length
        }
      }

      return {
        period: wp.period,
        year: wp.year,
        month: wp.month,
        quincena: wp.quincena,
        shortLabel: `${MONTH_NAMES[wp.month - 1].slice(0, 3)} ${wp.quincena}Q`,
        dollar,
        monthlyInf,
        cumInflationPct,
        astilleroRate,
        contractorRate: Number(contractorRate.toFixed(2)),
        contractorUsd: Number(contractorUsd.toFixed(2))
      }
    })

    // 3. Normalización y cálculo de variaciones relativas al punto base (idx 0)
    const basePoint = rawPoints[0]
    const baseCont = basePoint.contractorRate > 0 ? basePoint.contractorRate : 1
    const baseAst = basePoint.astilleroRate > 0 ? basePoint.astilleroRate : 1
    const baseDol = basePoint.dollar > 0 ? basePoint.dollar : 1

    let minPct = 0
    let maxPct = 0
    let minNom = Infinity
    let maxNom = -Infinity

    const points = rawPoints.map((pt, idx) => {
      const contPct = idx === 0 || basePoint.contractorRate === 0
        ? 0
        : Number((((pt.contractorRate - baseCont) / baseCont) * 100).toFixed(2))
      const astPct = idx === 0
        ? 0
        : Number((((pt.astilleroRate - baseAst) / baseAst) * 100).toFixed(2))
      const dolPct = idx === 0
        ? 0
        : Number((((pt.dollar - baseDol) / baseDol) * 100).toFixed(2))
      const infPct = pt.cumInflationPct

      minPct = Math.min(minPct, contPct, astPct, dolPct, infPct)
      maxPct = Math.max(maxPct, contPct, astPct, dolPct, infPct)

      if (pt.contractorRate > 0) {
        minNom = Math.min(minNom, pt.contractorRate, pt.astilleroRate)
        maxNom = Math.max(maxNom, pt.contractorRate, pt.astilleroRate)
      } else {
        minNom = Math.min(minNom, pt.astilleroRate)
        maxNom = Math.max(maxNom, pt.astilleroRate)
      }

      return {
        ...pt,
        contPct,
        astPct,
        dolPct,
        infPct
      }
    })

    if (minNom === Infinity) minNom = 0
    if (maxNom === -Infinity) maxNom = 20000

    minPct = Math.floor(minPct - 2)
    maxPct = Math.ceil(maxPct + 3)
    if (maxPct - minPct < 10) maxPct = minPct + 10

    const lastPoint = points[points.length - 1] || points[0]
    const netContPct = lastPoint ? lastPoint.contPct : 0
    const netAstPct = lastPoint ? lastPoint.astPct : 0
    const netDolPct = lastPoint ? lastPoint.dolPct : 0
    const netInfPct = lastPoint ? lastPoint.infPct : 0

    const brechaVsAst = Number((netContPct - netAstPct).toFixed(2))
    const brechaVsInf = Number((netContPct - netInfPct).toFixed(2))
    const brechaVsDol = Number((netContPct - netDolPct).toFixed(2))

    return {
      points,
      minPct,
      maxPct,
      minNom: Math.floor(minNom * 0.95),
      maxNom: Math.ceil(maxNom * 1.05),
      summary: {
        basePoint,
        lastPoint,
        netContPct,
        netAstPct,
        netDolPct,
        netInfPct,
        brechaVsAst,
        brechaVsInf,
        brechaVsDol,
        targetName: selectedZoomContractor === 'TODOS' ? 'Promedio General de Contratistas' : selectedZoomContractor
      }
    }
  }, [sortedRecordedPeriods, comparePeriodBase, comparePeriodTarget, comparisonCards, macroVariables, selectedZoomContractor])

  // -------------------------------------------------------------
  // LÓGICA DE NÓMINA GENERAL
  // -------------------------------------------------------------
  const uniqueWorkGroups = useMemo(() => {
    const set = new Set()
    workers.forEach(w => {
      if (w.work_group) set.add(w.work_group)
    })
    return Array.from(set).sort()
  }, [workers])

  // Grupos clasificados por Centro Administrativo
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

    return {
      sinTelefonoAstillero: sinTelefonoAstillero.length,
      sinCostoAstillero: sinCostoAstillero.length,
      sinCostoContratistas: sinCostoContratistas.length,
      sinConsumiblesContratistas: sinConsumiblesContratistas.length,
      sinPermisos: sinPermisos.length
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

  // Cambio de Centro Administrativo en Modal de Operario
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
        safety_items: formData.safety_items,
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
        const { error } = await supabase
          .from('workers')
          .update(payload)
          .eq('id', editingWorker.id)

        if (error) throw error

        // Si es Contratista/Taller, sincronizar permiso 3ros y Rubros Habilitados en todo su Grupo de Trabajo
        if (finalGroup !== 'ASTILLERO') {
          await supabase
            .from('workers')
            .update({
              can_charge_third_party: payload.can_charge_third_party,
              trade: payload.trade
            })
            .eq('work_group', finalGroup)
        }

        setWorkers(prev => prev.map(w => {
          if (w.id === editingWorker.id) return { ...w, ...payload }
          if (finalGroup !== 'ASTILLERO' && w.work_group === finalGroup) {
            return {
              ...w,
              can_charge_third_party: payload.can_charge_third_party,
              trade: payload.trade
            }
          }
          return w
        }))
        await auditService.logRowAction({
          action: 'MODAL_SAVE',
          entityType: 'workers',
          entityId: editingWorker.id,
          entityName: payload.name,
          changes: payload,
          sheetName: 'Personal · Nómina de Operarios',
          moduleRoute: '/personal'
        })
        setStatusMessage({ type: 'success', text: `Registro de ${payload.name} (${finalGroup}) actualizado con éxito.` })
        setEditingWorker(null)
      } else {
        const { data, error } = await supabase
          .from('workers')
          .insert([payload])
          .select()

        if (error) throw error

        const newRecord = data && data[0] ? data[0] : { ...payload, id: Date.now().toString() }
        setWorkers(prev => [newRecord, ...prev])
        await auditService.logRowAction({
          action: 'ROW_INSERT',
          entityType: 'workers',
          entityId: newRecord.id,
          entityName: payload.name,
          rowData: payload,
          sheetName: 'Personal · Nómina de Operarios',
          moduleRoute: '/personal'
        })
        setStatusMessage({ type: 'success', text: `Operario ${payload.name} agregado al Grupo ${finalGroup}.` })
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
      
      if (!String(worker.id).startsWith('worker-local-')) {
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
      }
    } catch (err) {
      console.error(err)
      loadWorkers()
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
      
      if (!String(worker.id).startsWith('worker-local-')) {
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
      }
    } catch (err) {
      console.error(err)
      loadWorkers()
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
      loadWorkers()
    }
  }

  // -------------------------------------------------------------
  // MODO HOJA DE CÁLCULO (GOOGLE SHEETS / EXCEL): PADRÓN & TARIFARIO
  // -------------------------------------------------------------
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
      loadWorkers()
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
      loadWorkers()
    }
  }

  const nominaSearchInputRef = useRef(null)
  const rateSearchInputRef = useRef(null)
  const [inlineCellEdit, setInlineCellEdit] = useState(null) // { rowId, colKey, value }
  const [inlineRateEdit, setInlineRateEdit] = useState(null) // { rowId, colKey, value }

  const showGridFeedback = useCallback((type, text) => {
    setStatusMessage({ type, text })
    setTimeout(() => setStatusMessage(null), 3200)
  }, [])

  const nominaColumns = useMemo(() => [
    { key: 'name', label: 'Nombre y Apellido' },
    { key: 'category', label: 'Categoría' },
    { key: 'trade', label: 'Rubro' },
    { key: 'hourly_rate_ars', label: 'AR$/Hora' },
    { key: 'work_group', label: 'Grupo de Trabajo' },
    { key: 'admin_center', label: 'Centro Admin' }
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
      dbPatch = { admin_center: valid }
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

    if (!String(rowId).startsWith('worker-local-')) {
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
    }
    return dbPatch[colKey]
  }, [workers, dollarRate, nominaColumns])

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
      loadWorkers()
    }
  }, [applyWorkerSinglePatch, showGridFeedback])

  const nominaGrid = useSpreadsheetGrid({
    rows: filteredWorkers,
    columns: nominaColumns,
    getRowId: (w) => w.id,
    storageKey: 'aloncar_grid_personal',
    onBatchUpdate: handleNominaBatchUpdate,
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
      loadWorkers()
    }
  }

  // Grid 2: Tarifas Guardadas (rate_cards) respetando !rc.is_locked
  const rateColumns = useMemo(() => [
    { key: 'rate_oficial_ars', label: 'Oficial AR$' },
    { key: 'rate_ayudante_ars', label: 'Ayudante AR$' }
  ], [])

  const canEditRateCell = useCallback((rc, colKeyOrDef) => {
    if (!rc || rc.is_locked) return false
    const key = typeof colKeyOrDef === 'string' ? colKeyOrDef : colKeyOrDef?.key
    if (key === 'rate_ayudante_ars') {
      return rc.admin_center === 'CONTRATISTA' && Boolean(rc.has_ayudante || rc.rate_ayudante_ars !== null)
    }
    return true
  }, [])

  const applyRateCardSinglePatch = useCallback(async (rowId, colKey, rawValue) => {
    if (auditService.isInvalidEventOrObjectScalar(rawValue)) return null
    const targetRc = rateCards.find(r => r.id === rowId)
    if (!targetRc) return null
    if (targetRc.is_locked) {
      showGridFeedback('error', `🔒 La tarifa de ${targetRc.entity_name} (${targetRc.period}) está bloqueada.`)
      return null
    }
    if (colKey === 'rate_ayudante_ars' && targetRc.admin_center === 'ASTILLERO') {
      return null
    }

    const oldVal = targetRc[colKey]
    const ars = Math.max(0, parseFloat(rawValue) || 0)
    const dRate = parseFloat(targetRc.dollar_rate) || dollarRate || 1500
    const usd = dRate > 0 ? Number((ars / dRate).toFixed(2)) : 0

    const dbPatch = colKey === 'rate_oficial_ars'
      ? { rate_oficial_ars: ars, rate_oficial_usd: usd, updated_at: new Date().toISOString() }
      : { rate_ayudante_ars: ars, rate_ayudante_usd: usd, has_ayudante: true, updated_at: new Date().toISOString() }

    setRateCards(prev => prev.map(r => r.id === rowId ? { ...r, ...dbPatch } : r))

    const { error } = await supabase
      .from('rate_cards')
      .update(dbPatch)
      .eq('id', rowId)
    if (error) throw error

    await auditService.logCellChange({
      entityType: 'rate_cards',
      entityId: rowId,
      entityName: `${targetRc.entity_name} (${targetRc.period})`,
      field: colKey,
      fieldLabel: colKey === 'rate_oficial_ars' ? 'Oficial AR$' : 'Ayudante AR$',
      oldValue: oldVal,
      newValue: ars,
      sheetName: 'Personal · Tarifario Quincenal',
      moduleRoute: '/personal'
    })

    // Si pertenece a la quincena activa, sincronizar automáticamente con el padrón de operarios
    if (targetRc.period === currentPeriodKey && ars > 0) {
      if (targetRc.admin_center === 'ASTILLERO' && colKey === 'rate_oficial_ars') {
        await supabase
          .from('workers')
          .update({ hourly_rate_ars: ars, hourly_rate_usd: usd })
          .eq('admin_center', 'ASTILLERO')
          .eq('category', targetRc.entity_name)
        setWorkers(prev => prev.map(w =>
          (w.admin_center === 'ASTILLERO' && w.category === targetRc.entity_name)
            ? { ...w, hourly_rate_ars: ars, hourly_rate_usd: usd }
            : w
        ))
        if (targetRc.entity_name === 'OFICIAL') setRateOficial(ars)
        if (targetRc.entity_name === 'AYUDANTE') setRateAyudante(ars)
      } else if (targetRc.admin_center === 'CONTRATISTA') {
        if (colKey === 'rate_ayudante_ars') {
          await supabase
            .from('workers')
            .update({ hourly_rate_ars: ars, hourly_rate_usd: usd })
            .eq('admin_center', 'CONTRATISTA')
            .or(`work_group.eq.${targetRc.entity_name} AYUDANTE,category.eq.${targetRc.entity_name} AYUDANTE`)
          setWorkers(prev => prev.map(w => {
            if (w.admin_center !== 'CONTRATISTA') return w
            const isAy = (w.work_group === `${targetRc.entity_name} AYUDANTE`) || (w.category === `${targetRc.entity_name} AYUDANTE`)
            return isAy ? { ...w, hourly_rate_ars: ars, hourly_rate_usd: usd } : w
          }))
        } else {
          await supabase
            .from('workers')
            .update({ hourly_rate_ars: ars, hourly_rate_usd: usd })
            .eq('admin_center', 'CONTRATISTA')
            .eq('work_group', targetRc.entity_name)
            .neq('category', `${targetRc.entity_name} AYUDANTE`)
          setWorkers(prev => prev.map(w => {
            if (w.admin_center !== 'CONTRATISTA') return w
            const isAy = (w.work_group === `${targetRc.entity_name} AYUDANTE`) || (w.category === `${targetRc.entity_name} AYUDANTE`)
            return (w.work_group === targetRc.entity_name && !isAy) ? { ...w, hourly_rate_ars: ars, hourly_rate_usd: usd } : w
          }))
        }
      }
    }

    return ars
  }, [rateCards, dollarRate, currentPeriodKey, showGridFeedback])

  const handleRatesBatchUpdate = useCallback(async ({ colKey, newValue, targetIds, revertMap, isRevert }) => {
    try {
      if (isRevert && revertMap) {
        for (const [id, oldVal] of Object.entries(revertMap)) {
          await applyRateCardSinglePatch(id, colKey, oldVal)
        }
      } else if (Array.isArray(targetIds)) {
        for (const id of targetIds) {
          await applyRateCardSinglePatch(id, colKey, newValue)
        }
      }
    } catch (err) {
      console.error(err)
      showGridFeedback('error', `Error actualizando tarifas: ${err.message}`)
      loadRateCards(currentPeriodKey)
    }
  }, [applyRateCardSinglePatch, currentPeriodKey, showGridFeedback])

  const ratesGrid = useSpreadsheetGrid({
    rows: filteredRateCards,
    columns: rateColumns,
    getRowId: (rc) => rc.id,
    storageKey: 'aloncar_grid_tarifas',
    canEditCell: canEditRateCell,
    onBatchUpdate: handleRatesBatchUpdate,
    onFocusSearch: () => rateSearchInputRef.current?.focus(),
    onCellActivate: (row, colDef) => {
      if (!row || !colDef) return
      if (row.is_locked) {
        showGridFeedback('error', `🔒 Tarifa bloqueada (${row.period}): no admite edición directa.`)
        return
      }
      if (colDef.key === 'rate_ayudante_ars' && row.admin_center === 'ASTILLERO') return
      setInlineRateEdit({
        rowId: row.id,
        colKey: colDef.key,
        value: row[colDef.key] ?? ''
      })
    },
    showFeedback: showGridFeedback
  })

  const commitInlineRateEdit = async () => {
    if (!inlineRateEdit) return
    const { rowId, colKey, value } = inlineRateEdit
    const rc = rateCards.find(r => r.id === rowId)
    setInlineRateEdit(null)
    if (!rc || rc.is_locked) return

    const oldVal = rc[colKey]
    if (Number(oldVal || 0) === Number(value || 0)) return

    try {
      const savedVal = await applyRateCardSinglePatch(rowId, colKey, value)
      if (savedVal !== null) {
        const colDef = rateColumns.find(c => c.key === colKey)
        ratesGrid.pushUndoAction({
          colKey,
          colLabel: colDef?.label || colKey,
          actionLabel: `Editar tarifa ${rc.entity_name} (${rc.period})`,
          previousValues: { [rowId]: oldVal },
          newValue: savedVal,
          timestamp: Date.now()
        })
        showGridFeedback('success', `Tarifa de ${rc.entity_name} actualizada a $${savedVal.toLocaleString('es-AR')}. (Ctrl+Z deshacer)`)
      }
    } catch (err) {
      console.error(err)
      showGridFeedback('error', `Error al guardar tarifa: ${err.message}`)
      loadRateCards(currentPeriodKey)
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-10">
      {/* ZONA 1 (CONTEXTO): CABECERA & NAVEGACIÓN PRINCIPAL */}
      <div className="alon-zone-context rounded-2xl p-5 shadow-xl flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span className="text-slate-300">Recursos Humanos & Mano de Obra</span>
            <span>&bull;</span>
            <span className="text-primary font-medium">GS-008: B.D.NewSystemm</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <Users className="w-8 h-8 text-primary" />
            <span>Padrón de Personal, Talleres & Tarifas</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestión centralizada de personal propio (Astillero), cuadrillas externas (Contratistas), talleres y costos quincenales.
          </p>
        </div>

        {/* SELECTOR DE PESTAÑAS PRINCIPALES (BOTONES ESTANDARIZADOS CON LÍMITES DEFINIDOS) */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950/90 p-1.5 rounded-2xl border border-slate-800 shadow-xl">
          <button
            type="button"
            onClick={() => setActiveTab('nomina')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'nomina'
                ? 'bg-gradient-to-r from-primary to-blue-600 text-slate-950 border-primary shadow-lg shadow-cyan-500/25 font-black'
                : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-slate-800 hover:border-slate-700 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4 text-cyan-400" />
            <span>Padrón de Personal ({totalCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tarifario')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'tarifario'
                ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 border-emerald-400 shadow-lg shadow-emerald-500/25 font-black'
                : 'bg-slate-900/80 hover:bg-slate-800 text-emerald-400/90 border-slate-800 hover:border-emerald-800/60 hover:text-emerald-300'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Tarifario Quincenal</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono font-bold">
              {currentPeriodKey}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analisis')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center gap-2 border cursor-pointer ${
              activeTab === 'analisis'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-purple-400 shadow-lg shadow-purple-500/25 font-black'
                : 'bg-slate-900/80 hover:bg-slate-800 text-purple-400/90 border-slate-800 hover:border-purple-800/60 hover:text-purple-300'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Análisis de Variación & FX</span>
          </button>
        </div>
      </div>

      {/* MENSAJES DE ESTADO */}
      {statusMessage && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
          statusMessage.type === 'success' 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
            : statusMessage.type === 'info'
            ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300'
            : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
        }`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
          ) : (
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          )}
          <div className="text-sm font-medium">{statusMessage.text}</div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 3: DASHBOARD GERENCIAL DE ANÁLISIS DE VARIACIÓN, PARITARIAS & FX */}
      {/* ========================================================================= */}
      {activeTab === 'analisis' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* BARRA SUPERIOR: CONTROLES DE ANÁLISIS & PRESTADOR SELECCIONADO */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  <h2 className="text-base font-bold text-white">
                    Fluctuación de Costos vs. 3 Anclas Determinísticas
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Comparativa dinámica frente al <strong>Dólar Oficial FX</strong>, la <strong>Paritaria Sindical de Astillero</strong> y la <strong>Inflación Mensual</strong> fijada por Administrador.
                </p>
              </div>

              {/* Selector de Contratista a Evaluar & Botón Actualizar */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-700">
                  <HardHat className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-slate-400">Prestador / Sujeto:</span>
                  <select
                    value={selectedZoomContractor}
                    onChange={(e) => {
                      setSelectedZoomContractor(e.target.value)
                      setHoveredPointIndex(null)
                    }}
                    className="bg-slate-900 border border-slate-700 text-xs font-extrabold text-amber-300 rounded-lg px-2.5 py-1 focus:outline-none focus:border-amber-400 font-mono cursor-pointer"
                  >
                    <option value="TODOS">👥 Promedio General de Contratistas</option>
                    {uniqueContractorList.map(c => (
                      <option key={`eval-${c}`} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={loadComparisonData}
                  className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
                  title="Actualizar datos históricos"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingComparison ? 'animate-spin' : ''}`} />
                  <span>Actualizar</span>
                </button>
              </div>
            </div>

            {/* SELECTOR DE VENTANA TEMPORAL (PILAR A) */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mr-1">
                  Alcance:
                </span>

                {[
                  { id: 'month', label: '1 Mes (2Q)', desc: 'Últimas 2 quincenas' },
                  { id: 'quarter', label: 'Trimestre (6Q)', desc: 'Últimos 3 meses' },
                  { id: 'semester', label: 'Semestre (12Q)', desc: 'Últimos 6 meses' },
                  { id: 'year', label: 'Año Completo (YTD)', desc: 'Evolución anual' },
                  { id: 'custom', label: '⚙️ Rango Libre', desc: 'Selección manual' }
                ].map(w => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => handleSelectTimeWindow(w.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border ${
                      timeWindowPreset === w.id
                        ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white border-purple-400 shadow-md shadow-purple-950/50'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                    }`}
                    title={w.desc}
                  >
                    {w.label}
                  </button>
                ))}
              </div>

              {/* Selector Manual si está activo Rango Libre */}
              {timeWindowPreset === 'custom' ? (
                <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-xl border border-purple-800/80">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400 font-bold">Desde:</span>
                    <select
                      value={comparePeriodBase}
                      onChange={(e) => setComparePeriodBase(e.target.value)}
                      className="bg-slate-900 text-cyan-400 font-mono font-bold rounded px-2 py-1 text-xs focus:outline-none"
                    >
                      {sortedRecordedPeriods.map(p => (
                        <option key={`base-${p.period}`} value={p.period}>{p.period}</option>
                      ))}
                    </select>
                  </div>
                  <span className="text-slate-600 font-bold">&rarr;</span>
                  <div className="flex items-center gap-1.5 text-xs">
                    <span className="text-slate-400 font-bold">Hasta:</span>
                    <select
                      value={comparePeriodTarget}
                      onChange={(e) => setComparePeriodTarget(e.target.value)}
                      className="bg-slate-900 text-purple-400 font-mono font-bold rounded px-2 py-1 text-xs focus:outline-none"
                    >
                      {sortedRecordedPeriods.map(p => (
                        <option key={`target-${p.period}`} value={p.period}>{p.period}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 flex items-center gap-2">
                  <span>Período evaluado:</span>
                  <span className="font-mono font-bold text-cyan-400">{comparePeriodBase}</span>
                  <span className="text-slate-600 font-bold">&rarr;</span>
                  <span className="font-mono font-bold text-purple-400">{comparePeriodTarget}</span>
                </div>
              )}
            </div>

            {/* 5 TARJETAS KPI FIJAS: SEMÁFORO INDIVIDUAL Y LAS 3 ANCLAS DETERMINÍSTICAS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 pt-2">
              {/* KPI 1: Semáforo Ejecutivo del Sujeto Evaluado */}
              {(() => {
                const s = fluctuationChartData.summary
                const netCont = s ? s.netContPct : 0
                const brechaAst = s ? s.brechaVsAst : 0
                const isRed = brechaAst > 5.0
                const isGreen = brechaAst < -2.0 || netCont < 0
                const statusColor = isRed ? 'rose' : isGreen ? 'emerald' : 'amber'
                const statusLabel = isRed ? 'ALERTA ROJA' : isGreen ? 'FAVORABLE' : 'EN PARÁMETRO'

                return (
                  <div className={`p-3.5 rounded-xl bg-slate-950 border border-${statusColor}-800/80 space-y-1.5`}>
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-slate-400 truncate max-w-[120px]" title={s?.targetName}>
                        {s?.targetName}
                      </span>
                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-black border ${
                        isRed ? 'bg-rose-950 text-rose-300 border-rose-700' : isGreen ? 'bg-emerald-950 text-emerald-300 border-emerald-700' : 'bg-amber-950 text-amber-300 border-amber-700'
                      }`}>
                        {statusLabel}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className={`text-2xl font-black font-mono ${
                        netCont > 0 ? (isRed ? 'text-rose-400' : 'text-amber-300') : 'text-slate-200'
                      }`}>
                        {netCont > 0 ? `+${netCont}%` : `${netCont}%`}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">AR$/h</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate">
                      Brecha vs Sindicato: <strong className={brechaAst > 0 ? 'text-rose-400 font-mono' : 'text-emerald-400 font-mono'}>
                        {brechaAst > 0 ? `+${brechaAst}%` : `${brechaAst}%`}
                      </strong>
                    </span>
                  </div>
                )
              })()}

              {/* KPI 2: Ancla 1 - Dólar Oficial FX */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-bold uppercase tracking-wider text-[10px] text-emerald-400">Ancla 1: Dólar FX</span>
                  <span className="font-mono text-emerald-400 font-bold">${comparisonResults.targetDollar}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-white font-mono">
                    {comparisonResults.dollarDiffPct > 0 ? `+${comparisonResults.dollarDiffPct}%` : `${comparisonResults.dollarDiffPct}%`}
                  </span>
                  <span className="text-xs text-slate-500 font-mono">
                    (${comparisonResults.baseDollar} &rarr; ${comparisonResults.targetDollar})
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Ritmo cambiario en el período
                </span>
              </div>

              {/* KPI 3: Ancla 2 - Paritaria Oficial Astillero */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-cyan-900/40 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-cyan-400">
                  <span className="font-bold uppercase tracking-wider text-[10px]">Ancla 2: Sindicato</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 font-bold">Astillero</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className={`text-2xl font-black font-mono ${
                    comparisonResults.oficialAstilleroPct > 0 ? 'text-cyan-400' : 'text-slate-300'
                  }`}>
                    {comparisonResults.oficialAstilleroPct > 0 ? `+${comparisonResults.oficialAstilleroPct}%` : `${comparisonResults.oficialAstilleroPct}%`}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">convenio</span>
                </div>
                <span className="text-[10px] text-slate-400 block truncate">
                  Pauta salarial oficial de planta
                </span>
              </div>

              {/* KPI 4: Ancla 3 - Inflación Oficial Mensual / Acumulada */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-orange-900/40 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-orange-400">
                  <span className="font-bold uppercase tracking-wider text-[10px]">Ancla 3: Inflación</span>
                  <span className="text-[9px] px-1.5 py-0.2 rounded bg-orange-950 border border-orange-800 font-bold">Admin Central</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black font-mono text-orange-400">
                    +{fluctuationChartData.summary?.netInfPct || 0}%
                  </span>
                  <span className="text-xs text-slate-400 font-mono">acumulada</span>
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Aplica a ambas quincenas del mes
                </span>
              </div>

              {/* KPI 5: Semáforo Ejecutivo Global de la Nómina (Fijo pedido por usuario) */}
              <div className="p-3.5 rounded-xl bg-slate-950 border border-purple-900/40 space-y-1.5">
                <div className="flex items-center justify-between text-xs text-purple-400">
                  <span className="font-bold uppercase tracking-wider text-[10px]">Semáforo Global</span>
                  <span className="font-mono text-xs font-bold text-slate-400">{comparisonResults.rows.filter(r => r.admin_center === 'CONTRATISTA').length} Cuadrillas</span>
                </div>
                <div className="flex items-center gap-3 pt-0.5">
                  <div className="flex items-center gap-1" title="Contratistas con aumento > +5% sobre Astillero">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse"></span>
                    <span className="font-mono font-black text-rose-400 text-lg">{comparisonResults.redCount}</span>
                  </div>
                  <div className="flex items-center gap-1" title="Contratistas alineados a la paritaria">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-400"></span>
                    <span className="font-mono font-black text-amber-300 text-lg">{comparisonResults.yellowCount}</span>
                  </div>
                  <div className="flex items-center gap-1" title="Contratistas favorables">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
                    <span className="font-mono font-black text-emerald-300 text-lg">{comparisonResults.greenCount}</span>
                  </div>
                </div>
                <span className="text-[10px] text-slate-400 block">
                  Pauta general de contratistas
                </span>
              </div>
            </div>
          </div>

          {/* EL NUEVO CENTRO VISUAL: GRÁFICO DINÁMICO DE FLUCTUACIÓN TEMPORAL MULTIVARIABLE */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm uppercase tracking-wider font-extrabold text-white flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                  Evolución Temporal: {fluctuationChartData.summary?.targetName} vs. 3 Anclas
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visualizá punto por punto la fluctuación quincenal y la brecha relativa contra el Dólar, el Sindicato y la Inflación.
                </p>
              </div>

              {/* Controles del Gráfico: Alternar % Acumulado vs AR$/Hora */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Ver:</span>
                <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button
                    type="button"
                    onClick={() => setChartMode('pct')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      chartMode === 'pct' ? 'bg-primary text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    📈 Variación Acumulada (%)
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartMode('nominal')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      chartMode === 'nominal' ? 'bg-primary text-slate-950 shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    💵 Valores AR$/Hora
                  </button>
                </div>
              </div>
            </div>

            {/* LEYENDA VISUAL DE LAS 4 CURVAS */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-xs">
              <div className="flex flex-wrap items-center gap-4">
                {/* Curva Contratista */}
                <div className="flex items-center gap-2 font-bold text-amber-300">
                  <span className="w-3.5 h-3.5 rounded-full bg-amber-400 border border-amber-300 shadow-sm shadow-amber-500/50"></span>
                  <span>{fluctuationChartData.summary?.targetName}</span>
                </div>
                {/* Curva Astillero */}
                <div className="flex items-center gap-2 font-bold text-cyan-400">
                  <span className="w-3.5 h-3.5 rounded-full bg-cyan-400 border border-cyan-300 shadow-sm shadow-cyan-500/50"></span>
                  <span>Paritaria Astillero (Sindicato)</span>
                </div>
                {/* Curva Inflación */}
                <div className="flex items-center gap-2 font-bold text-orange-400">
                  <span className="w-3.5 h-3.5 rounded-full bg-orange-500 border border-orange-400 shadow-sm shadow-orange-500/50"></span>
                  <span>Inflación Oficial (Mensual)</span>
                </div>
                {/* Curva Dólar */}
                <div className="flex items-center gap-2 font-bold text-emerald-400">
                  <span className="w-3.5 h-3.5 rounded-full bg-emerald-400 border border-emerald-300 shadow-sm shadow-emerald-500/50"></span>
                  <span>Dólar Oficial (FX)</span>
                </div>
              </div>

              {/* Indicador de punto enfocado */}
              {hoveredPointIndex !== null && fluctuationChartData.points[hoveredPointIndex] && (
                <div className="font-mono text-xs font-bold text-cyan-300 bg-cyan-950/60 px-2.5 py-0.5 rounded border border-cyan-800">
                  Inspeccionando: {fluctuationChartData.points[hoveredPointIndex].period}
                </div>
              )}
            </div>

            {/* LIENZO SVG INTERACTIVO */}
            {fluctuationChartData.points.length === 0 ? (
              <div className="h-64 flex items-center justify-center text-slate-500 text-xs">
                No hay datos suficientes para trazar la curva en el período seleccionado.
              </div>
            ) : (() => {
              const pts = fluctuationChartData.points
              const N = pts.length
              const W = 840
              const H = 340
              const padLeft = 60
              const padRight = 50
              const padTop = 30
              const padBottom = 50
              const plotW = W - padLeft - padRight
              const plotH = H - padTop - padBottom

              const getX = (idx) => N === 1 ? padLeft + plotW / 2 : padLeft + (idx / (N - 1)) * plotW

              // Escala Y según modo
              const isPct = chartMode === 'pct'
              const yMin = isPct ? fluctuationChartData.minPct : fluctuationChartData.minNom
              const yMax = isPct ? fluctuationChartData.maxPct : fluctuationChartData.maxNom
              const yRange = Math.max(1, yMax - yMin)

              const getY = (val) => padTop + plotH - ((val - yMin) / yRange) * plotH

              // Generar paths
              const getPath = (key) => {
                return pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${getX(i)} ${getY(p[key])}`).join(' ')
              }

              // Claves según modo
              const contKey = isPct ? 'contPct' : 'contractorRate'
              const astKey = isPct ? 'astPct' : 'astilleroRate'
              const dolKey = isPct ? 'dolPct' : 'dollar'

              // Líneas guía horizontales
              const gridSteps = 5
              const gridLines = Array.from({ length: gridSteps + 1 }, (_, i) => {
                const val = yMin + (i / gridSteps) * yRange
                return {
                  val: isPct ? `${val > 0 ? '+' : ''}${val.toFixed(1)}%` : `$${Math.round(val).toLocaleString('es-AR')}`,
                  y: getY(val),
                  isZero: Math.abs(val) < 0.1
                }
              })

              const activePt = hoveredPointIndex !== null && pts[hoveredPointIndex] ? pts[hoveredPointIndex] : pts[pts.length - 1]

              return (
                <div className="relative">
                  <div className="w-full overflow-x-auto">
                    <svg 
                      viewBox={`0 0 ${W} ${H}`} 
                      className="w-full h-auto min-w-[640px] select-none"
                    >
                      <defs>
                        <linearGradient id="contGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0.0" />
                        </linearGradient>
                      </defs>

                      {/* Líneas de cuadrícula horizontal */}
                      {gridLines.map((gl, i) => (
                        <g key={`grid-${i}`}>
                          <line
                            x1={padLeft}
                            y1={gl.y}
                            x2={padLeft + plotW}
                            y2={gl.y}
                            stroke={gl.isZero ? '#475569' : '#1E293B'}
                            strokeDasharray={gl.isZero ? '0' : '4 4'}
                            strokeWidth={gl.isZero ? 1.5 : 1}
                          />
                          <text
                            x={padLeft - 8}
                            y={gl.y + 3.5}
                            textAnchor="end"
                            fill={gl.isZero ? '#94A3B8' : '#64748B'}
                            fontSize="10"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            {gl.val}
                          </text>
                        </g>
                      ))}

                      {/* Ejes X (Quincenas) */}
                      {pts.map((p, i) => (
                        <g key={`x-axis-${i}`}>
                          <line
                            x1={getX(i)}
                            y1={padTop + plotH}
                            x2={getX(i)}
                            y2={padTop + plotH + 6}
                            stroke="#475569"
                            strokeWidth="1.5"
                          />
                          <text
                            x={getX(i)}
                            y={padTop + plotH + 20}
                            textAnchor="middle"
                            fill={hoveredPointIndex === i ? '#38BDF8' : '#94A3B8'}
                            fontSize="11"
                            fontFamily="monospace"
                            fontWeight={hoveredPointIndex === i ? 'bold' : 'medium'}
                          >
                            {p.shortLabel}
                          </text>
                        </g>
                      ))}

                      {/* Línea vertical de foco interactivo */}
                      {hoveredPointIndex !== null && (
                        <line
                          x1={getX(hoveredPointIndex)}
                          y1={padTop}
                          x2={getX(hoveredPointIndex)}
                          y2={padTop + plotH}
                          stroke="#38BDF8"
                          strokeDasharray="3 3"
                          strokeWidth="1.5"
                        />
                      )}

                      {/* Área bajo la curva del contratista */}
                      {isPct && (
                        <path
                          d={`${getPath('contPct')} L ${getX(N - 1)} ${padTop + plotH} L ${getX(0)} ${padTop + plotH} Z`}
                          fill="url(#contGrad)"
                        />
                      )}

                      {/* 1. Curva Dólar FX */}
                      {isPct && (
                        <path
                          d={getPath('dolPct')}
                          fill="none"
                          stroke="#10B981"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />
                      )}

                      {/* 2. Curva Inflación */}
                      {isPct && (
                        <path
                          d={getPath('infPct')}
                          fill="none"
                          stroke="#F97316"
                          strokeWidth="2.5"
                          strokeDasharray="4 4"
                          strokeLinecap="round"
                        />
                      )}

                      {/* 3. Curva Astillero Oficial */}
                      <path
                        d={getPath(astKey)}
                        fill="none"
                        stroke="#00E5FF"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      />

                      {/* 4. Curva Contratista / Personal Evaluado */}
                      <path
                        d={getPath(contKey)}
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth="3.5"
                        strokeLinecap="round"
                      />

                      {/* Puntos interactivos con hover */}
                      {pts.map((p, i) => {
                        const x = getX(i)
                        const isHovered = hoveredPointIndex === i

                        return (
                          <g key={`pts-${i}`} className="cursor-pointer" onMouseEnter={() => setHoveredPointIndex(i)}>
                            {/* Hitbox transparente para facilitar clic/hover */}
                            <rect
                              x={x - (plotW / (Math.max(1, N) * 2))}
                              y={padTop}
                              width={plotW / Math.max(1, N)}
                              height={plotH}
                              fill="transparent"
                            />

                            {/* Punto Dólar */}
                            {isPct && (
                              <circle
                                cx={x}
                                cy={getY(p.dolPct)}
                                r={isHovered ? 5 : 3.5}
                                fill="#10B981"
                                stroke="#022c22"
                                strokeWidth="1.5"
                              />
                            )}

                            {/* Punto Inflación */}
                            {isPct && (
                              <circle
                                cx={x}
                                cy={getY(p.infPct)}
                                r={isHovered ? 5 : 3.5}
                                fill="#F97316"
                                stroke="#431407"
                                strokeWidth="1.5"
                              />
                            )}

                            {/* Punto Astillero */}
                            <circle
                              cx={x}
                              cy={getY(p[astKey])}
                              r={isHovered ? 5.5 : 3.5}
                              fill="#00E5FF"
                              stroke="#083344"
                              strokeWidth="1.5"
                            />

                            {/* Punto Contratista */}
                            <circle
                              cx={x}
                              cy={getY(p[contKey])}
                              r={isHovered ? 7 : 5}
                              fill="#F59E0B"
                              stroke="#451a03"
                              strokeWidth="2"
                              className="transition-all"
                            />
                          </g>
                        )
                      })}
                    </svg>
                  </div>

                  {/* INSPECTOR DE DATOS DEL PUNTO ENFOCADO */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950 p-4 rounded-xl border border-slate-800 mt-2">
                    <div className="space-y-0.5">
                      <span className="text-[10px] text-amber-400 font-bold uppercase block truncate">
                        Tarifa {fluctuationChartData.summary?.targetName}
                      </span>
                      <div className="font-mono text-sm font-extrabold text-white">
                        ${activePt.contractorRate.toLocaleString('es-AR')} <span className="text-[10px] font-normal text-slate-400 font-sans">/h</span>
                      </div>
                      <div className="text-[10px] font-mono font-bold text-amber-300">
                        {activePt.contPct > 0 ? `+${activePt.contPct}%` : `${activePt.contPct}%`} vs base
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] text-cyan-400 font-bold uppercase block">
                        Paritaria Astillero (Sindicato)
                      </span>
                      <div className="font-mono text-sm font-extrabold text-white">
                        ${activePt.astilleroRate.toLocaleString('es-AR')} <span className="text-[10px] font-normal text-slate-400 font-sans">/h</span>
                      </div>
                      <div className="text-[10px] font-mono font-bold text-cyan-300">
                        {activePt.astPct > 0 ? `+${activePt.astPct}%` : `${activePt.astPct}%`} vs base
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] text-orange-400 font-bold uppercase block">
                        Inflación Oficial Acumulada
                      </span>
                      <div className="font-mono text-sm font-extrabold text-white">
                        +{activePt.infPct}% <span className="text-[10px] font-normal text-slate-400 font-sans">acum.</span>
                      </div>
                      <div className="text-[10px] font-mono font-bold text-orange-300">
                        {activePt.monthlyInf}% mensual
                      </div>
                    </div>

                    <div className="space-y-0.5">
                      <span className="text-[10px] text-emerald-400 font-bold uppercase block">
                        Dólar Oficial (FX)
                      </span>
                      <div className="font-mono text-sm font-extrabold text-white">
                        ${activePt.dollar.toLocaleString('es-AR')}
                      </div>
                      <div className="text-[10px] font-mono font-bold text-emerald-300">
                        {activePt.dolPct > 0 ? `+${activePt.dolPct}%` : `${activePt.dolPct}%`} vs base
                      </div>
                    </div>
                  </div>
                </div>
              )
            })()}

            {/* DIAGNÓSTICO EJECUTIVO DE CONCLUSIÓN GERENCIAL */}
            {(() => {
              const s = fluctuationChartData.summary
              if (!s) return null

              const brechaAst = s.brechaVsAst
              const brechaInf = s.brechaVsInf
              const isAlert = brechaAst > 5.0 || brechaInf > 5.0

              return (
                <div className={`p-4 rounded-xl border text-xs flex items-start gap-3 ${
                  isAlert 
                    ? 'bg-rose-950/40 border-rose-800 text-rose-200' 
                    : brechaAst < -2.0 
                    ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200' 
                    : 'bg-amber-950/40 border-amber-800 text-amber-200'
                }`}>
                  <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <strong className="block font-bold">
                      {isAlert 
                        ? '🔴 Alerta de Desvío Presupuestario:' 
                        : brechaAst < -2.0 
                        ? '🟢 Situación de Tarifa Favorable:' 
                        : '🟡 En Parámetro Operativo:'}
                    </strong>
                    <p className="leading-relaxed opacity-90">
                      Durante el período evaluado ({comparePeriodBase} &rarr; {comparePeriodTarget}), la tarifa de <strong>{s.targetName}</strong> creció un <strong>{s.netContPct > 0 ? `+${s.netContPct}%` : `${s.netContPct}%`}</strong>.
                      {brechaAst > 0 
                        ? ` Supera a la paritaria oficial del sindicato (+${s.netAstPct}%) en ${brechaAst} puntos porcentuales.` 
                        : ` Se encuentra ${Math.abs(brechaAst)} puntos por debajo del incremento paritario de Astillero (+${s.netAstPct}%).`}
                      {brechaInf > 0
                        ? ` También aumentó por encima de la inflación acumulada del período (+${s.netInfPct}%) en ${brechaInf} puntos.`
                        : ` Absorbió parte de la inflación acumulada (+${s.netInfPct}%), resultando económica en términos reales.`}
                    </p>
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 2: INTERFAZ UNIFICADA DE CARGA DE TARIFARIO QUINCENAL */}
      {/* ========================================================================= */}
      {activeTab === 'tarifario' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* ========================================================================= */}
          {/* PANEL UNIFICADO CASCADA: SUJETO DE COSTO ──► PERÍODO & ACCESO RÁPIDO ──► TARIFAS */}
          {/* ========================================================================= */}
          <div 
            ref={tarifarioFormRef}
            className={`alon-zone-entry rounded-2xl p-5 md:p-6 shadow-xl space-y-5 transition-all duration-500 ${
              isTargetFocusGlow 
                ? 'ring-2 ring-cyan-400 shadow-2xl shadow-cyan-500/25 bg-slate-900/90' 
                : ''
            }`}
          >
            {/* ------------------------------------------------------------- */}
            {/* NIVEL 1: SUJETO DE COSTO & CENTRO ADMINISTRATIVO (CASCADA)   */}
            {/* ------------------------------------------------------------- */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base font-bold text-white">
                    Tarifario Quincenal de Mano de Obra
                  </h2>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Las tarifas se asocian a una quincena específica, protegiendo el histórico inmutable de costos pasados.
                </p>
              </div>

              {/* Badges Dinámicos de Puestos Responsables */}
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span 
                  className="px-2.5 py-1 rounded-lg bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 flex items-center gap-1.5"
                  title={orgRoles['LIQUIDACION_SUELDOS']?.title}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>Carga Operativa: <strong>{orgRoles['LIQUIDACION_SUELDOS']?.holder}</strong></span>
                </span>
                <span 
                  className="px-2.5 py-1 rounded-lg bg-amber-950/80 text-amber-300 border border-amber-800/80 flex items-center gap-1.5"
                  title={orgRoles['DIRECCION_OPERACIONES']?.title}
                >
                  <Briefcase className="w-3.5 h-3.5" />
                  <span>Tarifas Contratistas: <strong>{orgRoles['DIRECCION_OPERACIONES']?.holder}</strong></span>
                </span>
              </div>
            </div>

            {/* BARRA SUPERIOR DE CENTRO: ASTILLERO (5 CATEGORÍAS) / CONTRATISTAS + SELECTOR DE CONTRATISTA */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 p-3.5 bg-slate-950/90 border border-slate-800 rounded-xl">
              <div className="flex flex-wrap items-center gap-3">
                <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Centro:
                </span>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setRateAdminCenter('ASTILLERO')}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 border ${
                      rateAdminCenter === 'ASTILLERO'
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/20 font-black ring-1 ring-cyan-400/50'
                        : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    <Building2 className={`w-3.5 h-3.5 ${rateAdminCenter === 'ASTILLERO' ? 'text-cyan-400' : 'text-slate-500'}`} />
                    <span>Personal del Astillero (5 Categorías)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRateAdminCenter('CONTRATISTA')
                      if (uniqueContractorList.length > 0 && !selectedContractor) {
                        handleSelectContractor(uniqueContractorList[0])
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-2 border ${
                      rateAdminCenter === 'CONTRATISTA'
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300 shadow-md shadow-amber-500/20 font-black ring-1 ring-amber-400/50'
                        : 'bg-slate-900 border-slate-700/80 text-slate-400 hover:text-white hover:border-slate-600'
                    }`}
                  >
                    <HardHat className={`w-3.5 h-3.5 ${rateAdminCenter === 'CONTRATISTA' ? 'text-amber-400' : 'text-slate-500'}`} />
                    <span>Contratistas</span>
                  </button>
                </div>
              </div>

              {/* SI ESTÁ EN CONTRATISTAS: SELECTOR INLINE DE CONTRATISTA */}
              {rateAdminCenter === 'CONTRATISTA' && (
                <div className="flex flex-wrap items-center gap-2.5 animate-in fade-in duration-150">
                  <span className="text-xs text-amber-400 font-bold flex items-center gap-1">
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Contratista:</span>
                  </span>
                  <select
                    value={selectedContractor}
                    onChange={(e) => handleSelectContractor(e.target.value)}
                    className="bg-slate-900 border border-amber-500/50 rounded-xl px-3 py-1.5 text-xs font-extrabold text-amber-300 focus:outline-none focus:border-amber-400 font-mono cursor-pointer"
                  >
                    {uniqueContractorList.map(c => (
                      <option key={c} value={c}>
                        {c} {rootContractorsMap[c]?.hasAyudanteOption ? '(Dual: Ofic. + Ayud.)' : '(Oficial Único)'}
                      </option>
                    ))}
                  </select>

                  <span className="text-[11px] px-2.5 py-1 rounded-lg bg-amber-950/60 border border-amber-800/60 text-amber-300 font-medium">
                    👥 <strong>{rootContractorsMap[selectedContractor]?.workersCount || 0}</strong> en nómina
                  </span>
                </div>
              )}
            </div>

            {/* ------------------------------------------------------------- */}
            {/* NIVEL 2: PERÍODO QUINCENAL & DÓLAR & ACCESO RÁPIDO (10 CHIPS) */}
            {/* ------------------------------------------------------------- */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
              {/* DESPLEGABLE CON FILTRO DE ESCRITURA (SEARCHABLE SELECT) */}
              <div className="md:col-span-6 relative" ref={periodDropdownRef}>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Período Quincenal Activo</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Filtro en tiempo real
                  </span>
                </label>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsPeriodSelectOpen(prev => !prev)}
                    className="w-full h-[42px] bg-slate-950 border border-slate-700 hover:border-emerald-500/80 rounded-xl px-3.5 text-xs font-bold text-white flex items-center justify-between transition-colors cursor-pointer text-left focus:outline-none focus:border-emerald-500 shadow-inner"
                  >
                    <span className="flex items-center gap-2 truncate">
                      <span className="px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono font-black text-xs">
                        {currentPeriodKey}
                      </span>
                      <span className="text-slate-300 truncate">
                        {rateQuincena === 1 ? '1ra' : '2da'} Quincena de {MONTH_NAMES[rateMonth - 1]} {rateYear}
                      </span>
                    </span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isPeriodSelectOpen ? 'rotate-180 text-emerald-400' : ''}`} />
                  </button>

                  {/* DROPDOWN MENU CON BÚSQUEDA */}
                  {isPeriodSelectOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                      {/* Input de filtro de texto */}
                      <div className="p-2 border-b border-slate-800 bg-slate-950">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-2.5" />
                          <input
                            type="text"
                            autoFocus
                            value={periodSearchInput}
                            onChange={(e) => setPeriodSearchInput(e.target.value)}
                            placeholder="Escribí ej: 2026, nov, 1Q..."
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-mono"
                          />
                          {periodSearchInput && (
                            <button
                              type="button"
                              onClick={() => setPeriodSearchInput('')}
                              className="absolute right-2 top-2 text-slate-400 hover:text-white"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Lista de quincenas con scroll */}
                      <div className="max-h-60 overflow-y-auto divide-y divide-slate-800/60">
                        {filteredSelectablePeriods.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500">
                            No se encontraron quincenas que coincidan con "{periodSearchInput}"
                          </div>
                        ) : (
                          filteredSelectablePeriods.map(p => {
                            const isSelected = p.period === currentPeriodKey
                            return (
                              <button
                                key={p.period}
                                type="button"
                                onClick={() => handleSelectPeriod(p)}
                                className={`w-full px-3.5 py-2 text-xs flex items-center justify-between text-left transition-colors cursor-pointer ${
                                  isSelected
                                    ? 'bg-emerald-500/15 text-emerald-300 font-bold'
                                    : 'hover:bg-slate-800 text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2.5">
                                  <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-400 text-[11px]">
                                    {p.period}
                                  </span>
                                  <span className="text-slate-300">
                                    {p.quincena === 1 ? '1ra' : '2da'} Quincena de {MONTH_NAMES[p.month - 1]} {p.year}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
                                  <span>US$ {parseFloat(p.dollar_rate || 1500).toLocaleString('es-AR')}</span>
                                  {isSelected && <Check className="w-3.5 h-3.5 text-emerald-400 stroke-[3]" />}
                                </div>
                              </button>
                            )
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* BOTÓN + NUEVA QUINCENA */}
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-transparent mb-1 select-none pointer-events-none">&nbsp;</label>
                <button
                  type="button"
                  onClick={handleOpenNewPeriodModal}
                  className="w-full h-[42px] bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-slate-950 font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-4 h-4 stroke-[3]" />
                  <span>Nueva Quincena</span>
                </button>
              </div>

              {/* VALOR US$ QUINCENAL (TARJETA INDICADOR) */}
              <div className="md:col-span-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-1 flex items-center justify-between">
                  <span>Valor US$ Quincenal</span>
                  <span
                    className="text-[9px] text-slate-400 flex items-center gap-1 font-mono cursor-help"
                    title="Cotización oficial fijada por Administración para esta quincena. Solo lectura para el operador."
                  >
                    <Lock className="w-2.5 h-2.5 text-amber-400" />
                    <span>Fijado por Adm.</span>
                  </span>
                </label>
                <div className="h-[42px] bg-slate-950 border border-slate-800 rounded-xl px-3.5 flex items-center justify-between shadow-inner">
                  <span className="flex items-center gap-1 font-mono">
                    <span className="text-slate-500 font-normal">$</span>
                    <span className="text-white text-sm font-bold">{parseFloat(dollarRate).toLocaleString('es-AR')}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans font-normal">ARS / USD</span>
                </div>
              </div>
            </div>

            {/* BARRA DE ACCESO RÁPIDO: ÚLTIMAS 10 QUINCENAS GUARDADAS (ORDEN CRONOLÓGICO CON TOOLTIP DE HOVER) */}
            {last10RecordedPeriods.length > 0 && (
              <div className="pt-3 border-t border-slate-800/60 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <div className="flex items-center gap-1 text-[11px] text-slate-400 font-semibold mr-1">
                  <History className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Últimas 10 Quincenas Guardadas:</span>
                </div>

                {last10RecordedPeriods.map(p => {
                  const isCurrent = p.period === currentPeriodKey
                  const periodData = rateCardsByPeriod[p.period]

                  return (
                    <div key={p.period} className="relative group">
                      <button
                        type="button"
                        onClick={() => handleSelectPeriod(p)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-all cursor-pointer ${
                          isCurrent
                            ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-md scale-105'
                            : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600 hover:text-white'
                        }`}
                      >
                        {p.period}
                      </button>

                      {/* TOOLTIP FLOTANTE AL ACERCAR EL PUNTERO */}
                      <div className="opacity-0 group-hover:opacity-100 pointer-events-none transition-all duration-150 absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-72 p-3 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl text-left text-xs invisible group-hover:visible">
                        {/* Flecha indicadora */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-4 border-x-transparent border-t-4 border-t-slate-700"></div>

                        {/* CASO A: PERSONAL DEL ASTILLERO */}
                        {rateAdminCenter === 'ASTILLERO' && (
                          <div>
                            <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                              <span className="font-bold text-cyan-400 flex items-center gap-1.5 text-[11px]">
                                <Building2 className="w-3.5 h-3.5" />
                                <span>Astillero · {p.period}</span>
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                US$ {periodData?.dollar_rate || 1500}
                              </span>
                            </div>

                            <div className="space-y-1">
                              {ASTILLERO_BASE_CATEGORIES.map(cat => {
                                const item = periodData?.astillero?.[cat]
                                return (
                                  <div key={cat} className="flex items-center justify-between text-[11px]">
                                    <span className="text-slate-400">{cat}:</span>
                                    <span className="font-mono text-white font-bold">
                                      {item ? `$ ${item.ars.toLocaleString('es-AR')} | U$S ${item.usd}` : <span className="text-slate-500 font-normal italic">Sin tarifa</span>}
                                    </span>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )}

                        {/* CASO B: CONTRATISTAS */}
                        {rateAdminCenter === 'CONTRATISTA' && (
                          <div>
                            {!selectedContractor ? (
                              <div className="p-2 text-center text-amber-300 bg-amber-950/40 rounded-lg border border-amber-800/40 text-[11px] flex flex-col items-center gap-1">
                                <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
                                <span>Seleccioná un contratista en el menú superior para previsualizar sus tarifas de esta quincena.</span>
                              </div>
                            ) : (
                              <div>
                                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5 mb-2">
                                  <span className="font-bold text-amber-400 flex items-center gap-1.5 text-[11px] truncate max-w-[160px]">
                                    <HardHat className="w-3.5 h-3.5 shrink-0" />
                                    <span className="truncate">{selectedContractor}</span>
                                  </span>
                                  <span className="text-[10px] text-slate-400 font-mono">
                                    {p.period}
                                  </span>
                                </div>

                                {periodData?.contractors?.[selectedContractor] ? (
                                  <div className="space-y-1 text-[11px]">
                                    <div className="flex items-center justify-between py-0.5">
                                      <span className="text-slate-400">OFICIAL:</span>
                                      <span className="font-mono text-emerald-400 font-bold">
                                        $ {periodData.contractors[selectedContractor].oficialArs.toLocaleString('es-AR')} | U$S {periodData.contractors[selectedContractor].oficialUsd}
                                      </span>
                                    </div>
                                    <div className="flex items-center justify-between py-0.5">
                                      <span className="text-slate-400">AYUDANTE:</span>
                                      {periodData.contractors[selectedContractor].hasAyudante && periodData.contractors[selectedContractor].ayudanteArs ? (
                                        <span className="font-mono text-amber-400 font-bold">
                                          $ {periodData.contractors[selectedContractor].ayudanteArs.toLocaleString('es-AR')} | U$S {periodData.contractors[selectedContractor].ayudanteUsd}
                                        </span>
                                      ) : (
                                        <span className="text-slate-500 font-mono italic">🔒 Tarifa plana</span>
                                      )}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="text-[11px] text-slate-500 italic py-1">
                                    ℹ️ Sin tarifas cargadas para {selectedContractor} en {p.period}.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* ------------------------------------------------------------- */}
            {/* NIVEL 3: VALORES DE MANO DE OBRA & FORMULARIO DE GUARDADO    */}
            {/* ------------------------------------------------------------- */}
            {/* CASO A: CENTRO ADMINISTRATIVO = ASTILLERO (5 CATEGORÍAS SINDICALES OFICIALES) */}
            {rateAdminCenter === 'ASTILLERO' && (
              <div className="space-y-4 pt-2 border-t border-slate-800 animate-in fade-in duration-150">
                <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-300 flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
                  <div>
                    <strong>Escala Sindical Astillero:</strong> El titular de {orgRoles['LIQUIDACION_SUELDOS']?.title} ({orgRoles['LIQUIDACION_SUELDOS']?.holder}) ingresa los nuevos valores aprobados por convenio sindical para el personal propio de AlonCar. Se imputan obligatoriamente a las 5 categorías oficiales (los mandados constituyen un rubro operativo, no una categoría salarial).
                  </div>
                </div>

                {/* Grilla de las 5 Categorías Oficiales con Colores Exactos de la Planilla */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
                  {ASTILLERO_BASE_CATEGORIES.map(category => {
                    const currentItem = astilleroForm[category] || { ars: 0, usd: 0 }
                    const calcUsd = dollarRate > 0 ? (currentItem.ars / dollarRate).toFixed(2) : 0

                    return (
                      <div 
                        key={category} 
                        className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-800/60 transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className={`px-2.5 py-0.5 rounded text-[11px] border tracking-wider ${getCategoryBadgeStyle(category)}`}>
                            {category}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono font-bold">
                            U$ {calcUsd}
                          </span>
                        </div>

                        <div>
                          <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                            Valor AR$ / Hora
                          </label>
                          <div className="relative">
                            <span className="absolute left-3 top-2 text-slate-500 font-mono font-bold">$</span>
                            <input
                              type="number"
                              step="50"
                              min="0"
                              value={currentItem.ars}
                              onChange={(e) => {
                                const val = parseFloat(e.target.value) || 0
                                const uVal = dollarRate > 0 ? Number((val / dollarRate).toFixed(2)) : 0
                                setAstilleroForm(prev => ({
                                  ...prev,
                                  [category]: { ars: val, usd: uVal }
                                }))
                              }}
                              className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
                            />
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Guardado de Astillero (Sincronización Automática sin consultar) */}
                <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Los operarios de Astillero en el padrón se actualizan automáticamente al guardar.</span>
                  </div>

                  <button
                    type="button"
                    disabled={savingRateCard}
                    onClick={handleSaveAstilleroRates}
                    className="px-5 py-2.5 bg-gradient-to-r from-cyan-400 to-blue-500 hover:brightness-110 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-cyan-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 stroke-[2.5]" />
                    <span>{savingRateCard ? 'Guardando y sincronizando...' : 'Guardar Escala Sindical Astillero'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* CASO B: CENTRO ADMINISTRATIVO = CONTRATISTAS */}
            {rateAdminCenter === 'CONTRATISTA' && (
              <div className="space-y-4 pt-2 border-t border-slate-800 animate-in fade-in duration-150">
                <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <HardHat className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                    <div>
                      <strong>Tarifas de {selectedContractor || 'Contratista'}:</strong> El titular de {orgRoles['DIRECCION_OPERACIONES']?.title} ({orgRoles['DIRECCION_OPERACIONES']?.holder}) determina y negocia los valores por hora con cada prestador. {orgRoles['LIQUIDACION_SUELDOS']?.title} ({orgRoles['LIQUIDACION_SUELDOS']?.holder}) realiza la carga operativa en el ERP.
                    </div>
                  </div>

                  {/* Switch manual de excepción Ayudante */}
                  <label className="shrink-0 flex items-center gap-2 text-xs text-amber-300 bg-slate-950/80 px-3 py-1.5 rounded-lg border border-amber-800/60 hover:border-amber-500 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={contractorHasAyudante}
                      onChange={(e) => setContractorHasAyudante(e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-amber-500 cursor-pointer accent-amber-500"
                    />
                    <span className="text-[11px] font-semibold">
                      {contractorHasAyudante ? 'Ayudante habilitado' : 'Habilitar Ayudante (excepción)'}
                    </span>
                  </label>
                </div>

                {/* Tarjetas de Mano de Obra: Oficial y Ayudante */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Tarifa Oficial */}
                  <div className="p-4 rounded-xl bg-slate-950 border border-emerald-900/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Unlock className="w-3.5 h-3.5" />
                        OFICIAL ({selectedContractor})
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono font-bold">
                        U$ {contractorOficialUsd}
                      </span>
                    </div>

                    <label className="block text-[10px] uppercase font-bold text-slate-400">
                      Valor AR$ / Hora
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-500 font-mono font-bold">$</span>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        value={contractorOficialArs}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          const uVal = dollarRate > 0 ? Number((val / dollarRate).toFixed(2)) : 0
                          setContractorOficialArs(val)
                          setContractorOficialUsd(uVal)
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500">
                      Tarifa base de mano de obra negociada para el grupo {selectedContractor}.
                    </p>
                  </div>

                  {/* Tarifa Ayudante (Bloqueada si no ofrece la opción) */}
                  <div className={`p-4 rounded-xl border transition-all space-y-2 ${
                    contractorHasAyudante 
                      ? 'bg-slate-950 border-amber-900/40' 
                      : 'bg-slate-950/40 border-slate-800/80 opacity-70'
                  }`}>
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-extrabold uppercase tracking-wider flex items-center gap-1.5 ${
                        contractorHasAyudante ? 'text-amber-400' : 'text-slate-500'
                      }`}>
                        {contractorHasAyudante ? (
                          <Unlock className="w-3.5 h-3.5 text-amber-400" />
                        ) : (
                          <Lock
                            className="w-3.5 h-3.5 text-slate-500 cursor-help"
                            title="Este contratista opera bajo modalidad de Oficial Único; no factura categoría Ayudante."
                          />
                        )}
                        AYUDANTE
                      </span>
                      {contractorHasAyudante && (
                        <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 font-mono font-bold">
                          U$ {contractorAyudanteUsd}
                        </span>
                      )}
                    </div>

                    <label className="block text-[10px] uppercase font-bold text-slate-400">
                      Valor AR$ / Hora
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-500 font-mono font-bold">$</span>
                      <input
                        type="number"
                        step="100"
                        min="0"
                        disabled={!contractorHasAyudante}
                        value={contractorHasAyudante ? contractorAyudanteArs : ''}
                        placeholder={!contractorHasAyudante ? 'Bloqueado (No aplica)' : '0'}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          const uVal = dollarRate > 0 ? Number((val / dollarRate).toFixed(2)) : 0
                          setContractorAyudanteArs(val)
                          setContractorAyudanteUsd(uVal)
                        }}
                        className={`w-full rounded-lg pl-7 pr-3 py-1.5 text-xs font-mono font-bold focus:outline-none ${
                          contractorHasAyudante
                            ? 'bg-slate-900 border border-slate-700 text-white focus:border-amber-400'
                            : 'bg-slate-950/80 border border-slate-800 text-slate-600 cursor-not-allowed'
                        }`}
                      />
                    </div>

                    <p className={`text-[10px] ${contractorHasAyudante ? 'text-slate-400' : 'text-rose-400 font-medium'}`}>
                      {contractorHasAyudante
                        ? 'Tarifa asignada a los operarios catalogados como ayudante.'
                        : '🔒 Ayudante bloqueado: este contratista no ofrece ayudantes y factura con tarifa única plana establecida por Dirección.'}
                    </p>
                  </div>
                </div>

                {/* Guardado de Contratista (Sincronización Automática sin consultar) */}
                <div className="pt-3 border-t border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="text-xs text-slate-400 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span>Los operarios de {selectedContractor} se actualizan automáticamente en el padrón.</span>
                  </div>

                  <button
                    type="button"
                    disabled={savingRateCard}
                    onClick={handleSaveContractorRate}
                    className="px-5 py-2.5 bg-gradient-to-r from-amber-400 to-orange-500 hover:brightness-110 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save className="w-4 h-4 stroke-[2.5]" />
                    <span>{savingRateCard ? 'Guardando y sincronizando...' : `Guardar Tarifa de ${selectedContractor}`}</span>
                  </button>
                </div>
              </div>
            )}

            {/* AVISO REGLA DE NEGOCIO: TALLERES (SIN NOMBRES HARDCODEADOS) */}
            <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 text-slate-400 text-xs flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-base">ℹ️</span>
                <span>
                  <strong>Talleres Externos:</strong> No requieren tarifario quincenal horario sindical. Sus servicios se gestionan técnicamente con la <strong>{orgRoles['OFICINA_TECNICA']?.title || 'Oficina Técnica & Subcontratos'}</strong> mediante cotización, presupuesto y remito (circuito RPF/RMO ──► FCR).
                </span>
              </div>
            </div>
          </div>

          {/* MODAL: HABILITAR NUEVA QUINCENA */}
          {isNewPeriodModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-400" />
                    <h3 className="text-base font-bold text-white">Habilitar Nueva Quincena</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNewPeriodModalOpen(false)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="p-3 bg-emerald-950/30 border border-emerald-800/40 rounded-xl text-xs text-emerald-300 flex items-start gap-2">
                    <Calendar className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <strong>Sugerencia correlativa automática:</strong> Se calculó la próxima quincena calendario ({nextCorrelativePeriod.period}). Podés modificar los valores si necesitás adelantar o registrar otro período.
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Año</label>
                      <input
                        type="number"
                        value={newPeriodYear}
                        onChange={(e) => setNewPeriodYear(parseInt(e.target.value) || newPeriodYear)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Mes</label>
                      <select
                        value={newPeriodMonth}
                        onChange={(e) => setNewPeriodMonth(parseInt(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        {MONTH_NAMES.map((name, idx) => (
                          <option key={name} value={idx + 1}>
                            {idx + 1} - {name.slice(0, 3)}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-400 mb-1">Quincena</label>
                      <select
                        value={newPeriodQuincena}
                        onChange={(e) => setNewPeriodQuincena(parseInt(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-2 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500 cursor-pointer"
                      >
                        <option value={1}>1Q (1-15)</option>
                        <option value={2}>2Q (16-fin)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-emerald-400 mb-1 flex items-center justify-between">
                      <span>Cotización Dólar US$ Inicial</span>
                      <span className="text-[10px] text-slate-500">ARS / USD</span>
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-slate-500 font-mono font-bold">$</span>
                      <input
                        type="number"
                        value={newPeriodDollarRate}
                        onChange={(e) => setNewPeriodDollarRate(parseFloat(e.target.value) || 0)}
                        className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:border-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl">
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newPeriodCopyLast}
                        onChange={(e) => setNewPeriodCopyLast(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-emerald-500 cursor-pointer accent-emerald-500 mt-0.5"
                      />
                      <span className="text-xs text-slate-300">
                        <strong>Copiar tarifas de la última quincena guardada</strong> ({sortedRecordedPeriods[sortedRecordedPeriods.length - 1]?.period || 'anterior'}) como base de trabajo editable.
                      </span>
                    </label>
                  </div>

                  <div className="text-[11px] text-center font-mono text-slate-400">
                    Período a crear: <strong className="text-emerald-400 text-sm">{newPeriodYear}-{String(newPeriodMonth).padStart(2, '0')}-{newPeriodQuincena}Q</strong>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setIsNewPeriodModalOpen(false)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="button"
                    disabled={creatingNewPeriod}
                    onClick={handleConfirmNewPeriod}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-600 hover:brightness-110 text-slate-950 text-xs font-extrabold rounded-xl shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {creatingNewPeriod ? (
                      <span>Creando período...</span>
                    ) : (
                      <>
                        <Check className="w-4 h-4 stroke-[3]" />
                        <span>Crear y Abrir Quincena</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* BLOQUE OPERATIVO UNIFICADO: ZONA 3 + ZONA 4 (TARIFARIO) */}
          <div className="alon-workspace-block">
          {/* ZONA 3 (BÚSQUEDA Y COMANDOS): FILTROS DE TARIFAS GUARDADAS */}
          <div className="alon-zone-toolbar rounded-2xl p-3 shadow-lg space-y-2.5">
            {/* NIVEL 1: Buscador Canónico Omnicanal siempre a la vista */}
            <CrawlerSearchBar
              value={rateTableSearch}
              onChange={setRateTableSearch}
              onClear={() => setRateTableSearch('')}
              inputRef={rateSearchInputRef}
              placeholder="Buscar por categoría, contratista, quincena, valor hora... (Ctrl+F | Esc limpia)"
            />

            {/* NIVEL 2: Píldoras de Centro, Alcance de Quincena y Deshacer/Rehacer */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
              <div className="flex flex-wrap items-center gap-2">
                {/* Filtro por centro */}
                <button
                  type="button"
                  onClick={() => setFilterTableCenter('todos')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    filterTableCenter === 'todos' ? 'bg-primary text-slate-950 font-bold' : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  Todos ({filteredRateCards.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTableCenter('ASTILLERO')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    filterTableCenter === 'ASTILLERO' ? 'bg-cyan-500 text-slate-950 font-bold' : 'bg-slate-950 text-cyan-400 hover:text-cyan-300 border border-slate-800'
                  }`}
                >
                  Astillero Propio
                </button>
                <button
                  type="button"
                  onClick={() => setFilterTableCenter('CONTRATISTA')}
                  className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                    filterTableCenter === 'CONTRATISTA' ? 'bg-amber-500 text-slate-950 font-bold' : 'bg-slate-950 text-amber-400 hover:text-amber-300 border border-slate-800'
                  }`}
                >
                  Contratistas
                </button>

                <div className="h-4 w-px bg-slate-800 hidden sm:block"></div>

                {/* Selector de Alcance */}
                <select
                  value={rateTableScope}
                  onChange={(e) => {
                    const newScope = e.target.value
                    setRateTableScope(newScope)
                    loadRateCards(currentPeriodKey, newScope)
                  }}
                  className="bg-slate-950 border border-slate-700 text-xs font-bold text-white rounded-lg px-2.5 py-1.5 focus:outline-none cursor-pointer"
                >
                  <option value="current">Solo Quincena Activa ({currentPeriodKey})</option>
                  <option value="all">Todas las Quincenas (Historial Completo)</option>
                </select>
              </div>

              {/* Controles Undo/Redo */}
              <div className="flex items-center gap-1 bg-slate-950/90 border border-slate-800 rounded-lg p-1">
                <button
                  type="button"
                  disabled={!ratesGrid.canUndo}
                  onClick={ratesGrid.undo}
                  className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  title="Deshacer cambio en Tarifario (Ctrl + Z)"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!ratesGrid.canRedo}
                  onClick={ratesGrid.redo}
                  className="p-1.5 rounded text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
                  title="Rehacer cambio en Tarifario (Ctrl + Y)"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* ZONA 4 (PLANILLA EDITABLE): TABLA HISTÓRICA DE TARIFAS */}
          <div
            ref={ratesGrid.gridContainerRef}
            tabIndex={0}
            onKeyDown={ratesGrid.handleKeyDown}
            className="alon-zone-grid rounded-2xl shadow-xl overflow-hidden focus:outline-none"
          >
            {/* Ribbon Canónico (Estándar 04) con Exportación integrada */}
            <GridRibbon
              activeCellBadge={ratesGrid.activeCellBadge || 'PLANILLA TARIFAS'}
              onInsertRow={() => {}}
              insertRowLabel="+ Nueva Tarifa"
              undoCount={ratesGrid.undoStack?.length || 0}
              totalRows={filteredRateCards.length}
              entityName="tarifas"
              exportRows={filteredRateCards}
              exportFilename={`personal_tarifas_${new Date().toISOString().split('T')[0]}`}
            />

            <div className="alon-grid-scroll">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="sticky top-0 z-20 alon-grid-thead text-[10px] uppercase font-bold text-slate-300 shadow-sm backdrop-blur-md">
                  <tr>
                    <th className="py-2 px-1 text-center w-8 select-none">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => ratesGrid.toggleSelectAll(filteredRateCards.map(rc => rc.id))}
                          className="text-slate-500 hover:text-cyan-400 transition-colors cursor-pointer"
                          title="Seleccionar todas las tarifas"
                        >
                          {ratesGrid.selectedRowIds.size > 0 && ratesGrid.selectedRowIds.size === filteredRateCards.length ? (
                            <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span className="font-mono text-[9px] text-slate-500 font-bold">#</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3">Quincena</th>
                    <th className="py-2.5 px-3">Categoría / Contratista</th>
                    <th className="py-2.5 px-3 text-right">Oficial AR$ ✎</th>
                    <th className="py-2.5 px-3 text-center text-emerald-400">Oficial U$</th>
                    <th className="py-2.5 px-3 text-right">Ayudante AR$ ✎</th>
                    <th className="py-2.5 px-3 text-center text-amber-400">Ayudante U$</th>
                    <th className="py-2.5 px-3 text-center">Dólar</th>
                    <th className="py-2.5 px-3 text-center">Centro</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredRateCards.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500">
                        {loadingRateCards ? 'Cargando tarifas...' : 'No se encontraron tarifas registradas para el filtro seleccionado.'}
                      </td>
                    </tr>
                  ) : (
                    filteredRateCards.map((rc, rowIndex) => {
                      const isLocked = Boolean(rc.is_locked)
                      const canEditAyudante = !isLocked && rc.admin_center === 'CONTRATISTA' && Boolean(rc.has_ayudante || rc.rate_ayudante_ars !== null)
                      const isEditingOficial = inlineRateEdit && inlineRateEdit.rowId === rc.id && inlineRateEdit.colKey === 'rate_oficial_ars'
                      const isEditingAyudante = inlineRateEdit && inlineRateEdit.rowId === rc.id && inlineRateEdit.colKey === 'rate_ayudante_ars'

                      const oficialActive = ratesGrid.isCellActive(rowIndex, 0)
                      const oficialSelected = ratesGrid.isCellSelected(rowIndex, 0)
                      const oficialFill = ratesGrid.isCellInFillPreview(rowIndex, 0)

                      const ayudanteActive = ratesGrid.isCellActive(rowIndex, 1)
                      const ayudanteSelected = ratesGrid.isCellSelected(rowIndex, 1)
                      const ayudanteFill = ratesGrid.isCellInFillPreview(rowIndex, 1)

                      const isRowSelected = ratesGrid.isRowSelected(rc.id)

                      return (
                        <tr
                          key={rc.id}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            setContextMenuTarget({
                              row: rc,
                              rowIndex,
                              x: e.clientX,
                              y: e.clientY,
                              isRowHeader: false,
                              entityType: 'rate_cards',
                              recordId: rc.id,
                              recordLabel: `${rc.period} · ${rc.contractor_name || rc.category}`
                            })
                          }}
                          className={`group transition-colors select-none ${
                            isRowSelected
                              ? 'bg-cyan-950/35 hover:bg-cyan-950/45 text-cyan-200'
                              : isLocked
                              ? 'bg-slate-900/40 hover:bg-slate-800/40'
                              : 'hover:bg-slate-800/40'
                          }`}
                        >
                          {/* Col 0: Checkbox + Número Ordinal (#) Canónico */}
                          <td className="py-1 px-1 text-center w-8 select-none relative">
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <button
                                type="button"
                                onClick={() => ratesGrid.toggleSelectRow(rc.id)}
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
                                    contextMenuTarget?.recordId === rc.id
                                      ? null
                                      : {
                                          row: rc,
                                          rowIndex,
                                          x: e.clientX,
                                          y: e.clientY,
                                          isRowHeader: true,
                                          entityType: 'rate_cards',
                                          recordId: rc.id,
                                          recordLabel: `${rc.period} · ${rc.contractor_name || rc.category}`
                                        }
                                  )
                                }}
                                className={`font-mono text-[9px] font-bold px-1 py-0.5 rounded transition-all cursor-pointer hover:bg-cyan-950/90 hover:text-cyan-300 hover:ring-1 hover:ring-cyan-500/60 ${
                                  isRowSelected ? 'text-cyan-300' : 'text-slate-500 group-hover:text-cyan-400'
                                }`}
                                title={`Fila #${rowIndex + 1} • Clic para menú contextual (o clic derecho)`}
                              >
                                {rowIndex + 1}
                              </button>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-bold text-slate-400">
                                <HighlightText text={rc.period} query={rateTableSearch} />
                              </span>
                              {isLocked && (
                                <Lock
                                  className="w-3 h-3 text-amber-400 cursor-help"
                                  title="Período cerrado: Tarifa histórica inmutable para preservar la contabilidad y costos pasados de la obra. No implica un bloqueo ni sanción al personal."
                                />
                              )}
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            {rc.admin_center === 'ASTILLERO' ? (
                              <span className={`px-2 py-0.5 rounded text-[10px] border ${getCategoryBadgeStyle(rc.entity_name)}`}>
                                <HighlightText text={rc.entity_name} query={rateTableSearch} />
                              </span>
                            ) : (
                              <span className="font-extrabold text-white font-mono">
                                <HighlightText text={rc.entity_name} query={rateTableSearch} />
                              </span>
                            )}
                          </td>

                          {/* Col 0: Oficial AR$ (Doble clic editable si !rc.is_locked) */}
                          <td
                            onClick={(e) => ratesGrid.handleCellClick(rowIndex, 0, e)}
                            onMouseDown={(e) => ratesGrid.handleCellMouseDown(rowIndex, 0, e)}
                            onMouseEnter={() => ratesGrid.handleCellMouseEnter(rowIndex, 0)}
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              if (isLocked) {
                                showGridFeedback('error', `🔒 La tarifa de ${rc.entity_name} (${rc.period}) está bloqueada por período cerrado.`)
                                return
                              }
                              setInlineRateEdit({
                                rowId: rc.id,
                                colKey: 'rate_oficial_ars',
                                value: rc.rate_oficial_ars ?? 0
                              })
                            }}
                            title={isLocked ? 'Período cerrado: Tarifa histórica inmutable para preservar la contabilidad pasada (no implica bloqueo de personas).' : 'Doble clic para editar Oficial AR$'}
                            className={`py-2 px-3 text-right font-mono font-bold text-white relative cursor-cell ${
                              oficialActive ? 'ring-2 ring-inset ring-emerald-400 bg-emerald-950/30' :
                              oficialFill ? 'bg-emerald-500/20 ring-1 ring-inset ring-emerald-400/60' :
                              oficialSelected ? 'bg-cyan-500/15' : ''
                            }`}
                          >
                            {isEditingOficial ? (
                              <input
                                type="number"
                                step="50"
                                min="0"
                                autoFocus
                                value={inlineRateEdit.value}
                                onChange={(e) => setInlineRateEdit(prev => ({ ...prev, value: e.target.value }))}
                                onBlur={() => commitInlineRateEdit()}
                                onKeyDown={(e) => {
                                   e.stopPropagation()
                                   if (e.key === 'Enter') commitInlineRateEdit()
                                   if (e.key === 'Escape') setInlineRateEdit(null)
                                }}
                                className="w-28 bg-slate-950 border border-emerald-400 rounded px-2 py-0.5 text-right text-xs text-white font-mono focus:outline-none"
                              />
                            ) : (
                              <span>$<HighlightText text={parseFloat(rc.rate_oficial_ars || 0).toLocaleString('es-AR')} query={rateTableSearch} /></span>
                            )}
                            {!isLocked && ratesGrid.shouldRenderFillHandle(rowIndex, 0) && (
                              <div
                                onMouseDown={ratesGrid.handleFillHandleMouseDown}
                                onDoubleClick={ratesGrid.handleFillHandleDoubleClick}
                                className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
                                title="Arrastrar para rellenar hacia abajo"
                              />
                            )}
                          </td>

                          <td className="py-2 px-3 text-center font-mono font-extrabold text-emerald-400">
                            $<HighlightText text={parseFloat(rc.rate_oficial_usd || 0).toFixed(2)} query={rateTableSearch} />
                          </td>

                          {/* Col 1: Ayudante AR$ (Doble clic editable si !rc.is_locked y aplica ayudante) */}
                          <td
                            onClick={(e) => ratesGrid.handleCellClick(rowIndex, 1, e)}
                            onMouseDown={(e) => ratesGrid.handleCellMouseDown(rowIndex, 1, e)}
                            onMouseEnter={() => ratesGrid.handleCellMouseEnter(rowIndex, 1)}
                            onDoubleClick={(e) => {
                              e.stopPropagation()
                              if (isLocked) {
                                showGridFeedback('error', `🔒 La tarifa de ${rc.entity_name} (${rc.period}) está bloqueada por período cerrado.`)
                                return
                              }
                              if (!canEditAyudante) return
                              setInlineRateEdit({
                                rowId: rc.id,
                                colKey: 'rate_ayudante_ars',
                                value: rc.rate_ayudante_ars ?? 0
                              })
                            }}
                            title={!canEditAyudante ? 'No aplica Ayudante en este registro' : isLocked ? 'Período cerrado: Tarifa histórica inmutable para preservar la contabilidad pasada (no implica bloqueo de personas).' : 'Doble clic para editar Ayudante AR$'}
                            className={`py-2 px-3 text-right font-mono font-bold relative ${canEditAyudante ? 'cursor-cell' : 'cursor-default'} ${
                              ayudanteActive ? 'ring-2 ring-inset ring-emerald-400 bg-emerald-950/30' :
                              ayudanteFill ? 'bg-emerald-500/20 ring-1 ring-inset ring-emerald-400/60' :
                              ayudanteSelected ? 'bg-cyan-500/15' : ''
                            }`}
                          >
                            {isEditingAyudante ? (
                              <input
                                type="number"
                                step="50"
                                min="0"
                                autoFocus
                                value={inlineRateEdit.value}
                                onChange={(e) => setInlineRateEdit(prev => ({ ...prev, value: e.target.value }))}
                                onBlur={() => commitInlineRateEdit()}
                                onKeyDown={(e) => {
                                   e.stopPropagation()
                                   if (e.key === 'Enter') commitInlineRateEdit()
                                   if (e.key === 'Escape') setInlineRateEdit(null)
                                }}
                                className="w-28 bg-slate-950 border border-amber-400 rounded px-2 py-0.5 text-right text-xs text-white font-mono focus:outline-none"
                              />
                            ) : rc.rate_ayudante_ars ? (
                              <span className="text-white">$<HighlightText text={parseFloat(rc.rate_ayudante_ars).toLocaleString('es-AR')} query={rateTableSearch} /></span>
                            ) : (
                              <span className="text-slate-600 font-normal italic">No aplica</span>
                            )}
                            {canEditAyudante && ratesGrid.shouldRenderFillHandle(rowIndex, 1) && (
                              <div
                                onMouseDown={ratesGrid.handleFillHandleMouseDown}
                                onDoubleClick={ratesGrid.handleFillHandleDoubleClick}
                                className="absolute -bottom-1 -right-1 w-2.5 h-2.5 bg-emerald-400 border border-slate-950 cursor-crosshair z-30"
                                title="Arrastrar para rellenar hacia abajo"
                              />
                            )}
                          </td>

                          <td className="py-2 px-3 text-center font-mono font-extrabold text-amber-400">
                            {rc.rate_ayudante_usd ? (
                              <span>$<HighlightText text={parseFloat(rc.rate_ayudante_usd).toFixed(2)} query={rateTableSearch} /></span>
                            ) : '-'}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-slate-400">
                            $<HighlightText text={String(rc.dollar_rate)} query={rateTableSearch} />
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                              rc.admin_center === 'ASTILLERO'
                                ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                                : 'bg-amber-950 text-amber-300 border-amber-800'
                            }`}>
                              <HighlightText text={rc.admin_center} query={rateTableSearch} />
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleLoadRateCard(rc)}
                              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ml-auto"
                              title="Cargar en el formulario superior"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Editar</span>
                            </button>
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

          {/* BARRA INFERIOR FLOTANTE ESTANDARIZADA (ARQUETIPO CARGA DE DATOS) */}
          <GridStatusBarBottom
            filteredCount={filteredRateCards.length}
            totalCount={rateCards.length}
            entityName="tarifas"
            hasActiveFilter={Boolean(rateTableSearch || filterTableCenter !== 'todos')}
            onClearFilters={() => { setRateTableSearch(''); setFilterTableCenter('todos'); }}
            selectionStats={ratesGrid.selectionStats}
            onClearSelection={() => ratesGrid.setSelectionRange(null)}
            customSelection={
              ratesGrid.selectedRowIds.size > 0
                ? {
                    count: ratesGrid.selectedRowIds.size,
                    label: `${ratesGrid.selectedRowIds.size} tarifa(s) seleccionada(s)`,
                    onClear: ratesGrid.clearSelectedRows
                  }
                : null
            }
            globalAggregates={[
              { label: 'Tarifas Históricas', value: filteredRateCards.length, highlight: true },
              { label: 'Centro', value: filterTableCenter === 'todos' ? 'Todos' : filterTableCenter },
            ]}
          />
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 1: PADRÓN OPERATIVO DE PERSONAS & GRUPOS DE TRABAJO */}
      {/* ========================================================================= */}
      {activeTab === 'nomina' && (
        <div className="space-y-6 animate-in fade-in duration-150">
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

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
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
            </div>
          </div>

          {/* SUBZONA 2: ESCALA SINDICAL DE REFERENCIA (DE MAYOR A MENOR RANGO CON FILTRO INTERACTIVO) */}
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

              {/* 2. Tarifa Oficial Base (Mayor rango) */}
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

              {/* 3. Tarifa 1/2 Oficial (Rango medio) */}
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

              {/* 4. Tarifa Ayudante Base (Menor rango) */}
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
                <span>{showGroupsView ? 'Ver Grilla Detallada de Personas' : 'Ver por Grupos de Trabajo (59)'}</span>
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
            {/* Buscador Canónico Omnicanal */}
            <CrawlerSearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              onClear={clearAllFilters}
              inputRef={nominaSearchInputRef}
              placeholder="Buscar por operario, grupo, rubro, DNI, valor hora US$/AR$... (Ctrl+F | Esc limpia todo)"
            />

            {/* PESTAÑAS Y FILTROS RÁPIDOS */}
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

                {/* Filtro Estado */}
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

                {/* Filtro por Grupo específico */}
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

              {/* Controles Undo/Redo */}
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

          {/* Datalists auxiliares para edición rápida en línea */}
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
            {/* Ribbon Canónico (Estándar 04) con Exportación integrada */}
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
                    <th className="py-2.5 px-2 text-center">Estado</th>
                    <th className="py-2.5 px-2.5">Consumibles</th>
                    <th className="py-2.5 px-2.5">Elem. Seg.</th>
                    <th className="py-2.5 px-2 text-center">Permisos</th>
                    <th className="py-2.5 px-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredWorkers.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-10 text-center text-slate-500">
                        {loading ? 'Cargando padrón...' : 'No se encontraron registros que coincidan con la búsqueda.'}
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
                                title={`Fila #${rowIndex + 1} • Clic para menú contextual (o clic derecho)`}
                              >
                                {rowIndex + 1}
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

                          {/* Col 1: Categoría */}
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

                          {/* Col 2: Rubro (Desplegable estandarizado con opción de agregar nuevo) */}
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

                          {/* Col 3: AR$/Hora */}
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

                          {/* U$/Hora (Calculado automáticamente) */}
                          <td className="py-2 px-2 text-center font-mono font-extrabold text-emerald-400">
                            $<HighlightText text={String(usdCalc)} query={searchTerm} />
                          </td>

                          {/* Col 4: Grupo de Trabajo */}
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

                          {/* Col 5: Centro Admin */}
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

                          {/* 8. Estado */}
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

                          {/* 9. Consumibles */}
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

                          {/* 10. Elem. Seg. */}
                          <td className="py-2 px-2.5">
                            <span className="text-[9px] px-1.5 py-0.5 rounded font-bold bg-amber-950 text-amber-300 border border-amber-800">
                              {w.safety_items || 'CONTRATISTA'}
                            </span>
                          </td>

                          {/* 11. Permisos (P = Pañol, H = Horas, 3ros = Terceros, JO = Jefe de Obra) */}
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

                          {/* 12. Acciones */}
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

          {/* BARRA INFERIOR FLOTANTE ESTANDARIZADA (ARQUETIPO CARGA DE DATOS) */}
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
        </div>
      )}

      {/* MODAL ÁGIL: AGREGAR NUEVO RUBRO OPERATIVO EN MAYÚSCULAS */}
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

      {/* MODAL DE ADMINISTRACIÓN DE PUESTOS Y TITULARES (ORGANIZATION ROLES) */}
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

      {/* MODAL DE ALTA / EDICIÓN DE OPERARIO (ARQUITECTURA BICOLUMNA CHROMA-CHUNKING) */}
      {(isNewModalOpen || editingWorker) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="alon-modal-card">
            {/* CABECERA MODAL */}
            <div className="alon-modal-header">
              <div>
                <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  {editingWorker ? `Editar Operario: ${editingWorker.name}` : 'Cargar Nuevo Contratista / Operario'}
                </h3>
                <p className="text-[11px] text-slate-400">
                  Los operarios y contratistas se imputan por <strong>Grupo de Trabajo</strong> para unificar la carga en Horas y Pañol. (Navegación rápida con tecla <strong>Tab</strong>)
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
                {/* ================================================================= */}
                {/* COLUMNA IZQUIERDA: 1. CENTRO ADMIN • 2. RUBRO • 3. DATOS PERSONA  */}
                {/* ================================================================= */}
                <div className="space-y-3">
                  {/* BLOQUE 1 (NARANJA / ÁMBAR): CENTRO ADMINISTRATIVO & GRUPO */}
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
                          <HardHat className={`w-3.5 h-3.5 ${formData.admin_center === 'CONTRATISTA' ? 'text-amber-400' : 'text-slate-500'}`} />
                          {formData.admin_center === 'CONTRATISTA' && <span className="text-[9px] text-amber-400 font-bold">✓ Activo</span>}
                        </div>
                        <div>
                          <div className="font-extrabold text-xs">CONTRATISTA</div>
                          <div className="text-[10px] text-slate-400 leading-tight">Cuadrilla en planta</div>
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
                          <Settings className={`w-3.5 h-3.5 ${formData.admin_center === 'TALLER' ? 'text-purple-400' : 'text-slate-500'}`} />
                          {formData.admin_center === 'TALLER' && <span className="text-[9px] text-purple-400 font-bold">✓ Activo</span>}
                        </div>
                        <div>
                          <div className="font-extrabold text-xs">TALLER</div>
                          <div className="text-[10px] text-slate-400 leading-tight">Servicio externo</div>
                        </div>
                      </button>
                    </div>

                    {/* Grupo de Trabajo integrado en el Bloque 1 */}
                    {formData.admin_center === 'ASTILLERO' ? (
                      <div className="px-3 py-2 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-cyan-400 shrink-0" />
                          <div>
                            <div className="text-xs font-bold text-white">Grupo de Trabajo: ASTILLERO</div>
                            <div className="text-[10px] text-slate-400">Personal propio registrado bajo centro Astillero.</div>
                          </div>
                        </div>
                        <span className="text-[10px] px-2 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800 flex items-center gap-1">
                          <Lock className="w-2.5 h-2.5 text-cyan-400" />
                          Fijado
                        </span>
                      </div>
                    ) : (
                      <div className="p-2.5 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-200">
                            Grupo de Trabajo ({formData.admin_center === 'CONTRATISTA' ? 'Contratista' : 'Taller'})
                          </label>
                          <button
                            type="button"
                            tabIndex={-1}
                            onClick={() => {
                              setIsCustomGroup(!isCustomGroup)
                              if (!isCustomGroup && !customGroupName) setCustomGroupName('')
                            }}
                            className="text-[10px] font-bold text-primary hover:text-cyan-300 underline cursor-pointer"
                          >
                            {isCustomGroup ? '↩ Elegir precargado' : '+ Crear nuevo grupo'}
                          </button>
                        </div>

                        {isCustomGroup ? (
                          <input
                            type="text"
                            required
                            placeholder="Nombre del nuevo grupo (ej: METALURGICA DEL PUERTO)"
                            value={customGroupName}
                            onChange={(e) => setCustomGroupName(e.target.value.toUpperCase())}
                            className="w-full bg-slate-950 border border-primary/60 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-primary"
                          />
                        ) : (
                          <select
                            value={formData.work_group}
                            onChange={(e) => setFormData({ ...formData, work_group: e.target.value })}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-primary cursor-pointer"
                          >
                            {(formData.admin_center === 'CONTRATISTA' ? availableContractorGroups : availableTallerGroups).map(g => (
                              <option key={g} value={g}>{g}</option>
                            ))}
                          </select>
                        )}
                      </div>
                    )}
                  </div>

                  {/* BLOQUE 2 (ROJO / ROSE): RUBRO TITULAR EN PADRÓN */}
                  <div className="alon-chunk-rose space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-rose-300 uppercase tracking-wider">
                        2. {formData.admin_center === 'ASTILLERO' ? 'Rubro Titular en Padrón' : 'Rubro(s) Habilitados (Multi-Rubro)'}
                      </label>
                      <span className="text-[10px] text-cyan-400">
                        {formData.admin_center === 'ASTILLERO' ? '🔄 Permite préstamo en Horas' : `${String(formData.trade || '').split(',').map(s => s.trim()).filter(Boolean).length} activo(s)`}
                      </span>
                    </div>

                    <input
                      type="text"
                      required
                      list="trades-datalist"
                      placeholder="CALDERERIA, RASCHINAJE, PINTURA, MECANICA..."
                      value={formData.trade}
                      onChange={(e) => setFormData({ ...formData, trade: e.target.value.toUpperCase() })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-rose-400"
                    />

                    {formData.admin_center === 'ASTILLERO' ? (
                      <div className="flex flex-wrap gap-1">
                        {['CALDERERIA', 'RASCHINAJE', 'PINTURA', 'MECANICA', 'CARPINTERIA', 'ELECTRICIDAD', 'SOLDADURA', 'MAQUINARIA', 'PANOLERO', 'MANDADOS', 'SUPERVISION', 'TECNICOS'].map(stdTrade => {
                          const isSelected = (formData.trade || '').trim().toUpperCase() === stdTrade
                          return (
                            <button
                              key={stdTrade}
                              type="button"
                              tabIndex={-1}
                              onClick={() => setFormData({ ...formData, trade: stdTrade })}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                                isSelected
                                  ? 'bg-cyan-500 text-slate-950 border-cyan-300 shadow-sm'
                                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                              }`}
                            >
                              {stdTrade}
                            </button>
                          )
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {['CALDERERIA', 'SOLDADURA', 'RASCHINAJE', 'PINTURA', 'MECANICA', 'CARPINTERIA', 'ELECTRICIDAD', 'TORNERIA', 'PRFV', 'MANIOBRAS', 'SERVICIOS INDUSTRIALES'].map(stdTrade => {
                          const currentList = String(formData.trade || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
                          const idxInList = currentList.indexOf(stdTrade)
                          const isSelected = idxInList !== -1
                          const isPrimary = idxInList === 0
                          return (
                            <button
                              key={stdTrade}
                              type="button"
                              tabIndex={-1}
                              onClick={() => {
                                let nextList = [...currentList]
                                if (isSelected) {
                                  if (nextList.length > 1) nextList = nextList.filter(t => t !== stdTrade)
                                } else {
                                  nextList.push(stdTrade)
                                }
                                setFormData({ ...formData, trade: nextList.join(', ') })
                              }}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                                isPrimary
                                  ? 'bg-amber-500 text-slate-950 border-amber-300 font-black'
                                  : isSelected
                                  ? 'bg-amber-950 text-amber-200 border-amber-500'
                                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                              }`}
                            >
                              {isPrimary ? '⭐ ' : isSelected ? '✓ ' : '+ '}{stdTrade}
                            </button>
                          )
                        })}
                      </div>
                    )}

                    <datalist id="trades-datalist">
                      {uniqueTrades.map(t => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  </div>

                  {/* BLOQUE 3 (AZUL ÍNDIGO): DATOS PERSONALES */}
                  <div className="alon-chunk-indigo space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-indigo-300 uppercase tracking-wider">
                        3. Datos Personales & Contacto
                      </label>
                      <span className="text-[10px] font-mono text-indigo-400/80">Paso 3/5</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                          Nombre y Apellido *
                        </label>
                        <input
                          type="text"
                          required
                          autoFocus
                          placeholder="Ej: Rodriguez, Lucas"
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-400 font-bold"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-300 mb-1 flex items-center gap-1">
                          <Phone className="w-3 h-3 text-cyan-400" />
                          <span>Celular / WhatsApp</span>
                        </label>
                        <input
                          type="text"
                          placeholder="Ej: +5492235001122"
                          value={formData.phone || ''}
                          onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* ================================================================= */}
                {/* COLUMNA DERECHA: 4. TARIFA & CONSUMIBLES • 5. ESTADO & PERMISOS   */}
                {/* ================================================================= */}
                <div className="space-y-3">
                  {/* BLOQUE 4 (VERDE ESMERALDA): TARIFA & CONSUMIBLES DE PAÑOL */}
                  <div className="alon-chunk-emerald space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-emerald-300 uppercase tracking-wider">
                        4. Tarifa Horaria & Consumibles de Pañol
                      </label>
                      <span className="text-[10px] font-mono text-emerald-400/80">Paso 4/5</span>
                    </div>

                    <div className="grid grid-cols-3 gap-2.5">
                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                          Tarifa AR$/Hora
                        </label>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono font-bold text-xs">$</span>
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
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-6 pr-2 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-400"
                          />
                        </div>
                      </div>

                      <div className="bg-slate-900/90 border border-emerald-900/50 rounded-lg px-2.5 py-1 flex flex-col justify-center">
                        <div className="flex items-center justify-between">
                          <span className="text-[9px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                            <Lock className="w-2.5 h-2.5 text-amber-400" />
                            U$/H (${dollarRate})
                          </span>
                        </div>
                        <div className="text-sm font-extrabold text-emerald-300 font-mono">
                          ${dollarRate > 0 && formData.hourly_rate_ars ? (parseFloat(formData.hourly_rate_ars) / dollarRate).toFixed(2) : '0.00'}{' '}
                          <span className="text-[9px] font-sans font-normal text-slate-400">USD</span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                          Categoría
                        </label>
                        <select
                          value={formData.category}
                          onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                          className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-emerald-400 font-bold"
                        >
                          <option value="AYUDANTE">AYUDANTE</option>
                          <option value="OFICIAL">OFICIAL</option>
                          <option value="1/2 OFICIAL">1/2 OFICIAL</option>
                          <option value="APRENDIZ">APRENDIZ</option>
                          <option value="OFICIAL BLACK">OFICIAL BLACK</option>
                        </select>
                      </div>
                    </div>

                    {/* Sub-bloque Consumibles de Pañol */}
                    <div className="pt-2.5 border-t border-emerald-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200">
                          Consumibles de Pañol (% Descuento)
                        </span>
                        <span className="text-[11px] font-mono font-extrabold text-amber-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                          {formData.consumables_discount_pct}% Descuento
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1.5">
                        {[
                          { pct: 100, label: '100% Contr.', desc: 'Desc. total' },
                          { pct: 60, label: '60% Contr.', desc: '40% Obra' },
                          { pct: 50, label: '50% Comp.', desc: '50% Obra' },
                          { pct: 0, label: '0% Obra', desc: '100% Obra' }
                        ].map(btn => (
                          <button
                            key={btn.pct}
                            type="button"
                            tabIndex={-1}
                            onClick={() => setFormData({ ...formData, consumables_discount_pct: btn.pct })}
                            className={`py-1 px-1.5 rounded-lg text-[11px] font-bold transition-all border text-center cursor-pointer ${
                              Number(formData.consumables_discount_pct) === btn.pct
                                ? 'bg-amber-950 text-amber-300 border-amber-500 shadow ring-1 ring-amber-500'
                                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                            }`}
                          >
                            <div>{btn.label}</div>
                            <div className="text-[9px] opacity-70 font-normal">{btn.desc}</div>
                          </button>
                        ))}
                      </div>

                      <div className="flex items-center gap-2.5">
                        <input
                          type="range"
                          tabIndex={-1}
                          min="0"
                          max="100"
                          step="5"
                          value={formData.consumables_discount_pct}
                          onChange={(e) => setFormData({ ...formData, consumables_discount_pct: Number(e.target.value) })}
                          className="w-full accent-amber-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={formData.consumables_discount_pct}
                            onChange={(e) => {
                              const val = Math.min(100, Math.max(0, parseFloat(e.target.value) || 0))
                              setFormData({ ...formData, consumables_discount_pct: val })
                            }}
                            className="w-14 bg-slate-900 border border-slate-700 rounded-lg px-1.5 py-1 text-xs text-white font-mono font-bold text-center focus:outline-none focus:border-amber-500"
                          />
                          <span className="text-xs text-slate-400 font-bold">%</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden flex border border-slate-800">
                          <div className="bg-amber-500 transition-all duration-200" style={{ width: `${formData.consumables_discount_pct}%` }} />
                          <div className="bg-purple-500 transition-all duration-200" style={{ width: `${100 - formData.consumables_discount_pct}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px]">
                          <span className="text-amber-400 font-semibold">Descuento Contratista: {formData.consumables_discount_pct}%</span>
                          <span className="text-purple-400 font-semibold">Imputación Obra: {100 - formData.consumables_discount_pct}%</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* BLOQUE 5 (PÚRPURA): ESTADO EN NÓMINA & PERMISOS */}
                  <div className="alon-chunk-purple space-y-2.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-black text-purple-300 uppercase tracking-wider">
                        5. Estado en Nómina & Permisos Operativos
                      </label>
                      <span className="text-[10px] font-mono text-purple-400/80">Paso 5/5</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <label className="text-xs font-semibold text-slate-300 shrink-0">
                        Estado en Nómina:
                      </label>
                      <select
                        value={formData.status}
                        onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400 font-bold cursor-pointer"
                      >
                        <option value="ACTIVO">ACTIVO 🟢</option>
                        <option value="INACTIVO">INACTIVO 🔴</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs text-slate-200 cursor-pointer hover:border-cyan-500/40">
                        <input
                          type="checkbox"
                          checked={formData.can_withdraw_materials}
                          onChange={(e) => setFormData({ ...formData, can_withdraw_materials: e.target.checked })}
                          className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-primary cursor-pointer accent-primary"
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

      {/* MENÚ CONTEXTUAL CANÓNICO (CLIC DERECHO EN FILA O CELDA) */}
      {contextMenuTarget && (
        <GridContextMenu
          target={contextMenuTarget}
          onClose={() => setContextMenuTarget(null)}
          onCopyCell={activeTab === 'nomina' ? nominaGrid.copyActiveCell : ratesGrid.copyActiveCell}
          onCopyRow={activeTab === 'nomina' ? nominaGrid.copyRow : ratesGrid.copyRow}
          onPaste={activeTab === 'nomina' ? nominaGrid.pasteToActiveOrRange : ratesGrid.pasteToActiveOrRange}
          onDeleteCell={activeTab === 'nomina' ? nominaGrid.deleteActiveCellOrRange : ratesGrid.deleteActiveCellOrRange}
          onDeleteRow={
            activeTab === 'nomina'
              ? (row) => handleDelete(row)
              : null
          }
          onDuplicateRow={
            activeTab === 'nomina'
              ? (row) => {
                  setFormData({
                    name: `${row.name || ''} (Copia)`,
                    category: row.category || 'OFICIAL',
                    trade: row.trade || '',
                    work_group: row.work_group || '',
                    admin_center: row.admin_center || 'ASTILLERO',
                    hourly_rate_ars: row.hourly_rate_ars || '',
                    phone: row.phone || '',
                    can_withdraw_materials: row.can_withdraw_materials ?? true,
                    can_impute_hours: row.can_impute_hours ?? true,
                    can_charge_third_party: row.can_charge_third_party ?? false,
                    is_foreman: false
                  })
                  setEditingWorker(null)
                  setIsNewModalOpen(true)
                }
              : null
          }
          entityType={contextMenuTarget.entityType || 'workers'}
          recordId={contextMenuTarget.recordId}
          recordLabel={contextMenuTarget.recordLabel}
        />
      )}
    </div>
  )
}
