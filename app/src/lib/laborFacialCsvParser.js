// ==============================================================================
// PARSER FLEXIBLE DE ARCHIVOS .CSV/.TXT PARA LECTOR FACIAL (FORMATO PENDIENTE)
// Sin dependencias de React ni Supabase: 100% testeable en Node.
// ==============================================================================

import { normalizeText, parseWorkerTrades } from './tradesCatalog.js'
import { TALLERES_FRECUENTES } from './laborConstants.js'

const HEADER_ALIASES = {
  name: ['nombre', 'operario', 'empleado', 'persona', 'worker', 'name', 'apellido'],
  group: ['grupo', 'cuadrilla', 'sector', 'work_group', 'contratista', 'group'],
  clockIn: ['entrada', 'ingreso', 'fichaje_entrada', 'in', 'check_in'],
  clockOut: ['salida', 'egreso', 'fichaje_salida', 'out', 'check_out'],
  hours: ['horas', 'total_horas', 'total', 'duracion', 'hours'],
  date: ['fecha', 'date', 'dia']
}

function detectDelimiter(firstLine = '') {
  if (firstLine.includes(';')) return ';'
  if (firstLine.includes('\t')) return '\t'
  const commaCount = firstLine.split(',').length - 1
  if (commaCount === 0) return null
  if (commaCount >= 2 || firstLine.includes('"')) return ','
  const commaHeaders = mapHeaderColumns(splitCsvLine(firstLine, ','))
  return Object.keys(commaHeaders).length >= 1 ? ',' : null
}

function splitCsvLine(line, delimiter) {
  if (!delimiter) return [line.replace(/^"|"$/g, '').trim()]
  const cells = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === delimiter && !inQuotes) { cells.push(cur.trim()); cur = '' }
    else cur += ch
  }
  cells.push(cur.trim())
  return cells.map(c => c.replace(/^"|"$/g, '').trim())
}

function mapHeaderColumns(headerCells = []) {
  const idxMap = {}
  headerCells.forEach((cell, idx) => {
    const norm = normalizeText(cell).toLowerCase().replace(/\s+/g, '_')
    for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
      if (idxMap[key] === undefined && aliases.some(a => norm === a || norm.includes(a))) {
        idxMap[key] = idx
      }
    }
  })
  return idxMap
}

function parseClockTimeMinutes(str = '') {
  const m = String(str || '').match(/(\d{1,2}):(\d{2})/)
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null
}

function computeActualClockHours(rawHours, clockIn, clockOut) {
  const parsed = parseFloat(String(rawHours || '').replace(',', '.'))
  if (!Number.isNaN(parsed) && parsed > 0) return Math.round(parsed * 100) / 100
  const inMin = parseClockTimeMinutes(clockIn)
  const outMin = parseClockTimeMinutes(clockOut)
  if (inMin !== null && outMin !== null && outMin > inMin) {
    return Math.round(((outMin - inMin) / 60) * 100) / 100
  }
  return null
}

function resolveWorkerMetadata(rawName, rawGroup, dbWorkers = []) {
  const normRaw = normalizeText(rawName)
  const matched = dbWorkers.find(w => normalizeText(w.name) === normRaw)
    || (normRaw.length >= 3
      ? dbWorkers.find(w => normalizeText(w.name).includes(normRaw) || normRaw.includes(normalizeText(w.name)))
      : null)

  const canonicalName = matched?.name || rawName.trim()
  const adminCenter = (matched?.admin_center || '').toUpperCase()
  const workGroup = (rawGroup || matched?.work_group || '').trim()
  const upperGroup = workGroup.toUpperCase()

  let workerType = 'Astillero'
  if (adminCenter === 'TALLER' || TALLERES_FRECUENTES.includes(upperGroup)) {
    workerType = 'Taller'
  } else if (adminCenter === 'CONTRATISTA' || (upperGroup && !upperGroup.startsWith('ASTILLERO'))) {
    workerType = 'Contratista'
  }

  const tradesInfo = parseWorkerTrades(matched?.trade || (workerType === 'Astillero' ? 'General' : 'Servicio Contratista'))
  const resolvedGroup = rawGroup?.trim()
    ? rawGroup.trim().toUpperCase()
    : workerType === 'Astillero'
    ? `ASTILLERO · ${tradesInfo.primaryLabel.toUpperCase()}`
    : (workGroup || canonicalName).toUpperCase()

  return {
    worker_name: canonicalName,
    worker_type: workerType,
    group_name: resolvedGroup,
    default_rubro: tradesInfo.primaryLabel,
    estimated_hours: workerType === 'Astillero' ? 9 : 8,
    matched_in_db: Boolean(matched)
  }
}

/**
 * Parsea un .csv/.txt del lector facial con detección automática de delimitador y encabezados.
 */
export function parseFacialClockCsv(rawText = '', dbWorkers = []) {
  const cleanText = String(rawText || '').replace(/^\uFEFF/, '').trim()
  if (!cleanText) return { rows: [], detectedColumns: [] }

  const lines = cleanText.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return { rows: [], detectedColumns: [] }

  const delimiter = detectDelimiter(lines[0])
  const firstCells = splitCsvLine(lines[0], delimiter)
  const headerMap = mapHeaderColumns(firstCells)
  const hasHeader = headerMap.name !== undefined || Object.keys(headerMap).length >= 2

  const dataLines = hasHeader ? lines.slice(1) : lines
  const colIdx = hasHeader ? headerMap : { name: 0, group: 1, clockIn: 2, clockOut: 3, hours: 4 }

  const seenNames = new Set()
  const rows = []

  for (const line of dataLines) {
    const cells = splitCsvLine(line, delimiter)
    const rawName = (cells[colIdx.name ?? 0] || '').trim()
    if (!rawName) continue

    const rawGroup = colIdx.group !== undefined ? (cells[colIdx.group] || '') : ''
    const clockIn = colIdx.clockIn !== undefined ? (cells[colIdx.clockIn] || '') : ''
    const clockOut = colIdx.clockOut !== undefined ? (cells[colIdx.clockOut] || '') : ''
    const rawHours = colIdx.hours !== undefined ? (cells[colIdx.hours] || '') : ''

    const meta = resolveWorkerMetadata(rawName, rawGroup, dbWorkers)
    const dedupKey = normalizeText(meta.worker_name)
    if (seenNames.has(dedupKey)) continue
    seenNames.add(dedupKey)

    rows.push({
      ...meta,
      clock_in: clockIn || null,
      clock_out: clockOut || null,
      actual_hours: computeActualClockHours(rawHours, clockIn, clockOut)
    })
  }

  return { rows, detectedColumns: hasHeader ? firstCells : ['nombre (posicional)'] }
}

/**
 * Genera un CSV de prueba usando personal real de Supabase mientras se define el formato del reloj.
 */
export function buildSampleClockCsvFromWorkers(dbWorkers = [], mode = 'ingreso') {
  const active = dbWorkers.filter(w => w.status !== 'INACTIVO' && w.can_impute_hours !== false)
  const sample = [
    ...active.filter(w => w.admin_center === 'ASTILLERO').slice(0, 8),
    ...active.filter(w => w.admin_center === 'CONTRATISTA').slice(0, 4)
  ]
  if (sample.length === 0) return ''

  const header = mode === 'cierre' ? 'nombre;grupo;entrada;salida;horas' : 'nombre;grupo;entrada'
  const lines = sample.map((w, idx) => {
    const grp = w.admin_center === 'ASTILLERO' ? '' : (w.work_group || w.name)
    if (mode === 'cierre') {
      const hours = idx === 1 ? '7.5' : idx === 3 ? '10.5' : w.admin_center === 'ASTILLERO' ? '9' : '8'
      const outTime = idx === 1 ? '15:30' : idx === 3 ? '18:30' : w.admin_center === 'ASTILLERO' ? '17:00' : '16:00'
      return `${w.name};${grp};08:00;${outTime};${hours}`
    }
    return `${w.name};${grp};08:00`
  })
  return [header, ...lines].join('\n')
}
