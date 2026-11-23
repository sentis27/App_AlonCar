/**
 * billingMirrorEngine.js — Clasificación e importación determinística (100% SIN IA) hacia la Sábana Blanca.
 */
import { normalizeText, parseWorkerTrades } from './tradesCatalog.js'
import { resolveTemplateBillingDescription } from './otAbcCatalogConstants.js'
import {
  buildBillingLineItemsFromTemplate,
  shouldTemplateDefaultToItemsMode
} from './billingLineItemsHelper.js'
import { buildOrderedImportWithDelimiters } from './billingImportOrderEngine.js'

export const BILLABLE_OT_STATUSES = new Set([
  'EN EJECUCION', 'EN PROGRESO', 'FINALIZADO', 'COMPLETADA', 'PENDIENTE REMITO',
  'REMITO REALIZADO/PDTE FIRMA', 'FINALIZADO COSTO FINAL DE OBRA'
])

export const EXCLUDED_OT_STATUSES = new Set([
  'DESESTIMADO', 'CANCELADA', 'PENDIENTE DE INICIO', 'FACTURADO'
])

export const BILLING_CHAPTER_SEQUENCE = [
  { key: 'OT_ABC', label: 'SERVICIOS Y TARIFARIO VARADERO', order: 10, showsKgInCant: false },
  { key: 'TORNERIA', label: 'TORNERÍA', order: 20, showsKgInCant: false },
  { key: 'CARENADO', label: 'CARENADO Y SUPERESTRUCTURA', order: 30, showsKgInCant: false },
  { key: 'CALDERERIA', label: 'CALDERERÍA', order: 40, showsKgInCant: true },
  { key: 'RASCHINAJE', label: 'RASCHINAJE', order: 50, showsKgInCant: false },
  { key: 'MECANICA', label: 'MECÁNICA NAVAL', order: 60, showsKgInCant: false },
  { key: 'CARPINTERIA', label: 'CARPINTERÍA', order: 70, showsKgInCant: false },
  { key: 'ELECTRICIDAD', label: 'ELECTRICIDAD', order: 80, showsKgInCant: false },
  { key: 'PINTURA', label: 'PINTURA', order: 90, showsKgInCant: false },
  { key: 'TANQUES_SENTINA', label: 'TANQUES Y SENTINA', order: 100, showsKgInCant: false },
  { key: 'SERVICIOS', label: 'SERVICIOS Y VARIOS', order: 110, showsKgInCant: false }
]

const CHAPTER_BY_KEY = new Map(BILLING_CHAPTER_SEQUENCE.map((c) => [c.key, c]))

const RUBRO_KEYWORDS = [
  { key: 'TORNERIA', regex: /\b(TORNER|TORNO|BOCINA|MECHA|EJE\s+PORTA|PORTAHELICE|HELICE|BUJE|ALESAD|MECANIZAD|PRENSAESTOPA|YUGO)\b/ },
  { key: 'CARENADO', regex: /\b(CARENAD|ARENAD|HIDROARENAD|LAVADO\s+DE\s+CASCO|SUPERESTRUCTURA|LINEA\s+DE\s+FLOTACION|ANCLAS?\s+Y\s+CADENAS?)\b/ },
  { key: 'CALDERERIA', regex: /\b(CALDER|CHAPA|MAMPARO|BOTAZO|BORDA|PROA|ALARGUE|ENFRIADOR|BARQUILLA|TRANCANIL|REGALA|PANTOQUE|SOLDAD|ESTRUCTURA|TOBERA|TAPA\s+DE\s+REGISTRO|CAJA\s+DE\s+PASTECA)\b/ },
  { key: 'RASCHINAJE', regex: /\b(RASCHIN|CEMENTO|HORMIGON|PICARET)\b/ },
  { key: 'CARPINTERIA', regex: /\b(CARPINT|MADERA|AISLACION|POLIURETANO|CUBIERTA\s+DE\s+MADERA|FENOLICO|REVESTIMIENTO)\b/ },
  { key: 'ELECTRICIDAD', regex: /\b(ELECTR|TABLERO|CABLE|GENERADOR|ALARMA|LUMINAR|TRASDUCER|BATERIA|LUCES)\b/ },
  { key: 'PINTURA', regex: /\b(PINTUR|PINTAD|EPOXI|BITUMINOSO|ANTICORROSIVO)\b/ },
  { key: 'TANQUES_SENTINA', regex: /\b(TANQUE|SENTINA|POCETE|HIDROCARBURO|ACHIQUE)\b/ },
  { key: 'MECANICA', regex: /\b(MECANIC|MOTOR|GUINCHE|TIMON|VALVULA|HIDRAUL|BOMBA|CAJA\s+REDUCTORA|MMPP|MMGG)\b/ }
]

export function isCaldereriaChapter(rubroOrLabel = '') {
  return normalizeText(rubroOrLabel).includes('CALDER')
}

function mapRawRubroToChapterKey(rawRubro = '') {
  const n = normalizeText(rawRubro)
  if (!n || n === 'GENERAL' || n === 'VARIOS' || n === 'ASTILLERO') return null
  if (n.includes('TORN') || n.includes('BUJE') || n.includes('RECTIFIC')) return 'TORNERIA'
  if (n.includes('CALDER') || n.includes('SOLDAD') || n.includes('CORTE') || n.includes('PLEGAD')) return 'CALDERERIA'
  if (n.includes('RASCHIN') || n.includes('HORMIGON')) return 'RASCHINAJE'
  if (n.includes('CARPINT') || n.includes('AMOBL')) return 'CARPINTERIA'
  if (n.includes('ELECTR')) return 'ELECTRICIDAD'
  if (n.includes('PINT') || n.includes('ARENAD')) return 'PINTURA'
  if (n.includes('MECAN') || n.includes('HIDRAUL') || n.includes('FRIGOR')) return 'MECANICA'
  return null
}

function escapeHtmlBasic(str = '') {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildCatalogBillingProse(tpl, fallbackTitle = '') {
  if (!tpl) return ''
  const titleUpper = String(tpl.name || fallbackTitle || '').trim().toUpperCase()
  const rawBilling = resolveTemplateBillingDescription(tpl)
  if (!rawBilling) return titleUpper ? `<b>${escapeHtmlBasic(titleUpper)}</b>` : ''
  const lines = rawBilling.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const bodyHtml = lines.map((l) => escapeHtmlBasic(l)).join('<br/>')
  return titleUpper ? `<b>${escapeHtmlBasic(titleUpper)}</b><br/>${bodyHtml}` : bodyHtml
}

export function matchOtToAbcTemplate(wo, otTemplates = []) {
  if (!wo || !Array.isArray(otTemplates) || otTemplates.length === 0) return null
  if (wo.ot_template_id) {
    const byId = otTemplates.find((tpl) => tpl.id === wo.ot_template_id)
    if (byId) return byId
  }
  const titleNorm = normalizeText(wo.title || '')
  if (!titleNorm) return null
  const exact = otTemplates.find((tpl) => normalizeText(tpl.name) === titleNorm)
  if (exact) return exact
  return (
    otTemplates.find((tpl) => {
      const tplNorm = normalizeText(tpl.name)
      return tplNorm.length >= 5 && (titleNorm.includes(tplNorm) || tplNorm.includes(titleNorm))
    }) || null
  )
}

/** Clasificador Determinístico SIN IA (Catálogo OT.ABC en orden PDF + Rubros reales + Keywords). */
export function inferOtChapterDeterministic({
  wo, woItems = [], laborRows = [], materialRows = [], thirdPartyRows = [], workers = [], otTemplates = []
}) {
  const matchedTpl = matchOtToAbcTemplate(wo, otTemplates)
  if (matchedTpl) {
    const chapter = CHAPTER_BY_KEY.get('OT_ABC')
    const defaultLineItems = buildBillingLineItemsFromTemplate(matchedTpl)
    const useItemsMode = shouldTemplateDefaultToItemsMode(matchedTpl)
    const rawLines = Array.isArray(matchedTpl.line_items) ? matchedTpl.line_items : []
    const firstPriced = rawLines.find((l) => l?.row_type !== 'NOTE' && Number(l?.unit_price_usd) > 0) || null
    const taxType = matchedTpl.default_tax_type === 'GRAVADO_21' ? 'GRAVADO_21' : 'EXENTO'
    const defaultPricingMode = useItemsMode ? 'ITEMS' : (firstPriced ? 'UNITARIO' : 'MO_MAT')

    return {
      chapterKey: chapter.key,
      chapterLabel: chapter.label,
      chapterOrder: chapter.order,
      subOrder: Number(matchedTpl.sort_order) || 999,
      isTabulatedAbc: true,
      matchedTemplate: matchedTpl,
      defaultTaxType: taxType,
      defaultPricingMode,
      defaultUnitPriceUsd: defaultPricingMode === 'UNITARIO' ? (Number(firstPriced?.unit_price_usd) || 0) : 0,
      defaultLineItems: useItemsMode ? defaultLineItems : [],
      showsKgInCant: false
    }
  }

  const scores = new Map()
  const addScore = (k, w) => { if (k) scores.set(k, (scores.get(k) || 0) + w) }
  const workerByName = new Map((workers || []).map((w) => [normalizeText(w.name), w]))

  for (const log of laborRows) {
    if (log.workOrderId !== wo.id) continue
    addScore(mapRawRubroToChapterKey(log.rubro || log.workerTrade), 3 + Math.min(Number(log.hoursPhysical) || 0, 40) * 0.1)
  }
  for (const tp of thirdPartyRows) {
    if (tp.workOrderId === wo.id) addScore(mapRawRubroToChapterKey(tp.rubro), 4)
  }
  const contractors = new Set([wo.contractor_name].filter(Boolean))
  for (const item of woItems) {
    if (item.contractor_name) contractors.add(item.contractor_name)
    if (Array.isArray(item.contractors)) item.contractors.forEach((c) => contractors.add(c))
  }
  for (const cName of contractors) {
    const w = workerByName.get(normalizeText(cName))
    if (w?.trade) parseWorkerTrades(w.trade).rawList.forEach((t) => addScore(mapRawRubroToChapterKey(t), 3))
  }
  for (const mat of materialRows) {
    if (mat.workOrderId === wo.id) addScore(mapRawRubroToChapterKey(mat.rubro), 2)
  }
  const textNorm = normalizeText(`${wo.title || ''} ${wo.description || ''} ${woItems.map((i) => i.description || '').join(' ')}`)
  for (const rule of RUBRO_KEYWORDS) if (rule.regex.test(textNorm)) addScore(rule.key, 2.5)

  let winningKey = 'SERVICIOS'
  let maxScore = 0
  for (const [key, score] of scores.entries()) {
    if (score > maxScore) { maxScore = score; winningKey = key }
  }
  const chapter = CHAPTER_BY_KEY.get(winningKey) || CHAPTER_BY_KEY.get('SERVICIOS')
  const otNumDigits = Number(String(wo.ot_number || '').replace(/\D+/g, '')) || 9999
  return {
    chapterKey: chapter.key,
    chapterLabel: chapter.label,
    chapterOrder: chapter.order,
    subOrder: otNumDigits,
    isTabulatedAbc: false,
    matchedTemplate: null,
    defaultTaxType: 'EXENTO',
    defaultPricingMode: 'MO_MAT',
    defaultUnitPriceUsd: 0,
    defaultLineItems: [],
    showsKgInCant: chapter.showsKgInCant
  }
}

export function isWorkOrderBillableStatus(wo, woItems = []) {
  const validItems = (woItems || []).filter((i) => normalizeText(i.status) !== 'DESESTIMADO')
  if (validItems.length > 0) {
    const statuses = validItems.map((i) => normalizeText(i.status))
    if (statuses.every((s) => EXCLUDED_OT_STATUSES.has(s))) return false
    return statuses.some((s) => BILLABLE_OT_STATUSES.has(s))
  }
  const woStatus = normalizeText(wo?.status)
  return !EXCLUDED_OT_STATUSES.has(woStatus) && BILLABLE_OT_STATUSES.has(woStatus)
}

export function buildInitialGhostProse(wo, woItems = [], matchedTemplate = null) {
  if (matchedTemplate && resolveTemplateBillingDescription(matchedTemplate)) {
    return { hasEmpty: false, emptyCount: 0, prose: buildCatalogBillingProse(matchedTemplate, wo?.title), fromCatalog: true }
  }
  const validItems = (woItems || []).filter((i) => normalizeText(i.status) !== 'DESESTIMADO')
  const titleUpper = String(wo?.title || '').trim().toUpperCase()
  if (validItems.length > 0) {
    const emptySubtasks = validItems.filter((i) => !String(i.description || '').trim())
    if (emptySubtasks.length > 0) return { hasEmpty: true, emptyCount: emptySubtasks.length, prose: '', fromCatalog: false }
    const bodyLines = validItems.map((i) => String(i.description).trim())
    return { hasEmpty: false, emptyCount: 0, prose: titleUpper ? `<b>${titleUpper}</b><br/>${bodyLines.join('<br/>')}` : bodyLines.join('<br/>'), fromCatalog: false }
  }
  const woDesc = String(wo?.description || '').trim()
  if (!woDesc) return { hasEmpty: true, emptyCount: 1, prose: '', fromCatalog: false }
  const prose = titleUpper && normalizeText(woDesc) !== normalizeText(titleUpper) ? `<b>${titleUpper}</b><br/>${woDesc}` : `<b>${titleUpper || woDesc}</b>`
  return { hasEmpty: false, emptyCount: 0, prose, fromCatalog: false }
}

export function evaluateShipWorkOrdersForGhostImport({
  shipWos = [], workItems = [], laborRows = [], materialRows = [], thirdPartyRows = [],
  workers = [], otTemplates = [], existingCustomBlocks = []
}) {
  const wiByWo = new Map()
  for (const wi of workItems || []) {
    if (!wiByWo.has(wi.work_order_id)) wiByWo.set(wi.work_order_id, [])
    wiByWo.get(wi.work_order_id).push(wi)
  }

  const alreadyInBilling = []
  const emptyDescriptionAlerts = []
  const readyCandidates = []
  const matchedTemplateByWoId = new Map()

  for (const wo of shipWos || []) {
    const woItems = wiByWo.get(wo.id) || []
    const alreadyUploaded = Boolean(wo.is_in_billing) || (wo.billing_description != null && String(wo.billing_description).length > 0)
    if (alreadyUploaded) {
      alreadyInBilling.push(wo)
      const tpl = matchOtToAbcTemplate(wo, otTemplates)
      if (tpl) matchedTemplateByWoId.set(wo.id, tpl)
      continue
    }
    if (!isWorkOrderBillableStatus(wo, woItems)) continue

    const classification = inferOtChapterDeterministic({
      wo, woItems, laborRows, materialRows, thirdPartyRows, workers, otTemplates
    })
    const ghost = buildInitialGhostProse(wo, woItems, classification.matchedTemplate)
    if (ghost.hasEmpty) {
      emptyDescriptionAlerts.push({
        workOrderId: wo.id, otNumber: wo.ot_number || 'OT', title: wo.title || 'Sin título',
        foremanName: wo.foreman_name || woItems[0]?.foreman_name || 'Jefe de Obra',
        foremanReviewStatus: wo.foreman_review_status || 'NONE', emptyCount: ghost.emptyCount
      })
      continue
    }

    readyCandidates.push({
      workOrderId: wo.id,
      wo,
      classification,
      patch: {
        is_in_billing: true,
        billing_description: ghost.prose,
        billing_rubro_group: classification.chapterKey,
        billing_pricing_mode: classification.defaultPricingMode,
        billing_unit_price_usd: classification.defaultUnitPriceUsd,
        ...(classification.defaultPricingMode === 'UNITARIO' ? { billing_qty_override: 1 } : {}),
        ...(classification.defaultPricingMode === 'ITEMS' ? { billing_line_items: classification.defaultLineItems } : {}),
        billing_mo_tax: classification.defaultTaxType,
        billing_mat_tax: classification.defaultTaxType
      }
    })
  }

  readyCandidates.sort((a, b) =>
    a.classification.chapterOrder !== b.classification.chapterOrder
      ? a.classification.chapterOrder - b.classification.chapterOrder
      : a.classification.subOrder - b.classification.subOrder
  )

  const plan = buildOrderedImportWithDelimiters({
    readyCandidates, alreadyInBilling, existingCustomBlocks, matchedTemplateByWoId
  })
  return { alreadyInBilling, emptyDescriptionAlerts, ...plan }
}
