import { Component } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

/**
 * RouteErrorBoundary
 * Paracaídas de navegación canónico para vistas dentro de Layout (<Outlet />).
 * Aísla excepciones de React por ruta y se resetea automáticamente al cambiar
 * `resetKey` (location.pathname + location.search), permitiendo seguir navegando
 * desde el Sidebar sin refrescar con F5.
 */
export class RouteErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      prevResetKey: props.resetKey ?? ''
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  static getDerivedStateFromProps(nextProps, prevState) {
    const nextKey = nextProps.resetKey ?? ''
    if (nextKey !== prevState.prevResetKey) {
      return {
        hasError: false,
        error: null,
        prevResetKey: nextKey
      }
    }
    return null
  }

  componentDidCatch(error, errorInfo) {
    console.error('[RouteErrorBoundary] Error capturado en la vista actual:', error, errorInfo)
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
    this.props.onReset?.()
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    const errorMessage = this.state.error?.message || String(this.state.error || 'Error inesperado de renderizado')

    return (
      <div
        role="alert"
        className="w-full min-h-[60vh] flex items-center justify-center p-4 sm:p-6 font-sans"
      >
        <div className="max-w-lg w-full bg-slate-900/95 border border-rose-500/40 rounded-2xl p-6 shadow-2xl space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-950/90 border border-rose-500/50 flex items-center justify-center text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="space-y-1 min-w-0">
              <h2 className="text-base font-extrabold text-white">
                Ocurrió un inconveniente al mostrar esta vista
              </h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Esta pantalla encontró un error inesperado, pero el sistema sigue operativo. Podés reintentar ahora o cambiar a cualquier otro módulo desde el menú lateral sin recargar la página.
              </p>
            </div>
          </div>

          <details className="rounded-xl bg-slate-950/90 border border-slate-800 px-3 py-2 text-[11px] text-slate-400">
            <summary className="cursor-pointer font-semibold text-slate-300 select-none">
              Detalle técnico del error
            </summary>
            <p className="mt-2 font-mono text-rose-300 break-words">{errorMessage}</p>
          </details>

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={this.handleRetry}
              className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold text-xs flex items-center gap-2 transition-colors cursor-pointer shadow-lg shadow-cyan-500/20"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reintentar vista</span>
            </button>
          </div>
        </div>
      </div>
    )
  }
}

export default RouteErrorBoundary
