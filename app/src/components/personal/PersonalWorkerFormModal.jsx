import { Users, Save } from 'lucide-react'
import { ASTILLERO_BASE_CATEGORIES } from '../../lib/personalNominaHelpers'
import { PERSONAL_WORKER_STEP_HELP } from '../../lib/businessHelpRegistry.js'
import { CanonicalStepperModal, CanonicalStepperStep } from '../canonical/CanonicalStepperModal.jsx'
import PersonalWorkerCenterFields from './PersonalWorkerCenterFields'

export default function PersonalWorkerFormModal({
  isOpen,
  editingWorker,
  onClose,
  onSubmit,
  savingWorker,
  formData,
  setFormData,
  onAdminCenterChange,
  isCustomGroup,
  setIsCustomGroup,
  customGroupName,
  setCustomGroupName,
  availableContractorGroups,
  availableTallerGroups,
  uniqueTrades,
  dollarRate,
  onOpenAddTradeModal
}) {
  const permissions = [
    { key: 'can_withdraw_materials', label: <>Retirar de Pañol (<strong>P</strong>)</>, boxCls: 'text-emerald-300 hover:border-emerald-500/40', inputCls: 'text-emerald-500 accent-emerald-500' },
    { key: 'can_impute_hours', label: <>Imputar Horas (<strong>H</strong>)</>, boxCls: 'text-cyan-300 hover:border-cyan-500/40', inputCls: 'text-primary accent-primary' },
    { key: 'can_charge_third_party', label: <>Habilitado Terceros (<strong>3ros</strong>)</>, boxCls: 'text-purple-300 hover:border-purple-500/40', inputCls: 'text-purple-400 accent-purple-500' },
    { key: 'is_foreman', label: <>👷 Es Jefe de Obra (<strong>JO</strong>)</>, boxCls: 'text-amber-300 hover:border-amber-500/40', inputCls: 'text-amber-400 accent-amber-500' }
  ]

  return (
    <CanonicalStepperModal
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClass="max-w-5xl"
      icon={<Users className="w-4 h-4 text-primary" />}
      title={editingWorker ? `EDITAR OPERARIO — ${editingWorker.name}` : 'CARGAR NUEVO CONTRATISTA / OPERARIO'}
      onSubmit={onSubmit}
      footerLeft={
        <button type="button" onClick={onClose} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl cursor-pointer">
          Cancelar
        </button>
      }
      footerRight={
        <button type="submit" disabled={savingWorker} className="px-5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-emerald-500/20 flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
          <Save className="w-4 h-4" />
          <span>{savingWorker ? 'Guardando...' : (editingWorker ? 'Guardar Cambios' : 'Registrar Operario')}</span>
        </button>
      }
    >
      <CanonicalStepperStep step={1} helpEntry={PERSONAL_WORKER_STEP_HELP[1]} title="CENTRO ADMINISTRATIVO, GRUPO Y CONTRATO / EPP" subtitle="Origen ➔ Cuadrilla ➔ Reglas">
        <PersonalWorkerCenterFields
          formData={formData}
          setFormData={setFormData}
          onAdminCenterChange={onAdminCenterChange}
          isCustomGroup={isCustomGroup}
          setIsCustomGroup={setIsCustomGroup}
          customGroupName={customGroupName}
          setCustomGroupName={setCustomGroupName}
          availableContractorGroups={availableContractorGroups}
          availableTallerGroups={availableTallerGroups}
        />
      </CanonicalStepperStep>

      <CanonicalStepperStep step={2} helpEntry={PERSONAL_WORKER_STEP_HELP[2]} title="IDENTIFICACIÓN DEL OPERARIO">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
          <div className="md:col-span-6">
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Nombre Completo <span className="text-rose-400">*</span></label>
            <input type="text" autoFocus required placeholder="Ej: JUAN PÉREZ" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white uppercase font-bold focus:outline-none focus:border-cyan-400" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Teléfono / WhatsApp</label>
            <input type="tel" placeholder="+54 9 223 123-4567" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-mono focus:outline-none focus:border-cyan-400" />
          </div>
          <div className="md:col-span-3">
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Estado Operativo</label>
            <select value={formData.status} onChange={(e) => setFormData({ ...formData, status: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-400">
              <option value="ACTIVO">🟢 ACTIVO</option>
              <option value="INACTIVO">🔴 INACTIVO</option>
            </select>
          </div>
        </div>
      </CanonicalStepperStep>

      <CanonicalStepperStep step={3} helpEntry={PERSONAL_WORKER_STEP_HELP[3]} title="ESPECIALIDAD, CATEGORÍA Y TARIFA">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2.5 items-end">
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Rubro / Especialidad</label>
            <select
              value={formData.trade}
              onChange={(e) => {
                if (e.target.value === '__ADD_NEW_TRADE__') onOpenAddTradeModal()
                else setFormData({ ...formData, trade: e.target.value })
              }}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
            >
              {uniqueTrades.map((tr) => <option key={tr} value={tr}>{tr}</option>)}
              <option value="__ADD_NEW_TRADE__">➕ Cargar nuevo rubro...</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Categoría Sindical</label>
            <select value={formData.category} onChange={(e) => setFormData({ ...formData, category: e.target.value })} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:outline-none focus:border-cyan-400">
              {ASTILLERO_BASE_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-semibold text-slate-400 mb-1">Tarifa AR$/Hora</label>
            <div className="relative">
              <span className="absolute left-2.5 top-1.5 text-slate-500 font-mono text-xs">$</span>
              <input
                type="number"
                step="100"
                min="0"
                value={formData.hourly_rate_ars}
                onChange={(e) => {
                  const ars = parseFloat(e.target.value) || 0
                  const usd = dollarRate > 0 ? Number((ars / dollarRate).toFixed(2)) : 0
                  setFormData({ ...formData, hourly_rate_ars: ars, hourly_rate_usd: usd })
                }}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-6 pr-2.5 py-1.5 text-xs text-white font-mono font-bold focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>
          <div className="px-2.5 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-500/40 flex items-center justify-between text-xs">
            <span className="text-[10px] text-slate-400">USD/h (TC ${dollarRate})</span>
            <strong className="font-mono text-emerald-300">US$ {dollarRate > 0 ? (formData.hourly_rate_ars / dollarRate).toFixed(2) : '0.00'}</strong>
          </div>
        </div>
      </CanonicalStepperStep>

      <CanonicalStepperStep step={4} helpEntry={PERSONAL_WORKER_STEP_HELP[4]} title="PERMISOS OPERATIVOS Y HABILITACIONES" isLast={true}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {permissions.map(({ key, label, boxCls, inputCls }) => (
            <label key={key} className={`flex items-center gap-2 px-2.5 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-semibold cursor-pointer ${boxCls}`}>
              <input type="checkbox" checked={formData[key]} onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })} className={`w-4 h-4 rounded border-slate-700 bg-slate-950 cursor-pointer ${inputCls}`} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </CanonicalStepperStep>
    </CanonicalStepperModal>
  )
}
