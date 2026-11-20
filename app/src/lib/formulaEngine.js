/**
 * formulaEngine.js
 * Motor canónico, puro y determinístico de fórmulas aritméticas estilo Excel / Google Sheets
 * para AlonCar ERP (Candado #2 · Fuente Única de Verdad).
 *
 * - Cero `eval()` ni `new Function()` (parser descendente recursivo seguro).
 * - Acepta `=` y `+` como prefijos equivalentes (`=42+45` === `+42+45`, `=1*0.5` === `+1*0,5`).
 * - Acepta expresiones directas (`42+45`, `1*0.5`) y `x`/`×` entre números (`1x0.5`).
 */
export {
  describeFormula,
  getStoredCellFormula,
  buildCellFormulasPatch,
  getEditableCellInitialValue,
  formatFormulaNumericDisplay
} from './formulaInspector.js'

const MAX_FORMULA_LENGTH = 200

function roundClean(num, maxDecimals = 4) {
  if (!Number.isFinite(num)) return NaN
  const factor = Math.pow(10, maxDecimals)
  const rounded = Math.round((num + Number.EPSILON) * factor) / factor
  return Object.is(rounded, -0) ? 0 : rounded
}

export function normalizeNumberToken(rawToken) {
  const token = String(rawToken || '').trim()
  if (!token) return null
  const hasDot = token.includes('.')
  const hasComma = token.includes(',')

  let normalized = token
  if (hasDot && hasComma) {
    normalized = token.lastIndexOf(',') > token.lastIndexOf('.')
      ? token.replace(/\./g, '').replace(',', '.')
      : token.replace(/,/g, '')
  } else if (hasComma) {
    normalized = (token.match(/,/g) || []).length > 1 ? token.replace(/,/g, '') : token.replace(',', '.')
  } else if (hasDot && (token.match(/\./g) || []).length > 1) {
    normalized = token.replace(/\./g, '')
  }

  if (!/^\d*(\.\d+)?$/.test(normalized) || normalized === '.' || normalized === '') return null
  const num = Number(normalized)
  return Number.isFinite(num) ? { num, text: normalized } : null
}

function tokenizeExpression(expr) {
  const tokens = []
  let i = 0
  while (i < expr.length) {
    const ch = expr[i]
    if (/\s/.test(ch)) { i += 1; continue }
    if (/[0-9.,]/.test(ch)) {
      let j = i
      while (j < expr.length && /[0-9.,]/.test(expr[j])) j += 1
      const rawNum = expr.slice(i, j)
      const parsed = normalizeNumberToken(rawNum)
      if (!parsed) return { ok: false, error: `Número inválido: "${rawNum}"` }
      tokens.push({ type: 'NUM', value: parsed.num, text: parsed.text })
      i = j
      continue
    }
    if (ch === '+' || ch === '-' || ch === '*' || ch === '/') {
      tokens.push({ type: 'OP', value: ch }); i += 1; continue
    }
    if (ch === '×' || ch === 'x' || ch === 'X') {
      tokens.push({ type: 'OP', value: '*' }); i += 1; continue
    }
    if (ch === '(' || ch === ')') {
      tokens.push({ type: 'PAREN', value: ch }); i += 1; continue
    }
    return { ok: false, error: `Carácter no permitido en fórmula: "${ch}"` }
  }
  return { ok: true, tokens }
}

function parseTokens(tokens) {
  let pos = 0
  let binaryOpsCount = 0
  const peek = () => tokens[pos] || null
  const consume = () => tokens[pos++]

  function parseExpr() {
    let left = parseTerm()
    while (peek()?.type === 'OP' && (peek().value === '+' || peek().value === '-')) {
      const op = consume().value
      binaryOpsCount += 1
      const right = parseTerm()
      left = op === '+' ? left + right : left - right
    }
    return left
  }

  function parseTerm() {
    let left = parseFactor()
    while (peek()?.type === 'OP' && (peek().value === '*' || peek().value === '/')) {
      const op = consume().value
      binaryOpsCount += 1
      const right = parseFactor()
      if (op === '/') {
        if (Math.abs(right) < 1e-12) throw new Error('División por cero no permitida.')
        left = left / right
      } else {
        left = left * right
      }
    }
    return left
  }

  function parseFactor() {
    const t = peek()
    if (!t) throw new Error('Expresión incompleta.')
    if (t.type === 'OP' && (t.value === '+' || t.value === '-')) {
      consume()
      const val = parseFactor()
      return t.value === '-' ? -val : val
    }
    if (t.type === 'NUM') { consume(); return t.value }
    if (t.type === 'PAREN' && t.value === '(') {
      consume()
      const val = parseExpr()
      const closing = peek()
      if (!closing || closing.type !== 'PAREN' || closing.value !== ')') {
        throw new Error('Falta cerrar paréntesis ")".')
      }
      consume()
      return val
    }
    throw new Error(`Operador inesperado: "${t.value}"`)
  }

  const result = parseExpr()
  if (pos < tokens.length) {
    throw new Error(`Sobra contenido en la fórmula: "${tokens[pos].value || tokens[pos].text}"`)
  }
  if (!Number.isFinite(result)) throw new Error('El resultado no es un número válido.')
  return { result, binaryOpsCount }
}

function buildCanonicalFormula(tokens) {
  const start = tokens[0]?.type === 'OP' && tokens[0].value === '+' ? 1 : 0
  return `=${tokens.slice(start).map((t) => (t.type === 'NUM' ? t.text : t.value)).join('')}`
}

export function looksLikeFormula(rawInput) {
  if (rawInput === null || rawInput === undefined) return false
  const s = String(rawInput).trim()
  if (!s) return false
  if (s.startsWith('=')) return true
  if (s.startsWith('+') && /[+\-*/x×()]/.test(s.slice(1))) return true
  return /\d\s*[+\-*/x×]\s*[\d(]/.test(s)
}

export function evaluateFormulaInput(
  rawInput,
  { allowNegative = false, maxDecimals = 4, emptyValue = null } = {}
) {
  if (rawInput === null || rawInput === undefined) {
    return { ok: true, value: emptyValue, isFormula: false, formula: null, error: null }
  }
  if (typeof rawInput === 'number') {
    if (!Number.isFinite(rawInput)) {
      return { ok: false, value: null, isFormula: false, formula: null, error: 'Número inválido.' }
    }
    if (!allowNegative && rawInput < 0) {
      return { ok: false, value: null, isFormula: false, formula: null, error: 'El valor no puede ser negativo.' }
    }
    return { ok: true, value: roundClean(rawInput, maxDecimals), isFormula: false, formula: null, error: null }
  }

  const trimmed = String(rawInput).trim()
  if (!trimmed) return { ok: true, value: emptyValue, isFormula: false, formula: null, error: null }
  if (trimmed.length > MAX_FORMULA_LENGTH) {
    return { ok: false, value: null, isFormula: false, formula: null, error: 'La fórmula es demasiado larga.' }
  }

  let cleaned = trimmed.replace(/(?:AR\$|US\$|\$|€)/gi, '').trim()
  if (cleaned.startsWith('=') || cleaned.startsWith('+')) cleaned = cleaned.slice(1).trim()
  if (!cleaned) {
    return { ok: false, value: null, isFormula: true, formula: null, error: 'Escribí la cuenta después de = o +.' }
  }

  const tokRes = tokenizeExpression(cleaned)
  if (!tokRes.ok) {
    return { ok: false, value: null, isFormula: looksLikeFormula(rawInput), formula: null, error: tokRes.error }
  }
  if (tokRes.tokens.length === 0) {
    return { ok: true, value: emptyValue, isFormula: false, formula: null, error: null }
  }

  try {
    const { result, binaryOpsCount } = parseTokens(tokRes.tokens)
    const rounded = roundClean(result, maxDecimals)
    if (!allowNegative && rounded < 0) {
      return { ok: false, value: null, isFormula: binaryOpsCount > 0, formula: null, error: 'El resultado no puede ser negativo.' }
    }
    const isFormula = binaryOpsCount > 0
    return { ok: true, value: rounded, isFormula, formula: isFormula ? buildCanonicalFormula(tokRes.tokens) : null, error: null }
  } catch (err) {
    return { ok: false, value: null, isFormula: true, formula: null, error: err?.message || 'Fórmula inválida.' }
  }
}
