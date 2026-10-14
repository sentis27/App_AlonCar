import { useLocation, Link } from 'react-router-dom'
import { Construction, ArrowLeft } from 'lucide-react'

const moduleTitles = {
  '/ots': 'Órdenes de Trabajo (OTs)',
  '/barcos': 'Barcos y Obras en Astillero',
  '/horas': 'Carga y Registro de Horas',
  '/panol': 'Pañol y Retiro de Materiales',
  '/compras': 'Gestión de Compras y Proveedores',
  '/personal': 'Personal, Contratistas & Tarifarios',
  '/comparador': 'Comparador de Obras & Análisis de Costos'
}

export default function ModulePlaceholder() {
  const location = useLocation()
  const title = moduleTitles[location.pathname] || 'Módulo en Construcción'

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-4">
        <Construction className="w-8 h-8" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
      <p className="text-slate-400 text-sm max-w-md mb-6">
        Este módulo está planificado para el siguiente ciclo de desarrollo. La estructura de datos y tablas de Supabase ya están listas para conectarse.
      </p>
      <Link
        to="/"
        className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 transition-all flex items-center gap-2"
      >
        <ArrowLeft className="w-3.5 h-3.5" />
        <span>Volver al Dashboard</span>
      </Link>
    </div>
  )
}
