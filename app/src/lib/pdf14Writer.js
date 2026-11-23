/**
 * pdf14Writer.js
 * Empaquetador puro PDF 1.4 (A4 vertical, WinAnsiEncoding) sin dependencias externas.
 */

export function pdfEscape(str = '') {
  let out = ''
  for (let i = 0; i < str.length; i += 1) {
    const code = str.charCodeAt(i)
    const ch = str[i]
    if (ch === '\\' || ch === '(' || ch === ')') out += `\\${ch}`
    else if (code >= 32 && code <= 126) out += ch
    else if (code >= 160 && code <= 255) out += `\\${code.toString(8).padStart(3, '0')}`
    else out += ' '
  }
  return out
}

export function stripHtmlToLines(raw = '') {
  const text = String(raw || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:div|p|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
  return text.split('\n').map((l) => l.trim()).filter(Boolean)
}

export function wrapText(str, maxChars = 66) {
  const out = []
  for (const rawLine of String(str || '').split('\n')) {
    const words = rawLine.trim().split(/\s+/).filter(Boolean)
    if (words.length === 0) continue
    let curr = ''
    for (const w of words) {
      if (!curr) curr = w
      else if (curr.length + 1 + w.length <= maxChars) curr += ` ${w}`
      else { out.push(curr); curr = w }
    }
    if (curr) out.push(curr)
  }
  return out
}

export function assembleA4PdfBytes(pageStreams = []) {
  const objects = [
    '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
    '',
    '3 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj',
    '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> endobj',
  ]
  const kidsRefs = []
  pageStreams.forEach((streamText) => {
    const pageObjId = objects.length + 1
    const contentObjId = pageObjId + 1
    kidsRefs.push(`${pageObjId} 0 R`)
    objects.push(`${pageObjId} 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjId} 0 R >> endobj`)
    objects.push(`${contentObjId} 0 obj << /Length ${streamText.length} >> stream\n${streamText}\nendstream endobj`)
  })
  objects[1] = `2 0 obj << /Type /Pages /Kids [${kidsRefs.join(' ')}] /Count ${kidsRefs.length} >> endobj`

  let pdf = '%PDF-1.4\n'
  const offsets = [0]
  for (const obj of objects) {
    offsets.push(pdf.length)
    pdf += `${obj}\n`
  }
  const xrefOffset = pdf.length
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`
  for (let i = 1; i <= objects.length; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`
  }
  pdf += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`

  const bytes = new Uint8Array(pdf.length)
  for (let i = 0; i < pdf.length; i += 1) bytes[i] = pdf.charCodeAt(i) & 0xff
  return bytes
}
