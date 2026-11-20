/**
 * otAbcCatalogConstants.js
 * Constantes, vocabularios controlados y funciones puras del Catálogo OT.ABC.
 * Separa estrictamente la información operativa (solo descripción / sub-trabajos)
 * de la información clasificada (precios unitarios US$, condición IVA y origen del dato).
 */

export const OT_ABC_CATEGORIES = ['Renovación', 'Intermedia', 'Ambas']

export const OT_ABC_TAX_OPTIONS = [
  {
    value: 'EXENTO',
    label: 'Exento (NO)',
    shortLabel: 'Exento',
    badgeClass: 'bg-rose-950/70 text-rose-200 border-rose-500/50'
  },
  {
    value: 'GRAVADO_21',
    label: 'Gravado 21% (SÍ)',
    shortLabel: 'IVA 21%',
    badgeClass: 'bg-emerald-950/70 text-emerald-200 border-emerald-500/50'
  },
  {
    value: 'MIXTO',
    label: 'Mixto (por renglón)',
    shortLabel: 'Mixto',
    badgeClass: 'bg-amber-950/70 text-amber-200 border-amber-500/50'
  }
]

export const OT_ABC_LINE_TAX_OPTIONS = [
  { value: 'EXENTO', label: 'NO · Exento', shortLabel: 'NO' },
  { value: 'GRAVADO_21', label: 'SÍ · IVA 21%', shortLabel: 'SÍ (21%)' }
]

export const OT_ABC_DATA_SOURCES = [
  { value: 'JEFE_DE_OBRA', label: 'Jefe de Obra', shortLabel: 'Jefe de obra' },
  { value: 'MOVIMIENTOS_BUQUE', label: 'Movimientos de Buque (Días)', shortLabel: 'Movimientos' },
  { value: 'PADRON_BUQUES', label: 'Padrón de Buques (Tanques)', shortLabel: 'Sale de buques' },
  { value: 'PLANILLA_HORAS', label: 'Planilla de Horas (Grúas)', shortLabel: 'Horas' },
  { value: 'TERCEROS_MANUAL', label: 'Terceros (Carga manual)', shortLabel: 'Terceros' },
  { value: 'CARGA_MANUAL', label: 'Carga manual', shortLabel: 'Manual' }
]

export const OT_ABC_ROW_TYPES = [
  { value: 'ITEM', label: 'Ítem Tabulado' },
  { value: 'SUBWORK', label: 'Sub-trabajo (Amarillo)' },
  { value: 'NOTE', label: 'Nota Fija / Exclusión' }
]

export function normalizeOtAbcCategory(raw) {
  const clean = String(raw || '').trim()
  if (!clean) return null
  if (clean === 'Intermediaria') return 'Intermedia'
  return OT_ABC_CATEGORIES.includes(clean) ? clean : null
}

export function normalizeOtAbcTaxType(raw, allowMixto = false) {
  const upper = String(raw || '').trim().toUpperCase()
  if (upper === 'GRAVADO_21' || upper === 'GRAVADO' || upper === 'SI' || upper === 'SÍ') return 'GRAVADO_21'
  if (allowMixto && upper === 'MIXTO') return 'MIXTO'
  return 'EXENTO'
}

export function normalizeOtAbcDataSource(raw) {
  const upper = String(raw || '').trim().toUpperCase()
  const valid = OT_ABC_DATA_SOURCES.some((s) => s.value === upper)
  return valid ? upper : 'JEFE_DE_OBRA'
}

export function createEmptyOtAbcLineItem(rowType = 'ITEM', defaults = {}, index = 0) {
  return {
    id: `line_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
    row_type: OT_ABC_ROW_TYPES.some((t) => t.value === rowType) ? rowType : 'ITEM',
    subwork_title: '',
    concept: '',
    unit: rowType === 'NOTE' ? '' : 'Global',
    unit_price_usd: 0,
    tax_type: normalizeOtAbcTaxType(defaults.default_tax_type),
    data_source: normalizeOtAbcDataSource(defaults.default_data_source),
    sort_order: index + 1
  }
}

export function normalizeOtAbcLineItems(rawItems) {
  if (!Array.isArray(rawItems)) return []
  return rawItems
    .filter((item) => item && typeof item === 'object')
    .map((item, idx) => {
      const rowType = OT_ABC_ROW_TYPES.some((t) => t.value === item.row_type) ? item.row_type : 'ITEM'
      const parsedPrice = Number(item.unit_price_usd)
      return {
        id: String(item.id || `line_${idx + 1}`),
        row_type: rowType,
        subwork_title: String(item.subwork_title || '').trim(),
        concept: String(item.concept || '').trim(),
        unit: rowType === 'NOTE' ? '' : String(item.unit || 'Global').trim(),
        unit_price_usd: rowType === 'NOTE' || !Number.isFinite(parsedPrice) ? 0 : Math.max(0, parsedPrice),
        tax_type: normalizeOtAbcTaxType(item.tax_type),
        data_source: normalizeOtAbcDataSource(item.data_source),
        sort_order: Number(item.sort_order) || idx + 1
      }
    })
}

export function computeTemplateTaxSummary(tpl) {
  const lines = normalizeOtAbcLineItems(tpl?.line_items)
  const billable = lines.filter((l) => l.row_type !== 'NOTE')
  const subworks = lines.filter((l) => l.row_type === 'SUBWORK')
  const exentoCount = billable.filter((l) => l.tax_type === 'EXENTO').length
  const gravadoCount = billable.filter((l) => l.tax_type === 'GRAVADO_21').length
  const pricedCount = billable.filter((l) => l.unit_price_usd > 0).length

  let taxMode = normalizeOtAbcTaxType(tpl?.default_tax_type, true)
  if (billable.length > 0) {
    if (exentoCount > 0 && gravadoCount > 0) taxMode = 'MIXTO'
    else if (gravadoCount > 0) taxMode = 'GRAVADO_21'
    else taxMode = 'EXENTO'
  }

  return {
    taxMode,
    totalRows: lines.length,
    itemCount: billable.length,
    subworkCount: subworks.length,
    exentoCount,
    gravadoCount,
    pricedCount
  }
}

/**
 * Construye texto técnico operativo limpio para usuarios de carga de datos.
 * NUNCA incluye precios unitarios, condición frente al IVA ni origen de facturación.
 */
export function buildOperationalDescriptionFromLines(lineItems = [], fixedNotes = '') {
  const lines = normalizeOtAbcLineItems(lineItems)
  const parts = []

  for (const row of lines) {
    if (row.row_type === 'SUBWORK') {
      const title = row.subwork_title ? `${row.subwork_title}: ` : ''
      if (row.concept || title) parts.push(`${title}${row.concept}`.trim())
    } else if (row.row_type === 'ITEM' && row.concept) {
      parts.push(`• ${row.concept}`)
    }
  }

  const cleanNotes = String(fixedNotes || '').trim()
  if (parts.length === 0 && cleanNotes) return cleanNotes
  return parts.join('\n')
}

/**
 * Extrae únicamente los sub-trabajos (ej. bloque amarillo de CARENADO DE CASCO)
 * con solo título + descripción técnica operativa para crear work_items independientes.
 */
export function extractOperationalSubworks(tpl) {
  const lines = normalizeOtAbcLineItems(tpl?.line_items)
  const subworks = lines.filter((l) => l.row_type === 'SUBWORK' && (l.subwork_title || l.concept))
  return subworks.map((sw) => ({
    title: sw.subwork_title || 'SUB-TRABAJO',
    description: sw.subwork_title
      ? (sw.concept ? `${sw.subwork_title}: ${sw.concept}` : sw.subwork_title)
      : sw.concept
  }))
}

/**
 * Proyección segura del Catálogo OT.ABC hacia la creación operativa de OTs (`/ots`).
 * Garantiza que precios, IVA y origen comercial queden clasificados y jamás viajen a la OT operativa.
 */
export function buildOperationalSelectionFromTemplate(tpl, status = 'En ejecución') {
  const upperName = String(tpl?.name || '').trim().toUpperCase()
  const subworks = extractOperationalSubworks(tpl)
  const cleanDescription =
    String(tpl?.description || '').trim() ||
    buildOperationalDescriptionFromLines(tpl?.line_items, tpl?.fixed_notes)

  return {
    template_id: tpl?.id || null,
    ot_title: upperName,
    description: cleanDescription,
    subworks,
    status: status || 'En ejecución'
  }
}

/**
 * Genera el array de payloads de `work_items` para una OT tabulada (1 ítem normal o N sub-trabajos
 * como los 4 sub-trabajos amarillos de CARENADO DE CASCO). Solo usa descripciones técnicas.
 */
export function buildWorkItemPayloadsFromTemplateSelection({
  templateSelection,
  workOrderId,
  workForm,
  normalizedBudget,
  mergedComments = null,
  validFor3ros = false,
  nowIso = new Date().toISOString()
}) {
  const baseFields = {
    work_order_id: workOrderId,
    status: templateSelection?.status || workForm?.status || 'En ejecución',
    foreman_name: workForm?.foreman_name,
    work_type: workForm?.work_type,
    assignment_type: workForm?.assignment_type,
    specific_budget_id: normalizedBudget,
    contractors: workForm?.contractors || [],
    contractor_name: (workForm?.contractors || []).join(', ') || null,
    comments: mergedComments,
    send_to_third_party_prc: Boolean(validFor3ros),
    updated_at: nowIso
  }

  const subworks = Array.isArray(templateSelection?.subworks) ? templateSelection.subworks : []
  if (subworks.length > 0) {
    return subworks.map((sw) => ({
      ...baseFields,
      description: String(sw?.description || sw?.title || '').trim()
    }))
  }

  return [
    {
      ...baseFields,
      description: String(templateSelection?.description ?? workForm?.description ?? '').trim()
    }
  ]
}

