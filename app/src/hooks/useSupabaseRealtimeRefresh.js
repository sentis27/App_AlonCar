import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase.js'

/**
 * Detecta si el usuario está escribiendo en una celda editable o formulario/modal
 * (excluye barras de búsqueda puras) para evitar pisar ediciones en curso.
 */
function isEditingControlFocused() {
  if (typeof document === 'undefined') return false
  const el = document.activeElement
  if (!el || el === document.body) return false
  if (el.dataset?.realtimeIgnore === 'true' || el.type === 'search') return false
  const isEditableField = el.matches?.('input:not([type="checkbox"]):not([type="radio"]), textarea, select, [contenteditable="true"]')
  if (!isEditableField) return false
  return Boolean(el.closest?.('td, th, form, [role="dialog"], [aria-modal="true"], .fixed'))
}

/**
 * Suscripción reutilizable a Supabase Realtime (`postgres_changes`) + respaldo por foco de ventana.
 * Con guardia anti-colisión: difiere la recarga automática mientras haya edición o modal abierto.
 */
export function useSupabaseRealtimeRefresh({
  channelName = 'aloncar_live_sync',
  tables = [],
  onSync,
  enabled = true,
  pauseWhen = false,
  pauseWhileEditing = true,
  debounceMs = 400,
  focusCooldownMs = 8000,
  pollIntervalMs = 30000
}) {
  const [realtimeStatus, setRealtimeStatus] = useState('CONNECTING')
  const [lastSyncAt, setLastSyncAt] = useState(null)
  const [hasPendingSync, setHasPendingSync] = useState(false)

  const onSyncRef = useRef(onSync)
  const pauseWhenRef = useRef(pauseWhen)
  const pauseEditingRef = useRef(pauseWhileEditing)
  const pendingSyncRef = useRef(false)
  const lastTriggerRef = useRef(0)
  const timerRef = useRef(null)

  useEffect(() => {
    onSyncRef.current = onSync
  }, [onSync])

  useEffect(() => {
    pauseWhenRef.current = Boolean(pauseWhen)
    pauseEditingRef.current = Boolean(pauseWhileEditing)
  }, [pauseWhen, pauseWhileEditing])

  const shouldPause = useCallback(() => {
    if (pauseWhenRef.current) return true
    if (pauseEditingRef.current && isEditingControlFocused()) return true
    return false
  }, [])

  const markSynced = useCallback(() => {
    lastTriggerRef.current = Date.now()
    setLastSyncAt(new Date())
  }, [])

  const runOrDeferSync = useCallback(() => {
    if (shouldPause()) {
      pendingSyncRef.current = true
      setHasPendingSync(true)
      return
    }
    pendingSyncRef.current = false
    setHasPendingSync(false)
    lastTriggerRef.current = Date.now()
    onSyncRef.current?.()
  }, [shouldPause])

  const scheduleSync = useCallback((customDelayMs = debounceMs) => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      runOrDeferSync()
    }, customDelayMs)
  }, [debounceMs, runOrDeferSync])

  // Reanudar automáticamente cuando se cierra un modal o se sale de una celda en edición
  useEffect(() => {
    if (!pauseWhen && pendingSyncRef.current && !shouldPause()) {
      scheduleSync(150)
    }
  }, [pauseWhen, shouldPause, scheduleSync])

  const tablesKey = tables.join('|')

  useEffect(() => {
    if (!enabled || !tablesKey) return undefined

    const tableList = tablesKey.split('|').filter(Boolean)
    let channel = supabase.channel(`${channelName}_${Date.now()}`)

    tableList.forEach((tbl) => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: tbl },
        () => scheduleSync()
      )
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') setRealtimeStatus('SUBSCRIBED')
      else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        setRealtimeStatus('FALLBACK')
      }
    })

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return
      if (Date.now() - lastTriggerRef.current >= focusCooldownMs) {
        scheduleSync()
      }
    }

    const handleFocusOut = () => {
      if (!pendingSyncRef.current) return
      setTimeout(() => {
        if (pendingSyncRef.current && !shouldPause()) {
          scheduleSync(150)
        }
      }, 120)
    }

    window.addEventListener('focus', handleVisibilityOrFocus)
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)
    document.addEventListener('focusout', handleFocusOut)

    const pollId =
      pollIntervalMs > 0
        ? setInterval(() => {
            if (document.visibilityState === 'visible') {
              scheduleSync()
            }
          }, pollIntervalMs)
        : null

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (pollId) clearInterval(pollId)
      window.removeEventListener('focus', handleVisibilityOrFocus)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      document.removeEventListener('focusout', handleFocusOut)
      supabase.removeChannel(channel)
    }
  }, [enabled, channelName, tablesKey, scheduleSync, shouldPause, focusCooldownMs, pollIntervalMs])

  return { realtimeStatus, lastSyncAt, hasPendingSync, markSynced }
}
