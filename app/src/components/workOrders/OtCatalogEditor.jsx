import { useState } from 'react'
import { RefreshCw, ArrowLeft, Save } from 'lucide-react'
import { OT_CATALOG_STEP_HELP } from '../../lib/businessHelpRegistry.js'
import { CanonicalStepperStep } from '../canonical/CanonicalStepperModal.jsx'
import OtCatalogLineItemsTable from './OtCatalogLineItemsTable'
import {
  OT_ABC_CATEGORIES,
  OT_ABC_DATA_SOURCES,
  OT_ABC_TAX_OPTIONS,
  buildBillingDescriptionFromLines,
  computeTemplateTaxSummary,
  createEmptyOtAbcLineItem,
  normalizeOtAbcLineItems
} from '../../lib/otAbcCatalogConstants'

/**
 * Editor completo de una plantilla OT.ABC (Stepper Vertical Zero-Scroll 1 ➔ 2 ➔ 3).
 */
export default function OtCatalogEditor({
  initialDraft,
  saving = false,
  onCancel,
  onSave
}) {
  const [draft, setDraft] = useState(() => ({
    id: initialDraft?.id || null,
    name: String(initialDraft?.name || '').toUpperCase(),
    category: initialDraft?.category === 'Intermediaria' ? 'Intermedia' : (initialDraft?.category || ''),
    description: initialDraft?.description || '',
    description_billing: initialDraft?.description_billing || '',
    fixed_notes: initialDraft?.fixed_notes || '',
    default_tax_type: initialDraft?.default_tax_type || 'EXENTO',
    default_data_source: initialDraft?.default_data_source || 'JEFE_DE_OBRA',
    line_items: normalizeOtAbcLineItems(initialDraft?.line_items)
  }))

  const taxSummary = computeTemplateTaxSummary(draft)

  const updateLine = (idx, patch) => {
    setDraft((prev) => ({
      ...prev,
      line_items: prev.line_items.map((item, i) => (i === idx ? { ...item, ...patch } : item))
    }))
  }

  const addLine = (rowType = 'ITEM') => {
    setDraft((prev) => ({
      ...prev,
      line_items: [...prev.line_items, createEmptyOtAbcLineItem(rowType, prev, prev.line_items.length)]
    }))
  }

  const removeLine = (idx) => {
    setDraft((prev) => ({
      ...prev,
      line_items: prev.line_items.filter((_, i) => i !== idx).map((item, i) => ({ ...item, sort_order: i + 1 }))
    }))
  }

  const handleSyncBillingDescription = () => {
    const generated = buildBillingDescriptionFromLines(draft.line_items, draft.fixed_notes)
    if (generated) setDraft((prev) => ({ ...prev, description_billing: generated }))
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onSave(draft)
      }}
      className="flex flex-col flex-1 min-h-0 text-xs"
    >
      <div className="p-4 sm:px-6 space-y-3.5 overflow-visible">
        <CanonicalStepperStep
          step={1}
          helpEntry={OT_CATALOG_STEP_HELP[1]}
          title="IDENTIDAD, CLASIFICACIÓN Y PARÁMETROS FISCALES"
          headerRight={
            <button type="button" tabIndex={-1} onClick={onCancel} className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer">
              <ArrowLeft className="w-3.5 h-3.5" /><span>Volver al listado</span>
            </button>
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
            <div className="sm:col-span-5">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Nombre OT.ABC <span className="text-rose-400">*</span></label>
              <input type="text" required autoFocus value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value.toUpperCase() }))} onBlur={() => setDraft((p) => ({ ...p, name: p.name.trim().toUpperCase() }))} placeholder="Ej: DESMONTE LINEA EJE Y TIMON" className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-black uppercase focus:border-cyan-400 focus:outline-none" />
            </div>
            <div className="sm:col-span-3">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Clasificación</label>
              <select value={draft.category} onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:border-cyan-400 focus:outline-none">
                <option value="">-- Sin clasificar --</option>
                {OT_ABC_CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">IVA General</label>
              <select value={draft.default_tax_type} onChange={(e) => setDraft((p) => ({ ...p, default_tax_type: e.target.value }))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white font-bold focus:border-cyan-400 focus:outline-none">
                {OT_ABC_TAX_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.shortLabel}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">Origen Base</label>
              <select value={draft.default_data_source} onChange={(e) => setDraft((p) => ({ ...p, default_data_source: e.target.value }))} className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-rose-300 font-bold focus:border-cyan-400 focus:outline-none">
                {OT_ABC_DATA_SOURCES.map((src) => <option key={src.value} value={src.value}>{src.shortLabel}</option>)}
              </select>
            </div>
          </div>
        </CanonicalStepperStep>

        <CanonicalStepperStep
          step={2}
          helpEntry={OT_CATALOG_STEP_HELP[2]}
          title="DESCRIPCIÓN OPERATIVA (/ots) vs FACTURACIÓN (description_billing)"
          subtitle="Operativa va al taller · Billing entra automático a Facturación"
          headerRight={
            <button type="button" tabIndex={-1} onClick={handleSyncBillingDescription} className="px-2 py-0.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-200 border border-emerald-500/40 text-[10px] font-bold flex items-center gap-1 cursor-pointer">
              <RefreshCw className="w-3 h-3" /><span>Generar Billing desde renglones</span>
            </button>
          }
        >
          <div className="grid grid-cols-1 md:grid-cols-12 gap-2.5">
            <div className="md:col-span-4 space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-amber-300">
                Operativa (Taller / `/ots`)
              </label>
              <textarea rows={3} value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} placeholder="Detalle corto y claro para el equipo de obra..." className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-amber-400 focus:outline-none" />
            </div>
            <div className="md:col-span-5 space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                Facturación (`description_billing`)
              </label>
              <textarea rows={3} value={draft.description_billing} onChange={(e) => setDraft((p) => ({ ...p, description_billing: e.target.value }))} placeholder="Prosa comercial completa que se importa automáticamente a la Sábana Blanca..." className="w-full bg-slate-950 border border-emerald-500/40 rounded-lg px-2.5 py-1.5 text-xs text-white focus:border-emerald-400 focus:outline-none" />
            </div>
            <div className="md:col-span-3 space-y-1">
              <label className="block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                Notas Fijas / Exclusiones
              </label>
              <textarea rows={3} value={draft.fixed_notes} onChange={(e) => setDraft((p) => ({ ...p, fixed_notes: e.target.value }))} placeholder="Ej: Provisión del armador..." className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:border-cyan-400 focus:outline-none" />
            </div>
          </div>
        </CanonicalStepperStep>

        <CanonicalStepperStep step={3} helpEntry={OT_CATALOG_STEP_HELP[3]} title={`RENGLONES TABULADOS (${draft.line_items.length})`} isLast={true}>
          <div className="max-h-[34vh] overflow-y-auto pr-1">
            <OtCatalogLineItemsTable
              lineItems={draft.line_items}
              taxSummary={taxSummary}
              onAddLine={addLine}
              onUpdateLine={updateLine}
              onRemoveLine={removeLine}
            />
          </div>
        </CanonicalStepperStep>
      </div>

      <div className="alon-modal-footer">
        <button type="button" onClick={onCancel} className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl font-bold cursor-pointer">Cancelar</button>
        <button type="submit" disabled={saving} className="px-5 py-1.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black rounded-xl cursor-pointer flex items-center gap-1.5 shadow-lg shadow-emerald-500/20">
          <Save className="w-4 h-4" />
          <span>{saving ? 'Guardando...' : 'Guardar en Catálogo OT.ABC'}</span>
        </button>
      </div>
    </form>
  )
}
