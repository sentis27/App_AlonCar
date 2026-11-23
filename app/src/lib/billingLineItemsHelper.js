/**
 * billingLineItemsHelper.js
 * Motor puro para sub-ítems de cobro individual por renglón (modo `ITEMS` · Imagen 1):
 * normalización, conversión desde plantillas OT.ABC o prosa HTML, edición de encabezado y totales.
 */
import { normalizeOtAbcLineItems } from './otAbcCatalogConstants.js'

function round2(n) {
  return Number((Number(n) || 0).toFixed(2))
}

export function normalizeBillingLineItems(rawItems = []) {
  if (!Array.isArray(rawItems)) return []
  return rawItems
    .filter((item) => item && typeof item === 'object')
    .map((item, idx) => {
      const isNote = Boolean(item.is_note || item.row_type === 'NOTE')
      const rawQty = item.qty
      const parsedQty = rawQty === '' || rawQty === null || rawQty === undefined ? 1 : Number(rawQty)
      const parsedPrice = Number(item.unit_price_usd)
      return {
        id: String(item.id || `sub_${idx + 1}`),
        text: String(item.text ?? item.concept ?? '').trim(),
        qty: isNote ? null : (Number.isFinite(parsedQty) ? parsedQty : 1),
        unit_price_usd: isNote || !Number.isFinite(parsedPrice) ? 0 : parsedPrice,
        tax_type: item.tax_type === 'GRAVADO_21' ? 'GRAVADO_21' : 'EXENTO',
        is_note: isNote
      }
    })
}

export function buildBillingLineItemsFromTemplate(tpl) {
  const lines = normalizeOtAbcLineItems(tpl?.line_items)
    .sort((a, b) => (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0))
  return lines
    .map((row, idx) => {
      const isNote = row.row_type === 'NOTE'
      const text = row.row_type === 'SUBWORK' && row.subwork_title
        ? (row.concept ? `${row.subwork_title}: ${row.concept}` : row.subwork_title)
        : (row.concept || row.subwork_title || '')
      return {
        id: String(row.id || `sub_${idx + 1}`),
        text: text.trim(),
        qty: isNote ? null : 1,
        unit_price_usd: isNote ? 0 : (Number(row.unit_price_usd) || 0),
        tax_type: row.tax_type === 'GRAVADO_21' ? 'GRAVADO_21' : 'EXENTO',
        is_note: isNote
      }
    })
    .filter((it) => it.text.length > 0)
}

export function shouldTemplateDefaultToItemsMode(tpl) {
  const items = buildBillingLineItemsFromTemplate(tpl)
  return items.filter((it) => !it.is_note).length >= 2
}

export function extractBlockHeadingText(html = '', fallback = '') {
  const raw = String(html || '').trim()
  if (!raw) return String(fallback || '').trim().toUpperCase()
  const boldMatch = raw.match(/<(?:b|strong)[^>]*>([\s\S]*?)<\/(?:b|strong)>/i)
  const firstRaw = boldMatch ? boldMatch[1] : raw.split(/<br\s*\/?>|<\/(?:p|div|li)>|\r?\n/i)[0]
  const clean = String(firstRaw || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .trim()
  return clean || String(fallback || '').trim().toUpperCase()
}

export function replaceBlockHeadingInHtml(html = '', nextHeading = '') {
  const cleanTitle = String(nextHeading || '').trim()
  const escaped = cleanTitle.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const raw = String(html || '').trim()
  if (!raw) return escaped ? `<b>${escaped}</b>` : ''
  if (/<(?:b|strong)[^>]*>[\s\S]*?<\/(?:b|strong)>/i.test(raw)) {
    return raw.replace(/<(?:b|strong)[^>]*>[\s\S]*?<\/(?:b|strong)>/i, `<b>${escaped}</b>`)
  }
  const parts = raw.split(/<br\s*\/?>/i)
  parts[0] = `<b>${escaped}</b>`
  return parts.join('<br/>')
}

export function buildLineItemsFromProseHtml(html = '', defaultTax = 'EXENTO', defaultUnitPrice = 0) {
  const plain = String(html || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
  const lines = plain.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const bodyLines = lines.length > 1 ? lines.slice(1) : lines
  const tax = defaultTax === 'GRAVADO_21' ? 'GRAVADO_21' : 'EXENTO'
  return bodyLines.map((line, idx) => {
    const clean = line.replace(/^[•\-*]\s*/, '').trim()
    const isNote = /^(?:nota:|no\s+incluye|pinturas\s+y\s+diluyente)/i.test(clean)
    return {
      id: `sub_${Date.now()}_${idx + 1}`,
      text: clean,
      qty: isNote ? null : 1,
      unit_price_usd: !isNote && idx === 0 ? (Number(defaultUnitPrice) || 0) : 0,
      tax_type: tax,
      is_note: isNote
    }
  })
}

export function buildPricingModeChangePatch(block, mode, matchedTpl = null) {
  const patch = { billing_pricing_mode: mode }
  if (mode === 'ITEMS' && (!Array.isArray(block?.billing_line_items) || block.billing_line_items.length === 0)) {
    const fromTpl = matchedTpl ? buildBillingLineItemsFromTemplate(matchedTpl) : []
    const seeded = fromTpl.length > 0
      ? fromTpl
      : buildLineItemsFromProseHtml(block?.billing_description, block?.billing_mo_tax, block?.billing_unit_price_usd)
    patch.billing_line_items = seeded.length > 0
      ? seeded
      : [{ id: `sub_${Date.now()}_1`, text: '', qty: 1, unit_price_usd: 0, tax_type: block?.billing_mo_tax || 'EXENTO', is_note: false }]
  }
  return patch
}

export function computeLineItemsBillingBreakdown(rawItems = []) {
  const items = normalizeBillingLineItems(rawItems)
  let exentoUsd = 0
  let gravadoUsd = 0
  for (const it of items) {
    if (it.is_note) continue
    const lineTotal = round2((Number(it.qty) || 0) * (Number(it.unit_price_usd) || 0))
    if (it.tax_type === 'GRAVADO_21') gravadoUsd += lineTotal
    else exentoUsd += lineTotal
  }
  exentoUsd = round2(exentoUsd)
  gravadoUsd = round2(gravadoUsd)
  const ivaUsd = round2(gravadoUsd * 0.21)
  return { exentoUsd, gravadoUsd, ivaUsd, totalUsd: round2(exentoUsd + gravadoUsd + ivaUsd) }
}
