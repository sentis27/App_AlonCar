/**
 * monotonicFolioEngine.js
 * 
 * Motor Canónico de Folios Operativos Inviolables (# DNI de Fila) para AlonCar ERP.
 * 
 * Regla de Oro:
 * El número de fila (#) NO es el índice de visualización momentánea (rowIndex).
 * Es un Folio / DNI monótono creciente e inmutable asignado a cada registro.
 * - El registro más antiguo de la base de datos es el #1.
 * - Cada registro subsiguiente incrementa correlativamente (+1).
 * - Cuando se crea/inserta una nueva fila en blanco, nace con el siguiente número (max + 1),
 *   NUNCA como #1.
 * - Al filtrar en el buscador crawler o cambiar el orden visual, el folio permanece inalterable.
 */

/**
 * Asigna folios monótonos crecientes a una lista de registros basada en su orden cronológico histórico.
 * Preserva cualquier folio previamente asignado o persistido.
 * 
 * @param {Array} items - Lista de registros
 * @param {Object} options - Opciones de ordenación
 * @param {string} options.dateField - Campo de fecha de creación (ej. 'created_at', 'service_date', 'order_date')
 * @param {string} options.idField - Campo de identificación (por defecto 'id')
 * @returns {Array} Lista con propiedad `_rowSeq` garantizada
 */
export function assignMonotonicFolios(items = [], options = {}) {
  if (!Array.isArray(items) || items.length === 0) return items

  const {
    dateField = 'created_at',
    idField = 'id'
  } = options

  // Si todos los items ya tienen _rowSeq válido (o están marcados para omitir folio), devolverlos directamente
  const allResolved = items.every(
    (it) => it?._skipFolio || (typeof it?._rowSeq === 'number' && it._rowSeq > 0)
  )
  if (allResolved) return items

  // Copia ordenada cronológicamente (más antiguo primero)
  const sorted = [...items].sort((a, b) => {
    if (typeof a?._rowSeq === 'number' && typeof b?._rowSeq === 'number') {
      return a._rowSeq - b._rowSeq
    }
    const dateA = a?.[dateField] || a?.created_at || a?.service_date || a?.transaction_date || a?.order_date || ''
    const dateB = b?.[dateField] || b?.created_at || b?.service_date || b?.transaction_date || b?.order_date || ''
    if (dateA && dateB && dateA !== dateB) {
      const cmp = new Date(dateA) - new Date(dateB)
      if (!isNaN(cmp) && cmp !== 0) return cmp
    }
    const idA = String(a?.[idField] || '')
    const idB = String(b?.[idField] || '')
    return idA.localeCompare(idB)
  })

  // Calcular máximo folio ya asignado para evitar colisiones (ej. al mezclar filas nuevas o placeholders)
  const maxExistingSeq = sorted.reduce(
    (mx, it) => (typeof it?._rowSeq === 'number' && it._rowSeq > mx ? it._rowSeq : mx),
    0
  )

  // Mapear cada ID a su folio correlativo 1...N (o maxExistingSeq + 1 en adelante)
  const folioMap = new Map()
  let currentSeq = maxExistingSeq > 0 ? maxExistingSeq + 1 : 1
  for (const item of sorted) {
    if (item?._skipFolio) continue
    const key = item[idField] || item
    const existingSeq = typeof item._rowSeq === 'number' && item._rowSeq > 0 ? item._rowSeq : currentSeq++
    folioMap.set(key, existingSeq)
  }

  // Devolver los items en su orden actual, asegurando la propiedad `_rowSeq`
  return items.map((item) => {
    if (item?._skipFolio) {
      return item._rowSeq === null ? item : { ...item, _rowSeq: null }
    }
    const key = item[idField] || item
    const seq = folioMap.get(key) || item._rowSeq || 1
    if (item._rowSeq === seq) return item
    return { ...item, _rowSeq: seq }
  })
}

/**
 * Obtiene el siguiente folio monótono para una nueva fila (siempre sumando).
 * 
 * @param {Array} items - Lista de registros existentes
 * @returns {number} Siguiente folio (# N + 1)
 */
export function getNextMonotonicFolio(items = []) {
  if (!Array.isArray(items) || items.length === 0) return 1
  let max = 0
  for (const it of items) {
    const val = typeof it?._rowSeq === 'number' ? it._rowSeq : (typeof it?.folio === 'number' ? it.folio : 0)
    if (val > max) max = val
  }
  return (max || items.length) + 1
}

/**
 * Inyecta el siguiente folio correlativo a un nuevo registro antes de insertarlo.
 * 
 * @param {Object} newRecord - Nuevo registro
 * @param {Array} existingItems - Lista de registros existentes
 * @returns {Object} Registro con `_rowSeq` inyectado
 */
export function stampNewRecordWithFolio(newRecord = {}, existingItems = []) {
  const nextSeq = getNextMonotonicFolio(existingItems)
  return {
    ...newRecord,
    _rowSeq: nextSeq
  }
}
