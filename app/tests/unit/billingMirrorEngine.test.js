import { describe, it, expect } from 'vitest'
import {
  evaluateShipWorkOrdersForGhostImport,
  inferOtChapterDeterministic,
  isCaldereriaChapter
} from '../../src/lib/billingMirrorEngine.js'
import { planReorderExistingBillingBlocks } from '../../src/lib/billingImportOrderEngine.js'
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

  it('respeta la secuencia exacta del PDF (1..20), crea delimitadores automáticos y deja no-tabuladas debajo', () => {
    const otTemplates = [
      { id: 't2', name: 'VARADERO', sort_order: 2, default_tax_type: 'GRAVADO_21', line_items: [{ row_type: 'ITEM', concept: 'Halaje', unit_price_usd: 6400, tax_type: 'GRAVADO_21' }, { row_type: 'ITEM', concept: 'Estadía varadero', unit_price_usd: 240, tax_type: 'GRAVADO_21' }] },
      { id: 't3', name: 'SERVICIO DE GRUA', sort_order: 3, default_tax_type: 'EXENTO', line_items: [{ row_type: 'ITEM', concept: 'Grúa 8t', unit_price_usd: 130 }, { row_type: 'ITEM', concept: 'Grúa 60t', unit_price_usd: 240 }] },
      { id: 't11', name: 'DESMONTE LINEA EJE Y TIMON', sort_order: 11, default_tax_type: 'EXENTO', line_items: [{ row_type: 'ITEM', concept: 'Guardacabos', unit_price_usd: 250 }, { row_type: 'ITEM', concept: 'Pala timón', unit_price_usd: 1900 }] },
      { id: 't12', name: 'LINEA DE EJE', sort_order: 12, default_tax_type: 'EXENTO', line_items: [{ row_type: 'ITEM', concept: 'Torno eje', unit_price_usd: 980 }] },
      { id: 't14', name: 'CARENADO DE CASCO', sort_order: 14, default_tax_type: 'EXENTO', line_items: [{ row_type: 'SUBWORK', subwork_title: '1) LAVADO', concept: 'Lavado', unit_price_usd: 1750 }, { row_type: 'SUBWORK', subwork_title: '2) ARENADO', concept: 'Arenado SA1', unit_price_usd: 18600 }] },
      { id: 't15', name: 'SUPER ESTRUCTURA Y CUBIERTA', sort_order: 15, default_tax_type: 'EXENTO', line_items: [{ row_type: 'ITEM', concept: 'Superestructura', unit_price_usd: 18700 }] },
      { id: 't16', name: 'SUMINISTROS', sort_order: 16, default_tax_type: 'GRAVADO_21', line_items: [{ row_type: 'ITEM', concept: 'Energía 3x380', unit_price_usd: 130, tax_type: 'GRAVADO_21' }, { row_type: 'ITEM', concept: 'Agua potable', unit_price_usd: 0, tax_type: 'GRAVADO_21' }] },
      { id: 't17', name: 'Anclas y Cadenas', sort_order: 17, default_tax_type: 'EXENTO', line_items: [{ row_type: 'ITEM', concept: 'Extender cadenas', unit_price_usd: 400 }, { row_type: 'ITEM', concept: 'Calibrado', unit_price_usd: 200 }] },
      { id: 't18', name: 'TANQUES', sort_order: 18, default_tax_type: 'EXENTO', line_items: [{ row_type: 'ITEM', concept: 'Tapa registro', unit_price_usd: 210 }, { row_type: 'ITEM', concept: 'Gas oil m3', unit_price_usd: 48 }] },
      { id: 't19', name: 'SENTINA', sort_order: 19, default_tax_type: 'EXENTO', line_items: [{ row_type: 'ITEM', concept: 'Limpieza sentina', unit_price_usd: 1500 }, { row_type: 'ITEM', concept: 'Pintado m2', unit_price_usd: 6 }] },
      { id: 't20', name: 'INFORMES TÉCNICOS', sort_order: 20, default_tax_type: 'EXENTO', line_items: [{ row_type: 'ITEM', concept: 'Informe PNA', unit_price_usd: 850 }] }
    ]
    const workers = [{ name: 'JUAN CHAPA', trade: 'CALDERERIA' }]
    const shipWos = [
      { id: 'w_cald', ot_number: 'OT-1', title: 'CAMBIO CHAPA', description: 'Chapa 8mm', status: 'En ejecución', contractor_name: 'JUAN CHAPA' },
      { id: 'w_inf', ot_number: 'OT-2', ot_template_id: 't20', title: 'INFORMES TÉCNICOS', description: 'PNA', status: 'En ejecución' },
      { id: 'w_sent', ot_number: 'OT-3', ot_template_id: 't19', title: 'SENTINA', description: 'Sentina', status: 'En ejecución' },
      { id: 'w_tanq', ot_number: 'OT-4', ot_template_id: 't18', title: 'TANQUES', description: 'Tanques', status: 'En ejecución' },
      { id: 'w_anc', ot_number: 'OT-5', ot_template_id: 't17', title: 'ANCLAS Y CADENAS', description: 'Cadenas', status: 'En ejecución' },
      { id: 'w_sum', ot_number: 'OT-6', ot_template_id: 't16', title: 'SUMINISTROS', description: 'Luz', status: 'En ejecución' },
      { id: 'w_sup', ot_number: 'OT-7', ot_template_id: 't15', title: 'SUPER ESTRUCTURA Y CUBIERTA', description: 'Cubierta', status: 'En ejecución' },
      { id: 'w_car', ot_number: 'OT-8', ot_template_id: 't14', title: 'CARENADO DE CASCO', description: 'Casco', status: 'En ejecución' },
      { id: 'w_eje', ot_number: 'OT-9', ot_template_id: 't12', title: 'LINEA DE EJE', description: 'Eje', status: 'En ejecución' },
      { id: 'w_desm', ot_number: 'OT-10', ot_template_id: 't11', title: 'DESMONTE LINEA EJE Y TIMON', description: 'Desmonte', status: 'En ejecución' },
      { id: 'w_grua', ot_number: 'OT-11', ot_template_id: 't3', title: 'SERVICIO DE GRUA', description: 'Grúa', status: 'En ejecución' },
      { id: 'w_var', ot_number: 'OT-12', ot_template_id: 't2', title: 'VARADERO', description: 'Varadero', status: 'En ejecución' }
    ]

    const res = evaluateShipWorkOrdersForGhostImport({ shipWos, workers, otTemplates })
    expect(res.readyToImport.map((r) => r.workOrderId)).toEqual([
      'w_var', 'w_grua', 'w_desm', 'w_eje', 'w_car', 'w_sup', 'w_sum', 'w_anc', 'w_tanq', 'w_sent', 'w_inf', 'w_cald'
    ])

    const delimLabels = res.nextCustomBlocks.filter((b) => b.blockType === 'RUBRO_DELIMITER').map((b) => b.label)
    expect(delimLabels).toEqual(['SERVICIOS', 'MECANICA NAVAL', 'TORNERIA', 'RASCHINAJE', 'CALDERERÍA'])

    const carCand = res.readyToImport.find((r) => r.workOrderId === 'w_car')
    expect(carCand.patch.billing_pricing_mode).toBe('ITEMS')
    expect(carCand.patch.billing_line_items).toHaveLength(2)
    expect(carCand.patch.billing_line_items[0].unit_price_usd).toBe(1750)
    expect(carCand.patch.billing_line_items[1].unit_price_usd).toBe(18600)

    const infCand = res.readyToImport.find((r) => r.workOrderId === 'w_inf')
    expect(infCand.patch.billing_pricing_mode).toBe('UNITARIO')
    expect(infCand.patch.billing_unit_price_usd).toBe(850)
  })

  it('inserta una OT tabulada nueva en su posición PDF (antes de tabuladas posteriores y no-tabuladas) y calcula totales en modo ITEMS mixto', () => {
    const otTemplates = [
      { id: 't7', name: 'TOMAS DE MAR', sort_order: 7, default_tax_type: 'EXENTO', line_items: [{ row_type: 'ITEM', concept: 'Rejillas', unit_price_usd: 380 }] },
      { id: 't14', name: 'CARENADO DE CASCO', sort_order: 14, default_tax_type: 'EXENTO', line_items: [{ row_type: 'SUBWORK', subwork_title: '1) LAVADO', concept: 'Lavado', unit_price_usd: 1750 }] }
    ]
    const shipWos = [
      { id: 'w_car', ot_number: 'OT-8', ot_template_id: 't14', title: 'CARENADO DE CASCO', is_in_billing: true, billing_description: '<b>CARENADO</b>', billing_sort_order: 20, status: 'En ejecución' },
      { id: 'w_cald', ot_number: 'OT-3', title: 'CAMBIO CHAPA', is_in_billing: true, billing_description: '<b>CHAPA</b>', billing_sort_order: 40, status: 'En ejecución' },
      { id: 'w_tmar', ot_number: 'OT-9', ot_template_id: 't7', title: 'TOMAS DE MAR', description: 'Rejillas', is_in_billing: false, status: 'En ejecución' }
    ]

    const res = evaluateShipWorkOrdersForGhostImport({ shipWos, otTemplates })
    expect(res.readyToImport).toHaveLength(1)
    const tmarSort = res.readyToImport[0].patch.billing_sort_order
    const carNewSort = res.existingWoOrderUpdates.find((u) => u.id === 'w_car')?.patch.billing_sort_order
    expect(tmarSort).toBeLessThan(carNewSort)

    const breakdown = computeBlockBillingBreakdown({
      billing_pricing_mode: 'ITEMS',
      billing_line_items: [
        { id: '1', text: '1) LAVADO', qty: 1, unit_price_usd: 1750, tax_type: 'EXENTO', is_note: false },
        { id: '2', text: '2) ENERGIA', qty: 2, unit_price_usd: 130, tax_type: 'GRAVADO_21', is_note: false },
        { id: '3', text: 'Nota armador', qty: null, unit_price_usd: 999, tax_type: 'EXENTO', is_note: true }
      ]
    })
    expect(breakdown).toEqual({ exentoUsd: 1750, gravadoUsd: 260, ivaUsd: 54.6, totalUsd: 2064.6 })
  })

  it('Actualizar Costos reordena un remito ya abierto (caso NONO PASCUAL: TOMAS DE MAR sube arriba de CARENADO y CALDERERIA)', () => {
    const otTemplates = [
      { id: 't7', name: 'TOMAS DE MAR', sort_order: 7 },
      { id: 't14', name: 'CARENADO DE CASCO', sort_order: 14 }
    ]
    const activeBillingWos = [
      { id: 'w_car', ot_number: 'OT-8', ot_template_id: 't14', title: 'CARENADO DE CASCO', is_in_billing: true, billing_sort_order: 20, billing_rubro_group: 'CALDERERIA' },
      { id: 'w_chapa', ot_number: 'OT-3', title: 'CAMBIO CHAPA', is_in_billing: true, billing_sort_order: 40, billing_rubro_group: 'CALDERERIA' },
      { id: 'w_prueba', ot_number: 'OT-5', title: 'PRUEBA', is_in_billing: true, billing_sort_order: 50, billing_rubro_group: 'CALDERERIA' },
      { id: 'w_tmar', ot_number: 'OT-9', ot_template_id: 't7', title: 'TOMAS DE MAR', is_in_billing: true, billing_sort_order: 70, billing_rubro_group: 'OT_ABC' }
    ]
    const existingCustomBlocks = [{ id: 'delim_1', blockType: 'RUBRO_DELIMITER', code: 'CALDERERIA', label: 'CALDERERÍA', sortOrder: 30 }]

    const { woUpdates, nextCustomBlocks } = planReorderExistingBillingBlocks({
      activeBillingWos,
      existingCustomBlocks,
      classifyWo: (wo) => inferOtChapterDeterministic({ wo, otTemplates })
    })

    const sortById = Object.fromEntries(activeBillingWos.map((w) => [w.id, w.billing_sort_order]))
    for (const u of woUpdates) sortById[u.id] = u.patch.billing_sort_order

    expect(sortById.w_tmar).toBeLessThan(sortById.w_car)
    expect(sortById.w_car).toBeLessThan(sortById.w_chapa)
    expect(sortById.w_chapa).toBeLessThan(sortById.w_prueba)
    expect(woUpdates.find((u) => u.id === 'w_car')?.patch.billing_rubro_group).toBe('OT_ABC')
    expect(nextCustomBlocks.map((b) => b.label)).toEqual(['SERVICIOS', 'CALDERERÍA'])
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
