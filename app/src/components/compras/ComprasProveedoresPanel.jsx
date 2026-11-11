import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  Building2,
  MapPin,
  AlertTriangle,
  Phone,
  Mail,
  Tag,
  Plus,
  Search,
  X,
  List,
  LayoutGrid,
  CheckSquare,
  Square,
  Edit3,
  Trash2,
  ExternalLink,
  MessageSquare,
  Copy,
  Save,
  Undo2,
  Redo2
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useSpreadsheetGrid } from '../../hooks/useSpreadsheetGrid'
import GridRibbon from '../GridRibbon'
import GridStatusBarBottom from '../GridStatusBarBottom'
import GridContextMenu from '../GridContextMenu'
import HighlightText from '../HighlightText'
import { duplicateRecord, buildPasteRowHandler } from '../../lib/gridRowActions'
import { auditService } from '../../lib/auditService'

const STANDARD_TRADES = [
  'FERRETERIA',
  'GASES',
  'TORNERIA',
  'PINTURA',
  'METALES',
  'CALDERERIA',
  'ELECTRICIDAD',
  'SERVICIOS',
  'BULONERIA',
  'MADERA',
  'HIDRAULICA',
  'CORTE/PLEGADO',
  'MECANICA',
  'SEGURIDAD',
  'LUBRICANTES'
]

export function formatArgPhoneForWhatsApp(phoneStr = '') {
  if (!phoneStr) return ''
  const digits = phoneStr.replace(/[^0-9]/g, '')
  if (digits.startsWith('0810') || digits.startsWith('0800')) return digits
  if (digits.startsWith('549')) return digits
  if (digits.startsWith('54')) return '549' + digits.slice(2)
  let clean = digits.startsWith('0') ? digits.slice(1) : digits
  if (clean.length === 11 && clean.slice(3, 5) === '15') {
    clean = clean.slice(0, 3) + clean.slice(5)
  }
  return '549' + clean
}

export function SupplierModal({ supplier, onClose, onSuccess }) {
  const [name, setName] = useState(supplier?.name || '')
  const [cuitCuil, setCuitCuil] = useState(supplier?.cuit_cuil || '')
  const [phone, setPhone] = useState(supplier?.phone || '')
  const [email, setEmail] = useState(supplier?.email || '')
  const [address, setAddress] = useState(supplier?.address || '')
  const [isLocalSupplier, setIsLocalSupplier] = useState(supplier?.is_local_supplier ?? true)
  const [contactName, setContactName] = useState(supplier?.contact_name || '')
  const [paymentMethod, setPaymentMethod] = useState(supplier?.payment_method || 'CUENTA_CORRIENTE')
  const [billingMedium, setBillingMedium] = useState(supplier?.billing_medium || 'EMAIL')
  const [isGasSupplier, setIsGasSupplier] = useState(supplier?.is_gas_supplier || false)
  const [clientNumber, setClientNumber] = useState(supplier?.client_number || '')
  const [orderCutoffDay, setOrderCutoffDay] = useState(supplier?.order_cutoff_day || '')
  const [deliveryDay, setDeliveryDay] = useState(supplier?.delivery_day || '')
  const [observations, setObservations] = useState(supplier?.observations || '')

  const [selectedTrades, setSelectedTrades] = useState(
    supplier?.trades && supplier?.trades.length > 0
      ? supplier.trades
      : supplier?.trade
      ? [supplier.trade]
      : ['FERRETERIA']
  )
  const [newTradeInput, setNewTradeInput] = useState('')
  const [saving, setSaving] = useState(false)

  function handleToggleTrade(trade) {
    if (selectedTrades.includes(trade)) {
      setSelectedTrades(selectedTrades.filter((t) => t !== trade))
    } else {
      setSelectedTrades([...selectedTrades, trade])
    }
  }

  function handleAddNewTrade() {
    if (!newTradeInput.trim()) return
    const clean = newTradeInput.trim().toUpperCase()
    if (!selectedTrades.includes(clean)) {
      setSelectedTrades([...selectedTrades, clean])
    }
    setNewTradeInput('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!name.trim()) return alert('Debe ingresar el nombre del proveedor.')
    if (selectedTrades.length === 0) return alert('Debe seleccionar al menos un rubro para el proveedor.')

    setSaving(true)
    try {
      const payload = {
        name: name.trim().toUpperCase(),
        trades: selectedTrades,
        trade: selectedTrades.join(', '),
        cuit_cuil: cuitCuil.trim() || null,
        phone: phone.trim() || null,
        email: email.trim() || null,
        address: address.trim() || null,
        is_local_supplier: Boolean(isLocalSupplier),
        contact_name: contactName.trim() || null,
        payment_method: paymentMethod,
        billing_medium: billingMedium,
        is_gas_supplier: isGasSupplier,
        client_number: clientNumber.trim() || null,
        order_cutoff_day: orderCutoffDay.trim() || null,
        delivery_day: deliveryDay.trim() || null,
        observations: observations.trim() || null,
        updated_at: new Date().toISOString()
      }

      if (supplier?.id) {
        const { data, error } = await supabase.from('suppliers').update(payload).eq('id', supplier.id).select().single()
        if (error) throw error
        await auditService.logRowAction({
          action: 'MODAL_SAVE',
          entityType: 'suppliers',
          entityId: supplier.id,
          entityName: payload.name,
          changes: payload,
          sheetName: 'Compras · Proveedores',
          moduleRoute: '/compras'
        })
        onSuccess(data)
      } else {
        const { data, error } = await supabase.from('suppliers').insert([payload]).select().single()
        if (error) throw error
        await auditService.logRowAction({
          action: 'ROW_INSERT',
          entityType: 'suppliers',
          entityId: data.id,
          entityName: payload.name,
          rowData: payload,
          sheetName: 'Compras · Proveedores',
          moduleRoute: '/compras'
        })
        onSuccess(data)
      }
    } catch (err) {
      console.error('Error guardando proveedor:', err)
      alert('Error guardando proveedor: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="alon-modal-card max-w-5xl">
        <div className="alon-modal-header">
          <div className="flex items-center gap-2.5 min-w-0">
            <Building2 className="w-5 h-5 text-cyan-400 shrink-0" />
            <div className="min-w-0">
              <h3 className="text-sm font-black text-white truncate">
                {supplier ? `Editar Proveedor: ${supplier.name}` : 'Registrar Nuevo Proveedor'}
              </h3>
              <p className="text-[11px] text-slate-400 truncate">
                Datos maestros, rubros navales de suministro, datos de contacto y facturación.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="alon-modal-body grid grid-cols-1 lg:grid-cols-2 gap-3.5 items-start">
            <div className="space-y-3">
              <div className="alon-chunk-cyan space-y-2.5">
                <label className="text-[11px] font-black text-cyan-300 uppercase tracking-wider block">
                  1. Razón Social y Rubros
                </label>
                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-semibold">Nombre o Razón Social *</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value.toUpperCase())}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-bold text-xs uppercase focus:outline-none focus:border-cyan-400"
                    placeholder="Ej: DISTRIBUIDORA NAVAL S.A."
                  />
                </div>

                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-semibold">Rubros de Suministro *</label>
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto p-2 bg-slate-950 rounded-lg border border-slate-800">
                    {STANDARD_TRADES.map((t) => (
                      <button
                        type="button"
                        key={t}
                        onClick={() => handleToggleTrade(t)}
                        className={`text-[10px] px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                          selectedTrades.includes(t)
                            ? 'bg-cyan-500 text-slate-950 shadow-sm'
                            : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
                        }`}
                      >
                        {selectedTrades.includes(t) ? '✓ ' : '+ '}{t}
                      </button>
                    ))}
                  </div>

                  <div className="flex gap-2 mt-2">
                    <input
                      type="text"
                      placeholder="Agregar otro rubro..."
                      value={newTradeInput}
                      onChange={(e) => setNewTradeInput(e.target.value.toUpperCase())}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white uppercase"
                    />
                    <button
                      type="button"
                      onClick={handleAddNewTrade}
                      className="px-2.5 py-1 bg-slate-800 text-cyan-300 text-xs font-bold rounded-lg hover:bg-slate-700"
                    >
                      + Añadir
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="is_local"
                    checked={isLocalSupplier}
                    onChange={(e) => setIsLocalSupplier(e.target.checked)}
                    className="w-4 h-4 rounded text-cyan-500 accent-cyan-500 cursor-pointer"
                  />
                  <label htmlFor="is_local" className="text-xs text-slate-300 font-semibold cursor-pointer">
                    📍 Proveedor Local de Mar del Plata (para mandados rápidos)
                  </label>
                </div>
              </div>

              <div className="alon-chunk-amber space-y-2.5">
                <label className="text-[11px] font-black text-amber-300 uppercase tracking-wider block">
                  2. Datos Fiscales y Dirección
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1 font-semibold">CUIT / CUIL</label>
                    <input
                      type="text"
                      value={cuitCuil}
                      onChange={(e) => setCuitCuil(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-mono"
                      placeholder="30-12345678-9"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1 font-semibold">Dirección / Local</label>
                    <input
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs"
                      placeholder="Calle y Nro, Puerto MDP"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <div className="alon-chunk-emerald space-y-2.5">
                <label className="text-[11px] font-black text-emerald-300 uppercase tracking-wider block">
                  3. Contacto y Comunicación
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1 font-semibold">Teléfono / WhatsApp</label>
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-mono"
                      placeholder="223 555-1234"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1 font-semibold">Email de Pedidos</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-mono"
                      placeholder="ventas@proveedor.com"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-semibold">Persona de Contacto / Vendedor</label>
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs"
                    placeholder="Ej: Marcelo (Mostrador)"
                  />
                </div>
              </div>

              <div className="alon-chunk-purple space-y-2.5">
                <label className="text-[11px] font-black text-purple-300 uppercase tracking-wider block">
                  4. Facturación, Cuenta Corriente y Notas
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-slate-400 text-xs mb-1 font-semibold">Condición de Pago</label>
                    <select
                      value={paymentMethod}
                      onChange={(e) => setPaymentMethod(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-semibold"
                    >
                      <option value="CUENTA_CORRIENTE">Cuenta Corriente (Quincenal)</option>
                      <option value="CONTADO">Contado / Transferencia Inmediata</option>
                      <option value="CHEQUE_30">Cheque a 30 días</option>
                      <option value="CHEQUE_60">Cheque a 60 días</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-1 font-semibold">Nro. de Cliente en Proveedor</label>
                    <input
                      type="text"
                      value={clientNumber}
                      onChange={(e) => setClientNumber(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs font-mono"
                      placeholder="Ej: CTA-4029"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-400 text-xs mb-1 font-semibold">Observaciones / Horarios de Atención</label>
                  <textarea
                    rows={2}
                    value={observations}
                    onChange={(e) => setObservations(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white text-xs focus:outline-none"
                    placeholder="Horarios, comisionista habitual, descuentos pactados..."
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="alon-modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 text-xs font-black rounded-xl cursor-pointer transition-all shadow-md shadow-cyan-600/30"
            >
              {saving ? 'Guardando...' : supplier ? 'Guardar Cambios' : 'Registrar Proveedor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ComprasProveedoresPanel({
  suppliers = [],
  setSuppliers,
  purchaseOrders = [],
  reloadSuppliers
}) {
  const [supplierKpiFilter, setSupplierKpiFilter] = useState('TODOS')
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('')
  const [suppliersViewMode, setSuppliersViewMode] = useState('lista')
  const [supplierInlineEdit, setSupplierInlineEdit] = useState({ supplierId: null, field: null, value: '' })
  const [showSupplierModal, setShowSupplierModal] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [supplierMenuTarget, setSupplierMenuTarget] = useState(null)
  const [feedback, setFeedback] = useState(null)
  const suppliersPasteRef = useRef(null)

  const showFeedbackMsg = useCallback((type, text) => {
    setFeedback({ type, text })
    setTimeout(() => setFeedback(null), 3200)
  }, [])

  const supplierKpis = useMemo(() => {
    let localCount = 0
    let noContact = 0
    let noPhone = 0
    let noEmail = 0
    let noTrade = 0

    suppliers.forEach((s) => {
      if (s.is_local_supplier) localCount++
      const hasPhone = Boolean(s.phone && s.phone.trim())
      const hasEmail = Boolean(s.email && s.email.trim())
      if (!hasPhone && !hasEmail) noContact++
      if (!hasPhone) noPhone++
      if (!hasEmail) noEmail++
      const hasTrades = Boolean((s.trades && s.trades.length > 0) || (s.trade && s.trade.trim()))
      if (!hasTrades) noTrade++
    })

    return {
      total: suppliers.length,
      local: localCount,
      localCount,
      noContact,
      noPhone,
      noEmail,
      noTrade
    }
  }, [suppliers])

  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (supplierKpiFilter === 'LOCAL' && !s.is_local_supplier) return false
      if (supplierKpiFilter === 'NO_CONTACT' && (s.phone || s.email)) return false
      if (supplierKpiFilter === 'NO_PHONE' && s.phone && s.phone.trim()) return false
      if (supplierKpiFilter === 'NO_EMAIL' && s.email && s.email.trim()) return false
      if (supplierKpiFilter === 'NO_TRADE' && ((s.trades && s.trades.length > 0) || (s.trade && s.trade.trim()))) return false

      if (supplierSearchQuery && supplierSearchQuery.trim()) {
        const q = supplierSearchQuery.toLowerCase().trim()
        const n = (s.name || '').toLowerCase()
        const c = (s.contact_name || '').toLowerCase()
        const cuit = (s.cuit_cuil || '').toLowerCase()
        const ph = (s.phone || '').toLowerCase()
        const em = (s.email || '').toLowerCase()
        const tr = ((s.trades || [s.trade]).join(' ')).toLowerCase()
        const obs = (s.observations || '').toLowerCase()
        if (!n.includes(q) && !c.includes(q) && !cuit.includes(q) && !ph.includes(q) && !em.includes(q) && !tr.includes(q) && !obs.includes(q)) {
          return false
        }
      }
      return true
    })
  }, [suppliers, supplierKpiFilter, supplierSearchQuery])

  const saveSupplierInlineEdit = useCallback(async (supplierId, field, rawValue) => {
    setSupplierInlineEdit({ supplierId: null, field: null, value: '' })
    const target = suppliers.find((s) => s.id === supplierId)
    if (!target) return

    let cleanValue = rawValue
    const updates = {}

    if (field === 'trades') {
      const tradesArray = typeof rawValue === 'string'
        ? rawValue.split(',').map((t) => t.trim().toUpperCase()).filter(Boolean)
        : Array.isArray(rawValue) ? rawValue : []
      if (tradesArray.length === 0) {
        showFeedbackMsg('error', 'El proveedor debe tener al menos un rubro.')
        return
      }
      cleanValue = tradesArray
      updates.trades = tradesArray
      updates.trade = tradesArray.join(', ')
    } else if (typeof rawValue === 'string') {
      cleanValue = rawValue.trim()
      if (field === 'name' && !cleanValue) {
        showFeedbackMsg('error', 'La razón social del proveedor no puede estar vacía.')
        return
      }
      updates[field] = cleanValue || null
    } else {
      updates[field] = rawValue
    }

    if (JSON.stringify(target[field]) === JSON.stringify(cleanValue)) return

    try {
      setSuppliers?.((prev) => prev.map((s) => (s.id === supplierId ? { ...s, ...updates } : s)))
      const { error } = await supabase.from('suppliers').update(updates).eq('id', supplierId)
      if (error) throw error

      await auditService.logCellChange({
        entityType: 'suppliers',
        entityId: supplierId,
        entityName: target.name,
        field,
        fieldLabel: field,
        oldValue: target[field],
        newValue: cleanValue,
        sheetName: 'Compras · Proveedores',
        moduleRoute: '/compras'
      })
      showFeedbackMsg('success', `Proveedor ${target.name} actualizado.`)
    } catch (err) {
      console.error('Error actualizando proveedor inline:', err)
      showFeedbackMsg('error', 'Error al guardar: ' + err.message)
      reloadSuppliers?.()
    }
  }, [suppliers, setSuppliers, showFeedbackMsg, reloadSuppliers])

  const suppliersGridColumns = useMemo(() => [
    { key: 'name', label: 'Proveedor / Razón Social' },
    { key: 'trades', label: 'Rubros' },
    { key: 'is_local_supplier', label: 'Local (MDP)' },
    { key: 'cuit_cuil', label: 'CUIT / CUIL' },
    { key: 'phone', label: 'Teléfono / WhatsApp' },
    { key: 'email', label: 'Email' },
    { key: 'payment_method', label: 'Pago' },
    { key: 'observations', label: 'Notas / Observaciones' }
  ], [])

  const suppliersGrid = useSpreadsheetGrid({
    rows: filteredSuppliers,
    columns: suppliersGridColumns,
    getRowId: (s) => s.id,
    storageKey: 'aloncar_grid_suppliers',
    onBatchUpdate: async (updates) => {
      if (!updates || updates.length === 0) return
      for (const u of updates) {
        await saveSupplierInlineEdit(u.rowId, u.colKey, u.value)
      }
    },
    onPasteRow: (args) => suppliersPasteRef.current?.(args),
    onCellActivate: (row, colDef) => {
      if (!row || !colDef || colDef.readOnly) return
      setSupplierInlineEdit({
        supplierId: row.id,
        field: colDef.key,
        value: colDef.key === 'trades'
          ? (row.trades && row.trades.length > 0 ? row.trades.join(', ') : row.trade || '')
          : (row[colDef.key] ?? '')
      })
    }
  })

  const SUPPLIERS_PASTE_FIELDS = ['name', 'trades', 'trade', 'cuit_cuil', 'phone', 'email', 'payment_method', 'observations', 'is_local_supplier']

  useEffect(() => {
    suppliersPasteRef.current = buildPasteRowHandler({
      table: 'suppliers',
      entityType: 'suppliers',
      fields: SUPPLIERS_PASTE_FIELDS,
      grid: suppliersGrid,
      setList: setSuppliers,
      nameOf: (r) => r.name || r.id,
      showFeedback: (type, text) => showFeedbackMsg(type, text)
    })
  })

  const handleDuplicateSupplier = useCallback(async (sup) => {
    if (!sup) return
    try {
      const created = await duplicateRecord({
        table: 'suppliers',
        entityType: 'suppliers',
        source: sup,
        fields: SUPPLIERS_PASTE_FIELDS,
        overrides: { name: `${sup.name || 'PROVEEDOR'} (COPIA)` },
        nameOf: (r) => r.name || r.id
      })
      showFeedbackMsg('success', `Proveedor duplicado como "${created.name}".`)
      reloadSuppliers?.()
    } catch (err) {
      console.error(err)
      showFeedbackMsg('error', 'Error al duplicar proveedor: ' + err.message)
    }
  }, [showFeedbackMsg, reloadSuppliers])

  const handleDeleteSupplier = useCallback(async (sup) => {
    if (!confirm(`¿Eliminar al proveedor "${sup.name}"? Esta acción no se puede deshacer.`)) return
    try {
      setSuppliers?.((prev) => prev.filter((s) => s.id !== sup.id))
      const { error } = await supabase.from('suppliers').delete().eq('id', sup.id)
      if (error) throw error

      await auditService.logRowAction({
        action: 'ROW_DELETE',
        entityType: 'suppliers',
        entityId: sup.id,
        entityName: sup.name,
        rowData: sup,
        sheetName: 'Compras · Proveedores',
        moduleRoute: '/compras'
      })
      showFeedbackMsg('info', `Se eliminó al proveedor ${sup.name}.`)
    } catch (err) {
      console.error('Error eliminando proveedor:', err)
      showFeedbackMsg('error', 'Error al eliminar: ' + err.message)
      reloadSuppliers?.()
    }
  }, [setSuppliers, showFeedbackMsg, reloadSuppliers])

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Toast Feedback */}
      {feedback && (
        <div className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between shadow-lg ${
          feedback.type === 'error'
            ? 'bg-rose-950/90 border-rose-500 text-rose-200'
            : feedback.type === 'info'
            ? 'bg-cyan-950/90 border-cyan-500 text-cyan-200'
            : 'bg-emerald-950/90 border-emerald-500 text-emerald-200'
        }`}>
          <span>{feedback.text}</span>
          <button type="button" onClick={() => setFeedback(null)} className="text-slate-400 hover:text-white ml-2">
            ✕
          </button>
        </div>
      )}

      {/* ZONA 2: RADAR DE KPIS DE PROVEEDORES */}
      <div className="alon-zone-kpis p-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-400/90 px-1 block">
            📊 RADAR DE PROVEEDORES • Clic en una tarjeta para filtrar el padrón
          </span>
          {supplierKpiFilter !== 'TODOS' && (
            <button
              type="button"
              onClick={() => setSupplierKpiFilter('TODOS')}
              className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/60 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Restablecer filtro ({supplierKpiFilter})</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <div
            onClick={() => setSupplierKpiFilter('TODOS')}
            className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
              supplierKpiFilter === 'TODOS'
                ? 'bg-cyan-950/60 border-cyan-500 shadow-md ring-1 ring-cyan-500/50'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-slate-400 uppercase">Total Proveedores</p>
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
            </div>
            <p className="text-xl font-black text-white mt-0.5">{supplierKpis.total}</p>
            <span className="text-[9px] text-slate-500">Padrón activo</span>
          </div>

          <div
            onClick={() => setSupplierKpiFilter(supplierKpiFilter === 'LOCAL' ? 'TODOS' : 'LOCAL')}
            className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
              supplierKpiFilter === 'LOCAL'
                ? 'bg-emerald-950/60 border-emerald-500 shadow-md ring-1 ring-emerald-500/50'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-emerald-400 uppercase flex items-center gap-1">
                <MapPin className="w-3 h-3" />
                <span>Locales (MDP)</span>
              </p>
            </div>
            <p className="text-xl font-black text-emerald-300 mt-0.5">{supplierKpis.localCount}</p>
            <span className="text-[9px] text-emerald-500/80">Para mandados</span>
          </div>

          <div
            onClick={() => setSupplierKpiFilter(supplierKpiFilter === 'NO_CONTACT' ? 'TODOS' : 'NO_CONTACT')}
            className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
              supplierKpiFilter === 'NO_CONTACT'
                ? 'bg-rose-950/70 border-rose-500 shadow-md ring-1 ring-rose-500/50'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-rose-400 uppercase flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                <span>Sin Contacto</span>
              </p>
            </div>
            <p className="text-xl font-black text-rose-300 mt-0.5">{supplierKpis.noContact}</p>
            <span className="text-[9px] text-rose-400/80">Sin Tel ni Email</span>
          </div>

          <div
            onClick={() => setSupplierKpiFilter(supplierKpiFilter === 'NO_PHONE' ? 'TODOS' : 'NO_PHONE')}
            className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
              supplierKpiFilter === 'NO_PHONE'
                ? 'bg-amber-950/60 border-amber-500 shadow-md ring-1 ring-amber-500/50'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-amber-400 uppercase flex items-center gap-1">
                <Phone className="w-3 h-3" />
                <span>Sin WhatsApp</span>
              </p>
            </div>
            <p className="text-xl font-black text-amber-300 mt-0.5">{supplierKpis.noPhone}</p>
            <span className="text-[9px] text-amber-500/80">Falta teléfono</span>
          </div>

          <div
            onClick={() => setSupplierKpiFilter(supplierKpiFilter === 'NO_EMAIL' ? 'TODOS' : 'NO_EMAIL')}
            className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
              supplierKpiFilter === 'NO_EMAIL'
                ? 'bg-purple-950/60 border-purple-500 shadow-md ring-1 ring-purple-500/50'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-purple-400 uppercase flex items-center gap-1">
                <Mail className="w-3 h-3" />
                <span>Sin Email</span>
              </p>
            </div>
            <p className="text-xl font-black text-purple-300 mt-0.5">{supplierKpis.noEmail}</p>
            <span className="text-[9px] text-purple-500/80">Falta correo</span>
          </div>

          <div
            onClick={() => setSupplierKpiFilter(supplierKpiFilter === 'NO_TRADE' ? 'TODOS' : 'NO_TRADE')}
            className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
              supplierKpiFilter === 'NO_TRADE'
                ? 'bg-orange-950/60 border-orange-500 shadow-md ring-1 ring-orange-500/50'
                : 'bg-slate-900 border-slate-800 hover:border-slate-700'
            }`}
          >
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-bold text-orange-400 uppercase flex items-center gap-1">
                <Tag className="w-3 h-3" />
                <span>Sin Rubro</span>
              </p>
            </div>
            <p className="text-xl font-black text-orange-300 mt-0.5">{supplierKpis.noTrade}</p>
            <span className="text-[9px] text-orange-500/80">Sin categorizar</span>
          </div>
        </div>
      </div>

      {/* BLOQUE OPERATIVO UNIFICADO: ZONA 3 + ZONA 4 */}
      <div className="alon-workspace-block">
        <div className="alon-zone-toolbar flex flex-wrap items-center justify-between gap-3 p-3">
          <div className="flex items-center gap-2 flex-1 min-w-[280px] max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={supplierSearchQuery}
                onChange={(e) => setSupplierSearchQuery(e.target.value)}
                placeholder="Buscar proveedor, rubro, CUIT, teléfono, email, notas..."
                className="w-full pl-9 pr-8 py-1.5 bg-slate-900/90 border border-slate-750 focus:border-cyan-500 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              {supplierSearchQuery && (
                <button
                  type="button"
                  onClick={() => setSupplierSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <span className="text-[11px] text-slate-400 whitespace-nowrap hidden sm:inline">
              {filteredSuppliers.length} de {suppliers.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setSuppliersViewMode('lista')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                suppliersViewMode === 'lista' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Vista Lista</span>
            </button>
            <button
              onClick={() => setSuppliersViewMode('fichas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                suppliersViewMode === 'fichas' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Vista Fichas</span>
            </button>

            <button
              onClick={() => {
                setEditingSupplier(null)
                setShowSupplierModal(true)
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg text-xs cursor-pointer shadow-sm ml-1 transition-all"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Nuevo Proveedor</span>
            </button>
          </div>
        </div>

        {suppliersViewMode === 'lista' ? (
          <div
            className="alon-zone-grid"
            ref={suppliersGrid.gridContainerRef}
            tabIndex={0}
            onKeyDown={suppliersGrid.handleKeyDown}
          >
            <GridRibbon
              activeCellBadge={suppliersGrid.activeCellBadge || 'PADRÓN PROVEEDORES'}
              selectedCount={suppliersGrid.selectedRangeCount}
              undoCount={suppliersGrid.undoCount}
              redoCount={suppliersGrid.redoCount}
              onUndo={suppliersGrid.undo}
              onRedo={suppliersGrid.redo}
              onInsertRow={() => {
                setEditingSupplier(null)
                setShowSupplierModal(true)
              }}
              insertRowLabel="+ Nuevo Proveedor"
              exportRows={filteredSuppliers}
              exportFilename={`padron_proveedores_${new Date().toISOString().split('T')[0]}`}
            />
            <div className="alon-grid-scroll">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-20 alon-grid-thead">
                  <tr>
                    <th className="py-2.5 px-2 w-10 text-center font-bold text-slate-400 bg-slate-900 border-b border-r border-slate-750">
                      <div className="flex flex-col items-center justify-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => suppliersGrid.toggleSelectAll(filteredSuppliers.map(s => s.id))}
                          className="text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                          title="Seleccionar todos los proveedores visibles"
                        >
                          {suppliersGrid.selectedRowIds.size > 0 && suppliersGrid.selectedRowIds.size === filteredSuppliers.length ? (
                            <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                          ) : (
                            <Square className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <span className="text-[10px] text-slate-500 font-mono">#</span>
                      </div>
                    </th>
                    <th className="py-2.5 px-3">Proveedor / Razón Social</th>
                    <th className="py-2.5 px-3">Rubros</th>
                    <th className="py-2.5 px-3 text-center">Local (MDP)</th>
                    <th className="py-2.5 px-3">CUIT / CUIL</th>
                    <th className="py-2.5 px-3">Teléfono / WhatsApp</th>
                    <th className="py-2.5 px-3">Email</th>
                    <th className="py-2.5 px-3">Pago</th>
                    <th className="py-2.5 px-3 min-w-[220px]">Notas / Observaciones</th>
                    <th className="py-2.5 px-3 text-center">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-medium">
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-8 text-center text-slate-500">
                        No se encontraron proveedores que coincidan con los filtros aplicados.
                      </td>
                    </tr>
                  ) : (
                    filteredSuppliers.map((sup, sIdx) => {
                      const allTrades = sup.trades && sup.trades.length > 0 ? sup.trades : sup.trade ? [sup.trade] : []
                      const isRowSelected = suppliersGrid.isRowSelected(sup.id)
                      const isEditing = (colKey) =>
                        Boolean(supplierInlineEdit.supplierId === sup.id && supplierInlineEdit.field === colKey)

                      return (
                        <tr
                          key={sup.id}
                          className={`transition-colors ${isRowSelected ? 'bg-cyan-950/30' : 'hover:bg-slate-800/50'}`}
                          onContextMenu={(e) => {
                            e.preventDefault()
                            setSupplierMenuTarget({
                              x: e.clientX,
                              y: e.clientY,
                              rowIndex: sIdx,
                              row: sup,
                              recordId: sup.id,
                              recordLabel: sup.name
                            })
                          }}
                        >
                          <td className="py-1 px-1 w-10 text-center border-r border-slate-800/80 bg-slate-900/50">
                            <div className="flex flex-col items-center justify-center gap-0.5">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  suppliersGrid.toggleSelectRow(sup.id)
                                }}
                                className="text-slate-400 hover:text-cyan-300 transition-colors cursor-pointer"
                              >
                                {isRowSelected ? (
                                  <CheckSquare className="w-3.5 h-3.5 text-cyan-400" />
                                ) : (
                                  <Square className="w-3.5 h-3.5" />
                                )}
                              </button>
                              <span className="font-mono text-[9px] text-slate-500">{sIdx + 1}</span>
                            </div>
                          </td>

                          {/* 1. Proveedor */}
                          <td
                            className="py-2 px-3 font-bold text-white relative cursor-cell"
                            onDoubleClick={() => setSupplierInlineEdit({ supplierId: sup.id, field: 'name', value: sup.name || '' })}
                          >
                            {isEditing('name') ? (
                              <input
                                autoFocus
                                type="text"
                                value={supplierInlineEdit.value}
                                onChange={(e) => setSupplierInlineEdit(prev => ({ ...prev, value: e.target.value.toUpperCase() }))}
                                onBlur={() => saveSupplierInlineEdit(sup.id, 'name', supplierInlineEdit.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveSupplierInlineEdit(sup.id, 'name', supplierInlineEdit.value)
                                  if (e.key === 'Escape') setSupplierInlineEdit({ supplierId: null, field: null, value: '' })
                                }}
                                className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white font-bold w-full uppercase"
                              />
                            ) : (
                              <div className="flex items-center gap-1.5">
                                <span><HighlightText text={sup.name} query={supplierSearchQuery} /></span>
                                {sup.is_gas_supplier && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-amber-950 text-amber-400 border border-amber-800 font-extrabold">
                                    GASES
                                  </span>
                                )}
                              </div>
                            )}
                          </td>

                          {/* 2. Rubros */}
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-1">
                              {allTrades.map((t, idx) => (
                                <span key={idx} className="px-1.5 py-0.2 rounded text-[10px] bg-slate-800 text-slate-300 border border-slate-700">
                                  {t}
                                </span>
                              ))}
                            </div>
                          </td>

                          {/* 3. Local */}
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => saveSupplierInlineEdit(sup.id, 'is_local_supplier', !sup.is_local_supplier)}
                              className={`text-[10px] px-2 py-0.5 rounded font-bold border transition-colors cursor-pointer ${
                                sup.is_local_supplier
                                  ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
                                  : 'bg-slate-900 text-slate-500 border-slate-800'
                              }`}
                            >
                              {sup.is_local_supplier ? '✓ MDP' : 'Externo'}
                            </button>
                          </td>

                          {/* 4. CUIT */}
                          <td
                            className="py-2 px-3 font-mono text-slate-300 relative cursor-cell"
                            onDoubleClick={() => setSupplierInlineEdit({ supplierId: sup.id, field: 'cuit_cuil', value: sup.cuit_cuil || '' })}
                          >
                            {isEditing('cuit_cuil') ? (
                              <input
                                autoFocus
                                type="text"
                                value={supplierInlineEdit.value}
                                onChange={(e) => setSupplierInlineEdit(prev => ({ ...prev, value: e.target.value }))}
                                onBlur={() => saveSupplierInlineEdit(sup.id, 'cuit_cuil', supplierInlineEdit.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveSupplierInlineEdit(sup.id, 'cuit_cuil', supplierInlineEdit.value)
                                  if (e.key === 'Escape') setSupplierInlineEdit({ supplierId: null, field: null, value: '' })
                                }}
                                className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white font-mono w-full"
                              />
                            ) : (
                              <span>{sup.cuit_cuil || '—'}</span>
                            )}
                          </td>

                          {/* 5. Teléfono */}
                          <td
                            className="py-2 px-3 relative cursor-cell"
                            onDoubleClick={() => setSupplierInlineEdit({ supplierId: sup.id, field: 'phone', value: sup.phone || '' })}
                          >
                            {isEditing('phone') ? (
                              <input
                                autoFocus
                                type="text"
                                value={supplierInlineEdit.value}
                                onChange={(e) => setSupplierInlineEdit(prev => ({ ...prev, value: e.target.value }))}
                                onBlur={() => saveSupplierInlineEdit(sup.id, 'phone', supplierInlineEdit.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveSupplierInlineEdit(sup.id, 'phone', supplierInlineEdit.value)
                                  if (e.key === 'Escape') setSupplierInlineEdit({ supplierId: null, field: null, value: '' })
                                }}
                                className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white font-mono w-full"
                              />
                            ) : sup.phone ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-slate-300">{sup.phone}</span>
                                <a
                                  href={`https://wa.me/${formatArgPhoneForWhatsApp(sup.phone)}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-emerald-400 hover:text-emerald-300 p-0.5 rounded hover:bg-emerald-950"
                                  title="Abrir chat de WhatsApp"
                                >
                                  <MessageSquare className="w-3.5 h-3.5" />
                                </a>
                              </div>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          {/* 6. Email */}
                          <td
                            className="py-2 px-3 font-mono text-slate-300 relative cursor-cell"
                            onDoubleClick={() => setSupplierInlineEdit({ supplierId: sup.id, field: 'email', value: sup.email || '' })}
                          >
                            {isEditing('email') ? (
                              <input
                                autoFocus
                                type="email"
                                value={supplierInlineEdit.value}
                                onChange={(e) => setSupplierInlineEdit(prev => ({ ...prev, value: e.target.value }))}
                                onBlur={() => saveSupplierInlineEdit(sup.id, 'email', supplierInlineEdit.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveSupplierInlineEdit(sup.id, 'email', supplierInlineEdit.value)
                                  if (e.key === 'Escape') setSupplierInlineEdit({ supplierId: null, field: null, value: '' })
                                }}
                                className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white font-mono w-full"
                              />
                            ) : sup.email ? (
                              <a href={`mailto:${sup.email}`} className="text-cyan-400 hover:underline">
                                {sup.email}
                              </a>
                            ) : (
                              <span className="text-slate-600">—</span>
                            )}
                          </td>

                          {/* 7. Pago */}
                          <td className="py-2 px-3">
                            <span className="text-[10px] font-semibold text-slate-400">
                              {sup.payment_method === 'CONTADO' ? 'Contado' : 'Cta. Cte.'}
                            </span>
                          </td>

                          {/* 8. Notas */}
                          <td
                            className="py-2 px-3 text-slate-300 relative cursor-cell"
                            onDoubleClick={() => setSupplierInlineEdit({ supplierId: sup.id, field: 'observations', value: sup.observations || '' })}
                          >
                            {isEditing('observations') ? (
                              <input
                                autoFocus
                                type="text"
                                value={supplierInlineEdit.value}
                                onChange={(e) => setSupplierInlineEdit(prev => ({ ...prev, value: e.target.value }))}
                                onBlur={() => saveSupplierInlineEdit(sup.id, 'observations', supplierInlineEdit.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveSupplierInlineEdit(sup.id, 'observations', supplierInlineEdit.value)
                                  if (e.key === 'Escape') setSupplierInlineEdit({ supplierId: null, field: null, value: '' })
                                }}
                                className="bg-slate-950 border border-cyan-400 rounded px-1.5 py-0.5 text-xs text-white w-full"
                              />
                            ) : (
                              <span className="truncate block max-w-xs">{sup.observations || '—'}</span>
                            )}
                          </td>

                          {/* 9. Acciones */}
                          <td className="py-2 px-3 text-center whitespace-nowrap">
                            <div className="flex items-center justify-center gap-1.5">
                              <button
                                onClick={() => {
                                  setEditingSupplier(sup)
                                  setShowSupplierModal(true)
                                }}
                                className="p-1 text-slate-400 hover:text-cyan-400 rounded hover:bg-slate-800 cursor-pointer"
                                title="Editar ficha completa"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDuplicateSupplier(sup)}
                                className="p-1 text-slate-400 hover:text-amber-400 rounded hover:bg-slate-800 cursor-pointer"
                                title="Duplicar proveedor"
                              >
                                <Copy className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteSupplier(sup)}
                                className="p-1 text-slate-400 hover:text-rose-400 rounded hover:bg-slate-800 cursor-pointer"
                                title="Eliminar proveedor"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Vista Fichas */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 p-3">
            {filteredSuppliers.map((sup) => (
              <div key={sup.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between hover:border-slate-700 transition-all">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="font-extrabold text-white text-sm">{sup.name}</h4>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold border ${
                          sup.is_local_supplier ? 'bg-emerald-950 text-emerald-300 border-emerald-800' : 'bg-slate-950 text-slate-400 border-slate-800'
                        }`}>
                          {sup.is_local_supplier ? 'Local MDP' : 'Externo'}
                        </span>
                        {sup.cuit_cuil && <span className="text-[10px] text-slate-500 font-mono">{sup.cuit_cuil}</span>}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 text-xs space-y-1.5 text-slate-300">
                    {sup.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-mono">{sup.phone}</span>
                        <a
                          href={`https://wa.me/${formatArgPhoneForWhatsApp(sup.phone)}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-emerald-400 hover:underline text-[10px] font-bold"
                        >
                          WhatsApp &rarr;
                        </a>
                      </div>
                    )}
                    {sup.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-500" />
                        <span className="font-mono truncate">{sup.email}</span>
                      </div>
                    )}
                    {sup.address && (
                      <div className="flex items-center gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-500" />
                        <span className="truncate">{sup.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs">
                  <span className="text-[10px] text-slate-500">{sup.payment_method === 'CONTADO' ? 'Contado' : 'Cta. Cte.'}</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => {
                        setEditingSupplier(sup)
                        setShowSupplierModal(true)
                      }}
                      className="px-2.5 py-1 text-slate-300 hover:text-white rounded bg-slate-800 hover:bg-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDeleteSupplier(sup)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded hover:bg-rose-950/40 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <GridStatusBarBottom
          filteredCount={filteredSuppliers.length}
          totalCount={suppliers.length}
          entityName="proveedores"
          selectionStats={suppliersGrid.selectionStats}
          onClearSelection={() => {
            suppliersGrid.setSelectionRange(null)
            suppliersGrid.clearSelectedRows()
          }}
          customSelection={suppliersGrid.selectedRowIds.size > 0 ? {
            count: suppliersGrid.selectedRowIds.size,
            label: `${suppliersGrid.selectedRowIds.size} proveedor(es) seleccionado(s)`,
            onClear: suppliersGrid.clearSelectedRows
          } : null}
          globalAggregates={[
            { label: 'Padrón Total', value: suppliers.length },
            { label: 'Locales MDP', value: supplierKpis.local, highlight: true },
            { label: 'Sin Contacto', value: supplierKpis.noContact },
            { label: 'Sin Rubro', value: supplierKpis.noTrade }
          ]}
        />
      </div>

      {/* Modal Alta / Edición Proveedor */}
      {showSupplierModal && (
        <SupplierModal
          supplier={editingSupplier}
          onClose={() => {
            setShowSupplierModal(false)
            setEditingSupplier(null)
          }}
          onSuccess={(saved) => {
            if (editingSupplier) {
              setSuppliers?.((prev) => prev.map((s) => (s.id === saved.id ? saved : s)))
            } else {
              setSuppliers?.((prev) => [saved, ...prev])
            }
            setShowSupplierModal(false)
            setEditingSupplier(null)
            showFeedbackMsg('success', `Proveedor ${saved.name} guardado con éxito.`)
          }}
        />
      )}

      {/* Menú Contextual Canónico */}
      {supplierMenuTarget && (
        <GridContextMenu
          target={supplierMenuTarget}
          onClose={() => setSupplierMenuTarget(null)}
          onCopyCell={suppliersGrid.copyActiveCell}
          onCopyRow={suppliersGrid.copyRow}
          onPaste={suppliersGrid.pasteToActiveOrRange}
          onDeleteCell={suppliersGrid.deleteActiveCellOrRange}
          onDuplicateRow={(row) => handleDuplicateSupplier(row)}
          onDeleteRow={(row) => handleDeleteSupplier(row)}
          entityType="suppliers"
          recordId={supplierMenuTarget.recordId}
          recordLabel={supplierMenuTarget.recordLabel}
        />
      )}
    </div>
  )
}
