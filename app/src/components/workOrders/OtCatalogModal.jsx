import { useMemo, useState } from 'react'
import { Sparkles, X, Pencil, Trash2, Layers, Plus } from 'lucide-react'
import OtCatalogEditor from './OtCatalogEditor'
import {
  OT_ABC_CATEGORIES,
  OT_ABC_TAX_OPTIONS,
  buildOperationalSelectionFromTemplate,
  computeTemplateTaxSummary,
  normalizeOtAbcCategory
} from '../../lib/otAbcCatalogConstants'

const CATEGORY_FILTER_OPTIONS = ['TODAS', 'Renovación', 'Intermedia', 'Ambas', 'SIN_CLASIFICAR']

const CATEGORY_BADGE_LABELS = {
  TODAS: 'Todas',
  Renovación: 'Renovación',
  Intermedia: 'Intermedia',
  Ambas: 'Ambas',
  SIN_CLASIFICAR: 'Sin clasificar'
}

/**
 * Modal modular del Catálogo de Trabajos (OT.ABC).
 * Permite clasificar manualmente por desplegable (Renovación / Intermedia / Ambas),
 * editar textos fijos + tarifario + IVA (OtCatalogEditor) o importar descripciones hacia /ots.
 */
export default function OtCatalogModal({
  isOpen,
  onClose,
  templates = [],
  user,
  loadData,
  showWoGridFeedback,
  onUseSingleTemplate,
  onConfirmMultiSelection,
  onSaveTemplate,
  onUpdateCategory,
  onDeleteTemplate
}) {
  const [templateEdit, setTemplateEdit] = useState(null)
  const [templateSearch, setTemplateSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('TODAS')
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [updatingCatId, setUpdatingCatId] = useState(null)
  const [selectedIds, setSelectedIds] = useState([])

  const filteredTemplates = useMemo(() => {
    const q = templateSearch.trim().toLowerCase()
    return templates.filter((tpl) => {
      const cat = normalizeOtAbcCategory(tpl.category)
      if (categoryFilter === 'SIN_CLASIFICAR' && cat !== null) return false
      if (categoryFilter !== 'TODAS' && categoryFilter !== 'SIN_CLASIFICAR') {
        if (cat !== categoryFilter && cat !== 'Ambas') return false
      }
      if (!q) return true
      const text = `${tpl.name || ''} ${tpl.description || ''} ${tpl.fixed_notes || ''}`.toLowerCase()
      return text.includes(q)
    })
  }, [templates, templateSearch, categoryFilter])

  if (!isOpen) return null

  const toggleSelect = (tplId) => {
    setSelectedIds((prev) =>
      prev.includes(tplId) ? prev.filter((id) => id !== tplId) : [...prev, tplId]
    )
  }

  const handleConfirmSelected = () => {
    const chosen = templates
      .filter((t) => selectedIds.includes(t.id))
      .map((t) => buildOperationalSelectionFromTemplate(t))
    if (chosen.length === 0) return
    setSelectedIds([])
    onConfirmMultiSelection(chosen)
  }

  const handleQuickCategoryChange = async (tpl, nextCat) => {
    setUpdatingCatId(tpl.id)
    try {
      await onUpdateCategory(tpl, nextCat || null, user)
      await loadData()
      showWoGridFeedback('success', `${tpl.name} clasificada como "${nextCat || 'Sin clasificar'}".`)
    } catch (err) {
      showWoGridFeedback('error', 'Error al clasificar: ' + err.message)
    } finally {
      setUpdatingCatId(null)
    }
  }

  const handleSaveEditor = async (draft) => {
    setSavingTemplate(true)
    try {
      await onSaveTemplate(draft, templates.length, user)
      setTemplateEdit(null)
      await loadData()
      showWoGridFeedback('success', 'Plantilla guardada en Catálogo OT.ABC.')
    } catch (err) {
      showWoGridFeedback('error', 'Error al guardar plantilla: ' + err.message)
    } finally {
      setSavingTemplate(false)
    }
  }

  const handleDelete = async (tpl) => {
    if (!window.confirm(`¿Eliminar "${tpl.name}" del catálogo?`)) return
    try {
      await onDeleteTemplate(tpl.id, tpl.name, user)
      setSelectedIds((prev) => prev.filter((id) => id !== tpl.id))
      await loadData()
      showWoGridFeedback('info', 'Plantilla eliminada del catálogo.')
    } catch (err) {
      showWoGridFeedback('error', err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-2.5 sm:p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150 font-sans">
      <div className="alon-modal-card alon-modal-zeroscroll max-w-6xl">
        <div className="alon-modal-header py-2.5 px-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white truncate">
                {templateEdit ? `Editar OT.ABC: ${templateEdit.name || 'NUEVA'}` : 'Catálogo de Trabajos (OT.ABC)'}
              </h3>
              <p className="text-[10px] text-slate-400 truncate">
                Tarifario, textos fijos, IVA y agrupación manual (Renovación / Intermedia / Ambas). Al usar en /ots solo importa la descripción.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setTemplateEdit(null); onClose() }}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {templateEdit ? (
          <OtCatalogEditor
            initialDraft={templateEdit}
            saving={savingTemplate}
            onCancel={() => setTemplateEdit(null)}
            onSave={handleSaveEditor}
          />
        ) : (
          <div className="alon-modal-body p-3 space-y-3">
            {/* Barra de búsqueda + filtros de agrupación + botón Nueva */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <input
                type="text"
                value={templateSearch}
                onChange={(e) => setTemplateSearch(e.target.value)}
                placeholder="Buscar OT.ABC o descripción..."
                className="flex-1 min-w-[200px] bg-slate-950 border border-slate-700 rounded-xl px-3 py-1.5 text-white focus:border-amber-400 focus:outline-none"
              />
              <div className="flex flex-wrap items-center gap-1">
                {CATEGORY_FILTER_OPTIONS.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setCategoryFilter(opt)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                      categoryFilter === opt
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                    }`}
                  >
                    {CATEGORY_BADGE_LABELS[opt]}
                  </button>
                ))}
              </div>
              {selectedIds.length > 0 && (
                <button
                  type="button"
                  onClick={handleConfirmSelected}
                  className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-xl cursor-pointer"
                >
                  Abrir {selectedIds.length} OTs
                </button>
              )}
              <button
                type="button"
                onClick={() => setTemplateEdit({ name: '', description: '', category: '', line_items: [] })}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-600 rounded-xl font-bold flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Nueva</span>
              </button>
            </div>

            {/* Listado de OT.ABC */}
            <div className="space-y-1.5 max-h-[60vh] overflow-y-auto pr-1 text-xs">
              {filteredTemplates.map((tpl) => {
                const summary = computeTemplateTaxSummary(tpl)
                const taxOpt = OT_ABC_TAX_OPTIONS.find((o) => o.value === summary.taxMode) || OT_ABC_TAX_OPTIONS[0]
                const catVal = normalizeOtAbcCategory(tpl.category) || ''
                const isChecked = selectedIds.includes(tpl.id)

                return (
                  <div
                    key={tpl.id}
                    className={`p-2.5 rounded-2xl border flex flex-wrap items-center justify-between gap-2 transition-colors ${
                      isChecked ? 'bg-purple-950/30 border-purple-500/60' : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleSelect(tpl.id)}
                        className="w-3.5 h-3.5 rounded accent-purple-500 shrink-0 cursor-pointer"
                        title="Seleccionar para abrir en lote"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-black text-white uppercase tracking-tight">{tpl.name}</span>
                          <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${taxOpt.badgeClass}`}>
                            {taxOpt.shortLabel}
                          </span>
                          <span className="px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-[10px] text-slate-300 font-mono">
                            {summary.itemCount} ítem{summary.itemCount === 1 ? '' : 's'} · {summary.pricedCount} con US$
                          </span>
                          {summary.subworkCount > 0 && (
                            <span className="px-1.5 py-0.5 rounded bg-amber-500/20 border border-amber-400/50 text-[10px] text-amber-200 font-bold flex items-center gap-1">
                              <Layers className="w-3 h-3" />
                              {summary.subworkCount} sub-trabajos
                            </span>
                          )}
                        </div>
                        {tpl.description && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{tpl.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <select
                        value={catVal}
                        disabled={updatingCatId === tpl.id}
                        onChange={(e) => handleQuickCategoryChange(tpl, e.target.value)}
                        title="Clasificar manualmente (Renovación / Intermedia / Ambas)"
                        className="bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-200 focus:border-amber-400 focus:outline-none cursor-pointer"
                      >
                        <option value="">Sin clasificar</option>
                        {OT_ABC_CATEGORIES.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>

                      <button
                        type="button"
                        onClick={() => onUseSingleTemplate(tpl)}
                        className="px-2.5 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 rounded-lg font-bold cursor-pointer"
                        title="Importar descripción técnica a una OT operativa"
                      >
                        Usar
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemplateEdit(tpl)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 cursor-pointer"
                        title="Editar texto, tarifario US$ e IVA"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(tpl)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg hover:bg-rose-500/10 cursor-pointer"
                        title="Eliminar plantilla"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
