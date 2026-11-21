import { Building2, Users, Calendar, Shield } from 'lucide-react'
import {
  CONTRACT_TYPES,
  SAFETY_ITEMS_OPTIONS,
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
    { key: 'ASTILLERO', desc: 'Propio', Icon: Building2, activeCls: 'bg-cyan-950/80 border-cyan-400 text-white ring-1 ring-cyan-400', iconCls: 'text-cyan-400' },
    { key: 'CONTRATISTA', desc: 'Cuadrillas', Icon: Users, activeCls: 'bg-amber-950/80 border-amber-400 text-white ring-1 ring-amber-400', iconCls: 'text-amber-400' },
    { key: 'TALLER', desc: 'Mecanizados', Icon: Building2, activeCls: 'bg-purple-950/80 border-purple-400 text-white ring-1 ring-purple-400', iconCls: 'text-purple-400' }
  ]

  const previewExp = formData.admin_center === 'ASTILLERO' && formData.contract_type
    ? computeContractExpiration(formData.contract_type, formData.contract_start_date)
    : null

  return (
    <div className="space-y-2.5">
      <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
        <div className="md:col-span-5">
          <label className="block text-[11px] font-semibold text-slate-400 mb-1">Centro Administrativo</label>
          <div className="grid grid-cols-3 gap-1.5">
            {centers.map(({ key, desc, Icon, activeCls, iconCls }) => {
              const active = formData.admin_center === key
              return (
                <button
                  key={key}
                  type="button"
                  tabIndex={-1}
                  onClick={() => onAdminCenterChange(key)}
                  className={`px-2 py-1.5 rounded-lg border text-left transition-all cursor-pointer flex items-center gap-1.5 ${
                    active ? activeCls : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 shrink-0 ${active ? iconCls : 'text-slate-500'}`} />
                  <div className="min-w-0">
                    <div className="font-extrabold text-[11px] leading-tight truncate">{key}</div>
                    <div className="text-[9px] text-slate-400 leading-tight truncate">{desc}</div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {formData.admin_center === 'ASTILLERO' ? (
          <>
            <div className="md:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
                <Calendar className="w-3 h-3 text-cyan-400" /><span>Tipo de Contrato (Alerta 7d antes)</span>
              </label>
              <select value={formData.contract_type} onChange={(e) => setFormData({ ...formData, contract_type: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-400">
                <option value="">Sin especificar...</option>
                {CONTRACT_TYPES.map((ct) => <option key={ct.value} value={ct.value}>{ct.label}</option>)}
              </select>
            </div>
            <div className="md:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Fecha Inicio Contrato</label>
              <input type="date" value={formData.contract_start_date} onChange={(e) => setFormData({ ...formData, contract_start_date: e.target.value })} onDoubleClick={(e) => e.currentTarget.showPicker?.()} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400" />
            </div>
          </>
        ) : (
          <>
            <div className="md:col-span-4">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Grupo de Trabajo / Contratista</label>
              {!isCustomGroup ? (
                <select
                  value={formData.work_group}
                  onChange={(e) => {
                    if (e.target.value === '__NEW_GROUP__') { setIsCustomGroup(true); setCustomGroupName('') }
                    else setFormData({ ...formData, work_group: e.target.value })
                  }}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-amber-400"
                >
                  {(formData.admin_center === 'CONTRATISTA' ? availableContractorGroups : availableTallerGroups).map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                  <option value="__NEW_GROUP__">➕ Cargar nuevo grupo...</option>
                </select>
              ) : (
                <div className="flex gap-1.5">
                  <input type="text" autoFocus placeholder="Nombre del nuevo grupo..." value={customGroupName} onChange={(e) => setCustomGroupName(e.target.value.toUpperCase())} className="flex-1 min-w-0 bg-slate-950 border border-amber-400 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase font-bold focus:outline-none" />
                  <button type="button" tabIndex={-1} onClick={() => setIsCustomGroup(false)} className="px-2.5 py-1.5 bg-slate-800 text-slate-300 text-xs rounded-lg hover:text-white cursor-pointer">✕</button>
                </div>
              )}
            </div>
            <div className="md:col-span-3">
              <label className="block text-[11px] font-semibold text-amber-300 mb-1 flex items-center gap-1">
                <Shield className="w-3 h-3" /><span>Elem. Seguridad (EPP)</span>
              </label>
              <select value={formData.safety_items} onChange={(e) => setFormData({ ...formData, safety_items: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-amber-400">
                {SAFETY_ITEMS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>
            </div>
          </>
        )}
      </div>

      {previewExp && (
        <div className="px-2.5 py-1 rounded-lg bg-slate-950/90 border border-cyan-500/30 text-[10px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
          <span>
            {previewExp.isPermanent
              ? 'Planta Permanente (no emite alerta de vencimiento).'
              : previewExp.expiresIso
              ? `Vence: ${previewExp.expiresIso} (${previewExp.daysRemaining} días restantes)`
              : 'Ingresá fecha de inicio para calcular vencimiento.'}
          </span>
          {previewExp.vacationDays !== null && (
            <span className="font-mono text-emerald-300 font-bold">Ref. Vacaciones: {previewExp.vacationDays} día(s)</span>
          )}
        </div>
      )}
    </div>
  )
}
