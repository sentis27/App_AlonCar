import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock del cliente Supabase: captura lo que se insertaría en audit_logs sin tocar la BD real.
const inserted = []
vi.mock('../../src/lib/supabase.js', () => {
  const chain = (rows) => ({
    select: () => ({
      single: async () => ({ data: Array.isArray(rows) ? rows[0] : rows, error: null }),
      then: (resolve) => resolve({ data: rows, error: null }),
    }),
  })
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { email: 'test@aloncar.local' } } }) },
      from: () => ({
        insert: (rows) => {
          inserted.push(rows)
          return chain(rows)
        },
      }),
    },
  }
})

const { logCellChange, logRowAction, logBatchPaste } = await import('../../src/lib/auditService.js')

describe('auditService + piiMask', () => {
  beforeEach(() => {
    inserted.length = 0
  })

  it('logCellChange conserva valores de negocio y PII (trazabilidad real)', async () => {
    await logCellChange({ entityType: 'workers', entityId: 'w1', field: 'dni', oldValue: '1', newValue: '30123456' })
    expect(inserted[0].details.new_value).toBe('30123456')
    expect(inserted[0].performed_by).toBe('test@aloncar.local')
  })

  it('logCellChange redacta el valor si el campo es un secreto, pero registra el cambio', async () => {
    await logCellChange({ entityType: 'system_settings', entityId: 'ai', field: 'api_key', oldValue: 'sk-old', newValue: 'sk-new' })
    expect(inserted).toHaveLength(1)
    const d = inserted[0].details
    expect(d.old_value).toBe('[REDACTED]')
    expect(d.new_value).toBe('[REDACTED]')
    expect(JSON.stringify(inserted[0])).not.toContain('sk-new')
  })

  it('logRowAction redacta secretos dentro del snapshot', async () => {
    await logRowAction({ entityType: 'system_settings', entityId: 'ai', rowData: { key: 'ai', value: { openai_api_key: 'sk-zzzzzzzzzzzzzzzzzzzz', model: 'gpt' } } })
    const snap = inserted[0].details.snapshot
    expect(snap.value.openai_api_key).toBe('[REDACTED]')
    expect(snap.value.model).toBe('gpt')
  })

  it('logBatchPaste redacta campos secretos en lote', async () => {
    await logBatchPaste({ entityType: 'workers', batchItems: [
      { entityId: 'w1', field: 'phone', oldValue: '1', newValue: '2' },
      { entityId: 'w2', field: 'token', oldValue: 'a', newValue: 'b' },
    ] })
    const rows = inserted[0]
    expect(rows[0].details.new_value).toBe('2')
    expect(rows[1].details.new_value).toBe('[REDACTED]')
  })
})
