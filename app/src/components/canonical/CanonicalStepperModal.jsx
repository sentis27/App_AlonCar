import { useEffect } from 'react'
import { X } from 'lucide-react'
import StepHelpBadge from './StepHelpBadge.jsx'

/**
 * CanonicalStepperModal (Pieza Canónica Transversal · SKL-019 · Estándar Zero-Scroll)
 * Carcasa única para todos los menús de carga de datos del ERP (estilo Pañol):
 * - Ancho generoso (`max-w-5xl` / `max-w-6xl`) ocupando la pantalla de escritorio.
 * - Un solo flujo vertical top-to-bottom (`1 ➔ 2 ➔ 3 ➔ ...`), sin columnas partidas forzadas.
 * - Cero scroll vertical exterior (`overflow-visible`): el tamaño se diseña de antemano
 *   y los globos de ayuda se renderizan en portal (hacia arriba en el último paso).
 */
export function CanonicalStepperModal({
  isOpen = true,
  onClose,
  title,
  subtitle = null,
  icon = null,
  headerBadges = null,
  headerRight = null,
  maxWidthClass = 'max-w-5xl',
  zIndexClass = 'z-50',
  onSubmit = null,
  formNoValidate = false,
  footerLeft = null,
  footerRight = null,
  bodyClassName = '',
  children
}) {
  useEffect(() => {
    if (!isOpen || !onClose) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const innerContent = (
    <>
      <div className={`p-4 sm:px-6 sm:py-4 space-y-3.5 overflow-visible max-sm:overflow-y-auto max-sm:max-h-[78vh] ${bodyClassName}`}>
        {children}
      </div>

      {(footerLeft || footerRight) && (
        <div className="alon-modal-footer">
          <div className="flex flex-wrap items-center gap-2">{footerLeft}</div>
          <div className="flex items-center gap-2">{footerRight}</div>
        </div>
      )}
    </>
  )

  return (
    <div data-testid="stepper-modal-backdrop" className={`fixed inset-0 ${zIndexClass} bg-black/80 backdrop-blur-sm flex items-center justify-center p-2.5 sm:p-4 font-sans`}>
      <div data-testid="stepper-modal" className={`alon-modal-card alon-modal-zeroscroll ${maxWidthClass} w-full`}>
        <div className="alon-modal-header flex-wrap gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {icon && <div className="shrink-0 flex items-center">{icon}</div>}
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-black text-white uppercase tracking-wide truncate">
                  {title}
                </h2>
                {headerBadges}
              </div>
              {subtitle && (
                <p className="text-[11px] text-slate-400 truncate mt-0.5">{subtitle}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {headerRight}
            {onClose && (
              <button
                type="button"
                data-testid="stepper-modal-close"
                tabIndex={-1}
                onClick={onClose}
                aria-label="Cerrar menú"
                className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {onSubmit ? (
          <form
            onSubmit={onSubmit}
            noValidate={formNoValidate}
            className="flex flex-col flex-1 min-h-0 text-xs"
          >
            {innerContent}
          </form>
        ) : (
          <div className="flex flex-col flex-1 min-h-0 text-xs">{innerContent}</div>
        )}
      </div>
    </div>
  )
}

/**
 * CanonicalStepperStep
 * Renglón canónico del Stepper Vertical (número a la izquierda + línea conectora + franja completa a la derecha).
 */
export function CanonicalStepperStep({
  step,
  helpEntry,
  title,
  subtitle = null,
  headerRight = null,
  isLast = false,
  isActive = false,
  placement = 'auto',
  children
}) {
  return (
    <div data-testid={`stepper-step-${step}`} className="flex gap-3">
      <div className="flex flex-col items-center">
        <StepHelpBadge
          step={step}
          helpEntry={helpEntry}
          isActive={isActive}
          isLastStep={isLast}
          placement={isLast ? 'up' : placement}
        />
        {!isLast && <div className="w-px flex-1 bg-slate-800 mt-1.5" />}
      </div>

      <div className={`flex-1 min-w-0 space-y-2 ${isLast ? '' : 'pb-1.5'}`}>
        {(title || subtitle || headerRight) && (
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-black text-white uppercase tracking-wider text-xs">
              {title}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {subtitle && <span className="text-[10px] text-slate-500">{subtitle}</span>}
              {headerRight}
            </div>
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

export default CanonicalStepperModal
