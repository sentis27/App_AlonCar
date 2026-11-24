/**
 * permissionsEngine.js
 * Capa 1/2 (SKL-019 · Etapa 5): Motor único de permisos por puesto (`organization_roles`).
 * Gobierna visibilidad del Menú Lateral Acordeón, protección de rutas (?tab=) y capacidades
 * operativas internas sin duplicar ventanas ni lógica por persona.
 */
import {
  NAVIGATION_MODULES,
  buildSubmoduleUrl,
  getNavigationModuleByPath,
  getVisibleNavigationModules,
  isSupervisorOrAdminRole,
  resolveModuleTab,
} from './navigationCatalog.js'

const LEGACY_SECTION_MAP = {
  tarifario: 'personal.tarifario',
  analisis: 'personal.analisis',
}

const VALID_MODULE_KEYS = new Set(NAVIGATION_MODULES.map((m) => m.permissionKey))
const VALID_CHILD_KEYS = new Set(
  NAVIGATION_MODULES.flatMap((m) => (m.children || []).map((c) => c.permissionKey))
)

export function normalizeAllowedSections(rawSections) {
  if (!Array.isArray(rawSections)) return []
  const seen = new Set()
  const out = []
  for (const item of rawSections) {
    const clean = String(item || '').trim()
    if (!clean) continue
    const mapped = LEGACY_SECTION_MAP[clean] || clean
    if (!VALID_MODULE_KEYS.has(mapped) && !VALID_CHILD_KEYS.has(mapped)) continue
    if (!seen.has(mapped)) {
      seen.add(mapped)
      out.push(mapped)
    }
  }
  return out
}

export function getModuleSelectionState(rawSections, moduleDef) {
  const normalized = new Set(normalizeAllowedSections(rawSections))
  const children = Array.isArray(moduleDef?.children) ? moduleDef.children : []
  if (normalized.has(moduleDef.permissionKey)) {
    return {
      mode: 'full',
      enabledCount: children.length || 1,
      totalCount: children.length || 1,
      enabledChildIds: children.map((c) => c.id),
    }
  }
  if (children.length === 0) {
    return { mode: 'none', enabledCount: 0, totalCount: 1, enabledChildIds: [] }
  }
  const enabledChildren = children.filter((c) => normalized.has(c.permissionKey))
  if (enabledChildren.length === 0) {
    return { mode: 'none', enabledCount: 0, totalCount: children.length, enabledChildIds: [] }
  }
  if (enabledChildren.length === children.length) {
    return {
      mode: 'full',
      enabledCount: children.length,
      totalCount: children.length,
      enabledChildIds: children.map((c) => c.id),
    }
  }
  return {
    mode: 'partial',
    enabledCount: enabledChildren.length,
    totalCount: children.length,
    enabledChildIds: enabledChildren.map((c) => c.id),
  }
}

export function toggleModulePermission(rawSections, moduleDef) {
  const normalized = normalizeAllowedSections(rawSections)
  const childKeys = new Set((moduleDef.children || []).map((c) => c.permissionKey))
  const { mode } = getModuleSelectionState(normalized, moduleDef)
  const withoutModule = normalized.filter((k) => k !== moduleDef.permissionKey && !childKeys.has(k))
  if (mode === 'full') return withoutModule
  return [...withoutModule, moduleDef.permissionKey]
}

export function toggleSubmodulePermission(rawSections, moduleDef, childId) {
  const children = Array.isArray(moduleDef?.children) ? moduleDef.children : []
  const target = children.find((c) => c.id === childId)
  if (!target) return normalizeAllowedSections(rawSections)

  const normalized = normalizeAllowedSections(rawSections)
  const childKeys = new Set(children.map((c) => c.permissionKey))
  const { enabledChildIds } = getModuleSelectionState(normalized, moduleDef)
  const nextIds = new Set(enabledChildIds)
  if (nextIds.has(childId)) nextIds.delete(childId)
  else nextIds.add(childId)

  const others = normalized.filter((k) => k !== moduleDef.permissionKey && !childKeys.has(k))
  if (nextIds.size === 0) return others
  if (nextIds.size === children.length) return [...others, moduleDef.permissionKey]
  const orderedKeys = children.filter((c) => nextIds.has(c.id)).map((c) => c.permissionKey)
  return [...others, ...orderedKeys]
}

export function resolveEffectiveAllowedSections(orgRole) {
  if (!orgRole) return null
  if (String(orgRole.security_level || '').toUpperCase() === 'ADMINISTRADOR') return null
  return normalizeAllowedSections(orgRole.allowed_sections || [])
}

export function getFirstAllowedRoute({ profile = null, orgRole = null, allowedSections = undefined } = {}) {
  const effective = allowedSections !== undefined ? allowedSections : resolveEffectiveAllowedSections(orgRole)
  const visible = getVisibleNavigationModules({ profile, allowedSections: effective })
  if (visible.length === 0) return null
  const first = visible[0]
  return first.defaultTab ? buildSubmoduleUrl(first.path, first.defaultTab) : first.path
}

export function isRouteAllowed(pathname, rawTab, { profile = null, orgRole = null, allowedSections = undefined } = {}) {
  const effective = allowedSections !== undefined ? allowedSections : resolveEffectiveAllowedSections(orgRole)
  if (effective === null) return { allowed: true, redirectTo: null }

  const visible = getVisibleNavigationModules({ profile, allowedSections: effective })
  const fallback = getFirstAllowedRoute({ profile, orgRole, allowedSections: effective })
  const mod = getNavigationModuleByPath(pathname)
  if (!mod) return { allowed: Boolean(fallback), redirectTo: fallback }

  const visibleMod = visible.find((m) => m.id === mod.id)
  if (!visibleMod) return { allowed: false, redirectTo: fallback }

  if (Array.isArray(mod.children) && mod.children.length > 0) {
    const resolvedTab = resolveModuleTab(mod, rawTab)
    const allowedChildIds =
      visibleMod.children.length > 0
        ? visibleMod.children.map((c) => c.id)
        : [visibleMod.defaultTab].filter(Boolean)
    if (resolvedTab && !allowedChildIds.includes(resolvedTab)) {
      const targetTab = allowedChildIds[0] || visibleMod.defaultTab
      return { allowed: false, redirectTo: buildSubmoduleUrl(mod.path, targetTab) }
    }
  }

  return { allowed: true, redirectTo: null }
}

export function mapSecurityLevelToProfileRole(securityLevel) {
  const lvl = String(securityLevel || '').trim().toUpperCase()
  if (lvl === 'ADMINISTRADOR') return 'Admin'
  if (lvl === 'DIRECCION') return 'Gerencia'
  if (lvl === 'OPERATIVO') return 'Operario'
  return 'Supervisor'
}

export function resolveUserCapabilities(profile = null, orgRole = null) {
  const secLevel = String(orgRole?.security_level || '').trim().toUpperCase()
  const roleKey = String(orgRole?.role_key || profile?.role_key || '').trim().toUpperCase()
  const isMasterAdmin = secLevel === 'ADMINISTRADOR' || (!orgRole && isSupervisorOrAdminRole(profile))
  const effectiveSections = resolveEffectiveAllowedSections(orgRole)
  const sectionSet = effectiveSections ? new Set(effectiveSections) : null

  const hasSection = (key) => {
    if (isMasterAdmin || !sectionSet) return true
    if (sectionSet.has(key)) return true
    const parentKey = key.includes('.') ? key.split('.')[0] : null
    return parentKey ? sectionSet.has(parentKey) : false
  }

  let rolePerspective = 'admin'
  if (!isMasterAdmin) {
    if (secLevel === 'DIRECCION' || secLevel === 'AUDITOR') rolePerspective = 'direccion'
    else if (roleKey.includes('LIQUIDACION') || roleKey.includes('MARIA')) rolePerspective = 'maria_jose'
    else if (roleKey.includes('JEFE_OBRA') || roleKey.includes('OFICINA_TECNICA') || secLevel === 'OPERATIVO') {
      rolePerspective = 'jefe_obra'
    } else if (roleKey.includes('SUPERVISION')) {
      rolePerspective = 'admin'
    } else {
      const pRole = String(profile?.role || '').trim().toLowerCase()
      if (pRole === 'operario') rolePerspective = 'jefe_obra'
      else if (pRole === 'direccion') rolePerspective = 'direccion'
    }
  }

  const canEditTercerosAmounts = isMasterAdmin || rolePerspective === 'admin' || rolePerspective === 'maria_jose'
  const canMutateTercerosRows = isMasterAdmin || rolePerspective !== 'direccion'
  const isPanolAdmin = isMasterAdmin || (secLevel === 'SUPERVISOR' && roleKey.includes('SUPERVISION'))
  const canUseComprasCompleteMode =
    isMasterAdmin || hasSection('compras.proveedores') || hasSection('compras.documentos')

  return {
    isMasterAdmin,
    rolePerspective,
    canEditTercerosAmounts,
    canMutateTercerosRows,
    isPanolAdmin,
    canUseComprasCompleteMode,
    allowedSections: effectiveSections,
    hasSection,
  }
}

export const ROLE_PERMISSION_PRESETS = [
  {
    name: '👑 Director / Admin',
    desc: 'Acceso total a los 11 módulos y configuración maestra del ERP',
    security_level: 'ADMINISTRADOR',
    sections: NAVIGATION_MODULES.map((m) => m.permissionKey),
  },
  {
    name: '👔 Dirección Operativa',
    desc: 'Barcos, OTs, Horas, Terceros, Personal y Resumen Gerencial completo',
    security_level: 'DIRECCION',
    sections: ['dashboard', 'barcos', 'ots', 'horas', 'terceros', 'personal', 'resumen-gerencial'],
  },
  {
    name: '📋 Administración / RRHH',
    desc: 'Personal, Tarifario, Horas, Terceros, Tesorería y Remito Comercial',
    security_level: 'SUPERVISOR',
    sections: ['dashboard', 'barcos', 'ots', 'horas', 'terceros', 'personal', 'tesoreria', 'resumen-gerencial'],
  },
  {
    name: '🛠️ Supervisión & Pañol',
    desc: 'Barcos, OTs, Horas, Pañol completo, Compras completo y Personal',
    security_level: 'SUPERVISOR',
    sections: ['dashboard', 'barcos', 'ots', 'horas', 'panol', 'compras', 'personal'],
  },
  {
    name: '⚓ Jefe de Obra',
    desc: 'Barcos, OTs, Horas, Pañol operativo, Solicitudes de Compra y Terceros',
    security_level: 'SUPERVISOR',
    sections: ['dashboard', 'barcos', 'ots', 'horas', 'panol.planillas', 'panol.gases', 'compras.compras', 'terceros'],
  },
  {
    name: '👁️ Tesorería / Auditoría',
    desc: 'Tesorería, Terceros (lectura), Tarifario, Análisis FX y Sábana Quincenal',
    security_level: 'AUDITOR',
    sections: ['dashboard', 'tesoreria', 'terceros', 'personal.tarifario', 'personal.analisis', 'horas.sabana_quincenal'],
  },
]
