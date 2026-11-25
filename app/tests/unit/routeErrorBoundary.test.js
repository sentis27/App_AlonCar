import { describe, it, expect, vi } from 'vitest'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import RouteErrorBoundary from '../../src/components/canonical/RouteErrorBoundary.jsx'

describe('RouteErrorBoundary — Paracaídas de navegación global', () => {
  it('renderiza los hijos normalmente cuando no hay error', () => {
    const html = renderToStaticMarkup(
      React.createElement(
        RouteErrorBoundary,
        { resetKey: '/personal?tab=nomina' },
        React.createElement('div', null, 'Vista operativa OK')
      )
    )
    expect(html).toContain('Vista operativa OK')
    expect(html).not.toContain('Reintentar vista')
  })

  it('captura el error vía getDerivedStateFromError y renderiza pantalla de recuperación con botón Reintentar vista', () => {
    const err = new Error('Fallo simulado de render')
    const instance = new RouteErrorBoundary({
      resetKey: '/personal?tab=nomina',
      children: React.createElement('div', null, 'OK')
    })

    const nextErrorState = RouteErrorBoundary.getDerivedStateFromError(err)
    expect(nextErrorState).toEqual({ hasError: true, error: err })

    instance.state = { ...instance.state, ...nextErrorState }
    const fallbackHtml = renderToStaticMarkup(instance.render())
    expect(fallbackHtml).toContain('Ocurrió un inconveniente al mostrar esta vista')
    expect(fallbackHtml).toContain('Reintentar vista')
    expect(fallbackHtml).toContain('Fallo simulado de render')
    expect(fallbackHtml).toContain('role="alert"')
  })

  it('se resetea automáticamente al cambiar resetKey (location.pathname + location.search)', () => {
    const prevState = {
      hasError: true,
      error: new Error('Crash en /personal'),
      prevResetKey: '/personal?tab=nomina'
    }

    // Misma ruta -> no resetea
    const sameRoute = RouteErrorBoundary.getDerivedStateFromProps(
      { resetKey: '/personal?tab=nomina' },
      prevState
    )
    expect(sameRoute).toBeNull()

    // Cambio de tab (?tab=tarifario) -> resetea
    const changedTab = RouteErrorBoundary.getDerivedStateFromProps(
      { resetKey: '/personal?tab=tarifario' },
      prevState
    )
    expect(changedTab).toEqual({
      hasError: false,
      error: null,
      prevResetKey: '/personal?tab=tarifario'
    })

    // Cambio de módulo (/compras) -> resetea
    const changedModule = RouteErrorBoundary.getDerivedStateFromProps(
      { resetKey: '/compras?tab=compras' },
      prevState
    )
    expect(changedModule).toEqual({
      hasError: false,
      error: null,
      prevResetKey: '/compras?tab=compras'
    })
  })

  it('handleRetry limpia el estado de error e invoca onReset opcional', () => {
    const onReset = vi.fn()
    const instance = new RouteErrorBoundary({
      resetKey: '/personal?tab=nomina',
      onReset,
      children: null
    })
    instance.setState = vi.fn((patch) => {
      instance.state = { ...instance.state, ...patch }
    })
    instance.state = { hasError: true, error: new Error('Boom'), prevResetKey: '/personal?tab=nomina' }

    instance.handleRetry()
    expect(instance.setState).toHaveBeenCalledWith({ hasError: false, error: null })
    expect(onReset).toHaveBeenCalledTimes(1)
  })
})
