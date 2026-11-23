/**
 * billingPdfArchiveEngine.js
 * Generador PDF A4 del Remito Comercial y archivador automático en `ship_documents`
 * + Storage `ship-documents`, vinculado a Barco, Fecha de impresión y Nº de Presupuesto.
 */
import { shipDocumentsRepository } from '../repositories/shipsRepository.js'
import { isCaldereriaChapter } from './billingMirrorEngine.js'
import { resolveBlockBillingQty } from './billingSheetMath.js'
import { formatLongSpanishDate, getTodayIsoDate } from './aloncarLogoSvg.js'
import { pdfEscape, stripHtmlToLines, wrapText, assembleA4PdfBytes } from './pdf14Writer.js'

function fmtMoneyPdf(val) {
  const n = Number(val) || 0
  return `${n < 0 ? '-' : ''}US$ ${Math.abs(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function buildPageStream({ ship, owner, budgetNumber, issueDate, pageBlocks, summary, pageIdx, startItemIndex, startRubro }) {
  const cmds = []
  const text = (x, y, str, size = 9, bold = false) => {
    cmds.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf 1 0 0 1 ${x.toFixed(1)} ${y.toFixed(1)} Tm (${pdfEscape(str)}) Tj ET`)
  }
  const line = (x1, y1, x2, y2, w = 0.8) => {
    cmds.push(`${w} w ${x1.toFixed(1)} ${y1.toFixed(1)} m ${x2.toFixed(1)} ${y2.toFixed(1)} l S`)
  }
  const rect = (x, y, w, h, lw = 0.8, fillGray = null) => {
    if (fillGray !== null) cmds.push(`q ${fillGray} g ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re f Q`)
    if (lw > 0) cmds.push(`${lw} w ${x.toFixed(1)} ${y.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)} re S`)
  }

  // Logo circular (AV) arriba a la izquierda
  const cx = 74; const cy = 795; const r = 20; const k = r * 0.5523
  cmds.push(`1.8 w ${cx + r} ${cy} m ${cx + r} ${cy + k} ${cx + k} ${cy + r} ${cx} ${cy + r} c ${cx - k} ${cy + r} ${cx - r} ${cy + k} ${cx - r} ${cy} c ${cx - r} ${cy - k} ${cx - k} ${cy - r} ${cx} ${cy - r} c ${cx + k} ${cy - r} ${cx + r} ${cy - k} ${cx + r} ${cy} c S`)
  text(cx - 12, cy - 6, 'AV', 16, true)
  text(34, 764, 'ASTILLERO VANOLI', 7.5, true)
  text(43, 754, 'ALON CAR S.A.', 7.5, true)

  // Recuadro estandarizado del encabezado (Imagen 2)
  const bx = 132; const bw = 435; const bh = pageIdx === 0 ? 112 : 66; const by = 815 - bh
  rect(bx, by, bw, bh, 1.2)
  text(bx + 6, 797, 'Señores:', 8.5, false)
  text(bx + 48, 797, String(owner?.name || ship?.client_name || '').toUpperCase().slice(0, 42), 9, true)
  text(bx + 305, 802, `Necochea, ${formatLongSpanishDate(issueDate)}`, 8.5, false)
  text(bx + 32, 783, `mail: ${owner?.email_principal || ''}`.slice(0, 52), 8, false)

  line(bx, 776, bx + bw, 776, 1.0)
  line(bx, 763, bx + 335, 763, 1.0)
  text(bx + 340, 766, `Presupuesto Nº: ${budgetNumber ? String(budgetNumber).trim() : 'PENDIENTE'}`, 8.5, true)
  line(bx + 340, 764, bx + bw - 4, 764, 0.7)
  rect(bx + bw - 58, 750, 57, 12, 0, 0.85)
  text(bx + bw - 50, 753, `HOJA ${summary.pageNumber}/${summary.totalPages}`, 8, true)

  if (pageIdx === 0) {
    text(bx + 6, 752, 'De nuestra consideración:', 8, false)
    text(bx + 18, 741, 'Por la presente tenemos el agrado de dirigirnos a uds. A efectos de entregarles el sig. presupuesto', 7.8, false)
    text(bx + 6, 726, 'CARACTERÍSTICAS:', 8, true)
    text(bx + 6, 715, `Nombre del buque: ${String(ship?.name || '').toUpperCase()}`, 8, true)
    text(bx + 235, 715, `Matr.: ${ship?.matricula || ''}`, 8, false)
    text(bx + 18, 705, `Eslora: ${ship?.eslora_mts ? `${ship.eslora_mts} m` : ''}`, 8, false)
    text(bx + 125, 705, `Manga: ${ship?.manga_mts ? `${ship.manga_mts} m` : ''}`, 8, false)
    text(bx + 235, 705, `Puntal: ${ship?.puntal_mts ? `${ship.puntal_mts} m` : ''}`, 8, false)
  }

  // Tabla de ítems
  const tx = 28; const tw = 539; const headerTop = by - 8; const headerH = 18; const footerTop = 104
  const cols = [tx, tx + 26, tx + 68, tx + 398, tx + 468, tx + tw]
  rect(tx, headerTop - headerH, tw, headerH, 1.0, 0.93)
  text(cols[0] + 4, headerTop - 12, 'Item', 8, true)
  text(cols[1] + 8, headerTop - 12, 'CANT.', 8, true)
  text(cols[2] + 6, headerTop - 12, 'Concepto', 8, true)
  text(cols[3] + 6, headerTop - 12, 'US$ UNIT.', 8, true)
  text(cols[4] + 18, headerTop - 12, 'TOTAL', 8, true)

  const bodyTop = headerTop - headerH
  rect(tx, footerTop, tw, bodyTop - footerTop, 1.0)
  for (let c = 1; c < cols.length - 1; c += 1) line(cols[c], footerTop, cols[c], headerTop, 0.6)

  let y = bodyTop - 12
  let itemIdx = startItemIndex
  let activeRubro = startRubro

  for (const block of pageBlocks || []) {
    if (y < footerTop + 26) break
    if (block.blockType === 'RUBRO_DELIMITER') {
      activeRubro = block.label || ''
      rect(tx, y - 4, tw, 15, 0.6, 0.92)
      text(cols[0] + 6, y, String(block.label || '').toUpperCase().slice(0, 75), 8.5, true)
      y -= 17
      continue
    }

    itemIdx += 1
    const isCald = isCaldereriaChapter(activeRubro || block.billing_rubro_group)
    const mode = block.billing_pricing_mode || 'MO_MAT'
    const qty = resolveBlockBillingQty(block, { isCaldereria: isCald, weightKg: block._weightKg || 0 })
    const wrapped = stripHtmlToLines(block.billing_description || '').flatMap((l) => wrapText(l, 64)).slice(0, 12)
    const rowLines = Math.max(wrapped.length + (mode === 'MO_MAT' ? 2 : 0), 2)
    const rowH = Math.min(rowLines * 10 + 8, Math.max(24, y - footerTop - 4))
    const rowBottom = y + 9 - rowH

    text(cols[0] + 8, y, String(itemIdx), 8, false)
    if (qty != null && qty !== '') text(cols[1] + 6, y, Number(qty).toLocaleString('es-AR', { maximumFractionDigits: 1 }), 8, false)

    let ly = y
    wrapped.forEach((ln, idx) => {
      if (ly > rowBottom + 3) { text(cols[2] + 5, ly, ln, 8, idx === 0); ly -= 10 }
    })

    if (mode === 'MO_MAT') {
      text(cols[3] - 24, rowBottom + 13, 'MAT', 7.5, true)
      text(cols[3] - 24, rowBottom + 3, 'M.O.', 7.5, true)
      text(cols[4] + 5, rowBottom + 13, fmtMoneyPdf(block.billing_mat_usd), 7.8, true)
      text(cols[4] + 5, rowBottom + 3, fmtMoneyPdf(block.billing_mo_usd), 7.8, true)
    } else if (mode === 'UNITARIO') {
      const unitTot = Number(((Number(qty) || 0) * (Number(block.billing_unit_price_usd) || 0)).toFixed(2))
      text(cols[3] + 4, rowBottom + 4, fmtMoneyPdf(block.billing_unit_price_usd), 7.8, true)
      text(cols[4] + 5, rowBottom + 4, fmtMoneyPdf(unitTot), 7.8, true)
    } else {
      text(cols[3] + 12, rowBottom + 4, 'sin cargo', 7.8, true)
    }

    line(tx, rowBottom, tx + tw, rowBottom, 0.5)
    y = rowBottom - 11
  }

  // Pie oficial de firmas y totales
  const fTop = 98; const fBot = 36
  rect(tx, fBot, tw, fTop - fBot, 1.0)
  line(tx + 185, fBot, tx + 185, fTop, 0.8)
  line(tx + 370, fBot, tx + 370, fTop, 0.8)
  text(tx + 6, fTop - 11, 'FIRMA DE QUIEN REALIZA EL PRESUPUESTO', 6.8, true)
  text(tx + 36, fBot + 16, 'HUGO C. OBREGOZO', 8, true)
  text(tx + 28, fBot + 6, 'ING. NAVAL · MAT. C.P.742', 7, false)
  text(tx + 192, fTop - 11, 'FIRMA ACEPTACIÓN DEL PRESUPUESTO', 6.8, true)

  const tX = tx + 376
  text(tX, fTop - 13, `Exento: ${fmtMoneyPdf(summary.exentoUsd)}`, 8, true)
  text(tX, fTop - 27, `Gravado: ${fmtMoneyPdf(summary.gravadoUsd)}`, 8, false)
  text(tX, fTop - 41, `I.V.A.: ${fmtMoneyPdf(summary.ivaUsd)}`, 8, false)
  rect(tx + 370.5, fBot + 0.5, tw - 371, 16, 0, 0.93)
  text(tX, fBot + 5, `TOTAL: ${fmtMoneyPdf(summary.totalUsd)}`, 8.5, true)
  text(tx + 82, 22, 'Domicilio 546 Nro 600 (7631) Quequén, Bs. As. · Telef 02262-452181 · Email: facturacion@aloncar.com.ar', 7.2, false)

  return { stream: cmds.join('\n'), nextItemIndex: itemIdx, nextRubro: activeRubro }
}

export function buildBillingRemitoPdfBytes({ ship, owner, budgetNumber = '', issueDate = '', pages = [[]], pageSummaries = [], otRowMap = new Map() }) {
  const safePages = Array.isArray(pages) && pages.length > 0 ? pages : [[]]
  let itemIdx = 0
  let rubro = ''
  const pageStreams = safePages.map((pBlocks, pIdx) => {
    const enriched = (pBlocks || []).map((b) => ({
      ...b,
      _weightKg: b.workOrderId ? otRowMap.get(b.workOrderId)?.weightKg || 0 : 0,
    }))
    const sum = pageSummaries[pIdx] || { pageNumber: pIdx + 1, totalPages: safePages.length, exentoUsd: 0, gravadoUsd: 0, ivaUsd: 0, totalUsd: 0 }
    const res = buildPageStream({ ship, owner, budgetNumber, issueDate, pageBlocks: enriched, summary: sum, pageIdx: pIdx, startItemIndex: itemIdx, startRubro: rubro })
    itemIdx = res.nextItemIndex
    rubro = res.nextRubro
    return res.stream
  })
  return assembleA4PdfBytes(pageStreams)
}

export function buildBillingArchiveFileName({ shipName = 'BUQUE', budgetNumber = '', issueDate = '' }) {
  const safeShip = String(shipName || 'BUQUE').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '')
  const safeBudget = String(budgetNumber || 'SIN_NRO').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const safeDate = String(issueDate || getTodayIsoDate()).replace(/[^0-9-]/g, '')
  return `Presupuesto_${safeBudget}_${safeShip}_${safeDate}.pdf`
}

export async function archiveShipRemitoPdfService({
  ship, owner, budgetNumber = '', issueDate = '', pages = [[]], pageSummaries = [], otRowMap = new Map(), grandTotal = {}, user = 'Gerencia'
}) {
  const resolvedDate = issueDate || getTodayIsoDate()
  const fileName = buildBillingArchiveFileName({ shipName: ship?.name, budgetNumber, issueDate: resolvedDate })
  const pdfBytes = buildBillingRemitoPdfBytes({ ship, owner, budgetNumber, issueDate: resolvedDate, pages, pageSummaries, otRowMap })
  const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' })
  const filePath = `${ship.id}/remitos/${Date.now()}_${fileName}`

  const { data: uploadData, error: uploadError } = await shipDocumentsRepository.uploadToStorage(filePath, pdfBlob)
  if (uploadError) throw new Error(`Error subiendo PDF del remito: ${uploadError}`)

  const fileUrl = uploadData?.publicUrl || ''
  const title = `Presupuesto Nº ${budgetNumber || 'PENDIENTE'} · ${ship.name} · ${resolvedDate}`
  const { data: docRow, error: docErr } = await shipDocumentsRepository.insertOne({
    ship_id: ship.id,
    doc_type: 'remito_presupuesto',
    title,
    file_name: fileName,
    file_url: fileUrl,
    file_size_bytes: pdfBytes.length,
    uploaded_by: String(user || 'Gerencia'),
  })
  if (docErr) console.warn('[ship_documents] Error registrando adjunto de remito:', docErr)

  return {
    id: `arch_${Date.now()}`,
    documentId: docRow?.id || null,
    shipId: ship.id,
    shipName: ship.name,
    clientName: owner?.name || ship.client_name || '',
    budgetNumber: String(budgetNumber || '').trim() || null,
    issueDate: resolvedDate,
    sentAt: new Date().toISOString(),
    sentBy: String(user || 'Gerencia'),
    exentoUsd: Number(grandTotal?.exentoUsd) || 0,
    gravadoUsd: Number(grandTotal?.gravadoUsd) || 0,
    ivaUsd: Number(grandTotal?.ivaUsd) || 0,
    totalUsd: Number(grandTotal?.totalUsd) || 0,
    operationalCostUsd: Number(grandTotal?.operationalCostUsd) || 0,
    fileName,
    fileUrl,
  }
}
