/**
 * _baseRepository.js
 * Capa base de acceso a datos para AlonCar ERP (patrón adoptado de Automatiza `_base-repository.ts` + SKL-011).
 *
 * Garantías:
 * 1. Contrato uniforme `{ data, error, count? }` en todas las operaciones (cero errores silenciosos — SKL-015).
 * 2. Normalización de errores de Supabase / PostgreSQL (`23505`, `23503`, RLS, red) a mensajes claros.
 * 3. Paginación acotada (`paginate`) y validación opcional de esquema Zod en frontera antes de mutar.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { validatePayload } from '../schemas/index.js'

const PG_ERROR_CODE_LABELS = {
  23505: 'Registro duplicado (conflicto de clave única)',
  23503: 'Operación bloqueada por integridad referencial (tiene registros asociados)',
  23502: 'Falta un campo obligatorio en la base de datos',
  42501: 'Permiso denegado por política de seguridad (RLS)',
}

/**
 * Normaliza cualquier error de Supabase/PostgREST o excepción JS a un string legible y seguro.
 */
export function handleSupabaseError(error) {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (typeof error === 'object') {
    const code = error.code ? String(error.code) : ''
    const baseMsg = error.message || error.details || error.hint || 'Error desconocido de base de datos'
    const friendlyPrefix = PG_ERROR_CODE_LABELS[code]
    if (friendlyPrefix && !baseMsg.includes(friendlyPrefix)) {
      return `${friendlyPrefix}: ${baseMsg}`
    }
    return baseMsg
  }
  return 'Error desconocido'
}

/**
 * Calcula rango `from..to` (0-based inclusivo para PostgREST `.range(from, to)`) a partir de `page` (1-based).
 */
export function paginate(params = {}) {
  const maxPageSize = Math.max(1, Number(params.maxPageSize) || 500)
  const page = Math.max(1, Number(params.page) || 1)
  const rawSize = Number(params.pageSize) || 50
  const pageSize = Math.min(maxPageSize, Math.max(1, rawSize))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  return { page, pageSize, from, to, limit: pageSize }
}

/**
 * Fábrica de repositorio tipado por tabla con validación Zod opcional.
 */
export function createBaseRepository({
  table,
  primaryKey = 'id',
  schema = null,
  client = defaultClient,
} = {}) {
  if (!table) throw new Error('[_baseRepository] El nombre de tabla es obligatorio')

  return {
    table,
    primaryKey,
    schema,

    async findAll({ select = '*', orderBy = [], filters = {}, page, pageSize, maxPageSize } = {}) {
      let query = client.from(table).select(select, { count: 'exact' })

      for (const [col, val] of Object.entries(filters)) {
        if (val !== undefined && val !== null && val !== '' && val !== 'ALL') {
          query = query.eq(col, val)
        }
      }

      for (const ord of orderBy) {
        if (ord && ord.column) {
          query = query.order(ord.column, { ascending: ord.ascending !== false })
        }
      }

      if (page !== undefined || pageSize !== undefined) {
        const { from, to } = paginate({ page, pageSize, maxPageSize })
        query = query.range(from, to)
      }

      const { data, error, count } = await query
      if (error) {
        return { data: [], error: handleSupabaseError(error), count: 0 }
      }
      return { data: data || [], error: null, count: count ?? (data ? data.length : 0) }
    },

    async findById(id, { select = '*' } = {}) {
      if (!id) return { data: null, error: `ID (${primaryKey}) requerido` }
      const { data, error } = await client
        .from(table)
        .select(select)
        .eq(primaryKey, id)
        .maybeSingle()

      if (error) return { data: null, error: handleSupabaseError(error) }
      return { data: data || null, error: null }
    },

    async upsertOne(payload, { onConflict = primaryKey, validate = true } = {}) {
      if (!payload || typeof payload !== 'object') {
        return { data: null, error: 'Payload requerido para guardar' }
      }

      let recordToSave = payload
      if (validate && schema) {
        const validation = validatePayload(schema, payload)
        if (!validation.success) {
          return { data: null, error: validation.error, issues: validation.issues }
        }
        recordToSave = validation.data
      }

      const { data, error } = await client
        .from(table)
        .upsert([recordToSave], { onConflict })
        .select()

      if (error) return { data: null, error: handleSupabaseError(error) }
      return { data: data?.[0] || recordToSave, error: null }
    },

    async deleteById(id) {
      if (!id) return { data: null, error: `ID (${primaryKey}) requerido para eliminar` }
      const { error } = await client.from(table).delete().eq(primaryKey, id)
      if (error) return { data: null, error: handleSupabaseError(error) }
      return { data: { [primaryKey]: id, deleted: true }, error: null }
    },
  }
}
