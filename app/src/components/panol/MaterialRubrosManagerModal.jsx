import { useState, useMemo } from 'react'
import { FolderTree, Plus, Edit3, Trash2, Check, X, Search, AlertTriangle } from 'lucide-react'
import { MATERIAL_CATEGORIES } from '../../lib/panolConstants'
import {
  buildMergedRubrosCatalog,
  createMaterialRubroService,
  renameMaterialRubroService,
  deleteMaterialRubroService
} from '../../lib/panolCatalogService'

export default function MaterialRubrosManagerModal({
  rubros = [],
  materials = [],
  isAdmin = false,
  user,
  onRefreshData,
  showFeedback,
  onClose
}) {
  const [search, setSearch] = useState('')
  const [newName, setNewName] = useState('')
  const [newCategory, setNewCategory] = useState('MATERIALES')
  const [editingKey, setEditingKey] = useState(null)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('MATERIALES')
  const [busy, setBusy] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')

  const mergedRubros = useMemo(() => buildMergedRubrosCatalog(rubros, materials), [rubros, materials])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return mergedRubros
    return mergedRubros.filter((r) => r.name.toLowerCase().includes(q) || (r.category || '').toLowerCase().includes(q))
  }, [mergedRubros, search])

  const handleCreate = async (e) => {
    e.preventDefault()
    if (busy || !isAdmin) return
    setErrorMsg('')
    try {
      setBusy(true)
      await createMaterialRubroService({
        name: newName,
        category: newCategory,
        existingRubros: mergedRubros,
        isAdmin,
        user
      })
      setNewName('')
      showFeedback?.('success', `Rubro "${newName.trim().toUpperCase()}" agregado a la B.D.`)
      await onRefreshData?.()
    } catch (err) {
      setErrorMsg(err.message || 'Error creando rubro.')
    } finally {
      setBusy(false)
    }
  }

  const startEdit = (item) => {
    setEditingKey(item.name)
    setEditName(item.name)
    setEditCategory(item.category || 'MATERIALES')
    setErrorMsg('')
  }

  const handleSaveEdit = async (item) => {
    if (busy || !isAdmin) return
    setErrorMsg('')
    try {
      setBusy(true)
      const res = await renameMaterialRubroService({
        rubroItem: item,
        newName: editName,
        category: editCategory,
        existingRubros: mergedRubros,
        isAdmin,
        user
      })
      setEditingKey(null)
      showFeedback?.(
        'success',
        res.oldName !== res.newName
          ? `Rubro renombrado "${res.oldName}" ➔ "${res.newName}" (materiales actualizados en cascada).`
          : `Rubro "${res.newName}" actualizado.`
      )
      await onRefreshData?.()
    } catch (err) {
      setErrorMsg(err.message || 'Error editando rubro.')
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (item) => {
    if (busy || !isAdmin) return
    setErrorMsg('')
    try {
      setBusy(true)
      await deleteMaterialRubroService({ rubroItem: item, isAdmin, user })
      showFeedback?.('success', `Rubro "${item.name}" eliminado.`)
      await onRefreshData?.()
    } catch (err) {
      setErrorMsg(err.message || 'Error eliminando rubro.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="alon-modal-card max-w-3xl">
        <div className="alon-modal-header">
          <div className="flex items-center gap-2.5 text-white font-black text-sm min-w-0">
            <div className="w-8 h-8 rounded-lg bg-sky-500/20 border border-sky-500/40 flex items-center justify-center text-sky-400 shrink-0">
              <FolderTree className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <span className="block leading-tight truncate">BASE DE DATOS DE RUBROS DE MATERIALES (1 : N)</span>
              <span className="text-[11px] font-normal text-slate-400 block truncate">
                Lista maestra de rubros (hoja RUBRO.MAT): un rubro agrupa muchos materiales. Renombrar actualiza todos los materiales vinculados.
              </span>
            </div>
          </div>
          <button type="button" tabIndex={-1} onClick={onClose} className="text-slate-500 hover:text-white p-1 rounded-lg hover:bg-slate-800 cursor-pointer shrink-0">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="alon-modal-body space-y-3 text-xs">
          {errorMsg && (
            <div className="p-2.5 rounded-xl bg-rose-950/90 border border-rose-500/70 text-rose-200 font-bold flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{errorMsg}</span>
              </div>
              <button type="button" onClick={() => setErrorMsg('')} className="text-rose-300 hover:text-white cursor-pointer">✕</button>
            </div>
          )}

          {isAdmin && (
            <form onSubmit={handleCreate} className="p-2.5 rounded-xl bg-slate-950 border border-sky-500/30 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Nuevo rubro (ej: CHAPAS NAVALES, BULONERIA, SOLDADURA...)"
                className="flex-1 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-white font-bold uppercase focus:outline-none focus:border-sky-400 text-xs"
              />
              <select
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-bold focus:outline-none focus:border-sky-400 text-xs"
              >
                {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <button
                type="submit"
                disabled={busy || !newName.trim()}
                className="px-3.5 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-slate-950 font-black inline-flex items-center justify-center gap-1 cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3]" />
                <span>Agregar Rubro</span>
              </button>
            </form>
          )}

          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filtrar rubros..."
                className="w-full pl-8 pr-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-white text-xs focus:outline-none focus:border-cyan-400"
              />
            </div>
            <span className="text-[11px] text-slate-400 font-mono shrink-0">
              {filtered.length} de {mergedRubros.length} rubros
            </span>
          </div>

          <div className="max-h-[46vh] overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/60">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-slate-900 text-slate-400 uppercase text-[10px] border-b border-slate-800">
                <tr>
                  <th className="py-2 px-2.5 w-10 text-center">#</th>
                  <th className="py-2 px-2.5">Rubro Técnico</th>
                  <th className="py-2 px-2.5">Categoría Ref.</th>
                  <th className="py-2 px-2.5 text-center">Materiales (1:N)</th>
                  {isAdmin && <th className="py-2 px-2.5 text-center w-24">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {filtered.map((item, idx) => {
                  const isEditing = editingKey === item.name
                  return (
                    <tr key={item.name} className="hover:bg-slate-900/70">
                      <td className="py-1.5 px-2.5 text-center font-mono text-slate-500">{idx + 1}</td>
                      <td className="py-1.5 px-2.5 font-bold text-white">
                        {isEditing ? (
                          <input
                            type="text"
                            autoFocus
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(item)
                              if (e.key === 'Escape') setEditingKey(null)
                            }}
                            className="w-full px-2 py-0.5 rounded bg-slate-950 border border-sky-400 text-white uppercase font-bold text-xs focus:outline-none"
                          />
                        ) : (
                          <span>{item.name}</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2.5">
                        {isEditing ? (
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value)}
                            className="px-2 py-0.5 rounded bg-slate-950 border border-sky-400 text-white text-xs focus:outline-none"
                          >
                            {MATERIAL_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-bold">
                            {item.category}
                          </span>
                        )}
                      </td>
                      <td className="py-1.5 px-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full font-mono font-bold text-[10px] ${item.materialsCount > 0 ? 'bg-cyan-950 text-cyan-300 border border-cyan-700/60' : 'bg-slate-800 text-slate-500'}`}>
                          {item.materialsCount} mat.
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="py-1.5 px-2.5 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {isEditing ? (
                              <>
                                <button type="button" disabled={busy} onClick={() => handleSaveEdit(item)} className="p-1 rounded bg-emerald-600 hover:bg-emerald-500 text-slate-950 cursor-pointer" title="Guardar cambio">
                                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                                </button>
                                <button type="button" onClick={() => setEditingKey(null)} className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer" title="Cancelar">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </>
                            ) : (
                              <>
                                <button type="button" onClick={() => startEdit(item)} className="p-1 rounded bg-slate-900 hover:bg-sky-950 border border-slate-700 hover:border-sky-500/60 text-slate-300 hover:text-sky-300 cursor-pointer" title="Editar nombre o categoría del rubro">
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  disabled={busy || item.materialsCount > 0 || !item.id}
                                  onClick={() => handleDelete(item)}
                                  className="p-1 rounded bg-slate-900 hover:bg-rose-950 border border-slate-700 hover:border-rose-500/60 text-slate-400 hover:text-rose-400 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                                  title={item.materialsCount > 0 ? `Tiene ${item.materialsCount} material(es) vinculado(s)` : 'Eliminar rubro sin uso'}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="alon-modal-footer">
          <button type="button" onClick={onClose} className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold cursor-pointer text-xs">
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
