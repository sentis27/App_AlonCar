/**
 * billingImportOrderEngine.js
 * Motor puro de ordenamiento PDF y delimitadores automáticos de sección para el Remito Comercial:
 * - Inserta delimitadores del PDF (SERVICIOS, MECANICA NAVAL, TORNERIA, RASCHINAJE) y capítulos no tabulados.
 * - Ubica OTs tabuladas nuevas en su posición exacta del PDF (antes de tabuladas posteriores y no tabuladas).
 */
import { normalizeText } from './tradesCatalog.js'

export function resolvePdfGroupDelimiterForTemplate(tpl) {
  const n = normalizeText(tpl?.name || '')
  if (!n || n === 'SERVICIOS') return null
  if (n.includes('DESMONTE LINEA EJE') || n.includes('LINEA EJE Y TIMON')) {
    return { code: 'PDF_MECANICA_NAVAL', label: 'MECANICA NAVAL' }
  }
  if (n === 'LINEA DE EJE' || n === 'LINEA DE TIMON') {
    return { code: 'PDF_TORNERIA', label: 'TORNERIA' }
  }
  if (n.includes('CARENAD') || n.includes('SUPER ESTRUCTURA') || n.includes('SUMINISTRO') || n.includes('ANCLAS') || n.includes('INFORME')) {
    return null
  }
  if (n.includes('TANQUE') || n.includes('SENTINA')) {
    return { code: 'PDF_RASCHINAJE', label: 'RASCHINAJE' }
  }
  return { code: 'PDF_SERVICIOS', label: 'SERVICIOS' }
}

export function resolveAutoDelimiterForCandidate(classification) {
  if (!classification) return null
  if (classification.isTabulatedAbc) return resolvePdfGroupDelimiterForTemplate(classification.matchedTemplate)
  return { code: `CH_${classification.chapterKey}`, label: String(classification.chapterLabel || classification.chapterKey || '').toUpperCase() }
}

/**
 * Planifica el orden definitivo (OTs nuevas + reespaciado de existentes + delimitadores automáticos sin duplicar).
 */
export function buildOrderedImportWithDelimiters({
  readyCandidates = [], alreadyInBilling = [], existingCustomBlocks = [], matchedTemplateByWoId = new Map()
}) {
  const existingBlocks = [
    ...(alreadyInBilling || []).map((wo) => {
      const tpl = matchedTemplateByWoId.get(wo.id) || null
      return { kind: 'EXISTING_WO', id: wo.id, wo, sortOrder: Number(wo.billing_sort_order) || 1000, isTabulatedAbc: Boolean(tpl), subOrder: tpl ? (Number(tpl.sort_order) || 999) : 9999 }
    }),
    ...(existingCustomBlocks || []).map((cb) => ({ kind: 'EXISTING_CUSTOM', id: cb.id, custom: cb, sortOrder: Number(cb.sortOrder) || 1000, isTabulatedAbc: false, subOrder: 9999 }))
  ].sort((a, b) => a.sortOrder - b.sortOrder)

  const timeline = [...existingBlocks]
  const seenDelimCodes = new Set(
    (existingCustomBlocks || [])
      .filter((cb) => cb.blockType === 'RUBRO_DELIMITER')
      .flatMap((cb) => [cb.code, `CH_${cb.code}`, `PDF_${cb.code}`].filter(Boolean))
  )

  const makeDelimiterNode = (delim, seq) => ({
    kind: 'NEW_DELIMITER',
    custom: { id: `delim_auto_${delim.code}_${Date.now()}_${seq}`, blockType: 'RUBRO_DELIMITER', code: delim.code, label: delim.label }
  })

  let delimSeq = 0
  const isDelimiterNode = (node) =>
    node && (node.kind === 'NEW_DELIMITER' || (node.kind === 'EXISTING_CUSTOM' && node.custom?.blockType === 'RUBRO_DELIMITER'))

  const findInsertIndexForTabulated = (subOrder, candDelimCode) => {
    for (let i = 0; i < timeline.length; i += 1) {
      const node = timeline[i]
      const isLaterTabulated = (node.kind === 'NEW_WO' || node.kind === 'EXISTING_WO') && node.isTabulatedAbc && node.subOrder > subOrder
      const isNonTabulated = (node.kind === 'NEW_WO' || node.kind === 'EXISTING_WO') && !node.isTabulatedAbc
      if (isLaterTabulated || isNonTabulated) {
        let idx = i
        while (idx > 0 && isDelimiterNode(timeline[idx - 1])) {
          const prevCode = timeline[idx - 1].custom?.code || ''
          if (candDelimCode && prevCode === candDelimCode) break
          idx -= 1
        }
        return idx
      }
    }
    return timeline.length
  }

  for (const cand of readyCandidates) {
    const delim = resolveAutoDelimiterForCandidate(cand.classification)
    if (cand.classification?.isTabulatedAbc && normalizeText(cand.classification?.matchedTemplate?.name) === 'SERVICIOS') {
      seenDelimCodes.add('PDF_SERVICIOS')
    }
    const newNode = {
      kind: 'NEW_WO',
      cand,
      isTabulatedAbc: Boolean(cand.classification?.isTabulatedAbc),
      subOrder: Number(cand.classification?.subOrder) || 9999
    }
    const insertAt = newNode.isTabulatedAbc ? findInsertIndexForTabulated(newNode.subOrder, delim?.code) : timeline.length
    const toInsert = []
    if (delim && !seenDelimCodes.has(delim.code)) {
      seenDelimCodes.add(delim.code)
      delimSeq += 1
      toInsert.push(makeDelimiterNode(delim, delimSeq))
    }
    toInsert.push(newNode)
    timeline.splice(insertAt, 0, ...toInsert)
  }

  const readyToImport = []
  const existingWoOrderUpdates = []
  const nextCustomBlocks = []
  let delimitersAdded = 0

  timeline.forEach((node, idx) => {
    const nextSort = (idx + 1) * 10
    if (node.kind === 'NEW_WO') {
      readyToImport.push({ ...node.cand, patch: { ...node.cand.patch, billing_sort_order: nextSort } })
    } else if (node.kind === 'EXISTING_WO') {
      if (Number(node.wo.billing_sort_order) !== nextSort) {
        existingWoOrderUpdates.push({ id: node.wo.id, patch: { billing_sort_order: nextSort } })
      }
    } else if (node.kind === 'EXISTING_CUSTOM') {
      nextCustomBlocks.push({ ...node.custom, sortOrder: nextSort })
    } else if (node.kind === 'NEW_DELIMITER') {
      delimitersAdded += 1
      nextCustomBlocks.push({ ...node.custom, sortOrder: nextSort })
    }
  })

  return { readyToImport, existingWoOrderUpdates, nextCustomBlocks, delimitersAdded }
}

/**
 * Reordena las OTs YA presentes en un remito abierto (`Actualizar Costos`):
 * - Tabuladas (OT.ABC) primero en orden exacto del PDF (1..20) con sus delimitadores automáticos.
 * - No tabuladas debajo agrupadas por capítulo, preservando bloques libres y SIN pisar textos ni precios.
 */
export function planReorderExistingBillingBlocks({
  activeBillingWos = [],
  existingCustomBlocks = [],
  classifyWo
}) {
  const NON_TAB_ORDER = {
    TORNERIA: { order: 20, label: 'TORNERÍA' }, CARENADO: { order: 30, label: 'CARENADO Y SUPERESTRUCTURA' },
    CALDERERIA: { order: 40, label: 'CALDERERÍA' }, RASCHINAJE: { order: 50, label: 'RASCHINAJE' },
    MECANICA: { order: 60, label: 'MECÁNICA NAVAL' }, CARPINTERIA: { order: 70, label: 'CARPINTERÍA' },
    ELECTRICIDAD: { order: 80, label: 'ELECTRICIDAD' }, PINTURA: { order: 90, label: 'PINTURA' },
    TANQUES_SENTINA: { order: 100, label: 'TANQUES Y SENTINA' }, SERVICIOS: { order: 110, label: 'SERVICIOS Y VARIOS' }
  }
  const classified = (activeBillingWos || []).map((wo) => {
    const cls = classifyWo(wo)
    const isTab = Boolean(cls?.isTabulatedAbc)
    const savedKey = !isTab && wo.billing_rubro_group ? String(wo.billing_rubro_group).toUpperCase() : ''
    const savedChapter = NON_TAB_ORDER[savedKey] || null
    const effectiveCls = savedChapter
      ? { ...cls, chapterKey: savedKey, chapterLabel: savedChapter.label, chapterOrder: savedChapter.order }
      : cls
    return {
      wo, cls: effectiveCls, isTab,
      chapterOrder: isTab ? 10 : (Number(effectiveCls?.chapterOrder) || 110),
      subOrder: isTab ? (Number(cls?.subOrder) || 999) : (Number(wo.billing_sort_order) || 9999)
    }
  })

  classified.sort((a, b) =>
    a.chapterOrder !== b.chapterOrder
      ? a.chapterOrder - b.chapterOrder
      : a.subOrder !== b.subOrder
        ? a.subOrder - b.subOrder
        : (Number(a.wo.billing_sort_order) || 9999) - (Number(b.wo.billing_sort_order) || 9999)
  )

  const existingDelimsByCode = new Map()
  const existingDelimsByNormLabel = new Map()
  const freeBlocks = []
  for (const cb of existingCustomBlocks || []) {
    if (cb.blockType === 'RUBRO_DELIMITER') {
      if (cb.code) existingDelimsByCode.set(cb.code, cb)
      if (cb.label) existingDelimsByNormLabel.set(normalizeText(cb.label), cb)
    } else {
      freeBlocks.push(cb)
    }
  }

  const timeline = []
  const emittedDelimCodes = new Set()
  let delimSeq = 0

  for (const entry of classified) {
    const delim = resolveAutoDelimiterForCandidate(entry.cls)
    if (entry.isTab && normalizeText(entry.cls?.matchedTemplate?.name) === 'SERVICIOS') {
      emittedDelimCodes.add('PDF_SERVICIOS')
    }
    if (delim && !emittedDelimCodes.has(delim.code)) {
      emittedDelimCodes.add(delim.code)
      const reused = existingDelimsByCode.get(delim.code)
        || (!delim.code.startsWith('PDF_') ? existingDelimsByNormLabel.get(normalizeText(delim.label)) : null)
      delimSeq += 1
      timeline.push({
        kind: 'CUSTOM',
        custom: reused
          ? { ...reused, code: delim.code, label: delim.label }
          : { id: `delim_auto_${delim.code}_${Date.now()}_${delimSeq}`, blockType: 'RUBRO_DELIMITER', code: delim.code, label: delim.label }
      })
    }
    timeline.push({ kind: 'WO', entry })
  }

  for (const fb of freeBlocks.sort((a, b) => (Number(a.sortOrder) || 1000) - (Number(b.sortOrder) || 1000))) {
    timeline.push({ kind: 'CUSTOM', custom: fb })
  }

  const woUpdates = []
  const nextCustomBlocks = []
  timeline.forEach((node, idx) => {
    const nextSort = (idx + 1) * 10
    if (node.kind === 'WO') {
      const { wo, isTab, cls } = node.entry
      const nextRubro = isTab ? 'OT_ABC' : (wo.billing_rubro_group || cls?.chapterKey || 'SERVICIOS')
      if (Number(wo.billing_sort_order) !== nextSort || wo.billing_rubro_group !== nextRubro) {
        woUpdates.push({ id: wo.id, patch: { billing_sort_order: nextSort, billing_rubro_group: nextRubro } })
      }
    } else {
      nextCustomBlocks.push({ ...node.custom, sortOrder: nextSort })
    }
  })

  return { woUpdates, nextCustomBlocks }
}
