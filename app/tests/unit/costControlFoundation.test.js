import { describe, it, expect } from 'vitest'
import {
  CostControlReviewSchema,
  COST_CONTROL_REVIEW_TYPES,
  COST_CONTROL_EXCLUDED_OTS_KEY,
  DEFAULT_EXCLUDED_COST_CONTROL_OTS,
  buildMaterialExceptionReviewKey,
  buildLaborOnlyApprovalReviewKey,
  validatePayload,
  validatePartialPayload,
} from '../../src/schemas/index.js'
import { createCostControlReviewsRepository } from '../../src/repositories/costControlReviewsRepository.js'
import * as repositoriesBarrel from '../../src/repositories/index.js'

const VALID_TX_UUID = '11111111-1111-4111-8111-111111111111'
const VALID_SHIP_UUID = '22222222-2222-4222-8222-222222222222'
const VALID_WO_UUID = '33333333-3333-4333-8333-333333333333'

function createChainMock({ rows = [], error = null } = {}) {
  const ops = []
  const builder = {
    select: (cols, opts) => { ops.push(['select', cols, opts]); return builder },
    eq: (c, v) => { ops.push(['eq', c, v]); return builder },
    in: (c, v) => { ops.push(['in', c, v]); return builder },
    order: (c, o) => { ops.push(['order', c, o]); return builder },
    range: (f, t) => { ops.push(['range', f, t]); return builder },
    limit: (n) => { ops.push(['limit', n]); return builder },
    upsert: (p, opts) => { ops.push(['upsert', p, opts]); return builder },
    delete: () => { ops.push(['delete']); return builder },
    then: (resolve) => resolve({ data: rows, error, count: rows.length }),
  }
  return { ops, client: { from: (t) => { ops.push(['from', t]); return builder } } }
}

describe('CostControlReviewSchema y claves determinísticas (Etapa 1)', () => {
  it('genera review_key determinísticas para excepciones y aprobaciones', () => {
    expect(buildMaterialExceptionReviewKey(` ${VALID_TX_UUID} `)).toBe(`MAT:${VALID_TX_UUID}`)
    expect(buildMaterialExceptionReviewKey('')).toBe('')
    expect(
      buildLaborOnlyApprovalReviewKey({
        periodKey: '2026-11-2q',
        shipId: VALID_SHIP_UUID,
        workOrderId: VALID_WO_UUID,
        contractorEntity: ' astillero ',
      })
    ).toBe(`LAB:2026-11-2Q|${VALID_SHIP_UUID}|${VALID_WO_UUID}|ASTILLERO`)
    expect(COST_CONTROL_REVIEW_TYPES).toEqual(['MATERIAL_EXCEPTION', 'LABOR_ONLY_APPROVED'])
    expect(COST_CONTROL_EXCLUDED_OTS_KEY).toBe('cost_control_excluded_ots')
    expect(DEFAULT_EXCLUDED_COST_CONTROL_OTS).toContain('PROV.CONSUMIBLES')
  })

  it('acepta MATERIAL_EXCEPTION y LABOR_ONLY_APPROVED válidos', () => {
    const matRes = validatePayload(CostControlReviewSchema, {
      review_type: 'MATERIAL_EXCEPTION',
      period_key: '2026-11-2Q',
      inventory_transaction_id: VALID_TX_UUID,
      ship_id: VALID_SHIP_UUID,
      work_order_id: VALID_WO_UUID,
      contractor_entity: 'RAMON ARANDA',
      review_key: buildMaterialExceptionReviewKey(VALID_TX_UUID),
      reason: 'Consumo previo autorizado',
    })
    expect(matRes.success).toBe(true)
    expect(matRes.data.reviewed_by).toBe('Administrador')

    const labRes = validatePayload(CostControlReviewSchema, {
      review_type: 'LABOR_ONLY_APPROVED',
      period_key: '2026-11-2Q',
      inventory_transaction_id: null,
      ship_id: VALID_SHIP_UUID,
      work_order_id: VALID_WO_UUID,
      contractor_entity: 'ASTILLERO',
      review_key: buildLaborOnlyApprovalReviewKey({
        periodKey: '2026-11-2Q',
        shipId: VALID_SHIP_UUID,
        workOrderId: VALID_WO_UUID,
        contractorEntity: 'ASTILLERO',
      }),
    })
    expect(labRes.success).toBe(true)
  })

  it('rechaza MATERIAL_EXCEPTION sin inventory_transaction_id y period_key inválido', () => {
    const missingTx = validatePayload(CostControlReviewSchema, {
      review_type: 'MATERIAL_EXCEPTION',
      period_key: '2026-11-2Q',
      inventory_transaction_id: null,
      contractor_entity: 'TANO',
      review_key: 'MAT:none',
    })
    expect(missingTx.success).toBe(false)
    expect(missingTx.error).toContain('inventory_transaction_id')

    const badPeriod = validatePayload(CostControlReviewSchema, {
      review_type: 'LABOR_ONLY_APPROVED',
      period_key: '2026-11-3Q',
      contractor_entity: 'TANO',
      review_key: 'LAB:bad',
    })
    expect(badPeriod.success).toBe(false)
    expect(badPeriod.error).toContain('period_key')
  })

  it('rechaza columnas trampa notes y entity_id en validación completa y parcial', () => {
    const fullTrap = validatePayload(CostControlReviewSchema, {
      review_type: 'LABOR_ONLY_APPROVED',
      period_key: '2026-11-2Q',
      contractor_entity: 'ASTILLERO',
      review_key: 'LAB:X',
      notes: 'trampa',
      entity_id: VALID_TX_UUID,
    })
    expect(fullTrap.success).toBe(false)
    expect(fullTrap.error).toContain('notes')
    expect(fullTrap.error).toContain('entity_id')

    const partialTrap = validatePartialPayload(CostControlReviewSchema, {
      notes: 'trampa parcial',
    })
    expect(partialTrap.success).toBe(false)
    expect(partialTrap.error).toContain('notes')
  })
})

describe('costControlReviewsRepository (Etapa 1)', () => {
  it('re-exporta el repositorio desde repositories/index.js', () => {
    expect(typeof repositoriesBarrel.createCostControlReviewsRepository).toBe('function')
    expect(repositoriesBarrel.costControlReviewsRepository.table).toBe('cost_control_reviews')
  })

  it('consulta por quincena única y por múltiples quincenas vía findAllBatched', async () => {
    const mockRows = [{ id: VALID_TX_UUID, period_key: '2026-11-2Q', review_key: `MAT:${VALID_TX_UUID}` }]
    const { client, ops } = createChainMock({ rows: mockRows })
    const repo = createCostControlReviewsRepository({ client })

    const oneRes = await repo.listByPeriod('2026-11-2Q', { reviewType: 'MATERIAL_EXCEPTION' })
    expect(oneRes.error).toBe(null)
    expect(oneRes.data).toHaveLength(1)
    expect(ops).toContainEqual(['from', 'cost_control_reviews'])
    expect(ops).toContainEqual(['eq', 'period_key', '2026-11-2Q'])
    expect(ops).toContainEqual(['eq', 'review_type', 'MATERIAL_EXCEPTION'])

    const multiRes = await repo.listByPeriods(['2026-11-2Q', '2026-11-1Q'])
    expect(multiRes.error).toBe(null)
    expect(ops).toContainEqual(['in', 'period_key', ['2026-11-2Q', '2026-11-1Q']])

    const emptyRes = await repo.listByPeriod('')
    expect(emptyRes).toEqual({ data: [], error: null, count: 0 })
  })

  it('hace upsert por review_key, bloquea trampa notes antes de ir a DB y elimina por review_key', async () => {
    const { client, ops } = createChainMock({
      rows: [{ id: VALID_TX_UUID, review_key: `MAT:${VALID_TX_UUID}` }],
    })
    const repo = createCostControlReviewsRepository({ client })

    const bad = await repo.upsertByReviewKey({
      review_type: 'LABOR_ONLY_APPROVED',
      period_key: '2026-11-2Q',
      contractor_entity: 'ASTILLERO',
      review_key: 'LAB:1',
      notes: 'no existe',
    })
    expect(bad.error).toContain('notes')
    expect(ops).toHaveLength(0)

    const ok = await repo.upsertByReviewKey({
      review_type: 'MATERIAL_EXCEPTION',
      period_key: '2026-11-2Q',
      inventory_transaction_id: VALID_TX_UUID,
      contractor_entity: 'RAMON ARANDA',
      review_key: `MAT:${VALID_TX_UUID}`,
      reason: 'Autorizado por supervisor',
    })
    expect(ok.error).toBe(null)
    expect(ops.find((o) => o[0] === 'upsert')[2]).toEqual({ onConflict: 'review_key' })

    const delBad = await repo.deleteByReviewKey('')
    expect(delBad.error).toContain('review_key')

    const delOk = await repo.deleteByReviewKey(`MAT:${VALID_TX_UUID}`)
    expect(delOk.error).toBe(null)
    expect(ops).toContainEqual(['delete'])
    expect(ops).toContainEqual(['eq', 'review_key', `MAT:${VALID_TX_UUID}`])
  })
})
