import {
  LayoutDashboard,
  Ship,
  ClipboardList,
  Clock,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  ShieldCheck,
  Wrench,
  Wallet,
  ChevronDown,
  Layers,
  Table2,
  ClipboardCheck,
  CalendarDays,
  FileSpreadsheet,
  Flame,
  Shield,
  Building2,
  FileText,
  Calculator,
  TrendingUp,
  Calendar,
  ReceiptText,
  DollarSign,
  ShieldAlert,
  Brain,
  History,
  ArrowDownUp,
} from 'lucide-react'

const NAV_ICONS = {
  LayoutDashboard,
  Ship,
  ClipboardList,
  Clock,
  Package,
  ShoppingCart,
  Users,
  BarChart3,
  ShieldCheck,
  Wrench,
  Wallet,
  Layers,
  Table2,
  ClipboardCheck,
  CalendarDays,
  FileSpreadsheet,
  Flame,
  Shield,
  Building2,
  FileText,
  Calculator,
  TrendingUp,
  Calendar,
  ReceiptText,
  DollarSign,
  ShieldAlert,
  Brain,
  History,
  ArrowDownUp,
}

function NavIcon({ iconKey, className = 'w-4 h-4 shrink-0' }) {
  if (iconKey === 'ShipCompare') {
    return (
      <span className="inline-flex items-center gap-0.5 shrink-0" aria-hidden="true">
        <Ship className="w-3.5 h-3.5" />
        <span className="px-0.5 rounded bg-violet-500/25 border border-violet-400/40 text-[7px] font-black leading-tight text-violet-200">
          VS
        </span>
      </span>
    )
  }
  const IconComp = NAV_ICONS[iconKey] || ClipboardList
  return <IconComp className={className} />
}

/**
 * Capa 3 (SKL-019): Grupo canónico del Menú Lateral Acordeón.
 * Soporta ítems directos, acordeones con submódulos agrupados y modo colapsado (solo íconos).
 */
export default function CanonicalSidebarModuleGroup({
  moduleDef,
  isModuleActive = false,
  activeTab = null,
  isExpanded = false,
  collapsed = false,
  onToggleExpand,
  onNavigateDirect,
  onNavigateSubmodule,
}) {
  const hasChildren = Array.isArray(moduleDef.children) && moduleDef.children.length > 0

  if (!hasChildren) {
    return (
      <button
        type="button"
        onClick={() => onNavigateDirect(moduleDef)}
        title={collapsed ? moduleDef.name : undefined}
        className={`w-full flex items-center ${
          collapsed ? 'justify-center px-2' : 'gap-3 px-3'
        } py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
          isModuleActive
            ? 'bg-gradient-to-r from-cyan-500/20 to-blue-600/10 text-primary border-l-2 border-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.06)] font-semibold'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
        }`}
      >
        <NavIcon iconKey={moduleDef.iconKey} className="w-4 h-4 shrink-0" />
        {!collapsed && <span className="truncate">{moduleDef.name}</span>}
      </button>
    )
  }

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => onToggleExpand(moduleDef.id)}
        aria-expanded={!collapsed && isExpanded}
        title={collapsed ? `${moduleDef.name} (expandir submódulos)` : undefined}
        className={`w-full flex items-center ${
          collapsed ? 'justify-center px-2' : 'justify-between gap-2 px-3'
        } py-2.5 rounded-lg text-sm font-medium transition-all cursor-pointer ${
          isModuleActive
            ? 'bg-gradient-to-r from-cyan-500/15 to-transparent text-primary border-l-2 border-primary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] font-semibold'
            : isExpanded && !collapsed
            ? 'bg-slate-800/50 text-slate-100'
            : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
        }`}
      >
        <span className="flex items-center gap-3 min-w-0">
          <NavIcon iconKey={moduleDef.iconKey} className="w-4 h-4 shrink-0" />
          {!collapsed && <span className="truncate">{moduleDef.name}</span>}
        </span>
        {!collapsed && (
          <ChevronDown
            className={`w-3.5 h-3.5 shrink-0 transition-transform duration-200 ${
              isExpanded ? 'rotate-180 text-cyan-300' : 'text-slate-500'
            }`}
          />
        )}
      </button>

      {!collapsed && isExpanded && (
        <div className="ml-4 pl-3 border-l border-slate-800/90 space-y-0.5 py-1">
          {moduleDef.children.map((child, idx) => {
            const prevGroup = idx > 0 ? moduleDef.children[idx - 1].groupLabel : null
            const showGroupHeader = child.groupLabel && child.groupLabel !== prevGroup
            const isChildActive = isModuleActive && activeTab === child.id

            return (
              <div key={child.id}>
                {showGroupHeader && (
                  <div className="px-2.5 pt-1.5 pb-0.5 text-[9px] font-black uppercase tracking-wider text-slate-500">
                    {child.groupLabel}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => onNavigateSubmodule(moduleDef, child)}
                  className={`w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-xs transition-all cursor-pointer text-left ${
                    isChildActive
                      ? 'bg-cyan-500/15 text-primary border border-cyan-500/35 font-bold shadow-sm'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50 border border-transparent font-medium'
                  }`}
                >
                  <NavIcon
                    iconKey={child.iconKey}
                    className={`w-3.5 h-3.5 shrink-0 ${isChildActive ? 'text-cyan-300' : 'text-slate-500'}`}
                  />
                  <span className="truncate">{child.label}</span>
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
