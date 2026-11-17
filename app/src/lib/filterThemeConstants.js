/**
 * filterThemeConstants.js
 * Paleta semántica única y utilidades compartidas para filtros rápidos (Zona 3)
 * en módulos transaccionales (CARGA_EDICION) y analíticos (METRICAS_ANALISIS).
 * Base visual inspirada en PersonalNominaToolbar.jsx.
 */

import { buildStandardShipWorkOrdersCatalog } from './workOrderUnificationEngine.js'

export const ENTITY_FILTER_THEMES = {
  ship: {
    inactive: 'bg-slate-950 border-cyan-900/60 text-cyan-300 hover:border-cyan-500/70 focus:border-cyan-400',
    active: 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold focus:border-cyan-300'
  },
  ot: {
    inactive: 'bg-slate-950 border-emerald-900/60 text-emerald-300 hover:border-emerald-500/70 focus:border-emerald-400',
    active: 'bg-emerald-500/20 border-emerald-400 text-emerald-200 font-bold focus:border-emerald-300'
  },
  contractor: {
    inactive: 'bg-slate-950 border-amber-900/60 text-amber-300 hover:border-amber-500/70 focus:border-amber-400',
    active: 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold focus:border-amber-300'
  },
  worker: {
    inactive: 'bg-slate-950 border-amber-900/60 text-amber-300 hover:border-amber-500/70 focus:border-amber-400',
    active: 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold focus:border-amber-300'
  },
  foreman: {
    inactive: 'bg-slate-950 border-amber-900/60 text-amber-300 hover:border-amber-500/70 focus:border-amber-400',
    active: 'bg-amber-500/20 border-amber-400 text-amber-200 font-bold focus:border-amber-300'
  },
  supplier: {
    inactive: 'bg-slate-950 border-purple-900/60 text-purple-300 hover:border-purple-500/70 focus:border-purple-400',
    active: 'bg-purple-500/20 border-purple-400 text-purple-200 font-bold focus:border-purple-300'
  },
  owner: {
    inactive: 'bg-slate-950 border-purple-900/60 text-purple-300 hover:border-purple-500/70 focus:border-purple-400',
    active: 'bg-purple-500/20 border-purple-400 text-purple-200 font-bold focus:border-purple-300'
  },
  period: {
    inactive: 'bg-slate-950 border-indigo-900/60 text-indigo-300 hover:border-indigo-500/70 focus:border-indigo-400',
    active: 'bg-indigo-500/20 border-indigo-400 text-indigo-200 font-bold focus:border-indigo-300'
  },
  trade: {
    inactive: 'bg-slate-950 border-sky-900/60 text-sky-300 hover:border-sky-500/70 focus:border-sky-400',
    active: 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold focus:border-sky-300'
  },
  category: {
    inactive: 'bg-slate-950 border-sky-900/60 text-sky-300 hover:border-sky-500/70 focus:border-sky-400',
    active: 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold focus:border-sky-300'
  },
  destination: {
    inactive: 'bg-slate-950 border-sky-900/60 text-sky-300 hover:border-sky-500/70 focus:border-sky-400',
    active: 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold focus:border-sky-300'
  },
  location: {
    inactive: 'bg-slate-950 border-sky-900/60 text-sky-300 hover:border-sky-500/70 focus:border-sky-400',
    active: 'bg-sky-500/20 border-sky-400 text-sky-200 font-bold focus:border-sky-300'
  },
  status: {
    inactive: 'bg-slate-950 border-rose-900/60 text-rose-300 hover:border-rose-500/70 focus:border-rose-400',
    active: 'bg-rose-500/20 border-rose-400 text-rose-200 font-bold focus:border-rose-300'
  },
  voucher: {
    inactive: 'bg-slate-950 border-rose-900/60 text-rose-300 hover:border-rose-500/70 focus:border-rose-400',
    active: 'bg-rose-500/20 border-rose-400 text-rose-200 font-bold focus:border-rose-300'
  },
  modality: {
    inactive: 'bg-slate-950 border-rose-900/60 text-rose-300 hover:border-rose-500/70 focus:border-rose-400',
    active: 'bg-rose-500/20 border-rose-400 text-rose-200 font-bold focus:border-rose-300'
  },
  materialQuick: {
    inactive: 'bg-slate-950 border-teal-900/60 text-teal-300 hover:border-teal-500/70',
    active: 'bg-teal-500 text-slate-950 border-teal-400 font-bold shadow-sm'
  },
  weightQuick: {
    inactive: 'bg-slate-950 border-purple-900/60 text-purple-300 hover:border-purple-500/70',
    active: 'bg-purple-500 text-slate-950 border-purple-400 font-bold shadow-sm'
  }
}

export const CLEAR_FILTER_BTN_CLASS =
  'ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-200 text-xs font-bold transition-colors cursor-pointer border border-cyan-500/40 shrink-0'

/**
 * Devuelve clases Tailwind estandarizadas para `<select>` o `<input type="date">` de Zona 3.
 * Mantiene siempre fondo oscuro (`bg-slate-950`) según contrato SKL-012.
 */
export function getFilterSelectClass(entityKey, isActive = false, extraClass = '') {
  const theme = ENTITY_FILTER_THEMES[entityKey] || ENTITY_FILTER_THEMES.ship
  const stateCls = isActive ? theme.active : theme.inactive
  return `border rounded-lg px-2.5 py-1.5 text-xs outline-none transition-colors cursor-pointer font-semibold ${stateCls} ${extraClass}`.trim()
}

/**
 * Devuelve clases Tailwind estandarizadas para botones tipo píldora en Zona 3.
 */
export function getFilterPillClass(entityKey, isActive = false, extraClass = '') {
  const theme = ENTITY_FILTER_THEMES[entityKey] || ENTITY_FILTER_THEMES.ship
  const stateCls = isActive ? theme.active : theme.inactive
  return `inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all cursor-pointer select-none ${stateCls} ${extraClass}`.trim()
}

export function normalizeFilterText(value = '') {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()
}

/**
 * Construye catálogo ordenado de OTs filtradas por barco (cascada Barco -> OT).
 */
export function resolveOtFilterOptions(workOrders = [], workItems = [], shipFilterValue = '') {
  const normShip = String(shipFilterValue || '').trim()
  const isAll = !normShip || normShip === 'todos' || normShip === 'TODOS'
  return buildStandardShipWorkOrdersCatalog(workOrders, workItems, {
    shipId: isAll ? null : normShip,
    includeEliminated: false,
    includeClosed: true
  })
}

/**
 * Predicado para botones rápidos de Materiales en Resumen Gerencial (`CHAPA` | `CANOS`).
 */
export function matchesMaterialQuickType(row, quickType = '') {
  if (!quickType || !row) return true
  const haystack = normalizeFilterText(
    `${row.materialName || ''} ${row.rubro || ''} ${row.unitMeasure || ''}`
  )
  if (quickType === 'CHAPA') {
    return /\bCHAPAS?\b|\bCHAPON\b/.test(haystack)
  }
  if (quickType === 'CANOS') {
    return /\bCANOS?\b|\bCANERIAS?\b/.test(haystack)
  }
  return true
}

/**
 * Resuelve nombre legible de un barco para el tooltip de vistas de filtro guardadas.
 */
export function resolveShipFilterLabel(ships = [], shipId = '') {
  if (!shipId || shipId === 'todos' || shipId === 'TODOS') return ''
  const found = ships.find((s) => String(s.id) === String(shipId))
  return found?.name || String(shipId)
}

/**
 * Resuelve etiqueta legible de una OT para el tooltip de vistas de filtro guardadas.
 */
export function resolveOtFilterLabel(workOrders = [], otId = '') {
  if (!otId || otId === 'todas' || otId === 'TODAS' || otId === 'ALL') return ''
  if (otId === 'SIN_OT') return 'Sin OT'
  const found = workOrders.find((w) => String(w.id) === String(otId))
  if (!found) return String(otId)
  return found.ot_number ? `${found.ot_number} · ${found.title || ''}`.trim() : (found.title || String(otId))
}
