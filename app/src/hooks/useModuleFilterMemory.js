import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import {
  MAX_SAVED_VIEWS_PER_MODULE,
  resolveFilterUserKey,
  loadModuleFilterMemory,
  saveModuleFilterMemory,
  loadSavedFilterViewsLocal,
  saveSavedFilterViewsLocal,
  syncModuleSavedViewsFromSupabase,
  persistModuleSavedViewsToSupabase,
  addSavedViewToList,
  renameSavedViewInList,
  updateSavedViewFiltersInList,
  deleteSavedViewFromList,
  areFiltersEqual,
  hasAnyNonDefaultFilter
} from '../lib/filterViewsService.js'
import { getModuleFilterConfig, resolveConfiguredSummary } from '../lib/moduleFilterConfigs.js'

/**
 * Calcula sincrónicamente el estado inicial de filtros de un módulo (0 ms)
 * combinando valores por defecto del registro central, memoria persistida y overrides de URL.
 */
export function resolveInitialModuleFilters(user, profile, moduleKey, urlOverrides = {}) {
  const { defaults = {} } = getModuleFilterConfig(moduleKey)
  const userKey = resolveFilterUserKey(user, profile)
  const restored = loadModuleFilterMemory(userKey, moduleKey, defaults)
  const next = { ...restored }
  for (const [k, v] of Object.entries(urlOverrides || {})) {
    if (v !== undefined && v !== null && v !== '') {
      next[k] = v
    }
  }
  return next
}

/**
 * Hook universal de Zona 3 para memoria continua de filtros y hasta 5 Vistas Favoritas por usuario/módulo.
 */
export function useModuleFilterMemory({
  moduleKey,
  currentFilters = {},
  setters = {},
  summaryContext = {},
  hasActiveFilters
}) {
  const { user, profile } = useAuth()
  const { defaults = {} } = useMemo(() => getModuleFilterConfig(moduleKey), [moduleKey])
  const userKey = useMemo(() => resolveFilterUserKey(user, profile), [user, profile])
  const actorName = profile?.full_name || user?.email || 'Usuario'

  const [savedViews, setSavedViews] = useState(() => loadSavedFilterViewsLocal(userKey, moduleKey))
  const [viewsError, setViewsError] = useState(null)
  const [syncingViews, setSyncingViews] = useState(false)

  useEffect(() => {
    let active = true
    syncModuleSavedViewsFromSupabase(userKey, moduleKey)
      .then((synced) => {
        if (active && Array.isArray(synced)) setSavedViews(synced)
      })
      .catch(() => {})
    return () => { active = false }
  }, [userKey, moduleKey])

  const serializedFilters = JSON.stringify(currentFilters || {})
  useEffect(() => {
    try {
      saveModuleFilterMemory(userKey, moduleKey, JSON.parse(serializedFilters))
    } catch {
      // Ignorar error de serialización
    }
  }, [userKey, moduleKey, serializedFilters])

  const effectiveHasFilters = useMemo(() => {
    if (typeof hasActiveFilters === 'boolean') return hasActiveFilters
    return hasAnyNonDefaultFilter(currentFilters, defaults)
  }, [hasActiveFilters, currentFilters, defaults])

  const activeViewId = useMemo(() => {
    const match = savedViews.find((v) => areFiltersEqual(v.filters, currentFilters, defaults))
    return match ? match.id : null
  }, [savedViews, currentFilters, defaults])

  const commitViewsList = useCallback(
    async (nextList) => {
      setViewsError(null)
      setSavedViews(nextList)
      saveSavedFilterViewsLocal(userKey, moduleKey, nextList)
      try {
        setSyncingViews(true)
        await persistModuleSavedViewsToSupabase(userKey, moduleKey, nextList, actorName)
      } catch (err) {
        setViewsError('Guardado local ok; pendiente sincronizar en nube.')
        console.warn('Error sincronizando vistas de filtro:', err?.message || err)
      } finally {
        setSyncingViews(false)
      }
    },
    [userKey, moduleKey, actorName]
  )

  const onApplyView = useCallback(
    (view) => {
      if (!view) return
      const merged = { ...defaults, ...(view.filters || {}) }
      for (const [key, setter] of Object.entries(setters || {})) {
        if (typeof setter === 'function') setter(merged[key])
      }
      saveModuleFilterMemory(userKey, moduleKey, merged)
    },
    [defaults, setters, userKey, moduleKey]
  )

  const onSaveNewView = useCallback(
    async (name) => {
      const summaryLines = resolveConfiguredSummary(moduleKey, currentFilters, summaryContext)
      const nextList = addSavedViewToList(savedViews, { name, filters: currentFilters, summaryLines })
      await commitViewsList(nextList)
    },
    [moduleKey, savedViews, currentFilters, summaryContext, commitViewsList]
  )

  const onRenameView = useCallback(
    async (viewId, nextName) => {
      await commitViewsList(renameSavedViewInList(savedViews, viewId, nextName))
    },
    [savedViews, commitViewsList]
  )

  const onUpdateViewWithCurrent = useCallback(
    async (viewId) => {
      const summaryLines = resolveConfiguredSummary(moduleKey, currentFilters, summaryContext)
      await commitViewsList(updateSavedViewFiltersInList(savedViews, viewId, { filters: currentFilters, summaryLines }))
    },
    [moduleKey, savedViews, currentFilters, summaryContext, commitViewsList]
  )

  const onDeleteView = useCallback(
    async (viewId) => {
      await commitViewsList(deleteSavedViewFromList(savedViews, viewId))
    },
    [savedViews, commitViewsList]
  )

  const onClearAllViews = useCallback(async () => {
    await commitViewsList([])
  }, [commitViewsList])

  return useMemo(
    () => ({
      moduleKey,
      views: savedViews,
      maxViews: MAX_SAVED_VIEWS_PER_MODULE,
      activeViewId,
      hasActiveFilters: effectiveHasFilters,
      syncingViews,
      viewsError,
      onApplyView,
      onSaveNewView,
      onRenameView,
      onUpdateViewWithCurrent,
      onDeleteView,
      onClearAllViews
    }),
    [moduleKey, savedViews, activeViewId, effectiveHasFilters, syncingViews, viewsError, onApplyView, onSaveNewView, onRenameView, onUpdateViewWithCurrent, onDeleteView, onClearAllViews]
  )
}
