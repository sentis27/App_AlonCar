/**
 * aloncarLogoSvg.js
 * Membrete vectorial único del Astillero Vanoli · Alon Car S.A. (Imagen 2).
 * Fuente compartida entre la Sábana Blanca en pantalla y la impresión/PDF A4.
 */

export const ALONCAR_AV_LOGO_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label="Logo Astillero Vanoli Alon Car S.A.">
  <circle cx="50" cy="50" r="45" fill="none" stroke="#111111" stroke-width="5.5" />
  <path d="M 21 72 L 45 20 L 58 20 L 42 56 L 56 56 L 51 66 L 34 66 L 31 72 Z" fill="#111111" />
  <path d="M 52 24 L 62 24 L 65 56 L 78 24 L 88 24 L 68 74 L 58 74 Z" fill="#111111" />
</svg>`

export function formatLongSpanishDate(isoOrDate) {
  let d = null
  if (isoOrDate && /^\d{4}-\d{2}-\d{2}$/.test(String(isoOrDate).trim())) {
    const [y, m, day] = String(isoOrDate).trim().split('-').map(Number)
    d = new Date(y, m - 1, day)
  } else if (isoOrDate) {
    const parsed = new Date(isoOrDate)
    if (!Number.isNaN(parsed.getTime())) d = parsed
  }
  if (!d) d = new Date()
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ]
  return `${d.getDate()} de ${months[d.getMonth()]} de ${d.getFullYear()}`
}

export function getTodayIsoDate() {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
