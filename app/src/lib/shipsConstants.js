// ==============================================================================
// CONSTANTES Y HELPERS CANÓNICOS DEL MÓDULO DE BARCOS Y BUQUES (ALONCAR ERP)
// ==============================================================================

// Componentes predeterminados de la Ficha Técnica Dinámica Naval
export const DEFAULT_TECH_COMPONENTS = [
  { key: 'tanques_combustible', label: 'Tanques de Combustible', defaultUnit: 'tanques', hint: 'Ej: 2 en bodega 10m³, 1 popa boyante 15m³, 1 diario 2m³' },
  { key: 'tanques_agua', label: 'Tanques de Agua Potable', defaultUnit: 'tanques', hint: 'Ej: Proa 5m³ c/u, babor' },
  { key: 'valvulas_casco_1_a_2_5', label: 'Válvulas de Casco (1" a 2½")', defaultUnit: 'válvulas', hint: 'Ej: 6 estribor, 6 babor. Mecanizado de asientos' },
  { key: 'valvulas_casco_3_a_6', label: 'Válvulas de Casco (3" a 6")', defaultUnit: 'válvulas', hint: 'Ej: Tomas de mar principales de sala de máquinas' },
  { key: 'valvulas_intermediarias', label: 'Válvulas Intermediarias', defaultUnit: 'válvulas', hint: 'Ej: Intermediarias de achique e incendio' },
  { key: 'pocetes_achique', label: 'Pocetes de Achique', defaultUnit: 'pocetes', hint: 'Ej: Ubicados en sala de máquinas y doble fondo' }
]

// Lista oficial de tipos de embarcación (eliminado Arenero, añadido Desguace)
export const PREDEFINED_VESSEL_TYPES = [
  'Pesquero',
  'Desguace',
  'Remolcador',
  'Pontón',
  'Barcaza',
  'Buque Motor General',
  'Draga',
  'Lancha / Prácticos',
  'Yate / Recreo'
]

// Lista oficial de locaciones limpia (sin redundancias de "ALON CAR" ni "ASTILLERO")
export const STANDARD_LOCATIONS = [
  'VARADERO',
  'MUELLE',
  'PUERTO 1RA ALDANA',
  'PUERTO 2DA ALDANA',
  'PUERTO 3RA ALDANA',
  'PUERTO 4TA ALDANA',
  'PUERTO 5TA ALDANA',
  'PUERTO 6TA ALDANA',
  'PUERTO 7MA ALDANA'
]

// Función para limpiar nombres de barco
export const cleanShipName = (name = '') =>
  String(name || '')
    .replace(/^\s*astillero\s+alon\s*car\s*[-–:]?\s*/i, '')
    .replace(/^\s*astillero\s*[-–:]?\s*/i, '')
    .trim() || String(name || '')

// Función para limpiar nombres de locación (eliminar ALON CAR, ASTILLERO, etc. y retornar en Mayúsculas)
export const cleanLocation = (loc = '') => {
  const raw = String(loc || '').trim()
  if (!raw) return 'VARADERO'
  const cleaned = raw
    .replace(/\s*alon\s*car\s*/gi, '')
    .replace(/\s*astillero\s*/gi, '')
    .trim()
    .toUpperCase()
  return cleaned || 'VARADERO'
}

// Cálculo de días corridos: =SI(C="";"";Fin-Comienzo+1), si no tiene fin acumula con HOY()
export const calculateStayDays = (startDateStr, endDateStr) => {
  if (!startDateStr) return 0
  const start = new Date(startDateStr + 'T00:00:00')
  const end = endDateStr ? new Date(endDateStr + 'T00:00:00') : new Date()
  const diffTime = end.getTime() - start.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
  return Math.max(1, diffDays + 1)
}

// Cálculo preciso de OTs y huérfanos por barco
export function computeShipOtMetrics(ships = [], workOrders = [], workItems = [], orphanLabor = [], orphanTerceros = [], orphanCompras = []) {
  const itemsByWo = {}
  workItems.forEach(it => {
    if (!itemsByWo[it.work_order_id]) itemsByWo[it.work_order_id] = []
    itemsByWo[it.work_order_id].push(it)
  })

  const map = {}
  ships.forEach(ship => {
    const shipWos = workOrders.filter(w => w.ship_id === ship.id)
    const activeWos = shipWos.filter(wo => {
      const items = itemsByWo[wo.id] || []
      const hasExecutionItem = items.some(i => i.status === 'En ejecución' || i.status === 'Pendiente de inicio')
      const isNotClosed = !['Cancelada', 'Completada', 'Facturada', 'Desestimada'].includes(wo.status)
      const isWoActiveStatus = ['En Progreso', 'En ejecución', 'open', 'Pendiente', 'Abierta'].includes(wo.status)
      return isNotClosed && (hasExecutionItem || isWoActiveStatus)
    })

    const oLab = orphanLabor.filter(l => l.ship_id === ship.id).length
    const oTerc = orphanTerceros.filter(t => t.ship_id === ship.id).length
    const oComp = orphanCompras.filter(c => c.ship_id === ship.id).length
    const orphanTotal = oLab + oTerc + oComp

    map[ship.id] = {
      total: shipWos.length,
      active: activeWos.length,
      orphanTotal,
      orphanLabor: oLab,
      orphanTerceros: oTerc,
      orphanCompras: oComp,
      shipWos,
      activeWos
    }
  })
  return map
}

// Campos a duplicar por entidad (Menú Contextual Canónico)
export const SHIP_CLONE_FIELDS = ['vessel_type', 'current_location', 'eslora_mts', 'manga_mts', 'puntal_mts', 'superficie_casco_m2', 'owner_id', 'notes', 'technical_specs']
export const STAY_CLONE_FIELDS = ['ship_id', 'location', 'start_date', 'end_date', 'notes']
export const OWNER_CLONE_FIELDS = ['armador_name', 'armador_phone', 'email_principal', 'email_secundario', 'notes']

// Cálculo de ocupación de metros lineales de muelle / varadero
export function calculateBerthMeters(ships = [], stays = []) {
  let muelleMeters = 0
  let varaderoMeters = 0
  let muelleCount = 0
  let varaderoCount = 0
  const dockedShips = []

  ships.forEach(s => {
    if (s.is_active === false) return
    const loc = cleanLocation(s.current_location)
    const eslora = parseFloat(s.eslora_mts) || 0
    if (loc === 'MUELLE') {
      muelleMeters += eslora
      muelleCount++
      dockedShips.push(s)
    } else if (loc === 'VARADERO') {
      varaderoMeters += eslora
      varaderoCount++
    }
  })

  const capacityMeters = 180 // Capacidad nominal del muelle de amarre
  const percentage = Math.min(100, (muelleMeters / capacityMeters) * 100)

  return {
    muelleMeters: parseFloat(muelleMeters.toFixed(1)),
    varaderoMeters: parseFloat(varaderoMeters.toFixed(1)),
    muelleCount,
    varaderoCount,
    occupiedMeters: parseFloat(muelleMeters.toFixed(1)),
    capacityMeters,
    percentage,
    shipsDockedCount: muelleCount,
    dockedShips
  }
}
