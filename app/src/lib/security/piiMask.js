/**
 * piiMask.js
 * Fuente única para enmascarar datos personales (PII) y redactar secretos antes de
 * escribirlos en consola, logs de IA o detalles de auditoría.
 *
 * Política:
 * - SECRETOS (password, token, api_key, secret, service_role, anon_key, authorization):
 *   se reemplazan SIEMPRE por '[REDACTED]'. Nunca deben persistirse en `audit_logs`.
 * - PII (dni, teléfono, email): se enmascaran parcialmente para consola/logs técnicos.
 *   En `audit_logs` NO se enmascaran, porque el historial de cambios necesita el valor real.
 */

export const REDACTED = '[REDACTED]'

const SECRET_KEY_RE = /(pass(word)?|secret|token|api[_-]?key|apikey|service[_-]?role|anon[_-]?key|authorization|private[_-]?key|credential)/i
const DNI_KEY_RE = /^(dni|cuit|cuil|document(o|_number)?)$/i
const PHONE_KEY_RE = /^(phone|telefono|tel|celular|mobile|participant_?pn)$/i
const EMAIL_KEY_RE = /^(email|mail|correo)$/i

const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g
const BEARER_RE = /\bBearer\s+[A-Za-z0-9._~+/-]{12,}=*/gi
const SK_KEY_RE = /\b(sk|pk|rk)-[A-Za-z0-9_-]{16,}\b/g
const EMAIL_RE = /\b([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/g
const LONG_DIGITS_RE = /\+?\d[\d\s.-]{6,}\d/g

export function isSecretKey(key = '') {
  return SECRET_KEY_RE.test(String(key))
}

/** Deja visibles solo los últimos `visible` dígitos: 30123456 -> ****3456 */
export function maskDigits(value, visible = 4) {
  if (value === null || value === undefined || value === '') return value
  const digits = String(value).replace(/\D/g, '')
  if (digits.length <= visible) return '*'.repeat(digits.length)
  return `${'*'.repeat(digits.length - visible)}${digits.slice(-visible)}`
}

export function maskEmail(value) {
  if (!value || typeof value !== 'string') return value
  return value.replace(EMAIL_RE, (_m, first, domain) => `${first}***@${domain}`)
}

/** Redacta secretos embebidos en texto libre (JWT, Bearer, claves sk-...). */
export function redactSecretsInText(text) {
  if (typeof text !== 'string' || !text) return text
  return text.replace(JWT_RE, REDACTED).replace(BEARER_RE, `Bearer ${REDACTED}`).replace(SK_KEY_RE, REDACTED)
}

/** Para consola/logs técnicos: redacta secretos y enmascara emails y secuencias largas de dígitos (DNI/teléfono). */
export function maskPiiInText(text) {
  if (typeof text !== 'string' || !text) return text
  return maskEmail(redactSecretsInText(text)).replace(LONG_DIGITS_RE, (m) => {
    if (/^\d{4}-\d{2}-\d{2}/.test(m)) return m // fechas ISO no son PII
    if (m.replace(/\D/g, '').length < 7) return m
    return maskDigits(m)
  })
}

function walk(value, transformLeaf, depth, seen) {
  if (value === null || value === undefined) return value
  if (depth > 8) return value
  if (Array.isArray(value)) return value.map((v) => walk(v, transformLeaf, depth + 1, seen))
  if (typeof value === 'object') {
    if (seen.has(value)) return '[Circular]'
    seen.add(value)
    const out = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = transformLeaf(k, v) ?? walk(v, transformLeaf, depth + 1, seen)
    }
    return out
  }
  return value
}

/**
 * Redacta SOLO secretos (por nombre de clave y por patrón en strings). Seguro para `audit_logs`.
 * Devuelve una copia; nunca muta el original.
 */
export function redactSecrets(value) {
  if (typeof value === 'string') return redactSecretsInText(value)
  return walk(value, (key, v) => {
    if (isSecretKey(key) && v !== null && v !== undefined && v !== '') return REDACTED
    if (typeof v === 'string') return redactSecretsInText(v)
    return undefined
  }, 0, new WeakSet())
}

/** Redacta secretos y enmascara PII (dni, teléfono, email). Para consola, IA y diagnósticos. */
export function maskPii(value) {
  if (typeof value === 'string') return maskPiiInText(value)
  return walk(value, (key, v) => {
    if (v === null || v === undefined || v === '') return undefined
    if (isSecretKey(key)) return REDACTED
    if (DNI_KEY_RE.test(key) || PHONE_KEY_RE.test(key)) return typeof v === 'object' ? undefined : maskDigits(v)
    if (EMAIL_KEY_RE.test(key) && typeof v === 'string') return maskEmail(v)
    if (typeof v === 'string') return maskPiiInText(v)
    return undefined
  }, 0, new WeakSet())
}
