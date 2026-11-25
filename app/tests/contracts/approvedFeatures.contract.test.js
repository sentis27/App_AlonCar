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
  formatCanonicalOtNumberLabel,
  formatCanonicalMaterialStock,
} from '../../src/lib/canonicalHelpers.js'
import { buildContractorCostBaskets } from '../../src/lib/panolBasketsEngine.js'
import { purchaseOrdersRepository } from '../../src/repositories/purchaseOrdersRepository.js'
import { auditService } from '../../src/lib/auditService.js'
import { dispatchMandadosService } from '../../src/services/comprasAuxService.js'
import { computeStepHelpPosition } from '../../src/lib/stepHelpPosition.js'
import { BUSINESS_HELP_REGISTRY, exportBusinessHelpForAI } from '../../src/lib/businessHelpRegistry.js'
import {
  NAVIGATION_MODULES,
  resolveModuleTab,
  buildSubmoduleUrl,
  getVisibleNavigationModules,
  resolveUserRolePerspective,
} from '../../src/lib/navigationCatalog.js'
import {
  normalizeAllowedSections,
  getModuleSelectionState,
  toggleModulePermission,
  toggleSubmodulePermission,
  isRouteAllowed,
  resolveUserCapabilities,
} from '../../src/lib/permissionsEngine.js'
import {
  CLEAR_FILTER_BTN_CLASS,
  resolveGridHistoryControl,
} from '../../src/lib/filterThemeConstants.js'
import {
  getTodayArIso,
  formatDateAr,
  formatDateTimeAr,
  buildArTimestampIso,
} from '../../src/lib/dateTimeCanonical.js'
import { matchesUniversalSearch } from '../../src/lib/searchEngine.js'
import {
  enrichLaborLogs,
  computeShipManagerialSummary,
} from '../../src/lib/managerialSummaryService.js'
import { computeHorasKpis, filterResumenLaborRows } from '../../src/lib/resumenHojaFilters.js'
import { buildHoursHoverSummary } from '../../src/lib/resumenCostHoverHelpers.js'
import { computeOtUnvaluedBreakdown } from '../../src/lib/billingSheetMath.js'

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
  'FL-015',
  'FL-016',
  'FL-017',
  'FL-018',
  'FL-019',
  'FL-020',
  'FL-021',
  'FL-022',
  'FL-023',
  'FL-024',
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

  it('FL-004: PanolCatalogGrid conserva todas las columnas canónicas de Catálogo & Stock + Precios y (?) solo Admin', () => {
    const src = readRepoFile('app/src/components/panol/PanolCatalogGrid.jsx')
    const modalSrc = readRepoFile('app/src/components/panol/MaterialCatalogFormModal.jsx')
    const requiredHeaders = [
      'Material / Insumo',
      'Rubro Técnico',
      'Categoría',
      'Unidad',
      'Peso (kg)',
      'Stock Actual',
      'Stock Mín.',
      'Lleva Stock',
      'Precio AR$',
      '% Seg. Naval',
      'Costo US$',
      'Acciones',
    ]
    for (const header of requiredHeaders) {
      expect(src).toContain(header)
    }
    expect(src).toContain('CanonicalPriceHelpBadge')
    expect(src).toContain('{isAdmin && <CatalogPriceArsCell')
    expect(src).toContain('{isAdmin && <CatalogPriceUsdCell')
    expect(modalSrc).toContain('{isAdmin && (')
    expect(modalSrc).toContain('CanonicalPriceHelpBadge')
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

  it('FL-011: PanolMovimientosPanel muestra Stock, orden Fecha->Barco->OT->Contratista->Material->Cant->Peso, Costo/Centro solo Admin, colSpan dinámico y filtro Sin Valor', () => {
    expect(STATUS_BY_ID.get('FL-011')).toBe('blindado')
    const movSrc = readRepoFile('app/src/components/panol/PanolMovimientosPanel.jsx')
    const toolbarSrc = readRepoFile('app/src/components/panol/PanolToolbar.jsx')
    expect(movSrc).toMatch(/<th[^>]*>[^<]*Stock/i)
    expect(movSrc).toContain('Nº Remito ✎')
    expect(movSrc).toContain('totalColSpan = isAdmin ? 14 : 12')
    expect(movSrc).toContain('colSpan={totalColSpan}')
    expect(movSrc).toContain('requires_stock_control')
    expect(movSrc).toContain('formatUnitMeasureShort')
    expect(movSrc).toContain("'S/C'")
    expect(movSrc).toContain('{isAdmin && <th')
    expect(movSrc).toContain('Costo US$')
    expect(movSrc).toContain('Centro de Costo ✎')
    expect(movSrc.indexOf('Contratista / Grupo ✎')).toBeGreaterThan(movSrc.indexOf('Orden de Trabajo (OT) ✎'))
    expect(movSrc.indexOf('Material Insumo ✎')).toBeGreaterThan(movSrc.indexOf('Contratista / Grupo ✎'))
    expect(toolbarSrc).toContain('Sin Valor ($0)')
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

  it('FL-015: Compras usa CanonicalOtBadge, WorkOrderSelectorWithHover y CanonicalMaterialPicker sin datalist legacy', () => {
    expect(STATUS_BY_ID.get('FL-015')).toBe('blindado')
    expect(formatCanonicalOtNumberLabel('OT-104')).toBe('OT-104')
    expect(formatCanonicalOtNumberLabel('104')).toBe('OT #104')
    expect(buildCanonicalOtBadgeData({ wo: null, otNumber: 'Sin OT' }).hasWo).toBe(false)

    const tableSrc = readRepoFile('app/src/components/compras/ComprasPedidosTable.jsx')
    const rowSrc = readRepoFile('app/src/components/compras/ComprasPedidoRow.jsx')
    const cellsSrc = readRepoFile('app/src/components/compras/ComprasRowCells.jsx')
    const modalSrc = readRepoFile('app/src/components/compras/OrderFormModal.jsx')
    const mutSrc = readRepoFile('app/src/hooks/useComprasPedidosMutations.js')

    expect(tableSrc).not.toContain('compras-materials-datalist')
    expect(rowSrc).toContain('CanonicalOtBadge')
    expect(cellsSrc).toContain('CanonicalMaterialPicker')
    expect(cellsSrc).toContain('allowFreeText')
    expect(modalSrc).toContain('WorkOrderSelectorWithHover')
    expect(modalSrc).toContain('CanonicalMaterialPicker')
    expect(modalSrc).toContain('allowFreeText')
    expect(mutSrc).toContain('material_id:')
  })

  it('FL-016: Terceros renderiza OTs vía CanonicalOtBadge en grilla, fichas y auditoría', () => {
    expect(STATUS_BY_ID.get('FL-016')).toBe('blindado')
    const pageSrc = readRepoFile('app/src/pages/Terceros.jsx')
    const filasSrc = readRepoFile('app/src/components/terceros/TercerosFilasPanel.jsx')
    const fichasSrc = readRepoFile('app/src/components/terceros/TercerosFichasPanel.jsx')
    const modalsSrc = readRepoFile('app/src/components/terceros/TercerosModals.jsx')

    expect(pageSrc).toContain('workOrders={workOrders} workItems={workItems}')
    expect(filasSrc).toContain('CanonicalOtBadge')
    expect(fichasSrc).toContain('CanonicalOtBadge')
    expect(modalsSrc).toContain('CanonicalOtBadge')
    expect(modalsSrc).toContain('WorkOrderSelectorWithHover')
  })

  it('FL-017: Horas usa CanonicalOtBadge en vistas/grillas y WorkOrderSelectorWithHover en selectores de OT', () => {
    expect(STATUS_BY_ID.get('FL-017')).toBe('blindado')
    const rowSrc = readRepoFile('app/src/components/labor/LaborLogsTableRow.jsx')
    const dailySrc = readRepoFile('app/src/components/labor/LaborControlDiarioPanel.jsx')
    const sabanaSrc = readRepoFile('app/src/components/labor/LaborSabanaPanel.jsx')
    const modalsSrc = readRepoFile('app/src/components/labor/LaborModals.jsx')
    const cascadeSrc = readRepoFile('app/src/components/labor/LaborCascadeHeader.jsx')
    const crewRowSrc = readRepoFile('app/src/components/labor/LaborCrewRow.jsx')
    const clockSrc = readRepoFile('app/src/components/labor/LaborClockAssignSheet.jsx')

    expect(rowSrc).toContain('CanonicalOtBadge')
    expect(dailySrc).toContain('CanonicalOtBadge')
    expect(sabanaSrc).toContain('CanonicalOtBadge')
    expect(modalsSrc).toContain('CanonicalOtBadge')
    expect(cascadeSrc).toContain('WorkOrderSelectorWithHover')
    expect(crewRowSrc).toContain('WorkOrderSelectorWithHover')
    expect(clockSrc).toContain('WorkOrderSelectorWithHover')
  })

  it('FL-018: Resumen Gerencial usa CanonicalOtBadge con tooltip consolidado en todas sus vistas sin exceder 250L en página', () => {
    expect(STATUS_BY_ID.get('FL-018')).toBe('blindado')
    const pageSrc = readRepoFile('app/src/pages/ResumenGerencial.jsx')
    expect(pageSrc.trimEnd().split(/\r?\n/).length).toBeLessThanOrEqual(250)

    const svcSrc = readRepoFile('app/src/lib/managerialSummaryService.js')
    expect(svcSrc).toContain('formatWorkOrderTooltipCanonical')
    expect(svcSrc).toContain('canonicalTooltip:')

    const surfaces = [
      'app/src/components/resumenGerencial/ResumenOtDetailStrip.jsx',
      'app/src/components/resumenGerencial/ResumenCostosMobileView.jsx',
      'app/src/components/resumenGerencial/ResumenMatrizOtsPanel.jsx',
      'app/src/components/resumenGerencial/ResumenHojaMaterialesPanel.jsx',
      'app/src/components/resumenGerencial/ResumenHojaHorasPanel.jsx',
      'app/src/components/resumenGerencial/ResumenHojaTercerosPanel.jsx',
      'app/src/components/resumenGerencial/BillingRightCostCard.jsx',
      'app/src/components/resumenGerencial/ComparadorNivel2OtTable.jsx',
    ]
    for (const rel of surfaces) {
      expect(readRepoFile(rel)).toContain('CanonicalOtBadge')
    }
  })

  it('FL-019: Pieza Replicable OT en 3 Capas (Datos Canónicos + Reglas Únicas + UI Pañol/Módulos)', () => {
    expect(STATUS_BY_ID.get('FL-019')).toBe('blindado')

    // Capa 1: Todos los módulos operativos usan la consulta canónica única de OTs y subtareas
    const services = [
      'app/src/services/comprasService.js',
      'app/src/lib/tercerosService.js',
      'app/src/services/laborService.js',
      'app/src/lib/panolService.js',
      'app/src/lib/shipsService.js',
      'app/src/services/shipsService.js',
    ]
    for (const rel of services) {
      const src = readRepoFile(rel)
      expect(src).toContain('listCanonicalWorkOrders')
      expect(src).toContain('listCanonicalWorkItems')
    }

    // Capa 2: Tooltip sin doble OT #OT-, con estado de OT y ❌ + tachado en los 4 estados cerrados (con [Estado] visible)
    const badge = buildCanonicalOtBadgeData({
      wo: { id: 'wo-3', ot_number: 'OT-3', title: 'CAMBIO CHAPA', status: 'En ejecución' },
      ship: { id: 's-1', name: 'NONO PASCUAL' },
      workItems: [
        { id: 'i1', work_order_id: 'wo-3', description: 'Parche casco', contractors: ['TANO'], foreman_name: 'HUGO', status: 'Finalizado' },
        { id: 'i2', work_order_id: 'wo-3', description: 'Desmontar', contractors: ['CARPINTERIA'], foreman_name: 'MARTIN', status: 'En ejecución' },
        { id: 'i3', work_order_id: 'wo-3', description: 'Pocete chapa', contractors: ['TECO'], foreman_name: 'ALE C', status: 'Finalizado costo final de obra' },
      ],
      workOrders: [],
    })
    expect(badge.tooltip).toContain('OT-3: CAMBIO CHAPA [En ejecución]')
    expect(badge.tooltip).not.toContain('OT #OT-3')
    expect(badge.tooltip).toContain('❌')
    expect(badge.tooltip).toContain('[Finalizado]')
    expect(badge.tooltip).toContain('[Finalizado costo final de obra]')
    const tooltipLines = badge.tooltip.split('\n')
    const l1 = tooltipLines.find((l) => l.includes('[Finalizado]') && !l.includes('costo final'))
    const l2 = tooltipLines.find((l) => l.includes('[En ejecución]') && l.includes('L2:'))
    const l3 = tooltipLines.find((l) => l.includes('[Finalizado costo final de obra]'))
    expect(l1?.startsWith('❌ ')).toBe(true)
    expect(l2?.startsWith('• ')).toBe(true)
    expect(l3?.startsWith('❌ ')).toBe(true)

    // Capa 3: Pañol Planilla también usa CanonicalOtBadge
    expect(readRepoFile('app/src/components/panol/PanolMovimientosPanel.jsx')).toContain('<CanonicalOtBadge')
  })

  it('FL-020: Pieza Replicable Menús de Carga Zero-Scroll (Portal + Apertura Hacia Arriba + 7 Módulos)', () => {
    expect(STATUS_BY_ID.get('FL-020')).toBe('blindado')

    // Capa 1: Registro centralizado cubre todos los módulos operativos y exporta para IA
    const requiredHelpModules = [
      'panol_retiros',
      'panol_catalogo',
      'panol_gases',
      'labor_texto',
      'labor_cuadrilla',
      'labor_reloj',
      'labor_reloj_asignacion',
      'labor_edicion',
      'work_orders',
      'ot_catalog',
      'compras_pedidos',
      'compras_proveedores',
      'terceros_gastos',
      'personal_nomina',
      'ships_buques',
      'ships_estadias',
      'ships_armadores',
      'picker_ship_wo',
      'picker_contractor',
    ]
    for (const key of requiredHelpModules) {
      expect(BUSINESS_HELP_REGISTRY[key]).toBeDefined()
    }
    const aiEntries = exportBusinessHelpForAI()
    expect(aiEntries.length).toBeGreaterThanOrEqual(40)

    // Capa 2: Motor de posicionamiento abre hacia arriba en el último paso (sin empujar scroll)
    const lastStepPos = computeStepHelpPosition({
      rect: { top: 620, bottom: 648, left: 180, right: 208 },
      viewportWidth: 1366,
      viewportHeight: 768,
      isLastStep: true,
    })
    expect(lastStepPos.direction).toBe('up')
    expect(lastStepPos.bottom).toBeGreaterThanOrEqual(12)

    const topStepPos = computeStepHelpPosition({
      rect: { top: 140, bottom: 168, left: 180, right: 208 },
      viewportWidth: 1366,
      viewportHeight: 768,
      isLastStep: false,
    })
    expect(topStepPos.direction).toBe('down')

    // Capa 3: StepHelpBadge usa portal en document.body sin tooltip nativo blanco
    const badgeSrc = readRepoFile('app/src/components/canonical/StepHelpBadge.jsx')
    expect(badgeSrc).toContain('createPortal')
    expect(badgeSrc).toContain('computeStepHelpPosition')
    expect(badgeSrc).not.toContain('title={`Ayuda del Paso')

    // Todos los módulos con carga de datos y selectores rápidos por doble clic usan CanonicalStepperStep
    const stepperSurfaces = [
      'app/src/components/ShipWorkOrderPickerModal.jsx',
      'app/src/components/ContractorPickerModal.jsx',
      'app/src/components/panol/MultiWithdrawalModal.jsx',
      'app/src/components/panol/MaterialCatalogFormModal.jsx',
      'app/src/components/panol/GasSupplierMovementModal.jsx',
      'app/src/components/labor/LaborTextMessageModal.jsx',
      'app/src/components/labor/LaborCrewBatchModal.jsx',
      'app/src/components/labor/LaborClockAssignSheet.jsx',
      'app/src/components/labor/LaborFacialClockModal.jsx',
      'app/src/components/labor/LaborModals.jsx',
      'app/src/components/workOrders/WorkOrdersModals.jsx',
      'app/src/components/workOrders/OtCatalogEditor.jsx',
      'app/src/components/compras/OrderFormModal.jsx',
      'app/src/components/compras/ComprasProveedoresPanel.jsx',
      'app/src/components/terceros/TercerosModals.jsx',
      'app/src/components/personal/PersonalWorkerFormModal.jsx',
      'app/src/components/ships/ShipsModals.jsx',
    ]
    for (const rel of stepperSurfaces) {
      expect(readRepoFile(rel)).toContain('CanonicalStepperStep')
    }

    // Sin scroll horizontal forzado en Carga por Mensaje de Texto / Cuadrilla y portal en Proveedor Compras
    const crewGridSrc = readRepoFile('app/src/components/labor/LaborCrewGridSection.jsx')
    expect(crewGridSrc).not.toContain('min-w-[1220px]')
    expect(crewGridSrc).not.toContain('min-w-[980px]')
    expect(readRepoFile('app/src/components/compras/InlineSupplierPicker.jsx')).toContain('createPortal')
  })

  it('FL-021: blinda el Menú Lateral Acordeón 3 Capas y Zona 1 limpia (sin pestañas ni selectores manuales de Terminal/Rol)', () => {
    // Capa 1: Catálogo maestro con 11 módulos y 30 submódulos con permissionKey único
    expect(NAVIGATION_MODULES.length).toBe(11)
    const allChildren = NAVIGATION_MODULES.flatMap((m) => m.children || [])
    expect(allChildren.length).toBe(30)
    const permKeys = [
      ...NAVIGATION_MODULES.map((m) => m.permissionKey),
      ...allChildren.map((c) => c.permissionKey),
    ]
    expect(new Set(permKeys).size).toBe(permKeys.length)

    // Resolución de aliases y defaults seguros
    expect(resolveModuleTab('panol', 'movimientos')).toBe('planillas')
    expect(resolveModuleTab('panol', 'kardex')).toBe('planillas')
    expect(resolveModuleTab('panol', 'inexistente')).toBe('planillas')
    expect(resolveModuleTab('ots', '')).toBe('unificado')
    expect(resolveModuleTab('resumen-gerencial', 'remito')).toBe('remito')
    expect(resolveModuleTab('admin', null)).toBe('matriz')
    expect(buildSubmoduleUrl('/panol', 'catalogo')).toBe('/panol?tab=catalogo')

    // Filtrado por rol y soporte para allowedSections (Etapa 5)
    const operarioNav = getVisibleNavigationModules({ profile: { role: 'Operario' } })
    const comprasOperario = operarioNav.find((m) => m.id === 'compras')
    expect(comprasOperario.children).toEqual([])
    const restrictedNav = getVisibleNavigationModules({
      profile: { role: 'Supervisor' },
      allowedSections: ['panol.planillas', 'panol.catalogo', 'terceros'],
    })
    expect(restrictedNav.map((m) => m.id)).toEqual(['panol', 'terceros'])
    expect(restrictedNav[0].children.map((c) => c.id)).toEqual(['planillas', 'catalogo'])

    // Perspectiva automática derivada del usuario autenticado
    expect(resolveUserRolePerspective({ role: 'Supervisor' })).toBe('admin')
    expect(resolveUserRolePerspective({ role: 'Admin' })).toBe('admin')
    expect(resolveUserRolePerspective({ role: 'Operario' })).toBe('jefe_obra')
    expect(resolveUserRolePerspective({ role_key: 'DIRECCION_OPERACIONES' })).toBe('direccion')
    expect(resolveUserRolePerspective({ role_key: 'LIQUIDACION_SUELDOS' })).toBe('maria_jose')

    // Capa 2 + 3: Sidebar acordeón colapsable y 8 módulos sincronizados vía useModuleTab
    const sidebarSrc = readRepoFile('app/src/components/Sidebar.jsx')
    expect(sidebarSrc).toContain('CanonicalSidebarModuleGroup')
    expect(sidebarSrc).toContain('getVisibleNavigationModules')
    expect(sidebarSrc).toContain('aloncar_sidebar_collapsed')

    const accordionPages = [
      'app/src/pages/WorkOrders.jsx',
      'app/src/pages/LaborLogs.jsx',
      'app/src/pages/Panol.jsx',
      'app/src/pages/Compras.jsx',
      'app/src/pages/Personal.jsx',
      'app/src/pages/Ships.jsx',
      'app/src/pages/ResumenGerencial.jsx',
      'app/src/pages/AdminDashboard.jsx',
    ]
    for (const rel of accordionPages) {
      expect(readRepoFile(rel)).toContain('useModuleTab')
    }

    // Zona 1 limpia: indicador canónico presente y sin tiras de pestañas ni botones manuales de Terminal/Rol
    const cleanHeaders = [
      'app/src/components/workOrders/WorkOrdersHeader.jsx',
      'app/src/components/labor/LaborLogsHeader.jsx',
      'app/src/components/panol/PanolHeader.jsx',
      'app/src/pages/Compras.jsx',
      'app/src/pages/Personal.jsx',
      'app/src/pages/Ships.jsx',
      'app/src/components/resumenGerencial/ResumenGerencialHeader.jsx',
      'app/src/pages/AdminDashboard.jsx',
    ]
    for (const rel of cleanHeaders) {
      expect(readRepoFile(rel)).toContain('CanonicalActiveSubmoduleBadge')
    }
    expect(readRepoFile('app/src/components/terceros/TercerosHeader.jsx')).not.toContain('setActiveRolePerspective')
    expect(readRepoFile('app/src/pages/Terceros.jsx')).not.toContain('aloncar_terceros_terminal')
    expect(readRepoFile('app/src/pages/Ships.jsx')).not.toContain('setActiveRolePerspective')
    expect(readRepoFile('app/src/components/resumenGerencial/ResumenGerencialHeader.jsx')).not.toContain('Obra Filtrada:')
    expect(readRepoFile('app/src/pages/AdminDashboard.jsx')).not.toContain("setActiveTab('auditoria')")
  })

  it('FL-022: blinda el Motor Real de Permisos por Puesto (permissionsEngine ↔ AuthContext ↔ App ↔ Admin ↔ Login)', () => {
    // 1. Normalización de claves legacy de la matriz anterior
    expect(normalizeAllowedSections(['tarifario', 'analisis', 'tesoreria', 'invalida'])).toEqual([
      'personal.tarifario',
      'personal.analisis',
      'tesoreria',
    ])

    // 2. Toggle módulo completo vs. submódulos parciales (expansión y colapso automático)
    const personalMod = NAVIGATION_MODULES.find((m) => m.id === 'personal')
    expect(getModuleSelectionState(['personal'], personalMod).mode).toBe('full')
    const afterUncheckNomina = toggleSubmodulePermission(['personal'], personalMod, 'nomina')
    expect(afterUncheckNomina).toEqual(['personal.tarifario', 'personal.analisis'])
    expect(getModuleSelectionState(afterUncheckNomina, personalMod)).toMatchObject({
      mode: 'partial',
      enabledCount: 2,
      totalCount: 3,
    })
    const afterRecheckNomina = toggleSubmodulePermission(afterUncheckNomina, personalMod, 'nomina')
    expect(afterRecheckNomina).toEqual(['personal'])
    expect(toggleModulePermission(['personal'], personalMod)).toEqual([])

    // 3. Guardián de rutas y submódulos (?tab=): ejemplo Graciela (TESORERIA)
    const gracielaRole = {
      role_key: 'TESORERIA',
      security_level: 'AUDITOR',
      allowed_sections: ['dashboard', 'tesoreria', 'terceros', 'personal.tarifario', 'personal.analisis', 'horas.sabana_quincenal'],
    }
    expect(isRouteAllowed('/tesoreria', null, { orgRole: gracielaRole }).allowed).toBe(true)
    expect(isRouteAllowed('/admin', 'matriz', { orgRole: gracielaRole })).toMatchObject({ allowed: false, redirectTo: '/' })
    expect(isRouteAllowed('/horas', 'carga', { orgRole: gracielaRole })).toMatchObject({
      allowed: false,
      redirectTo: '/horas?tab=sabana_quincenal',
    })
    expect(isRouteAllowed('/horas', 'sabana_quincenal', { orgRole: gracielaRole }).allowed).toBe(true)

    // 4. Capacidades operativas automáticas por puesto
    const mariaCaps = resolveUserCapabilities(null, { role_key: 'LIQUIDACION_SUELDOS', security_level: 'SUPERVISOR', allowed_sections: ['terceros', 'compras'] })
    expect(mariaCaps.rolePerspective).toBe('maria_jose')
    expect(mariaCaps.canEditTercerosAmounts).toBe(true)
    expect(mariaCaps.canMutateTercerosRows).toBe(true)

    const jefeCaps = resolveUserCapabilities(null, { role_key: 'JEFE_OBRA_PABLO_N', security_level: 'SUPERVISOR', allowed_sections: ['terceros', 'compras.compras'] })
    expect(jefeCaps.rolePerspective).toBe('jefe_obra')
    expect(jefeCaps.canEditTercerosAmounts).toBe(false)
    expect(jefeCaps.canMutateTercerosRows).toBe(true)
    expect(jefeCaps.canUseComprasCompleteMode).toBe(false)

    const gracielaCaps = resolveUserCapabilities(null, gracielaRole)
    expect(gracielaCaps.rolePerspective).toBe('direccion')
    expect(gracielaCaps.canEditTercerosAmounts).toBe(false)
    expect(gracielaCaps.canMutateTercerosRows).toBe(false)

    // 5. Cableado en AuthContext, App, Sidebar, AdminRolesMatrixPanel y Login
    const authSrc = readRepoFile('app/src/context/AuthContext.jsx')
    expect(authSrc).toContain('organizationRolesRepository')
    expect(authSrc).toContain('signInAsRole')
    expect(authSrc).toContain('refreshPermissions')
    expect(readRepoFile('app/src/App.jsx')).toContain('isRouteAllowed')
    expect(readRepoFile('app/src/components/Sidebar.jsx')).toContain('allowedSections')
    const adminMatrixSrc = readRepoFile('app/src/components/admin/AdminRolesMatrixPanel.jsx')
    expect(adminMatrixSrc).toContain('NAVIGATION_MODULES')
    expect(adminMatrixSrc).toContain('RolePermissionsEditorBlock')
    expect(adminMatrixSrc).toContain('roleForm.email')
    expect(readRepoFile('app/src/pages/Login.jsx')).toContain('signInAsRole')
  })

  it('FL-023: blinda la Zona 3 Canónica en 3 capas (CanonicalZone3Toolbar + rojo carmín + cápsula fija Undo/Redo + 18 superficies)', () => {
    expect(STATUS_BY_ID.get('FL-023')).toBe('blindado')

    // Capa 1: Tokens y normalizador de historial
    expect(CLEAR_FILTER_BTN_CLASS).toContain('rose-')
    expect(CLEAR_FILTER_BTN_CLASS).not.toContain('ml-auto')
    expect(resolveGridHistoryControl({ canUndo: true, canRedo: false, undoStack: [1, 2], redoStack: [] })).toMatchObject({
      canUndo: true,
      canRedo: false,
      undoCount: 2,
      redoCount: 0,
    })

    // CrawlerSearchBar: la X interna limpia solo el texto (onChange('')), no onClear
    const crawlerSrc = readRepoFile('app/src/components/CrawlerSearchBar.jsx')
    expect(crawlerSrc).toMatch(/const handleClearClick = \(\) => \{\s*onChange\?\.\(''\)/)

    // Capa 2: Pieza visual única CanonicalZone3Toolbar
    const toolbarSrc = readRepoFile('app/src/components/canonical/CanonicalZone3Toolbar.jsx')
    expect(toolbarSrc).toContain('CLEAR_FILTER_BTN_CLASS')
    expect(toolbarSrc).toContain('ZONE3_UNDO_GROUP_CLASS')
    expect(toolbarSrc).toContain('ZONE3_VIEW_TOGGLE_GROUP_CLASS')

    // Capa 3: 18 superficies migradas sin alon-zone-toolbar artesanal
    const zone3Surfaces = [
      'app/src/components/labor/LaborLogsToolbar.jsx',
      'app/src/components/labor/LaborControlDiarioPanel.jsx',
      'app/src/components/compras/ComprasPedidosToolbar.jsx',
      'app/src/components/compras/ComprasProveedoresPanel.jsx',
      'app/src/components/compras/ComprasOcrPanel.jsx',
      'app/src/components/terceros/TercerosToolbar.jsx',
      'app/src/components/personal/PersonalNominaToolbar.jsx',
      'app/src/components/personal/PersonalTarifarioPanel.jsx',
      'app/src/components/panol/PanolToolbar.jsx',
      'app/src/components/workOrders/WorkOrdersToolbar.jsx',
      'app/src/components/ships/ShipsBarcosToolbar.jsx',
      'app/src/components/ships/ShipsEstadiasPanel.jsx',
      'app/src/components/ships/ShipsArmadoresPanel.jsx',
      'app/src/components/resumenGerencial/ResumenHojaMaterialesToolbar.jsx',
      'app/src/components/resumenGerencial/ResumenHojaHorasPanel.jsx',
      'app/src/components/resumenGerencial/ResumenHojaTercerosPanel.jsx',
      'app/src/components/tesoreria/TesoreriaDeduccionesPanel.jsx',
      'app/src/components/admin/AdminRolesMatrixPanel.jsx',
    ]
    for (const rel of zone3Surfaces) {
      const src = readRepoFile(rel)
      expect(src).toContain('CanonicalZone3Toolbar')
      expect(src).not.toMatch(/className\s*=\s*["'{`][^"'`}]*\balon-zone-toolbar\b/)
    }

    // Sin Deshacer duplicado en Zona 5 de Terceros y Mandados en Zona 1 de Compras
    expect(readRepoFile('app/src/components/terceros/TercerosFilasPanel.jsx')).not.toContain('Deshacer (Ctrl+Z)')
    const comprasPageSrc = readRepoFile('app/src/pages/Compras.jsx')
    expect(comprasPageSrc).toContain('Mandados')
    expect(comprasPageSrc.trimEnd().split(/\r?\n/).length).toBeLessThanOrEqual(250)
    expect(readRepoFile('app/src/components/compras/ComprasPedidosToolbar.jsx')).not.toContain('onOpenMandados')
  })

  it('FL-024: blinda Fecha DD/MM/AAAA, Hora Argentina UTC-3 en todo el ERP y depuración de Hojas Resumen Gerencial', () => {
    expect(STATUS_BY_ID.get('FL-024')).toBe('blindado')

    // 1. Motor canónico UTC-3 (sin desfasaje después de las 21:00 ART)
    const lateAr = new Date('2026-11-24T01:30:00.000Z') // 23/11/2026 22:30 ART
    expect(getTodayArIso(lateAr)).toBe('2026-11-23')
    expect(formatDateAr(lateAr)).toBe('23/11/2026')
    expect(formatDateTimeAr(lateAr)).toBe('23/11/2026 22:30')
    expect(buildArTimestampIso('2026-11-23', '22:30')).toBe('2026-11-24T01:30:00.000Z')

    // 2. HTML en es-AR y buscador universal compatible con DD/MM/AAAA
    expect(readRepoFile('app/index.html')).toContain('lang="es-AR"')
    expect(matchesUniversalSearch({ date_logged: '2026-11-23', worker_name: 'JUAN' }, '23/11/2026')).toBe(true)

    // 3. Candado anti-regresión activo en antiRegressionChecks.mjs
    const guardSrc = readRepoFile('app/scripts/lib/antiRegressionChecks.mjs')
    expect(guardSrc).toContain('RAW_UTC_TODAY_RE')
    expect(guardSrc).toContain('RAW_UNANCHORED_DATE_LOCALE_RE')

    // 4. Conversión de Horas Extra en enrichLaborLogs (4 al 50% × 1.5 + 2 al 100% × 2.0 = 10 hs conv.)
    const enriched = enrichLaborLogs({
      laborLogs: [{
        id: 'l1',
        date_logged: '2026-11-20',
        worker_name: 'OPERARIO ASTILLERO',
        worker_type: 'Astillero',
        hours_normal: 9,
        hours_extra_50: 4,
        hours_extra_100: 2,
        hours_worked: 15,
        work_type: 'HORA',
      }],
      workers: [{ id: 'w1', name: 'OPERARIO ASTILLERO', admin_center: 'ASTILLERO', category: 'OFICIAL', hourly_rate_usd: 10 }],
    })
    expect(enriched[0].hoursNormal).toBe(9)
    expect(enriched[0].hoursExtraPhysical).toBe(6)
    expect(enriched[0].hoursExtra50Equiv).toBe(6)
    expect(enriched[0].hoursExtra100Equiv).toBe(4)
    expect(enriched[0].hoursExtraEquiv).toBe(10)
    expect(enriched[0].hoursEquiv).toBe(19)
    expect(enriched[0].costUsd).toBe(190)

    // 5. Hojas de Resumen Gerencial: columnas visuales depuradas + CSV completo preservado
    const horasSrc = readRepoFile('app/src/components/resumenGerencial/ResumenHojaHorasPanel.jsx')
    expect(horasSrc).toContain('OvertimeBreakdownCell')
    expect(horasSrc).toContain('Hs Extra')
    expect(horasSrc).not.toContain('<th className="px-2.5 py-2">Centro</th>')
    expect(horasSrc).not.toContain('<th className="px-2.5 py-2">Fuente</th>')
    expect(horasSrc).not.toContain('<th className="px-2.5 py-2">Estado</th>')
    expect(horasSrc).toContain("{ key: 'workerType', label: 'Centro' }")
    expect(horasSrc).toContain("{ key: 'approvalStatus', label: 'Estado' }")

    const matSrc = readRepoFile('app/src/components/resumenGerencial/ResumenHojaMaterialesPanel.jsx')
    expect(matSrc).toContain('<th className="px-2.5 py-2">Origen</th>')
    expect(matSrc).not.toContain('<th className="px-2.5 py-2">Rubro</th>')
    expect(matSrc).not.toContain('<th className="px-2.5 py-2">Clasificación</th>')
    expect(matSrc).not.toContain('<th className="px-2.5 py-2 text-right">Ref. EPP*</th>')
    expect(matSrc.indexOf('<th className="px-2.5 py-2">O.T</th>')).toBeLessThan(matSrc.indexOf('<th className="px-2.5 py-2">Solicitante</th>'))
    expect(matSrc.indexOf('<th className="px-2.5 py-2">Solicitante</th>')).toBeLessThan(matSrc.indexOf('<th className="px-2.5 py-2">Material / Insumo</th>'))
    expect(matSrc).toContain("{ key: 'referenceUsd', label: 'Ref EPP US$' }")

    const tercSrc = readRepoFile('app/src/components/resumenGerencial/ResumenHojaTercerosPanel.jsx')
    expect(tercSrc).not.toContain('<th className="px-2.5 py-2">Comprobante</th>')
    expect(tercSrc).not.toContain('<th className="px-2.5 py-2">N° Comp.</th>')
    expect(tercSrc).toContain("{ key: 'voucherType', label: 'Comprobante' }")
    expect(tercSrc).toContain("{ key: 'voucherNumber', label: 'Nro Comp.' }")

    // 6. Reglas de modalidades en Resumen Gerencial: CONTROL excluida, PRESUPUESTO $0 informativo, solo HORA computa costo
    const ship = { id: 's-nono', name: 'NONO PASCUAL', status: 'Activo', is_active: true }
    const wos = [
      { id: 'wo-2', ship_id: 's-nono', ot_number: 'OT-2', title: 'VALVULAS', work_type: 'CONTROL', status: 'En ejecución' },
      { id: 'wo-3', ship_id: 's-nono', ot_number: 'OT-3', title: 'CAMBIO CHAPA', work_type: 'PRESUPUESTO', status: 'En ejecución' },
    ]
    const workers = [
      { id: 'w-ctrl', name: 'CALDERERO PROMEDIO', admin_center: 'ASTILLERO', hourly_rate_usd: 10 },
      { id: 'w-prc', name: 'Alanis, Carlos', admin_center: 'ASTILLERO', category: 'AYUDANTE', hourly_rate_usd: 11 },
      { id: 'w-hh', name: 'AGOUTBORDE OMAR', admin_center: 'CONTRATISTA', work_group: '4RG', hourly_rate_usd: 12 },
    ]
    const mixedLogs = [
      { id: 'l-ctrl-1', ship_id: 's-nono', work_order_id: 'wo-2', worker_id: 'w-ctrl', worker_name: 'CALDERERO PROMEDIO', worker_type: 'Astillero', rubro: 'ESTADISTICA', work_type: 'CONTROL', hours_worked: 9, hours_normal: 9, date_logged: '2026-11-20', approval_status: 'Aprobado' },
      { id: 'l-ctrl-2', ship_id: 's-nono', work_order_id: 'wo-2', worker_id: 'w-ctrl', worker_name: 'CALDERERO PROMEDIO', worker_type: 'Astillero', rubro: 'ESTADISTICA', work_type: null, hours_worked: 9, hours_normal: 9, date_logged: '2026-11-20', approval_status: 'Aprobado' },
      { id: 'l-prc-1', ship_id: 's-nono', work_order_id: 'wo-3', worker_id: 'w-prc', worker_name: 'Alanis, Carlos', worker_type: 'Astillero', rubro: 'Calderería', work_type: 'PRESUPUESTO', hours_worked: 4, hours_normal: 4, date_logged: '2026-11-20', approval_status: 'Aprobado' },
      { id: 'l-hh-1', ship_id: 's-nono', work_order_id: 'wo-2', worker_id: 'w-hh', worker_name: 'AGOUTBORDE OMAR', worker_type: 'Contratista', rubro: 'Calderería', work_type: 'HORA', hours_worked: 6, hours_normal: 6, date_logged: '2026-11-20', approval_status: 'Aprobado' },
    ]

    const enrichedMixed = enrichLaborLogs({ laborLogs: mixedLogs, workers, ships: [ship], workOrders: wos })
    expect(enrichedMixed).toHaveLength(2)
    expect(enrichedMixed.some((r) => r.workType === 'CONTROL')).toBe(false)

    const prcRow = enrichedMixed.find((r) => r.id === 'l-prc-1')
    expect(prcRow.isPresupuesto).toBe(true)
    expect(prcRow.hoursPhysical).toBe(4)
    expect(prcRow.hourlyRateUsd).toBe(0)
    expect(prcRow.costUsd).toBe(0)
    expect(prcRow.approvedUsd).toBe(0)

    const hhRow = enrichedMixed.find((r) => r.id === 'l-hh-1')
    expect(hhRow.isBillableHora).toBe(true)
    expect(hhRow.costUsd).toBe(72)

    const summary = computeShipManagerialSummary({
      shipId: 's-nono',
      activeOtId: 'wo-2',
      ships: [ship],
      workOrders: wos,
      laborRows: enrichedMixed,
    })
    expect(summary.totals.horasUsd).toBe(72)
    expect(summary.totals.directTotalUsd).toBe(72)
    expect(summary.totals.physicalHours).toBe(10) // 6h HORA + 4h PRESUPUESTO (0h CONTROL)
    expect(summary.totals.billableHours).toBe(6)
    expect(summary.totals.presupuestoHours).toBe(4)

    const hover = buildHoursHoverSummary(enrichedMixed, { filterMode: 'ALL' })
    expect(hover.totalHours).toBe(10)
    expect(hover.totalCostUsd).toBe(72)
    expect(hover.items.some((i) => i.workTypeCode === 'CTRL')).toBe(false)

    const unvaluedOt3 = computeOtUnvaluedBreakdown({ otId: 'wo-3', laborRows: enrichedMixed })
    expect(unvaluedOt3.hsCount).toBe(0)

    const kpis = computeHorasKpis(enrichedMixed)
    const prcKpi = kpis.find((k) => k.id === 'DEC_013')
    expect(prcKpi.count).toBe('4.0 hs')
    expect(filterResumenLaborRows(enrichedMixed, { kpiFilter: 'DEC_013' })).toHaveLength(1)

    // 7. Zona 1 y Zona 2 de Resumen Gerencial: Obras Activas en verde, Zona 2 centrada sin duplicados
    const headerSrc = readRepoFile('app/src/components/resumenGerencial/ResumenGerencialHeader.jsx')
    expect(headerSrc).toContain('bg-emerald-500/25 border-emerald-400')
    expect(headerSrc).toContain('border-cyan-400')
    expect(headerSrc).toContain('border-fuchsia-400')

    const chromeSrc = readRepoFile('app/src/components/resumenGerencial/CostSheetChrome.jsx')
    expect(chromeSrc).toContain('lg:grid-cols-[1fr_auto_1fr]')
    expect(chromeSrc).toContain('General Todo el Buque')
    expect(chromeSrc).toContain('Por O.T.')
    expect(chromeSrc).toContain('border-rose-500/85')
    expect(chromeSrc).not.toContain('Vista: Costos Generales')
    expect(chromeSrc).not.toContain('onSelectOt')
  })
})
