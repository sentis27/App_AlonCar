/**
 * gridPerformanceHelpers.js
 * Motor Canónico Único de Velocidad y Ventanas Temporales para grillas de AlonCar ERP (SKL-019 · FL-025).
 *
 * Provee:
 * 1. Ventanas de historial por defecto (`90d` | `year` | `all`) ancladas a hora Argentina (FL-024).
 * 2. Mapas O(1) (`buildLookupMap`, `buildGroupedMap`) para eliminar búsquedas `O(N×M)` por fila.
 * 3. Preindexado de texto (`buildSearchCorpusMap`) y formateadores numéricos cacheados.
 * 4. Cálculo O(1) de límites de selección/tirador (`computeGridSelectionBounds`) para filas `React.memo`.
 */
import { getTodayArIso, ARGENTINA_UTC_OFFSET } from './dateTimeCanonical.js'

export const DEFAULT_PROGRESSIVE_INITIAL = 60
export const DEFAULT_PROGRESSIVE_BATCH = 60
export const DEFAULT_HISTORY_RANGE = '90d'

export const HISTORY_RANGE_OPTIONS = [
  { value: '90d', label: 'Últimos 90 días' },
  { value: 'year', label: 'Este año' },
  { value: 'all', label: 'Todo el historial' },
]

function pad2(val) {
  return String(val).padStart(2, '0')
}

function subtractCalendarDaysIso(isoDate, days) {
  const [y, m, d] = String(isoDate).split('-').map(Number)
  if (!y || !m || !d) return isoDate
  const shifted = new Date(Date.UTC(y, m - 1, d - days))
  return `${shifted.getUTCFullYear()}-${pad2(shifted.getUTCMonth() + 1)}-${pad2(shifted.getUTCDate())}`
}

/**
 * Calcula la fecha límite inferior (`YYYY-MM-DD` o ISO con offset Argentina `-03:00`)
 * para la ventana de historial elegida (`'90d'` | `'year'` | `'all'`).
 * Devuelve `null` cuando se solicita `'all'` (100% histórico).
 */
export function resolveHistoryRangeCutoff(
  rangeKey = DEFAULT_HISTORY_RANGE,
  { asTimestamp = false, now = new Date() } = {}
) {
  if (!rangeKey || rangeKey === 'all') return null
  const todayIso = getTodayArIso(now)
  let cutoffIso = null

  if (rangeKey === 'year') {
    const year = todayIso.slice(0, 4)
    cutoffIso = `${year}-01-01`
  } else {
    const daysMatch = String(rangeKey).match(/^(\d+)d$/i)
    const days = daysMatch ? Number(daysMatch[1]) : 90
    cutoffIso = subtractCalendarDaysIso(todayIso, Math.max(1, days))
  }

  if (!cutoffIso) return null
  return asTimestamp ? `${cutoffIso}T00:00:00${ARGENTINA_UTC_OFFSET}` : cutoffIso
}

/**
 * Construye el objeto `dateRange` listo para pasar a `findAllBatched({ dateRange })`.
 * Devuelve `null` si `rangeKey === 'all'` o no hay columna.
 */
export function buildDateRangeOption(
  column,
  rangeKey = DEFAULT_HISTORY_RANGE,
  { asTimestamp = false, now = new Date() } = {}
) {
  if (!column || !rangeKey || rangeKey === 'all') return null
  const from = resolveHistoryRangeCutoff(rangeKey, { asTimestamp, now })
  return from ? { column, from } : null
}

/**
 * Normaliza texto para búsqueda insensible a tildes y mayúsculas.
 */
export function normalizeSearchValue(raw = '') {
  return String(raw || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Construye un Map O(1) indexado por `String(item[keyField])`.
 */
export function buildLookupMap(items = [], keyField = 'id') {
  const map = new Map()
  if (!Array.isArray(items)) return map
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) continue
    const key = typeof keyField === 'function' ? keyField(item) : item[keyField]
    if (key !== undefined && key !== null && key !== '') {
      map.set(String(key), item)
    }
  }
  return map
}

/**
 * Agrupa elementos en un `Map<string, Array>` O(1) para evitar `.filter()` repetido dentro de `.map()`.
 */
export function buildGroupedMap(items = [], keyField = 'id') {
  const map = new Map()
  if (!Array.isArray(items)) return map
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) continue
    const rawKey = typeof keyField === 'function' ? keyField(item) : item[keyField]
    if (rawKey === undefined || rawKey === null || rawKey === '') continue
    const key = String(rawKey)
    let bucket = map.get(key)
    if (!bucket) {
      bucket = []
      map.set(key, bucket)
    }
    bucket.push(item)
  }
  return map
}

/**
 * Precalcula un Map de texto normalizado por fila para acelerar el filtrado al tipear.
 */
export function buildSearchCorpusMap(items = [], extractText, keyField = 'id') {
  const map = new Map()
  if (!Array.isArray(items) || typeof extractText !== 'function') return map
  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (!item) continue
    const key = typeof keyField === 'function' ? keyField(item) : item[keyField]
    if (key === undefined || key === null) continue
    map.set(String(key), normalizeSearchValue(extractText(item)))
  }
  return map
}

/**
 * Crea un formateador numérico con caché acotada (`maxEntries`) para evitar miles de
 * llamadas repetidas a `Intl.NumberFormat` / `toLocaleString` en cada render de tabla.
 */
export function createCachedNumberFormatter(locale = 'es-AR', options = {}, maxEntries = 8000) {
  const formatter = new Intl.NumberFormat(locale, options)
  const cache = new Map()
  return (value, fallback = '0') => {
    const num = Number(value)
    if (!Number.isFinite(num)) return fallback
    const key = num
    const hit = cache.get(key)
    if (hit !== undefined) return hit
    if (cache.size >= maxEntries) cache.clear()
    const formatted = formatter.format(num)
    cache.set(key, formatted)
    return formatted
  }
}

export const formatArsCached = createCachedNumberFormatter('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

export const formatArsIntCached = createCachedNumberFormatter('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

export const formatUsdCached = createCachedNumberFormatter('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const formatQtyCached = createCachedNumberFormatter('es-AR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/**
 * Precalcula en O(1) las cotas de selección rectangular, relleno (fill-handle) y posición del tirador
 * para pasar únicamente props primitivos a filas envueltas en `React.memo`.
 */
export function computeGridSelectionBounds({
  activeCell = null,
  selectionRange = null,
  fillRange = null,
  columns = [],
} = {}) {
  const selMinR = selectionRange ? Math.min(selectionRange.startRow, selectionRange.endRow) : -1
  const selMaxR = selectionRange ? Math.max(selectionRange.startRow, selectionRange.endRow) : -1
  const selMinC = selectionRange ? Math.min(selectionRange.startCol, selectionRange.endCol) : -1
  const selMaxC = selectionRange ? Math.max(selectionRange.startCol, selectionRange.endCol) : -1

  const fillFromR = fillRange ? fillRange.fromRow : -1
  const fillMaxR = fillRange ? Math.max(fillRange.fromRow, fillRange.toRow) : -1
  const fillCol = fillRange ? fillRange.colIndex : -1

  let handleRow = -1
  let handleCol = -1
  if (activeCell) {
    const candidateRow = selectionRange ? selMaxR : activeCell.rowIndex
    const candidateCol = selectionRange ? selMaxC : activeCell.colIndex
    if (!columns[candidateCol]?.readOnly) {
      handleRow = candidateRow
      handleCol = candidateCol
    }
  }

  return { selMinR, selMaxR, selMinC, selMaxC, fillFromR, fillMaxR, fillCol, handleRow, handleCol }
}
