import { describe, it, expect } from 'vitest'
import {
  evaluateShipWorkOrdersForGhostImport,
  inferOtChapterDeterministic,
  isCaldereriaChapter
} from '../../src/lib/billingMirrorEngine.js'
import {
  computeOtUnvaluedBreakdown,
  computeBlockBillingBreakdown,
  computePaginatedCumulativeBalances,
  resolveBlockBillingQty,
  paginateBillingBlocks,
  computeA4RemainingSpacerPx,
  A4_SHEET_METRICS,
  PAIRED_GRID_CLASS
} from '../../src/lib/billingSheetMath.js'
import { buildOperationalSelectionFromTemplate } from '../../src/lib/otAbcCatalogConstants.js'

describe('billingMirrorEngine (100% SIN IA)', () => {
  it('ordena OT.ABC primero, luego CALDERERIA (con KG activos) y ELECTRICIDAD por rubro real de costos', () => {
    const otTemplates = [
      { id: 't1', name: 'VARADERO', sort_order: 2, default_tax_type: 'GRAVADO_21', line_items: [{ unit_price_usd: 265 }] }
    ]
    const workers = [
      { name: 'JUAN CHAPA', trade: 'CALDERERIA' },
      { name: 'ELECTRICIDAD NAVAL SA', trade: 'ELECTRICIDAD' }
    ]
    const shipWos = [
      { id: 'w_elec', ot_number: 'OT-3', title: 'TABLERO ALARMA', description: 'Instalar tablero', status: 'En ejecución', contractor_name: 'ELECTRICIDAD NAVAL SA' },
      { id: 'w_cald', ot_number: 'OT-2', title: 'CAMBIO CHAPA BODEGA', description: 'Cambiar chapa 8mm', status: 'Finalizado', contractor_name: 'JUAN CHAPA' },
      { id: 'w_var', ot_number: 'OT-1', title: 'VARADERO', description: 'Estadía en varadero', status: 'Finalizado' }
    ]

    const res = evaluateShipWorkOrdersForGhostImport({ shipWos, workers, otTemplates })
    expect(res.emptyDescriptionAlerts).toHaveLength(0)
    expect(res.readyToImport.map((r) => r.workOrderId)).toEqual(['w_var', 'w_cald', 'w_elec'])
    expect(res.readyToImport[0].patch.billing_mo_tax).toBe('GRAVADO_21')
    expect(res.readyToImport[1].classification.showsKgInCant).toBe(true)
    expect(isCaldereriaChapter(res.readyToImport[1].patch.billing_rubro_group)).toBe(true)
  })

  it('NO importa OTs con descripción vacía y JAMÁS pisa OTs que ya tienen billing_description (aunque sea 1 espacio)', () => {
    const shipWos = [
      { id: 'w_empty', ot_number: 'OT-10', title: 'PENDIENTE DETALLE', description: '', status: 'En ejecución', foreman_name: 'HUGO' },
      { id: 'w_space', ot_number: 'OT-11', title: 'YA EDITADA', description: 'Texto taller', billing_description: ' ', status: 'Finalizado' },
      { id: 'w_desest', ot_number: 'OT-12', title: 'ANULADA', description: 'Algo', status: 'Desestimado' },
      { id: 'w_ready', ot_number: 'OT-13', title: 'PROVISIONES', description: 'Fabricar 2 pernos', status: 'Pendiente remito' }
    ]

    const res = evaluateShipWorkOrdersForGhostImport({ shipWos })
    expect(res.emptyDescriptionAlerts).toHaveLength(1)
    expect(res.emptyDescriptionAlerts[0].workOrderId).toBe('w_empty')
    expect(res.alreadyInBilling.map((w) => w.id)).toEqual(['w_space'])
    expect(res.readyToImport.map((r) => r.workOrderId)).toEqual(['w_ready'])
  })

  it('infiere rubro por horas cargadas aunque el título sea genérico', () => {
    const res = inferOtChapterDeterministic({
      wo: { id: 'w9', title: 'TRABAJO ESPECIAL', description: 'Ajuste general' },
      laborRows: [{ workOrderId: 'w9', rubro: 'CARPINTERIA', hoursPhysical: 16 }]
    })
    expect(res.chapterKey).toBe('CARPINTERIA')
  })
})

describe('billingSheetMath (4 píldoras sin valorizar + acumulación por hoja)', () => {
  it('desglosa los 4 contadores [Hs | 3ros | Comp | Mat] por OT', () => {
    const out = computeOtUnvaluedBreakdown({
      otId: 'ot1',
      laborRows: [
        { id: 'l1', workOrderId: 'ot1', isPresupuesto: false, hourlyRateUsd: 0, hoursPhysical: 8, workerName: 'Operario A' },
        { id: 'l2', workOrderId: 'ot1', isPresupuesto: false, hourlyRateUsd: 15, isPendingR: true, hoursPhysical: 4, workerName: 'Operario B' },
        { id: 'l3', workOrderId: 'ot1', isPresupuesto: true, hourlyRateUsd: 0, hoursPhysical: 10, workerName: 'Taller PRC' }
      ],
      thirdPartyRows: [
        { id: 't1', workOrderId: 'ot1', hasZeroCost: true, contractorName: 'TECO TALLER', voucherType: 'PRC' }
      ],
      materialRows: [
        { id: 'm1', workOrderId: 'ot1', sourceType: 'PANOL_TX', hasZeroPrice: true, materialName: 'Chapa 8mm', qty: 2, unitMeasure: 'u' },
        { id: 'm2', workOrderId: 'ot1', sourceType: 'COMPRA_DIRECTA', hasZeroPrice: true, materialName: 'Pintura', qty: 4, unitMeasure: 'lt' }
      ]
    })

    expect(out.hsCount).toBe(2)
    expect(out.tercerosCount).toBe(1)
    expect(out.comprasCount).toBe(1)
    expect(out.matCount).toBe(1)
    expect(out.totalCount).toBe(5)
    expect(out.details).toHaveLength(5)
  })

  it('calcula acumulación por hoja (Transporte) con MO+MAT mixto, bonificaciones negativas y SIN_CARGO', () => {
    const sinCargo = computeBlockBillingBreakdown({ billing_pricing_mode: 'SIN_CARGO', billing_mo_usd: 999 })
    expect(sinCargo.totalUsd).toBe(0)

    const { pageSummaries, grandTotal } = computePaginatedCumulativeBalances([
      [
        { billing_pricing_mode: 'MO_MAT', billing_mo_usd: 3200, billing_mat_usd: 540, billing_mo_tax: 'EXENTO', billing_mat_tax: 'GRAVADO_21' }
      ],
      [
        { billing_pricing_mode: 'UNITARIO', billing_qty_override: 10, billing_unit_price_usd: 100, billing_mo_tax: 'GRAVADO_21' },
        { billing_pricing_mode: 'UNITARIO', billing_qty_override: 2, billing_unit_price_usd: -100, billing_mo_tax: 'GRAVADO_21' }
      ]
    ], 2500)

    expect(pageSummaries[0]).toMatchObject({ pageNumber: 1, totalPages: 2, exentoUsd: 3200, gravadoUsd: 540, ivaUsd: 113.4, totalUsd: 3853.4 })
    expect(pageSummaries[1]).toMatchObject({ pageNumber: 2, totalPages: 2, exentoUsd: 3200, gravadoUsd: 1340, ivaUsd: 281.4, totalUsd: 4821.4 })
    expect(grandTotal.margenRealUsd).toBe(2040)
  })

  it('OT perteneciente al catálogo OT.ABC ignora descripción operativa e importa description_billing (incluso si operativa está vacía)', () => {
    const otTemplates = [
      {
        id: 'tpl-valv',
        name: 'VALVULAS DE CASCO E INTERMEDIARIAS',
        sort_order: 7,
        description: 'Desmontar, volver a montar las válvulas y llevarlas al taller para su recorrido.',
        description_billing: '• Des/Armar, limpiar, arenar y pintar válvulas de toma de mar\n• Revisión de válvulas de salida a casco de 1" a 2"',
        default_tax_type: 'EXENTO',
        line_items: [{ unit_price_usd: 165 }]
      },
      {
        id: 'tpl-car',
        name: 'CARENADO DE CASCO',
        sort_order: 13,
        description: 'Lavado de casco, pintura de casco, pintar cartelería de flotación.',
        description_billing: '1) LAVADO DE CASCO: Lavado con agua dulce.\n2) CARENADO DE CASCO: Hidro arenado SA1.\nPinturas y diluyente provistas por el armador.',
        default_tax_type: 'EXENTO',
        line_items: [{ row_type: 'SUBWORK', subwork_title: '1) LAVADO DE CASCO', concept: 'Lavado largo...', unit_price_usd: 1750 }]
      }
    ]
    const shipWos = [
      { id: 'w_valv', ot_number: 'OT-2', ot_template_id: 'tpl-valv', title: 'VALVULAS DE CASCO E INTERMEDIARIAS', description: 'Pintar valvulas', status: 'En ejecución' },
      { id: 'w_car', ot_number: 'OT-8', title: 'CARENADO DE CASCO', description: '', status: 'En ejecución' },
      { id: 'w_libre', ot_number: 'OT-3', title: 'CAMBIO CHAPA', description: 'Parche ventana en casco', status: 'En ejecución' }
    ]
    const workItems = [
      { work_order_id: 'w_valv', description: 'recorrido de valvulas', status: 'En ejecución' }
    ]

    const res = evaluateShipWorkOrdersForGhostImport({ shipWos, workItems, otTemplates })
    expect(res.emptyDescriptionAlerts).toHaveLength(0)

    const valv = res.readyToImport.find((r) => r.workOrderId === 'w_valv')
    const car = res.readyToImport.find((r) => r.workOrderId === 'w_car')
    const libre = res.readyToImport.find((r) => r.workOrderId === 'w_libre')

    expect(valv.patch.billing_description).toContain('Des/Armar, limpiar, arenar')
    expect(valv.patch.billing_description).not.toContain('recorrido de valvulas')
    expect(valv.patch.billing_qty_override).toBe(1)

    expect(car.patch.billing_description).toContain('Hidro arenado SA1')
    expect(car.patch.billing_description).toContain('Pinturas y diluyente provistas por el armador')

    expect(libre.patch.billing_description).toContain('Parche ventana en casco')

    const opSel = buildOperationalSelectionFromTemplate(otTemplates[1])
    expect(opSel.description).toBe('Lavado de casco, pintura de casco, pintar cartelería de flotación.')
    expect(opSel.subworks).toHaveLength(0)
  })

  it('UNITARIO con billing_qty_override null asume 1 en totales y respeta 0 explícito; layout A4 mantiene 210x297mm', () => {
    expect(resolveBlockBillingQty({ billing_pricing_mode: 'UNITARIO', billing_qty_override: null })).toBe(1)
    expect(resolveBlockBillingQty({ billing_pricing_mode: 'UNITARIO', billing_qty_override: 0 })).toBe(0)

    const bNullQty = computeBlockBillingBreakdown({
      billing_pricing_mode: 'UNITARIO',
      billing_qty_override: null,
      billing_unit_price_usd: 165,
      billing_mo_tax: 'EXENTO'
    })
    expect(bNullQty.totalUsd).toBe(165)

    const bZeroQty = computeBlockBillingBreakdown({
      billing_pricing_mode: 'UNITARIO',
      billing_qty_override: 0,
      billing_unit_price_usd: 165,
      billing_mo_tax: 'EXENTO'
    })
    expect(bZeroQty.totalUsd).toBe(0)

    expect(A4_SHEET_METRICS.widthMm).toBe(210)
    expect(A4_SHEET_METRICS.heightMm).toBe(297)
    expect(PAIRED_GRID_CLASS).toContain('210mm')
    const pages = paginateBillingBlocks([
      { id: '1', billing_description: 'A'.repeat(900), billing_pricing_mode: 'MO_MAT' },
      { id: '2', billing_description: 'B'.repeat(900), billing_pricing_mode: 'MO_MAT' },
      { id: '3', billing_description: 'C'.repeat(900), billing_pricing_mode: 'MO_MAT' }
    ])
    expect(pages.length).toBeGreaterThanOrEqual(2)
    expect(computeA4RemainingSpacerPx([{ id: '1', billing_description: 'Corto' }], 0)).toBeGreaterThan(500)
  })
})
