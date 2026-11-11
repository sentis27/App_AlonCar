import { useState } from 'react'
import { ShieldAlert } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import {
  CATALOG_RUBROS,
  OFFICIAL_UNITS,
  SECURITY_FACTORS,
  deduceUnitMeasure
} from '../../lib/comprasConstants'
import { auditService } from '../../lib/auditService'

export default function NewMaterialModal({ order, onClose, onDismissed, onSuccess }) {
  const [noCatalogRequired, setNoCatalogRequired] = useState(false)
  const [name, setName] = useState(order.material_name_raw)
  const [category, setCategory] = useState('MATERIALES')
  const [rubro, setRubro] = useState('MATERIALES')
  const [requestNewRubro, setRequestNewRubro] = useState(false)
  const [suggestedRubro, setSuggestedRubro] = useState('')
  const [unitMeasure, setUnitMeasure] = useState(order.unit_measure || deduceUnitMeasure(order.material_name_raw))
  const [securityFactor, setSecurityFactor] = useState(1.06)
  const [costArs, setCostArs] = useState(order.supplier_quoted_price || 0)
  const [minimumStock, setMinimumStock] = useState(0)
  const [imageFile, setImageFile] = useState(null)
  const [saving, setSaving] = useState(false)

  function applyNamingPattern(prefix) {
    const updated = `${prefix} ${name}`
    setName(updated)
    setUnitMeasure(deduceUnitMeasure(updated))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    if (noCatalogRequired) {
      setSaving(true)
      try {
        const { error } = await supabase
          .from('purchase_orders')
          .update({ no_catalog_required: true, updated_at: new Date().toISOString() })
          .eq('id', order.id)
        if (error) throw error
        await auditService.logRowAction({
          action: 'UPDATE',
          entityType: 'purchase_orders',
          entityId: order.id,
          entityName: order.material_name_raw,
          sheetName: 'Compras · Pedidos',
          moduleRoute: '/compras',
          details: { no_catalog_required: true }
        })
        if (onDismissed) onDismissed(order.id)
        else onClose()
      } catch (err) {
        console.error('Error descartando alta:', err)
        alert('Error al descartar alta: ' + err.message)
      } finally {
        setSaving(false)
      }
      return
    }

    if (!name.trim()) return alert('Debe ingresar el nombre normalizado.')
    if (requestNewRubro && !suggestedRubro.trim()) {
      return alert('Por favor ingrese el nombre del nuevo rubro sugerido para el Administrador.')
    }

    setSaving(true)
    try {
      let imageUrl = null
      if (imageFile) {
        const ext = imageFile.name.split('.').pop()
        const safeName = name.trim().replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
        const storagePath = `catalogo_materiales/${Date.now()}_${safeName}.${ext}`
        const { error: uploadError } = await supabase.storage.from('compras').upload(storagePath, imageFile)
        if (uploadError) throw uploadError
        const { data: urlData } = supabase.storage.from('compras').getPublicUrl(storagePath)
        imageUrl = urlData.publicUrl
      }

      const payload = {
        name: name.trim(),
        category,
        rubro: requestNewRubro ? null : rubro,
        rubro_status: requestNewRubro ? 'PENDIENTE_HOMOLOGACION' : 'APROBADO',
        suggested_rubro: requestNewRubro ? suggestedRubro.trim().toUpperCase() : null,
        unit_measure: unitMeasure,
        security_factor: Number(securityFactor) || 1.06,
        cost_ars: Number(costArs),
        cost_usd: Number(costArs) / 1500,
        current_stock: 0,
        minimum_stock: Number(minimumStock),
        image_url: imageUrl
      }

      const { data, error } = await supabase.from('materials').insert([payload]).select().single()
      if (error) throw error

      await auditService.logRowAction({
        action: 'CREATE',
        entityType: 'materials',
        entityId: data.id,
        entityName: data.name,
        sheetName: 'Compras · Catálogo',
        moduleRoute: '/compras',
        details: { newMaterial: data }
      })

      onSuccess(data)
    } catch (err) {
      console.error('Error creando material:', err)
      alert('Error dando alta a material: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-amber-400" />
              Alta Formal de Material en B.D. Maestra
            </h3>
            <p className="text-xs text-slate-400">Normalización técnica, categoría, % seguridad y rubro (Solo Supervisor).</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-base cursor-pointer">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="p-3 rounded-xl bg-rose-950/30 border border-rose-500/40 flex items-start gap-2.5">
            <input
              id="no-catalog-check"
              type="checkbox"
              checked={noCatalogRequired}
              onChange={(e) => setNoCatalogRequired(e.target.checked)}
              className="mt-0.5 rounded bg-slate-900 border-rose-500 text-rose-500 focus:ring-0 cursor-pointer"
            />
            <label htmlFor="no-catalog-check" className="cursor-pointer select-none">
              <span className="font-bold text-rose-300 block">
                No requiere alta en catálogo (Desactivar aviso para este pedido)
              </span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Tilda esta casilla si es un material descartable o de compra única que no debe agregarse a la base de datos maestra.
              </span>
            </label>
          </div>

          {!noCatalogRequired && (
            <>
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Nombre Normalizado en Catálogo</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    setUnitMeasure(deduceUnitMeasure(e.target.value))
                  }}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-medium focus:outline-none focus:border-cyan-500"
                  required
                />
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-slate-500">Prefijos rápidos:</span>
                  <button type="button" onClick={() => applyNamingPattern('BULON ZINCADO')} className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 cursor-pointer">BULON</button>
                  <button type="button" onClick={() => applyNamingPattern('CAÑO INOX')} className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 cursor-pointer">CAÑO</button>
                  <button type="button" onClick={() => applyNamingPattern('CHAPA NAVAL')} className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 cursor-pointer">CHAPA</button>
                  <button type="button" onClick={() => applyNamingPattern('ELECTRODO')} className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] text-slate-300 cursor-pointer">ELECTRODO</button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Categoría Oficial (Únicas 3)</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-bold focus:outline-none focus:border-cyan-500"
                  >
                    <option value="MATERIALES">MATERIALES</option>
                    <option value="CONSUMIBLES">CONSUMIBLES</option>
                    <option value="ELEM.SEGURIDAD">ELEM.SEGURIDAD</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Unidad de Medida</label>
                  <select
                    value={unitMeasure}
                    onChange={(e) => setUnitMeasure(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-cyan-300 font-bold focus:outline-none focus:border-cyan-500"
                  >
                    {OFFICIAL_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-semibold">Rubro Técnico (Vinculado a Pañol)</label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none text-amber-300 font-bold text-[11px]">
                    <input
                      type="checkbox"
                      checked={requestNewRubro}
                      onChange={(e) => setRequestNewRubro(e.target.checked)}
                      className="rounded bg-slate-900 border-amber-500 text-amber-500 focus:ring-0 cursor-pointer"
                    />
                    <span>Solicitar apertura de nuevo rubro</span>
                  </label>
                </div>

                {!requestNewRubro ? (
                  <select
                    value={rubro}
                    onChange={(e) => setRubro(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                  >
                    {CATALOG_RUBROS.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div className="space-y-1.5">
                    <input
                      type="text"
                      placeholder="Escribe el nuevo rubro propuesto (ej: FIBRA OPTICA, COMPOSITES...)"
                      value={suggestedRubro}
                      onChange={(e) => setSuggestedRubro(e.target.value)}
                      className="w-full bg-amber-950/30 border border-amber-500/60 rounded-lg p-2 text-amber-200 placeholder-amber-400/50 font-semibold focus:outline-none focus:border-amber-400 uppercase"
                      required
                    />
                    <p className="text-[10px] text-amber-300/90">
                      ⚠️ El material se creará con todos sus datos técnicos y enviará una alerta al Dashboard del Administrador para homologar y asignar el nuevo rubro.
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Precio Base AR$</label>
                  <input
                    type="number"
                    step="any"
                    value={costArs}
                    onChange={(e) => setCostArs(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-cyan-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">% Seguridad (Merma / Buffer Pañol)</label>
                  <select
                    value={securityFactor}
                    onChange={(e) => setSecurityFactor(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-emerald-300 font-bold focus:outline-none focus:border-cyan-500"
                  >
                    {SECURITY_FACTORS.map((sf) => (
                      <option key={sf.value} value={sf.value}>
                        {sf.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">
                  Fotografía / Imagen del Material (Opcional — Para Ficha Visual de Pañol)
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files[0] || null)}
                  className="w-full text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-950 file:text-cyan-400 hover:file:bg-cyan-900 cursor-pointer bg-slate-950 border border-slate-800 rounded-lg p-1.5"
                />
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-4 py-2 font-bold rounded-lg cursor-pointer transition-all ${
                noCatalogRequired
                  ? 'bg-rose-600 hover:bg-rose-500 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/20'
              }`}
            >
              {saving
                ? 'Procesando...'
                : noCatalogRequired
                ? 'Confirmar: Omitir Alta en Catálogo'
                : 'Aprobar Alta en Catálogo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
