/**
 * suppliersRepository.js
 * Repositorio para `suppliers` (Padrón Maestro de Proveedores) sobre `_baseRepository.js`.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { SupplierSchema } from '../schemas/purchases.schema.js'
import { createBaseRepository } from './_baseRepository.js'

export function createSuppliersRepository({ client = defaultClient } = {}) {
  const base = createBaseRepository({
    table: 'suppliers',
    primaryKey: 'id',
    schema: SupplierSchema,
    client,
  })

  return {
    ...base,

    async listSuppliers({ select = '*', orderBy = [{ column: 'name', ascending: true }], filters = {} } = {}) {
      return base.findAll({ select, orderBy, filters })
    },
  }
}

export const suppliersRepository = createSuppliersRepository()
export default suppliersRepository
