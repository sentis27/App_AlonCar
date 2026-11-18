import { describe, it, expect, vi } from 'vitest'
import { createWorkersRepository } from '../../src/repositories/workersRepository.js'
import { createSystemSettingsRepository } from '../../src/repositories/systemSettingsRepository.js'
import { createOrganizationRolesRepository } from '../../src/repositories/organizationRolesRepository.js'
import { createMacroVariablesRepository } from '../../src/repositories/macroVariablesRepository.js'
import { createLaborLogsRepository } from '../../src/repositories/laborLogsRepository.js'
import { createOtTemplatesRepository } from '../../src/repositories/otTemplatesRepository.js'
import { createSystemPromptsRepository } from '../../src/repositories/aiGovernanceRepository.js'
import { createShipsRepository } from '../../src/repositories/shipsRepository.js'
import { createShipStaysRepository } from '../../src/repositories/shipStaysRepository.js'
import { createOwnersRepository } from '../../src/repositories/ownersRepository.js'
import { createPurchaseOrdersRepository } from '../../src/repositories/purchaseOrdersRepository.js'
import { createSuppliersRepository } from '../../src/repositories/suppliersRepository.js'
import { createThirdPartyServicesRepository } from '../../src/repositories/thirdPartyServicesRepository.js'
import { createWorkOrdersRepository } from '../../src/repositories/workOrdersRepository.js'
import { createWorkItemsRepository } from '../../src/repositories/workItemsRepository.js'
import { createMaterialsRepository } from '../../src/repositories/materialsRepository.js'
import { createInventoryTransactionsRepository } from '../../src/repositories/inventoryTransactionsRepository.js'
import { createGasMovementsRepository } from '../../src/repositories/gasMovementsRepository.js'
import { createComplianceAlertsRepository } from '../../src/repositories/complianceAlertsRepository.js'
import { createAuditLogsRepository } from '../../src/repositories/auditLogsRepository.js'
import { createProfilesRepository } from '../../src/repositories/profilesRepository.js'
import * as repositoriesBarrel from '../../src/repositories/index.js'

function createChainMock({ rows = [], error = null } = {}) {
  const ops = []
  const builder = {
    select: (cols) => { ops.push(['select', cols]); return builder },
    eq: (c, v) => { ops.push(['eq', c, v]); return builder },
    in: (c, v) => { ops.push(['in', c, v]); return builder },
    order: (c, o) => { ops.push(['order', c, o]); return builder },
    limit: (n) => { ops.push(['limit', n]); return builder },
    single: async () => ({ data: rows[0] || null, error }),
    maybeSingle: async () => ({ data: rows[0] || null, error }),
    insert: (p) => { ops.push(['insert', p]); return builder },
    upsert: (p, opts) => { ops.push(['upsert', p, opts]); return builder },
    update: (p) => { ops.push(['update', p]); return builder },
    delete: () => { ops.push(['delete']); return builder },
    then: (resolve) => resolve({ data: rows, error, count: rows.length }),
  }
  return { ops, client: { from: (t) => { ops.push(['from', t]); return builder } } }
}

describe('Repositorios Etapa 1 y Etapa 2', () => {
  it('workersRepository bloquea columnas trampa en insert y update parcial', async () => {
    const { client, ops } = createChainMock()
    const repo = createWorkersRepository({ client })

    const badIns = await repo.insertOne({ name: 'TEST', first_name: 'Bad', trade: 'SOLDADURA' })
    expect(badIns.error).toContain('first_name')
    expect(ops).toHaveLength(0)

    const badUpd = await repo.updateById('w-1', { last_name: 'Trap' })
    expect(badUpd.error).toContain('last_name')
    expect(ops).toHaveLength(0)
  })

  it('systemSettingsRepository usa onConflict key y bloquea trampa id', async () => {
    const { client, ops } = createChainMock({ rows: [{ key: 'master_trades', value: ['PINTURA'] }] })
    const repo = createSystemSettingsRepository({ client })

    const bad = await repo.upsertOne({ id: '999', key: 'k', value: 1 })
    expect(bad.error).toContain('id')

    const ok = await repo.saveByKey('master_trades', ['PINTURA'], { updatedBy: 'Admin' })
    expect(ok.error).toBe(null)
    expect(ops.find((o) => o[0] === 'upsert')[2]).toEqual({ onConflict: 'key' })
  })

  it('organizationRolesRepository usa role_key y macroVariablesRepository valida mes', async () => {
    const { client: c1 } = createChainMock()
    const rolesRepo = createOrganizationRolesRepository({ client: c1 })
    expect((await rolesRepo.upsertRole({ id: '1', role_key: 'X', role_title: 'Y' })).error).toContain('id')

    const { client: c2 } = createChainMock()
    const macroRepo = createMacroVariablesRepository({ client: c2 })
    expect((await macroRepo.saveMonthlyVariables({ year: 2026, month: 15, dollar_rate: 1500 })).error).toContain('Mes')
  })

  it('laborLogsRepository acepta worker_id null/opcional, rechaza trampa profile_id y permite insertBlankRow', async () => {
    const { client, ops } = createChainMock({ rows: [{ id: 'log-1', worker_name: 'GOMEZ' }] })
    const repo = createLaborLogsRepository({ client })

    const trap = await repo.insertOne({ worker_name: 'GOMEZ', hours_worked: 8, date_logged: '2026-11-18', profile_id: 'x' })
    expect(trap.error).toContain('profile_id')

    const okNoId = await repo.insertOne({ worker_name: 'CONTRATISTA A', hours_worked: 8, date_logged: '2026-11-18' })
    expect(okNoId.error).toBe(null)

    const blank = await repo.insertBlankRow({ worker_name: '', hours_worked: 0, date_logged: '2026-11-18' })
    expect(blank.error).toBe(null)
    expect(ops.filter((o) => o[0] === 'insert')).toHaveLength(2)
  })

  it('otTemplatesRepository y systemPromptsRepository validan nombre/slug obligatorio', async () => {
    const { client: c1 } = createChainMock()
    const otRepo = createOtTemplatesRepository({ client: c1 })
    expect((await otRepo.insertOne({ name: '   ' })).error).toBeTruthy()

    const { client: c2 } = createChainMock()
    const spRepo = createSystemPromptsRepository({ client: c2 })
    expect((await spRepo.upsertPrompt({ slug: '', title: 'T', prompt_template: 'P' })).error).toBeTruthy()
  })

  it('Etapa 3: shipsRepository, shipStaysRepository y ownersRepository validan requeridos y permiten PATCH parcial', async () => {
    const { client: sc } = createChainMock({ rows: [{ id: 's1', name: 'TRITON' }] })
    const sRepo = createShipsRepository({ client: sc })
    expect((await sRepo.insertOne({ name: '' })).error).toBeTruthy()
    expect((await sRepo.updateById('s1', { current_location: 'MUELLE' }, { select: null })).error).toBe(null)

    const { client: stc } = createChainMock()
    const stRepo = createShipStaysRepository({ client: stc })
    expect((await stRepo.insertOne({ ship_id: 'bad', location: 'VARADERO', start_date: '2026-11-18' })).error).toContain('UUID')

    const { client: oc } = createChainMock()
    const oRepo = createOwnersRepository({ client: oc })
    expect((await oRepo.insertOne({ name: '   ' })).error).toBeTruthy()
  })

  it('Etapa 4: purchaseOrders, suppliers y thirdPartyServices validan reglas y permiten blank rows', async () => {
    const { client: poc } = createChainMock({ rows: [{ id: 'po-1' }] })
    const poRepo = createPurchaseOrdersRepository({ client: poc })
    expect((await poRepo.insertOne({ material_name_raw: '', quantity: 1 })).error).toBe(null)
    expect((await poRepo.insertOne({ quantity: -2 })).error).toContain('quantity')

    const { client: supc } = createChainMock()
    const supRepo = createSuppliersRepository({ client: supc })
    expect((await supRepo.insertOne({ name: '' })).error).toBeTruthy()

    const { client: tpc } = createChainMock({ rows: [{ id: 'tp-1' }] })
    const tpRepo = createThirdPartyServicesRepository({ client: tpc })
    expect((await tpRepo.insertOne({ contractor_name: '' })).error).toBeTruthy()
    expect((await tpRepo.insertBlankRow({ contractor_name: '', amount_ars: 0 })).error).toBe(null)
  })

  it('Etapa 5: workOrders, workItems, materials, inventoryTransactions, gasMovements y complianceAlerts', async () => {
    const { client: woc } = createChainMock()
    const woRepo = createWorkOrdersRepository({ client: woc })
    expect((await woRepo.insertOne({ ship_id: 'bad', title: '' })).error).toBeTruthy()

    const { client: wic } = createChainMock()
    const wiRepo = createWorkItemsRepository({ client: wic })
    expect((await wiRepo.insertOne({ work_order_id: 'not-uuid' })).error).toContain('UUID')

    const { client: mc } = createChainMock({ rows: [{ id: 'm-1', name: 'DISCO' }] })
    const mRepo = createMaterialsRepository({ client: mc })
    expect((await mRepo.insertOne({ name: '  ' })).error).toBeTruthy()
    expect((await mRepo.updateStock('m-1', 12)).error).toBe(null)

    const { client: itc } = createChainMock({ rows: [{ id: 'tx-1' }] })
    const itRepo = createInventoryTransactionsRepository({ client: itc })
    expect((await itRepo.insertBlankRow({ material_id: null, quantity_withdrawn: null })).error).toBe(null)

    const { client: gc } = createChainMock()
    const gRepo = createGasMovementsRepository({ client: gc })
    expect((await gRepo.insertOne({ movement_date: '2026-11-18', operation_type: 'PRIMERA_ENTREGA', material_id: 'bad', quantity: 0 })).error).toBeTruthy()

    const { client: cac } = createChainMock()
    const caRepo = createComplianceAlertsRepository({ client: cac })
    expect((await caRepo.insertOne({ requirement_id: 'bad', entity_type: 'workers', entity_id: '1', responsible_role: 'admin' })).error).toContain('UUID')
  })

  it('Etapa 6: auditLogsRepository bloquea columnas trampa y barrel exporta repositorios', async () => {
    const { client: badClient, ops: badOps } = createChainMock()
    const repoBad = createAuditLogsRepository({ client: badClient })

    const trapEntity = await repoBad.insertLog({ action: 'UPDATE', entity: 'workers', entity_type: 'workers', entity_id: '1' })
    expect(trapEntity.error).toContain('Columna trampa prohibida')
    expect(trapEntity.error).toContain('"entity"')
    expect(badOps).toHaveLength(0)

    const trapTableName = await repoBad.insertLog({ action: 'UPDATE', table_name: 'workers', entity_type: 'workers', entity_id: '1' })
    expect(trapTableName.error).toContain('Columna trampa prohibida')
    expect(trapTableName.error).toContain('"table_name"')
    expect(badOps).toHaveLength(0)

    const { client: okClient, ops: okOps } = createChainMock({
      rows: [{ id: 'log-1', action: 'UPDATE', entity_type: 'workers', entity_id: 'w-1', performed_by: 'Admin' }],
    })
    const repoOk = createAuditLogsRepository({ client: okClient })
    const okIns = await repoOk.insertLog({
      action: 'UPDATE',
      entity_type: 'workers',
      entity_id: 'w-1',
      entity_name: 'JUAN',
      details: { field: 'trade', old_value: 'A', new_value: 'B' },
      performed_by: 'Admin',
    })
    expect(okIns.error).toBe(null)
    expect(okIns.data.id).toBe('log-1')
    expect(okOps.find((o) => o[0] === 'insert')[1].entity_type).toBe('workers')

    const ledgerRes = await repoOk.listGlobalLedger({ limit: 50 })
    expect(ledgerRes.error).toBe(null)
    expect(okOps.find((o) => o[0] === 'limit')[1]).toBe(50)

    expect(repositoriesBarrel.auditLogsRepository).toBeDefined()
    expect(repositoriesBarrel.workersRepository).toBeDefined()
    expect(repositoriesBarrel.workOrdersRepository).toBeDefined()
    expect(repositoriesBarrel.laborLogsRepository).toBeDefined()
    expect(repositoriesBarrel.shipsRepository).toBeDefined()
    expect(repositoriesBarrel.purchaseOrdersRepository).toBeDefined()
    expect(repositoriesBarrel.profilesRepository).toBeDefined()
  })

  it('profilesRepository valida UUID/email/rol y ejecuta upsert onConflict id', async () => {
    const validUuid = '1de75167-e6f3-49c3-b1bb-22e9f4073dd9'
    const { client, ops } = createChainMock({
      rows: [{ id: validUuid, email: 'test@aloncar.com', role: 'Supervisor' }],
    })
    const repo = createProfilesRepository({ client })

    const badUuid = await repo.upsertProfile({ id: 'no-uuid', email: 'test@aloncar.com', role: 'Supervisor' })
    expect(badUuid.error).toContain('UUID')
    expect(ops).toHaveLength(0)

    const badRole = await repo.upsertProfile({
      id: validUuid,
      email: 'test@aloncar.com',
      role: 'RolInventado',
    })
    expect(badRole.error).toBeTruthy()
    expect(ops).toHaveLength(0)

    const ok = await repo.upsertProfile({
      id: validUuid,
      email: 'test@aloncar.com',
      full_name: 'Andrés Vanoli',
      role: 'Supervisor',
    })
    expect(ok.error).toBe(null)
    expect(ops.find((o) => o[0] === 'upsert')[2]).toEqual({ onConflict: 'id' })

    const found = await repo.getByUserId(validUuid)
    expect(found.error).toBe(null)
    expect(found.data.email).toBe('test@aloncar.com')
  })
})
