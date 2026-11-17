/**
 * workerIdentity.js
 * Fuente única en frontend para resolver IDs relacionales (workers / materials)
 * sin adivinar homónimos y respetando siempre IDs explícitos.
 */

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export const WORKER_NAME_ALIASES = Object.freeze({
  aldo: 'aldo (carpintero)',
  'alon car': 'alon car sa',
  'teco taller naval': 'teco taller',
  hugo: 'hugo obregozo',
  'luis m': 'luis maria errecaborde'
})

export function normalizeEntityName(value) {
  return String(value || '').trim().toLowerCase()
}

export function isValidUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value.trim())
}

function resolveUniqueCatalogId({ name, catalog = [], explicitId = null, aliases = null }) {
  if (isValidUuid(explicitId)) return explicitId.trim()

  const norm = normalizeEntityName(name)
  if (!norm || !Array.isArray(catalog) || catalog.length === 0) return null

  const findUnique = (targetNorm) => {
    const matches = catalog.filter((item) => normalizeEntityName(item?.name) === targetNorm && isValidUuid(item?.id))
    return matches.length === 1 ? matches[0].id : null
  }

  const direct = findUnique(norm)
  if (direct) return direct

  if (aliases && aliases[norm]) {
    return findUnique(aliases[norm])
  }

  return null
}

/**
 * Resuelve el UUID único de un trabajador/contratista/sector desde un catálogo en memoria.
 * Nunca adivina si existen homónimos (>1 coincidencia exacta).
 */
export function resolveWorkerIdFromCatalog(name, workers = [], explicitId = null) {
  return resolveUniqueCatalogId({
    name,
    catalog: workers,
    explicitId,
    aliases: WORKER_NAME_ALIASES
  })
}

/**
 * Resuelve el UUID único de un material desde un catálogo en memoria.
 */
export function resolveMaterialIdFromCatalog(name, materials = [], explicitId = null) {
  return resolveUniqueCatalogId({
    name,
    catalog: materials,
    explicitId,
    aliases: null
  })
}

let _workersCache = null
let _workersCacheTs = 0
const CACHE_TTL_MS = 30_000

/**
 * Obtiene y cachea brevemente (30s) la lista mínima (id, name) de workers
 * para servicios que no reciben el catálogo por props.
 */
export async function getWorkersLookupCached(supabase) {
  const now = Date.now()
  if (_workersCache && now - _workersCacheTs < CACHE_TTL_MS) {
    return _workersCache
  }
  const { data, error } = await supabase.from('workers').select('id, name')
  if (error || !Array.isArray(data)) return _workersCache || []
  _workersCache = data
  _workersCacheTs = now
  return data
}

/**
 * Sella el campo ID relacional en una copia del registro si aún está vacío.
 */
export function stampWorkerIdOnRecord(record, workers = [], { nameFields = ['worker_name'], idField = 'worker_id' } = {}) {
  if (!record || typeof record !== 'object') return record
  if (isValidUuid(record[idField])) return record

  let candidateName = ''
  for (const nf of nameFields) {
    const val = String(record[nf] || '').trim()
    if (val) {
      candidateName = val
      break
    }
  }
  if (!candidateName) return record

  const resolvedId = resolveWorkerIdFromCatalog(candidateName, workers, record[idField])
  return resolvedId ? { ...record, [idField]: resolvedId } : record
}
