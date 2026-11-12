import { supabase } from './supabase.js'
import { deduplicateWorkOrdersWithScope } from './workOrdersConstants.js'

/**
 * ==============================================================================
 * ALON CAR ERP - MOTOR CENTRAL DE ASIGNACIONES (ALLOCATION ENGINE)
 * ==============================================================================
 * Centraliza la regla de negocio canónica para:
 * 1. Padrón y permisos (Personal y Tarifas: can_withdraw_materials, can_impute_hours, can_charge_third_party)
 * 2. Personal Propio Astillero (dinámico desde Supabase `workers`)
 * 3. Habilitación por Buque (Asignación en ítems de trabajo)
 * 4. Estrechamiento de OTs por Contratista (Regla idéntica a Horas: ASTILLERO.* habilita a todo el personal propio)
 * 5. Cascada estricta de validación y estado reactivo (Alertas, Bypass Sin OT y Contador de Solicitud en BD)
 */

let _globalWorkersCache = null

/**
 * Inyecta o sincroniza el padrón dinámico de operarios en memoria
 */
export function setAllocationWorkersCache(workers = []) {
  if (Array.isArray(workers) && workers.length > 0) {
    _globalWorkersCache = workers
  }
}

export function getAllocationWorkersCache() {
  return _globalWorkersCache
}

/**
 * Consulta la nómina dinámica directamente desde Supabase `workers`
 */
export async function fetchDynamicWorkersRoster() {
  try {
    const { data, error } = await supabase
      .from('workers')
      .select('id, name, trade, admin_center, status, work_group, can_withdraw_materials, can_impute_hours, can_charge_third_party')
      .order('name', { ascending: true })

    if (!error && Array.isArray(data) && data.length > 0) {
      _globalWorkersCache = data
      return data
    }
    if (error) console.warn('Advertencia en fetchDynamicWorkersRoster:', error.message)
  } catch (err) {
    console.warn('Error leyendo workers dinámicos:', err)
  }
  return null
}

// Fallback estático de seguridad exclusivo para contingencias sin conectividad
export const NOMINA_ASTILLERO_BASE = [
  { name: 'Rodriguez, Enzo', defaultRubro: 'Raschinear' },
  { name: 'Colonga, Franco', defaultRubro: 'Raschinear' },
  { name: 'Gari, Mario Andres', defaultRubro: 'Calderería' },
  { name: 'Georgetti, Jorge', defaultRubro: 'Mandados' },
  { name: 'Hernández, Santiago', defaultRubro: 'Maquinaria' },
  { name: 'Lescano, Alexander', defaultRubro: 'Raschinear' },
  { name: 'López, Ricardo Héctor', defaultRubro: 'Raschinear' },
  { name: 'Lorenzi, Martin', defaultRubro: 'Supervisión' },
  { name: 'Merlos, Cristian', defaultRubro: 'Mecánica' },
  { name: 'Putallaz, Leonel', defaultRubro: 'Mecánica' },
  { name: 'Maciel, Rodrigo', defaultRubro: 'Raschinear' },
  { name: 'Palotta Jara, Valentin', defaultRubro: 'Mecánica' },
  { name: 'Peralta Pablo', defaultRubro: 'Carpintería' },
  { name: 'Navarro, Matias', defaultRubro: 'Carpintería' },
  { name: 'Rancatti, Gonzalo', defaultRubro: 'Carpintería' },
  { name: 'Rodriguez, Diego', defaultRubro: 'Calderería' },
  { name: 'Rodriguez, Mariano R O', defaultRubro: 'Pañolero' },
  { name: 'Sosa, José Mauricio', defaultRubro: 'Raschinear' },
  { name: 'Sostoa Gonzalez, Higinio', defaultRubro: 'Raschinear' },
  { name: 'Caballero, Daniel Emanuel', defaultRubro: 'Calderería' },
  { name: 'Toledo, Luciano', defaultRubro: 'Calderería' },
  { name: 'Alanis, Carlos', defaultRubro: 'Raschinear' },
  { name: 'Hernandez, Jorge', defaultRubro: 'Carpintería' },
  { name: 'Gonzalez, Luciano', defaultRubro: 'Supervisión' },
  { name: 'Rancatti, Franco', defaultRubro: 'Raschinear' },
  { name: 'Caballero, Cristian', defaultRubro: 'Calderería' },
  { name: 'Salvador Alan', defaultRubro: 'Carpintería' },
  { name: 'Salvador Oscar', defaultRubro: 'Carpintería' },
  { name: 'Incorvaia, Emanuel', defaultRubro: 'Raschinear' }
]

export const CONTRATISTAS_FRECUENTES = [
  '4RG SERV. INDUSTRIALES',
  'ALDO (CARPINTERO)',
  'ARENADO PUERTO',
  'ATENEO',
  'AVALOS',
  'AVALOS AYUDANTE',
  'BOLTRI',
  'CAMILO MARTINEZ',
  'CARLOS VIDONDO',
  'CHACANO',
  'DAMIAN',
  'DE ANGELIS',
  'EDUARDO FERNANDEZ',
  'ELECTRICIDAD NAVAL SA',
  'IMPERPUR',
  'JHONNY',
  'JUAREZ JUAN',
  'LUAYZA',
  'TANO',
  'TOBARES'
]

/**
 * Normaliza cadenas para comparaciones canónicas insensibles a mayúsculas y acentos
 */
export function normalizeText(str = '') {
  return String(str || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
}

/**
 * Filtra el padrón de trabajadores según su estado y permisos específicos de módulo
 */
export function filterEligiblePersonnel(workers = [], options = {}) {
  const { permissionField = 'can_withdraw_materials' } = options

  // Si no se pasaron workers explícitos, usar el caché dinámico sincronizado
  const effectiveWorkers = (Array.isArray(workers) && workers.length > 0)
    ? workers
    : (_globalWorkersCache || [])

  const activeWorkers = effectiveWorkers.filter((w) => w.status !== 'INACTIVO')

  const eligibleAstillero = []
  const unauthorizedWorkers = []

  activeWorkers.forEach((w) => {
    const isAst =
      w.admin_center === 'ASTILLERO' ||
      w.worker_type === 'Astillero' ||
      (w.work_group && normalizeText(w.work_group) === 'ASTILLERO')

    const hasPermission = !permissionField || Boolean(w[permissionField])

    if (isAst) {
      if (hasPermission) {
        eligibleAstillero.push({
          id: w.id,
          name: w.name,
          trade: w.trade || 'General',
          admin_center: 'ASTILLERO'
        })
      } else {
        unauthorizedWorkers.push(w)
      }
    }
  })

  // Fallback si no hay trabajadores cargados en la base de datos
  const finalAstillero =
    eligibleAstillero.length > 0
      ? eligibleAstillero
      : NOMINA_ASTILLERO_BASE.map((w) => ({
          id: w.name,
          name: w.name,
          trade: w.defaultRubro,
          admin_center: 'ASTILLERO'
        }))

  // Contratistas externos (Grupos de Trabajo)
  const contractorSet = new Set()
  activeWorkers.forEach((w) => {
    const isContractor = w.admin_center === 'CONTRATISTA' || w.admin_center === 'TALLER'
    const hasPermission = !permissionField || Boolean(w[permissionField])
    if (isContractor && w.work_group && hasPermission) {
      contractorSet.add(w.work_group.trim().toUpperCase())
    }
  })
  CONTRATISTAS_FRECUENTES.forEach((c) => contractorSet.add(c.trim().toUpperCase()))

  const finalContractors = Array.from(contractorSet).sort()

  return {
    astilleroWorkers: finalAstillero,
    contractorGroups: finalContractors,
    allEligibleNames: [...finalAstillero.map((w) => w.name), ...finalContractors],
    unauthorizedWorkers
  }
}

/**
 * Obtiene los contratistas y operarios de astillero habilitados en un buque específico
 */
export function getShipEnabledContractors(shipId, workOrders = [], workItems = [], eligiblePersonnel) {
  const baseAstillero = eligiblePersonnel?.astilleroWorkers || []
  const baseContractors = eligiblePersonnel?.contractorGroups || []

  if (!shipId) {
    return {
      astilleroWorkers: baseAstillero,
      contractorGroups: baseContractors
    }
  }

  const shipWos = workOrders.filter((w) => w.ship_id === shipId)
  const shipWoIds = new Set(shipWos.map((w) => w.id))
  const shipItems = workItems.filter((wi) => shipWoIds.has(wi.work_order_id) && wi.status !== 'Desestimado')

  if (shipItems.length === 0) {
    return {
      astilleroWorkers: baseAstillero,
      contractorGroups: baseContractors
    }
  }

  const rawContractors = shipItems.flatMap((wi) =>
    Array.isArray(wi.contractors)
      ? wi.contractors
      : wi.contractor_name
      ? [wi.contractor_name]
      : []
  )

  // Regla canónica de Horas: Si existe cualquier ítem con ASTILLERO o ASTILLERO.*, se habilita a TODO el personal propio elegible
  const hasAstillero = rawContractors.some((c) => {
    const norm = normalizeText(c)
    return norm === 'ASTILLERO' || norm.startsWith('ASTILLERO.') || norm === 'ALON CAR'
  })

  let enabledAstillero = hasAstillero || rawContractors.length === 0 ? baseAstillero : []

  // Contratistas externos presentes en los ítems
  const enabledContractorSet = new Set(
    rawContractors
      .filter((c) => {
        const norm = normalizeText(c)
        return norm && !norm.startsWith('ASTILLERO') && norm !== 'ALON CAR'
      })
      .map((c) => c.trim().toUpperCase())
  )

  let enabledContractors = baseContractors.filter((grp) => enabledContractorSet.has(grp.toUpperCase()))

  // Fallback Canónico de Seguridad: Si el filtrado deja ambos conjuntos vacíos, nunca bloquear la pantalla; devolver la base completa
  if (enabledAstillero.length === 0 && enabledContractors.length === 0) {
    enabledAstillero = baseAstillero
    enabledContractors = baseContractors
  }

  return {
    astilleroWorkers: enabledAstillero,
    contractorGroups: enabledContractors
  }
}

/**
 * Obtiene las OTs habilitadas en un buque para un operario o contratista seleccionado
 */
export function getContractorEnabledWos(shipId, workerOrContractorName, workOrders = [], workItems = [], eligiblePersonnel, options = {}) {
  if (!shipId) return []
  const { includeFinalized = false } = options
  const shipWos = workOrders.filter((w) => w.ship_id === shipId)
  const deduplicated = deduplicateWorkOrdersWithScope(shipWos, workItems)

  // Regla de Negocio Naval: Una OT finalizada no está disponible para carga/imputación de datos
  const imputationPool = includeFinalized
    ? deduplicated
    : deduplicated.filter((wo) => wo.isActiveForImputation !== false)

  if (!workerOrContractorName) return imputationPool

  const normTarget = normalizeText(workerOrContractorName)
  const isAstilleroWorker = eligiblePersonnel?.astilleroWorkers?.some(
    (w) => normalizeText(w.name) === normTarget
  )

  return imputationPool.filter((wo) => {
    const items = (wo._allWorkItems || []).filter((wi) => wi.status !== 'Desestimado')
    if (items.length === 0) return true

    const rawContractors = items.flatMap((wi) =>
      Array.isArray(wi.contractors)
        ? wi.contractors
        : wi.contractor_name
        ? [wi.contractor_name]
        : []
    )

    if (isAstilleroWorker) {
      // Regla de Horas: si la OT tiene ASTILLERO o ASTILLERO.*, habilita a todo el personal de astillero
      return rawContractors.length === 0 || rawContractors.some((c) => {
        const norm = normalizeText(c)
        return norm === 'ASTILLERO' || norm.startsWith('ASTILLERO.') || norm === 'ALON CAR'
      })
    }

    return rawContractors.some((c) => normalizeText(c) === normTarget)
  })
}

/**
 * Evalúa el estado de asignación y determina advertencias, bloqueos y estados de solicitud (1)
 */
export function evaluateAllocationState({
  shipId,
  workOrderId,
  contractorName,
  isSinOt = false,
  availableWos = [],
  pendingAlerts = []
}) {
  if (!contractorName) {
    return {
      isValid: false,
      legend: null,
      needsOtRequest: false,
      otRequestCount: 0,
      isOtRequestPending: false
    }
  }

  // Si tiene barco y contratista pero 0 OTs disponibles (y no está en modo bypass explícito)
  if (shipId && contractorName && availableWos.length === 0 && !isSinOt) {
    const normContractor = normalizeText(contractorName)
    // Verificar si ya existe solicitud pendiente en la base de datos para este barco y contratista
    const activeReq = pendingAlerts.find(
      (a) =>
        a.ship_id === shipId &&
        a.status === 'PENDIENTE' &&
        a.entity_type === 'work_orders' &&
        normalizeText(a.alert_message || a.notes || '').includes(normContractor)
    )

    const otRequestCount = activeReq ? 1 : 0

    return {
      isValid: false,
      legend: 'No hay OT habilitada para este contratista',
      needsOtRequest: true,
      otRequestCount,
      isOtRequestPending: otRequestCount > 0
    }
  }

  // Bypass Sin OT: permite selección y activa aviso al admin
  if (isSinOt || !workOrderId) {
    return {
      isValid: true,
      legend: '(⚠️ Sin OT - Aviso a Administrador)',
      needsOtRequest: false,
      otRequestCount: 0,
      isOtRequestPending: false
    }
  }

  return {
    isValid: true,
    legend: null,
    needsOtRequest: false,
    otRequestCount: 0,
    isOtRequestPending: false
  }
}

/**
 * Obtiene operarios de astillero y contratistas habilitados según shipId y workOrderId.
 * Si workOrderId está vacío (!workOrderId), devuelve la nómina completa según la regla canónica de Pañol y Terceros.
 */
export function getEnabledWorkersAndContractors(shipId, workOrderId, workItems = [], eligiblePersonnel = null) {
  let effectiveEligible = eligiblePersonnel
  if (!effectiveEligible && _globalWorkersCache && _globalWorkersCache.length > 0) {
    effectiveEligible = filterEligiblePersonnel(_globalWorkersCache, { permissionField: null })
  }

  const baseAstillero = effectiveEligible?.astilleroWorkers?.length > 0
    ? effectiveEligible.astilleroWorkers
    : NOMINA_ASTILLERO_BASE.map(w => ({ id: w.name, name: w.name, trade: w.defaultRubro, admin_center: 'ASTILLERO' }))

  const baseContractors = effectiveEligible?.contractorGroups?.length > 0
    ? effectiveEligible.contractorGroups
    : CONTRATISTAS_FRECUENTES

  if (!workOrderId) {
    return {
      astilleroWorkers: baseAstillero,
      contractorGroups: baseContractors
    }
  }

  const items = (workItems || []).filter((wi) => wi.work_order_id === workOrderId && wi.status !== 'Desestimado')
  if (items.length === 0) {
    return { astilleroWorkers: baseAstillero, contractorGroups: baseContractors }
  }

  const rawContractors = items.flatMap((wi) =>
    Array.isArray(wi.contractors)
      ? wi.contractors
      : wi.contractor_name
      ? [wi.contractor_name]
      : []
  )

  const hasAstillero = rawContractors.some((c) => {
    const norm = normalizeText(c)
    return norm === 'ASTILLERO' || norm.startsWith('ASTILLERO.') || norm === 'ALON CAR'
  })

  const enabledAst = hasAstillero || rawContractors.length === 0 ? baseAstillero : []

  const enabledContractorSet = new Set(
    rawContractors
      .filter((c) => {
        const norm = normalizeText(c)
        return norm && !norm.startsWith('ASTILLERO') && norm !== 'ALON CAR'
      })
      .map((c) => c.trim().toUpperCase())
  )

  const enabledCnt = baseContractors.filter((grp) => enabledContractorSet.has(grp.toUpperCase()))

  if (enabledAst.length === 0 && enabledCnt.length === 0) {
    return { astilleroWorkers: baseAstillero, contractorGroups: baseContractors }
  }

  return {
    astilleroWorkers: enabledAst,
    contractorGroups: enabledCnt
  }
}
