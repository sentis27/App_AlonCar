import { NavLink } from 'react-router-dom'
import { 
  LayoutDashboard, 
  Ship, 
  ClipboardList, 
  Clock, 
  Package, 
  ShoppingCart, 
  Users, 
  BarChart3, 
  LogOut, 
  Anchor,
  ShieldCheck,
  Wrench
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'

const navItems = [
  { name: 'Dashboard', path: '/', icon: LayoutDashboard },
  { name: 'Órdenes de Trabajo', path: '/ots', icon: ClipboardList },
  { name: 'Barcos y Obras', path: '/barcos', icon: Ship },
  { name: 'Terceros y Talleres', path: '/terceros', icon: Wrench },
  { name: 'Carga de Horas', path: '/horas', icon: Clock },
  { name: 'Pañol / Materiales', path: '/panol', icon: Package },
  { name: 'Compras', path: '/compras', icon: ShoppingCart },
  { name: 'Personal & Tarifas', path: '/personal', icon: Users },
  { name: 'Comparador de Obras', path: '/comparador', icon: BarChart3 },
  { name: 'Panel Administrador', path: '/admin', icon: ShieldCheck },
]

export default function Sidebar() {
  const { profile, user, signOut } = useAuth()

  return (
    <aside className="w-64 bg-slate-900/90 border-r border-slate-800/80 backdrop-blur-xl flex flex-col h-screen select-none shrink-0">
      {/* Brand Header */}
      <div className="h-18 flex items-center gap-3 px-6 border-b border-slate-800/80">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(0,242,254,0.3)]">
          <Anchor className="w-6 h-6 text-slate-950 stroke-[2.5]" />
        </div>
        <div>
          <h1 className="font-bold text-white text-lg tracking-wider">ALON CAR</h1>
          <p className="text-[10px] tracking-widest text-primary font-semibold uppercase">ERP Naval & Metalúrgico</p>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-slate-300 font-bold">
          Módulos Principales
        </div>
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-gradient-to-r from-cyan-500/15 to-transparent text-primary border-l-3 border-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)]'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{item.name}</span>
            </NavLink>
          )
        })}
      </nav>

      {/* User & Session Footer */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-800/40 border border-slate-700/30">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-primary border border-cyan-500/20 shrink-0">
              {profile?.full_name?.charAt(0)?.toUpperCase() || user?.email?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div className="min-w-0 truncate">
              <p className="text-xs font-semibold text-slate-200 truncate">
                {profile?.full_name || user?.email?.split('@')[0] || 'Operador'}
              </p>
              <span className="inline-block text-[10px] px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/50 font-medium">
                {profile?.role || 'Supervisor'}
              </span>
            </div>
          </div>
          <button
            onClick={signOut}
            title="Cerrar Sesión"
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  )
}
