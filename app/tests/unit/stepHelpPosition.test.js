import { describe, it, expect } from 'vitest'
import { computeStepHelpPosition } from '../../src/lib/stepHelpPosition.js'
import { BUSINESS_HELP_REGISTRY, exportBusinessHelpForAI } from '../../src/lib/businessHelpRegistry.js'

describe('stepHelpPosition — Motor Zero-Scroll de Ayudas Contextuales', () => {
  it('despliega hacia arriba cuando isLastStep=true (ej. Paso 3 de Pañol)', () => {
    const pos = computeStepHelpPosition({
      rect: { top: 560, bottom: 588, left: 220, right: 248 },
      viewportWidth: 1366,
      viewportHeight: 768,
      isLastStep: true
    })
    expect(pos.direction).toBe('up')
    expect(pos.bottom).toBe(180)
    expect(pos.left).toBe(258)
    expect(pos.top).toBeUndefined()
  })

  it('despliega hacia arriba automáticamente cuando falta espacio inferior aunque isLastStep=false', () => {
    const pos = computeStepHelpPosition({
      rect: { top: 640, bottom: 668, left: 200, right: 228 },
      viewportWidth: 1280,
      viewportHeight: 720,
      isLastStep: false,
      estimatedHeight: 180
    })
    expect(pos.direction).toBe('up')
    expect(pos.bottom).toBe(52)
  })

  it('despliega hacia abajo cuando hay espacio suficiente en pasos superiores', () => {
    const pos = computeStepHelpPosition({
      rect: { top: 150, bottom: 178, left: 200, right: 228 },
      viewportWidth: 1366,
      viewportHeight: 768,
      isLastStep: false,
      estimatedHeight: 160
    })
    expect(pos.direction).toBe('down')
    expect(pos.top).toBe(150)
    expect(pos.left).toBe(238)
  })

  it('mantiene el ancho y borde izquierdo dentro del viewport en pantallas angostas', () => {
    const pos = computeStepHelpPosition({
      rect: { top: 200, bottom: 228, left: 320, right: 348 },
      viewportWidth: 420,
      viewportHeight: 700,
      isLastStep: false
    })
    expect(pos.left + pos.width).toBeLessThanOrEqual(420 - 12)
    expect(pos.left).toBeGreaterThanOrEqual(12)
  })

  it('exportBusinessHelpForAI devuelve todas las reglas de negocio estructuradas sin entradas vacías', () => {
    const entries = exportBusinessHelpForAI()
    expect(Object.keys(BUSINESS_HELP_REGISTRY).length).toBeGreaterThanOrEqual(18)
    expect(entries.length).toBeGreaterThanOrEqual(45)
    for (const entry of entries) {
      expect(entry.id).toBeTruthy()
      expect(entry.title).toBeTruthy()
      expect(entry.rule).toBeTruthy()
    }
  })
})
