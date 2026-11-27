import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { validatePayload } from '../../src/schemas/index.js'
import { ContractorPrcRegistrySchema, PRC_MIN_NUMBER } from '../../src/schemas/prcRegistry.schema.js'
import {
  formatPrcNumberLabel,
  formatPrcAdditionalLabel,
  isEligibleContractorForPrc,
  getEligiblePrcContractors,
  enrichPrcRegistryRows,
  filterPrcRegistryRows,
  parsePrcInteger,
  buildPrcLookupMaps,
  resolvePrcForWorkItem,
  resolvePrcForThirdPartyService,
  evaluateWorkItemPrcEligibility,
} from '../../src/lib/prcRegistryRules.js'
import {
  NAVIGATION_MODULES,
  getVisibleNavigationModules,
} from '../../src/lib/navigationCatalog.js'
import {
  getModuleSelectionState,
  toggleSubmodulePermission,
  toggleModulePermission,
  isRouteAllowed,
  resolveUserCapabilities,
} from '../../src/lib/permissionsEngine.js'

describe('Base de datos de PRC (#2000+) y permisos privados (Etapa 1)', () => {
  it('valida esquema Zod y bloquea columnas trampa en contractor_prc_registry', () => {
    const ok = validatePayload(ContractorPrcRegistrySchema, {
      prc_number: 2000,
      contractor_name: 'TANO',
      amount_ars: 1500000,
      status: 'ACTIVO',
    })
    expect(ok.success).toBe(true)

    const belowMin = validatePayload(ContractorPrcRegistrySchema, {
      prc_number: PRC_MIN_NUMBER - 1,
      contractor_name: 'TANO',
    })
    expect(belowMin.success).toBe(false)

    const annulNoReason = validatePayload(ContractorPrcRegistrySchema, {
      contractor_name: 'TANO',
      status: 'ANULADO',
      annulled_reason: '',
    })
    expect(annulNoReason.success).toBe(false)

    const trap = validatePayload(ContractorPrcRegistrySchema, {
      contractor_name: 'TANO',
      notes: 'trampa',
      numero_prc: 2001,
    })
    expect(trap.success).toBe(false)
    expect(trap.error).toContain('notes')
  })

  it('excluye personal propio ASTILLERO y acepta contratistas externos', () => {
    expect(isEligibleContractorForPrc({ id: 'w1', name: 'Alanis, Carlos', admin_center: 'ASTILLERO' }).eligible).toBe(false)
    expect(isEligibleContractorForPrc({ id: 'w2', name: 'TANO', admin_center: 'CONTRATISTA' }).eligible).toBe(true)

    const eligible = getEligiblePrcContractors([
      { id: 'w1', name: 'Alanis, Carlos', work_group: 'ASTILLERO', admin_center: 'ASTILLERO', status: 'ACTIVO' },
      { id: 'w2', name: 'Tano Oficial', work_group: 'TANO', admin_center: 'CONTRATISTA', status: 'ACTIVO' },
      { id: 'w3', name: 'Tano Ayudante', work_group: 'TANO', admin_center: 'CONTRATISTA', status: 'ACTIVO' },
      { id: 'w4', name: 'Viejo', work_group: 'VIEJO', admin_center: 'CONTRATISTA', status: 'INACTIVO' },
    ])
    expect(eligible.map((c) => c.name)).toEqual(['TANO'])
  })

  it('enriquece adicionales vinculados, anulados tachados y filtros de planilla', () => {
    const prcs = [
      { id: 'p1', prc_number: 2000, issue_date: '2026-11-25', contractor_name: 'RAMON ARANDA', ship_id: 's1', work_order_id: 'wo1', description: 'Galpon principal', amount_ars: 6000000, amount_usd: 4000, status: 'ACTIVO' },
      { id: 'p2', prc_number: 2001, issue_date: '2026-11-26', contractor_name: 'RAMON ARANDA', ship_id: 's1', work_order_id: 'wo1', description: 'Adicional estructura', amount_ars: 1500000, amount_usd: 1000, status: 'ANULADO', parent_prc_id: 'p1', parent_prc_number: 2000, annulled_reason: 'Duplicado' },
    ]
    const enriched = enrichPrcRegistryRows(prcs, {
      ships: [{ id: 's1', name: 'NONO PASCUAL' }],
      workOrders: [{ id: 'wo1', ot_number: '3', title: 'CAMBIO CHAPA' }],
    })

    expect(formatPrcNumberLabel(enriched[0].prc_number)).toBe('PRC #2000')
    expect(enriched[0].additionalsNumbers).toEqual([2001])
    expect(enriched[0].additionalsCount).toBe(1)
    expect(formatPrcAdditionalLabel(enriched[1])).toBe('Adicional al PRC #2000')
    expect(enriched[1].isAnnulled).toBe(true)

    expect(filterPrcRegistryRows(enriched, { searchTerm: '2001' }).map((r) => r.prc_number)).toEqual([2001])
    expect(filterPrcRegistryRows(enriched, { searchTerm: '25/11/2026' }).map((r) => r.prc_number)).toEqual([2000])
    expect(filterPrcRegistryRows(enriched, { statusFilter: 'ANULADO' }).map((r) => r.prc_number)).toEqual([2001])
  })

  it('blinda terceros.base_prc exclusivamente para María José, Graciela y Admin', () => {
    const tercerosMod = NAVIGATION_MODULES.find((m) => m.id === 'terceros')
    expect(getModuleSelectionState(['terceros'], tercerosMod)).toMatchObject({
      mode: 'partial',
      enabledCount: 2,
      totalCount: 3,
    })
    expect(toggleSubmodulePermission(['terceros'], tercerosMod, 'base-prc')).toEqual(['terceros', 'terceros.base_prc'])
    expect(toggleModulePermission(['terceros', 'terceros.base_prc'], tercerosMod)).toEqual([])
    expect(toggleModulePermission([], tercerosMod)).toEqual(['terceros'])

    const jefeNav = getVisibleNavigationModules({
      profile: { role: 'Supervisor', role_key: 'JEFE_OBRA_OMAR' },
      allowedSections: ['dashboard', 'terceros'],
    })
    expect(jefeNav.find((m) => m.id === 'terceros').children.map((c) => c.id)).toEqual([
      'servicios',
      'cuentas-corrientes',
    ])

    const mariaNav = getVisibleNavigationModules({
      profile: { role: 'Supervisor', role_key: 'LIQUIDACION_SUELDOS' },
      allowedSections: ['dashboard', 'terceros', 'terceros.base_prc'],
    })
    expect(mariaNav.find((m) => m.id === 'terceros').children.map((c) => c.id)).toEqual([
      'servicios',
      'cuentas-corrientes',
      'base-prc',
    ])

    const oficinaTecnica = { role_key: 'OFICINA_TECNICA', security_level: 'SUPERVISOR', allowed_sections: ['terceros'] }
    expect(isRouteAllowed('/terceros', 'base-prc', { orgRole: oficinaTecnica }).allowed).toBe(false)
    expect(resolveUserCapabilities(null, oficinaTecnica).canAccessPrcRegistry).toBe(false)
  })

  it('resuelve lookups de PRC, prioridad no-anulado, elegibilidad OT y cableado en Unificado/Terceros (Etapa 2)', () => {
    expect(parsePrcInteger('PRC #2004')).toBe(2004)
    expect(parsePrcInteger('1200')).toBeNull()

    const prcs = [
      { id: 'prc-ann', prc_number: 2000, status: 'ANULADO', work_item_id: 'wi-1', third_party_service_id: 'tp-1', contractor_name: 'TANO' },
      { id: 'prc-ok', prc_number: 2001, status: 'ACTIVO', work_item_id: 'wi-1', third_party_service_id: 'tp-1', contractor_name: 'TANO' },
      { id: 'prc-add', prc_number: 2002, status: 'ACTIVO', parent_prc_id: 'prc-ok', parent_prc_number: 2001, contractor_name: 'TANO' },
    ]
    const maps = buildPrcLookupMaps(prcs)
    const wiMatch = resolvePrcForWorkItem({ id: 'wi-1' }, maps)
    expect(wiMatch.hasOfficialPrc).toBe(true)
    expect(wiMatch.prc.prc_number).toBe(2001)
    expect(wiMatch.additionals.map((a) => a.prc_number)).toEqual([2002])

    const tpMatch = resolvePrcForThirdPartyService({ id: 'other', budget_number: '2001' }, maps)
    expect(tpMatch.prc?.id).toBe('prc-ok')

    const workers = [
      { id: 'w-ast', name: 'Alanis, Carlos', work_group: 'ASTILLERO', admin_center: 'ASTILLERO', status: 'ACTIVO' },
      { id: 'w-tano', name: 'Tano Oficial', work_group: 'TANO', admin_center: 'CONTRATISTA', status: 'ACTIVO' },
    ]
    expect(evaluateWorkItemPrcEligibility({ contractors: ['ASTILLERO.MECANICA'] }, workers).eligible).toBe(false)
    expect(evaluateWorkItemPrcEligibility({ contractors: ['TANO'] }, workers)).toMatchObject({
      eligible: true,
      contractorName: 'TANO',
      contractorWorkerId: 'w-tano',
    })

    const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
    const readSrc = (rel) => fs.readFileSync(path.join(appRoot, rel), 'utf8')
    expect(readSrc('src/pages/WorkOrders.jsx')).toContain('CanonicalPrcConfirmModal')
    expect(readSrc('src/components/workOrders/WorkOrdersUnificadoPanel.jsx')).toContain('CanonicalPrcBadge')
    expect(readSrc('src/components/workOrders/WorkOrdersTercerosPanel.jsx')).toContain('CanonicalPrcBadge')
    expect(readSrc('src/components/workOrders/WorkOrdersModals.jsx')).toContain('CanonicalPrcConfirmModal')
    expect(readSrc('src/pages/Terceros.jsx')).toContain('CanonicalPrcConfirmModal')
    expect(readSrc('src/components/terceros/TercerosFilasPanel.jsx')).toContain('CanonicalPrcBadge')
    expect(readSrc('src/components/terceros/TercerosFichasPanel.jsx')).toContain('CanonicalPrcBadge')
    expect(readSrc('src/components/terceros/TercerosModals.jsx')).toContain('CanonicalPrcConfirmModal')
  })
})
