import { Briefcase, Settings, Save, X } from 'lucide-react'

export default function PersonalAuxModals({
  isAddTradeModalOpen,
  setIsAddTradeModalOpen,
  newTradeInput,
  setNewTradeInput,
  onAddTradeSubmit,
  isRolesModalOpen,
  setIsRolesModalOpen,
  rolesFormData,
  setRolesFormData,
  savingRoles,
  onSaveRolesSubmit
}) {
  return (
    <>
      {isAddTradeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 relative">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 rounded-lg bg-cyan-950 text-cyan-400 border border-cyan-800">
                  <Briefcase className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-white">Agregar Nuevo Rubro Operativo</h3>
                  <p className="text-[11px] text-slate-400">Se estandarizará automáticamente en mayúsculas</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddTradeModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={onAddTradeSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Nombre del Rubro
                </label>
                <input
                  type="text"
                  autoFocus
                  placeholder="Ej: HIDRAULICA NAVAL, CALDERERIA PESADA"
                  value={newTradeInput}
                  onChange={(e) => setNewTradeInput(e.target.value.toUpperCase())}
                  className="w-full bg-slate-950 border border-cyan-500 rounded-xl px-3 py-2 text-sm font-bold text-white uppercase focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
                />
              </div>

              {newTradeInput.trim() && (
                <div className="p-2.5 rounded-lg bg-cyan-950/40 border border-cyan-800/60 text-[11px] text-cyan-300">
                  Vista previa estandarizada: <strong>{newTradeInput.trim().toUpperCase()}</strong>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddTradeModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-950 bg-gradient-to-r from-primary to-blue-500 hover:brightness-110 shadow-md cursor-pointer"
                >
                  Guardar Rubro
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isRolesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl p-6 relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3 mb-4">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-emerald-400" />
                  Administrar Puestos y Titulares Organizacionales
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Modificá los nombres de las personas a cargo sin generar deuda técnica ni alterar el código.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRolesModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={onSaveRolesSubmit} className="space-y-4">
              {Object.entries(rolesFormData).map(([key, item]) => (
                <div key={key} className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                  <span className="text-[10px] font-mono font-bold text-cyan-400 uppercase tracking-wider block">
                    {key}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 font-bold mb-1">
                        Nombre Técnico del Puesto
                      </label>
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => {
                          const val = e.target.value
                          setRolesFormData((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], title: val }
                          }))
                        }}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-medium focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-emerald-400 font-bold mb-1">
                        Persona Titular
                      </label>
                      <input
                        type="text"
                        value={item.holder}
                        onChange={(e) => {
                          const val = e.target.value
                          setRolesFormData((prev) => ({
                            ...prev,
                            [key]: { ...prev[key], holder: val }
                          }))
                        }}
                        className="w-full bg-slate-900 border border-emerald-800/80 rounded-lg px-2.5 py-1.5 text-xs text-emerald-300 font-bold focus:outline-none focus:border-emerald-400"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRolesModalOpen(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingRoles}
                  className="px-5 py-2 bg-gradient-to-r from-emerald-500 to-teal-500 text-slate-950 text-xs font-extrabold rounded-lg shadow-md hover:brightness-110 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{savingRoles ? 'Guardando...' : 'Guardar Cambios de Puestos'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
