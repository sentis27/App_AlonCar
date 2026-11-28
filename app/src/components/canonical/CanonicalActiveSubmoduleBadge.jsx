import { ChevronRight } from 'lucide-react'

const THEME_CLASSES = {
  cyan: 'bg-cyan-500/15 text-cyan-200 border-cyan-500/40',
  sky: 'bg-sky-500/15 text-sky-200 border-sky-500/40',
  emerald: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/40',
  amber: 'bg-amber-500/15 text-amber-200 border-amber-500/40',
  purple: 'bg-purple-500/15 text-purple-200 border-purple-500/40',
  violet: 'bg-violet-500/15 text-violet-200 border-violet-500/40',
}

/**
 * Capa 3 (SKL-019): Indicador compacto del submódulo activo en Zona 1.
 * Reemplaza las tiras de botones de pestañas dejando claro en 1 segundo dónde está parado el usuario.
 */
export default function CanonicalActiveSubmoduleBadge({ label, suffix = null, theme = 'cyan' }) {
  if (!label) return null
  const cls = THEME_CLASSES[theme] || THEME_CLASSES.cyan
  return (
    <span
      data-testid="active-submodule-badge"
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold border whitespace-nowrap ${cls}`}
      title={`Submódulo activo: ${label}`}
    >
      <ChevronRight className="w-3 h-3 opacity-80 shrink-0" />
      <span>{label}</span>
      {suffix ? <span className="font-mono text-[10px] opacity-85 ml-0.5">{suffix}</span> : null}
    </span>
  )
}
