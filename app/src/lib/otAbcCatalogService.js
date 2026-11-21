/**
 * otAbcCatalogService.js
 * Capa de servicio y persistencia para el Catálogo de Trabajos (OT.ABC).
 * Cumple Candado #3 (Cero SQL en vistas), SKL-015 (Sanitización escalar) y auditoría en `audit_logs`.
 */

import { auditService, isInvalidEventOrObjectScalar } from './auditService.js'
import { otTemplatesRepository } from '../repositories/otTemplatesRepository.js'
import {
  buildBillingDescriptionFromLines,
  buildOperationalDescriptionFromLines,
  computeTemplateTaxSummary,
  normalizeOtAbcCategory,
  normalizeOtAbcDataSource,
  normalizeOtAbcLineItems,
} from './otAbcCatalogConstants.js'

const CATALOG_SHEET_NAME = 'Catálogo de Trabajos (OT.ABC)'

export async function fetchOtTemplatesCatalog() {
  const { data, error } = await otTemplatesRepository.listTemplates()
  if (error) throw new Error(error)
  return data || []
}

/**
 * Crea o actualiza una plantilla completa del Catálogo OT.ABC (nombre, agrupación, texto operativo,
 * notas fijas, renglones tabulados con valores US$, IVA y origen del dato).
 */
export async function saveOtTemplateCompleteService(templateEdit, totalTemplates = 0, user = null) {
  const rawName = templateEdit?.name
  if (isInvalidEventOrObjectScalar(rawName)) {
    throw new Error('Nombre inválido para plantilla OT.ABC.')
  }
  const cleanName = String(rawName || '').trim().toUpperCase()
  if (!cleanName) {
    throw new Error('Ingresá el nombre de la OT.ABC.')
  }

  const normalizedLines = normalizeOtAbcLineItems(templateEdit?.line_items)
  const cleanFixedNotes = String(templateEdit?.fixed_notes || '').trim() || null
  const manualDesc = String(templateEdit?.description || '').trim()
  const finalDesc = manualDesc || buildOperationalDescriptionFromLines(normalizedLines, cleanFixedNotes) || null
  const manualBillingDesc = String(templateEdit?.description_billing || '').trim()
  const finalBillingDesc = manualBillingDesc || buildBillingDescriptionFromLines(normalizedLines, cleanFixedNotes) || finalDesc || null

  const summary = computeTemplateTaxSummary({
    line_items: normalizedLines,
    default_tax_type: templateEdit?.default_tax_type,
  })

  const payload = {
    name: cleanName,
    category: normalizeOtAbcCategory(templateEdit?.category),
    description: finalDesc,
    description_billing: finalBillingDesc,
    fixed_notes: cleanFixedNotes,
    default_tax_type: summary.taxMode,
    default_data_source: normalizeOtAbcDataSource(templateEdit?.default_data_source),
    line_items: normalizedLines,
    updated_at: new Date().toISOString(),
  }

  const res = templateEdit?.id
    ? await otTemplatesRepository.updateById(templateEdit.id, payload, { select: '*' })
    : await otTemplatesRepository.insertOne({ ...payload, sort_order: (Number(totalTemplates) || 0) + 1 })

  if (res.error) throw new Error(res.error)
  const savedRow = res.data

  await auditService.logRowAction({
    action: templateEdit?.id ? 'MODAL_SAVE' : 'ROW_INSERT',
    entityType: 'ot_templates',
    entityId: savedRow?.id || templateEdit?.id || cleanName,
    entityName: `OT.ABC · ${cleanName}`,
    changes: {
      category: payload.category,
      default_tax_type: payload.default_tax_type,
      default_data_source: payload.default_data_source,
      line_items_count: normalizedLines.length,
    },
    sheetName: CATALOG_SHEET_NAME,
    moduleRoute: '/ots',
    user,
  })

  return savedRow
}

/**
 * Actualiza únicamente la agrupación manual (`Renovación` | `Intermedia` | `Ambas` | null)
 * desde el desplegable directo de cada fila del catálogo con registro en `audit_logs`.
 */
export async function updateOtTemplateCategoryService(tpl, nextCategoryRaw, user = null) {
  if (!tpl?.id) throw new Error('Plantilla OT.ABC inválida.')
  if (isInvalidEventOrObjectScalar(nextCategoryRaw)) {
    throw new Error('Clasificación inválida.')
  }

  const nextCategory = normalizeOtAbcCategory(nextCategoryRaw)
  const prevCategory = normalizeOtAbcCategory(tpl.category)
  if (nextCategory === prevCategory) return tpl

  const { data, error } = await otTemplatesRepository.updateById(
    tpl.id,
    { category: nextCategory, updated_at: new Date().toISOString() },
    { select: '*' }
  )
  if (error) throw new Error(error)

  await auditService.logCellChange({
    entityType: 'ot_templates',
    entityId: tpl.id,
    entityName: `OT.ABC · ${tpl.name}`,
    field: 'category',
    fieldLabel: 'Clasificación (Renovación / Intermedia)',
    oldValue: prevCategory || 'Sin clasificar',
    newValue: nextCategory || 'Sin clasificar',
    sheetName: CATALOG_SHEET_NAME,
    moduleRoute: '/ots',
    user,
  })

  return data
}

/**
 * Elimina una plantilla del Catálogo OT.ABC con auditoría obligatoria.
 */
export async function deleteOtTemplateService(tplId, tplName, user = null) {
  if (!tplId) throw new Error('ID de plantilla requerido.')
  const { error } = await otTemplatesRepository.deleteById(tplId)
  if (error) throw new Error(error)

  await auditService.logRowAction({
    action: 'ROW_DELETE',
    entityType: 'ot_templates',
    entityId: tplId,
    entityName: `OT.ABC Eliminada · ${tplName || tplId}`,
    changes: { deleted: tplName || tplId },
    sheetName: CATALOG_SHEET_NAME,
    moduleRoute: '/ots',
    user,
  })
}
