import { useState, useMemo } from 'react'
import { Scale, Plus, Minus, ArrowLeftRight } from 'lucide-react'
import { CanonicalStepperModal, CanonicalStepperStep } from '../canonical/CanonicalStepperModal.jsx'
import CanonicalMaterialPicker from '../canonical/CanonicalMaterialPicker.jsx'
import { PANOL_STOCK_ADJUST_STEP_HELP } from '../../lib/businessHelpRegistry'
import { STOCK_REASON_LABELS, MATERIAL_CONDITION_LABELS } from '../../lib/stockControlService'
import { formatDateAr, getTodayArIso } from '../../lib/dateTimeCanonical'
import { formatUnitMeasureShort } from '../../lib/unitMeasureUtils'

const MODE_OPTIONS = [
  { id: 'ENTRY', label: '+ Entrada', icon: Plus, defaultReason: 'MANUAL_ENTRY', reasons: ['MANUAL_ENTRY', 'RECOVERY', 'INITIALIZATION', 'OTHER'], activeCls: 'bg-emerald-500 text-slate-950 border-emerald-400' },
  { id: 'EXIT', label: '− Salida / Merma', icon: Minus, defaultReason: 'MANUAL_EXIT', reasons: ['MANUAL_EXIT', 'DAMAGE', 'OTHER'], activeCls: 'bg-rose-500 text-slate-950 border-rose-400' },
  { id: 'RECOUNT', label: '⚖️ Recuento físico', icon: ArrowLeftRight, defaultReason: 'AUDIT_CORRECTION', reasons: ['AUDIT_CORRECTION', 'INITIALIZATION', 'OTHER'], activeCls: 'bg-cyan-500 text-slate-950 border-cyan-400' }
]

export default function StockAdjustModal({ material = null, materials = [], initialMode = null, onClose, onSave }) {
  const defaultMode = initialMode || (material?.id ? 'RECOUNT' : 'ENTRY')
  const defaultCfg = MODE_OPTIONS.find((m) => m.id === defaultMode) || MODE_OPTIONS[0]

  const [mode, setMode] = useState(defaultCfg.id)
  const [selectedMaterialId, setSelectedMaterialId] = useState(material?.id || '')
  const [isChangingMaterial, setIsChangingMaterial] = useState(!material?.id)
  const [quantity, setQuantity] = useState(() => (defaultCfg.id === 'RECOUNT' && material ? String(material.current_stock ?? 0) : ''))
  const [dateIso, setDateIso] = useState(() => getTodayArIso())
  const [reasonType, setReasonType] = useState(defaultCfg.defaultReason)
  const [materialCondition, setMaterialCondition] = useState('DISPONIBLE')
  const [notes, setNotes] = useState('')
  const [localError, setLocalError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const selectedMat = useMemo(
    () => (material?.id && material.id === selectedMaterialId ? material : materials.find((m) => m.id === selectedMaterialId) || material || null),
    [material, materials, selectedMaterialId]
  )
  const modeCfg = MODE_OPTIONS.find((m) => m.id === mode) || MODE_OPTIONS[0]
  const unitShort = formatUnitMeasureShort(selectedMat?.unit_measure)

  const handleModeChange = (nextModeId) => {
    const cfg = MODE_OPTIONS.find((m) => m.id === nextModeId) || MODE_OPTIONS[0]
    setMode(nextModeId)
    setReasonType(cfg.defaultReason)
    setLocalError('')
    if (nextModeId === 'RECOUNT' && selectedMat) setQuantity(String(selectedMat.current_stock ?? 0))
    else if (mode === 'RECOUNT') setQuantity('')
  }

  const preview = useMemo(() => {
    const current = Number(selectedMat?.current_stock) || 0
    const parsed = Number(quantity)
    const hasNum = quantity !== '' && Number.isFinite(parsed)
    let delta = 0
    if (hasNum) {
      if (mode === 'ENTRY') delta = parsed > 0 ? parsed : 0
      else if (mode === 'EXIT') delta = parsed > 0 ? -parsed : 0
      else delta = parsed - current
    }
    return { current, delta: Number(delta.toFixed(3)), next: Number((current + delta).toFixed(3)) }
  }, [selectedMat, quantity, mode])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    setLocalError('')
    if (!selectedMat?.id) return setLocalError('Seleccioná un material para registrar el movimiento.')
    const parsed = Number(quantity)
    if (quantity === '' || !Number.isFinite(parsed)) return setLocalError('Ingresá un valor numérico válido.')
    if ((mode === 'ENTRY' || mode === 'EXIT') && parsed <= 0) return setLocalError('La cantidad debe ser mayor a 0.')
    try {
      setIsSubmitting(true)
      await onSave({ mode, materialId: selectedMat.id, material: selectedMat, quantity: parsed, date: dateIso, reasonType, materialCondition, notes })
    } catch (err) {
      setLocalError(err?.message || 'Error al registrar movimiento.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <CanonicalStepperModal
      isOpen={true}
      onClose={onClose}
      maxWidthClass="max-w-2xl"
      icon={<Scale className="w-5 h-5 text-emerald-400" />}
      title="ENTRADA, SALIDA O AJUSTE DE STOCK FÍSICO"
      subtitle="Impacto inmediato en Stock Físico (PostgreSQL) y trazabilidad en Kárdex"
      onSubmit={handleSubmit}
      footerLeft={
        <button type="button" onClick={onClose} className="px-3.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer">
          Cancelar
        </button>
      }
      footerRight={
        <button
          type="submit"
          disabled={isSubmitting}
          className="px-4 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50"
        >
          {isSubmitting ? 'Guardando...' : 'Confirmar Movimiento'}
        </button>
      }
    >
      {localError && (
        <div className="px-3 py-2 rounded-lg bg-rose-950/90 border border-rose-500/70 text-rose-200 text-xs font-bold">
          {localError}
        </div>
      )}

      <CanonicalStepperStep step={1} helpEntry={PANOL_STOCK_ADJUST_STEP_HELP[1]} title="MATERIAL Y TIPO DE MOVIMIENTO">
        <div className="space-y-2.5">
          {selectedMat && !isChangingMaterial ? (
            <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-950 border border-slate-800">
              <div className="min-w-0">
                <span className="font-bold text-white block truncate text-xs">{selectedMat.name}</span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {selectedMat.rubro || 'SIN RUBRO'} · Stock actual: <strong className="text-emerald-300">{selectedMat.current_stock} {unitShort}</strong> (Mín: {selectedMat.minimum_stock ?? 0})
                </span>
              </div>
              {materials.length > 0 && (
                <button
                  type="button"
                  onClick={() => setIsChangingMaterial(true)}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-cyan-300 font-bold text-[11px] shrink-0 cursor-pointer"
                >
                  Cambiar
                </button>
              )}
            </div>
          ) : (
            <CanonicalMaterialPicker
              materials={materials}
              value={selectedMaterialId}
              autoFocus
              onChange={(id, mat) => {
                setSelectedMaterialId(id || '')
                setIsChangingMaterial(false)
                setLocalError('')
                if (mode === 'RECOUNT' && mat) setQuantity(String(mat.current_stock ?? 0))
              }}
            />
          )}

          <div className="grid grid-cols-3 gap-2">
            {MODE_OPTIONS.map((opt) => {
              const Icon = opt.icon
              const isActive = mode === opt.id
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleModeChange(opt.id)}
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-black transition-all cursor-pointer ${
                    isActive ? opt.activeCls : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{opt.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </CanonicalStepperStep>

      <CanonicalStepperStep step={2} helpEntry={PANOL_STOCK_ADJUST_STEP_HELP[2]} title="CANTIDAD, FECHA Y MOTIVO" isLast={true}>
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold text-[11px] mb-1">
                {mode === 'RECOUNT' ? `Stock Físico Contado (${unitShort})` : `Cantidad (${unitShort})`}
              </label>
              <input
                type="number"
                step="any"
                min={mode === 'RECOUNT' ? undefined : '0.001'}
                autoFocus={Boolean(selectedMat && !isChangingMaterial)}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder={mode === 'RECOUNT' ? '0' : 'Ingresá cantidad...'}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-sm font-bold focus:outline-none focus:border-cyan-400"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold text-[11px] mb-1">
                Fecha del Movimiento ({formatDateAr(dateIso)})
              </label>
              <input
                type="date"
                value={dateIso}
                onChange={(e) => setDateIso(e.target.value || getTodayArIso())}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-semibold text-[11px] mb-1">Motivo</label>
              <select
                value={reasonType}
                onChange={(e) => setReasonType(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:border-cyan-400"
              >
                {modeCfg.reasons.map((rKey) => (
                  <option key={rKey} value={rKey}>{STOCK_REASON_LABELS[rKey] || rKey}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-semibold text-[11px] mb-1">Condición del Material</label>
              <select
                value={materialCondition}
                onChange={(e) => setMaterialCondition(e.target.value)}
                className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white font-semibold text-xs focus:outline-none focus:border-cyan-400"
              >
                {Object.entries(MATERIAL_CONDITION_LABELS).map(([k, lbl]) => (
                  <option key={k} value={k}>{lbl}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-semibold text-[11px] mb-1">Observaciones / Respaldo</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Remito externo, devolución de obra, rotura en depósito, inventario..."
              className="w-full px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-400"
            />
          </div>

          {selectedMat && (
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 font-mono text-xs">
              <span className="text-slate-400">
                Stock actual: <strong className="text-white">{preview.current} {unitShort}</strong>
              </span>
              <span className={preview.delta > 0 ? 'text-emerald-300 font-bold' : preview.delta < 0 ? 'text-rose-300 font-bold' : 'text-slate-500'}>
                Variación: {preview.delta > 0 ? `+${preview.delta}` : preview.delta} {unitShort}
              </span>
              <span className="text-slate-300">
                Nuevo Stock:{' '}
                <strong className={preview.next < 0 || (selectedMat.requires_stock_control && preview.next <= (Number(selectedMat.minimum_stock) || 0)) ? 'text-rose-400' : 'text-cyan-300'}>
                  {preview.next} {unitShort}
                </strong>
              </span>
            </div>
          )}
        </div>
      </CanonicalStepperStep>
    </CanonicalStepperModal>
  )
}
