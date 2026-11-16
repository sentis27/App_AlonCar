import { AlertTriangle, TrendingUp } from 'lucide-react'

const FLOW_STEPS = [
  {
    step: 1,
    title: 'Apertura y Asignación de OTs',
    desc: 'Jefes de Obra (Martín, Alejandro, Pablo) definen alcances para cada barco en astillero.'
  },
  {
    step: 2,
    title: 'Imputación de Horas & Pañol',
    desc: 'Carga diaria por operario/contratista y retiro de consumibles vinculados directamente al barco y OT.'
  },
  {
    step: 3,
    title: 'Auditoría Quincenal con Jorge y Graciela',
    desc: 'Validación de la regla dura: Material sin horas de contratista no se liquida hasta aclaración.'
  }
]

export default function DashboardOperationsGuide() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-slate-900/50 border border-slate-800 rounded-xl p-6">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Flujo de Operaciones Alon Car
        </h2>
        <div className="space-y-3 text-sm">
          {FLOW_STEPS.map((item) => (
            <div key={item.step} className="p-3 rounded-lg bg-slate-950/60 border border-slate-800/80 flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-cyan-950 text-cyan-400 flex items-center justify-center font-bold text-xs shrink-0">
                {item.step}
              </span>
              <div>
                <strong className="text-slate-200 block">{item.title}</strong>
                <p className="text-slate-400 text-xs">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-6 flex flex-col justify-between">
        <div>
          <h2 className="text-base font-bold text-white mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            Consistencia ERP
          </h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            El motor de base de datos en Supabase tiene activadas las restricciones de integridad y Row Level Security (RLS) para proteger los datos financieros y de cotización.
          </p>
        </div>
        <div className="pt-4 border-t border-slate-800/80 mt-6">
          <span className="text-[11px] text-slate-500">Versión App: 1.0.0-sprint1</span>
        </div>
      </div>
    </div>
  )
}
