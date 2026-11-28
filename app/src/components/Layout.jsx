import { useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import RouteErrorBoundary from './canonical/RouteErrorBoundary'
import { Menu } from 'lucide-react'

export default function Layout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const location = useLocation()
  const routeResetKey = `${location.pathname}${location.search}`

  return (
    <div data-testid="app-shell" className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Barra lateral fija en desktop / drawer ágil en móvil */}
      <Sidebar mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />

      {/* Contenedor principal */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Barra superior / Topbar */}
        <header className="h-14 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-3 sm:px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Abrir menú de módulos"
              className="md:hidden p-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-slate-200 hover:text-white cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <span className="text-xs font-medium text-slate-300 md:hidden truncate">Alon Car ERP</span>
            <span className="hidden md:inline text-xs font-medium text-slate-400">Sistema Conectado</span>
            <span className="hidden md:inline text-slate-600">|</span>
            <span className="hidden md:inline text-xs text-slate-400">Base de Datos: Supabase Activa</span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400 shrink-0">
            <span>Alon Car S.A. &copy; {new Date().getFullYear()}</span>
          </div>
        </header>

        {/* Área de contenido con scroll suave y aprovechamiento total del ancho */}
        <main data-testid="app-main-content" className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-5">
          <RouteErrorBoundary resetKey={routeResetKey}>
            <Outlet />
          </RouteErrorBoundary>
        </main>
      </div>
    </div>
  )
}
