/**
 * materialsRepository.js
 * Repositorios para `materials` y `material_rubros` sobre `_baseRepository.js`.
 * Usa `findAllBatched` por defecto para soportar catálogos > 1.000 materiales sin recorte (FL-025).
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { MaterialSchema, MaterialRubroSchema } from '../schemas/panol.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createMaterialsRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'materials',
    primaryKey: 'id',
    schema: MaterialSchema,
    client,
  })

  return {
    ...base,

    async listMaterials({ select = '*', orderBy = [{ column: 'name', ascending: true }], filters = {} } = {}) {
      return base.findAllBatched({ select, orderBy, filters })
    },

    async countMaterials() {
      return base.findAll({ select: 'id', head: true })
    },

    async findByNameIlike(name, { select = 'id, name' } = {}) {
      return base.findAll({ select, ilikeFilters: { name }, limit: 1 })
    },

    async updateStock(materialId, currentStock) {
      return base.updateById(materialId, { current_stock: currentStock }, { select: null })
    },

    async findStocksByIds(ids = []) {
      const cleanIds = Array.from(new Set((ids || []).filter(Boolean)))
      if (cleanIds.length === 0) return { data: [], error: null }
      return base.findAll({ select: 'id, current_stock', inFilters: { id: cleanIds } })
    },
  }
}

export function createMaterialRubrosRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'material_rubros',
    primaryKey: 'id',
    schema: MaterialRubroSchema,
    client,
  })

  return {
    ...base,

    async listRubros() {
      return base.findAllBatched({ orderBy: [{ column: 'name', ascending: true }] })
    },
  }
}

export const materialsRepository = createMaterialsRepository()
export const materialRubrosRepository = createMaterialRubrosRepository()
export default materialsRepository
