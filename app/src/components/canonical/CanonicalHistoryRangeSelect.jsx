import { HISTORY_RANGE_OPTIONS, DEFAULT_HISTORY_RANGE } from '../../lib/gridPerformanceHelpers'
import { getFilterSelectClass } from '../../lib/filterThemeConstants'

/**
 * CanonicalHistoryRangeSelect
 * Selector canónico de ventana temporal para Zona 3 (FL-025 · Opción A).
 * Arranca en `Últimos 90 días` y permite pasar en 1 clic a `Este año` o `Todo el historial`.
 */
export default function CanonicalHistoryRangeSelect({
  value = DEFAULT_HISTORY_RANGE,
  onChange,
  loading = false,
  className = '',
}) {
  const isCustom = value && value !== DEFAULT_HISTORY_RANGE

  return (
    <select
      data-testid="history-range-select"
      aria-label="Ventana histórica de registros"
      title="Ventana histórica de carga (los reportes gerenciales y cierres siempre leen el 100% histórico)"
      value={value || DEFAULT_HISTORY_RANGE}
      onChange={(e) => onChange?.(e.target.value)}
      disabled={loading}
      className={getFilterSelectClass('period', isCustom, `${loading ? 'opacity-70' : ''} ${className}`.trim())}
    >
      {HISTORY_RANGE_OPTIONS.map((opt) => (
        <option key={opt.value} value={opt.value} className="bg-slate-950 text-slate-200">
          📅 {opt.label}
        </option>
      ))}
    </select>
  )
}
