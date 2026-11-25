/**
 * dateTimeCanonical.js
 * Motor Canónico Único de Fecha y Hora para todo AlonCar ERP (SKL-019 · FL-024).
 *
 * Regla de Estándar Institucional:
 * - Zona horaria única: Argentina (`America/Argentina/Buenos_Aires`, UTC-3 fijo).
 * - Formato visual obligatorio en pantallas: `DD/MM/AAAA` (y `DD/MM/AAAA HH:mm` cuando lleva hora).
 * - Persistencia y ordenamiento: siempre por fecha ISO real (`YYYY-MM-DD` o epoch), jamás orden alfabético `DD/MM/AAAA`.
 * - Prohibido `new Date().toISOString().split('T')[0]` fuera de este motor (desfasa +1 día después de las 21:00 ART).
 */

export const ARGENTINA_TIMEZONE = 'America/Argentina/Buenos_Aires'
export const ARGENTINA_LOCALE = 'es-AR'
export const ARGENTINA_UTC_OFFSET = '-03:00'

const PURE_ISO_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const AR_DMY_DATE_RE = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/
const TIME_HHMM_RE = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/

const SPANISH_MONTHS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

const AR_PARTS_FORMATTER = new Intl.DateTimeFormat('en-US', {
  timeZone: ARGENTINA_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23'
})

function pad2(val) {
  return String(val).padStart(2, '0')
}

/**
 * Parsea un timestamp (Date, epoch o string ISO / Postgres `YYYY-MM-DD HH:mm:ss+00`) de forma segura.
 * No usar sobre fechas calendario puras `YYYY-MM-DD` (esas se conservan sin conversión de huso).
 */
export function parseTimestampToDate(input) {
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input
  }
  if (typeof input === 'number') {
    const d = new Date(input)
    return Number.isNaN(d.getTime()) ? null : d
  }
  if (typeof input !== 'string') return null
  const raw = input.trim()
  if (!raw) return null

  // Normalizar formato Postgres ("2026-11-23 17:08:30.299+00" -> "2026-11-23T17:08:30.299+00:00")
  let normalized = raw.includes(' ') && !raw.includes('T')
    ? raw.replace(' ', 'T')
    : raw
  if (/[+-]\d{2}$/.test(normalized)) {
    normalized = `${normalized}:00`
  }

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/**
 * Extrae partes calendario y horarias en huso horario fijo de Argentina (UTC-3).
 */
export function getArDateParts(input = new Date()) {
  const d = parseTimestampToDate(input)
  if (!d) return null
  const parts = {}
  for (const p of AR_PARTS_FORMATTER.formatToParts(d)) {
    if (p.type !== 'literal') parts[p.type] = p.value
  }
  const hour = parts.hour === '24' ? '00' : pad2(parts.hour || '00')
  return {
    year: parts.year,
    month: pad2(parts.month),
    day: pad2(parts.day),
    hour,
    minute: pad2(parts.minute || '00'),
    second: pad2(parts.second || '00')
  }
}

/**
 * Convierte cualquier fecha o timestamp a clave calendario ISO `YYYY-MM-DD` en hora Argentina.
 * - Fechas puras `YYYY-MM-DD` se preservan exactas (sin desplazamiento UTC).
 * - Timestamps UTC (ej. `2026-11-24T01:30:00Z`) se convierten a su día real en Argentina (`2026-11-23`).
 */
export function toArIsoDate(input) {
  if (!input) return ''
  if (typeof input === 'string') {
    const trimmed = input.trim()
    if (!trimmed) return ''
    if (PURE_ISO_DATE_RE.test(trimmed)) return trimmed
    const dmy = trimmed.match(AR_DMY_DATE_RE)
    if (dmy) {
      const [, dd, mm, yyyy] = dmy
      return `${yyyy}-${pad2(mm)}-${pad2(dd)}`
    }
  }
  const parts = getArDateParts(input)
  if (!parts) return ''
  return `${parts.year}-${parts.month}-${parts.day}`
}

/**
 * Fecha de HOY en Argentina (`YYYY-MM-DD`), segura entre las 21:00 y 23:59 ART.
 */
export function getTodayArIso(now = new Date()) {
  return toArIsoDate(now)
}

/**
 * Formatea cualquier fecha o timestamp al estándar visual argentino `DD/MM/AAAA` (o `DD/MM/AA`).
 */
export function formatDateAr(input, { fallback = '—', shortYear = false } = {}) {
  const iso = toArIsoDate(input)
  if (!iso) return fallback
  const [y, m, d] = iso.split('-')
  return shortYear ? `${d}/${m}/${y.slice(-2)}` : `${d}/${m}/${y}`
}

/**
 * Formatea fecha compacta `DD/MM` (útil para subtítulos de carga o etiquetas breves).
 */
export function formatDayMonthAr(input, { fallback = '—' } = {}) {
  const iso = toArIsoDate(input)
  if (!iso) return fallback
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

/**
 * Formatea la hora local de Argentina (`HH:mm` o `HH:mm:ss`).
 * Devuelve `fallback` si el input es solo una fecha calendario `YYYY-MM-DD` sin hora.
 */
export function formatTimeAr(input, { includeSeconds = false, fallback = '' } = {}) {
  if (!input) return fallback
  if (typeof input === 'string' && PURE_ISO_DATE_RE.test(input.trim())) return fallback
  const parts = getArDateParts(input)
  if (!parts) return fallback
  return includeSeconds
    ? `${parts.hour}:${parts.minute}:${parts.second}`
    : `${parts.hour}:${parts.minute}`
}

/**
 * Formatea fecha y hora completas en zona horaria fija de Argentina (`DD/MM/AAAA HH:mm[:ss]`).
 */
export function formatDateTimeAr(
  input,
  { includeSeconds = false, shortYear = false, fallback = '—', separator = ' ' } = {}
) {
  if (!input) return fallback
  if (typeof input === 'string' && PURE_ISO_DATE_RE.test(input.trim())) {
    return formatDateAr(input, { fallback, shortYear })
  }
  const parts = getArDateParts(input)
  if (!parts) return fallback
  const yearOut = shortYear ? parts.year.slice(-2) : parts.year
  const timeOut = includeSeconds
    ? `${parts.hour}:${parts.minute}:${parts.second}`
    : `${parts.hour}:${parts.minute}`
  return `${parts.day}/${parts.month}/${yearOut}${separator}${timeOut}`
}

/**
 * Fecha larga en español anclada a Argentina: ej. "24 de Noviembre de 2026".
 */
export function formatLongSpanishDateAr(input = new Date()) {
  const iso = toArIsoDate(input || new Date()) || getTodayArIso()
  const [y, m, d] = iso.split('-').map(Number)
  return `${d} de ${SPANISH_MONTHS[(m || 1) - 1]} de ${y}`
}

/**
 * Construye un timestamp ISO UTC (`...Z`) interpretando fecha y hora en horario de Argentina (UTC-3).
 * - Si llega `timeStr` ("08:30"), guarda exactamente `YYYY-MM-DDT08:30:00-03:00` en UTC.
 * - Si no llega `timeStr` y la fecha es HOY (Argentina), usa el instante real `now`.
 * - Si es una fecha pasada/futura sin hora explícita, fija mediodía Argentina (`12:00-03:00`) para evitar desfasaje de día.
 */
export function buildArTimestampIso(dateStr, timeStr = null, now = new Date()) {
  const cleanDate = toArIsoDate(dateStr)
  if (!cleanDate) return now.toISOString()

  if (timeStr) {
    const match = String(timeStr).trim().match(TIME_HHMM_RE)
    if (match) {
      const hh = pad2(match[1])
      const mm = pad2(match[2])
      const ss = pad2(match[3] || '00')
      const parsed = new Date(`${cleanDate}T${hh}:${mm}:${ss}${ARGENTINA_UTC_OFFSET}`)
      if (!Number.isNaN(parsed.getTime())) return parsed.toISOString()
    }
  }

  if (cleanDate === getTodayArIso(now)) {
    return now.toISOString()
  }
  return new Date(`${cleanDate}T12:00:00${ARGENTINA_UTC_OFFSET}`).toISOString()
}

/**
 * Comparador cronológico descendente (más reciente primero) seguro para fechas ISO o timestamps.
 */
export function compareIsoDatesDesc(dateA, dateB) {
  const isoA = toArIsoDate(dateA)
  const isoB = toArIsoDate(dateB)
  return isoB.localeCompare(isoA)
}

/**
 * Comparador cronológico ascendente (más antiguo primero) seguro para fechas ISO o timestamps.
 */
export function compareIsoDatesAsc(dateA, dateB) {
  const isoA = toArIsoDate(dateA)
  const isoB = toArIsoDate(dateB)
  return isoA.localeCompare(isoB)
}
