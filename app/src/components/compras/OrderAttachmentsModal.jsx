import { useState } from 'react'
import { Paperclip, ExternalLink, SlidersHorizontal, Plus, RefreshCw, Upload, FileText } from 'lucide-react'
import { extractTextFromPdf } from '../../lib/pdfTextExtractor'
import { DOC_TYPE_OPTIONS, getDocTypeBadge } from '../../lib/comprasAuxHelpers'
import { uploadPurchaseAttachmentsService } from '../../services/comprasAuxService'
import { DocActionModal } from './ComprasOcrPanel'

export function OrderAttachmentsModal({ order, documents, suppliers, ships, onClose, onDocAdded, onDocUpdated, onDocDeleted }) {
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
      const uploadedDocs = await uploadPurchaseAttachmentsService({
        order,
        supplierName: sup?.name || 'Proveedor',
        rows: validRows,
        extractPdfFn: extractTextFromPdf
      })
      uploadedDocs.forEach((doc) => onDocAdded(doc))
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
              {lineDocs.map((doc) => {
                const badge = getDocTypeBadge(doc.doc_type)
                return (
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
                          <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${badge.className}`}>
                            {badge.label}
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
                )
              })}
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
                        {DOC_TYPE_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
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
              if (action === 'delete') onDocDeleted(deletedId)
              else onDocUpdated(updatedDoc)
              setShowDocAction(null)
            }}
          />
        )}
      </div>
    </div>
  )
}
