import * as pdfjsLib from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker
}

/**
 * Extrae texto digital de un archivo PDF sin uso de IA ni APIs externas (0 costo).
 * @param {File|Blob|ArrayBuffer} file
 * @param {number} maxPages - Máximo de páginas a procesar para velocidad (defecto: 10)
 * @returns {Promise<string>} Texto extraído o cadena vacía si falla o no es PDF
 */
export async function extractTextFromPdf(file, maxPages = 10) {
  if (!file) return ''
  try {
    let arrayBuffer
    if (file instanceof ArrayBuffer) {
      arrayBuffer = file
    } else if (file && typeof file.arrayBuffer === 'function') {
      arrayBuffer = await file.arrayBuffer()
    } else {
      return ''
    }

    const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer })
    const pdf = await loadingTask.promise
    let extracted = ''
    const pagesToRead = Math.min(pdf.numPages, maxPages)

    for (let i = 1; i <= pagesToRead; i++) {
      const page = await pdf.getPage(i)
      const textContent = await page.getTextContent()
      const pageText = textContent.items
        .map((item) => (item && typeof item.str === 'string' ? item.str : ''))
        .filter(Boolean)
        .join(' ')
      extracted += ' ' + pageText
    }

    return extracted.replace(/\s+/g, ' ').trim()
  } catch (err) {
    console.warn('Extracción de texto digital PDF omitida o fallida:', err)
    return ''
  }
}
