/**
 * approvedFeatures.contract.test.js
 * Suite determinística de Contratos Funcionales Blindados (Candado #1 · 08_FEATURES_LOCK.md).
 *
 * Corre en < 1s dentro de `npm.cmd run check:hygiene` (0 tokens de IA).
 * Si un refactor o edición borra una columna, rompe un prop o reintroduce una columna trampa,
 * esta suite falla en rojo y frena la entrega antes de llegar al usuario.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import {
  PurchaseOrderSchema,
  WorkerSchema,
  LaborLogSchema,
  SystemSettingSchema,
  OrganizationRoleSchema,
  AuditLogSchema,
  validatePayload,
  validatePartialPayload,
} from '../../src/schemas/index.js'
import {
  filterCanonicalMaterials,
  buildCanonicalOtBadgeData,
  formatCanonicalMaterialStock,
} from '../../src/lib/canonicalHelpers.js'
import { buildContractorCostBaskets } from '../../src/lib/panolBasketsEngine.js'
import { purchaseOrdersRepository } from '../../src/repositories/purchaseOrdersRepository.js'
import { auditService } from '../../src/lib/auditService.js'
import { dispatchMandadosService } from '../../src/services/comprasAuxService.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const APP_DIR = path.resolve(__dirname, '../..')
const ROOT_DIR = path.resolve(APP_DIR, '..')
const LOCK_PATH = path.join(ROOT_DIR, 'docs/02_producto/estandares/08_FEATURES_LOCK.md')

function readRepoFile(relPath) {
  return fs.readFileSync(path.join(ROOT_DIR, relPath), 'utf8')
}

function parseFeaturesLockManifest() {
  const raw = fs.readFileSync(LOCK_PATH, 'utf8')
  const entries = []
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\|\s*(FL-\d+)\s*\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*(blindado|pendiente_fix)\s*\|\s*`?(FL-\d+)`?\s*\|/)
    if (m) {
      entries.push({
        id: m[1].trim(),
        module: m[2].trim(),
        summary: m[3].trim(),
        surface: m[4].trim(),
        status: m[5].trim(),
        testId: m[6].trim(),
      })
    }
  }
  return entries
}

const MANIFEST_ENTRIES = parseFeaturesLockManifest()
const STATUS_BY_ID = new Map(MANIFEST_ENTRIES.map((e) => [e.id, e.status]))

const COVERED_CONTRACT_IDS = new Set([
  'FL-001',
  'FL-002',
  'FL-003',
  'FL-004',
  'FL-005',
  'FL-006',
  'FL-007',
  'FL-008',
  'FL-009',
  'FL-010',
  'FL-011',
  'FL-012',
  'FL-013',
  'FL-014',
])

describe('Candado #1 — Contratos Funcionales Blindados (08_FEATURES_LOCK)', () => {
  it('FL-001: rechaza columnas trampa en esquemas Zod críticos (incluyendo purchase_orders.notes)', () => {
    const poTrap = validatePayload(PurchaseOrderSchema, {
      material_name_raw: 'ELECTRODO 6013',
      quantity: 10,
      status: 'PEDIR',
      notes: 'columna inexistente en Supabase',
    })
    expect(poTrap.success).toBe(false)
    expect(poTrap.error).toContain('notes')

    const poPartialTrap = validatePartialPayload(PurchaseOrderSchema, {
      status: 'RECIBIDO',
      notes: 'columna inexistente',
    })
    expect(poPartialTrap.success).toBe(false)
    expect(poPartialTrap.error).toContain('notes')

    const poValid = validatePayload(PurchaseOrderSchema, {
      material_name_raw: 'ELECTRODO 6013',
      quantity: 10,
      status: 'PEDIR',
      observations: 'Solicitud directa generada desde Pañol',
    })
    expect(poValid.success).toBe(true)

    expect(validatePayload(WorkerSchema, { name: 'TEST', first_name: 'X' }).success).toBe(false)
    expect(validatePayload(LaborLogSchema, { profile_id: 'x', hours_worked: 4 }).success).toBe(false)
    expect(validatePayload(SystemSettingSchema, { id: '1', key: 'k', value: {} }).success).toBe(false)
    expect(validatePayload(OrganizationRoleSchema, { id: '1', role_key: 'r', role_title: 't' }).success).toBe(false)
    expect(validatePayload(AuditLogSchema, { entity: 'x', action: 'UPDATE' }).success).toBe(false)
  })

  it('FL-002: CanonicalOtBadge garantiza vista flotante (tooltip) enriquecida para toda OT y estado Sin OT', () => {
    const withWo = buildCanonicalOtBadgeData({
      wo: { id: 'wo-1', ot_number: '104', title: 'CAMBIO CHAPA CASCO', description: 'Chapa naval 8mm babor', foreman_name: 'CAMADELLI' },
      ship: { id: 'ship-1', name: 'BP ALFA' },
      workItems: [],
      workOrders: [],
    })
    expect(withWo.hasWo).toBe(true)
    expect(withWo.otNumber).toBe('104')
    expect(withWo.tooltip).toContain('OT #104')
    expect(withWo.tooltip).toContain('CAMBIO CHAPA CASCO')
    expect(withWo.tooltip).toContain('BP ALFA')

    const sinWo = buildCanonicalOtBadgeData({ wo: null })
    expect(sinWo.hasWo).toBe(false)
    expect(sinWo.tooltip).toContain('Sin OT')

    const badgeSrc = readRepoFile('app/src/components/canonical/CanonicalOtBadge.jsx')
    expect(badgeSrc).toContain('buildCanonicalOtBadgeData')
    expect(badgeSrc).toContain('title={data.tooltip}')
  })

  it('FL-003: CanonicalMaterialPicker filtra sin tildes/mayúsculas, prioriza startsWith y formatea stock', () => {
    const catalog = [
      { id: 'm1', name: 'OXIGENO TUBO 10M3', rubro: 'GASES', category: 'GASES', current_stock: 12, minimum_stock: 4, requires_stock_control: true, unit_measure: 'tubo' },
      { id: 'm2', name: 'CHAPA NAVAL 8MM', rubro: 'ACERO', category: 'MATERIALES', current_stock: 2, minimum_stock: 5, requires_stock_control: true, unit_measure: 'unidad' },
      { id: 'm3', name: 'DISCO CORTE CHAPA 7"', rubro: 'ABRASIVOS', category: 'CONSUMIBLES', current_stock: 0, minimum_stock: 0, requires_stock_control: false, unit_measure: 'unidad' },
    ]

    const resChapa = filterCanonicalMaterials(catalog, 'chapa')
    expect(resChapa.map((m) => m.id)).toEqual(['m2', 'm3'])

    const resRubro = filterCanonicalMaterials(catalog, 'oxígeno')
    expect(resRubro.map((m) => m.id)).toEqual(['m1'])

    expect(formatCanonicalMaterialStock(catalog[0]).tone).toBe('ok')
    expect(formatCanonicalMaterialStock(catalog[1]).isCritical).toBe(true)
    expect(formatCanonicalMaterialStock(catalog[2]).label).toBe('S/C')

    const pickerSrc = readRepoFile('app/src/components/canonical/CanonicalMaterialPicker.jsx')
    expect(pickerSrc).toContain('createPortal')
    expect(pickerSrc).toContain('filterCanonicalMaterials')
    expect(pickerSrc).toContain('ArrowDown')
  })

  it('FL-004: PanolCatalogGrid conserva todas las columnas canónicas de Catálogo & Stock', () => {
    const src = readRepoFile('app/src/components/panol/PanolCatalogGrid.jsx')
    const requiredHeaders = [
      'Material / Insumo',
      'Rubro Técnico',
      'Categoría',
      'Unidad',
      'Peso (kg)',
      'Stock Actual',
      'Stock Mín.',
      'Lleva Stock',
      '% Seg. Naval',
      'Acciones',
    ]
    for (const header of requiredHeaders) {
      expect(src).toContain(header)
    }
  })

  it('FL-005: BatchOrderWhatsAppModal + emitWhatsAppOrdersService actualizan estado a PEDIDO y auditan', () => {
    const serviceSrc = readRepoFile('app/src/services/comprasAuxService.js')
    expect(serviceSrc).toContain("status: 'PEDIDO'")
    expect(serviceSrc).toContain('auditService.logRowAction')

    const modalSrc = readRepoFile('app/src/components/compras/BatchOrderWhatsAppModal.jsx')
    expect(modalSrc).toContain('emitWhatsAppOrdersService')
  })

  it('FL-006: ContractorPickerModal preserva fallback seguro cuando no hay OT o contratistas filtrados', () => {
    const src = readRepoFile('app/src/components/ContractorPickerModal.jsx')
    expect(src).toContain('isOtBlank')
    expect(src).toContain('contractorGroups')
    expect(src).toContain('astilleroWorkers')
  })

  it('FL-007: repo-hygiene.mjs ejecuta la compuerta de límite de repositorios (cero bypass Supabase)', () => {
    const hygieneSrc = readRepoFile('app/scripts/repo-hygiene.mjs')
    expect(hygieneSrc).toContain('checkRepositoryBoundary')
    expect(hygieneSrc).toContain('DIRECT_DB_ACCESS_RE')
  })

  it('FL-008: paridad 1:1 entre todos los contratos "blindado" en 08_FEATURES_LOCK.md y esta suite', () => {
    expect(MANIFEST_ENTRIES.length).toBeGreaterThanOrEqual(8)
    const lockedIds = MANIFEST_ENTRIES.filter((e) => e.status === 'blindado').map((e) => e.id)
    for (const id of lockedIds) {
      expect(COVERED_CONTRACT_IDS.has(id)).toBe(true)
    }
  })

  // ============================================================================
  // CONTRATOS BLINDADOS DE REGRESIONES REPARADAS (FL-009..FL-013)
  // ============================================================================

  it('FL-009: botón 🛒 en Pañol Planilla abre QuickPurchaseModal (isOpen: true) y usa observations', () => {
    expect(STATUS_BY_ID.get('FL-009')).toBe('blindado')
    const panolSrc = readRepoFile('app/src/pages/Panol.jsx')
    const movSrc = readRepoFile('app/src/components/panol/PanolMovimientosPanel.jsx')
    const svcSrc = readRepoFile('app/src/lib/panolService.js')
    const auxSvcSrc = readRepoFile('app/src/services/comprasAuxService.js')
    expect(panolSrc).toContain("isOpen: true, urgency: 'SIN_APURO'")
    expect(movSrc).toContain("isOpen: true, urgency: 'SIN_APURO'")
    expect(svcSrc).toContain("observations: 'Solicitud directa generada desde Pañol'")
    expect(svcSrc).not.toMatch(/notes:\s*['"]Solicitud directa generada desde Pañol['"]/)
    expect(auxSvcSrc).not.toMatch(/\bnotes:\s*`(?:Saldo faltante|\$\{order\.notes)/)
    expect(auxSvcSrc).toContain('order.observations')
  })

  it('FL-010: Compras alta desde ?nuevo=true evalúa editingOrder?.id y limpia searchParams', () => {
    expect(STATUS_BY_ID.get('FL-010')).toBe('blindado')
    const modalsSrc = readRepoFile('app/src/components/compras/ComprasPedidosModals.jsx')
    const formSrc = readRepoFile('app/src/components/compras/OrderFormModal.jsx')
    const pageSrc = readRepoFile('app/src/pages/Compras.jsx')
    expect(modalsSrc).toContain('editingOrder?.id')
    expect(formSrc).toContain("order?.id ? 'Editar Pedido de Compra'")
    expect(formSrc).toContain("order?.id ? 'Actualizar Pedido'")
    expect(pageSrc).toContain("['nuevo', 'materialId', 'materialName', 'multiMaterials']")
    expect(pageSrc).toContain('{ replace: true }')
  })

  it('FL-011: PanolMovimientosPanel muestra Columna A de Stock del material con semáforo y colSpan=12', () => {
    expect(STATUS_BY_ID.get('FL-011')).toBe('blindado')
    const movSrc = readRepoFile('app/src/components/panol/PanolMovimientosPanel.jsx')
    expect(movSrc).toMatch(/<th[^>]*>[^<]*Stock/i)
    expect(movSrc).toContain('colSpan={12}')
    expect(movSrc).toContain('requires_stock_control')
    expect(movSrc).toContain('formatUnitMeasureShort')
    expect(movSrc).toContain("'S/C'")
  })

  it('FL-012: Planilla Pañol usa CanonicalMaterialPicker (sin UUID/datalist) y Canasta usa tooltip flotante de OT', () => {
    expect(STATUS_BY_ID.get('FL-012')).toBe('blindado')
    const movSrc = readRepoFile('app/src/components/panol/PanolMovimientosPanel.jsx')
    const mostradorSrc = readRepoFile('app/src/components/panol/PanolMostradorRapidoPanel.jsx')
    const cardSrc = readRepoFile('app/src/components/panol/PanolBasketFastEntryCard.jsx')
    expect(movSrc).toContain('CanonicalMaterialPicker')
    expect(movSrc).not.toContain('panol-materials-datalist')
    expect(movSrc).toContain("colDef.key === 'material_id'")
    expect(mostradorSrc).toContain('CanonicalOtBadge')
    expect(mostradorSrc).toContain('basket.otTooltip')
    expect(cardSrc).toContain('CanonicalOtBadge')
    expect(cardSrc).toContain('basket.otTooltip')

    const board = buildContractorCostBaskets({
      workers: [{ id: 'w1', name: 'PEREZ', work_group: 'TALLER SUR', admin_center: 'CONTRATISTA', status: 'ACTIVO', can_withdraw_materials: true }],
      ships: [{ id: 's1', name: 'BP ALFA' }],
      workOrders: [{ id: 'wo1', ship_id: 's1', ot_number: '205', title: 'REPARACION TIMON', foreman_name: 'CAMADELLI', status: 'En ejecución' }],
      workItems: [{ id: 'wi1', work_order_id: 'wo1', description: 'Desmontaje pala timón', contractors: ['TALLER SUR'], foreman_name: 'CAMADELLI', status: 'En ejecución' }],
      inventoryTx: [],
      materials: [],
    })
    const basket = board.activeContractors[0]?.shipGroups[0]?.baskets[0]
    expect(basket?.otTooltip).toContain('OT #205: REPARACION TIMON')
    expect(basket?.otTooltip).toContain('Desmontaje pala timón')
  })

  it('FL-013: MandadosModal y dispatchMandadosService pasan a PEDIDO (preservando PEDIDO INCOMPLETO) y auditan', async () => {
    expect(STATUS_BY_ID.get('FL-013')).toBe('blindado')
    const mandadosSrc = readRepoFile('app/src/components/compras/MandadosModal.jsx')
    const modalsSrc = readRepoFile('app/src/components/compras/ComprasPedidosModals.jsx')
    expect(mandadosSrc).toContain("status: 'PEDIDO'")
    expect(modalsSrc).toContain("'PEDIDO INCOMPLETO'")

    const origUpdateByIds = purchaseOrdersRepository.updateByIds
    const origAuditRow = auditService.logRowAction
    const batchCalls = []
    const auditCalls = []
    try {
      purchaseOrdersRepository.updateByIds = async (ids, patch) => {
        batchCalls.push({ ids, patch })
        return { data: ids, error: null }
      }
      auditService.logRowAction = async (entry) => {
        auditCalls.push(entry)
      }

      const res = await dispatchMandadosService({
        dispatchedIds: ['id-pedir', 'id-aprob', 'id-incomp'],
        dispatchInfo: { courier_dispatched: true, courier_dispatched_at: '2026-11-20T16:00:00.000Z', status: 'PEDIDO' },
        candidateOrders: [
          { id: 'id-pedir', status: 'PEDIR', material_name_raw: 'BULON' },
          { id: 'id-aprob', status: 'COTIZA.APROBADA', material_name_raw: 'DISCO' },
          { id: 'id-incomp', status: 'PEDIDO INCOMPLETO', material_name_raw: 'ELECTRODO' },
        ],
        workerName: 'Mandadero',
      })

      expect(res.statusById).toEqual({
        'id-pedir': 'PEDIDO',
        'id-aprob': 'PEDIDO',
        'id-incomp': 'PEDIDO INCOMPLETO',
      })
      expect(batchCalls).toHaveLength(2)
      expect(batchCalls[0].ids).toEqual(['id-pedir', 'id-aprob'])
      expect(batchCalls[0].patch.status).toBe('PEDIDO')
      expect(batchCalls[1].ids).toEqual(['id-incomp'])
      expect(batchCalls[1].patch.status).toBe('PEDIDO INCOMPLETO')
      expect(auditCalls).toHaveLength(3)
      expect(auditCalls[0].details.newStatus).toBe('PEDIDO')
      expect(auditCalls[2].details.newStatus).toBe('PEDIDO INCOMPLETO')
    } finally {
      purchaseOrdersRepository.updateByIds = origUpdateByIds
      auditService.logRowAction = origAuditRow
    }
  })

  it('FL-014: MultiWithdrawalModal usa stepper vertical, miniatura 5cm×5cm, CanonicalMaterialPicker y selector OT solo tooltip flotante', () => {
    expect(STATUS_BY_ID.get('FL-014')).toBe('blindado')
    const modalSrc = readRepoFile('app/src/components/panol/MultiWithdrawalModal.jsx')
    const destSrc = readRepoFile('app/src/components/panol/MultiWithdrawalDestinationStep.jsx')
    const itemsSrc = readRepoFile('app/src/components/panol/MultiWithdrawalItemsStep.jsx')
    const thumbSrc = readRepoFile('app/src/components/panol/MaterialThumbnailZoom.jsx')
    const otSelSrc = readRepoFile('app/src/components/workOrders/WorkOrderSelectorWithHover.jsx')
    const basketCardSrc = readRepoFile('app/src/components/panol/PanolBasketFastEntryCard.jsx')

    expect(modalSrc).toContain('StepHelpBadge')
    expect(modalSrc).toContain('PANOL_WITHDRAWAL_STEP_HELP')
    expect(modalSrc).toContain('MultiWithdrawalItemsStep')
    expect(modalSrc).not.toContain('WorkOrderScopeHoverCard')
    expect(destSrc).toContain('WorkOrderSelectorWithHover')
    expect(destSrc).toContain('showPreviewCard={false}')
    expect(itemsSrc).toContain('MaterialThumbnailZoom')
    expect(itemsSrc).toContain('CanonicalMaterialPicker')

    expect(thumbSrc).toContain("width: '5cm'")
    expect(thumbSrc).toContain("height: '5cm'")
    expect(thumbSrc).toContain('createPortal')

    expect(otSelSrc).toContain('CanonicalOtBadge')
    expect(otSelSrc).toContain('buildCanonicalOtBadgeData')
    expect(otSelSrc).toContain('showPreviewCard = false')
    expect(otSelSrc).toContain('title={woBadge.tooltip}')

    expect(basketCardSrc).toContain('MaterialThumbnailZoom')
    expect(basketCardSrc).toContain('CanonicalMaterialPicker')
  })
})
