/**
 * billingPrintHelper.js
 * Genera una ventana de impresión limpia (A4) idéntica al presupuesto oficial
 * de Astillero Vanoli · Alon Car S.A., ocultando herramientas internas (rail de barcos,
 * manijas de arrastre, columnita rosada de IVA y panel derecho de costos).
 */

import { isCaldereriaChapter } from './billingMirrorEngine.js'

function fmtMoney(val) {
  const n = Number(val) || 0
  const sign = n < 0 ? '-' : ''
  return `${sign}US$ ${Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function escapeHtml(str = '') {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function openCleanBillingPrintWindow({ ship, owner, budgetNumber = '', pages = [], pageSummaries = [], otRowMap = new Map() }) {
  const today = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  let itemCounter = 0
  let activeRubro = ''

  const pagesHtml = pages.map((pageBlocks, pIdx) => {
    const sum = pageSummaries[pIdx] || { pageNumber: pIdx + 1, totalPages: pages.length, exentoUsd: 0, gravadoUsd: 0, ivaUsd: 0, totalUsd: 0 }
    const rowsHtml = pageBlocks.map((block) => {
      if (block.blockType === 'RUBRO_DELIMITER') {
        activeRubro = block.label || ''
        return `<tr class="rubro-row"><td colspan="5"><strong>${escapeHtml(block.label)}</strong></td></tr>`
      }
      itemCounter += 1
      const otRow = block.workOrderId ? otRowMap.get(block.workOrderId) : null
      const isCald = isCaldereriaChapter(activeRubro || block.billing_rubro_group)
      const mode = block.billing_pricing_mode || 'MO_MAT'
      const qtyVal = mode === 'UNITARIO'
        ? (block.billing_qty_override ?? 1)
        : (block.billing_qty_override ?? (isCald && otRow?.weightKg > 0 ? otRow.weightKg : ''))
      const unitTot = mode === 'UNITARIO' ? Number(((Number(qtyVal) || 0) * (Number(block.billing_unit_price_usd) || 0)).toFixed(2)) : 0

      let conceptSuffix = ''
      let unitCol = ''
      let totalCol = ''
      if (mode === 'MO_MAT') {
        conceptSuffix = `<div class="mo-mat-labels"><div>MAT</div><div>M.O.</div></div>`
        totalCol = `<div class="mo-mat-vals"><div>${fmtMoney(block.billing_mat_usd)}</div><div>${fmtMoney(block.billing_mo_usd)}</div></div>`
      } else if (mode === 'UNITARIO') {
        unitCol = fmtMoney(block.billing_unit_price_usd)
        totalCol = fmtMoney(unitTot)
      } else {
        unitCol = 'sin cargo'
      }

      return `
        <tr>
          <td class="c-item">${itemCounter}</td>
          <td class="c-cant">${qtyVal !== '' && qtyVal !== null ? Number(qtyVal).toLocaleString('es-AR', { maximumFractionDigits: 1 }) : ''}</td>
          <td class="c-concept"><div class="prose" style="font-size:${block.fontSizePx || 12}px">${block.billing_description || ''}</div>${conceptSuffix}</td>
          <td class="c-price">${unitCol}</td>
          <td class="c-price">${totalCol}</td>
        </tr>`
    }).join('')

    return `
      <section class="sheet-page">
        <div class="doc-header">
          <div>
            <div class="brand">ASTILLERO VANOLI · ALON CAR S.A.</div>
            <div>Señores: <strong>${escapeHtml(owner?.name || ship?.client_name || '')}</strong></div>
            <div>mail: ${escapeHtml(owner?.email_principal || '')}</div>
          </div>
          <div class="doc-meta">
            <div>Necochea, ${escapeHtml(today)}</div>
            <div class="presup">Presupuesto Nº: ${escapeHtml(budgetNumber || 'S/N')}</div>
            <div class="page-badge">HOJA ${sum.pageNumber}/${sum.totalPages}</div>
          </div>
        </div>
        ${pIdx === 0 ? `<div class="chars"><strong>CARACTERÍSTICAS:</strong> Nombre del buque: <strong>${escapeHtml(ship?.name)}</strong> · Matr.: ${escapeHtml(ship?.matricula || '')} · Eslora: ${ship?.eslora_mts || ''} · Manga: ${ship?.manga_mts || ''} · Puntal: ${ship?.puntal_mts || ''}</div>` : ''}
        <table>
          <thead>
            <tr><th style="width:32px">Item</th><th style="width:52px">CANT.</th><th>Concepto</th><th style="width:88px">US$ UNITARIO</th><th style="width:96px">TOTAL</th></tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <div class="doc-footer">
          <div class="sig"><div>FIRMA DE QUIEN REALIZA EL PRESUPUESTO</div><div class="sig-name">HUGO C. OBREGOZO<br/>ING. NAVAL · MAT. C.P.742</div></div>
          <div class="sig"><div>FIRMA ACEPTACIÓN DEL PRESUPUESTO</div></div>
          <div class="totals">
            <div><span>Exento:</span><strong>${fmtMoney(sum.exentoUsd)}</strong></div>
            <div><span>Gravado:</span><strong>${fmtMoney(sum.gravadoUsd)}</strong></div>
            <div><span>I.V.A.:</span><strong>${fmtMoney(sum.ivaUsd)}</strong></div>
            <div class="tot-final"><span>TOTAL</span><strong>${fmtMoney(sum.totalUsd)}</strong></div>
          </div>
        </div>
        <div class="addr">Domicilio 546 Nro 600 (7631) Quequén, Bs. As. Telef 02262-452181 Email: facturacion@aloncar.com.ar</div>
      </section>`
  }).join('')

  const win = window.open('', '_blank', 'width=980,height=800')
  if (!win) return
  win.document.write(`<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Presupuesto ${escapeHtml(ship?.name || '')}</title><style>
    body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:16px;background:#e5e7eb;color:#111}
    .sheet-page{background:#fff;width:210mm;min-height:282mm;margin:0 auto 18px;padding:10mm;box-sizing:border-box;display:flex;flex-direction:column;border:1px solid #111;page-break-after:always}
    .doc-header{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:6px;font-size:11px}
    .brand{font-weight:900;font-size:13px;margin-bottom:4px}.doc-meta{text-align:right}.presup{font-weight:700;border-bottom:1px solid #111;display:inline-block;margin:2px 0}.page-badge{background:#d1d5db;font-weight:900;padding:2px 8px;display:inline-block;margin-top:2px}
    .chars{font-size:10px;padding:4px 0;border-bottom:1px solid #111}
    table{width:100%;border-collapse:collapse;flex:1;margin-top:4px;font-size:11px}
    th,td{border:1px solid #111;padding:4px 6px;vertical-align:top}th{background:#f3f4f6;font-size:10px;text-transform:uppercase}
    .rubro-row td{background:#f3f4f6;text-transform:uppercase;font-size:11px}.c-item,.c-cant{text-align:center}.c-price{text-align:right;vertical-align:bottom;font-weight:700;white-space:nowrap}
    .c-concept{display:flex;flex-direction:column;justify-content:space-between}.mo-mat-labels{text-align:right;font-weight:700;font-size:10px;margin-top:4px}.mo-mat-vals div,.mo-mat-labels div{line-height:1.45}
    .doc-footer{display:grid;grid-template-columns:1fr 1fr 195px;border:1.5px solid #111;margin-top:8px;font-size:10px}
    .sig{border-right:1px solid #111;padding:6px;display:flex;flex-direction:column;justify-content:space-between;min-height:68px}.sig-name{text-align:center;font-weight:700}
    .totals div{display:flex;justify-content:space-between;padding:3px 6px;border-bottom:1px solid #ccc}.tot-final{background:#f3f4f6;font-size:11px;border-bottom:none!important}
    .addr{text-align:center;font-size:9px;margin-top:5px}
    @media print{body{background:#fff;padding:0}.sheet-page{border:none;margin:0}}
  </style></head><body>${pagesHtml}<script>window.onload=()=>window.print()</script></body></html>`)
  win.document.close()
}
