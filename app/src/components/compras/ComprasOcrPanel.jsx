import { useState, useMemo } from 'react'
import {
  FileText,
  SlidersHorizontal,
  List,
  LayoutGrid,
  Paperclip,
  Plus,
  Trash2,
  Search,
  X,
  FileCheck,
  Eye,
  ExternalLink
} from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { extractTextFromPdf } from '../../lib/pdfTextExtractor'

export function UploadDocModal({ order, supplier, onClose, onSuccess }) {
  const [pendingDocs, setPendingDocs] = useState([
    { id: 1, docType: 'COTIZACION_MATERIAL', file: null, description: '' }
  ])
  const [uploading, setUploading] = useState(false)

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

  async function handleUpload(e) {
    e.preventDefault()
    const validRows = pendingDocs.filter((r) => r.file !== null)
    if (validRows.length === 0) return alert('Por favor selecciona al menos un archivo para subir.')

    setUploading(true)
    try {
      const year = new Date().getFullYear()
      const rubro = order?.work_type || 'General'
      const safeProv = (supplier?.name || 'Proveedor').replace(/[^a-zA-Z0-9_-]/g, '_')
      const createdDocs = []

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
          purchase_order_id: order?.id || null,
          supplier_id: supplier?.id || null,
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
        createdDocs.push(newDoc)
      }

      onSuccess(createdDocs)
    } catch (err) {
      console.error('Error subiendo documentos:', err)
      alert('Error subiendo archivos: ' + err.message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Paperclip className="w-5 h-5 text-cyan-400" />
            Adjuntar Documento(s) a Compra
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <form onSubmit={handleUpload} className="space-y-4 text-xs">
          {order && (
            <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
              <p className="font-semibold text-white truncate">{order.material_name_raw}</p>
              <p className="text-[10px] text-slate-400">Proveedor: {supplier?.name || 'S/D'}</p>
            </div>
          )}

          <div className="space-y-3">
            {pendingDocs.map((row, idx) => (
              <div key={row.id} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-3 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-cyan-400">
                    Adjunto #{idx + 1}
                  </span>
                  {pendingDocs.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(row.id)}
                      className="text-rose-400 hover:text-rose-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                    >
                      ✕ Quitar
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Tipo de Documento</label>
                  <select
                    value={row.docType}
                    onChange={(e) => handleChangeRow(row.id, 'docType', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500 font-semibold"
                  >
                    <option value="COTIZACION_MATERIAL">📄 Cotización de Material (Visible en Compras)</option>
                    <option value="COTIZACION_MANO_OBRA">🔒 Cotización de Mano de Obra (Confidencial Supervisor)</option>
                    <option value="FICHA_TECNICA">📐 Ficha Técnica / Especificación de Fabricante</option>
                    <option value="IMAGEN_MUESTRA">📸 Imagen / Fotografía de Muestra o Rotura</option>
                    <option value="REMITO">🧾 Remito de Entrega</option>
                    <option value="FACTURA">💳 Factura Comercial</option>
                  </select>
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

                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Descripción Breve</label>
                  <input
                    type="text"
                    placeholder="Ej: Presupuesto Tubos, Ficha Acero Naval..."
                    value={row.description}
                    onChange={(e) => handleChangeRow(row.id, 'description', e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-950/70 hover:bg-emerald-900 border border-emerald-500/60 text-emerald-300 text-xs font-extrabold transition-all cursor-pointer shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-400" />
              <span>+ Agregar otro adjunto</span>
            </button>
            <span className="text-[10px] text-slate-500">{pendingDocs.length} archivo(s) a subir</span>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-lg cursor-pointer">
              Cancelar
            </button>
            <button type="submit" disabled={uploading} className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-slate-950 font-extrabold rounded-lg cursor-pointer">
              {uploading ? 'Subiendo y clasificando...' : `Subir ${pendingDocs.length > 1 ? `${pendingDocs.length} Documentos` : 'Documento'}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function DocActionModal({ doc, onClose, onSuccess }) {
  const [description, setDescription] = useState(doc.description || '')
  const [docType, setDocType] = useState(doc.doc_type || 'COTIZACION_MATERIAL')
  const [newFile, setNewFile] = useState(null)
  const [processing, setProcessing] = useState(false)

  async function handleUpdateMetadata(e) {
    e.preventDefault()
    setProcessing(true)
    try {
      const updates = {
        description: description.trim(),
        doc_type: docType,
        is_confidential_labor: docType === 'COTIZACION_MANO_OBRA'
      }
      const { data, error } = await supabase.from('purchase_documents').update(updates).eq('id', doc.id).select().single()
      if (error) throw error
      onSuccess({ action: 'update', updatedDoc: data })
    } catch (err) {
      alert('Error actualizando metadatos: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleReplaceFile() {
    if (!newFile) return alert('Por favor selecciona el nuevo archivo físico.')
    if (!confirm('¿Reemplazar el archivo anterior por este nuevo? El archivo anterior será eliminado de la nube.')) return

    setProcessing(true)
    try {
      const year = new Date().getFullYear()
      const rubro = doc.category || 'General'
      const ext = newFile.name.split('.').pop()
      const safeDesc = (description || 'Doc').replace(/[^a-zA-Z0-9_-]/g, '_')
      const normalizedName = `${safeDesc}_reemplazo.${ext}`
      const storagePath = `cotizaciones/${year}/${rubro}/${Date.now()}_${normalizedName}`

      const { error: uploadError } = await supabase.storage.from('compras').upload(storagePath, newFile)
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('compras').getPublicUrl(storagePath)

      const updates = {
        original_filename: newFile.name,
        normalized_filename: normalizedName,
        storage_path: urlData.publicUrl,
        file_size_bytes: newFile.size
      }

      const { data, error } = await supabase.from('purchase_documents').update(updates).eq('id', doc.id).select().single()
      if (error) throw error

      onSuccess({ action: 'replace', updatedDoc: data })
    } catch (err) {
      alert('Error reemplazando archivo: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  async function handleDeleteDoc() {
    if (!confirm(`¿Eliminar definitivamente el documento "${doc.original_filename}"? Se borrará el archivo de la nube.`)) return
    setProcessing(true)
    try {
      const { error: dbError } = await supabase.from('purchase_documents').delete().eq('id', doc.id)
      if (dbError) throw dbError

      onSuccess({ action: 'delete', deletedId: doc.id })
    } catch (err) {
      alert('Error eliminando documento: ' + err.message)
    } finally {
      setProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-cyan-400" />
            Gestionar Archivo Adjunto
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
        </div>

        <div className="space-y-4 text-xs">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
            <p className="font-bold text-white truncate">{doc.original_filename}</p>
            <p className="text-[10px] text-slate-500 font-mono mt-0.5">Fecha: {new Date(doc.created_at).toLocaleDateString('es-AR')}</p>
          </div>

          <form onSubmit={handleUpdateMetadata} className="space-y-3">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Tipo de Documento</label>
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500 font-semibold"
              >
                <option value="COTIZACION_MATERIAL">📄 Cotización de Material</option>
                <option value="COTIZACION_MANO_OBRA">🔒 Cotización de Mano de Obra (Confidencial)</option>
                <option value="FICHA_TECNICA">📐 Ficha Técnica</option>
                <option value="IMAGEN_MUESTRA">📸 Imagen / Foto de Muestra</option>
                <option value="REMITO">🧾 Remito</option>
                <option value="FACTURA">💳 Factura Comercial</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Descripción</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-white focus:outline-none focus:border-cyan-500"
              />
            </div>

            <button
              type="submit"
              disabled={processing}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg transition-colors cursor-pointer"
            >
              Guardar Cambios de Metadatos
            </button>
          </form>

          {/* Reemplazo de archivo físico */}
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <label className="block text-slate-400 font-semibold">Reemplazar Archivo Físico</label>
            <input
              type="file"
              onChange={(e) => setNewFile(e.target.files[0])}
              className="w-full text-slate-300 file:mr-2 file:py-1.5 file:px-2.5 file:rounded-md file:border-0 file:text-[11px] file:bg-slate-800 file:text-cyan-300"
            />
            {newFile && (
              <button
                type="button"
                onClick={handleReplaceFile}
                disabled={processing}
                className="w-full py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold rounded-lg transition-all cursor-pointer"
              >
                Subir y Reemplazar Archivo
              </button>
            )}
          </div>

          {/* Eliminar definitivo */}
          <div className="pt-3 border-t border-slate-800 flex justify-end">
            <button
              type="button"
              onClick={handleDeleteDoc}
              disabled={processing}
              className="px-3 py-1.5 bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Eliminar Documento</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ComprasOcrPanel({
  documents = [],
  setDocuments,
  purchaseOrders = [],
  suppliers = [],
  ships = [],
  workOrders = [],
  reloadDocs
}) {
  const [docsViewMode, setDocsViewMode] = useState('lista')
  const [searchQuery, setSearchQuery] = useState('')
  const [filterDocType, setFilterDocType] = useState('TODOS')
  const [selectedDocAction, setSelectedDocAction] = useState(null)
  const [showDocActionModal, setShowDocActionModal] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)

  const filteredDocs = useMemo(() => {
    return documents.filter((d) => {
      if (filterDocType !== 'TODOS' && d.doc_type !== filterDocType) return false
      if (searchQuery && searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const fn = (d.original_filename || '').toLowerCase()
        const desc = (d.description || '').toLowerCase()
        const cat = (d.category || '').toLowerCase()
        const txt = (d.extracted_text || '').toLowerCase()
        if (!fn.includes(q) && !desc.includes(q) && !cat.includes(q) && !txt.includes(q)) return false
      }
      return true
    })
  }, [documents, filterDocType, searchQuery])

  const handleDocSuccess = ({ action, updatedDoc, deletedId }) => {
    if (action === 'delete') {
      setDocuments?.((prev) => prev.filter((d) => d.id !== deletedId))
    } else if (action === 'update' || action === 'replace') {
      setDocuments?.((prev) => prev.map((d) => (d.id === updatedDoc.id ? updatedDoc : d)))
    }
    setShowDocActionModal(false)
    setSelectedDocAction(null)
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span>Gestor Documental & Archivo OCR de Compras</span>
            <span className="text-xs px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono font-bold">
              {filteredDocs.length} de {documents.length} archivos
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cotizaciones de materiales, fichas técnicas de fabricantes, remitos y facturas con búsqueda indexada por texto OCR.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => setDocsViewMode('lista')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                docsViewMode === 'lista' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>Vista Lista</span>
            </button>
            <button
              onClick={() => setDocsViewMode('fichas')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                docsViewMode === 'fichas' ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' : 'text-slate-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>Vista Fichas</span>
            </button>
          </div>

          <button
            onClick={() => setShowUploadModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:brightness-110 text-slate-950 text-xs font-black rounded-xl shadow-md cursor-pointer transition-all"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Subir Documento</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtro y Búsqueda OCR */}
      <div className="alon-zone-toolbar p-3 rounded-xl flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[280px] max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por texto en PDF, remito, factura o descripción..."
            className="w-full pl-9 pr-8 py-1.5 bg-slate-900 border border-slate-750 focus:border-cyan-500 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap text-xs">
          {['TODOS', 'COTIZACION_MATERIAL', 'FICHA_TECNICA', 'REMITO', 'FACTURA'].map((type) => (
            <button
              key={type}
              onClick={() => setFilterDocType(type)}
              className={`px-2.5 py-1 rounded-lg font-semibold transition-all cursor-pointer ${
                filterDocType === type
                  ? 'bg-cyan-500 text-slate-950 font-bold'
                  : 'bg-slate-950 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {type === 'TODOS' ? 'Todos' : type.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Visualización Lista o Fichas */}
      {docsViewMode === 'lista' ? (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="sticky top-0 z-20 bg-slate-950 text-[10px] uppercase font-bold text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Archivo</th>
                <th className="py-2.5 px-3">Tipo Documento</th>
                <th className="py-2.5 px-3">Descripción</th>
                <th className="py-2.5 px-3">Rubro</th>
                <th className="py-2.5 px-3">Fecha</th>
                <th className="py-2.5 px-3 text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredDocs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No se encontraron documentos adjuntos.
                  </td>
                </tr>
              ) : (
                filteredDocs.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/50 transition-colors">
                    <td className="py-2 px-3 font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                      <span className="truncate max-w-[260px]">{d.original_filename}</span>
                      {d.extracted_text && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-950 text-emerald-400 border border-emerald-800" title="Texto OCR indexado">
                          OCR ✓
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3">
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300">
                        {d.doc_type || 'COTIZACION_MATERIAL'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-300">{d.description || '—'}</td>
                    <td className="py-2 px-3 text-slate-400">{d.category || 'General'}</td>
                    <td className="py-2 px-3 text-slate-400 font-mono text-[10px]">
                      {d.created_at ? new Date(d.created_at).toLocaleDateString('es-AR') : '—'}
                    </td>
                    <td className="py-2 px-3 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <a
                          href={d.storage_path}
                          target="_blank"
                          rel="noreferrer"
                          className="px-2 py-1 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded text-xs font-bold flex items-center gap-1"
                        >
                          <Eye className="w-3 h-3" />
                          <span>Abrir</span>
                        </a>
                        <button
                          onClick={() => {
                            setSelectedDocAction(d)
                            setShowDocActionModal(true)
                          }}
                          className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                          title="Gestionar archivo (editar metadatos, reemplazar, borrar)"
                        >
                          <SlidersHorizontal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredDocs.map((d) => (
            <div key={d.id} className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-cyan-400 shrink-0" />
                    <h4 className="font-bold text-white text-xs truncate max-w-[180px]">{d.original_filename}</h4>
                  </div>
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">{d.doc_type || 'Material'}</span>
                </div>
                {d.description && <p className="text-xs text-slate-300 mt-2">{d.description}</p>}
                {d.extracted_text && (
                  <p className="text-[10px] text-slate-500 line-clamp-2 mt-1.5 font-mono bg-slate-950/60 p-1.5 rounded">
                    {d.extracted_text}
                  </p>
                )}
              </div>

              <div className="mt-3 pt-2 border-t border-slate-800 flex items-center justify-between">
                <span className="text-[10px] text-slate-500 font-mono">
                  {d.created_at ? new Date(d.created_at).toLocaleDateString('es-AR') : '—'}
                </span>
                <div className="flex items-center gap-1.5">
                  <a
                    href={d.storage_path}
                    target="_blank"
                    rel="noreferrer"
                    className="px-2 py-1 bg-cyan-500/20 text-cyan-300 rounded text-xs font-bold"
                  >
                    Abrir
                  </a>
                  <button
                    onClick={() => {
                      setSelectedDocAction(d)
                      setShowDocActionModal(true)
                    }}
                    className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 cursor-pointer"
                  >
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modales */}
      {showUploadModal && (
        <UploadDocModal
          order={null}
          supplier={null}
          onClose={() => setShowUploadModal(false)}
          onSuccess={(created) => {
            setDocuments?.((prev) => [...created, ...prev])
            setShowUploadModal(false)
          }}
        />
      )}

      {showDocActionModal && selectedDocAction && (
        <DocActionModal
          doc={selectedDocAction}
          onClose={() => {
            setShowDocActionModal(false)
            setSelectedDocAction(null)
          }}
          onSuccess={handleDocSuccess}
        />
      )}
    </div>
  )
}
