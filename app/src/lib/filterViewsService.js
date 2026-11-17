import { supabase } from './supabase.js'

export const MAX_SAVED_VIEWS_PER_MODULE = 5
export const FILTER_MEMORY_STORAGE_PREFIX = 'aloncar_filter_memory_v1'
export const SAVED_VIEWS_STORAGE_PREFIX = 'aloncar_saved_filter_views_v1'
export const SAVED_VIEWS_SYSTEM_SETTING_KEY = 'user_saved_filter_views'

/**
 * Resuelve una clave estable y determinística para identificar al usuario actual.
 */
export function resolveFilterUserKey(user, profile = null) {
  const raw = user?.id || profile?.id || user?.email || profile?.email || 'anon'
  return String(raw).trim().toLowerCase() || 'anon'
}

function getSafeStorage() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage
  } catch {
    // Entorno Node o storage bloqueado
  }
  return null
}

function buildMemoryStorageKey(userKey, moduleKey) {
  return `${FILTER_MEMORY_STORAGE_PREFIX}:${userKey}:${moduleKey}`
}

function buildViewsStorageKey(userKey, moduleKey) {
  return `${SAVED_VIEWS_STORAGE_PREFIX}:${userKey}:${moduleKey}`
}

/**
 * Lee en 0 ms el último estado de filtros guardado para (usuario, módulo).
 */
export function loadModuleFilterMemory(userKey, moduleKey, defaults = {}) {
  const base = { ...defaults }
  const storage = getSafeStorage()
  if (!storage || !moduleKey) return base
  try {
    const raw = storage.getItem(buildMemoryStorageKey(userKey, moduleKey))
    if (!raw) return base
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return base
    const merged = { ...base }
    for (const key of Object.keys(base)) {
      if (key in parsed && parsed[key] !== undefined) {
        merged[key] = parsed[key]
      }
    }
    return merged
  } catch {
    return base
  }
}

/**
 * Persiste en localStorage el estado actual de filtros para restaurarlo al volver al módulo.
 */
export function saveModuleFilterMemory(userKey, moduleKey, filters = {}) {
  const storage = getSafeStorage()
  if (!storage || !moduleKey) return
  try {
    storage.setItem(buildMemoryStorageKey(userKey, moduleKey), JSON.stringify(filters || {}))
  } catch {
    // Ignorar cuota llena o modo privado
  }
}

/**
 * Normaliza una vista guardada evitando valores corruptos o exceso de longitud.
 */
export function normalizeSavedViewItem(raw) {
  if (!raw || typeof raw !== 'object') return null
  const name = String(raw.name || '').trim()
  if (!name) return null
  return {
    id: String(raw.id || `view_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    name: name.slice(0, 60),
    filters: raw.filters && typeof raw.filters === 'object' ? { ...raw.filters } : {},
    summaryLines: Array.isArray(raw.summaryLines)
      ? raw.summaryLines.map((l) => String(l)).filter(Boolean).slice(0, 12)
      : [],
    updatedAt: raw.updatedAt || new Date().toISOString()
  }
}

/**
 * Lee vistas favoritas guardadas desde localStorage (0 ms).
 */
export function loadSavedFilterViewsLocal(userKey, moduleKey) {
  const storage = getSafeStorage()
  if (!storage || !moduleKey) return []
  try {
    const raw = storage.getItem(buildViewsStorageKey(userKey, moduleKey))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed
      .map(normalizeSavedViewItem)
      .filter(Boolean)
      .slice(0, MAX_SAVED_VIEWS_PER_MODULE)
  } catch {
    return []
  }
}

/**
 * Escribe vistas favoritas en localStorage.
 */
export function saveSavedFilterViewsLocal(userKey, moduleKey, views = []) {
  const storage = getSafeStorage()
  if (!storage || !moduleKey) return
  try {
    const clean = (Array.isArray(views) ? views : [])
      .map(normalizeSavedViewItem)
      .filter(Boolean)
      .slice(0, MAX_SAVED_VIEWS_PER_MODULE)
    storage.setItem(buildViewsStorageKey(userKey, moduleKey), JSON.stringify(clean))
  } catch {
    // Ignorar error de cuota
  }
}

/**
 * Agrega una nueva vista respetando el tope máximo de 5 por usuario/módulo.
 */
export function addSavedViewToList(list = [], { name, filters, summaryLines = [] }) {
  const cleanName = String(name || '').trim()
  if (!cleanName) throw new Error('Ingresá un nombre para la vista.')
  const current = Array.isArray(list) ? list : []
  if (current.length >= MAX_SAVED_VIEWS_PER_MODULE) {
    throw new Error(`Máximo ${MAX_SAVED_VIEWS_PER_MODULE} vistas guardadas por módulo.`)
  }
  const newItem = normalizeSavedViewItem({
    id: `view_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    name: cleanName,
    filters: { ...(filters || {}) },
    summaryLines,
    updatedAt: new Date().toISOString()
  })
  return [...current, newItem]
}

export function renameSavedViewInList(list = [], viewId, nextName) {
  const cleanName = String(nextName || '').trim()
  if (!cleanName) throw new Error('El nombre de la vista no puede quedar vacío.')
  return (Array.isArray(list) ? list : []).map((v) =>
    v.id === viewId
      ? { ...v, name: cleanName.slice(0, 60), updatedAt: new Date().toISOString() }
      : v
  )
}

export function updateSavedViewFiltersInList(list = [], viewId, { filters, summaryLines = [] }) {
  return (Array.isArray(list) ? list : []).map((v) =>
    v.id === viewId
      ? {
          ...v,
          filters: { ...(filters || {}) },
          summaryLines: Array.isArray(summaryLines) ? summaryLines.filter(Boolean) : [],
          updatedAt: new Date().toISOString()
        }
      : v
  )
}

export function deleteSavedViewFromList(list = [], viewId) {
  return (Array.isArray(list) ? list : []).filter((v) => v.id !== viewId)
}

/**
 * Compara dos objetos de filtros de forma estable para detectar si una vista está activa.
 */
export function areFiltersEqual(a = {}, b = {}, defaults = {}) {
  const keys = new Set([...Object.keys(defaults || {}), ...Object.keys(a || {}), ...Object.keys(b || {})])
  for (const k of keys) {
    const valA = a?.[k] !== undefined ? a[k] : defaults?.[k]
    const valB = b?.[k] !== undefined ? b[k] : defaults?.[k]
    if (String(valA ?? '') !== String(valB ?? '')) return false
  }
  return true
}

export function hasAnyNonDefaultFilter(current = {}, defaults = {}) {
  return !areFiltersEqual(current, defaults, defaults)
}

export function buildGenericFilterSummary(filters = {}, defaults = {}, labelMap = {}) {
  const lines = []
  for (const [key, val] of Object.entries(filters || {})) {
    const defVal = defaults?.[key]
    if (String(val ?? '') === String(defVal ?? '')) continue
    if (val === '' || val === null || val === undefined || val === false) continue
    const label = labelMap?.[key] || key
    const display = val === true ? 'Sí' : String(val)
    lines.push(`${label}: ${display}`)
  }
  return lines
}

/**
 * Lee el mapa completo de vistas guardadas desde Supabase (`system_settings`).
 */
export async function fetchRemoteSavedFilterViewsMap() {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', SAVED_VIEWS_SYSTEM_SETTING_KEY)
    .maybeSingle()

  if (error) throw error
  const raw = data?.value
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
}

/**
 * Sincroniza vistas guardadas del usuario para un módulo específico desde Supabase.
 * Devuelve la lista resuelta (remota si existe, o local si aún no se subió).
 */
export async function syncModuleSavedViewsFromSupabase(userKey, moduleKey) {
  if (!userKey || !moduleKey) return []
  const remoteAll = await fetchRemoteSavedFilterViewsMap()
  const remoteList = remoteAll?.[userKey]?.[moduleKey]
  const localList = loadSavedFilterViewsLocal(userKey, moduleKey)

  if (Array.isArray(remoteList) && remoteList.length > 0) {
    const normalized = remoteList
      .map(normalizeSavedViewItem)
      .filter(Boolean)
      .slice(0, MAX_SAVED_VIEWS_PER_MODULE)
    saveSavedFilterViewsLocal(userKey, moduleKey, normalized)
    return normalized
  }

  return localList
}

/**
 * Persiste en `system_settings` (`onConflict: 'key'`) las vistas del usuario y módulo.
 * Realiza merge seguro por usuario/módulo para no sobrescribir otros usuarios.
 */
export async function persistModuleSavedViewsToSupabase(userKey, moduleKey, views = [], updatedBy = 'Usuario') {
  if (!userKey || !moduleKey) return null
  const clean = (Array.isArray(views) ? views : [])
    .map(normalizeSavedViewItem)
    .filter(Boolean)
    .slice(0, MAX_SAVED_VIEWS_PER_MODULE)

  let existingMap = {}
  try {
    existingMap = await fetchRemoteSavedFilterViewsMap()
  } catch {
    existingMap = {}
  }

  const nextUserMap = {
    ...(existingMap?.[userKey] && typeof existingMap[userKey] === 'object' ? existingMap[userKey] : {}),
    [moduleKey]: clean
  }
  const nextRootValue = {
    ...existingMap,
    [userKey]: nextUserMap
  }

  const payload = {
    key: SAVED_VIEWS_SYSTEM_SETTING_KEY,
    value: nextRootValue,
    updated_at: new Date().toISOString(),
    updated_by: String(updatedBy || 'Usuario')
  }

  const { data, error } = await supabase
    .from('system_settings')
    .upsert([payload], { onConflict: 'key' })
    .select()
    .single()

  if (error) throw error
  return data
}
