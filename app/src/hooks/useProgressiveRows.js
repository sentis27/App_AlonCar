import { useState, useEffect, useMemo, useCallback, useRef } from 'react'

/**
 * Cálculo puro del tamaño efectivo de ventana progresiva.
 * Garantiza que nunca supere `totalCount`, que respete el mínimo inicial y que
 * se expanda automáticamente si la navegación por teclado (`activeIndex`) supera el corte.
 */
export function computeEffectiveVisibleCount({
  totalCount = 0,
  requestedCount = 60,
  initialCount = 60,
  activeIndex = -1,
  keyboardBuffer = 12
} = {}) {
  if (totalCount <= 0) return 0
  const base = Math.max(initialCount, requestedCount)
  const withKeyboard = activeIndex >= 0 ? Math.max(base, activeIndex + 1 + keyboardBuffer) : base
  return Math.min(totalCount, withKeyboard)
}

/**
 * useProgressiveRows
 * Hook liviano de render progresivo para grillas grandes de AlonCar ERP.
 * - Mantiene el dataset completo en memoria (buscador, KPIs, Exportar, Seleccionar Todos,
 *   Fill-handle y Paste Matrix 2D operan sobre el 100% de `items`).
 * - Monta en el DOM bloques incrementales (`initialCount` + `batchSize`) al acercarse al
 *   final del scroll (IntersectionObserver) o al bajar con el teclado (`activeIndex`).
 */
export function useProgressiveRows({
  items = [],
  initialCount = 60,
  batchSize = 60,
  activeIndex = -1,
  scrollContainerRef = null,
  resetKey = ''
} = {}) {
  const [prevResetKey, setPrevResetKey] = useState(resetKey)
  const [requestedCount, setRequestedCount] = useState(initialCount)
  const sentinelRef = useRef(null)
  const lastLoadAtRef = useRef(0)

  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey)
    setRequestedCount(initialCount)
  }

  const visibleCount = computeEffectiveVisibleCount({
    totalCount: items.length,
    requestedCount,
    initialCount,
    activeIndex
  })

  const visibleItems = useMemo(
    () => (visibleCount >= items.length ? items : items.slice(0, visibleCount)),
    [items, visibleCount]
  )

  const hasMore = visibleCount < items.length
  const remainingCount = Math.max(0, items.length - visibleCount)

  const loadMore = useCallback(() => {
    lastLoadAtRef.current = Date.now()
    setRequestedCount((prev) => Math.min(items.length, Math.max(prev, visibleCount) + batchSize))
  }, [items.length, visibleCount, batchSize])

  const showAll = useCallback(() => {
    lastLoadAtRef.current = Date.now()
    setRequestedCount(items.length)
  }, [items.length])

  useEffect(() => {
    if (!hasMore || typeof IntersectionObserver === 'undefined') return undefined
    const sentinel = sentinelRef.current
    if (!sentinel) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return
        const now = Date.now()
        if (now - lastLoadAtRef.current < 300) return
        lastLoadAtRef.current = now
        setRequestedCount((prev) => Math.min(items.length, prev + batchSize))
      },
      {
        root: scrollContainerRef?.current || null,
        rootMargin: '160px 0px'
      }
    )

    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [hasMore, items.length, batchSize, scrollContainerRef])

  return {
    visibleItems,
    visibleCount,
    totalCount: items.length,
    hasMore,
    remainingCount,
    loadMore,
    showAll,
    sentinelRef
  }
}

export default useProgressiveRows
