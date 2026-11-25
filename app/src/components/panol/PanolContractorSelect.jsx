import { useEffect, useRef } from 'react'
import { normalizeText } from '../../lib/allocationEngine'

const TOKENS = {
  EXPAND: '__EXPANDIR_CONTRATISTAS__',
  COLLAPSE: '__CONTRAER_CONTRATISTAS__',
  REQUEST_OT: '__SOLICITAR_APERTURA_OT__',
  REQUEST_WORKER: '__SOLICITAR_HABILITACION_OPERARIO__'
}

/**
 * Selector agrupado único de Operario / Contratista para Pañol (Planilla inline + Modal Multi-Material).
 */
export default function PanolContractorSelect({
  value = '',
  enabled = { astilleroWorkers: [], contractorGroups: [] },
  isExpanded = false,
  hasScope = false,
  scopeLabel = 'Barco',
  enabledAstSet = new Set(),
  enabledCntSet = new Set(),
  unmatchedSuffix = ' (Sin OT en barco)',
  isOtRequestPending = false,
  required = false,
  inline = false,
  className = '',
  onChange,
  onToggleExpand,
  onRequestOt,
  onRequestWorkerPermission,
  onCancel
}) {
  const selectRef = useRef(null)
  const suppressBlurRef = useRef(false)

  useEffect(() => {
    if (!inline || !selectRef.current) return
    const el = selectRef.current
    el.focus()
    try {
      if (typeof el.showPicker === 'function') el.showPicker()
    } catch { /* navegador sin soporte showPicker */ }
  }, [inline])

  const reopenInlinePicker = () => {
    suppressBlurRef.current = true
    setTimeout(() => {
      suppressBlurRef.current = false
      const el = selectRef.current
      if (!el) return
      el.focus()
      try {
        if (typeof el.showPicker === 'function') el.showPicker()
      } catch { /* navegador sin soporte showPicker */ }
    }, 0)
  }

  const astList = enabled?.astilleroWorkers || []
  const cntList = enabled?.contractorGroups || []
  const totalCount = astList.length + cntList.length

  const isMissingCurrent = Boolean(
    value &&
      !astList.some((w) => normalizeText(w.name) === normalizeText(value)) &&
      !cntList.some((g) => normalizeText(g) === normalizeText(value))
  )

  const handleSelectChange = (rawVal) => {
    if (rawVal === TOKENS.EXPAND) {
      if (inline) reopenInlinePicker()
      onToggleExpand?.(true)
      return
    }
    if (rawVal === TOKENS.COLLAPSE) {
      if (inline) reopenInlinePicker()
      onToggleExpand?.(false)
      return
    }
    if (rawVal === TOKENS.REQUEST_OT) {
      onRequestOt?.()
      if (inline) onCancel?.()
      return
    }
    if (rawVal === TOKENS.REQUEST_WORKER) {
      onRequestWorkerPermission?.()
      if (inline) onCancel?.()
      return
    }
    if (inline && !rawVal) {
      onCancel?.()
      return
    }
    onChange?.(rawVal)
  }

  const baseCls = inline
    ? `w-full min-w-[175px] px-1.5 py-0.5 rounded bg-slate-950 border ${
        isExpanded ? 'border-amber-400 text-amber-200' : 'border-cyan-400 text-cyan-300'
      } font-bold text-[11px] focus:outline-none`
    : 'w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-cyan-400 font-black text-xs focus:outline-none focus:border-cyan-400'

  const scopeWord = scopeLabel === 'OT' ? 'la OT' : 'el Barco'
  const emptyWord = scopeLabel === 'OT' ? 'esta OT' : 'este barco'
  const contractTarget = scopeLabel === 'OT' ? 'de la OT' : 'del barco'

  return (
    <select
      ref={selectRef}
      value={value}
      required={required}
      onChange={(e) => handleSelectChange(e.target.value)}
      onClick={inline ? (e) => e.stopPropagation() : undefined}
      onBlur={() => {
        if (inline && !suppressBlurRef.current) onCancel?.()
      }}
      onKeyDown={
        inline
          ? (e) => {
              e.stopPropagation()
              if (e.key === 'Escape') {
                e.preventDefault()
                onCancel?.()
              }
            }
          : undefined
      }
      className={className || baseCls}
    >
      <option value="" disabled={inline}>
        {hasScope && !isExpanded
          ? `-- Habilitados en ${scopeWord} (${totalCount}) --`
          : '-- Seleccionar Operario / Contratista --'}
      </option>
      {hasScope && !isExpanded && totalCount === 0 && (
        <option value="" disabled className="text-amber-400 bg-slate-950">
          ⚠️ Sin contratistas con OT activa en {emptyWord} (usá 🔓 Expandir)
        </option>
      )}
      {isMissingCurrent && <option value={value}>{value} (Actual)</option>}
      {astList.length > 0 && (
        <optgroup
          label={
            isExpanded
              ? `⭐ Personal Astillero Completo (${astList.length})`
              : `⭐ Personal Astillero Habilitado (${astList.length})`
          }
        >
          {astList.map((w) => {
            const hasOt = !hasScope || enabledAstSet.has(normalizeText(w.name))
            return (
              <option key={`ast_${w.id || w.name}`} value={w.name}>
                {w.name}{isExpanded && !hasOt ? unmatchedSuffix : ''}
              </option>
            )
          })}
        </optgroup>
      )}
      {cntList.length > 0 && (
        <optgroup
          label={
            isExpanded
              ? `🏗️ Todos los Contratistas (${cntList.length})`
              : `🏗️ Contratistas Habilitados ${scopeLabel === 'OT' ? 'en OT' : 'en Barco'} (${cntList.length})`
          }
        >
          {cntList.map((grp) => {
            const hasOt = !hasScope || enabledCntSet.has(normalizeText(grp))
            return (
              <option key={`cnt_${grp}`} value={grp}>
                {grp}{isExpanded && !hasOt ? unmatchedSuffix : ''}
              </option>
            )
          })}
        </optgroup>
      )}
      {hasScope && !isExpanded && (
        <option value={TOKENS.EXPAND} className="text-amber-300 font-bold bg-slate-950">
          🔓 Expandir (Ver totalidad de operarios y contratistas)...
        </option>
      )}
      {hasScope && isExpanded && (
        <option value={TOKENS.COLLAPSE} className="text-sky-300 font-bold bg-slate-950">
          🔒 Contraer (Solo habilitados {contractTarget})
        </option>
      )}
      <option
        value={TOKENS.REQUEST_OT}
        disabled={isOtRequestPending}
        className={isOtRequestPending ? 'text-slate-500 bg-slate-950' : 'text-rose-400 font-bold bg-slate-950'}
      >
        {isOtRequestPending ? 'Solicitud de OT enviada (1)' : '➕ Solicitar Apertura de OT a Admin...'}
      </option>
      <option value={TOKENS.REQUEST_WORKER} className="text-cyan-400 font-bold bg-slate-950">
        ➕ Solicitar Habilitación de Operario a Admin...
      </option>
    </select>
  )
}
