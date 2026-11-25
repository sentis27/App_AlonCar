/**
 * aloncarLogoSvg.js
 * Membrete vectorial único del Astillero Vanoli · Alon Car S.A. (Imagen 2).
 * Fuente compartida entre la Sábana Blanca en pantalla y la impresión/PDF A4.
 */

import { formatLongSpanishDateAr, getTodayArIso } from './dateTimeCanonical.js'

export const ALONCAR_AV_LOGO_SVG = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-label="Logo Astillero Vanoli Alon Car S.A.">
  <circle cx="50" cy="50" r="45" fill="none" stroke="#111111" stroke-width="5.5" />
  <path d="M 21 72 L 45 20 L 58 20 L 42 56 L 56 56 L 51 66 L 34 66 L 31 72 Z" fill="#111111" />
  <path d="M 52 24 L 62 24 L 65 56 L 78 24 L 88 24 L 68 74 L 58 74 Z" fill="#111111" />
</svg>`

export function formatLongSpanishDate(isoOrDate) {
  return formatLongSpanishDateAr(isoOrDate)
}

export function getTodayIsoDate() {
  return getTodayArIso()
}
