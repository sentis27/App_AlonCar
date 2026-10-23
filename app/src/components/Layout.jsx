import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import { Activity } from 'lucide-react'

export default function Layout() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-950 text-slate-100">
      {/* Barra lateral fija */}
      <Sidebar />

      {/* Contenedor principal */}
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        {/* Barra superior / Topbar */}
        <header className="h-14 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="text-xs font-medium text-slate-400">Sistema Conectado</span>
            <span className="text-slate-600">|</span>
            <span className="text-xs text-slate-400">Base de Datos: Supabase Activa</span>
          </div>

          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>Alon Car S.A. &copy; {new Date().getFullYear()}</span>
          </div>
        </header>

        {/* Área de contenido con scroll suave y aprovechamiento total del ancho */}
        <main className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
