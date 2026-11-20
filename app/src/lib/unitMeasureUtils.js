/**
 * unitMeasureUtils.js
 * Fuente Única de Verdad para Unidades de Medida Oficiales, Normalización y % de Seguridad Naval.
 * Compartida por Pañol (Catálogo & Stock) y Compras (Pedidos & Alta de Materiales).
 */
import { normalizeText } from './allocationEngine.js'

export const OFFICIAL_UNITS = [
  { value: 'unidad', label: 'Unidad (un.)' },
  { value: 'm2', label: 'm² (Lado x Lado / Área)' },
  { value: 'metro lineal', label: 'Metro Lineal (m)' },
  { value: 'kg', label: 'Kilogramos (kg)' },
  { value: 'm3', label: 'Metros Cúbicos (m³)' },
  { value: 'Litros', label: 'Litros (L)' },
  { value: 'Tubo', label: 'Tubo / Cilindro' },
  { value: 'Bolsón', label: 'Bolsón' },
  { value: 'Caja', label: 'Caja' },
  { value: 'Rollo', label: 'Rollo' },
  { value: 'Barra', label: 'Barra' },
  { value: 'Pieza', label: 'Pieza' }
]

export const SECURITY_FACTORS = [
  { value: 1.02, label: '2% (Factor 1.02)' },
  { value: 1.06, label: '6% — Predeterminado (Factor 1.06)' },
  { value: 1.10, label: '10% (Factor 1.10)' },
  { value: 1.15, label: '15% (Factor 1.15)' },
  { value: 1.20, label: '20% (Factor 1.20)' },
  { value: 1.30, label: '30% (Factor 1.30)' }
]

export function deduceUnitMeasure(materialName = '') {
  const text = String(materialName || '').toLowerCase()
  if (text.includes('lado x lado') || /\bchapa(s)?\b/.test(text) || /\bm2\b|\bm²\b/.test(text)) return 'm2'
  if (text.includes('x metro lineal') || text.includes('x metro') || text.includes('metro lineal')) return 'metro lineal'
  if (text.includes('x kg') || text.includes('(kg)') || text.includes('x kilo') || text.includes('kilo') || /\bkg\b/.test(text)) return 'kg'
  if (text.includes('x m3') || text.includes('metro cubico') || /\bm3\b|\bm³\b/.test(text)) return 'm3'
  if (text.includes('x litro') || /\blitro(s)?\b/.test(text)) return 'Litros'
  if (/\btubo(s)?\b/.test(text)) return 'Tubo'
  return 'unidad'
}

export function normalizeUnitMeasure(rawUnit = '', materialName = '') {
  const clean = String(rawUnit || '').trim()
  if (!clean) return deduceUnitMeasure(materialName)
  const lower = clean.toLowerCase()
  if (['unidad', 'un', 'un.', 'u', 'u.'].includes(lower)) return 'unidad'
  if (['m2', 'm²', 'lado x lado', 'metro cuadrado', 'metros cuadrados', 'chapa'].includes(lower)) return 'm2'
  if (['metro', 'metros', 'metro lineal', 'metros lineales', 'ml', 'm'].includes(lower)) return 'metro lineal'
  if (['kg', 'kgs', 'kilo', 'kilos', 'kilogramo', 'kilogramos'].includes(lower)) return 'kg'
  if (['m3', 'm³', 'metro cubico', 'metro cúbico'].includes(lower)) return 'm3'
  if (['litro', 'litros', 'lt', 'lts', 'l'].includes(lower)) return 'Litros'
  if (['tubo', 'tubos', 'cilindro'].includes(lower)) return 'Tubo'
  if (['bolson', 'bolsón'].includes(lower)) return 'Bolsón'
  if (['caja', 'cajas'].includes(lower)) return 'Caja'
  if (['rollo', 'rollos'].includes(lower)) return 'Rollo'
  if (['barra', 'barras'].includes(lower)) return 'Barra'
  if (['pieza', 'piezas'].includes(lower)) return 'Pieza'
  return clean
}

export function formatUnitMeasureShort(rawUnit = '') {
  const norm = normalizeUnitMeasure(rawUnit)
  if (norm === 'm2') return 'm²'
  if (norm === 'm3') return 'm³'
  if (norm === 'unidad') return 'un.'
  if (norm === 'metro lineal') return 'm'
  if (norm === 'Litros') return 'L'
  return norm
}

export function resolveOrderMaterialUnit(materials = [], matId, rawName, fallbackUnit) {
  const byId = matId ? materials.find((m) => m.id === matId) : null
  const byName = !byId && rawName
    ? materials.find((m) => normalizeText(m.name) === normalizeText(rawName))
    : null
  const matched = byId || byName
  return normalizeUnitMeasure(matched?.unit_measure || fallbackUnit, matched?.name || rawName)
}

export function computeMaterialCostUsd(costArs = 0, securityFactor = 1.06, dollarRate = 1500) {
  const ars = Math.max(0, Number(costArs) || 0)
  const factor = Number(securityFactor) > 0 ? Number(securityFactor) : 1.06
  const fx = Number(dollarRate) > 0 ? Number(dollarRate) : 1500
  return Math.round(((ars * factor) / fx) * 100) / 100
}
