import { describe, it, expect } from 'vitest'
import { isWorkOrderExcludedFromBilling, buildOrderedBillingBlocks } from '../../src/lib/billingWorkspaceShipActions.js'
import { buildBillingRemitoPdfBytes, buildBillingArchiveFileName } from '../../src/lib/billingPdfArchiveEngine.js'
import { buildCleanBillingPrintHtml } from '../../src/lib/billingPrintHelper.js'

describe('Remito Comercial — Mejoras de ordenamiento, exclusión silenciosa y PDF estandarizado', () => {
  const ship = {
    id: 'ship-1',
    name: 'ARESIT',
    matricula: '02481',
    eslora_mts: 28.5,
    manga_mts: 7.4,
    puntal_mts: 3.8,
    billing_layout_meta: {}
  }

  it('excluye silenciosamente OTs canceladas/eliminadas y OTs con todas sus tareas desestimadas', () => {
    const wos = [
      { id: 'wo-1', ship_id: 'ship-1', ot_number: 'OT-01', title: 'CARENADO', status: 'En Progreso', is_in_billing: true, billing_description: '<b>CARENADO</b>', billing_sort_order: 10 },
      { id: 'wo-2', ship_id: 'ship-1', ot_number: 'OT-02', title: 'VÁLVULAS DE CASCO', status: 'Cancelada', notes: '[ELIMINADA] Desestimada por eliminación', is_in_billing: true, billing_description: '<b>VÁLVULAS</b>', billing_sort_order: 20 },
      { id: 'wo-3', ship_id: 'ship-1', ot_number: 'OT-03', title: 'PINTURA', status: 'En Progreso', is_in_billing: true, billing_description: '<b>PINTURA</b>', billing_sort_order: 30 }
    ]
    const workItems = [{ id: 'wi-3', work_order_id: 'wo-3', status: 'Desestimado' }]

    expect(isWorkOrderExcludedFromBilling(wos[0], workItems)).toBe(false)
    expect(isWorkOrderExcludedFromBilling(wos[1], workItems)).toBe(true)
    expect(isWorkOrderExcludedFromBilling(wos[2], workItems)).toBe(true)

    const blocks = buildOrderedBillingBlocks({ activeShip: ship, activeShipWos: wos, workItems })
    expect(blocks.map((b) => b.workOrderId)).toEqual(['wo-1'])
  })

  it('genera PDF 1.4 válido con membrete ASTILLERO VANOLI y nombre de archivo vinculado a presupuesto, barco y fecha', () => {
    const fileName = buildBillingArchiveFileName({ shipName: 'ARESIT', budgetNumber: '733/26', issueDate: '2026-07-01' })
    expect(fileName).toBe('Presupuesto_733-26_ARESIT_2026-07-01.pdf')

    const bytes = buildBillingRemitoPdfBytes({
      ship,
      owner: { name: 'PESQUERA DESEADO SAU', email_principal: 'info@pesquera.com' },
      budgetNumber: '733/26',
      issueDate: '2026-07-01',
      pages: [[{ id: 'wo_1', blockType: 'WORK_ORDER', billing_description: '<b>PUESTA EN SECO</b>', billing_pricing_mode: 'MO_MAT', billing_mat_usd: 1200, billing_mo_usd: 4535 }]],
      pageSummaries: [{ pageNumber: 1, totalPages: 1, exentoUsd: 5735, gravadoUsd: 0, ivaUsd: 0, totalUsd: 5735 }]
    })
    const raw = Buffer.from(bytes).toString('latin1')
    expect(raw.startsWith('%PDF-1.4')).toBe(true)
    expect(raw.endsWith('%%EOF')).toBe(true)
    expect(raw).toContain('ASTILLERO VANOLI')
    expect(raw).toContain('Presupuesto N')
    expect(raw).toContain('733/26')
    expect(raw).toContain('PESQUERA DESEADO SAU')
  })

  it('genera HTML imprimible A4 con logo circular AV y estructura estandarizada (Imagen 2)', () => {
    const html = buildCleanBillingPrintHtml({
      ship,
      owner: { name: 'PESQUERA DESEADO SAU', email_principal: 'compras@pesquera.com' },
      budgetNumber: '733/26',
      issueDate: '2026-07-01',
      pages: [[]],
      pageSummaries: [{ pageNumber: 1, totalPages: 1, exentoUsd: 0, gravadoUsd: 0, ivaUsd: 0, totalUsd: 0 }]
    })
    expect(html).toContain('Logo Astillero Vanoli Alon Car S.A.')
    expect(html).toContain('PESQUERA DESEADO SAU')
    expect(html).toContain('De nuestra consideración:')
    expect(html).toContain('CARACTERÍSTICAS:')
    expect(html).toContain('HOJA 1/1')
  })
})
