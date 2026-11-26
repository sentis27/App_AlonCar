import React, { useEffect, useMemo, useRef } from 'react'
import { evaluateFormulaInput, looksLikeFormula, formatFormulaNumericDisplay } from '../../lib/formulaEngine'

/**
 * FormulaNumericInput.jsx
 * Componente Canónico de entrada numérica limpia estilo Excel / Google Sheets (Candado #2).
 *
 * - Sin flechitas nativas ▲▼ (`type="text" inputMode="decimal"`).
 * - Acepta `=` y `+` indistintamente (`=42+45`, `+42+45`, `=1*0.5`, `+1*0,5`).
 * - Muestra una vista previa instantánea del resultado SOLO mientras se escribe una fórmula.
 * - `onBlur` blindado (Candado #5): nunca pasa el evento `e` y evita doble commit con Enter.
 */
export default function FormulaNumericInput({
  value = '',
  onChange,
  onCommit,
  onCancel,
  onInvalid,
  variant = 'cell', // 'cell' (edición inline en grilla) | 'field' (campo de formulario/modal)
  allowNegative = false,
  maxDecimals = 4,
  emptyValue = null,
  unitSuffix = '',
  currencyPrefix = '',
  placeholder = '',
  autoFocus = false,
  required = false,
  disabled = false,
  className = '',
  title = 'Ingresá un número o fórmula (=42+45, +1*0.5)'
}) {
  const inputRef = useRef(null)
  const settledRef = useRef(false)

  useEffect(() => {
    settledRef.current = false
  }, [value])

  useEffect(() => {
    if (!autoFocus || !inputRef.current) return
    const el = inputRef.current
    el.focus()
    const str = String(value ?? '')
    // Si ya es fórmula (`=42+45`), ubicar el cursor al final para permitir seguir sumando (`+30`) sin borrar nada
    if (str.startsWith('=') || str.startsWith('+')) {
      const len = str.length
      try {
        el.setSelectionRange(len, len)
      } catch {
        // fallback silencioso
      }
    } else {
      el.select()
    }
    // Solo al montar en modo autoFocus
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus])

  const liveEval = useMemo(() => {
    if (!looksLikeFormula(value)) return null
    return evaluateFormulaInput(value, { allowNegative, maxDecimals, emptyValue })
  }, [value, allowNegative, maxDecimals, emptyValue])

  const previewLabel = useMemo(() => {
    if (!liveEval) return null
    if (!liveEval.ok) return { isError: true, text: liveEval.error || 'Fórmula inválida' }
    if (liveEval.value === null || liveEval.value === undefined) return null
    const formatted = currencyPrefix
      ? `${currencyPrefix}${Number(liveEval.value).toLocaleString('es-AR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: Math.min(2, maxDecimals)
        })}`
      : `${formatFormulaNumericDisplay(liveEval.value, { maxDecimals })}${unitSuffix ? ` ${unitSuffix}` : ''}`
    return { isError: false, text: `= ${formatted}` }
  }, [liveEval, currencyPrefix, unitSuffix, maxDecimals])

  const handleCommit = () => {
    if (variant !== 'cell' || settledRef.current) return
    settledRef.current = true
    const evaluated = evaluateFormulaInput(value, { allowNegative, maxDecimals, emptyValue })
    if (!evaluated.ok) {
      if (typeof onInvalid === 'function') onInvalid(evaluated.error)
      if (typeof onCancel === 'function') onCancel()
      return
    }
    if (typeof onCommit === 'function') {
      onCommit(value, evaluated)
    }
  }

  const handleCancel = () => {
    if (variant !== 'cell' || settledRef.current) return
    settledRef.current = true
    if (typeof onCancel === 'function') onCancel()
  }

  const handleKeyDown = (e) => {
    if (variant === 'cell') {
      if (e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
        handleCommit()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        handleCancel()
      }
    }
  }

  if (variant === 'field') {
    return (
      <div className="relative flex flex-col">
        <input
          ref={inputRef}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          value={value ?? ''}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          title={title}
          className={className}
        />
        {previewLabel && (
          <span
            className={`mt-0.5 text-[10px] font-mono font-bold truncate ${
              previewLabel.isError ? 'text-rose-400' : 'text-emerald-400'
            }`}
          >
            {previewLabel.text}
          </span>
        )}
      </div>
    )
  }

  return (
    <div
      className="relative inline-block w-full"
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <input
        ref={inputRef}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={value ?? ''}
        onChange={(e) => onChange?.(e.target.value)}
        onBlur={() => handleCommit()}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        title={title}
        className={className}
      />
      {previewLabel && (
        <div
          className={`pointer-events-none absolute right-0 -top-5 z-40 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold whitespace-nowrap shadow-lg border ${
            previewLabel.isError
              ? 'bg-rose-950/95 text-rose-200 border-rose-500/70'
              : 'bg-slate-950/95 text-emerald-300 border-emerald-500/60'
          }`}
        >
          {previewLabel.text}
        </div>
      )}
    </div>
  )
}

/**
 * Micro-indicador visual liviano estilo Excel (cero estado React / cero costo de memoria)
 * para señalar celdas que guardan una fórmula detrás del número calculado.
 */
export function FormulaCellCornerMark({ formula }) {
  if (!formula) return null
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute top-0 right-0 w-0 h-0 border-t-[6px] border-t-cyan-400 border-l-[6px] border-l-transparent opacity-90"
    />
  )
}
