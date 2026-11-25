/**
 * _baseRepositoryHelpers.js
 * Utilidades compartidas de consulta, validación, normalización de errores y lectura
 * por bloques (`executeBatchedQuery`) para `_baseRepository.js` (FL-025).
 */
import { findInvalidEventField, validatePayload, validatePartialPayload } from '../schemas/index.js'

export const PG_ERROR_CODE_LABELS = {
  23505: 'Registro duplicado (conflicto de clave única)',
  23503: 'Operación bloqueada por integridad referencial (tiene registros asociados)',
  23502: 'Falta un campo obligatorio en la base de datos',
  42501: 'Permiso denegado por política de seguridad (RLS)',
}

export const DEFAULT_BATCH_SIZE = 1000
export const DEFAULT_MAX_BATCH_ROWS = 50000

export function handleSupabaseError(error) {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (typeof error === 'object') {
    const code = error.code ? String(error.code) : ''
    const baseMsg = error.message || error.details || error.hint || 'Error desconocido de base de datos'
    const prefix = PG_ERROR_CODE_LABELS[code]
    return prefix && !baseMsg.includes(prefix) ? `${prefix}: ${baseMsg}` : baseMsg
  }
  return 'Error desconocido'
}

export function paginate(params = {}) {
  const maxPageSize = Math.max(1, Number(params.maxPageSize) || 500)
  const page = Math.max(1, Number(params.page) || 1)
  const pageSize = Math.min(maxPageSize, Math.max(1, Number(params.pageSize) || 50))
  const from = (page - 1) * pageSize
  return { page, pageSize, from, to: from + pageSize - 1, limit: pageSize }
}

export function applyQueryFilters(query, {
  filters = {}, inFilters = {}, neqFilters = {}, gteFilters = {}, lteFilters = {}, ilikeFilters = {}, isNull = [], orFilter = '',
} = {}) {
  for (const [col, val] of Object.entries(filters)) {
    if (val !== undefined && val !== null && val !== '' && val !== 'ALL') query = query.eq(col, val)
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
  if (orFilter) query = query.or(orFilter)
  return query
}

export function hasAnyFilter(opts = {}) {
  const hasScalar = (obj) => Object.values(obj || {}).some((v) => v !== undefined && v !== null && v !== '' && v !== 'ALL')
  const hasArray = (obj) => Object.values(obj || {}).some((v) => Array.isArray(v) && v.length > 0)
  return (
    hasScalar(opts.filters) ||
    hasScalar(opts.neqFilters) ||
    hasArray(opts.inFilters) ||
    (opts.isNull?.length || 0) > 0 ||
    Boolean(opts.orFilter)
  )
}

export function validateOne(schema, payload, { validate, partial = false } = {}) {
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

export function dbErrorResult(error, fallbackData = null) {
  return {
    data: fallbackData,
    error: handleSupabaseError(error),
    code: error?.code ? String(error.code) : undefined,
  }
}

export function mergeDateRangeFilters({ gteFilters = {}, lteFilters = {}, dateRange = null } = {}) {
  if (!dateRange || !dateRange.column) return { gteFilters, lteFilters }
  const nextGte = { ...gteFilters }
  const nextLte = { ...lteFilters }
  if (dateRange.from !== undefined && dateRange.from !== null && dateRange.from !== '') {
    nextGte[dateRange.column] = dateRange.from
  }
  if (dateRange.to !== undefined && dateRange.to !== null && dateRange.to !== '') {
    nextLte[dateRange.column] = dateRange.to
  }
  return { gteFilters: nextGte, lteFilters: nextLte }
}

export function ensureDeterministicOrderBy(orderBy = [], primaryKey = 'id') {
  const list = Array.isArray(orderBy) ? orderBy.filter((o) => o && o.column) : []
  if (!primaryKey || list.some((o) => o.column === primaryKey)) return list
  return [...list, { column: primaryKey, ascending: true }]
}

/**
 * Lee todos los registros en bloques `.range(from, to)` rompiendo el tope de 1.000 filas
 * de Supabase/PostgREST con desempate determinístico por PK y deduplicación defensiva.
 */
export async function executeBatchedQuery({
  table,
  primaryKey = 'id',
  client,
  select = '*',
  orderBy = [],
  filterOpts = {},
  dateRange = null,
  batchSize = DEFAULT_BATCH_SIZE,
  maxRows = DEFAULT_MAX_BATCH_ROWS,
}) {
  const safeBatchSize = Math.max(1, Math.min(DEFAULT_BATCH_SIZE, Number(batchSize) || DEFAULT_BATCH_SIZE))
  const safeMaxRows = Math.max(safeBatchSize, Number(maxRows) || DEFAULT_MAX_BATCH_ROWS)
  const effectiveFilters = {
    ...filterOpts,
    ...mergeDateRangeFilters({ gteFilters: filterOpts.gteFilters, lteFilters: filterOpts.lteFilters, dateRange }),
  }
  const effectiveOrder = ensureDeterministicOrderBy(orderBy, primaryKey)

  const all = []
  const seenKeys = primaryKey ? new Set() : null
  let totalCount = null
  let from = 0

  while (all.length < safeMaxRows) {
    const step = Math.min(safeBatchSize, safeMaxRows - all.length)
    const baseQuery = from === 0
      ? client.from(table).select(select, { count: 'exact' })
      : client.from(table).select(select)
    let query = applyQueryFilters(baseQuery, effectiveFilters)
    for (const ord of effectiveOrder) {
      query = query.order(ord.column, { ascending: ord.ascending !== false })
    }
    const { data, error, count } = await query.range(from, from + step - 1)
    if (error) return { ...dbErrorResult(error, []), count: 0, truncated: false }

    if (from === 0 && typeof count === 'number') totalCount = count
    const chunk = Array.isArray(data) ? data : []

    for (const row of chunk) {
      const rowKey = seenKeys && row?.[primaryKey] != null ? String(row[primaryKey]) : null
      if (rowKey !== null) {
        if (seenKeys.has(rowKey)) continue
        seenKeys.add(rowKey)
      }
      all.push(row)
    }

    if (chunk.length < step || (totalCount !== null && all.length >= totalCount)) break
    from += step
  }

  return {
    data: all,
    error: null,
    count: totalCount ?? all.length,
    truncated: totalCount !== null ? all.length < totalCount : all.length >= safeMaxRows,
  }
}
