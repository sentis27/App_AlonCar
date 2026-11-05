/**
 * searchEngine.js
 * 
 * Crawler profundo y normalizador universal para el Buscador Omnicanal de AlonCar.
 * Barre automáticamente todas las propiedades nativas de un registro más entidades
 * hijas vinculadas (Fletes, Comprobantes, Documentos PDF indexados, Notas técnicas).
 */

export function normalizeSearchText(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

/**
 * Construye el corpus de búsqueda universal para un registro.
 * Inmune a nuevas columnas o cambios de esquema.
 */
export function buildUniversalSearchCorpus(record, options = {}) {
  if (!record || typeof record !== 'object') return ''

  const parts = []

  // 1. Barrido recursivo de todas las propiedades nativas del registro
  for (const [key, val] of Object.entries(record)) {
    if (val === null || val === undefined) continue
    if (typeof val === 'string') {
      const trimmed = val.trim()
      // Omitir UUIDs técnicos puros de 36 caracteres con 4 guiones
      if (trimmed.length === 36 && (trimmed.match(/-/g) || []).length === 4) continue
      // Omitir fechas ISO completas técnicas si no aportan
      if (trimmed) parts.push(trimmed)
    } else if (typeof val === 'number') {
      parts.push(String(val))
    }
  }

  // 2. Indexación de Logística y Fletes vinculados
  if (record.freight_transport_name) parts.push(record.freight_transport_name)
  if (record.freight_guide_number) parts.push(record.freight_guide_number)
  if (record.freight_driver_name) parts.push(record.freight_driver_name)

  // 3. Indexación de Comprobantes y Facturas
  if (record.invoice_number) parts.push(record.invoice_number)
  if (record.receipt_number) parts.push(record.receipt_number)

  // 4. Indexación de Documentos y PDFs adjuntos vinculados (extras)
  if (Array.isArray(options.documents)) {
    options.documents.forEach((doc) => {
      if (doc.file_name) parts.push(doc.file_name)
      if (doc.extracted_text) parts.push(doc.extracted_text)
      if (doc.notes) parts.push(doc.notes)
    })
  }

  // 5. Indexación de sub-ítems o detalles vinculados
  if (Array.isArray(record.items)) {
    record.items.forEach((it) => {
      if (it.description) parts.push(it.description)
      if (it.material_name) parts.push(it.material_name)
    })
  }

  return normalizeSearchText(parts.join(' '))
}

/**
 * Predicado rápido para evaluar coincidencia omnicanal
 */
export function matchesUniversalSearch(record, query, options = {}) {
  if (!query || !query.trim()) return true
  const q = normalizeSearchText(query)
  const corpus = buildUniversalSearchCorpus(record, options)
  return corpus.includes(q)
}
