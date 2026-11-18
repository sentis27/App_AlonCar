import { logRowAction } from './auditService.js'
import { workersRepository } from '../repositories/workersRepository.js'
import { systemSettingsRepository } from '../repositories/systemSettingsRepository.js'

// ============================================================================
// CATÁLOGO OFICIAL UNIFICADO DE RUBROS Y OFICIOS (ALON CAR ERP)
// ============================================================================
export const OFFICIAL_RUBROS_CATALOG = [
  { code: 'CALDERERIA', label: 'Calderería' },
  { code: 'RASCHINAJE', label: 'Raschinear' },
  { code: 'SOLDADURA', label: 'Soldadura' },
  { code: 'PINTURA', label: 'Pintura' },
  { code: 'MECANICA', label: 'Mecánica' },
  { code: 'CARPINTERIA', label: 'Carpintería naval' },
  { code: 'ELECTRICIDAD', label: 'Electricidad' },
  { code: 'MANIOBRA', label: 'Maniobras y varada' },
  { code: 'PALA', label: 'Pala' },
  { code: 'GRUA GRANDE', label: 'Grúa Grande' },
  { code: 'GRUA CHICA', label: 'Grúa Chica' },
  { code: 'MAQUINARIA', label: 'Maquinaria' },
  { code: 'TORNERIA', label: 'Tornería' },
  { code: 'PRFV', label: 'PRFV / Plásticos' },
  { code: 'FIBRA VIDRIO', label: 'Fibra de Vidrio / PRFV' },
  { code: 'PANOLERO', label: 'Pañolero' },
  { code: 'MANDADOS', label: 'Mandados' },
  { code: 'SUPERVISION', label: 'Supervisión' },
  { code: 'FERIADO', label: 'Feriado' },
  { code: 'COBRERIA', label: 'Cobrería' },
  { code: 'CORTE/PLEGADO', label: 'Corte y Plegado' },
  { code: 'FLETE', label: 'Flete' },
  { code: 'FRIGORISTA', label: 'Frigorista' },
  { code: 'GASISTA', label: 'Gasista' },
  { code: 'HIDRAULICA', label: 'Hidráulica' },
  { code: 'MATERIALES', label: 'Materiales' },
  { code: 'MISCELANEOS', label: 'Misceláneos' },
  { code: 'SERENO', label: 'Sereno' },
  { code: 'SERVICIOS', label: 'Servicios' },
  { code: 'TECNICOS', label: 'Técnicos' }
]

// Lista canónica de códigos base en mayúsculas
export const CANONICAL_BASE_TRADES = OFFICIAL_RUBROS_CATALOG.map(r => r.code)

// Normalizar texto sin acentos y en mayúsculas
export function normalizeText(str = '') {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .trim()
}

// Convertir un código o texto de rubro a su etiqueta legible estándar
export function canonicalizeRubroLabel(raw = '') {
  const norm = normalizeText(raw)
  if (!norm) return 'General'
  if (norm.includes('CALDER')) return 'Calderería'
  if (norm.includes('RASCHIN')) return 'Raschinear'
  if (norm.includes('SOLDAD')) return 'Soldadura'
  if (norm.includes('PINT')) return 'Pintura'
  if (norm.includes('MECAN')) return 'Mecánica'
  if (norm.includes('CARPINT')) return 'Carpintería naval'
  if (norm.includes('ELECTR')) return 'Electricidad'
  if (norm.includes('MANIOBR') || norm.includes('VARAD')) return 'Maniobras y varada'
  if (norm.includes('PALA')) return 'Pala'
  if (norm.includes('GRUA') && (norm.includes('GRANDE') || norm.includes('GRD') || norm.includes('60'))) {
    return 'Grúa Grande'
  }
  if (norm.includes('GRUA') && (norm.includes('CHIC') || norm.includes('PEQ') || norm.includes('HIDRO') || norm.includes('8T'))) {
    return 'Grúa Chica'
  }
  if (norm.includes('MAQUIN') || norm.includes('GRUA')) return 'Maquinaria'
  if (norm.includes('TORN')) return 'Tornería'
  if (norm.includes('PRFV') || norm.includes('FIBRA')) return 'PRFV / Plásticos'
  if (norm.includes('PANOL')) return 'Pañolero'
  if (norm.includes('MANDAD')) return 'Mandados'
  if (norm.includes('FLETE')) return 'Flete'
  if (norm.includes('SUPERV') || norm.includes('TECNIC')) return 'Supervisión'
  if (norm.includes('FERIAD')) return 'Feriado'
  if (norm.includes('COBRE')) return 'Cobrería'
  if (norm.includes('CORTE') || norm.includes('PLEGAD')) return 'Corte y Plegado'
  if (norm.includes('FRIGOR')) return 'Frigorista'
  if (norm.includes('GASIST')) return 'Gasista'
  if (norm.includes('HIDRAUL')) return 'Hidráulica'
  if (norm.includes('SEREN')) return 'Sereno'
  return raw.trim()
}

// Desglosar el campo `trade` de un operario/contratista (soporta Multi-Rubro separado por comas)
export function parseWorkerTrades(tradeStr = '') {
  const parts = String(tradeStr || '')
    .split(/[,;/|]+/)
    .map(s => s.trim())
    .filter(Boolean)

  if (parts.length === 0) {
    return {
      rawList: ['GENERAL'],
      labelList: ['General'],
      primaryRaw: 'GENERAL',
      primaryLabel: 'General'
    }
  }

  const rawList = parts.map(p => p.toUpperCase())
  const labelList = Array.from(new Set(parts.map(p => canonicalizeRubroLabel(p))))

  return {
    rawList,
    labelList,
    primaryRaw: rawList[0],
    primaryLabel: labelList[0] || 'General'
  }
}

/**
 * Carga el catálogo consolidado de rubros y operarios desde Supabase.
 * Fuente única de verdad consumida tanto por el Panel de Administración como por Personal.
 */
export async function fetchTradesCatalog() {
  const { data: workersData, error: workersErr } = await workersRepository.listWorkers({
    select: 'id, name, trade, admin_center, status',
    orderBy: [],
  })

  if (workersErr) {
    console.error('Error cargando operarios en tradesCatalog:', workersErr)
    throw new Error(workersErr)
  }

  const workers = workersData || []

  let savedCustom = []
  try {
    const { data: settingsData, error: settingsErr } = await systemSettingsRepository.getByKey('master_trades', {
      select: 'value',
    })

    if (!settingsErr && Array.isArray(settingsData?.value)) {
      savedCustom = settingsData.value
    }
  } catch (err) {
    console.warn('Advertencia leyendo master_trades de system_settings:', err)
  }

  // 3. Consolidar conjunto único de rubros
  const tradesSet = new Set(CANONICAL_BASE_TRADES)
  savedCustom.forEach(t => {
    if (typeof t === 'string' && t.trim()) tradesSet.add(t.trim().toUpperCase())
  })

  workers.forEach(w => {
    if (w.trade) {
      String(w.trade).split(/[,;/|]+/).forEach(t => {
        const clean = t.trim().toUpperCase()
        if (clean) tradesSet.add(clean)
      })
    }
  })

  const masterTrades = Array.from(tradesSet).sort()

  // 4. Calcular métricas agregadas por rubro
  const statsMap = new Map()
  masterTrades.forEach(trade => {
    statsMap.set(trade, {
      trade,
      total: 0,
      astillero: 0,
      contratista: 0,
      taller: 0,
      activos: 0
    })
  })

  workers.forEach(w => {
    const wTrade = (w.trade || '').trim().toUpperCase()
    if (statsMap.has(wTrade)) {
      const item = statsMap.get(wTrade)
      item.total += 1
      if (w.status === 'ACTIVO') item.activos += 1
      if (w.admin_center === 'ASTILLERO') item.astillero += 1
      else if (w.admin_center === 'CONTRATISTA') item.contratista += 1
      else if (w.admin_center === 'TALLER') item.taller += 1
    }
  })

  const tradeStats = Array.from(statsMap.values())

  return {
    masterTrades,
    tradeStats,
    workers
  }
}

/**
 * Da de alta un nuevo rubro en el catálogo maestro
 */
export async function createMasterTrade(newTradeName, currentTrades) {
  const clean = String(newTradeName || '').trim().toUpperCase()
  if (!clean) throw new Error('El nombre del rubro no puede estar vacío.')
  if (currentTrades.includes(clean)) throw new Error(`El rubro "${clean}" ya existe en el catálogo.`)

  const updatedList = Array.from(new Set([...currentTrades, clean])).sort()

  const { error } = await systemSettingsRepository.saveByKey('master_trades', updatedList, {
    updatedBy: 'Administrador',
  })

  if (error) throw new Error(error)
  return updatedList
}

/**
 * Renombra un rubro y propaga masivamente el cambio a todos los operarios en Supabase
 */
export async function renameMasterTrade(oldName, newName, currentTrades, affectedCount) {
  const cleanNew = String(newName || '').trim().toUpperCase()
  if (!cleanNew) throw new Error('El nuevo nombre del rubro no puede estar vacío.')
  if (oldName === cleanNew) return currentTrades

  if (affectedCount > 0) {
    const { error: workersErr } = await workersRepository.updateWorkersByTrade(oldName, { trade: cleanNew })
    if (workersErr) throw new Error(workersErr)
  }

  const updatedList = currentTrades.map((t) => (t === oldName ? cleanNew : t)).sort()
  const { error: settingsErr } = await systemSettingsRepository.saveByKey('master_trades', updatedList, {
    updatedBy: 'Administrador',
  })
  if (settingsErr) throw new Error(settingsErr)

  await logRowAction({
    action: 'RENAME_TRADE',
    entityType: 'system_settings',
    entityId: cleanNew,
    entityName: `Rubro ${oldName} -> ${cleanNew}`,
    details: { oldName, newName: cleanNew, affectedWorkers: affectedCount },
    sheetName: 'Admin · Gestión de Rubros & Oficios',
    moduleRoute: '/admin',
  })

  return updatedList
}

/**
 * Elimina un rubro con reasignación obligatoria si tiene operarios asignados
 */
export async function deleteMasterTrade(tradeToDelete, reassignToTrade, currentTrades, affectedCount) {
  if (affectedCount > 0 && (!reassignToTrade || reassignToTrade === tradeToDelete)) {
    throw new Error('Debe especificar un rubro de destino para reasignar a los operarios asignados.')
  }

  if (affectedCount > 0) {
    const { error: reassignErr } = await workersRepository.updateWorkersByTrade(tradeToDelete, {
      trade: reassignToTrade,
    })
    if (reassignErr) throw new Error(reassignErr)
  }

  const updatedList = currentTrades.filter((t) => t !== tradeToDelete)
  const { error: settingsErr } = await systemSettingsRepository.saveByKey('master_trades', updatedList, {
    updatedBy: 'Administrador',
  })
  if (settingsErr) throw new Error(settingsErr)

  await logRowAction({
    action: 'DELETE_TRADE',
    entityType: 'system_settings',
    entityId: tradeToDelete,
    entityName: `Baja de rubro ${tradeToDelete}`,
    details: { tradeToDelete, reassignTo: reassignToTrade || null, affectedWorkers: affectedCount },
    sheetName: 'Admin · Gestión de Rubros & Oficios',
    moduleRoute: '/admin',
  })

  return updatedList
}
