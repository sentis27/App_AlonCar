/**
 * useModuleTab.js
 * Capa 2 (SKL-019): Hook canónico de sincronización URL (?tab=...) ↔ submódulo activo.
 * Preserva parámetros operativos ajenos (kpi, mode, nuevo, con_barco, shipId, etc.).
 */
import { useCallback, useMemo } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { getNavigationModuleById, resolveModuleTab } from '../lib/navigationCatalog.js'

export function useModuleTab(moduleId) {
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const moduleDef = useMemo(() => getNavigationModuleById(moduleId), [moduleId])

  const rawTab = searchParams.get('tab')
  const activeTab = useMemo(() => resolveModuleTab(moduleDef, rawTab), [moduleDef, rawTab])

  const activeSubmodule = useMemo(
    () => moduleDef?.children?.find((c) => c.id === activeTab) || null,
    [moduleDef, activeTab]
  )

  const setActiveTab = useCallback(
    (nextTab, { replace = true, preserveParams = true, removeParams = [], extraParams = {} } = {}) => {
      const resolved = resolveModuleTab(moduleDef, nextTab)
      if (!resolved) return
      const next = preserveParams ? new URLSearchParams(searchParams) : new URLSearchParams()
      for (const key of removeParams) next.delete(key)
      next.set('tab', resolved)
      for (const [k, v] of Object.entries(extraParams)) {
        if (v === null || v === undefined || v === '') next.delete(k)
        else next.set(k, String(v))
      }
      setSearchParams(next, { replace })
    },
    [moduleDef, searchParams, setSearchParams]
  )

  return {
    activeTab,
    setActiveTab,
    activeSubmodule,
    moduleDef,
    searchParams,
    setSearchParams,
    resetSubViewSignal: location.state?.resetSubViewTs || null,
  }
}

export default useModuleTab
