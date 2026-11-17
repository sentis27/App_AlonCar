import { useState, useCallback } from 'react'
import { useAuth } from '../context/AuthContext.jsx'
import { getModuleFilterConfig } from '../lib/moduleFilterConfigs.js'
import { resolveInitialModuleFilters, useModuleFilterMemory } from './useModuleFilterMemory.js'

/**
 * Coordina filtros y hasta 5 Vistas Favoritas por cada sub-pestaña de un módulo multi-vista
 * (ej. WorkOrders: unificado/ots/terceros, Pañol: planillas/gases/catalogo/epp)
 * garantizando aislamiento total entre submódulos.
 */
export function useTabbedFilterMemory({
  modulePrefix,
  tabs = [],
  activeTab,
  urlOverridesByTab = {},
  summaryContext = {},
  hasActiveFilters
}) {
  const { user, profile } = useAuth()
  const safeTab = tabs.includes(activeTab) ? activeTab : tabs[0]
  const activeModuleKey = `${modulePrefix}_${safeTab}`

  const [filtersByTab, setFiltersByTab] = useState(() => {
    const initial = {}
    for (const tab of tabs) {
      initial[tab] = resolveInitialModuleFilters(user, profile, `${modulePrefix}_${tab}`, urlOverridesByTab[tab] || {})
    }
    return initial
  })

  const setTabFilter = useCallback((tab, field, value) => {
    setFiltersByTab((prev) => ({
      ...prev,
      [tab]: { ...prev[tab], [field]: value }
    }))
  }, [])

  const setActiveFilter = useCallback(
    (field, value) => setTabFilter(safeTab, field, value),
    [safeTab, setTabFilter]
  )

  const clearActiveTabFilters = useCallback(() => {
    const { defaults } = getModuleFilterConfig(activeModuleKey)
    setFiltersByTab((prev) => ({ ...prev, [safeTab]: { ...defaults } }))
  }, [safeTab, activeModuleKey])

  const activeFilters = filtersByTab[safeTab] || {}

  const viewsController = useModuleFilterMemory({
    moduleKey: activeModuleKey,
    currentFilters: activeFilters,
    onApplyFilters: (nextObj) => {
      setFiltersByTab((prev) => ({ ...prev, [safeTab]: { ...nextObj } }))
    },
    summaryContext,
    hasActiveFilters
  })

  return {
    safeTab,
    activeModuleKey,
    filtersByTab,
    activeFilters,
    hasActiveFilters: viewsController.hasActiveFilters,
    setTabFilter,
    setActiveFilter,
    clearActiveTabFilters,
    viewsController
  }
}
