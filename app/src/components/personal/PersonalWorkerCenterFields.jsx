import { Building2, Users, Calendar, Shield, HelpCircle } from 'lucide-react'
import {
  CONTRACT_TYPES,
  SAFETY_ITEMS_OPTIONS,
  SAFETY_ITEMS_HELP_TEXT,
  computeContractExpiration
} from '../../lib/workCostRules'

export default function PersonalWorkerCenterFields({
  formData,
  setFormData,
  onAdminCenterChange,
  isCustomGroup,
  setIsCustomGroup,
  customGroupName,
  setCustomGroupName,
  availableContractorGroups,
  availableTallerGroups
}) {
  const centers = [
    {
      key: 'ASTILLERO',
      desc: 'Personal propio',
      Icon: Building2,
      activeCls: 'bg-cyan-950/80 border-cyan-400 text-white shadow-md ring-1 ring-cyan-400',
      iconActiveCls: 'text-cyan-400',
      badgeCls: 'text-cyan-400'
    },
    {
      key: 'CONTRATISTA',
      desc: 'Cuadrillas ext.',
      Icon: Users,
      activeCls: 'bg-amber-950/80 border-amber-400 text-white shadow-md ring-1 ring-amber-400',
      iconActiveCls: 'text-amber-400',
      badgeCls: 'text-amber-400'
    },
    {
      key: 'TALLER',
      desc: 'Mecanizados ext.',
      Icon: Building2,
      activeCls: 'bg-purple-950/80 border-purple-400 text-white shadow-md ring-1 ring-purple-400',
      iconActiveCls: 'text-purple-400',
      badgeCls: 'text-purple-400'
    }
  ]

  const previewExp = formData.admin_center === 'ASTILLERO' && formData.contract_type
    ? computeContractExpiration(formData.contract_type, formData.contract_start_date)
    : null

  return (
    <div className="alon-chunk-amber space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-black text-amber-300 uppercase tracking-wider">
          1. Centro Administrativo (Origen del Personal)
        </label>
        <span className="text-[10px] font-mono text-amber-400/80">Paso 1/5</span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {centers.map(({ key, desc, Icon, activeCls, iconActiveCls, badgeCls }) => {
          const active = formData.admin_center === key
          return (
            <button
              key={key}
              type="button"
              onClick={() => onAdminCenterChange(key)}
              className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                active ? activeCls : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
              }`}
            >
              <div className="flex items-center justify-between w-full mb-1">
                <Icon className={`w-3.5 h-3.5 ${active ? iconActiveCls : 'text-slate-500'}`} />
                {active && <span className={`text-[9px] font-bold ${badgeCls}`}>✓ Activo</span>}
              </div>
              <div>
                <div className="font-extrabold text-xs">{key}</div>
                <div className="text-[10px] text-slate-400 leading-tight">{desc}</div>
              </div>
            </button>
          )
        })}
      </div>

      {formData.admin_center === 'ASTILLERO' ? (
        <div className="space-y-2.5">
          <div className="p-2.5 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <span className="text-xs text-slate-300">Grupo de Trabajo Asignado:</span>
            <span className="px-2.5 py-1 rounded-lg bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono font-bold text-xs">
              ASTILLERO (Propio)
            </span>
          </div>

          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-cyan-500/30 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>Contrato Laboral (Alerta a María José 7 días antes)</span>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">Tipo de Contrato:</label>
                <select
                  value={formData.contract_type}
                  onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
                >
                  <option value="">Sin especificar...</option>
                  {CONTRACT_TYPES.map((ct) => (
                    <option key={ct.value} value={ct.value}>{ct.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 mb-1">Fecha de Inicio (doble clic calendario):</label>
                <input
                  type="date"
                  value={formData.contract_start_date}
                  onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value })}
                  onDoubleClick={(e) => e.currentTarget.showPicker?.()}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>
            {previewExp && (
              <div className="text-[10px] text-slate-300 flex items-center justify-between pt-1 border-t border-slate-800/80">
                <span>
                  {previewExp.isPermanent
                    ? 'Planta Permanente (no emite alerta de vencimiento).'
                    : previewExp.expiresIso
                    ? `Vence: ${previewExp.expiresIso} (${previewExp.daysRemaining} días restantes)`
                    : 'Ingresá fecha de inicio para calcular vencimiento.'}
                </span>
                {previewExp.vacationDays !== null && (
                  <span className="font-mono text-emerald-300 font-bold">
                    Ref. Vacaciones: {previewExp.vacationDays} día(s)
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <label className="block text-[11px] font-bold text-slate-300">
            Grupo de Trabajo / Contratista / Razón Social:
          </label>
          {!isCustomGroup ? (
            <div className="flex gap-2">
              <select
                value={formData.work_group}
                onChange={(e) => {
                  if (e.target.value === '__NEW_GROUP__') {
                    setIsCustomGroup(true)
                    setCustomGroupName('')
                  } else {
                    setFormData({ ...formData, work_group: e.target.value })
                  }
                }}
                className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-amber-400"
              >
                {(formData.admin_center === 'CONTRATISTA' ? availableContractorGroups : availableTallerGroups).map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
                <option value="__NEW_GROUP__">➕ Cargar nuevo grupo...</option>
              </select>
            </div>
          ) : (
            <div className="flex gap-2">
              <input
                type="text"
                autoFocus
                placeholder="Nombre del nuevo grupo..."
                value={customGroupName}
                onChange={(e) => setCustomGroupName(e.target.value.toUpperCase())}
                className="flex-1 bg-slate-950 border border-amber-400 rounded-xl px-3 py-2 text-xs text-white uppercase font-bold focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setIsCustomGroup(false)}
                className="px-3 py-2 bg-slate-800 text-slate-300 text-xs rounded-xl hover:text-white"
              >
                Cancelar
              </button>
            </div>
          )}

          <div className="p-2.5 rounded-xl bg-slate-950/80 border border-amber-500/30 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-amber-300 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" />
                <span>Elementos de Seguridad (EPP)</span>
              </label>
              <span title={SAFETY_ITEMS_HELP_TEXT} className="text-[10px] text-cyan-400 cursor-help inline-flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" /> ¿Cómo computa?
              </span>
            </div>
            <select
              value={formData.safety_items}
              onChange={(e) => setFormData({ ...formData, safety_items: e.target.value })}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-amber-400"
            >
              {SAFETY_ITEMS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label} — {opt.shortDesc}</option>
              ))}
            </select>
            <p className="text-[10px] text-slate-400 leading-snug">
              Por defecto <strong>CONTRATISTA</strong> (se descuenta en Tesorería). Elegir <strong>ASTILLERO</strong> solo si está en zona gris y el astillero absorbe el EPP sin descontárselo.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
