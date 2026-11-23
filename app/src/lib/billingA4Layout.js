/**
 * billingA4Layout.js
 * Métricas reales de hoja ISO A4 vertical (210mm × 297mm a 96 DPI ≈ 794px × 1123px)
 * para alinear 1:1 la Sábana Blanca editable en pantalla con la impresión PDF A4.
 */

export const A4_SHEET_METRICS = {
  widthMm: 210,
  heightMm: 297,
  widthPx: 794,
  heightPx: 1123,
  conceptColWidthPx: 455,
  page1BodyBudgetPx: 725,
  nextPageBodyBudgetPx: 810,
  delimiterHeightPx: 26,
  minBlockHeightPx: 46
}

export const A4_DENSITY_PROFILES = {
  normal: {
    lineHeightRatio: 1.38,
    charWidthFactor: 0.55,
    verticalPaddingPx: 12,
    moMatSuffixPx: 32,
    otherSuffixPx: 4,
    delimiterHeightPx: 26,
    minBlockHeightPx: 46
  },
  compact: {
    lineHeightRatio: 1.24,
    charWidthFactor: 0.53,
    verticalPaddingPx: 8,
    moMatSuffixPx: 26,
    otherSuffixPx: 2,
    delimiterHeightPx: 22,
    minBlockHeightPx: 38
  }
}

export function resolveA4DensityProfile(density = 'normal') {
  return density === 'compact' ? A4_DENSITY_PROFILES.compact : A4_DENSITY_PROFILES.normal
}

// Hoja blanca bloqueada al ancho real A4 (210mm) con encogimiento seguro en pantallas angostas
export const PAIRED_GRID_CLASS =
  'grid grid-cols-1 xl:grid-cols-[minmax(0,210mm)_5px_315px] xl:justify-center xl:gap-x-2 items-stretch'

export const SHEET_COLS_CLASS =
  'grid grid-cols-[20px_28px_46px_minmax(0,1fr)_72px_82px_40px]'

/**
 * Estima el alto visual real (px) de un bloque comercial al ancho estándar A4 (210mm),
 * contemplando saltos explícitos, envoltura de renglones, tamaño de fuente y filas MAT/M.O.
 * Sin inflación artificial: se ajusta orgánicamente al contenido real del texto.
 */
export function estimateBillingBlockHeightPx(block = {}, options = {}) {
  const profile = resolveA4DensityProfile(options?.density)
  if (block?.blockType === 'RUBRO_DELIMITER') {
    return profile.delimiterHeightPx
  }

  const fontSizeOverride = Number(options?.fontSizeOverride)
  const rawFontSize = Number.isFinite(fontSizeOverride) && fontSizeOverride > 0
    ? fontSizeOverride
    : Number(block.fontSizePx) || 12
  const fontSizePx = Math.max(10, Math.min(14, rawFontSize))
  const lineHeightPx = fontSizePx * profile.lineHeightRatio
  const charsPerLine = Math.max(42, Math.floor(A4_SHEET_METRICS.conceptColWidthPx / (fontSizePx * profile.charWidthFactor)))

  const plain = String(block.billing_description || block.label || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')

  const paragraphs = plain
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  let wrappedLines = 0
  if (paragraphs.length === 0) {
    wrappedLines = 2
  } else {
    for (const p of paragraphs) {
      wrappedLines += Math.max(1, Math.ceil(p.length / charsPerLine))
    }
  }

  const mode = block.billing_pricing_mode || 'MO_MAT'
  const suffixPx = mode === 'MO_MAT' ? profile.moMatSuffixPx : profile.otherSuffixPx
  const estimated = Math.ceil(wrappedLines * lineHeightPx + suffixPx + profile.verticalPaddingPx)

  return Math.max(profile.minBlockHeightPx, estimated)
}

/**
 * Paginación calibrada a hoja ISO A4 vertical (HOJA 1/N ... HOJA N/N).
 * Evita dejar delimitadores de rubro huérfanos al pie de una hoja.
 */
export function paginateBillingBlocks(blocks = [], maxBodyPxOverride = null, options = {}) {
  if (!Array.isArray(blocks) || blocks.length === 0) return [[]]
  const pages = []
  let current = []
  let currentPx = 0

  const getBudgetForPage = (pageIndex) => {
    if (typeof maxBodyPxOverride === 'number' && maxBodyPxOverride > 0) return maxBodyPxOverride
    return pageIndex === 0 ? A4_SHEET_METRICS.page1BodyBudgetPx : A4_SHEET_METRICS.nextPageBodyBudgetPx
  }

  for (let i = 0; i < blocks.length; i += 1) {
    const block = blocks[i]
    const blockPx = estimateBillingBlockHeightPx(block, options)
    const budgetPx = getBudgetForPage(pages.length)

    let neededPx = blockPx
    if (block?.blockType === 'RUBRO_DELIMITER' && i + 1 < blocks.length) {
      const nextBlock = blocks[i + 1]
      if (nextBlock?.blockType !== 'RUBRO_DELIMITER') {
        neededPx += estimateBillingBlockHeightPx(nextBlock, options)
      }
    }

    if (current.length > 0 && currentPx + neededPx > budgetPx) {
      pages.push(current)
      current = [block]
      currentPx = blockPx
    } else {
      current.push(block)
      currentPx += blockPx
    }
  }

  if (current.length > 0) pages.push(current)
  return pages
}

/**
 * Calcula el relleno vertical restante (px) para que cada hoja en pantalla
 * conserve la altura visual estándar de una hoja A4 vertical completa.
 */
export function computeA4RemainingSpacerPx(pageBlocks = [], pageIdx = 0, options = {}) {
  const budgetPx = pageIdx === 0 ? A4_SHEET_METRICS.page1BodyBudgetPx : A4_SHEET_METRICS.nextPageBodyBudgetPx
  const usedPx = (pageBlocks || []).reduce((sum, b) => sum + estimateBillingBlockHeightPx(b, options), 0)
  return Math.max(0, Math.round(budgetPx - usedPx))
}

const AUTOFIT_CANDIDATES = [
  { fontSizePx: 12, density: 'normal' },
  { fontSizePx: 12, density: 'compact' },
  { fontSizePx: 11, density: 'normal' },
  { fontSizePx: 11, density: 'compact' },
  { fontSizePx: 10, density: 'compact' }
]

/**
 * Evalúa la combinación más legible (tamaño de letra + densidad) que logra
 * compactar la obra en la menor cantidad posible de hojas ISO A4.
 */
export function computeA4AutoFitPlan(blocks = [], currentDensity = 'normal') {
  const safeBlocks = Array.isArray(blocks) ? blocks : []
  const currentPages = paginateBillingBlocks(safeBlocks, null, { density: currentDensity }).length
  if (safeBlocks.length === 0) {
    return {
      currentPages: 1,
      targetPages: 1,
      savedPages: 0,
      fontSizePx: 12,
      density: 'normal',
      canSavePages: false
    }
  }

  let best = null
  for (const cand of AUTOFIT_CANDIDATES) {
    const pagesCount = paginateBillingBlocks(safeBlocks, null, {
      density: cand.density,
      fontSizeOverride: cand.fontSizePx
    }).length

    if (!best || pagesCount < best.targetPages) {
      best = {
        targetPages: pagesCount,
        fontSizePx: cand.fontSizePx,
        density: cand.density
      }
    }
  }

  const savedPages = Math.max(0, currentPages - best.targetPages)
  if (savedPages === 0 && currentDensity !== 'compact') {
    const compact11Pages = paginateBillingBlocks(safeBlocks, null, {
      density: 'compact',
      fontSizeOverride: 11
    }).length
    return {
      currentPages,
      targetPages: compact11Pages,
      savedPages: Math.max(0, currentPages - compact11Pages),
      fontSizePx: 11,
      density: 'compact',
      canSavePages: compact11Pages < currentPages
    }
  }

  return {
    currentPages,
    targetPages: best.targetPages,
    savedPages,
    fontSizePx: best.fontSizePx,
    density: best.density,
    canSavePages: savedPages > 0
  }
}

/**
 * Construye el parche de `billing_layout_meta` y el mensaje de feedback
 * para alternar entre Auto-Ajuste A4 óptimo y densidad estándar (12px).
 */
export function buildAutoFitLayoutMetaPatch({ meta = {}, orderedBlocks = [], printDensity = 'normal', autoFitPreview }) {
  const shouldRestoreNormal = printDensity === 'compact' && !autoFitPreview?.canSavePages
  const nextDensity = shouldRestoreNormal ? 'normal' : (autoFitPreview?.density || 'compact')
  const nextFontSize = shouldRestoreNormal ? 12 : (autoFitPreview?.fontSizePx || 11)

  const nextFontSizes = { ...(meta.fontSizes || {}) }
  for (const b of orderedBlocks) {
    if (b.workOrderId) nextFontSizes[b.workOrderId] = nextFontSize
  }
  const nextCustomBlocks = (Array.isArray(meta.customBlocks) ? meta.customBlocks : []).map((cb) =>
    cb.blockType === 'FREE_BLOCK' ? { ...cb, fontSizePx: nextFontSize } : cb
  )

  const feedbackMessage = shouldRestoreNormal
    ? 'Espaciado estándar restaurado (12px · densidad normal).'
    : autoFitPreview?.savedPages > 0
      ? `Auto-Ajuste A4 aplicado: compactado de ${autoFitPreview.currentPages} a ${autoFitPreview.targetPages} hoja(s) A4 (${nextFontSize}px).`
      : `Auto-Ajuste A4 aplicado (${autoFitPreview?.targetPages || 1} hoja(s) A4 · ${nextFontSize}px compacto).`

  return {
    nextMeta: { ...meta, printDensity: nextDensity, fontSizes: nextFontSizes, customBlocks: nextCustomBlocks },
    feedbackMessage
  }
}
