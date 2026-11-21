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
  conceptColWidthPx: 490,
  page1BodyBudgetPx: 790,
  nextPageBodyBudgetPx: 825,
  delimiterHeightPx: 32,
  minBlockHeightPx: 118
}

// Hoja blanca bloqueada al ancho real A4 (210mm) con encogimiento seguro en pantallas angostas
export const PAIRED_GRID_CLASS =
  'grid grid-cols-1 xl:grid-cols-[minmax(0,210mm)_5px_315px] xl:justify-center xl:gap-x-2 items-stretch'

export const SHEET_COLS_CLASS =
  'grid grid-cols-[20px_28px_46px_minmax(0,1fr)_72px_82px_40px]'

/**
 * Estima el alto visual real (px) de un bloque comercial al ancho estándar A4 (210mm),
 * contemplando saltos explícitos, envoltura de renglones, tamaño de fuente y filas MAT/M.O.
 */
export function estimateBillingBlockHeightPx(block = {}) {
  if (block?.blockType === 'RUBRO_DELIMITER') {
    return A4_SHEET_METRICS.delimiterHeightPx
  }

  const fontSizePx = Math.max(10, Math.min(14, Number(block.fontSizePx) || 12))
  const lineHeightPx = fontSizePx * 1.45
  const charsPerLine = Math.max(42, Math.floor(A4_SHEET_METRICS.conceptColWidthPx / (fontSizePx * 0.56)))

  const plain = String(block.billing_description || block.label || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')

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
  const suffixPx = mode === 'MO_MAT' ? 44 : 14
  const verticalPaddingPx = 22
  const estimated = Math.ceil(wrappedLines * lineHeightPx + suffixPx + verticalPaddingPx)

  return Math.max(A4_SHEET_METRICS.minBlockHeightPx, estimated)
}

/**
 * Paginación calibrada a hoja ISO A4 vertical (HOJA 1/N ... HOJA N/N).
 * Acepta opcionalmente `maxBodyPxOverride` para pruebas o ajustes finos.
 */
export function paginateBillingBlocks(blocks = [], maxBodyPxOverride = null) {
  if (!Array.isArray(blocks) || blocks.length === 0) return [[]]
  const pages = []
  let current = []
  let currentPx = 0

  const getBudgetForPage = (pageIndex) => {
    if (typeof maxBodyPxOverride === 'number' && maxBodyPxOverride > 0) return maxBodyPxOverride
    return pageIndex === 0 ? A4_SHEET_METRICS.page1BodyBudgetPx : A4_SHEET_METRICS.nextPageBodyBudgetPx
  }

  for (const block of blocks) {
    const blockPx = estimateBillingBlockHeightPx(block)
    const budgetPx = getBudgetForPage(pages.length)

    if (current.length > 0 && currentPx + blockPx > budgetPx) {
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
export function computeA4RemainingSpacerPx(pageBlocks = [], pageIdx = 0) {
  const budgetPx = pageIdx === 0 ? A4_SHEET_METRICS.page1BodyBudgetPx : A4_SHEET_METRICS.nextPageBodyBudgetPx
  const usedPx = (pageBlocks || []).reduce((sum, b) => sum + estimateBillingBlockHeightPx(b), 0)
  return Math.max(0, Math.round(budgetPx - usedPx))
}
