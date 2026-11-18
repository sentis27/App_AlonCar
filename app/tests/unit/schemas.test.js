import { describe, it, expect } from 'vitest'
import {
  WorkerSchema,
  RateCardSchema,
  WorkOrderSchema,
  LaborLogSchema,
  SystemSettingSchema,
  OrganizationRoleSchema,
  MacroVariableSchema,
  validatePayload,
  validatePartialPayload,
} from '../../src/schemas/index.js'

describe('WorkerSchema (workers)', () => {
  it('acepta un operario válido y completa defaults canónicos', () => {
    const res = validatePayload(WorkerSchema, {
      name: 'MERLOS CRISTIAN',
      trade: 'MECANICA',
      hourly_rate_ars: 15000,
      hourly_rate_usd: 10,
    })
    expect(res.success).toBe(true)
    expect(res.data.admin_center).toBe('ASTILLERO')
    expect(res.data.status).toBe('ACTIVO')
  })

  it('rechaza explícitamente las columnas trampa first_name y last_name (GEMINI.md §3)', () => {
    const res = validatePayload(WorkerSchema, {
      name: 'MERLOS CRISTIAN',
      first_name: 'Cristian',
      last_name: 'Merlos',
      trade: 'MECANICA',
    })
    expect(res.success).toBe(false)
    expect(res.error).toContain('first_name')
    expect(res.error).toContain('last_name')
  })

  it('rechaza tarifas negativas o nombre vacío', () => {
    const res = validatePayload(WorkerSchema, {
      name: '   ',
      trade: 'MECANICA',
      hourly_rate_ars: -10,
    })
    expect(res.success).toBe(false)
    expect(res.issues.length).toBeGreaterThanOrEqual(2)
  })
})

describe('RateCardSchema (rate_cards)', () => {
  it('acepta un registro de tarifario quincenal real', () => {
    const res = validatePayload(RateCardSchema, {
      period: '2026-11-1Q',
      year: 2026,
      month: 11,
      quincena: 1,
      admin_center: 'ASTILLERO',
      entity_name: 'OFICIAL',
      rate_oficial_ars: 16365.76,
      rate_oficial_usd: 10.91,
      has_ayudante: false,
      rate_ayudante_ars: null,
      rate_ayudante_usd: null,
      dollar_rate: 1500,
    })
    expect(res.success).toBe(true)
    expect(res.error).toBe(null)
  })

  it('rechaza período mal formado, quincena distinta de 1|2 o dollar_rate <= 0', () => {
    const res = validatePayload(RateCardSchema, {
      period: '2026-11-3Q',
      year: 2026,
      month: 11,
      quincena: 3,
      admin_center: 'ASTILLERO',
      entity_name: 'OFICIAL',
      rate_oficial_ars: 1000,
      rate_oficial_usd: 1,
      dollar_rate: 0,
    })
    expect(res.success).toBe(false)
    expect(res.issues.map((i) => i.field)).toEqual(
      expect.arrayContaining(['period', 'quincena', 'dollar_rate'])
    )
  })
})

describe('WorkOrderSchema (work_orders)', () => {
  it('acepta una OT válida con ship_id UUID', () => {
    const res = validatePayload(WorkOrderSchema, {
      ship_id: '1de75167-e6f3-49c3-b1bb-22e9f4073dd9',
      ot_number: 'OT-5',
      title: 'CAMBIO CHAPA',
      work_type: 'PRESUPUESTO',
      status: 'En Progreso',
    })
    expect(res.success).toBe(true)
  })

  it('rechaza ship_id inválido o título vacío', () => {
    const res = validatePayload(WorkOrderSchema, {
      ship_id: 'no-es-uuid',
      title: '',
    })
    expect(res.success).toBe(false)
  })
})

describe('LaborLogSchema (labor_logs)', () => {
  it('acepta un parte de horas válido y rechaza la columna trampa profile_id', () => {
    const ok = validatePayload(LaborLogSchema, {
      worker_id: 'bea4e755-f1f0-47c4-8ead-75af59644c93',
      worker_name: 'Merlos, Cristian',
      hours_worked: 4,
      date_logged: '2026-11-16',
    })
    expect(ok.success).toBe(true)

    const trap = validatePayload(LaborLogSchema, {
      worker_id: 'bea4e755-f1f0-47c4-8ead-75af59644c93',
      profile_id: 'bea4e755-f1f0-47c4-8ead-75af59644c93',
      worker_name: 'Merlos, Cristian',
      hours_worked: 4,
      date_logged: '2026-11-16',
    })
    expect(trap.success).toBe(false)
    expect(trap.error).toContain('profile_id')
  })
})

describe('Etapa 1 Schemas (system_settings, organization_roles, macro_variables) y validatePartialPayload', () => {
  it('SystemSettingSchema acepta PK key con value JSONB y rechaza columna trampa id', () => {
    const ok = validatePayload(SystemSettingSchema, {
      key: 'master_trades',
      value: ['SOLDADURA', 'PINTURA'],
    })
    expect(ok.success).toBe(true)

    const trap = validatePayload(SystemSettingSchema, {
      id: '123',
      key: 'master_trades',
      value: [],
    })
    expect(trap.success).toBe(false)
    expect(trap.error).toContain('id')
  })

  it('OrganizationRoleSchema exige role_key y role_title y rechaza trampa id', () => {
    const ok = validatePayload(OrganizationRoleSchema, {
      role_key: 'JEFE_OBRA',
      role_title: 'Jefe de Obra',
      holder_name: 'CAMADELLI',
    })
    expect(ok.success).toBe(true)

    const trap = validatePayload(OrganizationRoleSchema, {
      id: '123',
      role_key: 'JEFE_OBRA',
      role_title: 'Jefe de Obra',
    })
    expect(trap.success).toBe(false)
  })

  it('MacroVariableSchema valida año, mes y dólar positivo', () => {
    const ok = validatePayload(MacroVariableSchema, {
      year: 2026,
      month: 11,
      dollar_rate: 1500,
      monthly_inflation_pct: 3.2,
    })
    expect(ok.success).toBe(true)

    const bad = validatePayload(MacroVariableSchema, { year: 2026, month: 13, dollar_rate: 0 })
    expect(bad.success).toBe(false)
  })

  it('validatePartialPayload valida PATCH sin inyectar defaults de otros campos', () => {
    const res = validatePartialPayload(WorkerSchema, { hourly_rate_ars: '18500' })
    expect(res.success).toBe(true)
    expect(res.data).toEqual({ hourly_rate_ars: 18500 })

    const trapPartial = validatePartialPayload(LaborLogSchema, { hours_worked: 8, profile_id: 'abc' })
    expect(trapPartial.success).toBe(false)
    expect(trapPartial.error).toContain('profile_id')
  })
})
