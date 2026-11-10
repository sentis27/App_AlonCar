/**
 * searchEngine.js
 * 
 * Crawler profundo y normalizador universal para el Buscador Omnicanal de AlonCar (Estándar 03).
 * Barre automáticamente todas las propiedades nativas de un registro más entidades
 * hijas vinculadas (Fletes, Comprobantes, Documentos PDF/JPG adjuntos indexados, Notas técnicas, Dimensiones y Tarifas).
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
 * Helper interno para extraer texto de cualquier documento o adjunto (objeto o URL string).
 */
function extractAttachmentParts(doc, parts) {
  if (!doc) return
  if (typeof doc === 'string') {
    const trimmed = doc.trim()
    if (trimmed) {
      parts.push(trimmed)
      // Si parece una URL o path con nombre de archivo, extraer el nombre del archivo
      const lastSegment = trimmed.split(/[/\\\\]/).pop() || ''
      if (lastSegment && lastSegment !== trimmed) {
        parts.push(lastSegment)
        // Extraer nombre sin extensión
        const nameWithoutExt = lastSegment.replace(/\.[a-zA-Z0-9]+$/, '')
        if (nameWithoutExt) parts.push(nameWithoutExt.replace(/[-_]/g, ' '))
      }
    }
    return
  }
  if (typeof doc === 'object') {
    if (doc.file_name) parts.push(doc.file_name)
    if (doc.original_filename) parts.push(doc.original_filename)
    if (doc.extracted_text) parts.push(doc.extracted_text)
    if (doc.ocr_text) parts.push(doc.ocr_text)
    if (doc.description) parts.push(doc.description)
    if (doc.doc_type) parts.push(doc.doc_type)
    if (doc.notes) parts.push(doc.notes)
    if (doc.file_url) parts.push(doc.file_url)
    if (doc.url) parts.push(doc.url)
    if (doc.name) parts.push(doc.name)
  }
}

/**
 * Construye el corpus de búsqueda universal para un registro.
 * Inmune a nuevas columnas o cambios de esquema.
 * Indexa textos, números enteros, decimales (. y ,), adjuntos (PDF/JPG) y entidades relacionadas.
 */
export function buildUniversalSearchCorpus(record, options = {}) {
  if (!record) return ''

  // Si ya es un corpus pre-formateado (string)
  if (typeof record === 'string') {
    return normalizeSearchText(record)
  }

  if (typeof record !== 'object') return ''

  const parts = []

  // 1. Barrido recursivo de todas las propiedades nativas del registro
  for (const [key, val] of Object.entries(record)) {
    if (val === null || val === undefined) continue

    if (typeof val === 'string') {
      const trimmed = val.trim()
      // Omitir UUIDs técnicos puros de 36 caracteres con 4 guiones
      if (trimmed.length === 36 && (trimmed.match(/-/g) || []).length === 4) continue
      if (trimmed) {
        parts.push(trimmed)
        // Si contiene números con coma o punto, indexar ambas variantes
        if (/[0-9]+[.,][0-9]+/.test(trimmed)) {
          parts.push(trimmed.replace(',', '.'))
          parts.push(trimmed.replace('.', ','))
        }
        // Si la clave o el valor alude a un archivo/adjunto/pdf/jpg
        if (/pdf|jpg|jpeg|png|adjunto|comprobante|remito|factura/i.test(key) || /\.(pdf|jpg|jpeg|png)$/i.test(trimmed)) {
          extractAttachmentParts(trimmed, parts)
        }
      }
    } else if (typeof val === 'number') {
      const numStr = String(val)
      parts.push(numStr)
      if (numStr.includes('.')) {
        parts.push(numStr.replace('.', ','))
      }
      if (Number.isFinite(val)) {
        const fixed2 = val.toFixed(2)
        parts.push(fixed2)
        parts.push(fixed2.replace('.', ','))
      }
    } else if (typeof val === 'boolean') {
      parts.push(val ? 'si activo true' : 'no inactivo false')
    } else if (Array.isArray(val)) {
      // Si la clave sugiere adjuntos o documentos
      if (/attachment|document|file|comprobante/i.test(key)) {
        val.forEach((item) => extractAttachmentParts(item, parts))
      }
    } else if (typeof val === 'object') {
      // Si el campo es un JSON con adjuntos
      if (/attachment|document|file/i.test(key)) {
        extractAttachmentParts(val, parts)
      }
    }
  }

  // 2. Indexación explícita de campos comunes de Adjuntos y Archivos en el registro
  if (record.file_name) parts.push(record.file_name)
  if (record.original_filename) parts.push(record.original_filename)
  if (record.extracted_text) parts.push(record.extracted_text)
  if (record.ocr_text) parts.push(record.ocr_text)
  if (record.attachment_url) extractAttachmentParts(record.attachment_url, parts)
  if (record.pdf_url) extractAttachmentParts(record.pdf_url, parts)
  if (record.file_url) extractAttachmentParts(record.file_url, parts)

  // 3. Indexación de Logística y Fletes vinculados
  if (record.freight_transport_name) parts.push(record.freight_transport_name)
  if (record.freight_guide_number) parts.push(record.freight_guide_number)
  if (record.freight_driver_name) parts.push(record.freight_driver_name)

  // 4. Indexación de Comprobantes y Facturas
  if (record.invoice_number) parts.push(record.invoice_number)
  if (record.receipt_number) parts.push(record.receipt_number)
  if (record.budget_number) parts.push(record.budget_number)
  if (record.internal_remito_number) parts.push(record.internal_remito_number)
  if (record.supplier_remito_number) parts.push(record.supplier_remito_number)
  if (record.voucher_number) parts.push(record.voucher_number)

  // 5. Indexación de sub-ítems o detalles vinculados
  if (Array.isArray(record.items)) {
    record.items.forEach((it) => {
      if (it.description) parts.push(it.description)
      if (it.material_name) parts.push(it.material_name)
    })
  }

  // 6. Indexación de Colecciones de Adjuntos (record.documents o record.attachments)
  if (Array.isArray(record.documents)) {
    record.documents.forEach((doc) => extractAttachmentParts(doc, parts))
  }
  if (Array.isArray(record.attachments)) {
    record.attachments.forEach((doc) => extractAttachmentParts(doc, parts))
  }

  // 7. Indexación profunda de opciones (options) pasadas por el módulo
  if (options && typeof options === 'object') {
    // a. Documentos/Adjuntos pasados en options
    if (Array.isArray(options.documents)) {
      options.documents.forEach((doc) => extractAttachmentParts(doc, parts))
    }
    if (Array.isArray(options.attachments)) {
      options.attachments.forEach((doc) => extractAttachmentParts(doc, parts))
    }

    // b. Propiedades sueltas pasadas en options (ej: ship_name, ot_number, ot_title, effective_trade, etc.)
    for (const [optKey, optVal] of Object.entries(options)) {
      if (optKey === 'documents' || optKey === 'attachments') continue
      if (optVal === null || optVal === undefined) continue
      if (typeof optVal === 'string' || typeof optVal === 'number') {
        const strVal = String(optVal).trim()
        if (strVal) {
          parts.push(strVal)
          if (/[0-9]+[.,][0-9]+/.test(strVal)) {
            parts.push(strVal.replace(',', '.'))
            parts.push(strVal.replace('.', ','))
          }
        }
      }
    }
  }

  return normalizeSearchText(parts.join(' '))
}

/**
 * Predicado rápido para evaluar coincidencia omnicanal.
 * Admite que 'record' sea un objeto de registro O un string (corpus precomputado).
 * Admite búsqueda multi-término (todas las palabras deben coincidir)
 * y variantes de coma/punto para números y monedas.
 */
export function matchesUniversalSearch(record, query, options = {}) {
  if (!query || !query.trim()) return true
  const q = normalizeSearchText(query)
  const tokens = q.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return true

  // Soporte polimórfico: si record ya es un string, lo usamos normalizado; si es objeto, construimos el corpus
  const corpus = typeof record === 'string'
    ? normalizeSearchText(record)
    : buildUniversalSearchCorpus(record, options)

  return tokens.every((token) => {
    if (corpus.includes(token)) return true
    if (token.includes(',')) {
      if (corpus.includes(token.replace(/,/g, '.'))) return true
    }
    if (token.includes('.')) {
      if (corpus.includes(token.replace(/\./g, ','))) return true
    }
    return false
  })
}
