import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { LogOut, Anchor, X, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  buildSubmoduleUrl,
  getNavigationModuleByPath,
  getVisibleNavigationModules,
  resolveModuleTab,
} from '../lib/navigationCatalog'
import CanonicalSidebarModuleGroup from './canonical/CanonicalSidebarModuleGroup'

const SIDEBAR_COLLAPSE_KEY = 'aloncar_sidebar_collapsed'

export default function Sidebar({ mobileOpen = false, onCloseMobile }) {
  const { profile, orgRole, allowedSections, user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const visibleModules = useMemo(
    () => getVisibleNavigationModules({ profile, allowedSections }),
    [profile, allowedSections]
  )
  const currentModule = useMemo(() => getNavigationModuleByPath(location.pathname), [location.pathname])
  const activeTab = useMemo(
    () => (currentModule ? resolveModuleTab(currentModule, searchParams.get('tab')) : null),
    [currentModule, searchParams]
  )

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_COLLAPSE_KEY) === '1'
    } catch {
      return false
    }
  })

  const [expandedModuleId, setExpandedModuleId] = useState(() =>
    currentModule?.children?.length ? currentModule.id : null
  )

  // Auto-expandir el módulo correspondiente cuando cambia la ruta (ej. links desde Dashboard o KPIs)
  useEffect(() => {
    if (currentModule?.children?.length) {
      setExpandedModuleId(currentModule.id)
    } else if (currentModule) {
      setExpandedModuleId(null)
    }
  }, [currentModule])

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_KEY, next ? '1' : '0')
      } catch {
        // noop si storage no disponible
      }
      return next
    })
  }

  // Acordeón exclusivo (1A): expande/contrae sin abandonar la pantalla actual
  const handleToggleExpand = (moduleId) => {
    if (collapsed) {
      setCollapsed(false)
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_KEY, '0')
      } catch {
        // noop
      }
      setExpandedModuleId(moduleId)
      return
    }
    setExpandedModuleId((prev) => (prev === moduleId ? null : moduleId))
  }

  const handleNavigateDirect = (moduleDef) => {
    setExpandedModuleId(null)
    navigate(moduleDef.defaultTab ? buildSubmoduleUrl(moduleDef.path, moduleDef.defaultTab) : moduleDef.path)
    onCloseMobile?.()
  }

  const handleNavigateSubmodule = (moduleDef, child) => {
    navigate(buildSubmoduleUrl(moduleDef.path, child.id), {
      state: { resetSubViewTs: Date.now() },
    })
    onCloseMobile?.()
  }

  const isDesktopCollapsed = collapsed && !mobileOpen

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/75 backdrop-blur-xs md:hidden"
          onClick={() => onCloseMobile?.()}
          aria-hidden="true"
        />
      )}
      <aside
        data-testid="app-sidebar"
        className={`fixed inset-y-0 left-0 z-50 w-72 md:static ${
          isDesktopCollapsed ? 'md:w-16' : 'md:w-64'
        } bg-slate-900/95 border-r border-slate-800/80 backdrop-blur-xl flex flex-col h-screen select-none shrink-0 transform transition-all duration-200 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Brand Header */}
        <div
          className={`h-18 flex items-center ${
            isDesktopCollapsed ? 'justify-center px-2' : 'justify-between gap-3 px-5'
          } border-b border-slate-800/80 shrink-0`}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-blue-600 flex items-center justify-center shadow-[0_0_15px_rgba(0,242,254,0.3)] shrink-0">
              <Anchor className="w-6 h-6 text-slate-950 stroke-[2.5]" />
            </div>
            {!isDesktopCollapsed && (
              <div className="min-w-0">
                <h1 className="font-bold text-white text-lg tracking-wider leading-tight">ALON CAR</h1>
                <p className="text-[10px] tracking-widest text-primary font-semibold uppercase truncate">
                  ERP Naval & Metalúrgico
                </p>
              </div>
            )}
          </div>
          {onCloseMobile && (
            <button
              type="button"
              onClick={() => onCloseMobile()}
              aria-label="Cerrar menú"
              className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Navigation Links (Menú Acordeón Canónico) */}
        <nav
          aria-label="Navegación principal de módulos"
          className={`flex-1 ${isDesktopCollapsed ? 'px-2' : 'px-3'} py-4 space-y-1 overflow-y-auto`}
        >
          {!isDesktopCollapsed && (
            <div className="px-3 pb-2 text-[10px] uppercase tracking-wider text-slate-300 font-bold">
              Módulos Principales
            </div>
          )}
          {visibleModules.map((mod) => (
            <CanonicalSidebarModuleGroup
              key={mod.id}
              moduleDef={mod}
              isModuleActive={currentModule?.id === mod.id}
              activeTab={activeTab}
              isExpanded={expandedModuleId === mod.id}
              collapsed={isDesktopCollapsed}
              onToggleExpand={handleToggleExpand}
              onNavigateDirect={handleNavigateDirect}
              onNavigateSubmodule={handleNavigateSubmodule}
            />
          ))}
        </nav>

        {/* User, Session & Collapse Footer */}
        <div className="p-2.5 border-t border-slate-800/80 bg-slate-950/40 space-y-2 shrink-0">
          <div
            className={`flex items-center ${
              isDesktopCollapsed ? 'justify-center p-1.5' : 'justify-between p-2'
            } rounded-lg bg-slate-800/40 border border-slate-700/30`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center font-bold text-xs text-primary border border-cyan-500/20 shrink-0"
                title={
                  isDesktopCollapsed
                    ? `${orgRole?.holder_name || profile?.full_name || user?.email || 'Operador'} (${orgRole?.role_title || profile?.role || 'Supervisor'})`
                    : orgRole?.security_level
                    ? `Nivel de seguridad: ${orgRole.security_level}`
                    : undefined
                }
              >
                {(orgRole?.holder_name || profile?.full_name || user?.email || 'U').charAt(0).toUpperCase()}
              </div>
              {!isDesktopCollapsed && (
                <div className="min-w-0 truncate">
                  <p className="text-xs font-semibold text-slate-200 truncate">
                    {orgRole?.holder_name || profile?.full_name || user?.email?.split('@')[0] || 'Operador'}
                  </p>
                  <span
                    className="inline-block max-w-full truncate text-[10px] px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-400 border border-cyan-800/50 font-medium"
                    title={orgRole?.role_title || profile?.role || 'Supervisor'}
                  >
                    {orgRole?.role_title || profile?.role || 'Supervisor'}
                  </span>
                </div>
              )}
            </div>
            {!isDesktopCollapsed && (
              <button
                type="button"
                onClick={signOut}
                title="Cerrar Sesión"
                className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-md transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={handleToggleCollapse}
            title={isDesktopCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral para ganar espacio en planillas'}
            aria-label={isDesktopCollapsed ? 'Expandir menú lateral' : 'Contraer menú lateral'}
            className="hidden md:flex w-full items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-cyan-300 hover:bg-slate-800/70 border border-transparent hover:border-slate-700/70 transition-all cursor-pointer"
          >
            {isDesktopCollapsed ? (
              <ChevronsRight className="w-4 h-4" />
            ) : (
              <>
                <ChevronsLeft className="w-4 h-4" />
                <span>Ocultar menú</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  )
}
