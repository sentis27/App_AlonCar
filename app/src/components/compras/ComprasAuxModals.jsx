import { useState, useEffect, useMemo, useRef } from 'react'
import {
  Paperclip,
  MessageSquare,
  CheckCircle2,
  Phone,
  ExternalLink,
  SlidersHorizontal,
  Plus,
  RefreshCw,
  Upload,
  Split,
  Bell,
  Building2,
  Save,
  Truck,
  Lightbulb,
  Zap,
  AlertCircle,
  Check,
  Copy,
  FileText
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatArgPhoneForWhatsApp, STANDARD_TRADES } from '../../lib/comprasConstants'
import { extractTextFromPdf } from '../../lib/pdfTextExtractor'
import { DocActionModal } from './ComprasOcrPanel'
import { auditService } from '../../lib/auditService'

// ==============================================================================
// MODAL: CONCILIAR CON FACTURA ("LÍNEA MORADA")
// ==============================================================================
export function ReconcileModal({ target, purchaseOrders, onClose, onSuccess }) {
  const isDetailMode = target?.mode === 'detail'
  const isSelectedMode = target?.mode === 'selected'
  const [invoiceNumber, setInvoiceNumber] = useState(target?.currentInvoice || '')
  const [reconcileAllPrior, setReconcileAllPrior] = useState(!isSelectedMode && !isDetailMode)

  const eligibleOrders = useMemo(() => {
    if (isSelectedMode && Array.isArray(target?.selectedIds)) {
      return purchaseOrders.filter((po) => target.selectedIds.includes(po.id))
    }
    if (isDetailMode) {
      return purchaseOrders.filter((po) => po.id === target.orderId)
    }
    return purchaseOrders.filter((po) => {
      if (target.supplierId && po.supplier_id !== target.supplierId) return false
      if (po.is_reconciled) return false
      if (reconcileAllPrior) return po.order_date <= target.orderDate
      return po.id === target.orderId
    })
  }, [purchaseOrders, target, reconcileAllPrior, isSelectedMode, isDetailMode])

  function handleSubmit(e) {
    e.preventDefault()
    if (!invoiceNumber.trim()) return alert('Debe ingresar el número de factura o remito.')
    onSuccess({
      invoiceNumber: invoiceNumber.trim(),
      orderIds: eligibleOrders.map((o) => o.id),
      action: 'reconcile'
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-purple-400">🟣</span>
              {isDetailMode ? 'Detalle de Conciliación' : 'Conciliación con Factura'}
            </h3>
            <p className="text-xs text-slate-400">
              {isSelectedMode
                ? `Aplicación masiva sobre ${eligibleOrders.length} fila(s) seleccionada(s)`
                : `Auditoría contable para ${target.supplierName || 'Proveedor'}`}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        {isDetailMode && (
          <div className="bg-purple-950/40 border border-purple-700/60 rounded-xl p-3 text-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-purple-300 font-bold">Estado actual:</span>
              <span className="px-2 py-0.5 rounded-full bg-purple-600/30 text-purple-200 font-bold text-[10px]">
                🟣 CONCILIADO
              </span>
            </div>
            <p className="text-slate-300">
              Comprobante: <strong className="text-white font-mono">{target.currentInvoice || 'S/N'}</strong>
            </p>
            {target.reconciledAt && (
              <p className="text-[11px] text-slate-400">
                Fecha: {new Date(target.reconciledAt).toLocaleString('es-AR')}
                {target.reconciledBy ? ` • Por: ${target.reconciledBy}` : ''}
              </p>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-400 mb-1 font-semibold">
              {isDetailMode ? 'Modificar Número de Factura o Remito' : 'Número de Factura o Remito Proveedor'}
            </label>
            <input
              type="text"
              placeholder="Ej: FC-A-0004-9844"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white font-mono uppercase focus:outline-none focus:border-purple-500"
              required
            />
          </div>

          {!isSelectedMode && !isDetailMode && target.supplierId && (
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <label className="flex items-center gap-2 text-slate-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={reconcileAllPrior}
                  onChange={(e) => setReconcileAllPrior(e.target.checked)}
                  className="rounded border-slate-700 text-purple-600 focus:ring-purple-500"
                />
                <span>Conciliar hasta aquí (incluir todas las anteriores pendientes del proveedor)</span>
              </label>
              <p className="text-[11px] text-purple-300">
                Se marcarán <strong className="text-white">{eligibleOrders.length} compras</strong> de este proveedor como
                conciliadas bajo este comprobante.
              </p>
            </div>
          )}

          {isSelectedMode && (
            <div className="bg-purple-950/30 p-3 rounded-xl border border-purple-800/60 space-y-1.5">
              <p className="text-[11px] text-purple-200 font-semibold">
                Se aplicará la conciliación a las <strong className="text-white">{eligibleOrders.length} filas tildadas</strong>:
              </p>
              <div className="max-h-28 overflow-y-auto space-y-1 pr-1">
                {eligibleOrders.map((po) => (
                  <div key={po.id} className="flex items-center justify-between text-[10px] text-slate-300 bg-slate-950/70 px-2 py-1 rounded">
                    <span className="truncate font-semibold">{po.material_name}</span>
                    <span className="text-slate-400 font-mono shrink-0 ml-2">{po.supplier?.name || 'S/Prov'}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
            {isDetailMode ? (
              <button
                type="button"
                onClick={() =>
                  onSuccess({
                    invoiceNumber: null,
                    orderIds: [target.orderId],
                    action: 'unreconcile'
                  })
                }
                className="px-3 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold rounded-lg cursor-pointer"
              >
                Quitar Conciliación
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={eligibleOrders.length === 0}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 disabled:opacity-50 text-white font-bold rounded-lg cursor-pointer"
              >
                {isDetailMode ? 'Actualizar Comprobante' : `Confirmar (${eligibleOrders.length})`}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL: DESPACHO POR WHATSAPP (SOPORTE 2 COMPRADORES & 0810)
// ==============================================================================
export function BatchOrderWhatsAppModal({ selectedOrderIds, purchaseOrders, suppliers, systemSettings, onClose, onSuccess }) {
  const buyer1 = systemSettings?.buyer_1 || { name: 'Jorge Sentis', phone: '+5492235000001', is_active: true }
  const buyer2 = systemSettings?.buyer_2 || { name: 'Andrés', phone: '+5492235000002', is_active: true }

  const [selectedBuyer, setSelectedBuyer] = useState('buyer_1')
  const activeBuyer = selectedBuyer === 'buyer_1' ? buyer1 : buyer2

  const batchData = useMemo(() => {
    const selected = purchaseOrders.filter((p) => selectedOrderIds.has(p.id))
    const map = new Map()
    selected.forEach((po) => {
      const sup = suppliers.find((s) => s.id === po.supplier_id) || {
        id: 'unknown',
        name: 'Sin Proveedor Asignado',
        phone: ''
      }
      if (!map.has(sup.id)) {
        map.set(sup.id, { supplier: sup, items: [] })
      }
      map.get(sup.id).items.push(po)
    })
    return Array.from(map.values())
  }, [selectedOrderIds, purchaseOrders, suppliers])

  function buildWhatsAppText(supplierName, items) {
    const hasIncompleto = items.some((i) => i.status === 'PEDIDO INCOMPLETO')

    if (hasIncompleto) {
      let text = `Estimados ${supplierName},\n`
      items.forEach((item) => {
        const orderDateFormatted = item.order_date || 'reciente'
        const remitoText = item.remito_number ? `según Remito N° ${item.remito_number}` : ''
        const origQty = (Number(item.quantity) || 0) + (Number(item.missing_quantity) || 0)
        const recQty = Number(item.received_quantity) || (origQty > item.quantity ? origQty - item.quantity : 0)
        const missQty = Number(item.quantity) || Number(item.missing_quantity) || 0

        text += `Acusamos recibo de la entrega para Astillero Alon Car correspondiente a la orden de compra del día ${orderDateFormatted} ${remitoText}.\n`
        text += `Sobre el pedido de ${origQty} ${item.unit_measure || 'unidades'} de ${item.material_name_raw}, se recibieron físicamente ${recQty} ${item.unit_measure || 'unidades'}.\n`
        text += `Quedan pendientes de entrega ${missQty} ${item.unit_measure || 'unidades'}.\n`
      })
      text += `Agradecemos nos confirmen la fecha estimada de despacho del saldo faltante.\n\n`
      text += `Atte. Departamento de Compras Alon Car S.A.`
      return encodeURIComponent(text)
    }

    let text = `*SOLICITUD DE COMPRA - ALON CAR S.A.*\n`
    text += `Estimados *${supplierName}*,\n`
    text += `Por medio de la presente solicitamos cotización/entrega de los siguientes materiales:\n\n`

    items.forEach((item, idx) => {
      text += `*${idx + 1}.* ${item.material_name_raw} — Cantidad: *${item.quantity} ${item.unit_measure || 'unidades'}*`
      if (item.observations) text += ` _(Nota: ${item.observations})_`
      text += `\n`
    })

    text += `\n_Por favor confirmar disponibilidad y plazos de entrega._\n`
    text += `Muchas gracias.\n*Solicitado por: ${activeBuyer.name}*\n*Astillero & Metalúrgica Alon Car S.A.* (Tel: ${activeBuyer.phone})`
    return encodeURIComponent(text)
  }

  async function handleEmitOrder(supplier, items) {
    const rawPhone = supplier.phone || ''
    const isLandlineOr0810 = rawPhone.startsWith('0810') || rawPhone.startsWith('0800')

    if (isLandlineOr0810) {
      alert(`El proveedor ${supplier.name} opera con línea fija / 0810 (${rawPhone}). Utilice el botón de llamada telefónica.`)
      return
    }

    const cleanFormatted = formatArgPhoneForWhatsApp(rawPhone)
    const encodedText = buildWhatsAppText(supplier.name, items)
    const url = cleanFormatted ? `https://api.whatsapp.com/send?phone=${cleanFormatted}&text=${encodedText}` : `https://api.whatsapp.com/send?text=${encodedText}`

    try {
      const ids = items.map((i) => i.id)
      for (const id of ids) {
        await supabase.from('purchase_orders').update({ status: 'PEDIDO', updated_at: new Date().toISOString() }).eq('id', id)
        await auditService.logRowAction({
          action: 'STATUS_CHANGE',
          entityType: 'purchase_orders',
          entityId: id,
          entityName: items.find(it => it.id === id)?.material_name_raw,
          sheetName: 'Compras · Pedidos',
          moduleRoute: '/compras',
          details: { newStatus: 'PEDIDO', channel: 'WhatsApp', supplier: supplier.name }
        })
      }
      window.open(url, '_blank')
      onSuccess(ids)
    } catch (err) {
      alert('Error al emitir pedido: ' + err.message)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              Emitir Pedidos Agrupados por WhatsApp
            </h3>
            <p className="text-xs text-slate-400">
              Seleccione el comprador emisor. Los pedidos se agrupan automáticamente por proveedor.
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-2">
          <label className="block text-slate-400 font-semibold text-xs">
            Seleccionar Comprador Emisor (Firma el mensaje):
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSelectedBuyer('buyer_1')}
              className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                selectedBuyer === 'buyer_1'
                  ? 'bg-cyan-950 border-cyan-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <div>
                <p className="font-bold text-xs">{buyer1.name}</p>
                <p className="text-[10px] text-slate-400">{buyer1.role || 'Administración'} • {buyer1.phone}</p>
              </div>
              {selectedBuyer === 'buyer_1' && <CheckCircle2 className="w-4 h-4 text-cyan-400" />}
            </button>

            <button
              type="button"
              onClick={() => setSelectedBuyer('buyer_2')}
              className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between cursor-pointer ${
                selectedBuyer === 'buyer_2'
                  ? 'bg-blue-950 border-blue-500 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <div>
                <p className="font-bold text-xs">{buyer2.name}</p>
                <p className="text-[10px] text-slate-400">{buyer2.role || 'Pañol'} • {buyer2.phone}</p>
              </div>
              {selectedBuyer === 'buyer_2' && <CheckCircle2 className="w-4 h-4 text-blue-400" />}
            </button>
          </div>
        </div>

        <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
          {batchData.map(({ supplier, items }) => {
            const rawPhone = supplier.phone || ''
            const is0810 = rawPhone.startsWith('0810') || rawPhone.startsWith('0800')

            return (
              <div key={supplier.id} className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-bold text-white text-sm">{supplier.name}</h4>
                    <p className="text-[10px] text-slate-400">
                      {supplier.phone ? `Tel: ${supplier.phone}` : '⚠️ Sin teléfono registrado'}
                      {supplier.client_number && ` • N° Cliente: ${supplier.client_number}`}
                    </p>
                  </div>

                  {is0810 ? (
                    <a
                      href={`tel:${rawPhone.replace(/[^0-9]/g, '')}`}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Llamar al {rawPhone}</span>
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleEmitOrder(supplier, items)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <MessageSquare className="w-3.5 h-3.5" />
                      <span>Abrir WhatsApp ({items.length} ítems)</span>
                    </button>
                  )}
                </div>

                <ul className="divide-y divide-slate-850 text-xs text-slate-300">
                  {items.map((it) => (
                    <li key={it.id} className="py-1 flex items-center justify-between">
                      <span>{it.material_name_raw}</span>
                      <span className="font-mono text-cyan-400 font-bold">
                        {it.quantity} {it.unit_measure || 'unidades'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>

        <div className="flex justify-end pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-lg cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL: GESTOR DE ADJUNTOS DE LA LÍNEA (MULTIDOCUMENTO)
// ==============================================================================
export function OrderAttachmentsModal({ order, documents, suppliers, ships, workOrders, onClose, onDocAdded, onDocUpdated, onDocDeleted }) {
  const lineDocs = documents.filter((d) => d.purchase_order_id === order.id)
  const sup = suppliers.find((s) => s.id === order.supplier_id)
  const shp = ships.find((s) => s.id === order.ship_id)

  const [uploading, setUploading] = useState(false)
  const [pendingDocs, setPendingDocs] = useState([
    { id: 1, docType: 'COTIZACION_MATERIAL', file: null, description: '' }
  ])
  const [showDocAction, setShowDocAction] = useState(null)

  function handleAddRow() {
    setPendingDocs((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), docType: 'FICHA_TECNICA', file: null, description: '' }
    ])
  }

  function handleRemoveRow(id) {
    if (pendingDocs.length <= 1) return
    setPendingDocs((prev) => prev.filter((item) => item.id !== id))
  }

  function handleChangeRow(id, field, value) {
    setPendingDocs((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)))
  }

  async function handleAddDoc(e) {
    e.preventDefault()
    const validRows = pendingDocs.filter((r) => r.file !== null)
    if (validRows.length === 0) return alert('Por favor selecciona al menos un archivo para subir.')

    setUploading(true)
    try {
      const year = new Date().getFullYear()
      const rubro = order.work_type || 'General'
      const safeProv = (sup?.name || 'Proveedor').replace(/[^a-zA-Z0-9_-]/g, '_')

      for (const row of validRows) {
        const ext = row.file.name.split('.').pop()
        const safeDesc = (row.description || 'Doc').replace(/[^a-zA-Z0-9_-]/g, '_')
        const normalizedName = `${safeDesc}_${safeProv}.${ext}`
        const storagePath = `cotizaciones/${year}/${rubro}/${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${normalizedName}`

        const { error: uploadError } = await supabase.storage.from('compras').upload(storagePath, row.file)
        if (uploadError) throw uploadError

        const { data: urlData } = supabase.storage.from('compras').getPublicUrl(storagePath)

        let extractedText = null
        if (row.file && (row.file.type === 'application/pdf' || row.file.name.toLowerCase().endsWith('.pdf'))) {
          try {
            extractedText = await extractTextFromPdf(row.file)
          } catch (e) {
            console.warn('Extracción digital PDF falló:', e)
          }
        }

        const docPayload = {
          purchase_order_id: order.id,
          supplier_id: order.supplier_id || null,
          original_filename: row.file.name,
          normalized_filename: normalizedName,
          storage_path: urlData.publicUrl,
          category: rubro,
          description: row.description || 'Documento adjunto',
          year,
          file_size_bytes: row.file.size,
          doc_type: row.docType,
          is_confidential_labor: row.docType === 'COTIZACION_MANO_OBRA',
          extracted_text: extractedText
        }

        const { data: newDoc, error: dbError } = await supabase.from('purchase_documents').insert([docPayload]).select().single()
        if (dbError) throw dbError

        await auditService.logRowAction({
          action: 'CREATE',
          entityType: 'purchase_documents',
          entityId: newDoc.id,
          entityName: newDoc.original_filename,
          sheetName: 'Compras · Documentos',
          moduleRoute: '/compras',
          details: { orderId: order.id, docType: row.docType }
        })

        onDocAdded(newDoc)
      }

      setPendingDocs([{ id: Date.now(), docType: 'COTIZACION_MATERIAL', file: null, description: '' }])
    } catch (err) {
      console.error('Error subiendo documento:', err)
      alert('Error al subir archivo: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Paperclip className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                Adjuntar Documento a Compra
                <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-bold">
                  {lineDocs.length} adjunto{lineDocs.length === 1 ? '' : 's'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                {order.material_name_raw} ({order.quantity} {order.unit_measure || 'un.'}) — Proveedor: {sup?.name || 'S/D'} | Buque: {shp?.name || 'ASTILLERO'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-base cursor-pointer">✕</button>
        </div>

        {lineDocs.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Archivos actualmente guardados en esta compra:
            </h4>
            <div className="space-y-2">
              {lineDocs.map((doc) => (
                <div
                  key={doc.id}
                  className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 shrink-0">
                      <FileText className="w-4 h-4" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-white text-xs truncate max-w-[280px]" title={doc.original_filename}>
                          {doc.original_filename}
                        </p>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                            doc.doc_type === 'COTIZACION_MANO_OBRA'
                              ? 'bg-rose-950/80 text-rose-300 border-rose-800'
                              : doc.doc_type === 'FICHA_TECNICA'
                              ? 'bg-blue-950/80 text-blue-300 border-blue-800'
                              : doc.doc_type === 'IMAGEN_MUESTRA'
                              ? 'bg-amber-950/80 text-amber-300 border-amber-800'
                              : doc.doc_type === 'REMITO' || doc.doc_type === 'REMITO_FACTURA'
                              ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                              : 'bg-purple-950/80 text-purple-300 border-purple-800'
                          }`}
                        >
                          {doc.doc_type === 'COTIZACION_MATERIAL' ? '📄 Cotiz. Material'
                            : doc.doc_type === 'COTIZACION_MANO_OBRA' ? '🔒 Mano de Obra'
                            : doc.doc_type === 'FICHA_TECNICA' ? '📐 Ficha Técnica'
                            : doc.doc_type === 'IMAGEN_MUESTRA' ? '📸 Muestra / Foto'
                            : doc.doc_type === 'REMITO' ? '🧾 Remito'
                            : doc.doc_type}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 truncate mt-0.5">
                        {doc.description || 'Sin notas'} • {(doc.file_size_bytes / 1024).toFixed(1)} KB • {new Date(doc.created_at).toLocaleDateString('es-AR')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <a
                      href={doc.storage_path}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 bg-cyan-950 hover:bg-cyan-900 border border-cyan-800 text-cyan-300 text-xs font-bold rounded-lg flex items-center gap-1 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" />
                      <span>Ver</span>
                    </a>
                    <button
                      onClick={() => setShowDocAction(doc)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                      title="Opciones avanzadas (modificar, reemplazar, eliminar)"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-white flex items-center gap-2">
              <Plus className="w-4 h-4 text-cyan-400" />
              Subir Nuevo(s) Documento(s) a esta Orden
            </h4>
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/80 hover:bg-emerald-900 border border-emerald-500/70 text-emerald-300 text-xs font-extrabold transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ Agregar otro adjunto</span>
            </button>
          </div>

          <form onSubmit={handleAddDoc} className="space-y-3 text-xs">
            <div className="space-y-3">
              {pendingDocs.map((row, index) => (
                <div key={row.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-3 relative">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
                      Nuevo Adjunto #{index + 1}
                    </span>
                    {pendingDocs.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(row.id)}
                        className="text-rose-400 hover:text-rose-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        ✕ Quitar fila
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Tipo de Documento</label>
                      <select
                        value={row.docType}
                        onChange={(e) => handleChangeRow(row.id, 'docType', e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500 font-semibold"
                      >
                        <option value="COTIZACION_MATERIAL">📄 Cotización de Material (Visible en Compras)</option>
                        <option value="COTIZACION_MANO_OBRA">🔒 Cotización de Mano de Obra (Confidencial)</option>
                        <option value="FICHA_TECNICA">📐 Ficha Técnica / Manual Naval</option>
                        <option value="IMAGEN_MUESTRA">📸 Fotografía de Muestra / Rotura</option>
                        <option value="REMITO">🧾 Remito de Entrega</option>
                        <option value="FACTURA">💳 Factura Comercial</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1 font-semibold">Descripción Breve</label>
                      <input
                        type="text"
                        value={row.description}
                        onChange={(e) => handleChangeRow(row.id, 'description', e.target.value)}
                        placeholder="Ej: Presupuesto Tubos, Ficha Acero Naval..."
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1 font-semibold">Seleccionar Archivo (PDF, DOCX, JPG, PNG)</label>
                    <input
                      type="file"
                      onChange={(e) => handleChangeRow(row.id, 'file', e.target.files[0] || null)}
                      className="w-full text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-950 file:text-cyan-400 hover:file:bg-cyan-900 cursor-pointer"
                      required
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleAddRow}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/60 hover:bg-emerald-900 border border-emerald-500/50 text-emerald-300 text-xs font-bold transition-all cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5 text-emerald-400" />
                <span>+ Agregar otro adjunto</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-lg cursor-pointer"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold rounded-lg text-xs shadow-md shadow-cyan-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {uploading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5 stroke-[2.5]" />}
                  <span>
                    {uploading
                      ? 'Subiendo...'
                      : `Subir ${pendingDocs.length > 1 ? `${pendingDocs.length} Documentos` : 'Documento'}`}
                  </span>
                </button>
              </div>
            </div>
          </form>
        </div>

        {showDocAction && (
          <DocActionModal
            doc={showDocAction}
            onClose={() => setShowDocAction(null)}
            onSuccess={({ action, updatedDoc, deletedId }) => {
              if (action === 'delete') {
                onDocDeleted(deletedId)
              } else {
                onDocUpdated(updatedDoc)
              }
              setShowDocAction(null)
            }}
          />
        )}
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL: RECEPCIÓN PARCIAL / PEDIDO INCOMPLETO
// ==============================================================================
export function PartialDeliveryModal({ order, suppliers, ships, workOrders, onClose, onSuccess }) {
  const sup = suppliers.find((s) => s.id === order.supplier_id)
  const shp = ships.find((s) => s.id === order.ship_id)

  const originalQty = Number(order.quantity) || 1
  const [receivedQty, setReceivedQty] = useState(Math.max(1, Math.floor(originalQty * 0.8)))
  const [remitoNumber, setRemitoNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [evidenceFiles, setEvidenceFiles] = useState([])
  const [processing, setProcessing] = useState(false)

  const missingQty = Math.max(0, originalQty - Number(receivedQty))

  async function handleSubmit(e) {
    e.preventDefault()
    if (Number(receivedQty) <= 0) return alert('La cantidad recibida debe ser mayor a 0.')
    if (Number(receivedQty) >= originalQty) return alert('Para una recepción completa de todas las unidades, usa el estado "RECIBIDO".')
    if (!remitoNumber.trim()) return alert('Por favor indica el Número de Remito de la entrega.')

    setProcessing(true)
    try {
      const receivedStatus = order.charge_type === 'DIRECT' ? 'RECIB.COMP.DIRECT' : 'RECIBIDO'
      const originalUpdates = {
        quantity: Number(receivedQty),
        received_quantity: Number(receivedQty),
        missing_quantity: missingQty,
        remito_number: remitoNumber.trim(),
        status: receivedStatus,
        notes: (order.notes ? order.notes + ' | ' : '') + `Recepción parcial (${receivedQty}/${originalQty}) s/Remito ${remitoNumber}. ${notes}`,
        updated_at: new Date().toISOString()
      }

      if (order.charge_type === 'VIA_PANOL' && order.material_id) {
        const { data: matData } = await supabase.from('materials').select('current_stock').eq('id', order.material_id).single()
        if (matData) {
          const newStock = (matData.current_stock || 0) + Number(receivedQty)
          await supabase.from('materials').update({ current_stock: newStock }).eq('id', order.material_id)
        }
      }

      const { data: updatedOriginal, error: errOrig } = await supabase
        .from('purchase_orders')
        .update(originalUpdates)
        .eq('id', order.id)
        .select()
        .single()
      if (errOrig) throw errOrig

      const childPayload = {
        charge_type: order.charge_type,
        order_date: order.order_date,
        ship_id: order.ship_id,
        work_order_id: order.work_order_id,
        requested_by_name: order.requested_by_name,
        work_type: order.work_type,
        material_id: order.material_id,
        material_name_raw: order.material_name_raw,
        is_new_material: order.is_new_material,
        quantity: missingQty,
        missing_quantity: missingQty,
        received_quantity: 0,
        unit_measure: order.unit_measure,
        supplier_id: order.supplier_id,
        supplier_quoted_price: order.supplier_quoted_price,
        system_unit_price: order.system_unit_price,
        currency: order.currency || 'ARS',
        status: 'PEDIDO INCOMPLETO',
        urgency: order.urgency || 'URGENTE',
        parent_order_id: order.id,
        remito_number: remitoNumber.trim(),
        fortnight_period: order.fortnight_period,
        notes: `Saldo faltante de orden anterior. Remito parcial: ${remitoNumber}. ${notes}`
      }

      const { data: childOrder, error: errChild } = await supabase
        .from('purchase_orders')
        .insert([childPayload])
        .select()
        .single()
      if (errChild) throw errChild

      const newDocs = []
      if (evidenceFiles.length > 0) {
        const year = new Date().getFullYear()
        for (const f of evidenceFiles) {
          const ext = f.name.split('.').pop()
          const storagePath = `cotizaciones/${year}/remitos/${Date.now()}_remito_${remitoNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}.${ext}`
          const { error: upErr } = await supabase.storage.from('compras').upload(storagePath, f)
          if (!upErr) {
            const { data: urlData } = supabase.storage.from('compras').getPublicUrl(storagePath)
            const docPayload = {
              purchase_order_id: order.id,
              supplier_id: order.supplier_id || null,
              original_filename: f.name,
              normalized_filename: `Remito_${remitoNumber}.${ext}`,
              storage_path: urlData.publicUrl,
              category: 'REMITO',
              description: `Remito de entrega parcial ${remitoNumber} (${receivedQty}/${originalQty})`,
              year,
              file_size_bytes: f.size,
              doc_type: 'REMITO',
              is_confidential_labor: false
            }
            const { data: docRes } = await supabase.from('purchase_documents').insert([docPayload]).select().single()
            if (docRes) newDocs.push(docRes)
          }
        }
      }

      await auditService.logRowAction({
        action: 'SPLIT',
        entityType: 'purchase_orders',
        entityId: order.id,
        entityName: order.material_name_raw,
        sheetName: 'Compras · Pedidos',
        moduleRoute: '/compras',
        details: { receivedQty, missingQty, remitoNumber, childId: childOrder.id }
      })

      onSuccess({ originalOrder: updatedOriginal, childOrder, newDocs })
    } catch (err) {
      console.error('Error procesando recepción parcial:', err)
      alert('Error: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-950 border border-orange-800 flex items-center justify-center text-orange-400">
              <Split className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                Recepción Parcial de Mercadería
                <span className="text-[10px] px-2 py-0.5 rounded bg-orange-950 border border-orange-800 text-orange-300 font-bold">
                  PEDIDO INCOMPLETO
                </span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Registra las unidades que llegaron y separa automáticamente el saldo faltante para reclamo.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <p className="font-bold text-white text-sm">{order.material_name_raw}</p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
              <span>Cantidad Original: <strong className="text-white">{originalQty} {order.unit_measure || 'un.'}</strong></span>
              <span>Buque: <strong className="text-cyan-300">{shp?.name || 'ASTILLERO'}</strong></span>
              <span>Proveedor: <strong className="text-slate-200">{sup?.name || 'S/D'}</strong></span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-950/60 rounded-xl border border-slate-800/80">
            <div>
              <label className="block text-emerald-400 font-bold mb-1">
                ✅ Cantidad Recibida Físicamente
              </label>
              <input
                type="number"
                step="any"
                min="0.01"
                max={originalQty - 0.01}
                value={receivedQty}
                onChange={(e) => setReceivedQty(e.target.value)}
                className="w-full bg-slate-900 border border-emerald-500/50 rounded-lg p-2.5 text-white font-mono font-bold text-sm focus:outline-none focus:border-emerald-400"
                required
              />
              <span className="text-[10px] text-slate-400 mt-1 block">
                Ingresan a Pañol / Obra
              </span>
            </div>

            <div>
              <label className="block text-orange-400 font-bold mb-1">
                ⚠️ Cantidad Faltante a Reclamar
              </label>
              <div className="w-full bg-slate-900 border border-orange-500/40 rounded-lg p-2.5 text-orange-300 font-mono font-extrabold text-sm flex items-center justify-between">
                <span>{missingQty}</span>
                <span className="text-xs text-slate-400 font-normal">{order.unit_measure || 'un.'}</span>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                Pasa a estado PEDIDO INCOMPLETO
              </span>
            </div>
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">
              Nº de Remito del Proveedor <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={remitoNumber}
              onChange={(e) => setRemitoNumber(e.target.value)}
              placeholder="Ej: R-0004-00012345"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white font-mono focus:outline-none focus:border-cyan-500"
              required
            />
          </div>

          <div>
            <label className="block text-slate-300 font-bold mb-1">
              Fotos del Remito y Mercadería (Evidencia para el Reclamo)
            </label>
            <input
              type="file"
              multiple
              onChange={(e) => setEvidenceFiles(Array.from(e.target.files))}
              className="w-full text-slate-300 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-cyan-950 file:text-cyan-400 hover:file:bg-cyan-900 cursor-pointer"
            />
            <span className="text-[10px] text-slate-500 mt-1 block">
              Se adjuntará automáticamente a la orden para respaldo de compras.
            </span>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Observaciones del Pañolero / Motivo informado por el chofer
            </label>
            <textarea
              rows="2"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Ej: Chofer informa que no había stock suficiente, entregan el saldo la próxima semana..."
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={processing}
              className="px-4 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-400 hover:to-amber-500 text-slate-950 font-extrabold rounded-lg shadow-md shadow-orange-500/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Split className="w-4 h-4 stroke-[2.5]" />}
              <span>{processing ? 'Procesando...' : 'Confirmar Recepción y Separar Faltante'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL: ALERTA SE COMPRA? (GERENCIA & JEFE DE OBRA)
// ==============================================================================
export function SeCompraAlertModal({ order, alertSettings, ships, workOrders, onClose }) {
  const shp = ships.find((s) => s.id === order.ship_id)
  const wo = workOrders.find((w) => w.id === order.work_order_id)

  const hugo = alertSettings?.hugo || { name: 'Hugo Sentis', phone: '+5492235000001', email: 'hugo@aloncar.com', enabled: true }
  const martin = alertSettings?.martin || { name: 'Martín Sentis', phone: '+5492235000002', email: 'martin@aloncar.com', enabled: true }

  const shipName = shp?.name || 'ASTILLERO'
  const otTitle = wo?.title || 'Stock'

  const messageText = `Alerta Alon Car - Compra 'SE COMPRA?':\nMaterial: ${order.material_name_raw} (${order.quantity} ${order.unit_measure || 'un.'})\nBuque: ${shipName} | OT: ${otTitle}\nSolicita: ${order.requested_by_name || 'PAÑOL'}\nPor favor confirmar si se procede con la adquisición.`

  function handleSendWhatsApp(phone) {
    const clean = phone.replace(/[^0-9]/g, '')
    const url = `https://web.whatsapp.com/send?phone=${clean}&text=${encodeURIComponent(messageText)}`
    window.open(url, '_blank')
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-950 border border-pink-800 flex items-center justify-center text-pink-400">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                Alerta Gerencial: "SE COMPRA?"
              </h3>
              <p className="text-[11px] text-slate-400">
                La compra requiere evaluación y confirmación de jefatura antes de emitirse.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-xs">
          <p className="font-bold text-white text-sm">{order.material_name_raw}</p>
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400 font-mono">
            <span>Cantidad: <strong className="text-white">{order.quantity} {order.unit_measure || 'un.'}</strong></span>
            <span>Buque: <strong className="text-cyan-300">{shipName}</strong></span>
            <span>OT: <strong className="text-slate-200">{otTitle}</strong></span>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <p className="font-bold text-slate-300">Destinatarios Notificados:</p>

          {hugo.enabled && (
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{hugo.name} (Gerente General)</p>
                <p className="text-[10px] text-slate-500 font-mono">{hugo.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => handleSendWhatsApp(hugo.phone)}
                className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <MessageSquare className="w-3 h-3" />
                <span>WhatsApp</span>
              </button>
            </div>
          )}

          {martin.enabled && (
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
              <div>
                <p className="font-semibold text-white">{martin.name} (Gerente Operaciones)</p>
                <p className="text-[10px] text-slate-500 font-mono">{martin.phone}</p>
              </div>
              <button
                type="button"
                onClick={() => handleSendWhatsApp(martin.phone)}
                className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 rounded font-bold text-[10px] flex items-center gap-1 cursor-pointer"
              >
                <MessageSquare className="w-3 h-3" />
                <span>WhatsApp</span>
              </button>
            </div>
          )}

          <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800 flex items-center justify-between">
            <div>
              <p className="font-semibold text-white">Jefe de Obra OT</p>
              <p className="text-[10px] text-slate-500">Asignado al buque {shipName}</p>
            </div>
            <span className="text-[10px] text-cyan-400 font-bold bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800">
              Notificado
            </span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-800 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold rounded-lg text-xs cursor-pointer shadow-md"
          >
            Entendido / Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL: ASIGNAR PROVEEDOR EN LOTE (CON BUSCADOR POR INICIALES)
// ==============================================================================
export function AssignSupplierModal({ selectedOrderIds, suppliers, onClose, onSuccess }) {
  const [searchText, setSearchText] = useState('')
  const [selectedSupplierId, setSelectedSupplierId] = useState(suppliers[0]?.id || '')
  const [saving, setSaving] = useState(false)

  const filteredSuppliers = useMemo(() => {
    const q = searchText.trim().toLowerCase()
    if (!q) return suppliers
    return suppliers.filter((s) => {
      const nameMatch = (s.name || '').toLowerCase().includes(q)
      const tradeMatch = (s.trade || '').toLowerCase().includes(q) || (s.trades || []).some((t) => t.toLowerCase().includes(q))
      return nameMatch || tradeMatch
    })
  }, [suppliers, searchText])

  async function handleAssign(e) {
    e.preventDefault()
    if (!selectedSupplierId) return alert('Por favor selecciona un proveedor.')

    setSaving(true)
    try {
      const idsArray = Array.from(selectedOrderIds)
      const { error } = await supabase
        .from('purchase_orders')
        .update({
          supplier_id: selectedSupplierId,
          updated_at: new Date().toISOString()
        })
        .in('id', idsArray)

      if (error) throw error

      const supName = suppliers.find(s => s.id === selectedSupplierId)?.name || 'Proveedor'
      for (const id of idsArray) {
        await auditService.logCellChange({
          sheetName: 'Compras · Pedidos',
          rowId: id,
          colKey: 'supplier_id',
          colLabel: 'Proveedor',
          oldValue: null,
          newValue: supName,
          entityName: supName,
          moduleRoute: '/compras'
        })
      }

      onSuccess(selectedSupplierId)
    } catch (err) {
      console.error('Error asignando proveedor en lote:', err)
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-950 border border-cyan-800 flex items-center justify-center text-cyan-400">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white flex items-center gap-2">
                Asignar Proveedor en Bloque
              </h3>
              <p className="text-[11px] text-slate-400">
                Se aplicará el proveedor elegido a los {selectedOrderIds.size} pedidos seleccionados.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        <form onSubmit={handleAssign} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Filtrar Proveedor por Nombre o Rubro
            </label>
            <input
              type="text"
              autoFocus
              value={searchText}
              onChange={(e) => {
                setSearchText(e.target.value)
                const q = e.target.value.trim().toLowerCase()
                const firstMatch = suppliers.find((s) => (s.name || '').toLowerCase().includes(q))
                if (firstMatch) setSelectedSupplierId(firstMatch.id)
              }}
              placeholder="Escribir iniciales (ej: FER, AIR, PRAX...)"
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-white mb-2 focus:outline-none focus:border-cyan-500"
            />

            <label className="block text-slate-400 font-semibold mb-1 text-[11px]">
              Resultados ({filteredSuppliers.length}):
            </label>
            <select
              value={selectedSupplierId}
              onChange={(e) => setSelectedSupplierId(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-white font-semibold focus:outline-none focus:border-cyan-500"
              required
            >
              {filteredSuppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.trade || (s.trades && s.trades.join(', ')) || 'General'})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-slate-950 font-extrabold rounded-lg shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 stroke-[2.5]" />}
              <span>{saving ? 'Asignando...' : `Asignar a ${selectedOrderIds.size} Pedidos`}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// COMPONENTE: BUSCADOR IN-SITU DE PROVEEDOR
// ==============================================================================
export function InlineSupplierPicker({ suppliers, currentSupplierId, onSelect, onCancel }) {
  const currentSup = suppliers.find((s) => s.id === currentSupplierId)
  const [query, setQuery] = useState('')
  const [highlightIdx, setHighlightIdx] = useState(0)
  const containerRef = useRef(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return suppliers.slice(0, 50)
    return suppliers.filter((s) => {
      const nameMatch = (s.name || '').toLowerCase().includes(q)
      const tradeMatch = (s.trade || '').toLowerCase().includes(q) || (s.trades || []).some((t) => t.toLowerCase().includes(q))
      return nameMatch || tradeMatch
    })
  }, [suppliers, query])

  useEffect(() => {
    setHighlightIdx(0)
  }, [query])

  useEffect(() => {
    function handleClickOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        onCancel()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onCancel])

  function handleKeyDown(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightIdx((prev) => Math.min(prev + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightIdx((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filtered[highlightIdx]) {
        onSelect(filtered[highlightIdx].id)
      }
    }
  }

  return (
    <div ref={containerRef} className="relative z-50 min-w-[200px]">
      <input
        type="text"
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={currentSup ? `Actual: ${currentSup.name} (filtrar...)` : 'Escribir iniciales...'}
        className="w-full bg-slate-950 border-2 border-cyan-400 rounded-lg px-2 py-1 text-xs text-white placeholder-slate-400 focus:outline-none shadow-lg"
      />
      <div className="absolute left-0 top-full mt-1 w-64 max-h-56 overflow-y-auto bg-slate-900 border border-slate-700 rounded-xl shadow-2xl z-50 divide-y divide-slate-800/80 text-xs">
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="w-full text-left px-3 py-1.5 text-slate-400 hover:bg-slate-800 hover:text-rose-300 text-[11px] italic cursor-pointer"
        >
          -- Sin Proveedor (Quitar asignación) --
        </button>
        {filtered.length === 0 ? (
          <div className="px-3 py-2.5 text-slate-500 text-center text-[11px]">
            Sin coincidencias para "{query}"
          </div>
        ) : (
          filtered.map((s, idx) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onSelect(s.id)}
              onMouseEnter={() => setHighlightIdx(idx)}
              className={`w-full text-left px-3 py-1.5 flex items-center justify-between gap-2 transition-colors cursor-pointer ${
                idx === highlightIdx ? 'bg-cyan-950 text-cyan-200 font-bold' : 'text-slate-200 hover:bg-slate-800'
              }`}
            >
              <span className="truncate">{s.name}</span>
              <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 shrink-0">
                {s.trade || (s.trades && s.trades[0]) || 'Gral'}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL: ASIGNAR DATOS DE FLETE Y TRANSPORTE
// ==============================================================================
export function FreightModal({ order, onClose, onSuccess }) {
  const todayIso = new Date().toISOString().split('T')[0]
  const [transportName, setTransportName] = useState(order?.freight_transport_name || '')
  const [requestDate, setRequestDate] = useState(order?.freight_request_date || todayIso)
  const [estimatedDate, setEstimatedDate] = useState(order?.freight_estimated_date || '')

  function handleSubmit(e) {
    e.preventDefault()
    onSuccess({
      freight_transport_name: transportName.trim() || null,
      freight_request_date: requestDate || null,
      freight_estimated_date: estimatedDate || null
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-amber-400" />
              Datos de Flete / Transporte
            </h3>
            <p className="text-xs text-slate-400 truncate max-w-[320px]">
              Material: <strong className="text-slate-200">{order?.material_name}</strong>
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label className="block text-slate-300 mb-1 font-bold">Nombre del Transporte / Comisionista</label>
            <input
              type="text"
              autoFocus
              placeholder="Ej: Cruz del Sur / Expreso Tas / Flete propio..."
              value={transportName}
              onChange={(e) => setTransportName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 mb-1 font-bold">Fecha de Solicitud</label>
              <input
                type="date"
                value={requestDate}
                onClick={(e) => {
                  if (typeof e.currentTarget.showPicker === 'function') {
                    try { e.currentTarget.showPicker() } catch { /* ignore */ }
                  }
                }}
                onChange={(e) => setRequestDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-white font-mono focus:outline-none focus:border-amber-400 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Por defecto hoy (editable)</span>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-bold">Fecha Entrega Estimada (Flete)</label>
              <input
                type="date"
                value={estimatedDate}
                onClick={(e) => {
                  if (typeof e.currentTarget.showPicker === 'function') {
                    try { e.currentTarget.showPicker() } catch { /* ignore */ }
                  }
                }}
                onChange={(e) => setEstimatedDate(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-amber-200 font-mono focus:outline-none focus:border-amber-400 cursor-pointer"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Independiente de F. Entrega tabla</span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-3 border-t border-slate-800">
            {(order?.freight_transport_name || order?.freight_request_date || order?.freight_estimated_date) ? (
              <button
                type="button"
                onClick={() =>
                  onSuccess({
                    freight_transport_name: null,
                    freight_request_date: null,
                    freight_estimated_date: null
                  })
                }
                className="px-3 py-2 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold rounded-lg cursor-pointer"
              >
                Limpiar Flete
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-lg shadow-lg shadow-amber-500/20 cursor-pointer"
              >
                Guardar Flete
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL: ASISTENTE INTELIGENTE DE SELECCIÓN DE PROVEEDOR
// ==============================================================================
export function SupplierHelperModal({ order, purchaseOrders, suppliers, ships, workOrders, onClose, onApply }) {
  const [activeTab, setActiveTab] = useState('material')
  const [selectedTrade, setSelectedTrade] = useState('')
  const [searchDesc, setSearchDesc] = useState('')
  const [applyingId, setApplyingId] = useState(null)

  const rawMaterialName = (order?.material_name_raw || '').trim()

  const { materialHistory, totalMaterialMatches } = useMemo(() => {
    if (!rawMaterialName) return { materialHistory: [], totalMaterialMatches: 0 }

    const normalize = (str) =>
      (str || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/["'”’]/g, '"')
        .replace(/\s+/g, ' ')
        .trim()

    const normTarget = normalize(rawMaterialName)
    const validOrders = purchaseOrders.filter((po) => po.id !== order.id && Boolean(po.supplier_id))

    let matches = validOrders.filter((po) => {
      const normName = normalize(po.material_name_raw)
      if (!normName) return false
      if (normName === normTarget) return true
      if (normTarget.length >= 4 && (normName.includes(normTarget) || normTarget.includes(normName))) return true
      return false
    })

    if (matches.length === 0) {
      const tokens = normTarget
        .split(/[\s,;-]+/)
        .map((t) => t.trim())
        .filter((t) => t.length > 1 && !['de', 'la', 'el', 'en', 'para', 'con', 'x'].includes(t))

      if (tokens.length > 0) {
        const primaryNoun = tokens.find((t) => !/^\d+/.test(t)) || tokens[0]

        matches = validOrders.filter((po) => {
          const normName = normalize(po.material_name_raw)
          if (!normName) return false
          if (primaryNoun && !normName.includes(primaryNoun)) return false

          const matchedCount = tokens.filter((t) => normName.includes(t)).length
          const matchRatio = matchedCount / tokens.length
          return tokens.length <= 2 ? matchedCount === tokens.length : matchRatio >= 0.75
        })
      }
    }

    if (matches.length === 0) return { materialHistory: [], totalMaterialMatches: 0 }

    const totalMatches = matches.length
    const groupMap = new Map()

    matches.forEach((po) => {
      const sup = suppliers.find((s) => s.id === po.supplier_id)
      if (!sup) return

      if (!groupMap.has(po.supplier_id)) {
        groupMap.set(po.supplier_id, {
          supplier: sup,
          count: 0,
          orders: []
        })
      }
      const entry = groupMap.get(po.supplier_id)
      entry.count++
      entry.orders.push(po)
    })

    const results = Array.from(groupMap.values()).map((item) => {
      item.orders.sort((a, b) => new Date(b.order_date || 0) - new Date(a.order_date || 0))
      const last = item.orders[0]
      const lastPrice = last.supplier_quoted_price || last.system_unit_price || null
      const percentage = Math.round((item.count / totalMatches) * 100)

      return {
        supplier: item.supplier,
        count: item.count,
        totalMatches,
        percentage,
        lastPrice,
        lastDate: last.order_date,
        lastOrder: last
      }
    })

    results.sort((a, b) => b.count - a.count)
    return { materialHistory: results, totalMaterialMatches: totalMatches }
  }, [rawMaterialName, purchaseOrders, suppliers, order.id])

  useEffect(() => {
    if (materialHistory.length === 0 && activeTab === 'material') {
      setActiveTab('trade')
    }
  }, [materialHistory, activeTab])

  const tradeSuppliers = useMemo(() => {
    if (!selectedTrade) return []
    const cleanTrade = selectedTrade.toUpperCase()

    const sups = suppliers.filter((s) => {
      if (s.trades && Array.isArray(s.trades) && s.trades.includes(cleanTrade)) return true
      if (s.trade && s.trade.toUpperCase().includes(cleanTrade)) return true
      return false
    })

    const results = sups.map((sup) => {
      let lastPrice = null
      let lastDate = null
      const supOrders = purchaseOrders.filter((po) => po.supplier_id === sup.id)
      const count = supOrders.length

      if (searchDesc.trim()) {
        const qDesc = searchDesc.toLowerCase()
        const descMatches = supOrders.filter((po) => (po.material_name_raw || '').toLowerCase().includes(qDesc))
        if (descMatches.length > 0) {
          descMatches.sort((a, b) => new Date(b.order_date || 0) - new Date(a.order_date || 0))
          lastPrice = descMatches[0].supplier_quoted_price || descMatches[0].system_unit_price || null
          lastDate = descMatches[0].order_date
        }
      } else if (supOrders.length > 0) {
        supOrders.sort((a, b) => new Date(b.order_date || 0) - new Date(a.order_date || 0))
        lastPrice = supOrders[0].supplier_quoted_price || supOrders[0].system_unit_price || null
        lastDate = supOrders[0].order_date
      }

      return {
        supplier: sup,
        count,
        lastPrice,
        lastDate
      }
    })

    const maxCount = Math.max(1, ...results.map((r) => r.count))
    return results.map((r) => ({
      ...r,
      percentage: Math.round((r.count / maxCount) * 100)
    })).sort((a, b) => b.count - a.count)
  }, [selectedTrade, suppliers, purchaseOrders, searchDesc])

  async function handleFastLoad(entry) {
    setApplyingId(entry.supplier.id)
    const today = new Date().toISOString().split('T')[0]
    const updates = {
      supplier_id: entry.supplier.id,
      order_date: order.order_date || today,
      supplier_quoted_price: entry.lastPrice ?? order.supplier_quoted_price ?? null,
      system_unit_price: entry.lastPrice ?? order.system_unit_price ?? null
    }
    await onApply(order.id, updates)
    setApplyingId(null)
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl p-6 space-y-4 shadow-2xl animate-in fade-in duration-150">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-lg shadow-amber-500/10">
              <Lightbulb className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Asistente Inteligente de Proveedores
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-300 uppercase font-black">
                  Frecuencia & Métricas
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Material solicitado:{' '}
                <strong className="text-white font-mono">{order.material_name_raw || 'Sin material especificado'}</strong>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg cursor-pointer">✕</button>
        </div>

        <div className="flex items-center gap-2 border-b border-slate-800/80 pb-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('material')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'material'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>Histórico del Material</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-black ${
              activeTab === 'material' ? 'bg-slate-950 text-amber-300' : 'bg-slate-800 text-slate-300'
            }`}>
              {totalMaterialMatches}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('trade')}
            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'trade'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            <span>Buscar por Rubro de Proveedor</span>
          </button>
        </div>

        {activeTab === 'material' && (
          <div className="space-y-3">
            {materialHistory.length > 0 ? (
              <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                {materialHistory.map((entry) => (
                  <div
                    key={entry.supplier.id}
                    className="p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-amber-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-white text-xs">{entry.supplier.name}</span>
                        {entry.supplier.is_local_supplier && (
                          <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 text-[9px] font-bold">
                            Local MDP
                          </span>
                        )}
                        {entry.supplier.phone && (
                          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <Phone className="w-2.5 h-2.5 text-cyan-400" />
                            {entry.supplier.phone}
                          </span>
                        )}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-amber-400 font-bold">
                            {entry.count} de {entry.totalMatches} compra(s) ({entry.percentage}% de frecuencia)
                          </span>
                          {entry.lastPrice && (
                            <span className="text-emerald-400 font-bold">
                              Último: ${Number(entry.lastPrice).toLocaleString('es-AR')} {entry.lastDate ? `(${entry.lastDate})` : ''}
                            </span>
                          )}
                        </div>
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-amber-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                            style={{ width: `${entry.percentage}%` }}
                          />
                        </div>
                      </div>

                      {entry.supplier.address && (
                        <p className="text-[10px] text-slate-500 truncate">
                          📍 {entry.supplier.address}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={applyingId === entry.supplier.id}
                      onClick={() => handleFastLoad(entry)}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 shrink-0 transition-all cursor-pointer disabled:opacity-50"
                    >
                      {applyingId === entry.supplier.id ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Zap className="w-3.5 h-3.5 fill-slate-950" />
                      )}
                      <span>⚡ Cargar Pedido</span>
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-6 bg-slate-950 rounded-xl border border-slate-800 text-center space-y-2">
                <AlertCircle className="w-6 h-6 text-amber-400 mx-auto" />
                <p className="text-xs text-white font-bold">No hay compras previas registradas para este material exacto.</p>
                <p className="text-[11px] text-slate-400">
                  Usa la pestaña <strong>"Buscar por Rubro de Proveedor"</strong> para sugerir proveedores del sector según su frecuencia de compra.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'trade' && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800 text-xs">
              <div>
                <label className="block text-slate-400 mb-1 font-semibold">1. Seleccionar Rubro del Proveedor</label>
                <select
                  value={selectedTrade}
                  onChange={(e) => setSelectedTrade(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-bold focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Seleccionar Rubro --</option>
                  {STANDARD_TRADES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">2. Descripción / Filtro Opcional</label>
                <input
                  type="text"
                  placeholder="Ej: planchuela, bulón, electrodo..."
                  value={searchDesc}
                  onChange={(e) => setSearchDesc(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {selectedTrade ? (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {tradeSuppliers.length > 0 ? (
                  tradeSuppliers.map((entry) => (
                    <div
                      key={entry.supplier.id}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl hover:border-amber-500/40 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                    >
                      <div className="space-y-1 flex-1 min-w-0 text-xs">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-white">{entry.supplier.name}</span>
                          {entry.supplier.is_local_supplier && (
                            <span className="px-1.5 py-0.2 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 text-[9px] font-bold">
                              Local MDP
                            </span>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">
                            {entry.supplier.phone ? `📞 ${entry.supplier.phone}` : ''}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>{entry.count} compra(s) en {selectedTrade}</span>
                          {entry.lastPrice && (
                            <span className="text-emerald-400 font-bold">
                              Ref: ${Number(entry.lastPrice).toLocaleString('es-AR')}
                            </span>
                          )}
                        </div>
                        {entry.supplier.address && (
                          <p className="text-[10px] text-slate-500 truncate">📍 {entry.supplier.address}</p>
                        )}
                      </div>

                      <button
                        type="button"
                        disabled={applyingId === entry.supplier.id}
                        onClick={() => handleFastLoad(entry)}
                        className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 flex items-center gap-1.5 shrink-0 transition-all cursor-pointer disabled:opacity-50"
                      >
                        {applyingId === entry.supplier.id ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Zap className="w-3.5 h-3.5 fill-slate-950" />
                        )}
                        <span>⚡ Cargar Pedido</span>
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="p-4 text-center text-xs text-slate-500 italic">
                    No se encontraron proveedores registrados con el rubro "{selectedTrade}".
                  </p>
                )}
              </div>
            ) : (
              <p className="p-4 text-center text-xs text-slate-500 italic">
                Selecciona un rubro arriba para ver los proveedores sugeridos y sus métricas de compra.
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between pt-3 border-t border-slate-800 text-xs">
          <span className="text-[11px] text-slate-500">
            💡 Asigna proveedor y último precio registrado. Soporta Ctrl+Z para deshacer.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}

// ==============================================================================
// MODAL: GESTIÓN DE MANDADOS Y RETIROS LOCALES POR WHATSAPP
// ==============================================================================
export function MandadosModal({ purchaseOrders, suppliers, workers, preselectedIds = [], onDispatched, onClose }) {
  const candidateOrders = useMemo(() => {
    return purchaseOrders.filter((po) => {
      if (preselectedIds.includes(po.id)) return true
      if (!['PEDIDO', 'PEDIDO INCOMPLETO'].includes(po.status)) return false
      const sup = suppliers.find((s) => s.id === po.supplier_id)
      return Boolean(sup?.is_local_supplier)
    })
  }, [purchaseOrders, suppliers, preselectedIds])

  const [selectedIds, setSelectedIds] = useState(() => {
    if (preselectedIds.length > 0) return new Set(preselectedIds)
    return new Set(candidateOrders.map((p) => p.id))
  })

  const defaultWorker = useMemo(() => {
    const mandadero = workers.find((w) => (w.trade || '').toUpperCase().includes('MANDADO'))
    if (mandadero) return mandadero.id
    const withPhone = workers.find((w) => w.phone && w.phone.trim())
    return withPhone?.id || (workers[0]?.id || '')
  }, [workers])

  const [selectedWorkerId, setSelectedWorkerId] = useState(defaultWorker)
  const [copied, setCopied] = useState(false)

  const selectedWorker = useMemo(() => {
    return workers.find((w) => w.id === selectedWorkerId)
  }, [workers, selectedWorkerId])

  const groupedOrders = useMemo(() => {
    const groups = new Map()
    selectedIds.forEach((id) => {
      const po = candidateOrders.find((p) => p.id === id)
      if (!po) return
      const sup = suppliers.find((s) => s.id === po.supplier_id)
      const supKey = sup?.id || 'SIN_PROV'
      const supName = sup?.name || 'PROVEEDOR S/D'
      const supAddress = sup?.address || 'Mar del Plata'

      if (!groups.has(supKey)) {
        groups.set(supKey, {
          supplier: sup,
          name: supName,
          address: supAddress,
          items: []
        })
      }
      groups.get(supKey).items.push(po)
    })
    return Array.from(groups.values())
  }, [selectedIds, candidateOrders, suppliers])

  const messageText = useMemo(() => {
    const workerFirstName = (selectedWorker?.name || 'compañero').split(',')[0].split(' ')[0].toLowerCase()
    let msg = `buenas ${workerFirstName}, podes pasar a retirar por favor:\n\n`

    groupedOrders.forEach((grp) => {
      msg += `*${grp.name}* (${grp.address}):\n`
      grp.items.forEach((it) => {
        const qty = Number(it.quantity) || 1
        const u = it.unit_measure ? ` ${it.unit_measure}` : ''
        const mat = it.material_name_raw || 'Material'
        msg += ` - ${qty}${u} ${mat}\n`
      })
      msg += '\n'
    })

    msg += `*Por favor retirar remito/factura.*`.trim()
    return msg
  }, [groupedOrders, selectedWorker])

  function toggleSelectAll() {
    if (selectedIds.size === candidateOrders.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(candidateOrders.map((p) => p.id)))
    }
  }

  function toggleItem(id) {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  function handleCopy() {
    navigator.clipboard.writeText(messageText)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  async function handleSendWhatsApp() {
    const cleanPhone = (selectedWorker?.phone || '').replace(/\D/g, '')
    if (!cleanPhone) {
      alert(`El operario "${selectedWorker?.name || 'seleccionado'}" no tiene cargado un número de teléfono en Nómina. Por favor agrégalo en el módulo Personal o copia el mensaje manualmente.`)
      return
    }
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
    window.open(url, '_blank')

    const dispatchedIds = Array.from(selectedIds)
    const dispatchInfo = {
      courier_dispatched: true,
      courier_dispatched_at: new Date().toISOString(),
      courier_worker_id: selectedWorker?.id || null,
      courier_worker_name: selectedWorker?.name || null
    }

    try {
      await supabase
        .from('purchase_orders')
        .update(dispatchInfo)
        .in('id', dispatchedIds)

      for (const id of dispatchedIds) {
        await auditService.logRowAction({
          action: 'DISPATCH',
          entityType: 'purchase_orders',
          entityId: id,
          entityName: candidateOrders.find(it => it.id === id)?.material_name_raw,
          sheetName: 'Compras · Pedidos',
          moduleRoute: '/compras',
          details: { worker: selectedWorker?.name, dispatchedAt: dispatchInfo.courier_dispatched_at }
        })
      }
    } catch (err) {
      console.error('Error registrando despacho de mandado en Supabase:', err)
    }

    if (onDispatched) {
      onDispatched(dispatchedIds, dispatchInfo)
    }

    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-3xl p-6 space-y-4 shadow-2xl animate-in fade-in duration-150">
        <div className="flex items-start justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 shadow-lg shadow-cyan-500/10 text-xl">
              🛵
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Pedido de Mandado (Retiro Local)
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 uppercase font-black">
                  WhatsApp Inteligente
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Selecciona los materiales emitidos a retirar de proveedores locales y envía la orden agrupada al mandadero en 1 clic.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white text-lg cursor-pointer">✕</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs">
          <div>
            <label className="block text-slate-300 font-semibold mb-1">
              Operario Responsable de Mandados
            </label>
            <select
              value={selectedWorkerId}
              onChange={(e) => setSelectedWorkerId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white font-bold focus:outline-none focus:border-cyan-500"
            >
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} {w.trade ? `(${w.trade})` : ''} {w.phone ? `• ${w.phone}` : '• S/Tel'}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col justify-center">
            <span className="text-slate-400 text-[11px]">Destino de Notificación:</span>
            <div className="flex items-center gap-2 mt-0.5 font-mono text-xs">
              <span className="text-white font-bold">{selectedWorker?.name || 'Sin seleccionar'}</span>
              {selectedWorker?.phone ? (
                <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-800 text-emerald-300 font-bold">
                  {selectedWorker.phone}
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300">
                  ⚠️ Sin Teléfono
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-300">
                Materiales Emitidos a Prov. Locales ({selectedIds.size}/{candidateOrders.length})
              </span>
              <button
                type="button"
                onClick={toggleSelectAll}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
              >
                {selectedIds.size === candidateOrders.length ? 'Deseleccionar todos' : 'Seleccionar todos'}
              </button>
            </div>

            <div className="max-h-[300px] overflow-y-auto space-y-1.5 pr-1">
              {candidateOrders.length > 0 ? (
                candidateOrders.map((po) => {
                  const isChecked = selectedIds.has(po.id)
                  const sup = suppliers.find((s) => s.id === po.supplier_id)
                  return (
                    <label
                      key={po.id}
                      className={`p-2.5 rounded-xl border flex items-start gap-2.5 text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-cyan-950/40 border-cyan-500/50 text-white'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleItem(po.id)}
                        className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-cyan-500 cursor-pointer"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-white truncate">{po.material_name_raw || 'Material'}</p>
                        <p className="text-[10px] text-slate-400 truncate">
                          {Number(po.quantity) || 1} {po.unit_measure || 'un.'} • <strong className="text-cyan-300">{sup?.name || 'S/Prov'}</strong> {sup?.address ? `(${sup.address})` : ''}
                        </p>
                      </div>
                    </label>
                  )
                })
              ) : (
                <div className="p-4 bg-slate-950 rounded-xl border border-slate-800 text-center text-xs text-slate-500">
                  No hay pedidos pendientes de retiro de proveedores locales.
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 flex flex-col">
            <span className="font-bold text-slate-300 text-xs flex items-center gap-1.5">
              <span>Vista Previa del Mensaje</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono">WhatsApp</span>
            </span>

            <div className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs font-mono text-emerald-200/90 whitespace-pre-wrap max-h-[300px] overflow-y-auto leading-relaxed shadow-inner">
              {messageText}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white font-semibold rounded-xl cursor-pointer"
          >
            Cancelar
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold flex items-center gap-1.5 transition-all cursor-pointer border border-slate-700"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? '¡Copiado!' : 'Copiar Mensaje'}</span>
            </button>

            <button
              type="button"
              disabled={selectedIds.size === 0}
              onClick={handleSendWhatsApp}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black flex items-center gap-2 shadow-lg shadow-emerald-600/25 transition-all cursor-pointer disabled:opacity-50"
            >
              <MessageSquare className="w-4 h-4 stroke-[2.5]" />
              <span>Enviar WhatsApp a {selectedWorker?.name?.split(',')[0]?.split(' ')[0] || 'Mandadero'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
