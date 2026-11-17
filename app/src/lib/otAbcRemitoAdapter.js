/**
 * otAbcRemitoAdapter.js
 * Adapta las plantillas tabuladas del Catálogo OT.ABC (`ot_templates`)
 * hacia líneas facturables del Remito Comercial (`RemitoComercialAlfaPanel`).
 * Garantiza fuente única: precios unitarios US$, condición IVA y origen del dato
 * se leen directamente del catálogo en Supabase sin duplicación.
 */

import {
  OT_ABC_DATA_SOURCES,
  normalizeOtAbcCategory,
  normalizeOtAbcLineItems
} from './otAbcCatalogConstants.js'

export const OT_ABC_BILLING_TEMPLATES = [
  {
    id: 'OT_ABC_TODAS',
    label: 'Catálogo OT.ABC · Completo (Tarifario Oficial)',
    description: 'Importa todos los ítems, precios US$, IVA y sub-trabajos del Catálogo OT.ABC.'
  },
  {
    id: 'OT_ABC_RENOVACION',
    label: 'Catálogo OT.ABC · Renovación (+ Ambas)',
    description: 'Filtra las OT.ABC clasificadas manualmente como Renovación o Ambas.'
  },
  {
    id: 'OT_ABC_INTERMEDIA',
    label: 'Catálogo OT.ABC · Intermedia (+ Ambas)',
    description: 'Filtra las OT.ABC clasificadas manualmente como Intermedia o Ambas.'
  }
]

function computeStayDaysByKeyword(shipStays = [], shipId, keyword) {
  return shipStays
    .filter((st) => st.ship_id === shipId && String(st.location || '').toUpperCase().includes(keyword))
    .reduce((acc, st) => {
      const start = st.start_date ? new Date(`${String(st.start_date).slice(0, 10)}T00:00:00`) : null
      const end = st.end_date ? new Date(`${String(st.end_date).slice(0, 10)}T00:00:00`) : new Date()
      if (!start || Number.isNaN(start.getTime())) return acc
      return acc + Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)))
    }, 0)
}

function getSourceLabel(code) {
  return OT_ABC_DATA_SOURCES.find((s) => s.value === code)?.label || 'Jefe de Obra'
}

function buildShipTankSpecHint(ship) {
  const specs = ship?.technical_specs
  if (!specs || typeof specs !== 'object') return ''
  const fuel = specs.tanques_combustible?.notes ? `Comb: ${specs.tanques_combustible.notes}` : ''
  const water = specs.tanques_agua?.notes ? `Agua: ${specs.tanques_agua.notes}` : ''
  return [fuel, water].filter(Boolean).join(' | ').replace(/\n+/g, '; ')
}

function filterTemplatesForScope(otTemplates = [], templateId = 'OT_ABC_TODAS') {
  return (otTemplates || []).filter((tpl) => {
    const cat = normalizeOtAbcCategory(tpl.category)
    if (templateId === 'OT_ABC_RENOVACION') return cat === 'Renovación' || cat === 'Ambas'
    if (templateId === 'OT_ABC_INTERMEDIA') return cat === 'Intermedia' || cat === 'Ambas'
    return true
  })
}

export function buildRemitoRowsFromOtCatalog({
  ship,
  shipStays = [],
  craneHours = {},
  otTemplates = [],
  templateId = 'OT_ABC_TODAS',
  existingRows = []
}) {
  if (!ship) return []

  const varaderoDays = computeStayDaysByKeyword(shipStays, ship.id, 'VARADERO')
  const muelleDays = computeStayDaysByKeyword(shipStays, ship.id, 'MUELLE')
  const tankHint = buildShipTankSpecHint(ship)
  const existingById = new Map((existingRows || []).map((r) => [r.line_code, r]))

  const scopedTemplates = filterTemplatesForScope(otTemplates, templateId)
  const rows = []
  const generatedCodes = new Set()

  for (const tpl of scopedTemplates) {
    const lines = normalizeOtAbcLineItems(tpl.line_items)
    const billable = lines.filter((l) => l.row_type !== 'NOTE')
    const prefix = String(tpl.name || 'OT').replace(/[^A-Z0-9]/gi, '').slice(0, 4).toUpperCase() || 'OT'

    billable.forEach((line, idx) => {
      const code = `${prefix}-${String(idx + 1).padStart(2, '0')}`
      generatedCodes.add(code)
      const prev = existingById.get(code)
      const upperConcept = `${tpl.name || ''} ${line.concept || ''}`.toUpperCase()

      let autoQty = 0
      if (line.data_source === 'MOVIMIENTOS_BUQUE') {
        if (upperConcept.includes('VARADERO')) autoQty = varaderoDays
        else if (upperConcept.includes('MUELLE')) autoQty = muelleDays
      } else if (upperConcept.includes('GRUA') || upperConcept.includes('GRÚA')) {
        if (upperConcept.includes('8 TON')) autoQty = craneHours.shipGruaChica || 0
        else if (upperConcept.includes('60 TON')) autoQty = craneHours.shipGruaGrande || 0
      }

      const conceptText = line.row_type === 'SUBWORK' && line.subwork_title
        ? `${line.subwork_title}: ${line.concept}`
        : line.concept

      const catalogPrice = Number(line.unit_price_usd || 0)
      const resolvedPrice = prev && prev.is_alfa_locked === false && prev.unit_price_usd !== undefined
        ? Number(prev.unit_price_usd)
        : catalogPrice

      const defaultObs = line.data_source === 'PADRON_BUQUES' && tankHint
        ? tankHint
        : (tpl.fixed_notes || '')

      rows.push({
        id: prev?.id || `rem_${ship.id}_${code}`,
        line_code: code,
        rubro: tpl.name,
        concept: prev?.concept || conceptText || tpl.name,
        source_module: `${tpl.name} · ${getSourceLabel(line.data_source)}`,
        unit: line.unit || 'Global',
        quantity: prev?.manualQtyOverride ? Number(prev.quantity || 0) : (prev?.quantity ?? autoQty),
        unit_price_usd: resolvedPrice,
        tax_type: prev?.tax_type || (line.tax_type === 'GRAVADO_21' ? 'GRAVADO_21' : 'EXENTO'),
        is_alfa_locked: catalogPrice > 0 && prev?.is_alfa_locked !== false,
        manualQtyOverride: Boolean(prev?.manualQtyOverride),
        observations: prev?.observations || defaultObs
      })
    })
  }

  const customRows = (existingRows || []).filter((r) => !generatedCodes.has(r.line_code))
  return [...rows, ...customRows]
}
