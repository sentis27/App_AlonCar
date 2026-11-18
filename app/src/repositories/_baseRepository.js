/**
 * _baseRepository.js
 * Capa base de acceso a datos para AlonCar ERP (patrón adoptado de Automatiza `_base-repository.ts` + SKL-011).
 *
 * Garantías:
 * 1. Contrato uniforme `{ data, error, count? }` en todas las operaciones (cero errores silenciosos — SKL-015).
 * 2. Normalización de errores de Supabase / PostgreSQL (`23505`, `23503`, RLS, red) a mensajes claros.
 * 3. Paginación acotada (`paginate`), validación Zod completa en altas/upserts y validación parcial en PATCH.
 * 4. Bloqueo defensivo contra inyección de eventos DOM / `[object Object]` en cualquier mutación (SKL-015).
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import { findInvalidEventField, validatePayload, validatePartialPayload } from '../schemas/index.js'

const PG_ERROR_CODE_LABELS = {
  23505: 'Registro duplicado (conflicto de clave única)',
  23503: 'Operación bloqueada por integridad referencial (tiene registros asociados)',
  23502: 'Falta un campo obligatorio en la base de datos',
  42501: 'Permiso denegado por política de seguridad (RLS)',
}

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

export function paginate(params = {}) {
  const maxPageSize = Math.max(1, Number(params.maxPageSize) || 500)
  const page = Math.max(1, Number(params.page) || 1)
  const rawSize = Number(params.pageSize) || 50
  const pageSize = Math.min(maxPageSize, Math.max(1, rawSize))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  return { page, pageSize, from, to, limit: pageSize }
}

function applyQueryFilters(query, {
  filters = {},
  inFilters = {},
  neqFilters = {},
  gteFilters = {},
  lteFilters = {},
  ilikeFilters = {},
  isNull = [],
  orFilter = '',
} = {}) {
  for (const [col, val] of Object.entries(filters)) {
    if (val !== undefined && val !== null && val !== '' && val !== 'ALL') {
      query = query.eq(col, val)
    }
  }
  for (const [col, arr] of Object.entries(inFilters)) {
    if (Array.isArray(arr) && arr.length > 0) query = query.in(col, arr)
  }
  for (const [col, val] of Object.entries(neqFilters)) {
    if (val !== undefined) query = query.neq(col, val)
  }
  for (const [col, val] of Object.entries(gteFilters)) {
    if (val !== undefined && val !== null && val !== '') query = query.gte(col, val)
  }
  for (const [col, val] of Object.entries(lteFilters)) {
    if (val !== undefined && val !== null && val !== '') query = query.lte(col, val)
  }
  for (const [col, val] of Object.entries(ilikeFilters)) {
    if (val !== undefined && val !== null && val !== '') query = query.ilike(col, val)
  }
  for (const col of isNull) {
    if (col) query = query.is(col, null)
  }
  if (orFilter) {
    query = query.or(orFilter)
  }
  return query
}

function hasAnyFilter(opts = {}) {
  const hasScalar = (obj) => Object.values(obj || {}).some((v) => v !== undefined && v !== null && v !== '' && v !== 'ALL')
  const hasArray = (obj) => Object.values(obj || {}).some((v) => Array.isArray(v) && v.length > 0)
  return hasScalar(opts.filters) || hasScalar(opts.neqFilters) || hasArray(opts.inFilters) || (opts.isNull?.length || 0) > 0 || Boolean(opts.orFilter)
}

function validateOne(schema, payload, { validate, partial = false } = {}) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return { data: null, error: 'Payload requerido para guardar' }
  }
  if (validate && schema) {
    const res = partial ? validatePartialPayload(schema, payload) : validatePayload(schema, payload)
    if (!res.success) return { data: null, error: res.error, issues: res.issues }
    return { data: res.data, error: null }
  }
  const invalidField = findInvalidEventField(payload)
  if (invalidField) {
    return { data: null, error: `${invalidField}: Valor inválido bloqueado (Event / [object Object])` }
  }
  return { data: payload, error: null }
}

function dbErrorResult(error, fallbackData = null) {
  return {
    data: fallbackData,
    error: handleSupabaseError(error),
    code: error?.code ? String(error.code) : undefined,
  }
}

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

    async findAll({
      select = '*',
      orderBy = [],
      filters = {},
      inFilters = {},
      neqFilters = {},
      gteFilters = {},
      lteFilters = {},
      ilikeFilters = {},
      isNull = [],
      orFilter = '',
      page,
      pageSize,
      maxPageSize,
      limit,
      head = false,
    } = {}) {
      const selectOpts = head ? { count: 'exact', head: true } : { count: 'exact' }
      let query = applyQueryFilters(client.from(table).select(select, selectOpts), {
        filters, inFilters, neqFilters, gteFilters, lteFilters, ilikeFilters, isNull, orFilter,
      })

      for (const ord of orderBy) {
        if (ord && ord.column) query = query.order(ord.column, { ascending: ord.ascending !== false })
      }
      if (page !== undefined || pageSize !== undefined) {
        const { from, to } = paginate({ page, pageSize, maxPageSize })
        query = query.range(from, to)
      } else if (limit) {
        query = query.limit(limit)
      }

      const { data, error, count } = await query
      if (error) return { ...dbErrorResult(error, []), count: 0 }
      return { data: data || [], error: null, count: count ?? (data ? data.length : 0) }
    },

    async findById(id, { select = '*' } = {}) {
      if (!id) return { data: null, error: `ID (${primaryKey}) requerido` }
      const { data, error } = await client.from(table).select(select).eq(primaryKey, id).maybeSingle()
      if (error) return dbErrorResult(error, null)
      return { data: data || null, error: null }
    },

    async findOne({ select = '*', filters = {}, inFilters = {}, ilikeFilters = {}, isNull = [], orderBy = [] } = {}) {
      let query = applyQueryFilters(client.from(table).select(select), { filters, inFilters, ilikeFilters, isNull })
      for (const ord of orderBy) {
        if (ord && ord.column) query = query.order(ord.column, { ascending: ord.ascending !== false })
      }
      const { data, error } = await query.limit(1).maybeSingle()
      if (error) return dbErrorResult(error, null)
      return { data: data || null, error: null }
    },

    async insertOne(payload, { validate = true, select = '*' } = {}) {
      const checked = validateOne(schema, payload, { validate })
      if (checked.error) return checked
      let q = client.from(table).insert([checked.data])
      if (select) q = q.select(select)
      const { data, error } = await q
      if (error) return dbErrorResult(error, null)
      return { data: data?.[0] || checked.data, error: null }
    },

    async insertMany(payloads = [], { validate = true, select = '*' } = {}) {
      if (!Array.isArray(payloads) || payloads.length === 0) return { data: [], error: null, count: 0 }
      const validated = []
      for (const row of payloads) {
        const checked = validateOne(schema, row, { validate })
        if (checked.error) return { data: [], error: checked.error, issues: checked.issues, count: 0 }
        validated.push(checked.data)
      }
      let q = client.from(table).insert(validated)
      if (select) q = q.select(select)
      const { data, error } = await q
      if (error) return { ...dbErrorResult(error, []), count: 0 }
      return { data: data || validated, error: null, count: (data || validated).length }
    },

    async upsertOne(payload, { onConflict = primaryKey, validate = true } = {}) {
      const checked = validateOne(schema, payload, { validate })
      if (checked.error) return checked
      const { data, error } = await client.from(table).upsert([checked.data], { onConflict }).select()
      if (error) return dbErrorResult(error, null)
      return { data: data?.[0] || checked.data, error: null }
    },

    async upsertMany(payloads = [], { onConflict = primaryKey, validate = true, select = '*' } = {}) {
      if (!Array.isArray(payloads) || payloads.length === 0) return { data: [], error: null, count: 0 }
      const validated = []
      for (const row of payloads) {
        const checked = validateOne(schema, row, { validate })
        if (checked.error) return { data: [], error: checked.error, issues: checked.issues, count: 0 }
        validated.push(checked.data)
      }
      let q = client.from(table).upsert(validated, { onConflict })
      if (select) q = q.select(select)
      const { data, error } = await q
      if (error) return { ...dbErrorResult(error, []), count: 0 }
      return { data: data || validated, error: null, count: (data || validated).length }
    },

    async updateById(id, patch, { validate = true, select = '*' } = {}) {
      if (!id) return { data: null, error: `ID (${primaryKey}) requerido para actualizar` }
      const checked = validateOne(schema, patch, { validate, partial: true })
      if (checked.error) return checked
      let q = client.from(table).update(checked.data).eq(primaryKey, id)
      if (select) q = q.select(select)
      const { data, error } = await q
      if (error) return dbErrorResult(error, null)
      return { data: data?.[0] || checked.data, error: null }
    },

    async updateWhere(where = {}, patch, { validate = true, select = null } = {}) {
      if (!hasAnyFilter(where)) return { data: null, error: 'Se requiere al menos un filtro para actualización masiva' }
      const checked = validateOne(schema, patch, { validate, partial: true })
      if (checked.error) return checked
      let q = applyQueryFilters(client.from(table).update(checked.data), where)
      if (select) q = q.select(select)
      const { data, error } = await q
      if (error) return dbErrorResult(error, null)
      return { data: data || checked.data, error: null }
    },

    async deleteById(id) {
      if (!id) return { data: null, error: `ID (${primaryKey}) requerido para eliminar` }
      const { error } = await client.from(table).delete().eq(primaryKey, id)
      if (error) return dbErrorResult(error, null)
      return { data: { [primaryKey]: id, deleted: true }, error: null }
    },

    async deleteWhere(where = {}) {
      if (!hasAnyFilter(where)) return { data: null, error: 'Se requiere al menos un filtro para eliminar en lote' }
      const { error } = await applyQueryFilters(client.from(table).delete(), where)
      if (error) return dbErrorResult(error, null)
      return { data: { deleted: true }, error: null }
    },
  }
}
