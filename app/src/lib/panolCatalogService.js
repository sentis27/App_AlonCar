/**
 * panolCatalogService.js
 * Servicio modular para Catálogo Maestro de Materiales, B.D. Rubros (1:N),
 * carga de imágenes y sincronización de unidades con Compras.
 * Cumple SKL-009, SKL-014, SKL-015 (repositorios + auditoría + cero fallas silenciosas).
 */
import { logCellChange, logRowAction } from './auditService.js'
import { normalizeText } from './allocationEngine.js'
import { normalizeUnitMeasure, computeMaterialCostUsd } from './unitMeasureUtils.js'
import { getDollarRateForDate } from './comprasPedidosHelpers.js'
import { MATERIAL_CATEGORIES } from './panolConstants.js'
import { materialsRepository, materialRubrosRepository } from '../repositories/materialsRepository.js'
import { macroVariablesRepository } from '../repositories/macroVariablesRepository.js'
import { rateCardsRepository } from '../repositories/rateCardsRepository.js'
import { purchaseDocumentsRepository, purchaseOrdersRepository } from '../repositories/purchaseOrdersRepository.js'

const OPEN_PO_STATUSES = ['PEDIR', 'COTIZAR', 'COTIZA.SOLICITUD', 'COTIZACION', 'COTIZA.APROBADA', 'SE COMPRA?']

export async function fetchActiveDollarRateService() {
  const todayStr = new Date().toISOString().split('T')[0]
  try {
    const { data: mvList } = await macroVariablesRepository.listMacroVariables()
    if (Array.isArray(mvList) && mvList.length > 0) {
      const rate = getDollarRateForDate(todayStr, mvList)
      if (rate > 0) return rate
    }
    const { data: rcList } = await rateCardsRepository.findAll({
      select: 'dollar_rate',
      orderBy: [{ column: 'year', ascending: false }, { column: 'month', ascending: false }],
      limit: 1
    })
    const rcRate = Number(rcList?.[0]?.dollar_rate)
    if (Number.isFinite(rcRate) && rcRate > 0) return rcRate
  } catch {
    // fallback seguro
  }
  return 1500
}

export function isPanolAdminRole(profile) {
  const role = String(profile?.role || '').trim().toLowerCase()
  return ['admin', 'administrador', 'gerencia', 'supervisor'].includes(role)
}

export function buildMergedRubrosCatalog(rubros = [], materials = []) {
  const countMap = new Map()
  for (const m of materials) {
    const key = String(m?.rubro || '').trim().toUpperCase()
    if (key) countMap.set(key, (countMap.get(key) || 0) + 1)
  }
  const byKey = new Map()
  for (const r of rubros) {
    const name = String(r?.name || '').trim().toUpperCase()
    if (!name) continue
    byKey.set(name, {
      id: r.id,
      name,
      category: r.category || 'MATERIALES',
      is_active: r.is_active !== false,
      inDb: true,
      materialsCount: countMap.get(name) || 0
    })
  }
  for (const [matRubro, count] of countMap.entries()) {
    if (!byKey.has(matRubro)) {
      byKey.set(matRubro, { id: null, name: matRubro, category: 'MATERIALES', is_active: true, inDb: false, materialsCount: count })
    }
  }
  return Array.from(byKey.values()).sort((a, b) => a.name.localeCompare(b.name, 'es'))
}

export async function uploadMaterialImageService({ materialName, imageFile }) {
  if (!imageFile) return null
  const ext = String(imageFile.name || 'jpg').split('.').pop() || 'jpg'
  const safeName = String(materialName || 'material').trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
  const storagePath = `catalogo_materiales/${Date.now()}_${safeName}.${ext}`
  const { data, error } = await purchaseDocumentsRepository.uploadToStorage(storagePath, imageFile)
  if (error) throw new Error(error)
  return data?.publicUrl || null
}

async function syncOpenPurchaseOrdersUnit(materialId, unitMeasure) {
  if (!materialId || !unitMeasure) return
  await purchaseOrdersRepository.updateWhere(
    { filters: { material_id: materialId }, inFilters: { status: OPEN_PO_STATUSES } },
    { unit_measure: unitMeasure, updated_at: new Date().toISOString() },
    { select: null }
  )
}

export async function saveInlineCatalogFieldService({ matId, field, value, materials = [], isAdmin, user }) {
  const mat = materials.find((m) => m.id === matId)
  if (!mat) throw new Error('Material no encontrado en el catálogo.')
  if (!isAdmin && field !== 'current_stock' && field !== 'image_url') {
    throw new Error('Solo el Administrador puede modificar la configuración del Catálogo de Materiales.')
  }

  let parsedValue = value
  if (['weight_kg', 'current_stock', 'minimum_stock', 'security_factor'].includes(field)) {
    const num = Number(value)
    if (!Number.isFinite(num) || (field !== 'current_stock' && num < 0)) {
      throw new Error('Ingresá un valor numérico válido mayor o igual a 0.')
    }
    parsedValue = num
  } else if (field === 'requires_stock_control') {
    parsedValue = Boolean(value)
  } else if (field === 'name' || field === 'rubro') {
    const clean = String(value || '').trim().toUpperCase()
    if (!clean) throw new Error(field === 'name' ? 'El nombre técnico es obligatorio.' : 'El rubro no puede quedar vacío.')
    parsedValue = clean
  } else if (field === 'category') {
    if (!MATERIAL_CATEGORIES.includes(value)) throw new Error('Categoría inválida.')
  } else if (field === 'unit_measure') {
    parsedValue = normalizeUnitMeasure(value, mat.name)
  }

  const updates = { [field]: parsedValue }
  const { error } = await materialsRepository.updateById(matId, updates, { select: null })
  if (error) throw new Error(error)
  if (field === 'unit_measure') await syncOpenPurchaseOrdersUnit(matId, parsedValue)

  logCellChange({
    entityType: 'materials', entityId: matId, entityName: mat.name || matId,
    field, fieldLabel: field, oldValue: mat[field] ?? null, newValue: parsedValue,
    sheetName: 'Pañol · Catálogo Maestro', moduleRoute: '/panol', changeOrigin: 'INLINE_CELL', user: user?.email
  })
  return updates
}

export async function updateCatalogMaterialService({ material, formData, imageFile = null, existingMaterials = [], isAdmin, user }) {
  if (!material?.id) throw new Error('Material inválido para edición.')
  const uploadedUrl = imageFile ? await uploadMaterialImageService({ materialName: formData?.name || material.name, imageFile }) : null

  if (!isAdmin) {
    if (!uploadedUrl) throw new Error('Solo el Administrador puede modificar datos del catálogo. Como Pañolero podés cargar o actualizar la foto.')
    const { data, error } = await materialsRepository.updateById(material.id, { image_url: uploadedUrl }, { select: '*' })
    if (error) throw new Error(error)
    logCellChange({
      entityType: 'materials', entityId: material.id, entityName: material.name,
      field: 'image_url', fieldLabel: 'Imagen del Material', oldValue: material.image_url || null, newValue: uploadedUrl,
      sheetName: 'Pañol · Catálogo Maestro', moduleRoute: '/panol', changeOrigin: 'MODAL_EDIT_MATERIAL', user: user?.email
    })
    return data || { ...material, image_url: uploadedUrl }
  }

  const cleanName = String(formData?.name || '').trim().toUpperCase()
  if (!cleanName) throw new Error('El nombre técnico oficial del material es obligatorio.')
  const duplicate = existingMaterials.find((m) => m.id !== material.id && normalizeText(m.name) === normalizeText(cleanName))
  if (duplicate) throw new Error(`Ya existe otro material con el nombre "${duplicate.name}".`)

  const normalizedUnit = normalizeUnitMeasure(formData?.unit_measure, cleanName)
  const costArs = Math.max(0, Number(formData?.cost_ars) || 0)
  const secFactor = Number(formData?.security_factor) || 1.06
  const dollarRate = Number(formData?.dollar_rate) > 0 ? Number(formData.dollar_rate) : 1500
  const costUsd = formData?.cost_usd != null ? Math.max(0, Number(formData.cost_usd) || 0) : computeMaterialCostUsd(costArs, secFactor, dollarRate)
  const priceChanged = Number(material.cost_ars || 0) !== costArs || Number(material.security_factor || 1.06) !== secFactor
  const updates = {
    name: cleanName,
    rubro: String(formData?.rubro || '').trim().toUpperCase() || 'VARIOS Y GENERAL',
    rubro_status: 'APROBADO',
    category: MATERIAL_CATEGORIES.includes(formData?.category) ? formData.category : 'MATERIALES',
    unit_measure: normalizedUnit,
    weight_kg: Math.max(0, Number(formData?.weight_kg) || 0),
    cost_ars: costArs,
    cost_usd: costUsd,
    minimum_stock: Math.max(0, Number(formData?.minimum_stock) || 0),
    requires_stock_control: Boolean(formData?.requires_stock_control),
    security_factor: secFactor,
    ...(priceChanged ? { last_price_update: new Date().toISOString() } : {}),
    ...(uploadedUrl ? { image_url: uploadedUrl } : {})
  }

  const { data, error } = await materialsRepository.updateById(material.id, updates, { select: '*' })
  if (error) throw new Error(error)
  if (normalizeUnitMeasure(material.unit_measure, material.name) !== normalizedUnit) {
    await syncOpenPurchaseOrdersUnit(material.id, normalizedUnit)
  }

  logRowAction({
    action: 'UPDATE', entityType: 'materials', entityId: material.id, entityName: cleanName,
    rowData: updates, sheetName: 'Pañol · Catálogo Maestro', moduleRoute: '/panol', changeOrigin: 'MODAL_EDIT_MATERIAL', user: user?.email
  })
  return data || { ...material, ...updates }
}

export async function createMaterialRubroService({ name, category = 'MATERIALES', existingRubros = [], isAdmin, user }) {
  if (!isAdmin) throw new Error('Solo el Administrador puede crear rubros de materiales.')
  const cleanName = String(name || '').trim().toUpperCase()
  if (!cleanName) throw new Error('Ingresá el nombre del rubro.')
  if (existingRubros.some((r) => normalizeText(r.name) === normalizeText(cleanName))) {
    throw new Error(`El rubro "${cleanName}" ya existe en la base de datos.`)
  }
  const payload = { name: cleanName, category: MATERIAL_CATEGORIES.includes(category) ? category : 'MATERIALES', is_active: true }
  const { data, error } = await materialRubrosRepository.insertOne(payload)
  if (error) throw new Error(error)
  logRowAction({
    action: 'ROW_INSERT', entityType: 'material_rubros', entityId: data.id, entityName: cleanName,
    rowData: data, sheetName: 'Pañol · B.D. Rubros (1:N)', moduleRoute: '/panol', changeOrigin: 'MODAL_RUBROS_DB', user: user?.email
  })
  return data
}

export async function renameMaterialRubroService({ rubroItem, newName, category, existingRubros = [], isAdmin, user }) {
  if (!isAdmin) throw new Error('Solo el Administrador puede editar rubros de materiales.')
  const oldName = String(rubroItem?.name || '').trim().toUpperCase()
  const cleanNew = String(newName || '').trim().toUpperCase()
  if (!cleanNew) throw new Error('El nombre del rubro es obligatorio.')
  const conflict = existingRubros.find((r) => r.name !== oldName && normalizeText(r.name) === normalizeText(cleanNew))
  if (conflict) throw new Error(`Ya existe otro rubro llamado "${conflict.name}".`)

  const validCategory = MATERIAL_CATEGORIES.includes(category) ? category : (rubroItem?.category || 'MATERIALES')
  const { data: savedRubro, error } = rubroItem?.id
    ? await materialRubrosRepository.updateById(rubroItem.id, { name: cleanNew, category: validCategory })
    : await materialRubrosRepository.insertOne({ name: cleanNew, category: validCategory, is_active: true })
  if (error) throw new Error(error)

  if (oldName && oldName !== cleanNew) {
    const { error: cascadeErr } = await materialsRepository.updateWhere({ filters: { rubro: oldName } }, { rubro: cleanNew }, { select: null })
    if (cascadeErr) {
      if (rubroItem?.id) await materialRubrosRepository.updateById(rubroItem.id, { name: oldName }, { select: null })
      throw new Error(`No se pudieron actualizar los materiales vinculados al rubro: ${cascadeErr}`)
    }
  }
  logRowAction({
    action: 'UPDATE', entityType: 'material_rubros', entityId: savedRubro.id, entityName: `${oldName} ➔ ${cleanNew}`,
    rowData: { oldName, newName: cleanNew, category: validCategory }, sheetName: 'Pañol · B.D. Rubros (1:N)',
    moduleRoute: '/panol', changeOrigin: 'MODAL_RUBROS_DB', user: user?.email
  })
  return { savedRubro, oldName, newName: cleanNew }
}

export async function deleteMaterialRubroService({ rubroItem, isAdmin, user }) {
  if (!isAdmin) throw new Error('Solo el Administrador puede eliminar rubros.')
  if (!rubroItem?.id) throw new Error('Este rubro proviene de materiales existentes; renombralo o reasigná sus materiales primero.')
  if ((rubroItem.materialsCount || 0) > 0) {
    throw new Error(`No se puede eliminar "${rubroItem.name}" porque tiene ${rubroItem.materialsCount} material(es) asignado(s).`)
  }
  const { error } = await materialRubrosRepository.deleteById(rubroItem.id)
  if (error) throw new Error(error)
  logRowAction({
    action: 'ROW_DELETE', entityType: 'material_rubros', entityId: rubroItem.id, entityName: rubroItem.name,
    rowData: rubroItem, sheetName: 'Pañol · B.D. Rubros (1:N)', moduleRoute: '/panol', changeOrigin: 'MODAL_RUBROS_DB', user: user?.email
  })
  return rubroItem.id
}
