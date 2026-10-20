import { useState, useEffect, useMemo } from 'react'
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
  ChevronRight
} from 'lucide-react'
import { supabase } from '../lib/supabase'
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
  const [rateOficial, setRateOficial] = useState(16365.76)

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
        .select('period, year, month, quincena, dollar_rate')

      if (error) throw error
      if (data) {
        const map = new Map()
        data.forEach(d => {
          if (!map.has(d.period)) {
            map.set(d.period, d)
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

  // Filtrado de tarifas para la tabla histórica
  const filteredRateCards = useMemo(() => {
    return rateCards.filter(rc => {
      if (filterTableCenter !== 'todos' && rc.admin_center !== filterTableCenter) return false
      if (rateTableSearch) {
        const term = rateTableSearch.toLowerCase()
        const match = (rc.entity_name || '').toLowerCase().includes(term) ||
                      (rc.period || '').toLowerCase().includes(term)
        if (!match) return false
      }
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
    const set = new Set()
    workers.forEach(w => {
      if (w.trade) set.add(w.trade)
    })
    return Array.from(set).sort()
  }, [workers])

  const filteredWorkers = useMemo(() => {
    return workers.filter(w => {
      const term = searchTerm.toLowerCase()
      const matchSearch = !term ||
        (w.name || '').toLowerCase().includes(term) ||
        (w.work_group || '').toLowerCase().includes(term) ||
        (w.trade || '').toLowerCase().includes(term) ||
        (w.category || '').toLowerCase().includes(term)

      if (!matchSearch) return false
      if (filterCenter !== 'todos' && w.admin_center !== filterCenter) return false
      if (filterStatus !== 'todos' && w.status !== filterStatus) return false
      if (filterGroup !== 'todos' && w.work_group !== filterGroup) return false
      if (filterForemanOnly && !w.is_foreman) return false
      return true
    })
  }, [workers, searchTerm, filterCenter, filterStatus, filterGroup, filterForemanOnly])

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

        // Si es Contratista/Taller, sincronizar permiso 3ros en todo su Grupo de Trabajo
        if (finalGroup !== 'ASTILLERO') {
          await supabase
            .from('workers')
            .update({ can_charge_third_party: payload.can_charge_third_party })
            .eq('work_group', finalGroup)
        }

        setWorkers(prev => prev.map(w => {
          if (w.id === editingWorker.id) return { ...w, ...payload }
          if (finalGroup !== 'ASTILLERO' && w.work_group === finalGroup) {
            return { ...w, can_charge_third_party: payload.can_charge_third_party }
          }
          return w
        }))
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
      setStatusMessage({ type: 'info', text: `Se eliminó a ${worker.name}.` })
      setTimeout(() => setStatusMessage(null), 3000)
    } catch (err) {
      console.error(err)
      setStatusMessage({ type: 'error', text: `Error al eliminar: ${err.message}` })
      loadWorkers()
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* CABECERA & NAVEGACIÓN PRINCIPAL */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800/80 pb-4">
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

        {/* SELECTOR DE PESTAÑAS PRINCIPALES */}
        <div className="flex flex-wrap items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800 shadow-inner">
          <button
            type="button"
            onClick={() => setActiveTab('nomina')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'nomina'
                ? 'bg-gradient-to-r from-primary to-blue-600 text-slate-950 shadow-md font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Padrón de Personal ({totalCount})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('tarifario')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'tarifario'
                ? 'bg-gradient-to-r from-emerald-400 to-teal-500 text-slate-950 shadow-md font-extrabold'
                : 'text-emerald-400 hover:text-emerald-300'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Tarifario Quincenal</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono">
              {currentPeriodKey}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analisis')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === 'analisis'
                ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md font-extrabold'
                : 'text-purple-400 hover:text-purple-300'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Análisis de Variación & FX</span>
          </button>

          {/* Botón para abrir gestor de roles técnicos */}
          <button
            type="button"
            onClick={() => {
              setRolesFormData(JSON.parse(JSON.stringify(orgRoles)))
              setIsRolesModalOpen(true)
            }}
            title="Administrar Puestos y Titulares Organizacionales"
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-900 transition-colors border border-transparent hover:border-slate-800 cursor-pointer"
          >
            <Settings className="w-4 h-4" />
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
          {/* BARRA DE CONTROL DEL PERÍODO & VALOR DÓLAR CONGELADO */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-emerald-400" />
                  <h2 className="text-base font-bold text-white">
                    Período Quincenal de Costos & Cotización
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

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
              {/* Selector de Año */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Año
                </label>
                <select
                  value={rateYear}
                  onChange={(e) => setRateYear(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value={2025}>2025</option>
                  <option value={2026}>2026</option>
                  <option value={2027}>2027</option>
                </select>
              </div>

              {/* Selector de Mes */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Mes
                </label>
                <select
                  value={rateMonth}
                  onChange={(e) => setRateMonth(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                >
                  {MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx + 1}>
                      {name} ({idx + 1})
                    </option>
                  ))}
                </select>
              </div>

              {/* Selector de Quincena */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Quincena
                </label>
                <select
                  value={rateQuincena}
                  onChange={(e) => setRateQuincena(parseInt(e.target.value))}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                >
                  <option value={1}>1ra Quincena (1Q: días 1 al 15)</option>
                  <option value={2}>2da Quincena (2Q: días 16 al cierre)</option>
                </select>
              </div>

              {/* Cotización Dólar Quincenal (CONGELADO / SOLO LECTURA) */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-400 mb-1 flex items-center justify-between">
                  <span>Valor US$ Quincenal</span>
                  <span className="text-[9px] text-slate-500 flex items-center gap-1 font-mono">
                    <Lock className="w-2.5 h-2.5 text-amber-400" />
                    <span>Fijado por Adm.</span>
                  </span>
                </label>
                <div className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-extrabold text-emerald-400 flex items-center justify-between shadow-inner">
                  <span className="flex items-center gap-1">
                    <span className="text-slate-500 font-normal">$</span>
                    <span className="text-white text-sm font-bold">{parseFloat(dollarRate).toLocaleString('es-AR')}</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-sans font-normal">ARS / USD</span>
                </div>
              </div>
            </div>

            {/* QUINCENAS CON TARIFAS GUARDADAS (ORDEN ESTRICTAMENTE CALENDARIO: 1Q y luego 2Q) */}
            {sortedRecordedPeriods.length > 0 && (
              <div className="pt-2 border-t border-slate-800/60 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                <History className="w-3.5 h-3.5 text-slate-500 mr-1" />
                <span className="text-[11px]">Quincenas con tarifas guardadas (orden cronológico):</span>
                {sortedRecordedPeriods.map(p => (
                  <button
                    key={p.period}
                    type="button"
                    onClick={() => {
                      setRateYear(p.year)
                      setRateMonth(p.month)
                      setRateQuincena(p.quincena)
                      if (p.dollar_rate) setDollarRate(parseFloat(p.dollar_rate))
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                      p.period === currentPeriodKey
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 font-black shadow-md'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    {p.period}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* FORMULARIO UNIFICADO: GOBERNADO POR EL CENTRO DE COSTO */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-5">
            <div className="border-b border-slate-800 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-extrabold text-white flex items-center gap-2">
                    <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
                    Carga Unificada de Nuevos Valores
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Seleccioná el Centro Administrativo para configurar los valores sindicales o de contratistas.
                  </p>
                </div>

                {/* DESPLEGABLE MAESTRO: CENTRO DE COSTO / ADMINISTRATIVO */}
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-slate-300">Centro:</span>
                  <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-700">
                    <button
                      type="button"
                      onClick={() => setRateAdminCenter('ASTILLERO')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        rateAdminCenter === 'ASTILLERO'
                          ? 'bg-cyan-500 text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      ASTILLERO (5 Categorías)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setRateAdminCenter('CONTRATISTA')
                        if (uniqueContractorList.length > 0 && !selectedContractor) {
                          handleSelectContractor(uniqueContractorList[0])
                        }
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all cursor-pointer ${
                        rateAdminCenter === 'CONTRATISTA'
                          ? 'bg-amber-500 text-slate-950 shadow-md'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      CONTRATISTAS
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* CASO A: CENTRO ADMINISTRATIVO = ASTILLERO (5 CATEGORÍAS SINDICALES OFICIALES) */}
            {rateAdminCenter === 'ASTILLERO' && (
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-3.5 rounded-xl bg-cyan-950/30 border border-cyan-800/40 text-xs text-cyan-300 flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 shrink-0 mt-0.5 text-cyan-400" />
                  <div>
                    <strong>Escala Sindical Astillero:</strong> El titular de {orgRoles['LIQUIDACION_SUELDOS']?.title} ({orgRoles['LIQUIDACION_SUELDOS']?.holder}) ingresa los nuevos valores aprobados por convenio sindical para el personal propio de AlonCar. Se imputan obligatoriamente a las 5 categorías oficiales (los mandados constituyen un rubro operativo, no una categoría salarial).
                  </div>
                </div>

                {/* Grilla de las 5 Categorías Oficiales con Colores Exactos de la Planilla */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {ASTILLERO_BASE_CATEGORIES.map(category => {
                    const currentItem = astilleroForm[category] || { ars: 0, usd: 0 }
                    const calcUsd = dollarRate > 0 ? (currentItem.ars / dollarRate).toFixed(2) : 0

                    return (
                      <div 
                        key={category} 
                        className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 hover:border-cyan-800/60 transition-all space-y-2.5"
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
              <div className="space-y-4 animate-in fade-in duration-150">
                <div className="p-3.5 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-300 flex items-start gap-2.5">
                  <HardHat className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <div>
                    <strong>Tarifas de Contratistas:</strong> El titular de {orgRoles['DIRECCION_OPERACIONES']?.title} ({orgRoles['DIRECCION_OPERACIONES']?.holder}) determina y negocia los valores por hora con cada prestador. {orgRoles['LIQUIDACION_SUELDOS']?.title} ({orgRoles['LIQUIDACION_SUELDOS']?.holder}) realiza la carga operativa en el ERP. Si el contratista ofrece ayudante se habilita la carga dual; de lo contrario, el ayudante queda estrictamente bloqueado.
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                  {/* Selector de Contratista */}
                  <div className="md:col-span-1 space-y-2">
                    <label className="block text-xs font-bold text-slate-300">
                      Seleccionar Contratista
                    </label>
                    <select
                      value={selectedContractor}
                      onChange={(e) => handleSelectContractor(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-amber-500 font-mono"
                    >
                      {uniqueContractorList.map(c => (
                        <option key={c} value={c}>
                          {c} {rootContractorsMap[c]?.hasAyudanteOption ? '(Dual: Ofic. + Ayud.)' : '(Oficial Único)'}
                        </option>
                      ))}
                    </select>

                    <div className="text-[11px] text-slate-400 p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                      <span>Integrantes en nómina: </span>
                      <strong className="text-white">{rootContractorsMap[selectedContractor]?.workersCount || 0} personas</strong>
                    </div>

                    {/* Switch manual para destrabar Ayudante si el titular de Dirección acordó una excepción */}
                    <div className="pt-2">
                      <label className="flex items-center gap-2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={contractorHasAyudante}
                          onChange={(e) => setContractorHasAyudante(e.target.checked)}
                          className="w-3.5 h-3.5 rounded border-slate-700 bg-slate-900 text-amber-500 cursor-pointer accent-amber-500"
                        />
                        <span className="text-[11px]">
                          {contractorHasAyudante ? 'Categoría Ayudante habilitada' : 'Habilitar categoría Ayudante (excepción)'}
                        </span>
                      </label>
                    </div>
                  </div>

                  {/* Carga de Oficial y Ayudante */}
                  <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    {/* Tarifa Oficial */}
                    <div className="p-4 rounded-xl bg-slate-950 border border-emerald-900/40 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          <Unlock className="w-3.5 h-3.5" />
                          OFICIAL (Contratista)
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
                            <Lock className="w-3.5 h-3.5 text-slate-500" />
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

          {/* TABLA HISTÓRICA CONSOLIDADA (CON BUSCADOR Y FILTRO DE QUINCENAS) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm uppercase tracking-wider font-bold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-emerald-400" />
                  Tarifas Guardadas en el Sistema ({filteredRateCards.length})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Visualizá y filtrá las tarifas de la quincena activa o de todo el historial.
                </p>
              </div>

              {/* Filtros: Alcance de Quincena, Centro y Búsqueda */}
              <div className="flex flex-wrap items-center gap-2">
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

                {/* Filtro por centro */}
                <div className="flex items-center gap-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setFilterTableCenter('todos')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      filterTableCenter === 'todos' ? 'bg-primary text-slate-950' : 'bg-slate-950 text-slate-400 border border-slate-800'
                    }`}
                  >
                    Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTableCenter('ASTILLERO')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      filterTableCenter === 'ASTILLERO' ? 'bg-cyan-500 text-slate-950' : 'bg-slate-950 text-cyan-400 border border-slate-800'
                    }`}
                  >
                    Astillero
                  </button>
                  <button
                    type="button"
                    onClick={() => setFilterTableCenter('CONTRATISTA')}
                    className={`px-2.5 py-1 rounded-lg font-bold transition-colors cursor-pointer ${
                      filterTableCenter === 'CONTRATISTA' ? 'bg-amber-500 text-slate-950' : 'bg-slate-950 text-amber-400 border border-slate-800'
                    }`}
                  >
                    Contratistas
                  </button>
                </div>

                {/* Buscador */}
                <div className="relative min-w-[200px]">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Filtrar por categoría o contratista..."
                    value={rateTableSearch}
                    onChange={(e) => setRateTableSearch(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                  />
                  {rateTableSearch && (
                    <button
                      type="button"
                      onClick={() => setRateTableSearch('')}
                      className="absolute right-2 top-2 text-slate-500 hover:text-white"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Quincena</th>
                    <th className="py-2.5 px-3">Categoría / Contratista</th>
                    <th className="py-2.5 px-3 text-right">Oficial AR$</th>
                    <th className="py-2.5 px-3 text-center text-emerald-400">Oficial U$</th>
                    <th className="py-2.5 px-3 text-right">Ayudante AR$</th>
                    <th className="py-2.5 px-3 text-center text-amber-400">Ayudante U$</th>
                    <th className="py-2.5 px-3 text-center">Dólar</th>
                    <th className="py-2.5 px-3 text-center">Centro</th>
                    <th className="py-2.5 px-3 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredRateCards.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-500">
                        {loadingRateCards ? 'Cargando tarifas...' : 'No se encontraron tarifas registradas para el filtro seleccionado.'}
                      </td>
                    </tr>
                  ) : (
                    filteredRateCards.map(rc => (
                      <tr key={rc.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-2 px-3">
                          <span className="font-mono text-xs font-bold text-slate-400">{rc.period}</span>
                        </td>
                        <td className="py-2 px-3">
                          {rc.admin_center === 'ASTILLERO' ? (
                            <span className={`px-2 py-0.5 rounded text-[10px] border ${getCategoryBadgeStyle(rc.entity_name)}`}>
                              {rc.entity_name}
                            </span>
                          ) : (
                            <span className="font-extrabold text-white font-mono">{rc.entity_name}</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-white">
                          ${parseFloat(rc.rate_oficial_ars || 0).toLocaleString('es-AR')}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-extrabold text-emerald-400">
                          ${parseFloat(rc.rate_oficial_usd || 0).toFixed(2)}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold">
                          {rc.rate_ayudante_ars ? (
                            <span className="text-white">${parseFloat(rc.rate_ayudante_ars).toLocaleString('es-AR')}</span>
                          ) : (
                            <span className="text-slate-600 font-normal italic">No aplica</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-center font-mono font-extrabold text-amber-400">
                          {rc.rate_ayudante_usd ? `$${parseFloat(rc.rate_ayudante_usd).toFixed(2)}` : '-'}
                        </td>
                        <td className="py-2 px-3 text-center font-mono text-slate-400">
                          ${rc.dollar_rate}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                            rc.admin_center === 'ASTILLERO'
                              ? 'bg-cyan-950 text-cyan-300 border-cyan-800'
                              : 'bg-amber-950 text-amber-300 border-amber-800'
                          }`}>
                            {rc.admin_center}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => {
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
                              window.scrollTo({ top: 120, behavior: 'smooth' })
                            }}
                            className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ml-auto"
                            title="Editar este registro histórico"
                          >
                            <Pencil className="w-3 h-3" />
                            <span>Editar</span>
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PESTAÑA 1: PADRÓN OPERATIVO DE PERSONAS & GRUPOS DE TRABAJO */}
      {/* ========================================================================= */}
      {activeTab === 'nomina' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* BARRA SUPERIOR: VALOR DÓLAR & TARIFAS SINDICATO */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
            {/* Cotización Dólar Quincenal (CONGELADO / SOLO LECTURA) */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
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

            {/* Tarifa Ayudante Base (Con color oficial Cyan) */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-cyan-900/40 flex items-center justify-between">
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
            </div>

            {/* Tarifa Oficial Base (Con color oficial Verde) */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-emerald-900/40 flex items-center justify-between">
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
            </div>

            {/* Acceso Rápido hacia Tarifario */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                  TARIFAS QUINCENALES
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab('tarifario')}
                  className="mt-1 text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
                >
                  <span>Cargar Nuevos Valores &rarr;</span>
                </button>
              </div>
              <div className="w-9 h-9 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300">
                <Calculator className="w-5 h-5 text-emerald-400" />
              </div>
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
              <span>+ Cargar Nuevo Contratista / Operario</span>
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

          {/* VISTA B: GRILLA MAESTRA DETALLADA (CON COLORES DE CATEGORÍA DE IMAGEN 1) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 md:p-6 shadow-xl space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-sm uppercase tracking-wider font-bold text-white flex items-center gap-2">
                  <HardHat className="w-4 h-4 text-cyan-400" />
                  Padrón Operativo de Personas y Talleres
                </h2>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Cargá a cada persona vinculada a su Grupo de Trabajo. Las categorías exhiben los colores de la escala salarial oficial.
                </p>
              </div>

              {/* Buscador */}
              <div className="relative min-w-[280px]">
                <Search className="w-3.5 h-3.5 absolute left-3 top-3 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por operario, grupo, rubro..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-primary"
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-white cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* PESTAÑAS Y FILTROS RÁPIDOS */}
            <div className="flex flex-wrap items-center gap-2 text-xs">
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

            {/* TABLA MAESTRA */}
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="py-2.5 px-3">Nombre y Apellido</th>
                    <th className="py-2.5 px-3 text-center">Categoría</th>
                    <th className="py-2.5 px-3">Rubro</th>
                    <th className="py-2.5 px-3 text-right">AR$/Hora</th>
                    <th className="py-2.5 px-2 text-center text-emerald-400">U$/Hora</th>
                    <th className="py-2.5 px-3">Grupo de Trabajo</th>
                    <th className="py-2.5 px-2.5">Centro Admin</th>
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
                      <td colSpan={12} className="py-10 text-center text-slate-500">
                        {loading ? 'Cargando padrón...' : 'No se encontraron registros que coincidan con la búsqueda.'}
                      </td>
                    </tr>
                  ) : (
                    filteredWorkers.map(w => {
                      const isActivo = w.status === 'ACTIVO'
                      const usdCalc = dollarRate > 0 && w.hourly_rate_ars ? (w.hourly_rate_ars / dollarRate).toFixed(2) : (w.hourly_rate_usd || 0)

                      return (
                        <tr 
                          key={w.id} 
                          className={`hover:bg-slate-800/30 transition-colors ${!isActivo ? 'opacity-60 bg-rose-950/5' : ''}`}
                        >
                          {/* 1. Nombre y Apellido */}
                          <td className="py-2 px-3">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-white">{w.name}</span>
                              {w.is_foreman && (
                                <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-600 font-extrabold">
                                  👷 Jefe de Obra
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 2. Categoría */}
                          <td className="py-2 px-3 text-center">
                            {w.category ? (
                              <span className={`px-2 py-0.5 rounded text-[10px] uppercase border inline-block ${getCategoryBadgeStyle(w.category)}`}>
                                {w.category}
                              </span>
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>

                          {/* 3. Rubro */}
                          <td className="py-2 px-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getRubroBadgeColor(w.trade)}`}>
                              {w.trade || 'General'}
                            </span>
                          </td>

                          {/* 4. AR$/Hora */}
                          <td className="py-2 px-3 text-right font-mono font-bold text-white">
                            {w.hourly_rate_ars > 0 ? (
                              `$${parseFloat(w.hourly_rate_ars).toLocaleString('es-AR')}`
                            ) : (
                              <span className="text-slate-600">-</span>
                            )}
                          </td>

                          {/* 5. U$/Hora */}
                          <td className="py-2 px-2 text-center font-mono font-extrabold text-emerald-400">
                            ${usdCalc}
                          </td>

                          {/* 6. Grupo de Trabajo */}
                          <td className="py-2 px-3">
                            <span className="font-mono text-cyan-300 font-bold px-2 py-0.5 rounded bg-slate-950 border border-slate-800">
                              {w.work_group}
                            </span>
                          </td>

                          {/* 7. Centro Admin */}
                          <td className="py-2 px-2.5">
                            <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                              w.admin_center === 'ASTILLERO'
                                ? 'bg-cyan-950/80 text-cyan-300 border-cyan-800/60'
                                : w.admin_center === 'TALLER'
                                ? 'bg-purple-950/80 text-purple-300 border-purple-800/60'
                                : 'bg-amber-950/80 text-amber-300 border-amber-800/60'
                            }`}>
                              {w.admin_center}
                            </span>
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

      {/* MODAL DE ALTA / EDICIÓN DE OPERARIO */}
      {(isNewModalOpen || editingWorker) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 relative max-h-[95vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-primary" />
                  {editingWorker ? `Editar Operario: ${editingWorker.name}` : 'Cargar Nuevo Contratista / Operario'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Los operarios y contratistas se imputan por <strong>Grupo de Trabajo</strong> para unificar la carga en Horas y Pañol.
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setIsNewModalOpen(false); setEditingWorker(null) }}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSubmit} className="space-y-4">
              {/* 1. CENTRO ADMINISTRATIVO (DESTACADO ARRIBA COMO SELECTOR PRINCIPAL) */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                  1. Centro Administrativo (Origen del Personal)
                </label>
                <div className="grid grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleAdminCenterChange('ASTILLERO')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      formData.admin_center === 'ASTILLERO'
                        ? 'bg-cyan-950/80 border-cyan-400 text-white shadow-lg shadow-cyan-950/50 ring-1 ring-cyan-400'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <Building2 className={`w-4 h-4 ${formData.admin_center === 'ASTILLERO' ? 'text-cyan-400' : 'text-slate-500'}`} />
                      {formData.admin_center === 'ASTILLERO' && <span className="text-[10px] text-cyan-400 font-bold">✓ Activo</span>}
                    </div>
                    <div>
                      <div className="font-extrabold text-xs">ASTILLERO</div>
                      <div className="text-[10px] text-slate-400 leading-tight mt-0.5">Personal propio</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAdminCenterChange('CONTRATISTA')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      formData.admin_center === 'CONTRATISTA'
                        ? 'bg-amber-950/80 border-amber-400 text-white shadow-lg shadow-amber-950/50 ring-1 ring-amber-400'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <HardHat className={`w-4 h-4 ${formData.admin_center === 'CONTRATISTA' ? 'text-amber-400' : 'text-slate-500'}`} />
                      {formData.admin_center === 'CONTRATISTA' && <span className="text-[10px] text-amber-400 font-bold">✓ Activo</span>}
                    </div>
                    <div>
                      <div className="font-extrabold text-xs">CONTRATISTA</div>
                      <div className="text-[10px] text-slate-400 leading-tight mt-0.5">Cuadrilla en planta</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAdminCenterChange('TALLER')}
                    className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      formData.admin_center === 'TALLER'
                        ? 'bg-purple-950/80 border-purple-400 text-white shadow-lg shadow-purple-950/50 ring-1 ring-purple-400'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full mb-1">
                      <Settings className={`w-4 h-4 ${formData.admin_center === 'TALLER' ? 'text-purple-400' : 'text-slate-500'}`} />
                      {formData.admin_center === 'TALLER' && <span className="text-[10px] text-purple-400 font-bold">✓ Activo</span>}
                    </div>
                    <div>
                      <div className="font-extrabold text-xs">TALLER</div>
                      <div className="text-[10px] text-slate-400 leading-tight mt-0.5">Servicio externo / RMO</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* 2. GRUPO DE TRABAJO (TALLER / CUADRILLA) */}
              {formData.admin_center === 'ASTILLERO' ? (
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-cyan-950/60 border border-cyan-800/60 flex items-center justify-center text-cyan-400">
                      <Building2 className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-white">Grupo de Trabajo: ASTILLERO</div>
                      <div className="text-[11px] text-slate-400">Personal propio registrado bajo el centro operativo de Astillero.</div>
                    </div>
                  </div>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800 flex items-center gap-1">
                    <Lock className="w-2.5 h-2.5 text-cyan-400" />
                    Fijado
                  </span>
                </div>
              ) : (
                <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                      <span>Grupo de Trabajo ({formData.admin_center === 'CONTRATISTA' ? 'Contratista' : 'Taller'})</span>
                      <span className="text-[10px] font-normal text-amber-400 font-sans">(Identificador en Horas y Pañol)</span>
                    </label>

                    <button
                      type="button"
                      onClick={() => {
                        setIsCustomGroup(!isCustomGroup)
                        if (!isCustomGroup && !customGroupName) {
                          setCustomGroupName('')
                        }
                      }}
                      className="text-[11px] font-bold text-primary hover:text-cyan-300 underline flex items-center gap-1 cursor-pointer"
                    >
                      {isCustomGroup ? '↩ Elegir de grupos precargados' : '+ Crear nuevo grupo / taller'}
                    </button>
                  </div>

                  {isCustomGroup ? (
                    <div className="space-y-1">
                      <input
                        type="text"
                        required
                        placeholder="Escribir nombre del nuevo grupo o taller (ej: METALURGICA DEL PUERTO)"
                        value={customGroupName}
                        onChange={(e) => setCustomGroupName(e.target.value.toUpperCase())}
                        className="w-full bg-slate-900 border border-primary/60 rounded-lg px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-primary shadow-inner"
                        autoFocus
                      />
                      <p className="text-[10px] text-cyan-400">
                        ✨ Se creará este nuevo grupo y se asociará automáticamente al operario.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <select
                        value={formData.work_group}
                        onChange={(e) => setFormData({ ...formData, work_group: e.target.value })}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-primary cursor-pointer"
                      >
                        {(formData.admin_center === 'CONTRATISTA' ? availableContractorGroups : availableTallerGroups).map(g => (
                          <option key={g} value={g}>{g}</option>
                        ))}
                      </select>
                      <p className="text-[10px] text-slate-400">
                        Seleccioná un taller/contratista existente o tocá <strong>"+ Crear nuevo grupo / taller"</strong> para registrar uno nuevo.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* 3. DATOS DE LA PERSONA: NOMBRE & RUBRO */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Nombre y Apellido
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Rodriguez, Lucas"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Rubro Principal
                  </label>
                  <input
                    type="text"
                    required
                    list="trades-datalist"
                    placeholder="CALDERERIA, PINTURA, MECANICA..."
                    value={formData.trade}
                    onChange={(e) => setFormData({ ...formData, trade: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-bold"
                  />
                  <datalist id="trades-datalist">
                    {uniqueTrades.map(t => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* 4. TARIFA AR$, U$/HORA (CONGELADO/CALCULADO) & CATEGORÍA */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950 rounded-xl border border-slate-800">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                    Tarifa AR$/Hora
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-2 text-slate-500 font-mono font-bold">$</span>
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
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg pl-6 pr-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-primary"
                    />
                  </div>
                  <span className="text-[9px] text-slate-500">Valor hora en pesos</span>
                </div>

                {/* U$/Hora CONGELADO / COMPUTADO */}
                <div className="bg-slate-900/90 border border-emerald-900/40 rounded-lg px-2.5 py-1.5 flex flex-col justify-between">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-emerald-400 flex items-center gap-1">
                      <Lock className="w-2.5 h-2.5 text-amber-400" />
                      U$/Hora (a ${dollarRate})
                    </span>
                    <span className="text-[8px] px-1 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800">Congelado</span>
                  </div>
                  <div className="text-sm font-extrabold text-emerald-300 font-mono my-0.5">
                    ${dollarRate > 0 && formData.hourly_rate_ars ? (parseFloat(formData.hourly_rate_ars) / dollarRate).toFixed(2) : '0.00'} <span className="text-[10px] font-sans font-normal text-slate-400">USD</span>
                  </div>
                  <span className="text-[9px] text-slate-500">Calculado automáticamente</span>
                </div>

                <div>
                  <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
                    Categoría
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-primary font-bold"
                  >
                    <option value="AYUDANTE">AYUDANTE</option>
                    <option value="OFICIAL">OFICIAL</option>
                    <option value="1/2 OFICIAL">1/2 OFICIAL</option>
                    <option value="APRENDIZ">APRENDIZ</option>
                    <option value="OFICIAL BLACK">OFICIAL BLACK</option>
                  </select>
                  <span className="text-[9px] text-slate-500">Escala sindical base</span>
                </div>
              </div>

              {/* 5. CONSUMIBLES (PAÑOL) CON PORCENTAJE DE DESCUENTO */}
              <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-xs font-bold text-slate-200">
                      Consumibles de Pañol (% Descuento al Contratista / Taller)
                    </label>
                    <p className="text-[10px] text-slate-400">
                      Porcentaje de los insumos y materiales retirados que se descontará de la liquidación.
                    </p>
                  </div>
                  <span className="text-xs font-mono font-extrabold text-amber-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                    {formData.consumables_discount_pct}% Descuento
                  </span>
                </div>

                {/* Botones de porcentaje preestablecido */}
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { pct: 100, label: '100% Contratista', desc: 'Descuento total' },
                    { pct: 60, label: '60% Contratista', desc: '40% Obra' },
                    { pct: 50, label: '50% Compartido', desc: '50% Obra' },
                    { pct: 0, label: '0% Obra / Cliente', desc: '100% a la obra' }
                  ].map(btn => (
                    <button
                      key={btn.pct}
                      type="button"
                      onClick={() => setFormData({ ...formData, consumables_discount_pct: btn.pct })}
                      className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all border text-center cursor-pointer ${
                        Number(formData.consumables_discount_pct) === btn.pct
                          ? 'bg-amber-950 text-amber-300 border-amber-500 shadow-md ring-1 ring-amber-500'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-white'
                      }`}
                    >
                      <div>{btn.label}</div>
                      <div className="text-[9px] opacity-70 font-normal">{btn.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Control Deslizante & Input Manual */}
                <div className="flex items-center gap-3 pt-1">
                  <input
                    type="range"
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
                      className="w-16 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white font-mono font-bold text-center focus:outline-none focus:border-amber-500"
                    />
                    <span className="text-xs text-slate-400 font-bold">%</span>
                  </div>
                </div>

                {/* Barra visual de distribución Contratista vs Obra */}
                <div className="space-y-1 pt-1 border-t border-slate-800/80">
                  <div className="w-full bg-slate-900 h-2 rounded-full overflow-hidden flex border border-slate-800">
                    <div 
                      className="bg-amber-500 transition-all duration-200" 
                      style={{ width: `${formData.consumables_discount_pct}%` }} 
                      title={`Descuento Contratista: ${formData.consumables_discount_pct}%`}
                    />
                    <div 
                      className="bg-purple-500 transition-all duration-200" 
                      style={{ width: `${100 - formData.consumables_discount_pct}%` }} 
                      title={`Imputación a la Obra: ${100 - formData.consumables_discount_pct}%`}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] text-slate-400">
                    <span className="text-amber-400 font-semibold">Descuento a Contratista: {formData.consumables_discount_pct}%</span>
                    <span className="text-purple-400 font-semibold">Imputación a la Obra: {100 - formData.consumables_discount_pct}%</span>
                  </div>
                </div>
              </div>

              {/* 6. ESTADO EN NÓMINA & PERMISOS/REQUERIMIENTOS */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Estado en Nómina
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-primary font-bold cursor-pointer"
                  >
                    <option value="ACTIVO">ACTIVO 🟢</option>
                    <option value="INACTIVO">INACTIVO 🔴</option>
                  </select>
                </div>

                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex flex-col justify-center space-y-2 text-xs">
                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.can_withdraw_materials}
                      onChange={(e) => setFormData({ ...formData, can_withdraw_materials: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary"
                    />
                    <span>Permiso para retirar de Pañol (<strong>P</strong>)</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.can_impute_hours}
                      onChange={(e) => setFormData({ ...formData, can_impute_hours: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-primary cursor-pointer accent-primary"
                    />
                    <span className="font-semibold text-cyan-300">Requiere imputar Horas (<strong>H</strong>)</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.can_charge_third_party}
                      onChange={(e) => setFormData({ ...formData, can_charge_third_party: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-purple-400 cursor-pointer accent-purple-500"
                    />
                    <span className="font-semibold text-purple-300">Habilitado para Terceros / Presupuestos (<strong>3ros</strong>)</span>
                  </label>

                  <label className="flex items-center gap-2 text-slate-300 cursor-pointer pt-1 border-t border-slate-800">
                    <input
                      type="checkbox"
                      checked={formData.is_foreman}
                      onChange={(e) => setFormData({ ...formData, is_foreman: e.target.checked })}
                      className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-amber-400 cursor-pointer accent-amber-500"
                    />
                    <span className="font-semibold text-amber-300">👷 Es Jefe de Obra (aparece en Órdenes de Trabajo)</span>
                  </label>
                </div>
              </div>

              {/* BOTONES DE ACCIÓN */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { setIsNewModalOpen(false); setEditingWorker(null) }}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingWorker}
                  className="px-5 py-2 bg-gradient-to-r from-primary to-blue-500 text-slate-950 text-xs font-bold rounded-lg shadow-md hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingWorker ? 'Guardando...' : (editingWorker ? 'Guardar Cambios' : 'Registrar Operario')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
