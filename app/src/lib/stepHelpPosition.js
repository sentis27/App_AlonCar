/**
 * stepHelpPosition.js
 * Motor puro de posicionamiento Zero-Scroll para StepHelpBadge (SKL-012 / SKL-019).
 * Al renderizarse en portal (`position: fixed`), la tarjeta jamás altera el `scrollHeight`
 * del modal. En el último paso (`isLastStep`) o al pedir `placement="up"`, despliega HACIA ARRIBA.
 */
const DEFAULT_POPOVER_WIDTH = 340
const DEFAULT_ESTIMATED_HEIGHT = 175
const VIEWPORT_MARGIN = 12

export function computeStepHelpPosition({
  rect,
  viewportWidth = 1280,
  viewportHeight = 800,
  placement = 'auto',
  isLastStep = false,
  popoverWidth = DEFAULT_POPOVER_WIDTH,
  estimatedHeight = DEFAULT_ESTIMATED_HEIGHT
}) {
  if (!rect) return { direction: 'down', left: VIEWPORT_MARGIN, top: VIEWPORT_MARGIN, width: DEFAULT_POPOVER_WIDTH, maxHeight: 320 }

  const safeWidth = Math.min(popoverWidth, Math.max(240, viewportWidth - VIEWPORT_MARGIN * 2))
  const left = Math.max(
    VIEWPORT_MARGIN,
    Math.min(rect.right + 10, viewportWidth - safeWidth - VIEWPORT_MARGIN)
  )

  const spaceBelow = viewportHeight - rect.top
  const spaceAbove = rect.bottom
  const shouldOpenUp =
    placement === 'up' ||
    isLastStep ||
    (placement !== 'down' && spaceBelow < estimatedHeight + 28 && spaceAbove > spaceBelow)

  if (shouldOpenUp) {
    const bottom = Math.max(VIEWPORT_MARGIN, viewportHeight - rect.bottom)
    const maxHeight = Math.max(140, viewportHeight - bottom - VIEWPORT_MARGIN)
    return { direction: 'up', left, bottom, width: safeWidth, maxHeight }
  }

  const top = Math.max(VIEWPORT_MARGIN, Math.min(rect.top, viewportHeight - estimatedHeight - VIEWPORT_MARGIN))
  const maxHeight = Math.max(140, viewportHeight - top - VIEWPORT_MARGIN)
  return { direction: 'down', left, top, width: safeWidth, maxHeight }
}
