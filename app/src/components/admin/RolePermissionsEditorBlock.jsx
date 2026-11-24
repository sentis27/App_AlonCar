import { useState } from 'react'
import { ChevronDown, Check, Minus } from 'lucide-react'
import { NAVIGATION_MODULES } from '../../lib/navigationCatalog.js'
import {
  ROLE_PERMISSION_PRESETS,
  getModuleSelectionState,
  toggleModulePermission,
  toggleSubmodulePermission,
} from '../../lib/permissionsEngine.js'

/**
 * Bloques 3 y 4 del modal de Puestos (/admin):
 * - Plantillas rápidas de 1 clic sincronizadas con los 11 módulos reales.
 * - Matriz jerárquica interactiva para habilitar módulos completos o submódulos individuales.
 */
export default function RolePermissionsEditorBlock({ roleForm, setRoleForm }) {
  const [expandedModId, setExpandedModId] = useState(null)

  const handleApplyPreset = (preset) => {
    setRoleForm({
      ...roleForm,
      security_level: preset.security_level,
      allowed_sections: [...preset.sections],
    })
  }

  const handleToggleModule = (mod) => {
    setRoleForm({
      ...roleForm,
      allowed_sections: toggleModulePermission(roleForm.allowed_sections, mod),
    })
  }

  const handleToggleChild = (mod, childId) => {
    setRoleForm({
      ...roleForm,
      allowed_sections: toggleSubmodulePermission(roleForm.allowed_sections, mod, childId),
    })
  }

  const enabledModulesCount = NAVIGATION_MODULES.filter(
    (m) => getModuleSelectionState(roleForm.allowed_sections, m).mode !== 'none'
  ).length

  return (
    <div className="space-y-3">
      {/* BLOQUE 3: PRESETS RÁPIDOS (.alon-chunk-amber) */}
      <div className="alon-chunk-amber space-y-2">
        <div className="flex items-center justify-between pb-1 border-b border-amber-500/20">
          <span className="font-black text-[11px] uppercase tracking-wider text-amber-400">
            3. Plantillas Rápidas de Permisos (1 Clic)
          </span>
          <span className="text-[10px] text-amber-300/70 font-mono">Autoconfiguración</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {ROLE_PERMISSION_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              tabIndex={-1}
              onClick={() => handleApplyPreset(preset)}
              className="p-2 bg-slate-900/60 hover:bg-amber-950/30 border border-slate-700 hover:border-amber-500/50 rounded-xl text-left transition-all cursor-pointer"
            >
              <strong className="text-xs text-white block truncate">{preset.name}</strong>
              <span className="text-[10px] text-slate-400 block leading-tight mt-0.5 line-clamp-2">
                {preset.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* BLOQUE 4: MATRIZ DE 11 MÓDULOS Y 30 SUBMÓDULOS (.alon-chunk-purple) */}
      <div className="alon-chunk-purple space-y-2">
        <div className="flex items-center justify-between pb-1 border-b border-purple-500/20">
          <span className="font-black text-[11px] uppercase tracking-wider text-purple-400">
            4. Módulos y Submódulos Habilitados
          </span>
          <span className="text-[10px] text-purple-300/70 font-mono">
            {enabledModulesCount} / {NAVIGATION_MODULES.length} módulos activos
          </span>
        </div>

        <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
          {NAVIGATION_MODULES.map((mod) => {
            const state = getModuleSelectionState(roleForm.allowed_sections, mod)
            const hasChildren = Array.isArray(mod.children) && mod.children.length > 0
            const isExpanded = expandedModId === mod.id

            return (
              <div
                key={mod.id}
                className={`rounded-lg border transition-all ${
                  state.mode === 'full'
                    ? 'bg-purple-950/35 border-purple-500/60'
                    : state.mode === 'partial'
                    ? 'bg-amber-950/25 border-amber-500/50'
                    : 'bg-slate-900/70 border-slate-800'
                }`}
              >
                <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                  <button
                    type="button"
                    tabIndex={-1}
                    onClick={() => handleToggleModule(mod)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                  >
                    <span
                      className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                        state.mode === 'full'
                          ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                          : state.mode === 'partial'
                          ? 'bg-amber-400 border-amber-300 text-slate-950'
                          : 'bg-slate-950 border-slate-700 text-transparent'
                      }`}
                    >
                      {state.mode === 'full' ? (
                        <Check className="w-3 h-3 stroke-[3]" />
                      ) : state.mode === 'partial' ? (
                        <Minus className="w-3 h-3 stroke-[3]" />
                      ) : null}
                    </span>
                    <span
                      className={`text-xs truncate ${
                        state.mode !== 'none' ? 'text-white font-bold' : 'text-slate-400 font-medium'
                      }`}
                    >
                      {mod.name}
                    </span>
                    {hasChildren && (
                      <span
                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded border shrink-0 ${
                          state.mode === 'full'
                            ? 'bg-emerald-950/70 text-emerald-300 border-emerald-700/60'
                            : state.mode === 'partial'
                            ? 'bg-amber-950/70 text-amber-300 border-amber-700/60'
                            : 'bg-slate-950 text-slate-500 border-slate-800'
                        }`}
                      >
                        {state.enabledCount}/{state.totalCount}
                      </span>
                    )}
                  </button>

                  {hasChildren && (
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setExpandedModId((prev) => (prev === mod.id ? null : mod.id))}
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold text-slate-400 hover:text-white hover:bg-slate-800 flex items-center gap-1 cursor-pointer shrink-0"
                      title="Elegir submódulos puntuales"
                    >
                      <span>Submódulos</span>
                      <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180 text-cyan-300' : ''}`} />
                    </button>
                  )}
                </div>

                {hasChildren && isExpanded && (
                  <div className="px-3 pb-2 pt-1 border-t border-slate-800/80 flex flex-wrap gap-1.5">
                    {mod.children.map((child) => {
                      const childOn = state.enabledChildIds.includes(child.id)
                      return (
                        <button
                          key={child.id}
                          type="button"
                          tabIndex={-1}
                          onClick={() => handleToggleChild(mod, child.id)}
                          className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition-all cursor-pointer flex items-center gap-1 ${
                            childOn
                              ? 'bg-cyan-500/20 text-cyan-200 border-cyan-500/50'
                              : 'bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-300'
                          }`}
                        >
                          <span>{childOn ? '✓' : '+'}</span>
                          <span>{child.shortLabel || child.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
