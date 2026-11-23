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
import { ALONCAR_AV_LOGO_SVG, formatLongSpanishDate } from './aloncarLogoSvg.js'

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
  issueDate = '',
  pages = [],
  pageSummaries = [],
  otRowMap = new Map(),
  printDensity = 'normal'
}) {
  const isCompact = printDensity === 'compact'
  const formattedDate = formatLongSpanishDate(issueDate)
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
        <div class="doc-top">
          <div class="brand-col">
            <div class="brand-logo">${ALONCAR_AV_LOGO_SVG}</div>
            <div class="brand-name">ASTILLERO VANOLI<br/>ALON CAR S.A.</div>
          </div>
          <div class="header-frame">
            <div class="hf-row-top">
              <div class="hf-client">
                <div class="hf-senores"><span class="hf-lbl">Señores:</span><span class="hf-val-box">${escapeHtml(String(owner?.name || ship?.client_name || '').toUpperCase())}</span></div>
                <div class="hf-mail"><span class="hf-lbl">mail:</span><span class="hf-mail-box">${escapeHtml(owner?.email_principal || '')}</span></div>
              </div>
              <div class="hf-date">Necochea, &nbsp;&nbsp;${escapeHtml(formattedDate)}</div>
            </div>
            <div class="hf-divider-band">
              <div class="hf-double-line"></div>
              <div class="hf-presup">Presupuesto Nº: &nbsp;${escapeHtml(budgetNumber || 'PENDIENTE')}</div>
            </div>
            <div class="hf-hoja-row">
              <div class="hf-salutation">
                ${pIdx === 0 ? '<div>De nuestra consideración:</div><div class="hf-indent">Por la presente tenemos el agrado de dirigirnos a uds. A efectos de entregarles el sig. presupuesto</div>' : ''}
              </div>
              <div class="page-badge">HOJA ${sum.pageNumber}/${sum.totalPages}</div>
            </div>
            ${pIdx === 0 ? `
            <div class="chars">
              <div class="chars-title">CARACTERÍSTICAS:</div>
              <div class="chars-grid-1">
                <span>Nombre del buque: <strong>${escapeHtml(String(ship?.name || '').toUpperCase())}</strong></span>
                <span>Matr.: <strong>${escapeHtml(ship?.matricula || '')}</strong></span>
              </div>
              <div class="chars-grid-2">
                <span>Eslora: <strong>${ship?.eslora_mts ? `${ship.eslora_mts} m` : ''}</strong></span>
                <span>Manga: <strong>${ship?.manga_mts ? `${ship.manga_mts} m` : ''}</strong></span>
                <span>Puntal: <strong>${ship?.puntal_mts ? `${ship.puntal_mts} m` : ''}</strong></span>
              </div>
            </div>` : ''}
          </div>
        </div>
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
    .doc-top{display:grid;grid-template-columns:110px minmax(0,1fr);gap:8px;align-items:start;margin-bottom:4px}
    .brand-col{text-align:center;padding-top:2px}.brand-logo{width:54px;height:54px;margin:0 auto 4px}.brand-logo svg{width:100%;height:100%}
    .brand-name{font-weight:900;font-size:8.5px;line-height:1.25;letter-spacing:.2px}
    .header-frame{border:1.6px solid #111;font-size:10px;padding:0}
    .hf-row-top{display:flex;justify-content:space-between;align-items:flex-start;padding:6px 8px 5px;gap:8px}
    .hf-client{flex:1;min-width:0}.hf-senores{display:flex;align-items:center;gap:6px;margin-bottom:3px}
    .hf-lbl{font-size:10px;white-space:nowrap}.hf-val-box{background:#f3f4f6;padding:1px 6px;font-weight:800;font-size:11px;min-width:160px;display:inline-block}
    .hf-mail{display:flex;align-items:center;gap:6px;padding-left:28px}.hf-mail-box{background:#f3f4f6;padding:1px 6px;font-size:9.5px;min-width:120px;display:inline-block}
    .hf-date{font-size:10px;white-space:nowrap;text-align:right}
    .hf-divider-band{display:grid;grid-template-columns:1fr auto;align-items:center;border-top:1.5px solid #111;padding:0 8px 0 0;gap:12px}
    .hf-double-line{border-bottom:1.5px solid #111;height:14px}
    .hf-presup{font-weight:700;font-size:10px;border-bottom:1px solid #111;padding:1px 2px;white-space:nowrap}
    .hf-hoja-row{display:flex;justify-content:space-between;align-items:flex-start;padding:3px 0 3px 8px;gap:6px}
    .hf-salutation{font-size:9.5px;line-height:1.35}.hf-indent{padding-left:18px}
    .page-badge{background:#d1d5db;font-weight:900;padding:2px 8px;font-size:9.5px;white-space:nowrap}
    .chars{font-size:9.5px;padding:4px 8px 5px;line-height:1.45}.chars-title{font-weight:700;margin-bottom:1px}
    .chars-grid-1{display:grid;grid-template-columns:1.35fr 1fr;gap:8px}
    .chars-grid-2{display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;padding-left:14px}
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
