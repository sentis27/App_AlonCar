import { Users, Save, X } from 'lucide-react'
import { ASTILLERO_BASE_CATEGORIES } from '../../lib/personalNominaHelpers'
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
  if (!isOpen) return null

  const permissions = [
    { key: 'can_withdraw_materials', label: <>Retirar de Pañol (<strong>P</strong>)</>, boxCls: 'text-emerald-300 hover:border-emerald-500/40', inputCls: 'text-emerald-500 accent-emerald-500' },
    { key: 'can_impute_hours', label: <>Imputar Horas (<strong>H</strong>)</>, boxCls: 'text-cyan-300 hover:border-cyan-500/40', inputCls: 'text-primary accent-primary' },
    { key: 'can_charge_third_party', label: <>Habilitado Terceros (<strong>3ros</strong>)</>, boxCls: 'text-purple-300 hover:border-purple-500/40', inputCls: 'text-purple-400 accent-purple-500' },
    { key: 'is_foreman', label: <>👷 Es Jefe de Obra (<strong>JO</strong>)</>, boxCls: 'text-amber-300 hover:border-amber-500/40', inputCls: 'text-amber-400 accent-amber-500' }
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="alon-modal-card">
        <div className="alon-modal-header">
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {editingWorker ? `Editar Operario: ${editingWorker.name}` : 'Cargar Nuevo Contratista / Operario'}
            </h3>
            <p className="text-[11px] text-slate-400">
              Los operarios y contratistas se imputan por <strong>Grupo de Trabajo</strong> para unificar la carga en Horas y Pañol.
            </p>
          </div>
          <button
            type="button"
            tabIndex={-1}
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="alon-modal-body grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
            <div className="space-y-3">
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

              <div className="alon-chunk-cyan space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-cyan-300 uppercase tracking-wider">
                    2. Identificación del Operario
                  </label>
                  <span className="text-[10px] font-mono text-cyan-400/80">Paso 2/5</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Nombre Completo:
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: JUAN PÉREZ"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white uppercase font-bold focus:outline-none focus:border-cyan-400"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Teléfono Móvil / WhatsApp:
                    </label>
                    <input
                      type="tel"
                      placeholder="Ej: +54 9 223 123-4567"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Estado Operativo:
                    </label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-cyan-400"
                    >
                      <option value="ACTIVO">🟢 ACTIVO</option>
                      <option value="INACTIVO">🔴 INACTIVO</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="alon-chunk-emerald space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-emerald-300 uppercase tracking-wider">
                    3. Especialidad y Categoría
                  </label>
                  <span className="text-[10px] font-mono text-emerald-400/80">Paso 3/5</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Rubro / Especialidad:
                    </label>
                    <select
                      value={formData.trade}
                      onChange={(e) => {
                        if (e.target.value === '__ADD_NEW_TRADE__') {
                          onOpenAddTradeModal()
                        } else {
                          setFormData({ ...formData, trade: e.target.value })
                        }
                      }}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-emerald-400"
                    >
                      {uniqueTrades.map((tr) => (
                        <option key={tr} value={tr}>{tr}</option>
                      ))}
                      <option value="__ADD_NEW_TRADE__">➕ Cargar nuevo rubro...</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-300 mb-1">
                      Categoría Sindical:
                    </label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold focus:outline-none focus:border-emerald-400"
                    >
                      {ASTILLERO_BASE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-300 mb-1">
                    Tarifa AR$/Hora:
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-slate-500 font-mono text-xs">$</span>
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
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-7 pr-3 py-2 text-xs text-white font-mono font-bold focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <p className="text-[10px] text-emerald-400/80 mt-1">
                    Equivalente: ${(dollarRate > 0 ? (formData.hourly_rate_ars / dollarRate).toFixed(2) : 0)} USD/h (Dólar: ${dollarRate})
                  </p>
                </div>
              </div>

              <div className="alon-chunk-purple space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black text-purple-300 uppercase tracking-wider">
                    4. Permisos Operativos & Habilitaciones
                  </label>
                  <span className="text-[10px] font-mono text-purple-400/80">Paso 4/5</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {permissions.map(({ key, label, boxCls, inputCls }) => (
                    <label
                      key={key}
                      className={`flex items-center gap-2 p-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs font-semibold cursor-pointer ${boxCls}`}
                    >
                      <input
                        type="checkbox"
                        checked={formData[key]}
                        onChange={(e) => setFormData({ ...formData, [key]: e.target.checked })}
                        className={`w-4 h-4 rounded border-slate-700 bg-slate-950 cursor-pointer ${inputCls}`}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="alon-modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={savingWorker}
              className="px-5 py-2 bg-gradient-to-r from-primary to-blue-500 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-cyan-500/20 hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{savingWorker ? 'Guardando...' : (editingWorker ? 'Guardar Cambios' : 'Registrar Operario')}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
