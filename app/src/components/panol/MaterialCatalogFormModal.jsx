import { useState, useEffect, useMemo, useRef } from 'react'
import { Package, AlertTriangle, Lock, Camera, Edit3, FolderTree } from 'lucide-react'
import { OFFICIAL_UNITS, SECURITY_FACTORS, normalizeUnitMeasure, computeMaterialCostUsd } from '../../lib/unitMeasureUtils'
import { MATERIAL_CATEGORIES } from '../../lib/panolConstants'
import { buildMergedRubrosCatalog, fetchActiveDollarRateService } from '../../lib/panolCatalogService'
import { PANOL_MATERIAL_STEP_HELP, HIGH_VALUE_MATERIAL_USD_THRESHOLD } from '../../lib/businessHelpRegistry'
import { CanonicalStepperModal, CanonicalStepperStep } from '../canonical/CanonicalStepperModal.jsx'
import CanonicalPriceHelpBadge from '../canonical/CanonicalPriceHelpBadge.jsx'

export default function MaterialCatalogFormModal({
  material = null, rubros = [], materials = [], isAdmin = false, pricingPolicy = null, onOpenRubrosManager = null, onClose, onSave
}) {
  const isEditMode = Boolean(material?.id)
  const mergedRubros = useMemo(() => buildMergedRubrosCatalog(rubros, materials), [rubros, materials])
  const fileInputRef = useRef(null)

  const [name, setName] = useState(String(material?.name || '').toUpperCase())
  const [rubro, setRubro] = useState(String(material?.rubro || '').trim().toUpperCase() || '')
  const [category, setCategory] = useState(MATERIAL_CATEGORIES.includes(material?.category) ? material.category : 'MATERIALES')
  const [costArs, setCostArs] = useState(material?.cost_ars ?? 0)
  const [securityFactor, setSecurityFactor] = useState(Number(material?.security_factor) || 1.06)
  const [dollarRate, setDollarRate] = useState(1500)
  const [unitMeasure, setUnitMeasure] = useState(normalizeUnitMeasure(material?.unit_measure, material?.name))
  const [weightKg, setWeightKg] = useState(material?.weight_kg ?? 0)
  const [requiresStockControl, setRequiresStockControl] = useState(material ? Boolean(material.requires_stock_control) : true)
  const [currentStock, setCurrentStock] = useState(material?.current_stock ?? 0)
  const [minimumStock, setMinimumStock] = useState(material?.minimum_stock ?? 0)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(material?.image_url || '')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    let active = true
    fetchActiveDollarRateService().then((rate) => { if (active && rate > 0) setDollarRate(rate) })
    return () => { active = false }
  }, [])

  const computedCostUsd = useMemo(
    () => computeMaterialCostUsd(costArs, securityFactor, dollarRate),
    [costArs, securityFactor, dollarRate]
  )
  const isHighValueOver4k = computedCostUsd > HIGH_VALUE_MATERIAL_USD_THRESHOLD
  const catalogDisabled = !isAdmin
  const inputCls = catalogDisabled
    ? 'bg-slate-950/70 border-slate-800 text-slate-400 cursor-not-allowed'
    : 'bg-slate-950 border-slate-700 text-white focus:outline-none focus:border-cyan-400'

  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null
    setImageFile(file)
    if (file) { setImagePreview(URL.createObjectURL(file)); setFormError('') }
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (isSubmitting) return
    setFormError('')
    const upperName = String(name || '').trim().toUpperCase()
    if (isAdmin && !upperName) return setFormError('El nombre técnico oficial del material es obligatorio.')
    if (!isAdmin && !imageFile) return setFormError('Seleccioná una imagen nueva para actualizar la foto del material.')
    try {
      setIsSubmitting(true)
      await onSave({
        material, imageFile,
        formData: {
          name: upperName, rubro: rubro || 'VARIOS Y GENERAL', category,
          cost_ars: Math.max(0, Number(costArs) || 0), cost_usd: computedCostUsd, dollar_rate: dollarRate,
          unit_measure: unitMeasure, weight_kg: Math.max(0, Number(weightKg) || 0),
          requires_stock_control: requiresStockControl, current_stock: Number(currentStock) || 0,
          minimum_stock: Math.max(0, Number(minimumStock) || 0), security_factor: Number(securityFactor) || 1.06
        }
      })
    } catch (err) {
      setFormError(err?.message || 'Error al guardar el material en el catálogo.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <CanonicalStepperModal
      isOpen={true}
      onClose={onClose}
      maxWidthClass="max-w-5xl"
      icon={isEditMode ? <Edit3 className="w-4 h-4 text-cyan-400" /> : <Package className="w-4 h-4 text-emerald-400" />}
      title={isEditMode ? `EDITAR MATERIAL — ${material.name}` : 'ALTA DE MATERIAL EN CATÁLOGO B.D'}
      onSubmit={handleSubmit}
      formNoValidate={true}
      footerLeft={
        <button type="button" disabled={isSubmitting} onClick={onClose} className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer text-xs">
          Cancelar
        </button>
      }
      footerRight={
        <button type="submit" disabled={isSubmitting || (!isAdmin && !imageFile)} className="px-5 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs cursor-pointer shadow-lg shadow-emerald-500/20">
          {isSubmitting ? 'Guardando...' : !isAdmin ? 'Guardar Foto' : isEditMode ? 'Guardar Cambios' : 'Crear Material'}
        </button>
      }
    >
      {!isAdmin && (
        <div className="p-2 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 flex items-center gap-2 text-[11px]">
          <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span><strong>Modo Pañolero:</strong> podés consultar la ficha y <strong>subir o cambiar la foto</strong> (izquierda). Los parámetros técnicos son exclusivos del Administrador.</span>
        </div>
      )}
      {formError && (
        <div className="p-2.5 rounded-xl bg-rose-950/90 border border-rose-500/70 text-rose-200 font-bold flex items-center justify-between gap-2">
          <div className="flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" /><span>{formError}</span></div>
          <button type="button" onClick={() => setFormError('')} className="text-rose-300 hover:text-white cursor-pointer">✕</button>
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-5 items-start">
        <div className="w-full sm:w-32 shrink-0 flex flex-col items-center gap-1.5">
          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
          <button type="button" tabIndex={-1} onClick={() => fileInputRef.current?.click()} className="group relative w-28 h-28 sm:w-32 sm:h-32 rounded-2xl bg-slate-950/90 border-2 border-dashed border-slate-700 hover:border-cyan-400 flex flex-col items-center justify-center overflow-hidden cursor-pointer transition-all" title="Clic para subir o cambiar la foto del material (Admin y Pañolero)">
            {imagePreview ? (
              <>
                <img src={imagePreview} alt={name} className="w-full h-full object-cover" />
                <span className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1">
                  <Camera className="w-5 h-5 text-cyan-300" /><span>Cambiar foto</span>
                </span>
              </>
            ) : (
              <div className="flex flex-col items-center gap-1 text-slate-400 group-hover:text-cyan-300">
                <Camera className="w-7 h-7" /><span className="text-[10px] font-bold">+ Subir Foto</span>
              </div>
            )}
          </button>
          <span className="text-[10px] text-slate-500 text-center truncate w-full">{imageFile ? imageFile.name : 'Foto del insumo'}</span>
        </div>

        <div className="flex-1 min-w-0 space-y-3">
          <CanonicalStepperStep
            step={1}
            helpEntry={PANOL_MATERIAL_STEP_HELP[1]}
            title="IDENTIFICACIÓN"
            headerRight={
              isAdmin && onOpenRubrosManager ? (
                <button type="button" tabIndex={-1} onClick={onOpenRubrosManager} className="px-2 py-0.5 rounded-lg bg-slate-900 hover:bg-sky-950 border border-slate-700 hover:border-sky-500/60 text-sky-300 font-bold text-[10px] inline-flex items-center gap-1 cursor-pointer">
                  <FolderTree className="w-3 h-3" /><span>B.D. Rubros</span>
                </button>
              ) : null
            }
          >
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
              <div className="md:col-span-2">
                <label className="block text-slate-400 font-semibold text-[11px] mb-1">Nombre Técnico Oficial <span className="text-rose-400">*</span></label>
                <input type="text" autoFocus={isAdmin} disabled={catalogDisabled} value={name} onChange={(e) => setName(e.target.value.toUpperCase())} placeholder="EJ: CHAPA NAVAL 1/4' (6.35MM)..." className={`w-full px-2.5 py-1.5 rounded-lg border font-bold uppercase text-xs ${inputCls}`} />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold text-[11px] mb-1">Rubro Técnico</label>
                <select disabled={catalogDisabled} value={rubro} onChange={(e) => setRubro(e.target.value)} className={`w-full px-2.5 py-1.5 rounded-lg border text-xs ${inputCls}`}>
                  <option value="">VARIOS Y GENERAL</option>
                  {mergedRubros.map((r) => <option key={r.name} value={r.name}>{r.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
              <span className="text-slate-400 font-semibold text-[11px] mr-1">Categoría:</span>
              {MATERIAL_CATEGORIES.map((cat) => {
                const active = category === cat
                return (
                  <button key={cat} type="button" tabIndex={-1} disabled={catalogDisabled} onClick={() => !catalogDisabled && setCategory(cat)} className={`px-2.5 py-1 rounded-full text-[10px] font-black tracking-wide transition-all border ${active ? 'bg-emerald-500 border-emerald-400 text-slate-950 shadow-md shadow-emerald-500/25' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-200 hover:border-slate-700'} ${catalogDisabled ? 'cursor-not-allowed opacity-75' : 'cursor-pointer'}`}>
                    {cat === 'ELEM.SEGURIDAD' ? 'ELEM. SEGURIDAD' : cat}
                  </button>
                )
              })}
            </div>
          </CanonicalStepperStep>

          {isAdmin && (
            <CanonicalStepperStep
              step={2}
              helpEntry={PANOL_MATERIAL_STEP_HELP[2]}
              title="PRECIO Y % SEGURIDAD"
              isActive={isHighValueOver4k && securityFactor !== 1.02}
              headerRight={
                <span className="px-2 py-0.5 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-mono font-bold text-[11px]">
                  Dólar ref: $ {dollarRate.toLocaleString('es-AR')}
                </span>
              }
            >
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="flex items-center gap-1 text-slate-400 font-semibold text-[11px] mb-1">
                    <span>Precio Base AR$</span>
                    <CanonicalPriceHelpBadge isAdmin={isAdmin} pricingPolicy={pricingPolicy} dollarRate={dollarRate} size="xs" />
                  </label>
                  <input type="number" min="0" step="any" disabled={catalogDisabled} value={costArs} onChange={(e) => setCostArs(e.target.value)} className={`w-full px-2.5 py-1.5 rounded-lg border font-mono font-bold text-xs ${inputCls}`} />
                </div>
                <div>
                  <label className="flex items-center gap-1 text-slate-400 font-semibold text-[11px] mb-1">
                    <span>% Seguridad</span>
                  </label>
                  <select value={securityFactor} onChange={(e) => setSecurityFactor(Number(e.target.value))} className="w-full px-2.5 py-1.5 rounded-lg border font-bold text-xs bg-emerald-950/60 border-emerald-500/60 text-emerald-300 focus:outline-none focus:border-emerald-400">
                    {SECURITY_FACTORS.map((sf) => <option key={sf.value} value={sf.value} className="bg-slate-950 text-white">{Math.round((sf.value - 1) * 100)}%</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 font-semibold text-[11px] mb-1">Costo US$ (Fórmula)</label>
                  <div className="w-full px-2.5 py-1.5 rounded-lg bg-cyan-950/50 border border-cyan-500/50 text-cyan-200 font-mono font-black text-xs text-right">
                    US$ {computedCostUsd.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
              {isHighValueOver4k && securityFactor !== 1.02 && (
                <div className="px-2.5 py-1 rounded-lg bg-amber-950/50 border border-amber-500/50 text-amber-200 text-[10px] flex items-center justify-between gap-2">
                  <span>⚠️ Supera <strong>US$ 4.000</strong>: se recomienda usar <strong>2%</strong> de seguridad.</span>
                  <button type="button" onClick={() => setSecurityFactor(1.02)} className="px-2 py-0.5 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 font-black cursor-pointer shrink-0">Aplicar 2%</button>
                </div>
              )}
            </CanonicalStepperStep>
          )}

          <CanonicalStepperStep step={isAdmin ? 3 : 2} helpEntry={PANOL_MATERIAL_STEP_HELP[3]} title="UNIDAD DE MEDIDA">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-slate-400 font-semibold text-[11px] mb-1">Unidad de Medida Oficial</label>
                <select disabled={catalogDisabled} value={unitMeasure} onChange={(e) => setUnitMeasure(e.target.value)} className={`w-full px-2.5 py-1.5 rounded-lg border font-bold text-xs ${catalogDisabled ? inputCls : 'bg-slate-950 border-slate-700 text-cyan-300 focus:outline-none focus:border-cyan-400'}`}>
                  {OFFICIAL_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-slate-400 font-semibold text-[11px] mb-1">Peso Unitario (kg)</label>
                <input type="number" min="0" step="any" disabled={catalogDisabled} value={weightKg} onChange={(e) => setWeightKg(e.target.value)} className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-xs ${inputCls}`} />
              </div>
            </div>
          </CanonicalStepperStep>

          <CanonicalStepperStep step={isAdmin ? 4 : 3} helpEntry={PANOL_MATERIAL_STEP_HELP[4]} title="CONTROL DE STOCK" isLast={true}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end">
              <label className={`px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center gap-2 ${isAdmin ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}>
                <input type="checkbox" disabled={!isAdmin} checked={requiresStockControl} onChange={(e) => setRequiresStockControl(e.target.checked)} className="w-4 h-4 rounded text-emerald-500 bg-slate-900 border-slate-700" />
                <span className="font-bold text-white text-xs">Lleva Stock</span>
                {!isAdmin && <Lock className="w-3 h-3 text-amber-400 ml-auto" />}
              </label>
              <div>
                <label className="flex items-center gap-1 text-slate-400 font-semibold text-[11px] mb-1">
                  <span>Stock Mínimo</span>{!isAdmin && <Lock className="w-3 h-3 text-amber-400" />}
                </label>
                <input type="number" min="0" step="any" disabled={!isAdmin} value={minimumStock} onChange={(e) => setMinimumStock(e.target.value)} className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-xs ${inputCls}`} />
              </div>
              <div>
                <label className="block text-slate-400 font-semibold text-[11px] mb-1">{isEditMode ? 'Stock Actual (⚖️)' : 'Stock Inicial'}</label>
                <input type="number" step="any" disabled={isEditMode || catalogDisabled} value={currentStock} onChange={(e) => setCurrentStock(e.target.value)} title={isEditMode ? 'El stock físico se modifica desde el botón ⚖️ Ajustar Stock' : 'Stock inicial'} className={`w-full px-2.5 py-1.5 rounded-lg border font-mono text-xs ${isEditMode || catalogDisabled ? 'bg-slate-950/60 border-slate-800 text-emerald-400/80 cursor-not-allowed' : inputCls}`} />
              </div>
            </div>
          </CanonicalStepperStep>
        </div>
      </div>
    </CanonicalStepperModal>
  )
}
