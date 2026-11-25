/**
 * Motor puro de estadísticas y exportación TSV para selección de rango
 * estilo Excel / Google Sheets en hojas analíticas de solo lectura (Zona 5).
 *
 * Reglas estrictas:
 * - Solo columnas con `isNumeric: true` participan de Suma / Promedio / Mín / Máx.
 * - Columnas de texto (OT, Fecha, Material, Solicitante, Notas, etc.) nunca se parsean
 *   como números y proyectan RECUENTO real de datos cargados (celdas no vacías).
 */
export function computeReadOnlySelectionStats(selectionRange, rows = [], columns = []) {
  if (!selectionRange || !Array.isArray(rows) || rows.length === 0 || !Array.isArray(columns) || columns.length === 0) {
    return null
  }

  const minR = Math.max(0, Math.min(selectionRange.startRow, selectionRange.endRow))
  const maxR = Math.min(rows.length - 1, Math.max(selectionRange.startRow, selectionRange.endRow))
  const minC = Math.max(0, Math.min(selectionRange.startCol, selectionRange.endCol))
  const maxC = Math.min(columns.length - 1, Math.max(selectionRange.startCol, selectionRange.endCol))

  const rowCount = maxR - minR + 1
  const colCount = maxC - minC + 1
  const totalCells = rowCount * colCount
  if (totalCells <= 1) return null

  let count = 0
  let numericCount = 0
  let sum = 0
  let min = Infinity
  let max = -Infinity
  const numericFormats = new Set()

  for (let r = minR; r <= maxR; r += 1) {
    const row = rows[r]
    if (!row) continue
    for (let c = minC; c <= maxC; c += 1) {
      const colDef = columns[c]
      if (!colDef) continue
      const val = typeof colDef.getValue === 'function' ? colDef.getValue(row) : row[colDef.key]

      if (colDef.isNumeric) {
        if (val === null || val === undefined || val === '') continue
        const num = typeof val === 'number' ? val : Number(val)
        if (!Number.isFinite(num)) continue
        count += 1
        numericCount += 1
        sum += num
        if (num < min) min = num
        if (num > max) max = num
        numericFormats.add(colDef.formatType || 'number')
      } else {
        if (val === null || val === undefined) continue
        const text = String(val).trim()
        if (text !== '' && text !== '—') {
          count += 1
        }
      }
    }
  }

  let formatType = 'text'
  if (numericCount > 0) {
    formatType = numericFormats.size === 1 ? Array.from(numericFormats)[0] : 'mixed'
  }

  return {
    totalCells,
    rowCount,
    colCount,
    count,
    numericCount,
    sum: numericCount > 0 ? Number(sum.toFixed(4)) : null,
    avg: numericCount > 0 ? Number((sum / numericCount).toFixed(4)) : null,
    min: numericCount > 0 ? min : null,
    max: numericCount > 0 ? max : null,
    formatType
  }
}

export function buildReadOnlySelectionTsv(range, rows = [], columns = []) {
  if (!range || !rows.length || !columns.length) return ''
  const minR = Math.max(0, Math.min(range.startRow, range.endRow))
  const maxR = Math.min(rows.length - 1, Math.max(range.startRow, range.endRow))
  const minC = Math.max(0, Math.min(range.startCol, range.endCol))
  const maxC = Math.min(columns.length - 1, Math.max(range.startCol, range.endCol))
  const lines = []
  for (let r = minR; r <= maxR; r += 1) {
    const row = rows[r]
    const cells = []
    for (let c = minC; c <= maxC; c += 1) {
      const colDef = columns[c]
      const rawVal = typeof colDef?.getValue === 'function' ? colDef.getValue(row) : row?.[colDef?.key]
      cells.push(rawVal === null || rawVal === undefined ? '' : String(rawVal))
    }
    lines.push(cells.join('\t'))
  }
  return lines.join('\n')
}
