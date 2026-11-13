// ==============================================================================
// HELPERS PUROS Y CONSTANTES DE LA PLANILLA DE NÓMINA DE PERSONAL (M2)
// Sin dependencias de React ni Supabase: 100% testeable en Node.
// ==============================================================================

import { matchesUniversalSearch } from './searchEngine.js'
import { computeContractExpiration } from './workCostRules.js'

export const ASTILLERO_BASE_CATEGORIES = [
  'AYUDANTE',
  'OFICIAL',
  '1/2 OFICIAL',
  'APRENDIZ',
  'OFICIAL BLACK'
]

export const BASE_NOMINA_TRADES = [
  'CALDERERIA', 'CARPINTERIA', 'COBRERIA', 'ELECTRICIDAD', 'FIBRA VIDRIO',
  'FRIGORISTA', 'GASISTA', 'HIDRAULICA', 'MANIOBRA', 'MECANICA',
  'MISCELANEOS', 'PAÑOLERO', 'PINTURA', 'RASCHINAJE', 'SERENO',
  'SERVICIOS', 'SOLDADURA', 'TECNICOS', 'TORNERIA'
]

export const KNOWN_CONTRACTORS = [
  'AVALOS', 'DAMIAN', 'TANO', 'PINTOR JUAREZ', 'RAMON ARANDA',
  'CHACANO', 'CHARRA', 'LUAYZA', 'TOBARES', 'BOLTRI', 'CAMILO MARTINEZ',
  'ALDO (CARPINTERO)', 'DE ANGELIS', 'VALENCIA ARENADOR', 'LEO ZOLOA',
  'EDUARDO FERNANDEZ', 'ARRIOLA', 'MATIAS SANCHEZ', 'ALAN MOISES',
  'GUILLERMO GARCIA', 'BRUNO HRNOS', 'CARLOS VIDONDO', 'JUAREZ JUAN', 'JHONNY'
]

export const KNOWN_TALLERES = [
  'CORMETAL', 'DIVISION CORTE', 'GARCIA TORNERIA.', 'GPA', 'GRILLO TORNERIA',
  'INTECO', 'JL ABREU', 'JOAO', 'KRANJAC', 'LESIN S.A', 'MCM MECANICA',
  'NECOLOGICA', 'PRFV DELTA', 'RAFA', 'CONS SR METAL SA (RIFFO)', 'STI INGENIERIA',
  'TECO TALLER', 'ULSTRUP', 'INA PANTOGRAFO', 'ATENEO', '4RG SERV. INDUSTRIALES',
  'ARENADO PUERTO', 'NAVAL TRONIC', 'SEN SRL', 'ELECTRICIDAD NAVAL SA',
  'EDUARDO FERNANDEZ TALLER', 'RAMON ARANDA TALLER'
]

export const DEFAULT_ORG_ROLES = {
  LIQUIDACION_SUELDOS: { title: 'Responsable de Liquidación de Sueldos y RRHH', holder: 'María José' },
  DIRECCION_OPERACIONES: { title: 'Dirección Operativa y Negociaciones', holder: 'Hugo Obregozo' },
  OFICINA_TECNICA: { title: 'Oficina Técnica & Subcontratos', holder: 'Omar' },
  SUPERVISION_OBRA: { title: 'Supervisión de Obra & Pañol', holder: 'Jorge' },
  TESORERIA: { title: 'Tesorería & Pagos', holder: 'Graciela' }
}

export const NOMINA_COLUMNS = [
  { key: 'name', label: 'Nombre y Apellido' },
  { key: 'category', label: 'Categoría' },
  { key: 'trade', label: 'Rubro' },
  { key: 'hourly_rate_ars', label: 'AR$/Hora' },
  { key: 'work_group', label: 'Grupo de Trabajo' },
  { key: 'admin_center', label: 'Centro Admin' },
  { key: 'safety_items', label: 'Elem. Seg.' }
]

export const WORKER_CLONE_FIELDS = [
  'category', 'trade', 'hourly_rate_ars', 'hourly_rate_usd', 'work_group',
  'admin_center', 'status', 'phone', 'consumables', 'consumables_discount_pct',
  'can_withdraw_materials', 'can_impute_hours', 'can_charge_third_party', 'is_foreman'
]

export const getRubroBadgeColor = (rubro = '') => {
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

export const getCategoryBadgeStyle = (category = '') => {
  const c = (category || '').toUpperCase().trim()
  if (c === 'AYUDANTE') return 'bg-[#00E5FF] text-slate-950 border-[#00B8D4] font-black'
  if (c === 'OFICIAL') return 'bg-[#00E676] text-slate-950 border-[#00C853] font-black'
  if (c === '1/2 OFICIAL') return 'bg-[#FF00D4] text-white border-[#D500F9] font-black'
  if (c === 'APRENDIZ') return 'bg-[#FFEA00] text-slate-950 border-[#FFD600] font-black'
  if (c.includes('BLACK') || c === 'OFICIAL BLACK') return 'bg-black text-white border-slate-700 font-black'
  return 'bg-slate-900 text-slate-300 border-slate-800 font-medium'
}

export function computeAvailableGroups(workers = [], adminCenter, knownList = [], suffixRegex = null) {
  const set = new Set()
  workers.forEach((w) => {
    if ((w.admin_center || '').toUpperCase() === adminCenter && w.work_group && w.work_group !== 'ASTILLERO') {
      const clean = suffixRegex ? w.work_group.replace(suffixRegex, '').trim() : w.work_group.trim()
      if (clean) set.add(clean)
    }
  })
  knownList.forEach((item) => set.add(item))
  return Array.from(set).sort()
}

export function computeUniqueTrades(workers = [], customTrades = []) {
  const set = new Set(BASE_NOMINA_TRADES)
  customTrades.forEach((t) => set.add(t))
  workers.forEach((w) => {
    if (w.trade) {
      String(w.trade).split(/[,;/|]+/).forEach((t) => {
        const clean = t.trim().toUpperCase()
        if (clean) set.add(clean)
      })
    }
  })
  return Array.from(set).sort()
}

export function computeNominaKpiStats(workers = []) {
  const activos = workers.filter((w) => w.status === 'ACTIVO')
  return {
    sinTelefonoAstillero: activos.filter((w) => w.admin_center === 'ASTILLERO' && (!w.phone || !w.phone.trim())).length,
    sinCostoAstillero: activos.filter((w) => w.admin_center === 'ASTILLERO' && (!w.hourly_rate_ars || Number(w.hourly_rate_ars) <= 0)).length,
    sinCostoContratistas: activos.filter((w) => w.admin_center === 'CONTRATISTA' && (!w.hourly_rate_ars || Number(w.hourly_rate_ars) <= 0)).length,
    sinConsumiblesContratistas: activos.filter((w) =>
      w.admin_center === 'CONTRATISTA' &&
      (w.consumables_discount_pct === null || w.consumables_discount_pct === undefined || w.consumables_discount_pct === '') &&
      (!w.consumables || !w.consumables.trim())
    ).length,
    sinPermisos: activos.filter((w) => !w.can_withdraw_materials && !w.can_impute_hours && !w.can_charge_third_party && !w.is_foreman).length,
    contratosPorVencer: activos.filter((w) =>
      w.admin_center === 'ASTILLERO' && computeContractExpiration(w.contract_type, w.contract_start_date).needsAttention
    ).length
  }
}

export function filterNominaWorkers(workers = [], {
  searchTerm = '',
  filterCenter = 'todos',
  filterStatus = 'todos',
  filterGroup = 'todos',
  filterForemanOnly = false,
  kpiFilter = null
} = {}) {
  return workers.filter((w) => {
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
      if (
        w.status !== 'ACTIVO' ||
        w.admin_center !== 'CONTRATISTA' ||
        (w.consumables_discount_pct !== null && w.consumables_discount_pct !== undefined && w.consumables_discount_pct !== '') ||
        (w.consumables && w.consumables.trim())
      ) return false
    } else if (kpiFilter === 'sin_permisos') {
      if (w.status !== 'ACTIVO' || w.can_withdraw_materials || w.can_impute_hours || w.can_charge_third_party || w.is_foreman) return false
    } else if (kpiFilter === 'contratos_por_vencer') {
      if (w.status !== 'ACTIVO' || w.admin_center !== 'ASTILLERO' || !computeContractExpiration(w.contract_type, w.contract_start_date).needsAttention) return false
    } else if (kpiFilter === 'categoria_OFICIAL') {
      if ((w.category || '').toUpperCase().trim() !== 'OFICIAL') return false
    } else if (kpiFilter === 'categoria_1/2 OFICIAL') {
      const cat = (w.category || '').toUpperCase().trim()
      if (cat !== '1/2 OFICIAL' && cat !== 'MEDIO OFICIAL') return false
    } else if (kpiFilter === 'categoria_AYUDANTE') {
      if ((w.category || '').toUpperCase().trim() !== 'AYUDANTE') return false
    }
    return true
  })
}

export function computeGroupedSummary(workers = []) {
  const map = new Map()
  workers.forEach((w) => {
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
  return Array.from(map.values()).map((e) => ({
    ...e,
    avgRateArs: e.totalWorkers > 0 ? (e.avgRateArs / e.totalWorkers).toFixed(2) : 0,
    avgRateUsd: e.totalWorkers > 0 ? (e.avgRateUsd / e.totalWorkers).toFixed(2) : 0
  }))
}

export function computeAdminCenterCounts(workers = []) {
  return {
    totalCount: workers.length,
    astilleroCount: workers.filter((w) => w.admin_center === 'ASTILLERO').length,
    contratistasCount: workers.filter((w) => w.admin_center === 'CONTRATISTA').length,
    talleresCount: workers.filter((w) => w.admin_center === 'TALLER').length,
    foremenCount: workers.filter((w) => w.is_foreman).length,
    activeCount: workers.filter((w) => w.status === 'ACTIVO').length,
    inactiveCount: workers.filter((w) => w.status === 'INACTIVO').length
  }
}
