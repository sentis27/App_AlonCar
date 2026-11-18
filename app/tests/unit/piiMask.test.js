import { describe, it, expect } from 'vitest'
import {
  REDACTED,
  isSecretKey,
  maskDigits,
  maskEmail,
  redactSecrets,
  maskPii,
  maskPiiInText,
} from '../../src/lib/security/piiMask.js'

const FAKE_JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.abcdefghijklmnop'

describe('isSecretKey', () => {
  it('reconoce nombres de claves sensibles', () => {
    for (const k of ['password', 'api_key', 'apiKey', 'OPENAI_API_KEY', 'service_role_key', 'token', 'Authorization']) {
      expect(isSecretKey(k)).toBe(true)
    }
    for (const k of ['name', 'dni', 'hourly_rate_ars', 'trade']) {
      expect(isSecretKey(k)).toBe(false)
    }
  })
})

describe('maskDigits / maskEmail', () => {
  it('deja visibles los últimos 4 dígitos', () => {
    expect(maskDigits('30.123.456')).toBe('****3456')
    expect(maskDigits('+54 9 223 555-1234')).toBe('*********1234')
    expect(maskDigits('')).toBe('')
    expect(maskDigits(null)).toBe(null)
  })
  it('enmascara el usuario del email', () => {
    expect(maskEmail('juan.perez@aloncar.com')).toBe('j***@aloncar.com')
  })
})

describe('redactSecrets (seguro para audit_logs)', () => {
  it('redacta claves secretas pero conserva PII y datos de negocio', () => {
    const input = { name: 'PEREZ', dni: '30123456', value: { api_key: 'sk-abcdefghijklmnopqrstuv', model: 'gpt' } }
    const out = redactSecrets(input)
    expect(out.value.api_key).toBe(REDACTED)
    expect(out.value.model).toBe('gpt')
    expect(out.dni).toBe('30123456')
    expect(input.value.api_key).toBe('sk-abcdefghijklmnopqrstuv') // no muta
  })
  it('redacta JWT y Bearer embebidos en texto libre', () => {
    const out = redactSecrets({ notes: `clave ${FAKE_JWT} y Bearer abcdefghijklmnop123` })
    expect(out.notes).not.toContain('eyJ')
    expect(out.notes).toContain(`Bearer ${REDACTED}`)
  })
  it('soporta arrays, null y referencias circulares', () => {
    const a = { token: 'x' }
    a.self = a
    const out = redactSecrets([a, null])
    expect(out[0].token).toBe(REDACTED)
    expect(out[0].self).toBe('[Circular]')
    expect(out[1]).toBe(null)
  })
})

describe('maskPii (consola / IA / diagnóstico)', () => {
  it('enmascara dni, teléfono y email por nombre de clave', () => {
    const out = maskPii({ dni: '30123456', phone: '2235551234', email: 'ana@x.com', password: 'p' })
    expect(out.dni).toBe('****3456')
    expect(out.phone).toBe('******1234')
    expect(out.email).toBe('a***@x.com')
    expect(out.password).toBe(REDACTED)
  })
  it('en texto libre enmascara números largos pero respeta fechas y montos cortos', () => {
    const txt = maskPiiInText('Operario DNI 30123456 llamó al 2235551234 el 2026-11-18 por 1500 pesos')
    expect(txt).toContain('****3456')
    expect(txt).toContain('******1234')
    expect(txt).toContain('2026-11-18')
    expect(txt).toContain('1500')
  })
})
