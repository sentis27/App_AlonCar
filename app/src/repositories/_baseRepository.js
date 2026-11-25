/**
 * _baseRepository.js
 * Capa base de acceso a datos para AlonCar ERP (patrón SKL-011 + FL-025).
 *
 * Garantías:
 * 1. Contrato uniforme `{ data, error, count? }` en todas las operaciones (cero errores silenciosos — SKL-015).
 * 2. Lectura sin techo de 1.000 filas vía `findAllBatched()` con filtro opcional `dateRange` (FL-025).
 * 3. Normalización de errores de Supabase / PostgreSQL (`23505`, `23503`, RLS, red) a mensajes claros.
 * 4. Validación Zod completa en altas/upserts, validación parcial en PATCH y bloqueo de eventos DOM.
 */
import { supabase as defaultClient } from '../lib/supabase.js'
import {
  handleSupabaseError,
  paginate,
  applyQueryFilters,
  hasAnyFilter,
  validateOne,
  dbErrorResult,
  mergeDateRangeFilters,
  executeBatchedQuery,
} from './_baseRepositoryHelpers.js'

export { handleSupabaseError, paginate }

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
      dateRange = null,
      page,
      pageSize,
      maxPageSize,
      limit,
      head = false,
    } = {}) {
      const mergedDates = mergeDateRangeFilters({ gteFilters, lteFilters, dateRange })
      const selectOpts = head ? { count: 'exact', head: true } : { count: 'exact' }
      let query = applyQueryFilters(client.from(table).select(select, selectOpts), {
        filters, inFilters, neqFilters, ...mergedDates, ilikeFilters, isNull, orFilter,
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

    async findAllBatched({
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
      dateRange = null,
      batchSize,
      maxRows,
    } = {}) {
      return executeBatchedQuery({
        table,
        primaryKey,
        client,
        select,
        orderBy,
        filterOpts: { filters, inFilters, neqFilters, gteFilters, lteFilters, ilikeFilters, isNull, orFilter },
        dateRange,
        batchSize,
        maxRows,
      })
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
