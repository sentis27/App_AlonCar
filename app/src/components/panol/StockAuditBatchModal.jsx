import { useMemo, useState } from 'react'
import { ClipboardCheck } from 'lucide-react'
import { CanonicalStepperModal, CanonicalStepperStep } from '../canonical/CanonicalStepperModal.jsx'
import { PANOL_STOCK_AUDIT_STEP_HELP } from '../../lib/businessHelpRegistry'
import { buildMergedRubrosCatalog } from '../../lib/panolCatalogService'
import { MATERIAL_CONDITION_LABELS } from '../../lib/stockControlService'
import { formatDateAr, getTodayArIso } from '../../lib/dateTimeCanonical'
import { formatUnitMeasureShort } from '../../lib/unitMeasureUtils'
import { matchesUniversalSearch } from '../../lib/searchEngine'

export default function StockAuditBatchModal({ materials = [], rubros = [], onClose, onSave }) {
  const [dateIso, setDateIso] = useState(() => getTodayArIso())
  const [selectedRubro, setSelectedRubro] = useState('TODOS')
  const [filterText, setFilterText] = useState('')
  const [onlyControlled, setOnlyControlled] = useState(true)
  const [applyAdjustments, setApplyAdjustments] = useState(true)
  const [countedById, setCountedById] = useState({})
  const [conditionById, setConditionById] = useState({})
  const [notesById, setNotesById] = useState({})
  const [localError, setLocalError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const rubroOptions = useMemo(() => buildMergedRubrosCatalog(rubros, materials), [rubros, materials])

  const visibleMaterials = useMemo(() => (materials || []).filter((mat) => {
    if (onlyControlled && !mat.requires_stock_control) return false
    const matRubro = String(mat.rubro || 'SIN RUBRO').toUpperCase()
    if (selectedRubro !== 'TODOS' && matRubro !== selectedRubro) return false
    if (!filterText.trim()) return true
    return matchesUniversalSearch(`${mat.name || ''} ${matRubro} ${mat.category || ''}`, filterText)
  }), [materials, onlyControlled, selectedRubro, filterText])

  const draftSummary = useMemo(() => {
    const rows = []
    let okCount = 0
    let discrepancyCount = 0
    for (const mat of materials || []) {
      const raw = countedById[mat.id]
      if (raw === undefined || raw === null || String(raw).trim() === '') continue
      const counted = Number(raw)
      if (!Number.isFinite(counted)) continue
      const sysQty = Number(mat.current_stock) || 0
      const delta = Number((counted - sysQty).toFixed(3))
      if (Math.abs(delta) <= 0.0005) okCount += 1
      else discrepancyCount += 1
      rows.push({
        material_id: mat.id,
        material: mat,
        system_quantity: sysQty,
        counted_quantity: counted,
        material_condition: conditionById[mat.id] || 'DISPONIBLE',
        notes: notesById[mat.id] || ''
      })
    }
    return { rows, okCount, discrepancyCount }
  }, [materials, countedById, conditionById, notesById])

  const handleMatchVisibleToSystem = () => {
    setCountedById((prev) => {
      const next = { ...prev }
      for (const m of visibleMaterials) {
        if (next[m.id] === undefined || String(next[m.id]).trim() === '') {
          next[m.id] = String(Number(m.current_stock) || 0)
        }
      }
      return next
    })
    setLocalError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    setLocalError('')
    if (draftSummary.rows.length === 0) {
      return setLocalError('Ingresá el conteo físico en al menos un material antes de confirmar.')
    }
    try {
      setIsSubmitting(true)
      await onSave({ rows: draftSummary.rows, applyAdjustments, date: dateIso })
    } catch (err) {
      setLocalError(err?.message || 'Error guardando el control físico de stock.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <CanonicalStepperModal
      isOpen={true}
      onClose={onClose}
      maxWidthClass="max-w-5xl"
      icon={<ClipboardCheck className="w-5 h-5 text-cyan-400" />}
      title="NUEVO CONTROL FÍSICO DE STOCK POR RUBRO"
      subtitle="Registrá recuentos reales de estantería y generá ajustes automáticos AUDIT_CORRECTION"
      onSubmit={handleSubmit}
      footerLeft={
        <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer">
          Cancelar
        </button>
      }
      footerRight={
        <button
          type="submit"
          disabled={isSubmitting || draftSummary.rows.length === 0}
          className="px-4 py-1.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black cursor-pointer shadow-lg shadow-cyan-600/20 disabled:opacity-40"
        >
          {isSubmitting ? 'Registrando...' : `Confirmar Control (${draftSummary.rows.length})`}
        </button>
      }
    >
      {localError && (
        <div className="px-3 py-2 rounded-lg bg-rose-950/90 border border-rose-500/70 text-rose-200 text-xs font-bold">
          {localError}
        </div>
      )}

      <CanonicalStepperStep step={1} helpEntry={PANOL_STOCK_AUDIT_STEP_HELP[1]} title="ALCANCE, RUBRO Y AJUSTE AUTOMÁTICO">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2.5">
          <div>
            <label className="block text-slate-300 font-semibold text-[11px] mb-1">Fecha ({formatDateAr(dateIso)})</label>
            <input
              type="date"
              value={dateIso}
              onChange={(e) => setDateIso(e.target.value || getTodayArIso())}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div>
            <label className="block text-slate-300 font-semibold text-[11px] mb-1">Rubro Técnico</label>
            <select
              value={selectedRubro}
              onChange={(e) => setSelectedRubro(e.target.value)}
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-cyan-300 font-bold text-xs focus:outline-none focus:border-cyan-400"
            >
              <option value="TODOS">Todos los Rubros</option>
              {rubroOptions.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-slate-300 font-semibold text-[11px] mb-1">Filtrar Material</label>
            <input
              type="text"
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              placeholder="Ej: chapa, electrodo, disco..."
              className="w-full px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>
          <div className="flex flex-col justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800">
            <label className="inline-flex items-center gap-2 text-[11px] text-slate-200 font-semibold cursor-pointer">
              <input type="checkbox" checked={onlyControlled} onChange={(e) => setOnlyControlled(e.target.checked)} className="accent-cyan-400" />
              <span>Solo Control de Stock</span>
            </label>
            <label className="inline-flex items-center gap-2 text-[11px] text-emerald-300 font-bold cursor-pointer" title="Genera movimientos compensatorios AUDIT_CORRECTION sobre cada diferencia detectada">
              <input type="checkbox" checked={applyAdjustments} onChange={(e) => setApplyAdjustments(e.target.checked)} className="accent-emerald-400" />
              <span>Ajustar diferencias auto</span>
            </label>
          </div>
        </div>
      </CanonicalStepperStep>

      <CanonicalStepperStep
        step={2}
        helpEntry={PANOL_STOCK_AUDIT_STEP_HELP[2]}
        title={`RECUENTO FÍSICO (${visibleMaterials.length} visibles)`}
        isLast={true}
        headerRight={
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleMatchVisibleToSystem}
              className="px-2 py-0.5 rounded bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 font-bold text-[10px] cursor-pointer"
            >
              Igualar visibles al sistema
            </button>
            <button
              type="button"
              onClick={() => { setCountedById({}); setLocalError('') }}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-[10px] cursor-pointer"
            >
              Limpiar conteos
            </button>
          </div>
        }
      >
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 max-h-[34vh] overflow-y-auto">
          <table className="w-full text-left text-[11px] border-collapse">
            <thead className="sticky top-0 z-10 bg-slate-900 text-slate-400 uppercase font-mono text-[10px] border-b border-slate-800">
              <tr>
                <th className="py-2 px-2.5">Material</th>
                <th className="py-2 px-2">Rubro</th>
                <th className="py-2 px-2 text-right">Sistema</th>
                <th className="py-2 px-2 text-right w-28">Conteo Físico</th>
                <th className="py-2 px-2 text-right">Dif.</th>
                <th className="py-2 px-2">Condición</th>
                <th className="py-2 px-2">Notas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {visibleMaterials.length === 0 ? (
                <tr><td colSpan={7} className="py-6 text-center text-slate-500">Sin materiales que coincidan con el rubro o filtro actual.</td></tr>
              ) : (
                visibleMaterials.map((mat) => {
                  const unitShort = formatUnitMeasureShort(mat.unit_measure)
                  const sysQty = Number(mat.current_stock) || 0
                  const rawCounted = countedById[mat.id] ?? ''
                  const hasVal = String(rawCounted).trim() !== '' && Number.isFinite(Number(rawCounted))
                  const delta = hasVal ? Number((Number(rawCounted) - sysQty).toFixed(3)) : null
                  const isOk = delta !== null && Math.abs(delta) <= 0.0005
                  return (
                    <tr key={mat.id} className={hasVal ? (isOk ? 'bg-emerald-950/15' : 'bg-amber-950/20') : 'hover:bg-slate-900/60'}>
                      <td className="py-1.5 px-2.5 font-bold text-white max-w-[200px] truncate" title={mat.name}>{mat.name}</td>
                      <td className="py-1.5 px-2 text-slate-400 truncate max-w-[110px]">{mat.rubro || '—'}</td>
                      <td className="py-1.5 px-2 text-right font-mono text-slate-300 whitespace-nowrap">{sysQty} {unitShort}</td>
                      <td className="py-1.5 px-2 text-right">
                        <input
                          type="number"
                          step="any"
                          value={rawCounted}
                          onChange={(e) => setCountedById((prev) => ({ ...prev, [mat.id]: e.target.value }))}
                          placeholder="—"
                          className="w-24 px-2 py-1 rounded bg-slate-900 border border-slate-700 text-white font-mono text-right focus:outline-none focus:border-cyan-400"
                        />
                      </td>
                      <td className="py-1.5 px-2 text-right font-mono font-bold whitespace-nowrap">
                        {delta === null ? <span className="text-slate-600">—</span> : isOk ? <span className="text-emerald-300">OK</span> : <span className={delta > 0 ? 'text-cyan-300' : 'text-rose-300'}>{delta > 0 ? `+${delta}` : delta}</span>}
                      </td>
                      <td className="py-1.5 px-2">
                        <select
                          value={conditionById[mat.id] || 'DISPONIBLE'}
                          onChange={(e) => setConditionById((prev) => ({ ...prev, [mat.id]: e.target.value }))}
                          className="px-1.5 py-1 rounded bg-slate-900 border border-slate-700 text-[10px] text-slate-200 focus:outline-none"
                        >
                          {Object.entries(MATERIAL_CONDITION_LABELS).map(([k, lbl]) => <option key={k} value={k}>{lbl}</option>)}
                        </select>
                      </td>
                      <td className="py-1.5 px-2">
                        <input
                          type="text"
                          value={notesById[mat.id] || ''}
                          onChange={(e) => setNotesById((prev) => ({ ...prev, [mat.id]: e.target.value }))}
                          placeholder="Obs..."
                          className="w-full min-w-[110px] px-2 py-1 rounded bg-slate-900 border border-slate-700 text-[10.5px] text-slate-200 focus:outline-none focus:border-cyan-400"
                        />
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-[11px]">
          <span className="text-slate-300">Contados: <strong className="text-white">{draftSummary.rows.length}</strong> ítem(s)</span>
          <span className="text-emerald-300 font-bold">OK exactos: {draftSummary.okCount}</span>
          <span className="text-amber-300 font-bold">Con diferencia: {draftSummary.discrepancyCount}</span>
          <span className={applyAdjustments ? 'text-cyan-300 font-bold' : 'text-slate-400'}>
            Ajuste en BD: {applyAdjustments ? 'SÍ (AUDIT_CORRECTION)' : 'NO (solo auditoría)'}
          </span>
        </div>
      </CanonicalStepperStep>
    </CanonicalStepperModal>
  )
}
