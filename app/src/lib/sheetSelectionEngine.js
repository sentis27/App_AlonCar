/**
 * sheetSelectionEngine.js
 * Motor único y puro (Capa 1 · SKL-019 · FL-027) de selección tipo Excel / Google Sheets.
 *
 * Reemplaza los cálculos duplicados de `useGridSelection` y `readOnlySheetSelectionStats`:
 * - Rangos múltiples (arrastre, Shift+Flechas, Ctrl+Clic salteado) y columna completa.
 * - Parseo de números argentinos (`1.250,50`, `US$ 1.146,97`, `-US$ 101.531,77`), sin tocar fechas.
 * - Métricas Sheets: Suma, Promedio, Mín, Máx, Cantidad, Contar números, Únicos.
 * - TSV 2D para `Ctrl+C` hacia Excel/Sheets y ordenamiento cronológico/numérico/texto por columna.
 */

const DATE_RE = /^(?:\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{2,4})/
const NUMERIC_TEXT_RE = /^[-+(]?\s*(?:US\$|U\$S|AR\$|USD|ARS|\$)?\s*[-+]?\s*\d[\d.,]*\s*(?:kg|kgs|hs|%|un\.?)?\)?$/i
const TEXT_TYPES = new Set(['text', 'string', 'date', 'select', 'boolean'])

const round4 = (n) => Number(Number(n).toFixed(4))

export function defaultReadValue(row, colDef) {
  if (!row || !colDef) return undefined
  return typeof colDef.getValue === 'function' ? colDef.getValue(row) : row[colDef.key]
}

export function cellToText(val) {
  if (val === null || val === undefined) return ''
  if (typeof val === 'object') return String(val.label ?? val.name ?? '').trim()
  const text = String(val).trim()
  return text === '—' ? '' : text
}

export function parseSheetNumber(val) {
  if (val === null || val === undefined || val === '') return null
  if (typeof val === 'number') return Number.isFinite(val) ? val : null
  if (typeof val !== 'string') return null
  const raw = val.trim()
  if (!raw || DATE_RE.test(raw) || !NUMERIC_TEXT_RE.test(raw)) return null
  const m = raw.match(/\d[\d.,]*/)
  if (!m) return null
  let body = m[0].replace(/[.,]+$/, '')
  if (body.includes(',')) body = body.replace(/\./g, '').replace(',', '.')
  else if (/^\d{1,3}(\.\d{3})+$/.test(body)) body = body.replace(/\./g, '')
  const num = Number(body)
  if (!Number.isFinite(num)) return null
  const negative = raw.slice(0, m.index).includes('-') || raw.startsWith('(')
  return negative ? -num : num
}

function toSortableDateKey(text) {
  if (!text) return null
  const iso = text.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  const ar = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (ar) return `${ar[3]}-${ar[2].padStart(2, '0')}-${ar[1].padStart(2, '0')}`
  return null
}

function isTextColumn(colDef) {
  return colDef?.isNumeric === false || TEXT_TYPES.has(colDef?.type)
}

export function normalizeRange(range, rowCount, colCount) {
  if (!range || rowCount <= 0 || colCount <= 0) return null
  return {
    minR: Math.max(0, Math.min(range.startRow, range.endRow)),
    maxR: Math.min(rowCount - 1, Math.max(range.startRow, range.endRow)),
    minC: Math.max(0, Math.min(range.startCol, range.endCol)),
    maxC: Math.min(colCount - 1, Math.max(range.startCol, range.endCol)),
  }
}

export function buildColumnRange(colIndex, rowCount) {
  return { startRow: 0, endRow: Math.max(0, rowCount - 1), startCol: colIndex, endCol: colIndex, isColumn: true }
}

export function isCellInRanges(ranges, rowIndex, colIndex) {
  return (ranges || []).some((r) => (
    rowIndex >= Math.min(r.startRow, r.endRow) && rowIndex <= Math.max(r.startRow, r.endRow) &&
    colIndex >= Math.min(r.startCol, r.endCol) && colIndex <= Math.max(r.startCol, r.endCol)
  ))
}

export function computeSheetStats(rangesInput, rows = [], columns = [], readValue = defaultReadValue) {
  const list = Array.isArray(rangesInput) ? rangesInput : [rangesInput]
  const normalizedPairs = list
    .map((rawRange) => ({ rawRange, norm: normalizeRange(rawRange, rows.length, columns.length) }))
    .filter((p) => Boolean(p.norm))
  if (normalizedPairs.length === 0) return null

  const explicitColumn = normalizedPairs.length === 1 && normalizedPairs[0].rawRange?.isColumn === true
  const ranges = normalizedPairs.map((p) => p.norm)

  let totalCells = 0, count = 0, numericCount = 0, sum = 0, rowCount = 0, colCount = 0
  let min = Infinity, max = -Infinity
  const unique = new Set()
  const formats = new Set()

  for (const { minR, maxR, minC, maxC } of ranges) {
    totalCells += (maxR - minR + 1) * (maxC - minC + 1)
    rowCount = Math.max(rowCount, maxR - minR + 1)
    colCount = Math.max(colCount, maxC - minC + 1)
    for (let r = minR; r <= maxR; r += 1) {
      for (let c = minC; c <= maxC; c += 1) {
        const row = rows[r]
        const colDef = columns[c]
        if (!row || !colDef) continue
        const raw = readValue(row, colDef)
        const text = cellToText(raw)
        if (text === '') continue
        count += 1
        unique.add(text.toLowerCase())
        if (isTextColumn(colDef)) continue
        const num = typeof raw === 'object' ? null : parseSheetNumber(raw)
        if (num === null) continue
        numericCount += 1
        sum += num
        if (num < min) min = num
        if (num > max) max = num
        formats.add(colDef.formatType || 'number')
      }
    }
  }
  if (totalCells <= 1 && !explicitColumn) return null

  const single = ranges.length === 1 ? ranges[0] : null
  const isColumn = explicitColumn || Boolean(single && single.minC === single.maxC && single.minR === 0 && single.maxR === rows.length - 1 && rows.length > 1)
  const hasNum = numericCount > 0
  return {
    totalCells, rowCount, colCount, count, numericCount,
    unique: unique.size,
    sum: hasNum ? round4(sum) : null,
    avg: hasNum ? round4(sum / numericCount) : null,
    min: hasNum ? min : null,
    max: hasNum ? max : null,
    formatType: hasNum ? (formats.size === 1 ? Array.from(formats)[0] : 'mixed') : 'text',
    scope: isColumn ? 'column' : ranges.length > 1 ? 'multi' : 'range',
    columnLabel: isColumn ? (columns[single.minC]?.label || columns[single.minC]?.key || '') : '',
  }
}

function toClipboardCell(raw) {
  if (raw === null || raw === undefined) return ''
  if (typeof raw === 'number') return String(raw).replace('.', ',')
  if (typeof raw === 'object') return String(raw.label ?? raw.name ?? '')
  return String(raw).replace(/[\t\r\n]+/g, ' ')
}

export function buildSelectionTsv(rangesInput, rows = [], columns = [], readValue = defaultReadValue) {
  const list = Array.isArray(rangesInput) ? rangesInput : [rangesInput]
  const lines = []
  for (const range of list) {
    const n = normalizeRange(range, rows.length, columns.length)
    if (!n) continue
    for (let r = n.minR; r <= n.maxR; r += 1) {
      const cells = []
      for (let c = n.minC; c <= n.maxC; c += 1) cells.push(toClipboardCell(readValue(rows[r], columns[c])))
      lines.push(cells.join('\t'))
    }
  }
  return lines.join('\n')
}

export function sortRowsByColumn(rows = [], colDef = null, direction = 'asc', readValue = defaultReadValue) {
  if (!colDef || (direction !== 'asc' && direction !== 'desc')) return rows
  const dir = direction === 'desc' ? -1 : 1
  const keyed = rows.map((row, idx) => {
    const raw = readValue(row, colDef)
    const text = cellToText(raw)
    return {
      row, idx, text, empty: text === '',
      dateKey: toSortableDateKey(text),
      num: parseSheetNumber(typeof raw === 'object' ? null : raw),
    }
  })
  const nonEmpty = keyed.some((k) => !k.empty)
  const allDates = nonEmpty && keyed.every((k) => k.empty || k.dateKey !== null)
  const allNumeric = nonEmpty && !allDates && !isTextColumn(colDef) && keyed.every((k) => k.empty || k.num !== null)
  keyed.sort((a, b) => {
    if (a.empty !== b.empty) return a.empty ? 1 : -1
    if (a.empty && b.empty) return a.idx - b.idx
    const cmp = allDates
      ? a.dateKey.localeCompare(b.dateKey)
      : allNumeric
      ? a.num - b.num
      : a.text.localeCompare(b.text, 'es', { numeric: true, sensitivity: 'base' })
    return cmp !== 0 ? cmp * dir : a.idx - b.idx
  })
  return keyed.map((k) => k.row)
}

export function formatSheetMetric(val, formatType = 'number') {
  if (typeof val !== 'number' || !Number.isFinite(val)) return String(val ?? '')
  const fmt = (opts) => val.toLocaleString('es-AR', opts)
  if (formatType === 'usd') return `US$ ${fmt({ minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (formatType === 'ars') return `AR$ ${fmt({ minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (formatType === 'kg') return `${fmt({ maximumFractionDigits: 2 })} kg`
  if (formatType === 'hours') return `${fmt({ maximumFractionDigits: 2 })} hs`
  if (formatType === 'pct') return `${fmt({ maximumFractionDigits: 2 })} %`
  return fmt({ maximumFractionDigits: 3 })
}
