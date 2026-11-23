/**
 * billingPrintHelper.js
 * Genera una ventana de impresión limpia (A4) idéntica al presupuesto oficial
 * de Astillero Vanoli · Alon Car S.A., ocultando herramientas internas (rail de barcos,
 * manijas de arrastre, columnita rosada de IVA y panel derecho de costos).
 *
 * Motor Autofit Orgánico: cada fila abraza exactamente la altura real de su prosa + MAT/M.O.
 * (sin inflar filas) y el espacio remanente de la hoja A4 se absorbe en un único tramo de
 * cierre antes del cuadro de firmas.
 */

import { isCaldereriaChapter } from './billingMirrorEngine.js'
import { resolveBlockBillingQty } from './billingSheetMath.js'

function fmtMoney(val) {
  const n = Number(val) || 0
  const sign = n < 0 ? '-' : ''
  return `${sign}US$ ${Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function escapeHtml(str = '') {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * Limpia saltos vacíos al final del HTML de prosa (típicos de contentEditable)
 * para evitar huecos muertos debajo de los subtrabajos al imprimir.
 */
export function trimTrailingEmptyHtml(raw = '') {
  let out = String(raw || '').trim()
  const trailingEmptyPattern = /(?:\s|<br\s*\/?>|&nbsp;|<(?:div|p)>(?:\s|<br\s*\/?>|&nbsp;)*<\/(?:div|p)>)+$/i
  const leadingEmptyPattern = /^(?:\s|<br\s*\/?>|&nbsp;|<(?:div|p)>(?:\s|<br\s*\/?>|&nbsp;)*<\/(?:div|p)>)+/i
  out = out.replace(leadingEmptyPattern, '').replace(trailingEmptyPattern, '')
  return out
}

export function buildCleanBillingPrintHtml({
  ship,
  owner,
  budgetNumber = '',
  pages = [],
  pageSummaries = [],
  otRowMap = new Map(),
  printDensity = 'normal'
}) {
  const isCompact = printDensity === 'compact'
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
      const resolvedQty = resolveBlockBillingQty(block, { isCaldereria: isCald, weightKg: otRow?.weightKg || 0 })
      const qtyVal = resolvedQty == null ? '' : resolvedQty
      const unitTot = mode === 'UNITARIO' ? Number(((Number(qtyVal) || 0) * (Number(block.billing_unit_price_usd) || 0)).toFixed(2)) : 0

      let conceptSuffix = ''
      let unitCol = ''
      let totalCol = ''
      if (mode === 'MO_MAT') {
        conceptSuffix = `<div class="mo-mat-labels"><div>MAT</div><div>M.O.</div></div>`
        totalCol = `<div class="mo-mat-vals"><div>${fmtMoney(block.billing_mat_usd)}</div><div>${fmtMoney(block.billing_mo_usd)}</div></div>`
      } else if (mode === 'UNITARIO') {
        unitCol = `<div>${fmtMoney(block.billing_unit_price_usd)}</div>`
        totalCol = `<div>${fmtMoney(unitTot)}</div>`
      } else {
        unitCol = `<div class="sin-cargo">sin cargo</div>`
      }

      const proseHtml = trimTrailingEmptyHtml(block.billing_description || '')
      const fontSize = Math.max(10, Math.min(14, Number(block.fontSizePx) || 12))

      return `
        <tr class="item-row">
          <td class="c-item">${itemCounter}</td>
          <td class="c-cant">${qtyVal !== '' && qtyVal !== null ? Number(qtyVal).toLocaleString('es-AR', { maximumFractionDigits: 1 }) : ''}</td>
          <td class="c-concept"><div class="prose" style="font-size:${fontSize}px">${proseHtml}</div>${conceptSuffix}</td>
          <td class="c-price">${unitCol}</td>
          <td class="c-price">${totalCol}</td>
        </tr>`
    }).join('')

    return `
      <section class="sheet-page${isCompact ? ' is-compact' : ''}">
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
        <div class="sheet-body">
          <table class="items-table">
            <thead>
              <tr><th style="width:32px">Item</th><th style="width:52px">CANT.</th><th class="h-left">Concepto</th><th style="width:88px">US$ UNITARIO</th><th style="width:96px">TOTAL</th></tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
          <div class="sheet-filler" aria-hidden="true">
            <div class="filler-col"></div>
            <div class="filler-col"></div>
            <div class="filler-col"></div>
            <div class="filler-col"></div>
            <div class="filler-col"></div>
          </div>
        </div>
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

  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"/><title>Presupuesto ${escapeHtml(ship?.name || '')}</title><style>
    @page{size:A4 portrait;margin:0}
    *{box-sizing:border-box}
    body{font-family:Arial,Helvetica,sans-serif;margin:0;padding:16px;background:#e5e7eb;color:#111}
    .sheet-page{--row-py:4px;--rubro-py:4px;--prose-lh:1.38;--mom-mt:4px;background:#fff;width:210mm;min-height:296.5mm;margin:0 auto 18px;padding:10mm;display:flex;flex-direction:column;border:1px solid #111;page-break-after:always}
    .sheet-page.is-compact{--row-py:2.5px;--rubro-py:3px;--prose-lh:1.24;--mom-mt:2px}
    .sheet-page:last-child{page-break-after:auto}
    .doc-header{display:flex;justify-content:space-between;border-bottom:2px solid #111;padding-bottom:6px;font-size:11px}
    .brand{font-weight:900;font-size:13px;margin-bottom:4px}.doc-meta{text-align:right}.presup{font-weight:700;border-bottom:1px solid #111;display:inline-block;margin:2px 0}.page-badge{background:#d1d5db;font-weight:900;padding:2px 8px;display:inline-block;margin-top:2px}
    .chars{font-size:10px;padding:4px 0;border-bottom:1px solid #111}
    .sheet-body{flex:1 1 auto;display:flex;flex-direction:column;border:1px solid #111;margin-top:4px}
    .items-table{width:100%;border-collapse:separate;border-spacing:0;table-layout:fixed;flex:0 0 auto;font-size:11px}
    .items-table th,.items-table td{border-right:1px solid #111;border-bottom:1px solid #111;padding:var(--row-py) 6px;vertical-align:top}
    .items-table th:last-child,.items-table td:last-child{border-right:none}
    .items-table th{background:#f3f4f6;border-bottom:1.5px solid #111;font-size:10px;text-transform:uppercase;text-align:center;padding:4px 6px}
    .items-table th.h-left{text-align:left}
    .rubro-row td{background:#f3f4f6;padding:var(--rubro-py) 6px;text-transform:uppercase;font-size:10.5px}
    .item-row{break-inside:avoid;page-break-inside:avoid}
    .c-item,.c-cant{text-align:center;font-size:10.5px}
    .prose{white-space:pre-wrap;word-break:break-word;line-height:var(--prose-lh)}
    .prose p,.prose div{margin:0;padding:0}
    .c-price{text-align:right;vertical-align:bottom!important;font-weight:700;white-space:nowrap;font-size:10.5px}
    .sin-cargo{font-size:10px;font-weight:700;color:#333}
    .mo-mat-labels{text-align:right;font-weight:700;font-size:10.5px;margin-top:var(--mom-mt)}
    .mo-mat-vals{text-align:right;font-size:10.5px}
    .mo-mat-vals div,.mo-mat-labels div{line-height:1.4}
    .sheet-filler{flex:1 1 0;min-height:0;display:grid;grid-template-columns:32px 52px minmax(0,1fr) 88px 96px;width:100%}
    .filler-col{border-right:1px solid #111}.filler-col:last-child{border-right:none}
    .doc-footer{flex:0 0 auto;display:grid;grid-template-columns:1fr 1fr 195px;border:1.5px solid #111;margin-top:6px;font-size:10px}
    .sig{border-right:1px solid #111;padding:6px;display:flex;flex-direction:column;justify-content:space-between;min-height:66px}.sig-name{text-align:center;font-weight:700}
    .totals div{display:flex;justify-content:space-between;padding:3px 6px;border-bottom:1px solid #ccc}.tot-final{background:#f3f4f6;font-size:11px;border-bottom:none!important}
    .addr{flex:0 0 auto;text-align:center;font-size:9px;margin-top:5px}
    @media print{body{background:#fff;padding:0}.sheet-page{border:none;margin:0}}
  </style></head><body>${pagesHtml}<script>window.onload=()=>window.print()</script></body></html>`
}

export function openCleanBillingPrintWindow(params) {
  const win = window.open('', '_blank', 'width=980,height=800')
  if (!win) return
  win.document.write(buildCleanBillingPrintHtml(params))
  win.document.close()
}
