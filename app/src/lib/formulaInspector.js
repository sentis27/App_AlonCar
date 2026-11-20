/**
 * formulaInspector.js
 * Helpers puros de inspección, persistencia JSONB (`cell_formulas`) y formateo de fórmulas
 * para AlonCar ERP. Re-exportado por `formulaEngine.js` (Fuente Única de Verdad).
 */

function formatDimensionNumber(numStr) {
  const n = Number(numStr)
  if (!Number.isFinite(n)) return numStr
  return n.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 3 })
}

/**
 * Extrae metadatos legibles de una fórmula guardada (`=1*0.5`, `=42+45+30`, `=1*0.5+2*0.4`).
 * Útil para tooltips livianos (`title`), columnas de cortes de chapa y reportes de cliente.
 */
export function describeFormula(formula) {
  if (!formula || typeof formula !== 'string') return null
  const raw = formula.trim()
  if (!raw) return null
  const expr = raw.replace(/^[=+]\s*/, '').replace(/\s+/g, '')
  if (!expr) return null

  if (/^\d+(?:\.\d+)?(?:\*\d+(?:\.\d+)?)+$/.test(expr)) {
    const factors = expr.split('*')
    const dimensionsLabel = factors.map(formatDimensionNumber).join(' × ')
    return {
      raw,
      expr,
      kind: 'AREA_PRODUCT',
      partsCount: 1,
      factors: factors.map(Number),
      parts: [dimensionsLabel],
      dimensionsLabel,
      shortBadge: dimensionsLabel,
      tooltipText: `Corte / Medidas: ${dimensionsLabel} (${raw}) · Doble clic para editar`
    }
  }

  if (/^\d+(?:\.\d+)?(?:\*\d+(?:\.\d+)?)+(?:\+\d+(?:\.\d+)?(?:\*\d+(?:\.\d+)?)+)+$/.test(expr)) {
    const segments = expr.split('+')
    const formattedSegments = segments.map((seg) => seg.split('*').map(formatDimensionNumber).join('×'))
    const dimensionsLabel = formattedSegments.join(' + ')
    return {
      raw,
      expr,
      kind: 'AREA_SUM',
      partsCount: segments.length,
      factors: [],
      parts: formattedSegments,
      dimensionsLabel,
      shortBadge: dimensionsLabel,
      tooltipText: `Cortes (${segments.length}): ${dimensionsLabel} (${raw}) · Doble clic para editar`
    }
  }

  if (/^\d+(?:\.\d+)?(?:[+-]\d+(?:\.\d+)?)+$/.test(expr)) {
    const parts = expr.match(/[+-]?\d+(?:\.\d+)?/g) || []
    return {
      raw,
      expr,
      kind: 'SUM_PARTS',
      partsCount: parts.length,
      factors: [],
      parts,
      dimensionsLabel: '',
      shortBadge: `${parts.length} partes`,
      tooltipText: `Fórmula: ${raw} (${parts.length} partes) · Doble clic para ver o agregar`
    }
  }

  return {
    raw,
    expr,
    kind: 'EXPR',
    partsCount: 1,
    factors: [],
    parts: [expr],
    dimensionsLabel: expr.replace(/\*/g, '×'),
    shortBadge: 'fx',
    tooltipText: `Fórmula: ${raw} · Doble clic para editar`
  }
}

export function getStoredCellFormula(row, field) {
  if (!row || !field) return null
  const map = row.cell_formulas
  if (!map || typeof map !== 'object' || Array.isArray(map)) return null
  const val = map[field]
  return typeof val === 'string' && val.trim() ? val.trim() : null
}

export function buildCellFormulasPatch(existingFormulas, field, formulaOrNull) {
  const base =
    existingFormulas && typeof existingFormulas === 'object' && !Array.isArray(existingFormulas)
      ? { ...existingFormulas }
      : {}

  if (typeof formulaOrNull === 'string' && formulaOrNull.trim()) {
    base[field] = formulaOrNull.trim()
  } else {
    delete base[field]
  }
  return base
}

export function getEditableCellInitialValue(row, field, fallbackValue = '') {
  const stored = getStoredCellFormula(row, field)
  if (stored) return stored
  if (fallbackValue === null || fallbackValue === undefined) return ''
  return String(fallbackValue)
}

export function formatFormulaNumericDisplay(val, { maxDecimals = 2 } = {}) {
  const num = Number(val)
  if (!Number.isFinite(num)) return '0'
  return num.toLocaleString('es-AR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: maxDecimals
  })
}
