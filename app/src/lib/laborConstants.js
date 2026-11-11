// ==============================================================================
// CONSTANTES Y HELPERS CANÓNICOS DEL MÓDULO DE HORAS / LABOR LOGS (ALONCAR ERP)
// ==============================================================================

// Muestra solo el nombre del barco, sin prefijos como "Astillero Alon Car" o "ASTILLERO"
export const cleanShipName = (name = '') =>
  String(name || '')
    .replace(/^\s*astillero\s+alon\s*car\s*[-–:]?\s*/i, '')
    .replace(/^\s*astillero\s*[-–:]?\s*/i, '')
    .trim() || String(name || '')

// Nómina oficial de Personal Propio del Astillero (Regla: 9 hs diarias obligatorias, salvo Feriado que son 8 hs)
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

// Talleres externos frecuentes (Grupos de Trabajo - RMO)
export const TALLERES_FRECUENTES = [
  'BRUNO HRNOS',
  'CORMETAL',
  'DIVISION CORTE',
  'GARCIA TORNERIA.',
  'GPA',
  'GRILLO TORNERIA',
  'GUILLERMO GARCIA',
  'INA PANTOGRAFO',
  'INTECO',
  'JL ABREU',
  'JOAO',
  'KRANJAC',
  'LEO ZOLOA',
  'LESIN S.A',
  'MCM MECANICA',
  'NECOLOGICA',
  'PRFV DELTA',
  'RAFA',
  'RAMON ARANDA TALLER',
  'RODRIGO TORRES',
  'STI INGENIERIA',
  'TECO TALLER',
  'ULSTRUP'
]

// Contratistas frecuentes (Grupos de Trabajo en Planta - PRC)
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
  'JHONNY',
  'JUAREZ JUAN',
  'LUAYZA',
  'LUAYZA MARCOS',
  'NAVAL TRONIC',
  'PINTOR JUAREZ',
  'RAMON ARANDA',
  'RAMON ARANDA AYUDANTE',
  'SEN SRL',
  'TANO',
  'TOBARES',
  'TOBARES AYUDANTE',
  'VALENCIA ARENADOR'
]

// Opciones de rubros comunes según matriz Alon Car
export const RUBROS_SUGERIDOS = [
  'Calderería',
  'Pintura',
  'Mecánica',
  'Soldadura',
  'Raschinear',
  'Electricidad',
  'Carpintería naval',
  'Maniobras y varada',
  'Fletes / Logística',
  'Feriado' // Regla Alon Car: si se indica Feriado, la jornada estándar es de 8 horas
]

// Datos semilla de respaldo si la conexión no responde
export const FALLBACK_SHIPS = [
  { id: 'ship-1', name: 'VIRGEN DE ITATI', client_name: 'Astillero Alon Car' },
  { id: 'ship-2', name: 'NONO PASCUAL', client_name: 'Astillero Alon Car' },
  { id: 'ship-3', name: 'SIEMPRE DON VICENTE', client_name: 'Astillero Alon Car' },
  { id: 'ship-4', name: 'MIS SUEÑOS', client_name: 'Astillero Alon Car' },
]

export const FALLBACK_WOS = [
  { id: 'wo-1', ship_id: 'ship-1', title: 'OT-101: Válvulas de Fondo', description: 'Recorrido, rectificación y prueba hidráulica de válvulas de casco y tomas de mar.' },
  { id: 'wo-2', ship_id: 'ship-1', title: 'OT-102: Calderería Obra Viva', description: 'Renovación de tramos de chapa 3/8" y fondos de pique proa según informe de espesores.' },
  { id: 'wo-3', ship_id: 'ship-2', title: 'OT-103: Pintura General', description: 'Lavado a alta presión, arenado comercial y esquema de pintura antiincrustante.' },
  { id: 'wo-4', ship_id: 'ship-2', title: 'OT-104: Línea de Eje y Timón', description: 'Desmontaje de hélice, alineación de eje portahélice y cambio de bujes.' },
]

// Helper para construir relaciones locales tras actualizar Buque y OT
export function buildLocalRelationsForLog(shipId, workOrderId, ships = [], workOrders = []) {
  const s = ships.find(x => x.id === shipId)
  const w = workOrders.find(x => x.id === workOrderId)
  return {
    ship_id: shipId,
    work_order_id: workOrderId,
    ships: s ? { name: s.name } : null,
    work_orders: w
      ? {
          title: w.title,
          ot_number: w.ot_number,
          ship_id: w.ship_id,
          ships: s ? { name: s.name } : null
        }
      : null
  }
}

// OTs habilitadas para un operario/contratista en un buque específico
export function getEnabledWosForWorkerInShip(shipId, workerName, workerType, workOrders = [], workItems = [], dbWorkers = []) {
  if (!shipId) return []
  const shipWos = workOrders.filter(w => w.ship_id === shipId)
  if (!workerName) return shipWos

  if (workerType === 'Astillero') {
    return shipWos
  }

  // Si es Contratista o Taller, buscar su grupo de trabajo
  const workerObj = dbWorkers.find(w => w.name === workerName)
  const group = workerObj?.work_group || workerName

  const enabledWoIds = new Set()
  workItems.forEach(item => {
    const list = item.contractors || []
    if (list.includes(group) || list.includes(workerName)) {
      enabledWoIds.add(item.work_order_id)
    }
  })

  const filtered = shipWos.filter(wo => enabledWoIds.has(wo.id))
  return filtered.length > 0 ? filtered : shipWos
}

// Estadísticas de horas y costos para la barra flotante (Zona 5)
export function calculateHoursStats(logs = [], selectedLogIds = new Set()) {
  const isCustom = selectedLogIds.size > 0
  const targetLogs = isCustom ? logs.filter(l => selectedLogIds.has(l.id)) : logs

  let sumNorm = 0
  let sum50 = 0
  let sum100 = 0
  let sumTotalHours = 0
  let sumCostArs = 0
  let sumCostUsd = 0

  targetLogs.forEach(l => {
    const n = parseFloat(l.hours_normal) || 0
    const h50 = parseFloat(l.hours_extra_50) || 0
    const h100 = parseFloat(l.hours_extra_100) || 0
    const tot = parseFloat(l.hours_worked) || (n + h50 + h100)

    sumNorm += n
    sum50 += h50
    sum100 += h100
    sumTotalHours += tot
    sumCostArs += parseFloat(l.cost_ars) || 0
    sumCostUsd += parseFloat(l.cost_usd) || 0
  })

  const count = targetLogs.length
  const avgHours = count > 0 ? sumTotalHours / count : 0

  return {
    isCustomSelection: isCustom,
    count,
    sumNorm,
    sum50,
    sum100,
    sumTotalHours,
    avgHours,
    sumCostArs,
    sumCostUsd
  }
}

// Cálculo de días para la sábana quincenal
export function buildQuincenaDays(year, month, quincena) {
  const y = parseInt(year, 10)
  const m = parseInt(month, 10)
  const isQ1 = String(quincena) === '1'
  const startDay = isQ1 ? 1 : 16
  const lastDayOfMonth = new Date(y, m, 0).getDate()
  const endDay = isQ1 ? 15 : lastDayOfMonth

  const days = []
  for (let d = startDay; d <= endDay; d++) {
    const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const dateObj = new Date(y, m - 1, d)
    const dayOfWeek = dateObj.toLocaleDateString('es-AR', { weekday: 'narrow' })
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6
    days.push({ dayNumber: d, dateStr, dayOfWeek, isWeekend })
  }
  return days
}
