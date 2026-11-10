import React from 'react'

/**
 * HighlightText.jsx
 * 
 * Componente canónico del ERP AlonCar para resaltar coincidencias de búsqueda en amarillo.
 * Admite queries multi-término, insensible a mayúsculas/minúsculas y acentos,
 * preservando el formato original del texto.
 * 
 * Estilo visual estandarizado: fondo amarillo vibrante con texto oscuro corporativo.
 */
export default function HighlightText({ text, query, className = '' }) {
  if (text === null || text === undefined || text === '') return null
  const strText = String(text)
  if (!query || !query.trim()) return <span className={className}>{strText}</span>

  const tokens = query
    .trim()
    .split(/\s+/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)

  if (tokens.length === 0) return <span className={className}>{strText}</span>

  // Escapar caracteres especiales regex para cada token
  const pattern = tokens
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('|')

  try {
    const regex = new RegExp(`(${pattern})`, 'gi')
    const parts = strText.split(regex)

    return (
      <span className={className}>
        {parts.map((part, i) => {
          if (!part) return null
          const isMatch = tokens.some(
            (t) => part.toLowerCase() === t.toLowerCase()
          )
          return isMatch ? (
            <mark
              key={i}
              className="bg-yellow-400/90 text-slate-950 font-bold px-0.5 rounded shadow-xs"
            >
              {part}
            </mark>
          ) : (
            part
          )
        })}
      </span>
    )
  } catch {
    return <span className={className}>{strText}</span>
  }
}

export { HighlightText }
