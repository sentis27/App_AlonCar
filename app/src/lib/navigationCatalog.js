/**
 * navigationCatalog.js
 * Capa 1 (SKL-019): Fuente Única de Verdad para módulos, submódulos (?tab=),
 * grupos visuales, alias heredados y claves de permiso del Menú Lateral Acordeón.
 */

export const NAVIGATION_MODULES = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    path: '/',
    iconKey: 'LayoutDashboard',
    archetype: 'METRICAS_ANALISIS',
    permissionKey: 'dashboard',
    defaultTab: null,
    children: [],
  },
  {
    id: 'ots',
    name: 'Órdenes de Trabajo',
    path: '/ots',
    iconKey: 'ClipboardList',
    archetype: 'CARGA_EDICION',
    permissionKey: 'ots',
    defaultTab: 'unificado',
    children: [
      { id: 'unificado', label: '1. Unificado', shortLabel: 'Unificado', iconKey: 'ClipboardList', permissionKey: 'ots.unificado', theme: 'cyan' },
      { id: 'ots', label: '2. Por Barco', shortLabel: 'Por Barco', iconKey: 'Layers', permissionKey: 'ots.ots', theme: 'sky' },
      { id: 'terceros', label: '3. Terceros PRC', shortLabel: 'Terceros PRC', iconKey: 'ShieldCheck', permissionKey: 'ots.terceros', theme: 'purple' },
    ],
  },
  {
    id: 'horas',
    name: 'Carga de Horas',
    path: '/horas',
    iconKey: 'Clock',
    archetype: 'CARGA_EDICION',
    permissionKey: 'horas',
    defaultTab: 'carga',
    children: [
      { id: 'carga', label: '1. Planilla de Horas', shortLabel: 'Planilla de Horas', iconKey: 'Table2', permissionKey: 'horas.carga', theme: 'cyan' },
      { id: 'control_diario', label: '2. Control Diario', shortLabel: 'Control Diario', iconKey: 'ClipboardCheck', permissionKey: 'horas.control_diario', theme: 'sky' },
      { id: 'sabana_quincenal', label: '3. Sábana Quincenal', shortLabel: 'Sábana Quincenal', iconKey: 'CalendarDays', permissionKey: 'horas.sabana_quincenal', theme: 'amber' },
    ],
  },
  {
    id: 'panol',
    name: 'Pañol / Materiales',
    path: '/panol',
    iconKey: 'Package',
    archetype: 'CARGA_EDICION',
    permissionKey: 'panol',
    defaultTab: 'planillas',
    tabAliases: { movimientos: 'planillas', kardex: 'planillas' },
    children: [
      { id: 'planillas', label: 'Planilla de Retiros', shortLabel: 'Planilla de Retiros', iconKey: 'FileSpreadsheet', permissionKey: 'panol.planillas', theme: 'emerald' },
      { id: 'gases', label: 'Control de Gases', shortLabel: 'Control de Gases', iconKey: 'Flame', permissionKey: 'panol.gases', theme: 'amber' },
      { id: 'catalogo', label: 'Catálogo & Stock (B.D)', shortLabel: 'Catálogo & Stock', iconKey: 'Layers', permissionKey: 'panol.catalogo', theme: 'sky' },
      { id: 'epp', label: 'Control EPP', shortLabel: 'Control EPP', iconKey: 'Shield', permissionKey: 'panol.epp', theme: 'purple' },
    ],
  },
  {
    id: 'terceros',
    name: 'Terceros y Talleres',
    path: '/terceros',
    iconKey: 'Wrench',
    archetype: 'CARGA_EDICION',
    permissionKey: 'terceros',
    defaultTab: null,
    children: [],
  },
  {
    id: 'compras',
    name: 'Compras',
    path: '/compras',
    iconKey: 'ShoppingCart',
    archetype: 'CARGA_EDICION',
    permissionKey: 'compras',
    defaultTab: 'compras',
    children: [
      { id: 'compras', label: 'Registro de Pedidos', shortLabel: 'Registro', iconKey: 'ClipboardList', permissionKey: 'compras.compras', theme: 'cyan' },
      { id: 'proveedores', label: 'Proveedores', shortLabel: 'Proveedores', iconKey: 'Building2', permissionKey: 'compras.proveedores', requiresSupervisorOrAdmin: true, theme: 'sky' },
      { id: 'documentos', label: 'Archivo Docs', shortLabel: 'Archivo Docs', iconKey: 'FileText', permissionKey: 'compras.documentos', requiresSupervisorOrAdmin: true, theme: 'purple' },
    ],
  },
  {
    id: 'personal',
    name: 'Personal & Tarifas',
    path: '/personal',
    iconKey: 'Users',
    archetype: 'CARGA_EDICION',
    permissionKey: 'personal',
    defaultTab: 'nomina',
    children: [
      { id: 'nomina', label: 'Padrón de Personal', shortLabel: 'Padrón de Personal', iconKey: 'Users', permissionKey: 'personal.nomina', theme: 'cyan' },
      { id: 'tarifario', label: 'Tarifario Quincenal', shortLabel: 'Tarifario Quincenal', iconKey: 'Calculator', permissionKey: 'personal.tarifario', theme: 'emerald' },
      { id: 'analisis', label: 'Análisis de Variación & FX', shortLabel: 'Análisis & FX', iconKey: 'TrendingUp', permissionKey: 'personal.analisis', theme: 'purple' },
    ],
  },
  {
    id: 'tesoreria',
    name: 'Tesorería (Graciela)',
    path: '/tesoreria',
    iconKey: 'Wallet',
    archetype: 'METRICAS_ANALISIS',
    permissionKey: 'tesoreria',
    defaultTab: null,
    children: [],
  },
  {
    id: 'barcos',
    name: 'Barcos y Obras',
    path: '/barcos',
    iconKey: 'Ship',
    archetype: 'CARGA_EDICION',
    permissionKey: 'barcos',
    defaultTab: 'buques',
    children: [
      { id: 'buques', label: '1. Buques', shortLabel: 'Buques', iconKey: 'Ship', permissionKey: 'barcos.buques', theme: 'cyan' },
      { id: 'movimientos', label: '2. Movimientos / Estadías', shortLabel: 'Movimientos', iconKey: 'Calendar', permissionKey: 'barcos.movimientos', theme: 'sky' },
      { id: 'armadores', label: '3. Armadores', shortLabel: 'Armadores', iconKey: 'Users', permissionKey: 'barcos.armadores', theme: 'amber' },
    ],
  },
  {
    id: 'resumen-gerencial',
    name: 'Resumen Gerencial',
    path: '/resumen-gerencial',
    iconKey: 'BarChart3',
    archetype: 'METRICAS_ANALISIS',
    permissionKey: 'resumen-gerencial',
    defaultTab: 'resumen',
    children: [
      { id: 'resumen', label: 'Resumen de Obra & Costos', shortLabel: 'Resumen GS-004', iconKey: 'BarChart3', permissionKey: 'resumen-gerencial.resumen', groupLabel: 'Obra Filtrada', theme: 'cyan' },
      { id: 'matriz', label: 'Matriz OTs (RESUMEN 2)', shortLabel: 'Matriz OTs', iconKey: 'Table2', permissionKey: 'resumen-gerencial.matriz', groupLabel: 'Obra Filtrada', theme: 'sky' },
      { id: 'remito', label: 'Remito Comercial & Tarifario', shortLabel: 'Remito Comercial', iconKey: 'ReceiptText', permissionKey: 'resumen-gerencial.remito', groupLabel: 'Independientes', theme: 'emerald' },
      { id: 'comparador', label: 'Comparador de Obras', shortLabel: 'Comparador', iconKey: 'ShipCompare', permissionKey: 'resumen-gerencial.comparador', groupLabel: 'Independientes', theme: 'violet' },
    ],
  },
  {
    id: 'admin',
    name: 'Panel Administrador',
    path: '/admin',
    iconKey: 'ShieldCheck',
    archetype: 'METRICAS_ANALISIS',
    permissionKey: 'admin',
    defaultTab: 'matriz',
    children: [
      { id: 'matriz', label: 'Matriz de Puestos & Permisos', shortLabel: 'Matriz de Puestos', iconKey: 'Building2', permissionKey: 'admin.matriz', theme: 'purple' },
      { id: 'macro', label: 'Variables Macro & Cierre', shortLabel: 'Variables Macro', iconKey: 'DollarSign', permissionKey: 'admin.macro', theme: 'emerald' },
      { id: 'alertas', label: 'Alertas & Cumplimiento', shortLabel: 'Alertas', iconKey: 'ShieldAlert', permissionKey: 'admin.alertas', theme: 'amber' },
      { id: 'ia', label: 'Gobernanza IA & Prompts', shortLabel: 'Gobernanza IA', iconKey: 'Brain', permissionKey: 'admin.ia', theme: 'cyan' },
      { id: 'compras', label: 'Config. Compras & WhatsApp', shortLabel: 'Config. Compras', iconKey: 'ShoppingCart', permissionKey: 'admin.compras', theme: 'sky' },
      { id: 'rubros', label: 'Gestión de Rubros & Oficios', shortLabel: 'Rubros & Oficios', iconKey: 'Wrench', permissionKey: 'admin.rubros', theme: 'amber' },
      { id: 'auditoria', label: 'Libro de Auditoría', shortLabel: 'Libro de Auditoría', iconKey: 'History', permissionKey: 'admin.auditoria', theme: 'cyan' },
    ],
  },
]

const MODULE_BY_ID = new Map(NAVIGATION_MODULES.map((m) => [m.id, m]))

export function getNavigationModuleById(moduleId) {
  return MODULE_BY_ID.get(moduleId) || null
}

export function getNavigationModuleByPath(pathname = '/') {
  const clean = String(pathname || '/').replace(/\/+$/, '') || '/'
  return NAVIGATION_MODULES.find((m) => m.path === clean) || null
}

export function resolveModuleTab(moduleOrId, rawTab) {
  const mod = typeof moduleOrId === 'string' ? getNavigationModuleById(moduleOrId) : moduleOrId
  if (!mod || !Array.isArray(mod.children) || mod.children.length === 0) return null
  const normalized = String(rawTab || '').trim()
  const mapped = (mod.tabAliases && mod.tabAliases[normalized]) || normalized
  if (mapped && mod.children.some((c) => c.id === mapped)) return mapped
  return mod.defaultTab || mod.children[0].id
}

export function buildSubmoduleUrl(modulePath, tabId) {
  if (!tabId) return modulePath
  return `${modulePath}?tab=${encodeURIComponent(tabId)}`
}

export function isSupervisorOrAdminRole(profile) {
  const role = String(profile?.role || '').trim().toLowerCase()
  return ['admin', 'administrador', 'gerencia', 'supervisor'].includes(role)
}

/**
 * Deriva automáticamente la perspectiva operativa del usuario autenticado
 * (reemplaza botones manuales de "Terminal / Rol" en Terceros y Barcos).
 */
export function resolveUserRolePerspective(profile) {
  const roleKey = String(profile?.role_key || profile?.org_role_key || '').trim().toUpperCase()
  const role = String(profile?.role || '').trim().toLowerCase()
  if (roleKey.includes('DIRECCION') && !roleKey.includes('ADMIN')) return 'direccion'
  if (roleKey.includes('LIQUIDACION') || roleKey.includes('MARIA') || role === 'administracion') return 'maria_jose'
  if (roleKey.includes('JEFE_OBRA') || role === 'jefe_obra' || role === 'operario') return 'jefe_obra'
  if (role === 'direccion' || role === 'dirección') return 'direccion'
  return 'admin'
}

/**
 * Filtra módulos y submódulos visibles según rol actual y (Etapa 5) allowedSections.
 * Si allowedSections es un arreglo (incluso vacío), actúa como fuente autoritativa del puesto.
 */
export function getVisibleNavigationModules({ profile = null, allowedSections = null } = {}) {
  const canSeeSupervisorTabs = !profile || isSupervisorOrAdminRole(profile)
  const hasExplicitAllowList = Array.isArray(allowedSections)
  const allowSet = hasExplicitAllowList ? new Set(allowedSections) : null

  return NAVIGATION_MODULES.reduce((acc, mod) => {
    const parentAllowed = !allowSet || allowSet.has(mod.permissionKey)
    const rawChildren = Array.isArray(mod.children) ? mod.children : []
    const visibleChildren = rawChildren.filter((child) => {
      if (!hasExplicitAllowList && child.requiresSupervisorOrAdmin && !canSeeSupervisorTabs) return false
      if (allowSet && !parentAllowed && !allowSet.has(child.permissionKey)) return false
      return true
    })

    if (allowSet && !parentAllowed && visibleChildren.length === 0) return acc
    // Si un módulo con hijos queda con 1 solo hijo visible, opera como acceso directo apuntando a ese submódulo
    const isFlattenedSingle = rawChildren.length > 0 && visibleChildren.length === 1
    const finalChildren = rawChildren.length > 0 && visibleChildren.length <= 1 ? [] : visibleChildren
    const effectiveDefaultTab = isFlattenedSingle ? visibleChildren[0].id : mod.defaultTab
    acc.push({ ...mod, defaultTab: effectiveDefaultTab, children: finalChildren })
    return acc
  }, [])
}
